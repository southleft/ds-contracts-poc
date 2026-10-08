import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {createRequire} from 'node:module';import {transformSync} from 'esbuild';import * as React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {chromium} from 'playwright-core';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';import {createFigmaEngine} from './emit-figma-script.js';
function fixture():Contract{return ContractSchema.parse({id:'test.state-presence',name:'StatePresence',version:'0.1.0',status:'draft',description:'Observed interaction presence fixture',semantics:{element:'button'},states:['hover'],props:[{name:'show',type:'boolean',default:false,bindings:{code:{prop:'show'},figma:{kind:'VARIANT',property:'Show',values:{true:'True',false:'False'}}}}],anatomy:{root:{literals:{width:'100px',height:'40px'},parts:{label:{text:'Witness',presenceByState:{props:['show'],states:['default','hover'],rows:[{values:['false'],state:'default',present:false},{values:['true'],state:'default',present:true},{values:['false'],state:'hover',present:true},{values:['true'],state:'hover',present:true}]}}}}},bindings:{code:{anchors:{importPath:'./StatePresence',export:'StatePresence'},statePreviews:true},figma:{anchors:{fileKey:null,componentSetKey:null},statePreviews:true}}});}
test('contract validation rejects incomplete presence and conflicting boolean visibility',()=>{
 const c=fixture();assert(c.anatomy.root.parts!.label.presenceByState);
 const incomplete=structuredClone(c);incomplete.anatomy.root.parts!.label.presenceByState!.rows.pop();assert.equal(ContractSchema.safeParse(incomplete).success,false);
 const conflict=structuredClone(c);conflict.anatomy.root.parts!.label.visibleWhen={prop:'show'};assert.equal(ContractSchema.safeParse(conflict).success,false);
});
test('actual CSS-module emitter retains hover-only text and native previews agree',async()=>{
 const c=fixture(),contracts=new Map([[c.id,c]]),result=emitReact(c,{tokens:new Set(),icons:new Map(),contracts});
 const req=createRequire(import.meta.url),module={exports:{} as any};
 vm.runInNewContext(transformSync(result.tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>p.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})}:req(p)});
 const html=renderToStaticMarkup(React.createElement(module.exports.StatePresence,{show:false}));assert(html.includes('Witness'));
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.setContent(`<style>${result.css}</style>${html}`);
  assert.equal(await page.getByText('Witness').isVisible(),false);await page.locator('button').hover();assert.equal(await page.getByText('Witness').isVisible(),true);
 }finally{await browser.close();}
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 const has=(node:any):boolean=>node.name==='label'||(node.children??[]).some(has);
 const rest=data.variants.find(v=>v.name.includes('Show=False')&&!v.name.includes('Hover'));
 const hover=data.stateVariants?.find(v=>v.name.includes('Show=False')&&v.name.includes('Hover'));
 assert(rest&&hover,JSON.stringify(data.variants.map(v=>v.name)));assert.equal(has(rest.spec),false);assert.equal(has(hover.spec),true);
});
import {proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';import {walkAnatomy} from '../scripts/contract-schema.js';
test('public proposer retains newly present text and its observed Boolean-dependent state paint',()=>{
 const set:any={setName:'State presence',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']},Show:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']},Leading:{type:'VARIANT',defaultValue:'Plain',variantOptions:['Plain','Avatar']}},variants:['Default','Hover'].flatMap(state=>['False','True'].flatMap(show=>['Plain','Avatar'].map(leading=>({name:`State=${state}, Show=${show}, Leading=${leading}`,type:'COMPONENT',variantProperties:{State:state,Show:show,Leading:leading},nodeId:`${state}-${show}-${leading}`,children:state==='Hover'&&leading==='Avatar'||show==='True'?[{name:'Label',type:'TEXT',nodeId:`label-${state}-${show}-${leading}`,fill:{hex:state==='Hover'&&show==='False'?'737373':'525252'},text:{characters:'Witness',fontSize:12,fontStyle:'Regular',lineHeight:16}}]:[]}))))};
 const result=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',stampsObservable:true});
 const c=ContractSchema.parse(result.contract),part=walkAnatomy(c).find(w=>w.part.presenceByState)?.part;
 assert(part,'source-owned part must retain state presence');assert.equal(part.visibleWhen,undefined);assert(c.states.includes('hover'));
 assert.match(part.states?.hover?.color??'',/\{show\}/);
 assert.equal(part.presenceByState!.rows.length,8);assert.equal(part.presenceByState!.rows.filter(r=>r.present).length,5);
 const missing=structuredClone(set);delete missing.variants.find((v:any)=>v.variantProperties.State==='Hover'&&v.variantProperties.Show==='False'&&v.variantProperties.Leading==='Avatar').children[0].fill;
 const refusedPaint=proposeFromDump(missing,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',stampsObservable:true});
 const absentPaint=walkAnatomy(ContractSchema.parse(refusedPaint.contract)).find(w=>w.part.presenceByState)?.part;
 assert.equal(absentPaint?.states?.hover?.color,undefined,'unobserved visible paint must not be filled from another tuple');
});
