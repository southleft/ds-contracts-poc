import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';
import {buildReactSourceCss} from './react-source-css-build.js';
import {stageReactUtilitySourceEdit} from './react-source-repair-stage.js';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');

async function fixture(t:test.TestContext) {
  const repo=realpathSync(mkdtempSync(path.join(tmpdir(),'source-repair-stage-'))),root=path.join(repo,'original');
  t.after(()=>rmSync(repo,{recursive:true,force:true}));mkdirSync(path.join(root,'src'),{recursive:true});
  const text='function Control() { return <button className="disabled:opacity-50"/>; }';
  writeFileSync(path.join(root,'src/control.tsx'),text);writeFileSync(path.join(root,'input.css'),'@tailwind utilities source(none); @source "./src";');
  const css=(await buildReactSourceCss(root,'input.css')).css;writeFileSync(path.join(root,'output.css'),css);
  const files=Object.fromEntries(['src/control.tsx','input.css','output.css'].map(f=>[path.join(root,f),sha(readFileSync(path.join(root,f)))]));
  const candidate=proposeReactOpacityUtilityEdits(text,{module:'src/control.tsx',exportName:'Control',sourceSha256:sha(text),span:{start:0,end:text.length}},{before:0.5,after:0.6})[0];
  return {repo,root,text,css,files,candidate,recipe:{input:'input.css',output:'output.css'}};
}

test('a private stage contains only the candidate source/CSS change and leaves original bytes untouched',async t=>{
  const f=await fixture(t),stage=await stageReactUtilitySourceEdit(f.repo,f.root,f.files,f.candidate,f.recipe);
  assert.equal(stage.qualification,'unverified-staged-source');assert.notEqual(stage.workspace,f.root);
  assert.equal(readFileSync(path.join(stage.workspace,'src/control.tsx'),'utf8'),f.candidate.result);
  assert.match(readFileSync(path.join(stage.workspace,'output.css'),'utf8'),/opacity: 60%/);
  assert.equal(readFileSync(path.join(f.root,'src/control.tsx'),'utf8'),f.text);
  assert.equal(readFileSync(path.join(f.root,'output.css'),'utf8'),f.css);
  for(const [file,hash] of Object.entries(stage.originalFiles))assert.equal(sha(readFileSync(file)),hash);
  const repeat=await stageReactUtilitySourceEdit(f.repo,f.root,f.files,f.candidate,f.recipe);
  assert.notEqual(repeat.workspace,stage.workspace);assert.deepEqual(repeat.source,stage.source);assert.deepEqual(repeat.css,stage.css);
});

test('staging refuses changed originals, modified candidates and a nonreproducible existing stylesheet',async t=>{
  const f=await fixture(t);
  await assert.rejects(()=>stageReactUtilitySourceEdit(f.repo,f.root,f.files,{...f.candidate,result:f.candidate.result+'\n'},f.recipe),/candidate-changed/);
  await assert.rejects(()=>stageReactUtilitySourceEdit(f.repo,f.root,f.files,f.candidate,{...f.recipe,output:'../outside.css'}),/source-selection-invalid/);
  writeFileSync(path.join(f.root,'output.css'),f.css+'\n/* hand edit */');
  await assert.rejects(()=>stageReactUtilitySourceEdit(f.repo,f.root,f.files,f.candidate,f.recipe),/source-changed/);
  const changed={...f.files,[path.join(f.root,'output.css')]:sha(readFileSync(path.join(f.root,'output.css')))};
  await assert.rejects(()=>stageReactUtilitySourceEdit(f.repo,f.root,changed,f.candidate,f.recipe),/original-css-not-reproducible/);
});
