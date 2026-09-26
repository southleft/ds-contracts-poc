import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { stateApiEvidence, stateApiObservation } from './react-state-api-fixture.js';
import { planReactStateApi } from './react-state-api.js';
import { projectReactStateApiContract } from './react-state-api-contract.js';
import type { ReactStateApiInspection } from './react-state-api-inspection.js';
import { generatedTypeErrors, mountGenerated } from '../core/react-test-runtime.js';

function authoredFixture() {
  const value = fixture(), root = structuredClone(value.initial.draft!.compiled!.contract!);
  const leaf = structuredClone(root), child = structuredClone(root);
  leaf.id = 'fixture.context-leaf'; leaf.name = 'ContextLeaf'; leaf.semantics = {element:'span'};
  leaf.bindings.code.anchors.export = leaf.name;
  leaf.anatomy = {root:{attrs:{'data-testid':'nested'},text:'Nested',literals:{color:'#000000'},
    literalsByProp:[{prop:'seed',map:{true:{color:'#ff0000'},false:{color:'#000000'}}}]}};
  child.id = 'fixture.context-child'; child.name = 'ContextChild'; child.semantics = {element:'span'};
  child.bindings.code.anchors.export = child.name;
  const props = {seed:'{seed}',gate:'{gate}'};
  child.anatomy = {root:{parts:{leaf:{component:{id:leaf.id,props}}}}};
  root.anatomy.root.parts!.context = {component:{id:child.id,props}};
  value.initial.authoredDraft = {version:1,qualification:'observed-authored-composition-sweep-draft',acceptedContract:null,
    status:'native-compiled',nativeQualification:'unqualified',inputRevision:'fixture',contract:root,contracts:[leaf,child,root],
    tokens:{},assets:[],problems:[],limitations:[],nativeVariants:[],
    boundaries:[root,child,leaf].map((c,i)=>({path:i===0?'':i===1?'0':'0.0',contractId:c.id,planes:[]}))};
  value.initial.draft!.status = 'refused';
  return value;
}

test('authored state projection retains a transitive typed graph without flattening or mutating its source',()=>{
  const v=authoredFixture(), before=structuredClone(v);
  assert.deepEqual(planReactStateApi(v.initial,v.behavior),v.inspection.plan);
  const draft=projectReactStateApiContract(v.initial,v.inspection);
  assert.equal(draft.status,'generated-draft',JSON.stringify(draft.problems));assert.deepEqual(v,before);
  assert.equal(draft.dependencies?.length,2);
  assert.deepEqual(generatedTypeErrors(draft.contract!.name,draft.tsx!,
    Object.fromEntries(draft.dependencies!.map(d=>[d.contract.name,d.tsx]))),[]);
  for(const dependency of draft.dependencies!){
    assert.deepEqual(dependency.contract.props[0].bindings.code.values,{false:false,true:true});
    assert.equal(dependency.contract.props[0].bindings.code.initial,undefined);
    assert.equal(dependency.contract.props[0].bindings.code.prop,'seed');
    assert.equal(dependency.contract.events?.length??0,0);
    assert.equal(dependency.contract.props[1].name,'disabled');
  }
});

test('authored state admission refuses incomplete graphs, nonidentity forwarding and child behavior even if a flat draft exists',()=>{
  const mutations:Array<(v:ReturnType<typeof authoredFixture>)=>void>=[
    v=>{v.initial.authoredDraft!.status='refused';},
    v=>{v.initial.authoredProblem='origin-not-authenticated';},
    v=>{v.initial.authoredDraft!.contracts!.pop();},
    v=>{v.initial.authoredDraft!.contracts!.push(v.initial.authoredDraft!.contracts![0]);},
    v=>{v.initial.authoredDraft!.contracts![0].props[0].default=false;},
    v=>{v.initial.authoredDraft!.contracts![1].anatomy.root.parts!.leaf.component!.props!.seed=true;},
    v=>{v.initial.authoredDraft!.contracts![1].anatomy.root.parts!.leaf.component!.id='missing';},
    v=>{v.initial.authoredDraft!.contracts![1].anatomy.root.parts!.leaf.component!.id=v.initial.authoredDraft!.contract!.id;},
    v=>{v.initial.authoredDraft!.boundaries.pop();},
    v=>{delete v.initial.authoredDraft!.contract!.anatomy.root.parts!.context;},
    v=>{v.initial.authoredDraft!.contracts![0].events=[{name:'activate',trigger:'root',bindings:{code:{prop:'onActivate'}}}];},
    v=>{v.initial.authoredDraft!.contracts![0].anatomy.root.slot={name:'unknown'} as any;},
  ];
  for(const mutate of mutations){const v=authoredFixture();v.initial.draft!.status='compiled-draft';mutate(v);
    assert.equal(projectReactStateApiContract(v.initial,v.inspection).status,'refused');}
});

test('the generated authored graph propagates live state to mounted descendants through every controlled and disabled context',async()=>{
  const {buildReactStateApiPreview}=await import('./react-state-api-preview.js');
  const {reactReferenceHtml}=await import('./react-reference.js');
  const v=authoredFixture(), draft=projectReactStateApiContract(v.initial,v.inspection);
  const output=await buildReactStateApiPreview(process.cwd(),draft),browser=await chromium.launch();
  try{
    const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(reactReferenceHtml(output));
    const control=page.getByRole('switch'),nested=page.getByTestId('nested'),calls=page.getByLabel('Generated callback values');
    for(const item of v.inspection.plan.cases)for(const action of ['space','associated-label'] as const){
      const option=(name:string)=>{const c=item.changes[name];return c.kind==='omit'?'omit':String(c.value)};
      await page.getByLabel('Controlled value',{exact:true}).selectOption(option('chosen'));
      await page.getByLabel('Initial value',{exact:true}).selectOption(option('seed'));
      await page.getByLabel('Disabled value',{exact:true}).selectOption(option('locked'));
      await nested.evaluate(el=>{(window as any).beforeRemount=el;});
      await page.getByRole('button',{name:'Remount and clear callbacks'}).click();
      await page.waitForFunction(()=>document.querySelector('[data-testid="nested"]')!==(window as any).beforeRemount);
      const expected=v.inspection.observation!.rows.find(r=>r.id===item.id&&r.action===action)!;
      await nested.evaluate(el=>{(window as any).retainedNested=el;});
      const check=async(state:string)=>{
        assert.equal(await control.getAttribute('aria-checked'),state);
        assert.equal(await nested.evaluate(el=>getComputedStyle(el).color),state==='true'?'rgb(255, 0, 0)':'rgb(0, 0, 0)');
        assert.equal(await nested.evaluate(el=>el===(window as any).retainedNested),true,
          JSON.stringify({case:item.id,action,state,root:await control.evaluate(el=>el.outerHTML),tsx:draft.tsx!.slice(-3200)}));
      };
      await check(expected.initial.checked);
      for(const step of expected.steps){
        if(action==='space'){
          // A disabled control cannot take focus. Do not accidentally send
          // Space to the consumer's still-focused Remount button instead.
          await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
          await control.focus();await page.keyboard.press('Space');
        }
        else await page.locator('label[for="generated-state-control"]').click({force:expected.initial.disabled});
        await check(step.control.checked);assert.deepEqual(JSON.parse(await calls.innerText()),step.callback.calls.map(c=>c[0]));
      }
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

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
