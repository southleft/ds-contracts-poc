import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {qualifyRenderBoundsExport} from './design-consumer-render-export.js';
import {qualifySourceRenderBoundsExport,validateNativeAnchorProof,type NativeAnchorProof,type SourceRenderRequests} from './design-consumer-render-anchor.js';
import {alignRecordedFrames,imageSha256,type ConsumerFrame,type FigmaFrame} from './design-consumer-framing-v2.js';
import {diffPair} from '../extract/figma/visual-parity/img.js';
import {sourceEquivalentTransitions,sourceEquivalentStateTransitions} from './design-consumer-variants.js';
const paint={type:'SOLID',color:{r:1,g:1,b:1,a:1},blendMode:'NORMAL'};
const png=(w:number,h:number,draw:(x:number,y:number)=>number[])=>{const p=new PNG({width:w,height:h});for(let y=0;y<h;y++)for(let x=0;x<w;x++)p.data.set(draw(x,y),(y*w+x)*4);return PNG.sync.write(p);};
const requests=(id='root',version='fixed'):SourceRenderRequests=>({
 layout:{fileKey:'file',nodeIds:[id],version,format:'png',scale:1,contentsOnly:true,useAbsoluteBounds:true},
 render:{fileKey:'file',nodeIds:[id],version,format:'png',scale:1,contentsOnly:true,useAbsoluteBounds:false},
});
function synthetic(two=false){
 const width=two?24:12;
 const owner=(id:string,x:number)=>({id,type:'FRAME',blendMode:'PASS_THROUGH',clipsContent:true,cornerRadius:0,cornerSmoothing:0,
  fills:[structuredClone(paint)],strokes:[],effects:[{type:'DROP_SHADOW',visible:true,blendMode:'NORMAL',radius:1,offset:{x:0,y:0}}],
  absoluteBoundingBox:{x,y:0,width:12,height:12},absoluteRenderBounds:{x:x===0?-1:x,y:-1,width:two?13:14,height:14},children:[]});
 const doc:any={id:'root',type:'COMPONENT',blendMode:'PASS_THROUGH',clipsContent:false,fills:[],strokes:[],effects:[],
  absoluteBoundingBox:{x:0,y:0,width,height:12},absoluteRenderBounds:{x:-1,y:-1,width:width+2,height:14},
  children:two?[owner('a',0),owner('b',12)]:[owner('a',0)]};
 const source={version:'fixed',nodes:{root:{document:doc}}};
 const color=(x:number,y:number)=>{x%=12;return x===4&&y===5?[10,40,100,255]:x===7&&y===8?[200,30,70,255]:[255,255,255,255];};
 const layout=png(width,12,color),render=png(width+2,14,(x,y)=>x===0||y===0||x===width+1||y===13?[220,30,20,255]:x===1&&y===1?[1,2,3,255]:color(x-1,y-1));
 return {source,layout,render,doc,requests:requests()};
}
function proofFor(s:ReturnType<typeof synthetic>,layout=s.layout,render=s.render):NativeAnchorProof{
 const q=qualifySourceRenderBoundsExport(s.source,structuredClone(s.source),'root',layout,render,s.requests);
 assert('proof'in q,JSON.stringify(q));assert('kind'in q.proof);return q.proof;
}
function edit(bytes:Buffer,fn:(p:PNG)=>void){const p=PNG.sync.read(bytes);fn(p);return PNG.sync.write(p);}
function shifted(bytes:Buffer,dx:number,dy:number){const p=PNG.sync.read(bytes);return png(p.width,p.height,(x,y)=>{
 const sx=x-dx,sy=y-dy;return sx>=0&&sy>=0&&sx<p.width&&sy<p.height?[...p.data.subarray((sy*p.width+sx)*4,(sy*p.width+sx)*4+4)]:[0,0,0,0];});}
const refuse=(s:ReturnType<typeof synthetic>,expected:string,layout=s.layout,render=s.render)=>
 assert.deepEqual(qualifySourceRenderBoundsExport(s.source,structuredClone(s.source),'root',layout,render,s.requests),{refused:expected});

