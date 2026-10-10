/** REST dump v1.44 — the REST reader at parity with the plugin reader for the
 *  channels the first real-kit scoreboard found dropped on this route:
 *  absolute placement and fixed boxes (`abs`, unrotated RECTANGLE shapes and
 *  shape placement in free parents, the normalized constraints map), PERCENT
 *  and AUTO line heights, text decoration, the italic face, and stroke
 *  alignment.
 *
 *  The saved scoreboard dumps were produced by the old REST reader and the
 *  raw REST responses behind them were not kept, so these tests build REST
 *  node fixtures by hand (field spellings from figma/rest-api-spec and the
 *  committed REST fixtures) and, where both readers can observe the fact,
 *  draw the SAME canvas on the plugin mock and run the real
 *  extract/figma/dump.plugin.js beside the mapper. */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump, REST_DUMP_VERSION, STROKE_ALIGN_CENTER_RECEIPT, type RestNode, type RestTypeStyle } from './map.js';
import type { DumpFile, DumpNode, DumpSet } from '../types.js';

type Box = { x: number; y: number; width: number; height: number };
const SOLID = { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6, a: 1 } };

/** One canvas fact, spelled for BOTH transports. */
interface Fact {
  name: string;
  type: 'FRAME' | 'TEXT' | 'RECTANGLE';
  box: Box;
  /** Plugin spelling (MIN/MAX/STRETCH …) — REST spelling derived below. */
  constraints?: { horizontal: string; vertical: string };
  layoutPositioning?: 'ABSOLUTE';
  isMask?: boolean;
  maskType?: string;
  stroke?: { align: 'INSIDE' | 'CENTER' | 'OUTSIDE'; weight: number };
  text?: {
    characters: string;
    fontSize: number;
    face: string;
    weight: number;
    italic: boolean;
    decoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
    /** Plugin lineHeight; REST spelling derived below. */
    lineHeight: { unit: 'PIXELS' | 'PERCENT' | 'AUTO'; value?: number };
    /** What REST reports as lineHeightPx for an AUTO line height. */
    autoPx?: number;
  };
}

const REST_H: Record<string, string> = { MIN: 'LEFT', MAX: 'RIGHT', CENTER: 'CENTER', STRETCH: 'LEFT_RIGHT', SCALE: 'SCALE' };
const REST_V: Record<string, string> = { MIN: 'TOP', MAX: 'BOTTOM', CENTER: 'CENTER', STRETCH: 'TOP_BOTTOM', SCALE: 'SCALE' };

function restStyle(t: NonNullable<Fact['text']>): RestTypeStyle {
  const s: RestTypeStyle = {
    fontFamily: 'Inter',
    fontStyle: t.face,
    fontWeight: t.weight,
    fontSize: t.fontSize,
    ...(t.italic ? { italic: true } : {}),
    textDecoration: t.decoration,
  };
  if (t.lineHeight.unit === 'PIXELS') Object.assign(s, { lineHeightUnit: 'PIXELS', lineHeightPx: t.lineHeight.value });
  if (t.lineHeight.unit === 'PERCENT') {
    Object.assign(s, { lineHeightUnit: 'FONT_SIZE_%', lineHeightPercentFontSize: t.lineHeight.value, lineHeightPx: (t.lineHeight.value! * t.fontSize) / 100 });
  }
  if (t.lineHeight.unit === 'AUTO') Object.assign(s, { lineHeightUnit: 'INTRINSIC_%', lineHeightPx: t.autoPx, lineHeightPercent: 100 });
  return s;
}

function restNode(f: Fact, i: number): RestNode {
  const c = f.constraints ?? { horizontal: 'MIN', vertical: 'MIN' };
  return {
    id: `9:${i + 10}`,
    name: f.name,
    type: f.type,
    absoluteBoundingBox: f.box,
    constraints: { horizontal: REST_H[c.horizontal], vertical: REST_V[c.vertical] },
    ...(f.layoutPositioning ? { layoutPositioning: f.layoutPositioning } : {}),
    ...(f.isMask !== undefined ? { isMask: f.isMask } : {}),
    ...(f.maskType !== undefined ? { maskType: f.maskType } : {}),
    ...(f.stroke ? { strokes: [SOLID], strokeWeight: f.stroke.weight, strokeAlign: f.stroke.align } : {}),
    ...(f.text ? { characters: f.text.characters, style: restStyle(f.text) } : {}),
  };
}

