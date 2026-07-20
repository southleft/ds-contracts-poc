/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/avatar.contract.json (polaris.avatar v0.3.1)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Avatar.module.css';

const ICONS: Record<string, string> = {
  "avatar-initials-xs": "<svg viewBox=\"0 0 40 40\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 25.5 13.5 C 25.5 16.5376 23.0376 19 20 19 C 16.9624 19 14.5 16.5376 14.5 13.5 C 14.5 10.4624 16.9624 8 20 8 C 23.0376 8 25.5 10.4624 25.5 13.5 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"/><path d=\"M 10.3433 29.682 L 9.47 31.254 C 9.03481 32.0373 9.60125 33 10.4974 33 H 29.5026 C 30.3988 33 30.9652 32.0373 30.53 31.254 L 29.6567 29.682 C 27.7084 26.175 24.0119 24 20 24 C 15.9882 24 12.2916 26.175 10.3433 29.682 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "avatar-initials-sm": "<svg viewBox=\"0 0 40 40\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 25.5 13.5 C 25.5 16.5376 23.0376 19 20 19 C 16.9624 19 14.5 16.5376 14.5 13.5 C 14.5 10.4624 16.9624 8 20 8 C 23.0376 8 25.5 10.4624 25.5 13.5 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><path d=\"M 10.3433 29.682 L 9.47 31.254 C 9.03481 32.0373 9.60125 33 10.4974 33 H 29.5026 C 30.3988 33 30.9652 32.0373 30.53 31.254 L 29.6567 29.682 C 27.7084 26.175 24.0119 24 20 24 C 15.9882 24 12.2916 26.175 10.3433 29.682 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "avatar-initials-md": "<svg viewBox=\"0 0 40 40\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 25.5 13.5 C 25.5 16.5376 23.0376 19 20 19 C 16.9624 19 14.5 16.5376 14.5 13.5 C 14.5 10.4624 16.9624 8 20 8 C 23.0376 8 25.5 10.4624 25.5 13.5 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><path d=\"M 10.3433 29.682 L 9.47 31.254 C 9.03481 32.0373 9.60125 33 10.4974 33 H 29.5026 C 30.3988 33 30.9652 32.0373 30.53 31.254 L 29.6567 29.682 C 27.7084 26.175 24.0119 24 20 24 C 15.9882 24 12.2916 26.175 10.3433 29.682 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "avatar-initials-lg": "<svg viewBox=\"0 0 40 40\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 25.5 13.5 C 25.5 16.5376 23.0376 19 20 19 C 16.9624 19 14.5 16.5376 14.5 13.5 C 14.5 10.4624 16.9624 8 20 8 C 23.0376 8 25.5 10.4624 25.5 13.5 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"/><path d=\"M 10.3433 29.682 L 9.47 31.254 C 9.03481 32.0373 9.60125 33 10.4974 33 H 29.5026 C 30.3988 33 30.9652 32.0373 30.53 31.254 L 29.6567 29.682 C 27.7084 26.175 24.0119 24 20 24 C 15.9882 24 12.2916 26.175 10.3433 29.682 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "avatar-initials-xl": "<svg viewBox=\"0 0 40 40\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 25.5 13.5 C 25.5 16.5376 23.0376 19 20 19 C 16.9624 19 14.5 16.5376 14.5 13.5 C 14.5 10.4624 16.9624 8 20 8 C 23.0376 8 25.5 10.4624 25.5 13.5 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M 10.3433 29.682 L 9.47 31.254 C 9.03481 32.0373 9.60125 33 10.4974 33 H 29.5026 C 30.3988 33 30.9652 32.0373 30.53 31.254 L 29.6567 29.682 C 27.7084 26.175 24.0119 24 20 24 C 15.9882 24 12.2916 26.175 10.3433 29.682 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
};

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Size of avatar */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** The name of the person */
  name?: string;
  /** Initials of person to display */
  initials?: string;
  /** Whether the avatar is for a customer */
  customer?: boolean;
  /** URL of the avatar image which falls back to initials if the image fails to load */
  source?: string;
  /** Accessible label for the avatar image */
  accessibilityLabel?: string;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `initials` ("TP"); the created subtree is carried as parts gated on this prop. */
  withInitials?: boolean;
}

/** PROPOSED contract extracted from examples/polaris/.polaris-clone/polaris-react/src/components/Avatar/Avatar.tsx (react-tsx + css-module adapters) — API surface AND anatomy (structure, token bindings, layout, states) read from source; design bindings await reconciliation and human review. PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ 2b1ea88625e0613853ca8577c9acd1980a90f382 (polaris-react 13.10.1, MIT © Shopify, extracted 2026-07-18); styling bindings promoted from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of @shopify/polaris@13.9.5 in headless Chromium 148.0.7778.96; overflow channels in the sibling extension file. FLOOR-PROMOTED v0.3.1 (extract/computed rounds 4 + 5c): this contract is the computed-floor rebuild — complete browser truth captured from the real @shopify/polaris@13.9.5 npm package rendered in headless Chromium 148.0.7778.96 (every enumerated longhand per element incl. ::before/::after, full state sweep, double-run byte-identity), fused with the static semantic layer (BOUND bindings browser-confirmed, unlabeled channels MINTED as imported.* tokens in tokens/polaris-minted.dtcg.json, uniform registry channels DECLARED), with the round-4 DOM-ANATOMY PROMOTION: every rendered element is a carried part, svg glyph content rides committed icon assets reconstructed from the captured d/fill channels, presence facts gate structure-creating props, contradictions resolved computed-wins per the decisions ledger (extract/computed/out/avatar/decisions.md, human-acked; source resolved.contract.json). Round 5c promotion lifts: complement-of-product presence (a default subtree an alternative replaces carries an ordered hide/restore stylesWhen cascade, verified per combo), root-hosted svg plans, authored-viewBox unification across per-size glyph captures, carried-channel re-mint when a defaultless axis contests the reviewed carriage (S2 maps with the unset base), curated shape geometry re-derived from the captured computed box, and drawn pseudo-element decor boxes carried as shape parts (S5 v1). Everything the vocabulary cannot carry is named in contracts/avatar.extension.json. Delta ledger: extract/computed/out/avatar/LEDGER.md (supersedes this component's section of extraction/PROMOTION.md). */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = 'md', customer = false, withInitials = false, name, initials, source, accessibilityLabel, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`size-${size}`], className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} data-customer={customer || undefined} data-with-initials={withInitials || undefined} {...rest}>
      <span className={styles.initials}>{initials}</span>
    </span>
  );
});
