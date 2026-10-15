/** Source-pinned layout for one observed authored usage. The host is diagnostic
 * context, never a reusable component width or a fidelity qualification. */
import {canonicalJson, revisionOf} from './contract-provenance.js';
import type {ComponentData, NodeSpec} from './emit-figma-script.js';

export interface NativeObservedLayoutContext {
  version: 1;
  contractId: string;
  treeSha256: string;
  host: {width: number; height: number};
  parts: Array<{path: number[]; width?: {kind: 'percent'; value: number}; height?: {kind: 'percent'; value: number}}>;
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: object, expected: string[]) => Object.keys(v).sort().join(',') === expected.sort().join(',');
const size = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000;
const fail = (): never => {throw Error('native-observed-layout-unqualified');};

export function checkNativeObservedLayout(value: unknown, contractId?: string): asserts value is NativeObservedLayoutContext {
  if (!object(value) || !keys(value,['version','contractId','treeSha256','host','parts']) || value.version !== 1 ||
      typeof value.contractId !== 'string' || !value.contractId || contractId !== undefined && value.contractId !== contractId ||
      !/^[a-f0-9]{64}$/.test(value.treeSha256) || !object(value.host) || !keys(value.host,['width','height']) ||
      !size(value.host.width) || !size(value.host.height) || !Array.isArray(value.parts) || value.parts.length > 512) return fail();
  const seen = new Set<string>();
  for (const part of value.parts) {
    if (!object(part) || !Array.isArray(part.path) || part.path.length > 32 ||
        part.path.some((n: unknown) => !Number.isSafeInteger(n) || (n as number) < 0) ||
        !keys(part,['path',...(part.width !== undefined?['width']:[]),...(part.height !== undefined?['height']:[])]) ||
        part.width === undefined && part.height === undefined || seen.has(JSON.stringify(part.path))) fail();
    seen.add(JSON.stringify(part.path));
    for (const channel of ['width','height'] as const) {
      const percent = part[channel];
      if (percent !== undefined && (!object(percent) || !keys(percent,['kind','value']) || percent.kind !== 'percent' ||
          !size(percent.value) || percent.value > 100 || channel === 'height' && percent.value !== 100 ||
          part.path.length === 0 && percent.value !== 100)) fail();
    }
  }
}
export function observedLayoutSpec(component: ComponentData, path: number[]): NodeSpec {
  if (component.isSet || component.variants.length !== 1 || component.stateVariants?.length) return fail();
  let spec = component.variants[0].spec;
  for (const index of path) { if (!spec.children?.[index]) return fail(); spec = spec.children[index]; }
  if (!['root','frame'].includes(spec.type) || !spec.layout || !['HORIZONTAL','VERTICAL'].includes(spec.layout.mode) ||
      spec.absolute || spec.overlay || spec.insetOverlay || spec.capturedAbsoluteGeometry) return fail();
  return spec;
}
/** Only freshly compiled parent specs are annotated. Existing percentage or
 * fixed-size claims must agree; no observed pixels become literal child sizes. */
export function applyNativeObservedLayout(component: ComponentData, context: NativeObservedLayoutContext): ComponentData {
  checkNativeObservedLayout(context);
  const result = structuredClone(component);
  const root = observedLayoutSpec(result, []);
  if (root.fixedWidth || root.lits?.width !== undefined || root.pct !== undefined ||
      root.fixedHeight && root.fixedHeight.px !== context.host.height ||
      root.lits?.height !== undefined && root.lits.height !== context.host.height) fail();
  for (const part of context.parts) {
    const spec = observedLayoutSpec(result, part.path);
    if (part.path.length) observedLayoutSpec(result,part.path.slice(0,-1));
    if (part.width && part.path.length) {
      if (spec.fixedWidth || spec.lits?.width !== undefined || part.width.value !== 100 && (spec.fillW || spec.widthFill || spec.grow) ||
          spec.pct !== undefined && spec.pct !== part.width.value/100) fail();
      if (part.width.value === 100) {spec.fillW = true; delete spec.grow; delete spec.widthFill; delete spec.pct;}
      else spec.pct = part.width.value/100;
    }
    if (part.height) {
      if (spec.fixedHeight || spec.lits?.height !== undefined) fail();
      spec.fillH = true;
    }
  }
  return result;
}
export function validNativeObservedLayoutCreation(context: NativeObservedLayoutContext | undefined, creation: any): boolean {
  if (!context) return creation?.observedLayout === undefined;
  try {checkNativeObservedLayout(context);} catch {return false;}
  const host = creation?.observedLayout;
  return object(host) && keys(host,['version','revision','hostId','targetId']) && host.version === 1 &&
    host.revision === revisionOf(context) && typeof host.hostId === 'string' && host.hostId !== creation.pageId &&
    host.targetId === creation.target?.id && host.hostId !== host.targetId &&
    creation.nodes?.some((n: any) => n.id === host.hostId && n.type === 'FRAME') === true;
}