function restCapture(root: { box: Box; layoutMode?: 'HORIZONTAL' }, facts: Fact[]): DumpFile {
  const variant: RestNode = {
    id: '9:2', name: 'Case=A', type: 'COMPONENT', absoluteBoundingBox: root.box,
    ...(root.layoutMode ? { layoutMode: root.layoutMode } : {}),
    children: facts.map(restNode),
  };
  const set: RestNode = {
    id: '9:1', name: 'Parity', type: 'COMPONENT_SET', children: [variant],
    componentPropertyDefinitions: { Case: { type: 'VARIANT', defaultValue: 'A', variantOptions: ['A'] } },
  };
  return mapRestToDump({ name: 'fixture', nodes: { '9:1': { document: set } } }).dump;
}

async function pluginCapture(root: { box: Box; layoutMode?: 'HORIZONTAL' }, facts: Fact[]): Promise<DumpFile> {
  const { figma: mockFigma } = createFigmaMock();
  const figma: any = mockFigma;
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async()=>{${code}})()`, context, { timeout: 20000 }) as Promise<any>;
  const c = figma.createComponent();
  c.name = 'Case=A';
  c.layoutMode = root.layoutMode ?? 'NONE';
  Object.defineProperty(c, 'absoluteBoundingBox', { value: root.box });
  for (const f of facts) {
    const n = f.type === 'TEXT' ? figma.createText() : f.type === 'RECTANGLE' ? figma.createRectangle() : figma.createFrame();
    n.name = f.name;
    if (f.isMask !== undefined) n.isMask = f.isMask;
    if (f.maskType !== undefined) n.maskType = f.maskType;
    if (f.type === 'FRAME') n.layoutMode = 'NONE';
    if (f.constraints) n.constraints = f.constraints;
    if (f.layoutPositioning) n.layoutPositioning = f.layoutPositioning;
    if (f.stroke) Object.assign(n, { strokes: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6 } }], strokeWeight: f.stroke.weight, strokeAlign: f.stroke.align });
    if (f.text) {
      Object.assign(n, {
        characters: f.text.characters,
        fontName: { family: 'Inter', style: f.text.face },
        textDecoration: f.text.decoration,
        lineHeight: f.text.lineHeight.unit === 'AUTO' ? { unit: 'AUTO' } : { unit: f.text.lineHeight.unit, value: f.text.lineHeight.value },
      });
      n.fontSize = f.text.fontSize;
    }
    c.appendChild(n);
    Object.defineProperty(n, 'absoluteBoundingBox', { value: f.box });
    Object.defineProperty(n, 'width', { value: f.box.width });
    Object.defineProperty(n, 'height', { value: f.box.height });
  }
  const set = figma.combineAsVariants([c], figma.currentPage);
  set.name = 'Parity';
  const source = readFileSync(new URL('../dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ['Parity'];`);
  // Re-realm the vm's objects so deepStrictEqual compares values, not realms.
  return JSON.parse(JSON.stringify(await run(source)));
}

const childrenOf = (dump: DumpFile): DumpNode[] => (dump as unknown as Record<string, DumpSet>).Parity.variants[0].children ?? [];
/** The channels this round brings to parity — nothing else is compared. */
const parityView = (n: DumpNode) => JSON.parse(JSON.stringify({
  abs: n.abs, shape: n.shape, strokeAlign: n.strokeAlign, strokeWeight: n.strokeWeight,
  text: n.text && { lineHeight: n.text.lineHeight, lineHeightUnit: n.text.lineHeightUnit, textDecoration: n.text.textDecoration, fontStyle: n.text.fontStyle },
}));

