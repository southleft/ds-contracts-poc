import test from 'node:test';
import assert from 'node:assert/strict';
import {observedOwnPercentageSize} from './react-style-origin.js';
import {readObservedAuthoredLayout,observedLayoutContext} from './react-authored-layout.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactStyleOrigin,ReactDescendantSizes} from './react-style-origin.js';
import type {NodeSpec} from '../core/emit-figma-script.js';
const plain=(width:number,height:number,display='block')=>({width:Number(width.toPrecision(6))+'px',height:Number(height.toPrecision(6))+'px',display,'writing-mode':'horizontal-tb',position:'static',float:'none',zoom:'1',transform:'none',translate:'none',rotate:'none',scale:'none',perspective:'none',...Object.fromEntries(['padding-left','padding-right','padding-top','padding-bottom','border-left-width','border-right-width','border-top-width','border-bottom-width'].map(k=>[k,'0px']))});
function fixture(width=200,percent=10){
 const inner:CapturedNode={tag:'div',classes:[],pseudo:{},style:plain(width*percent/100,4),nodes:[]};
 const track:CapturedNode={tag:'div',classes:[],pseudo:{},style:plain(width,4),nodes:[{t:'el',el:inner}]};
 const tree:CapturedNode={tag:'div',classes:[],pseudo:{},style:plain(width,4,'flex'),nodes:[{t:'el',el:track}]};
 const origin:ReactStyleOrigin={version:1,roots:[{path:'',tag:'div',channels:[],sizes:[{channel:'width',status:'auto',value:'auto',selectors:[]},{channel:'height',status:'fixed',value:'4px',authoredValue:'4px',selectors:['.root']}]}]};
 const relative=(channel:'width'|'height',p:number,parent:number)=>({channel,status:'unresolved' as const,authoredValue:p+'%',selectors:['.part'],reason:'responsive-or-unsupported-size-expression',observedPercentage:{percent:p,parentSize:parent,usedSize:parent*p/100}});
 const descendants:ReactDescendantSizes={version:1,nodes:[{path:'0',tag:'div',sizes:[relative('width',100,width),relative('height',100,4)]},{path:'0.0',tag:'div',sizes:[relative('width',percent,width),relative('height',100,4)]}]};
 const spec:NodeSpec={type:'root',name:'root',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN'},children:[{type:'frame',name:'track',layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN'},children:[{type:'frame',name:'ink',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN'},children:[]}]}]};
 const paths=[{sourcePath:'0',partName:'track',specPath:[0],type:'frame'},{sourcePath:'0.0',partName:'ink',specPath:[0,0],type:'frame'}];
 return {tree,track,inner,origin,descendants,spec,paths,bounds:{width,height:4}};
}
test('observed host and percentages retain source relations at more than one width',()=>{
 for(const [width,percent] of [[200,10],[320,25],[205.75,12.5]]){
  const f=fixture(width,percent),layout=readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds)!;
  assert.deepEqual(layout.host,{width,height:4});assert.equal(layout.rows[1].width?.value,percent);
  const context=observedLayoutContext(layout,'test.component','a'.repeat(64),f.spec,f.paths);
  assert.deepEqual(context.parts,[{path:[0],width:{kind:'percent',value:100},height:{kind:'percent',value:100}},{path:[0,0],width:{kind:'percent',value:percent},height:{kind:'percent',value:100}}]);
  assert.equal('fixedWidth' in f.spec,false,'measured host width is not a component token');
 }
});
test('old measured-only archives and matching pixel ratios do not establish percentages',()=>{
 const f=fixture();assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,undefined,f.bounds),/descendant-evidence-required/);
 for(const row of f.descendants.nodes)for(const size of row.sizes)delete size.observedPercentage;
 assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),/percentage-unqualified/);
});
for(const [name,change] of Object.entries({
 'clamped used width':(f:ReturnType<typeof fixture>)=>{f.inner.style.width='21px';},
 'padding':(f:ReturnType<typeof fixture>)=>{f.inner.style['padding-left']='1px';},
 'border':(f:ReturnType<typeof fixture>)=>{f.track.style['border-left-width']='1px';},
 'zoom':(f:ReturnType<typeof fixture>)=>{f.inner.style.zoom='2';},
 'transform':(f:ReturnType<typeof fixture>)=>{f.inner.style.transform='matrix(1,0,0,1,0,0)';},
 'vertical writing mode':(f:ReturnType<typeof fixture>)=>{f.tree.style['writing-mode']='vertical-rl';},
 'outer selector proof':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[0].reason='size-declared-by-outer-selector';},
 'registered variable proof':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[0].reason='registered-size-variable-provenance-unqualified';},
 'out of flow':(f:ReturnType<typeof fixture>)=>{f.inner.style.position='absolute';},
 'variable':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[0].authoredValue='var(--size)';},
 'calc':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[0].authoredValue='calc(10% + 0px)';},
 'foreign parent':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[0].observedPercentage!.parentSize=201;},
 'string proof':(f:ReturnType<typeof fixture>)=>{(f.descendants.nodes[1].sizes[0].observedPercentage as any).parentSize='200';},
 'zero percent':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[0].authoredValue='0%';},
 'fractional height':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].sizes[1].authoredValue='50%';},
 'duplicate path':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes.push(structuredClone(f.descendants.nodes[0]));},
 'wrong tag':(f:ReturnType<typeof fixture>)=>{f.descendants.nodes[1].tag='span';},
}))test('observed layout refuses '+name,()=>{
 const f=fixture();change(f);assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),/react-authored-layout-/);
});
test('source-to-native percent paths require the exact compiler correspondence',()=>{
 const f=fixture(),layout=readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds)!;
 assert.throws(()=>observedLayoutContext(layout,'test','a'.repeat(64),f.spec,f.paths.map(p=>({...p,specPath:[0]}))),/part-layout-unqualified/);
 assert.throws(()=>observedLayoutContext(layout,'test','a'.repeat(64),f.spec,[]),/part-correspondence-unavailable/);
});
test('existing fixed-width roots do not acquire measured preview width authority',()=>{
 const f=fixture();f.origin.roots[0].sizes![0]={channel:'width',status:'fixed',value:'200px',selectors:['.root']};
 assert.equal(readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),undefined);
});


