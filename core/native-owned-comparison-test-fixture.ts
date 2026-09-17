import assert from 'node:assert/strict';
import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';
import { revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput } from './native-source-observation.js';
import { prepareNativeContractComparison, type NativeContractComparisonInput } from './native-contract-comparison.js';
import { emitNativeContractComparisonReadbackScript, verifyNativeContractComparisonReadback } from './native-contract-comparison-observation.js';

export async function nativeOwnedComparisonFixture(wrapped=false, boundHeight=false, fileKey?:string) {
  const f = await nativeComparisonFixture(fileKey);
  const proto=Object.getPrototypeOf(f.figma.currentPage),clone=proto._cloneForInstance;
  if(boundHeight){
    // Model the live auto-layout coupling used by the correction. The broad
    // mock stores sizing modes and y independently, unlike native Figma.
    const vertical=Object.getOwnPropertyDescriptor(proto,'layoutSizingVertical')!;
    Object.defineProperty(proto,'layoutSizingVertical',{configurable:true,set:vertical.set,get(){
      return this._lsV==='FILL'?'FILL':this.layoutMode==='HORIZONTAL'&&this.counterAxisSizingMode==='FIXED'?'FIXED':vertical.get!.call(this);
    }});
    Object.defineProperty(proto,'y',{configurable:true,set(value){this._testY=value;},get(){
      const parent=this.parent;
      if(this.layoutPositioning!=='ABSOLUTE'&&parent?.layoutMode==='HORIZONTAL'&&parent.counterAxisAlignItems==='CENTER')return (parent.height-this.height)/2;
      return this._testY??0;
    }});
    Object.defineProperty(proto,'relativeTransform',{configurable:true,get(){return [[1,0,this.x],[0,1,this.y]];}});
    f.comparison.receipt=await f.run(emitNativeContractReadbackScript(f.comparison.parent));
  }
  proto._cloneForInstance=function(){const node=clone.call(this);if(this.type==='VECTOR')node.explicitVariableModes=structuredClone(this.explicitVariableModes??{});return node;};
  proto.clearExplicitVariableModeForCollection=function(collection:any){delete this.explicitVariableModes[collection.id];};
  const svg=f.figma.createNodeFromSvg.bind(f.figma);
  f.figma.createNodeFromSvg=(source:string)=>{const frame=svg(source),vector=new (frame.constructor as any)('VECTOR');vector.explicitVariableModes={};vector.resize(8,8);frame.appendChild(vector);return frame;};
  const child = f.contract('fixture.owned', {root: {layout: {display:'inline-flex',direction:'row'}, literals:{width:'32px',height:'32px'}, parts:{
    indicator:{icon:{asset:'check',size:16},tokens:{color:'{ink}'}},
  }}});
  if(boundHeight){delete child.anatomy.root.literals;child.anatomy.root.tokens={width:'{size}',height:'{size}'};}
  const context = await f.context('10000000-0000-4000-8000-000000000003');
  const data = f.engine.compileNativeContractDraft(child,new Map([[child.id,child]]),f.source);
  const creation = await f.run(f.engine.buildNativeContractDraftScript(child,new Map([[child.id,child]]),f.source,context));
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const parent: NativeContractObservationInput = {operation:context.operation,planRevision:revisionOf('owned'),
    projection:data.projection,component:data.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
  const receipt = await f.run(emitNativeContractReadbackScript(parent));
  assert.equal(verifyNativeContractReadback(parent,receipt).status,'supported-structure-observed');
  const content = f.contract('fixture.content',{root:{layout:{display:'flex',direction:'row'},parts:{
    owned:{layout:{display:'flex',direction:'row'},parts:{ignored:{text:'Do not duplicate internal content'}}},
  }}});
  if(wrapped) content.anatomy.root.parts={row:{layout:{display:'flex',direction:'row',align:'center'},parts:{owned:content.anatomy.root.parts!.owned,label:{text:'Receive updates',literals:{'line-height':'40px'},tokens:{color:'{ink}','font-size':'{size}'},declared:{'font-family':'Inter'}}}}};
  const selected: NativeContractComparisonInput = {...f.comparison,instances:[{specPath:wrapped?[0,0]:[0],parent,receipt,
    variantName:data.component.variants[0].name,slotSpecPath:[],contentMode:'source-owned'}]};
  const component = f.engine.compileComponentData(content,new Map([[content.id,content]]));
  const comparison = prepareNativeContractComparison(content,component,f.source,revisionOf(f.tokens),{mode:'light',brand:'default'},selected);
  const emit = (input = selected) => f.emit(content,input);
  return {...f,content,selected,comparison,emit,parent,receipt};
}