const FREE: { box: Box } = { box: { x: 100, y: 100, width: 200, height: 80 } };
const facts: Fact[] = [
  { name: 'Label', type: 'TEXT', box: { x: 110, y: 110, width: 60, height: 24 },
    text: { characters: 'Link', fontSize: 16, face: 'Medium Italic', weight: 500, italic: true, decoration: 'UNDERLINE', lineHeight: { unit: 'PERCENT', value: 150 } } },
  { name: 'Struck', type: 'TEXT', box: { x: 110, y: 140, width: 60, height: 20 },
    text: { characters: 'Old', fontSize: 14, face: 'Regular', weight: 400, italic: false, decoration: 'STRIKETHROUGH', lineHeight: { unit: 'PIXELS', value: 20 } } },
  { name: 'Badge', type: 'FRAME', box: { x: 284, y: 92, width: 24, height: 16 }, constraints: { horizontal: 'MAX', vertical: 'MIN' },
    stroke: { align: 'OUTSIDE', weight: 2 } },
  { name: 'Ring', type: 'FRAME', box: { x: 200, y: 110, width: 40, height: 40 }, constraints: { horizontal: 'CENTER', vertical: 'CENTER' },
    stroke: { align: 'CENTER', weight: 4 } },
  { name: 'Rule', type: 'RECTANGLE', box: { x: 100, y: 178, width: 200, height: 2 }, constraints: { horizontal: 'STRETCH', vertical: 'MAX' } },
];

test('REST and plugin readers agree on placement, line height, decoration, italic face and stroke alignment', async () => {
  const rest = childrenOf(restCapture(FREE, facts)).map(parityView);
  const plugin = childrenOf(await pluginCapture(FREE, facts)).map(parityView);
  assert.deepEqual(rest, plugin);
});

test('REST carries the values the old reader dropped, in the plugin spelling', () => {
  const dump = restCapture(FREE, facts);
  const [label, struck, badge, ring, rule] = childrenOf(dump);
  assert.deepEqual(label.text && { lineHeight: label.text.lineHeight, lineHeightUnit: label.text.lineHeightUnit, textDecoration: label.text.textDecoration, fontStyle: label.text.fontStyle },
    { lineHeight: 24, lineHeightUnit: 'PERCENT', textDecoration: 'UNDERLINE', fontStyle: 'Medium Italic' });
  assert.equal(struck.text?.textDecoration, 'STRIKETHROUGH');
  assert.equal(struck.text?.lineHeightUnit, undefined, 'PIXELS keeps its historical spelling');
  assert.deepEqual(label.abs, { x: 10, y: 10, right: 130, bottom: 46, width: 60, height: 24, constraints: { horizontal: 'LEFT', vertical: 'TOP' } });
  assert.deepEqual(badge.abs, { x: 184, y: -8, right: -8, bottom: 72, width: 24, height: 16, constraints: { horizontal: 'RIGHT', vertical: 'TOP' } });
  assert.equal(badge.strokeAlign, 'OUTSIDE');
  assert.equal(ring.strokeAlign, 'CENTER');
  assert.equal(ring.strokesIncludedInLayout, false);
  assert.deepEqual(rule.shape, { kind: 'rect', width: 200, height: 2, x: 0, y: 78, right: 0, bottom: 0, constraints: { horizontal: 'STRETCH', vertical: 'BOTTOM' } });
  assert.equal(rule.abs, undefined, 'a shape keeps its own placement channel');
  const messages = (dump._degradations ?? []).map((d) => `${d.code}|${d.nodePath}|${d.message}`);
  assert.deepEqual(messages.filter((m) => /strokeAlign|text channel|constraint/.test(m)),
    [`stroke-align-unsupported|Parity:Case=A/Ring|${STROKE_ALIGN_CENTER_RECEIPT}`]);
  const gaps = (dump._provenance as { captureGaps?: string[] }).captureGaps ?? [];
  assert.ok(!gaps.some((g) => /absolute placement|strokeAlign|constraints map/.test(g)), gaps.join('\n'));
  assert.equal(dump._provenance?.dumpVersion, REST_DUMP_VERSION);
});

test('the CENTER receipt is spelled identically by both readers', async () => {
  const plugin = await pluginCapture(FREE, facts);
  const receipt = (plugin._degradations ?? []).find((d) => d.code === 'stroke-align-unsupported');
  assert.equal(receipt?.message, STROKE_ALIGN_CENTER_RECEIPT);
});

