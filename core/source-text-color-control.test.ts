import {nestedCharacterRoutes} from './source-character-control.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {chromium} from 'playwright-core';
import {emitReact} from './emit-react.js';import {mountGenerated} from './react-test-runtime.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {proposeFromDump,proposeBatchFromDump} from './propose-figma.js';import {tokenCorpusFromJson} from './token-corpus.js';import {ContractSchema,walkAnatomy,absentVariantAxes} from '../scripts/contract-schema.js';
import {textColorDemandsFromDumps,demandedTextColorNodes,textColorBindingMatches} from './source-text-color-control.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(){const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const child:any={setName:'SourceChild',key:'child-key',nodeId:'set-child',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']}},variants:['Off','On'].map((mode,i)=>({name:'Mode='+mode,type:'COMPONENT',nodeId:'main-'+i,variantProperties:{Mode:mode},layout,children:[{name:'Duplicate',type:'TEXT',nodeId:'other-'+i,text:{characters:'Base',fontSize:14,fontStyle:'Regular',lineHeight:18}},{name:'Duplicate',type:'TEXT',nodeId:'target-'+i,fill:{hex:'aa0000'},text:{characters:'Underline',fontSize:14,fontStyle:'Regular',lineHeight:18}}]}))};
 const target={nodeId:'Iusage;target-0',instanceId:'usage',componentId:'main-0',instancePath:[],childPath:[1],};
 const parent:any={setName:'SourceParent',key:'parent-key',nodeId:'set-parent',type:'COMPONENT_SET',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One']}},variants:[{name:'Case=One',type:'COMPONENT',nodeId:'parent-main',variantProperties:{Case:'One'},layout,children:[{name:'SourceChild',type:'INSTANCE',nodeId:'usage',instanceOf:'SourceChild',instanceKey:'child-key',componentProperties:{Mode:'Off'},hostOverrides:[{path:'Duplicate',fields:['fills'],fill:{hex:'112233'},textFillTarget:target}]}]}]};return{child,parent,target};}

const opts={fileKey:'file',corpus,contractIdByName:new Map<string,string>(),mintUnbound:true,hiddenCaptured:true,stampsObservable:true};
test('a sole lowercase label retains its numeric target when a host requires an ink control',()=>{
 const {child,parent,target}=fixture();
 for(const v of child.variants){v.children=[v.children[1]];v.children[0].name='label';}
 target.childPath=[0];parent.variants[0].children[0].hostOverrides[0].path='label';
 const result=proposeBatchFromDump({SourceChild:child,SourceParent:parent},opts);
 assert.deepEqual(result.skipped,[]);
 const proposal=result.proposals.find(p=>p.setName==='SourceChild')!,contract=ContractSchema.parse(proposal.contract);
 const controlled=walkAnatomy(contract).find(w=>w.part.textColorOverrideProp);
 assert(controlled);assert.equal(controlled.part.text,'Underline');
 assert.notEqual(controlled.part,contract.anatomy.root);
 assert(textColorBindingMatches(proposal.textColorBindings![0],contract,'file',target));
 const ordinary=ContractSchema.parse(proposeFromDump(child,opts).contract);
 assert.equal(ordinary.anatomy.root.text,'Underline','an undemanded label still uses the original root-text spelling');
});
test('text paint demand binds numeric identity and rejects stale or wrong-source authority',()=>{
 const {child,parent,target}=fixture(),demands=textColorDemandsFromDumps({parent},'file'),proposal=proposeFromDump(child,{...opts,textColorDemands:demands}),c=ContractSchema.parse(proposal.contract),binding=proposal.textColorBindings![0];
 assert.equal(walkAnatomy(c).find(w=>w.part.textColorOverrideProp)?.part.text,'Underline');assert(textColorBindingMatches(binding,c,'file',target));
 const bad=structuredClone(c);bad.description+=' modified';assert(!textColorBindingMatches(binding,bad,'file',target));
 assert.throws(()=>demandedTextColorNodes(child,'file',[{...demands[0],target:{...target,nodeId:'Iusage;other-0'}}]),/source-target-unqualified/);
});
test('batch carries only explicit text paint overrides and leaves unoverridden axis values omitted',async()=>{
 const {child,parent}=fixture();parent.propertyDefinitions.Case.variantOptions.push('Two');const missing=structuredClone(parent.variants[0]);missing.name='Case=Two';missing.variantProperties.Case='Two';missing.nodeId='parent-two';missing.children[0].nodeId='usage-two';delete missing.children[0].hostOverrides;parent.variants.push(missing);
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);const childProposal=result.proposals.find(p=>p.setName==='SourceChild')!,parentProposal=result.proposals.find(p=>p.setName==='SourceParent')!;
 const prop=childProposal.textColorBindings![0].prop,ref=walkAnatomy(ContractSchema.parse(parentProposal.contract)).find(w=>w.part.component)!;
 assert.deepEqual(ref.part.component!.props![prop],{prop:'caseProp',map:{one:'#112233'}});
 const cc=ContractSchema.parse(childProposal.contract),pc=ContractSchema.parse(parentProposal.contract),contracts=new Map([[cc.id,cc],[pc.id,pc]]),icons=new Map();
 const refs=new Set([...JSON.stringify([cc,pc]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]));
 const childCode=emitReact(cc,{contracts,icons,tokens:refs}),parentCode=emitReact(pc,{contracts,icons,tokens:refs});
 const browser=await chromium.launch();try{const page=await browser.newPage();const render=await mountGenerated(page,pc.name,parentCode.tsx,parentCode.css,{[cc.name]:{tsx:childCode.tsx,css:childCode.css}});
 for(const [value,color] of [['one','rgb(17, 34, 51)'],['two',''],['one','rgb(17, 34, 51)']]){await render({caseProp:value});assert.equal(await page.getByText('Underline',{exact:true}).evaluate(n=>(n as HTMLElement).style.color),color);assert.equal(await page.getByText('Base',{exact:true}).evaluate(n=>(n as HTMLElement).style.color),'');}
 }finally{await browser.close();}

});

