/**
 * How it works — the section opens with the three questions real audiences
 * ask (each answered with build-time engine replays over committed fixtures
 * — see src/how-replays.ts), followed by four foundation pages distilled
 * from docs/*.md. Prose is reused from the repo docs where it was already
 * right; numbers link to their committed receipts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { layout, codeBlock, esc, themedImage, REPO_URL, PLAYGROUND_URL } from '../html.js';
import { dependencyGraphSize } from '../diagrams.js';
import type { SiteStats } from '../stats.js';
import type { FileDiff, HowReplays, ImportStep, ParityFinding, RefResolution } from '../how-replays.js';

interface HowPage {
  id: string;
  route: string;
  title: string;
  nav: string;
}

const QUESTION_PAGES: HowPage[] = [
  { id: 'adding-a-prop', route: '/how-it-works/adding-a-prop/', title: 'How are properties added?', nav: 'Adding a property' },
  { id: 'nested-components', route: '/how-it-works/nested-components/', title: 'How are nested components addressed?', nav: 'Nested components' },
  { id: 'at-scale', route: '/how-it-works/at-scale/', title: 'What about 100 components?', nav: 'At scale' },
];

const FOUNDATION_PAGES: HowPage[] = [
  { id: 'model', route: '/how-it-works/model/', title: 'The model — truth between surfaces', nav: 'The model' },
  { id: 'protocol', route: '/how-it-works/protocol/', title: 'The protocol', nav: 'The protocol' },
  { id: 'styles', route: '/how-it-works/styles/', title: 'How styles are applied', nav: 'How styles are applied' },
  { id: 'determinism', route: '/how-it-works/determinism/', title: 'Determinism & receipts', nav: 'Determinism & receipts' },
  { id: 'instruments', route: '/how-it-works/instruments/', title: 'The instruments', nav: 'The instruments' },
  { id: 'round-trips', route: '/how-it-works/round-trips/', title: 'Round-trips', nav: 'Round-trips' },
];

const HOW_PAGES: HowPage[] = [...QUESTION_PAGES, ...FOUNDATION_PAGES];

/** Look a foundation page up by id — refuses by name so a reordered list cannot silently misfile a page. */
function foundation(id: string): HowPage {
  const page = FOUNDATION_PAGES.find((p) => p.id === id);
  if (!page) throw new Error(`FOUNDATION_PAGES: no page with id "${id}"`);
  return page;
}

