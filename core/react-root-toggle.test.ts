import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ContractSchema } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';
import { observeCheckboxBehavior } from '../source-reference/control-behavior.js';

function fixture(state: 'off' | 'on' | 'mixed' | undefined) {
  return ContractSchema.parse({
    id:'probe.root-toggle',name:'RootToggle',version:'1.0.0',status:'draft',
    description:'Declared root toggle behavior conformance.',archetype:'none',
    semantics:{element:'button',role:'checkbox',roleException:'A button-backed checkbox has declared toggle behavior.'},
    props:[
      {name:'state',type:{enum:['off','on','mixed']},default:state,
        bindings:{code:{prop:'value'},figma:{kind:'VARIANT',property:'State',values:{off:'Off',on:'On',mixed:'Mixed'}}}},
      {name:'disabled',type:'boolean',default:false,bindings:{code:{prop:'disabled'},figma:{kind:'BOOLEAN',property:'Disabled'}}},
    ],states:[],anatomy:{root:{text:'Selection'}},
    events:[{name:'change',trigger:'root',toggles:{prop:'state',between:['off','on'],aria:'checked'},bindings:{code:{prop:'onValueChange'}}}],
    bindings:{code:{anchors:{importPath:'./RootToggle',export:'RootToggle'}},figma:{anchors:{fileKey:null,componentSetKey:null}}},
  });
}
const emit = (state: 'off' | 'on' | 'mixed' | undefined, inline: boolean) => {
  const contract=fixture(state),contracts=new Map([[contract.id,contract]]),icons=new Map<string,string>();
  if (inline) return {...emitReactInline(contract,{contracts,icons,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}}),css:''};
  return emitReact(contract,{contracts,icons,tokens:new Set<string>()});
};

test('generated root checkboxes preserve mixed state and label/Space behavior on both React surfaces', async t => {
  const browser=await chromium.launch();t.after(()=>browser.close());
  for(const inline of [false,true]) await t.test(inline?'inline':'css-module',async()=>{
    const page=await browser.newPage();
    try {
      for(const state of ['off','on','mixed'] as const) {
        const output=emit(state,inline);
        assert.deepEqual(generatedTypeErrors('RootToggle',output.tsx),[]);
        for(const disabled of [false,true]) {
          const reset=async()=>{
            const render=await mountGenerated(page,'RootToggle',output.tsx,output.css);
            await render({id:'control',disabled});
            // Consumer-owned association, outside the generated control.
            await page.evaluate(()=>{const label=document.createElement('label');label.htmlFor='control';label.textContent='Receive updates';document.body.appendChild(label);});
          };
          const result=await observeCheckboxBehavior(page,{selector:'#control',checked:state==='mixed'?'mixed':String(state==='on') as 'false'|'true',disabled,label:'Receive updates'},reset);
          assert.equal(result.status,'observed',JSON.stringify({inline,state,disabled,result}));
          assert.equal(result.rows.length,2);
          assert.equal(await page.locator('#control').getAttribute('type'),'button');
        }
      }
    } finally {await page.close();}
  });
});

test('omitting a defaultless state does not claim an off or mixed value', async t=>{
  const browser=await chromium.launch();t.after(()=>browser.close());
  for(const inline of [false,true]) {
    const page=await browser.newPage();
    try {
      const output=emit(undefined,inline);
      assert.deepEqual(generatedTypeErrors('RootToggle',output.tsx),[]);
      await mountGenerated(page,'RootToggle',output.tsx,output.css);
      assert.equal(await page.locator('button').getAttribute('aria-checked'),null);
      await page.locator('button').press('Space');
      assert.equal(await page.locator('button').getAttribute('aria-checked'),'true');
    } finally {await page.close();}
  }
});

test('controlled root toggles report activation without overriding the supplied mixed state', async t=>{
  const browser=await chromium.launch();t.after(()=>browser.close());
  for(const inline of [false,true]) {
    const page=await browser.newPage();
    try {
      const output=emit('off',inline);await mountGenerated(page,'RootToggle',output.tsx,output.css);
      await page.evaluate(`window.calls=0;window.renderSubject({value:'mixed',onValueChange:()=>window.calls++});`);
      await page.locator('button').press('Space');
      assert.equal(await page.locator('button').getAttribute('aria-checked'),'mixed');
      assert.equal(await page.evaluate(()=>(window as unknown as {calls:number}).calls),1);
    } finally {await page.close();}
  }
});
