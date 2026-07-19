/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (polaris.button v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Changes the size of the button, giving it more or less padding */
  size?: 'micro' | 'slim' | 'medium' | 'large';
  /** Changes the inner text alignment of the button */
  textAlign?: 'left' | 'right' | 'center' | 'start' | 'end';
  /** Allows the button to grow to the width of its container */
  fullWidth?: boolean;
  /** Removes underline from button text (including on interaction) */
  removeUnderline?: boolean;
  /** Indicates whether or not the button is the primary navigation link when rendered inside of an `IndexTable.Row` */
  dataPrimaryLink?: boolean;
  /** Sets the color treatment of the Button. */
  tone?: 'critical' | 'success';
  /** Changes the visual appearance of the Button. */
  variant?: 'plain' | 'primary' | 'secondary' | 'tertiary' | 'monochromePlain';
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Button/Button.tsx (react-tsx adapter) — API surface only; anatomy, tokens, and design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.2.0 (extract/computed round 2): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), contradictions resolved computed-wins per the decisions ledger (extract/computed/out/button/decisions.md, human-acked; source resolved.contract.json). Everything the vocabulary cannot carry is named in contracts/button.extension.json. Delta ledger: extract/computed/out/button/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size = 'medium', textAlign = 'center', tone = 'undefined', variant = 'secondary', fullWidth = false, removeUnderline = false, dataPrimaryLink = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`textAlign-${textAlign}`], styles[`tone-${tone}`], styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} data-full-width={fullWidth || undefined} data-remove-underline={removeUnderline || undefined} data-data-primary-link={dataPrimaryLink || undefined} {...rest}>
      <span className={styles.label}>Button</span>
    </button>
  );
});
