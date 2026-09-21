import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {revisionOf} from '../core/contract-provenance.js';
import {createSourceFileTransactions} from './react-source-file-transaction.js';
import {buildReactReference,createReactReferenceService,reactReferenceUnchanged} from './react-reference.js';
import {reactWitnessesMatch} from './react-reference-profiles.js';
import {sourceWitnessFixture as fixture} from './react-source-witness-test-fixture.js';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const bytes=(value:unknown)=>JSON.stringify(value)+'\n';

test('only a completed exact transaction installs revised witnesses, including after restart',async t=>{
  const f=await fixture(t),p=await f.preview(),original=structuredClone(f.base.profile('toggle'));
  const {selection,transactions,transaction}=p.link();
  assert.equal(f.store().load(f.root,f.base),f.base,'preparation is not permission or successful application');
  transactions.run(transaction.id,'apply',()=>{});
  const current=f.store().load(f.root,f.base);
  assert.equal(current.witnessSuccession?.revision,selection.revision);
  assert.equal(current.profile('toggle').requiredStyles?.opacity,'0.6');assert.deepEqual(f.base.profile('toggle'),original);
  assert.deepEqual({...current.profile('toggle'),requiredStyles:original.requiredStyles},original);
  const reference=await buildReactReference(f.root,current);assert.equal(reactWitnessesMatch(reference),true);
  assert.equal(reactWitnessesMatch(await buildReactReference(f.root,f.base)),false);
  assert.notEqual(reference.id,(await buildReactReference(f.root,{...current,witnessSuccession:undefined})).id,'witness provenance enters reference identity');
  assert.equal(reference.id,(await buildReactReference(f.root,f.store().load(f.root,f.base))).id);
  const history=transactions.history(transaction.id);history.transaction.edits[0].afterSha256='tampered';
  assert.notEqual(transactions.history(transaction.id).transaction.edits[0].afterSha256,'tampered');
  const events=readdirSync(path.join(f.repo,'private/react-source-file-transactions',transaction.id,'events'));
  assert.equal(transactions.run(transaction.id,'apply',()=>{}).wrote,false);
  assert.deepEqual(readdirSync(path.join(f.repo,'private/react-source-file-transactions',transaction.id,'events')),events);
});

test('rollback restores the frozen witnesses without rewriting either witness record',async t=>{
  const f=await fixture(t),p=await f.preview(),{selection,transactions,transaction}=p.link();
  const record=path.join(f.repo,'private/react-source-witness-successions/selections',selection.id+'.json'),before=readFileSync(record);
  transactions.run(transaction.id,'apply',()=>{});transactions.run(transaction.id,'rollback',()=>{});
  assert.equal(f.store().load(f.root,f.base),f.base);assert.deepEqual(readFileSync(record),before);
  assert.equal((await buildReactReference(f.root,f.base)).id,p.reference.id,'historical identity remains exact');
});

test('a reviewed reverse edit creates an authenticated chain and repeated values select its descendant',async t=>{
  const f=await fixture(t),p=await f.preview(),first=p.link();first.transactions.run(first.transaction.id,'apply',()=>{});
  const forward=f.store().load(f.root,f.base),reverse=await f.preview(forward,.6,.5),second=reverse.link();second.transactions.run(second.transaction.id,'apply',()=>{});
  const restored=f.store().load(f.root,f.base);assert.equal(restored.profile('toggle').requiredStyles?.opacity,'0.5');
  assert.equal(restored.witnessSuccession?.revision,second.selection.revision);
  const again=await f.preview(restored,.5,.6),third=again.link();third.transactions.run(third.transaction.id,'apply',()=>{});
  assert.equal(f.store().load(f.root,f.base).witnessSuccession?.revision,third.selection.revision);
  assert.notEqual(first.selection.id,third.selection.id);
});

