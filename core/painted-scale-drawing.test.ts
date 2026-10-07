import {alignPair,diffPair} from '../extract/figma/visual-parity/img.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {chromium} from 'playwright-core';import {PNG} from 'pngjs';
import {proposeFromDumpDraftPaintQualification,proposeDeclaredDrawnDraftPaintCandidate,proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';import {revisionOf} from './contract-provenance.js';import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';import {draftDrawingReadbackMatches} from './draft-drawing-readback.js';import {emitReactDraftPaintQualification} from './emit-react.js';import {emitReactInlineDraftPaintQualification} from './emit-react-inline.js';import {mountGenerated} from './react-test-runtime.js';import {emitTokensCss,tokensCssLayers} from '../packages/core/src/emit-tokens-css.js';import {tokenInventoryFromJson} from '../packages/core/src/tokens.js';
function fixture(){
 const set=JSON.parse(readFileSync(new URL('./fixtures/painted-scale-drawing/ADD.json',import.meta.url),'utf8'));
 const layer={tree:{Default:{Gray:{'100':{$type:'color',$value:'#161616'}}}},entries:[{path:'Default.Gray.100',value:'#161616'}]};const corpus=tokenCorpusFromJson({primitives:{},semantic:layer.tree,light:{},brandDefault:{}});
 const proposal=proposeFromDumpDraftPaintQualification(set,{fileKey:'read-context',corpus,capturedValues:new Map(layer.entries.map(e=>[e.path,e.value])),mintUnbound:true,contractIdByName:new Map()});const child=ContractSchema.parse(proposal.contract);child.bindings.figma.anchors.fileKey=null;
 const receipt={readFileKey:'read-context',componentId:set.nodeId,componentKey:set.key,remote:true as const,contractRevision:revisionOf(child)};
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const parent:any={setName:'ScaledSlot',key:'parent-key',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},Icon:{type:'INSTANCE_SWAP',defaultValue:set.nodeId}},variants:[16,20].map(size=>{
 const instance={name:'Add',nodeId:'usage'+size,type:'INSTANCE',instanceKey:set.key,instanceOf:'Add',propRefs:{mainComponent:'Icon'},bbox:{width:size,height:size},instanceGeometry:{nodeId:'usage'+size,componentId:set.nodeId,transform:[[1,0,0],[0,1,0]],localSize:{width:size,height:size}},sourceFillComposition:{paint:{color:{r:1,g:1,b:1},opacity:Math.fround(.00001),blendMode:'MULTIPLY'}},hostOverrides:[{path:'Vector',fields:['fills'],fill:{hex:'ffffff'},solidFillTarget:{nodeId:'Iusage'+size+';glyph',instanceId:'usage'+size,componentId:set.nodeId,instancePath:[],childPath:[0]}}]};
 return {name:'Size='+(size===16?'Small':'Large'),type:'COMPONENT',variantProperties:{Size:size===16?'Small':'Large'},layout:{...layout,padding:[14,14,14,14]},fill:{hex:'0f62fe'},children:[{name:'Host',type:'FRAME',layout,children:[instance]}]};
 })};
 const opts={fileKey:'read-context',corpus,mintUnbound:true,stampsObservable:true,hiddenCaptured:true,contractIdByName:new Map([['Add',child.id]]),contractIdByKey:new Map([[set.key,child.id]]),contractsById:new Map([[child.id,child]]),draftDrawingReadbacks:new Map([[child.id,receipt]])};return{set,layer,proposal,child,parent,opts,receipt};
}
test('painted free viewport preserves SCALE and exact remote readback enables draft default size and color',async t=>{
 const f=fixture(),before=JSON.stringify(f.child);const root=f.child.anatomy.root;assert.deepEqual(root.overridable,['size','color']);assert(root.parts!.Vector.shape?.kind==='path');assert.equal(root.parts!.Vector.shape.parentViewport!.width,16);
 const result=proposeDeclaredDrawnDraftPaintCandidate(f.parent,f.opts,f.parent.variants.map((v:any)=>v.variantProperties)).proposal;
 const parent=ContractSchema.parse(result.contract);const ref=walkAnatomy(parent).find(x=>x.part.component)?.part.component;assert(ref?.overrides?.size);assert(ref?.overrides?.color);assert.equal(JSON.stringify(f.child),before);assert.equal(f.child.bindings.figma.anchors.fileKey,null);
 const tokens={primitives:{...f.proposal.mintedTokens!.tree,...result.mintedTokens!.tree},semantic:f.layer.tree,light:{},dark:{},brands:{default:{}}};
 // Merge nested minted branches without dropping the child's size tokens.
 tokens.primitives={imported:{...(f.proposal.mintedTokens!.tree as any).imported,...(result.mintedTokens!.tree as any).imported}};
 const contracts=new Map([[f.child.id,f.child],[parent.id,parent]]),ctx={tokens:tokenInventoryFromJson([tokens.primitives,tokens.semantic]),tokenValues:tokens,icons:new Map(),contracts};const b=await chromium.launch();t.after(()=>b.close());const page=await b.newPage();
 for(const surface of ['module','inline']){
 const emit=(c:any)=>surface==='module'?emitReactDraftPaintQualification(c,ctx):emitReactInlineDraftPaintQualification(c,{...ctx,tokens});const out=emit(parent),dep=emit(f.child);const render=await mountGenerated(page,parent.name,out.tsx,'css'in out?String(out.css):'',{[f.child.name]:dep});await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'html,body{margin:0;background:transparent}#root{width:fit-content;height:fit-content}'});
 await render({size:'large'});const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true})),native=PNG.sync.read(readFileSync(new URL('./fixtures/painted-scale-drawing/native-2.png',import.meta.url)));assert.equal(actual.width,48);assert.equal(actual.height,48);for(const bg of [0,255] as const)assert(diffPair(alignPair(actual,native,bg),[]).unmaskedPct<=5,surface+' unchanged native pixel threshold');const ink=await page.locator('#root').evaluate(host=>[...host.querySelectorAll('*')].filter(el=>getComputedStyle(el).clipPath.startsWith('url(')||(el.localName==='path'&&el.closest('svg[viewBox]'))).map(el=>el.localName==='path'?getComputedStyle(el).fill:getComputedStyle(el).backgroundColor));assert.deepEqual(ink,['rgb(255, 255, 255)'],surface+' white usage ink');
 await render({size:'small'});assert.equal((await page.locator('#root').boundingBox())!.width,44);
 await render({size:'large',children:'Replacement'});assert.equal(await page.locator('#root').innerText(),'Replacement');
 await render({size:'large',children:null});assert.equal(await page.locator('#root').innerText(),'');
 }
});
test('cached drawing receipts are scoped to exact file, key, node and revision; public proposal ignores them',()=>{
 const f=fixture(),node=f.parent.variants[1].children[0].children[0];assert(draftDrawingReadbackMatches(f.receipt,f.child,node,'read-context'));
 for(const change of [{readFileKey:'foreign'},{componentId:'other'},{componentKey:'other'},{contractRevision:'old'},{remote:false}])assert.equal(draftDrawingReadbackMatches({...f.receipt,...change} as any,f.child,node,'read-context'),false);
 for(const change of [{instanceKey:'other'},{instanceSetKey:'set'},{instanceGeometry:undefined},{instanceGeometry:{...node.instanceGeometry,nodeId:'other-usage'}}])assert.equal(draftDrawingReadbackMatches(f.receipt,f.child,{...node,...change},'read-context'),false);
 const changed=structuredClone(f.child);changed.description+='changed';assert.equal(draftDrawingReadbackMatches(f.receipt,changed,node,'read-context'),false);
 const publicResult=proposeFromDump(f.parent,f.opts);assert(walkAnatomy(ContractSchema.parse(publicResult.contract)).every(x=>!x.part.component?.overrides?.size),'draft-only readback cannot authorize public projection');
 const noReceipt=proposeDeclaredDrawnDraftPaintCandidate(f.parent,{...f.opts,draftDrawingReadbacks:undefined},f.parent.variants.map((v:any)=>v.variantProperties)).proposal;assert(walkAnatomy(ContractSchema.parse(noReceipt.contract)).every(x=>!x.part.component?.overrides?.size));
});

