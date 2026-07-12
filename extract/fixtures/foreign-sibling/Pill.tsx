/**
 * FIXTURE (Carbon-Tag-shaped, synthesized): the public name is a CAST-ALIAS
 * of the base component — `const Pill = PillBase as PillComponent`. Before
 * the cast-alias rule the public name was silently absent while the base
 * extracted; both must extract now, with the same props.
 *
 * `Opal` is the companion regression: an as-cast forwardRef whose props type
 * is IMPORTED — it must land as a NAMED skip, never vanish.
 */
import * as React from 'react';
import type { OpalProps } from './elsewhere';

interface PillProps {
  /** Visual tone of the pill. */
  tone?: 'neutral' | 'bold' | 'critical';
  /** Render a dismiss affordance. */
  dismissible?: boolean;
}

type PillComponent = React.ForwardRefExoticComponent<PillProps> & { displayName?: string };

const PillBase = React.forwardRef(function PillBase(
  { tone = 'neutral', dismissible = false }: PillProps,
  ref: React.ForwardedRef<HTMLSpanElement>,
) {
  return <span ref={ref} data-tone={tone} data-dismissible={dismissible} />;
});

export const Pill = PillBase as PillComponent;

export const Opal = React.forwardRef((props: OpalProps, ref: React.ForwardedRef<HTMLDivElement>) => {
  return <div ref={ref} {...(props as object)} />;
}) as React.ForwardRefExoticComponent<OpalProps>;
