/**
 * PLACEHOLDER INK — an EMPTY field must not read as a FILLED one.
 *
 *   npx tsx core/placeholder-ink-check.ts
 *
 * THE DEFECT THIS PINS (census 2026-08-24, class RC7 — five graded reds:
 * antd.input, carbon.textinput, ds.text-area, fluent.input, shadcn.input).
 * A leaf form control minted its placeholder TEXT node in the control's own
 * `color` — the VALUE ink — so every empty field on the canvas read as a
 * filled one (antd drew #1f1f1f against the library's #bfbfbf; Carbon
 * near-black against #a8a8a8), and where the placeholder string was a bound
 * prop with no default it drew NOTHING at all (fluent.input measured 0 dark
 * ink in every one of 42 cells; shadcn.input drew no text node whatsoever).
 *
 * THE MEASURED CAUSE, one layer under the symptom: `::placeholder` has been
 * READ since R7 (extract/computed/lib.ts READ_PSEUDOS, whose own comment
 * calls it "real ink a designer notices") but there was NO CHANNEL to carry
 * it to — extract/computed/run.ts says it outright, "Reading is not
 * carrying". The ink was measured on every run and thrown away between the
 * capture and the mint. `placeholder-color` is that channel.
 *
 * WHAT THIS KIT HOLDS, end to end through the plugin's own chain (parse →
 * plan → mock figma → dump → propose) plus the four code surfaces:
 *
 *   (a) CARRIED — a control that carries `placeholder-color` draws its
 *       placeholder in HINT ink, not VALUE ink, and names nothing lost.
 *   (b) FALLBACK, NAMED — a control with a placeholder but NO
 *       `placeholder-color` still draws (the value ink is the only ink
 *       there is) and the substitution is a code-only fact whose reason
 *       says an empty field therefore reads as a filled one.
 *   (c) THE STRING IS AN ATTRIBUTE, NOT DOM TEXT — a bound text prop with
 *       no default yields an EMPTY string; the node stays (the Figma TEXT
 *       property needs a node to bind to), the hint ink still paints, and
 *       the empty string is NAMED. Nothing is fabricated.
 *   (d) THE ROOT IS THE CONTROL — the antd/shadcn shape (semantics.element
 *       = input, no parts). It takes hint ink too, and a root with a
 *       literal `placeholder` attr and NO text prop draws that literal
 *       rather than nothing at all.
 *   (e) NO PLACEHOLDER CONCEPT, NO FABRICATED LOSS — a checkbox-shaped
 *       <input> part (no placeholder attr, no text prop) names NOTHING.
 *       The loss ledger and the "(N code-only facts)" headline are the
 *       instruments this project measures itself with; seeding them with
 *       facts that do not exist is its own defect.
 *   (f) THE CSS SURFACES — `placeholder-color` is not a CSS property and
 *       no UA has ever had one. Every stylesheet surface (React/CSS
 *       modules, static HTML, AND the web-components shadow stylesheet,
 *       which builds its own CSS and would otherwise ship the invalid
 *       declaration verbatim) lowers it to a `::placeholder` RULE; the
 *       inline-style surface, which has no selector to hang a pseudo on,
 *       REFUSES IT BY NAME. The part's own `color` still paints the value
 *       ink in every one of them.
 *   (g) THE RETURN LEG IS ELEMENT-GUARDED — the canvas→code fold that
 *       turns a `placeholder` TEXT child back into the parent's
 *       `placeholder-color` fires ONLY under a real <input>/<textarea>
 *       (an element that can hold no DOM children at all, so any child in
 *       the dump is emitter-synthesized). A plain <div> holding a text
 *       layer a designer happened to name "placeholder" keeps its part,
 *       its characters and its typography.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  createFigmaEngine,
  dumpCapturesHidden,
  emitHtml,
  emitReactInline,
  generateCss,
  proposeBatchFromDump,
  tokenCorpusFromJson,
  tokenInventoryFromJson,
  tokenSetTokenTrees,
  type CodeOnlyFact,
  type Contract,
  type TokenSetPayload,
} from './index.js';
import { shadowCss } from '../packages/emitter-web-components/src/emit-wc.js';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { mergeTokenTrees } from '../extract/figma/tokens.js';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

/** The dump script EXACTLY as the plugin runs it (mirrors root-text-check). */
function dumpSourceFor(setName: string): string {
  const ui = readFileSync(path.join(ROOT, 'figma-sync', 'plugin', 'ui.html'), 'utf8');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  if (start < 0) throw new Error('figma-sync/plugin/ui.html carries no #dump-source block');
  const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
  const scoped = source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([setName])};`);
  if (scoped === source) throw new Error('the dump script TARGET_SETS seam did not scope');
  return scoped;
}

// ---------------------------------------------------------------------------
// tokens: a VALUE ink and a HINT ink that are unmistakably different
// ---------------------------------------------------------------------------
const dtcg = {
  field: {
    ink: { $type: 'color', $value: '#111111' },
    hint: { $type: 'color', $value: '#8e8e8e' },
    size: { $type: 'dimension', $value: '14px' },
  },
};
const tokenSet: TokenSetPayload = {
  name: 'Field',
  base: {
    'field.ink': dtcg.field.ink,
    'field.hint': dtcg.field.hint,
    'field.size': dtcg.field.size,
  },
};

const seed = (
  id: string,
  name: string,
  body: Record<string, unknown>,
): Record<string, unknown> => ({
  $schema: './contract.schema.json',
  id,
  name,
  version: '0.1.0',
  status: 'draft',
  description: `placeholder-ink check seed ${name}`,
  props: [],
  states: [],
  bindings: {
    figma: { anchors: { fileKey: null, componentSetKey: null } },
    code: { anchors: { importPath: '@ds-contracts/placeholder-ink-check', export: name } },
  },
  ...body,
});

/** (a) the control CARRIES the hint ink. */
const CARRIED = seed('check.placeholder-carried', 'PlaceholderCarried', {
  semantics: { element: 'div' },
  anatomy: {
    root: {
      layout: { display: 'flex' },
      parts: {
        input: {
          element: 'input',
          attrs: { placeholder: 'Search' },
          tokens: { color: '{field.ink}', 'placeholder-color': '{field.hint}', 'font-size': '{field.size}' },
        },
      },
    },
  },
});

/** (b) the control carries NO hint ink — the value-ink fallback, NAMED. */
const FALLBACK = seed('check.placeholder-fallback', 'PlaceholderFallback', {
  semantics: { element: 'div' },
  anatomy: {
    root: {
      layout: { display: 'flex' },
      parts: {
        input: {
          element: 'input',
          attrs: { placeholder: 'Search' },
          tokens: { color: '{field.ink}', 'font-size': '{field.size}' },
        },
      },
    },
  },
});

/** (c) the string is a BOUND prop with no default — the empty string is
 *  NAMED and the node survives so the Figma TEXT property can bind. */
const BOUND_STRING = seed('check.placeholder-bound-string', 'PlaceholderBoundString', {
  semantics: { element: 'div' },
  props: [
    {
      name: 'placeholder',
      type: 'text',
      bindings: { figma: { kind: 'TEXT', property: 'Placeholder' }, code: { prop: 'placeholder' } },
    },
  ],
  anatomy: {
    root: {
      layout: { display: 'flex' },
      parts: {
        input: {
          element: 'input',
          attrs: { placeholder: '{placeholder}' },
          tokens: { color: '{field.ink}', 'placeholder-color': '{field.hint}', 'font-size': '{field.size}' },
        },
      },
    },
  },
});

/** (d) the ROOT is the control — the antd/shadcn shape. */
const ROOT_CONTROL = seed('check.placeholder-root-control', 'PlaceholderRootControl', {
  semantics: { element: 'input' },
  anatomy: {
    root: {
      attrs: { placeholder: 'Search' },
      declared: { display: 'block' },
      tokens: { color: '{field.ink}', 'placeholder-color': '{field.hint}', 'font-size': '{field.size}' },
    },
  },
});
const ROOT_CONTROL_FALLBACK = seed('check.placeholder-root-fallback', 'PlaceholderRootFallback', {
  semantics: { element: 'input' },
  anatomy: {
    root: {
      attrs: { placeholder: 'Search' },
      declared: { display: 'block' },
      tokens: { color: '{field.ink}', 'font-size': '{field.size}' },
    },
  },
});

/** (e) a form control with NO placeholder concept at all (the checkbox shape). */
const NO_CONCEPT = seed('check.placeholder-no-concept', 'PlaceholderNoConcept', {
  semantics: { element: 'div' },
  anatomy: {
    root: {
      layout: { display: 'flex' },
      parts: {
        box: {
          element: 'input',
          attrs: { type: 'checkbox' },
          tokens: { color: '{field.ink}', 'font-size': '{field.size}' },
        },
      },
    },
  },
});

/** (g) a plain <div> part holding a TEXT layer a designer named "placeholder".
 *  Nothing here is a form control; the return-leg fold must not touch it. */
const DECOY = seed('check.placeholder-decoy', 'PlaceholderDecoy', {
  semantics: { element: 'div' },
  anatomy: {
    root: {
      layout: { display: 'flex' },
      parts: {
        box: {
          layout: { display: 'flex' },
          parts: {
            placeholder: {
              text: 'No results yet',
              tokens: { color: '{field.hint}', 'font-size': '{field.size}' },
            },
          },
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
interface DumpText {
  name: string;
  type: string;
  text?: { characters?: string; fontSize?: number | null; fontStyle?: string | null };
  fill?: { var?: string; hex?: string };
  children?: DumpText[];
}
interface DumpSet {
  variants: Array<{ name: string; bbox: { width: number; height: number }; children: DumpText[] }>;
}

async function roundTrip(contractJson: Record<string, unknown>): Promise<{
  facts: CodeOnlyFact[];
  variant: DumpSet['variants'][number] | undefined;
  union: string;
  proposalAnatomy: Record<string, unknown> | undefined;
}> {
  const contract = ContractSchema.parse(contractJson) as Contract;
  const bundle = { type: 'CONTRACTS-BUNDLE', version: 1, tokenSet, contracts: [contractJson] };
  const plugin = createPluginEngine({
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    contracts: [],
    icons: {},
  });
  const parsed = plugin.parseIncomingText(JSON.stringify(bundle));
  if (!parsed.ok) throw new Error(`plugin parse refused: ${parsed.issue.headline}`);
  const plan = plugin.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
  if (!plan.ok) throw new Error(`plugin plan refused: ${plan.issues.map((i) => i.headline).join('; ')}`);
  const union: string[] = [...plan.notes];

  const engine = createFigmaEngine({ tokens: tokenSetTokenTrees(tokenSet), icons: new Map() });
  const data = engine.compileComponentData(contract, new Map([[contract.id, contract]]));
  const facts = data.codeOnlyFacts ?? [];
  for (const f of facts) union.push(`code-only ${f.kind} ${f.part}.${f.channel} = ${f.value} — ${f.reason}`);
  union.push(data.description);

  const { figma, root } = createFigmaMock();
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string): Promise<unknown> =>
    vm.runInContext(`(async () => {\n${code}\n})()`, ctx, { timeout: 300_000 }) as Promise<unknown>;
  for (const step of plan.steps) await run(step.code);

  type Marked = { name: string; type: string; getSharedPluginData: (ns: string, k: string) => string };
  const node = root.findOne(
    (n: Marked) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.getSharedPluginData('ds_contracts', 'contractId') === contract.id,
  ) as Marked | null;
  if (!node) throw new Error(`${contract.name}: the set was not built in the mock`);

  const dump = (await run(dumpSourceFor(node.name))) as Record<string, unknown>;
  for (const d of (dump._degradations ?? []) as Array<{ code: string; nodePath: string; message: string }>) {
    union.push(`degradation ${d.code} @ ${d.nodePath}: ${d.message}`);
  }
  const set = dump[node.name] as DumpSet | undefined;

  const corpus = tokenCorpusFromJson({ primitives: {}, semantic: mergeTokenTrees([dtcg]), light: {}, brandDefault: {} });
  const batch = proposeBatchFromDump(dump, {
    corpus,
    contractIdByName: new Map([[contract.name, contract.id]]),
    contractsById: new Map([[contract.id, contractJson as never]]),
    contractIdByKey: new Map(),
    fileKey: null,
    projectionMode: 'exact',
    mintUnbound: true,
    hiddenCaptured: dumpCapturesHidden(dump._provenance as never),
  });
  for (const s of batch.skipped) union.push(`skip: ${s.reason}${s.detail ? ` — ${s.detail}` : ''}`);
  union.push(...batch.notes);
  const proposal = batch.proposals.find((p) => p.setName === node.name) ?? batch.proposals[0];
  if (proposal) {
    union.push(...proposal.notes);
    for (const u of proposal.unbound) union.push(`unbound ${u.nodePath} ${u.property} = ${String(u.value)}`);
  }
  return {
    facts,
    variant: set?.variants[0],
    union: union.join('\n'),
    proposalAnatomy: (proposal?.contract as { anatomy?: Record<string, unknown> } | undefined)?.anatomy,
  };
}

/** Find the first TEXT node named `placeholder` anywhere in a variant tree. */
const findPlaceholder = (kids: DumpText[] | undefined): DumpText | undefined => {
  for (const k of kids ?? []) {
    if (k.type === 'TEXT' && k.name === 'placeholder') return k;
    const deep = findPlaceholder(k.children);
    if (deep) return deep;
  }
  return undefined;
};
const findText = (kids: DumpText[] | undefined, characters: string): DumpText | undefined => {
  for (const k of kids ?? []) {
    if (k.type === 'TEXT' && k.text?.characters === characters) return k;
    const deep = findText(k.children, characters);
    if (deep) return deep;
  }
  return undefined;
};

const partAt = (anatomy: Record<string, unknown> | undefined, pathParts: string[]): Record<string, unknown> | undefined => {
  let cur = anatomy?.root as Record<string, unknown> | undefined;
  for (const p of pathParts) {
    cur = ((cur?.parts ?? {}) as Record<string, Record<string, unknown>>)[p];
    if (!cur) return undefined;
  }
  return cur;
};

// ---------------------------------------------------------------------------
console.log('placeholder-ink (a): a control that CARRIES placeholder-color draws HINT ink, not VALUE ink');
{
  const r = await roundTrip(CARRIED);
  const ph = findPlaceholder(r.variant?.children);
  console.log(`    placeholder node: ${ph ? `characters=${JSON.stringify(ph.text?.characters)} fill=${ph.fill?.var ?? ph.fill?.hex ?? 'none'}` : 'ABSENT'}`);
  check('the canvas draws a TEXT node named "placeholder"', ph !== undefined);
  check('it draws the literal attr string ("Search")', ph?.text?.characters === 'Search');
  check('its fill is the HINT ink (field/hint), NOT the value ink (field/ink)', ph?.fill?.var === 'field/hint');
  check('no code-only fact claims the placeholder or its ink was dropped', !r.facts.some((f) => f.channel.startsWith('placeholder')));
  const input = partAt(r.proposalAnatomy, ['input']);
  const back = (input?.tokens as Record<string, string> | undefined)?.['placeholder-color'];
  check(
    `the return leg proposes it back at the EXACT spelling input.tokens['placeholder-color']${back ? ` = ${back}` : ''}`,
    back === '{field.hint}',
  );
  check('…and the control keeps its own VALUE ink (input.tokens.color = {field.ink})', (input?.tokens as Record<string, string> | undefined)?.color === '{field.ink}');
}

console.log('placeholder-ink (b): NO placeholder-color — the value-ink fallback still draws, and is NAMED');
{
  const r = await roundTrip(FALLBACK);
  const ph = findPlaceholder(r.variant?.children);
  check('the canvas still draws the placeholder (the value ink is the only ink there is)', ph?.text?.characters === 'Search');
  check('its fill is the control\'s own value ink (field/ink)', ph?.fill?.var === 'field/ink');
  const named = r.facts.filter((f) => f.channel === 'placeholder-color');
  console.log(`    ${named.length} placeholder-color fact(s): ${named.map((f) => `${f.part}=${f.value}`).join(', ')}`);
  check('the substitution is NAMED as a code-only fact on the control part', named.length === 1 && named[0].part === 'input');
  check('…whose reason says an empty field therefore reads as a filled one', named.some((f) => /empty field .*reads as a filled one/i.test(f.reason)));
  check('the fact reaches the plugin report / union text', /placeholder-color/.test(r.union));
}

console.log('placeholder-ink (c): a BOUND placeholder prop with no default — the STRING is an attribute, not DOM text');
{
  const r = await roundTrip(BOUND_STRING);
  const ph = findPlaceholder(r.variant?.children);
  check('the TEXT node still exists (the Figma TEXT property needs a node to bind to)', ph !== undefined);
  check('its characters are EMPTY — nothing is fabricated', ph?.text?.characters === '');
  check('the HINT ink still paints (field/hint)', ph?.fill?.var === 'field/hint');
  const named = r.facts.filter((f) => f.channel === 'placeholder');
  check('the missing STRING is NAMED as a code-only fact', named.length === 1 && named[0].part === 'input');
  check('…whose reason says the placeholder is an HTML ATTRIBUTE, not DOM text', named.some((f) => /attribute/i.test(f.reason) && /not DOM text/i.test(f.reason)));
}

console.log('placeholder-ink (d): the ROOT is the control (the antd / shadcn shape)');
{
  const r = await roundTrip(ROOT_CONTROL);
  const drawn = findText(r.variant?.children, 'Search');
  console.log(`    root label: ${drawn ? `${drawn.name} fill=${drawn.fill?.var ?? drawn.fill?.hex ?? 'none'}` : 'NOTHING DRAWN'}`);
  check('a root that IS the control draws its literal placeholder attr (shadcn drew nothing at all)', drawn !== undefined);
  check('it draws in HINT ink (field/hint), not the root\'s value ink', drawn?.fill?.var === 'field/hint');
  check('nothing is named as lost', !r.facts.some((f) => f.channel.startsWith('placeholder')));
}
{
  const r = await roundTrip(ROOT_CONTROL_FALLBACK);
  const named = r.facts.filter((f) => f.channel === 'placeholder-color');
  check('a root control WITHOUT the fact names the value-ink fallback on the root', named.length === 1 && named[0].part === 'root');
}

console.log('placeholder-ink (e): a form control with NO placeholder concept fabricates NO loss');
{
  const r = await roundTrip(NO_CONCEPT);
  const bogus = r.facts.filter((f) => f.channel.startsWith('placeholder'));
  console.log(`    ${r.facts.length} code-only fact(s); ${bogus.length} of them placeholder-shaped`);
  check('a checkbox-shaped <input> part names NO placeholder fact (it has no placeholder concept)', bogus.length === 0);
  check('…and the set description does not claim placeholder facts', !/placeholder/.test(r.union.split('\n').filter((l) => /code-only fact/.test(l)).join('\n')));
}

console.log('placeholder-ink (f): the CSS surfaces lower it to a ::placeholder RULE — never an invalid declaration');
{
  const contract = ContractSchema.parse(CARRIED) as Contract;
  const inventory = tokenInventoryFromJson([mergeTokenTrees([dtcg])]);
  const errors: string[] = [];
  const css = generateCss(contract, inventory, errors);
  check('generateCss accepts the channel (no contract violation)', errors.length === 0);
  check('the React/CSS surface emits a `::placeholder` rule with `color`', /::placeholder\s*\{[^}]*color:\s*var\(--field-hint\)/.test(css));
  check('…and NEVER an invalid `placeholder-color:` declaration', !/placeholder-color\s*:/.test(css));
  check('…and the part\'s own rule still paints the VALUE ink with `color`', /color:\s*var\(--field-ink\)/.test(css));

  const contractsMap = new Map([[contract.id, contract]]);
  const inlineTokens = { primitives: {}, semantic: mergeTokenTrees([dtcg]), light: {}, dark: {}, brands: { default: {} } };
  const html = emitHtml(contract, { tokens: inventory, icons: new Map(), contracts: contractsMap });
  check('the static HTML surface emits the `::placeholder` rule too', /::placeholder\s*\{[^}]*color:\s*var\(--field-hint\)/.test(html.css));
  check('…and NEVER an invalid `placeholder-color:` declaration', !/placeholder-color\s*:/.test(html.css));

  // THE WEB-COMPONENTS SURFACE builds its OWN shadow stylesheet and used
  // generateCss only as a validity referee — so a channel generateCss LOWERS
  // could reach the shadow sheet as the invalid declaration, unnamed. It is
  // the same class as `translate-x`, and it is pinned here.
  const wc = shadowCss(contract);
  check('the web-components shadow stylesheet emits the `::placeholder` rule', /::placeholder\s*\{[^}]*color:\s*var\(--field-hint\)/.test(wc));
  check('…and NEVER an invalid `placeholder-color:` declaration', !/placeholder-color\s*:/.test(wc));

  const inline = emitReactInline(contract, { tokens: inlineTokens, icons: new Map(), contracts: contractsMap, mode: 'light' });
  const inlineText = `${inline.tsx}`;
  check('the INLINE-STYLE surface refuses it BY NAME (a pseudo-element is a rule; an inline style object has no selector)', /placeholderColor/.test(inlineText) && /REFUSED BY NAME/.test(inlineText));
  check('…and writes no `placeholderColor` style value', !/placeholderColor:\s*[`'"]/.test(inlineText));
}