test('retained source tree chooses its opaque native owner and preserves both original PNGs',()=>{
 const read=(name:string)=>readFileSync(new URL('./fixtures/render-export-source-anchor/'+name,import.meta.url));
 const before=JSON.parse(read('source.json').toString()),after=structuredClone(before),layout=read('layout.png'),render=read('render.png'),id='319:49669';
 assert.deepEqual(qualifyRenderBoundsExport(before,after,id,layout,render),{refused:'render-export-overlap-mismatch'});
 const rs=requests(id,before.version);rs.layout.fileKey=rs.render.fileKey='O2cGPbn2YCsU5ngavc80M9';
 const q=qualifySourceRenderBoundsExport(before,after,id,layout,render,rs);
 assert('proof'in q);assert('kind'in q.proof);const p=q.proof;
 assert.equal(p.anchor.ownerNodeId,'319:49678');assert.equal(p.anchor.pixels,74154);
 assert.equal(p.anchor.coordinateSha256,'3fe929aed1083f89acf7691b40389fa031c270dc310e0b492909e5436634c7a8');
 assert.equal(p.anchor.horizontalChanges,4295);assert.equal(p.anchor.verticalChanges,4689);
 assert.deepEqual(p.layoutInRender,{x:14,y:0});assert.equal(p.layoutSha256,'4327357f9462cf4ea680b85556a3fe8c618df5754c75467320d5b57c1768e704');
 assert.equal(p.renderSha256,'7341c4921751e3f089749ad119b32d626a0329bbc0fcef002704a61b7ae9fb31');
 assert(validateNativeAnchorProof(p,render,p.layout,p.render));
 assert.equal(imageSha256(layout),p.layoutSha256);assert.equal(imageSha256(render),p.renderSha256);
});

test('every old success/refusal other than overlap mismatch remains byte-for-byte unchanged',()=>{
 const s=synthetic(),badRequests={} as SourceRenderRequests;
 for(const [before,after,layout,render]of [
  [s.source,s.source,s.layout,png(13,14,()=>[0,0,0,0])],
  [s.source,{...s.source,version:'changed'},s.layout,s.render],
 ] as const)assert.deepEqual(qualifySourceRenderBoundsExport(before,after,'root',layout,render,badRequests),qualifyRenderBoundsExport(before,after,'root',layout,render));
 const read=(name:string)=>readFileSync(new URL('./fixtures/render-export-blockquote/'+name,import.meta.url));
 const b=JSON.parse(read('snapshots.json').toString());
 assert.deepEqual(qualifySourceRenderBoundsExport(b.before,b.after,'854:34261',read('layout.png'),read('render.png'),badRequests),
  qualifyRenderBoundsExport(b.before,b.after,'854:34261',read('layout.png'),read('render.png')));
});

test('source identity, complete currentness and exact request modes are required',()=>{
 const s=synthetic();
 for(const change of [(r:SourceRenderRequests)=>r.layout.version='old',(r:SourceRenderRequests)=>r.render.fileKey='other',
  (r:SourceRenderRequests)=>r.layout.nodeIds=['other'],(r:SourceRenderRequests)=>r.render.useAbsoluteBounds=true,
  (r:SourceRenderRequests)=>(r.render as any).scale=2,(r:SourceRenderRequests)=>(r.layout as any).contentsOnly=false]){
  const q=synthetic();change(q.requests);refuse(q,'render-anchor-request-mismatch');
 }
 const after=structuredClone(s.source);(after.nodes.root.document.children[0] as any).children=[{id:'invisible',visible:false}];
 assert.deepEqual(qualifySourceRenderBoundsExport(s.source,after,'root',s.layout,s.render,s.requests),{refused:'figma-node-changed-during-export:root'});
 const fractional=synthetic();fractional.doc.absoluteRenderBounds.x=-1.5;
 assert.deepEqual(qualifySourceRenderBoundsExport(fractional.source,fractional.source,'root',fractional.layout,fractional.render,fractional.requests),{refused:'render-export-fractional-origin'});
});

