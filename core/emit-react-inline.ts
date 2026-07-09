/**
 * Contract → React with INLINE STYLES, token refs RESOLVED to literals — the
 * zero-infrastructure emitter for orgs without a token pipeline: no CSS
 * Modules, no custom properties, no stylesheet to include. Every color and
 * dimension is a literal resolved from the token source of truth at emit
 * time, so the output is copy-paste-runnable anywhere React runs.
 *
 * NOT wired into `npm run generate` — golden output is untouched. Receipts:
 * core/emitters-check.ts (npm run emitters:check) + core/samples/.
 *
 * Fidelity notes (deliberate, stated in every emitted file's header):
 *   · Resolution mode is named in the output (light default, dark selectable;
 *     brand: default) — an inline build is ONE theme by construction.
 *   · :hover / :focus-visible state tokens are not expressible as inline
 *     styles — omitted. Disabled-state tokens DO apply, via the disabled prop.
 *   · Animations (spinner/skeleton) ship as an embedded <style> keyframes
 *     block — the one thing inline style objects cannot carry.
 *   · Composition imports sibling inline-emitted components ('./Dep').
 */
import {
  pascal,
  resolveLayout,
  slotsOf,
  walkAnatomy,
  type Contract,
  type Part,
} from '../scripts/contract-schema.js';
import { flattenTokens, makeResolveLiteral, type TokenTreeInput } from './tokens.js';
import {
  arrayProps,
  boolProps,
  enumProps,
  isArrayType,
  isEnum,
  namedSlots,
  namedTextProps,
  numberProps,
  textProps,
  validateContract,
  ELEMENT_META,
} from './emit-react.js';

export interface EmitReactInlineCtx {
  /** Parsed DTCG trees — literals resolve through primitives + default brand
   *  + semantic + the selected mode. */
  tokens: TokenTreeInput;
  icons: Map<string, string>;
  contracts: Map<string, Contract>;
  /** Resolution mode for mode-scoped semantic tokens. Default: 'light'. */
  mode?: 'light' | 'dark';
}

export interface EmitReactInlineResult {
  tsx: string;
}

const ALIGN_CSS: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};
const JUSTIFY_CSS: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between',
};
const OVERLAY_CSS: Record<string, Record<string, string | number>> = {
  top: { bottom: '100%', left: 0 },
  bottom: { top: '100%', left: 0 },
  start: { right: '100%', top: 0 },
  end: { left: '100%', top: 0 },
};

const stripBraces = (ref: string) => ref.slice(1, -1);
const placeholdersIn = (refPath: string): string[] =>
  [...refPath.matchAll(/\{([a-z][\w-]*)\}/g)].map((m) => m[1]);
const camel = (cssProp: string) => cssProp.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const isStructural = (part: Part) =>
  Boolean(part.parts || part.slot || part.layout || part.layoutByProp) &&
  !part.content &&
  !part.component;

type StyleRecord = Record<string, string | number>;

