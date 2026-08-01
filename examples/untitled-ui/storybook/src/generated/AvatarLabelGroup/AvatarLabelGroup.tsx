/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-label-group.contract.json (ds.avatar-label-group v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Avatar } from '../Avatar';
import styles from './AvatarLabelGroup.module.css';

export interface AvatarLabelGroupProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'lg' | 'xl' | 'sm';
  statusIcon?: 'onlineIndicator' | 'company' | 'false';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AvatarLabelGroup = forwardRef<HTMLDivElement, AvatarLabelGroupProps>(
  function AvatarLabelGroup(
    { size = 'md', statusIcon = 'onlineIndicator', className, children, ...rest },
    ref,
  ) {
    // axis-inert (ledgered, not a throw): statusIcon — no `.<axis>-*` rule
    // exists in AvatarLabelGroup.module.css, so no class is composed for it. A reference
    // to an unemitted class resolves to `undefined` and is filtered out, so emitting
    // one only made a style-less axis LOOK styled. Whatever this axis carries rides
    // structure (a gated part, a per-value text/icon lookup, a child's own props) —
    // or, where the source drew no difference at all, nothing.
    const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
    return (
      <div ref={ref} className={classes} {...rest}>
        <Avatar size={size} text={false} statusIcon={statusIcon} state="default" />
        <div className={styles.textAndSupportingText}>
          <span className={styles.Text}>Olivia Rhye</span>
          <span className={styles.supportingText}>olivia@untitledui.com</span>
        </div>
      </div>
    );
  },
);
