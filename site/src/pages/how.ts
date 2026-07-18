/**
 * How it works — four editorial pages distilled from docs/*.md (the model,
 * determinism & receipts, the instruments, round-trips). Prose is reused
 * from the repo docs where it was already right; numbers link to their
 * committed receipts.
 */
import { layout, codeBlock, REPO_URL, PLAYGROUND_URL } from '../html.js';
import type { SiteStats } from '../stats.js';

interface HowPage {
  id: string;
  route: string;
  title: string;
  nav: string;
}

const HOW_PAGES: HowPage[] = [
  { id: 'model', route: '/how-it-works/model/', title: 'The model — truth between surfaces', nav: 'The model' },
  { id: 'determinism', route: '/how-it-works/determinism/', title: 'Determinism & receipts', nav: 'Determinism & receipts' },
  { id: 'instruments', route: '/how-it-works/instruments/', title: 'The instruments', nav: 'The instruments' },
  { id: 'round-trips', route: '/how-it-works/round-trips/', title: 'Round-trips', nav: 'Round-trips' },
];

function sideNav(activePath: string): string {
  const link = (href: string, label: string): string =>
    `<a class="sidenav__link${activePath === href ? ' is-active' : ''}" href="${href}">${label}</a>`;
  return [
    `<p class="sidenav__group">How it works</p>`,
    link('/how-it-works/', 'Overview'),
    ...HOW_PAGES.map((p) => link(p.route, p.nav)),
  ].join('');
}

function howShell(page: HowPage | undefined, title: string, description: string, body: string): { route: string; html: string } {
  const route = page?.route ?? '/how-it-works/';
  const idx = page ? HOW_PAGES.findIndex((p) => p.id === page.id) : -1;
  const prev = idx > 0 ? HOW_PAGES[idx - 1] : undefined;
  const next = idx >= 0 ? HOW_PAGES[idx + 1] : undefined;
  const pn =
    idx >= 0
      ? `<nav class="prev-next" aria-label="How it works pages">${
          prev
            ? `<a class="prev" href="${prev.route}"><span>Previous</span>${prev.nav}</a>`
            : `<a class="prev" href="/how-it-works/"><span>Previous</span>Overview</a>`
        }${next ? `<a class="next" href="${next.route}"><span>Next</span>${next.nav}</a>` : `<a class="next" href="/get-started/"><span>Next</span>Get started</a>`}</nav>`
      : '';
  const html = layout(
    { path: route, title: `${title} — Design System Contracts`, description, sidebar: sideNav(route) },
    body + pn,
  );
  return { route, html };
}

// ---------------------------------------------------------------------------

function indexPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works</p>
<h1>Generative first, diagnostic forever</h1>
<p class="lede">Four short pages: the position, the honesty machinery, the standing instruments that measure it, and the loop executed in both directions.</p>
<div class="cards">
${HOW_PAGES.map(
  (p) =>
    `<a class="card" href="${p.route}"><h3>${p.nav}</h3><p>${
      {
        model: 'Why the truth is neither surface, and the arbitration rule that keeps both honest.',
        determinism: 'Golden manifests, refusal by name, and degradation codes — how “generated” stays checkable.',
        instruments: 'The census, the visual-parity instrument, and the enterprise gauntlet — with their real numbers.',
        'round-trips': 'Code→contract→canvas and back: the executed promotion loop, with receipts.',
      }[p.id]
    }</p></a>`,
).join('')}
</div>`;
  return howShell(undefined, 'How it works', 'The contract model in four short pages: the position, determinism and receipts, the instruments, and executed round-trips.', body);
}

function modelPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · 1</p>
<h1>The model — truth between surfaces</h1>
<p class="lede">Every design system team eventually argues about where the canonical source of truth lives: the canvas library or the code library. Both answers are wrong in the same way.</p>

<p>Whichever side is declared canonical, the other side becomes a hand-maintained copy that drifts. Developers outnumber designers, so code accumulates decisions design never signed off on; design files freeze into snapshots of intent that stop being true. Eroded trust is why design reviews devolve into archaeology — <em>is the file right, or is prod right?</em> — and why every design system team ends up with a human whose actual job is reconciliation.</p>

<p>The position this spec takes: <strong>the source of truth is neither surface.</strong> It's a machine-readable contract that sits between them. A contract is a small, versioned JSON document capturing everything both sides must agree on: the component's API (props, types, enum vocabularies, defaults), its anatomy, its bindings to design tokens (never raw values), its slots, its semantics, its declared events. The canvas library and the code library are both <strong>renderers</strong> of that contract — generated from it on the first pass, validated against it forever after.</p>

<h2>Generation is a party trick; the diagnosis is the product</h2>
<p>Lots of tools generate code or draw components once. The contract model is <strong>generative first, diagnostic forever</strong>: after the first pass, a three-way differ continuously compares the contract, the code, and the canvas, and classifies every difference:</p>
<div class="table-wrap"><table>
<thead><tr><th>Finding</th><th>Meaning</th><th>Remedy</th></tr></thead>
<tbody>
<tr><td><code>ahead</code></td><td>a surface has something the contract doesn't</td><td>the differ emits a <em>proposed contract patch</em> — a human reviews and promotes it</td></tr>
<tr><td><code>behind</code></td><td>the contract has something the surface doesn't</td><td>regenerate that surface</td></tr>
<tr><td><code>mismatch</code></td><td>both define it, values disagree</td><td>contract is canonical: adopt (patch contract) or enforce (regenerate)</td></tr>
</tbody></table></div>

<h2>Fluidity, not enforcement</h2>
<p>The bridge would be worthless if it only policed. Real teams evolve their systems from both ends — an engineer adds a <code>loading</code> prop because the product needed it; a designer adjusts a surface color because the old one failed in context. Both of those are <em>good</em> changes that started on the "wrong" side. So the loop is built around <strong>promotion</strong>: when a surface runs ahead of the contract, that difference becomes a reviewable proposal <em>to the contract</em>. Accept it, and the contract version bumps and regenerates the other side. Reject it, and the surface is flagged as drift to be reverted. Either way there is exactly one arbiter, and it's a diffable, reviewable, version-controlled file.</p>

<h2>Why the style mapping lives in the contract</h2>
<p>A subtle failure mode in contract-first proposals: if the contract declares <code>variant: primary | secondary</code> but a handwritten "resolver" maps those values to styles, drift hasn't been eliminated — it's moved into the resolver. So here, the contract's <a href="/spec/anatomy/">anatomy</a> binds each named part directly to <a href="/spec/tokens/">design token references</a>, and the CSS Module is <em>generated</em> from those bindings. There is no handwritten style layer to drift. The generator fails the build if a binding references a token that doesn't exist — contract and tokens cannot silently disagree.</p>

<h2>And the reason that's growing: AI generation</h2>
<p>In the reference repo's A/B evaluation, an ungoverned agent building screens scored <strong>69/100 adherence with 90 violations</strong> — invented props, hard-coded colors, restyled components. The same model constrained by the compiled contract catalog scored <strong>100/100 with zero violations</strong>, and when it hit a real gap in the system, it <em>reported the gap</em> instead of faking around it. The gap became a contract proposal, the proposal became a version bump, and the score went back to 100. The contract isn't just how design and code stay aligned — it's how generation stays honest. (Full write-up with the judge internals: <a href="${REPO_URL}/blob/main/docs/10-honest-generation.md">docs/10 — Honest Generation</a>.)</p>

<h2>A proven playbook, one level up</h2>
<p>At the token layer, the <a href="https://www.designtokens.org/">DTCG</a> format — which this spec consumes for every token reference — proved that a neutral, Git-versioned, machine-readable artifact can govern both a design tool and a codebase at once. This spec runs that playbook one level up, at the component-API layer: the same properties (diffable, reviewable, tool-agnostic), applied to props, anatomy, and composition instead of color and spacing.</p>
`;
  return howShell(HOW_PAGES[0], 'The model', 'Why the source of truth is neither the design file nor the code, and the arbitration rule — surfaces never sync side-to-side — that keeps both honest.', body);
}

function determinismPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · 2</p>
<h1>Determinism &amp; receipts</h1>
<p class="lede">"Generate from your design system" can be an architecture property or a model behavior you hope for. This spec chooses the property — and backs every honesty claim with a named mechanism.</p>

<h2>Golden manifests</h2>
<p>Same contract in, byte-identical surfaces out — no generation lottery. Determinism is proven against <em>recorded</em> output, not just against itself: a golden-output manifest (<code>evals/golden.json</code>) pins SHA-256 hashes over every generated file, so a surviving-mutant change to any emitter fails loudly. The full token build plus component generation runs twice under the eval and must hash identically; regenerating from an unchanged contract is always a no-op diff.</p>
${codeBlock(`npm run eval    # golden-output manifest, refusals, drift detection, convergence
npm run build   # regenerate everything — a clean tree stays byte-identical`, 'bash')}

<h2>Refusal, by name</h2>
<p>An illegal contract fails at build time with the exact violation named — on every surface, including the canvas emitter. There is no "best effort" mode. The <a href="/spec/">reference pages</a> list the refusal rules per feature: defaults outside enums, duplicate design-property bindings, malformed token references, composition cycles, slot content outside <code>accepts</code>, a shape part that isn't a leaf, a state override on a part the child contract owns. Each class is exercised by the C2 eval family — a refused contract fails fast instead of crashing dependents.</p>

<h2>The integrity gate</h2>
<p>Every token reference in every contract — <em>after</em> placeholder expansion — must resolve to a real token in <code>tokens/</code>. Point a binding at a token that doesn't exist and the build itself fails, naming the contract path and the missing token. The contract and the token set cannot silently disagree.</p>

<h2>Degradation codes — nothing is lost silently</h2>
<p>Import is where honesty is usually lost: a pipeline reads a rich source and quietly carries what it can. Here, <strong>every channel the capture reads but cannot carry is a receipt</strong>. The import pipeline names its losses with degradation codes — paint stacks it had to truncate, non-uniform stroke weights, unsupported stroke styles, blend modes, rotations, vector geometry, min/max size constraints, text channels — and the proposer names bound variables on fields outside the contract vocabulary rather than dropping them. Unbound or raw values are always reported with nearest-token candidates, never invented. The standing measure: across an entire enterprise kit import, every fact carried, every note, and every degradation is <em>counted per component set</em> — see <a href="/how-it-works/instruments/">the instruments</a>.</p>

<h2>Declared fidelity limits</h2>
<p>Not everything is expressible on both surfaces, and nothing here pretends otherwise. The canvas cannot run behavior, so <a href="/spec/events/">events</a> surface there as description text. CSS animation and conditional literal styles are code-side by declaration. Structured <code>arrayOf</code> props have no canvas manifestation and say so in their binding. Each limit is written into the spec page for its feature — a limit you can read is a limit you can trust.</p>

