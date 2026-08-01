/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/progress-bar.contract.json (ds.progress-bar v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Tooltip } from '../Tooltip';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  progress?: '0' | '10' | '20' | '30' | '40' | '50' | '60' | '70' | '80' | '90' | '100';
  label?: 'right' | 'bottom' | 'topFloating' | 'bottomFloating' | 'false';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { progress = '0', label = 'right', className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`progress-${progress}`], styles[`label-${label}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.progressBar}>
        <div className={styles.Background}></div>
        <div className={styles.Progress}>
          <div className={styles.Progress2}></div>
          {label === 'topFloating' || label === 'bottomFloating' ? (
            <Tooltip
              supportingText={false}
              theme="light"
              arrow={
                label === 'topFloating'
                  ? 'bottomCenter'
                  : label === 'bottomFloating'
                    ? 'topCenter'
                    : undefined
              }
              children={
                progress === '0'
                  ? '0%'
                  : progress === '10'
                    ? '10%'
                    : progress === '20'
                      ? '20%'
                      : progress === '30'
                        ? '30%'
                        : progress === '40'
                          ? '40%'
                          : progress === '50'
                            ? '50%'
                            : progress === '60'
                              ? '60%'
                              : progress === '70'
                                ? '70%'
                                : progress === '80'
                                  ? '80%'
                                  : progress === '90'
                                    ? '90%'
                                    : progress === '100'
                                      ? '100%'
                                      : undefined
              }
            />
          ) : null}
        </div>
      </div>
      {label === 'right' || label === 'bottom' ? (
        <span className={styles.Percentage}>
          {progress === '10'
            ? '10%'
            : progress === '20'
              ? '20%'
              : progress === '30'
                ? '30%'
                : progress === '40'
                  ? '40%'
                  : progress === '50'
                    ? '50%'
                    : progress === '60'
                      ? '60%'
                      : progress === '70'
                        ? '70%'
                        : progress === '80'
                          ? '80%'
                          : progress === '90'
                            ? '90%'
                            : progress === '100'
                              ? '100%'
                              : '0%'}
        </span>
      ) : null}
    </div>
  );
});