test('AUTO line height: REST carries the drawn pixels it reports, the plugin the unit it can see', async () => {
  const auto: Fact[] = [{ name: 'Auto', type: 'TEXT', box: { x: 100, y: 100, width: 40, height: 15 },
    text: { characters: 'Auto', fontSize: 12, face: 'Medium', weight: 500, italic: false, decoration: 'NONE', lineHeight: { unit: 'AUTO' }, autoPx: 14.522727272727273 } }];
  const [rest] = childrenOf(restCapture(FREE, auto));
  const [plugin] = childrenOf(await pluginCapture(FREE, auto));
  assert.deepEqual({ lh: rest.text?.lineHeight, unit: rest.text?.lineHeightUnit }, { lh: 14.522727272727273, unit: 'AUTO' });
  assert.deepEqual({ lh: plugin.text?.lineHeight, unit: plugin.text?.lineHeightUnit }, { lh: undefined, unit: 'AUTO' });
  assert.equal(rest.text?.textDecoration, undefined);
});

test('an ABSOLUTE child of an auto-layout parent carries abs; its in-flow sibling does not', async () => {
  const row = { box: { x: 0, y: 0, width: 120, height: 40 }, layoutMode: 'HORIZONTAL' as const };
  const kids: Fact[] = [
    { name: 'Flow', type: 'FRAME', box: { x: 0, y: 0, width: 40, height: 40 } },
    { name: 'Pinned', type: 'FRAME', box: { x: 110, y: -6, width: 16, height: 16 }, layoutPositioning: 'ABSOLUTE', constraints: { horizontal: 'MAX', vertical: 'MIN' } },
  ];
  const rest = childrenOf(restCapture(row, kids));
  assert.equal(rest[0].abs, undefined);
  assert.deepEqual(rest[1].abs, { x: 110, y: -6, right: -6, bottom: 30, width: 16, height: 16, constraints: { horizontal: 'RIGHT', vertical: 'TOP' } });
  const plugin = childrenOf(await pluginCapture(row, kids));
  assert.deepEqual(rest.map((n) => JSON.parse(JSON.stringify(n.abs ?? null))), plugin.map((n) => JSON.parse(JSON.stringify(n.abs ?? null))));
});

test('REST italic: the face name counts when the flag is absent, and the flag when the weight is off the table', () => {
  const text = (style: RestTypeStyle) => {
    const variant: RestNode = { id: '9:2', name: 'Only', type: 'COMPONENT', children: [{ id: '9:3', name: 't', type: 'TEXT', characters: 'x', style }] };
    const dump = mapRestToDump({ nodes: { '9:2': { document: variant } } }).dump as unknown as Record<string, DumpSet>;
    return dump.Only.variants[0].children![0].text!.fontStyle;
  };
  assert.equal(text({ fontWeight: 600, fontStyle: 'SemiBold Italic', fontSize: 12 }), 'Semi Bold Italic');
  assert.equal(text({ fontWeight: 400, fontStyle: 'Italic', fontSize: 12 }), 'Italic');
  assert.equal(text({ fontWeight: 300, fontStyle: 'Light', italic: true, fontSize: 12 }), 'Light Italic');
  assert.equal(text({ fontWeight: 300, fontStyle: 'Light Oblique', italic: true, fontSize: 12 }), 'Light Italic');
  assert.equal(text({ fontWeight: 300, fontStyle: 'Light Italic', italic: true, fontSize: 12 }), 'Light Italic');
  assert.equal(text({ fontWeight: 500, fontStyle: 'Medium', fontSize: 12 }), 'Medium');
});

