/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-add-button.contract.json (ds.avatar-add-button v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Plus } from '../Plus';
import styles from './AvatarAddButton.module.css';

export interface AvatarAddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AvatarAddButton = forwardRef<HTMLButtonElement, AvatarAddButtonProps>(
  function AvatarAddButton({ size = 'xs', disabled = false, className, children, ...rest }, ref) {
    const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
    return (
      <button ref={ref} className={classes} disabled={disabled} {...rest}>
        <div className={styles.Content}>
          <Plus />
        </div>
      </button>
    );
  },
);
