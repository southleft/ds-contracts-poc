import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativeComparisonFixture } from '../core/native-contract-comparison-test-fixture.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from '../core/native-source-observation.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from '../core/token-set.js';
import { revisionOf } from '../core/contract-provenance.js';
import { readReactSourceProgram } from './react-source-program.js';
import { compileObservedContent } from './observed-content.js';
import { matchReactComposition, type ReactCompositionMain } from './react-composition.js';
import type { ReactOwnership } from './react-ownership.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import type { TextFontEvidence } from './text-fonts.js';
import { isReactComparisonRequest, reactComparisonReservation } from './react-comparison-request.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { isReactNativeRequest, reactNativeReservation } from './react-native-request.js';
import { deriveReactChildRoot } from './react-child-root.js';
import { projectReactRootVisual } from './react-root-visual.js';
import { prepareReactNativePlan } from './react-native-plan.js';
import { readReactStyleOrigin, type ReactStyleOrigin } from './react-style-origin.js';
import { nestedReactHostPaths } from './react-source-anatomy.js';
import { reactChildContextSizing } from './react-child-context.js';
import { gridConstraintChannels } from './grid-constraints.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { readReactNativeEvidence, selectReactChildRequest, selectReactNativeRequest } from './react-native-evidence.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { projectReactCallerComposition, projectReactCallerCompositionGraph, compareReactCallerContext, requireReactCallerComposition } from './react-caller-composition.js';
import { compileReactCallerNative } from './react-caller-native.js';
import { prepareReactCallerNativePlan, buildReactCallerNativeWrite } from './react-caller-native-plan.js';
import { isReactCallerNativeRequest, reactCallerNativeReservation } from './react-caller-native-request.js';
import { buildReactCallerPreview } from './react-caller-preview.js';
import { chromium } from 'playwright-core';
import { generatedTypeErrors } from '../core/react-test-runtime.js';
import type { NodeSpec } from '../core/emit-figma-script.js';
import { builtinReactCohort } from './react-cohort.js';
import {createNativeOperationJobs, REACT_NATIVE_FILE_KEY, type NativeOperationJobsOptions, type NativeOperationCommand} from './native-operation-jobs.js';

test('caller text preserves its observed font when a component boundary replaces its inherited CSS alias', async t => {
  const f = await fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  f.tree.style.width = '240px';
  const child = f.tree.nodes[0]; assert.equal(child.t, 'el'); if (child.t !== 'el') return;
  child.el.nodes = [{ t: 'text', v: 'Save' }];
  child.el.style['font-family'] = '"Browser Font Alias", sans-serif';
  f.ownership.nodes = f.ownership.nodes.filter(n => n.path !== '0.0');
  f.fonts.treeRevision = revisionOf(f.tree);
  f.fonts.rows[0] = { ...f.fonts.rows[0], path: [0], text: 'Save', cssFamily: child.el.style['font-family'] };
  const input = { program: f.program, ownership: f.ownership, tree: f.tree, fonts: f.fonts,
    svg: { version: 1 as const, treeRevision: revisionOf(f.tree), status: 'observed' as const, rows: [], problems: [] },
    origin: { version: 1 as const, roots: [{ path: '0', tag: 'button', channels: [] }] },
    labels: { version: 1 as const, treeRevision: revisionOf(f.tree), status: 'observed' as const, rows: [], problems: [] }, behaviors: [] };
  const original = structuredClone(input), graph = projectReactCallerCompositionGraph(input);
  assert.equal(graph.draft.status, 'generated-draft', graph.draft.problems.join(','));
  const native = compileReactCallerNative(graph), text: NodeSpec[] = [];
  const visit = (node: NodeSpec) => { if (node.callerContentProp) text.push(node); node.children?.forEach(visit); };
  native.components.find(c => c.contractId === graph.draft.contract!.id)!.variants.forEach(v => visit(v.spec));
  assert.equal(text.length, 1);
  assert.equal(text[0].characters, 'Save');
  assert.equal(text[0].fontFamily, 'Inter', 'the observed family survives caller-slot inheritance; the CSS alias is not a native font');
  assert.deepEqual(input, original, 'source and font observations stay immutable');
  const stale = structuredClone(input); stale.fonts.rows[0].cssFamily = 'Different alias';
  assert.equal(projectReactCallerCompositionGraph(stale).draft.status, 'refused');
  // The caller source frame is admitted by observed structure, never by a case
  // name: a generated composition with nested children passes; evidence that
  // generates none, and a root with no nested component children, are refused.
  assert.ok(graph.draft.children.length > 0);
  assert.doesNotThrow(() => requireReactCallerComposition(graph.draft));
  assert.throws(() => requireReactCallerComposition(projectReactCallerCompositionGraph(stale).draft), /^Error: react-caller-source-frame-composition-required$/);
  assert.throws(() => requireReactCallerComposition({ ...graph.draft, children: [] }), /^Error: react-caller-source-frame-composition-required$/);
});

test('source caller projection preserves editable content and distinct generated label IDs in the real consumer', async t => {
  const f = await fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  f.tree.style.width = '240px';
  const button = f.tree.nodes[0]; assert.equal(button.t, 'el'); if (button.t !== 'el') return;
  f.tree.nodes.push({ t: 'el', el: { tag: 'label', classes: [], style: { ...button.el.style, display: 'inline' }, pseudo: {}, nodes: [{ t: 'text', v: 'Activate' }] } });
  f.ownership.nodes.push({ path: '1', tag: 'label', nearestComponent: 'box' });
  f.fonts.treeRevision = revisionOf(f.tree);
  f.fonts.rows.push({ ...f.fonts.rows[0], path: [1], text: 'Activate', fonts: [{ familyName: 'Inter', postScriptName: 'Inter-Regular', isCustomFont: true, glyphCount: 8 }] });
  const input = { program: f.program, ownership: f.ownership, tree: f.tree, fonts: f.fonts,
    svg: { version: 1 as const, treeRevision: revisionOf(f.tree), status: 'observed' as const, rows: [], problems: [] },
    origin: { version: 1 as const, roots: [{ path: '0', tag: 'button', channels: [] }] },
    labels: { version: 1 as const, treeRevision: revisionOf(f.tree), status: 'observed' as const, problems: [],
      rows: [{ labelPath: '1', controlPath: '0', controlTag: 'button', mode: 'explicit' as const, sourceId: 'save', text: 'Activate' }] }, behaviors: [] };
  const draft = projectReactCallerComposition(input);
  assert.equal(draft.status, 'generated-draft', draft.problems.join(','));
  assert.equal(draft.children.length, 1); assert.equal(draft.identities.length, 1);
  const graph = projectReactCallerCompositionGraph(input), before = structuredClone(graph);
  assert.deepEqual(graph.draft, draft);
  assert.equal(graph.resources.length, draft.contracts!.length);
  const native = compileReactCallerNative(graph);
  assert.deepEqual(graph, before, 'native projection cannot mutate the source-derived React graph');
  assert.equal(native.report.components.length, 2);
  assert.equal(native.report.observedWidth, 240);
  assert.equal(native.report.observedVariant, native.components.find(c => c.contractId === draft.contract!.id)!.variants[0].name);
  const nativeParent = native.report.components.find(c => c.contractId === draft.contract!.id)!;
  assert.equal(nativeParent.editableTextProperties.length, 1, 'direct parent text remains a property-panel control');
  assert.equal(nativeParent.editableCanvasText.length, 1);
  assert.ok(nativeParent.editableCanvasText[0].property);
  assert.ok(nativeParent.editableCanvasText[0].nodeName);
  assert.equal(native.report.unsupportedPropertyBindings.length, 0, 'caller text is represented by a directly editable native node');
  assert.ok(!native.report.blockers.includes('native-caller-slot-property-bindings-unsupported'));
  assert.ok(native.report.blockers.includes('native-composition-delivery-unverified'));
  assert.equal(compileReactCallerNative(graph).report.graphRevision, native.report.graphRevision);
  assert.throws(() => compileReactCallerNative({ ...graph, resources: graph.resources.slice(1) }), /IDENTITIES_INVALID/);
  assert.throws(() => compileReactCallerNative({ ...graph, draft: { ...draft, observedWidth: undefined } }), /source-unavailable/);
  const parent = draft.modules!.find(m => m.name === draft.contract!.name)!;
  assert.deepEqual(generatedTypeErrors(parent.name, parent.tsx, Object.fromEntries(draft.modules!.filter(m => m !== parent).map(m => [m.name, m.tsx]))), []);
  const output = await buildReactCallerPreview(process.cwd(), draft);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<div id="root"></div>'); await page.addStyleTag({ content: output.css }); await page.addScriptTag({ content: output.javascript });
  const labels = page.locator('.examples label');
  const ids = await labels.evaluateAll(nodes => nodes.map(node => (node as HTMLLabelElement).control?.id));
  assert.equal(ids.length, 2); assert.ok(ids.every(Boolean)); assert.equal(new Set(ids).size, 2); assert.ok(!ids.includes('save'));
  const text = draft.contract!.props.find(p => p.default === 'Activate')!;
  await page.getByLabel(text.name, { exact: true }).fill('Updated caption');
  assert.deepEqual(await labels.allTextContents(), ['Updated caption', 'Updated caption']);
  assert.deepEqual(await labels.evaluateAll(nodes => nodes.map(node => (node as HTMLLabelElement).control?.id)), ids);
  const broken = projectReactCallerComposition({ ...input, labels: { ...input.labels, treeRevision: 'changed' } });
  assert.equal(broken.status, 'refused'); assert.equal(broken.modules, undefined);
  await assert.rejects(buildReactCallerPreview(process.cwd(), broken), /draft-unavailable/);
});

