import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildReactSourceCss} from './react-source-css-build.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(t:test.TestContext) {
  const root=realpathSync(mkdtempSync(path.join(tmpdir(),'react-source-css-')));
  t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(path.join(root,'src'));
  writeFileSync(path.join(root,'input.css'),'@import "./theme.css"; @tailwind utilities source(none); @source "./src";');
  writeFileSync(path.join(root,'theme.css'),'@theme { --spacing: 0.25rem; }');
  const file=path.join(root,'src/control.tsx'),original='<button className="disabled:opacity-50 p-2" />';
  writeFileSync(file,original);return {root,file,original};
}

test('the host CSS compiler rebuilds staged source and records its inputs without writing files',async t=>{
  const f=fixture(t),before=await buildReactSourceCss(f.root,'input.css');
  assert.equal(readFileSync(f.file,'utf8'),f.original);
  const replacement=f.original.replace('opacity-50','opacity-60');writeFileSync(f.file,replacement);
  const after=await buildReactSourceCss(f.root,'input.css');
  assert.match(before.css,/opacity: 50%/);assert.match(after.css,/opacity: 60%/);assert.doesNotMatch(after.css,/opacity: 50%/);
  assert.match(after.css,/padding: calc\(var\(--spacing\) \* 2\)/);
  assert.equal(after.files[f.file],sha(replacement));assert.equal(readFileSync(f.file,'utf8'),replacement);
  assert.deepEqual((await buildReactSourceCss(f.root,'input.css')).css,after.css);
  assert.deepEqual(Object.keys(after.files).sort(),[path.join(f.root,'input.css'),f.file,path.join(f.root,'theme.css')].sort());
  await assert.rejects(()=>buildReactSourceCss(f.root,'../input.css'),/input-invalid/);
});

test('CSS plugins and configuration cannot execute original-source JavaScript on the host',async t=>{
  const f=fixture(t),sentinel=path.join(f.root,'executed'),plugin=path.join(f.root,'plugin.mjs');
  writeFileSync(plugin,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'bad');export default {};`);
  for(const directive of ['plugin','config']) {
    writeFileSync(path.join(f.root,'input.css'),`@${directive} "./plugin.mjs"; @tailwind utilities;`);
    await assert.rejects(()=>buildReactSourceCss(f.root,'input.css'),/javascript-build-refused/);
    assert.equal(existsSync(sentinel),false);
  }
});
