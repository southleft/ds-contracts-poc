import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {nativeLiteralTextBox,NATIVE_LITERAL_TEXT_BOX_RUNTIME} from './native-text-box.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
test('literal native text size retains fixed width with hug or fixed height',()=>{
 for(const height of [undefined,80]){
  const spec:any={type:'text',lits:{width:232,...(height===undefined?{}:{height})}},node:any={height:20,resize(w:number,h:number){this.width=w;this.height=h;}};
  assert.deepEqual(nativeLiteralTextBox(spec),height===undefined?{width:232}:{width:232,height});
  spec.literalTextBox=nativeLiteralTextBox(spec);
  vm.runInNewContext(NATIVE_LITERAL_TEXT_BOX_RUNTIME,{spec,node});assert.equal(node.width,232);assert.equal(node.textAutoResize,height===undefined?'HEIGHT':'NONE');assert.equal(node.height,height??20);
 }
 assert.equal(nativeLiteralTextBox({type:'text',name:'Hug'}),undefined);
 assert.equal(nativeLiteralTextBox({type:'frame',name:'Frame',lits:{width:232}}),undefined);
 assert.throws(()=>nativeLiteralTextBox({type:'text',name:'Invalid',lits:{width:232},textAutoResize:'WIDTH_AND_HEIGHT'}),/unqualified/);
});
test('production native script applies literal width to the text node without an extra wrapper',async()=>{
 const c=ContractSchema.parse({id:'test.literal-text-box',name:'LiteralTextBox',version:'0.1.0',status:'draft',description:'Width box',semantics:{element:'div'},props:[],states:[],anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{text:{text:'Long text',literals:{width:'232px','font-size':'14px'}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./LiteralTextBox',export:'LiteralTextBox'}}}});
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),byId=new Map([[c.id,c]]),{figma}=createFigmaMock();
 await vm.runInNewContext('(async()=>{'+engine.buildComponentScript(c,byId)+'})()',{figma,console:{log(){},warn(){},error(){}}});
 const text=figma.root.findOne((n:any)=>n.type==='TEXT');assert(text);assert(text.parent);assert.equal(text.width,232);assert.equal(text.textAutoResize,'HEIGHT');assert.equal(text.parent.type,'COMPONENT');
});
