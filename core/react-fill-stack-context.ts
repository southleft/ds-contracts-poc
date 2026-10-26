import {insideRootStrokePair,insideRootStrokeTransport} from './react-instance-inside-stroke.js';
import {
  ContractSchema, absentVariantAxes, absentVariantIssues, drawnVariantIssues,
  fillStackBackdropDependent, fillStackStyleRecords, resolveAvailability, resolvePresence,
  walkAnatomy, hasComponentHostPlacement, type Contract, type Part, type Prop,
} from '../scripts/contract-schema.js';
import {resolveBooleanArguments} from './component-boolean-arguments.js';
import {componentLookupValue} from './code-values.js';
import {revisionOf} from './contract-provenance.js';
import {reactSlotInputs} from './react-slot-inputs.js';
import {childPaintOrderPlans} from '../packages/core/src/child-paint-order.js';
import {composedFillForegroundParts} from '../packages/core/src/anatomy.js';

type Scalar = string | boolean | number | undefined;
type Values = Record<string, Scalar>;
export interface ReceivedFillContextProof {
  version: 1;
  foregroundLayer?: number;
  props: string[];
  /** Null is omission, not a coerced Boolean, empty string or enum spelling. */
  tuples: Array<Array<Exclude<Scalar, undefined> | null>>;
  omittedSlots: string[];
  /** Exact generated inline transport objects, aligned with each child tuple. */
  inlineStyles: Array<Array<Record<string, string | number> | null>>;
  edges: Array<{parent: string; path: string; parentRevision: string; childRevision: string}>;
}
function fail(why: string): never {throw Error('fill-stack-react-context-' + why);}
const own = (o: object, k: string) => Object.hasOwn(o, k);
const reserved = new Set(['__proto__', 'prototype', 'constructor', '__dscFillStack', '__dscFillColor', 'undefined', 'globalThis', 'eval', 'arguments', ...'await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield'.split(' ')]);
const owns = (p: Part) => !!(p.fillStack || p.fillStackByCombination);

function scalar(prop: Prop, value: unknown): Scalar {
  if (value === undefined) {
    if (prop.required) fail('required-input-missing:' + prop.name);
    return undefined;
  }
  if (typeof prop.type === 'object' && 'enum' in prop.type) {
    if (typeof value !== 'string' || !prop.type.enum.includes(value)) fail('enum-input:' + prop.name);
    return value as string;
  }
  if (prop.type === 'boolean' && typeof value === 'boolean' || prop.type === 'text' && typeof value === 'string' ||
      prop.type === 'number' && typeof value === 'number' && Number.isFinite(value)) return value as Scalar;
  return fail('scalar-input:' + prop.name);
}
function stableInputs(c: Contract) {
  if (c.bindings.code.runtime || c.selection || c.events?.length || c.states.length || c.bindings.code.statePreviews ||
      c.props.some(p => p.bindings.code.initial || p.bindings.code.values)) fail('mutable-inputs:' + c.id);
  const names = new Set<string>(), aliases = new Set<string>();
  for (const p of c.props) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(p.bindings.code.prop) || reserved.has(p.name) || reserved.has(p.bindings.code.prop) || ['className', 'style', 'rest', 'children'].includes(p.bindings.code.prop) || names.has(p.name) || aliases.has(p.bindings.code.prop)) fail('input-identity:' + c.id);
    names.add(p.name); aliases.add(p.bindings.code.prop);
  }
}

/** Complete source domain, with the same omission/default semantics as the
 * generated parent signature. No Cartesian allocation before the bound check. */
function parentTuples(c: Contract): Values[] {
  if (drawnVariantIssues(c).length || absentVariantIssues(c).length) fail('parent-domain:' + c.id);
  const axes = absentVariantAxes(c);
  let rows: Array<Record<string, string | boolean | null>>;
  if (c.bindings.figma.drawnVariants !== undefined) rows = c.bindings.figma.drawnVariants;
  else {
    if (axes.reduce((n, a) => n * a.options.length, 1) > 4096) fail('parent-domain-too-large:' + c.id);
    rows = [{}];
    for (const axis of axes) rows = rows.flatMap(row => axis.options.map(v => ({...row, [axis.prop.name]: v})));
    rows = rows.filter(row => !(c.bindings.figma.absentVariants ?? []).some(a => Object.entries(a).every(([k, v]) => row[k] === v)));
  }
  if (!rows.length || rows.length > 4096) fail('parent-domain:' + c.id);
  return rows.map(row => Object.fromEntries(axes.map(({prop}) => [prop.name, scalar(prop, row[prop.name] === null ? prop.default : row[prop.name])])));
}
function value(values: Values, name: string): Scalar {
  if (!own(values, name)) fail('unbounded-parent-input:' + name);
  return values[name];
}

