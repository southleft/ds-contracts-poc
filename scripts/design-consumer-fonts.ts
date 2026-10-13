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
  /** Optional distribution notice supplied with the font, retained byte for byte. */
  license?: { file: string; sha256: string; bytes: Buffer };
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
interface FontNameReadLimits { maxDecodedBytes: number; maxNameRecords: number; maxFamilyBytes: number; maxFamilyTotalBytes: number }
const UPLOAD_FONT_NAME_LIMITS: FontNameReadLimits = { maxDecodedBytes: 32 * 1024 * 1024, maxNameRecords: 4096, maxFamilyBytes: 1024, maxFamilyTotalBytes: 64 * 1024 };
export function fontFamilyNames(bytes: Buffer, limits?: FontNameReadLimits): string[] {
  const maxDecodedBytes = limits?.maxDecodedBytes;
  const tag = (b: Buffer, at: number) => b.toString('latin1', at, at + 4);
  let sfnt: Buffer, tables: Map<string, { offset: number; length: number }>;
  const kind = tag(bytes, 0);
  if (kind === 'wOFF') {
    const count = bytes.readUInt16BE(12), out = new Map<string, { offset: number; length: number }>();
    const parts: Buffer[] = [];
    let at = 0;
    for (let i = 0; i < count; i++) {
      const e = 44 + i * 20, offset = bytes.readUInt32BE(e + 4), compLength = bytes.readUInt32BE(e + 8), origLength = bytes.readUInt32BE(e + 12);
      if (maxDecodedBytes !== undefined && origLength > maxDecodedBytes - at) throw Error('decoded-font-too-large');
      const data = bytes.subarray(offset, offset + compLength), table = compLength < origLength
        ? inflateSync(data, maxDecodedBytes === undefined ? undefined : { maxOutputLength: maxDecodedBytes - at }) : data;
      if (maxDecodedBytes !== undefined && table.length > maxDecodedBytes - at) throw Error('decoded-font-too-large');
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
      if (maxDecodedBytes !== undefined && offset > maxDecodedBytes) throw Error('decoded-font-too-large');
    }
    sfnt = brotliDecompressSync(bytes.subarray(at, at + compressed),
      maxDecodedBytes === undefined ? undefined : { maxOutputLength: maxDecodedBytes }); tables = out;
  } else if (['\u0000\u0001\u0000\u0000', 'OTTO', 'true'].includes(kind)) {
    const count = bytes.readUInt16BE(4), out = new Map<string, { offset: number; length: number }>();
    for (let i = 0; i < count; i++) { const e = 12 + i * 16; out.set(tag(bytes, e), { offset: bytes.readUInt32BE(e + 8), length: bytes.readUInt32BE(e + 12) }); }
    sfnt = bytes; tables = out;
  } else throw Error('unsupported font format');
  const entry = tables.get('name');
  if (!entry) throw Error('no name table');
  const name = sfnt.subarray(entry.offset, entry.offset + entry.length), count = name.readUInt16BE(2), strings = name.readUInt16BE(4);
  if (limits && count > limits.maxNameRecords) throw Error('font-name-record-budget-exceeded');
  const families = new Set<string>();
  let familyBytes = 0;
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12, platform = name.readUInt16BE(r), nameId = name.readUInt16BE(r + 6), length = name.readUInt16BE(r + 8), offset = strings + name.readUInt16BE(r + 10);
    if (![1, 16, 21].includes(nameId)) continue;
    if (limits && length > limits.maxFamilyBytes * 2) throw Error('font-name-family-budget-exceeded');
    const raw = name.subarray(offset, offset + length);
    // Windows and Unicode platforms are UTF-16BE; Macintosh Roman names are ASCII here.
    const text = platform === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
    if (limits) {
      const decodedSize = Buffer.byteLength(text, 'utf8');
      if (decodedSize > limits.maxFamilyBytes) throw Error('font-name-family-budget-exceeded');
      familyBytes += decodedSize;
      if (familyBytes > limits.maxFamilyTotalBytes) throw Error('font-name-total-budget-exceeded');
    }
    if (text.trim()) families.add(text.trim());
  }
  if (!families.size) throw Error('no family name');
  return [...families];
}

