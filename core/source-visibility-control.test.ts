import test from 'node:test';import assert from 'node:assert/strict';
import {proposeFromDump,proposeBatchFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';import {ContractSchema,walkAnatomy,resolveLayout} from '../scripts/contract-schema.js';
import {visibilityDemandsFromDumps,demandedVisibilityNodes,visibilityBindingMatches} from './source-visibility-control.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const child:any={setName:'SourceChild',key:'child-key',nodeId:'set-child',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']}},variants:['Off','On'].map((mode,i)=>({name:'Mode='+mode,type:'COMPONENT',nodeId:'main-'+i,variantProperties:{Mode:mode},layout,children:[{name:'Duplicate',type:'TEXT',nodeId:'other-'+i,text:{characters:'Base',fontSize:14,fontStyle:'Regular',lineHeight:18}},{name:'Duplicate',type:'TEXT',nodeId:'target-'+i,hidden:i===0,text:{characters:'Underline',fontSize:14,fontStyle:'Regular',lineHeight:18}}]}))};
 const target={nodeId:'Iusage;target-0',instanceId:'usage',componentId:'main-0',instancePath:[],childPath:[1],visible:true};
 const parent:any={setName:'SourceParent',key:'parent-key',nodeId:'set-parent',type:'COMPONENT_SET',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One']}},variants:[{name:'Case=One',type:'COMPONENT',nodeId:'parent-main',variantProperties:{Case:'One'},layout,children:[{name:'SourceChild',type:'INSTANCE',nodeId:'usage',instanceOf:'SourceChild',instanceKey:'child-key',componentProperties:{Mode:'Off'},hostOverrides:[{path:'Duplicate',fields:['visible'],visibilityTarget:target}]}]}]};return{child,parent,target};}
const opts={fileKey:'file',corpus,contractIdByName:new Map<string,string>(),mintUnbound:true,hiddenCaptured:true,stampsObservable:true};
test('numeric source identity selects the correct duplicate-name part, and stale receipts cannot authorize a child override',()=>{
 const {child,parent,target}=fixture(),demands=visibilityDemandsFromDumps({parent},'file');const p=proposeFromDump(child,{...opts,visibilityDemands:demands}),c=ContractSchema.parse(p.contract),binding=p.visibilityBindings![0];
 const selected=walkAnatomy(c).find(w=>w.part.visibilityOverrideProp)!;assert.equal(selected.part.text,'Underline');assert.equal(binding.childPath[0],1);assert(visibilityBindingMatches(binding,c,'file',target));
 for(const mutate of [(c:any)=>c.description+=' changed',(c:any)=>c.bindings.figma.anchors.fileKey='elsewhere']){const bad=structuredClone(c);mutate(bad);assert.equal(visibilityBindingMatches(binding,bad,'file',target),false);}
 assert.equal(visibilityBindingMatches(binding,c,'file',{...target,childPath:[0]}),false);
 assert.throws(()=>demandedVisibilityNodes(child,'other',demands),/source-identity-unqualified/);
 assert.throws(()=>demandedVisibilityNodes(child,'file',[{fileKey:'file',target:{...target,nodeId:'Iusage;other-0'}}]),/source-target-unqualified/);
});
test('batch proposes a demanded child before its parent and carries a complete fixed override',()=>{
 const {child,parent}=fixture();const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);const c=result.proposals.find(p=>p.setName==='SourceChild')!,p=result.proposals.find(p=>p.setName==='SourceParent')!;const prop=c.visibilityBindings![0].prop;
 const refs=walkAnatomy(ContractSchema.parse(p.contract)).filter(w=>w.part.component);assert.equal(refs.length,1);assert.equal(refs[0].part.component!.props![prop],true);
});

test('a missing override is not silently changed into false or forced true',()=>{
 const {child,parent}=fixture();parent.propertyDefinitions.Case.variantOptions.push('Two');const missing=structuredClone(parent.variants[0]);missing.name='Case=Two';missing.variantProperties.Case='Two';missing.nodeId='parent-two';missing.children[0].nodeId='usage-two';delete missing.children[0].hostOverrides;parent.variants.push(missing);
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);const c=result.proposals.find(p=>p.setName==='SourceChild')!,p=result.proposals.find(p=>p.setName==='SourceParent')!;const prop=c.visibilityBindings![0].prop;const ref=walkAnatomy(ContractSchema.parse(p.contract)).find(w=>w.part.component)!;assert.equal(ref.part.component!.props?.[prop],undefined);assert.deepEqual(ref.part.component!.booleanPropsByCombination?.[prop].rows.map(r=>r.value),[true,null]);
});


