/**
 * CODE CONNECT — the contract as a Figma Code Connect mapping.
 *
 *   ds-contracts generate <contracts..> --out <dir> --target code-connect
 *   ds-contracts generate <contracts..> --out <dir> --target code-connect-html
 *
 * Figma Code Connect is Figma's first-party "this component set = that code
 * component" mapping: one `<Component>.figma.tsx` per component (React), or a
 * `.figma.ts` with the `html` template tag (HTML / web components), published
 * with the `@figma/code-connect` CLI. A contract already carries everything
 * such a file needs — the set identity (bindings.figma.anchors.fileKey + nodeId), the
 * prop ↔ Figma-property bindings with their display names, the slots — so
 * the file is a PROJECTION of the contract, same as React or the canvas.
 *
 * Two emitters register through the public registry (@ds-contracts/core
 * registerEmitter — the door a third-party emitter uses):
 *
 *   code-connect       → code-connect/<Name>.figma.tsx   (React flavour;
 *                        imports the generated component from `../<Name>`,
 *                        which resolves against BOTH React layouts the CLI
 *                        writes: `<out>/<Name>/index.ts` and `<out>/<Name>.tsx`)
 *   code-connect-html  → code-connect/<tag>.figma.ts     (HTML flavour for
 *                        the web-components target; <tag> is the custom
 *                        element name the WC emitter mints, `id` with its
 *                        first "." dashed — the check pins it equal to the
 *                        WC emitter's own tagOf())
 *
 * THE MAPPING (one construct per contract fact — docs cited in DESIGN.md):
 *
 *   prop kind VARIANT, enum type      → figma.enum('<Property>', { <Display>: '<canonical>', … })
 *                                       display name = bindings.figma.values[canonical] ?? canonical,
 *                                       byte-for-byte the rule the Figma generator names variants by
 *   prop kind VARIANT, boolean type   → figma.enum('<Property>', { <Display(false)>: false, <Display(true)>: true })
 *   prop kind BOOLEAN                 → figma.boolean('<Property>')
 *   prop kind TEXT, text/enum type    → figma.string('<Property>')
 *   prop kind INSTANCE_SWAP           → figma.instance('<Property>')
 *   slot (anatomy part with `slot`)   → figma.slot('<slotFigmaProperty>') — the generator writes
 *                                       NATIVE slot properties (figma.createSlot) whose layer name
 *                                       IS the property name; figma.children() resolves nested
 *                                       *instances* by layer name and figma.instance() an
 *                                       INSTANCE_SWAP property — neither is the fact on the canvas
 *   code prop `children` (text/slot)  → the JSX child / the template's inner content
 *
 * NOT EXPRESSIBLE — omitted and NAMED in the file header (never silently):
 *   events (Code Connect has no event construct), number props bound to TEXT
 *   (Code Connect has no numeric helper; figma.string would splice a quoted
 *   string into a numeric prop), kind NONE / arrayOf props (no canvas
 *   manifestation by declared fidelity limit), bindings.figma.statePreviews (the
 *   canvas-only "State" axis), `modes` (theme modes are token-collection
 *   modes, never a prop).
 *
 * URL: https://www.figma.com/design/<fileKey>?node-id=<nodeId>, from the
 * anchors and nothing else. A contract whose anchors are null (never synced)
 * REFUSES BY NAME — a Code Connect URL is an identity, never invented.
 *
 * Pure: contract in, file text out; no paths, no clock, no randomness — two
 * emits are byte-equal (code-connect-check.ts pins it). Browser-importable.
 */
import {
  slotFigmaProperty,
  slotsOf,
  type Contract,
  type Prop,
} from '../scripts/contract-schema.js';
import type { Emitter } from '../packages/core/src/emitter.js';
import { kebab } from '../packages/core/src/naming.js';

// ---------------------------------------------------------------------------
// Anchors — read through ONE accessor so the emitter has a single place that
// knows the spelling. Schema 17 spells the set identity
// `bindings.figma.anchors` (the v16 `anchors.figma` is REFUSED by the
// validator, so it is not read here). Nothing is synthesized when absent.
// ---------------------------------------------------------------------------

export interface FigmaAnchors {
  fileKey: string | null;
  componentSetKey: string | null;
  nodeId?: string | null;
}

/** The contract's Figma set identity (`bindings.figma.anchors`), or null
 *  when the contract carries no such block. */
export function figmaAnchorsOf(contract: Contract): FigmaAnchors | null {
  return contract.bindings?.figma?.anchors ?? null;
}

