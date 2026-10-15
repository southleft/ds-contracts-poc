import {ContractSchema} from '../scripts/contract-schema.js';
import {TextAppearanceSchema,TextAppearanceOverrideSchema,TextAppearanceTableSchema} from '../packages/schema/src/text-appearance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifySourceTextAppearance,textAppearanceDemandsFromDumps,sourceTextAppearanceInput,selectSourceTextAppearance,inspectTextAppearance,inspectAuthoredTextAppearance} from './source-text-appearance-control.js';
import {observeTextAppearance} from '../extract/figma/text-appearance-observation.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';

function fixture(){
 const characters='Text\nLearn more';
 const appearance=observeTextAppearance(characters,[{start:0,end:5,color:{r:0,g:0,b:0}},{start:5,end:15,color:{r:0,g:0,b:1}}].map(s=>({...s,characters:characters.slice(s.start,s.end),fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:s.color}]})))!;
 const leaf:DumpNode={name:'Description',type:'TEXT',nodeId:'2:3',text:{characters:'Default',fontSize:14,fontStyle:'Regular'}};
 const set:DumpSet={setName:'Card',type:'COMPONENT_SET',key:'set-key',variants:[{name:'Product',type:'COMPONENT',nodeId:'2:1',componentKey:'main-key',children:[{name:'Text',type:'FRAME',nodeId:'2:2',children:[leaf]}]}]};
 const root=structuredClone(set.variants[0]);root.nodeId='3:1';root.type='FRAME';root.children![0].nodeId='I3:1;2:2';const text=root.children![0].children![0];text.nodeId='I3:1;2:3';text.text={...leaf.text!,characters,sourceAppearance:appearance};
 const instance:DumpNode={name:'Renamed instance',type:'INSTANCE',nodeId:'3:1',instanceKey:'main-key',instanceSetKey:'set-key',instanceGeometry:{nodeId:'3:1',componentId:'2:1',transform:[[1,0,0],[0,1,0]],localSize:{width:280,height:100}},instanceContent:{root,propertyTypes:{}}};
 const parent:DumpSet={setName:'Parent',type:'COMPONENT',variants:[{name:'Parent',type:'COMPONENT',children:[instance]}]};
 const demand=()=>qualifySourceTextAppearance(set,instance,[0,0],'file');
 return {set,instance,parent,text,demand};
}

function wideAuthoredFixture(varying: number, total = 9) {
 const appearance = fixture().demand().appearance;
 const axes: Array<{property:string;prop:string;values:string[];map:Record<string,string|null>}> = Array.from({length:total},(_,i)=>({property:'Axis'+i,prop:'axis'+i,
  values:i<varying?['First','Second']:['Fixed'],map:Object.fromEntries(i<varying?[['First','first'],['Second','second']]:[['Fixed','fixed']])}));
 const domain: Array<Array<string|null>> = Array.from({length:2**varying},(_,n)=>axes.map((_,i)=>i<varying?(n&(1<<i)?'second':'first'):'fixed'));
 const source:DumpSet={setName:'Wide owned source',type:'COMPONENT_SET',nodeId:'wide:0',key:'wide-source-key',
  variants:domain.map((values,n)=>({name:axes.map((a,i)=>a.property+'='+a.values[i<varying&&values[i]==='second'?1:0]).join(','),
   type:'COMPONENT',nodeId:'wide-main:'+n,variantProperties:Object.fromEntries(axes.map((a,i)=>[a.property,a.values[i<varying&&values[i]==='second'?1:0]])),
   children:[{name:'Label',type:'TEXT',nodeId:'wide-text:'+n,text:{characters:appearance.characters,fontSize:14,fontStyle:'Regular',sourceAppearance:structuredClone(appearance)}}]}))};
 const occurrences=()=>source.variants.filter(main=>main.children?.length).map(main=>({variant:main.name,node:main.children![0]}));
 return {source,axes,domain,occurrences,appearance};
}

