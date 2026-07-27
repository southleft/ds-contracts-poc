/**
 * COMPUTED-CAPTURE FLOOR — config + capture sweep (DESIGN §1–§3).
 *
 * Config-driven generalization of the spike's phase 1 (extract/computed-spike/
 * run.ts): the library mount recipe, component list, and axis selection live
 * in a JSON config; the PROP SPACE comes from the static extraction's
 * contract (the capture tool never re-derives the API); enumeration follows
 * §1.4 (full cartesian ≤ limit, else per-axis+pairwise with the ≥3-axis
 * certificate); states are driven the visual-parity way (§2); the read is the
 * browser's full longhand enumeration — no whitelist (§3.1); normalization
 * and environment pinning per §3.2/§3.3. Double-run byte-identity is a
 * REQUIRED self-check (asserted by the orchestrator, extract/computed/run.ts).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright-core';
import { ContractSchema, CONTRACT_STATES, type Contract } from '../../scripts/contract-schema.js';
import { DRAFT_MARKER_KEY, draftRefusalMessage } from '../draft-capture-config.js';
import {
  enumerate,
  mintedLeafCount,
  normalizeNode,
  type CapturedNode,
  type Capture,
  type Combo,
  type EnumAxisSpec,
  type EnumerationResult,
  type StateAxisSpec,
} from './lib.js';

// ---------------------------------------------------------------------------
// Config (extract/computed/configs/*.json)
// ---------------------------------------------------------------------------
export interface TriageRule {
  part: string;
  channels: string[];
  /** Axis-value conditions: every listed axis must match (`in`) / must not
   *  match (`notIn`) for the rule to apply. Omit = any combo. */
  when?: Record<string, { in?: string[]; notIn?: string[] }>;
  cause: string;
}

/** Round 4 (owner directive): a STRUCTURE-CREATING optional prop — a prop
 *  whose PRESENCE creates DOM subtrees (Banner onDismiss → dismiss button,
 *  Tag onRemove → the ×, TextField prefix). Participates as a 2-value axis
 *  ('off' | 'on'); the fusion promotes it into the enriched contract as a
 *  BOOLEAN prop and the created subtree as parts gated by visibleWhen /
 *  stylesWhen display:none. */
export interface PresenceProp {
  /** Canonical (contract-side) boolean prop name, e.g. "dismissible". Added
   *  to the enriched contract by the fusion when absent. */
  prop: string;
  /** The library prop that carries the value when ON (e.g. "onDismiss"). */
  libraryProp: string;
  /** Value mounted when ON. Marker grammar (resolved in the harness entry):
   *    {"$callback": true}          → () => {}
   *    {"$import": "pkg#Export"}    → the named import (icon sources)
   *    anything else                → the JSON value verbatim */
  value: unknown;
}

/** ORGANISM round (Table): one node of the canonical-children tree.
 *
 *  MOLECULE round shipped a STRICTLY ONE-LEVEL list (`<Tabs><Tab/><Tab/></Tabs>`);
 *  a composed organism is a TREE (`<Table><TableHead><TableRow><TableCell>
 *  <Checkbox/></TableCell>…`). `children` recurses; the marker grammar
 *  ($callback/$import/$render) is resolved at EVERY depth, and every
 *  referenced export is imported at every depth.
 *
 *  `children` and `text` are MUTUALLY EXCLUSIVE on one node (refused at load
 *  by name) — a node is either a text leaf or a composition. */
export interface ChildSpec {
  importName: string;
  props?: Record<string, unknown>;
  text?: string;
  children?: ChildSpec[];
}

/** Depth-first walk of a childrenSpec forest (config order preserved). */
export const walkChildSpecs = (specs: ChildSpec[] | undefined): ChildSpec[] => {
  const out: ChildSpec[] = [];
  const rec = (list: ChildSpec[]): void => {
    for (const c of list) {
      out.push(c);
      if (c.children) rec(c.children);
    }
  };
  rec(specs ?? []);
  return out;
};

export interface ComponentConfig {
  /** Display name; also the CSS-module stem prefix stripped in part naming. */
  name: string;
  /** Named export mounted from `library.package`. */
  importName: string;
  /** Repo-relative path to the static extraction's contract/proposal — the
   *  prop-space source. */
  contract: string;
  /** children sample text (deterministic, recorded in provenance). */
  sampleText: string;
  /** Enum prop names that ENUMERATE as axes. Every other prop is held at its
   *  default and receipted (axes-held-fixed). A defaultless enum axis gets
   *  the `unsetLabel` pseudo-value prepended (S2). */
  axes: string[];
  /** Round 4: contract-side enum axis value → LIBRARY value mounted for it
   *  (Checkbox checked: unchecked→false, checked→true,
   *  indeterminate→"indeterminate"). Unlisted values mount verbatim.
   *
   *  ORGANISM round — MULTI-PROP AXIS VALUES: a mapped value of the shape
   *  `{"$props": {libProp: value, …}}` mounts THOSE library props instead of
   *  the axis prop itself. One contract axis, several library props: MUI's
   *  Checkbox spells its tri-state as TWO independent booleans
   *  (`checked` + `indeterminate`), and the single-axis rule is not a
   *  cosmetic preference — the svg-content promotion carries per-value icon
   *  assets only when the markup is a function of exactly ONE axis
   *  (`svg-content-multi-axis` refusal otherwise), so a two-axis spelling
   *  would silently lose all three checkbox glyphs. Still pure JSON. */
  axisValueMap?: Record<string, Record<string, unknown>>;
  /** Round 4: structure-creating optional props (see PresenceProp). */
  presenceProps?: PresenceProp[];
  /** Boolean props driven as states (Button `disabled`): 2-value axes AND
   *  state guards (§2). May name props absent from the contract when the
   *  contract declares the STATE instead (Button declares states:[disabled]
   *  with no disabled prop — the React surface accepts the prop). */
  stateProps?: StateAxisSpec[];
  /** Props pinned to fixed values on every mount (recorded). MOLECULE round:
   *  widened from scalars — arrays/objects mount verbatim through the marker
   *  grammar (Autocomplete options/value), and the `$render` marker mounts
   *  the ONLY function shape the vocabulary admits: {"$render":"pkg#Export"}
   *  → (params) => <Export {...params} /> — the identity render-prop
   *  (Autocomplete's required renderInput). Any richer function body is a
   *  named refusal, never config. */
  fixedProps?: Record<string, unknown>;
  /** MUI round (Card live finding): the library's CANONICAL child
   *  composition — sampleText mounts wrapped in this imported component
   *  (<Card><CardContent>text</CardContent></Card>). A bare mount that no
   *  real consumer writes captures a truth nobody ships (MUI's flush,
   *  padding-less Card); the canonical composition IS the component's
   *  rendered contract. Recorded in provenance. */
  childWrap?: { importName: string };
  /** MOLECULE round (Tabs/Accordion/Menu): canonical MULTI-child composition
   *  — components whose canonical children are SEVERAL imported components
   *  (<Tabs><Tab/><Tab/><Tab/></Tabs>, <Accordion><AccordionSummary/>
   *  <AccordionDetails/></Accordion>). Each entry mounts in order as
   *  <Import {...props}>text?</Import>; props use the marker grammar.
   *  Mutually exclusive with childWrap (refused at load). Recorded in
   *  provenance; sampleText is '' for these components. */
  childrenSpec?: ChildSpec[];
  /** MUI round (Card live finding #2): mount the stage as a BLOCK context
   *  instead of the default flex row. A display:block component inside the
   *  flex stage shrink-to-fits (the 114px Card) — CSS-true block behavior
   *  needs a block formatting context so width:auto fills the stage. Only
   *  block-rooted components need this; flex stages stay the default (the
   *  line-box-strut receipt). */
  blockStage?: boolean;
  /** Round 4: per-component stage override (Banner's promoted anatomy —
   *  dismiss + action row — needs a taller stage than the global default;
   *  the same stage is used by capture, replay, and the gate). */
  stage?: { width: number; height: number; padding: number };
  /** Function-typed required props stubbed to () => {} (verify.ts
   *  needsOnChange, generalized). */
  callbackProps?: string[];
  /** Base combo axis values; defaults to each axis prop's contract default
   *  (unset pseudo-value for defaultless axes). */
  baseCombo?: Record<string, string>;
  /** Named-cause triage for binding contradictions (the verify.ts curation
   *  discipline: a mismatch without a committed named cause is a defect). */
  triage?: TriageRule[];
  /** DEPTH BUILD — Stage A (portal-aware capture). When true, the component is
   *  captured by the whole-document BASELINE-DIFF reader (capturePortalRoots)
   *  instead of the in-stage `stage.firstElementChild` read: the component's
   *  DOM contribution is found wherever React put it (portals to document.body
   *  included). Overlay components (Modal, Popover) require this — their real
   *  surface renders in a portal the in-stage reader never sees (ADVANCED-PROBE
   *  N1). Absent/false on the committed 12 → their capture path is unchanged. */
  portalCapture?: boolean;
  /** DEPTH BUILD — Stage A (open-driver channel). The props that drive the
   *  component into its RENDERED / overlay state so its portaled content EXISTS
   *  at mount: Modal `open`, Popover `active`, plus the JSON content props that
   *  populate the overlay (title, primaryAction, secondaryActions). Values use
   *  the same marker grammar as presence props (`{"$callback":true}` → () => {},
   *  `{"$import":"pkg#Export"}` → the named import); driven on every mount of a
   *  portalCapture component. This is NOT a slot / render-prop channel (that is
   *  Stage C `renderChildren`) — only JSON-expressible open/content props. */
  openDriver?: Record<string, unknown>;
}

