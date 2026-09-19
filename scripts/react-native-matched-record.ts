/** Record a NEW supplemental measurement from authenticated operation/source
 * journals and guarded capture evidence. Never overwrites an evidence folder. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as same } from 'node:util';
import type { DeclaredSpec } from './react-native-declared-record.js';
import { variantCandidates } from './react-native-fidelity-pair.js';
import { cropSourceFrame } from '../source-reference/source-framing.js';
import { REPO, QUALIFICATION, sha256 } from './react-native-fidelity-check.js';
import { MATCHED_INSTRUMENTS, checkMatchedEvidence, type MatchedManifest } from './react-native-matched-check.js';

/** Authenticate source/native identity without assigning a raster origin to
 * the operation's old unframed PNGs. Those images are not measured here. */
export function authenticateMatchedOperation(privateRoot: string, spec: DeclaredSpec) {
  const bytes = (file: string) => {
    if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw Error('matched-record-archive-path');
    return readFileSync(path.join(privateRoot, file));
  };
  const parse = (file: string) => JSON.parse(bytes(file).toString());
  if (spec.source.kind !== 'initial' || spec.journal !== 'source-native-app/operations/' + spec.operation) throw Error('matched-record-initial-operation-required');
  const inspection = spec.source.inspection;
  const headerBytes = bytes(spec.journal + '/operation.json'), header = JSON.parse(headerBytes.toString());
  if (header.id !== spec.operation || sha256(bytes(spec.journal + '/plan.json')) !== header.planSha256 ||
      sha256(bytes(spec.journal + '/token-create.js')) !== header.tokenScriptSha256) throw Error('matched-record-plan-changed');
  let previous = sha256(headerBytes), selected: any;
  const commands = new Map<string, any>();
  const events = readdirSync(path.join(privateRoot, spec.journal, 'events')).sort();
  for (const [sequence, name] of events.entries()) {
    const data = bytes(spec.journal + '/events/' + name), event = JSON.parse(data.toString());
    if (name !== String(sequence).padStart(8, '0') + '.json' || event.sequence !== sequence || event.previousSha256 !== previous) throw Error('matched-record-journal-chain');
    if (event.kind === 'dispatch') {
      const c = event.command;
      if (c.operationId !== header.id || c.fileKey !== header.policy.fileKey || c.planRevision !== header.planRevision ||
          sha256(c.script) !== c.scriptSha256 || commands.has(c.attemptId)) throw Error('matched-record-command-changed');
      commands.set(c.attemptId, c);
    } else if (event.kind === 'result') {
      const e = event.envelope, c = commands.get(e.attemptId);
      if (!c || ['phase', 'nonce', 'scriptSha256', 'operationId', 'planRevision', 'fileKey'].some(k => e[k] !== c[k])) throw Error('matched-record-result-uncorrelated');
      if (name === spec.event) {
        if (!c.readOnly || c.phase !== 'component-readback') throw Error('matched-record-readback-required');
        selected = { result: e.result, eventSha256: sha256(data), recordedAt: event.recordedAt };
      }
    } else throw Error('matched-record-event-kind');
    previous = sha256(data);
  }
  const r = selected?.result, pin = header.request.observation;
  if (!r || r.status !== 'native-readback-collected' || r.receiptKind !== 'independent-native-component-readback' ||
      r.operationId !== header.id || r.planRevision !== header.planRevision || r.fileKey !== header.policy.fileKey ||
      r.nativeQualification !== 'unqualified' || r.acceptedContract !== null || r.problems.length ||
      !pin || path.basename(spec.source.inspection) !== pin.id) throw Error('matched-record-readback-unverified');
  const sealBytes = bytes(spec.source.inspection + '/integrity.json'), seal = JSON.parse(sealBytes.toString());
  if (sha256(sealBytes) !== pin.inventorySha256 || seal.version !== 1) throw Error('matched-record-source-inventory');
  const sourceBytes = (name: string) => {
    const data = bytes(inspection + '/' + name);
    if (sha256(data) !== seal.files[name]) throw Error('matched-record-source-changed:' + name);
    return data;
  };
  const reportBytes = sourceBytes('report.json'), report = JSON.parse(reportBytes.toString()), request = JSON.parse(sourceBytes('request.json').toString());
  if (sha256(reportBytes) !== pin.reportSha256 || !same(header.request, { ...request, kind: 'react-initial-draft', observation: pin }) ||
      report.phase !== 'complete' || !report.sourceUnchanged || report.problems.length) throw Error('matched-record-source-request');
  const claimed = new Set<string>();
  const pairs = report.observation.rows.map((row: any) => {
    if (row.status !== 'observed' || !/^[0-9]+$/.test(row.id)) throw Error('matched-record-source-state');
    const candidates = variantCandidates(row.changes, spec.source.kind === 'initial' ? spec.source.axisNames ?? {} : {});
    const hits = r.images.filter((image: any) => candidates.includes(String(image.caseId).replace(/^variant:/, '')));
    if (hits.length !== 1 || claimed.has(hits[0].nodeId)) throw Error('matched-record-variant-pairing');
    const original = sourceBytes('states/' + row.id + '.png'), state = JSON.parse(sourceBytes('states/' + row.id + '.json').toString());
    if (sha256(original) !== row.image || state.image !== row.image) throw Error('matched-record-original-changed');
    claimed.add(hits[0].nodeId);
    return { observation: String(row.id), variant: hits[0].caseId.replace(/^variant:/, ''), native: { nodeId: hits[0].nodeId },
      source: { originalSha256: row.image, bounds: state.bounds, crop: cropSourceFrame(original, state.bounds).crop } };
  });
  if (claimed.size !== r.images.length) throw Error('matched-record-unpaired-native');
  return { id: spec.id, component: spec.component, pairs,
    source: { referenceId: header.request.anchor.referenceId, caseId: request.caseId, inspectionId: pin.id,
      inventorySha256: pin.inventorySha256, reportSha256: pin.reportSha256 },
    native: { operationId: header.id, journalEvent: spec.event, journalEventSha256: selected.eventSha256,
      journalHeadSha256: previous, journalEventsVerified: events.length, planRevision: header.planRevision, recordedAt: selected.recordedAt } };
}

