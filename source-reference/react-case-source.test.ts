import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {builtinReactCohort,parseReactCases,type ReactCaseElement} from './react-cohort.js';
import {reactCaseRootOwner,reactResolvedInitialCaseEntry} from './react-case-source.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import type {ReactReference} from './react-reference.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';

type Source=ReactOwnership['components'][number]['source'];
const sha=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const publicMount=(module='@test/kit-a'):ReactCaseElement=>({module,export:'Avatar',props:{tone:'quiet'},children:['Original']});
function fixture(t:test.TestContext,mounts:ReactCaseElement[]=[publicMount()]){
  const sourceRoot=realpathSync(mkdtempSync(path.join(tmpdir(),'react-case-source-')));
  t.after(()=>rmSync(sourceRoot,{recursive:true,force:true}));
  const sources:Record<string,string>={
    'node_modules/@test/kit-a/index.js':'export {default as Avatar} from "./avatar.js";',
    'node_modules/@test/kit-a/avatar.js':'export default function AvatarA(props){ return props.children; }',
    'node_modules/@test/kit-b/index.js':'export {default as Avatar} from "./avatar.js";',
    'node_modules/@test/kit-b/avatar.js':'export default function AvatarB(props){ return props.children; }',
    'src/control.js':'export function Avatar(props){ return props.children; }',
  };
  const files:Record<string,string>={};
  for(const [file,text] of Object.entries(sources)){
    const absolute=path.join(sourceRoot,file);mkdirSync(path.dirname(absolute),{recursive:true});writeFileSync(absolute,text);files[absolute]=sha(text);
  }
  const declaration={version:1,source:'Case-local public API',theme:'Original',fontFamily:'Arial',requiredTokens:{'--original':'red'},
    witnessFiles:Object.fromEntries(Object.entries(sources).map(([name,text])=>[name,sha(text)])),
    cases:mounts.map((mount,i)=>({id:'case-'+['one','two'][i],subject:'Avatar',label:'Original '+i,negativeControl:i===0,mount,
      witness:{path:['#subject'],requiredStyles:{display:'inline'}}}))};
  const file=path.join(sourceRoot,'ds-contracts.react.json');writeFileSync(file,JSON.stringify(declaration));files[file]=sha(readFileSync(file));
  const cohort=parseReactCases(readFileSync(file),file);
  const runtimeEntryImports=[...['a','b'].map(name=>({specifier:'@test/kit-'+name,file:path.join(sourceRoot,`node_modules/@test/kit-${name}/index.js`)})),
    {specifier:'./src/control',file:path.join(sourceRoot,'src/control.js')}];
  const runtimeImports=['a','b'].map(name=>({importer:path.join(sourceRoot,`node_modules/@test/kit-${name}/index.js`),specifier:'./avatar.js',file:path.join(sourceRoot,`node_modules/@test/kit-${name}/avatar.js`)}));
  const reference:ReactReference={id:'fixture',javascript:'',css:'',sourceRoot,files,cohort,runtimeEntryImports,runtimeImports};
  const identity=(module='@test/kit-a'):Source=>{
    const entry=runtimeEntryImports.find(e=>e.specifier===module)!;
    const result=readReactRuntimeExport(reference,path.relative(sourceRoot,entry.file),['Avatar']);
    if(result.status!=='resolved')throw Error(result.reason);
    const {module:resolved,exportName,sourceSha256,span}=result.definition;return {module:resolved,exportName,sourceSha256,span};
  };
  return {reference,identity,file};
}
function program(...sources:Source[]):ReactSourceProgram{
  return {version:1,status:'observed',acceptedContract:null,typescriptVersion:'test',readerOptions:{},compatibilityNotes:[],files:{},problems:[],
    components:sources.map(source=>({...source,name:'Public label retained',implementation:'unresolved',props:[],
      root:{kind:'unresolved'},markers:[],defaults:{},forwardedProps:[],children:{kind:'unresolved'},componentReferences:[],problems:[]}))};
}
function ownership(source:Source):ReactOwnership{
  return {version:1,rendererVersions:['19.2.7'],problems:[],nodes:[],components:[{id:'instance-0',source,props:{tone:'quiet'},roots:['']}]};
}

test('a case-local barrel alias selects its exact default-export root and retains the public subject',t=>{
  const f=fixture(t),source=f.identity(),p=program(source),o=ownership(source);
  assert.equal(source.exportName,'default');
  assert.equal(reactCaseRootOwner(f.reference,p,'case-one',o),o.components[0]);
  assert.equal(f.reference.cohort.cases[0].subject,'Avatar');
  assert.equal(p.components[0].implementation,'unresolved','identity cannot grant source semantics');
});

