import * as maskScopeHelpers from './react-mask-scopes.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {mountGenerated} from './react-test-runtime.js';
import {generateTsx} from './emit-react.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture():DumpSet{return{setName:'Masked',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default']}},variants:[{name:'Mode=Default',variantProperties:{Mode:'Default'},type:'COMPONENT',bbox:{width:40,height:40},children:[{name:'aperture',type:'ELLIPSE',mask:{type:'ALPHA'},fill:{hex:'000000'},shape:{kind:'ellipse',width:18,height:18,x:2,y:4,right:20,bottom:18,constraints:{horizontal:'SCALE',vertical:'SCALE'}}},{name:'paint',type:'RECTANGLE',fill:{hex:'336699'},shape:{kind:'rect',width:40,height:40,x:0,y:0,right:0,bottom:0,constraints:{horizontal:'SCALE',vertical:'SCALE'}}}]}]};}
function read(set=fixture()){const r=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});const c=ContractSchema.parse(r.contract);return{r,c,mask:walkAnatomy(c).find(x=>x.part.mask)!.part};}
test('an observed ellipse mask retains its actual parent coordinate plane and outline',()=>{
 const set=fixture(),before=JSON.stringify(set),{c,mask}=read(set);
 assert.deepEqual(mask.absoluteGeometry?.parent,{width:40,height:40});assert.equal(mask.absoluteGeometry?.box.x,2);assert.equal(mask.absoluteGeometry?.box.y,4);
 assert.equal(mask.shape?.kind,'ellipse');assert.equal(mask.shape?.width,18);assert.equal(mask.literals?.left,undefined);assert.equal(mask.literals?.top,undefined);assert.equal(JSON.stringify(set),before);
 const tsx=generateTsx(c,new Map([[c.id,c]]),new Map());assert.match(tsx,/ellipse/);assert.match(tsx,/viewBox/);
});
test('ellipse mask coordinate carriage refuses inconsistent parent extent, authored size and nonplain outlines',()=>{
 for(const kind of ['parent','bound','rotated','arc']){
  const set=fixture(),node=set.variants[0].children![0];
  if(kind==='parent')set.variants[0].bbox!.width=41;
  if(kind==='bound')node.bound={width:'authored.width'};
  if(kind==='rotated')node.shape!.rotation=45;
  if(kind==='arc')node.shape!.arc={start:0,end:Math.PI,innerRadius:0};
  const {mask}=read(set);assert.equal(mask.absoluteGeometry,undefined,kind);
 }
});

test('generated ellipse mask clips the measured plane in the browser',async t=>{
 const {r,c}=read(),browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:40,height:40}});
 const scope=new Map([[c.id,c]]);
 const {emitReact}=await import('./emit-react.js');const {tokenInventoryFromJson}=await import('./tokens.js');
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}});
 const output=emitReact(c,{contracts:scope,icons:new Map(),tokens:inventory,tokenValues:tokens});
 const render=await mountGenerated(page,c.name,output.tsx,output.css);
 await page.addStyleTag({content:'body{margin:0}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
 await render({style:{width:40,height:40}});
 const png=PNG.sync.read(await page.screenshot({omitBackground:true}));
 const pixel=(x:number,y:number)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];
 assert.deepEqual(pixel(11,13),[51,102,153,255]);assert.equal(pixel(0,0)[3],0);assert.equal(pixel(30,30)[3],0);
});

