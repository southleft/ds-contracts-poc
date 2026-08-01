/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/checkbox.contract.json (ds.checkbox v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

const ICONS: Record<string, string> = {
  checkbox:
    '<svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">\n<rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill="white"/>\n<rect x="0.5" y="0.5" width="15" height="15" rx="3.5" stroke="#D4D4D4"/>\n</svg>',
};

export interface CheckboxProps extends HTMLAttributes<HTMLSpanElement> {
  checked?: 'false';
  indeterminate?: 'false';
  size?: 'sm';
  type?: 'checkbox';
  text?: 'false';
  supportingText?: 'false';
  state?: 'default';
}

/** STUB contract auto-proposed for the nested "Checkbox" instances of _Dropdown list item — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
export const Checkbox = forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  {
    checked = 'false',
    indeterminate = 'false',
    size = 'sm',
    type = 'checkbox',
    text = 'false',
    supportingText = 'false',
    state = 'default',
    className,
    children,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): checked, indeterminate, size, type, text, supportingText, state — no `.<axis>-*` rule
  // exists in Checkbox.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span
        className={styles.glyph}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['checkbox'] }}
      />
    </span>
  );
});
