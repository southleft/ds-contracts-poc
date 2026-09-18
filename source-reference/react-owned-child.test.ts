import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {readReactSourceProgram} from './react-source-program.js';
import {deriveReactChildRoot} from './react-child-root.js';
import {prepareReactNativePlan} from './react-native-plan.js';
import {revisionOf} from '../core/contract-provenance.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactOwnership} from './react-ownership.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import type {ReactOwnedChildEvidence} from './react-owned-child.js';

function fixture(t:test.TestContext){
 const dir=mkdtempSync(path.join(tmpdir(),'react-owned-child-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'preserve',strict:true,target:'ES2022',skipLibCheck:true}}));
 writeFileSync(path.join(dir,'surface.tsx'),`
 declare global {namespace JSX {interface Element {} interface IntrinsicElements {section:any;button:any;span:any}}}
 export function Box(props:{children?:unknown}){return <section {...props}/>}
 export function Toggle(props:{checked?:boolean;id?:string}){return <button><span/></button>}
 export function Mark(){return <span/>}
 `);
 const program=readReactSourceProgram(dir,['surface.tsx']);assert.deepEqual(program.problems,[]);
 const source=(name:string)=>{const c=program.components.find(c=>c.exportName===name)!;return{module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};};
 const child:CapturedNode={tag:'button',classes:[],pseudo:{},style:{display:'inline-flex','flex-direction':'row','align-items':'center','justify-content':'center',width:'16px',height:'16px','box-sizing':'border-box','background-color':'rgb(255, 255, 255)','--accent':'rgb(255, 255, 255)'},
  nodes:[{t:'el',el:{tag:'span',classes:[],pseudo:{},nodes:[],style:{display:'block',width:'8px',height:'8px','background-color':'rgb(0, 0, 0)'}}}]};
 const tree:CapturedNode={tag:'section',classes:[],pseudo:{},style:{display:'flex','flex-direction':'row'},nodes:[{t:'el',el:child}]};
 const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],problems:[],components:[
  {id:'box',source:source('Box'),props:{children:{kind:'object'}},roots:['']},
  {id:'toggle',parent:'box',source:source('Toggle'),props:{checked:true,id:'chosen'},roots:['0']}],nodes:[
   {path:'',tag:'section',nearestComponent:'box',createdBy:'box'},{path:'0',tag:'button',nearestComponent:'toggle',createdBy:'toggle'},
   {path:'0.0',tag:'span',nearestComponent:'toggle',createdBy:'toggle'}]};
 const origin:ReactStyleOrigin={version:1,roots:[{path:'0',tag:'button',channels:[{channel:'background-color',status:'direct-variable',variable:'--accent',rawValue:'rgb(255, 255, 255)',computedValue:'rgb(255, 255, 255)',selectors:['.toggle']}],
  sizes:['width','height'].map(channel=>({channel:channel as 'width'|'height',status:'fixed',value:'16px',selectors:['.toggle']}))}]};
 const evidence:ReactOwnedChildEvidence={fonts:{version:1,status:'observed',treeRevision:revisionOf(tree),rows:[],problems:[]},
  svg:{version:1,status:'observed',treeRevision:revisionOf(tree),rows:[],problems:[]}};
 const run=(o=ownership,s=origin,e=evidence)=>deriveReactChildRoot(program,o,tree,s,'toggle',undefined,e);
 return{program,ownership,tree,origin,evidence,run,source};
}
test('owned child carries its exact observed content, held inputs, authored size and root variable into the native plan',t=>{
 const f=fixture(t),child=f.run();
 assert.equal(child.contentMode,'source-owned');assert.deepEqual(child.heldProps,{checked:true,id:'chosen'});
 assert.equal(child.draft.native!.rootSlot,undefined);assert.equal(child.draft.native!.variants.length,1);
 assert.equal(child.draft.contract!.props.length,0);assert.equal(child.draft.contract!.states.length,0);
 assert.equal(child.draft.sourceBindings![0].tokenPath,'source.css.v'+Buffer.from('--accent').toString('hex'));
 assert.equal(child.sourceOwnedTree!.nodes.length,1);assert.deepEqual(f.run(),child);
 const plan=prepareReactNativePlan({matrix:child,operation:{id:'10000000-0000-4000-8000-000000000001',fileKey:'T56aKuRnoay1L7CKAjSWRO'},
  source:{revision:revisionOf(f.tree),programSha256:revisionOf(f.program).slice(7),evidenceRevision:revisionOf('sealed source')}});
 assert.equal(plan.plan.component.variants.length,1);assert.equal(plan.plan.component.rootSlot,undefined);
 assert.ok(plan.plan.component.variants[0].spec.children?.length);
});
test('owned child refuses sampled sizing, caller styling, unbound source variables and altered glyph/viewport evidence',t=>{
 const f=fixture(t);
 for(const change of [
  (o:ReactStyleOrigin)=>{o.roots[0].sizes![0].status='auto';},
  (o:ReactStyleOrigin)=>{o.roots[0].sizes![1].value='32px';},
  (o:ReactStyleOrigin)=>{o.roots[0].channels[0].rawValue='rgb(0, 0, 0)';},
 ]){const origin=structuredClone(f.origin);change(origin);assert.throws(()=>f.run(f.ownership,origin));}
 const styled=structuredClone(f.ownership);styled.components[1].props.style={kind:'object'};
 assert.throws(()=>f.run(styled),/caller-style-unqualified/);
 for(const key of ['fonts','svg'] as const){const evidence=structuredClone(f.evidence);evidence[key].treeRevision=revisionOf('other');assert.throws(()=>f.run(f.ownership,f.origin,evidence));}
 const nested=structuredClone(f.ownership);nested.components.push({...nested.components[1],id:'grandchild',source:f.source('Mark'),parent:'toggle',roots:['0.0']});
 assert.throws(()=>f.run(nested),/leaf-required/);
 assert.throws(()=>deriveReactChildRoot(f.program,f.ownership,f.tree,f.origin,'toggle'),/projection-unavailable/);
});