test('visibility, opacity, fill blend, transforms, masks and unproved effect context refuse',()=>{
 const mutations:((s:ReturnType<typeof synthetic>)=>void)[]=[
  s=>s.doc.visible=false,s=>s.doc.opacity=0,s=>s.doc.opacity=0.5,
  s=>s.doc.children[0].visible=false,s=>s.doc.children[0].opacity=0.5,
  s=>s.doc.children[0].fills[0].blendMode='MULTIPLY',s=>s.doc.children[0].blendMode='MULTIPLY',
  s=>(s.doc.children[0] as any).rotation=1,s=>(s.doc.children[0] as any).relativeTransform=[[1,0,1],[0,1,0]],
  s=>(s.doc.children[0] as any).absoluteTransform=[[-1,0,0],[0,1,0]],
  s=>(s.doc.children[0] as any).relativeTransform=[[2,0,0],[0,1,0]],
  s=>(s.doc.children[0] as any).relativeTransform=[[1,0.1,0],[0,1,0]],
  s=>(s.doc.children[0] as any).isMask=true,s=>(s.doc.children[0] as any).maskType='ALPHA',
  s=>s.doc.children[0].effects[0].type='INNER_SHADOW',s=>s.doc.children[0].effects[0].type='BACKGROUND_BLUR',
  s=>s.doc.children[0].cornerSmoothing=0.2,s=>s.doc.children[0].cornerRadius=7,
  s=>(s.doc.children[0] as any).rectangleCornerRadii=[0,0,1,0],s=>s.doc.children[0].clipsContent=false,
  s=>s.doc.effects=[{type:'DROP_SHADOW'}] as any,s=>s.doc.children.push(null),
 ];
 for(const mutate of mutations){const s:any=synthetic();mutate(s);refuse(s,'render-anchor-source-unsupported');}
 const translated:any=synthetic();translated.doc.children[0].relativeTransform=[[1,0,0],[0,1,0]];assert(proofFor(translated));
 const descendant:any=synthetic();descendant.doc.children[0].children=[{id:'child',type:'RECTANGLE',blendMode:'NORMAL',absoluteBoundingBox:{x:2,y:2,width:2,height:2},effects:[{type:'LAYER_BLUR',radius:2}]}];
 refuse(descendant,'render-anchor-source-unsupported');
 const mask:any=synthetic();mask.doc.children.unshift({id:'mask',type:'RECTANGLE',isMask:true,absoluteBoundingBox:{x:0,y:0,width:12,height:12},absoluteRenderBounds:{x:0,y:0,width:12,height:12}});
 refuse(mask,'render-anchor-source-unsupported');
});

test('missing REST defaults remain valid but explicitly malformed node, paint and effect fields refuse',()=>{
 assert(proofFor(synthetic()));
 const nodeValues:Record<string,unknown[]>={visible:[null,0,'true'],opacity:[null,'1',-1,2],
  blendMode:[null,0,''],rotation:[null,'0'],isMask:[null,1,'false'],clipsContent:[null,0,'true'],
  cornerRadius:[null,'0'],cornerSmoothing:[null,'0']};
 for(const [key,values]of Object.entries(nodeValues))for(const value of values){
  const s=synthetic();s.doc.children[0][key]=value;refuse(s,'render-anchor-source-unsupported');
 }
 const mutations:((s:ReturnType<typeof synthetic>)=>void)[]=[
  s=>s.doc.opacity=null,s=>s.doc.blendMode=null,s=>s.doc.isMask='false',
  s=>s.doc.children[0].fills[0].opacity=null,s=>s.doc.children[0].fills[0].blendMode=null,
  s=>s.doc.children[0].fills[0].visible='true',s=>s.doc.children[0].fills[0].color.a=null,
  s=>s.doc.children[0].fills[0].color=null,
  s=>s.doc.children[0].effects[0].visible=null,s=>s.doc.children[0].effects[0].opacity=null,
  s=>s.doc.children[0].effects[0].blendMode=null,
  s=>s.doc.children[0].effects[0].color={r:0,g:0,b:0,a:null},
 ];
 for(const mutate of mutations){const s=synthetic();mutate(s);refuse(s,'render-anchor-source-unsupported');}
 const base=synthetic(),p=proofFor(base);
 for(const mutate of mutations){const s=synthetic();mutate(s);
  // A malformed source witness must refuse even if its self-hash is refreshed;
  // it is invalid geometry context, not merely a stale-byte check.
  const copy=structuredClone(p);copy.sourceDocument=s.doc;
  copy.sourceBeforeNodeSha256=copy.sourceAfterNodeSha256=createHash('sha256').update(JSON.stringify(s.doc)).digest('hex');
  assert.equal(validateNativeAnchorProof(copy,base.render,copy.layout,copy.render),false);
 }
});

