import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readReactSourceProgram} from './react-source-program.js';
import {reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {observeReactPropertyEffects} from './react-property-effects.js';
import {assembleReactRootVariants,type ReactPropertySnapshot} from './react-root-variants.js';
import {captureJs} from '../extract/computed/capture.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {evidenceSha} from './react-validation-evidence.js';
import {emitReact} from '../core/emit-react.js';
import {emitReactInline} from '../core/emit-react-inline.js';
import {flattenTokens} from '../core/tokens.js';
import {mountGenerated,generatedTypeErrors} from '../core/react-test-runtime.js';
import {observeReactPropertyPlan} from './react-property-effects.js';

for(const defaulted of [true,false])test(`source property planes preserve typed React/native variants with ${defaulted?'a declared default':'omission as its own plane'}`,async()=>{
 mkdirSync(path.join(process.cwd(),'private'),{recursive:true});
 const dir=mkdtempSync(path.join(process.cwd(),'private/root-variants-fixture-')),browser=await chromium.launch();
 try{
  const source=`import React from 'react';
export function Surface({${defaulted?"tone='quiet'":'tone'},children}:{tone?:'quiet'|'loud'|'null'|null;children?:React.ReactNode}){
 return <section style={{display:'flex',gap:tone===null?'normal':tone==='loud'?20:8,padding:tone===null?2:tone==='loud'?16:4,backgroundColor:tone==='loud'?'var(--accent)':'var(--base)'}}>{children}</section>;
}`;
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler'}}));
  writeFileSync(path.join(dir,'surface.tsx'),source);
  const program=readReactSourceProgram(dir,['surface.tsx']);assert.deepEqual(program.problems,[]);
  const c=program.components[0],identity={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity)},value:Surface}];flushSync(()=>createRoot(document.getElementById('root')).render(<Surface>Original caller content</Surface>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  const font=readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
  await page.setContent('<style>@font-face{font-family:AppAlias;src:url(data:font/woff2;base64,'+font+')}section{font-family:AppAlias}:root{--base:rgb(10, 20, 30);--accent:rgb(40, 50, 60)}</style><div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort());
  const selector='#root > section',ownership=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  const tree=await page.evaluate(captureJs('#root',undefined,'--',[selector])) as CapturedNode;
  const image=evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}));
  const effects=await observeReactPropertyEffects({page,program,ownership,tree,image,selector,instanceId:ownership.components[0].id,dir:path.join(dir,'effects'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.ok(effects.rows.every(r=>r.status==='observed'),JSON.stringify(effects));
  const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(effects.rows.map(r=>[r.id,JSON.parse(readFileSync(path.join(dir,'effects',r.id+'.json'),'utf8'))]));
  const result=assembleReactRootVariants(program,ownership,tree,effects,snapshots);assert.deepEqual(result.problems,[]);
  const draft=result.drafts[0];assert.equal(draft.status,'native-compiled',draft.problems.join(';'));
  assert.ok(effects.rows.every(r=>r.fontsSha256===evidenceSha(JSON.stringify(snapshots[r.id].fonts))));
  assert.ok(Object.values(snapshots).every(s=>s.tree.style['font-family']==='AppAlias'));
  assert.equal(draft.contract!.anatomy.root.declared?.['font-family'],'"IBM Plex Sans"');
  const substitutedFonts=structuredClone(snapshots);substitutedFonts[effects.rows[0].id].fonts!.rows[0].fonts[0].familyName='Other';
  assert.deepEqual(assembleReactRootVariants(program,ownership,tree,effects,substitutedFonts).drafts[0].problems,['react-property-font-evidence-unverified']);
  assert.equal(draft.native!.variants.length,defaulted?4:5);assert.equal(JSON.stringify(draft.contract).includes('Original caller content'),false);
  assert.deepEqual(draft.contract!.anatomy.root.slot,{name:'children'});assert.equal(draft.contract!.anatomy.root.parts,undefined);
  const codeValues=draft.contract!.props[0].bindings.code.values!;
  assert.equal(Object.values(codeValues).filter(v=>v===null).length,1);assert.ok(Object.values(codeValues).includes('null'));
  assert.ok(flattenTokens(draft.tokens!).has('source.css.v'+Buffer.from('--accent').toString('hex')));
  assert.ok(draft.native!.variants.some(v=>v.spec.fill==='source/css/v'+Buffer.from('--accent').toString('hex')));
  const contract=draft.contract!,flat=flattenTokens(draft.tokens!),contracts=new Map([[contract.id,contract]]);
  for(const format of ['inline','module']){
   const generated=format==='inline'?emitReactInline(contract,{tokens:{primitives:draft.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),contracts}):emitReact(contract,{tokens:new Set(flat.keys()),icons:new Map(),contracts});
   assert.deepEqual(generatedTypeErrors(contract.name,generated.tsx),[]);
   const consumer=await browser.newPage(),render=await mountGenerated(consumer,contract.name,generated.tsx,'css' in generated?generated.css as string:'');
   await consumer.addStyleTag({content:':root{'+[...flat].map(([k,v])=>`--${k.replaceAll('.','-')}:${v.value}`).join(';')+'}'});
   for(const row of effects.rows){
    await render({children:'Replacement text',...(row.requested.kind==='set'?{tone:row.requested.value}:{})});
    const actual=await consumer.locator('#root > *').evaluate(n=>({text:n.textContent,style:Object.fromEntries(['padding-top','row-gap','background-color'].map(k=>[k,getComputedStyle(n).getPropertyValue(k)]))}));
    assert.equal(actual.text,'Replacement text');
    for(const [key,value] of Object.entries(actual.style))assert.equal(value,key==='row-gap'&&row.requested.kind==='set'&&row.requested.value===null?'0px':snapshots[row.id].tree.style[key],`${format} ${JSON.stringify(row.requested)} ${key}`);
   }
   await consumer.close();
  }
  const missing={...snapshots};delete missing[effects.rows[0].id];
  assert.equal(assembleReactRootVariants(program,ownership,tree,effects,missing).drafts[0].status,'refused');
  const changed=structuredClone(snapshots);changed[effects.rows[0].id].tree.style['padding-top']='100px';
  assert.equal(assembleReactRootVariants(program,ownership,tree,effects,changed).drafts[0].status,'refused');
  const wrong=structuredClone(effects);wrong.rows[0].requested={kind:'set',value:'unobserved'};
  assert.deepEqual(assembleReactRootVariants(program,ownership,tree,wrong,snapshots).drafts,[]);
  assert.deepEqual(assembleReactRootVariants(program,ownership,tree,effects,snapshots),result,'repeat assembly is deterministic');
  if(defaulted){
   // A font census can drift while the DOM and PNG stay identical. The source
   // must still restore its exact painted-font witness before another probe.
   const newSession=context.newCDPSession.bind(context);let fontSessions=0;
   context.newCDPSession=async target=>{
    const session=await newSession(target),send=session.send.bind(session);let fontSession=0;
    session.send=(async(method:any,args:any)=>{
     const response:any=await send(method,args);
     if(method==='CSS.getPlatformFontsForNode'){
      fontSession||=++fontSessions;
      if(fontSession>=3)response.fonts=response.fonts.map((f:any)=>({...f,postScriptName:f.postScriptName+'-changed'}));
     }
     return response;
    }) as typeof session.send;
    return session;
   };
   try{
    const failure=await observeReactPropertyPlan({page,program,ownership,tree,image,selector,instanceId:ownership.components[0].id,
     dir:path.join(dir,'font-restoration-fault'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}},
    [{changes:{tone:{kind:'set' as const,value:'quiet'}}},{changes:{tone:{kind:'set' as const,value:'loud'}}}]);
    assert.equal(failure.rows[0].problem,'react-property-effects-original-not-restored:restored-fonts');
    assert.equal(failure.rows[1].problem,'prior-observation-invalidated-context');
    assert.ok(failure.rows.every(r=>r.status==='refused'));
   }finally{context.newCDPSession=newSession;}
  }
 }finally{await browser.close();rmSync(dir,{recursive:true,force:true})}
});
