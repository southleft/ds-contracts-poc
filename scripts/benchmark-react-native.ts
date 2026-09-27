/**
 * React → native Figma cells of the benchmark gate (kind "react-to-native").
 *
 * The replay (scripts/react-native-replay.ts) runs the app's own source service
 * headlessly on the vendored React workspace and prepares each case's native
 * plans without writing to Figma. A cell's pin records the normalized plan
 * hashes (root and each nested child main); its fidelity receipt is the
 * native-vs-source image comparison of a live creation whose operations had
 * EXACTLY those plans (checked when the receipt is attached).
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../core/contract-provenance.js';
import { planHash, replayReactNative, type ReplayedCase } from './react-native-replay.js';

export interface ReactCell {
  id: string; row: string; criterion: string; kind: 'react-to-native';
  workspace: string; caseId: string; children: boolean;
  expect: 'pass' | 'known-failure'; knownFailure?: string;
}
export interface ReactFidelity {
  receipt: string; receiptSha256: string; planSetSha256: string; measuredOn: string; measuredAt: string;
  white: number; black: number; layoutExact: boolean; pass: boolean;
}
export interface ReactPin {
  id: string; version: 1; kind: 'react-to-native'; referenceId: string;
  root: string | null; children: Record<string, { exportName: string; planSha256: string | null; refusal?: string }>;
  refusal?: string; recordedOn: string; fidelity: ReactFidelity | null;
}
type Status = 'green' | 'partial' | 'known-failure' | 'stale' | 'red';
export interface ReactVerdict { id: string; row: string; criterion: string; status: Status; reason: string; summary?: string }

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
export const planSet = (root: string | null, children: ReactPin['children']) =>
  sha(canonicalJson({ root, children: Object.fromEntries(Object.entries(children).map(([k, v]) => [k, v.planSha256])) }));

export type ReactReplay = { referenceId: string; result: ReplayedCase };

/** One service run per workspace for every case the cells ask for. */
export async function replayReactCells(root: string, cells: ReactCell[], plans?: string): Promise<Map<string, ReactReplay | Error>> {
  const out = new Map<string, ReactReplay | Error>();
  const byWorkspace = new Map<string, ReactCell[]>();
  for (const c of cells) byWorkspace.set(c.workspace, [...(byWorkspace.get(c.workspace) ?? []), c]);
  for (const [workspace, group] of byWorkspace) {
    try {
      const run = await replayReactNative({ workspace: path.join(root, workspace), cases: [...new Set(group.map(c => c.caseId))],
        children: group.some(c => c.children), ...(plans ? { plans } : {}) });
      for (const c of group) {
        const result = run.cases.find(r => r.caseId === c.caseId);
        out.set(c.id, result ? { referenceId: run.referenceId, result } : Error('case not replayed: ' + c.caseId));
      }
    } catch (e) { for (const c of group) out.set(c.id, e instanceof Error ? e : Error(String(e))); }
  }
  return out;
}

const childMap = (r: ReplayedCase) => Object.fromEntries(r.children.map(c =>
  [c.instanceId, { exportName: c.exportName, planSha256: c.planSha256 ?? null, ...(c.refusal ? { refusal: c.refusal } : {}) }]));

export function judgeReact(cell: ReactCell, pin: ReactPin | null, replay: ReactReplay | Error): ReactVerdict {
  const base = { id: cell.id, row: cell.row, criterion: cell.criterion };
  if (replay instanceof Error) return { ...base, status: 'red', reason: 'replay refused: ' + replay.message };
  if (!pin) return { ...base, status: 'red', reason: 'no pin: record one with --record ' + cell.id };
  const r = replay.result;
  if (cell.expect === 'known-failure') {
    if (r.refusal && r.refusal === pin.refusal) return { ...base, status: 'known-failure', reason: `${cell.knownFailure ?? 'declared failing'}; refuses: ${r.refusal}` };
    if (!r.refusal) return { ...base, status: 'stale', reason: 'the known failure now prepares a native plan: re-pin and measure it' };
    return { ...base, status: 'red', reason: `the refusal changed: pinned "${pin.refusal}", now "${r.refusal}"` };
  }
  if (r.refusal) return { ...base, status: 'red', reason: 'refused: ' + r.refusal };
  const children = childMap(r);
  if (r.root?.planSha256 !== pin.root) return { ...base, status: 'red', reason: 'the native root plan changed; if intended, re-record the pin in a reviewed change and re-measure' };
  const moved = [...new Set([...Object.keys(pin.children), ...Object.keys(children)])].filter(k => canonicalJson(pin.children[k]) !== canonicalJson(children[k]));
  if (moved.length) return { ...base, status: 'red', reason: `a nested child plan changed (${moved.map(k => pin.children[k]?.exportName ?? children[k]?.exportName ?? k).join(', ')}); re-record and re-measure if intended` };
  if (r.repeat && (r.repeat.status !== 200 || r.repeat.newOperations !== 0))
    return { ...base, status: 'red', reason: `a repeated request ${r.repeat.status !== 200 ? 'refused (' + (r.repeat.refusal ?? r.repeat.status) + ')' : 'created ' + r.repeat.newOperations + ' more operation(s)'} instead of returning the prepared one` };
  const repeated = r.repeat ? '; a repeat after another root joined returned the prepared operation' : '';
  const f = pin.fidelity;
  if (!f || f.planSetSha256 !== planSet(pin.root, pin.children))
    return { ...base, status: 'stale', reason: 'plans match their pin' + repeated + ', but no native comparison measured these exact plans yet' };
  const summary = `native vs React source ${f.white.toFixed(3)}% white, ${f.black.toFixed(3)}% black${f.layoutExact ? ', exact size' : ', size differs'} — ${f.measuredOn}, ${f.measuredAt}`;
  return f.pass ? { ...base, status: 'green', reason: 'plans match their pin' + repeated + '; ' + summary, summary }
    : { ...base, status: 'red', reason: 'a cell expected to pass fails: ' + summary, summary };
}

