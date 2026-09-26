import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {readReactSourceProgram} from './react-source-program.js';
import {readReactStyleOrigin} from './react-style-origin.js';
import {projectReactRootVisual} from './react-root-visual.js';
import type {ReactOwnership} from './react-ownership.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {validateContract} from '../packages/core/src/validate.js';
import {emitReactInline} from '../core/emit-react-inline.js';
import {emitReact} from '../core/emit-react.js';
import {flattenTokens} from '../core/tokens.js';
import {mountGenerated} from '../core/react-test-runtime.js';

function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'react-root-visual-'));
 writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'preserve',target:'ES2022'}}));
 writeFileSync(path.join(dir,'surface.tsx'),`declare global{namespace JSX{interface Element{} interface IntrinsicElements{section:any}}}
export function Surface(props:{children?:string}){return <section {...props}/>}`);
 const program=readReactSourceProgram(dir,['surface.tsx']),c=program.components[0];
 const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[{id:'one',source:{module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span},props:{children:'Original sample'},roots:['']}],nodes:[{path:'',tag:'section',nearestComponent:'one',createdBy:'one'}],problems:[]};
 const tree:CapturedNode={tag:'section',classes:[],nodes:[{t:'text',v:'Original sample'}],style:{display:'inline-flex','flex-direction':'row','align-items':'center','justify-content':'center','flex-wrap':'nowrap','font-family':'Georgia, serif','font-size':'18px','border-top-style':'solid','border-top-width':'2px','border-top-color':'rgb(0, 0, 255)','background-color':'rgb(10, 20, 30)','padding-top':'3px',width:'999px',height:'300px'},pseudo:{}};
 return {dir,program,ownership,tree};
}

