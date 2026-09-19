/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-company-icon.contract.json (ds.avatar-company-icon v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './AvatarCompanyIcon.module.css';

export interface AvatarCompanyIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: 'xl' | '2xl' | 'lg' | 'md' | 'sm' | 'xs';
}

/** STUB contract auto-proposed for the nested "_Avatar company icon" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const AvatarCompanyIcon = forwardRef<HTMLSpanElement, AvatarCompanyIconProps>(
  function AvatarCompanyIcon({ size = 'xl', className, ...rest }, ref) {
    const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
    return <span ref={ref} className={classes} {...rest}></span>;
  },
);
