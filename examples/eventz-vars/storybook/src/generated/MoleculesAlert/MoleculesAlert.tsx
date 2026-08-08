/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/molecules-alert.contract.json (ds.molecules-alert v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { IconsCheckCircle } from '../IconsCheckCircle';
import { AtomsTextLink } from '../AtomsTextLink';
import { IconsClose } from '../IconsClose';
import styles from './MoleculesAlert.module.css';

export interface MoleculesAlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'info' | 'warning' | 'danger';
  titleText?: string;
  descriptionText?: string;
  hasIcon?: boolean;
  hasLink?: boolean;
  isDismissible?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const MoleculesAlert = forwardRef<HTMLDivElement, MoleculesAlertProps>(
  function MoleculesAlert(
    {
      variant = 'success',
      hasIcon = true,
      hasLink = true,
      isDismissible = true,
      titleText = 'Title',
      descriptionText = 'Description',
      className,
      children,
      ...rest
    },
    ref,
  ) {
    // axis-inert (ledgered, not a throw): variant — no `.<axis>-*` rule
    // exists in MoleculesAlert.module.css, so no class is composed for it. A reference
    // to an unemitted class resolves to `undefined` and is filtered out, so emitting
    // one only made a style-less axis LOOK styled. Whatever this axis carries rides
    // structure (a gated part, a per-value text/icon lookup, a child's own props) —
    // or, where the source drew no difference at all, nothing.
    const classes = [styles.root, className].filter(Boolean).join(' ');
    return (
      <div
        ref={ref}
        className={classes}
        data-has-icon={hasIcon || undefined}
        data-has-link={hasLink || undefined}
        data-is-dismissible={isDismissible || undefined}
        {...rest}
      >
        {hasIcon ? (
          <div className={styles.container}>
            <IconsCheckCircle size="20" />
          </div>
        ) : null}
        <div className={styles.horizontalStack}>
          <div className={styles.horizontalStack2}>
            <span className={styles.Title}>{titleText}</span>
            <span className={styles.Description}>{descriptionText}</span>
          </div>
          {hasLink ? <AtomsTextLink text="Label" emphasis="inverted" state="default" /> : null}
        </div>
        {isDismissible ? (
          <div className={styles.container2}>
            <IconsClose size="20" />
          </div>
        ) : null}
      </div>
    );
  },
);