/** The Code Connect node URL, or a refusal naming the missing anchor field. */
export function codeConnectUrl(contract: Contract): string {
  const anchors = figmaAnchorsOf(contract);
  const missing: string[] = [];
  if (!anchors) missing.push('bindings.figma.anchors (absent)');
  else {
    if (!anchors.fileKey) missing.push('bindings.figma.anchors.fileKey');
    if (!anchors.nodeId) missing.push('bindings.figma.anchors.nodeId');
  }
  if (missing.length > 0) {
    throw new Error(
      `${contract.id}: code-connect refused — ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} null/absent. ` +
        'A Code Connect URL names ONE component set in ONE file; it is read from the anchors the Figma sync wrote back and never invented. ' +
        'Sync the set first (ds-contracts figma …, then paste into the plugin) or record the fileKey + nodeId, then regenerate.',
    );
  }
  return `https://www.figma.com/design/${anchors!.fileKey}?node-id=${anchors!.nodeId}`;
}

// ---------------------------------------------------------------------------
// The plan — one mapping per expressible fact, one omission per inexpressible
// one. Shared by both flavours so they cannot disagree.
// ---------------------------------------------------------------------------

export type MappingHelper = 'enum' | 'boolean' | 'string' | 'instance' | 'slot';

export interface CodeConnectMapping {
  /** The code prop (the key in `props`, and the JSX attribute / template slot). */
  codeProp: string;
  /** The Figma property the helper reads. */
  figmaProperty: string;
  helper: MappingHelper;
  /** figma.enum only — [display name, code value] pairs in contract order. */
  enumValues?: Array<[display: string, value: string | boolean]>;
  /** `children` renders as the JSX child / inner content; anything else is an attribute. */
  placement: 'attribute' | 'children';
  /** The source fact, for the header. */
  source: string;
}

export interface CodeConnectOmission {
  what: string;
  why: string;
}

export interface CodeConnectPlan {
  url: string;
  mappings: CodeConnectMapping[];
  omissions: CodeConnectOmission[];
}

const displayOf = (p: Prop, canonical: string): string =>
  p.bindings.figma.values?.[canonical] ?? canonical;

function planProp(p: Prop, mappings: CodeConnectMapping[], omissions: CodeConnectOmission[]): void {
  const fig = p.bindings.figma;
  const codeProp = p.bindings.code.prop;
  const placement = codeProp === 'children' ? 'children' : 'attribute';
  const typeName =
    typeof p.type === 'string' ? p.type : 'enum' in p.type ? 'enum' : 'arrayOf';
  if (fig.kind === 'NONE') {
    omissions.push({
      what: `prop "${p.name}" (${typeName}) → ${codeProp}`,
      why: 'bindings.figma.kind is NONE — no canvas manifestation by declared fidelity limit; nothing to read',
    });
    return;
  }
  const property = fig.property!;
  const base = { codeProp, figmaProperty: property, placement } as const;
  switch (fig.kind) {
    case 'VARIANT': {
      if (typeof p.type === 'object' && 'enum' in p.type) {
        mappings.push({
          ...base,
          helper: 'enum',
          enumValues: p.type.enum.map((v) => [displayOf(p, v), v]),
          source: `prop "${p.name}" (enum) — VARIANT "${property}"`,
        });
      } else if (p.type === 'boolean') {
        mappings.push({
          ...base,
          helper: 'enum',
          enumValues: [
            [displayOf(p, 'false'), false],
            [displayOf(p, 'true'), true],
          ],
          source: `prop "${p.name}" (boolean as a variant axis) — VARIANT "${property}"`,
        });
      } else {
        omissions.push({
          what: `prop "${p.name}" (${typeName}) → ${codeProp}`,
          why: `a ${typeName} prop bound to VARIANT "${property}" has no value set to enumerate`,
        });
      }
      return;
    }
    case 'BOOLEAN':
      mappings.push({ ...base, helper: 'boolean', source: `prop "${p.name}" (boolean) — BOOLEAN "${property}"` });
      return;
    case 'TEXT':
      if (p.type === 'number') {
        omissions.push({
          what: `prop "${p.name}" (number) → ${codeProp}`,
          why: `bound to TEXT "${property}": Code Connect has no numeric helper and figma.string() would splice a quoted string into a numeric prop`,
        });
        return;
      }
      mappings.push({ ...base, helper: 'string', source: `prop "${p.name}" (${typeName}) — TEXT "${property}"` });
      return;
    case 'INSTANCE_SWAP':
      mappings.push({ ...base, helper: 'instance', source: `prop "${p.name}" — INSTANCE_SWAP "${property}"` });
      return;
  }
}

