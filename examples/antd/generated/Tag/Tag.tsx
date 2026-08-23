/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/tag.contract.json (antd.tag v0.2.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLSpanElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   color
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './Tag.module.css';

const ICONS: Record<string, string> = {
  'tag-anticon':
    '<svg viewBox="0 0 858 858" xmlns="http://www.w3.org/2000/svg"><path d="M 799.86 166.31 C 799.88 166.31 799.9 166.33 799.94 166.37 L 857.63 224.07 C 857.67 224.1 857.68 224.12 857.69 224.15 A 0.12 0.12 0 0 1 857.69 224.21 C 857.69 224.24 857.67 224.26 857.63 224.3 L 569.93 512 L 857.63 799.7 C 857.67 799.74 857.68 799.76 857.69 799.79 A 0.12 0.12 0 0 1 857.69 799.86 C 857.69 799.88 857.67 799.9 857.63 799.94 L 799.93 857.63 C 799.9 857.67 799.88 857.68 799.86 857.69 A 0.12 0.12 0 0 1 799.79 857.69 C 799.76 857.69 799.74 857.67 799.7 857.63 L 512 569.93 L 224.3 857.63 C 224.26 857.67 224.24 857.68 224.21 857.69 A 0.12 0.12 0 0 1 224.14 857.69 C 224.12 857.69 224.1 857.67 224.06 857.63 L 166.37 799.93 C 166.33 799.9 166.32 799.88 166.31 799.86 A 0.12 0.12 0 0 1 166.31 799.79 C 166.31 799.76 166.33 799.74 166.37 799.7 L 454.07 512 L 166.37 224.3 C 166.33 224.26 166.32 224.24 166.31 224.21 A 0.12 0.12 0 0 1 166.31 224.14 C 166.31 224.12 166.33 224.1 166.37 224.06 L 224.07 166.37 C 224.1 166.33 224.12 166.32 224.14 166.31 A 0.12 0.12 0 0 1 224.21 166.31 C 224.24 166.31 224.26 166.33 224.3 166.37 L 512 454.07 L 799.7 166.37 C 799.74 166.33 799.76 166.32 799.79 166.31 A 0.12 0.12 0 0 1 799.86 166.31 Z" fill="currentColor" fill-rule="evenodd"/></svg>',
};

export interface TagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  color?: 'blue' | 'green' | 'red' | 'gold' | 'success' | 'processing' | 'error';
  bordered?: 'bordered' | 'borderless';
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `closable` (true); the created subtree is carried as parts gated on this prop. */
  closable?: boolean;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). DEFAULTLESS colour enum: antd Tag has no default `color`; the unset rendering is the neutral tag, so the capture prepends `unset` (enumeration.unsetLabel). The 7 presets are a CURATED slice of the 13 palette presets + 5 status presets (blue/green/red/gold = palette; success/processing/error = status) — the full 18 would be 18×2×2 = 72 renderings of one mechanism. `bordered` rides as a 2-value enum axis (bordered|borderless; config maps to the boolean). `closable` is a PRESENCE prop (mounts the close icon part). Root has NO hover plane; the close icon has (descendant state) — `hover` is declared so the delta can land. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { color = 'undefined', bordered = 'bordered', closable = false, className, children, ...rest },
  ref,
) {
  const classes = [styles.root, styles[`color-${color}`], styles[`bordered-${bordered}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <span ref={ref} className={classes} data-closable={closable || undefined} {...rest}>
      {closable ? (
        <span className={styles.anticon}>
          <span
            aria-hidden="true"
            className={styles.anticonGlyph}
            dangerouslySetInnerHTML={{ __html: ICONS['tag-anticon'] }}
          />
        </span>
      ) : null}
    </span>
  );
});
