/**
 * The Spec — generated reference. One page per schema area; every branch of
 * scripts/contract-schema.ts is covered (enforced by coverage.ts).
 *
 * Honesty model, labeled per section:
 *   GENERATED — field names, types, optionality: rendered from the Zod
 *               schema by introspection at build time.
 *   CURATED   — prose, constraint summaries (distilled from the refusal
 *               rules in core/emit-react.ts validateContract and the schema's
 *               own commentary), fidelity notes.
 *   EXAMPLE   — excerpts of shipping contracts in contracts/, engine replays
 *               of committed capture fixtures, or schema-validated
 *               illustrative snippets — provenance in each caption.
 */
import * as z from 'zod';
import {
  ContractSchema,
  PropSchema,
  PartSchema,
  SlotSchema,
  SlotContentItemSchema,
  ComponentRefSchema,
  RepeatSchema,
  LayoutSchema,
  VariantLayoutSchema,
  LayoutByPropSchema,
  TokensByPropSchema,
  StylesWhenSchema,
  OverlaySchema,
  ShapeSchema,
  VisibleWhenSchema,
  EventSchema,
  STYLES_WHEN_ALLOWED,
} from '../../../scripts/contract-schema.js';
import { layout, codeBlock, badge, esc, REPO_URL, type Provenance } from '../html.js';
import { fieldsOf, resolveLazy, unwrap, typeText } from '../introspect.js';
import { SPEC_PAGES, pageMeta, type PageId, type CoverageReceipt } from '../coverage.js';
import { shippingExample, illustrativeExample, loadReplays, replayedBlock } from '../examples.js';

type AnySchema = z.ZodType;

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

const VERSIONING_ROUTE = '/spec/versioning/';

function sideNav(activePath: string): string {
  const link = (href: string, label: string): string =>
    `<a class="sidenav__link${activePath === href ? ' is-active' : ''}" href="${href}">${label}</a>`;
  return [
    `<p class="sidenav__group">Specification</p>`,
    link('/spec/', 'Overview'),
    `<p class="sidenav__group">Reference</p>`,
    ...SPEC_PAGES.map((p) => link(p.route, p.nav)),
    // Deliberately last: versioning is policy, not vocabulary.
    link(VERSIONING_ROUTE, 'Versioning'),
  ].join('');
}

function section(id: string, title: string, provs: Provenance[], body: string): string {
  const badges = provs.map((p) => badge(p)).join('');
  return `<section id="${id}"><h2 class="anchor-heading">${title}${badges}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h2>${body}</section>`;
}

/** GENERATED field list for an object schema. Descriptions are curated. */
function fieldList(
  schema: AnySchema,
  desc: Record<string, string> = {},
  opts: { only?: string[]; skip?: string[] } = {},
): string {
  let fields = fieldsOf(resolveLazy(schema));
  if (opts.only) fields = fields.filter((f) => opts.only!.includes(f.name));
  if (opts.skip) fields = fields.filter((f) => !opts.skip!.includes(f.name));
  const rows = fields
    .map((f) => {
      const d = desc[f.name];
      const dflt =
        f.defaultValue !== undefined
          ? ` <span class="field__type">(default: <code>${esc(JSON.stringify(f.defaultValue))}</code>)</span>`
          : '';
      return `<div class="field"><div class="field__head"><span class="field__name">${esc(f.name)}</span>${
        f.optional ? '' : '<span class="field__req">required</span>'
      }<span class="field__type">${esc(f.type)}</span>${dflt}</div>${
        d ? `<p class="field__desc">${d}</p>` : ''
      }</div>`;
    })
    .join('');
  return `<div class="field-list">${rows}</div>`;
}

/** CURATED refusal-rule summary, sourced from validateContract. */
function refusals(intro: string, items: string[]): string {
  return `<p class="section-note">${intro} Each of these fails the build <em>by name</em> — the generator refuses, it never papers over (source: <code>core/emit-react.ts</code> <code>validateContract</code>, exercised by the C2 eval family).</p><ul class="refusals">${items
    .map((i) => `<li>${i}</li>`)
    .join('')}</ul>`;
}

function fidelity(html: string): string {
  return `<div class="fidelity">${html}</div>`;
}

function prevNext(id: PageId): string {
  const i = SPEC_PAGES.findIndex((p) => p.id === id);
  const prev = SPEC_PAGES[i - 1];
  const next = SPEC_PAGES[i + 1];
  const prevHtml = prev
    ? `<a class="prev" href="${prev.route}"><span>Previous</span>${prev.title}</a>`
    : `<a class="prev" href="/spec/"><span>Previous</span>Spec overview</a>`;
  const nextHtml = next
    ? `<a class="next" href="${next.route}"><span>Next</span>${next.title}</a>`
    : `<a class="next" href="${VERSIONING_ROUTE}"><span>Next</span>Spec versioning</a>`;
  return `<nav class="prev-next" aria-label="Reference pages">${prevHtml}${nextHtml}</nav>`;
}