test('a proved delegated root compiles under its public identity and refuses implementation-chain caller sizing',()=>{
 const f=fixture();try{
  writeFileSync(path.join(f.dir,'surface.tsx'),`declare global{namespace JSX{interface Element{} interface IntrinsicElements{section:any}}}
export function Surface(props:{children?:string}){return <Inner {...props}/>}
export function Inner(props:{children?:string}){return <section {...props}/>}`);
  const program=readReactSourceProgram(f.dir,['surface.tsx'],{includeJsxDependencies:true});
  assert.deepEqual(program.problems,[]);
  const source=(name:string)=>{const c=program.components.find(c=>c.exportName===name)!;return {module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};};
  const ownership:ReactOwnership={...f.ownership,components:[
   {...f.ownership.components[0],source:source('Surface')},
   {...f.ownership.components[0],id:'inner',parent:'one',source:source('Inner')},
  ],nodes:[{path:'',tag:'section',nearestComponent:'inner',createdBy:'inner'}]};
  const before=structuredClone({program,ownership,tree:f.tree});
  const projection=projectReactRootVisual(program,ownership,f.tree),root=projection.roots[0];
  assert.equal(root.status,'native-compiled',root.problems.join(';'));
  assert.deepEqual(root.source,source('Surface'));assert.deepEqual(root.contract!.anatomy.root.slot,{name:'children'});
  assert.equal(JSON.stringify(root.contract).includes('Original sample'),false);
  assert.deepEqual(root.native!.rootSlot,{version:1,property:'Children',display:'inline-flex'});
  assert.ok(root.limitations.includes('delegated-root-observed-context-only'));
  const changedTree=structuredClone(f.tree);changedTree.nodes=[{t:'text',v:'Changed caller'}];
  const changedOwnership=structuredClone(ownership);changedOwnership.components.forEach(c=>{c.props.children='Changed caller';});
  const changed=projectReactRootVisual(program,changedOwnership,changedTree).roots[0];
  assert.deepEqual(changed.contract,root.contract);assert.deepEqual(changed.native,root.native);
  const origin={version:1 as const,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width' as const,status:'fixed' as const,value:'999px',authoredValue:'999px',selectors:['<inline>']}]}]};
  assert.equal(projectReactRootVisual(program,ownership,f.tree,origin).roots[0].sourceSizing![0].status,'fixed');
  for(const prop of ['style','className']){
   const o=structuredClone(ownership);o.components[1].props[prop]=prop==='style'?{kind:'object'}:'caller-size';
   const size=projectReactRootVisual(program,o,f.tree,origin).roots[0].sourceSizing![0];
   assert.equal(size.status,'unresolved');assert.equal(size.reason,'caller-style-input-needs-ownership-proof');
  }
  assert.deepEqual({program,ownership,tree:f.tree},before);
 }finally{rmSync(f.dir,{recursive:true,force:true})}
});

test('observed source box retains font and border declarations through the shared compiler and real React consumers',async()=>{
 const f=fixture(),browser=await chromium.launch();
 try{
  f.tree.style.opacity='0.5';
  const before=structuredClone({program:f.program,ownership:f.ownership,tree:f.tree});
  const result=projectReactRootVisual(f.program,f.ownership,f.tree);
  assert.equal(result.acceptedContract,null);assert.equal(result.qualification,'observed-root-only');
  assert.deepEqual(result.problems,[]);assert.equal(result.roots.length,1);
  const root=result.roots[0];assert.equal(root.status,'native-compiled',root.problems.join(';'));
  const c=root.contract!;
  assert.equal(c.anatomy.root.declared?.['font-family'],'Georgia, serif');
  assert.equal(root.native!.variants[0].spec.opacity,0.5);
  assert.equal(c.anatomy.root.declared?.['border-top-style'],'solid');
  assert.deepEqual(c.anatomy.root.slot,{name:'children'});assert.equal(c.anatomy.root.parts,undefined);
  assert.equal(JSON.stringify(c).includes('Original sample'),false);
  assert.ok(root.channels.some(x=>x.channel==='width'&&x.status==='excluded'));
  assert.equal(c.anatomy.root.tokens?.width,undefined);assert.equal(c.anatomy.root.declared?.width,undefined);
  assert.deepEqual(root.native?.rootSlot,{version:1,property:'Children',display:'inline-flex'});
  assert.ok(root.limitations.includes('source-api-and-behavior-not-projected'));
  assert.deepEqual({program:f.program,ownership:f.ownership,tree:f.tree},before);
  assert.deepEqual(projectReactRootVisual(f.program,f.ownership,f.tree),result);
  const otherSample=structuredClone(f.tree);otherSample.nodes=[{t:'text',v:'Different caller text'}];
  const other=projectReactRootVisual(f.program,f.ownership,otherSample);
  assert.notEqual(other.inputRevision,result.inputRevision);
  assert.deepEqual(other.roots[0].contract,c,'caller sample text must not change the reusable root projection');
  assert.deepEqual(other.roots[0].native,root.native);
  const byId=new Map([[c.id,c]]),tokens={primitives:root.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}};
  const flat=flattenTokens(root.tokens!);
  const css=':root{'+[...flat].map(([k,v])=>`--${k.replaceAll('.','-')}:${v.value}`).join(';')+'}';
  for(const format of ['inline','module']){
   const generated=format==='inline'?emitReactInline(c,{tokens,icons:new Map(),contracts:byId}):emitReact(c,{tokens:new Set(flat.keys()),icons:new Map(),contracts:byId});
   const page=await browser.newPage();
   const render=await mountGenerated(page,c.name,generated.tsx,'css' in generated?generated.css as string:'');
   await page.addStyleTag({content:css});await render({children:'Replacement content'});
   const value=await page.locator('#root > *').evaluate(n=>({text:n.textContent,display:getComputedStyle(n).display,font:getComputedStyle(n).fontFamily,border:getComputedStyle(n).borderTopStyle,opacity:getComputedStyle(n).opacity,children:n.children.length,width:n.getBoundingClientRect().width}));
   assert.equal(value.text,'Replacement content');assert.equal(value.display,'inline-flex',format);
   assert.equal(value.opacity,'0.5',format);assert.equal(value.font,'Georgia, serif');assert.equal(value.border,'solid');assert.equal(value.children,0);assert.notEqual(value.width,999);
   await render({children:'Updated'});assert.equal(await page.locator('#root > *').textContent(),'Updated');await page.close();
  }
 }finally{await browser.close();rmSync(f.dir,{recursive:true,force:true})}
});

