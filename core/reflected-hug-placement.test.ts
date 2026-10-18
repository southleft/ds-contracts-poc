import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {observeReflectedHugGeometry,reflectedHugPlacement} from '../extract/figma/reflected-hug-geometry.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {flattenTokens} from './tokens.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';
import {NATIVE_INTRINSIC_PLACEMENT_RUNTIME,intrinsicAbsoluteRight} from './native-intrinsic-placement.js';

function raw(width=36,height=22,parentHeight=32){
 const parent={id:'owner',type:'FRAME',size:{x:0,y:parentHeight},relativeTransform:[[-1,-1.2246468525851679e-16,0],[1.2246468525851679e-16,-1,parentHeight]],layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FILL',layoutMode:'NONE',clipsContent:false};
 const node={id:'label',type:'FRAME',size:{x:width,y:height},relativeTransform:[[-1,1.2246468525851679e-16,width+16],[-1.2246468525851679e-16,-1,(parentHeight+height)/2]],layoutMode:'HORIZONTAL',layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',constraints:{horizontal:'LEFT',vertical:'CENTER'},clipsContent:true};
 return {node,parent};
}
function source():DumpSet {
 return {setName:'ReflectedLabel',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Regular',variantOptions:['Regular','Small']}},variants:[false,true].map(small=>{
  const w=small?31:36,h=small?20:22,ph=small?24:32,{node,parent}=raw(w,h,ph);
  return {name:'Size='+ (small?'Small':'Regular'),variantProperties:{Size:small?'Small':'Regular'},type:'COMPONENT',nodeId:'root-'+small,
   layout:{mode:'HORIZONTAL',primary:'MIN',counter:'CENTER',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[
    {name:'owner',type:'FRAME',nodeId:'owner',fillHeight:true,children:[{name:'label',type:'FRAME',nodeId:'label',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'CENTER',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},clipsContent:true,
     abs:{x:-w-16,y:(ph-h)/2,right:16,bottom:(ph-h)/2,width:w,height:h,constraints:{horizontal:'LEFT',vertical:'CENTER'}},reflectedHugGeometry:observeReflectedHugGeometry(node,parent),children:[
      {name:'title',nodeId:'title',type:'TEXT',fill:{hex:'000000'},text:{characters:'Label',fontFamily:'Inter',fontStyle:'Regular',fontWeight:400,fontSize:small?12:14,lineHeight:h,textAutoResize:'WIDTH_AND_HEIGHT',textAlign:'RIGHT'}}]}]},
    {name:'control',type:'FRAME',nodeId:'control',fixedSize:{width:80,height:ph},fill:{hex:'eeeeee'}}]};
 })};
}
function propose(d=source()){
 const result=proposeFromDump(d,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,stampsObservable:true,fileKey:'fixture-file',contractIdByName:new Map(),contractsById:new Map(),contractIdByKey:new Map()});
 const contract=ContractSchema.parse(result.contract),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 return {...result,contract,tokens,contracts:new Map([[contract.id,contract]])};
}

test('source half-turns preserve one right edge for both intrinsic sizes; plugin capture is identical',()=>{
 const script=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8'),block=script.split('// BEGIN SHARED REFLECTED HUG GEOMETRY\n')[1].split('// END SHARED REFLECTED HUG GEOMETRY')[0];
 const capture=vm.runInNewContext(block+';observeReflectedHugGeometry');
 for(const args of [[36,22,32],[31,20,24]]){const {node,parent}=raw(...args as [number,number,number]),g=observeReflectedHugGeometry(node,parent)!;
  assert.deepEqual(reflectedHugPlacement(g),{right:16});assert.deepEqual(JSON.parse(JSON.stringify(capture(node,parent))),g);
  assert.equal(g.transform[0][2]-g.size.width,16);
 }
 const {node,parent}=raw();const g=observeReflectedHugGeometry(node,parent)!;g.transform[0][2]=123;assert.equal(node.relativeTransform[0][2],52);
});

