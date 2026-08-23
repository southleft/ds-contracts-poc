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
export { generateCss, stripCanvasOnlyChannels } from './css.js';

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
