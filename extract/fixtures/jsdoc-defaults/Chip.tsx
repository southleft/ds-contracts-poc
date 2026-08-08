/**
 * Eval fixture — THE DOCUMENTED DEFAULT (Fluent 2 recon §3a / H9).
 *
 * Fluent documents every prop default in JSDoc, in TWO tag spellings that
 * BOTH appear in the same library (`@default 'secondary'` on Button,
 * `@defaultvalue medium` on Badge). The extractor kept the prose and dropped
 * the tag, so all 42 enum axes read defaultless and the capture-config
 * drafter pinned each to its FIRST enum value — measurably wrong on
 * `Badge.size` (documented `medium`, pinned `tiny`) and `Avatar.active`
 * (documented `unset`, pinned `active`).
 *
 * This component carries, deliberately, one of each case the reader must
 * handle:
 *   · `@defaultvalue` bare word            → size: 'medium', NOT the first value
 *   · `@default` quoted string             → appearance: 'secondary'
 *   · `@default` boolean / number literal  → dismissible: false, weight: 400
 *   · a DISAGREEMENT with the initializer  → tone: initializer wins, receipted
 *   · a value outside the declared enum    → shape: not carried, receipted
 *   · PROSE instead of a literal           → icon: not carried, receipted
 *   · `@default undefined`                 → hint: documents the ABSENCE
 */
import * as React from 'react';

export interface ChipProps {
  /**
   * A Chip can be one of several preset sizes.
   * @defaultvalue medium
   */
  size?: 'tiny' | 'small' | 'medium' | 'large';
  /**
   * Visual weight.
   * @default 'secondary'
   */
  appearance?: 'primary' | 'secondary' | 'subtle';
  /**
   * Colour role. The JSDoc and the destructuring initializer DISAGREE — the
   * initializer is what the component runs, so it wins and the gap is named.
   * @default brand
   */
  tone?: 'brand' | 'neutral' | 'danger';
  /**
   * A shape the type does not declare — a contradiction, not a default.
   * @default pill
   */
  shape?: 'circular' | 'rounded' | 'square';
  /**
   * Whether the chip renders a dismiss affordance.
   * @default false
   */
  dismissible?: boolean;
  /**
   * Font weight of the label.
   * @default 400
   */
  weight?: number;
  /**
   * Leading glyph.
   * @default `SparkleRegular` (the default icon's size depends on the Chip's size)
   */
  icon?: string;
  /**
   * Helper text.
   * @default undefined
   */
  hint?: string;
}

export function Chip({ tone = 'neutral', dismissible = false }: ChipProps) {
  return <span data-tone={tone} data-dismissible={dismissible} />;
}
