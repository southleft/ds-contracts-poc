/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/spinner.contract.json (fluent.spinner v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?:
    'extra-tiny' | 'tiny' | 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large' | 'huge';
  appearance?: 'primary' | 'inverted';
  labelPosition?: 'above' | 'below' | 'before' | 'after';
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: size=medium, appearance=primary, labelPosition=after, delay=0 (pinned). RECON H8: fui-Spinner__spinner runs `animation: rb7n1on 1.5s infinite` and its transform was MEASURED moving between two reads 300ms apart — the steady-state probe can never settle it. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(function Spinner(
  {
    size = 'medium',
    appearance = 'primary',
    labelPosition = 'after',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`size-${size}`],
    styles[`appearance-${appearance}`],
    styles[`labelPosition-${labelPosition}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <span className={styles.spinner}>
        <span className={styles.spinnertail}></span>
      </span>
      <label className={styles.label}>Loading</label>
    </div>
  );
});
