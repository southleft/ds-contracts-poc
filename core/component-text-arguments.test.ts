import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema,walkAnatomy,reachableVariantTupleKeys,type Contract} from '../scripts/contract-schema.js';
import {reactEmitter,reactInlineEmitter,htmlEmitter} from './emitter.js';
import {webComponentsEmitter} from '../packages/emitter-web-components/src/index.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {resolveBooleanArguments} from './component-boolean-arguments.js';
import {proposeBatchFromDump,proposeFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {generatedTypeErrors} from './react-test-runtime.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(children=false,kind:'TEXT'|'NONE'='TEXT'){
 const name=children?'children':'label';
 const child=ContractSchema.parse({id:'check.text-child',name:'TextChild',version:'0.1.0',status:'draft',description:'Owned editable text',semantics:{element:'span'},props:[{name,type:'text',default:'Original',bindings:{code:{prop:name},figma:kind==='TEXT'?{kind,property:'Label'}:{kind}}}],states:[],anatomy:{root:{literals:{width:'100px',height:'20px'},parts:{label:{content:{prop:name},literals:{'font-size':'14px','line-height':'20px'}}}}},bindings:{code:{anchors:{importPath:'./TextChild',export:'TextChild'}},figma:{anchors:{fileKey:'fixture',componentSetKey:'text-child'}}}});
 const table={props:['mode','active'],rows:[{values:['one','false'],value:null},{values:['one','true'],value:''},{values:['two','false'],value:'{mode}'},{values:['two','true'],value:'雪 🧭'}]};
 const parent=ContractSchema.parse({id:'check.text-parent',name:'TextParent',version:'0.1.0',status:'draft',description:'Joint input fixture',semantics:{element:'div'},props:[{name:'mode',type:{enum:['one','two']},default:'one',bindings:{code:{prop:'mode'},figma:{kind:'VARIANT',property:'Mode',values:{one:'One',two:'Two'}}}},{name:'active',type:'boolean',default:false,bindings:{code:{prop:'active'},figma:{kind:'VARIANT',property:'Active',values:{false:'False',true:'True'}}}}],states:[],anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{usage:{component:{id:child.id,textPropsByCombination:{[name]:table}}}}}},bindings:{code:{anchors:{importPath:'./TextParent',export:'TextParent'}},figma:{anchors:{fileKey:'fixture',componentSetKey:'text-parent'}}}});
 const scope=new Map([[child.id,child],[parent.id,parent]]),ref=parent.anatomy.root.parts!.usage.component!;
 return {child,parent,scope,ref,name,table:ref.textPropsByCombination![name],ctx:{tokens,contracts:scope,icons:new Map<string,string>()}};
}
async function generated(f:ReturnType<typeof fixture>,emitter:typeof reactEmitter){
 const parent=emitter.emit(f.parent,f.ctx),child=emitter.emit(f.child,f.ctx);
 assert.match(parent[0].contents,/Record<string, string \| undefined>/,'TEXT tables use bounded lookups even below64 rows');
 assert.deepEqual(generatedTypeErrors(f.parent.name,parent[0].contents,{[f.child.name]:child[0].contents}),[]);
 const modules=new Map([[f.parent.name,parent[0].contents],[f.child.name,child[0].contents]]);
 const built=await build({stdin:{contents:`export {${f.parent.name} as default} from 'generated-root';`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'in-memory-generated',setup(b){b.onResolve({filter:/^generated-root$/},()=>({path:f.parent.name,namespace:'generated'}));b.onResolve({filter:/^\.\.?\/TextChild$/},()=>({path:f.child.name,namespace:'generated'}));b.onLoad({filter:/.*/,namespace:'generated'},a=>({contents:modules.get(a.path)!,loader:'tsx',resolveDir:process.cwd()}));b.onResolve({filter:/\.css$/},a=>({path:a.path,namespace:'css'}));b.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default {}',loader:'js'}));}}]});
 const module={exports:{} as any};new Function('require','module','exports',built.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports.default;
}
test('joint TEXT inputs preserve literal braces, empty text, and omitted defaults on both React surfaces',async()=>{
 for(const children of [false,true])for(const kind of ['TEXT','NONE'] as const){const f=fixture(children,kind),before=JSON.stringify(f.parent);for(const emitter of [reactEmitter,reactInlineEmitter]){const Component=await generated(f,emitter);for(const row of [...f.table.rows,...f.table.rows.slice().reverse()]){const html=renderToStaticMarkup(React.createElement(Component,{mode:row.values[0],active:row.values[1]==='true'}));const text=html.replace(/<[^>]*>/g,'');assert.equal(text,row.value??'Original',`${children}/${kind}/${emitter.name}/${JSON.stringify(row)}`);assert.equal((html.match(/<span/g)??[]).length,2,'one unchanged child root and text leaf');}}assert.equal(JSON.stringify(f.parent),before);}
});
test('joint TEXT resolver omits only null and never interprets strings as references',()=>{
 const f=fixture();for(const row of f.table.rows){const resolved=resolveBooleanArguments(f.child,f.ref,{mode:row.values[0]!,active:row.values[1]!});assert.deepEqual(resolved,row.value===null?{}:{label:row.value});}assert.throws(()=>resolveBooleanArguments(f.child,f.ref,{mode:'unknown',active:'false'}),/combination-unqualified/);
});
test('joint TEXT schema rejects incomplete, duplicate, unknown, malformed and conflicting domains',()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>f.table.rows.pop(),(f:ReturnType<typeof fixture>)=>f.table.rows.push(structuredClone(f.table.rows[0])),(f:ReturnType<typeof fixture>)=>f.table.rows[0].values[0]='unknown',(f:ReturnType<typeof fixture>)=>f.table.props[1]='mode',(f:ReturnType<typeof fixture>)=>f.table.rows[0].values.pop(),(f:ReturnType<typeof fixture>)=>f.ref.props={label:'priority'},(f:ReturnType<typeof fixture>)=>f.ref.enumPropsByCombination={label:{props:['mode','active'],rows:f.table.rows}}]){const f=fixture();mutate(f);assert.equal(ContractSchema.safeParse(f.parent).success,false,String(mutate));}
});
test('joint TEXT cross-contract checks refuse unknown/type/required/content conflicts and unsupported surfaces',()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>f.child.props[0].type='boolean',(f:ReturnType<typeof fixture>)=>f.child.props[0].name='other',(f:ReturnType<typeof fixture>)=>f.child.props[0].required=true,(f:ReturnType<typeof fixture>)=>f.ref.props={label:'fixed'}]){const f=fixture();mutate(f);for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,f.ctx),/text-argument|argument-|unknown|conflict|required|type|boolean/i);assert.throws(()=>createFigmaEngine(f.ctx).compileComponentData(f.parent,f.scope),/text-argument|argument-|unknown|conflict|required|type|boolean/i);}
 const f=fixture(true);f.ref.text='clobber';for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,f.ctx),/conflicting|conflict/i);
 const plain=fixture();assert.throws(()=>htmlEmitter.emit(plain.parent,plain.ctx),/HTML_TEXT_ARGUMENTS_UNSUPPORTED/);assert.throws(()=>webComponentsEmitter.emit(plain.parent,plain.ctx),/WEB_COMPONENT_TEXT_ARGUMENTS_UNSUPPORTED/);
});
test('native TEXT values preserve braces, null default, empty edit, selected child count and bounds',async()=>{
 for(const children of [false,true]){
 const f=fixture(children),engine=createFigmaEngine(f.ctx),data=engine.compileComponentData(f.parent,f.scope);
 assert.equal(data.variants.length,4);const all=(n:any):any[]=>[n,...(n.children??[]).flatMap(all)];
 for(const v of data.variants){const instance=all(v.spec).filter(n=>n.type==='instance');assert.equal(instance.length,1);const row=f.table.rows.find(r=>v.name.includes(r.values[0]==='one'?'Mode=One':'Mode=Two')&&v.name.includes(r.values[1]==='true'?'Active=True':'Active=False'))!;assert(row);assert.deepEqual(instance[0].depProps,row.value===null?{}:{Label:row.value});assert.equal(instance[0].depContractId,f.child.id);}
 const host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}}),run=(s:string)=>vm.runInContext(`(async()=>{${s}\n})()`,context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(f.child,f.scope));const child=host.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===f.child.id)!;const before=child.findAll().map((n:any)=>[n.id,n.type,n.name,n.characters,n.width,n.height]);await run(engine.buildComponentScript(f.parent,f.scope));assert.deepEqual(child.findAll().map((n:any)=>[n.id,n.type,n.name,n.characters,n.width,n.height]),before);
 const owner=host.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===f.parent.id)!;assert.equal(owner.children!.length,4);
 for(const v of owner.children!){const instance=v.findAll((n:any)=>n.type==='INSTANCE');assert.equal(instance.length,1);assert.equal(instance[0].width,100);assert.equal(instance[0].height,20);const row=f.table.rows.find(r=>v.name.includes(r.values[0]==='one'?'Mode=One':'Mode=Two')&&v.name.includes(r.values[1]==='true'?'Active=True':'Active=False'))!;const label=Object.entries(instance[0].componentProperties!).find(([key])=>key.split('#')[0]==='Label')?.[1] as {value:unknown}|undefined;assert(label,JSON.stringify(instance[0].componentProperties));assert.equal(label.value,row.value??'Original');assert.deepEqual(instance[0].findAll((n:any)=>n.type==='TEXT').map((n:any)=>n.characters),[row.value??'Original']);}
 }
});
test('NONE text controls retain their existing explicit native limitation',()=>{const f=fixture(false,'NONE'),data=createFigmaEngine(f.ctx).compileComponentData(f.parent,f.scope);assert.match(JSON.stringify(data),/not wired/);});

