import test from 'node:test';
import assert from 'node:assert/strict';
import {planSolidFillBindingTokens} from './solid-fill-binding-tokens.js';
import {qualifySolidFillColorBinding} from '../extract/figma/solid-fill-binding.js';
import {compileTokenSetRows} from './token-set.js';

function binding(id='semantic',terminal='primitive',n=Math.fround(.1234567)) {
  const value={r:n,g:.5,b:1,a:1};
  return qualifySolidFillColorBinding({variableId:id,paint:{color:{r:n,g:.5,b:1},opacity:1,blendMode:'NORMAL'}},{[id]:{
    name:'paint',collectionId:'theme',modeId:'light',modeName:'Light',resolvedType:'COLOR',value,
    selectedValue:{type:'VARIABLE_ALIAS',id:terminal},aliasChain:[{id:terminal,name:'paint',collectionId:'palette',modeId:'base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}],
  }});
}

test('paint binding token graph preserves aliases and native precision without merging equal-value identities',()=>{
  const a=binding(),b=binding('second','twin');b.consumer.name='second';b.consumer.aliasChain![0].name='twin';
  const input=[a,b,a],before=JSON.stringify(input),plan=planSolidFillBindingTokens(input);
  assert.equal(plan.variables.length,4);assert.equal(plan.requestedTokenPaths.length,2);
  assert.deepEqual(planSolidFillBindingTokens([...input].reverse()),plan);assert.equal(JSON.stringify(input),before);
  const compiled=compileTokenSetRows({name:'Paint',base:{},minted:plan.tokens});
  assert.equal(compiled.aliasCount,2);assert.deepEqual(compiled.unsupportedValues,[]);
  const terminal=compiled.rows.find(r=>r.name===plan.variables.find(v=>v.variableId==='primitive')!.tokenPath.replaceAll('.','/'))!;
  assert.notEqual(terminal.type,'ALIAS');if(terminal.type==='ALIAS')throw Error('terminal must be a color');
  assert.deepEqual(terminal.light,{r:Math.fround(.1234567),g:.5,b:1,a:1});
});

test('paint binding token graph refuses cross-occurrence value, mode, name and source-proof conflicts',()=>{
  assert.throws(()=>planSolidFillBindingTokens([]),/empty/);
  assert.throws(()=>planSolidFillBindingTokens([binding(),binding('semantic','primitive',.25)]),/variable-conflict/);
  const mode=binding('other','other-base');mode.consumer.name='other';mode.consumer.modeId='dark';mode.consumer.modeName='Dark';mode.consumer.aliasChain![0].name='other-base';
  assert.throws(()=>planSolidFillBindingTokens([binding(),mode]),/context-conflict/);
  assert.throws(()=>planSolidFillBindingTokens([binding(),binding('other','other-base')]),/name-conflict/);
  const forged=binding();forged.consumer.aliasChain![0].value={r:0,g:0,b:0,a:1};
  assert.throws(()=>planSolidFillBindingTokens([forged]),/disagreement/);
});

test('public bound paint preserves the exact selected graph across schema, React and native compilation',async()=>{
 const {readFileSync}=await import('node:fs');
 const {ContractSchema,walkAnatomy}=await import('@ds-contracts/schema');
 const {solidFillPartTokenError}=await import('./solid-fill-binding-tokens.js');
 const {emitReact}=await import('./emit-react.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {tokenInventoryFromJson}=await import('./tokens.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const e=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-scoped/CARBON.json',import.meta.url),'utf8'));
 const c=ContractSchema.parse(e.c),contracts=new Map([[c.id,c]]),ctx={contracts,icons:new Map<string,string>(),tokens:tokenInventoryFromJson([e.tokens.primitives]),tokenValues:e.tokens};
 assert.doesNotThrow(()=>emitReact(c,ctx));
 assert.doesNotThrow(()=>emitReactInline(c,{...ctx,tokens:e.tokens}));
 assert.deepEqual(JSON.parse(JSON.stringify(createFigmaEngine({tokens:e.tokens,icons:ctx.icons}).compileNativePreparedLibrary(c,contracts,e.source,e.operation.id).components)),e.input.graphComponents);
 const part=c.anatomy.root,path=part.solidFillCompositionToken!,leaf=path.split('.')[1];
 assert.equal(solidFillPartTokenError(part,e.tokens),undefined);
 const semantic={...e.tokens,primitives:{},semantic:e.tokens.primitives};
 assert.equal(solidFillPartTokenError(part,semantic),undefined,'modeless import layers may live in semantic');
 for(const mutate of [
  (t:any)=>{delete t.primitives.sourcePaint[leaf];},
  (t:any)=>{t.primitives.sourcePaint[leaf].$value='rgba(255,255,255,0)';},
  (t:any)=>{t.light.sourcePaint={[leaf]:t.primitives.sourcePaint[leaf]};},
  (t:any)=>{t.semantic.sourcePaint={[leaf]:t.primitives.sourcePaint[leaf]};},
  (t:any)=>{t.brands.other={sourcePaint:{[leaf]:t.primitives.sourcePaint[leaf]}};},
 ]){const t=structuredClone(e.tokens);mutate(t);assert.match(solidFillPartTokenError(part,t)!,/graph-disagreement/);assert.throws(()=>emitReact(c,{...ctx,tokenValues:t}));assert.throws(()=>createFigmaEngine({tokens:t,icons:ctx.icons}).compileComponentData(c,contracts));}
 for(const mutate of [
  (p:any)=>{delete p.solidFillCompositionSourceBinding;},
  (p:any)=>{delete p.solidFillCompositionToken;},
  (p:any)=>{p.solidFillComposition.opacity=.5;},
  (p:any)=>{p.solidFillCompositionSourceBinding[0].binding.consumer.extra=true;},
 ]){const bad=structuredClone(c);mutate(bad.anatomy.root);assert.equal(ContractSchema.safeParse(bad).success,false);}
 assert.equal(walkAnatomy(c).filter(({part})=>part.solidFillCompositionToken).length,2);
});

test('CSS token emission retains positive sub-byte alpha and does not invent paint for zero',async()=>{
 const {cssValueOf}=await import('../packages/core/src/emit-tokens-css.js');
 const {mintedTokenCss}=await import('./mint-tokens.js');
 const {chromium}=await import('playwright-core');
 const browser=await chromium.launch();try{const page=await browser.newPage();
 await page.setContent('<svg width="40" height="40"><rect width="100%" height="100%" style="fill:var(--ink)" /></svg>');
 for(const alpha of [0,Math.fround(.00001),Math.fround(.001),.5,1]){
  const raw=`rgba(255,128,0,${alpha})`,css=cssValueOf(raw)!;
  const tree={ink:{$type:'color',$value:raw}};
  assert(mintedTokenCss(tree).includes(`--ink: ${css};`));
  await page.evaluate(value=>document.documentElement.style.setProperty('--ink',value),css);
  const fill=await page.locator('rect').evaluate(n=>getComputedStyle(n).fill);
  if(alpha>0&&alpha<1/255){assert.match(fill,/^color\(srgb/);const rendered=Number(fill.match(/\/\s*([^)]*)/)![1]);assert(rendered>0);assert(Math.abs(rendered-alpha)<1e-9);}
  if(alpha===0)assert.equal(fill,'rgba(255, 128, 0, 0)');
 }
 }finally{await browser.close();}
});

async function boundTableFixture(){
 const {readFileSync}=await import('node:fs');
 const a=binding(),b=binding('second','second-base',.75);b.consumer.name='second';b.consumer.aliasChain![0].name='second-base';
 const plan=planSolidFillBindingTokens([a,b]);
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[{name:'paint',type:{enum:['first','second','empty']},default:'first',bindings:{code:{prop:'paint'},figma:{kind:'VARIANT',property:'Paint'}}}];
 c.states=[];delete c.a11y;c.semantics={element:'div'};
 c.anatomy={root:{layout:{display:'flex',direction:'row',align:'center',justify:'center'},literals:{width:'20px',height:'20px'},solidFillCompositionByCombination:{props:['paint'],rows:[a,b].map((binding,i)=>({values:[i?'second':'first'],paint:binding.paint,token:planSolidFillBindingTokens([binding]).requestedTokenPaths[0],sourceBinding:{owner:'root',nodeName:'Paint',variantName:i?'Second':'First',binding}})).concat([{values:['empty'],paint:{color:{r:0,g:0,b:0},opacity:0,blendMode:'NORMAL'},empty:true}] as any)}}};
 return {c,tokens:{primitives:plan.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},a,b};
}

test('bound paint cells select exact native tokens and explicit empty fill without losing aliases',async()=>{
 const {ContractSchema}=await import('@ds-contracts/schema');
 const {solidFillPartBindingPlan,solidFillPartTokenError}=await import('./solid-fill-binding-tokens.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {c,tokens,a,b}=await boundTableFixture();
 const parsed=ContractSchema.parse(c),part=parsed.anatomy.root;
 assert.equal(solidFillPartTokenError(part,tokens),undefined);
 assert.equal(solidFillPartBindingPlan(part)!.variables.length,4);
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parsed,new Map([[c.id,parsed]]));
 for(const [value,binding] of [['first',a],['second',b]] as const){
  const spec=data.variants.find(v=>v.name==='Paint='+value)!.spec;
  assert.equal(spec.solidFillCompositionToken,planSolidFillBindingTokens([binding]).requestedTokenPaths[0]);
  assert.deepEqual(spec.solidFillComposition,{type:'SOLID',...binding.paint});
 }
 const empty=data.variants.find(v=>v.name==='Paint=empty')!.spec;
 assert.equal(empty.solidFillComposition,undefined);assert.equal(empty.solidFillCompositionToken,undefined);
 assert.equal(empty.lits?.fillClear,true,'empty native component must clear Figma default or stale fill');
 for(const mutation of ['token','proof','paint','empty'] as const){
  const bad=structuredClone(c),row=bad.anatomy.root.solidFillCompositionByCombination.rows[0];
  if(mutation==='token')row.token=planSolidFillBindingTokens([b]).requestedTokenPaths[0];
  if(mutation==='proof')delete row.sourceBinding;
  if(mutation==='paint')row.paint.opacity=.5;
  if(mutation==='empty')row.empty=true;
  assert( !ContractSchema.safeParse(bad).success || solidFillPartTokenError(bad.anatomy.root,tokens),mutation+' must refuse');
 }
});

test('both React surfaces switch bound paint tokens and restore after an empty cell',async()=>{
 const {chromium}=await import('playwright-core');const {PNG}=await import('pngjs');
 const {emitReact}=await import('./emit-react.js');const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');const {mintedTokenCss}=await import('./mint-tokens.js');
 const {tokenInventoryFromJson}=await import('./tokens.js');
 const {c,tokens}=await boundTableFixture();
 const ctx={tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:40,height:40}});
 for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,ctx):emitReactInline(c,{...ctx,tokens});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  await page.addStyleTag({content:mintedTokenCss(tokens.primitives)+'html,body{margin:0;background:transparent}'});
  for(const [paint,expected] of [['first',[31,128,255,255]],['second',[191,128,255,255]],['empty',[0,0,0,0]],['first',[31,128,255,255]]] as const){
   await render({paint});const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
   const i=(10*png.width+10)*4;assert.deepEqual([...png.data.subarray(i,i+4)],expected,surface+' '+paint);
  }
 }
 }finally{await browser.close();}
});

