/** Pure planning for the native SLOT caller behavior proved in Evaluations.
 * The output is not write authority. A host must rederive it from authenticated
 * compiler output, allocate owned modes and aliases, and verify their exact
 * IDs and selected edges before dispatching the renderer. The application
 * source adapter does not infer the explicit contract marker yet. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { prepareNativeTokenContext, type NativeTokenContextInput } from './native-token-context.js';
import { flattenTokens } from './tokens.js';
import type { ComponentData, NodeSpec } from './emit-figma-script.js';

export type RootTextTemplateChannel = 'fontSize' | 'lineHeight' | 'fontWeight' | 'fill';
export type RootTextTemplateBindings = Record<RootTextTemplateChannel, string>;
export interface NativeRootTextTemplatePlan {
  version: 1;
  kind: 'native-root-text-template-modes';
  contractId: string;
  contractRevision: string;
  tokenRevision: string;
  /** Stable alias variable names; every main binds the same four variables. */
  aliases: RootTextTemplateBindings;
  /** Deduplicated by source token identity, never by resolved value. */
  modes: Array<{ key: string; name: string; targets: RootTextTemplateBindings }>;
  variants: Array<{ name: string; modeKey: string }>;
  /** Channels without native variable bindings must agree across all mains. */
  typography: { family: string; italic: boolean; letterSpacing: number; textCase: string; textAlign: string };
  revision: string;
}

export function planNativeRootTextTemplate(
  component: ComponentData,
  source: { contractRevision: string; tokenRevision: string },
): NativeRootTextTemplatePlan | undefined {
  if (component.rootSlot?.textTemplate !== 1) return undefined;
  const fail = (why: string): never => { throw Error(`NATIVE_ROOT_TEXT_TEMPLATE_PLAN_${why}`); };
  if (!/^sha256:[a-f0-9]{64}$/.test(source.contractRevision) || !/^sha256:[a-f0-9]{64}$/.test(source.tokenRevision))
    fail('SOURCE_REVISION_REQUIRED');
  if (!component.variants.length || component.stateVariants?.length) fail('VARIANTS_UNQUALIFIED');
  const names = new Set<string>(), tuples = new Map<string, RootTextTemplateBindings>();
  const variants: NativeRootTextTemplatePlan['variants'] = [];
  let typography: NativeRootTextTemplatePlan['typography'] | undefined;
  for (const variant of component.variants) {
    if (!variant.name || names.has(variant.name)) fail('VARIANT_IDENTITY');
    names.add(variant.name);
    const root = variant.spec, slot = root.children?.[0], text = slot?.children?.[0];
    if (root.children?.length !== 1 || slot?.type !== 'slot' || !slot.rootSlotContent ||
        slot.children?.length !== 1 || text?.type !== 'text' || !text.slotTextTemplate ||
        text.characters !== '' || text.textAutoResize !== 'WIDTH_AND_HEIGHT' || text.textTruncation ||
        text.textDecoration && text.textDecoration !== 'NONE' || !text.fontFamily || !text.fontStyle ||
        !Number.isFinite(text.letterSpacing)) fail('TEMPLATE_SHAPE');
    const t = text as NodeSpec;
    const current = { family: t.fontFamily!, italic: /italic$/i.test(t.fontStyle!),
      letterSpacing: t.letterSpacing!, textCase: t.textCase ?? 'ORIGINAL', textAlign: t.textAlignH ?? 'LEFT' };
    if (typography && canonicalJson(typography) !== canonicalJson(current)) fail('UNBOUND_TYPOGRAPHY_VARIES');
    typography = current;
    const targets = { fontSize: t.fontSizeVar!, lineHeight: t.lineHeightVar!, fontWeight: t.fontWeightVar!, fill: t.textFill! };
    if (Object.values(targets).some(name => typeof name !== 'string' || !name || name.trim() !== name))
      fail('BOUND_TYPOGRAPHY_REQUIRED');
    const tuple = canonicalJson(targets), modeKey = revisionOf(targets);
    tuples.set(tuple, targets);
    variants.push({ name: variant.name, modeKey });
  }
  const prefix = `dsc-native-template/${source.contractRevision.slice(7)}`;
  const body = {
    version: 1 as const, kind: 'native-root-text-template-modes' as const,
    contractId: component.contractId, ...source,
    aliases: { fontSize: `${prefix}/font-size`, lineHeight: `${prefix}/line-height`, fontWeight: `${prefix}/font-weight`, fill: `${prefix}/fill` },
    modes: [...tuples.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([, targets], index) => ({ key: revisionOf(targets), name: `Template ${index + 1}`, targets })),
    variants: variants.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    typography: typography!,
  };
  return { ...body, revision: revisionOf(body) };
}

