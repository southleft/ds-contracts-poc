import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {inferSemantics,proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {emitTokensCss,tokensCssLayers} from '../packages/core/src/emit-tokens-css.js';
import {ContractSchema} from '../scripts/contract-schema.js';import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';
test('custom select and dropdown triggers infer buttons without changing ordinary selects or groups',()=>{
 for(const name of ['Select/Trigger','Dropdown Trigger'])assert.equal(inferSemantics(name,[],false)?.element,'button');
 assert.equal(inferSemantics('Select',[],false)?.element,'select');assert.equal(inferSemantics('Dropdown Group',[],false),null);
});
for(const [setName,element] of [['Select/Trigger','button'],['Select','div']])test(`${setName} keeps custom label and graphic visible on both React surfaces`,async()=>{
 const dump:any={setName,type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default']},Value:{type:'TEXT',defaultValue:'Select apple'}},variants:[{name:'State=Default',type:'COMPONENT',variantProperties:{State:'Default'},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'CENTER',spacing:8,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Value',type:'TEXT',propRefs:{characters:'Value'},text:{characters:'Select apple',fontSize:14,fontStyle:'Regular'}},{name:'Icon',type:'RECTANGLE',shape:{kind:'rect',width:8,height:8},fill:{hex:'000000'}}]}]};
 const p=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});const c=ContractSchema.parse(p.contract);
 assert.equal(c.semantics.element,element);
 const stamped=proposeFromDump({...dump,semantics:{element:'div'}},{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 assert.equal(ContractSchema.parse(stamped.contract).semantics.element,'div','authored semantics take precedence');
 const browser=await chromium.launch({headless:true});try{
  for(const emitter of [reactEmitter,reactInlineEmitter]){const files=emitter.emit(c,{contracts:new Map([[c.id,c]]),icons:new Map(),tokens:{primitives:p.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}}});const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   await page.addStyleTag({content:emitTokensCss(tokensCssLayers({primitives:p.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}})).css});
   assert.equal(await page.locator('#root > '+element).count(),1);
   assert(await page.locator('#root > '+element+' > *').evaluateAll(nodes=>nodes.some(n=>!n.textContent && n.getBoundingClientRect().width>=8 && n.getBoundingClientRect().height>=8)));assert((await page.locator('#root').innerText()).includes('Select apple'));
   const name=c.props.find(p=>p.type==='text')!.bindings.code.prop;await render({[name]:'Changed selection'});assert((await page.locator('#root').innerText()).includes('Changed selection'));
  }finally{await page.close();}}
 }finally{await browser.close();}
});
