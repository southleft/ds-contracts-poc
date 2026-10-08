import {aliasTarget,flattenTokens,makeResolveLiteral,type TokenTreeInput} from './tokens.js';

/** An outer shadow is painted behind the border box, independently of its fill.
 * Inset shadows, unresolved values and contextual CSS remain unqualified. */
export function literalOuterShadow(value:unknown):boolean {
 if(typeof value!=='string')return false;
 if(value.trim()==='none')return true;
 const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
 const length=`(${number}px|0)`;
 const color=`(?:#(?:[a-f\\d]{3,4}|[a-f\\d]{6}|[a-f\\d]{8})|rgba?\\([^()]+\\))`;
 const layer=new RegExp(`^${length}\\s+${length}(?:\\s+${length})?(?:\\s+${length})?\\s+${color}$`,'i');
 const layers=value.split(/,(?![^()]*\))/);
 return layers.length>0&&layers.every(v=>{const m=layer.exec(v.trim());const rgb=/rgba?\(([^()]*)\)/i.exec(v);if(rgb){const fields=rgb[1].split(',').map(x=>x.trim());const rgba=/rgba\(/i.test(v);if(fields.length!==(rgba?4:3)||fields.some(x=>!new RegExp('^'+number+'$').test(x))||fields.some((x,i)=>Number(x)<0||Number(x)>(i===3?1:255)))return false;}return !!m&&m.slice(1,5).filter(x=>x!==undefined).every(x=>Number.isFinite(parseFloat(x)))&&(m[3]===undefined||parseFloat(m[3])>=0);});
}
export function outerShadowInTokens(value:string,tokens?:unknown):boolean {
 const target=aliasTarget(value);if(!target)return literalOuterShadow(value);
 // Proposal callers know the captured context; emitters pass complete trees.
 if(typeof tokens==='function'){try{return literalOuterShadow(tokens(target));}catch{return false;}}
 const t=tokens as TokenTreeInput|undefined;if(!t?.primitives)return false;
 const flat=(tree:Record<string,unknown>|undefined)=>flattenTokens(tree??{});
 const brands=Object.values(t.brands??{});if(!brands.length)brands.push({});
 return brands.every(brand=>[t.light,t.dark].every(mode=>{
  try {return literalOuterShadow(makeResolveLiteral(new Map([...flat(t.primitives),...flat(t.brands?.default),...flat(brand),...flat(t.semantic),...flat(mode)]))(target));}catch{return false;}
 }));
}
