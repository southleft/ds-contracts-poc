/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (ds.banner v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Banner.module.css';

const ICONS: Record<string, string> = {
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><line x1="10" y1="9" x2="10" y2="13.5" stroke-linecap="round"/><circle cx="10" cy="6.4" r="0.9" fill="currentColor" stroke="none"/></svg>',
  success:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><polyline points="6.6,10.2 9,12.6 13.4,7.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warning:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3.2 17.4 16H2.6Z" stroke-linejoin="round"/><line x1="10" y1="8.2" x2="10" y2="11.8" stroke-linecap="round"/><circle cx="10" cy="13.9" r="0.9" fill="currentColor" stroke="none"/></svg>',
  error:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><line x1="7.2" y1="7.2" x2="12.8" y2="12.8" stroke-linecap="round"/><line x1="12.8" y1="7.2" x2="7.2" y2="12.8" stroke-linecap="round"/></svg>',
  close:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="5" x2="15" y2="15" stroke-linecap="round"/><line x1="15" y1="5" x2="5" y2="15" stroke-linecap="round"/></svg>',
};

const ROLE_MAP: Record<string, string> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert',
};

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** Feedback tone — drives the color scheme, the leading icon, and the ARIA role (error/warning announce as alerts). */
  status?: 'info' | 'success' | 'warning' | 'error';
  /** card = standalone with radius; section = full-bleed, square. */
  container?: 'card' | 'section';
  /** Shows the close affordance. Keep error banners until resolved. */
  isDismissable?: boolean;
  /** Prominent header text. */
  title: string;
  /** Secondary text below the title. */
  description?: string;
  /** End-aligned action slot — typically a secondary Button. */
  endContent?: ReactNode;
}

/** Persistent inline notification for page- or section-level feedback. API mirrors industry convention (Astryx Banner): status drives color, icon, and ARIA role; dismissable banners expose a close affordance; endContent carries actions. */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  {
    status = 'info',
    container = 'card',
    isDismissable = false,
    title,
    description = 'Supporting detail that explains what happened and what to do next.',
    endContent,
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
    <div
      ref={ref}
      className={classes}
      data-is-dismissable={isDismissable || undefined}
      role={ROLE_MAP[status]}
      {...rest}
    >
      <span
        className={styles.statusIcon}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS[status] }}
      />
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        <div className={styles.descriptionText}>{description}</div>
      </div>
      <div className={styles.endArea}>
        {endContent != null ? <div className={styles.endContent}>{endContent}</div> : null}
        {isDismissable ? (
          <button className={styles.close} aria-label="Dismiss" type="button" data-action="dismiss">
            <span
              aria-hidden="true"
              className={styles.closeGlyph}
              dangerouslySetInnerHTML={{ __html: ICONS['close'] }}
            />
          </button>
        ) : null}
      </div>
    </div>
  );
});
