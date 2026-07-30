/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tag.contract.json (polaris.tag v0.4.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tag.module.css';

const ICONS: Record<string, string> = {
  "tag-icon-3": "<svg viewBox=\"0 0 18 18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 12.72 13.78 A 0.75 0.75 0 1 0 13.78 12.72 L 11.06 10 L 13.78 7.28 A 0.75 0.75 0 0 0 12.72 6.22 L 10 8.94 L 7.28 6.22 A 0.75 0.75 0 0 0 6.22 7.28 L 8.94 10 L 6.22 12.72 A 0.75 0.75 0 1 0 7.28 13.78 L 10 11.06 L 12.72 13.78 Z\" fill=\"currentColor\"/></svg>",
};

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** Disables the tag */
  disabled?: boolean;
  /** A string to use when tag has more than textual content */
  accessibilityLabel?: string;
  /** Url to navigate to when tag is clicked or keypressed. */
  url?: string;
  /** Tag size (round 4: real Tag API — only 'large' exists; unset renders the default compact size). */
  size?: 'none' | 'large';
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `onRemove` ({"$callback":true}); the created subtree is carried as parts gated on this prop. */
  removable?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `onClick` ({"$callback":true}); the created subtree is carried as parts gated on this prop. */
  clickable?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `url` ("https://example.com"); the created subtree is carried as parts gated on this prop. */
  linked?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Tag/Tag.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/polaris/scripts/promote-floor.ts): resolved.contract.json — computed-capture truth; minted leaves source-aliased to Polaris's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { size = 'none', disabled = false, removable = false, clickable = false, linked = false, accessibilityLabel, url, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-disabled={disabled || undefined} data-removable={removable || undefined} data-clickable={clickable || undefined} data-linked={linked || undefined} {...rest}>
      {linked ? (<a className={styles.link}>
{linked ? (<span className={styles["text-2"]}>
{linked ? (<span className={styles["label-2"]}>{children}</span>) : null}
</span>) : null}
</a>) : null}
<span className={styles.text}>
<span className={styles.label}>Wholesale</span>
</span>
<span className={styles["part-1"]}>

</span>
<button className={styles.button}>

</button>
{removable ? (<button className={styles["button-2"]}>
{removable ? (<span className={styles["icon-3"]}><span aria-hidden="true" className={styles["icon-3Glyph"]} dangerouslySetInnerHTML={{ __html: ICONS["tag-icon-3"] }} /></span>) : null}
</button>) : null}
    </span>
  );
});