function sideNav(activePath: string): string {
  const link = (href: string, label: string): string =>
    `<a class="sidenav__link${activePath === href ? ' is-active' : ''}" href="${href}">${label}</a>`;
  return [
    `<p class="sidenav__group">How it works</p>`,
    link('/how-it-works/', 'Overview'),
    `<p class="sidenav__group">The three questions</p>`,
    ...QUESTION_PAGES.map((p) => link(p.route, p.nav)),
    `<p class="sidenav__group">Foundations</p>`,
    ...FOUNDATION_PAGES.map((p) => link(p.route, p.nav)),
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

const diagram = (name: string, alt: string, cls = 'diagram'): string =>
  `<div class="${cls}">${themedImage(`/assets/${name}-light.svg`, `/assets/${name}-dark.svg`, alt)}</div>`;

// ---------------------------------------------------------------------------
// Render helpers for the replayed material
// ---------------------------------------------------------------------------

/** A real line diff of real emitter output, rendered with hunk separators. */
function diffBlock(d: FileDiff, caption: string, maxHunks = 4): string {
  const shown = d.hunks.slice(0, maxHunks);
  const omitted = d.hunks.length - shown.length;
  const body = shown
    .map((h) =>
      h.lines
        .map((l) => {
          const cls = l.kind === 'add' ? 'diff-add' : l.kind === 'del' ? 'diff-del' : '';
          const sign = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' ';
          const text = `${sign} ${l.text}`;
          return cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text) + '\n';
        })
        .join(''),
    )
    .join(`<span class="diff-hunk">  ⋯</span>`);
  const tail = omitted > 0 ? `<span class="diff-hunk">  ⋯ ${omitted} more hunk${omitted === 1 ? '' : 's'} not shown</span>` : '';
  const stat = `${d.path} · ${d.beforeLines} → ${d.afterLines} lines · +${d.added} −${d.removed}`;
  return `<figure class="code-figure"><figcaption class="code-caption">${esc(stat)} — ${caption}</figcaption><pre class="code-block" data-lang="diff"><code>${body}${tail}</code></pre></figure>`;
}

function findingBlock(f: ParityFinding, caption: string): string {
  return codeBlock(JSON.stringify(f, null, 2), 'json', caption);
}

function refsTable(refs: RefResolution[]): string {
  const label: Record<RefResolution['resolution'], string> = {
    'linked-session': 'linked — session',
    'linked-repo': 'linked — repository',
    stubbed: 'stubbed (observed geometry)',
    unresolved: 'unresolved',
  };
  return `<div class="table-wrap"><table><thead><tr><th>Child ref</th><th>Instances</th><th>Resolution</th></tr></thead><tbody>${refs
    .map((r) => `<tr><td><code>${esc(r.refId)}</code></td><td>${r.count}</td><td>${label[r.resolution]}</td></tr>`)
    .join('')}</tbody></table></div>`;
}

function stepsTable(steps: ImportStep[]): string {
  const summarize = (s: ImportStep): string => {
    const linked = s.refs.filter((r) => r.resolution !== 'stubbed' && r.resolution !== 'unresolved');
    const linkedN = linked.reduce((a, r) => a + r.count, 0);
    return `${linkedN} linked · ${s.stubIds.length} stubbed`;
  };
  return `<div class="table-wrap"><table><thead><tr><th>Import order</th><th>Proposed contract</th><th>Child refs</th><th>Minted tokens</th><th>Named notes</th></tr></thead><tbody>${steps
    .map(
      (s, i) =>
        `<tr><td>${i + 1} · ${esc(s.setName)}</td><td><code>${esc(s.contractId)}</code></td><td>${summarize(s)}</td><td>${s.minted}</td><td>${s.notes}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;
}

const receiptLine = (html: string): string => `<p class="receipt-line">${html}</p>`;

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

function indexPage(): { route: string; html: string } {
  const qMeta: Record<string, { q: string; a: string; meta: string }> = {
    'adding-a-prop': {
      q: 'How are properties added?',
      a: 'A hand edit on either surface becomes a reviewable contract patch; promotion regenerates both sides. The full lifecycle, replayed with the real emitters and the real differ at build time.',
      meta: 'engine-replayed at build',
    },
    'nested-components': {
      q: 'How are nested components addressed?',
      a: 'Contracts stay per-component; parents embed children by reference. Session linking, honest stubs with observed geometry, and the upgrade path — replayed over the committed Dialog → Button → Icon captures.',
      meta: 'committed fixtures, replayed',
    },
    'at-scale': {
      q: 'What about 100 components with nested dependencies?',
      a: 'The dependency graph of a real 1,600-set enterprise kit, computed at build; deterministic build order; the whole-kit census — and a plain statement of what a contract does not cover.',
      meta: 'graph computed from the capture',
    },
  };
  const qcards = QUESTION_PAGES.map(
    (p) =>
      `<a class="qcard" href="${p.route}"><h3>${qMeta[p.id].q}</h3><p>${qMeta[p.id].a}</p><span class="qcard__meta">${qMeta[p.id].meta}</span></a>`,
  ).join('');
  const fcards = FOUNDATION_PAGES.map(
    (p) =>
      `<a class="card" href="${p.route}"><h3>${p.nav}</h3><p>${
        {
          model: 'Why the truth is neither surface, and the arbitration rule that keeps both honest.',
          protocol: 'Contracts-in-git are canon, CI is the enforcement point, and authority belongs to the layer that can mechanically refuse.',
          styles: 'Names, not values: two-stage application on the code side, bound variables on the canvas — the same statement in two dialects.',
          determinism: 'Golden manifests, refusal by name, and degradation codes — how “generated” stays checkable.',
          instruments: 'The census, the visual-parity instrument, and the enterprise gauntlet — with their real numbers.',
          'round-trips': 'Code→contract→canvas and back: the executed promotion loop, with receipts.',
        }[p.id]
      }</p></a>`,
  ).join('');
  const body = `
<p class="eyebrow">How it works</p>
<h1>Three questions, answered with the engine running</h1>
<p class="lede">Every page in this section that shows a number, a diff, or a finding produced it by running the real machinery at build time — over committed contracts and committed captures. Start with the question you came here with.</p>
<div class="qcards">${qcards}</div>
<h2>Foundations</h2>
<p>The positions and machinery under those answers, in six short pages.</p>
<div class="cards">${fcards}</div>`;
  return howShell(
    undefined,
    'How it works',
    'Three questions answered with build-time engine replays — adding a property, nested components, and scale — plus the model, determinism, instruments, and round-trips.',
    body,
  );
}

// ---------------------------------------------------------------------------
// Q1 · How are properties added?
// ---------------------------------------------------------------------------

function addingAPropPage(replays: HowReplays): { route: string; html: string } {
  const L = replays.lifecycle;
  const body = `
<p class="eyebrow">How it works · question 1</p>
<h1>How are properties added?</h1>
<p class="lede">Through one door, from either side: a difference on a surface becomes a reviewable patch <em>to the contract</em>, a human promotes it, and the contract regenerates both surfaces. Everything below was produced by the real engine at site-build time.</p>
${diagram('prop-lifecycle', 'Lifecycle of an added property: a hand edit on one surface is flagged by the differ as code AHEAD with a complete proposed contract patch; a human promotes the patch into the contract, bumping its version; both surfaces regenerate from the contract; a surface that skipped regeneration is named figma BEHIND until it catches up.')}

<h2 id="hand-edit">1 · The hand edit</h2>
<p>An engineer needs a prop the system doesn’t have, and does what engineers do — adds it to the generated component by hand. This replay applies exactly that mutation to the repository’s real generated <code>Button.tsx</code> in a scratch copy:</p>
${diffBlock(L.handEditDiff, 'the hand edit, applied at site-build time to a scratch copy of the real generated source — the same mutation the eval <code>detect-code-added-prop</code> locks')}

<h2 id="differ-flags">2 · The differ flags it — with a complete patch</h2>
<p>The three-way differ (<code>npm run parity</code>) compares code, canvas, and contract. Run at site-build time over that scratch, it reports exactly one finding — below is its verbatim output, including the <strong>complete proposed contract patch</strong>, design-side binding included:</p>
${findingBlock(L.aheadFinding, 'parity/diff.ts — the repository’s actual differ, run at site-build time over the scratch copy; verbatim finding')}

<h2 id="promotion">3 · Promotion — a human accepts the patch</h2>
<p>Promotion is a reviewed edit to a JSON file in Git: the patch is applied to the contract’s <code>props</code>, and the version bumps (an added optional prop is a <a href="/spec/versioning/">minor bump</a>). This is not hypothetical — Button’s <code>loading</code> prop entered the system through exactly this door, v1.0.0 → v1.1.0, and ships today:</p>
${codeBlock(JSON.stringify(L.promotedProp, null, 2), 'json', `contracts/button.contract.json (v${L.contractVersion}) — the promoted prop as it ships; loaded at build time`)}

<h2 id="regenerate">4 · Regeneration — both surfaces, from the contract</h2>
<p><code>npm run build</code> re-emits every surface. To show precisely what the promotion changes, the site build ran the real emitters twice — once over the shipping contract, once over a reconstructed pre-promotion state (the shipping contract with <code>loading</code> and its spinner part removed at build time, and labeled as such). The diffs below are real emitter output against real emitter output.</p>
<h3>The code surface</h3>
${diffBlock(L.reactDiff, 'core react emitter, run twice at site-build time: contract without vs with the promoted prop')}
${diffBlock(L.cssDiff, 'the generated CSS Module — the spinner’s rules appear; no handwritten style layer exists to update', 2)}
<h3>The design surface</h3>
${diffBlock(L.figmaDiff, 'core figma emitter (the canvas sync script) — the Loading BOOLEAN property and spinner node appear in the same regeneration', 3)}

<h2 id="stale-surface">5 · The differ catches a surface that didn’t regenerate</h2>
<p>Suppose the code was regenerated but the canvas was not — the property was promoted, and one surface lags. The differ names it. This finding is again verbatim output of the real differ at site-build time, over a scratch whose canvas snapshot lacks the promoted property:</p>
${findingBlock(L.behindFinding, 'parity/diff.ts over a scratch whose canvas snapshot is missing the Loading property — the exact mutation the eval <code>detect-figma-missing-property</code> locks')}
<p>Note the remedy string’s honesty: sync scripts are currently create-only, and the differ says so instead of promising an automation that doesn’t exist.</p>

${receiptLine(`Standing receipts: the evals <code>detect-code-added-prop</code>, <code>detect-figma-missing-property</code>, and <code>promotion-converges</code> lock every step of this page, and the executed <a href="/how-it-works/round-trips/">round-trip</a> is the same loop run against the live canvas.`)}
`;
  return howShell(
    QUESTION_PAGES[0],
    'How are properties added?',
    'The full lifecycle of an added property — hand edit, differ finding with a complete proposed patch, human promotion, regeneration of both surfaces, and the differ catching a stale surface — replayed with the real engine at build time.',
    body,
  );
}

// ---------------------------------------------------------------------------
// Q2 · How are nested components addressed?
// ---------------------------------------------------------------------------

function nestedComponentsPage(replays: HowReplays): { route: string; html: string } {
  const N = replays.nesting;
  const mega = N.megaSession as {
    order: string[];
    firstPass: Record<string, { linkedSession: number; stubbed: number }>;
    relink: Record<string, { linkedSession: number; stubbed: number; stubbedDespiteInScope: string[] }>;
  };
  const megaRows = mega.order
    .map((name) => {
      const fp = mega.firstPass[name];
      const rl = mega.relink[name];
      return `<tr><td>${esc(name)}</td><td>${fp.linkedSession} linked · ${fp.stubbed} stubbed</td><td>${
        rl ? `${rl.linkedSession} linked · ${rl.stubbed} stubbed` : '— (no children)'
      }</td></tr>`;
    })
    .join('');
  const body = `
<p class="eyebrow">How it works · question 2</p>
<h1>How are nested components addressed?</h1>
<p class="lede">Contracts stay per-component; a parent embeds its children <strong>by reference</strong>, never by copying their definition. The chain below — Dialog → Button-Brand Primary → Icon, from a real enterprise kit — is replayed through the actual import engine at site-build time, from the committed captures.</p>
${diagram('session-linking', 'Session-linking sequence: each imported set registers its contract by component key and name; a later import resolves drawn child instances through the session key first, then by name, then stubs with observed geometry; importing the missing child later upgrades the stub to a link.')}

<h2 id="reference-model">Composition is by reference</h2>
<p>In a contract, a nested component is a <a href="/spec/composition/#component-refs">component ref</a> — the child’s contract id plus applied props, mapped through the <em>child’s own bindings</em>. The child’s anatomy, tokens, and API live in the child’s contract only; cycles and unknown references fail the build by name. That one rule is what makes the rest of this page mechanical.</p>

<h2 id="unknown-child">When the child isn’t known yet: honest stubs</h2>
<p>Import the CBDS Dialog on its own — before any of its children have been imported — and the engine refuses to guess. Every unknown child becomes a <strong>stub contract</strong> carrying the observed applied props and the observed geometry, and each stub says what it is in its own description. The Dialog-alone replay produced ${N.dialogAloneStubIds.length} stubs:</p>
${codeBlock(N.dialogAloneStubIds.join('\n'), 'text', 'child stubs proposed at site-build time by the import engine from the committed capture extract/figma/fixtures/cbds-plugin-dialog.dump.json')}
${codeBlock(JSON.stringify(N.stubExcerpt, null, 2).slice(0, 1400) + '\n…', 'json', 'the ds.button-brand-primary stub (excerpt) — observed props and observed bounding-box geometry only; nothing invented')}
<p>The stub’s own description states the deal plainly: <em>“${esc(N.stubDescription.slice(0, 260))}…”</em></p>

<h2 id="session-linking">Children first: session linking</h2>
<p>Now the same fixtures in a working session, children first — Icon (from the committed whole-kit capture), then Button-Brand Primary, then Dialog. Each import registers its contract in the session; later imports resolve drawn instances against it. Real engine, real captures, at build time:</p>
${stepsTable(N.steps)}
<p class="section-note">Even the “leaf” is honest about its own edge: the Icon set itself draws a <code>Placeholder</code> instance, so the Icon import carries one stub of its own.</p>
<p>Per-ref resolution of the Dialog import — its action button now <strong>links</strong> to the session’s real contract; only the never-imported children stay stubs:</p>
${refsTable(N.steps[2].refs)}
${codeBlock(JSON.stringify(N.dialogLinkedRef, null, 2), 'json', 'the Dialog proposal’s component ref after session linking — embedded by id, not by copy; proposed at site-build time')}

<h2 id="linked-by-key">Linked by key, not by luck</h2>
<p>Names collide in real kits (the live capture holds 1,514 duplicate-named components). So resolution prefers the design tool’s stable <strong>component key</strong>: the drawn instance carries the key of the set it points at, and the proposed child contract carries the same key in its anchors. From the committed v1.6 whole-kit capture, at build time:</p>
${codeBlock(
  `drawn instance of "Icon" inside the "${N.keyProof.parentSet}" set:\n  instanceSetKey  = ${N.keyProof.drawnInstanceSetKey}\nproposed ds.icon contract:\n  anchors.figma.componentSetKey = ${N.keyProof.proposedAnchorKey}\n// equal — the link is keyed identity, and a CONTRADICTING key refuses to link`,
  'text',
  'key-linking proof read from extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json at build time',
)}

