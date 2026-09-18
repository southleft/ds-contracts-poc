/** A native operation outlives the source revision that created it.
 *
 * Creation pins one sealed source observation. When the React source changes,
 * that pin can never be current again, so without this journal the existing
 * native component would be orphaned and the only path would allocate a second
 * one. A succession is the operator's recorded decision that an EXISTING
 * operation now follows a later sealed observation of the same source case.
 *
 * It grants no write authority. It only selects which sealed observation the
 * update planner compiles as `desired`; preflight, guarded apply and independent
 * readback still decide whether anything changes. Creation evidence and the
 * verified correction chain are never rewritten. */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../core/contract-provenance.js';
import { isReactInitialNativeRequest, type ReactInitialNativeRequest } from './react-initial-native-request.js';
import { isReactNativeRequest, type ReactNativeRequest } from './react-native-request.js';

export type NativeSourcePin = ReactNativeRequest | ReactInitialNativeRequest;
type Entry = { version: 1; parentId: string; sequence: number; previous: string; request: NativeSourcePin };
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function fail(message: string): never { throw Error('native-source-succession-' + message); }

export const nativeSourcePinReference = (pin: NativeSourcePin) =>
  pin.kind === 'react-initial-draft' ? pin.anchor.referenceId : pin.referenceId;
/** `compilation` selects a preparer at creation; it is not source identity. */
const identity = (pin: NativeSourcePin) => {
  const { compilation: _compilation, ...rest } = pin as ReactNativeRequest; return rest;
};
/** Same source case and request shape. Only the sealed evidence may differ. */
function assertSuccessor(original: NativeSourcePin, successor: NativeSourcePin) {
  if (isReactInitialNativeRequest(original)) {
    // `instance-N` is positional: a source edit that inserts a sibling moves it
    // onto another element. Until an instance has a stable descriptor, only
    // root-level initial states can follow a later observation.
    if (original.version !== 1) fail('kind-unsupported');
    if (!isReactInitialNativeRequest(successor) || successor.version !== 1 || successor.caseId !== original.caseId ||
        successor.anchor.caseId !== original.anchor.caseId) fail('case-mismatch');
  } else if (isReactNativeRequest(original)) {
    // Nested child roots pin a selection inside their parent's observation.
    if (original.version !== 1) fail('kind-unsupported');
    if (!isReactNativeRequest(successor) || successor.version !== 1 || successor.caseId !== original.caseId) fail('case-mismatch');
  } else fail('kind-unsupported');
}

export function createNativeSourceSuccessions(repo: string) {
  const root = path.join(repo, 'private', 'source-native-successions');
  const directory = (parentId: string, create = false) => {
    if (!UUID.test(parentId)) fail('parent-invalid');
    const target = path.join(root, parentId);
    for (const dir of [path.dirname(root), root, target]) {
      if (!existsSync(dir)) { if (!create) return undefined; mkdirSync(dir, { mode: 0o700 }); }
      const stat = lstatSync(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) fail('directory-invalid');
    }
    return target;
  };
  const seed = (parentId: string, original: NativeSourcePin) => sha('native-source-succession:' + parentId + ':' + canonicalJson(identity(original)));
  const load = (parentId: string, original: NativeSourcePin) => {
    const dir = directory(parentId), entries: Entry[] = [];
    let previous = seed(parentId, original), tip: NativeSourcePin = original;
    for (const [sequence, file] of (dir ? readdirSync(dir).sort() : []).entries()) {
      if (file !== `${String(sequence).padStart(8, '0')}.json`) fail('journal-sequence-invalid');
      const target = path.join(dir!, file), stat = lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) fail('record-invalid');
      const bytes = readFileSync(target, 'utf8'), entry = JSON.parse(bytes) as Entry;
      if (entry.version !== 1 || entry.parentId !== parentId || entry.sequence !== sequence || entry.previous !== previous ||
          Object.keys(entry).sort().join(',') !== 'parentId,previous,request,sequence,version') fail('journal-chain-invalid');
      assertSuccessor(original, entry.request);
      if (same(identity(entry.request), identity(tip))) fail('journal-chain-invalid');
      previous = sha(bytes); tip = entry.request; entries.push(entry);
    }
    return { dir, entries, previous, tip };
  };
  return {
    /** The sealed observation this operation currently follows. */
    effective(parentId: string, original: NativeSourcePin): NativeSourcePin { return structuredClone(load(parentId, original).tip); },
    history(parentId: string, original: NativeSourcePin) {
      return [original, ...load(parentId, original).entries.map(e => e.request)].map(pin => nativeSourcePinReference(pin));
    },
    /** Callers must first prove `successor` is readable from the live source. */
    adopt(parentId: string, original: NativeSourcePin, successor: NativeSourcePin) {
      assertSuccessor(original, successor);
      const loaded = load(parentId, original);
      if (same(identity(successor), identity(loaded.tip))) return { adopted: false, sequence: loaded.entries.length };
      const dir = directory(parentId, true)!;
      const entry: Entry = { version: 1, parentId, sequence: loaded.entries.length, previous: loaded.previous, request: structuredClone(successor) };
      // Exclusive create: a concurrent adoption loses instead of forking the chain.
      const fd = openSync(path.join(dir, `${String(entry.sequence).padStart(8, '0')}.json`), 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(entry)); fsyncSync(fd); } finally { closeSync(fd); }
      const parent = openSync(dir, 'r'); try { fsyncSync(parent); } finally { closeSync(parent); }
      if (!same(load(parentId, original).tip, successor)) fail('record-changed');
      return { adopted: true, sequence: entry.sequence };
    },
  };
}
