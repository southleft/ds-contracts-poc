/**
 * @ds-contracts/core — what an emitter needs from the engine, published.
 *
 * Dependency policy (enforced by scripts/verify-published-packages.mjs): this
 * package depends on @ds-contracts/schema and nothing else. No TypeScript
 * compiler, no prettier, no playwright, no node:* at import — every module
 * here is pure data-in/strings-out and browser-importable. The reference
 * repo's core/tokens.ts, core/contract-provenance.ts, core/emitter.ts and
 * extract/types.ts (kebab) are re-export shims over THIS source, so repo
 * and package cannot drift.
 */

// The emitter contract + the registry.
export {
  emitterByName,
  emitters,
  generateSurfaces,
  getEmitters,
  registerEmitter,
  type EmittedFile,
  type Emitter,
  type EmitterCtx,
} from './emitter.js';

// Token loading from JSON objects (never paths).
export {
  aliasTarget,
  collectTokenPaths,
  flattenTokens,
  makeResolveLiteral,
  px,
  pxOrNull,
  tokenInventoryFromJson,
  type TokenEntry,
  type TokenTreeInput,
} from './tokens.js';

// Naming.
export { kebab } from './naming.js';

// The analysis layer — contract facts every emitter reads (moved from the
// reference repo's core/emit-react.ts; that file re-exports these).
export {
  arrayProps,
  boolProps,
  enumProps,
  holderDeclaresPosition,
  isArrayType,
  isEnum,
  isMultiRoot,
  isVariantBool,
  namedSlots,
  namedTextProps,
  NATIVE_ROLE_HOSTS,
  numberProps,
  PART_STATE_CHANNELS,
  rootElementsOf,
  textDefault,
  textProps,
  topRootNames,
  topRoots,
  UA_MARGIN_ELEMENTS,
  UA_PAINT_CHANNELS,
  UA_PAINTED_ROOT_ELEMENTS,
} from './anatomy.js';
export { ELEMENT_META } from './elements.js';

// A2 grid — the CSS half of the layout grammar, shared by every CSS target.
export {
  GRID_SELF_ALIGN,
  gridCellPlan,
  gridChildCrossAxisDecls,
  gridGapCss,
  gridParentDecls,
  gridPlacementDecls,
  gridTemplateAreasValue,
  gridTrackCss,
  type GridCellPlan,
} from './grid.js';

// The deep referee (appends to `errors`; takes the icon map) and the shared
// stylesheet every code target emits.
export { validateContract } from './validate.js';
export { generateCss, stripCanvasOnlyChannels, finishStylesheet, lowerPseudoElementChannels } from './css.js';

// Optional provenance + stale-source state machine (browser-safe).
export {
  assertContractProvenance,
  canonicalJson,
  canonicalRevisionOf,
  markAwaitingCodeAdoption,
  revisionOf,
  type AwaitingCodeAdoption,
  type ContractProvenance,
  type ContractSourceProvenance,
  type ProvenancedContract,
} from './contract-provenance.js';

// Prop-name collisions with the platform — ONE rule for React (Omit<> on the
// base attrs type) and Web Components (no accessor shadowing HTMLElement);
// the table is extracted from @types/react + lib.dom and refused on drift by
// core/prop-collision-check.ts.
export {
  contractApiNames,
  reactDomCollisions,
  reactOmittedNote,
  reactPropsBase,
  wcHostAttributeEffect,
  wcHostCollisions,
  type ElementMeta,
} from './prop-collision.js';
export { HTML_ELEMENT_MEMBERS, PROP_COLLISION_SOURCES, REACT_ELEMENT_ATTRIBUTES, REACT_HTML_ATTRIBUTES } from './prop-collision.table.js';

// tokens.css — the custom-property sheet every code target references,
// emitted from the same DTCG trees the resolver reads (one flattener).
export {
  brandModeSelector,
  cssValueOf,
  cssVarName,
  DARK_MODE_SELECTOR,
  emitTokensCss,
  mentionedCssVars,
  referencedCssVars,
  ROOT_SELECTOR,
  tokensCssLayers,
  undefinedCssVars,
  type TokensCssLayer,
  type TokensCssOptions,
  type TokensCssPart,
  type TokensCssReport,
} from './emit-tokens-css.js';

// The grid CSS inversion — the code-side half of the A2 layout grammar
// (track / gap / area / line / self-align / auto-flow parsers that return
// facts + G7 named refusals, never throw).
export {
  GRID_STRUCTURAL_PROPS,
  parseGapPair,
  parseGridAutoFlow,
  parseGridLine,
  parseGridSelfAlign,
  parseGridTemplateAreas,
  parseGridTrackList,
  type GridAreaIR,
  type GridParseReceipts,
  type GridTrackIR,
} from './grid-css.js';

// Canvas → code: the files a target writes for one contract, the provenance
// sentence, and the proposal file-name spellings (one rule for both doors).
export {
  CODE_TARGET_LABELS,
  canvasCodePlan,
  contractFileNameForId,
  flatIdStem,
  mintedTokensFileNameForId,
  plannedCodePaths,
  proposalFileNameForId,
  provenanceHeadline,
  provenanceSentence,
  type CanvasProvenance,
  type CodePathOptions,
  type CodePlan,
} from './canvas-code-plan.js';

// Shared Figma name spellings.
export { camel, canonicalPropName } from './figma-names.js';

// REQUIRED FACTS PER ARCHETYPE — the refuse-to-mint referee. Per archetype,
// the load-bearing facts a set must carry before it may be minted; a contract
// missing one is named, never silently composed.
export {
  ARCHETYPE_REQUIRED_FACTS,
  UNDECLARED_ARCHETYPE_WARNING,
  channelsOf,
  checkRequiredFacts,
  expectedWarnLine,
  generateWarnLine,
  posture,
  refusalLine,
  type ArchetypeFacts,
  type CheckOptions,
  type FactFinding,
  type FactPredicate,
  type Posture,
  type RequiredFact,
  type RequiredFactsResult,
} from './required-facts.js';
