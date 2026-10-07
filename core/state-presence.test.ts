import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {statePresenceCss,statePresenceRows,validateStatePresence,observedStatePresence,type StatePresenceTable} from './state-presence.js';
function fixture(): StatePresenceTable {
 return {props:['supporting','avatar','check'],states:['default','hover','focus-visible','disabled'],rows:
  [false,true].flatMap(supporting=>[false,true].flatMap(avatar=>[false,true].flatMap(check=>
   (['default','hover','focus-visible','disabled'] as const).map(state=>({values:[supporting,avatar,check].map(String),state,
    present:supporting || state==='hover'&&avatar&&check})))))};
}
const domains={supporting:['false','true'],avatar:['false','true'],check:['false','true']};
test('complete observed state/prop truth preserves the one hover exception',()=>{
 const table=fixture();validateStatePresence(table,domains);
 assert.deepEqual([...statePresenceRows(table,{supporting:false,avatar:true,check:true})],
  [['default',false],['hover',true],['focus-visible',false],['disabled',false]]);
 assert([...statePresenceRows(table,{supporting:true,avatar:false,check:false}).values()].every(Boolean));
 assert.throws(()=>statePresenceRows(table,{supporting:false,avatar:'unknown',check:true}),/unavailable/);
});
test('missing, duplicate and unknown observations refuse rather than invent presence',()=>{
 const missing=fixture();missing.rows.pop();assert.throws(()=>validateStatePresence(missing,domains),/incomplete/);
 const duplicate=fixture();duplicate.rows.push({...duplicate.rows[0],present:true});assert.throws(()=>validateStatePresence(duplicate,domains),/duplicate/);
 const unknown=fixture();unknown.rows[0].values[0]='unknown';assert.throws(()=>validateStatePresence(unknown,domains),/row-domain/);
});
test('browser rules retain real hover, explicit previews, disabled precedence and original display',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const rows=statePresenceRows(fixture(),{supporting:false,avatar:true,check:true});
  await page.setContent(`<style>#root{width:200px;height:60px}#part{display:inline-flex!important}${statePresenceCss(rows,'#root','#part')}</style><button id="root"><span id="part">@olivia</span></button>`);
  const display=()=>page.locator('#part').evaluate(n=>getComputedStyle(n).display);
  assert.equal(await display(),'none');await page.locator('#root').hover();assert.equal(await display(),'inline-flex');
  await page.locator('#root').evaluate(n=>n.setAttribute('data-state-preview','focus-visible'));assert.equal(await display(),'none');
  await page.locator('#root').evaluate(n=>n.setAttribute('data-state-preview','hover'));assert.equal(await display(),'inline-flex');
  await page.locator('#root').evaluate(n=>(n as HTMLButtonElement).disabled=true);assert.equal(await display(),'none');
 }finally{await browser.close();}
});
test('browser rules also hide present-at-rest content on hover without leaving layout space',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage();const rows=new Map([['default',true],['hover',false]] as const);
  await page.setContent(`<style>#root{width:200px;height:60px}#part{display:block;height:20px}${statePresenceCss(rows,'#root','#part')}</style><button id="root"><span id="part">Rest label</span></button>`);
  assert.equal(await page.locator('#part').evaluate(n=>n.getBoundingClientRect().height),20);
  await page.locator('#root').hover();assert.equal(await page.locator('#part').evaluate(n=>n.getBoundingClientRect().height),0);
  await page.mouse.move(400,400);assert.equal(await page.locator('#part').evaluate(n=>n.getBoundingClientRect().height),20);
 }finally{await browser.close();}
});
test('observation inference carries every witnessed state and refuses missing source cells',()=>{
 const f=fixture(),observations=f.rows.map(r=>({props:Object.fromEntries(f.props.map((p,i)=>[p,r.values[i]])),state:r.state,present:r.present}));
 assert.deepEqual(observedStatePresence(f.props,f.states,domains,observations),f);
 assert.equal(observedStatePresence(f.props,f.states,domains,observations.map(o=>({...o,present:o.props.supporting==='true'}))),undefined);
 assert.throws(()=>observedStatePresence(f.props,f.states,domains,observations.slice(1)),/incomplete/);
 assert.throws(()=>observedStatePresence(f.props,f.states,domains,[...observations,observations[0]]),/duplicate/);
 const missingProp=observations.map(o=>({...o,props:{...o.props}}));delete missingProp[0].props.check;
 assert.throws(()=>observedStatePresence(f.props,f.states,domains,missingProp),/prop-missing/);
});
import {statePresenceSchema} from './state-presence-schema.js';
test('plan schema rejects coercion, unknown keys and incomplete external prop domains',()=>{
 const schema=statePresenceSchema(domains);assert.deepEqual(schema.parse(fixture()),fixture());
 for(const alter of [
  (t:any)=>{t.rows[0].present='false';},
  (t:any)=>{t.rows[0].extra=true;},
  (t:any)=>{t.states=['hover'];},
  (t:any)=>{t.rows.pop();},
  (t:any)=>{t.rows[0].values[0]=false;},
 ]){const t=fixture();alter(t);assert.equal(schema.safeParse(t).success,false);}
 assert.equal(statePresenceSchema({...domains,check:['false','true','mixed']}).safeParse(fixture()).success,false);
});
