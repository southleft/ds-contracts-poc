import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {captureJs} from '../extract/computed/capture.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {observedComponentPlacement,detachObservedPlacement} from './observed-component-placement.js';

test('original browser fixed placement transfers translation once without interpreting opposing used insets as stretch',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();
 for(const translation of [0,15,-7.125]){
  await page.setContent(`<style>#parent{position:relative;display:flex;width:35px;height:20px}#child{position:absolute;box-sizing:border-box;width:18px;height:18px;left:1px;top:1px;transform:translateX(${translation}px)}</style><div id="stage"><div id="parent"><div id="child"></div></div></div>`);
  await page.evaluate(()=>{(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)];});
  const tree=await page.evaluate(captureJs('#stage',undefined,'',['#parent'])) as CapturedNode;
  const node=(tree.nodes[0] as {t:'el';el:CapturedNode}).el;
  const sizes=[{channel:'width' as const,status:'fixed' as const,value:'18px',selectors:['#child']},{channel:'height' as const,status:'fixed' as const,value:'18px',selectors:['#child']}];
  assert.equal(node.style.right,'16px');assert.equal(node.style.bottom,'1px');
  const before=structuredClone(node);assert.deepEqual(observedComponentPlacement(node,tree,sizes),{left:1+translation,top:1});assert.deepEqual(node,before);
  const mutations:Array<(n:CapturedNode,p:CapturedNode)=>void>=[
   n=>{n.style.transform='matrix(0, 1, -1, 0, 0, 0)';},n=>{n.style.position='fixed';},
   n=>{n.style.left='auto';},n=>{n.style.top='10%';},n=>{n.style['margin-left']='1px';},
   n=>{n.style.translate='3px';},n=>{n.style['z-index']='1';},n=>{n.style.order='1';},
   n=>{n.style.direction='rtl';},n=>{n.style['box-sizing']='content-box';n.style['padding-left']='1px';},
   (_,p)=>{p.style.position='static';},(_,p)=>{p.style.transform='matrix(2, 0, 0, 2, 0, 0)';},
   (_,p)=>{p.style.display='grid';},
  ];
  for(const mutate of mutations){const n=structuredClone(node),p=structuredClone(tree);mutate(n,p);assert.throws(()=>observedComponentPlacement(n,p,sizes),/dependency-placement-unqualified/);}
  assert.throws(()=>observedComponentPlacement(node,tree,[]),/dependency-placement-unqualified/);
  const contentBox=structuredClone(node);contentBox.style['box-sizing']='content-box';assert.deepEqual(observedComponentPlacement(contentBox,tree,sizes),{left:1+translation,top:1});
  const detached=structuredClone(node);detachObservedPlacement(detached);assert.equal(detached.style.transform,'none');assert.equal(detached.style.position,'relative');assert.equal(detached.style.width,'18px');
 }
});