test('a captured combined boolean mask compiles its actual editable paths without repainting operands',async()=>{
 const set=fixture(),mask=set.variants[0].children![0];mask.type='BOOLEAN_OPERATION';
 mask.shape={kind:'path',width:18,height:18,x:2,y:4,right:20,bottom:18,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:'M0 0L18 0L18 18L0 18ZM4 4L14 4L14 14L4 14Z',windingRule:'EVENODD'}]};
 mask.children=[{name:'operand',type:'ELLIPSE',fill:{hex:'000000'},shape:{kind:'ellipse',width:18,height:18,x:0,y:0,right:0,bottom:0,constraints:{horizontal:'SCALE',vertical:'SCALE'}}}];
 const original=JSON.stringify(set),{c,r,mask:part}=read(set);assert.equal(part.parts,undefined);assert.deepEqual(part.shape?.paths,mask.shape.paths);assert(part.absoluteGeometry);assert.equal(JSON.stringify(set),original);
 const {createFigmaEngine}=await import('./emit-figma-script.js');const engine=createFigmaEngine({tokens:{primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const compiled=engine.compileComponentData(c,new Map([[c.id,c]]));
 const specs:any[]=[];function walk(node:any){if(node.mask)specs.push(node);for(const child of node.children??[])walk(child);}for(const v of compiled.variants)walk(v.spec);
 assert.equal(specs.length,1);assert.equal(specs[0].mask.type,'ALPHA');assert.equal(specs[0].shape.kind,'path');assert.deepEqual(specs[0].shape.paths,mask.shape.paths);assert(!specs[0].children?.length);
});

test('mask path selection follows the captured axis on both React surfaces without freezing the first path',async t=>{
 const set=fixture(),base=set.variants[0];set.propertyDefinitions!.Size={type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']};
 set.variants=['Small','Large'].map(size=>{const node=structuredClone(base);node.name+=' , Size='+size;node.variantProperties!.Size=size;const mask=node.children![0];mask.type='BOOLEAN_OPERATION';mask.shape={...mask.shape!,kind:'path',paths:[{data:size==='Small'?'M0 0L18 0L18 18L0 18ZM4 4L14 4L14 14L4 14Z':'M0 0L18 0L18 18L0 18ZM8 8L10 8L10 10L8 10Z',windingRule:'EVENODD'}]};return node;});
 const {r,c,mask}=read(set);assert.equal(mask.shape?.pathsByProp?.prop,'size');
 const browser=await chromium.launch();t.after(()=>browser.close());
 const scope=new Map([[c.id,c]]),tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');const inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}});
 for(const output of [emitReact(c,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts:scope}),{...emitReactInline(c,{tokens,icons:new Map(),contracts:scope}),css:''}]){
  const page=await browser.newPage({viewport:{width:40,height:40}});try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
   for(const [size,alpha] of [['small',0],['large',255],['small',0]] as const){await render({size,style:{width:40,height:40}});const png=PNG.sync.read(await page.screenshot({omitBackground:true}));assert.equal(png.data[(11*png.width+7)*4+3],alpha,size);}
  }finally{await page.close();}
 }
});


test('variant-centered masked ellipse uses one coordinate owner in both browser surfaces',async t=>{
 const set=fixture(),base=set.variants[0];set.propertyDefinitions!.Size={type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']};
 set.variants=['Small','Large'].map(size=>{const node=structuredClone(base);node.name+=' , Size='+size;node.variantProperties!.Size=size;
  node.children![0].shape!.constraints={horizontal:size==='Small'?'SCALE':'LEFT',vertical:size==='Small'?'SCALE':'TOP'};
  const paint=node.children![1];paint.type='ELLIPSE';paint.shape={kind:'ellipse',width:20,height:20,x:10,y:10,right:10,bottom:10,constraints:{horizontal:size==='Small'?'SCALE':'CENTER',vertical:size==='Small'?'SCALE':'CENTER'}};return node;});
 const {r,c}=read(set),fill=walkAnatomy(c).find(x=>x.name==='paint')!.part;
 assert(fill.absoluteGeometryByCombination);assert.equal(fill.stylesWhen,undefined);assert.equal(fill.literals?.transform,undefined);
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),scope=new Map([[c.id,c]]);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{tokens:inventory,tokenValues:tokens,icons:new Map(),contracts:scope}),{...emitReactInline(c,{tokens,icons:new Map(),contracts:scope}),css:''}]){
  const page=await browser.newPage({viewport:{width:40,height:40}});try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
   for(const size of ['small','large','small']){await render({size,style:{width:40,height:40}});const png=PNG.sync.read(await page.screenshot({omitBackground:true}));assert.deepEqual([...png.data.subarray((16*png.width+14)*4,(16*png.width+14)*4+4)],[51,102,153,255],size);assert.equal(png.data[(2*png.width+2)*4+3],0,size);}
  }finally{await page.close();}
 }
});