/** Matches the existing availability > visibility override > presence and
 * visibleWhen order. A Boolean override can bypass presence and visibleWhen. */
function visible(part: Part, values: Values): boolean {
  for (const table of [part.availabilityByCombination, part.presenceByCombination]) if (table) {
    const seen = new Set<string>();
    for (const row of table.rows) {
      const key = JSON.stringify(row.values);
      if (row.values.length !== table.props.length || seen.has(key)) fail('ambiguous-gate');
      seen.add(key);
    }
    table.props.forEach(name => value(values, name));
  }
  const control = part.visibilityOverrideProp ? value(values, part.visibilityOverrideProp) : undefined;
  if (control !== undefined && typeof control !== 'boolean') fail('visibility-input');
  const available = resolveAvailability(part, values);
  if (!available) {if (control !== undefined) fail('unavailable-visibility-input'); return false;}
  if (control !== undefined) return control;
  if (part.visibilityOverrideDefault !== undefined) return part.visibilityOverrideDefault;
  if (!resolvePresence(part, values)) return false;
  if (!part.visibleWhen) return true;
  const selected = value(values, part.visibleWhen.prop), equals = part.visibleWhen.equals;
  if (equals === undefined) {
    if (selected !== undefined && typeof selected !== 'boolean') fail('boolean-gate-input');
    return selected === true;
  }
  return (Array.isArray(equals) ? equals : [equals]).some(v => Object.is(v, selected));
}
function selectedInputs(parent: Contract, child: Contract, part: Part, values: Values): Values {
  const ref = part.component!;
  if (part.repeat || part.parts !== undefined || ref.text !== undefined || ref.contentSlot !== undefined || ref.contentSlots !== undefined ||
      ref.initialProps !== undefined || ref.statePreview !== undefined || ref.rootOverrides !== undefined && !insideRootStrokePair(part,child) || ref.rootFill !== undefined ||
      Object.keys(ref.overrides ?? {}).length) fail('caller-content-or-state:' + parent.id);
  const tables = [ref.booleanPropsByCombination, ref.paintPropsByCombination, ref.enumPropsByCombination, ref.textPropsByCombination];
  const known = new Set(child.props.map(p => p.name)), assigned = new Set(Object.keys(ref.props ?? {}));
  for (const table of tables) for (const [name, t] of Object.entries(table ?? {})) {
    if (assigned.has(name)) fail('conflicting-argument:' + name);
    assigned.add(name);
    t.props.forEach((name: string) => value(values, name));
    const seen = new Set<string>();
    for (const row of t.rows) {
      const key = JSON.stringify(row.values);
      if (row.values.length !== t.props.length || seen.has(key)) fail('ambiguous-argument:' + name);
      seen.add(key);
    }
  }
  if ([...assigned].some(name => !known.has(name))) fail('unknown-argument');
  const subst = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  const args = resolveBooleanArguments(child, ref, subst, parent);
  const selected: Values = {};
  for (const p of child.props) {
    let v: unknown = own(args, p.name) ? args[p.name] : undefined;
    if (v && typeof v === 'object') {
      const map = v as {prop: string; map: Record<string, string>}, source = value(values, map.prop);
      const parentProp = parent.props.find(p => p.name === map.prop);
      if (parentProp?.type === 'boolean' && Object.keys(map.map).some(key => key !== 'true' && key !== 'false')) fail('noncanonical-boolean-map');
      v = source !== undefined && own(map.map, String(source)) ? componentLookupValue(p, map.map[String(source)]) : undefined;
    } else if (typeof v === 'string') {
      const reference = own(ref.props ?? {}, p.name) ? v.match(/^\{([a-z][\w-]*)\}$/) : null;
      if (reference) v = value(values, reference[1]);
      else if (p.type === 'boolean') v = componentLookupValue(p, v);
    }
    // Required named text inputs have no signature default. A children text
    // input has separate echo/default rules and is not admitted by this proof.
    if (p.bindings.code.prop === 'children') fail('children-text-input');
    if (v === undefined && !(p.type === 'text' && p.required)) v = p.default;
    selected[p.name] = scalar(p, v);
  }
  return selected;
}
export function fillStackUnqualifiedForeground(part: Part): boolean {
  return fillStackStyleRecords(part).some(record => record !== undefined && own(record, 'z-index')) ||
    Object.values(part.parts ?? {}).some(fillStackUnqualifiedForeground);
}
function verifyReachable(child: Contract, values: Values): void {
  const visit = (part: Part) => {
    if (!visible(part, values)) return;
    if (part.component || part.repeat) fail('active-reference:' + child.id);
    // Check the active node itself; recursion below is gated, unlike the
    // conservative whole-tree predicate used without a received-context proof.
    const local = {...part, parts: undefined, slot: undefined};
    if (part !== child.anatomy.root && fillStackUnqualifiedForeground(local)) fail('foreground-stacking-unqualified');
    if (fillStackBackdropDependent(local) || fillStackStyleRecords(local).some(r =>
      Object.keys(r ?? {}).some(k => ['filter', 'isolation'].includes(k)))) fail('active-backdrop:' + child.id);
    if (part.slot) {
      // These are the emitters' actual default branches. Gated anatomy is
      // authoritative when present, even if defaultContent names a component.
      if ((part.slot.renderDefault || part.slot.renderDefaultAnatomy) && part.parts) {
        Object.values(part.parts).forEach(visit);
      } else if (part.slot.renderDefault && part.slot.defaultContent?.length) fail('active-slot-default-reference:' + child.id);
      return;
    }
    Object.values(part.parts ?? {}).forEach(visit);
  };
  visit(child.anatomy.root);
}