test('later paint blocks an owner, invisible noncovering paint does not, and ancestor rounded clipping is geometric',()=>{
 const s:any=synthetic();s.doc.children.push({id:'cover',type:'RECTANGLE',absoluteBoundingBox:{x:4,y:4,width:2,height:2},absoluteRenderBounds:{x:4,y:4,width:2,height:2},fills:[paint]});
 refuse(s,'render-anchor-source-unsupported');s.doc.children[1].visible=false;assert.equal(proofFor(s).anchor.ownerNodeId,'a');
 s.doc.children[1].visible=true;delete s.doc.children[1].absoluteRenderBounds;refuse(s,'render-anchor-source-unsupported');
 const rounded:any=synthetic();rounded.doc.clipsContent=true;rounded.doc.cornerRadius=6;
 const p=proofFor(rounded);assert.equal(p.anchor.pixels,88); // Closed cells touching the radius-six circle are excluded.
 rounded.doc.rectangleCornerRadii=[6,6,5,6];refuse(rounded,'render-anchor-source-unsupported');
 const dyadic:any=synthetic();dyadic.doc.children[0].cornerRadius=0.5;assert(proofFor(dyadic));
 dyadic.doc.children[0].cornerRadius=0.1;refuse(dyadic,'render-anchor-source-unsupported');
 const tiny:any=synthetic();tiny.doc.children[0].absoluteBoundingBox={x:0,y:0,width:1,height:1};refuse(tiny,'render-anchor-source-unsupported');
});

test('fixed selection refuses shifts, missing content, nonopacity and one-dimensional evidence without retry',()=>{
 const s=synthetic();
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])assert('refused'in qualifySourceRenderBoundsExport(s.source,s.source,'root',s.layout,shifted(s.render,dx,dy),s.requests));
 refuse(s,'render-anchor-pixel-mismatch',s.layout,edit(s.render,p=>p.data.set([40,50,60,255],((5+1)*p.width+4+1)*4)));
 refuse(s,'render-anchor-not-opaque',s.layout,edit(s.render,p=>p.data[((5+1)*p.width+4+1)*4+3]=254));
 for(const draw of [(x:number,_y:number)=>[x%2?0:255,0,0,255],(_x:number,y:number)=>[y%2?0:255,0,0,255],()=>[80,80,80,255]]){
  const layout=png(12,12,draw),render=png(14,14,(x,y)=>x===1&&y===1?[1,2,3,255]:draw(x-1,y-1));
  refuse(s,'render-anchor-origin-unobservable',layout,render);
 }
 const two=synthetic(true),p=proofFor(two);assert.equal(p.anchor.ownerNodeId,'a');
 const bad=edit(two.render,png=>png.data.set([9,8,7,255],(6*png.width+5)*4));refuse(two,'render-anchor-pixel-mismatch',two.layout,bad);
 const outside=edit(two.render,png=>png.data.set([80,40,20,255],0));assert.equal(proofFor(two,two.layout,outside).anchor.coordinateSha256,p.anchor.coordinateSha256);
});

test('periodic evidence proves correspondence at the metadata offset, not a unique origin',()=>{
 const s=synthetic(),pattern=(x:number,y:number)=>[(x+y)%2?30:220,40,100,255];
 const layout=png(12,12,pattern),render=png(14,14,(x,y)=>x===1&&y===1?[1,2,3,255]:pattern(x-1-2,y-1));
 const p=proofFor(s,layout,render);assert(p.anchor.horizontalChanges>0&&p.anchor.verticalChanges>0);
 assert.deepEqual(p.layoutInRender,{x:1,y:1}); // Period two survives a two-pixel shift; no uniqueness claim/search.
});

