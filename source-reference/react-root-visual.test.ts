import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {readReactSourceProgram} from './react-source-program.js';
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

test('observed source box retains font and border declarations through the shared compiler and real React consumers',async()=>{
 const f=fixture(),browser=await chromium.launch();
 try{
  const before=structuredClone({program:f.program,ownership:f.ownership,tree:f.tree});
  const result=projectReactRootVisual(f.program,f.ownership,f.tree);
  assert.equal(result.acceptedContract,null);assert.equal(result.qualification,'observed-root-only');
  assert.deepEqual(result.problems,[]);assert.equal(result.roots.length,1);
  const root=result.roots[0];assert.equal(root.status,'native-compiled',root.problems.join(';'));
  const c=root.contract!;
  assert.equal(c.anatomy.root.declared?.['font-family'],'Georgia, serif');
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
   const value=await page.locator('#root > *').evaluate(n=>({text:n.textContent,display:getComputedStyle(n).display,font:getComputedStyle(n).fontFamily,border:getComputedStyle(n).borderTopStyle,children:n.children.length,width:n.getBoundingClientRect().width}));
   assert.equal(value.text,'Replacement content');assert.equal(value.display,'inline-flex',format);
   assert.equal(value.font,'Georgia, serif');assert.equal(value.border,'solid');assert.equal(value.children,0);assert.notEqual(value.width,999);
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
