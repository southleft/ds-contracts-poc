import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {consumerSlotNames,probeConsumerSlot,visibleSlotCases} from './design-consumer-slots.js';
test('named slots do not declare React children and visibility is evaluated for each canonical case',()=>{
 const anatomy={root:{parts:{action:{slot:{name:'action'},visibleWhen:{prop:'show'}},wrapper:{parts:{other:{slot:{name:'action'}}}}},metadata:{slot:{name:'not-an-api'}}}};
 assert.deepEqual(consumerSlotNames(anatomy),['action']);
 const contract={props:[{name:'show',default:true}],anatomy:{root:{visibleWhen:{prop:'show'},parts:{a:{slot:{name:'action'},visibleWhen:{prop:'side',equals:['left']}}}}}};
 assert.deepEqual(visibleSlotCases(contract,[{key:'left',props:{side:'left'}},{key:'right',props:{side:'right'}},{key:'hidden',props:{side:'left',show:false}}],'action'),{keys:['left'],hidden:['right','hidden'],unsupported:[]});
});
test('browser instrument rejects a discarded named prop and retained replacement content',async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage();await page.setContent('<div data-cell="a"></div><div data-cell="b"></div>');
  await page.evaluate("window.__consumer={setVariantOverride:(props)=>document.querySelectorAll('[data-cell]').forEach(n=>n.textContent=typeof props?.action==='string'?props.action:'')}");
  assert.equal((await probeConsumerSlot(page,['a','b'],'action')).passed,true);
  assert.equal((await probeConsumerSlot(page,['a','b'],'children')).passed,false,'unrelated children cannot stand in for action');
  await page.evaluate("window.__consumer.setVariantOverride=(props)=>document.querySelectorAll('[data-cell]').forEach(n=>n.textContent=props?.children??'')");
  assert.equal((await probeConsumerSlot(page,['a','b'],'action')).passed,false,'broken named-slot receiver is rejected');
  await page.evaluate("window.__consumer.setVariantOverride=(props)=>{if(typeof props?.action==='string'&&props.action)document.querySelectorAll('[data-cell]').forEach(n=>n.textContent=props.action)}");
  const stale=await probeConsumerSlot(page,['a','b'],'action');assert.equal(stale.passed,false);assert(stale.cleared.some(r=>!r.cleared));
 }finally{await browser.close();}
});
