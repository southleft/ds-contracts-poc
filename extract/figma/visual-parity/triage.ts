/**
 * TRIAGE — the committed named-cause table for visual-parity rows.
 *
 * Every diffed row over the 3% masked line must match a rule here or the
 * report prints it as **UNTRIAGED** (loud, ranked first in the distribution
 * section) — a standing queue entry, never a silent residue. Rules are
 * CLASSED so the distribution can say what kind of delta remains:
 *
 *   · engine       — our emitters render the contract wrong. FIX IT; a rule
 *                    of this class is an open defect being tracked, and the
 *                    report says so.
 *   · capture-gap  — the dump cannot carry the channel (receipted in the
 *                    dump's _degradations / proposal notes — e.g. VECTOR
 *                    glyph geometry #42, text lineHeight, child internals
 *                    behind an out-of-scope contract).
 *   · renderer     — Chromium and Figma disagree about the same fact (font
 *                    rasterization + text-hug metrics, shadow blur kernels,
 *                    curved-edge antialiasing). Named in the report header;
 *                    not tolerated away — the score still counts it.
 *   · harness      — the measurement itself (ALPHA_TRIM content-box
 *                    cropping + center padding) compounds a small real delta
 *                    on rows whose ink is mostly transparent.
 *   · design       — the FIGMA side draws something else (state previews
 *                    the generated file has not re-synced; canvas previews
 *                    that cannot draw browser focus rings).
 *
 * A rule names its evidence (receipt / commit / dump note) in one line.
 * Adding a rule is a reviewed act: the cause must be verifiable, not a
 * shrug. Deleting the row's cause (by fixing it) is the goal.
 */

export type CauseClass = 'engine' | 'capture-gap' | 'renderer' | 'harness' | 'design';

export interface TriageRule {
  subject: string;
  /** Matched against the variant name; omit = every variant of the subject. */
  variant?: RegExp;
  class: CauseClass;
  /** One line, evidence named. */
  cause: string;
}

