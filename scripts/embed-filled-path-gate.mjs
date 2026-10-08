import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('packages/schema/src/filled-path.ts','utf8');
const begin=source.indexOf('export function filledPathsIssue(');
const end=source.indexOf('export function filledPathMask(',begin);
if(begin<0||end<begin)throw Error('filled-path-source-boundary-missing');
const code=ts.transpileModule(source.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText.replace(/^export /gm,'').trim();
const file='extract/figma/dump.plugin.js',prior=readFileSync(file,'utf8');
const start=prior.indexOf('function filledPathsIssue('),stop=prior.indexOf('function strokedPathIssue(',start);
if(start<0||stop<start)throw Error('filled-path-embedded-boundary-missing');
const next=prior.slice(0,start)+code+'\n\n'+prior.slice(stop);
if(process.argv.includes('--check')){
 if(next!==prior)throw Error('filled-path-embedded-drift');
 console.log('Shared convex filled-path gate verified.');
}else{writeFileSync(file,next);console.log('Shared convex filled-path gate embedded.');}
