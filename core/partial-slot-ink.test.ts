import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema,resolvePresence,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {asMinimalChildContract,proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {createFigmaEngine} from './emit-figma-script.js';

const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
function fixture(caller=false,wrapped=false){
  const glyph=ContractSchema.parse({id:'test.partial-ink',name:'PartialInk',version:'0.1.0',status:'draft',description:'Standalone source drawing',semantics:{element:'span'},props:[],states:[],
    anatomy:{root:{declared:{position:'relative'},tokens:{width:'{drawing.size}',height:'{drawing.size}',color:'{drawing.ink}'},overridable:['size','color'],parts:{ink:{literals:{'background-color':'currentColor'},declared:{position:'absolute'},shape:{kind:'path',width:18,height:18,paths:[{data:'M0 0L18 0L18 18L0 18Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24,x:3,y:3}}}}}},
    bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'glyph-key',nodeId:'50:1'}},code:{anchors:{importPath:'./PartialInk',export:'PartialInk'}}}});
  const receiver=ContractSchema.parse({...glyph,id:'test.receiver',name:'Receiver',states:[],anatomy:{root:{layout:{display:'flex'},parts:{payload:{slot:{name:'children',bindings:{figma:{property:'Icon'}},defaultContent:[{id:glyph.id}],renderDefault:true}}}}},bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'receiver-key',nodeId:'60:1'}},code:{anchors:{importPath:'./Receiver',export:'Receiver'}}}});
  const variants:any[]=[];
  for(const tone of ['None','Error','Empty'])for(const size of ['Small','Large']){
    const nodeId=tone+'-'+size,paint=tone==='Error'?[{path:'An arbitrary display name',fields:['fills'],fill:{hex:'dc2626'},solidFillTarget:{nodeId:'I'+nodeId+';50:2',instanceId:nodeId,componentId:'50:1',instancePath:caller?[0]:[],childPath:[0]}}]:undefined;
    const width=size==='Small'?16:20;
    const node:any=caller?{name:'Receiver',type:'INSTANCE',nodeId:'owner-'+nodeId,instanceOf:'Receiver',instanceKey:'receiver-key',componentProperties:{},fixedSwaps:{Icon:{id:'50:1',key:'glyph-key',observedInstances:[{nodeId,path:[0],componentId:'50:1',size:{width,height:width},parentSize:{width,height:width},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'SCALE',vertical:'SCALE'}}]}}}:
      {name:'PartialInk',type:'INSTANCE',nodeId,instanceOf:'PartialInk',instanceKey:'glyph-key',propRefs:{mainComponent:'Icon'},bbox:{width,height:width},instanceGeometry:{nodeId,componentId:'50:1',transform:[[1,0,0],[0,1,0]],localSize:{width,height:width}}};
    if(paint)node.hostOverrides=paint;
    variants.push({name:`Tone=${tone}, Size=${size}`,type:'COMPONENT',variantProperties:{Tone:tone,Size:size},layout,children:tone==='Empty'?[]:[wrapped?{name:'Host',type:'FRAME',layout,children:[node]}:node]});
  }
  const set:any={setName:'PartialHost',type:'COMPONENT_SET',propertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'None',variantOptions:['None','Error','Empty']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},...(!caller?{Icon:{type:'INSTANCE_SWAP',defaultValue:'50:1'}}:{})},variants};
  const contracts=new Map([glyph,receiver].map(c=>[c.id,c]));
  const read=(extra:Record<string,unknown>={})=>{const result=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,fileKey:'fixture',contractIdByName:new Map([glyph,receiver].map(c=>[c.name,c.id])),contractIdByKey:new Map([['glyph-key',glyph.id],['receiver-key',receiver.id]]),contractsById:new Map([...contracts].map(([id,c])=>[id,asMinimalChildContract(c)])),...extra});return{result,contract:ContractSchema.parse(result.contract)};};
  const node=(index:number)=>wrapped?set.variants[index].children[0]?.children[0]:set.variants[index].children[0];
  return{set,glyph,receiver,contracts,read,node};
}
function subject(emitter:typeof reactEmitter,root:Contract,ctx:Parameters<typeof reactEmitter.emit>[1]){
  const cache=new Map<string,Record<string,ComponentType<Record<string,unknown>>>>(),require=createRequire(import.meta.url);
  const load=(c:Contract)=>{
    if(cache.has(c.name))return cache.get(c.name)!;
    const module={exports:{} as Record<string,ComponentType<Record<string,unknown>>>};cache.set(c.name,module.exports);
    const tsx=emitter.emit(c,ctx)[0].contents;
    vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(id:string)=>{
      if(id.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_target,key)=>String(key)})};
      const dep=[...ctx.contracts!.values()].find(d=>id.endsWith('/'+d.name)||id==='./'+d.name);
      return dep?load(dep):require(id);
    }});
    cache.set(c.name,module.exports);return module.exports;
  };
  return load(root)[root.name];
}
function refs(c:Contract){return walkAnatomy(c).filter(w=>w.part.component?.id==='test.partial-ink').map(w=>w.part);}
function selected(c:Contract,tone:string,size:string){return refs(c).filter(p=>resolvePresence(p,{tone,size}));}

