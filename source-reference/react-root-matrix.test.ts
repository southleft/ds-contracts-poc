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
import {reactChildContextGrid} from './react-child-context.js';
import {projectReactRootVisual} from './react-root-visual.js';
import {deriveReactChildRoot} from './react-child-root.js';
import {readReactStyleOrigin} from './react-style-origin.js';
import {observeGridConstraints} from './grid-constraints.js';
import {revisionOf} from '../core/contract-provenance.js';
import {type ReactPropertySnapshot} from './react-root-variants.js';
import {captureJs} from '../extract/computed/capture.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {evidenceSha,inventoryEvidence} from './react-validation-evidence.js';
import {readReactNativeEvidence,selectReactNativeRequest} from './react-native-evidence.js';
import {builtinReactCohort} from './react-cohort.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import type {ReactOwnershipReport} from './react-ownership-run.js';
import {prepareReactRootTextTemplate} from './react-root-text-template.js';

for(const joint of ['paint','opacity',false] as const)test(`optional root axes ${joint==='paint'?'carry complete joint paint tables':joint==='opacity'?'retain unsupported joint-binding refusals':'still compile independently factored paint'}`,async()=>{
 mkdirSync(path.join(process.cwd(),'private'),{recursive:true});
 const dir=mkdtempSync(path.join(process.cwd(),'private/root-overflow-fixture-')),browser=await chromium.launch();
 try{
  const source=`import React from 'react';
export function Surface({tone,finish,children}:{tone?:'warm'|'cool';finish?:'solid'|'outline';children?:React.ReactNode}){
 const colors={warm:['rgb(80, 20, 10)','rgb(160, 40, 20)'],cool:['rgb(10, 20, 80)','rgb(20, 40, 160)'],absent:['rgb(30, 30, 30)','rgb(90, 90, 90)']};
 return <section style={{display:'inline-flex',height:20,padding:4,fontFamily:'Arial',fontSize:12,fontWeight:400,lineHeight:'20px',color:'#123456',backgroundColor:colors[tone??'absent'][${joint==='paint'?"finish==='outline'?1:0":'0'}],opacity:${joint==='opacity'?"(tone==='warm'?0.8:0.6)*(finish==='solid'?0.5:1)":"finish==='solid'?0.8:1"}}}>{children}</section>;
}`;
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler'}}));
  writeFileSync(path.join(dir,'surface.tsx'),source);
  const program=readReactSourceProgram(dir,['surface.tsx']);assert.deepEqual(program.problems,[]);
  const c=program.components.find(c=>c.exportName==='Surface')!,identity={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity)},value:Surface}];flushSync(()=>createRoot(document.getElementById('root')).render(<Surface>Untouched caller</Surface>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort());
  const selector='#root > section',ownership=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  const tree=await page.evaluate(captureJs('#root',undefined,'--',[selector])) as CapturedNode;
  const image=evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}));
  const effects=await observeReactPropertyMatrix({page,program,ownership,tree,image,selector,instanceId:ownership.components[0].id,dir:path.join(dir,'effects'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.equal(effects.rows.length,9);assert.ok(effects.rows.every(r=>r.status==='observed'&&r.restored));
  const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(effects.rows.map(r=>[r.id,JSON.parse(readFileSync(path.join(dir,'effects',r.id+'.json'),'utf8'))]));
  const before=JSON.stringify({program,ownership,tree,effects,snapshots});
  const result=assembleReactRootMatrix(program,ownership,tree,effects,snapshots),draft=result.draft!;
  assert.deepEqual(result.problems,[]);
  assert.equal(draft.status,joint==='opacity'?'style-prepared':'native-compiled',JSON.stringify(draft.problems));
  if(joint==='opacity'){
   assert.deepEqual(draft.problems,['react-root-matrix-unprojected-bindings:root.opacity']);
   assert.equal(draft.native,undefined);
   const residue=draft.residuals!.find(r=>r.channel==='opacity')!;
   assert.equal(residue.reason,'pair ref over TWO unset axes — no carried spelling; named residue');
   assert.match(residue.sample,/\{tone\}/);assert.match(residue.sample,/\{finish\}/);
   assert.ok([...flattenTokens(draft.tokens!).keys()].some(k=>k.includes('opacity')),'captured values remain available for investigation');
  }else{
   assert.deepEqual(draft.problems,[]);assert.equal(draft.native!.variants.length,9);
   assert.ok(draft.native!.variants.every(v=>v.spec.fill),'independent paint is retained in every omitted/set combination');
   assert.equal(draft.contract!.anatomy.root.slot!.bindings?.figma?.textTemplate,true);
   assert.ok(draft.native!.variants.every(v=>v.spec.children?.[0].children?.[0].characters===''));
   if(joint===false){
    // Real observed matrices are reassembled under the retained allocation
    // identity. Source snapshots remain sealed and content-derived by default.
    const identity='observed.react-matrix-0123456789abcdef';
    const retained=assembleReactRootMatrix(program,ownership,tree,effects,snapshots,identity);
    assert.equal(retained.draft!.contract!.id,identity);
    assert.equal(retained.draft!.contract!.name,'RootMatrix0123456789abcdef');
    assert.deepEqual([...flattenTokens(retained.draft!.tokens!).values()], [...flattenTokens(draft.tokens!).values()]);
    assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,snapshots,'observed.react-initial-0123456789abcdef').draft!.problems,
      ['react-root-matrix-identity-invalid']);
    const reference={id:'a'.repeat(64),files:program.files,javascript:'',css:'',cohort:builtinReactCohort,sourceRoot:dir};
    const report:ReactOwnershipReport={id:'10000000-0000-4000-8000-000000000001',referenceId:reference.id,state:'complete',acceptedContract:null,
      denominator:1,matched:1,sourceUnchanged:true,rows:[{id:'button-default',matched:true,problems:[],treeSha256:evidenceSha(JSON.stringify(tree)),ownership,propertyMatrix:effects,rootMatrix:result}]};
    const archive=path.join(dir,'private/react-source-ownership',reference.id,report.id);
    const snapshotDir=path.join(archive,'button-default/matrix');mkdirSync(snapshotDir,{recursive:true});
    writeFileSync(path.join(archive,'program.json'),JSON.stringify(program));
    writeFileSync(path.join(archive,'report.json'),JSON.stringify(report));
    writeFileSync(path.join(archive,'button-default/source-tree.json'),JSON.stringify({status:'captured',problems:[],tree,treeSha256:evidenceSha(JSON.stringify(tree))}));
    for(const [id,snapshot] of Object.entries(snapshots))writeFileSync(path.join(snapshotDir,id+'.json'),JSON.stringify(snapshot));
    writeFileSync(path.join(archive,'integrity.json'),JSON.stringify({version:1,files:inventoryEvidence(archive)}));
    const request=selectReactNativeRequest(dir,report,'button-default'),saved=inventoryEvidence(archive);
    assert.equal(revisionOf(readReactNativeEvidence(dir,reference,request).matrix),revisionOf(result));
    assert.deepEqual(readReactNativeEvidence(dir,reference,request,identity).matrix,retained);
    withEvidenceReadSnapshot(()=>{
      assert.equal(readReactNativeEvidence(dir,reference,request,identity).matrix.draft!.contract!.id,identity);
      assert.equal(readReactNativeEvidence(dir,reference,request).matrix.draft!.contract!.id,draft.contract!.id);
    });
    assert.deepEqual(inventoryEvidence(archive),saved);
    assert.throws(()=>readReactNativeEvidence(dir,reference,request,'unowned'),/matrix-identity-invalid/);
    writeFileSync(path.join(snapshotDir,effects.rows[0].id+'.json'),'{}');
    assert.throws(()=>readReactNativeEvidence(dir,reference,request,identity),/evidence-unavailable/);
   }
   const legacyRows=structuredClone(effects),legacySnapshots=structuredClone(snapshots);
   for(const row of legacyRows.rows){delete row.propertyCaptureVersion;delete legacySnapshots[row.id].propertyCaptureVersion;}
   const legacy=assembleReactRootMatrix(program,ownership,tree,legacyRows,legacySnapshots).draft!;
   assert.equal(legacy.status,'native-compiled');assert.equal(legacy.contract!.anatomy.root.slot!.bindings?.figma?.textTemplate,undefined);
   const mixed=structuredClone(effects);delete mixed.rows[0].propertyCaptureVersion;
   assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,mixed,snapshots).draft!.problems,['react-root-text-template-capture-version-mixed']);
   const badBounds=structuredClone(snapshots);badBounds[effects.rows[0].id].bounds!.x+=0.25;
   assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,badBounds).draft!.problems,['react-root-text-template-bounds-unverified']);
   const nested=structuredClone(snapshots[effects.rows[0].id]),nestedRow=structuredClone(effects.rows[0]);
   const child=structuredClone(nested.tree);nested.tree.nodes=[{t:'el',el:child}];
   nested.fonts!.rows[0].path=[0];nested.fonts!.treeRevision=revisionOf(nested.tree);
   nestedRow.fontsSha256=evidenceSha(JSON.stringify(nested.fonts));
   const nestedResult=prepareReactRootTextTemplate(legacy.contract!,draft.tokens!,[{snapshot:nested,row:nestedRow,rootPath:'',caller:'Untouched caller'}]);
   assert.equal(nestedResult.admitted,false);assert.equal(nestedResult.limitation,'root-text-template-unqualified:direct-caller-text-required');
   if(joint==='paint')assert.equal(draft.contract!.anatomy.root.tokensByCombination![0].rows.length,9);
  }
  assert.equal(JSON.stringify({program,ownership,tree,effects,snapshots}),before);
  assert.equal(readFileSync(path.join(dir,'surface.tsx'),'utf8'),source);
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,snapshots),result);
 }finally{await browser.close();rmSync(dir,{recursive:true,force:true});}
});
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
  const font=readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
  await page.setContent('<style>@font-face{font-family:AppAlias;src:url(data:font/woff2;base64,'+font+')}section{font-family:AppAlias}:root{--base:rgb(10, 20, 30);--twin:rgb(10, 20, 30);--accent:rgb(40, 50, 60)}</style><div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>document.fonts.ready);
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
  assert.ok(Object.values(snapshots).every(s=>s.tree.style['font-family']==='AppAlias'&&s.fonts?.rows[0].fonts[0].familyName==='IBM Plex Sans'));
  assert.ok(effects.rows.every(r=>r.fontsSha256===evidenceSha(JSON.stringify(snapshots[r.id].fonts))));
  assert.equal(draft.contract!.anatomy.root.declared?.['font-family'],'"IBM Plex Sans"');
  assert.equal(draft.lowerings.filter(l=>l.reason==='painted-font-family').length,15);
  for(const mutate of [
   (s:ReactPropertySnapshot)=>{delete s.fonts;},
   (s:ReactPropertySnapshot)=>{s.fonts!.rows[0].fonts[0].familyName='Unobserved';},
   (s:ReactPropertySnapshot)=>{s.fonts!.treeRevision='sha256:'+'0'.repeat(64);},
  ]){
   const changedFonts=structuredClone(snapshots);mutate(changedFonts[effects.rows[0].id]);
   assert.match(assembleReactRootMatrix(program,ownership,tree,effects,changedFonts).draft!.problems[0],/react-property-font-/);
  }
  const incompleteFonts=structuredClone(effects),incompleteSnapshots=structuredClone(snapshots);
  delete incompleteFonts.rows[0].fontsSha256;delete incompleteSnapshots[incompleteFonts.rows[0].id].fonts;
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,incompleteFonts,incompleteSnapshots).draft!.problems,['react-property-font-coverage-incomplete']);
  const aliasedFonts=structuredClone(effects),aliasedSnapshots=structuredClone(snapshots),aliasRow=aliasedFonts.rows[0];
  aliasedSnapshots[aliasRow.id].fonts!.rows[0].cssFamily='OtherAlias';
  aliasRow.fontsSha256=evidenceSha(JSON.stringify(aliasedSnapshots[aliasRow.id].fonts));
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,aliasedFonts,aliasedSnapshots).draft!.problems,['text-font-source-node-changed']);
  if(defaulted){
   const mismatch=structuredClone(effects),mismatchSnapshots=structuredClone(snapshots);
   const omitted=mismatch.rows.find(r=>r.changes.tone.kind==='omit')!;
   mismatchSnapshots[omitted.id].fonts!.rows[0].fonts[0].familyName='Different Family';
   omitted.fontsSha256=evidenceSha(JSON.stringify(mismatchSnapshots[omitted.id].fonts));
   assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,mismatch,mismatchSnapshots).draft!.problems,['react-root-matrix-default-font-differs']);
  }
  const legacyEffects=structuredClone(effects),legacySnapshots=structuredClone(snapshots);
  for(const r of legacyEffects.rows){delete r.fontsSha256;delete legacySnapshots[r.id].fonts;}
  const legacy=assembleReactRootMatrix(program,ownership,tree,legacyEffects,legacySnapshots).draft!;
  assert.equal(legacy.status,'native-compiled');assert.equal(legacy.contract!.anatomy.root.declared?.['font-family'],'AppAlias');
  assert.ok(!legacy.lowerings.some(l=>l.reason==='painted-font-family'),'old archives cannot acquire an inferred font witness');
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