/** Plan the file: every prop + slot mapped or named. Refuses by name when the
 *  anchors are null or two facts would claim one code prop. */
export function planCodeConnect(contract: Contract): CodeConnectPlan {
  const url = codeConnectUrl(contract);
  const mappings: CodeConnectMapping[] = [];
  const omissions: CodeConnectOmission[] = [];
  for (const p of contract.props) planProp(p, mappings, omissions);
  for (const { name, slot } of slotsOf(contract)) {
    const property = slotFigmaProperty(slot);
    mappings.push({
      codeProp: slot.name,
      figmaProperty: property,
      helper: 'slot',
      placement: slot.name === 'children' ? 'children' : 'attribute',
      source: `slot "${slot.name}" (part "${name}") — native SLOT "${property}"`,
    });
  }
  const seen = new Map<string, string>();
  for (const m of mappings) {
    const prior = seen.get(m.codeProp);
    if (prior) {
      throw new Error(
        `${contract.id}: code-connect refused — two facts claim the code prop "${m.codeProp}": ${prior} and ${m.source}. One key in \`props\` can read one Figma property; rename the slot or the prop.`,
      );
    }
    seen.set(m.codeProp, m.source);
  }
  for (const e of contract.events ?? []) {
    omissions.push({
      what: `event "${e.name}" → ${e.bindings.code.prop} (trigger: ${e.trigger})`,
      why: 'code-only: Code Connect has no event construct; the canvas shows states, never callbacks',
    });
  }
  if (contract.bindings.figma.statePreviews) {
    omissions.push({
      what: 'variant axis "State" (bindings.figma.statePreviews)',
      why: 'canvas-only interaction previews; the code surface renders these states from CSS pseudo-classes, so no prop receives them',
    });
  }
  if (contract.modes && contract.modes.length > 0) {
    omissions.push({
      what: `modes [${contract.modes.join(', ')}]`,
      why: 'theming lives in the token collection modes, never in the component API',
    });
  }
  return { url, mappings, omissions };
}

// ---------------------------------------------------------------------------
// Text helpers — deterministic, quote only when the grammar requires it.
// ---------------------------------------------------------------------------

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const key = (s: string): string => (IDENT.test(s) ? s : q(s));
const literal = (v: string | boolean): string => (typeof v === 'boolean' ? String(v) : q(v));

function helperCall(m: CodeConnectMapping): string {
  switch (m.helper) {
    case 'enum': {
      const pairs = m.enumValues!.map(([display, value]) => `      ${key(display)}: ${literal(value)},`);
      return `figma.enum(${q(m.figmaProperty)}, {\n${pairs.join('\n')}\n    })`;
    }
    case 'boolean':
      return `figma.boolean(${q(m.figmaProperty)})`;
    case 'string':
      return `figma.string(${q(m.figmaProperty)})`;
    case 'instance':
      return `figma.instance(${q(m.figmaProperty)})`;
    case 'slot':
      return `figma.slot(${q(m.figmaProperty)})`;
  }
}

function propsBlock(mappings: CodeConnectMapping[]): string {
  if (mappings.length === 0) return '';
  return `  props: {\n${mappings.map((m) => `    ${key(m.codeProp)}: ${helperCall(m)},`).join('\n')}\n  },\n`;
}

function header(contract: Contract, plan: CodeConnectPlan, flavour: 'react' | 'html'): string {
  const anchors = figmaAnchorsOf(contract)!;
  const lines = [
    `${contract.name} — Figma Code Connect mapping (${flavour === 'react' ? 'React' : 'HTML / web components'}), generated from contract ${contract.id}.`,
    `GENERATED by ds-contracts (--target ${flavour === 'react' ? 'code-connect' : 'code-connect-html'}) — do not edit; change the contract and regenerate.`,
    '',
    `Set: ${plan.url}`,
    `componentSetKey: ${anchors.componentSetKey ?? 'null'}`,
    `Code anchor: ${contract.bindings.code.anchors.importPath} → ${contract.bindings.code.anchors.export}`,
    '',
    'Mapped:',
    ...plan.mappings.map((m) => `  - ${m.codeProp}: ${m.source}`),
  ];
  if (plan.omissions.length > 0) {
    lines.push('', 'Not mapped — Code Connect has no construct for these; named here so nothing is lost silently:');
    for (const o of plan.omissions) lines.push(`  - ${o.what}: ${o.why}`);
  }
  return `/**\n${lines.map((l) => (l === '' ? ' *' : ` * ${l}`)).join('\n')}\n */\n`;
}

// ---------------------------------------------------------------------------
// React flavour — `import { figma } from '@figma/code-connect/react'`,
// `figma.connect(Component, url, { props, example })`.
// ---------------------------------------------------------------------------

