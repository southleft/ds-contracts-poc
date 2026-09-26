import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {reactElementCompositionRuntime} from './react-element-composition.js';
import {reactElementProvenanceRuntime} from './react-element-provenance.js';
import {readReactElementSourceCalls} from './react-element-source-call.js';
import {readReactElementCreationSites} from './react-element-creation.js';
import {readReactElementInvocationPlans,transformReactElementSource} from './react-element-invocation.js';

function probe(body:string){
  return JSON.parse(runInNewContext(`(()=>{
    const provenance=(${reactElementProvenanceRuntime})(true),elements=new WeakMap();
    const source={module:'fixture.mjs',sourceSha256:'pinned',span:{start:10,end:20}};
    const api=(${reactElementCompositionRuntime})([source],provenance,e=>elements.get(e));let serial=0;
    // Real React factory mechanics are covered by the integrated browser test.
    const factory=(props,kind='jsx',during)=>{
      const site={...source,span:{start:++serial,end:serial+1},factory:kind};
      const origin=provenance.before(provenance.literal(props),site),array=api.before(origin,props,site);
      const element={type:'div',props:{...props},key:null};
      if(during)during(props.children);
      provenance.after(origin,element);api.after(array,element);elements.set(element,{element,props:element.props,site});return element;
    };
    return JSON.stringify((()=>{${body}})());
  })()`));
}

test('unique exact membership traverses genuine elements and literal arrays, including sparse slots and the authenticated static freeze',()=>{
  const r=probe(`const target=factory({children:'Leaf'}),inner=api.array(0,[null,target,false]);
    const outer=api.array(0,[,inner,undefined]);const root=factory({children:outer},'jsxs',Object.freeze);
    const first=api.read(root,target),again=api.read(root,target),direct=api.read(target,target);
    return {first,again,direct,frozen:Object.isFrozen(outer)};`);
  assert.equal(r.first.status,'matched');assert.equal(r.first.qualification,'react-return-membership-only');
  assert.equal(r.first.effectsVerified,false);assert.equal(r.first.acceptedContract,null);assert.equal(r.frozen,true);
  assert.deepEqual(r.first,r.again);assert.deepEqual(r.first.path.map((p:{kind:string;index?:number})=>[p.kind,p.index??null]),[['children',null],['array-index',1],['array-index',1]]);
  assert.equal(r.first.path[1].factoryFreeze.factory,'jsxs');assert.equal(r.first.path[2].factoryFreeze,undefined);
  assert.equal(r.direct.status,'matched');assert.deepEqual(r.direct.path,[]);
});

test('unknown arrays, object lookalikes and proxies refuse before reflective reads, even beside a known matching branch',()=>{
  const r=probe(`let traps=0;const target=factory({});const known=api.array(0,[target]);
    const proxy=new Proxy(known,{get(){traps++;throw Error('get')},getPrototypeOf(){traps++;throw Error('proto')},ownKeys(){traps++;throw Error('keys')},getOwnPropertyDescriptor(){traps++;throw Error('descriptor')}});
    const proxyRoot=new Proxy(target,{get(){traps++;throw Error('get')},getPrototypeOf(){traps++;throw Error('proto')},ownKeys(){traps++;throw Error('keys')},getOwnPropertyDescriptor(){traps++;throw Error('descriptor')}});
    const values=[factory({children:[target]}),factory({children:proxy}),factory({children:{type:'div',props:{children:target}}}),factory({children:api.array(0,[target,proxy])})];
    return {results:values.map(root=>api.read(root,target)),root:api.read(proxyRoot,target),target:api.read(target,proxyRoot),traps};`);
  assert.equal(r.traps,0);assert(r.results.every((x:{status:string;reason:string})=>x.status==='refused'&&x.reason==='element-composition-child-unproved'));
  assert.equal(r.root.reason,'element-composition-return-unproved');assert.equal(r.target.reason,'element-composition-target-unproved');
});

