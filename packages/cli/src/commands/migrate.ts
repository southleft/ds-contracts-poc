/**
 * `ds-contracts migrate <paths..> [--check]` — the schema 17 codemod.
 *
 * Rewrites every JSON document under the given files/directories from the
 * v16 contract spellings to v17 (`@ds-contracts/schema` migrateDocumentToV17
 * — the ONE implementation of the rename table):
 *
 *   figmaRepresentation        → bindings.figma.representation
 *   figmaStatePreviews         → bindings.figma.statePreviews
 *   anchors.figma              → bindings.figma.anchors
 *   anchors.code               → bindings.code.anchors
 *   <part>.slot.figmaProperty  → <part>.slot.bindings.figma.property
 *
 * Scope: EVERY *.json file reached (node_modules, .git, dist skipped) — a
 * contract, a bundle or receipt that embeds contracts, a proposal. Files
 * that carry no v16 spelling are untouched. Byte discipline: a file is
 * re-serialised with ITS OWN indentation and trailing-newline convention,
 * and a file whose committed bytes do not round-trip through JSON.parse →
 * stringify unchanged (a hand-formatted document) is REFUSED BY NAME rather
 * than silently reformatted — the rename is the only diff this command may
 * produce. `--check` writes nothing and exits 1 when any file still carries
 * a v16 spelling (the CI gate).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { mayCarryV16Spelling, migrateDocumentToV17 } from '../../../schema/src/index.js';
import { CliUsageError, parseFlags } from '../lib.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

function collectJson(target: string, out: string[]): void {
  const st = statSync(target);
  if (st.isFile()) {
    if (target.endsWith('.json')) out.push(target);
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) collectJson(full, out);
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
}

/** The file's own serialisation convention: indent (2 spaces, 4, tab, or
 *  minified), whether it ends with a newline, and whether non-ASCII text is
 *  spelled as \uXXXX escapes (the python-json / older-writer convention a
 *  third of the first-party contracts carry). */
function conventionOf(text: string): { indent: string | number; eol: string; escapeUnicode: boolean } {
  const eol = text.endsWith('\n') ? '\n' : '';
  const escapeUnicode = /\\u[0-9a-f]{4}/.test(text) && !/[\u0080-\uffff]/.test(text);
  const m = /^[[{]\n([ \t]+)\S/.exec(text);
  if (!m) return { indent: 0, eol, escapeUnicode };
  return { indent: m[1].includes('\t') ? '\t' : m[1].length, eol, escapeUnicode };
}

const escapeNonAscii = (s: string): string =>
  s.replace(/[\u0080-\uffff]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));

export interface MigrateFileResult {
  file: string;
  status: 'rewritten' | 'stale' | 'clean' | 'refused';
  rewrites: number;
  reason?: string;
}

export function migrateFile(file: string, write: boolean): MigrateFileResult {
  const text = readFileSync(file, 'utf8');
  if (!mayCarryV16Spelling(text)) return { file, status: 'clean', rewrites: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { file, status: 'clean', rewrites: 0 };
  }
  const { doc, rewrites } = migrateDocumentToV17(parsed);
  if (rewrites.length === 0) return { file, status: 'clean', rewrites: 0 };
  const { indent, eol, escapeUnicode } = conventionOf(text);
  const serialise = (v: unknown) => {
    const s = JSON.stringify(v, null, indent);
    return (escapeUnicode ? escapeNonAscii(s) : s) + eol;
  };
  if (serialise(parsed) !== text) {
    return {
      file,
      status: 'refused',
      rewrites: rewrites.length,
      reason: 'the committed bytes do not round-trip through JSON.parse/stringify with the file\'s own indentation — migrate it by hand so the rename is the only diff',
    };
  }
  if (!write) return { file, status: 'stale', rewrites: rewrites.length };
  writeFileSync(file, serialise(doc));
  return { file, status: 'rewritten', rewrites: rewrites.length };
}

export async function migrateCommand(argv: string[]): Promise<number> {
  const args = parseFlags(argv, { bool: ['check', 'quiet'] });
  if (args.positionals.length === 0) {
    throw new CliUsageError('migrate needs at least one file or directory: ds-contracts migrate <paths..> [--check]');
  }
  const check = args.flags.get('check') === true;
  const quiet = args.flags.get('quiet') === true;
  const files: string[] = [];
  for (const p of args.positionals) {
    try {
      collectJson(path.resolve(p), files);
    } catch (err) {
      throw new CliUsageError(`migrate: cannot read ${p} — ${String(err instanceof Error ? err.message : err)}`);
    }
  }
  const results = files.map((f) => migrateFile(f, !check));
  const by = (s: MigrateFileResult['status']) => results.filter((r) => r.status === s);
  for (const r of results) {
    if (r.status === 'clean') continue;
    const rel = path.relative(process.cwd(), r.file);
    if (r.status === 'refused') console.error(`  ✖ ${rel}: ${r.reason}`);
    else if (!quiet) console.log(`  ${check ? '✖ v16 spelling' : '✎'} ${rel} (${r.rewrites} rename${r.rewrites === 1 ? '' : 's'})`);
  }
  const rewritten = by('rewritten').length;
  const stale = by('stale').length;
  const refused = by('refused').length;
  const renames = results.reduce((n, r) => n + (r.status === 'clean' ? 0 : r.rewrites), 0);
  if (check) {
    if (stale + refused > 0) {
      console.error(`✘ migrate --check: ${stale + refused} of ${files.length} JSON file(s) still carry a v16 spelling (${renames} rename(s) pending) — run: ds-contracts migrate <paths..>`);
      return 1;
    }
    console.log(`✔ migrate --check: ${files.length} JSON file(s), none carry a v16 spelling`);
    return 0;
  }
  console.log(`✔ migrate: ${rewritten} of ${files.length} JSON file(s) rewritten to schema 17 (${renames} rename(s))${refused ? `, ${refused} REFUSED by name` : ''}`);
  return refused > 0 ? 1 : 0;
}
