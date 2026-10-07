import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';import {emitReactInline} from './emit-react-inline.js';import {reactEmitter} from './emitter.js';import {createFigmaEngine} from './emit-figma-script.js';import {mountGenerated} from './react-test-runtime.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(){return ContractSchema.parse({id:'test.item-stretch',name:'ItemStretch',version:'0.1.0',status:'draft',description:'A cross-axis fill carries a nested main-axis allocation',semantics:{element:'div'},props:[],states:[],
 anatomy:{root:{layout:{display:'flex',direction:'row',align:'start'},literals:{width:'100px',height:'fit-content','min-height':'60px'},parts:{connector:{layout:{display:'flex',direction:'column',align:'center',alignSelf:'stretch'},literals:{gap:'8px'},parts:{icon:{shape:{kind:'rect',width:20,height:20}},line:{layout:{grow:true,growBasis:'zero'},literals:{width:'2px','background-color':'#606060'}}}},label:{shape:{kind:'rect',width:30,height:20}}}}},bindings:{code:{anchors:{importPath:'./ItemStretch',export:'ItemStretch'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});}
test('per-item stretch preserves an intrinsic sibling and establishes nested fill on both React surfaces and native compilation',async t=>{
 const c=fixture();c.anatomy.root.parts!.connector.declared={position:'relative'};
 const contracts=new Map([[c.id,c]]),files=reactEmitter.emit(c,{tokens,contracts,icons:new Map(),mode:'light'}),browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [{tsx:emitReactInline(c,{tokens,contracts,icons:new Map()}).tsx,css:''},{tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]){
  const page=await browser.newPage();await mountGenerated(page,c.name,output.tsx,output.css);
  assert.deepEqual(await page.locator('#root > :first-child').evaluate(root=>[root,root.children[0],root.children[0].children[1],root.children[1]].map(n=>n.getBoundingClientRect().height)),[60,60,32,20]);await page.close();
 }
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts),connector=data.variants[0].spec.children![0];
 assert.equal(connector.fillH,true);assert.equal(connector.children![1].fillH,true);assert.equal(data.variants[0].spec.children![1].fillH,undefined);assert(!JSON.stringify(data).includes('crossStretch'));
});
test('native stretch refuses missing allocation and fixed competing size; unsupported owners refuse before emission',()=>{
 for(const edit of [(c:any)=>delete c.anatomy.root.literals['min-height'],(c:any)=>c.anatomy.root.parts.connector.literals.height='15px']){
  const c=fixture();edit(c);assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]])),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED/);
 }
 const c=fixture();c.anatomy.root.layout!.alignSelf='stretch';assert.throws(()=>emitReactInline(c,{tokens,icons:new Map(),contracts:new Map([[c.id,c]])}),/cross-axis-stretch-owner-unqualified/);
});

test('a conditional auto reset preserves the intrinsic plane on both React surfaces', async t => {
 const c=fixture();
 c.props=[{name:'state',type:{enum:['default','focus']},default:'default',bindings:{code:{prop:'state'},figma:{kind:'VARIANT',property:'State',values:{default:'Default',focus:'Focus'}}}}];
 const connector=c.anatomy.root.parts!.connector;
 delete connector.parts!.line;
 connector.layoutByProp={prop:'state',map:{focus:{alignSelf:'auto'}}};
 const contracts=new Map([[c.id,c]]),ctx={tokens,contracts,icons:new Map(),mode:'light' as const};
 const files=reactEmitter.emit(c,ctx),browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [{tsx:emitReactInline(c,ctx).tsx,css:''},{tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]) {
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,output.tsx,output.css);
  for(const [state,height] of [['default',60],['focus',20]] as const) {
   await render({state});
   assert.equal(await page.locator('#root > :first-child > :first-child').evaluate(n=>n.getBoundingClientRect().height),height);
  }
  await page.close();
 }
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 assert.deepEqual(data.variants.map(v=>v.spec.children![0].fillH),[true,undefined]);
});

test('a column stretches width without stealing the main-axis allocation',()=>{
 const c=fixture();c.anatomy.root.layout!.direction='column';
 const connector=c.anatomy.root.parts!.connector;delete connector.parts!.line;
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(data.variants[0].spec.children![0].fillW,true);
 assert.equal(data.variants[0].spec.children![0].fillH,undefined);
});

import {emitHtml} from './emit-html.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
test('unsupported surfaces and conflicting placement owners refuse explicitly',()=>{
 const c=fixture(),contracts=new Map([[c.id,c]]);
 assert.throws(()=>emitHtml(c,{tokens:new Set(),icons:new Map(),contracts}),/HTML_ITEM_STRETCH_UNSUPPORTED/);
 assert.doesNotThrow(()=>emitWebComponent(c,{tokens:new Set(),icons:new Map(),contracts}));
 for(const edit of [(c:any)=>c.anatomy.root.parts.connector.declared={position:'absolute'},
  (c:any)=>c.anatomy.root.parts.connector.declared={position:'relative',top:'1px'},
  (c:any)=>{c.anatomy.root.parts.connector.declared={position:'relative'};c.anatomy.root.parts.connector.declaredStates={hover:{left:'1px'}};},
  (c:any)=>c.anatomy.root.layout.display='grid',
  (c:any)=>c.anatomy.root.parts.connector.text='unexpected']) {
  const bad=fixture();edit(bad);
  assert.throws(()=>emitReactInline(bad,{tokens,icons:new Map(),contracts:new Map([[bad.id,bad]])}),/cross-axis-stretch-owner-unqualified/);
 }
});

