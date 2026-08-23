/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar.contract.json (antd.avatar v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'small' | 'default' | 'large';
  shape?: 'circle' | 'square';
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). ATOM, SIZE×SHAPE (the MUI Avatar precedent plus antd's real size enum small|default|large → 24/32/40px). The text child is ONE glyph on purpose: antd's text-fit ResizeObserver writes an inline `transform: scale(n)` on span.ant-avatar-string (scale(1) for a single initial; a T3 dynamic channel if the initial overflowed). NAMED OUT: `icon` (child SWAP — replaces the string part), `src`, numeric `size`, `gap`. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = 'default', shape = 'circle', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`shape-${shape}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.label}>{children}</span>
    </span>
  );
});
