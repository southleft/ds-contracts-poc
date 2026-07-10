/**
 * The engine is a LIBRARY — the browser-importable core.
 *
 * Everything exported here is pure: token trees, icon SVGs, and contracts go
 * in as DATA (objects and maps, never paths); generated code, sync scripts,
 * and proposed contracts come out as STRINGS. Zero node:* imports anywhere in
 * the module graph — receipted by `npm run core:browser-check`, which bundles
 * this barrel for the browser platform and fails on any node built-in.
 *
 * The CLI scripts (scripts/generate-components.ts, scripts/generate-figma.ts,
 * extract/*) are thin shells over these functions: they read the repo's
 * files, call the same code, and write the results. evals/golden.json
 * byte-guards the shells' output, so a playground that imports this barrel
 * runs the REAL pipeline — not a demo copy.
 */

// The contract itself — schema, types, shared composition helpers.
export {
  ContractSchema,
  PartSchema,
  PropSchema,
  EventSchema,
  SlotSchema,
  LayoutSchema,
  TokenRefSchema,
  STATE_PREVIEW_DEFAULT,
  STATE_PREVIEW_PROPERTY,
  STYLES_WHEN_ALLOWED,
  componentRefsOf,
  pascal,
  resolveLayout,
  slotFigmaProperty,
  slotVisibilityProperty,
  slotsOf,
  sortByDependencies,
  statePreviewLabel,
  statePreviewSubstProps,
  walkAnatomy,
  type Contract,
  type ContractEvent,
  type ComponentRef,
  type Layout,
  type Part,
  type Prop,
  type Slot,
  type WalkedPart,
} from '../scripts/contract-schema.js';

// Token loading from JSON objects (never paths).
export {
  collectTokenPaths,
  flattenTokens,
  makeResolveLiteral,
  tokenInventoryFromJson,
  type TokenEntry,
  type TokenTreeInput,
} from './tokens.js';
export { tokenCorpusFromJson, type TokenCorpus, type TokenCorpusInput, type DerivedTextStyle } from './token-corpus.js';

// Provisional token minting (unresolvable variable names → imported.* tree).
export {
  MINT_NAMESPACE,
  MINT_SHARE_THRESHOLD,
  mintTokens,
  mintedTokenCss,
  type MintAxis,
  type MintObservation,
  type MintOccurrence,
  type MintResult,
  type MintedBinding,
  type MintedEntry,
} from './mint-tokens.js';

// Code-import twin: raw literals + foreign var()s → imported.* tree.
export {
  collectRootCustomProps,
  mintFromCss,
  type CarriedVerbatimVar,
  type CodeMintBinding,
  type CodeMintFinding,
  type CodeMintResult,
} from './mint-code.js';

// Contract → code (the shipping generator's core).
export {
  emitReact,
  generateCss,
  generateStories,
  generateTsx,
  validateContract,
  type EmitCtx,
  type EmitReactResult,
} from './emit-react.js';
export { formatCss, formatTsx, PRETTIER_BASE } from './format.js';

// Contract → static HTML+CSS and inline-styles React (new emitters).
export { emitHtml, type EmitHtmlResult } from './emit-html.js';
export { emitReactInline, type EmitReactInlineCtx, type EmitReactInlineResult } from './emit-react-inline.js';

// Contract → Figma sync script.
export {
  createFigmaEngine,
  emitFigmaScript,
  type ComponentData,
  type FigmaEngine,
  type FigmaEngineInput,
  type FigmaScriptCtx,
} from './emit-figma-script.js';

// The emitter registry — pluggability as a type.
export {
  emitterByName,
  emitters,
  figmaScriptEmitter,
  htmlEmitter,
  reactEmitter,
  reactInlineEmitter,
  type EmittedFile,
  type Emitter,
  type EmitterCtx,
} from './emitter.js';

// Design → contract (proposals from a canvas dump).
export {
  componentIdSlug,
  figmaProposalsReport,
  idSlugSanitized,
  plainWordsProposalError,
  proposeBatchFromDump,
  proposeFromDump,
  proposeFromDump as proposeFromFigmaDump,
  type DumpBatchResult,
  type FigmaProposalResult,
  type SkippedSet,
  type UnboundValue,
} from './propose-figma.js';

// Code → contract (proposals from React/TSX + CSS Module source text).
export { proposeFromCode, type ProposeCodeCtx, type ProposeCodeResult } from './propose-code.js';
export { extractFromSource, type SkippedComponent, type SourceFileInput } from './extract-react-tsx.js';
export { extractAnatomy, tokenIndexFromJson, type AnatomyInput, type TokenIndex } from './extract-css-module.js';
export { proposeContract, proposalsReport, type ProposalResult, type ProposeMintOptions } from '../extract/propose.js';
