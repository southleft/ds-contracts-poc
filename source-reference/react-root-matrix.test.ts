import {prepareReactRootSizing} from './react-root-sizing.js';
import {ContractSchema,tokensByPropEntries} from '../scripts/contract-schema.js';
import {enumerate} from '../extract/computed/lib.js';
import type {ReactRootVisual} from './react-root-visual.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactSourceProgram} from './react-source-program.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {observeReactPropertyMatrix} from './react-property-matrix.js';
import {assembleReactRootMatrix} from './react-root-matrix.js';
import {type ReactPropertySnapshot} from './react-root-variants.js';
import {captureJs} from '../extract/computed/capture.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {evidenceSha} from './react-validation-evidence.js';
import {emitReact} from '../core/emit-react.js';
import {emitReactInline} from '../core/emit-react-inline.js';
import {flattenTokens} from '../core/tokens.js';
import {mountGenerated,generatedTypeErrors} from '../core/react-test-runtime.js';

for(const defaulted of [true,false])test(`coupled source properties preserve typed React/native combinations with ${defaulted?'a declared default':'omission as its own plane'}`,async()=>{
 mkdirSync(path.join(process.cwd(),'private'),{recursive:true});
 const dir=mkdtempSync(path.join(process.cwd(),'private/root-matrix-fixture-')),browser=await chromium.launch();
 try{
  const source=`import React from 'react';
export function Surface({${defaulted?"tone='quiet'":'tone'},density='roomy',children}:{density?:'roomy'|'compact';tone?:'quiet'|'loud'|'null'|null;children?:React.ReactNode}){
 return <section style={{display:'flex',boxSizing:'border-box',height:tone==='loud'?(density==='compact'?72:96):(density==='compact'?64:80),width:tone==='loud'?240:undefined,gap:tone===null?'normal':tone==='loud'?20:8,padding:tone===null?2:tone==='loud'?(density==='compact'?28:16):4,backgroundColor:tone==='loud'?'var(--accent)':'var(--base)'}}>{children}</section>;
}`;
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler'}}));
  writeFileSync(path.join(dir,'surface.tsx'),source);
  const program=readReactSourceProgram(dir,['surface.tsx']);assert.deepEqual(program.problems,[]);
  const c=program.components[0],identity={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity)},value:Surface}];flushSync(()=>createRoot(document.getElementById('root')).render(<Surface>Original caller content</Surface>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  await page.setContent('<style>:root{--base:rgb(10, 20, 30);--twin:rgb(10, 20, 30);--accent:rgb(40, 50, 60)}</style><div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort());
  const selector='#root > section',ownership=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  const tree=await page.evaluate(captureJs('#root',undefined,'--',[selector])) as CapturedNode;
  const image=evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}));
  const effects=await observeReactPropertyMatrix({page,program,ownership,tree,image,selector,instanceId:ownership.components[0].id,dir:path.join(dir,'effects'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.ok(effects.rows.every(r=>r.status==='observed'),JSON.stringify(effects));
  const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(effects.rows.map(r=>[r.id,JSON.parse(readFileSync(path.join(dir,'effects',r.id+'.json'),'utf8'))]));
  const result=assembleReactRootMatrix(program,ownership,tree,effects,snapshots);assert.deepEqual(result.problems,[]);
  const draft=result.draft!;assert.equal(draft.status,'native-compiled',draft.problems.join(';'));
  assert.equal(draft.native!.variants.length,defaulted?8:10);assert.equal(JSON.stringify(draft.contract).includes('Original caller content'),false);
  assert.deepEqual(draft.contract!.anatomy.root.slot,{name:'children'});assert.equal(draft.contract!.anatomy.root.parts,undefined);
  assert.equal(effects.planned,15);
  assert.deepEqual(draft.sizing?.map(s=>[s.channel,s.status]),[['width','retained'],['height','retained']]);
  const codeValues=draft.contract!.props.find(p=>p.name==='tone')!.bindings.code.values!;
  assert.equal(Object.values(codeValues).filter(v=>v===null).length,1);assert.ok(Object.values(codeValues).includes('null'));
  assert.ok(flattenTokens(draft.tokens!).has('source.css.v'+Buffer.from('--accent').toString('hex')));
  assert.ok(draft.native!.variants.some(v=>v.spec.fill==='source/css/v'+Buffer.from('--accent').toString('hex')));
  const contract=draft.contract!,flat=flattenTokens(draft.tokens!),contracts=new Map([[contract.id,contract]]);
  for(const variant of draft.native!.variants){
   const values=Object.fromEntries(variant.name.split(', ').map(p=>p.split('=')));
   const tone=Object.hasOwn(codeValues,values.tone)?codeValues[values.tone]:undefined;
   const expectedPadding=tone===null?2:tone==='loud'?(values.density==='compact'?28:16):4;
   const ref=variant.spec.bindings!.paddingTop;
   assert.equal(parseFloat(String(flat.get(ref.replaceAll('/','.'))!.value)),expectedPadding,variant.name);
   assert.equal(variant.spec.fixedWidth?.px,tone==='loud'?240:undefined,variant.name+' fixed width');
   assert.equal(variant.spec.fixedHeight?.px,tone==='loud'?(values.density==='compact'?72:96):(values.density==='compact'?64:80),variant.name+' fixed height');
  }

  for(const format of ['inline','module']){
   const generated=format==='inline'?emitReactInline(contract,{tokens:{primitives:draft.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),contracts}):emitReact(contract,{tokens:new Set(flat.keys()),icons:new Map(),contracts});
   assert.deepEqual(generatedTypeErrors(contract.name,generated.tsx),[]);
   const consumer=await browser.newPage(),render=await mountGenerated(consumer,contract.name,generated.tsx,'css' in generated?generated.css as string:'');
   await consumer.addStyleTag({content:':root{'+[...flat].map(([k,v])=>`--${k.replaceAll('.','-')}:${v.value}`).join(';')+'}'});
   for(const row of effects.rows){
    await render({children:'Replacement text',...Object.fromEntries(Object.entries(row.changes).flatMap(([k,v])=>v.kind==='set'?[[k,v.value]]:[]))});
    const actual=await consumer.locator('#root > *').evaluate(n=>({text:n.textContent,style:Object.fromEntries(['height','padding-top','row-gap','background-color'].map(k=>[k,getComputedStyle(n).getPropertyValue(k)]))}));
    assert.equal(actual.text,'Replacement text');
    for(const [key,value] of Object.entries(actual.style))assert.equal(value,key==='row-gap'&&row.changes.tone.kind==='set'&&row.changes.tone.value===null?'0px':snapshots[row.id].tree.style[key],`${format} ${JSON.stringify(row.changes)} ${key}`);
   }
   await consumer.close();
  }

  if(defaulted){
   const conflicting=structuredClone(snapshots),omission=effects.rows.find(r=>r.changes.tone.kind==='omit')!;
   conflicting[omission.id].styleOrigin!.roots[0].channels.find(c=>c.channel==='background-color')!.variable='--twin';
   assert.ok(assembleReactRootMatrix(program,ownership,tree,effects,conflicting).draft!.problems.includes('react-root-matrix-default-provenance-differs'));
  }
  const missing={...snapshots};delete missing[effects.rows[0].id];
  assert.equal(assembleReactRootMatrix(program,ownership,tree,effects,missing).draft!.status,'refused');
  const changed=structuredClone(snapshots);changed[effects.rows[0].id].tree.style['padding-top']='100px';
  assert.equal(assembleReactRootMatrix(program,ownership,tree,effects,changed).draft!.status,'refused');
  const wrong=structuredClone(effects);wrong.rows[0].changes.tone={kind:'set',value:'unobserved'};
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,wrong,snapshots).draft,undefined);
  const heldChanged=structuredClone(snapshots);heldChanged[effects.rows[0].id].ownership.components[0].props.unselected='changed';
  assert.equal(assembleReactRootMatrix(program,ownership,tree,effects,heldChanged).draft!.status,'refused');
  const incomplete=structuredClone(effects);incomplete.rows.pop();
  assert.equal(assembleReactRootMatrix(program,ownership,tree,incomplete,snapshots).draft,undefined);
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,snapshots),result,'repeat assembly is deterministic');
 }finally{await browser.close();rmSync(dir,{recursive:true,force:true})}
});