test('authored appearance projects only authenticated singleton source axes above the table cap',async()=>{
 const {qualifyAuthoredTextAppearanceTable}=await import('./source-authored-text-appearance.js');
 const f=wideAuthoredFixture(6);
 for(const main of f.source.variants)if(main.variantProperties!.Axis0==='Second'){
  const appearance=main.children![0].text!.sourceAppearance!;
  if('runs'in appearance)appearance.runs[0].fill.paint.color={r:1,g:0,b:0};
 }
 f.source.variants.reverse();f.domain.reverse();
 const expected=new Map(f.source.variants.map(main=>[JSON.stringify(f.axes.slice(0,6).map(a=>a.map[main.variantProperties![a.property]])),main.children![0].text!.sourceAppearance]));
 const before=JSON.stringify(f.source);
 const table=qualifyAuthoredTextAppearanceTable(f.source,'file',f.occurrences(),f.axes,f.domain,true,{});
 assert.deepEqual(table?.props,f.axes.slice(0,6).map(a=>a.prop));assert.equal(table?.rows.length,64);
 assert(TextAppearanceTableSchema.safeParse(table).success);assert.equal(JSON.stringify(f.source),before);
 for(const row of table!.rows){assert.equal(row.values.length,6);assert.deepEqual(row.appearance,expected.get(JSON.stringify(row.values)));}
 const legacy=wideAuthoredFixture(2,8);
 assert.equal(qualifyAuthoredTextAppearanceTable(legacy.source,'file',legacy.occurrences(),legacy.axes,legacy.domain,true,{})?.props.length,8,
  'existing tables retain their complete shape when they already fit');
});

test('constant projection refuses variable overflow and incomplete or ambiguous original domains',async()=>{
 const {qualifyAuthoredTextAppearanceTable}=await import('./source-authored-text-appearance.js');
 const qualify=(f:ReturnType<typeof wideAuthoredFixture>)=>qualifyAuthoredTextAppearanceTable(f.source,'file',f.occurrences(),f.axes,f.domain,true,{});
 assert.equal(qualify(wideAuthoredFixture(9)),undefined,'nine varying axes cannot fit the unchanged schema');
 for(const mutate of [
  (f:ReturnType<typeof wideAuthoredFixture>)=>{f.domain.pop();},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{f.domain.push([...f.domain[0]]);},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{f.domain[0][8]='unknown';},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{delete f.domain[0][8];},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{f.source.variants[0].variantProperties!.Axis8='Other';},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{f.source.variants[1].nodeId=f.source.variants[0].nodeId;},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{const a=f.source.variants[0].children![0].text!.sourceAppearance!;if('runs'in a)a.runs.pop();},
  (f:ReturnType<typeof wideAuthoredFixture>)=>{f.source.variants[0].children=[];},
 ]){const f=wideAuthoredFixture(6);mutate(f);assert.equal(qualify(f),undefined);}
 const unused=wideAuthoredFixture(0);for(const a of unused.axes){a.values=['First','Second'];a.map={First:'fixed',Second:'unused'};}
 for(const main of unused.source.variants)for(const a of unused.axes)main.variantProperties![a.property]='First';
 assert.equal(qualify(unused),undefined,'unused declared choices are not singleton source axes');
 const aliases=wideAuthoredFixture(6);aliases.axes[8].values=['Fixed','Alias'];aliases.axes[8].map={Fixed:'fixed',Alias:'fixed'};
 assert.equal(qualify(aliases),undefined,'raw aliases cannot manufacture a constant certificate');
});

