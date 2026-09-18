/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/typeahead-item.contract.json (ds.typeahead-item v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './TypeaheadItem.module.css';

export interface TypeaheadItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Primary result text. */
  label: string;
  /** Secondary text below the label. */
  description?: string;
  /** Icon or avatar before the label. */
  icon?: ReactNode;
}

/** Default dropdown item for search results: label with optional icon and description. API mirrors industry convention (Astryx TypeaheadItem) with the item object flattened to explicit props. */
export const TypeaheadItem = forwardRef<HTMLDivElement, TypeaheadItemProps>(function TypeaheadItem(
  {
    label,
    description = 'Supporting detail about this result.',
    icon,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} role="option" {...rest}>
      {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
      <div className={styles.textCol}>
        <span className={styles.labelText}>{label}</span>
        <span className={styles.descriptionText}>{description}</span>
      </div>
    </div>
  );
});