test('caller graph requests validate exact evidence while retaining one native reservation', () => {
  const request = {
    version: 1 as const, kind: 'react-caller-graph-draft' as const,
    referenceId: 'a'.repeat(64), parentOperationId: '10000000-0000-4000-8000-000000000001',
    ownership: { id: '20000000-0000-4000-8000-000000000002', sha256: 'b'.repeat(64) },
    inventorySha256: 'c'.repeat(64), caseId: 'card-composed', graphRevision: `sha256:${'d'.repeat(64)}`,
  };
  assert.ok(isReactCallerNativeRequest(request));
  const reservation = reactCallerNativeReservation(request);
  assert.match(reservation, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
  assert.equal(reactCallerNativeReservation({ ...request, graphRevision: `sha256:${'e'.repeat(64)}` }), reservation,
    'a changed graph cannot obtain a second native allocation behind the same source composition');
  assert.equal(isReactCallerNativeRequest({ ...request, graphRevision: 'changed' }), false);
  assert.equal(isReactCallerNativeRequest({ ...request, unexpected: true }), false);
  assert.ok(isReactCallerNativeRequest({...request,graphVerification:1}));
  assert.equal(reactCallerNativeReservation({...request,graphVerification:1}),reservation);
  assert.equal(isReactCallerNativeRequest({...request,graphVerification:2}),false);
  assert.equal(isReactCallerNativeRequest({...request,graphVerification:undefined}),false);
});

test('caller preview reports text-free typography discrepancies but refuses changed paint, text, dimensions and structure', () => {
  const tree: CapturedNode = { tag: 'button', classes: [], pseudo: {}, nodes: [], style: { 'font-size': '16px', 'line-height': '24px', width: '16px', color: 'red' } };
  assert.deepEqual(compareReactCallerContext(tree, structuredClone(tree)), []);
  const source = structuredClone(tree); source.style['font-size'] = '14px';
  assert.deepEqual(compareReactCallerContext(tree, source), [{ field: 'root.style.font-size', generated: '16px', source: '14px' }]);
  for (const mutate of [
    (node: CapturedNode) => { node.style.width = '17px'; },
    (node: CapturedNode) => { node.style.color = 'blue'; },
    (node: CapturedNode) => { node.nodes.push({ t: 'text', v: 'Text' }); },
    (node: CapturedNode) => { node.pseudo['::after'] = { content: '"Text"' }; },
    (node: CapturedNode) => { node.tag = 'input'; },
  ]) { const changed = structuredClone(source); mutate(changed); assert.equal(compareReactCallerContext(tree, changed), undefined); }
});

async function fixture(sourceOwned = false) {
  const dir = mkdtempSync(path.join(tmpdir(), 'react-composition-'));
  try {
    writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'preserve', strict: true, target: 'ES2022', skipLibCheck: true } }));
    writeFileSync(path.join(dir, 'components.tsx'), `
declare global { namespace JSX { interface Element {} interface IntrinsicElements { section: any; button: any } } }
export function Box(props: {children?: string}) { return <section {...props}/> }
export function Child(props: {children?: string; id?: string}) { return <button {...props}/> }
`);
    const program = readReactSourceProgram(dir, ['components.tsx']);
    assert.deepEqual(program.problems, []);
    const source = (name: string) => {
      const c = program.components.find(c => c.exportName === name)!;
      return { module: c.module, exportName: c.exportName, sourceSha256: c.sourceSha256, span: c.span };
    };
    const child: CapturedNode = { tag: 'button', classes: [], pseudo: {}, nodes: [{ t: 'text', v: 'Save' }], style: {
      display: 'inline-flex', 'flex-direction': 'row', 'background-color': 'rgb(18, 52, 86)', color: 'rgb(250, 250, 250)',
      'font-family': 'Inter', 'font-size': '14px', 'font-weight': '400', 'font-style': 'normal', 'line-height': '20px',
      'white-space-collapse': 'collapse',
    } };
    child.nodes = [{ t: 'el', el: { tag: 'span', classes: [], pseudo: {}, style: { ...child.style, display: 'inline' }, nodes: child.nodes } }];
    const tree: CapturedNode = { tag: 'section', classes: [], pseudo: {}, nodes: [{ t: 'el', el: child }],
      style: { display: 'flex', 'flex-direction': 'column' } };
    const ownership: ReactOwnership = { version: 1, rendererVersions: ['19.2.7'], problems: [], components: [
      { id: 'box', source: source('Box'), props: { children: { kind: 'object' } }, roots: [''] },
      { id: 'child', parent: 'box', source: source('Child'), props: { children: 'Save', id: 'save' }, roots: ['0'] },
    ], nodes: [{ path: '', tag: 'section', nearestComponent: 'box', createdBy: 'box' },
      { path: '0', tag: 'button', nearestComponent: 'child', createdBy: 'child' },
      { path: '0.0', tag: 'span', nearestComponent: 'child' }] };
    const fonts: TextFontEvidence = { version: 1, status: 'observed', treeRevision: revisionOf(tree), problems: [], rows: [
      { path: [0, 0], text: 'Save', cssFamily: 'Inter', cssWeight: '400', cssStyle: 'normal',
        fonts: [{ familyName: 'Inter', postScriptName: 'Inter-Regular', isCustomFont: true, glyphCount: 4 }] },
    ] };
    const content = compileObservedContent(tree, fonts, undefined, true);
    assert.equal(content.status, 'compiled-comparison-draft', content.problems.join(','));
    const native = await nativeComparisonFixture();
    if (sourceOwned) {
      // Runtime-owned source content uses a complete native main, not a slot.
      delete ownership.nodes[1].createdBy;
      const owned = native.contract('fixture.main', { root: { layout: { display: 'inline-flex', direction: 'row' },
        literals: { width: '16px', height: '16px' } } });
      const context = await native.context('10000000-0000-4000-8000-000000000003');
      const data = native.engine.compileNativeContractDraft(owned, new Map([[owned.id, owned]]), native.source);
      const creation = await native.run(native.engine.buildNativeContractDraftScript(owned, new Map([[owned.id, owned]]), native.source, context));
      const input: NativeContractObservationInput = { operation: context.operation, planRevision: revisionOf('owned'),
        projection: data.projection, component: data.component, tokenInput: context.tokens.input, tokenIdentity: context.tokens.identity, creation };
      const receipt = await native.run(emitNativeContractReadbackScript(input));
      const main: ReactCompositionMain = { source: source('Child'), contract: owned, heldProps: { id: 'save' },
        styles: {}, sourceOwnedTrees: { Main: structuredClone(child) }, input, receipt };
      return { dir, program, tree, ownership, fonts, content, main };
    }
    const main: ReactCompositionMain = { source: source('Child'), contract: native.main, heldProps: { id: 'save' },
      styles: { Main: [child.style] }, input: native.comparison.parent, receipt: native.comparison.receipt };
    return { dir, program, tree, ownership, fonts, content, main };
  } catch (error) { rmSync(dir, { recursive: true, force: true }); throw error; }
}