test('constant-only output keeps one row and full-axis physical presence remains authoritative',async()=>{
 const {qualifyAuthoredTextAppearanceTable}=await import('./source-authored-text-appearance.js');
 const one=wideAuthoredFixture(0),table=qualifyAuthoredTextAppearanceTable(one.source,'file',one.occurrences(),one.axes,one.domain,true,{});
 assert.deepEqual(table?.props,[]);assert.equal(table?.rows.length,1);assert(TextAppearanceTableSchema.safeParse(table).success);
 const repeated=structuredClone(one.source.variants[0]);repeated.name+=' duplicate';repeated.nodeId='other-main';repeated.children![0].nodeId='other-text';one.source.variants.push(repeated);one.domain.push([...one.domain[0]]);
 assert.equal(qualifyAuthoredTextAppearanceTable(one.source,'file',one.occurrences(),one.axes,one.domain,true,{}),undefined,
  'constant-only collisions are refused, never coalesced');
 const f=wideAuthoredFixture(6);for(const main of f.source.variants)if(main.variantProperties!.Axis0==='Second')main.children=[];
 const partial=qualifyAuthoredTextAppearanceTable(f.source,'file',f.occurrences(),f.axes,f.domain,true,{visibleWhen:{prop:'axis0',equals:'first'}});
 assert.equal(partial?.rows.length,32);assert.deepEqual(partial?.props,f.axes.slice(0,6).map(a=>a.prop));
 assert.equal(qualifyAuthoredTextAppearanceTable(f.source,'file',f.occurrences(),f.axes,f.domain,true,{}),undefined,
  'occurrence-only constancy cannot erase the missing physical domain');
});
test('projected appearance does not claim characters absent from the existing text channel',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {walkAnatomy}=await import('../scripts/contract-schema.js');
 const f=wideAuthoredFixture(2);
 f.source.propertyDefinitions=Object.fromEntries(f.axes.map(a=>[a.property,{type:'VARIANT' as const,defaultValue:a.values[0],variantOptions:a.values}]));
 for(const main of f.source.variants){
  const stable=structuredClone(main.children![0]);stable.name='Stable label';stable.nodeId+='-stable';main.children!.push(stable);
  if(main.variantProperties!.Axis0==='Second'&&main.variantProperties!.Axis1==='Second'){
   const text=main.children![0].text!,appearance=text.sourceAppearance!;
   text.characters='More\nLearn text';if('runs'in appearance)appearance.characters=text.characters;
  }
 }
 const before=JSON.stringify(f.source);
 const proposal=proposeFromDump(f.source,{fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),
  contractIdByName:new Map(),mintUnbound:true});
 const contract=ContractSchema.parse(proposal.contract),parts=walkAnatomy(contract);
 assert.equal(contract.props.length,9);assert.equal(JSON.stringify(f.source),before);
 assert.equal(parts.filter(w=>w.part.textAppearanceByCombination).length,1,'unrelated representable appearance remains carried');
 assert.equal(parts.find(w=>w.part.textAppearanceByCombination)!.part.textAppearanceByCombination!.props.length,2);
 assert(proposal.notes.some(note=>note.includes('projected authored appearance requires source characters')));
 const promoted=proposeFromDump(f.source,{fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),
  contractIdByName:new Map(),mintUnbound:true,textOverrideDemand:new Map([[f.source.key!,new Set(['Stable label'])]])});
 const promotedContract=ContractSchema.parse(promoted.contract);
 assert.equal(promotedContract.props.find(p=>p.name==='children')?.bindings.figma.kind,'NONE');
 assert.equal(walkAnatomy(promotedContract).filter(w=>w.part.textAppearanceByCombination).length,0,
  'a matching default on a figmaless input cannot satisfy the owned TEXT-binding gate');
 assert.equal(JSON.stringify(f.source),before);
});
test('exact text appearance ownership survives display renaming without mutating source',()=>{
 const f=fixture(),before=JSON.stringify(f),d=f.demand();
 assert.equal(d.appearance.characters,'Text\nLearn more');assert.deepEqual(d.childPath,[0,0]);assert.equal(d.sourceNodeId,'2:3');assert.equal(JSON.stringify(f),before);
 f.set.setName='Different name';f.instance.name='Different instance';f.text.name='Different label';assert.deepEqual(f.demand(),d);
});


