import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {revisionOf} from '../core/contract-provenance.js';
import {readReactAuthoredClasses} from './react-authored-classes.js';
import {readReactAuthoredContent,verifiedReactAuthoredContent} from './react-authored-content.js';
import {projectReactAuthoredTree} from './react-authored-tree.js';
import {verifyReactRenderGraph} from './react-render-graph.js';

/** Host-owned archive fixture with two same-source/same-scalar class calls.
 * Their only semantic difference is the identity of the style record. */
function fixture(t:test.TestContext,selected=0,marker:'valid'|'missing'|'other'|'stale'='valid',className=''){
 const dir=realpathSync(mkdtempSync(path.join(tmpdir(),'authored-empty-style-')));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'surface.tsx'),text="import {Component} from 'react'; export class Meter extends Component {render(){return null;}}";
 writeFileSync(file,text);const hash=createHash('sha256').update(text).digest('hex');
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),node=sf.statements.find(ts.isClassDeclaration)!;
 const source={module:'surface.tsx',exportName:'Meter',sourceSha256:hash,span:{start:node.getStart(sf),end:node.end}};
 const program:any={version:1,status:'refused',problems:[],sourceRoot:dir,files:{[file]:hash},components:[{...source,problems:['runtime-export-binding-only']}]};
 const plans=readReactAuthoredClasses({sourceRoot:dir,files:program.files},[source]);assert.equal(plans.length,1);
 const object=(identity:number)=>({kind:'object',identity}),fn=(identity:number)=>({kind:'function',identity}),str=(value:string)=>({kind:'string',value}),undef={kind:'undefined'};
 const factories=[0,1].flatMap(i=>[{id:i*2,element:object(100+i*10),props:object(101+i*10),type:fn(1),createdIn:null,current:true,children:{status:'verified',value:undef}},
  {id:i*2+1,element:object(102+i*10),props:object(103+i*10),type:str('section'),createdIn:i,current:true,children:{status:'verified',value:undef}}]);
 const graph:any={qualification:'original-element-and-render-identity-only',effectsVerified:false,acceptedContract:null,factories,arrays:[],renders:[0,1].map(i=>({id:i,parent:null,callee:fn(1),input:object(101+i*10),factoryProps:object(101+i*10),factory:i*2,completion:'returned',output:object(102+i*10),returnedFactory:i*2+1,sourceRender:null,componentModels:[],membership:{status:'verified',factories:[i*2+1],arrays:[]}}))};
 const props={percent:80,style:{kind:'object'},className};
 const ownership:any={version:1,rendererVersions:['19.2.7'],problems:[],components:[{id:'instance-0',source,props,roots:['']}],nodes:[{path:'',tag:'section',nearestComponent:'instance-0',createdBy:'instance-0'}]};
 const recorded=structuredClone(ownership),host=factories[selected*2+1];recorded.nodes[0].renderGraph={status:'matched',factory:host.id,element:host.element,props:host.props,type:host.type};
 const calls=[0,1].map(i=>{const fields:any=[['percent',{kind:'number',value:80}],['style',object(50+i)],['className',str(className)]];
  return {id:i,target:plans[0].target,render:plans[0].render,graphRender:i,construction:i,resolver:i,input:object(101+i*10),factoryProps:object(101+i*10),fields,factoryFields:fields,output:object(102+i*10),completion:'returned',current:true,effectsVerified:false,
   ...(i===0&&marker!=='missing'?{emptyFactoryStyle:{value:object(marker==='other'?51:50),current:marker!=='stale'}}:{})};});
 const runtime:any={status:'observed',authoredClasses:{qualification:'original-class-render-boundary-only',acceptedContract:null,effectsVerified:false,registered:1,constructions:[],resolvers:[],calls},renderGraph:graph};
 const consumers:any={rows:[]},proof=verifyReactRenderGraph(recorded,runtime,consumers);assert(proof.rows.every(r=>r.status==='linked'));
 const tree:any={tag:'section',classes:[],pseudo:{},nodes:[],style:{display:'flex','flex-direction':'row',position:'static',width:'100px',height:'10px','background-color':'rgb(255, 255, 255)','box-sizing':'border-box',opacity:'1'}};
 const plan:any={kind:'jsx-component',boundaryOnly:true,models:[],targets:[],authoredClasses:plans};
 const files=new Map<string,Buffer>(),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const put=(name:string,value:unknown)=>{const b=Buffer.from(JSON.stringify(value));files.set(name,b);return sha(b);};
 const original=Buffer.from('original observed bundle'),guarded=Buffer.from('guarded observed bundle'),png=Buffer.from('original image');
 files.set('guarded.js',original);files.set('lookup-guarded.js',guarded);files.set('observed.png',png);
 const lookup={status:'verified',sourceJavascriptSha256:sha(original),javascriptSha256:sha(guarded)};put('lookup.json',lookup);
 const evidence={modelSha256:put('model.json',plan),planSha256:put('plan.json',plan),runtimeSha256:put('runtime.json',runtime),ownershipSha256:put('ownership.json',recorded),pairedOwnershipSha256:put('paired-ownership.json',ownership),
  buildSha256:put('build.json',{referenceId:'reference',guardedReferenceId:'guarded',inputs:program.files,guardedJavascript:sha(guarded)}),contextConsumersSha256:put('context-consumers.json',consumers),renderGraphSha256:put('render-graph.json',proof),treeSha256:sha(Buffer.from(JSON.stringify(tree))),pngSha256:sha(png)};
 put('tree.json',{status:'captured',problems:[],tree,treeSha256:evidence.treeSha256,sourcePngSha256:evidence.pngSha256});
 const helper:any={version:1,status:'observed',qualification:'original-jsx-helper-state-only',acceptedContract:null,effectsVerified:false,inputs:program.files,evidence,runtime,lookup,contextConsumers:consumers,renderGraph:proof};put('report.json',helper);
 const content=readReactAuthoredContent({referenceId:'reference',sourceRoot:dir,program,ownership,tree,helper,read:name=>{const b=files.get(name);assert(b);return b;}});
 const fonts:any={version:1,status:'observed',treeRevision:revisionOf(tree),problems:[],rows:[]};
 const origin:any={version:1,roots:[{path:'',tag:'section',channels:[],sizes:[{channel:'width',status:'fixed',value:'100px',selectors:['section']},{channel:'height',status:'fixed',value:'10px',selectors:['section']}]}]};
 return {content,program,ownership,tree,fonts,origin};
}

