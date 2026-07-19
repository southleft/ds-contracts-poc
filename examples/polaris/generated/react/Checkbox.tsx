/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (polaris.checkbox v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends HTMLAttributes<HTMLSpanElement> {
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

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Checkbox/Checkbox.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.2.0 (extract/computed round 2): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), contradictions resolved computed-wins per the decisions ledger (extract/computed/out/checkbox/decisions.md, human-acked; source resolved.contract.json). Everything the vocabulary cannot carry is named in contracts/checkbox.extension.json. Delta ledger: extract/computed/out/checkbox/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Checkbox = forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  { labelHidden = false, disabled = false, ariaControls, ariaDescribedBy, name, value, labelClassName, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-label-hidden={labelHidden || undefined} data-disabled={disabled || undefined} {...rest}>
      <input className={styles.input} type="checkbox" name={String(name)} value={String(value)}>

</input>
<div className={styles.backdrop}>

</div>
    </span>
  );
});
