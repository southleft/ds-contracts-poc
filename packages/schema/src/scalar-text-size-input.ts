import type {Contract,Part} from './contract-schema.js';
const walkAnatomy=(c:Contract):Array<{part:Part;path:string[]}>=>{
 const out:Array<{part:Part;path:string[]}>=[];const visit=(part:Part,path:string[])=>{out.push({part,path});for(const [key,child]of Object.entries(part.parts??{}))visit(child,[...path,key]);};
 for(const [key,part]of Object.entries(c.anatomy))visit(part,[key]);return out;
};
const prefix=(a:string[],b:string[])=>a.length<=b.length&&a.every((key,i)=>key===b[i]);
/** A moved sibling can change ancestor placement, but not an independently
 * allocated local child basis. Broader/parent-bound geometry stays refused. */
function independentGeometry(c:Contract,target:string[]):boolean{
 const all=walkAnatomy(c);
 for(const row of all){const p=row.part;
  if(p.instanceAffine||p.instanceAffineByProp||p.absoluteGeometry||p.absoluteGeometryByCombination||p.absolutePlacement||p.absolutePlacementByCombination)return false;
  if(!p.instanceAffineLayout)continue;
  if(prefix(target,row.path)||prefix(row.path,target))return false;
  const parentPath=row.path.slice(0,-1),parent=all.find(x=>JSON.stringify(x.path)===JSON.stringify(parentPath))?.part;
  if(!parent||prefix(parentPath,target)||Object.keys(parent).some(k=>!['element','layout','visibleWhen','presenceByCombination','parts'].includes(k))||
     Object.keys(parent.parts??{}).length!==1||!parent.layout||!['flex','inline-flex'].includes(parent.layout.display??'')||
     Object.keys(parent.layout).some(k=>!['display','direction'].includes(k))||
     Object.keys(p).some(k=>!['component','instanceAffineLayout','visibleWhen','presenceByCombination'].includes(k)))return false;
  for(const r of p.instanceAffineLayout.rows){const g=r.geometry;
   if(Object.hasOwn(g,'parentSize')||r.fill.width!==false||r.fill.height!==false||!Number.isFinite(g.localSize.width)||g.localSize.width<=0||!Number.isFinite(g.localSize.height)||g.localSize.height<=0)return false;
  }
 }return true;
}

/** A whole-node scalar operation expressed with existing literal tables.
 * This does not admit arbitrary code-only enums or rich-text ranges. */
export function scalarTextSizeInput(c:Contract,name:string):{part:Part;path:string[];choices:Record<string,{fontSize:number;lineHeight:number}>}|undefined{
 const prop=c.props.find(p=>p.name===name);
 if(!prop||prop.default!==undefined||prop.required||prop.bindings.figma.kind!=='NONE'||prop.bindings.code.prop!==name||
    typeof prop.type!=='object'||!('enum'in prop.type)||!prop.type.enum.length||prop.type.enum.length>32||new Set(prop.type.enum).size!==prop.type.enum.length)return;
 const options=prop.type.enum;
 const entries=walkAnatomy(c).flatMap(w=>(w.part.literalsByProp??[]).filter(e=>e.prop===name).map(entry=>({...w,entry})));
 if(entries.length!==1)return;
 const {part,path,entry}=entries[0];
 if(path.length<2||typeof part.text!=='string'||!part.text.length||part.content||part.parts||part.slot||part.repeat||part.component||part.icon||part.shape||part.mask||
    part.textByProp||part.textByCombination||part.textAppearanceOverride||part.textAppearanceByCombination||part.textColorOverrideProp||
    part.tokensByProp||part.tokensByCombination||part.literalsByCombination||part.stylesWhen||part.states||part.statesByProp||
    (part.literalsByProp?.length??0)!==1)return;
 const keys=Object.keys(entry.map);
 if(keys.length!==options.length||keys.some(k=>!options.includes(k)))return;
 const px=(v:unknown,max:number)=>typeof v==='string'&&/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(v)&&Number(v.slice(0,-2))>0&&Number(v.slice(0,-2))<=max?Number(v.slice(0,-2)):undefined;
 const choices:Record<string,{fontSize:number;lineHeight:number}>={};
 for(const key of keys){const row=entry.map[key];if(Object.keys(row).sort().join(',')!=='font-size,line-height')return;
  const fontSize=px(row['font-size'],2048),lineHeight=px(row['line-height'],8192);if(fontSize===undefined||lineHeight===undefined)return;
  choices[key]={fontSize,lineHeight};
 }
 // No hidden second use of the enum may acquire scalar-input authority.
 const used=(v:unknown):boolean=>{
  if(v===prop||v===entry)return false;
  if(typeof v==='string')return v===name||v.includes('{'+name+'}');
  if(Array.isArray(v))return v.some(used);
  if(v&&typeof v==='object')return Object.entries(v).some(([k,x])=>k===name||used(x));
  return false;
 };
 if(used(c)||!independentGeometry(c,path))return;
 return {part,path,choices};
}