test('explicit font axes preserve exact maps and malformed maps refuse without reading getters',()=>{
 const base=fixture().demand().appearance,run=base.runs[0];
 const observe=(axes:unknown,present=true)=>observeTextAppearance(base.characters,[{...run,start:0,end:base.characters.length,characters:base.characters,
  fontName:{family:run.fontName.family,style:run.fontName.style,...(present?{variationSettings:axes}:{})},fills:[{type:'SOLID',...run.fill.paint}]}]);
 const axes={wght:430.5,slnt:0,XTRA:-.25},one=observe(axes);assert.ok(one&&'runs'in one);
 assert.deepEqual(one.runs[0].fontName.variationSettings,axes);assert.notEqual(one.runs[0].fontName.variationSettings,axes);
 axes.wght=700;assert.equal(one.runs[0].fontName.variationSettings!.wght,430.5,'source map is copied, never aliased');
 assert.deepEqual(inspectAuthoredTextAppearance(one),one);assert.equal(TextAppearanceSchema.safeParse(one).success,true);
 assert.throws(()=>inspectTextAppearance(one),/text-appearance-observation-unqualified/);
 assert.equal(TextAppearanceOverrideSchema.safeParse({prop:'appearance',choices:{one}}).success,false,'explicit override still requires two runs');
 const two=structuredClone(base);for(const r of two.runs)r.fontName.variationSettings={wght:430.5,slnt:0,XTRA:-.25};
 assert.deepEqual(inspectTextAppearance(two),two);assert.equal(TextAppearanceOverrideSchema.safeParse({prop:'appearance',choices:{two}}).success,true);
 for(const [map,present] of [[undefined,false],[undefined,true],[{},true]] as const){
  const value=observe(map,present);assert.ok(value&&'runs'in value);
  assert.equal(Object.hasOwn(value.runs[0].fontName,'variationSettings'),map!==undefined);
  if(map!==undefined)assert.deepEqual(value.runs[0].fontName.variationSettings,{});
 }
 let reads=0;const getter=Object.defineProperty({},'wght',{enumerable:true,get(){reads++;return 400;}});
 const hidden=Object.defineProperty({},'wght',{enumerable:false,value:400});
 const symbol={wght:400,[Symbol('axis')]:1};
 const malformed:unknown[]=[null,[],{wgt:400},{weight:400},{'éabc':1},{'a\nbc':1},{wght:NaN},{wght:Infinity},{wght:-Infinity},{wght:'400'},{wght:null},Object.create({wght:400}),hidden,symbol,getter];
 for(const map of malformed){
  assert.deepEqual(observe(map),{issue:'text-appearance-font-unqualified'});
  const forged:typeof one=structuredClone(one);(forged.runs[0].fontName as any).variationSettings=map;
  assert.throws(()=>inspectAuthoredTextAppearance(forged),/text-appearance-observation-unqualified/);
 }
 assert.equal(reads,0,'malformed axis getters are never evaluated');
 for(const map of malformed.slice(0,11)){
  const forged:typeof one=structuredClone(one);(forged.runs[0].fontName as any).variationSettings=map;
  assert.equal(TextAppearanceSchema.safeParse(forged).success,false);
 }
});