/** Derive variant-selected alias rows from one pinned source token context.
 * The original leaves are identical in every physical mode. Only the four
 * compiler-derived alias edges vary; sourceMode and brand remain unchanged.
 * This reuses the existing owned collection and its complete allocation log. */
export function expandRootTextTemplateTokenContext(
  base: NativeTokenContextInput,
  plan: NativeRootTextTemplatePlan,
): NativeTokenContextInput {
  const fail = (why: string): never => { throw Error(`NATIVE_ROOT_TEXT_TEMPLATE_TOKENS_${why}`); };
  const { revision, ...body } = plan;
  if (revisionOf(body) !== revision) fail('PLAN_CHANGED');
  if (base.modes.length !== 1 || base.writeProtocol || base.allocatedValues || base.modes[0].nativeSelection ||
      base.modes[0].tokenTreeRevision !== plan.tokenRevision) fail('SOURCE_CONTEXT');
  prepareNativeTokenContext(base);
  if (Object.hasOwn(base.modes[0].tokens, 'dsc-native-template')) fail('ALIAS_NAME_COLLISION');
  const original = base.modes[0], table = flattenTokens(original.tokens);
  const aliasPaths = Object.values(plan.aliases).map(name => name.replaceAll('/', '.'));
  for (const path of aliasPaths) if ([...table.keys()].some(key => key === path || key.startsWith(path + '.') || path.startsWith(key + '.')))
    fail('ALIAS_NAME_COLLISION');
  const types: Record<RootTextTemplateChannel, string[]> = {
    fontSize: ['dimension', 'number'], lineHeight: ['dimension', 'number'], fontWeight: ['fontWeight', 'number'], fill: ['color'],
  };
  const modes = plan.modes.map(mode => {
    const tokens = structuredClone(original.tokens);
    for (const field of Object.keys(plan.aliases) as RootTextTemplateChannel[]) {
      const targetPath = mode.targets[field].replaceAll('/', '.'), target = table.get(targetPath);
      if (!target || !target.type || !types[field].includes(target.type)) fail('SOURCE_BINDING_TYPE');
      const path = plan.aliases[field].replaceAll('/', '.').split('.');
      let node = tokens;
      for (const segment of path.slice(0, -1)) node = (node[segment] ??= {}) as Record<string, unknown>;
      node[path[path.length - 1]] = { $type: target!.type, $value: `{${targetPath}}` };
    }
    return { ...original, nativeModeName: mode.name, nativeSelection: { planRevision: plan.revision, modeKey: mode.key },
      tokens, tokenTreeRevision: revisionOf(tokens) };
  });
  const expanded: NativeTokenContextInput = {
    ...structuredClone(base), writeProtocol: 'explicit-modes-v1',
    source: { ...base.source, tokensSha256: revisionOf(modes.map(m => ({ selection: m.nativeSelection, tokens: m.tokens }))).slice(7) },
    tokenPaths: [...base.tokenPaths, ...aliasPaths].sort(), modes,
  };
  prepareNativeTokenContext(expanded);
  return expanded;
}

/** Re-derive the projected token context instead of trusting supplied mode
 * labels, alias rows or a self-reported revision. The original tree must still
 * hash to the compiler's pinned source-token revision. */
export function verifyRootTextTemplateTokenContext(input: NativeTokenContextInput, plan: NativeRootTextTemplatePlan): void {
  const fail = (): never => { throw Error('NATIVE_ROOT_TEXT_TEMPLATE_TOKENS_CONTEXT_CHANGED'); };
  if (input.writeProtocol !== 'explicit-modes-v1' || !input.modes.length) fail();
  const base = structuredClone(input), mode = base.modes[0];
  delete base.writeProtocol; delete mode.nativeSelection;
  delete mode.tokens['dsc-native-template'];
  mode.tokenTreeRevision = revisionOf(mode.tokens); mode.nativeModeName = 'Source';
  if (mode.tokenTreeRevision !== plan.tokenRevision) fail();
  const aliasPaths = new Set(Object.values(plan.aliases).map(name => name.replaceAll('/', '.')));
  base.tokenPaths = base.tokenPaths.filter(path => !aliasPaths.has(path));
  base.modes = [mode]; base.source.tokensSha256 = plan.tokenRevision.slice(7);
  const expected = expandRootTextTemplateTokenContext(base, plan);
  if (canonicalJson(expected) !== canonicalJson(input)) fail();
}

/** Apply the rederived alias identity only to the known root template. */
export function applyRootTextTemplateAliases(component: ComponentData, plan: NativeRootTextTemplatePlan): void {
  for (const variant of component.variants) {
    const text = variant.spec.children![0].children![0];
    text.fontSizeVar = plan.aliases.fontSize; text.lineHeightVar = plan.aliases.lineHeight;
    text.fontWeightVar = plan.aliases.fontWeight; text.textFill = plan.aliases.fill;
  }
}
