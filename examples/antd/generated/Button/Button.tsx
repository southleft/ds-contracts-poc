/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/button.contract.json (antd.button v0.2.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from ButtonHTMLAttributes<HTMLButtonElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   type
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

const ICONS: Record<string, string> = {
  'button-anticon':
    '<svg viewBox="0 0 910 910" xmlns="http://www.w3.org/2000/svg"><path d="M 909.6 854.5 L 649.9 594.8 C 690.2 542.7 712 479 712 412 C 712 331.8 680.7 256.6 624.1 199.9 C 567.5 143.2 492.1 112 412 112 S 256.5 143.3 199.9 199.9 C 143.2 256.5 112 331.8 112 412 C 112 492.1 143.3 567.5 199.9 624.1 C 256.5 680.8 331.8 712 412 712 C 479 712 542.6 690.2 594.7 650 L 854.4 909.6 A 8.2 8.2 0 0 0 866 909.6 L 909.6 866.1 A 8.2 8.2 0 0 0 909.6 854.5 Z M 570.4 570.4 C 528 612.7 471.8 636 412 636 S 296 612.7 253.6 570.4 C 211.3 528 188 471.8 188 412 S 211.3 295.9 253.6 253.6 C 296 211.3 352.2 188 412 188 S 528.1 211.2 570.4 253.6 S 636 352.2 636 412 S 612.7 528.1 570.4 570.4 Z" fill="currentColor"/></svg>',
  'button-anticon-2':
    '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M 988 548 C 968.1 548 952 531.9 952 512 C 952 452.6 940.4 395 917.4 340.7 A 440.45 440.45 0 0 0 823.1 200.8 A 437.71 437.71 0 0 0 683.2 106.5 C 629 83.6 571.4 72 512 72 C 492.1 72 476 55.9 476 36 S 492.1 0 512 0 C 581.1 0 648.2 13.5 711.3 40.3 C 772.3 66 827 103 874 150 C 921 197 957.9 251.8 983.7 312.7 C 1010.4 375.8 1023.9 442.9 1023.9 512 C 1024 531.9 1007.9 548 988 548 Z" fill="currentColor"/></svg>',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
  size?: 'small' | 'middle' | 'large';
  danger?: 'safe' | 'danger';
  disabled?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `icon` ({"$element":"@ant-design/icons#SearchOutlined"}); the created subtree is carried as parts gated on this prop. */
  icon?: boolean;
  /** Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's `loading` (true); the created subtree is carried as parts gated on this prop. */
  loading?: boolean;
}

/** Subject: antd@5.29.3 (pinned, examples/antd/PROVENANCE.md). CURATED seed for the antd P2 exam (code→canvas, held out) — props/axes only; anatomy is promoted from captured DOM truth. Every axis value is the library's own declared enum (antd spells them as `readonly [...]` tuples; seed-gen reads them once its declaration lookup ignores directory case — W1, examples/antd/RECON.md §4). type×size×danger = 30 renderings (RECON §3 #1). `danger` is antd's boolean but rides as a 2-value ENUM AXIS (safe|danger) because a rendering a prop selects is an axis, never a state (the MUI Switch `checked` reclassification); the capture config maps safe→false, danger→true. NAMED OUT (RECON §4 static-seed trap): htmlType/href/target/block/ghost/iconPosition/autoInsertSpace and the 5.21+ color(16)×variant(6) decomposition — type+danger select the five documented renderings; href swaps the root to <a>. `icon` and `loading` are PRESENCE props in the config (structure-creating), not axes. COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of antd@5.29.3 in headless Chromium 151.0.7922.34; overflow channels in the sibling extension file. FLOOR-PROMOTED (examples/antd/scripts/promote-floor.mjs): enriched.contract.json — computed-capture truth; minted leaves source-aliased to Ant Design's own CSS-variable references where verified (source-bindings.json); extension sidecar carries the named overflow. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = 'default',
    size = 'middle',
    danger = 'safe',
    disabled = false,
    icon = false,
    loading = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`type-${type}`],
    styles[`size-${size}`],
    styles[`danger-${danger}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled}
      data-icon={icon || undefined}
      data-loading={loading || undefined}
      {...rest}
    >
      {icon ? (
        <span className={styles['btn-icon']}>
          {icon ? (
            <span className={styles.anticon}>
              <span
                aria-hidden="true"
                className={styles.anticonGlyph}
                dangerouslySetInnerHTML={{ __html: ICONS['button-anticon'] }}
              />
            </span>
          ) : null}
        </span>
      ) : null}
      {loading ? (
        <span className={styles['btn-icon-2']}>
          {loading ? (
            <span className={styles['anticon-2']}>
              <span
                aria-hidden="true"
                className={styles['anticon-2Glyph']}
                dangerouslySetInnerHTML={{ __html: ICONS['button-anticon-2'] }}
              />
            </span>
          ) : null}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
    </button>
  );
});