console.log('placeholder-ink (g): the return-leg fold is ELEMENT-guarded — a decoy layer named "placeholder" survives');
{
  const r = await roundTrip(DECOY);
  const box = partAt(r.proposalAnatomy, ['box']);
  const child = partAt(r.proposalAnatomy, ['box', 'placeholder']);
  console.log(`    proposed box: ${JSON.stringify(box).slice(0, 220)}`);
  check('the <div> part keeps its child part (the fold did not eat it)', child !== undefined);
  check('the child keeps its characters ("No results yet")', child?.text === 'No results yet');
  check('the child keeps its own ink', (child?.tokens as Record<string, string> | undefined)?.color === '{field.hint}');
  check('the child keeps a font-size (its typography is not lost with the layer)', typeof (child?.tokens as Record<string, string> | undefined)?.['font-size'] === 'string');
  check('the <div> parent gained NO placeholder-color channel', (box?.tokens as Record<string, string> | undefined)?.['placeholder-color'] === undefined);
  check('the <div> parent gained NO `placeholder` attribute', (box?.attrs as Record<string, string> | undefined)?.placeholder === undefined);
}

if (failures.length > 0) {
  console.error(`\n✘ placeholder-ink: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ placeholder-ink: an EMPTY field reads as empty — the hint ink is carried, the missing string is named, and no surface ships an invalid declaration');
