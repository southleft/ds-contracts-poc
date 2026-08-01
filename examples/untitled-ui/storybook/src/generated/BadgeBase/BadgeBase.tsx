/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge-base.contract.json (ds.badge-base v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Plus } from '../Plus';
import { ArrowUp } from '../ArrowUp';
import { Avatar } from '../Avatar';
import { AU } from '../AU';
import { Dot } from '../Dot';
import { ArrowRight } from '../ArrowRight';
import { X } from '../X';
import styles from './BadgeBase.module.css';

export interface BadgeBaseProps extends HTMLAttributes<HTMLDivElement> {
  icon?: 'false' | 'dot' | 'country' | 'avatar' | 'xClose' | 'iconRight' | 'iconLeft' | 'only';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const BadgeBase = forwardRef<HTMLDivElement, BadgeBaseProps>(function BadgeBase(
  { icon = 'false', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`icon-${icon}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {icon === 'only' ? (
        <span className={styles.plus}>
          <Plus />
        </span>
      ) : null}
      {icon === 'iconLeft' ? (
        <span className={styles.arrowUp}>
          <ArrowUp />
        </span>
      ) : null}
      {icon === 'avatar' ? (
        <span className={styles.Avatar}>
          <Avatar size="xs" text={false} statusIcon="false" state="default" />
        </span>
      ) : null}
      {icon === 'country' ? <AU /> : null}
      {icon === 'dot' ? <Dot size="sm" /> : null}
      {icon === 'false' ||
      icon === 'dot' ||
      icon === 'country' ||
      icon === 'avatar' ||
      icon === 'xClose' ||
      icon === 'iconRight' ||
      icon === 'iconLeft' ? (
        <span className={styles.Text}>Label</span>
      ) : null}
      {icon === 'iconRight' ? (
        <span className={styles.arrowRight}>
          <ArrowRight />
        </span>
      ) : null}
      {icon === 'xClose' ? (
        <span className={styles.x}>
          <X />
        </span>
      ) : null}
    </div>
  );
});