for(const own of ['fixed','fill'] as const)test(`a top-level grid root with its own ${own==='fixed'?'fixed width':'100% width'} compiles the bounded row-flow lowering; caller width, differing planes and archives without the witness keep named outcomes`,async()=>{
 mkdirSync(path.join(process.cwd(),'private'),{recursive:true});
 const dir=mkdtempSync(path.join(process.cwd(),'private/root-matrix-grid-fixture-')),browser=await chromium.launch();
 try{
  const callerStyleSource=`import React from 'react';
export function NoticeTitle({children}:{children?:React.ReactNode}){return <div style={{fontWeight:600}}>{children}</div>;}
export function NoticeBody({children}:{children?:React.ReactNode}){return <div>{children}</div>;}
export function Notice({tone='quiet',children,style}:{tone?:'quiet'|'loud';children?:React.ReactNode;style?:React.CSSProperties}){
 return <div role="alert" style={{display:'grid',boxSizing:'border-box',width:${own==='fixed'?320:"'100%'"},rowGap:2,padding:tone==='loud'?16:12,backgroundColor:tone==='loud'?'var(--accent)':'var(--base)',...style}}>{children}</div>;
}`;
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler'}}));
  writeFileSync(path.join(dir,'notice.tsx'),callerStyleSource);
  const callerStyleProgram=readReactSourceProgram(dir,['notice.tsx']);assert.deepEqual(callerStyleProgram.problems,[]);
  assert.deepEqual(callerStyleProgram.components.find(c=>c.name==='Notice')!.children,
   {kind:'unresolved',reason:'children-alias-unresolved'},'spreading an opaque style object can execute getters that mutate children');
  // Keep the original caller-style pattern as an explicit refusal above. Grid
  // lowering is qualified separately with component-owned constant styles.
  const source=callerStyleSource.replace(',children,style}',',children}').replace(';style?:React.CSSProperties','').replace(',...style}', '}');
  writeFileSync(path.join(dir,'notice.tsx'),source);
  const program=readReactSourceProgram(dir,['notice.tsx']);assert.deepEqual(program.problems,[]);
  const exportsList=program.components.map(c=>`{identity:${JSON.stringify({module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span})},value:${c.exportName}}`).join(',');
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_EXPORTS=[${exportsList}];flushSync(()=>createRoot(document.getElementById('root')).render(<div style={{width:400}}><Notice><NoticeTitle>Heads up</NoticeTitle><NoticeBody>A description long enough to wrap onto a second line inside the fixed column.</NoticeBody></Notice></div>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  await page.setContent('<style>:root{--base:rgb(10, 20, 30);--accent:rgb(40, 50, 60)}*{box-sizing:border-box}body{margin:0;font:14px/20px Arial}</style><div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort());
  // A fill needs a caller-sized place: the bare harness stage and viewport are never one.
  const selector='#root > div > div',ownership=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  const tree=await page.evaluate(captureJs('#root',undefined,'--',[selector])) as CapturedNode;
  const image=evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}));
  const instanceId=ownership.components.find(c=>c.source.exportName==='Notice')!.id;
  // Composed children of this grid ROOT get the same parent-width proof an auto-sized grid child gives its own children.
  const styleOrigin=await readReactStyleOrigin(page,selector,ownership),childContext={gridConstraints:await observeGridConstraints(page,[selector],tree)};
  for(const name of ['NoticeTitle','NoticeBody']){
   const child=deriveReactChildRoot(program,ownership,tree,styleOrigin,ownership.components.find(c=>c.source.exportName===name)!.id,childContext);
   assert.equal(child.draft.status,'native-compiled',name);assert.deepEqual(child.draft.contract!.anatomy.root.literals,{width:'100%',height:'fit-content'},name);
   assert.ok(child.draft.limitations.includes('parent-stretch-current-source-context-only'));
   const styled=structuredClone(ownership);styled.components.find(c=>c.id===instanceId)!.props.style={kind:'object'};
   assert.throws(()=>deriveReactChildRoot(program,styled,tree,styleOrigin,child.instanceId,childContext),/^Error: react-child-root-projection-unavailable:react-root-grid-width-unqualified$/,'a caller-owned root width proves nothing to its children');
  }
  const effects=await observeReactPropertyMatrix({page,program,ownership,tree,image,selector,instanceId,dir:path.join(dir,'effects'),assertCurrent:()=>{},failures:{runtimeErrors:[],failedResources:[]}});
  assert.ok(effects.rows.every(r=>r.status==='observed'),JSON.stringify(effects));
  const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(effects.rows.map(r=>[r.id,JSON.parse(readFileSync(path.join(dir,'effects',r.id+'.json'),'utf8'))]));
  assert.ok(Object.values(snapshots).every(s=>s.gridConstraints?.status==='observed'&&s.gridConstraints.rows.length===1&&s.gridConstraints.rows[0].computed['grid-template-columns']==='none'),'every plane seals its own declared-track witness');
  // Each plane's own single-observation projection already compiles, on the declared width and never the measured box.
  for(const snap of Object.values(snapshots) as Array<ReactPropertySnapshot&{projection:ReturnType<typeof projectReactRootVisual>}>){
   const single=snap.projection.roots.find(r=>r.instanceId===instanceId)!;assert.equal(single.status,'native-compiled',single.problems.join(';'));
   assert.deepEqual(single.contract!.anatomy.root.literals,{height:'fit-content',width:own==='fixed'?'320px':'100%'});
   assert.deepEqual(JSON.parse(JSON.stringify(projectReactRootVisual(program,snap.ownership,snap.tree,snap.styleOrigin,undefined,undefined,snap.gridConstraints))),snap.projection,'the sealed plane reprojects identically');
  }
  const result=assembleReactRootMatrix(program,ownership,tree,effects,snapshots);assert.deepEqual(result.problems,[]);
  const draft=result.draft!;assert.equal(draft.status,'native-compiled',draft.problems.join(';'));
  const layout={display:'grid',columns:[{fr:1}],autoRows:{fit:true},flow:'row',gap:{row:2,column:0}};
  assert.deepEqual(draft.contract!.anatomy.root.layout,layout);
  // The same DOM and witness seen as a composed child of a fixed-width column lowers identically.
  const plane=Object.values(snapshots)[0],parent:CapturedNode={tag:'section',classes:[],pseudo:{},style:{...plane.tree.style,display:'flex','flex-direction':'column'},nodes:[{t:'el',el:plane.tree}]};
  const auto=(channel:'width'|'height')=>({channel,status:'auto' as const,value:'auto',selectors:[]});
  assert.deepEqual(reactChildContextGrid(parent,{version:1,roots:plane.styleOrigin.roots.map(row=>({...row,path:row.path?'0.'+row.path:'0',...(row.path?{}:{sizes:[auto('width'),auto('height')]})}))},'0',
   {gridConstraints:{...plane.gridConstraints!,treeRevision:revisionOf(parent),rows:plane.gridConstraints!.rows.map(row=>({...row,path:'0'}))}}),layout);
  assert.equal(draft.contract!.anatomy.root.literals?.height,'fit-content');assert.equal(draft.contract!.anatomy.root.literals?.width,own==='fixed'?undefined:'100%','a fixed width is the retained source token; a declared fill is the parent-width literal; neither is the measured box');
  assert.deepEqual(draft.sizing,[{channel:'width',status:own==='fixed'?'retained':'fill'},{channel:'height',status:'intrinsic'}]);
  assert.deepEqual(draft.contract!.anatomy.root.slot,{name:'children'});assert.equal(JSON.stringify(draft.contract).includes('Heads up'),false);
  assert.equal(draft.native!.rootSlot?.display,'grid');assert.equal(draft.native!.variants.length,2);
  for(const variant of draft.native!.variants){
   assert.equal(variant.spec.fixedWidth?.px,own==='fixed'?320:undefined,variant.name);assert.equal(variant.spec.rootFillWidth,own==='fixed'?undefined:true,variant.name);
   assert.equal(JSON.stringify(variant.spec).includes('"width":'+(await page.evaluate(()=>document.querySelector('#root > div > div')!.getBoundingClientRect().width))),false,'the measured box is nowhere in the plan');
   const carrier=variant.spec.children![0].children![0];
   assert.equal(carrier.layout?.mode,'GRID',variant.name);assert.equal(carrier.layout?.grid?.columns.length,1);assert.equal(carrier.layout?.grid?.flow,'ROW_AUTO_FLOW');
  }
  assert.ok(draft.limitations.includes('intrinsic-row-lowering-observed-block-content-only'));
  assert.ok(draft.limitations.includes('grid-tracks-observed-for-this-content-only'),'content-conditional tracks are invisible to a property matrix: named on the draft');
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,snapshots),result,'repeat assembly is deterministic');

  // An archive sealed before this witness existed reads exactly as it always did.
  const archived=structuredClone(snapshots);for(const snap of Object.values(archived))delete snap.gridConstraints;
  const old=assembleReactRootMatrix(program,ownership,tree,effects,archived).draft!;
  assert.equal(old.status,'style-prepared');assert.deepEqual(old.problems,['FIGMA_ROOT_SLOT_LAYOUT_UNSUPPORTED: root slots require supported forward flex or grid layout']);
  assert.equal(old.contract!.anatomy.root.layout,undefined);assert.equal(old.native,undefined);

  // A caller `style`/`className` owns the width: styles stay prepared, the lowering refuses by name.
  const caller={ownership:structuredClone(ownership),effects:structuredClone(effects),snapshots:structuredClone(snapshots)};
  caller.ownership.components.find(c=>c.id===instanceId)!.props.style={kind:'object'};caller.effects.heldProps.style={kind:'object'};
  for(const snap of Object.values(caller.snapshots))snap.ownership.components.find(c=>c.id===instanceId)!.props.style={kind:'object'};
  const refused=assembleReactRootMatrix(program,caller.ownership,tree,caller.effects,caller.snapshots).draft!;
  assert.equal(refused.status,'style-prepared');assert.deepEqual(refused.problems,['react-root-grid-width-unqualified']);
  assert.equal(refused.contract!.anatomy.root.layout,undefined);assert.equal(refused.native,undefined);
  assert.deepEqual(refused.sizing?.find(s=>s.channel==='width'),{channel:'width',status:'unresolved',reason:'caller-style-input-needs-ownership-proof'});

  // Planes that each qualify but share no ONE width kind refuse like any other unqualified width: styles stay prepared.
  const mixed=structuredClone(snapshots),loud=effects.rows.find(r=>r.changes.tone.kind==='set'&&r.changes.tone.value==='loud')!.id;
  mixed[loud].styleOrigin.roots[0].sizes![0]=own==='fill'?{channel:'width',selectors:['<inline>'],authoredValue:mixed[loud].tree.style.width,status:'fixed',value:mixed[loud].tree.style.width}
   :{channel:'width',selectors:['<inline>'],authoredValue:'100%',status:'fill',value:'100%'};
  const uneven=assembleReactRootMatrix(program,ownership,tree,effects,mixed).draft!;
  assert.deepEqual([uneven.status,uneven.problems,!!uneven.contract,uneven.contract?.anatomy.root.layout,uneven.native],['style-prepared',['react-root-grid-width-unqualified'],true,undefined,undefined]);
  assert.deepEqual(uneven.sizing?.find(s=>s.channel==='width'),{channel:'width',status:'unresolved',reason:'fill-size-presence-needs-joint-mapping'});
  const differs=structuredClone(snapshots);differs[effects.rows[0].id].gridConstraints!.rows[0].computed['row-gap']='6px';
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,differs).draft!.problems,['react-root-matrix-grid-layout-differs']);
  const columns=structuredClone(snapshots);columns[effects.rows[0].id].gridConstraints!.rows[0].computed['grid-template-columns']='1fr 1fr';
  assert.deepEqual(assembleReactRootMatrix(program,ownership,tree,effects,columns).draft!.problems,['react-root-grid-constraints-unqualified']);
  const substituted=structuredClone(snapshots);substituted[effects.rows[0].id].gridConstraints!.treeRevision=revisionOf('another tree');
  assert.equal(assembleReactRootMatrix(program,ownership,tree,effects,substituted).draft!.status,'refused');
 }finally{await browser.close();rmSync(dir,{recursive:true,force:true})}
});

