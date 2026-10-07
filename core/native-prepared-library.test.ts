import {createHash} from 'node:crypto';
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
import {nativeBoundPaintColor} from './native-paint-observation.js';

async function fixture(composed:boolean|'nested'|'repeated'=true, family:string|null='Inter', fill:boolean|'height'=false, shapes?:'row'|'column'|'percent'|'path'|'stroke'|'affine', literalPaint=false, callerInk=false, callerStroke=false,arc:boolean|'CENTER'|'OUTSIDE'=false,textColor=false,rootPaint=false,ratio=false,drawn=false,inset:false|'stretch'|'fixed'=false,line:false|{cap:'NONE'|'ROUND'|'SQUARE';align:'INSIDE'|'CENTER'|'OUTSIDE'}=false,image=false,textAppearance=false) {
  const host=nativeFixtureHost({instanceVariantSelection:true}); host.figma.fileKey='PreparedLibraryFixture';
  Object.getPrototypeOf(host.figma.currentPage).setExplicitVariableModeForCollection=function(c:any,mode:string) {
    this.explicitVariableModes={...this.explicitVariableModes,[c.id]:mode};
  };
  const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console},{timeout:5000})));
  const tokens={primitives:{ink:{$type:'color',$value:'#123456'},fade:{$type:'number',$value:0.5},
    weight:{$type:'number',$value:653},edge:{$type:'number',$value:1},otherEdge:{$type:'number',$value:1},...(callerInk?{callerInk:{$type:'color',$value:'#b51833'},drawingSize:{$type:'dimension',$value:'24px'}}:{})},
    semantic:{label:{$type:'color',$value:'{ink}'}},light:{},dark:{},brands:{default:{}}};
  const leaf=ContractSchema.parse({id:'test.library-leaf',name:'Leaf',version:'0.1.0',status:'draft',
    description:'Synthetic conformance fixture; no visual qualification',semantics:{element:'button'},states:['hover'],
    props:[{name:'label',type:'text',default:'Library label',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},
      {name:'shown',type:'boolean',default:false,bindings:{code:{prop:'shown'},figma:{kind:'BOOLEAN',property:'Shown'}}},
      {name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}],
    anatomy:{root:{layout:{display:'inline-flex'},tokens:{'border-width':'{edge}','border-color':'{ink}'},states:{hover:{opacity:'{fade}'}},parts:{
      text:{content:{prop:'label'},visibleWhen:{prop:'shown'},...(family === null ? {} : {declared:{'font-family':family}}),tokens:{color:'{label}','font-weight':'{weight}'}},
    }}},bindings:{code:{anchors:{importPath:'test/Leaf',export:'Leaf'}},figma:{statePreviews:true,anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-leaf-key'}}}});
  if(drawn){
    leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.props.push({name:'tone',type:{enum:['quiet','strong']},default:'quiet',bindings:{code:{prop:'tone'},figma:{kind:'VARIANT',property:'Tone',values:{quiet:'Quiet',strong:'Strong'}}}});
    leaf.bindings.figma.drawnVariants=[{size:'small',tone:'quiet'},{size:'small',tone:'strong'},{size:'large',tone:'quiet'}];
  }
  const parent=ContractSchema.parse({id:'test.library-parent',name:'Parent',version:'0.1.0',status:'draft',
    description:'A default slot instance plus an ordinary nested instance',props:[],states:[],semantics:{element:'div'},
    anatomy:{root:{layout:{display:'flex',direction:shapes==='percent'||shapes==='path'||shapes==='stroke'||shapes==='affine'?'column':shapes??'column',...(fill?{align:'stretch'}:{})},...((fill||shapes)?{literals:{width:'320px',...((fill==='height'||shapes)?{height:'300px'}:{})}}:{}),parts:{
      slot:{...(fill==='height'?{layout:{display:'flex',direction:'column',grow:true}}:{}),slot:{name:'children',defaultContent:[{id:leaf.id,props:{size:'large',label:'Default caller'}}],accepts:[leaf.id]}},
      leaf:{component:{id:leaf.id,props:{shown:true}}},
      ...(fill?{frame:{layout:{display:'flex',grow:true},parts:{nested:{slot:{name:'extra'}}}}}:{}),
      ...(shapes && shapes!=='path' && shapes!=='stroke' && shapes!=='affine'?Object.fromEntries(['rect','ellipse'].map(kind=>[kind,{shape:{kind,width:10,height:12},...(shapes==='percent'?{literals:{width:'100%'}}:{layout:{grow:true,growBasis:'zero'}}),tokens:{'background-color':'{ink}'}}])):{}),
    }}},bindings:{code:{anchors:{importPath:'test/Parent',export:'Parent'}},figma:{anchors:{fileKey:'OriginalSourceFile',componentSetKey:'original-parent-key'}}}});
  if (ratio) parent.anatomy.root.parts!.ratio = {layout:{display:'flex'},literals:{width:'240px'},declared:{'aspect-ratio':'6 / 7'}};
  if (literalPaint) {
    parent.anatomy.root.literals={...parent.anatomy.root.literals,'background-color':'#eeeeee80','border-color':'#0b120e24','border-width':'1px'};
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
        const strokes=(this.strokes??[]).flatMap((p:any)=>p.boundVariables?.color?[p.boundVariables.color]:[]);
        return {...explicit,...(fills.length?{fills}:{}),...(strokes.length?{strokes}:{})};
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
  if(shapes==='affine'){
    // Preserve the transform written by the generated program when cloning
    // instance descendants; the base host only copies rotation and position.
    const prototype=Object.getPrototypeOf(host.figma.currentPage);
    const clone=prototype._cloneForInstance;
    prototype._cloneForInstance=function(){
      const node=clone.call(this);
      if(this.relativeTransform!==undefined)node.relativeTransform=structuredClone(this.relativeTransform);
      return node;
    };
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex'},literals:{width:'40px',height:'12px'}};
    parent.anatomy.root.parts={turned:{component:{id:leaf.id},instanceAffine:{localSize:{width:40,height:12},transform:[[-1,0,40],[0,-1,12]]}}};
  }
  if(shapes==='stroke'){
    // Measured zero-height native geometry from fixture zero-height-native.json.
    // This synthetic API exercises the generated program, not visual fidelity.
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={declared:{position:'relative'},literals:{width:'50px',height:'12px'},parts:{
      line:{shape:{kind:'stroked-path',width:40,height:0,strokePath:{data:'M0 0L10 0L30 0L40 0',cap:'ROUND',join:'MITER',miterLimit:4,viewport:{width:50,height:12,x:3,y:6},constraints:{horizontal:'STRETCH',vertical:'STRETCH'}}},tokens:{'border-color':'{ink}'},literals:{'border-width':'4px'}},
    }};
    // Remove unrelated fixture props from the parent references.
    parent.anatomy.root.parts={leaf:{component:{id:leaf.id}}};
    const prototype=Object.getPrototypeOf(host.figma.currentPage);
    Object.defineProperty(prototype,'relativeTransform',{get(){return [[1,0,this.x],[0,1,this.y]];}});
    const clone=prototype._cloneForInstance;
    prototype._cloneForInstance=function(){const n=clone.call(this);for(const k of ['vectorPaths','isMask','blendMode','constraints','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','strokeAlign'])if(this[k]!==undefined)n[k]=structuredClone(this[k]);return n;};
    (host.figma as any).createVector=()=>{const n=host.figma.createRectangle() as any;n.type='VECTOR';n.isMask=false;n.blendMode='PASS_THROUGH';n.constraints={horizontal:'MIN',vertical:'MIN'};
      let paths:any;Object.defineProperty(n,'vectorPaths',{get:()=>paths,set(value){assert.equal(value[0].data,'M 0 0 L 10 0 L 30 0 L 40 0');paths=structuredClone(value);n.resize(40,0);}});return n;};
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
  if(callerStroke)parent.anatomy.root.parts!.leaf.parts!.selected.component!.sameInkInsideStroke={props:[],rows:[{values:[],stroke:{weight:1,cap:'NONE',join:'MITER',miterLimit:4}}]};
  if(arc){
    (host.figma as any).createEllipse=()=>{const n=host.figma.createRectangle() as any;n.type='ELLIPSE';return n;};
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex'},literals:{width:'20px',height:'20px'},parts:{ring:{shape:{kind:'ellipse',width:20,height:20,arc:{start:0,end:3.769911289215088,innerRadius:1,cap:'SQUARE',...(typeof arc==='string'?{align:arc}:{})}},tokens:{'border-width':'{edge}','border-color':'{ink}'}}}};
  }
  if(textColor){
    leaf.props=[{name:'ink',type:{enum:['#11223380']},bindings:{code:{prop:'ink'},figma:{kind:'NONE'}}}];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex',direction:'column'},parts:{label:{text:'Label',textColorOverrideProp:'ink',literals:{color:'#aa0000','font-size':'14px'}},other:{text:'Other',literals:{color:'#00aa00','font-size':'14px'}}}};
    parent.anatomy.root={layout:{display:'flex'},parts:{plain:{component:{id:leaf.id}},colored:{component:{id:leaf.id,props:{ink:'#11223380'}}}}};
  }
  if(textAppearance){
    const characters='Body\nLink';
    const runs=[{start:0,end:5},{start:5,end:9}].map((r,i)=>({...r,fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO' as const},letterSpacing:{unit:'PIXELS' as const,value:0},textCase:'ORIGINAL' as const,textDecoration:'NONE' as const,fill:{paint:{color:{r:0,g:0,b:i},opacity:1,blendMode:'NORMAL' as const}}}));
    leaf.props=[{name:'appearance',type:{enum:['observed']},bindings:{code:{prop:'appearance'},figma:{kind:'NONE'}}}];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex',direction:'column'},parts:{label:{text:characters,literals:{color:'#aa0000','font-size':'14px',width:'232px'},textAppearanceOverride:{prop:'appearance',choices:{observed:{characters,runs}}}}}};
    parent.anatomy.root={layout:{display:'flex'},parts:{plain:{component:{id:leaf.id}},colored:{component:{id:leaf.id,props:{appearance:'observed'}}}}};
    // The host does not model native styled ranges. Mirror only the measured
    // range APIs here; actual Plugin API behavior has separate live evidence.
    const proto=Object.getPrototypeOf(host.figma.currentPage);
    const clone=proto._cloneForInstance;proto._cloneForInstance=function(){const n=clone.call(this);if(this.type==='TEXT')n.textAutoResize=this.textAutoResize;return n;};
    for(const name of ['FontName','FontSize','LineHeight','LetterSpacing','TextCase','TextDecoration','Fills'])proto['setRange'+name]=function(start:number,end:number,value:any){
      const rows=this._appearanceRows??(this._appearanceRows=new Map());
      const row=rows.get(start)??{start,end,characters:this.characters.slice(start,end),fontWeight:400};
      row[name[0].toLowerCase()+name.slice(1)]=structuredClone(value);rows.set(start,row);
    };
    proto.getStyledTextSegments=function(this:any,_fields:unknown,start=0,end=this.characters.length){
      if(this._appearanceRows)return [...this._appearanceRows.values()].filter((r:any)=>r.start>=start&&r.end<=end);
      return [{start,end,characters:this.characters.slice(start,end),fontName:this.fontName,fontSize:this.fontSize,fontWeight:this.fontWeight??500,lineHeight:this.lineHeight,letterSpacing:this.letterSpacing,textCase:this.textCase??'ORIGINAL',textDecoration:this.textDecoration??'NONE',fills:this.fills}];
    };
  }
  if(rootPaint){
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={instanceRootInputs:['background-color'],layout:{display:'flex'},literals:{width:'20px',height:'20px','background-color':'#aa0000','border-radius':'6px'}};
    parent.anatomy.root={layout:{display:'flex'},parts:{plain:{component:{id:leaf.id}},colored:{component:{id:leaf.id,rootOverrides:{'background-color':'{label}'}}}}};
  }
  if(inset){
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex',direction:'row'},literals:{width:'40px',height:'30px'},parts:{
      focus:{declared:{position:'absolute'},literals:{top:'-2px',right:'-2px',bottom:'-2px',left:'-2px',...(inset==='fixed'?{width:'12px',height:'14px'}:{})},parts:{mark:{shape:{kind:'rect',width:2,height:2},literals:{'background-color':'#123456'}}}},
    }};
    parent.anatomy.root.parts={leaf:{component:{id:leaf.id}}};
  }
  if(line){
    leaf.props=[];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex',direction:'row'},literals:{width:'40px',height:'50px'},parts:{indicator:{shape:{kind:'line',width:33,height:0,line:{length:33,transform:[[0,-1,4],[1,0,6]],cap:line.cap,align:line.align}},tokens:{'border-width':'{edge}'},literals:{'border-color':'#123456'}}}};
    parent.anatomy.root.parts={leaf:{component:{id:leaf.id}}};
    const prototype=Object.getPrototypeOf(host.figma.currentPage);
    Object.defineProperty(prototype,'relativeTransform',{get(){const m=this._lineMatrix??[[1,0,0],[0,1,0]];return [[m[0][0],m[0][1],this.x],[m[1][0],m[1][1],this.y]];},set(m){this._lineMatrix=structuredClone(m);this.x=m[0][2];this.y=m[1][2];}});
    const clone=prototype._cloneForInstance;prototype._cloneForInstance=function(){const n=clone.call(this);if(this.type==='LINE'){n.relativeTransform=this.relativeTransform;n.strokeCap=this.strokeCap;n.strokeAlign=this.strokeAlign;n.dashPattern=[];}return n;};
    (host.figma as any).createLine=()=>{const n=host.figma.createRectangle() as any;n.type='LINE';n.dashPattern=[];return n;};
  }
  if(image){
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const url=`url('data:image/png;base64,${png}')`;
    (tokens.primitives as any).image={$type:'string',$value:url};
    leaf.props=[{name:'photo',type:{enum:['crop']},bindings:{code:{prop:'photo'},figma:{kind:'NONE'}}}];leaf.states=[];delete leaf.bindings.figma.statePreviews;
    leaf.anatomy.root={layout:{display:'flex'},parts:{photo:{literals:{width:'16px',height:'16px'},tokens:{'background-image':'{image}'},declared:{'background-size':'cover','background-position':'50% 50%','background-repeat':'no-repeat'},imageOverride:{prop:'photo',choices:{crop:{image:url,size:'200% 400%',position:'25% 75%'}}}}}};
    parent.anatomy.root.parts={leaf:{component:{id:leaf.id,props:{photo:'crop'}}}};
    const assets=new Map<string,Uint8Array>();
    Object.assign(host.figma,{base64Decode:(s:string)=>new Uint8Array(Buffer.from(s,'base64')),base64Encode:(b:Uint8Array)=>Buffer.from(b).toString('base64'),createImage:(bytes:Uint8Array)=>{const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,new Uint8Array(bytes));return{hash};},getImageByHash:(hash:string)=>assets.has(hash)?{getBytesAsync:async()=>new Uint8Array(assets.get(hash)!)}:null});
  }
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
  // The mock lacks Figma's uniform edge mirrors on frames; reproduce the
  // independently captured native API fields before exercising readback.
  if(literalPaint) for(const born of creation.nodes) {
    const n=await host.figma.getNodeByIdAsync(born.id);
    if(n && ['COMPONENT','FRAME'].includes(n.type) && n.strokes?.length) {
      for(const field of ['strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight']) n[field]=n.strokeWeight;
      n.dashPattern=[];
    }
  }
  const receipt=await run(emitNativePreparedLibraryReadbackScript(input));
  return {host,run,source,root,byId,engine,context,compiled,script,creation,input,receipt,tokens};
}

test('prepared inventory verifies an explicitly allocated bound receiver and still checks foreground topology',async()=>{
  const f=await fixture(false),input:any=structuredClone(f.input),receipt:any=structuredClone(f.receipt);
  const component=input.graphComponents[0],spec=component.variants[0].spec;
  const born=input.creation.variants[0],host=receipt.nodes.find((n:any)=>n.id===born.id);
  const mode=host.values.explicitVariableModes;
  const vars=receipt.tokens.receipt.variables;
  for(const v of vars)for(const value of Object.values(v.valuesByMode??{}))if(value&&typeof value==='object'&&'r'in value)for(const k of ['r','g','b','a'])if(typeof (value as any)[k]==='number')(value as any)[k]=Math.fround((value as any)[k]);
  const bound=nativeBoundPaintColor('ink',vars,mode,input.tokenIdentity.collection.id)!;
  const paint={color:{r:bound.color.r,g:bound.color.g,b:bound.color.b},opacity:bound.color.a??1,blendMode:'MULTIPLY'};
  spec.solidFillCompositionToken='ink';spec.solidFillComposition={type:'SOLID',...paint};
  Object.assign(input.component.variants[0].spec,spec);
  const reader=emitNativePreparedLibraryReadbackScript(input);
  const fields=JSON.parse(reader.match(/const FIELDS = (\[[^\n]+\]);/)![1]);
  for(const field of ['rotation','cornerSmoothing','itemReverseZIndex','isMask','blendMode','constraints'])assert(fields.includes(field),field);
  const id='synthetic:bound-paint';
  Object.assign(host.values,{width:40,height:20,itemReverseZIndex:false,cornerSmoothing:0});
  const layer={id,type:'RECTANGLE',name:'[ds-contracts bound paint]',parentId:host.id,childIds:[],metadata:{nativeSourceOperation:host.metadata.nativeSourceOperation},values:{
    x:0,y:0,width:host.values.width,height:host.values.height,visible:true,opacity:1,rotation:0,relativeTransform:[[1,0,0],[0,1,0]],
    layoutPositioning:'ABSOLUTE',constraints:{horizontal:'STRETCH',vertical:'STRETCH'},isMask:false,strokes:[],effects:[],blendMode:'MULTIPLY',
    fills:[{type:'SOLID',color:paint.color,opacity:paint.opacity,blendMode:'NORMAL',boundVariables:{color:{type:'VARIABLE_ALIAS',id:bound.id}}}],
    ...Object.fromEntries(['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','cornerSmoothing'].map(k=>[k,host.values[k]])),
    explicitVariableModes:{},resolvedVariableModes:mode,componentPropertyReferences:{},
  }};
  host.childIds.unshift(id);receipt.nodes.push(layer);input.creation.nodes.push({id,type:'RECTANGLE'});
  const verify=()=>verifyNativePreparedLibraryReadback(input,receipt);
  assert.equal(verify().status,'supported-structure-observed',JSON.stringify(verify()));
  layer.values.width-=.25;assert.notEqual(verify().status,'supported-structure-observed');layer.values.width+=.25;
  layer.values.fills[0].boundVariables.color.id='wrong';assert.notEqual(verify().status,'supported-structure-observed');layer.values.fills[0].boundVariables.color.id=bound.id;
  host.childIds.pop();assert.notEqual(verify().status,'supported-structure-observed');
});

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

test('prepared-library literal strokes require exact paint, uniform weights and alignment',async()=>{
 const f=await fixture(true,'Inter',false,undefined,true);
 const row=f.receipt.nodes.find((n:any)=>n.type==='COMPONENT' && n.values.strokes?.[0]?.opacity<1);
 assert.ok(row);assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed');
 for(const change of [
  (v:any)=>{v.strokes=[];},(v:any)=>{v.strokes.push(structuredClone(v.strokes[0]));},
  (v:any)=>{v.strokes[0].color.r+=0.001;},(v:any)=>{v.strokes[0].opacity=1;},
  (v:any)=>{v.strokes[0].visible=false;},(v:any)=>{v.strokes[0].blendMode='MULTIPLY';},
  (v:any)=>{v.strokeTopWeight=2;},(v:any)=>{v.strokeWeight=2;},
  (v:any)=>{v.strokeAlign='CENTER';},(v:any)=>{v.dashPattern=[2,2];},
  (v:any)=>{v.strokes[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'foreign'}};},
  (v:any)=>{v.boundVariables.strokes=[{type:'VARIABLE_ALIAS',id:'foreign'}];},
 ]){const r=structuredClone(f.receipt);change(r.nodes.find((n:any)=>n.id===row.id).values);
  assert.ok(verifyNativePreparedLibraryReadback(f.input,r).problems.some(p=>p.startsWith('native-library-observation-literal-stroke')));}
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
    assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(f.input,f.receipt)));
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
    assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(f.input,f.receipt)));
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

test('complete native library observes owned and inherited zero-height stroked paths',async()=>{
 const f=await fixture('nested','Inter',false,'stroke');
 const report=verifyNativePreparedLibraryReadback(f.input,f.receipt);
 assert.equal(report.status,'supported-structure-observed',JSON.stringify(report));
 const vectors=f.receipt.nodes.filter((n:any)=>n.type==='VECTOR');assert(vectors.length>=2);
 for(const node of vectors){for(const mutate of [
  (v:any)=>v.vectorPaths[0].data='M0 0L11 0L30 0L40 0',
  (v:any)=>v.strokeCap='SQUARE',(v:any)=>v.strokeWeight=5,
  (v:any)=>v.strokes[0].color.r=0,(v:any)=>v.isMask=true,
  (v:any)=>v.constraints.horizontal='SCALE',
 ]){const changed=structuredClone(f.receipt);mutate(changed.nodes.find((n:any)=>n.id===node.id).values);
  assert.equal(verifyNativePreparedLibraryReadback(f.input,changed).status,'refused',node.id);
 }}
});

test('native library verifies affine allocation, local dimensions and exact instance transform',async()=>{
 const f=await fixture('nested','Inter',false,'affine');
 assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed',JSON.stringify(verifyNativePreparedLibraryReadback(f.input,f.receipt)));
 const instances=f.receipt.nodes.filter((n:any)=>n.type==='INSTANCE'&&n.values.relativeTransform?.[0]?.[0]===-1);assert(instances.length>=2);
 for(const instance of instances){
 const host=f.receipt.nodes.find((n:any)=>n.id===instance.parentId);
 for(const change of [(r:any)=>r.nodes.find((n:any)=>n.id===instance.id).values.relativeTransform[0][0]=1,
  (r:any)=>r.nodes.find((n:any)=>n.id===instance.id).values.width=41,
  (r:any)=>r.nodes.find((n:any)=>n.id===host.id).values.layoutMode='HORIZONTAL',
  (r:any)=>r.nodes.find((n:any)=>n.id===host.id).values.height=13]){
  const receipt=structuredClone(f.receipt);change(receipt);const result=verifyNativePreparedLibraryReadback(f.input,receipt);
  assert.equal(result.status,'refused');assert(result.problems.some(p=>p.includes('native-instance-affine-observation')));
 }
 }
});


test('native same-ink inside stroke retains one usage and refuses independent readback corruption',async()=>{
 const f=await fixture(true,'Inter',false,'path',false,true,true);
 const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify({result,vectors:f.receipt.nodes.filter((n:any)=>n.type==='VECTOR').map((n:any)=>n.values)}));
 const vectors=f.receipt.nodes.filter((n:any)=>n.type==='VECTOR'),stroked=vectors.filter((n:any)=>n.values.strokes.length);
 assert.equal(vectors.length,3);assert.equal(stroked.length,1,'main and untouched sibling remain unstroked');const id=stroked[0].id;
 assert.deepEqual(stroked[0].values.fills,stroked[0].values.strokes);
 for(const mutate of [(v:any)=>v.strokes=[],(v:any)=>v.strokeAlign='CENTER',(v:any)=>v.strokeWeight=2,(v:any)=>v.strokeCap='ROUND',(v:any)=>v.strokeJoin='BEVEL',(v:any)=>v.strokeMiterLimit=6,(v:any)=>v.dashPattern=[1,1],(v:any)=>v.strokes[0].opacity=.5,(v:any)=>v.strokes[0].boundVariables.color.id='foreign',(v:any)=>v.boundVariables.strokes=[],(v:any)=>v.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:'foreign'}]){
  const bad=structuredClone(f.receipt);mutate(bad.nodes.find((n:any)=>n.id===id).values);assert.equal(verifyNativePreparedLibraryReadback(f.input,bad).status,'refused',String(mutate));
 }
});