function characterFixture(){
 const f=fixture();for(const v of f.child.variants){v.children[1].hidden=false;v.children[1].name='Caption';}
 const use=f.parent.variants[0].children[0];delete use.hostOverrides;use.componentId=f.target.componentId;
 use.textOverrides={Caption:'optional'};use.textOverrideTargets={Caption:f.target};
 return f;
}
test('captured character identity creates an editable child text control and preserves its default',async()=>{
 const f=characterFixture(),result=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child},opts);
 assert.deepEqual(result.skipped,[]);const cp=result.proposals.find(p=>p.setName==='SourceChild')!,pp=result.proposals.find(p=>p.setName==='SourceParent')!;
 const child=ContractSchema.parse(cp.contract),parent=ContractSchema.parse(pp.contract),binding=cp.characterBindings![0];
 const text=child.props.find(p=>p.name===binding.prop)!;assert.equal(text.default,'Underline');assert.equal(text.bindings.figma.kind,'TEXT');
 assert.equal(walkAnatomy(parent).find(w=>w.part.component)!.part.component!.props![binding.prop],'optional');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');const {chromium}=await import('playwright-core');
 const merge=(a:any,b:any)=>{for(const [k,v] of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const tokens={primitives:result.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}};
 const scope=new Map([child,parent].map(c=>[c.id,c])),ctx={tokens,contracts:scope,icons:new Map<string,string>()};
 const native=createFigmaEngine(ctx),cc=native.compileComponentData(child,scope),pc=native.compileComponentData(parent,scope);
 const descendants=(n:any):any[]=>[n,...(n.children??[]).flatMap(descendants)];
 assert(cc.variants.every(v=>descendants(v.spec).some(n=>n.characters==='Underline'&&n.contentProp===text.bindings.figma.property)));
 assert(pc.variants.every(v=>descendants(v.spec).some(n=>n.depProps?.[text.bindings.figma.property!]==='optional')));
 const vm=await import('node:vm'),{createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const mock=createFigmaMock(),context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}}),run=(script:string)=>vm.runInContext('(async()=>{'+script+'\n})()',context);
 await run(native.buildTokensScript(null));await run(native.buildComponentScript(child,scope));await run(native.buildComponentScript(parent,scope));
 const hostSet=mock.root.findOne(n=>(n.type==='COMPONENT_SET'||n.type==='COMPONENT')&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;
 const instance=hostSet.findOne(n=>n.type==='INSTANCE')!;assert(instance);
 assert(instance.findOne(n=>n.type==='TEXT'&&n.characters==='optional'));
 const childSet=mock.root.findOne(n=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===child.id)!;assert(childSet.findOne(n=>n.type==='TEXT'&&n.characters==='Underline'));
 const browser=await chromium.launch({headless:true});try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=emitter.emit(child,ctx),p=emitter.emit(parent,ctx);assert.deepEqual(generatedTypeErrors(parent.name,p[0].contents,{[child.name]:c[0].contents}),[]);
  const page=await browser.newPage();try{
   await mountGenerated(page,parent.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});
   assert.match(await page.locator('#root').innerText(),/optional/);assert.doesNotMatch(await page.locator('#root').innerText(),/Underline/);
   const render=await mountGenerated(page,child.name,c[0].contents,c.find(f=>f.path.endsWith('.css'))?.contents);
   assert.match(await page.locator('#root').innerText(),/Underline/);await render({[binding.prop]:''});assert.doesNotMatch(await page.locator('#root').innerText(),/Underline/);
  }finally{await page.close();}
 }}finally{await browser.close();}
});

test('character identity rejects stale bindings and incomplete host observations',async()=>{
 const {characterBindingMatches}=await import('./source-character-control.js');
 const f=characterFixture(),r=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child},opts),p=r.proposals.find(p=>p.setName==='SourceChild')!,c=ContractSchema.parse(p.contract),b=p.characterBindings![0];
 assert(characterBindingMatches(b,c,'file',f.target));const changed=structuredClone(c);changed.description+=' modified';assert(!characterBindingMatches(b,changed,'file',f.target));
 for(const mutate of [(f:any)=>{f.parent.variants[0].children[0].textOverrideTargets.Caption.instanceId='wrong';},(f:any)=>{f.parent.variants[0].children[0].instanceRootOverrides={nodeId:'usage',componentId:'wrong',fields:[]};}]){
  const bad=characterFixture();mutate(bad);const result=proposeBatchFromDump({SourceParent:bad.parent,SourceChild:bad.child},opts),host=result.proposals.find(p=>p.setName==='SourceParent');
  if(host){assert(!JSON.stringify(host.contract).includes('optional'));assert(host.notes.some(n=>n.includes('character-override-not-carried')||n.includes('override is NOT carried')));}
  else assert(result.skipped.length>0);
 }
});