test('unresolved source roots and unsupported layout retain explicit failure without invented native output',()=>{
 const f=fixture();try{
  const changed=structuredClone(f.ownership);changed.components[0].source.sourceSha256='0'.repeat(64);
  const stale=projectReactRootVisual(f.program,changed,f.tree);assert.ok(stale.problems.length);assert.deepEqual(stale.roots,[]);
  const runtime=structuredClone(f.ownership);delete runtime.nodes[0].createdBy;
  const unresolved=projectReactRootVisual(f.program,runtime,f.tree);assert.equal(unresolved.roots.length,1);assert.equal(unresolved.roots[0].status,'refused');assert.equal(unresolved.roots[0].native,undefined);
  const grid=structuredClone(f.tree);grid.style.display='grid';grid.gdecl={'grid-template-columns':['1fr']};
  const projected=projectReactRootVisual(f.program,f.ownership,grid);assert.equal(projected.roots[0].status,'style-prepared');assert.equal(projected.roots[0].native,undefined);assert.match(projected.roots[0].problems.join(';'),/ROOT_SLOT_LAYOUT_UNSUPPORTED/);
  const pseudo=structuredClone(f.tree);pseudo.pseudo={'::before':{content:'"decoration"'}};
  const decorated=projectReactRootVisual(f.program,f.ownership,pseudo);assert.equal(decorated.roots[0].status,'refused');assert.match(decorated.roots[0].problems.join(';'),/pseudo-content/);
 }finally{rmSync(f.dir,{recursive:true,force:true})}
});

test('root content declarations do not grant styling ownership over nested slots',()=>{
 const f=fixture();try{
  const result=projectReactRootVisual(f.program,f.ownership,f.tree),c=result.roots[0].contract!;
  const valid:string[]=[];validateContract(c,new Map([[c.id,c]]),valid,new Map());assert.deepEqual(valid,[]);
  const nested=structuredClone(c);delete nested.anatomy.root.slot;
  nested.anatomy.root.parts={body:{slot:{name:'children'},declared:{'font-family':'Georgia, serif'}}};
  const errors:string[]=[];validateContract(nested,new Map([[nested.id,nested]]),errors,new Map());
  assert.ok(errors.some(e=>e.includes('declared facts cannot restyle')));
 }finally{rmSync(f.dir,{recursive:true,force:true})}
});