test('a nested caller host cannot reuse a root-only main or erase its wrapper', async t => {
  const f=await fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
  const file=path.join(f.dir,'components.tsx');
  writeFileSync(file,readFileSync(file,'utf8').replace('section: any; button: any','section: any; button: any; span: any')
    .replace('export function Child(props: {children?: string; id?: string}) { return <button {...props}/> }',
      'export function Child({children,id}: {children?: string; id?: string}) { return <button id={id}><span>{children}</span></button> }'));
  f.program=readReactSourceProgram(f.dir,['components.tsx']);assert.deepEqual(f.program.problems,[]);
  for(const instance of f.ownership.components){const c=f.program.components.find(c=>c.exportName===instance.source.exportName)!;
    instance.source={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};}
  assert.equal(f.program.components.find(c=>c.name==='Child')!.children.kind,'nested-forwarded');
  f.ownership.nodes[2].createdBy='child';f.main.source=f.ownership.components[1].source;
  const host=(f.tree.nodes[0] as {t:'el';el:CapturedNode}).el;
  const slotHost=(host.nodes[0] as {t:'el';el:CapturedNode}).el;
  f.tree.style.width='240px';
  Object.assign(host.style,{width:'160px',height:'80px'});
  Object.assign(slotHost.style,{display:'flex','flex-direction':'column',width:'120px',height:'40px'});
  f.fonts.treeRevision=revisionOf(f.tree);f.content=compileObservedContent(f.tree,f.fonts,undefined,true);
  assert.equal(f.content.status,'compiled-comparison-draft',f.content.problems.join(','));
  const matched=matchReactComposition(f.program,f.ownership,f.tree,f.content,[f.main]);
  assert.equal(matched.review.matched,0,'matching root paint cannot justify omitting the source-owned span');
  assert.deepEqual(matched.references,[]);
  assert.deepEqual(matched.review.rows[0].problems,['react-composition-nested-slot-lowering-unqualified']);
  const input={program:f.program,ownership:f.ownership,tree:f.tree,fonts:f.fonts,
    svg:{version:1 as const,treeRevision:revisionOf(f.tree),status:'observed' as const,rows:[],problems:[]},
    origin:{version:1 as const,roots:[{path:'0',tag:'button',channels:[]}]},
    labels:{version:1 as const,treeRevision:revisionOf(f.tree),status:'observed' as const,rows:[],problems:[]},behaviors:[]};
  const generated=projectReactCallerCompositionGraph(input);
  assert.equal(generated.draft.status,'refused');
  assert.ok(generated.draft.problems.some(p=>p.startsWith('react-nested-child-size-unqualified')),generated.draft.problems.join(','));
  assert.deepEqual(generated.resources,[]);
  const sized={...input,origin:{version:1 as const,roots:[
    {path:'0',tag:'button',channels:[],sizes:[{channel:'width' as const,status:'fixed' as const,value:'160px',selectors:['.child']},{channel:'height' as const,status:'fixed' as const,value:'80px',selectors:['.child']}]},
    {path:'0.0',tag:'span',channels:[],sizes:[{channel:'width' as const,status:'fixed' as const,value:'120px',selectors:['.body']},{channel:'height' as const,status:'fixed' as const,value:'40px',selectors:['.body']}]},
  ]}};
  const graph=projectReactCallerCompositionGraph(sized);
  assert.equal(graph.draft.status,'generated-draft',graph.draft.problems.join(','));
  const child=graph.draft.contracts!.find(c=>c.name==='Child')!;
  assert.equal(child.anatomy.root.slot,undefined);
  assert.ok(Object.values(child.anatomy.root.parts??{}).some(part=>part.slot?.name==='children'));
  const native=compileReactCallerNative(graph);
  assert.ok(native.components.find(c=>c.contractId===child.id)?.variants[0].spec.children?.some(node=>node.type==='slot'));
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();
  await page.setContent('<style>.child{box-sizing:border-box;width:160px;height:80px}.body{display:flex;width:120px;height:40px}</style><div id="root"><section id="subject"><button class="child"><span class="body">Save</span></button></section></div>');
  const paths=nestedReactHostPaths(f.program,f.ownership,f.tree);
  assert.deepEqual(paths,['0','0.0']);
  const before=await page.screenshot();
  const rootsOnly=await readReactStyleOrigin(page,'#subject',f.ownership);
  assert.deepEqual(rootsOnly.roots.map(row=>row.path),['','0']);
  const captured=await readReactStyleOrigin(page,'#subject',f.ownership,'#root',paths);
  assert.deepEqual(captured.roots.map(row=>row.path),['','0','0.0']);
  assert.deepEqual(await page.screenshot(),before,'nested style capture cannot change the source');
  const capturedGraph=projectReactCallerCompositionGraph({...sized,origin:captured});
  assert.equal(capturedGraph.draft.status,'generated-draft',capturedGraph.draft.problems.join(','));
  assert.deepEqual(capturedGraph.draft.contracts!.find(c=>c.name==='Child'),child,'real browser declarations carry the same fixed wrapper sizes');
  await assert.rejects(readReactStyleOrigin(page,'#subject',f.ownership,'#root',['0.0.0']),/owned-host-unqualified/);
  const output=await buildReactCallerPreview(process.cwd(),graph.draft);
  await page.setContent('<div id="root"></div>');await page.addStyleTag({content:output.css});await page.addScriptTag({content:output.javascript});
  const wrappers=page.locator('.examples button > span');
  assert.equal(await wrappers.count(),2);
  assert.deepEqual(await wrappers.allTextContents(),['Save','Save']);
  assert.deepEqual(await wrappers.evaluateAll(nodes=>nodes.map(node=>{
    const style=getComputedStyle(node);return {width:style.width,height:style.height,display:style.display,direction:style.flexDirection};
  })),Array(2).fill({width:'120px',height:'40px',display:'flex',direction:'column'}));
  const text=graph.draft.contract!.props.find(p=>p.default==='Save')!;assert.ok(text);
  await page.getByLabel(text.name,{exact:true}).fill('Changed caller text');
  assert.deepEqual(await wrappers.allTextContents(),['Changed caller text','Changed caller text']);
  const hostFixture=await nativeComparisonFixture(REACT_NATIVE_FILE_KEY);
  const planInput={graph,operation:{id:'10000000-0000-4000-8000-000000000009',fileKey:hostFixture.figma.fileKey},source:hostFixture.source,graphVerification:1 as const};
  const plan=prepareReactCallerNativePlan(planInput);
  const tokenCreation=await hostFixture.run(emitNativeTokenContextScript(plan.plan.tokenInput).script);
  assert.equal(tokenCreation.status,'created-candidate');
  const tokenReadback=await hostFixture.run(emitNativeTokenContextReadbackScript(plan.plan.tokenInput,tokenCreation.creationIdentity));
  const write=buildReactCallerNativeWrite({...planInput,expectedPlanRevision:plan.revision,
    tokens:{input:plan.plan.tokenInput,identity:tokenCreation.creationIdentity,receipt:tokenReadback.receipt}});
  const creation=await hostFixture.run(write.script);assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const observation={operation:planInput.operation,planRevision:plan.revision,projection:plan.plan.projection,
    component:plan.plan.component,graphComponents:plan.plan.graphComponents,tokenInput:plan.plan.tokenInput,
    tokenIdentity:tokenCreation.creationIdentity,creation,graphVerification:1 as const};
  const receipt=await hostFixture.run(emitNativeContractReadbackScript(observation));
  const verified=verifyNativeContractReadback(observation,receipt);
  assert.equal(verified.status,'supported-structure-observed',JSON.stringify(verified));
  const nativeCaller=hostFixture.figma.root.findOne((node:any)=>node.type==='TEXT'&&node.characters==='Save'&&node.getSharedPluginData('ds_contracts','callerContentProperty'))!;
  assert.ok(nativeCaller);assert.equal(nativeCaller.parent.type,'SLOT');assert.equal(nativeCaller.parent.parent.type,'INSTANCE');
  assert.equal(nativeCaller.parent.width,120);assert.equal(nativeCaller.parent.height,40);
  assert.equal(nativeCaller.parent.layoutMode,'VERTICAL');
  nativeCaller.characters='Native caller edit';
  assert.equal(verifyNativeContractReadback(observation,await hostFixture.run(emitNativeContractReadbackScript(observation))).status,'refused');
  nativeCaller.characters='Save';

  const request={version:1 as const,kind:'react-caller-graph-draft' as const,
    referenceId:'a'.repeat(64),parentOperationId:'10000000-0000-4000-8000-000000000001',
    ownership:{id:'20000000-0000-4000-8000-000000000002',sha256:'b'.repeat(64)},
    inventorySha256:'c'.repeat(64),caseId:'card-composed',graphRevision:plan.plan.graphRevision,graphVerification:1 as const};
  const options:NativeOperationJobsOptions={prepare:()=>{throw Error('unexpected legacy preparer');},reactCaller:{
    prepare:(selected,operation)=>({visual:{id:selected.ownership.id,reportSha256:selected.ownership.sha256},
      preparation:{id:selected.ownership.id,reportSha256:selected.graphRevision.slice(7)},
      plan:prepareReactCallerNativePlan({graph,source:hostFixture.source,operation,graphVerification:selected.graphVerification})}),
    buildComponent:(selected,context)=>buildReactCallerNativeWrite({graph,source:hostFixture.source,
      operation:context.operation,tokens:context.tokens,expectedPlanRevision:context.planRevision,graphVerification:selected.graphVerification}),
  }};
  const reopen=()=>createNativeOperationJobs(f.dir,options);
  const prepared=reopen().prepare(request);
  assert.equal(prepared.graphVerification,1);
  const execute=async(command:NativeOperationCommand)=>({version:1 as const,operationId:command.operationId,phase:command.phase,
    attemptId:command.attemptId,nonce:command.nonce,fileKey:command.fileKey,planRevision:command.planRevision,
    scriptSha256:command.scriptSha256,result:await hostFixture.run(command.script)});
  for(const phase of ['token-create','token-readback','component-create','component-readback'] as const){
    const command=reopen().dispatch(prepared.id,phase);
    const envelope=await execute(command);
    assert.equal(reopen().pendingCommand(prepared.id)?.attemptId,command.attemptId,'the exact pending command survives reopening');
    if(phase==='component-create') assert.throws(()=>reopen().retryCreation(prepared.id),/creation-retry-refused/,
      'an interrupted write waits for its original acknowledgement; it cannot be allocated again');
    const next=reopen().accept(prepared.id,envelope);
    assert.equal(next.sourceCurrent,true,JSON.stringify(next.problems));
  }
  const terminal=reopen().get(prepared.id);
  assert.equal(terminal.phase,'component-structure-observed',JSON.stringify(terminal.problems));
  assert.equal(terminal.graphVerification,1);
  const count=hostFixture.figma.root.findAll(()=>true).length;
  assert.equal(reopen().prepare(request).id,prepared.id);
  const {graphVerification:_,...legacyRequest}=request;
  assert.throws(()=>reopen().prepare(legacyRequest),/baseline-already-reserved/);
  assert.throws(()=>reopen().dispatch(prepared.id,'component-create'),/component-creation-already-dispatched/);
  const fresh=reopen().retryObservation(prepared.id),changed=await execute(fresh);
  const readback=changed.result as any;
  const dependencyText=readback.nodes.find((node:any)=>node.type==='TEXT'&&node.values.characters==='Save');
  assert.ok(dependencyText);dependencyText.values.characters='Unexpected edit';
  assert.equal(reopen().accept(prepared.id,changed).phase,'component-observation-refused');
  const restored=reopen().retryObservation(prepared.id);
  assert.equal(reopen().accept(prepared.id,await execute(restored)).phase,'component-structure-observed');
  assert.equal(hostFixture.figma.root.findAll(()=>true).length,count,'reopens and read retries allocate no native nodes');

  const incompleteRequest={...request,referenceId:'e'.repeat(64)},incomplete=reopen().prepare(incompleteRequest);
  for(const phase of ['token-create','token-readback'] as const){
    const command=reopen().dispatch(incomplete.id,phase);
    reopen().accept(incomplete.id,await execute(command));
  }
  const allocated=await execute(reopen().dispatch(incomplete.id,'component-create'));
  delete allocated.result.graphTargets[0].variants;
  const refused=reopen().accept(incomplete.id,allocated);
  assert.equal(refused.phase,'component-creation-invalid');
  assert.equal(refused.nativeOutcome,'unknown','incomplete birth evidence cannot claim no allocation');
  assert.equal(reopen().get(incomplete.id).phase,'component-creation-invalid','the incomplete acknowledgement remains durable');
  assert.throws(()=>reopen().retryCreation(incomplete.id),/creation-retry-refused/);
  assert.throws(()=>reopen().dispatch(incomplete.id,'component-create'),/component-creation-already-dispatched/);
  assert.throws(()=>reopen().dispatch(incomplete.id,'component-readback'),/component-allocation-identity-unavailable/);
});