export function emitCodeConnectReact(contract: Contract): string {
  const plan = planCodeConnect(contract);
  const name = contract.name;
  const attrs = plan.mappings.filter((m) => m.placement === 'attribute');
  const children = plan.mappings.filter((m) => m.placement === 'children');
  const attrText = attrs.map((m) => ` ${m.codeProp}={props.${IDENT.test(m.codeProp) ? m.codeProp : `[${q(m.codeProp)}]`}}`).join('');
  const param = plan.mappings.length === 0 ? '()' : '(props)';
  const jsx =
    children.length === 0
      ? `<${name}${attrText} />`
      : `<${name}${attrText}>${children.map((m) => `{props.${m.codeProp}}`).join('')}</${name}>`;
  return (
    header(contract, plan, 'react') +
    `import { figma } from '@figma/code-connect/react';\n` +
    `import { ${name} } from '../${name}';\n\n` +
    `figma.connect(${name}, ${q(plan.url)}, {\n` +
    propsBlock(plan.mappings) +
    `  example: ${param} => ${jsx},\n` +
    `});\n`
  );
}

// ---------------------------------------------------------------------------
// HTML flavour — `import { figma, html } from '@figma/code-connect/html'`,
// `figma.connect(url, { props, example: (props) => html\`…\` })`. Attributes
// are the WC emitter's reflected attributes (kebab of the prop name);
// booleans use the documented `?attr=${…}` binding; `children` is the inner
// content. A NAMED slot's content is spliced inline too — the `slot="…"`
// attribute lives on each child element and cannot be added from here
// (named in the header).
// ---------------------------------------------------------------------------

/** The custom element tag the web-components emitter mints: `id` with its
 *  first "." dashed. Mirrors packages/emitter-web-components tagOf() — the
 *  check pins the two equal so they cannot drift. */
export const codeConnectTagOf = (contract: Contract): string => contract.id.replace('.', '-');

export function emitCodeConnectHtml(contract: Contract): string {
  const plan = planCodeConnect(contract);
  const tag = codeConnectTagOf(contract);
  const attrs = plan.mappings.filter((m) => m.placement === 'attribute');
  const children = plan.mappings.filter((m) => m.placement === 'children');
  const namedSlots = attrs.filter((m) => m.helper === 'slot');
  const attrText = attrs
    .filter((m) => m.helper !== 'slot')
    .map((m) => ` ${m.helper === 'boolean' ? '?' : ''}${kebab(m.codeProp)}=\${props.${IDENT.test(m.codeProp) ? m.codeProp : `[${q(m.codeProp)}]`}}`)
    .join('');
  const inner = [...children, ...namedSlots].map((m) => `\${props.${m.codeProp}}`).join('');
  const extra =
    namedSlots.length > 0
      ? `// Named slot${namedSlots.length > 1 ? 's' : ''} ${namedSlots.map((m) => `"${m.codeProp}"`).join(', ')}: content is spliced inline — each child carries its own slot="…" attribute, which this template cannot add.\n`
      : '';
  const param = plan.mappings.length === 0 ? '()' : '(props)';
  return (
    header(contract, plan, 'html') +
    extra +
    `import { figma, html } from '@figma/code-connect/html';\n\n` +
    `figma.connect(${q(plan.url)}, {\n` +
    `  imports: [${JSON.stringify(`import '../${tag}'`)}],\n` +
    propsBlock(plan.mappings) +
    `  example: ${param} => html\`<${tag}${attrText}>${inner}</${tag}>\`,\n` +
    `});\n`
  );
}

// ---------------------------------------------------------------------------
// The registry objects — registered by core/emitter.ts through the same
// registerEmitter() a third-party emitter uses.
// ---------------------------------------------------------------------------

export const codeConnectEmitter: Emitter = {
  name: 'code-connect',
  optIn: true,
  label: 'Figma Code Connect — React (<out>/code-connect/<Name>.figma.tsx, imports the generated component)',
  emit(contract) {
    return [{ path: `code-connect/${contract.name}.figma.tsx`, contents: emitCodeConnectReact(contract) }];
  },
};

export const codeConnectHtmlEmitter: Emitter = {
  name: 'code-connect-html',
  optIn: true,
  label: 'Figma Code Connect — HTML flavour for the web-components target (<out>/code-connect/<tag>.figma.ts)',
  emit(contract) {
    return [
      { path: `code-connect/${codeConnectTagOf(contract)}.figma.ts`, contents: emitCodeConnectHtml(contract) },
    ];
  },
};
