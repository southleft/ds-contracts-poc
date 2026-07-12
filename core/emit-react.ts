/**
 * Contract → React code emission — the PURE core of scripts/generate-components.ts.
 *
 * Everything here is string-in/string-out: contract + token inventory +
 * icon assets in, TSX / CSS Module / stories text out. No node:* imports —
 * this module runs unchanged in a browser (see core/index.ts and
 * npm run core:browser-check). The CLI shell (scripts/generate-components.ts)
 * owns file discovery, prettier formatting, and writes; its output is
 * byte-guarded by evals/golden.json.
 *
 * Composition semantics (see docs/02 + docs/08):
 *   - anatomy is a nested tree; each part becomes a class-named element
 *   - `component` parts render fixed instances of other contracts (imported)
 *   - `slot` parts render {children} (name "children") or a ReactNode prop
 *   - `content` parts render a bound text prop
 *   - optional parts render conditionally on their slot prop
 */
import {
  STATE_PREVIEW_PROPERTY,
  STYLES_WHEN_ALLOWED,
  isNativeCheckablePart,
  pascal,
  shapeCssDecls,
  slotsOf,
  statePreviewSubstProps,
  walkAnatomy,
  type Contract,
  type Part,
  type Prop,
} from '../scripts/contract-schema.js';

/** v11 SEMANTIC LINT — roles that RE-CREATE a control the platform already
 *  ships. A contract claiming one of these roles (semantics.role, a
 *  roleByProp value, or a part's attrs.role) on an element outside the
 *  allowed native hosts REFUSES at validation time, on every surface, unless
 *  it declares the exception (semantics.roleException for root-level claims,
 *  part.roleException for part-level ones) — a one-sentence reason that
 *  renders on the spec sheet so it is reviewable, never silent. Bounded by
 *  design: exactly the roles with a native equivalent; APG composites
 *  (tablist, option, toolbar, …) are not in the table. */
export const NATIVE_ROLE_HOSTS: Record<string, { hosts: string[]; native: string }> = {
  checkbox: { hosts: ['input'], native: '<input type="checkbox">' },
  radio: { hosts: ['input'], native: '<input type="radio">' },
  switch: { hosts: ['input'], native: '<input type="checkbox"> (role="switch" on it is the modern switch pattern)' },
  button: { hosts: ['button'], native: '<button>' },
  link: { hosts: ['a'], native: '<a href>' },
  textbox: { hosts: ['input', 'textarea'], native: '<input> / <textarea>' },
  slider: { hosts: ['input'], native: '<input type="range">' },
  progressbar: { hosts: ['progress'], native: '<progress>' },
  spinbutton: { hosts: ['input'], native: '<input type="number">' },
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const stripBraces = (ref: string) => ref.slice(1, -1);
const cssVar = (tokenPath: string) => `var(--${tokenPath.split('.').join('-')})`;

function placeholdersIn(refPath: string): string[] {
  return [...refPath.matchAll(/\{([a-z][\w-]*)\}/g)].map((m) => m[1]);
}

const STATE_SELECTORS: Record<string, string> = {
  hover: ':hover:not(:disabled)',
  active: ':active:not(:disabled)',
  'focus-visible': ':focus-visible',
  disabled: ':disabled',
};

/** Elements the UA stylesheet gives default MARGINS. A component's box is
 *  contract-governed — spacing between components belongs to the composing
 *  layout, never to a UA default leaking through (field failure: Heading's
 *  h1-h6 carried the UA's 0.67em block margins into every composition). The
 *  emitters neutralize margin on the root class when the root can render as
 *  one of these (semantics.element or any elementByProp value). */
export const UA_MARGIN_ELEMENTS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'figure', 'hr', 'ul', 'ol', 'dl', 'dd', 'pre', 'fieldset',
]);

/** Every element the contract's root can render as. */
export function rootElementsOf(contract: Contract): string[] {
  const ebp = contract.semantics.elementByProp;
  return [contract.semantics.element, ...(ebp ? Object.values(ebp.map) : [])];
}

/** v7 overlay: placement → inset declarations. The overlay part is
 *  position:absolute against the root (which becomes position:relative). */
const OVERLAY_CSS: Record<string, string[]> = {
  top: ['bottom: 100%', 'left: 0'],
  bottom: ['top: 100%', 'left: 0'],
  start: ['right: 100%', 'top: 0'],
  end: ['left: 100%', 'top: 0'],
};

const ALIGN_CSS: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};
const JUSTIFY_CSS: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

export const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

/** v7: structured/array prop — code-only (bindings.figma.kind 'NONE'). */
export const isArrayType = (
  p: Prop,
): p is Prop & { type: { arrayOf: Record<string, 'text' | 'number' | 'boolean'> } } =>
  typeof p.type === 'object' && 'arrayOf' in p.type;

export function enumProps(contract: Contract) {
  return contract.props.filter(isEnum);
}
export function boolProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'boolean');
}
export function numberProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'number');
}
export function arrayProps(contract: Contract) {
  return contract.props.filter(isArrayType);
}
export function textProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'text');
}
export function namedTextProps(contract: Contract) {
  return textProps(contract).filter((p) => p.bindings.code.prop !== 'children');
}
export function namedSlots(contract: Contract) {
  return slotsOf(contract).filter((s) => s.slot.name !== 'children');
}
export function textDefault(contract: Contract): string {
  const text = textProps(contract).find((p) => p.bindings.code.prop === 'children');
  return typeof text?.default === 'string' ? text.default : contract.name;
}

const isStructural = (part: Part) =>
  Boolean(part.parts || part.slot || part.layout || part.layoutByProp) &&
  !part.content &&
  !part.component;

/** CSS declarations for a layoutByProp override (v7). Reversed directions
 *  are plain CSS here; the canvas resolves them by reversing child order. */
function layoutOverrideDecls(o: {
  display?: string;
  direction?: string;
  align?: string;
  justify?: string;
}): string[] {
  const d: string[] = [];
  if (o.display) d.push(`display: ${o.display}`);
  if (o.direction) d.push(`flex-direction: ${o.direction}`);
  if (o.align) d.push(`align-items: ${ALIGN_CSS[o.align]}`);
  if (o.justify) d.push(`justify-content: ${JUSTIFY_CSS[o.justify]}`);
  return d;
}

// ---------------------------------------------------------------------------
// Contract-level validation (beyond the Zod schema)
// ---------------------------------------------------------------------------

/** Component refs must form a DAG — the emitters render composition by
 *  recursion, so a contract that composes itself (directly or through a
 *  chain of dependencies) is infinite anatomy. The field failure mode is a
 *  'Maximum call stack size exceeded' crash instead of a named refusal
 *  (live repro: a hand-edited ds.button whose anatomy kept a ds.button
 *  instance). Walks the ref graph (component refs + slot defaultContent)
 *  from `startId`, treating `fromId` as already on the path; returns the
 *  cycle spelled out (e.g. [ds.button, ds.button]) or null. Contracts
 *  missing from `byId` end the walk — their absence is its own refusal. */
function findComponentCycle(
  fromId: string,
  startId: string,
  byId: Map<string, Contract>,
): string[] | null {
  const acyclic = new Set<string>(); // fully explored, no cycle reachable
  const visit = (id: string, path: string[]): string[] | null => {
    const at = path.indexOf(id);
    if (at >= 0) return [...path.slice(at), id];
    if (acyclic.has(id)) return null;
    const dep = byId.get(id);
    if (!dep) return null;
    const next = [...path, id];
    for (const w of walkAnatomy(dep)) {
      const targets = [
        ...(w.part.component ? [w.part.component.id] : []),
        ...(w.part.slot?.defaultContent ?? []).map((item) => item.id),
      ];
      for (const t of targets) {
        const cycle = visit(t, next);
        if (cycle) return cycle;
      }
    }
    acyclic.add(id);
    return null;
  };
  return visit(startId, [fromId]);
}

