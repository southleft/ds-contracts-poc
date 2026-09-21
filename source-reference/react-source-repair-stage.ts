/** Isolated, disposable source candidate. All writes go to a new private
 * directory; successful staging grants no write authority over the originals. */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,symlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {buildReactSourceCss} from './react-source-css-build.js';
import type {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';

type Candidate=ReturnType<typeof proposeReactOpacityUtilityEdits>[number];
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const fail=(reason:string):never=>{throw Error('react-source-stage-'+reason);};

export async function stageReactUtilitySourceEdit(repo:string,sourceRoot:string,
  referenceFiles:Readonly<Record<string,string>>,candidate:Candidate,recipe:{input:string;output:string}) {
  sourceRoot=realpathSync(sourceRoot);
  const owned=(file:string)=>file.startsWith(sourceRoot+path.sep)&&!path.relative(sourceRoot,file).split(path.sep).includes('node_modules');
  const sourceFile=path.resolve(sourceRoot,candidate.source.module),outputFile=path.resolve(sourceRoot,recipe.output);
  if(!owned(sourceFile)||!owned(outputFile)||sourceFile===outputFile||path.extname(outputFile)!=='.css'||
      referenceFiles[sourceFile]!==candidate.beforeSha256||!referenceFiles[outputFile])fail('source-selection-invalid');
  const unchanged=(files:Readonly<Record<string,string>>)=>{
    for(const [file,hash] of Object.entries(files)) {
      if(!/^[a-f0-9]{64}$/.test(hash)||sha(readFileSync(file))!==hash)fail('source-changed');
    }
  };
  unchanged(referenceFiles);
  const original=readFileSync(sourceFile,'utf8'),edit=candidate.edit;
  if(candidate.qualification!=='unverified-source-candidate'||candidate.source.sourceSha256!==candidate.beforeSha256||
      !Number.isInteger(edit.start)||!Number.isInteger(edit.end)||edit.start<0||edit.end<=edit.start||
      original.slice(edit.start,edit.end)!==edit.before||
      original.slice(0,edit.start)+edit.after+original.slice(edit.end)!==candidate.result||
      sha(candidate.result)!==candidate.afterSha256)fail('candidate-changed');
  const baseline=await buildReactSourceCss(sourceRoot,recipe.input);
  if(baseline.sha256!==referenceFiles[outputFile])fail('original-css-not-reproducible');
  if(!baseline.sourceFiles.includes(sourceFile)||baseline.sourceFiles.includes(outputFile))fail('source-scan-unsupported');
  const files={...referenceFiles};
  for(const [file,hash] of Object.entries(baseline.files)) {
    if(files[file]&&files[file]!==hash)fail('source-changed');files[file]=hash;
  }
  const parent=path.join(repo,'private','react-source-repair-stages');mkdirSync(parent,{recursive:true,mode:0o700});
  if(lstatSync(parent).isSymbolicLink())fail('directory-invalid');
  const dir=mkdtempSync(path.join(parent,'candidate-')),workspace=path.join(dir,'workspace');mkdirSync(workspace);
  for(const [file,hash] of Object.entries(files)) {
    if(!owned(file)||file===outputFile)continue;
    if(realpathSync(file)!==file||!lstatSync(file).isFile())fail('source-path-unsupported');
    const bytes=readFileSync(file);if(sha(bytes)!==hash)fail('source-changed');
    const target=path.join(workspace,path.relative(sourceRoot,file));mkdirSync(path.dirname(target),{recursive:true});
    writeFileSync(target,file===sourceFile?candidate.result:bytes,{flag:'wx'});
  }
  const modules=path.join(sourceRoot,'node_modules');
  if(existsSync(modules))symlinkSync(modules,path.join(workspace,'node_modules'),'dir');
  const built=await buildReactSourceCss(workspace,recipe.input);
  const stagedSource=path.join(realpathSync(workspace),path.relative(sourceRoot,sourceFile));
  if(!built.sourceFiles.includes(stagedSource)||built.files[stagedSource]!==candidate.afterSha256)fail('staged-source-not-scanned');
  const targetCss=path.join(workspace,path.relative(sourceRoot,outputFile));mkdirSync(path.dirname(targetCss),{recursive:true});
  writeFileSync(targetCss,built.css,{flag:'wx'});
  unchanged(files);
  const current=await buildReactSourceCss(sourceRoot,recipe.input);
  if(current.sha256!==baseline.sha256||JSON.stringify(current.sourceFiles)!==JSON.stringify(baseline.sourceFiles)||
      JSON.stringify(Object.entries(current.files).sort())!==JSON.stringify(Object.entries(baseline.files).sort()))
    fail('source-census-changed');
  const receipt={version:1 as const,qualification:'unverified-staged-source' as const,sourceRoot,workspace,
    originalFiles:files,source:{file:sourceFile,beforeSha256:candidate.beforeSha256,afterSha256:candidate.afterSha256,edit},
    css:{file:outputFile,beforeSha256:baseline.sha256,afterSha256:built.sha256},
    limitations:['all-case-observation-required','unique-effect-required','original-source-write-not-authorized']};
  writeFileSync(path.join(dir,'stage.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  return receipt;
}