test('inside-stroke opaque ink is checked across modes and unsupported child geometry refuses',async()=>{
 const f=await fixture(true,'Inter',false,'path',false,true,true);
 const {instanceInsideStrokeTokenErrors}=await import('../packages/core/src/instance-inside-stroke.js');
 assert.deepEqual(instanceInsideStrokeTokenErrors(f.root,f.byId,f.tokens),[]);
 const alpha=structuredClone(f.tokens);alpha.dark={callerInk:{$type:'color',$value:'#b5183380'}};
 assert(instanceInsideStrokeTokenErrors(f.root,f.byId,alpha).some(x=>x.includes('opaque-token-unproven')));
 const byId=new Map([...f.byId].map(([id,c])=>[id,structuredClone(c)]));
 const ref=f.root.anatomy.root.parts!.leaf.parts!.selected.component!,child=byId.get(ref.id)!;
 child.anatomy.root.parts!.ink.literals!['border-width']='1px';
 assert(instanceInsideStrokeTokenErrors(f.root,byId,f.tokens).some(x=>x.includes('child-drawing-unqualified')));
 const bad=structuredClone(f.root);bad.anatomy.root.parts!.leaf.parts!.selected.component!.sameInkInsideStroke!.rows=[];
 assert.equal(ContractSchema.safeParse(bad).success,false);
 const noColor=structuredClone(f.root);delete noColor.anatomy.root.parts!.leaf.parts!.selected.component!.overrides!.color;
 assert.equal(ContractSchema.safeParse(noColor).success,false);
});


