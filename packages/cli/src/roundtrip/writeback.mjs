import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync,renameSync,unlinkSync,openSync,closeSync,statSync} from 'node:fs';
import path from 'node:path';

import {parseTree,findNodeAtLocation} from 'jsonc-parser';
import {canonical,hash} from './surface.mjs';
import {resolveBundle,resolved,patchJSON} from './model.mjs';

const read=p=>readFileSync(p,'utf8');
const fail=(code,detail)=>{throw Error(code+': '+detail);};
const difference=(a,b,at='$')=>{if(canonical(a)===canonical(b))return null;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)])){const d=difference(a[key],b[key],at+'.'+key);if(d)return d;}}return at;};
const equal=(a,b,message)=>{const at=difference(a,b);if(at)fail(message,at);};
const valueAt=(text,keys)=>{const node=findNodeAtLocation(parseTree(text),keys);if(!node)fail('missing-source-value',keys.join('.'));return JSON.parse(text.slice(node.offset,node.offset+node.length));};
const valueOf=t=>t.alias?`{${t.alias}}`:t.value;
const allowed=(policy,file,keys)=>policy.tokens.some(t=>t.file===file&&canonical(t.path)===canonical(keys));
function localFile(policy,file){
 const root=realpathSync(policy.root),full=realpathSync(path.resolve(root,file));
 if(path.isAbsolute(file)||!full.startsWith(root+path.sep))fail('unowned-source',file);
 return full;
}
function checkGraph(bundle){
 assert.equal(bundle.contract,'system-aware/0.1','unsupported contract version');
 const graph=resolveBundle(bundle);if(graph.status!=='ready')fail('unresolved-contract',canonical(graph.gaps));
}
function checkGuards(policy,guards){
 for(const g of guards){if(!policy.guards.includes(g.file))fail('unowned-source',g.file);if(hash(read(localFile(policy,g.file)))!==g.sha256)fail('source-revision-conflict',g.file);}
}

/** Only variable-value/alias edits are supported. Every other native fact must survive. */
export function planWriteback(bundle,before,after,policy){
 checkGraph(bundle);assert.equal(policy.version,1,'unsupported ownership policy');
 assert.equal(bundle.system.id,policy.system,'ownership system mismatch');
 assert.equal(hash(bundle),policy.contractSha256,'untrusted contract baseline');
 assert.equal(hash(before),policy.nativeBaselineSha256,'untrusted native baseline');
 equal(Object.keys(before.tokens).sort(),Object.keys(bundle.system.tokens).sort(),'baseline token inventory mismatch');
 equal(Object.keys(after.tokens).sort(),Object.keys(before.tokens).sort(),'native token inventory changed');
 const next=structuredClone(bundle),expected=structuredClone(before);
 for(const [id,t]of Object.entries(bundle.system.tokens)){
  const a=after.tokens[id],b=before.tokens[id],{alias:ba,value:bv,...bm}=b,{alias:aa,value:av,...am}=a;
  equal(bm,am,'native token metadata changed: '+id);
  equal({alias:ba??null,value:bv??null},{alias:t.alias??null,value:t.value??null},'baseline token value mismatch: '+id);
  if((aa==null)===(av==null))fail('invalid-native-token',id);
  const n=next.system.tokens[id];delete n.alias;delete n.value;if(aa!=null)n.alias=aa;else n.value=av;
  expected.tokens[id]=structuredClone(a);
 }
 checkGraph(next);
 for(const v of expected.variants){
  for(const p of Object.values(v.parts))for(const [field,id]of Object.entries(p.tokens??{}))p.styles[field]=resolved(next,id);
  for(const d of Object.values(v.instances??{}))for(const vector of d.vectors){if('fill'in vector)vector.fill=resolved(next,d.colorToken);if('color'in vector)vector.color=resolved(next,d.colorToken);}
 }
 equal(expected,after,'unsupported-native-edit: only bound token values and aliases may change');
 const guards=[...policy.inputs,...Object.values(bundle.components).map(c=>({file:c.source.path,sha256:c.source.sha256}))];
 for(const t of Object.values(bundle.system.tokens))guards.push({file:t.source.file,sha256:t.source.sha256});
 const uniqueGuards=[...new Map(guards.map(g=>[g.file,g])).values()].sort((a,b)=>a.file.localeCompare(b.file));checkGuards(policy,uniqueGuards);
 const edits=[];
 for(const [id,t]of Object.entries(bundle.system.tokens)){
  if(valueOf(t)===valueOf(next.system.tokens[id]))continue;
  if(!allowed(policy,t.source.file,t.source.path))fail('unowned-token',id);
  const text=read(localFile(policy,t.source.file)),beforeValue=valueAt(text,t.source.path),normalized=typeof beforeValue==='string'&&beforeValue.startsWith('#')?beforeValue.toLowerCase():beforeValue;
  equal(normalized,valueOf(t),'source value differs from contract: '+id);
  edits.push({id,file:t.source.file,path:t.source.path,before:beforeValue,after:valueOf(next.system.tokens[id])});
 }
 const files=[...new Set(edits.map(e=>e.file))].sort().map(file=>{const beforeText=read(localFile(policy,file));let afterText=beforeText;for(const e of edits.filter(e=>e.file===file))afterText=patchJSON(afterText,e.path,e.before,e.after);return {file,beforeSha256:hash(beforeText),afterSha256:hash(afterText)};});
 const body={version:1,system:bundle.system.id,policySha256:hash(policy),contractSha256:hash(bundle),nativeBeforeSha256:hash(before),nativeAfterSha256:hash(after),guards:uniqueGuards,files,edits};
 return {...body,digest:hash(body)};
}