test('missing, malformed, bound, clipped and non-composing source geometry cannot authorize HUG placement',()=>{
 const mutations:Array<(g:NonNullable<DumpNode['reflectedHugGeometry']>)=>void>=[
  g=>{g.transform[0][0]=1;},g=>{g.parentTransform[1][1]=1;},g=>{g.transform[0][1]=.1;},
  g=>{g.transform[1][2]+=1;},g=>{g.sizing.horizontal='FIXED';},g=>{g.sizing.vertical='FILL';},g=>{g.parentSizing.vertical='HUG';},
  g=>{g.boundProperties=['size'];},g=>{g.parentBoundProperties=['height'];},g=>{g.boundProperties=new Array(1);},g=>{g.limits[0]=1;},g=>{g.parentLimits[3]=32;},
  g=>{g.parentClipsContent=true;},g=>{g.isMask=true;},g=>{g.parentIsMask=true;},g=>{g.constraints.horizontal='RIGHT';},
  g=>{g.size.width=0;},g=>{g.parentSize.width=-1;},g=>{g.nodeId=g.parentId;},g=>{g.limits=new Array(4);},
  g=>{g.transform[0]=new Array(3);},
 ];
 for(const mutate of mutations){const {node,parent}=raw(),g=observeReflectedHugGeometry(node,parent)!;mutate(g);assert.equal(reflectedHugPlacement(g),undefined,String(mutate));}
 for(const mutate of [(n:any)=>{n.layoutSizingHorizontal=null;},(n:any)=>{n.isMask=null;},(n:any)=>{n.boundVariables=null;},(n:any)=>{n.minWidth=NaN;}]){
  const {node,parent}=raw();mutate(node);assert.equal(observeReflectedHugGeometry(node,parent),undefined,String(mutate));}
});

test('proposal carries HUG and source right/center rather than default-size offsets on both React emitters',()=>{
 const p=propose(),part=p.contract.anatomy.root.parts!.owner.parts!.label;
 assert.deepEqual(part.literals,{width:'fit-content',height:'fit-content',right:'16px',top:'50%'});
 assert.equal(part.declared?.translate,'0px -50%');assert.equal(part.tokens?.left,undefined);assert.equal(part.tokens?.width,undefined);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens:p.tokens,contracts:p.contracts,icons:new Map()}),text=files.map(f=>f.contents).join('\n');
  assert.match(text,/fit-content/);assert.match(text,/right[^\n]*16px/);assert.match(text,/0px -50%/);
 }
 const invalid=source();for(const v of invalid.variants)v.children![0].children![0].reflectedHugGeometry!.parentId='wrong';
 const refused=propose(invalid);assert(refused.notes.some(n=>n.includes('reflected-HUG source')));
 assert.equal(refused.contract.anatomy.root.parts!.owner.parts!.label.literals?.width,undefined);
 const legacy=source();for(const v of legacy.variants)delete v.children![0].children![0].reflectedHugGeometry;
 assert.equal(propose(legacy).contract.anatomy.root.parts!.owner.parts!.label.literals?.width,undefined,'legacy projection does not acquire new authority');
 for(const asymmetric of [false,true]){const bordered=source();for(const v of bordered.variants){const p=v.children![0];p.stroke={hex:'000000'};p.strokeWeight=2;p.strokeAlign='INSIDE';if(asymmetric)p.strokeWeights={top:1,right:2,bottom:3,left:4};}
  const refused=propose(bordered);assert.equal(refused.contract.anatomy.root.parts!.owner.parts!.label.literals?.width,undefined);assert(refused.notes.some(n=>n.includes('reflected-HUG source')));}
 for(const mutate of [(n:DumpNode,p:DumpNode)=>{n.layout!.mode='VERTICAL';},(n:DumpNode,p:DumpNode)=>{(n as {clipsContent?:boolean}).clipsContent=false;},(n:DumpNode,p:DumpNode)=>{p.clipsContent=true;},(n:DumpNode,p:DumpNode)=>{p.layout=structuredClone(n.layout);}]){
  const bad=source();for(const v of bad.variants)mutate(v.children![0].children![0],v.children![0]);assert.equal(propose(bad).contract.anatomy.root.parts!.owner.parts!.label.literals?.width,undefined);
 }
});

test('native compilation preserves HUG dimensions and exact right/center anchor',()=>{
 const p=propose(),engine=createFigmaEngine({tokens:p.tokens,icons:new Map()}),data=engine.compileComponentData(p.contract,p.contracts);
 for(const variant of data.variants){const label=variant.spec.children![0].children![0];assert.deepEqual(label.absolute,{h:'MAX',v:'CENTER',right:16});assert.equal(label.fixedWidth,undefined);assert.equal(label.fixedHeight,undefined);assert.equal(label.lits?.width,undefined);assert.equal(label.lits?.height,undefined);}
 // The new percentage-center spelling cannot discard an existing transform's
 // translation. Fixed-size frames retain the prior absolute-placement path.
 for(const declaration of [{transform:'matrix(1, 0, 0, 1, 0, 3)'},{rotate:'180deg'},{scale:'-1'}] as Array<Record<string,string>>){
  const q=propose(),label=q.contract.anatomy.root.parts!.owner.parts!.label;
  label.literals={...label.literals,width:'36px',height:'22px'};label.declared={...label.declared,...declaration};
  const compiled=createFigmaEngine({tokens:q.tokens,icons:new Map()}).compileComponentData(q.contract,q.contracts);
  for(const variant of compiled.variants){const absolute=variant.spec.children![0].children![0].absolute;
   assert.equal(absolute?.v,'MIN');assert.equal(absolute?.top,'transform' in declaration?3:0);
  }
 }
});

