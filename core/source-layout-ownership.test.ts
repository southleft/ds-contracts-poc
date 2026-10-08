import assert from 'node:assert/strict';
import test from 'node:test';
import type {DumpSet, DumpNode} from '../extract/figma/types.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema, resolveTokens, resolveLiterals, walkAnatomy} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {emitReact, generateTsx} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {validateContract} from '../packages/core/src/validate.js';
import {flattenTokens} from './tokens.js';
const empty={primitives:{},semantic:{},light:{},brandDefault:{}};
const layout=(padding:[number,number,number,number]=[0,0,0,0])=>({mode:'VERTICAL' as const,primary:'MIN' as const,counter:'MIN' as const,spacing:0,padding,primarySizing:'AUTO' as const,counterSizing:'AUTO' as const});
const text=():DumpNode=>({name:'Caption',type:'TEXT',fixedSize:{width:40,height:20},text:{characters:'Actual source',fontSize:12,fontWeight:400,fontStyle:'Regular',fontFamily:'Arial',lineHeight:16,textAutoResize:'NONE'}});
const foldFixture=():DumpSet=>({setName:'Allocation',type:'COMPONENT_SET',propertyDefinitions:{Kind:{type:'VARIANT',defaultValue:'Nested',variantOptions:['Nested','Flat']}},variants:['Nested','Flat'].map(kind=>({name:`Kind=${kind}`,type:'COMPONENT',variantProperties:{Kind:kind},layout:layout(kind==='Flat'?[5,3,7,4]:[0,0,0,0]),children:kind==='Flat'?[text()]:[{name:'Holder',type:'FRAME',layout:layout([11,13,17,19]),children:[text()]}]}))});
const read=(set:DumpSet,base=empty,projectionMode:'exact'|'reviewable-inversion'='exact')=>{const source=JSON.stringify(set),p=proposeFromDump(set,{corpus:tokenCorpusFromJson(base),mintUnbound:true,fileKey:'fixture',projectionMode,contractIdByName:new Map()});assert.equal(JSON.stringify(set),source,'source bytes/omission remain unchanged');const c=ContractSchema.parse(p.contract),scope=new Map([[c.id,c]]);const errors:string[]=[];validateContract(c,scope,errors,new Map());assert.deepEqual(errors,[]);const tokens={primitives:{...base.primitives,...p.mintedTokens?.tree},semantic:base.semantic,light:{},dark:{},brands:{default:{}}};return{p,c,scope,tokens,corpus:tokenCorpusFromJson({...tokens,brandDefault:{}})};};
const values=(part:ReturnType<typeof ContractSchema.parse>['anatomy']['root'],state:Record<string,string>,corpus:ReturnType<typeof tokenCorpusFromJson>)=>Object.fromEntries(Object.entries({...resolveTokens(part,state),...resolveLiterals(part,state)}).map(([k,v])=>[k,v.startsWith('{')?String(corpus.resolveLiteral(v.slice(1,-1).replace(/\{([^{}]+)\}/g,(_,key:string)=>state[key]??'{'+key+'}'))):v]));
const pads=(v:Record<string,string>)=>[v['padding-top']??v['padding-block']??'0px',v['padding-right']??v['padding-inline']??'0px',v['padding-bottom']??v['padding-block']??'0px',v['padding-left']??v['padding-inline']??'0px'];
const holder=(c:ReturnType<typeof ContractSchema.parse>)=>walkAnatomy(c).find(w=>w.name==='Holder'||w.name==='holder')!.part;

