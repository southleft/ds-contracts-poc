/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (polaris.button v0.3.2)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

const ICONS: Record<string, string> = {
  "button-icon-2": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 6.25 10 A 0.75 0.75 0 0 1 7 9.25 H 9.25 V 7 A 0.75 0.75 0 0 1 10.75 7 V 9.25 H 13 A 0.75 0.75 0 0 1 13 10.75 H 10.75 V 13 A 0.75 0.75 0 0 1 9.25 13 V 10.75 H 7 A 0.75 0.75 0 0 1 6.25 10 Z\"/><path d=\"M 10 17 A 7 7 0 1 0 10 3 A 7 7 0 0 0 10 17 Z M 10 15.5 A 5.5 5.5 0 1 0 10 4.5 A 5.5 5.5 0 0 0 10 15.5 Z\" fill-rule=\"evenodd\"/></svg>",
};

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
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `icon` ({"$import":"@shopify/polaris-icons#PlusCircleIcon"}); the created subtree is carried as parts gated on this prop. */
  withIcon?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Button/Button.tsx (react-tsx adapter) — API surface only; anatomy, tokens, and design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.2 (extract/computed rounds 4 + 5c + 5d): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, contradictions resolved computed-wins per the decisions ledger (extract/computed/out/button/decisions.md, human-acked; source resolved.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Round 5d lifts (owner visual review): svg dash channels are DROPPED with a named receipt — they are pathLength-relative and pathLength is not a computed style, so the settled draw-on stroke carries as the continuous resting glyph (the Checkbox check); and a carried CSS SHORTHAND covers every constituent longhand in fusion coverage (border-radius all four corners, border-width/-color all four sides, gap both gaps) — the minted sibling longhands that overrode semantic bindings (Badge radius corners as imported.shared.size-8 over {p.border-radius-200}) are retired. Everything the vocabulary cannot carry is named in contracts/button.extension.json. Delta ledger: extract/computed/out/button/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size = 'medium', textAlign = 'center', tone = 'undefined', variant = 'secondary', fullWidth = false, removeUnderline = false, dataPrimaryLink = false, withIcon = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`textAlign-${textAlign}`], styles[`tone-${tone}`], styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} data-full-width={fullWidth || undefined} data-remove-underline={removeUnderline || undefined} data-data-primary-link={dataPrimaryLink || undefined} data-with-icon={withIcon || undefined} {...rest}>
      {withIcon ? (<span className={styles.icon}>
{withIcon ? (<span className={styles["icon-2"]}><span aria-hidden="true" className={styles["icon-2Glyph"]} dangerouslySetInnerHTML={{ __html: ICONS["button-icon-2"] }} /></span>) : null}
</span>) : null}
<span className={styles.label}>Button</span>
    </button>
  );
});
