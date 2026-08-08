/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-tag.contract.json (ds.atoms-tag v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { IconsPlaceholder } from '../IconsPlaceholder';
import styles from './AtomsTag.module.css';

export interface AtomsTagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isInteractive?: boolean;
  variant?: 'parent' | 'child';
  isActive?: boolean;
  label?: string;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AtomsTag = forwardRef<HTMLButtonElement, AtomsTagProps>(function AtomsTag(
  {
    variant = 'parent',
    isInteractive = true,
    isActive = true,
    label = 'Label',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): variant — no `.<axis>-*` rule
  // exists in AtomsTag.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      data-is-interactive={isInteractive || undefined}
      data-is-active={isActive || undefined}
      {...rest}
    >
      <span className={styles.Label}>{label}</span>
      <IconsPlaceholder size="20" />
    </button>
  );
});