test('consumer reselects source geometry and binds requests, witness, full PNG and evidence counts',()=>{
 const s=synthetic(),p=proofFor(s);assert(validateNativeAnchorProof(p,s.render,p.layout,p.render));
 const changes:((p:any)=>void)[]=[p=>p.nodeId='other',p=>p.fileKey='other',p=>delete p.fileKey,p=>p.fileKey=null,p=>p.version='stale',p=>p.layoutSha256='bad',
  p=>p.layoutInRender.x=0,p=>p.requests.render.useAbsoluteBounds=true,p=>p.anchor.coordinateSha256='0'.repeat(64),
  p=>p.anchor.ownerNodeId='other',p=>p.anchor.pixels--,p=>p.anchor.horizontalChanges++,p=>p.anchor.rgbaSha256='0'.repeat(64),
  p=>p.sourceDocument.children.push({id:'hidden',visible:false}),p=>p.sourceDocument.children[0].cornerRadius=2,
  p=>p.sourceAfterNodeSha256='0'.repeat(64),p=>p.layoutSpan.width--,p=>p.renderSpan.height--,p=>p.wholeOverlapRefusal='other'];
 for(const change of changes){const copy=structuredClone(p);change(copy);assert.equal(validateNativeAnchorProof(copy,s.render,p.layout,p.render),false);}
 const mutated=edit(s.render,p=>p.data[0]^=1);assert.equal(validateNativeAnchorProof(p,mutated,p.layout,p.render),false);
 // The producer detached the recorded source witness from mutable callers.
 (s.doc as any).name='changed after production';assert(validateNativeAnchorProof(p,s.render,p.layout,p.render));
});

test('the complete render still enters both unmasked five-percent gates, including outside-anchor paint',()=>{
 const s=synthetic(),p=proofFor(s),bytes=s.render;
 const consumer:ConsumerFrame={layout:{x:1,y:1,width:12,height:12},capture:{x:0,y:0,width:14,height:14},deviceScaleFactor:1,pngSha256:imageSha256(bytes),raster:{kind:'browser-paint-extent-v1',paint:{x:0,y:0,width:14,height:14}}};
 const figma:FigmaFrame={layout:p.layout,render:p.render,pngSha256:p.renderSha256,raster:{kind:'figma-rest-source-opaque-anchor-v1',scale:1,proof:p}};
 const missing=edit(bytes,png=>{for(let y=0;y<14;y++)for(let x=0;x<14;x++)if(x===0||y===0||x===13||y===13)png.data.fill(0,(y*14+x)*4,(y*14+x)*4+4);});
 assert(validateNativeAnchorProof(p,bytes,p.layout,p.render));
 for(const bg of [0,255] as const){
  const exact=alignRecordedFrames(bytes,bytes,consumer,figma,bg);assert('aligned'in exact);assert.deepEqual(exact.aligned.a.data,exact.aligned.b.data);
  const pair=alignRecordedFrames(missing,bytes,{...consumer,pngSha256:imageSha256(missing)},figma,bg);
  assert('aligned'in pair);assert(diffPair(pair.aligned,[]).unmaskedPct>5);
 }
 assert.deepEqual(alignRecordedFrames(bytes,bytes,consumer,{...figma,raster:{...figma.raster!,proof:{...p,anchor:{...p.anchor,pixels:1}}} as any},0),{refused:'figma-render-anchor-proof-mismatch'});
 assert.deepEqual(alignRecordedFrames(bytes,missing,consumer,figma,0),{refused:'figma-render-anchor-proof-mismatch'});
});


// These two distinct source nodes intentionally draw identical full exports.
// Their node-specific proofs cannot be compared as one serialized object.
function equivalentAnchorVariant(nodeId:string,x:number,y:number,fileKey='file',version='fixed') {
 const s=synthetic();s.doc.id=nodeId;s.doc.children[0].id=nodeId+':owner';
 for(const n of [s.doc,...s.doc.children])for(const key of ['absoluteBoundingBox','absoluteRenderBounds']){
  n[key].x+=x;n[key].y+=y;
 }
 const source={version,nodes:{[nodeId]:{document:s.doc}}},rs=requests(nodeId,version);
 rs.layout.fileKey=rs.render.fileKey=fileKey;
 const qualify=(bytes:Buffer)=>{
  const result=qualifySourceRenderBoundsExport(source,structuredClone(source),nodeId,s.layout,bytes,rs);
  assert('proof'in result,JSON.stringify(result));assert('kind'in result.proof);return result.proof;
 };
 const proof=qualify(s.render);
 const frame:FigmaFrame={layout:{...proof.layout},render:{...proof.render},pngSha256:imageSha256(s.render),
  raster:{kind:'figma-rest-source-opaque-anchor-v1',scale:1,proof}};
 return {bytes:s.render,proof,frame,qualify};
}
function equivalentAnchorFixture(options:{fileKey?:string;version?:string}={}) {
 const a=equivalentAnchorVariant('one',10,20),b=equivalentAnchorVariant('two',100,200,options.fileKey,options.version);
 const cases=[{key:'off',nodeId:'one',interaction:'none',props:{selected:false}},
  {key:'on',nodeId:'two',interaction:'none',props:{selected:true}}];
 const images:Record<string,Buffer>={one:a.bytes,two:b.bytes},frames:Record<string,FigmaFrame>={one:a.frame,two:b.frame};
 const inspect=()=>sourceEquivalentTransitions(cases,'selected',true,['off'],images,frames);
 return {a,b,cases,images,frames,inspect};
}

