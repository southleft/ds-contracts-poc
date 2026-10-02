import {createFigmaEngine} from './emit-figma-script.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {ContractSchema, walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {generateTsx} from './emit-react.js';
import {validateContract} from '../packages/core/src/validate.js';
import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){
 const child=ContractSchema.parse({id:'ds.mark',name:'Mark',version:'0.1.0',status:'draft',description:'Independent scalable drawing',semantics:{element:'span'},props:[],states:[],
 anatomy:{root:{tokens:{width:'{mark.size}',height:'{mark.size}'},overridable:['size'],parts:{ink:{literals:{'background-color':'currentColor'},declared:{position:'absolute'},shape:{kind:'path',width:18,height:18,paths:[{data:'M0 0L18 0L18 18L0 18Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24,x:3,y:3}}}}}},
 bindings:{figma:{anchors:{fileKey:'fixture',nodeId:'50:1',componentSetKey:'mark-key'}},code:{anchors:{importPath:'./Mark',export:'Mark'}}}});
 const set:DumpSet={setName:'Holder',type:'COMPONENT_SET',propertyDefinitions:{Selected:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']},Icon:{type:'INSTANCE_SWAP',defaultValue:'50:1'}},
 variants:['Off','On'].map(selected=>({name:`Selected=${selected}`,type:'COMPONENT',variantProperties:{Selected:selected},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Indicator',type:'FRAME',fixedSize:{width:16,height:16},clipsContent:true,children:selected==='Off'?[]:[{name:'Mark',type:'INSTANCE',instanceOf:'Mark',instanceKey:'mark-key',propRefs:{mainComponent:'Icon'},bbox:{width:16,height:16}}]}]}))};
 const read=(mode:'exact'|'reviewable-inversion'='exact')=>{const result=proposeFromDump(set,{corpus,mintUnbound:true,fileKey:'fixture',projectionMode:mode,contractIdByName:new Map([['Mark',child.id]]),contractIdByKey:new Map([['mark-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]])});const contract=ContractSchema.parse(result.contract);return{result,contract,part:walkAnatomy(contract).find(p=>p.part.slot)!.part};};return{child,set,read};
}
test('a fixed slot wrapper keeps its box and gates only omitted default content',()=>{
 const f=fixture(),before=JSON.stringify(f.child),{contract,part,result}=f.read();assert(part.tokens?.width);assert(part.tokens?.height);assert(part.slot?.renderDefault);
 const fallback=Object.values(part.parts!)[0];assert.deepEqual(fallback.visibleWhen,{prop:'selected',equals:'on'});assert.equal(fallback.component?.id,f.child.id);assert(fallback.component?.overrides?.size);assert(result.mintedTokens!.entries.some(e=>e.value==='16px'));
 assert.equal(part.visibleWhen,undefined,'explicit caller replacements are not gated by default child presence');assert.equal(JSON.stringify(f.child),before,'shared main remains 24px');
 const scope=new Map([[contract.id,contract],[f.child.id,f.child]]),errors:string[]=[];validateContract(contract,scope,errors,new Map());assert.deepEqual(errors,[]);const tsx=generateTsx(contract,scope,new Map());assert.match(tsx,/children === undefined/);assert.match(tsx,/selected === ['"]on['"]/);
});
test('reviewable clipping belongs to an explicit frame host; exact foreign clipping stays a named limit',()=>{
 const f=fixture(),review=f.read('reviewable-inversion');assert.equal(review.part.element,'div');assert.equal(review.part.declared?.['overflow-x'],'hidden');assert.equal(review.part.declared?.['overflow-y'],'hidden');assert.equal(f.read().part.declared,undefined);
 const scope=new Map([[review.contract.id,review.contract],[f.child.id,f.child]]),errors:string[]=[];validateContract(review.contract,scope,errors,new Map());assert.deepEqual(errors,[]);
});
test('unknown linked default or drawing size cannot synthesize runtime fallback or a size override',()=>{
 const wrong=fixture();wrong.set.propertyDefinitions!.Icon.defaultValue='foreign:1';assert.equal(wrong.read().part.slot?.renderDefault,undefined);assert.equal(wrong.read().part.parts,undefined);
 const nonsquare=fixture();nonsquare.set.variants[1].children![0].children![0].bbox={width:16,height:15};const fallback=Object.values(nonsquare.read().part.parts!)[0];assert.equal(fallback.component?.overrides?.size,undefined);assert.deepEqual(fallback.visibleWhen,{prop:'selected',equals:'on'});
});

test('default presence is scoped to an exactly gated wrapper, without hiding caller replacements',()=>{
 const f=fixture(),original=f.set.variants;f.set.propertyDefinitions!.Mode={type:'VARIANT',defaultValue:'Shown',variantOptions:['Shown','Hidden']};
 f.set.variants=['Shown','Hidden'].flatMap(mode=>original.map(v=>({...structuredClone(v),name:`${v.name}, Mode=${mode}`,variantProperties:{...v.variantProperties,Mode:mode},children:mode==='Hidden'?[]:structuredClone(v.children)})));
 const {part}=f.read();assert.deepEqual(part.visibleWhen,{prop:'mode',equals:'shown'});const fallback=Object.values(part.parts!)[0];assert.deepEqual(fallback.visibleWhen,{prop:'selected',equals:'on'});
});


test('native slot fallback filters the same presence gate while retaining the wrapper box',()=>{
 const f=fixture(),{contract,result}=f.read();const engine=createFigmaEngine({tokens:{primitives:{mark:{size:{$type:'dimension',$value:'24px'}},...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=engine.compileComponentData(contract,new Map([[contract.id,contract],[f.child.id,f.child]]));
 for(const v of data.variants){const slot=v.spec.children!.find(n=>n.type==='slot')!;assert.equal(slot.fixedWidth?.px,16);assert.equal(slot.fixedHeight?.px,16);assert.equal(slot.children?.length,v.name.includes('Selected=On')?1:0);}
});
