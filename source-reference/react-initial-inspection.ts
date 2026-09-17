import {evidenceReadOnce} from './evidence-read-snapshot.js';
/** Targeted initial-state observation against an existing sealed ownership
 * archive. No native writes, arbitrary source paths, or matrix recapture. */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { revisionOf } from '../core/contract-provenance.js';
import { reactReferenceHtml, reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { readReactNativeEvidence } from './react-native-evidence.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { reactSourceProgramUnchanged, type ReactSourceProgram } from './react-source-program.js';
import { buildReactOwnershipReference, reactOwnershipHook, reactOwnershipRead, type ReactOwnership } from './react-ownership.js';
import { reactReferenceProfile } from './react-reference-profiles.js';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { observeReactInitialStates } from './react-initial-state.js';
import { evidenceSha, inventoryEvidence, evidenceUnchanged } from './react-validation-evidence.js';
import { cropSourceFrame, type SourceFrame } from './source-framing.js';
import { prepareObservedContentTree } from './observed-content.js';
import { compileReactInitialContract } from './react-initial-contract.js';
import { isReactInitialNativeRequest, type ReactInitialNativeRequest } from './react-initial-native-request.js';

type Request = { version: 1; anchor: ReactNativeRequest; caseId: string };
export interface ReactInitialInspection {
  id: string; caseId: string; phase: 'running' | 'complete' | 'failed'; sourceUnchanged: boolean;
  observation?: Awaited<ReturnType<typeof observeReactInitialStates>>; problems: string[];
  draft?: ReturnType<typeof compileReactInitialContract>;
}
export function readReactInspectionOriginal(repo: string, reference: ReactReference, request: Request) {
  reactReferenceProfile(request.caseId);
  readReactNativeEvidence(repo, reference, request.anchor);
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, request.anchor.ownership.id);
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const row = report.rows.find(r => r.id === request.caseId);
  const captured = JSON.parse(readFileSync(path.join(dir, request.caseId, 'source-tree.json'), 'utf8'));
  if (!row?.matched || row.problems.length || !row.ownership || captured.status !== 'captured' ||
      captured.treeSha256 !== row.treeSha256 || captured.sourcePngSha256 !== row.sourceImage ||
      evidenceSha(JSON.stringify(captured.tree)) !== captured.treeSha256) throw Error('react-initial-original-unavailable');
  const programBytes = readFileSync(path.join(dir, 'program.json'));
  return { captured, ownership: row.ownership, program: JSON.parse(programBytes.toString()) as ReactSourceProgram,
    programSha256: evidenceSha(programBytes) };
}
export function createReactInitialInspectionStore(repo: string, sourceRoot: string,
  select: (referenceId: string, caseId: string) => { reference: ReactReference; anchor: ReactNativeRequest; anchors?: ReactNativeRequest[] }) {
  const active = new Map<string, { state: ReactInitialInspection; promise: Promise<void> }>();
  const from = (reference: ReactReference, request: Request) => {
    const source = readReactInspectionOriginal(repo, reference, request), key = revisionOf(request).slice(7);
    return { reference, request, source, key, root: path.join(repo, 'private/react-initial-inspections', key) };
  };
  const input = (referenceId: string, caseId: string) => {
    const selected = select(referenceId, caseId), { reference } = selected;
    // A different root in the same sealed cohort may become the selected
    // anchor after a compiler change. Reopen its existing initial observation
    // without recapturing or rewriting it. Only host-verified root requests
    // with the exact same source archive are eligible; from/saved still verify
    // the full request, current files and immutable evidence inventory.
    const candidates = [selected.anchor, ...(selected.anchors ?? []).filter(anchor =>
      anchor.referenceId === selected.anchor.referenceId &&
      anchor.inventorySha256 === selected.anchor.inventorySha256 &&
      revisionOf(anchor.ownership) === revisionOf(selected.anchor.ownership))];
    const anchor = candidates.find(anchor => existsSync(path.join(repo, 'private/react-initial-inspections',
      revisionOf({ version: 1, anchor, caseId }).slice(7), 'latest.json'))) ?? selected.anchor;
    return from(reference, { version: 1, anchor, caseId });
  };
  const saved = (value: ReturnType<typeof input>, pinned?: ReactInitialNativeRequest['observation']) => {
    const pointer = path.join(value.root, 'latest.json');
    if (!pinned && !existsSync(pointer)) return undefined;
    const latest = pinned ?? JSON.parse(readFileSync(pointer, 'utf8'));
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(latest.id)) throw Error('react-initial-record-invalid');
    const dir = path.join(value.root, latest.id), sealBytes = readFileSync(path.join(dir, 'integrity.json'));
    if (evidenceSha(sealBytes) !== latest.inventorySha256) throw Error('react-initial-inventory-changed');
    const seal = JSON.parse(sealBytes.toString());
    const inventory = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': latest.inventorySha256 }).sort(([a], [b]) => a.localeCompare(b))) as Record<string,string>;
    if (seal.version !== 1 || !evidenceUnchanged(dir, inventory) ||
        revisionOf(JSON.parse(readFileSync(path.join(dir, 'request.json'), 'utf8'))) !== revisionOf(value.request)) throw Error('react-initial-evidence-changed');
    const reportBytes = readFileSync(path.join(dir, 'report.json'));
    if (pinned && evidenceSha(reportBytes) !== pinned.reportSha256) throw Error('react-initial-report-changed');
    const report = JSON.parse(reportBytes.toString()) as ReactInitialInspection;
    if (report.id !== latest.id || report.caseId !== value.request.caseId || report.phase === 'running') throw Error('react-initial-report-invalid');
    return { dir, report, pin: { id: latest.id as string, inventorySha256: latest.inventorySha256 as string, reportSha256: evidenceSha(reportBytes) } };
  };
  const derive = (value: ReturnType<typeof input>, record: NonNullable<ReturnType<typeof saved>>) => {
    const report = structuredClone(record.report);
    if (report.phase === 'complete' && report.observation) {
      const snapshots = Object.fromEntries(report.observation.rows.map(row => {
        if (!/^\d+$/.test(row.id)) throw Error('react-initial-row-invalid');
        return [row.id, JSON.parse(readFileSync(path.join(record.dir, 'states', row.id + '.json'), 'utf8'))];
      }));
      // Derived from authenticated immutable observations under today's compiler;
      // never overwrite the historical observation or accept a contract here.
      report.draft = compileReactInitialContract(value.source.program, value.source.ownership, value.source.captured.tree,
        report.observation, snapshots);
    }
    return report;
  };
  const read = (referenceId: string, caseId: string) => {
    const value = input(referenceId, caseId), running = active.get(value.key);
    if (running) return structuredClone(running.state);
    const record = saved(value);
    return record ? derive(value, record) : undefined;
  };
  const framedImage = (record: ReturnType<typeof saved>, jobId: string, rowId: string) => {
      const row = record?.report.observation?.rows.find(r => r.id === rowId && r.status === 'observed');
      if (!record || record.report.id !== jobId || !row?.image) throw Error('react-initial-image-unavailable');
      const png = readFileSync(path.join(record.dir, 'states', rowId + '.png'));
      const snapshot = JSON.parse(readFileSync(path.join(record.dir, 'states', rowId + '.json'), 'utf8'));
      if (evidenceSha(png) !== row.image || snapshot.image !== row.image || snapshot.treeSha256 !== row.treeSha256) throw Error('react-initial-image-changed');
      const cropped = cropSourceFrame(png, snapshot.bounds);
      const frame: SourceFrame = { version: 1, sourceSha256: row.image, inputSha256: revisionOf({ pin: record.pin, rowId }).slice(7),
        imageSha256: evidenceSha(cropped.bytes), bounds: snapshot.bounds, crop: cropped.crop, sourceSize: cropped.sourceSize, qualification: 'unqualified' };
      return { bytes: cropped.bytes, frame };
  };
  const nativeEvidenceFresh=(reference: ReactReference, request: ReactInitialNativeRequest) => {
      if (!isReactInitialNativeRequest(request) || reference.id !== request.anchor.referenceId)
        throw Error('react-initial-native-request-invalid');
      // Resolve the pinned archive directly, never via the latest pointer or
      // the journal's list/get path (which calls this evidence reader itself).
      const value = from(reference, { version: 1, anchor: request.anchor, caseId: request.caseId });
      const record = saved(value, request.observation)!;
      const report = derive(value, record);
      if (report.phase !== 'complete' || !report.sourceUnchanged || report.problems.length || report.draft?.status !== 'compiled-draft')
        throw Error('react-initial-native-observation-unavailable');
      const trees = Object.fromEntries(report.draft.nativeVariants.map(variant => {
        const snapshot = JSON.parse(readFileSync(path.join(record.dir, 'states', variant.observation + '.json'), 'utf8'));
        return [variant.variant, prepareObservedContentTree(snapshot.tree, snapshot.fonts, snapshot.svg)];
      }));
      const frames = Object.fromEntries(report.draft.nativeVariants.map(variant =>
        [variant.observation, framedImage(record, record.report.id, variant.observation).frame]));
      return { draft: report.draft, frames, composition: { source: report.observation!.source,
        heldProps: report.observation!.heldProps, trees }, source: { revision: 'sha256:' + reference.id,
        programSha256: value.source.programSha256, evidenceRevision: revisionOf(request) } };
  };
  return {
    read,
    nativeRequest(referenceId: string, caseId: string): ReactInitialNativeRequest {
      const value = input(referenceId, caseId), record = saved(value);
      if (!record || active.has(value.key) || derive(value, record).draft?.status !== 'compiled-draft')
        throw Error('react-initial-native-observation-unavailable');
      return { version: 1, kind: 'react-initial-draft', anchor: value.request.anchor, caseId, observation: record.pin };
    },
    nativeEvidence(reference:ReactReference,request:ReactInitialNativeRequest) {
      return evidenceReadOnce('react-initial',{repo,referenceId:reference.id,files:reference.files,request},
        ()=>nativeEvidenceFresh(reference,request));
    },
    nativeImage(reference: ReactReference, request: ReactInitialNativeRequest, rowId: string) {
      if (!isReactInitialNativeRequest(request) || reference.id !== request.anchor.referenceId || !/^\d+$/.test(rowId))
        throw Error('react-initial-native-image-invalid');
      const value = from(reference, { version: 1, anchor: request.anchor, caseId: request.caseId });
      return framedImage(saved(value, request.observation), request.observation.id, rowId).bytes;
    },
    image(referenceId: string, caseId: string, jobId: string, rowId: string) {
      if (!/^\d+$/.test(rowId)) throw Error('react-initial-row-invalid');
      return framedImage(saved(input(referenceId, caseId)), jobId, rowId).bytes;
    },
    start(referenceId: string, caseId: string) {
      const value = input(referenceId, caseId), existing = active.get(value.key);
      if (existing) return existing;
      const prior = saved(value);
      if (prior?.report.phase === 'complete') return { state: prior.report, promise: Promise.resolve() };
      const state: ReactInitialInspection = { id: randomUUID(), caseId, phase: 'running', sourceUnchanged: false, problems: [] };
      const dir = path.join(value.root, state.id); mkdirSync(dir, { recursive: true });
      const save = (file: string, data: unknown) => writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
      save('request.json', value.request);
      const promise = (async () => {
        let browser;
        try {
          const observed = await buildReactOwnershipReference(sourceRoot, value.reference, value.source.program);
          browser = await chromium.launch();
          const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
          await context.addInitScript(reactOwnershipHook);
          const url = 'http://127.0.0.1/react-ownership?case=' + caseId;
          await context.route('**/*', r => r.request().url() === url ? r.fulfill({ status: 200, contentType: 'text/html',
            headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'" }, body: reactReferenceHtml(observed),
          }) : r.abort());
          const page = await context.newPage(), failures = watchSourceFailures(page), profile = reactReferenceProfile(caseId);
          try {
            await page.goto(url); await page.locator(profile.path[0]).waitFor({ state: 'attached', timeout: 15000 });
            const captured = await captureValidatedTree(page, profile, failures, '#root', '--');
            if (captured.status !== 'captured' || captured.treeSha256 !== value.source.captured.treeSha256 || captured.sourcePngSha256 !== value.source.captured.sourcePngSha256)
              throw Error('react-initial-original-render-changed');
            const ownership = await page.evaluate(reactOwnershipRead(profile.path[0])) as ReactOwnership;
            if (revisionOf(ownership) !== revisionOf(value.source.ownership)) throw Error('react-initial-original-ownership-changed');
            const targets = ownership.components.filter(c => c.roots.includes(''));
            if (targets.length !== 1) throw Error('react-initial-root-ambiguous');
            state.observation = await observeReactInitialStates({ page, program: value.source.program, ownership, tree: captured.tree, image: captured.sourcePngSha256,
              instanceId: targets[0].id, selector: profile.path[0], dir: path.join(dir, 'states'), failures,
              assertCurrent: () => {
                if (!reactReferenceUnchanged(value.reference) || !reactSourceProgramUnchanged(value.source.program)) throw Error('react-initial-source-changed');
              } });
            if (!state.observation.planned || state.observation.problems.length || state.observation.rows.some(r => r.status !== 'observed' || !r.restored))
              throw Error('react-initial-observation-incomplete');
            readReactInspectionOriginal(repo, value.reference, value.request);
            state.sourceUnchanged = true; state.phase = 'complete';
          } finally { failures.dispose(); }
        } catch (e) { state.phase = 'failed'; state.problems = [e instanceof Error ? e.message : String(e)]; }
        finally {
          try {
            await browser?.close(); save('report.json', state);
            save('integrity.json', { version: 1, files: inventoryEvidence(dir) });
            writeFileSync(path.join(value.root, 'latest.tmp'), JSON.stringify({ id: state.id, inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))) }));
            renameSync(path.join(value.root, 'latest.tmp'), path.join(value.root, 'latest.json'));
          } finally { active.delete(value.key); }
        }
      })();
      const job = { state, promise }; active.set(value.key, job); return job;
    },
  };
}
