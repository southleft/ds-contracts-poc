import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {transform} from 'esbuild';
import ts from 'typescript';
import {readReactElementCreationSites,reactElementCreationHook} from './react-element-creation.js';
import {readReactElementInvocationPlans,transformReactElementSource,type ReactElementInvocation} from './react-element-invocation.js';
import {readReactCompiledEffects} from './react-compiled-effects.js';

async function fixture(body:string,run:string,check:(value:{model:ReturnType<typeof readReactCompiledEffects>;invocation:ReactElementInvocation;again:(invocation:ReactElementInvocation)=>ReturnType<typeof readReactCompiledEffects>;file:string})=>void){
  const root=realpathSync(mkdtempSync(path.join(tmpdir(),'dsc-compiled-effects-'))),file=path.join(root,'fixture.mjs');
  try{
    // These model fixtures call components directly, outside React. Register
    // only their syntactically fresh object input; unknown values cannot gain
    // this identity merely by having a plain-looking descriptor shape.
    const runSource=ts.createSourceFile('run.js',run,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const statement=runSource.statements[0];assert(ts.isExpressionStatement(statement)&&ts.isCallExpression(statement.expression));
    const argument=statement.expression.arguments[0];assert(ts.isObjectLiteralExpression(argument));
    const registered=run.slice(0,argument.getStart(runSource))+'globalThis.__DSC_ELEMENT_CREATION.literal('+argument.getText(runSource)+')'+run.slice(argument.end);
    const text=`import {jsx} from 'react/jsx-runtime';\n${body}\nconst element=${registered};globalThis.element=element;`;
    writeFileSync(file,text);
    const reference={sourceRoot:root,files:{[file]:createHash('sha256').update(text).digest('hex')}};
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),sites=readReactElementCreationSites(text,file,'fixture.mjs'),plans=readReactElementInvocationPlans(sf,sites);
    const observed=transformReactElementSource(sf,sites.map((s,index)=>({...s,index})),plans.map((p,index)=>({...p,index})));
    const output=await transform(observed,{format:'cjs',loader:'js'});
    const owner={},factory=(type:unknown,props:unknown)=>({type,props,_owner:owner});
    const context={require:()=>({jsx:factory}),module:{exports:{}},exports:{}};
    runInNewContext(reactElementCreationHook(sites,plans),context);
    runInNewContext('globalThis.__DSC_ELEMENT_CREATION.register(require().jsx,require().jsx)',context);
    runInNewContext(output.code,context);
    const record=JSON.parse(runInNewContext('JSON.stringify({site:__DSC_ELEMENT_CREATION.read({memoizedProps:element.props,type:element.type,_debugOwner:element._owner}),invocation:__DSC_ELEMENT_CREATION.readInvocation({memoizedProps:element.props,type:element.type,_debugOwner:element._owner})})',context));
    const again=(invocation:ReactElementInvocation)=>readReactCompiledEffects(reference,record.site,invocation);
    check({model:again(record.invocation),invocation:record.invocation,again,file});
  }finally{rmSync(root,{recursive:true,force:true});}
}

test('compiled model follows selected outer target and forwards opaque content, handler and ref without inspecting them',async()=>{
  await fixture(`const tag='button',alternate=()=>{};
const C=(props,ref)=>{const {other,...rest}=props;const Comp=other?alternate:tag;return jsx(Comp,{...rest,ref});};`,
    `C({other:false,children:{get unsafe(){throw Error('inspected');}},onClick:()=>{throw Error('called');},id:'control'},null)`,
    ({model})=>{
      assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
      assert.equal(model.content,'forwarded');assert.deepEqual(model.output.tag,{kind:'host',name:'button'});
      const props=new Map(model.output.props.fields);assert.deepEqual(props.get('children'),{kind:'opaque'});
      assert.deepEqual(props.get('onClick'),{kind:'input',key:'onClick'});assert.deepEqual(props.get('ref'),{kind:'parameter',index:1});
      assert(!props.has('other'));assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
      assert.deepEqual(model.decisions.map(d=>d.taken),[false]);
    });
});

test('compiled model keeps absent content absent and preserves JSX key precedence',async()=>{
  await fixture(`const C=props=>jsx('span',{...props,key:undefined},'argument-key');`,
    `C({title:'plain'})`,({model})=>{
      assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
      assert.equal(model.output.key,'argument-key');assert(!model.output.props.fields.some(([k])=>['children','key'].includes(k)));
      assert.equal(model.content,'not-directly-forwarded');
    });
});

test('compiled props are read after the key argument can mutate an owned props alias',async()=>{
  await fixture(`const C=props=>{const attrs={children:props.children};const key=()=>{attrs.children='replacement';return 'after';};return jsx('button',attrs,key());};`,
    `C({children:'original'})`,({model,invocation})=>{
      assert.equal(invocation.status,'observed');if(invocation.status==='observed')assert.equal(invocation.childrenIdentity,'changed');
      assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled')return;
      assert.equal(model.content,'not-directly-forwarded');assert.equal(model.output.key,'after');
      assert.deepEqual(new Map(model.output.props.fields).get('children'),{kind:'literal',type:'string',value:'replacement'});
    });
});

