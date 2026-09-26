import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitReact, validateContract } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { nativeFilledPathResizeMatches } from './native-filled-path.js';

const tokens = {primitives:{base:{$type:'dimension',$value:'24px'},small:{$type:'dimension',$value:'12px'},
  large:{$type:'dimension',$value:'18px'},ink:{$type:'color',$value:'#123456'}},semantic:{},light:{},dark:{},brands:{default:{}}};
const shape = () => ({kind:'path' as const,width:12,height:8,paths:[{data:'M0 0L12 0L6 8Z',windingRule:'NONZERO' as const}],
  parentViewport:{width:24,height:24,x:3,y:4}});
function fixture() {
  const glyph = ContractSchema.parse({id:'test.scalable-mark',name:'ScalableMark',version:'1.0.0',archetype:'none',description:'A reusable proportional drawing',
    props:[],states:[],semantics:{element:'div'},anatomy:{root:{declared:{position:'relative'},tokens:{width:'{base}',height:'{base}'},overridable:['size'],
      parts:{ink:{shape:shape(),tokens:{'background-color':'{ink}'}}}}},
    bindings:{code:{anchors:{importPath:'./ScalableMark',export:'ScalableMark'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  const parent = ContractSchema.parse({...glyph,id:'test.scalable-caller',name:'ScalableCaller',
    props:[{name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}],
    anatomy:{root:{layout:{display:'flex'},parts:{selected:{component:{id:glyph.id,overrides:{size:'{{size}}'}}}}}},
    bindings:{code:{anchors:{importPath:'./ScalableCaller',export:'ScalableCaller'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  return {glyph,parent,contracts:new Map([[glyph.id,glyph],[parent.id,parent]])};
}
const errors = (c:Contract) => {const out:string[]=[];validateContract(c,new Map([[c.id,c]]),out,new Map());return out;};

test('scalable paths require a coherent free parent and reject competing geometry',()=>{
  const {glyph}=fixture(); assert.deepEqual(errors(glyph),[]);
  const changes:Array<(c:Contract)=>void>=[
    c=>{c.anatomy.root.layout={display:'flex'};},
    c=>{c.anatomy.root.literals={padding:'2px'};},
    c=>{c.anatomy.root.parts!.other={text:'x'};},
    c=>{c.anatomy.root.parts!.ink!.shape!.kind='ellipse';},
    c=>{c.anatomy.root.parts!.ink!.literals={left:'3px'};},
    c=>{c.anatomy.root.parts!.ink!.literalsByProp=[{prop:'size',map:{small:{width:'4px'}}}];},
    c=>{c.anatomy.root.parts!.ink!.shape!.rotation=5;},
  ];
  for(const change of changes){const c=structuredClone(glyph);change(c);assert(errors(c).some(e=>/filled-path/.test(e)),JSON.stringify(c));}
  const wrong=structuredClone(glyph);wrong.anatomy.root.parts!.ink!.shape!.parentViewport!.width=25;
  assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(wrong,new Map([[wrong.id,wrong]])),/filled-path-parent-basis-mismatch/);
});

test('native compilation keeps the main basis and draws a bound caller size',()=>{
  const {glyph,parent,contracts}=fixture(),engine=createFigmaEngine({tokens,icons:new Map()});
  const main=engine.compileComponentData(glyph,contracts).variants[0].spec;
  assert.equal(main.fixedWidth!.px,24);assert.equal(main.scalablePathParent,true);
  const viewport=main.children![0];assert.deepEqual(viewport.pathParentViewport,shape().parentViewport);
  assert.equal(viewport.nativePathViewport,true);assert.equal(viewport.children![0].nativePathScale,true);
  const callers=engine.compileComponentData(parent,contracts).variants;
  assert.deepEqual(callers.map(v=>v.spec.children![0].instanceSize),[{px:12,varName:'small'},{px:18,varName:'large'}]);
  assert.equal(callers[0].spec.children![0].channelMiss,undefined);
  const script=engine.buildComponentScript(parent,contracts);
  assert.match(script,/node\.resize\(spec\.instanceSize\.px, spec\.instanceSize\.px\)/);
  assert.match(script,/node\.setBoundVariable\('height', need\(spec\.instanceSize\.varName\)\)/);
});

test('native resized path comparison retains topology, winding and exact float32 handles',()=>{
  const paths=(data:string,windingRule='NONZERO')=>[{data,windingRule}];
  assert(nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths('M0 0L6 0L3 4L0 0Z'),.5,.5));
  assert(nativeFilledPathResizeMatches(paths('M0 0C4 6.666666507720947 8 6.666666507720947 12 0L0 0Z'),
    paths('M0 0C2 3.3333332538604736 4 3.3333332538604736 6 0L0 0Z'),.5,.5));
  for(const actual of ['M0 0L6.01 0L3 4Z','M0 0L6 0L3 3.99Z','M0 0L3 4L6 0Z','M0 0L6 0L3 4'])
    assert(!nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths(actual),.5,.5));
  assert(!nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths('M0 0L6 0L3 4Z','EVENODD'),.5,.5));
  for(const n of [0,-1,Infinity,NaN]) assert(!nativeFilledPathResizeMatches(paths('M0 0L12 0L6 8Z'),paths('M0 0L6 0L3 4Z'),n,.5));
});

test('installed-style React projections resize the drawing with its caller and preserve a separate main',async()=>{
  const browser=await chromium.launch();
  try {
    const {glyph,parent,contracts}=fixture();
    for(const surface of ['module','inline']){
      const ctx={tokens,icons:new Map<string,string>(),contracts};
      const emit=(c:Contract)=>surface==='inline'?{...emitReactInline(c,ctx),css:''}:emitReact(c,{...ctx,tokens:new Set(['base','small','large','ink'])});
      const parentOut=emit(parent),childOut=emit(glyph),page=await browser.newPage();
      try{
        const render=await mountGenerated(page,parent.name,parentOut.tsx,parentOut.css,{[glyph.name]:childOut});
        await page.addStyleTag({content:':root{--base:24px;--small:12px;--large:18px;--ink:#123456}'});
        const read=()=>page.evaluate(()=>{
          const all=[...document.querySelectorAll('#root *')];
          const path=all.find(el=>getComputedStyle(el).maskImage!=='none')!;
          const p=path.parentElement!,a=path.getBoundingClientRect(),b=p.getBoundingClientRect();
          return {parent:[b.width,b.height],ink:[a.width,a.height],offset:[a.x-b.x,a.y-b.y]};
        });
        await render({size:'small'});assert.deepEqual(await read(),{parent:[12,12],ink:[6,4],offset:[1.5,2]},surface);
        await render({size:'large'});assert.deepEqual(await read(),{parent:[18,18],ink:[9,6],offset:[2.25,3]},surface);
        await render({size:'small'});assert.deepEqual(await read(),{parent:[12,12],ink:[6,4],offset:[1.5,2]},surface);
        const separate=await browser.newPage();
        try{await mountGenerated(separate,glyph.name,childOut.tsx,childOut.css);await separate.addStyleTag({content:':root{--base:24px;--ink:#123456}'});
          const rect=await separate.locator('#root > *').boundingBox();assert.equal(rect!.width,24);assert.equal(rect!.height,24);
        }finally{await separate.close();}
      }finally{await page.close();}
    }
  }finally{await browser.close();}
});

test('single-ink path callers recolor through both React surfaces while their main stays unchanged',async()=>{
  const {glyph,parent,contracts}=fixture();
  glyph.anatomy.root.tokens!.color='{ink}';glyph.anatomy.root.overridable!.push('color');
  delete glyph.anatomy.root.parts!.ink!.tokens!['background-color'];
  glyph.anatomy.root.parts!.ink!.literals={'background-color':'currentColor'};
  parent.anatomy.root.parts!.selected!.component!.overrides!.color='{tones.{size}}';
  const inkTokens={...tokens,primitives:{...tokens.primitives,tones:{small:{$type:'color',$value:'#b51833'},large:{$type:'color',$value:'#0055aa'}}}};
  const native=createFigmaEngine({tokens:inkTokens,icons:new Map()});
  const main=native.compileComponentData(glyph,contracts).variants[0].spec;
  assert.equal(main.children![0].children![0].fill,'ink');assert.equal(main.fill,undefined);
  const callers=native.compileComponentData(parent,contracts).variants;
  assert.deepEqual(callers.map(v=>v.spec.children![0].instanceInk),[{varName:'tones/small',writeProtocol:'attached-v1'},{varName:'tones/large',writeProtocol:'attached-v1'}]);
  const browser=await chromium.launch();
  try{for(const surface of ['module','inline']){
    const ctx={tokens:inkTokens,icons:new Map<string,string>(),contracts};
    const emit=(c:Contract)=>surface==='inline'?{...emitReactInline(c,ctx),css:''}:emitReact(c,{...ctx,tokens:new Set(['base','small','large','ink','tones.small','tones.large'])});
    const child=emit(glyph),output=emit(parent),page=await browser.newPage();
    try{
      const render=await mountGenerated(page,parent.name,output.tsx,output.css,{[glyph.name]:child});
      await page.addStyleTag({content:':root{--base:24px;--small:12px;--large:18px;--ink:#123456;--tones-small:#b51833;--tones-large:#0055aa}'});
      const ink=()=>page.evaluate(()=>getComputedStyle([...document.querySelectorAll('#root *')].find(e=>getComputedStyle(e).maskImage!=='none')!).backgroundColor);
      await render({size:'small'});assert.equal(await ink(),'rgb(181, 24, 51)',surface);
      await render({size:'large'});assert.equal(await ink(),'rgb(0, 85, 170)',surface);
      await render({size:'small'});assert.equal(await ink(),'rgb(181, 24, 51)',surface);
      const own=await browser.newPage();try{await mountGenerated(own,glyph.name,child.tsx,child.css);await own.addStyleTag({content:':root{--base:24px;--ink:#123456}'});
        assert.equal(await own.evaluate(()=>getComputedStyle([...document.querySelectorAll('#root *')].find(e=>getComputedStyle(e).maskImage!=='none')!).backgroundColor),'rgb(18, 52, 86)');
      }finally{await own.close();}
    }finally{await page.close();}
  }}finally{await browser.close();}
});