test('character carriage preserves native TEXT controls and distinguishes omission from missing identity',()=>{
 const f=characterFixture();for(const v of f.child.variants)v.children[1].propRefs={characters:'Caption Text'};
 f.child.propertyDefinitions['Caption Text']={type:'TEXT',defaultValue:'Underline'};
 const r=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child},opts);assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='SourceChild')!,c=ContractSchema.parse(cp.contract);assert.equal(c.props.filter(p=>p.type==='text').length,1);assert.equal(c.props.find(p=>p.type==='text')!.bindings.figma.property,'Caption Text');
 const missing=characterFixture();missing.parent.propertyDefinitions.Case.variantOptions.push('Two');const v=structuredClone(missing.parent.variants[0]);v.name='Case=Two';v.variantProperties.Case='Two';v.nodeId='parent-two';v.children[0].nodeId='usage-two';delete v.children[0].textOverrides;delete v.children[0].textOverrideTargets;missing.parent.variants.push(v);
 const incomplete=proposeBatchFromDump({SourceParent:missing.parent,SourceChild:missing.child},opts),p=incomplete.proposals.find(p=>p.setName==='SourceParent')!;
 const childProposal=incomplete.proposals.find(p=>p.setName==='SourceChild')!,prop=childProposal.characterBindings![0].prop;
 const ref=walkAnatomy(ContractSchema.parse(p.contract)).find(w=>w.part.component)!.part.component!;
 assert.deepEqual(ref.props![prop],{prop:'caseProp',map:{one:'optional'}});
 assert.equal(ContractSchema.parse(childProposal.contract).props.find(p=>p.name===prop)!.default,'Underline');
 v.children[0].textOverrides={Caption:'unqualified'};
 const bad=proposeBatchFromDump({SourceParent:missing.parent,SourceChild:missing.child},opts).proposals.find(p=>p.setName==='SourceParent')!;
 assert(!walkAnatomy(ContractSchema.parse(bad.contract)).some(w=>w.part.component?.props?.[prop]!==undefined));
 assert(bad.notes.some(n=>n.includes('incomplete or stale child identity')));
});

test('legacy paths cannot claim new controls and two observed targets stay independent',()=>{
 const f=characterFixture(),legacy=structuredClone(f.parent);legacy.setName='LegacyHost';legacy.key='legacy-key';delete legacy.variants[0].children[0].textOverrideTargets;
 const use=f.parent.variants[0].children[0];use.textOverrides.Duplicate='independent';use.textOverrideTargets.Duplicate={...f.target,nodeId:'Iusage;other-0',childPath:[0]};
 const r=proposeBatchFromDump({SourceChild:f.child,SourceParent:f.parent,LegacyHost:legacy},opts);assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='SourceChild')!,host=ContractSchema.parse(r.proposals.find(p=>p.setName==='SourceParent')!.contract),lp=r.proposals.find(p=>p.setName==='LegacyHost')!;
 const applied=walkAnatomy(host).find(w=>w.part.component)!.part.component!.props!;
 for(const binding of cp.characterBindings!)assert.equal(applied[binding.prop],binding.childPath[0]===0?'independent':'optional');
 assert(!JSON.stringify(lp.contract).includes('optional'));assert(lp.notes.some(n=>n.includes('NOT carried')));
});


