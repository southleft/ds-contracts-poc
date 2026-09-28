/** Isolated, disposable source candidate. All writes go to a new private
 * directory; successful staging grants no write authority over the originals. */
import {createHash} from 'node:crypto';
import {constants,cpSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,realpathSync,symlinkSync,writeFileSync} from 'node:fs';
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
  if(existsSync(modules))stageModules(modules,path.join(workspace,'node_modules'),referenceFiles);
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

/** Every package holding an authenticated reference file is cloned into the
 * stage, so the staged source program resolves its components inside its own
 * root exactly as the original did. A single symlinked node_modules resolved
 * outside the stage and silently dropped them (docs/23 §D.173). Every other
 * entry stays a link for runtime resolution only. */
function stageModules(modules:string,target:string,referenceFiles:Readonly<Record<string,string>>) {
  const packages=new Set<string>(),authenticated:Array<[string,string]>=[];
  for(const [file,hash] of Object.entries(referenceFiles)) {
    if(!file.startsWith(modules+path.sep))continue;
    const parts=path.relative(modules,file).split(path.sep);
    if(parts.length<2||parts[0].startsWith('@')&&parts.length<3)fail('module-path-unsupported');
    // A dot-named entry is a package manager's store (pnpm's .pnpm), not a
    // package: cloning it copies every dependency and still resolves outside.
    if(parts[0].startsWith('.'))fail('module-layout-unsupported');
    packages.add(parts[0].startsWith('@')?path.join(parts[0],parts[1]):parts[0]);
    authenticated.push([path.join(target,path.relative(modules,file)),hash]);
  }
  const place=(entry:string)=>{
    const from=path.join(modules,entry),to=path.join(target,entry);
    if(packages.has(entry))cpSync(from,to,{recursive:true,mode:constants.COPYFILE_FICLONE,verbatimSymlinks:true});
    else symlinkSync(from,to);
  };
  mkdirSync(target);
  for(const entry of readdirSync(modules)) {
    if(entry.startsWith('@')&&[...packages].some(p=>p.startsWith(entry+path.sep))) {
      mkdirSync(path.join(target,entry));
      for(const name of readdirSync(path.join(modules,entry)))place(path.join(entry,name));
    } else place(entry);
  }
  for(const [file,hash] of authenticated)
    if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file||sha(readFileSync(file))!==hash)fail('module-copy-changed');
}

