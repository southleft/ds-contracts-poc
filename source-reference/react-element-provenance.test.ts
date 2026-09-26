import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {reactElementProvenanceRuntime} from './react-element-provenance.js';

function probe(body:string,enabled=true){
  return JSON.parse(runInNewContext(`(()=>{
    const api=(${reactElementProvenanceRuntime})(${enabled});
    const site={module:'source.mjs',sourceSha256:'pinned',span:{start:10,end:20},factory:'jsx'};
    // The integrated browser test separately exercises the pinned React factory.
    const factory=config=>{const element={type:'button',props:config,key:null};api.after(api.before(config,site),element);return element;};
    return JSON.stringify((()=>{${body}})());
  })()`));
}

test('only registered factory props and the authenticated ref copy retain opaque identities',()=>{
  const result=probe(`const ref=()=>{},child={},callback=()=>{};
    const input=api.literal({children:child,onClick:callback,ref}),element=factory(input);
    const copy={children:child,onClick:callback};api.forward(input,copy,ref);
    const token=api.input(copy,[ref]);return {input:api.readInput(token),output:api.readOutput(element),
      clone:api.readInput(api.input({...copy},[ref])),wrongRef:api.readInput(api.input(copy,[()=>{}]))};`);
  assert.equal(result.input.status,'verified');assert.equal(result.input.kind,'forward-ref-copy');
  assert.equal(result.input.qualification,'react-props-origin-only');assert.equal(result.output.status,'verified');
  assert.equal(result.clone.reason,'react-input-origin-unproved');assert.equal(result.wrongRef.reason,'react-secondary-origin-unproved');
});

test('unknown proxy configs and inputs refuse without extra reflective reads',()=>{
  const result=probe(`let traps=0;const proxy=new Proxy({children:'x'},{getPrototypeOf(){traps++;return Object.prototype;},ownKeys(){traps++;return ['children'];},getOwnPropertyDescriptor(){traps++;return {value:'x',enumerable:true,configurable:true,writable:true};}});
    const before=api.before(proxy,site),input=api.readInput(api.input(proxy,[]));return {before,input,traps};`);
  assert.equal(result.traps,0);assert.equal(result.before.failure,'react-config-origin-unproved');assert.equal(result.input.reason,'react-input-origin-unproved');
});

test('getter configs and unregistered lookalikes cannot mint factory origins',()=>{
  const result=probe(`let calls=0;const config=api.literal({get children(){calls++;return 'x';}});
    const element=factory(config),lookalike=factory({children:'x'});
    return {calls,getter:api.readOutput(element),lookalike:api.readOutput(lookalike)};`);
  assert.equal(result.calls,0);assert.equal(result.getter.status,'refused');assert.equal(result.lookalike.status,'refused');
});

test('changed inputs and incomplete or wrong ref copies remain unproved',()=>{
  const result=probe(`const ref=()=>{},p=api.literal({children:'x',ref}),element=factory(p);
    const origin=api.input(p,[]);const extra={children:'x',added:true},missing={},wrong={children:'x'},sameRef={children:'x',ref};
    api.forward(p,extra,ref);api.forward(p,missing,ref);api.forward(p,wrong,null);api.forward(p,sameRef,ref);
    p.children='changed';return {input:api.readInput(origin),output:api.readOutput(element),copies:[extra,missing,wrong,sameRef].map(v=>api.readInput(api.input(v,[ref])))};`);
  assert.equal(result.input.reason,'react-input-origin-changed');assert.equal(result.output.reason,'react-output-origin-changed');
  assert(result.copies.every((r:{status:string})=>r.status==='refused'));
});

test('native changes and unsupported runtime versions cannot grant provenance',()=>{
  const result=probe(`const p=api.literal({children:'x'}),element=factory(p);const token=api.input(p,[]);
    Object.defineProperty(Object,'getOwnPropertyDescriptors',{value:()=>({})});return {input:api.readInput(token),output:api.readOutput(element),before:api.before(p,site)};`);
  assert.equal(result.input.reason,'react-props-native-environment-changed');assert.equal(result.output.reason,'react-props-native-environment-changed');
  assert.equal(result.before.failure,'react-props-native-environment-changed');
  const disabled=probe(`const p=api.literal({children:'x'});return api.readOutput(factory(p));`,false);
  assert.equal(disabled.status,'refused');
});

test('the ref-free forward path preserves the exact props object and authentic null ref',()=>{
  const result=probe(`const p=api.literal({children:'x'});factory(p);api.forward(p,p,null);return api.readInput(api.input(p,[null]));`);
  assert.equal(result.status,'verified');assert.equal(result.kind,'forward-ref-copy');
});

test('only the pinned keyed factory warning descriptor is tolerated, without invoking any getter',()=>{
  const result=probe(`let calls=0;
    const config=api.literal({children:'x'}),props={children:'x'};
    Object.defineProperty(props,'key',{get(){calls++;return undefined;},enumerable:false});
    const element={type:'button',key:'keyed',props};api.after(api.before(config,site),element);
    const copy={children:'x'};api.forward(props,copy,null);
    const badProps={children:'x',get unsafe(){calls++;return 1;}},bad={type:'button',key:'keyed',props:badProps};
    api.after(api.before(config,site),bad);
    return {output:api.readOutput(element),input:api.readInput(api.input(copy,[null])),bad:api.readOutput(bad),calls};`);
  assert.equal(result.output.status,'verified');assert.equal(result.input.status,'verified');
  assert.equal(result.bad.status,'refused');assert.equal(result.calls,0);
});
