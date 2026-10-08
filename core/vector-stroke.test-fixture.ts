import {createHash} from 'node:crypto';
import {revisionOf} from './contract-provenance.js';
import {ContractSchema} from '../scripts/contract-schema.js';

/** Small synthetic ownership graph; no captured kit, private path or pixels. */
export function vectorStrokeSourceFixture() {
  const identity = [[1, 0, 0], [0, 1, 0]];
  const gray = {r: 0.5, g: 0.5, b: 0.5};
  const native = (nodeId: string, parentId: string, width = 40, endpoint = width, color = {r: 0, g: 0, b: 0}, opacity = 0.25): any => ({
    nodeId, type: 'VECTOR', width, height: 0, parent: {nodeId: parentId},
    visible: true, opacity: 1, blendMode: 'PASS_THROUGH', relativeTransform: structuredClone(identity),
    fills: [], effects: [], dashPattern: [], strokeAlign: 'CENTER', strokeCap: 'NONE', strokeJoin: 'MITER',
    strokeMiterLimit: 4, strokeWeight: 1,
    strokes: [{type: 'SOLID', visible: true, blendMode: 'NORMAL', opacity, color, boundVariables: {}}],
    vectorPaths: [{data: `M 0 0 L ${endpoint} 0`, windingRule: 'NONE'}],
    vectorNetwork: {vertices: [{x: 0, y: 0, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0},
      {x: endpoint, y: 0, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0}],
      segments: [{start: 0, end: 1, tangentStart: {x: 0, y: 0}, tangentEnd: {x: 0, y: 0}}], regions: []},
  });
  const modes = ['Line', 'Dash', 'Vertical', 'Empty'];
  const variants: any[] = modes.map((mode, i) => ({name: `Mode=${mode}`, nodeId: `10:${i + 1}`,
    type: 'COMPONENT', componentKey: `source-main-${i}`, variantProperties: {Mode: mode},
    bbox: {width: mode === 'Vertical' ? 0 : 40, height: mode === 'Vertical' ? 12 : 0},
    layout: {mode: 'VERTICAL', counterSizing: 'FIXED', padding: [0, 0, 0, 0]},
    children: mode === 'Empty' ? [] : [{name: 'Rule', nodeId: `10:${11 + i}`, type: 'VECTOR', sourceEmptyFill: true,
      ...(mode === 'Vertical' ? {fillHeight: true, fixedSize: {width: 0}} : {fillWidth: true, fixedSize: {height: 0}}),
      stroke: {hex: '000000', alpha: 0.25}, strokeWeight: 1, strokeAlign: 'CENTER'}],
  }));
  const sourceInstance: any = {name: 'Meter', type: 'INSTANCE', nodeId: '20:10', componentProperties: {},
    instanceSetKey: 'meter-set', instanceKey: 'source-main-0',
    instanceGeometry: {componentId: '10:1', transform: structuredClone(identity), localSize: {width: 100, height: 1}},
    hostOverrides: [{fields: ['strokes'], stroke: {hex: '808080'},
      solidStrokeTarget: {componentId: '10:1', instanceId: '20:10', childPath: [0], instancePath: []}}]};
  const dump: any = {
    _provenance: {fileKey: 'SyntheticFile', strokeSvgCapture: {sources: {version: 'synthetic-version'}}},
    Meter: {setName: 'Meter', type: 'COMPONENT_SET', nodeId: '10:0', key: 'meter-set', variants},
    Holder: {setName: 'Holder', type: 'COMPONENT_SET', nodeId: '20:0', key: 'holder-set', variants: [
      {name: 'Default', type: 'COMPONENT', nodeId: '20:1', children: [sourceInstance]}]},
    Owner: {setName: 'Owner', type: 'COMPONENT_SET', nodeId: '30:0', key: 'owner-set', variants: [
      {name: 'Default', type: 'COMPONENT', nodeId: '30:1', children: [
        {name: 'Holder', type: 'INSTANCE', nodeId: '30:10', instanceGeometry: {componentId: '20:1'}}]}]},
  };
  const hostId = 'I30:10;20:10', leafId = hostId + ';10:11';
  const hostBox = {x: 0, y: 20, width: 100, height: 1};
  const leafBox = {x: 0, y: 20.5, width: 100, height: 0};
  const paintBox = {...hostBox};
  const host: any = {type: 'INSTANCE', visible: true, opacity: 1, blendMode: 'PASS_THROUGH',
    layoutMode: 'VERTICAL', layoutPositioning: 'AUTO', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED',
    primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', paddingTop: 0, paddingRight: 0,
    paddingBottom: 0, paddingLeft: 0, fills: [], strokes: [], effects: [],
    layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED', width: 100, height: 1};
  const leaf = native(leafId, hostId, 100, 99.99999999999999, gray, 1);
  Object.assign(leaf, {layoutPositioning: 'AUTO', layoutAlign: 'STRETCH', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED'});
  leaf.relativeTransform[1][2] = 0.5;
  const rawLeaf = {id: leafId, type: 'VECTOR', absoluteBoundingBox: leafBox, absoluteRenderBounds: paintBox,
    strokes: [{type: 'SOLID', blendMode: 'NORMAL', color: structuredClone(gray), opacity: 1}], strokeWeight: 1, strokeAlign: 'CENTER',
    layoutAlign: 'STRETCH', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED'};
  const reference: any = {version: 'synthetic-version', nodes: {'30:1': {document: {id: '30:1', type: 'COMPONENT', children: [
    {id: '30:10', type: 'INSTANCE', children: [{id: hostId, type: 'INSTANCE', componentId: '10:1',
      absoluteBoundingBox: hostBox, componentProperties: {}, children: [rawLeaf]}]}]}}}};
  const mains = variants.filter(v => v.children.length).map(v => {
    const n = native(v.children[0].nodeId, v.nodeId);
    if (v.variantProperties.Mode === 'Dash') n.dashPattern = [2, 2];
    if (v.variantProperties.Mode === 'Vertical') {n.width = 0; n.height = 12;}
    return {setKey: 'meter-set', componentKey: v.componentKey, componentId: v.nodeId,
      childPath: [0], nodeId: n.nodeId, native: n};
  });
  const rawDumpText = JSON.stringify(dump);
  const payload: any = {kind: 'native-vector-stroke-capture', version: 1,
    source: {fileKey: dump._provenance.fileKey, fileVersion: reference.version, rawDumpText,
      rawDumpSha256: createHash('sha256').update(rawDumpText).digest('hex'), dumpRevision: revisionOf(dump),
      referenceRevision: revisionOf(reference)}, reference, mains,
    occurrences: [{rootId: '30:1', hostId, leafId, main: {id: '10:1', key: 'source-main-0', componentSetKey: 'meter-set'},
      host, leaf, hostTransform: structuredClone(identity), hostBox, leafBox, paintBox}]};
  return {dump, rawDumpText, capture: {...payload, captureRevision: revisionOf(payload)}};
}

export function vectorStrokeContractFixture() {
  const paint = {data: 'M 0 0 L 40 0', width: 40, height: 0, cap: 'NONE', join: 'MITER', miterLimit: 4,
    weight: 1, color: {r: 0, g: 0, b: 0}, opacity: 0.25};
  const choice = {...paint, data: 'M 0 0 L 99.99999999999999 0', width: 100, color: {r: 0.5, g: 0.5, b: 0.5}, opacity: 1};
  return ContractSchema.parse({id: 'test.meter', name: 'Meter', version: '0.1.0', status: 'draft',
    description: 'Synthetic finite source ownership, no pixel fidelity claim', semantics: {element: 'div'}, states: [],
    props: [{name: 'mode', type: {enum: ['line', 'dash', 'vertical', 'empty']}, default: 'line',
      bindings: {code: {prop: 'mode'}, figma: {kind: 'VARIANT', property: 'Mode', values: {line: 'Line', dash: 'Dash', vertical: 'Vertical', empty: 'Empty'}}}},
      {name: 'show', type: 'boolean', bindings: {code: {prop: 'showRule'}, figma: {kind: 'NONE'}}},
      {name: 'stroke', type: {enum: ['captured']}, bindings: {code: {prop: 'stroke'}, figma: {kind: 'NONE'}}}],
    anatomy: {root: {layout: {display: 'flex', direction: 'column'}, parts: {rule: {
      visibleWhen: {prop: 'mode', equals: ['line', 'dash', 'vertical']},
      visibilityOverrideProp: 'show', availabilityByCombination: {props: ['mode'], rows: ['line', 'dash', 'vertical', 'empty'].map(mode => ({values: [mode], present: mode !== 'empty'}))},
      vectorStrokeByCombination: {props: ['mode'], rows: [
        {values: ['line'], stroke: paint}, {values: ['dash'], stroke: null, refusal: 'vector-stroke-dashed-unqualified'},
        {values: ['vertical'], stroke: null, refusal: 'vector-stroke-vertical-unqualified'}]},
      vectorStrokeOverride: {prop: 'stroke', choices: {captured: choice}},
      layoutByCombination: {props: ['mode'], rows: ['line', 'dash', 'vertical'].map(mode => ({values: [mode], layout: {alignSelf: 'stretch'}}))},
    }}}}, bindings: {code: {anchors: {importPath: './Meter', export: 'Meter'}}, figma: {
      anchors: {fileKey: 'SyntheticFile', componentSetKey: 'meter-set'},
      drawnVariants: ['line', 'dash', 'vertical', 'empty'].map(mode => ({mode}))}}});
}
