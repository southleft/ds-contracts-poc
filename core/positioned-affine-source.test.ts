import test from 'node:test';import assert from 'node:assert/strict';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact,validateContract} from './emit-react.js';
import {tokenInventoryFromJson} from './tokens.js';
import {emitReactInline} from './emit-react-inline.js';
const primitives={drawing:{size:{$type:'dimension',$value:'48px'},ink:{$type:'color',$value:'#123456'}}};
function fixture(){
 const child=ContractSchema.parse({id:'test.local-drawing',name:'LocalDrawing',version:'1.0.0',description:'Captured drawing',semantics:{element:'span'},props:[],states:[],bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'drawing-key',nodeId:'main'}},code:{anchors:{importPath:'./LocalDrawing',export:'LocalDrawing'}}},anatomy:{root:{tokens:{width:'{drawing.size}',height:'{drawing.size}',color:'{drawing.ink}'},declared:{position:'relative','overflow-x':'hidden','overflow-y':'hidden'},instanceRootInputs:['width','height'],overridable:['size','color'],parts:{ink:{shape:{kind:'path',width:36,height:30,parentViewport:{width:48,height:48,x:6,y:9},paths:[{data:'M0 0L36 0L0 30Z',windingRule:'NONZERO'}]},literals:{'background-color':'currentColor'},declared:{position:'absolute'}}}}}});
 const transform:[[number,number,number],[number,number,number]]=[[1,0,4],[0,-1,20]];
 const node:any={name:'Choice',type:'INSTANCE',nodeId:'usage',instanceOf:'LocalDrawing',instanceKey:'drawing-key',bbox:{width:16,height:16},abs:{x:4,y:4,right:4,bottom:4,width:16,height:16,constraints:{horizontal:'CENTER',vertical:'CENTER'}},instanceGeometry:{nodeId:'usage',componentId:'main',transform,localSize:{width:16,height:16}},instanceRootOverrides:{nodeId:'usage',componentId:'main',componentKey:'drawing-key',fields:['width','height'],mainSize:{width:48,height:48},localTransform:transform,localSize:{width:16,height:16}}};
 const dump:any={setName:'Host',type:'COMPONENT',nodeId:'host',key:'host-key',variants:[{name:'Host',type:'COMPONENT',nodeId:'host',bbox:{width:24,height:24},children:[node]}]};
 const options={corpus:tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}}),mintUnbound:true,fileKey:'fixture',contractIdByName:new Map([['LocalDrawing',child.id]]),contractIdByKey:new Map([['drawing-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]])};
 const read=()=>{const result=proposeFromDump(dump,options);return{result,parent:ContractSchema.parse(result.contract)};};
 return{dump,node,child,read};
}
test('positioned rigid child uses separate fixed outer allocation and inner source transform',()=>{
 const f=fixture(),before=JSON.stringify(f.dump),{parent,result}=f.read();
 const reference=walkAnatomy(parent).find(w=>w.part.component?.id===f.child.id)!,outer=parent.anatomy.root.parts!.Choice;
 assert.deepEqual(reference.part.instanceAffine,{localSize:{width:16,height:16},transform:[[1,0,0],[0,-1,16]]});
 assert.equal(reference.part.absoluteGeometry,undefined);assert.equal(reference.part.tokens,undefined);
 assert.equal(outer.declared?.position,'absolute');assert.deepEqual(outer.layout,{display:'flex',direction:'row'});
 const contracts=new Map([[parent.id,parent],[f.child.id,f.child]]),errors:string[]=[];
 validateContract(parent,contracts,errors,new Map());assert.deepEqual(errors,[]);
 const tokens={primitives:{...primitives,...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 assert.doesNotThrow(()=>emitReactInline(parent,{contracts,icons:new Map(),tokens}));
 const inventory=tokenInventoryFromJson([tokens.primitives]);
 assert.doesNotThrow(()=>emitReact(parent,{contracts,icons:new Map(),tokens:inventory,tokenValues:tokens}));
 assert.equal(JSON.stringify(f.dump),before);
});
test('positioned affine carrier refuses missing root authority, drift and FILL',()=>{
 for(const mutate of [
 (x:any)=>{x.node.abs.x=5;},(x:any)=>{x.node.instanceRootOverrides.fields=['width'];},
 (x:any)=>{x.node.instanceRootOverrides.localSize.height=15;},(x:any)=>{x.node.fillHeight=true;},
 (x:any)=>{x.node.instanceRootOverrides.localTransform=[[1,0,4],[0,1,4]];},
 (x:any)=>{x.node.instanceGeometry.transform[0][0]=2;},
 ]){const f=fixture();mutate(f);const {parent}=f.read();assert(walkAnatomy(parent).every(w=>!w.part.instanceAffine&&!w.part.instanceAffineByProp&&!w.part.instanceAffineLayout));}
});
