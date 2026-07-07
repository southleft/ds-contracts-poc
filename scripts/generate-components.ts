/**
 * Contract → code generator. (v2 — composition)
 *
 * Reads every contracts/*.contract.json, validates it against the Zod schema,
 * verifies every token reference (after `{prop}` substitution expansion)
 * resolves to a real token in tokens/ — the contract↔token integrity gate —
 * validates the composition graph (no cycles, no unknown contract refs),
 * then emits, per component:
 *
 *   src/components/<Name>/<Name>.tsx           React component
 *   src/components/<Name>/<Name>.module.css    styles from anatomy token bindings
 *   src/components/<Name>/<Name>.stories.tsx   CSF3 stories (argTypes from contract)
 *   src/components/<Name>/index.ts             re-export
 *
 * Composition semantics (see docs/02 + docs/08):
 *   - anatomy is a nested tree; each part becomes a class-named element
 *   - `component` parts render fixed instances of other contracts (imported)
 *   - `slot` parts render {children} (name "children") or a ReactNode prop
 *   - `content` parts render a bound text prop
 *   - optional parts render conditionally on their slot prop
 *
 * Generated files are never edited by hand. To change a component, change
 * its contract and re-run `npm run generate`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';
import {
  ContractSchema,
  pascal,
  slotsOf,
  sortByDependencies,
  walkAnatomy,
  type Contract,
  type Part,
  type Prop,
} from './contract-schema.js';

const ROOT = process.cwd();
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const TOKENS_DIR = path.join(ROOT, 'tokens');
const OUT_DIR = path.join(ROOT, 'src', 'components');

// ---------------------------------------------------------------------------
// Token inventory (for validating contract token references)
// ---------------------------------------------------------------------------

function collectTokenPaths(node: unknown, prefix: string[], out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value) out.add([...prefix, key].join('.'));
      else collectTokenPaths(value, [...prefix, key], out);
    }
  }
}

/** Icon assets are SOURCE (like tokens): assets/icons/<name>.svg, inlined by
 *  the generator on the code side and rendered as vectors in Figma. */
function loadIconAssets(): Map<string, string> {
  try {
    return new Map(
      readdirSync(path.join(ROOT, 'assets', 'icons'))
        .filter((f) => f.endsWith('.svg'))
        .map((f) => [
          f.replace(/\.svg$/, ''),
          readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim(),
        ]),
    );
  } catch {
    return new Map();
  }
}
const iconAssets = loadIconAssets();

function loadTokenInventory(): Set<string> {
  const files = [
    path.join(TOKENS_DIR, 'primitives.tokens.json'),
    path.join(TOKENS_DIR, 'semantic.tokens.json'),
    path.join(TOKENS_DIR, 'modes', 'semantic.light.tokens.json'),
    path.join(TOKENS_DIR, 'modes', 'semantic.dark.tokens.json'),
  ];
  const paths = new Set<string>();
  for (const file of files) {
    collectTokenPaths(JSON.parse(readFileSync(file, 'utf8')), [], paths);
  }
  return paths;
}

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
  'focus-visible': ':focus-visible',
  disabled: ':disabled',
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

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

function enumProps(contract: Contract) {
  return contract.props.filter(isEnum);
}
function boolProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'boolean');
}
function numberProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'number');
}
function textProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'text');
}
function namedTextProps(contract: Contract) {
  return textProps(contract).filter((p) => p.bindings.code.prop !== 'children');
}
function namedSlots(contract: Contract) {
  return slotsOf(contract).filter((s) => s.slot.name !== 'children');
}
function textDefault(contract: Contract): string {
  const text = textProps(contract).find((p) => p.bindings.code.prop === 'children');
  return typeof text?.default === 'string' ? text.default : contract.name;
}

const isStructural = (part: Part) =>
  Boolean(part.parts || part.slot || part.layout) && !part.content && !part.component;

// ---------------------------------------------------------------------------
// Contract-level validation (beyond the Zod schema)
// ---------------------------------------------------------------------------

