/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-passage.contract.json (ds.text-passage v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TextPassage.module.css';

export interface TextPassageProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  state?: 'default';
  width?: 'default';
}

/** STUB contract auto-proposed for the nested "Text Passage" instances of Tab Panel — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const TextPassage = forwardRef<HTMLSpanElement, TextPassageProps>(function TextPassage(
  { state = 'default', width = 'default', className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): state, width — no `.<axis>-*` rule
  // exists in TextPassage.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...rest}></span>;
});
