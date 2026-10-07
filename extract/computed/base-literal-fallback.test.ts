import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mintTokens,type MintObservation,type MintResult} from '../../core/mint-tokens.js';
import {loadConfig,propSpaceFor,stageFor,type SweepResult} from './capture.js';
import {reconstructCaptures,type CapturedTruthFile} from './replay.js';
import {promoteAnatomy} from './anatomy.js';
import {alignSweep,applyMintToContract,detectFolds,enrichLayout,prepareMint,styledChannels,uaStyles} from './fuse.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cfg=loadConfig(repo,path.join(repo,'extract/computed/configs/polaris.json'));
const comp=cfg.components.find(c=>c.name==='Tag')!;
const source=readFileSync(path.join(repo,'extract/computed/out/tag/captured-truth.json'),'utf8');
const truth=JSON.parse(source) as CapturedTruthFile;
const space=propSpaceFor(repo,cfg,comp);
const sweep={captures:reconstructCaptures(truth).map(c=>({...c,combo:`Tag:${c.combo}`})),
 controls:truth.controls,uaControls:truth.uaControls??{},uaBaselineBrowser:String(truth._provenance.uaBaselineBrowser),
 allProps:truth._provenance.channels,stylesheetSkips:[],browserVersion:String(truth._provenance.browser),
 fontChecks:{},pinnedAnimations:[],shadowHostTrails:{},textFillFolds:{},closedShadowSuspects:{},quarantined:[]} as SweepResult;
const aligned=alignSweep(sweep,comp,space,cfg.library.classPrefix);
const promotion=promoteAnatomy(space,comp,aligned.union,'tag');
const receipts:string[]=[];
const styled=styledChannels(aligned,space,Object.fromEntries(Object.entries(truth.controls).map(([tag,n])=>[tag,n.style])),
 sweep.allProps,receipts,{viewport:cfg.browser.viewport,stage:stageFor(cfg,comp),portaled:false},uaStyles(truth));
const folds=detectFolds(aligned,styled,receipts);
const layout=enrichLayout(aligned,space,styled,promotion.contract);
const prep=prepareMint(aligned,comp,space,styled,folds,layout.handled,promotion.contract,
 new Set([...promotion.consumed].map(i=>aligned.partNames[i])),new Set(promotion.partIndex.keys()),promotion.gridMintRefusals);
const empty=():MintResult=>({tree:{},count:0,entries:[],bindings:[],reconciled:[]});
const sample=(channel='padding-left')=>structuredClone(prep.baseObs.find(o=>o.part===''&&o.cssProperty===channel)!);
const ref=(axes=4)=>`{imported.tag.root.padding-left.${['{size}','{removable}','{clickable}','{linked}'].slice(0,axes).join('.')}}`;
const refused=(observation:MintObservation,axes=4)=>({tree:{},count:0,entries:[],bindings:[{nodePath:observation.nodePath,cssProperty:observation.cssProperty,ref:ref(axes)}],reconciled:[]}) as MintResult;
const apply=(observation:MintObservation,axes=4,contract=promotion.contract)=>
 applyMintToContract(contract,space,refused(observation,axes),[observation],empty(),[]);
const sizeLiteral=(root:ReturnType<typeof apply>['enriched']['anatomy']['root'])=>
 root.literalsByProp?.find(entry=>entry.prop==='size')?.map.large?.['padding-left'];