function specPage(id: PageId, lede: string, body: string): { route: string; html: string } {
  const meta = pageMeta(id);
  const html = layout(
    {
      path: meta.route,
      title: `${meta.title} — Design System Contracts spec`,
      description: lede.replace(/<[^>]+>/g, '').slice(0, 250),
      sidebar: sideNav(meta.route),
      mainClass: 'spec-page',
      schemaStamp: true,
    },
    `<p class="eyebrow">Spec reference</p><h1>${meta.title}</h1><p class="lede">${lede}</p>${body}${prevNext(id)}`,
  );
  return { route: meta.route, html };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function contractPage(): { route: string; html: string } {
  const semantics = (ContractSchema.shape as Record<string, AnySchema>).semantics;
  void semantics;
  const body = [
    section(
      'fields',
      'Top-level fields',
      ['generated', 'curated'],
      `<p>A contract is one JSON document per component — <code>contracts/&lt;component&gt;.contract.json</code>. It captures everything design and engineering must agree on; both libraries are renderers of it. Types below are rendered from the schema; follow the links for the fields that have their own pages.</p>` +
        fieldList(ContractSchema as AnySchema, {
          $schema: 'Editor affordance: points at the emitted JSON Schema (<code>contracts/contract.schema.json</code>, <code>npm run schema</code>) so contracts validate inline as you type.',
          id: 'Stable canonical identity — <strong>never renamed</strong>. The namespace before the dot is the owning system’s (<code>ds.button</code> here, <code>acme.chip</code> in a brownfield extraction). Display names may change on either side; the <code>id</code> is what survives.',
          name: 'Display / export name (<code>Button</code>). Drives the code export and the canvas component-set name. Must be PascalCase — it becomes file names.',
          version: 'Semver, the unit of change management. Added optional prop = minor; removed or renamed prop or value = major. See <a href="/spec/versioning/">versioning</a>.',
          status: 'Governance lifecycle: <code>draft</code> → <code>stable</code> → <code>deprecated</code>.',
          description: 'Usage intent — one sentence, flowing into Storybook autodocs and the canvas component description. The same sentence on both surfaces, from one source.',
          semantics: `The HTML element, ARIA role, and prop-driven variants of both — see <a href="/spec/semantics/">Semantics &amp; accessibility</a>.`,
          props: `The canonical API — see <a href="/spec/props/">Props &amp; bindings</a>.`,
          events: `The declared interaction surface — see <a href="/spec/events/">Events &amp; toggles</a>.`,
          states: `Interaction states the component must support — see <a href="/spec/states/">States</a>.`,
          figmaRepresentation: '<code>component</code> (default) generates a canvas component set. <code>native</code> declares the concept maps to a native canvas capability (layout primitives <em>are</em> auto-layout): no canvas component is generated, parity does not expect one, and the code surface is still fully generated and checked.',
          modes: 'Receipt-grade metadata naming the token modes a drawn theme/mode variant axis carried (e.g. <code>["light","dark"]</code>). The axis is never a prop — theming lives in the token collection’s modes — so this field changes no emitter output; it names the fact for reviewers and round-trip tooling.',
          figmaStatePreviews: `Opt-in canvas-only state previews — see <a href="/spec/states/#state-previews">States</a>.`,
          anatomy: `The named part tree where all styling decisions live — see <a href="/spec/anatomy/">Anatomy &amp; parts</a>.`,
          a11y: 'Executable accessibility requirements — see below.',
          anchors: 'Per-side identity anchors — see below.',
        }),
    ),
    section(
      'anchors',
      'Anchors — rename-safe identity',
      ['generated', 'curated'],
      `<p>The DTCG <code>$extensions</code> dual-ID pattern applied to components. After the first generation on each side, that side’s stable identifiers are written back here (<code>npm run anchors:writeback</code>). From then on, renames on either side never fork identity — parity matches by anchor, not by name.</p>` +
        fieldList((ContractSchema.shape as Record<string, AnySchema>).anchors, {
          figma: 'The design-tool side: file key, component-set key, node id. <code>null</code> until first sync — the differ reports such contracts as <em>pending</em>, which is workflow state, not drift.',
          code: 'The code side: import path and export name of the generated component.',
        }) +
        shippingExample('button.contract.json', {
          paths: ['id', 'name', 'version', 'status', 'anchors'],
        }),
    ),
    section(
      'a11y',
      'a11y — declared requirements',
      ['generated', 'curated'],
      fieldList(unwrap((ContractSchema.shape as Record<string, AnySchema>).a11y).schema, {
        focusVisible: 'The component must have a visible focus treatment (drives the focus-visible state rules).',
        minHitArea: 'Minimum hit area in px.',
        contrast: 'Target WCAG contrast tier.',
      }) +
        fidelity(
          `<p><strong>Honesty note:</strong> the <code>a11y</code> block is declarative-only today — <code>minHitArea</code> and <code>contrast</code> are recorded but no generator or differ enforces them yet. The roadmap names the choice: enforce or remove. (This caveat is stated in <a href="${REPO_URL}/blob/main/docs/07-validation.md">docs/07 — Validation</a>, and this page repeats it rather than hiding it.)</p>`,
        ),
    ),
  ].join('');
  return specPage(
    'contract',
    'Identity, lifecycle, anchors, and the top level of the document — the shape everything else hangs from.',
    body,
  );
}

function semanticsPage(): { route: string; html: string } {
  const semanticsSchema = (ContractSchema.shape as Record<string, AnySchema>).semantics;
  const body = [
    section(
      'semantics',
      'Element & role',
      ['generated', 'curated'],
      `<p>The code renderer’s HTML element, and the ARIA role when it differs from the element’s native one. The element vocabulary is a closed enum — a contract cannot ask for an element the generator has no accessibility knowledge of.</p>` +
        fieldList(semanticsSchema, {
          element: 'The root HTML element on the code side. The canvas is unaffected (frames carry no element semantics).',
          role: 'ARIA role, when it differs from the element’s native role.',
          roleException: 'See <a href="#role-exception">declared role exceptions</a>.',
          roleByProp: 'See <a href="#role-by-prop">role by prop</a>.',
          elementByProp: 'See <a href="#element-by-prop">element by prop</a>.',
        }),
    ),
    section(
      'role-by-prop',
      'Role by prop',
      ['generated', 'curated'],
      `<p>An ARIA role driven by an enum prop. Banner’s canonical case: <code>status: error</code> → <code>role="alert"</code>, <code>status: info</code> → <code>role="status"</code>. Code emits a lookup; <code>roleByProp</code> overrides <code>role</code>.</p>` +
        shippingExample('banner.contract.json', { paths: ['semantics'] }),
    ),
    section(
      'element-by-prop',
      'Element by prop',
      ['generated', 'curated'],
      `<p>The rendered HTML element follows an enum prop — Heading’s <code>level</code> maps <code>"2" → h2</code>. Code emits an <code>ELEMENT_MAP</code> lookup and renders a dynamic tag; <code>semantics.element</code> is the fallback. The canvas is unaffected — a declared fidelity boundary.</p>` +
        refusals('Build-time guardrails:', [
          'the driving prop must be a declared enum',
          'the map must cover <em>every</em> enum value',
          'every mapped element must be in the code generator’s element vocabulary',
        ]) +
        shippingExample('heading.contract.json', { paths: ['semantics', 'props'], limit: { props: 1 } }),
    ),
    section(
      'role-exception',
      'Declared role exceptions',
      ['generated', 'curated'],
      `<p>The native-semantics lint refuses a role that has a native HTML equivalent claimed on a non-native element — the imported-button principle: native elements over ARIA re-creation, always. Legitimate APG composites declare an exception: a one-sentence reason, carried in the contract (<code>semantics.roleException</code> for root-level claims, <code>part.roleException</code> per part), rendered on the spec sheet. Reviewable, never silent.</p>` +
        shippingExample('progress-bar.contract.json', {
          paths: ['semantics.roleException', 'anatomy.root.attrs'],
        }, 'the role rides anatomy.root.attrs; the exception names why'),
    ),
  ].join('');
  return specPage(
    'semantics',
    'What the component <em>is</em> to the platform: element, ARIA role, prop-driven variants of both, and the named exceptions the lint demands.',
    body,
  );
}

function propsPage(replays: Awaited<ReturnType<typeof loadReplays>>): { route: string; html: string } {
  const propShape = PropSchema.shape as unknown as Record<string, AnySchema>;
  const bindings = propShape.bindings;
  const bindingsShape = (resolveLazy(bindings) as unknown as { shape: Record<string, AnySchema> }).shape;
  const body = [
    section(
      'props',
      'The canonical API',
      ['curated'],
      `<p>Each prop declares its canonical name, type, and default — and <em>bindings</em>, which describe how the one canonical prop manifests on each side. The canonical value set lives here and only here: canvas spelling (<code>"Primary"</code>) and code spelling (<code>"primary"</code>) are renderings of the canonical value.</p>`,
    ),
    section(
      'prop-fields',
      'Prop fields',
      ['generated', 'curated'],
      fieldList(PropSchema as unknown as AnySchema, {
        name: 'Canonical prop name — the spelling the contract owns.',
        description: 'Flows into JSDoc and Storybook autodocs.',
        type: 'See <a href="#prop-types">types</a>.',
        default: 'Must match the type — enum defaults must be members, boolean defaults booleans, and so on (refused by name otherwise). Required text props must still declare a string default: it is the canvas default and the story sample.',
        required: 'Text props may be required (no default in the code signature).',
        bindings: 'See <a href="#bindings">bindings</a>.',
      }),
    ),
    section(
      'prop-types',
      'Types',
      ['generated', 'curated'],
      `<p>Five kinds, rendered from the schema union:</p><div class="table-wrap"><table><thead><tr><th>Kind</th><th>Code surface</th><th>Canvas surface</th></tr></thead><tbody>
<tr><td><code>"boolean"</code></td><td>native attribute where the element supports it (<code>disabled</code> on <code>&lt;button&gt;</code>), otherwise a <code>data-*</code> attribute</td><td>BOOLEAN property</td></tr>
<tr><td><code>"text"</code></td><td><code>children</code> or a string prop</td><td>TEXT property</td></tr>
<tr><td><code>"number"</code></td><td>number prop</td><td>TEXT property (stringified)</td></tr>
<tr><td><code>{ enum: [...] }</code></td><td>typed union prop; one CSS class per value</td><td>VARIANT axis; every enum prop becomes an axis (full cartesian, defaults-first)</td></tr>
<tr><td><code>{ arrayOf: {...} }</code></td><td><code>items?: Array&lt;{ … }&gt;</code> — an optional array; <code>undefined</code> means “not provided”, never a silent <code>[]</code></td><td><em>none</em> — code-only by declared fidelity limit (see below)</td></tr>
</tbody></table></div>` +
        codeBlock(`type: ${typeText(propShape.type)}`, 'ts', 'prop.type — rendered from the schema union at build time') +
        fidelity(
          `<p><strong>Declared fidelity limit — structured props.</strong> The canvas has no list-of-records property type, so an <code>arrayOf</code> prop must bind <code>figma.kind: "NONE"</code> and every design-side consumer skips it rather than reporting it behind. Both directions are enforced: <code>arrayOf ⇔ kind "NONE"</code>.</p>`,
        ) +
        replayedBlock(
          replays.repeatProp,
          'arrayOf prop proposed at build time by the import engine (core/propose-figma) from the committed owner’s-kit fixture extract/figma/gauntlet/fixtures/pattern-repeat-collection-navigation-header.dump.json',
        ),
    ),
    section(
      'bindings',
      'Bindings — one prop, two manifestations',
      ['generated', 'curated'],
      fieldList(bindings, {
        figma: 'How the prop appears on the canvas: property kind, property name, and the canonical-value → variant-value spelling map.',
        code: 'The React prop name.',
      }) +
        codeBlock(
          `figma: ${typeText(bindingsShape.figma)}\ncode:  ${typeText(bindingsShape.code)}`,
          'ts',
          'prop.bindings — rendered from the schema at build time',
        ) +
        refusals('Refusal rules on props and bindings:', [
          'duplicate prop names; duplicate <em>code</em> bindings across props, slots, and events (the git-merge attack)',
          'two props binding the same design property — the canvas cannot host both',
          'an enum default outside the enum; type-mismatched defaults',
          'a figma <code>values</code> map missing an enum value, or carrying a key that is not one',
          '<code>kind: "NONE"</code> on a non-<code>arrayOf</code> prop — every scalar prop has a canvas manifestation',
          '<code>bindings.figma.property</code> required unless kind is <code>"NONE"</code> — and refused when it is',
        ]) +
        shippingExample('button.contract.json', { paths: ['props'], limit: { props: 1 } }),
    ),
  ].join('');
  return specPage(
    'props',
    'The canonical API: names, five type kinds, defaults — and the bindings that render one prop onto two surfaces.',
    body,
  );
}

function anatomyPage(): { route: string; html: string } {
  const body = [
    section(
      'anatomy',
      'The part tree',
      ['generated', 'curated'],
      `<p>Anatomy is a <strong>nested tree</strong> of named parts (<code>Record&lt;partName, Part&gt;</code>) — contracts are authored and reviewed by humans, and a tree reads like the component. A <code>root</code> part is mandatory. Part names are unique per contract. Every styling decision lives here as a <a href="/spec/tokens/">token binding</a>; there is no handwritten style layer to drift.</p><p>A part is structural by default (a frame on the canvas, an element in code, containing <code>parts</code>), or it plays one of the roles on this and the following pages: text content, icon, meter, <a href="/spec/shape/">shape</a>, <a href="/spec/composition/">slot / component ref / repeat template</a>.</p>` +
        fieldList(PartSchema as unknown as AnySchema, {
          description: 'Reviewer-facing note on the part’s purpose.',
          element: 'HTML element for this part (code side). Defaults: <code>div</code> structural, <code>span</code> content. Root uses <code>semantics.element</code>.',
          roleException: 'Named exception to the native-semantics lint — see <a href="/spec/semantics/#role-exception">Semantics</a>.',
          layout: 'Flexbox / auto-layout — see <a href="/spec/layout/">Layout</a>.',
          layoutByProp: 'Per-enum-value layout overrides — see <a href="/spec/layout/#layout-by-prop">Layout</a>.',
          stylesWhen: 'Conditional literal styles — see <a href="/spec/conditionals/#styles-when">Conditionals</a>.',
          overlay: 'Out-of-flow edge attachment — see <a href="/spec/conditionals/#overlay">Conditionals</a>.',
          shape: 'Parametric leaf decor — see <a href="/spec/shape/">Shape parts</a>.',
          tokens: 'CSS property → token reference — see <a href="/spec/tokens/">Token bindings</a>.',
          tokensByProp: 'Per-enum-value token overrides — see <a href="/spec/tokens/#tokens-by-prop">Token bindings</a>.',
          states: 'Interaction-state token overrides — see <a href="/spec/states/">States</a>.',
          content: 'Text content bound to a declared text prop — see below.',
          text: 'Static literal text — see below.',
          meter: 'Progress fill geometry — see below.',
          animation: 'CSS-side motion — see <a href="/spec/conditionals/#animation">Conditionals</a>.',
          slot: 'Constrained insertion point — see <a href="/spec/composition/#slots">Composition</a>.',
          component: 'Fixed instance of another contract — see <a href="/spec/composition/#component-refs">Composition</a>.',
          repeat: 'Item template over an arrayOf prop — see <a href="/spec/composition/#repeat">Composition</a>.',
          icon: 'Icon asset part — see below.',
          attrs: 'HTML/ARIA attributes — see below.',
          visibleWhen: 'Conditional visibility — see <a href="/spec/conditionals/#visible-when">Conditionals</a>.',
          optional: 'Optional parts render conditionally (code: when the slot prop is provided; canvas: a “Show X” boolean controls visibility).',
          parts: 'Child parts — the tree.',
        }),
    ),
    section(
      'part-fields',
      'Structure',
      ['curated'],
      `<p>Composition rules enforced at build time: part names unique per contract, a mandatory <code>root</code>, cycles and unknown contract references fail the build, and sync scripts emit in dependency order. A duplicate anatomy part name is refused by name.</p>` +
        shippingExample('banner.contract.json', {
          paths: ['anatomy.root.parts.body'],
        }, 'a structural part with content-bound children'),
    ),
    section(
      'content',
      'Text: content & literal text',
      ['generated', 'curated'],
      `<p><code>content: { prop }</code> binds a part’s text to a declared text prop — <code>{title}</code> in the part’s element on the code side, a text node linked to the text property on the canvas. <code>text</code> is static literal text (a page number, an ellipsis) — the same on both surfaces, bound to nothing.</p>` +
        refusals('Refusals:', [
          '<code>content.prop</code> must name a declared text prop (checked against the prop’s <em>code binding</em> name)',
        ]) +
        shippingExample('banner.contract.json', { paths: ['anatomy.root.parts.body.parts.title'] }),
    ),
    section(
      'icon',
      'Icon parts',
      ['generated', 'curated'],
      `<p><code>icon: { asset, size? }</code> renders <code>assets/icons/&lt;asset&gt;.svg</code> inline on the code side and as a vector on the canvas. <code>'{prop}'</code> substitutes an enum prop — icon-by-status. Icons are always decorative (<code>aria-hidden</code>).</p>` +
        refusals('Refusals:', [
          'an icon asset that does not exist on disk — <code>needs icon asset "assets/icons/….svg" which does not exist</code>',
        ]) +
        shippingExample('banner.contract.json', { paths: ['anatomy.root.parts.statusIcon'] }),
    ),
    section(
      'attrs',
      'Attributes',
      ['generated', 'curated'],
      `<p><code>attrs</code> sets HTML/ARIA attributes on the part’s element — literal strings or <code>'{prop}'</code> references (refused when the prop doesn’t exist). Code-side surface; the canvas ignores it. A real <code>&lt;input type="checkbox|radio"&gt;</code> declared this way is recognized as a native checkable control: code surfaces render it as the focusable control (checked state is DOM state, never ARIA), and the canvas draws nothing for it — semantics don’t draw.</p>` +
        shippingExample('checkbox.contract.json', { paths: ['anatomy.root.parts.box.parts.input'] }),
    ),
    section(
      'meter',
      'Meter parts',
      ['generated', 'curated'],
      `<p><code>meter: { valueProp, maxProp }</code> — progress fill: width = value/max as a percentage of the parent track. Code computes live; the canvas renders the defaults’ fraction — its honest static state. The same discipline repeats across the spec: where a surface cannot run a live computation, it renders the declared sample and says so.</p>` +
        shippingExample('progress-bar.contract.json', { paths: ['anatomy.root.parts.track'] }),
    ),
  ].join('');
  return specPage(
    'anatomy',
    'The named part tree — where structure, text, icons, and every styling decision live. One definition; a frame tree and an element tree are both renderings of it.',
    body,
  );
}

function layoutPage(): { route: string; html: string } {
  const body = [
    section(
      'layout',
      'The layout block',
      ['generated', 'curated'],
      `<p>One vocabulary, two projections: flexbox on the code side, auto-layout on the canvas. The properties are the intersection both surfaces can honor — that is the point.</p>` +
        fieldList(LayoutSchema as AnySchema, {
          display: '<code>flex</code> or <code>inline-flex</code> (code); auto-layout either way on the canvas.',
          direction: 'Row or column. Reversed directions exist only as per-variant overrides (see below) — the canvas has no reverse, so they are compiled away.',
          align: 'Cross-axis alignment.',
          justify: 'Main-axis distribution.',
          grow: 'The part takes remaining space — code: <code>flex: 1 1 auto</code>; canvas: fill container.',
          overlap: 'Children overlap (AvatarGroup): the gap token is applied as a <em>negative</em> child margin in CSS and as negative item spacing on the canvas.',
        }) +
        shippingExample('avatar-group.contract.json', { paths: ['anatomy.root.parts.stack.layout', 'anatomy.root.parts.stack.tokens'] }, 'overlap — the negative-spacing projection'),
    ),
    section(
      'layout-by-prop',
      'Layout by prop',
      ['generated', 'curated'],
      `<p><code>layoutByProp: { prop, map }</code> applies per-enum-value layout overrides merged over the base <code>layout</code>. Partial coverage is the point — only the values that deviate appear. ChatMessage: <code>sender=user</code> flips <code>direction: row-reverse</code> on the root, right-aligning user messages.</p><p>Projections: code emits the override under the root’s enum class (<code>.sender-user .body { … }</code>); the canvas — which has no reverse — resolves it per variant at compile time, rendering the same children in reversed order.</p>` +
        codeBlock(`map values: ${typeText(VariantLayoutSchema as AnySchema)}`, 'ts', 'layoutByProp.map values — VariantLayout, rendered from the schema') +
        refusals('Refusals:', [
          'the driving prop must be a declared enum; every map key one of its values',
          'a component-instance part refuses overrides — the child contract owns its layout',
          '<code>grow</code> and <code>overlap</code> stay per-part invariants: not overridable per variant',
        ]) +
        shippingExample('chat-message.contract.json', { paths: ['anatomy.root.layoutByProp'] }),
    ),
  ].join('');
  return specPage(
    'layout',
    'Flexbox and auto-layout are the same declaration here — plus per-variant overrides for the cases where a value legitimately deviates.',
    body,
  );
}

function tokensPage(): { route: string; html: string } {
  const body = [
    section(
      'tokens',
      'Token bindings & substitution',
      ['generated', 'curated'],
      `<p>Every visual decision is a binding from a CSS property to a DTCG token reference — <code>Record&lt;cssProperty, TokenRef&gt;</code> where a <code>TokenRef</code> is a brace-wrapped token path. The CSS Module <em>and</em> the canvas variable bindings are generated from these; there is no handwritten style layer to drift.</p><p><strong>Substitution:</strong> a <code>{propName}</code> placeholder inside a token path expands over that enum prop’s values — <code>{color.action.{variant}.background}</code> produces one CSS rule per variant and one bound variable per canvas variant. Root parts support multi-axis substitution; nested parts one placeholder per reference.</p>` +
        codeBlock(
          `TokenRef = string matching /^\\{[a-z0-9.{}-]+\\}$/i\n// e.g. "{color.action.primary.background}"\n//      "{color.action.{variant}.background}"  ← substituted over an enum prop`,
          'ts',
          'TokenRef — pattern rendered from the schema',
        ) +
        `<p><strong>The integrity gate:</strong> at generation time, every reference — <em>after</em> expansion — must resolve to a real token in <code>tokens/</code>. A binding to a nonexistent token fails the build with the exact contract path and missing token named. The contract and the token set cannot silently disagree (eval: <code>refuse-unknown-token-reference</code>).</p>` +
        refusals('Refusals:', [
          'malformed references — anything not brace-wrapped token-path shaped',
          'a substituted reference naming a prop that is not a declared enum',
          'more than one placeholder on a nested part’s reference',
        ]) +
        shippingExample('button.contract.json', { paths: ['anatomy.root.tokens'] }),
    ),
    section(
      'tokens-by-prop',
      'Tokens by prop',
      ['generated', 'curated'],
      `<p><code>tokensByProp: { prop, map }</code> — the value-level sibling of the substituted reference. A substituted ref can only carry bindings whose token <em>names</em> spell the axis value; real foreign vocabularies name tokens by scale step (<code>{spacing.200}</code> on large, <code>{spacing.150}</code> on small), so a binding that is a plain function of one enum axis needs a per-value map. Map values are overrides merged over the part’s base <code>tokens</code>; only the values that deviate appear, and refs are plain — no placeholders.</p>` +
        fieldList(TokensByPropSchema as AnySchema, {
          prop: 'The driving enum prop, by canonical name.',
          map: 'enum value → (CSS property → plain TokenRef), merged over the base tokens.',
        }) +
        refusals('Refusals:', [
          'the driving prop must be a declared enum; every map key one of its values',
          'a placeholder inside a mapped ref — per-value maps <em>are</em> the substitution; a placeholder would be double substitution',
          'a component-instance part — the child contract owns its styling',
        ]) +
        shippingExample('token.contract.json', { paths: ['anatomy.root.tokensByProp'] }),
    ),
  ].join('');
  return specPage(
    'tokens',
    'Styling is a set of bindings to design tokens — generated onto both surfaces, gated for integrity at build time, never handwritten.',
    body,
  );
}

function statesPage(): { route: string; html: string } {
  const statesField = (ContractSchema.shape as Record<string, AnySchema>).states;
  const body = [
    section(
      'declared-states',
      'Declared states',
      ['generated', 'curated'],
      `<p>The interaction states the component must support. Declared once; rendered per surface at that surface’s fidelity — code gets real CSS pseudo-class rules, the canvas gets <a href="#state-previews">opt-in preview variants</a>.</p>` +
        codeBlock(`states: ${typeText(statesField)}  // default: []`, 'ts', 'contract.states — rendered from the schema') +
        shippingExample('button.contract.json', { paths: ['states', 'anatomy.root.states'] }),
    ),
    section(
      'root-states',
      'State token overrides — root and parts',
      ['generated', 'curated'],
      `<p><code>part.states</code> maps a state to token overrides: <code>Record&lt;state, Record&lt;cssProperty, TokenRef&gt;&gt;</code>. On the <strong>root</strong>: the full state vocabulary (background-color, outline-*, opacity, …). On a <strong>non-ref part</strong> (text, icon, box — never a component ref or slot): color-kind channels only (<code>color</code>, <code>background-color</code>, <code>border-color</code>), rendered as descendant rules under the root’s state selector (<code>.root:disabled .label { color: … }</code>) and applied inside canvas state-preview variants.</p>` +
        refusals('Refusals:', [
          'unknown state names; a part override for a state the contract’s <code>states</code> does not declare',
          'states on a component-instance part (the child contract owns its styling) or on a slot (the consumer owns its content)',
          'non-color channels on non-root parts',
        ]) +
        illustrativeExample(
          PartSchema,
          {
            element: 'span',
            tokens: { color: '{color.text.primary}' },
            states: { disabled: { color: '{color.text.secondary}' } },
          },
          'a part-level state override (schema v13)',
        ) +
        `<p class="section-note">No shipping contract in <code>contracts/</code> uses part-level state overrides yet — the capability came from a brownfield field case (a disabled table row washing out its label) and is exercised by <code>npm run extract:figma:partstate:check</code> against committed fixtures. The example above is validated against the live schema at build time.</p>`,
    ),
    section(
      'state-previews',
      'Canvas state previews (figmaStatePreviews)',
      ['generated', 'curated'],
      `<p>Code gets real <code>:hover</code>/<code>:focus-visible</code>/<code>:disabled</code>; the canvas cannot run pseudo-classes, so real systems hand-build “State=Hover” variant axes — and those rot. <code>figmaStatePreviews: true</code> makes the generator own that axis instead: a <code>State</code> variant axis (<code>Default</code>, <code>Hover</code>, …) where each non-default state applies the state’s token overrides on top of the variant’s base bindings. The mirror image of code-only events: state previews are canvas-only, and the code surface is completely unaffected.</p><p>Bounded explosion: previews multiply only the <em>primary</em> enum axis — the one the overrides substitute (<code>{color.action.{variant}.background-hover}</code> names <code>variant</code>); every other axis sits at its default.</p>` +
        refusals('The opt-in is refused by name when:', [
          'the contract declares no states',
          'any declared state has no root token overrides — its preview would render identically to Default',
          'overrides substitute more than one enum prop',
          'a prop already binds the design property <code>State</code>',
        ]) +
        `<p>The differ treats the axis as contract API in both directions: a missing axis on an opted-in contract is <code>figma BEHIND</code>; a hand-built <code>State</code> axis <em>without</em> the opt-in is <code>figma AHEAD</code> — the kit-rot detector — and the proposed patch is the honest one: <code>figmaStatePreviews: true</code>, never a bogus <code>state</code> prop.</p>` +
        shippingExample('button.contract.json', { paths: ['figmaStatePreviews', 'states'] }),
    ),
  ].join('');
  return specPage(
    'states',
    'Interaction states, declared once — real pseudo-classes in code, generator-owned preview variants on the canvas, and token overrides down to individual parts.',
    body,
  );
}

function conditionalsPage(): { route: string; html: string } {
  const allowed = [...STYLES_WHEN_ALLOWED].map((p) => `<code>${p}</code>`).join(', ');
  const body = [
    section(
      'visible-when',
      'visibleWhen — conditional parts',
      ['generated', 'curated'],
      `<p>The part renders only when the prop matches. Boolean props map to canvas visibility bindings; enum conditions resolve per variant. Omit <code>equals</code> for booleans (truthy).</p>` +
        fieldList(VisibleWhenSchema as AnySchema, {
          prop: 'The driving prop, by canonical name.',
          equals: 'Required for enum props; omit for booleans.',
        }) +
        refusals('Refusals:', [
          'an unknown prop; an <code>equals</code> value outside the enum',
        ]) +
        shippingExample('banner.contract.json', { paths: ['anatomy.root.parts.endArea.parts.close'] }),
    ),
    section(
      'styles-when',
      'stylesWhen — conditional literal styles',
      ['generated', 'curated'],
      `<p>Literal CSS — never tokens — applied when a prop matches. Boolean conditions ride the per-boolean data attribute the generator already emits (<code>.root[data-is-disabled] { … }</code>); enum conditions ride the root’s enum class. The whitelist is deliberately tight: behavioral and positional properties with no token vocabulary. A color or a dimension belongs in <code>tokens</code>, and a brace-wrapped value here is refused by name.</p><p>Whitelist (from <code>STYLES_WHEN_ALLOWED</code> in the schema): ${allowed}.</p>` +
        fieldList(StylesWhenSchema as AnySchema, {
          prop: 'Boolean or enum prop.',
          equals: 'Required for enum props; must be omitted for booleans.',
          styles: 'CSS property → literal value; keys must be in the whitelist.',
        }) +
        refusals('Refusals:', [
          'a property outside the whitelist',
          'a value that looks like a token reference — token-driven styling belongs in <code>tokens</code>',
          '<code>equals</code> missing on an enum condition, present on a boolean one, or outside the enum',
        ]) +
        fidelity(
          `<p><strong>Declared fidelity limit:</strong> v1 applies nothing on the canvas — boolean properties can bind visibility, not style. A code-side surface, like events.</p>`,
        ) +
        shippingExample('text-field.contract.json', { paths: ['anatomy.root.stylesWhen'] }),
    ),
    section(
      'overlay',
      'overlay — out-of-flow attachment',
      ['generated', 'curated'],
      `<p>The part renders out of flow, attached to one edge of the root — tooltip bubbles, combobox popups. Code: <code>position: absolute</code> with placement-derived insets, and the root becomes <code>position: relative</code>. Canvas: <code>layoutPositioning: ABSOLUTE</code> with placement-derived constraints, preserved through the amend path. Four placements in v1; offset and alignment tuning is a later axis.</p>` +
        fieldList(OverlaySchema as AnySchema, {
          placement: 'The root edge the part attaches to.',
        }) +
        refusals('Refusals:', [
          'the root cannot be an overlay — overlays attach to the root',
          'an overlay cannot also <code>grow</code> (in-flow sizing) or <code>overlap</code> children (in-flow semantics)',
        ]) +
        illustrativeExample(
          PartSchema,
          { overlay: { placement: 'top' }, tokens: { 'background-color': '{color.surface.raised}' } },
          'an overlay bubble part',
        ) +
        `<p class="section-note">No shipping contract carries <code>overlay</code> yet — the field-case tooltip (CBDS) pins its pointer with per-variant <code>stylesWhen</code> insets instead, which the <a href="/spec/shape/">shape page</a> shows replayed from the committed capture. The example above is schema-validated at build time.</p>`,
    ),
    section(
      'animation',
      'animation — declared motion',
      ['generated', 'curated'],
      `<p>CSS-side motion: <code>spin</code> for spinners, <code>pulse</code> for skeletons. Not representable on the canvas — a documented fidelity scope, like events. Nothing richer belongs in a contract: animation timing is behavior whose truth can’t be verified on both surfaces.</p>` +
        shippingExample('spinner.contract.json', { paths: ['anatomy.root.parts.arc'] }),
    ),
  ].join('');
  return specPage(
    'conditionals',
    'Visibility, tightly-whitelisted literal styles, out-of-flow overlays, and declared motion — each with its cross-surface fidelity stated, never implied.',
    body,
  );
}

function shapePage(replays: Awaited<ReturnType<typeof loadReplays>>): { route: string; html: string } {
  const body = [
    section(
      'shape',
      'Shape parts',
      ['generated', 'curated'],
      `<p>A leaf decor part that is a parametric vector, not a box — the projection of capture-geometry into the contract (field case: a tooltip’s pointer triangle). Bounded by construction: exactly three kinds — polygon by side count, ellipse, rect — an explicit intrinsic size, and a CSS-clockwise rotation. Everything else about a shape rides existing channels: fill via <code>tokens.background-color</code>, per-variant placement via <code>stylesWhen</code>, visibility via <code>visibleWhen</code>.</p>` +
        fieldList(ShapeSchema as AnySchema, {
          kind: 'polygon | ellipse | rect.',
          sides: 'Polygon point count, ≥ 3. A polygon with no captured side count renders the canvas default (3) — and the proposer names that assumption in its notes.',
          width: 'Intrinsic (pre-rotation) width, px.',
          height: 'Intrinsic (pre-rotation) height, px.',
          rotation: 'CSS-clockwise degrees. Omit for 0.',
        }) +
        `<p>Projections: code surfaces render width/height + <code>clip-path: polygon(…)</code> (or <code>border-radius: 50%</code>) + <code>transform: rotate(…)</code> — one shared implementation (<code>shapeCssDecls</code> in the schema module) so the projection cannot fork across emitters; the canvas generator constructs a <em>real</em> RegularPolygon/Ellipse/Rectangle node with native rotation.</p>` +
        refusals('Refusals:', [
          'a shape part must be a leaf — no <code>parts</code>, <code>slot</code>, <code>component</code>, <code>content</code>, <code>text</code>, <code>icon</code>, or <code>meter</code> alongside it',
          '<code>sides</code> only on polygons — side count is polygon vocabulary',
        ]) +
        replayedBlock(
          replays.shapePart,
          'proposed at build time by the import engine from the committed live capture extract/figma/fixtures/cbds-tooltip.rest-dump.json — the CBDS Tooltip pointer: a real triangle with per-placement stylesWhen insets and rotation',
        ) +
        `<p class="section-note">Every value above — the 12×12 intrinsic size, each inset, each rotation — comes from the captured file, not from this page. The standing receipt for this field case is <code>npm run extract:figma:tooltip:check</code>.</p>`,
    ),
  ].join('');
  return specPage(
    'shape',
    'Parametric vector decor — triangles, ellipses, rotated rects — carried as geometry, projected as clip-paths in code and real vector nodes on the canvas.',
    body,
  );
}

function compositionPage(replays: Awaited<ReturnType<typeof loadReplays>>): { route: string; html: string } {
  const body = [
    section(
      'slots',
      'Slots — constrained insertion points',
      ['generated', 'curated'],
      `<p>A slot is a constrained insertion point, aligned with the canvas’s two-tier constraint design. A slot named <code>children</code> is the default slot (React children); any other name becomes a <code>ReactNode</code> prop. <code>accepts</code> lists contract IDs, resolved per surface through each referenced contract’s anchors — a declared slot without a checkable constraint would leave generation and parity nothing to verify, so the constraint is first-class.</p>` +
        fieldList(SlotSchema as AnySchema, {
          name: '<code>children</code> = the default slot; any other name becomes a ReactNode prop of that name.',
          accepts: 'Contract IDs this slot accepts. Omit = unconstrained.',
          acceptsMode: '<code>prefer</code> (default): accepts guides pickers and generators. <code>restrict</code>: only accepts is legal. <code>open</code>: explicitly anything — the escape hatch. Compatibility rule: widening is a minor version; narrowing is major.',
          min: 'Arity lower bound (maps to canvas slot min-children).',
          max: 'Arity upper bound.',
          required: 'The slot must be filled.',
          figmaProperty: 'Canvas property name. Default: PascalCase(name).',
          defaultContent: 'See <a href="#default-content">default content</a>.',
        }) +
        shippingExample('banner.contract.json', { paths: ['anatomy.root.parts.endArea.parts.endContent'] }),
    ),
    section(
      'default-content',
      'Slot default content',
      ['generated', 'curated'],
      `<p>Design-time sample content: renders as instances inside the slot on the canvas and as the sample in code stories — never baked into the generated component itself. Items must be drawn from <code>accepts</code> when accepts is present. A slot whose default content has <em>multiple</em> items is a multi-child slot — inexpressible as a canvas instance-swap, so it renders its content directly until the native slot-property migration.</p>` +
        fieldList(SlotContentItemSchema as AnySchema, {
          id: 'A contract id from <code>accepts</code>.',
          props: 'Fixed prop values, spelled canonically.',
          text: 'Overrides the child’s <code>children</code> text prop.',
        }) +
        refusals('Refusals:', [
          'default content outside <code>accepts</code> (eval: <code>refuse-defaultContent-outside-accepts</code>)',
          'unknown contract references; composition cycles — a contract cannot compose itself',
          '<code>text</code> on a child with no children text prop',
        ]) +
        shippingExample('avatar-group.contract.json', { paths: ['anatomy.root.parts.stack'] }),
    ),
    section(
      'component-refs',
      'Component refs — fixed instances',
      ['generated', 'curated'],
      `<p>A fixed instance of another contract, embedded by <em>reference</em> — composition never duplicates a child’s definition. Props are spelled canonically and mapped through the <em>child</em> contract’s own bindings on each surface. A string value of the form <code>"{parentProp}"</code> maps the parent’s enum prop into the child per variant.</p>` +
        fieldList(ComponentRefSchema as AnySchema, {
          id: 'The child contract’s id, e.g. <code>ds.avatar</code>.',
          props: 'Fixed prop values; <code>"{parentProp}"</code> threads a parent enum through.',
          text: 'Overrides the child’s <code>children</code> text prop (code: JSX children; canvas: text override on the instance).',
        }) +
        refusals('Refusals:', [
          'unknown child contracts; cycles (<code>a contract cannot compose itself</code>)',
          'setting an unknown child prop, or an <code>arrayOf</code> child prop — structured values cannot be fixed in anatomy',
          'a <code>"{parentProp}"</code> reference to a prop that is not a declared enum of the parent',
          '<code>text</code> on a child with no children text prop',
        ]) +
        shippingExample('card.contract.json', { paths: ['anatomy.root.parts.header.parts.avatar'] }),
    ),
    section(
      'repeat',
      'Repeat — item templates over arrays',
      ['generated', 'curated'],
      `<p>Repeated-children collections (menu items, breadcrumb segments, tab items, avatar stacks): the part is an <strong>item template</strong> — a component-ref part rendered once per record of the <code>itemsProp</code> <a href="/spec/props/#prop-types">arrayOf prop</a>. Field → child-prop mapping is by name: every arrayOf field names a prop of the referenced child contract. Constant child props ride <code>component.props</code> as usual.</p><p>Projections: React maps the live array (<code>{items?.map(…)}</code> — undefined renders nothing); the static surfaces and the canvas render <code>sample</code> — the <em>observed</em> drawn siblings, the collection’s honest static state (the meter discipline again).</p>` +
        fieldList(RepeatSchema as AnySchema, {
          itemsProp: 'The arrayOf prop (by canonical name) the template maps over in code.',
          sample: 'The observed design-time sample — one record per drawn sibling, keys ⊆ the arrayOf fields. Required: the canvas projection <em>is</em> the sample; a sample-less collection would render nothing everywhere but React.',
        }) +
        refusals('Refusals:', [
          '<code>repeat</code> without <code>component</code> — the item template is a component ref',
          'a repeat template carrying slot/content/text/meter alongside',
          '<code>itemsProp</code> unknown, or not an <code>arrayOf</code> prop',
          'a field colliding with a fixed component prop — a field is per-item, a fixed prop is constant',
          'a field naming no child prop; sample keys outside the fields; sample values of the wrong type',
        ]) +
        replayedBlock(
          replays.repeatPart,
          'proposed at build time by the import engine from the committed owner’s-kit capture — five drawn menu items collapse to one template with the varying boolean carried per item',
        ),
    ),
  ].join('');
  return specPage(
    'composition',
    'Slots with checkable constraints, fixed instances by reference, and item templates over structured props — composition that generation and parity can both verify.',
    body,
  );
}

function eventsPage(): { route: string; html: string } {
  const body = [
    section(
      'events',
      'The interaction surface, declared',
      ['curated'],
      `<p>A contract declares <em>what interactions exist</em> without ever describing how they’re implemented. An event is a code-side callback (<code>onToggle</code>) fired when the trigger part is activated. The canvas cannot run behavior, so events surface there as component-description text — a declared fidelity limit, like animation.</p><p><strong>What events deliberately do NOT cover:</strong> drag, typeahead, focus trapping, animation timing — behavior whose truth can’t be verified on both surfaces. That stays a hand-written layer, and the contract refuses to pretend otherwise.</p>`,
    ),
    section(
      'event-fields',
      'Event fields',
      ['generated', 'curated'],
      fieldList(EventSchema as AnySchema, {
        name: 'Event name, lowerCamel.',
        description: 'Flows into JSDoc and the canvas component description.',
        bindings: 'Code-only by declared fidelity limit: the callback prop, which must be <code>on*</code>.',
        trigger: 'The anatomy part (by name) whose activation fires the event; <code>root</code> allowed.',
        toggles: 'See below.',
      }),
    ),
    section(
      'toggles',
      'Toggles — the generatable half',
      ['generated', 'curated'],
      `<p>When <code>toggles</code> is present the generator emits the whole toggle mechanically: an uncontrolled <code>useState</code> fallback (interactive out of the box), the controlled/uncontrolled resolution, the flip between exactly two values of an enum prop, and the matching ARIA state attribute on the trigger. Values of the toggled enum <em>outside</em> the pair render <code>aria-*="mixed"</code> and resolve to the pair’s second value on activation — exactly Checkbox’s <code>indeterminate</code>.</p>` +
        fieldList(unwrap((EventSchema.shape as Record<string, AnySchema>).toggles).schema, {
          prop: 'The enum prop being flipped.',
          between: '<code>[offValue, onValue]</code> — activation flips within the pair; any non-member value flips to <code>onValue</code>.',
          aria: 'The ARIA state attribute generated onto the trigger.',
        }) +
        refusals('Guardrails, enforced at build time:', [
          'a trigger part must be an activatable element — keyboard activation comes from the platform, not a bolted-on handler',
          '<code>toggles.prop</code> must be an enum containing both <code>between</code> values',
          'event prop names must be <code>on*</code> and collision-free against props and slots',
          'the differ treats the callback as contract API: deleting it from code is <code>code BEHIND</code> (eval: <code>detect-code-removed-event</code>)',
        ]) +
        shippingExample('switch.contract.json', { paths: ['events', 'props'], limit: { props: 1 } }),
    ),
  ].join('');
  return specPage(
    'events',
    'Declared callbacks and mechanically generated toggles — the interaction surface both surfaces can verify, with everything richer left honestly to hand-written code.',
    body,
  );
}

// ---------------------------------------------------------------------------
// Index + versioning
// ---------------------------------------------------------------------------

function specIndex(receipt: CoverageReceipt): { route: string; html: string } {
  const cards = SPEC_PAGES.map(
    (p) =>
      `<a class="card" href="${p.route}"><h3>${p.title}</h3><p>${
        {
          contract: 'Identity, lifecycle, anchors, a11y declarations.',
          semantics: 'Element, role, prop-driven variants, named exceptions.',
          props: 'Five type kinds, defaults, and two-surface bindings.',
          anatomy: 'The part tree: structure, text, icons, attrs, meters.',
          layout: 'Flexbox ⇄ auto-layout, plus per-variant overrides.',
          tokens: 'Token bindings, substitution, the integrity gate.',
          states: 'Declared states, part overrides, canvas previews.',
          conditionals: 'visibleWhen, stylesWhen, overlays, motion.',
          shape: 'Parametric vector decor from captured geometry.',
          composition: 'Slots, component refs, repeat templates.',
          events: 'Callbacks and generated toggles with ARIA.',
        }[p.id]
      }</p><span class="card__meta">${receipt.byPage[p.id] ?? 0} schema branches</span></a>`,
  ).join('');

  const body = `
<p class="eyebrow">The specification</p>
<h1>The contract, field by field</h1>
<p class="lede">This reference is <strong>generated from the schema</strong> — <code>scripts/contract-schema.ts</code>, the same Zod document that validates every contract, typed the generators, and emits the JSON Schema. Docs that are rendered from the spec cannot drift from it.</p>

${section(
  'coverage',
  'The coverage receipt',
  ['generated'],
  `<p>At every build, the site enumerates every branch of the live schema and asserts each one has a documented home. <strong>${receipt.documented}/${receipt.schemaBranches} branches covered${
    receipt.missing.length === 0 && receipt.stale.length === 0 ? ', zero missing, zero stale' : ''
  }.</strong> If the schema grows a branch this reference doesn’t document — or the reference names a branch the schema dropped — the build fails, by name. The receipt ships with the site: <a href="/spec-coverage.json"><code>spec-coverage.json</code></a>.</p>`,
)}

${section(
  'how-to-read',
  'How to read these pages',
  ['curated'],
  `<p>Every section is labeled with its provenance:</p>
  <ul>
    <li>${badge('generated')} — field names, types, optionality: rendered from the Zod schema by introspection at build time.</li>
    <li>${badge('curated')} — prose and constraint summaries, distilled from the schema’s own commentary and the refusal rules in <code>core/emit-react.ts</code> — hand-written, and kept honest by the coverage guard and review.</li>
    <li>${badge('example')} — real excerpts: shipping contracts from <code>contracts/</code>, or output of the actual import engine replayed over committed capture fixtures, at build time. Illustrative snippets (used only where no shipping contract exercises a branch yet) are schema-validated at build time and say so in their captions.</li>
  </ul>
  <p>Two version lines are in play and the pages name both: the <em>contract</em> carries its own semver (<code>version</code>); the <em>schema</em> has a single current version (v13) — see <a href="${VERSIONING_ROUTE}">versioning</a>.</p>`,
)}

<section id="pages"><h2>Reference pages</h2><div class="cards">${cards}</div></section>
`;
  const html = layout(
    {
      path: '/spec/',
      title: 'The Spec — Design System Contracts',
      description:
        'The component-contract specification, generated from its own schema: every branch documented, coverage receipted, real shipping contracts as examples.',
      sidebar: sideNav('/spec/'),
      mainClass: 'spec-page',
      schemaStamp: true,
    },
    body,
  );
  return { route: '/spec/', html };
}

function versioningPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">Spec reference</p>
<h1>Versioning</h1>
<p class="lede">Two version lines, deliberately separate: each <em>contract</em> carries semver; the <em>schema</em> has a single current version. The change-by-change history lives in the repository, not here.</p>

${section(
  'current',
  'Current version',
  ['curated'],
  `<p>The schema is at <strong>v13</strong> — one live document, <code>scripts/contract-schema.ts</code>, reflected by <code>npm run schema</code> into the published JSON Schema (<code>contracts/contract.schema.json</code>). Every reference page on this site is generated from it at build time, so this site always documents the current version. What changed, when, and why is the repository’s history: see the <a href="${REPO_URL}/blob/main/CHANGELOG.md">CHANGELOG</a> and <a href="${REPO_URL}/blob/main/MILESTONES.md">MILESTONES.md</a> on GitHub.</p>`,
)}

${section(
  'contract-versioning',
  'Contract versions (semver)',
  ['curated'],
  `<p>Any change to <code>props</code>, <code>states</code>, <code>anatomy</code>, or <code>a11y</code> bumps the contract’s <code>version</code> — semver semantics: an added optional prop or a widened slot is <strong>minor</strong>; a removed or renamed prop or value, or a narrowed slot, is <strong>major</strong>. The version string is schema-enforced (<code>MAJOR.MINOR.PATCH</code> — a malformed version is refused).</p><p>Contract changes land as PRs. The PR diff <em>is</em> the design-system change review — one artifact, reviewable by designers and engineers alike. The promotion flow generates these PRs from drift detected on either surface: an engineer’s hand-added prop became Button v1.0.0 → v1.1.0 through exactly this door (<a href="/how-it-works/adding-a-prop/">the full lifecycle, replayed</a>).</p>`,
)}

${section(
  'breaking',
  'How breaking changes are handled',
  ['curated'],
  `<p>The schema grows by addition, never by repurposing: new vocabulary lands as <strong>optional fields</strong>, and every existing contract must keep parsing — a schema change that breaks a shipping contract does not merge. Each addition ships with its refusal rules (the illegal states, named) and an eval behind it, and this site’s <a href="/spec/#coverage">coverage guard</a> fails the build if a schema branch lands undocumented.</p><p>For contracts, breaking is a <strong>major</strong> version: removing or renaming a prop or value, or narrowing a slot’s <code>accepts</code>. Widening is minor. Consumers pin contract versions the way they pin package versions — the version field is the unit of change management.</p><p>To propose a change, see <a href="/contribute/">Contribute</a> — fixture first, refusals named, eval-locked, then the claim.</p>`,
)}
`;
  const html = layout(
    {
      path: VERSIONING_ROUTE,
      title: 'Spec versioning — Design System Contracts',
      description: 'How contract versions (semver) and schema rounds (v13 current) advance — fixture first, refusals named, eval-locked.',
      sidebar: sideNav(VERSIONING_ROUTE),
      mainClass: 'spec-page',
      schemaStamp: true,
    },
    body,
  );
  return { route: VERSIONING_ROUTE, html };
}

// ---------------------------------------------------------------------------

export async function buildSpecPages(receipt: CoverageReceipt): Promise<Array<{ route: string; html: string }>> {
  const replays = await loadReplays();
  return [
    specIndex(receipt),
    versioningPage(),
    contractPage(),
    semanticsPage(),
    propsPage(replays),
    anatomyPage(),
    layoutPage(),
    tokensPage(),
    statesPage(),
    conditionalsPage(),
    shapePage(replays),
    compositionPage(replays),
    eventsPage(),
  ];
}
