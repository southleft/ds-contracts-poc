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

function validateContract(contract: Contract, errors: string[]) {
  const seen = new Set<string>();
  for (const { name, path: p, part } of walkAnatomy(contract)) {
    if (seen.has(name)) errors.push(`${contract.id}: duplicate anatomy part name "${name}"`);
    seen.add(name);
    if (p[0] !== 'root' || p.length > 1) {
      // substitution placeholders are only supported on the root part
      for (const ref of Object.values(part.tokens ?? {})) {
        if (placeholdersIn(stripBraces(ref)).length > 0) {
          errors.push(
            `${contract.id}: part "${name}" uses a {prop} substitution — only the root part supports substitutions`,
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
  }
  if (!contract.anatomy.root) errors.push(`${contract.id}: anatomy must have a "root" part`);
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
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      const refPath = stripBraces(ref);
      if (checkToken(refPath, `anatomy.${name}.tokens.${cssProp}`)) {
        decls.push(`${cssProp}: ${cssVar(refPath)}`);
      }
    }
    if ((part.tokens && ('border-width' in part.tokens || 'border-color' in part.tokens))) {
      decls.push('border-style: solid');
    }
    if (decls.length === 0) continue;
    lines.push('', `.${name} {`);
    for (const d of decls) lines.push(`  ${d};`);
    lines.push('}');
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
};

function depAttrString(dep: Contract, fixedProps: Record<string, string | boolean>): string {
  const parts: string[] = [];
  for (const [propName, value] of Object.entries(fixedProps)) {
    const depProp = dep.props.find((p) => p.name === propName);
    const codeName = depProp?.bindings.code.prop ?? propName;
    if (typeof value === 'boolean') parts.push(value ? ` ${codeName}` : '');
    else parts.push(` ${codeName}="${value}"`);
  }
  return parts.join('');
}

function generateTsx(contract: Contract, byId: Map<string, Contract>): string {
  const meta = ELEMENT_META[contract.semantics.element];
  const name = contract.name;
  const enums = enumProps(contract);
  const bools = boolProps(contract);
  const texts = namedTextProps(contract);
  const slots = namedSlots(contract);
  const deps = [
    ...new Set(
      walkAnatomy(contract)
        .filter((w) => w.part.component)
        .map((w) => byId.get(w.part.component!.id)!.name),
    ),
  ];

  const propLines: string[] = [];
  for (const p of contract.props) {
    const doc = p.description ? `  /** ${p.description} */\n` : '';
    if (isEnum(p)) {
      const union = p.type.enum.map((v) => `'${v}'`).join(' | ');
      propLines.push(`${doc}  ${p.bindings.code.prop}?: ${union};`);
    } else if (p.type === 'boolean') {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: boolean;`);
    } else if (p.bindings.code.prop !== 'children') {
      propLines.push(`${doc}  ${p.bindings.code.prop}${p.required ? '' : '?'}: string;`);
    }
  }
  for (const { slot, part } of slots) {
    const doc = part.description ? `  /** ${part.description} */\n` : '';
    propLines.push(`${doc}  ${slot.name}?: ReactNode;`);
  }

  const destructured: string[] = [];
  for (const p of enums) destructured.push(`${p.bindings.code.prop} = '${p.default}'`);
  for (const p of bools) destructured.push(`${p.bindings.code.prop} = ${p.default === true}`);
  for (const p of texts) {
    destructured.push(
      p.required || p.default === undefined
        ? p.bindings.code.prop
        : `${p.bindings.code.prop} = '${p.default}'`,
    );
  }
  for (const { slot } of slots) destructured.push(slot.name);
  destructured.push('className', 'children', '...rest');

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
    elementAttrs.push(`data-${p.name}={${p.bindings.code.prop} || undefined}`);
  }
  if (contract.semantics.role && contract.semantics.role !== contract.semantics.element) {
    elementAttrs.push(`role="${contract.semantics.role}"`);
  }
  elementAttrs.push('{...rest}');

  // Recursive JSX for the anatomy tree.
  const renderPart = (partName: string, part: Part): string => {
    if (part.component) {
      const dep = byId.get(part.component.id)!;
      const attrs = depAttrString(dep, part.component.props ?? {});
      const depChildren = textProps(dep).find((p) => p.bindings.code.prop === 'children');
      return typeof depChildren?.default === 'string'
        ? `<${dep.name}${attrs}>${depChildren.default}</${dep.name}>`
        : `<${dep.name}${attrs} />`;
    }
    if (part.slot) {
      const el = part.element ?? 'div';
      const expr = part.slot.name === 'children' ? 'children' : part.slot.name;
      const node = `<${el} className={styles.${partName}}>{${expr}}</${el}>`;
      return part.optional ? `{${expr} != null ? ${node} : null}` : node;
    }
    if (part.content) {
      const el = part.element ?? 'span';
      const prop = contract.props.find(
        (p) => p.type === 'text' && p.bindings.code.prop === part.content!.prop,
      )!;
      return `<${el} className={styles.${partName}}>{${prop.bindings.code.prop}}</${el}>`;
    }
    const el = part.element ?? 'div';
    const inner = Object.entries(part.parts ?? {})
      .map(([childName, child]) => renderPart(childName, child))
      .join('\n');
    return `<${el} className={styles.${partName}}>\n${inner}\n</${el}>`;
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
import { forwardRef } from 'react';
import type { ${typeImports} } from 'react';
${depImports}${depImports ? '\n' : ''}import styles from './${name}.module.css';

export interface ${name}Props extends ${meta.attrs}<${meta.el}> {
${propLines.join('\n')}
}

/** ${contract.description} */
export const ${name} = forwardRef<${meta.el}, ${name}Props>(function ${name}(
  { ${destructured.join(', ')} },
  ref,
) {
  const classes = [${classParts.join(', ')}].filter(Boolean).join(' ');
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

  const argTypes: string[] = [];
  const args: string[] = [];
  for (const p of contract.props) {
    const codeName = p.bindings.code.prop;
    const desc = p.description ? `, description: '${p.description.replace(/'/g, "\\'")}'` : '';
    if (isEnum(p)) {
      argTypes.push(
        `    ${codeName}: { control: 'select', options: [${p.type.enum.map((v) => `'${v}'`).join(', ')}]${desc} },`,
      );
      if (p.default !== undefined) args.push(`    ${codeName}: '${p.default}',`);
    } else if (p.type === 'boolean') {
      argTypes.push(`    ${codeName}: { control: 'boolean'${desc} },`);
      args.push(`    ${codeName}: ${p.default === true},`);
    } else {
      argTypes.push(`    ${codeName}: { control: 'text'${desc} },`);
      if (typeof p.default === 'string') args.push(`    ${codeName}: '${p.default}',`);
    }
  }
  for (const { slot } of slots) {
    argTypes.push(`    ${slot.name}: { control: false },`);
  }
  if (hasDefaultSlot) {
    argTypes.push(`    children: { control: 'text' },`);
    args.push(`    children: 'The quick brown fox jumps over the lazy dog.',`);
  }

  const variantStories =
    enums.length > 0
      ? enums[0].type.enum
          .map(
            (v) => `
export const ${pascal(v)}: Story = {
  args: { ${enums[0].bindings.code.prop}: '${v}' },
};`,
          )
          .join('\n')
      : '';

  // One story per constrained named slot, filled with a sample instance of
  // the first accepted contract.
  const slotSampleImports = new Set<string>();
  let slotStories = '';
  for (const { slot } of slots) {
    const acceptedId = slot.accepts?.[0];
    if (!acceptedId) continue;
    const dep = byId.get(acceptedId)!;
    slotSampleImports.add(dep.name);
    const depLabel = textDefault(dep);
    slotStories += `
/** The "${slot.name}" slot accepts: ${(slot.accepts ?? []).join(', ')}. */
export const With${pascal(slot.name)}: Story = {
  render: (args) => (
    <${name} {...args} ${slot.name}={<${dep.name}>${depLabel}</${dep.name}>} />
  ),
};`;
  }

  let matrixStory = '';
  if (enums.length > 0) {
    const rowProp = enums[0];
    const colProp = enums[1];
    const cells: string[] = [];
    for (const row of rowProp.type.enum) {
      const rowCells = (colProp ? colProp.type.enum : [null])
        .map((col) => {
          const attrs = [
            `${rowProp.bindings.code.prop}="${row}"`,
            ...(colProp && col ? [`${colProp.bindings.code.prop}="${col}"`] : []),
          ].join(' ');
          return `        <${name} ${attrs}>${label}</${name}>`;
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
  },
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

  const prettierBase = { singleQuote: true, printWidth: 100 };

  for (const contract of ordered) {
    validateContract(contract, errors);
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