test('conditional size bindings preserve prototype-like enum values as own keys',()=>{
 const values=['small','__proto__','auto'],axes=[{prop:'size',values}],base={size:'small'};
 const contract=ContractSchema.parse({id:'test.sizing',name:'Sizing',version:'0.1.0',status:'draft',description:'Sizing fixture',props:[{name:'size',type:{enum:values},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'size',values:Object.fromEntries(values.map(v=>[v,v]))}}}],states:[],semantics:{element:'section'},anatomy:{root:{slot:{name:'children'},tokensByProp:{prop:'size',map:{small:{color:'{ink}'}}}}},bindings:{code:{anchors:{importPath:'test',export:'Sizing'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const projections=new Map(enumerate(axes,[],10,base).combos.map(combo=>[combo.key,{sourceSizing:[{channel:'width',status:combo.axisValues.size==='auto'?'auto':'fixed',value:combo.axisValues.size==='auto'?'auto':combo.axisValues.size==='small'?'20px':'40px',selectors:[]},{channel:'height',status:'auto',value:'auto',selectors:[]}]} as Pick<ReactRootVisual['roots'][number],'sourceSizing'>]));
 const plan=prepareReactRootSizing(axes,base,new Map(),projections),tokens={};
 plan.apply(contract,tokens);plan.verify(contract,tokens);
 const map=tokensByPropEntries(contract.anatomy.root)[0].map;
 assert.ok(Object.hasOwn(map,'__proto__'));assert.ok(Object.hasOwn(map.__proto__,'width'));
 assert.equal(Object.hasOwn(Object.prototype,'width'),false);
});
