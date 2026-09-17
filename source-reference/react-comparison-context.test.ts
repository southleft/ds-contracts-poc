import test from 'node:test';
import assert from 'node:assert/strict';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import {reactComparisonInstanceWidth} from './react-comparison-context.js';

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