export function validateContract(
  contract: Contract,
  byId: Map<string, Contract>,
  errors: string[],
  iconAssets: Map<string, string>,
) {
  const enumNames = new Set(enumProps(contract).map((p) => p.name));
  const hasChildrenText = (dep: Contract) =>
    dep.props.some((p) => p.type === 'text' && p.bindings.code.prop === 'children');
  const seen = new Set<string>();
  for (const { name, path: p, part } of walkAnatomy(contract)) {
    if (seen.has(name)) errors.push(`${contract.id}: duplicate anatomy part name "${name}"`);
    seen.add(name);
    if (part.component) {
      const dep = byId.get(part.component.id);
      if (!dep) {
        errors.push(`${contract.id}: part "${name}" references component "${part.component.id}" which has no contract in scope`);
      }
      const cycle = findComponentCycle(contract.id, part.component.id, byId);
      if (cycle) {
        errors.push(
          `${contract.id}: part "${name}" component ref creates a cycle (${cycle.join(' → ')}) — a contract cannot compose itself`,
        );
      }
      for (const [propName, value] of Object.entries(part.component.props ?? {})) {
        if (dep && !dep.props.some((dp) => dp.name === propName)) {
          errors.push(`${contract.id}: part "${name}" sets unknown ${dep.id} prop "${propName}"`);
        }
        const depProp = dep?.props.find((dp) => dp.name === propName);
        if (depProp && isArrayType(depProp)) {
          errors.push(`${contract.id}: part "${name}" sets ${dep!.id} arrayOf prop "${propName}" — structured values cannot be fixed in anatomy`);
        }
        const parentRef = typeof value === 'string' ? value.match(/^\{([a-z][\w-]*)\}$/) : null;
        if (parentRef && !enumNames.has(parentRef[1])) {
          errors.push(
            `${contract.id}: part "${name}" maps "{${parentRef[1]}}" but no enum prop "${parentRef[1]}" exists on this contract`,
          );
        }
      }
      if (part.component.text !== undefined && dep && !hasChildrenText(dep)) {
        errors.push(`${contract.id}: part "${name}" sets text but ${dep.id} has no children text prop`);
      }
    }
    for (const item of part.slot?.defaultContent ?? []) {
      const dep = byId.get(item.id);
      if (!dep) {
        errors.push(`${contract.id}: slot "${part.slot!.name}" defaultContent references "${item.id}" which has no contract in scope`);
      }
      const cycle = findComponentCycle(contract.id, item.id, byId);
      if (cycle) {
        errors.push(
          `${contract.id}: slot "${part.slot!.name}" defaultContent "${item.id}" creates a cycle (${cycle.join(' → ')}) — a contract cannot compose itself`,
        );
      }
      if (item.text !== undefined && dep && !hasChildrenText(dep)) {
        errors.push(
          `${contract.id}: slot "${part.slot!.name}" defaultContent sets text but ${dep.id} has no children text prop`,
        );
      }
    }
    if (p[0] !== 'root' || p.length > 1) {
      // Nested parts support single-placeholder substitutions (v4) — emitted
      // as descendant rules under the root's enum class. Two placeholders on
      // one nested token stays unsupported.
      for (const ref of Object.values(part.tokens ?? {})) {
        const phs = placeholdersIn(stripBraces(ref));
        if (phs.length > 1) {
          errors.push(
            `${contract.id}: part "${name}" token "${ref}" uses ${phs.length} substitutions — nested parts support at most one`,
          );
        } else if (phs.length === 1 && !enumProps(contract).some((pr) => pr.name === phs[0])) {
          errors.push(
            `${contract.id}: part "${name}" token "${ref}" substitutes unknown enum prop "${phs[0]}"`,
          );
        }
      }
    }
    if (part.content) {
      const prop = contract.props.find(
        (pr) => pr.type === 'text' && pr.bindings.code.prop === part.content!.prop,
      );
      if (!prop) {
        errors.push(
          `${contract.id}: part "${name}" binds content to unknown text prop "${part.content.prop}"`,
        );
      }
    }
    // v7 layoutByProp: the driving prop must be a declared enum and every
    // map key one of its values; component parts lay themselves out via
    // their own contract, so an override there would be silently dead.
    if (part.layoutByProp) {
      const lbp = part.layoutByProp;
      const lbpProp = contract.props.find((pr) => pr.name === lbp.prop);
      if (!lbpProp) {
        errors.push(`${contract.id}: part "${name}" layoutByProp references unknown prop "${lbp.prop}"`);
      } else if (!isEnum(lbpProp)) {
        errors.push(`${contract.id}: part "${name}" layoutByProp prop "${lbp.prop}" must be an enum prop`);
      } else {
        for (const k of Object.keys(lbp.map)) {
          if (!lbpProp.type.enum.includes(k)) {
            errors.push(`${contract.id}: part "${name}" layoutByProp map key "${k}" is not a value of prop "${lbp.prop}"`);
          }
        }
      }
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — layoutByProp cannot restyle it (the child contract owns its layout)`);
      }
    }
    // v10 tokensByProp: the driving prop must be a declared enum, every map
    // key one of its values, and every mapped ref plain (per-value maps ARE
    // the substitution — a placeholder inside one is double substitution);
    // component parts style themselves via their own contract.
    if (part.tokensByProp) {
      const tbp = part.tokensByProp;
      const tbpProp = contract.props.find((pr) => pr.name === tbp.prop);
      if (!tbpProp) {
        errors.push(`${contract.id}: part "${name}" tokensByProp references unknown prop "${tbp.prop}"`);
      } else if (!isEnum(tbpProp)) {
        errors.push(`${contract.id}: part "${name}" tokensByProp prop "${tbp.prop}" must be an enum prop`);
      } else {
        for (const [k, overrides] of Object.entries(tbp.map)) {
          if (!tbpProp.type.enum.includes(k)) {
            errors.push(`${contract.id}: part "${name}" tokensByProp map key "${k}" is not a value of prop "${tbp.prop}"`);
          }
          for (const ref of Object.values(overrides)) {
            if (placeholdersIn(stripBraces(ref)).length > 0) {
              errors.push(
                `${contract.id}: part "${name}" tokensByProp ref "${ref}" carries a substitution placeholder — per-value maps hold plain refs only`,
              );
            }
          }
        }
      }
      if (part.component) {
        errors.push(`${contract.id}: part "${name}" is a component instance — tokensByProp cannot restyle it (the child contract owns its styling)`);
      }
    }
    // v7 overlay: out-of-flow parts must stay out of the flow arithmetic —
    // grow/overlap are in-flow sizing semantics, and the root cannot attach
    // to its own edge. Minimal, named refusals.
    if (part.overlay) {
      if (p[0] === 'root' && p.length === 1) {
        errors.push(`${contract.id}: the root part cannot be an overlay — overlays attach to the root`);
      }
      if (part.layout?.grow) {
        errors.push(`${contract.id}: part "${name}" is an overlay — it cannot also grow (grow is in-flow sizing)`);
      }
      if (part.layout?.overlap) {
        errors.push(`${contract.id}: part "${name}" is an overlay — it cannot also overlap children (in-flow semantics)`);
      }
    }
    // v7 stylesWhen: conditions must be checkable (boolean or enum+equals),
    // and the styles must stay inside the literal whitelist — colors and
    // dimensions belong in `tokens`, and a token ref here is refused by name.
    if (part.stylesWhen && part.component) {
      errors.push(`${contract.id}: part "${name}" is a component instance — stylesWhen cannot restyle it (the child contract owns its styling)`);
    }
    for (const sw of part.stylesWhen ?? []) {
      const swProp = contract.props.find((pr) => pr.name === sw.prop);
      if (!swProp) {
        errors.push(`${contract.id}: part "${name}" stylesWhen references unknown prop "${sw.prop}"`);
      } else if (isEnum(swProp)) {
        if (sw.equals === undefined) {
          errors.push(`${contract.id}: part "${name}" stylesWhen on enum prop "${sw.prop}" requires "equals"`);
        } else if (!swProp.type.enum.includes(sw.equals)) {
          errors.push(`${contract.id}: part "${name}" stylesWhen.equals "${sw.equals}" is not a value of prop "${sw.prop}"`);
        }
      } else if (swProp.type === 'boolean') {
        if (sw.equals !== undefined) {
          errors.push(`${contract.id}: part "${name}" stylesWhen on boolean prop "${sw.prop}" must omit "equals"`);
        }
      } else {
        errors.push(`${contract.id}: part "${name}" stylesWhen prop "${sw.prop}" must be a boolean or enum prop`);
      }
      for (const [cssProp, value] of Object.entries(sw.styles)) {
        if (!STYLES_WHEN_ALLOWED.has(cssProp)) {
          errors.push(`${contract.id}: part "${name}" stylesWhen sets "${cssProp}" which is not in the literal whitelist (${[...STYLES_WHEN_ALLOWED].join(', ')})`);
        }
        if (value.includes('{')) {
          errors.push(`${contract.id}: part "${name}" stylesWhen "${cssProp}" value ${JSON.stringify(value)} looks like a token reference — stylesWhen is literal CSS; token-driven styling belongs in "tokens"`);
        }
      }
    }
    // v9 shape: a parametric leaf decor — anything that would give it
    // children or content contradicts the leaf-ness and is refused by name.
    if (part.shape) {
      for (const [field, present] of Object.entries({
        parts: part.parts, slot: part.slot, component: part.component,
        content: part.content, text: part.text, icon: part.icon, meter: part.meter,
      })) {
        if (present !== undefined) {
          errors.push(`${contract.id}: part "${name}" is a shape (leaf decor) — it cannot also carry "${field}"`);
        }
      }
      if (part.shape.sides !== undefined && part.shape.kind !== 'polygon') {
        errors.push(`${contract.id}: part "${name}" shape kind "${part.shape.kind}" cannot declare sides — side count is polygon vocabulary`);
      }
    }
    // v12 repeat (P9): the item template must be mechanically renderable on
    // every surface — a component-ref template, an arrayOf prop to map, and
    // fields that map BY NAME onto the child contract's props with matching
    // scalar types. Everything else refuses by name.
    if (part.repeat) {
      if (!part.component) {
        errors.push(`${contract.id}: part "${name}" declares repeat but no component — the item template is a component ref (v12; text/frame templates have no vocabulary)`);
      }
      for (const [field, present] of Object.entries({
        slot: part.slot, content: part.content, text: part.text,
        meter: part.meter, icon: part.icon, shape: part.shape, parts: part.parts,
      })) {
        if (present !== undefined) {
          errors.push(`${contract.id}: part "${name}" is a repeat template — it cannot also carry "${field}"`);
        }
      }
      const rp = contract.props.find((pr) => pr.name === part.repeat!.itemsProp);
      if (!rp) {
        errors.push(`${contract.id}: part "${name}" repeat references unknown prop "${part.repeat.itemsProp}"`);
      } else if (!isArrayType(rp)) {
        errors.push(`${contract.id}: part "${name}" repeat prop "${part.repeat.itemsProp}" must be an arrayOf prop`);
      } else {
        const dep = part.component ? byId.get(part.component.id) : undefined;
        const FIELD_TO_PROP: Record<string, string> = { text: 'text', boolean: 'boolean', number: 'number' };
        for (const [field, ftype] of Object.entries(rp.type.arrayOf)) {
          if (part.component?.props && field in part.component.props) {
            errors.push(`${contract.id}: part "${name}" repeat field "${field}" collides with a fixed component prop — a field is per-item, a fixed prop is constant`);
          }
          if (!dep) continue; // missing child contract already refused above
          const depProp = dep.props.find((dp) => dp.name === field);
          if (!depProp) {
            errors.push(`${contract.id}: part "${name}" repeat field "${field}" names no ${dep.id} prop`);
          } else if (depProp.type !== FIELD_TO_PROP[ftype]) {
            errors.push(
              `${contract.id}: part "${name}" repeat field "${field}" (${ftype}) does not match ${dep.id} prop "${field}" (${typeof depProp.type === 'object' ? JSON.stringify(depProp.type) : depProp.type}) — per-item enum differences are P10 and stay receipted`,
            );
          }
        }
        for (const [i, rec] of part.repeat.sample.entries()) {
          for (const [key, value] of Object.entries(rec)) {
            const ftype = rp.type.arrayOf[key];
            if (ftype === undefined) {
              errors.push(`${contract.id}: part "${name}" repeat sample[${i}] key "${key}" is not a field of "${part.repeat.itemsProp}"`);
            } else if ((ftype === 'boolean') !== (typeof value === 'boolean') || (ftype === 'number') !== (typeof value === 'number')) {
              errors.push(`${contract.id}: part "${name}" repeat sample[${i}].${key} is a ${typeof value} but the field is ${ftype}`);
            }
          }
        }
      }
    }
    if (part.visibleWhen) {
      const vwProp = contract.props.find((pr) => pr.name === part.visibleWhen!.prop);
      if (!vwProp) {
        errors.push(`${contract.id}: part "${name}" visibleWhen references unknown prop "${part.visibleWhen.prop}"`);
      } else if (part.visibleWhen.equals !== undefined && !(typeof vwProp.type === 'object' && 'enum' in vwProp.type && vwProp.type.enum.includes(part.visibleWhen.equals))) {
        errors.push(`${contract.id}: part "${name}" visibleWhen.equals "${part.visibleWhen.equals}" is not a value of prop "${part.visibleWhen.prop}"`);
      }
    }
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const assets = ref
        ? (() => {
            const p = contract.props.find((pr) => pr.name === ref[1]);
            return p && typeof p.type === 'object' && 'enum' in p.type ? p.type.enum : [];
          })()
        : [part.icon.asset];
      for (const asset of assets) {
        if (!iconAssets.has(asset)) {
          errors.push(`${contract.id}: part "${name}" needs icon asset "assets/icons/${asset}.svg" which does not exist`);
        }
      }
    }
    for (const value of Object.values(part.attrs ?? {})) {
      const ref = value.match(/^\{([a-z][\w-]*)\}$/);
      if (ref && !contract.props.some((pr) => pr.name === ref[1])) {
        errors.push(`${contract.id}: part "${name}" attrs references unknown prop "${ref[1]}"`);
      }
    }
  }
  if (!contract.anatomy.root) errors.push(`${contract.id}: anatomy must have a "root" part`);

  // Identity + consistency gates (added after an adversarial refusal sweep
  // found these invalid states passing silently — C2 means NAMED refusal).
  if (!/^[A-Z][A-Za-z0-9]*$/.test(contract.name)) {
    errors.push(`${contract.id}: contract name "${contract.name}" must be PascalCase — it becomes the exported component and its file names`);
  }
  const seenPropNames = new Set<string>();
  const seenFigmaProps = new Set<string>();
  // Duplicate CODE bindings are the classic git-auto-merge artifact: two
  // branches each add a prop, the JSON merges cleanly, Zod accepts it, and
  // the generator would emit a duplicate interface member + duplicate
  // destructuring binding — syntactically broken output with exit 0
  // (red-team finding). Slot names and event props share the same code
  // namespace, so the uniqueness gate covers all three.
  const seenCodeNames = new Set<string>(
    walkAnatomy(contract).filter((w) => w.part.slot).map((w) => w.part.slot!.name),
  );
  for (const p of contract.props) {
    if (seenPropNames.has(p.name)) {
      errors.push(`${contract.id}: duplicate prop name "${p.name}"`);
    }
    seenPropNames.add(p.name);
    const codeName = p.bindings.code.prop;
    if (codeName !== 'children' && seenCodeNames.has(codeName)) {
      errors.push(`${contract.id}: duplicate code binding "${codeName}" — two props/slots/events share one code name (check for a bad merge)`);
    }
    seenCodeNames.add(codeName);
    if (!/^[a-z][A-Za-z0-9]*$/.test(p.bindings.code.prop)) {
      errors.push(`${contract.id}: prop "${p.name}" code binding "${p.bindings.code.prop}" is not a legal camelCase identifier`);
    }
    const figProp = p.bindings.figma.property;
    if (figProp !== undefined) {
      if (seenFigmaProps.has(figProp)) {
        errors.push(`${contract.id}: two props bind the same design property "${figProp}" — the canvas cannot host both`);
      }
      seenFigmaProps.add(figProp);
    }
    // type/default consistency
    if (p.default !== undefined) {
      if (isEnum(p) && (typeof p.default !== 'string' || !p.type.enum.includes(p.default))) {
        errors.push(`${contract.id}: prop "${p.name}" default ${JSON.stringify(p.default)} is not one of its enum values [${p.type.enum.join(', ')}]`);
      }
      if (p.type === 'boolean' && typeof p.default !== 'boolean') {
        errors.push(`${contract.id}: boolean prop "${p.name}" default must be a boolean (got ${JSON.stringify(p.default)})`);
      }
      if (p.type === 'number' && typeof p.default !== 'number') {
        errors.push(`${contract.id}: number prop "${p.name}" default must be a number (got ${JSON.stringify(p.default)})`);
      }
      if (p.type === 'text' && typeof p.default !== 'string') {
        errors.push(`${contract.id}: text prop "${p.name}" default must be a string (got ${JSON.stringify(p.default)})`);
      }
    }
    // v7 arrayOf: structured props are code-only — the pairing with figma
    // kind "NONE" is enforced BOTH ways so a scalar prop can never silently
    // vanish from the canvas and a structured prop can never pretend to
    // manifest there.
    if (isArrayType(p)) {
      if (p.bindings.figma.kind !== 'NONE') {
        errors.push(`${contract.id}: arrayOf prop "${p.name}" must bind figma kind "NONE" — structured props are code-only by declared fidelity limit`);
      }
      if (p.default !== undefined) {
        errors.push(`${contract.id}: arrayOf prop "${p.name}" cannot declare a default — it renders as an optional array in code`);
      }
      if (Object.keys(p.type.arrayOf).length === 0) {
        errors.push(`${contract.id}: arrayOf prop "${p.name}" must declare at least one field`);
      }
    } else if (p.bindings.figma.kind === 'NONE') {
      errors.push(`${contract.id}: prop "${p.name}" binds figma kind "NONE" but is not an arrayOf prop — every scalar prop has a canvas manifestation`);
    }
    // Required text props need a default: it is the canvas TEXT property's
    // default value AND the sample every generated story/matrix cell uses.
    if (p.type === 'text' && p.required && typeof p.default !== 'string') {
      errors.push(`${contract.id}: required text prop "${p.name}" must declare a string default (canvas default + story sample)`);
    }
    // The figma values map, when present, must cover the enum exactly.
    if (isEnum(p) && p.bindings.figma.values) {
      const mapKeys = Object.keys(p.bindings.figma.values);
      for (const v of p.type.enum) {
        if (!mapKeys.includes(v)) {
          errors.push(`${contract.id}: prop "${p.name}" figma values map is missing enum value "${v}"`);
        }
      }
      for (const k of mapKeys) {
        if (!p.type.enum.includes(k)) {
          errors.push(`${contract.id}: prop "${p.name}" figma values map has key "${k}" which is not an enum value`);
        }
      }
    }
  }
  // Token refs must be well-formed {path} or {path.{prop}.path} shapes —
  // a malformed ref must be refused by NAME, not crash downstream.
  const TOKEN_REF = /^\{[^{}]*(\{[a-z][\w-]*\}[^{}]*)*\}$/;
  for (const { name, part } of walkAnatomy(contract)) {
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      if (!TOKEN_REF.test(ref) || ref === '{}') {
        errors.push(`${contract.id}: part "${name}" token "${cssProp}" ref ${JSON.stringify(ref)} is malformed — expected "{token.path}" with optional "{prop}" placeholders`);
      }
    }
  }

  // v6 events: the declared interaction surface must be mechanically checkable.
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part]));
  const seenEventProps = new Set<string>();
  for (const ev of contract.events ?? []) {
    const codeProp = ev.bindings.code.prop;
    if (seenEventProps.has(codeProp)) {
      errors.push(`${contract.id}: duplicate event code prop "${codeProp}"`);
    }
    seenEventProps.add(codeProp);
    if (contract.props.some((p) => p.bindings.code.prop === codeProp) || walkAnatomy(contract).some((w) => w.part.slot?.name === codeProp)) {
      errors.push(`${contract.id}: event "${ev.name}" code prop "${codeProp}" collides with a data prop or slot`);
    }
    const trigger = partByName.get(ev.trigger);
    if (!trigger) {
      errors.push(`${contract.id}: event "${ev.name}" trigger references unknown part "${ev.trigger}"`);
    } else if (ev.trigger !== 'root' && trigger.element !== 'button' && !isNativeCheckablePart(trigger)) {
      // Interactivity must be honest: a clickable part is a <button> — or a
      // native checkable input (input[type=checkbox|radio]) — so keyboard
      // activation comes from the platform, not a bolted-on handler.
      errors.push(
        `${contract.id}: event "${ev.name}" trigger part "${ev.trigger}" must have element "button" or be a native checkable input (input[type=checkbox|radio]) (got "${trigger.element ?? 'div'}")`,
      );
    }
    if (ev.toggles) {
      const prop = contract.props.find((p) => p.name === ev.toggles!.prop);
      if (!prop) {
        errors.push(`${contract.id}: event "${ev.name}" toggles unknown prop "${ev.toggles.prop}"`);
      } else if (!(typeof prop.type === 'object' && 'enum' in prop.type)) {
        errors.push(`${contract.id}: event "${ev.name}" toggles non-enum prop "${ev.toggles.prop}"`);
      } else {
        for (const v of ev.toggles.between) {
          if (!prop.type.enum.includes(v)) {
            errors.push(
              `${contract.id}: event "${ev.name}" toggles between "${v}" which is not a value of "${ev.toggles.prop}"`,
            );
          }
        }
      }
    }
  }

  // figmaStatePreviews (v8): canvas-only state previews must be honest —
  // a preview variant that renders identically to Default is kit noise, so
  // the opt-in is refused by name unless every declared state carries root
  // token overrides; and the multiplied axis must be unambiguous.
  if (contract.figmaStatePreviews) {
    if (contract.figmaRepresentation === 'native') {
      errors.push(
        `${contract.id}: figmaStatePreviews requires a generated Figma component — figmaRepresentation "native" declares there is none`,
      );
    }
    if (contract.states.length === 0) {
      errors.push(
        `${contract.id}: figmaStatePreviews is set but the contract declares no interaction states — nothing to preview`,
      );
    }
    const rootStates = contract.anatomy.root?.states ?? {};
    for (const state of contract.states) {
      if (Object.keys(rootStates[state] ?? {}).length === 0) {
        errors.push(
          `${contract.id}: figmaStatePreviews — state "${state}" declares no token overrides on anatomy.root.states, so its preview variant would render identically to Default`,
        );
      }
    }
    const substProps = statePreviewSubstProps(contract);
    if (substProps.length > 1) {
      errors.push(
        `${contract.id}: figmaStatePreviews — state overrides substitute ${substProps.length} enum props (${substProps.join(', ')}); previews multiply exactly ONE primary axis`,
      );
    }
    if (contract.props.some((p) => p.bindings.figma.property === STATE_PREVIEW_PROPERTY)) {
      errors.push(
        `${contract.id}: figmaStatePreviews reserves the design property "${STATE_PREVIEW_PROPERTY}" for the preview axis, but a prop already binds it`,
      );
    }
  }

  // v7 elementByProp: the dynamic-tag lookup must be total and honest —
  // the prop must be a declared enum, the map must cover every value, and
  // every mapped element must be in the generator's element vocabulary
  // (an unknown element would emit JSX that silently isn't HTML).
  const ebp = contract.semantics.elementByProp;
  if (ebp) {
    const prop = contract.props.find((p) => p.name === ebp.prop);
    if (!prop) {
      errors.push(`${contract.id}: semantics.elementByProp references unknown prop "${ebp.prop}"`);
    } else if (!isEnum(prop)) {
      errors.push(`${contract.id}: semantics.elementByProp prop "${ebp.prop}" must be an enum prop`);
    } else {
      for (const v of prop.type.enum) {
        if (!(v in ebp.map)) {
          errors.push(`${contract.id}: semantics.elementByProp map is missing enum value "${v}"`);
        }
      }
      for (const [k, el] of Object.entries(ebp.map)) {
        if (!prop.type.enum.includes(k)) {
          errors.push(`${contract.id}: semantics.elementByProp map key "${k}" is not a value of prop "${ebp.prop}"`);
        }
        if (!(el in ELEMENT_META)) {
          errors.push(`${contract.id}: semantics.elementByProp maps "${k}" to unknown element "${el}" — must be one of the element vocabulary`);
        }
      }
    }
  }

  // v11 SEMANTIC LINT: a role claim that RE-CREATES a native control (see
  // NATIVE_ROLE_HOSTS) refuses BY NAME on a non-native element — unless the
  // contract declares the exception, whose one-sentence reason renders on
  // the spec sheet. This gate exists because a shipped catalog contract
  // (ds.checkbox v1.1.0) emitted <button role="checkbox"> where a native
  // <input type="checkbox"> belongs; the mistake must be impossible to
  // reintroduce silently. Every surface enforces it: react/html/react-inline
  // /figma-script all call validateContract, as do the census and the
  // playground referee.
  {
    /** True when the claim is a violation the exception would cover. */
    const violates = (role: string | undefined, element: string): boolean => {
      if (!role) return false;
      const entry = NATIVE_ROLE_HOSTS[role];
      return Boolean(entry && !entry.hosts.includes(element));
    };
    const declared = (exception: string | undefined) =>
      typeof exception === 'string' && exception.trim().length > 0;
    const refuse = (role: string, element: string, site: string, field: string) => {
      const entry = NATIVE_ROLE_HOSTS[role]!;
      errors.push(
        `${contract.id}: ${site} claims role "${role}" on element "${element}" — native ${entry.native} exists; use it or declare the exception (${field}: "<one-sentence reason>")`,
      );
    };

    // Root-level claims: semantics.role, roleByProp values, and the root
    // part's attrs.role — all covered by semantics.roleException.
    const rootEl = contract.semantics.element;
    const rootClaims: Array<{ role: string; site: string }> = [];
    if (violates(contract.semantics.role, rootEl)) {
      rootClaims.push({ role: contract.semantics.role!, site: 'semantics.role' });
    }
    for (const [k, role] of Object.entries(contract.semantics.roleByProp?.map ?? {})) {
      if (violates(role, rootEl)) rootClaims.push({ role, site: `semantics.roleByProp["${k}"]` });
    }
    const rootAttrsRole = contract.anatomy.root?.attrs?.role;
    if (violates(rootAttrsRole, rootEl)) {
      rootClaims.push({ role: rootAttrsRole!, site: 'anatomy.root attrs.role' });
    }
    if (!declared(contract.semantics.roleException)) {
      for (const c of rootClaims) refuse(c.role, rootEl, c.site, 'semantics.roleException');
    } else if (rootClaims.length === 0) {
      errors.push(
        `${contract.id}: semantics.roleException is declared but no root-level role claim needs it — exceptions never ride along silently`,
      );
    }

    // Part-level claims: attrs.role on non-root parts, covered by the
    // part's own roleException. Element default mirrors the emitters:
    // span for content/text leaves, div otherwise.
    for (const { name, part, path: p } of walkAnatomy(contract)) {
      if (p[0] === 'root' && p.length === 1) continue;
      const el = part.element ?? (part.content || part.text !== undefined ? 'span' : 'div');
      const partRole = part.attrs?.role;
      const isViolation = violates(partRole, el);
      if (isViolation && !declared(part.roleException)) {
        refuse(partRole!, el, `part "${name}"`, `roleException`);
      } else if (!isViolation && declared(part.roleException)) {
        errors.push(
          `${contract.id}: part "${name}" declares roleException but claims no role that needs it — exceptions never ride along silently`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/** v7 stylesWhen rules for one part. Boolean conditions select on the
 *  root's existing per-boolean data attribute (native disabled uses
 *  :disabled); enum conditions select on the root's enum class. */
function stylesWhenRules(contract: Contract, partName: string, part: Part, isRootPart: boolean): string[] {
  const rules: string[] = [];
  for (const sw of part.stylesWhen ?? []) {
    const prop = contract.props.find((pr) => pr.name === sw.prop);
    if (!prop) continue; // refused by validateContract
    let base: string;
    if (isEnum(prop)) {
      base = `.${sw.prop}-${sw.equals}`;
    } else {
      const nativeDisabled =
        prop.name === 'disabled' && ELEMENT_META[contract.semantics.element]?.supportsDisabled;
      const dataName = prop.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      base = nativeDisabled ? '.root:disabled' : `.root[data-${dataName}]`;
    }
    const selector = isRootPart ? base : `${base} .${partName}`;
    const decls = Object.entries(sw.styles)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    rules.push(`\n${selector} {\n${decls}\n}`);
  }
  return rules;
}

export function generateCss(contract: Contract, tokenInventory: Set<string>, errors: string[]): string {
  const enums = new Map(enumProps(contract).map((p) => [p.name, p.type.enum]));
  const lines: string[] = [
    `/* GENERATED FILE — DO NOT EDIT.`,
    ` * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})`,
    ` * Regenerate with: npm run generate`,
    ` */`,
  ];

  const checkToken = (tokenPath: string, context: string): boolean => {
    if (!tokenInventory.has(tokenPath)) {
      errors.push(
        `${contract.id}: ${context} references token "{${tokenPath}}" which does not exist in tokens/`,
      );
      return false;
    }
    return true;
  };

  // Root: static/layout base + non-substituted tokens, then enum classes,
  // then state rules — same model as v1, layout now contract-governed.
  const root = contract.anatomy.root;
  const rootDecls: string[] = [];
  if (root.layout) {
    rootDecls.push(`display: ${root.layout.display ?? 'flex'}`);
    if (root.layout.direction) rootDecls.push(`flex-direction: ${root.layout.direction}`);
    if (root.layout.align) rootDecls.push(`align-items: ${ALIGN_CSS[root.layout.align]}`);
    if (root.layout.justify) rootDecls.push(`justify-content: ${JUSTIFY_CSS[root.layout.justify]}`);
  } else {
    rootDecls.push('display: inline-flex', 'align-items: center', 'justify-content: center');
  }
  const rootTokens = root.tokens ?? {};
  // UA-margin neutralization: see UA_MARGIN_ELEMENTS.
  if (rootElementsOf(contract).some((el) => UA_MARGIN_ELEMENTS.has(el))) {
    rootDecls.push('margin: 0');
  }
  const hasBorder = 'border-width' in rootTokens || 'border-color' in rootTokens;
  if (hasBorder) rootDecls.push('border-style: solid');
  else rootDecls.push('border: 0');
  // Fluid components: a max-width binding means "fill available space up to
  // the token" — components are never rigid (fixed `width` is reserved for
  // genuinely fixed shapes like Avatar). min-width: fit-content keeps the
  // component from collapsing below its content's floor (e.g. table cells'
  // min-widths); containers narrower than that should scroll.
  if ('max-width' in rootTokens) rootDecls.push('width: 100%', 'min-width: fit-content');
  if (contract.semantics.element === 'button') rootDecls.push('cursor: pointer');
  // v7 overlay / v9 shape placement: any out-of-flow part (an overlay, or a
  // part whose stylesWhen carries position: absolute — the shape-placement
  // spelling) positions against the root.
  if (
    walkAnatomy(contract).some(
      (w) => w.part.overlay || (w.part.stylesWhen ?? []).some((sw) => sw.styles['position'] === 'absolute'),
    )
  ) {
    rootDecls.push('position: relative');
  }

  const enumRules = new Map<string, Map<string, string>>(); // class → decls
  const stateRules: string[] = [];
  const rootSubRules: string[] = [];

  for (const [cssProp, ref] of Object.entries(rootTokens)) {
    const refPath = stripBraces(ref);
    // overlap on the ROOT (P21, proposed avatar-group shape): the gap token
    // becomes a negative child margin (CSS gap cannot be negative); the
    // canvas side uses negative itemSpacing — same projection as nested
    // parts below, single-placeholder refs expand per enum class.
    if (cssProp === 'gap' && root.layout?.overlap) {
      const phs = placeholdersIn(refPath);
      if (phs.length === 1) {
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          if (!checkToken(resolved, 'anatomy.root.tokens.gap')) continue;
          rootSubRules.push(`\n.${phs[0]}-${value} > * + * {\n  margin-left: ${cssVar(resolved)};\n}`);
        }
      } else if (checkToken(refPath, 'anatomy.root.tokens.gap')) {
        rootSubRules.push(`\n.root > * + * {\n  margin-left: ${cssVar(refPath)};\n}`);
      }
      continue;
    }
    const phs = placeholdersIn(refPath);
    if (phs.length === 0) {
      if (checkToken(refPath, `anatomy.root.tokens.${cssProp}`)) {
        rootDecls.push(`${cssProp}: ${cssVar(refPath)}`);
      }
    } else if (phs.length === 1) {
      const values = enums.get(phs[0]);
      if (!values) {
        errors.push(`${contract.id}: root token "${cssProp}" substitutes unknown enum prop "${phs[0]}"`);
        continue;
      }
      for (const value of values) {
        const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
        if (!checkToken(resolved, `anatomy.root.tokens.${cssProp}`)) continue;
        const cls = `${phs[0]}-${value}`;
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(cssProp, cssVar(resolved));
      }
    } else if (phs.length === 2) {
      // Two-axis root token (e.g. a minted background = f(variant, state)):
      // one compound-class rule per value combination. The compound selector
      // (.variant-primary.state-hover) outranks the single enum classes, so
      // a pair binding wins over any single-axis binding of the same
      // property — deterministic, and both classes always ride the root.
      const [pa, pb] = phs;
      const va = enums.get(pa);
      const vb = enums.get(pb);
      if (!va || !vb) {
        errors.push(
          `${contract.id}: root token "${cssProp}" substitutes unknown enum prop "${!va ? pa : pb}"`,
        );
        continue;
      }
      for (const a of va) {
        for (const b of vb) {
          const resolved = refPath.replaceAll(`{${pa}}`, a).replaceAll(`{${pb}}`, b);
          if (!checkToken(resolved, `anatomy.root.tokens.${cssProp}`)) continue;
          // Both single classes must EXIST in the module (the TSX composes
          // styles[`prop-value`]; an unemitted class is undefined and the
          // compound selector would never match) — claim them, empty is fine.
          for (const single of [`${pa}-${a}`, `${pb}-${b}`]) {
            if (!enumRules.has(single)) enumRules.set(single, new Map());
          }
          const cls = `${pa}-${a}.${pb}-${b}`;
          if (!enumRules.has(cls)) enumRules.set(cls, new Map());
          enumRules.get(cls)!.set(cssProp, cssVar(resolved));
        }
      }
    } else {
      errors.push(`${contract.id}: root token "${cssProp}" uses ${phs.length} substitutions (max 2)`);
    }
  }

  // v10 tokensByProp on the root: per-enum-value overrides land in the SAME
  // enum-class rules substituted refs use — emitted after .root, so the
  // override wins at equal specificity (the layoutByProp discipline).
  if (root.tokensByProp) {
    const { prop: tbpProp, map } = root.tokensByProp;
    for (const [value, overrides] of Object.entries(map)) {
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        if (!checkToken(refPath, `anatomy.root.tokensByProp.${value}.${cssProp}`)) continue;
        const cls = `${tbpProp}-${value}`;
        if (!enumRules.has(cls)) enumRules.set(cls, new Map());
        enumRules.get(cls)!.set(cssProp, cssVar(refPath));
      }
    }
  }

  // a11y.minHitArea: the declared floor is ENFORCED, not aspirational — the
  // standard non-visual hit-target extension (an absolutely centered ::before
  // at max(100%, floor) per axis; it paints nothing and never affects layout,
  // but pointer events on it hit the component). Field failure: Button
  // declared 44 while the small size rendered a 36px-tall target and nothing
  // enforced the difference.
  const minHitArea = contract.a11y?.minHitArea;
  if (typeof minHitArea === 'number' && !rootDecls.includes('position: relative')) {
    rootDecls.push('position: relative');
  }

  lines.push('', '.root {');
  for (const d of rootDecls) lines.push(`  ${d};`);
  lines.push('}');
  lines.push(...rootSubRules);

  if (typeof minHitArea === 'number') {
    lines.push(
      '',
      '/* a11y.minHitArea: non-visual hit-target floor — see contract */',
      '.root::before {',
      "  content: '';",
      '  position: absolute;',
      '  left: 50%;',
      '  top: 50%;',
      `  width: max(100%, ${minHitArea}px);`,
      `  height: max(100%, ${minHitArea}px);`,
      '  transform: translate(-50%, -50%);',
      '}',
    );
  }

  if (contract.states.includes('focus-visible')) {
    lines.push('', '.root:focus-visible {', '  outline-style: solid;', '  outline-offset: 2px;', '}');
  }
  if (contract.states.includes('disabled') && contract.semantics.element === 'button') {
    lines.push('', '.root:disabled {', '  cursor: not-allowed;', '}');
  }

  for (const [cls, decls] of enumRules) {
    lines.push('', `.${cls} {`);
    for (const [prop, value] of decls) lines.push(`  ${prop}: ${value};`);
    lines.push('}');
  }

  // v7 layoutByProp on the root: the enum class sits on the root element
  // itself, so the override rule targets it directly (emitted after .root
  // so the override wins at equal specificity).
  if (root.layoutByProp) {
    for (const [value, override] of Object.entries(root.layoutByProp.map)) {
      const decls = layoutOverrideDecls(override);
      if (decls.length === 0) continue;
      lines.push('', `.${root.layoutByProp.prop}-${value} {`);
      for (const d of decls) lines.push(`  ${d};`);
      lines.push('}');
    }
  }

  for (const [state, decls] of Object.entries(root.states ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) {
      errors.push(`${contract.id}: unknown state "${state}"`);
      continue;
    }
    for (const [cssProp, ref] of Object.entries(decls)) {
      const refPath = stripBraces(ref);
      const phs = placeholdersIn(refPath);
      if (phs.length === 0) {
        if (checkToken(refPath, `anatomy.root.states.${state}.${cssProp}`)) {
          stateRules.push(`\n.root${sel} {\n  ${cssProp}: ${cssVar(refPath)};\n}`);
        }
      } else if (phs.length === 1) {
        const values = enums.get(phs[0]) ?? [];
        for (const value of values) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          if (!checkToken(resolved, `anatomy.root.states.${state}.${cssProp}`)) continue;
          stateRules.push(`\n.${phs[0]}-${value}${sel} {\n  ${cssProp}: ${cssVar(resolved)};\n}`);
        }
      }
    }
  }
  lines.push(...stateRules);
  // v7 stylesWhen on the root part (emitted last so the condition wins).
  lines.push(...stylesWhenRules(contract, 'root', root, true));

  const usedAnimations = new Set<string>();
  // Nested parts (no substitutions; validated above).
  for (const { name, part, path: p } of walkAnatomy(contract)) {
    if (p[0] === 'root' && p.length === 1) continue;
    if (part.component) continue; // instances style themselves via their own contract
    const decls: string[] = [];
    if (isStructural(part)) {
      decls.push(`display: ${part.layout?.display ?? 'flex'}`);
      if (part.layout?.direction) decls.push(`flex-direction: ${part.layout.direction}`);
      if (part.layout?.align) decls.push(`align-items: ${ALIGN_CSS[part.layout.align]}`);
      if (part.layout?.justify) decls.push(`justify-content: ${JUSTIFY_CSS[part.layout.justify]}`);
    }
    if (part.layout?.grow) decls.push('flex: 1 1 auto', 'min-width: 0');
    // v7 overlay: out of flow, attached to the root's edge.
    if (part.overlay) decls.push('position: absolute', ...OVERLAY_CSS[part.overlay.placement]);
    // v9 shape: parametric leaf decor — the ONE shared projection
    // (scripts/contract-schema.ts shapeCssDecls); placement/rotation-per-
    // variant ride stylesWhen rules below.
    if (part.shape) decls.push(...shapeCssDecls(part.shape));
    // Event-trigger buttons: neutralize UA button styles BEFORE token decls
    // so the contract's tokens (padding, background, font) win.
    if (part.element === 'button' && (contract.events ?? []).some((e) => e.trigger === name)) {
      decls.push(
        'appearance: none',
        'background: none',
        'border: none',
        'margin: 0',
        'padding: 0',
        'font: inherit',
        'color: inherit',
        'text-align: inherit',
        'cursor: pointer',
      );
    }
    // Native checkable inputs (input[type=checkbox|radio]): the REAL control
    // covers its presentational box invisibly — it stays the focusable,
    // checkable element while the box and glyphs draw the visual.
    if (isNativeCheckablePart(part)) {
      decls.push(
        'position: absolute',
        'inset: 0',
        'width: 100%',
        'height: 100%',
        'margin: 0',
        'padding: 0',
        'opacity: 0',
        'cursor: pointer',
      );
    }
    if (part.icon) {
      decls.push('display: inline-flex', 'flex-shrink: 0');
      if (part.icon.size) {
        lines.push('', `.${name} svg {`, `  width: ${part.icon.size}px;`, `  height: ${part.icon.size}px;`, '}');
      }
      if (part.element === 'button') {
        decls.push(
          'align-items: center',
          'justify-content: center',
          'background: none',
          'border: none',
          'padding: 0',
          'color: inherit',
          'cursor: pointer',
        );
      }
    }
    const nestedSubRules: string[] = [];
    if (part.animation) {
      decls.push(
        part.animation === 'spin'
          ? 'animation: ds-spin 0.8s linear infinite'
          : 'animation: ds-pulse 1.6s ease-in-out infinite',
      );
      usedAnimations.add(part.animation);
    }
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      const refPath = stripBraces(ref);
      // overlap: the gap token becomes a negative child margin (CSS gap
      // cannot be negative); the canvas side uses negative itemSpacing.
      // Single-placeholder refs expand per enum class (P21 minted per-axis
      // magnitudes), the nested-token-substitution rule shape.
      if (cssProp === 'gap' && part.layout?.overlap) {
        const overlapPhs = placeholdersIn(refPath);
        if (overlapPhs.length === 1) {
          for (const value of enums.get(overlapPhs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${overlapPhs[0]}}`, value);
            if (!checkToken(resolved, `anatomy.${name}.tokens.gap`)) continue;
            nestedSubRules.push(`\n.${overlapPhs[0]}-${value} .${name} > * + * {\n  margin-left: ${cssVar(resolved)};\n}`);
          }
        } else if (checkToken(refPath, `anatomy.${name}.tokens.gap`)) {
          nestedSubRules.push(`\n.${name} > * + * {\n  margin-left: ${cssVar(refPath)};\n}`);
        }
        continue;
      }
      const phs = placeholdersIn(refPath);
      if (phs.length === 1) {
        // Per-enum-value descendant rule under the root's variant class.
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          if (!checkToken(resolved, `anatomy.${name}.tokens.${cssProp}`)) continue;
          nestedSubRules.push(`\n.${phs[0]}-${value} .${name} {\n  ${cssProp}: ${cssVar(resolved)};\n}`);
        }
        continue;
      }
      if (checkToken(refPath, `anatomy.${name}.tokens.${cssProp}`)) {
        decls.push(`${cssProp}: ${cssVar(refPath)}`);
      }
    }
    if ((part.tokens && ('border-width' in part.tokens || 'border-color' in part.tokens))) {
      decls.push('border-style: solid');
    }
    // v10 tokensByProp on a nested part: descendant rule under the root's
    // enum class — exactly the nested-token-substitution rule shape.
    if (part.tokensByProp) {
      for (const [value, overrides] of Object.entries(part.tokensByProp.map)) {
        for (const [cssProp, ref] of Object.entries(overrides)) {
          const refPath = stripBraces(ref);
          if (!checkToken(refPath, `anatomy.${name}.tokensByProp.${value}.${cssProp}`)) continue;
          nestedSubRules.push(
            `\n.${part.tokensByProp.prop}-${value} .${name} {\n  ${cssProp}: ${cssVar(refPath)};\n}`,
          );
        }
      }
    }
    // v7 layoutByProp on a nested part: descendant rule under the root's
    // enum class — exactly the nested-token-substitution rule shape.
    if (part.layoutByProp) {
      for (const [value, override] of Object.entries(part.layoutByProp.map)) {
        const lDecls = layoutOverrideDecls(override);
        if (lDecls.length === 0) continue;
        nestedSubRules.push(
          `\n.${part.layoutByProp.prop}-${value} .${name} {\n${lDecls.map((d) => `  ${d};`).join('\n')}\n}`,
        );
      }
    }
    // A box holding a visually-managed native input anchors it and carries
    // the focus ring (the input is opacity:0, so its own outline is
    // invisible; :has lifts :focus-visible onto the visible box — the same
    // outline idiom as .root:focus-visible).
    for (const [childName, child] of Object.entries(part.parts ?? {})) {
      if (!isNativeCheckablePart(child)) continue;
      decls.push('position: relative');
      nestedSubRules.push(
        `\n.${name}:has(> .${childName}:focus-visible) {\n  outline-style: solid;\n  outline-offset: 2px;\n}`,
      );
    }
    // v7 stylesWhen on a nested part.
    nestedSubRules.push(...stylesWhenRules(contract, name, part, false));
    if (decls.length === 0 && nestedSubRules.length === 0) continue;
    if (decls.length > 0) {
      lines.push('', `.${name} {`);
      for (const d of decls) lines.push(`  ${d};`);
      lines.push('}');
    }
    lines.push(...nestedSubRules);
    if (part.icon && part.element) {
      lines.push('', `.${name}Glyph {`, '  display: inline-flex;', '}');
    }
  }

  if (usedAnimations.has('spin')) {
    lines.push('', '@keyframes ds-spin {', '  to { transform: rotate(360deg); }', '}');
  }
  if (usedAnimations.has('pulse')) {
    lines.push('', '@keyframes ds-pulse {', '  0%, 100% { opacity: 1; }', '  50% { opacity: 0.45; }', '}');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Component (.tsx) generation
// ---------------------------------------------------------------------------

export const ELEMENT_META: Record<string, { attrs: string; el: string; supportsDisabled: boolean }> = {
  button: { attrs: 'ButtonHTMLAttributes', el: 'HTMLButtonElement', supportsDisabled: true },
  span: { attrs: 'HTMLAttributes', el: 'HTMLSpanElement', supportsDisabled: false },
  div: { attrs: 'HTMLAttributes', el: 'HTMLDivElement', supportsDisabled: false },
  a: { attrs: 'AnchorHTMLAttributes', el: 'HTMLAnchorElement', supportsDisabled: false },
  input: { attrs: 'InputHTMLAttributes', el: 'HTMLInputElement', supportsDisabled: true },
  article: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  section: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  header: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  footer: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  label: { attrs: 'LabelHTMLAttributes', el: 'HTMLLabelElement', supportsDisabled: false },
  nav: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  hr: { attrs: 'HTMLAttributes', el: 'HTMLHRElement', supportsDisabled: false },
  ul: { attrs: 'HTMLAttributes', el: 'HTMLUListElement', supportsDisabled: false },
  li: { attrs: 'LiHTMLAttributes', el: 'HTMLLIElement', supportsDisabled: false },
  p: { attrs: 'HTMLAttributes', el: 'HTMLParagraphElement', supportsDisabled: false },
  textarea: { attrs: 'TextareaHTMLAttributes', el: 'HTMLTextAreaElement', supportsDisabled: true },
  select: { attrs: 'SelectHTMLAttributes', el: 'HTMLSelectElement', supportsDisabled: true },
  fieldset: { attrs: 'FieldsetHTMLAttributes', el: 'HTMLFieldSetElement', supportsDisabled: true },
  // Plain HTMLAttributes: BlockquoteHTMLAttributes declares `cite: string`,
  // which collides with slot props named cite (Astryx Blockquote API).
  blockquote: { attrs: 'HTMLAttributes', el: 'HTMLQuoteElement', supportsDisabled: false },
  code: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  kbd: { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false },
  h1: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h2: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h3: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h4: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h5: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
  h6: { attrs: 'HTMLAttributes', el: 'HTMLHeadingElement', supportsDisabled: false },
};

const PARENT_PROP_REF = /^\{([a-z][\w-]*)\}$/;

function depAttrString(
  dep: Contract,
  fixedProps: Record<string, string | boolean>,
  parent?: Contract,
): string {
  const parts: string[] = [];
  for (const [propName, value] of Object.entries(fixedProps)) {
    const depProp = dep.props.find((p) => p.name === propName);
    const codeName = depProp?.bindings.code.prop ?? propName;
    if (typeof value === 'boolean') {
      parts.push(value ? ` ${codeName}` : '');
      continue;
    }
    const parentRef = value.match(PARENT_PROP_REF);
    if (parentRef && parent) {
      // Parent→child prop mapping: `density: "{density}"` → density={density}
      const parentProp = parent.props.find((p) => p.name === parentRef[1]);
      parts.push(` ${codeName}={${parentProp?.bindings.code.prop ?? parentRef[1]}}`);
    } else {
      parts.push(` ${codeName}="${value}"`);
    }
  }
  return parts.join('');
}

/** Sample JSX for slot defaultContent — recursive: an item whose contract has
 *  its own default-slot defaultContent renders that too (Table → Row → Cell). */
export function sampleJSX(
  items: Array<{ id: string; props?: Record<string, string | boolean>; text?: string }>,
  byId: Map<string, Contract>,
  depth = 0,
): string {
  if (depth > 3) return '';
  return items
    .map((item) => {
      const dep = byId.get(item.id)!;
      const attrs = depAttrString(dep, item.props ?? {});
      const childrenText = textProps(dep).find((p) => p.bindings.code.prop === 'children');
      const nestedDefault = slotsOf(dep).find(
        (s) => s.slot.name === 'children' && (s.slot.defaultContent?.length ?? 0) > 0,
      );
      if (item.text !== undefined) return `<${dep.name}${attrs}>${item.text}</${dep.name}>`;
      if (nestedDefault) {
        return `<${dep.name}${attrs}>\n${sampleJSX(nestedDefault.slot.defaultContent!, byId, depth + 1)}\n</${dep.name}>`;
      }
      if (typeof childrenText?.default === 'string') {
        return `<${dep.name}${attrs}>${childrenText.default}</${dep.name}>`;
      }
      return `<${dep.name}${attrs} />`;
    })
    .join('\n');
}

/** All contracts referenced by a slot-sample tree (for story imports). */
function sampleDeps(
  items: Array<{ id: string }>,
  byId: Map<string, Contract>,
  out = new Set<string>(),
  depth = 0,
): Set<string> {
  if (depth > 3) return out;
  for (const item of items) {
    const dep = byId.get(item.id)!;
    out.add(dep.name);
    const nested = slotsOf(dep).find(
      (s) => s.slot.name === 'children' && (s.slot.defaultContent?.length ?? 0) > 0,
    );
    if (nested) sampleDeps(nested.slot.defaultContent!, byId, out, depth + 1);
  }
  return out;
}

export function generateTsx(
  contract: Contract,
  byId: Map<string, Contract>,
  iconAssets: Map<string, string>,
): string {
  // elementByProp renders a dynamic tag — the ref/attrs generalize to the
  // shared HTMLElement surface (the concrete element varies per prop value).
  const elementByProp = contract.semantics.elementByProp;
  const meta = elementByProp
    ? { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false }
    : ELEMENT_META[contract.semantics.element];
  const name = contract.name;
  const enums = enumProps(contract);
  const bools = boolProps(contract);
  const texts = namedTextProps(contract);
  const slots = namedSlots(contract);
  const codePropOf = (propName: string) =>
    contract.props.find((p) => p.name === propName)?.bindings.code.prop ?? propName;
  const deps = [
    ...new Set(
      walkAnatomy(contract)
        .filter((w) => w.part.component)
        .map((w) => byId.get(w.part.component!.id)!.name),
    ),
  ];

  const events = contract.events ?? [];
  const toggledCodeProps = new Set(
    events.filter((e) => e.toggles).map((e) => codePropOf(e.toggles!.prop)),
  );

  const propLines: string[] = [];
  for (const p of contract.props) {
    const doc = p.description ? `  /** ${p.description} */\n` : '';
    if (isEnum(p)) {
      const union = p.type.enum.map((v) => `'${v}'`).join(' | ');
      propLines.push(`${doc}  ${p.bindings.code.prop}?: ${union};`);
    } else if (isArrayType(p)) {
      const fields = Object.entries(p.type.arrayOf)
        .map(([f, t]) => `${f}: ${t === 'text' ? 'string' : t}`)
        .join('; ');
      propLines.push(`${doc}  ${p.bindings.code.prop}?: Array<{ ${fields} }>;`);
    } else if (p.type === 'boolean') {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: boolean;`);
    } else if (p.type === 'number') {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: number;`);
    } else if (p.bindings.code.prop !== 'children') {
      propLines.push(`${doc}  ${p.bindings.code.prop}${p.required ? '' : '?'}: string;`);
    }
  }
  for (const { slot, part } of slots) {
    const doc = part.description ? `  /** ${part.description} */\n` : '';
    propLines.push(`${doc}  ${slot.name}?: ReactNode;`);
  }
  for (const ev of events) {
    const doc = ev.description ?? `Fires when the ${ev.trigger} is activated.`;
    propLines.push(`  /** ${doc} */\n  ${ev.bindings.code.prop}?: () => void;`);
  }

  const destructured: string[] = [];
  // A toggled enum prop follows the controlled/uncontrolled pattern: no
  // destructure default — undefined means "uncontrolled", backed by useState.
  for (const p of enums) {
    destructured.push(
      toggledCodeProps.has(p.bindings.code.prop)
        ? `${p.bindings.code.prop}: ${p.bindings.code.prop}Prop`
        : `${p.bindings.code.prop} = '${p.default}'`,
    );
  }
  for (const p of bools) destructured.push(`${p.bindings.code.prop} = ${p.default === true}`);
  for (const p of numberProps(contract)) {
    destructured.push(`${p.bindings.code.prop} = ${typeof p.default === 'number' ? p.default : 0}`);
  }
  for (const p of texts) {
    destructured.push(
      p.required || p.default === undefined
        ? p.bindings.code.prop
        : `${p.bindings.code.prop} = '${p.default}'`,
    );
  }
  // v7 arrayOf props: no default destructure — undefined means "not
  // provided" (never a silent []). Pulled out so {...rest} cannot leak a
  // structured prop onto the DOM element.
  for (const p of arrayProps(contract)) destructured.push(p.bindings.code.prop);
  for (const { slot } of slots) destructured.push(slot.name);
  for (const ev of events) destructured.push(ev.bindings.code.prop);
  destructured.push('className', 'children', '...rest');

  // Body prelude: uncontrolled state + handlers for declared events.
  const prelude: string[] = [];
  for (const ev of events) {
    if (!ev.toggles) continue;
    const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
    const code = prop.bindings.code.prop;
    const union = (prop.type as { enum: string[] }).enum.map((v) => `'${v}'`).join(' | ');
    prelude.push(
      `  const [${code}Uncontrolled, set${pascal(code)}Uncontrolled] = useState<${union}>('${prop.default}');`,
      `  const ${code} = ${code}Prop ?? ${code}Uncontrolled;`,
    );
  }
  for (const ev of events) {
    const body: string[] = [];
    if (ev.toggles) {
      const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
      const code = prop.bindings.code.prop;
      const [off, on] = ev.toggles.between;
      body.push(`set${pascal(code)}Uncontrolled(${code} === '${on}' ? '${off}' : '${on}');`);
    }
    body.push(`${ev.bindings.code.prop}?.();`);
    prelude.push(`  const handle${pascal(ev.name)} = () => { ${body.join(' ')} };`);
  }

  /** onClick + ARIA state for a part that is an event trigger. A NATIVE
   *  checkable trigger (input[type=checkbox|radio]) gets the platform's own
   *  channels instead: checked + onChange, and any out-of-pair toggle value
   *  (Checkbox "indeterminate") sets the DOM PROPERTY via a callback ref —
   *  never a fake attribute, never aria-checked on a native input. */
  const eventAttrsFor = (partName: string, part: Part | undefined, partEl: string): string => {
    const ev = events.find((e) => e.trigger === partName);
    if (!ev) return '';
    if (part && isNativeCheckablePart(part)) {
      let s = '';
      if (ev.toggles) {
        const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
        const code = prop.bindings.code.prop;
        const [off, on] = ev.toggles.between;
        const others = (prop.type as { enum: string[] }).enum.filter((v) => v !== off && v !== on);
        s += ` checked={${code} === '${on}'}`;
        if (others.length > 0) {
          const cond = others.map((v) => `${code} === '${v}'`).join(' || ');
          s += ` ref={(el) => { if (el) el.indeterminate = ${cond}; }}`;
        }
      }
      s += ` onChange={handle${pascal(ev.name)}}`;
      return s;
    }
    let s = partEl === 'button' ? ' type="button"' : '';
    s += ` onClick={handle${pascal(ev.name)}}`;
    if (ev.toggles?.aria) {
      const prop = contract.props.find((p) => p.name === ev.toggles!.prop)!;
      const code = prop.bindings.code.prop;
      const [off, on] = ev.toggles.between;
      const others = (prop.type as { enum: string[] }).enum.filter((v) => v !== off && v !== on);
      s += others.length
        ? ` aria-${ev.toggles.aria}={${code} === '${on}' ? true : ${code} === '${off}' ? false : 'mixed'}`
        : ` aria-${ev.toggles.aria}={${code} === '${on}'}`;
    }
    return s;
  };

  const classParts = [
    'styles.root',
    ...enums.map((p) => `styles[\`${p.name}-\${${p.bindings.code.prop}}\`]`),
    'className',
  ];

  const nativeDisabled = meta.supportsDisabled && bools.some((p) => p.name === 'disabled');
  const elementAttrs: string[] = ['ref={ref}', 'className={classes}'];
  if (nativeDisabled) elementAttrs.push('disabled={disabled}');
  for (const p of bools) {
    if (p.name === 'disabled' && nativeDisabled) continue;
    // data-* attributes must be lowercase — kebab-case the prop name
    // (camelCase data attrs trigger React DOM warnings).
    const dataName = p.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    elementAttrs.push(`data-${dataName}={${p.bindings.code.prop} || undefined}`);
  }
  const roleByProp = contract.semantics.roleByProp;
  let roleMapConst = '';
  if (roleByProp) {
    roleMapConst = `const ROLE_MAP: Record<string, string> = ${JSON.stringify(roleByProp.map)};\n\n`;
    elementAttrs.push(`role={ROLE_MAP[${codePropOf(roleByProp.prop)}]}`);
  } else if (contract.semantics.role && contract.semantics.role !== contract.semantics.element) {
    elementAttrs.push(`role="${contract.semantics.role}"`);
  }
  // v7 elementByProp: mirror of ROLE_MAP — the rendered element follows the
  // enum prop, falling back to semantics.element (validated: the map covers
  // every enum value, so the fallback only guards unexpected runtime input).
  let elementMapConst = '';
  if (elementByProp) {
    elementMapConst = `const ELEMENT_MAP: Record<string, ElementType> = ${JSON.stringify(elementByProp.map)};\n\n`;
  }
  const rootEvent = events.find((e) => e.trigger === 'root');
  if (rootEvent) {
    elementAttrs.push(`onClick={handle${pascal(rootEvent.name)}}`);
  }
  elementAttrs.push('{...rest}');

  // Icon assets this contract needs (fixed names + enum expansions).
  const neededIcons = new Map<string, string>();
  for (const { part } of walkAnatomy(contract)) {
    if (!part.icon) continue;
    const m = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
    if (m) {
      const enumProp = contract.props.find((p) => p.name === m[1]);
      if (enumProp && isEnum(enumProp)) {
        for (const v of enumProp.type.enum) neededIcons.set(v, iconAssets.get(v) ?? '');
      }
    } else {
      neededIcons.set(part.icon.asset, iconAssets.get(part.icon.asset) ?? '');
    }
  }
  const iconsConst =
    neededIcons.size > 0
      ? `const ICONS: Record<string, string> = {\n${[...neededIcons.entries()]
          .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
          .join('\n')}\n};\n\n`
      : '';

  const NUMERIC_ATTRS = new Set(['rows', 'cols', 'tabIndex', 'colSpan', 'rowSpan']);
  const partAttrString = (part: Part): string =>
    Object.entries(part.attrs ?? {})
      .map(([attr, value]) => {
        const ref = value.match(/^\{([a-z][\w-]*)\}$/);
        if (ref) return ` ${attr}={String(${codePropOf(ref[1])})}`;
        if (NUMERIC_ATTRS.has(attr) && /^\d+$/.test(value)) return ` ${attr}={${value}}`;
        return ` ${attr}=${JSON.stringify(value)}`;
      })
      .join('');

  const wrapVisibleWhen = (part: Part, jsx: string): string => {
    if (!part.visibleWhen) return jsx;
    const codeName = codePropOf(part.visibleWhen.prop);
    const cond =
      part.visibleWhen.equals !== undefined ? `${codeName} === '${part.visibleWhen.equals}'` : codeName;
    return `{${cond} ? (${jsx}) : null}`;
  };

  // Recursive JSX for the anatomy tree.
  const renderPart = (partName: string, part: Part): string => {
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const keyExpr = ref ? codePropOf(ref[1]) : JSON.stringify(part.icon.asset);
      const glyph = `dangerouslySetInnerHTML={{ __html: ICONS[${keyExpr}] }}`;
      // A bare icon is decorative (aria-hidden). An icon on an interactive
      // element (element/attrs declared) keeps the element semantics — the
      // accessible name comes from attrs (e.g. aria-label) — and only the
      // glyph itself is hidden.
      const node = part.element
        ? `<${part.element} className={styles.${partName}}${partAttrString(part)}${eventAttrsFor(partName, part, part.element)}><span aria-hidden="true" className={styles.${partName}Glyph} ${glyph} /></${part.element}>`
        : `<span className={styles.${partName}} aria-hidden="true" ${glyph} />`;
      return wrapVisibleWhen(part, node);
    }
    if (part.repeat && part.component) {
      // v12 repeat (P9): the item template maps the live arrayOf prop — one
      // child instance per record, fields bound by name through the child's
      // code bindings (a text field whose child code prop is `children`
      // renders as JSX children). `undefined` renders nothing — the arrayOf
      // discipline (never a silent []); the static surfaces render the
      // contract's observed `sample` instead.
      const dep = byId.get(part.component.id)!;
      const rp = contract.props.find((p) => p.name === part.repeat!.itemsProp)!;
      const codeName = rp.bindings.code.prop;
      const fixedAttrs = depAttrString(dep, part.component.props ?? {}, contract);
      let childrenField: string | null = null;
      const fieldAttrs = Object.keys((rp.type as { arrayOf: Record<string, string> }).arrayOf)
        .map((field) => {
          const depProp = dep.props.find((p) => p.name === field)!;
          if (depProp.bindings.code.prop === 'children') {
            childrenField = field;
            return '';
          }
          return ` ${depProp.bindings.code.prop}={item.${field}}`;
        })
        .join('');
      const node = childrenField
        ? `<${dep.name} key={index}${fixedAttrs}${fieldAttrs}>{item.${childrenField}}</${dep.name}>`
        : `<${dep.name} key={index}${fixedAttrs}${fieldAttrs} />`;
      return wrapVisibleWhen(part, `{${codeName}?.map((item, index) => (${node}))}`);
    }
    if (part.component) {
      const dep = byId.get(part.component.id)!;
      const attrs = depAttrString(dep, part.component.props ?? {}, contract);
      const depChildren = textProps(dep).find((p) => p.bindings.code.prop === 'children');
      const text = part.component.text ?? (typeof depChildren?.default === 'string' ? depChildren.default : undefined);
      return text !== undefined
        ? `<${dep.name}${attrs}>${text}</${dep.name}>`
        : `<${dep.name}${attrs} />`;
    }
    if (part.slot) {
      const el = part.element ?? 'div';
      const expr = part.slot.name === 'children' ? 'children' : part.slot.name;
      const node = `<${el} className={styles.${partName}}${partAttrString(part)}>{${expr}}</${el}>`;
      return part.optional ? `{${expr} != null ? ${node} : null}` : wrapVisibleWhen(part, node);
    }
    if (part.content) {
      const el = part.element ?? 'span';
      const prop = contract.props.find(
        (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
      )!;
      return wrapVisibleWhen(
        part,
        `<${el} className={styles.${partName}}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>{${prop.bindings.code.prop}}</${el}>`,
      );
    }
    if (part.text !== undefined) {
      const el = part.element ?? 'span';
      return wrapVisibleWhen(
        part,
        `<${el} className={styles.${partName}}${partAttrString(part)}>${part.text}</${el}>`,
      );
    }
    if (part.meter) {
      const v = codePropOf(part.meter.valueProp);
      const m = codePropOf(part.meter.maxProp);
      return wrapVisibleWhen(
        part,
        `<div className={styles.${partName}} style={{ width: \`\${Math.min(100, Math.max(0, (${v} / ${m}) * 100))}%\` }} />`,
      );
    }
    const el = part.element ?? 'div';
    const inner = Object.entries(part.parts ?? {})
      .map(([childName, child]) => renderPart(childName, child))
      .join('\n');
    return wrapVisibleWhen(
      part,
      `<${el} className={styles.${partName}}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>\n${inner}\n</${el}>`,
    );
  };

  const root = contract.anatomy.root;
  const rootInner = root.parts
    ? Object.entries(root.parts)
        .map(([childName, child]) => renderPart(childName, child))
        .join('\n')
    : '{children}';

  const el = elementByProp ? 'Tag' : contract.semantics.element;
  if (elementByProp) {
    prelude.push(
      `  const Tag = ELEMENT_MAP[${codePropOf(elementByProp.prop)}] ?? '${contract.semantics.element}';`,
    );
  }
  const typeImports = [
    meta.attrs,
    ...(slots.length > 0 ? ['ReactNode'] : []),
    ...(elementByProp ? ['ElementType'] : []),
  ].join(', ');
  const depImports = deps
    .map((depName) => `import { ${depName} } from '../${depName}';`)
    .join('\n');

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 */
import { forwardRef${events.some((e) => e.toggles) ? ', useState' : ''} } from 'react';
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}import styles from './${name}.module.css';