test('actual Tag source four-axis refusal retains exact base and evidenced size slice without promoting the ref',()=>{
 const before=JSON.stringify({truth,space:space.contract,promotion:promotion.contract,prep});
 const mintBase=mintTokens(comp.name,prep.baseObs,prep.axes,{nestedPairs:true});
 const mintStates=mintTokens(comp.name,prep.stateObs,prep.axes,{nestedPairs:true});
 const result=applyMintToContract(promotion.contract,space,mintBase,prep.baseObs,mintStates,prep.stateObs,
  layout.enriched,prep.declared,prep.declaredStates,prep.setPlaneLiterals,
  {only:prep.inheritanceOnly,stateDeltas:prep.inheritanceStateDeltas},prep.stateCodeOnly);
 const root=result.enriched.anatomy.root;
 for(const channel of ['padding-left','padding-right']){
  const observation=sample(channel);assert.equal(observation.occurrences.length,16);
  const binding=mintBase.bindings[prep.baseObs.findIndex(o=>o.part===''&&o.cssProperty===channel)];
  assert.equal((binding.ref!.match(/\{[^{}]+\}/g)??[]).length,4);
  assert.equal(root.literals?.[channel],'6px');
  assert.equal(root.literalsByProp?.find(entry=>entry.prop==='size')?.map.large?.[channel],'8px');
  assert.equal(root.tokens?.[channel],undefined);
  assert(result.overflowBindings.some(row=>row.part==='root'&&row.channel===channel&&row.ref===binding.ref&&row.refusal==='4 placeholders — beyond the two-axis vocabulary'));
  for(const occ of observation.occurrences){
   const combo=space.enumeration.combos.find(c=>c.key===occ.variant);assert(combo,occ.variant);
   if([...space.presence.keys()].every(p=>occ.axisValues[p]==='off')){
    assert.equal(occ.value,occ.axisValues.size==='large'?8:6,occ.variant);
   }
  }
 }
 assert.equal(JSON.stringify({truth,space:space.contract,promotion:promotion.contract,prep}),before);
 assert.equal(readFileSync(path.join(repo,'extract/computed/out/tag/captured-truth.json'),'utf8'),source);
});

test('three and four placeholders still refuse as substitutions after bounded literal fallback',()=>{
 for(const axes of [3,4]){
  const r=apply(sample(),axes);assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],'6px');
  assert.equal(r.enriched.anatomy.root.tokens?.['padding-left'],undefined);
  assert.equal(r.overflowBindings[0].refusal,`${axes} placeholders — beyond the two-axis vocabulary`);
  assert.equal(r.overflowBindings[0].ref,ref(axes));
 }
});

test('absent base observation does not invent a base or set-plane literal',()=>{
 const obs=sample();obs.occurrences=obs.occurrences.filter(o=>o.variant!==space.baseComboKey);
 const r=apply(obs);assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],undefined);
 assert.equal(sizeLiteral(r.enriched.anatomy.root),undefined);assert.equal(r.overflowBindings.length,1);
});

test('nonliteral values and inherited channels cannot use geometry fallback',()=>{
 const obs=sample();obs.kind='gradient';const r=apply(obs);
 assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],undefined);
 assert.equal(sizeLiteral(r.enriched.anatomy.root),undefined);assert.equal(r.overflowBindings.length,1);
 const inherited=sample();inherited.cssProperty='font-size';const text=apply(inherited);
 assert.equal(text.enriched.anatomy.root.literals?.['font-size'],undefined);
 assert.equal(text.overflowBindings[0].refusal,'4 placeholders — beyond the two-axis vocabulary');
});

test('ambiguous captured size slice preserves base but refuses the size projection',()=>{
 const obs=sample();const plane=obs.occurrences.find(o=>o.axisValues.size==='large'&&[...space.presence.keys()].every(p=>o.axisValues[p]==='off'))!;
 obs.occurrences.push({...structuredClone(plane),value:9});const r=apply(obs);assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],'6px');
 assert.equal(sizeLiteral(r.enriched.anatomy.root),undefined);assert.equal(r.overflowBindings.length,1);
});

test('an unobserved size slice does not invent a mode or literal',()=>{
 const obs=sample();obs.occurrences=obs.occurrences.filter(o=>o.axisValues.size!=='large');
 const r=apply(obs);assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],'6px');
 assert.equal(sizeLiteral(r.enriched.anatomy.root),undefined);assert.equal(r.overflowBindings.length,1);
});

test('state refusals never borrow the base literal fallback',()=>{
 const obs=sample();obs.cssProperty='padding-left-state-hover';
 const r=applyMintToContract(promotion.contract,space,empty(),[],refused(obs),[obs]);
 assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],undefined);
 assert.equal(sizeLiteral(r.enriched.anatomy.root),undefined);assert(r.overflowBindings.length>0);
});