test('synthetic wrapper padding is neutral while real planes and parents keep separate asymmetric padding',()=>{
 const f=read(foldFixture()),h=holder(f.c);
 assert.deepEqual(pads(values(h,{kind:'flat'},f.corpus)),['0px','0px','0px','0px']);
 assert.deepEqual(pads(values(h,{kind:'nested'},f.corpus)),['11px','13px','17px','19px']);
 assert.deepEqual(pads(values(f.c.anatomy.root,{kind:'flat'},f.corpus)),['5px','3px','7px','4px']);
 assert(f.p.notes.some(n=>n.includes('synthetic wrapper "Holder" has neutral padding')));
 const sourceLeaf=text();assert.equal(Object.values(h.parts!)[0].text,sourceLeaf.text!.characters);
 const out=emitReact(f.c,{contracts:f.scope,icons:new Map(),tokens:new Set(flattenTokens(f.tokens.primitives).keys()),tokenValues:f.tokens});
 assert(out.css.includes('padding-top: 11px')||out.css.includes('padding-top: var('));
 const native=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.c,f.scope);
 assert.equal(native.variants.length,2);for(const v of native.variants){const host=v.spec.children![0];assert.equal(host.name,'Holder');assert.equal(host.children?.length,1);}
});
test('synthetic holders do not borrow padding variable ownership from a real plane',()=>{
 const set=foldFixture();const n=set.variants[0].children![0];n.layout!.padding=[8,6,8,6];n.bound={paddingTop:'space.y',paddingBottom:'space.y',paddingLeft:'space.x',paddingRight:'space.x'};
 const f=read(set,{...empty,primitives:{space:{x:{$type:'dimension',$value:'6px'},y:{$type:'dimension',$value:'8px'}}}}),h=holder(f.c);
 assert.deepEqual(pads(values(h,{kind:'flat'},f.corpus)),['0px','0px','0px','0px']);
 assert.deepEqual(pads(values(h,{kind:'nested'},f.corpus)),['8px','6px','8px','6px']);
 assert(!Object.values(resolveTokens(h,{kind:'flat'})).includes('{space.y}'));
 assert(f.p.notes.some(n=>n.includes('binding identity')&&n.includes('space.y')),'partial binding fallback remains explicitly named');
});
test('real missing and explicit zero padding remain distinct source records; only flat normalization is named synthetic',()=>{
 const set=foldFixture();assert.equal(set.propertyDefinitions!.Kind.type,'VARIANT');assert(set.propertyDefinitions!.Kind.type==='VARIANT');set.propertyDefinitions!.Kind.variantOptions=['Nested','Missing','Zero','Flat'];
 const real=set.variants[0];set.variants.splice(1,0,...['Missing','Zero'].map(kind=>{const v=structuredClone(real);v.name=`Kind=${kind}`;v.variantProperties={Kind:kind};v.children![0].layout!.padding=[0,0,0,0];if(kind==='Missing')delete(v.children![0].layout as Partial<NonNullable<DumpNode['layout']>>).padding;return v;}));
 const f=read(set),h=holder(f.c);
 for(const kind of ['missing','zero','flat'])assert.deepEqual(pads(values(h,{kind},f.corpus)),['0px','0px','0px','0px']);
 assert.equal(set.variants[1].children![0].layout!.padding,undefined);assert.deepEqual(set.variants[2].children![0].layout!.padding,[0,0,0,0]);
 assert.equal(f.p.notes.filter(n=>n.includes('synthetic wrapper "Holder" has neutral padding')).length,1);
});
test('painted and positioned wrapper ownership still prevent identity folding',()=>{
 for(const mutation of ['paint','position']){const set=foldFixture(),real=set.variants[0].children![0];if(mutation==='paint')real.fill={hex:'ff0000'};else real.children![0].abs={x:0,y:0,right:0,bottom:0,width:40,height:20,constraints:{horizontal:'LEFT',vertical:'TOP'}};
 const f=read(set);assert(!f.p.notes.some(n=>n.includes('has neutral padding')));assert(f.p.notes.some(n=>n.includes(mutation==='paint'?'painted wrapper':'positioned members')));}
});
const fixedTextFixture=(mode:'NONE'|'WIDTH_AND_HEIGHT'='NONE'):DumpSet=>({setName:'TextOwner',type:'COMPONENT',variants:[{name:'TextOwner',type:'COMPONENT',bbox:{width:38,height:42},layout:layout([3,2,7,4]),children:[{...text(),name:'label',fixedSize:mode==='NONE'?{width:32,height:32}:undefined,text:{characters:'◇\nSwap',fontSize:10,fontWeight:400,fontStyle:'Regular',fontFamily:'Roboto',lineHeight:10,textAlign:'CENTER',textAutoResize:mode},fill:{hex:'1890ff'}}]}]});

