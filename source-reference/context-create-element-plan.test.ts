import test from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync,mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {planReactContextFactoryCalls} from './react-context-calls.js';
import type {ReactHelperReference} from './react-helper-effects.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function plan(text:string){const root=realpathSync(mkdtempSync(path.join(tmpdir(),'factory-plan-')));try{const file=path.join(root,'fixture.js');writeFileSync(file,text);const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let render:ts.ArrowFunction|undefined;function visit(n:ts.Node){if(ts.isArrowFunction(n)&&!render)render=n;ts.forEachChild(n,visit);}visit(sf);assert(render);const reference={sourceRoot:root,files:{[file]:sha(text)}} as ReactHelperReference,initializer={render:{file:'fixture.js',sha256:sha(text),start:render.getStart(sf),end:render.end}} as ReactTargetInitializer;return planReactContextFactoryCalls(reference,[initializer]);}finally{rmSync(root,{recursive:true,force:true});}}
for(const [name,imports,call] of [['named','import {createElement as h} from "react";','h'],['namespace','import * as React from "react";','React.createElement'],['default','import React from "react";','React.createElement']])test(name+' original createElement argument spans',()=>{const text=imports+`export const C=(props)=>${call}('button',{...props,key:'x'},null,'label');`;const rows=plan(text);assert.equal(rows.length,1);assert.equal(rows[0].factory,'createElement');assert.deepEqual(rows[0].arguments.map(a=>text.slice(a.start,a.end)),["'button'","{...props,key:'x'}","null","'label'"]);assert.equal(text.slice(rows[0].callee.start,rows[0].callee.end),call);});
for(const [name,text] of [
 ['shadowed','import * as React from "react";export const C=(React)=>React.createElement("button",{});'],
 ['wrong module','import {createElement as h} from "other";export const C=(p)=>h("button",{});'],
 ['spread arguments','import * as React from "react";export const C=(p)=>React.createElement("button",{},...p.children);'],
 ['optional call','import * as React from "react";export const C=(p)=>React.createElement?.("button",{});'],
 ['nested deferred function','import * as React from "react";export const C=(p)=>()=>React.createElement("button",{});']
])test(name+' is not planned',()=>assert.equal(plan(text).length,0));
test('existing JSX factory retains third argument as its own argument',()=>{const text='import {jsx as h} from "react/jsx-runtime";export const C=(p)=>h("button",{children:p.children},"key");';const rows=plan(text);assert.equal(rows.length,1);assert.equal(rows[0].factory,'jsx');assert.equal(rows[0].arguments.length,3);});
