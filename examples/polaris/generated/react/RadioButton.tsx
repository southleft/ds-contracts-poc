/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/radio-button.contract.json (polaris.radio-button v0.4.0)
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

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/RadioButton/RadioButton.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: static backdrop bindings (border-color, background-color) removed — the checked axis contests them per value; the floor rebuilds from browser truth. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const RadioButton = forwardRef<HTMLSpanElement, RadioButtonProps>(function RadioButton(
  { checked = 'unchecked', labelHidden = false, disabled = false, ariaDescribedBy, name, value, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`checked-${checked}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-label-hidden={labelHidden || undefined} data-disabled={disabled || undefined} {...rest}>
      <span className={styles.choice__control}>
<span className={styles.radiobutton}>
<input className={styles.input} type="radio" name={name} value={value}>

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