async function prepared(p:Pick<ReturnType<typeof propose>,'contract'|'contracts'|'tokens'>){
 const host=nativeFixtureHost({consumerVariableModes:true});
 const createText=host.figma.createText.bind(host.figma);host.figma.createText=()=>{const node=createText();delete node.clipsContent;return node;};
 const proto=Object.getPrototypeOf(host.figma.currentPage),measure=proto._measureText;
 const originalTransform=Object.getOwnPropertyDescriptor(proto,'relativeTransform');
 Object.defineProperty(proto,'relativeTransform',{configurable:true,get(){return [[1,0,this.x],[0,1,this.y]];}});
 proto._measureText=function(axis:string){return axis==='h'&&!this._resized&&this.lineHeight?.unit==='PIXELS'&&!/[\r\n]/.test(this.characters??'')?this.lineHeight.value:measure.call(this,axis);};
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'\n})()',{figma:host.figma,console},{timeout:10000})));
 try{const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()}),source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(p.tokens).slice(7)},operation={id:'40000000-0000-4000-8000-000000000270',fileKey:host.figma.fileKey};
 const compiled=engine.compileNativePreparedLibrary(p.contract,p.contracts,source,operation.id),routed=layeredNativeTokenModes(p.tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const creation=await run(engine.buildNativePreparedLibraryScript(p.contract,p.contracts,source,{operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}}));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await run(emitNativePreparedLibraryReadbackScript(input));return {input,receipt};
 }finally{proto._measureText=measure;if(originalTransform)Object.defineProperty(proto,'relativeTransform',originalTransform);else delete proto.relativeTransform;}
}

test('native writer and independent reader agree on reflected HUG right and vertical center placement',async()=>{
 const {input,receipt}=await prepared(propose()),result=verifyNativePreparedLibraryReadback(input,receipt);
 assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 const labels=receipt.nodes.filter((n:any)=>n.name==='label');assert.equal(labels.length,2);
 for(const label of labels){const parent=receipt.nodes.find((n:any)=>n.id===label.parentId);assert(parent);assert.equal(label.values.x,parent.values.width-16-label.values.width);assert.equal(label.values.y,(parent.values.height-label.values.height)/2);}
 for(const mutate of [(n:any)=>{n.values.x+=1;},(n:any)=>{n.values.minWidth=1;},(n:any)=>{n.values.paddingLeft=1;},(n:any)=>{n.values.boundVariables.width={id:'foreign'};}]){
  const bad=structuredClone(receipt);mutate(bad.nodes.find((n:any)=>n.id===labels[0].id));
  assert.equal(verifyNativePreparedLibraryReadback(input,bad).status,'refused',String(mutate));
 }
});

