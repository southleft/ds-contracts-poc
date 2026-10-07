import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectDraftPaintChild} from './draft-paint-child.js';
import {proposeDeclaredDrawnCandidate,proposeDeclaredDrawnDraftPaintCandidate} from './propose-figma.js';
import {capturedTokensFromDump} from './captured-tokens.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';

function source(name:string,setName:string,child?:any) {
 const dump=JSON.parse(readFileSync(new URL(`./fixtures/carbon-tooltip-draft/${name}.json`,import.meta.url),'utf8'));
 const tokens=capturedTokensFromDump(dump)!;
 const set=dump[setName],declaration=set.variants.map((v:any)=>v.variantProperties);
 const opts={fileKey:dump._provenance.fileKey,corpus:tokenCorpusFromJson({primitives:{},semantic:tokens.tree,light:{},brandDefault:{}}),
  capturedValues:new Map(tokens.entries.map(e=>[e.path,e.value])),
  contractIdByName:new Map(child?[['_Tooltip caret item',child.id]]:[]),
  contractIdByKey:new Map(child?[[child.bindings.figma.anchors.componentSetKey,child.id]]:[]),
  contractsById:new Map(child?[[child.id,child]]:[]),mintUnbound:true,hiddenCaptured:true,stampsObservable:true};
 return {set,declaration,opts,tokens};
}
function caret(){const s=source('caret','_Tooltip caret item');return proposeDeclaredDrawnDraftPaintCandidate(s.set,s.opts,s.declaration).proposal.contract;}

test('captured Carbon child proofs survive inspection and compose into all twelve body variants',()=>{
 const child=caret(),before=JSON.stringify(child),inspected=inspectDraftPaintChild(child);
 assert.ok(inspected);assert.deepEqual(inspected,child);assert.equal(JSON.stringify(child),before);
 assert.equal(ContractSchema.safeParse(inspected).success,false,'inspection does not promote the bound draft');
 const s=source('body','_Toggletip body item',inspected),input=JSON.stringify(s.set);
 const result=proposeDeclaredDrawnDraftPaintCandidate(s.set,s.opts,s.declaration);
 assert.equal(result.acceptedContract,null);assert.equal(s.declaration.length,12);
 assert.equal(JSON.stringify(s.set),input);assert.equal(JSON.stringify(child),before);
 assert.ok(result.proposal.draftPaintQualification!.sourceBindings!.length>=12);
 const content=(result.proposal.contract as any).anatomy.root.parts.Content;
 assert.equal(content.layoutByProp.map.bottom.alignSelf,'stretch');
 assert.equal(content.layoutByProp.map.top.alignSelf,'auto');
 assert.equal(content.layoutByProp.map.left.grow,true);
 const instance=(result.proposal.contract as any).anatomy.root.parts.TooltipCaretItem;
 assert.equal(instance.instanceAffineByProp!.prop,'position');
 assert.deepEqual(instance.instanceAffineByProp!.map.bottom.transform,[[1,0,0],[0,-1,6]]);
 assert.equal(inspected!.anatomy.root.literals!.width,'fit-content');
 // The public stacking fence now rejects this draft before binding recreation.
 assert.throws(()=>proposeDeclaredDrawnCandidate(s.set,s.opts,s.declaration),/solid-fill-composition-child-stacking-unqualified/);
 const without=source('body','_Toggletip body item');
 assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(without.set,without.opts,without.declaration),/instance-root-unqualified/);
});

test('draft child inspection refuses corrupted binding evidence and unrelated schema violations',()=>{
 const child=caret() as any;
 for(const mutate of [
  (c:any)=>c.anatomy.root.solidFillCompositionSourceBinding=[],
  (c:any)=>c.anatomy.root.solidFillCompositionSourceBinding[0].binding.consumer.value.r=0,
  (c:any)=>c.anatomy.root.solidFillCompositionSourceBinding[0].binding.paint.opacity=.5,
  (c:any)=>c.anatomy.root.solidFillCompositionSourceBinding[0].binding.extra=true,
  (c:any)=>c.anatomy.root.solidFillCompositionSourceBinding[0].owner='',
  (c:any)=>c.anatomy.root.unrecognized=true,
 ]){const bad=structuredClone(child);mutate(bad);assert.equal(inspectDraftPaintChild(bad),undefined);}
});


test('composed body and retained child emit type-correct React on both surfaces',async()=>{
 const {emitReactDraftPaintQualification}=await import('./emit-react.js');
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {generatedTypeErrors}=await import('./react-test-runtime.js');
 const {tokenInventoryFromJson}=await import('../packages/core/src/tokens.js');
 const cs=source('caret','_Tooltip caret item'),cp=proposeDeclaredDrawnDraftPaintCandidate(cs.set,cs.opts,cs.declaration).proposal;
 const bs=source('body','_Toggletip body item',cp.contract),bp=proposeDeclaredDrawnDraftPaintCandidate(bs.set,bs.opts,bs.declaration).proposal;
 const contracts=new Map([cp.contract,bp.contract,...(bp.childStubs??[])].map((c:any)=>[c.id,c]));
 const merge=(a:any,b:any):any=>{const out=structuredClone(a);for(const [key,value] of Object.entries(b))out[key]=value&&typeof value==='object'&&!Array.isArray(value)?merge(out[key]??{},value):value;return out;};
 const tokens={primitives:merge(cp.mintedTokens!.tree,bp.mintedTokens!.tree),semantic:merge(cs.tokens.tree,bs.tokens.tree),light:{},dark:{},brands:{default:{}}};
 const ctx={contracts,icons:new Map<string,string>(),tokens:tokenInventoryFromJson([tokens.primitives,tokens.semantic]),tokenValues:tokens};
 for(const surface of ['module','inline']){
  const outputs=[...contracts.values()].map(c=>[c.name,surface==='module'?emitReactDraftPaintQualification(c,ctx):emitReactInlineDraftPaintQualification(c,{...ctx,tokens})] as const);
  const dependencies=Object.fromEntries(outputs.map(([name,out])=>[name,out.tsx]));
  const body=outputs.find(([name])=>name===bp.contract.name)!;
  delete dependencies[body[0]];
  assert.deepEqual(generatedTypeErrors(body[0],body[1].tsx,dependencies),[],surface);
 }
});
