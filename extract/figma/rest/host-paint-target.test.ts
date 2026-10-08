import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mapRestToDump,type RestNode} from './map.js';
import type {DumpSet,DumpHostOverride} from '../types.js';
const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8');
const readPlugin=vm.runInNewContext(source.slice(source.indexOf('async function dumpSolidFillTarget('),source.indexOf('async function dumpNode('))+';dumpSolidFillTarget') as (root:any,target:any,plane?:'stroke'|'text-fill'|'text-characters'|'shape-fill')=>Promise<DumpHostOverride['solidFillTarget']>;
const vector=(id:string):RestNode=>({id,name:'Same name',type:'VECTOR',fills:[{type:'SOLID',color:{r:.5,g:.25,b:0,a:1}}]});
const fixture=():RestNode=>({id:'1:1',name:'Host',type:'INSTANCE',componentId:'main:host',children:[
 vector('2:1'),{id:'2:2',name:'Same name',type:'INSTANCE',componentId:'main:selected',children:[{id:'3:1',name:'Same name',type:'FRAME',children:[vector('4:1')]}]},
],overrides:[{id:'2:1',overriddenFields:['fills']},{id:'4:1',overriddenFields:['fills']}]});
function readRest(node:RestNode){const r=mapRestToDump({name:'Fixture',nodes:{root:{document:{id:'0:1',name:'Source',type:'COMPONENT',children:[node]}}}} as never);return (r.dump.Source as DumpSet).variants[0].children![0].hostOverrides!;}
function pluginTree(node:RestNode,parent?:any):any {const out:any={...node,parent,getMainComponentAsync:async()=>node.componentId?{id:node.componentId}:null};out.children=(node.children??[]).map(n=>pluginTree(n,out));return out;}
const plain=(v:any)=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
test('host paints use exact nearest-main identity and numeric paths across duplicate names',async()=>{
 const input=fixture(),before=JSON.stringify(input),rows=readRest(input),plugin=pluginTree(input);
 assert.deepEqual(rows.map(r=>r.solidFillTarget),[
  {nodeId:'2:1',instanceId:'1:1',componentId:'main:host',instancePath:[],childPath:[0]},
  {nodeId:'4:1',instanceId:'2:2',componentId:'main:selected',instancePath:[1],childPath:[0,0]},
 ]);
 assert.deepEqual(plain(await readPlugin(plugin,plugin.children[0])),rows[0].solidFillTarget);
 assert.deepEqual(plain(await readPlugin(plugin,plugin.children[1].children[0].children[0])),rows[1].solidFillTarget);
 assert.equal(JSON.stringify(input),before);
});
test('ambiguous paint or missing main retains the named override without a qualified target',async()=>{
 const mutations:Array<(v:RestNode,r:RestNode)=>void>=[
  v=>{v.fills!.push({...v.fills![0]});},v=>{v.fills![0].type='GRADIENT_LINEAR';},
  v=>{v.fills![0].blendMode='MULTIPLY';},v=>{v.type='RECTANGLE';},
  (_v,r)=>{delete r.componentId;},
 ];
 for(const mutate of mutations){const r=fixture();mutate(r.children![0],r);const rows=readRest(r);assert.equal(rows[0].solidFillTarget,undefined);const p=pluginTree(r);assert.equal(await readPlugin(p,p.children[0]),undefined);}
 const r=fixture();r.children![0].fills!.push({type:'GRADIENT_LINEAR',visible:false});assert(readRest(r)[0].solidFillTarget,'an explicitly invisible extra paint does not alter the visible fill');
});
test('plugin refuses detached or foreign descendants and propagates unreadable main identity',async()=>{
 const p=pluginTree(fixture()),leaf=p.children[0];assert.equal(await readPlugin(p,pluginTree(vector('x'))),undefined);
 leaf.parent.children=[];assert.equal(await readPlugin(p,leaf),undefined);
 const q=pluginTree(fixture());q.getMainComponentAsync=async()=>{throw Error('unavailable');};await assert.rejects(()=>readPlugin(q,q.children[0]),/unavailable/);
});


