import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { captureValidatedTree } from './capture.js';
import { watchSourceFailures } from './observe.js';
import { buildReactReference, reactReferenceHtml } from './react-reference.js';
import { reactCasesFile } from './react-cohort.js';
import { readReactSourceProgram } from './react-source-program.js';
import { buildReactOwnershipReference, reactOwnershipHook, reactOwnershipRead, type ReactOwnership } from './react-ownership.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { selectReactNativeRequest } from './react-native-evidence.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { createReactInitialInspectionStore } from './react-initial-inspection.js';
import {observeReactAuthoredInitials} from './react-authored-initial.js';

// A workspace that CAN be mounted: a stateful track whose part is sized by the component's own ancestor-conditioned
// rule and moves to the far end when on. The whole path is real: bundle, Chromium, fresh mounts, seal, assembly.
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const source = `import React from 'react';
export function Track({active,id}:{active?:boolean;id?:string}) { return <button id={id} data-slot="track" data-size="default" data-on={active ? '' : undefined} className="group"><span className="part" /></button> }`;
// The source witness wants rendered text in the declared font: an associated label, in a font the page carries itself.
const font = readFileSync('extract/computed/fonts/inter/inter-latin-variable.woff2').toString('base64');
const css = `@font-face{font-family:'Inter Variable';src:url(data:font/woff2;base64,${font});font-weight:100 900}:root{--original:red}*{box-sizing:border-box}body{margin:0;font-family:'Inter Variable'}.group{display:flex;align-items:center;padding:0;margin:0;border:1px solid transparent;background:rgb(229,229,229);font-size:12px;line-height:16px}
.group[data-size=default]{width:32px;height:18px}.group[data-size=default] .part{display:block;width:16px;height:16px;background:rgb(255,255,255)}.group[data-on] .part{translate:calc(100% - 2px)}.group[data-on]{background:rgb(23,23,23)}`;