test('fixed NONE sole label keeps its own box, typography and newline semantics while root still hugs',()=>{
 const set=fixedTextFixture(),f=read(set),root=f.c.anatomy.root;assert.equal(root.text,undefined);assert.equal(root.literals?.height,'fit-content');assert.equal(root.tokens?.height,undefined);
 const leaf=walkAnatomy(f.c).find(w=>w.part.text==='◇\nSwap')!.part;
 const style=values(leaf,{},f.corpus);assert.equal(style.width,'32px');assert.equal(style.height,'32px');assert.equal(style['font-size'],'10px');assert.equal(style['line-height'],'10px');assert.equal(style['font-weight'],'400');assert.equal(style.color,'#1890ff');assert.equal(leaf.declared?.['font-family'],'Roboto');assert.equal(leaf.declared?.['text-align'],'center');assert.equal(leaf.declared?.['white-space'],'pre-wrap');
 const css=emitReact(f.c,{contracts:f.scope,icons:new Map(),tokens:new Set(flattenTokens(f.tokens.primitives).keys()),tokenValues:f.tokens}).css;assert.match(css,/white-space: pre-wrap/);assert.match(generateTsx(f.c,f.scope,new Map()),/◇\\nSwap/);
 const native=createFigmaEngine({tokens:f.tokens,icons:new Map()}).compileComponentData(f.c,f.scope).variants[0].spec;assert.equal(native.children!.length,1);assert.equal(native.children![0].type,'text');assert.equal(native.children![0].characters,'◇\nSwap');
 assert(f.p.notes.some(n=>n.includes('independently fixed NONE text box retained')));
});
test('intrinsic sole label keeps established root-text readback spelling and does not invent fixed dimensions',()=>{
 const f=read(fixedTextFixture('WIDTH_AND_HEIGHT'));assert.equal(f.c.anatomy.root.text,'◇\nSwap');assert.equal(f.c.anatomy.root.parts,undefined);assert.equal(f.c.anatomy.root.tokens?.height,undefined);
 const missing=fixedTextFixture();delete missing.variants[0].children![0].fixedSize;const m=read(missing);assert.equal(m.c.anatomy.root.text,'◇\nSwap');assert.equal(m.c.anatomy.root.tokens?.height,undefined);assert.equal(m.c.anatomy.root.literals?.height,'fit-content');assert(!m.p.notes.some(n=>n.includes('independently fixed NONE text box retained')));
});
test('independent fixed text sizes remain source-axis functions, with original characters and style on each leaf',()=>{
 const set=fixedTextFixture();set.type='COMPONENT_SET';set.propertyDefinitions={Size:{type:'VARIANT',defaultValue:'Short',variantOptions:['Short','Tall']}};const base=set.variants[0];set.variants=['Short','Tall'].map(size=>{const v=structuredClone(base);v.name=`Size=${size}`;v.variantProperties={Size:size};v.children![0].fixedSize={width:32,height:size==='Short'?32:48};v.children![0].text!.characters=size==='Short'?'◇\nSwap':'◇\nActual';return v;});
 const f=read(set),leaf=walkAnatomy(f.c).find(w=>w.part.text!==undefined)!.part;assert.equal(f.c.anatomy.root.text,undefined);assert.equal(leaf.text,'◇\nSwap');assert.equal(leaf.textByProp?.map.short??leaf.text,'◇\nSwap');assert.equal(leaf.textByProp?.map.tall??leaf.text,'◇\nActual');
 for(const [size,height] of [['short','32px'],['tall','48px']])assert.equal(values(leaf,{size},f.corpus).height,height);
 const inline=emitReactInline(f.c,{contracts:f.scope,icons:new Map(),tokens:f.tokens});assert.match(inline.tsx,/pre-wrap/);assert.match(inline.tsx,/32px/);assert.match(inline.tsx,/48px/);
});
test('fixed label retention preserves already qualified children text API instead of renaming caller controls',()=>{
 for(const property of ['Children','Content','Label']){const set=fixedTextFixture();set.propertyDefinitions={[property]:{type:'TEXT',defaultValue:'◇\nSwap'}};set.variants[0].children![0].propRefs={characters:property};
 const f=read(set);assert.equal(f.c.props.find(p=>p.bindings.figma.kind==='TEXT')!.bindings.figma.property,property);assert.equal(f.c.anatomy.root.text,undefined);assert.equal(f.c.props.find(p=>p.bindings.figma.kind==='TEXT')!.bindings.code.prop,'children');const leaf=walkAnatomy(f.c).find(w=>w.part.content)?.part;assert.deepEqual(leaf?.content,{prop:'children'});assert.equal(values(leaf!,{},f.corpus).height,'32px');
 assert.match(generateTsx(f.c,f.scope,new Map()),/children/);assert.match(emitReactInline(f.c,{contracts:f.scope,icons:new Map(),tokens:f.tokens}).tsx,/children/);}
});