/** The existing rank/foreground plans are shared by both emitters. Preserve
 * their exact finite transport; other placement inputs need their own proof. */
function inlineTransport(parent: Contract, part: Part, path: string[], values: Values, contracts: ReadonlyMap<string, Contract>, tokens:unknown, transportMode:'inline'|'module'): Record<string, string | number> | null {
  if (hasComponentHostPlacement(part)) fail('positioned-transport-unqualified');
  const style: Record<string, string | number> = {};
  if (transportMode==='inline' && composedFillForegroundParts(parent, contracts).has(part)) style.position = 'relative';
  for (const plan of transportMode==='inline'?childPaintOrderPlans(parent, contracts):[]) {
    if (plan.path.join('/') !== path.slice(0, -1).join('/')) continue;
    const row = plan.rows.find(row => Object.entries(row.selection).every(([name, selected]) => String(value(values, name)) === selected));
    if (!row) fail('rank-row-missing');
    const rank = row.ranks.find(rank => rank.name === path.at(-1));
    if (!rank) fail('rank-child-missing');
    style.zIndex = rank.zIndex;
    if (rank.order !== undefined) style.order = rank.order;
  }
  const child=part.component&&contracts.get(part.component.id);
  if(child)Object.assign(style,insideRootStrokeTransport(parent,child,part,values,tokens,transportMode==='module'));
  return Object.keys(style).length ? style : null;
}

/** No universal permission: every actual source-pinned receiving edge must
 * prove all its reachable tuples. Ordinary safe receivers keep their legacy
 * path; only formerly refused descendant trees opt into this strict proof. */
