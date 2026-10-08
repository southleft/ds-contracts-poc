import test from 'node:test';
import assert from 'node:assert/strict';
import {finitePaintArguments, type FinitePaintAxis, type FinitePaintTable} from './finite-paint-arguments.js';

const axes = (n: number): FinitePaintAxis[] => Array.from({length: n}, (_, i) => ({prop: 'p' + i, values: ['false', 'true']}));
const cartesian = (n: number): string[][] => Array.from({length: 2 ** n}, (_, tuple) => Array.from({length: n}, (_, i) => tuple & 2 ** i ? 'true' : 'false'));
const tableOf = (domain: FinitePaintAxis[], tuples: (string | null)[][], value: (tuple: (string | null)[], i: number) => string | null): FinitePaintTable => ({props: domain.map(a => a.prop), rows: tuples.map((values, i) => ({values, value: value(values, i)}))});
function assertExact(table: FinitePaintTable, original: FinitePaintTable) {
  for (const row of original.rows) {
    const projected = table.props.map(prop => row.values[original.props.indexOf(prop)]);
    const found = table.rows.find(r => JSON.stringify(r.values) === JSON.stringify(projected));
    assert(found, JSON.stringify(projected));
    assert.equal(found.value, row.value, JSON.stringify(row.values));
  }
  assert.equal(table.rows.length, new Set(original.rows.map(row => JSON.stringify(table.props.map(prop => row.values[original.props.indexOf(prop)])))).size);
}

test('sparse one-hot count/layout paint keeps every source value and omission under the full drawn guard', () => {
  const domain = axes(10);
  const tuples = ['false','true'].flatMap(layout => Array.from({length: 9}, (_, count) => [layout, ...Array.from({length: 9}, (_, i) => count === i ? 'true' : 'false')]));
  for (let child = 2; child <= 10; child++) {
    const original = tableOf(domain, tuples, tuple => tuple[0] === 'true' && tuple.findIndex((value, i) => i > 0 && value === 'true') + 1 >= child ? 'rgba(0,0,0,0.85)' : null);
    const compact = finitePaintArguments(domain, tuples, original, true);
    assert(compact.props.length <= 5, 'the exact count dependencies should fit without retaining all ten axes');
    assertExact(compact, original);
    assert.throws(() => finitePaintArguments(domain, tuples, original), /unclosed-source-domain/);
    assert.deepEqual(finitePaintArguments(domain, tuples, {props: original.props, rows: [...original.rows].reverse()}, true), compact);
  }
});

test('an unrelated complete nine-axis table retains its two paint dependencies including null', () => {
  const domain = axes(9), tuples = cartesian(9), original = tableOf(domain, tuples, tuple => tuple[2] === 'false' ? null : tuple[7] === 'true' ? '#aabbcc' : '#112233');
  assert.throws(() => finitePaintArguments(domain, tuples, original), /unclosed-source-domain/);
  const compact = finitePaintArguments(domain, tuples, original, true);
  assert.deepEqual(compact.props, ['p2','p7']);
  assert.equal(compact.rows.length, 4);
  assertExact(compact, original);
});

test('source null, the false spelling, and a paint omission remain distinct', () => {
  const domain = axes(9); domain[4].values = [null,'false','true'];
  const tuples = [null,'false','true'].map(value => domain.map((_, i) => i === 4 ? value : 'false'));
  const original = tableOf(domain, tuples, tuple => tuple[4] === null ? null : tuple[4] === 'false' ? '#000000' : '#ffffff');
  const compact = finitePaintArguments(domain, tuples, original, true);
  assert.deepEqual(compact, {props: ['p4'], rows: [{values:[null],value:null},{values:['false'],value:'#000000'},{values:['true'],value:'#ffffff'}]});
  assertExact(compact, original);
});

test('sparse holes cannot masquerade as explicit source null or inherited array cells', () => {
  const domain = axes(9); domain[4].values = [null,'false','true'];
  const tuples = [null,'false'].map(value => domain.map((_, i) => i === 4 ? value : 'false'));
  const original = tableOf(domain, tuples, tuple => tuple[4] === null ? null : '#112233');
  assert.deepEqual(finitePaintArguments(domain,tuples,original,true), {props:['p4'],rows:[{values:[null],value:null},{values:['false'],value:'#112233'}]});
  const mutations: Array<[string,(d:FinitePaintAxis[],t:(string|null)[][],b:FinitePaintTable)=>void]> = [
    ['row-values',(_,__,b)=>{delete b.rows[0].values[4];}],
    ['inherited-null-cell',(_,__,b)=>{delete b.rows[0].values[4];const proto=Object.create(Array.prototype);proto[4]=null;Object.setPrototypeOf(b.rows[0].values,proto);}],
    ['source-tuple-cell',(_,t)=>{delete t[0][4];}],
    ['axes',(d)=>{delete d[4];}],
    ['axis-values',(d)=>{delete (d[4].values as (string|null)[])[0];}],
    ['source-tuples',(_,t)=>{delete t[0];}],
    ['table-props',(_,__,b)=>{delete b.props[4];}],
    ['table-rows',(_,__,b)=>{delete b.rows[0];}],
  ];
  for(const [name,mutate] of mutations){
    const d=structuredClone(domain),t=structuredClone(tuples),b=structuredClone(original);mutate(d,t,b);
    // This previously retained exactly the same JSON identity as real null.
    if(name==='source-tuple-cell')assert.equal(JSON.stringify(t[0]),JSON.stringify(tuples[0]));
    if(name==='row-values'||name==='inherited-null-cell')assert.equal(JSON.stringify(b.rows[0].values),JSON.stringify(original.rows[0].values));
    assert.throws(()=>finitePaintArguments(d,t,b,true),/finite-paint-arguments-source-unqualified:/,name);
  }
});