${iconsConst}${roleMapConst}${elementMapConst}export interface ${name}Props extends ${meta.attrs}<${meta.el}> {
${propLines.join('\n')}
}

/** ${contract.description} */
export const ${name} = forwardRef<${meta.el}, ${name}Props>(function ${name}(
  { ${destructured.join(', ')} },
  ref,
) {
${prelude.length > 0 ? prelude.join('\n') + '\n' : ''}  const classes = [${classParts.join(', ')}].filter(Boolean).join(' ');
  return (
    <${el} ${elementAttrs.join(' ')}>
      ${rootInner}
    </${el}>
  );
});
`;
}

// ---------------------------------------------------------------------------
// Stories (.stories.tsx) generation
// ---------------------------------------------------------------------------

export function generateStories(contract: Contract, byId: Map<string, Contract>): string {
  const name = contract.name;
  const enums = enumProps(contract);
  const bools = boolProps(contract);
  const slots = namedSlots(contract);
  const hasDefaultSlot = slotsOf(contract).some((s) => s.slot.name === 'children');
  const label = textDefault(contract);

  const storyEvents = contract.events ?? [];
  const toggledPropNames = new Set(storyEvents.filter((e) => e.toggles).map((e) => e.toggles!.prop));

  const argTypes: string[] = [];
  const args: string[] = [];
  for (const p of contract.props) {
    const codeName = p.bindings.code.prop;
    const desc = p.description ? `, description: '${p.description.replace(/'/g, "\\'")}'` : '';
    if (isEnum(p)) {
      argTypes.push(
        `    ${codeName}: { control: 'select', options: [${p.type.enum.map((v) => `'${v}'`).join(', ')}]${desc} },`,
      );
      // Toggled props get NO default arg: undefined = uncontrolled, so the
      // component is actually interactive in the Playground. Setting the
      // control switches it to controlled — the standard React pattern.
      if (p.default !== undefined && !toggledPropNames.has(p.name)) {
        args.push(`    ${codeName}: '${p.default}',`);
      }
    } else if (isArrayType(p)) {
      argTypes.push(`    ${codeName}: { control: false${desc} },`);
      // v12 repeat (P9): a collection's story renders the contract's OBSERVED
      // sample as the array arg — the same honest static state the canvas
      // and static surfaces render.
      const repeatPart = walkAnatomy(contract).find((w) => w.part.repeat?.itemsProp === p.name);
      if (repeatPart) {
        args.push(`    ${codeName}: ${JSON.stringify(repeatPart.part.repeat!.sample)},`);
      }
    } else if (p.type === 'boolean') {
      argTypes.push(`    ${codeName}: { control: 'boolean'${desc} },`);
      args.push(`    ${codeName}: ${p.default === true},`);
    } else if (p.type === 'number') {
      argTypes.push(`    ${codeName}: { control: { type: 'number' }${desc} },`);
      if (typeof p.default === 'number') args.push(`    ${codeName}: ${p.default},`);
    } else {
      argTypes.push(`    ${codeName}: { control: 'text'${desc} },`);
      if (typeof p.default === 'string') args.push(`    ${codeName}: '${p.default}',`);
    }
  }
  for (const { slot } of slots) {
    argTypes.push(`    ${slot.name}: { control: false },`);
  }
  for (const ev of storyEvents) {
    const evDesc = (ev.description ?? `Fires when the ${ev.trigger} is activated.`).replace(/'/g, "\\'");
    argTypes.push(`    ${ev.bindings.code.prop}: { control: false, description: '${evDesc}' },`);
  }
  const defaultSlot = slotsOf(contract).find((s) => s.slot.name === 'children');
  const defaultSample =
    defaultSlot && (defaultSlot.slot.defaultContent?.length ?? 0) > 0
      ? sampleJSX(defaultSlot.slot.defaultContent!, byId)
      : null;
  if (hasDefaultSlot && !defaultSample) {
    argTypes.push(`    children: { control: 'text' },`);
    args.push(`    children: 'The quick brown fox jumps over the lazy dog.',`);
  }
  if (defaultSample) {
    argTypes.push(`    children: { control: false },`);
  }

  const variantStories =
    enums.length > 0
      ? enums[0].type.enum
          .map((v) => {
            // A story named after the component itself collides with its import.
            const safe = v.replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
            let storyName = pascal(safe) === name ? `${pascal(safe)}Variant` : pascal(safe);
            // Values that don't start with a letter (Heading level "1") are
            // not legal identifiers — prefix the axis name (Level1).
            if (!/^[A-Za-z_]/.test(storyName)) storyName = `${pascal(enums[0].name)}${storyName}`;
            return `
export const ${storyName}: Story = {
  args: { ${enums[0].bindings.code.prop}: '${v}' },
};`;
          })
          .join('\n')
      : '';

  // One story per constrained named slot, filled with the slot's
  // defaultContent when declared, else a sample of the first accepted contract.
  const slotSampleImports = new Set<string>();
  if (defaultSample) {
    for (const n of sampleDeps(defaultSlot!.slot.defaultContent!, byId)) slotSampleImports.add(n);
  }
  let slotStories = '';
  for (const { slot } of slots) {
    let sample: string;
    if ((slot.defaultContent?.length ?? 0) > 0) {
      sample = `<>${sampleJSX(slot.defaultContent!, byId)}</>`;
      for (const n of sampleDeps(slot.defaultContent!, byId)) slotSampleImports.add(n);
    } else {
      const acceptedId = slot.accepts?.[0];
      if (!acceptedId) continue;
      const dep = byId.get(acceptedId)!;
      slotSampleImports.add(dep.name);
      const requiredAttrs = dep.props
        .filter((p) => p.type === 'text' && p.required && p.bindings.code.prop !== 'children' && typeof p.default === 'string')
        .map((p) => ` ${p.bindings.code.prop}="${p.default}"`)
        .join('');
      const hasChildren = dep.props.some((p) => p.type === 'text' && p.bindings.code.prop === 'children');
      sample = hasChildren
        ? `<${dep.name}${requiredAttrs}>${textDefault(dep)}</${dep.name}>`
        : `<${dep.name}${requiredAttrs} />`;
    }
    slotStories += `
/** The "${slot.name}" slot accepts: ${(slot.accepts ?? []).join(', ') || 'anything'}. */
export const With${pascal(slot.name)}: Story = {
  render: (args) => (
    <${name} {...args} ${slot.name}={${sample}} />
  ),
};`;
  }

  // A shared render fills the default slot with its declared sample content
  // for every args-only story (Playground, per-variant, Disabled).
  const metaRender = defaultSample
    ? `
  render: (args) => (
    <${name} {...args}>
      ${defaultSample.split('\n').join('\n      ')}
    </${name}>
  ),`
    : '';

  let matrixStory = '';
  if (enums.length > 0 && !defaultSample) {
    // N-axis matrix: rows = the first enum axis; columns = the ordered
    // cartesian product of every remaining axis (matches the canvas grid).
    const rowProp = enums[0];
    const colAxes = enums.slice(1);
    let colCombos: string[][] = [[]];
    for (const axis of colAxes) {
      const next: string[][] = [];
      for (const combo of colCombos) {
        for (const v of axis.type.enum) next.push([...combo, v]);
      }
      colCombos = next;
    }
    // Required text props must appear in every cell or the story won't
    // typecheck. Children-bound text props are excluded — they arrive as JSX
    // children below (a `children` attribute would duplicate them).
    const requiredTextAttrs = contract.props
      .filter((p) => p.type === 'text' && p.required && typeof p.default === 'string' && p.bindings.code.prop !== 'children')
      .map((p) => `${p.bindings.code.prop}="${p.default}"`);
    const cells: string[] = [];
    for (const row of rowProp.type.enum) {
      const rowCells = colCombos
        .map((combo) => {
          const attrs = [
            `${rowProp.bindings.code.prop}="${row}"`,
            ...colAxes.map((axis, i) => `${axis.bindings.code.prop}="${combo[i]}"`),
            ...requiredTextAttrs,
          ].join(' ');
          // Children arrive via a slot OR a children-bound text prop
          // (Button's label) — either way the matrix cell needs content,
          // or every cell renders as an empty pill.
          return hasDefaultSlot || textProps(contract).some((p) => p.bindings.code.prop === 'children')
            ? `        <${name} ${attrs}>${label}</${name}>`
            : `        <${name} ${attrs} />`;
        })
        .join('\n');
      cells.push(rowCells);
    }
    const columns = colCombos.length;
    matrixStory = `
/** Every legal combination the contract defines${colAxes.length > 0 ? ` (${enums.map((e) => e.name).join(' × ')})` : ''}. */
export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(${columns}, max-content)',
        alignItems: 'center',
        justifyItems: 'start',
      }}
    >
${cells.join('\n')}
    </div>
  ),
};`;
  }

  const disabledStory = bools.some((p) => p.name === 'disabled')
    ? `
export const Disabled: Story = {
  args: { disabled: true },
};`
    : '';

  const sampleImports = [...slotSampleImports]
    .map((depName) => `import { ${depName} } from '../${depName}';`)
    .join('\n');

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
${sampleImports}${sampleImports ? '\n' : ''}import { ${name} } from './${name}';

const meta = {
  title: 'Components/${name}',
  component: ${name},
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: ${JSON.stringify(contract.description)} } },
  },${metaRender}
  argTypes: {
${argTypes.join('\n')}
  },
  args: {
${args.join('\n')}
  },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
