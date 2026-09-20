import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript, type NativeContractObservationInput} from './native-source-observation.js';
import {type NativeContractUpdateInput} from './native-contract-update.js';

export async function boundCrossSizeFixture(channel:'width'|'height',absolute:boolean) {
  const f=await nativeComparisonFixture(), horizontal=channel==='height';
  const contract=f.contract('fixture.bound-cross-size',{root:{
    layout:{display:'flex',direction:horizontal?'row':'column',align:'center'},
    declared:{position:'relative'}, tokens:{[channel]:'{size}'},literals:{[horizontal?'width':'height']:'32px'},
    parts:{flow:{shape:{kind:'rect',width:6,height:6},tokens:{'background-color':'{surface}'}},
      absolute:{shape:{kind:'rect',width:20,height:20},declared:{position:'absolute'},literals:{left:'-3px',top:'-3px','background-color':'transparent'}}},
  }});
  contract.props=[{name:'tone',type:{enum:['a','b']},default:'a',bindings:{code:{prop:'tone'},figma:{kind:'VARIANT',property:'Tone'}}}];
  const byId=new Map([[contract.id,contract]]),compiled=f.engine.compileNativeContractDraft(contract,byId,f.source);
  const context=await f.context('40000000-0000-4000-8000-000000000089');
  const creation=await f.run(f.engine.buildNativeContractDraftScript(contract,byId,f.source,context));
  assert.equal(creation.status,'created-candidate');
  const strictIds=creation.nodes.filter((n:any)=>['COMPONENT','FRAME','RECTANGLE','ELLIPSE'].includes(n.type)).map((n:any)=>n.id);
  // Explicit synthetic API facts. This fixture does not simulate native layout
  // propagation; the separate measured matrix is the evidence for prediction.
  for(const id of strictIds){const node=await f.figma.getNodeByIdAsync(id);
    Object.assign(node,{targetAspectRatio:null,constraints:{horizontal:'MIN',vertical:'MIN'},layoutAlign:'INHERIT',layoutGrow:0,
      strokesIncludedInLayout:false,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',
      minWidth:null,maxWidth:null,minHeight:null,maxHeight:null});
    Object.defineProperty(node,'relativeTransform',{get(){return [[1,0,this.x],[0,1,this.y]];}});
  }
  for(const variant of creation.variants){const root=await f.figma.getNodeByIdAsync(variant.id);
    Object.assign(root,{primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED',layoutWrap:'NO_WRAP',
      strokeTopWeight:0,strokeRightWeight:0,strokeBottomWeight:0,strokeLeftWeight:0,
      resolvedVariableModes:{[context.tokens.identity.collection.id]:context.tokens.identity.modes[0].modeId}});
    const flow=root.children[0];flow[horizontal?'y':'x']=4;
  }
  const before:NativeContractObservationInput={operation:context.operation,planRevision:revisionOf(contract),
    component:compiled.component,projection:compiled.projection,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,
    creation,fixedCrossSizeReadback:{version:1,nodeIds:strictIds}};
  const baseline=await f.run(emitNativeContractReadbackScript(before));
  const tokens=structuredClone(f.tokens);tokens.size.$value='20px';
  const nextContract=structuredClone(contract);
  if(absolute)nextContract.anatomy.root.parts!.absolute.shape![channel]=26;
  const next=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(f.assets)})
    .compileNativeContractDraft(nextContract,new Map([[nextContract.id,nextContract]]),f.source);
  const input:NativeContractUpdateInput={before,baseline,desired:{component:next.component,revision:revisionOf(next),
    tokenInput:{...structuredClone(before.tokenInput),modes:[{...before.tokenInput.modes[0],tokens,tokenTreeRevision:revisionOf(tokens)}]}}};
  return {...f,input};
}

