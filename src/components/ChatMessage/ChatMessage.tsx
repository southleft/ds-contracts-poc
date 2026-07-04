/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/chat-message.contract.json (ds.chat-message v1.0.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ChatMessage.module.css';

export interface ChatMessageProps extends HTMLAttributes<HTMLDivElement> {
  /** Who sent it — drives the bubble color scheme. */
  sender?: 'user' | 'assistant' | 'system';
  /** Sender name shown above the message body. */
  name?: string;
  /** Avatar beside the message. */
  avatar?: ReactNode;
  /** Timestamp and delivery status below the bubble. */
  metadata?: ReactNode;
}

/** Sender-context wrapper for a chat message: avatar, name, bubble content, and metadata. API mirrors industry convention (Astryx ChatMessage); sender-based alignment flipping needs layout-by-enum — a documented gap; the bubble color follows sender. */
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(function ChatMessage(
  { sender = 'assistant', name = 'Assistant', avatar, metadata, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`sender-${sender}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {avatar != null ? <div className={styles.avatarSlot}>{avatar}</div> : null}
      <div className={styles.body}>
        <span className={styles.nameText}>{name}</span>
        <div className={styles.bubble}>{children}</div>
        {metadata != null ? <div className={styles.metadataSlot}>{metadata}</div> : null}
      </div>
    </div>
  );
});
