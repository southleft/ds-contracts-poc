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
 const spec:NodeSpec={type:'root',name:'root',layout:{mode:'HORIZONTAL'},children:[{type:'frame',name:'track',layout:{mode:'VERTICAL'},children:[{type:'frame',name:'ink',layout:{mode:'HORIZONTAL'},children:[]}]}]};
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