export function collectMatchedEvidence(privateRoot: string, sourceCapture: string, nativeCapture: string, spec: DeclaredSpec) {
  const authenticated = authenticateMatchedOperation(privateRoot, spec);
  const json = (dir: string, name: string) => JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
  const probe = json(nativeCapture, 'native-probe.json');
  const current = json(nativeCapture, 'current-original-readback.json');
  const restored = json(nativeCapture, 'repeat-and-restoration.json');
  const event = json(path.join(privateRoot, spec.journal, 'events'), spec.event);
  if (!probe.response.success || !same(current.response.result, event.envelope.result) ||
      !same(restored.afterReadback.result, event.envelope.result)) throw Error('matched-record-native-baseline-changed');
  const summary = json(sourceCapture, 'source-summary.json');
  if (!summary.sourceFilesUnchanged || !summary.ownershipOriginalMatched ||
      summary.referenceId !== authenticated.source.referenceId ||
      summary.receipts.length !== authenticated.pairs.length ||
      probe.response.result.rows.length !== authenticated.pairs.length) throw Error('matched-record-source-unverified');
  const nodes = new Map<string, any>(event.envelope.result.nodes.map((n: any) => [n.id, n]));
  function authenticSnapshot(snapshot: any, id: string, root = true) {
    const n = nodes.get(id);
    if (!n || n.type !== snapshot.type || n.name !== snapshot.name) throw Error('matched-record-node-mismatch');
    for (const [key, value] of Object.entries(n.values)) {
      if (root && ['x', 'y', 'relativeTransform'].includes(key)) continue;
      if (Object.hasOwn(snapshot, key) && !same(snapshot[key], value)) throw Error('matched-record-node-value-mismatch:' + key);
    }
    for (const key of ['width', 'height', 'fills', 'strokes', 'opacity', 'boundVariables', 'resolvedVariableModes'])
      if (!same(snapshot[key], n.values[key])) throw Error('matched-record-node-value-missing:' + key);
    if ((snapshot.children?.length ?? 0) !== (n.childIds?.length ?? 0)) throw Error('matched-record-child-count');
    (snapshot.children ?? []).forEach((child: any, index: number) => authenticSnapshot(child, n.childIds[index], false));
  }
  const files = new Map<string, Buffer>();
  const rows = authenticated.pairs.map((pair: any) => {
    const source = json(sourceCapture, pair.observation + '.source.json');
    const hits = probe.response.result.rows.filter((r: any) => r.id === pair.observation && r.originalId === pair.native.nodeId);
    if (hits.length !== 1 || !source.componentUnchanged || !source.captureStable || !source.sourceRestored ||
        source.originalSha256 !== pair.source.originalSha256 || !same(source.bounds, pair.source.bounds) ||
        !same(source.crop, pair.source.crop)) throw Error('matched-record-pairing-invalid');
    const n = hits[0];
    if (!n.unchanged || !n.sourceUnchanged || !n.contained || !same(n.before, n.after)) throw Error('matched-record-clone-changed');
    authenticSnapshot(n.before, n.originalId);
    const refs: Record<string, string> = {};
    for (const side of ['original', 'context', 'transparent', 'source', 'native'] as const) {
      const name = pair.observation + '.' + side + '.png';
      const bytes = readFileSync(path.join(side === 'native' ? nativeCapture : sourceCapture, name));
      if (side === 'native' && !bytes.equals(Buffer.from(n.pngBase64, 'base64'))) throw Error('matched-record-export-changed');
      files.set(name, bytes); refs[side] = sha256(bytes);
    }
    const { id: _id, changes: _changes, componentUnchanged: _unchanged, captureStable: _stable, sourceRestored: _restored, ...receipt } = source;
    return { id: pair.observation, variant: pair.variant, source: receipt, files: refs as MatchedManifest['rows'][number]['files'],
      native: { originalId: n.originalId, frameId: n.frameId, cloneId: n.cloneId,
        frameBounds: n.frameBounds, renderBounds: n.renderBounds, rootPosition: n.rootPosition,
        rootSize: { width: n.before.width, height: n.before.height },
        originalSnapshotSha256: sha256(JSON.stringify(n.before)), cloneSnapshotSha256: sha256(JSON.stringify(n.after)),
        export: { kind: 'figma-plugin-frame-v1' as const, scale: 1 as const, useAbsoluteBounds: true as const, contentsOnly: true as const } } };
  });
  const manifest: MatchedManifest = { version: 1, kind: 'react-native-matched-capture', qualification: QUALIFICATION, acceptedContract: null,
    instruments: Object.fromEntries(MATCHED_INSTRUMENTS.map(f => [f, sha256(readFileSync(path.join(REPO, f)))])),
    cohort: { id: authenticated.id, component: authenticated.component, source: authenticated.source,
      native: { ...authenticated.native, captureScriptSha256: sha256(probe.code), originalReadbackUnchanged: true } }, rows };
  const bytes = JSON.stringify(manifest, null, 2) + '\n';
  if (/\/Users\/|\/home\/|figd_|dscn_|FIGMA_TOKEN|pngBase64/.test(bytes) || bytes.includes(event.envelope.fileKey)) throw Error('matched-record-evidence-leak');
  files.set('manifest.json', Buffer.from(bytes));
  return { manifest, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name: string) => {
    const i = process.argv.indexOf('--' + name);
    if (i < 0 || !process.argv[i + 1]) throw Error('Missing --' + name);
    return path.resolve(process.argv[i + 1]!);
  };
  const out = arg('out');
  if (existsSync(out)) throw Error('matched-record-output-exists');
  const { files } = collectMatchedEvidence(arg('private'), arg('source'), arg('native'), JSON.parse(readFileSync(arg('spec'), 'utf8')));
  mkdirSync(out, { recursive: true });
  for (const [name, bytes] of files) writeFileSync(path.join(out, name), bytes, { flag: 'wx' });
  const score = checkMatchedEvidence(out, true);
  console.log(`Recorded ${score.rows.length} matched pairs; originals and historical measurements remain unchanged.`);
}