${variantStories}${disabledStory}${slotStories}${matrixStory}
`;
}

// ---------------------------------------------------------------------------
// emitReact — the one-call surface a playground uses
// ---------------------------------------------------------------------------

/** Everything emission needs beyond the contract itself — data only, no
 *  paths: the token inventory, the icon assets, and the resolved contract
 *  set (for composition refs and slot samples). */
export interface EmitCtx {
  /** Token inventory paths (core/tokens.ts tokenInventoryFromJson). */
  tokens: Set<string>;
  /** Icon asset name → SVG markup (the repo's assets/icons/*.svg). */
  icons: Map<string, string>;
  /** Every known contract by id — composition refs resolve through it. */
  contracts: Map<string, Contract>;
}

export interface EmitReactResult {
  tsx: string;
  css: string;
  stories: string;
}

/** Contract → { tsx, css, stories }, UNFORMATTED (the CLI shell and the
 *  playground both run the same prettier/standalone pass — core/format.ts —
 *  so bytes match the shipped files). Throws with every named violation if
 *  the contract fails validation — invalid states are refused, not rendered. */
export function emitReact(contract: Contract, ctx: EmitCtx): EmitReactResult {
  const errors: string[] = [];
  validateContract(contract, ctx.contracts, errors, ctx.icons);
  const css = generateCss(contract, ctx.tokens, errors);
  if (errors.length > 0) {
    throw new Error(`Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return {
    tsx: generateTsx(contract, ctx.contracts, ctx.icons),
    css,
    stories: generateStories(contract, ctx.contracts),
  };
}
