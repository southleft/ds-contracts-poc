import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {SolidFillCompositionSchema, solidFillCompositionCss, solidFillCompositionPaint} from '../packages/schema/src/solid-fill-composition.js';

test('paint composition refuses unsupported, rounded and nonfinite source facts',()=>{
 const paint={color:{r:1,g:1,b:1},opacity:0.5,blendMode:'MULTIPLY'};
 for(const change of [{opacity:NaN},{opacity:Infinity},{opacity:-1},{opacity:1.1},{opacity:.00001},{blendMode:'SCREEN'},{color:{r:1,g:0,b:2}},{nodeOpacity:1}])
  assert.equal(SolidFillCompositionSchema.safeParse({...paint,...change}).success,false);
 const tiny=SolidFillCompositionSchema.parse({...paint,opacity:Math.fround(.00001)});
 assert.equal(solidFillCompositionPaint(tiny).opacity,Math.fround(.00001));
 assert.notEqual(solidFillCompositionPaint(tiny).opacity,0);
 assert.notEqual(solidFillCompositionPaint(tiny).opacity,.00001);
});

test('typed paint lowering matches every independent native control; whole-node blending is rejected by the oracle',async()=>{
 const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/SOURCE.json',import.meta.url),'utf8'));
 assert.equal(source.rows.length,24);
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 let exact=0,wrongWholeNode=0;
 try{for(const row of source.rows){
  const bytes=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);
  const native=PNG.sync.read(bytes),paint=SolidFillCompositionSchema.parse(row.composition),css=solidFillCompositionCss(paint);
  const nativeFill=solidFillCompositionPaint(paint);assert.deepEqual(nativeFill,{type:'SOLID',...row.composition});
  const backdrop=row.backdrop==='transparent'?'transparent':row.backdrop;
  const style=Object.entries(css).map(([key,value])=>key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+value).join(';');
  for(const wholeNode of [false,true]){
   const body=wholeNode?`<div id="wrapper" style="background:${css.backgroundColor};mix-blend-mode:${css.mixBlendMode}"><div id="ink"></div></div>`:`<div id="wrapper"><div aria-hidden="true" style="${style}"></div><div id="ink"></div></div>`;
   await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;background:transparent}#cell{width:20px;height:20px;background:${backdrop}}#wrapper{position:relative;width:20px;height:20px}#ink{position:absolute;left:6px;top:6px;width:8px;height:8px;background:rgb(128,128,128)}</style><div id="cell">${body}</div>`);
   const actual=PNG.sync.read(await page.locator('#cell').screenshot({omitBackground:true,animations:'disabled'}));
   assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);
   if(!wholeNode){assert.deepEqual(actual.data,native.data,row.cellId+' '+row.backdrop);exact++;}
   else if(!actual.data.equals(native.data))wrongWholeNode++;
  }
 }}finally{await browser.close();}
 assert.equal(exact,24);assert.equal(wrongWholeNode,8);
});

test('real shared CSS generator carries qualified literal paint through strict schema',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {generateCss}=await import('../packages/core/src/css.js');
 const {validateContract}=await import('../packages/core/src/validate.js');
 const template=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 template.props=[];template.states=[];template.semantics={element:'div'};
 template.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'#808080'},declared:{position:'absolute'}}}}};
 assert.equal(ContractSchema.safeParse(template).success,true,'the ordinary baseline contract is valid');
 const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/SOURCE.json',import.meta.url),'utf8'));
 const colored=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/COLORED-SOURCE.json',import.meta.url),'utf8'));
 assert.equal(colored.rows.length,72);source.rows.push(...colored.rows);assert.equal(source.rows.length,96);
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 try{for(const row of source.rows){
  const draft=structuredClone(template);draft.anatomy.root.solidFillComposition=SolidFillCompositionSchema.parse(row.composition);
  const strict=ContractSchema.safeParse(draft);assert.equal(strict.success,true,'qualified literal fill is accepted by strict PartSchema');
  const boundaryErrors:string[]=[];validateContract(draft,new Map([[draft.id,draft]]),boundaryErrors,new Map());
  assert.deepEqual(boundaryErrors,[],'shared referee accepts the fully qualified literal paint');
  const errors:string[]=[],css=generateCss(draft,new Set(),errors);assert.deepEqual(errors,[]);assert.match(css,/\.root::before/);
  const backdrop=row.backdrop==='transparent'?'transparent':row.backdrop;
  await page.setContent(`<style>html,body{margin:0;background:transparent}#cell{width:20px;height:20px;background:${backdrop}}${css}</style><div id="cell"><div class="root"><span class="ink"></span></div></div>`);
  const actual=PNG.sync.read(await page.locator('#cell').screenshot({omitBackground:true,animations:'disabled'}));
  const nativeBytes=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url));
  assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),row.pngSHA256);
  const native=PNG.sync.read(nativeBytes);
  assert.deepEqual(actual.data,native.data,row.cellId+' real shared CSS');
 }
 }finally{await browser.close();}
 const conflict=structuredClone(template);conflict.anatomy.root.solidFillComposition=source.rows[0].composition;conflict.anatomy.root.literals['background-color']='#ffffff';
 assert.throws(()=>generateCss(conflict,new Set(),[]),/solid-fill-composition-competing-or-unqualified-paint/);
 delete conflict.anatomy.root.literals['background-color'];delete conflict.anatomy.root.parts.ink.declared.position;
 assert.throws(()=>generateCss(conflict,new Set(),[]),/solid-fill-composition-child-stacking-unqualified/);
 const hitArea=structuredClone(template);hitArea.anatomy.root.solidFillComposition=source.rows[0].composition;hitArea.a11y={...hitArea.a11y,minHitArea:44};
 assert.throws(()=>generateCss(hitArea,new Set(),[]),/solid-fill-composition-pseudo-element-collision/);
 const statePaint=structuredClone(template);statePaint.anatomy.root.solidFillComposition=source.rows[0].composition;statePaint.anatomy.root.states={disabled:{'background-color':'{paint.disabled}'}};
 assert.throws(()=>generateCss(statePaint,new Set(),[]),/solid-fill-composition-competing-or-unqualified-paint/);
 const voidRoot=structuredClone(template);voidRoot.anatomy.root.solidFillComposition=source.rows[0].composition;voidRoot.semantics.element='input';
 assert.throws(()=>generateCss(voidRoot,new Set(),[]),/solid-fill-composition-void-element-unqualified/);
});


test('actual generated inline React preserves every native paint control while the public emitter refuses draft input',async()=>{
 const {emitReactInline,emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const template=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 template.props=[];template.states=[];template.semantics={element:'div'};
 template.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'#808080'},declared:{position:'absolute'}}}}};
 const rows=['SOURCE.json','COLORED-SOURCE.json'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+file,import.meta.url),'utf8')).rows);
 assert.equal(rows.length,96);
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 try{for(const surface of ['root','nested','multi-root'])for(const [index,row] of rows.entries()){
  const contract=structuredClone(template);contract.anatomy.root.solidFillComposition=row.composition;
  if(surface==='nested')contract.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{wrapper:{...contract.anatomy.root,literals:{...contract.anatomy.root.literals,left:'0px',top:'0px'},declared:{position:'absolute'}}}}};
  if(surface==='multi-root')contract.anatomy={wrapper:contract.anatomy.root,empty:{literals:{width:'0px',height:'0px'}}};
  const ctx={tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])};
  assert.deepEqual(emitReactInline(contract,ctx),emitReactInlineDraftPaintQualification(contract,ctx));
  const output=emitReactInlineDraftPaintQualification(contract,ctx);
  if(index===0)assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
  assert.match(output.tsx,/data-dsc-paint-layer/);
  await mountGenerated(page,contract.name,output.tsx);
  await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.backdrop}}`});
  assert.equal(await page.locator('[data-dsc-paint-layer]').count(),1);
  const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));
  const bytes=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);
  const native=PNG.sync.read(bytes);assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);
  assert.deepEqual(actual.data,native.data,row.cellId+' generated inline React '+surface);
 }
 }finally{await browser.close();}
});


test('the actual native compiler carries paint without permitting unfinished public native writes',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {SOLID_FILL_COMPOSITION_NATIVE_RUNTIME}=await import('./solid-fill-composition-native.js');
 const template=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 template.props=[];template.states=[];template.semantics={element:'div'};
 template.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'#808080'},declared:{position:'absolute'}}}}};
 const rows=['SOURCE.json','COLORED-SOURCE.json'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+file,import.meta.url),'utf8')).rows);
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const engine=createFigmaEngine({tokens,icons:new Map(),variableCollection:'Draft paint proof'});
 const write=new Function(SOLID_FILL_COMPOSITION_NATIVE_RUNTIME+';return applySolidFillComposition;')();
 for(const surface of ['root','nested','multi-root'])for(const row of rows){
  const contract=structuredClone(template);contract.anatomy.root.solidFillComposition=row.composition;
  if(surface==='nested')contract.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{wrapper:{...contract.anatomy.root,literals:{...contract.anatomy.root.literals,left:'0px',top:'0px'},declared:{position:'absolute'}}}}};
  if(surface==='multi-root')contract.anatomy={wrapper:contract.anatomy.root,empty:{literals:{width:'0px',height:'0px'}}};
  const scope=new Map([[contract.id,contract]]),data=engine.compileComponentData(contract,scope);
  const painted:any[]=[];const visit=(node:any)=>{if(node.solidFillComposition)painted.push(node);node.children?.forEach(visit);};visit(data.variants[0].spec);assert.equal(painted.length,1,surface);const spec=painted[0];
  assert.deepEqual(spec.solidFillComposition,solidFillCompositionPaint(row.composition));
  assert.equal(engine.buildComponentScript(contract,scope),engine.buildComponentScriptDraftPaintQualification(contract,scope));
  const child={opacity:1,fill:'#808080'},node={fills:[],opacity:1,blendMode:'PASS_THROUGH',children:[child]};
  write(node,spec);assert.deepEqual(node.fills,[solidFillCompositionPaint(row.composition)]);
  assert.equal(node.opacity,1);assert.equal(node.blendMode,'PASS_THROUGH');assert.deepEqual(node.children,[child]);
 }
 assert.throws(()=>write({}, {solidFillComposition:solidFillCompositionPaint(rows[0].composition)}),/solid-fill-composition-native-host-unqualified/);
});


test('live shared native writer readback preserves all 96 independent paint and PNG oracles',async()=>{
 const {SOLID_FILL_COMPOSITION_NATIVE_RUNTIME}=await import('./solid-fill-composition-native.js');
 const proof=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/WRITER-READBACK.json',import.meta.url),'utf8'));
 assert.equal(proof.runtimeSHA256,createHash('sha256').update(SOLID_FILL_COMPOSITION_NATIVE_RUNTIME).digest('hex'),'writer changes require new live readback');
 assert.equal(proof.rows.length,96);assert.equal(new Set(proof.rows.map((row:{sourceCell:string})=>row.sourceCell)).size,96);
 for(const row of proof.rows){
  assert.equal(row.paint.length,1);const paint=row.paint[0];
  assert.deepEqual({type:paint.type,color:paint.color,opacity:paint.opacity,blendMode:paint.blendMode},solidFillCompositionPaint(row.composition));
  assert.equal(paint.visible,true);assert.deepEqual(paint.boundVariables,{});
  assert.equal(row.nodeOpacity,1);assert.equal(row.nodeBlend,'PASS_THROUGH');assert.equal(row.inkOpacity,1);
  assert.deepEqual(row.inkPaint,[{type:'SOLID',visible:true,opacity:1,blendMode:'NORMAL',color:{r:.5,g:.5,b:.5},boundVariables:{}}]);
  const replay=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url));
  const original=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.originalPNG,import.meta.url));
  assert.equal(createHash('sha256').update(replay).digest('hex'),row.pngSHA256);
  assert.equal(createHash('sha256').update(original).digest('hex'),row.originalPNGSHA256);
  const actual=PNG.sync.read(replay),native=PNG.sync.read(original);
  assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);assert.deepEqual(actual.data,native.data,row.sourceCell+' shared native paint writer');
 }
});


test('both actual readers retain composed fill facts and REST no longer rounds tiny paint alpha to zero',async()=>{
 const vm=await import('node:vm');
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const {mapRestToDump,REST_DUMP_VERSION}=await import('../extract/figma/rest/map.js');
 const {PLUGIN_DUMP_VERSION}=await import('../extract/figma/types.js');
 const {proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const rows=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/WRITER-READBACK.json',import.meta.url),'utf8')).rows;
 const variants=rows.map((row:any,index:number)=>({id:'variant-'+index,type:'COMPONENT',name:'Case='+index,variantProperties:{Case:String(index)},size:{x:20,y:20},absoluteBoundingBox:{x:0,y:0,width:20,height:20},fills:[{...row.paint[0],color:{...row.paint[0].color,a:1}}],children:[]}));
 const root={id:'set',name:'PaintObservation',type:'COMPONENT_SET',componentPropertyDefinitions:{Case:{type:'VARIANT' as const,defaultValue:'0',variantOptions:rows.map((_:unknown,index:number)=>String(index))}},children:variants};
 const rest=mapRestToDump({name:'Native source paint matrix',nodes:{set:{document:root}}}).dump as any;
 const {figma:mock}=createFigmaMock();const figma:any=mock;
 const native=rows.map((row:any,index:number)=>{const c=figma.createComponent();c.name='Case='+index;c.resize(20,20);c.fills=structuredClone(row.paint);return c;});
 const set=figma.combineAsVariants(native,figma.currentPage);set.name='PaintObservation';
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["PaintObservation"];');
 const captured=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}\n})()`,{figma,console:{log(){},warn(){},error(){}}})));
 assert.equal(rest._provenance.dumpVersion,REST_DUMP_VERSION);assert.equal(captured._provenance.dumpVersion,PLUGIN_DUMP_VERSION);
 for(const [index,row] of rows.entries()){
  const a=rest.PaintObservation.variants[index],b=captured.PaintObservation.variants[index];
  assert.deepEqual(a.sourceFillComposition,b.sourceFillComposition);
  assert.deepEqual(a.sourceNormalFillComposition,b.sourceNormalFillComposition);
  if(row.composition.blendMode==='NORMAL')assert.deepEqual(a.sourceNormalFillComposition,{paint:row.composition});
  else assert.equal(a.sourceNormalFillComposition,undefined);
  if(row.composition.blendMode==='MULTIPLY')assert.deepEqual(a.sourceFillComposition,{paint:row.composition});
  else assert.equal(a.sourceFillComposition,undefined);
  if(row.composition.opacity<1){assert.equal(a.fill.alpha,row.composition.opacity);assert.equal(b.fill.alpha,row.composition.opacity);}
 }
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true};
 for(const dump of [rest,captured])assert.ok(proposeFromDump(dump.PaintObservation,opts).contract);
 for(const invalid of [null,42,'bad',[]]){const bad={...rest.PaintObservation,variants:[{...rest.PaintObservation.variants[0],sourceFillComposition:invalid}]};assert.throws(()=>proposeFromDump(bad,opts),/figma-source-fill-composition-refused:.*solid-fill-composition-proposal-pipeline-unqualified/);}
});

