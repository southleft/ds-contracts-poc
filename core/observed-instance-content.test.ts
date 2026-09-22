import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRestToDump, type RestNodesResponse} from '../extract/figma/rest/map.js';
import {asMinimalChildContract,proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {staticInstanceContent} from './observed-instance-content.js';
import type {DumpNode} from '../extract/figma/types.js';

const corpus = tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}});
const layout = {layoutMode: 'HORIZONTAL', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO',
  primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', itemSpacing: 0,
  paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0};
function fixture() {
  const nodes: Record<string, unknown> = {};
  for (const [i, name] of ['Holder', 'Panel'].entries()) {
    const text = {id: `i${i};text`, name: 'Body', type: 'TEXT', characters: 'Observed body copy',
      absoluteBoundingBox: {x: 10, y: 20, width: 150 + i, height: 24},
      fills: [{type: 'SOLID', color: {r: 0.1, g: 0.2, b: 0.3}}],
      style: {fontFamily: 'Public Sans', fontWeight: 400, fontSize: 16, lineHeightPx: 24,
        lineHeightUnit: 'PIXELS', letterSpacing: 0, textAutoResize: 'WIDTH_AND_HEIGHT'}};
    const instance = {id: `i${i}`, name: 'copy', type: 'INSTANCE', componentId: 'body-main', ...layout,
      componentProperties: {Tone: {type: 'VARIANT', value: i ? 'Loud' : 'Quiet'}},
      absoluteBoundingBox: {x: 10, y: 20, width: 150 + i, height: 24}, children: [text]};
    nodes[`p${i}`] = {document: {id: `p${i}`, name, type: 'COMPONENT', ...layout,
      absoluteBoundingBox: {x: 10, y: 20, width: 150 + i, height: 24}, children: [instance]},
      components: {'body-main': {name: 'Tone=Quiet', key: 'body-main-key', componentSetId: 'body-set'}},
      componentSets: {'body-set': {name: 'Copy', key: 'body-set-key'}}, styles: {}};
  }
  return {name: 'Fixture', nodes} as unknown as RestNodesResponse;
}
function project(response = fixture()) {
  const {dump} = mapRestToDump(response, {fileKey: 'fixture'});
  return {dump, result: proposeBatchFromDump(dump, {corpus, contractIdByName: new Map(), mintUnbound: true})};
}
const child = (response: ReturnType<typeof project>, index = 0) => response.result.proposals[index].childStubs?.[0];

test('all hosts retain the same observed static child, its typography and the full observed prop domain', () => {
  const value = project();
  assert.equal(value.result.skipped.length, 0);
  assert.equal(value.result.proposals.length, 2);
  const first = child(value)!;
  assert.deepEqual(child(value, 1), first);
  assert.match(JSON.stringify(first.anatomy), /Observed body copy/);
  assert.match(JSON.stringify(first.anatomy), /font-family/);
  assert.doesNotMatch(JSON.stringify(first.anatomy), /background-color/);
  const props = first.props as Array<{name: string; type: {enum: string[]}}>;
  assert.deepEqual(props.find(p => p.name === 'tone')?.type, {enum: ['quiet', 'loud']});
  assert.match(String(first.description), /unobserved variants remain unknown/);
  assert.match(JSON.stringify(value.result.proposals[0].contract.anatomy), /"component"/);
  assert.doesNotMatch(JSON.stringify(value.result.proposals[0].contract.anatomy), /Observed body copy/);
  ContractSchema.parse(first);
});

test('conflicting later-host content cannot be frozen from the first claimant', () => {
  const response = fixture();
  response.nodes.p1!.document.children![0].children![0].characters = 'Different body';
  const value = project(response);
  assert.doesNotMatch(JSON.stringify(child(value)?.anatomy), /Observed body copy|Different body/);
  assert.ok(value.result.proposals[0].notes.some(n => n.includes('observed-instance-content-refused:conflicting-uses')));
});

test('a later host with uncaptured content refuses the shared fallback', () => {
  const response = fixture();
  delete response.nodes.p1!.document.children![0].children;
  const value = project(response);
  assert.doesNotMatch(JSON.stringify(child(value)?.anatomy), /Observed body copy/);
  assert.ok(value.result.proposals[0].notes.some(n => n.includes('observed-instance-content-refused:incomplete-census')));
});