export interface CaptureConfig {
  library: {
    package: string;
    version: string;
    framework: 'react';
    /** CSS-module class prefix stripped for signatures ("Polaris-"). */
    classPrefix: string;
    /** Phase B (StyleX/atomic systems): keep ONLY classes matching this
     *  regex when serializing captures. Hashed atomic classes (StyleX x1…)
     *  and bare variant-value tokens otherwise pollute signatures — one
     *  stable per-component class (astryx-*) is the identity that matters.
     *  Absent = keep everything (Polaris behavior, byte-unchanged). */
    classAllow?: string;
    /** EMOTION/CSS-VARS READER: custom-property prefix ("--mui-") whose
     *  var() references in matching CSSOM rules are captured as SOURCE
     *  bindings (CapturedNode.vrefs). Absent = reader off (every committed
     *  library; captures stay byte-identical). */
    varPrefix?: string;
    /** SHADOW-DOM ROUND (Altitude): the library ships CUSTOM ELEMENTS, not
     *  React components. `importName` is then a TAG NAME ("al-button") and the
     *  harness mounts `React.createElement('al-button', props, children)`
     *  instead of importing a named export — React passes unknown props
     *  straight through as ATTRIBUTES, which is exactly the custom-element
     *  contract. Two consequences the mount honors:
     *    · a `false` boolean prop is OMITTED, never rendered as `="false"`
     *      (Lit's `type: Boolean` reads ATTRIBUTE PRESENCE — `isDisabled=
     *      "false"` is TRUE), so booleans ride the axis/state machinery's
     *      absent-value path;
     *    · nothing is imported from `library.package` for the component
     *      itself; the package is imported once for its registration side
     *      effect via `mount.imports`.
     *  Absent/false on every React library — their harness page is unchanged. */
    customElements?: boolean;
  };
  mount: {
    /** Raw import lines for providers/locale/stylesheet. */
    imports: string[];
    /** Provider JSX wrapped around every stage ('' = none). */
    wrapperOpen: string;
    wrapperClose: string;
    /** SHADOW-DOM ROUND (Altitude): stylesheets inlined into the harness
     *  page's <head> as `<style id="…">` BEFORE the bundle runs.
     *
     *  Why this cannot be an `import` line: Altitude's `ALElement` looks up
     *  `style#al-theme-sheet` on its FIRST `connectedCallback` and adopts a
     *  stripped copy into every shadow root — the sheet must already be in
     *  the document when the library's registration side effect upgrades the
     *  first element, and ES imports are hoisted above any statement that
     *  could inject it. A general mechanism: any library whose global theme
     *  is discovered by DOM id/selector at upgrade time needs it.
     *
     *  `files` are HARNESS-relative (e.g. "node_modules/<pkg>/dist/css/…"),
     *  concatenated in order. `@import` rules are ALWAYS stripped — the
     *  harness is network-free and a surviving `@import` is a live fetch.
     *  The strip is QUOTED-STRING AWARE by necessity, see stripAtImports. */
    headStyles?: Array<{ id?: string; files: string[] }>;
    /** SHADOW-DOM ROUND (Altitude): raw JS statements emitted into an inline
     *  <script> in <head>, i.e. BEFORE the module bundle evaluates. The
     *  general need is a GLOBAL FLAG a library reads at import time
     *  (`globalThis.alAutoRegistry = true` selects Altitude's unsuffixed
     *  custom-element tag names). An `imports` line cannot do this: ES import
     *  hoisting runs the library first. */
    preScript?: string[];
  };
  /** DTCG token files whose custom-property spellings the bound-probe and
   *  the fidelity gate resolve against (repo-relative). */
  tokens: {
    dtcg: string[];
    css: string;
    /** The library's SHIPPED minted tree (`examples/<lib>/tokens/<lib>-minted
     *  .dtcg.json`) — the `imported.*` leaves a PREVIOUS round promoted.
     *
     *  GATE-INVENTORY FIX (task #21, docs/20-regate-drift.md): a shipped
     *  contract's REVIEWED layer binds those leaves, and fusion preserves
     *  reviewed bindings by design — so a fresh run mints AROUND them and
     *  never re-creates them. A gate whose inventory is base + fresh mint
     *  only therefore scores the SHIPPED truth against a token set the
     *  shipped contract was never promoted against: the refs render as EMPTY
     *  custom properties (black text, missing fills) and the score falls
     *  silently (astryx Slider measured 55.299 with 44 such refs, every one
     *  of them present in the shipped tree). The gate merges this tree UNDER
     *  the fresh mint — fresh wins, divergences are NAMED in the scorecard.
     *
     *  Optional only because a library that has never promoted a minted tree
     *  has none; every library in `extract/computed/configs/` carries it and
     *  the eval `gate-inventory-shipped-minted` refuses a config that does
     *  not (an absent path is exactly how this defect stayed invisible). */
    minted?: string;
    /** ORDERING GUARD (task #28) — the BOOTSTRAP allowance, and the only way
     *  to run a gate against a minted tree with ZERO leaves.
     *
     *  The task-#21 refusal covers a minted path that does not EXIST. It does
     *  not cover the thing that actually happened on the Carbon round: the
     *  pipeline runs the harness BEFORE `promote-floor.mjs` writes
     *  `<lib>-minted.dtcg.json`, so the file was created as an empty stub to
     *  satisfy that refusal and every one of Carbon's ten committed
     *  scorecards recorded `shippedMinted.leavesAdded: 0` — a gate measured
     *  against a tree that did not exist yet. The offline re-fuse of the same
     *  captures against the SHIPPED tree measures 755–1037 leaves added. No
     *  value was wrong (every divergence resolved equal); the receipts simply
     *  understated what the gate saw.
     *
     *  So: a DECLARED minted tree with zero leaves is REFUSED BY NAME, unless
     *  this flag says the run is a library's genuine first-ever pass, in which
     *  case the scorecard records `shippedMinted.bootstrap: true` and the
     *  marker "measured without a shipped minted tree" — allowed explicitly,
     *  receipted, never silent. The flag cannot rot: once the tree HAS leaves,
     *  leaving it set is itself refused. */
    mintedBootstrap?: boolean;
  };
  /** Optional repo-relative dir of committed icon assets (`<name>.svg`) —
   *  contracts whose anatomy carries `icon.asset` refs (Spinner) need the
   *  same asset map the showcase generators use for validation + the gate. */
  icons?: string;
  browser: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    colorScheme: 'light' | 'dark';
  };
  stage: { width: number; height: number; padding: number };
  enumeration: { cartesianLimit: number; unsetLabel: string };
  components: ComponentConfig[];
}