test('native ellipse cap and arc survive compilation and independent readback',async()=>{
 for(const align of [true,'CENTER','OUTSIDE'] as const){
 const f=await fixture(false,'Inter',false,undefined,false,false,false,align);
 const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 const ellipse=f.receipt.nodes.find((n:any)=>n.type==='ELLIPSE');assert(ellipse);assert.equal(ellipse.values.strokeCap,'SQUARE');
 for(const change of [(v:any)=>v.strokeCap='NONE',(v:any)=>v.arcData.startingAngle=.1,(v:any)=>v.arcData.endingAngle+=.1,(v:any)=>v.arcData.innerRadius=.8,(v:any)=>v.strokeAlign='WRONG']){
  const receipt=structuredClone(f.receipt);change(receipt.nodes.find((n:any)=>n.id===ellipse.id).values);
  assert(verifyNativePreparedLibraryReadback(f.input,receipt).problems.some(p=>p.includes('native-ellipse-arc-observation-changed')));
 }
 }
});

test('prepared native readback verifies scoped text paint and rejects independent corruption',async()=>{
 const f=await fixture(true,'Inter',false,undefined,false,false,false,false,true);
 const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 const labels=f.receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.values.characters==='Label');assert.equal(labels.length,3);
 const painted=labels.find((n:any)=>Math.abs(n.values.fills[0].color.r-17/255)<.000001);assert(painted);
 assert.equal(labels.filter((n:any)=>Math.abs(n.values.fills[0].color.r-170/255)<.000001).length,2);
 for(const mutate of [(n:any)=>n.values.fills=[],(n:any)=>n.values.fills[0].color.r=1,(n:any)=>n.values.fills[0].opacity=1,(n:any)=>n.values.fills[0].blendMode='MULTIPLY',(n:any)=>n.values.fills[0].visible=false,(n:any)=>n.values.fills[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'foreign'}},(n:any)=>n.values.boundVariables.fills=[{type:'VARIABLE_ALIAS',id:'foreign'}],(n:any)=>n.metadata.textColorOverride='wrong',(n:any)=>n.values.characters='Wrong']){
  const bad=structuredClone(f.receipt);mutate(bad.nodes.find((n:any)=>n.id===painted.id));assert.equal(verifyNativePreparedLibraryReadback(f.input,bad).status,'refused',String(mutate));
 }
 for(const target of f.receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.id!==painted.id)){
  const bad=structuredClone(f.receipt);bad.nodes.find((n:any)=>n.id===target.id).values.fills=structuredClone(painted.values.fills);assert.equal(verifyNativePreparedLibraryReadback(f.input,bad).status,'refused','untouched sibling or main '+target.id);
 }
});