export function emitReactInline(contract: Contract, ctx: EmitReactInlineCtx): EmitReactInlineResult {
  const errors: string[] = [];
  validateContract(contract, ctx.contracts, errors, ctx.icons);
  if (errors.length > 0) {
    throw new Error(`Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  const mode = ctx.mode ?? 'light';
  const primitives = flattenTokens(ctx.tokens.primitives);
  const semantic = flattenTokens(ctx.tokens.semantic);
  const modeTree = flattenTokens(mode === 'dark' ? ctx.tokens.dark : ctx.tokens.light);
  const brandDefault = ctx.tokens.brands.default ? flattenTokens(ctx.tokens.brands.default) : new Map();
  const resolveLiteral = makeResolveLiteral(
    new Map([...primitives, ...brandDefault, ...semantic, ...modeTree]),
  );
  const resolveValue = (tokenPath: string): string | number => {
    const v = resolveLiteral(tokenPath);
    return typeof v === 'number' ? v : String(v);
  };

  const name = contract.name;
  const enums = enumProps(contract);
  const bools = boolProps(contract);
  const events = contract.events ?? [];
  const codePropOf = (propName: string) =>
    contract.props.find((p) => p.name === propName)?.bindings.code.prop ?? propName;

  // -------------------------------------------------------------------------
  // Style compilation: base per part + per-enum-value overrides per part.
  // -------------------------------------------------------------------------
  const baseStyles: Record<string, StyleRecord> = {};
  /** `${prop}-${value}` → partName → overrides. */
  const variantStyles: Record<string, Record<string, StyleRecord>> = {};
  const partVariantProps = new Map<string, Set<string>>();
  const addVariant = (prop: string, value: string, partName: string, decls: StyleRecord) => {
    const key = `${prop}-${value}`;
    variantStyles[key] ??= {};
    variantStyles[key][partName] = { ...(variantStyles[key][partName] ?? {}), ...decls };
    if (!partVariantProps.has(partName)) partVariantProps.set(partName, new Set());
    partVariantProps.get(partName)!.add(prop);
  };
  /** Two-axis root tokens: overrides keyed by BOTH enum values (the runtime
   *  lookup consults `pa-va+pb-vb:part` after the single-axis keys, so the
   *  pair binding wins). */
  const variantPairStyles: Record<string, Record<string, StyleRecord>> = {};
  const partVariantPairProps = new Map<string, Set<string>>();
  const addVariantPair = (
    pa: string, va: string, pb: string, vb: string, partName: string, decls: StyleRecord,
  ) => {
    const key = `${pa}-${va}+${pb}-${vb}`;
    variantPairStyles[key] ??= {};
    variantPairStyles[key][partName] = { ...(variantPairStyles[key][partName] ?? {}), ...decls };
    if (!partVariantPairProps.has(partName)) partVariantPairProps.set(partName, new Set());
    partVariantPairProps.get(partName)!.add(`${pa}+${pb}`);
  };
  const enumsByName = new Map(enums.map((p) => [p.name, p.type.enum]));
  const usedAnimations = new Set<string>();

  const compilePart = (partName: string, part: Part, isRoot: boolean) => {
    const s: StyleRecord = {};
    if (isRoot) {
      if (part.layout) {
        s.display = part.layout.display ?? 'flex';
        if (part.layout.direction) s.flexDirection = part.layout.direction;
        if (part.layout.align) s.alignItems = ALIGN_CSS[part.layout.align];
        if (part.layout.justify) s.justifyContent = JUSTIFY_CSS[part.layout.justify];
      } else {
        s.display = 'inline-flex';
        s.alignItems = 'center';
        s.justifyContent = 'center';
      }
      const rootTokens = part.tokens ?? {};
      if ('border-width' in rootTokens || 'border-color' in rootTokens) s.borderStyle = 'solid';
      else s.border = 0;
      if ('max-width' in rootTokens) { s.width = '100%'; s.minWidth = 'fit-content'; }
      if (contract.semantics.element === 'button') s.cursor = 'pointer';
      if (walkAnatomy(contract).some((w) => w.part.overlay)) s.position = 'relative';
    } else {
      if (isStructural(part)) {
        s.display = part.layout?.display ?? 'flex';
        if (part.layout?.direction) s.flexDirection = part.layout.direction;
        if (part.layout?.align) s.alignItems = ALIGN_CSS[part.layout.align];
        if (part.layout?.justify) s.justifyContent = JUSTIFY_CSS[part.layout.justify];
      }
      if (part.layout?.grow) { s.flex = '1 1 auto'; s.minWidth = 0; }
      if (part.overlay) Object.assign(s, { position: 'absolute' }, OVERLAY_CSS[part.overlay.placement]);
      if (part.element === 'button' && events.some((e) => e.trigger === partName)) {
        Object.assign(s, {
          appearance: 'none', background: 'none', border: 'none', margin: 0, padding: 0,
          font: 'inherit', color: 'inherit', textAlign: 'inherit', cursor: 'pointer',
        });
      }
      if (part.icon) {
        s.display = 'inline-flex';
        s.flexShrink = 0;
        if (part.element === 'button') {
          Object.assign(s, {
            alignItems: 'center', justifyContent: 'center', background: 'none',
            border: 'none', padding: 0, color: 'inherit', cursor: 'pointer',
          });
        }
      }
      if (part.animation) {
        s.animation = part.animation === 'spin'
          ? `ds-inline-spin 0.8s linear infinite`
          : `ds-inline-pulse 1.6s ease-in-out infinite`;
        usedAnimations.add(part.animation);
      }
      if (part.tokens && ('border-width' in part.tokens || 'border-color' in part.tokens)) {
        s.borderStyle = 'solid';
      }
    }
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      const refPath = stripBraces(ref);
      if (cssProp === 'gap' && part.layout?.overlap) continue; // negative child margins — see note below
      const phs = placeholdersIn(refPath);
      if (phs.length === 0) {
        s[camel(cssProp)] = resolveValue(refPath);
      } else if (phs.length === 1) {
        for (const value of enumsByName.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          addVariant(phs[0], value, partName, { [camel(cssProp)]: resolveValue(resolved) });
        }
      } else if (phs.length === 2) {
        const [pa, pb] = phs;
        for (const a of enumsByName.get(pa) ?? []) {
          for (const b of enumsByName.get(pb) ?? []) {
            const resolved = refPath.replaceAll(`{${pa}}`, a).replaceAll(`{${pb}}`, b);
            addVariantPair(pa, a, pb, b, partName, { [camel(cssProp)]: resolveValue(resolved) });
          }
        }
      }
    }
    // layoutByProp: per-enum-value layout overrides merged over the base.
    if (part.layoutByProp) {
      for (const [value, _override] of Object.entries(part.layoutByProp.map)) {
        const merged = resolveLayout(part, { [part.layoutByProp.prop]: value });
        const decls: StyleRecord = {};
        if (merged?.display) decls.display = merged.display;
        if (merged?.direction) decls.flexDirection = merged.direction;
        if (merged?.align) decls.alignItems = ALIGN_CSS[merged.align];
        if (merged?.justify) decls.justifyContent = JUSTIFY_CSS[merged.justify];
        addVariant(part.layoutByProp.prop, value, partName, decls);
      }
    }
    baseStyles[partName] = s;
  };

  for (const { name: partName, part, path: p } of walkAnatomy(contract)) {
    if (part.component) continue; // instances style themselves via their own contract
    compilePart(partName, part, p[0] === 'root' && p.length === 1);
  }

  // Disabled-state tokens apply via the disabled prop (the one interaction
  // state a static style CAN honestly render). Non-substituted decls only.
  const disabledStyle: StyleRecord = {};
  if (bools.some((p) => p.name === 'disabled')) {
    for (const [cssProp, ref] of Object.entries(contract.anatomy.root.states?.disabled ?? {})) {
      const refPath = stripBraces(ref);
      if (placeholdersIn(refPath).length === 0 && !cssProp.startsWith('outline')) {
        disabledStyle[camel(cssProp)] = resolveValue(refPath);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Props interface + destructuring (same API surface as the CSS-Module emitter)
  // -------------------------------------------------------------------------
  const elementByProp = contract.semantics.elementByProp;
  const meta = elementByProp
    ? { attrs: 'HTMLAttributes', el: 'HTMLElement', supportsDisabled: false }
    : ELEMENT_META[contract.semantics.element];
  const slots = namedSlots(contract);
  const texts = namedTextProps(contract);
  const toggledCodeProps = new Set(events.filter((e) => e.toggles).map((e) => codePropOf(e.toggles!.prop)));

  const propLines: string[] = [];
  for (const p of contract.props) {
    const doc = p.description ? `  /** ${p.description} */\n` : '';
    if (isEnum(p)) {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: ${p.type.enum.map((v) => `'${v}'`).join(' | ')};`);
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
  for (const p of arrayProps(contract)) destructured.push(p.bindings.code.prop);
  for (const { slot } of slots) destructured.push(slot.name);
  for (const ev of events) destructured.push(ev.bindings.code.prop);
  destructured.push('style', 'children', '...rest');

  // Uncontrolled toggles + handlers — identical pattern to the CSS-Module emitter.
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

  const eventAttrsFor = (partName: string, partEl: string): string => {
    const ev = events.find((e) => e.trigger === partName);
    if (!ev) return '';
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

  // -------------------------------------------------------------------------
  // JSX — style={} expressions instead of className
  // -------------------------------------------------------------------------
  /** Which enum props override styles for a part (so lookups are only
   *  emitted where a variant actually changes something). */
  const variantPropsFor = (partName: string): string[] => [...(partVariantProps.get(partName) ?? [])];

  const styleExpr = (partName: string, isRoot: boolean, extra: string[] = []): string => {
    const pieces = [`...S.${partName}`];
    for (const propName of variantPropsFor(partName)) {
      pieces.push(`...(V[\`${propName}-\${${codePropOf(propName)}}:${partName}\`] ?? {})`);
    }
    for (const pair of partVariantPairProps.get(partName) ?? []) {
      const [pa, pb] = pair.split('+');
      pieces.push(
        `...(V[\`${pa}-\${${codePropOf(pa)}}+${pb}-\${${codePropOf(pb)}}:${partName}\`] ?? {})`,
      );
    }
    pieces.push(...extra);
    if (isRoot && Object.keys(disabledStyle).length > 0) {
      pieces.push(`...(${codePropOf('disabled')} ? DISABLED_STYLE : {})`);
    }
    if (isRoot) pieces.push('...style');
    return `{{ ${pieces.join(', ')} }}`;
  };

  const stylesWhenExprs = (part: Part): string[] => {
    const out: string[] = [];
    for (const sw of part.stylesWhen ?? []) {
      const prop = contract.props.find((pr) => pr.name === sw.prop);
      if (!prop) continue;
      const styles = Object.fromEntries(Object.entries(sw.styles).map(([kk, v]) => [camel(kk), v]));
      const cond = isEnum(prop)
        ? `${codePropOf(sw.prop)} === '${sw.equals}'`
        : codePropOf(sw.prop);
      out.push(`...(${cond} ? ${JSON.stringify(styles)} : {})`);
    }
    return out;
  };

  const wrapVisibleWhen = (part: Part, jsx: string): string => {
    if (!part.visibleWhen) return jsx;
    const codeName = codePropOf(part.visibleWhen.prop);
    const cond =
      part.visibleWhen.equals !== undefined ? `${codeName} === '${part.visibleWhen.equals}'` : codeName;
    return `{${cond} ? (${jsx}) : null}`;
  };

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

  // Icon assets (fixed names + enum expansions), same table as the CSS-Module emitter.
  const neededIcons = new Map<string, string>();
  for (const { part } of walkAnatomy(contract)) {
    if (!part.icon) continue;
    const m = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
    if (m) {
      const enumProp = contract.props.find((p) => p.name === m[1]);
      if (enumProp && isEnum(enumProp)) {
        for (const v of enumProp.type.enum) neededIcons.set(v, ctx.icons.get(v) ?? '');
      }
    } else {
      neededIcons.set(part.icon.asset, ctx.icons.get(part.icon.asset) ?? '');
    }
  }

  const deps = [
    ...new Set(
      walkAnatomy(contract)
        .filter((w) => w.part.component)
        .map((w) => ctx.contracts.get(w.part.component!.id)!.name),
    ),
  ];

  const depAttrString = (dep: Contract, fixedProps: Record<string, string | boolean>): string => {
    const parts: string[] = [];
    for (const [propName, value] of Object.entries(fixedProps)) {
      const depProp = dep.props.find((p) => p.name === propName);
      const codeName = depProp?.bindings.code.prop ?? propName;
      if (typeof value === 'boolean') {
        parts.push(value ? ` ${codeName}` : '');
        continue;
      }
      const parentRef = value.match(/^\{([a-z][\w-]*)\}$/);
      if (parentRef) {
        const parentProp = contract.props.find((p) => p.name === parentRef[1]);
        parts.push(` ${codeName}={${parentProp?.bindings.code.prop ?? parentRef[1]}}`);
      } else {
        parts.push(` ${codeName}="${value}"`);
      }
    }
    return parts.join('');
  };

  const renderPart = (partName: string, part: Part): string => {
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const keyExpr = ref ? codePropOf(ref[1]) : JSON.stringify(part.icon.asset);
      const glyph = `dangerouslySetInnerHTML={{ __html: ICONS[${keyExpr}] }}`;
      const node = part.element
        ? `<${part.element} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}${eventAttrsFor(partName, part.element)}><span aria-hidden="true" style={{ display: 'inline-flex' }} ${glyph} /></${part.element}>`
        : `<span style=${styleExpr(partName, false, stylesWhenExprs(part))} aria-hidden="true" ${glyph} />`;
      return wrapVisibleWhen(part, node);
    }
    if (part.component) {
      const dep = ctx.contracts.get(part.component.id)!;
      const attrs = depAttrString(dep, part.component.props ?? {});
      const depChildren = textProps(dep).find((p) => p.bindings.code.prop === 'children');
      const text = part.component.text ?? (typeof depChildren?.default === 'string' ? depChildren.default : undefined);
      return text !== undefined
        ? `<${dep.name}${attrs}>${text}</${dep.name}>`
        : `<${dep.name}${attrs} />`;
    }
    if (part.slot) {
      const el = part.element ?? 'div';
      const expr = part.slot.name === 'children' ? 'children' : part.slot.name;
      const node = `<${el} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}>{${expr}}</${el}>`;
      return part.optional ? `{${expr} != null ? ${node} : null}` : wrapVisibleWhen(part, node);
    }
    if (part.content) {
      const el = part.element ?? 'span';
      const prop = contract.props.find(
        (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
      )!;
      return wrapVisibleWhen(
        part,
        `<${el} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}${eventAttrsFor(partName, el)}>{${prop.bindings.code.prop}}</${el}>`,
      );
    }
    if (part.text !== undefined) {
      const el = part.element ?? 'span';
      return wrapVisibleWhen(
        part,
        `<${el} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}>${part.text}</${el}>`,
      );
    }
    if (part.meter) {
      const v = codePropOf(part.meter.valueProp);
      const m = codePropOf(part.meter.maxProp);
      return wrapVisibleWhen(
        part,
        `<div style=${styleExpr(partName, false, [`width: \`\${Math.min(100, Math.max(0, (${v} / ${m}) * 100))}%\``])} />`,
      );
    }
    const el = part.element ?? 'div';
    const inner = Object.entries(part.parts ?? {})
      .map(([childName, child]) => renderPart(childName, child))
      .join('\n');
    return wrapVisibleWhen(
      part,
      `<${el} style=${styleExpr(partName, false, stylesWhenExprs(part))}${partAttrString(part)}${eventAttrsFor(partName, el)}>\n${inner}\n</${el}>`,
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

  const nativeDisabled = meta.supportsDisabled && bools.some((p) => p.name === 'disabled');
  const elementAttrs: string[] = ['ref={ref}', `style=${styleExpr('root', true, stylesWhenExprs(root))}`];
  if (nativeDisabled) elementAttrs.push('disabled={disabled}');
  for (const p of bools) {
    if (p.name === 'disabled' && nativeDisabled) continue;
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
  let elementMapConst = '';
  if (elementByProp) {
    elementMapConst = `const ELEMENT_MAP: Record<string, ElementType> = ${JSON.stringify(elementByProp.map)};\n\n`;
  }
  const rootEvent = events.find((e) => e.trigger === 'root');
  if (rootEvent) elementAttrs.push(`onClick={handle${pascal(rootEvent.name)}}`);
  elementAttrs.push('{...rest}');

  // Flatten variant styles into a single lookup: `${prop}-${value}:${part}`.
  const variantFlat: Record<string, StyleRecord> = {};
  for (const [key, parts] of Object.entries({ ...variantStyles, ...variantPairStyles })) {
    for (const [partName, decls] of Object.entries(parts)) {
      variantFlat[`${key}:${partName}`] = decls;
    }
  }

  const iconsConst =
    neededIcons.size > 0
      ? `const ICONS: Record<string, string> = {\n${[...neededIcons.entries()]
          .map(([kk, v]) => `  ${JSON.stringify(kk)}: ${JSON.stringify(v)},`)
          .join('\n')}\n};\n\n`
      : '';
  const keyframes: string[] = [];
  if (usedAnimations.has('spin')) keyframes.push('@keyframes ds-inline-spin { to { transform: rotate(360deg); } }');
  if (usedAnimations.has('pulse')) keyframes.push('@keyframes ds-inline-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }');
  const keyframesConst = keyframes.length > 0 ? `const KEYFRAMES = ${JSON.stringify(keyframes.join('\n'))};\n\n` : '';
  const keyframesNode = keyframes.length > 0 ? `<style>{KEYFRAMES}</style>\n      ` : '';

  const typeImports = [
    'CSSProperties',
    meta.attrs,
    ...(slots.length > 0 ? ['ReactNode'] : []),
    ...(elementByProp ? ['ElementType'] : []),
  ].join(', ');
  const depImports = deps.map((depName) => `import { ${depName} } from './${depName}';`).join('\n');

  const overlapNote = walkAnatomy(contract).some((w) => w.part.layout?.overlap && w.part.tokens?.gap)
    ? `\n * Fidelity: the overlap gap (negative child margins) needs a child selector — not\n * expressible inline; children render without the overlap offset.`
    : '';

  const tsx = `/**
 * GENERATED FILE (inline-styles emitter) — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json (${contract.id} v${contract.version})
 * Emitted by core/emit-react-inline.ts — the zero-infrastructure output:
 * every token reference was RESOLVED to its literal value from the design
 * tokens at emit time. Resolution mode: ${mode} (brand: default). To retheme,
 * re-emit against different tokens — do not edit literals by hand.
 * Fidelity: :hover/:focus-visible state tokens are not expressible as inline
 * styles and are omitted; disabled-state tokens apply via the disabled prop.${overlapNote}
 */
import { forwardRef${events.some((e) => e.toggles) ? ', useState' : ''} } from 'react';
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}
${iconsConst}${roleMapConst}${elementMapConst}${keyframesConst}const S: Record<string, CSSProperties> = ${JSON.stringify(baseStyles, null, 2)};

/** Per-variant overrides, resolved per enum value: "prop-value:part" → styles. */
const V: Record<string, CSSProperties> = ${JSON.stringify(variantFlat, null, 2)};
${Object.keys(disabledStyle).length > 0 ? `\nconst DISABLED_STYLE: CSSProperties = ${JSON.stringify(disabledStyle)};\n` : ''}
export interface ${name}Props extends ${meta.attrs}<${meta.el}> {
${propLines.join('\n')}
}

/** ${contract.description} */
export const ${name} = forwardRef<${meta.el}, ${name}Props>(function ${name}(
  { ${destructured.join(', ')} },
  ref,
) {
${prelude.length > 0 ? prelude.join('\n') + '\n' : ''}  return (
    <${el} ${elementAttrs.join(' ')}>
      ${keyframesNode}${rootInner}
    </${el}>
  );
});
`;
  return { tsx };
}
