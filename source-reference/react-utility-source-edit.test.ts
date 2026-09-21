import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';

function identity(text:string,name='Control') {
  const file=ts.createSourceFile('control.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let span:{start:number;end:number}|undefined;
  const find=(node:ts.Node)=>{
    if((ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node))&&node.name?.getText(file)===name)
      span={start:node.getStart(file),end:node.end};
    ts.forEachChild(node,find);
  };
  find(file);assert.ok(span);
  return {module:'control.tsx',exportName:name,span,sourceSha256:createHash('sha256').update(text).digest('hex')};
}

test('root candidates preserve every other byte and do not guess between same-value utilities',()=>{
  const text=`const note = "disabled:opacity-50";
export function Control({ className, ...props }) {
  return <Root className={cn("group-has-disabled/field:opacity-50 disabled:opacity-50 opacity-100", className)} {...props}>
    <span className="disabled:opacity-50">Keep me</span>
  </Root>;
}
export const Elsewhere = () => <div className="disabled:opacity-50"/>;`;
  const candidates=proposeReactOpacityUtilityEdits(text,identity(text),{before:0.5,after:Math.fround(0.6)});
  assert.equal(candidates.length,2,'a staged all-case comparison must select the unique effect');
  assert.deepEqual(candidates.map(c=>[c.edit.before,c.edit.after]),[
    ['group-has-disabled/field:opacity-50','group-has-disabled/field:opacity-60'],['disabled:opacity-50','disabled:opacity-60']]);
  for(const c of candidates) {
    assert.equal(c.result.slice(0,c.edit.start),text.slice(0,c.edit.start));
    assert.equal(c.result.slice(c.edit.start+c.edit.after.length),text.slice(c.edit.end));
    assert.equal(c.qualification,'unverified-source-candidate');assert.ok(c.limitations.includes('source-write-not-authorized'));
    assert.match(c.result,/<span className="disabled:opacity-50">/);
    assert.match(c.result,/Elsewhere = \(\) => <div className="disabled:opacity-50"/);
  }
});

test('a source candidate preserves selector prefixes and exact nonpercentage opacity values',()=>{
  const text='export const Control = ({disabled}) => (<div className="data-[state=on]:opacity-[0.5]"/>);';
  const [candidate]=proposeReactOpacityUtilityEdits(text,identity(text),{before:0.5,after:0.123456});
  assert.equal(candidate.edit.after,'data-[state=on]:opacity-[0.123456]');
  assert.equal(proposeReactOpacityUtilityEdits(candidate.result,identity(candidate.result),{before:0.123456,after:0.5})[0].edit.after,
    'data-[state=on]:opacity-50');
});

test('changed source, wrong spans, nested children and ambiguous execution shapes are refused',()=>{
  const text='export const Control = () => <div className="opacity-50"/>;',source=identity(text);
  assert.throws(()=>proposeReactOpacityUtilityEdits(text+'\n',source,{before:0.5,after:0.6}),/source-changed/);
  assert.throws(()=>proposeReactOpacityUtilityEdits(text,{...source,span:{start:0,end:1}},{before:0.5,after:0.6}),/declaration-unavailable/);
  for(const after of [NaN,Infinity,-0.1,1.1,Math.fround(0.5)])
    assert.throws(()=>proposeReactOpacityUtilityEdits(text,source,{before:0.5,after}),/opacity-change-invalid/);
  for(const body of [
    '<div><span className="opacity-50"/></div>',
    '<div className={deferred(()=>"opacity-50")}/>',
    '<div className={`opacity-${50}`}/>',
    '<div className={"opacity-\\u0035\\u0030"}/>',
    '<div className="opacity-100"/>',
  ]) {
    const other='export const Control = () => '+body+';';
    assert.throws(()=>proposeReactOpacityUtilityEdits(other,identity(other),{before:0.5,after:0.6}),/class-unavailable|opacity-utility-unavailable/);
  }
  const conditional='export function Control(p) { if(p.x) return <i/>; return <div className="opacity-50"/>; }';
  assert.throws(()=>proposeReactOpacityUtilityEdits(conditional,identity(conditional),{before:0.5,after:0.6}),/conditional-root-unsupported/);
});
