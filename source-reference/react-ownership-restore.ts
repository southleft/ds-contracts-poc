import {isReactAuthoredNativeRequest,type ReactAuthoredNativeRequest} from './react-authored-native-request.js';
import {readReactAuthoredNativeEvidence} from './react-authored-native-evidence.js';
import { reactHelperObservationUnchanged } from './react-helper-observation.js';
/** Restore only an archive pinned by an existing host-owned native journal. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readReactNativeEvidence } from './react-native-evidence.js';
import { reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactOwnershipReport, startReactOwnership } from './react-ownership-run.js';
import { reactSourceProgramUnchanged, type ReactSourceProgram } from './react-source-program.js';

export function restoreReactOwnership(repo: string, reference: ReactReference,
  request: ReactNativeRequest | ReactAuthoredNativeRequest): ReturnType<typeof startReactOwnership> {
  const read = () => isReactAuthoredNativeRequest(request) ? readReactAuthoredNativeEvidence(repo,reference,request) : readReactNativeEvidence(repo,reference,request);
  read();
  const dir = path.join(repo, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  const state = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const program = JSON.parse(readFileSync(path.join(dir, 'program.json'), 'utf8')) as ReactSourceProgram;
  return { state, dir, promise: Promise.resolve(), close() {}, report() {
    const snapshot = structuredClone(state);
    try {
      read();
      if(snapshot.rows.some(r=>(r.helperObservations??[]).some(h=>!reactHelperObservationUnchanged(h))))throw Error('helper-observation-input-changed');
      return snapshot;
    } catch {
      const sourceUnchanged = reactReferenceUnchanged(reference) && reactSourceProgramUnchanged(program);
      return { ...snapshot, matched: 0, sourceUnchanged,
        problem: sourceUnchanged ? 'react-ownership-evidence-changed' : 'react-ownership-source-changed',
        rows: snapshot.rows.map(r => ({ ...r, matched: false, anatomy: undefined, rootVisual: undefined,
          propertyMatrix: undefined, rootMatrix: undefined, authoredTrees: undefined, helperObservations: undefined,
          compiledContent: undefined, compiledEffects: undefined, compiledValues: undefined, jsxEffects: undefined, jsxValues: undefined, jsxHelpers: undefined })) };
    }
  } };
}