<h2 id="upgrade">The upgrade: stub today, link tomorrow</h2>
<p>Compare the two replays above: imported alone, Dialog stubbed <code>ds.button-brand-primary</code>; re-imported after the button entered the session, the same ref resolved to the real contract. Nothing is silently rewritten — the upgrade is a re-import through the same door. The standing 10-set receipt is the live gauntlet’s <strong>mega-session</strong>: ten sets imported in deliberately wrong order (composites before some of their children), then every composite re-imported once the whole scope exists — <strong>zero</strong> refs left stubbed despite their set being in scope:</p>
<div class="table-wrap"><table><thead><tr><th>Set (import order)</th><th>First pass</th><th>Relink pass</th></tr></thead><tbody>${megaRows}</tbody></table></div>
${receiptLine(`Loaded from the committed receipt <code>extract/figma/gauntlet/live/mega-session.json</code> (<code>npm run extract:figma:gauntlet:live</code>). The Dialog dedup and linking behavior is separately pinned by <code>npm run extract:figma:dialog:check</code>, and the linked child’s minted-token scope by <code>npm run extract:figma:cross:check</code> — the owner’s exact two-import session, replayed.`)}
`;
  return howShell(
    QUESTION_PAGES[1],
    'How are nested components addressed?',
    'Composition by reference, session linking by component key, honest stubs with observed geometry, and the stub-to-link upgrade — the real Dialog → Button → Icon chain replayed from committed captures at build time.',
    body,
  );
}

// ---------------------------------------------------------------------------
// Q3 · What about 100 components?
// ---------------------------------------------------------------------------

function atScalePage(replays: HowReplays, stats: SiteStats): { route: string; html: string } {
  const S = replays.scale;
  const census =
    stats.censusSets !== undefined
      ? `${stats.censusClean!.toLocaleString('en-US')}/${stats.censusSets.toLocaleString('en-US')}`
      : '1,618/1,618';
  const fmt = (n: number): string => n.toLocaleString('en-US');
  const hubs = S.topHubs.map(([n, c]) => `<code>${esc(n)}</code> (${c})`).join(', ');
  const fanout = S.topFanout.map(([n, c]) => `<code>${esc(n)}</code> (${c})`).join(', ');
  const orderLines: string[] = [];
  for (let i = 0; i < S.buildOrder.length; i += 4) orderLines.push(S.buildOrder.slice(i, i + 4).join('  '));
  const body = `