export function loadConfig(repoRoot: string, configPath: string): CaptureConfig {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8')) as CaptureConfig;
  // DRAFT ≠ APPROVED (G6 ack discipline): a machine-drafted config carries a
  // top-level marker until a human reviews every "__review:*" field and
  // deletes it — the runner refuses by name, never captures from a draft.
  if ((cfg as unknown as Record<string, unknown>)[DRAFT_MARKER_KEY] !== undefined) {
    throw new Error(`REFUSED: ${draftRefusalMessage(configPath)}`);
  }
  // GATE-INVENTORY FIX (task #21): a MISSING shipped minted tree would drop
  // the gate silently back to fresh-mint-only inventory — the exact defect —
  // so a declared path that does not exist is refused by name at load.
  if (cfg.tokens.minted && !existsSync(path.join(repoRoot, cfg.tokens.minted))) {
    throw new Error(
      `tokens.minted not found: ${cfg.tokens.minted} — the fidelity gate would fall back to the FRESH mint only and score the shipped contract's reviewed refs as unresolved (docs/20-regate-drift.md)`,
    );
  }
  // ORDERING GUARD (task #28) — see `tokens.mintedBootstrap`. A minted tree
  // that EXISTS but carries ZERO leaves is the "gate ran before the promotion
  // wrote it" state; refuse it by name so no library can record a gate
  // measured against a tree that did not exist yet, and refuse a bootstrap
  // allowance that has outlived the tree it was granted for.
  if (cfg.tokens.minted) {
    const leaves = mintedLeafCount(
      JSON.parse(readFileSync(path.join(repoRoot, cfg.tokens.minted), 'utf8')) as Record<string, unknown>,
    );
    if (leaves === 0 && cfg.tokens.mintedBootstrap !== true) {
      throw new Error(
        `tokens.minted has ZERO leaves: ${cfg.tokens.minted} — the fidelity gate would record shippedMinted.leavesAdded: 0 for a tree the promotion has not written yet (ORDERING: the harness runs BEFORE promote-floor). Run the promotion first and re-run the harness, or declare "mintedBootstrap": true for a library's genuine FIRST-EVER pass (the scorecard then receipts "measured without a shipped minted tree")`,
      );
    }
    if (leaves > 0 && cfg.tokens.mintedBootstrap === true) {
      throw new Error(
        `tokens.mintedBootstrap is still true but ${cfg.tokens.minted} now carries ${leaves} leaf/leaves — the bootstrap allowance has outlived its reason and would silently suppress the ordering guard for every future run. Delete the flag.`,
      );
    }
  }
  for (const c of cfg.components) {
    const contractPath = path.join(repoRoot, c.contract);
    if (!existsSync(contractPath)) throw new Error(`${c.name}: contract not found: ${c.contract}`);
    if (c.childWrap && c.childrenSpec) {
      throw new Error(`${c.name}: childWrap and childrenSpec are mutually exclusive — one canonical composition per component`);
    }
    // ORGANISM round: a childrenSpec node is either a TEXT LEAF or a
    // COMPOSITION — never both (an ambiguous node would silently drop one of
    // the two in the renderer; name the refusal instead).
    for (const cs of walkChildSpecs(c.childrenSpec)) {
      if (cs.children && cs.text !== undefined) {
        throw new Error(`${c.name}: childrenSpec node "${cs.importName}" carries BOTH text and children — mutually exclusive (a node is a text leaf or a composition)`);
      }
    }
    // STATE-PLANE PROJECTION round: `stateProps[].state` is a CLOSED
    // vocabulary (CONTRACT_STATES) and JSON is cast, never checked — so the
    // TypeScript annotation on StateAxisSpec protected nothing. An
    // out-of-vocabulary state (MUI Switch declared `checked`) minted channel
    // names `<channel>-state-checked` that the mint-property parser could
    // not re-read and that NO emitter rendered: the values were captured,
    // minted into the DTCG tree, and dropped on the floor SILENTLY. Refuse
    // by name at load — a prop-selected rendering is a VARIANT AXIS
    // (`axes` + `axisValueMap`), not a pseudo-class plane.
    for (const s of c.stateProps ?? []) {
      if (!(CONTRACT_STATES as readonly string[]).includes(s.state)) {
        throw new Error(
          `${c.name}: stateProps "${s.prop}" declares state "${s.state}", which is outside the closed contract state vocabulary (${CONTRACT_STATES.join(', ')}). ` +
            `A state is a PSEUDO-CLASS plane the same instance takes without a prop changing; a rendering a prop selects is a VARIANT AXIS — model it in "axes" with an "axisValueMap" (see Checkbox/Switch).`,
        );
      }
    }
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Prop space from the contract (§1.4) — never re-derived from the library
// ---------------------------------------------------------------------------
export interface PropSpace {
  contract: Contract;
  /** ALL enumerated axes: contract enum axes first, then presence axes
   *  (values ['off','on']) in config order. */
  axes: EnumAxisSpec[];
  /** Presence-prop specs by contract prop name (subset of `axes`). */
  presence: Map<string, PresenceProp>;
  stateProps: StateAxisSpec[];
  enumeration: EnumerationResult;
  baseComboKey: string;
  /** Default axis values of the base combo (unset pseudo-values included). */
  baseAxisValues: Record<string, string>;
  /** Enum props held at defaults (receipted, not enumerated). */
  heldFixed: string[];
}

/** Presence axes enumerate 'off' | 'on' (off = prop absent — the mount's
 *  default; the fusion turns the axis into a boolean contract prop). */
export const PRESENCE_OFF = 'off';
export const PRESENCE_ON = 'on';

export function propSpaceFor(repoRoot: string, cfg: CaptureConfig, comp: ComponentConfig): PropSpace {
  const contract = ContractSchema.parse(
    JSON.parse(readFileSync(path.join(repoRoot, comp.contract), 'utf8')),
  ) as Contract;
  const unset = cfg.enumeration.unsetLabel;
  const axes: EnumAxisSpec[] = [];
  for (const name of comp.axes) {
    const prop = contract.props.find((p) => p.name === name);
    if (!prop) throw new Error(`${comp.name}: axis "${name}" is not a contract prop`);
    if (typeof prop.type !== 'object' || !('enum' in prop.type)) {
      throw new Error(`${comp.name}: axis "${name}" is not an enum prop (booleans ride stateProps; text/number never enumerate — §1.4)`);
    }
    const values = prop.type.enum;
    if (values.includes(unset)) {
      throw new Error(`${comp.name}: axis "${name}" already has a value "${unset}" — pick a different enumeration.unsetLabel`);
    }
    const defaultless = prop.default === undefined;
    axes.push({ prop: name, values: defaultless ? [unset, ...values] : [...values], ...(defaultless ? { unset } : {}) });
  }
  // Round 4: presence axes (structure-creating optional props) — 2-value
  // axes 'off'/'on'; 'off' mounts the prop ABSENT (never a false value).
  const presence = new Map<string, PresenceProp>();
  for (const pp of comp.presenceProps ?? []) {
    if (axes.some((a) => a.prop === pp.prop)) {
      throw new Error(`${comp.name}: presence prop "${pp.prop}" collides with an enum axis`);
    }
    presence.set(pp.prop, pp);
    axes.push({ prop: pp.prop, values: [PRESENCE_OFF, PRESENCE_ON] });
  }
  const stateProps = comp.stateProps ?? [];
  const heldFixed = contract.props
    .filter((p) => typeof p.type === 'object' && 'enum' in p.type && !comp.axes.includes(p.name))
    .map((p) => p.name);

  const baseAxisValues: Record<string, string> = {};
  for (const a of axes) {
    if (presence.has(a.prop)) {
      baseAxisValues[a.prop] = PRESENCE_OFF;
      continue;
    }
    const prop = contract.props.find((p) => p.name === a.prop)!;
    baseAxisValues[a.prop] = comp.baseCombo?.[a.prop] ?? (prop.default !== undefined ? String(prop.default) : unset);
  }
  const enumeration = enumerate(axes, stateProps, cfg.enumeration.cartesianLimit, baseAxisValues);
  const base = enumeration.combos.find(
    (c) =>
      axes.every((a) => c.axisValues[a.prop] === baseAxisValues[a.prop]) &&
      stateProps.every((s) => c.stateFlags[s.prop] === false),
  );
  if (!base) throw new Error(`${comp.name}: base combo not in enumeration`);
  return { contract, axes, presence, stateProps, enumeration, baseComboKey: base.key, baseAxisValues, heldFixed };
}

/** React props for one combo: axis values (unset pseudo-values OMITTED — the
 *  unset defaultless enum mounts with the prop absent, the React surface's
 *  own semantics), state flags set only when true, fixed props always. */
export function comboProps(comp: ComponentConfig, space: PropSpace, combo: Combo): Record<string, unknown> {
  const props: Record<string, unknown> = { ...(comp.fixedProps ?? {}) };
  for (const a of space.axes) {
    const v = combo.axisValues[a.prop];
    const pp = space.presence.get(a.prop);
    if (pp) {
      // presence axis: 'off' mounts the LIBRARY prop absent; 'on' mounts the
      // configured value (marker grammar resolved in the harness entry).
      if (v === PRESENCE_ON) props[pp.libraryProp] = pp.value;
      continue;
    }
    if (a.unset !== undefined && v === a.unset) continue;
    // Round 4 axisValueMap: contract axis value → library value (Checkbox
    // checked enum → boolean|'indeterminate').
    const mapped = comp.axisValueMap?.[a.prop];
    const mv = mapped && v in mapped ? mapped[v] : undefined;
    // ORGANISM round: {"$props": {…}} mounts SEVERAL library props for one
    // contract axis value (MUI Checkbox's tri-state = checked+indeterminate).
    if (mv && typeof mv === 'object' && !Array.isArray(mv) && '$props' in (mv as Record<string, unknown>)) {
      const expand = (mv as { $props: Record<string, unknown> }).$props;
      if (expand === null || typeof expand !== 'object') {
        throw new Error(`${comp.name}: axisValueMap ${a.prop}="${v}" $props must be an object of library props`);
      }
      for (const [lp, lv] of Object.entries(expand)) props[lp] = lv;
      continue;
    }
    props[a.prop] = mv !== undefined ? mv : v;
  }
  for (const s of space.stateProps) if (combo.stateFlags[s.prop]) props[s.prop] = true;
  return props;
}

// ---------------------------------------------------------------------------
// Harness page (§1.1) — one bundled page mounting every component's combos
// ---------------------------------------------------------------------------
/** Tags controls are rendered for — the in-page styled-channel probe
 *  baseline (§ "styled channels"): a captured tag without a control falls
 *  back to the span control, receipted by the fuser. */
export const CONTROL_TAGS = ['button', 'span', 'a', 'div'] as const;

export const stageFor = (cfg: CaptureConfig, comp: ComponentConfig): { width: number; height: number; padding: number } =>
  comp.stage ?? cfg.stage;

/** SHADOW-DOM ROUND (Altitude) — strip `@import` rules from a stylesheet that
 *  is about to be INLINED into the network-free harness page.
 *
 *  THE REASON THIS IS NOT `/@import[^;]+;/`. Altitude's `main.css` opens with
 *
 *      @import"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400;1,600&display=swap";
 *
 *  and the Google-Fonts URL CONTAINS SEMICOLONS. A `[^;]+` strip cuts at the
 *  first one, leaves `0,600;1,400;1,600&display=swap";` at the top of the
 *  file, and the CSS parser folds that fragment into the PRELUDE of the
 *  `:root{…}` block that follows — so the entire token block becomes an
 *  invalid selector and is dropped. Measured on the live page: 323 custom
 *  properties at `:root` → **0**, every component rendering unstyled, the
 *  page throwing nothing and logging nothing. The naive strip is a silent
 *  zero-token round; this one matches the QUOTED STRING (or `url(…)`) first
 *  and only then runs to the terminating `;`.
 *
 *  Returns the stripped text plus the count, so the caller can receipt it. */
export function stripAtImports(css: string): { css: string; stripped: number } {
  const re = /@import\s*(?:url\(\s*)?(["'])(?:(?!\1)[\s\S])*\1\s*\)?[^;]*;/g;
  let stripped = 0;
  const out = css.replace(re, () => { stripped++; return ''; });
  // A bare `@import url(unquoted);` has no quoted string — handled separately
  // (no semicolon can appear in an unquoted url() token, so `[^;]` is safe).
  const re2 = /@import\s+url\([^)"']*\)[^;]*;/g;
  const out2 = out.replace(re2, () => { stripped++; return ''; });
  return { css: out2, stripped };
}

// ---------------------------------------------------------------------------
// SHADOW-DOM ROUND (Altitude, library #8) — in-page traversal primitives.
//
// Every helper below is a GENERAL open-shadow-DOM rule, and every one of them
// is a NO-OP on a page without shadow roots: the seven committed libraries
// render entirely into light DOM, so `el.shadowRoot` is null everywhere, the
// walks visit exactly the elements `querySelectorAll` visited before, and the
// captured bytes are unchanged (proven by re-capture, see the wave report).
//
// Emitted as a JS STRING because every reader here runs through
// `page.evaluate(<string>)` — the tsx `__name` serialization trap (see
// visual-parity/render.ts).
// ---------------------------------------------------------------------------
export const SHADOW_HELPERS_JS = `
  // POLICY DECISION 1 — CAPTURED ROOT OF A SHADOW HOST: DESCEND.
  // A custom-element host in Altitude carries NO :host rule at all (measured:
  // the published 1.0.2 bundle contains exactly ONE ':host' selector in the
  // whole 65-component library, and it is not on any round-1 component), so
  // the host paints nothing, has no class stem, and computes to the UA
  // default display. Carried as the captured root it would add a nameless
  // wrapper part to every component's anatomy and hand the class-stem part
  // namer nothing to name. The element that draws the component IS the
  // shadow root's first box-drawing child (\`button.al-c-button\`,
  // \`div.al-c-badge\`, \`hr.al-c-divider\`), so that is the captured root and
  // the host chain is recorded as provenance. Loops, so a host whose shadow
  // root's first box is itself a host descends again (bounded).
  const shDrawsRects = (el) => el.getClientRects().length > 0;
  // \`tagName\` off the PROTOTYPE: a custom element may declare a reactive
  // property that SHADOWS it (altitude's al-heading declares
  // \`accessor tagName: 'h1'|…|'h6' = 'h2'\`, so \`host.tagName\` reads "h2"
  // instead of "AL-HEADING" — the host-trail receipt would have named the
  // wrong element). Identical for every ordinary element.
  const shTagOf = (el) => Object.getOwnPropertyDescriptor(Element.prototype, 'tagName').get.call(el).toLowerCase();
  const shDescendHost = (el, trail) => {
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 8) {
      const kids = [...el.shadowRoot.children];
      const pick = kids.find(shDrawsRects) || kids[0];
      if (!pick) break;
      if (trail) trail.push(shTagOf(el));
      el = pick;
    }
    return el;
  };
  // POLICY DECISION 2 — <slot>: SPLICED AWAY, replaced by assignedNodes().
  // A <slot> is SPLICED AWAY, not captured: it is a distribution point with
  // \`display: contents\` that draws no box, has no class stem, and would
  // otherwise promote into a nameless part in EVERY component's anatomy (all
  // eight round-1 Altitude components slot their text). Its rendered stand-in
  // is \`assignedNodes()\` in rendered order — falling back to its own children,
  // which is exactly what the browser draws for an unfilled slot. Walking the
  // host's LIGHT children as well would double every slotted node, so the
  // light tree is never walked directly: slotted content is reached only here.
  // \`::slotted()\` rules style the assigned elements themselves, so nothing is
  // lost by dropping the slot. Recursive — a slot may appear in another slot's
  // fallback content.
  const shSlotNodes = (slot, out) => {
    const a = typeof slot.assignedNodes === 'function' ? slot.assignedNodes() : [];
    for (const n of (a.length ? a : [...slot.childNodes])) {
      if (n.nodeType === 1 && n.tagName === 'SLOT') shSlotNodes(n, out);
      else out.push(n);
    }
    return out;
  };
  const shChildNodesOf = (el) => {
    const raw = el.shadowRoot ? [...el.shadowRoot.childNodes] : [...el.childNodes];
    if (!raw.some((n) => n.nodeType === 1 && n.tagName === 'SLOT')) return raw;
    const out = [];
    for (const n of raw) {
      if (n.nodeType === 1 && n.tagName === 'SLOT') shSlotNodes(n, out);
      else out.push(n);
    }
    return out;
  };
  // Tree-order element walk that ALSO enters open shadow roots. On a page
  // without shadow roots this yields exactly \`el, ...el.querySelectorAll('*')\`
  // in the same order.
  const shWalkEls = (el, out) => {
    out.push(el);
    if (el.shadowRoot) for (const c of el.shadowRoot.children) shWalkEls(c, out);
    for (const c of el.children) shWalkEls(c, out);
    return out;
  };
  // The interaction/capture root of one stage: the first stage child that
  // draws boxes (the Tailwind sr-only-input rule), then shadow-descended.
  const shStageRoot = (stage) => {
    if (!stage || !stage.firstElementChild) return null;
    let rootEl = stage.firstElementChild;
    for (const c of stage.children) { if (shDrawsRects(c)) { rootEl = c; break; } }
    return shDescendHost(rootEl, null);
  };
`;

export function buildHarnessPage(
  harness: string,
  cfg: CaptureConfig,
  mounts: Array<{ comp: ComponentConfig; space: PropSpace }>,
): string {
  const importNames = [...new Set([
    ...mounts.map((m) => m.comp.importName),
    ...mounts.flatMap((m) => (m.comp.childWrap ? [m.comp.childWrap.importName] : [])),
    // ORGANISM round: the childrenSpec TREE is walked — every imported export
    // at every depth must land in the mount page's import list.
    ...mounts.flatMap((m) => walkChildSpecs(m.comp.childrenSpec).map((c) => c.importName)),
  ])].sort();
  const specs = mounts.flatMap(({ comp, space }) =>
    space.enumeration.combos.map((combo) => ({
      key: `${comp.name}:${combo.key}`,
      component: comp.importName,
      props: comboProps(comp, space, combo),
      callbacks: comp.callbackProps ?? [],
      text: comp.sampleText,
      ...(comp.childWrap ? { childWrap: comp.childWrap.importName } : {}),
      ...(comp.childrenSpec ? { childrenSpec: comp.childrenSpec } : {}),
      ...(comp.blockStage ? { blockStage: true } : {}),
      stage: stageFor(cfg, comp),
    })),
  );
  // Round 4 presence-value marker grammar: collect $import values into real
  // import statements; markers resolve at mount time (resolveMarkers below).
  // MOLECULE round: $render carries the same "pkg#Export" spelling — the
  // referenced Export is imported the same way.
  const extraImports = new Map<string, Set<string>>(); // pkg → exports
  const collectImports = (v: unknown): void => {
    if (v && typeof v === 'object') {
      const rec = v as Record<string, unknown>;
      const imp = typeof rec['$import'] === 'string' ? rec['$import'] : typeof rec['$render'] === 'string' ? rec['$render'] : undefined;
      if (typeof imp === 'string') {
        const [pkg, name] = imp.split('#');
        (extraImports.get(pkg) ?? extraImports.set(pkg, new Set()).get(pkg)!).add(name);
        return;
      }
      for (const x of Object.values(v)) collectImports(x);
    }
  };
  for (const s of specs) collectImports(s.props);
  // ORGANISM round: markers inside childrenSpec props (at any depth) are
  // resolved at mount — collect their imports here too (the portal page
  // already did this; the census page did not — a latent one-level gap).
  for (const m of mounts) for (const cs of walkChildSpecs(m.comp.childrenSpec)) collectImports(cs.props ?? {});
  const extraImportLines = [...extraImports.entries()]
    .sort()
    .map(([pkg, names]) => `import { ${[...names].sort().join(', ')} } from '${pkg}';`);
  const extraNames = [...extraImports.values()].flatMap((s) => [...s]).sort();
  // display:flex + align-items:flex-start: the component is a flex item, so
  // its position never depends on the stage's own line-box strut (inherited
  // font metrics) — the mount-context receipt (spike finding; DESIGN §1.1/§4).
  // SHADOW-DOM ROUND — a custom-element library exports no component bindings
  // to import: `importName` IS the tag name and React.createElement takes the
  // tag string. The package itself is imported once, for its registration side
  // effect, through `mount.imports`.
  const ce = cfg.library.customElements === true;
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
${ce ? '' : `import { ${importNames.join(', ')} } from '${cfg.library.package}';\n`}${extraImportLines.join('\n')}
${cfg.mount.imports.join('\n')}

const CE = ${ce};
const COMPONENTS = ${ce ? JSON.stringify(Object.fromEntries(importNames.map((n) => [n, n]))) : `{ ${importNames.join(', ')} }`};
const EXTRA = { ${extraNames.join(', ')} };
// CUSTOM-ELEMENT PROP SEMANTICS (React 18 sets unknown props as ATTRIBUTES):
//   · \`false\` must be OMITTED — Lit's \`type: Boolean\` converter reads
//     ATTRIBUTE PRESENCE, so isDisabled="false" is TRUE. This is the same
//     "absent ≠ falsy" rule the unset pseudo-value already encodes for
//     defaultless enums, applied to booleans.
//   · function values are dropped — React 18 does not attach listeners to
//     custom elements and would try to stringify the function into an
//     attribute. Custom elements take events, not callback props.
const ceProps = (p) => {
  if (!CE) return p;
  const o = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v === false || v === undefined || v === null || typeof v === 'function') continue;
    o[k] = v;
  }
  return o;
};
const SPECS = ${JSON.stringify(specs)};
const stageStyle = (st, block) => ({ display: block ? 'block' : 'flex', ...(block ? {} : { alignItems: 'flex-start' }), width: st.width, height: st.height, padding: st.padding, boxSizing: 'border-box', background: '#fff', overflow: 'hidden' });
const stage = stageStyle({ width: ${cfg.stage.width}, height: ${cfg.stage.height}, padding: ${cfg.stage.padding} });

// presence-value marker grammar: {"$callback":true} → () => {};
// {"$import":"pkg#Name"} → the imported binding (resolved recursively);
// {"$render":"pkg#Name"} → (params) => <Name {...params} /> — the identity
// render-prop, the ONLY function shape admitted (MOLECULE round).
function resolveMarkers(v) {
  if (v && typeof v === 'object') {
    if (v.$callback === true) return () => {};
    if (typeof v.$import === 'string') return EXTRA[v.$import.split('#')[1]];
    if (typeof v.$render === 'string') { const K = EXTRA[v.$render.split('#')[1]]; return (params) => React.createElement(K, params); }
    if (Array.isArray(v)) return v.map(resolveMarkers);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMarkers(x);
    return out;
  }
  return v;
}

// MOLECULE round: canonical children — childWrap (one wrapped text child),
// childrenSpec (N imported children), or bare sampleText.
// ORGANISM round: childrenSpec RECURSES — a node with .children mounts its
// own child list instead of text (mutually exclusive, refused at load).
function renderKidList(list) {
  return list.map((cs, i) => React.createElement(
    COMPONENTS[cs.importName],
    { key: i, ...ceProps(resolveMarkers({ ...(cs.props || {}) })) },
    cs.children ? renderKidList(cs.children) : cs.text,
  ));
}
function renderKids(s) {
  if (s.childrenSpec) return renderKidList(s.childrenSpec);
  if (s.childWrap) { const W = COMPONENTS[s.childWrap]; return <W>{s.text}</W>; }
  // CARBON ROUND: sampleText "" means the component takes NO sample text, and
  // React does not treat that the same as an empty string — '' is a REAL child.
  // Carbon's Checkbox forwards its rest props (children included) straight onto
  // an <input>, and React refuses children on a void element: the whole tree
  // threw and the harness page rendered NOTHING (waitForSelector timeout, no
  // mention of children anywhere). Six libraries tolerated the empty child by
  // accident; one library that forwards children to a void element cannot.
  // Byte-identity for the tolerant libraries is PROVEN, not assumed — see
  // examples/carbon/PROVENANCE.md (tailwind ToggleSwitch + mui Switch
  // re-captured under this change: captured-truth.json byte-identical).
  return s.text === '' ? undefined : s.text;
}

function App() {
  return (
    ${cfg.mount.wrapperOpen}
      {SPECS.map((s) => {
        const C = COMPONENTS[s.component];
        const props0 = resolveMarkers({ ...s.props });
        for (const cb of s.callbacks) props0[cb] = () => {};
        const props = ceProps(props0);
        return (
          <React.Fragment key={s.key}>
            <button data-sentinel={s.key} style={{ width: 8, height: 8, padding: 0, border: 0, margin: 2, background: '#eee' }} aria-label="sentinel" />
            <div data-combo={s.key} style={stageStyle(s.stage, s.blockStage)}><C {...props}>{renderKids(s)}</C></div>
          </React.Fragment>
        );
      })}
      ${CONTROL_TAGS.map(
        (t) =>
          `<div data-combo="__control-${t}" style={stage}>${
            t === 'span' || t === 'div' ? `<${t}>SAMPLE</${t}>` : t === 'a' ? `<a href="#c">SAMPLE</a>` : `<button>SAMPLE</button>`
          }</div>`,
      ).join('\n      ')}
    ${cfg.mount.wrapperClose}
  );
}
createRoot(document.getElementById('root')).render(<App />);
`;
  const pageDir = path.join(harness, 'computed-capture-page');
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, 'entry.jsx'), entry);
  execFileSync(
    path.join(harness, 'node_modules', '.bin', 'esbuild'),
    [
      'computed-capture-page/entry.jsx',
      '--bundle',
      '--outfile=computed-capture-page/bundle.js',
      '--jsx=automatic',
      '--loader:.json=json',
      '--loader:.svg=dataurl',
      '--loader:.png=dataurl',
      '--log-level=error',
    ],
    { cwd: harness },
  );
  // TAILWIND ROUND: the stylesheet is INLINED, not linked — file:// pages
  // treat linked sheets as opaque origins, so document.styleSheets[n]
  // .cssRules THROWS and the CSS-vars reader sees zero rules (Emotion never
  // hit this: it injects <style> tags). Inlining keeps CSSOM readable for
  // every stylesheet-shipping library.
  const bundleCssPath = path.join(pageDir, 'bundle.css');
  const bundleCss = existsSync(bundleCssPath) ? readFileSync(bundleCssPath, 'utf8') : '';
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
${headStyleTags(harness, cfg)}${preScriptTag(cfg)}${bundleCss ? `<style>${bundleCss}</style>` : ''}
<style>html { color-scheme: ${cfg.browser.colorScheme}; } body { margin: 0; background: #ddd; }</style>
</head><body><div id="root"></div>
<script>
// Round 4: link-bearing combos (Tag url) must not NAVIGATE when the active-
// state driver's mouse.up lands — a navigation destroys the page context
// mid-sweep. :active/:hover pseudo-state matching is unaffected.
document.addEventListener('click', (e) => e.preventDefault(), true);
</script>
<script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, 'index.html');
}

/** SHADOW-DOM ROUND — `mount.headStyles` → `<style id>` tags, with `@import`
 *  stripped (network hermeticity) and every file's presence refused by name.
 *  Returns '' when the config declares none, so every committed harness page
 *  is byte-unchanged. */
export function headStyleTags(harness: string, cfg: CaptureConfig): string {
  const specs = cfg.mount.headStyles ?? [];
  if (specs.length === 0) return '';
  return specs
    .map((s) => {
      const parts = s.files.map((f) => {
        const p = path.join(harness, f);
        if (!existsSync(p)) {
          throw new Error(
            `mount.headStyles: ${f} not found under the harness (${p}) — the library's global theme sheet would be MISSING and every component would render unstyled while the page throws nothing`,
          );
        }
        return readFileSync(p, 'utf8');
      });
      const { css } = stripAtImports(parts.join('\n'));
      return `<style${s.id ? ` id="${s.id}"` : ''}>${css}</style>\n`;
    })
    .join('');
}

