import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {ContractSchema,resolveTokens,type Contract} from '../scripts/contract-schema.js';
import {jointTokenTableErrors} from '../packages/core/src/joint-tokens.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {emitHtml} from './emit-html.js';
import {shadowCss} from '../packages/emitter-web-components/src/emit-wc.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {scopeContractResources} from './scoped-contract-resources.js';
import {projectForCanvas} from '../extract/figma/canvas-gate/compile.js';
import {tokenInventoryFromJson} from './tokens.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {proposeFromDump,proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpSet} from '../extract/figma/types.js';

const domain=[null,'quiet','strong'] as const;
const rows=domain.flatMap((a,i)=>domain.map((b,j)=>({values:[a,b],tokens:{'background-color':`{palette.p${i}${j}}`}})));
const palette=Object.fromEntries(domain.flatMap((_,i)=>domain.map((_,j)=>[`p${i}${j}`,{$type:'color',$value:`rgb(${20+i*60}, ${30+j*60}, 40)`}])));
const tokens={primitives:{palette},semantic:{},light:{},dark:{},brands:{default:{}}};
function seed():Contract{return ContractSchema.parse({id:'probe.joint',name:'JointSurface',version:'0.1.0',status:'draft',description:'A complete two-omission paint table',
 props:['tone','finish'].map(name=>({name,type:{enum:['quiet','strong']},bindings:{code:{prop:name},figma:{kind:'VARIANT',property:name,unsetValue:'(unset)'}}})),
 states:[],semantics:{element:'div'},anatomy:{root:{layout:{display:'flex'},text:'x',literals:{width:'48px',height:'24px'},tokensByCombination:[{props:['tone','finish'],rows}]}},
 bindings:{code:{anchors:{importPath:'./JointSurface',export:'JointSurface'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}})}

test('joint paint tables preserve omission separately and refuse incomplete, ambiguous or competing bindings',()=>{
 const c=seed(),saved=structuredClone(c);assert.deepEqual(jointTokenTableErrors(c),[]);
 for(const row of rows){
  const subst=Object.fromEntries(['tone','finish'].flatMap((prop,i)=>row.values[i]===null?[]:[[prop,row.values[i]!]]));
  assert.deepEqual(resolveTokens(c.anatomy.root,subst),row.tokens);
 }
 assert.deepEqual(c,saved);
 const refuse=(change:(c:Contract)=>void,why:RegExp)=>{const bad=seed();change(bad);assert.match(jointTokenTableErrors(bad).join('\n'),why)};
 refuse(c=>{c.anatomy.root.tokensByCombination![0].rows.pop()},/every named and omitted/);
 refuse(c=>{const t=c.anatomy.root.tokensByCombination![0];t.rows[8]=structuredClone(t.rows[0])},/duplicate tuple/);
 refuse(c=>{c.anatomy.root.tokensByCombination![0].props[1]='tone'},/distinct properties/);
 refuse(c=>{c.anatomy.root.tokensByCombination![0].rows[0].values[0]='not-a-value'},/unknown enum value/);
 refuse(c=>{c.anatomy.root.tokensByCombination![0].rows[0].tokens={color:'{palette.p00}'}},/identical channel sets/);
 refuse(c=>{c.props[0].default='quiet'},/optional defaultless/);
 refuse(c=>{c.props[0].required=true},/optional defaultless/);
 refuse(c=>{delete c.props[0].bindings.figma.unsetValue},/omitted planes/);
 refuse(c=>{c.anatomy.root.tokens={'background-color':'{palette.p00}'}},/conflicts/);
 refuse(c=>{c.anatomy.root.states={hover:{'background-color':'{palette.p00}'}}},/conflicts/);
 refuse(c=>{c.anatomy.root.tokensByCombination![0].rows.forEach(r=>r.tokens={height:'{space.small}'})},/color channels only/);
 refuse(c=>{c.anatomy.root.tokensByCombination![0].rows[0].tokens['background-color']='{palette.{tone}}'},/plain token/);
 refuse(c=>{c.anatomy.root.strokesIncludedInLayout=false},/ordinary root/);
 refuse(c=>{c.anatomy.root.parts={extra:{text:'x'}}},/ordinary root/);
 refuse(c=>{c.states=['hover']},/resting paint only/);
 refuse(c=>{c.anatomy.root.literals={'background':'red'} as any},/conflicts/);
 refuse(c=>{c.anatomy.root.tokensByCombination!.push(structuredClone(c.anatomy.root.tokensByCombination![0]))},/conflicts/);
 const reordered=seed();reordered.anatomy.root.tokensByCombination![0].rows.reverse();
 assert.deepEqual(resolveTokens(reordered.anatomy.root,{}),resolveTokens(c.anatomy.root,{}));
});

test('generated React and native plans carry every joint color through repeated set and omitted transitions',async()=>{
 const c=seed(),before=JSON.stringify({c,tokens}),contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const css=emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives])});
 const inline=emitReactInline(c,{contracts,icons,tokens});
 const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,9);assert.ok(native.variants.every(v=>v.spec.fill));
 assert.equal(new Set(native.variants.map(v=>JSON.stringify(v.spec.fill))).size,9);
 for(const row of rows){
  const name=`tone=${row.values[0]??'(unset)'}, finish=${row.values[1]??'(unset)'}`;
  const [i,j]=row.values.map(value=>domain.indexOf(value as typeof domain[number]));
  assert.equal(native.variants.find(v=>v.name===name)!.spec.fill,`palette/p${i}${j}`);
 }
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  for(const output of [css,{...inline,css:''}]){
   assert.deepEqual(generatedTypeErrors(c.name,output.tsx),[]);
   await mountGenerated(page,c.name,output.tsx,output.css);
   await page.addStyleTag({content:':root{'+Object.entries(palette).map(([key,value])=>`--palette-${key}:${value.$value};`).join('')+'}'});
   for(const row of [...rows,...rows.slice().reverse(),rows[0]]){
    const props=Object.fromEntries(['tone','finish'].flatMap((prop,i)=>row.values[i]===null?[]:[[prop,row.values[i]!]]));
    await page.evaluate(props=>(window as any).renderSubject(props),props);
    const actual=await page.locator('#root > div').evaluate(n=>({color:getComputedStyle(n).backgroundColor,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));
    const [i,j]=row.values.map(value=>domain.indexOf(value as typeof domain[number]));
    assert.deepEqual(actual,{color:`rgb(${20+i*60}, ${30+j*60}, 40)`,width:48,height:24},JSON.stringify(props));
   }
  }
  // A runtime null or false can be a NAMED canonical value. Neither may be
  // confused with the table's null marker for an omitted prop.
  const typed=seed();
  typed.props[0].bindings.code.values={quiet:null,strong:false};
  typed.props[1].bindings.code.values={quiet:0,strong:'yes'};
  const typedCtx={contracts:new Map([[typed.id,typed]]),icons};
  const typedCss=emitReact(typed,{...typedCtx,tokens:tokenInventoryFromJson([tokens.primitives])});
  const typedInline=emitReactInline(typed,{...typedCtx,tokens});
  for(const output of [typedCss,{...typedInline,css:''}]){
   assert.deepEqual(generatedTypeErrors(typed.name,output.tsx),[]);
   const render=await mountGenerated(page,typed.name,output.tsx,output.css);
   await page.addStyleTag({content:':root{'+Object.entries(palette).map(([key,value])=>`--palette-${key}:${value.$value};`).join('')+'}'});
   for(const row of rows){
    const props=Object.fromEntries(typed.props.flatMap((prop,i)=>row.values[i]===null?[]:[[prop.bindings.code.prop,prop.bindings.code.values![row.values[i]!]]]));
    await render(props);
    const [i,j]=row.values.map(value=>domain.indexOf(value as typeof domain[number]));
    assert.equal(await page.locator('#root > div').evaluate(n=>getComputedStyle(n).backgroundColor),`rgb(${20+i*60}, ${30+j*60}, 40)`,JSON.stringify(props));
   }
  }
  // The same shared table must not vanish on the static or shadow stylesheet
  // targets. This probes their actual generated CSS, not hand-authored rules.
  const staticCss=emitHtml(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives])}).css;
  const shadow=shadowCss(c,tokens,[]);
  for(const [sheet,rootAttrs] of [[staticCss,'class="joint-surface"'],[shadow,'part="root"']] as const){
   await page.setContent(`<style>${sheet}:root{${Object.entries(palette).map(([key,value])=>`--palette-${key}:${value.$value};`).join('')}}</style><div id="subject" ${rootAttrs}>x</div>`);
   for(const row of rows){
    await page.locator('#subject').evaluate((n,{values,isShadow})=>{
     n.setAttribute('class','joint-surface');
     for(const [i,prop] of ['tone','finish'].entries()){
      n.removeAttribute('data-'+prop);
      if(values[i]!==null){if(isShadow)n.setAttribute('data-'+prop,values[i]!);else n.classList.add(`joint-surface--${prop}-${values[i]}`)}
     }
    },{values:row.values,isShadow:sheet===shadow});
    const [i,j]=row.values.map(value=>domain.indexOf(value as typeof domain[number]));
    assert.equal(await page.locator('#subject').evaluate(n=>getComputedStyle(n).backgroundColor),`rgb(${20+i*60}, ${30+j*60}, 40)`);
   }
  }
 }finally{await browser.close()}
 assert.equal(JSON.stringify({c,tokens}),before);
 assert.deepEqual(emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([tokens.primitives])}),css);
});

