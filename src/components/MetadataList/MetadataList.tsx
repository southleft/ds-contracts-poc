/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/metadata-list.contract.json (ds.metadata-list v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './MetadataList.module.css';

export interface MetadataListProps extends HTMLAttributes<HTMLDivElement> {
  /** Heading above the list. */
  title?: string;
}

/** Key–value pairs for object attributes — detail panels, settings summaries, record information. API mirrors industry convention (Astryx MetadataList); multi-column layout and collapse behavior are documented boundaries. */
export const MetadataList = forwardRef<HTMLDivElement, MetadataListProps>(function MetadataList(
  { title = 'Details', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <span className={styles.titleText}>{title}</span>
      <div className={styles.items}>{children}</div>
    </div>
  );
});
