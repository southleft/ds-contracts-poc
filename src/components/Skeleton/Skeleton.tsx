/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/skeleton.contract.json (ds.skeleton v1.0.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The shape being previewed. */
  variant?: 'text' | 'rect' | 'circle';
}

/** Pulsing placeholder previewing the shape of loading content. API mirrors industry convention (Astryx Skeleton) with the free-form width/height flattened to a shape variant; the pulse is CSS-only — the canvas shows the static shape. */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { variant = 'text', className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} aria-hidden="true" {...rest}>
      <span className={styles.block}></span>
    </span>
  );
});
