/**
 * Figma variant name → render plan. A variant COMPONENT's name carries its
 * axis pairs ("size=large, state=hover"); the contract's OWN figma bindings
 * (prop.bindings.figma.property / .values) are the authoritative mapping —
 * nothing is fuzzy-guessed. An axis the contract cannot express is a NAMED
 * skip, never a silent drop.
 *
 * Interaction-state axes (state=hover|pressed|…, or the generator's State
 * preview axis) do not map to props — they map to the REAL browser
 * interaction the harness performs before the screenshot (hover the element,
 * hold the mouse down, keyboard-focus it). `state=disabled` maps to the
 * contract's disabled boolean when one exists. When the contract does not
 * carry the state at all, the variant still renders (base state) and the
 * pixels judge the miss — that is the gate working, so it is a note, not a
 * skip.
 */
import type { Contract } from '../../../core/index.js';

export type Interaction = 'none' | 'hover' | 'active' | 'focus-visible';

export type VariantPlan =
  | {
      ok: true;
      subst: Record<string, string>;
      bools: Record<string, boolean>;
      interaction: Interaction;
      notes: string[];
    }
  | { ok: false; reason: string };

const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_]+/g, '-');

/** Mirror of core/propose-figma.ts INTERACTION_STATE_BY_VALUE. */
const STATE_BY_VALUE: Record<string, 'default' | 'hover' | 'active' | 'focus-visible' | 'disabled'> = {
  default: 'default',
  hover: 'hover',
  active: 'active',
  pressed: 'active',
  focus: 'focus-visible',
  'focus-visible': 'focus-visible',
  disabled: 'disabled',
};

const axisValuesOf = (variantName: string): Record<string, string> => {
  if (!variantName.includes('=')) return {};
  const out: Record<string, string> = {};
  for (const pair of variantName.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && v !== undefined) out[k] = v;
  }
  return out;
};

type Prop = Contract['props'][number];
const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && p.type !== null && 'enum' in p.type;

export function planVariant(contract: Contract, variantName: string): VariantPlan {
  const axes = axisValuesOf(variantName);
  const subst: Record<string, string> = {};
  const bools: Record<string, boolean> = {};
  const notes: string[] = [];
  let interaction: Interaction = 'none';

  // A plain-named single COMPONENT ("Card / Default") has no axes — render
  // the all-defaults state.
  if (Object.keys(axes).length === 0) return { ok: true, subst, bools, interaction, notes };

  for (const [property, value] of Object.entries(axes)) {
    const prop = contract.props.find(
      (p) =>
        p.bindings.figma.property === property ||
        norm(p.bindings.figma.property ?? p.name) === norm(property) ||
        norm(p.name) === norm(property),
    );

    if (prop && isEnum(prop)) {
      const values = (prop.bindings.figma as { values?: Record<string, string> }).values ?? {};
      const match =
        Object.entries(values).find(([, figmaV]) => figmaV === value || norm(figmaV) === norm(value))?.[0] ??
        prop.type.enum.find((e) => e === value || norm(e) === norm(value));
      if (match === undefined) {
        return { ok: false, reason: `axis "${property}=${value}": no enum value of prop "${prop.name}" maps to "${value}"` };
      }
      subst[prop.name] = match;
      continue;
    }
    if (prop && prop.type === 'boolean') {
      const v = norm(value);
      if (v !== 'true' && v !== 'false') {
        return { ok: false, reason: `axis "${property}=${value}": prop "${prop.name}" is boolean but the value is not true/false` };
      }
      bools[prop.name] = v === 'true';
      continue;
    }
    if (prop) {
      notes.push(`axis "${property}=${value}" binds to ${String(prop.type)} prop "${prop.name}" — no variant-name projection; default rendered`);
      continue;
    }

    // Interaction-state axis (source "state=…" or the generator's "State=…").
    if (/^states?$/i.test(property)) {
      const st = STATE_BY_VALUE[norm(value)];
      if (!st) return { ok: false, reason: `state axis value "${value}" is outside the interaction-state vocabulary` };
      if (st === 'default') continue;
      if (st === 'disabled') {
        const disabledProp = contract.props.find((p) => p.type === 'boolean' && norm(p.name) === 'disabled');
        if (!disabledProp) {
          notes.push(`state=disabled: contract has no disabled boolean — base rendered, pixels judge the miss`);
          continue;
        }
        bools[disabledProp.name] = true;
        continue;
      }
      interaction = st;
      if (!contract.states.includes(st)) {
        notes.push(`state=${value}: contract carries no "${st}" state — base rendered, pixels judge the miss`);
      }
      continue;
    }

    return { ok: false, reason: `axis "${property}=${value}" has no contract binding (props: ${contract.props.map((p) => p.bindings.figma.property).join(', ')})` };
  }

  return { ok: true, subst, bools, interaction, notes };
}

/** File-name-safe slug for a variant name. */
export const variantSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s*,\s*/g, '_')
    .replace(/[^a-z0-9_=-]+/g, '-')
    .replace(/=/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'variant';
