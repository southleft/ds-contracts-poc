/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (ds.checkbox v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  state?: 'default' | 'disabled' | 'focus' | 'hover' | 'error';
  checked?: 'off' | 'indeterminate' | 'on';
  label?: 'shown' | 'hidden';
  text?: string;
}

/** Tag: al-checkbox

Props
- hideLabel: boolean — Hide label?
- isChecked: boolean — Checked attribute
- isDisabled: boolean — Disabled attribute
- isError: boolean — Error state
- isIndeterminate: boolean — Indeterminate state

Slots
- (default) — The component content that appears next to the checkbox
- error — If content is slotted, it will display in place of the errorNote property
- field-note — If content is slotted, it will display in place of the fieldNote property

Accessibility
- element: <div>
- key Enter: Toggles the checked state. Space is the native <input type="checkbox"> activation and needs no handler here.
- focus: The native input takes focus; the visible indicator is a 1px primary border edge plus a 3px soft halo of the same hue (--al-theme-color-border-primary-default / -weak), with outline: none. The solid edge carries the 3:1 WCAG non-text contrast - the halo is decoration.

Docs: https://altitude.pages.dev/docs/components/checkbox/
 * @see https://altitude.pages.dev/docs/components/checkbox/ */
export const Checkbox = forwardRef<HTMLDivElement, CheckboxProps>(function Checkbox(
  {
    state = 'default',
    checked = 'off',
    label = 'shown',
    text = 'Checkbox label',
    className,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): label — no `.<axis>-*` rule
  // exists in Checkbox.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  // undrawn-combination-rendered-by-composition: the design does not draw 4 of this
  // component's prop combinations (bindings.figma.absentVariants: state="error" checked="indeterminate" label="shown"; state="error" checked="indeterminate" label="hidden"; state="error" checked="on" label="shown"; … 1 more in the contract).
  // Nothing here refuses them: they render by composing the per-axis rules read from the
  // drawn variants, which is a rendering nobody designed or measured.
  const classes = [styles.root, styles[`state-${state}`], styles[`checked-${checked}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <div className={styles.alCCheckboxContainer}>
        <div className={styles.alCCheckboxCheckbox}>
          <div className={styles.focusRing}>
            <div className={styles.alCCheckboxCustomCheck}>
              {checked === 'indeterminate' || checked === 'on' ? (
                <div className={styles.Frame}>
                  {checked === 'indeterminate' || checked === 'on' ? (
                    <div className={styles.Vector}></div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {label === 'shown' ? (
          <div className={styles.alCCheckboxLabel}>
            {label === 'shown' ? <span className={styles.Label}>{text}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});
