/** Content-addressed local artifacts. A receipt pins original input and archive
 * bytes; it does not attest that a contract was observed from React or Figma. */
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MAX_BYTES, parseLibraryRequest, type ReactLibraryInput } from './react-library-input.js';

const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const digest = /^[a-f0-9]{64}$/;
const fail = (reason: string): never => { throw Error('react-library-artifact-' + reason); };
interface LibraryReceipt {
  version: 1;
  kind: 'prepared-contract-library';
  inputSha256: string;
  tarballSha256: string;
  filename: string;
  name: string;
}
interface LibraryOutput { bytes: Buffer; tarballSha256: string; filename: string; name: string }
function stat(file: string) {
  try { return lstatSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; return fail('unsafe-path'); }
}
function checkDirectory(dir: string, create: boolean) {
  if (!stat(dir)) {
    if (!create) fail('not-found');
    mkdirSync(dir);
  }
  if (!stat(dir)?.isDirectory() || stat(dir)?.isSymbolicLink()) fail('unsafe-path');
}
function directory(repoRoot: string, create: boolean) {
  let dir = repoRoot;
  for (const part of ['private', 'react-library-artifacts']) {
    dir = path.join(dir, part);
    checkDirectory(dir, create);
  }
  return dir;
}
function read(file: string, limit?: number): Buffer {
  let fd: number;
  // A non-regular member (for example a FIFO) must not block before fstat can
  // reject it. O_NONBLOCK has no effect on the regular files accepted below.
  try { fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch { return fail(stat(file) ? 'unsafe-path' : 'not-found'); }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (limit !== undefined && stat.size > limit)) fail('invalid-file');
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
function receipt(bytes: Buffer): LibraryReceipt {
  let r: LibraryReceipt;
  try { r = JSON.parse(bytes.toString('utf8')); } catch { return fail('invalid-receipt'); }
  if (!r || r.version !== 1 || r.kind !== 'prepared-contract-library' ||
      Object.keys(r).sort().join(',') !== 'filename,inputSha256,kind,name,tarballSha256,version' ||
      !digest.test(r.inputSha256) || !digest.test(r.tarballSha256) ||
      typeof r.filename !== 'string' || !/^[A-Za-z0-9._-]+\.tgz$/.test(r.filename) ||
      typeof r.name !== 'string' || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(r.name))
    fail('invalid-receipt');
  return r;
}
function inputBytes(input: ReactLibraryInput): Buffer {
  return Buffer.from(JSON.stringify({rootId:input.root.id,contracts:input.contracts,tokens:input.tokens,icons:input.icons}));
}
function parseOriginal(original: Buffer) {
  let input: ReactLibraryInput;
  try { input = parseLibraryRequest(JSON.parse(original.toString('utf8'))); }
  catch { return fail('input-invalid'); }
  if (!inputBytes(input).equals(original)) fail('input-schema-changed');
  return input;
}
export function readPreparedReactLibrary(repoRoot: string, id: string) {
  if (!digest.test(id)) fail('not-found');
  const dir = path.join(directory(repoRoot, false), id);
  checkDirectory(dir, false);
  const manifest = read(path.join(dir, 'receipt.json'), 4096);
  if (sha(manifest) !== id) fail('receipt-changed');
  const pinned = receipt(manifest), original = read(path.join(dir, 'input.json'), MAX_BYTES);
  if (sha(original) !== pinned.inputSha256) fail('input-changed');
  const input = parseOriginal(original);
  const bytes = read(path.join(dir, 'library.tgz'));
  if (sha(bytes) !== pinned.tarballSha256) fail('archive-changed');
  return {id,receipt:pinned,input,bytes};
}
/** Publish the receipt last. Interrupted writes retain their bytes; a retry may
 * complete matching missing members but never replaces an existing member. */
export function retainPreparedReactLibrary(repoRoot: string, input: ReactLibraryInput, output: LibraryOutput) {
  const original = inputBytes(input);
  if (original.length > MAX_BYTES) fail('input-too-large');
  parseOriginal(original);
  if (sha(output.bytes) !== output.tarballSha256) fail('archive-changed');
  const manifest = Buffer.from(JSON.stringify({version:1,kind:'prepared-contract-library',
    inputSha256:sha(original),tarballSha256:output.tarballSha256,filename:output.filename,name:output.name} satisfies LibraryReceipt));
  receipt(manifest);
  const id = sha(manifest), dir = path.join(directory(repoRoot, true), id);
  checkDirectory(dir, true);
  // Check ALL existing members before writing any missing one. A mismatched
  // partial artifact is evidence, not a cache entry to repair or overwrite.
  const members: Array<[string,Buffer]> = [['input.json',original],['library.tgz',output.bytes],['receipt.json',manifest]];
  for (const [name,bytes] of members) if (stat(path.join(dir,name)) && !read(path.join(dir,name)).equals(bytes)) fail('existing-member-changed');
  for (const [name,bytes] of members) if (!stat(path.join(dir,name))) writeFileSync(path.join(dir,name),bytes,{flag:'wx'});
  return readPreparedReactLibrary(repoRoot,id);
}