test('rounded rectangular masks retain a constant native radius when their plane resizes on both React surfaces',async t=>{
 const set=fixture(),root=set.variants[0];root.bbox={width:18,height:18};
 const aperture=root.children![0];aperture.type='RECTANGLE';aperture.cornerRadius=100;
 aperture.shape={kind:'rect',width:18,height:18,x:0,y:0,right:0,bottom:0,constraints:{horizontal:'SCALE',vertical:'SCALE'}};
 root.children![1].shape={...aperture.shape};
 const {r,c}=read(set),scope=new Map([[c.id,c]]);
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}});
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{contracts:scope,icons:new Map(),tokens:inventory,tokenValues:tokens}),{...emitReactInline(c,{tokens,icons:new Map(),contracts:scope}),css:''}]){
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);
   await page.addStyleTag({content:'body{margin:0}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
   for(const [width,height] of [[18,18],[33,32],[40,18],[18,40]]){
    await page.setViewportSize({width,height});await render({style:{width,height}});
    const png=PNG.sync.read(await page.screenshot({omitBackground:true}));
    const pixel=(x:number,y:number)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];
    assert.equal(pixel(0,0)[3],0,`${width}x${height} corner`);
    assert.deepEqual(pixel(Math.floor(width/2),Math.floor(height/2)),[51,102,153,255]);
    if(width===40)assert.deepEqual(pixel(11,1),[51,102,153,255],'horizontal stadium retains a circular end');
    if(height===40)assert.deepEqual(pixel(1,11),[51,102,153,255],'vertical stadium retains a circular end');
   }
  }finally{await page.close();}
 }
});

test('rounded mask paint refuses ambiguous radius channels and unsupported outlines',()=>{
 const {c}=read();const mask=walkAnatomy(c).find(x=>x.part.mask)!.part;
 mask.tokens={...mask.tokens,'border-radius':'{radius.actual}'};
 assert.throws(()=>generateTsx(c,new Map([[c.id,c]]),new Map()),/mask-radius-outline-unqualified/);
 mask.shape=undefined;mask.mask!.outline='rect';
 mask.literals={...mask.literals,'border-radius':'3px'};
 assert.throws(()=>generateTsx(c,new Map([[c.id,c]]),new Map()),/mask-radius-competing-channel/);
 delete mask.literals['border-radius'];mask.tokens['border-radius']='calc(3px)';
 assert.throws(()=>generateTsx(c,new Map([[c.id,c]]),new Map()),/mask-radius-token-plane-unqualified/);
});


test('a gradient FRAME mask is a painted rectangular coordinate owner, never an empty spacer',()=>{
 const set=fixture(),node=set.variants[0].children![0];
 node.type='FRAME';delete node.shape;delete node.fill;
 node.abs={x:2,y:4,width:18,height:18,right:20,bottom:18,constraints:{horizontal:'SCALE',vertical:'SCALE'}};
 node.maskFramePlane={nodeId:'mask',parentId:'root',size:{width:18,height:18},parentSize:{width:40,height:40},relativeTransform:[[1,0,2],[0,1,4]],parentRelativeTransform:[[1,0,0],[0,1,0]]};
 node.gradient={start:{x:0,y:.5},end:{x:1,y:.5},stops:[{position:0,hex:'ffffff',alpha:0},{position:.5365,hex:'ffffff'},{position:1,hex:'ffffff',alpha:0}]};
 const before=JSON.stringify(set),{r,mask}=read(set);
 assert.equal(mask.mask?.outline,'rect');assert.deepEqual(mask.absoluteGeometry?.parent,{width:40,height:40});
 assert.equal(mask.absoluteGeometry?.box.x,2);assert.equal(mask.shape?.kind,'rect');
 assert(mask.tokens?.['background-image']);assert(r.notes.some(note=>note.includes('GRADIENT_LINEAR fill')&&note.includes('carried as background-image')));
 assert(!r.notes.some(note=>note.includes('SPACER')));assert.equal(JSON.stringify(set),before);
});

test('a childless gradient frame without a mask retains paint while an empty frame stays a spacer',()=>{
 const set=fixture(),node=set.variants[0].children![0];
 node.type='FRAME';delete node.shape;delete node.fill;delete node.mask;
 node.gradient={start:{x:0,y:0},end:{x:0,y:1},stops:[{position:0,hex:'ff0000'},{position:1,hex:'0000ff'}]};
 const result=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});
 const part=walkAnatomy(ContractSchema.parse(result.contract)).find(x=>x.name==='aperture')!.part;
 assert(part.tokens?.['background-image']);
 delete node.gradient;
 const empty=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});
 const spacer=walkAnatomy(ContractSchema.parse(empty.contract)).find(x=>x.name==='aperture')!.part;
 assert.equal(spacer.tokens?.['background-image'],undefined);
});

