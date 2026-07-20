/**
 * Eval fixture — UNION-OF-REFS RULE (the mutually-exclusive-API sibling of
 * the intersection rule): `type RangeProps = RangeSingleProps |
 * RangeDualProps`, both branches extending a shared same-file base. The
 * merged surface must carry the base members (heritage chased through the
 * same-file chain), force branch-specific members optional (`legend` is
 * REQUIRED in the dual branch only), and receipt the union merge.
 */
import * as React from 'react';

interface RangeBaseProps {
  /** Sound level. */
  tone?: 'quiet' | 'loud';
  /** Minimum value. */
  min?: number;
  /** Maximum value. */
  max?: number;
}

export interface RangeSingleProps extends RangeBaseProps {
  /** Current value (single mode). */
  value: number;
  /** Change callback (single mode). */
  onChange?: (value: number) => void;
}

export interface RangeDualProps extends RangeBaseProps {
  /** Current value (dual mode). */
  value: [number, number];
  /** Change callback (dual mode). */
  onChange?: (value: [number, number]) => void;
  /** REQUIRED in this branch only — must merge as optional. */
  legend: string;
}

export type RangeProps = RangeSingleProps | RangeDualProps;

export function Range(props: RangeProps) {
  return <div data-min={props.min} data-max={props.max} />;
}
