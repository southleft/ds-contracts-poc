/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar-online-indicator.contract.json (ds.avatar-online-indicator v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './AvatarOnlineIndicator.module.css';

const ICONS: Record<string, string> = {
  'avatar-online-indicator':
    '<svg width="100%" height="100%" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">\n<rect x="0.75" y="0.75" width="15.5" height="15.5" rx="7.75" fill="#22C55E"/>\n<rect x="0.75" y="0.75" width="15.5" height="15.5" rx="7.75" stroke="white" stroke-width="1.5"/>\n</svg>',
};

export interface AvatarOnlineIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'xl' | '2xl' | 'lg' | 'md' | 'sm' | 'xs';
  online?: 'true';
}

/** STUB contract auto-proposed for the nested "_Avatar online indicator" instances of Avatar — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
export const AvatarOnlineIndicator = forwardRef<HTMLSpanElement, AvatarOnlineIndicatorProps>(
  function AvatarOnlineIndicator(
    { size = 'xl', online = 'true', className, children, ...rest },
    ref,
  ) {
    const classes = [styles.root, styles[`size-${size}`], styles[`online-${online}`], className]
      .filter(Boolean)
      .join(' ');
    return (
      <span ref={ref} className={classes} {...rest}>
        <span
          className={styles.glyph}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICONS['avatar-online-indicator'] }}
        />
      </span>
    );
  },
);