test('three-axis instance ink reaches both React surfaces and native compilation without changing the child',async t=>{
 const f=fixture(),names=['Tone','Density','Emphasis'];
 f.parent.propertyDefinitions=Object.fromEntries(names.map(name=>[name,{type:'VARIANT',defaultValue:'Low',variantOptions:['Low','High']}])) as any;
 (f.parent.propertyDefinitions as any).Icon={type:'INSTANCE_SWAP',defaultValue:f.set.nodeId};
 const template=structuredClone(f.parent.variants[1]);
 f.parent.variants=Array.from({length:8},(_,index)=>{const v=structuredClone(template),values=names.map((_,j)=>(index>>j)&1?'High':'Low');v.variantProperties=Object.fromEntries(names.map((n,j)=>[n,values[j]])) as any;v.name=names.map((n,j)=>n+'='+values[j]).join(', ');const n=v.children[0].children[0];n.nodeId='matrix'+index;n.instanceGeometry.nodeId=n.nodeId;n.hostOverrides[0].solidFillTarget.instanceId=n.nodeId;n.hostOverrides[0].solidFillTarget.nodeId='I'+n.nodeId+';glyph';n.hostOverrides[0].fill.hex=(index*25+10).toString(16).padStart(2,'0').repeat(3);return v;});
 const before=JSON.stringify(f.child),p=proposeDeclaredDrawnDraftPaintCandidate(f.parent,f.opts,f.parent.variants.map((v:any)=>v.variantProperties)).proposal,parent=ContractSchema.parse(p.contract);
 const ref=walkAnatomy(parent).find(w=>w.part.component)?.part.component;assert.equal((ref!.overrides!.color.match(/\{(tone|density|emphasis)\}/g)??[]).length,3);
 const tokens={primitives:{imported:{...(f.proposal.mintedTokens!.tree as any).imported,...(p.mintedTokens!.tree as any).imported}},semantic:f.layer.tree,light:{},dark:{},brands:{default:{}}};const contracts=new Map([[f.child.id,f.child],[parent.id,parent]]),ctx={tokens:tokenInventoryFromJson([tokens.primitives,tokens.semantic]),tokenValues:tokens,icons:new Map(),contracts};
 const b=await chromium.launch();t.after(()=>b.close());const page=await b.newPage();
 for(const surface of ['module','inline']){const emit=(c:any)=>surface==='module'?emitReactDraftPaintQualification(c,ctx):emitReactInlineDraftPaintQualification(c,{...ctx,tokens});const out=emit(parent),dep=emit(f.child),render=await mountGenerated(page,parent.name,out.tsx,'css'in out?String(out.css):'',{[f.child.name]:dep});await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
 for(let i=0;i<8;i++){await render(Object.fromEntries(names.map((n,j)=>[n.toLowerCase(),(i>>j)&1?'high':'low'])));const ink=await page.locator('#root').evaluate(host=>[...host.querySelectorAll('*')].filter(el=>getComputedStyle(el).clipPath.startsWith('url(')||(el.localName==='path'&&el.closest('svg[viewBox]'))).map(el=>el.localName==='path'?getComputedStyle(el).fill:getComputedStyle(el).backgroundColor));const gray=i*25+10;assert.deepEqual(ink,[`rgb(${gray}, ${gray}, ${gray})`],surface+' '+i);}
 await render({tone:'high',density:'high',emphasis:'high',children:'Replacement'});assert.equal(await page.locator('#root').innerText(),'Replacement');
 }
 const {createFigmaEngine}=await import('./emit-figma-script.js');const compiled=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,contracts);
 for(const v of compiled.variants){const specs:any[]=[];const visit=(s:any)=>{if(s.instanceInk)specs.push(s);for(const c of s.children??[])visit(c)};visit(v.spec);assert.equal(specs.length,1);const i=names.reduce((n,name,j)=>n+(v.name.includes(name+'=High')?1<<j:0),0),path=specs[0].instanceInk.varName.split('/');let value:any=tokens.primitives;for(const key of path)value=value[key];assert.equal(value.$value,'#'+(i*25+10).toString(16).padStart(2,'0').repeat(3));}
 assert.equal(JSON.stringify(f.child),before);
});