/** All checks and file preparation precede commits; only reviewed JSON values can be written. */
export function applyWriteback(plan,policy,expectedDigest){
 const {digest,...body}=plan;assert.equal(plan.version,1);assert.equal(plan.system,policy.system);
 assert.equal(plan.policySha256,hash(policy),'ownership policy changed');
 assert.equal(digest,hash(body),'plan digest mismatch');assert.equal(digest,expectedDigest,'reviewed plan digest required');
 checkGuards(policy,plan.guards);const prepared=[];
 for(const f of plan.files){
  const file=localFile(policy,f.file),before=read(file);if(hash(before)!==f.beforeSha256)fail('source-revision-conflict',f.file);let after=before;
  for(const e of plan.edits.filter(e=>e.file===f.file)){if(!allowed(policy,e.file,e.path))fail('unowned-token',e.id);if(typeof e.after!=='string'||!/^#[\da-f]{6}$|^\{[\w.-]+\}$/i.test(e.after))fail('unsupported-token-value',e.id);after=patchJSON(after,e.path,e.before,e.after);}
  assert.equal(hash(after),f.afterSha256,'planned output differs');prepared.push({file,before,after,temp:file+'.ds-contracts-writeback'});
 }
 equal([...new Set(plan.edits.map(e=>e.file))].sort(),plan.files.map(f=>f.file).sort(),'plan file inventory mismatch');
 const committed=[];
 try{
  for(const p of prepared){const fd=openSync(p.temp,'wx',statSync(p.file).mode);p.ownsTemp=true;try{writeFileSync(fd,p.after);}finally{closeSync(fd);}}
  checkGuards(policy,plan.guards);
  for(const p of prepared){if(read(p.file)!==p.before)fail('source-revision-conflict',p.file);renameSync(p.temp,p.file);committed.push(p);}
 }catch(error){for(const p of committed.reverse())if(read(p.file)===p.after)writeFileSync(p.file,p.before);throw error;}
 finally{for(const p of prepared)if(p.ownsTemp)try{unlinkSync(p.temp);}catch{}}
 return {status:plan.edits.length?'applied':'unchanged',digest,written:prepared.map(p=>path.relative(policy.root,p.file)),after:plan.files.map(f=>({file:f.file,sha256:f.afterSha256}))};
}

