import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { stateApiEvidence, stateApiObservation } from './react-state-api-fixture.js';
import { planReactStateApi } from './react-state-api.js';
import { projectReactStateApiContract } from './react-state-api-contract.js';
import type { ReactStateApiInspection } from './react-state-api-inspection.js';
import { generatedTypeErrors, mountGenerated } from '../core/react-test-runtime.js';

function fixture() {
  const {initial, behavior} = stateApiEvidence();
  for(const row of behavior.observation!.rows) row.callback = 'onNotify';
  for(const rel of behavior.observation!.relationships) rel.callback = 'onNotify';
  for(const candidate of behavior.observation!.candidates) candidate.callback = 'onNotify';
  for(const refusal of behavior.observation!.refusals!) refusal.callback = 'onNotify';
  const appearance = initial.draft!.compiled!.contract!;
  appearance.anatomy.root.parts = {
    marker: { text: 'On', visibleWhen: {prop:'seed'}, literals:{color:'#ff0000'} },
    conditional: { text: 'State', stylesWhen: [{prop:'seed',styles:{opacity:'0.5'}}] },
    disabledMarker: {text:'Locked',visibleWhen:{prop:'gate'}},
  };
  const plan = planReactStateApi(initial,behavior);
  const inspection: ReactStateApiInspection = {id:'bounded', caseId:plan.caseId, phase:'complete', qualification:plan.qualification,
    plan, sourceUnchanged:true, restorationChecks:81, problems:[], observation:stateApiObservation(plan)};
  return {initial, behavior, inspection};
}

test('a distinct sealed state experiment uses the existing enum toggle model and preserves Boolean predicates and public spellings',()=>{
  const value=fixture(),before=structuredClone(value),draft=projectReactStateApiContract(value.initial,value.inspection);
  assert.deepEqual(draft.problems,[]);assert.equal(draft.status,'generated-draft');
  assert.deepEqual(value,before);assert.equal(value.behavior.phase,'failed');
  const prop=draft.contract!.props[0],disabled=draft.contract!.props[1];
  assert.deepEqual(prop.type,{enum:['false','true']});assert.deepEqual(prop.bindings.code.values,{false:false,true:true});
  assert.deepEqual(prop.bindings.code.initial,{prop:'seed',default:'false'});
  assert.equal(prop.bindings.code.prop,'chosen');assert.equal(disabled.name,'disabled');assert.equal(disabled.bindings.code.prop,'locked');
  assert.deepEqual(draft.contract!.anatomy.root.parts!.marker.visibleWhen,{prop:'seed',equals:'true'});
  assert.deepEqual(draft.contract!.anatomy.root.parts!.disabledMarker.visibleWhen,{prop:'disabled'});
  assert.deepEqual(generatedTypeErrors(draft.contract!.name,draft.tsx!),[]);
});

test('corrupt transitions, mismatched evidence and unsupported composition cannot acquire generated behavior',()=>{
  const mutations:Array<(v:ReturnType<typeof fixture>)=>void>=[
    v=>{v.inspection.phase='failed';},v=>{v.inspection.restorationChecks--;},v=>{v.initial.id='other';},
    v=>{v.inspection.observation!.rows[0].steps[1].callback.calls[0]=[false];},
    v=>{v.initial.draft!.compiled!.contract!.anatomy.root.parts!.marker.component={id:'other.child'};},
    v=>{v.initial.draft!.compiled!.contract!.semantics.role='radio';},
    v=>{v.initial.draft!.compiled!.contract!.anatomy.root.attrs={disabled:''};},
    v=>{v.initial.draft!.compiled!.contract!.props[0].name='disabled';},
  ];
  for(const mutate of mutations){const v=fixture();mutate(v);assert.equal(projectReactStateApiContract(v.initial,v.inspection).status,'refused');}
});

