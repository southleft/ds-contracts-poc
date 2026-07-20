/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/banner.contract.json (polaris.banner v0.3.1)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Banner.module.css';

const ICONS: Record<string, string> = {
  "banner-icon-success": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 15.78 5.97 A 0.75 0.75 0 0 1 15.78 7.03 L 9.28 13.53 A 0.75 0.75 0 0 1 8.22 13.53 L 4.97 10.28 A 0.75 0.75 0 1 1 6.03 9.22 L 8.75 11.94 L 14.72 5.97 A 0.75 0.75 0 0 1 15.78 5.97 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "banner-icon-info": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 10 14 A 0.75 0.75 0 0 1 9.25 13.25 V 9.75 A 0.75 0.75 0 0 1 10.75 9.75 V 13.25 A 0.75 0.75 0 0 1 10 14 Z\" fill=\"currentColor\"/><path d=\"M 9 7 A 1 1 0 1 1 11 7 A 1 1 0 0 1 9 7 Z\" fill=\"currentColor\"/><path d=\"M 17 10 A 7 7 0 1 1 3 10 A 7 7 0 0 1 17 10 Z M 15.5 10 A 5.5 5.5 0 1 1 4.5 10 A 5.5 5.5 0 0 1 15.5 10 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "banner-icon-warning": "<svg viewBox=\"0 0 450 450\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 10 6.75 A 0.75 0.75 0 0 1 10.75 7.5 V 11 A 0.75 0.75 0 1 1 9.25 11 V 7.5 A 0.75 0.75 0 0 1 10 6.75 Z\" fill=\"currentColor\"/><path d=\"M 11 13.5 A 1 1 0 1 1 9 13.5 A 1 1 0 0 1 11 13.5 Z\" fill=\"currentColor\"/><path d=\"M 10 3.5 C 8.955 3.5 8.216 4.202 7.848 4.947 A 449.26 449.26 0 0 1 5.843 8.794 L 5.815 8.846 A 403.426 403.426 0 0 0 3.807 12.702 C 3.435 13.454 3.329 14.452 3.9 15.316 C 4.47 16.179 5.442 16.5 6.364 16.5 H 13.636 C 14.558 16.5 15.531 16.18 16.1 15.316 C 16.67 14.452 16.565 13.454 16.193 12.702 C 15.983 12.278 15.08 10.555 14.189 8.855 L 14.157 8.794 A 429.497 429.497 0 0 1 12.152 4.947 C 11.784 4.202 11.045 3.5 10 3.5 Z M 9.192 5.612 C 9.596 4.796 10.404 4.796 10.808 5.612 C 11.01 6.021 11.92 7.757 12.83 9.492 A 418.904 418.904 0 0 1 14.848 13.367 C 15.252 14.184 14.848 15 13.636 15 H 6.364 C 5.152 15 4.747 14.184 5.152 13.367 C 5.354 12.959 6.265 11.22 7.175 9.484 A 421.932 421.932 0 0 0 9.192 5.612 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "banner-icon-critical": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 10 6 A 0.75 0.75 0 0 1 10.75 6.75 V 10.25 A 0.75 0.75 0 0 1 9.25 10.25 V 6.75 A 0.75 0.75 0 0 1 10 6 Z\" fill=\"currentColor\"/><path d=\"M 11 13 A 1 1 0 1 1 9 13 A 1 1 0 0 1 11 13 Z\" fill=\"currentColor\"/><path d=\"M 11.237 3.177 A 1.75 1.75 0 0 0 8.763 3.177 L 3.177 8.762 A 1.75 1.75 0 0 0 3.177 11.237 L 8.763 16.823 A 1.75 1.75 0 0 0 11.237 16.823 L 16.823 11.237 A 1.75 1.75 0 0 0 16.823 8.762 L 11.237 3.177 Z M 9.823 4.237 A 0.25 0.25 0 0 1 10.177 4.237 L 15.763 9.823 A 0.25 0.25 0 0 1 15.763 10.177 L 10.177 15.762 A 0.25 0.25 0 0 1 9.823 15.762 L 4.237 10.177 A 0.25 0.25 0 0 1 4.237 9.823 L 9.823 4.237 Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/></svg>",
  "banner-icon-3": "<svg viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 13.97 15.03 A 0.75 0.75 0 1 0 15.03 13.97 L 11.06 10 L 15.03 6.03 A 0.75 0.75 0 0 0 13.97 4.97 L 10 8.94 L 6.03 4.97 A 0.75 0.75 0 0 0 4.97 6.03 L 8.94 10 L 4.97 13.97 A 0.75 0.75 0 1 0 6.03 15.03 L 10 11.06 L 13.97 15.03 Z\"/></svg>",
};

