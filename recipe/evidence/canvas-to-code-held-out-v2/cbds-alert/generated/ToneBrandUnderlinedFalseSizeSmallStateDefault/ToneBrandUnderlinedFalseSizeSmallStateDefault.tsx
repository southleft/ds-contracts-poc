/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tone-brand-underlined-false-size-small-state-default.contract.json (ds.tone-brand-underlined-false-size-small-state-default v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from HTMLAttributes<HTMLSpanElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './ToneBrandUnderlinedFalseSizeSmallStateDefault.module.css';

export interface ToneBrandUnderlinedFalseSizeSmallStateDefaultProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  iconLeft?: boolean;
  iconRight?: boolean;
  size?: 'small';
  state?: 'default';
  text?: string;
  tone?: 'brand';
  underlined?: boolean;
}

/** STUB contract auto-proposed for the nested "tone=brand, underlined=false, size=small, state=default" instances of Alert — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry. Import the child set to replace this stub. */
export const ToneBrandUnderlinedFalseSizeSmallStateDefault = forwardRef<
  HTMLSpanElement,
  ToneBrandUnderlinedFalseSizeSmallStateDefaultProps
>(function ToneBrandUnderlinedFalseSizeSmallStateDefault(
  {
    size = 'small',
    state = 'default',
    tone = 'brand',
    iconLeft = false,
    iconRight = false,
    underlined = false,
    text = 'Action',
    className,
    ...rest
  },
  ref,
) {
  // axis-inert (ledgered, not a throw): size, state, tone — no `.<axis>-*` rule
  // exists in ToneBrandUnderlinedFalseSizeSmallStateDefault.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span
      ref={ref}
      className={classes}
      data-icon-left={iconLeft || undefined}
      data-icon-right={iconRight || undefined}
      data-underlined={underlined || undefined}
      {...rest}
    >
      <span className={styles.text}>{text}</span>
    </span>
  );
});