test('dynamic text bindings and nested component internals do not become static content', () => {
  for (const nested of [false, true]) {
    const response = fixture();
    for (const row of Object.values(response.nodes)) {
      const text = row!.document.children![0].children![0];
      if (nested) text.type = 'INSTANCE';
      else text.componentPropertyReferences = {characters: 'Content#1:0'};
    }
    const value = project(response);
    assert.doesNotMatch(JSON.stringify(child(value)?.anatomy), /Observed body copy/);
    if (!nested) assert.ok(value.result.proposals[0].notes.some(n => n.includes('observed-instance-content-refused:dynamic-or-unbounded')));
  }
});

test('a parent-controlled component swap retains its binding without projecting the selected child chrome', () => {
  const response = fixture();
  for (const row of Object.values(response.nodes)) {
    const instance = row!.document.children![0];
    instance.name = 'Arbitrary supplied content';
    instance.componentPropertyReferences = {mainComponent: 'Body#1:0'};
    instance.strokes = [{type: 'SOLID', color: {r: 0, g: 0, b: 0, a: 1}}];
    instance.strokeWeight = 1;
    instance.strokeDashes = [4, 4];
  }
  const {dump, report} = mapRestToDump(response, {fileKey: 'fixture'});
  for (const name of ['Holder', 'Panel']) {
    const instance = (dump[name] as {variants: DumpNode[]}).variants[0].children![0];
    assert.equal(instance.propRefs?.mainComponent, 'Body');
    assert.equal(instance.instanceContent, undefined);
    assert.equal(instance.instanceSetKey, 'body-set-key');
  }
  assert.equal(report.degradations.some(d => d.code === 'stroke-style-unsupported'), false);
  // Ordinary static usage still exposes the unsupported stroke by name. A
  // name, paint or component identity alone must not suppress that evidence.
  for (const row of Object.values(response.nodes)) delete row!.document.children![0].componentPropertyReferences;
  const ordinary = mapRestToDump(response, {fileKey: 'fixture'});
  assert.equal(ordinary.report.degradations.filter(d => d.code === 'stroke-style-unsupported').length, 2);
});

test('an exposed text control without a captured binding cannot become an inert literal', () => {
  for (const property of ['Content#1:0', 'Content']) {
    const response = fixture();
    for (const row of Object.values(response.nodes)) {
      row!.document.children![0].componentProperties![property] = {type: 'TEXT', value: 'Observed body copy'};
    }
    const value = project(response);
    assert.doesNotMatch(JSON.stringify(child(value)?.anatomy), /"text":"Observed body copy"/);
    assert.ok(value.result.proposals[0].notes.some(n => n.includes('observed-instance-content-refused:mutable-api')));
  }
});

test('paint, typography, visibility and wrapper drift refuse across hosts', () => {
  const mutations = [
    (node: any) => { node.children[0].style.fontFamily = 'Arial'; },
    (node: any) => { node.children[0].style.fontSize = 17; },
    (node: any) => { node.children[0].style.lineHeightPx = 25; },
    (node: any) => { node.children[0].style.letterSpacing = 0.2; },
    (node: any) => { node.children[0].fills[0].color.r = 0.8; },
    (node: any) => { node.children[0].visible = false; },
    (node: any) => { node.paddingLeft = 3; },
  ];
  for (const mutate of mutations) {
    const response = fixture(); mutate(response.nodes.p1!.document.children![0]);
    const value = project(response);
    assert.doesNotMatch(JSON.stringify(child(value)?.anatomy), /Observed body copy/);
    assert.ok(value.result.proposals[0].notes.some(n => n.includes('observed-instance-content-refused:conflicting-uses')));
  }
});

test('nested static frames remain inside the separate child, while unbounded or malformed snapshots refuse', () => {
  const response = fixture();
  for (const row of Object.values(response.nodes)) {
    const instance = row!.document.children![0], text = instance.children![0];
    instance.children = [{id: text.id + '-wrapper', name: 'Content wrapper', type: 'FRAME', ...layout,
      absoluteBoundingBox: text.absoluteBoundingBox, children: [text]} as typeof text];
  }
  const value = project(response);
  assert.match(JSON.stringify(child(value)?.anatomy), /Observed body copy/);
  assert.doesNotMatch(JSON.stringify(value.result.proposals[0].contract.anatomy), /Observed body copy/);
  const nested: DumpNode = {type: 'FRAME', name: 'root', children: [{type: 'TEXT', name: 'body'}]};
  assert.equal(staticInstanceContent(nested), true);
  let head = nested;
  for (let i = 0; i < 9; i++) head = {type: 'FRAME', name: 'wrapper', children: [head]};
  assert.equal(staticInstanceContent(head), false);
  assert.equal(staticInstanceContent({type: 'FRAME', name: 'bad', children: [null as unknown as DumpNode]}), false);
  assert.equal(staticInstanceContent(undefined), false);
});

