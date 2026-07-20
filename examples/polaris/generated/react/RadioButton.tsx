/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/radio-button.contract.json (polaris.radio-button v0.3.2)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './RadioButton.module.css';

export interface RadioButtonProps extends HTMLAttributes<HTMLSpanElement> {
  /** Indicates the ID of the element that describes the radio button */
  ariaDescribedBy?: string;
  /** Visually hide the label */
  labelHidden?: boolean;
  /** Checked state (round 4: enumerated as a contract enum over the real boolean API — capture maps unchecked→false, checked→true). The selected dot and checked backdrop ride this axis; the generated code surface spells it as the enum (named deviation from the boolean library prop). */
  checked?: 'unchecked' | 'checked';
  /** Disable input */
  disabled?: boolean;
  /** Name for form input */
  name?: string;
  /** Value for form input */
  value?: string;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/RadioButton/RadioButton.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: static backdrop bindings (border-color, background-color) removed — the checked axis contests them per value; the floor rebuilds from browser truth. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, zero binding contradictions in the review queue (source enriched.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/radio-button.extension.json. Delta ledger: extract/computed/out/radiobutton/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const RadioButton = forwardRef<HTMLSpanElement, RadioButtonProps>(function RadioButton(
  { checked = 'unchecked', labelHidden = false, disabled = false, ariaDescribedBy, name, value, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`checked-${checked}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-label-hidden={labelHidden || undefined} data-disabled={disabled || undefined} {...rest}>
      <span className={styles.choice__control}>
<span className={styles.radiobutton}>
<input className={styles.input} type="radio" name={String(name)} value={String(value)}>

</input>
<div className={styles.backdrop}>

</div>
<div className={styles["backdrop-before"]}>

</div>
</span>
</span>
<span className={styles.choice__label}>
<span className={styles.label}>Accounts are disabled</span>
</span>
    </span>
  );
});