test('a constraint outside both vocabularies is omitted by name, never guessed; unknown line-height units keep a receipt', () => {
  const variant: RestNode = {
    id: '9:2', name: 'Only', type: 'COMPONENT', absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 },
    children: [
      { id: '9:3', name: 'a', type: 'FRAME', absoluteBoundingBox: { x: 5, y: 5, width: 10, height: 10 }, constraints: { horizontal: 'SIDEWAYS', vertical: 'TOP' } },
      { id: '9:4', name: 't', type: 'TEXT', characters: 'x', absoluteBoundingBox: { x: 5, y: 20, width: 10, height: 10 },
        style: { fontWeight: 400, fontSize: 10, lineHeightUnit: 'LINES', lineHeightPx: 12 } },
    ],
  };
  const { dump } = mapRestToDump({ nodes: { '9:2': { document: variant } } });
  const kids = (dump as unknown as Record<string, DumpSet>).Only.variants[0].children!;
  assert.deepEqual(kids[0].abs, { x: 5, y: 5, right: 35, bottom: 35, width: 10, height: 10 });
  assert.equal(kids[1].text?.lineHeight, undefined);
  const codes = (dump._degradations ?? []).map((d) => `${d.code}|${d.nodePath}`);
  assert.ok(codes.includes('constraint-spelling-unknown|Only:Only/a'), codes.join('\n'));
  assert.ok((dump._degradations ?? []).some((d) => d.code === 'text-channel-unsupported' && /LINES/.test(d.message)));
});

test("an instance's observed content does not carry the instance's own placement", () => {
  const variant: RestNode = {
    id: '9:2', name: 'Only', type: 'COMPONENT', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 },
    children: [{
      id: '9:3', name: 'Chip', type: 'INSTANCE', componentId: '7:1', absoluteBoundingBox: { x: 60, y: 10, width: 30, height: 20 },
      constraints: { horizontal: 'RIGHT', vertical: 'TOP' },
      children: [{ id: 'I9:3;1', name: 'Label', type: 'TEXT', characters: 'x', style: { fontWeight: 400, fontSize: 10 }, absoluteBoundingBox: { x: 64, y: 12, width: 20, height: 16 } }],
    }],
  };
  const { dump } = mapRestToDump({ nodes: { '9:2': { document: variant, components: { '7:1': { name: 'Chip' } } } } });
  const chip = (dump as unknown as Record<string, DumpSet>).Only.variants[0].children![0];
  assert.deepEqual(chip.abs, { x: 60, y: 10, right: 10, bottom: 10, width: 30, height: 20, constraints: { horizontal: 'RIGHT', vertical: 'TOP' } });
  assert.ok(chip.instanceContent, 'static content observed');
  assert.equal(chip.instanceContent!.root.abs, undefined);
  assert.deepEqual(chip.instanceContent!.root.children![0].abs, { x: 4, y: 2, right: 6, bottom: 2, width: 20, height: 16 });
});

function prototypeCapture(interactions: RestNode['interactions'], extra: Partial<RestNode> = {}) {
  const component: RestNode = {
    id: '8:1', name: 'Nullable action', type: 'COMPONENT',
    absoluteBoundingBox: { x: 0, y: 0, width: 32, height: 24 },
    interactions, ...extra,
  };
  const result = mapRestToDump({ name: 'fixture', nodes: { '8:1': { document: component } } });
  const variant = (result.dump['Nullable action'] as DumpSet).variants[0];
  return { ...result, variant };
}

test('REST retains the observed trigger of a null prototype action and receipts the unavailable action', () => {
  // Exact interaction shape observed on two Carbon Accordion variants.
  const { variant, dump, report } = prototypeCapture([{ trigger: { type: 'ON_CLICK' }, actions: [null] }]);
  assert.deepEqual(variant.reactions, [{ trigger: 'ON_CLICK' }]);
  const receipts = report.degradations.filter(d => d.code === 'prototype-action-null');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].field, 'interactions[0].actions[0]');
  assert.match(receipts[0].message, /null.*ON_CLICK.*no action or destination/);
  assert.equal(dump._degradations?.filter(d => d.code === 'prototype-action-null').length, 1);
  assert.match(dump._degradations!.find(d => d.code === 'prototype-action-null')!.message, /interactions\[0\]\.actions\[0\]/);
});