test('authoritative VARIANT types keep string boolean values as an observed enum', () => {
  const response = fixture();
  response.nodes.p0!.document.children![0].componentProperties!.Tone.value = 'false';
  response.nodes.p1!.document.children![0].componentProperties!.Tone.value = 'true';
  const value = project(response);
  const props = child(value)!.props as Array<{name: string; type: unknown}>;
  assert.deepEqual(props.find(p => p.name === 'tone')?.type, {enum: ['false', 'true']});
  assert.match(JSON.stringify(child(value)!.anatomy), /Observed body copy/);
});

test('known child definitions retain priority and a caller cannot narrow the batch census', () => {
  const seed = project(), known = structuredClone(child(seed)!);
  known.id = 'ds.known-copy'; known.anatomy = {root: {text: 'Known child definition'}};
  const result = proposeBatchFromDump(seed.dump, {corpus, mintUnbound: true, contractIdByName: new Map(),
    contractIdByKey: new Map([['body-set-key', 'ds.known-copy']]),
    contractsById: new Map([['ds.known-copy', asMinimalChildContract(known)]])});
  assert.equal(result.skipped.length, 0);
  for (const proposal of result.proposals) {
    assert.match(JSON.stringify(proposal.contract.anatomy), /ds.known-copy/);
    assert.equal(proposal.childStubs?.length ?? 0, 0);
    assert.ok(!proposal.notes.some(n => n.includes('observed-instance-content —')));
  }
  const response = fixture(); response.nodes.p1!.document.children![0].children![0].characters = 'Conflicting copy';
  const {dump} = mapRestToDump(response, {fileKey: 'fixture'});
  const first = (dump.Holder as {variants: DumpNode[]}).variants[0].children![0];
  const refused = proposeBatchFromDump(dump, {corpus, mintUnbound: true, contractIdByName: new Map(),
    instanceContentGroups: new Map([['set:body-set-key', [first]]])});
  assert.ok(refused.proposals[0].notes.some(n => n.includes('observed-instance-content-refused:conflicting-uses')));
  assert.doesNotMatch(JSON.stringify(refused.proposals[0].childStubs), /Observed body copy|Conflicting copy/);
});

test('changing batch order preserves the observed anatomy shared by both hosts', () => {
  const forward = project();
  const reverse = proposeBatchFromDump(Object.fromEntries(Object.entries(forward.dump).reverse()),
    {corpus, contractIdByName: new Map(), mintUnbound: true});
  assert.equal(reverse.skipped.length, 0);
  for (const proposal of reverse.proposals) assert.deepEqual(proposal.childStubs?.[0].anatomy, child(forward)!.anatomy);
});

test('reimport replaces an older geometry-only session stub in every fresh host envelope', () => {
  const fresh = project();
  const legacyDump = structuredClone(fresh.dump);
  const strip = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    delete (value as Record<string, unknown>).instanceContent;
    Object.values(value).forEach(strip);
  };
  strip(legacyDump);
  const legacy = proposeBatchFromDump(legacyDump, {corpus, contractIdByName: new Map(), mintUnbound: true});
  const old = legacy.proposals[0].childStubs![0];
  assert.doesNotMatch(JSON.stringify(old.anatomy), /Observed body copy/);
  // Session-registry indexes real imports by key/name; provisional stubs only
  // join the id scope for collision checks and remain lower precedence.
  const refreshed = proposeBatchFromDump(fresh.dump, {corpus, contractIdByName: new Map(), mintUnbound: true,
    contractsById: new Map([[String(old.id), asMinimalChildContract(old)]]),
    sessionClaimedIds: new Set([String(old.id)])});
  assert.equal(refreshed.skipped.length, 0);
  for (const host of refreshed.proposals) {
    assert.equal(host.childStubs?.[0].id, old.id);
    assert.match(JSON.stringify(host.childStubs?.[0].anatomy), /Observed body copy/);
    const expected = fresh.result.proposals.find(p => p.setName === host.setName)?.childStubs?.[0];
    assert.deepEqual(host.childStubs?.[0].anatomy, expected?.anatomy);
    assert.deepEqual(host.childStubs?.[0].props, expected?.props);
  }
});
