import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {mintedTokenCss} from './mint-tokens.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(missing=false):any {
 return {setName:'Sizing',type:'COMPONENT_SET',propertyDefinitions:{Style:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Inline']}},variants:['Default','Inline'].map(style=>({name:`Style=${style}`,variantProperties:{Style:style},type:'COMPONENT',layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'FIXED'},fixedSize:{width:50},children:[{name:'Helper',type:'TEXT',...(style==='Default'?{fillWidth:true}:{}),text:{characters:'A long helper message',fontSize:12,fontStyle:'Regular',fontFamily:'Arial',lineHeight:16,...(!missing||style==='Inline'?{textAutoResize:style==='Inline'?'WIDTH_AND_HEIGHT':'HEIGHT'}:{})}}]}))};
}
test('captured variant text sizing retains mutually exclusive intrinsic and wrapping parts',()=>{
 const set=fixture(),before=JSON.stringify(set);
 const r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
 const c=ContractSchema.parse(r.contract),parts=walkAnatomy(c).filter(({part})=>part.text==='A long helper message');
 assert.equal(parts.length,2);
 const hug=parts.find(({part})=>part.textAutoResize==='WIDTH_AND_HEIGHT')!.part;
 const fill=parts.find(({part})=>!part.textAutoResize)!.part;
 assert.deepEqual(hug.visibleWhen,{prop:'style',equals:'inline'});
 assert.deepEqual(fill.visibleWhen,{prop:'style',equals:'default'});
 assert.equal(JSON.stringify(set),before);
});
test('missing resize evidence does not infer a branch or an intrinsic flag',()=>{
 const r=proposeFromDump(fixture(true),{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
 assert(!r.notes.some(x=>x.includes('source-text-sizing-partition')));
 assert(!walkAnatomy(ContractSchema.parse(r.contract)).some(({part})=>part.textAutoResize));
});
test('both React emitters switch between wrapped fill and intrinsic text without duplicate content',async t=>{
 const {chromium}=await import('playwright-core');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const r=proposeFromDump(fixture(),{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
 const c=ContractSchema.parse(r.contract),browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();
  const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)+"\n#root > * { width: 50px; }"});
  const sizes=[];
  for(const styleProp of ['default','inline','default']){
   await render({styleProp});
   sizes.push(await page.locator('#root').evaluate(root=>{
    const leaf=[...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&el.textContent==='A long helper message');
    const visible=leaf.filter(el=>el.getBoundingClientRect().width>0);if(visible.length!==1)throw Error('expected exactly one visible text part: '+visible.length);
    const box=visible[0].getBoundingClientRect();return {width:box.width,height:box.height};
   }));
  }
  assert(sizes[0].height>16,JSON.stringify(sizes));
  assert.equal(sizes[1].height,16);assert(sizes[1].width>50);
  assert.deepEqual(sizes[2],sizes[0]);await page.close();
 }
});
test('a shared text layer preserves different controls and an unbound literal across variants',async t=>{
 const set=fixture();
 set.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'Empty',variantOptions:['Empty','Filled','Read-only']},Placeholder:{type:'TEXT',defaultValue:'Placeholder'},Input:{type:'TEXT',defaultValue:'Input'}};
 const base=set.variants[0];
 set.variants=['Empty','Filled','Read-only'].map((mode,index)=>({...structuredClone(base),name:`Mode=${mode}`,variantProperties:{Mode:mode},children:[{name:'Shared layer',type:'TEXT',...(index<2?{propRefs:{characters:index===0?'Placeholder':'Input'}}:{}),text:{characters:['Placeholder','Input','No input text'][index],fontSize:12,fontStyle:'Regular',fontFamily:'Arial',lineHeight:16,textAutoResize:'WIDTH_AND_HEIGHT'}}]}));
 const before=JSON.stringify(set),r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 assert.equal(JSON.stringify(set),before);
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  for(const [mode,expected] of [['empty','Edited placeholder'],['filled','Edited input'],['readOnly','No input text'],['empty','Edited placeholder']]){
   await render({mode,placeholder:'Edited placeholder',input:'Edited input'});
   assert.equal(await page.locator('#root').innerText(),expected);
  }
  await page.close();
 }
});