export function receivedFillContextProof(child: Contract, contracts?: ReadonlyMap<string, Contract>,tokens?:unknown,transportMode:'inline'|'module'='inline',force=false): ReceivedFillContextProof | undefined {
  const root = child.anatomy.root;
  if (!root || !force && !(root.slot || root.repeat || Object.values(root.parts ?? {}).some(fillStackBackdropDependent))) return undefined;
  stableInputs(child);
  if (!ContractSchema.safeParse(child).success || root.component || root.slot || root.repeat) fail('child-structure:' + child.id);
  const slots = [...reactSlotInputs(child).map(input => input.name), ...(walkAnatomy(child).some(w => w.part.slot?.name === 'children') ? ['children'] : [])];
  const keywords = new Set(['await','break','case','catch','class','const','continue','debugger','default','delete','do','else','enum','export','extends','false','finally','for','function','if','implements','import','in','instanceof','interface','let','new','null','package','private','protected','public','return','static','super','switch','this','throw','true','try','typeof','var','void','while','with','yield']);
  if (slots.some(name => !/^[a-z][A-Za-z0-9]*$/.test(name) || keywords.has(name) || ['style','className','rest'].includes(name))) fail('slot-binding');
  for (const {part} of walkAnatomy(child)) {
    const ids = [...(part.component ? [part.component.id] : []), ...(part.slot?.defaultContent ?? []).map(item => item.id)];
    if (ids.some(id => id === child.id || !contracts?.has(id))) fail('dependency-closure');
  }
  if (slots.some(name => reserved.has(name) || child.props.some(p => p.bindings.code.prop === name))) fail('slot-input-identity');
  const proof: ReceivedFillContextProof = {version: 1, props: child.props.map(p => p.bindings.code.prop), tuples: [], omittedSlots: slots, inlineStyles: [], edges: []};
  const keys = new Set<string>();let examinedContexts = 0;
  for (const parent of contracts?.values() ?? []) for (const {part, path} of walkAnatomy(parent)) {
    if (part.component?.id !== child.id || !owns(part)&&!insideRootStrokePair(part,child)) continue;
    stableInputs(parent);
    const source = part.fillStackSource ?? (!owns(part)&&insideRootStrokePair(part,child)?{fileKey:parent.bindings.figma.anchors.fileKey,setKey:child.bindings.figma.anchors.componentSetKey,contractRevision:revisionOf(child)}:undefined);
    if (!source || source.fileKey !== parent.bindings.figma.anchors.fileKey || source.fileKey !== child.bindings.figma.anchors.fileKey ||
        source.setKey !== child.bindings.figma.anchors.componentSetKey || source.contractRevision !== revisionOf(child)) fail('source-identity');
    const chain: Part[] = [];let parts = parent.anatomy;
    for (const name of path) {const node = parts[name];if (!node) fail('source-path');chain.push(node);parts = node.parts ?? {};}
    const parentRows = parentTuples(parent);
    examinedContexts += parentRows.length;
    if (examinedContexts > 4096) fail('received-domain-too-large');
    for (const values of parentRows) {
      if (!chain.every(p => visible(p, values))) continue;
      const selected = selectedInputs(parent, child, part, values);
      verifyReachable(child, selected);
      if(child.anatomy.root.instanceRootInputs?.includes('border-color')) {
        proof.foregroundLayer=Math.max(proof.foregroundLayer??1,Object.keys(child.anatomy.root.parts??{}).length+1);
        for(const plan of childPaintOrderPlans(child,contracts)) {
          let parts=child.anatomy,active=true;
          for(const key of plan.path){const node=parts[key];if(!node||!visible(node,selected)){active=false;break;}parts=node.parts??{};}
          if(!active)continue;
          const row=plan.rows.find(row=>Object.entries(row.selection).every(([name,v])=>String(value(selected,name))===v));
          if(!row)fail('inside-stroke-rank-row-missing');
          for(const rank of row.ranks)proof.foregroundLayer=Math.max(proof.foregroundLayer,rank.zIndex+1);
        }
      }
      const transport = inlineTransport(parent, part, path, values, contracts!,tokens,transportMode);
      const row = child.props.map(p => selected[p.name] === undefined ? null : selected[p.name] as Exclude<Scalar, undefined>), key = JSON.stringify(row);
      if (!keys.has(key)) {keys.add(key);proof.tuples.push(row);proof.inlineStyles.push([]);if (proof.tuples.length > 4096) fail('received-domain-too-large');}
      const styles = proof.inlineStyles[proof.tuples.findIndex(tuple => JSON.stringify(tuple) === key)];
      if (!styles.some(style => JSON.stringify(style) === JSON.stringify(transport))) styles.push(transport);
    }
    proof.edges.push({parent: parent.id, path: path.join('/'), parentRevision: revisionOf(parent), childRevision: source.contractRevision});
  }
  if (!proof.edges.length || !proof.tuples.length) fail('no-reachable-edge:' + child.id);
  return proof;
}