function sourceFixture(){
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const child:any={setName:'SourceChild',key:'child-key',nodeId:'set-child',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']}},variants:['Off','On'].map((mode,i)=>({name:'Mode='+mode,type:'COMPONENT',nodeId:'main-'+i,variantProperties:{Mode:mode},layout,children:[{name:'Unedited',type:'TEXT',nodeId:'other-'+i,text:{characters:'Base',fontSize:14,fontStyle:'Regular',lineHeight:18}},{name:'Label',type:'TEXT',nodeId:'target-'+i,text:{characters:'Original',fontSize:14,fontStyle:'Regular',lineHeight:18}}]}))};
 const values=[undefined,'','{caseProp}','雪 🧭'];
 const parent:any={setName:'SourceParent',key:'parent-key',nodeId:'set-parent',type:'COMPONENT_SET',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']},Grouped:{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']}},variants:['One','Two'].flatMap((which,i)=>['false','true'].map((grouped,j)=>{const id=`usage-${i}-${j}`,value=values[i*2+j];return{name:`Case=${which}, Grouped=${grouped}`,type:'COMPONENT',nodeId:`parent-${i}-${j}`,variantProperties:{Case:which,Grouped:grouped},layout,children:[{name:'SourceChild',type:'INSTANCE',nodeId:id,instanceOf:'SourceChild',instanceKey:'child-key',instanceGeometry:{componentId:'main-0',nodeId:id},componentProperties:{Mode:'Off'},...(value!==undefined?{textOverrides:{Label:value},textOverrideTargets:{Label:{nodeId:`I${id};target-0`,instanceId:id,componentId:'main-0',instancePath:[],childPath:[1]}}}:{})}]};}))};
 return {child,parent};
}
const opts={fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true,hiddenCaptured:true,stampsObservable:true,drawnVariantSurface:'react-runtime' as const};
function proposed(f:ReturnType<typeof sourceFixture>){const result=proposeBatchFromDump({SourceChild:f.child,SourceParent:f.parent},opts);const child=result.proposals.find(p=>p.setName==='SourceChild')!,parent=result.proposals.find(p=>p.setName==='SourceParent'),prop=child?.characterBindings?.[0]?.prop;const contract=parent&&ContractSchema.parse(parent.contract);return{result,child,parent,prop,contract,refs:contract?walkAnatomy(contract).filter(w=>w.part.component).map(w=>w.part.component!):[]};}
test('source joint character proof preserves one original child, explicit values and null',()=>{const f=sourceFixture(),before=JSON.stringify(f),p=proposed(f);assert.deepEqual(p.result.skipped,[]);assert(p.prop&&p.contract);assert.equal(p.refs.length,1);assert.deepEqual(p.refs[0].textPropsByCombination![p.prop].rows.map(r=>r.value),[null,'','{caseProp}','雪 🧭']);assert.equal(JSON.stringify(f),before);});
test('source joint character proof rejects missing/stale/foreign targets and ambiguous source rows',()=>{
 for(const mutate of [(f:ReturnType<typeof sourceFixture>)=>delete f.parent.variants[3].children[0].textOverrideTargets,(f:ReturnType<typeof sourceFixture>)=>f.parent.variants[3].children[0].textOverrideTargets.Label.instanceId='other',(f:ReturnType<typeof sourceFixture>)=>f.parent.variants[3].children[0].textOverrideTargets.Label.componentId='other',(f:ReturnType<typeof sourceFixture>)=>f.parent.variants[3].children[0].textOverrideTargets.Label.childPath=[0],(f:ReturnType<typeof sourceFixture>)=>f.parent.variants.push(structuredClone(f.parent.variants[3])),(f:ReturnType<typeof sourceFixture>)=>f.parent.variants[3].variantProperties.Case='Unknown']){const f=sourceFixture();mutate(f);const p=proposed(f);assert(!p.prop||p.refs.every(ref=>!ref.textPropsByCombination?.[p.prop!]),String(mutate));}
});
test('a stale contract revision cannot authorize a joint character table',()=>{
 const f=sourceFixture(),p=proposed(f);assert(p.prop);const cc=ContractSchema.parse(p.child.contract);cc.description+=' revision change';const result=proposeFromDump(f.parent,{...opts,contractIdByName:new Map([['SourceChild',cc.id]]),contractIdByKey:new Map([['child-key',cc.id]]),contractsById:new Map([[cc.id,asMinimalChildContract(cc)]]),characterBindingsByContract:new Map([[cc.id,p.child.characterBindings!]])});assert(!walkAnatomy(ContractSchema.parse(result.contract)).some(w=>w.part.component?.textPropsByCombination?.[p.prop!]));assert(result.notes.some(n=>n.includes('stale child identity')));
});
test('text tables keep the string null and reject oversized payloads rather than coerce them',()=>{const f=fixture();f.table.rows[0].value='null';assert.deepEqual(resolveBooleanArguments(f.child,f.ref,{mode:'one',active:'false'}),{label:'null'});f.table.rows[0].value='x'.repeat(65537);assert.equal(ContractSchema.safeParse(f.parent).success,false);});
test('large text tables use bounded lookup output and keep children omission defaults',async()=>{
 const f=fixture(true),choices=Array.from({length:66},(_,i)=>'value'+i);f.parent.props[0].type={enum:choices};f.parent.props[0].default=choices[0];f.parent.props[0].bindings.figma.values=Object.fromEntries(choices.map(v=>[v,v]));
 f.table.rows=choices.flatMap((v,i)=>['false','true'].map(active=>({values:[v,active],value:active==='false'?null:i?'Text '+i:''})));
 for(const emitter of [reactEmitter,reactInlineEmitter]){const Component=await generated(f,emitter);for(const [mode,active,value]of [[choices[0],false,'Original'],[choices[0],true,''],[choices[65],true,'Text 65'],[choices[65],false,'Original']] as const){assert.equal(renderToStaticMarkup(React.createElement(Component,{mode,active})).replace(/<[^>]*>/g,''),value);}}
});
test('source table preserves independently proved absent-child planes, not missing captures',()=>{
 const f=sourceFixture();f.parent.propertyDefinitions.Show={type:'VARIANT',defaultValue:'true',variantOptions:['false','true']};f.parent.variants=f.parent.variants.flatMap((v:any)=>['false','true'].map(show=>{const out=structuredClone(v);out.name+=', Show='+show;out.variantProperties.Show=show;out.nodeId+='-'+show;if(show==='false')out.children=[];return out;}));const p=proposed(f);assert.deepEqual(p.result.skipped,[]);assert(p.prop);assert.equal(p.refs.length,1);assert.equal(p.refs[0].textPropsByCombination![p.prop].rows.length,8);assert.equal(p.refs[0].textPropsByCombination![p.prop].rows.filter(row=>row.value===null).length,5);
 const sparse=sourceFixture();sparse.parent.variants.pop();const exact=proposed(sparse);assert(exact.contract&&exact.prop);assert.equal(exact.refs[0].textPropsByCombination![exact.prop].rows.length,3);assert.equal(reachableVariantTupleKeys(exact.contract,exact.refs[0].textPropsByCombination![exact.prop].props)?.size,3,'an independently admitted sparse domain is retained without the fourth tuple');
});
test('an explicit public TEXT prop wins over raw character override rather than being overwritten',()=>{
 const f=sourceFixture();f.child.propertyDefinitions.Label={type:'TEXT',defaultValue:'Original'};for(const v of f.child.variants)v.children[1].propRefs={characters:'Label'};for(const v of f.parent.variants)v.children[0].componentProperties.Label='Public text';const p=proposed(f);assert.deepEqual(p.result.skipped,[]);assert(p.prop);assert(p.refs.every(ref=>ref.textPropsByCombination===undefined));assert(p.parent!.notes.some(n=>n.includes('drawn property already applies')));
});
test('a text table cannot supply the same caller slot through two channels',()=>{const f=fixture(true);f.child.anatomy.root.parts!.slot={slot:{name:'children',bindings:{figma:{property:'Children'}}}};f.parent.anatomy.root.parts!.usage.parts={caller:{text:'Caller'}};for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,f.ctx),/conflict|slot/i);});

test('direct emitter objects cannot bypass the complete TEXT table domain',()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>f.table.rows.pop(),(f:ReturnType<typeof fixture>)=>f.table.rows.push(structuredClone(f.table.rows[0])),(f:ReturnType<typeof fixture>)=>f.table.rows[0].values[0]='unknown']){const f=fixture();mutate(f);for(const emitter of [reactEmitter,reactInlineEmitter])assert.throws(()=>emitter.emit(f.parent,f.ctx),/text-argument|argument.*domain|argument.*invalid/i);assert.throws(()=>createFigmaEngine(f.ctx).compileComponentData(f.parent,f.scope),/text-argument|argument.*domain|argument.*invalid/i);}
});