test('repeated nested shells keep owned captions out of caller controls regardless of ownership enumeration order', async t => {
  const f=await fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
  const file=path.join(f.dir,'components.tsx');
  writeFileSync(file,readFileSync(file,'utf8').replace('section: any; button: any','section: any; button: any; span: any')
    .replace('export function Child(props: {children?: string; id?: string}) { return <button {...props}/> }',
      'export function Child({children}: {children?: unknown}) { return <section><span>Owned caption</span><section>{children}</section></section> }'));
  const program=readReactSourceProgram(f.dir,['components.tsx']);assert.deepEqual(program.problems,[]);
  const source=(name:string)=>{const c=program.components.find(c=>c.exportName===name)!;
    return {module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};};
  const style={display:'flex','flex-direction':'column',width:'160px',height:'80px','font-family':'Inter','font-size':'14px','font-weight':'400','font-style':'normal','line-height':'20px','white-space-collapse':'collapse'};
  const shell=(nodes:CapturedNode['nodes']):CapturedNode=>({tag:'section',classes:[],pseudo:{},style:{...style},nodes:[
    {t:'el',el:{tag:'span',classes:[],pseudo:{},style:{...style},nodes:[{t:'text',v:'Owned caption'}]}},
    {t:'el',el:{tag:'section',classes:[],pseudo:{},style:{...style},nodes}},
  ]});
  const tree:CapturedNode={tag:'section',classes:[],pseudo:{},style:{...style,width:'240px'},nodes:[{t:'el',el:shell([{t:'el',el:shell([{t:'text',v:'Caller copy'}])}])}]};
  const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],problems:[],components:[
    {id:'box',source:source('Box'),props:{children:{kind:'object'}},roots:['']},
    {id:'outer',parent:'box',source:source('Child'),props:{children:{kind:'object'}},roots:['0']},
    {id:'inner',parent:'outer',source:source('Child'),props:{children:'Caller copy'},roots:['0.1.0']},
  ],nodes:[{path:'',tag:'section',nearestComponent:'box',createdBy:'box'},
    ...[['outer','0'],['inner','0.1.0']].flatMap(([id,root])=>[
      {path:root,tag:'section',nearestComponent:id,createdBy:id},
      {path:root+'.0',tag:'span',nearestComponent:id,createdBy:id},
      {path:root+'.1',tag:'section',nearestComponent:id,createdBy:id},
    ])]};
  const treeRevision=revisionOf(tree);
  const fonts:TextFontEvidence={version:1,status:'observed',treeRevision,problems:[],rows:[
    {path:[0,0],text:'Owned caption'},{path:[0,1,0,0],text:'Owned caption'},{path:[0,1,0,1],text:'Caller copy'},
  ].map(row=>({...row,cssFamily:'Inter',cssWeight:'400',cssStyle:'normal',fonts:[{familyName:'Inter',postScriptName:'Inter-Regular',isCustomFont:true,glyphCount:row.text.length}]}))};
  const origin:ReactStyleOrigin={version:1,roots:ownership.nodes.filter(n=>n.path).map(n=>({...n,channels:[],sizes:[
    {channel:'width',status:'fixed',value:'160px',selectors:['.shell']},{channel:'height',status:'fixed',value:'80px',selectors:['.shell']},
  ]}))};
  const input={program,ownership,tree,fonts,origin,svg:{version:1 as const,status:'observed' as const,treeRevision,rows:[],problems:[]},
    labels:{version:1 as const,status:'observed' as const,treeRevision,rows:[],problems:[]},behaviors:[]};
  const reversed=structuredClone(input);reversed.ownership.components.reverse();
  const derived=input.ownership.components.filter(c=>c.parent).map(c=>deriveReactChildRoot(program,ownership,tree,origin,c.id,undefined,{fonts,svg:input.svg}).draft);
  assert.deepEqual(derived[0].contract,derived[1].contract);
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();
  for(const sample of [input,reversed]){
    const graph=projectReactCallerCompositionGraph(sample);
    assert.equal(graph.draft.status,'generated-draft',graph.draft.problems.join(','));
    assert.deepEqual(graph.draft.contract!.props.map(p=>p.default),['Caller copy'],'component-owned text must not become an orphaned caller control');
    assert.equal(graph.draft.contracts!.length,2,'both callers reuse the same source-owned shell');
    assert.equal(new Set(graph.draft.children.map(c=>c.contractId)).size,1);
    assert.doesNotThrow(()=>compileReactCallerNative(graph));
    assert.doesNotThrow(()=>prepareReactCallerNativePlan({graph,operation:{id:'10000000-0000-4000-8000-000000000009',fileKey:'T56aKuRnoay1L7CKAjSWRO'},
      source:{revision:treeRevision,programSha256:revisionOf(program).slice(7),evidenceRevision:revisionOf(sample)}}));
    const preview=await buildReactCallerPreview(process.cwd(),graph.draft);
    await page.setContent('<div id="root"></div>');await page.addStyleTag({content:preview.css});await page.addScriptTag({content:preview.javascript});
    const captions=page.locator('.examples span').filter({hasText:'Owned caption'});
    assert.equal(await captions.count(),4,'both repeated shells retain their own caption in each rendered example');
    const caller=graph.draft.contract!.props[0];await page.getByLabel(caller.name,{exact:true}).fill('Changed caller');
    assert.deepEqual(await captions.allTextContents(),Array(4).fill('Owned caption'));
    assert.equal(await page.locator('.examples').getByText('Changed caller',{exact:true}).count(),2);
  }
});

