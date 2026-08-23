/**
 * How it flows — the two directions, rendered from docs/29-how-it-flows.md.
 *
 * The doc is the ONE prose source (GitHub renders it natively); this page
 * renders the same bytes through `marked` — exactly as /contribute/ renders
 * site/governance/TEMPLATE.md — and swaps three things in at build time:
 *
 *   · each ```mermaid fence, keyed by its `%% id:` line, becomes the
 *     light/dark SVG pair drawn in src/diagrams.ts (pages ship no client
 *     JS beyond the theme toggle, so mermaid cannot run in the browser —
 *     the figures are pre-rendered here and the build refuses an id it
 *     does not know, or a known id the doc stopped carrying);
 *   · `<!-- site:… -->` markers become engine replays (src/how-replays.ts
 *     `flow`): the real canvas round trip held to the committed receipt,
 *     the real Figma engine over Button and TopNavItem, the ToggleSwitch
 *     code-only facts from the committed bundle, the refusal sentences
 *     sliced verbatim from source;
 *   · relative `NN-….md` links resolve to the repo docs on GitHub, and the
 *     FC-* wall codes link to the docs/23 section that carries each.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { codeBlock, esc, themedImage, REPO_URL, PLAYGROUND_URL } from '../html.js';
import { flowChainLegend } from '../diagrams.js';
import { docUrl, LIMITS_REL } from '../what-works.js';
import type { FlowReplay, FlowCodeOnlyFact, FlowCompiled } from '../how-replays.js';

export const FLOW_DOC_REL = 'docs/29-how-it-flows.md';

/** The three fences docs/29 carries, by `%% id:` — each must exist in the doc
 *  and each must have a drawing; either side drifting refuses the build. */
const FENCE_IDS = ['flow-chain', 'disposition', 'adjudication-star'] as const;

const FENCE_ALT: Record<(typeof FENCE_IDS)[number], string> = {
  'flow-chain':
    'The five hops, one shape: code source reaches the contract through hop 1; the contract reaches generated code through hop 3 and the canvas through hop 2 (bundle, plan, a human clicks Apply); the canvas comes back through hop 4 (dump, propose) and hop 5 (PR, figma receive --apply, or copy). The contract is the only file every hop reads or writes.',
  disposition:
    'Disposition tree: a fact outside the contract vocabulary is NAMED in a sidecar or note; inside it, a fact with a field on the target surface is CARRIED, a fact a named rule can lower is LOWERED and NAMED, and a fact that would be a guess is REFUSED BY NAME. Neither carried nor named is a hard failure in the hand-authored conformance manifests.',
  'adjudication-star':
    'The adjudication star: the instruments classify drift against the contract — the two surfaces never sync side-to-side — and a change to the contract is a pull request merged by a human.',
};

/** GitHub's heading slug, so docs/23 anchors resolve on github.com. */
const ghSlug = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

/** The FC-* codes docs/23 cites (the list docs/29 §0 states), each resolved
 *  to the section that first names it — computed from the committed file so
 *  a moved section cannot leave a dead anchor, and a dropped code refuses
 *  the build. */
