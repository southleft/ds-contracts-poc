/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tab-line.contract.json (ds.tab-line v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { SelectedFalseStateDefaultSizeSmall } from '../SelectedFalseStateDefaultSizeSmall';
import { SelectedTrueStateDefaultSizeSmall } from '../SelectedTrueStateDefaultSizeSmall';
import styles from './TabLine.module.css';

export interface TabLineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  size?: 'small' | 'large';
  type?: 'horizontal' | 'verticalRight' | 'verticalLeft';
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const TabLine = forwardRef<HTMLDivElement, TabLineProps>(function TabLine(
  { size = 'small', type = 'horizontal', className, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): size — no `.<axis>-*` rule
  // exists in TabLine.module.css, so no class is composed for it. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever this axis carries rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, styles[`type-${type}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      {type === 'verticalLeft' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalLeft' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalLeft' ? (
        <SelectedTrueStateDefaultSizeSmall label selected size={size} state="default" />
      ) : null}
      {type === 'verticalLeft' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalLeft' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalLeft' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalRight' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalRight' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalRight' ? (
        <SelectedTrueStateDefaultSizeSmall label selected size={size} state="default" />
      ) : null}
      {type === 'verticalRight' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalRight' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'verticalRight' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'horizontal' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'horizontal' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'horizontal' ? (
        <SelectedTrueStateDefaultSizeSmall label selected size={size} state="default" />
      ) : null}
      {type === 'horizontal' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'horizontal' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
      {type === 'horizontal' ? (
        <SelectedFalseStateDefaultSizeSmall label size={size} state="default" />
      ) : null}
    </div>
  );
});
