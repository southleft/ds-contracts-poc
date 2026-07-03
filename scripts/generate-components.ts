/**
 * Contract → code generator.
 *
 * Reads every contracts/*.contract.json, validates it against the Zod schema,
 * verifies every token reference (after `{prop}` substitution expansion)
 * resolves to a real token in tokens/ — the contract↔token integrity gate —
 * then emits, per component:
 *
 *   src/components/<Name>/<Name>.tsx           React component
 *   src/components/<Name>/<Name>.module.css    styles from anatomy token bindings
 *   src/components/<Name>/<Name>.stories.tsx   CSF3 stories (argTypes from contract)
 *   src/components/<Name>/index.ts             re-export
 *
 * Generated files are never edited by hand. To change a component, change
 * its contract and re-run `npm run generate`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';
import { ContractSchema, type Contract, type Prop } from './contract-schema.js';

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
// Token reference expansion
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

interface CssRule {
  selector: string;
  decls: Map<string, string>;
}

function addDecl(rules: Map<string, CssRule>, selector: string, prop: string, value: string) {
  let rule = rules.get(selector);
  if (!rule) {
    rule = { selector, decls: new Map() };
    rules.set(selector, rule);
  }
  rule.decls.set(prop, value);
}

// ---------------------------------------------------------------------------
// Contract helpers
// ---------------------------------------------------------------------------

const ELEMENT_META: Record<
  Contract['semantics']['element'],
  { attrs: string; el: string; supportsDisabled: boolean }
> = {
  button: { attrs: 'ButtonHTMLAttributes', el: 'HTMLButtonElement', supportsDisabled: true },
  span: { attrs: 'HTMLAttributes', el: 'HTMLSpanElement', supportsDisabled: false },
  div: { attrs: 'HTMLAttributes', el: 'HTMLDivElement', supportsDisabled: false },
  a: { attrs: 'AnchorHTMLAttributes', el: 'HTMLAnchorElement', supportsDisabled: false },
  input: { attrs: 'InputHTMLAttributes', el: 'HTMLInputElement', supportsDisabled: true },
};

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function enumProps(contract: Contract) {
  return contract.props.filter(isEnum);
}

function boolProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'boolean');
}

function textDefault(contract: Contract): string {
  const text = contract.props.find((p) => p.type === 'text');
  return typeof text?.default === 'string' ? text.default : contract.name;
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

function generateCss(contract: Contract, tokenInventory: Set<string>, errors: string[]): string {
  const rules = new Map<string, CssRule>();
  const enums = new Map(enumProps(contract).map((p) => [p.name, p.type.enum]));

  const resolveRef = (
    cssProp: string,
    ref: string,
    stateSelector: string | null,
    context: string,
  ) => {
    const refPath = stripBraces(ref);
    const phs = placeholdersIn(refPath);

    const emit = (selectorBase: string, resolvedPath: string) => {
      if (!tokenInventory.has(resolvedPath)) {
        errors.push(
          `${contract.id}: ${context} references token "{${resolvedPath}}" which does not exist in tokens/`,
        );
        return;
      }
      const selector = stateSelector ? `${selectorBase}${stateSelector}` : selectorBase;
      addDecl(rules, selector, cssProp, cssVar(resolvedPath));
    };

    if (phs.length === 0) {
      emit('.root', refPath);
    } else if (phs.length === 1) {
      const propName = phs[0];
      const values = enums.get(propName);
      if (!values) {
        errors.push(
          `${contract.id}: ${context} substitutes "{${propName}}" but no enum prop "${propName}" exists`,
        );
        return;
      }
      for (const value of values) {
        emit(`.${propName}-${value}`, refPath.replaceAll(`{${propName}}`, value));
      }
    } else {
      errors.push(
        `${contract.id}: ${context} uses ${phs.length} substitutions — phase 1 supports at most one per reference`,
      );
    }
  };

  for (const [partName, part] of Object.entries(contract.anatomy)) {
    if (partName !== 'root') continue; // phase 1: styled anatomy is the root part; slots render children
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      resolveRef(cssProp, ref, null, `anatomy.${partName}.tokens.${cssProp}`);
    }
    for (const [state, decls] of Object.entries(part.states ?? {})) {
      const stateSelector = STATE_SELECTORS[state];
      if (!stateSelector) {
        errors.push(`${contract.id}: unknown state "${state}"`);
        continue;
      }
      for (const [cssProp, ref] of Object.entries(decls)) {
        resolveRef(cssProp, ref, stateSelector, `anatomy.${partName}.states.${state}.${cssProp}`);
      }
    }
  }

  // Static base declarations the contract does not (yet) govern.
  // Candidate for a contract `layout` block in a future schema version.
  const staticBase: string[] = [
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'border: 0',
  ];
  if (contract.semantics.element === 'button') staticBase.push('cursor: pointer');

  const lines: string[] = [];
  lines.push(`/* GENERATED FILE — DO NOT EDIT.`);
  lines.push(` * Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})`);
  lines.push(` * Regenerate with: npm run generate`);
  lines.push(` */`);
  lines.push('');

  const rootRule = rules.get('.root');
  lines.push('.root {');
  for (const decl of staticBase) lines.push(`  ${decl};`);
  for (const [prop, value] of rootRule?.decls ?? []) lines.push(`  ${prop}: ${value};`);
  lines.push('}');

  if (contract.states.includes('focus-visible')) {
    lines.push('');
    lines.push('.root:focus-visible {');
    lines.push('  outline-style: solid;');
    lines.push('  outline-offset: 2px;');
    lines.push('}');
  }
  if (contract.states.includes('disabled') && contract.semantics.element === 'button') {
    lines.push('');
    lines.push('.root:disabled {');
    lines.push('  cursor: not-allowed;');
    lines.push('}');
  }

  for (const [selector, rule] of rules) {
    if (selector === '.root') continue;
    lines.push('');
    lines.push(`${selector} {`);
    for (const [prop, value] of rule.decls) lines.push(`  ${prop}: ${value};`);
    lines.push('}');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Component (.tsx) generation
// ---------------------------------------------------------------------------

function generateTsx(contract: Contract): string {
  const meta = ELEMENT_META[contract.semantics.element];
  const name = contract.name;
  const enums = enumProps(contract);
  const bools = boolProps(contract);

  const propLines: string[] = [];
  for (const p of contract.props) {
    if (p.type === 'text') continue; // text props map to `children`, provided by the base attributes
    const doc = p.description ? `  /** ${p.description} */\n` : '';
    if (isEnum(p)) {
      const union = p.type.enum.map((v) => `'${v}'`).join(' | ');
      propLines.push(`${doc}  ${p.bindings.code.prop}?: ${union};`);
    } else if (p.type === 'boolean') {
      propLines.push(`${doc}  ${p.bindings.code.prop}?: boolean;`);
    }
  }

  const destructured: string[] = [];
  for (const p of enums) {
    destructured.push(`${p.bindings.code.prop} = '${p.default}'`);
  }
  for (const p of bools) {
    destructured.push(`${p.bindings.code.prop} = ${p.default === true}`);
  }
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

  const el = contract.semantics.element;

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { ${meta.attrs} } from 'react';
import styles from './${name}.module.css';

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
      {children}
    </${el}>
  );
});
`;
}

