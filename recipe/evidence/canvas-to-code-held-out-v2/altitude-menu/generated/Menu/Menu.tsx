/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/menu.contract.json (ds.menu v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { StateDefaultSelectedNoRoleItem } from '../StateDefaultSelectedNoRoleItem';
import styles from './Menu.module.css';

export interface MenuProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'simple';
  items?: Array<{ text: string }>;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Menu = forwardRef<HTMLDivElement, MenuProps>(function Menu(
  { variant = 'default', items, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.alCMenuList}>
        {items?.map((item, index) => (
          <StateDefaultSelectedNoRoleItem
            key={index}
            role="item"
            selected="no"
            state="default"
            text={item.text}
          />
        ))}
      </div>
    </div>
  );
});
