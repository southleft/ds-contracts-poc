/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress.contract.json (antd.progress v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Progress.module.css';

const ICONS: Record<string, string> = {
  'progress-anticon-exception':
    '<svg viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M 512 64 C 759.4 64 960 264.6 960 512 S 759.4 960 512 960 S 64 759.4 64 512 S 264.6 64 512 64 Z M 639.98 338.82 H 639.94 L 639.86 338.88 L 512 466.75 L 384.14 338.88 C 384.1 338.83 384.08 338.82 384.06 338.82 A 0.12 0.12 0 0 0 383.99 338.82 C 383.96 338.82 383.94 338.83 383.9 338.87 L 338.88 383.89 A 0.2 0.2 0 0 0 338.83 383.98 A 0.12 0.12 0 0 0 338.83 384.05 V 384.07 A 0.27 0.27 0 0 0 338.89 384.13 L 466.75 512 L 338.88 639.86 C 338.83 639.9 338.82 639.92 338.82 639.94 A 0.12 0.12 0 0 0 338.82 640.01 C 338.82 640.04 338.83 640.06 338.87 640.1 L 383.89 685.12 A 0.2 0.2 0 0 0 383.98 685.17 A 0.12 0.12 0 0 0 384.05 685.17 C 384.07 685.17 384.09 685.16 384.13 685.12 L 512 557.25 L 639.86 685.12 C 639.9 685.16 639.92 685.17 639.94 685.17 A 0.12 0.12 0 0 0 640.01 685.17 C 640.04 685.17 640.06 685.16 640.1 685.12 L 685.12 640.1 A 0.2 0.2 0 0 0 685.17 640.01 A 0.12 0.12 0 0 0 685.17 639.94 V 639.92 A 0.27 0.27 0 0 0 685.12 639.86 L 557.25 512 L 685.12 384.14 C 685.16 384.1 685.17 384.08 685.17 384.06 A 0.12 0.12 0 0 0 685.17 383.99 C 685.17 383.96 685.16 383.94 685.12 383.9 L 640.1 338.88 A 0.2 0.2 0 0 0 640.01 338.83 A 0.12 0.12 0 0 0 639.94 338.83 Z" fill="currentColor" fill-rule="evenodd"/></svg>',
  'progress-anticon-success':
    '<svg viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M 512 64 C 264.6 64 64 264.6 64 512 S 264.6 960 512 960 S 960 759.4 960 512 S 759.4 64 512 64 Z M 705.5 365.7 L 494.9 657.7 A 31.8 31.8 0 0 1 443.2 657.7 L 318.5 484.9 C 314.7 479.6 318.5 472.2 325 472.2 H 371.9 C 382.1 472.2 391.8 477.1 397.8 485.5 L 469 584.3 L 626.2 366.3 C 632.2 358 641.8 353 652.1 353 H 699 C 705.5 353 709.3 360.4 705.5 365.7 Z" fill="currentColor"/></svg>',
};

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  status?: 'unset' | 'exception' | 'active' | 'success';
  percent?: number;
  max?: number;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). THE METER (FC-METER / FC-GEOMETRY-EXCLUDED, T3). `status` is DEFAULTLESS — antd's ProgressStatuses tuple is normal|exception|active|success and `normal` IS the unset rendering, so the enum carries the other three and `unset` stands for normal (one value per rendering, no duplicate). percent is pinned at 40 and type at line by the config (the MUI LinearProgress value:40 precedent); the fill WIDTH is inline geometry the Option B exclusion must LEDGER. NAMED OUT: circle/dashboard (SVG stroke-dasharray geometry), steps, strokeColor gradients, format. HEAL LOOP (2026-08-23): `percent` (40) and `max` (100) are NUMBER props so the fill part can carry a `meter` fact (examples/antd/authored-facts.json — the astryx/polaris progress-bar precedent); the capture pins percent at 40 and never enumerates numbers. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { status = 'unset', percent = 40, max = 100, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`status-${status}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles['progress-outer']}>
        <div className={styles['progress-inner']}>
          <div
            className={styles['progress-bg']}
            style={{ width: `${Math.min(100, Math.max(0, (percent / max) * 100))}%` }}
          />
        </div>
        <span className={styles.label}>40%</span>
      </div>
    </div>
  );
});