async function nativeFixture(c:Contract,resourceTokens=tokens){
 const engine=createFigmaEngine({tokens:resourceTokens,icons:new Map()}),{figma,root}=createFigmaMock();
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{\n${code}\n})()`,context,{timeout:20000}) as Promise<unknown>;
 await run(engine.buildTokensScript(null));
 const script=engine.buildComponentScript(c,new Map([[c.id,c]]));await run(script);
 const node=root.findOne((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert.ok(node);
 const captureAll=async()=>{
  const code=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8')
   .replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([node.name])};`);
  return await run(code) as Record<string,unknown>;
 };
 const dump=async()=>(await captureAll())[node.name] as DumpSet;
 return {captured:await dump(),dump,captureAll,run,script,engine,nativeIds:()=>node.children!.map(n=>[n.id,n.name] as const)};
}
const propose=(captured:DumpSet)=>proposeFromDump(captured,{corpus:tokenCorpusFromJson({primitives:tokens.primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),fileKey:null,projectionMode:'exact',mintUnbound:true});

test('the emitted native program and canonical dump preserve complete joint paint identities on return',async()=>{
 const {captured,dump,run,script,nativeIds}=await nativeFixture(seed()),before=JSON.stringify(captured),idsBefore=nativeIds();
 const proposed=propose(captured);
 const returned=ContractSchema.parse(proposed.contract);
 assert.deepEqual(jointTokenTableErrors(returned),[]);
 assert.ok(returned.props.every(prop=>prop.default===undefined));
 for(const row of rows){
  const subst=Object.fromEntries(['tone','finish'].flatMap((prop,i)=>row.values[i]===null?[]:[[prop,row.values[i]!]]));
  assert.equal(resolveTokens(returned.anatomy.root,subst)['background-color'],row.tokens['background-color']);
 }
 assert.equal(JSON.stringify(captured),before);
 await run(script);assert.equal(JSON.stringify(await dump()),before,'unchanged repeat preserves native nodes and values');
 const edited=seed();edited.anatomy.root.tokensByCombination![0].rows[0].tokens['background-color']='{palette.p22}';
 const update=createFigmaEngine({tokens,icons:new Map()}).buildComponentScript(edited,new Map([[edited.id,edited]]));
 await run(update);const afterUpdate=await dump();
 assert.ok(idsBefore.every(([id])=>typeof id==='string'&&id.length>0));
 assert.deepEqual(nativeIds(),idsBefore,'supported update reuses every native main');
 assert.equal(resolveTokens(ContractSchema.parse(propose(afterUpdate).contract).anatomy.root,{})['background-color'],'{palette.p22}');
 await run(update);assert.equal(JSON.stringify(await dump()),JSON.stringify(afterUpdate),'repeat after update creates nothing');

});


test('native return uses drawn bindings, preserves equal-color identities, and refuses incomplete or unsupported tables',async()=>{
 const c=seed();
 c.anatomy.root.tokensByCombination![0].rows.forEach(row=>row.tokens.color=row.tokens['background-color']);
 const equalTokens=structuredClone(tokens);for(const value of Object.values(equalTokens.primitives.palette))value.$value='rgb(20, 30, 40)';
 const {captured}=await nativeFixture(c,equalTokens);
 const returned=ContractSchema.parse(propose(captured).contract);
 for(const row of rows){
  const subst=Object.fromEntries(['tone','finish'].flatMap((p,i)=>row.values[i]===null?[]:[[p,row.values[i]!]]));
  assert.equal(resolveTokens(returned.anatomy.root,subst).color,row.tokens['background-color']);
 }
 const edited=structuredClone(captured);
 edited.variants[0].fill={var:'palette/p22'};
 const back=ContractSchema.parse(propose(edited).contract);
 assert.equal(resolveTokens(back.anatomy.root,{})['background-color'],'{palette.p22}','a changed native binding wins over original metadata');
 for(const change of [
  (s:any)=>{s.variants.pop()},
  (s:any)=>{s.variants.push(structuredClone(s.variants[0]))},
  (s:any)=>{delete s.unsetVariantAxes},
 ]){
  const changed=structuredClone(captured);change(changed);
  let candidate:Contract|undefined;
  try{candidate=ContractSchema.parse(propose(changed).contract)}catch(error){assert.ok(error instanceof Error)}
  assert.equal(candidate?.anatomy.root.tokensByCombination,undefined);
 }
 const partial=structuredClone(captured);partial.variants[0].fill!.alpha=0.5;
 const opacityBack=ContractSchema.parse(propose(partial).contract);
 assert.ok(!opacityBack.anatomy.root.tokensByCombination?.some(t=>t.rows.some(r=>'background-color' in r.tokens)),'paint opacity may not be discarded to keep an identity');
 const unbound=structuredClone(captured);unbound.variants[0].fill={hex:'ffffff'};
 const unboundBack=ContractSchema.parse(propose(unbound).contract);
 assert.ok(!unboundBack.anatomy.root.tokensByCombination?.some(t=>t.rows.some(r=>'background-color' in r.tokens)));
});

test('joint resources keep independent identities and canvas projection prunes whole tuples',()=>{
 const a=seed(),b=seed();b.id='probe.other';
 const before=JSON.stringify([a,b,tokens]);
 const scoped=scopeContractResources([a,b],[a,b].map(c=>({contractId:c.id,tokens:tokens.primitives,assets:[]})));
 const refs=[a,b].map(c=>resolveTokens(scoped.contracts.get(c.id)!.anatomy.root,{})['background-color']);
 assert.notEqual(refs[0],refs[1]);
 for(const c of [a,b]){
  const projected=scoped.contracts.get(c.id)!;
  const compiled=createFigmaEngine({tokens:{...tokens,primitives:scoped.tokens},icons:new Map()}).compileComponentData(projected,scoped.contracts);
  assert.equal(compiled.variants.length,9);assert.equal(new Set(compiled.variants.map(v=>v.spec.fill)).size,9);
 }
 assert.equal(JSON.stringify([a,b,tokens]),before);
 const missing=seed();missing.anatomy.root.tokensByCombination![0].rows[0].tokens.color='{missing}';
 assert.throws(()=>scopeContractResources([missing],[{contractId:missing.id,tokens:tokens.primitives,assets:[]}]),/TOKEN_UNRESOLVED/);
 const projected=seed();projected.id='polaris.text';
 projected.props[0].name='tone';projected.props[0].type={enum:['base','extra']};
 for(const row of projected.anatomy.root.tokensByCombination![0].rows)if(row.values[0])row.values[0]=row.values[0]==='quiet'?'base':'extra';
 const beforeProjection=JSON.stringify(projected);
 const canvas=projectForCanvas(projected);
 assert.deepEqual(jointTokenTableErrors(canvas),[]);
 assert.equal(canvas.anatomy.root.tokensByCombination![0].rows.length,6);
 assert.equal(resolveTokens(canvas.anatomy.root,{tone:'base',finish:'quiet'})['background-color'],'{palette.p11}');
 assert.equal(JSON.stringify(projected),beforeProjection);
});


test('an independent third native axis must be fully observed before joint bindings factor it out',async()=>{
 const c=seed(),third=structuredClone(c.props[0]);third.name='density';third.bindings.code.prop='density';third.bindings.figma.property='density';c.props.push(third);
 const {captured}=await nativeFixture(c);assert.equal(captured.variants.length,27);
 const back=ContractSchema.parse(propose(captured).contract);
 assert.equal(back.anatomy.root.tokensByCombination![0].rows.length,9);
 const changed=structuredClone(captured);changed.variants[0].fill={var:'palette/p22'};
 let bad:Contract|undefined;try{bad=ContractSchema.parse(propose(changed).contract)}catch(error){assert.ok(error instanceof Error)}
 assert.ok(!bad?.anatomy.root.tokensByCombination?.some(t=>t.rows.some(r=>'background-color' in r.tokens)));
});


test('native return keeps typed code values distinct from omitted tuples across renamed Figma labels',async()=>{
 const c=seed();c.props[0].bindings.code.values={quiet:null,strong:false};c.props[1].bindings.code.values={quiet:0,strong:'yes'};
 for(const [i,p] of c.props.entries()){p.bindings.code.prop='input'+i;p.bindings.figma.property='Axis '+i;p.bindings.figma.values={quiet:'Quiet label',strong:'Strong label'};}
 const {captured}=await nativeFixture(c),back=ContractSchema.parse(propose(captured).contract);
 for(const p of c.props){const returned=back.props.find(b=>b.name===p.name)!;assert.deepEqual(returned.bindings.code,p.bindings.code);assert.deepEqual(returned.type,p.type);assert.equal(returned.default,undefined);}
 assert.deepEqual(back.anatomy.root.tokensByCombination,c.anatomy.root.tokensByCombination);
});


test('transparent bound colors use captured variable alpha without discarding a separate paint-opacity change',async()=>{
 const alphaTokens=structuredClone(tokens);alphaTokens.primitives.palette.p00.$value='#141e2800';alphaTokens.primitives.palette.p01.$value='#141e2880';
 const {captureAll}=await nativeFixture(seed(),alphaTokens),dump=await captureAll();
 const options={corpus:tokenCorpusFromJson({primitives:alphaTokens.primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),fileKey:null,projectionMode:'exact' as const,mintUnbound:true};
 const result=proposeBatchFromDump(dump,options);
 assert.deepEqual(result.skipped,[]);assert.equal(result.proposals.length,1);
 const back=ContractSchema.parse(result.proposals[0].contract);
 assert.equal(resolveTokens(back.anatomy.root,{})['background-color'],'{palette.p00}');
 assert.equal(back.anatomy.root.tokensByCombination?.[0].rows.length,9);
 const float32=structuredClone(dump) as any;
 float32[seed().name].variants[1].fill.alpha=Math.fround(128/255);
 assert.equal(ContractSchema.parse(proposeBatchFromDump(float32,options).proposals[0].contract).anatomy.root.tokensByCombination?.[0].rows.length,9);
 for(const change of [
  (d:any)=>{d[seed().name].variants[0].fill.alpha=0.5},
  (d:any)=>{d[seed().name].variants[1].fill.alpha=0.5},
  (d:any)=>{d._variables['palette/p00'].value='#141e28'},
  (d:any)=>{delete d._variables},
  (d:any)=>{delete d._variables['palette/p22']},
  (d:any)=>{d._variables['palette/p00'].value='rgba(20,30,40,0.5%)';d[seed().name].variants[0].fill.alpha=0.5},
 ]){
  const modified=structuredClone(dump);change(modified);const r=proposeBatchFromDump(modified,options);
  assert.ok(!r.proposals.some(p=>ContractSchema.parse(p.contract).anatomy.root.tokensByCombination?.some(t=>t.rows.some(row=>'background-color'in row.tokens))));
 }
});


test('joint paint refuses uncorroborated native consumer modes without flattening the captured palette',async()=>{
 const {captureAll}=await nativeFixture(seed()),dump=await captureAll() as any;
 const options={corpus:tokenCorpusFromJson({primitives:tokens.primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),fileKey:null,projectionMode:'exact' as const,mintUnbound:true};
 const variable=dump._variables['palette/p00'],value=variable.value;
 variable.modes={Base:value,Alternate:value};
 const original=JSON.stringify(dump);
 assert.equal(ContractSchema.parse(proposeBatchFromDump(dump,options).proposals[0].contract).anatomy.root.tokensByCombination?.[0].rows.length,9);
 assert.equal(JSON.stringify(dump),original);
 for(const modes of [{Base:value,Alternate:'#c80ab4'},{Base:value,Alternate:'#141e2800'},{Base:value,Alternate:20},{},null,[],{Base:value,Alternate:{type:'VARIABLE_ALIAS',id:'unresolved'}}]){
  const changed=structuredClone(dump);changed._variables['palette/p00'].modes=modes;
  const before=JSON.stringify(changed);
  for(const overrides of [{},{capturedValues:new Map(Object.entries(dump._variables).map(([name,v]:[string,any])=>[name.replaceAll('/','.'),v.value])),capturedPaintModeConflicts:new Set<string>()}]){
   const result=proposeBatchFromDump(changed,{...options,...overrides});
   assert.equal(result.proposals.length,0);assert.equal(result.skipped.length,1);
   assert.match(result.skipped[0].reason,/FIGMA_JOINT_PAINT_MODE_UNCORROBORATED/);
  }
  assert.equal(JSON.stringify(changed),before);
 }
 // A conflict on an unused variable does not refuse a complete single-mode table.
 const unused=structuredClone(dump);unused._variables['palette/unused']={type:'COLOR',value,modes:{Base:value,Alternate:'#c80ab4'}};
 assert.equal(proposeBatchFromDump(unused,options).proposals.length,1);
});
