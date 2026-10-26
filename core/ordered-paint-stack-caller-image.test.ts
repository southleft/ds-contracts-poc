import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {ContractSchema,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import type {DumpNode,DumpSet,DumpImageAsset} from '../extract/figma/types.js';
import {proposeBatchFromDump,proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {generatedTypeErrors} from './react-test-runtime.js';
import {revisionOf} from './contract-provenance.js';

const imagePaths=['native-group-plane/18x18.png','native-group-plane/36x36.png','native-group-plane/27x45.png','native-affine-filled-path/chevron-left.png','native-affine-filled-path/chevron-right.png'];
const assets:Record<string,DumpImageAsset>=Object.fromEntries(imagePaths.map((path,i)=>{const bytes=readFileSync(new URL('../extract/figma/fixtures/'+path,import.meta.url));return ['asset'+i,{imageHash:'asset'+i,mimeType:'image/png',base64:bytes.toString('base64'),byteLength:bytes.length}];}));
const rawPaint=(hash:string)=>({type:'IMAGE' as const,imageHash:hash,scaleMode:'FILL' as const,blendMode:'NORMAL'});
const stack=(hashes:string[])=>({version:1 as const,order:'bottom-to-top' as const,complete:true as const,paints:hashes.map((hash,index)=>({index,paint:rawPaint(hash)}))});
const corpus=()=>tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){
 const main:DumpNode={name:'Default',type:'COMPONENT',nodeId:'10:1',componentKey:'main-key',variantProperties:{},imageFill:true,imagePaints:[{index:0,imageHash:'asset0',scaleMode:'FILL',blendMode:'NORMAL'}],sourceFillStack:stack(['asset0']),bbox:{width:20,height:20}};
 const leaf:DumpSet={setName:'Portrait',type:'COMPONENT',key:'leaf-key',nodeId:'10:0',propertyDefinitions:{},variants:[main]};
 const children:DumpNode[]=Array.from({length:5},(_,i)=>{const hashes=i===1?['asset0','asset1']:['asset'+i];return {name:'Portrait',type:'INSTANCE',nodeId:'20:'+(i+1),instanceOf:'Portrait',instanceKey:'main-key',instanceSetKey:'leaf-key',componentProperties:{},instanceGeometry:{nodeId:'20:'+(i+1),componentId:'10:1',transform:[[1,0,20*i],[0,1,0]],localSize:{width:20,height:20}},bbox:{width:20,height:20},imageFill:true,imagePaints:hashes.map((imageHash,index)=>({index,imageHash,scaleMode:'FILL',blendMode:'NORMAL'})),sourceFillStack:stack(hashes)};});
 const host:DumpSet={setName:'People',type:'COMPONENT',key:'host-key',nodeId:'20:0',propertyDefinitions:{},variants:[{name:'Default',type:'COMPONENT',nodeId:'20:10',variantProperties:{},layout:{mode:'HORIZONTAL',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children}]};
 return {main,leaf,children,host,dump:{Portrait:leaf,People:host,_imageAssets:structuredClone(assets)}};
}
function propose(f=fixture(),stampsObservable=false){
 const before=JSON.stringify(f.dump),batch=proposeBatchFromDump(f.dump,{fileKey:'file',corpus:corpus(),contractIdByName:new Map(),mintUnbound:true,stampsObservable});
 assert.equal(JSON.stringify(f.dump),before);assert.deepEqual(batch.skipped,[]);
 const scope=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c];}));
 const parent=[...scope.values()].find(c=>c.name==='People')!,child=[...scope.values()].find(c=>c.name==='Portrait')!;
 const tree:Record<string,unknown>={};
 const merge=(left:Record<string,unknown>,right:Record<string,unknown>)=>{for(const[k,v]of Object.entries(right)){if(v&&typeof v==='object'&&!Array.isArray(v)&&!('$value'in v)){const existing=left[k];if(!existing||typeof existing!=='object')left[k]={};merge(left[k] as Record<string,unknown>,v as Record<string,unknown>);}else left[k]=v;}};
 for(const p of batch.proposals)merge(tree,p.mintedTokens?.tree??{});
 const tokens={primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 return{batch,scope,parent,child,tokens,inventory:new Set(batch.proposals.flatMap(p=>p.mintedTokens?.entries.map(e=>e.ref.slice(1,-1))??[]))};
}
async function runtime(name:string,tsx:string,dependencies:Record<string,string>={}){
 const output=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {${name}} from 'subject';exports.render=(props)=>renderToStaticMarkup(React.createElement(${name},props));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom/server'],plugins:[{name:'memory',setup(b){
  b.onResolve({filter:/^(subject|\.\.?\/)/},a=>a.path==='subject'?{path:name,namespace:'memory'}:dependencies[a.path.split('/').pop()!]?{path:a.path.split('/').pop()!,namespace:'memory'}:a.path.endsWith('.css')?{path:'style',namespace:'css'}:undefined);
  b.onLoad({filter:/.*/,namespace:'memory'},a=>({contents:a.path===name?tsx:dependencies[a.path],loader:'tsx',resolveDir:process.cwd()}));
  b.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default new Proxy({}, {get:(_,name)=>String(name)})',loader:'js'}));
 }}]});
 const mod={exports:{} as {render?:(props:Record<string,unknown>)=>string}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return mod.exports.render!;
}

