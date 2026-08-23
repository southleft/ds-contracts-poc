/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/alert.contract.json (antd.alert v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Alert.module.css';

const ICONS: Record<string, string> = {
  'alert-alert-icon-success':
    '<svg viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 705.5 365.7 L 494.9 657.7 A 31.8 31.8 0 0 1 443.2 657.7 L 318.5 484.9 C 314.7 479.6 318.5 472.2 325 472.2 H 371.9 C 382.1 472.2 391.8 477.1 397.8 485.5 L 469 584.3 L 626.2 366.3 C 632.2 358 641.8 353 652.1 353 H 699 C 705.5 353 709.3 360.4 705.5 365.7 Z" fill="currentColor"/></svg>',
  'alert-alert-icon-info':
    '<svg viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 544 728 C 544 732.4 540.4 736 536 736 H 488 C 483.6 736 480 732.4 480 728 V 456 C 480 451.6 483.6 448 488 448 H 536 C 540.4 448 544 451.6 544 456 V 728 Z M 512 384 A 48.01 48.01 0 0 1 512 288 A 48.01 48.01 0 0 1 512 384 Z" fill="currentColor"/></svg>',
  'alert-alert-icon-warning':
    '<svg viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 480 296 C 480 291.6 483.6 288 488 288 H 536 C 540.4 288 544 291.6 544 296 V 568 C 544 572.4 540.4 576 536 576 H 488 C 483.6 576 480 572.4 480 568 V 296 Z M 512 736 A 48.01 48.01 0 0 1 512 640 A 48.01 48.01 0 0 1 512 736 Z" fill="currentColor"/></svg>',
  'alert-alert-icon-error':
    '<svg viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M 512 64 C 759.4 64 960 264.6 960 512 S 759.4 960 512 960 S 64 759.4 64 512 S 264.6 64 512 64 Z M 639.98 338.82 H 639.94 L 639.86 338.88 L 512 466.75 L 384.14 338.88 C 384.1 338.83 384.08 338.82 384.06 338.82 A 0.12 0.12 0 0 0 383.99 338.82 C 383.96 338.82 383.94 338.83 383.9 338.87 L 338.88 383.89 A 0.2 0.2 0 0 0 338.83 383.98 A 0.12 0.12 0 0 0 338.83 384.05 V 384.07 A 0.27 0.27 0 0 0 338.89 384.13 L 466.75 512 L 338.88 639.86 C 338.83 639.9 338.82 639.92 338.82 639.94 A 0.12 0.12 0 0 0 338.82 640.01 C 338.82 640.04 338.83 640.06 338.87 640.1 L 383.89 685.12 A 0.2 0.2 0 0 0 383.98 685.17 A 0.12 0.12 0 0 0 384.05 685.17 C 384.07 685.17 384.09 685.16 384.13 685.12 L 512 557.25 L 639.86 685.12 C 639.9 685.16 639.92 685.17 639.94 685.17 A 0.12 0.12 0 0 0 640.01 685.17 C 640.04 685.17 640.06 685.16 640.1 685.12 L 685.12 640.1 A 0.2 0.2 0 0 0 685.17 640.01 A 0.12 0.12 0 0 0 685.17 639.94 V 639.92 A 0.27 0.27 0 0 0 685.12 639.86 L 557.25 512 L 685.12 384.14 C 685.16 384.1 685.17 384.08 685.17 384.06 A 0.12 0.12 0 0 0 685.17 383.99 C 685.17 383.96 685.16 383.94 685.12 383.9 L 640.1 338.88 A 0.2 0.2 0 0 0 640.01 338.83 A 0.12 0.12 0 0 0 639.94 338.83 Z" fill="currentColor" fill-rule="evenodd"/></svg>',
  'alert-anticon':
    '<svg viewBox="0 0 858 858" xmlns="http://www.w3.org/2000/svg"><path d="M 799.86 166.31 C 799.88 166.31 799.9 166.33 799.94 166.37 L 857.63 224.07 C 857.67 224.1 857.68 224.12 857.69 224.15 A 0.12 0.12 0 0 1 857.69 224.21 C 857.69 224.24 857.67 224.26 857.63 224.3 L 569.93 512 L 857.63 799.7 C 857.67 799.74 857.68 799.76 857.69 799.79 A 0.12 0.12 0 0 1 857.69 799.86 C 857.69 799.88 857.67 799.9 857.63 799.94 L 799.93 857.63 C 799.9 857.67 799.88 857.68 799.86 857.69 A 0.12 0.12 0 0 1 799.79 857.69 C 799.76 857.69 799.74 857.67 799.7 857.63 L 512 569.93 L 224.3 857.63 C 224.26 857.67 224.24 857.68 224.21 857.69 A 0.12 0.12 0 0 1 224.14 857.69 C 224.12 857.69 224.1 857.67 224.06 857.63 L 166.37 799.93 C 166.33 799.9 166.32 799.88 166.31 799.86 A 0.12 0.12 0 0 1 166.31 799.79 C 166.31 799.76 166.33 799.74 166.37 799.7 L 454.07 512 L 166.37 224.3 C 166.33 224.26 166.32 224.24 166.31 224.21 A 0.12 0.12 0 0 1 166.31 224.14 C 166.31 224.12 166.33 224.1 166.37 224.06 L 224.07 166.37 C 224.1 166.33 224.12 166.32 224.14 166.31 A 0.12 0.12 0 0 1 224.21 166.31 C 224.24 166.31 224.26 166.33 224.3 166.37 L 512 454.07 L 799.7 166.37 C 799.74 166.33 799.76 166.32 799.79 166.31 A 0.12 0.12 0 0 1 799.86 166.31 Z" fill="currentColor" fill-rule="evenodd"/></svg>',
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'success' | 'info' | 'warning' | 'error';
  showIcon?: 'noIcon' | 'icon';
  message?: string;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `description` ("Alert description copy."); the created subtree is carried as parts gated on this prop. */
  description?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `closable` (true); the created subtree is carried as parts gated on this prop. */
  closable?: boolean;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). MOLECULE, PRESENCE-HEAVY (the Polaris Banner precedent). The icon GLYPH is a function of `type` AND its presence a function of `showIcon` — `showIcon` is modelled as a 2-value ENUM AXIS (noIcon|icon; config maps to the boolean) rather than presence so the glyph stays a ONE-axis function of `type` (svg-content per-value glyph parts). `description` and `closable` are PRESENCE props (each adds a part; the close button has its own hover plane — descendant state). antd's runtime default type is `info`. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    type = 'info',
    showIcon = 'noIcon',
    description = false,
    closable = false,
    message = 'Alert message',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`type-${type}`], styles[`showIcon-${showIcon}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-description={description || undefined}
      data-closable={closable || undefined}
      {...rest}
    >
      <span className={styles['alert-icon']}>
        {type === 'success' ? (
          <span
            className={styles['alert-icon-success']}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['alert-alert-icon-success'] }}
          />
        ) : null}
        {type === 'info' ? (
          <span
            className={styles['alert-icon-info']}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['alert-alert-icon-info'] }}
          />
        ) : null}
        {type === 'warning' ? (
          <span
            className={styles['alert-icon-warning']}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['alert-alert-icon-warning'] }}
          />
        ) : null}
        {type === 'error' ? (
          <span
            className={styles['alert-icon-error']}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS['alert-alert-icon-error'] }}
          />
        ) : null}
      </span>
      <div className={styles['alert-content']}>
        <span className={styles.label}>{message}</span>
        {description ? <span className={styles['label-2']}>Alert description copy.</span> : null}
      </div>
      {closable ? (
        <button className={styles['alert-close-icon']}>
          {closable ? (
            <span className={styles.anticon}>
              <span
                aria-hidden="true"
                className={styles.anticonGlyph}
                dangerouslySetInnerHTML={{ __html: ICONS['alert-anticon'] }}
              />
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
});