test('NORMAL text stays in typography while both readers retain non-NORMAL text refusals',async()=>{
 const vm=await import('node:vm');
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const {mapRestToDump}=await import('../extract/figma/rest/map.js');
 const blends=['NORMAL','MULTIPLY','SCREEN'];
 const paint=(blendMode:string)=>({type:'SOLID',color:{r:1,g:1,b:1},opacity:.5,blendMode});
 const children=blends.map((blend,index)=>({id:'text-'+index,type:'TEXT',name:blend,characters:'ink',fills:[{...paint(blend),color:{r:1,g:1,b:1,a:1}}],absoluteBoundingBox:{x:0,y:0,width:20,height:12},style:{fontFamily:'Inter',fontStyle:'Regular',fontSize:12}}));
 const root={id:'set',name:'TextPaintScope',type:'COMPONENT_SET',children:[{id:'variant',name:'Case=0',type:'COMPONENT',fills:[],absoluteBoundingBox:{x:0,y:0,width:20,height:20},children}]};
 const rest=mapRestToDump({name:'Text paint scope',nodes:{set:{document:root}}}).dump as any;
 const {figma:mock}=createFigmaMock();const figma:any=mock;
 const component=figma.createComponent();component.name='Case=0';component.fills=[];
 for(const blend of blends){const text=figma.createText();text.name=blend;text.characters='ink';text.fills=[paint(blend)];component.appendChild(text);}
 const set=figma.combineAsVariants([component],figma.currentPage);set.name='TextPaintScope';
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["TextPaintScope"];');
 const native=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}\n})()`,{figma,console:{log(){},warn(){},error(){}}})));
 for(const dump of [rest,native]){
  const nodes=dump.TextPaintScope.variants[0].children;
  assert.equal(nodes[0].type,'TEXT');assert.equal(nodes[0].sourceNormalFillComposition,undefined);assert.equal(nodes[0].sourceFillComposition,undefined);
  assert.deepEqual(nodes[1].sourceFillComposition,{paint:{color:{r:1,g:1,b:1},opacity:.5,blendMode:'MULTIPLY'}});
  assert.deepEqual(nodes[2].sourceFillComposition,{issue:'solid-fill-composition-source-blend-unqualified'});
 }
});

test('source observation separates variable identity and refuses non-native paint, unsupported blends and stacks',async()=>{
 const {observeSolidFillComposition:observe}=await import('../extract/figma/solid-fill-observation.js');
 const paint={type:'SOLID',color:{r:.25,g:.5,b:.75,a:1},opacity:Math.fround(.00001),blendMode:'MULTIPLY',boundVariables:{color:{type:'VARIABLE_ALIAS',id:'actual-observed-variable-id'}}};
 assert.deepEqual(observe([paint]),{paint:{color:{r:.25,g:.5,b:.75},opacity:paint.opacity,blendMode:'MULTIPLY'},variableId:'actual-observed-variable-id'});
 assert.deepEqual(observe([paint,{...paint,visible:false}]),observe([paint]));
 for(const change of [{opacity:.00001},{opacity:NaN},{color:{...paint.color,a:.5}},{color:{...paint.color,r:.1}},{boundVariables:{color:{id:'ambiguous'}}}])assert.ok(observe([{...paint,...change}])&&'issue' in observe([{...paint,...change}])!);
 assert.deepEqual(observe([{...paint,blendMode:'SCREEN'}]),{issue:'solid-fill-composition-source-blend-unqualified'});
 assert.deepEqual(observe([paint,paint]),{issue:'solid-fill-composition-source-paint-stack-unqualified'});
 assert.equal(observe([{...paint,blendMode:'NORMAL'}]),undefined);
 assert.deepEqual(observe([{...paint,blendMode:'NORMAL'}],true),{paint:{color:{r:.25,g:.5,b:.75},opacity:paint.opacity,blendMode:'NORMAL'},variableId:'actual-observed-variable-id'});
 assert.equal(observe([],true),undefined);
});


test('actual REST reader to occurrence-owned draft proposal to generated React matches independent native paint',async()=>{
 const {mapRestToDump}=await import('../extract/figma/rest/map.js');
 const {proposeFromDumpDraftPaintQualification:propose,proposeFromDump:publicPropose}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const proof=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/WRITER-READBACK.json',import.meta.url),'utf8'));
 const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
 const backdrops=new Map(['SOURCE.json','COLORED-SOURCE.json'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+file,import.meta.url),'utf8')).rows).map((row:any)=>[row.cellId,row.backdrop]));
 const capture=(row:any,nested:boolean)=>{
  const ink={id:'ink',name:'ink',type:'FRAME',size:{x:8,y:8},relativeTransform:[[1,0,6],[0,1,6]],absoluteBoundingBox:{x:6,y:6,width:8,height:8},fills:[{type:'SOLID',color:{r:.5,g:.5,b:.5,a:1}}],children:[]};
  const wrapper={id:'wrapper',name:'Wrapper',type:'FRAME',size:{x:20,y:20},relativeTransform:[[1,0,0],[0,1,0]],absoluteBoundingBox:{x:0,y:0,width:20,height:20},fills:[{...row.paint[0],color:{...row.paint[0].color,a:1}}],children:[ink]};
  const variant={...wrapper,id:'variant',name:'Case=A',type:'COMPONENT',variantProperties:{Case:'A'},...(nested?{fills:[],children:[wrapper]}:{})};
  const set={id:'set',name:'PaintProof',type:'COMPONENT_SET',componentPropertyDefinitions:{Case:{type:'VARIANT' as const,defaultValue:'A',variantOptions:['A']}},children:[variant]};
  return (mapRestToDump({name:'Actual native paint facts',nodes:{set:{document:set}}}).dump as any).PaintProof;
 };
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 try{for(const nested of [false,true])for(const [index,row] of proof.rows.entries()){
  const dump=capture(row,nested),before=JSON.stringify(dump);
  const proposal=propose(dump,{corpus,contractIdByName:new Map(),mintUnbound:true});
  assert.equal(JSON.stringify(dump),before,'draft proposal does not mutate source capture');
  const contract=proposal.contract as any;
  const carried=row.composition.blendMode==='MULTIPLY'||!nested;
  if(!nested && row.composition.blendMode==='NORMAL') {
   const publicResult=publicPropose(dump,{corpus,contractIdByName:new Map(),mintUnbound:true});
   assert.equal((publicResult.contract as any).anatomy.root.solidFillComposition,undefined,'public NORMAL import retains its existing route');
  }
  const owners=1+(nested && carried?1:0); // The independently captured empty root also has a paint owner.
  assert.deepEqual(proposal.draftPaintQualification,{sourceOccurrences:owners,partOwners:owners,publicPartAccepted:true});
  if(nested)assert(contract.anatomy.root.solidFillCompositionByCombination!.rows.every((row:any)=>row.empty===true && row.paint.opacity===0));
  const owner=nested?contract.anatomy.root.parts.Wrapper:contract.anatomy.root;
  if(carried){
   assert.deepEqual(owner.solidFillComposition,row.composition);
   assert.equal(owner.tokens?.['background-color'],undefined);
   assert.equal(ContractSchema.safeParse(contract).success,true,'public literal Part accepts qualified composition');
   assert.ok(proposal.notes.some(note=>note.includes('actual merged occurrence owner')));
  }else assert.equal(ContractSchema.safeParse(contract).success,true);
  const tokens={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
  const output=emitReactInlineDraftPaintQualification(contract,{tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])});
  if(index===0)assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
  await mountGenerated(page,contract.name,output.tsx);
  await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${backdrops.get(row.sourceCell)}}`});
  const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));
  const native=PNG.sync.read(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.originalPNG,import.meta.url)));
  assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);
  assert.deepEqual(actual.data,native.data,row.sourceCell+' reader/proposal/inline '+(nested?'nested':'root'));
 }
 }finally{await browser.close();}
 const first=proof.rows.find((row:any)=>row.composition.blendMode==='MULTIPLY');
 const bound=capture(first,false);bound.variants[0].sourceFillComposition.variableId='observed-binding-id';
 assert.throws(()=>propose(bound,{corpus,contractIdByName:new Map(),mintUnbound:true}),/solid-fill-composition-source-variable-binding-unqualified/);
 const varying=capture(first,false);varying.propertyDefinitions.Case.variantOptions=['A','B'];varying.variants.push({...structuredClone(varying.variants[0]),name:'Case=B',variantProperties:{Case:'B'}});varying.variants[1].sourceFillComposition.paint.opacity=.5;
 const varyingProposal=propose(varying,{corpus,contractIdByName:new Map(),mintUnbound:true});
 assert.deepEqual((varyingProposal.contract as any).anatomy.root.solidFillCompositionByCombination.rows.map((row:any)=>row.paint.opacity),[first.composition.opacity,.5]);
});


test('inferred Figma property bindings avoid strict JavaScript keywords without losing original names or collisions',async()=>{
 const {canonicalPropName,allocateFigmaPropertyNames}=await import('./figma-names.js');
 for(const keyword of ['case','class','default','await','yield','let','eval','arguments','interface','switch','null','true','false'])assert.equal(canonicalPropName(keyword),keyword+'Prop');
 assert.equal(canonicalPropName('Treatment'),'treatment');assert.equal(canonicalPropName('labelText'),'labelText');
 const properties=['Case','case#7:1','Case Prop','Case Prop1'];
 const aliases=allocateFigmaPropertyNames(properties);
 const resolved=properties.map(property=>aliases[property]??canonicalPropName(property));
 assert.equal(new Set(resolved).size,properties.length);
 assert.deepEqual(allocateFigmaPropertyNames([...properties].reverse()),aliases);
});


test('actual two-axis proposals carry every native MULTIPLY cell through inline React, shared CSS and native compilation',()=>qualifyNativePaintCells(false));

test('actual mixed NORMAL and MULTIPLY three-axis proposals carry every native cell through inline React, shared CSS and native compilation',()=>qualifyNativePaintCells(true));

