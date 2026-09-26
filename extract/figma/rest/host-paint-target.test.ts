import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mapRestToDump,type RestNode} from './map.js';
import type {DumpSet,DumpHostOverride} from '../types.js';
const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8');
const readPlugin=vm.runInNewContext(source.slice(source.indexOf('async function dumpSolidFillTarget('),source.indexOf('async function dumpNode('))+';dumpSolidFillTarget') as (root:any,target:any)=>Promise<DumpHostOverride['solidFillTarget']>;
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
  (_v,r)=>{delete r.componentId;},v=>{v.fills=[];},
 ];
 for(const mutate of mutations){const r=fixture();mutate(r.children![0],r);const rows=readRest(r);assert.equal(rows[0].solidFillTarget,undefined);const p=pluginTree(r);assert.equal(await readPlugin(p,p.children[0]),undefined);}
 const r=fixture();r.children![0].fills!.push({type:'GRADIENT_LINEAR',visible:false});assert(readRest(r)[0].solidFillTarget,'an explicitly invisible extra paint does not alter the visible fill');
});
test('plugin refuses detached or foreign descendants and propagates unreadable main identity',async()=>{
 const p=pluginTree(fixture()),leaf=p.children[0];assert.equal(await readPlugin(p,pluginTree(vector('x'))),undefined);
 leaf.parent.children=[];assert.equal(await readPlugin(p,leaf),undefined);
 const q=pluginTree(fixture());q.getMainComponentAsync=async()=>{throw Error('unavailable');};await assert.rejects(()=>readPlugin(q,q.children[0]),/unavailable/);
});
