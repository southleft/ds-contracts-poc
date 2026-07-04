/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab.contract.json (ds.tab v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Tab.module.css';

export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selection state — selected tabs render semibold in the accent color. */
  state?: 'default' | 'selected';
  /** Visible tab text. */
  label: string;
  icon?: ReactNode;
  /** Badge count or status dot after the label. */
  endContent?: ReactNode;
}

/** A single tab in a TabList. API mirrors industry convention (Astryx Tab) with selection flattened to a state enum so both surfaces render it truthfully; selection behavior itself is a declared boundary. */
export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { state = 'default', label, icon, endContent, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} role="tab" {...rest}>
      {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
      <span className={styles.labelText}>{label}</span>
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </button>
  );
});
