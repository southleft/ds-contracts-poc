import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {observeTextAppearance} from '../extract/figma/text-appearance-observation.js';
import {compileReactTextAppearance,REACT_TEXT_APPEARANCE_RUNTIME} from './react-text-appearance.js';
import {generatedTypeErrors,mountGenerated} from './react-test-runtime.js';
function appearance(){
 const text='First line\nLearn more';
 return observeTextAppearance(text,[{start:0,end:11,color:{r:0,g:0,b:0}},{start:11,end:text.length,color:{r:0,g:0,b:1}}].map(r=>({...r,characters:text.slice(r.start,r.end),fontName:{family:'Arial',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PERCENT',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:r.color}]})))!;
}
test('appearance compiler preserves source units, alpha, font and exact characters',()=>{
 const source=appearance();assert.ok('runs'in source);const before=structuredClone(source);
 source.runs[0].lineHeight={unit:'PERCENT',value:140};source.runs[1].lineHeight={unit:'PIXELS',value:19.6};
 source.runs[1].letterSpacing={unit:'PERCENT',value:2};source.runs[1].fill.paint.opacity=.5;
 const result=compileReactTextAppearance(source);
 assert.equal(result.characters,before.characters);assert.equal(result.runs[0].style.lineHeight,'20px');assert.equal(result.runs[1].style.lineHeight,'19.6px');assert.equal(result.runs[1].style.letterSpacing,'0.28px');assert.equal(result.runs[1].style.color,'rgba(0, 0, 255, 0.5)');
 assert.equal(source.runs[0].lineHeight.value,140);
 assert.throws(()=>compileReactTextAppearance({characters:'stale',runs:source.runs}),/unqualified/);
});
test('generated runtime renders distinct ranges and newline, then restores omitted appearance',async t=>{
 const choice=compileReactTextAppearance(appearance());
 const code=REACT_TEXT_APPEARANCE_RUNTIME+`
 export function Subject({value,characters=${JSON.stringify(choice.characters)}}:{value?:string;characters?:string}){
 return <__DscTextAppearance value={value} characters={characters} choices={${JSON.stringify({observed:choice})}}><div style={{fontFamily:'Arial',fontSize:14,lineHeight:'40px',color:'red'}}>Default</div></__DscTextAppearance>;
 }`;
 assert.deepEqual(generatedTypeErrors('Subject',code),[]);
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();
 const render=await mountGenerated(page,'Subject',code);const node=page.locator('#root > div');
 await render({});assert.equal(await node.textContent(),'Default');const original=await node.evaluate(n=>n.getBoundingClientRect().height);
 await render({value:'observed'});assert.equal(await node.textContent(),choice.characters);
 const measured=await node.evaluate(n=>({height:n.getBoundingClientRect().height,lineHeight:getComputedStyle(n).lineHeight,whiteSpace:getComputedStyle(n).whiteSpace,ranges:[...n.children].map(c=>({color:getComputedStyle(c).color,top:c.getBoundingClientRect().top}))}));
 assert.equal(measured.lineHeight,'normal');assert.equal(measured.whiteSpace,'pre-wrap');assert.deepEqual(measured.ranges.map(r=>r.color),['rgb(0, 0, 0)','rgb(0, 0, 255)']);assert.ok(measured.ranges[1].top>measured.ranges[0].top);assert.ok(measured.height<original);
 await render({});assert.equal(await node.textContent(),'Default');assert.equal(await node.evaluate(n=>n.getBoundingClientRect().height),original);
 const failure=page.waitForEvent('pageerror');
 await render({value:'observed',characters:'stale'});
 assert.match((await failure).message,/text-appearance-characters-unqualified/);
 assert.equal(await page.locator('#root').textContent(),'');
});

test('both production React emitters consume finite contract appearances without creating variant axes',async t=>{
 const {ContractSchema,absentVariantAxes}=await import('../scripts/contract-schema.js');
 const {reactEmitter,reactInlineEmitter,htmlEmitter}=await import('./emitter.js');
 const {emitWebComponent}=await import('../packages/emitter-web-components/src/emit-wc.js');
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const observed=appearance();assert.ok('runs'in observed);
 const c=ContractSchema.parse({id:'test.appearance',name:'Appearance',version:'0.1.0',status:'draft',description:'Finite appearance',semantics:{element:'div'},props:[{name:'appearance',type:{enum:['observed']},bindings:{code:{prop:'appearance'},figma:{kind:'NONE'}}}],states:[],anatomy:{root:{parts:{description:{text:observed.characters,literals:{color:'#ff0000','line-height':'40px'},textAppearanceOverride:{prop:'appearance',choices:{observed}}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./Appearance',export:'Appearance'}}}});
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()};
 assert.equal(absentVariantAxes(c).length,0);
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx);assert.deepEqual(generatedTypeErrors(c.name,files[0].contents),[]);
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await render({appearance:'observed'});
  assert.equal(await page.locator('#root').textContent(),observed.characters);
  assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).color),'rgb(0, 0, 255)');
  await render({});assert.equal(await page.locator('#root').textContent(),observed.characters);
  assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).color),'rgb(255, 0, 0)');await page.close();
 }
 assert.throws(()=>htmlEmitter.emit(c,ctx),/HTML_TEXT_APPEARANCE_UNSUPPORTED/);
 assert.throws(()=>emitWebComponent(c,{contracts:ctx.contracts,icons:ctx.icons}),/WEB_COMPONENT_TEXT_APPEARANCE_UNSUPPORTED/);
 assert.equal(createFigmaEngine({tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts).variants[0].spec.children?.[0].textAppearanceTarget,c.id+':appearance');
 for(const mutate of [(x:any)=>{x.props[0].default='observed';},(x:any)=>{x.anatomy.root.parts.description.textAppearanceOverride.choices.observed.runs[1].start=12;},(x:any)=>{x.anatomy.root.parts.description.textColorOverrideProp='appearance';}]){const copy=structuredClone(c);mutate(copy);assert.equal(ContractSchema.safeParse(copy).success,false);}
});