test('all interrupted transaction boundaries refuse witnesses until resumed or rolled back',async t=>{
  for(const [point,index] of [['journal-apply',undefined],['moved',0],['installed',0],['installed',1]] as const){
    const f=await fixture(t),p=await f.preview(),{transaction}=p.link();
    const interrupted=createSourceFileTransactions(f.repo,{checkpoint:(at,i)=>{if(at===point&&i===index)throw Error('lost process');}});
    assert.throws(()=>interrupted.run(transaction.id,'apply',()=>{}),/lost process/);
    assert.throws(()=>f.store().load(f.root,f.base),/transaction-recovery-required/);
    createSourceFileTransactions(f.repo).run(transaction.id,'apply',()=>{});
    assert.equal(f.store().load(f.root,f.base).profile('toggle').requiredStyles?.opacity,'0.6');
  }
});

test('altered observations, styles, pixels, stages, witnesses and transaction selection cannot be admitted',async t=>{
  for(const mutate of ['caller','pixel','finite-pixel','stage','stage-pins','consistent-tree','profile','source','signature','transaction'] as const){
    const f=await fixture(t),p=await f.preview();
    if(mutate==='transaction'){
      const selected=p.prepare(),wrong=createSourceFileTransactions(f.repo).prepare({sourceRoot:f.root,selectionRevision:revisionOf('wrong'),inputs:selected.inputs,
        edits:[{file:f.sourceFile,beforeSha256:sha(readFileSync(f.sourceFile)),after:Buffer.from('different output')}]});
      assert.throws(()=>f.store().link(selected.id,wrong.id),/transaction-mismatch/);continue;
    }
    if(mutate==='caller'){p.after.captured.tree!.style.width='17px';writeFileSync(path.join(p.dir,'callers/toggle/candidate/frame.json'),bytes(p.after));}
    if(mutate==='pixel')writeFileSync(path.join(p.dir,'callers/toggle/candidate/initial.png'),'wrong pixels');
    if(mutate==='finite-pixel')writeFileSync(path.join(p.dir,'callers/toggle/candidate/instance-0/0.png'),'wrong pixels');
    if(mutate==='stage')writeFileSync(path.join(p.dir,'stage/stage.json'),'{}');
    if(mutate==='stage-pins'){p.stage.css.afterSha256=sha('unobserved CSS');writeFileSync(path.join(p.dir,'stage/stage.json'),bytes(p.stage));}
    if(mutate==='consistent-tree'){
      for(const [side,frame] of [['original',p.before],['candidate',p.after]] as const){frame.captured.tree!.style.width='17px';
        writeFileSync(path.join(p.dir,'callers/toggle',side,'frame.json'),bytes(frame));}
    }
    if(mutate==='profile')f.base.profile=()=>({id:'toggle',provenance:'changed',path:['button'],fontFamily:'different font',requiredTokens:{},requiredStyles:{opacity:'0.5'}});
    if(mutate==='source')writeFileSync(f.sourceFile,'owner edit');
    if(mutate==='signature')writeFileSync(path.join(p.dir,'started.json'),bytes({signature:revisionOf('different plan')}));
    assert.throws(p.prepare,/react-source-/);
  }
});

