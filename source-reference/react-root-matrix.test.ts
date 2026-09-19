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


for(const own of ['fixed','fill'] as const)test(`a top-level grid root with its own ${own==='fixed'?'fixed width':'100% width'} compiles the bounded row-flow lowering; caller width, differing planes and archives without the witness keep named outcomes`,async()=>{
 mkdirSync(path.join(process.cwd(),'private'),{recursive:true});
 const dir=mkdtempSync(path.join(process.cwd(),'private/root-matrix-grid-fixture-')),browser=await chromium.launch();
 try{
  const source=`import React from 'react';
export function NoticeTitle({children}:{children?:React.ReactNode}){return <div style={{fontWeight:600}}>{children}</div>;}
export function NoticeBody({children}:{children?:React.ReactNode}){return <div>{children}</div>;}
export function Notice({tone='quiet',children,style}:{tone?:'quiet'|'loud';children?:React.ReactNode;style?:React.CSSProperties}){
 return <div role="alert" style={{display:'grid',boxSizing:'border-box',width:${own==='fixed'?320:"'100%'"},rowGap:2,padding:tone==='loud'?16:12,backgroundColor:tone==='loud'?'var(--accent)':'var(--base)',...style}}>{children}</div>;
}`;
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler'}}));
  writeFileSync(path.join(dir,'notice.tsx'),source);
  const program=readReactSourceProgram(dir,['notice.tsx']);assert.deepEqual(program.problems,[]);
  const exportsList=program.components.map(c=>`{identity:${JSON.stringify({module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span})},value:${c.exportName}}`).join(',');
  const bundle=await build({stdin:{contents:source+`;import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';window.__DSC_REACT_EXPORTS=[${exportsList}];flushSync(()=>createRoot(document.getElementById('root')).render(<Notice><NoticeTitle>Heads up</NoticeTitle><NoticeBody>A description long enough to wrap onto a second line inside the fixed column.</NoticeBody></Notice>));`,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife'});
  const context=await browser.newContext();await context.addInitScript(reactOwnershipHook);const page=await context.newPage();
  await page.setContent('<style>:root{--base:rgb(10, 20, 30);--accent:rgb(40, 50, 60)}*{box-sizing:border-box}body{margin:0;font:14px/20px Arial}</style><div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort());
  const selector='#root > div',ownership=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
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
   assert.equal(JSON.stringify(variant.spec).includes('"width":'+(await page.evaluate(()=>document.querySelector('#root > div')!.getBoundingClientRect().width))),false,'the measured box is nowhere in the plan');
   const carrier=variant.spec.children![0].children![0];
   assert.equal(carrier.layout?.mode,'GRID',variant.name);assert.equal(carrier.layout?.grid?.columns.length,1);assert.equal(carrier.layout?.grid?.flow,'ROW_AUTO_FLOW');
  }
  assert.ok(draft.limitations.includes('intrinsic-row-lowering-observed-block-content-only'));
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
