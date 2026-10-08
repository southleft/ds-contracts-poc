import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {proposeBatchFromDump} from '../core/propose-figma.js';
import {loadTokenCorpus} from '../extract/figma/tokens.js';
import {loadContracts} from '../extract/figma/propose.js';
import {ContractSchema} from './contract-schema.js';
import {generateSurfaces} from '../core/emitter.js';
import {createFigmaEngine} from '../core/emit-figma-script.js';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {sourceTextControlPlan,partialSourceTextControlPlan,judgeSourceTextControls,probeSourceTextControls} from './design-consumer-text-controls.js';
const root=process.cwd();const read=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const dump=read('benchmark/inputs/cbds-checkbox/dump.json'),before=JSON.stringify(dump);
const loaded=loadContracts(path.join(root,'contracts'));const batch=proposeBatchFromDump(dump,{drawnVariantSurface:'react-runtime',corpus:loadTokenCorpus(root),contractIdByName:loaded.byName,contractIdByKey:loaded.byKey,contractsById:loaded.byId,fileKey:dump._provenance.fileKey,mintUnbound:true,hiddenCaptured:true});assert.equal(batch.skipped.length,0);
const contracts=new Map([...loaded.byId].map(([id,c])=>[id,ContractSchema.parse(c)]));for(const p of batch.proposals){const c=ContractSchema.parse(p.contract);contracts.set(c.id,c);for(const raw of p.childStubs??[]){const s=ContractSchema.parse(raw);if(!contracts.has(s.id))contracts.set(s.id,s);}}
const proposal=batch.proposals.find(p=>p.setName==='Checkbox')!,subject=ContractSchema.parse(proposal.contract);
const merge=(a:any,b:any):any=>{const out={...a};for(const[k,v]of Object.entries(b??{}))out[k]=v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'?merge(out[k],v):v;return out;};
const base=read('tokens/semantic.tokens.json');const minted=batch.proposals.reduce((tree,p)=>merge(tree,p.mintedTokens?.tree??{}),{});const tokens={primitives:read('tokens/primitives.tokens.json'),semantic:merge(base,minted),light:read('tokens/modes/semantic.light.tokens.json'),dark:read('tokens/modes/semantic.dark.tokens.json'),brands:Object.fromEntries(fs.readdirSync(path.join(root,'tokens/modes')).filter(f=>/^brand\..*\.tokens\.json$/.test(f)).map(f=>[f.replace(/^brand\.|\.tokens\.json$/g,''),read('tokens/modes/'+f)]))};
const icons=new Map(fs.readdirSync(path.join(root,'assets/icons')).filter(f=>f.endsWith('.svg')).map(f=>[f.replace(/\.svg$/,''),fs.readFileSync(path.join(root,'assets/icons',f),'utf8')]));
const ctx={tokens,contracts,icons};const req=createRequire(path.join(root,'package.json'));
function component(surface:string,c=subject){const scope=new Map(contracts);scope.set(c.id,c);const cache=new Map<string,any>();function load(name:string):any{if(cache.has(name))return cache.get(name);const contract=[...scope.values()].find(c=>c.name===name);assert(contract,`resolve actual sibling ${name}`);const output=generateSurfaces().find(e=>e.name===surface)!.emit(contract,{...ctx,contracts:scope});const text=output.find(f=>f.path.endsWith('.tsx'))!.contents;const module={exports:{} as any};cache.set(name,module.exports);vm.runInNewContext(transformSync(text,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>p.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})}:p.startsWith('./')||p.startsWith('../')?load(p.split('/').at(-1)!):req(p)});cache.set(name,module.exports);return module.exports;};return load(c.name)[c.name] as React.ComponentType<Record<string,unknown>>;}
const bytes=fs.readFileSync(path.join(root,'benchmark/inputs/cbds-checkbox/dump.json'));
const pin=read('benchmark/pins/cbds-checkbox.figma-to-react.json');
const plan=sourceTextControlPlan(dump.Checkbox);
const cells=dump.Checkbox.variants.map((variant:any)=>({key:variant.name.split(', ').join('_').replaceAll('=','-'),figmaName:variant.name,nodeId:variant.nodeId}));
const scenarios=[{name:'defaults',overrides:{}},{name:'changedText',overrides:{text:'Changed consumer'}},{name:'emptyText',overrides:{text:''}},{name:'off',overrides:{label:false}},{name:'on',overrides:{label:true}},{name:'changedTextOn',overrides:{text:'Changed consumer',label:true}},{name:'changedTextOff',overrides:{text:'Changed consumer',label:false}}] as const;
const proof:{results:any[]}={results:[]};
// Observe the actual unchanged production generators; never use their response
// to choose the expected source-bound cell set or to shrink the source domain.
for(const surface of ['react','react-inline']){
 const Subject=component(surface);
 for(const cell of cells)for(const scenario of scenarios){
  const axes=Object.fromEntries(cell.figmaName.split(', ').map((segment:string)=>segment.split('=')));
  const markup=renderToStaticMarkup(React.createElement(Subject,{...axes,...scenario.overrides}));
  proof.results.push({surface,variant:cell.figmaName,scenario:scenario.name,
    renderedText:(markup.match(/>[^<>]*</g)??[]).map(run=>run.slice(1,-1)).join(' ')});
 }
}
const observed=(surface:string,scenario:string):Record<string,string>=>Object.fromEntries(proof.results.filter((row:any)=>row.surface===surface&&row.scenario===scenario).map((row:any)=>[cells.find((cell:any)=>cell.figmaName===row.variant)!.key,row.renderedText]));
const bound=cells.filter((cell:any)=>plan.variants.find(row=>row.name===cell.figmaName)!.leaves.some(leaf=>leaf.charactersProperty==='text'));
const literal=cells.filter((cell:any)=>!bound.includes(cell));