<h2>The claims rule</h2>
<p>The reference implementation's contribution norm, and this site's too: <strong>no capability claim without an eval behind it</strong> (<a href="${REPO_URL}/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a>). Fixture first, eval second, claim last. This page's claims each name their mechanism; the dated log of what has been proven, in order, is <a href="${REPO_URL}/blob/main/MILESTONES.md">MILESTONES.md</a>.</p>
`;
  return howShell(HOW_PAGES[1], 'Determinism & receipts', 'Golden-output manifests, refusal by name, the token integrity gate, and degradation codes — the mechanisms that keep generation checkable and loss visible.', body);
}

function instrumentsPage(stats: SiteStats): { route: string; html: string } {
  const census =
    stats.censusSets !== undefined
      ? `${stats.censusClean!.toLocaleString('en-US')}/${stats.censusSets.toLocaleString('en-US')}`
      : '1,618/1,618';
  const body = `
<p class="eyebrow">How it works · 3</p>
<h1>The instruments</h1>
<p class="lede">Beyond the eval suite (${stats.evalsPassed}/${stats.evalsTotal} deterministic checks), three standing instruments measure the pipeline against material this project doesn't own — and publish their numbers as committed reports.</p>

<h2>The whole-kit census</h2>
<p>Every component set in a live enterprise Figma kit, replayed through the full deterministic import pipeline — the exact engine the playground runs: propose → captured-token layer → validate → all ${stats.emitters} emitters. Current standing: <strong>${census} sets clean</strong>, including all 76 real variant composites (menus, cards, avatar groups, dialogs) where failures used to concentrate.</p>
<p>"Clean" is deliberately qualified: <em>refusal-free ≠ pixel-right</em>. Alongside the clean rate, the census counts <strong>facts carried</strong> (token-bound style facts, with minted provisional tokens marked), <strong>named notes</strong>, and <strong>capture degradations</strong> per set — so a clean import is never confused with a lossless one. Reproduce: <code>npm run extract:figma:gauntlet</code> → <a href="${REPO_URL}/blob/main/extract/figma/gauntlet/CENSUS.md">CENSUS.md</a>.</p>

<h2>The visual-parity instrument</h2>
<p>Emitted previews perceptually diffed against the design tool's own PNG renders — pixelmatch, with a text-masked second score because Figma and Chromium rasterize the same glyphs differently. Ranked <em>worst-first</em> as a standing fix queue; every row over threshold carries a named cause from a committed triage table (engine / capture-gap / renderer / harness / design) or prints <strong>UNTRIAGED</strong>. A baseline gate re-scores every row and fails on regression beyond ±0.1pp; moving the baseline is an explicit, reviewed act. Reproduce: <code>npm run extract:figma:visual</code> → <a href="${REPO_URL}/blob/main/extract/figma/visual-parity/REPORT.md">REPORT.md</a>.</p>
<p>Cross-renderer deltas are named, not tolerated away: font rasterization differences ride the text mask; text-hug metrics (±1–2 CSS px on hug-sized boxes) stay in the score and are triaged <code>renderer</code>.</p>

<h2>The enterprise gauntlet</h2>
<p>Carbon, Fluent 2, Spectrum, and Polaris run through the <em>unmodified</em> code-extraction pipeline at pinned SHAs. The exercise surfaced two silent-loss classes the friendlier pilots never hit — vanishing <code>as</code>-expression exports, hollow intersection-of-named-refs props — both eliminated and receipt-locked. Every workaround is named in the report: <a href="${REPO_URL}/blob/main/extract/pilots/ENTERPRISE-GAUNTLET.md">ENTERPRISE-GAUNTLET.md</a>. The brownfield pilots that preceded it — Shoelace (58/58 components), Mantine (245 components, &lt;1s), Eventz (a complete real code ⇄ design pair), CBDS (in-place amend inside a foreign enterprise kit) — keep their receipts in <a href="${REPO_URL}/tree/main/extract/pilots">extract/pilots/</a>.</p>

<h2>Certification, today and tomorrow</h2>
<p>Today, "certified" means: every capability claim in the reference implementation is backed by an executable check or a committed receipt — the eval suite gates the machinery, the census and visual instruments gate the imports, and the golden manifests gate the generators. The end state is a <strong>conformance kit</strong> a second, independent implementation can run — the roadmap's final, falsifiable exit criterion: <em>an implementation this repo's authors didn't write passes the conformance kit</em> (<a href="${REPO_URL}/blob/main/ROADMAP.md">ROADMAP.md</a>).</p>
`;
  return howShell(HOW_PAGES[2], 'The instruments', 'The whole-kit census, the visual-parity instrument, and the enterprise gauntlet — standing measurements with committed reports and real numbers.', body);
}

function roundTripsPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · 4</p>
<h1>Round-trips</h1>
<p class="lede">The piece that settles the source-of-truth argument: every change on either surface becomes a reviewable proposal to the contract, and the contract regenerates the other side. Executed end-to-end, in both directions, with receipts committed.</p>

<h2>Direction 1 — code ahead (the product engineer)</h2>
<ol class="steps">
<li><h3>Hand-edit the generated code</h3><p><code>loading?: boolean</code> added by hand to <code>Button.tsx</code> — the thing engineers actually do.</p></li>
<li><h3>The differ flags it</h3><p><code>npm run parity</code> → <code>[code AHEAD] Button.loading</code>, with a <em>complete proposed prop patch</em>, design-side binding included.</p></li>
<li><h3>Promotion</h3><p>Patch applied to <code>contracts/button.contract.json</code>; version bumped 1.0.0 → 1.1.0.</p></li>
<li><h3>Regenerate</h3><p><code>npm run build</code> — the hand edit superseded by the contract-governed version; the <code>Loading</code> property pushed to the live canvas set.</p></li>
<li><h3>Clean</h3><p>Snapshot refreshed → <code>npm run parity</code> → clean.</p></li>
</ol>

<h2>Direction 2 — canvas ahead (the designer)</h2>
<p>A designer's edit on the canvas — a dark-mode surface alias retargeted — comes back as a <code>MISMATCH</code> finding with a proposed token patch. Promotion updates <code>tokens/modes/semantic.dark.tokens.json</code>; the token build re-emits the CSS custom property; Storybook's dark mode reflects it immediately; parity returns clean. <strong>Same door in both directions:</strong> a diffable change to a JSON file in Git, reviewable by designers and engineers alike. (Full narrative with the operational learnings: <a href="${REPO_URL}/blob/main/docs/06-parity-loop.md">docs/06 — The Parity Loop</a>.)</p>

<h2>Round-trip identity — the standing check</h2>
<p>Beyond the executed demo, the repo's own generated components are continuously re-extracted — code→contract and design→contract — and matched against their shipping contracts: <strong>zero mismatches, both directions, red-tested</strong> (the checks are proven able to fail). Receipts: <a href="${REPO_URL}/blob/main/extract/ROUNDTRIP-CODE.md">code round-trip</a> · <a href="${REPO_URL}/blob/main/extract/figma/ROUNDTRIP.md">plugin-dump round-trip</a> · <a href="${REPO_URL}/blob/main/extract/figma/rest/ROUNDTRIP-REST.md">REST round-trip</a>.</p>

<h2>What the loop caught on its very first run</h2>
<p>The first baseline <code>npm run parity</code> flagged that the canvas Button's default <code>Size</code> was <code>Small</code> while the contract says <code>md</code>. Root cause: the design tool's default variant is <em>positional</em> (top-left of the set), and the generator had laid variants out in enum order. Fixed twice over — the live set re-arranged, and the generator now orders every axis default-value-first. Not staged; the loop caught a real gap on day one.</p>

<h2>What "parity clean" does and doesn't mean</h2>
<p>The differ verifies the contracted API surface: props with types <em>and kinds</em>, variant axes and option sets, defaults on both surfaces, slot properties and their accepts, nested instances, and every token variable. It does <strong>not</strong> continuously inspect anatomy internals below the API surface — those are enforced at generation time and re-verified visually by <a href="/how-it-works/instruments/">the visual-parity instrument</a>, and the docs say so rather than rounding up.</p>
`;
  return howShell(HOW_PAGES[3], 'Round-trips', 'The promotion loop executed in both directions — engineer’s prop and designer’s token change through the same door — plus zero-mismatch re-extraction receipts.', body);
}

export function buildHowPages(stats: SiteStats): Array<{ route: string; html: string }> {
  return [indexPage(), modelPage(), determinismPage(), instrumentsPage(stats), roundTripsPage()];
}
export { PLAYGROUND_URL };
