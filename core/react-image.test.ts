import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {chromium} from 'playwright-core';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,absentVariantAxes} from '../scripts/contract-schema.js';
import {reactEmitter,reactInlineEmitter,htmlEmitter} from './emitter.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
import {mountGenerated} from './react-test-runtime.js';
import {emitTokensCss,tokensCssLayers} from './emit-tokens-css.js';
import {createFigmaEngine} from './emit-figma-script.js';
function fixture(){
 const png=(color:number[])=>{const p=new PNG({width:2,height:2});for(let i=0;i<p.data.length;i+=4)p.data.set(color,i);return `url('data:image/png;base64,${PNG.sync.write(p).toString('base64')}')`;};
 const original=png([255,0,0,255]),replacement=png([0,0,255,255]);
 const p=proposeFromDump({setName:'Picture',type:'COMPONENT',propertyDefinitions:{},variants:[{name:'Default',type:'COMPONENT',variantProperties:{},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Photo',type:'FRAME',fixedSize:{width:16,height:16},fill:{hex:'ff0000'}}]}]},{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(p.contract),part=Object.values(c.anatomy.root.parts!)[0];
 c.props.push({name:'photo',type:{enum:['blue']},bindings:{code:{prop:'photo'},figma:{kind:'NONE'}}});
 part.imageOverride={prop:'photo',choices:{blue:{image:replacement,size:'cover',position:'50% 50%'}}};
 part.tokens={...part.tokens,'background-image':'{originalImage}'};
 part.declared={...part.declared,'background-size':'cover','background-position':'50% 50%','background-repeat':'no-repeat'};
 const tokens={primitives:{...p.mintedTokens!.tree,originalImage:{$type:'gradient',$value:original}},semantic:{},light:{},dark:{},brands:{default:{}}};
 return{c:ContractSchema.parse(c),tokens};
}
test('both React emitters restore original image after a finite override is omitted',async t=>{
 const {c,tokens}=fixture(),ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()};
 assert.equal(absentVariantAxes(c).length,0);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();
  const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'html,body{margin:0}'});
  for(const [props,rgb] of [[{},[255,0,0]],[{photo:'blue'},[0,0,255]],[{},[255,0,0]]] as const){
   await render(props);const node=page.locator('#root > * > *').first();
   await node.evaluate(async n=>{const img=new Image();img.src=getComputedStyle(n).backgroundImage.slice(5,-2);await img.decode();});
   const p=PNG.sync.read(await node.screenshot());assert.deepEqual([...p.data.subarray(0,3)],rgb);
  }
  await page.close();
 }
});
test('image controls reject open URLs and invalid enum ownership; native retains image target identity',()=>{
 const {c,tokens}=fixture();
 for(const edit of [(x:any)=>{(Object.values(x.anatomy.root.parts)[0] as any).imageOverride.choices.blue.image='url(https://example.com/x)';},(x:any)=>{x.props[0].default='blue';}]){const x=structuredClone(c);edit(x);assert.equal(ContractSchema.safeParse(x).success,false);}
 const compiled=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(compiled.variants[0].spec.children?.[0].imageTarget,c.id+':photo');
});

test('unsupported emitters refuse image controls and schema rejects malformed image geometry',()=>{
 const {c,tokens}=fixture(),ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()};
 assert.throws(()=>htmlEmitter.emit(c,ctx),/HTML_IMAGE_OVERRIDE_UNSUPPORTED/);
 assert.throws(()=>emitWebComponent(c,{contracts:ctx.contracts,icons:ctx.icons}),/WEB_COMPONENT_IMAGE_OVERRIDE_UNSUPPORTED/);
 for(const [key,value] of [['size','..% 10%'],['position','1.2.3% 0%'],['image',`url('data:image/png;base64,AAAA")`]]){
  const x=structuredClone(c);(Object.values(x.anatomy.root.parts!)[0].imageOverride!.choices.blue as any)[key]=value;
  assert.equal(ContractSchema.safeParse(x).success,false);
 }
});
