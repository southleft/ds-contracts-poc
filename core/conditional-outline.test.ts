import assert from 'node:assert/strict';import test from 'node:test';
import {chromium} from 'playwright-core';
import {proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,resolveLiterals} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated} from './react-test-runtime.js';import {createFigmaEngine} from './emit-figma-script.js';
import {tokenInventoryFromJson} from './tokens.js';import {emitTokensCss,tokensCssLayers} from '../packages/core/src/emit-tokens-css.js';
function proposal(){
 const set:any={setName:'ConditionalOutline',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'On',variantOptions:['On','Off']},Disabled:{type:'VARIANT',defaultValue:'False',variantOptions:['False','True']}},variants:['On','Off'].flatMap(mode=>['False','True'].map(disabled=>({name:`Mode=${mode}, Disabled=${disabled}`,type:'COMPONENT',variantProperties:{Mode:mode,Disabled:disabled},bbox:{width:30,height:30},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'Handle',type:'FRAME',bbox:{width:20,height:20},fixedSize:{width:20,height:20},fill:{hex:'ffffff'},...(mode==='Off'&&disabled==='False'?{stroke:{hex:'818b98'},strokeWeight:1,strokeAlign:'OUTSIDE',strokesIncludedInLayout:false}:{}),children:[]}]})))};
 const before=JSON.stringify(set),r=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});assert.equal(JSON.stringify(set),before);
 const c=ContractSchema.parse(r.contract),tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};return {c,tokens};
}
test('nested enum/Boolean outside stroke retains its pair and explicit absence in both React renderers and native compilation',async t=>{
 const {c,tokens}=proposal(),part=c.anatomy.root.parts!.Handle,contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens}),{...emitReactInline(c,{contracts,icons,tokens}),css:''}]){
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
   for(const mode of ['on','off'])for(const disabled of [false,true]){const drawn=mode==='off'&&!disabled;const lit=resolveLiterals(part,{mode,disabled:String(disabled)});assert.equal(lit['outline-width'],drawn?'1px':'0px');
    await render({mode,disabled});const actual=await page.locator('#root > div > div').evaluate(n=>{const s=getComputedStyle(n);return {width:s.outlineWidth,color:s.outlineColor,style:s.outlineStyle};});assert.equal(actual.width,drawn?'1px':'0px');assert.equal(actual.style,'solid');if(drawn)assert.equal(actual.color,'rgb(129, 139, 152)');
   }
  }finally{await page.close();}
 }
 for(const v of native.variants){const part=v.spec.children!.find(n=>n.name==='Handle')!;assert.equal(part.strokeOutside,true);assert([0,1].includes(part.lits!.strokeWeight!));}
 assert.equal(native.variants.filter(v=>v.spec.children!.find(n=>n.name==='Handle')!.lits!.strokeWeight===1).length,1);
});