test('fixed text boxes retain line breaks and captured height in both React emitters',async t=>{
 const {chromium}=await import('playwright-core');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const set:any={setName:'FixedLines',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Short',variantOptions:['Short','Tall']}},variants:['Short','Tall'].map(size=>({name:`Size=${size}`,type:'COMPONENT',variantProperties:{Size:size},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Text',type:'TEXT',fixedSize:{width:120,height:size==='Short'?20:60},text:{characters:'First\nSecond\nThird',fontFamily:'Arial',fontStyle:'Regular',fontWeight:400,fontSize:14,lineHeight:20,textAutoResize:'NONE'}}]}))};
 const r=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(r.contract),browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const native=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts);
 assert.deepEqual(native.variants.map(v=>v.spec.children![0].fixedHeight?.px),[20,60]);
 assert(native.variants.every(v=>v.spec.children![0].clipsContent===true&&v.spec.children![0].characters==='First\nSecond\nThird'));
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)});
   for(const size of ['short','tall','short']){
    await render({size});const actual=await page.locator('#root').evaluate(root=>{
     const node=[...root.querySelectorAll('*')].find(n=>n.childElementCount===0&&n.textContent==='First\nSecond\nThird')!;
     return {height:node.getBoundingClientRect().height,whitespace:getComputedStyle(node).whiteSpace,overflow:getComputedStyle(node).overflowY,scrollHeight:node.scrollHeight};
    });assert.deepEqual(actual,{height:size==='short'?20:60,whitespace:'pre-wrap',overflow:'hidden',scrollHeight:60});
   }
  }finally{await page.close();}
 }
});

test('partial text presence and independent Boolean visibility both survive runtime toggles',async t=>{
 const set:any={setName:'ConditionalPrefix',type:'COMPONENT_SET',boolDefaults:{'Show prefix':false},propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Expanded','Condensed']},'Show prefix':{type:'BOOLEAN',defaultValue:false}},variants:['Compact','Expanded','Condensed'].map(mode=>({name:`Mode=${mode}`,variantProperties:{Mode:mode},type:'COMPONENT',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:mode!=='Expanded'?[{name:'Prefix',type:'TEXT',hidden:true,...(mode==='Compact'?{propRefs:{visible:'Show prefix'}}:{}),text:{characters:'Prefix:',fontSize:14,fontFamily:'Arial',fontStyle:'Regular',textAutoResize:'WIDTH_AND_HEIGHT'}}]:[]}))};
 const result=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,projectionMode:'exact',contractIdByName:new Map(),drawnVariantSurface:'react-runtime'}),contract=ContractSchema.parse(result.contract);
 const text=walkAnatomy(contract).find(p=>p.part.text==='Prefix:')!.part;
 assert(text.presenceByCombination);assert.deepEqual(text.visibleWhen,{prop:'showPrefix'});assert.equal(contract.props.find(p=>p.name==='showPrefix')?.default,false);
 const {chromium}=await import('playwright-core'),{reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());const ctx={contracts:new Map([[contract.id,contract]]),icons:new Map<string,string>(),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}}};
 const {createFigmaEngine}=await import('./emit-figma-script.js');const native=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(contract,ctx.contracts);assert.equal(native.variants.length,3);for(const v of native.variants)assert.equal(v.spec.children?.length??0,v.name==='Mode=Compact'?1:0,'native presence must exclude unbound hidden and absent planes');
 for(const emitter of [reactEmitter,reactInlineEmitter]){const files=emitter.emit(contract,ctx),page=await browser.newPage();try{const render=await mountGenerated(page,contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  for(const [mode,showPrefix,expected]of [['compact',undefined,false],['compact',true,true],['expanded',true,false],['condensed',true,false],['compact',false,false],['compact',true,true]] as const){await render({mode,...(showPrefix===undefined?{}:{showPrefix})});assert.equal((await page.locator('#root').innerText()).includes('Prefix:'),expected);}
 }finally{await page.close();}}
});