/** Runs inside the ordinary create-only transaction after graph placement. */
export function nativeObservedLayoutWrite(context: NativeObservedLayoutContext): string {
  checkNativeObservedLayout(context);
  return `
  const observedLayout = ${JSON.stringify(context)}, observedRevision = ${JSON.stringify(revisionOf(context))};
  const observedTarget = await figma.getNodeByIdAsync(NATIVE_RESULT.target.id); nativeFileGuard();
  if (!observedTarget || observedTarget.type !== 'COMPONENT' || observedTarget.parent !== NATIVE_PAGE)
    nativeRefuse('observed-layout-target');
  const observedHost = figma.createFrame();
  nativeOwn(observedHost); NATIVE_PAGE.appendChild(observedHost);
  observedHost.name = 'Observed source layout';
  observedHost.setSharedPluginData('ds_contracts','nativeObservedLayoutHost',observedRevision);
  observedHost.fills = []; observedHost.strokes = []; observedHost.effects = [];
  observedHost.opacity = 1; observedHost.visible = true; observedHost.rotation = 0; observedHost.clipsContent = false;
  observedHost.isMask = false; observedHost.blendMode = 'PASS_THROUGH';
  observedHost.layoutMode = 'VERTICAL'; observedHost.primaryAxisAlignItems = 'MIN'; observedHost.counterAxisAlignItems = 'MIN';
  observedHost.layoutWrap = 'NO_WRAP';
  observedHost.paddingLeft = 0; observedHost.paddingRight = 0; observedHost.paddingTop = 0; observedHost.paddingBottom = 0;
  observedHost.itemSpacing = 0; observedHost.primaryAxisSizingMode = 'FIXED'; observedHost.counterAxisSizingMode = 'FIXED';
  observedHost.resize(observedLayout.host.width, observedLayout.host.height);
  observedHost.x = observedTarget.x; observedHost.y = observedTarget.y;
  observedHost.appendChild(observedTarget); observedTarget.layoutPositioning = 'AUTO'; observedTarget.layoutSizingHorizontal = 'FILL';
  observedTarget.x = 0; observedTarget.y = 0;
  const observedRootPart = JSON.parse(observedTarget.getSharedPluginData('ds_contracts','nativeContractPart'));
  const observedNodes = new Map();
  for (const node of [observedTarget,...observedTarget.findAll(()=>true)]) {
    const raw = node.getSharedPluginData('ds_contracts','nativeContractPart'); if (!raw) continue;
    const part = JSON.parse(raw);
    if (part.contractRevision !== observedRootPart.contractRevision || part.variant !== observedRootPart.variant) continue;
    const key = JSON.stringify(part.specPath);
    if (observedNodes.has(key)) nativeRefuse('observed-layout-part-ambiguous');
    observedNodes.set(key,node);
  }
  const observedNode = path => {
    const node = observedNodes.get(JSON.stringify(path));
    if (!node || !['COMPONENT','FRAME'].includes(node.type) || path.length &&
        node.parent !== observedNodes.get(JSON.stringify(path.slice(0,-1)))) nativeRefuse('observed-layout-part');
    return node;
  };
  const observedParts = [...observedLayout.parts].sort((a,b)=>a.path.length-b.path.length);
  for (const part of observedParts) {
    const node = observedNode(part.path);
    node.setSharedPluginData('ds_contracts','nativeObservedLayoutPart',JSON.stringify({revision:observedRevision,path:part.path}));
    if (part.height) node.layoutSizingVertical = 'FILL';
  }
  for (const part of observedParts) if (part.width && part.path.length) {
    const node = observedNode(part.path), parent = node.parent;
    if (parent.paddingLeft !== 0 || parent.paddingRight !== 0) nativeRefuse('observed-layout-width-basis');
    if (part.width.value === 100) node.layoutSizingHorizontal = 'FILL';
    else {
      node.layoutSizingHorizontal = 'FIXED';
      node.resize(parent.width*part.width.value/100,node.height);
    }
    node.setPluginData('ds_meter','');
  }
  for (const part of observedParts) if (part.height) observedNode(part.path).layoutSizingVertical = 'FILL';
  NATIVE_RESULT.observedLayout = {version:1,revision:observedRevision,hostId:observedHost.id,targetId:observedTarget.id};
`;
}