test('draft paint cells use actual boolean values and disabled selectors on both code surfaces',async()=>{
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {generateCss}=await import('../packages/core/src/css.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {emitReact,emitReactDraftPaintQualification}=await import('./emit-react.js');
 const {emitHtml,emitHtmlDraftPaintQualification}=await import('./emit-html.js');
 const template=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/SOURCE.json',import.meta.url),'utf8'));
 const controls=source.rows.filter((row:any)=>row.composition.blendMode==='MULTIPLY' && [0,1].includes(row.composition.opacity));assert.equal(controls.length,6);
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 try{for(const element of ['div','button'])for(const optional of [false,true]){
  const contract=structuredClone(template);contract.states=[];contract.semantics={element};
  contract.props=[{name:'disabled',type:'boolean',...(optional?{}:{default:false}),bindings:{figma:{kind:'VARIANT',property:'Disabled',values:{false:'False',true:'True'}},code:{prop:'disabled'}}}];
  contract.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'#808080'},declared:{position:'absolute'}}},solidFillCompositionByCombination:{props:['disabled'],rows:[0,1].map(alpha=>({values:[String(Boolean(alpha))],paint:controls.find((row:any)=>row.composition.opacity===alpha).composition}))}}};
  const ctx={tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])};
  const output=emitReactInlineDraftPaintQualification(contract,ctx);assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
  const errors:string[]=[],css=generateCss(contract,new Set(),errors,tokens);assert.deepEqual(errors,[]);
  const data=createFigmaEngine({tokens,icons:new Map(),variableCollection:'Boolean paint'}).compileComponentData(contract,ctx.contracts);assert.equal(data.variants.length,2);
  for(const variant of data.variants){assert.ok(variant.spec.solidFillComposition);assert.equal(variant.spec.solidFillComposition.opacity,variant.name==='Disabled=True'?1:0);}
  const emitCtx={tokens:new Set<string>(),tokenValues:tokens,icons:new Map<string,string>(),contracts:ctx.contracts};
  const moduleOutput=emitReactDraftPaintQualification(contract,emitCtx),htmlOutput=emitHtmlDraftPaintQualification(contract,emitCtx);
  assert.deepEqual(emitReact(contract,emitCtx),moduleOutput);assert.deepEqual(emitHtml(contract,emitCtx),htmlOutput);
  assert.deepEqual(generatedTypeErrors(contract.name,moduleOutput.tsx),[]);
  for(const surface of ['inline','css','module','html']){
   if(surface==='inline')await mountGenerated(page,contract.name,output.tsx);
   if(surface==='module')await mountGenerated(page,contract.name,moduleOutput.tsx,moduleOutput.css);
   for(const row of controls){
    const disabled=Boolean(row.composition.opacity);
    if(surface==='inline' || surface==='module'){
     await page.evaluate((value)=>(window as any).renderSubject({disabled:value}),disabled);
     await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.backdrop}}`});
    }else if(surface==='css'){
     const attr=element==='button'?'disabled':'data-disabled';
     await page.setContent(`<style>${css}html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.backdrop}}</style><div id="root"><${element} class="root ${optional?'disabled-'+disabled:''}" ${disabled?attr:''}><span class="ink"></span></${element}></div>`);
    }
    if(surface==='html'){
     await page.setContent(`<style>${htmlOutput.css}html,body{margin:0;background:transparent}</style>${htmlOutput.html}`);
     if(optional)assert.equal(await page.getByText('default',{exact:true}).locator('..').locator(':scope > :last-child').evaluate(node=>getComputedStyle(node,'::before').content),'none','unset optional boolean is not an observed false paint cell');
     const label=disabled?'disabled=true':optional?'disabled=false':'default';
     const markup=await page.getByText(label,{exact:true}).locator('..').locator(':scope > :last-child').evaluate(node=>node.outerHTML);
     await page.setContent(`<style>${htmlOutput.css}html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.backdrop}}</style><div id="root">${markup}</div>`);
    }
    const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'})),native=PNG.sync.read(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url)));
    assert.deepEqual(actual.data,native.data,row.cellId+' boolean '+element+' '+optional+' '+surface);
   }
  }
 }
 }finally{await browser.close();}
});
async function qualifyNativePaintCells(includeNormal:boolean,clipped=false){
 const {mapRestToDump}=await import('../extract/figma/rest/map.js');
 const {proposeFromDump:propose}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {emitReactInline,emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {generateCss}=await import('../packages/core/src/css.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {SolidFillCompositionTableSchema,resolveSolidFillComposition}=await import('../packages/schema/src/solid-fill-composition.js');
 const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const {tokenInventoryFromJson}=await import('../packages/core/src/tokens.js');
 const proof=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/WRITER-READBACK.json',import.meta.url),'utf8'));
 const source=['SOURCE.json','COLORED-SOURCE.json'].flatMap(file=>JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+file,import.meta.url),'utf8')).rows);
 const backdropByCell=new Map(source.map((row:any)=>[row.cellId,row.backdrop]));
 const rows=includeNormal?proof.rows:proof.rows.filter((row:any)=>row.composition.blendMode==='MULTIPLY');assert.equal(rows.length,includeNormal?96:48);
 const colors=[...new Set(rows.map((row:any)=>JSON.stringify(row.composition.color)))];
 const alphas=[...new Set(rows.map((row:any)=>row.composition.opacity))];
 assert.equal(colors.length,4);assert.equal(alphas.length,4);
 const cells=rows.filter((row:any)=>backdropByCell.get(row.sourceCell)==='transparent');assert.equal(cells.length,includeNormal?32:16);
 const values=(row:any)=>({tint:`tint${colors.indexOf(JSON.stringify(row.composition.color))}`,coverage:`level${alphas.indexOf(row.composition.opacity)}`,composition:row.composition.blendMode.toLowerCase()});
 const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 try{for(const nested of [false,true]){
  const children=cells.map((row:any,index:number)=>{
   const v=values(row),name=`Tint=Tint${colors.indexOf(JSON.stringify(row.composition.color))}, Coverage=Level${alphas.indexOf(row.composition.opacity)}${includeNormal?`, Composition=${row.composition.blendMode}`:''}`;
   const ink={id:`ink${index}`,name:'ink',type:'FRAME',size:{x:8,y:8},relativeTransform:[[1,0,6],[0,1,6]],absoluteBoundingBox:{x:6,y:6,width:8,height:8},fills:[{type:'SOLID',color:{r:.5,g:.5,b:.5,a:1}}],children:[]};
   const wrapper={id:`wrapper${index}`,name:'Wrapper',type:'FRAME',...(clipped?{clipsContent:true}:{}),size:{x:20,y:20},relativeTransform:[[1,0,0],[0,1,0]],absoluteBoundingBox:{x:0,y:0,width:20,height:20},fills:[{...row.paint[0],color:{...row.paint[0].color,a:1}}],children:[ink]};
   return {...wrapper,id:`variant${index}`,name,type:'COMPONENT',variantProperties:{Tint:v.tint,Coverage:v.coverage,...(includeNormal?{Composition:row.composition.blendMode}:{})},...(nested?{fills:[],children:[wrapper]}:{})};
  });
  const set={id:'set',name:'VariantPaintProof',type:'COMPONENT_SET',componentPropertyDefinitions:{Tint:{type:'VARIANT' as const,defaultValue:'Tint0',variantOptions:colors.map((_,i)=>`Tint${i}`)},Coverage:{type:'VARIANT' as const,defaultValue:'Level0',variantOptions:alphas.map((_,i)=>`Level${i}`)},...(includeNormal?{Composition:{type:'VARIANT' as const,defaultValue:'NORMAL',variantOptions:['NORMAL','MULTIPLY']}}:{})},children};
  const dump=(mapRestToDump({name:'Native cells',nodes:{set:{document:set}}}).dump as any).VariantPaintProof,before=JSON.stringify(dump);
  const proposal=propose(dump,{corpus,contractIdByName:new Map(),mintUnbound:true}),contract=proposal.contract as any;
  assert.equal(JSON.stringify(dump),before);
  if(includeNormal){
  const sourceOwner=(v:any)=>nested?v.children[0]:v;
  const normal=dump.variants.map(sourceOwner).find((v:any)=>v.sourceNormalFillComposition);
  assert.ok(normal);const bound=structuredClone(dump);bound.variants.map(sourceOwner).find((v:any)=>v.sourceNormalFillComposition).sourceNormalFillComposition.variableId='observed-normal-peer-binding';
  assert.throws(()=>propose(bound,{corpus,contractIdByName:new Map(),mintUnbound:true}),/solid-fill-composition-source-variable-binding-unqualified/);
  const missing=structuredClone(dump);delete missing.variants.map(sourceOwner).find((v:any)=>v.sourceNormalFillComposition).sourceNormalFillComposition;
  assert.throws(()=>propose(missing,{corpus,contractIdByName:new Map(),mintUnbound:true}),/solid-fill-composition-source-occurrence-unqualified/);
  }
  const owner=nested?contract.anatomy.root.parts.Wrapper:contract.anatomy.root,table=owner.solidFillCompositionByCombination;
  assert.equal(owner.solidFillComposition,undefined);assert.equal(table.rows.length,includeNormal?32:16);assert.deepEqual(table.props,includeNormal?['tint','coverage','composition']:['tint','coverage']);
  assert.equal(proposal.draftPaintQualification,undefined,'public proposal carries paint in the strict contract');
  assert.equal(ContractSchema.safeParse(contract).success,true);
  const tokens={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},ctx={tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])};
  assert.deepEqual(emitReactInline(contract,ctx),emitReactInlineDraftPaintQualification(contract,ctx));
  const output=emitReactInlineDraftPaintQualification(contract,ctx);assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
  const cssErrors:string[]=[];const css=emitTokensCss(tokensCssLayers(tokens)).css+generateCss(contract,tokenInventoryFromJson([tokens.primitives]),cssErrors,tokens);assert.deepEqual(cssErrors,[]);assert.match(css,/:where/);
  const engine=createFigmaEngine({tokens,icons:new Map(),variableCollection:'Variant paint qualification'}),compiled=engine.compileComponentData(contract,ctx.contracts);
  const fullScript=engine.buildComponentScriptDraftPaintQualification(contract,ctx.contracts,'byMp6lt0Ij9b2QbkDGFwBh');
  assert.match(fullScript,/await figma.loadAllPagesAsync/);assert.match(fullScript,/function applySolidFillComposition/);assert.match(fullScript,/figma.combineAsVariants/);
  assert.equal(compiled.variants.length,includeNormal?32:16);assert.equal(engine.buildComponentScript(contract,ctx.contracts),engine.buildComponentScriptDraftPaintQualification(contract,ctx.contracts));
  for(const variant of compiled.variants){
   const painted:any[]=[];const visit=(node:any)=>{if(node.solidFillComposition)painted.push(node);node.children?.forEach(visit);};visit(variant.spec);
   assert.equal(painted.length,1);const labels=Object.fromEntries(variant.name.split(', ').map((pair:string)=>pair.split('=')));
   const expected=cells.find((row:any)=>`Tint${colors.indexOf(JSON.stringify(row.composition.color))}`===labels.Tint && `Level${alphas.indexOf(row.composition.opacity)}`===labels.Coverage && (!includeNormal || row.composition.blendMode===labels.Composition));
   assert.ok(expected);assert.deepEqual(painted[0].solidFillComposition,solidFillCompositionPaint(expected.composition));if(clipped)assert.equal(painted[0].clipsContent,true);
  }
  for(const surface of ['inline','css']){
   if(surface==='inline')await mountGenerated(page,contract.name,output.tsx);
   for(const row of rows){
    const v=values(row),backdrop=backdropByCell.get(row.sourceCell);
    if(surface==='inline'){
     await page.evaluate((props:any)=>(window as any).renderSubject(props),v);
     await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${backdrop}}`});
    }else{
     const content=nested?'<div class="Wrapper"><span class="ink"></span></div>':'<span class="ink"></span>';
     await page.setContent(`<style>${css}html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${backdrop}}</style><div id="root"><div class="root tint-${v.tint} coverage-${v.coverage} composition-${v.composition}">${content}</div></div>`);
    }
    const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'})),native=PNG.sync.read(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.originalPNG,import.meta.url)));
    assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);assert.deepEqual(actual.data,native.data,row.sourceCell+(includeNormal?' exact mixed three-axis ':' exact two-axis ')+surface+' '+(nested?'nested':'root'));
   }
  }
  assert.equal(resolveSolidFillComposition(owner,{tint:'neverDrawn',coverage:'level0'}),undefined,'undrawn cell has no paint fallback');
  assert.equal(SolidFillCompositionTableSchema.safeParse({...table,rows:[...table.rows,table.rows[0]]}).success,false);
  assert.equal(SolidFillCompositionTableSchema.safeParse({...table,props:['tint','tint']}).success,false);
  assert.equal(SolidFillCompositionTableSchema.safeParse({...table,rows:[{...table.rows[0],values:['tint0']}]}).success,false);
  const unknown=structuredClone(contract);(nested?unknown.anatomy.root.parts.Wrapper:unknown.anatomy.root).solidFillCompositionByCombination.props[0]='unobservedAxis';
  assert.throws(()=>emitReactInlineDraftPaintQualification(unknown,ctx),/solid-fill-composition-axis-value-unqualified/);
  const conflicting=structuredClone(contract);(nested?conflicting.anatomy.root.parts.Wrapper:conflicting.anatomy.root).solidFillComposition=rows[0].composition;
  assert.throws(()=>emitReactInlineDraftPaintQualification(conflicting,ctx),/solid-fill-composition-base-table-conflict/);
 }
 }finally{await browser.close();}
}

