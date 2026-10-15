import {reactOwnershipEngine} from './react-ownership-run.js';
import {reactInitialReobservable,type ReactInitialInspection} from './react-initial-inspection.js';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readReactAuthoredFunctions,instrumentReactAuthoredFunctions,authoredFunctionKey} from './react-authored-functions.js';
import {prepareReactJsxLookupBundle} from './react-jsx-lookup.js';
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
function fixture(t:test.TestContext,text:string){
 const dir=realpathSync(mkdtempSync(path.join(tmpdir(),'authored-function-source-'))),file=path.join(dir,'source.js');
 t.after(()=>rmSync(dir,{recursive:true,force:true}));writeFileSync(file,text);
 return {text,file,reference:{sourceRoot:dir,files:{[file]:sha(text)}}};
}
test('default const arrow and named function exports preserve source bodies and local identity',t=>{
 for(const declaration of ['const Control = props => privateHelper(props); export default Control;','export default function Control(props){return privateHelper(props);}']){
  const text='const Local = ({children}) => children;\n'+declaration,f=fixture(t,text);
  const plans=readReactAuthoredFunctions(f.reference,[{module:'source.js',exportName:'default'}]);
  assert.equal(plans.length,2);assert.equal(plans.filter(p=>p.target).length,1);assert.equal(plans[0].binding,'Local');assert.equal(plans[0].target,undefined);
  const output=instrumentReactAuthoredFunctions(text,'source.js',plans);
  for(const plan of plans)assert(output.includes(text.slice(plan.render.start,plan.render.end)),'original body remains byte present');
  const proof=prepareReactJsxLookupBundle(output,{kind:'jsx-component',boundaryOnly:true,models:[],targets:[],authoredFunctions:plans}).proof;
  assert.deepEqual(proof.authoredFunctions,plans.map(authoredFunctionKey));assert.equal(readFileSync(f.file,'utf8'),text);
 }
});
test('function bindings require direct source and unchanged lexical ownership',t=>{
 for(const text of ['export default makeComponent();','const NotAComponent=42;export default NotAComponent;','export default async function Control(){return null;}','export default function* Control(){yield null;}']){
  const f=fixture(t,text);assert.throws(()=>readReactAuthoredFunctions(f.reference,[{module:'source.js',exportName:'default'}]),/authored-function-/);
 }
 const f=fixture(t,'let Control = props => props.children; export default Control;');
 const plans=readReactAuthoredFunctions(f.reference,[{module:'source.js',exportName:'default'}]);
 const output=instrumentReactAuthoredFunctions(f.text,'source.js',plans),plan={kind:'jsx-component' as const,boundaryOnly:true as const,models:[],targets:[],authoredFunctions:plans};
 assert.throws(()=>instrumentReactAuthoredFunctions(f.text+' ','source.js',plans),/source-changed/);
 for(const extra of ['Control = new Proxy(Control,{});','({x:Control}={x:other});','Control++;','eval("Control=other");'])assert.throws(()=>prepareReactJsxLookupBundle(output+extra,plan),/authored-function-/);
 const key=authoredFunctionKey(plans[0]);
 assert.throws(()=>prepareReactJsxLookupBundle(output.replace('()=>Control','()=>Other'),plan),{message:'jsx-lookup-binding-unresolved-or-ambiguous'});
 assert.throws(()=>prepareReactJsxLookupBundle('const Other = props => props.children;\n'+output.replace('()=>Control','()=>Other'),plan),{message:'jsx-lookup-authored-function-literal-unproved'});
 assert.throws(()=>prepareReactJsxLookupBundle(output.replace(JSON.stringify(key),JSON.stringify('foreign')),plan),/authored-function-/);
});


test('plain function source and runtime bytes participate in sealed observer identity',()=>{
 const engine=reactOwnershipEngine(),dir=path.dirname(fileURLToPath(import.meta.url));
 for(const file of ['react-authored-functions.ts','react-authored-function-runtime.ts']){
  assert.equal(engine[file],sha(readFileSync(path.join(dir,file),'utf8')),file+' must pin its actual source bytes');
  const previous={...engine};delete previous[file];
  const report:ReactInitialInspection={id:'saved',caseId:'control',phase:'complete',sourceUnchanged:true,problems:[],observer:previous};
  assert.equal(reactInitialReobservable(report,engine),'observer-changed','an archive lacking '+file+' cannot keep current observer identity');
  assert.equal(reactInitialReobservable({...report,observer:{...engine,[file]:'0'.repeat(64)}},engine),'observer-changed','changed '+file+' invalidates the recorded identity');
  assert.equal(reactInitialReobservable({...report,observer:engine},engine),undefined,'unchanged source remains stable');
 }
});
