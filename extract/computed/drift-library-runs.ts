/** Whole-library scheduling only: every child retains its own regate inputs and output root. */
import {spawn} from 'node:child_process';
import {lstatSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

export interface DriftLibraryJob {
  name: string;
  command: string;
  args: readonly string[];
  cwd: string;
  outputRoot: string;
}

export interface DriftLibraryResult {
  name: string;
  outputRoot: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  error: string | null;
  stderr: string;
  stderrOverflow: boolean;
  elapsedMs: number;
}

export const DRIFT_STDERR_LIMIT_BYTES = 64 * 1024 * 1024;

/** Only exit 1 is regate's documented per-component refusal status. */
export function isDriftProcessFailure(
  result: Pick<DriftLibraryResult, 'status' | 'signal' | 'error' | 'stderrOverflow'>,
  hasNamedRefusal: boolean,
): boolean {
  return result.error !== null || result.signal !== null || result.stderrOverflow ||
    (result.status !== 0 && !(result.status === 1 && hasNamedRefusal));
}

export function parseDriftWorkers(argv: readonly string[], mode: {remeasure: boolean; write: boolean}): 1 | 2 {
  let value: string | undefined;
  let supplied = false;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument !== '--workers' && !argument.startsWith('--workers=')) continue;
    if (supplied) throw Error('--workers may be supplied only once');
    supplied = true;
    value = argument === '--workers' ? argv[++index] : argument.slice('--workers='.length);
  }
  if (!supplied) return 1;
  if (!mode.remeasure || mode.write) throw Error('--workers is supported only with --remeasure, without --write');
  if (value !== '1' && value !== '2') throw Error('--workers must be exactly 1 or 2');
  return value === '1' ? 1 : 2;
}

/** Resolve existing ancestors too, so a symlink cannot hide overlapping output roots. */
function canonicalPath(input: string): string {
  const absolute = path.resolve(input);
  const suffix: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      lstatSync(current);
      return path.join(realpathSync(current), ...suffix);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // A dangling symlink is not an absent output directory.
      try {
        if (lstatSync(current).isSymbolicLink()) throw Error(`unresolved drift output symlink: ${current}`);
      } catch (missing) {
        if ((missing as NodeJS.ErrnoException).code !== 'ENOENT') throw missing;
      }
      const parent = path.dirname(current);
      if (parent === current) throw Error(`cannot resolve drift output root: ${absolute}`);
      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
}

const folded = (file: string) => file.normalize('NFC').toLowerCase();
const contains = (parent: string, child: string) => child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);

function validateRoots(jobs: readonly DriftLibraryJob[], scratch?: string): void {
  const scratchRoot = scratch === undefined ? undefined : folded(canonicalPath(scratch));
  const roots = jobs.map(job => ({name: job.name, root: folded(canonicalPath(job.outputRoot))}));
  for (let index = 0; index < roots.length; index++) {
    const current = roots[index];
    if (scratchRoot !== undefined && (current.root === scratchRoot || !contains(scratchRoot,current.root)))
      throw Error(`drift output root must be strictly inside scratch: ${current.name}`);
    for (let earlier = 0; earlier < index; earlier++) {
      const other = roots[earlier];
      if (contains(current.root,other.root) || contains(other.root,current.root))
        throw Error(`overlapping drift output roots: ${other.name} and ${current.name}`);
    }
  }
}

/** Must run before the parent resets scratch; no files are created or removed here. */
export function validateDriftOutputRoots(scratch: string, jobs: readonly DriftLibraryJob[]): void {
  try {
    if (lstatSync(path.resolve(scratch)).isSymbolicLink()) throw Error('drift scratch must not be a symlink');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  validateRoots(jobs,scratch);
}

async function runLibrary(job: DriftLibraryJob): Promise<DriftLibraryResult> {
  const started = performance.now();
  const result: DriftLibraryResult = {name: job.name,outputRoot: job.outputRoot,status: null,signal: null,
    error: null,stderr: '',stderrOverflow: false,elapsedMs: 0};
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const finish = () => {
      result.stderr = Buffer.concat(chunks,bytes).toString('utf8');
      result.elapsedMs = performance.now() - started;
      resolve(result);
    };
    try {
      const child = spawn(job.command,[...job.args],{cwd: job.cwd,stdio: ['ignore','ignore','pipe']});
      child.once('error',error => { result.error = `${error.name}: ${error.message}`; });
      child.stderr!.on('data',(chunk: Buffer) => {
        const remaining = DRIFT_STDERR_LIMIT_BYTES - bytes;
        if (remaining > 0) {
          const kept = chunk.subarray(0,remaining);
          chunks.push(kept);
          bytes += kept.length;
        }
        if (chunk.length > remaining && !result.stderrOverflow) {
          result.stderrOverflow = true;
          result.error = `regate stderr exceeded ${DRIFT_STDERR_LIMIT_BYTES} bytes`;
          child.kill('SIGTERM');
        }
      });
      child.stderr!.once('error',error => {
        result.error = `${error.name}: ${error.message}`;
        child.kill('SIGTERM');
      });
      child.once('close',(status,signal) => {
        result.status = status;
        result.signal = signal;
        finish();
      });
    } catch (error) {
      result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      finish();
    }
  });
}

/** Results retain input order even when children finish out of order; failures never skip a job. */
export async function runDriftLibraryJobs(
  jobs: readonly DriftLibraryJob[],
  workers: 1 | 2,
  onComplete?: (result: Readonly<DriftLibraryResult>, index: number) => void,
): Promise<DriftLibraryResult[]> {
  if (workers !== 1 && workers !== 2) throw Error('drift workers must be 1 or 2');
  validateRoots(jobs);
  const results = new Array<DriftLibraryResult>(jobs.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= jobs.length) return;
      results[index] = await runLibrary(jobs[index]);
      // Progress is diagnostic only: it cannot mutate a result or skip another job.
      try { onComplete?.({...results[index]},index); } catch { /* Keep all measurements and their outcomes. */ }
    }
  };
  await Promise.all(Array.from({length: Math.min(workers,jobs.length)},worker));
  return results;
}