test('same-main modern single images preserve all caller identities and leave exact inherited default unchanged',()=>{
 const r=propose(),parts=Object.values(r.parent.anatomy.root.parts!);
 assert.equal(parts.length,5);assert.equal(parts[0].fillStack,undefined);assert.equal(parts[0].fillStackSource,undefined);
 assert.deepEqual(parts.slice(1).map(p=>p.fillStack!.paints.map(p=>p.type==='IMAGE'?p.imageHash:'')),[['asset0','asset1'],['asset2'],['asset3'],['asset4']]);
 for(const part of parts.slice(1)){assert.equal(part.component!.id,r.child.id);assert.deepEqual(part.fillStackSource,{fileKey:'file',setKey:'leaf-key',contractRevision:revisionOf(r.child)});}
 assert.equal(r.child.anatomy.root.fillStack,undefined);assert.equal(r.child.anatomy.root.overridable,undefined);
});

test('actual generated parent-child chains retain five instances on both React surfaces; omission restores child default',async()=>{
 const r=propose();
 for(const kind of ['module','inline'] as const){
  const emit=(c:Contract)=>kind==='module'?emitReact(c,{tokens:r.inventory,tokenValues:r.tokens,icons:new Map(),contracts:r.scope}):emitReactInline(c,{tokens:r.tokens,icons:new Map(),contracts:r.scope});
  const child=emit(r.child),parent=emit(r.parent);assert.deepEqual(generatedTypeErrors(r.parent.name,parent.tsx,{[r.child.name]:child.tsx}),[]);
  const render=await runtime(r.parent.name,parent.tsx,{[r.child.name]:child.tsx}),html=render({});
  assert.equal((html.match(/data-dsc-stack-active/g)||[]).length,4);assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,5);
  for(const index of [1,2,3,4])assert(html.includes((assets['asset'+index] as {base64:string}).base64));
  const renderChild=await runtime(r.child.name,child.tsx),plain=renderChild({});assert(!plain.includes('data-dsc-stack-active'));assert(!plain.includes('data-dsc-paint-index'));
  const mutated=structuredClone(r.parent);Object.values(mutated.anatomy.root.parts!)[2].fillStackSource!.contractRevision='changed';const scope=new Map(r.scope);scope.set(mutated.id,mutated);
  assert.throws(()=>kind==='module'?emitReact(mutated,{tokens:r.inventory,tokenValues:r.tokens,icons:new Map(),contracts:scope}):emitReactInline(mutated,{tokens:r.tokens,icons:new Map(),contracts:scope}),/fill-stack/);
 }
});

test('single caller stacks retain hidden paint, float opacity and exact crop transform',()=>{
 const f=fixture(),n=f.children[2];n.sourceFillStack!.paints[0].paint={...rawPaint('asset2'),visible:false,opacity:Math.fround(.25),scaleMode:'CROP',imageTransform:[[.5,0,.25],[0,.5,.25]]};
 // The reader excludes hidden image paints from its visible legacy list.
 n.imagePaints=undefined;delete n.imageFill;
 const part=Object.values(propose(f).parent.anatomy.root.parts!)[2],p=part.fillStack!.paints[0];
 assert.equal(p.visible,false);assert.equal(p.opacity,.25);assert(p.type==='IMAGE');assert.deepEqual(p.imageTransform,[[.5,0,.25],[0,.5,.25]]);assert.equal(p.imageHash,'asset2');
});

test('missing assets, malformed declared-complete paints and same-name foreign owner refuse explicit carriage',()=>{
 const edits:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{delete f.dump._imageAssets.asset2;},
  f=>{f.children[2].sourceFillStack!.paints[0].index=1;},
  f=>{f.children[2].sourceFillStack!.paints[0].paint={...rawPaint('asset2'),scaleMode:'TILE'};},
  f=>{f.children[2].instanceSetKey='foreign';},
 ];
 for(const edit of edits){const f=fixture();edit(f);const batch=proposeBatchFromDump(f.dump,{fileKey:'file',corpus:corpus(),contractIdByName:new Map(),mintUnbound:true});assert(batch.skipped.some(x=>x.setName==='People'),JSON.stringify(batch.skipped));}
});

