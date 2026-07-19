/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/spinner.contract.json (polaris.spinner v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Spinner.module.css';

const ICONS: Record<string, string> = {
  "polaris-spinner-large": "<svg viewBox=\"0 0 44 44\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M15.542 1.487A21.507 21.507 0 00.5 22c0 11.874 9.626 21.5 21.5 21.5 9.847 0 18.364-6.675 20.809-16.072a1.5 1.5 0 00-2.904-.756C37.803 34.755 30.473 40.5 22 40.5 11.783 40.5 3.5 32.217 3.5 22c0-8.137 5.3-15.247 12.942-17.65a1.5 1.5 0 10-.9-2.863z\" /></svg>",
  "polaris-spinner-small": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7.229 1.173a9.25 9.25 0 1011.655 11.412 1.25 1.25 0 10-2.4-.698 6.75 6.75 0 11-8.506-8.329 1.25 1.25 0 10-.75-2.385z\" /></svg>",
};

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Size of spinner */
  size?: 'small' | 'large';
  /** Accessible label for the spinner */
  accessibilityLabel?: string;
  /** Allows the component to apply the correct accessibility roles based on focus */
  hasFocusableParent?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Spinner/Spinner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 'large', hasFocusableParent = false, accessibilityLabel, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-has-focusable-parent={hasFocusableParent || undefined} {...rest}>
      {size === 'large' ? (<span className={styles.glyphLarge} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["polaris-spinner-large"] }} />) : null}
{size === 'small' ? (<span className={styles.glyphSmall} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["polaris-spinner-small"] }} />) : null}
    </span>
  );
});
