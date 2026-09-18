/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tabs.contract.json (ds.tabs v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { StateDefaultActiveYes } from '../StateDefaultActiveYes';
import { StateDefaultActiveNo } from '../StateDefaultActiveNo';
import { StateDefault } from '../StateDefault';
import styles from './Tabs.module.css';

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'stretch';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { variant = 'default', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.alCTabsHeader}>
        <div className={styles.alCTabsList}>
          <StateDefaultActiveYes active="yes" state="default" text="Tab label" />
          <StateDefaultActiveNo active="no" state="default" text="Tab label" />
          <StateDefaultActiveNo active="no" state="default" text="Tab label" />
        </div>
      </div>
      <div className={styles.alCTabsBody}>
        <StateDefault state="default" />
      </div>
    </div>
  );
});