test('compiled model refuses input inspection, callback execution and transient mutations even when pointers and endpoints match',async()=>{
  for(const [statement,reason] of [
    [`const read=props.children.value;`,'opaque-content-inspected'],
    [`props.onClick(props.children);`,'call-target-unresolved'],
    [`props.title='changed';props.title='original';`,'external-data-write'],
    [`props.children.value='changed';props.children.value='original';`,'opaque-content-inspected'],
  ]){
    await fixture(`const C=props=>{${statement}return jsx('button',{...props});};`,
      `C({children:{value:'original'},onClick:()=>{},title:'original'})`,({model,invocation})=>{
        assert.equal(invocation.status,'observed');if(invocation.status==='observed')assert.equal(invocation.childrenIdentity,'same-value');
        assert.equal(model.status,'refused');if(model.status!=='refused')return;
        assert.equal(model.reason,reason);
        assert(model.at);assert.equal(model.runtimeVerified,false);
      });
  }
});

test('compiled model names opaque external writes instead of executing them',async()=>{
  await fixture(`const marker='some-generic-key';const C=props=>{globalThis[marker]=true;return jsx('button',{...props});};`,
    `C({children:'original'})`,({model})=>{
      assert.equal(model.status,'refused');if(model.status==='refused')assert.equal(model.reason,'opaque-closure-inspected:globalThis');
    });
});

test('compiled effects require the exact closure plan, consumed read order and current source',async()=>{
  await fixture(`const tag='button';const C=props=>jsx(tag,{...props});`,
    `C({children:'original'})`,({model,invocation,again,file})=>{
      assert.equal(model.status,'modeled');assert.equal(invocation.status,'observed');if(invocation.status!=='observed')return;
      for(const change of [
        (r:typeof invocation)=>{r.closureReads.reverse();},
        (r:typeof invocation)=>{r.closureReads.pop();},
        (r:typeof invocation)=>{r.closureReads.push(r.closureReads[0]);},
        (r:typeof invocation)=>{r.function.bindingReads![0].name='forged';},
      ]){
        const modified:typeof invocation=structuredClone(invocation);change(modified);assert.equal(again(modified).status,'refused');
      }
      const componentTarget=structuredClone(invocation);
      componentTarget.closureReads.find(r=>componentTarget.function.bindingReads![r.read].name==='tag')!.value={kind:'function'};
      const unsupported=again(componentTarget);assert.equal(unsupported.status,'refused');
      if(unsupported.status==='refused')assert.equal(unsupported.reason,'opaque-closure-inspected:tag');
      writeFileSync(file,'// changed source');assert.equal(again(invocation).status,'refused');
    });
});

test('compiled effect models are source assumptions even when serialized flags claim runtime proof',async()=>{
  await fixture(`const C=props=>jsx('button',{...props});`,`C({children:'original'})`,({model,invocation,again})=>{
    assert.equal(model.status,'modeled');const forged={...invocation,effectsVerified:true} as unknown as ReactElementInvocation;
    const result=again(forged);assert.equal(result.runtimeVerified,false);assert.equal(result.acceptedContract,null);
    assert.equal(result.qualification,'compiled-effects-model-only');assert(result.runtimeRequirements.length>0);
  });
});

test('compiled model matches guarded registry calls and primitive global writes without granting content authority',async()=>{
  await fixture(`const C=props=>{globalThis[Symbol.for(props.marker)]=props.value;return jsx('button',{...props});};`,
    `C({children:'kept',marker:'generic-model-marker',value:true})`,({model,invocation,again})=>{
      assert.equal(model.status,'modeled',model.status==='refused'?model.reason:'');if(model.status!=='modeled'||invocation.status!=='observed')return;
      assert.equal(model.content,'forwarded');assert.equal(model.runtimeVerified,false);assert.equal(model.acceptedContract,null);
      assert.deepEqual(model.nativeEffects.map(e=>[e.kind,e.key]),[['symbol-for','generic-model-marker'],['global-symbol-data-write','generic-model-marker']]);
      for(const mutate of [
        (r:typeof invocation)=>{r.effects.reverse();},
        (r:typeof invocation)=>{r.effects.pop();},
        (r:typeof invocation)=>{r.effects.push(r.effects[0]);},
        (r:typeof invocation)=>{r.globalReads.pop();},
        (r:typeof invocation)=>{const event=r.effects[1];if(event.status==='verified'&&event.kind==='global-symbol-data-write')event.value={kind:'boolean',value:false};},
      ]){const altered:typeof invocation=structuredClone(invocation);mutate(altered);assert.equal(again(altered).status,'refused');}
    });
});

test('compiled model cannot approve a setter merely because the original write returned normally',async()=>{
  await fixture(`Object.defineProperty(globalThis,Symbol.for('setter-model'),{set(value){},configurable:true});
const C=props=>{globalThis[Symbol.for('setter-model')]=true;return jsx('button',{...props});};`,
    `C({children:'kept'})`,({model})=>{
      assert.equal(model.status,'refused');if(model.status==='refused')assert.equal(model.reason,'compiled-native-effect-unproved:element-global-write-not-writable-data');
    });
});
