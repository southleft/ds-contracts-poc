/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (ds.card v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'default' | 'small';
  variant?: 'outlined' | 'borderless';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { size = 'default', variant = 'outlined', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`variant-${variant}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.cardHead}>
        <div className={styles.cardHeadWrapper}>
          <span className={styles.label}>Card title</span>
        </div>
      </div>
      <div className={styles.label2}>
        <span className={styles.label2Text}>Card body copy for the exam.</span>
      </div>
    </div>
  );
});
