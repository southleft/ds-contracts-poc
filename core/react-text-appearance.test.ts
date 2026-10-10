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


test('font-axis CSS preserves custom values, canonical order, empty and absent maps',()=>{
 const plain=appearance();assert.ok('runs'in plain);const before=structuredClone(plain);
 assert.equal(Object.hasOwn(compileReactTextAppearance(plain).runs[0].style,'fontVariationSettings'),false);
 const source=structuredClone(plain);source.runs[0].fontName.variationSettings={wght:430.5,slnt:0,XTRA:-.25};source.runs[1].fontName.variationSettings={};
 const reordered=structuredClone(source);reordered.runs[0].fontName.variationSettings={XTRA:-.25,slnt:0,wght:430.5};
 const compiled=compileReactTextAppearance(source);
 assert.equal(compiled.runs[0].style.fontVariationSettings,'"XTRA" -0.25, "slnt" 0, "wght" 430.5');
 assert.equal(compiled.runs[1].style.fontVariationSettings,'normal');
 assert.equal(JSON.stringify(compiled),JSON.stringify(compileReactTextAppearance(reordered)));
 const withoutAxes=structuredClone(compiled);for(const r of withoutAxes.runs)delete r.style.fontVariationSettings;
 assert.deepEqual(withoutAxes,compileReactTextAppearance(plain),'axis transport must not change legacy source style fields');
 assert.deepEqual(plain,before,'compilation leaves no-axis source unchanged');
});

test('authored ranges select canonical aliased tuples, yield to explicit choices and restore changed or empty caller text',async t=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const source=appearance();assert.ok('runs'in source);
 for(const r of source.runs)r.fontName.variationSettings={wght:400,slnt:0,XTRA:-.25};
 const strong=structuredClone(source);strong.runs[1].fill.paint.color={r:1,g:0,b:0};
 strong.runs[1].fontName.variationSettings={wght:625,slnt:-4,XTRA:1.25};
 const explicit=structuredClone(source);explicit.runs[1].fill.paint.color={r:0,g:1,b:0};explicit.runs[1].fontName.variationSettings={};
 const c=ContractSchema.parse({id:'test.authored-appearance',name:'AuthoredAppearance',version:'0.1.0',status:'draft',description:'Owned range defaults',semantics:{element:'div'},props:[
  {name:'tone',type:{enum:['calm','strong']},default:'calm',bindings:{code:{prop:'toneKind'},figma:{kind:'VARIANT',property:'Tone',values:{calm:'Calm',strong:'Strong'}}}},
  {name:'text',type:'text',default:source.characters,bindings:{code:{prop:'description'},figma:{kind:'TEXT',property:'Description'}}},
  {name:'appearance',type:{enum:['explicit']},bindings:{code:{prop:'appearance'},figma:{kind:'NONE'}}},
 ],states:[],anatomy:{root:{parts:{description:{content:{prop:'description'},literals:{color:'#d6deeb','font-size':'14px','line-height':'40px'},textAppearanceByCombination:{props:['tone'],rows:[{values:['calm'],appearance:source},{values:['strong'],appearance:strong}]},textAppearanceOverride:{prop:'appearance',choices:{explicit}}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./AuthoredAppearance',export:'AuthoredAppearance'}}}});
 const ctx={tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},contracts:new Map([[c.id,c]]),icons:new Map<string,string>()};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx);assert.deepEqual(generatedTypeErrors(c.name,files[0].contents),[]);
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await render({});assert.equal(await page.locator('#root').textContent(),source.characters);
  assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).color),'rgb(0, 0, 255)');
  assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).fontVariationSettings),'"XTRA" -0.25, "slnt" 0, "wght" 400');
  await render({toneKind:'strong'});assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).color),'rgb(255, 0, 0)');
  assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).fontVariationSettings),'"XTRA" 1.25, "slnt" -4, "wght" 625');
  await render({toneKind:'strong',appearance:'explicit'});assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).color),'rgb(0, 255, 0)');
  assert.equal(await page.locator('#root span').last().evaluate(n=>getComputedStyle(n).fontVariationSettings),'normal','explicit empty axis map clears authored axes');
  for(const replacement of ['Changed caller text','']){
   await render({description:replacement});assert.equal(await page.locator('#root').textContent(),replacement);
   const textNode=page.locator('#root > div > span');
   assert.equal(await textNode.evaluate(n=>getComputedStyle(n).color),'rgb(214, 222, 235)');
   assert.equal(await textNode.evaluate(n=>getComputedStyle(n).lineHeight),'40px');
   assert.equal(await textNode.evaluate(n=>getComputedStyle(n).fontVariationSettings),'normal','authored axes must not survive changed or empty caller text');
   assert.equal(await textNode.locator('span').count(),0,'source ranges must not survive a caller replacement');
  }
  const failure=page.waitForEvent('pageerror');await render({description:'Changed',appearance:'explicit'});
  assert.match((await failure).message,/text-appearance-characters-unqualified/);await page.close();
 }
 for(const mutate of [(x:any)=>x.anatomy.root.parts.description.textAppearanceByCombination.rows.pop(),(x:any)=>{x.anatomy.root.parts.description.textAppearanceByCombination.rows[0].values=['foreign'];},(x:any)=>{x.anatomy.root.parts.description.textAppearanceByCombination.rows[0].appearance.characters='stale';}]){
  const changed=structuredClone(c);mutate(changed);assert.equal(ContractSchema.safeParse(changed).success,false);
 }
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

