import type { ReactStateApiNativePin } from './react-state-api-native-request.js';
import type { ReactBehaviorContract } from './react-behavior-contract.js';
import { projectReactStateApiContract } from './react-state-api-contract.js';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { revisionOf } from '../core/contract-provenance.js';
import { buildReactOwnershipReference, reactOwnershipHook, reactOwnershipRead } from './react-ownership.js';
import { reactReferenceHtml, reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { readReactInspectionOriginal, reactInspectionRequest, type ReactInitialInspection, type ReactInspectionRequest } from './react-initial-inspection.js';
import type { ReactCallbackInspection } from './react-callback-inspection.js';
import { planReactStateApi, observeReactStateApi, validateReactStateApiObservation, type ReactStateApiPlan, type ReactStateApiObservation } from './react-state-api.js';
import { readReactSourceProgram, reactSourceProgramUnchanged } from './react-source-program.js';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { evidenceSha, evidenceUnchanged, inventoryEvidence } from './react-validation-evidence.js';

export interface ReactStateApiInspection {
  id: string;
  caseId: string;
  phase: 'running' | 'complete' | 'failed';
  qualification: 'bounded-checked-state-api-only';
  plan: ReactStateApiPlan;
  sourceUnchanged: boolean;
  restorationChecks: number;
  observation?: ReactStateApiObservation;
  problems: string[];
  draft?: ReactBehaviorContract;
}

const observerFiles = [
  'react-state-api.ts', 'react-state-api-inspection.ts', 'react-property-probe.ts', 'react-ownership.ts',
  'react-source-program.ts', 'react-reference.ts', 'react-initial-inspection.ts', 'react-callback-inspection.ts',
  'control-behavior.ts', 'capture.ts', 'observe.ts', 'react-validation-evidence.ts',
];
function observerRevision(repo: string) {
  return revisionOf(Object.fromEntries(observerFiles.map(file =>
    [file, evidenceSha(readFileSync(path.join(repo, 'source-reference', file)))])));
}
export interface ReactStateApiRequest {
  version: 1;
  source: ReactInspectionRequest;
  initialRevision: string;
  callbackRevision: string;
  observerRevision: string;
  plan: ReactStateApiPlan;
}

export function readReactStateApiInspection(root: string, request: ReactStateApiRequest): ReactStateApiInspection | undefined {
  const pointer = path.join(root, 'latest.json');
  if (!existsSync(pointer)) return;
  const latest = JSON.parse(readFileSync(pointer, 'utf8')) as { id: string; inventorySha256: string };
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(latest.id)) throw Error('state-api-record-invalid');
  const dir = path.join(root, latest.id), sealBytes = readFileSync(path.join(dir, 'integrity.json'));
  if (evidenceSha(sealBytes) !== latest.inventorySha256) throw Error('state-api-inventory-changed');
  const seal = JSON.parse(sealBytes.toString()) as { version: number; files: Record<string, string> };
  if (seal.version !== 1 || !evidenceUnchanged(dir, Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': latest.inventorySha256 }).sort(([a], [b]) => a.localeCompare(b)))) ||
      revisionOf(JSON.parse(readFileSync(path.join(dir, 'request.json'), 'utf8'))) !== revisionOf(request))
    throw Error('state-api-evidence-changed');
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactStateApiInspection;
  if (report.id !== latest.id || report.caseId !== request.plan.caseId || !['complete', 'failed'].includes(report.phase) ||
      report.qualification !== 'bounded-checked-state-api-only' || revisionOf(report.plan) !== revisionOf(request.plan) ||
      (report.observation && revisionOf(report.observation.plan) !== revisionOf(request.plan)) ||
      (report.phase === 'complete' && (!report.sourceUnchanged || report.problems.length || !report.observation ||
        report.observation.problems.length || report.observation.rows.length !== request.plan.cases.length * 2 ||
        report.restorationChecks !== request.plan.cases.length * 3))) throw Error('state-api-report-invalid');
  if (report.phase === 'complete') validateReactStateApiObservation(report.observation!, request.plan);
  const initial = JSON.parse(readFileSync(path.join(dir, 'initial-input.json'), 'utf8'));
  const behavior = JSON.parse(readFileSync(path.join(dir, 'callback-input.json'), 'utf8'));
  if (revisionOf(initial) !== request.initialRevision || revisionOf(behavior) !== request.callbackRevision ||
      revisionOf(planReactStateApi(initial, behavior)) !== revisionOf(request.plan)) throw Error('state-api-input-records-changed');
  const program = JSON.parse(readFileSync(path.join(dir, 'program.json'), 'utf8'));
  if (!reactSourceProgramUnchanged(program)) throw Error('state-api-program-changed');
  return report;
}

export function readReactStateApiNativeRecord(root:string,request:ReactStateApiRequest) {
  const report=readReactStateApiInspection(root,request);
  if(report?.phase!=='complete')throw Error('state-api-native-observation-required');
  const latest=JSON.parse(readFileSync(path.join(root,'latest.json'),'utf8'));
  const pin:ReactStateApiNativePin={key:revisionOf(request).slice(7),id:report.id,inventorySha256:latest.inventorySha256,
    reportSha256:evidenceSha(readFileSync(path.join(root,report.id,'report.json')))};
  const initial=JSON.parse(readFileSync(path.join(root,report.id,'initial-input.json'),'utf8')) as ReactInitialInspection;
  const draft=projectReactStateApiContract(initial,report);
  if(draft.status!=='generated-draft')throw Error('state-api-native-projection-refused');
  return {pin,draft,initialObservation:report.plan.initialObservation,initialDraftRevision:revisionOf(initial.draft)};
}

/** This writes a separate immutable experiment. It never changes the earlier
 * callback/initial records or a Figma operation, and a repeated completed
 * request reuses its sealed result without running another experiment. */
export function createReactStateApiInspectionStore(
  repo: string,
  sourceRoot: string,
  select: (referenceId: string, caseId: string) => { reference: ReactReference; anchor: ReactNativeRequest },
  records: (referenceId: string, caseId: string) => { initial?: ReactInitialInspection; behavior?: ReactCallbackInspection },
) {
  const active = new Map<string, { state: ReactStateApiInspection; promise: Promise<void> }>();
  const input = (referenceId: string, caseId: string) => {
    const { reference, anchor } = select(referenceId, caseId), saved = records(referenceId, caseId);
    if (!saved.initial || !saved.behavior) throw Error('state-api-observations-unavailable');
    const sourceRequest = reactInspectionRequest(anchor, caseId);
    const source = readReactInspectionOriginal(repo, reference, sourceRequest);
    const plan = planReactStateApi(saved.initial, saved.behavior);
    const request: ReactStateApiRequest = { version: 1, source: sourceRequest,
      initialRevision: revisionOf(saved.initial), callbackRevision: revisionOf(saved.behavior),
      observerRevision: observerRevision(repo), plan };
    const key = revisionOf(request).slice(7), root = path.join(repo, 'private/react-state-api-inspections', key);
    return { reference, source, saved, request, key, root };
  };
  const nativeRecord = (referenceId: string, caseId: string) => {
    const value=input(referenceId,caseId);
    if(active.has(value.key))throw Error('state-api-native-observation-running');
    return readReactStateApiNativeRecord(value.root,value.request);
  };
  return {
    nativePin(referenceId: string, caseId: string) { return nativeRecord(referenceId,caseId).pin; },
    nativeEvidence(referenceId: string, caseId: string, pin:ReactStateApiNativePin) {
      const current=nativeRecord(referenceId,caseId);
      if(revisionOf(current.pin)!==revisionOf(pin))throw Error('state-api-native-observation-changed');
      return current;
    },
    read(referenceId: string, caseId: string) {
      const value = input(referenceId, caseId);
      const report = structuredClone(active.get(value.key)?.state ?? readReactStateApiInspection(value.root, value.request) ?? null);
      if (report?.phase === 'complete') report.draft = projectReactStateApiContract(value.saved.initial!, report);
      return report;
    },
    start(referenceId: string, caseId: string) {
      const value = input(referenceId, caseId), running = active.get(value.key);
      if (running) return running;
      const prior = readReactStateApiInspection(value.root, value.request);
      if (prior?.phase === 'complete') return { state: { ...prior, draft: projectReactStateApiContract(value.saved.initial!, prior) }, promise: Promise.resolve() };
      const program = readReactSourceProgram(sourceRoot, [...new Set(value.source.program.components.map(c => c.module))]);
      const identities = (p: typeof program) => p.components.map(c =>
        ({ module: c.module, exportName: c.exportName, sourceSha256: c.sourceSha256, span: c.span }));
      if (program.problems.length || revisionOf(program.files) !== revisionOf(value.source.program.files) ||
          revisionOf(identities(program)) !== revisionOf(identities(value.source.program)))
        throw Error('state-api-installed-source-program-changed');
      const state: ReactStateApiInspection = { id: randomUUID(), caseId, phase: 'running', qualification: 'bounded-checked-state-api-only',
        plan: structuredClone(value.request.plan), sourceUnchanged: false, restorationChecks: 0, problems: [] };
      const dir = path.join(value.root, state.id); mkdirSync(dir, { recursive: true });
      const save = (file: string, data: unknown) => writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
      save('request.json', value.request); save('program.json', program);
      save('initial-input.json', value.saved.initial); save('callback-input.json', value.saved.behavior);
      const promise = (async () => {
        let browser;
        try {
          const assertCurrent = () => {
            if (!reactReferenceUnchanged(value.reference) || !reactSourceProgramUnchanged(program) ||
                observerRevision(repo) !== value.request.observerRevision)
              throw Error('state-api-source-or-observer-changed');
          };
          assertCurrent();
          const observed = await buildReactOwnershipReference(sourceRoot, value.reference, program);
          browser = await chromium.launch();
          const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
          await context.addInitScript(reactOwnershipHook);
          const url = 'http://localhost/react-state-api?case=' + caseId;
          await context.route('**/*', route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html',
            headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'" },
            body: reactReferenceHtml(observed) }) : route.abort());
          const page = await context.newPage(), failures = watchSourceFailures(page), profile = value.reference.cohort.profile(caseId);
          let failedRestorations = 0;
          const verifyOriginal = async () => {
            assertCurrent();
            await page.waitForFunction(() => document.getAnimations().every(a => a.playState === 'finished' || a.playState === 'idle'), undefined, { timeout: 5000 });
            const capture = await captureValidatedTree(page, profile, failures, '#root', '--');
            const ownership = await page.evaluate(reactOwnershipRead(profile.path[0]));
            if (capture.status !== 'captured' || capture.treeSha256 !== value.source.captured.treeSha256 ||
                capture.sourcePngSha256 !== value.source.captured.sourcePngSha256 || revisionOf(ownership) !== revisionOf(value.source.ownership)) {
              const name = 'restoration-failure-' + ++failedRestorations;
              save(name + '.json', { capture, ownership, expected: { treeSha256: value.source.captured.treeSha256,
                sourcePngSha256: value.source.captured.sourcePngSha256, ownership: value.source.ownership } });
              writeFileSync(path.join(dir, name + '.png'), await page.screenshot({ fullPage: true, caret: 'initial' }), { flag: 'wx' });
              throw Error('state-api-original-not-restored');
            }
          };
          try {
            await page.goto(url); await verifyOriginal();
            state.observation = await observeReactStateApi({ page, selector: profile.path[0], program, ownership: value.source.ownership,
              plan: state.plan, assertCurrent, assertRestored: async () => {
                // Preserve same-mount proof before replay, then require the
                // original again. Replay never conceals a failed restoration.
                await verifyOriginal(); await page.goto(url); await verifyOriginal(); state.restorationChecks++;
              } });
            await verifyOriginal(); assertCurrent();
            readReactInspectionOriginal(repo, value.reference, value.request.source);
            state.sourceUnchanged = true;
            if (state.observation.problems.length || state.observation.rows.length !== state.plan.cases.length * 2 ||
                state.restorationChecks !== state.plan.cases.length * 3) throw Error('state-api-observation-incomplete');
            state.phase = 'complete';
          } finally { failures.dispose(); }
        } catch (error) {
          state.phase = 'failed'; state.problems.push(error instanceof Error ? error.message : String(error));
        } finally {
          try {
            await browser?.close(); save('report.json', state); save('integrity.json', { version: 1, files: inventoryEvidence(dir) });
            const temporary = path.join(value.root, 'latest-' + state.id + '.tmp');
            writeFileSync(temporary, JSON.stringify({ id: state.id, inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))) }), { flag: 'wx' });
            renameSync(temporary, path.join(value.root, 'latest.json'));
          } finally { active.delete(value.key); }
        }
      })();
      const job = { state, promise }; active.set(value.key, job); return job;
    },
  };
}
