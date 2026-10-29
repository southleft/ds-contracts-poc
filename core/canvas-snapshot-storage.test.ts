import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { SNAPSHOT_STORAGE_SRC } from './canvas-snapshot-storage.js';
import { FINGERPRINT_SRC } from './canvas-fingerprint.js';

type Api = { read(n: Store, key: string): string[] | null; write(n: Store, key: string, value: string[]): void; bytes(key: string, value: string): number; hash(value: string): string; };
const api: Api = vm.runInNewContext(`${SNAPSHOT_STORAGE_SRC}; ({read:dsReadCanvasSnapshot,write:dsWriteCanvasSnapshot,bytes:dsSnapshotEntryBytes,hash:dsSnapshotSha256})`);
const key = 'canvasSnapshot';
class Store {
  data = new Map<string, string>();
  writes: [string, string][] = [];
  fail?: (key: string, value: string) => boolean;
  getSharedPluginData(namespace: string, key: string) { assert.equal(namespace, 'ds_contracts'); return this.data.get(key) ?? ''; }
  setSharedPluginData(namespace: string, key: string, value: string) {
    assert.equal(namespace, 'ds_contracts');
    assert.ok(Buffer.byteLength(namespace + key + value) < 100000, 'real API entry limit');
    if (this.fail?.(key, value)) throw new Error('injected write failure');
    this.writes.push([key, value]);
    if (value === '') this.data.delete(key); else this.data.set(key, value);
  }
}
const large = (value = 'a') => Array.from({length: 1250}, (_, i) => `${i}|text|${value.repeat(90)}`);
const plain = (n: Store) => Array.from(api.read(n, key) ?? []);
const header = (n: Store) => JSON.parse(n.data.get(key)!);
const chunkKey = (h: {sha256: string}, i = 0) => `${key}_chunks_${h.sha256}_${i}`;

test('small snapshots retain exact legacy bytes and absence stays distinct', () => {
  const n = new Store(); assert.equal(api.read(n, key), null);
  for (const target of [key, 'canvasSetSnapshot']) {
    const lines = ['path|fill|red', '😀中é']; api.write(n, target, lines);
    assert.equal(n.data.get(target), JSON.stringify(lines));
    assert.deepEqual(Array.from(api.read(n, target)!), lines);
  }
  n.data.set(key, JSON.stringify(['x'.repeat(98000)])); // Prior writer had no 96k headroom.
  assert.equal(plain(n)[0].length, 98000);
  assert.throws(() => api.write(n, 'other', []), /unsupported key/);
});

test('large snapshot roundtrips losslessly through content-addressed bounded entries', () => {
  const n = new Store(), lines = large();
  assert.ok(Buffer.byteLength(JSON.stringify(lines)) > 100000);
  assert.throws(() => n.setSharedPluginData('ds_contracts', key, JSON.stringify(lines)), /real API entry limit/);
  api.write(n, key, lines);
  const h = header(n); assert.equal(h.storage, 'ds-snapshot-chunks');
  assert.equal(h.sha256, createHash('sha256').update(JSON.stringify(lines)).digest('hex'));
  assert.deepEqual(plain(n), lines);
  for (const [k, v] of n.data) assert.ok(Buffer.byteLength('ds_contracts' + k + v) <= (k === key ? 96000 : 48 * 1024));
  assert.equal(n.writes.at(-1)![0], key, 'manifest published last');
});

test('Unicode chunks include key overhead and do not split astral pairs', () => {
  const n = new Store(), lines = large('😀中é'); api.write(n, key, lines);
  assert.deepEqual(plain(n), lines);
  for (const [k, v] of n.data) {
    assert.equal(api.bytes(k, v), Buffer.byteLength('ds_contracts' + k + v));
    if (k !== key) {
      assert.ok(api.bytes(k, v) <= 48 * 1024);
      assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(v));
    }
  }
  for (const s of ['abc', '😀中é', '\ud800', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64)])
    assert.equal(api.hash(s), createHash('sha256').update(s).digest('hex'));
});

test('inline to chunks to new chunks to inline cleans only the previous generation', () => {
  const n = new Store(); api.write(n, key, ['small']); api.write(n, key, large('a'));
  const old = header(n); api.write(n, key, large('b'));
  const current = header(n); assert.notEqual(old.sha256, current.sha256);
  assert.ok(!n.data.has(chunkKey(old)) && n.data.has(chunkKey(current)));
  assert.deepEqual(plain(n), large('b'));
  api.write(n, key, ['small-again']); assert.deepEqual(plain(n), ['small-again']);
  assert.deepEqual([...n.data.keys()], [key]);
});

