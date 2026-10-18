import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {chromium} from 'playwright-core';
import {revisionOf} from './contract-provenance.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema, type Contract} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {mintedTokenCss} from './mint-tokens.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';

const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const layout:NonNullable<DumpNode['layout']>={mode:'HORIZONTAL',primary:'MIN',counter:'CENTER',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
function source():DumpSet {
 return {setName:'SiblingSizedRow',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Tall']}},variants:[24,40].map((height,index)=>({
  name:`Size=${index?'Tall':'Compact'}`,variantProperties:{Size:index?'Tall':'Compact'},type:'COMPONENT',layout:structuredClone(layout),
  children:[{name:'labelHost',type:'FRAME',nodeId:'host-'+index,fillHeight:true,fixedSize:{width:0},children:[
   {name:'label',type:'FRAME',abs:{x:-52,y:5,right:16,bottom:height-27,width:36,height:22,constraints:{horizontal:'LEFT',vertical:'TOP'}},children:[
    {name:'ink',type:'RECTANGLE',shape:{kind:'rect',width:36,height:22},fill:{hex:'112233'}},
   ]},
  ]},{name:'control',type:'FRAME',nodeId:'control-'+index,fixedSize:{width:80,height},fill:{hex:'eeeeee'}}],
 }))};
}
function propose(d=source(),dependencies:Contract[]=[],withContext=true){
 const result=proposeFromDump(d,{corpus,mintUnbound:true,stampsObservable:true,contractIdByName:new Map(dependencies.map(c=>[c.name,c.id])),contractsById:new Map(dependencies.map(c=>[c.id,c])),contractIdByKey:new Map(dependencies.map(c=>[c.bindings.figma.anchors.componentSetKey!,c.id])),fileKey:'fixture-file',...(withContext?{childIntrinsicContexts:new Map(dependencies.map(c=>[c.id,{contractRevision:revisionOf(c),sourceFileKey:'fixture-file',sourceKey:c.bindings.figma.anchors.componentSetKey!,sourceNodeId:'fixture-source',values:Object.freeze({})}]))}:{})});
 const contract=ContractSchema.parse(result.contract),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 return {...result,contract,tokens,contracts:new Map([...dependencies.map(c=>[c.id,c] as const),[contract.id,contract] as const])};
}

test('an independently sized sibling drives a zero-width label host on both React surfaces and native round trip',async t=>{
 const p=propose(),host=p.contract.anatomy.root.parts!.labelHost;
 assert.equal(host.layout?.alignSelf,'stretch');
 assert.equal(host.tokens?.height,undefined);assert.equal(host.literals?.height,undefined);
 assert.equal(p.contract.anatomy.root.layout?.align,'center');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(p.contract,{tokens:p.tokens,contracts:p.contracts,icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,p.contract.name,files[0].contents,mintedTokenCss(p.mintedTokens?.tree??{})+(files.find(f=>f.path.endsWith('.css'))?.contents??''));
  for(const [size,height]of [['compact',24],['tall',40],['compact',24]] as const){
   await render({size});
   const boxes=await page.locator('#root > *').evaluate(root=>{const [host,control]=root.children,label=host.firstElementChild!;return [root,host,control,label].map(n=>{const r=n.getBoundingClientRect();return {top:r.top,height:r.height};});});
   assert.equal(boxes[0].height,height);assert.equal(boxes[1].height,height);assert.equal(boxes[2].height,height);
   assert.equal(boxes[1].top,boxes[0].top);assert.equal(boxes[3].top-boxes[1].top,5);
  }
  await page.close();
 }
 const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()}),data=engine.compileComponentData(p.contract,p.contracts);
 for(const v of data.variants){assert.equal(v.spec.children![0].fillH,true);assert.equal(v.spec.children![1].fillH,undefined);}
 const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(p.contract,p.contracts));
 const set=root.findOne((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===p.contract.id);assert(set);
 for(const variant of set.children!){const [host,control]=variant.children!;assert.equal(host.layoutSizingVertical,'FILL');assert.equal(host.height,control.height);assert.equal(host.y,control.y);assert(host.children);assert.equal(host.children[0].y,5);}
});

