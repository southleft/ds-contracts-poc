import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readdirSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {canonicalJson, revisionOf} from '../core/contract-provenance.js';
import {qualifyNativeVectorStrokeCapture, type NativeVectorStrokeCapture} from '../core/source-vector-stroke.js';

function physicalPath(file: string): string {
  const suffix: string[] = []; let base = path.resolve(file);
  while (!existsSync(base)) {suffix.unshift(path.basename(base)); const parent = path.dirname(base); if (parent === base) break; base = parent;}
  return path.join(realpathSync(base), ...suffix);
}
const inside = (file: string, directory: string) => file === directory ||
  (!path.relative(directory, file).startsWith('..' + path.sep) && path.relative(directory, file) !== '..' && !path.isAbsolute(path.relative(directory, file)));

/** New observation inputs cannot live in the output namespace or alias a file
 * the packager/checker can replace. The URL command's own raw dump is the sole
 * source exception; capture remains outside output before URL acquisition. */
export function assertNativeVectorInputPaths(outDir: string, dumpPath?: string,
  capturePath?: string, source: 'json' | 'figma' = 'json'): void {
  const lexicalOut = path.resolve(outDir), physicalOut = physicalPath(outDir);
  const inputs = [dumpPath, capturePath].filter((p): p is string => !!p).map(file => ({
    lexical: path.resolve(file), physical: physicalPath(file), source: file === dumpPath,
  }));
  const ownUrlDump = (input: typeof inputs[number]) => input.source && source === 'figma' &&
    input.lexical === path.join(lexicalOut, 'dump.json') && input.physical === path.join(physicalOut, 'dump.json');
  for (const input of inputs) if (!ownUrlDump(input) &&
      (inside(input.lexical, lexicalOut) || inside(input.physical, physicalOut)))
    throw Error('native-vector-stroke-supplement-input-conflicts-with-output');
  if (!existsSync(outDir)) return;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, entry.name), metadata = lstatSync(file);
      if (metadata.isSymbolicLink()) {
        const target = physicalPath(file);
        if (inputs.some(input => input.physical === target || inside(input.physical, target)))
          throw Error('native-vector-stroke-supplement-output-aliases-input');
      } else if (metadata.isDirectory()) visit(file);
      else if (metadata.isFile()) for (const input of inputs) {
        if (ownUrlDump(input) && path.resolve(file) === input.lexical) continue;
        if (existsSync(input.lexical)) {const original = statSync(input.lexical);
          if (metadata.dev === original.dev && metadata.ino === original.ino)
            throw Error('native-vector-stroke-supplement-output-aliases-input');}
      }
    }
  };
  visit(outDir);
}

/** Explicit additional observation input. It never edits the source file or
 * substitutes an enriched source for the consumer checker's original input. */
export function prepareNativeVectorStrokeInput(rawDumpText: string, receipt: unknown): Record<string, unknown> {
  const capture = receipt as NativeVectorStrokeCapture;
  if (capture?.kind !== 'native-vector-stroke-capture' || capture.version !== 1)
    throw Error('native-vector-stroke-supplement-receipt-invalid');
  if (capture.source?.rawDumpText !== rawDumpText ||
      capture.source?.rawDumpSha256 !== createHash('sha256').update(rawDumpText).digest('hex'))
    throw Error('native-vector-stroke-supplement-raw-source-changed');
  const dump = JSON.parse(rawDumpText);
  if (Object.hasOwn(dump, '_nativeVectorStrokeCapture'))
    throw Error('native-vector-stroke-supplement-source-already-enriched');
  qualifyNativeVectorStrokeCapture(dump, capture, dump._provenance?.fileKey);
  return {...structuredClone(dump), _nativeVectorStrokeCapture: structuredClone(capture)};
}

export type NativeVectorStrokeObservation = Pick<NativeVectorStrokeCapture, 'mains' | 'occurrences'> & {fileKey: string};

export type NativeVectorStrokeReadPlan = {
  fileKey: string;
  mains: Array<Omit<NativeVectorStrokeCapture['mains'][number], 'native'>>;
  occurrences: Array<{rootId: string; hostId: string; leafId: string}>;
};

