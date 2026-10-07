import test from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';
import {readReactRuntimeRoot} from './react-runtime-root.js';
test('compiled root facts retain conditional host branches without selecting an opaque branch',()=>{
 for(const [body,kind] of [
  ["const tag=props.asChild?Unknown:'span';return React.createElement(tag,props);",'conditional'],
  ["const tag='span';return React.createElement(tag,props);",'host'],
  ["let tag='span';return React.createElement(tag,props);",'unresolved'],
  ["if(props.other)return null;return React.createElement('span',props);",'unresolved'],
  ["const React=props.fake;return React.createElement('span',props);",'unresolved'],
  ["return React.createElement();",'unresolved'],
 ] as const){
  const file='/fixture.js',text=`import * as React from 'react';export const Component=React.forwardRef((props,ref)=>{${body}});`;
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=> '/',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?text:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host),checker=program.getTypeChecker();let fn:ts.ArrowFunction|undefined;
  const find=(n:ts.Node)=>{if(ts.isArrowFunction(n))fn=n;ts.forEachChild(n,find);};find(sf);
  const root=readReactRuntimeRoot(fn!,checker,'fixture.js');assert.equal(root.kind,kind);
  if(root.kind==='conditional'){assert.equal(root.whenTrue?.kind,'unresolved');assert.deepEqual(root.whenFalse,{kind:'host',name:'span'});}
 }
});
