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
 * The ANALYSIS half — validateContract, generateCss, the multi-root and
 * grid helpers, the prop classifiers, ELEMENT_META and the other
 * contract-fact tables — lives in packages/core/src (@ds-contracts/core) so
 * an emitter outside this repo reads the same facts. This module keeps the
 * React PROJECTION (generateTsx, generateStories, emitReact) and re-exports
 * every moved name, so every `./emit-react.js` import keeps working. The
 * package source is imported by RELATIVE path (the scripts/contract-schema.ts
 * precedent): one file for every bundler, deduped with the tsconfig
 * `paths`-resolved `@ds-contracts/core` specifier.
 *
 * Composition semantics (see docs/02 + docs/08):
 *   - anatomy is a nested tree; each part becomes a class-named element
 *   - `component` parts render fixed instances of other contracts (imported)
 *   - `slot` parts render {children} (name "children") or a ReactNode prop
 *   - `content` parts render a bound text prop
 *   - optional parts render conditionally on their slot prop
 */
import {
  DEFAULT_CONTENT_SLOT,
  designTimeSlotContent,
  isNativeCheckablePart,
  pascal,
  slotsOf,
  walkAnatomy,
  type Contract,
  type Part,
  type Prop,
} from '../scripts/contract-schema.js';
import {
  arrayProps,
  boolProps,
  enumProps,
  isArrayType,
  isEnum,
  isMultiRoot,
  namedSlots,
  namedTextProps,
  numberProps,
  textDefault,
  textProps,
  topRoots,
} from '../packages/core/src/anatomy.js';
import { gridCellPlan } from '../packages/core/src/grid.js';
import { validateContract } from '../packages/core/src/validate.js';
import { generateCss } from '../packages/core/src/css.js';
import { ELEMENT_META } from '../packages/core/src/elements.js';
import { reactOmittedNote, reactPropsBase } from '../packages/core/src/prop-collision.js';

// Re-export shim — the analysis layer's public names, exactly as this module
// exported them before the move (plus ELEMENT_META / holderDeclaresPosition,
// hoisted out of the projection half because they are contract facts).
export {
  arrayProps,
  boolProps,
  enumProps,
  holderDeclaresPosition,
  isArrayType,
  isEnum,
  isMultiRoot,
  isVariantBool,
  namedSlots,
  namedTextProps,
  NATIVE_ROLE_HOSTS,
  numberProps,
  PART_STATE_CHANNELS,
  rootElementsOf,
  textDefault,
  textProps,
  topRootNames,
  topRoots,
  UA_MARGIN_ELEMENTS,
  UA_PAINT_CHANNELS,
  UA_PAINTED_ROOT_ELEMENTS,
} from '../packages/core/src/anatomy.js';
export {
  GRID_SELF_ALIGN,
  gridCellPlan,
  gridChildCrossAxisDecls,
  gridGapCss,
  gridParentDecls,
  gridPlacementDecls,
  gridTemplateAreasValue,
  gridTrackCss,
  type GridCellPlan,
} from '../packages/core/src/grid.js';
export { validateContract } from '../packages/core/src/validate.js';
export { generateCss, stripCanvasOnlyChannels } from '../packages/core/src/css.js';
export { ELEMENT_META } from '../packages/core/src/elements.js';

// ---------------------------------------------------------------------------
// Component (.tsx) generation
// ---------------------------------------------------------------------------

const PARENT_PROP_REF = /^\{([a-z][\w-]*)\}$/;