test('qualified refs and reviewed literals retain their existing authority',()=>{
 const obs=sample();const mint=refused(obs);mint.bindings[0].ref='{imported.tag.root.padding-left}';
 const r=applyMintToContract(promotion.contract,space,mint,[obs],empty(),[]);
 assert.equal(r.enriched.anatomy.root.tokens?.['padding-left'],'{imported.tag.root.padding-left}');
 assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],undefined);assert.deepEqual(r.overflowBindings,[]);
 const reviewed=structuredClone(promotion.contract);reviewed.anatomy.root.literals={'padding-left':'10px'};
 reviewed.anatomy.root.literalsByProp=[{prop:'size',map:{large:{'padding-left':'12px'}}}];
 const kept=apply(obs,4,reviewed);assert.equal(kept.enriched.anatomy.root.literals?.['padding-left'],'10px');
 assert.equal(sizeLiteral(kept.enriched.anatomy.root),'12px');assert.equal(kept.overflowBindings.length,1);
});


test('reviewed base and conditional token/literal owners are never overwritten by receiver fallback',()=>{
 const owners:Array<(root:typeof promotion.contract.anatomy.root)=>void>=[
  root=>root.tokens={'padding-left':'{reviewed.space}'},
  root=>root.declared={'padding-left':'10px'},
  root=>root.literals={'padding-left':'10px'},
  root=>root.tokensByProp=[{prop:'size',map:{large:{'padding-left':'{reviewed.space}'}}}],
  root=>root.tokensByProp=[{prop:'removable',map:{on:{'padding-left':'{reviewed.space}'}}}],
  root=>root.literalsByProp=[{prop:'size',map:{large:{'padding-left':'12px'}}}],
  root=>root.literalsByCombination=[{props:['size','removable'],rows:[{values:['large','on'],literals:{'padding-left':'12px'}}]}],
  // Even an unqualified conditional token table remains owned and subject to
  // the referee; fusion cannot replace it with a seemingly qualified literal.
  root=>root.tokensByCombination=[{props:['size','removable'],rows:[{values:['large','on'],tokens:{'padding-left':'{reviewed.space}'}}]}],
 ];
 for(const own of owners){
  const contract=structuredClone(promotion.contract);own(contract.anatomy.root);
  const before=JSON.stringify(contract);const r=apply(sample(),4,contract);
  assert.deepEqual(r.enriched.anatomy.root,contract.anatomy.root);
  assert.equal(JSON.stringify(contract),before);assert.equal(r.overflowBindings[0].refusal,'4 placeholders — beyond the two-axis vocabulary');
 }
});

test('receiver fallback names the receiver ceiling while null-ref fallback keeps its existing cause',()=>{
 const obs=sample();const result=apply(obs);
 assert(result.enrichmentNotes.some(n=>n.includes('4 placeholders exceed the receiver vocabulary')));
 assert(!result.enrichmentNotes.some(n=>n.includes('uncorrelated across planes')));
 const mint=refused(obs);mint.bindings[0].ref=null;mint.bindings[0].reason='uncorrelated';
 const legacy=applyMintToContract(promotion.contract,space,mint,[obs],empty(),[]);
 assert(legacy.enrichmentNotes.some(n=>n.includes('uncorrelated across planes — the base combo\'s exact value; set planes remain named residue')));
 assert.equal(legacy.enriched.anatomy.root.literals?.['padding-left'],'6px');
});


test('contradictory base observations refuse fallback on both null and unsupported refs',()=>{
 const obs=sample();const base=obs.occurrences.find(o=>o.variant===space.baseComboKey)!;
 obs.occurrences.push({...structuredClone(base),value:Number(base.value)+1});
 for(const hasRef of [true,false]){
  const mint=refused(obs);if(!hasRef){mint.bindings[0].ref=null;mint.bindings[0].reason='uncorrelated';}
  const r=applyMintToContract(promotion.contract,space,mint,[obs],empty(),[]);
  assert.equal(r.enriched.anatomy.root.literals?.['padding-left'],undefined);
  assert.equal(sizeLiteral(r.enriched.anatomy.root),undefined);assert.equal(r.overflowBindings.length,1);
 }
});
