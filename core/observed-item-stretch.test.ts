import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const layout=(mode:'HORIZONTAL'|'VERTICAL'):DumpNode['layout']=>({mode,primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'});
function source():DumpSet {
 return {setName:'ObservedStretch',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Compact']}},variants:['Default','Compact'].map(state=>({
  name:`Mode=${state}`,type:'COMPONENT',variantProperties:{Mode:state},layout:layout('HORIZONTAL'),minHeight:60,
  children:[{name:'connector',type:'FRAME',layout:layout(state==='Compact'?'HORIZONTAL':'VERTICAL'),...(state==='Default'?{fillHeight:true}:{}),
   children:[{name:'mark',type:'RECTANGLE',shape:{kind:'rect',width:20,height:20}}]},
   {name:'sibling',type:'FRAME',layout:layout('HORIZONTAL'),children:[{name:'labelBox',type:'RECTANGLE',shape:{kind:'rect',width:30,height:20}}]}],
 }))};
}
function propose(dump=source()) {
 const result=proposeFromDump(dump,{corpus,mintUnbound:true,stampsObservable:true,contractIdByName:new Map()});
 return {...result,contract:ContractSchema.parse(result.contract)};
}
test('source cross-axis fill merges its state map with direction and preserves the intrinsic plane',()=>{
 const p=propose(),c=ContractSchema.parse(p.contract),item=c.anatomy.root.parts!.connector;
 assert.equal(item.layoutByProp?.prop,'mode');
 assert.equal(item.layoutByProp?.map.default.alignSelf,'stretch');
 assert.equal(item.layoutByProp?.map.compact.alignSelf,'auto');
 assert.equal(item.layoutByProp?.map.compact.direction,'row');
 const tokens={primitives:p.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.deepEqual(data.variants.map(v=>v.spec.children![0].fillH),[true,undefined]);
 assert(!JSON.stringify(data).includes('resolvedMinHeight'));
});
test('missing floors, wrapped owners, and competing sizes do not infer stretch',()=>{
 for(const edit of [
  (d:DumpSet)=>delete d.variants[0].minHeight,
  (d:DumpSet)=>d.variants[0].layout!.wrap=true,
  (d:DumpSet)=>d.variants[0].children![0].fixedSize={height:20},
 ]) {
  const d=source();edit(d);const p=propose(d),item=p.contract.anatomy.root.parts!.connector;
  assert.equal(item.layout?.alignSelf,undefined);
  assert(!Object.values(item.layoutByProp?.map??{}).some(row=>row.alignSelf));
 }
});

test('uniform source fill uses a base item relation; a two-axis split is not guessed',()=>{
 const uniform=source();
 for(const variant of uniform.variants) variant.children![0].fillHeight=true;
 const up=propose(uniform);assert.equal(up.contract.anatomy.root.parts!.connector.layout?.alignSelf,'stretch',JSON.stringify({part:up.contract.anatomy.root.parts!.connector,notes:up.notes}));
 const split=source();
 split.propertyDefinitions!.Tone={type:'VARIANT',defaultValue:'A',variantOptions:['A','B']};
 split.variants=split.variants.flatMap((variant,index)=>['A','B'].map((tone,toneIndex)=>{
  const row=structuredClone(variant);row.name+=`, Tone=${tone}`;row.variantProperties!.Tone=tone;
  row.children![0].fillHeight=index===toneIndex;return row;
 }));
 const part=propose(split).contract.anatomy.root.parts!.connector;
 assert.equal(part.layout?.alignSelf,undefined);
 assert(!Object.values(part.layoutByProp?.map??{}).some(row=>row.alignSelf));
});

test('an unresolved percentage minimum cannot prove native cross-axis allocation',()=>{
 const p=propose(),c=p.contract,tree=structuredClone(p.mintedTokens!.tree);
 const path=c.anatomy.root.tokens!['min-height'].slice(1,-1).split('.');
 let leaf:any=tree;for(const key of path) leaf=leaf[key];leaf.$value='100%';
 const tokens={primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]])),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED/);
});

