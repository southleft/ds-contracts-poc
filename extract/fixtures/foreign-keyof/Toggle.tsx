/**
 * Eval fixture — KEYOF-ENUM RULE (Astryx-shaped, foreign-sibling pattern:
 * synthesized, no vendored code). The three resolvable `keyof` spellings a
 * StyleX-era library uses for its headline axes, plus one UNRESOLVABLE
 * target that must land as a NAMED refusal, never a silent 'other':
 *   · keyof InterfaceLiteral        (augmentation-friendly variant maps)
 *   · keyof typeof factoryCall      (keys of `create({…})`-style objects)
 *   · keyof typeof constObject      (plain `as const` tables)
 *   · keyof typeof importedValue    (outside module scope → named refusal)
 */
import * as React from 'react';
import {createSheet} from 'atomic-styling-lib';
import {importedFlavors} from 'flavor-pack';

export interface ToggleToneMap {
  neutral: true;
  accent: true;
  danger: true;
}
export type ToggleTone = keyof ToggleToneMap;

const paceStyles = createSheet({
  slow: {transitionDuration: '400ms'},
  fast: {transitionDuration: '80ms'},
});
export type TogglePace = keyof typeof paceStyles;

const densityTable = {
  compact: 4,
  cozy: 8,
} as const;
export type ToggleDensity = keyof typeof densityTable;

export interface ToggleProps {
  /** Tone of the toggle. */
  tone?: ToggleTone;
  /** Animation pace. */
  pace?: TogglePace;
  /** Vertical density. */
  density?: ToggleDensity;
  /** Unresolvable: the keyed object is imported. */
  flavor?: keyof typeof importedFlavors;
  /** Pressed state. */
  pressed?: boolean;
}

export function Toggle({tone = 'neutral', pressed = false}: ToggleProps) {
  return <button aria-pressed={pressed} data-tone={tone} />;
}