test('a null action does not discard neighboring prototype actions or invent their destination', () => {
  const { variant, report } = prototypeCapture([
    { trigger: { type: 'ON_HOVER' }, actions: [
      { type: 'NODE', navigation: 'CHANGE_TO', destinationId: '8:1', transition: { type: 'SMART_ANIMATE', duration: 0.125 } },
      null,
      { type: 'BACK', destinationId: null, transition: null },
    ] },
    { trigger: null, actions: [null] },
  ]);
  assert.deepEqual(variant.reactions, [
    { trigger: 'ON_HOVER', action: 'CHANGE_TO', destination: '8:1', destinationName: 'Nullable action', transition: 'SMART_ANIMATE', duration: 125 },
    { trigger: 'ON_HOVER' },
    { trigger: 'ON_HOVER', action: 'BACK' },
    { trigger: 'UNKNOWN' },
  ]);
  assert.deepEqual(report.degradations.filter(d => d.code === 'prototype-action-null').map(d => d.field), ['interactions[0].actions[1]', 'interactions[1].actions[0]']);
});

test('empty action lists and legacy prototype destinations keep their existing meanings', () => {
  const noActions = prototypeCapture([{ trigger: { type: 'ON_PRESS' }, actions: null }], { transitionNodeID: '8:1' });
  assert.deepEqual(noActions.variant.reactions, [{ trigger: 'ON_PRESS' }]);
  assert.equal(noActions.report.degradations.some(d => d.code === 'prototype-action-null'), false);
  const legacy = prototypeCapture(undefined, { transitionNodeID: '8:1', transitionDuration: 125.4 });
  assert.deepEqual(legacy.variant.reactions, [{ trigger: 'UNKNOWN', destination: '8:1', destinationName: 'Nullable action', duration: 125 }]);
  assert.equal(legacy.report.degradations.some(d => d.code === 'prototype-action-null'), false);
});

