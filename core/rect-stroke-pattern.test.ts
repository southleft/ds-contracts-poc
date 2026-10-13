import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {observeRectStrokePattern} from '../extract/figma/rect-stroke-pattern.js';
import {mapRestToDump} from '../extract/figma/rest/map.js';
import {proposeFromDump} from './propose-figma.js';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {generatedTypeErrors,mountGenerated} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {chromium} from 'playwright-core';
import {flattenTokens} from './tokens.js';
import {lowerStrokeRings} from '../packages/core/src/anatomy.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const raw=(id:string,pattern:number[]=[])=>({id,type:'COMPONENT',name:id,layoutMode:'HORIZONTAL',primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED',
 strokeAlign:'INSIDE',strokeWeight:1,strokesIncludedInLayout:false,cornerRadius:10,
 fills:[{type:'SOLID',color:{r:1,g:1,b:1,a:1}}],strokes:[{type:'SOLID',blendMode:'NORMAL',color:{r:0.7,g:0.7,b:0.7,a:1}}],
 strokeDashes:pattern,absoluteBoundingBox:{x:0,y:0,width:120,height:40},children:[]});
const composedStroke=[
 {blendMode:'NORMAL',type:'SOLID',color:{r:0.8627451062202454,g:0.14901961386203766,b:0.14901961386203766,a:1},boundVariables:{color:{type:'VARIABLE_ALIAS',id:'VariableID:1953:9388'}}},
 {opacity:0.699999988079071,blendMode:'NORMAL',type:'SOLID',color:{r:1,g:1,b:1,a:1},boundVariables:{color:{type:'VARIABLE_ALIAS',id:'VariableID:1953:9417'}}},
];
function fixture(tones=['Plain','Idle'],sizes=['Small','Large']){
 const roots=tones.flatMap(tone=>sizes.map(size=>({...raw(tone+'-'+size,tone==='Idle'?[3,2]:[]),
  ...(tone==='Error'?{strokes:structuredClone(composedStroke)}:{}),
  name:`Tone=${tone}, Size=${size}`,componentPropertyDefinitions:{},absoluteBoundingBox:{x:0,y:0,width:120,height:size==='Small'?40:50}})));
 const response={name:'Fixture',version:'one',nodes:{'frame-set':{document:{id:'frame-set',type:'COMPONENT_SET',name:'PatternFrame',
  componentPropertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'Plain',variantOptions:tones},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:sizes}},children:roots}}}};
 const mapped=mapRestToDump(response as never,{fileKey:'fixture'});
 return {mapped,set:(mapped.dump as any).PatternFrame};
}
function propose(set=fixture().set){const result=proposeFromDump(set,{corpus,contractIdByName:new Map(),mintUnbound:true,fileKey:'fixture'});return {result,contract:ContractSchema.parse(result.contract)};}

test('ordinary mapper carries exact [3,2] and explicit solid rows; unsupported source stays refused',()=>{
 const f=fixture();assert(f.set);
 assert.deepEqual(f.set.variants.map((v:any)=>v.rectStrokePattern.dashes),[[],[],[3,2],[3,2]]);
 assert(!f.mapped.report.degradations.some((d:any)=>d.code==='stroke-style-unsupported'));
 const original=raw('source',[3,2]);
 for(const patch of [{type:'ELLIPSE'},{strokeAlign:'OUTSIDE'},{strokeWeight:0},{strokesIncludedInLayout:true},{cornerSmoothing:.2},
   {rectangleCornerRadii:[10,8,10,10]},{opacity:.5},{strokeDashes:[1,2,3,4]},{strokeDashes:[0,2]},{strokeDashes:[NaN,2]},
   {rotation:10},{strokeCap:'ROUND'},{strokeJoin:'BEVEL'},{strokes:[{type:'GRADIENT_LINEAR'}]},{strokes:[{type:'SOLID',blendMode:'MULTIPLY'}]}]){
  const n={...original,...patch};assert.equal(observeRectStrokePattern(n,n.strokeDashes),undefined,JSON.stringify(patch));
 }
 const nested=raw('nested',[3,2]),root={...raw('parent'),children:[nested]};
 const mapped=mapRestToDump({nodes:{parent:{document:root}}} as never,{fileKey:'fixture'});
 assert(mapped.report.degradations.some((d:any)=>d.code==='stroke-style-unsupported'));
 assert.deepEqual(original.strokeDashes,[3,2]);
});