test('authored tables require positive scalar loss and complete original membership corroborated by existing predicates',async()=>{
 const {qualifyAuthoredTextAppearanceTable,authoredTextAppearanceNeedsCarrier}=await import('./source-authored-text-appearance.js');
 const observed=fixture().demand().appearance;
 const source:DumpSet={setName:'Owned source',type:'COMPONENT_SET',nodeId:'10:0',key:'source-key',variants:['A','B'].map((name,i)=>({name:'Mode='+name,type:'COMPONENT',nodeId:'10:'+(i+1),variantProperties:{Mode:name},children:[{name:'Label',type:'TEXT',nodeId:'11:'+(i+1),text:{characters:observed.characters,fontSize:14,fontStyle:'Regular',sourceAppearance:structuredClone(observed)}}]}))};
 const axes=[{property:'Mode',prop:'mode',values:['A','B'],map:{A:'a',B:'b'}}],domain=[['a'],['b']];
 const occurrences=()=>source.variants.map(main=>({variant:main.name,node:main.children![0]}));
 const before=JSON.stringify(source),table=qualifyAuthoredTextAppearanceTable(source,'file',occurrences(),axes,domain,true,{});
 assert.equal(table?.rows.length,2);assert.equal(JSON.stringify(source),before);
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences(),axes,domain,false,{}),undefined);
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences().slice(0,1),axes,domain,true,{}),undefined,'missing appearance rows cannot create absence');
 const equal=structuredClone(observed);equal.runs[1]={...equal.runs[0],start:equal.runs[1].start,end:equal.runs[1].end};
 assert.equal(authoredTextAppearanceNeedsCarrier(equal),false,'equivalent source boundaries are not scalar loss');
 equal.runs=[{...equal.runs[0],start:0,end:equal.characters.length}];assert.equal(authoredTextAppearanceNeedsCarrier(equal),false);
 const uniform=structuredClone(equal);uniform.runs[0].fontName.variationSettings={slnt:0,wght:400};
 assert.equal(authoredTextAppearanceNeedsCarrier(uniform),false,'materialized named-face defaults alone are not scalar loss');
 for(const main of source.variants)main.children![0].text!.sourceAppearance=structuredClone(uniform);
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences(),axes,domain,true,{}),undefined,'uniform axes do not widen table admission');
 const custom=structuredClone(uniform);custom.runs[0].fontName.variationSettings={XTRA:-.25};
 assert.equal(authoredTextAppearanceNeedsCarrier(custom),false,'uniform custom axes remain unqualified without positive scalar-loss evidence');
 const differing=structuredClone(uniform);differing.runs=[{...structuredClone(uniform.runs[0]),end:5},{...structuredClone(uniform.runs[0]),start:5}];
 differing.runs[1].fontName.variationSettings={slnt:0,wght:430.5,XTRA:-.25};
 assert.equal(authoredTextAppearanceNeedsCarrier(differing),true,'actual differing run axes are a source channel');
 for(const main of source.variants)main.children![0].text!.sourceAppearance=structuredClone(differing);
 const axesTable=qualifyAuthoredTextAppearanceTable(source,'file',occurrences(),axes,domain,true,{});
 assert.deepEqual(axesTable?.rows.map(row=>row.appearance),[differing,differing]);
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences(),axes,domain,false,{}),undefined,'axis differences cannot bypass the captured domain');
 for(const main of source.variants)main.children![0].text!.sourceAppearance=structuredClone(observed);
 equal.runs[0].textCase='SMALL_CAPS';assert.equal(authoredTextAppearanceNeedsCarrier(equal),true,'a genuinely observed supported scalar vocabulary omission qualifies');
 source.variants[1].children=[];
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences().slice(0,1),axes,domain,true,{}),undefined);
 const present=qualifyAuthoredTextAppearanceTable(source,'file',occurrences().slice(0,1),axes,domain,true,{visibleWhen:{prop:'mode',equals:'a'}});
 assert.deepEqual(present?.rows.map(r=>r.values),[['a']]);
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences().slice(0,1),axes,domain,true,{visibleWhen:{prop:'mode',equals:'b'}}),undefined,'a predicate must agree with original physical membership');
 source.variants[1].children=[structuredClone(source.variants[0].children![0])];
 assert.equal(qualifyAuthoredTextAppearanceTable(source,'file',occurrences(),axes,domain,true,{}),undefined,'duplicate original IDs confer no ownership');
});
test('text appearance demand refuses foreign identity, changed text and nested instance ownership',()=>{
 const mutations:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.instance.instanceKey='foreign';},f=>{f.instance.instanceSetKey='foreign';},
  f=>{f.instance.instanceGeometry!.componentId='foreign';},f=>{f.instance.instanceGeometry!.nodeId='foreign';},
  f=>{f.instance.instanceContent!.root.nodeId='foreign';},f=>{f.text.nodeId='foreign';},
  f=>{f.text.text!.characters='Different text';},f=>{delete f.text.text!.sourceAppearance;},
  f=>{f.set.variants.push(structuredClone(f.set.variants[0]));},
  f=>{f.set.variants[0].children![0].type='INSTANCE';},
  f=>{f.instance.instanceContent!.root.children![0].type='INSTANCE';},
  f=>{f.set.contractId='authored.contract';},
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(f.demand,/text-appearance-/,String(mutate));}
 const f=fixture();for(const path of [[],[-1],[0,.5],[0,1]])assert.throws(()=>qualifySourceTextAppearance(f.set,f.instance,path,'file'),/text-appearance-/);
 assert.throws(()=>qualifySourceTextAppearance(f.set,f.instance,[0,0],''),/identity/);
});
test('standalone keyed definitions use the same direct-owner text proof',()=>{
 const f=fixture();f.set.type='COMPONENT';f.set.key='main-key';delete f.instance.instanceSetKey;assert.equal(f.demand().setKey,'main-key');
});
test('finite appearance choice includes exact characters, preserves omission and is order independent',()=>{
 const a=fixture().demand(),b=structuredClone(a);b.instanceId='second';b.instanceNodeId='Isecond;2:3';b.appearance.runs[1].fill.paint.color={r:1,g:0,b:0};
 const input=sourceTextAppearanceInput([b,a,a]);assert.deepEqual(input,sourceTextAppearanceInput([a,b]));assert.equal(input.choices.length,2);assert.equal(input.callers.length,2);
 assert.equal(selectSourceTextAppearance(input,undefined,'anything'),undefined);
 const selected=selectSourceTextAppearance(input,input.callers[0].value,a.appearance.characters)!;
 selected.runs[0].fontSize=99;assert.equal(input.choices[0].appearance.runs[0].fontSize,14);
 assert.throws(()=>selectSourceTextAppearance(input,input.callers[0].value,'changed caller text'),/characters-unqualified/);
 assert.throws(()=>selectSourceTextAppearance(input,'text99',a.appearance.characters),/value/);
 assert.throws(()=>sourceTextAppearanceInput([a,{...b,sourceNodeId:'foreign'}]),/owner/);
 assert.throws(()=>sourceTextAppearanceInput([a,{...b,instanceId:a.instanceId,instanceNodeId:a.instanceNodeId}]),/conflicting-caller/);
});
test('serialized text appearances are revalidated rather than trusting a typed field',()=>{
 const original=fixture().demand().appearance;
 for(const mutate of [(v:any)=>{v.runs[0]=null;},(v:any)=>{v.runs[1].start=6;},(v:any)=>{v.runs[0].fill.paint.blendMode='MULTIPLY';},(v:any)=>{v.runs[0].fontSize=NaN;},(v:any)=>{v.runs[1].fill={issue:'unsupported'};}]){const v=structuredClone(original);mutate(v);assert.throws(()=>inspectTextAppearance(v),/text-appearance-observation-unqualified/);}
});
test('discovery keeps unsupported and unlinked evidence named and never crosses nested owners',()=>{
 const f=fixture(),dump={Parent:f.parent,Child:f.set};
 const result=textAppearanceDemandsFromDumps(dump,'file');assert.deepEqual(result.notes,[]);assert.deepEqual(result.demands,[f.demand()]);
 f.set.variants[0].children![0].type='INSTANCE';const nested=textAppearanceDemandsFromDumps(dump,'file');assert.equal(nested.demands.length,0);assert.match(nested.notes[0],/crosses-instance-owner/);
 delete (dump as any).Child;const unlinked=textAppearanceDemandsFromDumps(dump,'file');assert.equal(unlinked.demands.length,0);assert.match(unlinked.notes[0],/main-ambiguous-or-missing/);
});