test('capture witness requires own typed percent and unchanged box geometry',()=>{
 const input={authored:'10%',own:true,typed:{unit:'percent',value:10},parent:200,used:20,edges:0,animated:false,zoomed:false,contextSafe:true,writingMode:'horizontal-tb',position:'static',float:'none',transform:'none'};
 assert.deepEqual(observedOwnPercentageSize(input),{percent:10,parentSize:200,usedSize:20});
 for(const change of [{own:false},{contextSafe:false},{writingMode:'vertical-rl'},{typed:{unit:'px',value:20}},{authored:'var(--fraction)'},{authored:'calc(10% + 0px)'},{used:21},{parent:undefined},{edges:1},{animated:true},{ancestorAnimated:true},{zoomed:true},{position:'absolute'},{float:'left'},{transform:'matrix(1,0,0,1,0,0)'}])
  assert.equal(observedOwnPercentageSize({...input,...change}),undefined,JSON.stringify(change));
});
test('host extent must match independently recorded selector bounds',()=>{
 const f=fixture();assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,f.descendants),/host-bounds-unqualified/);
 assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,f.descendants,{width:201,height:4}),/host-bounds-unqualified/);
});


function fillFixture(width=820){
 const f=fixture(width-24,100);
 Object.assign(f.tree.style,plain(width,44,'flex'),{'box-sizing':'border-box','padding-left':'12px','padding-right':'12px','padding-top':'12px','padding-bottom':'12px',
  'margin-left':'0px','margin-right':'0px','margin-top':'0px','margin-bottom':'0px','min-width':'0px','min-height':'0px','max-width':'none','max-height':'none','flex-grow':'0','flex-basis':'auto'});
 f.track.style=plain(width-24,20);f.inner.style=plain(width-24,20);
 f.origin.roots[0].sizes=[{channel:'width',status:'unresolved',authoredValue:'100%',selectors:['.root'],reason:'declared-fill-width-containing-block-viewport-only'},
  {channel:'height',status:'auto',value:'auto',selectors:[]}];
 f.descendants.nodes=[{path:'0',tag:'div',sizes:[{channel:'width',status:'auto',value:'auto',selectors:[]},{channel:'height',status:'auto',value:'auto',selectors:[]}]},
  {path:'0.0',tag:'div',sizes:[{channel:'width',status:'unresolved',authoredValue:'100%',selectors:['.label'],reason:'declared-fill-width-containing-block-indefinite',observedPercentage:{percent:100,parentSize:width-24,usedSize:width-24}},
   {channel:'height',status:'auto',value:'auto',selectors:[]}]}];
 f.bounds={width,height:44};return f;
}
test('own full-width padded roots retain only the captured host and proven descendant percentages',()=>{
 for(const width of [820,320.5]){
  const f=fillFixture(width),before=structuredClone(f),layout=readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds)!;
  assert.deepEqual(layout,{host:{width,height:44},rows:[{path:'0.0',width:{kind:'percent',value:100}}]});
  const context=observedLayoutContext(layout,'fill.component','b'.repeat(64),f.spec,f.paths);
  assert.deepEqual(context.parts,[{path:[0,0],width:{kind:'percent',value:100}}]);
  assert.equal(f.spec.fixedWidth,undefined);assert.equal(f.spec.fixedHeight,undefined);assert.deepEqual(f,before,'source and compiler correspondence remain unchanged');
 }
});
test('own full-width root needs no invented child percentage or reusable size',()=>{
 const f=fillFixture();f.tree.nodes=[];f.descendants.nodes=[];
 const layout=readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds)!;
 assert.deepEqual(layout,{host:{width:820,height:44},rows:[]});
 assert.deepEqual(observedLayoutContext(layout,'fill.component','b'.repeat(64),f.spec,[]).parts,[]);
});
test('root full-width lane does not accept automatic opaque foreign or definite-containing-block sizing',()=>{
 for(const width of [
  {channel:'width',status:'auto',value:'auto',selectors:[]},
  {channel:'width',status:'unresolved',authoredValue:'var(--width)',selectors:['.root'],reason:'declared-fill-width-containing-block-viewport-only'},
  {channel:'width',status:'unresolved',authoredValue:'100%',selectors:['#wrapper > *'],reason:'size-declared-by-outer-selector'},
  {channel:'width',status:'unresolved',authoredValue:'100%',selectors:['.root'],reason:'declared-fill-width-not-used'},
  {channel:'width',status:'fill',authoredValue:'100%',value:'100%',selectors:['.root']},
 ] as const){
  const f=fillFixture();f.origin.roots[0].sizes![0]={...width,selectors:[...width.selectors]};
  if(width.status==='auto')assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),/root-context-unqualified/);
  else assert.equal(readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),undefined);
 }
 const f=fillFixture();f.origin.roots[0].sizes=[];assert.equal(readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),undefined);
});
for(const [name,change] of Object.entries({
 'duplicate root':(f:ReturnType<typeof fillFixture>)=>{f.origin.roots.push(structuredClone(f.origin.roots[0]));},
 'duplicate size':(f:ReturnType<typeof fillFixture>)=>{f.origin.roots[0].sizes!.push(structuredClone(f.origin.roots[0].sizes![0]));},
 'missing own selector':(f:ReturnType<typeof fillFixture>)=>{f.origin.roots[0].sizes![0].selectors=[];},
 'contradictory definite container':(f:ReturnType<typeof fillFixture>)=>{f.origin.roots[0].fillWidthContainer={depth:1};},
 'fixed height':(f:ReturnType<typeof fillFixture>)=>{f.origin.roots[0].sizes![1]={channel:'height',status:'fixed',value:'44px',selectors:['.root']};},
 'content-box':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['box-sizing']='content-box';},
 'border':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['border-left-width']='1px';},
 'unknown padding':(f:ReturnType<typeof fillFixture>)=>{delete f.tree.style['padding-left'];},
 'negative padding':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['padding-left']='-1px';},
 'consumed content box':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['padding-left']='808px';},
 'margin':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['margin-left']='1px';},
 'min-width':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['min-width']='100px';},
 'max-width':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['max-width']='820px';},
 'max-height':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['max-height']='44px';},
 'grown root':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['flex-grow']='1';},
 'flex basis':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['flex-basis']='100%';},
 'root zoom':(f:ReturnType<typeof fillFixture>)=>{f.tree.style.zoom='2';},
 'root transform':(f:ReturnType<typeof fillFixture>)=>{f.tree.style.transform='matrix(1,0,0,1,0,0)';},
 'root writing mode':(f:ReturnType<typeof fillFixture>)=>{f.tree.style['writing-mode']='vertical-rl';},
 'out of flow root':(f:ReturnType<typeof fillFixture>)=>{f.tree.style.position='absolute';},
 'changed caller bounds':(f:ReturnType<typeof fillFixture>)=>{f.bounds.width=821;},
 'changed root used size':(f:ReturnType<typeof fillFixture>)=>{f.tree.style.width='819px';},
 'unproven label percent':(f:ReturnType<typeof fillFixture>)=>{delete f.descendants.nodes[1].sizes[0].observedPercentage;},
 'changed child parent':(f:ReturnType<typeof fillFixture>)=>{f.descendants.nodes[1].sizes[0].observedPercentage!.parentSize=795;},
}))test('root fill context refuses '+name,()=>{
 const f=fillFixture();change(f);assert.throws(()=>readObservedAuthoredLayout(f.tree,f.origin,f.descendants,f.bounds),/react-authored-layout-/);
});
