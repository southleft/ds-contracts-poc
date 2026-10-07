import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const file='extract/figma/dump.plugin.js';
const bundle=await build({entryPoints:['extract/figma/solid-fill-observation.ts'],bundle:true,write:false,format:'iife',globalName:'SolidFillCapture',target:'es2020',minify:true});
const code=bundle.outputFiles[0].text.trim();
const start='// BEGIN SHARED SOLID FILL OBSERVATION',end='// END SHARED SOLID FILL OBSERVATION';
const prior=readFileSync(file,'utf8');
if(prior.split(start).length!==2||prior.split(end).length!==2)throw Error('source-fill-observation-marker-unqualified');
const next=prior.slice(0,prior.indexOf(start))+start+'\n'+code+'\n'+prior.slice(prior.indexOf(end));
if(process.argv.includes('--check')){if(prior!==next)throw Error('source-fill-observation-embedded-drift');console.log('Shared source fill observer verified.');}
else {writeFileSync(file,next);console.log('Shared source fill observer embedded.');}