test('one text input collects matching owners across child variants before axis inference',()=>{
 const {child,parent}=fixture();parent.propertyDefinitions={Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']},Mode:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']}};
 const original=parent.variants[0];parent.variants=['Off','On'].flatMap((mode,i)=>['One','Two'].map((which,j)=>{const v=structuredClone(original),id='usage-'+i+'-'+j;v.name=`Case=${which}, Mode=${mode}`;v.variantProperties={Case:which,Mode:mode};v.nodeId='parent-'+i+'-'+j;const n=v.children[0];n.nodeId=id;n.componentProperties.Mode=mode;if(j)delete n.hostOverrides;else n.hostOverrides[0].textFillTarget={nodeId:`I${id};target-${i}`,instanceId:id,componentId:'main-'+i,instancePath:[],childPath:[1]};return v;}));
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
 const c=result.proposals.find(p=>p.setName==='SourceChild')!,p=result.proposals.find(p=>p.setName==='SourceParent')!,prop=c.textColorBindings![0].prop;
 assert.equal(new Set(c.textColorBindings!.map(b=>b.componentId)).size,2);const ref=walkAnatomy(ContractSchema.parse(p.contract)).find(w=>w.part.component)!;
 assert.deepEqual(ref.part.component!.props![prop],{prop:'caseProp',map:{one:'#112233'}});
});


test('unroutable nested paint stays named without poisoning the captured child proposal',()=>{
 const {child,parent,target}=fixture();
 const nested={...target,nodeId:'IIusage;inner;target-0',instanceId:'Iusage;inner',instancePath:[0,1]};
 parent.variants[0].children[0].hostOverrides[0].textFillTarget=nested;
 assert.deepEqual(textColorDemandsFromDumps({parent},'file'),[]);
 // Explicitly supplied nested authority is still refused by the same guard.
 assert.throws(()=>demandedTextColorNodes(child,'file',[{fileKey:'file',target:nested,color:'#112233'}]),/source-identity-unqualified/);
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);
 assert.deepEqual(result.skipped,[]);
 const source=result.proposals.find(p=>p.setName==='SourceChild')!;
 assert.equal(source.textColorBindings?.length??0,0);
 assert(!walkAnatomy(ContractSchema.parse(source.contract)).some(w=>w.part.textColorOverrideProp));
 const caller=result.proposals.find(p=>p.setName==='SourceParent')!;
 assert(caller.notes.some(n=>n.includes('host override(s)')&&n.includes('named fidelity limit')));
});

test('one captured text node carries both character and color demands',()=>{
 for(const existing of [false,true]){
  const {child,parent,target}=fixture();
  if(existing){child.propertyDefinitions.Label={type:'TEXT',defaultValue:'Underline'};for(const v of child.variants)v.children[1].propRefs={characters:'Label'};}
  const instance=parent.variants[0].children[0];instance.textOverrides={Duplicate:'Changed'};instance.textOverrideTargets={Duplicate:target};
  const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
  const proposal=result.proposals.find(p=>p.setName==='SourceChild')!,c=ContractSchema.parse(proposal.contract);
  const part=walkAnatomy(c).find(w=>w.part.textColorOverrideProp)!.part;
  assert(part.content);assert.equal(part.text,undefined);
  assert.equal(c.props.find(p=>p.name===part.content!.prop)?.default,'Underline');
  assert(proposal.characterBindings!.some(b=>b.prop===part.content!.prop));assert(proposal.textColorBindings!.length);
 }
});

function sparseCharacters(){
 const {child,parent,target}=fixture();
 parent.propertyDefinitions.Case.variantOptions=['One','Two','Three'];
 const original=parent.variants[0];
 parent.variants=['One','Two','Three'].map((which,i)=>{
  const v=structuredClone(original),id='usage-'+i;v.name='Case='+which;v.nodeId='parent-'+i;v.variantProperties.Case=which;
  const n=v.children[0];n.nodeId=id;delete n.hostOverrides;
  if(i){n.textOverrides={Duplicate:i===1?'Changed':''};n.textOverrideTargets={Duplicate:{...target,instanceId:id,nodeId:'I'+id+';target-0'}};}
  return v;
 });return{child,parent};
}
test('explicit character overrides map sparsely without inventing a value for omissions',async()=>{
 const {child,parent}=sparseCharacters();
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
 const childProposal=result.proposals.find(p=>p.setName==='SourceChild')!,parentProposal=result.proposals.find(p=>p.setName==='SourceParent')!;
 const cc=ContractSchema.parse(childProposal.contract),pc=ContractSchema.parse(parentProposal.contract),prop=childProposal.characterBindings![0].prop;
 const ref=walkAnatomy(pc).find(w=>w.part.component)!;
 assert.deepEqual(ref.part.component!.props![prop],{prop:'caseProp',map:{two:'Changed',three:''}});
 const contracts=new Map([[cc.id,cc],[pc.id,pc]]),icons=new Map();
 const refs=new Set([...JSON.stringify([cc,pc]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]));
 const childCode=emitReact(cc,{contracts,icons,tokens:refs}),parentCode=emitReact(pc,{contracts,icons,tokens:refs});
 const browser=await chromium.launch();try{const page=await browser.newPage(),render=await mountGenerated(page,pc.name,parentCode.tsx,parentCode.css,{[cc.name]:{tsx:childCode.tsx,css:childCode.css}});
  for(const [caseProp,label] of [['one','Underline'],['two','Changed'],['three',''],['one','Underline']]){
   await render({caseProp});const text=await page.locator('body').innerText();assert(text.includes('Base'));assert.equal(text.includes('Underline'),label==='Underline');assert.equal(text.includes('Changed'),label==='Changed');
  }
 }finally{await browser.close()}
});
test('an explicit character value without its identity is still refused, not treated as omission',()=>{
 const {child,parent}=sparseCharacters();delete parent.variants[2].children[0].textOverrideTargets;
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts),c=result.proposals.find(p=>p.setName==='SourceChild')!,p=result.proposals.find(p=>p.setName==='SourceParent')!;
 const prop=c.characterBindings![0].prop;
 assert(!walkAnatomy(ContractSchema.parse(p.contract)).some(w=>w.part.component?.props?.[prop]!==undefined));
 assert(p.notes.some(n=>n.includes('character-override-not-carried')&&n.includes('identity')));
});
test('absence of the child in other source planes does not erase its qualified character inputs',()=>{
 const {child,parent}=sparseCharacters();parent.propertyDefinitions.Show={type:'VARIANT',defaultValue:'Yes',variantOptions:['Yes','No']};
 parent.variants=parent.variants.flatMap((v:any)=>['Yes','No'].map(show=>{const out=structuredClone(v);out.name+=', Show='+show;out.variantProperties.Show=show;out.nodeId+='-'+show;if(show==='No')out.children=[];return out;}));
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
 const c=result.proposals.find(p=>p.setName==='SourceChild')!,p=result.proposals.find(p=>p.setName==='SourceParent')!,prop=c.characterBindings![0].prop;
 assert(walkAnatomy(ContractSchema.parse(p.contract)).some(w=>JSON.stringify(w.part.component?.props?.[prop])===JSON.stringify({prop:'caseProp',map:{two:'Changed',three:''}})));
});