test('FRAME mask geometry requires complete identity affine evidence and uses unrounded local bounds',()=>{
 const make=()=>{const set=fixture(),node=set.variants[0].children![0];node.type='FRAME';delete node.shape;
  node.abs={x:2.13,y:4.38,width:18,height:18,right:19.88,bottom:17.63,constraints:{horizontal:'SCALE',vertical:'SCALE'}};
  node.maskFramePlane={nodeId:'mask',parentId:'root',size:{width:18,height:18},parentSize:{width:40,height:40},relativeTransform:[[1,0,2.125],[0,1,4.375]],parentRelativeTransform:[[1,0,0],[0,1,0]]};return set;};
 const set=make(),before=JSON.stringify(set),{mask}=read(set);
 assert.equal(mask.absoluteGeometry?.box.x,2.125);assert.equal(mask.absoluteGeometry?.box.y,4.375);
 assert.equal(mask.absoluteGeometry?.box.right,19.875);assert.equal(JSON.stringify(set),before);
 for(const kind of ['absent','child-rotation','parent-skew','missing-parent-size']){
  const input=make(),node=input.variants[0].children![0];
  if(kind==='absent')delete node.maskFramePlane;
  if(kind==='child-rotation')node.maskFramePlane!.relativeTransform=[[0,-1,2],[1,0,4]];
  if(kind==='parent-skew')node.maskFramePlane!.parentRelativeTransform[0][1]=.1;
  if(kind==='missing-parent-size')node.maskFramePlane!.parentSize.width=NaN;
  const result=read(input).mask;assert.equal(result.absoluteGeometry,undefined,kind);assert.equal(result.mask?.outline,undefined,kind);
 }
});

test('sparse mask geometry carries the exact drawn planes and preserves native absence declarations',async()=>{
 const set=fixture(),base=set.variants[0];set.propertyDefinitions={
  Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Alternate']},
  Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},
  Tone:{type:'VARIANT',defaultValue:'Normal',variantOptions:['Normal','Other']}};
 set.variants=[];
 for(const mode of ['Default','Alternate'])for(const size of ['Small','Large'])for(const tone of ['Normal','Other']){
  if(mode==='Alternate'&&tone==='Other')continue;
  const v=structuredClone(base);v.name=`Mode=${mode}, Size=${size}, Tone=${tone}`;v.variantProperties={Mode:mode,Size:size,Tone:tone};
  if(mode==='Default')v.children=[];
  else{const mask=v.children![0];mask.shape!.width=size==='Small'?18:20;mask.shape!.right=size==='Small'?20:18;}
  set.variants.push(v);
 }
 const original=JSON.stringify(set),r=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map(),stampsObservable:true}),c=ContractSchema.parse(r.contract);
 const mask=walkAnatomy(c).find(x=>x.part.mask)!.part;
 assert.equal(c.bindings.figma.absentVariants?.length,2);assert.equal(mask.absoluteGeometryByCombination?.rows.length,2);
 for(const key of ['left','right','top','bottom']){assert.equal(mask.tokens?.[key],undefined);assert.equal(mask.literals?.[key],undefined);}
 assert.equal(JSON.stringify(set),original);
 const missing=structuredClone(c);walkAnatomy(missing).find(x=>x.part.mask)!.part.absoluteGeometryByCombination!.rows.pop();
 assert(!ContractSchema.safeParse(missing).success,'one actually drawn mask plane must not disappear');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const engine=createFigmaEngine({tokens:{primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const compiled=engine.compileComponentData(c,new Map([[c.id,c]]));assert.equal(compiled.variants.length,6);
 let nativeMasks=0;const visit=(n:any)=>{if(n.mask)nativeMasks++;for(const child of n.children??[])visit(child);};
 for(const v of compiled.variants)visit(v.spec);assert.equal(nativeMasks,2,'only the two native drawn mask planes compile');
});

test('both actual React surfaces match owned native gradient-mask PNGs through stretch, scale, fixed-edge and center resize',async t=>{
 const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto');
 const {alignRecordedFrames,enclosingFrame}=await import('../scripts/design-consumer-framing-v2.js'),{diffPair}=await import('../extract/figma/visual-parity/img.js');
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/native-alpha-gradient-masks/cases.json',import.meta.url),'utf8'));
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const control of manifest.cases){
  const p=control.parent,b=control.box,set=fixture(),root=set.variants[0];root.bbox=p;
  const mask=root.children![0];mask.type='FRAME';delete mask.shape;delete mask.fill;mask.gradient=manifest.gradient;
  mask.abs={...b,right:p.width-b.x-b.width,bottom:p.height-b.y-b.height,constraints:control.constraints};
  mask.maskFramePlane={nodeId:control.maskId,parentId:control.frameId,size:{width:b.width,height:b.height},parentSize:p,relativeTransform:[[1,0,b.x],[0,1,b.y]],parentRelativeTransform:[[1,0,0],[0,1,0]]};
  root.children![1].shape={kind:'rect',width:p.width,height:p.height,x:0,y:0,right:0,bottom:0,constraints:{horizontal:'STRETCH',vertical:'STRETCH'}};
  const {r,c}=read(set),tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),scope=new Map([[c.id,c]]);
  const native=readFileSync(new URL('./fixtures/native-alpha-gradient-masks/'+control.file,import.meta.url)),hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(native),control.sha256);
  for(const surface of ['module','inline']){
   const output=surface==='module'?emitReact(c,{contracts:scope,icons:new Map(),tokens:inventory,tokenValues:tokens}):{...emitReactInline(c,{contracts:scope,icons:new Map(),tokens}),css:''};
   const page=await browser.newPage({viewport:{width:control.target.width,height:Math.max(control.target.height,64)},deviceScaleFactor:1});try{
    const render=await mountGenerated(page,c.name,output.tsx,output.css);
    await page.addStyleTag({content:'html,body{margin:0;padding:0}'+(surface==='module'?':root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}':'')});
    await render({style:control.target});const element=page.locator('#root > *'),layout=await element.boundingBox();assert(layout);
    assert.equal(layout.width,control.target.width);assert.equal(layout.height,control.target.height);
    const ours=await element.screenshot({omitBackground:true});assert.deepEqual(await element.boundingBox(),layout);
    for(const background of [0,255]as const){const pair=alignRecordedFrames(ours,native,{layout,capture:enclosingFrame(layout),deviceScaleFactor:1,pngSha256:hash(ours)},{...control.nativeFrame,pngSha256:hash(native)},background);
     assert(!('refused'in pair),JSON.stringify({surface,file:control.file,pair}));assert(diffPair(pair.aligned,[]).unmaskedPct<=5,`${surface} ${control.file} ${background}`);
    }
   }finally{await page.close();}
  }
 }
});