function depAttrString(
  dep: Contract,
  fixedProps: Record<string, string | boolean | { prop: string; map: Record<string, string> }>,
  parent?: Contract,
): string {
  const parts: string[] = [];
  for (const [propName, value] of Object.entries(fixedProps)) {
    const depProp = dep.props.find((p) => p.name === propName);
    const codeName = depProp?.bindings.code.prop ?? propName;
    if (typeof value === 'object') {
      // PropByProp lookup (first-variant-freeze fix): the child prop follows
      // a per-value map of the parent's enum prop — ternary chain, trailing
      // undefined applies the child's own default for unmapped values.
      const parentProp = parent?.props.find((p) => p.name === value.prop);
      const expr = parentProp?.bindings.code.prop ?? value.prop;
      const chain = Object.entries(value.map)
        .map(([k, v]) => `${expr} === '${k}' ? '${v}' : `)
        .join('');
      parts.push(` ${codeName}={${chain}undefined}`);
      continue;
    }
    if (typeof value === 'boolean') {
      if (depProp && depProp.type !== 'boolean') {
        throw new Error(
          `${dep.id}: applied value for prop "${propName}" is a boolean but the dependency types it ${JSON.stringify(depProp.type)} — fix the composing contract (cross-contract prop types are load-bearing)`,
        );
      }
      // An applied `false` must OVERRIDE a dependency whose own default is
      // true — omitting the attribute would silently re-enable the part
      // (field case: AvatarGroup applies text:false while Avatar defaults
      // text:true; the omitted attr rendered "OR" initials on every grouped
      // avatar). Omission stays the spelling only when it already means
      // false at the dependency.
      parts.push(value ? ` ${codeName}` : depProp?.default === false ? '' : ` ${codeName}={false}`);
      continue;
    }
    const parentRef = value.match(PARENT_PROP_REF);
    // A STRING against a boolean dep prop would emit supportingText="false" —
    // truthy at runtime, silently rendering a part the canvas hides (audit
    // class string-boolean-coercion). Composition owns the coercion; the
    // emitter applies it here as well so a leftover "true"/"false" from a
    // sibling that was not in scope at propose still emits as a boolean.
    // `{parentProp}` references are the one legal non-boolean string spelling.
    if (depProp?.type === 'boolean' && !(parentRef && parent)) {
      const spelled = value.trim().toLowerCase();
      if (spelled === 'true' || spelled === 'false') {
        const coerced = spelled === 'true';
        parts.push(coerced ? ` ${codeName}` : depProp.default === false ? '' : ` ${codeName}={false}`);
        continue;
      }
      throw new Error(
        `${dep.id}: applied value ${JSON.stringify(value)} for prop "${propName}" is a string but the dependency types it boolean — coerce at composition ('False' → false), never pass the spelling through`,
      );
    }
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
        (s) => s.slot.name === DEFAULT_CONTENT_SLOT && (s.slot.defaultContent?.length ?? 0) > 0,
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
      (s) => s.slot.name === DEFAULT_CONTENT_SLOT && (s.slot.defaultContent?.length ?? 0) > 0,
    );
    if (nested) sampleDeps(nested.slot.defaultContent!, byId, out, depth + 1);
  }
  return out;
}

/** Every class name that appears in a SELECTOR of an emitted module sheet.
 *  Comments are stripped first: the generated header carries the contract id
 *  ("ds.progress-bar"), which a naive scan reads as a class called
 *  `progress-bar` — the false negative that hid `axis-inert` from an
 *  unanchored probe. Compound selectors (`.variant-primary.state-hover`) and
 *  descendant rules (`.progress-40 .Progress2`) both contribute every class
 *  they name, because the TSX must compose all of them for the rule to
 *  match. */
export function cssClassSelectors(css: string): Set<string> {
  const out = new Set<string>();
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    for (const c of rule[1].matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) out.add(c[1]);
  }
  return out;
}