test('omitted and explicit values at the same axis value cannot be collapsed into a lookup',()=>{
 const {child,parent}=sparseCharacters();parent.propertyDefinitions.Case.variantOptions=['One','Two'];parent.propertyDefinitions.Mode={type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']};
 const original=parent.variants[1];parent.variants=['One','Two'].flatMap((which,i)=>['Off','On'].map((mode,j)=>{
  const v=structuredClone(original),id='usage-'+i+'-'+j;v.nodeId='parent-'+i+'-'+j;v.name='Case='+which+', Mode='+mode;v.variantProperties={Case:which,Mode:mode};const n=v.children[0];n.nodeId=id;
  if(i===j){delete n.textOverrides;delete n.textOverrideTargets;}else n.textOverrideTargets.Duplicate={...n.textOverrideTargets.Duplicate,instanceId:id,nodeId:'I'+id+';target-0'};
  return v;
 }));
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
 const c=result.proposals.find(p=>p.setName==='SourceChild')!,p=result.proposals.find(p=>p.setName==='SourceParent')!,prop=c.characterBindings![0].prop;
 assert(!walkAnatomy(ContractSchema.parse(p.contract)).some(w=>w.part.component?.props?.[prop]!==undefined));
 assert(p.notes.some(n=>n.includes('no complete text mapping')));
});

function nestedCharacters(){
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const leaf:any={setName:'Leaf',type:'COMPONENT',key:'leaf-key',nodeId:'leaf-main',propertyDefinitions:{},variants:[{name:'Leaf',type:'COMPONENT',nodeId:'leaf-main',layout,children:[{name:'label',type:'TEXT',nodeId:'leaf-text',text:{characters:'Default',fontFamily:'Arial',fontStyle:'Regular',fontSize:14,fontWeight:400,lineHeight:20}}]}]};
 const wrapper:any={setName:'Wrapper',type:'COMPONENT',key:'wrapper-key',nodeId:'wrapper-main',propertyDefinitions:{Content:{type:'INSTANCE_SWAP',defaultValue:'leaf-main'}},variants:[{name:'Wrapper',type:'COMPONENT',nodeId:'wrapper-main',layout,children:[{name:'Content',type:'INSTANCE',nodeId:'inner',instanceOf:'Leaf',instanceKey:'leaf-key',propRefs:{mainComponent:'Content'},instanceGeometry:{nodeId:'inner',componentId:'leaf-main'},layout}]}]};
 const parent:any={setName:'Caller',type:'COMPONENT_SET',key:'caller-key',nodeId:'caller-set',propertyDefinitions:{Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']}},variants:['One','Two'].map((name,i)=>({name:'Case='+name,type:'COMPONENT',nodeId:'caller-'+i,variantProperties:{Case:name},layout,children:[{name:'Wrapper',type:'INSTANCE',nodeId:'usage-'+i,instanceOf:'Wrapper',instanceKey:'wrapper-key',instanceGeometry:{nodeId:'usage-'+i,componentId:'wrapper-main'},layout,textOverrides:{'Content/label':i?'Board':'Table'},textOverrideTargets:{'Content/label':{nodeId:`Iusage-${i};inner;leaf-text`,instanceId:`Iusage-${i};inner`,componentId:'leaf-main',instancePath:[0],childPath:[0]}}}]}))};
 return {Leaf:leaf,Wrapper:wrapper,Caller:parent};
}
for(const fixedSwap of [false,true,'different','conditional','joint','jointConditional','conditionalMulti'])test(`nested raw characters use an identity-qualified slot without replacing its default (fixed swap=${fixedSwap})`,async()=>{
 let dump=nestedCharacters();
 if(fixedSwap)for(const v of dump.Caller.variants)v.children[0].fixedSwaps={Content:{id:'leaf-main',key:'leaf-key',name:'Leaf'}};
 if(fixedSwap==='different'||fixedSwap==='conditional'||fixedSwap==='jointConditional'||fixedSwap==='conditionalMulti'){
  const old=structuredClone(dump.Leaf);old.setName='OldLeaf';old.key='old-key';old.nodeId='old-main';old.variants[0].name='OldLeaf';old.variants[0].nodeId='old-main';old.variants[0].children[0].nodeId='old-text';
  dump=Object.assign({OldLeaf:old},dump);dump.Wrapper.propertyDefinitions.Content.defaultValue='old-main';
  const inner=dump.Wrapper.variants[0].children[0];inner.instanceOf='OldLeaf';inner.instanceKey='old-key';inner.instanceGeometry.componentId='old-main';
  for(const v of dump.Caller.variants)v.children[0].fixedSwaps.Content.observedInstances=[{nodeId:'I'+v.children[0].nodeId+';inner',path:[0],componentId:'leaf-main'}];
 }

 if(fixedSwap==='conditional'||fixedSwap==='conditionalMulti'){const n=dump.Caller.variants[1].children[0];n.fixedSwaps.Content={id:'old-main',key:'old-key',name:'OldLeaf',observedInstances:[{nodeId:'I'+n.nodeId+';inner',path:[0],componentId:'old-main'}]};delete n.textOverrides;delete n.textOverrideTargets;}
 if(fixedSwap==='joint'||fixedSwap==='jointConditional'){
  dump.Caller.propertyDefinitions.Mode={type:'VARIANT',defaultValue:'A',variantOptions:['A','B']};
  dump.Caller.variants=dump.Caller.variants.flatMap((v:any,i:number)=>['A','B'].map((mode,j)=>{const copy=structuredClone(v),n=copy.children[0],id=n.nodeId+'-'+j;copy.name+=', Mode='+mode;copy.variantProperties.Mode=mode;copy.nodeId+='-'+j;n.nodeId=id;n.instanceGeometry.nodeId=id;if(n.fixedSwaps.Content.observedInstances)n.fixedSwaps.Content.observedInstances[0].nodeId='I'+id+';inner';n.textOverrides['Content/label']=i===j?'Table':'Board';n.textOverrideTargets['Content/label'].instanceId='I'+id+';inner';n.textOverrideTargets['Content/label'].nodeId='I'+id+';inner;leaf-text';return copy;}));
 }
 if(fixedSwap==='jointConditional'){
  dump.Caller.propertyDefinitions.Case.variantOptions.push('Three');
  for(const mode of ['A','B']){const v=structuredClone(dump.Caller.variants[0]),n=v.children[0],id='third-'+mode;v.name='Case=Three, Mode='+mode;v.nodeId='parent-'+id;v.variantProperties={Case:'Three',Mode:mode};n.nodeId=id;n.instanceGeometry.nodeId=id;n.fixedSwaps.Content={id:'old-main',key:'old-key',name:'OldLeaf',observedInstances:[{nodeId:'I'+id+';inner',path:[0],componentId:'old-main'}]};delete n.textOverrides;delete n.textOverrideTargets;dump.Caller.variants.push(v);}
 }
 if(fixedSwap==='conditionalMulti'){
  dump.Wrapper.propertyDefinitions.Second={type:'INSTANCE_SWAP',defaultValue:'leaf-main'};
  const second=structuredClone(dump.Wrapper.variants[0].children[0]);second.name='Second';second.nodeId='second';second.instanceOf='Leaf';second.instanceKey='leaf-key';second.instanceGeometry={nodeId:'second',componentId:'leaf-main'};second.propRefs={mainComponent:'Second'};dump.Wrapper.variants[0].children.push(second);
  for(const v of dump.Caller.variants){const n=v.children[0];n.textOverrides={...n.textOverrides,'Second/label':'Secondary'};n.textOverrideTargets={...n.textOverrideTargets,'Second/label':{nodeId:'I'+n.nodeId+';second;leaf-text',instanceId:'I'+n.nodeId+';second',componentId:'leaf-main',instancePath:[1],childPath:[0]}};}
 }
 const snapshot=JSON.stringify(dump),batch=proposeBatchFromDump(dump,opts);assert.deepEqual(batch.skipped,[]);assert.equal(JSON.stringify(dump),snapshot);
 const contracts=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return [c.id,c];}));
 const parent=batch.proposals.find(p=>p.setName==='Caller')!,pc=ContractSchema.parse(parent.contract);
 assert(parent.notes.some(n=>n.includes('nested source characters carried')),JSON.stringify({contract:pc,notes:parent.notes}));
 const leaf=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Leaf')!.contract),wrapper=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Wrapper')!.contract);
 const textProp=leaf.props.find(p=>p.type==='text')!;assert.equal(textProp.default,'Default');
 const baseline=structuredClone(dump);for(const v of baseline.Caller.variants){delete v.children[0].textOverrides;delete v.children[0].textOverrideTargets;}
 const baselineWrapper=proposeBatchFromDump(baseline,opts).proposals.find(p=>p.setName==='Wrapper')!;assert.deepEqual(wrapper,ContractSchema.parse(baselineWrapper.contract));
 const merge=(a:any,b:any)=>{for(const [k,v]of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const ctx={contracts,icons:new Map<string,string>(),tokens:{primitives:batch.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}}};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
 const page=await browser.newPage(),code=emitter.emit(pc,ctx);
 const dependencies=Object.fromEntries([...contracts.values()].filter(c=>c.id!==pc.id).map(c=>{const e=emitter.emit(c,ctx);return [c.name,{tsx:e[0].contents,css:e.find(f=>f.path.endsWith('.css'))?.contents}];}));
 const render=await mountGenerated(page,pc.name,code[0].contents,code.find(f=>f.path.endsWith('.css'))?.contents,dependencies);
 for(const [value,text,argumentsMode] of ((fixedSwap==='joint'||fixedSwap==='jointConditional')?[['one','Table','a'],['one','Board','b'],['two','Board','a'],['two','Table','b'],['one','Table','a']]:[['one','Table'],['two',(fixedSwap==='conditional'||fixedSwap==='conditionalMulti')?'Default':'Board'],['one','Table']])){await render({caseProp:value,mode:argumentsMode});assert.equal(await page.getByText(text,{exact:true}).count(),1);assert.equal(await page.getByText('Default',{exact:true}).count(),text==='Default'?1:0);if(fixedSwap==='conditionalMulti')assert.equal(await page.getByText('Secondary',{exact:true}).count(),1);}
 if(fixedSwap==='jointConditional'){await render({caseProp:'three',mode:'a'});assert.equal(await page.getByText('Default',{exact:true}).count(),1);assert.equal(await page.getByText('Table',{exact:true}).count(),0);}
 const wc=emitter.emit(wrapper,ctx),renderWrapper=await mountGenerated(page,wrapper.name,wc[0].contents,wc.find(f=>f.path.endsWith('.css'))?.contents,dependencies);await renderWrapper({});if(fixedSwap!=='different'&&fixedSwap!=='conditional'&&fixedSwap!=='jointConditional'&&fixedSwap!=='conditionalMulti')assert.equal(await page.getByText('Default',{exact:true}).count(),1);
 await page.close();
 }}finally{await browser.close();}
});
for(const fixedSwap of [false,true])test(`stale paths and swapped nested mains never authorize caller text (fixed swap=${fixedSwap})`,()=>{
 for(const mutate of [(n:any)=>n.textOverrideTargets['Content/label'].nodeId+='-stale',(n:any)=>n.instanceKey='wrong',(n:any)=>n.textOverrideTargets['Content/label'].instancePath=[2],(n:any)=>n.textOverrideTargets['Content/label'].componentId='swapped']){
  const dump=nestedCharacters();for(const v of dump.Caller.variants){if(fixedSwap)v.children[0].fixedSwaps={Content:{id:'leaf-main',key:'leaf-key',name:'Leaf'}};mutate(v.children[0]);}const batch=proposeBatchFromDump(dump,opts);assert.deepEqual(batch.skipped,[]);assert(!batch.proposals.some(p=>p.notes.some(n=>n.includes('nested source characters carried'))));
 }
});