test('two packages sharing Avatar cannot borrow another case or an ambiguous mount',t=>{
  const f=fixture(t,[publicMount(),publicMount('@test/kit-b')]),a=f.identity(),b=f.identity('@test/kit-b'),p=program(a,b);
  assert.equal(reactCaseRootOwner(f.reference,p,'case-one',ownership(a)).source.module,a.module);
  assert.equal(reactCaseRootOwner(f.reference,p,'case-two',ownership(b)).source.module,b.module);
  assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',ownership(b)),/subject-root-unmatched/);
  const ambiguous=fixture(t,[{tag:'div',children:[publicMount(),publicMount('@test/kit-b')]}]);
  assert.throws(()=>reactCaseRootOwner(ambiguous.reference,program(ambiguous.identity()),'case-one',ownership(ambiguous.identity())),/subject-mount-ambiguous/);
});

test('all source identity fields and a unique root/program definition are mandatory',t=>{
  const f=fixture(t),source=f.identity(),p=program(source);
  const changed:Source[]=[{...source,module:'another.js'},{...source,exportName:'Avatar'},
    {...source,sourceSha256:'0'.repeat(64)},{...source,span:{...source.span,start:source.span.start+1}},
    {...source,span:{...source.span,end:source.span.end+1}}];
  for(const value of changed)assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',ownership(value)),/subject-root-unmatched/);
  const duplicate=ownership(source);duplicate.components.push({...duplicate.components[0],id:'instance-1'});
  assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',duplicate),/subject-root-ambiguous/);
  const nested=ownership(source);nested.components[0].roots=['0'];
  assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',nested),/subject-root-unmatched/);
  assert.throws(()=>reactCaseRootOwner(f.reference,program(source,source),'case-one',ownership(source)),/program-identity/);
});

test('missing, ambiguous, rerouted or changed executable routes cannot establish subject identity',t=>{
  const f=fixture(t),source=f.identity(),p=program(source),o=ownership(source);
  assert.throws(()=>reactCaseRootOwner({...f.reference,runtimeEntryImports:[]},p,'case-one',o),/entry-edge-unwitnessed/);
  assert.throws(()=>reactCaseRootOwner({...f.reference,runtimeEntryImports:[...f.reference.runtimeEntryImports!,
    {specifier:'@test/kit-a',file:path.join(f.reference.sourceRoot,'src/control.js')}]},p,'case-one',o),/entry-edge-ambiguous/);
  assert.throws(()=>reactCaseRootOwner({...f.reference,runtimeImports:[]},p,'case-one',o),/edge-unwitnessed/);
  const rerouted={...f.reference,runtimeImports:f.reference.runtimeImports!.map(edge=>({...edge,file:path.join(f.reference.sourceRoot,'node_modules/@test/kit-b/avatar.js')}))};
  assert.throws(()=>reactCaseRootOwner(rerouted,p,'case-one',o),/subject-root-unmatched/);
  writeFileSync(path.join(f.reference.sourceRoot,source.module),'export default function AvatarA(){return null;}');
  assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',o),/source-not-witnessed-or-changed/);
});

test('changed declaration, mount entry or barrel bytes stay refused',t=>{
  const f=fixture(t),source=f.identity(),p=program(source),o=ownership(source);
  assert.throws(()=>reactCaseRootOwner({...f.reference,cohort:{...f.reference.cohort,entry:f.reference.cohort.entry+' '}},p,'case-one',o),/declaration-entry-changed/);
  const original=readFileSync(f.file);writeFileSync(f.file,Buffer.concat([original,Buffer.from(' ')]));
  assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',o),/declaration-changed/);
  writeFileSync(f.file,original);
  writeFileSync(f.reference.runtimeEntryImports![0].file,'export {default as Avatar} from "./other.js";');
  assert.throws(()=>reactCaseRootOwner(f.reference,p,'case-one',o),/source-not-witnessed-or-changed/);
});

test('authored initial derivation preserves the public import and exact canonical target across re-read',t=>{
  const f=fixture(t,[publicMount(),publicMount('@test/kit-b')]),source=f.identity(),before=readFileSync(f.file),entry=f.reference.cohort.entry;
  const changes={tone:{kind:'set' as const,value:'loud'}};
  const result=reactResolvedInitialCaseEntry(f.reference,'case-one',source,changes);
  assert.deepEqual(result.receipt.target,source);assert.equal(result.receipt.mountModule,'@test/kit-a');
  assert.deepEqual(result.receipt.before,{tone:'quiet'});assert.deepEqual(result.receipt.after,{tone:'loud'});
  assert(result.entry.includes('Avatar as __c0'));assert(result.entry.includes('from "@test/kit-a"'));
  assert.equal(result.entry.split('\n').find(line=>line.startsWith('["case-two",')),entry.split('\n').find(line=>line.startsWith('["case-two",')));
  assert.deepEqual(reactResolvedInitialCaseEntry(f.reference,'case-one',source,changes),result,'observe and sealed-read derivations are identical');
  assert.deepEqual(readFileSync(f.file),before);assert.equal(f.reference.cohort.entry,entry);
  assert.throws(()=>reactResolvedInitialCaseEntry(f.reference,'case-one',f.identity('@test/kit-b'),changes),/initial-mount-unmatched/);
});