test('automatic proposals route an observed text appearance through the exact child input',async()=>{
 const {proposeBatchFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');const {ContractSchema,walkAnatomy}=await import('../scripts/contract-schema.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};f.instance.instanceOf='Card';
 f.parent.key='parent-key';f.parent.propertyDefinitions={};f.parent.variants[0].nodeId='4:1';f.parent.variants[0].variantProperties={};
 const dump={Parent:f.parent,Card:f.set},before=JSON.stringify(dump);
 const result=proposeBatchFromDump(dump,{fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual(result.skipped,[]);
 const child=result.proposals.find(p=>p.setName==='Card')!,host=result.proposals.find(p=>p.setName==='Parent')!;
 assert.equal(child.textAppearanceBindings?.length,1);
 const binding=child.textAppearanceBindings![0];const ref=walkAnatomy(ContractSchema.parse(host.contract)).find(w=>w.part.component?.id===child.contract.id)!.part.component!;
 assert.equal(ref.props?.[binding.prop],'text1');assert.equal(JSON.stringify(dump),before);
});

test('main proposal rejects foreign appearance demands before emitting a control',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const f=fixture();f.set.type='COMPONENT';f.set.propertyDefinitions={};f.set.variants[0].variantProperties={};
 const demand=f.demand(),opts={fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
 for(const change of [{fileKey:'foreign'},{sourceNodeId:'foreign'},{childPath:[0,1]},{instanceNodeId:'Iforeign;2:3'}])assert.throws(()=>proposeFromDump(f.set,{...opts,textAppearanceDemands:[{...demand,...change}]}),/text-appearance-demand-/);
 const child=proposeFromDump(f.set,{...opts,textAppearanceDemands:[demand]});
 const binding=child.textAppearanceBindings![0];assert.equal(typeof child.contract.id,'string');const childId=String(child.contract.id);
 f.instance.instanceOf='Card';f.parent.key='parent-key';f.parent.propertyDefinitions={};f.parent.variants[0].variantProperties={};
 const parentOpts={...opts,contractsById:new Map([[childId,ContractSchema.parse(child.contract)]]),contractIdByName:new Map([['Card',childId]]),contractIdByKey:new Map([['set-key',childId]]),textAppearanceBindingsByContract:new Map([[childId,[{...binding,contractRevision:'stale'}]]])};
 assert.throws(()=>proposeFromDump(f.parent,parentOpts),/text-appearance-argument-binding-unqualified/);
 parentOpts.textAppearanceBindingsByContract.set(childId,[binding]);f.text.text!.characters='stale';
 assert.throws(()=>proposeFromDump(f.parent,parentOpts),/text-appearance-argument-observation-unqualified/);
});
