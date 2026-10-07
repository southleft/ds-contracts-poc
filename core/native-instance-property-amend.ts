import type {ComponentData,NodeSpec} from './emit-figma-script.js';
import {canonicalJson} from './contract-provenance.js';
export interface InstancePropertyChange {variant:string;path:number[];route:Array<{name:string;type:NodeSpec['type']}>;before:NodeSpec;props:Record<string,string|boolean>}
export interface InstancePropertyAmend {before:ComponentData;changes:InstancePropertyChange[]}
/** Existing compiled ownership and rendering must be identical except for applied
 * instance properties. Runtime preflight additionally checks live types/values. */
export function planInstancePropertyAmend(before:ComponentData,after:ComponentData):InstancePropertyAmend {
 const changes:InstancePropertyChange[]=[];
 const normalized=(data:ComponentData,collect:boolean)=>{
  const copy=structuredClone(data);
  const visit=(spec:NodeSpec,variant:string,path:number[],route:InstancePropertyChange['route'])=>{
   if(spec.type==='instance'){
    if(collect){let previous=before.variants.find(v=>v.name===variant)?.spec;for(const i of path)previous=previous?.children?.[i];
     if(!previous||previous.type!=='instance')throw Error('INSTANCE_PROPERTY_AMEND_STRUCTURE_CHANGED');
     const old=previous.depProps??{},next=spec.depProps??{},props:Record<string,string|boolean>={};
     if(Object.keys(old).some(k=>!Object.hasOwn(next,k)))throw Error('INSTANCE_PROPERTY_AMEND_PROPERTY_REMOVED');
     for(const [k,v]of Object.entries(next))if(old[k]!==v){if(typeof v!=='string'&&typeof v!=='boolean')throw Error('INSTANCE_PROPERTY_AMEND_VALUE_UNSUPPORTED');props[k]=v;}
     if(Object.keys(props).length)changes.push({variant,path,route,before:structuredClone(previous),props});
    }
    delete spec.depProps;
   }
   spec.children?.forEach((c,i)=>visit(c,variant,[...path,i],[...route,{name:c.name,type:c.type}]));
  };
  if(copy.stateVariants?.length)throw Error('INSTANCE_PROPERTY_AMEND_STATE_PREVIEW_UNSUPPORTED');
  for(const v of copy.variants)visit(v.spec,v.name,[],[]);
  return copy;
 };
 if(canonicalJson(normalized(before,false))!==canonicalJson(normalized(after,true)))throw Error('INSTANCE_PROPERTY_AMEND_STRUCTURE_CHANGED');
 if(!changes.length)throw Error('INSTANCE_PROPERTY_AMEND_NO_CHANGES');
 return {before,changes};
}

/** Uses the ordinary writer's identity resolver, property setter, fingerprint,
 * and stamps. Every target is checked before any instance is modified. */
