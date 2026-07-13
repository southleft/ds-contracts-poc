/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/pause.contract.json (ds.pause v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Pause.module.css';

export interface PauseProps extends HTMLAttributes<HTMLSpanElement> {

}

/** STUB contract auto-proposed for the nested "pause" instances of Button — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const Pause = forwardRef<HTMLSpanElement, PauseProps>(function Pause(
  { className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      
    </span>
  );
});
