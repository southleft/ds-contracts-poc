import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {chromium} from 'playwright-core';
import {mountGenerated} from './react-test-runtime.js';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema} from '../scripts/contract-schema.js';
import {proposeFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpSet} from '../extract/figma/types.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(){
 const children=Array.from({length:4},(_,i)=>ContractSchema.parse({id:`ds.child${i}`,name:`Child${i}`,version:'0.1.0',status:'draft',description:'Independently linked child',semantics:{element:'div'},states:[],props:[],anatomy:{root:{text:`CHILD_${i}`}},bindings:{code:{anchors:{importPath:`./Child${i}`,export:`Child${i}`}},figma:{anchors:{fileKey:'fixture',componentSetKey:`key${i}`}}}}));
 const variants=['Vertical','Horizontal'].flatMap((Layout,a)=>['false','true'].map((Actions,b)=>({name:`Layout=${Layout}, Actions=${Actions}`,type:'COMPONENT' as const,variantProperties:{Layout,Actions},children:[{name:'main',type:'INSTANCE' as const,instanceOf:`Child${a*2+b}`,instanceKey:`key${a*2+b}`}]})));
 const set:DumpSet={setName:'Holder',type:'COMPONENT_SET',propertyDefinitions:{Layout:{type:'VARIANT',defaultValue:'Vertical',variantOptions:['Vertical','Horizontal']},Actions:{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']}},variants};
 let minted:Record<string,unknown>={};let mintedEntries:{ref:string;value:unknown}[]=[];
 const read=()=>{const p=proposeFromDump(set,{corpus:tokenCorpusFromJson({...tokens,brandDefault:{}}),mintUnbound:true,fileKey:'fixture',contractIdByName:new Map(children.map(c=>[c.name,c.id])),contractIdByKey:new Map(children.map((c,i)=>[`key${i}`,c.id])),contractsById:new Map(children.map(c=>[c.id,asMinimalChildContract(c)]))});minted=p.mintedTokens?.tree??{};mintedEntries=p.mintedTokens?.entries??[];return ContractSchema.parse(p.contract);};
 return {children,set,read,getEntries:()=>mintedEntries,getTokens:()=>({...tokens,primitives:minted})};
}
test('two-axis keyed replacements select exactly the observed child in both React emitters and native variants',()=>{
 for(const reverse of [false,true]){
  const f=fixture();if(reverse)f.set.variants.reverse();const c=f.read(),contracts=new Map([c,...f.children].map(c=>[c.id,c]));
  for(const inline of [false,true]){
   const loaded=new Map<string,any>(),req=createRequire(import.meta.url);
   for(const component of [...f.children,c]){
    const tsx=inline?emitReactInline(component,{tokens,icons:new Map(),contracts}).tsx:emitReact(component,{tokens:new Set(),icons:new Map(),contracts}).tsx;
    const module={exports:{} as any};vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>loaded.get(p)??(p.endsWith('.css')?{default:new Proxy({},{get:(_,k)=>String(k)})}:req(p))});loaded.set('./'+component.name,module.exports);loaded.set('../'+component.name,module.exports);
   }
   const C=loaded.get('./'+c.name)[c.name];
   for(const [a,layout]of ['vertical','horizontal'].entries())for(const [b,actions]of [false,true].entries()){
    const html=renderToStaticMarkup(React.createElement(C,{layout,actions}));assert.deepEqual(html.match(/CHILD_\d/g),[`CHILD_${a*2+b}`]);
   }
  }
  const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
  for(const v of data.variants){const ids:string[]=[];const walk=(s:any)=>{if(s.dep)ids.push(s.dep);for(const n of s.children??[])walk(n);};walk(v.spec);
   const i=(v.name.includes('Horizontal')?2:0)+(v.name.includes('Actions=true')?1:0);assert.deepEqual(ids,[`Child${i}`],v.name);
  }
 }
});
test('keyed presence does not accept an unlinked replacement identity',()=>{
 const f=fixture();f.set.variants[0].children![0].instanceKey='foreign';assert.throws(()=>f.read(),/unlinked-or-conflicting-owner:foreign/);
});

test('keyed identity selection retains independent captured visibility in both React emitters and native variants',()=>{
 const f=fixture();
 for(const v of f.set.variants){const child=v.children![0]!,i=v.name.includes('Actions=true')?1:0;child.instanceOf=`Child${i}`;child.instanceKey=`key${i}`;child.hidden=v.name.includes('Horizontal');}
 const c=f.read(),contracts=new Map([c,...f.children].map(c=>[c.id,c]));
 for(const inline of [false,true]){
  const loaded=new Map<string,any>(),req=createRequire(import.meta.url);
  for(const component of [...f.children,c]){
   const tsx=inline?emitReactInline(component,{tokens,icons:new Map(),contracts}).tsx:emitReact(component,{tokens:new Set(),icons:new Map(),contracts}).tsx;
   const module={exports:{} as any};vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>loaded.get(p)??(p.endsWith('.css')?{default:new Proxy({},{get:(_,k)=>String(k)})}:req(p))});loaded.set('./'+component.name,module.exports);loaded.set('../'+component.name,module.exports);
  }
  const C=loaded.get('./'+c.name)[c.name];
  for(const layout of ['vertical','horizontal'])for(const actions of [false,true]){
   const html=renderToStaticMarkup(React.createElement(C,{layout,actions}));assert.deepEqual(html.match(/CHILD_\d/g)??[],layout==='horizontal'?[]:[`CHILD_${actions?1:0}`]);
  }
 }
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 for(const v of data.variants){const ids:string[]=[];const walk=(s:any)=>{if(s.dep)ids.push(s.dep);for(const n of s.children??[])walk(n);};walk(v.spec);assert.deepEqual(ids,v.name.includes('Horizontal')?[]:[`Child${v.name.includes('Actions=true')?1:0}`]);}
 const bound=fixture();bound.set.variants[0]!.children![0]!.bound={visible:'runtime.visibility'};assert.throws(()=>bound.read(),/replacement-live-visibility-unqualified/);
});

