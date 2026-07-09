/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tooltip.contract.json (ds.tooltip v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  placement?: 'left' | 'topleft' | 'bottomleft' | 'bottom' | 'top' | 'topright' | 'bottomright' | 'right';
  text?: string;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  { placement = 'left', text = 'Tooltip text', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`placement-${placement}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.Body}>
<div className={styles.Content}>
<span className={styles.tooltipText}>{text}</span>
</div>
</div>
<div className={styles.arrowWrapper}>
<div className={styles.Arrow}>

</div>
</div>
    </div>
  );
});
