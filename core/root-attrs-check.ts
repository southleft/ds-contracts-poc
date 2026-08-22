/**
 * Root-attribute receipts for the code emitters — `npm run root-attrs:check`.
 *
 * The contract's `anatomy.root.attrs` is a fact about the ROOT ELEMENT
 * (`aria-label="{label}"`, `href="{href}"`, `type="button"`,
 * `role="progressbar"`, `aria-hidden="true"`). The v1 bar is zero silent
 * losses: every such entry is either carried onto the root element of every
 * emitted surface (react / react-inline / web-components / html) or NAMED in
 * the emitted file's header as a no-op. A `{prop}` value binds to the prop
 * (`href={href}`, `aria-label="${__esc(String(p.label))}"`); a literal value
 * lands verbatim. `role` is claimed ONCE: `anatomy.root.attrs.role` wins over
 * `semantics.role` (a differing pair is refused by name in validateContract),
 * and an implicit `type="button"` never doubles an authored one.
 *
 * Also receipted here because the same audit found them:
 *   · web-components: v17 `statesByProp` (per-axis state colour) renders as
 *     shadow CSS rules — on the root and on nested parts — exactly like the
 *     CSS-Module emitter's `.prop-value:state` rules.
 *   · html: a toggling event's ARIA state (aria-expanded / aria-pressed /
 *     aria-checked) renders per showcase item on the trigger (root or part);
 *     the static surface cannot run the toggle but CAN show its state.
 *
 * Subjects: every repo contract whose root carries attrs (13 today), the
 * accordion (part-trigger aria-expanded), and two SYNTHETIC variants of
 * ds.button — one with a root toggle event (aria-pressed), one with
 * statesByProp — because no committed contract carries either yet.
 *
 * Node script over pure functions; exit 1 on any failed check.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { emitHtml } from './emit-html.js';
import { emitReactInline } from './emit-react-inline.js';
import { generateCss, generateTsx, validateContract } from './emit-react.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { tokenInventoryFromJson } from './tokens.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(read(path.join('contracts', f))))
    .map((c) => [c.id, c]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
);
const tokenJson = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: read('tokens/semantic.tokens.json'),
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
  brands: Object.fromEntries(
    readdirSync(path.join(ROOT, 'tokens', 'modes'))
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), read(`tokens/modes/${f}`)]),
  ),
};
const tokenInventory = tokenInventoryFromJson([tokenJson.primitives, tokenJson.semantic, tokenJson.light, tokenJson.dark]);

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

/** The open tag starting at `start` ("<"), up to the matching ">" at brace
 *  depth 0 — JSX `{…}` expressions and template `${…}` holes may contain
 *  anything, so they are skipped by depth. */