/** Bytes explicitly supplied by a caller, with no filesystem or network locator. */
export interface ConsumerFontBytes {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  bytes: Buffer;
  licenseBytes?: Buffer;
}
type Refuse = (reason: string) => never;
function fontDescriptor(value: Record<string, unknown>, reason: Refuse): Pick<ConsumerFont, 'family' | 'weight' | 'style'> {
  if (typeof value.family !== 'string' || value.family.length > 100 || value.family !== value.family.trim() ||
      !/^[\p{L}\p{N}][\p{L}\p{N} ._+-]*$/u.test(value.family) ||
      /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|math|fangsong|emoji)$/i.test(value.family)) reason('invalid-family');
  if (typeof value.weight !== 'string' || !/^\d{1,4}( \d{1,4})?$/.test(value.weight)) reason('invalid-weight');
  const weights = value.weight.split(' ').map(Number);
  if (weights.some(n => n < 1 || n > 1000) || (weights.length === 2 && weights[0]! >= weights[1]!)) reason('invalid-weight');
  if (value.style !== 'normal' && value.style !== 'italic') reason('invalid-style');
  return { family: value.family, weight: weights.join(' '), style: value.style };
}
function rejectOverlappingFace(descriptor: ReturnType<typeof fontDescriptor>, fonts: readonly ConsumerFont[], reason: Refuse): void {
  const weights = descriptor.weight.split(' ').map(Number);
  for (const existing of fonts) {
    const range = existing.weight.split(' ').map(Number);
    if (existing.family.toLowerCase() === descriptor.family.toLowerCase() && existing.style === descriptor.style &&
        weights[0]! <= range.at(-1)! && range[0]! <= weights.at(-1)!) reason('overlapping-face');
  }
}
function authenticateFontBytes(descriptor: ReturnType<typeof fontDescriptor>, bytes: Buffer, sha256: string, reason: Refuse, limits?: FontNameReadLimits): ConsumerFont {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4 || bytes.length > 16 * 1024 * 1024) reason('invalid-file-size');
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) reason('sha256-mismatch');
  const formats = { '00010000': ['ttf', 'truetype'], '4f54544f': ['otf', 'opentype'], '774f4646': ['woff', 'woff'], '774f4632': ['woff2', 'woff2'] } as const;
  const format = formats[bytes.subarray(0, 4).toString('hex') as keyof typeof formats];
  if (!format) reason('unsupported-font-format');
  let declared: string[];
  try { declared = fontFamilyNames(bytes, limits); } catch (error) { reason(`font-names-unreadable:${error instanceof Error ? error.message : String(error)}`); }
  if (!declared.some(name => name.toLowerCase() === descriptor.family.toLowerCase())) {
    const names = (limits ? declared.slice(0, 8).map(name => name.slice(0, 100)) : declared).map(name => JSON.stringify(name)).join(', ');
    const reported = limits ? names.slice(0, 1024) + (declared.length > 8 || names.length > 1024 ? ' …' : '') : names;
    reason(`family-not-declared-by-font:${JSON.stringify(descriptor.family)} (the file names itself ${reported})`);
  }
  return { ...descriptor, sha256, file: `${sha256}.${format[0]}`, format: format[1], bytes };
}
function authenticateNotice(bytes: Buffer, sha256: string, reason: Refuse): NonNullable<ConsumerFont['license']> {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 256 * 1024) reason('invalid-license-size');
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) reason('license-sha256-mismatch');
  return { file: `${sha256}.txt`, sha256, bytes };
}
/** Authenticate explicit bytes using the same face rules as the CLI manifest.
 * Hashes and package filenames are computed here, never accepted as authority. */
