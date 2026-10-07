import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {packNativeReadback,unpackNativeReadback} from './native-readback-transport.js';
test('native transport preserves every JSON field, Unicode and repeated subtree without shared host mutations',()=>{
 const shared={text:'A\n" é 漢字 🟣',values:[null,true,false,0,1.25],empty:[]};
 const value={a:shared,b:structuredClone(shared),special:JSON.parse('{"__proto__":{"x":1},"constructor":null}')};
 const packed=packNativeReadback(value),decoded:any=unpackNativeReadback(packed);
 assert.deepEqual(decoded,value);decoded.a.values.push(2);assert.deepEqual(decoded.b,shared);
 // Execute the exact serialized function used inside the Figma VM.
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext(`(${packNativeReadback.toString()})(JSON.parse(${JSON.stringify(JSON.stringify(value))}))`))),packed);
});
test('native transport rejects malformed, forward, duplicate-key and expansion-bomb dictionaries',()=>{
 const envelope=(entries:unknown[],root=entries.length-1)=>({transport:'native-readback-interned-json-v1',data:JSON.stringify({entries,root})});
 for(const input of [null,{},envelope([[0,'x']],2),envelope([[1,[0]]]),envelope([[0,{}]]),envelope([[0,'x'],[2,[[0,0],[0,0]]]]),envelope([[0,'x'],[1,[-1]]])])
  assert.throws(()=>unpackNativeReadback(input),/transport-invalid/);
 const entries:any[]=[[0,'x']];for(let i=0;i<26;i++)entries.push([1,[i,i]]);
 assert.throws(()=>unpackNativeReadback(envelope(entries)),/transport-invalid/);
});
test('large repeated native inventories round-trip without dropping or truncating nodes',()=>{
 const value={nodes:Array.from({length:4000},(_,i)=>({id:String(i),values:{x:0,y:0,fills:[],layoutMode:'HORIZONTAL'},metadata:{owner:'a'.repeat(400)}}))};
 const packed=packNativeReadback(value);assert.deepEqual(unpackNativeReadback(packed),value);
 assert(JSON.stringify(packed).length<JSON.stringify(value).length/2);
});
