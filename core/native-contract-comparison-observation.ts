import { nativeRootTextCallerModes } from './native-root-text-caller.js';
import type {NativeComparisonMainMigration} from './native-comparison-main-migration.js';
/** Independent observation of caller content in an existing native main.
 * Allocation acknowledgements choose IDs; compiler specs choose expectations. */
import {backgroundPaintIdentities} from './figma-background-clip.js';
import { nativeGridProblems, NATIVE_GRID_CHILD_FIELDS } from './native-grid-observation.js';
import { canonicalJson } from './contract-provenance.js';
import type { NodeSpec } from './emit-figma-script.js';
import { comparisonContentGrid, nativeComparisonDependencies, type PreparedNativeContractComparison } from './native-contract-comparison.js';
import { emitNativeContractReadbackScript, emitNativeInventoryReadbackScript, verifyNativeContractReadback,
  nativeShadowStackMatches, type NativeSourceReadback } from './native-source-observation.js';
import { resolveNativeSlotIdentities } from './native-slot-identity.js';
import { verifyNativeTokenContextReceipt, type NativeTokenContextInput, type NativeTokenIdentity } from './native-token-context.js';

type Row = Record<string, any>;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const numeric = (actual: unknown, expected: number) => actual === expected || actual === Math.fround(expected);
const withoutImages = (r: NativeSourceReadback) => { const out = structuredClone(r); delete out.images; return out; };
export interface NativeContractComparisonObservationInput {
  operation: { id: string; fileKey: string };
  planRevision: string;
  comparison: PreparedNativeContractComparison;
  tokenInput: NativeTokenContextInput;
  tokenIdentity: NativeTokenIdentity;
  creation: Row;
  mainMigrations?:NativeComparisonMainMigration[];
}
function checkInput(input: NativeContractComparisonObservationInput) {
  const { creation: c, comparison: p } = input;
  if (p.textTemplate) {
    const plan = p.parent.projection.rootTextTemplate;
    const modes = nativeRootTextCallerModes(p.parent, p.variantName);
    if (!plan || p.textTemplate.planRevision !== plan.revision || p.textTemplate.modeId !== modes[p.parent.tokenIdentity.collection.id] ||
        !same(p.textTemplate.modeVector, p.parent.templateGraph ? modes : undefined) ||
        !same(p.textTemplate.specPath, [0, 0]) || !same(p.slotSpecPath, [0]) || p.contentSpecPath || p.instances?.length ||
        p.specs.length !== 1 || p.specs[0].type !== 'text' || p.textTemplate.characters !== p.specs[0].characters ||
        input.mainMigrations?.length) throw Error('native-contract-comparison-template-observation-input-invalid');
  }
  if (!c || c.status !== 'created-candidate' || c.operationId !== input.operation.id || c.fileKey !== input.operation.fileKey ||
      input.operation.id === p.parent.operation.id || input.operation.fileKey !== p.parent.operation.fileKey ||
      !/^sha256:[a-f0-9]{64}$/.test(input.planRevision) || !Array.isArray(c.nodes) || !c.nodes.length ||
      c.nodes.some((n: Row) => !n || typeof n.id !== 'string' || !n.id) || new Set(c.nodes.map((n: Row) => n.id)).size !== c.nodes.length ||
      typeof c.pageId !== 'string' || typeof c.comparisonBoardId !== 'string' || c.target !== null ||
      c.variants !== undefined || !Array.isArray(c.comparisons) || c.comparisons.length !== 1 ||
      c.comparisons[0].id !== p.caseId || c.comparisons[0].mainId !== p.mainId || c.comparisons[0].status !== 'created-comparison' ||
      c.comparisons[0].slots?.length !== 1 || !same(c.comparisons[0].slots[0].specPath, p.slotSpecPath) ||
      input.tokenInput.fileKey !== input.operation.fileKey || input.tokenIdentity.fileKey !== input.operation.fileKey ||
      input.tokenInput.scopeId !== 'source-' + input.operation.id ||
      input.tokenInput.source.revision !== p.projection.source.revision ||
      input.tokenInput.source.sourceProgramSha256 !== p.projection.source.programSha256 ||
      input.tokenInput.modes.length !== 1 || input.tokenInput.modes[0].tokenTreeRevision !== p.projection.tokenRevision ||
      verifyNativeContractReadback(p.parent, p.receipt).status !== 'supported-structure-observed')
    throw Error('native-contract-comparison-observation-input-invalid');
}
export function emitNativeContractComparisonReadbackScript(input: NativeContractComparisonObservationInput, captureImages = false): string {
  checkInput(input);
  const nested = nativeComparisonDependencies(input.comparison).parents;
  const nestedScripts = nested.map(ref => emitNativeContractReadbackScript(ref.parent));
  const parent = emitNativeContractReadbackScript(input.comparison.parent);
  const inventory = emitNativeInventoryReadbackScript({ operation: input.operation, planRevision: input.planRevision,
    pageId: input.creation.pageId, nodes: input.creation.nodes,
    comparisons: [{ id: input.comparison.caseId, instanceId: input.creation.comparisons[0].instanceId, type: 'INSTANCE' }],
  }, input.tokenInput, input.tokenIdentity, ['nativeContractPart', 'nativeContractSample', 'nativeContractCase', 'fontWeightVar', 'lineHeightVar',
    ...(input.comparison.contentRows || input.comparison.instances?.some(ref => ref.contentRows) ? ['gridFlowRows'] : [])], captureImages, true,
    [input.comparison.parent,...nested.map(ref=>ref.parent)].flatMap(p=>backgroundPaintIdentities(p.component)),
    [], false, [], false, !!input.comparison.textTemplate);
  return `// GENERATED independent comparison readback. READ ONLY.
const out = { version: 1, status: 'refused', operationId: ${JSON.stringify(input.operation.id)},
  fileKey: ${JSON.stringify(input.operation.fileKey)}, planRevision: ${JSON.stringify(input.planRevision)},
  acceptedContract: null, nativeQualification: 'unqualified', problems: [] };
async function readParent() { return await (async () => { ${parent} })(); }
try {
  const before = await readParent();${nested.length ? `
  const nestedReaders = [${nestedScripts.map(script => `async () => { ${script} }`).join(',')}];
  const nestedBefore = [];
  for (const read of nestedReaders) nestedBefore.push(await read());` : ''}
  out.content = await (async () => { ${inventory} })();
  out.parent = await readParent();${nested.length ? `
  out.nested = [];
  for (const read of nestedReaders) out.nested.push(await read());
  if (JSON.stringify(nestedBefore) !== JSON.stringify(out.nested)) throw Error('native-contract-comparison-nested-readback-changed');` : ''}
  if (before.status !== 'native-readback-collected' || out.parent.status !== 'native-readback-collected' ||
      out.content.status !== 'native-readback-collected' || JSON.stringify(before) !== JSON.stringify(out.parent))
    throw Error('native-contract-comparison-readback-changed-or-unavailable');
  out.status = 'native-comparison-readback-collected';
} catch (error) { out.problems.push(error && error.message ? error.message : 'native-contract-comparison-readback-failed'); }
return out;
`;
}
/** Read an already authenticated template caller without collecting its main
 * a second time. The update transport supplies the independently read parent.
 * Static mode permits the final complete caller recheck without yielding. */
