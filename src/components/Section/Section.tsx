/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/section.contract.json (ds.section v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Section.module.css';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Background treatment. Muted only to call attention. */
  variant?: 'section' | 'muted';
}

/** The standard way to create page regions and group related content — settings groups, form sections, sidebar areas. API mirrors industry convention (Astryx Section) at the variant level; the transparent variant needs transparent color tokens — a documented gap. */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { variant = 'section', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`variant-${variant}`], className].filter(Boolean).join(' ');
  return (
    <section ref={ref} className={classes} {...rest}>
      <div className={styles.content}>{children}</div>
    </section>
  );
});
