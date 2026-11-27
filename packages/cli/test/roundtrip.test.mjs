import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {hash,canonical} from '../src/roundtrip/surface.mjs';
import {seal,resolveBundle} from '../src/roundtrip/model.mjs';
import {planWriteback,applyWriteback} from '../src/roundtrip/writeback.mjs';
import {runRoundtrip} from '../src/roundtrip/index.mjs';

function fixture(t){
 const base=resolve(process.cwd().endsWith('/packages/cli')?'../../private':'private','roundtrip-tests');mkdirSync(base,{recursive:true});
 const dir=mkdtempSync(join(base,'case-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const save=(p,v)=>writeFileSync(join(dir,p),typeof v==='string'?v:canonical(v)),read=p=>readFileSync(join(dir,p),'utf8');
 save('tokens.json','{\n  "primitive": "#123456", "semantic": "{primitive}", "component": "{semantic}"\n}\n');save('source.tsx','authored behavior');
 const tokens=Object.fromEntries(['primitive','semantic','component'].map((id,i)=>[id,{id,type:'color',tier:id,css:'--'+id,...(i?{alias:i===1?'primitive':'semantic'}:{value:'#123456'}),source:{file:'tokens.json',path:[id],sha256:hash(read('tokens.json'))}}]));
 const B=seal({contract:'system-aware/0.1',root:'parent',system:{id:'test',version:'1',tokens},components:{glyph:{id:'glyph',source:{path:'source.tsx',sha256:hash(read('source.tsx'))},requires:[]},parent:{id:'parent',source:{path:'source.tsx',sha256:hash(read('source.tsx'))},requires:[],instances:{icon:{component:'glyph',colorToken:'component'}}}}});
 B.components.parent.requires=[{id:'glyph',revision:B.components.glyph.revision}];seal(B);
 const before={tokens:Object.fromEntries(Object.entries(tokens).map(([id,t])=>[id,{id,...(t.alias?{alias:t.alias}:{value:t.value}),codeSyntax:{WEB:'var(--'+id+')'}}])),variants:[{parts:{root:{styles:{fill:'#123456',padding:[0,0,0,0]},tokens:{fill:'component'}}},instances:{icon:{main:'glyph-id',colorToken:'component',vectors:[{color:'#123456'}]}}}]};
 const after=structuredClone(before);after.tokens.primitive.value='#abcdef';after.variants[0].parts.root.styles.fill='#abcdef';after.variants[0].instances.icon.vectors[0].color='#abcdef';
 const policy={version:1,system:'test',root:dir,contractSha256:hash(B),nativeBaselineSha256:hash(before),tokens:Object.values(tokens).map(t=>({id:t.id,file:t.source.file,path:t.source.path})),guards:['tokens.json','source.tsx'],inputs:[]};
 return {dir,save,read,B,before,after,policy};
}

test('reviewed writeback keeps alias chain, source formatting, and authored behavior',t=>{
 const f=fixture(t),p=planWriteback(f.B,f.before,f.after,f.policy);
 assert.equal(p.digest,planWriteback(f.B,f.before,f.after,f.policy).digest);assert.equal(p.edits.length,1);
 assert.throws(()=>applyWriteback(p,f.policy,'unreviewed'),/reviewed plan digest/);
 applyWriteback(p,f.policy,p.digest);assert.equal(f.read('tokens.json'),'{\n  "primitive": "#abcdef", "semantic": "{primitive}", "component": "{semantic}"\n}\n');assert.equal(f.read('source.tsx'),'authored behavior');
});
test('missing dependencies and alias cycles are named before writing',t=>{
 const f=fixture(t);delete f.B.components.glyph;assert(resolveBundle(f.B).gaps.some(g=>g.code==='missing-component-contract'&&g.id==='glyph'));
 f.B.system.tokens.primitive.alias='component';assert(resolveBundle(f.B).gaps.some(g=>g.code==='token-cycle'));
 assert.throws(()=>planWriteback(f.B,f.before,f.after,f.policy),/unresolved-contract/);
});
test('unsupported native edits and stale source preserve all files',t=>{
 const f=fixture(t),original=f.read('tokens.json');
 for(const edit of [n=>n.variants[0].parts.root.styles.padding[0]++,n=>n.variants[0].instances.icon.main='replacement',n=>n.tokens.component.codeSyntax.WEB='bad']){const bad=structuredClone(f.after);edit(bad);assert.throws(()=>planWriteback(f.B,f.before,bad,f.policy),/unsupported-native-edit|metadata changed/);}
 const p=planWriteback(f.B,f.before,f.after,f.policy);f.save('source.tsx','concurrent edit');assert.throws(()=>applyWriteback(p,f.policy,p.digest),/source-revision-conflict/);assert.equal(f.read('tokens.json'),original);assert.equal(f.read('source.tsx'),'concurrent edit');
});
test('pre-existing temporary work is never replaced or removed',t=>{
 const f=fixture(t),p=planWriteback(f.B,f.before,f.after,f.policy),original=f.read('tokens.json');f.save('tokens.json.ds-contracts-writeback','occupied');
 assert.throws(()=>applyWriteback(p,f.policy,p.digest),/EEXIST/);assert.equal(f.read('tokens.json'),original);assert.equal(f.read('tokens.json.ds-contracts-writeback'),'occupied');
});
test('failed session review is recoverable and leaves ready state intact',async t=>{
 const f=fixture(t),state={version:1,root:f.dir,profile:{figma:{}},stage:'ready',native:f.before,policy:f.policy};f.save('session.json',state);f.save('bundle.json',f.B);
 const bad=structuredClone(f.after);bad.variants[0].parts.root.styles.padding[0]=9;f.save('native.json',bad);
 await assert.rejects(runRoundtrip(['review','--session',f.dir,'--snapshot',join(f.dir,'native.json')],{log:()=>{}}),/unsupported-native-edit/);
 assert.deepEqual(JSON.parse(f.read('session.json')),state);assert(!existsSync(join(f.dir,'.lock')));
 f.save('native.json',f.after);await runRoundtrip(['review','--session',f.dir,'--snapshot',join(f.dir,'native.json')],{log:()=>{}});assert.equal(JSON.parse(f.read('session.json')).stage,'reviewed');
 await runRoundtrip(['discard','--session',f.dir],{log:()=>{}});assert.equal(JSON.parse(f.read('session.json')).stage,'ready');
 f.save('native.json',f.before);await runRoundtrip(['review','--session',f.dir,'--snapshot',join(f.dir,'native.json')],{log:()=>{}});assert.equal(JSON.parse(f.read('session.json')).stage,'ready');
});
test('accept refuses source changed since capture and retains pending state',async t=>{
 const f=fixture(t),state={version:1,root:f.dir,profile:{figma:{}},stage:'awaiting-figma',inputs:[{file:join(f.dir,'source.tsx'),sha256:hash('authored behavior')}]};f.save('session.json',state);f.save('bundle.json',f.B);f.save('native.json',f.before);f.save('source.tsx','changed');
 await assert.rejects(runRoundtrip(['accept','--session',f.dir,'--snapshot',join(f.dir,'native.json')],{log:()=>{}}),/source changed since capture/);assert.deepEqual(JSON.parse(f.read('session.json')),state);
});
test('session lock prevents concurrent writers without removing their lock',async t=>{
 const f=fixture(t);f.save('session.json',{});f.save('.lock','owner');await assert.rejects(runRoundtrip(['status','--session',f.dir]),/EEXIST/);assert.equal(f.read('.lock'),'owner');
});
