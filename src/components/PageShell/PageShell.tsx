/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/page-shell.contract.json (ds.page-shell v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Masthead band spanning both columns. */
  header?: ReactNode;
  /** Stationary 240px navigation column. */
  aside?: ReactNode;
  /** Primary region — accepts the other layout contracts, so a composition nests inside a composition. */
  main?: ReactNode;
  /** Footer band spanning both columns. */
  footer?: ReactNode;
}

/** Composition of compositions: header/aside/main/footer named areas (G4) whose slots accept the other layout contracts. The main slot's accepts list is the nested-composition constraint. */
export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(function PageShell(
  { header, aside, main, footer, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <header className={styles.header}>{header}</header>
      <aside className={styles.aside}>{aside}</aside>
      <main className={styles.main}>{main}</main>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
});
