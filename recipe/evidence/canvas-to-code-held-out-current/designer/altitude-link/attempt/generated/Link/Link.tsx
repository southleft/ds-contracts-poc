/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/link.contract.json (ds.link v0.1.0)
 * Regenerate with: npm run generate
 *
 * `children` OMITTED from AnchorHTMLAttributes<HTMLAnchorElement> — the contract declares no slot or
 * children-bound text, so JSX children would be discarded; the type refuses them.
 */
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Icon } from '../Icon';
import styles from './Link.module.css';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  disabled?: boolean;
}

/** PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { disabled = false, className, ...rest },
  ref,
) {
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <a ref={ref} className={classes} data-disabled={disabled || undefined} {...rest}>
      <span className={styles.linkText}>Link text</span>
      <Icon icon="3610:3127" />
    </a>
  );
});