test('missing, corrupt, reordered, oversize and split-Unicode chunks refuse', () => {
  for (const mutate of [
    (n: Store, h: any) => n.data.delete(chunkKey(h)),
    (n: Store, h: any) => n.data.set(chunkKey(h), 'altered'),
    (n: Store, h: any) => { const a=n.data.get(chunkKey(h))!; n.data.set(chunkKey(h),n.data.get(chunkKey(h,1))!);n.data.set(chunkKey(h,1),a); },
    (n: Store, h: any) => n.data.set(chunkKey(h), 'a'.repeat(48 * 1024)),
    (n: Store, h: any) => n.data.set(chunkKey(h), '\udc00x'),
  ]) { const n = new Store(); api.write(n, key, large()); mutate(n, header(n)); assert.throws(() => api.read(n,key), /canvas-snapshot-storage:/); }
});

test('malformed, duplicated, extra or unsupported manifest fields refuse', () => {
  for (const change of [
    (h: any) => ({...h, version: 2}), (h: any) => ({...h, count: 0}),
    (h: any) => ({...h, count: 1025}), (h: any) => ({...h, chars: h.chars-1}),
    (h: any) => ({...h, bytes: h.bytes-1}), (h: any) => ({...h, sha256: '0'.repeat(64)}),
    (h: any) => ({...h, extra: true}), (h: any) => ({...h, chars: 32*1024*1024+1}),
  ]) { const n = new Store();api.write(n,key,large());n.data.set(key,JSON.stringify(change(header(n))));assert.throws(()=>api.read(n,key),/canvas-snapshot-storage:/); }
  for (const value of ['{', '{}', '[1]', 'null']) {const n=new Store();n.data.set(key,value);assert.throws(()=>api.read(n,key),/canvas-snapshot-storage:/);}
  const n=new Store();api.write(n,key,large());n.data.set(key,n.data.get(key)!.replace('"version":1', '"version":1,"version":1'));assert.throws(()=>api.read(n,key),/invalid manifest/);
});

test('chunk or manifest failure before publication preserves the old readable value', () => {
  for (const startLarge of [false,true]) for (const failManifest of [false,true]) {
    const n=new Store(), before=startLarge?large('a'):['old'];api.write(n,key,before);
    const prior=n.data.get(key); let chunkWrites=0;
    n.fail=(k,v)=>failManifest ? k===key : k!==key && v!=='' && ++chunkWrites===2;
    assert.throws(()=>api.write(n,key,large('b')),/injected write failure/);
    assert.equal(n.data.get(key),prior);assert.deepEqual(plain(n),before);
  }
});

test('cleanup failure leaves the new committed snapshot readable', () => {
  const n=new Store();api.write(n,key,large('a'));n.fail=(_k,v)=>v==='';
  assert.throws(()=>api.write(n,key,large('b')),/injected write failure/);
  assert.deepEqual(plain(n),large('b'));
});

test('mutation during read refuses and same-content rewrite is idempotent', () => {
  const n=new Store();api.write(n,key,large()); const h=header(n);api.write(n,key,large());
  assert.equal(header(n).sha256,h.sha256);assert.deepEqual(plain(n),large());
  const get=n.getSharedPluginData.bind(n);let gets=0;
  n.getSharedPluginData=(ns,k)=>k===key && ++gets===2?'[]':get(ns,k);
  assert.throws(()=>api.read(n,key),/manifest changed/);
});

test('all runtime embeddings match and emitted stamping uses storage without changing v6', () => {
  const begin='// >>> BEGIN SNAPSHOT_STORAGE_SRC (generated from core/canvas-snapshot-storage.ts — do not edit)';
  const end='// <<< END SNAPSHOT_STORAGE_SRC';
  for (const path of ['figma-sync/plugin/code.js','parity/extract-figma.plugin.js']) {
    const s=readFileSync(path,'utf8');assert.equal(s.split(begin+'\n')[1].split('\n'+end)[0],SNAPSHOT_STORAGE_SRC.trim());
  }
  const emitter=readFileSync('core/emit-figma-script.ts','utf8');
  assert.match(emitter,/\$\{SNAPSHOT_STORAGE_SRC\}/);
  assert.match(emitter,/dsWriteCanvasSnapshot\(child, 'canvasSnapshot', dsCanvasSnapshot\(child\)\)/);
  assert.match(emitter,/dsWriteCanvasSnapshot\(node, 'canvasSetSnapshot', dsCanvasSetSnapshot\(node\)\)/);
  assert.match(emitter,/rt23-lossless-canvas-snapshot-storage/);
  const n=new Store(); const lines=large();api.write(n,key,lines);
  const hash=(a:string[])=>{let h=5381;for(const c of a.join('\n').split(''))h=(((h<<5)+h)+c.charCodeAt(0))>>>0;return 'v6:'+h;};
  assert.equal(hash(plain(n)),hash(lines));assert.ok(FINGERPRINT_SRC.includes("return 'v6:'"));
});


