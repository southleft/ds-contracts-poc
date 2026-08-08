/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-text-link.contract.json (ds.atoms-text-link v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './AtomsTextLink.module.css';

export interface AtomsTextLinkProps extends HTMLAttributes<HTMLSpanElement> {
  hasStartIcon?: boolean;
  hasEndIcon?: boolean;
  text?: string;
  emphasis?: 'inverted';
  state?: 'default';
}

/** STUB contract auto-proposed for the nested "Atoms/Text Link" instances of Molecules/Alert — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const AtomsTextLink = forwardRef<HTMLSpanElement, AtomsTextLinkProps>(function AtomsTextLink(
  {
    emphasis = 'inverted',
    state = 'default',
    hasStartIcon = false,
    hasEndIcon = false,
    text = 'Label',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): emphasis, state — no `.<axis>-*` rule
  // exists in AtomsTextLink.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span
      ref={ref}
      className={classes}
      data-has-start-icon={hasStartIcon || undefined}
      data-has-end-icon={hasEndIcon || undefined}
      {...rest}
    >
      <span className={styles.text}>{text}</span>
    </span>
  );
});
