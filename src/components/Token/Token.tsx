/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/token.contract.json (ds.token v1.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Token.module.css';

export interface TokenProps extends HTMLAttributes<HTMLSpanElement> {
  /** Color variant. */
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
  /** Token size. */
  size?: 'sm' | 'md' | 'lg';
  /** Reduces opacity and blocks interactions. */
  isDisabled?: boolean;
  /** Text label inside the token. */
  label: string;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Content after the label — a count Badge, a chevron. */
  endContent?: ReactNode;
}

/** Small inline element for discrete associated data — tags, categories, active filters. API mirrors industry convention (Astryx Token): 11-color vocabulary with size scale; removal and click behavior are a declared boundary. v1.1.0: the size scale is LIVE via tokensByProp (it was declared but bound to fixed tokens — a dead prop): md keeps the original rendering; sm tightens padding-inline to {space.inset-y.sm} (4px — cross-axis reuse, the Switch/List precedent; no smaller inset-x token exists, and no font token below 12px exists so sm keeps the base font); lg steps font to {font.control.size.sm} and padding to {space.inset-x.sm}/{space.inset-y.sm}. Existing repo tokens only — nothing minted. */
export const Token = forwardRef<HTMLSpanElement, TokenProps>(function Token(
  {
    color = 'default',
    size = 'md',
    isDisabled = false,
    label,
    icon,
    endContent,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`color-${color}`], styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <span ref={ref} className={classes} data-is-disabled={isDisabled || undefined} {...rest}>
      {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
      <span className={styles.labelText}>{label}</span>
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </span>
  );
});