test('native literal outlines name incomplete pairs, unsupported styles and competing borders',()=>{
 for(const fault of ['missing-color','style','border','side-token']){const {c,tokens}=proposal(),part=c.anatomy.root.parts!.Handle;
  if(fault==='missing-color')for(const table of part.literalsByCombination??[])for(const row of table.rows)delete row.literals['outline-color'];
  if(fault==='style')part.declared!['outline-style']='none';
  if(fault==='border')part.literals={...part.literals,'border-width':'2px','border-color':'#ff0000'};
  if(fault==='side-token'){(tokens.primitives as Record<string,unknown>).outlineTestEdge={$type:'dimension',$value:'2px'};part.tokens={...part.tokens,'border-left-width':'{outlineTestEdge}'};}
  const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
  assert.match(JSON.stringify(native),/literal outline (requires|competes)/,fault);
 }
});
async function nativeStateDomainFixture(){
 const {c,tokens}=partialStateDomainProposal();const icons=new Map<string,string>(),contracts=new Map([[c.id,c]]);
 const engine=createFigmaEngine({tokens,icons});
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const {figma,root}=createFigmaMock();const vm=await import('node:vm');
 const context=vm.createContext({figma,console});
 await vm.runInContext('(async()=>{'+engine.buildTokensScript(null)+'\n})()',context,{timeout:20000});
 await vm.runInContext('(async()=>{'+engine.buildComponentScript(c,contracts)+'\n})()',context,{timeout:20000});
 const nativeSet=root.findOne((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert.ok(nativeSet);
 const evidence=await import('node:fs');
 const dumpCode=evidence.readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([nativeSet.name])};`);
 const readback=(await vm.runInContext('(async()=>{'+dumpCode+'\n})()',context,{timeout:20000}))[nativeSet.name];
 return {nativeSet,readback,tokens};
}


function partialStateDomainProposal() {
const set: any={setName:'StateDomainFixture',type:'COMPONENT_SET',propertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'Brand',variantOptions:['Brand','White','Gray']},State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']}},variants:['Brand','White','Gray'].flatMap(tone=>(tone==='Brand'?['Default']:['Default','Hover']).map(state=>({name:`Tone=${tone}, State=${state}`,type:'COMPONENT',variantProperties:{Tone:tone,State:state},bbox:{width:24,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'Ink',type:'RECTANGLE',bbox:{width:24,height:24},fixedSize:{width:24,height:24},fill:{hex:state==='Hover'?(tone==='White'?'e5e5e5':'737373'):(tone==='White'?'ffffff':tone==='Gray'?'aaaaaa':'0044ff')},children:[]}]})))};
const opts:any={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),stampsObservable:true};
const result=proposeFromDump(set,opts);const c=ContractSchema.parse(result.contract);return {set,result,c,tokens:{primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}}};
}

test('partial state maps render in CSS React; inline state omission remains explicit',async t=>{
 const {set,result,c,tokens}=partialStateDomainProposal();
 assert.equal(result.projection.status,'verified-exact');
 assert.equal(result.projection.expectedCount,5);assert.equal(result.projection.observedCount,5);
 const stateMap=c.anatomy.root.parts!.Ink.statesByProp!.find(row=>row.state==='hover')!;
 assert.deepEqual(Object.keys(stateMap.map).sort(),['gray','white']);assert(!('brand' in stateMap.map));
 const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens}),{...emitReactInline(c,{contracts,icons,tokens}),css:''}]){
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
   for(const [tone,rest,hover] of [['white','rgb(255, 255, 255)','rgb(229, 229, 229)'],['gray','rgb(170, 170, 170)','rgb(115, 115, 115)'],['brand','rgb(0, 68, 255)','rgb(0, 68, 255)']]){
    await page.mouse.move(1000,1000);await render({tone});const ink=page.locator('#root > * > *');
    assert.equal(await ink.evaluate(n=>getComputedStyle(n).backgroundColor),rest,tone+' rest');
    await ink.hover();if(output.css)assert.equal(await ink.evaluate(n=>getComputedStyle(n).backgroundColor),hover,tone+' hover');else{assert.match(output.tsx,/state tokens are not expressible as inline/);assert.equal(await ink.evaluate(n=>getComputedStyle(n).backgroundColor),rest,tone+' inline declared limitation');}
   }
  }finally{await page.close();}
 }
 const {nativeSet,readback}=await nativeStateDomainFixture();
 assert.ok(nativeSet.children);
 const variants=nativeSet.children.map((n:any)=>n.name);
 const descriptor=JSON.parse(nativeSet.getSharedPluginData('ds_contracts','statePreviewAxis'));
 const {validateExactVariantProjection}=await import('./exact-projection.js');
 const dump={...set,statePreviewAxis:descriptor,variants:variants.map((name:string)=>({name,variantProperties:Object.fromEntries(name.split(', ').map((p:string)=>p.split('=')))}))};
 assert.equal(validateExactVariantProjection(dump).status,'source-matrix-verified');
 for(const fault of ['missing','extra','duplicate','unknown','incomplete']){
  const bad=structuredClone(dump);
  if(fault==='missing')bad.variants.pop();
  if(fault==='extra')bad.variants.push({name:'Tone=Brand, State=Hover',variantProperties:{Tone:'Brand',State:'Hover'}});
  if(fault==='duplicate')bad.statePreviewAxis.rows.push(bad.statePreviewAxis.rows[0]);
  if(fault==='unknown')bad.statePreviewAxis.rows[0].Tone='Unknown';
  if(fault==='incomplete')delete bad.statePreviewAxis.rows[0].Tone;
  assert.equal(validateExactVariantProjection(bad).status,'refused',fault);
 }
 const back=proposeFromDump(readback,{corpus:tokenCorpusFromJson({primitives:tokens.primitives,semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),projectionMode:'exact',stampsObservable:true});
 assert.equal(back.projection.status,'verified-exact');
 assert.equal(back.projection.observedCount,5);
 const backContract=ContractSchema.parse(back.contract);
 const backNative=createFigmaEngine({tokens,icons}).compileComponentData(backContract,new Map([[backContract.id,backContract]]));
 assert.equal(backNative.variants.length+(backNative.stateVariants?.length??0),5);
 assert.equal(variants.length,5);
 assert(!variants.some((name:string)=>name.includes('Brand')&&name.includes('Hover')));
 assert.equal(set.variants.length,5);
});

test('explicit state preview contract domain rejects invalid or incomplete rows',()=>{
 for(const fault of ['duplicate','unknown-prop','missing-prop','unknown-value','undeclared-state','missing-state','disabled-previews']){
  const {c}=partialStateDomainProposal();const rows=c.bindings.figma.statePreviewRows!;
  if(fault==='duplicate')rows.push(structuredClone(rows[0]));
  if(fault==='unknown-prop')rows[0].props.unknown='white';
  if(fault==='missing-prop')delete rows[0].props.tone;
  if(fault==='unknown-value')rows[0].props.tone='unknown';
  if(fault==='undeclared-state')rows[0].state='active';
  if(fault==='missing-state')c.states.push('active');
  if(fault==='disabled-previews')c.bindings.figma.statePreviews=false;
  assert.equal(ContractSchema.safeParse(c).success,false,fault);
 }
});

test('partial bound-state paint does not infer a partial map from incomplete evidence',async()=>{
 for(const fault of ['missing-paint','empty-ref','missing-child']){
  const {readback:dump}=await nativeStateDomainFixture();
  const hover=dump.variants.find((v:any)=>v.name.includes('White')&&v.name.includes('Hover'));
  if(fault==='missing-paint')delete hover.children[0].fill;
  if(fault==='empty-ref')hover.children[0].fill.var='';
  if(fault==='missing-child')hover.children=[];
  try{
   const p=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),projectionMode:'exact',stampsObservable:true});
   assert(!p.notes.some(n=>n.includes('partial bound state paint retained')),fault);
  }catch(error){assert.equal((error as Error).name,'ExactProjectionError',fault);}
 }
});

test('existing bound state rows roundtrip without minting new tokens',async()=>{
 const {readback:dump,tokens}=await nativeStateDomainFixture();
 const p=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:tokens.primitives,semantic:{},light:{},brandDefault:{}}),mintUnbound:false,contractIdByName:new Map(),projectionMode:'exact',stampsObservable:true});
 assert.equal(p.projection.status,'verified-exact');assert.equal(p.projection.observedCount,5);
 const c=ContractSchema.parse(p.contract);assert.equal(c.bindings.figma.statePreviewRows?.length,2);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(native.variants.length+(native.stateVariants?.length??0),5);
});


test('state stroke color is scoped to complete painted enum values and never leaks to absent values',()=>{
 const fixture=()=>({setName:'ScopedStroke',type:'COMPONENT_SET',propertyDefinitions:{Variant:{type:'VARIANT',defaultValue:'Outline',variantOptions:['Outline','Ghost']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Focus']}},
  variants:['Outline','Ghost'].flatMap(variant=>['Small','Large'].flatMap(size=>['Default','Focus'].map(state=>({name:`Variant=${variant}, Size=${size}, State=${state}`,type:'COMPONENT',variantProperties:{Variant:variant,Size:size,State:state},bbox:{width:32,height:32},fill:{hex:'ffffff'},...(variant==='Outline'?{stroke:{hex:state==='Focus'?'b7b7b7':'e5e5e5'},strokeWeight:1,strokeAlign:'INSIDE',strokesIncludedInLayout:false}:{}),children:[]}))))});
 const read=(set:any)=>proposeFromDump(set,{stampsObservable:true,corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});
 const good=read(fixture()),c=ContractSchema.parse(good.contract),map=c.anatomy.root.statesByProp?.find(r=>r.prop==='variant'&&r.state==='focus-visible')?.map;
 assert.deepEqual(Object.keys(map??{}),['outline']);assert.ok(map?.outline['border-color']);
 assert.ok(good.mintedTokens?.entries.some(e=>e.value==='#b7b7b7'));
 const native=createFigmaEngine({tokens:{primitives:good.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(native.stateVariants?.length,4);
 for(const v of native.stateVariants!){
   if(v.name.includes('Variant=Outline'))assert.equal(v.spec.stroke,map!.outline['border-color'].slice(1,-1).replaceAll('.','/'));
   else assert.equal(v.spec.stroke,native.variants.find(row=>row.name.includes('Variant=Ghost'))!.spec.stroke);
 }

 const sparse=fixture();sparse.variants=sparse.variants.filter(v=>v.name!=='Variant=Outline, Size=Large, State=Focus');
 assert.throws(()=>read(sparse),/state-axis-state-not-carried/);
 const cleared:any=fixture();delete cleared.variants.find((v:any)=>v.name==='Variant=Outline, Size=Small, State=Focus').stroke;
 assert.throws(()=>read(cleared),/state-axis-state-not-carried/);
});


test('scoped active stroke restores the resting color while hover still matches',()=>{
 const set:any={setName:'ActiveStroke',type:'COMPONENT_SET',propertyDefinitions:{Variant:{type:'VARIANT',defaultValue:'Outline',variantOptions:['Outline','Ghost']},State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover','Pressed']}},variants:['Outline','Ghost'].flatMap(variant=>['Default','Hover','Pressed'].map(state=>({name:`Variant=${variant}, State=${state}`,type:'COMPONENT',variantProperties:{Variant:variant,State:state},bbox:{width:32,height:32},fill:{hex:'ffffff'},...(variant==='Outline'?{stroke:{hex:state==='Hover'?'ff0000':'e5e5e5'},strokeWeight:1,strokeAlign:'INSIDE',strokesIncludedInLayout:false}:{}),children:[]})))};
 const r=proposeFromDump(set,{stampsObservable:true,corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(r.contract),ref=c.anatomy.root.statesByProp?.find(row=>row.prop==='variant'&&row.state==='active')?.map.outline?.['border-color'];
 assert.ok(ref);assert.equal(tokenCorpusFromJson({primitives:r.mintedTokens!.tree,semantic:{},light:{},brandDefault:{}}).resolveLiteral(ref.slice(1,-1)),'#e5e5e5');
});

test('captured stroke-free focus preserves absence while authored source outlines survive',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const outline of [false,true]){
  const set:any={setName:'FocusAbsence',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover','Focus']}},variants:['Default','Hover','Focus'].map(state=>({name:`State=${state}`,type:'COMPONENT',variantProperties:{State:state},bbox:{width:40,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},...(outline&&state==='Focus'?{stroke:{hex:'0044ff'},strokeWeight:2,strokeAlign:'OUTSIDE'}:{}),children:[{name:'Ink',type:'RECTANGLE',bbox:{width:20,height:20},fixedSize:{width:20,height:20},fill:{hex:state==='Focus'?'ff0000':state==='Hover'?'888888':'ffffff'}}]}))};
  const r=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,stampsObservable:true,contractIdByName:new Map()});
  const c=ContractSchema.parse(r.contract);assert(c.states.includes('focus-visible'));assert.equal(c.anatomy.root.declaredStates?.['focus-visible']?.['outline-style'],outline?undefined:'none');
  const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
  const output=emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens});const page=await browser.newPage();
  try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});await render({statePreview:'focus-visible'});assert.equal(await page.locator('#root>*').evaluate(n=>getComputedStyle(n).outlineStyle),outline?'solid':'none');}finally{await page.close();}
  assert(createFigmaEngine({tokens,icons}).compileComponentData(c,contracts).variants.length>0);
 }
});

test('renamed nested state text follows captured base identity and refuses ambiguous ownership',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const identity of ['qualified','missing','ambiguous']){
  let id=0;const variants=['Default','Hover','Disabled'].flatMap(state=>['True','False'].map(support=>{
   const prefix=String(++id),nodeId=(suffix:string)=>identity==='missing'?undefined:`${prefix}:${identity==='ambiguous'&&['2','3'].includes(suffix)?'2':suffix}`;
   return {name:`State=${state}, Supporting text=${support}`,type:'COMPONENT',nodeId:nodeId('0'),variantProperties:{State:state,'Supporting text':support},bbox:{width:100,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'Content',type:'FRAME',nodeId:nodeId('1'),bbox:{width:100,height:24},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:4,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Label',type:'TEXT',nodeId:nodeId('2'),text:{characters:'Label',fontFamily:'Inter',fontStyle:'Regular',fontWeight:400,fontSize:12,lineHeight:16},fill:{hex:state==='Hover'?'888888':'111111'}},...(support==='True'?[{name:'Supporting text',type:'TEXT',nodeId:nodeId('3'),text:{characters:'Detail',fontFamily:'Inter',fontStyle:'Regular',fontWeight:400,fontSize:12,lineHeight:16},fill:{hex:state==='Disabled'?'e5e5e5':'525252'}}]:[])]}]};
  }));
  const set:any={setName:'Button',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover','Disabled']},'Supporting text':{type:'VARIANT',defaultValue:'False',variantOptions:['True','False']}},variants};
  const propose=()=>proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,stampsObservable:true,contractIdByName:new Map()});
  if(identity!=='qualified'){assert.throws(propose,/state-axis-state-not-carried:disabled/);continue;}
  const r=propose(),c=ContractSchema.parse(r.contract);
  const part=c.anatomy.root.parts!.Content.parts!.supportingText;assert(part.states?.disabled);
  const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c]]),icons=new Map<string,string>();const output=emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens});const page=await browser.newPage();
  try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});for(const disabled of [false,true]){await render({supportingText:true,disabled});assert.equal(await page.getByText('Detail',{exact:true}).evaluate(n=>getComputedStyle(n).color),disabled?'rgb(229, 229, 229)':'rgb(82, 82, 82)');}}finally{await page.close();}
 }
});

test('native outline offsets preserve inside and centered bands through the generated writer',async()=>{
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');const vm=await import('node:vm');
 for(const [offset,alignment] of [[0,'OUTSIDE'],[-0.5,'CENTER'],[-1,'INSIDE']]as const){
  const {c,tokens}=proposal(),part=c.anatomy.root.parts!.Handle;
  (tokens.primitives as any).offsetProbe={$type:'dimension',$value:`${offset}px`};part.tokens={...part.tokens,'outline-offset':'{offsetProbe}'};
  const engine=createFigmaEngine({tokens,icons:new Map()}),contracts=new Map([[c.id,c]]);
  const {figma,root}=createFigmaMock();const context=vm.createContext({figma,console});
  await vm.runInContext('(async()=>{'+engine.buildTokensScript(null)+'\n})()',context);
  await vm.runInContext('(async()=>{'+engine.buildComponentScript(c,contracts)+'\n})()',context);
  const handles=root.findAll((n:any)=>n.name==='Handle'&&n.strokeWeight===1&&n.strokes?.length);
  assert.equal(handles.length,1);assert.equal(handles[0].strokeAlign,alignment,`${offset}`);
  assert.equal(handles[0].width,20);assert.equal(handles[0].height,20);
 }
});
test('unrepresentable outline offsets retain explicit missing-channel evidence',()=>{
 const {c,tokens}=proposal();(tokens.primitives as any).offsetProbe={$type:'dimension',$value:'3px'};c.anatomy.root.parts!.Handle.tokens={'outline-offset':'{offsetProbe}'};
 const d=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert(d.codeOnlyFacts?.some(x=>x.channel==='outline-offset'));
 assert(!JSON.stringify(d).includes('outlineStrokeAlign'));
});


test('partial bound-state paint preserves escaped Figma variable names as legal token paths',async()=>{
 const {readback:dump}=await nativeStateDomainFixture();
 const hover=dump.variants.find((v:any)=>v.name.includes('White')&&v.name.includes('Hover'));
 hover.children[0].fill.var='invalid@token/path';
 const p=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map(),projectionMode:'exact',stampsObservable:true});
 const c=ContractSchema.parse(p.contract);
 assert(JSON.stringify(c).includes('invalid-u40-token.path'));
 assert(p.notes.some(n=>n.includes('partial bound state paint retained')));
});

test('interaction padding preserves asymmetric sides and active resets in CSS Modules and native compilation',async t=>{
 const states=['Default','Hover','Pressed','Focus'];
 const pads=[[1,2,3,4],[5,6,7,8],[1,2,3,4],[0,0,0,0]];
 const set:any={setName:'StatePadding',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:states}},variants:states.map((state,i)=>({name:`State=${state}`,type:'COMPONENT',variantProperties:{State:state},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:pads[i],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Ink',type:'RECTANGLE',bbox:{width:10,height:10},fixedSize:{width:10,height:10},fill:{hex:'ffffff'}}]}))};
 const r=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,projectionMode:'reviewable-inversion',contractIdByName:new Map()});
 const c=ContractSchema.parse(r.contract),tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens})]){
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
   for(const [i,state] of [undefined,'hover','active','focus-visible'].entries()){
    await render(state?{statePreview:state}:{});
    if(state==='active')await page.locator('#root > *').hover();
    else await page.mouse.move(1000,800);
    const actual=await page.locator('#root > *').evaluate(n=>{const s=getComputedStyle(n);return [s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft];});
    assert.deepEqual(actual,pads[i].map(v=>`${v}px`));
   }
  }finally{await page.close();}
 }
 c.bindings.figma.statePreviews=true;
 const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts);
 const planes=[...native.variants,...native.stateVariants??[]];
 assert.equal(planes.length,4);
 for(const variant of planes)for(const side of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])
  assert(variant.spec.bindings?.[side as keyof typeof variant.spec.bindings],`${variant.name} must retain ${side}`);
});