test('observing again under another observer: the new run completes and becomes latest, the old run is untouched and still serves its pin', async t => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'react-reobserve-ws-'))), repo = realpathSync(mkdtempSync(path.join(tmpdir(), 'react-reobserve-repo-')));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(repo, { recursive: true, force: true }); });
  const put = (file: string, text: string) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), text); };
  put('package.json', '{"type":"module"}'); put('package-lock.json', '{}');
  put('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, jsx: 'react-jsx', moduleResolution: 'Bundler', module: 'ESNext' } }));
  for (const file of ['src/index.css', 'capture-input.css', 'tailwind.css']) put(file, css);
  put('src/components/ui/track.tsx', source);
  put(reactCasesFile, JSON.stringify({ version: 1, source: 'Reobservation fixture', theme: 'Fixture light', fontFamily: 'Inter', sideEffectImports: ['./tailwind.css'],
    requiredTokens: { '--original': 'red' }, witnessFiles: { 'src/components/ui/track.tsx': sha(source) },
    cases: [{ id: 'track-off', subject: 'Track', label: 'Off', negativeControl: true, mount: { tag: 'div', props: { style: { display: 'flex', gap: 8 } }, children: [{ module: './src/components/ui/track', export: 'Track', props: { id: 'track', active: false } },
        { tag: 'label', props: { htmlFor: 'track' }, children: ['Track'] }] },
      witness: { path: ['[data-slot="track"]'], associatedLabelText: 'Track', requiredStyles: { display: 'flex' } } }] }));
  mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  mkdirSync(path.join(root, 'node_modules/@types'), { recursive: true });
  for (const name of ['react', 'react-dom', 'scheduler', '@types/react', '@types/react-dom', 'csstype']) symlinkSync(path.resolve('node_modules', name), path.join(root, 'node_modules', name), 'dir');

  // Seal the structure observation this inspection anchors to, from the same real render the store will repeat.
  const reference = await buildReactReference(root), program = readReactSourceProgram(root, ['src/components/ui/track.tsx']);
  assert.deepEqual(program.problems, []);
  const observed = await buildReactOwnershipReference(root, reference, program), profile = reference.cohort.profile('track-off');
  const browser = await chromium.launch();
  let captured: Awaited<ReturnType<typeof captureValidatedTree>>, ownership: ReactOwnership, png: Buffer;
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, colorScheme: 'light' });
    await context.addInitScript(reactOwnershipHook);
    const page = await context.newPage(), failures = watchSourceFailures(page);
    try {
      const url = 'http://127.0.0.1/react-ownership?case=track-off'; // the store's own page: same origin-less route, same case selection
      await context.route('**/*', r => r.request().url() === url ? r.fulfill({ status: 200, contentType: 'text/html', body: reactReferenceHtml(observed) }) : r.abort());
      await page.goto(url); await page.locator(profile.path[0]).waitFor({ state: 'attached', timeout: 15000 });
      captured = await captureValidatedTree(page, profile, failures, '#root', '--');
      ownership = await page.evaluate(reactOwnershipRead(profile.path[0])) as ReactOwnership;
      png = await page.screenshot({ fullPage: true, caret: 'initial' });
    } finally { failures.dispose(); }
  } finally { await browser.close(); }
  assert.equal(captured.status, 'captured', JSON.stringify(captured));
  if (captured.status !== 'captured') throw Error('capture required');
  const report: ReactOwnershipReport = { id: '22222222-2222-4222-8222-222222222222', referenceId: reference.id, state: 'complete', acceptedContract: null,
    denominator: 1, matched: 1, sourceUnchanged: true, rows: [{ id: 'track-off', matched: true, problems: [], treeSha256: captured.treeSha256, sourceImage: captured.sourcePngSha256, ownership,
      rootMatrix: { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
        draft: { status: 'native-compiled', problems: [], properties: [], observations: [], lowerings: [], limitations: [], sizing: [] } } as ReactOwnershipReport['rows'][number]['rootMatrix'] }] };
  const archive = path.join(repo, 'private/react-source-ownership', reference.id, report.id);
  mkdirSync(path.join(archive, 'track-off'), { recursive: true });
  writeFileSync(path.join(archive, 'report.json'), JSON.stringify(report)); writeFileSync(path.join(archive, 'program.json'), JSON.stringify(program));
  writeFileSync(path.join(archive, 'track-off/source-tree.json'), JSON.stringify(captured)); writeFileSync(path.join(archive, 'track-off/source.png'), png);
  writeFileSync(path.join(archive, 'integrity.json'), JSON.stringify({ version: 1, files: inventoryEvidence(archive) }));
  const anchor = selectReactNativeRequest(repo, report, 'track-off');
  const observedBy = (observer: Record<string, string>) => createReactInitialInspectionStore(repo, root, () => ({ reference, anchor }), observer);

  const first = observedBy({ x: '1' }).start(reference.id, 'track-off'); await first.promise;
  assert.deepEqual([first.state.phase, first.state.problems, first.state.observer], ['complete', [], { x: '1' }]);
  const saved = observedBy({ x: '1' }).read(reference.id, 'track-off')!;
  assert.deepEqual([saved.id, saved.draft?.status, saved.draft?.problems, saved.reobservable], [first.state.id, 'compiled-draft', [], undefined]);
  // The rules of this branch, end to end through the real observer.
  for (const variant of saved.draft!.compiled!.component!.variants)
    assert.deepEqual([variant.spec.children![0].fixedWidth?.px, variant.spec.children![0].fixedHeight?.px, variant.spec.layout?.primary], [16, 16, variant.name === 'active=true' ? 'MAX' : 'MIN'], variant.name);
  // What an operation holds: the run by id, inventory and report hash.
  const pin = observedBy({ x: '1' }).nativeRequest(reference.id, 'track-off');
  assert.equal(pin.observation.id, first.state.id);
  const runsRoot = path.dirname(path.join(repo, 'private/react-initial-inspections', readdirSync(path.join(repo, 'private/react-initial-inspections'))[0], first.state.id));
  const firstDir = path.join(runsRoot, first.state.id), firstBytes = JSON.stringify(inventoryEvidence(firstDir));
  const pinned = { image: evidenceSha(observedBy({ x: '1' }).nativeImage(reference, pin, '0')), draft: JSON.stringify(observedBy({ x: '1' }).nativeEvidence(reference, pin).draft) };
  assert.equal(observedBy({ x: '1' }).start(reference.id, 'track-off').state.id, first.state.id, 'the same observer: final');

  const now = observedBy({ x: '2' });
  assert.equal(now.read(reference.id, 'track-off')!.reobservable, 'observer-changed');
  const again = now.start(reference.id, 'track-off');
  assert.equal(now.start(reference.id, 'track-off'), again, 'a second request while it runs is the running one');
  await again.promise;
  assert.deepEqual([again.state.phase, again.state.problems, again.state.observer, again.state.id === first.state.id], ['complete', [], { x: '2' }, false]);
  assert.equal(JSON.parse(readFileSync(path.join(runsRoot, 'latest.json'), 'utf8')).id, again.state.id, 'latest moved to the completed new run');
  assert.deepEqual(readdirSync(runsRoot).sort(), [first.state.id, again.state.id, 'latest.json'].sort());
  assert.equal(JSON.stringify(inventoryEvidence(firstDir)), firstBytes, 'the old run is byte-for-byte untouched');
  const after = observedBy({ x: '2' }).read(reference.id, 'track-off')!;
  assert.deepEqual([after.id, after.draft?.status, after.reobservable, after.lastAttempt], [again.state.id, 'compiled-draft', undefined, undefined]);
  assert.equal(observedBy({ x: '2' }).nativeRequest(reference.id, 'track-off').observation.id, again.state.id, 'an operation prepared afterwards pins the new run');
  // An existing operation's pin still reads the OLD run, whatever latest says.
  assert.deepEqual({ image: evidenceSha(observedBy({ x: '2' }).nativeImage(reference, pin, '0')), draft: JSON.stringify(observedBy({ x: '2' }).nativeEvidence(reference, pin).draft) }, pinned);
  const snapshots=Object.fromEntries(saved.observation!.rows.map(row=>[row.id,JSON.parse(readFileSync(path.join(firstDir,'states',row.id+'.json'),'utf8'))]));
  const originDir=path.join(repo,'original-origins'),originBrowser=await chromium.launch({args:['--enable-automation']});
  try{
    const origins=await observeReactAuthoredInitials({browser:originBrowser,reference,program,ownership,tree:captured.tree,
      observation:saved.observation!,snapshots,caseId:'track-off',dir:originDir,assertCurrent(){}});
    // This fixture is a function declaration, a named unsupported form of the
    // original JSX effect model. A matched render must never bypass that refusal.
    assert.deepEqual(origins.rows.map(row=>({status:row.status,problem:row.problem})),
      saved.observation!.rows.map(()=>({status:'refused',problem:'jsx-effects-function-unavailable'})));
    const changed=structuredClone(saved.observation!);changed.rows.pop();
    await assert.rejects(observeReactAuthoredInitials({browser:originBrowser,reference,program,ownership,tree:captured.tree,
      observation:changed,snapshots,caseId:'track-off',dir:path.join(repo,'incomplete-origins'),assertCurrent(){}}),/domain-mismatch/);
  }finally{await originBrowser.close();}
  assert.equal(JSON.stringify(inventoryEvidence(firstDir)),firstBytes,'origin collection leaves the sealed initial observation untouched');

});