test('stroke overrides carry independent uniform weight and exact paint-owner identity on both readers',async()=>{
 const r=fixture();
 for(const [i,n] of [r.children![0],r.children![1].children![0].children![0]].entries()) {
  n.fills=[];n.strokes=[{type:'SOLID',blendMode:'NORMAL',color:{r:.5,g:.25,b:0,a:1}}];n.strokeWeight=i+1;
  r.overrides![i].overriddenFields=['strokes','strokeWeight'];
 }
 const rows=readRest(r),p=pluginTree(r);
 assert.deepEqual(rows.map(h=>h.strokeWeight),[1,2]);
 assert.deepEqual(rows.map(h=>h.stroke?.hex),['804000','804000']);
 assert.deepEqual(plain(await readPlugin(p,p.children[0],'stroke')),rows[0].solidStrokeTarget);
 assert.deepEqual(plain(await readPlugin(p,p.children[1].children[0].children[0],'stroke')),rows[1].solidStrokeTarget);
 const changed=structuredClone(r);changed.children![0].strokes!.push({...changed.children![0].strokes![0]});
 assert.equal(readRest(changed)[0].solidStrokeTarget,undefined);
 assert.equal(await readPlugin(pluginTree(changed),pluginTree(changed).children[0],'stroke'),undefined);
});

 test('uniform text ink gets its own identity target across duplicate names and nearest owners',async()=>{
 const r=fixture();for(const n of [r.children![0],r.children![1].children![0].children![0]]){n.type='TEXT';n.characters='Label';}
 const mapped:any=mapRestToDump({name:'Fixture',nodes:{root:{document:{id:'0:1',name:'Source',type:'COMPONENT',children:[r]}}}} as never).dump.Source;
 assert.equal(mapped.variants[0].nodeId,'0:1');assert.equal(mapped.variants[0].children[0].nodeId,'1:1');
 const rows=readRest(r),p=pluginTree(r);
 assert(rows.every(h=>h.textFillTarget&&!h.solidFillTarget));
 assert.deepEqual(plain(await readPlugin(p,p.children[0],'text-fill')),rows[0].textFillTarget);
 assert.deepEqual(plain(await readPlugin(p,p.children[1].children[0].children[0],'text-fill')),rows[1].textFillTarget);
 assert.deepEqual(rows.map(h=>h.textFillTarget?.childPath),[[0],[0,0]]);
 assert.deepEqual(rows.map(h=>h.textFillTarget?.componentId),['main:host','main:selected']);
 for(const paint of [{type:'GRADIENT_LINEAR'},{type:'SOLID',blendMode:'MULTIPLY'}]){const bad=structuredClone(r);bad.children![0].fills=[paint];assert.equal(readRest(bad)[0].textFillTarget,undefined);const q=pluginTree(bad);assert.equal(await readPlugin(q,q.children[0],'text-fill'),undefined);}
 const mixed=structuredClone(r);mixed.children![0].styleOverrideTable={'1':{fills:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}]}} as any;assert.equal(readRest(mixed)[0].textFillTarget,undefined);
});


test('character overrides retain exact owners independently of text paint, including hidden and empty text',async()=>{
 const r=fixture();
 const leaves=[r.children![0],r.children![1].children![0].children![0]];
 leaves.forEach((n,i)=>{n.type='TEXT';n.characters=i?'':'optional';n.visible=false;n.fills=[{type:'GRADIENT_LINEAR'}];r.overrides![i].overriddenFields=['characters'];});
 const read=(node:RestNode)=>(mapRestToDump({name:'Fixture',nodes:{root:{document:{id:'0:1',name:'Source',type:'COMPONENT',children:[node]}}}} as never).dump.Source as DumpSet).variants[0].children![0];
 const out=read(r),p=pluginTree(r);
 assert.deepEqual(out.textOverrides,{'Same name':'optional','Same name/Same name/Same name':''});
 assert.deepEqual(Object.values(out.textOverrideTargets!),[
  {nodeId:'2:1',instanceId:'1:1',componentId:'main:host',instancePath:[],childPath:[0]},
  {nodeId:'4:1',instanceId:'2:2',componentId:'main:selected',instancePath:[1],childPath:[0,0]},
 ]);
 assert.deepEqual(plain(await readPlugin(p,p.children[0],'text-characters')),out.textOverrideTargets!['Same name']);
 assert.deepEqual(plain(await readPlugin(p,p.children[1].children[0].children[0],'text-characters')),out.textOverrideTargets!['Same name/Same name/Same name']);
 const missing=structuredClone(r);delete missing.componentId;assert.equal(read(missing).textOverrideTargets?.['Same name'],undefined);assert.equal(read(missing).textOverrides?.['Same name'],'optional');
 const duplicate=structuredClone(r);duplicate.children!.push({...duplicate.children![0],id:'duplicate',characters:'other'});duplicate.overrides!.push({id:'duplicate',overriddenFields:['characters']});
 assert.equal(read(duplicate).textOverrides?.['Same name'],undefined);assert.equal(read(duplicate).textOverrideTargets?.['Same name'],undefined);
 // Execute the production plugin capture block, not only its identity helper.
 const begin=source.indexOf("      if (overriddenCount > 0 && typeof node.findAll === 'function')");
 const end=source.indexOf('    } catch (e)',begin);
 const capture=vm.runInNewContext('(async function(node,overridden,dumpSolidFillTarget){const out={},nodePath="fixture",overriddenCount=Object.keys(overridden).length;const degrade=()=>{};'+source.slice(begin,end)+';return out;})');
 for(const input of [r,duplicate,missing]){
  const root=pluginTree(input);root.findAll=(pred:any)=>{const all:any[]=[];const walk=(n:any)=>{for(const c of n.children){if(pred(c))all.push(c);walk(c);}};walk(root);return all;};
  const actual=plain(await capture(root,Object.fromEntries(input.overrides!.map(o=>[o.id,true])),readPlugin));
  const expected=read(input);assert.deepEqual(actual.textOverrides,expected.textOverrides);assert.deepEqual(actual.textOverrideTargets,expected.textOverrideTargets);
 }
});


