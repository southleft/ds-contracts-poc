import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {readReactCompiledContent} from './react-compiled-content.js';
import {readReactElementCreationSites} from './react-element-creation.js';
import {readReactChildren} from './react-children.js';

function fixture(t:test.TestContext,body:string){
  const root=realpathSync(mkdtempSync(path.join(tmpdir(),'compiled-content-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'source.mjs'),text=`import {jsx} from 'react/jsx-runtime';\n${body}`;writeFileSync(file,text);
  const sha=createHash('sha256').update(text).digest('hex'),reference={sourceRoot:root,files:{[file]:sha}};
  const sites=readReactElementCreationSites(text,file,'source.mjs');return {reference,file,text,sites,result:()=>readReactCompiledContent(reference,sites[0])};
}
function children(result:ReturnType<typeof readReactCompiledContent>){assert.equal(result.status,'read',result.status==='refused'?result.reason:'');if(result.status!=='read')throw Error('unreachable');return result.children;}

test('reads compiled rest-prop forwarding in a factory-created closure without evaluating the module',t=>{
  const f=fixture(t,`throw Error('must not execute');const values=['button','span'].map(tag=>unknownWrapper((props,ref)=>{const {asChild,...rest}=props;const Comp=asChild?Slot:tag;return jsx(Comp,{...rest,ref});}));`);
  const result=f.result();assert.equal(result.acceptedContract,null);assert.equal(result.runtimeVerified,false);assert.equal(result.qualification,'compiled-source-flow-only');
  assert.equal(children(result).kind,'forwarded');assert.equal(children(result).via,'spread');
  assert.equal(readFileSync(f.file,'utf8'),f.text);
});

test('compiled object property order and shorthand values preserve or replace content explicitly',t=>{
  for(const [body,kind] of [
    ['props=>jsx("button",{...props})','forwarded'],
    ['({children,...rest})=>jsx("button",{...rest,children})','forwarded'],
    ['props=>{const {children:content,...rest}=props;return jsx("button",{...rest,children:content});}','forwarded'],
    ['props=>jsx("button",{...props,children:"changed"})','replaced'],
    ['props=>jsx("button",{children:"changed",...props})','forwarded'],
    ['({children,...rest})=>jsx("button",{...rest})','absent'],
    ['props=>jsx("button",{...props,...unknown})','unresolved'],
    ['props=>jsx("button",{...unknown,...props})','unresolved'],
  ]){const f=fixture(t,`export const C=${body};`);assert.equal(children(f.result()).kind,kind,body);}
});

test('mutation, opaque sibling effects, escaped shorthand and competing returns do not prove forwarding',t=>{
  for(const body of [
    'props=>{props.children="changed";return jsx("button",{...props});}',
    'props=>{const {other,...rest}=props;other();return jsx("button",{...rest});}',
    'props=>{const {other,...rest}=props;const target=String(other);return jsx(target,{...rest});}',
    'props=>{const {children,...rest}=props;unknown({children});return jsx("button",{...rest,children});}',
    'props=>{unknown({props});return jsx("button",{...props});}',
    'props=>{const {other,...rest}=props;unknown({other});return jsx("button",{...rest});}',
    'props=>{const {other,...rest}=props;const target=other.value;return jsx(target,{...rest});}',
    'props=>{if(flag)return null;return jsx("button",{...props});}',
    'props=>{const copy={...props};delete copy.children;return jsx("button",{...copy});}',
    'props=>jsx("button",{...props,get extra(){return props.children;}})',
    'props=>jsx("button",{...props,[unknown]:123})',
    'props=>jsx("button",{...props,__proto__:unknown})',
    'props=>jsx("button",helper(props))',
  ]){const f=fixture(t,`export const C=${body};`);assert.equal(children(f.result()).kind,'unresolved',body);}
});

test('current source hash and rebound call/function spans are required, not supplied factory labels',t=>{
  const f=fixture(t,'export const C=props=>jsx("button",{...props});');
  assert.equal(readReactCompiledContent(f.reference,{...f.sites[0],factory:'jsxs'}).status,'refused');
  assert.equal(readReactCompiledContent(f.reference,{...f.sites[0],span:{start:0,end:1}}).status,'refused');
  assert.equal(readReactCompiledContent(f.reference,{...f.sites[0],functionSpan:{start:0,end:1}}).status,'refused');
  assert.equal(readReactCompiledContent({...f.reference,files:{}},f.sites[0]).status,'refused');
  writeFileSync(f.file,f.text+'\n// source changed');assert.equal(f.result().status,'refused');
});

test('unreturned calls, async functions, generators and default/rest inputs stay unmodeled',t=>{
  for(const body of [
    'function C(props){const value=jsx("button",{...props});return value;}',
    'async function C(props){return jsx("button",{...props});}',
    'function* C(props){return jsx("button",{...props});}',
    'function C(props={}){return jsx("button",{...props});}',
    'function C(...props){return jsx("button",{...props});}',
  ]){const f=fixture(t,body);assert.equal(f.result().status,'refused',body);}
});

test('the JSX reader keeps old alias policy and now detects shorthand escapes in returned-input flows',()=>{
  const text=`function C(props:{children:unknown}){const {children,...rest}=props;unknown({children});return <button {...rest}>{children}</button>;}
function Other(props:any){return jsx('button',{...props});}`;
  const file='/fixture.tsx',sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=> '/',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const program=ts.createProgram([file],{noLib:true},host),checker=program.getTypeChecker();
  const fn=sf.statements[0] as ts.FunctionDeclaration,ret=fn.body!.statements.at(-1) as ts.ReturnStatement;
  assert.deepEqual(readReactChildren(fn,ret.expression as ts.JsxElement,checker,true),{kind:'unresolved',reason:'children-input-escape-or-mutation'});
  const other=sf.statements[1] as ts.FunctionDeclaration,call=(other.body!.statements[0] as ts.ReturnStatement).expression as ts.CallExpression;
  assert.deepEqual(readReactChildren(other,call,checker,true),{kind:'unresolved',reason:'children-call-factory-unproved'});
});