test('nested text mapping covers the proven part-presence domain without inventing absent labels',async()=>{
 const dump=nestedCharacters();dump.Caller.propertyDefinitions.Case.variantOptions.push('Three');const absent=structuredClone(dump.Caller.variants[0]);absent.name='Case=Three';absent.nodeId='caller-absent';absent.variantProperties.Case='Three';absent.children=[];dump.Caller.variants.push(absent);
 const batch=proposeBatchFromDump(dump,opts);assert.deepEqual(batch.skipped,[]);const contracts=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c];})),pc=[...contracts.values()].find(c=>c.name==='Caller')!;
 const tokens=new Set([...JSON.stringify([...contracts.values()]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1])),icons=new Map();
 const browser=await chromium.launch();try{const page=await browser.newPage(),code=emitReact(pc,{contracts,icons,tokens}),deps=Object.fromEntries([...contracts.values()].filter(c=>c.id!==pc.id).map(c=>{const e=emitReact(c,{contracts,icons,tokens});return[c.name,{tsx:e.tsx,css:e.css}];})),render=await mountGenerated(page,pc.name,code.tsx,code.css,deps);
 for(const [value,text]of [['one','Table'],['two','Board'],['three',''],['one','Table']]){await render({caseProp:value});if(text)assert.equal(await page.getByText(text,{exact:true}).count(),1);else{assert.equal(await page.getByText('Table',{exact:true}).count(),0);assert.equal(await page.getByText('Board',{exact:true}).count(),0);}assert.equal(await page.getByText('Default',{exact:true}).count(),0);}
 }finally{await browser.close();}
});