for(const isSet of [false,true])test(`guarded instance-property amendments preserve native node and binding identities (${isSet?'set':'standalone'})`,async()=>{
 const f=characterFixture();if(isSet){f.parent.propertyDefinitions.Case.variantOptions.push('Two');const variant=structuredClone(f.parent.variants[0]);variant.name='Case=Two';variant.variantProperties.Case='Two';f.parent.variants.push(variant);}
 const r=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child},opts),contracts=r.proposals.map(p=>ContractSchema.parse(p.contract)),child=contracts.find(c=>c.name==='SourceChild')!,parent=contracts.find(c=>c.name==='SourceParent')!;
 const after=structuredClone(parent),ref=walkAnatomy(after).find(w=>w.part.component)!.part.component!,prop=Object.keys(ref.props!).find(k=>ref.props![k]==='optional')!;ref.props![prop]='Updated label';
 const merge=(a:any,b:any)=>{for(const [k,v]of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const tokens={primitives:r.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map(contracts.map(c=>[c.id,c]));
 const {createFigmaEngine}=await import('./emit-figma-script.js'),{createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs'),vm=await import('node:vm');
 const engine=createFigmaEngine({tokens,icons:new Map()}),host=createFigmaMock(),context=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}}),run=(s:string)=>vm.runInContext('(async()=>{'+s+'\n})()',context);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,scope));await run(engine.buildComponentScript(parent,scope));
 const owner=host.root.findOne(n=>n.type===(isSet?'COMPONENT_SET':'COMPONENT')&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!,inst=owner.findOne(n=>n.type==='INSTANCE')!;
 const ids=owner.findAll().map(n=>n.id),definitions=JSON.stringify(owner.componentPropertyDefinitions),before=engine.compileComponentData(parent,scope),next=engine.compileComponentData(after,scope),script=engine.buildBatchScript([next],null,[before]);
 if(isSet){
  // A later target with stale property metadata must refuse before the first
  // target is changed, even when the rendered-tree fingerprint still matches.
  const last=owner.findAll(n=>n.type==='INSTANCE').at(-1)!,rawProps=last._allProps as Record<string,{value:string|boolean}>,key=Object.keys(rawProps).find(k=>rawProps[k].value==='optional')!;
  rawProps[key].value='Foreign value';await assert.rejects(()=>run(script),/PREVIOUS_PROPERTY_CHANGED/);
  assert(inst.findOne(n=>n.type==='TEXT'&&n.characters==='optional'));assert.deepEqual(owner.findAll().map(n=>n.id),ids);rawProps[key].value='optional';
 }
 const result=await run(script);assert.equal(result.results[0].rebuiltVariants,0);assert.equal(result.results[0].patchedInstances,isSet?2:1);assert.deepEqual(owner.findAll().map(n=>n.id),ids);assert.equal(JSON.stringify(owner.componentPropertyDefinitions),definitions);assert(inst.findOne(n=>n.type==='TEXT'&&n.characters==='Updated label'));
 await assert.rejects(()=>run(script),/PREVIOUS_SPEC_MISMATCH/);
 const back=engine.buildBatchScript([before],null,[next]);inst.findOne(n=>n.type==='TEXT'&&n.name==='Caption')!.characters='Designer edit';
 await assert.rejects(()=>run(back),/CANVAS_DRIFT/);assert.equal(inst.findOne(n=>n.type==='TEXT'&&n.name==='Caption')!.characters,'Designer edit');
 const structural=structuredClone(after);structural.anatomy.root.literals={...structural.anatomy.root.literals,'padding-top':'3px'};
 assert.throws(()=>engine.buildBatchScript([engine.compileComponentData(structural,scope)],null,[before]),/STRUCTURE_CHANGED/);
 assert.throws(()=>engine.buildBatchScript([next],null,[structuredClone(before)]),/FIGMA_COMPONENT_DATA_UNVERIFIED/);
});

test('unbound nested-instance visibility follows a complete boolean domain without guessing partial presence',()=>{
 const f=fixture();f.parent.propertyDefinitions.Case={type:'VARIANT',defaultValue:'False',variantOptions:['False','True']};
 const base=f.parent.variants[0];delete base.children[0].hostOverrides;
 f.parent.variants=['False','True'].map((value,i)=>{const v=structuredClone(base);v.name='Case='+value;v.variantProperties.Case=value;v.nodeId='parent-'+i;v.children[0].hidden=i===1;return v;});
 const read=(parent:any)=>{const r=proposeBatchFromDump({SourceParent:parent,SourceChild:f.child},opts);return ContractSchema.parse(r.proposals.find(p=>p.setName==='SourceParent')!.contract);};
 const c=read(f.parent),prop=c.props.find(p=>p.bindings.figma.property==='Case')!.name;
 assert.deepEqual(walkAnatomy(c).find(w=>w.part.component)!.part.visibleWhen,{prop,equals:false});
 const inverse=structuredClone(f.parent);for(const v of inverse.variants)v.children[0].hidden=!v.children[0].hidden;
 assert.deepEqual(walkAnatomy(read(inverse)).find(w=>w.part.component)!.part.visibleWhen,{prop});
 const partial=structuredClone(f.parent);partial.variants[1].children=[];
 const partialContract=read(partial);const part=walkAnatomy(partialContract).find(w=>w.part.component)?.part;
 assert(part===undefined || part.visibleWhen?.equals===false || part.presenceByCombination!==undefined);
});


