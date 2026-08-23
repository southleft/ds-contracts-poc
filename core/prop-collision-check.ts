/**
 * Prop-collision + per-contract batch receipts — `npx tsx core/prop-collision-check.ts`.
 *
 * Pins two phase-2 exam defects (parity/receipts/phase-2/FIGMA-DS-EXAM.md §3):
 *
 *   A. A contract prop named like a DOM attribute React types on the root
 *      (`content`, `title`, `hidden`…) made the emitted Props interface
 *      un-typecheckable (TS2430 on the exam's Card). The rule lives in
 *      packages/core/src/prop-collision.ts; here a fixture carrying `content` (slot),
 *      `title` (text) and `hidden` (boolean) on a <div> root is emitted on
 *      react + react-inline + web-components and TYPE-CHECKED in scratch
 *      with the repo's tsconfig flags (tsc in-process). A negative control
 *      re-checks the same react file with the `Omit<…>` spelled back to the
 *      plain base type and asserts TS2430 — the omission is load-bearing,
 *      not decorative.
 *
 *   B. The collision table (packages/core/src/prop-collision.table.ts) is EXTRACTED from
 *      the installed @types/react and typescript lib.dom — never hand-listed.
 *      `--update` rewrites it; without the flag a drifted table refuses by
 *      name.
 *
 *   C. `generate` over a directory refused the WHOLE batch when ONE contract
 *      failed validation (the exam: Section Header/Footer root `height` as
 *      both a literal and a token). Now: refuse per contract by name, emit
 *      every contract that validates (and no file of a refused one — the
 *      atomic guarantee, per contract), exit non-zero with the list. Pinned
 *      through generateComponents(), the react CLI verb and a registry
 *      target (html). The literal-and-token clash names the author's choice.
 *
 * Node script over pure functions; exit 1 on any failed check.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { generateComponents } from '../scripts/generate-components.js';
import { generateCommand } from '../packages/cli/src/commands/generate.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { emitReactInline } from './emit-react-inline.js';
import { ELEMENT_META, generateCss, generateTsx, validateContract } from './emit-react.js';
import { reactDomCollisions, reactPropsBase, wcHostCollisions } from '../packages/core/src/prop-collision.js';
import { tokenInventoryFromJson } from './tokens.js';

const ROOT = process.cwd();
const TABLE = path.join(ROOT, 'packages', 'core', 'src', 'prop-collision.table.ts');
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// ---------------------------------------------------------------------------
// B. The table — extracted from the installed type declarations.
// ---------------------------------------------------------------------------

/** Member names of every InterfaceDeclaration named `name` in `sf` (lib.dom
 *  merges declarations; @types/react nests them in `declare namespace React`). */
function interfaceMembers(sf: ts.SourceFile, name: string): { members: string[]; extends: string[] } | null {
  const members: string[] = [];
  const bases: string[] = [];
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      found = true;
      for (const m of node.members) {
        if (!m.name) continue; // index / call / construct signatures
        if (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) members.push(m.name.text);
      }
      for (const h of node.heritageClauses ?? []) {
        for (const t of h.types) bases.push(t.expression.getText(sf));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found ? { members, extends: bases } : null;
}

function allInterfaceNames(sf: ts.SourceFile): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node)) names.push(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...new Set(names)];
}

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();
const lit = (xs: string[], indent = '  ') => xs.map((x) => `${indent}${JSON.stringify(x)},`).join('\n');