function scalarFixture(supplied:boolean){
 const d=source();d.variants=d.variants.slice(0,1);const definition=d.propertyDefinitions!.Size;assert.equal(definition.type,'VARIANT');if(definition.type==='VARIANT')definition.variantOptions=['Regular'];
 const p=propose(d),owner=p.contract,label=owner.anatomy.root.parts!.owner.parts!.label,title=label.parts!.title;
 owner.props.push({name:'labelSize',type:{enum:['small']},bindings:{code:{prop:'labelSize'},figma:{kind:'NONE'}}});
 title.literalsByProp=[{prop:'labelSize',map:{small:{'font-size':'12px','line-height':'20px'}}}];ContractSchema.parse(owner);
 const parent=ContractSchema.parse({id:'fixture.scalar-reflected',name:'ScalarReflected',version:'0.1.0',status:'draft',description:'Reflected intrinsic scalar replay',props:[],states:[],semantics:{element:'div'},
  anatomy:{root:{layout:{display:'flex',direction:'row'},parts:{body:{component:{id:owner.id,...(supplied?{props:{labelSize:'small'}}:{})}}}}},
  bindings:{code:{anchors:{importPath:'./ScalarReflected',export:'ScalarReflected'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 return {contract:parent,contracts:new Map([[owner.id,owner],[parent.id,parent]]),tokens:p.tokens};
}

test('supplied and omitted scalar values reflow cloned HUG owners after final text replay',async()=>{
 for(const supplied of [true,false]){
  const {input,receipt}=await prepared(scalarFixture(supplied)),verified=verifyNativePreparedLibraryReadback(input,receipt);
  assert.equal(verified.status,'supported-structure-observed',JSON.stringify({supplied,verified}));
  const instance=receipt.nodes.find((n:any)=>n.type==='INSTANCE');assert(instance);
  const descendants:any[]=[];const walk=(n:any)=>{for(const id of n.childIds){const child=receipt.nodes.find((x:any)=>x.id===id);assert(child);descendants.push(child);walk(child);}};walk(instance);
  const label=descendants.find(n=>n.metadata.intrinsicPlacement);assert(label);
  const text=receipt.nodes.find((n:any)=>n.id===label.childIds[0]),parent=receipt.nodes.find((n:any)=>n.id===label.parentId);assert(text);assert(parent);
  assert.equal(text.values.fontSize,supplied?12:14);assert.equal(text.values.lineHeight.value,supplied?20:22);
  assert.equal(label.values.width,text.values.width);assert.equal(label.values.height,text.values.height);
  assert.equal(label.values.x,parent.values.width-16-label.values.width);assert.equal(label.values.y,(parent.values.height-label.values.height)/2);
  for(const mutate of [(n:any)=>{n.metadata.intrinsicPlacement='wrong-owner';},(n:any)=>{n.values.width+=1;},(n:any)=>{n.values.x+=1;},(n:any)=>{n.values.boundVariables.width={id:'foreign'};},(n:any)=>{n.values.layoutSizingHorizontal='FIXED';}]){
   const bad=structuredClone(receipt);mutate(bad.nodes.find((n:any)=>n.id===label.id));assert.equal(verifyNativePreparedLibraryReadback(input,bad).status,'refused',String(mutate));
  }
 }
});

test('native intrinsic reflow rejects duplicate owners, extra content, foreign targets and bound geometry',()=>{
 const run=(mutate:(f:any)=>void)=>{
  const text:any={type:'TEXT',visible:true,width:31,height:20,getSharedPluginData:()=> 'text-owner'};
  const frame:any={type:'FRAME',children:[text],parent:{width:0,height:24},width:31,height:20,layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',constraints:{horizontal:'MAX',vertical:'CENTER'},boundVariables:{},getSharedPluginData:()=> 'frame-owner'};
  const instance:any={type:'INSTANCE',children:[frame]};const f={text,frame,instance};mutate(f);
  vm.runInNewContext(NATIVE_INTRINSIC_PLACEMENT_RUNTIME+";reflowInstanceIntrinsicPlacements(instance,{instanceIntrinsicPlacements:{'frame-owner':{right:16,textTarget:'text-owner'}}});",{instance,figma:{skipInvisibleInstanceChildren:true}});
  return frame;
 };
 assert.equal(run(()=>{}).x,-47);
 for(const mutate of [(f:any)=>{f.instance.children.push(f.frame);},(f:any)=>{f.frame.getSharedPluginData=()=> 'wrong-owner';},
  (f:any)=>{f.frame.children.push({type:'RECTANGLE',visible:true,getSharedPluginData:()=>''});},(f:any)=>{f.text.getSharedPluginData=()=> 'wrong-text';},
  (f:any)=>{f.frame.boundVariables.height={id:'bound'};},(f:any)=>{f.frame.layoutSizingHorizontal='FIXED';},(f:any)=>{f.frame.width=32;}])
  assert.throws(()=>run(mutate),/intrinsic-placement-native-(owner|geometry)-unqualified/);
 const p=scalarFixture(true),owner=[...p.contracts.values()].find(c=>c.id!==p.contract.id)!;
 owner.anatomy.root.parts!.owner.parts!.label.parts!.extra={text:'Other',literals:{'font-size':'12px','line-height':'20px'}};
 assert.throws(()=>createFigmaEngine({tokens:p.tokens,icons:new Map()}).compileComponentData(owner,p.contracts),/intrinsic-placement-native-children-unqualified/);
 const frame=propose().contract.anatomy.root.parts!.owner.parts!.label;
 for(const fields of [{'max-width':'10px'},{'max-height':'10px'},{display:'none'},{display:'contents'},{display:'inline'}] as Array<Record<string,string>>){
  const limited=structuredClone(frame);limited.declared={...limited.declared,...fields};assert.equal(intrinsicAbsoluteRight(limited,{}),undefined,JSON.stringify(fields));
 }
 const bordered=scalarFixture(true),child=[...bordered.contracts.values()].find(c=>c.id!==bordered.contract.id)!;
 child.anatomy.root.parts!.owner.literals={'border-right-width':'2px'};
 assert.throws(()=>createFigmaEngine({tokens:bordered.tokens,icons:new Map()}).compileComponentData(bordered.contract,bordered.contracts),/intrinsic-placement-native-parent-border-unqualified/);
});
