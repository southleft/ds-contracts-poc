import {domContentOf,caseContent} from '../scripts/design-consumer-content.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {isExactRectanglePath} from './rectangle-path.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {capturedTokensFromDump} from './captured-tokens.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated} from './react-test-runtime.js';
import {emitTokensCss,tokensCssLayers} from '../packages/core/src/emit-tokens-css.js';
import {alignRecordedFrames,imageSha256,enclosingFrame} from '../scripts/design-consumer-framing.js';
import {diffPair} from '../extract/figma/visual-parity/img.js';

test('rectangle equivalence requires four distinct corners joined along edges, with no extra geometry',()=>{
 const node:any={shape:{kind:'path',width:20,height:10,paths:[{data:'M 0 0 L 20 0 L 20 10 L 0 10 Z',windingRule:'NONZERO'}]}};
 assert(isExactRectanglePath(node));
 for(const path of ['M 20 10 L 20 0 L 0 0 L 0 10 L 20 10 Z','M 0 10 L 0 0 L 20 0 L 20 10 Z'])assert(isExactRectanglePath({...node,shape:{...node.shape,paths:[{data:path,windingRule:'NONE'}]}}));
 for(const path of ['M 0 0 L 20 0 L 0 10 Z','M 0 0 L 20 10 L 20 0 L 0 10 Z','M 1 0 L 20 0 L 20 10 L 1 10 Z','M 0 0 L 20 0 L 20 10 L 0 10 L 1 1 Z'])assert(!isExactRectanglePath({...node,shape:{...node.shape,paths:[{data:path,windingRule:'NONZERO'}]}}),path);
 for(const shape of [{rotation:10},{parentViewport:{width:30,height:30}},{width:21},{paths:[...node.shape.paths,...node.shape.paths]}])assert(!isExactRectanglePath({...node,shape:{...node.shape,...shape}}));
 assert(!isExactRectanglePath({...node,stroke:{hex:'ff0000'}}));
});

test('actual Carbon rectangle paths preserve fill sizing, both React surfaces, and native compilation',async()=>{
 const dump=JSON.parse(readFileSync(new URL('./fixtures/carbon-rectangle-path/source.json',import.meta.url),'utf8')),before=JSON.stringify(dump);
 const p=proposeFromDump(dump['_Accordion content skeleton'],{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,stampsObservable:true,hiddenCaptured:true,fileKey:dump._provenance.fileKey});
 const c:any=p.contract,primitives:any=p.mintedTokens!.tree;
 const merge=(a:any,b:any)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!('$value'in v))merge(a[k]??={},v);else a[k]=v;}};
 merge(primitives,capturedTokensFromDump(dump)!.tree);

 const tokens={primitives,semantic:{},light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const engine=createFigmaEngine({tokens,icons});assert.doesNotThrow(()=>engine.compileComponentData(c,contracts));
 assert.doesNotThrow(()=>engine.buildComponentScript(c,contracts,'qualification',primitives));
 const paths=new Set<string>();const gather=(v:any,p:string[])=>{for(const[k,x]of Object.entries(v)){if(x&&typeof x==='object'&&'$value'in x)paths.add([...p,k].join('.'));else if(x&&typeof x==='object')gather(x,[...p,k]);}};gather(primitives,[]);
 const ctx={tokens:paths,tokenValues:tokens,contracts,icons};
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const out=inline?emitReactInline(c,{...ctx,tokens}):emitReact(c,ctx);
  const page=await browser.newPage({viewport:{width:600,height:300},deviceScaleFactor:1});
  const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'html,body{margin:0;background:transparent}'});
  for(const alignment of ['right','left']){
   await render({alignment});const root=page.locator('#root > *'),box=(await root.boundingBox())!;
   assert.deepEqual([box.width,box.height],[320,96]);
   const sourceContent=JSON.parse(readFileSync(new URL('./fixtures/carbon-rectangle-path/content.json',import.meta.url),'utf8'));
   const content=caseContent(alignment,sourceContent.byNodeId[alignment==='right'?'5734:283743':'5734:286366'],await page.locator('#root').evaluate(domContentOf as any) as any);
   assert.deepEqual(content.problems,[]);assert.equal(content.content.parts.matched,6);
   assert.equal(await root.locator('svg[data-dsc-paint-layer] > rect').count(),2);

   const row=root.locator(':scope > :not([data-dsc-paint-layer])').last();
   const cells=await row.locator(':scope > :not([data-dsc-paint-layer])').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert.equal(cells.length,3,'the transparent spacer remains a real third cell');
   for(const cell of cells){assert(Math.abs(cell.width-256/3)<2);assert.equal(cell.height,10);}
   const bytes=await root.screenshot({omitBackground:true}),native=readFileSync(new URL('./fixtures/carbon-rectangle-path/'+alignment+'.png',import.meta.url));
   for(const bg of [0,255]as const){const pair=alignRecordedFrames(bytes,native,{layout:box,capture:enclosingFrame(box),deviceScaleFactor:1,pngSha256:imageSha256(bytes)},{layout:{x:0,y:0,width:320,height:96},render:{x:0,y:0,width:320,height:96},pngSha256:imageSha256(native)},bg);assert(!('refused'in pair));assert.equal(diffPair(pair.aligned,[]).unmaskedPct,0);}
   await render({alignment,style:{width:440}});
   const widths=await root.locator(':scope > :not([data-dsc-paint-layer])').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert.deepEqual(widths,[376,376,376,376],'captured fill follows parent resizing');
  }await page.close();
 }}finally{await browser.close();}
 assert.equal(JSON.stringify(dump),before,'source evidence is immutable');
});