/** Independently compare the owned host and explicitly observed percentages.
 * Main component identity and every ordinary semantic check remain in force. */
export function nativeObservedLayoutProblems(context: NativeObservedLayoutContext, creation: any, rows: Map<string, any>): string[] {
  const problems: string[] = [], host = rows.get(creation.observedLayout?.hostId), target = rows.get(creation.target?.id);
  const issue = (name: string) => problems.push('native-observed-layout-'+name);
  if (!validNativeObservedLayoutCreation(context,creation) || !host || !target) return ['native-observed-layout-identity'];
  const v = host.values, rev = revisionOf(context), eq = (a: unknown,b: number) => a === b || a === Math.fround(b);
  if (host.parentId !== creation.pageId || canonicalJson(host.childIds) !== canonicalJson([target.id]) || target.parentId !== host.id ||
      host.metadata.nativeObservedLayoutHost !== rev) issue('topology');
  if (!eq(v.width,context.host.width) || !eq(v.height,context.host.height) || v.layoutMode !== 'VERTICAL' ||
      v.primaryAxisSizingMode !== 'FIXED' || v.counterAxisSizingMode !== 'FIXED' ||
      v.primaryAxisAlignItems !== 'MIN' || v.counterAxisAlignItems !== 'MIN' || v.clipsContent !== false ||
      v.opacity !== 1 || v.visible !== true || v.rotation !== 0 ||
      v.isMask !== false || v.blendMode !== 'PASS_THROUGH' || v.layoutWrap !== 'NO_WRAP' ||
      !Array.isArray(v.reactions) || v.reactions.length !== 0 ||
      ['minWidth','maxWidth','minHeight','maxHeight'].some(k=>v[k]!==null) ||
      Object.keys(v.boundVariables??{}).length !== 0 ||
      ['paddingLeft','paddingRight','paddingTop','paddingBottom','itemSpacing'].some(k=>v[k]!==0) ||
      ['fills','strokes','effects'].some(k=>!Array.isArray(v[k])||v[k].length)) issue('host-changed');
  if (target.values.layoutSizingHorizontal !== 'FILL' || target.values.layoutPositioning !== 'AUTO' ||
      !eq(target.values.width,context.host.width) || !eq(target.values.height,context.host.height) ||
      target.values.x !== 0 || target.values.y !== 0) issue('root-changed');
  const byPart = new Map<string,any>();
  try {
    const rootPart=JSON.parse(target.metadata.nativeContractPart);
    for(const node of rows.values()){
      const raw=node.metadata.nativeContractPart;if(!raw)continue;const part=JSON.parse(raw);
      if(part.contractRevision!==rootPart.contractRevision||part.variant!==rootPart.variant)continue;
      const key=canonicalJson(part.specPath);if(byPart.has(key))return ['native-observed-layout-part-ambiguous'];byPart.set(key,node);
    }
  }catch{return ['native-observed-layout-part-identity'];}
  const at = (path: number[]) => byPart.get(canonicalJson(path));
  for (const part of context.parts) {
    const node=at(part.path), parent=node&&rows.get(node.parentId);
    if (!node || !parent || part.path.length && parent.id!==at(part.path.slice(0,-1))?.id ||
        node.metadata.nativeObservedLayoutPart !== JSON.stringify({revision:rev,path:part.path})) {issue('part-identity');continue;}
    if (part.width && part.path.length && (node.values.layoutSizingHorizontal !== (part.width.value===100?'FILL':'FIXED') ||
        !eq(node.values.width,parent.values.width*part.width.value/100))) issue('width');
    if (part.width && part.path.length && (parent.values.paddingLeft !== 0 || parent.values.paddingRight !== 0)) issue('width-basis');
    if (part.height && (parent.values.paddingTop !== 0 || parent.values.paddingBottom !== 0)) issue('height-basis');
    if (part.height && (node.values.layoutSizingVertical !== 'FILL' || !eq(node.values.height,parent.values.height))) issue('height');
  }
  const expectedParts = new Set(context.parts.map(part=>at(part.path)?.id));
  for (const node of rows.values()) {
    if (node.metadata.nativeObservedLayoutHost && node.id !== host.id) issue('unexpected-host');
    if (node.metadata.nativeObservedLayoutPart && !expectedParts.has(node.id)) issue('unexpected-part');
  }
  return problems;
}