test('live three-cell native readback preserves distinct bindings and truly empty fills',async()=>{
 const {readFileSync}=await import('node:fs');const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {verifyNativePreparedLibraryReadback}=await import('./native-source-observation.js');
 const e=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-scoped/TABLE.json',import.meta.url),'utf8'));
 const graph=createFigmaEngine({tokens:e.tokens,icons:new Map()}).compileNativePreparedLibrary(e.c,new Map([[e.c.id,e.c]]),e.source,e.operation.id);
 assert.deepEqual(JSON.parse(JSON.stringify(graph.components)),e.input.graphComponents);
 assert.equal(verifyNativePreparedLibraryReadback(e.input,e.receipt).status,'supported-structure-observed');
 const empty=e.receipt.nodes.find((n:any)=>n.type==='COMPONENT'&&n.name==='Paint=empty');assert(empty);assert.deepEqual(empty.values.fills,[]);assert.deepEqual(empty.childIds,[]);
 const changed=structuredClone(e.receipt);changed.nodes.find((n:any)=>n.id===empty.id).values.fills=[{type:'SOLID',color:{r:1,g:1,b:1},opacity:1,blendMode:'NORMAL'}];
 assert.notEqual(verifyNativePreparedLibraryReadback(e.input,changed).status,'supported-structure-observed','default white fill must not pass as empty');
});

