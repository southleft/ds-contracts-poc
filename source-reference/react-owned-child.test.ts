import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {readReactSourceProgram} from './react-source-program.js';
import {deriveReactChildRoot} from './react-child-root.js';
import {deriveReactNestedChild} from './react-nested-child.js';
import {walkAnatomy} from '../scripts/contract-schema.js';
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

for(const host of ['span','div'])test(`nested source ${host} hosts retain paint, size and wrappers while the main excludes caller text`,t=>{
 const f=fixture(t),file=Object.keys(f.program.files).find(p=>p.endsWith('/surface.tsx'))!;
 writeFileSync(file,readFileSync(file,'utf8').replace('span:any','span:any;div:any').replace('export function Toggle(props:{checked?:boolean;id?:string}){return <button><span/></button>}',
  `export function Toggle({children}:{children?:string}){return <button><${host}>{children}</${host}></button>}`));
 const program=readReactSourceProgram(path.dirname(file),['surface.tsx']);assert.deepEqual(program.problems,[]);
 const ownership=structuredClone(f.ownership);
 for(const instance of ownership.components){const c=program.components.find(c=>c.exportName===instance.source.exportName)!;
  instance.source={module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span};}
 ownership.components[1].props={children:'Sample caller text'};
 ownership.nodes.find(n=>n.path==='0.0')!.tag=host;
 const tree=structuredClone(f.tree),root=(tree.nodes[0] as {t:'el';el:CapturedNode}).el;
 const body=(root.nodes[0] as {t:'el';el:CapturedNode}).el;
 body.tag=host;
 body.style={...body.style,display:'flex','flex-direction':'column','font-family':'Inter','font-size':'14px','font-weight':'400','font-style':'normal','line-height':'20px','white-space-collapse':'collapse'};
 body.nodes=[{t:'text',v:'Sample caller text'}];
 const origin=structuredClone(f.origin);origin.roots.push({path:'0.0',tag:host,channels:[],sizes:['width','height'].map(channel=>({channel:channel as 'width'|'height',status:'fixed',value:'8px',selectors:['.body']}))});
 const evidence:ReactOwnedChildEvidence={fonts:{version:1,status:'observed',treeRevision:revisionOf(tree),problems:[],rows:[
  {path:[0,0],text:'Sample caller text',cssFamily:'Inter',cssWeight:'400',cssStyle:'normal',fonts:[{familyName:'Inter',postScriptName:'Inter-Regular',isCustomFont:true,glyphCount:18}]}]},
  svg:{version:1,status:'observed',treeRevision:revisionOf(tree),problems:[],rows:[]}};
 const before=structuredClone({program,ownership,tree,origin,evidence});
 const result=deriveReactNestedChild(program,ownership,tree,origin,'toggle',evidence);
 assert.equal(result.draft.status,'native-compiled');assert.equal(result.nestedSlot.sourcePath,'0.0');
 const part=walkAnatomy(result.draft.contract!).find(p=>p.part.slot)?.part;
 assert.equal(part?.slot?.name,'children');assert.equal(part?.element,host);
 assert.equal(JSON.stringify(result.draft.contract).includes('Sample caller text'),false);
 const spec=result.draft.native!.variants[0].spec,slot=spec.children![0];
 assert.equal(slot.type,'slot');assert.equal(slot.slotProperty,'Children');
 assert.equal(slot.layout?.mode,'VERTICAL');assert.ok(slot.fill||slot.bindings?.fills,'the slot retains its own paint');
 assert.ok(spec.fill||spec.bindings?.fills,'the outer host retains its own paint');
 assert.ok(slot.fixedWidth||slot.lits?.width,'the slot retains its authored size');
 assert.deepEqual(result,deriveReactNestedChild(program,ownership,tree,origin,'toggle',evidence));
 assert.deepEqual({program,ownership,tree,origin,evidence},before);
 const missing=structuredClone(origin);missing.roots.pop();assert.throws(()=>deriveReactNestedChild(program,ownership,tree,missing,'toggle',evidence),/style-origin-required/);
 const wrong=structuredClone(origin);wrong.roots[1].sizes![0].value='9px';assert.throws(()=>deriveReactNestedChild(program,ownership,tree,wrong,'toggle',evidence),/size-observation-mismatch/);
 for(const status of ['fill','unresolved','unknown']){
  const altered=structuredClone(origin);altered.roots[1].sizes![0].status=status as 'auto';
  assert.throws(()=>deriveReactNestedChild(program,ownership,tree,altered,'toggle',evidence),/react-nested-child-(fill-context|size)-unqualified/);
 }
 const duplicated=structuredClone(origin);duplicated.roots.push(structuredClone(duplicated.roots[1]));
 assert.throws(()=>deriveReactNestedChild(program,ownership,tree,duplicated,'toggle',evidence),/style-origin-required/);
 const styled=structuredClone(ownership);styled.components[1].props.className='caller-override';
 assert.throws(()=>deriveReactNestedChild(program,styled,tree,origin,'toggle',evidence),/caller-style-unqualified/);
 for(const key of ['fonts','svg'] as const){const stale=structuredClone(evidence);stale[key].treeRevision=revisionOf('stale');
  assert.throws(()=>deriveReactNestedChild(program,ownership,tree,origin,'toggle',stale));}
 const changedTree=structuredClone(tree),changedOwnership=structuredClone(ownership),changedEvidence=structuredClone(evidence);
 const changedBody=((changedTree.nodes[0] as {t:'el';el:CapturedNode}).el.nodes[0] as {t:'el';el:CapturedNode}).el;
 changedBody.nodes=[{t:'text',v:'Different caller'}];changedOwnership.components[1].props.children='Different caller';
 changedEvidence.fonts.treeRevision=revisionOf(changedTree);changedEvidence.svg.treeRevision=revisionOf(changedTree);
 changedEvidence.fonts.rows[0].text='Different caller';changedEvidence.fonts.rows[0].fonts[0].glyphCount=16;
 const changed=deriveReactNestedChild(program,changedOwnership,changedTree,origin,'toggle',changedEvidence);
 assert.deepEqual(changed.draft.contract,result.draft.contract,'changing caller text cannot change its reusable dependency');
 assert.deepEqual(changed.draft.tokens,result.draft.tokens);
 const boundTree=structuredClone(tree),boundOrigin=structuredClone(origin),boundEvidence=structuredClone(evidence);
 const boundBody=((boundTree.nodes[0] as {t:'el';el:CapturedNode}).el.nodes[0] as {t:'el';el:CapturedNode}).el;
 boundBody.style['--accent']='rgb(255, 255, 255)';boundBody.style['background-color']='rgb(255, 255, 255)';
 boundOrigin.roots[1].channels=[{...boundOrigin.roots[0].channels[0],selectors:['.body']}];
 boundEvidence.fonts.treeRevision=revisionOf(boundTree);boundEvidence.svg.treeRevision=revisionOf(boundTree);
 const bound=deriveReactNestedChild(program,ownership,boundTree,boundOrigin,'toggle',boundEvidence);
 const tokenPath='source.css.v'+Buffer.from('--accent').toString('hex');
 assert.deepEqual(bound.draft.sourceBindings!.filter(b=>b.variable==='--accent').map(b=>b.tokenPath),[tokenPath,tokenPath]);
 const named=(bound.draft.tokens!.source as {css:Record<string,{$extensions:Record<string,{selectors:string[]}>}>}).css;
 assert.deepEqual(Object.values(named)[0].$extensions['dev.ds-contracts.css-source'].selectors,['.body','.toggle']);
 const conflict=structuredClone(boundOrigin);conflict.roots[1].channels[0].rawValue='rgb(0, 0, 0)';
 assert.throws(()=>deriveReactNestedChild(program,ownership,boundTree,conflict,'toggle',boundEvidence),/source-binding-unresolved/);
});
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
