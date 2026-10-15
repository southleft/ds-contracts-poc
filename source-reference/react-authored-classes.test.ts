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
