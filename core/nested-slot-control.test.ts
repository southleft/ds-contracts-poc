import vm from 'node:vm';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {settleNestedSlotSelections} from './nested-slot-control.js';
function fixture(){
 const make=(id:string,parts:object={},slot?:object)=>ContractSchema.parse({id:'ds.'+id,name:id[0].toUpperCase()+id.slice(1),version:'0.1.0',status:'draft',description:'Test',semantics:{element:'div'},props:[],states:[],anatomy:{root:{parts,...(slot?{slot}:{})}},bindings:{figma:{anchors:{fileKey:'file',nodeId:id+':set',componentSetKey:id+'-key'}},code:{anchors:{importPath:'./'+id,export:id[0].toUpperCase()+id.slice(1)}}}});
 const glyph=make('glyph'),selected=make('selected'),nested=make('nested',{well:{slot:{name:'children'}}});
 const owner=make('owner',{inner:{component:{id:nested.id},parts:{defaultIcon:{component:{id:glyph.id}}}}});
 const parent=make('parent',{action:{slot:{name:'action',renderDefault:true,defaultContent:[{id:owner.id}]}}});
 const proposals:any[]=[glyph,selected,nested,owner,parent].map(contract=>({setName:contract.id.slice(3),contract,notes:[]}));
 const nestedNode=()=>({type:'INSTANCE',nodeId:'source:inner',instanceSetKey:'nested-key',instanceKey:'nested-variant',instanceGeometry:{componentId:'nested:main'},componentProperties:{Size:'Medium'},fixedSwaps:{Icon:{id:'glyph:set',key:'glyph-key'}}});
 const witness=()=>({ownerId:'usage:1',ownerComponentId:'owner:main',ownerComponentKey:'owner-variant',nodeId:'Iusage:1;inner',componentId:'nested:main',componentKey:'nested-variant',componentSetKey:'nested-key',path:[0],properties:{Size:{type:'VARIANT',value:'Medium'},'Icon#1:2':{type:'INSTANCE_SWAP',value:'selected:set',selected:{nodeId:'selected:set',componentKey:'selected-key'}}}});
 const use:any={type:'INSTANCE',nodeId:'usage:1',instanceSetKey:'owner-key',instanceKey:'owner-variant',instanceGeometry:{componentId:'owner:main'},hostOverrides:[{path:'Duplicate',fields:['componentProperties'],instanceProperties:witness()}]};
 const dump:any={owner:{variants:[{nodeId:'owner:main',componentKey:'owner-variant',children:[nestedNode()]},{nodeId:'owner:other',componentKey:'owner-other',children:[nestedNode()]}]},parent:{variants:[{children:[use]}]}};
 const run=(protectedIds=new Set<string>())=>settleNestedSlotSelections(dump,'file',proposals,protectedIds);
 return{proposals,dump,use,run,owner:proposals[3],parent:proposals[4]};
}
test('source-qualified nested routing promotes one generated slot and preserves its shared fallback',()=>{
 const f=fixture(),before=JSON.stringify(f.dump);f.run();
 const slots=walkAnatomy(f.owner.contract).filter(p=>p.part.slot);assert.equal(slots.length,1);
 assert.equal(slots[0].part.slot!.defaultContent![0].id,'ds.glyph');
 assert.equal(Object.values(slots[0].part.parts!)[0].component!.id,'ds.glyph');
 const selected=walkAnatomy(f.parent.contract).find(p=>p.part.component?.id==='ds.selected');assert(selected);
 assert.equal(JSON.stringify(f.dump),before);
});
test('ambiguous or incomplete source authority leaves both generated contracts unchanged',()=>{
 for(const mode of ['path','owner','nested','occurrence','variant','default','props','selection','missing','duplicate','protected','stamped','occupied']){
  const f=fixture(),w=f.use.hostOverrides[0].instanceProperties;
  if(mode==='path')w.path=[1];if(mode==='owner')w.ownerComponentKey='wrong';if(mode==='nested')w.componentKey='wrong';
  if(mode==='occurrence')w.nodeId='foreign:1';if(mode==='variant')f.dump.owner.variants[1].children=[];
  if(mode==='default')f.dump.owner.variants[1].children[0].fixedSwaps.Icon.key='wrong';
  if(mode==='props')w.properties.Size.value='Large';if(mode==='selection')w.properties['Icon#1:2'].selected.nodeId='wrong';
  if(mode==='missing')f.dump.parent.variants.push({children:[{...f.use,nodeId:'usage:2',hostOverrides:[]}]});
  if(mode==='duplicate')f.dump.owner.variants[0].children.push(structuredClone(f.dump.owner.variants[0].children[0]));
  if(mode==='stamped')f.dump.owner.contractId='ds.owner';if(mode==='occupied')f.parent.contract.anatomy.root.parts.action.parts={existing:{text:'Keep'}};
  const before=JSON.stringify(f.proposals.map(p=>p.contract));f.run(mode==='protected'?new Set(['ds.owner']):undefined);
  assert.equal(JSON.stringify(f.proposals.map(p=>p.contract)),before,mode);assert(f.parent.notes.some((n:string)=>n.includes('not-carried')),mode);
 }
});

test('two callers reuse a promoted route without changing the shared default',()=>{
 const f=fixture(),second=structuredClone(f.parent);second.setName='other';second.contract.id='ds.other';second.contract.name='Other';second.contract.bindings.figma.anchors.componentSetKey='other-key';second.contract.bindings.code.anchors.export='Other';
 f.proposals.push(second);f.dump.other=structuredClone(f.dump.parent);f.run();
 assert(walkAnatomy(second.contract).some(p=>p.part.component?.id==='ds.selected'));
 assert.equal(walkAnatomy(f.owner.contract).filter(p=>p.part.slot).length,1);
});

test('native generation carries selected nested content and preserves the shared default main',async()=>{
 const f=fixture();f.proposals[0].contract.anatomy.root.text='Default glyph';f.proposals[1].contract.anatomy.root.text='Selected glyph';f.run();
 const scope=new Map(f.proposals.map(p=>[p.contract.id,ContractSchema.parse(p.contract)]));
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context);
 for(const p of f.proposals)await run(engine.buildComponentScript(ContractSchema.parse(p.contract),scope));
 const owner=host.root.findOne(n=>['COMPONENT','COMPONENT_SET'].includes(n.type)&&n.getSharedPluginData('ds_contracts','contractId')==='ds.owner')!;
 const parent=host.root.findOne(n=>['COMPONENT','COMPONENT_SET'].includes(n.type)&&n.getSharedPluginData('ds_contracts','contractId')==='ds.parent')!;
 assert.deepEqual(owner.findAll(n=>n.type==='TEXT').map(n=>n.characters),['Default glyph']);
 assert.deepEqual(parent.findAll(n=>n.type==='TEXT').map(n=>n.characters),['Selected glyph']);
});
