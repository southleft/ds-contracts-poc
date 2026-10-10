import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {createPluginEngine} from '../figma-sync/plugin/engine/entry.js';
import {createFigmaEngine,figmaRuntimeRevision} from './emit-figma-script.js';
import {nativeTextAppearanceMatches} from './native-text-appearance-observation.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {mapNativeTextAppearances,NATIVE_EXPLICIT_TEXT_AXIS_RUNTIME,attachNativeAuthoredTextAppearance,nativeScalarFaceWeight} from './native-text-appearance.js';
import {NATIVE_FONT_NAME_EXACT_RUNTIME,NATIVE_AUTHORED_FONT_PROFILE_RUNTIME} from './native-font-profile.js';
const appearance={characters:'A\nB',runs:[{start:0,end:2},{start:2,end:3}].map((r,i)=>({...r,fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fill:{paint:{color:{r:0,g:0,b:i},opacity:1,blendMode:'NORMAL'}}}))};
const contract=()=>ContractSchema.parse({id:'test.appearance-native',name:'AppearanceNative',version:'0.1.0',status:'draft',description:'Native ranges',semantics:{element:'div'},props:[{name:'appearance',type:{enum:['observed']},bindings:{code:{prop:'appearance'},figma:{kind:'NONE'}}}],states:[],anatomy:{root:{parts:{text:{text:appearance.characters,textAppearanceOverride:{prop:'appearance',choices:{observed:appearance}}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./AppearanceNative',export:'AppearanceNative'}}}});
// Keep readback axes independent: mutating native output must not mutate source intent.
function target(fontReadback:(font:any)=>any=font=>font){const rows=new Map<number,any>(),calls:any[]=[];const n:any={type:'TEXT',characters:appearance.characters,children:[],getSharedPluginData:()=>contract().id+':appearance',calls};
 for(const name of ['FontName','FontSize','LineHeight','LetterSpacing','TextCase','TextDecoration','Fills'])n['setRange'+name]=(start:number,end:number,value:any)=>{calls.push(name);const row=rows.get(start)??{start,end,characters:n.characters.slice(start,end),fontWeight:400};row[name[0].toLowerCase()+name.slice(1)]=name==='FontName'?fontReadback({...value,...(value.variationSettings===undefined?{}:{variationSettings:Object.assign(Object.create(null),value.variationSettings)})}):value;rows.set(start,row);};
 n.getStyledTextSegments=(_:unknown,start:number)=>[rows.get(start)];return n;}
function execution(children:any[],failFont=false,appearances=mapNativeTextAppearances(contract(),{appearance:'observed'},{})){const figma={skipInvisibleInstanceChildren:true,loadFontAsync:async()=>{if(failFont)throw Error('missing font');}};return{figma,run:()=>vm.runInNewContext('(async()=>{const spec=JSON.parse('+JSON.stringify(JSON.stringify({instanceTextAppearances:appearances}))+');'+NATIVE_FONT_NAME_EXACT_RUNTIME+NATIVE_EXPLICIT_TEXT_AXIS_RUNTIME+'})()',{figma,node:{children}})};}
test('native mapper preserves omission and resolves finite references and maps',()=>{
 const c=contract(),expected=mapNativeTextAppearances(c,{appearance:'observed'},{});
 assert.deepEqual(mapNativeTextAppearances(c,{appearance:'{selected}'},{selected:'observed'}),expected);
 assert.deepEqual(mapNativeTextAppearances(c,{appearance:{prop:'selected',map:{yes:'observed'}}},{selected:'yes'}),expected);
 assert.equal(mapNativeTextAppearances(c,{},{}),undefined);assert.throws(()=>mapNativeTextAppearances(c,{appearance:'bad'},{}),/unqualified/);
});

test('authored native specs retain the independently compiled scalar fallback instead of the first source run',()=>{
 const c=ContractSchema.parse({...contract(),props:[],anatomy:{root:{parts:{text:{text:appearance.characters,textAppearanceByCombination:{props:[],rows:[{values:[],appearance}]}}}}}});
 const part=c.anatomy.root.parts!.text,gray={r:Math.fround(214/255),g:Math.fround(222/255),b:Math.fround(235/255),a:.5};
 const spec:any={characters:appearance.characters,fontSize:14,fontStyle:'Regular',fontFamily:'Inter',lineHeight:{unit:'PIXELS',value:20},letterSpacing:2,textCase:'TITLE',textDecoration:'UNDERLINE',textFill:'paint.original-gray',textFillLit:gray};
 const before=structuredClone(spec);attachNativeAuthoredTextAppearance(spec,part,c,{});
 assert.deepEqual(spec.authoredTextScalar,{fontSize:14,fontStyle:'Regular',fontFamily:'Inter',lineHeight:{unit:'PIXELS',value:20},letterSpacing:2,textCase:'TITLE',textDecoration:'UNDERLINE',textFill:'paint.original-gray',textFillLit:gray});
 assert.deepEqual(spec.authoredTextAppearance,appearance);assert.deepEqual(before.textFillLit,gray);
 assert.equal(nativeScalarFaceWeight(spec.authoredTextScalar.fontStyle),400);assert.equal(nativeScalarFaceWeight('Unqualified Face'),undefined);
 assert.notDeepEqual(spec.authoredTextScalar.textFillLit,spec.authoredTextAppearance.runs[0].fill.paint.color);
 const bad=structuredClone(c);bad.anatomy.root.parts!.text.textAppearanceByCombination!.rows[0].appearance.runs[0].fill.variableId='foreign';
 assert.throws(()=>attachNativeAuthoredTextAppearance({...before},bad.anatomy.root.parts!.text,bad,{}),/range-binding-unsupported/);
});
test('native writer reads every applied range and restores visibility flag',async()=>{
 const n=target(),e=execution([n]);await e.run();assert.equal(n.calls.length,14);assert.equal(e.figma.skipInvisibleInstanceChildren,true);
 const bad=target();bad.getStyledTextSegments=()=>[];const failed=execution([bad]);await assert.rejects(failed.run,/readback-incomplete/);assert.equal(failed.figma.skipInvisibleInstanceChildren,true);
});
test('missing, duplicate, nested, stale text and missing font refuse before range writes',async()=>{
 for(const kind of ['missing','duplicate','nested','characters','font']){
  const n=target();let children=[n];if(kind==='missing')children=[];if(kind==='duplicate')children=[n,target()];if(kind==='nested')children=[{type:'INSTANCE',children:[n]} as any];if(kind==='characters')n.characters='stale';
  const e=execution(children,kind==='font');await assert.rejects(e.run,/unqualified|missing font/);assert.equal(n.calls.length,0);assert.equal(e.figma.skipInvisibleInstanceChildren,true);
 }
});

test('explicit native ranges require the complete exact axis map, including custom tags',async()=>{
 const c=contract();
 for(const r of c.anatomy.root.parts!.text.textAppearanceOverride!.choices.observed.runs)
  r.fontName.variationSettings={wght:400,opsz:14,GRAD:20};
 const appearances=mapNativeTextAppearances(c,{appearance:'observed'},{});
 const exact=target();await execution([exact],false,appearances).run();assert.equal(exact.calls.length,14);
 const reorder=target(font=>{const axes=font.variationSettings;delete font.variationSettings;
  font.variationSettings=Object.assign(Object.create(null),{GRAD:axes.GRAD,opsz:axes.opsz,wght:axes.wght});return font;});
 await execution([reorder],false,appearances).run();
 const mutations:Array<[string,(font:any)=>void]>=[
  ['extra',font=>{font.variationSettings.slnt=0;}],
  ['missing',font=>{delete font.variationSettings.opsz;}],
  ['changed',font=>{font.variationSettings.wght=400.000001;}],
  ['custom',font=>{font.variationSettings.GRAD=21;}],
  ['string',font=>{font.variationSettings.wght='400';}],
  ['nonfinite',font=>{font.variationSettings.wght=NaN;}],
  ['tag',font=>{font.variationSettings.bad=1;}],
  ['hidden',font=>{Object.defineProperty(font.variationSettings,'HIDE',{value:1,enumerable:false});}],
  ['accessor',font=>{Object.defineProperty(font.variationSettings,'opsz',{get:()=>14,enumerable:true});}],
  ['inherited',font=>{Object.setPrototypeOf(font.variationSettings,{slnt:0});}],
  ['array',font=>{font.variationSettings=[];}]
 ];
 for(const [name,mutate] of mutations){
  const n=target(font=>{mutate(font);return font;}),e=execution([n],false,appearances);
  await assert.rejects(e.run,/text-appearance-native-readback-mismatch/,name);
  assert.ok(n.calls.length>0,'the mock records actual range writes before native readback rejects '+name);
  assert.equal(e.figma.skipInvisibleInstanceChildren,true,name);
 }
 const materialized=target(font=>{font.variationSettings=Object.assign(Object.create(null),{wght:400,opsz:14,GRAD:20});return font;});
 const omitted=execution([materialized]);
 await assert.rejects(omitted.run,/text-appearance-native-font-default-profile-unverified/,
  'matching family/style cannot authorize native axes omitted by source');
 assert.equal(omitted.figma.skipInvisibleInstanceChildren,true);
});

// The mock materializes named-face defaults only on an actual fontName write.
// A queued microtask exposes any await between owned-probe allocation/removal.
function fontProfileExecution(options:Record<string,unknown>={}){
 const script=`(async()=>{
  const options=JSON.parse(${JSON.stringify(JSON.stringify(options))}),events=[];
  const NATIVE_RESULT={};let live=0;
  const figma={
   getFontFamilyVariationAxes:()=>options.inventory===undefined?['wght','opsz','GRAD']:options.inventory,
   loadFontAsync:async()=>{if(live)throw Error('load-with-live-probe');events.push('load');await Promise.resolve();
    if(options.loadFails)throw Error('missing-font');events.push('loaded');},
   createText:()=>{
    events.push('allocate');live++;
    const probe={id:'owned-probe',type:'TEXT',characters:'',removed:false,fontWeight:options.weight===undefined?400:options.weight,
     remove(){events.push('remove');if(options.removeFails)throw Error('remove-failed');this.removed=true;live--;}};
    Object.defineProperty(probe,'fontName',{get:()=>probe.observed,set:request=>{events.push('assign');probe.observed={...request,
     ...(options.axes===null?{}:{variationSettings:options.axes===undefined?{wght:400,opsz:14,GRAD:20}:options.axes}),
     ...(options.wrongFace?{style:'Another Face'}:{})};}});
    Promise.resolve().then(()=>{if(!probe.removed)events.push('yield-with-probe');});return probe;
   }
  };
  if(options.missingApi)delete figma[options.missingApi];
  ${NATIVE_AUTHORED_FONT_PROFILE_RUNTIME}
  const source={family:'Inter',style:'Regular'};let profile,reset,error;
  try{profile=await prepareAuthoredFont(source);if(options.repeat)await prepareAuthoredFont(source);
   reset=authoredScalarFontName(source,500,true);
  }catch(e){error=e.message;}
  await Promise.resolve();return {error,events,live,profile,reset,calibrations:NATIVE_RESULT.authoredFontCalibrations};
 })()`;
 return Promise.resolve(vm.runInNewContext(script)).then(value=>JSON.parse(JSON.stringify(value)));
}
test('named-face calibration loads first, removes synchronously and preserves the complete baseline',async()=>{
 const result=await fontProfileExecution({repeat:true});assert.equal(result.error,undefined);
 assert.deepEqual(result.events,['load','loaded','allocate','assign','remove']);assert.equal(result.live,0);
 assert.deepEqual(result.profile.fontName,{family:'Inter',style:'Regular',variationSettings:{wght:400,opsz:14,GRAD:20}});assert.equal(result.profile.fontWeight,400);
 assert.deepEqual(result.reset.variationSettings,{wght:500,opsz:14,GRAD:20},'a scalar weight binding owns only wght');
 assert.equal(result.calibrations.authority,'writer-preflight-only');assert.equal(result.calibrations.nativeQualification,'unqualified');
 assert.equal(result.calibrations.profiles.length,1);assert.equal(result.calibrations.profiles[0].removed,true);
 const fixed=await fontProfileExecution({inventory:null,axes:null});assert.equal(fixed.error,undefined);
 assert.equal(fixed.profile.fontName.variationSettings,undefined);assert.equal(fixed.live,0);
});
test('named-face calibration refuses missing APIs and load failure before allocating any probe',async()=>{
 for(const missingApi of ['loadFontAsync','getFontFamilyVariationAxes','createText']){
  const result=await fontProfileExecution({missingApi});assert.equal(result.error,'authored-font-profile-api-unavailable',missingApi);
  assert.equal(result.events.includes('allocate'),false,missingApi);assert.equal(result.live,0);
 }
 const missing=await fontProfileExecution({loadFails:true});assert.equal(missing.error,'authored-font-profile-font-unavailable');
 assert.equal(missing.events.includes('allocate'),false);assert.equal(missing.live,0);
});
test('named-face calibration refuses incomplete inventories and always removes a refused probe',async()=>{
 const cases:Array<[Record<string,unknown>,string]>=[
  [{inventory:['wght','opsz','GRAD','slnt']},'authored-font-profile-axis-inventory'],
  [{axes:{wght:400,opsz:14}},'authored-font-profile-axis-inventory'],
  [{axes:{wght:400,opsz:14,GRAD:20,slnt:0}},'authored-font-profile-axis-inventory'],
  [{inventory:['wght','opsz','GRAD','GRAD']},'authored-font-profile-axis-inventory'],
  [{inventory:[]},'authored-font-profile-axis-inventory'],
  [{inventory:null},'authored-font-profile-static-axes'],
  [{axes:{wght:'400',opsz:14,GRAD:20}},'authored-font-profile-axis-inventory'],
  [{wrongFace:true},'authored-font-profile-face-mismatch'],
  [{weight:0},'authored-font-profile-face-mismatch']
 ];
 for(const [options,reason] of cases){const result=await fontProfileExecution(options);
  assert.equal(result.error,reason,JSON.stringify(options));assert.equal(result.live,0);
  assert.deepEqual(result.events,['load','loaded','allocate','assign','remove']);
  assert.equal(result.calibrations.profiles[0].removed,true);assert.equal(result.calibrations.profiles[0].status,'refused');
 }
 const leak=await fontProfileExecution({removeFails:true});
 assert.equal(leak.error,'authored-font-profile-probe-removal-unverified');assert.equal(leak.calibrations.profiles[0].removed,false);
});

test('production native compiler routes appearance only to selected instance',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');const c=contract();
 const parent=ContractSchema.parse({...c,id:'test.appearance-parent',name:'AppearanceParent',props:[],anatomy:{root:{parts:{omitted:{component:{id:c.id}},selected:{component:{id:c.id,props:{appearance:'observed'}}}}}}});
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),byId=new Map([[c.id,c],[parent.id,parent]]);
 const data=engine.compileComponentData(parent,byId);assert.equal(data.variants[0].spec.children?.[0].instanceTextAppearances,undefined);assert.deepEqual(data.variants[0].spec.children?.[1].instanceTextAppearances,mapNativeTextAppearances(c,{appearance:'observed'},{}));
 assert.match(engine.buildComponentScript(parent,byId),/text-appearance-native-readback-mismatch/);
});

test('nested and slot-default authored recipes keep explicit choices and refresh when a reused graph replaces its leaf',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const leaf=ContractSchema.parse({...contract(),id:'test.authored-leaf',name:'AuthoredLeaf',anatomy:{root:{parts:{text:{text:appearance.characters,
  textAppearanceByCombination:{props:[],rows:[{values:[],appearance}]},textAppearanceOverride:{prop:'appearance',choices:{observed:appearance}}}}}}});
 const middle=ContractSchema.parse({...leaf,id:'test.authored-middle',name:'AuthoredMiddle',props:[],anatomy:{root:{parts:{leaf:{component:{id:leaf.id,props:{appearance:'observed'}}}}}}});
 const parent=ContractSchema.parse({...middle,id:'test.authored-grandparent',name:'AuthoredGrandparent',anatomy:{root:{parts:{middle:{component:{id:middle.id}},
  slot:{slot:{name:'children',accepts:[leaf.id],defaultContent:[{id:leaf.id,props:{appearance:'observed'}},{id:leaf.id}]}}}}}});
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),byId=new Map([[leaf.id,leaf],[middle.id,middle],[parent.id,parent]]);
 const first=engine.compileComponentData(parent,byId),nested=first.variants[0].spec.children!.find(n=>n.name==='middle')!;
 assert.equal(nested.instanceAuthoredTextAppearance,true);
 const recipe=nested.instanceAuthoredTextRecipes!.variants[0];assert.equal(recipe.plans.length,0);assert.equal(recipe.instances!.length,1);
 assert.equal(recipe.instances![0].spec.depContractId,leaf.id);assert.equal(recipe.instances![0].spec.instanceAuthoredTextRecipes.contractId,leaf.id);
 assert.deepEqual(recipe.instances![0].spec.instanceTextAppearances,mapNativeTextAppearances(leaf,{appearance:'observed'},{}));
 const defaults=first.variants[0].spec.children!.find(n=>n.type==='slot')!.slotDefault!;
 assert.equal(defaults.length,2);assert.equal(new Set(defaults.map(n=>n.authoredTextInstanceTarget)).size,2);
 assert.deepEqual(defaults[0].instanceTextAppearances,mapNativeTextAppearances(leaf,{appearance:'observed'},{}));assert.equal(defaults[1].instanceTextAppearances,undefined);
 const replacement=structuredClone(leaf);replacement.anatomy.root.parts!.text.textAppearanceByCombination!.rows[0].appearance.runs[1].fill.paint.color={r:1,g:0,b:0};byId.set(leaf.id,replacement);
 const second=engine.compileComponentData(parent,byId).variants[0].spec.children!.find(n=>n.name==='middle')!.instanceAuthoredTextRecipes!.variants[0].instances![0].spec;
 assert.deepEqual(second.instanceAuthoredTextRecipes.variants[0].plans[0].appearance.runs[1].fill.paint.color,{r:1,g:0,b:0});
 assert.deepEqual(recipe.instances![0].spec.instanceAuthoredTextRecipes.variants[0].plans[0].appearance.runs[1].fill.paint.color,{r:0,g:0,b:1});
 assert.deepEqual(second.instanceTextAppearances,recipe.instances![0].spec.instanceTextAppearances,'explicit caller choice remains independent of new source defaults');
 const cyclic=structuredClone(middle);cyclic.anatomy.root.parts!.leaf.component={id:middle.id};byId.set(middle.id,cyclic);
 assert.doesNotThrow(()=>engine.compileComponentData(parent,byId),'an opaque non-authored cycle remains admitted even alongside authored sibling defaults');
 // Put real authored content after the back-edge: feature discovery must
 // continue past that edge, and actual recursive recipe construction refuses.
 cyclic.anatomy.root.parts!.authoredAfterCycle={component:{id:leaf.id,props:{appearance:'observed'}}};
 assert.throws(()=>engine.compileComponentData(parent,byId),
  (error:unknown)=>error instanceof Error&&error.message==='authored-text-appearance-dependency-cycle');
 byId.set(middle.id,middle);assert.doesNotThrow(()=>engine.compileComponentData(parent,byId),'cycle refusal must not poison the following compile');
});


test('slot-default consumes only qualified appearances and preserves omission and parent-link refusals',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const leaf=ContractSchema.parse({...contract(),id:'test.slot-authored-leaf',name:'SlotAuthoredLeaf',anatomy:{root:{parts:{text:{text:appearance.characters,
  textAppearanceByCombination:{props:[],rows:[{values:[],appearance}]},textAppearanceOverride:{prop:'appearance',choices:{observed:appearance}}}}}}});
 const parent=(child:ReturnType<typeof contract>,args:unknown,parentProps:unknown[]=[])=>ContractSchema.parse({...child,id:'test.slot-negative-parent',name:'SlotNegativeParent',props:parentProps,
  anatomy:{root:{parts:{slot:{slot:{name:'children',accepts:[child.id],defaultContent:[{id:child.id,props:args}]}}}}}});
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const compile=(child:ReturnType<typeof contract>,caller:ReturnType<typeof contract>)=>engine.compileComponentData(caller,new Map([[child.id,child],[caller.id,caller]]));
 const colored=ContractSchema.parse({...leaf,props:[...leaf.props,{name:'ink',type:{enum:['#112233','#44556680']},bindings:{code:{prop:'ink'},figma:{kind:'NONE'}}}],
  anatomy:{root:{parts:{...leaf.anatomy.root.parts,other:{text:'Other',textColorOverrideProp:'ink',literals:{color:'#aa0000','font-size':'14px'}}}}}});
 assert.throws(()=>compile(colored,parent(colored,{appearance:'observed',ink:'#112233'})),/visibility-override-context-unqualified/,
  'a valid appearance must not consume another valid NONE text-color control');
 assert.throws(()=>compile(leaf,parent(leaf,{appearance:'not-observed'})),/text-appearance-native-value-unqualified/,
  'slot defaults must validate the finite appearance choice before granting consumption');
 const lookup=structuredClone(parent(leaf,{appearance:'observed'},[{name:'selected',type:{enum:['off','on']},default:'off',
  bindings:{code:{prop:'selected'},figma:{kind:'VARIANT',property:'Selected'}}}]));
 // SlotContentItemSchema permits only string/boolean values. Object lookups
 // belong to ordinary ComponentRef props, not this default-content boundary.
 (lookup.anatomy.root.parts!.slot.slot!.defaultContent![0].props! as Record<string,unknown>).appearance={prop:'selected',map:{on:'observed'}};
 assert.equal(ContractSchema.safeParse(lookup).success,false,'slot-default object lookups retain the schema refusal');
 const omitted=compile(leaf,parent(leaf,{})).variants[0].spec.children!.find(n=>n.type==='slot')!.slotDefault![0];
 assert.equal(omitted.instanceTextAppearances,undefined,'an omitted appearance argument retains the source default');
 assert.deepEqual(omitted.props,{});
 const editable=ContractSchema.parse({...leaf,props:[...leaf.props,{name:'label',type:'text',default:'Label',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}}],
  anatomy:{root:{parts:{...leaf.anatomy.root.parts,label:{content:{prop:'label'}}}}}});
 const linked=parent(editable,{appearance:'observed',label:'{parentText}'},[{name:'parentText',type:'text',default:'Parent default',
  bindings:{code:{prop:'parentText'},figma:{kind:'TEXT',property:'Parent Text'}}}]);
 assert.throws(()=>compile(editable,linked),/FIGMA_NESTED_TEXT_PROP_LINK_UNSUPPORTED/,
  'slot-default mapping must retain the actual parent TEXT-link authority');
});


