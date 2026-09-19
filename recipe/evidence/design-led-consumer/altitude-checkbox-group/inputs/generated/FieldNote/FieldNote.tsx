/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/field-note.contract.json (ds.field-note v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './FieldNote.module.css';

export interface FieldNoteProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  state?: 'default' | 'error' | 'disabled';
  text?: string;
}

/** Tag: al-field-note

Props
- isDisabled: boolean — Disabled attribute
- isError: boolean — Error state

Slots
- (default) — The field note content

Accessibility
- element: <div>

Docs: https://altitude.pages.dev/docs/components/field-note/
 * @see https://altitude.pages.dev/docs/components/field-note/ */
export const FieldNote = forwardRef<HTMLDivElement, FieldNoteProps>(function FieldNote(
  { state = 'default', text = 'Helper text', className, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`state-${state}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <span className={styles.helperText}>{text}</span>
    </div>
  );
});