test('multi-axis text paint preserves omissions and absent parts on React and native plans',async()=>{
 const {child,parent}=fixture(),original=structuredClone(parent.variants[0]);
 parent.propertyDefinitions={Case:{type:'VARIANT',defaultValue:'One',variantOptions:['One','Two']},Tone:{type:'VARIANT',defaultValue:'Cold',variantOptions:['Cold','Warm']}};
 parent.variants=['One','Two'].flatMap((which,i)=>['Cold','Warm'].map((tone,j)=>{const v=structuredClone(original),id='use-'+i+j;v.name=`Case=${which}, Tone=${tone}`;v.nodeId='parent-'+i+j;v.variantProperties={Case:which,Tone:tone};const n=v.children[0];n.nodeId=id;n.hostOverrides[0].textFillTarget={nodeId:`I${id};target-0`,instanceId:id,componentId:'main-0',instancePath:[],childPath:[1]};if(i&&j)v.children=[];else if(j)delete n.hostOverrides;else if(i)n.hostOverrides[0].fill.hex='445566';return v;}));
 const batch=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(batch.skipped,[]);const cp=batch.proposals.find(p=>p.setName==='SourceChild')!,cc=ContractSchema.parse(cp.contract),pc=ContractSchema.parse(batch.proposals.find(p=>p.setName==='SourceParent')!.contract),prop=cp.textColorBindings![0].prop,ref=walkAnatomy(pc).find(w=>w.part.component)!.part.component!;
 assert.equal(ref.paintPropsByCombination![prop].rows.length,4);assert.equal(ref.props?.[prop],undefined);
 const broken=structuredClone(pc);walkAnatomy(broken).find(w=>w.part.component)!.part.component!.paintPropsByCombination![prop].rows.pop();assert.equal(ContractSchema.safeParse(broken).success,false);
 const merge=(a:any,b:any)=>{for(const [k,v]of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const contracts=new Map([[cc.id,cc],[pc.id,pc]]),ctx={contracts,tokens:{primitives:batch.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){const c=emitter.emit(cc,ctx),p=emitter.emit(pc,ctx),page=await browser.newPage();try{const render=await mountGenerated(page,pc.name,p[0].contents,p.find(f=>f.path.endsWith('.css'))?.contents,{[cc.name]:{tsx:c[0].contents,css:c.find(f=>f.path.endsWith('.css'))?.contents}});await render({caseProp:'one',tone:'warm'});const defaultColor=await page.getByText('Underline',{exact:true}).evaluate(n=>getComputedStyle(n).color);for(const [caseProp,tone,color]of [['one','cold','rgb(17, 34, 51)'],['one','warm',''],['two','cold','rgb(68, 85, 102)'],['two','warm',null],['one','cold','rgb(17, 34, 51)']]){await render({caseProp,tone});const label=page.getByText('Underline',{exact:true});if(color===null)assert.equal(await label.count(),0);else assert.equal(await label.evaluate(n=>getComputedStyle(n).color),color||defaultColor);}}finally{await page.close();}}}finally{await browser.close();}
 const native=createFigmaEngine(ctx).compileComponentData(pc,contracts),walk=(n:any):any[]=>[n,...(n.children??[]).flatMap(walk)];assert.equal(native.variants.filter(v=>walk(v.spec).some(n=>n.instanceTextColors)).length,2);
 const childNative=createFigmaEngine(ctx).compileComponentData(cc,contracts);
 assert.equal(childNative.variants.length,2,'instance ink inputs must not multiply the two authored Mode variants');
 assert.deepEqual(absentVariantAxes(cc).map(a=>a.prop.name),['mode']);
 assert(childNative.variants.every(v=>!v.name.includes('undefined=')));
 const withOtherEnum=structuredClone(cc);withOtherEnum.props.push({name:'legacy',type:{enum:['a','b']},bindings:{figma:{kind:'NONE'},code:{prop:'legacy'}}});
 assert.deepEqual(absentVariantAxes(withOtherEnum).map(a=>a.prop.name),['mode','legacy'],'other enum semantics remain unchanged');
});

test('promoted parent hover retains an identity-bound child text paint override',()=>{
 const {child,parent}=fixture();
 parent.propertyDefinitions={State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']}};
 const base=parent.variants[0],hover=structuredClone(base);
 base.name='State=Default';base.variantProperties={State:'Default'};delete base.children[0].hostOverrides;
 hover.name='State=Hover';hover.variantProperties={State:'Hover'};hover.nodeId='parent-hover';
 parent.variants=[base,hover];
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
 const cp=result.proposals.find(p=>p.setName==='SourceChild')!,pp=result.proposals.find(p=>p.setName==='SourceParent')!;
 const owner=walkAnatomy(ContractSchema.parse(pp.contract)).find(w=>w.part.component)!.part;
 const prop=cp.textColorBindings![0].prop;
 assert(owner.states?.hover?.['text-color:'+prop]);
 assert.equal(owner.component!.props?.[prop],undefined,'rest keeps its child default');
});

test('child argument tables cover declared absent variants without inventing rows',()=>{
 const {child,parent}=fixture();
 const batch=proposeBatchFromDump({SourceChild:child,SourceParent:parent},opts);
 const c=ContractSchema.parse(batch.proposals.find(p=>p.setName==='SourceParent')!.contract);
 const axis=c.props.find(p=>p.bindings.figma.kind==='VARIANT')!;
 axis.type={enum:['one','two']};axis.bindings.figma.values={one:'One',two:'Two'};
 c.props.push({name:'tone',type:{enum:['cold','warm']},default:'cold',bindings:{figma:{kind:'VARIANT',property:'Tone',values:{cold:'Cold',warm:'Warm'}},code:{prop:'tone'}}});
 c.bindings.figma.absentVariants=[{[axis.name]:'two',tone:'warm'}];
 for(const kind of ['paintPropsByCombination','booleanPropsByCombination'] as const){
  const sample=structuredClone(c),ref=walkAnatomy(sample).find(w=>w.part.component)!.part.component!;
  const value=kind==='paintPropsByCombination'?'#112233':true;
  (ref as any)[kind]={probe:{props:[axis.name,'tone'],rows:[['one','cold'],['one','warm'],['two','cold']].map(values=>({values,value}))}};
  assert.equal(ContractSchema.safeParse(sample).success,true);
  const missing=structuredClone(sample);(walkAnatomy(missing).find(w=>w.part.component)!.part.component as any)[kind].probe.rows.pop();
  assert.equal(ContractSchema.safeParse(missing).success,false,'a missing drawn tuple still refuses');
  (ref as any)[kind].probe.rows.push({values:['two','warm'],value});
  assert.equal(ContractSchema.safeParse(sample).success,false,'an invented absent tuple still refuses');
  (ref as any)[kind].probe={props:[axis.name],rows:[{values:['one'],value},{values:['two'],value}]};
  assert.equal(ContractSchema.safeParse(sample).success,true,'projection retains a value when another-axis combination is drawn');
 }
});

test('large child paint tables emit without recursive conditional formatting',()=>{
 const {child,parent}=fixture(),batch=proposeBatchFromDump({SourceChild:child,SourceParent:parent},opts);
 const cp=batch.proposals.find(p=>p.setName==='SourceChild')!,cc=ContractSchema.parse(cp.contract);
 const pc=ContractSchema.parse(batch.proposals.find(p=>p.setName==='SourceParent')!.contract);
 const axis=pc.props.find(p=>p.bindings.figma.kind==='VARIANT')!,values=['one',...Array.from({length:527},(_,i)=>'v'+i)];
 axis.type={enum:values};axis.bindings.figma.values=Object.fromEntries(values.map(v=>[v,v]));
 const prop=cp.textColorBindings![0].prop,ref=walkAnatomy(pc).find(w=>w.part.component)!.part.component!;
 delete ref.props![prop];ref.paintPropsByCombination={[prop]:{props:[axis.name],rows:values.map((v,i)=>({values:[v],value:i%2?'#112233':null}))}};
 assert.equal(ContractSchema.safeParse(pc).success,true);
 const result=emitReact(pc,{contracts:new Map([[pc.id,pc],[cc.id,cc]]),icons:new Map(),tokens:new Set()});
 assert.match(result.tsx,/Record<string,/);assert.match(result.tsx,/JSON.stringify/);
});

test('source-owned character control preserves a proven conditional text part',async()=>{
 const {child,parent,target}=fixture();
 for(const v of child.variants){v.children[0].name='Other';v.children[1].name='Label';}
 child.variants[1].children.pop();
 const usage=parent.variants[0].children[0];delete usage.hostOverrides;
 usage.textOverrides={Label:'Caller label'};usage.textOverrideTargets={Label:target};
 const batch=proposeBatchFromDump({SourceChild:child,SourceParent:parent},opts);assert.deepEqual(batch.skipped,[]);
 const cp=batch.proposals.find(p=>p.setName==='SourceChild')!,cc=ContractSchema.parse(cp.contract),pc=ContractSchema.parse(batch.proposals.find(p=>p.setName==='SourceParent')!.contract);
 const control=cc.props.find(p=>p.type==='text'&&p.bindings.figma.kind==='TEXT')!;assert(control);
 const owned=walkAnatomy(cc).find(w=>w.part.content?.prop===control.name)!;assert(owned.part.visibleWhen);
 const contracts=new Map([[cc.id,cc],[pc.id,pc]]),ctx={contracts,tokens:new Set([...JSON.stringify([cc,pc]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1])),icons:new Map<string,string>()};
 const childCode=emitReact(cc,ctx),parentCode=emitReact(pc,ctx);
 const browser=await chromium.launch();try{const page=await browser.newPage();const render=await mountGenerated(page,cc.name,childCode.tsx,childCode.css);
 await render({mode:'off',[control.bindings.code.prop]:'Edited'});assert.equal(await page.getByText('Edited',{exact:true}).count(),1);
 await render({mode:'on',[control.bindings.code.prop]:'Edited'});assert.equal(await page.getByText('Edited',{exact:true}).count(),0);
 await mountGenerated(page,pc.name,parentCode.tsx,parentCode.css,{[cc.name]:{tsx:childCode.tsx,css:childCode.css}});assert.equal(await page.getByText('Caller label',{exact:true}).count(),1);
 }finally{await browser.close();}
});

test('demand owners retain dependency order instead of binding a temporary child stub',()=>{
 const {child,parent}=fixture();
 const grand=structuredClone(child);grand.setName='Grandchild';grand.key='grand-key';grand.nodeId='grand-set';
 grand.variants.forEach((v:any,i:number)=>{v.nodeId='grand-main-'+i;v.children.forEach((n:any,j:number)=>n.nodeId='grand-text-'+i+'-'+j);});
 child.variants.forEach((v:any,i:number)=>v.children.push({name:'Grandchild',type:'INSTANCE',nodeId:'grand-use-'+i,instanceOf:'Grandchild',instanceSetKey:'grand-key',instanceKey:'grand-main-key',componentProperties:{Mode:'On'}}));
 const batch=proposeBatchFromDump({Grandchild:grand,SourceChild:child,SourceParent:parent},opts);
 assert.deepEqual(batch.skipped,[]);
 assert.deepEqual(batch.proposals.map(p=>p.setName),['Grandchild','SourceChild','SourceParent']);
 const owner=batch.proposals.find(p=>p.setName==='SourceChild')!;
 assert(!owner.notes.some(n=>n.includes('no known contract')));
 assert.equal(walkAnatomy(ContractSchema.parse(owner.contract)).find(w=>w.part.component)?.part.component?.props?.mode,'on');
});

test('fixed nested raw characters forward to the exact child and preserve the wrapper default',async()=>{
 const dump=nestedCharacters();dump.Wrapper.propertyDefinitions={};delete dump.Wrapper.variants[0].children[0].propRefs;Object.assign(dump.Wrapper.variants[0].children[0],{textOverrides:{label:'Wrapper default'},textOverrideTargets:{label:{nodeId:'Iinner;leaf-text',instanceId:'inner',componentId:'leaf-main',instancePath:[],childPath:[0]}}});const snapshot=JSON.stringify(dump),batch=proposeBatchFromDump(dump,opts);assert.deepEqual(batch.skipped,[]);assert.equal(JSON.stringify(dump),snapshot);
 const contracts=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return [c.id,c];}));
 const parent=batch.proposals.find(p=>p.setName==='Caller')!,pc=ContractSchema.parse(parent.contract);
 assert(batch.proposals.find(p=>p.setName==='Wrapper')!.notes.some(n=>n.includes('fixed nested source characters forwarded')));
 const leaf=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Leaf')!.contract),wrapper=ContractSchema.parse(batch.proposals.find(p=>p.setName==='Wrapper')!.contract);
 const textProp=leaf.props.find(p=>p.type==='text')!;assert.equal(textProp.default,'Default');
 const browser=await chromium.launch();try{const page=await browser.newPage(),icons=new Map(),tokens=new Set([...JSON.stringify([...contracts.values()]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]));
 const code=emitReact(pc,{contracts,icons,tokens});const dependencies=Object.fromEntries([...contracts.values()].filter(c=>c.id!==pc.id).map(c=>{const e=emitReact(c,{contracts,icons,tokens});return [c.name,{tsx:e.tsx,css:e.css}];}));
 const render=await mountGenerated(page,pc.name,code.tsx,code.css,dependencies);
 for(const [value,text] of [['one','Table'],['two','Board'],['one','Table']]){await render({caseProp:value});assert.equal(await page.getByText(text,{exact:true}).count(),1);assert.equal(await page.getByText('Default',{exact:true}).count(),0);}
 const wc=emitReact(wrapper,{contracts,icons,tokens}),renderWrapper=await mountGenerated(page,wrapper.name,wc.tsx,wc.css,dependencies);await renderWrapper({});assert.equal(await page.getByText('Wrapper default',{exact:true}).count(),1);
 }finally{await browser.close();}
});

