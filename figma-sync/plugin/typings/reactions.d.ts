/**
 * VENDORED SUBSET — Figma Plugin API prototyping (Reaction) types.
 *
 * Provenance: @figma/plugin-typings@1.131.0 (npm), file `plugin-api.d.ts`,
 * lines 5455-5462 (Reaction), 5501-5560 (Action), 5561-5586 (Transition),
 * 5586-5613 (Trigger), 5614 (Navigation), 8873-9033 (ReactionMixin).
 * Copied verbatim except for the doc comments, which are ours.
 *
 * WHY VENDORED rather than a devDependency: the repo has no TypeScript that
 * is compiled against the `figma` global — the plugin runtime is emitted as
 * STRINGS by core/emit-figma-script.ts and executed inside Figma (or the
 * headless mock). A full typings package would be an unused 1MB dependency;
 * this subset exists as the CHECKED-IN EVIDENCE for the shapes the emitter
 * writes, so a future reader can verify the wiring without a network fetch.
 * Re-verify against a newer release by re-reading the line ranges above.
 *
 * PROTOTYPE-WIRING ROUND facts this file pins:
 *   - `Reaction.actions` is the live field; `Reaction.action` is DEPRECATED.
 *   - `trigger` may be null; ON_HOVER / ON_PRESS take NO extra fields (unlike
 *     MOUSE_ENTER/MOUSE_LEAVE, which require `delay` + `deprecatedVersion`).
 *   - A variant-swap action is `{type:'NODE', navigation:'CHANGE_TO'}`; the
 *     three required fields are destinationId, navigation, transition.
 *   - `transition: null` is LEGAL and means "no animation" — durations are
 *     not contract facts, so the emitter always writes null.
 *   - `ReactionMixin.reactions` is `ReadonlyArray<Reaction>`; the supported
 *     write path is `setReactionsAsync`. Figma's own doc comment states the
 *     property is read-only when the manifest declares
 *     `"documentAccess": "dynamic-page"`. Our manifest does NOT, so plain
 *     assignment would currently work in real Figma — the emitter still uses
 *     setReactionsAsync because it is correct under BOTH manifest modes, and
 *     the headless mock enforces that discipline (see the named deviation in
 *     scripts/plugin-engine-mock-figma.mjs).
 */

export type FigmaNavigation = 'NAVIGATE' | 'SWAP' | 'OVERLAY' | 'SCROLL_TO' | 'CHANGE_TO';

export type FigmaEasing = { readonly type: string };

export interface FigmaSimpleTransition {
  readonly type: 'DISSOLVE' | 'SMART_ANIMATE' | 'SCROLL_ANIMATE';
  readonly easing: FigmaEasing;
  readonly duration: number;
}

export interface FigmaDirectionalTransition {
  readonly type: 'MOVE_IN' | 'MOVE_OUT' | 'PUSH' | 'SLIDE_IN' | 'SLIDE_OUT';
  readonly direction: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
  readonly matchLayers: boolean;
  readonly easing: FigmaEasing;
  readonly duration: number;
}

export type FigmaTransition = FigmaSimpleTransition | FigmaDirectionalTransition;

/** The subset of `Action` the emitter writes. The full union also covers
 *  BACK/CLOSE, URL, UPDATE_MEDIA_RUNTIME, SET_VARIABLE, SET_VARIABLE_MODE
 *  and CONDITIONAL — none of which are contract-expressible. */
export interface FigmaNodeAction {
  readonly type: 'NODE';
  readonly destinationId: string | null;
  readonly navigation: FigmaNavigation;
  readonly transition: FigmaTransition | null;
  /** @deprecated upstream; never emitted. */
  readonly preserveScrollPosition?: boolean;
  readonly overlayRelativePosition?: { x: number; y: number };
  readonly resetVideoPosition?: boolean;
  readonly resetScrollPosition?: boolean;
  readonly resetInteractiveComponents?: boolean;
}

/** The subset of `Trigger` the emitter writes. ON_CLICK and ON_DRAG share the
 *  same zero-field shape; every other trigger carries extra required fields. */
export type FigmaTrigger = {
  readonly type: 'ON_CLICK' | 'ON_HOVER' | 'ON_PRESS' | 'ON_DRAG';
};

export type FigmaReaction = {
  /** @deprecated upstream — use `actions`. Never emitted. */
  action?: FigmaNodeAction;
  actions?: FigmaNodeAction[];
  trigger: FigmaTrigger | null;
};

export interface FigmaReactionMixin {
  /** Read-only under `documentAccess: dynamic-page`; always readable. */
  readonly reactions: ReadonlyArray<FigmaReaction>;
  setReactionsAsync(reactions: Array<FigmaReaction>): Promise<void>;
}