/** SHADOW-DOM ROUND — `mount.preScript` → one inline `<script>` in <head>,
 *  evaluated BEFORE the module bundle (global flags a library reads at import
 *  time). '' when unset — committed pages unchanged. */
export function preScriptTag(cfg: CaptureConfig): string {
  const lines = cfg.mount.preScript ?? [];
  return lines.length === 0 ? '' : `<script>${lines.join('\n')}</script>\n`;
}

// ---------------------------------------------------------------------------
// The read (§3.1): every enumerated longhand + ::before/::after, per element
// ---------------------------------------------------------------------------
/** In-page capture (STRING evaluate — the tsx __name serialization trap,
 *  see visual-parity/render.ts). */
const captureJs = (selector: string, classAllow?: string, varPrefix?: string) => `(() => {
  ${SHADOW_HELPERS_JS}
  const stage = document.querySelector(${JSON.stringify(selector)});
  if (!stage || !stage.firstElementChild) return null;
  // Tailwind round (Flowbite ToggleSwitch): the component's FIRST DOM child
  // can be a hidden sr-only input rendered as a SIBLING of the visible
  // control — the captured root is the first child that actually renders
  // boxes (getClientRects), falling back to firstElementChild (identical
  // pick for every component whose first child is visible).
  // SHADOW-DOM ROUND: then descended through open shadow roots (policy 1 in
  // SHADOW_HELPERS_JS). \`shStageRoot\` is the ONE implementation of this pick
  // — the interaction drivers stamp the very same element (W3/W4), so the
  // element that is hovered is by construction the element that is read.
  const rootEl = shStageRoot(stage);
  if (!rootEl) return null;
  const props = window.__ALL_PROPS;
  const allow = ${JSON.stringify(classAllow ?? null)};
  const keepCls = (l) => (allow ? l.filter((c) => new RegExp(allow).test(c)) : l);
  const read = (cs) => { const o = {}; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
  // EMOTION/CSS-VARS READER: rules whose declarations reference
  // var(--<prefix>…) are SOURCE evidence — the library's own CSS names the
  // token it binds. Collected per element from matching rules in document
  // order (later rules overwrite — cascade approximation; the Node side
  // verifies every candidate against the element's computed value and drops
  // mismatches, so cascade subtleties cannot mint a false binding).
  const vp = ${JSON.stringify(varPrefix ?? null)};
  // SHADOW-DOM ROUND — VRULES ARE PER ROOT NODE, NOT PER DOCUMENT.
  // \`document.styleSheets\` contains ZERO component rules for a Lit/web-
  // component library: every component's CSS lives in
  // \`shadowRoot.adoptedStyleSheets\` (constructed sheets, invisible to the
  // document sheet list). A document-only reader therefore yields zero source
  // facts in silence — the same shape of defect as Carbon's missing <Theme>
  // wrapper. Rules are collected per \`el.getRootNode()\` and an element is
  // only ever matched against rules from ITS OWN root, which is also the
  // correct cascade: a document rule does not apply inside a shadow tree, and
  // a shadow rule does not apply outside it.
  // BYTE-SAFETY for the seven light-DOM libraries: their elements' root is
  // \`document\`, the sheet list is \`document.styleSheets\` in the same order
  // as before, and \`document.adoptedStyleSheets\` is empty on all of them, so
  // the collected rule list — and therefore every captured \`vrefs\` array —
  // is identical.
  const VRULES_BY_ROOT = new Map();
  const buildVrules = (root) => {
    // Two declaration classes per rule (MUI v9 indirection: the combo rule
    // sets --variant-containedBg: var(--mui-palette-primary-main) and the
    // base rule reads background-color: var(--variant-containedBg)):
    //   defs: custom-property decls whose value references var(--<prefix>…)
    //   chans: channel decls whose value references ANY var()
    const out = [];
    const muiRe = new RegExp('var\\\\(\\\\s*(' + vp + '[a-zA-Z0-9-]+)');
    const anyRe = new RegExp('var\\\\(\\\\s*(--[a-zA-Z0-9-]+)');
    // Tailwind round: v4 nests every rule inside @layer blocks (and @media)
    // — grouping rules have no selectorText and must be RECURSED into, or
    // the reader sees ~zero style rules.
    const flatRules = [];
    const collectRules = (list) => {
      for (const r of list) {
        if (r.selectorText && r.style) flatRules.push(r);
        else if (r.cssRules) { try { collectRules(r.cssRules); } catch {} }
      }
    };
    const sheets = [];
    if (root === document) {
      for (const sh of document.styleSheets) sheets.push(sh);
      for (const sh of (document.adoptedStyleSheets || [])) sheets.push(sh);
    } else {
      // A ShadowRoot carries BOTH: adoptedStyleSheets (Lit static styles + the
      // library's adopted global copy) and styleSheets (<style> inside the
      // shadow tree). Adopted first — that is the order the platform applies.
      for (const sh of (root.adoptedStyleSheets || [])) sheets.push(sh);
      for (const sh of (root.styleSheets || [])) sheets.push(sh);
    }
    for (const sh of sheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      collectRules(rules);
    }
    {
      for (const r of flatRules) {
        const defs = [];
        const chans = [];
        const seen = new Set();
        for (let i = 0; i < r.style.length; i++) {
          const prop = r.style[i];
          if (seen.has(prop)) continue; seen.add(prop);
          const val = r.style.getPropertyValue(prop);
          if (!val || val.includes('calc(')) continue;
          if (prop.startsWith('--')) {
            const m = muiRe.exec(val);
            if (m) defs.push([prop, m[1]]);
          } else {
            // Tailwind round: fallback chains (var(--tw-leading, var(--text-
            // sm--line-height))) carry the REAL token in the fallback — every
            // referenced var is a candidate; Node-side verification picks.
            let m;
            const g = new RegExp(anyRe.source, 'g');
            while ((m = g.exec(val)) !== null) chans.push([prop, m[1]]);
          }
        }
        if (defs.length || chans.length) out.push([r.selectorText, defs, chans]);
      }
    }
    return out;
  };
  // ALL candidates per channel, one indirection hop followed (specificity is
  // NOT document order — the Node side picks whichever candidate VERIFIES
  // against the captured computed value).
  // SHADOW-DOM ROUND — the :host branch. \`el.matches(':host…')\` is NOT an
  // error in Chromium; it quietly returns FALSE for every element including
  // the host itself, so a :host rule's bindings are dropped in silence rather
  // than caught by the try/catch below. A :host compound can only ever be the
  // LEFTMOST compound of a selector, which makes the split total:
  //   ':host'            → the host element itself
  //   ':host(S)'         → the host, additionally matching S
  //   ':host(S) REST'    → any element in THIS root matching REST, when the
  //                        host matches S
  // ':host-context(…)' and ':host(S) > REST' (a combinator immediately after
  // the host compound) are OUTSIDE this grammar: they fall through to \`false\`
  // — i.e. they behave exactly as they did before this branch existed, no
  // better and no worse. They are NOT counted anywhere; naming that here is
  // the receipt, because zero such selectors exist in the subject and a
  // counter with no observation to make would be decoration.
  // MEASURED ON THE SUBJECT: the published altitude-web-components@1.0.2
  // bundle contains exactly ONE ':host' selector across all 65 components
  // (':host(:last-child) .al-c-list-item', on al-list-item) and ZERO on any
  // round-1 component — the source's 29 \`:host{display:contents}\` rules are
  // PURGED by the library's own purgecss build step and never ship. So this
  // branch is a general correctness rule that THIS round exercises zero
  // times; it is unproven by capture and said so in the provenance.
  const hostMatch = (el, sel, root) => {
    const host = root && root.host;
    if (!host) return false;
    const m = /^:host(?:\\(([^)]*)\\))?(?:\\s+([\\s\\S]+))?$/.exec(sel.trim());
    if (!m) return false;
    if (m[1]) { try { if (!host.matches(m[1])) return false; } catch { return false; } }
    if (!m[2]) return el === host;
    try { return el.matches(m[2]); } catch { return false; }
  };
  const vrefsOf = (el) => {
    if (!vp) return undefined;
    const root = el.getRootNode();
    let VRULES = VRULES_BY_ROOT.get(root);
    if (!VRULES) { VRULES = buildVrules(root); VRULES_BY_ROOT.set(root, VRULES); }
    const cs = getComputedStyle(el);
    const defs = {}; // intermediate custom prop -> [mui var names]
    const chans = {}; // channel -> [{name, sel}] — sel = the CHANNEL-declaring
    // rule's selector: the PROVENANCE ANCHOR for write-back (the rule that
    // declares "background-color: var(...)" is where a patch would land, even
    // when the token itself resolves through an indirection in another rule).
    for (const [sel, rdefs, rchans] of VRULES) {
      let hit = false;
      if (sel.indexOf(':host') === 0) hit = hostMatch(el, sel, root);
      else { try { hit = el.matches(sel); } catch {} }
      if (!hit) continue;
      for (const [prop, mui] of rdefs) { (defs[prop] = defs[prop] || []).includes(mui) || defs[prop].push(mui); }
      for (const [prop, name] of rchans) {
        (chans[prop] = chans[prop] || []);
        if (!chans[prop].some((c) => c.name === name)) chans[prop].push({ name, sel });
      }
    }
    const out = {};
    for (const prop of Object.keys(chans)) {
      const cands = [];
      const push = (name, sel) => {
        const raw = cs.getPropertyValue(name).trim();
        if (raw && !cands.some((c) => c[0] === name)) cands.push([name, raw, sel]);
      };
      for (const { name, sel } of chans[prop]) {
        if (name.startsWith(vp)) push(name, sel);
        else for (const mui of (defs[name] || [])) push(mui, sel);
      }
      if (cands.length) out[prop] = cands;
    }
    return Object.keys(out).length ? out : undefined;
  };
  // SHADOW-DOM ROUND — read \`tagName\` off Element.prototype, never off the
  // instance. A custom element can DEFINE A REACTIVE PROPERTY THAT SHADOWS IT:
  // altitude's al-heading declares \`accessor tagName: 'h1'|…|'h6' = 'h2'\`, so
  // \`host.tagName\` returns "h2" instead of "AL-HEADING" on every instance.
  // Identical result for every ordinary element, so the committed captures do
  // not move.
  const tagGet = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName').get;
  const readEl = (el) => {
    const vr = vrefsOf(el);
    const out = {
      tag: tagGet.call(el).toLowerCase(),
      classes: keepCls([...el.classList]),
      nodes: [],
      style: read(getComputedStyle(el)),
      pseudo: {},
    };
    if (vr) out.vrefs = vr;
    for (const pe of ['::before', '::after']) {
      const pcs = getComputedStyle(el, pe);
      const content = pcs.getPropertyValue('content');
      if (content !== 'none' && content !== 'normal') out.pseudo[pe] = read(pcs);
    }
    // SHADOW-DOM ROUND — the rendered children of an element are:
    //   · a shadow HOST  → its shadow root's child nodes (the light children
    //     are reached only through the <slot> that consumes them, so nothing
    //     is duplicated and nothing slotted is lost — the current reader,
    //     walking light children only, would have captured the SLOT-ASSIGNED
    //     text of every Altitude component as the host's own text while
    //     losing the entire shadow box that draws it);
    //   · a <slot>       → its assignedNodes() in rendered order, falling
    //     back to its own children (the fallback content the browser draws
    //     when the slot is empty);
    //   · anything else  → its child nodes, exactly as before.
    // A NESTED host (al-avatar's hasBadge=on mounts a real <al-badge> inside
    // the avatar's shadow tree) is KEPT as an element and read this way — it
    // occupies a real box in its parent's layout and its inherited channels
    // are the chain the inner box reads. Only the CAPTURED ROOT descends
    // (policy 1); depth-2 is exercised by exactly that avatar axis this round.
    for (const child of shChildNodesOf(el)) {
      if (child.nodeType === 3 && child.textContent.length > 0) out.nodes.push({ t: 'text', v: child.textContent });
      else if (child.nodeType === 1) out.nodes.push({ t: 'el', el: readEl(child) });
    }
    return out;
  };
  return readEl(rootEl);
})()`;

