/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/empty-state.contract.json (ds.empty-state v1.0.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   title
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Primary message. */
  title: string;
  /** Secondary text explaining what will appear here and how. */
  description?: string;
  /** Decorative icon or illustration above the title. */
  icon?: ReactNode;
  /** Action buttons below the description. */
  actions?: ReactNode;
}

/** Placeholder for a content area with no data — empty lists, zero results, first-time setup. API mirrors industry convention (Astryx EmptyState): always a title and a next step; the icon is decorative. */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  {
    title,
    description = 'When items are added they will show up in this list.',
    icon,
    actions,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {icon != null ? (
        <div className={styles.iconArea} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <span className={styles.title}>{title}</span>
      <span className={styles.descriptionText}>{description}</span>
      {actions != null ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
});