test('winning source CSS variable survives the shared React and native compilers',async()=>{
 const f=fixture(),browser=await chromium.launch();try{
  const page=await browser.newPage();
  await page.setContent('<style>:root{--brand:rgb(10, 20, 30)} section{background-color:var(--brand)}</style><section>Original sample</section>');
  f.tree.style['--brand']='rgb(10, 20, 30)';
  const origin=await readReactStyleOrigin(page,'section',f.ownership);
  const result=projectReactRootVisual(f.program,f.ownership,f.tree,origin),root=result.roots[0];
  assert.equal(root.status,'native-compiled',root.problems.join(';'));
  const binding=root.sourceBindings!.find(b=>b.channel==='background-color')!;
  assert.equal(binding.variable,'--brand');assert.ok(binding.tokenPath);
  assert.equal(root.contract!.anatomy.root.tokens!['background-color'],'{'+binding.tokenPath+'}');
  assert.equal(flattenTokens(root.tokens!).get(binding.tokenPath!)?.value,'#0a141e');
  assert.equal(root.native!.variants[0].spec.fill,binding.tokenPath!.replaceAll('.', '/'), 'native fill must bind the source variable');
  const c=root.contract!,tokens={primitives:root.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}};
  const flat=flattenTokens(root.tokens!);
  const generated=emitReact(c,{tokens:new Set(flat.keys()),icons:new Map(),contracts:new Map([[c.id,c]])});
  const consumer=await browser.newPage(),render=await mountGenerated(consumer,c.name,generated.tsx,generated.css);
  await consumer.addStyleTag({content:':root{'+[...flat].map(([k,v])=>`--${k.replaceAll('.','-')}:${v.value}`).join(';')+'}'});
  await render({children:'New content'});
  assert.equal(await consumer.locator('#root > *').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(10, 20, 30)');
  await consumer.addStyleTag({content:':root{--'+binding.tokenPath!.replaceAll('.','-')+':rgb(40, 50, 60)}'});
  assert.equal(await consumer.locator('#root > *').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(40, 50, 60)');
  const stale=structuredClone(origin);stale.roots[0].channels.find(b=>b.channel==='background-color')!.computedValue='rgb(0, 0, 0)';
  assert.equal(projectReactRootVisual(f.program,f.ownership,f.tree,stale).roots[0].sourceBindings?.find(b=>b.channel==='background-color')?.reason,'source-variable-value-needs-resolution');
 }finally{await browser.close();rmSync(f.dir,{recursive:true,force:true})}
});


test('caller style inputs cannot become source-owned fixed sizes',()=>{
 const f=fixture();try{
  const origin={version:1 as const,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width' as const,status:'fixed' as const,value:'999px',authoredValue:'999px',selectors:['<inline>']}]}]};
  assert.equal(projectReactRootVisual(f.program,f.ownership,f.tree,origin).roots[0].sourceSizing![0].status,'fixed');
  for(const [key,value] of [['style',{kind:'object'}],['className','consumer-width']] as const){
   const own=structuredClone(f.ownership);own.components[0].props[key]=value;
   const size=projectReactRootVisual(f.program,own,f.tree,origin).roots[0].sourceSizing![0];
   assert.equal(size.status,'unresolved');assert.equal(size.reason,'caller-style-input-needs-ownership-proof');
  }
 }finally{rmSync(f.dir,{recursive:true,force:true})}
});


test('hex source paint retains its variable identity without accepting a different observed value',async()=>{
 const f=fixture(),browser=await chromium.launch();try{
  const page=await browser.newPage();
  for(const [raw,computed] of [['#243242','rgb(36, 50, 66)'],['#abc','rgb(170, 187, 204)'],['#A1B2C3','rgb(161, 178, 195)'],['#abcf','rgb(170, 187, 204)'],['#a1b2c3ff','rgb(161, 178, 195)'],['#0000','rgba(0, 0, 0, 0)'],['#abcd','rgba(170, 187, 204, 0.867)']]){
   await page.setContent(`<style>:root{--brand:${raw}} section{background-color:var(--brand)}</style><section>Original sample</section>`);
   const captured=await page.locator('section').evaluate(n=>({raw:getComputedStyle(n).getPropertyValue('--brand').trim(),computed:getComputedStyle(n).backgroundColor}));
   assert.deepEqual(captured,{raw,computed});
   f.tree.style['--brand']=captured.raw;f.tree.style['background-color']=captured.computed;
   const origin=await readReactStyleOrigin(page,'section',f.ownership);
   const project=(tree=f.tree,proof=origin)=>projectReactRootVisual(f.program,f.ownership,tree,proof).roots[0].sourceBindings!.find(b=>b.channel==='background-color')!;
   const binding=project();
   // Fractional alpha serialized by Chromium is not an exact byte-alpha witness.
   if(raw==='#abcd'){assert.equal(binding.reason,'source-variable-value-needs-resolution');continue;}
   assert.ok(binding.tokenPath,raw+': '+binding.reason);
   const output=projectReactRootVisual(f.program,f.ownership,f.tree,origin).roots[0];
   assert.equal(output.native!.variants[0].spec.fill,binding.tokenPath!.replaceAll('.','/'));
   const source=(output.tokens!.source as {css:Record<string,{$extensions:Record<string,{rawValue:string}>}>}).css;
   assert.equal(Object.values(source)[0].$extensions['dev.ds-contracts.css-source'].rawValue,raw);
   const stale=structuredClone(f.tree);stale.style['background-color']='rgb(36, 50, 67)';
   assert.equal(project(stale).reason,'source-variable-value-needs-resolution');
   const moved=structuredClone(f.tree);moved.style['--brand']='#000000';
   assert.equal(project(moved).reason,'source-variable-value-needs-resolution');
   const indirect=structuredClone(origin);indirect.roots[0].channels.find(b=>b.channel==='background-color')!.rawValue='var(--other)';
   assert.equal(project(f.tree,indirect).reason,'source-variable-value-needs-resolution');
  }
 }finally{await browser.close();rmSync(f.dir,{recursive:true,force:true})}
});


test('a selected root records the enclosing render context and never generates its ancestor',()=>{
 const f=fixture();try{
  f.ownership.components[0].parent='outside';
  f.ownership.ancestors=[{id:'outside',source:structuredClone(f.ownership.components[0].source),props:{theme:'cool'},hostAncestor:{tag:'section',distance:1}}];
  const projected=projectReactRootVisual(f.program,f.ownership,f.tree);
  assert.equal(projected.roots.length,1);
  assert.equal(projected.roots[0].instanceId,'one');
  assert.equal(projected.roots[0].status,'native-compiled',JSON.stringify(projected.roots[0].problems));
  assert.ok(projected.roots[0].limitations.includes('recorded-render-ancestor-context-only'));
  const revision=projected.inputRevision;f.ownership.ancestors[0].props.theme='warm';
  assert.notEqual(projectReactRootVisual(f.program,f.ownership,f.tree).inputRevision,revision,'context props participate in observation identity');
 }finally{rmSync(f.dir,{recursive:true,force:true})}
});