test('fixed nested character routing refuses stale keys, paths and main identities',()=>{
 for(const mutate of [
  (d:any)=>{d.Wrapper.variants[0].children[0].instanceKey='wrong';},
  (d:any)=>{d.Wrapper.variants[0].children[0].instanceGeometry.componentId='wrong';},
  (d:any)=>{for(const v of d.Caller.variants)v.children[0].textOverrideTargets['Content/label'].instancePath=[1];},
  (d:any)=>{for(const v of d.Caller.variants)v.children[0].textOverrideTargets['Content/label'].nodeId='wrong';},
 ]){
  const d=nestedCharacters();d.Wrapper.propertyDefinitions={};delete d.Wrapper.variants[0].children[0].propRefs;mutate(d);
  const batch=proposeBatchFromDump(d,opts);
  assert(!batch.proposals.some(p=>p.characterBindings?.some(b=>b.forwarded)));
  assert(!batch.proposals.some(p=>p.notes.some(n=>n.includes('fixed nested source characters forwarded'))));
 }
});
test('fixed nested character controls retain the native unsupported-link refusal',()=>{
 const d=nestedCharacters();d.Wrapper.propertyDefinitions={};delete d.Wrapper.variants[0].children[0].propRefs;
 const batch=proposeBatchFromDump(d,opts);assert.deepEqual(batch.skipped,[]);
 const contracts=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c];}));
 const wrapper=[...contracts.values()].find(c=>c.name==='Wrapper')!;
 const merge=(a:any,b:any)=>{for(const [k,v]of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 const ctx={contracts,icons:new Map<string,string>(),tokens:{primitives:batch.proposals.reduce((a,p)=>merge(a,p.mintedTokens?.tree),{}),semantic:{},light:{},dark:{},brands:{default:{}}}};
 assert.throws(()=>createFigmaEngine(ctx).compileComponentData(wrapper,contracts),/FIGMA_NESTED_TEXT_PROP_LINK_UNSUPPORTED/);
});

