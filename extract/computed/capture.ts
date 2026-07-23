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
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import {
  enumerate,
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
   *  indeterminate→"indeterminate"). Unlisted values mount verbatim. */
  axisValueMap?: Record<string, Record<string, unknown>>;
  /** Round 4: structure-creating optional props (see PresenceProp). */
  presenceProps?: PresenceProp[];
  /** Boolean props driven as states (Button `disabled`): 2-value axes AND
   *  state guards (§2). May name props absent from the contract when the
   *  contract declares the STATE instead (Button declares states:[disabled]
   *  with no disabled prop — the React surface accepts the prop). */
  stateProps?: StateAxisSpec[];
  /** Props pinned to fixed values on every mount (recorded). */
  fixedProps?: Record<string, string | number | boolean>;
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
  };
  mount: {
    /** Raw import lines for providers/locale/stylesheet. */
    imports: string[];
    /** Provider JSX wrapped around every stage ('' = none). */
    wrapperOpen: string;
    wrapperClose: string;
  };
  /** DTCG token files whose custom-property spellings the bound-probe and
   *  the fidelity gate resolve against (repo-relative). */
  tokens: { dtcg: string[]; css: string };
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
  for (const c of cfg.components) {
    const contractPath = path.join(repoRoot, c.contract);
    if (!existsSync(contractPath)) throw new Error(`${c.name}: contract not found: ${c.contract}`);
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
    props[a.prop] = mapped && v in mapped ? mapped[v] : v;
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

export function buildHarnessPage(
  harness: string,
  cfg: CaptureConfig,
  mounts: Array<{ comp: ComponentConfig; space: PropSpace }>,
): string {
  const importNames = [...new Set(mounts.map((m) => m.comp.importName))].sort();
  const specs = mounts.flatMap(({ comp, space }) =>
    space.enumeration.combos.map((combo) => ({
      key: `${comp.name}:${combo.key}`,
      component: comp.importName,
      props: comboProps(comp, space, combo),
      callbacks: comp.callbackProps ?? [],
      text: comp.sampleText,
      stage: stageFor(cfg, comp),
    })),
  );
  // Round 4 presence-value marker grammar: collect $import values into real
  // import statements; markers resolve at mount time (resolveMarkers below).
  const extraImports = new Map<string, Set<string>>(); // pkg → exports
  const collectImports = (v: unknown): void => {
    if (v && typeof v === 'object') {
      const imp = (v as Record<string, unknown>)['$import'];
      if (typeof imp === 'string') {
        const [pkg, name] = imp.split('#');
        (extraImports.get(pkg) ?? extraImports.set(pkg, new Set()).get(pkg)!).add(name);
        return;
      }
      for (const x of Object.values(v)) collectImports(x);
    }
  };
  for (const s of specs) collectImports(s.props);
  const extraImportLines = [...extraImports.entries()]
    .sort()
    .map(([pkg, names]) => `import { ${[...names].sort().join(', ')} } from '${pkg}';`);
  const extraNames = [...extraImports.values()].flatMap((s) => [...s]).sort();
  // display:flex + align-items:flex-start: the component is a flex item, so
  // its position never depends on the stage's own line-box strut (inherited
  // font metrics) — the mount-context receipt (spike finding; DESIGN §1.1/§4).
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${importNames.join(', ')} } from '${cfg.library.package}';
${extraImportLines.join('\n')}
${cfg.mount.imports.join('\n')}

const COMPONENTS = { ${importNames.join(', ')} };
const EXTRA = { ${extraNames.join(', ')} };
const SPECS = ${JSON.stringify(specs)};
const stageStyle = (st) => ({ display: 'flex', alignItems: 'flex-start', width: st.width, height: st.height, padding: st.padding, boxSizing: 'border-box', background: '#fff', overflow: 'hidden' });
const stage = stageStyle({ width: ${cfg.stage.width}, height: ${cfg.stage.height}, padding: ${cfg.stage.padding} });

// presence-value marker grammar: {"$callback":true} → () => {};
// {"$import":"pkg#Name"} → the imported binding (resolved recursively).
function resolveMarkers(v) {
  if (v && typeof v === 'object') {
    if (v.$callback === true) return () => {};
    if (typeof v.$import === 'string') return EXTRA[v.$import.split('#')[1]];
    if (Array.isArray(v)) return v.map(resolveMarkers);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMarkers(x);
    return out;
  }
  return v;
}

function App() {
  return (
    ${cfg.mount.wrapperOpen}
      {SPECS.map((s) => {
        const C = COMPONENTS[s.component];
        const props = resolveMarkers({ ...s.props });
        for (const cb of s.callbacks) props[cb] = () => {};
        return (
          <React.Fragment key={s.key}>
            <button data-sentinel={s.key} style={{ width: 8, height: 8, padding: 0, border: 0, margin: 2, background: '#eee' }} aria-label="sentinel" />
            <div data-combo={s.key} style={stageStyle(s.stage)}><C {...props}>{s.text}</C></div>
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
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="bundle.css">
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

// ---------------------------------------------------------------------------
// The read (§3.1): every enumerated longhand + ::before/::after, per element
// ---------------------------------------------------------------------------
/** In-page capture (STRING evaluate — the tsx __name serialization trap,
 *  see visual-parity/render.ts). */
const captureJs = (selector: string, classAllow?: string) => `(() => {
  const stage = document.querySelector(${JSON.stringify(selector)});
  if (!stage || !stage.firstElementChild) return null;
  const props = window.__ALL_PROPS;
  const allow = ${JSON.stringify(classAllow ?? null)};
  const keepCls = (l) => (allow ? l.filter((c) => new RegExp(allow).test(c)) : l);
  const read = (cs) => { const o = {}; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
  const readEl = (el) => {
    const out = {
      tag: el.tagName.toLowerCase(),
      classes: keepCls([...el.classList]),
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
  return readEl(stage.firstElementChild);
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
  opts: { screenshots?: string; fontProbes: string[]; classAllow?: string },
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
  for (const { comp, space } of mounts) {
    for (const combo of space.enumeration.combos) {
      const key = `${comp.name}:${combo.key}`;
      const stageSel = `[data-combo="${key}"]`;
      const rootLoc = page.locator(`${stageSel} > *`).first();
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
          focusVisibleMatched = (await page.evaluate(
            `(() => { const el = document.querySelector('${stageSel} > *'); return !!el && el.matches(':focus-visible'); })()`,
          )) as boolean;
        } else if (interaction === 'active') {
          await rootLoc.hover({ force: true });
          await page.mouse.down();
        }

        // steady-state probe over EVERY stage element (root-only polling let
        // inner-element transitions — Checkbox/RadioButton backdrop border
        // colors — get captured mid-flight and fail double-run byte-identity)
        const probe = `(() => { const els = document.querySelectorAll('${stageSel}, ${stageSel} *'); const parts = []; for (const el of els) { const cs = getComputedStyle(el); parts.push(cs.backgroundColor, cs.color, cs.boxShadow, cs.transform, cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor, cs.opacity, cs.outlineColor, cs.fill); } return parts.join('|'); })()`;
        let prev = await page.evaluate(probe);
        for (let i = 0; i < 10; i++) {
          await page.waitForTimeout(60);
          const cur = await page.evaluate(probe);
          if (cur === prev) break;
          prev = cur;
        }

        const raw = (await page.evaluate(captureJs(stageSel, opts.classAllow))) as CapturedNode | null;
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
          `(() => { const stage = document.querySelector('${stageSel}'); if (!stage) return; for (const inp of stage.querySelectorAll('input')) { if (inp.checked !== inp.defaultChecked) { inp.checked = inp.defaultChecked; inp.dispatchEvent(new Event('change', { bubbles: true })); } if (inp.value !== inp.defaultValue) inp.value = inp.defaultValue; } })()`,
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
}

/** Settle budget after mounting an overlay combo: portal insertion + a
 *  measure/positioning pass (the spike's 700ms; bounded, deterministic). */
export const PORTAL_SETTLE_MS = 700;
const PORTAL_STAGE_ID = 'depth-stage';

/** Build the two-phase driver page for ONE portalCapture component. The page
 *  exposes `window.__setSpec(bool)`: true mounts the component (open-driver +
 *  fixed/axis props + callbacks + sampleText children) inside the stage; false
 *  empties it (baseline / reset-per-combo). Mirrors buildHarnessPage's marker
 *  grammar ($callback / $import) and provider wrapping. */
export function buildPortalHarnessPage(
  harness: string,
  cfg: CaptureConfig,
  mount: { comp: ComponentConfig; space: PropSpace },
): string {
  const { comp, space } = mount;
  const st = stageFor(cfg, comp);
  // props for the (single) base combo + the open-driver props on top.
  const baseCombo = space.enumeration.combos.find((c) => c.key === space.baseComboKey)!;
  const props: Record<string, unknown> = { ...comboProps(comp, space, baseCombo), ...(comp.openDriver ?? {}) };

  // $import markers anywhere in the props become real import statements
  // (resolved at mount by resolveMarkers), exactly as buildHarnessPage does.
  const extraImports = new Map<string, Set<string>>();
  const collectImports = (v: unknown): void => {
    if (v && typeof v === 'object') {
      const imp = (v as Record<string, unknown>)['$import'];
      if (typeof imp === 'string') {
        const [pkg, name] = imp.split('#');
        (extraImports.get(pkg) ?? extraImports.set(pkg, new Set()).get(pkg)!).add(name);
        return;
      }
      for (const x of Object.values(v)) collectImports(x);
    }
  };
  collectImports(props);
  const extraImportLines = [...extraImports.entries()]
    .sort()
    .map(([pkg, names]) => `import { ${[...names].sort().join(', ')} } from '${pkg}';`);
  const extraNames = [...extraImports.values()].flatMap((s) => [...s]).sort();

  const stageJs = `{ display:'flex', alignItems:'flex-start', width:${st.width}, height:${st.height}, padding:${st.padding}, boxSizing:'border-box', background:'#fff', overflow:'hidden' }`;
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${comp.importName} } from '${cfg.library.package}';
${extraImportLines.join('\n')}
${cfg.mount.imports.join('\n')}

const C = ${comp.importName};
const EXTRA = { ${extraNames.join(', ')} };
const PROPS = ${JSON.stringify(props)};
const CALLBACKS = ${JSON.stringify(comp.callbackProps ?? [])};
const TEXT = ${JSON.stringify(comp.sampleText)};
function resolveMarkers(v) {
  if (v && typeof v === 'object') {
    if (v.$callback === true) return () => {};
    if (typeof v.$import === 'string') return EXTRA[v.$import.split('#')[1]];
    if (Array.isArray(v)) return v.map(resolveMarkers);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMarkers(x);
    return out;
  }
  return v;
}
const stageStyle = ${stageJs};
let open = false;
let root = null;
function render() {
  const props = resolveMarkers({ ...PROPS });
  for (const cb of CALLBACKS) props[cb] = () => {};
  root.render(
    ${cfg.mount.wrapperOpen}
      <div id="${PORTAL_STAGE_ID}" style={stageStyle}>{open ? <C {...props}>{TEXT}</C> : null}</div>
    ${cfg.mount.wrapperClose}
  );
}
window.__setSpec = (v) => { open = !!v; render(); };
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
  writeFileSync(
    path.join(pageDir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="bundle.css">
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

/** The whole-document baseline-diff read (STRING evaluate — the tsx __name
 *  serialization trap). Reads every new root as a full CapturedNode using the
 *  SAME longhand set (window.__ALL_PROPS) and ::before/::after rule as the
 *  census captureJs, plus role/aria-modal for root descent. */
const capturePortalJs = (classAllow?: string) => `(() => {
  const baseline = window.__depthBaseline;
  const stage = document.getElementById(${JSON.stringify(PORTAL_STAGE_ID)});
  const props = window.__ALL_PROPS;
  const allow = ${JSON.stringify(classAllow ?? null)};
  const keepCls = (l) => (allow ? l.filter((c) => new RegExp(allow).test(c)) : l);
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
  const all = [...document.querySelectorAll('*')];
  const newRoots = all.filter((el) => !baseline.has(el) && (!el.parentElement || baseline.has(el.parentElement)));
  const cur = stage && stage.firstElementChild;
  const currentReader = cur
    ? { present: true, sig: cur.tagName.toLowerCase() + '|' + [...cur.classList].filter((c) => !c.includes('--')).map((c) => c.replace(/^Polaris-/, '')).join('.'), descendantEls: cur.querySelectorAll('*').length }
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
 *  role/aria-modal preserved. */
export async function capturePortalRoots(
  page: Page,
  comboKey: string,
  classAllow?: string,
): Promise<PortalCapture> {
  await page.evaluate(`window.__setSpec(false)`);
  await page.waitForTimeout(150);
  await page.evaluate(markBaselineJs);
  await page.evaluate(`window.__setSpec(true)`);
  await page.waitForTimeout(PORTAL_SETTLE_MS);
  const raw = (await page.evaluate(capturePortalJs(classAllow))) as {
    preBytes: number;
    postBytes: number;
    currentReader: PortalCapture['currentReader'];
    roots: Array<{ location: 'in-stage' | 'portaled'; bytes: number; node: CapturedNode }>;
  };
  await page.evaluate(`window.__setSpec(false)`); // reset-per-combo (R1)
  await page.waitForTimeout(120);
  return {
    combo: comboKey,
    preBytes: raw.preBytes,
    postBytes: raw.postBytes,
    currentReader: raw.currentReader,
    roots: raw.roots.map((r) => ({ location: r.location, bytes: r.bytes, node: normalizeNode(r.node) })),
  };
}