test('the exact pinned original source independently proves 12 bound planes and 8 literal planes',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.inputSha256);
 assert.equal(cells.length,20);assert.equal(bound.length,12);assert.equal(literal.length,8);
 assert.deepEqual(plan.textProperties,['text']);assert.deepEqual(plan.booleanDefaults,{label:true});
 assert(bound.every((cell:any)=>/state=(default|error|disabled)$/.test(cell.figmaName)));
 assert(literal.every((cell:any)=>/state=(hover|focus)$/.test(cell.figmaName)));
 assert(plan.variants.every(row=>row.leaves.filter(leaf=>leaf.characters==='Checkbox label').length===1));
 assert(plan.variants.flatMap(row=>row.leaves).filter(leaf=>leaf.charactersProperty==='text').every(leaf=>leaf.visibleProperty==='label'));
 assert(plan.variants.flatMap(row=>row.leaves).filter(leaf=>leaf.characters==='Checkbox label'&&leaf.charactersProperty===null).every(leaf=>leaf.visibleProperty===null));
});

test('source oracle judges actual current React outputs across every original plane and all 7 scenarios',()=>{
 for(const surface of ['react','react-inline'])for(const scenario of scenarios){const result=judgeSourceTextControls(plan,cells,observed(surface,scenario.name),scenario.overrides);assert.equal(result.rows.length,20);assert(result.passed,JSON.stringify(result.rows.filter(row=>!row.passed)));}
});

test('freezing any one of the 12 bound source planes fails; an observed nonresponse never changes the expected set',()=>{
 for(const surface of ['react','react-inline'])for(const cell of bound){const input=observed(surface,'changedText');input[cell.key]=input[cell.key].replace('Changed consumer','Checkbox label');const result=judgeSourceTextControls(plan,cells,input,{text:'Changed consumer'});assert.deepEqual(result.rows.filter(row=>!row.passed).map(row=>row.key),[cell.key]);}
 assert.equal(bound.length,12);
});

test('inventing text or visibility control on any one of the 8 literal source planes fails',()=>{
 for(const surface of ['react','react-inline'])for(const cell of literal){
  const text=observed(surface,'changedText');text[cell.key]=text[cell.key].replace('Checkbox label','Changed consumer');assert.deepEqual(judgeSourceTextControls(plan,cells,text,{text:'Changed consumer'}).rows.filter(row=>!row.passed).map(row=>row.key),[cell.key]);
  const off=observed(surface,'off');off[cell.key]=off[cell.key].replace('Checkbox label','');assert.deepEqual(judgeSourceTextControls(plan,cells,off,{label:false}).rows.filter(row=>!row.passed).map(row=>row.key),[cell.key]);
 }
});

test('discarding visibility on any bound plane fails independently of replacement text',()=>{
 for(const surface of ['react','react-inline'])for(const cell of bound){const input=observed(surface,'off');input[cell.key]+=' Checkbox label';assert.deepEqual(judgeSourceTextControls(plan,cells,input,{label:false}).rows.filter(row=>!row.passed).map(row=>row.key),[cell.key]);}
});

