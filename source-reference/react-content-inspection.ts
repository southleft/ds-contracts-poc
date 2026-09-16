/** Targeted source read for the next native comparison. Reuses sealed ownership
 * evidence; never reruns its property matrix or edits the original library. */
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { revisionOf } from '../core/contract-provenance.js';
import { reactReferenceHtml, reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { reactReferenceProfile } from './react-reference-profiles.js';
import { readReactNativeContentEvidence, readReactNativeEvidence } from './react-native-evidence.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { observeTextFonts } from './text-fonts.js';
import { observeSvgViewports } from './svg-viewports.js';
import { observeGridConstraints, verifiedGridConstraints, type GridConstraintEvidence } from './grid-constraints.js';
import { compileObservedContent, type ObservedContentDraft } from './observed-content.js';
import { evidenceSha, evidenceUnchanged, inventoryEvidence } from './react-validation-evidence.js';

export interface ReactContentInspection {
  id: string;
  operationId: string;
  referenceId: string;
  caseId: string;
  phase: 'running' | 'complete' | 'failed';
  sourceUnchanged: boolean;
  content?: ObservedContentDraft;
  fontFamilies?: string[];
  gridConstraints?: GridConstraintEvidence;
  problems: string[];
}
export function startReactContentInspection(repoRoot: string, reference: ReactReference, request: ReactNativeRequest, operationId: string) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(operationId)) throw Error('react-content-operation-invalid');
  const original = readReactNativeContentEvidence(repoRoot, reference, request);
  const id = randomUUID(), dir = path.join(repoRoot, 'private/react-content-inspections', operationId, id);
  mkdirSync(dir, { recursive: true });
  const state: ReactContentInspection = { id, operationId, referenceId: reference.id, caseId: request.caseId, phase: 'running', sourceUnchanged: false, problems: [] };
  let persisted = false;
  const save = (name: string, value: unknown) => writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  save('request.json', { operationId, request, originalTreeRevision: revisionOf(original.captured.tree) });
  const promise = (async () => {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch();
      const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
      const url = 'http://127.0.0.1/react-ownership?case=' + request.caseId;
      await context.route('**/*', route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html',
        headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'" },
        body: reactReferenceHtml(reference),
      }) : route.abort());
      const page = await context.newPage(), failures = watchSourceFailures(page), profile = reactReferenceProfile(request.caseId);
      try {
        await page.goto(url);
        await page.locator(profile.path[0]).waitFor({ timeout: 15000 });
        const captured = await captureValidatedTree(page, profile, failures, '#root', '--');
        save('source-tree.json', captured);
        if (captured.status !== 'captured' || captured.treeSha256 !== original.captured.treeSha256 ||
            captured.sourcePngSha256 !== original.captured.sourcePngSha256)
          throw Error('react-content-original-render-changed');
        const fonts = await observeTextFonts(page, profile.path, captured.tree);
        save('text-fonts.json', fonts);
        const svg = await observeSvgViewports(page, profile.path, captured.tree);
        save('svg-viewports.json', svg);
        const grids = await observeGridConstraints(page, profile.path, captured.tree);
        save('grid-constraints.json', grids);
        const repeat = await captureValidatedTree(page, profile, failures, '#root', '--');
        if (repeat.status !== 'captured' || repeat.treeSha256 !== captured.treeSha256 || repeat.sourcePngSha256 !== captured.sourcePngSha256)
          throw Error('react-content-source-changed-during-read');
        readReactNativeEvidence(repoRoot, reference, request);
        if (!reactReferenceUnchanged(reference)) throw Error('react-content-source-files-changed');
        state.content = compileObservedContent(captured.tree, fonts, svg);
        state.fontFamilies = [...new Set(fonts.rows.flatMap(row => row.fonts.map(font => font.familyName)))].sort();
        state.gridConstraints = grids;
        state.sourceUnchanged = true;
        state.phase = 'complete';
      } finally { failures.dispose(); }
    } catch (error) {
      state.phase = 'failed'; state.problems = [error instanceof Error ? error.message : 'react-content-inspection-failed'];
    } finally {
      await browser?.close();
      save('report.json', state);
      save('integrity.json', { version: 1, files: inventoryEvidence(dir) });
      const latest = path.join(dir, '..', 'latest.json');
      writeFileSync(latest + '.tmp', JSON.stringify({ id, requestRevision: revisionOf(request), inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))) }));
      renameSync(latest + '.tmp', latest);
      persisted = true;
    }
  })();
  return { state, dir, promise, report: () => {
    if (persisted) {
      try {
        const saved = readReactContentInspection(repoRoot, reference, request, operationId);
        if (!saved || saved.id !== id) throw Error('react-content-selection-changed');
        return saved;
      } catch { return { ...structuredClone(state), phase: 'failed' as const, sourceUnchanged: false, problems: ['react-content-evidence-unavailable'] }; }
    }
    const out = structuredClone(state);
    if (!reactReferenceUnchanged(reference)) { out.sourceUnchanged = false; out.phase = 'failed'; out.problems.push('react-content-source-files-changed'); }
    try { readReactNativeContentEvidence(repoRoot, reference, request); }
    catch { out.sourceUnchanged = false; out.phase = 'failed'; out.problems.push('react-content-original-evidence-unavailable'); }
    return out;
  } };
}

