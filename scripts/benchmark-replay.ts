/**
 * THE BENCHMARK REGRESSION GATE — `npm run benchmark:check`.
 *
 * Replays every cell in benchmark/cells.json from its frozen input through the
 * product path (Figma dump → the app's own import engine → the app's React
 * generator and packager; scripts/figma-to-react.ts) and compares the output
 * with its pin in benchmark/pins/<id>.json. Nothing here re-measures pixels:
 * a cell's fidelity comes from a committed consumer receipt
 * (benchmark/receipts/<id>/receipt.json) that scored EXACTLY the generated
 * files the pin records (the receipt's own generatedSha256 map).
 *
 * Verdicts (docs/CURRENT.md, "V1 scope and benchmark scoreboard"):
 *   red           the replay refused, the input moved, the pin is missing, the
 *                 output drifted from the pin, or a cell expected to pass fails
 *   stale         the output matches its pin, but no receipt scored it yet —
 *                 a re-recorded pin owes a re-score and is never shown green
 *   known-failure the cell is declared failing in cells.json; named, not red
 *   partial       every in-scope case passes except text-only overages, which
 *                 the owner's rule reports separately and never counts as passes
 *   green         every in-scope case within the 5% limit on white and black
 *
 * Output identity is compared on the generated sources AND the packaged
 * tarball's decompressed entries (gzip headers differ by OS; contents do not).
 *
 *   (default)                  verdicts; exit 1 on any red
 *   --record <id> | --all      write pins from the current replay; a pin whose
 *                              generated files changed loses its receipt
 *   --attach <id> --receipt <receipt.json> --measured-on <p> --measured-at <d>
 *                              attach a design:consumer:check receipt; refused
 *                              unless it scored the pinned generated files
 *   --json <file>              also write the verdicts as JSON
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { figmaToReact } from './figma-to-react.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const mapHash = (m: Record<string, string>) => sha(JSON.stringify(Object.entries(m).sort(([a], [b]) => a.localeCompare(b))));

export interface Cell {
  id: string; row: string; criterion: string; kind: 'figma-to-react'; component: string;
  input: string; inputSha256: string; expect: 'pass' | 'known-failure'; knownFailure?: string;
  scope: { note?: string; outOfScope: Array<{ pattern: string; reason: string }> };
}
export interface ScoredCase { key: string; withinLimit: boolean; white: number | null; black: number | null; residual: string | null }
export interface Fidelity {
  receipt: string; receiptSha256: string; generatedSha256: string; component: string;
  measuredOn: string; measuredAt: string; cases: ScoredCase[]; problems: string[];
}
export interface Pin {
  id: string; version: 1; inputSha256: string; requestSha256: string; rootId: string;
  generated: Record<string, string>; generatedSha256: string;
  entries: Record<string, string>; entriesSha256: string; recordedOn: string; fidelity: Fidelity | null;
}
export type Status = 'green' | 'partial' | 'known-failure' | 'stale' | 'red';
export interface Verdict { id: string; row: string; criterion: string; status: Status; reason: string; summary?: string }

/** name → sha256 of every regular file in a (gzipped) npm tarball. */
export function tarballEntries(tgz: Buffer): Record<string, string> {
  const tar = gunzipSync(tgz), out: Record<string, string> = {};
  for (let o = 0; o + 512 <= tar.length;) {
    const header = tar.subarray(o, o + 512);
    if (header.every(b => b === 0)) break;
    const field = (a: number, n: number) => header.subarray(a, a + n).toString('utf8').replace(/\0.*$/s, '');
    const name = (field(345, 155) ? field(345, 155) + '/' : '') + field(0, 100);
    const size = parseInt(field(124, 12).trim() || '0', 8), type = field(156, 1) || '0';
    if (type === '0') out[name] = sha(tar.subarray(o + 512, o + 512 + size));
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** relative path → sha256, the same map design:consumer:check records. */
export function treeHashes(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of readdirSync(d).sort()) {
      const p = path.join(d, e);
      if (statSync(p).isDirectory()) walk(p); else out[path.relative(dir, p)] = sha(readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

export function readCells(root = repoRoot): Cell[] {
  return JSON.parse(readFileSync(path.join(root, 'benchmark', 'cells.json'), 'utf8')).cells;
}
const pinPath = (root: string, id: string) => path.join(root, 'benchmark', 'pins', id + '.json');
export function readPin(root: string, id: string): Pin | null {
  return existsSync(pinPath(root, id)) ? JSON.parse(readFileSync(pinPath(root, id), 'utf8')) : null;
}

export type Replay = { inputSha256: string; requestSha256: string; rootId: string; generated: Record<string, string>; entries: Record<string, string> };
const replays = new Map<string, Promise<Replay>>();
/** Cells that share an input share one replay. */
export function replayInput(root: string, cell: Cell): Promise<Replay> {
  const key = root + '\0' + cell.input + '\0' + cell.inputSha256;
  if (!replays.has(key)) replays.set(key, (async () => {
    const input = readFileSync(path.join(root, cell.input));
    if (sha(input) !== cell.inputSha256) throw Error(`benchmark-input-changed: ${cell.input} no longer hashes to ${cell.inputSha256.slice(0, 12)}`);
    const out = mkdtempSync(path.join(tmpdir(), 'benchmark-'));
    try {
      const result = await figmaToReact(path.join(root, cell.input), out);
      return { inputSha256: sha(input), requestSha256: result.requestSha256, rootId: result.rootId,
        generated: treeHashes(result.generatedDir), entries: tarballEntries(readFileSync(path.join(out, result.tarball))) };
    } finally { rmSync(out, { recursive: true, force: true }); }
  })());
  return replays.get(key)!;
}

const firstDiff = (a: Record<string, string>, b: Record<string, string>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter(n => a[n] !== b[n]);

export function judge(cell: Cell, pin: Pin | null, replay: Replay | Error): Verdict {
  const base = { id: cell.id, row: cell.row, criterion: cell.criterion };
  if (replay instanceof Error) return { ...base, status: 'red', reason: 'replay refused: ' + replay.message };
  if (!pin) return { ...base, status: 'red', reason: 'no pin: record one with --record ' + cell.id };
  if (pin.inputSha256 !== replay.inputSha256) return { ...base, status: 'red', reason: 'pin was recorded from a different input' };
  if (pin.requestSha256 !== replay.requestSha256)
    return { ...base, status: 'red', reason: 'the proposed library request changed (contracts, tokens or icons); if intended, re-record the pin in a reviewed change and re-score' };
  const gen = firstDiff(pin.generated, replay.generated), ent = firstDiff(pin.entries, replay.entries);
  if (gen.length || ent.length)
    return { ...base, status: 'red', reason: `the ${gen.length ? 'generated React' : 'packaged React'} changed (${(gen.length ? gen : ent).length} file(s), first: ${(gen.length ? gen : ent)[0]}); if intended, re-record the pin in a reviewed change and re-score` };
  const f = pin.fidelity;
  if (!f || f.generatedSha256 !== pin.generatedSha256)
    return { ...base, status: 'stale', reason: 'output matches its pin, but no receipt scored these exact generated files yet' };
  const excluded = (key: string) => cell.scope.outOfScope.find(o => new RegExp(o.pattern).test(key));
  const inScope = f.cases.filter(c => !excluded(c.key));
  const passing = inScope.filter(c => c.withinLimit);
  const textOnly = inScope.filter(c => !c.withinLimit && c.residual === 'text-only');
  const beyond = inScope.filter(c => !c.withinLimit && c.residual !== 'text-only');
  // A receipt problem that names a case (`kind:<key>` or `kind:<key>:detail`)
  // belongs to that case: dropped when the case is out of scope, and not
  // counted twice when it restates that case's image score. Problems naming no
  // case (e.g. variant-prop-discarded:state) always count.
  const caseOf = (p: string) => f.cases.find(c => p.endsWith(':' + c.key) || p.includes(':' + c.key + ':'));
  const problems = f.problems.filter(p => {
    const c = caseOf(p);
    if (!c) return true;
    if (excluded(c.key)) return false;
    return !/^layout-image-difference(-on-black)?-above-limit:/.test(p);
  });
  const max = (k: 'white' | 'black') => Math.max(0, ...passing.map(c => c[k] ?? 0));
  const summary = `${passing.length}/${inScope.length} in scope within 5% (max ${max('white').toFixed(3)}% white, ${max('black').toFixed(3)}% black)`
    + (textOnly.length ? `; ${textOnly.length} text-only partial` : '') + (beyond.length ? `; ${beyond.length} failing beyond text` : '')
    + (problems.length ? `; problems: ${problems.join(', ')}` : '') + ` — ${f.measuredOn}, ${f.measuredAt}`;
  if (!beyond.length && !problems.length && !textOnly.length) return { ...base, status: 'green', reason: 'matches its pin; ' + summary, summary };
  if (!beyond.length && !problems.length) return { ...base, status: 'partial', reason: 'matches its pin; ' + summary, summary };
  if (cell.expect === 'known-failure') return { ...base, status: 'known-failure', reason: `${cell.knownFailure ?? 'declared failing'}; ${summary}`, summary };
  return { ...base, status: 'red', reason: 'a cell expected to pass fails: ' + summary, summary };
}

export async function check(root = repoRoot, only?: Set<string>): Promise<Verdict[]> {
  const verdicts: Verdict[] = [];
  for (const cell of readCells(root)) {
    if (only && !only.has(cell.id)) continue;
    let replay: Replay | Error;
    try { replay = await replayInput(root, cell); } catch (e) { replay = e instanceof Error ? e : Error(String(e)); }
    verdicts.push(judge(cell, readPin(root, cell.id), replay));
  }
  return verdicts;
}

export async function record(root: string, ids: string[]) {
  mkdirSync(path.join(root, 'benchmark', 'pins'), { recursive: true });
  for (const cell of readCells(root).filter(c => ids.includes(c.id))) {
    const replay = await replayInput(root, cell), prior = readPin(root, cell.id), generatedSha256 = mapHash(replay.generated);
    const pin: Pin = { id: cell.id, version: 1, inputSha256: replay.inputSha256, requestSha256: replay.requestSha256, rootId: replay.rootId,
      generated: replay.generated, generatedSha256, entries: replay.entries, entriesSha256: mapHash(replay.entries),
      recordedOn: `${process.platform}-${process.arch}`,
      // A receipt survives a re-record only when it scored these exact files.
      fidelity: prior?.fidelity && prior.fidelity.generatedSha256 === generatedSha256 ? prior.fidelity : null };
    writeFileSync(pinPath(root, cell.id), JSON.stringify(pin, null, 2) + '\n');
    console.log(`recorded ${cell.id}: ${Object.keys(pin.generated).length} generated / ${Object.keys(pin.entries).length} packaged files${pin.fidelity ? '' : ' (stale: needs a receipt)'}`);
  }
}

/** A design:consumer:check receipt, as it scored itself. */
export function readReceipt(receipt: any): Pick<Fidelity, 'cases' | 'problems' | 'component'> & { generated: Record<string, string> } {
  const cases = receipt?.images?.cases;
  if (receipt?.images?.status !== 'figma-images-collected' || !Array.isArray(cases) || cases.length === 0)
    throw Error('benchmark-receipt-unscored: the receipt holds no collected image comparisons');
  if (!receipt.generatedSha256 || typeof receipt.generatedSha256 !== 'object') throw Error('benchmark-receipt-unbound: the receipt records no generated files');
  return {
    component: String(receipt.component ?? ''),
    generated: receipt.generatedSha256,
    problems: (receipt.problems ?? []).map(String),
    cases: cases.map((c: any) => ({ key: String(c.key), withinLimit: c.layoutAligned?.status === 'measured' && c.layoutAligned.withinLimit === true,
      white: c.layoutAligned?.whiteMismatchPercent ?? null, black: c.layoutAligned?.blackMismatchPercent ?? null, residual: c.residual ?? null })),
  };
}

export function attach(root: string, id: string, receiptPath: string, measuredOn: string, measuredAt: string) {
  const cell = readCells(root).find(c => c.id === id), pin = readPin(root, id);
  if (!cell || !pin) throw Error('benchmark-attach-unpinned: record ' + id + ' first');
  const bytes = readFileSync(receiptPath), receipt = readReceipt(JSON.parse(bytes.toString('utf8')));
  if (receipt.component !== cell.component) throw Error(`benchmark-attach-component: the receipt scored ${receipt.component}, the cell is ${cell.component}`);
  const moved = firstDiff(pin.generated, receipt.generated);
  if (moved.length) throw Error(`benchmark-attach-mismatch: the receipt scored different generated files (${moved.length}, first: ${moved[0]}); re-score the pinned output`);
  const dir = path.join(root, 'benchmark', 'receipts', id);
  mkdirSync(dir, { recursive: true });
  copyFileSync(receiptPath, path.join(dir, 'receipt.json'));
  pin.fidelity = { receipt: path.relative(root, path.join(dir, 'receipt.json')), receiptSha256: sha(bytes), generatedSha256: pin.generatedSha256,
    component: receipt.component, measuredOn, measuredAt, cases: receipt.cases, problems: receipt.problems };
  writeFileSync(pinPath(root, id), JSON.stringify(pin, null, 2) + '\n');
  return judge(cell, pin, { inputSha256: pin.inputSha256, requestSha256: pin.requestSha256, rootId: pin.rootId, generated: pin.generated, entries: pin.entries });
}

function flag(name: string) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const recordId = flag('--record'), attachId = flag('--attach');
    if (recordId || process.argv.includes('--all')) { await record(repoRoot, recordId ? [recordId] : readCells().map(c => c.id)); return; }
    if (attachId) {
      const receipt = flag('--receipt'), on = flag('--measured-on'), at = flag('--measured-at');
      if (!receipt || !on || !at) throw Error('usage: --attach <id> --receipt <receipt.json> --measured-on <platform> --measured-at <YYYY-MM-DD>');
      const v = attach(repoRoot, attachId, receipt, on, at);
      console.log(`attached ${attachId}: ${v.status} — ${v.reason}`);
      return;
    }
    const verdicts = await check(repoRoot);
    const icon: Record<Status, string> = { green: '✔', partial: '◐', 'known-failure': '▲', stale: '◌', red: '✖' };
    console.log('BENCHMARK — every pinned cell replayed from its frozen input\n');
    for (const v of verdicts) console.log(`${icon[v.status]} ${v.status.padEnd(13)} ${v.row} · ${v.criterion}\n    ${v.reason}`);
    const json = flag('--json');
    if (json) writeFileSync(json, JSON.stringify({ version: 1, verdicts }, null, 2) + '\n');
    const count = (s: Status) => verdicts.filter(v => v.status === s).length;
    console.log(`\n${count('green')} green · ${count('partial')} partial · ${count('known-failure')} known failure · ${count('stale')} stale · ${count('red')} red`);
    if (count('red')) process.exit(1);
  })().catch(e => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