export const INTERACTIONS = ['default', 'hover', 'focus-visible', 'active'] as const;
export type Interaction = (typeof INTERACTIONS)[number];

/** Infinite CSS animations (Spinner's `animation: …spin … infinite`) never
 *  reach a steady state — their animated computed channels (`transform`)
 *  would fail the double-run byte-identity gate on every run. The capture
 *  PINS every infinite-iteration animation at `currentTime 0` (paused): the
 *  captured value is the animation's own 0% keyframe — a real, deterministic
 *  point of the declared animation, recorded in provenance by keyframe name.
 *  Finite animations and transitions are NOT touched (freezing a running
 *  transition would capture its start value instead of its target — the
 *  steady-state poll handles those). Idempotent; re-applied before every
 *  capture so late-starting animations are caught. */
const pinInfiniteAnimationsJs = `(() => {
  const names = [];
  for (const a of document.getAnimations()) {
    let t = null;
    try { t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null; } catch {}
    if (t && t.iterations === Infinity) {
      if (a.playState !== 'paused') { a.pause(); a.currentTime = 0; }
      names.push(a.animationName || a.id || '(unnamed)');
    }
  }
  return names.sort();
})()`;

export interface SweepResult {
  /** keyed `${component}:${combo}` per capture. */
  captures: Capture[];
  controls: Record<string, CapturedNode>;
  allProps: string[];
  browserVersion: string;
  fontChecks: Record<string, boolean>;
  /** Keyframe names of infinite CSS animations pinned at currentTime 0
   *  (deterministic capture point; empty when the page has none). */
  pinnedAnimations: string[];
  /** SHADOW-DOM ROUND — for every capture whose root was reached by descending
   *  through open shadow roots, the '>'-joined chain of HOST tag names that was
   *  descended past (policy 1). Empty on every light-DOM library, so their
   *  provenance blocks are unchanged. This is the provenance the descent owes:
   *  the captured anatomy's root is `button.al-c-button`, and this records that
   *  it was reached through `al-button`. */
  shadowHostTrails: Record<string, string>;
}

/** The state sweep (§2): real browser states, driven exactly as
 *  visual-parity/render.ts drives them — residual-pointer neutralization,
 *  sentinel+Tab keyboard modality for :focus-visible, hover+mouse.down for
 *  active, steady-state polling with transitions ENABLED (freezing would
 *  alter captured transition-* channels; paint channels are polled to
 *  stability instead, bounded 600ms). */
