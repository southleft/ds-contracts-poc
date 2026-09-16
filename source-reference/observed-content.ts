/** One observed caller composition, compiled through the existing computed
 * anatomy/layout/token pipeline. This is a comparison snapshot, never a main
 * component definition or evidence of reusable nested component semantics.
 */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine, type ComponentData } from '../core/emit-figma-script.js';
import { mintTokens } from '../core/mint-tokens.js';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { enumerate, flatten, normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
import type { ComponentConfig, PropSpace, SweepResult } from '../extract/computed/capture.js';
import { alignSweep, enrichLayout, prepareMint, applyMintToContract } from '../extract/computed/fuse.js';
import { promoteAnatomy } from '../extract/computed/anatomy.js';
import { reactRootStyleExclusion } from './react-root-visual.js';
import { withPaintedTextFonts, type TextFontEvidence } from './text-fonts.js';
import { verifiedSvgViewports, type SvgViewportEvidence } from './svg-viewports.js';

export interface ObservedContentDraft {
  version: 1;
  status: 'compiled-comparison-draft' | 'refused';
  qualification: 'observed-comparison-content-only';
  acceptedContract: null;
  nativeQualification: 'unqualified';
  inputRevision: string;
  treeRevision: string;
  fontsRevision: string;
  contract?: Contract;
  tokens?: Record<string, unknown>;
  component?: ComponentData;
  assets?: Array<[string, string]>;
  /** Opt-in compiler correspondence; paths are this observation's DOM addresses. */
  sourcePaths?: Array<{ sourcePath: string; partName: string; specPath: number[]; type: string }>;
  receipts: string[];
  residuals: ReturnType<typeof prepareMint>['codeOnly'];
  problems: string[];
  limitations: string[];
}

export function compileObservedContent(tree: CapturedNode, fonts: TextFontEvidence, svg?: SvgViewportEvidence,
  includeSourcePaths = false, preserveTextBoxes: string[] = []): ObservedContentDraft {
  return compileContent(tree, fonts, svg, includeSourcePaths, preserveTextBoxes, false);
}

/** Re-open an authenticated snapshot, never adopt its stored output on trust.
 * The pre-opacity compiler omitted identity opacity. That representation is
 * recoverable only when every observed element is explicitly fully opaque,
 * and fresh compilation reproduces the ENTIRE old result exactly. Missing or
 * nonidentity opacity, pseudo content and every other compiler delta refuse.
 * New observations always use the current compiler, including opacity. */
export function recompileSavedObservedContent(tree: CapturedNode, fonts: TextFontEvidence,
  svg: SvgViewportEvidence | undefined, saved: ObservedContentDraft) {
  const current = compileObservedContent(tree, fonts, svg);
  if (saved.status === 'compiled-comparison-draft' && canonicalJson(current) === canonicalJson(saved)) return { content: current };
  if (saved.version === 1 && saved.status === 'compiled-comparison-draft' &&
      flatten(tree).every(({ node }) => node.style.opacity === '1' && Object.keys(node.pseudo).length === 0)) {
    const legacy = compileContent(tree, fonts, svg, false, [], true);
    if (legacy.status === 'compiled-comparison-draft' && canonicalJson(legacy) === canonicalJson(saved))
      return { content: legacy, sourceCompatibility: 'identity-opacity-omission' as const };
  }
  throw Error('react-comparison-compiler-changed');
}

function compileContent(tree: CapturedNode, fonts: TextFontEvidence, svg: SvgViewportEvidence | undefined,
  includeSourcePaths: boolean, preserveTextBoxes: string[], omitIdentityOpacity: boolean): ObservedContentDraft {
  const out: ObservedContentDraft = {
    version: 1, status: 'refused', qualification: 'observed-comparison-content-only', acceptedContract: null,
    nativeQualification: 'unqualified', inputRevision: revisionOf({ tree, fonts, ...(svg ? { svg } : {}),
      ...(preserveTextBoxes.length ? { preserveTextBoxes } : {}) }), treeRevision: revisionOf(tree), fontsRevision: revisionOf(fonts),
    receipts: [], residuals: [], problems: [], limitations: [
      'comparison-snapshot-not-reusable-anatomy', 'nested-component-identity-not-projected',
      'sample-geometry-not-a-reusable-constraint', 'native-font-metrics-not-verified',
      'native-content-not-written-or-observed', 'visual-fidelity-not-verified',
    ],
  };
  try {
    const root = prepareObservedContentTree(tree, fonts, svg);
    const name = 'ObservedContent';
    const contract = ContractSchema.parse({ id: 'observed.content', name, version: '0.1.0', status: 'draft',
      description: 'Observed caller composition for comparison only; no reusable component API is inferred.', props: [], states: [],
      semantics: { element: root.tag }, anatomy: { root: {} },
      bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: '@private/observed-content', export: name } } },
    });
    const enumeration = enumerate([], [], 1, {}), key = enumeration.combos[0].key;
    const space: PropSpace = { contract, axes: [], presence: new Map(), stateProps: [], enumeration, baseComboKey: key, baseAxisValues: {}, heldFixed: [] };
    const comp: ComponentConfig = { name, importName: name, contract: '', sampleText: '', axes: [] };
    const sweep = { captures: [{ combo: `${name}:${key}`, interaction: 'default', root }] } as SweepResult;
    Object.assign(out, compileContentSweep(space, comp, sweep, [], includeSourcePaths, preserveTextBoxes, omitIdentityOpacity));
    if (!out.problems.length) out.status = 'compiled-comparison-draft';
  } catch (error) {
    out.problems.push(error instanceof Error ? error.message : 'observed-content-compiler-failed');
  }
  return out;
}

