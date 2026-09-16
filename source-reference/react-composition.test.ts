import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativeComparisonFixture } from '../core/native-contract-comparison-test-fixture.js';
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
import type { ReactStyleOrigin } from './react-style-origin.js';
import { reactChildContextSizing } from './react-child-context.js';
import { gridConstraintChannels } from './grid-constraints.js';
import { evidenceSha, inventoryEvidence } from './react-validation-evidence.js';
import { readReactNativeEvidence, selectReactChildRequest, selectReactNativeRequest } from './react-native-evidence.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';

async function fixture() {
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
    const main: ReactCompositionMain = { source: source('Child'), contract: native.main, heldProps: { id: 'save' },
      styles: { Main: [child.style] }, input: native.comparison.parent, receipt: native.comparison.receipt };
    return { dir, program, tree, ownership, fonts, content, main };
  } catch (error) { rmSync(dir, { recursive: true, force: true }); throw error; }
}

test('context child requests reopen pinned evidence and refuse substitution without upgrading legacy requests', async () => {
  const f = await fixture();
  try {
    const source = path.join(f.dir, 'components.tsx');
    const reference = { id: 'a'.repeat(64), files: { [source]: evidenceSha(readFileSync(source)) }, javascript: '', css: '' };
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
      ['compiler-path-unavailable', (x) => { x.content.sourcePaths = []; }],
      ['runtime-or-multiple-root-unqualified', (x) => { delete x.ownership.nodes[1].createdBy; }],
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
    assert.equal(block.status, 'refused');
    assert.ok(block.problems.some(p => p.startsWith('ordered-text-flow-unqualified')));
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
    Object.assign(tree.style,{width:'360px','align-items':'normal'});
    if(tree.nodes[0].t!=='el')throw Error('child missing');
    const child=tree.nodes[0].el;
    Object.assign(child.style,{width:'360px',height:'36px','align-self':'auto',position:'static','box-sizing':'border-box',
      'min-width':'auto','max-width':'none','min-height':'auto','max-height':'none','aspect-ratio':'auto',
      'margin-left':'0px','margin-right':'0px','margin-top':'0px','margin-bottom':'0px','flex-grow':'0','flex-basis':'auto',transform:'none'});
    const origin:ReactStyleOrigin={version:1,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width',status:'fixed',value:'360px',selectors:['inline']}]},
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