function openTag(src: string, start: number): string {
  if (src[start] !== '<') throw new Error(`openTag: no "<" at ${start}: ${JSON.stringify(src.slice(start, start + 40))}`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('openTag: unterminated tag');
}
/** How many times an attribute NAME appears on the tag (a doubled `role`/`type` is a defect). */
const attrCount = (tag: string, attr: string): number => {
  const re = new RegExp(`[\\s<]${attr.replace(/[-]/g, '\\-')}=`, 'g');
  return (tag.match(re) ?? []).length;
};

const propRef = (value: string) => value.match(/^\{([a-z][\w-]*)\}$/)?.[1];
const codePropOf = (c: Contract, name: string) => c.props.find((p) => p.name === name)?.bindings.code.prop ?? name;

/** True when the emitted file's header comment names this attr as a no-op. */
const namedInHeader = (src: string, attr: string): boolean => {
  const header = src.slice(0, src.indexOf('*/') + 2);
  return header.includes(`attrs.${attr}`) || header.includes(`root.attrs.${attr}`);
};

// ---- per-surface emission ----------------------------------------------
function emitAll(contract: Contract) {
  const errors: string[] = [];
  validateContract(contract, contracts, errors, icons);
  const css = generateCss(contract, tokenInventory, errors);
  if (errors.length > 0) throw new Error(`${contract.id}: validateContract refused —\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  const tsx = generateTsx(contract, contracts, icons, css);
  const inline = emitReactInline(contract, { tokens: tokenJson, icons, contracts, mode: 'light' }).tsx;
  const wc = emitWebComponent(contract, { icons, contracts, tokens: tokenInventory });
  const html = emitHtml(contract, { tokens: tokenInventory, icons, contracts });
  return { tsx, inline, wc, html };
}

const reactRootTag = (tsx: string): string => {
  const i = tsx.indexOf('return (');
  const lt = tsx.indexOf('<', i);
  return openTag(tsx, lt);
};
const wcRootTag = (element: string): string => {
  const i = element.indexOf('return `<');
  return openTag(element, i + 'return `'.length);
};
/** The root open tag of the showcase item labelled `label` (default: the first item). */
const htmlRootTag = (html: string, label = 'default'): string => {
  const items = html.split('<div class="showcase__item">').slice(1);
  const item = items.find((it) => it.startsWith(`\n    <p class="showcase__label">${label}</p>`));
  if (!item) throw new Error(`html: no showcase item "${label}"`);
  const afterLabel = item.indexOf('</p>') + '</p>'.length;
  const m = /\n {4}<[a-z]/.exec(item.slice(afterLabel));
  if (!m) throw new Error(`html: no root tag in item "${label}"`);
  return openTag(item, afterLabel + m.index + 5);
};
const htmlHeader = (html: string) => html.slice(0, html.indexOf('-->') + 3);

// ---- 1. anatomy.root.attrs on every surface -----------------------------
const subjects = [...contracts.values()].filter((c) => Object.keys(c.anatomy.root.attrs ?? {}).length > 0);
check(
  `subjects: 13 repo contracts carry anatomy.root.attrs (${subjects.map((c) => c.id).join(', ')})`,
  subjects.length === 13,
);

for (const contract of subjects) {
  console.log(`\n${contract.name} (${contract.id})`);
  const { tsx, inline, wc, html } = emitAll(contract);
  const reactTag = reactRootTag(tsx);
  const inlineTag = reactRootTag(inline);
  const wcTag = wcRootTag(wc.element);
  const htmlTag = htmlRootTag(html.html);

  for (const [attr, value] of Object.entries(contract.anatomy.root.attrs ?? {})) {
    const ref = propRef(value);
    if (ref) {
      const code = codePropOf(contract, ref);
      const prop = contract.props.find((p) => p.name === ref);
      const dflt = prop?.default !== undefined ? String(prop.default) : '';
      check(
        `react: root carries ${attr}={${code}} (bound to prop "${ref}")`,
        (reactTag.includes(` ${attr}={${code}}`) || reactTag.includes(` ${attr}={String(${code})}`)) ||
          namedInHeader(tsx, attr),
      );
      check(
        `react-inline: root carries ${attr}={${code}}`,
        (inlineTag.includes(` ${attr}={${code}}`) || inlineTag.includes(` ${attr}={String(${code})}`)) ||
          namedInHeader(inline, attr),
      );
      check(
        `web-components: root carries ${attr}="\${__esc(String(p.${ref}))}"`,
        wcTag.includes(`${attr}="\${__esc(String(p.${ref}))}"`) || namedInHeader(wc.element, attr),
      );
      check(
        `html: root carries ${attr}="${dflt}" (showcase default of "${ref}")`,
        htmlTag.includes(` ${attr}="${dflt}"`) || htmlHeader(html.html).includes(`attrs.${attr}`),
      );
    } else {
      check(`react: root carries ${attr}="${value}"`, reactTag.includes(` ${attr}="${value}"`) || namedInHeader(tsx, attr));
      check(`react-inline: root carries ${attr}="${value}"`, inlineTag.includes(` ${attr}="${value}"`) || namedInHeader(inline, attr));
      check(`web-components: root carries ${attr}="${value}"`, wcTag.includes(` ${attr}="${value}"`) || namedInHeader(wc.element, attr));
      check(`html: root carries ${attr}="${value}"`, htmlTag.includes(` ${attr}="${value}"`) || htmlHeader(html.html).includes(`attrs.${attr}`));
    }
  }
  // Prop-bound attrs must actually USE the destructured prop — a destructured,
  // never-read `label`/`href` is exactly the silent loss this receipt exists for.
  for (const [, value] of Object.entries(contract.anatomy.root.attrs ?? {})) {
    const ref = propRef(value);
    if (!ref) continue;
    const code = codePropOf(contract, ref);
    const body = tsx.slice(tsx.indexOf('forwardRef<'));
    const uses = (body.match(new RegExp(`\\b${code}\\b`, 'g')) ?? []).length;
    check(`react: prop "${code}" is read in the component body (not destructured-and-dropped)`, uses >= 2);
  }
  // One claim per attribute name on the root — never a doubled role / type.
  for (const [tagName, tag] of [['react', reactTag], ['react-inline', inlineTag], ['web-components', wcTag], ['html', htmlTag]] as const) {
    for (const attr of ['role', 'type', 'aria-label', 'href']) {
      check(`${tagName}: at most one ${attr}= on the root tag`, attrCount(tag, attr) <= 1);
    }
  }
  // semantics.role (when the attrs do not claim one) still lands — the rule is
  // "attrs win", not "attrs replace".
  if (contract.semantics.role && !contract.anatomy.root.attrs?.role) {
    for (const [tagName, tag] of [['react', reactTag], ['react-inline', inlineTag], ['web-components', wcTag], ['html', htmlTag]] as const) {
      check(`${tagName}: semantics.role "${contract.semantics.role}" still on the root`, tag.includes(`role="${contract.semantics.role}"`));
    }
  }
}

// ---- 2. role precedence: attrs.role vs semantics.role ---------------------
console.log('\nrole precedence (synthetic: ds.progress-bar with semantics.role)');
{
  const base = contracts.get('ds.progress-bar')!;
  const same = ContractSchema.parse({ ...base, semantics: { ...base.semantics, role: 'progressbar' } });
  const { tsx, wc, html } = emitAll(same);
  check('equal attrs.role + semantics.role: react emits role ONCE', attrCount(reactRootTag(tsx), 'role') === 1);
  check('equal attrs.role + semantics.role: web-components emits role ONCE', attrCount(wcRootTag(wc.element), 'role') === 1);
  check('equal attrs.role + semantics.role: html emits role ONCE', attrCount(htmlRootTag(html.html), 'role') === 1);

  const differ = ContractSchema.parse({ ...base, semantics: { ...base.semantics, role: 'status' } });
  const errors: string[] = [];
  validateContract(differ, contracts, errors, icons);
  check(
    'differing attrs.role vs semantics.role is REFUSED by name (anatomy.root.attrs.role)',
    errors.some((e) => e.includes('anatomy.root.attrs.role') && e.includes('semantics.role')),
  );
}

// ---- 3. html: toggle ARIA state on the trigger (part + root) --------------
console.log('\nhtml: toggle ARIA state');
{
  const accordion = contracts.get('ds.accordion-item')!;
  const { html } = emitAll(accordion);
  const closed = html.html.split('<div class="showcase__item">')[1] ?? '';
  const open = html.html.split('<div class="showcase__item">').find((it) => it.includes('>state=open<')) ?? '';
  check('accordion-item: closed trigger carries aria-expanded="false"', /class="accordion-item__trigger"[^>]*aria-expanded="false"/.test(closed));
  check('accordion-item: state=open trigger carries aria-expanded="true"', /class="accordion-item__trigger"[^>]*aria-expanded="true"/.test(open));
  check(
    'html header names the ARIA state it renders (not "no events" alone)',
    /aria-(expanded|pressed|checked)|ARIA state/.test(htmlHeader(html.html)),
  );

  // A root-triggered toggle (a press button) — no committed contract has one,
  // so a synthetic ds.button carries it.
  const button = contracts.get('ds.button')!;
  const pressButton = ContractSchema.parse({
    ...button,
    id: 'ds.press-button',
    name: 'PressButton',
    props: [
      ...button.props,
      {
        name: 'pressed',
        type: { enum: ['off', 'on'] },
        default: 'off',
        bindings: { figma: { kind: 'VARIANT', property: 'Pressed', values: { off: 'Off', on: 'On' } }, code: { prop: 'pressed' } },
      },
    ],
    events: [
      { name: 'toggle', bindings: { code: { prop: 'onToggle' } }, trigger: 'root', toggles: { prop: 'pressed', between: ['off', 'on'], aria: 'pressed' } },
    ],
  });
  const out = emitAll(pressButton);
  check('press-button react: root carries aria-pressed={pressed === \'on\'}', reactRootTag(out.tsx).includes("aria-pressed={pressed === 'on'}"));
  check('press-button web-components: root carries aria-pressed', wcRootTag(out.wc.element).includes('aria-pressed="'));
  check('press-button html default: root carries aria-pressed="false"', htmlRootTag(out.html.html).includes(' aria-pressed="false"'));
  check('press-button html pressed=on: root carries aria-pressed="true"', htmlRootTag(out.html.html, 'pressed=on').includes(' aria-pressed="true"'));
  check('press-button react: exactly one type= on the root', attrCount(reactRootTag(out.tsx), 'type') === 1);
}

// ---- 4. web-components: v17 statesByProp is EMITTED --------------------
console.log('\nweb-components: statesByProp');
{
  const button = contracts.get('ds.button')!;
  const withStates = ContractSchema.parse({
    ...button,
    id: 'ds.button-sbp',
    name: 'ButtonSbp',
    anatomy: {
      root: {
        ...button.anatomy.root,
        statesByProp: [{ prop: 'variant', state: 'hover', map: { primary: { 'border-color': '{color.border.focus}' } } }],
        parts: {
          ...button.anatomy.root.parts,
          label: {
            ...button.anatomy.root.parts!.label,
            statesByProp: [{ prop: 'variant', state: 'hover', map: { danger: { color: '{color.border.focus}' } } }],
          },
        },
      },
    },
  });
  const { wc } = emitAll(withStates);
  check(
    "web-components: root statesByProp → [part='root']:where([data-variant='primary']):hover:not(:disabled) { border-color }",
    wc.stylesheet.includes("[part='root']:where([data-variant='primary']):hover:not(:disabled)") &&
      wc.stylesheet.includes('border-color: var(--color-border-focus)'),
  );
  check(
    "web-components: part statesByProp → [part='root']:where([data-variant='danger']):hover:not(:disabled) [part='label'] { color }",
    wc.stylesheet.includes("[part='root']:where([data-variant='danger']):hover:not(:disabled) [part='label']"),
  );
  check(
    'web-components: the emitted header never names statesByProp as a no-op',
    !wc.element.slice(0, wc.element.indexOf('*/')).includes('statesByProp'),
  );
  // The emitter's own vocabulary-coverage doc must tell the truth about attrs
  // and statesByProp (that header is the contract readers trust).
  const src = readFileSync(path.join(ROOT, 'packages/emitter-web-components/src/emit-wc.ts'), 'utf8');
  const doc = src.slice(0, src.indexOf('*/'));
  check('emit-wc.ts header lists statesByProp under EMITTED', /EMITTED:[\s\S]*statesByProp/.test(doc));
}

console.log(`\n${failures.length === 0 ? '✔ root-attrs-check: every anatomy.root.attrs entry is carried or named on react / react-inline / web-components / html' : `✖ root-attrs-check: ${failures.length} failure(s)`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