<p class="eyebrow">How it works · question 3</p>
<h1>What about 100 components with nested dependencies?</h1>
<p class="lede">Say a giant product inventory dashboard: hundreds of instances, components nested in components. The model doesn’t change — it’s the same two rules from the previous pages, applied transitively. The proof below is a real ${fmt(S.totalSets)}-set enterprise kit, measured at site-build time.</p>

<h2 id="the-model">The model, precisely</h2>
<p>Contracts are <strong>per-component</strong>. A screen — that dashboard — is a <em>composition of instances</em>, and every instance resolves to exactly one contract. Nesting is the <a href="/spec/composition/#component-refs">component-ref</a> edge repeated: Dialog refs Button, Button refs Icon; each contract owns its own API and styling, and a parent can only thread declared props through. So “100 components with nested dependencies” is not a new problem class — it is a <strong>dependency graph</strong>, and graphs are what the machinery is built on: unknown refs and cycles fail the build by name, and <code>sortByDependencies</code> gives every consumer a deterministic, leaf-first build order.</p>

<h2 id="the-graph">The dependency graph of a real kit</h2>
<p>This is not a stock illustration. At site-build time, the site reads the committed whole-kit capture — <strong>${fmt(S.totalSets)} component sets</strong> from a live enterprise kit — and renders every instance edge it finds: <strong>${fmt(S.composites)} sets draw instances of other sets</strong> (${fmt(S.multiVariantComposites)} of them multi-variant composites), ${fmt(S.pairEdges)} distinct dependency edges over ${fmt(S.instanceNodes)} drawn instances, nesting up to ${S.maxDepth} levels deep (${S.chainExample.join(' → ')} is the chain the <a href="/how-it-works/nested-components/">previous page</a> replays).</p>
<div class="diagram diagram--scroll">${themedImage(
    '/assets/dependency-graph-light.svg',
    '/assets/dependency-graph-dark.svg',
    'The dependency graph computed from the committed whole-kit capture: composites arranged by dependency depth with every instance edge drawn; edges into the Icon hub aggregated; sets with no instance edges elided, with counts stated in the legend.',
    `width="${dependencyGraphSize(S.graph).width}" height="${dependencyGraphSize(S.graph).height}"`,
  )}</div>
<p class="section-note">The graph renders at natural size and scrolls sideways — shrinking ${fmt(dependencyGraphSize(S.graph).width)}&nbsp;px of real labels to fit the column would turn evidence into decoration. <a href="/assets/dependency-graph-light.svg" target="_blank" rel="noopener">Open the light SVG full-screen&nbsp;↗</a> · <a href="/assets/dependency-graph-dark.svg" target="_blank" rel="noopener">dark&nbsp;↗</a></p>
<p class="section-note">What is elided, named: edges into <code>Icon</code> (in-degree ${S.iconInDegree} — drawing them makes wallpaper, so they are aggregated as a marker), and the ${fmt(S.totalSets - S.graph.nodes.length)} sets that participate in no instance edge (icon glyphs and standalone components). One drawn edge resolves to no set in the capture — <code>${esc(S.unresolvedEdges[0]?.[0] ?? '')}</code> → “${esc(S.unresolvedEdges[0]?.[1] ?? '')}” — because the file draws duplicate-named components and the name-keyed capture keeps one; the pipeline stubs it honestly rather than guessing, exactly the keyed-identity discipline of the <a href="/how-it-works/nested-components/#linked-by-key">previous page</a>.</p>
<p>The shape is what design systems actually look like at scale: a handful of hubs — ${hubs} carry the highest in-degree — and composition concentrated in patterns: ${fanout} have the widest fan-out.</p>

<h2 id="build-order">Deterministic build order</h2>
<p>Given the graph, build order is not a judgment call. The schema module’s <code>sortByDependencies</code> orders any contract set leaf-first — children before every parent that refs them — and refuses cycles by name. Here it is, run at site-build time over this repository’s own ${S.buildOrder.length} shipping contracts:</p>
${codeBlock(orderLines.join('\n'), 'text', `sortByDependencies over contracts/ — computed at site-build time; leaf-first, so every ref resolves when its parent generates`)}

<h2 id="whole-kit">Does the whole kit actually resolve?</h2>
<p>Counted, not claimed. The whole-kit census replays <em>every</em> set of that kit through the full import pipeline — propose → captured-token layer → validate → all four emitters: <strong>${census} sets clean</strong>, including all 76 real variant composites. And the mixed-order mega-session (ten sets, composites deliberately imported before some children, then relinked) closes with zero refs left stubbed despite their set being in scope — see <a href="/how-it-works/nested-components/#upgrade">the upgrade table</a>.</p>
${receiptLine(`Receipts: <a href="${REPO_URL}/blob/main/extract/figma/gauntlet/CENSUS.md">CENSUS.md</a> (<code>npm run extract:figma:gauntlet</code>) — clean rate plus facts-carried, named-notes, and degradation counts per set, because refusal-free ≠ pixel-right — and <code>extract/figma/gauntlet/live/mega-session.json</code>.`)}

