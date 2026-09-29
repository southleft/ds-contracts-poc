/** Explicit consumer font assets. This provisions fonts, never component CSS,
 * rendering hints or source-font identity. No network or installed-font lookup. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync, inflateSync } from 'node:zlib';
import type { Page } from 'playwright-core';

export interface ConsumerFont {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  sha256: string;
  file: string;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  bytes: Buffer;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function fail(reason: string): never { throw Error(`consumer-fonts:${reason}`); }
const exactKeys = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(v, key));

/** The family names a font's own `name` table declares (IDs 1, 16 and 21, every
 * platform), read from TrueType/OpenType, WOFF (zlib) or WOFF2 (Brotli) bytes.
 * A face is registered only under a family its own bytes declare: a file is
 * never provisioned as ANOTHER family (never, for example, the macOS system
 * UI font SFNS.ttf as "SF Pro"), because the check would then report a font
 * provisioned that the design never used. Throws when the table is unreadable. */
export function fontFamilyNames(bytes: Buffer): string[] {
  const tag = (b: Buffer, at: number) => b.toString('latin1', at, at + 4);
  let sfnt: Buffer, tables: Map<string, { offset: number; length: number }>;
  const kind = tag(bytes, 0);
  if (kind === 'wOFF') {
    const count = bytes.readUInt16BE(12), out = new Map<string, { offset: number; length: number }>();
    const parts: Buffer[] = [];
    let at = 0;
    for (let i = 0; i < count; i++) {
      const e = 44 + i * 20, offset = bytes.readUInt32BE(e + 4), compLength = bytes.readUInt32BE(e + 8), origLength = bytes.readUInt32BE(e + 12);
      const data = bytes.subarray(offset, offset + compLength), table = compLength < origLength ? inflateSync(data) : data;
      out.set(tag(bytes, e), { offset: at, length: origLength }); parts.push(table); at += table.length;
    }
    sfnt = Buffer.concat(parts); tables = out;
  } else if (kind === 'wOF2') {
    // WOFF2: a table directory of UIntBase128 lengths, then one Brotli stream
    // holding every table back to back in directory order.
    const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
    if (tag(bytes, 4) === 'ttcf') throw Error('font collection');
    const count = bytes.readUInt16BE(12), compressed = bytes.readUInt32BE(20);
    let at = 48;
    const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = bytes[at++]!; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v; } throw Error('bad UIntBase128'); };
    const out = new Map<string, { offset: number; length: number }>();
    let offset = 0;
    for (let i = 0; i < count; i++) {
      const flags = bytes[at++]!, index = flags & 0x3f, version = flags >> 6;
      const name = index === 63 ? tag(bytes, (at += 4) - 4) : KNOWN[index];
      if (!name) throw Error('unknown table');
      const orig = base128(), transformed = name === 'glyf' || name === 'loca' ? version !== 3 : version !== 0;
      const length = transformed ? base128() : orig;
      out.set(name, { offset, length }); offset += length;
    }
    sfnt = brotliDecompressSync(bytes.subarray(at, at + compressed)); tables = out;
  } else if (['\u0000\u0001\u0000\u0000', 'OTTO', 'true'].includes(kind)) {
    const count = bytes.readUInt16BE(4), out = new Map<string, { offset: number; length: number }>();
    for (let i = 0; i < count; i++) { const e = 12 + i * 16; out.set(tag(bytes, e), { offset: bytes.readUInt32BE(e + 8), length: bytes.readUInt32BE(e + 12) }); }
    sfnt = bytes; tables = out;
  } else throw Error('unsupported font format');
  const entry = tables.get('name');
  if (!entry) throw Error('no name table');
  const name = sfnt.subarray(entry.offset, entry.offset + entry.length), count = name.readUInt16BE(2), strings = name.readUInt16BE(4);
  const families = new Set<string>();
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12, platform = name.readUInt16BE(r), nameId = name.readUInt16BE(r + 6), length = name.readUInt16BE(r + 8), offset = strings + name.readUInt16BE(r + 10);
    if (![1, 16, 21].includes(nameId)) continue;
    const raw = name.subarray(offset, offset + length);
    // Windows and Unicode platforms are UTF-16BE; Macintosh Roman names are ASCII here.
    const text = platform === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
    if (text.trim()) families.add(text.trim());
  }
  if (!families.size) throw Error('no family name');
  return [...families];
}

/** Read and authenticate ALL inputs before making a consumer or writing evidence.
 * Paths are explicit operator CLI inputs, resolved beside the manifest. */