test('public source paint distinguishes explicit empty from a missing observation',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const a=binding();const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'};
 const dump:any={setName:'Finite paint',type:'COMPONENT_SET',key:'finite-paint',propertyDefinitions:{Paint:{type:'VARIANT',defaultValue:'Bound',variantOptions:['Bound','Empty']}},variants:[
  {name:'Paint=Bound',type:'COMPONENT',variantProperties:{Paint:'Bound'},bbox:{width:20,height:20},layout,sourceFillComposition:{paint:a.paint,variableId:a.variableId},variableConsumers:{[a.variableId]:a.consumer}},
  {name:'Paint=Empty',type:'COMPONENT',variantProperties:{Paint:'Empty'},bbox:{width:20,height:20},layout,sourceEmptyFill:true},
 ]};
 const opts={fileKey:'finite-paint-file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
 const proposed:any=proposeFromDump(dump,opts).contract;
 assert.equal(proposed.anatomy.root.solidFillCompositionByCombination.rows.find((r:any)=>r.values[0]==='empty').empty,true);
 delete dump.variants[1].sourceEmptyFill;
 assert.throws(()=>proposeFromDump(dump,opts),/source-occurrence-unqualified/);
});

test('bound instance paint selects caller tokens without recoloring sibling defaults on either React surface',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {emitReact}=await import('./emit-react.js');const {emitReactInline}=await import('./emit-react-inline.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {mintedTokenCss}=await import('./mint-tokens.js');const {tokenInventoryFromJson}=await import('./tokens.js');
 const {chromium}=await import('playwright-core');const {PNG}=await import('pngjs');
 const {c,tokens}=await boundTableFixture();
 const child=structuredClone(c);child.id='test.paint-child';child.name='PaintChild';child.props=[];
 child.bindings.code.anchors={importPath:'./PaintChild',export:'PaintChild'};
 child.anatomy={root:{literals:{width:'20px',height:'20px'},solidFillComposition:{color:{r:0,g:1,b:0},opacity:1,blendMode:'NORMAL'}}};
 child.anatomy.root.parts={foreground:{declared:{position:'absolute'},literals:{left:'0px',top:'0px',width:'2px',height:'2px','background-color':'#ff0000'}}};
 const table=c.anatomy.root.solidFillCompositionByCombination;
 for(const row of table.rows)if(row.token){row.paint.blendMode='MULTIPLY';row.sourceBinding.binding.paint.blendMode='MULTIPLY';}
 c.anatomy={root:{layout:{display:'flex',direction:'row'},parts:{usage:{component:{id:child.id},solidFillCompositionByCombination:table},sibling:{component:{id:child.id}}}}};
 ContractSchema.parse(c);ContractSchema.parse(child);
 const ctx={tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c],[child.id,child]])};
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,ctx.contracts),/bound-instance-paint-native-unqualified/);
 const browser=await chromium.launch();try{
 for(const receiver of ['literal','empty-cell'])for(const surface of ['module','inline']){
  if(receiver==='empty-cell'){
   child.props=structuredClone(c.props);
   child.anatomy.root.solidFillCompositionByCombination={props:['paint'],rows:[{values:['first'],paint:{color:{r:0,g:1,b:0},opacity:1,blendMode:'NORMAL'}},{values:['second'],paint:{color:{r:0,g:1,b:0},opacity:1,blendMode:'NORMAL'}},{values:['empty'],paint:{color:{r:0,g:0,b:0},opacity:0,blendMode:'NORMAL'},empty:true}]};
   delete child.anatomy.root.solidFillComposition;
   c.anatomy.root.parts.usage.component.props={paint:'empty'};
  }
  const emit=(contract:any)=>surface==='module'?emitReact(contract,ctx):emitReactInline(contract,{...ctx,tokens});
  const out=emit(c),dep=emit(child);
  assert.deepEqual(generatedTypeErrors(c.name,out.tsx,{PaintChild:dep.tsx}),[]);
  const page=await browser.newPage({viewport:{width:60,height:40}});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'',{PaintChild:{tsx:dep.tsx,css:'css'in dep?String(dep.css):''}});
  await page.addStyleTag({content:mintedTokenCss(tokens.primitives)+'html,body{margin:0;background:transparent}'});
  for(const [paint,expected] of [['first',[31,128,255,255]],['second',[191,128,255,255]],['empty',[0,0,0,0]],['first',[31,128,255,255]]] as const){
   await render({paint});const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
   const pixel=(x:number)=>[...png.data.subarray((10*png.width+x)*4,(10*png.width+x)*4+4)];
   assert.deepEqual(pixel(10),expected,surface+' '+paint);assert.deepEqual(pixel(30),[0,255,0,255],surface+' sibling default');
  }
  await page.addStyleTag({content:'body{background:#000}'});await render({paint:'first'});
  const black=PNG.sync.read(await page.locator('#root > *').screenshot());
  assert.deepEqual([...black.data.subarray((10*black.width+10)*4,(10*black.width+10)*4+4)],[0,0,0,255],surface+' multiply backdrop');
  assert.deepEqual([...black.data.subarray((black.width+1)*4,(black.width+1)*4+4)],[255,0,0,255],surface+' foreground must not blend');
  await page.close();
 }
 }finally{await browser.close();}
 const bad=structuredClone(c);bad.anatomy.root.parts.usage.solidFillCompositionByCombination.rows[0].token='wrong.token';
 assert.throws(()=>emitReact(bad,ctx),/source-disagreement/);
});

