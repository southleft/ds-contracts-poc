import test from 'node:test';
import assert from 'node:assert/strict';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import {reactComparisonInstanceWidth,reactComparisonContainerWidth} from './react-comparison-context.js';
import {chromium} from 'playwright-core';
import {captureJs} from '../extract/computed/capture.js';
import {readReactStyleOrigin} from './react-style-origin.js';
import type {ReactOwnership} from './react-ownership.js';

test('comparison width requires an agreeing explicit caller declaration, not automatic measured width',()=>{
  const tree:CapturedNode={tag:'section',classes:[],pseudo:{},nodes:[],style:{width:'360px','box-sizing':'border-box','min-width':'0px','max-width':'none'}};
  const origin:ReactStyleOrigin={version:1,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width',status:'fixed',value:'360px',selectors:['<inline>']}]}]};
  assert.equal(reactComparisonInstanceWidth(tree,origin),360);
  for(const status of ['auto','unresolved'] as const){const o=structuredClone(origin);o.roots[0].sizes![0].status=status;assert.equal(reactComparisonInstanceWidth(tree,o),undefined);}
  const stylesheet=structuredClone(origin);stylesheet.roots[0].sizes![0].selectors=['.library'];
  assert.equal(reactComparisonInstanceWidth(tree,stylesheet),undefined);
  for(const style of [{width:'350px'},{'box-sizing':'content-box'},{'min-width':'400px'},{'max-width':'400px'}] as Record<string,string>[])
    assert.throws(()=>reactComparisonInstanceWidth({...tree,style:{...tree.style,...style}},origin),/caller-width-unqualified/);
  for(const value of ['50%','auto','0px','100001px']){const o=structuredClone(origin);o.roots[0].sizes![0].value=value;assert.throws(()=>reactComparisonInstanceWidth(tree,o));}
  assert.throws(()=>reactComparisonInstanceWidth(tree,{...origin,roots:[...origin.roots,...origin.roots]}),/origin-ambiguous/);
});

test('a fill-width root\'s comparison frame is the observed content width of its caller\'s wrapper, from the sealed fill witness and the captured box only',async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();
    const observe=async(wrapper:string,root='width:100%')=>{
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}#wrapper{${wrapper}}#source{display:grid;${root}}</style><div id="stage"><div id="wrapper"><section id="source"><div>Title</div><div>Description</div></section></div></div>`);
      await page.evaluate(()=>{(window as unknown as {__ALL_PROPS:string[]}).__ALL_PROPS=[...getComputedStyle(document.documentElement)];});
      const tree=await page.evaluate(captureJs('#stage',undefined,'',['#source'])) as CapturedNode;
      const ownership={version:1,rendererVersions:[],components:[{id:'one',roots:['']}],nodes:[{path:'',tag:'section'}],problems:[]} as unknown as ReactOwnership;
      return {tree,origin:await readReactStyleOrigin(page,'#source',ownership)};
    };
    const wrapped=await observe('width:360px'),before=structuredClone(wrapped);
    assert.equal(wrapped.origin.roots[0].sizes![0].status,'fill');
    assert.equal(reactComparisonContainerWidth(wrapped.tree,wrapped.origin),360);
    assert.equal(reactComparisonInstanceWidth(wrapped.tree,wrapped.origin),undefined,'the instance itself is never pinned');
    assert.deepEqual(wrapped,before);
    const padded=await observe('width:360px;padding:0 20px;border:2px solid');
    assert.equal(reactComparisonContainerWidth(padded.tree,padded.origin),316,'the wrapper CONTENT box, not its border box');
    const fractional=await observe('width:301.5px');
    assert.equal(reactComparisonContainerWidth(fractional.tree,fractional.origin),301.5);
    // A shrink-to-fit place sizes itself from this box: nothing definite was observed, so nothing is pinned.
    // Nothing but the harness viewport bounds this chain: a harness fact is never presented as the caller's place.
    const unplaced=await observe('');
    assert.equal(unplaced.origin.roots[0].sizes![0].reason,'declared-fill-width-containing-block-viewport-only');
    assert.equal(reactComparisonContainerWidth(unplaced.tree,unplaced.origin),undefined);
    for(const wrapper of ['display:inline-block','float:left','position:absolute','display:inline-grid']){
      const circular=await observe(wrapper);
      assert.deepEqual([circular.origin.roots[0].sizes![0].status,circular.origin.roots[0].sizes![0].reason],['unresolved','declared-fill-width-containing-block-indefinite'],wrapper);
      assert.equal(reactComparisonContainerWidth(circular.tree,circular.origin),undefined,wrapper);
    }
    for(const root of ['width:360px','width:auto','width:50%','width:100%;max-width:200px']){
      const other=await observe('width:400px',root);assert.equal(reactComparisonContainerWidth(other.tree,other.origin),undefined,root);
    }
    for(const style of [{transform:'matrix(1, 0, 0, 1, 4, 0)'},{'writing-mode':'vertical-rl'},{'box-sizing':'content-box'},{'max-width':'900px'},{'min-width':'40px'},
      {'margin-left':'8px'},{position:'absolute'},{width:'auto'},{width:'0px'},{width:'100001px'}] as Record<string,string>[])
      assert.throws(()=>reactComparisonContainerWidth({...wrapped.tree,style:{...wrapped.tree.style,...style}},wrapped.origin),/^Error: react-comparison-containing-width-unqualified$/,JSON.stringify(style));
    const other=structuredClone(wrapped.origin);other.roots[0].sizes![0].value='50%';
    assert.throws(()=>reactComparisonContainerWidth(wrapped.tree,other),/containing-width-unqualified/);
    assert.throws(()=>reactComparisonContainerWidth(wrapped.tree,{...wrapped.origin,roots:[...wrapped.origin.roots,...wrapped.origin.roots]}),/origin-ambiguous/);
  }finally{await browser.close();}
});