test('live bound paint evidence preserves consuming aliases and normalized alpha without double multiplication',async()=>{
 const {qualifySolidFillColorBinding:qualify}=await import('../extract/figma/solid-fill-binding.js');
 const {observeSolidFillComposition:observe}=await import('../extract/figma/solid-fill-observation.js');
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {proposeFromDumpDraftPaintQualification:propose}=await import('./propose-figma.js');
 const {mapRestToDump}=await import('../extract/figma/rest/map.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const proof=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-binding-native/SOURCE.json',import.meta.url),'utf8'));
 assert.equal(proof.rows.length,32);assert.equal(proof.creation.createdNodeIds.length,69);assert.equal(proof.creation.createdVariableIds.length,12);
 const consumers=(row:any)=>{
  const fields=(hop:any)=>({name:hop.name,collectionId:hop.collectionId,modeId:hop.modeId,modeName:hop.modeName,resolvedType:hop.resolved.resolvedType,value:hop.resolved.value,selectedValue:hop.selectedValue});
  return {[row.carrierId]:{...fields(row.chain[0]),aliasChain:row.chain.slice(1).map((hop:any)=>({id:hop.id,...fields(hop)}))}};
 };
 const template=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 template.props=[];template.states=[];template.semantics={element:'div'};
 template.anatomy={root:{literals:{width:'20px',height:'20px'},parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'#808080'},declared:{position:'absolute'}}}}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});let normalized=0,wrongExact=0;
 try{for(const [index,row] of proof.rows.entries()){
  const evidence=consumers(row),before=JSON.stringify(evidence),observation=observe(row.paint,true)!;
  const qualified=qualify(observation,evidence as any);assert.equal(JSON.stringify(evidence),before);
  assert.equal(qualified.variableId,row.carrierId);assert.deepEqual(qualified.consumer,evidence[row.carrierId]);assert.equal(qualified.consumer.aliasChain!.length,2);
  assert.equal(row.paint[0].blendMode,'NORMAL','bound-paint tool write path normalized even requested MULTIPLY; no MULTIPLY writing qualification claimed');
  assert.equal(qualified.paint.opacity,row.variableAlpha);assert.equal(row.paint[0].opacity,row.chain[0].resolved.value.a);
  if(row.requestedOpacity!==row.paint[0].opacity)normalized++;
  assert.equal(row.nodeOpacity,1);assert.equal(row.nodeBlend,'PASS_THROUGH');assert.deepEqual(row.inkBounds,[6,6,8,8]);
  const bytes=readFileSync(new URL('./fixtures/solid-fill-binding-native/'+row.png,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);const native=PNG.sync.read(bytes);
  const contract=structuredClone(template);contract.anatomy.root.solidFillComposition=qualified.paint;
  const output=emitReactInlineDraftPaintQualification(contract,{tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])});if(index===0)assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
  await mountGenerated(page,contract.name,output.tsx);await page.addStyleTag({content:'html,body{margin:0;background:transparent}#root{width:20px;height:20px}'});
  const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));assert.deepEqual(actual.data,native.data,row.id+' bound native appearance to literal draft React');
  const wrong={...qualified.paint,opacity:Math.fround(qualified.paint.opacity*row.variableAlpha)},css=solidFillCompositionCss(wrong),style=Object.entries(css).map(([key,value])=>`${key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${value}`).join(';');
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><div id="cell" style="position:relative;width:20px;height:20px"><span style="${style}"></span><span style="position:absolute;left:6px;top:6px;width:8px;height:8px;background:#808080"></span></div>`);
  const incorrect=PNG.sync.read(await page.locator('#cell').screenshot({omitBackground:true,animations:'disabled'}));if(incorrect.data.equals(native.data))wrongExact++;
 }}finally{await browser.close();}
 assert.equal(normalized,24);assert.equal(wrongExact,24,'double alpha multiplication fails eight observable cells');
 const row=proof.rows.find((r:any)=>r.variableAlpha===.5),observation=observe(row.paint,true)!,valid=consumers(row);
 for(const mutation of ['missing','alpha','edge','cycle','mode','shape','terminal','null-hop']){
  const data:any=structuredClone(valid),direct=data[row.carrierId];
  if(mutation==='missing')delete data[row.carrierId];
  if(mutation==='alpha')direct.value.a=.25;
  if(mutation==='edge')direct.selectedValue.id='unobserved';
  if(mutation==='cycle')direct.aliasChain[1].id=row.carrierId;
  if(mutation==='mode')direct.aliasChain[0].modeId='unobserved-mode';
  if(mutation==='shape')direct.aliasChain={};
  if(mutation==='terminal')direct.aliasChain[1].selectedValue.a=.25;
  if(mutation==='null-hop')direct.aliasChain[0]=null;
  assert.throws(()=>qualify(observation,data),/solid-fill-composition-source-variable-binding-unqualified/,mutation);
 }
 const ink={id:'ink',name:'ink',type:'FRAME',size:{x:8,y:8},relativeTransform:[[1,0,6],[0,1,6]],absoluteBoundingBox:{x:6,y:6,width:8,height:8},fills:[{type:'SOLID',color:{r:.5,g:.5,b:.5,a:1}}],children:[]};
 const carbon=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-binding-native/CARBON-READONLY.json',import.meta.url),'utf8'));assert.equal(carbon.kitWrites,false);
 const source=carbon.rows[0],identity=source.variable;
 const carbonConsumers={[identity.id]:{name:identity.name,collectionId:identity.collectionId,modeId:identity.modeId,modeName:identity.modeName,resolvedType:source.consumer.resolvedType,value:source.consumer.value,selectedValue:identity.selectedValue}};
 assert.equal(source.paint.blendMode,'MULTIPLY');assert.equal(qualify(observe([source.paint])!,carbonConsumers).variableId,identity.id);
 const variant={id:'variant',name:'Case=A',type:'COMPONENT',variantProperties:{Case:'A'},size:{x:20,y:20},absoluteBoundingBox:{x:0,y:0,width:20,height:20},fills:[{...source.paint,color:{...source.paint.color,a:1}}],children:[ink]};
 const set={id:'set',name:'BoundPaintProof',type:'COMPONENT_SET',componentPropertyDefinitions:{Case:{type:'VARIANT' as const,defaultValue:'A',variantOptions:['A']}},children:[variant]};
 const dump=(mapRestToDump({name:'Native bound facts',nodes:{set:{document:set}}}).dump as any).BoundPaintProof;dump.variants[0].variableConsumers=carbonConsumers;
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
 const before=JSON.stringify(dump),proposal=propose(dump,opts),contract=proposal.contract as any;
 assert.equal(JSON.stringify(dump),before);
 const retained=proposal.draftPaintQualification!.sourceBindings!;
 assert.equal(retained.length,1);assert.equal(retained[0].nodeName,'Case=A');assert.equal(retained[0].variantName,'Case=A');
 assert.deepEqual(retained[0].binding,qualify(observe([source.paint])!,carbonConsumers));
 assert.deepEqual(contract.anatomy.root.solidFillComposition,retained[0].binding.paint);
 const tokenData={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const output=emitReactInlineDraftPaintQualification(contract,{tokens:tokenData,icons:new Map(),contracts:new Map([[contract.id,contract]])});
 assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
 const reference=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/SOURCE.json',import.meta.url),'utf8')).rows.find((r:any)=>r.backdrop==='transparent' && JSON.stringify(r.composition)===JSON.stringify(retained[0].binding.paint));
 assert.ok(reference,'independent native literal oracle matches the exact captured Carbon paint');
 const referenceBytes=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+reference.png,import.meta.url));
 assert.equal(createHash('sha256').update(referenceBytes).digest('hex'),reference.pngSHA256);
 const boundBrowser=await chromium.launch({headless:true}),boundPage=await boundBrowser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 try{
  await mountGenerated(boundPage,contract.name,output.tsx);await boundPage.addStyleTag({content:'html,body{margin:0;background:transparent}#root{width:20px;height:20px}'});
  assert.deepEqual(PNG.sync.read(await boundPage.locator('#root').screenshot({omitBackground:true,animations:'disabled'})).data,PNG.sync.read(referenceBytes).data);
 }finally{await boundBrowser.close();}
 const {ContractSchema}=await import('../scripts/contract-schema.js');assert.equal(ContractSchema.safeParse(contract).success,false,'selected source binding proof remains outside strict public Part');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const nativeEngine=createFigmaEngine({tokens:tokenData,icons:new Map(),variableCollection:'Bound source fence'});
 assert.throws(()=>nativeEngine.compileComponentData(contract,new Map([[contract.id,contract]])),/bound-paint|Invalid input/,'compiler and batch writer cannot drop unfinished source binding evidence');
 delete dump.variants[0].variableConsumers;
 assert.throws(()=>propose(dump,opts),/consumer-missing/,'REST without variable permission never claims captured native binding evidence');
});

test('bound source occurrences retain selected provenance through actual proposal and both forward paint renderers',async()=>{
 const {mapRestToDump}=await import('../extract/figma/rest/map.js');
 const {proposeFromDumpDraftPaintQualification:propose,proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {emitReact,emitReactDraftPaintQualification}=await import('./emit-react.js');
 const {emitHtml,emitHtmlDraftPaintQualification}=await import('./emit-html.js');
 const {generateCss}=await import('../packages/core/src/css.js');
 const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const {tokenInventoryFromJson}=await import('../packages/core/src/tokens.js');
 const {qualifySolidFillColorBinding:qualify}=await import('../extract/figma/solid-fill-binding.js');
 const {observeSolidFillComposition:observe}=await import('../extract/figma/solid-fill-observation.js');
 const proof=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-binding-native/SOURCE.json',import.meta.url),'utf8'));
 const carbon=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-binding-native/CARBON-READONLY.json',import.meta.url),'utf8')).rows[0];
 const fields=(hop:any)=>({name:hop.name,collectionId:hop.collectionId,modeId:hop.modeId,modeName:hop.modeName,resolvedType:hop.resolved.resolvedType,value:hop.resolved.value,selectedValue:hop.selectedValue});
 const rows=proof.rows.map((row:any)=>({paint:row.paint[0],consumers:{[row.carrierId]:{...fields(row.chain[0]),aliasChain:row.chain.slice(1).map((hop:any)=>({id:hop.id,...fields(hop)}))}},png:new URL('./fixtures/solid-fill-binding-native/'+row.png,import.meta.url),hash:row.pngSHA256}));
 const v=carbon.variable;
 const carbonConsumers={[v.id]:{name:v.name,collectionId:v.collectionId,modeId:v.modeId,modeName:v.modeName,resolvedType:carbon.consumer.resolvedType,value:carbon.consumer.value,selectedValue:v.selectedValue}};
 const reference=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/SOURCE.json',import.meta.url),'utf8')).rows.find((r:any)=>r.backdrop==='transparent' && JSON.stringify(r.composition)===JSON.stringify(qualify(observe([carbon.paint])!,carbonConsumers).paint));assert.ok(reference);
 rows.push({paint:carbon.paint,consumers:carbonConsumers,png:new URL('./fixtures/solid-fill-composition-native/'+reference.png,import.meta.url),hash:reference.pngSHA256});
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});let comparisons=0;
 try{for(const nested of [false,true]){
  const variants=rows.map((row:any,i:number)=>{
   const ink={id:`ink${i}`,name:'ink',type:'FRAME',size:{x:8,y:8},relativeTransform:[[1,0,6],[0,1,6]],absoluteBoundingBox:{x:6,y:6,width:8,height:8},fills:[{type:'SOLID',color:{r:.5,g:.5,b:.5,a:1}}],children:[]};
   const wrapper={id:`wrapper${i}`,name:'Wrapper',type:'FRAME',size:{x:20,y:20},relativeTransform:[[1,0,0],[0,1,0]],absoluteBoundingBox:{x:0,y:0,width:20,height:20},fills:[{...row.paint,color:{...row.paint.color,a:1}}],children:[ink]};
   return {...wrapper,id:`variant${i}`,name:`Cell=Cell${i}`,type:'COMPONENT',variantProperties:{Cell:`Cell${i}`},...(nested?{fills:[],children:[wrapper]}:{})};
  });
  const set={id:'set',name:'BoundSourceFamily',type:'COMPONENT_SET',componentPropertyDefinitions:{Cell:{type:'VARIANT' as const,defaultValue:'Cell0',variantOptions:rows.map((_:any,i:number)=>`Cell${i}`)}},children:variants};
  const dump=(mapRestToDump({name:'Independent native source facts',nodes:{set:{document:set}}}).dump as any).BoundSourceFamily;
  const sourceOwner=(variant:any)=>nested?variant.children[0]:variant;
  dump.variants.forEach((variant:any,i:number)=>sourceOwner(variant).variableConsumers=rows[i].consumers);
  const before=JSON.stringify(dump),opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
  assert.throws(()=>proposeFromDump(dump,opts),/solid-fill-binding-tokens-variable-conflict/,'conflicting values for one variable identity remain refused');
  const proposal=propose(dump,opts),contract=proposal.contract as any,receipt=proposal.draftPaintQualification!;
  assert.equal(JSON.stringify(dump),before);assert.equal(receipt.sourceOccurrences,rows.length*(nested?2:1));assert.equal(receipt.sourceBindings!.length,rows.length);
  if(nested){
   const emptyRows=contract.anatomy.root.solidFillCompositionByCombination.rows;
   assert.equal(emptyRows.length,rows.length);
   assert(emptyRows.every((row:any)=>row.empty===true && row.paint.opacity===0 && !row.token && !row.sourceBinding));
  }
  for(const [i,evidence] of receipt.sourceBindings!.entries()){
   assert.equal(evidence.variantName,`Cell=Cell${i}`);assert.equal(evidence.nodeName,nested?'Wrapper':`Cell=Cell${i}`);
   assert.deepEqual(evidence.binding,qualify(observe([rows[i].paint],true)!,rows[i].consumers));
  }
  const tokens={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
  const output=emitReactInlineDraftPaintQualification(contract,{tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])});assert.deepEqual(generatedTypeErrors(contract.name,output.tsx),[]);
  const cssErrors:string[]=[],css=emitTokensCss(tokensCssLayers(tokens)).css+generateCss(contract,tokenInventoryFromJson([tokens.primitives]),cssErrors,tokens);assert.deepEqual(cssErrors,[]);
  const emitCtx={tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[contract.id,contract]])};
  assert.throws(()=>emitReact(contract,emitCtx),/bound-paint|Invalid input/);
  assert.throws(()=>emitHtml(contract,emitCtx),/bound-paint|Invalid input/);
  const moduleOutput=emitReactDraftPaintQualification(contract,emitCtx),htmlOutput=emitHtmlDraftPaintQualification(contract,emitCtx);
  assert.deepEqual(generatedTypeErrors(contract.name,moduleOutput.tsx),[]);
  for(const surface of ['inline','css','module','html']){
   if(surface==='inline')await mountGenerated(page,contract.name,output.tsx);
   if(surface==='module')await mountGenerated(page,contract.name,moduleOutput.tsx,emitTokensCss(tokensCssLayers(tokens)).css+moduleOutput.css);
   if(surface==='html')await page.setContent(`<style>${emitTokensCss(tokensCssLayers(tokens)).css}${htmlOutput.css}html,body{margin:0;background:transparent}</style>${htmlOutput.html}`);
   for(const [i,row] of rows.entries()){
    if(surface==='inline' || surface==='module'){
     await page.evaluate((props:any)=>(window as any).renderSubject(props),{cell:`cell${i}`});await page.addStyleTag({content:'html,body{margin:0;background:transparent}#root{width:20px;height:20px}'});
    }else if(surface==='css'){
     const content=nested?'<div class="Wrapper"><span class="ink"></span></div>':'<span class="ink"></span>';
     await page.setContent(`<style>${css}html,body{margin:0;background:transparent}#root{width:20px;height:20px}</style><div id="root"><div class="root cell-cell${i}">${content}</div></div>`);
    }
    const bytes=readFileSync(row.png);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.hash);
    assert.deepEqual(PNG.sync.read(await page.locator(surface==='html'?`.showcase__item:nth-of-type(${i+1}) > .bound-source-family`:'#root').screenshot({omitBackground:true,animations:'disabled'})).data,PNG.sync.read(bytes).data,`${nested}:${surface}:${i}`);comparisons++;
   }
  }
  const missing=structuredClone(dump);delete sourceOwner(missing.variants[0]).variableConsumers;
  assert.throws(()=>propose(missing,opts),/consumer-missing/,'missing NORMAL peer binding cannot silently fall back');
  const conflicting=structuredClone(dump),first=sourceOwner(conflicting.variants[0]),id=Object.keys(first.variableConsumers)[0];first.variableConsumers[id].modeId='uncaptured-mode';
  assert.throws(()=>propose(conflicting,opts),/alias-mode-conflict/,'selected evidence remains corroborated per consuming occurrence');
 }
 }finally{await browser.close();}
 assert.equal(comparisons,264);
});