export function emitNativeTemplateCallerContentReadback(input: NativeContractComparisonObservationInput, synchronous = false, captureImages = false): string {
  checkInput(input);
  if (!input.comparison.textTemplate || !input.comparison.parent.templateGraph || input.comparison.instances?.length)
    throw Error('native-template-consumer-kind-unqualified');
  return emitNativeInventoryReadbackScript({ operation: input.operation, planRevision: input.planRevision,
    pageId: input.creation.pageId, nodes: input.creation.nodes,
    comparisons: captureImages ? [{id:input.comparison.caseId,instanceId:input.creation.comparisons[0].instanceId,type:'INSTANCE'}] : [],
  }, input.tokenInput, input.tokenIdentity,
  ['nativeContractPart', 'nativeContractSample', 'nativeContractCase', 'fontWeightVar', 'lineHeightVar'],
  captureImages, captureImages, backgroundPaintIdentities(input.comparison.parent.component), [], false, [], synchronous, true);
}
export function verifyNativeContractComparisonReadback(input: NativeContractComparisonObservationInput, receipt: unknown) {
  const problems: string[] = [];
  const issue = (code: string, row?: Row) => problems.push('native-contract-comparison-' + code + (row ? ':' + row.id : ''));
  const report = () => ({ version: 1 as const, status: problems.length ? 'refused' as const : 'supported-comparison-structure-observed' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const, problems: [...new Set(problems)],
    limitations: ['native-visual-fidelity-unverified', 'native-svg-geometry-unverified', 'native-computed-geometry-unverified',
      'comparison-snapshot-not-reusable-anatomy', 'native-resolved-paint-values-unverified'] });
  try {
    checkInput(input);
    const r = receipt as Row, c = input.creation, p = input.comparison;
    if (!r || r.version !== 1 || r.status !== 'native-comparison-readback-collected' || r.operationId !== input.operation.id ||
        r.fileKey !== input.operation.fileKey || r.planRevision !== input.planRevision || r.acceptedContract !== null ||
        r.nativeQualification !== 'unqualified' || !Array.isArray(r.problems) || r.problems.length ||
        verifyNativeContractReadback(p.parent, r.parent).status !== 'supported-structure-observed' ||
        !same(withoutImages(r.parent), p.receipt)) { issue('parent-or-envelope-changed'); return report(); }
    const dependencies = nativeComparisonDependencies(p);
    const references = p.instances ?? [], nestedRecords = c.comparisons[0].nested ?? [];
    if (!Array.isArray(nestedRecords) || nestedRecords.length !== references.length ||
        new Set(nestedRecords.map((n: Row) => n.index)).size !== references.length ||
        references.length && (!Array.isArray(r.nested) || r.nested.length !== dependencies.parents.length)) {
      issue('nested-inventory'); return report();
    }
    for (const [index, ref] of references.entries()) {
      if (verifyNativeContractReadback(ref.parent, r.nested[dependencies.indices[index]]).status !== 'supported-structure-observed' ||
          !same(withoutImages(r.nested[dependencies.indices[index]]), ref.receipt) ||
          ref.parent.operation.fileKey !== input.operation.fileKey || ref.parent.operation.id === input.operation.id) {
        issue('nested-main-changed'); return report();
      }
    }
    const content = r.content as NativeSourceReadback;
    if (!content || content.version !== 1 || content.status !== 'native-readback-collected' ||
        content.receiptKind !== 'independent-native-component-readback' || content.operationId !== input.operation.id ||
        content.fileKey !== input.operation.fileKey || content.planRevision !== input.planRevision ||
        content.acceptedContract !== null || content.nativeQualification !== 'unqualified' || content.problems.length || !Array.isArray(content.nodes)) {
      issue('inventory-unavailable'); return report();
    }
    const rows = resolveNativeSlotIdentities(c, content.nodes);
    if (!rows || new Set(rows.map(n => n.id)).size !== rows.length || !same(rows.map(n => n.id).sort(), c.nodes.map((n: Row) => n.id).sort())) {
      issue('inventory-changed'); return report();
    }
    if (content.tokens?.status !== 'readback-collected' || content.tokens.receiptKind !== 'independent-native-readback' ||
        verifyNativeTokenContextReceipt({ input: input.tokenInput, expectedIdentity: input.tokenIdentity, receipt: content.tokens.receipt }).status !== 'native-token-context-observed') {
      issue('token-drift'); return report();
    }
    const nodes = new Map(rows.map(n => [n.id, n])), checked = new Set<string>();
    const meta = (n: Row, key: string) => { try { return JSON.parse(n.metadata[key]); } catch { issue('metadata-' + key, n); return null; } };
    const owner = { version: 1, operationId: input.operation.id, sourceContractId: p.projection.contractId,
      sourceContractRevision: p.projection.contractRevision, tokenPreparationRevision: input.tokenIdentity.preparationRevision, acceptedContract: null };
    for (const row of rows) {
      const born = c.nodes.find((n: Row) => n.id === row.id);
      if (row.type !== born.type || (born.key && born.key !== row.key) || !same(meta(row, 'nativeSourceOperation'), owner) ||
          row.metadata.nativeSourceAllocation !== row.id) issue('ownership', row);
      if (!Array.isArray(row.childIds) || new Set(row.childIds).size !== row.childIds.length ||
          row.childIds.some((id: string) => nodes.get(id)?.parentId !== row.id) ||
          (row.id !== c.pageId && !nodes.get(row.parentId)?.childIds.includes(row.id))) issue('topology', row);
    }
    const record = c.comparisons[0], page = nodes.get(c.pageId), board = nodes.get(c.comparisonBoardId), instance = nodes.get(record.instanceId);
    if (!page || !board || !instance || page.type !== 'PAGE' || board.type !== 'FRAME' || instance.type !== 'INSTANCE' ||
        !same(page.childIds, [board.id]) || !same(board.childIds, [instance.id]) || instance.mainId !== p.mainId ||
        board.values.layoutMode !== 'VERTICAL' || board.values.fills?.length ||
        !same(meta(instance, 'nativeContractCase'), { id: p.caseId, revision: p.revision })) {
      issue('comparison-roots'); return report();
    }
    // The frame is the caller's place, never part of the component: FIXED at
    // the observed containing width exactly when the plan pinned one, and
    // hugging (as every writer creates it) whenever the plan pinned none.
    if (p.containerWidth !== undefined
      ? !numeric(board.values.width, p.containerWidth) || board.values.counterAxisSizingMode !== 'FIXED' ||
        board.values.primaryAxisSizingMode !== 'AUTO' || !numeric(instance.values.width, p.containerWidth) ||
        instance.values.layoutSizingHorizontal !== 'FILL'
      : board.values.counterAxisSizingMode !== 'AUTO') issue('container-width', board);
    checked.add(page.id); checked.add(board.id);
    const parentNodes = new Map(p.receipt.nodes!.map(n => [n.id, n]));
    const variableByName = new Map<string, string>(content.tokens.receipt.variables.map((v: Row) => [v.name, v.id]));
    const sampleMode = { [input.tokenIdentity.collection.id]: input.tokenIdentity.modes[0].modeId };
    // A template consumes only the main's graph. Native Figma can omit the
    // unused caller collection from resolved modes even when explicitly set.
    // If reported, that mode must still match; every source/selector is required.
    const templateModesMatch = (actual: unknown, parent: PreparedNativeContractComparison['parent'], variant: string) => {
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
      const modes = nativeRootTextCallerModes(parent, variant), callerId = input.tokenIdentity.collection.id;
      return same(actual, { ...modes, ...(callerId in actual ? sampleMode : {}) });
    };
    const alias = (name: string) => ({ type: 'VARIABLE_ALIAS', id: variableByName.get(name) });
    const paint = (v: any, name: string) => Array.isArray(v) && v.length === 1 && v[0].type === 'SOLID' && v[0].visible !== false &&
      variableByName.has(name) && same(v[0].boundVariables?.color, alias(name));
    const sample = (spec: NodeSpec, n?: Row, template?: { reference: Reference; source: Row }) => {
      if (!n || checked.has(n.id)) { issue('sample-pairing'); return; }
      if (template) {
        let carrier = template.reference.parent.component.variants.find(v => v.name === template.reference.variantName)!.spec;
        for (const index of template.reference.textTemplate!.specPath) carrier = carrier.children![index];
        spec = { ...spec, fontSizeVar: carrier.fontSizeVar, fontWeightVar: carrier.fontWeightVar,
          lineHeightVar: carrier.lineHeightVar, textFill: carrier.textFill };
      }
      const variables = template ? new Map([...template.reference.parent.tokenIdentity.variables.map(v => [v.tokenPath.replaceAll('.', '/'), v.id] as [string, string]),
        ...(template.reference.parent.templateGraph?.identity.routes.map(v => [v.name, v.id] as [string, string]) ?? [])]) : variableByName;
      const sampleAlias = (name: string) => ({ type: 'VARIABLE_ALIAS', id: variables.get(name) });
      const samplePaint = (v: any, name: string) => template
        ? Array.isArray(v) && v.length === 1 && v[0].type === 'SOLID' && v[0].visible !== false &&
          variables.has(name) && same(v[0].boundVariables?.color, sampleAlias(name)) : paint(v, name);
      if (spec.nativeContractSample?.instance !== undefined) {
        const index = spec.nativeContractSample.instance, reference = references[index];
        const record = nestedRecords.find((row: Row) => row.index === index);
        if (!reference || !record || record.instanceId !== n.id || record.mainId !== reference.mainId ||
            n.mainId !== reference.mainId || record.status !== 'created-comparison' || record.slots?.length !== (reference.contentMode === 'source-owned' ? 0 : 1) ||
            (reference.contentMode !== 'source-owned' && !same(record.slots[0].specPath, reference.slotSpecPath)) ||
            !same(spec.nativeContractSample.specPath, reference.specPath) ||
            !same(meta(n, 'nativeContractSample'), spec.nativeContractSample)) { issue('nested-instance-identity', n); return; }
        const parentNodes = new Map(reference.receipt.nodes!.map(row => [row.id, row]));
        pair(parentNodes.get(reference.mainId), n, [], { ...reference, specs: spec.children ?? [] }, record, parentNodes);
        return;
      }
      checked.add(n.id); const v = n.values;
      if (n.type !== ({ frame: 'FRAME', text: 'TEXT', svg: 'FRAME' } as Record<string, string>)[spec.type] ||
          !same(meta(n, 'nativeContractSample'), spec.nativeContractSample) || !same(v.explicitVariableModes, template ? {} : sampleMode) ||
          v.visible !== true || (v.opacity !== undefined && !numeric(v.opacity, spec.opacity ?? 1))) issue('sample-identity', n);
      if (template && (!same(meta(n, 'nativeContractPart'), meta(template.source, 'nativeContractPart')) ||
          !templateModesMatch(v.resolvedVariableModes, template.reference.parent, template.reference.variantName) ||
          !numeric(v.fontWeight, template.source.values.fontWeight) || v.textAutoResize !== 'WIDTH_AND_HEIGHT' ||
          !same(v.letterSpacing, template.source.values.letterSpacing) || !same(v.fills, template.source.values.fills)))
        issue('template-caller-inheritance', n);
      if (spec.layout && (v.layoutMode !== spec.layout.mode || v.primaryAxisAlignItems !== spec.layout.primary ||
          v.counterAxisAlignItems !== spec.layout.counter || v.clipsContent !== (spec.clipsContent === true))) issue('sample-layout', n);
      const bindings = { ...spec.bindings, ...(spec.fixedWidth?.varName ? { width: spec.fixedWidth.varName } : {}),
        ...(spec.fixedHeight?.varName ? { height: spec.fixedHeight.varName } : {}), ...(spec.fontSizeVar ? { fontSize: spec.fontSizeVar } : {}),
        ...(template ? { fontWeight: spec.fontWeightVar!, lineHeight: spec.lineHeightVar! } : {}) };
      const actual = Object.fromEntries(Object.entries(v.boundVariables ?? {}).filter(([key]) => !['fills', 'strokes'].includes(key)));
      // Figma reports text-field bindings as arrays, even for uniform text.
      // Accept exactly one alias; mixed ranges must not collapse to one value.
      if (n.type === 'TEXT' && Array.isArray(actual.fontSize) && actual.fontSize.length === 1) actual.fontSize = actual.fontSize[0];
      if (template) for (const field of ['fontWeight','lineHeight'])
        if (Array.isArray(actual[field]) && actual[field].length === 1) actual[field] = actual[field][0];
      if (!same(Object.keys(actual).sort(), Object.keys(bindings).sort()) || Object.entries(bindings).some(([field, name]) =>
        !variables.has(name) || !same(actual[field], sampleAlias(name)))) issue('sample-bindings', n);
      for (const field of ['fill', 'stroke'] as const) {
        const name = spec[field], values = v[field === 'fill' ? 'fills' : 'strokes'] ?? [];
        if (name ? !paint(values, name) : spec.type !== 'text' && values.length) issue('sample-' + field, n);
      }
      if (!nativeShadowStackMatches(spec, v.effects)) issue('sample-effects', n);
      if (spec.gradient || spec.absolute || spec.overlay || spec.pct !== undefined || spec.rotation || spec.layout?.mode === 'GRID') issue('sample-layout-unqualified', n);
      for (const field of ['width', 'height'] as const) {
        const expected = field === 'width' ? spec.fixedWidth?.px ?? spec.lits?.width : spec.fixedHeight?.px ?? spec.lits?.height;
        if (expected !== undefined && !numeric(v[field], expected)) issue('sample-' + field, n);
      }
      for (const [field, value] of Object.entries(spec.lits ?? {})) if (!['width', 'height'].includes(field) && !numeric(v[field], value as number)) issue('sample-literal-' + field, n);
      if (v.reactions?.length) issue('sample-reactions', n);
      if (spec.type === 'text') {
        if (v.characters !== spec.characters || v.fontName?.family !== spec.fontFamily ||
            ![spec.fontStyle, spec.fontStyle?.replaceAll(' ', '')].includes(v.fontName?.style) || !numeric(v.fontSize, spec.fontSize!) ||
            !same(v.lineHeight, spec.lineHeight ?? { unit: 'AUTO' }) || (spec.textAlignH && v.textAlignHorizontal !== spec.textAlignH) ||
            v.textCase !== (spec.textCase ?? 'ORIGINAL') || v.textDecoration !== (spec.textDecoration ?? 'NONE') ||
            v.textStyleId || n.metadata.fontWeightVar !== (spec.fontWeightVar ?? '') || n.metadata.lineHeightVar !== (spec.lineHeightVar ?? '') ||
            (!template && spec.letterSpacing && !same(v.letterSpacing, spec.letterSpacing))) issue('sample-text', n);
        if (spec.textFill ? !samplePaint(v.fills, spec.textFill) :
          !spec.textFillLit || v.fills?.length !== 1 || Object.keys(v.fills[0].boundVariables ?? {}).length ||
          !['r','g','b'].every(k => numeric(v.fills[0].color?.[k], (spec.textFillLit as any)[k])) ||
          !numeric(v.fills[0].opacity ?? 1, spec.textFillLit.a ?? 1)) issue('sample-text-paint', n);
      }
      if (spec.type === 'svg') {
        if (!numeric(v.width, spec.iconSize!) || !numeric(v.height, spec.iconSize!)) issue('sample-svg-size', n);
        const descend = (row: Row) => {
          row.childIds.forEach((id: string) => {
            const child = nodes.get(id);
            if (!child || checked.has(id) || !same(meta(child, 'nativeContractSample'), spec.nativeContractSample)) { issue('sample-svg-descendant'); return; }
            checked.add(id);
            if (spec.svgPaintVar) for (const field of ['fills', 'strokes']) for (const fill of child.values[field] ?? [])
              if (fill.visible !== false && fill.type === 'SOLID' && !same(fill.boundVariables?.color, alias(spec.svgPaintVar))) issue('sample-svg-paint', child);
            descend(child);
          });
        }; descend(n); return;
      }
      if (n.childIds.length !== (spec.children ?? []).length) issue('sample-children', n);
      (spec.children ?? []).forEach((child, index) => sample(child, nodes.get(n.childIds[index])));
    };
    // Content changes a hugging instance's geometry, but not the main's styles,
    // property bindings or other children. Compare every remaining observed field.
    const geometry = new Set(['x','y','width','height','relativeTransform','resolvedVariableModes','explicitVariableModes']);
    type Reference = Pick<PreparedNativeContractComparison, 'parent' | 'slotSpecPath' | 'contentSpecPath' | 'variantName' | 'specs' | 'textTemplate'> & { contentMode?: 'source-owned'; instanceWidth?: number };
    const pair = (original: Row | undefined, actual: Row | undefined, specPath: number[],
      reference: Reference = p, record: Row = c.comparisons[0], parentNodes = new Map(p.receipt.nodes!.map(n => [n.id, n]))) => {
      if (!original || !actual || checked.has(actual.id)) { issue('main-instance-pairing'); return; }
      checked.add(actual.id);
      if (!specPath.length && reference.instanceWidth !== undefined &&
          (!numeric(actual.values.width, reference.instanceWidth) || actual.values.layoutSizingHorizontal !== 'FIXED' ||
            actual.values.counterAxisSizingMode !== 'FIXED' || actual.values.layoutMode !== 'VERTICAL'))
        issue('instance-width', actual);
      const callerWidthSlot=reference.instanceWidth !== undefined && same(specPath,reference.slotSpecPath);
      if(callerWidthSlot && (actual.values.layoutSizingHorizontal!=='FILL' || actual.values.counterAxisSizingMode!=='FIXED'))
        issue('instance-width-slot',actual);
      const fullWidth = reference.parent.component.variants.find(v => v.name === reference.variantName)?.spec.rootFillWidth;
      if (!specPath.length && fullWidth) {
        const host = nodes.get(actual.parentId)?.values;
        if (actual.values.layoutSizingHorizontal !== 'FILL' || !host || !['VERTICAL', 'GRID'].includes(host.layoutMode) ||
            (host.layoutSizingHorizontal !== 'FILL' &&
              (host.layoutMode === 'GRID' ? host.primaryAxisSizingMode : host.counterAxisSizingMode) !== 'FIXED'))
          issue('nested-fill-width', actual);
      }
      if (actual.type !== (specPath.length ? original.type : 'INSTANCE') ||
          !same(meta(actual, 'nativeContractPart'), meta(original, 'nativeContractPart'))) issue('main-instance-identity', actual);
      const parentModes = reference.textTemplate ? nativeRootTextCallerModes(reference.parent, reference.variantName)
        : { [reference.parent.tokenIdentity.collection.id]: reference.parent.tokenIdentity.modes[0].modeId };
      if (!same(actual.values.explicitVariableModes, specPath.length ? original.values.explicitVariableModes : { ...sampleMode, ...parentModes }) ||
          reference.textTemplate && !templateModesMatch(actual.values.resolvedVariableModes, reference.parent, reference.variantName)) issue('main-instance-modes', actual);
      let contentGrid: NodeSpec | undefined;
      if (reference.contentSpecPath && same(specPath, reference.contentSpecPath)) {
        let spec = reference.parent.component.variants.find(v => v.name === reference.variantName)!.spec;
        for (const index of reference.contentSpecPath) spec = spec.children![index];
        contentGrid = comparisonContentGrid(spec, reference.specs);
        if (contentGrid.layout?.grid?.flowRows && !same(meta(actual, 'gridFlowRows'), contentGrid.layout.grid.flowRows))
          issue('grid-flow-recipe', actual);
      }
      const fields = new Set([...Object.keys(original.values), ...Object.keys(actual.values)]);
      let pairedSpec:NodeSpec|undefined=reference.parent.component.variants.find(v=>v.name===reference.variantName)!.spec;
      for(const index of specPath)pairedSpec=pairedSpec?.children?.[index];
      const background=pairedSpec?.backgroundPaint;
      if(background){
        const host=nodes.get(actual.parentId)?.values,v=actual.values;
        if(!host||!numeric(v.x,background.inset)||!numeric(v.y,background.inset)||
            !numeric(v.width,Math.max(0.01,host.width-2*background.inset))||
            !numeric(v.height,Math.max(0.01,host.height-2*background.inset))||
            !numeric(v.cornerRadius,Math.max(0,host.cornerRadius-background.inset)))issue('main-instance-background-geometry',actual);
      }
      for (const field of fields) {
        // A top-level instance has null references; a main inside a set can
        // report an empty object. Only these two empty representations agree.
        if (!specPath.length && field === 'componentPropertyReferences' &&
            [actual.values[field], original.values[field]].every(value => value === null || same(value, {}))) continue;
        if (!specPath.length && NATIVE_GRID_CHILD_FIELDS.includes(field) && nodes.get(actual.parentId)?.values.layoutMode === 'GRID') continue;
        if (!specPath.length && fullWidth && field === 'layoutSizingHorizontal') continue;
        if (((!specPath.length && reference.instanceWidth !== undefined) || callerWidthSlot) && ['counterAxisSizingMode','layoutSizingHorizontal'].includes(field)) continue;
        if (contentGrid?.layout?.grid?.flowRows && ['gridRowCount', 'gridRowSizes'].includes(field)) continue;
        if ((!geometry.has(field) || reference.contentMode === 'source-owned' &&
            (['width', 'height'].includes(field) || specPath.length > 0 && ['x', 'y', 'relativeTransform'].includes(field))) &&
            !same(actual.values[field], original.values[field])) issue('main-instance-' + field, actual);
      }
      if (!specPath.length) for (const [key, value] of Object.entries(original.variantProperties ?? {}))
        if (actual.componentProperties?.[key]?.type !== 'VARIANT' || actual.componentProperties[key].value !== value) issue('main-instance-property', actual);
      if (reference.contentMode !== 'source-owned' && same(specPath, reference.slotSpecPath) && (actual.id !== record.slots[0].nodeId || actual.type !== 'SLOT' ||
          actual.values.componentPropertyReferences?.slotContentId !== record.slots[0].propertyKey)) issue('slot-content', actual);
      if (reference.contentMode !== 'source-owned' && same(specPath, reference.contentSpecPath ?? reference.slotSpecPath)) {
        if (actual.childIds.length !== reference.specs.length || !same(actual.childIds, record.slots[0].contentNodeIds))
          issue('slot-content', actual);
        if (reference.contentSpecPath) {
          let spec = reference.parent.component.variants.find(v => v.name === reference.variantName)!.spec;
          for (const index of reference.contentSpecPath) spec = spec.children![index];
          for (const problem of nativeGridProblems(comparisonContentGrid(spec, reference.specs), actual.values,
            actual.childIds.map((id: string) => nodes.get(id)?.values))) issue('grid-content-' + problem, actual);
        }
        reference.specs.forEach((spec, index) => sample(spec, nodes.get(actual.childIds[index]), reference.textTemplate
          ? { reference, source: parentNodes.get(original.childIds[0])! } : undefined)); return;
      }
      if (original.childIds.length !== actual.childIds.length) issue('main-instance-children', actual);
      original.childIds.forEach((id: string, index: number) => pair(parentNodes.get(id), nodes.get(actual.childIds[index]), [...specPath, index], reference, record, parentNodes));
    };
    pair(parentNodes.get(p.mainId), instance, []);
    if (checked.size !== rows.length) issue('unverified-allocations');
  } catch { issue('malformed'); }
  return report();
}