test('native captured inside stroke becomes per-usage authorship without dropping fields or changing the main',()=>{
 const f=fixture(),row=JSON.parse(readFileSync(new URL('./fixtures/inside-stroke-equivalence/SOURCE.json',import.meta.url),'utf8')).rows[0];
 const usage=f.parent.variants[1].children[0].children[0];usage.nodeId=row.nodeId;usage.instanceGeometry.nodeId=row.nodeId;usage.hostOverrides=structuredClone(row.hostOverrides);
 // Native capture also records root sizing, even with no root paint edit.
 // Its separate override queue must not invalidate the proven glyph ink.
 usage.instanceRootOverrides={nodeId:usage.nodeId,componentId:f.set.nodeId,componentKey:f.set.key,fields:['width'],localSize:{width:20,height:20},localTransform:[[1,0,0],[0,1,0]]};
 const before=JSON.stringify({child:f.child,source:usage});const p=proposeDeclaredDrawnDraftPaintCandidate(f.parent,f.opts,f.parent.variants.map((v:any)=>v.variantProperties)).proposal;
 const c=ContractSchema.parse(p.contract),ref=walkAnatomy(c).find(w=>w.part.component)?.part.component!;
 assert(ref.overrides?.color);assert.equal(ref.sameInkInsideStroke!.rows.length,2);
 assert.deepEqual(ref.sameInkInsideStroke!.rows.map(r=>r.stroke),[null,{weight:1,cap:'NONE',join:'MITER',miterLimit:4}]);
 assert.equal(JSON.stringify({child:f.child,source:usage}),before);
 for(const change of [(h:any)=>h.vectorStrokeGeometry.target.childPath=[1],(h:any)=>h.vectorStrokeGeometry.strokeAlign='OUTSIDE',(h:any)=>h.vectorStrokeGeometry.fillGeometry[0].data='M0 0L10 0L10 10Z',(h:any)=>h.sourceNormalStrokeComposition.variableId='different']){
  const n=structuredClone(f.parent);change(n.variants[1].children[0].children[0].hostOverrides[0]);const declined=proposeDeclaredDrawnDraftPaintCandidate(n,f.opts,n.variants.map((v:any)=>v.variantProperties)).proposal;
  assert(walkAnatomy(ContractSchema.parse(declined.contract)).every(w=>!w.part.component?.sameInkInsideStroke));
 }
});