test('NORMAL bound instance paint uses the declared root background input and rejects MULTIPLY there',async()=>{
 const {emitReact}=await import('./emit-react.js');const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');const {mintedTokenCss}=await import('./mint-tokens.js');const {tokenInventoryFromJson}=await import('./tokens.js');
 const {chromium}=await import('playwright-core');
 const {c,tokens}=await boundTableFixture(),child=structuredClone(c);
 child.id='test.direct-child';child.name='DirectChild';child.props=[];child.bindings.code.anchors={importPath:'./DirectChild',export:'DirectChild'};
 child.anatomy={root:{instanceRootInputs:['background-color'],literals:{width:'20px',height:'20px','background-color':'#00ff00'}}};
 const row=c.anatomy.root.solidFillCompositionByCombination.rows[0];
 c.anatomy={root:{parts:{usage:{component:{id:child.id},solidFillComposition:row.paint,solidFillCompositionToken:row.token,solidFillCompositionSourceBinding:[row.sourceBinding]}}}};
 const ctx={tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c],[child.id,child]])};
 const browser=await chromium.launch();try{
 for(const surface of ['module','inline']){
  const emit=(contract:any)=>surface==='module'?emitReact(contract,ctx):emitReactInline(contract,{...ctx,tokens});
  const out=emit(c),dep=emit(child),page=await browser.newPage();
  await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'',{DirectChild:{tsx:dep.tsx,css:'css'in dep?String(dep.css):''}});
  await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
  assert.equal(await page.locator('#root > * > *').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(31, 128, 255)');
  await page.close();
 }
 }finally{await browser.close();}
 const bad=structuredClone(c),part=bad.anatomy.root.parts.usage;part.solidFillComposition.blendMode='MULTIPLY';part.solidFillCompositionSourceBinding[0].binding.paint.blendMode='MULTIPLY';
 assert.throws(()=>emitReact(bad,ctx),/instance-root-unqualified/);
});