function fcAnchors(): Array<{ code: string; section: string; href: string }> {
  const lines = readFileSync(path.join(process.cwd(), LIMITS_REL), 'utf8').split('\n');
  const codes = ['FC-APPLY-TOKENS-NOT-PRUNED', 'FC-DUMP-PROPOSE-PART-STATE-CHANNELS', 'FC-DUMP-PROPOSE-UNBOUND-BOOLEAN', 'FC-FONT-SUBSTRATE', 'FC-GEOMETRY-EXCLUDED', 'FC-RT-'];
  return codes.map((code) => {
    const at = lines.findIndex((l) => l.includes(code));
    if (at < 0) throw new Error(`how-flow: ${LIMITS_REL} no longer names ${code} — docs/29 §0 lists it among the docs/23 cites`);
    let h = at;
    while (h >= 0 && !/^#{1,3} /.test(lines[h])) h -= 1;
    if (h < 0) throw new Error(`how-flow: ${LIMITS_REL} names ${code} before any heading`);
    const heading = lines[h].replace(/^#+\s*/, '');
    return { code: code.endsWith('-') ? `${code}*` : code, section: heading, href: `${docUrl(LIMITS_REL)}#${ghSlug(heading)}` };
  });
}

// ---------------------------------------------------------------------------
// Replay renderers
// ---------------------------------------------------------------------------

const factsTable = (facts: FlowCodeOnlyFact[]): string =>
  `<div class="table-wrap"><table><thead><tr><th>part</th><th>kind</th><th>channel</th><th>value</th><th>reason</th><th>variants</th></tr></thead><tbody>${facts
    .map(
      (f) =>
        `<tr><td><code>${esc(f.part)}</code></td><td>${esc(f.kind)}</td><td><code>${esc(f.channel)}</code></td><td><code>${esc(f.value)}</code></td><td>${esc(f.reason)}</td><td>${f.variants.count}/${f.variants.of}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;

const compiledLine = (c: FlowCompiled): string =>
  `<code>${esc(c.contractId)}</code> — ${c.variants} variants${c.statePreviews ? ` + ${c.statePreviews} <code>State=</code> previews` : ''}; first variant <code>${esc(
    c.firstVariant,
  )}</code>; root fill ${c.rootFill ? `<code>${esc(c.rootFill)}</code>` : '— none'}; textProps <code>${esc(JSON.stringify(c.textProps))}</code>; code-only facts <strong>${c.codeOnlyFacts.length}</strong>`;

function compileReplay(F: FlowReplay): string {
  return `
<div class="replay">
<p class="replay__head">Replayed at build — <code>createFigmaEngine().compileComponentData</code> over the shipping contracts (the function the plugin and <code>figma bundle</code> run), and the committed Flowbite bundle read back</p>
<ul>
<li>${compiledLine(F.button)} — hover / focus / disabled draw as <code>State=</code> previews because <code>bindings.figma.statePreviews</code> is on, so nothing is left for the receipt.</li>
<li>${compiledLine(F.topNavItem)} — the <code>href</code> VALUE rides as the unbound TEXT property; the <code>attrs.href</code> BINDING is in neither list (§6).</li>
<li><code>${esc(F.toggleSwitch.contractId)}</code> — ${F.toggleSwitch.facts.length} code-only facts in <code>examples/tailwind/figma/tailwind.bundle.json</code> (${Object.entries(F.toggleSwitch.byKind)
    .map(([k, n]) => `${n} ${k}`)
    .join(' · ')}); the bundle carries ${F.bundleFactTotal} across the Flowbite eight, pinned per contract by <code>npm run code-only-facts:check</code>:</li>
</ul>
${factsTable(F.toggleSwitch.facts)}
<p class="receipt-line">The build refuses if Button compiles to anything but 12 variants and 0 facts, TopNavItem to anything but <code>[{Href, #}]</code>, or ToggleSwitch's 12 move — the numbers on this page are the engine's, re-derived on every build.</p>
</div>`;
}

function roundtripReplay(F: FlowReplay): string {
  const R = F.roundtrip;
  const rows = R.rows
    .map((r) => `<tr><td>${esc(r.component)}</td><td>${r.matched}</td><td>${r.canvasAbsent}</td><td>${r.mismatch}</td></tr>`)
    .join('');
  const absent = R.badge.canvasAbsent
    .map((f) => `<li><code>${esc(f.subject)}</code> — ${esc(f.detail)}</li>`)
    .join('');
  const notes = R.badge.notes.length
    ? `<ul class="refusals">${R.badge.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : `<p class="section-note">The Badge proposal carried no notes — every drawn fact inverted by a rule.</p>`;
  return `
<div class="replay">
<p class="replay__head">Replayed at build — hop 4 on the committed fixture <code>extract/figma/fixtures/main-file-dumps.json</code> (Badge), through <code>extract/figma/roundtrip.ts</code>: the same <code>proposeFromDump</code> + <code>compareContracts</code> that write <code>ROUNDTRIP.md</code></p>
<p>The fixture is a live dump of a contract-generated set, captured before dumps carried a <code>dumpVersion</code> (its <code>_provenance.dumpVersion</code> is ${
    R.badge.dumpVersion ? `<code>${esc(R.badge.dumpVersion)}</code>` : 'absent'
  }) and ${R.badge.hasPropertyDefinitions ? 'with' : 'without'} <code>propertyDefinitions</code> — so it runs <code>reviewable-inversion</code> (exact would refuse <code>EXACT_DEFINITIONS_MISSING</code>) and the proposal's projection reads <code>${esc(
    R.badge.projection,
  )}</code>. Proposal notes (${R.badge.notes.length}) and unbound values (${R.badge.unbound}):</p>
${notes}
<p>The proposal compared against the shipping <code>contracts/badge.contract.json</code>:</p>
<div class="table-wrap"><table><thead><tr><th>Component</th><th>MATCHED</th><th>CANVAS-ABSENT</th><th>MISMATCH</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Badge's ${R.badge.matched.length} matched facts: ${R.badge.matched.map((m) => `<code>${esc(m)}</code>`).join(' · ')}.</p>
<p>Badge's ${R.badge.canvasAbsent.length} CANVAS-ABSENT facts, each with its reason — the canvas cannot express them, and the receipt says so per fact:</p>
<ul>${absent}</ul>
<p class="receipt-line">The build refuses if any row above disagrees with the committed <a href="${docUrl('extract/figma/ROUNDTRIP.md')}"><code>extract/figma/ROUNDTRIP.md</code></a> — the replay and the receipt are held to each other.</p>
</div>`;
}

function refusalsReplay(F: FlowReplay): string {
  return `
<div class="replay">
<p class="replay__head">Sliced verbatim from source at build — the build refuses if any sentence stops matching</p>
${codeBlock(F.refusals.bundle, 'text', 'packages/cli/src/commands/figma.ts — hop 2, `ds-contracts figma bundle` (N of M substituted for the template expressions)')}
${codeBlock(F.refusals.plan, 'text', 'figma-sync/plugin/engine/entry.ts — hop 2, the plugin plans every contract or none')}
${codeBlock(F.refusals.generate, 'text', 'scripts/generate-components.ts — hop 3, atomic per contract')}
</div>`;
}

function namedRefusalsBlock(F: FlowReplay): string {
  const rows = fcAnchors()
    .map((a) => `<tr><td><code>${esc(a.code)}</code></td><td><a href="${a.href}">${esc(a.section)}</a></td></tr>`)
    .join('');
  return `
<h3 id="named-refusals">Named refusals you can grep for</h3>
<p>Walls carry codes. These are the <code>FC-*</code> codes <a href="${docUrl(LIMITS_REL)}">Known Limitations</a> cites (the list docs/29 §0 states), each linked to the section that carries it, plus the two reason prefixes that carry no code. The full census of <code>FC-*</code> codes across the tree is a grep, not a committed receipt, so no count is stated here or in the doc.</p>
<div class="table-wrap"><table><thead><tr><th>wall code</th><th>docs/23 section</th></tr></thead><tbody>${rows}
<tr><td><code>no canvas field for this literal channel — …</code></td><td>reason prefix, hop 2 — <code>core/emit-figma-script.ts</code> (<code>literalMiss</code>)</td></tr>
<tr><td><code>pseudo-decor-outside-grammar</code></td><td>reason prefix, hop 1 — <code>extract/computed/anatomy.ts</code></td></tr>
</tbody></table></div>
<p class="section-note">Dump grammar at both producers today: <code>${esc(F.dumpGrammar.plugin)}</code> (<code>extract/figma/dump.plugin.js</code>) and <code>${esc(F.dumpGrammar.rest)}</code> (<code>extract/figma/rest/map.ts</code>) — read from source at build, never typed.</p>`;
}

// ---------------------------------------------------------------------------
// Markdown → page
// ---------------------------------------------------------------------------

const slug = (text: string): string =>
  text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

function renderDoc(md: string, F: FlowReplay): string {
  // 1 · mermaid fences → pre-rendered themed SVG pairs, by `%% id:`.
  const seen = new Set<string>();
  let text = md.replace(/```mermaid\n%% id: ([a-z-]+)\n[\s\S]*?```/g, (_m, id: string) => {
    if (!(FENCE_IDS as readonly string[]).includes(id)) {
      throw new Error(`how-flow: ${FLOW_DOC_REL} carries a mermaid fence "%% id: ${id}" with no drawing in site/src/diagrams.ts — add one (and register it in site/build.ts) or the figure is lost`);
    }
    seen.add(id);
    const legend =
      id === 'flow-chain'
        ? codeBlock(flowChainLegend(F.dumpGrammar.rest).join('\n'), 'text', 'the five hops — the verbs as the CLI spells them')
        : '';
    return `<div class="diagram diagram--flow">${themedImage(`/assets/${id}-light.svg`, `/assets/${id}-dark.svg`, FENCE_ALT[id as (typeof FENCE_IDS)[number]])}</div>${legend}`;
  });
  for (const id of FENCE_IDS) {
    if (!seen.has(id)) throw new Error(`how-flow: ${FLOW_DOC_REL} no longer carries the "%% id: ${id}" fence that site/src/diagrams.ts draws`);
  }
  if (/```mermaid/.test(text)) throw new Error(`how-flow: ${FLOW_DOC_REL} has a mermaid fence without a "%% id:" first line`);

  // 2 · the H1 is the page's own; drop it from the rendered body.
  text = text.replace(/^# .*\n/, '');

  // 3 · marked with the site's code blocks, table wrap, heading anchors,
  //     and repo-relative doc links.
  const marked = new Marked({
    renderer: {
      code({ text: code, lang }) {
        const l = (lang ?? 'text').split(/\s/)[0];
        const known = ['json', 'jsonc', 'tsx', 'ts', 'bash', 'text'] as const;
        const pick = (known as readonly string[]).includes(l) ? (l as (typeof known)[number]) : 'text';
        return codeBlock(code, pick);
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        let target = href;
        if (/^[A-Za-z0-9._-]+\.md(#.*)?$/.test(href)) target = docUrl(`docs/${href}`);
        else if (/^\.\.\//.test(href)) target = `${REPO_URL}/blob/main/${href.replace(/^(\.\.\/)+/, '')}`;
        const t = title ? ` title="${esc(title)}"` : '';
        return `<a href="${target}"${t}>${inner}</a>`;
      },
    },
  });
  let html = marked.parse(text, { async: false }) as string;
  html = html.replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>');

  // 4 · site-only replays at the doc's markers (HTML comments, invisible on GitHub).
  const markers: Record<string, string> = {
    '<!-- site:replay:compile -->': compileReplay(F),
    '<!-- site:replay:roundtrip -->': roundtripReplay(F),
    '<!-- site:replay:refusals -->': refusalsReplay(F),
    '<!-- site:named-refusals -->': namedRefusalsBlock(F),
  };
  for (const [marker, block] of Object.entries(markers)) {
    if (!html.includes(marker)) throw new Error(`how-flow: ${FLOW_DOC_REL} no longer carries the ${marker} marker — the replay has nowhere to render`);
    html = html.replace(marker, block);
  }
  return html;
}

export function flowPageBody(F: FlowReplay): { title: string; description: string; body: string } {
  const md = readFileSync(path.join(process.cwd(), FLOW_DOC_REL), 'utf8');
  const body = `
<p class="eyebrow">How it works · the two directions</p>
<h1>How it flows: Figma ↔ code through contracts</h1>
<p class="lede">There is no Figma-to-code converter here and no code-to-Figma converter. Two pure functions each read or write one file — the contract — and six instruments classify drift against it — none writes to a surface, none picks a side. This page walks every hop, verb by verb, with the engine replayed beside the prose.</p>
<p class="section-note">Rendered at build from <a href="${docUrl(FLOW_DOC_REL)}"><code>${FLOW_DOC_REL}</code></a>, the one prose source (GitHub renders the same file). The figures are that file's <code>mermaid</code> fences, pre-rendered as themed SVG at build; the boxed replays ran the real engine over committed fixtures and the build refuses when they disagree with the committed receipts. The <a href="${PLAYGROUND_URL}">Playground</a> runs the same engine on the same fixtures in the browser.</p>
<div class="doc">${renderDoc(md, F)}</div>`;
  return {
    title: 'How it flows',
    description:
      'Figma ↔ code through contracts: the five hops, what each verb reads, writes and refuses, the three dispositions of a fact, the six instruments, and three facts traced both ways — rendered from docs/29 with the engine replayed at build.',
    body,
  };
}