export function buildTable(): string {
  const reactDts = path.join(ROOT, 'node_modules', '@types', 'react', 'index.d.ts');
  const domDts = path.join(ROOT, 'node_modules', 'typescript', 'lib', 'lib.dom.d.ts');
  const reactVersion = read('node_modules/@types/react/package.json').version as string;
  const tsVersion = read('node_modules/typescript/package.json').version as string;
  const react = ts.createSourceFile(reactDts, readFileSync(reactDts, 'utf8'), ts.ScriptTarget.Latest, true);
  const dom = ts.createSourceFile(domDts, readFileSync(domDts, 'utf8'), ts.ScriptTarget.Latest, true);

  const need = (sf: ts.SourceFile, n: string) => {
    const r = interfaceMembers(sf, n);
    if (!r) throw new Error(`${path.basename(sf.fileName)}: interface ${n} not found`);
    return r;
  };
  const base = sorted([
    ...need(react, 'HTMLAttributes').members,
    ...need(react, 'AriaAttributes').members,
    ...need(react, 'DOMAttributes').members,
  ]);
  const baseSet = new Set(base);
  const extensions: Record<string, string[]> = {};
  for (const n of allInterfaceNames(react).filter((n) => /^[A-Z]\w*HTMLAttributes$/.test(n) && n !== 'HTMLAttributes').sort()) {
    extensions[n] = sorted(need(react, n).members.filter((m) => !baseSet.has(m)));
  }

  // HTMLElement + its whole extends chain (Element → Node → EventTarget,
  // ARIAMixin, GlobalEventHandlers, …): every instance member a subclass
  // accessor would shadow.
  const hostMembers = new Set<string>();
  const seen = new Set<string>();
  const queue = ['HTMLElement'];
  while (queue.length > 0) {
    const n = queue.shift()!;
    if (seen.has(n)) continue;
    seen.add(n);
    const r = need(dom, n);
    for (const m of r.members) hostMembers.add(m);
    queue.push(...r.extends);
  }

  return `/**
 * GENERATED by \`npx tsx core/prop-collision-check.ts --update\` — DO NOT EDIT.
 * Extracted from @types/react ${reactVersion} (index.d.ts) and typescript ${tsVersion}
 * (lib.dom.d.ts). The check refuses when this file drifts from the installed
 * declarations. Consumed by ./prop-collision.ts (the rule).
 */
export const PROP_COLLISION_SOURCES = { '@types/react': ${JSON.stringify(reactVersion)}, typescript: ${JSON.stringify(tsVersion)} } as const;

/** React.HTMLAttributes<T> ∪ AriaAttributes ∪ DOMAttributes<T> — the names
 *  every React host element accepts regardless of tag (${base.length}). */
export const REACT_HTML_ATTRIBUTES: ReadonlySet<string> = new Set([
${lit(base)}
]);

/** What each \`<Tag>HTMLAttributes<T>\` ADDS over HTMLAttributes, keyed by
 *  the interface name core/emit-react.ts ELEMENT_META selects. */
export const REACT_ELEMENT_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
${Object.entries(extensions)
  .map(([n, ms]) => (ms.length === 0 ? `  ${n}: [],` : `  ${n}: [\n${lit(ms, '    ')}\n  ],`))
  .join('\n')}
};

/** Instance members of lib.dom's HTMLElement with its whole extends chain
 *  (${hostMembers.size}) — a custom element accessor of that name shadows the platform. */
export const HTML_ELEMENT_MEMBERS: ReadonlySet<string> = new Set([
${lit(sorted(hostMembers))}
]);
`;
}