import {proposeFromDump} from '../../../core/propose-figma.js';
import {tokenCorpusFromJson} from '../../../core/token-corpus.js';
import {walkAnatomy, ContractSchema} from '../../../scripts/contract-schema.js';
import {emitReact} from '../../../core/emit-react.js';
test('both readers preserve explicit mask type and sibling order without guessing from names', async()=>{
 const nodes:Fact[]=[
  {name:'ordinary white rectangle',type:'RECTANGLE',box:{x:100,y:100,width:40,height:40},isMask:true,maskType:'ALPHA'},
  {name:'paint',type:'RECTANGLE',box:{x:110,y:110,width:30,height:30}},
  {name:'mask by name only',type:'RECTANGLE',box:{x:100,y:100,width:20,height:20},isMask:false,maskType:'ALPHA'},
 ];
 const before=JSON.stringify(nodes),rest=restCapture(FREE,nodes),plugin=await pluginCapture(FREE,nodes);
 assert.deepEqual(childrenOf(rest).map(n=>({name:n.name,mask:n.mask})),childrenOf(plugin).map(n=>({name:n.name,mask:n.mask})));
 assert.deepEqual(childrenOf(rest).map(n=>n.mask),[{type:'ALPHA'},undefined,undefined]);
 assert.equal(JSON.stringify(nodes),before);
});
test('mask type absence and unknown future type remain observed facts, not an ALPHA default', async()=>{
 for(const maskType of [undefined,'FUTURE-MASK','VECTOR','LUMINANCE']){
  const nodes:Fact[]=[{name:'mask',type:'RECTANGLE',box:{x:100,y:100,width:40,height:40},isMask:true,...(maskType?{maskType}:{})}];
  const expected=maskType?{type:maskType}:{};
  const rest=restCapture(FREE,nodes);
  assert.deepEqual(childrenOf(rest)[0].mask,expected);
  assert.deepEqual(childrenOf(await pluginCapture(FREE,nodes))[0].mask,expected);
  if(maskType===undefined || maskType==='FUTURE-MASK')assert.throws(()=>proposeFromDump(rest.Parity as DumpSet,
    {corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true}),/figma-mask-composition-unqualified/);
 }
});
test('observed mask ownership reaches qualified React scopes and unsupported masks cannot become ordinary paint',async()=>{
 const dump=restCapture(FREE,[
  {name:'white',type:'RECTANGLE',box:{x:100,y:100,width:40,height:40},isMask:true,maskType:'ALPHA'},
  {name:'paint',type:'RECTANGLE',box:{x:105,y:105,width:30,height:30}},
 ]);
 childrenOf(dump)[0].fill={hex:'ffffff'};
 childrenOf(dump)[1].fill={hex:'ff0000'};
 const set=dump.Parity as DumpSet,before=JSON.stringify(set);
 const proposal=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 const contract=ContractSchema.parse(proposal.contract);
 assert.deepEqual(walkAnatomy(contract).filter(w=>w.part.mask).map(w=>w.part.mask),[{type:'ALPHA',outline:'rect'}]);
 const mask=walkAnatomy(contract).find(w=>w.part.mask)!.part;
 assert.equal(mask.absoluteGeometry?.box.width,40);
 assert(mask.tokens?.['background-color'],'deferred mint paint target must remain attached');
 assert.equal(mask.tokens?.width,undefined);
 assert.equal(mask.literals?.width,undefined,'derived fallback must not compete with geometry owner');
 const sibling=walkAnatomy(contract).find(w=>w.name==='paint')!.part;
 assert.equal(sibling.absoluteGeometry?.box.x,5);
 assert.equal(sibling.absoluteGeometry?.box.y,5);
 assert.equal(sibling.absoluteGeometry?.box.width,30);
 assert(sibling.tokens?.['background-color'],'masked sibling retains its paint');
 assert.equal(sibling.tokens?.width,undefined);
 const {tokenInventoryFromJson}=await import('../../../core/tokens.js');
 const tokens={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,contracts:new Map([[contract.id,contract]]),icons:new Map()};
 const rendered=emitReact(contract,ctx);
 assert.match(rendered.tsx,/data-ds-mask-scope/,'the observed ALPHA mask must own a composite scope');
 const unsupported=structuredClone(contract);
 walkAnatomy(unsupported).find(w=>w.part.mask)!.part.mask!.type='LUMINANCE';
 assert.throws(()=>emitReact(unsupported,{...ctx,contracts:new Map([[unsupported.id,unsupported]])}),/native-luminance-transfer-unqualified/);
 const mixed=structuredClone(set);mixed.variants=[structuredClone(set.variants[0]),structuredClone(set.variants[0])];
 mixed.variants[0].name='Case=A';mixed.variants[1].name='Case=B';
 mixed.variants[0].variantProperties={Case:'A'};mixed.variants[1].variantProperties={Case:'B'};
 mixed.propertyDefinitions={...mixed.propertyDefinitions,Case:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}};
 mixed.variants[1].children![0].type='ELLIPSE';
 assert.throws(()=>proposeFromDump(mixed,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true}),/varying-mask-outline/);
 assert.equal(JSON.stringify(set),before);
});

import {restTextAppearance} from './text-appearance.js';
import {execFileSync} from 'node:child_process';

