/**
 * FIXTURE (Polaris-shaped, synthesized): three intersection/hollow classes.
 *
 * `Banner` — props type is an intersection of NAMED same-file interfaces
 * (`type BannerProps = A & B`). Before the intersection-named-ref rule this
 * extracted "resolved" with 0 props and no note — schema-valid, plausible,
 * wrong. The members must carry now.
 *
 * `Ghost` — the same intersection shape but over IMPORTED refs: unreadable,
 * must be a NAMED skip (naming the refs), not a hollow contract.
 *
 * `PlainBox` — an extends-only interface: zero OWN props is the real API
 * here, extracted as such WITH the hollow receipt naming the heritage.
 */
import * as React from 'react';
import type { GhostA, GhostB } from './elsewhere';

interface NonMutuallyExclusiveProps {
  /** Feedback tone. */
  tone?: 'info' | 'warning' | 'critical';
  /** Heading text. */
  title?: string;
}

interface MutuallyExclusiveInteractionProps {
  /** Show a dismiss button. */
  dismissible?: boolean;
}

export type BannerProps = NonMutuallyExclusiveProps & MutuallyExclusiveInteractionProps;

export function Banner({ tone = 'info', title, dismissible = false }: BannerProps) {
  return <div data-tone={tone} data-dismissible={dismissible}>{title}</div>;
}

export type GhostProps = GhostA & GhostB;

export function Ghost(props: GhostProps) {
  return <div {...(props as object)} />;
}

export interface PlainBoxProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PlainBox(props: PlainBoxProps) {
  return <div {...props} />;
}
