/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox-input.contract.json (astryx.checkbox-input v0.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './CheckboxInput.module.css';

const ICONS: Record<string, string> = {
  'checkbox-input-icon-sm':
    '<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M 8.5 2.5 L 4 7.5 L 1.5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'checkbox-input-icon-md':
    '<svg viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><path d="M 8.5 2.5 L 4 7.5 L 1.5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface CheckboxInputProps extends HTMLAttributes<HTMLDivElement> {
  /** The checkbox label. */
  label: string;
  /** The control size. */
  size?: 'sm' | 'md';
  /** Whether the checkbox is disabled. */
  isDisabled?: boolean;
  /** Whether the checkbox is read-only. */
  isReadOnly?: boolean;
  /** Whether the checkbox is required. */
  isRequired?: boolean;
}

/** Astryx CheckboxInput — a labelled checkbox form control. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/CheckboxInput/CheckboxInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). label/size and the disabled/readOnly/required flags are verbatim; description, disabledMessage, htmlName, isLoading and isLabelHidden are dropped. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/checkboxinput/decisions.md); extension sidecar carries the named overflow. */
export const CheckboxInput = forwardRef<HTMLDivElement, CheckboxInputProps>(function CheckboxInput(
  {
    size = 'md',
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-disabled={isDisabled || undefined}
      data-is-read-only={isReadOnly || undefined}
      data-is-required={isRequired || undefined}
      {...rest}
    >
      <div className={styles['part-0']}>
        <div className={styles['part-0-0']}>
          <input className={styles['part-0-0-0']}></input>
          <div className={styles.checkbox}>
            <div className={styles.icon}>
              {size === 'sm' ? (
                <span
                  className={styles['icon-sm']}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: ICONS['checkbox-input-icon-sm'] }}
                />
              ) : null}
              {size === 'md' ? (
                <span
                  className={styles['icon-md']}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: ICONS['checkbox-input-icon-md'] }}
                />
              ) : null}
            </div>
            <div className={styles['part-0-0-1-1']}></div>
          </div>
        </div>
        <div className={styles['part-0-1']}>
          <label className={styles.label}>{label}</label>
        </div>
      </div>
    </div>
  );
});