function appearanceFixture(){
 const characters='A😀\nLearn more';
 const style={fontFamily:'Source Sans Pro',fontStyle:'Regular',fontWeight:400,fontSize:14,letterSpacing:0,lineHeightUnit:'FONT_SIZE_%',lineHeightPercentFontSize:140};
 const black=[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}],blue=[{type:'SOLID',color:{r:0,g:0,b:1,a:1}}];
 const node:RestNode={id:'9:4',name:'Description',type:'TEXT',characters,style,fills:black,
  characterStyleOverrides:Array.from({length:characters.length},(_,i)=>i<4?1:2),
  styleOverrideTable:{'1':{lineHeightUnit:'INTRINSIC_%'},'2':{lineHeightUnit:'INTRINSIC_%',fills:blue} as RestTypeStyle}};
 const segments=[{start:0,end:4,fills:black},{start:4,end:characters.length,fills:blue}].map(r=>({...r,characters:characters.slice(r.start,r.end),fontName:{family:'Source Sans Pro',style:'Regular'},fontWeight:400,fontSize:14,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE'}));
 const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8');
 const capture=vm.runInNewContext(source.slice(0,source.indexOf('// Raw local geometry'))+'\ncaptureTextAppearance');
 const plugin=(rows:unknown=segments)=>JSON.parse(JSON.stringify(capture({characters,getStyledTextSegments:()=>rows})));
 return {node,segments,plugin};
}
test('complete UTF-16 appearance ranges agree across REST and embedded native capture',()=>{
 execFileSync(process.execPath,['scripts/embed-text-appearance.mjs','--check']);
 const f=appearanceFixture(),before=JSON.stringify(f.node),r=restTextAppearance(f.node);
 assert(r && 'runs'in r);assert.equal(r.runs.length,2);
 assert.deepEqual(r.runs.map(x=>[x.start,x.end,x.lineHeight,x.fill.paint.color]),[[0,4,{unit:'AUTO'},{r:0,g:0,b:0}],[4,14,{unit:'AUTO'},{r:0,g:0,b:1}]]);
 assert.equal(r.characters,'A😀\nLearn more');assert.deepEqual(f.plugin(),r);
 const c:RestNode={id:'9:2',name:'Appearance',type:'COMPONENT',children:[f.node]};
 const mapped=mapRestToDump({nodes:{'9:2':{document:c}}}).dump as unknown as Record<string,DumpSet>;
 assert.deepEqual(mapped.Appearance.variants[0].children![0].text!.sourceAppearance,r);
 assert.equal(JSON.stringify(f.node),before,'sparse source style deltas remain unchanged');
});
test('text appearance capture names incomplete, split-surrogate and unsupported evidence',()=>{
 const f=appearanceFixture();
 for(const mutate of [
  (n:RestNode)=>{n.characterStyleOverrides!.pop();},
  (n:RestNode)=>{n.characterStyleOverrides![0]=99;},
  (n:RestNode)=>{n.characterStyleOverrides![2]=2;},
  (n:RestNode)=>{(n.styleOverrideTable!['2'] as any).fills=[{type:'GRADIENT_LINEAR'}];},
  (n:RestNode)=>{delete n.style!.fontFamily;},
  (n:RestNode)=>{n.styleOverrideTable!['2'].lineHeightUnit='unknown';},
 ]){const n=structuredClone(f.node);mutate(n);const observed=restTextAppearance(n);assert(observed && 'issue'in observed,String(mutate));}
 const broken=structuredClone(f.segments);broken[1].start=5;assert.match(f.plugin(broken).issue,/range-unqualified/);
 const changed=structuredClone(f.segments);changed[0].characters='different';assert.match(f.plugin(changed).issue,/range-unqualified/);
 assert.match((restTextAppearance({...f.node,characterStyleOverrides:undefined}) as {issue:string}).issue,/range-incomplete/,'override styles without their indices cannot become uniform text');
});

test('uniform authored observations preserve one genuine segment without widening caller overrides',async()=>{
 const {inspectAuthoredTextAppearance,inspectTextAppearance}=await import('../../../core/source-text-appearance-control.js');
 const {TextAppearanceSchema,TextAppearanceOverrideSchema}=await import('../../../packages/schema/src/text-appearance.js');
 const node:RestNode={id:'10:1',name:'Uniform small caps',type:'TEXT',characters:'Source',style:{fontFamily:'Inter',fontStyle:'Regular',fontWeight:400,fontSize:14,lineHeightUnit:'PIXELS',lineHeightPx:20,letterSpacing:0,textCase:'SMALL_CAPS'},fills:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}]};
 const observed=restTextAppearance(node);assert.ok(observed&&'runs'in observed);assert.equal(observed.runs.length,1);
 assert.deepEqual(observed.runs.map(r=>[r.start,r.end]),[[0,node.characters!.length]]);
 assert.deepEqual(inspectAuthoredTextAppearance(observed),observed);assert.ok(TextAppearanceSchema.safeParse(observed).success);
 assert.throws(()=>inspectTextAppearance(observed),/unqualified/);assert.equal(TextAppearanceOverrideSchema.safeParse({prop:'appearance',choices:{source:observed}}).success,false);
 const incomplete=structuredClone(node);delete incomplete.style!.fontStyle;
 assert.match((restTextAppearance(incomplete) as {issue:string}).issue,/font-unqualified/);
});