/** The existing mapped child-owned stroke targets select source identities.
 * Complete physical main membership and every reference occurrence are then
 * requested; component display names never choose a geometry capability. */
export function planNativeVectorStrokeRead(rawDumpText: string,
  reference: NativeVectorStrokeCapture['reference']): NativeVectorStrokeReadPlan {
  const dump = JSON.parse(rawDumpText), fileKey = dump._provenance?.fileKey;
  if (!fileKey || reference?.version !== dump._provenance?.strokeSvgCapture?.sources?.version)
    throw Error('native-vector-stroke-acquisition-source-version-unavailable');
  const sets: any[] = Object.values(dump).filter((set: any) => Array.isArray(set?.variants));
  const walk = (node: any): any[] => [node, ...(node.children ?? []).flatMap(walk)];
  const targets = new Set<string>();
  for (const set of sets) for (const main of set.variants) for (const node of walk(main))
    for (const override of node.hostOverrides ?? []) {
      const target = override.solidStrokeTarget;
      if (override.fields?.includes('strokes') && target?.childPath?.length === 1 && target.childPath[0] === 0)
        targets.add(target.componentId);
    }
  const ownedSets = sets.filter(set => set.variants.some((main: any) => targets.has(main.nodeId)));
  const mains: NativeVectorStrokeReadPlan['mains'] = [];
  for (const set of ownedSets) {
    if (!set.key) throw Error('native-vector-stroke-acquisition-owner-key-unavailable');
    for (const main of set.variants) {
      if (!main.children?.length) continue; // observed physical absence, not a missing captured node
      if (main.children.length !== 1 || main.children[0].type !== 'VECTOR' ||
          !main.nodeId || !main.componentKey || !main.children[0].nodeId)
        throw Error('native-vector-stroke-acquisition-direct-owner-unqualified');
      mains.push({setKey: set.key, componentKey: main.componentKey, componentId: main.nodeId,
        childPath: [0], nodeId: main.children[0].nodeId});
    }
  }
  const mainIds = new Set(mains.map(main => main.componentId));
  const occurrences: NativeVectorStrokeReadPlan['occurrences'] = [];
  for (const [rootId, row] of Object.entries(reference.nodes)) for (const host of walk(row.document)) {
    if (host.type !== 'INSTANCE' || !mainIds.has(host.componentId)) continue;
    if (host.children?.length !== 1 || host.children[0].type !== 'VECTOR')
      throw Error('native-vector-stroke-acquisition-occurrence-child-unqualified');
    occurrences.push({rootId, hostId: host.id, leafId: host.children[0].id});
  }
  if (!mains.length || !occurrences.length || new Set(mains.map(main => main.nodeId)).size !== mains.length ||
      new Set(occurrences.map(row => row.hostId)).size !== occurrences.length)
    throw Error('native-vector-stroke-acquisition-membership-unqualified');
  return {fileKey, mains, occurrences};
}

/** A bounded read-only Plugin API program. Its caller must obtain and retain
 * the before/after REST references; this is not an automatic URL capture UX. */
