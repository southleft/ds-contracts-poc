import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema, tokensByPropEntries} from '../scripts/contract-schema.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {mintedTokenCss} from './mint-tokens.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpSet} from '../extract/figma/types.js';

const primitives={space:{idle:{$type:'dimension',$value:'12px'},busy:{$type:'dimension',$value:'20px'}}};
const corpus=tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}});
function fixture():DumpSet{return {setName:'Bound padding',type:'COMPONENT_SET',propertyDefinitions:{Loading:{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']}},variants:['false','true'].map((value,i)=>({name:`Loading=${value}`,type:'COMPONENT',variantProperties:{Loading:value},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',primarySizing:'AUTO',counterSizing:'AUTO',spacing:0,padding:[0,i?20:12,0,i?20:12]},bound:{paddingLeft:i?'space/busy':'space/idle',paddingRight:i?'space/busy':'space/idle'},children:[{name:'content',type:'FRAME',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',primarySizing:'AUTO',counterSizing:'AUTO',spacing:0,padding:[0,i?20:12,0,i?20:12]},bound:{paddingLeft:i?'space/busy':'space/idle',paddingRight:i?'space/busy':'space/idle'}}]}))};}
const propose=(dump:DumpSet)=>proposeFromDump(dump,{corpus,contractIdByName:new Map(),mintUnbound:true});

test('Boolean bound padding preserves token identity and false/true behavior in both React surfaces and native compilation',async()=>{
 const dump=fixture(),before=JSON.stringify(dump),p=propose(dump),c=ContractSchema.parse(p.contract);
 assert.equal(JSON.stringify(dump),before);
 const axis=c.props.find(p=>p.type==='boolean')!;assert(axis);
 const entry=tokensByPropEntries(c.anatomy.root)[0];assert.equal(entry.prop,axis.name);
 assert.equal(c.anatomy.root.tokens?.['padding-inline'],'{space.idle}');
 assert.equal(entry.map.true['padding-inline'],'{space.busy}');
 const tokens={primitives:{...primitives,...p.mintedTokens?.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 const scope=new Map([[c.id,c]]),browser=await chromium.launch();
 try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{tokens,contracts:scope,icons:new Map()}),page=await browser.newPage();
  try{const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const value of [false,true,false]){
    await render({[axis.bindings.code.prop]:value});
    const pads=await page.locator('#root > *').evaluate(root=>[root,root.children[0]].map(n=>{const s=getComputedStyle(n);return [s.paddingLeft,s.paddingRight]}));
    assert.deepEqual(pads,Array(2).fill(Array(2).fill(value?'20px':'12px')));
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 for(const v of data.variants){const value=v.name.includes('true'),binding=value?'space/busy':'space/idle';assert.equal(v.spec.bindings?.paddingLeft,binding);assert.equal(v.spec.bindings?.paddingRight,binding);assert.equal(v.spec.children![0].bindings?.paddingLeft,binding);}
});

test('missing Boolean-plane bindings stay refused instead of inventing a token table',()=>{
 const d=fixture();delete d.variants[1].bound;delete d.variants[1].children![0].bound;
 const c=ContractSchema.parse(propose(d).contract);assert.equal(tokensByPropEntries(c.anatomy.root).length,0);
});