/** Saved read-only preparation survives a server restart. It grants no native
 * write permission; a writer must rederive the current compiler output. */
export function readReactContentInspection(repoRoot: string, reference: ReactReference, request: ReactNativeRequest, operationId: string, selected?: { id: string; inventorySha256: string }): ReactContentInspection | undefined {
  return readReactContentInspectionEvidence(repoRoot, reference, request, operationId, selected)?.report;
}

/** Return the original that was authenticated with this saved inspection.
 * Callers needing both must not reopen the whole archive just to discard a
 * second copy. This is a fresh read on every call, never a freshness cache. */
export function readReactContentInspectionEvidence(repoRoot: string, reference: ReactReference, request: ReactNativeRequest, operationId: string, selected?: { id: string; inventorySha256: string }) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(operationId)) throw Error('react-content-operation-invalid');
  const root = path.join(repoRoot, 'private/react-content-inspections', operationId), latestPath = path.join(root, 'latest.json');
  if (!selected && !existsSync(latestPath)) return undefined;
  const latest = selected ? { ...selected, requestRevision: revisionOf(request) } : JSON.parse(readFileSync(latestPath, 'utf8'));
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(latest.id) || latest.requestRevision !== revisionOf(request))
    throw Error('react-content-saved-request-changed');
  const original = readReactNativeContentEvidence(repoRoot, reference, request);
  const dir = path.join(root, latest.id), sealBytes = readFileSync(path.join(dir, 'integrity.json'));
  if (evidenceSha(sealBytes) !== latest.inventorySha256) throw Error('react-content-inventory-changed');
  const seal = JSON.parse(sealBytes.toString());
  if (!seal.files || typeof seal.files !== 'object' || Array.isArray(seal.files) ||
      Object.values(seal.files).some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) throw Error('react-content-inventory-invalid');
  const files = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': latest.inventorySha256 }).sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>;
  if (seal.version !== 1 || !evidenceUnchanged(dir, files)) throw Error('react-content-evidence-changed');
  const savedRequest = JSON.parse(readFileSync(path.join(dir, 'request.json'), 'utf8'));
  if (savedRequest.operationId !== operationId || revisionOf(savedRequest.request) !== revisionOf(request)) throw Error('react-content-saved-request-changed');
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactContentInspection;
  if (report.id !== latest.id || report.operationId !== operationId || report.referenceId !== reference.id || report.caseId !== request.caseId || report.phase === 'running')
    throw Error('react-content-report-identity-changed');
  // Historical inspections have no grid witness. Never enrich their reports
  // from a new inspection or a mutable latest pointer.
  if (report.gridConstraints) {
    const grids = JSON.parse(readFileSync(path.join(dir, 'grid-constraints.json'), 'utf8')) as GridConstraintEvidence;
    if (revisionOf(grids) !== revisionOf(report.gridConstraints)) throw Error('react-content-grid-report-changed');
    if (grids.status === 'observed') verifiedGridConstraints(original.captured.tree, grids);
  }
  return { report, original, selection: { id: latest.id as string, inventorySha256: latest.inventorySha256 as string } };
}
