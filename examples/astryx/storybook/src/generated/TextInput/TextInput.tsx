/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/text-input.contract.json (astryx.text-input v0.3.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './TextInput.module.css';

export interface TextInputProps extends HTMLAttributes<HTMLDivElement> {
  /** The input type. */
  type?: 'text' | 'password' | 'email';
  /** The field label. */
  label: string;
  /** The field size. */
  size?: 'sm' | 'md' | 'lg';
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the field is required. */
  isRequired?: boolean;
  /** Whether the field is disabled. */
  isDisabled?: boolean;
  /** Whether the field shows a clear button. */
  hasClear?: boolean;
}

/** Astryx TextInput — a labelled single-line text field. Promoted from the Phase-A code extraction of @astryxdesign/core@0.1.6 (MIT, react-tsx adapter, src/TextInput/TextInput.tsx, extracted 2026-07-20 — see examples/astryx/PROVENANCE.md). type/label/size/placeholder and the required/disabled/clear flags are verbatim; description, disabledMessage, labelTooltip, htmlName and isLoading are dropped. value is materialized as a placeholder-backed text field. CODE-SIDE fidelity: structural truth + StyleX token bindings, not the computed pixel floor (Astryx Phase A-2). COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @astryxdesign/core@0.1.6 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/astryx/scripts/promote-floor.ts): enriched.contract.json — computed-capture truth with the decisions ledger applied (extract/computed/out/astryx/textinput/decisions.md); extension sidecar carries the named overflow. */
export const TextInput = forwardRef<HTMLDivElement, TextInputProps>(function TextInput(
  {
    type = 'text',
    size = 'md',
    isRequired = false,
    isDisabled = false,
    hasClear = false,
    label,
    placeholder = 'you@example.com',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): type, size — no `.<axis>-*` rule
  // exists in TextInput.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-required={isRequired || undefined}
      data-is-disabled={isDisabled || undefined}
      data-has-clear={hasClear || undefined}
      {...rest}
    >
      <label className={styles.label}>{label}</label>
      <div className={styles['part-1']}>
        <div className={styles['text-input']}>
          <input className={styles['part-1-0-0']}></input>
        </div>
      </div>
    </div>
  );
});
