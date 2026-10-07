import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeBatchFromDump,proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {composedFillReferenceChild} from '../packages/core/src/anatomy.js';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/inherited-bound-fill/carbon.json',import.meta.url),'utf8'));
const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,hiddenCaptured:true,fileKey:'A451UfD58U7XU21FzaqfHL',contractIdByName:new Map<string,string>(),drawnVariantSurface:'react-runtime' as const};
test('Carbon closure inherits the exact bound main paint and retains Resizer visibility',()=>{
 const dump=fixture(),before=JSON.stringify(dump),r=proposeBatchFromDump(dump,opts);assert.deepEqual(r.skipped,[]);assert.equal(r.proposals.length,3);
 const child:any=r.proposals.find(p=>p.setName==='Resizer')!.contract;
 const cell:any=r.proposals.find(p=>p.setName==='_Structured list row cell base')!.contract;
 const ref=cell.anatomy.root.parts.Resizer;assert(ref.visibleWhen);assert.equal(ref.solidFillComposition,undefined);assert.equal(ref.solidFillCompositionToken,undefined);
 assert(child.anatomy.root.solidFillCompositionToken);assert(child.anatomy.root.solidFillCompositionSourceBinding.length);
 assert(r.proposals.some(p=>p.notes.some(n=>n.includes('binding inherited from that child'))));
 assert.equal(JSON.stringify(dump),before);
});
test('different variables and fill overrides retain caller binding instead of inheriting the main',()=>{
 for(const kind of ['variable','override','missing']){
  const dump=fixture();
  if(kind==='missing')delete dump.Resizer;
  else for(const v of dump['_Structured list row cell base'].variants){
   const node=v.children.find((n:any)=>n.name==='Resizer');assert(node);
   if(kind==='override')node.instanceRootOverrides.fields.push('fills');
   else{const old=node.sourceFillComposition.variableId;node.sourceFillComposition.variableId='VariableID:other';node.variableConsumers['VariableID:other']=node.variableConsumers[old];delete node.variableConsumers[old];}
  }
  const r=proposeBatchFromDump(dump,opts);
  if(kind==='missing'){assert(r.skipped.some(p=>p.setName==='_Structured list row cell base'),kind);continue;}
  assert.deepEqual(r.skipped,[],kind);
  const cell:any=r.proposals.find(p=>p.setName==='_Structured list row cell base')!.contract;
  const ref=cell.anatomy.root.parts.Resizer;
  assert(ref.solidFillCompositionToken,kind);assert(ref.solidFillCompositionSourceBinding.length,kind);
  assert.equal(ref.solidFillCompositionSourceBinding[0].binding.variableId,kind==='variable'?'VariableID:other':dump['_Structured list row cell base'].variants[0].children.find((n:any)=>n.name==='Resizer').sourceFillComposition.variableId);
 }
});
test('reference foreground placement permits size inputs but keeps paint and positioning restrictions',()=>{
 const r=proposeBatchFromDump(fixture(),opts),contracts=new Map(r.proposals.map(p=>{const c:any=p.contract;return[c.id,c]}));
 const parent:any=r.proposals.find(p=>p.setName==='_Structured list row item')!.contract,part=parent.anatomy.root.parts.col1;
 assert(composedFillReferenceChild(part,contracts));assert(part.component.rootOverrides.width);
 const bad=structuredClone(part);bad.component.rootOverrides.opacity='{opacity}';assert(!composedFillReferenceChild(bad,contracts));
 const positioned=structuredClone(part);positioned.declared={position:'absolute'};assert(!composedFillReferenceChild(positioned,contracts));
});
test('Carbon disabled text reaches the exact owned child input without coloring enabled rows',()=>{
 const r=proposeBatchFromDump(fixture(),opts);assert.deepEqual(r.skipped,[]);
 const cell=r.proposals.find(p=>p.setName==='_Structured list row cell base')!,parent:any=r.proposals.find(p=>p.setName==='_Structured list row item')!.contract;
 assert(cell.textColorBindings?.length);const names=new Set(cell.textColorBindings!.map(b=>b.prop));assert.equal(names.size,1);const prop=[...names][0];
 for(const part of Object.values(parent.anatomy.root.parts) as any[])assert.deepEqual(part.component.props[prop],{prop:'state',map:{disabled:'#16161640'}});
 assert(r.proposals.some(p=>p.notes.some(n=>n.includes('variable binding is not recreated'))));
});
test('text override consumer evidence rejects ambiguous names, stale alpha, conflicting hex, and broken aliases',async()=>{
 const {observedTextOverrideColor}=await import('./source-text-color-control.js');
 const dump=fixture(),h=dump['_Structured list row item'].variants.find((v:any)=>v.name.includes('State=Disabled')).children[0].hostOverrides[0];
 assert.equal(observedTextOverrideColor(h),'#16161640');
 for(const kind of ['missing','ambiguous','alpha','hex','alias']){
  const bad=structuredClone(h),id=Object.keys(bad.variableConsumers)[0];
  if(kind==='missing')delete bad.variableConsumers;
  if(kind==='ambiguous')bad.variableConsumers.other=structuredClone(bad.variableConsumers[id]);
  if(kind==='alpha')bad.fill.alpha=0.5;
  if(kind==='hex')bad.fill.hex='ffffff';
  if(kind==='alias')bad.variableConsumers[id].selectedValue={type:'VARIABLE_ALIAS',id:'missing'};
  assert.throws(()=>observedTextOverrideColor(bad),/text-color-demand|source-variable-binding-unqualified/,kind);
 }
});
test('real Tooltip caret inherits bound paint through qualified dimension inputs and exact reachable layouts',async()=>{
 const {validateContract}=await import('../packages/core/src/validate.js');
 const dump=JSON.parse(readFileSync(new URL('./fixtures/inherited-bound-fill/tooltip-body.json',import.meta.url),'utf8'));
 const r=proposeBatchFromDump(dump,opts);assert.deepEqual(r.skipped,[]);
 const parent:any=r.proposals.find(p=>p.setName==='Tooltip body item')!.contract;
 const caret=Object.values(parent.anatomy.root.parts).find((p:any)=>p.component) as any;
 assert.deepEqual(Object.keys(caret.component.rootOverrides).sort(),['height','width']);
 assert.equal(caret.solidFillCompositionSourceBinding,undefined);
 assert(r.proposals.some(p=>p.notes.some(n=>n.includes('binding inherited from that child'))));
 const contracts=r.proposals.map(p=>p.contract as any);
 const validate=(c:any)=>{const errors:string[]=[];validateContract(c,new Map(contracts.map(p=>[p.id,p])),errors,new Map(),{drawnVariants:'react-runtime'});return errors.filter(e=>e.includes('layoutByCombination'));};
 assert.deepEqual(validate(parent),[]);
 const {resolveLayout}=await import('../scripts/contract-schema.js');
 for(const alignment of ['start','center','end'])assert.equal(resolveLayout(parent.anatomy.root,{type:'standard',position:'top',alignment})?.align,alignment);
 assert.equal(resolveLayout(parent.anatomy.root,{type:'standard',position:'bottom',alignment:'end'})?.direction,'column-reverse');
 const missing=structuredClone(parent);missing.anatomy.root.layoutByCombination.rows.pop();assert(validate(missing).some(e=>e.includes('exact coverage')));
 const extra=structuredClone(parent),table=extra.anatomy.root.layoutByCombination;
 table.rows.push({values:table.props.map((p:string)=>parent.bindings.figma.absentVariants[0][p]),layout:table.rows[0].layout});
 assert(validate(extra).some(e=>e.includes('exact coverage')));
 const noAbsence=structuredClone(parent);delete noAbsence.bindings.figma.absentVariants;assert(validate(noAbsence).some(e=>e.includes('complete finite coverage')));
});

