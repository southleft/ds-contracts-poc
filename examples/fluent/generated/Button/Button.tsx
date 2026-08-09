/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (fluent.button v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  appearance?: 'secondary' | 'primary' | 'outline' | 'subtle' | 'transparent';
  size?: 'small' | 'medium' | 'large';
  shape?: 'rounded' | 'circular' | 'square';
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: appearance=secondary, size=medium, shape=rounded, iconPosition=before (pinned, not an axis — the `icon` SLOT is deferred by name, RECON §3c). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { appearance = 'secondary', size = 'medium', shape = 'rounded', className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`appearance-${appearance}`],
    styles[`size-${size}`],
    styles[`shape-${shape}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});
