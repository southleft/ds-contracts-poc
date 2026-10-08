import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createReactRuntimeImplementationProof} from './react-runtime-implementation.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
test('executable source stability follows aliases despite neighboring declaration files',t=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'runtime-stability-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const publicText="export const Good=props=>props;Good.displayName='Good';";
 for(const [consumer,expected] of [["import {Alias} from './barrel.mjs';export {Alias};",true],["import {Alias} from './barrel.mjs';Alias.render=()=>null;",false],["import * as All from './barrel.mjs';globalThis.saved=All;",false],["import {Alias} from './barrel.mjs';unknown(Alias);",false]] as const){
  const inputs={'public.mjs':publicText,'public.d.mts':'export declare const Good:any;','barrel.mjs':"export {Good as Alias} from './public.mjs';",'barrel.d.mts':'export declare const Alias:any;','consumer.mjs':consumer};const files:Record<string,string>={};
  for(const [name,text] of Object.entries(inputs)){const file=path.join(root,name);writeFileSync(file,text);files[file]=createHash('sha256').update(text).digest('hex');}
  const reference={sourceRoot:root,files,runtimeImports:[{importer:path.join(root,'barrel.mjs'),specifier:'./public.mjs',file:path.join(root,'public.mjs')},{importer:path.join(root,'consumer.mjs'),specifier:'./barrel.mjs',file:path.join(root,'barrel.mjs')}]};
  const result=readReactRuntimeExport(reference,'public.mjs',['Good']);assert.equal(result.status,'resolved');if(result.status!=='resolved')return;
  const component=result.definition;
  const proof=createReactRuntimeImplementationProof(reference);
  assert.equal(proof(component),expected);
  const consumerFile=path.join(root,'consumer.mjs');
  writeFileSync(consumerFile,consumer+'\nGood.render=()=>null;');
  assert.throws(()=>proof(component),/source-changed/);
  writeFileSync(consumerFile,consumer);
  assert.throws(()=>createReactRuntimeImplementationProof({...reference,runtimeImports:reference.runtimeImports.slice(1)}),/static-edge-unwitnessed/);
 }
});