test('repeated public occurrences have one source identity but cannot guess an initial-mutation target',t=>{
  const f=fixture(t,[{tag:'div',children:[publicMount(),publicMount()]}]),source=f.identity();
  assert.equal(reactCaseRootOwner(f.reference,program(source),'case-one',ownership(source)).id,'instance-0');
  assert.throws(()=>reactResolvedInitialCaseEntry(f.reference,'case-one',source,{tone:{kind:'set',value:'loud'}}),/initial-mount-ambiguous/);
});

test('direct workspace mounts and historical workspace exports retain exact root selection',t=>{
  const f=fixture(t,[{module:'./src/control',export:'Avatar',props:{tone:'quiet'}}]),source=f.identity('./src/control'),p=program(source),o=ownership(source);
  assert.equal(reactCaseRootOwner(f.reference,p,'case-one',o).id,'instance-0');
  const legacy={...f.reference,cohort:{...f.reference.cohort,declaration:undefined}};
  assert.equal(reactCaseRootOwner(legacy,p,'case-one',o).id,'instance-0');
  assert.equal(reactCaseRootOwner({...legacy,cohort:{...legacy.cohort,declared:false}},p,'case-one',o).id,'instance-0');
  const publicSource={...source,module:'node_modules/unwitnessed/index.js'};
  assert.throws(()=>reactCaseRootOwner(legacy,program(publicSource),'case-one',ownership(publicSource)),/subject-root-unmatched/);
});


test('declaration-free public aliases cannot borrow a workspace source or a relative entry edge',t=>{
  const f=fixture(t,[{module:'./src/control',export:'Avatar'}]),source=f.identity('./src/control'),p=program(source),o=ownership(source);
  const cohort={...f.reference.cohort,declaration:undefined};
  const publicEdge={specifier:'@test/workspace',file:path.join(f.reference.sourceRoot,source.module)};
  const publicReference={...f.reference,cohort:{...cohort,mountedModules:undefined,mountedExports:undefined},runtimeEntryImports:[publicEdge]};
  assert.throws(()=>reactCaseRootOwner(publicReference,p,'case-one',o),/declaration-required/);
  assert.throws(()=>reactCaseRootOwner({...publicReference,runtimeEntryImports:[publicEdge,{...publicEdge,specifier:'./src/control'}]},p,'case-one',o),/entry-edge-ambiguous/);
  assert.throws(()=>reactCaseRootOwner({...publicReference,runtimeEntryImports:[]},p,'case-one',o),/entry-edge-unwitnessed/);
  assert.throws(()=>reactCaseRootOwner({...publicReference,runtimeEntryImports:undefined},p,'case-one',o),/entry-edge-unwitnessed/);
  const publicMetadata={...f.reference,cohort:{...cohort,mountedModules:['@test/workspace'],mountedExports:[{module:'@test/workspace',export:'Avatar'}]}};
  assert.throws(()=>reactCaseRootOwner(publicMetadata,p,'case-one',o),/declaration-required/);
  const changed={...source,span:{...source.span,end:source.span.end+1}};
  assert.throws(()=>reactCaseRootOwner({...f.reference,cohort},program(changed),'case-one',ownership(changed)),/source-identity-changed/);
});

test('only exact built-in entry/cases retain the historical edge-free workspace path',t=>{
  const f=fixture(t),module='src/components/ui/button.tsx',file=path.join(f.reference.sourceRoot,module);
  const text='export function Button(props){return props.children;}';
  mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,text);
  const reference={...f.reference,cohort:builtinReactCohort,runtimeEntryImports:undefined,files:{...f.reference.files,[file]:sha(text)}};
  const resolved=readReactRuntimeExport(reference,module,['Button']);if(resolved.status!=='resolved')throw Error(resolved.reason);
  const {exportName,sourceSha256,span}=resolved.definition,source={module,exportName,sourceSha256,span},p=program(source),o=ownership(source);
  assert.equal(reactCaseRootOwner(reference,p,'button-default',o).id,'instance-0');
  assert.throws(()=>reactCaseRootOwner({...reference,cohort:{...builtinReactCohort,entry:builtinReactCohort.entry+' '}},p,'button-default',o),/entry-edge-unwitnessed/);
  assert.throws(()=>reactCaseRootOwner({...reference,cohort:{...builtinReactCohort,cases:builtinReactCohort.cases.slice(0,1)}},p,'button-default',o),/entry-edge-unwitnessed/);
  assert.throws(()=>reactCaseRootOwner({...reference,cohort:{...builtinReactCohort,mountedModules:['@test/workspace']}},p,'button-default',o),/declaration-required/);
  writeFileSync(file,text+' ');
  assert.throws(()=>reactCaseRootOwner(reference,p,'button-default',o),/source-not-witnessed-or-changed/);
});
