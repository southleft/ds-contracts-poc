/**
 * What works — /what-works/. The success side of the pair.
 *
 * The repository has a 1,100-line limitations document and, until this page,
 * no counterpart: every win existed as a number inside a JSON file nobody
 * opens. This page is the rendering of `docs/24-what-works.md`, which is
 * GENERATED from the committed artifacts and refreshed by
 * `npm run capability:report` — its freshness is one of the evals
 * (`npm run capability:fresh`). Nothing on this page is typed in; every table
 * and every number in the prose is parsed out of that report at build time,
 * and a section that stops existing refuses the build by name.
 *
 * Two rules the page keeps, both inherited from the report:
 *   1. THE DENOMINATOR COMES FIRST. The coverage table is printed above every
 *      mean, because a fidelity average over a hand-picked slice, printed
 *      without the slice, is the most misleading thing this project could
 *      publish.
 *   2. THE COMPANION IS NEVER OPTIONAL. Every route into this page carries
 *      docs/23 beside it, and the page ends on it.
 */
import { layout, badge, REPO_URL } from "../html.js";
import {
  whatWorksData,
  renderTable,
  docUrl,
  REPORT_REL,
  LIMITS_REL,
} from "../what-works.js";

export function whatWorksPage(): { route: string; html: string } {
  const d = whatWorksData();
  const n = d.n;
  const report = docUrl(REPORT_REL);
  const limits = docUrl(LIMITS_REL);
  const gen = badge(
    "generated",
    `Parsed at build time from ${REPORT_REL}, which is itself generated from the committed artifacts by npm run capability:report and gated by npm run capability:fresh.`,
  );

  const body = `
<p class="eyebrow">Measured</p>
<h1>What works</h1>
<p class="lede">The success side of the pair. <strong>${n.measured} components</strong> from <strong>${n.libraries} third-party libraries</strong> across five styling architectures were run through one pipeline and scored against the original package rendering: <strong>${n.meanEqual}% mean computed-style equality</strong>, exact string match, no tolerance, over ${n.cells} style cells. In the other direction a ${n.canvasRows}-variant Figma kit converted to code scores <strong>${n.canvasMean}</strong> over the ${n.canvasScored} statically scorable variants. <strong>What that does not say:</strong> those ${n.measured} components are <strong>${n.coverage}</strong> of the ${n.librarySize} components in the libraries they came from, and they were picked because they were the tractable ones.</p>

<div class="fidelity">
<p><strong>Read this page with its companion.</strong> This one is the shorter of the two, and it is the one written by the interested party. <a href="${limits}">${LIMITS_REL} — Known Limitations</a> is the complete inventory of what this tool does not do: coverage, the component classes captured nowhere, what a captured component fails to reproduce, the journey verbs that do not exist, and what each gate leaves out of its denominator. If you are deciding whether to adopt this, read that one too — start with its coverage section, which opens on the same ${n.coverage} denominator this page does.</p>
</div>

<div class="numbers">
  <div class="number"><div class="number__value">${n.coverage}</div><div class="number__label">of the ${n.librarySize} components in those<br>libraries are measured here — <a href="#denominator">the denominator</a></div></div>
  <div class="number"><div class="number__value">${n.meanEqual}%</div><div class="number__label">mean computed-style equality<br>over ${n.measured} captured components</div></div>
  <div class="number"><div class="number__value">${n.canvasMean}</div><div class="number__label">canvas→code visual fidelity<br>over ${n.canvasScored} scored variants</div></div>
  <div class="number"><div class="number__value">${n.executedToFactDiff}</div><div class="number__label">components that reached the round-trip fact diff<br><strong>${n.verifiedExact} verified exact</strong> — <a href="#roundtrip">execution is not exactness</a></div></div>
  <div class="number"><div class="number__value">${n.evals}</div><div class="number__label">executable claims green<br>(<code>npm run eval</code>)</div></div>
  <div class="number"><div class="number__value">${n.golden.replace(" files hashed", "")}</div><div class="number__label">generated files pinned byte-identical<br>(<code>evals/golden.json</code>)</div></div>
</div>
<p class="section-note">Every figure above and below is parsed at build time out of <a href="${report}"><code>${REPORT_REL}</code></a>, which is generated from the committed artifacts — no number on this page is typed in, and the coverage figure is printed at the same size as the flattering ones on purpose.</p>

<h2 id="denominator">The denominator, first ${gen}</h2>
<p>Every mean below is an average over captured components. This is <em>which</em> components, and what fraction of each library they are — printed before the results rather than after them.</p>
${renderTable(d.denominator, { drop: ["source of the size"] })}
<p><strong>Read every percentage on this page as “on the easy ${n.coverage}.”</strong> The ${n.measured} measured components were chosen because they were <strong>tractable</strong>, not at random — Button, Badge, Chip, Card, Checkbox, Tag, Avatar, Divider and their siblings. Data grid, tree, virtualized list, date picker, rich text and charts appear in <strong>zero</strong> committed contracts. A mean over this slice is a statement about this slice.</p>
<p class="section-note">The size denominators are the one set of numbers here that is not machine-derived: they come from one-off extractor runs recorded in <a href="${REPO_URL}/blob/main/docs/22-generality.md">docs/22 §8.3</a>, and they count helpers and utility directories, so they lean against us. The true percentages are a little higher; the order of magnitude is the finding. This page also uses the stricter column — components with a <em>measured scorecard</em> (${n.measured}), not contracts committed (${n.contracts}) — because the fidelity numbers describe only the measured ones.</p>
<p>Three more corpora exist and are deliberately <em>not</em> counted above, because they are not third-party captures:</p>
${renderTable(d.otherCorpora)}

<h2 id="fidelity">Fidelity — code → contract → rendering ${gen}</h2>
<p>The measurement: an enriched contract is emitted to HTML by <code>core/emit-html</code> and compared against <strong>the original npm package rendering</strong> in the same pinned Chromium, per prop combination × interaction state. Computed-style equality is an <strong>exact string match over the styled channel set, with no tolerance and no whitelist</strong> — the browser's full longhand set is enumerated, and a channel the pipeline never opened still counts against it.</p>
${renderTable(d.perLibrary, { drop: ["source"] })}
<p><strong>Two means, both printed, because they answer different questions.</strong> The unweighted mean (${n.meanEqual}%) treats a 16-cell Spinner and an 83,520-cell Button as equals; the cell-weighted figure (${n.cellWeighted}%) is what fraction of every style cell in the corpus actually matched. Neither is quoted alone. ${n.over90} components are at ≥90%, ${n.over80} at ≥80%.</p>

<h3 id="worst-first">Every measured component, worst first</h3>
<p>No component is omitted, and the worst row in the corpus is at the top. A success page that showed only its best rows would be the exact failure this project exists to catch.</p>
${renderTable(d.worstFirst, { drop: ["source"] })}

<h3 id="frontier">The synthetic fixture, held out of every average above</h3>
<p><code>extract/computed/out/conformance/</code> holds ${n.frontierCases} more scorecards at a mean of ${n.frontierMean}%. They are <strong>excluded from the table above entirely</strong> and must never be folded into a library mean: they are synthetic single-construct cases this repo wrote to probe one CSS or DOM feature each, not components from anyone's design system. Including them would raise the headline by averaging in a fixture we built to be measurable — the shape of every overclaim this repo has caught. The corpus is partitioned by directory <em>before</em> any mean is taken.</p>
${renderTable(d.frontier, { drop: ["source"] })}

<h2 id="canvas">Fidelity — canvas → code ${gen}</h2>
<p>The reverse journey, measured on a real Figma community kit. Variants are proposed from the canvas into contracts, emitted as static HTML, rendered, and scored against the exported reference image of the same variant.</p>
${renderTable(d.canvas, { drop: ["source"] })}
<p>The unscored rows are named rather than dropped, and they are not all one thing:</p>
${renderTable(d.unscored, { drop: ["source"] })}
<p>An interaction-state rendering is produced by CSS at runtime, so a static export cannot be scored against it — that is an instrument limit. The rest is a <strong>carriage gap</strong>: an axis the pipeline did not carry. They are counted separately rather than folded into the same excuse.</p>
${renderTable(d.perSet, { drop: ["source"] })}
<p class="section-note"><strong>Denominator for that table:</strong> these are the sets in one community kit that were imported at all. The kit's un-imported sets do not appear as low scores — they do not appear.</p>

<h2 id="roundtrip">The round trip closes — and it is not lossless ${gen}</h2>
<p>Canvas → code → canvas, on the same kit. The claim is <strong>not</strong> that the round trip preserves everything. It is that it <strong>closes</strong>: it runs to completion on every component, and every fact lands in exactly one of four buckets, so a loss is a row in a table rather than an absence.</p>
${renderTable(d.buckets, { drop: ["source"] })}
<p><strong>${n.matchedShare} matched is the honest headline, and it is not high.</strong> The value of this instrument is the classification, not the ratio — and the largest single divergence class is an artifact of the comparison rather than a loss: <code>auto-layout-inert</code> accounts for <strong>${n.inertReclassified} of the ${n.inertOfTotal}</strong> <code>layout.mode</code> divergences. A frame with one child, or with children the designer positioned absolutely, has no observable auto-layout direction to read back; the engine writes a direction the original canvas did not record. It is tagged as its own class precisely so it cannot be counted as a fidelity loss. The remaining ones are real.</p>
${renderTable(d.bucketTags, { drop: ["source"] })}
<p>The <code>(untagged)</code> rows are the honest hole in this instrument: those facts are classified into a bucket but carry no <em>reason</em>, so nothing here can say whether they are engine defects or comparison artifacts. They are printed rather than excluded from the denominator.</p>

<h2 id="honesty">The honesty instruments, counted as features ${gen}</h2>
<p>These are the numbers this project is least tempted to publish and most needs to. Each one counts something the engine <strong>could not do and said so</strong>. They belong in a capability report because a conversion tool without them is not more capable — it is just quieter.</p>
<h3 id="receipts">Dropped-fact receipts</h3>
<p>When the plugin engine compiles a contract and cannot carry a fact onto the canvas, it emits a receipt naming the fact. Across the committed corpora there are <strong>${n.receiptTotal}</strong> such receipts, and the count is pinned <strong>exactly</strong>, in both directions — fewer receipts is not automatically progress, because it is either a real fix or a refusal path that quietly stopped firing, and both require a human to look.</p>
${renderTable(d.receipts, { drop: ["source"] })}
<h3 id="vocabularies">Named refusals — the construct vocabularies</h3>
<p>Two hand-authored manifests are the independent denominators for “what can the engine be asked to do”. Both are deliberately <strong>not</strong> derived from the code that decides carriage: an instrument whose denominator comes from the same filter that decides carriage scores 100% on a channel it never opened. A construct that is neither carried nor named-refused is a hard failure of the suite — “it silently did nothing” is not an allowed outcome.</p>
${renderTable(d.vocabularies, { drop: ["source"] })}

<h2 id="reproducible">Reproducibility — the part that is not a percentage ${gen}</h2>
<p>A fidelity number you cannot reproduce is an anecdote. These are the pins that make everything above re-derivable, and each is enforced by a gate rather than asserted in prose.</p>
${renderTable(d.pins, { drop: ["source"] })}
<p>The ${n.evals.split("/")[1]} executable claims are not all “does it work”. They are classified by what they claim, and the largest classes after extraction are <strong>detection</strong> and <strong>refusal</strong> — gates that fail if the engine <em>stops</em> saying no. An engine that carries everything is not a better engine; it is one that has stopped telling you what it could not do.</p>
${renderTable(d.claimClasses, { drop: ["source"] })}

<h2 id="cost">What it costs</h2>
<p>Not restated here, deliberately — a summary of the limitations written by the success document is a summary written by the interested party. The complete inventory is <a href="${limits}"><strong>${LIMITS_REL} — Known Limitations</strong></a>, and it is the longer of the two. It answers the three questions this page cannot: how long a library takes to onboard, how much of the work is expert-configured rather than automatic, and whether any of this holds past the ${n.coverage} in the denominator table.</p>
<div class="doors">
  <a class="door door--primary" href="${limits}">What it costs — Known Limitations <span class="door__arrow">→</span></a>
  <a class="door" href="/get-started/">Choose your path <span class="door__arrow">→</span></a>
</div>

<p class="receipt-line">This page is a rendering of <a href="${report}"><code>${REPORT_REL}</code></a>, generated by <code>npm run capability:report</code> from ten committed artifacts and refused by <code>npm run capability:fresh</code> if the committed bytes differ from a rebuild — one of the ${n.evals.split("/")[1]} evals runs that refusal. Every table above is parsed out of that file at build time; a section or a row that stops existing fails this build by name rather than rendering a blank. The report also cross-checks its own corpus twice from independent files — ${n.measured} scorecards, ${n.contracts} committed contracts, and the capture double-sweep receipts (${n.doubleSweep}) — against a document written months earlier for a different purpose, and prints any disagreement instead of resolving it toward the more flattering value.</p>
`;

  const html = layout(
    {
      path: "/what-works/",
      title: "What works — Design System Contracts",
      description: `The measured success side, denominator first: ${n.measured} third-party components at ${n.meanEqual}% mean computed-style equality — which is ${n.coverage} of the libraries they came from. Generated from committed artifacts, and never published without its companion, Known Limitations.`,
    },
    body,
  );
  return { route: "/what-works/", html };
}
