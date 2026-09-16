import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {revisionOf} from '../core/contract-provenance.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {reactChildContextGrid, reactChildContextSizing} from './react-child-context.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import {gridConstraintChannels, type GridConstraintEvidence} from './grid-constraints.js';
import {rootSlotSeed} from '../core/figma-root-slot.fixture.js';
import {generateCss} from '../core/emit-react.js';

function fixture() {
  const style = {display:'block',width:'312px',height:'24px','writing-mode':'horizontal-tb',direction:'ltr',
    position:'static','box-sizing':'border-box','align-self':'auto','justify-self':'auto',order:'0',
    'grid-row-start':'auto','grid-row-end':'auto','grid-column-start':'auto','grid-column-end':'auto',
    'min-width':'auto','max-width':'none','min-height':'auto','max-height':'none','aspect-ratio':'auto',
    'margin-left':'0px','margin-right':'0px','margin-top':'0px','margin-bottom':'0px',
    'overflow-x':'visible','overflow-y':'visible','flex-grow':'0','flex-basis':'auto',transform:'none'};
  const computed = {'grid-template-columns':'none','grid-template-rows':'auto auto','grid-template-areas':'none',
    'grid-auto-columns':'auto','grid-auto-rows':'min-content','grid-auto-flow':'row',
    'justify-content':'normal','align-content':'normal','justify-items':'normal','align-items':'flex-start',
    'row-gap':'4px','column-gap':'4px'};
  const child: CapturedNode = {tag:'div',classes:[],pseudo:{},style:{...style},nodes:[{t:'text',v:'Label'}]};
  const grid: CapturedNode = {tag:'header',classes:[],pseudo:{},style:{...style,...computed,display:'grid',width:'360px',height:'48px',
    'grid-template-columns':'312px','grid-template-rows':'24px 20px'},nodes:[{t:'el',el:child},{t:'el',el:structuredClone(child)}]};
  const tree: CapturedNode = {tag:'section',classes:[],pseudo:{},style:{...style,display:'flex','flex-direction':'column','align-items':'normal',width:'360px'},nodes:[{t:'el',el:grid}]};
  const origin: ReactStyleOrigin = {version:1,roots:['','0','0.0','0.1'].map(path=>({path,tag:path===''?'section':path==='0'?'header':'div',channels:[],sizes:[
    {channel:'width',status:path===''?'fixed':'auto',value:path===''?'360px':'auto',selectors:[]},
    {channel:'height',status:'auto',value:'auto',selectors:[]},
  ]}))};
  const context = {gridConstraints:{version:1,status:'observed',treeRevision:revisionOf(tree),problems:[],rows:[{path:'0',tag:'header',computed,
    used:Object.fromEntries(gridConstraintChannels.map(k=>[k,grid.style[k]])) as typeof computed}]} as GridConstraintEvidence};
  return {tree,grid,child,origin,context};
}

test('intrinsic row lowering uses pinned constraints and refuses unsupported placement and sizing',()=>{
  const f=fixture(),before=structuredClone(f);
  const layout=reactChildContextGrid(f.tree,f.origin,'0',f.context)!;
  assert.deepEqual(layout,{display:'grid',columns:[{fr:1}],rows:[{fit:true},{fit:true}],autoRows:{fit:true},flow:'row',gap:{row:4,column:4}});
  assert.deepEqual(reactChildContextSizing(f.tree,f.origin,'0',f.context),{width:'100%',height:'fit-content'});
  assert.deepEqual(f,before);
  const deny: Array<(f:ReturnType<typeof fixture>)=>void> = [
    f=>{f.context.gridConstraints.rows[0].computed['grid-template-columns']='200px';},
    f=>{f.context.gridConstraints.rows[0].computed['grid-auto-flow']='row dense';},
    f=>{f.context.gridConstraints.rows[0].computed['grid-template-rows']='minmax(0,1fr)';},
    f=>{f.context.gridConstraints.rows[0].computed['grid-auto-rows']='20%';},
    f=>{f.context.gridConstraints.rows[0].computed['align-content']='space-between';},
    f=>{f.grid.style['writing-mode']='vertical-rl';},
    f=>{f.child.style['grid-column-end']='span 2';},
    f=>{f.child.style.display='flex';},
    f=>{f.child.tag='img';},
    f=>{f.child.style['margin-top']='-2px';},
    f=>{f.child.style['min-height']='200px';},
    f=>{f.origin.roots[1].sizes![1].status='unresolved';},
    f=>{f.origin.roots[2].sizes![1].status='unresolved';},
  ];
  for(const mutate of deny){const changed=fixture();mutate(changed);changed.context.gridConstraints.treeRevision=revisionOf(changed.tree);
    assert.throws(()=>reactChildContextGrid(changed.tree,changed.origin,'0',changed.context),/grid-constraints-unqualified/);}
  const constrained=fixture();constrained.origin.roots[0].sizes![1]={channel:'height',status:'fixed',value:'100px',selectors:[]};
  assert.equal(reactChildContextSizing(constrained.tree,constrained.origin,'0',constrained.context),undefined);
  const capped=fixture();capped.tree.style['max-height']='20px';capped.context.gridConstraints.treeRevision=revisionOf(capped.tree);
  assert.equal(reactChildContextSizing(capped.tree,capped.origin,'0',capped.context),undefined);
  const stale=fixture();stale.context.gridConstraints.treeRevision=revisionOf('substituted tree');
  assert.throws(()=>reactChildContextGrid(stale.tree,stale.origin,'0',stale.context),/evidence-changed/);
});

test('bounded intrinsic grid normalization preserves wrapping, content changes and source order in the browser',async()=>{
  const f=fixture(),contract=rootSlotSeed(),errors:string[]=[];
  contract.anatomy.root.layout=reactChildContextGrid(f.tree,f.origin,'0',f.context);
  contract.anatomy.root.literals=reactChildContextSizing(f.tree,f.origin,'0',f.context);
  contract.anatomy.root.tokens={'padding-left':'{pad24}','padding-right':'{pad24}'};
  const css=generateCss(contract,new Set(['pad24']),errors);
  assert.deepEqual(errors,[]);
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();
    for(const width of [180,360,520])for(const count of [0,1,2,4])for(const kind of ['short','wrap','nested']){
      const content=Array.from({length:count},(_,i)=>`<div>${kind==='nested'?'<div>Nested label</div><p>A longer paragraph inside another block.</p>':kind==='wrap'?'A long label containing several words that wrap onto multiple lines within its container.':`Label ${count-i}`}</div>`).join('');
      await page.setContent(`<style>*{box-sizing:border-box}:root{--pad24:24px}body{margin:0;font:14px/20px Arial}.host{display:flex;flex-direction:column;width:${width}px}.source{display:grid;padding:0 24px;gap:4px;align-items:start;grid-template-rows:auto auto;grid-auto-rows:min-content}p{margin:0}${css}</style><div class="host"><div class="source">${content}</div><div class="root lowered">${content}</div></div>`);
      // String form avoids tsx's injected function-name helper in the browser.
      const measured=await page.evaluate<{source:unknown;lowered:unknown}>(`(()=>{const read=q=>{const n=document.querySelector(q),b=n.getBoundingClientRect();return {width:b.width,height:b.height,children:[...n.children].map(c=>{const r=c.getBoundingClientRect();return {text:c.textContent,x:r.x-b.x,y:r.y-b.y,width:r.width,height:r.height}})}};return {source:read('.source'),lowered:read('.lowered')}})()`);
      assert.deepEqual(measured.lowered,measured.source,`${width}/${count}/${kind}`);
    }
  }finally{await browser.close();}
});