test('all 20 source identities remain mandatory, and source ambiguity or missing metadata stays a named refusal',()=>{
 assert.throws(()=>judgeSourceTextControls(plan,cells.slice(1),observed('react','defaults')),/cell-domain-incomplete/);
 const missing=observed('react','defaults');delete missing[cells[0].key];assert.throws(()=>judgeSourceTextControls(plan,cells,missing),/cell-observation-missing/);
 const renamed=structuredClone(cells);renamed[0].figmaName='different source plane';assert.throws(()=>judgeSourceTextControls(plan,renamed,observed('react','defaults')),/cell-source-identity/);
 const undefinedProperty=structuredClone(dump.Checkbox);delete undefinedProperty.propertyDefinitions['text#272:2'];assert.throws(()=>sourceTextControlPlan(undefinedProperty),/text-definition-missing:text/);
 const collision=structuredClone(dump.Checkbox);collision.propertyDefinitions.text={type:'TEXT',defaultValue:'Checkbox label'};assert.throws(()=>sourceTextControlPlan(collision),/property-name-collision:text/);
 assert.equal(createHash('sha256').update(fs.readFileSync(root+'/benchmark/inputs/cbds-checkbox/dump.json')).digest('hex'),pin.inputSha256);
});

test('the public API cannot erase a source control, and code aliases affect invocation only',async()=>{
 const missingPage={evaluate(){throw Error('must refuse before touching page');}} as any;
 await assert.rejects(probeSourceTextControls(missingPage,plan,cells,[]),/public-input-missing:text/);
 const bindings=[{type:'text',bindings:{figma:{kind:'TEXT',property:'text'},code:{prop:'caption'}}},{type:'boolean',bindings:{figma:{kind:'BOOLEAN',property:'label'},code:{prop:'showCaption'}}}];
 let active:any=null;const invoked:any[]=[];
 const fakePage={async evaluate(_fn:any,arg:any){if(arg){active=arg.props;invoked.push(active);}},locator(selector:string){const key=selector.match(/data-cell="([^"]+)"/)![1];return{async innerText(){const text=active?.caption,show=active?.showCaption;const scenario=text===undefined?show===false?'off':show===true?'on':'defaults':text===''?'emptyText':show===false?'changedTextOff':show===true?'changedTextOn':'changedText';const output=observed('react',scenario)[key];return typeof text==='string'&&text!==''?output.replaceAll('Changed consumer',text):output;}};}} as any;
 const result=await probeSourceTextControls(fakePage,plan,cells,bindings);assert(result.passed);assert.equal(result.scenarios.length,7);assert(result.scenarios.every(row=>row.rows.length===20));assert(invoked.some(value=>value?.caption==='Replaced by consumer: text'&&value?.showCaption===false));assert.equal(invoked.at(-1),null);
 assert.deepEqual(plan.textProperties,['text']);assert.equal(bound.length,12);assert.equal(literal.length,8);
});

test('native compilation preserves every original variant and exactly the evidenced source bindings',()=>{
 const data=createFigmaEngine({tokens,icons}).compileComponentData(subject,contracts);
 assert.equal(data.variants.length,20);
 const labels:any[]=[];const walk=(node:any)=>{if(node.type==='text'&&node.characters==='Checkbox label')labels.push(node);for(const child of node.children??[])walk(child);};
 for(const variant of data.variants)walk(variant.spec);
 assert.equal(labels.length,20);
 assert.equal(labels.filter(node=>node.contentProp==='text'&&node.visibleProp==='label').length,12);
 assert.equal(labels.filter(node=>node.contentProp===undefined&&node.visibleProp===undefined).length,8);
 assert.equal(JSON.stringify(dump),before);
});

test('the correction activates from mixed source ownership, preserving uniform and instance-control instruments',()=>{
 assert(partialSourceTextControlPlan(dump.Checkbox));
 const uniform=structuredClone(dump.Checkbox);
 uniform.variants=uniform.variants.filter((variant:any)=>/state=(default|error|disabled)$/.test(variant.name));
 assert.equal(partialSourceTextControlPlan(uniform),null);
 assert.equal(partialSourceTextControlPlan({variants:[{type:'INSTANCE',children:[{type:'TEXT',text:{characters:'same'},propRefs:{characters:'Text'}}]},{type:'INSTANCE',children:[{type:'TEXT',text:{characters:'same'}}]}]}),null);
});


test('full ordered source text rejects unknown prefixes, suffixes and duplicate side effects in every original cell',()=>{
 for(const surface of ['react','react-inline'])for(const scenario of scenarios)for(const cell of cells){
  const original=observed(surface,scenario.name)[cell.key];
  const poisons=[(text:string)=>'unexpected prefix '+text,(text:string)=>text+' unexpected suffix'];
  if(original.trim())poisons.push((text:string)=>text+' '+text);
  for(const poison of poisons){
   const input=observed(surface,scenario.name);
   input[cell.key]=poison(original);
   const result=judgeSourceTextControls(plan,cells,input,scenario.overrides);
   assert.deepEqual(result.rows.filter(row=>!row.passed).map(row=>row.key),[cell.key]);
   assert.notEqual(result.rows.find(row=>row.key===cell.key)!.observedText,result.rows.find(row=>row.key===cell.key)!.expectedText);
  }
 }
});

test('exact explicit native property references cannot borrow another declaration with the same basename',()=>{
 for(const channel of ['characters','visible']){
  const wrong=structuredClone(dump.Checkbox),label=wrong.variants[0].children.find((node:any)=>node.type==='TEXT');
  label.propRefs[channel]=`${channel==='characters'?'text':'label'}#999:999`;
  assert.throws(()=>sourceTextControlPlan(wrong),/binding-identity-mismatch/);
 }
 const exact=structuredClone(dump.Checkbox),label=exact.variants[0].children.find((node:any)=>node.type==='TEXT');
 label.propRefs.characters='text#272:2';label.propRefs.visible='label#272:1';
 assert.deepEqual(sourceTextControlPlan(exact).textProperties,['text']);
 const badDefault=structuredClone(dump.Checkbox);badDefault.propertyDefinitions['text#272:2'].defaultValue=NaN;
 assert.throws(()=>sourceTextControlPlan(badDefault),/text-default-unqualified:text/);
});

test('duplicate native source or observation identities and malformed visibility cannot qualify',()=>{
 const duplicate=structuredClone(dump.Checkbox);duplicate.variants[0].nodeId='999:1';duplicate.variants[1].nodeId='999:1';
 assert.throws(()=>sourceTextControlPlan(duplicate),/node-id-ambiguous:999:1/);
 const duplicateLeaf=structuredClone(dump.Checkbox),first=duplicateLeaf.variants[0];first.nodeId='999:2';first.children.find((node:any)=>node.type==='TEXT').nodeId='999:2';
 assert.throws(()=>sourceTextControlPlan(duplicateLeaf),/node-id-ambiguous:999:2/);
 const malformed=structuredClone(dump.Checkbox);malformed.variants[0].children.find((node:any)=>node.type==='TEXT').hidden='false';
 assert.throws(()=>sourceTextControlPlan(malformed),/visibility-capture-malformed/);
 const invalidId=structuredClone(dump.Checkbox);invalidId.variants[0].nodeId='';assert.throws(()=>sourceTextControlPlan(invalidId),/node-id-malformed/);
 const ids=cells.map((cell:any,index:number)=>({...cell,nodeId:`999:${index}`}));
 assert(judgeSourceTextControls(plan,ids,observed('react','defaults')).passed);
 ids[1].nodeId=ids[0].nodeId;assert.throws(()=>judgeSourceTextControls(plan,ids,observed('react','defaults')),/cell-source-node-ambiguous/);
});

test('bound ancestors and captured instance text refuse instead of silently assigning parent text control',()=>{
 for(const index of [0,12]){
  const ancestor=structuredClone(dump.Checkbox),variant=ancestor.variants[index],label=variant.children.find((node:any)=>node.type==='TEXT');
  variant.children=variant.children.map((node:any)=>node===label?{name:'visibility ancestor',type:'FRAME',propRefs:{visible:'label'},children:[node]}:node);
  assert.throws(()=>sourceTextControlPlan(ancestor),/ancestor-visibility-binding-unqualified/);
 }
 const instance=structuredClone(dump.Checkbox),icon=instance.variants[0].children.find((node:any)=>node.type==='INSTANCE');
 icon.children=[{name:'child-owned label',type:'TEXT',text:{characters:'Checkbox label'},propRefs:{characters:'text'}}];
 assert.throws(()=>sourceTextControlPlan(instance),/instance-text-ownership-unqualified/);
 icon.children[0].text.characters='';
 assert.throws(()=>sourceTextControlPlan(instance),/instance-text-ownership-unqualified/);
 const defaultMismatch=structuredClone(dump.Checkbox);defaultMismatch.variants[0].children.find((node:any)=>node.type==='TEXT').hidden=true;
 assert.throws(()=>sourceTextControlPlan(defaultMismatch),/visibility-default-unqualified/);
});

test('equal text with different owners within one cell is ambiguous; repeated known text with one owner keeps its exact sequence',()=>{
 const ambiguous=structuredClone(dump.Checkbox),variant=ambiguous.variants[0],label=variant.children.find((node:any)=>node.type==='TEXT');
 const literalLabel=structuredClone(label);delete literalLabel.propRefs;literalLabel.name='literal label';variant.children.push(literalLabel);
 assert.throws(()=>sourceTextControlPlan(ambiguous),/text-owner-ambiguous/);
 const repeatSet={propertyDefinitions:{'Text#1:1':{type:'TEXT',defaultValue:'Label'}},variants:[
  {name:'bound',type:'COMPONENT',children:[{name:'first',type:'TEXT',text:{characters:'Label'},propRefs:{characters:'Text'}},{name:'second',type:'TEXT',text:{characters:'Label'},propRefs:{characters:'Text'}},{name:'detail',type:'TEXT',text:{characters:'Detail'}}]},
  {name:'literal',type:'COMPONENT',children:[{name:'first',type:'TEXT',text:{characters:'Label'}},{name:'second',type:'TEXT',text:{characters:'Label'}},{name:'detail',type:'TEXT',text:{characters:'Detail'}}]},
 ]};
 const repeatPlan=sourceTextControlPlan(repeatSet),repeatCells=repeatSet.variants.map(row=>({key:row.name,figmaName:row.name,nodeId:''}));
 assert(judgeSourceTextControls(repeatPlan,repeatCells,{bound:'Label\n  Label Detail',literal:'Label Label Detail'}).passed);
 assert(judgeSourceTextControls(repeatPlan,repeatCells,{bound:'Changed Changed Detail',literal:'Label Label Detail'},{Text:'Changed'}).passed);
 for(const bad of ['Detail Label Label','Label Label Detail surprise','Label Detail','Label Label Label Detail']){
  assert.deepEqual(judgeSourceTextControls(repeatPlan,repeatCells,{bound:bad,literal:'Label Label Detail'}).rows.filter(row=>!row.passed).map(row=>row.key),['bound']);
 }
 assert.equal(JSON.stringify(dump),before);
});


test('a failed public observation restores the scoped override before propagating the refusal',async()=>{
 const bindings=[{type:'text',bindings:{figma:{kind:'TEXT',property:'text'},code:{prop:'caption'}}},{type:'boolean',bindings:{figma:{kind:'BOOLEAN',property:'label'},code:{prop:'showCaption'}}}];
 const invoked:any[]=[];
 const failingPage={async evaluate(_fn:any,arg:any){if(arg)invoked.push(arg.props);},locator(){return{async innerText(){throw Error('observation disconnected');}};}} as any;
 await assert.rejects(probeSourceTextControls(failingPage,plan,cells,bindings),/observation disconnected/);
 assert.deepEqual(invoked,[{},null]);
 assert.equal(JSON.stringify(dump),before);
});


test('public native property identities and distinct code inputs cannot borrow another source control',async()=>{
 const missingPage={evaluate(){throw Error('must refuse before touching page');}} as any;
 const bindings=[{type:'text',bindings:{figma:{kind:'TEXT',property:'text'},code:{prop:'caption'}}},{type:'boolean',bindings:{figma:{kind:'BOOLEAN',property:'label'},code:{prop:'showCaption'}}}];
 for(const index of [0,1]){
  const wrong=structuredClone(bindings);wrong[index].bindings.figma.property+='#999:999';
  await assert.rejects(probeSourceTextControls(missingPage,plan,cells,wrong),/public-input-identity-mismatch/);
 }
 const duplicate=structuredClone(bindings);duplicate[1].bindings.code.prop='caption';
 await assert.rejects(probeSourceTextControls(missingPage,plan,cells,duplicate),/public-input-code-alias-ambiguous:caption/);
 const malformed=structuredClone(bindings);malformed[0].bindings.code.prop='   ';
 await assert.rejects(probeSourceTextControls(missingPage,plan,cells,malformed),/public-input-missing:text/);
 const exact=structuredClone(bindings);exact[0].bindings.figma.property='text#272:2';exact[1].bindings.figma.property='label#272:1';
 let active:any=null;const invoked:any[]=[];
 const fakePage={async evaluate(_fn:any,arg:any){if(arg){active=arg.props;invoked.push(active);}},locator(selector:string){const key=selector.match(/data-cell="([^"]+)"/)![1];return{async innerText(){const text=active?.caption,show=active?.showCaption;const scenario=text===undefined?show===false?'off':show===true?'on':'defaults':text===''?'emptyText':show===false?'changedTextOff':show===true?'changedTextOn':'changedText';const output=observed('react',scenario)[key];return typeof text==='string'&&text!==''?output.replaceAll('Changed consumer',text):output;}};}} as any;
 const result=await probeSourceTextControls(fakePage,plan,cells,exact);
 assert(result.passed);assert.equal(result.scenarios.length,7);assert(result.scenarios.every(row=>row.rows.length===20));assert.equal(invoked.at(-1),null);
 assert.equal(JSON.stringify(dump),before);
});
