import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {nativeFixtureHost} from '../source-reference/native-operation-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {layeredNativeTokenModes} from './layered-native-token-modes.js';
import {flattenTokens} from './tokens.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {emitNativePreparedLibraryReadbackScript,verifyNativePreparedLibraryReadback,type NativePreparedLibraryObservationInput} from './native-source-observation.js';
import type {NativeTokenContextInput} from './native-token-context.js';
import {nativeLibraryReactionsMatch,type NativePreparedLibrarySource} from './native-prepared-library.js';
import {validNativeGraphCreation} from './native-graph-creation.js';
import {annotateNativeContractProjection} from './native-contract-draft.js';

async function fixture(composed:boolean|'nested'|'repeated'=true, family:string|null='Inter', fill:boolean|'height'=false, shapes?:'row'|'column'|'percent'|'path', literalPaint=false, callerInk=false) {
  const host=nativeFixtureHost({instanceVariantSelection:true}); host.figma.fileKey='PreparedLibraryFixture';
  Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string) {
    this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};
  };
  const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console},{timeout:5000})));
  const tokens={primitives:{ink:{$type:'color',$value:'#123456'},fade:{$type:'number',$value:0.5},
    edge:{$type:'number',$value:1},otherEdge:{$type:'number',$value:1},...(callerInk?{callerInk:{$type:'color',$value:'#b51833'},drawingSize:{$type:'dimension',$value:'24px'}}:{})},
    semantic:{label:{$type:'color',$value:'{ink}'}},light:{},dark:{},brands:{default:{}}};
  const leaf=ContractSchema.parse({id:'test.library-leaf',name:'Leaf',version:'0.1.0',status:'draft',
    description:'Synthetic conformance fixture; no visual qualification',semantics:{element:'button'},states:['hover'],
    props:[{name:'label',type:'text',default:'Library label',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},
      {name:'shown',type:'boolean',default:false,bindings:{code:{prop:'shown'},figma:{kind:'BOOLEAN',property:'Shown'}}},
      {name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}],
    anatomy:{root:{layout:{display:'inline-flex'},tokens:{'border-width':'{edge}','border-color':'{ink}'},states:{hover:{opacity:'{fade}'}},parts:{
      text:{content:{prop:'label'},visibleWhen:{prop:'shown'},...(family === null ? {} : {declared:{'font-family':family}}),tokens:{color:'{label}'}},
    }}},bindings:{code:{anchors:{importPath:'test/Leaf',export:'Leaf'}},figma:{statePreviews:true,anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-leaf-key'}}}});
  const parent=ContractSchema.parse({id:'test.library-parent',name:'Parent',version:'0.1.0',status:'draft',
    description:'A default slot instance plus an ordinary nested instance',props:[],states:[],semantics:{element:'div'},
    anatomy:{root:{layout:{display:'flex',direction:shapes==='percent'||shapes==='path'?'column':shapes??'column',...(fill?{align:'stretch'}:{})},...((fill||shapes)?{literals:{width:'320px',...((fill==='height'||shapes)?{height:'300px'}:{})}}:{}),parts:{
      slot:{...(fill==='height'?{layout:{display:'flex',direction:'column',grow:true}}:{}),slot:{name:'children',defaultContent:[{id:leaf.id,props:{size:'large',label:'Default caller'}}],accepts:[leaf.id]}},
      leaf:{component:{id:leaf.id,props:{shown:true}}},
      ...(fill?{frame:{layout:{display:'flex',grow:true},parts:{nested:{slot:{name:'extra'}}}}}:{}),
      ...(shapes && shapes!=='path'?Object.fromEntries(['rect','ellipse'].map(kind=>[kind,{shape:{kind,width:10,height:12},...(shapes==='percent'?{literals:{width:'100%'}}:{layout:{grow:true,growBasis:'zero'}}),tokens:{'background-color':'{ink}'}}])):{}),
    }}},bindings:{code:{anchors:{importPath:'test/Parent',export:'Parent'}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-parent-key'}}}});
  if (literalPaint) {
    parent.anatomy.root.literals={...parent.anatomy.root.literals,'background-color':'#eeeeee80'};
    parent.anatomy.root.parts!.paintedFrame={layout:{display:'flex'},literals:{'background-color':'#cc9966',width:'8px',height:'9px'}};
  }
  if (shapes === 'path') {
    parent.anatomy.root.parts!.mark = { shape: {kind:'path',width:12.25,height:10.25,paths:[{data:'M0 0L12 0L6 10Z',windingRule:'NONZERO'}]}, tokens:{'background-color':'{ink}'} };
    // Live Figma readbacks expose paint bindings both on the paint and in
    // node.boundVariables.fills. The base synthetic host omits that mirror.
    const reflectPaintBindings=(node:any)=>{
      if(!callerInk)return;
      let paints=node.fills;
      Object.defineProperty(node,'fills',{configurable:true,get:()=>paints,set(value){
        if(value[0]?.color?.r===181/255)assert.equal(node.parent?.parent?.parent?.type,'SLOT','override before caller-slot attachment invalidates native sublayers');
        paints=value;
      }});
      let explicit=node.boundVariables??{};
      Object.defineProperty(node,'boundVariables',{configurable:true,get(){
        const fills=(node.fills??[]).flatMap((paint:any)=>paint.boundVariables?.color?[paint.boundVariables.color]:[]);
        return {...explicit,...(fills.length?{fills}:{})};
      },set(value){explicit=value;}});
    };
    const prototype = Object.getPrototypeOf(host.figma.currentPage);
    Object.defineProperty(prototype, 'relativeTransform', {get() {
      assert.equal(this.rotation,0,'this synthetic host only models untranslated axes');
      return [[1,0,this.x],[0,1,this.y]];
    }});
    const clone = prototype._cloneForInstance;
    prototype._cloneForInstance = function() {
      const instance = clone.call(this);
      for (const field of ['vectorPaths','isMask','blendMode'])
        if (this[field] !== undefined) instance[field] = structuredClone(this[field]);
      if(this.type==='VECTOR')reflectPaintBindings(instance);
      return instance;
    };
    // This host models the measured triangle API behavior only. Live curve
    // geometry is tested independently; no source-expected size is injected.
    (host.figma as any).createVector = () => {
      const node = host.figma.createRectangle() as any; node.type = 'VECTOR'; node.isMask = false;
      node.blendMode = 'PASS_THROUGH'; node.constraints = {horizontal:'MIN',vertical:'MIN'};
      reflectPaintBindings(node);
      let paths: unknown;
      Object.defineProperty(node, 'vectorPaths', {get:()=>paths,set:(value:any)=>{
        assert.equal(value[0].data,'M0 0L12 0L6 10Z');
        paths=[{data:'M 0 0 L 12 0 L 6 10 L 0 0 Z',windingRule:'NONZERO'}];
        node.resize(12,10);
      }});
      return node;
    };
  }
  if (callerInk) {
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={declared:{position:'relative'},tokens:{color:'{ink}',width:'{drawingSize}',height:'{drawingSize}'},overridable:['color'],parts:{
      ink:{shape:{kind:'path',width:12,height:10,paths:[{data:'M0 0L12 0L6 10Z',windingRule:'NONZERO'}],parentViewport:{width:24,height:24,x:3,y:4}},literals:{'background-color':'currentColor'}},
    }};
  }
  const slotHost=callerInk?ContractSchema.parse({...leaf,id:'test.drawing-host',name:'DrawingHost',
    anatomy:{root:{layout:{display:'flex'},parts:{well:{slot:{name:'children',bindings:{figma:{property:'Drawing'}}}}}}},
    bindings:{code:{anchors:{importPath:'test/DrawingHost',export:'DrawingHost'}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-host-key'}}}}):undefined;
  if(slotHost)parent.anatomy.root.parts={leaf:{component:{id:slotHost.id},parts:{selected:{component:{id:leaf.id,overrides:{color:'{callerInk}'}}}}},untouched:{component:{id:leaf.id}}};
  const outer=ContractSchema.parse({...parent,id:'test.library-outer',name:'Outer',
    anatomy:{root:{layout:{display:'flex'},parts:{panel:{component:{id:parent.id}},
      ...(composed==='repeated'?{secondPanel:{component:{id:parent.id}}}:{})}}}});
  const top=ContractSchema.parse({...outer,id:'test.library-top',name:'Top',
    anatomy:{root:{layout:{display:'flex'},parts:{outer:{component:{id:outer.id}}}}}});
  const root=composed==='repeated'?top:composed==='nested'?outer:composed?parent:leaf;
  const byId=new Map((composed==='repeated'?[top,outer,parent,leaf]:composed==='nested'?[outer,parent,leaf]:composed?[parent,leaf]:[leaf]).map(c=>[c.id,c]));
  if(slotHost)byId.set(slotHost.id,slotHost);
  const before=JSON.stringify([...byId.values()]);
  const source:NativePreparedLibrarySource={kind:'prepared-contract-library',revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),
    inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)};
  const engine=createFigmaEngine({tokens,icons:new Map()});
  const operation={id:'60000000-0000-4000-8000-000000000001',fileKey:host.figma.fileKey};
  const compiled=engine.compileNativePreparedLibrary(root,byId,source,operation.id);
  const routed=layeredNativeTokenModes(tokens,[{sourceMode:'light',brand:'default',nativeModeName:'Selected'}]);
  const tokenInput:NativeTokenContextInput={fileKey:operation.fileKey,scopeId:'source-'+operation.id,source,
    tokenPaths:[...flattenTokens(routed.modes[0].tokens).keys()].sort(),modes:routed.modes,writeProtocol:'explicit-modes-v1'};
  const allocated=await run(emitNativeTokenContextScript(tokenInput).script);
  assert.equal(allocated.status,'created-candidate',JSON.stringify(allocated));
  const observed=await run(emitNativeTokenContextReadbackScript(tokenInput,allocated.creationIdentity));
  const context={operation,tokens:{input:tokenInput,identity:allocated.creationIdentity,receipt:observed.receipt}};
  const script=engine.buildNativePreparedLibraryScript(root,byId,source,context),creation=await run(script);
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  assert.equal(JSON.stringify([...byId.values()]),before,'original anchors and contracts remain exact');
  const input:NativePreparedLibraryObservationInput={operation,planRevision:revisionOf(compiled),component:compiled.component,
    graphComponents:compiled.components,graphVerification:2,projection:compiled.projection,tokenInput,tokenIdentity:allocated.creationIdentity,creation};
  const receipt=await run(emitNativePreparedLibraryReadbackScript(input));
  return {host,run,source,root,byId,engine,context,compiled,script,creation,input,receipt};
}

test('native caller ink verifies its own bound paint while preserving the main and sibling',async()=>{
  const f=await fixture(true,'Inter',false,'path',false,true);
  const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);
  assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
  const vectors=f.receipt.nodes.filter((n:any)=>n.type==='VECTOR');
  assert.equal(vectors.length,3);
  const caller=vectors.find((n:any)=>n.values.fills[0]?.color.r===Math.fround(181/255)||n.values.fills[0]?.color.r===181/255);
  assert(caller,'the caller must carry its red fill');
  assert.equal(vectors.filter((n:any)=>n!==caller&&n.values.fills[0]?.color.r===18/255).length,2,'main and untouched instance keep the original fill');
  const changes:Array<(n:any)=>void>=[
    n=>{n.values.fills[0].color.g=0;},
    n=>{n.values.fills[0].boundVariables.color.id='wrong';},
    n=>{n.values.boundVariables.fills[0].id='wrong';},
    n=>{n.values.boundVariables.opacity={type:'VARIABLE_ALIAS',id:'unexpected'};},
    n=>{n.values.fills.push(structuredClone(n.values.fills[0]));},
  ];
  for(const change of changes){const receipt=structuredClone(f.receipt);change(receipt.nodes.find((n:any)=>n.id===caller.id));
    const refused=verifyNativePreparedLibraryReadback(f.input,receipt);
    assert.equal(refused.status,'refused',JSON.stringify(refused));
    assert(JSON.stringify(refused).includes('native-filled-path-observation-caller-ink'));
  }
});

test('native filled paths preserve a fixed viewport and verify owned and inherited editable ink', async () => {
  const f = await fixture('nested','Inter',false,'path');
  const result = verifyNativePreparedLibraryReadback(f.input,f.receipt);
  assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
  const vector = f.receipt.nodes.find((n:any)=>n.type==='VECTOR' && f.creation.nodes.some((b:any)=>b.id===n.id));
  const viewport = f.receipt.nodes.find((n:any)=>n.id===vector.parentId);
  assert.equal(viewport.values.width,12.25); assert.equal(viewport.values.height,10.25);
  assert.equal(vector.values.width,12); assert.equal(vector.values.height,10);
  assert.equal(viewport.values.clipsContent,true); assert.equal(viewport.values.layoutMode,'NONE');
  const inherited = f.receipt.nodes.find((n:any)=>n.type==='VECTOR' && !f.creation.nodes.some((b:any)=>b.id===n.id));
  assert(inherited);
  for (const [name, mutate] of [
    ['same bounds, changed path',(r:any)=>{r.nodes.find((n:any)=>n.id===vector.id).values.vectorPaths[0].data='M0 0L12 0L5 10Z';}],
    ['winding',(r:any)=>{r.nodes.find((n:any)=>n.id===vector.id).values.vectorPaths[0].windingRule='EVENODD';}],
    ['mask',(r:any)=>{r.nodes.find((n:any)=>n.id===vector.id).values.isMask=true;}],
    ['normal blend',(r:any)=>{r.nodes.find((n:any)=>n.id===vector.id).values.blendMode='NORMAL';}],
    ['multiply blend',(r:any)=>{r.nodes.find((n:any)=>n.id===vector.id).values.blendMode='MULTIPLY';}],
    ['origin',(r:any)=>{const v=r.nodes.find((n:any)=>n.id===vector.id).values;v.x=0.125;v.relativeTransform[0][2]=v.x;}],
    ['viewport size',(r:any)=>{r.nodes.find((n:any)=>n.id===viewport.id).values.width=12;}],
    ['clip',(r:any)=>{r.nodes.find((n:any)=>n.id===viewport.id).values.clipsContent=false;}],
    ['inherited path',(r:any)=>{r.nodes.find((n:any)=>n.id===inherited.id).values.vectorPaths[0].data='M0 0L12 0L5 10Z';}],
    ['ink allocation',(r:any)=>{r.nodes.find((n:any)=>n.id===vector.id).metadata.nativeSourceAllocation='foreign';}],
  ] as const) {
    const changed=structuredClone(f.receipt); mutate(changed);
    assert.equal(verifyNativePreparedLibraryReadback(f.input,changed).status,'refused',name);
  }
});

test('retained libraries create scoped stateful components, joint controls and tracked default slot content',async()=>{
  for(const composed of [false,true,'nested'] as const) {
    const f=await fixture(composed),{input,receipt,creation,compiled}=f;
    assert.ok(validNativeGraphCreation(compiled.components,creation,2));
    assert.equal(creation.graphTargets.length,composed==='nested'?3:composed?2:1);
    assert.ok(compiled.components.every(c=>c.anchorKey===null));
    const report=verifyNativePreparedLibraryReadback(input,receipt);
    assert.equal(report.status,'supported-structure-observed',JSON.stringify(report));
    let nextY=0;
    for (const identity of creation.graphTargets) {
      const target=await f.host.figma.getNodeByIdAsync(identity.id);
      assert.equal(target.parent.id,creation.pageId);
      assert.equal(target.x,0);assert.equal(target.y,nextY,'fresh dependency mains must be separately visible');
      nextY=Math.fround(nextY+target.height+200);
    }
    const leaf=creation.graphTargets[0];
    assert.ok(leaf.variants.some((v:any)=>v.name.includes('State=Hover')));
    const target=await f.host.figma.getNodeByIdAsync(leaf.id);
    const label=Object.keys(target.componentPropertyDefinitions).find(k=>k.startsWith('Label#'))!;
    const shown=Object.keys(target.componentPropertyDefinitions).find(k=>k.startsWith('Shown#'))!;
    const main=await f.host.figma.getNodeByIdAsync(leaf.variants[0].id),instance=main.createInstance();
    instance.setProperties({[label]:'Edited in Figma',[shown]:true});
    const text=instance.findOne((n:any)=>n.type==='TEXT');
    assert.equal(text.characters,'Edited in Figma'); assert.equal(text.visible,true); instance.remove();
    const before=f.host.figma.root.findAll(()=>true).map((n:any)=>n.id);
    const positions=creation.graphTargets.map((identity:any)=>{
      const node=f.host.figma.root.findOne((n:any)=>n.id===identity.id);return [node.id,node.x,node.y];
    });
    const repeat=await f.run(f.script);
    assert.equal(repeat.status,'refused');assert.equal(repeat.allocationAttempted,false);
    assert.deepEqual(f.host.figma.root.findAll(()=>true).map((n:any)=>n.id),before);
    assert.deepEqual(creation.graphTargets.map((identity:any)=>{
      const node=f.host.figma.root.findOne((n:any)=>n.id===identity.id);return [node.id,node.x,node.y];
    }),positions,'refused replay leaves placement intact');
    if(composed) {
      const defaults=receipt.nodes.filter((n:any)=>n.metadata.nativeContractPart&&JSON.parse(n.metadata.nativeContractPart).defaultSlotIndex===0);
      assert.equal(defaults.filter((n:any)=>creation.nodes.some((c:any)=>c.id===n.id)).length,1); assert.equal(defaults[0].type,'INSTANCE');
      assert.ok(creation.nodes.some((n:any)=>n.id===defaults[0].id),'slot defaults are retained birth allocations');
    }
  }
});

test('library readback rejects state, property, slot and provenance corruption even with a matching birth report',async()=>{
  const f=await fixture(),{input,receipt}=f;
  const leaf=input.creation.graphTargets[0];
  const text=receipt.nodes.find((n:any)=>n.type==='TEXT'&&n.parentId===leaf.variants[0].id);
  const slot=receipt.nodes.find((n:any)=>n.type==='SLOT');
  for(const [name,mutate] of [
    ['visibility',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.visible=true;}],
    ['joint reference',(r:any)=>{delete r.nodes.find((n:any)=>n.id===text.id).values.componentPropertyReferences.characters;}],
    ['state reaction',(r:any)=>{r.nodes.find((n:any)=>n.id===leaf.variants[0].id).values.reactions=[];}],
    ['state content',(r:any)=>{r.nodes.find((n:any)=>n.type==='TEXT'&&n.parentId===leaf.variants.at(-1).id).values.characters='bad';}],
    ['slot main',(r:any)=>{r.nodes.find((n:any)=>n.id===slot.childIds[0]).mainId='foreign:1';}],
    ['slot property',(r:any)=>{r.nodes.find((n:any)=>n.id===slot.childIds[0]).componentProperties.Size.value='Small';}],
    ['inherited text',(r:any)=>{r.nodes.find((n:any)=>n.type==='TEXT'&&n.parentId===slot.childIds[0]).values.characters='Override';}],
    ['instance visibility',(r:any)=>{r.nodes.find((n:any)=>n.id===slot.childIds[0]).values.visible=false;}],
    ['extra instance property',(r:any)=>{r.nodes.find((n:any)=>n.id===slot.childIds[0]).componentProperties.Extra={type:'TEXT',value:'bad'};}],
    ['instance reaction',(r:any)=>{r.nodes.find((n:any)=>n.id===slot.childIds[0]).values.reactions=[];}],
    ['default allocation',(r:any)=>{r.nodes=r.nodes.filter((n:any)=>n.id!==slot.childIds[0]);}],
    ['slot preference',(r:any)=>{const n=r.nodes.find((n:any)=>n.id===input.creation.target.id);Object.values(n.definitions).forEach((d:any)=>{if(d.type==='SLOT')d.preferredValues=[];});}],
    ['boolean default',(r:any)=>{const n=r.nodes.find((n:any)=>n.id===leaf.id);Object.values(n.definitions).forEach((d:any)=>{if(d.type==='BOOLEAN')d.defaultValue=true;});}],
  ] as const) {
    const changed=structuredClone(receipt);mutate(changed);assert.notDeepEqual(changed,receipt,name);
    const altered=structuredClone(input);
    for(const identity of altered.creation.graphTargets) identity.propertyDefinitions=changed.nodes.find((n:any)=>n.id===identity.id)?.definitions;
    altered.creation.propertyDefinitions=altered.creation.graphTargets.at(-1).propertyDefinitions;
    assert.equal(verifyNativePreparedLibraryReadback(altered,changed).status,'refused',name);
  }
  const changed=structuredClone(input);changed.projection.source.inputSha256='d'.repeat(64);
  assert.throws(()=>emitNativePreparedLibraryReadbackScript(changed),/context-invalid/);
  const tokenContext=structuredClone(f.context);tokenContext.tokens.input.source={revision:f.source.revision,sourceProgramSha256:f.source.artifactId,tokensSha256:f.source.tokensSha256};
  assert.throws(()=>f.engine.buildNativePreparedLibraryScript(f.root,f.byId,f.source,tokenContext),/token-source-context/);
  assert.throws(()=>f.engine.compileNativeContractGraphDraft(f.root,f.byId,{revision:f.source.revision,programSha256:f.source.artifactId,evidenceRevision:f.source.revision},f.context.operation.id),/TOKEN_OVERLAY_UNQUALIFIED/);
});


test('prepared-library declared solid frame paints verify exactly and refuse altered or extra paint',async()=>{
  const f=await fixture(true,'Inter',false,undefined,true);
  const report=verifyNativePreparedLibraryReadback(f.input,f.receipt);
  assert.equal(report.status,'supported-structure-observed',JSON.stringify(report));
  const specs:any[]=[];
  const visit=(spec:any)=>{if(spec.lits?.fillColor&&!spec.backgroundPaint)specs.push(spec);(spec.children??[]).forEach(visit);};
  f.compiled.components.forEach(c=>c.variants.forEach(v=>visit(v.spec)));
  assert.deepEqual(specs.map(s=>s.type).sort(),['frame','root']);
  for (const spec of specs) {
    const row=f.receipt.nodes.find((n:any)=>n.metadata.nativeContractPart&&
      JSON.stringify(JSON.parse(n.metadata.nativeContractPart))===JSON.stringify(spec.nativeContractPart));
    assert.ok(row);
    const rounded=structuredClone(f.receipt),paint=rounded.nodes.find((n:any)=>n.id===row.id).values.fills[0];
    for(const key of ['r','g','b'])paint.color[key]=Math.fround(paint.color[key]);
    paint.opacity=Math.fround(paint.opacity??1);
    assert.equal(verifyNativePreparedLibraryReadback(f.input,rounded).status,'supported-structure-observed');
    for(const [name,mutate] of [
      ['missing',(v:any)=>{v.fills=[];}],
      ['extra',(v:any)=>{v.fills.push(structuredClone(v.fills[0]));}],
      ['type',(v:any)=>{v.fills[0].type='GRADIENT_LINEAR';}],
      ['hidden',(v:any)=>{v.fills[0].visible=false;}],
      ['blend',(v:any)=>{v.fills[0].blendMode='MULTIPLY';}],
      ['color',(v:any)=>{v.fills[0].color.r+=0.000001;}],
      ['opacity',(v:any)=>{v.fills[0].opacity=(v.fills[0].opacity??1)-0.1;}],
      ['alias',(v:any)=>{v.fills[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:f.input.tokenIdentity.variables[0].id}};}],
      ['node alias',(v:any)=>{v.boundVariables.fills=[{type:'VARIABLE_ALIAS',id:f.input.tokenIdentity.variables[0].id}];}],
      ['malformed node alias',(v:any)=>{v.boundVariables.fills={};}],
      ['missing color channel',(v:any)=>{delete v.fills[0].color.r;}],
      ['non-array paints',(v:any)=>{v.fills={0:v.fills[0],length:1};}],
    ] as const) {
      const changed=structuredClone(f.receipt);mutate(changed.nodes.find((n:any)=>n.id===row.id).values);
      const result=verifyNativePreparedLibraryReadback(f.input,changed);
      assert.equal(result.status,'refused',spec.type+' '+name);
      assert.ok(result.problems.some(p=>p.startsWith('native-library-observation-literal-fill')),spec.type+' '+name+' '+JSON.stringify(result));
    }
    const unrequested=structuredClone(f.input);
    const remove=(s:any)=>{if(JSON.stringify(s.nativeContractPart)===JSON.stringify(spec.nativeContractPart))delete s.lits.fillColor;(s.children??[]).forEach(remove);};
    unrequested.graphComponents!.forEach(c=>c.variants.forEach(v=>remove(v.spec)));
    unrequested.component.variants.forEach(v=>remove(v.spec));
    assert.equal(verifyNativePreparedLibraryReadback(unrequested,f.receipt).status,'refused','undeclared literal paint');
  }
});

test('native reaction API mirrors preserve exact behavior and reject additional actions and flags',()=>{
 const action={type:'NODE',destinationId:'1:2',navigation:'CHANGE_TO',transition:null};
 const expected=[{trigger:{type:'ON_HOVER'},actions:[action]}];
 const actual=[{trigger:{type:'ON_HOVER'},actions:[{...action,resetVideoPosition:false}],action:{...action,resetVideoPosition:false}}];
 assert.ok(nativeLibraryReactionsMatch(actual,expected));
 assert.ok(nativeLibraryReactionsMatch(expected,expected));
 for(const mutate of [(r:any)=>{r[0].actions[0].resetVideoPosition=true;},(r:any)=>{r[0].action.destinationId='foreign';},
   (r:any)=>{r[0].actions.push(action);},(r:any)=>{r[0].actions[0].resetScrollPosition=true;},(r:any)=>{r[0].trigger.delay=1;}]) {
   const changed=structuredClone(actual);mutate(changed);assert.equal(nativeLibraryReactionsMatch(changed,expected),false);
 }
});

test('inherited default slots remain borrowed and reject extra content, wrong stamps and nested overrides',async()=>{
  const {input,receipt}=await fixture('nested');
  const inherited=receipt.nodes.find((n:any)=>n.type==='INSTANCE' && !input.creation.nodes.some((c:any)=>c.id===n.id) &&
    n.metadata.nativeContractPart && JSON.parse(n.metadata.nativeContractPart).defaultSlotIndex===0);
  assert.ok(inherited);
  for(const mutate of [
    (r:any)=>{r.nodes.find((n:any)=>n.id===inherited.id).componentProperties.Size.value='Small';},
    (r:any)=>{r.nodes.find((n:any)=>n.id===inherited.childIds[0]).values.characters='Changed inherited default';},
    (r:any)=>{r.nodes.find((n:any)=>n.id===inherited.id).metadata.nativeSourceAllocation='foreign:1';},
    (r:any)=>{const original=r.nodes.find((n:any)=>n.id===inherited.id),extra={...structuredClone(original),id:'extra:1',childIds:[]};r.nodes.push(extra);r.nodes.find((n:any)=>n.id===original.parentId).childIds.push(extra.id);},
    (r:any)=>{r.nodes.find((n:any)=>n.id===inherited.id).childIds=[];},
  ]) {
    const changed=structuredClone(receipt);mutate(changed);
    assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused');
  }
});

test('uniform stroke edge mirrors retain exact variable identity and numeric uniformity',async()=>{
  const {input,receipt}=await fixture(false);
  const edges=['strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'];
  const mirrored=structuredClone(receipt);
  const roots=mirrored.nodes.filter((n:any)=>n.type==='COMPONENT');
  for(const node of roots) {
    const binding=node.values.boundVariables.strokeWeight;
    assert.equal(binding.type,'VARIABLE_ALIAS');
    for(const edge of edges) {node.values.boundVariables[edge]=binding;node.values[edge]=node.values.strokeWeight;}
    delete node.values.boundVariables.strokeWeight;
  }
  assert.equal(verifyNativePreparedLibraryReadback(input,mirrored).status,'supported-structure-observed');
  const other=input.tokenIdentity.variables.find(v=>v.tokenPath==='otherEdge')!;
  assert.ok(other);
  for(const [name,mutate] of [
    ['missing edge',(v:any)=>{delete v.boundVariables.strokeTopWeight;}],
    ['equal value foreign identity',(v:any)=>{v.boundVariables.strokeTopWeight={type:'VARIABLE_ALIAS',id:other.id};}],
    ['unequal weight',(v:any)=>{v.strokeLeftWeight=2;}],
    ['mixed uniform value',(v:any)=>{delete v.strokeWeight;}],
    ['contradictory scalar',(v:any)=>{v.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:other.id};}],
    ['extra alias',(v:any)=>{v.boundVariables.rotation=v.boundVariables.strokeTopWeight;}],
  ] as const) {
    const changed=structuredClone(mirrored);mutate(changed.nodes.find((n:any)=>n.id===roots[0].id).values);
    assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused',name);
  }
});

test('repeated nested instances scope inherited slots to their own component property owner',async()=>{
  const {input,receipt}=await fixture('repeated');
  const report=verifyNativePreparedLibraryReadback(input,receipt);
  assert.equal(report.status,'supported-structure-observed',JSON.stringify(report));
  const top=receipt.nodes.find((n:any)=>n.id===input.creation.target.id);
  const outer=receipt.nodes.find((n:any)=>n.id===top.childIds[0]);
  const nestedSlots=receipt.nodes.filter((n:any)=>n.type==='SLOT' && !input.creation.nodes.some((c:any)=>c.id===n.id));
  const slots=nestedSlots.filter((s:any)=>{
    let n=s;while(n && n.parentId!==outer.id) n=receipt.nodes.find((row:any)=>row.id===n.parentId);
    return !!n;
  });
  assert.equal(slots.length,2);
  assert.equal(slots[0].values.componentPropertyReferences.slotContentId,slots[1].values.componentPropertyReferences.slotContentId);
  for(const mutate of [
    (r:any)=>{r.nodes.find((n:any)=>n.id===slots[1].id).childIds=[];},
    (r:any)=>{r.nodes.find((n:any)=>n.id===slots[1].id).values.componentPropertyReferences.slotContentId='foreign#slot';},
    (r:any)=>{r.nodes.find((n:any)=>n.id===slots[1].childIds[0]).metadata.nativeSourceAllocation='foreign';},
    (r:any)=>{r.nodes.find((n:any)=>n.id===slots[1].childIds[0]).componentProperties.Size.value='Small';},
  ]) {
    const changed=structuredClone(receipt);mutate(changed);
    assert.equal(verifyNativePreparedLibraryReadback(input,changed).status,'refused');
  }
});

test('library default typography pins Inter without replacing a declared family or accepting malformed text',async()=>{
  for (const family of [null,'Roboto'] as const) {
    const f=await fixture(false,family);
    const expected=family ?? 'Inter';
    assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed');
    assert.ok(f.compiled.fonts.some(font=>font.family===expected));
    const text=f.receipt.nodes.find((n:any)=>n.type==='TEXT');
    assert.equal(text.values.fontName.family,expected);
    const changed=structuredClone(f.receipt);
    changed.nodes.find((n:any)=>n.id===text.id).values.fontName.family=expected==='Inter'?'Roboto':'Inter';
    assert.equal(verifyNativePreparedLibraryReadback(f.input,changed).status,'refused');
    if (family !== null) continue;
    const raw=f.engine.compileComponentData(f.root,f.byId),before=JSON.stringify(raw);
    assert.equal(raw.variants[0].spec.children![0].fontFamily,undefined);
    for (const mutate of [
      (spec:any)=>{spec.fontFamily='';},
      (spec:any)=>{spec.fontFamily=null;},
      (spec:any)=>{delete spec.fontStyle;},
      (spec:any)=>{spec.textStyle='unqualified-style';},
    ]) {
      const malformed=structuredClone(raw);mutate(malformed.variants[0].spec.children![0]);
      assert.throws(()=>annotateNativeContractProjection(f.root,malformed,structuredClone(f.compiled.projection)),/TEXT_OWNERSHIP_UNQUALIFIED/);
    }
    assert.equal(JSON.stringify(raw),before,'annotation never changes the compiler or original contract');
    const mixed=structuredClone(f.root);
    mixed.anatomy.root.parts!.other={text:'Another owner',declared:{'font-family':'Roboto'}};
    assert.throws(()=>f.engine.compileNativePreparedLibrary(mixed,new Map([[mixed.id,mixed]]),f.source,f.context.operation.id),/TEXT_OWNERSHIP_UNQUALIFIED/,
      'a declared family elsewhere does not grant a missing-family fallback');
  }
});


test('library readback rejects lost Fill on frames and slots',async()=>{
  const {input,receipt,compiled}=await fixture(true,'Inter',true);
  assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed');
  const fillSpecs:any[]=[];
  const visit=(spec:any)=>{if(spec.fillW)fillSpecs.push(spec);(spec.children??[]).forEach(visit);};
  compiled.components.forEach(c=>c.variants.forEach(v=>visit(v.spec)));
  const rows=fillSpecs.map(spec=>receipt.nodes.find((n:any)=>n.metadata.nativeContractPart&&
    JSON.stringify(JSON.parse(n.metadata.nativeContractPart))===JSON.stringify(spec.nativeContractPart)));
  assert.ok(rows.some((n:any)=>n?.type==='SLOT'));
  assert.ok(rows.some((n:any)=>n?.type==='FRAME'));
  for(const row of rows) {
    assert.ok(row);
    assert.equal(row.values.layoutSizingHorizontal,'FILL');
    for(const mode of ['HUG','FIXED',undefined]) {
      const changed=structuredClone(receipt);
      const node=changed.nodes.find((n:any)=>n.id===row.id);
      node.values.layoutSizingHorizontal=mode;
      const result=verifyNativePreparedLibraryReadback(input,changed);
      assert.equal(result.status,'refused',row.type+' '+mode);
      assert.ok(JSON.stringify(result).includes('native-library-observation-fill-width'));
    }
  }
});


test('library readback rejects lost vertical Fill without accepting a fixed height',async()=>{
  const {input,receipt,compiled}=await fixture(true,'Inter','height');
  assert.equal(verifyNativePreparedLibraryReadback(input,receipt).status,'supported-structure-observed');
  const specs:any[]=[];
  const visit=(spec:any)=>{if(spec.fillH)specs.push(spec);(spec.children??[]).forEach(visit);};
  compiled.components.forEach(c=>c.variants.forEach(v=>visit(v.spec)));
  const rows=specs.map(spec=>receipt.nodes.find((n:any)=>n.metadata.nativeContractPart&&
    JSON.stringify(JSON.parse(n.metadata.nativeContractPart))===JSON.stringify(spec.nativeContractPart)));
  assert.ok(rows.some((n:any)=>n?.type==='SLOT'));assert.ok(rows.some((n:any)=>n?.type==='FRAME'));
  for(const row of rows){
    assert.ok(row);assert.equal(row.values.layoutSizingVertical,'FILL');
    for(const mode of ['HUG','FIXED',undefined]){
      const changed=structuredClone(receipt);changed.nodes.find((n:any)=>n.id===row.id).values.layoutSizingVertical=mode;
      const result=verifyNativePreparedLibraryReadback(input,changed);
      assert.equal(result.status,'refused',row.type+' '+mode);
      assert.ok(JSON.stringify(result).includes('native-library-observation-fill-height'));
    }
  }
});


test('prepared-library growing shapes preserve Fill while fixed cross sizes stay exact',async()=>{
  for(const direction of ['row','column','percent'] as const){
    const f=await fixture(true,'Inter',false,direction);
    assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed');
    const legacy=structuredClone(f.input);
    const removeSizing=(spec:any)=>{if(spec.type==='shape'){delete spec.grow;delete spec.widthFill;}(spec.children??[]).forEach(removeSizing);};
    [legacy.component,...(legacy.graphComponents??[])].forEach(c=>c.variants.forEach(v=>removeSizing(v.spec)));
    const legacyResult=verifyNativePreparedLibraryReadback(legacy,f.receipt);
    assert.equal(legacyResult.status,'refused','an implicit legacy Fill flag cannot grant resized geometry');
    assert.ok(JSON.stringify(legacyResult).includes('native-contract-observation-shape-size'));
    const shapes=f.receipt.nodes.filter((n:any)=>['RECTANGLE','ELLIPSE'].includes(n.type));
    assert.equal(shapes.length,2);
    const field=direction!=='column'?'layoutSizingHorizontal':'layoutSizingVertical';
    const cross=direction!=='column'?'height':'width';
    for(const node of shapes){
      assert.equal(node.values[field],'FILL');
      for(const value of ['FIXED','HUG',undefined]){const r=structuredClone(f.receipt);r.nodes.find((n:any)=>n.id===node.id).values[field]=value;assert.equal(verifyNativePreparedLibraryReadback(f.input,r).status,'refused');}
      const r=structuredClone(f.receipt);r.nodes.find((n:any)=>n.id===node.id).values[cross]+=0.5;
      assert.equal(verifyNativePreparedLibraryReadback(f.input,r).status,'refused','fixed cross geometry remains exact');
      const axis=direction!=='column'?'width':'height';
      for(const invalid of [-1,NaN,Infinity,undefined]){const r=structuredClone(f.receipt);r.nodes.find((n:any)=>n.id===node.id).values[axis]=invalid;assert.equal(verifyNativePreparedLibraryReadback(f.input,r).status,'refused','invalid Fill extent');}
      const stretched=structuredClone(f.receipt);stretched.nodes.find((n:any)=>n.id===node.id).values[direction!=='column'?'layoutSizingVertical':'layoutSizingHorizontal']='FILL';assert.equal(verifyNativePreparedLibraryReadback(f.input,stretched).status,'refused','unsolicited cross-axis Fill');
    }
  }
});