test('character lookup covers the present instance domain without inventing text for absent variants',async()=>{
 const d=nestedCharacters();d.Wrapper.propertyDefinitions={};delete d.Wrapper.variants[0].children[0].propRefs;
 d.Caller.propertyDefinitions.Case.variantOptions.push('Three');
 const absent=structuredClone(d.Caller.variants[0]);absent.name='Case=Three';absent.nodeId='caller-absent';absent.variantProperties.Case='Three';absent.children=[];d.Caller.variants.push(absent);
 const batch=proposeBatchFromDump(d,opts);assert.deepEqual(batch.skipped,[]);
 const contracts=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c];}));
 const parent=[...contracts.values()].find(c=>c.name==='Caller')!,wrapper=[...contracts.values()].find(c=>c.name==='Wrapper')!;
 const input=wrapper.props.find(p=>p.type==='text')!.name;
 const applied=walkAnatomy(parent).find(w=>w.part.component?.id===wrapper.id)!.part.component!.props?.[input];
 assert.deepEqual(applied,{prop:'caseProp',map:{one:'Table',two:'Board'}});
 const ctx={contracts,icons:new Map<string,string>(),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}};
 const merge=(a:any,b:any)=>{for(const [k,v]of Object.entries(b??{})){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]??{},v);else a[k]=v;}return a;};
 for(const p of batch.proposals)merge(ctx.tokens.primitives,p.mintedTokens?.tree);
 const browser=await chromium.launch();try{
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const page=await browser.newPage();try{
    const code=emitter.emit(parent,ctx),deps=Object.fromEntries([...contracts.values()].filter(c=>c.id!==parent.id).map(c=>{const out=emitter.emit(c,ctx);return[c.name,{tsx:out[0].contents,css:out.find(f=>f.path.endsWith('.css'))?.contents}];}));
    const render=await mountGenerated(page,parent.name,code[0].contents,code.find(f=>f.path.endsWith('.css'))?.contents,deps);
    for(const [value,label]of [['one','Table'],['two','Board'],['three',''],['one','Table']]){
     await render({caseProp:value});assert.equal((await page.locator('body').innerText()).trim(),label);
    }
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});