test('full canonical desktop writer preserves all native literal paint components and nested child geometry',async()=>{
 const proof=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/FULL-WRITER-READBACK.json',import.meta.url),'utf8'));
 const {SOLID_FILL_COMPOSITION_NATIVE_RUNTIME}=await import('./solid-fill-composition-native.js');
 assert.equal(createHash('sha256').update(SOLID_FILL_COMPOSITION_NATIVE_RUNTIME).digest('hex'),proof.runtimeSHA256);
 assert.equal(proof.rows.length,64);assert.equal(proof.newPages.length,2);assert.equal(proof.createdNodeIds.length,164);assert.equal(new Set(proof.createdNodeIds).size,164);
 assert.equal(proof.rows.filter((row:any)=>row.nested).length,32);assert.equal(proof.fullNativeBindingRecreationQualified,false);assert.equal(proof.kitWrites,false);
 assert.equal(proof.scriptSHA256,'c5bd30ba20be485fcdb41c9697f7181fc525d4669f57d6f78b38d348fde8cc08');
 const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/WRITER-READBACK.json',import.meta.url),'utf8'));
 const ids=new Set<string>();
 for(const row of proof.rows){
  assert.ok(!ids.has(row.id));ids.add(row.id);assert.ok(proof.createdNodeIds.includes(row.id));assert.ok(proof.createdNodeIds.includes(row.ownerId));assert.ok(proof.createdNodeIds.includes(row.ink.id));
  assert.equal(row.width,20);assert.equal(row.height,20);assert.equal(row.nodeOpacity,1);assert.equal(row.nodeBlend,'PASS_THROUGH');
  assert.equal(row.paint.length,1);assert.deepEqual(row.paint[0].boundVariables,{});
  assert.deepEqual({type:row.paint[0].type,color:row.paint[0].color,opacity:row.paint[0].opacity,blendMode:row.paint[0].blendMode},solidFillCompositionPaint(row.composition));
  assert.deepEqual([row.ink.x,row.ink.y,row.ink.width,row.ink.height],[6,6,8,8]);assert.equal(row.ink.fills[0].opacity,1);assert.equal(row.ink.fills[0].blendMode,'NORMAL');
  const original=source.rows.find((r:any)=>r.sourceCell===row.sourceCell);assert.ok(original);assert.deepEqual(original.composition,row.composition);
  const bytes=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url)),oracle=readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.sourcePng,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);assert.equal(createHash('sha256').update(oracle).digest('hex'),row.sourcePngSHA256);
  assert.deepEqual(PNG.sync.read(bytes).data,PNG.sync.read(oracle).data,row.id);
 }
});
test('bound paint aliases preserve equal names across collections but reject same-collection collisions',async()=>{
 const {qualifySolidFillColorBinding:qualify}=await import('../extract/figma/solid-fill-binding.js');
 const value={r:.5,g:.5,b:.5,a:1};
 const paint={color:{r:.5,g:.5,b:.5},opacity:1,blendMode:'MULTIPLY' as const};
 const consumer={name:'tag-background',collectionId:'theme',modeId:'theme-light',modeName:'Light',resolvedType:'COLOR' as const,value,
  selectedValue:{type:'VARIABLE_ALIAS' as const,id:'primitive'},aliasChain:[{id:'primitive',name:'tag-background',collectionId:'palette',modeId:'palette-default',modeName:'Default',resolvedType:'COLOR' as const,value,selectedValue:value}]};
 const original=JSON.stringify(consumer),result=qualify({paint,variableId:'semantic'},{semantic:consumer});
 assert.equal(result.variableId,'semantic');assert.deepEqual(result.consumer,consumer);assert.equal(JSON.stringify(consumer),original);
 const collision=structuredClone(consumer);Object.assign(collision.aliasChain[0],{collectionId:'theme',modeId:'theme-light',modeName:'Light'});
 assert.throws(()=>qualify({paint,variableId:'semantic'},{semantic:collision}),/name-collision/);
 const broken=structuredClone(consumer);broken.selectedValue.id='missing';
 assert.throws(()=>qualify({paint,variableId:'semantic'},{semantic:broken}),/selected-alias-edge/);
});

test('closed-domain bound-paint inspection retains both proofs without granting public or native acceptance',async()=>{
 const {proposeDeclaredDrawnCandidate,proposeDeclaredDrawnDraftPaintCandidate}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const color={r:.5,g:.5,b:.5},value={...color,a:1};
 const declaration=[{Tone:'A',Size:'Small'},{Tone:'A',Size:'Large'},{Tone:'B',Size:'Small'}];
 const set:any={setName:'Bound domain',type:'COMPONENT_SET',propertyDefinitions:{
  Tone:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']}},
  variants:declaration.map(tuple=>({name:`Tone=${tuple.Tone}, Size=${tuple.Size}`,type:'COMPONENT',variantProperties:tuple,
   sourceFillComposition:{paint:{color,opacity:1,blendMode:'MULTIPLY'},variableId:'ink'},
   variableConsumers:{ink:{name:'ink',collectionId:'palette',modeId:'default',modeName:'Default',resolvedType:'COLOR',value,selectedValue:value}},
   layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[]}))};
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true,stampsObservable:true};
 const before=JSON.stringify(set);
 assert.doesNotThrow(()=>proposeDeclaredDrawnCandidate(set,opts,declaration));
 const result=proposeDeclaredDrawnDraftPaintCandidate(set,opts,declaration),contract=result.proposal.contract as any;
 assert.equal(result.acceptedContract,null);assert.equal(result.proposal.draftPaintQualification!.sourceBindings!.length,3);
 assert.equal(contract.bindings.figma.drawnVariants.length,3);assert.equal(JSON.stringify(set),before);
 assert.equal(ContractSchema.safeParse(contract).success,false);
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 assert.throws(()=>engine.compileComponentData(contract,new Map([[contract.id,contract]])),/bound-paint|Invalid input/);
 assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(set,opts,declaration.slice(1)),(error:any)=>error.code==='EXACT_MATRIX_RAGGED');
 const missing=structuredClone(set);delete missing.variants[0].variableConsumers;
 assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(missing,opts,declaration),/consumer-missing/);
 const normal=structuredClone(set);
 for(const node of normal.variants){node.sourceNormalFillComposition={...node.sourceFillComposition,paint:{...node.sourceFillComposition.paint,blendMode:'NORMAL'}};delete node.sourceFillComposition;}
 const normalBefore=JSON.stringify(normal),normalResult=proposeDeclaredDrawnDraftPaintCandidate(normal,opts,declaration);
 const normalContract=normalResult.proposal.contract as any;
 assert.equal(normalContract.anatomy.root.solidFillComposition.blendMode,'NORMAL');
 assert.equal(normalResult.proposal.draftPaintQualification!.sourceBindings!.length,3);
 assert.equal(normalResult.acceptedContract,null);assert.equal(JSON.stringify(normal),normalBefore);
 assert.equal(ContractSchema.safeParse(normalContract).success,false);
 assert.throws(()=>engine.compileComponentData(normalContract,new Map([[normalContract.id,normalContract]])),/bound-paint|Invalid input/);
 delete normal.variants[0].variableConsumers;
 assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(normal,opts,declaration),/consumer-missing/);
});
test('actual shared CSS and inline React preserve independent native composed fills with foreground strokes',async()=>{
 const {generateCss}=await import('../packages/core/src/css.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-stroke-native/SOURCE.json',import.meta.url),'utf8'));
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 let exact=0;
 try{for(const row of source.rows){
  const c=structuredClone(base),color=row.strokeColor;
  c.anatomy={root:{strokesIncludedInLayout:false,solidFillComposition:{color:row.color,opacity:row.opacity,blendMode:row.blend},
   literals:{width:'20px',height:'20px','border-color':`rgb(${color.r*255},${color.g*255},${color.b*255})`,...Object.fromEntries(['top','right','bottom','left'].map((side,i)=>['border-'+side+'-width',row.strokeWidths[i]+'px']))},
   parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'rgb(127.5,127.5,127.5)'},declared:{position:'absolute'}}}}};
  const nativeBytes=readFileSync(new URL('./fixtures/solid-fill-stroke-native/'+row.png,import.meta.url));
  assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),row.pngSHA256);
  const native=PNG.sync.read(nativeBytes),errors:string[]=[],css=generateCss(c,new Set(),errors);assert.deepEqual(errors,[]);
  const output=emitReactInline(c,{tokens,icons:new Map(),contracts:new Map([[c.id,c]])});
  for(const route of ['css','inline']){
   if(route==='css')await page.setContent(`<style>html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}${css}</style><div id="root"><div class="root"><span class="ink"></span></div></div>`);
   else {await mountGenerated(page,c.name,output.tsx);await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}`});}
   const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));
   assert.deepEqual(actual.data,native.data,route+' '+row.png);exact++;
  }
  for(const extra of [{'border-radius':'2px'},{opacity:'.5'},{'box-shadow':'0 0 2px black'}]){
   const bad=structuredClone(c);Object.assign(bad.anatomy.root.literals,extra);
   assert.throws(()=>generateCss(bad,new Set(),[]),/solid-fill-composition-competing-or-unqualified-paint/);
  }
  const leaf=structuredClone(c);delete leaf.anatomy.root.parts;
  const leafErrors:string[]=[],leafCss=generateCss(leaf,new Set(),leafErrors);
  assert.deepEqual(leafErrors,[]);
  assert.match(leafCss,/\.root::before/,'leaf fill retains its independent paint plane');
  assert.match(leafCss,/\.root::after/,'leaf stroke retains its foreground ring');
 }}finally{await browser.close();}
 assert.equal(exact,96);
});
test('generated variant changes preserve both fill and foreground stroke planes',async()=>{
 const {generateCss}=await import('../packages/core/src/css.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const rows=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-stroke-native/SOURCE.json',import.meta.url),'utf8')).rows;
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 const values=rows.map((_:unknown,i:number)=>'s'+i);
 c.props=[{name:'sample',type:{enum:values},default:'s0',bindings:{code:{prop:'sample'},figma:{kind:'VARIANT',property:'Sample',values:Object.fromEntries(values.map((v:string)=>[v,v]))}}}];
 c.states=[];c.semantics={element:'div'};delete c.a11y;
 c.anatomy={root:{strokesIncludedInLayout:false,literals:{width:'20px',height:'20px'},
  solidFillCompositionByCombination:{props:['sample'],rows:rows.map((r:any,i:number)=>({values:[values[i]],paint:{color:r.color,opacity:r.opacity,blendMode:r.blend}}))},
  literalsByCombination:[{props:['sample'],rows:rows.map((r:any,i:number)=>({values:[values[i]],literals:{'border-color':`rgb(${r.strokeColor.r*255},${r.strokeColor.g*255},${r.strokeColor.b*255})`,...Object.fromEntries(['top','right','bottom','left'].map((side,j)=>['border-'+side+'-width',r.strokeWidths[j]+'px']))}}))}],
  parts:{ink:{element:'span',literals:{width:'8px',height:'8px',left:'6px',top:'6px','background-color':'rgb(127.5,127.5,127.5)'},declared:{position:'absolute'}}}}};
 const errors:string[]=[],css=generateCss(c,new Set(),errors);assert.deepEqual(errors,[]);
 const output=emitReactInline(c,{tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),contracts:new Map([[c.id,c]])});
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});
 let exact=0;
 try{for(const route of ['css','inline']){
  if(route==='inline'){await mountGenerated(page,c.name,output.tsx);await page.addStyleTag({content:'html,body{margin:0;background:transparent}#root{width:20px;height:20px}'});}
  // Reverse order also exercises changes away from a nonzero stroke plane.
  for(const i of rows.map((_:unknown,i:number)=>i).reverse()){
   const row=rows[i];
   if(route==='css')await page.setContent(`<style>html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}${css}</style><div id="root"><div class="root sample-${values[i]}"><span class="ink"></span></div></div>`);
   else await page.evaluate(({sample,bg}:any)=>{(window as any).renderSubject({sample});document.getElementById('root')!.style.background=bg;},{sample:values[i],bg:row.bg});
   const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));
   const native=PNG.sync.read(readFileSync(new URL('./fixtures/solid-fill-stroke-native/'+row.png,import.meta.url)));
   assert.deepEqual(actual.data,native.data,route+' '+row.png);exact++;
  }
 }}finally{await browser.close();}
 assert.equal(exact,96);
});
test('normal-flow boxes remain above native composed fills with and without a layout container',async()=>{
 const {generateCss}=await import('../packages/core/src/css.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const {composedFillFlowChild}=await import('../packages/core/src/anatomy.js');
 const rows=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-stroke-native/FLOW-SOURCE.json',import.meta.url),'utf8')).rows;
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});let exact=0;
 try{for(const box of [{},{element:'div'},{element:'div',layout:{display:'flex'}}])for(const row of rows){
  const c=structuredClone(base),color=row.strokeColor;
  c.anatomy={root:{layout:{display:'flex',direction:'row',align:'center',justify:'center'},strokesIncludedInLayout:false,
   solidFillComposition:{color:row.color,opacity:row.opacity,blendMode:row.blend},
   literals:{width:'20px',height:'20px','border-color':`rgb(${color.r*255},${color.g*255},${color.b*255})`,...Object.fromEntries(['top','right','bottom','left'].map((side,i)=>['border-'+side+'-width',row.strokeWidths[i]+'px']))},
   parts:{ink:{...box,literals:{width:'8px',height:'8px','background-color':'rgb(127.5,127.5,127.5)'}}}}};
  const before=JSON.stringify(c),errors:string[]=[],css=generateCss(c,new Set(),errors);assert.deepEqual(errors,[]);
  const output=emitReactInline(c,{tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),contracts:new Map([[c.id,c]])});
  assert.equal(JSON.stringify(c),before,'rendering must not rewrite the contract');
  const bytes=readFileSync(new URL('./fixtures/solid-fill-stroke-native/'+row.png,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);const native=PNG.sync.read(bytes);
  for(const route of ['css','inline']){
   if(route==='css')await page.setContent(`<style>html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}${css}</style><div id="root"><div class="root"><div class="ink"></div></div></div>`);
   else{await mountGenerated(page,c.name,output.tsx);await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}`});}
   const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));assert.deepEqual(actual.data,native.data,route+' '+row.png);exact++;
  }
  const child=c.anatomy.root.parts.ink;
  for(const changed of [{...child,declared:{position:'static'}},{...child,literals:{...child.literals,left:'2px'}},{...child,stylesWhen:[{prop:'enabled',styles:{position:'absolute'}}]},{...child,tokensByCombination:[{props:['state'],rows:[{values:['active'],tokens:{top:'{spacing.offset}'}}]}]}])assert.equal(composedFillFlowChild(changed),false);
  const positioned=structuredClone(c);positioned.anatomy.root.parts.ink.declared={position:'absolute'};positioned.anatomy.root.parts.ink.literals.left='6px';
  assert.equal(composedFillFlowChild(positioned.anatomy.root.parts.ink),false);
  const authored=generateCss(positioned,new Set(),[]);assert.match(authored,/position: absolute/);
  const bad=structuredClone(c);bad.anatomy.root.parts.ink.declared={position:'static'};
  assert.throws(()=>generateCss(bad,new Set(),[]),/child-stacking-unqualified/);
 }}finally{await browser.close();}assert.equal(exact,144);
});