export function readConsumerFonts(manifestPath: string): ConsumerFont[] {
  if (statSync(manifestPath).size > 64 * 1024) fail('manifest-too-large');
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!record(manifest) || !exactKeys(manifest, ['version', 'fonts']) || manifest.version !== 1 ||
      !Array.isArray(manifest.fonts) || manifest.fonts.length < 1 || manifest.fonts.length > 32) fail('invalid-manifest');
  const fonts: ConsumerFont[] = [];
  let total = 0;
  for (const [index, value] of manifest.fonts.entries()) {
    function reason(message: string): never { return fail(`${index}:${message}`); }
    if (!record(value) || !exactKeys(value, ['family', 'weight', 'style', 'file', 'sha256'])) reason('invalid-face');
    if (typeof value.family !== 'string' || value.family.length > 100 || value.family !== value.family.trim() ||
        !/^[\p{L}\p{N}][\p{L}\p{N} ._+-]*$/u.test(value.family) ||
        /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|math|fangsong|emoji)$/i.test(value.family)) reason('invalid-family');
    if (typeof value.weight !== 'string' || !/^\d{1,4}( \d{1,4})?$/.test(value.weight)) reason('invalid-weight');
    const weights = value.weight.split(' ').map(Number);
    if (weights.some(n => n < 1 || n > 1000) || (weights.length === 2 && weights[0]! >= weights[1]!)) reason('invalid-weight');
    const weight = weights.join(' ');
    if (value.style !== 'normal' && value.style !== 'italic') reason('invalid-style');
    if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) reason('invalid-sha256');
    if (typeof value.file !== 'string' || !value.file || value.file.includes('\0') || /^[a-z][a-z0-9+.-]*:/i.test(value.file)) reason('local-file-required');
    for (const existing of fonts) {
      const range = existing.weight.split(' ').map(Number);
      if (existing.family.toLowerCase() === value.family.toLowerCase() && existing.style === value.style &&
          weights[0]! <= range.at(-1)! && range[0]! <= weights.at(-1)!) reason('overlapping-face');
    }
    const source = path.resolve(path.dirname(manifestPath), value.file);
    const stat = statSync(source);
    if (!stat.isFile() || stat.size < 4 || stat.size > 16 * 1024 * 1024 || (total += stat.size) > 32 * 1024 * 1024) reason('invalid-file-size');
    const bytes = readFileSync(source);
    if (bytes.length !== stat.size) reason('file-changed-during-read');
    if (createHash('sha256').update(bytes).digest('hex') !== value.sha256) reason('sha256-mismatch');
    const kind = bytes.subarray(0, 4).toString('hex');
    const formats = { '00010000': ['ttf', 'truetype'], '4f54544f': ['otf', 'opentype'], '774f4646': ['woff', 'woff'], '774f4632': ['woff2', 'woff2'] } as const;
    const format = formats[kind as keyof typeof formats];
    if (!format) reason('unsupported-font-format');
    // The family must be one the file's own name table declares (fontFamilyNames).
    const family = value.family;
    let declared: string[];
    try { declared = fontFamilyNames(bytes); } catch (error) { reason(`font-names-unreadable:${error instanceof Error ? error.message : String(error)}`); }
    if (!declared.some(name => name.toLowerCase() === family.toLowerCase()))
      reason(`family-not-declared-by-font:${JSON.stringify(family)} (the file names itself ${declared.map(n => JSON.stringify(n)).join(', ')})`);
    fonts.push({ family: value.family, weight, style: value.style, sha256: value.sha256,
      file: `${value.sha256}.${format[0]}`, format: format[1], bytes });
  }
  return fonts;
}

export function consumerFontManifest(fonts: readonly ConsumerFont[]) {
  return { version: 1, fonts: fonts.map(({ family, weight, style, sha256, file }) => ({ family, weight, style, file, sha256 })) };
}

/** The only CSS generated here is @font-face. Asset URLs are relative so the
 * isolated production build and its retained review site remain portable. */
export function writeConsumerFonts(directory: string, fonts: readonly ConsumerFont[]): void {
  mkdirSync(directory, { recursive: true });
  const files = new Set<string>();
  for (const font of fonts) if (!files.has(font.file)) {
    writeFileSync(path.join(directory, font.file), font.bytes, { flag: 'wx' }); files.add(font.file);
  }
  writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(consumerFontManifest(fonts), null, 2) + '\n', { flag: 'wx' });
  writeFileSync(path.join(directory, 'fonts.css'), fonts.map(font =>
    `@font-face{font-family:${JSON.stringify(font.family)};font-weight:${font.weight};font-style:${font.style};font-display:block;src:url("./${font.file}") format("${font.format}");}`
  ).join('\n') + '\n', { flag: 'wx' });
}

/** A failed webfont must not silently turn an authenticated input into an
 * installed-font/fallback measurement. Loading proves browser acceptance,
 * not that Figma used these bytes or that every glyph exists in this face. */
export async function loadConsumerFonts(page: Page, fonts: readonly ConsumerFont[]) {
  return page.evaluate(async expected => {
    const rows = [];
    for (const font of expected) {
      const matches = [...document.fonts].filter(face => face.family.replace(/^["']|["']$/g, '') === font.family && face.weight === font.weight && face.style === font.style);
      if (matches.length !== 1) throw Error(`consumer-font-face-not-unique:${font.family}:${font.weight}:${font.style}`);
      await matches[0]!.load();
      rows.push({ ...font, status: matches[0]!.status });
    }
    await document.fonts.ready;
    return rows;
  }, consumerFontManifest(fonts).fonts);
}