export function buildNativeVectorStrokeRead(plan: NativeVectorStrokeReadPlan): string {
  const nodeId = /^(?:I)?\d+:\d+(?:;\d+:\d+)*$/;
  if (!/^[A-Za-z0-9]+$/.test(plan.fileKey) || !plan.mains.length || !plan.occurrences.length ||
      plan.mains.length + plan.occurrences.length > 128 ||
      plan.mains.some(row => !nodeId.test(row.nodeId) || !nodeId.test(row.componentId)) ||
      plan.occurrences.some(row => ![row.rootId, row.hostId, row.leafId].every(id => nodeId.test(id))))
    throw Error('native-vector-stroke-acquisition-read-plan-invalid');
  return `const plan=${JSON.stringify(plan)};
if(figma.fileKey!==plan.fileKey)throw Error('native-vector-stroke-acquisition-file-mismatch');
const fields=['type','visible','opacity','blendMode','width','height','relativeTransform','fills','effects','strokes','dashPattern','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','strokeWeight','vectorPaths','vectorNetwork','layoutMode','layoutPositioning','primaryAxisSizingMode','counterAxisSizingMode','primaryAxisAlignItems','counterAxisAlignItems','paddingTop','paddingRight','paddingBottom','paddingLeft','layoutAlign','layoutSizingHorizontal','layoutSizingVertical'];
const read=node=>{const out={nodeId:node.id};for(const field of fields){const value=node[field];out[field]=value===undefined?null:value;}return JSON.parse(JSON.stringify(out));};
const mains=[];for(const row of plan.mains){const leaf=await figma.getNodeByIdAsync(row.nodeId),main=leaf&&leaf.parent;
 if(!leaf||leaf.type!=='VECTOR'||!main||main.id!==row.componentId||main.key!==row.componentKey||main.parent?.key!==row.setKey)throw Error('native-vector-stroke-acquisition-main-mismatch');
 mains.push({...row,native:{...read(leaf),parent:{nodeId:main.id}}});}
const occurrences=[];for(const row of plan.occurrences){const host=await figma.getNodeByIdAsync(row.hostId),leaf=await figma.getNodeByIdAsync(row.leafId);
 if(!host||host.type!=='INSTANCE'||!leaf||leaf.type!=='VECTOR'||leaf.parent?.id!==host.id)throw Error('native-vector-stroke-acquisition-occurrence-mismatch');
 const main=await host.getMainComponentAsync();if(!main||!main.parent?.key)throw Error('native-vector-stroke-acquisition-main-unavailable');
 occurrences.push({...row,main:{id:main.id,key:main.key,componentSetKey:main.parent.key},host:read(host),leaf:read(leaf),hostTransform:host.relativeTransform,hostBox:host.absoluteBoundingBox,leafBox:leaf.absoluteBoundingBox,paintBox:leaf.absoluteRenderBounds});}
const result={fileKey:figma.fileKey,mains,occurrences};
if(new TextEncoder().encode(JSON.stringify(result)).byteLength>16000)throw Error('native-vector-stroke-acquisition-response-budget-exceeded');
return result;`;
}

/** Join separately acquired observations to the actual raw source and two
 * version-pinned REST reads. The caller owns acquisition; this pure assembler
 * neither fetches Figma nor treats a filename or checksum as native evidence. */
export function assembleNativeVectorStrokeCapture(rawDumpText: string,
  before: NativeVectorStrokeCapture['reference'], after: NativeVectorStrokeCapture['reference'],
  observed: NativeVectorStrokeObservation): NativeVectorStrokeCapture {
  const dump = JSON.parse(rawDumpText), fileKey = dump._provenance?.fileKey;
  if (!fileKey || observed.fileKey !== fileKey || !before?.version ||
      canonicalJson(before) !== canonicalJson(after))
    throw Error('native-vector-stroke-acquisition-source-changed');
  const plan = planNativeVectorStrokeRead(rawDumpText, before);
  const identities = (rows: any[], fields: string[]) => rows.map(row =>
    Object.fromEntries(fields.map(field => [field, row?.[field]]))).sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  if (!Array.isArray(observed.mains) || !Array.isArray(observed.occurrences) ||
      canonicalJson(identities(plan.mains, ['setKey', 'componentKey', 'componentId', 'childPath', 'nodeId'])) !==
      canonicalJson(identities(observed.mains, ['setKey', 'componentKey', 'componentId', 'childPath', 'nodeId'])) ||
      canonicalJson(identities(plan.occurrences, ['rootId', 'hostId', 'leafId'])) !==
      canonicalJson(identities(observed.occurrences, ['rootId', 'hostId', 'leafId'])))
    throw Error('native-vector-stroke-acquisition-membership-unqualified');
  const payload: Omit<NativeVectorStrokeCapture, 'captureRevision'> = {
    kind: 'native-vector-stroke-capture', version: 1,
    source: {fileKey, fileVersion: before.version, dumpRevision: revisionOf(dump),
      rawDumpText, rawDumpSha256: createHash('sha256').update(rawDumpText).digest('hex'),
      referenceRevision: revisionOf(before)},
    reference: structuredClone(before), mains: structuredClone(observed.mains),
    occurrences: structuredClone(observed.occurrences),
  };
  const capture = {...payload, captureRevision: revisionOf(payload)};
  prepareNativeVectorStrokeInput(rawDumpText, capture);
  return capture;
}