test('native instance root fill binds verified tokens and readback rejects changed bindings, paint, mains and siblings',async()=>{
 const f=await fixture(true,'Inter',false,undefined,false,false,false,false,false,true);
 assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed');
 const instances=f.receipt.nodes.filter((n:any)=>n.type==='INSTANCE'),painted=instances.find((n:any)=>n.values.fills?.[0]?.boundVariables?.color);
 assert(painted);assert.equal(instances.length,2);
 for(const mutate of [(n:any)=>n.values.fills=[],(n:any)=>n.values.fills[0].color.r=1,(n:any)=>n.values.fills[0].opacity=.5,(n:any)=>n.values.fills[0].blendMode='MULTIPLY',(n:any)=>n.values.fills[0].boundVariables.color.id='foreign',(n:any)=>n.values.boundVariables.fills=[{type:'VARIABLE_ALIAS',id:'foreign'}]]){
  const bad=structuredClone(f.receipt);mutate(bad.nodes.find((n:any)=>n.id===painted.id));assert.equal(verifyNativePreparedLibraryReadback(f.input,bad).status,'refused',String(mutate));
 }
 for(const id of [painted.mainId,instances.find((n:any)=>n.id!==painted.id).id]){
  const bad=structuredClone(f.receipt);bad.nodes.find((n:any)=>n.id===id).values.fills=structuredClone(painted.values.fills);assert.equal(verifyNativePreparedLibraryReadback(f.input,bad).status,'refused','changed untouched root '+id);
 }
});


