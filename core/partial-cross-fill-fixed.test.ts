import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {emitTokensCss,tokensCssLayers} from './emit-tokens-css.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpSet} from '../extract/figma/types.js';
function fixture():DumpSet{return{setName:'MixedWidth',type:'COMPONENT_SET',propertyDefinitions:Object.fromEntries(['Mode','State'].map(k=>[k,{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}])),variants:['A','B'].flatMap(mode=>['A','B'].map(state=>({name:`Mode=${mode}, State=${state}`,type:'COMPONENT',nodeId:'main-'+mode+state,variantProperties:{Mode:mode,State:state},fixedSize:{width:100,height:20},bbox:{x:0,y:0,width:100,height:20},layout:{mode:'VERTICAL',primary:'MIN',counter:'CENTER',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'bar',type:'FRAME',nodeId:'bar-'+mode+state,localGeometry:{nodeId:'bar-'+mode+state,parentId:'main-'+mode+state,transform:[[1,0,0],[0,1,0]],localSize:{width:mode==='B'&&state==='B'?50:100,height:1},parentSize:{width:100,height:20}},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},fixedSize:{height:1,...(mode==='B'&&state==='B'?{width:50}:{})},...(mode==='B'&&state==='B'?{}:{fillWidth:true}),fill:{hex:'333333'}}]}))) };}
test('compound cross-axis fill preserves a separate fixed-width exception in both React outputs and native',async t=>{
 const p=proposeFromDump(fixture(),{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()}),c=ContractSchema.parse(p.contract);
 const part=c.anatomy.root.parts!.bar;assert(part.literalsByCombination?.some(t=>t.rows.some(r=>r.literals.width==='100%')));
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()};
 const data=createFigmaEngine(ctx).compileComponentData(c,ctx.contracts);
 for(const v of data.variants){const child=v.spec.children![0];if(v.name==='Mode=B, State=B'){assert.equal(child.fillW,undefined);assert.equal(child.lits?.width,50,JSON.stringify(child));}else assert.equal(child.fillW,true);}
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
 for(const [mode,state,width] of [['a','a',100],['a','b',100],['b','a',100],['b','b',50],['a','a',100]] as const){await render({mode,state});assert.equal(await page.locator('#root > * > *').first().evaluate(n=>n.getBoundingClientRect().width),width);}
 await page.close();}
});