test('mixed fixed NONE and unobserved dimensions retain only each qualified source plane',()=>{
 const set=fixedTextFixture();set.type='COMPONENT_SET';set.propertyDefinitions={Size:{type:'VARIANT',defaultValue:'Fixed',variantOptions:['Fixed','Missing']}};const base=set.variants[0];set.variants=['Fixed','Missing'].map(size=>{const v=structuredClone(base);v.name=`Size=${size}`;v.variantProperties={Size:size};if(size==='Missing')delete v.children![0].fixedSize;return v;});
 const f=read(set),leaf=walkAnatomy(f.c).find(w=>w.part.text==='◇\nSwap')!.part;
 assert.equal(values(leaf,{size:'fixed'},f.corpus).height,'32px');assert.equal(values(leaf,{size:'missing'},f.corpus).height,undefined);assert.equal(values(leaf,{size:'missing'},f.corpus).width,undefined);
 assert(f.p.notes.some(n=>n.includes('CARRIED AS SCOPED FIXED GEOMETRY')));assert.equal(f.c.anatomy.root.tokens?.height,undefined);
 const hug=structuredClone(set);hug.variants[1].children![0].text!.textAutoResize='WIDTH_AND_HEIGHT';const h=read(hug);
 const fixed=walkAnatomy(h.c).find(w=>w.part.declared?.['white-space']==='pre-wrap')!.part,auto=walkAnatomy(h.c).find(w=>w.part.textAutoResize==='WIDTH_AND_HEIGHT')!.part;
 assert(fixed.visibleWhen||fixed.presenceByCombination);assert(auto.visibleWhen||auto.presenceByCombination);assert.equal(values(fixed,{size:'fixed'},h.corpus).height,'32px');assert.equal(values(auto,{size:'missing'},h.corpus).height,undefined);
});
test('nonfinite or invalid fixed NONE leaf dimensions retain a named source refusal',()=>{
 for(const bad of [NaN,Infinity,-1,null]){const set=fixedTextFixture();set.variants[0].children![0].fixedSize!.height=bad as number;assert.throws(()=>read(set),/fixed-text-box-source-size-unqualified:TextOwner:root\/label/,String(bad));}
});
test('unknown and contradictory wrapper tuples keep exact-source refusal authority',()=>{
 const unknown=foldFixture();unknown.variants[1].name='Kind=Unknown';unknown.variants[1].variantProperties={Kind:'Unknown'};assert.throws(()=>read(unknown),/invalid values.*Kind/);
 const duplicate=foldFixture();const extra=structuredClone(duplicate.variants[0]);extra.children![0].layout!.padding=[1,2,3,4];duplicate.variants.push(extra);assert.throws(()=>read(duplicate),/duplicates tuple/);
});

import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
test('fixed children text carrier preserves actual default, caller replacement and explicit empty semantics on both React surfaces',()=>{
 for(const property of ['Children','Content','Label']){const set=fixedTextFixture();set.propertyDefinitions={[property]:{type:'TEXT',defaultValue:'◇\nSwap'}};set.variants[0].children![0].propRefs={characters:property};const f=read(set);
 for(const code of [generateTsx(f.c,f.scope,new Map()),emitReactInline(f.c,{contracts:f.scope,icons:new Map(),tokens:f.tokens}).tsx]){
  const mod={exports:{} as Record<string,any>};vm.runInNewContext(transformSync(code,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module:mod,exports:mod.exports,require:(id:string)=>id.endsWith('.css')?{}:require(id)});
  const render=(children?:string)=>renderToStaticMarkup(createElement(mod.exports[f.c.name],{children}));assert.equal(f.c.props.find(p=>p.bindings.figma.kind==='TEXT')!.default,'◇\nSwap');assert.doesNotMatch(render(),/◇|Swap/,'TEXT children default remains story/canvas-only, as on the original emitter');assert.match(render('caller replacement'),/caller replacement/);assert.doesNotMatch(render('caller replacement'),/◇|Swap/);assert.doesNotMatch(render(''),/◇|Swap/);
 }}
});

