/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/alert.contract.json (ds.alert v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Alert.module.css';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'info' | 'warning' | 'danger';
  titletext?: string;
  descriptiontext?: string;
  hasicon?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant = 'success', hasicon = false, titletext = 'Title', descriptiontext = 'Description', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-hasicon={hasicon || undefined} {...rest}>
      {hasicon ? (<div className={styles.container}>
<div className={styles.Icon}>

</div>
</div>) : null}
<div className={styles.contentStack}>
<div className={styles.textStack}>
<span className={styles.Title}>{titletext}</span>
<span className={styles.Description}>{descriptiontext}</span>
</div>
</div>
    </div>
  );
});