test('exact selected empty class style reaches ordinary tree projection without qualifying effects',t=>{
 const f=fixture(t),fact=verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree);
 assert.equal(fact.render,0);assert.equal(fact.emptyCallerStyle,true);assert.equal(fact.effectsVerified,false);
 const draft=projectReactAuthoredTree(f);assert.equal(draft.status,'native-compiled');assert.deepEqual(draft.problems,[]);assert.equal(draft.acceptedContract,null);
});

test('same serialized props in another render cannot borrow the first class call empty style',t=>{
 const f=fixture(t,1),fact=verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree);
 assert.equal(fact.render,1);assert.equal(fact.emptyCallerStyle,undefined);
 assert.deepEqual(projectReactAuthoredTree(f).problems,['react-authored-tree-caller-style-unqualified']);
});

for(const marker of ['missing','other','stale'] as const)test('empty caller style requires matching current witness: '+marker,t=>{
 const f=fixture(t,0,marker);assert.equal(verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree).emptyCallerStyle,undefined);
 assert.deepEqual(projectReactAuthoredTree(f).problems,['react-authored-tree-caller-style-unqualified']);
});

test('empty style does not relax nonempty caller className',t=>{
 const f=fixture(t,0,'valid','external');assert.equal(verifiedReactAuthoredContent(f.content,f.program,f.ownership,f.tree).emptyCallerStyle,true);
 assert.deepEqual(projectReactAuthoredTree(f).problems,['react-authored-tree-caller-style-unqualified']);
});
