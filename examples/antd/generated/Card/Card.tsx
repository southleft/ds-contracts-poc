/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (antd.card v0.2.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   title
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  size?: 'default' | 'small';
  variant?: 'outlined' | 'borderless';
  title?: string;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). MOLECULE CONTAINER (the MUI Card precedent with a real head part). `variant` is antd 5.24+'s outlined|borderless (`bordered` is @deprecated, Card.d.ts:17 — seed-gen proposed variant(2)); `size` default|small. title is pinned by the config; the head title renders fontWeightStrong=600, the Roboto-600 substrate residue (examples/antd/README.md). NAMED OUT: cover/actions/extra/tabList/loading. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { size = 'default', variant = 'outlined', title = 'Card title', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`variant-${variant}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles['card-head']}>
        <div className={styles['card-head-wrapper']}>
          <span className={styles.label}>{title}</span>
        </div>
      </div>
      <span className={styles['label-2']}>{children}</span>
    </div>
  );
});