test('missing optional default witness keeps explicit stack instead of guessing no-op',()=>{
 const f=fixture(),leaf=proposeFromDump(f.leaf,{fileKey:'file',corpus:corpus(),contractIdByName:new Map(),mintUnbound:true,imageAssets:assets});
 const c=ContractSchema.parse(leaf.contract),host=proposeFromDump(f.host,{fileKey:'file',corpus:corpus(),contractIdByName:new Map([['Portrait',c.id]]),contractIdByKey:new Map([['leaf-key',c.id]]),contractsById:new Map([[c.id,c]]),mintUnbound:true,imageAssets:assets});
 const parts=Object.values(ContractSchema.parse(host.contract).anatomy.root.parts!);assert.equal(parts[0].fillStack!.paints.length,1);assert.equal(parts[0].fillStackSource!.contractRevision,revisionOf(c));
});

test('legacy nonreference single image root does not gain ordered-stack behavior',()=>{
 const f=fixture(),r=proposeFromDump(f.leaf,{fileKey:'file',corpus:corpus(),contractIdByName:new Map(),mintUnbound:true,imageAssets:assets}),c=ContractSchema.parse(r.contract);
 assert.equal(walkAnatomy(c).filter(w=>w.part.fillStack||w.part.fillStackByCombination).length,0);assert(r.mintedTokens!.entries.some(e=>e.value===`url('data:image/png;base64,${(assets.asset0 as {base64:string}).base64}')`));
});


test('visible single-image alpha and filters retain the upstream named refusal',()=>{
 for(const fault of ['opacity','filter']){
  const f=fixture(),n=f.children[2];
  if(fault==='opacity'){n.imagePaints![0].opacity=.5;n.sourceFillStack!.paints[0].paint={...rawPaint('asset2'),opacity:.5};}
  else {n.imagePaints![0].filters={contrast:.2};n.sourceFillStack!.paints[0].paint={...rawPaint('asset2'),filters:{contrast:.2}};}
  const batch=proposeBatchFromDump(f.dump,{fileKey:'file',corpus:corpus(),contractIdByName:new Map(),mintUnbound:true});
  assert(batch.skipped.some(x=>x.setName==='People'&&x.reason.includes('native-image-paint-unqualified')));
 }
});


test('referenced legacy images without complete stack facts retain their previous path and a named limit',()=>{
 for(const incomplete of [false,true]){
  const f=fixture();if(incomplete)(f.children[2].sourceFillStack as {complete:boolean}).complete=false;else delete f.children[2].sourceFillStack;
  const r=propose(f),part=Object.values(r.parent.anatomy.root.parts!)[2];
  assert.equal(part.fillStack,undefined);assert.equal(part.fillStackSource,undefined);assert.equal(part.component!.id,r.child.id);
  assert(r.batch.proposals.find(p=>p.contract.id===r.parent.id)!.notes.some(note=>note.includes('no complete source fill stack')));
 }
});


test('combined proposal carries caller images and inside strokes through actual parent-child runtimes',async()=>{
 const f=fixture();
 for(const n of f.children){
  n.strokeAlign='INSIDE';n.strokeWeight=2;n.strokesIncludedInLayout=false;n.stroke={hex:'ffffff'};
  n.sourceStrokeStack={version:1,order:'bottom-to-top',complete:true,paints:[{index:0,paint:{type:'SOLID',blendMode:'NORMAL',color:{r:1,g:1,b:1}}}]};
  n.sourceStrokePattern={version:1,complete:true,dashes:[],defaulted:true};
  const geometry=n.instanceGeometry!;
  n.instanceRootOverrides={nodeId:n.nodeId!,componentId:geometry.componentId,componentKey:'main-key',componentSetKey:'leaf-key',fields:['strokes','strokeWeight'],mainSize:{width:20,height:20},localSize:{width:20,height:20},localTransform:geometry.transform};
 }
 const r=propose(f,true),parts=Object.values(r.parent.anatomy.root.parts!);
 assert(r.child.anatomy.root.instanceRootInputs!.includes('border-color'));assert(r.child.anatomy.root.instanceRootInputs!.includes('border-width'));
 for(const part of parts)assert.deepEqual(Object.keys(part.component!.rootOverrides!).sort(),['border-color','border-width']);
 assert.equal(parts[0].fillStack,undefined);assert.deepEqual(parts.slice(1).map(p=>p.fillStack!.paints.map(p=>p.type==='IMAGE'?p.imageHash:'')),[['asset0','asset1'],['asset2'],['asset3'],['asset4']]);
 for(const kind of ['module','inline']as const){
  const emit=(c:Contract)=>kind==='module'?emitReact(c,{tokens:r.inventory,tokenValues:r.tokens,icons:new Map(),contracts:r.scope}):emitReactInline(c,{tokens:r.tokens,icons:new Map(),contracts:r.scope});
  const child=emit(r.child),parent=emit(r.parent);assert.deepEqual(generatedTypeErrors(r.parent.name,parent.tsx,{[r.child.name]:child.tsx}),[]);
  const render=await runtime(r.parent.name,parent.tsx,{[r.child.name]:child.tsx}),html=render({});
  assert.equal((html.match(/data-dsc-inside-stroke=/g)||[]).length,5);assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,5);
  const standalone=await runtime(r.child.name,child.tsx);assert(!standalone({}).includes('data-dsc-inside-stroke'));
 }
});