import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import type {NativePreparedLibrarySource} from './native-prepared-library.js';
test('native prepared writer and independent readback retain both levels of stretch',async()=>{
 const f=await nativeComparisonFixture(),c=fixture(),contracts=new Map([[c.id,c]]);
 const tokenTree={primitives:f.tokens,semantic:{},light:{},dark:{},brands:{default:{}}};
 const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokenTree).slice(7)};
 const operation={id:'40000000-0000-4000-8000-000000000251',fileKey:f.figma.fileKey};
 const compiled=f.engine.compileNativePreparedLibrary(c,contracts,source,operation.id);
 const routed=layeredNativeTokenModes(tokenTree,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
 const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
 const allocated=await f.run(emitNativeTokenContextScript(tokenInput).script);
 assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
 const observed=await f.run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
 const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
 const creation=await f.run(f.engine.buildNativePreparedLibraryScript(c,contracts,source,context));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation,planRevision:revisionOf(compiled),projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,graphVerification:2 as const,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
 const receipt=await f.run(emitNativePreparedLibraryReadbackScript(input));
 assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(input,receipt)));
 for(const name of ['connector','line']) {
  const node=receipt.nodes.find((n:any)=>n.name===name);assert(node,name);
  assert.equal(node.values.layoutSizingVertical,'FILL');
  const changed=structuredClone(receipt);
  changed.nodes.find((n:any)=>n.id===node.id).values.layoutSizingVertical='HUG';
  assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused',name+' lost allocation');
 }
});

test('implicit flex on a nested parent preserves explicit-flex React and native output',()=>{
 const explicit=fixture();
 const parent=explicit.anatomy.root;
 explicit.anatomy.root={layout:{display:'flex',direction:'column'},parts:{container:parent}};
 const implicit=structuredClone(explicit);
 delete implicit.anatomy.root.parts!.container.layout!.display;
 const output=(c:typeof explicit)=>{
  const contracts=new Map([[c.id,c]]),ctx={tokens,contracts,icons:new Map(),mode:'light' as const};
  return {modules:reactEmitter.emit(c,ctx),inline:emitReactInline(c,ctx),native:createFigmaEngine(ctx).compileComponentData(c,contracts).variants};
 };
 assert.deepEqual(output(implicit),output(explicit));
 const absent=structuredClone(implicit);delete absent.anatomy.root.parts!.container.layout;
 assert.throws(()=>output(absent),/cross-axis-stretch-owner-unqualified/);
});

test('Web Component stretch preserves sibling sizing and resets to intrinsic height',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {build}=await import('esbuild');const {tagOf}=await import('../packages/emitter-web-components/src/emit-wc.js');
 const c=fixture();delete c.anatomy.root.parts!.connector.parts!.line;
 c.props=[{name:'mode',type:{enum:['fill','intrinsic']},default:'fill',bindings:{code:{prop:'mode'},figma:{kind:'VARIANT',property:'Mode'}}}];
 c.anatomy.root.parts!.connector.layoutByProp={prop:'mode',map:{intrinsic:{alignSelf:'auto'}}};
 const contracts=new Map([[c.id,c]]),out=emitWebComponent(c,{contracts,tokens:new Set(),icons:new Map()}),tag=tagOf(c);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wc-item-stretch-')),browser=await chromium.launch();
 try{
  fs.writeFileSync(path.join(dir,tag+'.ts'),out.element);fs.writeFileSync(path.join(dir,tag+'.css.ts'),out.stylesheet);
  const bundle=await build({entryPoints:[path.join(dir,tag+'.ts')],bundle:true,write:false,format:'iife',target:'es2022'});
  const page=await browser.newPage();await page.setContent(`<${tag}></${tag}>`);await page.addScriptTag({content:bundle.outputFiles[0].text});
  for(const [mode,height] of [['fill',60],['intrinsic',20],['fill',60]] as const){
   await page.locator(tag).evaluate((node,value)=>node.setAttribute('mode',value),mode);
   assert.deepEqual(await page.locator(tag).locator('[part="root"]').evaluate(root=>[root,root.children[0],root.children[1]].map(n=>n.getBoundingClientRect().height)),[60,height,20]);
  }
 }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
 const invalid=structuredClone(c);invalid.anatomy.root.parts!.connector.declared={position:'absolute'};
 assert.throws(()=>emitWebComponent(invalid,{contracts:new Map([[invalid.id,invalid]]),tokens:new Set(),icons:new Map()}),/cross-axis-stretch-owner-unqualified/);
});