test('normal-flow filled paths remain above native composed fills without changing their layout',async()=>{
 const {generateCss}=await import('../packages/core/src/css.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const {composedFillFlowChild}=await import('../packages/core/src/anatomy.js');
 const rows=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-stroke-native/FLOW-SOURCE.json',import.meta.url),'utf8')).rows;
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});let exact=0;
 try{for(const row of rows){
  const c=structuredClone(base),color=row.strokeColor;
  c.anatomy={root:{layout:{display:'flex',direction:'row',align:'center',justify:'center',reversePaint:false},strokesIncludedInLayout:false,
   solidFillComposition:{color:row.color,opacity:row.opacity,blendMode:row.blend},
   literals:{width:'20px',height:'20px','border-color':`rgb(${color.r*255},${color.g*255},${color.b*255})`,...Object.fromEntries(['top','right','bottom','left'].map((side,i)=>['border-'+side+'-width',row.strokeWidths[i]+'px']))},
   parts:{ink:{element:'div',shape:{kind:'path',width:8,height:8,paths:[{data:'M 0 0 L 8 0 L 8 8 L 0 8 Z',windingRule:'NONZERO'}]},literals:{width:'8px',height:'8px','background-color':'rgb(127.5,127.5,127.5)'}}}}};
  const before=JSON.stringify(c),errors:string[]=[],css=generateCss(c,new Set(),errors);assert.deepEqual(errors,[]);
  const output=emitReactInline(c,{tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),contracts:new Map([[c.id,c]])});
  assert.equal(JSON.stringify(c),before,'rendering must not rewrite the contract');
  const bytes=readFileSync(new URL('./fixtures/solid-fill-stroke-native/'+row.png,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);const native=PNG.sync.read(bytes);
  for(const route of ['css','inline']){
   if(route==='css')await page.setContent(`<style>html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}${css}</style><div id="root"><div class="root"><div class="ink"></div></div></div>`);
   else{await mountGenerated(page,c.name,output.tsx);await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}`});}
   const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));assert.deepEqual(actual.data,native.data,route+' '+row.png);exact++;
  }
  const child=c.anatomy.root.parts.ink;
  for(const changed of [{...child,shape:{...child.shape,rotation:30}},{...child,shape:{...child.shape,parentViewport:{width:20,height:20,x:6,y:6}}},{...child,declaredStates:{hover:{transform:'scale(2)'}}},{...child,declared:{position:'static'}},{...child,literals:{...child.literals,left:'2px'}},{...child,stylesWhen:[{prop:'enabled',styles:{position:'absolute'}}]},{...child,tokensByCombination:[{props:['state'],rows:[{values:['active'],tokens:{top:'{spacing.offset}'}}]}]}])assert.equal(composedFillFlowChild(changed),false);
  const positioned=structuredClone(c);positioned.anatomy.root.parts.ink.declared={position:'absolute'};positioned.anatomy.root.parts.ink.literals.left='6px';
  assert.equal(composedFillFlowChild(positioned.anatomy.root.parts.ink),false);
  const authored=generateCss(positioned,new Set(),[]);assert.match(authored,/position: absolute/);
  const bad=structuredClone(c);bad.anatomy.root.parts.ink.declared={position:'static'};
  assert.throws(()=>generateCss(bad,new Set(),[]),/child-stacking-unqualified/);
 }}finally{await browser.close();}assert.equal(exact,48);
});

for(const slot of [false,true])test(`${slot?'slot wrappers':'referenced generated roots'} paint above native fills in both actual React emitters`,async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {emitReact}=await import('./emit-react.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const {composedFillReferenceChild,composedFillFlowChild}=await import('../packages/core/src/anatomy.js');
 const rows=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-stroke-native/FLOW-SOURCE.json',import.meta.url),'utf8')).rows;
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const child=structuredClone(base);child.id='ds.paint-child';child.name='PaintChild';
 child.anatomy={root:{layout:{display:'flex'},literals:{width:'8px',height:'8px','background-color':'rgb(127.5,127.5,127.5)'}}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});let exact=0;
 try{for(const [i,row] of rows.entries()){
  const c=structuredClone(base),color=row.strokeColor;
  c.anatomy={root:{layout:{display:'flex',direction:'row',align:'center',justify:'center'},strokesIncludedInLayout:false,
   solidFillComposition:{color:row.color,opacity:row.opacity,blendMode:row.blend},
   literals:{width:'20px',height:'20px','border-color':`rgb(${color.r*255},${color.g*255},${color.b*255})`,...Object.fromEntries(['top','right','bottom','left'].map((side,j)=>['border-'+side+'-width',row.strokeWidths[j]+'px']))},parts:{ink:slot?{layout:{display:'flex'},slot:{name:'children',renderDefault:true,defaultContent:[{id:child.id}]}}:{component:{id:child.id,props:{}}}}}};
  const contracts=new Map([[c.id,c],[child.id,child]]),before=JSON.stringify([c,child]);
  const engine=createFigmaEngine({tokens,icons:new Map(),variableCollection:'Referenced paint'});
  const data=engine.compileComponentData(c,contracts);
  assert.equal(data.variants.length,1);
  assert.deepEqual(data.variants[0].spec.solidFillComposition,solidFillCompositionPaint(c.anatomy.root.solidFillComposition));
  const nativeChild=data.variants[0].spec.children?.find(node=>node.name==='ink');
  assert.equal(nativeChild?.type,slot?'slot':'instance');if(slot)assert.equal(nativeChild?.slotDefault?.[0].contractId,child.id);else assert.equal(nativeChild?.depContractId,child.id);
  assert.equal(engine.buildComponentScript(c,contracts),engine.buildComponentScriptDraftPaintQualification(c,contracts));
  const bytes=readFileSync(new URL('./fixtures/solid-fill-stroke-native/'+row.png,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);const native=PNG.sync.read(bytes);
  for(const route of ['css','inline']){
   const emit=(contract:any)=>route==='css'?emitReact(contract,{tokens:new Set(),icons:new Map(),contracts}):emitReactInline(contract,{tokens,icons:new Map(),contracts});
   const output=emit(c),dependency=emit(child);
   if(i===0)assert.deepEqual(generatedTypeErrors(c.name,output.tsx,{[child.name]:dependency.tsx}),[]);
   await mountGenerated(page,c.name,output.tsx,'css' in output?String(output.css):'',{[child.name]:dependency});
   await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.bg}}`});
   const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true,animations:'disabled'}));assert.deepEqual(actual.data,native.data,route+' '+row.png);exact++;
  }
  assert.equal(JSON.stringify([c,child]),before);
  if(slot){assert.equal(composedFillFlowChild(c.anatomy.root.parts.ink),true);assert.equal(composedFillFlowChild({...c.anatomy.root.parts.ink,declared:{position:'absolute'}}),false);}else assert.equal(composedFillReferenceChild(c.anatomy.root.parts.ink),false,'missing child contract refuses');
  for(const change of [{declared:{position:'absolute'}},{declared:{position:'static'}},{literals:{top:'2px'}},{states:{hover:{position:'absolute'}}},{declaredStates:{hover:{position:'absolute'}}},{stylesWhen:[{prop:'enabled',styles:{position:'absolute'}}]}]){
   const bad=structuredClone(child);Object.assign(bad.anatomy.root,change);
   assert.equal(composedFillReferenceChild(c.anatomy.root.parts.ink,new Map([[bad.id,bad]])),false);
  }
 }}finally{await browser.close();}assert.equal(exact,48);
});