<h2 id="scope">What a contract deliberately does NOT cover</h2>
<p>Page layout — which components a dashboard uses, where they sit, how the grid responds — is <strong>out of scope</strong>. The spec governs <em>components</em>: their API, anatomy, bindings, and composition edges. A screen is your product’s composition of governed instances, not a governed artifact itself. That boundary is a strength, and the <a href="/how-it-works/model/">A/B evaluation</a> shows why: an agent assembling screens <em>from</em> governed components scored 100/100 with zero violations precisely because every piece it placed was contract-checked — while the screen itself stayed free. Governing the pieces, not the page, is what makes both trustworthy.</p>
`;
  return howShell(
    QUESTION_PAGES[2],
    'What about 100 components?',
    'At scale: the dependency graph of a real 1,618-set enterprise kit computed at build time, deterministic leaf-first build order, the whole-kit census — and the honest scope boundary: contracts govern components, not page layout.',
    body,
  );
}

// ---------------------------------------------------------------------------
// Foundations (model / determinism / instruments / round-trips)
// ---------------------------------------------------------------------------

function modelPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · foundations 1</p>
<h1>The model — truth between surfaces</h1>
<p class="lede">Every design system team eventually argues about where the canonical source of truth lives: the canvas library or the code library. Both answers are wrong in the same way.</p>

<p>Whichever side is declared canonical, the other side becomes a hand-maintained copy that drifts. Developers outnumber designers, so code accumulates decisions design never signed off on; design files freeze into snapshots of intent that stop being true. Eroded trust is why design reviews devolve into archaeology — <em>is the file right, or is prod right?</em> — and why every design system team ends up with a human whose actual job is reconciliation.</p>

<p>The position this spec takes: <strong>the source of truth is neither surface.</strong> It's a machine-readable contract that sits between them. A contract is a small, versioned JSON document capturing everything both sides must agree on: the component's API (props, types, enum vocabularies, defaults), its anatomy, its bindings to design tokens (never raw values), its slots, its semantics, its declared events. The canvas library and the code library are both <strong>renderers</strong> of that contract — generated from it on the first pass, validated against it forever after.</p>
${diagram('contract-flow', 'Workflow diagram: the contract sits between the design surface and the code surface. Generation flows outward from the contract to both surfaces; changes on either surface flow back into the contract as promotions, and the contract regenerates the other side. A three-way differ verifies all of it continuously. Surfaces never sync side-to-side.')}

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
<p>The bridge would be worthless if it only policed. Real teams evolve their systems from both ends — an engineer adds a <code>loading</code> prop because the product needed it; a designer adjusts a surface color because the old one failed in context. Both of those are <em>good</em> changes that started on the "wrong" side. So the loop is built around <strong>promotion</strong>: when a surface runs ahead of the contract, that difference becomes a reviewable proposal <em>to the contract</em>. Accept it, and the contract version bumps and regenerates the other side. Reject it, and the surface is flagged as drift to be reverted. Either way there is exactly one arbiter, and it's a diffable, reviewable, version-controlled file. (<a href="/how-it-works/adding-a-prop/">The full lifecycle, replayed step by step →</a>)</p>

<h2>Why the style mapping lives in the contract</h2>
<p>A subtle failure mode in contract-first proposals: if the contract declares <code>variant: primary | secondary</code> but a handwritten "resolver" maps those values to styles, drift hasn't been eliminated — it's moved into the resolver. So here, the contract's <a href="/spec/anatomy/">anatomy</a> binds each named part directly to <a href="/spec/tokens/">design token references</a>, and the CSS Module is <em>generated</em> from those bindings. There is no handwritten style layer to drift. The generator fails the build if a binding references a token that doesn't exist — contract and tokens cannot silently disagree. (When those token names actually turn into pixels — at generate time on the code side, as bound variables on the canvas — is its own page: <a href="/how-it-works/styles/">How styles are applied →</a>)</p>

<h2>And the reason that's growing: AI generation</h2>
<p>In the reference repo's A/B evaluation, an ungoverned agent building screens scored <strong>69/100 adherence with 90 violations</strong> — invented props, hard-coded colors, restyled components. The same model constrained by the compiled contract catalog scored <strong>100/100 with zero violations</strong>, and when it hit a real gap in the system, it <em>reported the gap</em> instead of faking around it. The gap became a contract proposal, the proposal became a version bump, and the score went back to 100. The contract isn't just how design and code stay aligned — it's how generation stays honest. (Full write-up with the judge internals: <a href="${REPO_URL}/blob/main/docs/10-honest-generation.md">docs/10 — Honest Generation</a>.)</p>

<h2>A proven playbook, one level up</h2>
<p>At the token layer, the <a href="https://www.designtokens.org/">DTCG</a> format — which this spec consumes for every token reference — proved that a neutral, Git-versioned, machine-readable artifact can govern both a design tool and a codebase at once. This spec runs that playbook one level up, at the component-API layer: the same properties (diffable, reviewable, tool-agnostic), applied to props, anatomy, and composition instead of color and spacing.</p>
`;
  return howShell(foundation('model'), 'The model', 'Why the source of truth is neither the design file nor the code, and the arbitration rule — surfaces never sync side-to-side — that keeps both honest.', body);
}

function protocolPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · foundations 2</p>
<h1>The protocol</h1>
<p class="lede">The model says the truth is a contract between the surfaces. The protocol says how that truth changes hands: contracts-in-git are the canon, CI is the enforcement point, and every change — in either direction — becomes a reviewable diff before it becomes real.</p>

<h2 id="canon">Contracts-in-git are the canon</h2>
<p>There is no registry, no proprietary store, no sync service holding the truth. The canonical state of a design system is a directory of <code>*.contract.json</code> files in a Git repository — diffable, blameable, revertable, reviewable with the tools every engineering organization already trusts. Per-version history <em>is</em> the changelog; a contract's <code>version</code> field is the unit of change management. Everything else — the generated React library, the canvas component sets, the Storybook stories — is a derived surface that can be regenerated from the canon at any time.</p>

<h2 id="enforcement">CI is the enforcement point</h2>
<p>A rule nobody runs is a suggestion. The referee is <code>ds-contracts diff</code>, and its exit codes are the whole enforcement interface: <strong>0</strong> clean · <strong>1</strong> drift, findings named on stderr · <strong>2</strong> configuration error. Wire it into CI (the <a href="${REPO_URL}/tree/main/examples/ci">committed recipes</a> do) and the protocol stops depending on anyone's diligence: a pull request that would leave code and contracts disagreeing <em>cannot merge</em>. The code-led recipe keeps contracts current from the components on every push; the design-led recipe regenerates code from changed contracts and gates the PR on parity. Every step in both recipes has been executed verbatim against the published CLI (<a href="${REPO_URL}/blob/main/examples/ci/VALIDATION.md">VALIDATION.md</a>).</p>

<h2 id="reviewable-diff">Every change is a reviewable diff</h2>
<p>Both directions, one door. An engineer's hand-added prop is flagged by the differ with a complete proposed contract patch (<a href="/how-it-works/adding-a-prop/">replayed step by step</a>). A designer's canvas edit becomes a proposed contract change through the plugin's Propose tab or <code>ds-contracts propose-pr</code> — a pull request carrying one JSON diff. Nothing takes effect because someone had write access to a surface; it takes effect because a human reviewed a diff and merged it. The merge <em>is</em> the adoption decision, and the regeneration that follows is mechanical.</p>

