/**
 * React → native Figma, replayed headlessly: the app's own source-reference
 * service, run in-process on a throwaway root, driven through the same routes
 * the app's pages call — load the reference, observe ownership, prepare each
 * case's native root draft, observe its caller content, prepare each nested
 * child main — and stopping before anything is written to Figma.
 *
 * The throwaway root links every top-level entry of this repository except
 * `private/`, which starts empty, so the replay neither reads nor writes the
 * operator's retained evidence. The React source is DS_CONTRACTS_REACT_SOURCE_ROOT
 * (the benchmark vendors the independent family under benchmark/react-family).
 *
 * Each prepared plan is reduced to what the source determines: operation ids,
 * observation ids and the revisions derived from them are removed (they differ
 * on every run by construction); everything else is hashed.
 */
import { createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../core/contract-provenance.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
/** Fields whose values are derived from a run's operation or observation ids,
 *  or (programSha256 / sourceProgramSha256) from the absolute checkout path the
 *  source program records. Everything else in a plan — the compiled component,
 *  token input and preparation, projection — is determined by the source and
 *  must replay identically (measured: equal to the live app's plans). */
const RUN_DERIVED = new Set(['operation', 'sourceCompilation', 'componentRevision', 'evidenceRevision', 'revision', 'scopeId', 'collectionName',
  'programSha256', 'sourceProgramSha256',
  // A nested child's matrix revision hashes the selection record, which names
  // the parent operation; its compiled content is compared field by field.
  'matrixRevision',
  // A state-API plan also records a revision of its own request (run ids).
  'requestRevision',
  // Digests of content the plan itself carries (the compiled component, the
  // token trees and prepared rows), which also hash the observed name below.
  'contractRevision', 'tokenRevision', 'tokenTreeRevision', 'tokensSha256', 'draftRevision']);
/** An observed draft is named from a revision of its observation
 *  (`observed.react-initial-<16 hex>`), and the observation carries raster
 *  digests that differ between platforms (measured: Linux and macOS name the
 *  same Switch draft differently; nothing else in the plan differs). The name
 *  is an identity label, so each such suffix is replaced wherever it appears
 *  (contract id, set name, variable paths) by its order of first appearance. */
const OBSERVED_ID = /observed\.[a-z][a-z-]*?-([a-f0-9]{16})\b/g;

/** A plan with every run-derived value removed, as canonical JSON. */
export function normalizePlan(plan: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).filter(([k]) => !RUN_DERIVED.has(k)).map(([k, x]) => [k, walk(x)]));
    return typeof v === 'string' ? v.replace(UUID, '<id>') : v;
  };
  let json = canonicalJson(walk(plan));
  const suffixes = [...new Set([...json.matchAll(OBSERVED_ID)].map(m => m[1]))];
  suffixes.forEach((suffix, i) => { json = json.split(suffix).join(`<observed-${i}>`); });
  return json;
}
export const planHash = (plan: unknown) => createHash('sha256').update(normalizePlan(plan)).digest('hex');

export interface ReplayedCase {
  caseId: string;
  refusal?: string;
  root?: { kind: string; planSha256: string };
  children: Array<{ instanceId: string; exportName: string; refusal?: string; planSha256?: string }>;
  /** state-API cases: the same request repeated after another root joined the
   *  reference. It must return the operation already prepared (criterion 6). */
  repeat?: { status: number; newOperations: number; refusal?: string };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const safeName = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '_');