test('native paint disagreement is retained separately from a strictly validated variable graph',async()=>{
 const {readFileSync}=await import('node:fs');
 const {inspectSolidFillColorBinding}=await import('../packages/schema/src/solid-fill-binding.js');
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/binding-disagreement.json',import.meta.url),'utf8'));
 let matched=0,conflicts=0;
 for(const row of fixture.rows){
  const before=JSON.stringify(row),result=inspectSolidFillColorBinding(row.observation,row.consumers);
  if(result.kind==='matched'){matched++;assert.equal(row.name,'Status=Failed');}
  else{
   conflicts++;assert.equal(result.bindingRecreated,false);
   assert.equal(result.observedPaint.opacity,1);
   assert.equal(result.resolvedBinding.paint.opacity,Math.fround(.00001));
   assert.throws(()=>qualifySolidFillColorBinding(row.observation,row.consumers),/paint-consumer-disagreement/);
  }
  assert.equal(JSON.stringify(row),before);
 }
 assert.equal(matched,1);assert.equal(conflicts,5);
 const source=fixture.rows[1],id=source.observation.variableId;
 for(const fault of ['missing','terminal','alias','mode','non-native','type']){
  const row=structuredClone(source);
  if(fault==='missing')delete row.consumers[id];
  if(fault==='terminal')row.consumers[id].selectedValue.a=1;
  if(fault==='alias')row.consumers[id].selectedValue={type:'VARIABLE_ALIAS',id:'absent'};
  if(fault==='mode')row.consumers[id].modeId='';
  if(fault==='non-native')row.observation.paint.opacity=.123456789;
  if(fault==='type')row.consumers[id].resolvedType='FLOAT';
  assert.throws(()=>inspectSolidFillColorBinding(row.observation,row.consumers),error=>error instanceof Error,fault);
 }
 const inspected=inspectSolidFillColorBinding(source.observation,source.consumers);
 assert.equal(inspected.kind,'observed-paint-disagreement');
 if(inspected.kind==='observed-paint-disagreement')inspected.resolvedBinding.consumer.name='edited';
 assert.equal(source.consumers[id].name,'Transparent','returned evidence is independent of the input');
});

