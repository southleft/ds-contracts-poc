import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readReactSourceProgram} from './react-source-program.js';
import {linkReactSourceAnatomy} from './react-source-anatomy.js';
import type {ReactOwnership} from './react-ownership.js';
import type {CapturedNode} from '../extract/computed/lib.js';

function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'react-anatomy-'));
 try{
  writeFileSync(path.join(root,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'preserve',strict:true,target:'ES2022',skipLibCheck:true}}));
  writeFileSync(path.join(root,'components.tsx'),`
declare global { namespace JSX { interface Element{} interface IntrinsicElements{section:any;button:any;div:any} } }
function External(props:{children?:string}){return <div {...props}/>}
export function Box(props:{children?:string}){return <section {...props}/>}
export function Child({label}:{label:string}){return <button>{label}</button>}
export function Poly({asChild=false,...props}:{asChild?:boolean;children?:string}){const Root=asChild?External:'button';return <Root {...props}/>}
export function Wrapped(props:{children?:string}){return <External {...props}/>}
`);
  const program=readReactSourceProgram(root,['components.tsx']);assert.deepEqual(program.problems,[]);
  const source=(name:string)=>{const c=program.components.find(c=>c.exportName===name)!;return {module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};};
  const node=(tag:string,nodes:CapturedNode['nodes']=[]):CapturedNode=>({tag,classes:[],nodes,style:{display:'flex',width:'123px'},pseudo:{}});
  const tree=node('section',[{t:'el',el:node('button',[{t:'text',v:'Sample action'}])},{t:'el',el:node('div',[{t:'text',v:'Sample content'}])}]);
  const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[
   {id:'box',source:source('Box'),props:{children:{kind:'array'}},roots:['']},
   {id:'child',parent:'box',source:source('Child'),props:{label:'Sample action'},roots:['0']},
  ],nodes:[{path:'',tag:'section',nearestComponent:'box',createdBy:'box'},{path:'0',tag:'button',nearestComponent:'child',createdBy:'child'},{path:'1',tag:'div',nearestComponent:'box'}],problems:[]};
  return {root,program,source,node,tree,ownership};
 }catch(error){rmSync(root,{recursive:true,force:true});throw error;}
}

test('source identities link reusable root boxes while caller composition stays separate',()=>{
 const f=fixture();try{
  const before=structuredClone({program:f.program,tree:f.tree,ownership:f.ownership});
  const result=linkReactSourceAnatomy(f.program,f.ownership,f.tree);
  assert.equal(result.status,'linked');assert.equal(result.acceptedContract,null);
  const [box,child]=result.instances;
  assert.equal(box.content,'caller-slot');assert.deepEqual(box.sourceOwnedPaths,['']);assert.deepEqual(box.callerContentPaths,['0','1']);
  assert.deepEqual(box.dependencies,[{instanceId:'child',roots:['0'],placement:'caller-content'}]);
  assert.equal(box.roots[0].correspondence,'source-host');assert.equal(box.roots[0].observation.style.width,'123px');
  assert.equal('nodes' in box.roots[0].observation,false,'sample text and child layout must not become reusable anatomy');
  assert.equal(child.content,'unresolved');assert.ok(child.problems.includes('children-flow-unresolved')); assert.deepEqual(child.sourceOwnedPaths,['0']);
  assert.deepEqual({program:f.program,tree:f.tree,ownership:f.ownership},before);
  const partial=structuredClone(f.program);partial.status='refused';partial.components[0].problems.push('unresolved-prop-type:inlist');
  const linked=linkReactSourceAnatomy(partial,f.ownership,f.tree);
  assert.equal(linked.status,'linked','unresolved APIs do not erase independently matched structure');
  assert.ok(linked.instances[0].problems.includes('unresolved-prop-type:inlist'),'API limits remain explicit');
 }finally{rmSync(f.root,{recursive:true,force:true})}
});

test('a measured conditional host branch carries caller content without qualifying other branches or dependency roots',()=>{
 const f=fixture();try{
  for(const name of ['Poly','Wrapped']){
   const own=name==='Poly';const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[{id:'one',source:f.source(name),props:{},roots:['']}],nodes:[{path:'',tag:'button',nearestComponent:'one',...(own?{createdBy:'one'}:{})}],problems:[]};
   const result=linkReactSourceAnatomy(f.program,ownership,f.node('button'));
   assert.equal(result.status,'linked');
   assert.equal(result.instances[0].roots[0].correspondence,own?'observed-host-branch':'runtime-dependent');
   assert.equal(result.instances[0].content,own?'caller-slot':'authored-or-runtime');
   assert.deepEqual(result.instances[0].problems,[own?'other-root-branches-unqualified':'root-runtime-correspondence-unqualified']);
  }
 }finally{rmSync(f.root,{recursive:true,force:true})}
});

test('changed identity, missing owners, contradictory roots and cyclic parents refuse without a partial anatomy',()=>{
 const f=fixture();try{
  for(const change of [
   (o:ReactOwnership)=>{o.components[0].source.sourceSha256='b'.repeat(64);},
   (o:ReactOwnership)=>{o.components[0].source.span.end++;},
   (o:ReactOwnership)=>{o.components[0].source.exportName='Other';},
   (o:ReactOwnership)=>{o.nodes[1].path='9';},
   (o:ReactOwnership)=>{o.nodes[1].createdBy='unknown';},
   (o:ReactOwnership)=>{o.components[0].parent='child';},
   (o:ReactOwnership)=>{o.components[1].roots=['1'];},
   (o:ReactOwnership)=>{o.components[1].id='box';},
   (o:ReactOwnership)=>{o.components[1].roots=['0','0'];},
   (o:ReactOwnership)=>{o.rendererVersions=['future-renderer'];},
  ]){const o=structuredClone(f.ownership);change(o);const result=linkReactSourceAnatomy(f.program,o,f.tree);assert.equal(result.status,'refused');assert.equal(result.instances.length,0);assert.ok(result.problems.length);}
  const overlap=structuredClone(f.ownership);overlap.components[0].roots=['','0'];
  const refused=linkReactSourceAnatomy(f.program,overlap,f.tree);
  assert.equal(refused.status,'refused');assert.deepEqual(refused.instances,[]);
  assert.deepEqual(refused.problems,['react-anatomy-roots-overlap']);
 }finally{rmSync(f.root,{recursive:true,force:true})}
});