const tableNow = buildTable();
if (process.argv.includes('--update')) {
  writeFileSync(TABLE, tableNow);
  console.log(`✔ wrote ${path.relative(ROOT, TABLE)} (${tableNow.length} bytes)`);
}
console.log('B. collision table');
const tableOnDisk = existsSync(TABLE) ? readFileSync(TABLE, 'utf8') : '';
check(
  'packages/core/src/prop-collision.table.ts matches the installed @types/react + lib.dom (else: npx tsx core/prop-collision-check.ts --update)',
  tableOnDisk === tableNow,
);
check('table: HTMLAttributes carries content, title, hidden, color, className, style, role', ['content', 'title', 'hidden', 'color', 'className', 'style', 'role'].every((n) => tableNow.includes(`  ${JSON.stringify(n)},`)));
check('table: ButtonHTMLAttributes extension carries disabled, type, value', /ButtonHTMLAttributes: \[[^\]]*"disabled"[^\]]*"type"[^\]]*"value"/.test(tableNow));
check('table: HTMLElement members carry title, hidden, id, slot', ['title', 'hidden', 'id', 'slot'].every((n) => tableNow.includes(`  ${JSON.stringify(n)},`)));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const tokenJson = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: read('tokens/semantic.tokens.json'),
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
  brands: Object.fromEntries(
    readdirSync(path.join(ROOT, 'tokens', 'modes'))
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), read(`tokens/modes/${f}`)]),
  ) as Record<string, Record<string, unknown>>,
};
const tokenFiles = [
  'tokens/primitives.tokens.json',
  'tokens/semantic.tokens.json',
  'tokens/modes/semantic.light.tokens.json',
  'tokens/modes/semantic.dark.tokens.json',
].map((f) => path.join(ROOT, f));
const tokenInventory = tokenInventoryFromJson([tokenJson.primitives, tokenJson.semantic, tokenJson.light, tokenJson.dark]);
const icons = new Map<string, string>();

/** The exam's shape: a div root with a `title` text prop, a `hidden`
 *  boolean and a slot named `content`. */
const probeRaw = {
  id: 'ds.collision-probe',
  name: 'CollisionProbe',
  version: '1.0.0',
  status: 'draft',
  description: 'Prop names that collide with DOM attributes — title, hidden, content.',
  semantics: { element: 'div' },
  props: [
    {
      name: 'title',
      description: 'Heading text — NOT the tooltip.',
      type: 'text',
      default: 'Probe',
      required: true,
      bindings: { figma: { kind: 'TEXT', property: 'Title' }, code: { prop: 'title' } },
    },
    {
      name: 'hidden',
      description: 'Shows the collapsed marker — NOT the HTML hidden attribute.',
      type: 'boolean',
      default: false,
      bindings: { figma: { kind: 'BOOLEAN', property: 'Hidden' }, code: { prop: 'hidden' } },
    },
  ],
  states: [],
  anatomy: {
    root: {
      layout: { display: 'flex', direction: 'column', align: 'stretch' },
      tokens: {
        'background-color': '{color.surface.raised}',
        'border-color': '{color.border.subtle}',
        'border-width': '{border-width.100}',
        'border-radius': '{radius.card}',
        color: '{color.surface.foreground}',
        'font-family': '{font.control.family}',
        'font-size': '{font.control.size.sm}',
      },
      parts: {
        heading: {
          element: 'span',
          content: { prop: 'title' },
          tokens: { 'font-weight': '{font.title.weight}' },
        },
        body: {
          description: 'Main content.',
          layout: { direction: 'column', align: 'stretch' },
          tokens: { gap: '{space.gap.control}', 'padding-inline': '{space.inset-x.md}' },
          slot: { name: 'content', figmaProperty: 'Content' },
        },
        collapsedMark: {
          element: 'span',
          text: '…',
          tokens: { color: '{color.border.subtle}' },
          visibleWhen: { prop: 'hidden' },
        },
      },
    },
  },
  anchors: {
    figma: { fileKey: null, componentSetKey: null },
    code: { importPath: 'src/components/CollisionProbe', export: 'CollisionProbe' },
  },
};
const probe = ContractSchema.parse(probeRaw);
const contracts = new Map<string, Contract>([[probe.id, probe]]);

