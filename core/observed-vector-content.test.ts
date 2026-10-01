import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){
 const child=(index:number)=>({name:'Icon',type:'INSTANCE',instanceOf:'Icon',instanceKey:'main-key',instanceSetKey:'set-key',bbox:{width:24,height:24},componentProperties:{Size:'Medium'},
  instanceVectorContent:{source:[{nodeId:`use-${index}`,componentId:'main',key:'main-key'}],paint:{hex:index?'00ff00':'ff0000'},shape:{kind:'path',width:20,height:19,x:2,y:2.5,right:2,bottom:2.5,paths:[{data:'M0 0L20 0L10 19Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24}}}});
 return {Holder:{setName:'Holder',type:'COMPONENT_SET',key:'holder-key',propertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'Red',variantOptions:['Red','Green']}},variants:[0,1].map(i=>({name:`Tone=${i?'Green':'Red'}`,type:'COMPONENT',variantProperties:{Tone:i?'Green':'Red'},bbox:{width:24,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[child(i)]}))}} as any;
}
const project=(dump=fixture())=>proposeBatchFromDump(dump,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture'});
test('shares observed shape while carrying both host paints independently',()=>{
 const result=project();assert.deepEqual(result.skipped,[]);const p=result.proposals[0]!;
 const child=p.childStubs![0] as any;assert.equal(child.anatomy.root.parts.glyph.shape.paths[0].data,'M0 0L20 0L10 19Z');
 assert.deepEqual(child.anatomy.root.overridable,['color']);
 const components:any[]=[];const visit=(v:any)=>{if(!v||typeof v!=='object')return;if(v.component)components.push(v.component);Object.values(v).forEach(visit);};visit(p.contract.anatomy);assert.ok(components.some(c=>c.id===child.id&&c.overrides?.color));
 assert.match(child.description,/unobserved variants remain unknown/);
});
test('missing or conflicting later observations cannot freeze the first host',()=>{
 for(const mutate of [
  (n:any)=>delete n.instanceVectorContent,
  (n:any)=>{n.instanceVectorContent.shape.width=18;},
  (n:any)=>{n.instanceVectorContent.source[0].key='other';},
  (n:any)=>{n.componentProperties.Size=true;},
 ]){const dump=fixture();mutate(dump.Holder.variants[1].children[0]);const p=project(dump).proposals[0]!;
  assert.equal((p.childStubs![0] as any).anatomy.root.parts.glyph,undefined);
  assert.ok(p.notes.some(n=>n.includes('observed-vector-content-refused')));
 }
});

test('the proposal boundary refuses a shared path whose control hull escapes the observed leaf',()=>{
 const dump=fixture();
 for(const variant of dump.Holder.variants) variant.children[0].instanceVectorContent.shape.paths[0].data='M0 0C-1 0 20 0 10 19Z';
 const p=project(dump).proposals[0]!;
 assert.equal((p.childStubs![0] as any).anatomy.root.parts.glyph,undefined);
 assert.ok(p.notes.some(n=>n.includes('observed-vector-content-refused')));
});