export async function sweep(
  page: Page,
  mounts: Array<{ comp: ComponentConfig; space: PropSpace }>,
  opts: { screenshots?: string; fontProbes: string[]; classAllow?: string; varPrefix?: string },
): Promise<SweepResult> {
  const allProps = (await page.evaluate(
    `(() => { const l = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = l; return l; })()`,
  )) as string[];

  const fontChecks = (await page.evaluate(
    `(() => { const f = {}; for (const fam of ${JSON.stringify(opts.fontProbes)}) f[fam] = document.fonts.check('16px "' + fam + '"'); return f; })()`,
  )) as Record<string, boolean>;

  const captures: Capture[] = [];
  if (opts.screenshots) mkdirSync(opts.screenshots, { recursive: true });

  const pinnedAnimations = new Set<string>();
  const shadowHostTrails = new Map<string, string>();
  for (const { comp, space } of mounts) {
    for (const combo of space.enumeration.combos) {
      const key = `${comp.name}:${combo.key}`;
      const stageSel = `[data-combo="${key}"]`;
      // SHADOW-DOM ROUND (W3/W4) — THE INTERACTION ROOT.
      // `${stageSel} > *` cannot reach into a shadow root: Playwright's CSS
      // engine pierces open shadow DOM for DESCENDANT combinators but NOT for
      // `>`, so for a custom-element library the locator resolves to the HOST.
      // A host with no :host rule (all 65 of Altitude's, since its own
      // purgecss build deletes them) computes to the UA default display and
      // can have a ZERO-SIZE box, at which point `.filter({visible:true})`
      // resolves EMPTY and hover()/mouse.down() throw instead of driving the
      // state — measured live on al-divider (0×1) and al-toggle (0×0).
      // The fix is not a second root heuristic: the page stamps
      // `data-capture-root` on the element `shStageRoot()` picks — the SAME
      // function the reader uses — and the driver targets that attribute
      // (Playwright's attribute selector pierces shadow, verified). Nothing is
      // stamped, and the locator is byte-for-byte the old one, unless the
      // stage's chosen child is actually a shadow host.
      const stamped = (await page.evaluate(`(() => {
        ${SHADOW_HELPERS_JS}
        const stage = document.querySelector('${stageSel}');
        if (!stage || !stage.firstElementChild) return false;
        let first = stage.firstElementChild;
        for (const c of stage.children) { if (shDrawsRects(c)) { first = c; break; } }
        if (!first.shadowRoot) return false;
        const trail = [];
        const el = shDescendHost(first, trail);
        if (!el || el === first) return false;
        el.setAttribute('data-capture-root', ${JSON.stringify(key)});
        return trail.join('>');
      })()`)) as string | false;
      if (stamped) shadowHostTrails.set(key, stamped);
      const rootLoc = stamped
        ? page.locator(`[data-capture-root="${key}"]`)
        : page.locator(`${stageSel} > *`).filter({ visible: true }).first();
      for (const interaction of INTERACTIONS) {
        // pin infinite animations at a deterministic time point (idempotent)
        for (const n of (await page.evaluate(pinInfiniteAnimationsJs)) as string[]) pinnedAnimations.add(n);
        // neutralize residual pointer + focus state (render.ts discipline)
        await page.mouse.move(0, 0);
        await page.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
        await page.locator(stageSel).scrollIntoViewIfNeeded();

        let focusVisibleMatched: boolean | undefined;
        if (interaction === 'hover') {
          // force: pointer moves even when pointer-events blocks actionability
          // (disabled combos — :hover honestly not matching IS the capture)
          await rootLoc.hover({ force: true });
        } else if (interaction === 'focus-visible') {
          await page.evaluate(`document.querySelector('[data-sentinel="${key}"]').focus()`);
          await page.keyboard.press('Tab'); // keyboard modality → :focus-visible heuristic
          // SHADOW-DOM ROUND (W5) — the receipt must ask the element that
          // actually takes the focus ring. Focus inside a shadow tree lands on
          // an element in that tree; `document.activeElement` is only the HOST,
          // and the HOST does not match :focus-visible (measured on al-button:
          // host `false`, shadow `button.al-c-button` `true` with a real 3px
          // outline). Reading the host would have receipted "the driver never
          // reached the focus-visible plane" on every Altitude capture while the
          // capture itself recorded the focus ring. Non-shadow pages resolve the
          // identical element as before.
          focusVisibleMatched = (await page.evaluate(
            `(() => { ${SHADOW_HELPERS_JS}
              const el = document.querySelector('${stageSel} > *');
              if (!el) return false;
              return shDescendHost(el, null).matches(':focus-visible'); })()`,
          )) as boolean;
        } else if (interaction === 'active') {
          await rootLoc.hover({ force: true });
          await page.mouse.down();
        }

        // steady-state probe over EVERY stage element (root-only polling let
        // inner-element transitions — Checkbox/RadioButton backdrop border
        // colors — get captured mid-flight and fail double-run byte-identity)
        // SHADOW-DOM ROUND (W6) — the settle probe must WALK SHADOW TREES.
        // `querySelectorAll` does not pierce shadow roots, so on a web-component
        // page the poll sampled the stage and the (unstyled) host only: nothing
        // it looked at ever transitions, the very first pair of samples matched,
        // and the sweep declared stability INSTANTLY — captured mid-flight,
        // which is a double-run byte-identity failure. `shWalkEls` enters open
        // shadow roots and, on a light-DOM page, yields exactly the elements
        // `querySelectorAll('stage, stage *')` yielded, in the same order.
        const probe = `(() => { ${SHADOW_HELPERS_JS} const stageEl = document.querySelector('${stageSel}'); const els = stageEl ? shWalkEls(stageEl, []) : []; const parts = []; for (const el of els) { const cs = getComputedStyle(el); parts.push(cs.backgroundColor, cs.color, cs.boxShadow, cs.transform, cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor, cs.opacity, cs.outlineColor, cs.fill); } return parts.join('|'); })()`;
        // Settle discipline (MUI round): ONE matched pair can be a
        // mid-transition flat spot — require TWO consecutive stable samples,
        // with patience sized for 250–300ms transition suites.
        let prev = await page.evaluate(probe);
        let stableRuns = 0;
        for (let i = 0; i < 25; i++) {
          await page.waitForTimeout(60);
          const cur = await page.evaluate(probe);
          if (cur === prev) {
            stableRuns++;
            if (stableRuns >= 2) break;
          } else {
            stableRuns = 0;
            prev = cur;
          }
        }

        const raw = (await page.evaluate(captureJs(stageSel, opts.classAllow, opts.varPrefix))) as CapturedNode | null;
        if (!raw) throw new Error(`capture failed: ${key} ${interaction}`);
        captures.push({
          combo: key,
          interaction,
          ...(focusVisibleMatched !== undefined ? { focusVisibleMatched } : {}),
          root: normalizeNode(raw),
        });

        if (opts.screenshots) {
          const png = await page.locator(stageSel).screenshot({ timeout: 10_000 });
          writeFileSync(path.join(opts.screenshots, `${key.replace(/:/g, '--')}__${interaction}.png`), png);
        }
        if (interaction === 'active') await page.mouse.up();
        // Undo form-state mutation the interaction itself caused: a real
        // click on an UNCONTROLLED radio/checkbox CHECKS it (the click fires
        // on mouse.up), and that state would leak into every subsequent
        // capture — the RadioButton double-run instability. Reset to the
        // mount defaults; controlled inputs are unaffected (React re-asserts
        // their props). Named in provenance (formStateReset).
        await page.evaluate(
          // SHADOW-DOM ROUND (W7): the inputs to reset can live INSIDE a
          // shadow root (al-toggle's checkbox does), and `querySelectorAll`
          // does not reach them — the active-state driver's mouse.up would flip
          // `isChecked` and that state would leak into every later combo. Same
          // element set as before on a light-DOM page.
          `(() => { ${SHADOW_HELPERS_JS} const stage = document.querySelector('${stageSel}'); if (!stage) return; for (const inp of shWalkEls(stage, []).filter((e) => e.tagName === 'INPUT')) { if (inp.checked !== inp.defaultChecked) { inp.checked = inp.defaultChecked; inp.dispatchEvent(new Event('change', { bubbles: true })); } if (inp.value !== inp.defaultValue) inp.value = inp.defaultValue; } })()`,
        );
      }
    }
  }

  const controls: Record<string, CapturedNode> = {};
  for (const t of CONTROL_TAGS) {
    const raw = (await page.evaluate(captureJs(`[data-combo="__control-${t}"]`, opts.classAllow))) as CapturedNode | null;
    if (!raw) throw new Error(`control capture failed: ${t}`);
    controls[t] = normalizeNode(raw);
  }

  return {
    captures,
    controls,
    allProps,
    browserVersion: page.context().browser()!.version(),
    fontChecks,
    pinnedAnimations: [...pinnedAnimations].sort(),
    shadowHostTrails: Object.fromEntries([...shadowHostTrails].sort()),
  };
}

// ===========================================================================
// DEPTH BUILD — Stage A: portal-aware, whole-document baseline-diff capture.
//
// Ports the PROVEN reader from extract/depth-spike/run.ts into the production
// module. A portalCapture component is mounted in TWO PHASES on a driver page:
//   1. baseline — the stage is EMPTY (the provider chrome + stage div exist);
//      snapshot every element then present.
//   2. spec — mount the component with its open-driver props; every element
//      NOT in the baseline whose parent IS in the baseline is a NEW ROOT the
//      component added, captured wherever React put it (in-stage OR portaled to
//      document.body), classified by `stage.contains(el)`.
// The stage is reset to empty BETWEEN combos (R1 mitigation: portaled overlays
// never stack). This is a SEPARATE path — `sweep()` and the committed 12 are
// untouched, so their captures stay byte-identical.
// ===========================================================================

/** A new root the component added, read as a full production CapturedNode
 *  (same longhand read as the census, plus role/aria-modal for root descent). */
export interface CapturedRoot {
  /** 'in-stage' = React rendered it inside the mount stage; 'portaled' = React
   *  sent it elsewhere in document.body (a portal escape — Modal, Popover). */
  location: 'in-stage' | 'portaled';
  /** outerHTML byte length (the portal-DOM-bytes receipt, vs the spike). */
  bytes: number;
  node: CapturedNode;
}

/** What one portalCapture combo yields: the new roots + what the CURRENT
 *  in-stage floor reader (`stage.firstElementChild`) sees today (the
 *  absent/wrong-element evidence quoted against the spike). */
export interface PortalCapture {
  combo: string;
  preBytes: number;
  postBytes: number;
  currentReader: { present: boolean; sig: string; descendantEls: number };
  roots: CapturedRoot[];
  /** Round 6: the element autofocus neutralization moved focus AWAY from
   *  before sampling ('' / absent = focus was already on <body>). */
  blurred?: string;
}

/** Settle budget after mounting an overlay combo: portal insertion + a
 *  measure/positioning pass (the spike's 700ms; bounded, deterministic). */
export const PORTAL_SETTLE_MS = 700;
const PORTAL_STAGE_ID = 'depth-stage';

/** Build the two-phase driver page for ONE portalCapture component. The page
 *  exposes `window.__setSpec(v)`: a combo INDEX (or true = 0) mounts that
 *  combo's props (open-driver + fixed/axis props + callbacks + canonical
 *  children) inside the stage; false/null empties it (baseline / reset-per-
 *  combo). MOLECULE round: every enumerated combo is baked (per-combo props
 *  via comboProps — presence/state axes included), and the canonical-children
 *  vocabulary (childWrap / childrenSpec / $render) matches buildHarnessPage.
 *  Mirrors buildHarnessPage's marker grammar ($callback/$import/$render) and
 *  provider wrapping. */