test('sparse and inherited-only inputs refuse before overwriting prior snapshot', () => {
  const n=new Store();api.write(n,key,['prior']);const before=n.data.get(key);const writes=n.writes.length;
  for(const lines of [new Array(1), Object.assign(new Array(2), {0:'first'})]) {
    assert.throws(()=>api.write(n,key,lines),/invalid snapshot lines/);
    assert.equal(n.data.get(key),before);assert.equal(n.writes.length,writes);assert.deepEqual(plain(n),['prior']);
  }
  const inherited=new Array(1);const proto=Object.create(Array.prototype);proto[0]='inherited';Object.setPrototypeOf(inherited,proto);
  assert.throws(()=>api.write(n,key,inherited),/invalid snapshot lines/);assert.deepEqual(plain(n),['prior']);
});


test('writer snapshots each validated string once and ignores custom array serialization', () => {
  const n=new Store();api.write(n,key,['prior']);
  const custom=['source'];Object.defineProperty(custom,'toJSON',{value:()=>null});
  api.write(n,key,custom);assert.deepEqual(plain(n),['source']);
  let reads=0;const changing=['unused'];Object.defineProperty(changing,'0',{get:()=>++reads===1?'once':null});
  api.write(n,key,changing);assert.equal(reads,1);assert.deepEqual(plain(n),['once']);
  const before=n.data.get(key),writes=n.writes.length;const throwing=['unused'];Object.defineProperty(throwing,'0',{get:()=>{throw Error('getter-failure');}});
  assert.throws(()=>api.write(n,key,throwing),/getter-failure/);assert.equal(n.data.get(key),before);assert.equal(n.writes.length,writes);
});


test('interrupted same-length restamp preserves all prior lines, never a mixed snapshot', () => {
  const n=new Store(), before=['a'.repeat(100000)], next=['b'.repeat(100000)];
  assert.equal(JSON.stringify(before).length, JSON.stringify(next).length);
  api.write(n,key,before);const prior=n.data.get(key);let chunks=0;
  n.fail=(k,v)=>k!==key && v!=='' && ++chunks===2;
  assert.throws(()=>api.write(n,key,next),/injected write failure/);
  assert.equal(n.data.get(key),prior);assert.deepEqual(plain(n),before);
});

const legacyWrite=(n:Store,lines:string[])=>{
  const text=JSON.stringify(lines);let count=0;
  for(let at=0;at<text.length;count++) {let end=Math.min(at+32000,text.length);const unit=text.charCodeAt(end-1);if(end<text.length && unit>=0xd800 && unit<=0xdbff)end--;n.setSharedPluginData('ds_contracts',key+'/'+count,text.slice(at,end));at=end;}
  n.setSharedPluginData('ds_contracts',key,JSON.stringify({dsSnapshotPieces:count,length:text.length}));
};
test('legacy numbered snapshots remain readable and migrate only after successful publication', () => {
  const n=new Store(), before=large('😀中'),next=large('b');legacyWrite(n,before);
  assert.deepEqual(plain(n),before);const old=n.data.get(key);let chunks=0;
  n.fail=(k,v)=>k.includes('_chunks_') && v!=='' && ++chunks===2;
  assert.throws(()=>api.write(n,key,next),/injected write failure/);
  assert.equal(n.data.get(key),old);assert.deepEqual(plain(n),before);
  n.fail=undefined;api.write(n,key,next);assert.equal(header(n).storage,'ds-snapshot-chunks');
  assert.deepEqual(plain(n),next);assert.ok(![...n.data.keys()].some(k=>k.startsWith(key+'/')));
});
test('missing, malformed, oversized and split-Unicode legacy chunks refuse explicitly',()=>{
  for(const change of [
    (n:Store)=>n.data.delete(key+'/1'),
    (n:Store)=>n.data.set(key+'/1','x'),
    (n:Store)=>n.data.set(key+'/0','x'.repeat(32001)),
    (n:Store)=>n.data.set(key+'/0','\udc00x'),
    (n:Store)=>n.data.set(key,'{"dsSnapshotPieces":2,"length":33554433}'),
    (n:Store)=>n.data.set(key,'{"dsSnapshotPieces":2,"length":5,"extra":true}'),
  ]) {const n=new Store();legacyWrite(n,large());change(n);assert.throws(()=>api.read(n,key),/canvas-snapshot-storage:/);}
});


test('legacy migration keeps old data on manifest failure and new data on cleanup failure',()=>{
  const n=new Store(), before=large('a'), next=large('b');legacyWrite(n,before);
  const prior=n.data.get(key);n.fail=(k)=>k===key;
  assert.throws(()=>api.write(n,key,next),/injected write failure/);
  assert.equal(n.data.get(key),prior);assert.deepEqual(plain(n),before);
  n.fail=(k,v)=>k.startsWith(key+'/') && v==='';
  assert.throws(()=>api.write(n,key,next),/injected write failure/);
  assert.equal(header(n).storage,'ds-snapshot-chunks');assert.deepEqual(plain(n),next);
});