test('tampered retained proof or journal invalidates restart and already built references',async t=>{
  for(const target of ['frame','image','selection','journal','witness'] as const){
    const f=await fixture(t),p=await f.preview(),{selection,transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
    const current=f.store().load(f.root,f.base),reference=await buildReactReference(f.root,current);
    if(target==='witness'){
      const old=f.base.profile;f.base.profile=id=>({...old(id),fontFamily:'different font'});
      assert.throws(()=>f.store().load(f.root,f.base),/original-witness-changed/);continue;
    }
    const files={frame:path.join(p.dir,'callers/toggle/original/frame.json'),image:path.join(p.dir,'callers/toggle/candidate/instance-0/0.png'),
      selection:path.join(f.repo,'private/react-source-witness-successions/selections',selection.id+'.json'),
      journal:path.join(f.repo,'private/react-source-file-transactions',transaction.id,'events/00000000.json')};
    writeFileSync(files[target],'{}');assert.equal(reactReferenceUnchanged(reference),false);assert.throws(()=>f.store().load(f.root,f.base));
  }
});

test('new source input inventory and unrelated file drift cannot inherit the approved witness',async t=>{
  const f=await fixture(t),p=await f.preview(),{transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
  const current=f.store().load(f.root,f.base),reference=await buildReactReference(f.root,current);
  writeFileSync(path.join(f.root,'capture-input.css'),'changed input');
  assert.equal(reactReferenceUnchanged(reference),false);assert.equal(f.store().load(f.root,f.base),f.base);
  await assert.rejects(buildReactReference(f.root,current),/react-reference-source-changed/);
});

test('the normal source-loading HTTP action reopens a completed successor and names damaged evidence',async t=>{
  const f=await fixture(t,true),p=await f.preview(),{transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
  const expected=await buildReactReference(f.root,f.store().load(f.root));
  const handle=createReactReferenceService(f.repo,f.root),server=createServer((req,res)=>{void handle(req,res,(req.url??'').slice(1));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/react';
  const response=await fetch(url,{method:'POST'});assert.equal(response.status,200);
  assert.equal((await response.json()).id,expected.id);
  const persisted=JSON.parse(readFileSync(path.join(f.repo,'private/react-source-references',expected.id,'provenance.json'),'utf8'));
  assert.equal(persisted.witnessSuccession,expected.cohort.witnessSuccession!.revision);
  writeFileSync(path.join(p.dir,'callers/toggle/candidate/initial.png'),'changed');
  const refused=await fetch(url,{method:'POST'});assert.equal(refused.status,409);
  assert.equal((await refused.json()).reason,'react-source-witness-proof-changed');
});

test('changing a loaded successor profile invalidates its reference without changing source files',async t=>{
  const f=await fixture(t),p=await f.preview(),{transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
  const cohort=f.store().load(f.root,f.base),reference=await buildReactReference(f.root,cohort),original=cohort.profile;
  cohort.profile=id=>({...original(id),fontFamily:'different font'});
  assert.equal(reactReferenceUnchanged(reference),false);
});

test('matching bytes from unrelated completed histories refuse instead of selecting the newest record',async t=>{
  const f=await fixture(t),source=readFileSync(f.sourceFile),css=readFileSync(f.cssFile);
  const first=(await f.preview()).link();first.transactions.run(first.transaction.id,'apply',()=>{});
  // An external editor restores the old bytes without using transaction rollback.
  writeFileSync(f.sourceFile,source);writeFileSync(f.cssFile,css);
  const second=(await f.preview()).link();second.transactions.run(second.transaction.id,'apply',()=>{});
  assert.throws(()=>f.store().load(f.root,f.base),/ambiguous-current-witness/);
});

test('retained review remains authenticatable during a partial transaction without admitting that source',async t=>{
  const f=await fixture(t,true),p=await f.preview(),{selection,transaction}=p.link();
  const interrupted=createSourceFileTransactions(f.repo,{checkpoint:(point,index)=>{if(point==='moved'&&index===0)throw Error('lost process');}});
  assert.throws(()=>interrupted.run(transaction.id,'apply',()=>{}),/lost process/);
  assert.throws(()=>f.store().load(f.root),/recovery-required/);
  const reviewed=f.store().review(transaction.id,f.root);
  assert.equal(reviewed.transaction.selectionRevision,selection.revision);
  assert.equal(reviewed.before.profile('toggle').requiredStyles?.opacity,'0.5');
  assert.equal(reviewed.after.profile('toggle').requiredStyles?.opacity,'0.6');
  assert.equal(reviewed.selection.proof.plan.revision,p.input.plan.revision);
  writeFileSync(path.join(p.dir,'callers/toggle/candidate/initial.png'),'tampered');
  assert.throws(()=>f.store().review(transaction.id,f.root),/proof-changed/);
});
