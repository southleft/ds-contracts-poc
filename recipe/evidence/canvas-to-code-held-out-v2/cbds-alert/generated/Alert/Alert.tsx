/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/alert.contract.json (ds.alert v0.1.0)
 * Regenerate with: npm run generate
 *
 * DOM attrs OMITTED from HTMLAttributes<HTMLDivElement> — the contract's own props claim these
 * names, so the HTML attribute of the same name cannot be passed through ...rest:
 *   style
 *
 * `children` OMITTED from HTMLAttributes<HTMLDivElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { SizeLarge } from '../SizeLarge';
import { ToneBrandUnderlinedFalseSizeSmallStateDefault } from '../ToneBrandUnderlinedFalseSizeSmallStateDefault';
import styles from './Alert.module.css';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'style'> {
  type?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  style?: 'fill' | 'outline';
  action?: boolean;
  inlineAction?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { type = 'success', style = 'fill', action = true, inlineAction = true, className, ...rest },
  ref,
) {
  // undrawn-combination-rendered-by-composition: the design does not draw 10 of this
  // component's prop combinations (bindings.figma.absentVariants: type=success style=fill action=false inlineAction=true; type=success style=outline action=false inlineAction=true; type=danger style=fill action=false inlineAction=true; type=danger style=outline action=false inlineAction=true; type=warning style=fill action=false inlineAction=true; type=warning style=outline action=false inlineAction=true; type=info style=fill action=false inlineAction=true; type=info style=outline action=false inlineAction=true; type=neutral style=fill action=false inlineAction=true; type=neutral style=outline action=false inlineAction=true).
  // Nothing here refuses them: they render by composing the per-axis rules read from the
  // drawn variants, which is a rendering nobody designed or measured.
  const classes = [styles.root, styles[`type-${type}`], styles[`style-${style}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-action={action || undefined}
      data-inline-action={inlineAction || undefined}
      {...rest}
    >
      <div className={styles.contentTop}>
        <SizeLarge
          iconSwap={
            type === 'success'
              ? '184:93919'
              : type === 'danger'
                ? '184:94398'
                : type === 'warning'
                  ? '184:94461'
                  : type === 'info'
                    ? '184:93948'
                    : type === 'neutral'
                      ? '184:93948'
                      : undefined
          }
          size="large"
        />
        <span className={styles.alertTitle}>Alert title</span>
        {inlineAction ? (
          <ToneBrandUnderlinedFalseSizeSmallStateDefault
            size="small"
            state="default"
            text="Action"
            tone="brand"
          />
        ) : null}
        <SizeLarge iconSwap="184:89827" size="large" />
      </div>
      <div className={styles.Description}>
        <span className={styles.Message}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </span>
      </div>
    </div>
  );
});