<h2 id="authority">Authority is the power to refuse</h2>
<p>In most design-system processes, "authority" means a person with final say — which fails the moment that person is busy. Here authority is structural: <strong>a layer is authoritative precisely because it can mechanically refuse</strong>, by name, before anything downstream happens.</p>
<div class="table-wrap"><table>
<thead><tr><th>Layer</th><th>What it refuses</th><th>How</th></tr></thead>
<tbody>
<tr><td>The schema</td><td>a malformed contract</td><td><code>validateContract</code> — parse failure with the exact violation named; nothing emits</td></tr>
<tr><td>The token gate</td><td>a binding to a token that doesn't exist</td><td>the build itself fails, naming the contract path and the missing token</td></tr>
<tr><td>The generator</td><td>an illegal contract — defaults outside enums, composition cycles, duplicate bindings</td><td>refusal by name on every surface; no "best effort" mode</td></tr>
<tr><td>The differ</td><td>surfaces that disagree with the contract</td><td><code>diff</code> exit 1 — CI blocks the merge until the disagreement is promoted or regenerated away</td></tr>
<tr><td>The canvas sync</td><td>running against the wrong file, or a foreign component</td><td>anchors and identity markers — a set without our marker is never touched</td></tr>
</tbody></table></div>
<p>Notice what is <em>not</em> on the list: no committee, no sync meeting, no reconciliation human. The protocol replaces standing arbitration with standing refusal.</p>

<h2 id="no-unilateral">The no-unilateral-changes rule</h2>
<p>Surfaces never sync side-to-side, and nobody — human, CI job, or AI — writes both surfaces in one motion. Even the code-led CI job that adopts freshly extracted contracts lands its adoption as a <em>commit</em> in the repo's history, not a silent overwrite; even the plugin's in-place library update applies only received, schema-valid contracts and shows what it will change before it changes it. A change that skipped review is drift by definition, and the differ will name it on the next run. This is the same discipline Git brought to code and DTCG brought to tokens: unilateral edits don't become truth; proposed diffs do.</p>

<h2 id="ai">Where AI is allowed to sit</h2>
<p><strong>Propose, never decide.</strong> AI is welcome at exactly one position in the loop: upstream of the referees, as a proposer. The playground's prompt-to-contract assistant drafts contracts the schema is free to refuse; an agent generating screens is constrained by the compiled catalog and judged deterministically (the A/B result: governed <strong>100/100</strong> vs ungoverned <strong>69/100</strong> — <a href="/how-it-works/model/">the model page</a> tells that story). Nothing an AI produces skips a single gate: the schema still parses it, the token gate still resolves it, the generator can still refuse it, the differ still checks the result, and a human still merges the diff. The referee re-checks everything — which is exactly why AI assistance is safe to accept.</p>

${receiptLine(`Standing receipts: the CI recipes' executed-verbatim validation (<a href="${REPO_URL}/blob/main/examples/ci/VALIDATION.md">examples/ci/VALIDATION.md</a>), the journey evals that execute the documented commands (<code>journey-engineer</code>, <code>journey-designer</code>), and the C2 refusal family behind every row of the authority table.`)}
`;
  return howShell(
    foundation('protocol'),
    'The protocol',
    'Contracts-in-git are canon, CI is the enforcement point, every change becomes a reviewable diff, authority belongs to the layer that can mechanically refuse — and AI proposes, never decides.',
    body,
  );
}

// ---------------------------------------------------------------------------
// Foundations · How styles are applied
// ---------------------------------------------------------------------------

/** Slice a labeled excerpt out of a real repo file — refuses by name when the
 *  pattern stops matching, so an excerpt can never silently go stale. */
function fileExcerpt(relPath: string, pattern: RegExp): string {
  const text = readFileSync(path.join(process.cwd(), relPath), 'utf8');
  const m = text.match(pattern);
  if (!m) throw new Error(`how-styles excerpt: ${relPath} no longer matches ${pattern} — update the page`);
  return m[0].trimEnd();
}

function stylesPage(): { route: string; html: string } {
  // Every artifact on this page is loaded from the repository at build time.
  const badge = JSON.parse(readFileSync(path.join(process.cwd(), 'contracts/badge.contract.json'), 'utf8')) as {
    id: string;
    version: string;
    anatomy: { root: { tokens: Record<string, string> } };
  };
  const contractExcerpt = JSON.stringify({ anatomy: { root: { tokens: badge.anatomy.root.tokens } } }, null, 2);

  const cssRoot = fileExcerpt('src/components/Badge/Badge.module.css', /\.root \{[\s\S]*?\}/);
  const cssVariant = fileExcerpt('src/components/Badge/Badge.module.css', /\.variant-success \{[\s\S]*?\}/);
  const tokenLight = fileExcerpt('src/styles/tokens.css', /^\s*--color-feedback-success-background:.*$/m).trim();
  const tokenDark = fileExcerpt('src/styles/tokens.dark.css', /^\s*--color-feedback-success-background:.*$/m).trim();
  const figmaFill = fileExcerpt('figma-sync/05-badge.js', /"name": "Variant=Success",[\s\S]*?"fill": "[^"]+",/);
  const figmaBind = fileExcerpt('figma-sync/05-badge.js', /return figma\.variables\.setBoundVariableForPaint\(.*$/m).trim();

  const body = `
<p class="eyebrow">How it works · foundations 3</p>
<h1>How styles are applied</h1>
<p class="lede">A contract never contains a color. It contains <strong>token names</strong>, and each surface has its own moment for turning a name into pixels — CSS rules baked at generate time with values bound at runtime on the code side; native variables bound through the Plugin API on the canvas. Same names, two dialects. Every artifact below is loaded from the repository at build time; the worked example is Badge's background.</p>

<h2 id="names">Names, not values</h2>
<p>Badge's contract (<code>${esc(badge.id)}</code> v${esc(badge.version)}) binds its root part to token <em>references</em> — including a <code>{variant}</code> placeholder that expands per enum value of the <code>variant</code> prop:</p>
${codeBlock(contractExcerpt, 'json', `contracts/badge.contract.json (v${esc(badge.version)}) — anatomy.root.tokens, loaded at build time`)}
<p>No hex codes, no pixel values. The <a href="/how-it-works/determinism/">integrity gate</a> guarantees every expanded reference resolves to a real token — <code>{color.feedback.success.background}</code> must exist in <code>tokens/</code> or the build fails by name. What the tokens are <em>worth</em> is the token layer's business, and that separation is the entire trick.</p>