test('generated source independently preserves combined-input precedence, initial-only changes, disabled suppression and false predicates',async()=>{
  const v=fixture(),draft=projectReactStateApiContract(v.initial,v.inspection);
  assert.deepEqual(draft.problems,[]);
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();await mountGenerated(page,draft.contract!.name,draft.tsx!);
    await page.locator('body').evaluate(body=>{const label=document.createElement('label');label.htmlFor='control';label.textContent='Preference';body.prepend(label);});
    const render=async(props:Record<string,unknown>,key:string)=>page.evaluate(`window.calls=[];window.renderSubject({...${JSON.stringify(props)},key:${JSON.stringify(key)},id:'control',onNotify:function(value){window.calls.push([value])}})`);
    const subject=page.getByRole('switch');
    for(const item of v.inspection.plan.cases)for(const action of ['space','associated-label']){
      const props=Object.fromEntries(Object.entries(item.changes).filter(([,change])=>change.kind==='set').map(([key,change])=>[key,change.kind==='set'?change.value:undefined]));
      await render(props,item.id+action);
      const expected=v.inspection.observation!.rows.find(r=>r.id===item.id&&r.action===action)!;
      assert.equal(await subject.getAttribute('aria-checked'),expected.initial.checked);
      assert.equal(await subject.isDisabled(),expected.initial.disabled);
      assert.equal(await subject.getByText('On',{exact:true}).count(),expected.initial.checked==='true'?1:0,'false canonical strings are not truthy conditions');
      for(const step of expected.steps){
        if(action==='space'){await subject.focus();await page.keyboard.press('Space');}
        else await page.getByText('Preference',{exact:true}).click({force:expected.initial.disabled});
        assert.equal(await subject.getAttribute('aria-checked'),step.control.checked);
        assert.deepEqual(await page.evaluate(()=>(window as any).calls),step.callback.calls);
        assert.equal(await subject.getByText('On',{exact:true}).count(),step.control.checked==='true'?1:0);
      }
    }
    await render({seed:false},'live');
    await page.evaluate(()=>{(window as any).renderSubject({key:'live',id:'control',seed:true});});
    assert.equal(await subject.getAttribute('aria-checked'),'false','changing only the initial input does not reset existing state');
  }finally{await browser.close();}
});

test('the generated preview consumer independently selects both inputs, remounts, holds and accepts callback values',async()=>{
  const {buildReactStateApiPreview}=await import('./react-state-api-preview.js');
  const {reactReferenceHtml}=await import('./react-reference.js');
  const value=fixture(),draft=projectReactStateApiContract(value.initial,value.inspection);
  await assert.rejects(buildReactStateApiPreview(process.cwd(),{...draft,status:'refused'}),/draft-unavailable/);
  const output=await buildReactStateApiPreview(process.cwd(),draft),browser=await chromium.launch();
  try{
    const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(reactReferenceHtml(output));
    await page.waitForSelector('select',{timeout:2000}).catch(async()=>{throw Error(JSON.stringify({errors,body:await page.locator('body').innerText()}))});
    const control=page.getByRole('switch'),held=page.getByLabel('Controlled value',{exact:true}),initial=page.getByLabel('Initial value',{exact:true}),disabled=page.getByLabel('Disabled value',{exact:true});
    const calls=page.getByLabel('Generated callback values'),remount=page.getByRole('button',{name:'Remount and clear callbacks'});
    for(const item of value.inspection.plan.cases)for(const action of ['space','associated-label']){
      const option=(name:string)=>{const c=item.changes[name];return c.kind==='omit'?'omit':String(c.value)};
      await held.selectOption(option('chosen'));await initial.selectOption(option('seed'));await disabled.selectOption(option('locked'));await remount.click();
      const expected=value.inspection.observation!.rows.find(r=>r.id===item.id&&r.action===action)!;
      assert.equal(await control.getAttribute('aria-checked'),expected.initial.checked);
      for(const step of expected.steps){
        if(action==='space'){await control.focus();await page.keyboard.press('Space');}
        else await page.locator('label[for="generated-state-control"]').click({force:expected.initial.disabled});
        assert.equal(await control.getAttribute('aria-checked'),step.control.checked);
        assert.deepEqual(JSON.parse(await calls.innerText()),step.callback.calls.map(c=>c[0]));
      }
    }
    await held.selectOption('false');await initial.selectOption('true');await disabled.selectOption('false');await remount.click();
    await control.press('Space');assert.equal(await control.getAttribute('aria-checked'),'false');assert.equal(await calls.innerText(),'[true]');
    await page.getByLabel('Accept callback values as controlled input').check();await control.press('Space');
    assert.equal(await control.getAttribute('aria-checked'),'true');assert.equal(await held.inputValue(),'true');
  }finally{await browser.close();}
});
