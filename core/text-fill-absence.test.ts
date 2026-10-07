import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {mapRestToDump} from '../extract/figma/rest/map.js';
import {proposeFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';import {tokenInventoryFromJson} from '../packages/core/src/tokens.js';
import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';import {mountGenerated} from './react-test-runtime.js';
const fill={type:'SOLID',color:{r:.2,g:.4,b:.6,a:1},opacity:1};
test('canonical readers distinguish an explicitly empty text fill from missing paint data',async()=>{
 const fills=[[],[{...fill,visible:false}],[fill],undefined];
 const children=fills.map((paints,i)=>({id:'text-'+i,name:'Text'+i,type:'TEXT',characters:'Ink',fills:paints,absoluteBoundingBox:{x:0,y:0,width:20,height:12},style:{fontFamily:'Inter',fontStyle:'Regular',fontSize:12}}));
 const set={id:'set',name:'TextAbsence',type:'COMPONENT_SET',children:[{id:'variant',type:'COMPONENT',name:'Case=One',fills:[],absoluteBoundingBox:{x:0,y:0,width:20,height:20},children}]};
 const rest=mapRestToDump({name:'text absence',nodes:{set:{document:set}}}).dump as any;
 const {figma:mock}=createFigmaMock(),figma:any=mock;const component=figma.createComponent();component.name='Case=One';component.fills=[];
 for(const [i,paints] of fills.entries()){const node=figma.createText();node.name='Text'+i;node.characters='Ink';node.fills=structuredClone(paints);component.appendChild(node);}
 figma.combineAsVariants([component],figma.currentPage).name='TextAbsence';
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["TextAbsence"];');
 const native=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}\n})()`,{figma,console:{log(){},warn(){},error(){}}})));
 for(const dump of [rest,native])assert.deepEqual(dump.TextAbsence.variants[0].children.map((n:any)=>n.textFillAbsent),[true,true,undefined,undefined]);
});
test('partial bound text ink and observed empty fills render their exact colors in both React outputs',async t=>{
 const set:any={setName:'TextAbsence',type:'COMPONENT_SET',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'Painted',variantOptions:['Painted','Empty']}},variants:['Painted','Empty'].map(value=>({name:'Case='+value,type:'COMPONENT',variantProperties:{Case:value},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Label',type:'TEXT',text:{characters:'Ink',fontSize:12,fontStyle:'Regular',lineHeight:16},...(value==='Painted'?{fill:{var:'ink'}}:{textFillAbsent:true})}]}))};
 const semantic={ink:{$type:'color',$value:'#336699'}},opts={corpus:tokenCorpusFromJson({primitives:{},semantic,light:{},brandDefault:{}}),capturedValues:new Map([['ink','#336699']]),contractIdByName:new Map(),mintUnbound:true};
 const result=proposeFromDump(set,opts),c=ContractSchema.parse(result.contract),tokens={primitives:result.mintedTokens!.tree,semantic,light:{},dark:{},brands:{default:{}}},contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const output of [emitReact(c,{tokens:tokenInventoryFromJson([tokens.primitives,semantic]),tokenValues:tokens,contracts,icons}),{...emitReactInline(c,{tokens,contracts,icons}),css:''}]){
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,output.tsx,output.css);
  const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  const name=c.props.find(p=>p.bindings.figma.kind==='VARIANT')!.bindings.code.prop;
  for(const [value,color] of [['painted','rgb(51, 102, 153)'],['empty','rgba(0, 0, 0, 0)']]){await render({[name]:value});assert.equal(await page.getByText('Ink',{exact:true}).evaluate(n=>getComputedStyle(n).color),color);}
  await page.close();
 }
 const empty=structuredClone(set);for(const variant of empty.variants){delete variant.children[0].fill;variant.children[0].textFillAbsent=true;}
 const blank=proposeFromDump(empty,opts),blankContract=ContractSchema.parse(blank.contract),blankTokens={...tokens,primitives:blank.mintedTokens!.tree},blankContracts=new Map([[blankContract.id,blankContract]]);
 for(const output of [emitReact(blankContract,{tokens:tokenInventoryFromJson([blankTokens.primitives,semantic]),tokenValues:blankTokens,contracts:blankContracts,icons}),{...emitReactInline(blankContract,{tokens:blankTokens,contracts:blankContracts,icons}),css:''}]){
  const page=await browser.newPage();await mountGenerated(page,blankContract.name,output.tsx,output.css);
  const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(blankTokens)).css});
  assert.equal(await page.getByText('Ink',{exact:true}).evaluate(n=>getComputedStyle(n).color),'rgba(0, 0, 0, 0)');await page.close();
 }
 const unknown=structuredClone(set);delete unknown.variants[1].children[0].textFillAbsent;
 const raw=ContractSchema.parse(proposeFromDump(unknown,opts).contract);assert.equal(raw.anatomy.root.parts!.Label.tokens?.color,undefined,'old missing data is not silently interpreted as transparent');
});