<h2 id="code-side">The code surface: two stages</h2>
<h3>Stage 1 — rules, baked at generate time</h3>
<p>The generator compiles the anatomy to a CSS Module: one class per variant value, states as pseudo-classes. The React component never computes a style — it only <em>selects classes</em>:</p>
${codeBlock(`${cssRoot}\n\n${cssVariant}`, 'text', 'src/components/Badge/Badge.module.css — generated from the contract; loaded at build time. The {variant} placeholder became .variant-info, .variant-success, … — one class per enum value.')}
<h3>Stage 2 — values, bound at runtime</h3>
<p>Notice the generated rules still contain no colors — they reference <code>var(--…)</code> custom properties. The values arrive at runtime, from the token pipeline's own CSS:</p>
${codeBlock(`/* src/styles/tokens.css (light) */\n${tokenLight}\n\n/* src/styles/tokens.dark.css */\n${tokenDark}`, 'text', 'the same custom property, defined per mode — loaded at build time from the compiled token CSS')}
<p>This is why <strong>themes and modes work without regeneration</strong>: switching to dark mode swaps which custom-property definitions apply; every generated component re-resolves instantly, untouched. And it is why a token <em>value</em> change (the designer retargets <code>color.feedback.success.background</code>) regenerates only the token CSS — the component CSS references names, and the names didn't change.</p>

<h2 id="canvas-side">The canvas surface: the same names, bound</h2>
<p>The token pipeline that emits the CSS custom properties also syncs the same tree as native design-tool <strong>variables</strong> — collections carrying the pipeline's identity markers, upserted in place. The canvas emitter then compiles the contract to a sync script whose fills are <em>bound</em> to those variables through the Plugin API — never painted as literal colors:</p>
${codeBlock(figmaFill, 'text', 'figma-sync/05-badge.js (generated; excerpt loaded at build time) — the Variant=Success spec names the variable, not a color')}
${codeBlock(figmaBind, 'text', 'the binding call — figma.variables.setBoundVariableForPaint: the fill points at the variable; the design tool resolves the value per mode')}
<p>Variant substitution happens at compile time, exactly mirroring the CSS side: where the code surface got <code>.variant-success</code>, the canvas gets a <code>Variant=Success</code> component whose fill is bound to <code>color/feedback/success/background</code>. One placeholder in the contract, expanded once per surface dialect.</p>

<h2 id="two-dialects">One statement, two dialects</h2>
<p><code>background-color: var(--color-feedback-success-background)</code> in a stylesheet and a Figma fill bound to <code>color/feedback/success/background</code> are <strong>the same statement</strong> — "this part's background is whatever that token says" — spelled in two dialects. Because both surfaces defer to one token source, mode switching behaves identically on both: neither surface owns a color; both re-resolve. And this is what makes drift <em>checkable</em>: the <a href="/how-it-works/round-trips/">differ</a> compares <strong>name bindings</strong>, not rendered colors — a mechanical, exact comparison. Pixels are the downstream receipt, verified separately by the <a href="/how-it-works/instruments/">visual-parity instrument</a> against the design tool's own renders.</p>

<h2 id="asterisk">The honest asterisk: minted tokens</h2>
<p>All of the above assumes the style facts arrive as names. Imports don't always oblige: a captured component may carry a literal <code>#16a34a</code> nowhere in any token set. The pipeline never invents a name and never silently drops the fact — it <strong>mints a provisional token</strong> under the <code>imported.*</code> namespace, binds to it, and marks it as minted in the proposal notes (the rename-later workflow: promote <code>imported.color.3</code> to a real semantic name when a human decides what it means). The plugin route does better: a full-fidelity dump carries the <em>real</em> variable names the designer already bound, so captured names bind directly and minting is reserved for values that were truly raw. Either way the receipt is explicit — a minted token is a named question, not a papered-over answer.</p>

${receiptLine(`Standing receipts: the token integrity gate fails the build on any unresolvable reference; <code>brand-added-token-layer-only</code> proves a new brand leaves every component byte-identical (values changed, names didn't); the census counts minted tokens per imported set; and the visual-parity instrument keeps the pixel receipt honest.`)}
`;
  return howShell(
    foundation('styles'),
    'How styles are applied',
    'Contracts hold token names, never values. Generate-time CSS rules plus runtime var() binding on the code side; identity-markered variables bound via the Plugin API on the canvas — the same statement in two dialects, walked through Badge’s background.',
    body,
  );
}

function determinismPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · foundations 4</p>
<h1>Determinism &amp; receipts</h1>
<p class="lede">"Generate from your design system" can be an architecture property or a model behavior you hope for. This spec chooses the property — and backs every honesty claim with a named mechanism.</p>
${diagram('receipts-flow', 'Receipts flow: the contract feeds four emitters behind one interface; emitted surfaces are pinned by a golden manifest of SHA-256 hashes; illegal contracts are refused by name before anything emits; every token reference must resolve through the integrity gate; imports name every loss as a degradation code. Each gate writes a committed receipt.')}

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
  return howShell(foundation('determinism'), 'Determinism & receipts', 'Golden-output manifests, refusal by name, the token integrity gate, and degradation codes — the mechanisms that keep generation checkable and loss visible.', body);
}

function instrumentsPage(stats: SiteStats): { route: string; html: string } {
  const census =
    stats.censusSets !== undefined
      ? `${stats.censusClean!.toLocaleString('en-US')}/${stats.censusSets.toLocaleString('en-US')}`
      : '1,618/1,618';
  const body = `
<p class="eyebrow">How it works · foundations 5</p>
<h1>The instruments</h1>
<p class="lede">Beyond the eval suite (${stats.evalsPassed}/${stats.evalsTotal} deterministic checks), three standing instruments measure the pipeline against material this project doesn't own — and publish their numbers as committed reports.</p>
${diagram('instruments', 'Instrument relationships: the eval suite gates the engine on every change; the whole-kit census, the visual-parity instrument, and the enterprise gauntlet each measure the same engine against outside material and publish committed reports.')}

<h2>The whole-kit census</h2>
<p>Every component set in a live enterprise Figma kit, replayed through the full deterministic import pipeline — the exact engine the playground runs: propose → captured-token layer → validate → all ${stats.emitters} emitters. Current standing: <strong>${census} sets clean</strong>, including all 76 real variant composites (menus, cards, avatar groups, dialogs) where failures used to concentrate.</p>
<p>"Clean" is deliberately qualified: <em>refusal-free ≠ pixel-right</em>. Alongside the clean rate, the census counts <strong>facts carried</strong> (token-bound style facts, with minted provisional tokens marked), <strong>named notes</strong>, and <strong>capture degradations</strong> per set — so a clean import is never confused with a lossless one. Reproduce: <code>npm run extract:figma:gauntlet</code> → <a href="${REPO_URL}/blob/main/extract/figma/gauntlet/CENSUS.md">CENSUS.md</a>.</p>