test('prepared ratio readback rejects a lost or changed lock despite unchanged dimensions',async()=>{
  const f=await fixture(true,'Inter',false,undefined,false,false,false,false,false,false,true);
  assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed');
  const locked=f.receipt.nodes.filter((n:any)=>n.values.targetAspectRatio);
  assert(locked.length>0);
  for(const value of [undefined,null,{x:240,y:240},{x:0,y:0},{x:-240,y:-280}]) {
    const receipt=structuredClone(f.receipt);
    const n=receipt.nodes.find((n:any)=>n.id===locked[0].id);
    if(value===undefined)delete n.values.targetAspectRatio;else n.values.targetAspectRatio=value;
    const report=verifyNativePreparedLibraryReadback(f.input,receipt);
    assert.equal(report.status,'refused',JSON.stringify(value));
    assert(JSON.stringify(report).includes('native-source-observation-aspect-ratio'));
  }
});


test('prepared native libraries create and read back only captured positive variant tuples',async()=>{
 const f=await fixture(true,'Inter',false,undefined,false,false,false,false,false,false,false,true);
 const leaf=f.compiled.components.find(c=>c.contractId.endsWith('test.library-leaf'))!;
 assert(leaf);assert.deepEqual(leaf.variants.map(v=>v.name),['Size=Small, Tone=Quiet','Size=Small, Tone=Strong','Size=Large, Tone=Quiet']);
 const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);
 assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 const bad=structuredClone(f.byId.get('test.library-leaf')!);bad.bindings.figma.drawnVariants![0].tone='unknown';
 const byId=new Map(f.byId);byId.set(bad.id,bad);
 assert.throws(()=>f.engine.compileNativePreparedLibrary(f.root,byId,f.source,f.context.operation.id),/drawn-variant/);
});


