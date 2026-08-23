/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/atoms-input.contract.json (ds.atoms-input v0.1.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   content
 */
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { FieldLabel } from '../FieldLabel';
import { InlineDanger } from '../InlineDanger';
import { InlineHint } from '../InlineHint';
import styles from './AtomsInput.module.css';

export interface AtomsInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  isFilled?: boolean;
  hasError?: boolean;
  isDisabled?: boolean;
  content?: string;
  hasLabel?: boolean;
  hasStartIcon?: boolean;
  hasEndIcon?: boolean;
  hasHint?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const AtomsInput = forwardRef<HTMLDivElement, AtomsInputProps>(function AtomsInput(
  {
    isFilled = false,
    hasError = false,
    isDisabled = false,
    hasLabel = true,
    hasStartIcon = false,
    hasEndIcon = false,
    hasHint = true,
    content = 'Input content',
    startIcon,
    endIcon,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-is-filled={isFilled || undefined}
      data-has-error={hasError || undefined}
      data-is-disabled={isDisabled || undefined}
      data-has-label={hasLabel || undefined}
      data-has-start-icon={hasStartIcon || undefined}
      data-has-end-icon={hasEndIcon || undefined}
      data-has-hint={hasHint || undefined}
      {...rest}
    >
      {hasLabel ? <FieldLabel hasTooltip labelText="Label" /> : null}
      <div className={styles.horizontalStack}>
        {hasStartIcon ? <div className={styles.startIcon}>{startIcon}</div> : null}
        <span className={styles.inputContent}>{content}</span>
        {hasEndIcon ? <div className={styles.endIcon}>{endIcon}</div> : null}
      </div>
      {hasError ? <InlineDanger supportingText="Danger text" /> : null}
      {hasHint ? <InlineHint supportingText="Hint text" /> : null}
    </div>
  );
});