test('absent, absolute, filling, zero, unproved, wrapped and rotated contributors cannot authorize source stretch',()=>{
 for(const mutation of ['absent','absolute','fill','zero','unproved','wrap','rotate'] as const){
  const d=source();for(const v of d.variants){const c=v.children![1];
   if(mutation==='absent')v.children!.pop();
   if(mutation==='absolute')c.abs={x:0,y:0,width:80,height:c.fixedSize!.height!,right:0,bottom:0,constraints:{horizontal:'LEFT',vertical:'TOP'}};
   if(mutation==='fill')c.fillHeight=true;
   if(mutation==='zero')c.fixedSize!.height=0;
   if(mutation==='unproved'){delete c.fixedSize;c.bbox={width:80,height:100};}
   if(mutation==='wrap')v.layout!.wrap=true;
   if(mutation==='rotate')c.localGeometry={nodeId:c.nodeId!,parentId:'root',transform:[[0,-1,0],[1,0,0]],localSize:{width:80,height:100},parentSize:{width:80,height:100}};
  }
  const p=propose(d);assert.equal(p.contract.anatomy.root.parts!.labelHost.layout?.alignSelf,undefined,mutation);
 }
});

test('native compiler independently rejects missing or non-contributing siblings',()=>{
 for(const mutation of ['absent','absolute','fill','zero','unproved','wrap','rotate'] as const){
  const p=propose(),root=p.contract.anatomy.root,c=root.parts!.control;
  if(mutation==='absent')delete root.parts!.control;
  if(mutation==='absolute')c.absolutePlacement={left:0,top:0};
  if(mutation==='fill')c.layout={alignSelf:'stretch'};
  if(mutation==='zero'){delete c.tokens!.height;c.literals={height:'0px'};}
  if(mutation==='unproved'){delete c.tokens!.height;delete c.parts;c.layout=undefined;}
  if(mutation==='wrap')root.layout!.wrap=true;
  if(mutation==='rotate'){delete c.tokens;c.shape={kind:'rect',width:80,height:24,rotation:90};}
  const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()});
  assert.throws(()=>engine.compileComponentData(p.contract,p.contracts),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED|cross-axis-stretch-owner-unqualified/,mutation);
 }
});

test('a key-linked HUG instance proves only its selected positive intrinsic variant',()=>{
 const child=ContractSchema.parse({id:'fixture.intrinsic-control',name:'IntrinsicControl',version:'0.1.0',status:'draft',description:'Intrinsic sibling fixture',semantics:{element:'div'},states:[],
  props:[{name:'size',type:{enum:['empty','tall']},default:'empty',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{empty:'Empty',tall:'Tall'}}}}],
  anatomy:{root:{layout:{display:'flex',direction:'row'},literals:{height:'fit-content'},parts:{content:{layout:{display:'flex'},literals:{width:'80px'},literalsByProp:[{prop:'size',map:{empty:{height:'0px'},tall:{height:'40px'}}}]}}}},
  bindings:{code:{anchors:{importPath:'./IntrinsicControl',export:'IntrinsicControl'}},figma:{anchors:{fileKey:'fixture-file',nodeId:'fixture-source',componentSetKey:'intrinsic-control-key'}}}});
 const d=source();d.variants=d.variants.slice(1);d.propertyDefinitions!.Size={type:'VARIANT',defaultValue:'Tall',variantOptions:['Tall']};
 const v=d.variants[0];v.children![1]={name:'control',nodeId:'control-tall',type:'INSTANCE',instanceOf:child.name,instanceSetKey:'intrinsic-control-key',componentProperties:{Size:'Tall'},instanceSizing:{horizontal:'FIXED',vertical:'HUG',width:80},
  localGeometry:{nodeId:'control-tall',parentId:'row-tall',transform:[[1,0,0],[0,1,0]],localSize:{width:80,height:40},parentSize:{width:80,height:40}},bbox:{width:80,height:40}};
 assert.equal(propose(d,[child],false).contract.anatomy.root.parts!.labelHost.layout?.alignSelf,undefined,'old callers without a bound token context keep refusal');
 const p=propose(d,[child]),host=p.contract.anatomy.root.parts!.labelHost;
 assert.equal(host.layout?.alignSelf,'stretch');
 const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()});
 assert.equal(engine.compileComponentData(p.contract,p.contracts).variants[0].spec.children![0].fillH,true);
 p.contract.anatomy.root.parts!.control.component!.props={size:'empty'};
 assert.throws(()=>engine.compileComponentData(p.contract,p.contracts),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED/);
});

