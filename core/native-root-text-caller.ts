import type { NodeSpec } from './emit-figma-script.js';
import type { NativeContractObservationInput } from './native-source-observation.js';
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { prepareNativeTokenContext, type NativeTokenContextInput } from './native-token-context.js';

/** Derived by the host from an authenticated captured DOM tree and its
 * recompiled caller contract. Matching paint values alone is not inheritance. */
export interface NativeRootTextCallerEvidence {
  version: 1;
  kind: 'direct-root-text';
  treeRevision: string;
  contractRevision: string;
  characters: string;
}
export interface NativeRootTextCaller {
  specPath: number[];
  characters: string;
  modeId: string;
  planRevision: string;
}

/** Prove that the sole anonymous caller text has the selected main's complete
 * typography. Refs can belong to the separately captured sample token layer;
 * the host's direct-text evidence proves why the root's bindings may replace
 * them. No descendant element, nested main, or measured size is admitted. */
export function planNativeRootTextCaller(parent: NativeContractObservationInput, variantName: string,
  contractRevision: string, tokenRevision: string, tokens: Record<string, unknown> | undefined,
  evidence: NativeRootTextCallerEvidence | undefined, children: NodeSpec[]): NativeRootTextCaller {
  const fail = (why: string): never => { throw Error('native-contract-comparison-text-template-' + why); };
  const plan = parent.projection.rootTextTemplate;
  if (!plan || !evidence || evidence.version !== 1 || evidence.kind !== 'direct-root-text' ||
      Object.keys(evidence).sort().join('|') !== 'characters|contractRevision|kind|treeRevision|version' ||
      !/^sha256:[a-f0-9]{64}$/.test(evidence.treeRevision) || evidence.contractRevision !== contractRevision ||
      !tokens || revisionOf(tokens) !== tokenRevision) fail('source-inheritance-required');
  const key = plan!.variants.find(v => v.name === variantName)?.modeKey;
  const native = parent.tokenIdentity.modes.filter(m => m.nativeSelection?.planRevision === plan!.revision && m.nativeSelection?.modeKey === key);
  const variant = parent.component.variants.find(v => v.name === variantName);
  const template = variant?.spec.children?.[0]?.children?.[0];
  if (native.length !== 1 || !template?.slotTextTemplate || children.length !== 1 || children[0].type !== 'text') fail('single-text-required');
  const child = children[0], expected = template!;
  const allowed = new Set(['type','name','characters','fontSize','fontStyle','fontFamily','fontSizeVar','fontWeightVar','lineHeightVar',
    'textFill','lineHeight','letterSpacing','textCase','textAlignH','textDecoration','textAutoResize']);
  if (Object.keys(child).some(k => !allowed.has(k)) || !evidence!.characters || child.characters !== evidence!.characters ||
      child.fontFamily !== expected.fontFamily || child.fontStyle !== expected.fontStyle || child.fontSize !== expected.fontSize ||
      canonicalJson(child.lineHeight) !== canonicalJson(expected.lineHeight) ||
      (child.letterSpacing ?? 0) !== (expected.letterSpacing ?? 0) ||
      (child.textCase ?? 'ORIGINAL') !== (expected.textCase ?? 'ORIGINAL') ||
      (child.textAlignH ?? 'LEFT') !== (expected.textAlignH ?? 'LEFT') ||
      (child.textDecoration ?? 'NONE') !== 'NONE' || (child.textAutoResize ?? 'WIDTH_AND_HEIGHT') !== 'WIDTH_AND_HEIGHT')
    fail('caller-typography-differs');
  const fields = ['fontSizeVar','fontWeightVar','lineHeightVar','textFill'] as const;
  if (fields.some(field => !child[field] || !expected[field])) fail('bound-typography-required');
  const paths = fields.map(field => child[field]!.replaceAll('/', '.'));
  const sampleInput: NativeTokenContextInput = { fileKey: parent.operation.fileKey, scopeId: 'template-caller-read',
    source: { ...parent.tokenInput.source, tokensSha256: tokenRevision.slice(7) }, tokenPaths: [...new Set(paths)].sort(),
    modes: [{ sourceMode: parent.projection.context.mode, brand: parent.projection.context.brand, nativeModeName: 'Caller',
      tokens: tokens!, tokenTreeRevision: tokenRevision }] };
  const sample = prepareNativeTokenContext(sampleInput), main = prepareNativeTokenContext(parent.tokenInput);
  const value = (input: typeof sample, name: string, modeKey?: string): unknown => {
    const seen = new Set<string>(); let path = name.replaceAll('/', '.');
    for (let i = 0; i <= input.variables.length; i++) {
      if (seen.has(path)) break; seen.add(path);
      const row = input.variables.find(v => v.tokenPath === path)?.values.filter(v => modeKey === undefined || v.nativeSelection?.modeKey === modeKey);
      if (row?.length !== 1) break;
      const v = row[0].value;
      if (v && typeof v === 'object' && 'type' in v && v.type === 'TOKEN_ALIAS') { path = v.targetPath; continue; }
      return v;
    }
    return fail('unresolved-binding');
  };
  for (const field of fields) if (canonicalJson(value(sample, child[field]!)) !== canonicalJson(value(main, expected[field]!, key)))
    fail('caller-binding-value-differs');
  return { specPath: [0, 0], characters: evidence!.characters, modeId: native[0].modeId, planRevision: plan!.revision };
}