test('solid multi-paint roots keep admitted geometry without widening dashed or unsupported paints',()=>{
 const source={...raw('composed-solid'),strokes:structuredClone(composedStroke)},before=JSON.stringify(source);
 assert.deepEqual(observeRectStrokePattern(source,[]),{nodeId:'composed-solid',weight:1,radius:10,dashes:[]});
 assert.equal(JSON.stringify(source),before);
 assert.equal(observeRectStrokePattern({...source,strokeDashes:[3,2]},[3,2]),undefined);
 for(const mutate of [
  (n:any)=>n.strokes[1].blendMode='MULTIPLY',
  (n:any)=>n.strokes[1].type='GRADIENT_LINEAR',
  (n:any)=>n.strokes[1].opacity=1.01,
  (n:any)=>delete n.strokes[1].color,
  (n:any)=>n.individualStrokeWeights={top:1,right:2,bottom:1,left:1},
  (n:any)=>n.strokeAlign='OUTSIDE',
 ]){const n=structuredClone(source);mutate(n);assert.equal(observeRectStrokePattern(n,[]),undefined);}
});

test('ordinary plugin reader admits the same solid stack and retains dashed-stack refusal',async()=>{
 const {figma}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20_000});
 await run(`const paints=${JSON.stringify(composedStroke)};
  const make=(name,dashes)=>{const n=figma.createComponent();n.name=name;n.layoutMode='HORIZONTAL';
   n.strokes=JSON.parse(JSON.stringify(paints));n.strokeWeight=1;n.strokeAlign='INSIDE';n.strokesIncludedInLayout=false;n.cornerRadius=10;n.dashPattern=dashes;return n;};
  const set=figma.combineAsVariants([make('Tone=Solid',[]),make('Tone=Dashed',[3,2])],figma.currentPage);set.name='PatternStack';`);
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8')
  .replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ['PatternStack'];`);
 const dump=JSON.parse(JSON.stringify(await run(source))),variants=dump.PatternStack.variants;
 assert.deepEqual(variants[0].rectStrokePattern,{nodeId:variants[0].nodeId,weight:1,radius:10,dashes:[]});
 assert.deepEqual(variants[0].stroke,{hex:'f5bebe'});
 assert.equal(variants[1].rectStrokePattern,undefined);
 assert(dump._degradations.some((d:any)=>d.code==='stroke-style-unsupported'&&d.nodePath.includes('Tone=Dashed')));
 assert(dump._degradations.some((d:any)=>d.code==='stroke-stack-resolved'));
});

test('a complete twelve-tuple pattern table retains ordinary multi-paint solid rows and all paint refusals',()=>{
 const f=fixture(['Plain','Send','Error','Idle'],['Small','Medium','Large']);
 assert.equal(f.set.variants.length,12);assert.equal(f.set.variants.filter((v:any)=>v.rectStrokePattern?.dashes.length===2).length,3);
 const errors=f.set.variants.filter((v:any)=>v.name.startsWith('Tone=Error,'));assert.equal(errors.length,3);
 for(const v of errors){assert.deepEqual(v.rectStrokePattern.dashes,[]);assert.deepEqual(v.stroke,{hex:'f5bebe'});}
 assert.equal(f.mapped.report.degradations.filter((d:any)=>d.code==='stroke-stack-resolved').length,3);
 const {contract}=propose(f.set),table=contract.anatomy.root.rectStrokePatternByCombination!;
 assert.equal(table.rows.length,12);assert.equal(table.rows.filter(r=>r.dashes.length===2).length,3);
 assert.equal(table.rows.filter(r=>r.dashes.length===0).length,9);
 for(const v of errors){const bad=structuredClone(f.set);delete bad.variants.find((n:any)=>n.nodeId===v.nodeId).rectStrokePattern;
  assert.equal(propose(bad).contract.anatomy.root.rectStrokePatternByCombination,undefined);}
});

test('complete source domain projects a root pattern; legacy/mismatched/incomplete source cannot gain it',()=>{
 const f=fixture(),before=JSON.stringify(f.set);const {contract}=propose(f.set);
 assert.equal(JSON.stringify(f.set),before);
 const t=contract.anatomy.root.rectStrokePatternByCombination!;
 assert.deepEqual(t.rows.map(r=>r.dashes),[[],[],[3,2],[3,2]]);
 for(const change of [(s:any)=>s.variants.forEach((v:any)=>delete v.rectStrokePattern),(s:any)=>delete s.variants[0].rectStrokePattern,
   (s:any)=>s.variants[2].rectStrokePattern.nodeId='foreign',(s:any)=>s.variants[2].rectStrokePattern.weight=2]){
  const s=structuredClone(f.set);change(s);assert.equal(propose(s).contract.anatomy.root.rectStrokePatternByCombination,undefined);
 }
 for(const change of [(c:Contract)=>c.anatomy.root.rectStrokePatternByCombination!.rows.pop(),
  (c:Contract)=>c.anatomy.root.rectStrokePatternByCombination!.rows.push(c.anatomy.root.rectStrokePatternByCombination!.rows[0]),
  (c:Contract)=>c.anatomy.root.rectStrokePatternByCombination!.rows[0].dashes=[1,2,3,4],
  (c:Contract)=>c.anatomy.root.strokesIncludedInLayout=undefined]){
  const c=structuredClone(contract);change(c);assert.equal(ContractSchema.safeParse(c).success,false);
 }
});

test('both React outputs share the exact SVG pattern and refuse unqualified native rendering',()=>{
 const {result,contract}=propose();const tokens={primitives:{...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 const contracts=new Map([[contract.id,contract]]);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(contract,{contracts,tokens,icons:new Map()}),tsx=files[0].contents;
  assert(tsx.includes('__DscRectStrokePattern'));assert(tsx.includes('strokeDasharray'));assert(tsx.includes('3,2'));
  assert(!tsx.includes('borderStyle: \'dashed\''));
  assert.deepEqual(generatedTypeErrors(contract.name,tsx),[]);
 }
 const legacy=structuredClone(contract);delete legacy.anatomy.root.rectStrokePatternByCombination;
 for(const emitter of [reactEmitter,reactInlineEmitter])assert(!emitter.emit(legacy,{contracts:new Map([[legacy.id,legacy]]),tokens,icons:new Map()})[0].contents.includes('__DscRectStrokePattern'));
 assert.throws(()=>lowerStrokeRings(contract),/rect-stroke-pattern-css-renderer-unavailable/);
 assert.doesNotThrow(()=>lowerStrokeRings(contract,true));
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,contracts),/native-rect-stroke-pattern-unsupported/);
});

test('live React pattern switches preserve root box and actual dash/gap lengths on both surfaces',async()=>{
 const {result,contract}=propose();const tokens={primitives:{...result.mintedTokens!.tree},semantic:{},light:{},dark:{},brands:{default:{}}};
 const contracts=new Map([[contract.id,contract]]),browser=await chromium.launch();
 try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(contract,{contracts,tokens,icons:new Map()}),page=await browser.newPage();
  const tokenCss=':root{'+[...flattenTokens(tokens.primitives)].map(([k,v])=>'--'+k.replace(/\./g,'-')+':'+v.value+';').join('')+'}';
  await mountGenerated(page,contract.name,`import './${contract.name}.module.css';\n`+files[0].contents,tokenCss+'\n'+files.filter(f=>f.path.endsWith('.css')).map(f=>f.contents).join('\n'));
  const snapshot=()=>page.locator('#root > *').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,
    dash:el.querySelector('rect')?.getAttribute('stroke-dasharray'),stroke:el.querySelector('rect')?.getAttribute('stroke-width')}));
  const before=await snapshot();await page.evaluate(()=>{(window as any).renderSubject({tone:'idle',size:'small'});});
  await page.waitForFunction(()=>document.querySelector('#root rect')?.getAttribute('stroke-dasharray')==='3 2');
  const after=await snapshot();assert.equal(after.width,before.width);assert.equal(after.height,before.height);assert.equal(after.stroke,'1');
  await page.evaluate(()=>{(window as any).renderSubject({tone:'plain',size:'small'});});
  assert.equal((await snapshot()).dash,null);
  await page.evaluate(()=>{const host=document.querySelector('#root > *') as HTMLElement;Object.assign(host.style,{boxSizing:'content-box',width:'123.375px',height:'41.125px',padding:'2px 7px 4px 3px'});});
  await page.waitForFunction(()=>document.querySelector('#root svg')?.getAttribute('viewBox')==='0 0 133.375 47.125');
  const localBox=await page.locator('#root svg').getAttribute('viewBox');
  await page.evaluate(()=>{document.body.style.transform='scale(2)';document.body.style.zoom='1.25';(window as any).renderSubject({tone:'idle',size:'small'});});
  assert.equal(await page.locator('#root svg').getAttribute('viewBox'),localBox);
  await page.addStyleTag({content:'body{--stroke-theme-test:#00ff00;--stroke-theme-radius:12px}body[data-theme=dark]{--stroke-theme-test:#0000ff;--stroke-theme-radius:16px}body[data-brand=red]{--stroke-theme-test:#ff0000}'});
  await page.evaluate(()=>{const host=document.querySelector('#root > *') as HTMLElement;host.style.setProperty('--_stroke-color','var(--stroke-theme-test)');host.style.borderRadius='var(--stroke-theme-radius)';document.body.dataset.theme='dark';});
  await page.waitForFunction(()=>document.querySelector('#root rect')?.getAttribute('rx')==='15.5');
  assert.equal(await page.locator('#root rect').evaluate(e=>getComputedStyle(e).stroke),'rgb(0, 0, 255)');
  await page.evaluate(()=>{document.body.dataset.brand='red';});
  assert.equal(await page.locator('#root rect').evaluate(e=>getComputedStyle(e).stroke),'rgb(255, 0, 0)');
  await page.close();
 }}finally{await browser.close();}
});
