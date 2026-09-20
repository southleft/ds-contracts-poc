/** Historical source identity is read from the journal-pinned ownership
 * archive, without requiring those old source bytes to remain live. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../core/contract-provenance.js';
import { evidenceSha, evidenceUnchanged } from './react-validation-evidence.js';
import { isNativeSourcePin, nativeSourcePinAnchor, nativeSourcePinCase, type NativeSourcePin } from './native-source-succession.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactReference } from './react-reference.js';

const fail = (): never => { throw Error('react-source-succession-identity-unavailable'); };
export function readNativeSourceIdentity(repo: string, pin: NativeSourcePin) {
  if (!isNativeSourcePin(pin) || pin.version !== 1) fail();
  const request = nativeSourcePinAnchor(pin);
  const dir = path.join(repo, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  try {
    const sealBytes = readFileSync(path.join(dir, 'integrity.json'));
    if (evidenceSha(sealBytes) !== request.inventorySha256) fail();
    const seal = JSON.parse(sealBytes.toString());
    if (seal.version !== 1 || !seal.files || typeof seal.files !== 'object' || Array.isArray(seal.files)) fail();
    const files = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': request.inventorySha256 })
      .sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>;
    if (!evidenceUnchanged(dir, files)) fail();
    const reportBytes = readFileSync(path.join(dir, 'report.json'));
    if (evidenceSha(reportBytes) !== request.ownership.sha256) fail();
    const report = JSON.parse(reportBytes.toString()) as ReactOwnershipReport;
    const rows = report.rows.filter(row => row.id === nativeSourcePinCase(pin)), row = rows[0];
    if (report.id !== request.ownership.id || report.referenceId !== request.referenceId ||
        report.state !== 'complete' || !report.sourceUnchanged || report.problem || rows.length !== 1 ||
        !row.matched || row.problems.length || !row.ownership || row.ownership.problems.length) fail();
    const roots = row.ownership!.components.filter(component => component.roots.includes(''));
    if (roots.length !== 1 || roots[0].roots.length !== 1) fail();
    const source = roots[0].source;
    const programBytes = readFileSync(path.join(dir, 'program.json'));
    if (evidenceSha(programBytes) !== seal.files['program.json']) fail();
    const program = JSON.parse(programBytes.toString()) as ReactSourceProgram;
    const definitions = program.components.filter(component => component.module === source.module &&
      component.exportName === source.exportName && component.sourceSha256 === source.sourceSha256 &&
      canonicalJson(component.span) === canonicalJson(source.span));
    if (program.version !== 1 || program.problems.length || definitions.length !== 1 ||
        !source.module || path.isAbsolute(source.module) || source.module.split(/[\\/]/).includes('..')) fail();
    // The source reader stores real absolute filenames. A suffix alone is not
    // enough: require the same pinned bytes, and refuse ambiguous candidates.
    const candidates = Object.entries(program.files).filter(([file, hash]) => path.isAbsolute(file) &&
      file.endsWith(path.sep + source.module) && hash === source.sourceSha256);
    if (candidates.length !== 1) fail();
    return { file: candidates[0][0], exportName: source.exportName };
  } catch { return fail(); }
}

export function nativeSourceBelongsToReference(repo: string, pin: NativeSourcePin, reference: Pick<ReactReference, 'files'>) {
  return Object.hasOwn(reference.files, readNativeSourceIdentity(repo, pin).file);
}

export function assertNativeSourceIdentity(repo: string, original: NativeSourcePin, successor: NativeSourcePin) {
  if (canonicalJson(readNativeSourceIdentity(repo, original)) !== canonicalJson(readNativeSourceIdentity(repo, successor)))
    throw Error('react-source-succession-component-mismatch');
}