test('native instance probe preserves binding and blend only through an existing paint receiver',async()=>{
 const {createHash}=await import('node:crypto');
 const evidence=JSON.parse(readFileSync(new URL('./fixtures/inherited-bound-fill/instance-layer-probe.json',import.meta.url),'utf8'));
 const {probe,comparison}=evidence;
 assert.equal(probe.bound.blendMode,'MULTIPLY');
 for(const name of ['Bound direct','Bound then blend']){
  const instance=probe.rows.find((r:any)=>r.name===name);
  assert.equal(instance.type,'INSTANCE');assert.equal(instance.fills[0].blendMode,'NORMAL');
  assert.equal(instance.fills[0].boundVariables.color.id,probe.variableId);
 }
 const main=probe.rows.find((r:any)=>r.name==='Paint layer main');
 const literalMain=probe.rows.find((r:any)=>r.name==='Literal main');
 for(let i=0;i<3;i++){
  const literal=comparison.frames.find((r:any)=>r.name===`literal-${i}`),layer=comparison.frames.find((r:any)=>r.name===`layer-${i}`);
  assert.equal(literal.mainId,literalMain.id);assert.equal(layer.mainId,main.id);
  const receiver=layer.children[0];assert.equal(receiver.name,'Paint');
  assert.equal(receiver.blendMode,'MULTIPLY');assert.equal(receiver.fills[0].blendMode,'NORMAL');
  assert.equal(receiver.fills[0].boundVariables.color.id,probe.variableId);
  assert.equal(layer.children[1].name,'Foreground');assert.deepEqual(layer.children[1].fills,literal.children[0].fills);
  for(const row of [literal,layer])assert.equal(createHash('sha256').update(Buffer.from(row.png,'base64')).digest('hex'),row.sha256);
  assert.equal(layer.png,literal.png,'literal and bound instance exports must be byte-identical on each backdrop');
 }
});