export async function replayReactNative(options: { workspace: string; cases: string[]; children?: boolean; keep?: string;
  /** Also write every hashed plan, normalized, to <plans>/<case>/<root|instance>.json — the bytes a
   *  platform or run difference can be read from field by field. */
  plans?: string }) {
  const tmp = options.keep ?? mkdtempSync(path.join(tmpdir(), 'react-native-replay-'));
  const hashed = (caseId: string, name: string, planJson: unknown) => {
    if (options.plans) {
      const dir = path.join(options.plans, safeName(caseId));
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, safeName(name) + '.json'), normalizePlan(planJson) + '\n');
    }
    return planHash(planJson);
  };
  if (!existsSync(path.join(tmp, 'private'))) {
    for (const entry of readdirSync(repoRoot)) {
      if (entry === 'private' || entry === '.git') continue;
      symlinkSync(path.join(repoRoot, entry), path.join(tmp, entry));
    }
    mkdirSync(path.join(tmp, 'private'));
  }
  const saved = process.env.DS_CONTRACTS_REACT_SOURCE_ROOT;
  process.env.DS_CONTRACTS_REACT_SOURCE_ROOT = realpathSync(options.workspace);
  const { createReferenceService } = await import('../source-reference/service.js');
  const service = createReferenceService(tmp);
  const server = createServer((req, res) => { void service.handle(req, res); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/source-reference/`;
  // node:http, not fetch: fetch's 300 s headers timeout cut off long native
  // preparations on CI ("fetch failed"); the service owns its own refusals.
  const call = (method: 'GET' | 'POST', route: string) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = request(base + route, { method }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body: any; try { body = JSON.parse(text); } catch { body = { error: text }; }
        resolve({ status: res.statusCode ?? 0, body });
      });
      res.on('error', reject);
    });
    req.on('error', error => reject(Error(`react-native-replay-request-failed: ${method} ${route}: ${error.message}`)));
    req.end();
  });
  const ops = () => {
    const dir = path.join(tmp, 'private', 'source-native-app', 'operations');
    return existsSync(dir) ? readdirSync(dir).map(id => ({ id, dir: path.join(dir, id) })) : [];
  };
  const plan = (dir: string) => JSON.parse(readFileSync(path.join(dir, 'plan.json'), 'utf8')).plan;
  try {
    const loaded = await call('POST', 'react');
    if (loaded.status !== 200 || !loaded.body.id) throw Error('react-native-replay-reference-refused: ' + JSON.stringify(loaded.body).slice(0, 400));
    const R = loaded.body.id as string;
    await call('POST', `react/${R}/ownership`);
    let ownership: any;
    for (let i = 0; i < 360; i++) {
      ownership = (await call('GET', `react/${R}/ownership`)).body;
      if (ownership?.state !== 'running') break;
      await sleep(1000);
    }
    if (ownership?.state !== 'complete') throw Error('react-native-replay-ownership-' + (ownership?.state ?? 'unavailable') + ': ' + JSON.stringify(ownership?.problems ?? ownership?.error ?? '').slice(0, 400));
    const results: ReplayedCase[] = [];
    const settle = async (route: string) => {
      const started = await call('POST', route);
      if (started.status !== 200 || started.body?.error) return { phase: 'refused', problems: [started.body?.reason ?? started.body?.error ?? String(started.status)] };
      for (let i = 0; i < 900; i++) {
        const got = (await call('GET', route)).body?.inspection;
        if (got && got.phase !== 'running') return got;
        await sleep(1000);
      }
      return { phase: 'timed-out', problems: [] };
    };
    // Inspections anchor on a saved root operation of the same reference, so
    // plain root cases are prepared before any state-API case.
    const ordered = [...options.cases.filter(c => !c.startsWith('state-api:')), ...options.cases.filter(c => c.startsWith('state-api:'))];
    for (const entry of ordered) {
      // `state-api:<case>` runs the stateful path the app's pages use for a
      // controlled component: initial states → callback behaviour → state API
      // → native state-API draft. A plain case id prepares its root draft.
      const stateApi = entry.startsWith('state-api:'), caseId = stateApi ? entry.slice('state-api:'.length) : entry;
      if (stateApi) {
        if (!ops().some(o => JSON.parse(readFileSync(path.join(o.dir, 'operation.json'), 'utf8')).request?.kind === 'react-root-draft')) {
          results.push({ caseId: entry, refusal: 'react-native-replay-no-root-anchor: prepare a root case of this reference in the same replay', children: [] });
          continue;
        }
        const steps: string[] = [];
        for (const step of ['initial-states', 'callback-behavior', 'state-api']) {
          const got = await settle(`react/${R}/${step}/${caseId}`);
          steps.push(`${step}:${got?.phase ?? 'unavailable'}${got?.problems?.length ? '(' + got.problems.join(',') + ')' : ''}`);
        }
        const before = new Set(ops().map(o => o.id));
        const prepared = await call('POST', `react/${R}/native-state-api/${caseId}`);
        const created = ops().filter(o => !before.has(o.id));
        if (prepared.status !== 200 || created.length !== 1) {
          results.push({ caseId: entry, refusal: `${prepared.body?.reason ?? prepared.body?.error ?? 'created ' + created.length} after ${steps.join(' → ')}`, children: [] });
          continue;
        }
        const out: ReplayedCase = { caseId: entry, root: { kind: plan(created[0].dir).kind, planSha256: hashed(entry, 'root', plan(created[0].dir)) }, children: [] };
        // Another root joins the reference (this case's own), which can move the
        // sorted inspection anchors; the repeated request must still resolve the
        // sealed state-API record and return the prepared operation.
        await call('POST', `react/${R}/native/${caseId}`);
        const settled = new Set(ops().map(o => o.id));
        const again = await call('POST', `react/${R}/native-state-api/${caseId}`);
        out.repeat = { status: again.status, newOperations: ops().filter(o => !settled.has(o.id)).length,
          ...(again.status !== 200 ? { refusal: String(again.body?.reason ?? again.body?.error ?? again.status) } : {}) };
        results.push(out);
        continue;
      }
      const before = new Set(ops().map(o => o.id));
      const prepared = await call('POST', `react/${R}/native/${caseId}`);
      const created = ops().filter(o => !before.has(o.id));
      if (prepared.status !== 200 || created.length !== 1) {
        results.push({ caseId, refusal: prepared.body?.reason ?? prepared.body?.error ?? `created ${created.length} operation(s)`, children: [] });
        continue;
      }
      const root = created[0], rootPlan = plan(root.dir), out: ReplayedCase = { caseId, root: { kind: rootPlan.kind, planSha256: hashed(caseId, 'root', rootPlan) }, children: [] };
      if (options.children) {
        await call('POST', `react/${R}/native-operation/${root.id}/content`);
        let composition: any;
        for (let i = 0; i < 360; i++) {
          const listing = (await call('GET', `react/${R}/native`)).body;
          const row = listing?.operations?.find((r: any) => r.operation.id === root.id);
          if (row?.composition || row?.compositionProblem) { composition = row.composition ?? { problem: row.compositionProblem }; break; }
          await sleep(1000);
        }
        for (const child of composition?.rows ?? []) {
          const had = new Set(ops().map(o => o.id));
          const made = await call('POST', `react/${R}/native-operation/${root.id}/child/${child.instanceId}`);
          const fresh = ops().filter(o => !had.has(o.id));
          out.children.push(made.status === 200 && fresh.length === 1
            ? { instanceId: child.instanceId, exportName: child.exportName, planSha256: hashed(caseId, child.instanceId, plan(fresh[0].dir)) }
            : { instanceId: child.instanceId, exportName: child.exportName, refusal: made.body?.reason ?? made.body?.error ?? `created ${fresh.length}` });
        }
        if (composition?.problem) out.refusal = 'composition: ' + JSON.stringify(composition.problem).slice(0, 300);
      }
      results.push(out);
    }
    return { referenceId: R, cases: results };
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    (service as { close?: () => void }).close?.();
    if (saved === undefined) delete process.env.DS_CONTRACTS_REACT_SOURCE_ROOT; else process.env.DS_CONTRACTS_REACT_SOURCE_ROOT = saved;
    if (!options.keep) rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--workspace'), workspace = i > -1 ? process.argv[i + 1] : path.join(repoRoot, 'benchmark', 'react-family');
  const c = process.argv.indexOf('--cases'), cases = c > -1 ? process.argv[c + 1].split(',') : ['alert-default', 'alert-destructive'];
  const k = process.argv.indexOf('--keep'), keep = k > -1 ? process.argv[k + 1] : undefined;
  replayReactNative({ workspace, cases, children: process.argv.includes('--children'), keep })
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
