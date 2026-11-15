import assert from 'node:assert/strict';
import test from 'node:test';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function proposal(absolute:boolean, mixed=false){
 const variant=(size:string,height:number)=>({name:'size='+size,type:'COMPONENT',bbox:{width:100,height},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:mixed && size==='large'?'FIXED':'AUTO',counterSizing:'FIXED'},children:[{name:'Content',type:'FRAME',fill:{hex:'333333'},fixedSize:{width:100,height},...(absolute?{abs:{x:0,y:0,right:0,bottom:0,width:100,height,constraints:{horizontal:'LEFT',vertical:'TOP'}}}:{})}]});
 return proposeFromDump({setName:'MeasuredTrack',type:'COMPONENT_SET',propertyDefinitions:{size:{type:'VARIANT',defaultValue:'small',variantOptions:['small','large']}},variants:[variant('small',6),variant('large',12)]} as any,{corpus,contractIdByName:new Map(),projectionMode:'reviewable-inversion',mintUnbound:true});
}
test('absolute-only HUG roots retain their measured minimum and keep HUG semantics',()=>{
 const p=proposal(true),c=ContractSchema.parse(p.contract);
 assert.equal(c.anatomy.root.literals?.height,'fit-content');
 assert.ok(c.anatomy.root.tokens?.['min-height']);
 const entries=p.mintedTokens?.entries.filter(e=>e.usageSites.some(site=>site.includes('min-height')));
 assert.ok(entries?.some(e=>e.value==='6px'));
 assert.ok(entries?.some(e=>e.value==='12px'));
});
test('ordinary in-flow HUG content does not acquire a frozen minimum',()=>{
 const c=ContractSchema.parse(proposal(false).contract);
 assert.equal(c.anatomy.root.literals?.height,'fit-content');
 assert.equal(c.anatomy.root.tokens?.['min-height'],undefined);
});

test('mixed FIXED/HUG planes receive a minimum only on the absolute HUG plane',()=>{
 const p=proposal(true,true),c=ContractSchema.parse(p.contract);
 assert.ok(c.anatomy.root.tokens?.height);
 assert.ok(c.anatomy.root.tokens?.['min-height']);
 const entries=p.mintedTokens?.entries.filter(e=>e.usageSites.some(site=>site.includes('min-height')));
 assert.ok(entries?.some(e=>e.value==='6px'));
 assert.ok(entries?.some(e=>e.value==='0px'));
 assert.ok(!entries?.some(e=>e.value==='12px'));
});

test('profile convention empty-hug-keeps-extent: a HUG root plane with no visible children keeps its drawn extent as its minimum',()=>{
 const variant=(state:string,children:unknown[])=>({name:'state='+state,type:'COMPONENT',bbox:{width:124,height:48},fill:{hex:'e8e8e8'},
  layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children});
 const text={name:'Label',type:'TEXT',text:{characters:'Label',fontSize:14,fontWeight:400,lineHeight:18,fontFamily:'Inter',textAutoResize:'WIDTH_AND_HEIGHT'},fill:{hex:'161616'},localGeometry:{transform:[[1,0,0],[0,1,0]],localSize:{width:124,height:48}}};
 const read=(conventions?:string[])=>proposeFromDump({setName:'EmptyPlane',type:'COMPONENT_SET',propertyDefinitions:{state:{type:'VARIANT',defaultValue:'enabled',variantOptions:['enabled','skeleton']}},
  variants:[variant('enabled',[text]),variant('skeleton',[])]} as any,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'reviewable-inversion',conventions} as any);
 const minimum=(p:ReturnType<typeof read>,axis:string)=>p.mintedTokens?.entries.filter(e=>e.usageSites.some(site=>site.includes(axis))).map(e=>e.value).sort();
 const off=read(),offContract=ContractSchema.parse(off.contract);
 assert.equal(offContract.anatomy.root.tokens?.['min-width'],undefined);assert.equal(offContract.anatomy.root.tokens?.['min-height'],undefined);
 const on=read(['empty-hug-keeps-extent']),c=ContractSchema.parse(on.contract);
 assert.equal(c.anatomy.root.literals?.width,'fit-content');assert.equal(c.anatomy.root.literals?.height,'fit-content');
 assert.deepEqual(minimum(on,'min-width'),['0px','124px']);assert.deepEqual(minimum(on,'min-height'),['0px','48px']);
 assert.ok(on.notes.some(note=>note.includes('empty-hug-keeps-extent')));
});
