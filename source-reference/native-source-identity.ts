/** Historical source identity is read from the journal-pinned ownership
 * archive, without requiring those old source bytes to remain live. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { evidenceSha, evidenceUnchanged } from './react-validation-evidence.js';
import { isNativeSourcePin, nativeSourcePinAnchor, nativeSourcePinCase, type NativeSourcePin } from './native-source-succession.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactReference } from './react-reference.js';
import { readReactAuthoredStateApiInitial } from './react-state-api-inspection.js';

const fail = (): never => { throw Error('react-source-succession-identity-unavailable'); };
export function readNativeSourceIdentity(repo: string, pin: NativeSourcePin) {
  if (!isNativeSourcePin(pin) || (pin.kind !== 'react-authored-draft' && pin.version !== 1)) fail();
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
    const programBytes = readFileSync(path.join(dir, 'program.json'));
    if (evidenceSha(programBytes) !== seal.files['program.json']) fail();
    const program = JSON.parse(programBytes.toString()) as ReactSourceProgram;
    const definition = (source: NonNullable<typeof row.ownership>['components'][number]['source']) => {
      const definitions = program.components.filter(component => component.module === source.module &&
        component.exportName === source.exportName && component.sourceSha256 === source.sourceSha256 &&
        canonicalJson(component.span) === canonicalJson(source.span));
      if (program.version !== 1 || program.problems.length || definitions.length !== 1 ||
          !source.module || path.isAbsolute(source.module) || source.module.split(/[\\/]/).includes('..')) fail();
      // Historical source need not remain on disk. Both its absolute filename
      // and recorded bytes must match one definition in the sealed program.
      const candidates = Object.entries(program.files).filter(([file, hash]) => path.isAbsolute(file) &&
        file.endsWith(path.sep + source.module) && hash === source.sourceSha256);
      if (candidates.length !== 1) fail();
      return { file: candidates[0][0], exportName: source.exportName };
    };
    if (pin.kind === 'react-authored-draft') {
      const initial = readReactAuthoredStateApiInitial(repo, pin), appearance = initial.authoredDraft!;
      const selected = row.ownership!.components.filter(c => c.id === pin.initial.instanceId);
      const helpers = row.authoredTrees?.filter(t => t.helper === pin.helper), authored = helpers?.[0]?.draft;
      if (helpers?.length !== 1 || !authored || revisionOf(authored) !== pin.initial.anchorDraftRevision || authored.fact?.instanceId !== pin.initial.instanceId ||
          selected.length !== 1 || canonicalJson(selected[0].source) !== canonicalJson(initial.observation!.source) ||
          selected[0].roots.length !== 1 || selected[0].roots[0] !== '') fail();
      const root = definition(selected[0].source);
      const boundaries = [...appearance.boundaries].sort((a, b) => a.path.localeCompare(b.path));
      if (!boundaries.length || boundaries[0].path !== '' || boundaries.some(b => b.path !== '' && !/^\d+(?:\.\d+)*$/.test(b.path)) ||
          new Set(boundaries.map(b => b.path)).size !== boundaries.length ||
          new Set(boundaries.map(b => b.contractId)).size !== boundaries.length ||
          boundaries[0].contractId !== appearance.contract?.id ||
          canonicalJson(boundaries.map(b => b.contractId).sort()) !== canonicalJson(appearance.contracts?.map(c => c.id).sort())) fail();
      const keys = boundaries[0].planes.map(p => p.key).sort();
      if (!keys.length || new Set(keys).size !== keys.length || boundaries.some(b =>
        b.planes.some(p => !p.instances.length) || canonicalJson(b.planes.map(p => p.key).sort()) !== canonicalJson(keys))) fail();
      const planes = keys.map(key => {
        const entries = boundaries.flatMap(b => b.planes.find(p => p.key === key)!.instances.map((instance, index) =>
          ({ instance, path: b.path, index, source: definition(instance.source) })));
        if (!entries.length || new Set(entries.map(e => e.instance.id)).size !== entries.length ||
            new Set(entries.map(e => canonicalJson(e.source))).size !== entries.length ||
            entries.some(e => e.instance.roots.length !== 1 || e.instance.roots[0] !== e.path)) fail();
        const selectedRoot = entries.filter(e => e.path === '' && canonicalJson(e.source) === canonicalJson(root));
        if (selectedRoot.length !== 1 || selectedRoot[0].index !== 0) fail();
        return boundaries.map(boundary => ({ path: boundary.path, sources: entries.filter(e => e.path === boundary.path).map(e => {
          const parent = entries.find(p => p.instance.id === e.instance.parent);
          if (e === selectedRoot[0] ? !!parent : !parent) fail();
          // Follow the complete authored parent chain; cycles and detached
          // children cannot acquire identity through a matching instance-N.
          const seen = new Set<string>(); let cursor: typeof e | undefined = e;
          while (cursor) {
            if (seen.has(cursor.instance.id)) fail();
            seen.add(cursor.instance.id);
            cursor = entries.find(p => p.instance.id === cursor!.instance.parent);
          }
          return { ...e.source, parent: parent ? { path: parent.path, index: parent.index } : null };
        }) }));
      });
      if (planes.some(plane => canonicalJson(plane) !== canonicalJson(planes[0]))) fail();
      return { ...root, boundaries: planes[0] };
    }
    const roots = row.ownership!.components.filter(component => component.roots.includes(''));
    if (roots.length !== 1 || roots[0].roots.length !== 1) fail();
    return definition(roots[0].source);
  } catch { return fail(); }
}

export function nativeSourceBelongsToReference(repo: string, pin: NativeSourcePin, reference: Pick<ReactReference, 'files'>) {
  return Object.hasOwn(reference.files, readNativeSourceIdentity(repo, pin).file);
}

export function assertNativeSourceIdentity(repo: string, original: NativeSourcePin, successor: NativeSourcePin) {
  if (canonicalJson(readNativeSourceIdentity(repo, original)) !== canonicalJson(readNativeSourceIdentity(repo, successor)))
    throw Error('react-source-succession-component-mismatch');
}
