/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox-group.contract.json (ds.checkbox-group v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Checkbox } from '../Checkbox';
import { FieldNote } from '../FieldNote';
import styles from './CheckboxGroup.module.css';

export interface CheckboxGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  legend?: 'shown' | 'hidden';
  orientation?: 'column' | 'row';
  state?: 'default' | 'disabled' | 'error';
  text?: string;
  items?: Array<{ text: string }>;
}

/** A set of checkboxes that are one question. It exists for its semantics, not its spacing — it renders a real `<fieldset>` with a `<legend>`, carries one field note and one error note for the whole set, and cascades `isRequired` and `isDisabled` down to every checkbox inside it.

Tag: al-checkbox-group

Props
- direction: row | column — Direction
- hideLegend: boolean — Hide legend?
- isDisabled: boolean — Disabled attribute
- isError: boolean — Error state
- label — Label
  - Displays: inside the legend

Slots
- (default) — The component content, a set of checkbox items.
- error — If content is slotted, it will display in place of the errorNote property
- field-note — If content is slotted, it will display in place of the fieldNote property

Accessibility
- element: <fieldset>

Docs: https://altitude.pages.dev/docs/components/checkbox-group/
 * @see https://altitude.pages.dev/docs/components/checkbox-group/ */
export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(function CheckboxGroup(
  {
    legend = 'shown',
    orientation = 'column',
    state = 'default',
    text = 'Checkbox group legend label',
    items,
    className,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): legend, state — no `.<axis>-*` rule
  // exists in CheckboxGroup.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`orientation-${orientation}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <span className={styles.Label}>{text}</span>
      <div className={styles.alLayoutsetUnresolved}>
        {items?.map((item, index) => (
          <Checkbox
            key={index}
            state={
              state === 'default'
                ? 'default'
                : state === 'disabled'
                  ? 'disabled'
                  : state === 'error'
                    ? 'default'
                    : undefined
            }
            checked="off"
            label="shown"
            text={item.text}
          />
        ))}
      </div>
      <FieldNote text="Helper text" state={state} />
    </div>
  );
});
