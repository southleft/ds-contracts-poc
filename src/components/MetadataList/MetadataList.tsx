/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/metadata-list.contract.json (ds.metadata-list v1.0.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   title
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './MetadataList.module.css';

export interface MetadataListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
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