test('empty stroke proof requires an explicit empty array and qualified fill owner',()=>{
 const r=fixture(), leaf=r.children![0];
 assert.equal(readRest(r)[0].emptyStrokeTarget,undefined);
 leaf.strokes=[];
 assert.deepEqual(readRest(r)[0].emptyStrokeTarget,readRest(r)[0].solidFillTarget);
 leaf.strokes=[{type:'SOLID',visible:false,color:{r:0,g:0,b:0,a:1}}];
 assert.equal(readRest(r)[0].emptyStrokeTarget,undefined);
 leaf.strokes=[];delete r.componentId;
 assert.equal(readRest(r)[0].emptyStrokeTarget,undefined);
});


test('production plugin host capture matches REST empty-stroke evidence',async()=>{
 const begin=source.indexOf("      if (hostCount > 0 && typeof node.findAll === 'function')");
 const end=source.indexOf("      if (overriddenCount > 0",begin);
 const capture=vm.runInNewContext('(async function(node,hostFieldsById,dumpSolidFillTarget){const out={},nodePath="fixture",hostCount=Object.keys(hostFieldsById).length;const degrade=()=>{},capturedVariableConsumers=new Map(),SolidFillCapture={observeSolidFillComposition:()=>undefined};const dumpPaint=async(p)=>p.length?{hex:"804000"}:undefined;'+source.slice(begin,end)+';return out.hostOverrides;})');
 for(const strokes of [undefined,[],[{type:'SOLID',color:{r:.5,g:.25,b:0,a:1}}]]){
  const input=fixture();if(strokes)input.children![0].strokes=strokes;
  const root=pluginTree(input);root.findAll=(pred:any)=>{const all:any[]=[];const walk=(n:any)=>{for(const c of n.children){if(pred(c))all.push(c);walk(c);}};walk(root);return all;};
  const rows=plain(await capture(root,Object.fromEntries(input.overrides!.map(o=>[o.id,o.overriddenFields])),readPlugin));
  assert.deepEqual(rows.map((h:DumpHostOverride)=>h.emptyStrokeTarget),readRest(input).map(h=>h.emptyStrokeTarget));
 }
});


