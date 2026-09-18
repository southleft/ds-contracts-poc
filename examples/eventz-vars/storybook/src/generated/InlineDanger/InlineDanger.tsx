/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/inline-danger.contract.json (ds.inline-danger v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './InlineDanger.module.css';

export interface InlineDangerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  supportingText?: string;
}

/** STUB contract auto-proposed for the nested ".Inline danger" instances of Atoms/Input — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const InlineDanger = forwardRef<HTMLSpanElement, InlineDangerProps>(function InlineDanger(
  { supportingText = 'Danger text', className, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.supportingText}>{supportingText}</span>
    </span>
  );
});