function changingParentSource(){
 const d=source(),v=d.variants[0];
 v.layout=layout('VERTICAL');v.layout!.counterSizing='FIXED';v.bbox={width:100,height:60};
 delete v.children![0].fillHeight;v.children![0].fillWidth=true;
 return d;
}
test('fixed column cross-axis allocation survives a parent direction change',()=>{
 const p=propose(changingParentSource()),c=p.contract,part=c.anatomy.root.parts!.connector;
 assert.equal(part.layoutByProp?.map.default.alignSelf,'stretch');
 assert.equal(part.layoutByProp?.map.compact.alignSelf,'auto');
 assert.equal(c.anatomy.root.parts!.sibling.layout?.alignSelf,undefined);
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.deepEqual(native.variants.map(v=>v.spec.children![0].fillW),[true,undefined]);
});
test('a bbox alone or conflicting child size does not authorize changing-axis stretch',()=>{
 for(const edit of [
  (d:DumpSet)=>d.variants[0].layout!.counterSizing='AUTO',
  (d:DumpSet)=>d.variants[0].bound={width:'unresolved'},
  (d:DumpSet)=>d.variants[0].children![0].fixedSize={width:20},
  (d:DumpSet)=>d.variants[0].layout!.wrap=true,
 ]){const d=changingParentSource();edit(d);const part=propose(d).contract.anatomy.root.parts!.connector;assert(!Object.values(part.layoutByProp?.map??{}).some(row=>row.alignSelf));assert.equal(part.layout?.alignSelf,undefined);}
});


test('varying child paint order retains independently observed item stretch',async t=>{
 const d=source();d.propertyDefinitions!.Tone={type:'VARIANT',defaultValue:'A',variantOptions:['A','B']};
 d.variants=d.variants.flatMap(v=>['A','B'].map(tone=>{const n=structuredClone(v);n.name+=`, Tone=${tone}`;n.variantProperties!.Tone=tone;n.children![0].itemReverseZIndex=tone==='A'?true:undefined;return n;}));
 const p=propose(d),item=p.contract.anatomy.root.parts!.connector;
 assert(item.layoutByCombination);
 for(const row of item.layoutByCombination.rows){const selection:Record<string,string>=Object.fromEntries(item.layoutByCombination.props.map((key,i)=>[key,row.values[i]]));assert.equal(item.layoutByProp?.map[selection.mode!].alignSelf,selection.mode==='default'?'stretch':'auto');assert.equal(row.layout.reversePaint,selection.tone==='a');}
 const tokens={primitives:p.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(p.contract,new Map([[p.contract.id,p.contract]]));
 assert.equal(native.variants.filter(v=>v.spec.children![0].fillH).length,2);
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens,contracts:new Map([[p.contract.id,p.contract]]),icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,p.contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  for(const mode of ['default','compact','default'])for(const tone of ['a','b']){
   await render({mode,tone});assert.equal(await page.locator('#root > * > *:first-child').evaluate(n=>n.getBoundingClientRect().height),mode==='default'?60:20);
  }
  await page.close();
 }
});


test('a fixed rectangle alternative does not erase a frame alternative cross-axis fill',async t=>{
 const d=changingParentSource();
 for(const v of d.variants)v.fixedSize={width:100,height:60};
 d.variants[1].children![0]={name:'connector',type:'RECTANGLE',fixedSize:{width:20,height:20}};
 const p=propose(d),part=p.contract.anatomy.root.parts!.connector;
 assert.equal(part.layoutByProp?.map.default.alignSelf,'stretch',JSON.stringify(p.contract.anatomy));
 assert.equal(part.layoutByProp?.map.compact.alignSelf,'auto');
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens,contracts:new Map([[p.contract.id,p.contract]]),icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,p.contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  // Supply the captured parent allocation; this test isolates item sizing.
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'#root > * { width:100px; }'});
  for(const mode of ['default','compact','default']){
   await render({mode});assert.equal(await page.locator('#root > * > *:first-child').evaluate(n=>n.getBoundingClientRect().width),mode==='default'?100:20);
  }
  await page.close();
 }
});

test('a rectangle fill claim is not admitted as an ordinary frame stretch',()=>{
 const d=changingParentSource();d.variants[0].children![0].type='RECTANGLE';
 const part=propose(d).contract.anatomy.root.parts!.connector;
 assert.equal(part.layout?.alignSelf,undefined);
 assert(!Object.values(part.layoutByProp?.map??{}).some(row=>row.alignSelf));
});


