/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chat-message-metadata.contract.json (ds.chat-message-metadata v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ChatMessageMetadata.module.css';

const ICONS: Record<string, string> = {
  sending:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><polyline points="10,5.8 10,10 13,12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4.6,10.4 8.2,14 15.4,6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  delivered:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="2.6,10.6 5.8,13.8 12,6.6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="9.4,12.6 10.6,13.8 17.4,6.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  read: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="2.6,10.6 5.8,13.8 12,6.6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="9.4,12.6 10.6,13.8 17.4,6.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><line x1="7.2" y1="7.2" x2="12.8" y2="12.8" stroke-linecap="round"/><line x1="12.8" y1="7.2" x2="7.2" y2="12.8" stroke-linecap="round"/></svg>',
};

export interface ChatMessageMetadataProps extends HTMLAttributes<HTMLDivElement> {
  /** Delivery status — drives the leading icon. */
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  /** Display timestamp text. */
  timestamp?: string;
  /** Footer content — model info, reactions, a copy affordance. */
  footer?: ReactNode;
}

/** Metadata row for a chat message: delivery status, timestamp, and footer content. API mirrors industry convention (Astryx ChatMessageMetadata): status drives the icon. */
export const ChatMessageMetadata = forwardRef<HTMLDivElement, ChatMessageMetadataProps>(
  function ChatMessageMetadata(
    { status = 'sent', timestamp = '2:14 PM', footer, className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`status-${status}`], className].filter(Boolean).join(' ');
    return (
      <div ref={ref} className={classes} {...rest}>
        <span
          className={styles.statusIcon}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICONS[status] }}
        />
        <span className={styles.timestampText}>{timestamp}</span>
        {footer != null ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    );
  },
);
