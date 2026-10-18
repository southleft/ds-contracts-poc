import test from 'node:test';
import assert from 'node:assert/strict';
import {reactOwnershipSelectedCases,startReactOwnership} from './react-ownership-run.js';
import type {ReactReference} from './react-reference.js';

const reference = {cohort:{cases:[{id:'first'},{id:'second'},{id:'third'}]},
  get sourceRoot():string { throw Error('source-was-read'); }} as unknown as ReactReference;

test('host-only ownership case selection rejects invalid IDs before source observation',()=>{
  for (const selectedCaseIds of [[],['unknown'],['first','first'],['first','unknown'],[null], 'first',
      Array(1),['first',,]]) {
    assert.throws(()=>startReactOwnership(reference,'unused','unused',
      {selectedCaseIds:selectedCaseIds as readonly string[]}),/^Error: react-ownership-case-selection-invalid$/);
  }
});

test('default observes the full cohort; explicit selection is copied without changing it',()=>{
  assert.equal(reactOwnershipSelectedCases(reference),undefined);
  const ids=['second'], selected=reactOwnershipSelectedCases(reference,ids);
  ids.push('first');
  assert.deepEqual([...selected!],['second']);
  assert.deepEqual(reference.cohort.cases.map(c=>c.id),['first','second','third']);
  assert.throws(()=>startReactOwnership(reference,'unused','unused',{selectedCaseIds:['second']}),
    /^Error: react-ownership-source-changed$/);
});


// A real service capture proves the trusted option reaches the observer without
// letting HTTP choose work or making unobserved cases disappear from the report.
test('trusted service selection keeps the full denominator and rejects HTTP selection', async t => {
  const { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { createServer } = await import('node:http');
  const { createReferenceService } = await import('./service.js');
  const { evidenceSha } = await import('./react-validation-evidence.js');
  const source = realpathSync(mkdtempSync(path.join(process.cwd(), 'source-reference/.selected-service-')));
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), 'react-selected-service-')));
  const previous = process.env.DS_CONTRACTS_REACT_SOURCE_ROOT;
  let succeeded = false;
  mkdirSync(path.join(source, 'node_modules'));
  for (const name of ['react', 'react-dom', 'scheduler'])
    cpSync(realpathSync(path.resolve('node_modules', name)), path.join(source, 'node_modules', name), { recursive: true });
  const component = `import React from 'react';
const Content=({children})=>React.createElement('div',{className:'content'},children);
export const Control=({children})=>React.createElement('section',{id:'control'},React.createElement(Content,null,children));`;
  const font = readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
  const css = `@font-face{font-family:'IBM Plex Sans';src:url(data:font/woff2;base64,${font})}:root{--test-color:rgb(0,0,0)}#control{display:flex;width:160px;height:44px;color:var(--test-color);font-family:'IBM Plex Sans';font-size:14px;line-height:20px}.content{display:flex;width:100%;height:44px}`;
  for (const [name, text] of Object.entries({ 'package.json':'{"type":"module"}', 'package-lock.json':'{}',
    'tsconfig.json':JSON.stringify({compilerOptions:{allowJs:true,target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true},include:['control.mjs']}),
    'control.mjs':component, 'style.css':css })) writeFileSync(path.join(source,name),text);
  writeFileSync(path.join(source, 'ds-contracts.react.json'), JSON.stringify({ version:1, source:'trusted service selection regression', theme:'Light',
    fontFamily:'IBM Plex Sans', sideEffectImports:['./style.css'], requiredTokens:{'--test-color':'rgb(0,0,0)'},
    witnessFiles:{'control.mjs':evidenceSha(component),'style.css':evidenceSha(css)},
    cases:['control','pending'].map((id,index)=>({id,subject:'Control',label:id,negativeControl:index===0,
      mount:{module:'./control.mjs',export:'Control',children:[index?'Pending':'Original']},
      witness:{path:['#control'],fontOrigin:'web',requiredStyles:{display:'flex'}}})) }));
  process.env.DS_CONTRACTS_REACT_SOURCE_ROOT = source;
  const selected = ['control'];
  const service = createReferenceService(repo, undefined, undefined, {}, undefined, {ownershipCaseIds:selected});
  selected.push('pending'); // The host option is captured when the service is created.
  const server = createServer((req,res)=>{void service.handle(req,res);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}/api/source-reference/`;
  t.after(async()=>{
    service.close();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    if(previous===undefined)delete process.env.DS_CONTRACTS_REACT_SOURCE_ROOT;
    else process.env.DS_CONTRACTS_REACT_SOURCE_ROOT=previous;
    if(succeeded){rmSync(source,{recursive:true,force:true});rmSync(repo,{recursive:true,force:true});}
  });
  const loaded = await fetch(base+'react',{method:'POST'}); assert.equal(loaded.status,200);
  const reference = await loaded.json(), url = base+`react/${reference.id}/ownership`;
  const rejected = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selectedCaseIds:['pending']})});
  assert.equal(rejected.status,400);
  assert.match((await rejected.json()).error,/accepts no request body/);
  assert.equal((await fetch(url)).status,404,'rejected HTTP selection never starts an observation');
  const started = await fetch(url,{method:'POST'}); assert.equal(started.status,202);
  let report = await started.json();
  const deadline = Date.now()+60000;
  while(report.state==='running' && Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,1000));
    report=await (await fetch(url)).json();
  }
  writeFileSync(path.join(repo,'test-report.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(report.state,'complete',JSON.stringify({repo,problem:report.problem,rows:report.rows?.map((r:any)=>({id:r.id,problems:r.problems}))}));
  assert.equal(report.denominator,2);
  assert.deepEqual(report.rows.map((r:any)=>r.id),['control','pending']);
  assert.equal(report.matched,1);
  assert.equal(report.sourceUnchanged,true);
  assert.equal(report.rows[0].matched,true,JSON.stringify(report.rows[0].problems));
  assert.equal(report.rows[0].sourceImage,report.rows[0].observedImage);
  assert.deepEqual(report.rows[1].problems,['react-ownership-case-not-observed']);
  assert.equal(report.rows[1].matched,false);
  assert.equal(report.rows[1].sourceImage,undefined);
  assert.equal(report.rows[1].rootMatrix,undefined);
  succeeded=true;
});