test('gradient masks keep unsupported paint stacks, nonrectangular stretch and malformed references as named refusals',()=>{
 const {reactMaskChildren}=maskScopeHelpers;
 const {c}=read(),part=walkAnatomy(c).find(x=>x.part.mask)!.part;
 part.mask!.outline='rect';delete part.shape;part.tokens={'background-image':'{gradient.actual}'};
 assert.doesNotThrow(()=>reactMaskChildren({aperture:part},()=>''));
 part.tokens['background-color']='{color.actual}';assert.throws(()=>reactMaskChildren({aperture:part},()=>''),/mask-gradient-paint-stack-unqualified/);delete part.tokens['background-color'];
 part.tokens['background-image']='{gradient.{mode}}';assert.throws(()=>reactMaskChildren({aperture:part},()=>''),/mask-gradient-token-plane-unqualified/);
 part.tokens={'background-color':'{color.actual}'};part.mask!.outline='ellipse';part.absoluteGeometry!.box.constraints.horizontal='STRETCH';
 assert.throws(()=>reactMaskChildren({aperture:part},()=>''),/mask-stretch-outline-unqualified/);
});


function mixedSizingFixture(): DumpSet {
 return {setName:'MixedSizing',type:'COMPONENT_SET',propertyDefinitions:{
  Mode:{type:'VARIANT',defaultValue:'Fixed',variantOptions:['Fixed','Fill']},
  Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']}},
  variants:['Fixed','Fill'].flatMap(mode=>['Small','Large'].map(size=>({
   name:`Mode=${mode}, Size=${size}`,variantProperties:{Mode:mode,Size:size},type:'COMPONENT',bbox:{width:240,height:24},
   layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},
   children:[{name:'Track',type:'FRAME',fill:{hex:'336699'},bbox:{width:mode==='Fixed'?164:240,height:24},
    ...(mode==='Fixed'?{fixedSize:{width:164,height:24}}:{fillWidth:true,fixedSize:{height:24}})}]
  }))) } as DumpSet;
}
test('mixed FIXED/FILL non-layout frames carry width only on complete observed FIXED tuples',()=>{
 const source=mixedSizingFixture(),before=JSON.stringify(source);
 const r=proposeFromDump(source,{corpus,mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(r.contract);
 const track=c.anatomy.root.parts!.Track;
 const table=track.literalsByCombination?.find(t=>t.rows.some(row=>'width' in row.literals));
 assert(table);assert.equal(table.rows.length,2);
 const modeIndex=table.props.indexOf('mode');assert(modeIndex>=0);
 assert(table.rows.every(row=>row.values[modeIndex]==='fixed'&&row.literals.width==='164px'));
 assert.equal(track.tokens?.width,undefined);assert.equal(track.literals?.width,undefined);
 assert.equal(track.layoutByProp?.prop,'mode');assert.equal(track.layoutByProp?.map.fill?.grow,true);
 assert.equal(JSON.stringify(source),before);
});
test('mixed fixed dimensions require minting, finite capture and an unbound owner',()=>{
 for(const fault of ['mint-off','invalid','bound']){
  const source=mixedSizingFixture();
  if(fault==='invalid')source.variants[0].children![0].fixedSize!.width=NaN;
  if(fault==='bound')source.variants[0].children![0].bound={width:'authored.width'};
  const r=proposeFromDump(source,{corpus,mintUnbound:fault!=='mint-off',contractIdByName:new Map()});
  const track=ContractSchema.parse(r.contract).anatomy.root.parts!.Track;
  assert(!track.literalsByCombination?.some(t=>t.rows.some(row=>'width' in row.literals)),fault);
 }
});

test('both generated React surfaces switch mixed FIXED/FILL widths without retaining stale fixed dimensions',async t=>{
 const source=mixedSizingFixture(),r=proposeFromDump(source,{corpus,mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(r.contract);
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),contracts=new Map([[c.id,c]]);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const output=surface==='module'?emitReact(c,{contracts,icons:new Map(),tokens:inventory,tokenValues:tokens}):{...emitReactInline(c,{tokens,icons:new Map(),contracts}),css:''};
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);
   await page.addStyleTag({content:'body{margin:0}'+(surface==='module'?':root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}':'')});
   for(const width of [240,320,120])for(const mode of ['fixed','fill','fixed'])for(const size of ['small','large']){
    await render({mode,size,style:{width,height:24}});
    const box=await page.locator('#root > * > *').first().boundingBox();assert(box);
    assert.equal(box.width,mode==='fixed'?164:width,`${surface} ${mode}/${size} parent=${width}`);
   }
  }finally{await page.close();}
 }
});

