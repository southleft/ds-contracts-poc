/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/card.contract.json (ds.card v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Avatar } from '../Avatar';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Card heading, bound to the header title part on both surfaces. */
  title: string;
  /** Constrained actions slot — only actions-grade components. */
  actions?: ReactNode;
}

/** Groups related content behind one subject. Composes an Avatar, a bound title, a default body slot, and a constrained actions slot. */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, actions, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <article ref={ref} className={classes} {...rest}>
      <header className={styles.header}>
        <Avatar size="sm">AB</Avatar>
        <span className={styles.title}>{title}</span>
      </header>
      <div className={styles.body}>{children}</div>
      {actions != null ? <footer className={styles.footer}>{actions}</footer> : null}
    </article>
  );
});
