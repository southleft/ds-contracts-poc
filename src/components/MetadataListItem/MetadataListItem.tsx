/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/metadata-list-item.contract.json (ds.metadata-list-item v1.0.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './MetadataListItem.module.css';

export interface MetadataListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The key text. */
  label: string;
  /** The value text. Use the children slot instead for rich values. */
  value?: string;
  /** Icon before the label. */
  icon?: ReactNode;
}

/** One key–value pair in a MetadataList: a label and a value area. API mirrors industry convention (Astryx MetadataListItem). */
export const MetadataListItem = forwardRef<HTMLDivElement, MetadataListItemProps>(
  function MetadataListItem({ label, value = 'Value', icon, className, ...rest }, ref) {
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return (
      <div ref={ref} className={classes} {...rest}>
        {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
        <span className={styles.labelText}>{label}</span>
        <span className={styles.valueText}>{value}</span>
      </div>
    );
  },
);