import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
test('compiler root-content readback keeps priority and rejects a forged fixed-label replacement before hoisting',async()=>{
 const c=ContractSchema.parse({id:'test.root-content-priority',name:'RootContentPriority',version:'0.1.0',status:'draft',description:'Independent empty compiler SLOT',semantics:{element:'div'},props:[],states:[],anatomy:{root:{slot:{name:'children'},layout:{display:'flex',direction:'column',align:'start',justify:'start'},literals:{'padding-block':'4px'}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./RootContentPriority',export:'RootContentPriority'}}}}),engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),scope=new Map([[c.id,c]]);
 const {figma}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20000}) as Promise<any>;
 await run(engine.buildComponentScript(c,scope));const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([c.name])};`);const dumped=JSON.parse(JSON.stringify((await run(source))[c.name])) as DumpSet;
 assert.deepEqual(dumped.rootSlot,{version:1,property:'Children'});const f=read(dumped);assert.deepEqual(f.c.anatomy.root.slot,{name:'children'});assert.equal(f.c.anatomy.root.parts,undefined);assert.equal(f.c.anatomy.root.text,undefined);
 for(const code of [generateTsx(f.c,f.scope,new Map()),emitReactInline(f.c,{contracts:f.scope,icons:new Map(),tokens:f.tokens}).tsx]){const mod={exports:{} as Record<string,any>};vm.runInNewContext(transformSync(code,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module:mod,exports:mod.exports,require:(id:string)=>id.endsWith('.css')?{}:require(id)});assert.doesNotMatch(renderToStaticMarkup(createElement(mod.exports[f.c.name])),/Swap|source/);assert.match(renderToStaticMarkup(createElement(mod.exports[f.c.name],null,'caller')),/caller/);}
 const malformed=structuredClone(dumped);malformed.variants[0].children=structuredClone(fixedTextFixture().variants[0].children);assert.throws(()=>read(malformed),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED:.*content structure disagrees/);
});
test('all four source padding binding fields remain plane-owned after actual theme and state preprocessing',()=>{
 const set=foldFixture(),base=structuredClone(set.variants);set.propertyDefinitions!.Theme={type:'VARIANT',defaultValue:'Light',variantOptions:['Light','Dark']};set.propertyDefinitions!.State={type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover']};
 set.variants=['Light','Dark'].flatMap(theme=>['Default','Hover'].flatMap(state=>base.map(v=>{const n=structuredClone(v);n.name+=`, Theme=${theme}, State=${state}`;n.variantProperties={...n.variantProperties,Theme:theme,State:state};n.fill={hex:state==='Hover'?'aaccff':'ffffff'};if(n.variantProperties.Kind==='Nested'){n.children![0].layout!.padding=[8,6,8,6];n.children![0].bound={paddingTop:'space.y',paddingBottom:'space.y',paddingLeft:'space.x',paddingRight:'space.x'};}return n;})));
 const sourceTokens={...empty,primitives:{space:{x:{$type:'dimension',$value:'6px'},y:{$type:'dimension',$value:'8px'}}}};assert.throws(()=>read(set,sourceTokens),/Exact proposal cannot promote variant axis.*Theme/,'exact semantic-projection refusal stays intact');const f=read(set,sourceTokens,'reviewable-inversion'),h=holder(f.c);
 assert(f.p.notes.some(n=>n.includes('IS a token-mode axis')),'Theme preprocessing must actually run');assert(!f.c.props.some(p=>p.name==='theme'));assert(f.c.states.includes('hover'),'State preprocessing must actually run');
 assert.deepEqual(pads(values(h,{kind:'flat'},f.corpus)),['0px','0px','0px','0px']);assert.deepEqual(pads(values(h,{kind:'nested'},f.corpus)),['8px','6px','8px','6px']);
 assert(!Object.values(h.states?.hover??{}).some(v=>v==='{space.x}'||v==='{space.y}'),'unchanged hover cannot restore source bindings to every flat plane');
});
