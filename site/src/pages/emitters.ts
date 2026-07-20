/**
 * Emitter authoring guide — /emitters/. The Emitter interface is extracted
 * from core/emitter.ts at build time (it cannot drift from the engine), and
 * the worked example is the published @ds-contracts/emitter-web-components
 * plugin — its receipts (round-trip closure, CSS parity) are the didactic
 * core: an emitter is trustworthy when its output survives extraction.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { layout, codeBlock, badge, REPO_URL } from '../html.js';

/** Slice a source region; refuse by name when the pattern stops matching. */
function iface(name: string): string {
  const text = readFileSync(path.join(process.cwd(), 'core/emitter.ts'), 'utf8');
  const m = text.match(new RegExp(`(export interface ${name} \\{[\\s\\S]*?\\n\\})`));
  if (!m) throw new Error(`emitters page: core/emitter.ts no longer declares "export interface ${name}" — update the extraction`);
  return m[1];
}

export function emittersPage(): { route: string; html: string } {
  const interfaces = ['EmittedFile', 'EmitterCtx', 'Emitter'].map(iface).join('\n\n');

  const body = `
<p class="eyebrow">Reference</p>
<h1>Writing an emitter</h1>
<p class="lede">A contract is the single source of truth; an emitter is <strong>one projection of it</strong> — a pure function from contract to file texts. The four built-ins prove the spread (scoped-CSS React, static HTML, inline-styles React, and the Figma sync script — the canvas itself is just another emit target). A new surface for Angular, SwiftUI, or Compose is a new pure function over the same contract; nothing upstream changes.</p>

<h2 id="interface">The interface ${badge('generated', 'Extracted from core/emitter.ts at build time — the guide cannot drift from the engine.')}</h2>
${codeBlock(interfaces, 'ts', 'core/emitter.ts — the three types every emitter is written against; extracted at build time')}
<p>Three rules the registry holds you to:</p>
<ul>
<li><strong>Pure.</strong> Contract + ctx in, file texts out. No filesystem, no network, no globals — every emitter must be browser-importable (the playground runs them all).</li>
<li><strong>Validated input, always.</strong> The engine validates contracts <em>before</em> your emitter sees them — a schema-invalid contract is refused by name upstream; you never defend against malformed input.</li>
<li><strong>Named no-ops, never silent drops.</strong> A concept your surface cannot express (canvas state previews, <code>bindings.figma</code>, modes) is declared as a named no-op — in an emitted file header, a comment, a manifest note. The reader learns what didn't carry, from the artifact itself.</li>
</ul>

<h2 id="register">Registering: two doors, one registry</h2>
${codeBlock(`// direct, when you embed the engine (core/emitter.ts — the engine-as-a-library barrel):
import { registerEmitter } from './core/emitter.js';
import webComponents from '@ds-contracts/emitter-web-components';
registerEmitter(webComponents);

// or let the CLI do it — the module loads and registers BEFORE generation:
ds-contracts generate contracts/ --out wc/ \\
  --target web-components \\
  --emitter @ds-contracts/emitter-web-components \\
  --tokens tokens.json --icons icons/`, 'text', 'the --emitter module may export an Emitter as `default`, `emitter`, or an `emitters` array — anything else is refused by name')}
<p><code>--target</code> then selects your emitter by its <code>name</code>; an unknown target is refused with the list of registered names. Full flag detail: <a href="/cli/#generate">the CLI reference</a>.</p>

<h2 id="worked-example">The worked example: <code>@ds-contracts/emitter-web-components</code></h2>
<p>The published plugin (<a href="${REPO_URL}/tree/main/packages/emitter-web-components">packages/emitter-web-components</a>) turns each contract into vanilla Custom Elements — zero runtime dependencies, shadow DOM, constructable stylesheets, real <code>&lt;slot&gt;</code>s, real events. One contract becomes four files:</p>
<div class="table-wrap"><table>
<thead><tr><th>File</th><th>What it is</th></tr></thead>
<tbody>
<tr><td><code>&lt;tag&gt;.ts</code></td><td>an <code>HTMLElement</code> subclass (<code>ds.badge</code> → <code>&lt;ds-badge&gt;</code>): <code>observedAttributes</code> from the contract's props; enum/boolean/number/text props reflect property ⇄ attribute with contract defaults; the <code>children</code> text prop rides the default slot; events dispatch <code>CustomEvent</code>s; form-associated when the contract's root is input-like. <code>arrayOf</code> props are JS properties only — attributes cannot carry lists, a <em>named</em> limit.</td></tr>
<tr><td><code>&lt;tag&gt;.css.ts</code></td><td>the anatomy compiled to a constructable stylesheet — see the selector-translation recipe below.</td></tr>
<tr><td><code>&lt;tag&gt;.demo.html</code></td><td>the story-equivalent showcase grid: default + every enum value + every boolean.</td></tr>
<tr><td><code>&lt;tag&gt;.custom-elements.json</code></td><td>a Custom Elements Manifest generated <em>from the contract</em> — deterministic, no analyzer — and the raw material for the closure receipt below.</td></tr>
</tbody></table></div>
<p class="section-note">Committed eyeball receipts for five contracts (including a Polaris import) live in <a href="${REPO_URL}/tree/main/packages/emitter-web-components/samples">samples/</a>.</p>

<h3 id="selector-translation">The selector-translation recipe</h3>
<p>Don't invent styling semantics — <strong>translate an existing emitter's semantics to your surface's selector dialect at identical specificity</strong>. The WC emitter reuses the static HTML emitter's CSS generation wholesale and only swaps the selector spelling: class-per-variant becomes shadow-scoped <code>[part=…]</code> with <code>:where()</code> wrappers tuned so every rule lands at <em>the same specificity</em> as the light-DOM original. Same cascade in, same computed values out — which turns "the styles match" from a hope into a measurement: the <code>wc-emitter-css-parity</code> receipt loads both emitters' output in real Chromium and compares computed styles across every showcase item — <strong>165/165 channels equal</strong> (9 computed properties + width/height × 15 items). Token values arrive as CSS custom properties, which inherit through the shadow boundary — the <a href="/how-it-works/styles/">two-stage application</a> works unchanged.</p>

<h3 id="closure-receipt">The closure receipt: round-trip your own output</h3>
<p>The strongest receipt an emitter can carry: <strong>feed your emitted surface back through an extractor and diff the round-tripped contract against the source contract.</strong> The WC emitter's <code>roundtrip-check</code> does exactly this — the manifests it emits are fed through the repo's own CEM extraction adapter (the same adapter any brownfield Web Components library goes through), and the resulting proposal is diffed against the contracts it started from: props, enums, defaults, and events survive the loop, and every non-surviving fact is named with its mechanism. That closure is the proof that a plugin surface <em>preserves truth</em> rather than merely resembling it. The recipe, generalized:</p>
<ol class="steps">
<li><h3>Emit</h3><p>Run your emitter over a handful of shipping contracts — include at least one enum axis, one boolean, one default, one event.</p></li>
<li><h3>Extract</h3><p>Run an existing extractor over the output — the <code>cem</code> adapter if your surface can publish a Custom Elements Manifest, the <code>react-tsx</code> adapter for React-family output. No extractor for your surface yet? Emitting a CEM <em>from the contract</em> (as the WC emitter does) gives you a deterministic bridge into one.</p></li>
<li><h3>Diff, and name the losses</h3><p>Compare the round-tripped proposal to the source contracts. Facts that survive are your fidelity claim; facts that don't must be named with their mechanism — a named loss is a spec-grade answer, a silent one is a bug.</p></li>
</ol>

<h2 id="community">Community doors: Angular, Swift, Kotlin, anything</h2>
<p>This guide is the path for the surfaces this project hasn't built: an Angular emitter, SwiftUI or Compose for native design systems, a Vue SFC emitter, an email-safe HTML emitter. Each is the same shape — a pure function, registered, selected with <code>--target</code>, shipped as an npm package under your own name (<code>registerEmitter</code> is public API; no fork required, nothing upstream changes). Hold your emitter to the house bar: pure and browser-safe, canvas-only concepts as named no-ops, a parity measurement where one is possible, and a closure receipt through an extractor. If your surface exposes a real gap in the schema instead, that's a <a href="/contribute/">field case</a> — exactly how the schema has grown every round so far.</p>

<p class="receipt-line">Receipts for the worked example: <code>wc-emitter-roundtrip</code> and <code>wc-emitter-css-parity</code> in the eval suite, plus the committed <a href="${REPO_URL}/tree/main/packages/emitter-web-components/samples">samples/</a>. The four built-ins are receipted by <code>core/emitters-check.ts</code>; only <code>react</code> is byte-guarded by the golden manifest — its output is the shipping library.</p>
`;
  const html = layout(
    {
      path: '/emitters/',
      title: 'Writing an emitter — Design System Contracts',
      description:
        'The Emitter interface, registerEmitter, and the CLI --emitter flow — with @ds-contracts/emitter-web-components as the worked example: the selector-translation recipe and the closure receipt (round-trip your output through an extractor).',
    },
    body,
  );
  return { route: '/emitters/', html };
}