export function consumerFontsFromBytes(values: readonly ConsumerFontBytes[]): ConsumerFont[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 32) fail('invalid-manifest');
  const fonts: ConsumerFont[] = [];
  let total = 0;
  for (const [index, value] of values.entries()) {
    const reason: Refuse = message => fail(`${index}:${message}`);
    const descriptor = fontDescriptor(value as unknown as Record<string, unknown>, reason);
    rejectOverlappingFace(descriptor, fonts, reason);
    if (!Buffer.isBuffer(value.bytes) || (total += value.bytes.length) > 32 * 1024 * 1024) reason('invalid-file-size');
    const font = authenticateFontBytes(descriptor, value.bytes, createHash('sha256').update(value.bytes).digest('hex'), reason, UPLOAD_FONT_NAME_LIMITS);
    if (value.licenseBytes !== undefined) font.license = authenticateNotice(value.licenseBytes, createHash('sha256').update(value.licenseBytes).digest('hex'), reason);
    fonts.push(font);
  }
  return fonts;
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
    if (!record(value) || !exactKeys(value, ['family', 'weight', 'style', 'file', 'sha256', ...(Object.hasOwn(value, 'license') ? ['license'] : [])])) reason('invalid-face');
    const descriptor = fontDescriptor(value, reason);
    if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) reason('invalid-sha256');
    if (typeof value.file !== 'string' || !value.file || value.file.includes('\0') || /^[a-z][a-z0-9+.-]*:/i.test(value.file)) reason('local-file-required');
    rejectOverlappingFace(descriptor, fonts, reason);
    const source = path.resolve(path.dirname(manifestPath), value.file);
    const stat = statSync(source);
    if (!stat.isFile() || stat.size < 4 || stat.size > 16 * 1024 * 1024 || (total += stat.size) > 32 * 1024 * 1024) reason('invalid-file-size');
    const bytes = readFileSync(source);
    if (bytes.length !== stat.size) reason('file-changed-during-read');
    const font = authenticateFontBytes(descriptor, bytes, value.sha256, reason);
    let license: ConsumerFont['license'];
    if (value.license !== undefined) {
      const notice = value.license;
      if (!record(notice) || !exactKeys(notice, ['file', 'sha256']) ||
          typeof notice.file !== 'string' || !notice.file || notice.file.includes('\0') || /^[a-z][a-z0-9+.-]*:/i.test(notice.file) ||
          typeof notice.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(notice.sha256)) reason('invalid-license');
      const noticePath = path.resolve(path.dirname(manifestPath), notice.file);
      const noticeStat = statSync(noticePath);
      if (!noticeStat.isFile() || noticeStat.size < 1 || noticeStat.size > 256 * 1024) reason('invalid-license-size');
      const noticeBytes = readFileSync(noticePath);
      if (noticeBytes.length !== noticeStat.size || createHash('sha256').update(noticeBytes).digest('hex') !== notice.sha256)
        reason('license-sha256-mismatch');
      license = authenticateNotice(noticeBytes, notice.sha256, reason);
    }
    fonts.push({ ...font, ...(license ? { license } : {}) });
  }
  return fonts;
}

export function consumerFontManifest(fonts: readonly ConsumerFont[]) {
  return { version: 1, fonts: fonts.map(({ family, weight, style, sha256, file, license }) => ({ family, weight, style, file, sha256,
    ...(license ? { license: { file: license.file, sha256: license.sha256 } } : {}) })) };
}

/** The only CSS generated here is @font-face. Asset URLs are relative so the
 * isolated production build and its retained review site remain portable. */
export function writeConsumerFonts(directory: string, fonts: readonly ConsumerFont[]): void {
  mkdirSync(directory, { recursive: true });
  const files = new Set<string>();
  for (const font of fonts) {
    if (!files.has(font.file)) {
      writeFileSync(path.join(directory, font.file), font.bytes, { flag: 'wx' }); files.add(font.file);
    }
    if (font.license && !files.has(font.license.file)) {
      writeFileSync(path.join(directory, font.license.file), font.license.bytes, { flag: 'wx' }); files.add(font.license.file);
    }
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