// ---------------------------------------------------------------------------
// Stories (.stories.tsx) generation
// ---------------------------------------------------------------------------

function generateStories(contract: Contract): string {
  const name = contract.name;
  const enums = enumProps(contract);
  const bools = boolProps(contract);
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
      args.push(`    ${codeName}: '${label}',`);
    }
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

  // Matrix: rows = first enum prop, columns = second enum prop (if present).
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

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/${contract.id.replace('ds.', '')}.contract.json (${contract.id} v${contract.version})
 * Regenerate with: npm run generate
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ${name} } from './${name}';

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
${variantStories}${disabledStory}${matrixStory}
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

  const prettierBase = { singleQuote: true, printWidth: 100 };

  for (const file of contractFiles) {
    const raw = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, file), 'utf8'));
    const parsed = ContractSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const contract = parsed.data;
    const name = contract.name;

    const css = generateCss(contract, tokenInventory, errors);
    if (errors.length > 0 && errors.some((e) => e.startsWith(contract.id))) continue;

    const dir = path.join(OUT_DIR, name);
    mkdirSync(dir, { recursive: true });

    writeFileSync(
      path.join(dir, `${name}.module.css`),
      await prettier.format(css, { ...prettierBase, parser: 'css' }),
    );
    writeFileSync(
      path.join(dir, `${name}.tsx`),
      await prettier.format(generateTsx(contract), { ...prettierBase, parser: 'typescript' }),
    );
    writeFileSync(
      path.join(dir, `${name}.stories.tsx`),
      await prettier.format(generateStories(contract), { ...prettierBase, parser: 'typescript' }),
    );
    writeFileSync(
      path.join(dir, 'index.ts'),
      `export { ${name} } from './${name}';\nexport type { ${name}Props } from './${name}';\n`,
    );
    generated.push(name);
  }

  if (errors.length > 0) {
    console.error('✖ Contract validation failed:\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  // Barrel
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, 'index.ts'),
    generated
      .sort()
      .map((n) => `export * from './${n}';`)
      .join('\n') + '\n',
  );

  console.log(`✔ Generated ${generated.length} component(s) from contracts: ${generated.join(', ')}`);
}

await main();