test('per-instance fill composition replaces only the referenced root paint on both React and native surfaces',async()=>{
 const {emitReact}=await import('./emit-react.js');
 const {emitReactInline}=await import('./emit-react-inline.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {SOLID_FILL_COMPOSITION_NATIVE_RUNTIME}=await import('./solid-fill-composition-native.js');
 const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const child=structuredClone(base);child.id='ds.paint-child';child.name='PaintChild';
 const defaultPaint={color:{r:1,g:0,b:1},opacity:1,blendMode:'NORMAL' as const};
 const grandchild=structuredClone(base);grandchild.id='ds.paint-ink';grandchild.name='PaintInk';
 grandchild.anatomy={root:{solidFillComposition:{color:{r:Math.fround(128/255),g:Math.fround(128/255),b:Math.fround(128/255)},opacity:1,blendMode:'NORMAL'},literals:{width:'8px',height:'8px'}}};
 child.anatomy={root:{declared:{position:'relative'},layout:{display:'flex',direction:'row',align:'center',justify:'center'},solidFillComposition:defaultPaint,literals:{width:'20px',height:'20px'},parts:{ink:{component:{id:grandchild.id,props:{}}}}}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const rows=JSON.parse(readFileSync(new URL('./fixtures/instance-fill-composition-native/SOURCE.json',import.meta.url),'utf8')).rows;
 const engine=createFigmaEngine({tokens,icons:new Map(),variableCollection:'Instance fill'});
 const write=new Function(SOLID_FILL_COMPOSITION_NATIVE_RUNTIME+';return applySolidFillComposition;')();
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:100,height:100},deviceScaleFactor:1});let exact=0;
 try{for(const mode of ['literal','table'])for(const [i,row] of rows.entries()){
  assert.equal(row.mainId,rows[0].mainId);assert.equal(row.children.length,1);
  assert.deepEqual({color:row.fills[0].color,opacity:row.fills[0].opacity,blendMode:row.fills[0].blendMode},row.composition);
  const c=structuredClone(base);c.name='PaintParent';c.id='ds.paint-parent';
  c.anatomy={root:{layout:{display:'flex',direction:'row'},literals:{width:'40px',height:'20px'},parts:{overridden:{component:{id:child.id,props:{}},solidFillComposition:row.composition},unchanged:{component:{id:child.id,props:{}}}}}};
  if(mode==='table'){
   c.props=[{name:'sample',type:{enum:['paint','default']},default:'paint',bindings:{code:{prop:'sample'},figma:{kind:'VARIANT',property:'Sample',values:{paint:'paint',default:'default'}}}}];
   delete c.anatomy.root.parts.overridden.solidFillComposition;
   c.anatomy.root.parts.overridden.solidFillCompositionByCombination={props:['sample'],rows:[{values:['paint'],paint:row.composition},{values:['default'],paint:defaultPaint}]};
  }
  const contracts=new Map([[c.id,c],[child.id,child],[grandchild.id,grandchild]]),before=JSON.stringify([c,child,grandchild]);
  const data=engine.compileComponentData(c,contracts),spec=data.variants[0].spec.children!.find(n=>n.name==='overridden')!;
  assert.equal(spec.type,'instance');assert.equal(spec.depContractId,child.id);assert.deepEqual(spec.solidFillComposition,solidFillCompositionPaint(row.composition));
  const main={fills:[solidFillCompositionPaint(defaultPaint)]},node={fills:[...main.fills],opacity:1,blendMode:'PASS_THROUGH',children:[{name:'ink'}]};write(node,spec);
  assert.deepEqual(node.fills,[solidFillCompositionPaint(row.composition)]);assert.deepEqual(main.fills,[solidFillCompositionPaint(defaultPaint)]);assert.equal(node.opacity,1);assert.equal(node.blendMode,'PASS_THROUGH');assert.deepEqual(node.children,[{name:'ink'}]);
  for(const route of ['css','inline']){
   const emit=(contract:any)=>route==='css'?emitReact(contract,{tokens:new Set(),icons:new Map(),contracts}):emitReactInline(contract,{tokens,icons:new Map(),contracts});
   const output=emit(c),dependency=emit(child),grandDependency=emit(grandchild);
   if(i===0)assert.deepEqual(generatedTypeErrors(c.name,output.tsx,{[child.name]:dependency.tsx,[grandchild.name]:grandDependency.tsx}),[]);
   const render=await mountGenerated(page,c.name,output.tsx,'css' in output?String(output.css):'',{[child.name]:dependency,[grandchild.name]:grandDependency});
   await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:40px;height:20px;background:${row.backdrop}}`});
   const bytes=readFileSync(new URL('./fixtures/instance-fill-composition-native/'+row.png,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.pngSHA256);
   const actual=PNG.sync.read(await page.screenshot({clip:{x:0,y:0,width:20,height:20},omitBackground:true,animations:'disabled'}));assert.deepEqual(actual.data,PNG.sync.read(bytes).data,route+' '+row.png);exact++;
   const sibling=await page.locator('#root > div > :nth-child(2)').evaluate(el=>{const layer=el.querySelector('[data-dsc-paint-layer]');return getComputedStyle(layer??el,layer?null:'::before').backgroundColor;});
   assert.equal(sibling,'rgb(255, 0, 255)','unmodified sibling retains its own paint');
   if(mode==='table'){await render({sample:'default'});const pixels=PNG.sync.read(await page.screenshot({clip:{x:0,y:0,width:20,height:20},omitBackground:true,animations:'disabled'}));assert.deepEqual(Array.from(pixels.data.subarray(0,4)),[255,0,255,255]);await render({sample:'paint'});const again=PNG.sync.read(await page.screenshot({clip:{x:0,y:0,width:20,height:20},omitBackground:true,animations:'disabled'}));assert.deepEqual(again.data,actual.data);}
  }
  assert.equal(JSON.stringify([c,child,grandchild]),before);
 }}finally{await browser.close();}assert.equal(exact,96);
});

test('instance fill overrides refuse unknown paint owners and competing override channels',async()=>{
 const {solidFillCompositionRules}=await import('../packages/core/src/css.js');
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 const paint={color:{r:1,g:1,b:1},opacity:Math.fround(.00001),blendMode:'MULTIPLY'};
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const child=structuredClone(base);child.id='ds.paint-child';child.anatomy={root:{solidFillComposition:paint,literals:{width:'20px',height:'20px'}}};
 base.anatomy={root:{parts:{use:{component:{id:child.id},solidFillComposition:paint}}}};
 const map=new Map([[child.id,child]]);
 assert.doesNotThrow(()=>solidFillCompositionRules(base,undefined,undefined,map));
 assert.throws(()=>solidFillCompositionRules(base),/instance-root-unqualified/);
 const unpainted=structuredClone(child);delete unpainted.anatomy.root.solidFillComposition;
 assert.throws(()=>solidFillCompositionRules(base,undefined,undefined,new Map([[child.id,unpainted]])),/instance-root-unqualified/);
 for(const change of [{overrides:{'background-color':'{paint.other}'}},{rootOverrides:{opacity:'{opacity.other}'}}]){
  const bad=structuredClone(base);Object.assign(bad.anatomy.root.parts.use.component,change);
  assert.throws(()=>solidFillCompositionRules(bad,undefined,undefined,map),/instance-root-unqualified/);
 }
});

test('NORMAL instance inspection retains changed and unchanged source cells with rounded root paint',async()=>{
 const {proposeFromDumpDraftPaintQualification:propose}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {emitReactDraftPaintQualification}=await import('./emit-react.js');
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const {tokenInventoryFromJson}=await import('./tokens.js');
 const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const paint=(blue:boolean)=>{const color={r:blue?0:1,g:0,b:blue?1:0},value={...color,a:1};return {
  sourceNormalFillComposition:{paint:{color,opacity:1,blendMode:'NORMAL'},variableId:blue?'blue':'red'},
  variableConsumers:{[blue?'blue':'red']:{name:blue?'blue':'red',collectionId:'palette',modeId:'light',modeName:'Light',resolvedType:'COLOR',value,selectedValue:value}},fill:{hex:blue?'0000ff':'ff0000'}}};
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'};
 const child:any={setName:'Paint main',type:'COMPONENT',nodeId:'1:1',key:'main-key',variants:[{name:'Paint main',type:'COMPONENT',nodeId:'1:1',bbox:{width:20,height:20},cornerRadius:6,layout,...paint(false)}]};
 const parent:any={setName:'Paint usage',type:'COMPONENT_SET',nodeId:'2:1',key:'usage-key',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Rest',variantOptions:['Rest','Hover']}},variants:['Rest','Hover'].map((state,i)=>({name:`State=${state}`,type:'COMPONENT',variantProperties:{State:state},layout,bbox:{width:40,height:20},children:[{name:'changed',type:'INSTANCE',nodeId:`use-${i}`,instanceOf:'Paint main',instanceKey:'main-key',bbox:{width:20,height:20},instanceRootOverrides:{nodeId:`use-${i}`,componentId:'1:1',componentKey:'main-key',fields:i?['fills']:[]},...paint(!!i)},{name:'unchanged',type:'INSTANCE',instanceOf:'Paint main',instanceKey:'main-key',bbox:{width:20,height:20},...paint(false)}]}))};
 const before=JSON.stringify({child,parent}),opts:any={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,fileKey:'fixture',stampsObservable:true,contractIdByName:new Map(),contractIdByKey:new Map(),contractsById:new Map()};
 const cp=propose(child,opts),c:any=cp.contract;opts.contractIdByName.set(child.setName,c.id);opts.contractIdByKey.set(child.key,c.id);opts.contractsById.set(c.id,c);
 const pp=propose(parent,opts),p:any=pp.contract;
 assert.equal(pp.draftPaintQualification!.sourceBindings!.length,2);assert.equal(JSON.stringify({child,parent}),before);
 const primitives:any={};const merge=(t:any,s:any)=>{for(const[k,v]of Object.entries(s)){if(v&&typeof v==='object'&&!('$value'in v))merge(t[k]??={},v);else{if(k in t)assert.deepEqual(t[k],v);t[k]=v}}};merge(primitives,cp.mintedTokens!.tree);merge(primitives,pp.mintedTokens!.tree);
 const tokens={primitives,semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c],[p.id,p]]),ctx={tokens:tokenInventoryFromJson([primitives]),tokenValues:tokens,contracts,icons:new Map<string,string>()};
 const browser=await chromium.launch();try{for(const route of ['css','inline']){
  const emit=(x:any)=>route==='css'?emitReactDraftPaintQualification(x,ctx):emitReactInlineDraftPaintQualification(x,{...ctx,tokens});const co=emit(c),po=emit(p);const page=await browser.newPage();
  const render=await mountGenerated(page,p.name,po.tsx,'css'in po?String(po.css):'',{[c.name]:co});await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'body{margin:0}#root{width:40px;height:20px}'});
  for(const state of ['rest','hover','rest']){await render({state});const image=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true}));const rgba=(x:number,y:number)=>Array.from(image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4));assert.deepEqual(rgba(10,10),state==='hover'?[0,0,255,255]:[255,0,0,255]);assert.deepEqual(rgba(30,10),[255,0,0,255],'unchanged sibling retains main paint');assert.deepEqual(rgba(0,0),[0,0,0,0],'fill layer inherits rounded corner');}
  await page.close();
 }}finally{await browser.close()}
 for(const mutate of [(x:any)=>{delete x.variants[0].children[0].variableConsumers},(x:any)=>{delete x.variants[0].children[0].sourceNormalFillComposition}]){const bad=structuredClone(parent);mutate(bad);assert.throws(()=>propose(bad,opts),/consumer-missing|source-occurrence-unqualified/)}
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(p,contracts),/bound-paint|Invalid input/);
});

test('two-axis clipping preserves independent native composed-fill pixels on both React surfaces and native compilation',()=>qualifyNativePaintCells(true,true));

test('bound paint layer matches native MULTIPLY without applying variable alpha twice',async()=>{
 const {solidFillCompositionTokenCss}=await import('../packages/schema/src/solid-fill-composition.js');
 const source=JSON.parse(readFileSync(new URL('./fixtures/bound-multiply-layer-native/SOURCE.json',import.meta.url),'utf8'));
 const bytes=readFileSync(new URL('./fixtures/bound-multiply-layer-native/'+source.png,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),source.pngSHA256);
 const native=PNG.sync.read(bytes);
 const paint={color:{r:.25,g:.5,b:.75},opacity:.5,blendMode:'MULTIPLY' as const};
 for(const path of ['', 'paint;opacity:0', '{paint.alpha}', 'paint..alpha'])assert.throws(()=>solidFillCompositionTokenCss(paint,path),/token-path-invalid/);
 const browser=await chromium.launch();
 try{for(const negative of [false,true]){
  const page=await browser.newPage({viewport:{width:source.width,height:source.height},deviceScaleFactor:1});
  const cells=source.rows.map((row:any)=>{
   assert.equal(row.paint.blendMode,'MULTIPLY');assert.equal(row.resolved.value.a,row.alpha);
   assert.equal(row.paint.fills[0].boundVariables.color.id,row.variableId);
   const styles:Record<string,string|number>={...solidFillCompositionTokenCss({...paint,opacity:row.alpha},'paint.alpha')};
   if(negative)styles.opacity=row.alpha;
   const css=Object.entries(styles).map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${v}`).join(';');
   const b=row.backdrop;
   return `<div style="position:absolute;left:${row.x}px;top:${row.y}px;width:40px;height:40px;background:rgb(${b.r*255},${b.g*255},${b.b*255});--paint-alpha:rgba(63.75,127.5,191.25,${row.alpha})"><i style="${css}"></i><i style="position:absolute;left:12px;top:12px;width:8px;height:8px;background:red"></i></div>`;
  }).join('');
  await page.setContent(`<html><body style="margin:0;background:transparent">${cells}</body></html>`);
  const actual=PNG.sync.read(await page.screenshot({omitBackground:true}));let failures=0;
  for(const row of source.rows){let different=false;
   for(let y=row.y;y<row.y+40;y++)for(let x=row.x;x<row.x+40;x++){const i=(y*source.width+x)*4;if([0,1,2,3].some(k=>actual.data[i+k]!==native.data[i+k]))different=true;}
   if(different)failures++;
   const ink=((row.y+15)*source.width+row.x+15)*4;assert.deepEqual([...actual.data.subarray(ink,ink+4)],[255,0,0,255]);
  }
  assert.equal(failures,negative?2:0,negative?'double-alpha negative control must fail':'every native control must match');
  await page.close();
 }}finally{await browser.close();}
});