test('source anchor equivalence validates each distinct node before comparing complete exports',()=>{
 const f=equivalentAnchorFixture();
 assert.notDeepEqual(f.a.proof,f.b.proof);
 assert(validateNativeAnchorProof(f.a.proof,f.images.one,f.frames.one.layout,f.frames.one.render));
 assert(validateNativeAnchorProof(f.b.proof,f.images.two,f.frames.two.layout,f.frames.two.render));
 assert.deepEqual(f.inspect(),[{from:'off',to:'on',fromNodeId:'one',toNodeId:'two',
  pngSha256:imageSha256(f.a.bytes),layoutSize:{width:12,height:12}}]);
});

test('source anchor equivalence refuses independently valid foreign file or version evidence',()=>{
 for(const options of [{fileKey:'other-file'},{version:'other-version'}]){
  const f=equivalentAnchorFixture(options);
  assert(validateNativeAnchorProof(f.b.proof,f.b.bytes,f.b.frame.layout,f.b.frame.render));
  assert.deepEqual(f.inspect(),[]);
 }
});

test('source anchor equivalence binds both independently valid proofs to their respective case IDs',()=>{
 for(const nodeId of ['one','two']){
  const f=equivalentAnchorFixture(),other=nodeId==='one'?'two':'one';
  f.frames[nodeId]=structuredClone(f.frames[other]);
  const frame=f.frames[nodeId];assert(frame.raster?.kind==='figma-rest-source-opaque-anchor-v1');
  assert(validateNativeAnchorProof(frame.raster.proof,f.images[nodeId],frame.layout,frame.render));
  assert.deepEqual(f.inspect(),[]);
 }
});

test('source anchor equivalence does not accept mixed kinds or malformed scale through legacy comparison',()=>{
 for(const other of [undefined,{kind:'figma-rest-full-bounds-v1',scale:1},{kind:'figma-rest-paired-render-v1',scale:1,proof:{}}]){
  const f=equivalentAnchorFixture();(f.frames.two as any).raster=other;assert.deepEqual(f.inspect(),[]);
 }
 for(const scale of [0,2,undefined]){
  const f=equivalentAnchorFixture();
  (f.frames.one.raster as any).scale=scale;(f.frames.two.raster as any).scale=scale;
  assert.deepEqual(f.inspect(),[]);
 }
});

test('source anchor equivalence revalidates source and PNG integrity instead of comparing proof labels',()=>{
 const mutations:((f:ReturnType<typeof equivalentAnchorFixture>)=>void)[]=[
  f=>{f.b.proof.anchor.coordinateSha256='0'.repeat(64);},
  f=>{f.b.proof.sourceBeforeNodeSha256='0'.repeat(64);},
  f=>{f.b.proof.requests.render.nodeIds=['foreign'];},
  f=>{f.b.proof.sourceDocument.children[0].clipsContent=false;},
  f=>{f.frames.two.pngSha256='0'.repeat(64);},
  f=>{const bytes=Buffer.from('not a PNG');f.images.one=f.images.two=bytes;
   f.frames.one.pngSha256=f.frames.two.pngSha256=imageSha256(bytes);
   f.a.proof.renderSha256=f.b.proof.renderSha256=imageSha256(bytes);},
  f=>{const bytes=edit(f.b.bytes,p=>p.data[0]^=1);f.images.one=f.images.two=bytes;
   f.frames.one.pngSha256=f.frames.two.pngSha256=imageSha256(bytes);},
 ];
 for(const mutate of mutations){const f=equivalentAnchorFixture();mutate(f);assert.deepEqual(f.inspect(),[]);}
});