// Property binding independently clears inherited native range overrides.
// Only actual range setters repopulate them; a reference write never repairs paint.
function installReplayRangeMock(figma:any){
 const events:Array<{kind:string;node:any}>=[],created=figma.createText.bind(figma);
 const decorate=(node:any)=>{
  const ranges:Array<Record<string,unknown>>=[];let references=node.componentPropertyReferences;
  node.fontWeight=400;
  Object.defineProperty(node,'componentPropertyReferences',{configurable:true,get:()=>references,set:value=>{
   references=value;if(value.characters){events.push({kind:'bind',node});ranges.length=0;}
  }});
  for(const name of ['FontName','FontSize','LineHeight','LetterSpacing','TextCase','TextDecoration','Fills']){
   const field=name[0].toLowerCase()+name.slice(1);
   node['setRange'+name]=(start:number,end:number,value:any)=>{
    events.push({kind:field,node});
    const copy=field==='fontName'?{...value,...(value.variationSettings===undefined?{}:{variationSettings:Object.assign(Object.create(null),value.variationSettings)})}:structuredClone(value);
    for(let index=start;index<end;index++)(ranges[index]??={})[field]=copy;
   };
  }
  node.getStyledTextSegments=(fields:string[],start=0,end=node.characters.length)=>Array.from({length:end-start},(_,offset)=>{
   const index=start+offset,row=ranges[index]??{};
   return {start:index,end:index+1,characters:node.characters.slice(index,index+1),
    ...Object.fromEntries(fields.map(field=>[field,Object.hasOwn(row,field)?row[field]:node[field]]))};
  });
  return node;
 };
 figma.createText=()=>decorate(created());
 figma.getFontFamilyVariationAxes=()=>['wght'];
 return {events,decorate};
}
test('final authored replay survives late property binding on create, amend and repeat for standalone and variant owners',async()=>{
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 for(const variants of [false,true]){
  const source=structuredClone(appearance);for(const run of source.runs)(run.fontName as any).variationSettings={wght:400};
  const c=ContractSchema.parse({...contract(),id:'test.final-authored-'+variants,name:'FinalAuthored'+variants,
   props:[{name:'label',type:'text',default:source.characters,bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},
    ...(variants?[{name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}]:[])],
   anatomy:{root:{parts:{label:{content:{prop:'label'},declared:{'font-family':'Inter'},literals:{'font-size':'14px'},
    textAppearanceByCombination:{props:[],rows:[{values:[],appearance:source}]}}}}}});
  const mock=createFigmaMock(),range=installReplayRangeMock(mock.figma),engine=createFigmaEngine({tokens,icons:new Map()}),
   context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}});
  const run=(script:string)=>vm.runInContext('(async()=>{'+script+'\n})()',context);
  await run(engine.buildTokensScript(null));let originalId:string|undefined;
  for(const phase of ['create','amend','repeat']){
   if(phase==='amend'){
    c.version='0.1.1';c.props[0].default='C\nD';c.anatomy.root.parts!.label.textAppearanceByCombination!.rows[0].appearance.characters='C\nD';
   }
   range.events.length=0;
   const result=await run(engine.buildComponentScript(c,new Map([[c.id,c]]))),owner=mock.root.findOne(n=>
    ['COMPONENT','COMPONENT_SET'].includes(n.type)&&n.parent?.type!=='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===c.id)!;
   assert.ok(owner);if(phase==='create')originalId=owner.id;else assert.equal(owner.id,originalId);
   assert.equal(owner.getSharedPluginData('ds_contracts','specHash'),createPluginEngine({tokens,contracts:[],icons:{}}).specHashOf(c));
   const mains=owner.type==='COMPONENT_SET'?owner.children!:[owner],expected=c.anatomy.root.parts!.label.textAppearanceByCombination!.rows[0].appearance;
   assert.equal(mains.length,variants?2:1);
   const lastBinding=range.events.map(event=>event.kind).lastIndexOf('bind');
   for(const main of mains){
    const text:any=main.findOne(n=>n.type==='TEXT');assert.ok(text);assert.equal(text.characters,expected.characters);
    assert.equal(nativeTextAppearanceMatches(expected,text.characters,text.getStyledTextSegments(
     ['fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','fills']),true),true,phase);
    if(phase!=='repeat'){
     assert.ok(lastBinding>=0,'the independent mock actually erased ranges on binding');
     assert.ok(range.events.map(event=>event.node===text&&event.kind==='fills').lastIndexOf(true)>lastBinding,
      'every variant must finish replay after the final owner property binding');
    }
   }
   if(phase==='repeat'){assert.equal(result.results[0].skipped,true);assert.equal(range.events.length,0);}
  }
 }
});