test('already qualified eight-axis tables retain their original rows and identity', () => {
  const domain = axes(8), tuples = cartesian(8), original = tableOf(domain, tuples, () => null);
  assert.equal(finitePaintArguments(domain, tuples, original), original);
});

test('a constant overflow table still uses one finite axis and preserves only its exact projection', () => {
  const domain = axes(10), tuples = [domain.map(() => 'false'), domain.map(() => 'true')];
  const original = tableOf(domain, tuples, () => null), compact = finitePaintArguments(domain, tuples, original, true);
  assert.deepEqual(compact, {props:['p0'],rows:[{values:['false'],value:null},{values:['true'],value:null}]});
  assertExact(compact, original);
});

test('nine genuinely essential paint axes retain the named receiver refusal', () => {
  const domain = axes(9), tuples = cartesian(9), original = tableOf(domain, tuples, tuple => tuple.filter(v => v === 'true').length % 2 ? '#000000' : null);
  assert.throws(() => finitePaintArguments(domain, tuples, original, true), /^Error: finite-paint-arguments-dependency-ceiling-exceeded$/);
});

test('missing, duplicated and unknown original observations cannot become valid through projection', () => {
  const domain = axes(9), tuples = [domain.map(() => 'false'), domain.map(() => 'true')], original = tableOf(domain, tuples, () => '#112233');
  const missing = structuredClone(original); missing.rows.pop();
  assert.throws(() => finitePaintArguments(domain, tuples, missing, true), /source-coverage/);
  const duplicate = structuredClone(original); duplicate.rows[1] = structuredClone(duplicate.rows[0]);
  assert.throws(() => finitePaintArguments(domain, tuples, duplicate, true), /observation-collision/);
  const unknown = structuredClone(original); unknown.rows[1].values[0] = 'false';
  assert.throws(() => finitePaintArguments(domain, tuples, unknown, true), /unknown-source-tuple/);
  assert.throws(() => finitePaintArguments(domain, [tuples[0],tuples[0]], original, true), /source-tuple-collision/);
  const colliding = structuredClone(original); colliding.rows[1] = {...structuredClone(colliding.rows[0]),value:null};
  assert.throws(() => finitePaintArguments(domain, tuples, colliding, true), /observation-collision/);
});

test('unsupported or ambiguous source identities and values refuse before any dependency search', () => {
  const domain = axes(9), tuples = [domain.map(() => 'false'), domain.map(() => 'true')], original = tableOf(domain, tuples, () => '#112233');
  for (const mutate of [
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {d[1].prop = d[0].prop;},
    (d: FinitePaintAxis[]) => {d[0].values = ['false','false'];},
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {b.props.reverse();},
    (d: FinitePaintAxis[], t: (string|null)[][]) => {t[0][0] = 'unknown';},
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {b.rows[0].values.pop();},
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {b.rows[0].value = '';},
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {(b.rows[0] as any).value = undefined;},
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {(b.rows[0] as any).value = {color:'#112233'};},
    (d: FinitePaintAxis[], t: (string|null)[][], b: FinitePaintTable) => {(b.rows[0].values as any)[0] = false;},
  ]) {
    const d = structuredClone(domain), t = structuredClone(tuples), b = structuredClone(original); mutate(d,t,b);
    assert.throws(() => finitePaintArguments(d,t,b,true), /finite-paint-arguments-source-unqualified:/);
  }
  assert.throws(() => finitePaintArguments(domain,tuples,original,'yes' as any), /domain-guard/);
  assert.throws(() => finitePaintArguments(null as any,tuples,original,true), /source-unqualified:axes/);
  assert.throws(() => finitePaintArguments(domain,null as any,original,true), /source-unqualified:source-tuples/);
  assert.throws(() => finitePaintArguments(domain,tuples,null as any,true), /source-unqualified:axis-identity/);
});