function validateContract(contract: Contract, byId: Map<string, Contract>, errors: string[]) {
  const enumNames = new Set(enumProps(contract).map((p) => p.name));
  const hasChildrenText = (dep: Contract) =>
    dep.props.some((p) => p.type === 'text' && p.bindings.code.prop === 'children');
  const seen = new Set<string>();
  for (const { name, path: p, part } of walkAnatomy(contract)) {
    if (seen.has(name)) errors.push(`${contract.id}: duplicate anatomy part name "${name}"`);
    seen.add(name);
    if (part.component) {
      const dep = byId.get(part.component.id);
      for (const [propName, value] of Object.entries(part.component.props ?? {})) {
        if (dep && !dep.props.some((dp) => dp.name === propName)) {
          errors.push(`${contract.id}: part "${name}" sets unknown ${dep.id} prop "${propName}"`);
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
    if (part.visibleWhen) {
      const vwProp = contract.props.find((pr) => pr.name === part.visibleWhen!.prop);
      if (!vwProp) {
        errors.push(`${contract.id}: part "${name}" visibleWhen references unknown prop "${part.visibleWhen.prop}"`);
      } else if (part.visibleWhen.equals !== undefined && !(typeof vwProp.type === 'object' && vwProp.type.enum.includes(part.visibleWhen.equals))) {
        errors.push(`${contract.id}: part "${name}" visibleWhen.equals "${part.visibleWhen.equals}" is not a value of prop "${part.visibleWhen.prop}"`);
      }
    }
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const assets = ref
        ? (() => {
            const p = contract.props.find((pr) => pr.name === ref[1]);
            return p && typeof p.type === 'object' ? p.type.enum : [];
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
  for (const p of contract.props) {
    if (seenPropNames.has(p.name)) {
      errors.push(`${contract.id}: duplicate prop name "${p.name}"`);
    }
    seenPropNames.add(p.name);
    if (!/^[a-z][A-Za-z0-9]*$/.test(p.bindings.code.prop)) {
      errors.push(`${contract.id}: prop "${p.name}" code binding "${p.bindings.code.prop}" is not a legal camelCase identifier`);
    }
    const figProp = p.bindings.figma.property;
    if (seenFigmaProps.has(figProp)) {
      errors.push(`${contract.id}: two props bind the same design property "${figProp}" — the canvas cannot host both`);
    }
    seenFigmaProps.add(figProp);
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
    if (contract.props.some((p) => p.bindings.code.prop === codeProp)) {
      errors.push(`${contract.id}: event "${ev.name}" code prop "${codeProp}" collides with a data prop`);
    }
    const trigger = partByName.get(ev.trigger);
    if (!trigger) {
      errors.push(`${contract.id}: event "${ev.name}" trigger references unknown part "${ev.trigger}"`);
    } else if (ev.trigger !== 'root' && trigger.element !== 'button') {
      // Interactivity must be honest: a clickable part is a <button> so
      // keyboard activation comes from the platform, not a bolted-on handler.
      errors.push(
        `${contract.id}: event "${ev.name}" trigger part "${ev.trigger}" must have element "button" (got "${trigger.element ?? 'div'}")`,
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
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

function generateCss(contract: Contract, tokenInventory: Set<string>, errors: string[]): string {
  const enums = new Map(enumProps(contract).map((p) => [p.name, p.type.enum]));
  const lines: string[] = [
    `/* GENERATED FILE — DO NOT EDIT.`,
    ` * Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})`,
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

  const enumRules = new Map<string, Map<string, string>>(); // class → decls
  const stateRules: string[] = [];

  for (const [cssProp, ref] of Object.entries(rootTokens)) {
    const refPath = stripBraces(ref);
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
    } else {
      errors.push(`${contract.id}: root token "${cssProp}" uses multiple substitutions (max 1)`);
    }
  }

  lines.push('', '.root {');
  for (const d of rootDecls) lines.push(`  ${d};`);
  lines.push('}');

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
      if (cssProp === 'gap' && part.layout?.overlap) {
        if (checkToken(refPath, `anatomy.${name}.tokens.gap`)) {
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

const ELEMENT_META: Record<string, { attrs: string; el: string; supportsDisabled: boolean }> = {
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
function sampleJSX(
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

function generateTsx(contract: Contract, byId: Map<string, Contract>): string {
  const meta = ELEMENT_META[contract.semantics.element];
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

  /** onClick + ARIA state for a part that is an event trigger. */
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
        if (ref) return ` ${attr}={${codePropOf(ref[1])}}`;
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
        ? `<${part.element} className={styles.${partName}}${partAttrString(part)}${eventAttrsFor(partName, part.element)}><span aria-hidden="true" className={styles.${partName}Glyph} ${glyph} /></${part.element}>`
        : `<span className={styles.${partName}} aria-hidden="true" ${glyph} />`;
      return wrapVisibleWhen(part, node);
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
        `<${el} className={styles.${partName}}${partAttrString(part)}${eventAttrsFor(partName, el)}>{${prop.bindings.code.prop}}</${el}>`,
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
      `<${el} className={styles.${partName}}${partAttrString(part)}${eventAttrsFor(partName, el)}>\n${inner}\n</${el}>`,
    );
  };

  const root = contract.anatomy.root;
  const rootInner = root.parts
    ? Object.entries(root.parts)
        .map(([childName, child]) => renderPart(childName, child))
        .join('\n')
    : '{children}';

  const el = contract.semantics.element;
  const typeImports = [meta.attrs, ...(slots.length > 0 ? ['ReactNode'] : [])].join(', ');
  const depImports = deps
    .map((depName) => `import { ${depName} } from '../${depName}';`)
    .join('\n');

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 */
import { forwardRef${events.some((e) => e.toggles) ? ', useState' : ''} } from 'react';
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}import styles from './${name}.module.css';

${iconsConst}${roleMapConst}export interface ${name}Props extends ${meta.attrs}<${meta.el}> {
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

function generateStories(contract: Contract, byId: Map<string, Contract>): string {
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
            const storyName = pascal(v) === name ? `${pascal(v)}Variant` : pascal(v);
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
    const rowProp = enums[0];
    const colProp = enums[1];
    // Required text props must appear in every cell or the story won't typecheck.
    const requiredTextAttrs = contract.props
      .filter((p) => p.type === 'text' && p.required && typeof p.default === 'string')
      .map((p) => `${p.bindings.code.prop}="${p.default}"`);
    const cells: string[] = [];
    for (const row of rowProp.type.enum) {
      const rowCells = (colProp ? colProp.type.enum : [null])
        .map((col) => {
          const attrs = [
            `${rowProp.bindings.code.prop}="${row}"`,
            ...(colProp && col ? [`${colProp.bindings.code.prop}="${col}"`] : []),
            ...requiredTextAttrs,
          ].join(' ');
          return hasDefaultSlot
            ? `        <${name} ${attrs}>${label}</${name}>`
            : `        <${name} ${attrs} />`;
        })
        .join('\n');
      cells.push(rowCells);
    }
    const columns = colProp ? colProp.type.enum.length : 1;
    matrixStory = `
/** Every legal combination the contract defines${colProp ? ` (${rowProp.name} × ${colProp.name})` : ''}. */
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
 * Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  const tokenInventory = loadTokenInventory();
  const contractFiles = readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.contract.json'));
  const errors: string[] = [];
  const generated: string[] = [];

  const parsedContracts: Contract[] = [];
  for (const file of contractFiles) {
    const raw = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, file), 'utf8'));
    const parsed = ContractSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(
        `${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
      continue;
    }
    parsedContracts.push(parsed.data);
  }

  // Identity gates: contract ids and names must be unique across the set —
  // a duplicate id silently forks identity in the dependency map; a
  // duplicate name silently clobbers the other contract's generated output.
  const seenIds = new Map<string, string>();
  const seenNames = new Map<string, string>();
  for (const c of parsedContracts) {
    if (seenIds.has(c.id)) {
      errors.push(`${c.id}: duplicate contract id (also declared by "${seenIds.get(c.id)}")`);
    }
    seenIds.set(c.id, c.name);
    if (seenNames.has(c.name)) {
      errors.push(`${c.id}: duplicate contract name "${c.name}" (also used by ${seenNames.get(c.name)}) — would overwrite src/components/${c.name}/`);
    }
    seenNames.set(c.name, c.id);
  }

  // Composition graph gate: cycles and unknown refs are refused.
  let ordered: Contract[] = parsedContracts;
  if (errors.length === 0) {
    try {
      ordered = sortByDependencies(parsedContracts);
    } catch (err) {
      errors.push(String(err instanceof Error ? err.message : err));
    }
  }
  const byId = new Map(parsedContracts.map((c) => [c.id, c]));

  // Fail fast on parse/identity/graph errors: a refused contract leaves
  // dangling refs in byId, and generating dependents against a broken map
  // crashes with an unnamed TypeError INSTEAD of the named refusal — the
  // exact opposite of C2. Name the violations and stop.
  if (errors.length > 0) {
    console.error(`✘ Refused — ${errors.length} contract violation(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const prettierBase = { singleQuote: true, printWidth: 100 };

  for (const contract of ordered) {
    validateContract(contract, byId, errors);
    if (errors.length > 0 && errors.some((e) => e.startsWith(contract.id))) continue;

    const css = generateCss(contract, tokenInventory, errors);
    if (errors.some((e) => e.startsWith(contract.id))) continue;

    const dir = path.join(OUT_DIR, contract.name);
    mkdirSync(dir, { recursive: true });

    writeFileSync(
      path.join(dir, `${contract.name}.module.css`),
      await prettier.format(css, { ...prettierBase, parser: 'css' }),
    );
    writeFileSync(
      path.join(dir, `${contract.name}.tsx`),
      await prettier.format(generateTsx(contract, byId), { ...prettierBase, parser: 'typescript' }),
    );
    writeFileSync(
      path.join(dir, `${contract.name}.stories.tsx`),
      await prettier.format(generateStories(contract, byId), {
        ...prettierBase,
        parser: 'typescript',
      }),
    );
    writeFileSync(
      path.join(dir, 'index.ts'),
      `export { ${contract.name} } from './${contract.name}';\nexport type { ${contract.name}Props } from './${contract.name}';\n`,
    );
    generated.push(contract.name);
  }

  if (errors.length > 0) {
    console.error('✖ Contract validation failed:\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, 'index.ts'),
    generated
      .sort()
      .map((n) => `export * from './${n}';`)
      .join('\n') + '\n',
  );

  console.log(`✔ Generated ${generated.length} component(s) from contracts: ${generated.sort().join(', ')}`);
}

await main();
