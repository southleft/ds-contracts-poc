/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (astryx.banner v0.2.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   title
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Banner.module.css';

const ICONS: Record<string, string> = {
  'banner-info':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a1 1 0 100 2 1 1 0 000-2zm-.75 3.75a.75.75 0 011.5 0v5.5a.75.75 0 01-1.5 0v-5.5z"/>\n</svg>',
  'banner-warning':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n  <path fill-rule="evenodd" clip-rule="evenodd" d="M10.29 3.86L2.07 19.05A2 2 0 003.78 22h16.44a2 2 0 001.71-2.95L13.71 3.86a2 2 0 00-3.42 0zM12 9a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0112 9zm0 9a1 1 0 100-2 1 1 0 000 2z"/>\n</svg>',
  'banner-error':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a9 9 0 100 18 9 9 0 000-18zm-2.47 5.47a.75.75 0 00-1.06 1.06L10.94 12l-2.47 2.47a.75.75 0 101.06 1.06L12 13.06l2.47 2.47a.75.75 0 101.06-1.06L13.06 12l2.47-2.47a.75.75 0 00-1.06-1.06L12 10.94l-2.47-2.47z"/>\n</svg>',
  'banner-success':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3a9 9 0 100 18 9 9 0 000-18zm4.06 6.56a.75.75 0 00-1.12-1l-3.94 4.4-1.94-1.94a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.09-.03l4.47-5z"/>\n</svg>',
};

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Status type controlling the icon and color scheme. */
  status?: 'info' | 'warning' | 'error' | 'success';
  /** How the banner is contained. */
  container?: 'card' | 'section';
  /** Whether the banner can be dismissed. */
  isDismissable?: boolean;
  /** Title text displayed prominently in the header area. */
  title?: string;
  /** Optional supporting text below the title in the header area. */
  description?: string;
}

/** Astryx Banner — promoted from @astryxdesign/core@0.1.6 (src/Banner/Banner.tsx). Two-part structure: a status header (muted background, status icon, semibold title, supporting description) and an optional collapsible content area (out of scope for the default exhibit). Status backgrounds use accent/warning/error/success *-muted tokens; icons use the vendor defaultIconNames mapping at md (20px). */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  {
    status = 'info',
    container = 'card',
    isDismissable = false,
    title = 'A new software update is available.',
    description = 'See what changed in this version.',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`status-${status}`],
    styles[`container-${container}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} data-is-dismissable={isDismissable || undefined} {...rest}>
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          {status === 'info' ? (
            <span
              className={styles.iconInfo}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['banner-info'] }}
            />
          ) : null}
          {status === 'warning' ? (
            <span
              className={styles.iconWarning}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['banner-warning'] }}
            />
          ) : null}
          {status === 'error' ? (
            <span
              className={styles.iconError}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['banner-error'] }}
            />
          ) : null}
          {status === 'success' ? (
            <span
              className={styles.iconSuccess}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS['banner-success'] }}
            />
          ) : null}
        </div>
        <div className={styles.headerContent}>
          <div className={styles.title}>{title}</div>
          <div className={styles.description}>{description}</div>
        </div>
      </div>
    </div>
  );
});