/** Shared preparation for single samples and complete observed property sweeps. */
export function prepareObservedContentTree(tree: CapturedNode, fonts: TextFontEvidence, svg?: SvgViewportEvidence) {
  const root = withPaintedTextFonts(tree, fonts);
  if (svg) for (const row of verifiedSvgViewports(tree, svg)) {
    let node = root;
    for (const index of row.path) node = node.nodes.filter(c => c.t === 'el')[index].el;
    node.svgViewport = row.viewport;
  }
  const normalize = (n: CapturedNode) => {
    n.style = Object.fromEntries(Object.entries(n.style).map(([key, value]) => [key, normalizeValue(value)]));
    for (const c of n.nodes) if (c.t === 'el') normalize(c.el);
  };
  normalize(root);
  return root;
}

/** Shared anatomy/paint compiler. The caller authenticates and enumerates the
 * input domain; this routine does not turn samples into a supported source API. */
export function compileObservedContentSweep(space: PropSpace, comp: ComponentConfig, sweep: SweepResult,
  rootSizing: string[] = [], includeSourcePaths = false, preserveTextBoxes: string[] = []) {
  return compileContentSweep(space, comp, sweep, rootSizing, includeSourcePaths, preserveTextBoxes, false);
}

function compileContentSweep(space: PropSpace, comp: ComponentConfig, sweep: SweepResult,
  rootSizing: string[], includeSourcePaths: boolean, preserveTextBoxes: string[], omitIdentityOpacity: boolean) {
  const result: Pick<ObservedContentDraft, 'receipts' | 'problems' | 'residuals' | 'contract' | 'tokens' | 'assets' | 'component' | 'sourcePaths'> = {
    receipts: [], problems: [], residuals: [],
  };
  const name = comp.name;
  const aligned = alignSweep(sweep, comp, space, '');
  const promoted = promoteAnatomy(space, comp, aligned.union, 'observed-content',
    { preserveTextBoxes: new Set(preserveTextBoxes) });
  result.receipts = [...promoted.receipts];
  result.problems.push(...promoted.refusals);
  // A reconstructed viewBox is not the authored SVG viewport. Preserve the
  // diagnostic receipt, but never allow that guess to authorize a write.
  if (promoted.receipts.some(r => /^svg-viewbox-(?:reconstructed|bumped|circle-offset|unified):/.test(r)))
    result.problems.push('observed-content-svg-authored-viewport-required');
  const styled = new Map(aligned.baseFlat.map(e => [e.partName, new Set(Object.keys(e.node.style).filter(c => !reactRootStyleExclusion(c) || e.partName === 'root' && rootSizing.includes(c)))]));
  if (omitIdentityOpacity) for (const channels of styled.values()) channels.delete('opacity');
  const consumed = new Set([...promoted.consumed].map(i => aligned.partNames[i]));
  const layout = enrichLayout(aligned, space, styled, promoted.contract);
  if (layout.contradictions.length) result.problems.push('observed-content-layout-contradiction');
  const prep = prepareMint(aligned, comp, space, styled, [], layout.handled, promoted.contract, consumed, new Set(promoted.partIndex.keys()), promoted.gridMintRefusals);
  result.residuals = prep.codeOnly;
  const minted = mintTokens(name, prep.baseObs, prep.axes, { nestedPairs: true });
  const states = mintTokens(name, prep.stateObs, prep.axes, { nestedPairs: true });
  const applied = applyMintToContract(promoted.contract, space, minted, prep.baseObs, states, prep.stateObs,
    layout.enriched, prep.declared, prep.declaredStates, prep.setPlaneLiterals,
    { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas }, prep.stateCodeOnly);
  result.contract = ContractSchema.parse(applied.enriched);
  result.tokens = structuredClone(minted.tree);
  result.assets = [...promoted.assets];
  const engine = createFigmaEngine({ tokens: { primitives: result.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: promoted.assets });
  result.component = engine.compileComponentData(result.contract, new Map([[result.contract.id, result.contract]]));
  if (includeSourcePaths) {
    const specs = new Map<string, Array<{ specPath: number[]; type: string }>>();
    const walk = (node: ComponentData['variants'][number]['spec'], specPath: number[]) => {
      specs.set(node.name, [...(specs.get(node.name) ?? []), { specPath, type: node.type }]);
      node.children?.forEach((child, i) => walk(child, [...specPath, i]));
    };
    walk(result.component.variants[0].spec, []);
    result.sourcePaths = [];
    for (const [partName, index] of promoted.partIndex) {
      const entry = aligned.union.entries[index], found = specs.get(partName) ?? [];
      // These are names assigned by this exact anatomy promotion, never names
      // recovered heuristically from source tags/classes or canvas layers.
      if (entry && !promoted.consumed.has(index) && found.length === 1)
        result.sourcePaths.push({ sourcePath: entry.repPath, partName, ...found[0] });
    }
  }
  return result;
}
