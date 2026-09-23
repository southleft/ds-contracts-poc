/** One-time capture of historical inputs, not a golden refresh. The unchanged
 * program pins must reproduce before any fixture is written. Run with Node 20
 * and the recorded parent commit available locally. Current fixture helpers
 * are used with that parent's emitter and native mock; changes to those helpers
 * or dependencies that alter the inputs cause this command to refuse. */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const baseline = '42beffdfc9bb5435b0c76a6d563d0d378c0bd793';
const root = process.cwd(), temp = mkdtempSync(path.join(root, '.native-byte-inputs-'));
const pins = {
  scalar: '085705da835c83dc939be25a4a2a882e6ac2e95b204021bf6088823be4becae6',
  'root-size': '8092b39598fa576f06ee92d91cbc27fbbf85b2cea1e172b0cc8683b2ae522a14',
  'legacy-token': '8197ce593b4d34f823b97579b811c135779a39a8e970fdcb5f18a28ad0e9eed7',
};
const entry = `
import {nativeUpdateFixture} from './core/native-contract-update-test-fixture.ts';
import {nativeRootSizeUpdateFixture} from './core/native-contract-size-update-test-fixture.ts';
import {prepareNativeContractUpdate} from './core/native-contract-update.ts';
import {createHash} from 'node:crypto';
const kind=process.argv[2];let f,input;
if(kind==='root-size'){f=await nativeRootSizeUpdateFixture();input=f.input;}
else {f=await nativeUpdateFixture();input=f.input;if(kind==='legacy-token')input={...f.input,desired:f.desiredFor({...structuredClone(f.tokens),opacity:{$type:'number',$value:0.4}})};}
const prepared=prepareNativeContractUpdate(input);if(kind==='legacy-token')delete prepared.plan.tokenBindingScope;
console.log(JSON.stringify({input,sha256:createHash('sha256').update(JSON.stringify(prepared.plan)).digest('hex')}));`;
try {
  const bundle = path.join(temp, 'capture.mjs');
  await build({stdin:{contents:entry,resolveDir:root,sourcefile:'capture.ts',loader:'ts'},
    bundle:true,platform:'node',format:'esm',packages:'external',outfile:bundle,
    plugins:[{name:'historical-emitter-and-mock',setup(builder){
      for(const name of ['core/emit-figma-script.ts','scripts/plugin-engine-mock-figma.mjs']) {
        builder.onLoad({filter:new RegExp(name.replaceAll('.','\\.')+'$')},()=>({
          contents:execFileSync('git',['show',baseline+':'+name],{encoding:'utf8'}),
          loader:name.endsWith('.ts')?'ts':'js',resolveDir:path.dirname(path.join(root,name)),
        }));
      }
    }}]});
  const records = Object.entries(pins).map(([kind, expected]) => {
    const record=JSON.parse(execFileSync(process.execPath,[bundle,kind],{encoding:'utf8'}));
    assert.equal(record.sha256,expected,`${kind}: historical plan bytes changed; refuse fixture capture`);
    return [kind, record.input];
  });
  const output=path.join(root,'core/fixtures/native-update-byte-inputs');
  mkdirSync(output,{recursive:true});
  for(const [kind,input] of records) writeFileSync(path.join(output,kind+'.json'),JSON.stringify(input,null,2)+'\n',{flag:'wx'});
  console.log(`Captured ${records.length} historical inputs; all original plan pins preserved (${baseline}).`);
} finally { rmSync(temp,{recursive:true,force:true}); }
