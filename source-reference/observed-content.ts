/** One observed caller composition, compiled through the existing computed
 * anatomy/layout/token pipeline. This is a comparison snapshot, never a main
 * component definition or evidence of reusable nested component semantics.
 */
import {exactUsedLayoutLength} from './layout-unit.js';
import {lowerPaddingBoxBackground} from '../core/figma-background-clip.js';
import {flattenTokens,makeResolveLiteral,pxOrNull} from '../core/tokens.js';
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
import { observedPseudoGeometry, verifiedPseudoBoxes, type PseudoBoxEvidence } from './pseudo-boxes.js';

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

/** A root paint plane belongs to the linked main, not caller content. Prove
 * the complete old snapshot becomes the fresh one by this single shared
 * lowering rule; no descendant, token, source or contract delta is ignored. */
function rootPaintRecompileMatches(saved:ObservedContentDraft,current:ObservedContentDraft):boolean {
  if(!saved.component||!saved.tokens||saved.contract?.anatomy.root.declared?.['background-clip']!=='padding-box')return false;
  const expected=structuredClone(saved),component=expected.component!;
  const facts=component.codeOnlyFacts??[],removed=facts.filter(f=>f.part==='root'&&f.kind==='declared'&&f.channel==='background-clip'&&f.value==='padding-box'&&f.reason==='Background clipping exists only in code.'&&f.variants?.count===component.variants.length&&f.variants?.of===component.variants.length);
  if(!removed.length)return false;
  const resolve=makeResolveLiteral(flattenTokens(saved.tokens));
  for(const variant of component.variants)if(!lowerPaddingBoxBackground(variant.spec,name=>{
    try{return pxOrNull(resolve(name.replaceAll('/','.')))??undefined;}catch{return undefined;}
  }))return false;
  const remaining=facts.filter(f=>!removed.includes(f));
  if(remaining.length)component.codeOnlyFacts=remaining;else delete component.codeOnlyFacts;
  const suffix=` † (${facts.length} code-only facts — see plugin report)`;
  if(!component.description.endsWith(suffix))return false;
  component.description=component.description.slice(0,-suffix.length)+(remaining.length?` † (${remaining.length} code-only facts — see plugin report)`:'');
  return canonicalJson(expected)===canonicalJson(current);
}

/** Re-open an authenticated snapshot, never adopt its stored output on trust.
 * The pre-opacity compiler omitted identity opacity. That representation is
 * recoverable only when every observed element is explicitly fully opaque,
 * and fresh compilation reproduces the ENTIRE old result exactly. Missing or
 * nonidentity opacity and pseudo content refuse. The exact shared root paint
 * lowering above is the only additional compiler transition admitted; all
 * other compiler deltas refuse.
 * New observations always use the current compiler, including opacity. */
export function recompileSavedObservedContent(tree: CapturedNode, fonts: TextFontEvidence,
  svg: SvgViewportEvidence | undefined, saved: ObservedContentDraft) {
  const current = compileObservedContent(tree, fonts, svg);
  if (saved.status === 'compiled-comparison-draft' && (canonicalJson(current) === canonicalJson(saved)||rootPaintRecompileMatches(saved,current))) return { content: current };
  if (saved.version === 1 && saved.status === 'compiled-comparison-draft' &&
      flatten(tree).every(({ node }) => node.style.opacity === '1' && Object.keys(node.pseudo).length === 0)) {
    const legacy = compileContent(tree, fonts, svg, false, [], true);
    if (legacy.status === 'compiled-comparison-draft' && (canonicalJson(legacy) === canonicalJson(saved)||rootPaintRecompileMatches(saved,legacy)))
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
export function prepareObservedContentTree(tree: CapturedNode, fonts: TextFontEvidence, svg?: SvgViewportEvidence, pseudos?: PseudoBoxEvidence) {
  const root = withPaintedTextFonts(tree, fonts);
  if (pseudos) for (const row of verifiedPseudoBoxes(tree, pseudos)) {
    let node = root;
    for (const index of row.path) node = node.nodes.filter(c => c.t === 'el')[index].el;
    node.pseudoGeometry = { ...node.pseudoGeometry, [row.pseudo]: observedPseudoGeometry(row) };
  }
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
  rootSizing: string[] = [], includeSourcePaths = false, preserveTextBoxes: string[] = [], partSizing?: PartSizing) {
  // A six-digit CSSOM serialization can fall below its actual layout unit:
  // writing 18.3906px back to CSS lays out at 18.375px, not 1177/64px.
  // Only sizes already proved own and fixed are recovered. Keep sealed input
  // observations and the caller's source-variable evidence unchanged.
  const copies = structuredClone(sweep), recovered: string[] = [];
  for (const capture of copies.captures) {
    const key = capture.combo.startsWith(comp.name + ':') ? capture.combo.slice(comp.name.length + 1) : undefined;
    for (const row of flatten(capture.root)) {
      const channels = row.path === '' ? rootSizing : key === undefined ? [] : [...(partSizing?.get(key)?.get(row.path) ?? [])];
      for (const channel of channels) {
        if (channel !== 'width' && channel !== 'height') continue;
        const used = row.node.style[channel], exact = exactUsedLayoutLength(used ?? '');
        if (exact === undefined) throw Error(`observed-content-used-size-unqualified:${row.path || 'root'}:${channel}`);
        if (exact !== used) recovered.push(`layout-unit-size:${capture.combo}:${row.path || 'root'}:${channel}:${used}->${exact}`);
        row.node.style[channel] = exact;
      }
    }
  }
  const result = compileContentSweep(space, comp, copies, rootSizing, includeSourcePaths, preserveTextBoxes, false, partSizing);
  result.receipts.push(...recovered);
  return result;
}
/** Combination key → element path below the capture root → the size channels
 * the CALLER proved are that element's own used declarations in that plane. */
export type PartSizing = Map<string, Map<string, ReadonlySet<string>>>;

function compileContentSweep(space: PropSpace, comp: ComponentConfig, sweep: SweepResult,
  rootSizing: string[], includeSourcePaths: boolean, preserveTextBoxes: string[], omitIdentityOpacity: boolean, partSizing?: PartSizing) {
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
  // A part below the root keeps the sample-geometry exclusion unless its size is
  // proved own in EVERY plane where the part exists; a part sized in some planes only refuses.
  const partSized = new Map<string, Set<string>>();
  if (partSizing) aligned.partNames.forEach((partName, pi) => {
    for (const channel of ['width', 'height']) {
      const proved = [...partSizing].flatMap(([key, sizing]) => {
        const el = aligned.getAligned(`${key}__default`)[pi];
        return el ? [sizing.get(el.path)?.has(channel) === true] : [];
      });
      if (proved.length && proved.every(Boolean)) (partSized.get(partName) ?? partSized.set(partName, new Set()).get(partName)!).add(channel);
      else if (proved.some(Boolean)) result.problems.push('observed-content-part-sizing-mixed:' + channel);
    }
  });
  const styled = new Map(aligned.baseFlat.map(e => [e.partName, new Set(Object.keys(e.node.style).filter(c => !reactRootStyleExclusion(c) ||
    e.partName === 'root' && rootSizing.includes(c) || partSized.get(e.partName)?.has(c)))]));
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
