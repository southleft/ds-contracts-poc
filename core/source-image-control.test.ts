import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifySourceImageDemand} from './source-image-control.js';
import type {DumpSet,DumpNode,DumpImageAsset} from '../extract/figma/types.js';
const fixture=()=>{
 const leaf:DumpNode={name:'Avatar',type:'FRAME',nodeId:'2:3',imagePaints:[{index:0,imageHash:'main',scaleMode:'FILL'}]};
 const set:DumpSet={setName:'Card',type:'COMPONENT_SET',key:'set-key',variants:[{name:'Social',type:'COMPONENT',nodeId:'2:1',children:[{name:'Header',type:'FRAME',nodeId:'2:2',children:[leaf]}]}]};
 const root=structuredClone(set.variants[0]);root.nodeId='3:1';root.type='FRAME';root.children![0].nodeId='I3:1;2:2';const image=root.children![0].children![0];image.nodeId='I3:1;2:3';image.imagePaints![0].imageHash='override';
 const instance:DumpNode={name:'Card instance',type:'INSTANCE',nodeId:'3:1',instanceSetKey:'set-key',instanceGeometry:{nodeId:'3:1',componentId:'2:1',transform:[[1,0,0],[0,1,0]],localSize:{width:48,height:48}},instanceContent:{root,propertyTypes:{}}};
 const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
 const assets:Record<string,DumpImageAsset>={override:{imageHash:'override',mimeType:'image/png',base64,byteLength:Buffer.from(base64,'base64').length}};
 return {set,instance,assets};
};
test('direct descendant image demand preserves exact bytes and numeric source identity',()=>{
 const f=fixture(),before=JSON.stringify(f),d=qualifySourceImageDemand(f.set,f.instance,[0,0],'file',f.assets);
 assert.equal(d.sourceNodeId,'2:3');assert.deepEqual(d.childPath,[0,0]);assert.equal(d.instanceId,'3:1');assert.equal(d.imageHash,'override');
 assert.equal(d.image,`url('data:image/png;base64,${(f.assets.override as any).base64}')`);
 assert.equal(d.declared['background-size'],'cover');assert.equal(JSON.stringify(f),before);
});
test('image demand rejects wrong owners, same-name substitutions and nested instances',()=>{
 const edits=[
  (f:ReturnType<typeof fixture>)=>{f.instance.instanceSetKey='other';},
  (f:ReturnType<typeof fixture>)=>{f.instance.instanceGeometry!.componentId='unknown';},
  (f:ReturnType<typeof fixture>)=>{f.instance.instanceContent!.root.children![0].children![0].nodeId='I3:1;wrong';},
  (f:ReturnType<typeof fixture>)=>{f.instance.instanceContent!.root.children![0].type='INSTANCE';f.set.variants[0].children![0].type='INSTANCE';},
 ];
 for(const edit of edits){const f=fixture();edit(f);assert.throws(()=>qualifySourceImageDemand(f.set,f.instance,[0,0],'file',f.assets),/image-demand-/);}
});
test('image demand refuses absent bytes, malformed paths and unsupported paint filters',()=>{
 const f=fixture();assert.throws(()=>qualifySourceImageDemand(f.set,f.instance,[0,0],'file',{}),/original-asset-unavailable/);
 for(const p of [[],[-1],[0,0.5],[0,2]])assert.throws(()=>qualifySourceImageDemand(f.set,f.instance,p,'file',f.assets),/image-demand-/);
 f.instance.instanceContent!.root.children![0].children![0].imagePaints![0].opacity=.5;
 assert.throws(()=>qualifySourceImageDemand(f.set,f.instance,[0,0],'file',f.assets),/paint-stack-blend-opacity-or-filter/);
});

