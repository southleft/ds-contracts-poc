/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/list-item.contract.json (ds.list-item v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { LiHTMLAttributes, ReactNode } from 'react';
import styles from './ListItem.module.css';

export interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  /** Primary text. */
  label: string;
  /** Secondary content below the label. */
  description?: string;
  /** Leading content — icon or avatar. */
  startContent?: ReactNode;
  /** Trailing content — badge, count, chevron. */
  endContent?: ReactNode;
}

/** A single row in a List: label with optional description, leading and trailing content. API mirrors industry convention (Astryx ListItem); click/link behavior is a declared boundary. */
export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(function ListItem(
  {
    label,
    description = 'Supporting detail for this item.',
    startContent,
    endContent,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <li ref={ref} className={classes} {...rest}>
      {startContent != null ? <div className={styles.startContent}>{startContent}</div> : null}
      <div className={styles.textCol}>
        <span className={styles.labelText}>{label}</span>
        <span className={styles.descriptionText}>{description}</span>
      </div>
      {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
    </li>
  );
});