test('parent masks qualify zero borders only on captured active tuples, with unresolved and nonzero borders refused',()=>{
 const {c}=read(),parent=c.anatomy.root;
 parent.literals={'border-width':'0px','border-color':'#000000','border-radius':'10px'};
 assert.doesNotThrow(()=>maskScopeHelpers.reactMaskChildPaths(c));
 parent.literals['border-width']='1px';assert.throws(()=>maskScopeHelpers.reactMaskChildPaths(c),/parent-plane-unqualified/);
 delete parent.literals['border-width'];parent.tokens={'border-width':'{border.{mode}}'};
 const mask=Object.values(parent.parts!).find(p=>p.mask)!;const geometry=mask.absoluteGeometry!;delete mask.absoluteGeometry;
 mask.absoluteGeometryByCombination={props:['mode'],rows:[{values:['default'],geometry}]};
 const tokens={primitives:{border:{default:{$type:'dimension',$value:'0px'},alternate:{$type:'dimension',$value:'1px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
 assert.doesNotThrow(()=>maskScopeHelpers.reactMaskChildPaths(c,tokens));
 assert.throws(()=>maskScopeHelpers.reactMaskChildPaths(c),/parent-plane-unqualified/);
 mask.absoluteGeometryByCombination.rows[0].values=['alternate'];assert.throws(()=>maskScopeHelpers.reactMaskChildPaths(c,tokens),/parent-plane-unqualified/);
 mask.absoluteGeometryByCombination.rows[0].values=['unknown'];assert.throws(()=>maskScopeHelpers.reactMaskChildPaths(c,tokens),/parent-plane-unqualified/);
 mask.absoluteGeometryByCombination.rows[0].values=['default'];tokens.dark={border:{default:{$type:'dimension',$value:'1px'}}};
 assert.throws(()=>maskScopeHelpers.reactMaskChildPaths(c,tokens),/parent-plane-unqualified/);
});

test('a masked FRAME paint sibling preserves its own local affine plane and refuses missing or skewed proof',()=>{
 const make=()=>{const set=fixture(),paint=set.variants[0].children![1];paint.type='FRAME';delete paint.shape;
  paint.abs={x:0,y:0,width:40,height:40,right:0,bottom:0,constraints:{horizontal:'STRETCH',vertical:'STRETCH'}};
  paint.maskedFramePlane={nodeId:'paint',parentId:'root',size:{width:40,height:40},parentSize:{width:40,height:40},relativeTransform:[[1,0,0],[0,1,0]],parentRelativeTransform:[[1,0,0],[0,1,0]]};return set;};
 const set=make(),before=JSON.stringify(set),{c}=read(set),paint=c.anatomy.root.parts!.paint;
 assert.deepEqual(paint.absoluteGeometry?.parent,{width:40,height:40});assert.equal(paint.absoluteGeometry?.box.width,40);assert.equal(JSON.stringify(set),before);
 assert.doesNotThrow(()=>generateTsx(c,new Map([[c.id,c]]),new Map()));
 for(const fault of ['missing','skew']){const input=make(),node=input.variants[0].children![1];
  if(fault==='missing')delete node.maskedFramePlane;else node.maskedFramePlane!.relativeTransform[0][1]=.1;
  const result=read(input).c;assert.throws(()=>generateTsx(result,new Map([[result.id,result]]),new Map()),/sibling-plane-unqualified/);
 }
});

test('growth validation requires tuple separation for conditional floors and retains explicit base floors',async()=>{
 const {validateContract}=await import('../packages/core/src/validate.js');
 const r=proposeFromDump(mixedSizingFixture(),{corpus,mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(r.contract);
 const errors=(input:typeof c)=>{const out:string[]=[];validateContract(input,new Map([[input.id,input]]),out,new Map());return out;};
 assert.deepEqual(errors(c),[]);
 const overlapping=structuredClone(c),table=overlapping.anatomy.root.parts!.Track.literalsByCombination![0];
 const i=table.props.indexOf('mode');table.rows[0].values[i]='fill';
 assert(errors(overlapping).some(e=>e.includes('growth-constraint-unproven')));
 const base=structuredClone(c);base.anatomy.root.parts!.Track.literals={'min-width':'164px'};
 assert.deepEqual(errors(base),[],'an explicit base floor remains authoritative during FILL');
 const incomplete=structuredClone(c),partial=incomplete.anatomy.root.parts!.Track.literalsByCombination![0];
 partial.props=['size'];partial.rows=partial.rows.map(row=>({...row,values:[row.values[table.props.indexOf('size')]]}));
 assert(errors(incomplete).some(e=>e.includes('growth-constraint-unproven')));
});

test('a filled path following a mask retains the same captured sibling plane',()=>{
 const set=fixture(),paint=set.variants[0].children![1];paint.type='VECTOR';paint.name='arbitrary paint';paint.shape={...paint.shape!,kind:'path',paths:[{data:'M0 0L40 0L40 40L0 40Z M5 5L35 5L35 35L5 35Z',windingRule:'EVENODD'}]};
 const before=JSON.stringify(set),{c}=read(set),child=walkAnatomy(c).find(x=>x.name==='arbitraryPaint')?.part ?? walkAnatomy(c).find(x=>x.part.shape?.kind==='path')!.part;
 assert(child.absoluteGeometry);assert.equal(child.absoluteGeometry.parent.width,40);assert.equal(child.absoluteGeometry.parent.height,40);assert.deepEqual(child.shape?.paths,paint.shape.paths);assert.equal(JSON.stringify(set),before);
 assert.doesNotThrow(()=>maskScopeHelpers.reactMaskChildPaths(c));
});

test('a group hidden in every captured occurrence remains non-rendering without losing its captured mask',()=>{
 const set=fixture(),children=set.variants[0].children!;set.variants[0].children=[{name:'dormant group',type:'GROUP',hidden:true,children}];
 const before=JSON.stringify(set),{c}=read(set),group=walkAnatomy(c).find(x=>x.part.declared?.display==='none')?.part;
 assert(group);assert(Object.values(group.parts??{}).some(p=>p.mask));assert.equal(JSON.stringify(set),before);
 const visible=structuredClone(set);delete visible.variants[0].children![0].hidden;assert(!walkAnatomy(read(visible).c).some(x=>x.part.declared?.display==='none'));
});

test('negative filled ellipse sectors retain their painted quadrant and masked coordinate owner on both React surfaces',async t=>{
 const set=fixture(),root=set.variants[0];
 root.children![0].shape={kind:'ellipse',width:40,height:40,x:0,y:0,right:0,bottom:0,constraints:{horizontal:'SCALE',vertical:'SCALE'}};
 const paint=root.children![1];paint.type='ELLIPSE';paint.shape={...root.children![0].shape,arc:{start:0,end:-Math.PI/2,innerRadius:0}};
 const before=JSON.stringify(set),{r,c}=read(set),part=walkAnatomy(c).find(x=>x.name==='paint')!.part;
 assert.equal(JSON.stringify(set),before);assert(part.absoluteGeometry);assert.deepEqual(part.shape!.arc,{start:-Math.PI/2,end:0,innerRadius:0});
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js');
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),scope=new Map([[c.id,c]]);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{contracts:scope,icons:new Map(),tokens:inventory,tokenValues:tokens}),{...emitReactInline(c,{tokens,icons:new Map(),contracts:scope}),css:''}]){
  const page=await browser.newPage({viewport:{width:100,height:100}});try{const render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:'body{margin:0}:root{'+[...inventory].map(path=>'--'+path.replaceAll('.','-')+':'+values.resolveLiteral(path)+';').join('')+'}'});
   for(const size of [40,80,40]){await render({style:{width:size,height:size}});const png=PNG.sync.read(await page.screenshot({omitBackground:true}));
    for(const [x,y,alpha] of [[.7,.3,255],[.3,.3,0],[.3,.7,0],[.7,.7,0],[.99,.01,0]]){
     const offset=(Math.floor(y*size)*png.width+Math.floor(x*size))*4;assert.equal(png.data[offset+3],alpha,`${size}:${x},${y}`);
     if(alpha)assert.deepEqual([...png.data.subarray(offset,offset+4)],[51,102,153,255]);
    }
   }
  }finally{await page.close();}
 }
 for(const fault of ['hole','rotation','bound']){const bad=structuredClone(set),n=bad.variants[0].children![1];if(fault==='hole')n.shape!.arc!.innerRadius=.5;if(fault==='rotation')n.shape!.rotation=20;if(fault==='bound')n.bound={width:'authored.width'};assert.equal(walkAnatomy(read(bad).c).find(x=>x.name==='paint')!.part.absoluteGeometry,undefined,fault);}
});