// Optional runtime fields never authorize a new slot-control writer boundary.
test('explicit-only slot defaults and forged appearance carriers retain named refusals',async()=>{
 const leaf=contract();for(const run of leaf.anatomy.root.parts!.text.textAppearanceOverride!.choices.observed.runs)
  run.fontName.variationSettings={wght:400};
 const parent=ContractSchema.parse({...leaf,id:'test.appearance-slot-only',name:'AppearanceSlotOnly',props:[],
  anatomy:{root:{parts:{slot:{slot:{name:'children',accepts:[leaf.id],defaultContent:[{id:leaf.id,props:{appearance:'observed'}}]}}}}}});
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},byId=new Map([[leaf.id,leaf],[parent.id,parent]]),
  engine=createFigmaEngine({tokens,icons:new Map()});
 assert.throws(()=>engine.compileComponentData(parent,byId),/visibility-override-context-unqualified/,
  'an explicit-only NONE default remains refused without authored slot authority');
 const admitted=structuredClone(parent);admitted.anatomy.root.parts!.slot.slot!.defaultContent![0].props={};byId.set(parent.id,admitted);
 const data=engine.compileComponentData(admitted,byId),slot=data.variants[0].spec.children![0];
 assert.equal(slot.type,'slot');assert.equal(slot.slotDefault![0].instanceTextAppearances,undefined);
 assert.doesNotMatch(figmaRuntimeRevision(data),/text-appearance-property-finalization/,
  'an omitted caller cannot inherit a runtime salt from its leaf appearance control');
 const source=engine.buildBatchScript([data],null),compiled=source.match(/const COMPONENTS = ([\s\S]*?);\nconst ROW_H = /);
 assert.ok(compiled);const emitted=JSON.parse(compiled[1]).find((component:any)=>component.contractId===parent.id);
 const hashStart=source.indexOf('const RUNTIME_EMIT_REV = '),hashEnd=source.indexOf('// THE NAMED RECEIPT ON THE CANVAS',hashStart);
 assert.ok(hashStart>=0&&hashEnd>hashStart);
 const emittedHash=vm.runInNewContext(source.slice(hashStart,hashEnd)+'\nspecHash(C);',{C:emitted});
 assert.equal(emittedHash,createPluginEngine({tokens,contracts:[leaf,admitted],icons:{}}).specHashOf(admitted));
 const forged=structuredClone(data);forged.variants[0].spec.children![0].slotDefault![0].instanceTextAppearances=mapNativeTextAppearances(leaf,{appearance:'observed'},{});
 assert.throws(()=>engine.buildBatchScript([forged],null),/FIGMA_COMPONENT_DATA_UNVERIFIED/,
  'injecting an explicit appearance into compiled slot data cannot bypass contract authority');
});