test('prepared inset frames preserve offsets and allocation and reject geometry or ownership tampering',async()=>{
 for(const mode of ['stretch','fixed'] as const){
  const f=await fixture(true,'Inter',false,undefined,false,false,false,false,false,false,false,false,mode);
  const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);
  assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
  const spec=f.compiled.components.find(c=>c.contractId.endsWith('test.library-leaf'))!.variants[0].spec.children![0];
  assert.equal(spec.insetOverlay,true,JSON.stringify(spec));
  const nodes=f.receipt.nodes.filter((n:any)=>n.name==='focus'&&n.type==='FRAME');assert.equal(nodes.length,2);
  for(const node of nodes){
  assert.deepEqual([node.values.x,node.values.y,node.values.width,node.values.height],mode==='fixed'?[-2,-2,12,14]:[-2,-2,44,34]);
  for(const change of [(n:any)=>n.values.x++,(n:any)=>n.values.width++,(n:any)=>n.values.height++,(n:any)=>n.values.layoutPositioning='AUTO',(n:any)=>n.values.primaryAxisSizingMode='AUTO',(n:any)=>n.values.constraints.horizontal='CENTER',(n:any)=>n.metadata.nativeContractPart='{}']){
   const bad=structuredClone(f.receipt);change(bad.nodes.find((n:any)=>n.id===node.id));
   assert.notEqual(verifyNativePreparedLibraryReadback(f.input,bad).status,'supported-structure-observed',String(change));
  }
  }
 }
});