export interface FillContextBindings {className?: string; style?: string; children?: string; activation?:string; allowRestStyle?:boolean; mode?:'module'|'inline'; hasRingRuntime?:boolean}
export function receivedFillContextGuard(proof: ReceivedFillContextProof, code: (name: string) => string, child: Contract, bindings: FillContextBindings): string {
  const values = child.props.map(p => code(p.name)).join(',');
  const slots = proof.omittedSlots.map(name => `${name} !== undefined`).join(' || ') || 'false';
  const children = !bindings.children || proof.omittedSlots.includes('children') ? '' : ` || ${bindings.children} !== undefined`;
  const extras = [bindings.className && `(${bindings.className} !== undefined && typeof ${bindings.className} !== 'string')`].filter(Boolean).join(' || ') || 'false';
  const styleGuard = !bindings.style ? '' : `
    const __dscFillStyle: unknown = ${bindings.style};
    const __dscFillStyles: Array<Array<Record<string, string | number> | null>> = ${JSON.stringify(proof.inlineStyles)};
    if (!__dscFillStyles[__dscFillIndex].some(expected => expected === null ? __dscFillStyle === undefined :
      __dscFillStyle !== null && typeof __dscFillStyle === 'object' &&
      (Object.getPrototypeOf(__dscFillStyle) === Object.prototype || Object.getPrototypeOf(__dscFillStyle) === null) &&
      Reflect.ownKeys(__dscFillStyle).length === Object.keys(expected).length &&
      Object.entries(expected).every(([key, value]) => { const descriptor = Object.getOwnPropertyDescriptor(__dscFillStyle, key); return descriptor?.enumerable === true && 'value' in descriptor && Object.is(descriptor.value, value); }))) throw new Error('fill-stack-received-style-unqualified');
`;
  return `  if (${bindings.activation??'__dscFillStack !== undefined || __dscFillColor !== undefined'}) {
    const __dscFillValues: unknown[] = [${values}];
    const __dscFillIndex = ${JSON.stringify(proof.tuples)}.findIndex(row => row.every((value, i) => value === null ? __dscFillValues[i] === undefined : Object.is(value, __dscFillValues[i])));
    if (__dscFillIndex < 0) throw new Error('fill-stack-received-context-unqualified');${styleGuard}
    if (${slots}${children}) throw new Error('fill-stack-received-slot-content');
    if (${bindings.allowRestStyle?"Reflect.ownKeys(rest).some(key=>key!=='style')":'Reflect.ownKeys(rest).length'} || ${extras}) throw new Error('fill-stack-received-props-unqualified');
  }
`;
}

export function insideStrokeContextPlan(child:Contract,contracts:ReadonlyMap<string,Contract>|undefined,tokens:unknown,mode:'module'|'inline',hasChildren:boolean):{guard:string;layer:number} {
 if(!child.anatomy.root.instanceRootInputs?.includes('border-color'))return {guard:'',layer:1};
 const field=mode==='module'?'rest.style':'style',width=mode==='module'?'--_stroke-width':'borderWidth',color=mode==='module'?'--_stroke-color':'borderColor';
 const activation=`(${field} as Record<string,unknown>|undefined)?.[${JSON.stringify(width)}] !== undefined || (${field} as Record<string,unknown>|undefined)?.[${JSON.stringify(color)}] !== undefined`;
 const hasEdge=[...(contracts?.values()??[])].some(parent=>walkAnatomy(parent).some(({part})=>part.component?.id===child.id&&(owns(part)||insideRootStrokePair(part,child))));
 if(!hasEdge)return {guard:`  if (${activation}) throw new Error('instance-inside-stroke-caller-unqualified');\n`,layer:1};
 const proof=receivedFillContextProof(child,contracts,tokens,mode,true)!;
 return {guard:receivedFillContextGuard(proof,name=>child.props.find(p=>p.name===name)?.bindings.code.prop??name,child,{style:field,className:mode==='module'?'className':undefined,children:hasChildren?'children':undefined,allowRestStyle:mode==='module',activation}),layer:proof.foregroundLayer??1};
}
