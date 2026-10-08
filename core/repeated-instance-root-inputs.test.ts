import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {asMinimalChildContract,proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {validateContract} from '../packages/core/src/validate.js';
import {reactEmitter,htmlEmitter} from './emitter.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {webComponentsEmitter} from '../packages/emitter-web-components/src/index.js';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';

const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture() {
 const child=ContractSchema.parse({id:'probe.entry',name:'Entry',version:'0.1.0',status:'draft',description:'Closed child main geometry and Boolean control',semantics:{element:'span'},
  props:[{name:'selected',type:'boolean',default:true,bindings:{figma:{kind:'VARIANT',property:'Selected ?',values:{true:'True',false:'False'}},code:{prop:'active'}}},
   {name:'density',type:{enum:['compact','wide']},default:'compact',bindings:{figma:{kind:'VARIANT',property:'Density',values:{compact:'Compact',wide:'Wide'}},code:{prop:'density'}}},
   {name:'text',type:'text',default:'Item',bindings:{figma:{kind:'TEXT',property:'Text'},code:{prop:'children'}}}],
  states:[],anatomy:{root:{instanceRootInputs:['height','width'],tokens:{height:'{probe.main-height.{density}}'},parts:{mark:{text:'Selected',visibleWhen:{prop:'selected'}},label:{content:{prop:'children'}}}}},
  bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'entry-key'}},code:{anchors:{importPath:'./Entry',export:'Entry'}}}});
 const set:DumpSet={setName:'Menu',type:'COMPONENT_SET',propertyDefinitions:{Density:{type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Wide']}},variants:['Compact','Wide'].map((density,plane)=>({
  name:'Density='+density,type:'COMPONENT',variantProperties:{Density:density},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:4,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
  children:['One','Two','Three'].map((text,index):DumpNode=>{
   const nodeId=`use-${plane}-${index}`,componentId=`main-${plane}-${index===0?'true':'false'}`,instanceKey=`entry-${componentId}`,height=plane?44:60,mainHeight=plane?56:60;
   const transform:[[number,number,number],[number,number,number]]=[[1,0,index*100],[0,1,0]];
   return {nodeId,type:'INSTANCE',name:'entry',instanceOf:'Entry',instanceKey,instanceSetKey:'entry-key',
    componentProperties:{'Selected ?':index===0?'True':'False','Text#1:0':text,Density:density},bbox:{width:54,height},
    instanceGeometry:{nodeId,componentId,transform,localSize:{width:54,height}},
    instanceRootOverrides:{nodeId,componentId,componentKey:instanceKey,componentSetKey:'entry-key',fields:plane?['height']:[],mainSize:{width:54,height:mainHeight},...(plane?{localSize:{width:54,height}}:{}),localTransform:transform}};
  })
 }))};
 const run=(extra:Record<string,unknown>={})=>{
  const before=JSON.stringify(set),childBefore=JSON.stringify(child);
  const result=proposeFromDump(set,{corpus,mintUnbound:true,fileKey:'fixture',stampsObservable:true,contractIdByName:new Map([['Entry',child.id]]),contractIdByKey:new Map([['entry-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]]),...extra});
  assert.equal(JSON.stringify(set),before);assert.equal(JSON.stringify(child),childBefore);
  const contract=ContractSchema.parse(result.contract),parts=walkAnatomy(contract).filter(row=>row.part.component?.id===child.id);
  const tokens={primitives:{probe:{'main-height':{compact:{$type:'dimension',$value:'60px'},wide:{$type:'dimension',$value:'56px'}}},...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
  const ctx={tokens,contracts:new Map([[child.id,child],[contract.id,contract]]),icons:new Map<string,string>(),mode:'light' as const};
  return {result,contract,parts,ctx};
 };
 return {child,set,run};
}
function render(tsx:string,props:Record<string,unknown>={}) {
 const out:{exports:Record<string,React.ComponentType<any>>}={exports:{}};
 const js=ts.transpileModule(tsx,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{exports:out.exports,React,require:(name:string)=>{
  if(name==='react')return React;
  if(name==='../Entry'||name==='./Entry')return {Entry:({active=true,children,style}:any)=>React.createElement('span',{'data-active':String(active),style},children)};
  if(name.endsWith('.module.css'))return {root:'menu'};
  throw Error('Unexpected dependency '+name);
 }});
 return renderToStaticMarkup(React.createElement(out.exports.Menu,props));
}
function fixed(f:ReturnType<typeof fixture>,reason:string,extra:Record<string,unknown>={}) {
 const out=f.run(extra);assert(out.parts.every(p=>!p.part.repeat));assert.equal(out.parts.length,3);
 assert(out.result.notes.some(n=>n.includes('repeat-instance-root-'+reason)),out.result.notes.join('\n'));
 assert(!out.contract.props.some(p=>typeof p.type==='object'&&'arrayOf'in p.type));
 return out;
}
function nativeUses(out:ReturnType<ReturnType<typeof fixture>['run']>) {
 const spec=createFigmaEngine({tokens:out.ctx.tokens,icons:out.ctx.icons}).compileComponentData(out.contract,out.ctx.contracts);
 const uses=(node:any):any[]=>[...(node.depContractId==='probe.entry'?[node]:[]),...(node.children??[]).flatMap(uses)];
 return spec.variants.map(v=>({name:v.name,uses:uses(v.spec)}));
}

test('every independently qualified sibling shares exact closed 60/44 height projection with true/false child controls',()=>{
 const f=fixture(),out=f.run(),part=out.parts[0].part;
 assert.equal(out.parts.length,1);assert(part.repeat);assert.deepEqual(part.repeat.sample,[{selected:true,text:'One'},{selected:false,text:'Two'},{selected:false,text:'Three'}]);
 assert.deepEqual(Object.keys(part.component!.rootOverrides!),['height']);assert.equal(part.component!.rootFill,undefined);
 assert.match(part.component!.rootOverrides!.height!,/\{density\}/);
 const errors:string[]=[];validateContract(out.contract,out.ctx.contracts,errors,new Map());assert.deepEqual(errors,[]);
 const react=reactEmitter.emit(out.contract,out.ctx).find(x=>x.path.endsWith('.tsx'))!.contents;
 for(const [density,height] of [['compact',60],['wide',44],['compact',60]] as const){
  const markup=render(react,{density,items:part.repeat!.sample});assert.equal((markup.match(new RegExp('height:var\\(--imported-menu-entry-height-'+density+'\\)','g'))??[]).length,3,markup);
  assert(out.result.mintedTokens!.entries.some(e=>e.ref.endsWith('.height.'+density+'}')&&e.value===height+'px'));
  assert.match(markup,/data-active="true"[^>]*>One<\/span><span data-active="false"[^>]*>Two<\/span><span data-active="false"[^>]*>Three<\/span>/);
 }
 const changed=render(react,{density:'wide',items:[{selected:false,text:'Changed'},{selected:true,text:'Second'}]});assert.equal((changed.match(/height:var\(--imported-menu-entry-height-wide\)/g)??[]).length,2);assert.match(changed,/data-active="false"[^>]*>Changed/);
 const inline=emitReactInline(out.contract,out.ctx);assert.match(inline.tsx,/active=\{false\}/);assert.equal((render(inline.tsx).match(/height:60px/g)??[]).length,3);
 for(const row of nativeUses(out)){
  assert.deepEqual(row.uses.map(n=>n.depProps['Selected ?']),['True','False','False']);
  assert.deepEqual(row.uses.map(n=>n.instanceRootOverrides.height.px),Array(3).fill(row.name.includes('Wide')?44:60));
 }
 // Existing static targets lack root-input receivers; retain exact named refusals.
 for(const emitter of [htmlEmitter,webComponentsEmitter])assert.throws(()=>emitter.emit(out.contract,out.ctx),/instance-root-input-target-unsupported/);
});
test('one later sibling mismatch retains fixed refs and their independently qualified values',()=>{
 const f=fixture(),node=f.set.variants[1].children![2];node.instanceGeometry!.localSize.height=48;node.instanceRootOverrides!.localSize!.height=48;node.bbox!.height=48;
 const out=fixed(f,'not-uniform');assert(out.parts.every(p=>p.part.component!.rootOverrides?.height));
 const wide=nativeUses(out).find(v=>v.name.includes('Wide'))!;assert.deepEqual(wide.uses.map(n=>n.instanceRootOverrides.height.px),[44,44,48]);assert.deepEqual(wide.uses.map(n=>n.depProps['Selected ?']),['True','False','False']);
});
test('invalid, later-only and missing dimension authority cannot become a shared first-item value',()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.set.variants[1].children![2].instanceRootOverrides!.localSize!.height=-1;},
  (f:ReturnType<typeof fixture>)=>{delete f.set.variants[1].children![2].instanceRootOverrides!.localSize;},
  (f:ReturnType<typeof fixture>)=>{for(const v of f.set.variants)for(const [i,n] of v.children!.entries())if(i!==2){n.instanceRootOverrides!.fields=[];delete n.instanceRootOverrides!.localSize;}}
 ]){const f=fixture();change(f);fixed(f,'channel-unqualified');}
});
test('independent geometry and main identity must join on every occurrence',()=>{
 for(const change of [
  (n:DumpNode)=>{delete n.instanceGeometry;},
  (n:DumpNode)=>{n.instanceGeometry!.nodeId='foreign';},
  (n:DumpNode)=>{n.instanceRootOverrides!.componentId='foreign';},
  (n:DumpNode)=>{n.instanceRootOverrides!.componentId='';n.instanceGeometry!.componentId='';},
  (n:DumpNode)=>{n.instanceRootOverrides!.componentKey='foreign';},
  (n:DumpNode)=>{n.instanceRootOverrides!.localTransform=structuredClone(n.instanceRootOverrides!.localTransform!);n.instanceRootOverrides!.localTransform[1][2]=999;},
  (n:DumpNode)=>{delete n.instanceRootOverrides!.mainSize;},
 ]){const f=fixture();change(f.set.variants[1].children![2]);fixed(f,'geometry-unqualified');}
});
test('unknown, duplicate, sparse and invalid root fields retain named fixed-instance receipts',()=>{
 for(const fields of [['height','unknown'],['height','height'],['height',undefined],Object.assign(new Array(2),{0:'height'})]){
  const f=fixture();f.set.variants[1].children![2].instanceRootOverrides!.fields=fields as string[];
  fixed(f,fields[1]==='unknown'?'unsupported-fields':'fields-unqualified');
 }
});
test('positive omission remains absent; one resize captured only on a later item refuses repeat',()=>{
 const omission=fixture();for(const v of omission.set.variants)for(const n of v.children!){n.instanceRootOverrides!.fields=[];delete n.instanceRootOverrides!.localSize;}
 const out=omission.run();assert(out.parts[0].part.repeat);assert.equal(out.parts[0].part.component!.rootOverrides,undefined);
 const later=fixture();for(const v of later.set.variants)for(const [i,n] of v.children!.entries())if(i!==2){n.instanceRootOverrides!.fields=[];delete n.instanceRootOverrides!.localSize;}
 fixed(later,'channel-unqualified');
});
test('reordering parent planes and item labels cannot change the shared projection or selection order',()=>{
 const f=fixture(),original=f.run().parts[0].part.component!.rootOverrides;f.set.variants.reverse();for(const v of f.set.variants)v.children!.reverse();
 const out=f.run(),part=out.parts[0].part;assert.deepEqual(part.component!.rootOverrides,original);assert.deepEqual(part.repeat!.sample,[{selected:false,text:'Three'},{selected:false,text:'Two'},{selected:true,text:'One'}]);
});
test('promoted state planes and unsupported root allocation do not gain a shared dimension template',()=>{
 const f=fixture();f.set.propertyDefinitions={State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']}};
 for(const [i,v]of f.set.variants.entries()){v.name='State='+['Default','Hover'][i];v.variantProperties={State:['Default','Hover'][i]};for(const n of v.children!)n.componentProperties!.Density='Compact';}
 fixed(f,'source-planes-unqualified',{projectionMode:'reviewable-inversion'});
 const width=fixture();for(const v of width.set.variants){v.layout!.mode='VERTICAL';v.layout!.counterSizing='FIXED';v.bbox={width:54,height:200};for(const n of v.children!){n.fillWidth=true;n.instanceRootOverrides!.fields.push('width');n.instanceRootOverrides!.localSize??={width:54,height:n.instanceGeometry!.localSize.height};}}
 fixed(width,'channel-unqualified');
});
test('child default false remains false and ambiguous captured main ownership keeps the source refusal',()=>{
 const f=fixture();f.child.props.find(p=>p.name==='selected')!.default=false;
 const out=f.run(),react=reactEmitter.emit(out.contract,out.ctx).find(x=>x.path.endsWith('.tsx'))!.contents;
 const markup=render(react,{density:'wide',items:out.parts[0].part.repeat!.sample});assert.match(markup,/data-active="true"[^>]*>One<\/span><span data-active="false"[^>]*>Two<\/span><span data-active="false"[^>]*>Three<\/span>/);
 assert.deepEqual(nativeUses(out)[0].uses.map(n=>n.depProps['Selected ?']),['True','False','False']);
 const ambiguous=fixture();assert.throws(()=>ambiguous.run({capturedMainIdsByKey:new Map([['entry-key',new Set(['main-one','main-two'])]])}),/captured-instance-definition-unqualified: ambiguous library key/);
});
test('a complete uniform source table that needs three axes retains the existing nested projection refusal',()=>{
 const f=fixture(),template=f.set.variants[0];f.set.propertyDefinitions={A:{type:'VARIANT',defaultValue:'a0',variantOptions:['a0','a1']},B:{type:'VARIANT',defaultValue:'b0',variantOptions:['b0','b1']},C:{type:'VARIANT',defaultValue:'c0',variantOptions:['c0','c1']}};
 f.set.variants=[];for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++){
  const v=structuredClone(template),height=40+a*8+b*4+c;v.name=`A=a${a}, B=b${b}, C=c${c}`;v.variantProperties={A:'a'+a,B:'b'+b,C:'c'+c};
  for(const [i,n]of v.children!.entries()){
   const nodeId=`use-${a}-${b}-${c}-${i}`;n.nodeId=nodeId;n.instanceRootOverrides!.nodeId=nodeId;n.instanceGeometry!.nodeId=nodeId;
   n.instanceRootOverrides!.fields=['height'];n.instanceRootOverrides!.localSize={width:54,height};n.instanceGeometry!.localSize.height=height;n.bbox!.height=height;
  }
  f.set.variants.push(v);
 }
 const out=fixed(f,'projection-unqualified');assert(out.parts.every(p=>!p.part.component!.rootOverrides?.height));
 assert(out.result.notes.some(n=>n.includes('a nested part carries at most a pair')));
});
test('Light/Dark promotion cannot authorize root channels from the selected mode alone',()=>{
 const f=fixture();f.set.propertyDefinitions={Theme:{type:'VARIANT',defaultValue:'Light',variantOptions:['Light','Dark']}};
 for(const [i,v]of f.set.variants.entries()){
  v.name='Theme='+['Light','Dark'][i];v.variantProperties={Theme:['Light','Dark'][i]};
  for(const n of v.children!){n.componentProperties!.Density='Compact';n.instanceGeometry!.localSize.height=60;n.instanceRootOverrides!.fields=['height'];n.instanceRootOverrides!.localSize={width:54,height:60};n.instanceRootOverrides!.mainSize!.height=60;n.bbox!.height=60;}
 }
 const out=fixed(f,'source-planes-unqualified',{projectionMode:'reviewable-inversion'});
 assert(out.result.notes.some(n=>n.includes('variant axis "Theme"')&&n.includes('IS a token-mode axis')));
});

test('rotation/reflection captured only on a later sibling retains fixed affine source allocation',()=>{
 for(const linear of [[[0,-1],[1,0]],[[-1,0],[0,1]]] as const){
  const f=fixture(),node=f.set.variants[1].children![2];
  const transform:[[number,number,number],[number,number,number]]=[[linear[0][0],linear[0][1],200],[linear[1][0],linear[1][1],0]];
  node.instanceGeometry!.transform=structuredClone(transform);node.instanceRootOverrides!.localTransform=structuredClone(transform);
  const out=fixed(f,'affine-unqualified');assert(out.parts.every(p=>p.part.component!.rootOverrides?.height));
  const affine=out.parts[2].part.instanceAffineLayout!;assert(affine);assert.equal(affine.rows.length,2);
  const wide=affine.rows.find(r=>r.values[0]==='wide')!;assert.deepEqual(wide.geometry.transform.map(r=>r.slice(0,2)),linear);
  assert.deepEqual(out.parts.map(p=>p.part.component!.props!.selected),[true,false,false]);
 }
 const absolute=fixture();absolute.set.variants[1].children![2].abs={x:0,y:0,right:0,bottom:0,width:54,height:44,constraints:{horizontal:'LEFT',vertical:'TOP'}};
 const out=fixed(absolute,'placement-unqualified');assert(out.parts[2].part.absolutePlacement||out.parts[2].part.absolutePlacementByCombination||out.result.notes.some(n=>n.includes('absolute')));
});
