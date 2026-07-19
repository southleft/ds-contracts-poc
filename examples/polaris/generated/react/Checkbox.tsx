/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (polaris.checkbox v0.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

const ICONS: Record<string, string> = {
  "checkbox-icon-3": "<svg viewBox=\"0 0 22 22\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 5 10 C 5 9.586 5.336 9.25 5.75 9.25 H 14.25 C 14.664 9.25 15 9.586 15 10 S 14.664 10.75 14.25 10.75 H 5.75 C 5.336 10.75 5 10.414 5 10 Z\" fill-rule=\"evenodd\"/></svg>",
  "checkbox-icon-2-unchecked": "<svg viewBox=\"0 0 14 14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 1.5 5.5 L 3.44655 8.22517 C 3.72862 8.62007 4.30578 8.64717 4.62362 8.28044 L 10.5 1.5\" fill=\"none\" opacity=\"0\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-dasharray=\"2\" stroke-dashoffset=\"2\"/></svg>",
  "checkbox-icon-2-checked": "<svg viewBox=\"0 0 14 14\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 1.5 5.5 L 3.44655 8.22517 C 3.72862 8.62007 4.30578 8.64717 4.62362 8.28044 L 10.5 1.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-dasharray=\"2\"/></svg>",
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

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Checkbox/Checkbox.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. ROUND 4: static backdrop bindings (border-color) removed — the checked axis contests them per value; the floor rebuilds from browser truth. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.0 (extract/computed round 4): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, contradictions resolved computed-wins per the decisions ledger (extract/computed/out/checkbox/decisions.md, human-acked; source resolved.contract.json). Everything the vocabulary cannot carry is named in contracts/checkbox.extension.json. Delta ledger: extract/computed/out/checkbox/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
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
<span className={styles.icon}>
<span className={styles.icon-3}><span aria-hidden="true" className={styles.icon-3Glyph} dangerouslySetInnerHTML={{ __html: ICONS["checkbox-icon-3"] }} /></span>
<div className={styles.icon-2}>
{checked === 'unchecked' ? (<span className={styles.icon-2-unchecked} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["checkbox-icon-2-unchecked"] }} />) : null}
{checked === 'checked' ? (<span className={styles.icon-2-checked} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["checkbox-icon-2-checked"] }} />) : null}
</div>
</span>
</span>
</span>
<span className={styles.choice__label}>
<span className={styles.label}>Save this product</span>
</span>
    </span>
  );
});