export const TRIAGE: TriageRule[] = [
  // ---- button (catalog contract vs generated main-file set) ---------------
  {
    subject: 'button',
    variant: /State=Disabled/,
    class: 'design',
    cause:
      'Figma set predates the literal-opacity engine fix (5ebb58e): the synced Disabled preview still binds the 0–1 opacity token into Figma\'s percent-scaled field and washes to near-white — main file awaits re-sync; our render is the contract truth (opacity 0.5)',
  },
  {
    subject: 'button',
    variant: /State=Focus Visible/,
    class: 'design',
    cause:
      'our row is a REAL keyboard-focus screenshot whose outline (2px, offset 2px) extends the painted box; the generated Figma State=Focus Visible preview paints no ring outside the component bounds (content boxes 180×88 vs 166×70 by construction)',
  },
  {
    subject: 'button',
    class: 'renderer',
    cause:
      'text-hug metrics: Figma hugs the Inter label at lineHeightPx 19.36 (node 83×35) while the CSS line box is 20px (ours 82×36) — the ±1–2 CSS px hug delta rings the filled surface after center-padding; glyph raster differs on top (masked)',
  },

  // ---- heading (all-text subject: masked score undefined by construction) --
  {
    subject: 'heading',
    class: 'renderer',
    cause:
      'all-text subject — the text mask covers everything, so the masked score is null and the row ranks by its unmasked font-raster delta (Figma vs CoreText glyph rasterization; size Δ≤1px is advance-width hug)',
  },

  // ---- checkbox / switch (catalog contracts) --------------------------------
  {
    subject: 'checkbox',
    class: 'renderer',
    cause:
      'label advance-width hug (ours Δ-7 device px) shifts the center-padded pair; residual masked ink is the control-box edge ring + Figma label pixels escaping the DOM-derived text mask',
  },
  {
    subject: 'switch',
    class: 'renderer',
    cause:
      'label advance-width hug (ours Δ-6 device px) shifts the center-padded pair; residual masked ink is the thumb/track edge ring + Figma label pixels escaping the DOM-derived text mask',
  },

  // ---- shoelace-button-group (kit redraw; child Button is a STUB) -----------
  {
    subject: 'shoelace-button-group',
    variant: /type=default/,
    class: 'capture-gap',
    cause:
      'child Button is a STUB (observed box + fill only — the Shoelace kit\'s real Button set is not in the dump): the default button\'s gray border ring and label chrome have no witness, so ours paints an unbordered box (stroke inconsistent across observed variants — named stub note)',
  },
  {
    subject: 'shoelace-button-group',
    variant: /type=primary/,
    class: 'capture-gap',
    cause:
      'child Button is a STUB: primary fill carries (observed paint), but the stub\'s internal label inset/weight and pill radius are child internals with no witness — residual is stub-internal chrome + label raster',
  },

  // ---- shoelace-tooltip (arrows are VECTOR nodes) ----------------------------
  {
    subject: 'shoelace-tooltip',
    class: 'capture-gap',
    cause:
      'arrow VECTOR geometry is not in the dump (#42 — receipted vector-geometry-unsupported ×8 / rotation-unsupported ×6): Figma renders the arrow (Δ12 device px on the arrow axis), ours renders the box only; per-placement layout itself differs correctly (layoutByProp)',
  },

  // ---- eventz-button (client kit; icons are child stubs; secondary/bare washed)
  {
    subject: 'eventz-button',
    variant: /variant=bare, state=(default|active)/,
    class: 'capture-gap',
    cause:
      'Figma renders the bare variant\'s design-time slot instances (icon + spacing, 149px wide) that the dump carries only as slot defaultContent stubs — ours renders the 66px text-only truth of the contract\'s empty-slot state (named proposal note)',
  },
  {
    subject: 'eventz-button',
    variant: /state=focus/,
    class: 'renderer',
    cause:
      'real-browser focus ring vs Figma\'s drawn ring: ring corner geometry and blur differ per renderer (Δ-6 device px width is the icon-stub inset below), residual is ring-edge ink',
  },
  {
    subject: 'eventz-button',
    variant: /variant=secondary, state=default, isDisabled=true/,
    class: 'harness',
    cause:
      'transparent-ink row (ALPHA_TRIM alignment sensitivity): the 5%-black fill × 0.4 disabled opacity trims below the alpha threshold on Figma\'s side (content box collapses 218→149px) while ours keeps edge ink — the crop pair misaligns and the mismatch compounds; no shared coordinate frame exists to anchor the two crops (screenshot clip vs node render), documented in the header',
  },
  {
    subject: 'eventz-button',
    class: 'capture-gap',
    cause:
      'startIcon/endIcon render as child STUBS (observed geometry, no glyph ink — ds.play/ds.pause VECTOR internals are #42, receipted): Figma paints the glyphs, ours paints the reserved boxes; text lineHeight rides the receipted text-channel-unsupported limit',
  },

  // ---- cbds-tooltip (owner file; pointer POLYGON) ----------------------------
  {
    subject: 'cbds-tooltip',
    variant: /pointer=true/,
    class: 'capture-gap',
    cause:
      'pointer POLYGON geometry is not in the plugin dump (vector-geometry class #42; the REST fixture carries it, the plugin channel does not): Figma renders the arrow per placement (Δ up to 19 device px on the pointer axis), ours renders the box; height Δ8 is the receipted text-lineHeight limit + text-hug metrics',
  },
  {
    subject: 'cbds-tooltip',
    class: 'renderer',
    cause:
      'text-hug metrics + receipted text-lineHeight capture limit: ours hugs the two text lines 4 CSS px taller than Figma (Δ8 device px), width Δ-4 is advance-width hug; shadow blur kernels differ at the edge',
  },

  // ---- cbds-dialog (owner file; session-scoped child imports) ----------------
  {
    subject: 'cbds-dialog',
    variant: /size=small-vertical/,
    class: 'capture-gap',
    cause:
      'vertical-actions layout renders child buttons the session scope does not carry full-width/stacked (Action 2 + close glyph are child internals behind instance-level overrides — the receipted instance-level FILL/override vocabulary limit); size delta follows from the missing children',
  },
  {
    subject: 'cbds-dialog',
    class: 'renderer',
    cause:
      'height Δ8 device px is text-hug metrics across title/body lines (receipted text-lineHeight limit rides the same rows); width matches exactly (border-box minting)',
  },

  // ---- cbds-button-brand-primary ---------------------------------------------
  {
    subject: 'cbds-button-brand-primary',
    variant: /state=focus/,
    class: 'renderer',
    cause:
      'focus-ring corner arcs: CSS outline and Figma\'s drawn ring round their corners with different geometry/antialiasing — residual ink is the four corner arcs (~370 device px)',
  },
  {
    subject: 'cbds-button-brand-primary',
    class: 'renderer',
    cause: 'label glyph rasterization (masked ≤0.01%); size Δ2 device px is advance-width hug',
  },

  // ---- badge (near-zero rows keep a named class for completeness) ------------
  {
    subject: 'badge',
    class: 'renderer',
    cause: 'label glyph rasterization only (masked 0.00%)',
  },
];

export function triageFor(subject: string, variant: string): TriageRule | null {
  for (const rule of TRIAGE) {
    if (rule.subject !== subject) continue;
    if (rule.variant && !rule.variant.test(variant)) continue;
    return rule;
  }
  return null;
}
