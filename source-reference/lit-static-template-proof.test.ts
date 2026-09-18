import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readLitTemplateBindings} from '../extract/adapters/lit-template.js';
import {proveLitStaticTemplates} from './lit-static-template-proof.js';
const source=JSON.parse(readFileSync(new URL('../extract/fixtures/lit-template/altitude-checkbox.json',import.meta.url),'utf8'));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/lit-render-observation/altitude-checkbox.json',import.meta.url),'utf8'));

test('four actual Checkbox render results corroborate exact source strings and registered field-note tags',()=>{
 assert.equal(source.sourceSha256,fixture.sourceSha256);
 for(const row of fixture.rows){
  assert.equal(createHash('sha256').update(JSON.stringify(row.observation)).digest('hex'),row.observationSha256);
  const before=JSON.stringify(row),proof=proveLitStaticTemplates(source,row.observation);
  assert.equal(proof.substitutions.size,4,'open and close expressions in both field-note templates');
  assert.ok([...proof.substitutions.values()].every(v=>v==='al-field-note'));
  for(const start of proof.substitutions.keys())assert.equal(source.source.slice(start,start+16),'this.fieldNoteEl');
  assert.equal(proof.templateGroups.length,3,'returned root, field note, empty error branch');
  const read=readLitTemplateBindings(source,proof.substitutions);
  assert.equal(read.templates.length,5);
  assert.ok(read.templates.every(t=>t.complete));
  assert.ok(read.problems.some(p=>p.code==='static-html-values-unverified'),'syntax view alone never claims runtime admission');
  assert.equal(JSON.stringify(row),before);
 }
});

test('changed source, parser input, static tags, arity and observation status remain refusals',()=>{
 for(const mutate of [
  (r:any)=>{r.policy.sourceSha256='0'.repeat(64);},
  (r:any)=>{r.policy.className='Other';},
  (r:any)=>{r.renders=0;},
  (r:any)=>{r.status='refused';},
  (r:any)=>{r.problems.push('changed');},
  (r:any)=>{r.last.staticFields[0].value='unrelated-note';},
  (r:any)=>{r.last.staticFields[0].value='al-field-note onclick=bad';},
  (r:any)=>{r.last.staticFields=[];},
  (r:any)=>{r.last.staticFields.push(r.last.staticFields[0]);},
  (r:any)=>{r.last.value.strings[0]+='<unexpected>';},
  (r:any)=>{r.last.value.values.pop();},
  (r:any)=>{r.last.value.values[11].strings[0]=r.last.value.values[11].strings[0].replace('al-field-note','other-note');},
  (r:any)=>{r.last.value.values[0]={kind:'template',strings:['<injected-element></injected-element>'],values:[]};},
 ]){
  const record=structuredClone(fixture.rows[0].observation);mutate(record);
  assert.throws(()=>proveLitStaticTemplates(source,record),/static-template-/);
 }
});