test('proposal authors finite image input on the exact source part and retains caller provenance',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {ContractSchema,walkAnatomy,absentVariantAxes}=await import('../scripts/contract-schema.js');
 const {revisionOf}=await import('./contract-provenance.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};
 const before=JSON.stringify(f),d=qualifySourceImageDemand(f.set,f.instance,[0,0],'file',f.assets);
 const assets={...f.assets,main:{...f.assets.override,imageHash:'main'}};
 const opts={fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true,imageAssets:assets,imageDemands:[d]};
 const proposal=proposeFromDump(f.set,opts),c=ContractSchema.parse(proposal.contract),bindings=proposal.imageBindings!;
 assert.equal(bindings.length,1);assert.equal(bindings[0].contractRevision,revisionOf(c));assert.deepEqual(bindings[0].input.owner.childPath,[0,0]);
 const target=walkAnatomy(c).filter(w=>w.part.imageOverride);assert.equal(target.length,1);
 const control=target[0].part.imageOverride!,prop=c.props.find(p=>p.name===control.prop)!;
 assert.equal(prop.default,undefined);assert.equal(prop.bindings.figma.kind,'NONE');assert.equal(absentVariantAxes(c).some(a=>a.prop.name===prop.name),false);
 assert.equal(control.choices.image1.image,d.image);assert.equal(bindings[0].input.callers[0].instanceNodeId,'I3:1;2:3');assert.equal(JSON.stringify(f),before);
 for(const change of [{fileKey:'wrong'},{sourceNodeId:'wrong'},{childPath:[0,1]},{instanceNodeId:'I3:1;wrong'}])assert.throws(()=>proposeFromDump(f.set,{...opts,imageDemands:[{...d,...change}]}),/image-demand-/);
});

test('batch discovers descendant image changes and routes the finite choice to its exact caller',async()=>{
 const {proposeBatchFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');const {ContractSchema,walkAnatomy}=await import('../scripts/contract-schema.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};
 f.instance.instanceOf=f.set.setName;f.instance.instanceKey=f.set.key;
 const parent:DumpSet={setName:'Parent',key:'parent-key',type:'COMPONENT',propertyDefinitions:{},variants:[{name:'Parent',type:'COMPONENT',nodeId:'4:1',variantProperties:{},children:[f.instance]}]};
 const dump={Parent:parent,Card:f.set,_imageAssets:{...f.assets,main:{...f.assets.override,imageHash:'main'}}},before=JSON.stringify(dump);
 const batch=proposeBatchFromDump(dump,{fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(batch.skipped,[]);const child=batch.proposals.find(p=>p.setName==='Card')!,host=batch.proposals.find(p=>p.setName==='Parent')!;
 assert.equal(child.imageBindings?.length,1);const binding=child.imageBindings![0],ref=walkAnatomy(ContractSchema.parse(host.contract)).find(w=>w.part.component?.id===child.contract.id)!.part.component!;
 assert.equal(ref.props?.[binding.prop],'image1');assert.equal(JSON.stringify(dump),before);
});

test('automatic image routing omits the argument for an unchanged caller variant',async()=>{
 const {proposeBatchFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');const {ContractSchema,walkAnatomy}=await import('../scripts/contract-schema.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};f.instance.instanceOf='Card';f.instance.instanceKey=f.set.key;
 const unchanged=structuredClone(f.instance);unchanged.nodeId='3:2';unchanged.instanceGeometry!.nodeId='3:2';
 const rename=(n:DumpNode)=>{n.nodeId=n.nodeId?.replace('3:1','3:2');n.children?.forEach(rename);};rename(unchanged.instanceContent!.root);unchanged.instanceContent!.root.children![0].children![0].imagePaints![0].imageHash='main';
 const parent:DumpSet={setName:'Parent',key:'parent-key',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Changed',variantOptions:['Changed','Default']}},variants:[f.instance,unchanged].map((n,i)=>({name:'Mode='+(i?'Default':'Changed'),type:'COMPONENT',nodeId:'4:'+i,variantProperties:{Mode:i?'Default':'Changed'},children:[n]}))};
 const batch=proposeBatchFromDump({Parent:parent,Card:f.set,_imageAssets:{...f.assets,main:{...f.assets.override,imageHash:'main'}}},{fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(batch.skipped,[]);const child=batch.proposals.find(p=>p.setName==='Card')!,host=batch.proposals.find(p=>p.setName==='Parent')!,prop=child.imageBindings![0].prop;
 const ref=walkAnatomy(ContractSchema.parse(host.contract)).find(w=>w.part.component?.id===child.contract.id)!.part.component!;
 assert.equal(ref.props?.[prop],undefined);assert.deepEqual(ref.enumPropsByCombination?.[prop].rows.map(r=>r.value).sort(),['image1',null].sort());
});

test('automatic image census reports unavailable originals without mutating or poisoning source mains',async()=>{
 const {imageDemandsFromDumps}=await import('./source-image-control.js');const f=fixture();
 const parent:DumpSet={setName:'Parent',type:'COMPONENT',variants:[{name:'Parent',type:'COMPONENT',children:[f.instance]}]};
 const dump={parent,child:f.set},before=JSON.stringify(dump),result=imageDemandsFromDumps(dump,'file',{});
 assert.equal(result.demands.length,0);assert(result.notes.some(n=>n.includes('original-asset-unavailable')));assert.equal(JSON.stringify(dump),before);
});
