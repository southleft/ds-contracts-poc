import { fixture as nativeFixture } from './native-source-writer-test-fixture.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { FINGERPRINT_SRC } from './canvas-fingerprint.js';
import { SNAPSHOT_STORAGE_SRC } from './canvas-snapshot-storage.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

class Node {
  id: string; key: string; name: string; type: string; children: Node[]=[]; parent: Node|null=null;
  description=''; componentPropertyDefinitions={}; fills:unknown[]=[]; data=new Map<string,string>();
  characters=''; fontSize=14; fontName={family:'Test',style:'Regular'};
  constructor(type: string, id: string) {this.type=type;this.id=id;this.key=id;this.name=id;}
  getSharedPluginData(_ns:string,k:string) {return this.data.get(k)??'';}
  setSharedPluginData(ns:string,k:string,v:string) {assert.ok(Buffer.byteLength(ns+k+v)<100000);if(v==='')this.data.delete(k);else this.data.set(k,v);}
  findAll(predicate:(n:Node)=>boolean):Node[] {return this.children.flatMap(n=>[...(predicate(n)?[n]:[]),...n.findAll(predicate)]);}
  findAllWithCriteria({types}:{types:string[]}) {return this.findAll(n=>types.includes(n.type));}
  append(n:Node){n.parent=this;this.children.push(n);}
}
const contract=ContractSchema.parse({version:'0.1.0',status:'draft',id:'test.storage',name:'Storage',description:'Snapshot storage runtime fixture',props:[],states:[],semantics:{element:'div'},bindings:{code:{anchors:{importPath:'./Storage',export:'Storage'}},figma:{anchors:{fileKey:null,componentSetKey:null}}},anatomy:{root:{layout:{display:'flex'},literals:{width:'20px',height:'20px'}}}});
const emitter=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).buildComponentScript(contract,new Map([[contract.id,contract]]));
const stampSource=emitter.match(/function dsStampFingerprints\(node\) \{[\s\S]*?\n\}\n/)![0];
const api=vm.runInNewContext(`${FINGERPRINT_SRC}\n${SNAPSHOT_STORAGE_SRC}\n${stampSource}\ndsSetVarNames({});({stamp:dsStampFingerprints,snap:dsCanvasSnapshot,fp:dsCanvasFingerprint,read:dsReadCanvasSnapshot})`);
function fixture() {
  const page=new Node('PAGE','page'), set=new Node('COMPONENT_SET','set'), variant=new Node('COMPONENT','variant');
  page.append(set);set.append(variant);set.data.set('contractId','sample');
  for(let i=0;i<100;i++){const n=new Node('TEXT','text'+i);n.characters=`${i}:`+'😀source'.repeat(150);variant.append(n);}
  api.stamp(set);return {page,set,variant};
}
function corrupt(n:Node,key='canvasSnapshot') {const h=JSON.parse(n.data.get(key)!);assert.equal(h.storage,'ds-snapshot-chunks');n.data.delete(`${key}_chunks_${h.sha256}_0`);}
async function drift(page:Node) {
  const messages: any[]=[];
  const figma:any={fileKey:'test',root:{children:[page]},showUI(){},ui:{postMessage:(m:any)=>messages.push(m)},loadAllPagesAsync:async()=>{},variables:{getLocalVariablesAsync:async()=>[]}};
  vm.runInNewContext(readFileSync('figma-sync/plugin/code.js','utf8'),{figma,__html__:'',console,setTimeout,clearTimeout});
  await figma.ui.onmessage({type:'check-drift'});
  return messages.find(m=>m.type==='drift-result');
}
async function extract(page:Node) {
  const figma={fileKey:'test',root:{name:'test',children:[page]},loadAllPagesAsync:async()=>{},variables:{getLocalVariablesAsync:async()=>[],getLocalVariableCollectionsAsync:async()=>[]}};
  const run=vm.runInNewContext(`(async function(figma){${readFileSync('parity/extract-figma.plugin.js','utf8')}\n})`);
  return await run(figma);
}

test('real emitted stamper persists large variants and exact canonical v6 snapshot/hash',()=>{
  const {set,variant}=fixture();const h=JSON.parse(variant.data.get('canvasSnapshot')!);assert.equal(h.storage,'ds-snapshot-chunks');
  assert.equal(JSON.stringify(api.read(variant,'canvasSnapshot')),JSON.stringify(api.snap(variant)));
  assert.equal(variant.data.get('canvasFingerprint'),api.fp(variant));
  assert.equal(JSON.stringify(api.read(set,'canvasSetSnapshot')),JSON.stringify([]));
});

test('actual plugin drift reads chunked edit details and refuses corrupted chunks',async()=>{
  const {page,variant}=fixture();variant.children[0].characters='edited';
  let result=await drift(page);assert.equal(result.ok,true);assert.equal(result.rows[0].status,'canvas-edited');
  assert.ok(result.rows[0].editedVariants[0].changes.some((c:any)=>c.now.includes('edited')));
  corrupt(variant);result=await drift(page);assert.equal(result.ok,false);assert.match(result.error,/canvas-snapshot-storage: missing chunk/);
});

test('actual parity extractor reads complete snapshots and retains corrupt variant/set errors',async()=>{
  const {page,set,variant}=fixture();let result=await extract(page);
  assert.equal(result.sets[0].variants[0].measurementError,null);
  assert.equal(JSON.stringify(result.sets[0].variants[0].snapshot),JSON.stringify(api.snap(variant)));
  corrupt(variant);result=await extract(page);assert.match(result.sets[0].variants[0].measurementError,/missing chunk/);
  set.description='metadata'.repeat(15000);api.stamp(set);corrupt(set,'canvasSetSnapshot');
  result=await extract(page);assert.match(result.sets[0].setMeasurementError,/missing chunk/);
});



const snapshotStore = new Function(`${SNAPSHOT_STORAGE_SRC}; return {read: dsReadCanvasSnapshot};`)();

test("native creation stamps an over-limit variant snapshot instead of failing the operation", async () => {
  const f = await nativeFixture();
  const createComponent = f.figma.createComponent.bind(f.figma);
  // One very long variant description stands in for a composed variant's
  // thousands of snapshot lines; the snapshot is the only reader of it.
  f.figma.createComponent = () => {
    const component = createComponent();
    Object.defineProperty(component, "description", { configurable: true, get: () => "长".repeat(40000), set: () => {} });
    return component;
  };
  const script = f.emit();
  assert(script.includes("dsWriteCanvasSnapshot(child, 'canvasSnapshot', dsCanvasSnapshot(child));"));
  const result = await f.run(script);
  assert.equal(result.status, "created-candidate", JSON.stringify(result.problems));
  const set = f.figma.root.children.find((p: any) => p.id === result.pageId).children[0];
  const fp = new Function(`${FINGERPRINT_SRC}; return { names: dsSetVarNames, snapshot: dsCanvasSnapshot };`)();
  const names: Record<string, string> = {};
  for (const v of await f.figma.variables.getLocalVariablesAsync()) names[v.id] = v.name;
  fp.names(names);
  let pieced = 0;
  for (const variant of set.children) {
    const raw = variant.getSharedPluginData("ds_contracts", "canvasSnapshot");
    if (raw.startsWith("{")) pieced++;
    assert.deepEqual(snapshotStore.read(variant, "canvasSnapshot"), fp.snapshot(variant));
  }
  assert(pieced > 0, "at least one variant needed the pieced form");
});
