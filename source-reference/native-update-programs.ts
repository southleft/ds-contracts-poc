/** Large update programs remain separate bounded immutable records. Historical
 * inline headers keep their exact representation and journal-chain hashes. */
import { createHash } from 'node:crypto';

const LIMIT = 4 * 1024 * 1024;
const PHASES = ['update-preflight-readback', 'update-apply', 'update-readback'] as const;
type Programs = Record<typeof PHASES[number], { script: string; sha256: string }>;
type Header = { version: 1; scripts: Programs };
type Packed<T> = Omit<T, 'version' | 'scripts'> & { version: 2; scripts: Record<typeof PHASES[number], { sha256: string }> };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const size = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const file = (hash: string) => 'program-' + hash + '.json';
const fail = (): never => { throw Error('native-update-program-record-invalid'); };
function validPrograms(programs: Programs) {
  if (!programs || Object.keys(programs).sort().join('|') !== [...PHASES].sort().join('|')) fail();
  for (const p of PHASES) if (typeof programs[p]?.script !== 'string' || sha(programs[p].script) !== programs[p].sha256) fail();
}

/** Caller supplies its existing exclusive, fsynced, 4 MiB record writer. No
 * path from a proposal or result is used to select a program file. */
export function storeNativeUpdatePrograms<T extends Header>(header: T, write: (name: string, value: unknown) => void): T | Packed<T> {
  validPrograms(header.scripts);
  if (size(header) <= LIMIT) return header;
  const programs = new Map(PHASES.map(p => [header.scripts[p].sha256, { script: header.scripts[p].script }]));
  const packed = { ...header, version: 2 as const,
    scripts: Object.fromEntries(PHASES.map(p => [p, { sha256: header.scripts[p].sha256 }])) } as Packed<T>;
  // Refuse an oversized individual program before writing any record.
  if (size(packed) > LIMIT || [...programs.values()].some(p => size(p) > LIMIT)) throw Error('native-update-record-too-large');
  for (const [hash, program] of programs) write(file(hash), program);
  return packed;
}

/** Decode only; the journal still authenticates operation identity, proposal
 * revision and regenerated programs before permitting any write delivery. */
export function loadNativeUpdatePrograms<T extends Header>(stored: T | Packed<T>, read: (name: string) => unknown): T {
  if (!stored || ![1, 2].includes(stored.version)) fail();
  if (stored.version === 1) return stored as T;
  if (!stored.scripts || Object.keys(stored.scripts).sort().join('|') !== [...PHASES].sort().join('|')) fail();
  const programs = new Map<string, { script: string; sha256: string }>();
  for (const p of PHASES) {
    const ref = stored.scripts[p];
    if (!ref || Object.keys(ref).length !== 1 || !/^[a-f0-9]{64}$/.test(ref.sha256)) fail();
    if (programs.has(ref.sha256)) continue;
    const value = read(file(ref.sha256)) as { script: string };
    if (!value || Object.keys(value).length !== 1 || typeof value.script !== 'string' ||
        size(value) > LIMIT || sha(value.script) !== ref.sha256) fail();
    programs.set(ref.sha256, { script: value.script, sha256: ref.sha256 });
  }
  return { ...stored, version: 1, scripts: Object.fromEntries(PHASES.map(p => [p, programs.get(stored.scripts[p].sha256)])) } as T;
}
