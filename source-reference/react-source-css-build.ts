/** Pinned host compiler for source repair previews. Reads CSS and source text;
 * refuses JavaScript plugins/configuration and never runs project scripts.
 * This does not write the generated stylesheet or the original source. */
import {compile} from '@tailwindcss/node';
import {Scanner} from '@tailwindcss/oxide';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';

const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const fail=(reason:string):never=>{throw Error('react-source-css-'+reason);};
export async function buildReactSourceCss(root:string,input:string) {
  root=realpathSync(root);
  const entry=path.resolve(root,input);
  if(!entry.startsWith(root+path.sep)||path.extname(entry)!=='.css')fail('input-invalid');
  const files:Record<string,string>={};
  const read=(file:string)=>{
    const stat=lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16*1024*1024)fail('input-invalid');
    const bytes=readFileSync(file),hash=sha(bytes);
    if(files[file]&&files[file]!==hash)fail('input-changed');
    files[file]=hash;return bytes.toString('utf8');
  };
  const css=read(entry);
  const compiler=await compile(css,{base:path.dirname(entry),from:entry,
    onDependency:file=>{read(file);},customJsResolver:async()=>fail('javascript-build-refused')});
  const sources=[...compiler.sources,...(compiler.root===null?[{base:root,pattern:'**/*',negated:false}]
    :compiler.root==='none'?[]:[{...compiler.root,negated:false}])];
  // Match the CLI's full scan. scanFiles(content) extracts CSS differently
  // and can introduce unrelated utilities; source edits belong in a separate
  // staging directory before this build, never in a guessed candidate overlay.
  const discovery=new Scanner({sources}),candidates=discovery.scan();
  const sourceFiles=discovery.files.slice().sort();
  sourceFiles.forEach(read);
  const output=compiler.build(candidates);
  // A source added or removed during the build also invalidates the result.
  const fresh=new Scanner({sources}),freshCandidates=fresh.scan();
  if(JSON.stringify(fresh.files.slice().sort())!==JSON.stringify(sourceFiles)||
      JSON.stringify(freshCandidates)!==JSON.stringify(candidates))fail('source-census-changed');
  for(const [file,hash] of Object.entries(files))if(sha(readFileSync(file))!==hash)fail('input-changed');
  return {version:1 as const,compiler:'tailwindcss-4.3.3' as const,css:output,sha256:sha(output),
    files,sourceFiles,candidates:candidates.length};
}