// These compiler fixtures exercise portable authored-run binding semantics;
// they are not native-capture or source-assignment authority.
function boundTokenFixture() {
 const characters='Paid';
 const run={start:0,end:characters.length,fontName:{family:'Inter',style:'Medium',variationSettings:{wght:500,slnt:0,XTRA:1.25}},fontSize:14,fontWeight:500,lineHeight:{unit:'PIXELS',value:20},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fill:{paint:{color:{r:0,g:0,b:0},opacity:1,blendMode:'NORMAL'},variableId:'native:color'}};
 const part={text:characters,literals:{'letter-spacing':'0px'},declared:{display:'block','white-space':'pre','text-align':'left'},textAutoResize:'WIDTH_AND_HEIGHT',tokens:{color:'{test.ink}','font-size':'{test.size}'},textAppearanceTokenBindings:['color','font-size'],textAppearanceByCombination:{props:[],rows:[{values:[],appearance:{characters,runs:[run]}}]}};
 return {id:'test.bound-appearance',name:'BoundAppearance',version:'0.1.0',status:'draft',description:'Single native authored run, portable token carrier',semantics:{element:'div'},props:[],states:[],anatomy:{root:{parts:{label:part}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./BoundAppearance',export:'BoundAppearance'}}}};
}

test('bound token authored appearance preserves native axes and resolves portable single-run refs',async()=>{
 const {ContractSchema,textAppearanceTokenBindingIssues}=await import('../scripts/contract-schema.js');
 const {boundAuthoredReactTextAppearance}=await import('./react-text-appearance.js');
 const c=ContractSchema.parse(boundTokenFixture()),part=c.anatomy.root!.parts!.label;
 const before=structuredClone(part),bound=boundAuthoredReactTextAppearance(part)!;
 assert.deepEqual(textAppearanceTokenBindingIssues(part),[]);
 assert.equal(bound.runs[0].style.color,'var(--test-ink)');assert.equal(bound.runs[0].style.fontSize,'var(--test-size)');
 assert.equal(bound.runs[0].style.fontVariationSettings,'"XTRA" 1.25, "slnt" 0, "wght" 500');assert.equal(bound.runs[0].style.fontWeight,500);assert.equal(bound.runs[0].style.lineHeight,'20px');assert.equal(bound.runs[0].style.letterSpacing,'0px');
 assert.deepEqual(part,before,'binding compilation must not replace captured native fields');
 const legacy=structuredClone(part);delete legacy.textAppearanceTokenBindings;
 assert.equal(boundAuthoredReactTextAppearance(legacy),undefined,'legacy tables retain their existing scalar fallback precedence');
});

test('bound token authored appearance refuses ambiguous, stateful and malformed carriers',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {boundAuthoredReactTextAppearance}=await import('./react-text-appearance.js');
 const mutators:Array<(x:any)=>void>=[
  x=>{delete x.tokens.color;},x=>{x.tokens.color='{test_under.ink}';},x=>{x.tokens.color='{test.{tone}}';},
  x=>{x.textAppearanceByCombination.rows[0].appearance.runs.push({...x.textAppearanceByCombination.rows[0].appearance.runs[0]});},
  x=>{x.textAppearanceByCombination.rows[0].appearance.characters='stale';},
  x=>{x.content={prop:'label'};},x=>{x.states={hover:{color:'{test.other}'}};},
  x=>{x.statesByProp=[{prop:'tone',map:{calm:{color:'{test.other}'}}}];},
  x=>{x.tokensByProp={prop:'tone',map:{calm:{color:'{test.other}'}}};},
  x=>{x.literals.color='red';},x=>{x.declared['font-size']='14px';},
  x=>{x.textAppearanceByCombination.rows[0].appearance.runs[0].lineHeight={unit:'PERCENT',value:150};},
  x=>{x.textAppearanceByCombination.rows[0].appearance.runs[0].letterSpacing={unit:'PERCENT',value:2};},
 ];
 for(const mutate of mutators){const raw=boundTokenFixture();mutate(raw.anatomy.root.parts.label);assert.equal(ContractSchema.safeParse(raw).success,false);assert.throws(()=>boundAuthoredReactTextAppearance(raw.anatomy.root.parts.label as any));}
});

test('bound token authored appearance keeps native writer refusal for color and size-only refs',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');const {attachNativeAuthoredTextAppearance}=await import('./native-text-appearance.js');
 for(const sizeOnly of [false,true]){const raw=boundTokenFixture();if(sizeOnly){delete (raw.anatomy.root.parts.label.tokens as any).color;raw.anatomy.root.parts.label.textAppearanceTokenBindings=['font-size'];delete (raw.anatomy.root.parts.label.textAppearanceByCombination.rows[0].appearance.runs[0].fill as any).variableId;}
 const c=ContractSchema.parse(raw),part=c.anatomy.root!.parts!.label;assert.throws(()=>attachNativeAuthoredTextAppearance({characters:part.text},part,c,{}),/authored-text-appearance-token-binding-native-unsupported/);}
});

test('bound token authored appearance reaches both emitted React roots and spans without literal overrides',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {emitTokensCss,tokensCssLayers}=await import('../packages/core/src/emit-tokens-css.js');
 const {build}=await import('esbuild');const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const c=ContractSchema.parse(boundTokenFixture()),before=structuredClone(c);
 async function render(emitter:any,tokens:any){const files=emitter.emit(c,{tokens,contracts:new Map([[c.id,c]]),icons:new Map()});const tsx=files.find((f:any)=>f.path.endsWith('.tsx')).contents;
  assert.deepEqual(generatedTypeErrors(c.name,tsx),[]);
  const built=await build({stdin:{contents:tsx,resolveDir:process.cwd(),sourcefile:'bound.tsx',loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'css-modules-for-server-render',setup(b){b.onResolve({filter:/\.module\.css$/},()=>({path:'styles',namespace:'test-css'}));b.onLoad({filter:/.*/,namespace:'test-css'},()=>({contents:'export default new Proxy({}, {get: (_t, key) => String(key)})',loader:'js'}));}}]});
  const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');return {html:renderToStaticMarkup(React.createElement((mod.exports as any)[c.name],{})),files};}
 const tokens=(color:string,size:string)=>({primitives:{},semantic:{test:{ink:{$type:'color',$value:color},size:{$type:'dimension',$value:size}}},light:{},dark:{},brands:{default:{}}});
 const first=tokens('#123456','14px'),second=tokens('#abcdef','18px');
 const a=await render(reactEmitter,first),b=await render(reactEmitter,second);
 assert.equal(a.html,b.html,'CSS-variable renderer keeps refs when only token values change');assert.equal((a.html.match(/color:var\(--test-ink\)/g)??[]).length,2);assert.equal((a.html.match(/font-size:var\(--test-size\)/g)??[]).length,2);
 const sheetA=emitTokensCss(tokensCssLayers(first)).css,sheetB=emitTokensCss(tokensCssLayers(second)).css;assert.match(sheetA,/--test-ink: #123456;/);assert.match(sheetB,/--test-ink: #abcdef;/);assert.match(sheetB,/--test-size: 18px;/);
 const inlineA=await render(reactInlineEmitter,first),inlineB=await render(reactInlineEmitter,second);assert.equal((inlineA.html.match(/color:#123456/g)??[]).length,2);assert.equal((inlineB.html.match(/color:#abcdef/g)??[]).length,2);assert.equal((inlineB.html.match(/font-size:18px/g)??[]).length,2);assert.notEqual(inlineA.html,inlineB.html);
 for(const html of[a.html,b.html,inlineA.html,inlineB.html]){assert.match(html,/font-weight:500/);assert.match(html,/font-variation-settings:&quot;XTRA&quot; 1.25, &quot;slnt&quot; 0, &quot;wght&quot; 500/);assert.match(html,/line-height:20px/);assert.match(html,/text-transform:none/);assert.match(html,/text-decoration:none/);}
 assert.deepEqual(c,before);
});