test('direct visibility demands can expose an always-hidden owned node without accepting nested authority',()=>{
 const f=fixture();for(const v of f.child.variants)v.children[1].hidden=true;
 const r=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child},opts);assert.deepEqual(r.skipped,[]);const c=ContractSchema.parse(r.proposals.find(p=>p.setName==='SourceChild')!.contract),part=walkAnatomy(c).find(w=>w.part.visibilityOverrideProp)!.part;assert.equal(part.visibilityOverrideDefault,false);
 const nested={...f.target,instancePath:[0]};f.parent.variants[0].children[0].hostOverrides[0].visibilityTarget=nested;assert.deepEqual(visibilityDemandsFromDumps({parent:f.parent},'file'),[]);
 assert.throws(()=>demandedVisibilityNodes(f.child,'file',[{fileKey:'file',target:nested}]),/source-identity-unqualified/);
 const result=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child},opts);assert.deepEqual(result.skipped,[]);assert(result.proposals.find(p=>p.setName==='SourceParent')!.notes.some(n=>n.includes('host override(s)')));
});

test('visibility target may own an instance root but never cross into its dependency',()=>{
 const {child,parent,target}=fixture();const node=child.variants[0].children[1];
 delete node.text;node.type='INSTANCE';node.instanceOf='Leaf';
 const demands=visibilityDemandsFromDumps({parent},'file');
 assert.equal(demandedVisibilityNodes(child,'file',demands).get(node.nodeId)!.length,1);
 node.children=[{type:'TEXT',nodeId:'nested',name:'Nested'}];
 assert.throws(()=>demandedVisibilityNodes(child,'file',[{fileKey:'file',target:{...target,childPath:[1,0],nodeId:'Iusage;nested'}}]),/crosses-instance-owner/);
});

test('caller visibility retains a hidden instance owner and both React renderers restore its default',async()=>{
 const f=fixture();
 const leaf:any={setName:'Leaf',key:'leaf-key',nodeId:'leaf-main',type:'COMPONENT',variants:[{name:'Leaf',nodeId:'leaf-main',type:'COMPONENT',layout:f.child.variants[0].layout,children:[{name:'Text',type:'TEXT',nodeId:'leaf-text',text:{characters:'Revealed control',fontSize:14,fontStyle:'Regular',lineHeight:18}}]}]};
 for(const v of f.child.variants){const node=v.children[1];delete node.text;Object.assign(node,{type:'INSTANCE',instanceOf:'Leaf',instanceKey:'leaf-key',hidden:true});}
 const dump={SourceParent:f.parent,SourceChild:f.child,Leaf:leaf};
 const result=proposeBatchFromDump(dump,opts);assert.deepEqual(result.skipped,[]);
 const proposal=result.proposals.find(p=>p.setName==='SourceChild')!,child=ContractSchema.parse(proposal.contract),binding=proposal.visibilityBindings![0];
 const part=walkAnatomy(child).find(w=>w.part.visibilityOverrideProp===binding.prop)!.part;
 assert(part.component);assert.equal(part.visibilityOverrideDefault,false);
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{mountGenerated}=await import('./react-test-runtime.js'),{chromium}=await import('playwright-core');
 const merge=(a:any,b:any)=>{for(const [k,v]of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const contracts=result.proposals.map(p=>ContractSchema.parse(p.contract)),scope=new Map(contracts.map(c=>[c.id,c]));
 const tokens={primitives:result.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens,contracts:scope,icons:new Map<string,string>()},browser=await chromium.launch({headless:true});
 try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(child,ctx),deps=Object.fromEntries(contracts.filter(c=>c.id!==child.id).map(c=>{const fs=emitter.emit(c,ctx);return[c.name,{tsx:fs[0].contents,css:fs.find(f=>f.path.endsWith('.css'))?.contents}];}));
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,child.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,deps);
   assert.doesNotMatch(await page.locator('#root').innerText(),/Revealed control/);
   await render({[binding.prop]:true});assert.match(await page.locator('#root').innerText(),/Revealed control/);
   await render({[binding.prop]:false});assert.doesNotMatch(await page.locator('#root').innerText(),/Revealed control/);
   await render({});assert.doesNotMatch(await page.locator('#root').innerText(),/Revealed control/);
  }finally{await page.close();}
 }}finally{await browser.close();}
 const absent=structuredClone(dump);delete absent.SourceParent.variants[0].children[0].hostOverrides;
 const noDemand=proposeBatchFromDump(absent,opts);assert.deepEqual(noDemand.skipped,[]);
 assert(!walkAnatomy(ContractSchema.parse(noDemand.proposals.find(p=>p.setName==='SourceChild')!.contract)).some(w=>w.part.component));
});

