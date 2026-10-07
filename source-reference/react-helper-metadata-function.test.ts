import test from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
import {reactHelperBindingGuard} from './react-helper-binding-runtime.js';
const source={file:'metadata.js',sha256:'a'.repeat(64),start:0,end:40};
const other={...source,start:41,end:80};
const model={intrinsics:[],definitions:[source,other],calls:[],runtimeBindings:{bindings:[],functions:[0,1],nodes:[{id:0,kind:'function',source,fields:[]},{id:1,kind:'function',source:other,fields:[]}]}};
for(const mode of ['original','unregistered','replacement','mutation','duplicate-source'] as const)test('metadata function identity '+mode,()=>{
 const result=runInNewContext(`(()=>{
 const guard=(${reactHelperBindingGuard})(${JSON.stringify([model])},()=>{},()=>false);
 const source=${JSON.stringify(source)},other=${JSON.stringify(other)},key=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 function parser(value){switch(value){case 'between':return 'space-between';default:return value;}}
 function replacement(value){return value==='between'?'space-between':value;}
 if('${mode}'!=='unregistered')guard.sourceFunction(key(source),parser);
 if('${mode}'==='replacement')guard.sourceFunction(key(other),replacement);
 if('${mode}'==='duplicate-source')guard.sourceFunction(key(source),replacement);
 if('${mode}'==='mutation')parser.changed=true;
 try{guard.metadataFunction('${mode}'==='replacement'?replacement:parser,source);return {accepted:true};}catch(e){return {accepted:false,reason:e.message};}
 })()`);
 assert.equal(result.accepted,mode==='original',JSON.stringify(result));if(mode!=='original')assert.match(result.reason,/^helper-binding-/);
});
