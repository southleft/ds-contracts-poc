import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {buildReactReference} from './react-reference.js';
import {startReactOwnership} from './react-ownership-run.js';
import {readReactAuthoredContent,verifiedReactAuthoredContent} from './react-authored-content.js';
import {evidenceSha} from './react-validation-evidence.js';
import type {ReactJsxHelperObservation} from './react-jsx-helper-observation.js';

/** Actual original source/build/renderer/archived-authority regression. No native
 * writes and no fixture substitution for the product's observation workflow. */
for(const syntax of ['classic','jsx'] as const)test('ordinary '+syntax+' default function preserves private nested membership and sealed authored authority',async t=>{
 const repo=realpathSync(mkdtempSync(path.join(process.cwd(),'source-reference/.function-journey-')));
 let succeeded=false;
 t.after(()=>{if(succeeded)rmSync(repo,{recursive:true,force:true});});
 mkdirSync(path.join(repo,'node_modules'));
 for(const name of ['react','react-dom','scheduler'])cpSync(realpathSync(path.resolve('node_modules',name)),path.join(repo,'node_modules',name),{recursive:true});
 const filename=syntax==='classic'?'control.mjs':'control.jsx';
 const text=syntax==='classic'?`import React from 'react';import {TYPE_OPTIONS} from './constants.mjs';
const ContentWrapper=({children})=>React.createElement('div',{className:'content'},children);
const Control=props=>{const {type=TYPE_OPTIONS.INFO,children}=props;return React.createElement('section',{id:'control','data-kind':type},React.createElement(ContentWrapper,null,children));};
export default Control;`:`import React from 'react';import {TYPE_OPTIONS} from './constants.mjs';
const ContentWrapper=({children})=><div className='content'>{children}</div>;
const Control=props=>{const {type=TYPE_OPTIONS.INFO,children}=props;return <section id='control' data-kind={type}><ContentWrapper>{children}</ContentWrapper></section>;};
export default Control;`;
 const constants=`export const TYPE_OPTIONS={INFO:'info'};`;
 // A real bundled font keeps this instrument test identical on macOS/Linux.
 const font=readFileSync('extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2').toString('base64');
 const css=`@font-face{font-family:'IBM Plex Sans';src:url(data:font/woff2;base64,${font})}:root{--test-color:rgb(0, 0, 0)}#control{display:flex;flex-direction:column;width:160px;height:44px;color:var(--test-color);font-family:'IBM Plex Sans';font-size:14px;line-height:20px}.content{display:flex;width:100%;height:44px}`;
 for(const [name,contents] of Object.entries({'package.json':'{"type":"module"}','package-lock.json':'{}','tsconfig.json':JSON.stringify({compilerOptions:{allowJs:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true},include:[filename]}),[filename]:text,'constants.mjs':constants,'style.css':css}))writeFileSync(path.join(repo,name),contents);
 const declaration={version:1,source:'original plain function regression',theme:'Light',fontFamily:'IBM Plex Sans',sideEffectImports:['./style.css'],requiredTokens:{'--test-color':'rgb(0, 0, 0)'},witnessFiles:{[filename]:evidenceSha(text),'constants.mjs':evidenceSha(constants),'style.css':evidenceSha(css)},cases:['control','pending'].map((id,index)=>({id,subject:'default',label:id,negativeControl:index===0,mount:{module:'./'+filename,export:'default',children:[index?'Pending':'Original']},witness:{path:['#control'],fontOrigin:'web',requiredStyles:{display:'flex'}}}))};
 writeFileSync(path.join(repo,'ds-contracts.react.json'),JSON.stringify(declaration));
 const before=readFileSync(path.join(repo,filename)),reference=await buildReactReference(repo);
 const job=startReactOwnership(reference,repo,path.join(repo,'evidence/private/react-source-ownership'),{selectedCaseIds:['control']});t.after(()=>job.close());await job.promise;
 const report=job.report();
 writeFileSync(path.join(repo,'full-ownership-report.json'),JSON.stringify(report,null,2)+'\n');
 console.error('Authored function diagnostic: '+JSON.stringify({syntax,repo,report:path.join(repo,'full-ownership-report.json'),state:report.state,problem:report.problem,matched:report.matched,rows:report.rows.map(row=>({id:row.id,matched:row.matched,problems:row.problems}))}));
 assert.equal(report.state,'complete',JSON.stringify({problem:report.problem}));assert.equal(report.denominator,2);assert.equal(report.matched,1);assert.equal(report.sourceUnchanged,true);
 const row=report.rows.find(r=>r.id==='control')!;assert(row.matched);assert.deepEqual(row.problems,[]);assert.equal(row.sourceImage,row.observedImage);
 assert.deepEqual(report.rows.find(r=>r.id==='pending')?.problems,['react-ownership-case-not-observed']);
 if(syntax==='classic')assert(row.compiledEffects?.some(r=>r.model.status==='refused'&&r.model.reason==='opaque-closure-inspected:TYPE_OPTIONS'),'unknown effects remain refused');
 const helper=row.jsxHelpers?.find(h=>h.result.runtime?.status==='observed'&&h.result.runtime.authoredFunctions)?.result;
 assert(helper,'ordinary function observation must produce a genuine archived helper');assert.equal(helper.status,'observed');
 assert(helper.renderGraph?.rows.every(r=>r.status==='linked'));assert.equal(helper.runtime?.status,'observed');
 if(helper.runtime?.status!=='observed')return;
 assert.equal(helper.runtime.authoredFunctions?.calls.length,2);assert(helper.runtime.authoredFunctions?.calls.every(c=>c.current));
 assert.equal(row.ownership?.components.length,1,'private ContentWrapper is not invented as an exported boundary');
 const dir=path.join(repo,'evidence/private/react-source-ownership',report.referenceId,report.id),rowDir=path.join(dir,'control'),index=row.jsxHelpers!.findIndex(h=>h.result===helper),helperDir=path.join(rowDir,'jsx-helpers',String(index));
 const program=JSON.parse(readFileSync(path.join(dir,'program.json'),'utf8')),tree=JSON.parse(readFileSync(path.join(rowDir,'source-tree.json'),'utf8')).tree;
 const options={referenceId:reference.id,sourceRoot:repo,program,ownership:row.ownership!,tree,helper,read:(name:string)=>readFileSync(path.join(helperDir,name))};
 const content=readReactAuthoredContent(options),fact=verifiedReactAuthoredContent(content,program,row.ownership!,tree);
 assert.equal(fact.qualification,'observed-authored-render-tree-only');assert.equal(fact.effectsVerified,false);assert.equal(fact.acceptedContract,null);assert.equal(fact.boundaries.length,1);
 assert(fact.hosts.some(h=>h.steps.length>1),'returned child wrapper needs its own render membership');
 assert.equal(readFileSync(path.join(repo,filename)).equals(before),true);
 // Retain internally consistent replacement archives to exercise source-bound
 // membership checks, not just a convenient mismatched digest rejection.
 const mutate=(change:(copy:ReactJsxHelperObservation)=>void)=>{
  const copy=structuredClone(helper);change(copy);const overrides=new Map<string,Buffer>();
  const put=(name:string,value:unknown)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');overrides.set(name,b);return evidenceSha(b);};
  copy.evidence!.runtimeSha256=put('runtime.json',copy.runtime);put('report.json',copy);
  return {...options,helper:copy,read:(name:string)=>overrides.get(name)??options.read(name)};
 };
 const missing=mutate(copy=>{if(copy.runtime?.status!=='observed')return;const runtime=copy.runtime,rootRender=runtime.authoredFunctions!.calls[0].render.start;runtime.authoredFunctions!.calls=runtime.authoredFunctions!.calls.filter(c=>c.render.start===rootRender);});
 assert.throws(()=>readReactAuthoredContent(missing),/function-(inner|root)-origin-unproved/);
 const unknown=structuredClone(row.ownership!);unknown.components.push({id:'foreign',source:{module:'foreign.js',exportName:'Foreign',sourceSha256:'0'.repeat(64),span:{start:0,end:1}},parent:unknown.components[0].id,props:{},roots:['0']});
 const copy=structuredClone(helper),overrides=new Map<string,Buffer>();
 const put=(name:string,value:unknown)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');overrides.set(name,b);return evidenceSha(b);};
 const recorded=JSON.parse(options.read('ownership.json').toString());recorded.components=unknown.components;
 copy.evidence!.ownershipSha256=put('ownership.json',recorded);copy.evidence!.pairedOwnershipSha256=put('paired-ownership.json',unknown);put('report.json',copy);
 assert.throws(()=>readReactAuthoredContent({...options,ownership:unknown,helper:copy,read:(name:string)=>overrides.get(name)??options.read(name)}),/function-boundary-source-unproved/);
 succeeded=true;
});