test('source anchor interior equality never excuses a difference elsewhere in the original PNG',()=>{
 const f=equivalentAnchorFixture(),bytes=edit(f.b.bytes,p=>p.data.set([80,40,20,255],0));
 const proof=f.b.qualify(bytes);
 assert(validateNativeAnchorProof(proof,bytes,proof.layout,proof.render));
 assert.equal(proof.anchor.rgbaSha256,f.a.proof.anchor.rgbaSha256);
 f.images.two=bytes;f.frames.two={layout:proof.layout,render:proof.render,pngSha256:imageSha256(bytes),
  raster:{kind:'figma-rest-source-opaque-anchor-v1',scale:1,proof}};
 assert.deepEqual(f.inspect(),[]);
});

test('source anchor equivalence still requires exact recorded relative geometry',()=>{
 // A periodic texture can produce valid correspondence at two different
 // metadata offsets. Full-byte equality must not erase that layout difference.
 const pattern=(x:number,y:number)=>[(x+y)%2?30:220,40,100,255];
 const layout=png(12,12,pattern),render=png(16,14,(x,y)=>y===1&&(x===1||x===3)?[1,2,3,255]:pattern(x-1,y-1));
 const records=['one','two'].map((id,index)=>{
  const s=synthetic(),x=index*2;
  s.doc.id=id;s.doc.absoluteBoundingBox.x=x;
  s.doc.absoluteRenderBounds={x:-1,y:-1,width:16,height:14};
  s.doc.children[0].id=id+':owner';s.doc.children[0].absoluteBoundingBox.x=x;
  s.doc.children[0].absoluteRenderBounds={...s.doc.absoluteRenderBounds};
  const source={version:'fixed',nodes:{[id]:{document:s.doc}}};
  const result=qualifySourceRenderBoundsExport(source,structuredClone(source),id,layout,render,requests(id));
  assert('proof'in result,JSON.stringify(result));assert('kind'in result.proof);const proof=result.proof;
  assert(validateNativeAnchorProof(proof,render,proof.layout,proof.render));
  return [id,{layout:proof.layout,render:proof.render,pngSha256:imageSha256(render),
   raster:{kind:'figma-rest-source-opaque-anchor-v1',scale:1,proof}}] as const;
 });
 const valid=equivalentAnchorFixture();
 assert.deepEqual(sourceEquivalentTransitions(valid.cases,'selected',true,['off'],
  {one:render,two:render},Object.fromEntries(records)),[]);
 for(const mutate of [(f:FigmaFrame)=>{f.layout.width+=0.125;},(f:FigmaFrame)=>{f.render.x+=1;},
  (f:FigmaFrame)=>{f.render.height+=1;},(f:FigmaFrame)=>{f.layout.height=NaN;}]){
  const f=equivalentAnchorFixture();mutate(f.frames.two);assert.deepEqual(f.inspect(),[]);
 }
});

test('source anchor equality supplies no semantic or interaction reachability credit',()=>{
 const f=equivalentAnchorFixture(),result=f.inspect();
 assert.deepEqual(Object.keys(result[0]).sort(),['from','fromNodeId','layoutSize','pngSha256','to','toNodeId']);
 f.cases[1].interaction='hover';assert.deepEqual(f.inspect(),[]);
 const states=[{key:'off',nodeId:'one',interaction:'hover',state:'hover',props:{}},
  {key:'on',nodeId:'two',interaction:'none',props:{}}];
 assert.deepEqual(sourceEquivalentStateTransitions(states,['off'],f.images,f.frames),[],
  'the separate interaction-state path still requires explicit full-bounds raster evidence');
});

test('source anchor change preserves equivalent legacy absent-raster and full-bounds pairs',()=>{
 for(const raster of [undefined,{kind:'figma-rest-full-bounds-v1' as const,scale:1 as const}]){
  const f=equivalentAnchorFixture();f.frames.one.raster=raster;f.frames.two.raster=raster;
  assert.equal(f.inspect().length,1);
 }
});