test('HUG geometry cannot replace selected source content or visibility proof',()=>{
 const child=ContractSchema.parse({id:'fixture.visibility-control',name:'VisibilityControl',version:'0.1.0',status:'draft',description:'Visibility sibling fixture',semantics:{element:'div'},states:[],
  props:[{name:'show',type:'boolean',default:true,bindings:{code:{prop:'show'},figma:{kind:'BOOLEAN',property:'Show'}}}],
  anatomy:{root:{layout:{display:'flex',direction:'row'},literals:{height:'fit-content'},parts:{content:{visibleWhen:{prop:'show'},layout:{display:'flex'},literals:{width:'80px',height:'24px'}}}}},
  bindings:{code:{anchors:{importPath:'./VisibilityControl',export:'VisibilityControl'}},figma:{anchors:{fileKey:'fixture-file',nodeId:'fixture-source',componentSetKey:'visibility-control-key'}}}});
 const d=source();for(const [index,v]of d.variants.entries())v.children![1]={name:'control',nodeId:'control-'+index,type:'INSTANCE',instanceOf:child.name,instanceSetKey:'visibility-control-key',componentProperties:{Show:false},instanceSizing:{horizontal:'FIXED',vertical:'HUG',width:80},
  localGeometry:{nodeId:'control-'+index,parentId:'row-'+index,transform:[[1,0,0],[0,1,0]],localSize:{width:80,height:24},parentSize:{width:80,height:24}},bbox:{width:80,height:24}};
 const p=propose(d,[child]);assert.equal(p.contract.anatomy.root.parts!.labelHost.layout?.alignSelf,undefined);
 // Explicitly request the relation to exercise the independent native gate.
 p.contract.anatomy.root.parts!.labelHost.layout={alignSelf:'stretch'};
 const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()});
 assert.throws(()=>engine.compileComponentData(p.contract,p.contracts),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED/);
 // The same unknown dependency must not be examined when there is no stretch.
 delete p.contract.anatomy.root.parts!.labelHost.layout;
 assert.doesNotThrow(()=>engine.compileComponentData(p.contract,p.contracts));
});

test('native false visibility targets and empty TEXT overrides cannot establish height',()=>{
 for(const kind of ['visibility','text'] as const){
  const child=ContractSchema.parse({id:'fixture.overridden-control',name:'OverriddenControl',version:'0.1.0',status:'draft',description:'Override sibling fixture',semantics:{element:'div'},states:[],
   props:[kind==='visibility'?{name:'show',type:'boolean',bindings:{code:{prop:'show'},figma:{kind:'NONE'}}}:{name:'label',type:'text',default:'Visible',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}}],
   anatomy:{root:{layout:{display:'flex',direction:'row'},literals:{height:'fit-content'},parts:{content:kind==='visibility'?{visibilityOverrideProp:'show',visibilityOverrideDefault:false,layout:{display:'flex'},literals:{width:'80px',height:'24px'}}:{content:{prop:'label'},literals:{'line-height':'24px','font-size':'14px'}}}}},
   bindings:{code:{anchors:{importPath:'./OverriddenControl',export:'OverriddenControl'}},figma:{anchors:{fileKey:null,componentSetKey:'overridden-control-key'}}}});
  const p=propose(),control=p.contract.anatomy.root.parts!.control;
  p.contracts.set(child.id,child);delete control.tokens;delete control.literals;delete control.layout;
  control.component={id:child.id,props:kind==='text'?{label:''}:{}};
  const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()});
  assert.throws(()=>engine.compileComponentData(p.contract,p.contracts),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED/,kind);
 }
});

