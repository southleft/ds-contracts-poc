/** One observed caller composition, compiled through the existing computed
 * anatomy/layout/token pipeline. This is a comparison snapshot, never a main
 * component definition or evidence of reusable nested component semantics.
 */
import { revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine, type ComponentData } from '../core/emit-figma-script.js';
import { mintTokens } from '../core/mint-tokens.js';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { enumerate, normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
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
  receipts: string[];
  residuals: ReturnType<typeof prepareMint>['codeOnly'];
  problems: string[];
  limitations: string[];
}

export function compileObservedContent(tree: CapturedNode, fonts: TextFontEvidence, svg?: SvgViewportEvidence): ObservedContentDraft {
  const out: ObservedContentDraft = {
    version: 1, status: 'refused', qualification: 'observed-comparison-content-only', acceptedContract: null,
    nativeQualification: 'unqualified', inputRevision: revisionOf({ tree, fonts, ...(svg ? { svg } : {}) }), treeRevision: revisionOf(tree), fontsRevision: revisionOf(fonts),
    receipts: [], residuals: [], problems: [], limitations: [
      'comparison-snapshot-not-reusable-anatomy', 'nested-component-identity-not-projected',
      'sample-geometry-not-a-reusable-constraint', 'native-font-metrics-not-verified',
      'native-content-not-written-or-observed', 'visual-fidelity-not-verified',
    ],
  };
  try {
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
    const aligned = alignSweep(sweep, comp, space, '');
    const promoted = promoteAnatomy(space, comp, aligned.union, 'observed-content');
    out.receipts = [...promoted.receipts];
    out.problems.push(...promoted.refusals);
    // A reconstructed viewBox is not the authored SVG viewport. Preserve the
    // diagnostic receipt, but never allow that guess to authorize a write.
    if (promoted.receipts.some(r => /^svg-viewbox-(?:reconstructed|bumped|circle-offset|unified):/.test(r)))
      out.problems.push('observed-content-svg-authored-viewport-required');
    const styled = new Map(aligned.baseFlat.map(e => [e.partName, new Set(Object.keys(e.node.style).filter(c => !reactRootStyleExclusion(c)))]));
    const consumed = new Set([...promoted.consumed].map(i => aligned.partNames[i]));
    const layout = enrichLayout(aligned, space, styled, promoted.contract);
    if (layout.contradictions.length) out.problems.push('observed-content-layout-contradiction');
    const prep = prepareMint(aligned, comp, space, styled, [], layout.handled, promoted.contract, consumed, new Set(promoted.partIndex.keys()), promoted.gridMintRefusals);
    out.residuals = prep.codeOnly;
    const minted = mintTokens(name, prep.baseObs, prep.axes, { nestedPairs: true });
    const states = mintTokens(name, prep.stateObs, prep.axes, { nestedPairs: true });
    const applied = applyMintToContract(promoted.contract, space, minted, prep.baseObs, states, prep.stateObs,
      layout.enriched, prep.declared, prep.declaredStates, prep.setPlaneLiterals,
      { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas }, prep.stateCodeOnly);
    out.contract = ContractSchema.parse(applied.enriched);
    out.tokens = structuredClone(minted.tree);
    out.assets = [...promoted.assets];
    const engine = createFigmaEngine({ tokens: { primitives: out.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: promoted.assets });
    out.component = engine.compileComponentData(out.contract, new Map([[out.contract.id, out.contract]]));
    if (!out.problems.length) out.status = 'compiled-comparison-draft';
  } catch (error) {
    out.problems.push(error instanceof Error ? error.message : 'observed-content-compiler-failed');
  }
  return out;
}