export const INSTANCE_PROPERTY_AMEND_RUNTIME=String.raw`
async function amendInstanceProperties(target,C,plan) {
  const fail=reason=>{throw new Error('INSTANCE_PROPERTY_AMEND_'+reason);};
  if(!target || (C.isSet ? target.type!=='COMPONENT_SET' : target.type!=='COMPONENT'))fail('TARGET_MISSING');
  if(target.getSharedPluginData('ds_contracts','specHash')!==specHash(plan.before))fail('PREVIOUS_SPEC_MISMATCH');
  const stamp=target.getSharedPluginData('ds_contracts','canvasFingerprint');
  if(!stamp || stamp!==dsCanvasFingerprint(target))fail('CANVAS_DRIFT');
  const variants=C.isSet?target.children:[target],expected=withStateAxis(C);
  if(variants.length!==expected.length || (C.isSet&&expected.some(v=>variants.filter(n=>n.name===v.name).length!==1)))fail('VARIANT_DOMAIN_CHANGED');
  const byVariant=new Map(C.isSet?variants.map(n=>[n.name,n]):[[expected[0].name,target]]);
  const prepared=[];
  const keyFor=(object,name)=>{const keys=Object.keys(object).filter(k=>k===name||k.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/,'')===name);if(keys.length!==1)fail('PROPERTY_AMBIGUOUS_OR_MISSING:'+name);return keys[0];};
  for(const change of plan.changes){
    let node=byVariant.get(change.variant);
    for(let i=0;i<change.path.length;i++){
      node=node.children&&node.children[change.path[i]];const want=change.route[i];
      const type={frame:'FRAME',text:'TEXT',instance:'INSTANCE',root:'COMPONENT'}[want.type];
      if(!node || !type || node.type!==type || node.name!==want.name)fail('NODE_PATH_CHANGED');
    }
    if(!node || node.type!=='INSTANCE')fail('INSTANCE_MISSING');
    const main=await node.getMainComponentAsync();if(!main)fail('MAIN_MISSING');
    const owner=main.parent&&main.parent.type==='COMPONENT_SET'?main.parent:main;
    const resolved=resolveComponentIdentity({contractId:change.before.depContractId,anchorKey:change.before.depAnchorKey,name:change.before.dep},'Property amendment',false);
    if(resolved.id!==owner.id)fail('INSTANCE_OWNER_CHANGED');
    const actual=node.componentProperties,defs=owner.componentPropertyDefinitions;
    for(const [name,value]of Object.entries(change.before.depProps||{}))if(actual[keyFor(actual,name)].value!==value)fail('PREVIOUS_PROPERTY_CHANGED:'+name);
    for(const [name,value]of Object.entries(change.props)){
      const def=defs[keyFor(defs,name)];
      if(!((def.type==='TEXT'&&typeof value==='string')||(def.type==='BOOLEAN'&&typeof value==='boolean')))fail('PROPERTY_KIND_UNSUPPORTED:'+name);
    }
    // The normal writer loads its declared fonts. Also retain the live font
    // faces when a dependency uses a font outside the parent's own text nodes.
    for(const text of node.findAll(n=>n.type==='TEXT'))for(const segment of text.getStyledTextSegments(['fontName']))await figma.loadFontAsync(segment.fontName);
    prepared.push({node,owner,props:change.props});
  }
  // Font loading can yield. Recheck the recorded canvas immediately before writes.
  if(stamp!==dsCanvasFingerprint(target))fail('CANVAS_CHANGED_DURING_PREFLIGHT');
  for(const p of prepared){
    setInstanceProps(p.node,p.props,p.owner);
    const actual=p.node.componentProperties;
    for(const [name,value]of Object.entries(p.props))if(actual[keyFor(actual,name)].value!==value)fail('PROPERTY_READBACK_MISMATCH:'+name);
  }
  if(C.isSet){
    const byName=new Map(expected.map(v=>[v.name,v]));
    const cols=new Array(Math.max(...expected.map(v=>v.col))+1).fill(0),rows=new Array(Math.max(...expected.map(v=>v.row))+1).fill(0);
    for(const node of variants){const v=byName.get(node.name);cols[v.col]=Math.max(cols[v.col],node.width);rows[v.row]=Math.max(rows[v.row],node.height);}
    for(const node of variants){const v=byName.get(node.name);node.x=PAD+cols.slice(0,v.col).reduce((s,w)=>s+w+PAD,0);node.y=PAD+rows.slice(0,v.row).reduce((s,h)=>s+h+PAD,0);}
    target.resizeWithoutConstraints(cols.reduce((a,b)=>a+b,0)+PAD*(cols.length+1),rows.reduce((a,b)=>a+b,0)+PAD*(rows.length+1));
  }
  target.setSharedPluginData('ds_contracts','specHash',specHash(C));
  dsStampFingerprints(target);
  const page=target.parent&&target.parent.type==='SECTION'?target.parent.parent:target.parent;
  if(page&&page.type==='PAGE')ensureHostSection(page,target,target.name);
  return {name:C.setName,contractId:C.contractId,nodeId:target.id,key:target.key,amended:true,rebuiltVariants:0,patchedInstances:prepared.length,preservedNodeIds:prepared.map(p=>p.node.id)};
}
`;