test('proven absent enum planes do not erase the visible frame fill relation',async t=>{
 const d=changingParentSource();
 for(const v of d.variants)v.fixedSize={width:100,height:60};
 d.variants[1].children![0]={name:'connector',type:'RECTANGLE',fixedSize:{width:20,height:20}};
 const modeDefinition=d.propertyDefinitions!.Mode;assert.equal(modeDefinition.type,'VARIANT');if(modeDefinition.type!=='VARIANT')throw Error('expected variant');modeDefinition.variantOptions!.push('Absent');
 const absent=structuredClone(d.variants[1]);absent.name='Mode=Absent';absent.variantProperties!.Mode='Absent';absent.children=absent.children!.slice(1);d.variants.push(absent);
 const p=propose(d),part=p.contract.anatomy.root.parts!.connector;
 assert.deepEqual(part.visibleWhen,{prop:'mode',equals:['default','compact']});
 assert.equal(part.layoutByProp?.map.default.alignSelf,'stretch');
 assert.equal(part.layoutByProp?.map.compact.alignSelf,'auto');
 assert.equal(part.layoutByProp?.map.absent,undefined);
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens,contracts:new Map([[p.contract.id,p.contract]]),icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,p.contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css+'#root > * { width:100px; }'});
  for(const mode of ['default','compact','absent','default']){
   await render({mode});const children=page.locator('#root > * > *');assert.equal(await children.count(),mode==='absent'?1:2);
   if(mode!=='absent')assert.equal(await children.first().evaluate(n=>n.getBoundingClientRect().width),mode==='default'?100:20);
  }
  await page.close();
 }
});


test('a presence-gated frame retains row and column directions on visible planes',async t=>{
 const d=source();
 const modeDefinition=d.propertyDefinitions!.Mode;assert.equal(modeDefinition.type,'VARIANT');if(modeDefinition.type!=='VARIANT')throw Error('expected variant');modeDefinition.variantOptions!.push('Absent');
 const absent=structuredClone(d.variants[1]);absent.name='Mode=Absent';absent.variantProperties!.Mode='Absent';absent.children=absent.children!.slice(1);d.variants.push(absent);
 for(const v of d.variants.slice(0,2))v.children![0].children!.push({name:'second',type:'RECTANGLE',fixedSize:{width:20,height:20}});
 const p=propose(d),part=p.contract.anatomy.root.parts!.connector;
 assert.equal(part.layoutByProp?.map.compact.direction,'row');
 assert.equal(part.layoutByProp?.map.absent,undefined);
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens,contracts:new Map([[p.contract.id,p.contract]]),icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,p.contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  for(const mode of ['default','compact','absent','default']){
   await render({mode});const children=page.locator('#root > * > *');assert.equal(await children.count(),mode==='absent'?1:2);
   if(mode!=='absent')assert.equal(await children.first().evaluate(n=>getComputedStyle(n).flexDirection),mode==='default'?'column':'row');
  }
  await page.close();
 }
});


test('a filled wrapper is not invented around intrinsic flat text',async t=>{
 const text=(name:string,value:string):DumpNode=>({name,type:'TEXT',text:{characters:value,fontSize:14,fontFamily:'Arial',fontStyle:'Regular',fontWeight:400,lineHeight:20,textAutoResize:'WIDTH_AND_HEIGHT'}});
 const d:DumpSet={setName:'WrapperFill',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Nested',variantOptions:['Nested','Flat']}},variants:['Nested','Flat'].map(mode=>({name:`Mode=${mode}`,type:'COMPONENT',variantProperties:{Mode:mode},layout:layout(mode==='Nested'?'HORIZONTAL':'VERTICAL'),children:mode==='Nested'?[{name:'Details',type:'FRAME',fillWidth:true,fillHeight:true,layout:layout('VERTICAL'),children:[text('Title','Title')]}]:[text('Overline','Overline'),text('Title','Title')]}))};
 const p=propose(d);assert(p.notes.some(note=>note.includes('no synthetic fill copied')));
 const tokens={primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
 const {chromium}=await import('playwright-core'),{mountGenerated}=await import('./react-test-runtime.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens,contracts:new Map([[p.contract.id,p.contract]]),icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,p.contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  for(const mode of ['flat','nested','flat']){
   await render({mode});assert.equal(await page.getByText('Title',{exact:true}).count(),1);
   if(mode==='flat'){
    const over=await page.getByText('Overline',{exact:true}).boundingBox(),title=await page.getByText('Title',{exact:true}).boundingBox();assert(over&&title);assert(title.y>=over.y+over.height);
    assert.equal(await page.locator('#root > * > *').count(),2);
   }
  }
  await page.close();
 }
});