test('context child requests reopen pinned evidence and refuse substitution without upgrading legacy requests', async () => {
  const f = await fixture();
  try {
    const source = path.join(f.dir, 'components.tsx');
    const reference = { id: 'a'.repeat(64), files: { [source]: evidenceSha(readFileSync(source)) }, javascript: '', css: '', cohort: builtinReactCohort, sourceRoot: f.dir };
    const ownershipId = '10000000-0000-4000-8000-000000000001';
    const operationId = '10000000-0000-4000-8000-000000000002';
    const inspectionId = '10000000-0000-4000-8000-000000000003';
    const archive = path.join(f.dir, 'private/react-source-ownership', reference.id, ownershipId);
    mkdirSync(path.join(archive, 'card-composed'), { recursive: true });
    const save = (dir: string, file: string, value: unknown) => writeFileSync(path.join(dir, file), JSON.stringify(value));
    const treeSha256 = evidenceSha(JSON.stringify(f.tree));
    const report: ReactOwnershipReport = { id: ownershipId, referenceId: reference.id, state: 'complete',
      acceptedContract: null, denominator: 1, matched: 1, sourceUnchanged: true, rows: [{
        id: 'card-composed', matched: true, problems: [], treeSha256, ownership: f.ownership,
        rootMatrix: { version: 1, qualification: 'combined-property-root-draft', acceptedContract: null, problems: [],
          draft: { status: 'native-compiled', properties: [], contract: f.main.contract,
            native: f.main.input.component, tokens: {}, problems: [], observations: [], lowerings: [], limitations: [] } },
      }] };
    save(archive, 'report.json', report);
    save(archive, 'program.json', f.program);
    save(archive, 'card-composed/source-tree.json', { status: 'captured', problems: [], tree: f.tree, treeSha256 });
    save(archive, 'card-composed/style-origin.json', { version: 1, roots: [
      { path: '', tag: 'section', channels: [] }, { path: '0', tag: 'button', channels: [] },
    ] });
    save(archive, 'integrity.json', { version: 1, files: inventoryEvidence(archive) });
    const parent = selectReactNativeRequest(f.dir, report, 'card-composed');
    const legacy = selectReactChildRequest(f.dir, reference, parent, 'child');
    const legacyEvidence = readReactNativeEvidence(f.dir, reference, legacy);
    const inspectionRoot = path.join(f.dir, 'private/react-content-inspections', operationId);
    const inspection = path.join(inspectionRoot, inspectionId);
    mkdirSync(inspection, { recursive: true });
    const grids = { version: 1, status: 'observed', treeRevision: revisionOf(f.tree), rows: [], problems: [] };
    save(inspection, 'request.json', { operationId, request: parent });
    save(inspection, 'report.json', { id: inspectionId, operationId, referenceId: reference.id,
      caseId: parent.caseId, phase: 'complete', sourceUnchanged: true, gridConstraints: grids });
    save(inspection, 'grid-constraints.json', grids);
    save(inspection, 'integrity.json', { version: 1, files: inventoryEvidence(inspection) });
    const pin = { operationId, id: inspectionId, inventorySha256: evidenceSha(readFileSync(path.join(inspection, 'integrity.json'))) };
    const selected = selectReactChildRequest(f.dir, reference, parent, 'child', pin);
    assert.equal(selected.version, 3);
    const evidence = readReactNativeEvidence(f.dir, reference, selected);
    save(inspectionRoot, 'latest.json', { id: 'invalid newer pointer' });
    assert.deepEqual(readReactNativeEvidence(f.dir, reference, selected), evidence);
    assert.deepEqual(readReactNativeEvidence(f.dir, reference, legacy), legacyEvidence);
    assert.throws(() => readReactNativeEvidence(f.dir, reference, {
      ...selected, constraints: { ...pin, inventorySha256: 'f'.repeat(64) },
    }), /react-content-inventory-changed/);
    const original = readFileSync(path.join(inspection, 'grid-constraints.json'));
    save(inspection, 'grid-constraints.json', { ...grids, treeRevision: revisionOf('different tree') });
    assert.throws(() => readReactNativeEvidence(f.dir, reference, selected), /react-content-evidence-changed/);
    assert.deepEqual(readReactNativeEvidence(f.dir, reference, legacy), legacyEvidence);
    writeFileSync(path.join(inspection, 'grid-constraints.json'), original);
    save(inspection, 'request.json', { operationId, request: { ...parent, caseId: 'other-case' } });
    assert.throws(() => readReactNativeEvidence(f.dir, reference, selected), /react-content-evidence-changed/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('source export and compiler correspondence select an independently observed child main', async () => {
  const f = await fixture();
  try {
    const legacy = compileObservedContent(f.tree, f.fonts);
    const { sourcePaths, ...unchanged } = f.content;
    assert.deepEqual(unchanged, legacy, 'opt-in correspondence must preserve historical compiler output');
    const result = matchReactComposition(f.program, f.ownership, f.tree, f.content, [f.main]);
    assert.equal(result.review.status, 'ready', JSON.stringify(result.review));
    assert.equal(result.review.denominator, 1);
    assert.equal(result.review.matched, 1);
    assert.equal(result.review.acceptedContract, null);
    assert.deepEqual(result.references[0].specPath, sourcePaths!.find(p => p.sourcePath === '0')!.specPath);
    assert.equal(result.references[0].parent.operation.id, f.main.input.operation.id);
    assert.deepEqual(result.references[0].slotSpecPath, [0]);
    assert.deepEqual(matchReactComposition(f.program, f.ownership, f.tree, f.content, [f.main]), result);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('proved same-host implementations do not duplicate the caller child denominator', async () => {
  const f=await fixture();
  try{
    writeFileSync(path.join(f.dir,'wrapper.tsx'),`import {Box} from './components';
export function Wrapper(props:{children?:string}){return <Box {...props}/>}`);
    const program=readReactSourceProgram(f.dir,['wrapper.tsx','components.tsx'],{includeJsxDependencies:true});
    assert.deepEqual(program.problems,[]);
    const c=program.components.find(c=>c.exportName==='Wrapper')!;
    const source={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};
    f.ownership.components[0].parent='wrapper';
    f.ownership.components.unshift({id:'wrapper',source,props:{children:{kind:'object'}},roots:['']});
    const before=structuredClone(f.ownership);
    const result=matchReactComposition(program,f.ownership,f.tree,f.content,[f.main]);
    assert.equal(result.review.status,'ready',JSON.stringify(result.review));
    assert.equal(result.review.denominator,1);assert.equal(result.review.matched,1);
    assert.deepEqual(result.review.rows.map(r=>r.instanceId),['child']);
    assert.deepEqual(f.ownership,before);
    const invalid=structuredClone(f.content);invalid.problems.push('test-invalid-content');
    const refused=matchReactComposition(program,f.ownership,f.tree,invalid,[f.main]);
    assert.equal(refused.review.status,'incomplete');
    assert.equal(refused.review.rows.length,refused.review.denominator);
    const unproved=structuredClone(program);unproved.components.find(c=>c.exportName==='Wrapper')!.implementation='unresolved';
    assert.equal(matchReactComposition(unproved,f.ownership,f.tree,f.content,[f.main]).review.status,'incomplete');
  }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test('caller projection keeps the public delegated child and never emits its implementation as a second child', async () => {
  const f=await fixture();
  try{
    writeFileSync(path.join(f.dir,'action.tsx'),`import {Child} from './components';
export function Action(props:{children?:string;id?:string}){return <Child {...props}/>}`);
    const program=readReactSourceProgram(f.dir,['action.tsx','components.tsx'],{includeJsxDependencies:true});
    assert.deepEqual(program.problems,[]);
    const c=program.components.find(c=>c.exportName==='Action')!;
    const source={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};
    f.ownership.components[1].parent='action';
    f.ownership.components.splice(1,0,{id:'action',parent:'box',source,props:{children:'Save',id:'save'},roots:['0']});
    const missing=matchReactComposition(program,f.ownership,f.tree,f.content,[f.main]);
    assert.equal(missing.review.denominator,1);assert.equal(missing.review.matched,0);
    assert.deepEqual(missing.review.rows[0].problems,['react-composition-main-not-verified'],'a verified internal implementation cannot impersonate its public wrapper');
    const matched=matchReactComposition(program,f.ownership,f.tree,f.content,[{...f.main,source}]);
    assert.equal(matched.review.status,'ready');assert.equal(matched.review.matched,1);
    f.tree.style.width='240px';f.fonts.treeRevision=revisionOf(f.tree);
    const graph=projectReactCallerCompositionGraph({program,ownership:f.ownership,tree:f.tree,fonts:f.fonts,
      svg:{version:1,treeRevision:revisionOf(f.tree),status:'observed',rows:[],problems:[]},
      origin:{version:1,roots:[{path:'0',tag:'button',channels:[]}]},
      labels:{version:1,treeRevision:revisionOf(f.tree),status:'observed',rows:[],problems:[]},behaviors:[]});
    assert.equal(graph.draft.status,'generated-draft',graph.draft.problems.join(','));
    assert.equal(graph.draft.children.length,1);
    assert.equal(graph.resources.length,2);
    assert.equal(compileReactCallerNative(graph).report.components.length,2);
  }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test('unresolved children remain in coverage and cannot become a flattened successful comparison', async () => {
  const f = await fixture();
  try {
    const changes: Array<[string, (x: typeof f, mains: ReactCompositionMain[]) => void]> = [
      ['main-not-verified', (_x, mains) => { mains.length = 0; }],
      ['main-ambiguous', (_x, mains) => { mains.push(structuredClone(mains[0])); }],
      ['main-not-verified', (_x, mains) => { mains[0].source.sourceSha256 = 'f'.repeat(64); }],
      ['held-inputs-differ', (_x, mains) => { mains[0].heldProps.id = 'different'; }],
      ['observed-root-context-differs', (_x, mains) => { mains[0].styles.Main[0].color = 'rgb(0, 0, 0)'; }],
      ['main-readback-invalid', (_x, mains) => { mains[0].receipt.nodes = []; }],
      ['declared-size-not-preserved', (_x, mains) => {
        mains[0].sourceSizing = [{ channel: 'height', status: 'fixed', value: '36px', selectors: ['.height'] }];
      }],
      ['compiler-path-unavailable', (x) => { x.content.sourcePaths = []; }],
      ['content-ownership-differs', (x) => { delete x.ownership.nodes[1].createdBy; }],
    ];
    for (const [reason, change] of changes) {
      const copy = structuredClone(f), mains = [structuredClone(f.main)]; change(copy, mains);
      const result = matchReactComposition(copy.program, copy.ownership, copy.tree, copy.content, mains);
      assert.equal(result.review.status, 'incomplete', reason);
      assert.equal(result.review.denominator, 1, reason);
      assert.equal(result.review.matched, 0, reason);
      assert.equal(result.references.length, 0, reason);
      assert.ok(result.review.rows[0].problems.some(p => p.endsWith(reason)), JSON.stringify(result.review));
    }
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('composition selects exact observed inputs and context without boolean or omission coercion', async () => {
  const f = await fixture();
  try {
    const otherInputs = structuredClone(f.main);
    otherInputs.heldProps.disabled = false;
    const otherContext = structuredClone(f.main);
    otherContext.styles.Main[0].color = 'rgb(0, 0, 0)';
    for (const mains of [[otherInputs, f.main, otherContext], [otherContext, f.main, otherInputs]]) {
      const result = matchReactComposition(f.program, f.ownership, f.tree, f.content, mains);
      assert.equal(result.review.status, 'ready', JSON.stringify(result.review));
      assert.equal(result.references.length, 1);
      assert.deepEqual(result.references[0].parent, f.main.input);
    }
    for (const value of [false, true, null, { kind: 'undefined' }]) {
      const candidate = structuredClone(f.main);
      candidate.heldProps.disabled = value;
      const result = matchReactComposition(f.program, f.ownership, f.tree, f.content, [candidate]);
      assert.equal(result.review.matched, 0);
      assert.deepEqual(result.review.rows[0].problems, ['react-composition-held-inputs-differ']);
    }
    const missing = matchReactComposition(f.program, f.ownership, f.tree, f.content, [otherInputs, otherContext]);
    assert.equal(missing.review.matched, 0);
    assert.deepEqual(missing.review.rows[0].problems, ['react-composition-context-main-not-verified']);
    const ambiguous = matchReactComposition(f.program, f.ownership, f.tree, f.content,
      [otherInputs, f.main, structuredClone(f.main)]);
    assert.deepEqual(ambiguous.review.rows[0].problems, ['react-composition-main-ambiguous']);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('composition request pins its revision while preserving v1 reservations and rejecting injected mappings', () => {
  const root: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64),
    ownership: { id: '10000000-0000-4000-8000-000000000001', sha256: 'b'.repeat(64) },
    inventorySha256: 'c'.repeat(64), caseId: 'button-default', matrixRevision: revisionOf('matrix') };
  const legacy = { version: 1 as const, kind: 'react-content-comparison' as const,
    root, parentOperationId: '10000000-0000-4000-8000-000000000002',
    content: { id: '10000000-0000-4000-8000-000000000003', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  assert.equal(isReactComparisonRequest(legacy), true);
  const selected = { ...legacy, version: 2 as const, composition: { revision: revisionOf('mapping') } };
  assert.equal(isReactComparisonRequest(selected), true);
  assert.notEqual(reactComparisonReservation(selected), reactComparisonReservation(legacy));
  assert.notEqual(reactComparisonReservation({ ...selected, composition: { revision: revisionOf('changed') } }), reactComparisonReservation(selected));
  for (const invalid of [{ ...selected, composition: {} }, { ...selected, composition: { revision: 'unsealed' } },
    { ...selected, composition: { ...selected.composition, nodeId: '1:2' } }, { ...selected, references: [] },
    { ...legacy, composition: selected.composition }, { ...selected, version: 3 }]) assert.equal(isReactComparisonRequest(invalid), false);
});

test('lost text-only boundaries and invalid ownership keep the child unresolved', async () => {
  const f = await fixture();
  try {
    const changedOwnership = structuredClone(f.ownership);
    changedOwnership.components[1].source.sourceSha256 = 'f'.repeat(64);
    const invalid = matchReactComposition(f.program, changedOwnership, f.tree, f.content, [f.main]);
    assert.equal(invalid.review.status, 'incomplete');
    assert.equal(invalid.review.denominator, 1);
    assert.equal(invalid.review.rows.length, 1);
    assert.equal(invalid.references.length, 0);
    const tree = structuredClone(f.tree);
    if (tree.nodes[0].t !== 'el') throw Error('fixture child missing');
    tree.nodes[0].el.nodes = [{ t: 'text', v: 'Save' }];
    const fonts = structuredClone(f.fonts); fonts.treeRevision = revisionOf(tree); fonts.rows[0].path = [0];
    const ownership = structuredClone(f.ownership); ownership.nodes.pop();
    const content = compileObservedContent(tree, fonts, undefined, true);
    assert.equal(content.status, 'compiled-comparison-draft');
    assert.equal(content.sourcePaths!.find(p => p.sourcePath === '0')!.type, 'text');
    const result = matchReactComposition(f.program, ownership, tree, content, [f.main]);
    assert.equal(result.review.status, 'incomplete');
    assert.equal(result.review.denominator, 1);
    assert.deepEqual(result.review.rows[0].problems, ['react-composition-compiler-path-unavailable']);
    assert.equal(result.references.length, 0);
    const preserved = compileObservedContent(tree, fonts, undefined, true, ['0']);
    assert.equal(preserved.status, 'compiled-comparison-draft', preserved.problems.join(','));
    const path = preserved.sourcePaths!.find(p => p.sourcePath === '0')!;
    assert.equal(path.type, 'frame');
    let spec = preserved.component!.variants[0].spec;
    for (const index of path.specPath) spec = spec.children![index];
    assert.equal(spec.children?.[0].characters, 'Save');
    assert.equal(spec.children?.[0].fontFamily, 'Inter');
    assert.equal(spec.children?.[0].fontSize, 14);
    assert.ok(spec.fill, 'the source box keeps its background');
    const matched = matchReactComposition(f.program, ownership, tree, preserved, [f.main]);
    assert.equal(matched.review.status, 'ready', JSON.stringify(matched.review));
    assert.equal(matched.review.matched, 1);
    assert.deepEqual(matched.references[0].specPath, path.specPath);
    const translucent = structuredClone(tree);
    if (translucent.nodes[0].t !== 'el') throw Error('missing child');
    translucent.nodes[0].el.style.opacity = '0.5';
    const translucentContent = compileObservedContent(translucent, { ...fonts, treeRevision: revisionOf(translucent) }, undefined, true, ['0']);
    assert.equal(translucentContent.status, 'compiled-comparison-draft');
    let translucentSpec = translucentContent.component!.variants[0].spec;
    for (const index of path.specPath) translucentSpec = translucentSpec.children![index];
    assert.equal(translucentSpec.opacity, 0.5);
    assert.ok(translucentSpec.children![0].opacity === undefined || translucentSpec.children![0].opacity === 1,
      'anonymous text must not multiply its parent opacity');
    assert.equal(translucentSpec.children![0].fill, undefined, 'box paint must not be repeated on the text');
    const unsupported = structuredClone(tree);
    if (unsupported.nodes[0].t !== 'el') throw Error('missing child');
    unsupported.nodes[0].el.style.display = 'block';
    const blockFonts = { ...fonts, treeRevision: revisionOf(unsupported) };
    const block = compileObservedContent(unsupported, blockFonts, undefined, true, ['0']);
    assert.equal(block.status, 'compiled-comparison-draft');
    const blockPath=block.sourcePaths!.find(p=>p.sourcePath==='0'&&p.type==='frame');
    assert.ok(blockPath,'a text-only block keeps its source component box');
    unsupported.nodes[0].el.style['white-space-collapse']='preserve';
    const pre=compileObservedContent(unsupported,{...fonts,treeRevision:revisionOf(unsupported)},undefined,true,['0']);
    assert.equal(pre.status,'refused');
    assert.ok(pre.problems.some(p=>p.startsWith('ordered-text-flow-unqualified')));
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('nested main projection preserves a real source slot and refuses unsupported or substituted children', async () => {
  const f = await fixture();
  try {
    const origin: ReactStyleOrigin = { version: 1, roots: [{ path: '', tag: 'section', channels: [] },
      { path: '0', tag: 'button', channels: [] }] };
    const allRoots = projectReactRootVisual(f.program, f.ownership, f.tree, origin);
    const oneRoot = projectReactRootVisual(f.program, f.ownership, f.tree, origin, new Set(['child']));
    assert.deepEqual(oneRoot, { ...allRoots, roots: allRoots.roots.filter(r => r.instanceId === 'child') },
      'selecting one child must retain identical native output and the whole-source revision');
    const invalidParent = structuredClone(f.ownership);
    invalidParent.components[0].source.sourceSha256 = '0'.repeat(64);
    assert.equal(projectReactRootVisual(f.program, invalidParent, f.tree, origin, new Set(['child'])).roots.length, 0,
      'selection must not bypass the source identity of an unselected ancestor');
    const before = structuredClone({ program: f.program, ownership: f.ownership, tree: f.tree, origin });
    const selected = deriveReactChildRoot(f.program, f.ownership, f.tree, origin, 'child');
    assert.equal(selected.qualification, 'observed-child-root-draft');
    assert.equal(selected.draft.contract?.name, 'Child');
    assert.equal(selected.draft.contract?.anatomy.root.slot?.name, 'children');
    assert.equal(selected.draft.contract?.anatomy.root.parts, undefined, 'sample children must not become reusable anatomy');
    assert.deepEqual(selected.heldProps, f.ownership.components[1].props);
    const plan = prepareReactNativePlan({ matrix: selected,
      source: f.main.input.projection.source, operation: { ...f.main.input.operation, id: '10000000-0000-4000-8000-000000000088' } });
    assert.equal(plan.plan.component.setName, 'Child');
    assert.equal(plan.plan.component.variants.length, 1);
    assert.equal(plan.plan.acceptedContract, null);
    assert.deepEqual({ program: f.program, ownership: f.ownership, tree: f.tree, origin }, before);
    for (const id of ['box', 'unknown', '../outside'])
      assert.throws(() => deriveReactChildRoot(f.program, f.ownership, f.tree, origin, id), /nested-source-required/);
    const changed = structuredClone(f.ownership); changed.components[1].source.sourceSha256 = 'f'.repeat(64);
    assert.throws(() => deriveReactChildRoot(f.program, changed, f.tree, origin, 'child'), /projection-unavailable/);
    const blocked = structuredClone(f.tree); if (blocked.nodes[0].t !== 'el') throw Error('missing child');
    blocked.nodes[0].el.style.display = 'grid';
    assert.throws(() => deriveReactChildRoot(f.program, f.ownership, blocked, origin, 'child'), /projection-unavailable/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('nested requests have a separate stable reservation and cannot smuggle mappings into legacy requests', () => {
  const root: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64),
    ownership: { id: '10000000-0000-4000-8000-000000000001', sha256: 'b'.repeat(64) },
    inventorySha256: 'c'.repeat(64), caseId: 'card-composed', matrixRevision: revisionOf('matrix') };
  const child: ReactNativeRequest = { ...root, version: 2, selection: { instanceId: 'instance-4' } };
  const contextual: ReactNativeRequest = {...child,version:3,constraints:{operationId:'10000000-0000-4000-8000-000000000002',id:'10000000-0000-4000-8000-000000000003',inventorySha256:'d'.repeat(64)}};
  assert.ok(isReactNativeRequest(contextual));
  assert.notEqual(reactNativeReservation(contextual),reactNativeReservation(child));
  assert.equal(reactNativeReservation(contextual),reactNativeReservation({...contextual,constraints:{...contextual.constraints!,id:'10000000-0000-4000-8000-000000000004',inventorySha256:'e'.repeat(64)}}),
    'a newer inspection cannot allocate another operation behind the existing v3 journal');
  for(const invalid of [{...contextual,constraints:undefined},{...contextual,version:2},
    {...contextual,constraints:{...contextual.constraints,path:'/tmp/caller'}},
    {...contextual,constraints:{...contextual.constraints,inventorySha256:'changed'}}]) assert.equal(isReactNativeRequest(invalid),false);
  assert.ok(isReactNativeRequest(root)); assert.ok(isReactNativeRequest(child));
  assert.notEqual(reactNativeReservation(root), reactNativeReservation(child));
  assert.equal(reactNativeReservation(child), reactNativeReservation({ ...child, matrixRevision: revisionOf('updated') }));
  assert.notEqual(reactNativeReservation(child), reactNativeReservation({ ...child, selection: { instanceId: 'instance-6' } }));
  for (const invalid of [{ ...root, selection: child.selection }, { ...child, selection: {} },
    { ...child, selection: { instanceId: '../outside' } }, { ...child, selection: { instanceId: 'instance-4', nodeId: '1:2' } },
    { ...child, path: [0] }, { ...child, version: 3 }]) assert.equal(isReactNativeRequest(invalid), false);
});

test('pinned child context carries a source-proven stretch constraint without changing legacy drafts',async()=>{
  const f=await fixture();
  try {
    const tree=structuredClone(f.tree);
    Object.assign(tree.style,{width:'360px','align-items':'normal','max-height':'none'});
    if(tree.nodes[0].t!=='el')throw Error('child missing');
    const child=tree.nodes[0].el;
    Object.assign(child.style,{width:'360px',height:'36px','align-self':'auto',position:'static','box-sizing':'border-box',
      'min-width':'auto','max-width':'none','min-height':'auto','max-height':'none','aspect-ratio':'auto',
      'margin-left':'0px','margin-right':'0px','margin-top':'0px','margin-bottom':'0px','flex-grow':'0','flex-basis':'auto',transform:'none'});
    const origin:ReactStyleOrigin={version:1,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width',status:'fixed',value:'360px',selectors:['inline']},{channel:'height',status:'auto',value:'auto',selectors:[]}]},
      {path:'0',tag:'button',channels:[],sizes:['width','height'].map(channel=>({channel:channel as 'width'|'height',status:'auto' as const,value:'auto',selectors:[]}))}]};
    const context={gridConstraints:{version:1 as const,status:'observed' as const,treeRevision:revisionOf(tree),rows:[],problems:[]}};
    const legacy=deriveReactChildRoot(f.program,f.ownership,tree,origin,'child');
    const prepared=deriveReactChildRoot(f.program,f.ownership,tree,origin,'child',context);
    assert.equal(legacy.draft.contract?.anatomy.root.literals?.width,undefined);
    assert.equal(prepared.draft.contract?.anatomy.root.literals?.width,'100%');
    assert.equal(prepared.draft.native?.variants[0].spec.rootFillWidth,true);
    assert.notEqual(legacy.inputRevision,prepared.inputRevision);
    assert.deepEqual(deriveReactChildRoot(f.program,f.ownership,tree,origin,'child'),legacy);
    const autoParent=structuredClone(origin);autoParent.roots[0].sizes![0]={channel:'width',status:'auto',value:'auto',selectors:[]};
    assert.equal(reactChildContextSizing(tree,autoParent,'0',context),undefined,'measured parent width alone is not a constraint');
    const malformed=structuredClone(context);malformed.gridConstraints.treeRevision=revisionOf('different');
    assert.throws(()=>deriveReactChildRoot(f.program,f.ownership,tree,origin,'child',malformed),/evidence-changed/);
    child.style['max-width']='200px';context.gridConstraints.treeRevision=revisionOf(tree);
    assert.throws(()=>deriveReactChildRoot(f.program,f.ownership,tree,origin,'child',context),/stretch-constraints-unqualified/);
    child.style.display='grid';
    for(const key of gridConstraintChannels)child.style[key]='normal';
    const grid={...context,gridConstraints:{...context.gridConstraints,treeRevision:revisionOf(tree),rows:[{path:'0',tag:'button',
      used:Object.fromEntries(gridConstraintChannels.map(key=>[key,child.style[key]])),computed:Object.fromEntries(gridConstraintChannels.map(key=>[key,'normal']))}]}};
    assert.throws(()=>reactChildContextSizing(tree,origin,'0',grid as any),/grid-constraints-unqualified/,'used pixel tracks cannot enter the new root path');
  } finally {rmSync(f.dir,{recursive:true,force:true});}
});


test('single observed child roots retain only authenticated declared fixed dimensions', async () => {
  const f = await fixture();
  try {
    const child = (f.tree.nodes[0] as {t:'el';el:CapturedNode}).el;
    child.style.height = '36px'; child.style.width = '120px';
    const origin: ReactStyleOrigin = {version:1,roots:[{path:'0',tag:'button',channels:[],sizes:[
      {channel:'height',status:'fixed',value:'36px',selectors:['.height']},
      {channel:'width',status:'auto',value:'auto',selectors:[]},
    ]}]};
    const actual = deriveReactChildRoot(f.program,f.ownership,f.tree,origin,'child');
    assert.equal(actual.draft.contract!.anatomy.root.literals!.height,'36px');
    assert.equal(actual.draft.native!.variants[0].spec.lits!.height,36);
    assert.equal(actual.draft.native!.variants[0].spec.fixedWidth,undefined);
    assert.equal(actual.draft.native!.variants[0].spec.lits?.width,undefined);
    for (const key of ['style','className']) {
      const ownership = structuredClone(f.ownership);ownership.components[1].props[key]={kind:'object'};
      const unresolved=deriveReactChildRoot(f.program,ownership,f.tree,origin,'child');
      assert.equal(unresolved.draft.contract!.anatomy.root.literals?.height,undefined);
    }
    origin.roots[0].sizes![0].value='40px';
    const mismatched=deriveReactChildRoot(f.program,f.ownership,f.tree,origin,'child');
    assert.equal(mismatched.draft.contract!.anatomy.root.literals?.height,undefined);
  } finally {rmSync(f.dir,{recursive:true,force:true});}
});


test('runtime-owned composition requires exact complete source context and verified native identity', async () => {
  const f = await fixture(true);
  try {
    const result = matchReactComposition(f.program, f.ownership, f.tree, f.content, [f.main]);
    assert.equal(result.review.status, 'ready', JSON.stringify(result.review));
    assert.equal(result.references[0].contentMode, 'source-owned');
    assert.deepEqual(result.references[0].slotSpecPath, []);
    for (const change of [
      (main: ReactCompositionMain) => { main.sourceOwnedTrees!.Main.style['font-size'] = '16px'; },
      (main: ReactCompositionMain) => { main.sourceOwnedTrees!.Main.nodes = []; },
      (main: ReactCompositionMain) => { main.sourceOwnedTrees!.Main.svgViewport = {viewBox:[0,0,16,16],preserveAspectRatio:'xMidYMid meet'}; },
      (main: ReactCompositionMain) => { main.sourceOwnedTrees!.Main.pseudo = { '::after': { width: '10px' } }; },
    ]) {
      const main = structuredClone(f.main); change(main);
      const refused = matchReactComposition(f.program, f.ownership, f.tree, f.content, [main]);
      assert.equal(refused.review.matched, 0);
      assert.deepEqual(refused.review.rows[0].problems, ['react-composition-observed-subtree-context-differs']);
    }
    const changed = structuredClone(f.main); changed.receipt.nodes = [];
    assert.equal(matchReactComposition(f.program, f.ownership, f.tree, f.content, [changed]).review.matched, 0);
    const wrongInput = structuredClone(f.main); wrongInput.heldProps.id = 'other';
    assert.equal(matchReactComposition(f.program, f.ownership, f.tree, f.content, [wrongInput]).review.matched, 0);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