for(const [label,caller,wrapped] of [['bare',false,false],['wrapped',false,true],['caller',true,false]] as const){
  test(`partial ${label} ink retains omitted color and exact selected source tuples`,()=>{
    const f=fixture(caller,wrapped),before=JSON.stringify({set:f.set,contracts:[...f.contracts]});
    const {result,contract}=f.read();assert.equal(refs(contract).length,2);
    for(const tone of ['none','error','empty'])for(const size of ['small','large']){
      const found=selected(contract,tone,size);assert.equal(found.length,tone==='empty'?0:1,tone+'/'+size);
      if(!found.length)continue;
      assert(found[0].component!.overrides?.size,'shared size survives both branches');
      assert.equal(!!found[0].component!.overrides?.color,tone==='error','None is an ordinary no-override enum value');
    }
    assert.equal(JSON.stringify({set:f.set,contracts:[...f.contracts]}),before,'source and standalone child remain byte-equivalent');
    assert(result.mintedTokens!.entries.some(e=>e.value==='#dc2626'));
    const tokens={primitives:{drawing:{size:{$type:'dimension',$value:'24px'},ink:{$type:'color',$value:'#111111'},hover:{$type:'color',$value:'#222222'}},...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
    const contracts=new Map([...f.contracts,[contract.id,contract] as const]);
    for(const emitter of [reactEmitter,reactInlineEmitter]){
      const output=emitter.emit(contract,{contracts,tokens,icons:new Map()});
      assert(output[0].contents.includes('PartialInk'));
      assert(output[0].contents.includes('error'));
      const Subject=subject(emitter,contract,{contracts,tokens,icons:new Map()});
      const render=(tone:string,extra:Record<string,unknown>={})=>renderToStaticMarkup(createElement(Subject,{tone,size:'small',...extra}));
      const errorColor=selected(contract,'error','small')[0].component!.overrides!.color.slice(1,-1).replaceAll('.','-');
      assert(output.some(file=>file.contents.includes(emitter===reactEmitter?errorColor:'#dc2626')),'generated styles retain the exact painted value');
      const marker=emitter===reactEmitter?'paintedContent':'color:#dc2626';
      assert(render('error').includes(marker));assert(!render('none').includes(marker),'no-override plane does not receive the painted style');
      if(!caller){
        const slot=walkAnatomy(contract).find(w=>w.part.slot)!.part.slot!.name;
        assert.equal(render('error',{[slot]:undefined}),render('error'));
        for(const value of [null,false,''])assert(!render('error',{[slot]:value}).includes(marker),'explicit clearing bypasses every paint branch');
        assert.match(render('error',{[slot]:'Caller'}),/>Caller</);
        assert.match(render('error',{[slot]:0}),/>0</);
      }
    }
    const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,contracts);
    for(const variant of native.variants){
      const found:any[]=[];const visit=(s:any)=>{if(s.depContractId===f.glyph.id)found.push(s);for(const child of s.children??[])visit(child);};visit(variant.spec);
      assert.equal(found.length,variant.name.includes('Tone=Empty')?0:1,variant.name);
      if(found.length)assert.equal(!!found[0].instanceInk,variant.name.includes('Tone=Error'),variant.name);
    }
  });
}

test('partial ink refuses unknown override fields and mismatched captured ownership',()=>{
  for(const caller of [false,true])for(const mutation of [
    (f:ReturnType<typeof fixture>)=>{f.node(0).hostOverrides=[{path:'Unknown',fields:['opacity']}];},
    (f:ReturnType<typeof fixture>)=>{f.node(2).hostOverrides[0].solidFillTarget.componentId='wrong-main';},
    (f:ReturnType<typeof fixture>)=>{f.node(2).hostOverrides[0].solidFillTarget.instanceId='wrong-instance';},
    (f:ReturnType<typeof fixture>)=>{f.node(2).hostOverrides[0].solidFillTarget.childPath=[1];},
    (f:ReturnType<typeof fixture>)=>{f.node(2).hostOverrides.push(structuredClone(f.node(2).hostOverrides[0]));},
  ]){
    const f=fixture(caller);mutation(f);const {contract}=f.read();
    assert(refs(contract).every(p=>!p.component!.overrides?.color),`${caller}: ${mutation}`);
  }
});

test('missing unedited instance ownership is unknown, not proof of inherited paint',()=>{
  for(const mutation of [
    (f:ReturnType<typeof fixture>)=>{delete f.node(0).instanceGeometry;},
    (f:ReturnType<typeof fixture>)=>{f.node(0).instanceGeometry.componentId='foreign';},
    (f:ReturnType<typeof fixture>)=>{f.node(0).instanceGeometry.nodeId='foreign';},
  ]){const f=fixture();mutation(f);assert(refs(f.read().contract).every(p=>!p.component!.overrides?.color));}
});

test('all painted and all unedited slot cells keep the established single reference',()=>{
  for(const painted of [false,true]){
    const f=fixture();
    for(const index of [0,1,2,3]){const n=f.node(index);if(painted){const h=structuredClone(f.node(2).hostOverrides[0]);h.solidFillTarget.instanceId=n.nodeId;n.hostOverrides=[h];}else delete n.hostOverrides;}
    const {contract}=f.read();assert.equal(refs(contract).length,1);assert.equal(!!refs(contract)[0].component!.overrides?.color,painted);
  }
});


test('partial caller paint preserves the clean-base sparse visibility ownership refusal',()=>{
  const f=fixture(true);f.set.key='parent-key';f.set.nodeId='parent-set';
  for(const [i,variant] of f.set.variants.entries())variant.nodeId='parent-main-'+i;
  const first=f.node(0),target={instanceId:'usage',componentId:f.set.variants[0].nodeId,nodeId:'Iusage;'+first.nodeId,instancePath:[],childPath:[0],visible:false};
  const before=JSON.stringify({set:f.set,contracts:[...f.contracts]});
  assert.throws(()=>f.read({stampsObservable:true,drawnVariantSurface:'react-runtime',visibilityDemands:[{fileKey:'fixture',target}]}),
    /visibility-demand-owned-part-unqualified:/);
  assert.equal(JSON.stringify({set:f.set,contracts:[...f.contracts]}),before,'a refused sparse caller cannot gain paint or source ownership');
});