test('an own declared fill is never sized as fixed or automatic; only a layout that qualifies it may project it',()=>{
 const values=['quiet','loud'],axes=[{prop:'tone',values}],base={tone:'quiet'},combos=enumerate(axes,[],10,base).combos;
 const fact=(status:'fill'|'fixed'|'auto')=>({sourceSizing:[{channel:'width',status,value:status==='fill'?'100%':status==='fixed'?'40px':'auto',selectors:[]},{channel:'height',status:'auto',value:'auto',selectors:[]}]} as Pick<ReactRootVisual['roots'][number],'sourceSizing'>);
 const every=prepareReactRootSizing(axes,base,new Map(),new Map(combos.map(c=>[c.key,fact('fill')])));
 assert.deepEqual(every.reports[0],{channel:'width',status:'unresolved',reason:'own-declared-fill-needs-layout-qualification'});
 assert.deepEqual([[...every.fill],[...every.channels]],[['width'],[]]);
 for(const other of ['fixed','auto'] as const){
  const mixed=prepareReactRootSizing(axes,base,new Map(),new Map(combos.map((c,i)=>[c.key,fact(i?other:'fill')])));
  assert.deepEqual(mixed.reports[0],{channel:'width',status:'unresolved',reason:'fill-size-presence-needs-joint-mapping'});
  assert.deepEqual([[...mixed.fill],[...mixed.channels]],[[],[]]);
 }
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
