/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/size-xsmall.contract.json (ds.size-xsmall v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './SizeXsmall.module.css';

export interface SizeXsmallProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  iconSwap?: string;
  size?: 'xsmall';
}

/** STUB contract auto-proposed for the nested "size=xsmall" instances of Checkbox — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const SizeXsmall = forwardRef<HTMLSpanElement, SizeXsmallProps>(function SizeXsmall(
  { size = 'xsmall', iconSwap = '184:89713', className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): size — no `.<axis>-*` rule
  // exists in SizeXsmall.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span className={styles.iconSwap}>{iconSwap}</span>
    </span>
  );
});
