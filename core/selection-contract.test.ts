import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { validateContract } from '../packages/core/src/validate.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitHtml } from './emit-html.js';
import { buildReactLibrary, parseLibraryRequest } from '../playground/server/react-library.js';

const bindings = { code: { anchors: { importPath: './probe', export: 'Probe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } };
const enumProp = (name: string, values: string[], initial: string, code=name) => ({name,type:{enum:values},default:initial,
  bindings:{code:{prop:code},figma:{kind:'VARIANT',property:name,values:Object.fromEntries(values.map(v=>[v,v]))}}});
const entry = ContractSchema.parse({id:'probe.choice',name:'Choice',version:'1.0.0',status:'draft',archetype:'none',description:'Reusable presentational native button.',
  semantics:{element:'button'},props:[enumProp('emphasis',['quiet','strong'],'quiet'),
    {name:'label',type:'text',default:'Choice',bindings:{code:{prop:'children'},figma:{kind:'TEXT',property:'Label'}}},
    {name:'disabled',type:'boolean',default:false,bindings:{code:{prop:'disabled'},figma:{kind:'BOOLEAN',property:'Disabled'}}}],states:[],
  anatomy:{root:{literals:{'background-color':'#ffffff'},literalsByProp:[{prop:'emphasis',map:{strong:{'background-color':'#ff0000'}}}],
    parts:{label:{content:{prop:'children'}}}}},bindings});
const values=['alpha','disabled','beta','gamma'];
const sample=values.map(identity=>({identity,label:identity,disabled:identity==='disabled'}));
function fixture(): Contract {
  const state=enumProp('selection',values,'alpha','value');
  return ContractSchema.parse({id:'probe.views',name:'ViewChoices',version:'1.0.0',status:'draft',archetype:'none',description:'Explicit finite single-selection relationship.',
    semantics:{element:'div'},props:[{...state,bindings:{...state.bindings,code:{...state.bindings.code,initial:{prop:'defaultValue'}}}},
      {name:'items',type:{arrayOf:{identity:'text',label:'text',disabled:'boolean'}},bindings:{code:{prop:'items'},figma:{kind:'NONE'}}}],states:[],
    anatomy:{root:{parts:{list:{attrs:{'aria-label':'Choose a view'},parts:{item:{component:{id:entry.id},repeat:{itemsProp:'items',keyField:'identity',sample}}}},
      ...Object.fromEntries(values.map(value=>[value+'Panel',{slot:{name:value+'Content'},layout:{display:'flex',direction:'column'},visibleWhen:{prop:'selection',equals:value}}]))}}},
    selection:{pattern:'tabs',valueProp:'selection',listPart:'list',itemPart:'item',selected:{prop:'emphasis',on:'strong',off:'quiet'},disabledField:'disabled',
      panels:values.map(value=>({value,part:value+'Panel',focusable:true})),orientation:'horizontal',direction:'ltr',activation:'automatic',bindings:{code:{prop:'onValueChange'}}},bindings});
}
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
const context=(parent:Contract)=>({contracts:new Map([[parent.id,parent],[entry.id,entry]]),icons:new Map<string,string>(),tokens:new Set<string>()});
const errors=(parent:Contract,child=entry)=>{const found:string[]=[];validateContract(parent,new Map([[parent.id,parent],[child.id,child]]),found,new Map());return found;};
function emit(parent:Contract,inline:boolean){const ctx=context(parent);return inline?{...emitReactInline(parent,{...ctx,tokens}),css:''}:emitReact(parent,ctx);}

test('the declared relationship generates working selection, linked persistent panels and active styling in both React surfaces',async t=>{
  const browser=await chromium.launch();t.after(()=>browser.close());
  for(const inline of [false,true]){
    const parent=fixture(), output=emit(parent,inline), child=emit(entry,inline);
    assert.deepEqual(errors(parent),[]);
    assert.deepEqual(generatedTypeErrors(parent.name,output.tsx+`
      const valid=<ViewChoices items={${JSON.stringify(sample)}} defaultValue="beta" onValueChange={(value:'alpha'|'disabled'|'beta'|'gamma')=>{}}/>;
      // @ts-expect-error a positional index cannot stand in for declared identity
      const invalid=<ViewChoices value={1}/>;
    `,{Choice:child.tsx}),[]);
    const source=output.tsx.replace('export const ViewChoices =','const GeneratedChoices =').replace('function ViewChoices(','function GeneratedChoices(')+`
      export function ViewChoices(props: ViewChoicesProps){return <GeneratedChoices {...props}
        alphaContent={<input aria-label="Alpha input" defaultValue="Alpha content"/>}
        betaContent={<input aria-label="Beta input" defaultValue="Beta content"/>}
        gammaContent={<input aria-label="Gamma input" defaultValue="Gamma content"/>}/>;}`;
    const page=await browser.newPage();page.setDefaultTimeout(3000);
    await mountGenerated(page,parent.name,source,output.css,{Choice:child});
    await page.evaluate(`window.calls=[];window.renderSubject({items:${JSON.stringify(sample)},onValueChange:value=>window.calls.push(value)});`);
    assert.equal(await page.getByRole('tab',{name:'alpha',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.getByRole('tab',{name:'alpha',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 0, 0)');
    await page.getByRole('textbox',{name:'Alpha input'}).fill('Retained alpha');
    await page.getByRole('tab',{name:'alpha',exact:true}).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'beta',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.getByRole('tab',{name:'beta',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 0, 0)');
    assert.equal(await page.getByRole('tab',{name:'alpha',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    assert.equal(await page.getByRole('tabpanel').count(),1);
    assert.equal(await page.locator('[role=tabpanel]').count(),4);
    assert.equal(await page.locator('[role=tabpanel][hidden]').first().evaluate(el=>getComputedStyle(el).display),'none');
    await page.keyboard.press('Home');
    assert.equal(await page.getByRole('textbox',{name:'Alpha input'}).inputValue(),'Retained alpha');
    assert.deepEqual(await page.evaluate('window.calls'),['beta','alpha']);
    const links=await page.locator('[role=tab]').evaluateAll(tabs=>tabs.every(tab=>document.getElementById(tab.getAttribute('aria-controls')!)?.getAttribute('aria-labelledby')===tab.id));
    assert.equal(links,true);
    await page.evaluate(`window.calls=[];window.renderSubject({items:${JSON.stringify(sample)},value:'alpha',onValueChange:value=>window.calls.push(value)});`);
    await page.getByRole('tab',{name:'beta',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'alpha',exact:true}).getAttribute('aria-selected'),'true');
    assert.deepEqual(await page.evaluate('window.calls'),['beta']);
    await page.evaluate(`window.renderSubject({key:'new',items:${JSON.stringify(sample)},defaultValue:'gamma'});`);
    assert.equal(await page.getByRole('tab',{name:'gamma',exact:true}).getAttribute('aria-selected'),'true');
    await page.evaluate(`window.renderSubject({key:'new',items:${JSON.stringify(sample)},defaultValue:'beta'});`);
    assert.equal(await page.getByRole('tab',{name:'gamma',exact:true}).getAttribute('aria-selected'),'true');
    await page.close();
  }
});

test('incomplete and conflicting mappings refuse instead of guessing behavior or losing content',()=>{
  const cases:[string,(c:Contract)=>void][]=[
    ['selection-panel-map-incomplete',c=>c.selection!.panels.pop()],
    ['selection-panel-map-incomplete',c=>c.selection!.panels[1].value='alpha'],
    ['selection-panel-invalid',c=>delete c.anatomy.root.parts!.alphaPanel.visibleWhen],
    ['selection-panel-invalid',c=>c.selection!.panels[0].part='list'],
    ['selection-item-invalid',c=>delete c.anatomy.root.parts!.list.parts!.item.repeat!.keyField],
    ['selection-list-invalid',c=>delete c.anatomy.root.parts!.list.attrs],
    ['selection-binding-collision',c=>c.anatomy.root.parts!.conflictingCallback={slot:{name:'onValueChange'}}],
    ['selection-item-state-conflict',c=>c.anatomy.root.parts!.list.parts!.item.component!.props={emphasis:'strong'}],
    ['selection-disabled-invalid',c=>c.selection!.disabledField='label'],
    ['selection-disabled-field-required',c=>delete c.selection!.disabledField],
    ['selection-disabled-sample-invalid',c=>delete c.anatomy.root.parts!.list.parts!.item.repeat!.sample[1].disabled],
    ['selection-panel-attrs-conflict',c=>c.anatomy.root.parts!.alphaPanel.attrs={hidden:'true'}],
    ['selection-root-unsupported',c=>c.semantics.element='button'],
    ['selection-items-invalid',c=>(c.props.find(p=>p.name==='items')!.type as {arrayOf:Record<string,string>}).arrayOf.identity='number'],
    ['selection-sample-map-invalid',c=>c.anatomy.root.parts!.list.parts!.item.repeat!.sample[1].identity='alpha'],
    ['selection-sample-map-invalid',c=>{const rows=c.anatomy.root.parts!.list.parts!.item.repeat!.sample;rows[0]=Object.assign(Object.create({identity:'alpha'}),{label:'alpha',disabled:false});}],
  ];
  const engine=createFigmaEngine({tokens,icons:new Map()});
  for(const [code,change] of cases){const parent=fixture();change(parent);assert.match(errors(parent).join('\n'),new RegExp(code));assert.throws(()=>emit(parent,false),new RegExp(code));
    assert.throws(()=>engine.compileComponentData(parent,context(parent).contracts),new RegExp(code),'direct native compilation must enforce selection relationships');}
  const other=structuredClone(entry);other.semantics.element='div';
  assert.match(errors(fixture(),other).join('\n'),/selection-item-host-unsupported/);
  const nested=structuredClone(entry);nested.anatomy.root.parts!.nestedAction={element:'button',text:'Nested action'};
  assert.match(errors(fixture(),nested).join('\n'),/selection-item-nested-interactive-unsupported/);
  const malformed=fixture();malformed.selection!.activation='hover' as any;
  assert.equal(ContractSchema.safeParse(malformed).success,false);
});

test('manual RTL selection and mapped child appearances work through component panel hosts',async t=>{
  const browser=await chromium.launch();t.after(()=>browser.close());
  const panel=ContractSchema.parse({id:'probe.pane',name:'Pane',version:'1.0.0',status:'draft',archetype:'none',description:'A reusable panel host.',semantics:{element:'div'},props:[],states:[],
    anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{content:{slot:{name:'children'}}}}},bindings});
  const mapped=structuredClone(entry);mapped.props[0].bindings.code.values={quiet:false,strong:true};mapped.props[0].bindings.code.prop='active';
  for(const inline of [false,true]){
    const parent=fixture();parent.selection!.activation='manual';parent.selection!.direction='rtl';
    for(const value of values)parent.anatomy.root.parts![value+'Panel']={component:{id:panel.id},parts:{[value+'Text']:{text:value+' content'}},visibleWhen:{prop:'selection',equals:value}};
    const ctx={...context(parent),contracts:new Map([[parent.id,parent],[mapped.id,mapped],[panel.id,panel]])};
    const generate=(c:Contract)=>inline?{...emitReactInline(c,{...ctx,tokens}),css:''}:emitReact(c,ctx);
    const output=generate(parent), child=generate(mapped), pane=generate(panel);
    assert.deepEqual(generatedTypeErrors(parent.name,output.tsx,{Choice:child.tsx,Pane:pane.tsx}),[]);
    const page=await browser.newPage();page.setDefaultTimeout(3000);
    await mountGenerated(page,parent.name,output.tsx,output.css,{Choice:child,Pane:pane});
    await page.evaluate(`window.calls=[];const render=value=>window.renderSubject({items:${JSON.stringify(sample)},value,onValueChange:next=>{window.calls.push(next);render(next)}});render('alpha');`);
    await page.getByRole('tab',{name:'alpha',exact:true}).focus();await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('[role=tab]:focus').textContent(),'beta');
    assert.equal(await page.locator('[role=tab][aria-selected=true]').textContent(),'alpha');
    assert.deepEqual(await page.evaluate('window.calls'),[]);
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate('window.calls'),['beta']);
    assert.equal(await page.getByRole('tabpanel').textContent(),'beta content');
    assert.equal(await page.getByRole('tabpanel').evaluate(el=>getComputedStyle(el).display),'flex');
    assert.equal(await page.locator('[role=tabpanel][hidden]').first().evaluate(el=>getComputedStyle(el).display),'none');
    assert.equal(await page.locator('[role=tab][aria-selected=true]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 0, 0)');
    await page.close();
  }
});

test('native and static projections select the matching sample item for each declared value',()=>{
  const parent=fixture(), ctx=context(parent), engine=createFigmaEngine({tokens,icons:ctx.icons});
  const data=engine.compileComponentData(parent,ctx.contracts);
  for(const variant of data.variants){
    const all:any[]=[];const visit=(n:any)=>{all.push(n);for(const child of n.children??[])visit(child);};visit(variant.spec);
    const selected=all.filter(n=>n.type==='instance'&&n.dep==='Choice'&&n.depProps?.emphasis==='strong');
    const disabled=variant.name==='selection=disabled';
    assert.equal(selected.length,disabled?0:1,JSON.stringify(variant));
    assert.equal(all.filter(n=>n.type==='slot').length,disabled?0:1);
  }
  const html=emitHtml(parent,ctx).html;
  assert.match(html,/choice--emphasis-strong/);
});

test('selection API names do not collide with generated record locals',()=>{
  const child=structuredClone(entry);
  child.props.push(ContractSchema.parse({...entry,props:[enumProp('density',['dense','comfortable'],'dense')]}).props[0]);
  const parent=fixture();parent.props[0].bindings.code.prop='item';
  parent.anatomy.root.parts!.list.parts!.item.component!.props={density:{prop:'selection',map:{alpha:'dense',disabled:'dense',beta:'comfortable',gamma:'dense'}}};
  const ctx={...context(parent),contracts:new Map([[parent.id,parent],[child.id,child]])};
  for(const inline of [false,true]){
    const generate=(c:Contract)=>inline?emitReactInline(c,{...ctx,tokens}):emitReact(c,ctx);
    assert.deepEqual(generatedTypeErrors(parent.name,generate(parent).tsx,{Choice:generate(child).tsx}),[]);
  }
});

test('the selection family installs from its archive and renders with React supplied only by the clean consumer',async()=>{
  const root=process.cwd(),work=mkdtempSync(path.join(tmpdir(),'selection-library-consumer-'));
  try{
    const host=path.join(work,'host');mkdirSync(host);symlinkSync(path.join(root,'node_modules'),path.join(host,'node_modules'));
    const parent=fixture(),input=parseLibraryRequest({rootId:parent.id,contracts:[parent,entry],tokens,icons:[]});
    const library=await buildReactLibrary(host,input);
    const entries=execFileSync('tar',['-tzf',library.tarball],{encoding:'utf8'});
    assert.match(entries,/dist\/ViewChoices\/ViewChoices\.d\.ts/);assert.match(entries,/dist\/Choice\/Choice\.js/);
    assert.doesNotMatch(entries,/\.tsx|node_modules|core\/react-selection/);
    const consumer=path.join(work,'consumer');mkdirSync(consumer);
    const version=JSON.parse(readFileSync(path.join(root,'node_modules/react/package.json'),'utf8')).version;
    writeFileSync(path.join(consumer,'package.json'),JSON.stringify({private:true,dependencies:{react:version,'react-dom':version,[library.name]:`file:${library.tarball}`}}));
    execFileSync('npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:consumer,stdio:'pipe',timeout:120_000});
    writeFileSync(path.join(consumer,'main.jsx'),`import {ViewChoices} from ${JSON.stringify(library.name)};import {renderToStaticMarkup} from 'react-dom/server';console.log(renderToStaticMarkup(<ViewChoices items={${JSON.stringify(sample)}} defaultValue="beta" alphaContent="First content" betaContent="Second content" gammaContent="Third content"/>));`);
    execFileSync(path.join(root,'node_modules/.bin/esbuild'),['main.jsx','--bundle','--platform=node','--format=cjs','--jsx=automatic','--outfile=app.cjs'],{cwd:consumer,stdio:'pipe'});
    const html=execFileSync(process.execPath,['app.cjs'],{cwd:consumer,encoding:'utf8'});
    assert.equal([...html.matchAll(/role="tab"/g)].length,4);
    assert.equal([...html.matchAll(/role="tabpanel"/g)].length,4);
    assert.equal([...html.matchAll(/aria-selected="true"/g)].length,1);
    const selectedButton=html.match(/<button[^>]*aria-selected="true"[^>]*>([\s\S]*?)<\/button>/)?.[1];
    assert.equal(selectedButton?.replace(/<[^>]*>/g,''),'beta');
    assert.equal([...html.matchAll(/hidden=""/g)].length,3);
    assert.match(html,/Second content/);
    const declaration=readFileSync(path.join(consumer,'node_modules',library.name,'dist/ViewChoices/ViewChoices.d.ts'),'utf8');
    assert.match(declaration.replaceAll("'",'"'),/onValueChange\?: \(value: "alpha" \| "disabled" \| "beta" \| "gamma"\) => void/);
    assert.match(declaration,/defaultValue\?/);
    assert.ok(!readFileSync(path.join(consumer,'app.cjs'),'utf8').includes(root),'installed bundle cannot depend on the repository path');
  }finally{rmSync(work,{recursive:true,force:true});}
});