export function generateTsx(
  contract: Contract,
  byId: Map<string, Contract>,
  iconAssets: Map<string, string>,
  /** GAP-CLOSING ROUND 2 (`axis-inert`) — the module sheet this component
   *  will ship with (generateCss's output for the SAME contract). With it the
   *  emitter refuses to compose a class template for an axis the sheet never
   *  gives a rule: `styles['statusIcon-company']` on a module with no
   *  `.statusIcon-*` rule is `undefined`, is filtered out of the className
   *  string, and leaves an axis that looks styled and is not. Omitted (no
   *  caller in this repo) — the historical unconditional spelling, so an
   *  out-of-tree caller cannot silently change. */
  emittedCss?: string,
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
        .map((w) => {
          const id = w.part.component!.id;
          const dep = byId.get(id);
          if (!dep) {
            throw new Error(
              `generateTsx: component ref "${id}" is not in byId — register the child contract or its stub`,
            );
          }
          return dep.name;
        }),
    ),
  ];
  // PROP-NAME COLLISIONS (core/prop-collision.ts): a prop named like a DOM
  // attribute React types on the root (`content`, `title`, `hidden`…) is
  // OMITTED from the base attrs type — the contract's prop wins — and named
  // in the header. Byte-identical when nothing collides.
  const { base: propsBase, omitted: omittedAttrs } = reactPropsBase(contract, meta);
  const omittedNote = reactOmittedNote(omittedAttrs, meta);

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
  // ROUND 3: `children` normally has no destructure default — a JSX-children
  // label is the consumer's, and the contract default is only story/canvas
  // sample text the canvas TEXT property already carries. A text prop bound
  // figma kind NONE has no such property: the contract default is the ONLY
  // record of the characters the component draws, so the component must
  // render them when nothing is passed — otherwise the promotion would turn
  // a drawn label into empty ink. Every other contract is byte-identical.
  const childrenText = textProps(contract).find((p) => p.bindings.code.prop === 'children');
  const childrenDefault =
    childrenText && childrenText.bindings.figma.kind === 'NONE' && typeof childrenText.default === 'string'
      ? `children = ${JSON.stringify(childrenText.default)}`
      : 'children';
  destructured.push('className', childrenDefault, '...rest');

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

  // GAP-CLOSING ROUND 2 (`axis-inert`) — an enum axis whose module sheet
  // carries no `.<axis>-*` rule composes NO class. The dead reference used to
  // ship unconditionally, which is exactly what an inert axis looks like from
  // the outside: the prop exists, the class is composed, and every value
  // renders the same drawing. Suppression is a LEDGER, not a throw — 41 of
  // the 133 axis class templates in this repo's committed generated output
  // were dead when this landed, spread over EVERY generated surface (this
  // library's own 51 components, untitled-ui, polaris, astryx, the fidelity
  // matrix, the eventz pilot), so a hard failure would have refused all of
  // them at once. The suppressed axes are NAMED in the emitted file instead.
  const definedClasses = emittedCss === undefined ? null : cssClassSelectors(emittedCss);
  const inertAxes: string[] = [];
  const classedEnums = enums.filter((p) => {
    if (definedClasses === null) return true;
    for (const c of definedClasses) if (c.startsWith(`${p.name}-`)) return true;
    inertAxes.push(p.name);
    return false;
  });
  const classParts = [
    'styles.root',
    ...classedEnums.map((p) => `styles[\`${p.name}-\${${p.bindings.code.prop}}\`]`),
    'className',
  ];
  const inertNote =
    inertAxes.length === 0
      ? ''
      : `  // axis-inert (ledgered, not a throw): ${inertAxes.join(', ')} — no \`.<axis>-*\` rule\n` +
        `  // exists in ${name}.module.css, so no class is composed for ${inertAxes.length === 1 ? 'it' : 'them'}. A reference\n` +
        `  // to an unemitted class resolves to \`undefined\` and is filtered out, so emitting\n` +
        `  // one only made a style-less axis LOOK styled. Whatever ${inertAxes.length === 1 ? 'this axis carries' : 'these axes carry'} rides\n` +
        `  // structure (a gated part, a per-value text/icon lookup, a child's own props) —\n` +
        `  // or, where the source drew no difference at all, nothing.\n`;

  // `attrs` on a part (root included): a `{prop}` value binds to the prop —
  // a text prop's code binding is already a string, so it binds bare
  // (`href={href}`); an enum/number prop is coerced (`{String(size)}`). A
  // literal lands as a literal (numeric DOM props as numbers).
  const NUMERIC_ATTRS = new Set(['rows', 'cols', 'tabIndex', 'colSpan', 'rowSpan']);
  const partAttrList = (part: Part | undefined): string[] =>
    Object.entries(part?.attrs ?? {}).map(([attr, value]) => {
      const ref = value.match(/^\{([a-z][\w-]*)\}$/);
      if (ref) {
        const bound = contract.props.find((p) => p.name === ref[1]);
        return bound?.type === 'text'
          ? `${attr}={${codePropOf(ref[1])}}`
          : `${attr}={String(${codePropOf(ref[1])})}`;
      }
      if (NUMERIC_ATTRS.has(attr) && /^\d+$/.test(value)) return `${attr}={${value}}`;
      return `${attr}=${JSON.stringify(value)}`;
    });
  const partAttrString = (part: Part): string => partAttrList(part).map((a) => ` ${a}`).join('');

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
  // anatomy.root.attrs — the root element's own attributes, carried exactly
  // the way nested parts' attrs are (the P0 this closes: icon-button's
  // aria-label + type, progress-bar's role, skeleton's aria-hidden and the
  // <a>-rooted components' href were destructured and dropped). `role` here
  // wins over the semantics default below (validateContract refuses a
  // DIFFERING pair by name), and an authored `type` suppresses the implicit
  // type="button" the root event would add.
  const rootAttrs = contract.anatomy.root?.attrs ?? {};
  elementAttrs.push(...partAttrList(contract.anatomy.root));
  const roleByProp = contract.semantics.roleByProp;
  let roleMapConst = '';
  if (roleByProp) {
    roleMapConst = `const ROLE_MAP: Record<string, string> = ${JSON.stringify(roleByProp.map)};\n\n`;
    elementAttrs.push(`role={ROLE_MAP[${codePropOf(roleByProp.prop)}]}`);
  } else if (
    rootAttrs.role === undefined &&
    contract.semantics.role &&
    contract.semantics.role !== contract.semantics.element
  ) {
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
    if (contract.semantics.element === 'button' && rootAttrs.type === undefined) {
      elementAttrs.push('type="button"');
    }
    elementAttrs.push(`onClick={handle${pascal(rootEvent.name)}}`);
    if (rootEvent.toggles?.aria) {
      const prop = contract.props.find((p) => p.name === rootEvent.toggles!.prop)!;
      const code = prop.bindings.code.prop;
      const [, on] = rootEvent.toggles.between;
      elementAttrs.push(`aria-${rootEvent.toggles.aria}={${code} === '${on}'}`);
    }
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

  // CSS-module class access for a part name. Promoted anatomies carry
  // hyphenated part names (round 4: "label-2", "icon-3-incomplete") — dot
  // access on those parses as SUBTRACTION (styles.label-2 → styles.label - 2,
  // NaN class names / ReferenceErrors at runtime; found by the CI journey
  // validation, examples/ci/VALIDATION.md). Non-identifier names use bracket
  // access; identifier names keep the dot spelling byte-for-byte.
  const JS_IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const stylesRef = (cls: string): string =>
    JS_IDENT_RE.test(cls) ? `styles.${cls}` : `styles[${JSON.stringify(cls)}]`;

  const wrapVisibleWhen = (part: Part, jsx: string): string => {
    if (!part.visibleWhen) return jsx;
    const codeName = codePropOf(part.visibleWhen.prop);
    const eq = part.visibleWhen.equals;
    const cond =
      eq === undefined
        ? codeName
        : Array.isArray(eq)
          ? eq.map((v) => `${codeName} === '${v}'`).join(' || ')
          : `${codeName} === '${eq}'`;
    return `{${cond} ? (${jsx}) : null}`;
  };

  // Recursive JSX for the anatomy tree.
  // A2 grid: the same compiled cell plan the CSS consulted — the JSX owes
  // the OTHER half of the G4 dual-slot convention (placeholder elements for
  // empty areas) and the wrapper elements instance cells ride.
  const gridPlan = gridCellPlan(contract);
  const gridPlaceholderJsx = (partName: string): string =>
    (gridPlan.placeholders.get(partName) ?? [])
      .map((area) => `<div className={${stylesRef(area)}} />`)
      .join('\n');

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
        ? `<${part.element} className={${stylesRef(partName)}}${partAttrString(part)}${eventAttrsFor(partName, part, part.element)}><span aria-hidden="true" className={${stylesRef(`${partName}Glyph`)}} ${glyph} /></${part.element}>`
        : `<span className={${stylesRef(partName)}} aria-hidden="true" ${glyph} />`;
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
      // ROUND 3 — instance text overrides: when the host APPLIES the child's
      // children prop (component.props), the child's own default must not be
      // re-emitted as JSX children — React resolves JSX children AFTER the
      // `children` attribute, so the default would silently win and the
      // host's observed label would never render. No applied children prop →
      // byte-identical to the default-echoing behavior.
      const childrenApplied = depChildren !== undefined && part.component.props?.[depChildren.name] !== undefined;
      // …and a dep whose children prop binds kind NONE already defaults
      // ITSELF in its own signature (the promoted-override class), so
      // echoing the default here would only add redundant JSX children.
      const depSelfDefaults = depChildren?.bindings.figma.kind === 'NONE';
      const text =
        part.component.text ??
        (!childrenApplied && !depSelfDefaults && typeof depChildren?.default === 'string'
          ? depChildren.default
          : undefined);
      // Presence rules apply to nested-component parts exactly as they do to
      // icon/repeat parts — this branch used to return bare JSX, silently
      // dropping contract visibleWhen (AUDIT-ROUND-1: emitter-drops-
      // visibleWhen-on-component-parts).
      const instance =
        text !== undefined
          ? `<${dep.name}${attrs}>${text}</${dep.name}>`
          : `<${dep.name}${attrs} />`;
      // Round 2 iteration 9 — per-instance overrides ride a structural
      // wrapper span (its class sets the child's override custom
      // properties; see generateCss). No overrides → bare instance,
      // byte-identical.
      // A2 grid (G3/P12): an instance cell rides the same wrapper span — its
      // class carries the grid placement (see generateCss).
      const withOverrides =
        Object.keys(part.component.overrides ?? {}).length > 0 || gridPlan.wrappedInstances.has(partName)
          ? `<span className={${stylesRef(partName)}}>${instance}</span>`
          : instance;
      return wrapVisibleWhen(part, withOverrides);
    }
    if (part.slot) {
      const el = part.element ?? 'div';
      const expr = part.slot.name === DEFAULT_CONTENT_SLOT ? 'children' : part.slot.name;
      const node = `<${el} className={${stylesRef(partName)}}${partAttrString(part)}>{${expr}}</${el}>`;
      return part.optional ? `{${expr} != null ? ${node} : null}` : wrapVisibleWhen(part, node);
    }
    if (part.content) {
      const el = part.element ?? 'span';
      const prop = contract.props.find(
        (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
      )!;
      return wrapVisibleWhen(
        part,
        `<${el} className={${stylesRef(partName)}}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>{${prop.bindings.code.prop}}</${el}>`,
      );
    }
    if (part.text !== undefined) {
      const el = part.element ?? 'span';
      // textByProp (first-variant-freeze fix): per-enum-value characters as
      // a ternary chain over the driving prop, base text as the fallback.
      const tb = part.textByProp;
      const inner = tb
        ? `{${Object.entries(tb.map)
            .map(([v, t]) => `${codePropOf(tb.prop)} === '${v}' ? ${JSON.stringify(t)} : `)
            .join('')}${JSON.stringify(part.text)}}`
        : part.text;
      return wrapVisibleWhen(
        part,
        `<${el} className={${stylesRef(partName)}}${partAttrString(part)}>${inner}</${el}>`,
      );
    }
    if (part.meter) {
      const v = codePropOf(part.meter.valueProp);
      const m = codePropOf(part.meter.maxProp);
      return wrapVisibleWhen(
        part,
        `<div className={${stylesRef(partName)}} style={{ width: \`\${Math.min(100, Math.max(0, (${v} / ${m}) * 100))}%\` }} />`,
      );
    }
    const el = part.element ?? 'div';
    // A2 grid (G4): a grid parent's EMPTY areas render placeholder elements
    // after the declared children — the slot class carries the placement,
    // so the grid's shape is visible with nothing in it.
    const inner = [
      ...Object.entries(part.parts ?? {}).map(([childName, child]) => renderPart(childName, child)),
      ...(gridPlaceholderJsx(partName) ? [gridPlaceholderJsx(partName)] : []),
    ].join('\n');
    return wrapVisibleWhen(
      part,
      `<${el} className={${stylesRef(partName)}}${partAttrString(part)}${eventAttrsFor(partName, part, el)}>\n${inner}\n</${el}>`,
    );
  };

  // MULTI-ROOT composite (advanced composition). A captured composite (Modal =
  // {dialog, backdrop}) has >1 top-level root. Per-surface decision (see the
  // module header of generate-components): the roots render as SIBLINGS inside
  // a Fragment — NO synthetic wrapper (a Modal's backdrop and dialog are
  // position-driven siblings, exactly as the real component portals them). The
  // single-root path below is the N=1 case and is left byte-for-byte untouched.
  if (isMultiRoot(contract)) {
    const rootsJsx = topRoots(contract)
      .map(([n, p]) => renderPart(n, p))
      .join('\n      ');
    const mrTypeImports = [meta.attrs, ...(slots.length > 0 ? ['ReactNode'] : [])].join(', ');
    const mrDepImports = deps.map((depName) => `import { ${depName} } from '../${depName}';`).join('\n');
    return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 *
 * MULTI-ROOT composite — the anatomy declares ${topRoots(contract).length} top-level roots
 * (${topRoots(contract).map(([n]) => n).join(', ')}). They render as SIBLINGS in a
 * Fragment; there is no single wrapping element (a Modal's backdrop + dialog
 * are position-driven siblings). Each root's class is styles.<rootName>.${omittedNote}
 */
import type { ${mrTypeImports} } from 'react';
${mrDepImports}${mrDepImports ? '\n' : ''}import styles from './${name}.module.css';

${iconsConst}export interface ${name}Props extends ${propsBase} {
${propLines.join('\n')}
}

/** ${contract.description}${seeLines(contract)} */
export function ${name}({ ${destructured.join(', ')} }: ${name}Props) {
  return (
    <>
      ${rootsJsx}
    </>
  );
}
`;
  }

  const root = contract.anatomy.root;
  const rootInner = root.parts || gridPlan.placeholders.has('root')
    ? [
        ...Object.entries(root.parts ?? {}).map(([childName, child]) => renderPart(childName, child)),
        // A2 grid (G4): empty root-grid areas render placeholders too.
        ...(gridPlaceholderJsx('root') ? [gridPlaceholderJsx('root')] : []),
      ].join('\n')
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
 * Regenerate with: npm run generate${omittedNote}
 */
import { forwardRef${events.some((e) => e.toggles) ? ', useState' : ''} } from 'react';
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}import styles from './${name}.module.css';

${iconsConst}${roleMapConst}${elementMapConst}export interface ${name}Props extends ${propsBase} {
${propLines.join('\n')}
}

/** ${contract.description}${seeLines(contract)} */
export const ${name} = forwardRef<${meta.el}, ${name}Props>(function ${name}(
  { ${destructured.join(', ')} },
  ref,
) {
${prelude.length > 0 ? prelude.join('\n') + '\n' : ''}${inertNote}  const classes = [${classParts.join(', ')}].filter(Boolean).join(' ');
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
  const hasDefaultSlot = slotsOf(contract).some((s) => s.slot.name === DEFAULT_CONTENT_SLOT);
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
  const defaultSlot = slotsOf(contract).find((s) => s.slot.name === DEFAULT_CONTENT_SLOT);
  const defaultSample =
    defaultSlot && (defaultSlot.slot.defaultContent?.length ?? 0) > 0
      ? sampleJSX(defaultSlot.slot.defaultContent!, byId)
      : null;
  // RC5 — the design-time sample is no longer spelled here. `args.children` is
  // the canonical design-time content of the default slot on the CODE surface;
  // the Figma main component's slot content is the same object on the CANVAS
  // surface. Both emitters now read ONE policy (designTimeSlotContent), so the
  // two surfaces cannot drift apart: the string a story shows is byte-for-byte
  // the string the canvas draws.
  const defaultPolicy = defaultSlot ? designTimeSlotContent(defaultSlot.slot) : null;
  if (hasDefaultSlot && !defaultSample && defaultPolicy?.kind === 'sample') {
    argTypes.push(`    children: { control: 'text' },`);
    // Single-quoted, matching every other generated arg (byte-identical to
    // the literal this replaced — the constant carries no quote to escape).
    args.push(`    children: '${defaultPolicy.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`);
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

  // `../tokens.css` — the custom-property sheet the generator writes at the
  // output root (scripts/generate-components.ts → core/emit-tokens-css.ts),
  // one level above this story's <Name>/ directory. Imported HERE so a
  // Storybook glob over the generated tree paints with no preview.ts line:
  // before this import the BETA.md golden path rendered unstyled (2026-08-22).
  return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../tokens.css';
${sampleImports}${sampleImports ? '\n' : ''}import { ${name} } from './${name}';

const meta = {
  title: 'Components/${name}',
  component: ${name},
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: ${JSON.stringify([contract.description, ...(contract.documentationLinks ?? []).map((l) => `Documentation: ${l.uri}`)].join('\n\n'))} } },
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
/** Figma documentation links → JSDoc `@see` lines (schema 18 documentationLinks). */
const seeLines = (contract: Contract): string =>
  (contract.documentationLinks ?? []).map((l) => `\n * @see ${l.uri}`).join('');

export function emitReact(contract: Contract, ctx: EmitCtx): EmitReactResult {
  const errors: string[] = [];
  validateContract(contract, ctx.contracts, errors, ctx.icons);
  const css = generateCss(contract, ctx.tokens, errors);
  if (errors.length > 0) {
    throw new Error(`Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return {
    tsx: generateTsx(contract, ctx.contracts, ctx.icons, css),
    css,
    stories: generateStories(contract, ctx.contracts),
  };
}
