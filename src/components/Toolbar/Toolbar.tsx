/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/toolbar.contract.json (ds.toolbar v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Toolbar.module.css';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Minimum toolbar height; children keep their own sizes. */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label for the toolbar. */
  label: string;
  /** Start-aligned actions — buttons, segmented controls, selectors. */
  startContent?: ReactNode;
  /** Centered content. */
  centerContent?: ReactNode;
  /** End-aligned primary actions, selectors, badges. */
  endContent?: ReactNode;
}

/** General-purpose toolbar container with start, center, and end content areas for contextual actions. API mirrors industry convention (Astryx Toolbar); roving-tabindex keyboard behavior is a declared boundary. */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { size = 'md', label, startContent, centerContent, endContent, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role="toolbar" {...rest}>
      {startContent != null ? <div className={styles.startContent}>{startContent}</div> : null}
      {centerContent != null ? <div className={styles.centerContent}>{centerContent}</div> : null}
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </div>
  );
});