test('a hidden positive child does not certify a HUG dependency',async()=>{
 const {independentIntrinsicHeight}=await import('./independent-intrinsic-height.js');
 const child=ContractSchema.parse({id:'fixture.hidden-height',name:'HiddenHeight',version:'0.1.0',status:'draft',description:'Hidden source height fixture',semantics:{element:'div'},states:[],props:[],
  anatomy:{root:{layout:{display:'flex'},literals:{height:'fit-content'},parts:{hidden:{declared:{display:'none'},literals:{height:'40px'}}}}},
  bindings:{code:{anchors:{importPath:'./HiddenHeight',export:'HiddenHeight'}},figma:{anchors:{fileKey:null,componentSetKey:'hidden-height-key'}}}});
 assert.equal(independentIntrinsicHeight(child,{},()=>undefined),false);
});

test('unresolved own line-height and non-drawn checkable inputs do not certify height',async()=>{
 const {independentIntrinsicHeight}=await import('./independent-intrinsic-height.js');
 const make=(part:unknown)=>ContractSchema.parse({id:'fixture.unknown-height',name:'UnknownHeight',version:'0.1.0',status:'draft',description:'Unproved source height fixture',semantics:{element:'div'},states:[],props:[],
  anatomy:{root:{layout:{display:'flex'},literals:{'line-height':'24px'},parts:{content:part}}},bindings:{code:{anchors:{importPath:'./UnknownHeight',export:'UnknownHeight'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 assert.equal(independentIntrinsicHeight(make({text:'Text',tokens:{'line-height':'{missing.line}'} }),{},()=>undefined),false);
 assert.equal(independentIntrinsicHeight(make({element:'input',attrs:{type:'checkbox'},literals:{height:'24px'}}),{},()=>undefined),false);
});

test('token precedence and collapsing height ceilings keep dependency height unproved',async()=>{
 const {independentIntrinsicHeight}=await import('./independent-intrinsic-height.js');
 const make=(part:unknown)=>ContractSchema.parse({id:'fixture.conflicting-height',name:'ConflictingHeight',version:'0.1.0',status:'draft',description:'Conflicting source height fixture',semantics:{element:'div'},states:[],props:[],
  anatomy:{root:{layout:{display:'flex'},parts:{content:part}}},bindings:{code:{anchors:{importPath:'./ConflictingHeight',export:'ConflictingHeight'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 for(const resolved of ['0px',undefined])assert.equal(independentIntrinsicHeight(make({tokens:{height:'{height}'},literals:{height:'24px'}}),{},()=>resolved),false);
 for(const part of [{literals:{height:'24px','max-height':'0px'}},{literals:{height:'24px'},declared:{display:'contents'}}])assert.equal(independentIntrinsicHeight(make(part),{},()=>undefined),false);
});

test('token context is bound to the exact child source and contract, independently of fixed swaps',()=>{
 const child=ContractSchema.parse({id:'fixture.context-control',name:'ContextControl',version:'0.1.0',status:'draft',description:'Exact context sibling fixture',semantics:{element:'div'},states:[],props:[],
  anatomy:{root:{layout:{display:'flex'},parts:{stable:{layout:{display:'flex'},tokens:{height:'{context.height}'},literals:{width:'80px'}},swapped:{slot:{name:'decoration'}}}}},
  bindings:{code:{anchors:{importPath:'./ContextControl',export:'ContextControl'}},figma:{anchors:{fileKey:'fixture-file',nodeId:'fixture-source',componentSetKey:'context-control-key'}}}});
 const d=source();for(const [index,v]of d.variants.entries())v.children![1]={name:'control',nodeId:'control-'+index,type:'INSTANCE',instanceOf:child.name,instanceSetKey:'context-control-key',instanceSizing:{horizontal:'FIXED',vertical:'HUG',width:80},
  localGeometry:{nodeId:'control-'+index,parentId:'row-'+index,transform:[[1,0,0],[0,1,0]],localSize:{width:80,height:24},parentSize:{width:80,height:24}},fixedSwaps:{Decoration:{id:'decoration-main',key:'decoration-key'}}};
 const context={contractRevision:revisionOf(child),sourceFileKey:'fixture-file',sourceKey:'context-control-key',sourceNodeId:'fixture-source',values:Object.freeze({'context.height':'24px'})};
 const apply=(record:typeof context|undefined,dependency=child)=>proposeFromDump(d,{corpus,mintUnbound:true,stampsObservable:true,fileKey:'fixture-file',contractIdByName:new Map([[dependency.name,dependency.id]]),contractsById:new Map([[dependency.id,dependency]]),contractIdByKey:new Map([['context-control-key',dependency.id]]),...(record?{childIntrinsicContexts:new Map([[dependency.id,record]])}:{})});
 const host=(p:ReturnType<typeof apply>)=>(p.contract as Contract).anatomy.root.parts!.labelHost;
 assert.equal(host(apply(context)).layout?.alignSelf,'stretch','pure stable branch proves positive height without using swapped slot content');
 for(const invalid of [undefined,{...context,contractRevision:'stale'},{...context,sourceFileKey:'elsewhere'},{...context,sourceKey:'wrong'},{...context,sourceNodeId:'wrong'},{...context,values:Object.freeze({})}])
  assert.equal(host(apply(invalid as typeof context|undefined)).layout?.alignSelf,undefined);
 const changed=structuredClone(child);changed.anatomy.root.parts!.stable.literals={height:'0px'};
 assert.equal(host(apply(context,changed)).layout?.alignSelf,undefined,'stale child metadata cannot reuse prior token authority');
 const swappable=structuredClone(child);delete swappable.anatomy.root.parts!.stable;
 const onlySlot={...context,contractRevision:revisionOf(swappable)};
 assert.equal(host(apply(onlySlot,swappable)).layout?.alignSelf,undefined,'a positive measured instance cannot stand in for swapped-only content');
});


test('selected scalar text and column width stretch prove height only for unbounded intrinsic text',()=>{
 const child=ContractSchema.parse({id:'fixture.width-stretched-text',name:'WidthStretchedText',version:'0.1.0',status:'draft',description:'Selected intrinsic text fixture',semantics:{element:'div'},states:[],
  props:[{name:'state',type:{enum:['shown','empty']},default:'shown',bindings:{code:{prop:'state'},figma:{kind:'VARIANT',property:'ContentKind',values:{shown:'Shown',empty:'Empty'}}}}],
  anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{content:{layout:{display:'flex',direction:'row',alignSelf:'stretch'},parts:{text:{text:'Base',textByProp:{prop:'state',map:{shown:'Selected',empty:''}},textAutoResize:'WIDTH_AND_HEIGHT',literals:{'line-height':'24px'}}}}}}},
  bindings:{code:{anchors:{importPath:'./WidthStretchedText',export:'WidthStretchedText'}},figma:{anchors:{fileKey:'fixture-file',nodeId:'fixture-source',componentSetKey:'width-stretched-text-key'}}}});
 const d=source();for(const [index,v]of d.variants.entries())v.children![1]={name:'control',nodeId:'control-'+index,type:'INSTANCE',instanceOf:child.name,instanceSetKey:'width-stretched-text-key',componentProperties:{ContentKind:'Shown'},instanceSizing:{horizontal:'FIXED',vertical:'HUG',width:80},
  localGeometry:{nodeId:'control-'+index,parentId:'row-'+index,transform:[[1,0,0],[0,1,0]],localSize:{width:80,height:24},parentSize:{width:80,height:24}}};
 const p=propose(d,[child]);assert.equal(p.contract.anatomy.root.parts!.labelHost.layout?.alignSelf,'stretch');
 const engine=createFigmaEngine({tokens:p.tokens,icons:new Map()});
 assert.equal(engine.compileComponentData(p.contract,p.contracts).variants[0].spec.children![0].fillH,true);
 for(const kind of ['empty','whitespace','missing-selector','unknown-selector','row','wrap','bounded','unflagged','compound','out-of-box'] as const){
  const c=structuredClone(child),content=c.anatomy.root.parts!.content,text=content.parts!.text,source=structuredClone(d);
  if(kind==='empty')for(const v of source.variants)v.children![1].componentProperties!.ContentKind='Empty';
  if(kind==='whitespace')text.textByProp!.map.shown='   ';
  if(kind==='unknown-selector')for(const v of source.variants)v.children![1].componentProperties!.ContentKind='Unknown';
  if(kind==='out-of-box')text.textOutOfBox={};
  if(kind==='missing-selector')text.textByProp!.prop='unknown';
  if(kind==='row')c.anatomy.root.layout!.direction='row';
  if(kind==='wrap')content.layout!.wrap=true;
  if(kind==='bounded')text.literals!['max-width']='16px';
  if(kind==='unflagged')delete text.textAutoResize;
  if(kind==='compound'){delete text.textByProp;text.textByCombination={props:['state'],rows:[{values:['shown'],text:'Selected'},{values:['empty'],text:''}]};}
  const denied=propose(source,[c]);
  assert.equal(denied.contract.anatomy.root.parts!.labelHost.layout?.alignSelf,undefined,kind);
  if(kind!=='missing-selector'&&kind!=='unknown-selector'){
   denied.contract.anatomy.root.parts!.labelHost.layout={alignSelf:'stretch'};
   assert.throws(()=>engine.compileComponentData(denied.contract,denied.contracts),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED/,kind);
  }
 }
});


test('native sibling height proof respects literal, token and selected variant height ceilings',()=>{
 for(const kind of ['literal-zero','text-zero','shape-zero','token-zero','token-unresolved','variant-zero','variant-token-zero','positive-ceiling'] as const){
  const p=propose(),control=p.contract.anatomy.root.parts!.control;
  const tokens=structuredClone(p.tokens) as any;
  if(kind==='literal-zero')control.literals={...control.literals,'max-height':'0px'};
  if(kind==='text-zero'){delete control.tokens;delete control.layout;control.text='Text';control.literals={'line-height':'24px','max-height':'0px'};}
  if(kind==='shape-zero'){delete control.tokens;delete control.layout;control.shape={kind:'rect',width:20,height:24};control.literals={'max-height':'0px'};}
  if(kind==='token-zero'){control.tokens={...control.tokens,'max-height':'{ceiling.value}'};tokens.semantic.ceiling={value:{$type:'dimension',$value:'0px'}};}
  if(kind==='token-unresolved')control.tokens={...control.tokens,'max-height':'{missing.ceiling}'};
  if(kind==='variant-zero')control.literalsByProp=[{prop:'size',map:{compact:{'max-height':'60px'},tall:{'max-height':'0px'}}}];
  if(kind==='variant-token-zero'){
   control.tokens={...control.tokens,'max-height':'{ceiling.{size}}'};
   tokens.semantic.ceiling={compact:{$type:'dimension',$value:'60px'},tall:{$type:'dimension',$value:'0px'}};
  }
  if(kind==='positive-ceiling')control.literals={...control.literals,'max-height':'60px'};
  const engine=createFigmaEngine({tokens,icons:new Map()});
  if(kind==='positive-ceiling'){
   const result=engine.compileComponentData(p.contract,p.contracts);
   assert(result.variants.every(v=>v.spec.children![0].fillH===true));
  }else assert.throws(()=>engine.compileComponentData(p.contract,p.contracts),kind.startsWith('variant-')?/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED:.*Size=Tall/:/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED|[Uu]nresolved|[Uu]nknown.*token|[Tt]oken.*not found/,kind);
 }
});


test('native HUG proof ignores qualified caller slot payloads and checks the owned branch and height override',()=>{
 const child=ContractSchema.parse({id:'fixture.caller-control',name:'CallerControl',version:'0.1.0',status:'draft',description:'Owned text beside caller slots',semantics:{element:'div'},states:[],props:[],
  anatomy:{root:{layout:{display:'flex',direction:'row'},instanceRootInputs:['height'],parts:{leading:{slot:{name:'leading'}},owned:{text:'Owned',literals:{'line-height':'22px'}},trailing:{slot:{name:'trailing'}}}}},
  bindings:{code:{anchors:{importPath:'./CallerControl',export:'CallerControl'}},figma:{anchors:{fileKey:'fixture-file',nodeId:'caller-source',componentSetKey:'caller-control-key'}}}});
 for(const fault of ['none','zero','negative','unresolved','foreign-slot','slot-only','child-ceiling'] as const){
  const c=structuredClone(child),p=propose(),control=p.contract.anatomy.root.parts!.control;
  delete control.tokens;delete control.literals;delete control.layout;
  control.component={id:c.id,contentSlots:{leading:['before'],trailing:['after']},rootOverrides:{height:'{usage.{size}}'}};
  control.parts={before:{text:'Caller payload',literals:{'line-height':'50px'}},after:{text:'Caller payload',literals:{'line-height':'50px'}}};
  const tokenSet=structuredClone(p.tokens) as any;tokenSet.semantic.usage={compact:{$type:'dimension',$value:'24px'},tall:{$type:'dimension',$value:'40px'}};
  if(fault==='zero')tokenSet.semantic.usage.compact.$value='0px';
  if(fault==='negative')tokenSet.semantic.usage.compact.$value='-1px';
  if(fault==='unresolved')delete tokenSet.semantic.usage.compact;
  if(fault==='foreign-slot'){control.component.contentSlots={foreign:['before'],trailing:['after']};}
  if(fault==='slot-only')delete c.anatomy.root.parts!.owned;
  if(fault==='child-ceiling')c.anatomy.root.literals={'max-height':'0px'};
  p.contracts.set(c.id,c);const engine=createFigmaEngine({tokens:tokenSet,icons:new Map()});
  if(fault==='none'){
   const data=engine.compileComponentData(p.contract,p.contracts);
   assert(data.variants.every(v=>v.spec.children![0].fillH===true));
   assert.deepEqual(data.variants.map(v=>v.spec.children![1].instanceRootOverrides!.height.px),[24,40]);
  }else assert.throws(()=>engine.compileComponentData(p.contract,p.contracts),/FIGMA_CROSS_AXIS_STRETCH_UNSUPPORTED|qualified foreign slot family|unique foreign slot|unresolved|instance-root|token/i,fault);
 }
});

test('array-valued properties cannot be mistaken for finite enum inputs in intrinsic height proof',async()=>{
 const {independentIntrinsicHeight}=await import('./independent-intrinsic-height.js');
 const c=ContractSchema.parse({id:'test.array-intrinsic',name:'ArrayIntrinsic',version:'0.1.0',status:'draft',description:'Unsupported scalar selection of an array remains refused',states:[],semantics:{element:'div'},props:[{name:'rows',type:{arrayOf:{text:'text'}},bindings:{code:{prop:'rows'},figma:{kind:'NONE'}}}],bindings:{code:{anchors:{importPath:'./ArrayIntrinsic',export:'ArrayIntrinsic'}},figma:{anchors:{fileKey:null,componentSetKey:null}}},anatomy:{root:{layout:{display:'flex'},literals:{height:'20px'}}}});
 assert.equal(independentIntrinsicHeight(c,{rows:'not-an-enum'},()=>undefined),false);
});
