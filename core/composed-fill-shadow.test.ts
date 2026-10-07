import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {literalOuterShadow,outerShadowInTokens} from '../packages/core/src/composed-fill-shadow.js';
import {generateCss} from '../packages/core/src/css.js';
import {emitReactInlineDraftPaintQualification} from './emit-react-inline.js';
import {emitReactDraftPaintQualification} from './emit-react.js';
import {mountGenerated} from './react-test-runtime.js';
import {alignPair,diffPair} from '../extract/figma/visual-parity/img.js';
const shadow='0px 4px 8px rgba(15,98,254,0.1)';
const tokens={primitives:{shadow:{$type:'shadow',$value:shadow}},semantic:{},light:{},dark:{},brands:{default:{}}};
test('outer shadow proof checks aliases and every theme and refuses inset or unresolved paint',()=>{
 for(const s of [shadow,'none','0px 0px 2px #000, 1px -2px 3px -1px #1234'])assert(literalOuterShadow(s),s);
 for(const s of ['inset '+shadow,'0 0 -2px #000','0 0 2px rgba(bad)','0 0 2px rgba(0,0,0,2)','var(--shadow)','0 0 2px black','1 2 3 #000'])assert(!literalOuterShadow(s),s);
 assert(outerShadowInTokens('{shadow}',tokens));
 const aliases=structuredClone(tokens);(aliases.semantic as any).alias={$value:'{shadow}'};assert(outerShadowInTokens('{alias}',aliases));
 (aliases.semantic as any).alias={$value:'{alias}'};assert(!outerShadowInTokens('{alias}',aliases));
 assert(!outerShadowInTokens('{missing}',tokens));
 for(const mode of ['light','dark']){const t=structuredClone(tokens);(t as any)[mode]={shadow:{$value:'inset '+shadow}};assert(!outerShadowInTokens('{shadow}',t));}
 const t=structuredClone(tokens);(t.brands as any).other={shadow:{$value:'inset '+shadow}};assert(!outerShadowInTokens('{shadow}',t));
});
test('actual shared CSS and inline React carry Carbon outer shadow independently of multiply fill',async(t)=>{
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));c.props=[];c.states=[];c.semantics={element:'div'};delete c.a11y;
 c.anatomy={root:{tokens:{'box-shadow':'{shadow}'},literals:{width:'320px',height:'320px'},declared:{'overflow-x':'hidden','overflow-y':'hidden'},solidFillComposition:{color:{r:1,g:1,b:1},opacity:Math.fround(.00001),blendMode:'MULTIPLY'}}};
 const errors:string[]=[];const css=generateCss(c,new Set(['shadow']),errors,tokens);assert.deepEqual(errors,[]);
 const bad=structuredClone(c);bad.anatomy.root.literals['box-shadow']='inset '+shadow;assert.throws(()=>generateCss(bad,new Set(['shadow']),[],tokens),/competing-or-unqualified/);
 const dark=structuredClone(tokens);(dark.dark as any).shadow={$value:'inset '+shadow};assert.throws(()=>emitReactInlineDraftPaintQualification(c,{tokens:dark,icons:new Map(),contracts:new Map([[c.id,c]])}),/competing-or-unqualified/);
 const inline=emitReactInlineDraftPaintQualification(c,{tokens,icons:new Map(),contracts:new Map([[c.id,c]])});
 const shared=emitReactDraftPaintQualification(c,{tokens:new Set(['shadow']),tokenValues:tokens,icons:new Map(),contracts:new Map([[c.id,c]])});
 const bytes=readFileSync(new URL('./fixtures/composed-fill-shadow-native/carbon.png',import.meta.url));
 const source=JSON.parse(readFileSync(new URL('./fixtures/composed-fill-shadow-native/SOURCE.json',import.meta.url),'utf8'));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.pngSHA256);
 const native=PNG.sync.read(bytes);
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:336,height:336},deviceScaleFactor:1});
 try{for(const route of ['css','inline']){
  if(route==='css'){await mountGenerated(page,c.name,shared.tsx,shared.css);await page.addStyleTag({content:':root{--shadow:'+shadow+'}'});}
  else await mountGenerated(page,c.name,inline.tsx);
  await page.addStyleTag({content:'html,body{margin:0;background:transparent}#root{position:absolute;left:8px;top:4px;width:320px;height:320px}'});
  assert.notEqual(await page.locator('#root > *').evaluate(n=>getComputedStyle(n).boxShadow),'none');
  const actual=PNG.sync.read(await page.screenshot({omitBackground:true}));
  // The low-alpha shadow can fall below pixelmatch's perceptual threshold.
  // Independently require paint outside the 320px host, where its fill cannot draw.
  let outsideInk=0;for(let y=0;y<actual.height;y++)for(let x=0;x<actual.width;x++)if((x<8||x>=328||y<4||y>=324)&&actual.data[(y*actual.width+x)*4+3]>0)outsideInk++;
  assert(outsideInk>0,route+' must actually draw the outer shadow');
  assert.equal(actual.width,native.width);assert.equal(actual.height,native.height);
  for(const bg of [255,0] as const){const score=diffPair(alignPair(actual,native,bg),[]).unmaskedPct;t.diagnostic(route+' background='+bg+' mismatch='+score+'%');assert(score<=5,route+' '+bg+' '+score);}
 }}finally{await browser.close();}
});