// ---------------------------------------------------------------------------
// A. The rule, then the type-check.
// ---------------------------------------------------------------------------
console.log('A. DOM-attribute collisions');
const divMeta = ELEMENT_META.div;
check(
  `rule: collisions on the probe are exactly content, hidden, title (${reactDomCollisions(probe, divMeta).join(', ')})`,
  reactDomCollisions(probe, divMeta).join(',') === 'content,hidden,title',
);
check(
  "rule: base type is Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'>",
  reactPropsBase(probe, divMeta).base === "Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'>",
);
const button = ContractSchema.parse(read('contracts/button.contract.json'));
check(
  'rule: Button (native disabled, children text) omits nothing — the historical spelling is byte-identical',
  reactPropsBase(button, ELEMENT_META.button).base === 'ButtonHTMLAttributes<HTMLButtonElement>',
);
const citation = ContractSchema.parse(read('contracts/citation.contract.json'));
check(
  'rule: Citation href="{href}" (bound to its own root attr) is exempt',
  !reactDomCollisions(citation, ELEMENT_META.a).includes('href'),
);
const card = ContractSchema.parse(read('contracts/card.contract.json'));
check(
  "rule: Card's `title` text prop (a heading, not the tooltip) IS omitted",
  reactDomCollisions(card, ELEMENT_META.article).join(',') === 'title',
);
check(`rule (wc): host-member collisions on the probe are hidden, title (${wcHostCollisions(probe).join(', ')})`, wcHostCollisions(probe).join(',') === 'hidden,title');