<h2>The visual-parity instrument</h2>
<p>Emitted previews perceptually diffed against the design tool's own PNG renders — pixelmatch, with a text-masked second score because the design tool and the browser rasterize the same glyphs differently. Ranked <em>worst-first</em> as a standing fix queue; every row over threshold carries a named cause from a committed triage table (engine / capture-gap / renderer / harness / design) or prints <strong>UNTRIAGED</strong>. A baseline gate re-scores every row and fails on regression beyond ±0.1pp; moving the baseline is an explicit, reviewed act. Reproduce: <code>npm run extract:figma:visual</code> → <a href="${REPO_URL}/blob/main/extract/figma/visual-parity/REPORT.md">REPORT.md</a>.</p>
<p>Cross-renderer deltas are named, not tolerated away: font rasterization differences ride the text mask; text-hug metrics (±1–2 CSS px on hug-sized boxes) stay in the score and are triaged <code>renderer</code>.</p>

<h2>The enterprise gauntlet</h2>
<p>Four large production design systems run through the <em>unmodified</em> code-extraction pipeline at pinned SHAs. The exercise surfaced two silent-loss classes the friendlier pilots never hit — vanishing <code>as</code>-expression exports, hollow intersection-of-named-refs props — both eliminated and receipt-locked. Every workaround is named in the report: <a href="${REPO_URL}/blob/main/extract/pilots/ENTERPRISE-GAUNTLET.md">ENTERPRISE-GAUNTLET.md</a>. The brownfield pilots that preceded it — including a 58/58-component web-component library, a 245-component React system extracted in under a second, and a complete real code ⇄ design pair — keep their receipts in <a href="${REPO_URL}/tree/main/extract/pilots">extract/pilots/</a>.</p>

<h2>Certification, today and tomorrow</h2>
<p>Today, "certified" means: every capability claim in the reference implementation is backed by an executable check or a committed receipt — the eval suite gates the machinery, the census and visual instruments gate the imports, and the golden manifests gate the generators. The end state is a <strong>conformance kit</strong> a second, independent implementation can run — the roadmap's final, falsifiable exit criterion: <em>an implementation this repo's authors didn't write passes the conformance kit</em> (<a href="${REPO_URL}/blob/main/ROADMAP.md">ROADMAP.md</a>).</p>
`;
  return howShell(foundation('instruments'), 'The instruments', 'The whole-kit census, the visual-parity instrument, and the enterprise gauntlet — standing measurements with committed reports and real numbers.', body);
}

function roundTripsPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">How it works · foundations 6</p>
<h1>Round-trips</h1>
<p class="lede">The piece that settles the source-of-truth argument: every change on either surface becomes a reviewable proposal to the contract, and the contract regenerates the other side. Executed end-to-end, in both directions, with receipts committed.</p>
${diagram('prop-lifecycle', 'The promotion loop: a hand edit on one surface is flagged by the differ with a complete proposed contract patch, promoted by a human into the contract with a version bump, regenerated onto both surfaces, and verified — a surface that lags is named until it catches up.')}

<h2>Direction 1 — code ahead (the product engineer)</h2>
<ol class="steps">
<li><h3>Hand-edit the generated code</h3><p><code>loading?: boolean</code> added by hand to <code>Button.tsx</code> — the thing engineers actually do.</p></li>
<li><h3>The differ flags it</h3><p><code>npm run parity</code> → <code>[code AHEAD] Button.loading</code>, with a <em>complete proposed prop patch</em>, design-side binding included.</p></li>
<li><h3>Promotion</h3><p>Patch applied to <code>contracts/button.contract.json</code>; version bumped 1.0.0 → 1.1.0.</p></li>
<li><h3>Regenerate</h3><p><code>npm run build</code> — the hand edit superseded by the contract-governed version; the <code>Loading</code> property pushed to the live canvas set.</p></li>
<li><h3>Clean</h3><p>Snapshot refreshed → <code>npm run parity</code> → clean.</p></li>
</ol>
<p class="section-note">This exact loop is replayed with the real differ and real emitters, step by step, on <a href="/how-it-works/adding-a-prop/">How are properties added?</a></p>

<h2>Direction 2 — canvas ahead (the designer)</h2>
<p>A designer's edit on the canvas — a dark-mode surface alias retargeted — comes back as a <code>MISMATCH</code> finding with a proposed token patch. Promotion updates <code>tokens/modes/semantic.dark.tokens.json</code>; the token build re-emits the CSS custom property; the code workshop's dark mode reflects it immediately; parity returns clean. <strong>Same door in both directions:</strong> a diffable change to a JSON file in Git, reviewable by designers and engineers alike. (Full narrative with the operational learnings: <a href="${REPO_URL}/blob/main/docs/06-parity-loop.md">docs/06 — The Parity Loop</a>.)</p>

<h2>Round-trip identity — the standing check</h2>
<p>Beyond the executed demo, the repo's own generated components are continuously re-extracted — code→contract and design→contract — and matched against their shipping contracts: <strong>zero mismatches, both directions, red-tested</strong> (the checks are proven able to fail). Receipts: <a href="${REPO_URL}/blob/main/extract/ROUNDTRIP-CODE.md">code round-trip</a> · <a href="${REPO_URL}/blob/main/extract/figma/ROUNDTRIP.md">plugin-dump round-trip</a> · <a href="${REPO_URL}/blob/main/extract/figma/rest/ROUNDTRIP-REST.md">REST round-trip</a>.</p>

<h2>What the loop caught on its very first run</h2>
<p>The first baseline <code>npm run parity</code> flagged that the canvas Button's default <code>Size</code> was <code>Small</code> while the contract says <code>md</code>. Root cause: the design tool's default variant is <em>positional</em> (top-left of the set), and the generator had laid variants out in enum order. Fixed twice over — the live set re-arranged, and the generator now orders every axis default-value-first. Not staged; the loop caught a real gap on day one.</p>

<h2>What "parity clean" does and doesn't mean</h2>
<p>The differ verifies the contracted API surface: props with types <em>and kinds</em>, variant axes and option sets, defaults on both surfaces, slot properties and their accepts, nested instances, and every token variable. It does <strong>not</strong> continuously inspect anatomy internals below the API surface — those are enforced at generation time and re-verified visually by <a href="/how-it-works/instruments/">the visual-parity instrument</a>, and the docs say so rather than rounding up.</p>
`;
  return howShell(foundation('round-trips'), 'Round-trips', 'The promotion loop executed in both directions — engineer’s prop and designer’s token change through the same door — plus zero-mismatch re-extraction receipts.', body);
}

export function buildHowPages(stats: SiteStats, replays: HowReplays): Array<{ route: string; html: string }> {
  return [
    indexPage(),
    addingAPropPage(replays),
    nestedComponentsPage(replays),
    atScalePage(replays, stats),
    modelPage(),
    protocolPage(),
    stylesPage(),
    determinismPage(),
    instrumentsPage(stats),
    roundTripsPage(),
  ];
}
export { PLAYGROUND_URL };