export function buildPortalHarnessPage(
  harness: string,
  cfg: CaptureConfig,
  mount: { comp: ComponentConfig; space: PropSpace },
): string {
  const { comp, space } = mount;
  const st = stageFor(cfg, comp);
  // per-combo props + the open-driver props on top (driven on every mount).
  const specs = space.enumeration.combos.map((combo) => ({
    key: combo.key,
    props: { ...comboProps(comp, space, combo), ...(comp.openDriver ?? {}) } as Record<string, unknown>,
  }));

  // $import/$render markers anywhere in the props become real import
  // statements (resolved at mount by resolveMarkers), as buildHarnessPage.
  const extraImports = new Map<string, Set<string>>();
  const collectImports = (v: unknown): void => {
    if (v && typeof v === 'object') {
      const rec = v as Record<string, unknown>;
      const imp = typeof rec['$import'] === 'string' ? rec['$import'] : typeof rec['$render'] === 'string' ? rec['$render'] : undefined;
      if (typeof imp === 'string') {
        const [pkg, name] = imp.split('#');
        (extraImports.get(pkg) ?? extraImports.set(pkg, new Set()).get(pkg)!).add(name);
        return;
      }
      for (const x of Object.values(v)) collectImports(x);
    }
  };
  for (const s of specs) collectImports(s.props);
  for (const cs of walkChildSpecs(comp.childrenSpec)) collectImports(cs.props ?? {});
  const extraImportLines = [...extraImports.entries()]
    .sort()
    .map(([pkg, names]) => `import { ${[...names].sort().join(', ')} } from '${pkg}';`);
  const extraNames = [...extraImports.values()].flatMap((s) => [...s]).sort();
  const kidImports = [...new Set([
    comp.importName,
    ...(comp.childWrap ? [comp.childWrap.importName] : []),
    ...walkChildSpecs(comp.childrenSpec).map((c) => c.importName),
  ])].sort();

  const stageJs = `{ display:'flex', alignItems:'flex-start', width:${st.width}, height:${st.height}, padding:${st.padding}, boxSizing:'border-box', background:'#fff', overflow:'hidden' }`;
  // Kept in LOCKSTEP with buildHarnessPage (the Carbon renderKids lesson: a
  // divergence between the two pages is a defect that only shows on the path
  // nobody ran this round). NOT EXERCISED THIS ROUND — no Altitude component
  // is portalCapture in round 1 (Dialog/Drawer render inside their OWN shadow
  // root rather than portaling to body, which is a different problem shape and
  // is deferred by name).
  const ce = cfg.library.customElements === true;
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
${ce ? '' : `import { ${kidImports.join(', ')} } from '${cfg.library.package}';\n`}${extraImportLines.join('\n')}
${cfg.mount.imports.join('\n')}

const CE = ${ce};
const C = ${ce ? JSON.stringify(comp.importName) : comp.importName};
const COMPONENTS = ${ce ? JSON.stringify(Object.fromEntries(kidImports.map((n) => [n, n]))) : `{ ${kidImports.join(', ')} }`};
const EXTRA = { ${extraNames.join(', ')} };
const ceProps = (p) => {
  if (!CE) return p;
  const o = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v === false || v === undefined || v === null || typeof v === 'function') continue;
    o[k] = v;
  }
  return o;
};
const SPECS = ${JSON.stringify(specs)};
const CALLBACKS = ${JSON.stringify(comp.callbackProps ?? [])};
const TEXT = ${JSON.stringify(comp.sampleText)};
const CHILD_WRAP = ${JSON.stringify(comp.childWrap?.importName ?? null)};
const CHILDREN_SPEC = ${JSON.stringify(comp.childrenSpec ?? null)};
function resolveMarkers(v) {
  if (v && typeof v === 'object') {
    if (v.$callback === true) return () => {};
    if (typeof v.$import === 'string') return EXTRA[v.$import.split('#')[1]];
    if (typeof v.$render === 'string') { const K = EXTRA[v.$render.split('#')[1]]; return (params) => React.createElement(K, params); }
    if (Array.isArray(v)) return v.map(resolveMarkers);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMarkers(x);
    return out;
  }
  return v;
}
// ORGANISM round: childrenSpec RECURSES (see buildHarnessPage).
function renderKidList(list) {
  return list.map((cs, i) => React.createElement(
    COMPONENTS[cs.importName],
    { key: i, ...ceProps(resolveMarkers({ ...(cs.props || {}) })) },
    cs.children ? renderKidList(cs.children) : cs.text,
  ));
}
function renderKids() {
  if (CHILDREN_SPEC) return renderKidList(CHILDREN_SPEC);
  if (CHILD_WRAP) { const W = COMPONENTS[CHILD_WRAP]; return <W>{TEXT}</W>; }
  // CARBON ROUND: "" = no children, not an empty-string child (see the census
  // page's renderKids above — Carbon's Checkbox forwards children onto a void
  // <input> and React throws). Kept in lockstep with the census page.
  return TEXT === '' ? undefined : TEXT;
}
const stageStyle = ${stageJs};
let specIdx = null;
let root = null;
function render() {
  let content = null;
  if (specIdx !== null) {
    const props0 = resolveMarkers({ ...SPECS[specIdx].props });
    for (const cb of CALLBACKS) props0[cb] = () => {};
    const props = ceProps(props0);
    content = <C {...props}>{renderKids()}</C>;
  }
  root.render(
    ${cfg.mount.wrapperOpen}
      <div id="${PORTAL_STAGE_ID}" style={stageStyle}>{content}</div>
    ${cfg.mount.wrapperClose}
  );
}
window.__setSpec = (v) => { specIdx = (v === false || v === null || v === undefined) ? null : (v === true ? 0 : v); render(); };
root = createRoot(document.getElementById('root'));
window.__setSpec(false);
`;
  const pageDir = path.join(harness, 'computed-portal-page');
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, 'entry.jsx'), entry);
  execFileSync(
    path.join(harness, 'node_modules', '.bin', 'esbuild'),
    [
      'computed-portal-page/entry.jsx',
      '--bundle',
      '--outfile=computed-portal-page/bundle.js',
      '--jsx=automatic',
      '--loader:.json=json',
      '--loader:.svg=dataurl',
      '--loader:.png=dataurl',
      '--log-level=error',
    ],
    { cwd: harness },
  );
  // TAILWIND ROUND: the stylesheet is INLINED, not linked — file:// pages
  // treat linked sheets as opaque origins, so document.styleSheets[n]
  // .cssRules THROWS and the CSS-vars reader sees zero rules (Emotion never
  // hit this: it injects <style> tags). Inlining keeps CSSOM readable for
  // every stylesheet-shipping library.
  const bundleCssPath = path.join(pageDir, 'bundle.css');
  const bundleCss = existsSync(bundleCssPath) ? readFileSync(bundleCssPath, 'utf8') : '';
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
${headStyleTags(harness, cfg)}${preScriptTag(cfg)}${bundleCss ? `<style>${bundleCss}</style>` : ''}
<style>html { color-scheme: ${cfg.browser.colorScheme}; } body { margin: 0; background: #ddd; }</style>
</head><body><div id="root"></div>
<script>document.addEventListener('click', (e) => e.preventDefault(), true);</script>
<script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, 'index.html');
}

/** Mark the empty-stage baseline: the element set present before the component
 *  mounts + the pre-mount body byte length. */
const markBaselineJs = `(() => {
  window.__depthBaseline = new Set(document.querySelectorAll('*'));
  window.__preBytes = document.body.innerHTML.length;
  return window.__depthBaseline.size;
})()`;

/** Round 6 — AUTOFOCUS NEUTRALIZATION (see capturePortalRoots). Blurs the
 *  focused element so the DEFAULT-interaction sample is not silently a
 *  :focus-visible sample, and returns a stable description of what was
 *  blurred ('' when focus was already on <body>). MUI's Modal focus trap
 *  re-focuses the CONTAINER on focusout — never a ButtonBase — so the
 *  :focus-visible plane genuinely leaves the item. STRING evaluate (the tsx
 *  __name serialization trap). */
const blurActiveJs = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || typeof el.blur !== 'function') return '';
  const sig = el.tagName.toLowerCase() + '|' + [...el.classList].join('.');
  el.blur();
  return sig;
})()`;

/** The whole-document baseline-diff read (STRING evaluate — the tsx __name
 *  serialization trap). Reads every new root as a full CapturedNode using the
 *  SAME longhand set (window.__ALL_PROPS) and ::before/::after rule as the
 *  census captureJs, plus role/aria-modal for root descent. */
const capturePortalJs = (classAllow?: string, classPrefix?: string) => `(() => {
  const baseline = window.__depthBaseline;
  const stage = document.getElementById(${JSON.stringify(PORTAL_STAGE_ID)});
  const props = window.__ALL_PROPS;
  const allow = ${JSON.stringify(classAllow ?? null)};
  const prefix = ${JSON.stringify(classPrefix ?? '')};
  const keepCls = (l) => (allow ? l.filter((c) => new RegExp(allow).test(c)) : l);
  // In-page mirror of lib.ts \`stems\` — prefix FIRST, modifier filter SECOND.
  // See that function's header: a library whose own prefix contains '--'
  // (Carbon's \`cds--\`) has every class discarded by the other order.
  const stemsOf = (l) => l
    .map((c) => (c.endsWith('--root') ? c.slice(0, -'--root'.length) : c))
    .map((c) => (prefix && c.startsWith(prefix) ? c.slice(prefix.length) : c))
    .filter((c) => c !== '' && !c.includes('--'));
  const read = (cs) => { const o = {}; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
  const readEl = (el) => {
    const out = {
      tag: el.tagName.toLowerCase(),
      classes: keepCls([...el.classList]),
      role: el.getAttribute('role'),
      ariaModal: el.getAttribute('aria-modal'),
      nodes: [],
      style: read(getComputedStyle(el)),
      pseudo: {},
    };
    for (const pe of ['::before', '::after']) {
      const pcs = getComputedStyle(el, pe);
      const content = pcs.getPropertyValue('content');
      if (content !== 'none' && content !== 'normal') out.pseudo[pe] = read(pcs);
    }
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.textContent.length > 0) out.nodes.push({ t: 'text', v: child.textContent });
      else if (child.nodeType === 1) out.nodes.push({ t: 'el', el: readEl(child) });
    }
    return out;
  };
  // MOLECULE round: BODY-scoped diff — Emotion-runtime libraries inject new
  // <style> elements into <head> on a component's first mount; the whole-
  // document diff reported them as phantom "portaled roots" (and only on the
  // first combo of the first sweep — an attribution/determinism breaker).
  // React portals land in document.body; head mutations are never component
  // DOM. (Polaris/static-CSS libraries: identical behavior — their roots
  // were always in body.)
  const all = [...document.body.querySelectorAll('*')];
  const newRoots = all.filter((el) => !baseline.has(el) && (!el.parentElement || baseline.has(el.parentElement)));
  // MOLECULE round: tag each new root so callers can locate/screenshot it
  // before the reset (attributes are never part of the captured node — only
  // tag/classes/styles/role/aria-modal are read, and reads happen above).
  newRoots.forEach((el, i) => el.setAttribute('data-portal-root', String(i)));
  const cur = stage && stage.firstElementChild;
  const currentReader = cur
    ? { present: true, sig: cur.tagName.toLowerCase() + '|' + stemsOf([...cur.classList]).join('.'), descendantEls: cur.querySelectorAll('*').length }
    : { present: false, sig: '', descendantEls: 0 };
  return {
    preBytes: window.__preBytes,
    postBytes: document.body.innerHTML.length,
    currentReader,
    roots: newRoots.map((el) => ({
      location: stage && stage.contains(el) ? 'in-stage' : 'portaled',
      bytes: el.outerHTML.length,
      node: readEl(el),
    })),
  };
})()`;

