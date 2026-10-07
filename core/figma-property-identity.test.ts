import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {mapRestToDump} from '../extract/figma/rest/map.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {figmaPropertyDisplayName,canonicalPropName} from './figma-names.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';
const keys=Array.from({length:6},(_,i)=>`item #${i+1}#1522:${i*2}`);
const definitions=Object.fromEntries(keys.map((k,i)=>[k,{type:'BOOLEAN',defaultValue:i<4}]));
const expected=Object.fromEntries(keys.map((k,i)=>[figmaPropertyDisplayName(k),i<4]));
test('only a terminal Figma identity is stripped from display names',()=>{
 for(const [raw,name] of [['item #5#1522:8','item #5'],['item #5','item #5'],['Label#1:0','Label'],['hash#tag','hash#tag'],['item#1:2:3','item']])assert.equal(figmaPropertyDisplayName(raw),name);
 assert.equal(canonicalPropName('item #5#1522:8'),'item5');
});
test('REST and plugin preserve hash-bearing property references and six distinct defaults',async()=>{
 const component:any={id:'1:1',name:'Rows',type:'COMPONENT',componentPropertyDefinitions:definitions,layoutMode:'VERTICAL',itemSpacing:0,primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'AUTO',children:keys.map((key,i)=>({id:`1:${i+2}`,name:`Row${i+1}`,type:'TEXT',visible:i<4,characters:`Row${i+1}`,style:{fontFamily:'Arial',fontSize:12,fontWeight:400},componentPropertyReferences:{visible:key}}))};
 const rest:any=mapRestToDump({name:'Fixture',nodes:{'1:1':{document:component}}} as never).dump.Rows;
 assert.deepEqual(rest.boolDefaults,expected);assert.deepEqual(rest.variants[0].children.map((c:any)=>c.propRefs.visible),Object.keys(expected));
 const {figma}:any=createFigmaMock();const c=figma.createComponent();c.name='Rows';figma.currentPage.appendChild(c);c.layoutMode='VERTICAL';
 for(let i=0;i<6;i++){const key=c.addComponentProperty(`item #${i+1}`,'BOOLEAN',i<4);const n=figma.createText();n.characters=`Row${i+1}`;n.name=n.characters;c.appendChild(n);n.componentPropertyReferences={visible:key};n.visible=i<4;}
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['Rows'];");
 const plugin:any=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}})()`,{figma,console:{log(){},warn(){},error(){}}})));
 assert.deepEqual(plugin.Rows.boolDefaults,expected);assert.deepEqual(plugin.Rows.variants[0].children.map((c:any)=>c.propRefs.visible),Object.keys(expected));
 const proposal=proposeFromDump(rest,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture',projectionMode:'exact',hiddenCaptured:true});
 const contract=ContractSchema.parse(proposal.contract),contracts=new Map([[contract.id,contract]]),icons=new Map(),tokens={primitives:proposal.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 assert.deepEqual(contract.props.map(p=>[p.name,p.default]),keys.map((_,i)=>[`item${i+1}`,i<4]));
 const compiled=createFigmaEngine({tokens,icons}).compileComponentData(contract,contracts);
 assert.deepEqual(compiled.boolProps.map((p:any)=>[p.property,p.default]),Object.entries(expected));
 const host=createFigmaMock();const context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 const engine=createFigmaEngine({tokens,icons});await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(contract,contracts));
 const native:any=host.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===contract.id);
 assert(native,'native generated root');
 assert.deepEqual(Object.fromEntries(Object.entries(native.componentPropertyDefinitions).filter(([,d]:any)=>d.type==='BOOLEAN').map(([k,d]:any)=>[figmaPropertyDisplayName(k),d.defaultValue])),expected);
 const instance:any=native.type==='COMPONENT_SET'?native.children[0].createInstance():native.createInstance();
 const nativeKey=Object.keys(instance.componentProperties).find(k=>figmaPropertyDisplayName(k)==='item #5')!;
 assert(nativeKey);instance.setProperties({[nativeKey]:true});
 assert.equal(instance.componentProperties[nativeKey].value,true);
 assert.equal(instance.componentProperties[Object.keys(instance.componentProperties).find(k=>figmaPropertyDisplayName(k)==='item #6')!].value,false);
 const browser=await chromium.launch();try{for(const surface of ['module','inline']){
 const code=surface==='module'?emitReact(contract,{contracts,icons,tokens:new Set([...JSON.stringify(contract).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]))}):{...emitReactInline(contract,{contracts,icons,tokens}),css:''};
 const page=await browser.newPage();const render=await mountGenerated(page,contract.name,code.tsx,code.css);
 assert.equal(await page.locator('#root').textContent(),'Row1Row2Row3Row4');
 await render({item2:false,item5:true});assert.equal(await page.locator('#root').textContent(),'Row1Row3Row4Row5');await page.close();
 }}finally{await browser.close();}
});