test('both generated React surfaces carry internal bound paint without promoting public or native acceptance',async()=>{
 const {emitReact,emitReactDraftPaintQualification}=await import('./emit-react.js');
 const {emitReactInlineDraftPaintQualification}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const source=JSON.parse(readFileSync(new URL('./fixtures/bound-multiply-layer-native/SOURCE.json',import.meta.url),'utf8'));
 const native=PNG.sync.read(readFileSync(new URL('./fixtures/bound-multiply-layer-native/'+source.png,import.meta.url)));
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[];c.states=[];delete c.a11y;c.semantics={element:'div'};
 c.anatomy={root:{literals:{width:'40px',height:'40px'},solidFillComposition:{color:{r:.25,g:.5,b:.75},opacity:1,blendMode:'MULTIPLY'},solidFillCompositionToken:'paint.alpha',parts:{ink:{element:'div',declared:{position:'absolute'},literals:{left:'12px',top:'12px',width:'8px',height:'8px','background-color':'#ff0000'}}}}};
 const parsed=ContractSchema.safeParse(c);assert.equal(parsed.success,false);assert.match(JSON.stringify(parsed),/solidFillCompositionToken/);
 const tokens={primitives:{paint:{alpha:{$type:'color',$value:'rgba(63.75,127.5,191.25,1)'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens:new Set(['paint.alpha']),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[c.id,c]])};
 assert.throws(()=>emitReact(c,ctx));
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]])),/bound-paint|Invalid input/);
 const browser=await chromium.launch();let exact=0;
 try{for(const surface of ['module','inline']){
  const page=await browser.newPage({viewport:{width:40,height:40},deviceScaleFactor:1});
  const out=surface==='module'?emitReactDraftPaintQualification(c,ctx):emitReactInlineDraftPaintQualification(c,{...ctx,tokens});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  for(const row of source.rows){const b=row.backdrop;
   await page.addStyleTag({content:`html,body{margin:0;background:rgb(${b.r*255},${b.g*255},${b.b*255});--paint-alpha:rgba(63.75,127.5,191.25,${row.alpha})}`});
   await render({});const actual=PNG.sync.read(await page.screenshot());
   for(let y=0;y<40;y++)for(let x=0;x<40;x++){const i=(y*40+x)*4,j=((row.y+y)*source.width+row.x+x)*4;assert.deepEqual([...actual.data.subarray(i,i+4)],[...native.data.subarray(j,j+4)],`${surface} ${row.id} ${x},${y}`);}
   exact++;
  }await page.close();
 }}finally{await browser.close();}
 assert.equal(exact,24);
});

test('internal native bound paint runtime keeps layout and content separate and refuses ambiguous reuse',async()=>{
 const {BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME}=await import('./solid-fill-composition-native.js');
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const figma:any=createFigmaMock().figma;
 const apply=new Function('figma',BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME+';return applyBoundSolidFillLayer;')(figma);
 const collection=figma.variables.createVariableCollection('Bound paint test');
 const variable=figma.variables.createVariable('paint',collection,'COLOR');
 variable.setValueForMode(collection.defaultModeId,{r:.25,g:.5,b:.75,a:.5});
 const spec={solidFillComposition:{color:{r:.25,g:.5,b:.75},opacity:.5,blendMode:'MULTIPLY'},solidFillCompositionToken:'paint.alpha'};
 for(const mode of ['NONE','HORIZONTAL','REVERSED']){
  const host=figma.createFrame();host.resize(40,40);host.layoutMode=mode==='NONE'?'NONE':'HORIZONTAL';host.itemReverseZIndex=mode==='REVERSED';host.primaryAxisSizingMode='FIXED';host.counterAxisSizingMode='FIXED';
  const ink=figma.createRectangle();ink.name='content';ink.resize(8,8);host.appendChild(ink);ink.x=12;ink.y=12;
  const layer=apply(host,spec,variable);
  assert.deepEqual(host.children.map((n:any)=>n.id),mode==='REVERSED'?[ink.id,layer.id]:[layer.id,ink.id]);
  assert.deepEqual([host.width,host.height,ink.x,ink.y],[40,40,12,12]);
  assert.equal(layer.opacity,1);assert.equal(layer.blendMode,'MULTIPLY');
  assert.equal(layer.fills[0].boundVariables.color.id,variable.id);
  assert.deepEqual(layer.constraints,{horizontal:'STRETCH',vertical:'STRETCH'});
  if(mode!=='NONE')assert.equal(layer.layoutPositioning,'ABSOLUTE');
  assert.throws(()=>apply(host,spec,variable),/already-present/);assert.equal(host.children.length,2);
 }
 const empty=figma.createFrame();empty.resize(40,40);
 assert.throws(()=>apply(empty,{...spec,solidFillCompositionToken:'bad;path'},variable),/spec-unqualified/);
 assert.throws(()=>apply(empty,spec,{resolvedType:'FLOAT'}),/variable-unqualified/);
 const originalFills=JSON.stringify(empty.fills);
 variable.setValueForMode(collection.defaultModeId,{r:.25,g:.5,b:.75,a:.25});
 assert.throws(()=>apply(empty,spec,variable),/selected-value-disagreement/);
 assert.equal(JSON.stringify(empty.fills),originalFills,'value mismatch must not clear the host paint');
 assert.equal(empty.children.length,0,'value mismatch must not create a receiver');
 empty.layoutMode='GRID';assert.throws(()=>apply(empty,spec,variable),/host-unqualified/);
 assert.equal(empty.children.length,0);
});

test('declared-domain batch inspection preserves ordinary siblings and public refusal',async()=>{
 const {proposeBatchFromDump,proposeDeclaredDrawnBatchCandidate}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const declaration=[{Tone:'A',Size:'Small',Shape:'Round'},{Tone:'B',Size:'Small',Shape:'Round'},{Tone:'A',Size:'Large',Shape:'Square'}];
 const set:any={setName:'Sparse',type:'COMPONENT_SET',propertyDefinitions:{
  Tone:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},Shape:{type:'VARIANT',defaultValue:'Round',variantOptions:['Round','Square']}},
  variants:declaration.map(tuple=>({name:Object.entries(tuple).map(([k,v])=>k+'='+v).join(', '),variantProperties:tuple,type:'COMPONENT',bbox:{width:20,height:20},children:[]}))};
 const sibling={setName:'Sibling',type:'COMPONENT',variants:[{name:'Sibling',type:'COMPONENT',bbox:{width:10,height:10},children:[]}]};
 const dump={_provenance:{stampsObservable:true},Sparse:set,Sibling:sibling},before=JSON.stringify(dump);
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true,stampsObservable:true};
 const ordinary=proposeBatchFromDump(dump,opts);
 assert(ordinary.skipped.some(s=>s.setName==='Sparse'&&s.reason.includes('sparse-matrix-mostly-undrawn')));
 const candidate=proposeDeclaredDrawnBatchCandidate(dump,opts,new Map([['Sparse',declaration]]));
 assert.equal(candidate.acceptedContract,null);
 assert.equal(candidate.batch.skipped.length,0);
 assert.equal((candidate.batch.proposals.find(p=>p.setName==='Sparse')!.contract as any).bindings.figma.drawnVariants.length,3);
 assert.deepEqual(candidate.batch.proposals.find(p=>p.setName==='Sibling'),ordinary.proposals.find(p=>p.setName==='Sibling'));
 assert.equal(JSON.stringify(dump),before);
 assert(proposeBatchFromDump(dump,opts).skipped.some(s=>s.setName==='Sparse'),'inspection must not arm later public imports');
 assert.throws(()=>proposeDeclaredDrawnBatchCandidate(dump,opts,new Map([['Missing',declaration]])),/declaration-set-missing/);
 assert(proposeDeclaredDrawnBatchCandidate(dump,opts,new Map([['Sparse',declaration.slice(1)]])).batch.skipped.some(s=>s.setName==='Sparse'));
 assert(proposeDeclaredDrawnBatchCandidate({...dump,Sparse:{...set,contractId:'authored.sparse'}},opts,new Map([['Sparse',declaration]])).batch.skipped.some(s=>s.reason.includes('source-marked')));
 const guarded=proposeBatchFromDump(dump,{...opts,drawnVariantSurface:'react-runtime'});
 assert.equal(guarded.skipped.length,0);
 assert.deepEqual(guarded.proposals.find(p=>p.setName==='Sparse')!.contract,candidate.batch.proposals.find(p=>p.setName==='Sparse')!.contract);
 assert.deepEqual(guarded.proposals.find(p=>p.setName==='Sibling'),ordinary.proposals.find(p=>p.setName==='Sibling'));
 assert(guarded.proposals.find(p=>p.setName==='Sparse')!.notes.some(n=>n.includes('DRAWN_VARIANT_UNDECLARED')));
 assert(proposeBatchFromDump({...dump,_provenance:{}},{...opts,stampsObservable:false,drawnVariantSurface:'react-runtime'}).skipped.some(s=>s.reason.includes('source-observation-unqualified')));
 assert(proposeBatchFromDump({...dump,Sparse:{...set,contractId:'authored.sparse'}},{...opts,drawnVariantSurface:'react-runtime'}).skipped.some(s=>s.reason.includes('source-marked')));
 const contradictory={...set,variants:set.variants.map((v:any,i:number)=>i===0?{...v,variantProperties:{...v.variantProperties,Tone:'Undeclared'}}:v)};
 assert(proposeBatchFromDump({...dump,Sparse:contradictory},{...opts,drawnVariantSurface:'react-runtime'}).skipped.some(s=>s.setName==='Sparse'));
 assert.equal(JSON.stringify(dump),before,'guarded preparation never edits its source');
 assert(proposeBatchFromDump(dump,opts).skipped.some(s=>s.setName==='Sparse'),'surface permission never leaks to the next import');
});

test('normal-flow literal and prop text paint above the fill without altering wrapping or glyph pixels',async()=>{
 const {emitReact}=await import('./emit-react.js');const {emitReactInline}=await import('./emit-react-inline.js');
 const {mountGenerated}=await import('./react-test-runtime.js');const {composedFillFlowChild}=await import('../packages/core/src/anatomy.js');
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[{name:'label',type:'text',default:'Foreground wraps',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}}];c.states=[];delete c.a11y;c.semantics={element:'div'};
 c.anatomy={root:{layout:{display:'flex',direction:'column',align:'start',justify:'start'},literals:{width:'65px',height:'60px'},solidFillComposition:{color:{r:1,g:0,b:0},opacity:1,blendMode:'NORMAL'},parts:{label:{element:'span',content:{prop:'label'},declared:{'font-family':'Arial'},literals:{color:'#ffffff','font-size':'14px','line-height':'18px'}}}}};
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();try{const page=await browser.newPage({viewport:{width:160,height:100}});
 for(const surface of ['module','inline'])for(const literal of [false,true]){
  const subject=structuredClone(c);if(literal){delete subject.anatomy.root.parts.label.content;subject.anatomy.root.parts.label.text='Foreground wraps';}
  const plain=structuredClone(subject);delete plain.anatomy.root.solidFillComposition;plain.anatomy.root.literals['background-color']='#ff0000';
  const emit=(x:any)=>{const ctx={tokens:new Set<string>(),tokenValues:tokens,icons:new Map<string,string>(),contracts:new Map([[x.id,x]])};return surface==='module'?emitReact(x,ctx):emitReactInline(x,{...ctx,tokens});};
  const images:Buffer[]=[];const boxes:unknown[]=[];
  for(const contract of [plain,subject]){const out=emit(contract);await mountGenerated(page,contract.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:'html,body{margin:0}'});images.push(PNG.sync.read(await page.locator('#root > *').screenshot()).data);boxes.push(await page.locator('#root span:not([data-dsc-paint-layer])').boundingBox());}
  assert.deepEqual(images[1],images[0],surface+' literal='+literal);assert.deepEqual(boxes[1],boxes[0]);
 }
 }finally{await browser.close();}
 const part=c.anatomy.root.parts.label;assert(composedFillFlowChild(part));
 for(const changed of [{...part,declared:{position:'static'}},{...part,literals:{...part.literals,left:'2px'}},{...part,declared:{transform:'translateX(1px)'}}])assert.equal(composedFillFlowChild(changed),false);
});
