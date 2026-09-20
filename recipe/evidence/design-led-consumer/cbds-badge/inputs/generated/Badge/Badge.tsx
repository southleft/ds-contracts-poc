/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/badge.contract.json (ds.badge v0.1.0)
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
import { Icon } from '../Icon';
import styles from './Badge.module.css';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'style'> {
  type?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent';
  style?: 'fill' | 'tonal' | 'outline';
  size?: 'large' | 'small';
  rounded?: boolean;
  text?: string;
  iconLeft?: boolean;
  iconRight?: boolean;
}

/** A versatile badge component for labeling, categorizing, or highlighting content with support for 6 semantic color types, 3 visual styles, 2 sizes, optional rounded corners, and optional leading/trailing icons. 


PURPOSE: Badges are non-interactive status indicators used to communicate categorical information, counts, or states at a glance. They support semantic intent through color types (brand, success, warning, danger, neutral, accent) and visual weight through style variants (fill, tonal, outline). 


BEHAVIOR: This component is purely presentational with no interactive states — it does not respond to hover, focus, or press events. Icon visibility is controlled via boolean toggles for left and right positions independently. 


COMPOSITION: Contains two Icon instances (left and right positions, each wrapping a Placeholder instance with a vector icon) and a Label text node. AI code generators should search the codebase for existing Icon and Placeholder sub-components before creating new ones — these are likely shared primitives used across the design system. 


USAGE: Use badges to annotate UI elements with status, category, or metadata. Choose 'fill' for high-emphasis labels, 'tonal' for medium-emphasis on light backgrounds, and 'outline' for low-emphasis or when background contrast is a concern. Use 'rounded=true' for pill-style badges common in tag or chip contexts. Prefer 'large' for standalone use and 'small' for dense or inline contexts. 


CODE GENERATION NOTES: The component produces 72 total variants (6 types × 3 styles × 2 sizes × 2 rounded states). Icon visibility should be implemented via conditional rendering driven by the iconLeft and iconRight boolean props. The iconLeft and iconRight props are booleans that reveal nested Icon instance slots. All 47 design tokens are fully applied with zero hard-coded values, indicating a mature, token-complete component.

ACCESSIBILITY: A badge is almost always non-interactive text — it needs no role, but its meaning must not depend on color alone (WCAG 1.4.1). type=success and type=danger differ only by hue, so the label must carry the meaning ("Active", "Failed"), never a bare color swatch. Ensure the label meets 4.5:1 against the badge fill in all three styles; the outline style is the tightest case. If a badge is dismissible or filterable it becomes a control and needs a button, a name, and a focus state. */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  {
    type = 'brand',
    style = 'fill',
    size = 'large',
    rounded = false,
    iconLeft = false,
    iconRight = false,
    text = 'Label',
    className,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.root,
    styles[`type-${type}`],
    styles[`style-${style}`],
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      data-rounded={rounded || undefined}
      data-icon-left={iconLeft || undefined}
      data-icon-right={iconRight || undefined}
      {...rest}
    >
      {iconLeft ? (
        <Icon size={size === 'large' ? 'small' : size === 'small' ? 'xsmall' : undefined} />
      ) : null}
      <span className={styles.Label}>{text}</span>
      {iconRight ? (
        <Icon size={size === 'large' ? 'small' : size === 'small' ? 'xsmall' : undefined} />
      ) : null}
    </div>
  );
});
