import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';
import {createFigmaEngine,type NodeSpec} from './emit-figma-script.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {revisionOf} from './contract-provenance.js';import {flattenTokens} from './tokens.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';import type {NativePreparedLibrarySource} from './native-prepared-library.js';
const base={version:'0.1.0',status:'draft',description:'Exact caller width supersedes borrowed default only under an equal proved allocation',semantics:{element:'div'},states:[],bindings:{code:{anchors:{importPath:'./Fixture',export:'Fixture'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
function fixture(){
 const child=ContractSchema.parse({...base,id:'width.child',name:'WidthChild',props:[],anatomy:{root:{layout:{display:'flex',direction:'row'},tokens:{width:'{widths.default}'},instanceRootInputs:['width'],parts:{leading:{slot:{name:'leading'}},mark:{shape:{kind:'rect',width:16,height:24},literals:{'background-color':'#000000'}}}}}});
 const payload={shape:{kind:'rect',width:8,height:8},literals:{'background-color':'#000000'}};
 const selected={layout:{grow:true,growBasis:'zero'},component:{id:child.id,contentSlot:'leading',rootOverrides:{width:'{widths.{size}}'}},parts:{payload}};
 const zero={layout:{display:'flex'},parts:{absolute:{shape:{kind:'rect',width:10,height:10},literals:{'background-color':'#000000',left:'0px',top:'0px'},declared:{position:'absolute'}}}};
 const body={layout:{display:'flex',direction:'row',grow:true,growBasis:'zero'},slot:{name:'body',renderDefault:true,defaultContent:[{id:child.id}]},parts:{usage:selected}};
 const row={layout:{display:'flex',direction:'row',alignSelf:'stretch'},parts:{zero,body}};
 const parent=ContractSchema.parse({...base,id:'width.parent',name:'WidthParent',props:[{name:'size',type:{enum:['small','large']},default:'small',bindings:{figma:{kind:'VARIANT',property:'Size'},code:{prop:'size'}}}],anatomy:{root:{layout:{display:'flex',direction:'column'},tokens:{width:'{widths.{size}}'},parts:{row}}}});
 const tokens={primitives:{widths:{default:{$type:'dimension',$value:'220px'},small:{$type:'dimension',$value:'300px'},large:{$type:'dimension',$value:'420px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const contracts=new Map([[child.id,child],[parent.id,parent]]);return{child,parent,tokens,contracts};
}
const walk=(s:NodeSpec):NodeSpec[]=>[s,...(s.children??[]).flatMap(walk)];
const usage=(c:Contract)=>c.anatomy.root.parts!.row.parts!.body.parts!.usage;

test('positive caller widths replace only copied defaults under exact variable parent allocations',()=>{
 const f=fixture(),data=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.parent,f.contracts);
 assert.equal(data.variants.length,2);
 assert.deepEqual(data.variants.map(v=>{const n=walk(v.spec).find(s=>s.name==='usage')!;assert.equal(n.fillW,true);assert.equal(n.instanceCallerFillWidth,true);assert.equal(n.fixedWidth,undefined);return n.instanceRootOverrides!.width.px;}),[300,420]);
 const plain=fixture();delete usage(plain.parent).component!.rootOverrides;delete usage(plain.parent).layout!.growBasis;usage(plain.parent).layout!.grow=false;
 const unchanged=createFigmaEngine({tokens:plain.tokens,icons:new Map()}).compileComponentData(plain.parent,plain.contracts);
 assert(unchanged.variants.every(v=>walk(v.spec).find(s=>s.name==='usage')!.fixedWidth!.px===220));
});

test('missing, zero, negative, unknown, conflicting or unproved widths never acquire caller Fill authority',()=>{
 for(const fault of ['missing','zero','negative','unknown','wrong-width','own-width','parent-hug','parent-none','parent-contents','parent-inline','child-contents','parent-padding','parent-max-zero','parent-max-token','child-max-zero','zero-fixed','zero-min','zero-padding','zero-border','zero-border-style','zero-gap','zero-ratio','zero-unknown','other-flow','foreign-slot']as const){
  const f=fixture(),part=usage(f.parent),zero=f.parent.anatomy.root.parts!.row.parts!.zero;
  if(fault==='missing')delete part.component!.rootOverrides;
  if(fault==='zero')f.tokens.primitives.widths.small.$value='0px';
  if(fault==='negative')f.tokens.primitives.widths.small.$value='-1px';
  if(fault==='unknown')part.component!.rootOverrides!.width='{widths.missing}';
  if(fault==='wrong-width')part.component!.rootOverrides!.width='{widths.default}';
  if(fault==='own-width')part.literals={width:'10px'};
  if(fault==='parent-hug')delete f.parent.anatomy.root.tokens;
  if(fault==='parent-none')f.parent.anatomy.root.declared={display:'none'};
  if(fault==='parent-contents')f.parent.anatomy.root.declared={display:'contents'};
  if(fault==='parent-inline')f.parent.anatomy.root.declared={display:'inline'};
  if(fault==='child-contents')f.child.anatomy.root.declared={display:'contents'};
  if(fault==='parent-padding')f.parent.anatomy.root.literals={'padding-left':'1px'};
  if(fault==='parent-max-zero')f.parent.anatomy.root.literals={'max-width':'0px'};
  if(fault==='parent-max-token'){f.parent.anatomy.root.tokens!['max-width']='{widths.zero}';(f.tokens.primitives.widths as any).zero={$type:'dimension',$value:'0px'};}
  if(fault==='child-max-zero')f.child.anatomy.root.literals={'max-width':'0px'};
  if(fault==='zero-fixed')zero.literals={width:'1px'};
  if(fault==='zero-min')zero.literals={'min-width':'1px'};
  if(fault==='zero-padding')zero.literals={'padding-left':'1px'};
  if(fault==='zero-border')zero.literals={'border-width':'1px'};
  if(fault==='zero-border-style')zero.literals={'border-style':'solid'};
  if(fault==='zero-gap')zero.literals={gap:'1px'};
  if(fault==='zero-ratio'){zero.literals={height:'10px'};zero.declared={'aspect-ratio':'1'};}
  if(fault==='zero-unknown')zero.tokens={'min-width':'{unknown.width}'};
  if(fault==='other-flow'){delete zero.parts!.absolute.declared;delete zero.parts!.absolute.literals!.left;delete zero.parts!.absolute.literals!.top;}
  if(fault==='foreign-slot')part.component!.contentSlot='foreign';
  assert.throws(()=>createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.parent,f.contracts),/FIGMA_ZERO_BASIS|FIGMA_CROSS_AXIS|instance-root|resolve token|[Uu]nresolved|[Uu]nknown|qualified foreign slot|unique foreign slot/,fault);
 }
});

test('prepared writer and independent reader observe unbound Fill at the proved effective width and reject tampering',async()=>{
 for(const fixedParent of [false,true]){
 const f=fixture(),host=nativeFixtureHost({consumerVariableModes:true});
 Object.assign(f.tokens.primitives.widths,{zero:{$type:'dimension',$value:'0px'},otherZero:{$type:'dimension',$value:'0px'}});
 f.child.anatomy.root.tokens!['padding-left']='{widths.zero}';
 if(fixedParent){const body=f.parent.anatomy.root.parts!.row.parts!.body;body.layout!.grow=false;delete body.layout!.growBasis;body.tokens={width:'{widths.{size}}'};}
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'\n})()',{figma:host.figma,console},{timeout:10000})));
 const engine=createFigmaEngine({tokens:f.tokens,icons:new Map()}),source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(f.tokens).slice(7)},operation={id:'40000000-0000-4000-8000-000000000270',fileKey:host.figma.fileKey};
 const compiled=engine.compileNativePreparedLibrary(f.parent,f.contracts,source,operation.id),routed=layeredNativeTokenModes(f.tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await run(emitNativeTokenContextScript(tokenInput).script);assert.equal(allocated.status,'created-candidate');
 const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const writer=engine.buildNativePreparedLibraryScript(f.parent,f.contracts,source,{operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}}); const creation=await run(writer);assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await run(emitNativePreparedLibraryReadbackScript(input)),verify=(r=receipt)=>verifyNativePreparedLibraryReadback(input,r);
 assert.equal(verify().status,'supported-structure-observed',JSON.stringify({report:verify(),nodes:receipt.nodes.map((n:any)=>({id:n.id,name:n.name,type:n.type,parentId:n.parentId,width:n.values.width,mode:n.values.layoutMode,h:n.values.layoutSizingHorizontal}))}));
 const actuals=receipt.nodes.filter((n:any)=>n.type==='INSTANCE'&&n.name==='usage');assert.equal(actuals.length,2);
 assert.deepEqual(actuals.map((n:any)=>n.values.width).sort((a:number,b:number)=>a-b),[300,420]);assert(actuals.every((n:any)=>n.values.layoutSizingHorizontal==='FILL'&&n.values.boundVariables.width===undefined));
 for(const mutate of [(n:any)=>{n.values.width=220;},(n:any)=>{n.values.boundVariables.width={type:'VARIABLE_ALIAS',id:'foreign'};},(n:any)=>{n.values.boundVariables.width={type:'VARIABLE_ALIAS',id:host.variables.find((v:any)=>v.name==='widths/small')!.id};},(n:any)=>{n.values.layoutSizingHorizontal='FIXED';},(n:any)=>{n.mainId='foreign';}]){
  const changed=structuredClone(receipt);mutate(changed.nodes.find((n:any)=>n.id===actuals[0].id));assert.equal(verify(changed).status,'refused',String(mutate));
 }
 const inherited=receipt.nodes.find((n:any)=>n.id===actuals[0].id).values.boundVariables.paddingLeft;
 assert.equal(inherited.id,host.variables.find((v:any)=>v.name==='widths/zero')!.id,'owned zero constraint binding survives');
 const wrongBinding=structuredClone(receipt);wrongBinding.nodes.find((n:any)=>n.id===actuals[0].id).values.boundVariables.minWidth={type:'VARIABLE_ALIAS',id:host.variables.find((v:any)=>v.name==='widths/otherZero')!.id};
 assert.equal(verify(wrongBinding).status,'refused','unowned zero constraint binding');
 const changedPadding=structuredClone(receipt);changedPadding.nodes.find((n:any)=>n.id===actuals[0].id).values.boundVariables.paddingLeft={type:'VARIABLE_ALIAS',id:host.variables.find((v:any)=>v.name==='widths/otherZero')!.id};
 assert.equal(verify(changedPadding).status,'refused','same-value foreign zero padding binding');
 if(fixedParent)assert.equal(receipt.nodes.find((n:any)=>n.id===actuals[0].parentId).values.primaryAxisSizingMode,'FIXED');
 for(const target of ['parent','instance'])for(const fault of ['width','wrap','mode','minimum','maximum','padding','gap','border','ratio']){
  const changed=structuredClone(receipt),node=changed.nodes.find((n:any)=>n.id===(target==='parent'?actuals[0].parentId:actuals[0].id));
  if(fault==='width')node.values.width+=1;
  if(fault==='wrap')node.values.layoutWrap='WRAP';
  if(fault==='mode'){
   node.values.layoutSizingHorizontal=target==='parent'&&fixedParent?'HUG':'FIXED';
   if(target==='parent'&&fixedParent)node.values.primaryAxisSizingMode='AUTO';
  }
  if(fault==='minimum')node.values.minWidth=1;
  if(fault==='maximum')node.values.maxWidth=node.values.width;
  if(fault==='padding')node.values.paddingLeft=1;
  if(fault==='gap')node.values.itemSpacing=1;
  if(fault==='border'){node.values.strokes=[{type:'SOLID',color:{r:0,g:0,b:0}}];node.values.strokeWeight=1;}
  if(fault==='ratio')node.values.targetAspectRatio={x:1,y:1};
  assert.equal(verify(changed).status,'refused',target+':'+fault);
 }
 }
});