const ROLE_MAP: Record<string, string> = {"success":"status","info":"status","warning":"alert","critical":"alert"};

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  /** Title content for the banner. */
  title?: string;
  /** Renders the banner without a status icon. */
  hideIcon?: boolean;
  /** Sets the status of the banner. */
  tone?: 'success' | 'info' | 'warning' | 'critical';
  /** Disables screen reader announcements when changing the content of the banner */
  stopAnnouncements?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `onDismiss` ({"$callback":true}); the created subtree is carried as parts gated on this prop. */
  dismissible?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `action` ({"content":"Print label"}); the created subtree is carried as parts gated on this prop. */
  withAction?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Banner/Banner.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.1 (extract/computed rounds 4 + 5c): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, contradictions resolved computed-wins per the decisions ledger (extract/computed/out/banner/decisions.md, human-acked; source resolved.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Everything the vocabulary cannot carry is named in contracts/banner.extension.json. Delta ledger: extract/computed/out/banner/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { tone = 'info', hideIcon = false, stopAnnouncements = false, dismissible = false, withAction = false, title, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`tone-${tone}`], className].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} data-hide-icon={hideIcon || undefined} data-stop-announcements={stopAnnouncements || undefined} data-dismissible={dismissible || undefined} data-with-action={withAction || undefined} role={ROLE_MAP[tone]} {...rest}>
      <div className={styles.box}>
<div className={styles.blockstack}>
<div className={styles["box-2"]}>
<div className={styles.inlinestack}>
<div className={styles["inlinestack-2"]}>
<span className={styles["part-0-0-0-0-0-0"]}>
<span className={styles.icon}>
{tone === 'success' ? (<span className={styles["icon-success"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["banner-icon-success"] }} />) : null}
{tone === 'info' ? (<span className={styles["icon-info"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["banner-icon-info"] }} />) : null}
{tone === 'warning' ? (<span className={styles["icon-warning"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["banner-icon-warning"] }} />) : null}
{tone === 'critical' ? (<span className={styles["icon-critical"]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["banner-icon-critical"] }} />) : null}
</span>
</span>
<h2 className={styles.title}>{title}</h2>
</div>
{dismissible ? (<button className={styles.button}>
{dismissible ? (<span className={styles.button__icon}>
{dismissible ? (<span className={styles["part-0-0-0-0-1-0-0"]}>
{dismissible ? (<span className={styles["icon-3"]}><span aria-hidden="true" className={styles["icon-3Glyph"]} dangerouslySetInnerHTML={{ __html: ICONS["banner-icon-3"] }} /></span>) : null}
</span>) : null}
</span>) : null}
</button>) : null}
</div>
</div>
<div className={styles["box-3"]}>
<div className={styles["blockstack-2"]}>
<div className={styles["part-0-0-1-0-0"]}>
<span className={styles["label-2"]}>Use your finance report to get detailed insights.</span>
</div>
{withAction ? (<div className={styles.buttongroup}>
{withAction ? (<div className={styles.buttongroup__item}>
{withAction ? (<button className={styles["button-2"]}>
{withAction ? (<span className={styles["label-3"]}>Print label</span>) : null}
</button>) : null}
</div>) : null}
</div>) : null}
</div>
</div>
</div>
</div>
    </div>
  );
});