test('NORMAL solid stroke stacks compose in order without claiming a layer alias',async()=>{
 const {composeNormalSolidStrokePaints:compose}=await import('../solid-fill-observation.js');
 const stack=[{type:'SOLID',blendMode:'NORMAL',color:{r:229/255,g:229/255,b:229/255,a:1}},
  {type:'SOLID',blendMode:'NORMAL',color:{r:0,g:0,b:0,a:1},opacity:.2}];
 assert.deepEqual(compose(stack),{hex:'b7b7b7'});
 assert.deepEqual(compose([...stack].reverse()),{hex:'e5e5e5'});
 assert.deepEqual(compose(stack.map(p=>({...p,opacity:0}))),{hex:'000000',alpha:0});
 for(const change of [(p:any)=>p.type='GRADIENT_LINEAR',(p:any)=>p.blendMode='MULTIPLY',(p:any)=>p.opacity=NaN,(p:any)=>delete p.color]){
  const bad=structuredClone(stack);change(bad[1]);assert.equal(compose(bad),undefined);
 }
 const r=fixture();r.children![0].strokes=stack;r.overrides![0].overriddenFields=['strokes'];
 assert.deepEqual(readRest(r)[0].stroke,{hex:'b7b7b7'});
 assert.equal(readRest(r)[0].solidStrokeTarget,undefined,'composition does not invent the single-paint vector authority');
 const shared=source.slice(source.indexOf('// BEGIN SHARED SOLID FILL OBSERVATION'),source.indexOf('// END SHARED SOLID FILL OBSERVATION'));
 const start=source.indexOf('const dumpPaint = async '),end=source.indexOf('// BEGIN SHARED SOLID FILL OBSERVATION',start);
 const capture=vm.runInNewContext(shared+';const degrade=()=>{};'+source.slice(start,end)+';dumpPaint');
 assert.deepEqual(plain(await capture(stack,'fixture','stroke',{})),{hex:'b7b7b7'});
});


test('shape paint captures independent nearest-owner identity and precise paint without authorizing vector ink',async()=>{
 for(const type of ['FRAME','RECTANGLE','ELLIPSE']){
  const input=fixture();input.children![0].type=type;input.children![0].fills![0].opacity=Math.fround(.1);
  const rows=readRest(input),p=pluginTree(input);
  assert.equal(rows[0].solidFillTarget,undefined);assert.equal(rows[0].textFillTarget,undefined);
  assert.deepEqual(rows[0].shapeFillTarget,{nodeId:'2:1',instanceId:'1:1',componentId:'main:host',instancePath:[],childPath:[0]});
  assert.deepEqual(plain(await readPlugin(p,p.children[0],'shape-fill')),rows[0].shapeFillTarget);
  assert.deepEqual(rows[0].sourceNormalFillComposition,{paint:{color:{r:.5,g:.25,b:0},opacity:Math.fround(.1),blendMode:'NORMAL'}});
 }
 for(const mutate of [(n:any)=>n.fills.push(n.fills[0]),(n:any)=>n.fills[0].type='GRADIENT_LINEAR',(n:any)=>n.fills[0].blendMode='MULTIPLY',(n:any)=>n.type='TEXT',(n:any)=>n.type='VECTOR']){
  const input=fixture();input.children![0].type='RECTANGLE';mutate(input.children![0]);const p=pluginTree(input);
  assert.equal(readRest(input)[0].shapeFillTarget,undefined);assert.equal(await readPlugin(p,p.children[0],'shape-fill'),undefined);
 }
 const nested=fixture();nested.children![1].children![0].children![0].type='RECTANGLE';const p=pluginTree(nested),row=readRest(nested)[1];
 assert.deepEqual(row.shapeFillTarget?.instancePath,[1]);assert.deepEqual(plain(await readPlugin(p,p.children[1].children[0].children[0],'shape-fill')),row.shapeFillTarget);
 const missing=fixture();missing.children![0].type='RECTANGLE';delete missing.componentId;assert.equal(readRest(missing)[0].shapeFillTarget,undefined);
});


test('production plugin override block retains shape paint precision and matches REST identity',async()=>{
 const {observeSolidFillComposition}=await import('../solid-fill-observation.js');
 const begin=source.indexOf("      if (hostCount > 0"),end=source.indexOf("      if (overriddenCount > 0",begin);
 assert(begin>=0&&end>begin);
 const capture=vm.runInNewContext('(async function(node,hostFieldsById,dumpSolidFillTarget,SolidFillCapture){const out={},nodePath="fixture",hostCount=Object.keys(hostFieldsById).length;const degrade=()=>{},capturedVariableConsumers=new Map();const dumpPaint=async(p)=>p.length?{hex:"804000",alpha:p[0].opacity}:undefined;'+source.slice(begin,end)+';return out.hostOverrides;})');
 for(const type of ['FRAME','RECTANGLE','ELLIPSE']){
  const input=fixture();input.children![0].type=type;input.children![0].fills![0].opacity=Math.fround(.1);
  const root=pluginTree(input);root.findAll=(pred:any)=>{const all:any[]=[];const walk=(n:any)=>{for(const c of n.children){if(pred(c))all.push(c);walk(c);}};walk(root);return all;};
  const rows=plain(await capture(root,Object.fromEntries(input.overrides!.map(o=>[o.id,o.overriddenFields])),readPlugin,{observeSolidFillComposition}));
  const expected=readRest(input)[0];assert.deepEqual(rows[0].shapeFillTarget,expected.shapeFillTarget);assert.deepEqual(rows[0].sourceNormalFillComposition,expected.sourceNormalFillComposition);assert.deepEqual(rows[0].fill,expected.fill);
 }
});


