/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button-helper-leading-icon-1.contract.json (ds.button-helper-leading-icon-1 v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ButtonHelperLeadingIcon1.module.css';

export interface ButtonHelperLeadingIcon1Props extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {}

/** STUB contract auto-proposed for the nested "__button/helper/leading / icon@1" instances of button/set :: Button / button@1 proof — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const ButtonHelperLeadingIcon1 = forwardRef<HTMLSpanElement, ButtonHelperLeadingIcon1Props>(
  function ButtonHelperLeadingIcon1({ className, ...rest }, ref) {
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return <span ref={ref} className={classes} {...rest}></span>;
  },
);
