/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-add-button.contract.json (ds.avatar-add-button v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Plus } from '../Plus';
import styles from './AvatarAddButton.module.css';

export interface AvatarAddButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AvatarAddButton = forwardRef<HTMLButtonElement, AvatarAddButtonProps>(
  function AvatarAddButton({ size = 'xs', disabled = false, className, ...rest }, ref) {
    const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
    return (
      <button ref={ref} className={classes} disabled={disabled} {...rest}>
        <div className={styles.Content}>
          <span className={styles.plus}>
            <Plus />
          </span>
        </div>
      </button>
    );
  },
);