test('explicit REST visibility overrides retain omitted true defaults; missing override authority stays absent',async()=>{
 const input=fixture();input.children![0].type='RECTANGLE';input.overrides![0].overriddenFields=['visible'];
 const row=readRest(input)[0];assert.deepEqual(row.visibilityTarget,{nodeId:'2:1',instanceId:'1:1',componentId:'main:host',instancePath:[],childPath:[0],visible:true});
 const p=pluginTree(input);p.children[0].visible=true;assert.deepEqual(plain(await (readPlugin as any)(p,p.children[0],'visibility')),((({visible,...target})=>target)(row.visibilityTarget!)));
 input.children![0].visible=false;assert.equal(readRest(input)[0].visibilityTarget?.visible,false);
 input.overrides![0].overriddenFields=['fills'];assert.equal(readRest(input)[0].visibilityTarget,undefined);
 input.overrides![0].overriddenFields=['visible'];(input.children![0] as any).visible=null;assert.equal(readRest(input)[0].visibilityTarget,undefined);
});

test('text fill-style overrides preserve resolved paint with the same identity guards',()=>{
 const r=fixture();r.children![0].type='TEXT';r.children![0].characters='Label';
 r.overrides![0].overriddenFields=['inheritFillStyleId'];
 const row=readRest(r)[0];assert(row.fill);assert(row.textFillTarget);assert.equal(row.solidFillTarget,undefined);
 const mixed=structuredClone(r);mixed.children![0].styleOverrideTable={'1':{fills:[{type:'SOLID',color:{r:1,g:0,b:0,a:1}}]}} as any;
 assert.equal(readRest(mixed)[0].textFillTarget,undefined);
 const missing=structuredClone(r);missing.children![0].fills=[];assert.equal(readRest(missing)[0].textFillTarget,undefined);
 const other=fixture();other.overrides![0].overriddenFields=['inheritFillStyleId'];assert.equal(readRest(other)[0].solidFillTarget,undefined);
});

test('empty shape fill overrides preserve explicit emptiness in both production readers',async()=>{
 const begin=source.indexOf('      if (hostCount > 0'),end=source.indexOf('      if (overriddenCount > 0',begin);
 const capture=vm.runInNewContext('(async function(node,hostFieldsById,dumpSolidFillTarget){const out={},nodePath="fixture",hostCount=Object.keys(hostFieldsById).length;const degrade=()=>{},capturedVariableConsumers=new Map(),SolidFillCapture={observeSolidFillComposition:()=>undefined};const dumpPaint=async()=>undefined;'+source.slice(begin,end)+';return out.hostOverrides;})');
 for(const type of ['FRAME','RECTANGLE','ELLIPSE','VECTOR','TEXT'])for(const fills of [undefined,[],[{type:'SOLID',visible:false}]]){
  const input=fixture();input.children![0].type=type;input.children![0].fills=fills;
  const root=pluginTree(input);root.findAll=(pred:any)=>{const all:any[]=[];const walk=(n:any)=>{for(const c of n.children){if(pred(c))all.push(c);walk(c);}};walk(root);return all;};
  const actual=plain(await capture(root,Object.fromEntries(input.overrides!.map(o=>[o.id,o.overriddenFields])),readPlugin))[0],expected=readRest(input)[0];
  const empty=['FRAME','RECTANGLE','ELLIPSE','VECTOR'].includes(type)&&fills?.length===0;
  assert.equal(actual.sourceEmptyFill,empty?true:undefined);assert.equal(expected.sourceEmptyFill,actual.sourceEmptyFill);
  assert.deepEqual(actual.shapeFillTarget,expected.shapeFillTarget);assert.deepEqual(actual.solidFillTarget,expected.solidFillTarget);assert.equal(actual.fill,undefined);
 }
 const missing=fixture();missing.children![0].type='ELLIPSE';missing.children![0].fills=[];delete missing.componentId;
 assert.equal(readRest(missing)[0].sourceEmptyFill,undefined);
});
