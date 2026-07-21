/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/token.contract.json (astryx.token v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Token.module.css';

export interface TokenProps extends HTMLAttributes<HTMLSpanElement> {
  /** Tag label. */
  label: string;
  /** The size of the tag. */
  size?: 'sm' | 'md' | 'lg';
  /** The tag color. */
  color?:
    | 'default'
    | 'red'
    | 'orange'
    | 'yellow'
    | 'green'
    | 'teal'
    | 'cyan'
    | 'blue'
    | 'purple'
    | 'pink'
    | 'gray';
  /** Whether the tag is disabled. */
  isDisabled?: boolean;
}

/** Astryx Token (Tag/Chip) — promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Token/Token.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). size + color axes and the disabled/optional flags are verbatim; href link-mode and the description/isLabelHidden a11y text are dropped (documented). CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). */
export const Token = forwardRef<HTMLSpanElement, TokenProps>(function Token(
  { size = 'md', color = 'default', isDisabled = false, label, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], styles[`color-${color}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <span ref={ref} className={classes} data-is-disabled={isDisabled || undefined} {...rest}>
      <span className={styles.label}>{label}</span>
    </span>
  );
});
