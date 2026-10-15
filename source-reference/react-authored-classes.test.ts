import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {readReactAuthoredClasses,instrumentReactAuthoredClasses} from './react-authored-classes.js';

function fixture(text:string,run:(reference:{sourceRoot:string;files:Record<string,string>})=>void){
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'dsc-authored-class-'))),file=path.join(root,'component.js');
 try{writeFileSync(file,text);run({sourceRoot:root,files:{[file]:createHash('sha256').update(text).digest('hex')}});}finally{rmSync(root,{recursive:true,force:true});}
}
test('static class source plan preserves unresolved private bodies and original method bytes',()=>{
 const text=`import React from 'react';export default class Button extends React.PureComponent{render(){return privateHelper(this.props);}}`;
 fixture(text,reference=>{const [plan]=readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]);
  assert.equal(plan.effectsVerified,false);assert.equal(plan.constructorSource,undefined);assert.equal(plan.target.declarationKind,'ClassDeclaration');
  const transformed=instrumentReactAuthoredClasses(text,'component.js',[plan]);assert(transformed.startsWith(text));assert.match(transformed,/authoredClassRegister/);
  assert.equal(transformed.slice(plan.render.start,plan.render.end),text.slice(plan.render.start,plan.render.end));
 });
});
test('static class plans reject constructor substitution, non-React bases, and changed source',()=>{
 for(const text of [
  `import React from 'react';export default class Button extends React.Component{constructor(p){super(p);return new Proxy(this,{});}render(){return helper();}}`,
  `class Base{};export default class Button extends Base{render(){return helper();}}`,
  `import React from 'react';export default class Button extends React.Component{get render(){return helper;}}`,
 ])fixture(text,reference=>assert.throws(()=>readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]),/authored-class-/));
 const text=`import React from 'react';export default class Button extends React.Component{constructor(p){super(p);}render(){return helper(this.props);}}`;
 fixture(text,reference=>{const plan=readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]);assert(plan[0].constructorSource);assert.throws(()=>instrumentReactAuthoredClasses(text+';','component.js',plan),/source-changed/);});
});

test('plain constructor state initialization preserves original body and static scope',()=>{
 const text=`import {Component} from 'react';export default class Meter extends Component{constructor(input){super(input);this._mounted=true;this._mounted=true;this.state={percentNumber:this.props.percent,labels:{enabled:true,title:'value',offset:-1}};}render(){return privateHelper(this.state);}}`;
 fixture(text,reference=>{
  const [plan]=readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]);
  assert.equal(plan.effectsVerified,false);assert.equal(plan.qualification,'original-class-render-boundary-only');
  assert(plan.constructorSource);const transformed=instrumentReactAuthoredClasses(text,'component.js',[plan]);
  assert.equal(transformed.slice(plan.constructorSource.start,plan.constructorSource.end),text.slice(plan.constructorSource.start,plan.constructorSource.end));
  assert.equal(transformed.slice(plan.render.start,plan.render.end),text.slice(plan.render.start,plan.render.end));
 });
 const legacy=`import React from 'react';export default class Meter extends React.PureComponent{constructor(){var input=arguments.length>0&&arguments[0]!==undefined?arguments[0]:{};super(input);}render(){return helper();}}`;
 fixture(legacy,reference=>assert(readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}])[0].constructorSource));
});

test('constructor initialization refuses replacement, accessors, calls and prototype-sensitive writes',()=>{
 const bodies=[
  'super(input);this.state={percentNumber:0};return new Proxy(this,{});',
  'super(input);if(false)return {};this.state={percentNumber:0};',
  'try{super(input);this.state={percentNumber:0};}finally{return {};}',
  'super(input);return;',
  'super(input);this.state={get percentNumber(){throw Error("getter");}};',
  'super(input);this.state={...input};',
  'super(input);this.state={__proto__:input};',
  'super(input);this.state={value:0,value:1};',
  'super(input);this.state={[input.name]:1};',
  'super(input);this.state={value:read(input)};',
  'super(input);this.state=new Object();',
  'super(input);this.state={value:input.percent};',
  'super(input);this.state={value:this.props["percent"]};',
  'super(input);this.state={value:this.props?.percent};',
  'super(input);this.state={value:this.props.constructor};',
  'super(input);this.state={value:1e400};',
  'super(input);this["state"]={value:1};',
  'super(input);this.__proto__=input;',
  'super(input);this.prototype={};',
  'super(input);this.constructor=input;',
  'super(input);this.props=input;',
  'super(input);this.render=input;',
  'super(input);this.updater={};',
  'super(input);this.setState={};',
  'super(input);this.__DSC_STATE={};',
  'super(input);this.state.value=1;',
  'super(input);this._mounted+=1;',
  'super({...input});this.state={value:1};',
 ];
 for(const body of bodies){const text=`import React from 'react';export default class Meter extends React.Component{constructor(input){${body}}render(){return helper();}}`;
  fixture(text,reference=>assert.throws(()=>readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]),/authored-class-construction-or-render-unmodeled/,body));
 }
 for(const param of ['input={}','...input','{percent}','public input','@decorate input']){
  const text=`import React from 'react';export default class Meter extends React.Component{constructor(${param}){super(input);this.state={value:1};}render(){return helper();}}`;
  fixture(text,reference=>assert.throws(()=>readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]),/authored-class-/));
 }
});

test('constructor initialization budgets reject unbounded object trees and statement lists',()=>{
 const bodies=[
  'super(input);'+Array.from({length:65},(_,i)=>`this.field${i}=true;`).join(''),
  'super(input);this.state={'+Array.from({length:65},(_,i)=>`field${i}:true`).join(',')+'};',
  'super(input);this.state={a:{a:{a:{a:{a:true}}}}};',
 ];
 for(const body of bodies)fixture(`import React from 'react';export default class Meter extends React.Component{constructor(input){${body}}render(){return helper();}}`,
  reference=>assert.throws(()=>readReactAuthoredClasses(reference,[{module:'component.js',exportName:'default'}]),/authored-class-construction-or-render-unmodeled/));
});
