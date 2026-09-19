import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {readReactDescendantSizes} from './react-style-origin.js';
import {descendantFixedSizes,descendantTranslateRefusal,lowerDescendantTranslations} from './react-descendant-geometry.js';
import type {ReactOwnership} from './react-ownership.js';
import type {CapturedNode} from '../extract/computed/lib.js';
const node=(path:string,tag:string)=>({path,tag,createdBy:'one',nearestComponent:'one'});
const ownership:ReactOwnership={version:1,rendererVersions:['19.2.7'],components:[{id:'one',source:{module:'fixture.tsx',exportName:'Track',sourceSha256:'0'.repeat(64),span:{start:0,end:1}},props:{},roots:['']}],
 nodes:[node('','button'),node('0','span'),node('1','i'),node('2','b'),node('3','svg'),node('3.0','path')],problems:[]};
// The author's own rules, conditioned on the ancestor group; `#subject > i` and the percentage are not own fixed sizes.
const css=`*{box-sizing:border-box}body{margin:0}.group{display:flex;align-items:center;position:relative;padding:0;border:1px solid transparent}
.group[data-size=default]{width:32px;height:18.4px}.group[data-size=default] .part{display:block;width:calc(var(--spacing) * 4);height:calc(var(--spacing) * 4);--tx:0;--ty:0}
.group[data-size=default] .part[data-on]{--tx:calc(100% - 2px);translate:var(--tx) var(--ty)}.group[data-size=default] .part[data-legacy]{transform:translateX(14px)}
.group[data-size=default] .part[data-short]{translate:10px}#subject > i{position:absolute;width:6px;height:6px}.wide{position:absolute;width:50%;height:2px}svg{position:absolute}`;
const page_=(attr:string)=>`<style>:root{--spacing:.25rem}${css}</style><button id="subject" class="group" data-size="default"><span class="part" ${attr}></span><i></i><b class="wide"></b><svg width="4" height="4"><path d="M0 0h4"/></svg></button>`;
const keys=['display','position','flex-direction','flex-wrap','justify-content','direction','writing-mode','box-sizing','width','height','translate','transform','rotate','scale',
 ...['left','right','top','bottom'].flatMap(s=>['padding-'+s,'border-'+s+'-width','margin-'+s])];

test('own sizes are read below the root, and the END-alignment rule is exactly where Chromium puts the translated part',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const observe=async(attr:string)=>{
   await page.setContent(page_(attr));const before=await page.screenshot();
   const sizes=await readReactDescendantSizes(page,'#subject',ownership);
   assert.deepEqual(await page.screenshot(),before,'read must not alter source rendering');
   // A string, so the transpiler adds no helper the page does not have.
   const seen=await page.evaluate(`(()=>{const names=${JSON.stringify(keys)};
    function read(el){return {tag:el.localName,classes:[...el.classList],pseudo:{},style:Object.fromEntries(names.map(k=>[k,getComputedStyle(el).getPropertyValue(k)])),
     nodes:el.localName==='svg'?[]:[...el.children].map(c=>({t:'el',el:read(c)}))};}
    const track=document.querySelector('#subject'),part=track.firstElementChild,t=track.getBoundingClientRect(),p=part.getBoundingClientRect(),s=getComputedStyle(track);
    return {tree:read(track),start:p.left-(t.left+parseFloat(s.borderLeftWidth)+parseFloat(s.paddingLeft)),end:(t.right-parseFloat(s.borderRightWidth)-parseFloat(s.paddingRight))-p.right};
   })()`) as {tree:CapturedNode;start:number;end:number};
   return {sizes,root:seen.tree,start:seen.start,end:seen.end};
  };
  const off=await observe('');
  assert.deepEqual(off.sizes.nodes.map(n=>[n.path,n.tag,...n.sizes.map(s=>s.status+':'+(s.value??s.reason))]),[
   ['0','span','fixed:16px','fixed:16px'],
   ['1','i','unresolved:size-declared-by-outer-selector','unresolved:size-declared-by-outer-selector'],
   ['2','b','unresolved:responsive-or-unsupported-size-expression','fixed:2px']],'the SVG subtree keeps its own viewport evidence; the root is read by the root reader');
  assert.deepEqual(off.sizes.nodes[0].sizes[0].selectors,['.group[data-size="default"] .part']);
  const sizing=(o:typeof off)=>descendantFixedSizes(o.root,'',o.sizes);
  assert.deepEqual([...sizing(off)].map(([path,channels])=>[path,[...channels]]),[['0',['width','height']],['2',['height']]]);
  const lower=(planes:Record<string,typeof off>)=>lowerDescendantTranslations(new Map(Object.entries(planes).map(([key,o])=>[key,{root:structuredClone(o.root),sizing:sizing(o)}])),new Set(['width','height']));
  for(const attr of ['data-on','data-legacy']){
   const on=await observe(attr);
   assert.equal((on.root.nodes[0] as {el:CapturedNode}).el.style[attr==='data-on'?'translate':'transform'],attr==='data-on'?'calc(100% - 2px)':'matrix(1, 0, 0, 1, 14, 0)','the computed forms the rule reads');
   // The instrument is measured: where the rule says END, the browser's part touches the end of the content box; where START, the start.
   assert.deepEqual([off.start,on.end,on.start],[0,0,14],attr);
   assert.deepEqual(lower({off,on}),[{path:'0',axis:'x',planes:{off:'start',on:'end'}}],attr);
  }
  // The reader measures the part's border box: a declared size that is not the box is never `fixed` (so never admitted).
  for(const [rule,reason,box] of [['display:inline}.group{display:block','size-declaration-does-not-apply',[0,0]],['display:contents','size-declaration-does-not-apply',[0,0]],
    ['box-sizing:content-box;padding:2px;border:1px solid','size-is-content-box',[22,22]],['zoom:2;flex-shrink:0','size-zoomed-context',[32,32]]] as const){
   await page.setContent(page_('').replace('</style>',`.group[data-size=default] .part{${rule}}</style>`));
   const sizes=(await readReactDescendantSizes(page,'#subject',ownership)).nodes[0].sizes;
   assert.deepEqual(sizes.map(s=>[s.status,s.reason]),[['unresolved',reason],['unresolved',reason]],rule);
   assert.deepEqual(await page.evaluate(`(()=>{const r=document.querySelector('.part').getBoundingClientRect();return [r.width,r.height]})()`),box,'the box the declared 16 x 16 is not');
  }
  const short=await observe('data-short');assert.notEqual(short.end,0);
  assert.throws(()=>lower({off,short}),{message:descendantTranslateRefusal+':partial-free-space'});
 }finally{await browser.close()}
});
