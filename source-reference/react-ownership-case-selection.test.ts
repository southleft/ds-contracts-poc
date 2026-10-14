import test from 'node:test';
import assert from 'node:assert/strict';
import {reactOwnershipSelectedCases,startReactOwnership} from './react-ownership-run.js';
import type {ReactReference} from './react-reference.js';

const reference = {cohort:{cases:[{id:'first'},{id:'second'},{id:'third'}]},
  get sourceRoot():string { throw Error('source-was-read'); }} as unknown as ReactReference;

test('host-only ownership case selection rejects invalid IDs before source observation',()=>{
  for (const selectedCaseIds of [[],['unknown'],['first','first'],['first','unknown'],[null], 'first',
      Array(1),['first',,]]) {
    assert.throws(()=>startReactOwnership(reference,'unused','unused',
      {selectedCaseIds:selectedCaseIds as readonly string[]}),/^Error: react-ownership-case-selection-invalid$/);
  }
});

test('default observes the full cohort; explicit selection is copied without changing it',()=>{
  assert.equal(reactOwnershipSelectedCases(reference),undefined);
  const ids=['second'], selected=reactOwnershipSelectedCases(reference,ids);
  ids.push('first');
  assert.deepEqual([...selected!],['second']);
  assert.deepEqual(reference.cohort.cases.map(c=>c.id),['first','second','third']);
  assert.throws(()=>startReactOwnership(reference,'unused','unused',{selectedCaseIds:['second']}),
    /^Error: react-ownership-source-changed$/);
});
