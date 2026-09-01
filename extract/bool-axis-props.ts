/**
 * Boolean props that SELECT A RENDERING rather than describe a pseudo-class
 * plane. The capture runner's state vocabulary is closed (hover, active,
 * focus-visible, disabled): a state is something the SAME instance takes
 * without a prop changing. `checked` is not that — `checked={true}` mounts a
 * different rendering, so it is a VARIANT AXIS in the capture config
 * (`axes` + `axisValueMap`) and an ENUM prop in the seed contract.
 *
 * The drafter (extract/draft-capture-config.ts) and the seed proposer
 * (extract/propose.ts) both read this table so they cannot disagree again:
 * before this module the drafter emitted `stateProps: [{prop: "checked",
 * state: "checked"}]` and the runner's loadConfig refused it by name on the
 * very first `onboard --continue` of any library with a checkbox, switch,
 * radio or toggle. Every committed seed (examples/<lib>/contracts-seed) already
 * models it the axis way by hand; this makes the tool do what the seeds do.
 *
 * Values are the axis labels in mount order: [prop=false, prop=true].
 */
export const AXIS_BY_BOOL_PROP: Readonly<Record<string, readonly [string, string]>> = {
  checked: ['unchecked', 'checked'],
};

/** Capture-config `axisValueMap` entry for a boolean-selected axis: each label
 *  mounts the boolean through the `$props` form. */
export function boolAxisValueMap(prop: string): Record<string, { $props: Record<string, boolean> }> {
  const [off, on] = AXIS_BY_BOOL_PROP[prop]!;
  return {
    [off]: { $props: { [prop]: false } },
    [on]: { $props: { [prop]: true } },
  };
}
