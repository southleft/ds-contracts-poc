import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const file='extract/figma/dump.plugin.js';
const bundle=await build({entryPoints:['extract/figma/text-appearance-observation.ts'],bundle:true,write:false,format:'iife',globalName:'TextAppearanceCapture',target:'es2020',minify:true});
const start='// BEGIN SHARED TEXT APPEARANCE',end='// END SHARED TEXT APPEARANCE',prior=readFileSync(file,'utf8');
if(prior.split(start).length!==2||prior.split(end).length!==2)throw Error('text-appearance-marker-unqualified');
const next=prior.slice(0,prior.indexOf(start))+start+'\n'+bundle.outputFiles[0].text.trim()+'\n'+prior.slice(prior.indexOf(end));
if(process.argv.includes('--check')){if(prior!==next)throw Error('text-appearance-embedded-drift');}
else writeFileSync(file,next);
