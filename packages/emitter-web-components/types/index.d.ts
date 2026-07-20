/**
 * @ds-contracts/emitter-web-components — public type surface.
 *
 * Structural declarations of the registry shapes (core/emitter.ts's
 * Emitter/EmittedFile and the ctx fields this emitter reads), so the
 * package typechecks standalone; TypeScript's structural typing makes the
 * default export assignable to the repo's `Emitter` without a cross-package
 * type dependency.
 */

export interface EmittedFile {
  /** Suggested file name (relative), e.g. "ds-badge.ts". */
  path: string;
  contents: string;
}

/** The subset of the registry's EmitterCtx this emitter reads. */
export interface WcEmitCtx {
  /** Icon asset name → SVG markup. */
  icons: Map<string, string>;
  /** Every known contract by id — composition refs resolve through it. */
  contracts: Map<string, unknown>;
}

export interface Emitter {
  name: string;
  label: string;
  emit(contract: unknown, ctx: WcEmitCtx & Record<string, unknown>): EmittedFile[];
}

export interface EmitWcResult {
  /** <tag>.ts — the element class module (registers on import). */
  element: string;
  /** <tag>.css.ts — the constructable-stylesheet module. */
  stylesheet: string;
  /** <tag>.demo.html — the showcase grid. */
  demo: string;
  /** <tag>.custom-elements.json — the deterministic manifest. */
  manifest: string;
}

/** "ds.badge" → "ds-badge" — the contract id is the tag. */
export declare function tagOf(contract: { id: string }): string;
/** "Badge" → "BadgeElement". */
export declare function classNameOf(contract: { name: string }): string;
/** Canonical prop name → DOM attribute ("toneAndProgress" → "tone-and-progress"). */
export declare function attrOf(name: string): string;
/** DOM attribute → canonical prop name (the inverse mapping). */
export declare function propFromAttr(attr: string): string;
/** The contract's anatomy compiled to shadow-scoped CSS text. */
export declare function shadowCss(contract: unknown): string;
/** Contract → { element, stylesheet, demo, manifest } file texts. */
export declare function emitWebComponent(contract: unknown, ctx: WcEmitCtx): EmitWcResult;

export declare const webComponentsEmitter: Emitter;
declare const _default: Emitter;
export default _default;