test('demand owners resolve fixed swap dependencies before retaining caller content',async()=>{
 const {child,parent}=fixture(),nested=nestedCharacters();
 const selected=structuredClone(nested.Leaf);selected.setName='Selected';selected.key='selected-key';selected.nodeId='selected-main';selected.variants[0].name='Selected';selected.variants[0].nodeId='selected-main';selected.variants[0].children[0].nodeId='selected-text';selected.variants[0].children[0].text.characters='Selected drawing';
 child.variants.forEach((v:any,i:number)=>v.children.push({name:'Wrapper',type:'INSTANCE',nodeId:'wrapper-use-'+i,instanceOf:'Wrapper',instanceKey:'wrapper-key',fixedSwaps:{Content:{id:'selected-main',key:'selected-key',name:'Not the matching name'}}}));
 const batch=proposeBatchFromDump({Selected:selected,Leaf:nested.Leaf,Wrapper:nested.Wrapper,SourceChild:child,SourceParent:parent},opts);
 assert.deepEqual(batch.skipped,[]);
 const order=batch.proposals.map(p=>p.setName);assert(order.indexOf('Selected')<order.indexOf('SourceChild'));
 const contracts=new Map(batch.proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c];}));
 const owner=[...contracts.values()].find(c=>c.name==='SourceChild')!,target=[...contracts.values()].find(c=>c.name==='Selected')!,wrapper=[...contracts.values()].find(c=>c.name==='Wrapper')!;
 assert(walkAnatomy(owner).some(w=>w.part.component?.id===target.id));
 assert(!walkAnatomy(wrapper).some(w=>w.part.component?.id===target.id),'standalone wrapper default is unchanged');
 const tokens=new Set([...JSON.stringify([...contracts.values()]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1])),icons=new Map();
 const browser=await chromium.launch();try{const page=await browser.newPage(),out=emitReact(owner,{contracts,tokens,icons});
  const deps=Object.fromEntries([...contracts.values()].filter(c=>c.id!==owner.id).map(c=>{const e=emitReact(c,{contracts,tokens,icons});return[c.name,{tsx:e.tsx,css:e.css}];}));
  const render=await mountGenerated(page,owner.name,out.tsx,out.css,deps);
  for(const mode of ['off','on','off']){await render({mode});assert.equal(await page.getByText('Selected drawing',{exact:true}).count(),1);assert.equal(await page.getByText('Default',{exact:true}).count(),0);}
 }finally{await browser.close();}
});

test('selected nested text routing requires matching swap and observed instance identities',()=>{
 const make=()=>{const d=nestedCharacters(),inner=d.Wrapper.variants[0].children[0];inner.instanceKey='other-key';inner.instanceGeometry.componentId='other-main';
 for(const v of d.Caller.variants)v.children[0].fixedSwaps={Content:{id:'leaf-main',key:'leaf-key',observedInstances:[{nodeId:'I'+v.children[0].nodeId+';inner',path:[0],componentId:'leaf-main'}]}};
 return d;};
 assert.equal(nestedCharacterRoutes(make()).length,2);
 for(const mutate of [
  (s:any)=>{s.key='wrong';},(s:any)=>{s.id='wrong';},(s:any)=>{delete s.observedInstances;},
  (s:any)=>{s.observedInstances[0].nodeId='wrong';},(s:any)=>{s.observedInstances[0].componentId='wrong';},
  (s:any)=>{s.observedInstances[0].path=[1];},(s:any)=>{s.observedInstances.push(s.observedInstances[0]);},
 ]){const d=make();for(const v of d.Caller.variants)mutate(v.children[0].fixedSwaps.Content);assert.deepEqual(nestedCharacterRoutes(d),[]);}
});

test('slot default text ink follows parent variants and explicit content bypasses its paint',async()=>{
 const {child,parent}=fixture();
 child.type='COMPONENT';child.nodeId='main-0';child.propertyDefinitions={};child.variants=[child.variants[0]];child.variants[0].name='SourceChild';child.variants[0].variantProperties={};parent.variants[0].children[0].componentProperties={};
 parent.propertyDefinitions.Content={type:'INSTANCE_SWAP',defaultValue:'main-0'};
 parent.propertyDefinitions.Case.variantOptions.push('Two');
 parent.variants[0].children[0].propRefs={mainComponent:'Content'};
 const second=structuredClone(parent.variants[0]);second.name='Case=Two';second.variantProperties.Case='Two';second.nodeId='parent-two';
 second.children[0].nodeId='usage-two';second.children[0].hostOverrides[0].fill={hex:'445566'};
 second.children[0].hostOverrides[0].textFillTarget.instanceId='usage-two';second.children[0].hostOverrides[0].textFillTarget.nodeId='Iusage-two;target-0';parent.variants.push(second);
 const result=proposeBatchFromDump({SourceParent:parent,SourceChild:child},opts);assert.deepEqual(result.skipped,[]);
 const cc=ContractSchema.parse(result.proposals.find(p=>p.setName==='SourceChild')!.contract),pc=ContractSchema.parse(result.proposals.find(p=>p.setName==='SourceParent')!.contract);
 const slot=walkAnatomy(pc).find(w=>w.part.slot)!.part;
 const ref=Object.values(slot.parts??{})[0]?.component;assert.ok(ref?.paintPropsByCombination);
 const contracts=new Map([[cc.id,cc],[pc.id,pc]]),icons=new Map(),refs=new Set([...JSON.stringify([cc,pc]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]));
 const childCode=emitReact(cc,{contracts,icons,tokens:refs}),parentCode=emitReact(pc,{contracts,icons,tokens:refs});
 const browser=await chromium.launch();try{const page=await browser.newPage();const render=await mountGenerated(page,pc.name,parentCode.tsx,parentCode.css,{[cc.name]:{tsx:childCode.tsx,css:childCode.css}});
 for(const [value,color]of [['one','rgb(17, 34, 51)'],['two','rgb(68, 85, 102)'],['one','rgb(17, 34, 51)']]){await render({caseProp:value});assert.equal(await page.getByText('Underline',{exact:true}).evaluate(n=>(n as HTMLElement).style.color),color);}
 await render({caseProp:'two',[slot.slot!.name]:'Caller supplied'});assert.equal(await page.getByText('Underline',{exact:true}).count(),0);assert.equal(await page.getByText('Caller supplied',{exact:true}).count(),1);
 }finally{await browser.close();}
});
