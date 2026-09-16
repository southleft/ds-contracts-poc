import type {CapturedNode} from '../extract/computed/lib.js';
import {observeReactPropertyEffects,planReactPropertyEffects} from './react-property-effects.js';
import {captureJs} from '../extract/computed/capture.js';
import {evidenceSha} from './react-validation-evidence.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactSourceProgram} from './react-source-program.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {probeReactProperty} from './react-property-probe.js';

test('real React property experiments preserve context and distinguish delivered props from rendered effects',async()=>{
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
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_EXPORTS=[${registry}];flushSync(()=>createRoot(document.getElementById('mount')).render(<Surface><Toggle checked={false}/><Initial defaultChecked={false}/></Surface>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  await page.setContent('<div id="mount"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
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
  const plan=planReactPropertyEffects(program,ownership,tree,id('Surface'));
  assert.deepEqual(plan.plan.map(p=>p.requested),[{kind:'set',value:'quiet'},{kind:'set',value:'loud'},{kind:'omit'}]);
  const effects=await observeReactPropertyEffects({page,program,ownership,tree,image,instanceId:id('Surface'),selector,stageSelector:'#mount',dir:path.join(dir,'effects'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.deepEqual(effects.problems,[]);assert.equal(effects.rows.length,3);
  assert.ok(effects.rows.every(r=>r.status==='observed'&&r.restored),JSON.stringify(effects.rows));
  assert.equal(effects.rows[0].visibleChange,false);assert.equal(effects.rows[1].visibleChange,true);
  assert.ok(effects.rows[1].changedInstances?.some(i=>i.name==='Surface'&&i.channels.includes('padding-top')));
  assert.equal(evidenceSha(await page.screenshot({fullPage:true,caret:'initial'})),image);
  const bad=structuredClone(ownership);bad.components[0].source.sourceSha256='0'.repeat(64);
  assert.throws(()=>planReactPropertyEffects(program,bad,tree,id('Surface')),/source-unqualified/);
  let guards=0;
  const interrupted=await observeReactPropertyEffects({page,program,ownership,tree,image,instanceId:id('Surface'),selector,stageSelector:'#mount',dir:path.join(dir,'interrupted'),assertCurrent:()=>{if(++guards>2)throw Error('source changed');},failures:{runtimeErrors:[],failedResources:[]}});
  assert.ok(interrupted.rows.every(r=>r.status==='refused'&&!r.image));
  assert.equal(interrupted.rows[1].problem,'prior-observation-invalidated-context');
  assert.deepEqual(await observe(),baseline);

 }finally{await browser.close();rmSync(dir,{recursive:true,force:true})}
});
