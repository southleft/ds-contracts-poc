/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tooltip.contract.json (ds.tooltip v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  supportingText?: boolean;
  theme?: 'light' | 'dark';
  arrow?: 'bottomCenter' | 'none' | 'topCenter' | 'bottomLeft' | 'left' | 'right' | 'bottomRight';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  {
    theme = 'light',
    arrow = 'bottomCenter',
    supportingText = true,
    className,
    children = 'This is a tooltip',
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`theme-${theme}`], styles[`arrow-${arrow}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-supporting-text={supportingText || undefined}
      role="tooltip"
      {...rest}
    >
      <div className={styles.Content}>
        <div className={styles.textAndSupportingText}>
          <span className={styles.Text}>{children}</span>
          {supportingText ? (
            <span className={styles.supportingText}>
              Tooltips are used to describe or identify an element. In most scenarios, tooltips help
              the user understand the meaning, function or alt-text of an element.
            </span>
          ) : null}
        </div>
      </div>
      {arrow === 'bottomCenter' ||
      arrow === 'topCenter' ||
      arrow === 'bottomLeft' ||
      arrow === 'left' ||
      arrow === 'right' ||
      arrow === 'bottomRight' ? (
        <div className={styles.Tooltip}>
          {arrow === 'bottomCenter' ||
          arrow === 'topCenter' ||
          arrow === 'bottomLeft' ||
          arrow === 'left' ||
          arrow === 'right' ||
          arrow === 'bottomRight' ? (
            <div className={styles.bottomCenter}></div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
