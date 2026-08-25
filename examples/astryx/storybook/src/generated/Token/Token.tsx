/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/token.contract.json (astryx.token v0.3.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLSpanElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   color
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Token.module.css';

export interface TokenProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
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

/** Astryx Token (Tag/Chip) — a compact labelled chip. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/Token/Token.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label/size/color and isDisabled are verbatim; href link-mode, description and isLabelHidden are dropped. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/token/decisions.md); extension sidecar carries the named overflow. */
export const Token = forwardRef<HTMLSpanElement, TokenProps>(function Token(
  { size = 'md', color = 'default', isDisabled = false, label, className, children, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): size — no `.<axis>-*` rule
  // exists in Token.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`color-${color}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-is-disabled={isDisabled || undefined} {...rest}>
      <span className={styles.label}>{label}</span>
    </span>
  );
});