test('repeated target identities, absent targets and changed array descriptors are not unique membership',()=>{
  const r=probe(`const target=factory({}),other=factory({});
    const shared=api.array(0,[target]),duplicate=factory({children:api.array(0,[shared,shared])});
    const absent=factory({children:api.array(0,[other])});
    const changed=api.array(0,[target]),root=factory({children:changed});changed[0]=other;
    const getter=api.array(0,[target]),getterRoot=factory({children:getter});let calls=0;
    Object.defineProperty(getter,'0',{get(){calls++;return target;}});
    return {duplicate:api.read(duplicate,target),absent:api.read(absent,target),changed:api.read(root,target),getter:api.read(getterRoot,target),calls};`);
  assert.equal(r.duplicate.reason,'element-composition-ambiguous');assert.equal(r.absent.reason,'element-composition-target-absent');
  assert.equal(r.changed.reason,'element-composition-array-changed');assert.equal(r.getter.reason,'element-composition-array-changed');assert.equal(r.calls,0);
});

test('only the exact static-factory freeze transition preserves the array witness; mutations and other freezes refuse',()=>{
  const r=probe(`const target=factory({}),other=factory({});
    const premature=api.array(0,[target]);Object.freeze(premature);
    const outside=factory({children:premature},'jsxs');
    const jsxArray=api.array(0,[target]),wrongFactory=factory({children:jsxArray},'jsx',Object.freeze);
    const mutated=api.array(0,[target]),wrongValue=factory({children:mutated},'jsxs',a=>{a[0]=other;Object.freeze(a);});
    const latched=api.array(0,[target]);latched.push(false);const once=factory({children:latched});latched.pop();
    return [outside,wrongFactory,wrongValue,once].map(root=>api.read(root,target));`);
  assert(r.every((x:{status:string;reason:string})=>x.status==='refused'&&x.reason==='element-composition-array-changed'));
});

test('prototype replacement and traversal depth cannot bypass bounded membership',()=>{
  const r=probe(`const target=factory({});let value=target;
    for(let i=0;i<34;i++)value=api.array(0,[value]);
    const deep=api.read(factory({children:value}),target);
    const array=api.array(0,[target]),root=factory({children:array});Object.setPrototypeOf(array,null);
    return {deep,prototype:api.read(root,target)};`);
  assert.equal(r.deep.reason,'element-composition-traversal-limit');assert.equal(r.prototype.reason,'element-composition-array-changed');
});

test('array observation preserves assignment patterns and skips shadowed observer globals',()=>{
  const text=`import {jsx} from 'react/jsx-runtime';
export function Component(props){let a,b;[a,b]=props.values;({value:[a]}=props.record);for([a] of props.rows){};return jsx('div',{children:[a,[b]]});}
function Shadow(globalThis){return [1];}`;
  const sf=ts.createSourceFile('/fixture.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),sources=readReactElementSourceCalls(sf,'fixture.mjs','pinned');
  assert.equal(sources.arrays?.length,2);assert.deepEqual(sources.arrays!.map(p=>text.slice(p.span.start,p.span.end)),['[a,[b]]','[b]']);
  const sites=readReactElementCreationSites(text,sf.fileName,'fixture.mjs'),plans=readReactElementInvocationPlans(sf,sites);
  const transformed=transformReactElementSource(sf,sites.map((p,index)=>({...p,index})),plans.map((p,index)=>({...p,index})),{objects:[],calls:[],arrays:sources.arrays!.map((p,index)=>({...p,index}))});
  assert.match(transformed,/\[a, b\] =/);assert.match(transformed,/value: \[a\]/);assert.match(transformed,/for \(\[a\] of/);
  assert.equal((transformed.match(/sourceArray\(/g)??[]).length,2);
  const after=ts.createSourceFile('/after.mjs',transformed,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal((after as ts.SourceFile&{parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length,0);
});