/** Capture one portalCapture combo end-to-end: reset → baseline → mount →
 *  settle → whole-document diff → reset (clean state for the next combo). The
 *  page must already be loaded (buildPortalHarnessPage) and `window.__ALL_PROPS`
 *  set. Nodes are normalized like the census (styles sorted/rgba-canonical),
 *  role/aria-modal preserved. MOLECULE round: `specIndex` selects which baked
 *  combo mounts (default 0 — the depth-receipt single-combo behavior,
 *  unchanged); `beforeReset` runs while the combo is still MOUNTED (root
 *  elements carry data-portal-root="<i>") — the screenshot hook. */
export async function capturePortalRoots(
  page: Page,
  comboKey: string,
  classAllow?: string,
  specIndex = 0,
  beforeReset?: (raw: PortalCapture) => Promise<void>,
  /** The LIBRARY'S OWN class prefix (`cfg.library.classPrefix`), used only for
   *  the diagnostic `currentReader.sig`. It used to be a literal `/^Polaris-/`
   *  in the in-page reader — a vendor name on the live path. */
  classPrefix?: string,
): Promise<PortalCapture> {
  await page.evaluate(`window.__setSpec(false)`);
  await page.waitForTimeout(150);
  await page.evaluate(markBaselineJs);
  await page.evaluate(`window.__setSpec(${specIndex})`);
  await page.waitForTimeout(PORTAL_SETTLE_MS);
  // MOLECULE LIVE-DEFECT ROUND (round 6) — AUTOFOCUS NEUTRALIZATION. An
  // overlay that AUTOFOCUSES on open (MUI's Menu focuses its first MenuItem)
  // renders that item in the :focus-visible plane, and the portal reader —
  // which samples the DEFAULT interaction only — baked the grey focus tint
  // into the item's BASE fill. Live evidence (round 6 paste): menu item 1
  // carried rgba(0,0,0,0.12) while its identical siblings carried none.
  // Blur before sampling so the sampled plane really is the default one.
  // The blur is RECEIPTED (below) whether or not it moved focus, and the
  // double-run byte-identity check still has to pass over it.
  const blurred = (await page.evaluate(blurActiveJs)) as string;
  if (blurred !== '') await page.waitForTimeout(120);
  const raw = (await page.evaluate(capturePortalJs(classAllow, classPrefix))) as {
    preBytes: number;
    postBytes: number;
    currentReader: PortalCapture['currentReader'];
    roots: Array<{ location: 'in-stage' | 'portaled'; bytes: number; node: CapturedNode }>;
  };
  const result: PortalCapture = {
    combo: comboKey,
    preBytes: raw.preBytes,
    postBytes: raw.postBytes,
    currentReader: raw.currentReader,
    roots: raw.roots.map((r) => ({ location: r.location, bytes: r.bytes, node: normalizeNode(r.node) })),
    ...(blurred !== '' ? { blurred } : {}),
  };
  if (beforeReset) await beforeReset(result);
  await page.evaluate(`window.__setSpec(false)`); // reset-per-combo (R1)
  await page.waitForTimeout(120);
  return result;
}

/** MOLECULE round — the portal SWEEP: every enumerated combo of a
 *  portalCapture component through the baseline-diff reader, yielding
 *  production `Capture` entries the census fusion consumes unchanged.
 *
 *  Root policy (single-root fusion): exactly ONE portaled root is the
 *  captured root (the overlay — Dialog's modal root, Tooltip's popper,
 *  Menu's popover root); in-stage roots (the mount's anchor child, e.g. the
 *  Tooltip anchor) are RECEIPTED, never carried. Zero portaled + one
 *  in-stage root falls back to the in-stage root. Anything else is a NAMED
 *  refusal (MULTI-ROOT-CAPTURE) — multi-root fusion is not built.
 *
 *  Interactions: DEFAULT ONLY — overlay hover/focus/active states are a
 *  named residual of this round (the census state drivers assume an
 *  in-stage, persistent mount). Callers record this in provenance. */
/** Element children of a captured node (text runs dropped). */
const capturedChildEls = (n: CapturedNode): CapturedNode[] =>
  n.nodes.filter((c) => c.t === 'el').map((c) => (c as { el: CapturedNode }).el);

/** A captured node DRAWS a box of its own: a non-transparent background, a
 *  border, or a shadow. (The same test `anatomy.isBoxlessNode` makes, kept
 *  local so capture.ts never imports anatomy.ts — anatomy.ts imports THIS
 *  module and a runtime cycle is not worth a shared three-line predicate.) */
function capturedDrawsBox(n: CapturedNode): boolean {
  const s = n.style;
  const bg = s['background-color'];
  const opaqueBg = !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
  const border = ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width']
    .some((p) => s[p] !== undefined && s[p] !== '0px');
  const shadow = !!s['box-shadow'] && s['box-shadow'] !== 'none';
  return opaqueBg || border || shadow;
}

/** Out of flow AND pinned to all four edges — a layer that covers whatever
 *  contains it (`position: fixed; inset: 0` = the whole viewport). */
function capturedFullBleed(n: CapturedNode): boolean {
  const s = n.style;
  if (s['position'] !== 'fixed' && s['position'] !== 'absolute') return false;
  return (['top', 'right', 'bottom', 'left'] as const).every((p) => s[p] === '0px');
}

/** MOLECULE LIVE-DEFECT ROUND (round 6) — FULL-BLEED SCRIM DEMOTION.
 *
 *  A portaled overlay root is not always the component's visual box. MUI's
 *  Popover/Menu root is `position: fixed; inset: 0` — a viewport-covering
 *  MODAL LAYER carrying an INVISIBLE backdrop (MuiBackdrop-invisible), two
 *  classless focus-trap sentinels, and the paper. Carried as the captured
 *  root it made the Figma component the size of the CAPTURE STAGE (900×1000)
 *  with the real 113×124 paper in its top-left corner — the live round-6
 *  paste's loudest defect.
 *
 *  Demotion fires only when the layer draws NOTHING of its own:
 *    1. the root is `position: fixed` and pinned to all four edges;
 *    2. exactly ONE element child draws a box (background / border / shadow)
 *       — every other child is an invisible backdrop or a zero-box sentinel;
 *    3. that child is NOT itself full-bleed.
 *  Condition 3 is what keeps DIALOG intact: its single boxed child is the
 *  VISIBLE rgba(0,0,0,.5) scrim pinned to all four edges, so the layer root
 *  stays and the multi-part overlay (scrim behind, paper centered on top)
 *  lowers as designed. Tooltip's popper is `position: absolute` — never a
 *  candidate. Returns null when the rule does not fire. */
export function demoteFullBleedScrim(
  n: CapturedNode,
): { root: CapturedNode; dropped: string[] } | null {
  if (n.style['position'] !== 'fixed') return null;
  if (!(['top', 'right', 'bottom', 'left'] as const).every((p) => n.style[p] === '0px')) return null;
  if (capturedDrawsBox(n)) return null;
  const kids = capturedChildEls(n);
  if (kids.length < 2) return null;
  const boxed = kids.filter((k) => capturedDrawsBox(k));
  if (boxed.length !== 1) return null;
  if (capturedFullBleed(boxed[0])) return null;
  const sigOf = (k: CapturedNode): string => `${k.tag}|${k.classes.join('.')}`;
  return { root: boxed[0], dropped: kids.filter((k) => k !== boxed[0]).map(sigOf) };
}

/** ROUND 6 — INERT PORTAL CHILD strip. A focus-trap SENTINEL (React-ARIA /
 *  MUI Modal render two: `<div tabindex="0">` before and after the content)
 *  can paint nothing, contains nothing, and carries no library class — but
 *  it IS a captured element, so it promoted into a contract part and lowered
 *  to a full-bleed invisible frame sitting over the whole component (the
 *  live Dialog carried two). Drop a DIRECT child of a portal root that draws
 *  no box, has no class-stem, no element children and no text. Anything that
 *  could ever paint, or that contains anything, is kept. */
export function stripInertPortalChildren(n: CapturedNode): { root: CapturedNode; dropped: number } {
  const inert = (k: CapturedNode): boolean =>
    k.classes.length === 0 &&
    !capturedDrawsBox(k) &&
    k.nodes.length === 0;
  const kept = n.nodes.filter((c) => c.t !== 'el' || !inert((c as { el: CapturedNode }).el));
  if (kept.length === n.nodes.length) return { root: n, dropped: 0 };
  return { root: { ...n, nodes: kept }, dropped: n.nodes.length - kept.length };
}

export async function portalSweep(
  page: Page,
  comp: ComponentConfig,
  space: PropSpace,
  opts: { screenshots?: string; classAllow?: string; classPrefix?: string },
): Promise<{ captures: Capture[]; receipts: string[] }> {
  const captures: Capture[] = [];
  const receipts: string[] = [];
  if (opts.screenshots) mkdirSync(opts.screenshots, { recursive: true });
  for (let i = 0; i < space.enumeration.combos.length; i++) {
    const combo = space.enumeration.combos[i];
    const pc = await capturePortalRoots(page, combo.key, opts.classAllow, i, async (raw) => {
      if (!opts.screenshots) return;
      const portaledIdx = raw.roots.map((r, j) => (r.location === 'portaled' ? j : -1)).filter((j) => j >= 0);
      const pickIdx = portaledIdx.length === 1 ? portaledIdx[0] : raw.roots.length === 1 ? 0 : -1;
      if (pickIdx < 0) return; // the refusal below names it; nothing to shoot
      const shot = await page.locator(`[data-portal-root="${pickIdx}"]`).screenshot({ timeout: 10_000 });
      writeFileSync(path.join(opts.screenshots!, `${comp.name}--${combo.key}__default.png`), shot);
    }, opts.classPrefix);
    const portaled = pc.roots.filter((r) => r.location === 'portaled');
    const inStage = pc.roots.filter((r) => r.location === 'in-stage');
    let picked: CapturedRoot;
    if (portaled.length === 1) {
      picked = portaled[0];
      if (inStage.length > 0) {
        receipts.push(
          `portal-anchor-receipt: ${combo.key} — ${inStage.length} in-stage root(s) (the mount's anchor child) NOT carried; the portaled overlay is the captured root`,
        );
      }
    } else if (portaled.length === 0 && inStage.length === 1) {
      picked = inStage[0];
    } else {
      throw new Error(
        `${comp.name}:${combo.key}: MULTI-ROOT-CAPTURE refusal — ${portaled.length} portaled + ${inStage.length} in-stage new roots; single-root fusion carries exactly one root (multi-root fusion is a named future class)`,
      );
    }
    let root = picked.node;
    const demoted = demoteFullBleedScrim(root);
    if (demoted) {
      receipts.push(
        `portal-scrim-demoted: ${combo.key} — the portaled root is a full-bleed (position:fixed; inset:0) modal LAYER that draws no box of its own; the one box-drawing child (${demoted.root.tag}|${demoted.root.classes.join('.')}) is the component's visual root. Dropped from the canvas: ${demoted.dropped.map((d) => `"${d}"`).join(', ')} (invisible backdrop / focus-trap sentinels — none of them paint). A VISIBLE full-bleed scrim (Dialog) refuses this demotion by rule.`,
      );
      root = demoted.root;
    }
    const stripped = stripInertPortalChildren(root);
    if (stripped.dropped > 0) {
      receipts.push(
        `portal-inert-children-dropped: ${combo.key} — ${stripped.dropped} direct child element(s) of the captured root draw no box, carry no library class and contain nothing (focus-trap sentinels); they lowered to full-bleed invisible frames over the component and are not anatomy`,
      );
      root = stripped.root;
    }
    if (pc.blurred) {
      receipts.push(
        `portal-autofocus-neutralized: ${combo.key} — focus was on "${pc.blurred}" when the overlay settled (the library autofocuses on open); blurred BEFORE sampling so the default-interaction plane is not silently a :focus-visible plane`,
      );
    }
    captures.push({ combo: `${comp.name}:${combo.key}`, interaction: 'default', root });
  }
  return { captures, receipts };
}