test('prepared native lines retain zero height and captured basis across caps and alignments',async()=>{
 for(const cap of ['NONE','ROUND','SQUARE'] as const)for(const align of ['INSIDE','CENTER','OUTSIDE'] as const){
  const f=await fixture(true,'Inter',false,undefined,false,false,false,false,false,false,false,false,false,{cap,align});
  const result=verifyNativePreparedLibraryReadback(f.input,f.receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
  const lines=f.receipt.nodes.filter((n:any)=>n.type==='LINE');assert.equal(lines.length,2);
  for(const node of lines){
   assert.equal(node.values.height,0);assert.equal(node.values.width,33);assert.deepEqual(node.values.relativeTransform,[[0,-1,4],[1,0,6]]);
   for(const mutate of [(n:any)=>n.values.height=1,(n:any)=>n.values.width=32,(n:any)=>n.values.relativeTransform[0][2]++,
     (n:any)=>n.values.strokeCap='TRIANGLE',(n:any)=>n.values.strokeAlign='OTHER',(n:any)=>n.values.strokeWeight=5,
     (n:any)=>n.values.strokes[0].color.r=1,(n:any)=>n.values.layoutPositioning='AUTO',(n:any)=>n.metadata.nativeContractPart='{}']){
    const bad=structuredClone(f.receipt);mutate(bad.nodes.find((n:any)=>n.id===node.id));assert.notEqual(verifyNativePreparedLibraryReadback(f.input,bad).status,'supported-structure-observed',String(mutate));
   }
  }
 }
});
test('graph slot caller copies require the exact inherited main topology',async()=>{
 const {resolveNativeGraphSlotIdentities}=await import('./native-slot-identity.js');
 const row=(id:string,type:string,parentId:string|null,childIds:string[],extra:any={})=>({id,type,parentId,childIds,metadata:{},...extra});
 const rows=[row('main','COMPONENT',null,['slot']),row('slot','SLOT','main',['owned']),
  row('owned','INSTANCE','slot',[],{mainId:'icon',metadata:{nativeSourceAllocation:'owned',nativeContractPart:'{"specPath":[0]}'}}),
  row('icon','COMPONENT',null,[]),row('outer','INSTANCE',null,['copySlot'],{mainId:'main'}),
  row('copySlot','SLOT','outer',['copy']),
  row('copy','INSTANCE','copySlot',[],{mainId:'icon',metadata:{nativeSourceAllocation:'owned',nativeContractPart:'{"specPath":[0]}'}})];
 const creation={graphVerification:2,nodes:rows.slice(0,5).map(({id,type})=>({id,type}))};
 assert.deepEqual(resolveNativeGraphSlotIdentities(creation,rows),rows);
 for(const change of [
  (r:any[])=>{r[4].mainId='icon';},
  (r:any[])=>{r[6].mainId='foreign';},
  (r:any[])=>{r[6].metadata.nativeContractPart='foreign';},
  (r:any[])=>{r[5].childIds=[];},
  (r:any[])=>{r[5].childIds.unshift('duplicate');r.push({...structuredClone(r[6]),id:'duplicate'});},
  (r:any[])=>{r[1].childIds=[];},
 ]) {const changed=structuredClone(rows);change(changed);assert.equal(resolveNativeGraphSlotIdentities(creation,changed),null);}
 assert.equal(resolveNativeGraphSlotIdentities({...creation,graphVerification:1},rows),null);
});
test('single-line declared text overrides own only a natively auto-sized width',async()=>{
 const {nativeTextOverrideOwnsWidth}=await import('./native-source-observation.js');
 const spec:any={type:'text',name:'label',contentProp:'Label'};
 const source:any={type:'TEXT',values:{characters:'Long source text',width:200,height:16,textAutoResize:'WIDTH_AND_HEIGHT',layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',componentPropertyReferences:{characters:'Label#1:2'}}};
 const child=structuredClone(source);child.values.characters='Short';child.values.width=45;
 const props={ 'Label#1:2':{type:'TEXT',value:'Short'}};
 assert.ok(nativeTextOverrideOwnsWidth(spec,child,source,props));
 for(const mutate of [
  (s:any,c:any)=>{s.fixedWidth={px:200};},(s:any,c:any)=>{s.bindings={width:'width'};},
  (s:any,c:any)=>{s.contentProp='Other';},(s:any,c:any)=>{c.values.textAutoResize='NONE';},
  (s:any,c:any)=>{delete c.values.textAutoResize;},(s:any,c:any)=>{c.values.layoutSizingHorizontal='FIXED';},
  (s:any,c:any)=>{c.values.layoutSizingVertical='FIXED';},(s:any,c:any)=>{c.values.width=NaN;},
  (s:any,c:any)=>{c.values.characters='Unrequested';},(s:any,c:any)=>{c.type='FRAME';},
  (s:any,c:any)=>{c.values.componentPropertyReferences.characters='Foreign#1:2';},
 ]) {const s=structuredClone(spec),c=structuredClone(child);mutate(s,c);assert.equal(nativeTextOverrideOwnsWidth(s,c,source,props),false);}
 assert.equal(nativeTextOverrideOwnsWidth(spec,child,source,{'Label#1:2':{type:'BOOLEAN',value:'Short'}}),false);
 const unchanged=structuredClone(child);unchanged.values.characters=source.values.characters;
 assert.equal(nativeTextOverrideOwnsWidth(spec,unchanged,source,{'Label#1:2':{type:'TEXT',value:source.values.characters}}),false);
});
test('ordinary native text retains nonstandard declared weight and rejects detached or altered bindings',async()=>{
 const f=await fixture(false);
 const texts=f.receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.metadata.fontWeightVar==='weight');
 assert.ok(texts.length);assert.ok(texts.every((n:any)=>n.values.fontWeight===653));
 assert.equal(verifyNativePreparedLibraryReadback(f.input,f.receipt).status,'supported-structure-observed');
 for(const change of [
  (v:any)=>{delete v.boundVariables.fontWeight;},
  (v:any)=>{v.boundVariables.fontWeight={type:'VARIABLE_ALIAS',id:'foreign'};},
  (v:any)=>{v.fontWeight=500;},
  (v:any)=>{delete v.fontWeight;},
 ]){const r=structuredClone(f.receipt);change(r.nodes.find((n:any)=>n.id===texts[0].id).values);assert.equal(verifyNativePreparedLibraryReadback(f.input,r).status,'refused');}
 const nativeArray=structuredClone(f.receipt);for(const n of nativeArray.nodes)if(n.type==='TEXT'&&n.values.boundVariables.fontWeight)n.values.boundVariables.fontWeight=[n.values.boundVariables.fontWeight];
 assert.equal(verifyNativePreparedLibraryReadback(f.input,nativeArray).status,'supported-structure-observed');
});


test('image overrides qualify only with independently read original bytes, target and crop',async()=>{
 const f=await fixture(true,null,false,undefined,false,false,false,false,false,false,false,false,false,false,true);
 const verify=(r:any)=>verifyNativePreparedLibraryReadback(f.input,r);
 const result=verify(f.receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 const imageRows=f.receipt.nodes.filter((n:any)=>n.values.fills?.some((p:any)=>p.type==='IMAGE'));
 assert(imageRows.length>=2);
 for(const original of imageRows){
  for(const mutation of ['bytes','marker','crop','underlay','binding']){
   const receipt=structuredClone(f.receipt),row=receipt.nodes.find((n:any)=>n.id===original.id),paint=row.values.fills.find((p:any)=>p.type==='IMAGE');
   if(mutation==='bytes')row.imageAssets[paint.imageHash]='wrong';
   if(mutation==='marker')row.metadata.imageOverride='wrong-owner:photo';
   if(mutation==='crop')paint.scaleMode='FIT';
   if(mutation==='underlay')row.values.fills.unshift({type:'SOLID',color:{r:1,g:0,b:0}});
   if(mutation==='binding')row.values.boundVariables={...row.values.boundVariables,fills:[{type:'VARIABLE_ALIAS',id:'wrong'}]};
   const bad=verify(receipt);assert.equal(bad.status,'refused',original.id+':'+mutation+':'+JSON.stringify(bad));
  }
 }

});


test('prepared library independently verifies appearance ranges and refuses corruption on any owner',async()=>{
 const f=await fixture(true,'Inter',false,undefined,false,false,false,false,false,false,false,false,false,false,false,true);
 const verify=(r:any)=>verifyNativePreparedLibraryReadback(f.input,r);
 const result=verify(f.receipt);assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 const selected=f.receipt.nodes.find((n:any)=>n.values.textAppearanceRuns?.length===2);assert(selected);
 for(const text of f.receipt.nodes.filter((n:any)=>n.type==='TEXT'))for(const mutation of ['width','mode']){const bad=structuredClone(f.receipt),row=bad.nodes.find((n:any)=>n.id===text.id);if(mutation==='width')row.values.width+=1;else row.values.textAutoResize='WIDTH_AND_HEIGHT';assert.equal(verify(bad).status,'refused',mutation+':'+text.id);}
 for(const mutate of [(n:any)=>{delete n.values.textAppearanceRuns;},(n:any)=>{n.values.textAppearanceRuns[1].fills[0].color.b=0;},(n:any)=>{n.values.textAppearanceRuns[1].fontWeight=500;},(n:any)=>{n.values.textAppearanceRuns[1].lineHeight={unit:'PIXELS',value:20};},(n:any)=>{n.values.textAppearanceRuns[1].start=6;},(n:any)=>{n.metadata.textAppearanceOverride='foreign';},(n:any)=>{n.values.characters='stale';},(n:any)=>{n.values.boundVariables={fills:[{type:'VARIABLE_ALIAS',id:'foreign'}]};}]){
  const bad=structuredClone(f.receipt);mutate(bad.nodes.find((n:any)=>n.id===selected.id));assert.equal(verify(bad).status,'refused',String(mutate));
 }
 for(const row of f.receipt.nodes.filter((n:any)=>n.type==='TEXT'&&n.id!==selected.id)){
  const bad=structuredClone(f.receipt);bad.nodes.find((n:any)=>n.id===row.id).values.fills=[{type:'SOLID',color:{r:0,g:0,b:1}}];assert.equal(verify(bad).status,'refused','unchosen source '+row.id);
 }
});