function mixedOwnedPaintFixture(){
 const colors=[undefined,{r:.125,g:.25,b:.5,a:.5},{r:.75,g:.5,b:.25,a:1}];
 const set:any={setName:'MixedPaint',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Raw',variantOptions:['Raw','BoundA','BoundB']}},variants:['Raw','BoundA','BoundB'].map((mode,i)=>{
  const color=colors[i],consumer=color?{name:'Theme/Surface',collectionId:'theme',modeId:mode,modeName:mode,resolvedType:'COLOR',value:color,selectedValue:{type:'VARIABLE_ALIAS',id:'leaf'},aliasChain:[{id:'leaf',name:'Palette/Surface',collectionId:'palette',modeId:mode,modeName:mode,resolvedType:'COLOR',value:color,selectedValue:color}]}:undefined;
  return {name:'Mode='+mode,type:'COMPONENT',variantProperties:{Mode:mode},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},bbox:{width:20,height:20},children:[{name:'Surface',type:'FRAME',fixedSize:{width:20,height:20},fill:color?{var:'Theme/Surface',alpha:color.a}:{hex:'cabfff'},...(color?{sourceNormalFillComposition:{paint:{color:{r:color.r,g:color.g,b:color.b},opacity:color.a,blendMode:'NORMAL'},variableId:'color'},variableConsumers:{color:consumer}}:{})}]};
 })};
 const run=()=>proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{Theme:{Surface:{$type:'color',$value:'#000000'}}},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});
 return {set,run};
}
test('mixed raw and bound owned paint uses each captured consumer mode at literal fidelity',async t=>{
 const f=mixedOwnedPaintFixture(),before=JSON.stringify(f.set),result=f.run(),c:any=result.contract;
 assert(c.anatomy.root.parts.Surface.tokens['background-color']);
 const colors=result.mintedTokens!.entries.map(x=>x.value);
 assert(colors.includes('#cabfff'));assert(colors.includes('rgba(31.875,63.75,127.5,0.5)'));assert(colors.includes('rgba(191.25,127.5,63.75,1)'));
 assert.equal(JSON.stringify(f.set),before);
 assert(result.notes.some(n=>n.includes('variable bindings are not recreated')));
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const {chromium}=await import('playwright-core');
 const contract=ContractSchema.parse(c),contracts=new Map([[contract.id,contract]]);
 const tokens={primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const out=emitter.emit(contract,{contracts,tokens,icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,contract.name,out[0].contents,out.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  for(const [mode,expected] of [['raw','rgb(202, 191, 255)'],['bounda','rgba(32, 64, 128, 0.5)'],['boundb','rgb(191, 128, 64)'],['raw','rgb(202, 191, 255)']]){
   await render({mode});
   assert.equal(await page.locator('#root > * > *').evaluate(el=>getComputedStyle(el).backgroundColor),expected);
  }
  await page.close();
 }

});
test('mixed paint refuses missing or contradictory consuming evidence instead of taking the global color',()=>{
 for(const fault of ['consumer','name','mode','paint','alpha','alias','blend']){
  const f=mixedOwnedPaintFixture(),n=f.set.variants[1].children[0];
  if(fault==='consumer')delete n.variableConsumers;
  if(fault==='name')n.variableConsumers.color.name='Other/Surface';
  if(fault==='mode')n.variableConsumers.color.modeId='';
  if(fault==='paint')n.sourceNormalFillComposition.paint.color.r=1;
  if(fault==='alpha')n.fill.alpha=.25;
  if(fault==='alias')n.variableConsumers.color.selectedValue.id='missing';
  if(fault==='blend')n.sourceNormalFillComposition.paint.blendMode='MULTIPLY';
  const result=f.run(),c:any=result.contract;assert.equal(c.anatomy.root.parts.Surface.tokens?.['background-color'],undefined,fault);
 }
});

test('React import retains contradictory observed fill literally without recreating its binding',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const dump=fixture();
 dump.Resizer.variants[0].sourceFillComposition.paint.opacity=1;
 const before=JSON.stringify(dump),batch=proposeBatchFromDump(dump,opts);
 assert.deepEqual(batch.skipped,[]);
 const child=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Resizer')!.contract),root=child.anatomy.root;
 assert.equal(root.solidFillComposition!.opacity,1);
 assert.equal(root.solidFillCompositionToken,undefined);
 assert.equal(root.solidFillCompositionSourceBinding,undefined);
 assert.equal(root.solidFillCompositionObservedBinding!.length,1);
 assert.equal(root.solidFillCompositionObservedBinding![0].bindingRecreated,false);
 assert.equal(root.solidFillCompositionObservedBinding![0].resolvedBinding.paint.opacity,Math.fround(.00001));
 assert(batch.proposals.find(p=>p.setName==='Resizer')!.notes.some(n=>n.includes('binding is not recreated')));
 assert.equal(JSON.stringify(dump),before);
 const {SolidFillCompositionTableSchema}=await import('../packages/schema/src/solid-fill-composition.js');
 const table={props:['mode'],rows:[{values:['opaque'],paint:root.solidFillComposition,observedBinding:root.solidFillCompositionObservedBinding![0]}]};
 assert.equal(SolidFillCompositionTableSchema.safeParse(table).success,true);
 for(const patch of [{token:'invented.paint'},{empty:true},{paint:{...root.solidFillComposition,opacity:.5}}]){
  assert.equal(SolidFillCompositionTableSchema.safeParse({...table,rows:[{...table.rows[0],...patch}]}).success,false);
 }
 const ordinary=proposeBatchFromDump(dump,{...opts,drawnVariantSurface:undefined});
 assert(ordinary.skipped.some(row=>row.setName==='Resizer'&&row.reason.includes('paint-consumer-disagreement')));
 for(const mutate of [
  (r:any)=>{r.solidFillCompositionObservedBinding[0].bindingRecreated=true;},
  (r:any)=>{r.solidFillComposition.opacity=.5;},
  (r:any)=>{r.solidFillCompositionToken='invented.paint';},
  (r:any)=>{r.solidFillCompositionObservedBinding[0].resolvedBinding.consumer.selectedValue.a=1;},
 ]){const invalid=structuredClone(child);mutate(invalid.anatomy.root);assert.equal(ContractSchema.safeParse(invalid).success,false);}
});
