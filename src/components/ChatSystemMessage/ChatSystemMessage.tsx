/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chat-system-message.contract.json (ds.chat-system-message v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ChatSystemMessage.module.css';

export interface ChatSystemMessageProps extends HTMLAttributes<HTMLDivElement> {
  /** Plain centered text, or text between divider lines. */
  variant?: 'default' | 'divider';
  /** Short factual string — a date, a join notice, a status change. */
  message: string;
  icon?: ReactNode;
}

/** Centered system message for non-sender chat content — date separators, membership changes, status notices. API mirrors industry convention (Astryx ChatSystemMessage): the divider variant adds a line on each side. */
export const ChatSystemMessage = forwardRef<HTMLDivElement, ChatSystemMessageProps>(
  function ChatSystemMessage(
    { variant = 'default', message, icon, className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`variant-${variant}`], className]
      .filter(Boolean)
      .join(' ');
    return (
      <div ref={ref} className={classes} {...rest}>
        {variant === 'divider' ? <div className={styles.lineStart}></div> : null}
        {icon != null ? <div className={styles.iconSlot}>{icon}</div> : null}
        <span className={styles.messageText}>{message}</span>
        {variant === 'divider' ? <div className={styles.lineEnd}></div> : null}
      </div>
    );
  },
);
