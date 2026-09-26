/** Independent structural verification of compiled native paint stacks.
 * This verifies editable paint data, not browser/Figma pixel equivalence. */
import type {NodeSpec} from './emit-figma-script.js';

type Color = {r:number;g:number;b:number;a?:number};
type BoundColor = {id:string;color:Color};
const record = (v:unknown): v is Record<string,any> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v:Record<string,unknown>, allowed:string[]) => Object.keys(v).every(k=>allowed.includes(k));
const unit = (v:unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const color = (v:unknown): v is Color => record(v) && keys(v,['r','g','b','a']) &&
  ['r','g','b'].every(k=>unit(v[k])) && (v.a === undefined || unit(v.a));
const numeric = (actual:unknown, expected:number) => actual === expected || actual === Math.fround(expected);
const emptyBindings = (v:unknown) => v === undefined || (record(v) && Object.keys(v).length === 0);

export function nativePaintSpecSupported(spec:NodeSpec):boolean {
  if (!['root','frame','shape'].includes(spec.type) ||
      (spec.fill !== undefined && (typeof spec.fill !== 'string' || !spec.fill)) ||
      (spec.fill && (spec.lits?.fillColor || spec.lits?.fillClear)) ||
      (spec.lits?.fillColor && spec.lits.fillClear) ||
      (spec.lits?.fillColor !== undefined && !color(spec.lits.fillColor))) return false;
  const g=spec.gradient;
  return g === undefined || (record(g) && keys(g,['angle','stops']) && Number.isFinite(g.angle) && Number.isFinite((g.angle-90)*Math.PI/180) &&
    Array.isArray(g.stops) && g.stops.length >= 2 && g.stops.every((s,i)=>
      record(s) && keys(s,['position','color']) && unit(s.position) && color(s.color) &&
      (i === 0 || s.position >= g.stops[i-1].position)));
}

/** Resolve only from independently verified token inventories and the consuming
 * node's already verified mode selection. Never trust a paint's own RGB value. */
export function nativeBoundPaintColor(name:string, variables:unknown[], modes:Record<string,string>, collectionId:string):BoundColor|undefined {
  let variable=variables.find((v):v is Record<string,any>=>record(v) && v.name === name);
  const id=variable?.id, seen=new Set<string>();
  while (variable) {
    if (typeof variable.id !== 'string' || seen.has(variable.id) || variable.resolvedType !== 'COLOR') return;
    seen.add(variable.id);
    const mode=modes[variable.variableCollectionId ?? collectionId];
    const value=variable.valuesByMode?.[mode];
    if (record(value) && value.type === 'VARIABLE_ALIAS') {
      variable=variables.find((v):v is Record<string,any>=>record(v) && v.id === value.id);
    } else return typeof id === 'string' && color(value) ? {id,color:value} : undefined;
  }
}

export function nativePaintStackMatches(spec:NodeSpec, observed:unknown, bound?:BoundColor, aggregateBindings?:unknown):boolean {
  if (!nativePaintSpecSupported(spec) || !Array.isArray(observed)) return false;
  const base=spec.fill ? bound?.color : spec.lits?.fillColor;
  if (spec.fill && (!bound || !color(bound.color))) return false;
  if (aggregateBindings !== undefined && (!Array.isArray(aggregateBindings) ||
      (aggregateBindings.length !== 0 && (!spec.fill || aggregateBindings.length !== 1 ||
        !record(aggregateBindings[0]) || !keys(aggregateBindings[0],['type','id']) ||
        aggregateBindings[0].type !== 'VARIABLE_ALIAS' || aggregateBindings[0].id !== bound?.id)))) return false;
  if (observed.length !== Number(!!base) + Number(!!spec.gradient)) return false;
  const common = (p:unknown):p is Record<string,any> => record(p) &&
    (p.visible === undefined || p.visible === true) && (p.blendMode === undefined || p.blendMode === 'NORMAL');
  if (base) {
    const p=observed[0];
    if (!common(p) || p.type !== 'SOLID' || !keys(p,['type','color','opacity','visible','blendMode','boundVariables']) ||
        !record(p.color) || !keys(p.color,['r','g','b']) || !numeric(p.opacity === undefined ? 1 : p.opacity,base.a ?? 1) ||
        !(['r','g','b'] as const).every(k=>numeric(p.color[k],base[k]))) return false;
    if (spec.fill) {
      const b=p.boundVariables;
      if (!record(b) || !keys(b,['color']) || !record(b.color) || !keys(b.color,['type','id']) ||
          b.color.type !== 'VARIABLE_ALIAS' || b.color.id !== bound?.id) return false;
    } else if (!emptyBindings(p.boundVariables)) return false;
  }
  if (spec.gradient) {
    const p=observed[base ? 1 : 0], g=spec.gradient;
    if (!common(p) || p.type !== 'GRADIENT_LINEAR' ||
        !keys(p,['type','gradientTransform','gradientStops','opacity','visible','blendMode','boundVariables']) ||
        !numeric(p.opacity === undefined ? 1 : p.opacity,1) || !emptyBindings(p.boundVariables)) return false;
    // Independently derive the writer's normalized transform. Aspect/angle
    // fidelity and actual layer compositing still require a canvas comparison.
    const angle=(g.angle-90)*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle);
    const transform=[[c,s,(1-c-s)/2],[-s,c,(1+s-c)/2]];
    if (!Array.isArray(p.gradientTransform) || p.gradientTransform.length !== 2 ||
        !transform.every((row,i)=>Array.isArray(p.gradientTransform[i]) && p.gradientTransform[i].length === 3 &&
          row.every((value,j)=>numeric(p.gradientTransform[i][j],value))) ||
        !Array.isArray(p.gradientStops) || p.gradientStops.length !== g.stops.length) return false;
    if (!g.stops.every((stop,i)=> {
      const actual=p.gradientStops[i];
      return record(actual) && keys(actual,['position','color','boundVariables']) && emptyBindings(actual.boundVariables) &&
        numeric(actual.position,stop.position) && record(actual.color) && keys(actual.color,['r','g','b','a']) &&
        (['r','g','b','a'] as const).every(k=>numeric(actual.color[k],stop.color[k] ?? 1));
    })) return false;
  }
  return true;
}