// Retained canonical TEXT 23202:247437, Twilio CodeBlock multi-line variant.
// Its 29 LF characters and 17x600 captured box are source facts. These tests
// exercise the ordinary proposer, not a qualified component-family replay.
const capturedLineNumbers = {
 name:'Line numbers',type:'TEXT',nodeId:'23202:247437',
 localGeometry:{nodeId:'23202:247437',parentId:'23202:247583',transform:[[1,0,0],[0,1,0]],localSize:{width:17,height:600},parentSize:{width:712,height:160}},
 text:{characters:'1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30',fontSize:14,fontStyle:'Regular',sourceAppearance:{issue:'text-appearance-range-incomplete'},fontWeight:400,lineHeight:20,fontFamily:'Twilio Sans Mono',textAlign:'RIGHT',textAutoResize:'WIDTH_AND_HEIGHT',letterSpacing:0},
 fill:{hex:'8891aa'},propRefs:{visible:'Line numbers'},
};
function capturedLineFixture(node:any=structuredClone(capturedLineNumbers)):any {
 return {setName:'CapturedLines',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default']},'Line numbers':{type:'BOOLEAN',defaultValue:true}},variants:[{name:'Mode=Default',variantProperties:{Mode:'Default'},type:'COMPONENT',nodeId:'23202:247583',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:20,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},fixedSize:{width:712,height:160},children:[node,{name:'Code',type:'TEXT',fillWidth:true,text:{characters:'code',fontFamily:'Arial',fontStyle:'Regular',fontSize:14,lineHeight:20,textAutoResize:'HEIGHT'}}]}]};
}
function capturedLineProposal(node:any=structuredClone(capturedLineNumbers)) {
 const set=capturedLineFixture(node),before=JSON.stringify(set);
 const result=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map()});
 assert.equal(JSON.stringify(set),before,'the source observations stay unchanged');
 const contract=ContractSchema.parse(result.contract);
 const part=walkAnatomy(contract).find(({part})=>part.text===node.text.characters)!.part;
 return {result,contract,part};
}
test('a fixed text box keeps an authored line feed', () => {
  const result = proposeFromDump({
    setName: 'Note', type: 'COMPONENT',
    variants: [{
      name: 'Note', type: 'COMPONENT', bbox: { width: 341, height: 80 },
      layout: { mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'FIXED', counterSizing: 'FIXED' },
      children: [{
        name: 'Body', type: 'TEXT', fill: { hex: '71717a' },
        text: { characters: 'Drag and drop\nAccepts files', fontSize: 14, lineHeight: 20, fontFamily: 'Inter', fontWeight: 400, textAlign: 'CENTER', textAutoResize: 'TRUNCATE' },
      }],
    }],
  } as never, { corpus, mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion' });
  const part = walkAnatomy(ContractSchema.parse(result.contract)).find((row) => row.part.text?.includes('\n'))!.part;
  assert.equal(part.declared?.['white-space'], 'pre-wrap');
  assert.equal(part.textAutoResize, undefined);
});

test('captured HUG LF text preserves line breaks without making incomplete appearance complete',()=>{
 const {result,part}=capturedLineProposal();
 assert.equal(part.textAutoResize,'WIDTH_AND_HEIGHT');
 assert.equal(part.declared?.['white-space'],'pre-wrap');
 assert.equal(part.declared?.['overflow-y'],undefined,'HUG overflow is not fixed-box clipping');
 assert.equal(part.text,capturedLineNumbers.text.characters);
 assert.equal(part.textAppearanceByCombination,undefined,'scalar layout evidence does not fabricate missing ranges');
 assert.equal(part.textAppearanceOverride,undefined);
 assert(result.notes.some(note=>note.includes('line feeds')&&note.includes('pre-wrap')));
 const absent=structuredClone(capturedLineNumbers);delete (absent.text as any).sourceAppearance;
 assert.equal(capturedLineProposal(absent).part.declared?.['white-space'],'pre-wrap','LF does not need authored range data');
});
test('captured LF text keeps its line breaks in unknown, HEIGHT and NONE boxes without claiming auto-width',()=>{
 for(const mode of [undefined,'HEIGHT','NONE']){
  const node:any=structuredClone(capturedLineNumbers);delete node.text.textAutoResize;if(mode)node.text.textAutoResize=mode;
  const {part}=capturedLineProposal(node);assert.equal(part.textAutoResize,undefined,String(mode));assert.equal(part.declared?.['white-space'],'pre-wrap',String(mode));
 }
 const oneLine=structuredClone(capturedLineNumbers);oneLine.text.characters='30';
 const one=capturedLineProposal(oneLine).part;assert.equal(one.textAutoResize,'WIDTH_AND_HEIGHT');assert.equal(one.declared?.['white-space'],undefined);
 const filled:any=structuredClone(capturedLineNumbers);filled.fillWidth=true;
 const fill=capturedLineProposal(filled);assert.equal(fill.part.textAutoResize,undefined);assert.equal(fill.part.declared?.['white-space'],'pre-wrap');assert(fill.result.notes.some(note=>note.includes('contradict')));
 const fixed:any=structuredClone(capturedLineNumbers);fixed.text.textAutoResize='NONE';fixed.fixedSize={width:17,height:40};
 const none=capturedLineProposal(fixed).part;assert.equal(none.declared?.['white-space'],'pre-wrap');assert.equal(none.declared?.['overflow-y'],'hidden');assert.equal(none.textAutoResize,undefined);
 const mixed=capturedLineFixture();mixed.propertyDefinitions.Mode={type:'VARIANT',defaultValue:'Known',variantOptions:['Known','Unknown']};
 mixed.variants=[{...mixed.variants[0],name:'Mode=Known',variantProperties:{Mode:'Known'}},{...structuredClone(mixed.variants[0]),name:'Mode=Unknown',variantProperties:{Mode:'Unknown'}}];
 delete mixed.variants[1].children[0].text.textAutoResize;
 const proposal=proposeFromDump(mixed,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map()});
 const textParts=walkAnatomy(ContractSchema.parse(proposal.contract)).filter(({part})=>part.text===capturedLineNumbers.text.characters);
 assert(textParts.length>0);assert(textParts.every(({part})=>part.textAutoResize===undefined&&part.declared?.['white-space']==='pre-wrap'),'an unknown source cell does not authorize HUG; its line feeds still break');
});
test('captured HUG LF geometry uses thirty line boxes and longest-line width in both React emitters',async t=>{
 const {chromium}=await import('playwright-core');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  for(const text of [capturedLineNumbers.text.characters,'30']){
   const node=structuredClone(capturedLineNumbers);node.text.characters=text;
   const {result,contract}=capturedLineProposal(node);
   const ctx={contracts:new Map([[contract.id,contract]]),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
   const files=emitter.emit(contract,ctx),page=await browser.newPage();
   try{
    const render=await mountGenerated(page,contract.name,files[0].contents,files.find(file=>file.path.endsWith('.css'))?.contents);
    await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)});await render({});
    const actual=await page.locator('#root').evaluate((root,text)=>{
     const element=[...root.querySelectorAll<HTMLElement>('*')].find(el=>el.childElementCount===0&&el.textContent===text)!;
     const code=[...root.querySelectorAll<HTMLElement>('*')].find(el=>el.childElementCount===0&&el.textContent==='code')!;
     const box=element.getBoundingClientRect(),style=getComputedStyle(element),textNode=element.firstChild!;
     let offset=0;const lines=text.split('\n').map(line=>{const range=document.createRange();range.setStart(textNode,offset);range.setEnd(textNode,offset+line.length);offset+=line.length+1;const rect=range.getBoundingClientRect();return {width:rect.width,y:rect.y};});
     return {width:box.width,height:box.height,whiteSpace:style.whiteSpace,fontFamily:style.fontFamily,lineHeight:style.lineHeight,lines,gap:code.getBoundingClientRect().left-box.right};
    },text);
    assert.equal(actual.height,text.includes('\n')?capturedLineNumbers.localGeometry.localSize.height:20);
    assert.equal(actual.whiteSpace,text.includes('\n')?'pre-wrap':'normal');
    assert.equal(actual.lineHeight,'20px');assert.equal(actual.fontFamily,'"Twilio Sans Mono"');
    assert.equal(actual.width,Math.ceil(Math.max(...actual.lines.map(line=>line.width))));
    assert.equal(new Set(actual.lines.map(line=>line.y)).size,text.includes('\n')?30:1);
    for(let i=1;i<actual.lines.length;i++)assert.equal(actual.lines[i].y-actual.lines[i-1].y,20);
    assert.equal(actual.gap,20,'the next cell follows the longest line, not the collapsed thirty-number run');
    t.diagnostic(JSON.stringify({surface:emitter===reactEmitter?'react-css':'react-inline',characters:text.length,width:actual.width,height:actual.height,lineCount:actual.lines.length,whiteSpace:actual.whiteSpace,gap:actual.gap}));
    // The same emitted HUG part must still honor a legitimate authored bound.
    if(text.includes('\n')){
     await page.locator('#root').evaluate(root=>{const el=[...root.querySelectorAll<HTMLElement>('*')].find(el=>el.childElementCount===0&&el.textContent?.startsWith('1\n2'))!;el.textContent='two words\nthree words';el.style.maxWidth='55px';});
     const bounded=await page.locator('#root').evaluate(root=>{const el=[...root.querySelectorAll<HTMLElement>('*')].find(el=>el.childElementCount===0&&el.textContent==='two words\nthree words')!;const box=el.getBoundingClientRect();return {width:box.width,height:box.height};});
     assert.equal(bounded.width,55);assert(bounded.height>40,'pre-wrap preserves soft wrapping within an authored max-width');
    }
   }finally{await page.close();}
  }
 }
});
