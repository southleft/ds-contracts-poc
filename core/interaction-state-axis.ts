/**
 * THE INTERACTION-STATE AXIS VOCABULARY — one table, every reader (docs/23 §D.41).
 *
 * A designer draws what the platform RUNS — :hover, :focus-visible, :active,
 * native `disabled` — as a VARIANT axis ("State = Default | Hover | Focus |
 * Disabled"), because a canvas cannot run a pseudo-class. That axis is not
 * API. A variant axis whose EVERY value is in the closed table below is
 * projected onto the contract's existing state vocabulary (`states`,
 * `anatomy.*.states`, the `disabled` boolean) — deterministically, by this
 * table and nothing else. Matching is case-, space- and underscore-insensitive
 * and EXACT per token: "Focus Visible" is `focus-visible`, "Focused" is not in
 * the table and is never guessed at.
 *
 * The table is what the contract can already express and both code emitters
 * already render (packages/core/src/anatomy.ts STATE_SELECTORS: hover, active,
 * focus-visible, disabled). Everything else a designer may put on a "State"
 * axis — error, selected, filled, open, loading, current-page, focused,
 * hovered, rest, enabled — is NOT a platform interaction state this contract
 * models, so an axis carrying one stays an ordinary enum prop, named.
 *
 * Readers: core/propose-figma.ts (the projection), extract/figma/
 * visual-parity/match.ts and scripts/design-consumer-check.ts (mounting a
 * state-axis variant for image comparison).
 */
export type InteractionState = 'default' | 'hover' | 'active' | 'focus-visible' | 'disabled';

export const INTERACTION_STATE_BY_VALUE: Readonly<Record<string, InteractionState>> = {
  default: 'default',
  hover: 'hover',
  active: 'active',
  pressed: 'active',
  focus: 'focus-visible',
  'focus-visible': 'focus-visible',
  disabled: 'disabled',
};

/** "Focus Visible" / "focus_visible" / " FOCUS-VISIBLE " → "focus-visible". */
export const normStateValue = (v: string): string => v.trim().toLowerCase().replace(/[\s_]+/g, '-');

/** The axis NAME says "state": `state`, `State`, `states`. */
export const isStateAxisName = (property: string): boolean => /^states?$/i.test(property.trim());

export const interactionStateOf = (value: string): InteractionState | undefined =>
  Object.prototype.hasOwnProperty.call(INTERACTION_STATE_BY_VALUE, normStateValue(value))
    ? INTERACTION_STATE_BY_VALUE[normStateValue(value)]
    : undefined;

/** Why a variant axis that LOOKS like interaction states is not projected.
 *  Each is a stable slug a refusal or a note carries verbatim. */
export type StateAxisRefusal =
  /** A value outside the table (names it). */
  | 'state-axis-value-outside-vocabulary'
  /** No value maps to `default` — nothing to diff the other states against. */
  | 'state-axis-no-rest-value'
  /** Only the rest value — no state to project. */
  | 'state-axis-no-state-value'
  /** Two values map to one contract state (`Pressed` and `Active`). */
  | 'state-axis-duplicate-state'
  /** Two axes of one set both read as pure interaction-state axes. */
  | 'state-axis-multiple'
  /** Not named "state" and fewer than two non-rest values: weak evidence. */
  | 'state-axis-unnamed-incomplete';

export interface StateAxisProjection {
  /** The Figma variant property, as the designer spelled it. */
  property: string;
  /** Figma value → contract state, in the axis's own value order. */
  values: Array<{ value: string; state: InteractionState }>;
  /** The Figma value that is the rest state. */
  restValue: string;
}

export type StateAxisReading =
  | { kind: 'projected'; projection: StateAxisProjection }
  | { kind: 'not-a-state-axis' }
  | { kind: 'refused'; reason: StateAxisRefusal; detail: string };

/** Read ONE variant axis against the table. `not-a-state-axis` = an axis
 *  that neither says "state" nor consists purely of table values: it is API
 *  and nothing is said about it. A NAMED state axis that falls outside the
 *  table, or a pure-vocabulary axis that cannot be projected, is `refused`
 *  with the exact value or condition that stopped it. */
export function readStateAxis(property: string, values: readonly string[]): StateAxisReading {
  const named = isStateAxisName(property);
  const mapped = values.map((value) => ({ value, state: interactionStateOf(value) }));
  const outside = mapped.filter((m) => m.state === undefined).map((m) => m.value);
  if (outside.length > 0) {
    if (!named) return { kind: 'not-a-state-axis' };
    return {
      kind: 'refused',
      reason: 'state-axis-value-outside-vocabulary',
      detail: `variant axis "${property}": value(s) ${outside.map((v) => `"${v}"`).join(', ')} are outside the interaction-state vocabulary (${Object.keys(INTERACTION_STATE_BY_VALUE).join('|')})`,
    };
  }
  const pure = mapped as Array<{ value: string; state: InteractionState }>;
  const rest = pure.filter((m) => m.state === 'default');
  const nonRest = pure.filter((m) => m.state !== 'default');
  if (rest.length === 0) {
    return {
      kind: 'refused',
      reason: 'state-axis-no-rest-value',
      detail: `variant axis "${property}" (${values.join('|')}): every value is an interaction state but none is the rest state ("default") the others are read against`,
    };
  }
  if (nonRest.length === 0) {
    return named
      ? {
          kind: 'refused',
          reason: 'state-axis-no-state-value',
          detail: `variant axis "${property}" (${values.join('|')}): only the rest value is drawn — there is no state to project`,
        }
      : { kind: 'not-a-state-axis' };
  }
  if (!named && nonRest.length < 2) {
    return {
      kind: 'refused',
      reason: 'state-axis-unnamed-incomplete',
      detail: `variant axis "${property}" (${values.join('|')}): its values are interaction states but the axis is not named "state" and draws fewer than two non-rest states — too little evidence that it is not API`,
    };
  }
  const seen = new Map<InteractionState, string>();
  for (const m of pure) {
    const prior = seen.get(m.state);
    if (prior !== undefined) {
      return {
        kind: 'refused',
        reason: 'state-axis-duplicate-state',
        detail: `variant axis "${property}": values "${prior}" and "${m.value}" both mean contract state "${m.state}" — one contract state cannot carry two drawings`,
      };
    }
    seen.set(m.state, m.value);
  }
  return { kind: 'projected', projection: { property, values: pure, restValue: rest[0]!.value } };
}

/** Read a SET's axes: at most one may project. Two pure state axes refuse
 *  (`state-axis-multiple`) — which one the platform runs is not drawn. */
export function readStateAxes(
  axes: ReadonlyArray<{ property: string; values: readonly string[] }>,
): StateAxisReading {
  const readings = axes.map((a) => readStateAxis(a.property, a.values));
  const projected = readings.filter((r): r is Extract<StateAxisReading, { kind: 'projected' }> => r.kind === 'projected');
  if (projected.length > 1) {
    return {
      kind: 'refused',
      reason: 'state-axis-multiple',
      detail: `variant axes ${projected.map((p) => `"${p.projection.property}"`).join(' and ')} both consist purely of interaction states — a component has one interaction state at a time, and which axis the platform runs is not drawn`,
    };
  }
  if (projected.length === 1) return projected[0]!;
  return readings.find((r) => r.kind === 'refused') ?? { kind: 'not-a-state-axis' };
}