test('captured 36-unit menu path scales to its real 14px native instance on both React surfaces',async t=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/scaled-menu-path/SOURCE.json',import.meta.url),'utf8'));
 const all=f.contracts.map((c:unknown)=>ContractSchema.parse(c));const parent=all.find((c:any)=>c.id==='ds.inline-menu-item-menu-item')!;
 const contracts=new Map(all.map((c:any)=>[c.id,c])),tokens=f.tokens;
 const ctx={tokens:tokenInventoryFromJson([tokens.primitives,tokens.semantic,tokens.light,tokens.dark,...Object.values(tokens.brands)]),tokenValues:tokens,icons:new Map(),contracts} as any;
 const native=PNG.sync.read(readFileSync(new URL('./fixtures/scaled-menu-path/native-14.png',import.meta.url)));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const emit=(c:any)=>surface==='module'?emitReactDraftPaintQualification(c,ctx):emitReactInlineDraftPaintQualification(c,{...ctx,tokens});
  const output=emit(parent),deps=Object.fromEntries(all.filter((c:any)=>c!==parent).map((c:any)=>[c.name,emit(c)]));
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,parent.name,output.tsx,'css'in output?String(output.css):'',deps);
   await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'html,body{margin:0;background:transparent}#root{width:fit-content;height:fit-content}'});
   await render({selected:false});const actual=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true}));
   assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);
   for(const bg of [0,255] as const)assert(diffPair(alignPair(actual,native,bg),[]).unmaskedPct<=5,surface+' unchanged native image limit '+bg);
  }finally{await page.close();}
 }
});

test('inside-stroke tables cover reachable sparse variants without requiring declared-absent cells',()=>{
 const f=fixture(),source=JSON.parse(readFileSync(new URL('./fixtures/inside-stroke-equivalence/SOURCE.json',import.meta.url),'utf8')).rows[0];
 const usage=f.parent.variants[1].children[0].children[0];usage.nodeId=source.nodeId;usage.instanceGeometry.nodeId=source.nodeId;usage.hostOverrides=structuredClone(source.hostOverrides);
 const c=ContractSchema.parse(proposeDeclaredDrawnDraftPaintCandidate(f.parent,f.opts,f.parent.variants.map((v:any)=>v.variantProperties)).proposal.contract);
 delete c.bindings.figma.drawnVariants;
 c.props.push({name:'tone',type:{enum:['plain','strong']},default:'plain',bindings:{code:{prop:'tone'},figma:{kind:'VARIANT',property:'Tone'}}});
 c.bindings.figma.absentVariants=[{size:'large',tone:'strong'}];
 const ref=walkAnatomy(c).find(w=>w.part.component)?.part.component!,table=ref.sameInkInsideStroke!;
 table.props.push('tone');table.rows=table.rows.flatMap(row=>row.values[0]==='small'?[{...row,values:[...row.values,'plain']},{...row,values:[...row.values,'strong']}]:[{...row,values:[...row.values,'plain']}]);
 assert(ContractSchema.safeParse(c).success);
 const bad=structuredClone(c);walkAnatomy(bad).find(w=>w.part.component)!.part.component!.sameInkInsideStroke!.rows.pop();
 assert.equal(ContractSchema.safeParse(bad).success,false);
});
