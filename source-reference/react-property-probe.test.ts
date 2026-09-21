import type {CapturedNode} from '../extract/computed/lib.js';
import {observeReactPropertyEffects,planReactPropertyEffects} from './react-property-effects.js';
import {captureJs} from '../extract/computed/capture.js';
import {evidenceSha} from './react-validation-evidence.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactSourceProgram} from './react-source-program.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {probeReactProperty,probeReactInitialProperties} from './react-property-probe.js';
import {planReactInitialStates,observeReactInitialStates} from './react-initial-state.js';

test('real React property experiments preserve context and distinguish delivered props from rendered effects',async()=>{
 mkdirSync(path.join(process.cwd(),'private'),{recursive:true});
 const dir=mkdtempSync(path.join(process.cwd(),'private/react-property-fixture-')),browser=await chromium.launch();
 const source=`import React from 'react';
 export function Surface({tone='quiet',children}:{tone?:'quiet'|'loud';children?:React.ReactNode}){return <section style={{padding:tone==='loud'?20:8}}>{children}</section>}
 export function Toggle({checked=false}:{checked?:boolean}){return <input aria-label="controlled" type="checkbox" checked={checked} onChange={()=>{}}/>}
 export function Initial({defaultChecked=false}:{defaultChecked?:boolean}){return <input aria-label="initial" type="checkbox" defaultChecked={defaultChecked}/>}`;
 try{
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler'}}));
  writeFileSync(path.join(dir,'components.tsx'),source);
  const program=readReactSourceProgram(dir,['components.tsx']);assert.deepEqual(program.problems,[]);
  const registry=program.components.map(c=>`{identity:${JSON.stringify({module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span})},value:${c.exportName}}`).join(',');
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_CLONE_ELEMENT=React.cloneElement;window.__DSC_REACT_EXPORTS=[${registry}];flushSync(()=>createRoot(document.getElementById('mount')).render(<Surface><Toggle checked={false}/><Initial defaultChecked={false}/></Surface>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  await page.setContent('<style>body{margin:8.25px}</style><div id="mount"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const selector='#mount > section';
  const ownership=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;assert.deepEqual(ownership.problems,[]);
  const id=(name:string)=>ownership.components.find(c=>c.source.exportName===name)!.id;
  const observe=()=>page.locator(selector).evaluate(n=>({padding:getComputedStyle(n).padding,inputs:[...n.querySelectorAll('input')].map(n=>n.checked),text:n.textContent}));
  const baseline=await observe();
  const tone=await probeReactProperty(page,selector,program,id('Surface'),'tone',{kind:'set',value:'loud'},observe);
  assert.equal(tone.changed.padding,'20px');assert.deepEqual(tone.restored,baseline);assert.equal(tone.ownershipRestored,true);
  const checked=await probeReactProperty(page,selector,program,id('Toggle'),'checked',{kind:'set',value:true},observe);
  assert.deepEqual(checked.changed.inputs,[true,false]);assert.deepEqual(checked.restored,baseline);assert.equal(checked.ownershipRestored,true);
  const initial=await probeReactProperty(page,selector,program,id('Initial'),'defaultChecked',{kind:'set',value:true},observe);
  assert.deepEqual(initial.changed.inputs,[false,false],'delivering a default prop does not prove a live state change');
  assert.deepEqual(initial.restored,baseline);
  const mounted=await probeReactInitialProperties(page,selector,program,id('Initial'),{defaultChecked:{kind:'set',value:true}},observe);
  assert.deepEqual(mounted.changed.inputs,[false,true],'a fresh mount exercises initial state, unlike a live default prop update');
  assert.deepEqual(mounted.restored,baseline);assert.equal(mounted.ownershipRestored,true);
  const absent=await probeReactInitialProperties(page,selector,program,id('Initial'),{defaultChecked:{kind:'omit'}},observe);
  assert.deepEqual(absent.changed,baseline);assert.equal(absent.ownershipRestored,true);
  await assert.rejects(probeReactInitialProperties(page,selector,program,id('Initial'),{defaultChecked:{kind:'set',value:true}},async()=>{
   const v=await observe();if(v.inputs[1])throw Error('initial capture failed');return v;
  }),/initial capture failed/);
  assert.deepEqual(await observe(),baseline,'a failed initial-state observation restores the original mount');
  await page.evaluate(()=>{
   const renderer=[...(window as any).__DSC_REACT_OWNERSHIP.renderers.values()][0] as any;
   const original=renderer.scheduleRoot;
   renderer.scheduleRoot=(...args:any[])=>{renderer.scheduleRoot=original;original(...args);throw Error('initial renderer failed after scheduling');};
  });
  await assert.rejects(probeReactInitialProperties(page,selector,program,id('Initial'),{defaultChecked:{kind:'set',value:true}},observe),/initial renderer failed after scheduling/);
  assert.deepEqual(await observe(),baseline,'a partial remount failure restores the original root');
  assert.equal(await page.evaluate(()=>(window as any).__DSC_REACT_OWNERSHIP.propertyProbes.size),0);
  const omitted=await probeReactProperty(page,selector,program,id('Toggle'),'checked',{kind:'omit'},observe);
  assert.deepEqual(omitted.changed.inputs,[false,false]);assert.equal(omitted.ownershipRestored,true);
  for(const [property,value] of [['tone','unsupported'],['children','replace']] as const)
   await assert.rejects(probeReactProperty(page,selector,program,id('Surface'),property,{kind:'set',value},observe),/unsupported|outside-source-api/);
  assert.deepEqual(await observe(),baseline);
  await assert.rejects(probeReactProperty(page,selector,program,id('Surface'),'tone',{kind:'set',value:'loud'},async()=>{const v=await observe();if(v.padding==='20px')throw Error('capture failed');return v;}),/capture failed/);
  assert.deepEqual(await observe(),baseline,'capture failure restores props before returning');
  await page.evaluate(()=>{
   const renderer=[...(window as any).__DSC_REACT_OWNERSHIP.renderers.values()][0] as any;
   const original=renderer.overrideProps;
   renderer.overrideProps=(...args:any[])=>{renderer.overrideProps=original;original(...args);throw Error('renderer failed after scheduling');};
  });
  await assert.rejects(probeReactProperty(page,selector,program,id('Surface'),'tone',{kind:'set',value:'loud'},observe),/renderer failed after scheduling/);
  assert.deepEqual(await observe(),baseline,'a partial renderer failure also restores original props');
  assert.equal(await page.evaluate(()=>(window as any).__DSC_REACT_OWNERSHIP.propertyProbes.size),0);
  const retry=await probeReactProperty(page,selector,program,id('Surface'),'tone',{kind:'set',value:'loud'},observe);
  assert.equal(retry.ownershipRestored,true,'a failed probe does not leave an active experiment');
  await page.evaluate(()=>(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort());
  const tree=await page.evaluate(captureJs('#mount',undefined,'--',[selector])) as CapturedNode;
  const image=evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}));
  const initialPlan=planReactInitialStates(program,ownership,tree,id('Initial'));
  assert.deepEqual(initialPlan.axes,[{property:'defaultChecked',values:[{kind:'set',value:false},{kind:'set',value:true},{kind:'omit'}]}]);
  const initialStates=await observeReactInitialStates({page,program,ownership,tree,image,instanceId:id('Initial'),selector,stageSelector:'#mount',dir:path.join(dir,'initial-states'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.equal(initialStates.qualification,'finite-initial-mounts-only');
  assert.equal(initialStates.rows.length,3);assert.deepEqual(initialStates.problems,[]);
  assert(initialStates.rows.every(r=>r.status==='observed'&&r.restored),JSON.stringify(initialStates.rows));
  assert.equal(initialStates.rows[1].visibleChange,true);assert.equal(initialStates.rows[0].visibleChange,false);
  const selectedBounds=await page.locator('input[aria-label="initial"]').boundingBox();
  for(const row of initialStates.rows){
   const snapshot=JSON.parse(readFileSync(path.join(dir,'initial-states',row.id+'.json'),'utf8'));
   assert.equal(snapshot.initialSelection.instanceId,id('Initial'));
   assert.equal(snapshot.initialSelection.path,'1');
   assert.deepEqual(snapshot.initialSelection.bounds,selectedBounds,'nested frames measure the exact child in its original parent');
   assert.equal(snapshot.tree.tag,'section','the full parent remains the restoration and integrity boundary');
  }
  assert.deepEqual(await observe(),baseline);
  const plan=planReactPropertyEffects(program,ownership,tree,id('Surface'));
  assert.deepEqual(plan.plan.map(p=>p.requested),[{kind:'set',value:'quiet'},{kind:'set',value:'loud'},{kind:'omit'}]);
  const effects=await observeReactPropertyEffects({page,program,ownership,tree,image,instanceId:id('Surface'),selector,stageSelector:'#mount',dir:path.join(dir,'effects'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.deepEqual(effects.problems,[]);assert.equal(effects.rows.length,3);
  assert.ok(effects.rows.every(r=>r.status==='observed'&&r.restored),JSON.stringify(effects.rows));
  assert.equal(effects.rows[0].visibleChange,false);assert.equal(effects.rows[1].visibleChange,true);
  assert.ok(effects.rows[1].changedInstances?.some(i=>i.name==='Surface'&&i.channels.includes('padding-top')));
  const baselineBounds=await page.locator(selector).boundingBox();
  assert.ok(baselineBounds);
  assert.equal(baselineBounds.x,8.25);assert.equal(baselineBounds.y,8.25);
  for(const row of effects.rows){
   const snapshot=JSON.parse(readFileSync(path.join(dir,'effects',row.id+'.json'),'utf8'));
   assert.equal(row.propertyCaptureVersion,2);assert.equal(snapshot.propertyCaptureVersion,2);
   assert.equal(row.boundsSha256,evidenceSha(JSON.stringify(snapshot.bounds)));
   assert.equal(snapshot.boundsSha256,row.boundsSha256);
   assert.equal(snapshot.bounds.x,baselineBounds.x);assert.equal(snapshot.bounds.y,baselineBounds.y);
   assert.equal(snapshot.bounds.height,baselineBounds.height+(row.id==='1'?24:0),'changed padding is measured with each plane');
  }
  assert.equal(evidenceSha(await page.screenshot({fullPage:true,caret:'initial'})),image);
  const bad=structuredClone(ownership);bad.components[0].source.sourceSha256='0'.repeat(64);
  assert.throws(()=>planReactPropertyEffects(program,bad,tree,id('Surface')),/source-unqualified/);
  let guards=0;
  const interrupted=await observeReactPropertyEffects({page,program,ownership,tree,image,instanceId:id('Surface'),selector,stageSelector:'#mount',dir:path.join(dir,'interrupted'),assertCurrent:()=>{if(++guards>2)throw Error('source changed');},failures:{runtimeErrors:[],failedResources:[]}});
  assert.ok(interrupted.rows.every(r=>r.status==='refused'&&!r.image));
  assert.equal(interrupted.rows[1].problem,'prior-observation-invalidated-context');
  // A probe page that never matched the sealed original names which witness disagreed.
  const mismatched=await observeReactPropertyEffects({page,program,ownership,tree,image:'0'.repeat(64),instanceId:id('Surface'),selector,stageSelector:'#mount',dir:path.join(dir,'mismatched'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.equal(mismatched.rows[0].status,'refused');
  assert.equal(mismatched.rows[0].problem,'react-property-effects-original-not-restored:before-image;restored-image');
  assert.deepEqual(await observe(),baseline);

 }finally{await browser.close();rmSync(dir,{recursive:true,force:true})}
});