const pinPath = (root: string, id: string) => path.join(root, 'benchmark', 'pins', id + '.json');
export const readReactPin = (root: string, id: string): ReactPin | null =>
  existsSync(pinPath(root, id)) ? JSON.parse(readFileSync(pinPath(root, id), 'utf8')) : null;

export function recordReact(root: string, cell: ReactCell, replay: ReactReplay) {
  const prior = readReactPin(root, cell.id), r = replay.result, children = childMap(r);
  const pin: ReactPin = { id: cell.id, version: 1, kind: 'react-to-native', referenceId: replay.referenceId, root: r.root?.planSha256 ?? null,
    children, ...(r.refusal ? { refusal: r.refusal } : {}), recordedOn: `${process.platform}-${process.arch}`, fidelity: null };
  pin.fidelity = prior?.fidelity && prior.fidelity.planSetSha256 === planSet(pin.root, pin.children) ? prior.fidelity : null;
  mkdirSync(path.dirname(pinPath(root, cell.id)), { recursive: true });
  writeFileSync(pinPath(root, cell.id), JSON.stringify(pin, null, 2) + '\n');
  return pin;
}

/** Bind a source-native comparison to the plans of the live operations it measured. */
export function attachReact(root: string, cell: ReactCell, receiptPath: string, ops: Record<string, string>, operationsDir: string,
  measuredOn: string, measuredAt: string) {
  const pin = readReactPin(root, cell.id);
  if (!pin) throw Error('benchmark-attach-unpinned: record ' + cell.id + ' first');
  const planOf = (op: string) => planHash(JSON.parse(readFileSync(path.join(operationsDir, op, 'plan.json'), 'utf8')).plan);
  if (!ops.root || planOf(ops.root) !== pin.root) throw Error('benchmark-attach-mismatch: the measured root operation had a different plan than the pin');
  for (const [instanceId, child] of Object.entries(pin.children)) {
    if (!ops[instanceId] || planOf(ops[instanceId]) !== child.planSha256)
      throw Error(`benchmark-attach-mismatch: the measured ${child.exportName} operation had a different plan than the pin`);
  }
  const bytes = readFileSync(receiptPath), receipt = JSON.parse(bytes.toString('utf8'));
  const score = (bg: string) => receipt.scores?.find((s: any) => s.background === bg);
  if (!score('white') || !score('black') || typeof receipt.pass !== 'boolean' || receipt.limitPercent !== 5)
    throw Error('benchmark-receipt-unscored: expected a source-native comparison with white and black scores at the 5% limit');
  const dir = path.join(root, 'benchmark', 'receipts', cell.id);
  mkdirSync(dir, { recursive: true });
  copyFileSync(receiptPath, path.join(dir, 'comparison.json'));
  pin.fidelity = { receipt: path.relative(root, path.join(dir, 'comparison.json')), receiptSha256: sha(bytes), planSetSha256: planSet(pin.root, pin.children),
    measuredOn, measuredAt, white: Number(score('white').mismatchPercent), black: Number(score('black').mismatchPercent),
    layoutExact: receipt.layoutExact === true, pass: receipt.pass === true && receipt.layoutExact === true };
  writeFileSync(pinPath(root, cell.id), JSON.stringify(pin, null, 2) + '\n');
  return pin;
}