test('both React surfaces render retained literal opacity instead of conflicting variable alpha',async t=>{
 const {readFileSync}=await import('node:fs');
 const {chromium}=await import('playwright-core');
 const {PNG}=await import('pngjs');
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {inspectSolidFillColorBinding}=await import('../packages/schema/src/solid-fill-binding.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/binding-disagreement.json',import.meta.url),'utf8')).rows[1];
 const inspected=inspectSolidFillColorBinding(source.observation,source.consumers);
 assert.equal(inspected.kind,'observed-paint-disagreement');if(inspected.kind!=='observed-paint-disagreement')throw Error('fixture must disagree');
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 base.anatomy={root:{literals:{width:'16px',height:'16px'},solidFillComposition:inspected.observedPaint,
  solidFillCompositionObservedBinding:[{owner:'root',nodeName:source.name,variantName:source.name,
   observedPaint:inspected.observedPaint,resolvedBinding:inspected.resolvedBinding,bindingRecreated:false}]}};
 const c=ContractSchema.parse(base),browser=await chromium.launch();t.after(()=>browser.close());
 const context={contracts:new Map([[c.id,c]]),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,context),page=await browser.newPage();
  const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  await render({});
  const image=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
  assert.deepEqual([image.width,image.height],[16,16]);
  assert.deepEqual([...image.data.subarray(0,4)],[255,255,255,255],'matches the opaque native source corner; does not use the near-transparent variable');
  await page.close();
 }
});