test('mixed auto-layout and plain frames retain explicit fixed heights on both React surfaces',async t=>{
 const layout={mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'FIXED'};
 const source:any={setName:'MixedFrame',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Auto',variantOptions:['Auto','Plain']}},variants:['Auto','Plain'].map((mode,i)=>({name:'Mode='+mode,variantProperties:{Mode:mode},type:'COMPONENT',layout,bbox:{width:280,height:200},children:[{name:'Image',type:'FRAME',fill:{hex:'334455'},fillWidth:true,fixedSize:{height:i?104:125},...(i?{}:{layout:{...layout,mode:'HORIZONTAL',primarySizing:'FIXED',counterSizing:'FIXED'}})}]}))};
 const r=proposeFromDump(source,{corpus,mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(r.contract);
 const {emitReact}=await import('./emit-react.js'),{emitReactInline}=await import('./emit-react-inline.js'),{tokenInventoryFromJson}=await import('./tokens.js'),{createFigmaEngine}=await import('./emit-figma-script.js');
 const tokens={primitives:r.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},inventory=tokenInventoryFromJson([tokens.primitives]),values=tokenCorpusFromJson({...tokens,brandDefault:{}}),contracts=new Map([[c.id,c]]);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,2);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const output=surface==='module'?emitReact(c,{contracts,icons:new Map(),tokens:inventory,tokenValues:tokens}):{...emitReactInline(c,{tokens,icons:new Map(),contracts}),css:''};
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,output.tsx,output.css);
   if(surface==='module')await page.addStyleTag({content:':root{'+[...inventory].map(p=>'--'+p.replaceAll('.','-')+':'+values.resolveLiteral(p)+';').join('')+'}'});
   for(const [mode,height] of [['auto',125],['plain',104],['auto',125]] as const){await render({mode});const box=await page.locator('#root > * > *').first().boundingBox();assert.equal(box?.height,height,surface+' '+mode);}
  }finally{await page.close();}
 }
});