test('horizontal STRETCH allocation crosses the keyed owner without changing child defaults',()=>{
 const f=fixture();for(const v of f.set.variants){v.bbox={width:100,height:12};v.children![0]!.abs={x:0,y:0,right:0,bottom:0,width:100,height:12,constraints:{horizontal:'STRETCH',vertical:'TOP'}};}
 const c=f.read(),contracts=new Map([c,...f.children].map(c=>[c.id,c]));
 const owner=Object.values(c.anatomy.root.parts!)[0]!;assert(Object.values(owner.parts!).every(p=>p.layout?.grow===true));
 const resolved=f.getTokens();const data=createFigmaEngine({tokens:resolved,icons:new Map()}).compileComponentData(c,contracts);
 // The contract expresses allocation through the existing grow carrier;
 // generated child definitions retain their original content and API.
 for(const child of f.children)assert.equal(child.anatomy.root.layout,undefined);
 assert.match(emitReactInline(c,{tokens:resolved,icons:new Map(),contracts}).tsx,/"flex": "1 1 auto"/);
 for(const v of data.variants){const deps:any[]=[];const walk=(n:any)=>{if(n.dep)deps.push(n);for(const child of n.children??[])walk(child);};walk(v.spec);assert.equal(deps.length,1);assert.equal(deps[0].grow,true);}
});


test('in-flow horizontal FILL survives keyed replacement under row and column parents at multiple widths',async()=>{
 const browser=await chromium.launch();
 try{for(const mode of ['HORIZONTAL','VERTICAL'] as const){
  const f=fixture();
  for(const v of f.set.variants){
   v.bbox={width:240,height:24};
   v.layout={mode,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED',counter:'MIN'};
   v.children![0]!.fillWidth=true;
   v.children![0]!.instanceSizing={horizontal:'FILL',vertical:'FIXED',height:24};
  }
  const c=f.read(),resolved=f.getTokens(),contracts=new Map([c,...f.children].map(c=>[c.id,c]));
  const owner=Object.values(c.anatomy.root.parts!)[0]!;
  assert(Object.values(owner.parts!).every(p=>p.layout?.grow===true));
  if(mode==='HORIZONTAL')assert.equal(owner.layout?.grow,true);
  else assert.equal(owner.literals?.width,'100%');
  const icons=new Map<string,string>();
  for(const inline of [false,true]){
   const emit=(component:typeof c)=>inline?{...emitReactInline(component,{tokens:resolved,icons,contracts}),css:''}:emitReact(component,{tokens:new Set(f.getEntries().map(e=>e.ref.slice(1,-1))),icons,contracts});
   const code=emit(c),dependencies=Object.fromEntries(f.children.map(child=>[child.name,emit(child)]));
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,c.name,code.tsx,code.css,dependencies);
    await page.addStyleTag({content:':root{'+f.getEntries().map(e=>'--'+e.ref.slice(1,-1).replaceAll('.','-')+':'+e.value).join(';')+'}'});
    for(const width of [160,320])for(const layout of ['vertical','horizontal'])for(const actions of [false,true]){
     await render({layout,actions,style:{width}});
     const widths=await page.locator('#root > *').evaluate(root=>[root,...root.querySelectorAll('*')].map(n=>n.getBoundingClientRect().width));
     assert.equal(widths.length,3);assert.deepEqual(widths,[width,width,width],`${mode}/${inline}/${layout}/${actions}`);
    }
   }finally{await page.close();}
  }
  const data=createFigmaEngine({tokens:resolved,icons}).compileComponentData(c,contracts);
  for(const v of data.variants){const deps:any[]=[];const walk=(n:any)=>{if(n.dep)deps.push(n);for(const child of n.children??[])walk(child);};walk(v.spec);assert.equal(deps.length,1);assert.equal(deps[0].grow,true);}
 }}finally{await browser.close();}
});

test('keyed fixed instances do not acquire horizontal fill',()=>{
 const f=fixture();for(const v of f.set.variants){v.layout={mode:'HORIZONTAL',padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'};v.children![0]!.instanceSizing={horizontal:'FIXED',vertical:'FIXED',width:40,height:12};}
 const c=f.read(),owner=Object.values(c.anatomy.root.parts!)[0]!;
 assert.equal(owner.layout?.grow,undefined);assert.equal(owner.literals?.width,undefined);
 assert(Object.values(owner.parts!).every(p=>p.layout?.grow!==true));
});
