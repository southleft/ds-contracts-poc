/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (astryx.card v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** The surface tone of the card. */
  variant?:
    | 'default'
    | 'transparent'
    | 'muted'
    | 'blue'
    | 'cyan'
    | 'gray'
    | 'green'
    | 'orange'
    | 'pink'
    | 'purple'
    | 'red'
    | 'teal'
    | 'yellow';
}

/** Astryx Card — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Card/Card.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). The single extracted structural axis (variant, 13 values) is verbatim; children is a materialized content slot (Astryx types Card body as ReactNode, dropped as a node prop). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.body}>{children}</div>
    </div>
  );
});
