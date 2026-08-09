/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/switch.contract.json (fluent.switch v0.2.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Switch.module.css';

const ICONS: Record<string, string> = {
  'switch-indicator':
    '<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M 10 2 A 8 8 0 1 0 10 18 A 8 8 0 0 0 10 2" fill="currentColor"/></svg>',
};

export interface SwitchProps extends HTMLAttributes<HTMLDivElement> {
  checked?: 'unchecked' | 'checked';
  labelPosition?: 'above' | 'after' | 'before';
}

/** SEED contract for the FLUENT 2 round — props/axes only; anatomy is promoted from captured DOM truth. Subject: @fluentui/react-components@9.74.5 (Griffel CSS-in-JS; 65-package family pinned by the committed lockfile sha256 c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536 — examples/fluent/RECON.md §1). EVERY enum default below is HAND-TRANSCRIBED from the package rollup's own @default/@defaultvalue JSDoc tag: the react-tsx extractor keeps the description prose but emits no `default` field (RECON §3a), so left to the drafter two of twelve components would have captured their whole grid around a base combo the library never renders. @default tags: checked=false, labelPosition=after. The thumb is a REAL DOM child (fui-Switch__indicator ⊃ fui-Icon) — no ::after trickery, no translate channel. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @fluentui/react-components@9.74.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/fluent/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Fluent's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Switch = forwardRef<HTMLDivElement, SwitchProps>(function Switch(
  { checked = 'unchecked', labelPosition = 'after', className, children, ...rest },
  ref,
) {
  const classes = [
    styles.root,
    styles[`checked-${checked}`],
    styles[`labelPosition-${labelPosition}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} {...rest}>
      <input className={styles.input}></input>
      <span
        className={styles.indicator}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS['switch-indicator'] }}
      />
      <label className={styles.label}>Switch</label>
    </div>
  );
});
