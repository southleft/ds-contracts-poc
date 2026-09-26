/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/textarea.contract.json (ds.textarea v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from TextareaHTMLAttributes<HTMLTextAreaElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { StateDefault } from '../StateDefault';
import styles from './Textarea.module.css';

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'children'
> {
  state?: 'default' | 'hover' | 'focus' | 'active' | 'error' | 'disabled';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { state = 'default', className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <textarea ref={ref} className={classes} {...rest}>
      <div className={styles.alCTextareaLabel}>
        <span className={styles.Label}>Label</span>
      </div>
      <div className={styles.alCTextareaContainer}>
        <div className={styles.alCTextareaInput}></div>
      </div>
      <div className={styles.alCTextareaFooter}>
        <div className={styles.alCTextareaFieldNotes}>
          <StateDefault
            state={
              state === 'default'
                ? 'default'
                : state === 'hover'
                  ? 'default'
                  : state === 'focus'
                    ? 'default'
                    : state === 'active'
                      ? 'default'
                      : state === 'error'
                        ? 'error'
                        : state === 'disabled'
                          ? 'disabled'
                          : undefined
            }
          />
        </div>
      </div>
    </textarea>
  );
});
