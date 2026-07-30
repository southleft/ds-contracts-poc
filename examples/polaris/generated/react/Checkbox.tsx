/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (polaris.checkbox v0.4.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

const ICONS: Record<string, string> = {
  "checkbox-icon-4": "<svg viewBox=\"0 0 22 22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 5 10 C 5 9.586 5.336 9.25 5.75 9.25 H 14.25 C 14.664 9.25 15 9.586 15 10 S 14.664 10.75 14.25 10.75 H 5.75 C 5.336 10.75 5 10.414 5 10 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "checkbox-icon-6": "<svg viewBox=\"0 0 14 14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 1.5 5.5 L 3.44655 8.22517 C 3.72862 8.62007 4.30578 8.64717 4.62362 8.28044 L 10.5 1.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
};

export interface CheckboxProps extends HTMLAttributes<HTMLSpanElement> {
  /** Checked state (round 4: enumerated as a contract enum — the real API is boolean | 'indeterminate'; the capture maps unchecked→false, checked→true, indeterminate→'indeterminate'). The check/indeterminate glyphs and the checked backdrop ride this axis. */
  checked?: 'unchecked' | 'checked' | 'indeterminate';
  /** Indicates the ID of the element that is controlled by the checkbox */
  ariaControls?: string;
  /** Indicates the ID of the element that describes the checkbox */
  ariaDescribedBy?: string;
  /** Visually hide the label */
  labelHidden?: boolean;
  /** Disable input */
  disabled?: boolean;
  /** Name for form input */
  name?: string;
  /** Value for form input */
  value?: string;
  /** Added to the wrapping label */
  labelClassName?: string;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Checkbox/Checkbox.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: static backdrop bindings (border-color) removed — the checked axis contests them per value; the floor rebuilds from browser truth. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Checkbox = forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  { checked = 'unchecked', labelHidden = false, disabled = false, ariaControls, ariaDescribedBy, name, value, labelClassName, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`checked-${checked}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-label-hidden={labelHidden || undefined} data-disabled={disabled || undefined} {...rest}>
      <span className={styles.choice__control}>
<span className={styles.checkbox}>
<input className={styles.input} type="checkbox" name={String(name)} value={String(value)}>

</input>
<div className={styles.backdrop}>

</div>
<span className={styles["icon-3"]}>
<span className={styles["icon-4"]}><span aria-hidden="true" className={styles["icon-4Glyph"]} dangerouslySetInnerHTML={{ __html: ICONS["checkbox-icon-4"] }} /></span>
<span className={styles["icon-6"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["checkbox-icon-6"] }} />
</span>
<span className={styles.icon}>

</span>
</span>
</span>
<span className={styles.choice__label}>
<span className={styles.label}>Save this product</span>
</span>
    </span>
  );
});