test('visibility rows combine different source mains sharing one generated control',()=>{
 const f=fixture();
 f.parent.propertyDefinitions.Case.variantOptions=['One','Two','Absent'];
 f.parent.variants=['One','Two','Absent'].map((value,i)=>{
  const v=structuredClone(f.parent.variants[0]);v.name='Case='+value;v.variantProperties.Case=value;v.nodeId='parent-'+i;
  const n=v.children[0];n.nodeId='usage-'+i;n.componentProperties.Mode=i===1?'On':'Off';
  if(i===2)delete n.hostOverrides;
  else n.hostOverrides[0].visibilityTarget={...f.target,instanceId:n.nodeId,nodeId:'I'+n.nodeId+';target-'+i,componentId:'main-'+i,visible:i===0};
  return v;
 });
 const run=(parent:any)=>proposeBatchFromDump({SourceParent:parent,SourceChild:f.child},opts);
 const r=run(f.parent);assert.deepEqual(r.skipped,[]);
 const cp=r.proposals.find(p=>p.setName==='SourceChild')!,prop=cp.visibilityBindings![0].prop;
 const parent=ContractSchema.parse(r.proposals.find(p=>p.setName==='SourceParent')!.contract);
 const part=walkAnatomy(parent).find(w=>w.part.component)!.part;
 const table=part.component!.booleanPropsByCombination![prop];
 assert.deepEqual(table.rows.map(row=>row.value),[true,false,null]);
 const reversed=structuredClone(f.parent);reversed.variants.reverse();
 const rr=run(reversed);assert.deepEqual(rr.skipped,[]);
 const rp=ContractSchema.parse(rr.proposals.find(p=>p.setName==='SourceParent')!.contract);
 const rt=walkAnatomy(rp).find(w=>w.part.component)!.part.component!.booleanPropsByCombination![prop];
 assert.deepEqual(Object.fromEntries(rt.rows.map(row=>[row.values[0],row.value])),Object.fromEntries(table.rows.map(row=>[row.values[0],row.value])));
 const conflict=structuredClone(f.parent);const n=conflict.variants[0].children[0];n.hostOverrides.push({...n.hostOverrides[0],visibilityTarget:{...n.hostOverrides[0].visibilityTarget,visible:false}});
 assert(run(conflict).skipped.some(s=>s.reason.includes('visibility-control-source-conflict')));
});

test('hidden instance retained for caller visibility participates in explicit child paint order',()=>{
 const f=fixture();
 const leaf:any={setName:'Leaf',key:'leaf-key',nodeId:'leaf-main',type:'COMPONENT',variants:[{name:'Leaf',nodeId:'leaf-main',type:'COMPONENT',children:[{name:'Ink',type:'TEXT',nodeId:'leaf-ink',text:{characters:'Control',fontSize:14,fontStyle:'Regular',lineHeight:18}}]}]};
 for(const [i,v]of f.child.variants.entries()){
  const target=v.children[1];delete target.text;Object.assign(target,{type:'INSTANCE',instanceOf:'Leaf',instanceKey:'leaf-key',hidden:true});
  v.children.push(...['A','B'].map(name=>({name,type:'TEXT',nodeId:name+i,text:{characters:name,fontSize:14,fontStyle:'Regular',lineHeight:18}})));
  if(i===1)v.children=[v.children[2],v.children[0],v.children[1],v.children[3]];
  v.itemReverseZIndex=true;
 }
 const result=proposeBatchFromDump({SourceParent:f.parent,SourceChild:f.child,Leaf:leaf},opts);assert.deepEqual(result.skipped,[]);
 const c=ContractSchema.parse(result.proposals.find(p=>p.setName==='SourceChild')!.contract);
 const key=Object.entries(c.anatomy.root.parts!).find(([,part])=>part.visibilityOverrideProp)![0];
 assert.equal(c.anatomy.root.parts![key].visibilityOverrideDefault,false);
 assert(c.anatomy.root.layout!.childOrder!.includes(key));
 for(const mode of ['off','on'])assert(resolveLayout(c.anatomy.root,{mode})!.childOrder!.includes(key));
});