function emitProbe() {
  const errors: string[] = [];
  validateContract(probe, contracts, errors, icons);
  const css = generateCss(probe, tokenInventory, errors);
  if (errors.length > 0) throw new Error(`probe refused:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  const tsx = generateTsx(probe, contracts, icons, css);
  const inline = emitReactInline(probe, { tokens: tokenJson, icons, contracts, mode: 'light' }).tsx;
  const wc = emitWebComponent(probe, { icons, contracts, tokens: tokenInventory });
  return { css, tsx, inline, wc };
}
const emitted = emitProbe();
check(
  "react: Props extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'>",
  emitted.tsx.includes("export interface CollisionProbeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'> {"),
);
check('react: the header NAMES the omitted attrs', /DOM attrs OMITTED from HTMLAttributes<HTMLDivElement>[\s\S]*\n \* {3}content, hidden, title\n/.test(emitted.tsx));
check(
  "react-inline: Props extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'>",
  emitted.inline.includes("export interface CollisionProbeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'> {"),
);
check('react-inline: the header NAMES the omitted attrs', /DOM attrs OMITTED from HTMLAttributes<HTMLDivElement>[\s\S]*\n \* {3}content, hidden, title\n/.test(emitted.inline));
const wcElement = emitted.wc.element;
check('wc: NO `get title()` / `get hidden()` accessor shadows HTMLElement', !/get (title|hidden)\(\)/.test(wcElement));
check('wc: `title` and `hidden` stay observed attributes', /static observedAttributes = \["title","hidden"\]/.test(wcElement));
check(
  'wc: the header NAMES both, with the platform effect (tooltip / display: none)',
  wcElement.includes('prop "title" is an HTMLElement member') &&
    wcElement.includes('tooltip') &&
    wcElement.includes('prop "hidden" is an HTMLElement member') &&
    wcElement.includes('display: none'),
);
check('wc: the view still reads the attribute with the contract default', wcElement.includes(`title: this.getAttribute('title') ?? "Probe"`) && wcElement.includes(`hidden: this.hasAttribute('hidden')`));

/** tsc in-process, the repo's flags (strict, react-jsx, bundler resolution). */
function typecheck(dir: string, files: string[], extra: Partial<ts.CompilerOptions> = {}): string[] {
  const program = ts.createProgram(files.map((f) => path.join(dir, f)), {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    isolatedModules: true,
    types: [],
    typeRoots: [path.join(ROOT, 'node_modules', '@types')],
    paths: {
      react: [path.join(ROOT, 'node_modules', '@types', 'react', 'index.d.ts')],
      'react/jsx-runtime': [path.join(ROOT, 'node_modules', '@types', 'react', 'jsx-runtime.d.ts')],
    },
    ...extra,
  });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const where = d.file && d.start !== undefined ? `${path.basename(d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1}` : '';
    return `${where} TS${d.code}: ${msg}`;
  });
}

const scratch = mkdtempSync(path.join(os.tmpdir(), 'prop-collision-'));
try {
  const dir = path.join(scratch, 'CollisionProbe');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(scratch, 'css-modules.d.ts'), `declare module '*.module.css' { const c: Record<string, string>; export default c; }\n`);
  writeFileSync(path.join(dir, 'CollisionProbe.module.css'), emitted.css);
  writeFileSync(path.join(dir, 'CollisionProbe.tsx'), emitted.tsx);
  writeFileSync(path.join(dir, 'CollisionProbe.inline.tsx'), emitted.inline);
  const control = emitted.tsx.replace("Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'hidden' | 'title'>", 'HTMLAttributes<HTMLDivElement>');
  writeFileSync(path.join(dir, 'Control.tsx'), control);
  const wcEntry = 'ds-collision-probe.ts';
  writeFileSync(path.join(dir, wcEntry), emitted.wc.element);
  writeFileSync(path.join(dir, 'ds-collision-probe.css.ts'), emitted.wc.stylesheet);

  const reactDiag = typecheck(scratch, ['css-modules.d.ts', 'CollisionProbe/CollisionProbe.tsx']);
  check(`react: emitted CollisionProbe.tsx type-checks (0 diagnostics)${reactDiag.length ? ' — ' + reactDiag.join('; ') : ''}`, reactDiag.length === 0);
  const inlineDiag = typecheck(scratch, ['CollisionProbe/CollisionProbe.inline.tsx']);
  check(`react-inline: emitted CollisionProbe.inline.tsx type-checks (0 diagnostics)${inlineDiag.length ? ' — ' + inlineDiag.join('; ') : ''}`, inlineDiag.length === 0);
  const controlDiag = typecheck(scratch, ['css-modules.d.ts', 'CollisionProbe/Control.tsx']);
  check(
    `control: the SAME file with the plain base type FAILS with TS2430 (the omission is load-bearing) — ${controlDiag.length} diagnostic(s)`,
    controlDiag.some((d) => d.includes('TS2430')),
  );
  const wcDiag = typecheck(scratch, [`CollisionProbe/${wcEntry}`]);
  check(`wc: emitted ${wcEntry} type-checks against lib.dom (0 diagnostics)${wcDiag.length ? ' — ' + wcDiag.join('; ') : ''}`, wcDiag.length === 0);

  // -------------------------------------------------------------------------
  // C. Per-contract batch refusal.
  // -------------------------------------------------------------------------
  console.log('C. generate over a directory with one invalid contract');
  const contractsDir = path.join(scratch, 'contracts');
  mkdirSync(contractsDir);
  // The exam's clash: root `height` as BOTH a literal and a token binding.
  const clash = JSON.parse(JSON.stringify(probeRaw)) as typeof probeRaw & {
    anatomy: { root: { tokens: Record<string, string>; literals?: Record<string, string> } };
  };
  clash.id = 'ds.section-header';
  clash.name = 'SectionHeader';
  clash.anatomy.root.tokens = { ...clash.anatomy.root.tokens, height: '{size.card.width}' };
  clash.anatomy.root.literals = { height: 'fit-content' };
  // A dependent of the refused contract — must be refused too, by name.
  const dependent = JSON.parse(JSON.stringify(probeRaw)) as typeof probeRaw & { anatomy: { root: { parts: Record<string, unknown> } } };
  dependent.id = 'ds.section';
  dependent.name = 'Section';
  dependent.anatomy.root.parts = {
    ...dependent.anatomy.root.parts,
    header: { component: { id: 'ds.section-header', props: {} } },
  };
  const valid2 = JSON.parse(JSON.stringify(probeRaw)) as typeof probeRaw;
  valid2.id = 'ds.badge-probe';
  valid2.name = 'BadgeProbe';
  for (const [file, doc] of [
    ['01-badge-probe.contract.json', valid2],
    ['02-section-header.contract.json', clash],
    ['03-section.contract.json', dependent],
    ['04-collision-probe.contract.json', probeRaw],
  ] as const) {
    writeFileSync(path.join(contractsDir, file), JSON.stringify(doc, null, 2) + '\n');
  }
  const files = readdirSync(contractsDir).sort().map((f) => path.join(contractsDir, f));

  const outA = path.join(scratch, 'out-api');
  const result = await generateComponents({ contractFiles: files, tokenFiles, iconsDir: path.join(scratch, 'no-icons'), outDir: outA, stories: false });
  check(`api: generated the two valid contracts (${result.generated.join(', ')})`, result.generated.join(',') === 'BadgeProbe,CollisionProbe');
  check(`api: refused two BY NAME (${result.refused.map((r) => r.id).join(', ')})`, result.refused.map((r) => r.id).join(',') === 'ds.section-header,ds.section');
  const clashMsg = result.refused.find((r) => r.id === 'ds.section-header')?.violations.join('\n') ?? '';
  check(
    'api: the clash is a NAMED refusal that says which wins is the contract author\'s choice',
    /root" carries channel "height" as BOTH a token binding \(\{size\.card\.width\}\) and a literal \("fit-content"\)/.test(clashMsg) && /contract author's choice/.test(clashMsg),
  );
  const depMsg = result.refused.find((r) => r.id === 'ds.section')?.violations.join('\n') ?? '';
  check('api: the dependent names the refused contract it depends on', /depends on refused contract "ds\.section-header"/.test(depMsg));
  const tree = readdirSync(outA).sort();
  check(`api: output holds ONLY the generated components + barrel + tokens.css (${tree.join(', ')})`, tree.join(',') === 'BadgeProbe,CollisionProbe,index.ts,tokens.css');
  check('api: no partial file of a refused contract (no SectionHeader/, no Section/)', !existsSync(path.join(outA, 'SectionHeader')) && !existsSync(path.join(outA, 'Section')));
  check('api: the root barrel lists only the generated components', readFileSync(path.join(outA, 'index.ts'), 'utf8') === "import './tokens.css';\nexport * from './BadgeProbe';\nexport * from './CollisionProbe';\n");

  // The CLI verb (react): exit 1, every valid contract on disk.
  const captured: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: unknown[]) => captured.push(a.join(' '));
  console.error = (...a: unknown[]) => captured.push(a.join(' '));
  let cliCode = -1;
  let htmlCode = -1;
  const outCli = path.join(scratch, 'out-cli');
  const outHtml = path.join(scratch, 'out-html');
  try {
    cliCode = await generateCommand([contractsDir, '--out', outCli, '--tokens', tokenFiles.join(',')]);
    htmlCode = await generateCommand([contractsDir, '--out', outHtml, '--target', 'html', '--tokens', tokenFiles.join(',')]);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  const out = captured.join('\n');
  check(`cli (react): exit 1 with both valid contracts generated (exit ${cliCode})`, cliCode === 1 && existsSync(path.join(outCli, 'BadgeProbe', 'BadgeProbe.tsx')) && existsSync(path.join(outCli, 'CollisionProbe', 'CollisionProbe.tsx')));
  check('cli (react): prints the generated set AND the refused list by name', /✔ Generated 2 component\(s\)/.test(out) && /✘ Refused 2 contract\(s\)/.test(out) && out.includes('ds.section-header') && out.includes('ds.section:'));
  check(`cli (html, registry target): exit 1, valid contracts emitted, refused named (exit ${htmlCode})`, htmlCode === 1 && existsSync(path.join(outHtml, 'badge-probe.html')) && !existsSync(path.join(outHtml, 'section-header.html')) && /✘ Refused 2 contract\(s\)/.test(out));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} prop-collision check(s) failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`\n✔ prop-collision: all checks passed`);
