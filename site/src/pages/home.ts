/**
 * Home — current product scope and conversion model. The contract excerpt
 * is loaded from the repository at build time; the numbers strip is computed,
 * never transcribed. Milestone status belongs in docs/CURRENT.md.
 */
import { layout, PLAYGROUND_URL, REPO_URL } from "../html.js";
import { shippingExample } from "../examples.js";
import { whatWorksData, docUrl, LIMITS_REL } from "../what-works.js";
import type { SiteStats } from "../stats.js";
import type { CoverageReceipt } from "../coverage.js";

export function homePage(
  stats: SiteStats,
  receipt: CoverageReceipt,
): { route: string; html: string } {
  const fmt = (n: number | undefined): string =>
    n === undefined ? "—" : n.toLocaleString("en-US");
  // The measured pair. Read from the generated capability report — the front
  // door quotes a fidelity number only with the denominator it was taken over.
  const w = whatWorksData().n;

  const numbers = `
<div class="numbers">
  <div class="number"><div class="number__value">${fmt(stats.contracts)}</div><div class="number__label">component contracts<br>in <a href="${REPO_URL}/tree/main/contracts">contracts/</a></div></div>
  <div class="number"><div class="number__value">${fmt(stats.tokens)}</div><div class="number__label">DTCG design tokens,<br>one pipeline, both surfaces</div></div>
  <div class="number"><div class="number__value">${stats.evalsPassed}/${stats.evalsTotal}</div><div class="number__label">deterministic evals green<br>(<code>npm run eval</code>)</div></div>
  <div class="number"><div class="number__value">${stats.emitters}</div><div class="number__label">emitters behind one interface:<br>react · html · react-inline · figma</div></div>
  <div class="number"><div class="number__value">${receipt.documented}/${receipt.schemaBranches}</div><div class="number__label">schema branches documented —<br><a href="/spec/#coverage">the coverage receipt</a></div></div>
  ${
    stats.censusSets !== undefined
      ? `<div class="number"><div class="number__value">${fmt(stats.censusClean)}/${fmt(stats.censusSets)}</div><div class="number__label">enterprise kit sets imported clean<br>(<a href="/how-it-works/instruments/">the census</a>)</div></div>`
      : ""
  }
</div>
<p class="section-note">Counted from the repository at build time — contracts, tokens, and the emitter registry are read, not quoted; instrument numbers come from the committed reports they cite.</p>`;

  const body = `
<div class="hero">
  <p class="eyebrow">An open specification for component contracts</p>
  <h1>The source of truth is neither the design file nor the code.</h1>
  <p class="lede">Design System Contracts connects <strong>React libraries and editable Figma component sets</strong> through a shared, machine-readable contract. Readers and generators exist; the complete code-led, design-led and reconciliation journeys are still being built.</p>
  <div class="doors">
    <a class="door door--primary" href="/system/">The whole loop <span class="door__arrow">→</span></a>
    <a class="door" href="/get-started/">Installation and user journeys</a>
    <a class="door" href="${PLAYGROUND_URL}">Try the Playground <span class="door__arrow">→</span></a>
    <a class="door" href="/spec/">Read the Spec <span class="door__arrow">→</span></a>
  </div>
  <p class="section-note"><a href="/get-started/">Get started</a> explains three starting points: a Figma library you want as React (<a href="/get-started/#designer-first">design-led</a>), a React library you want in Figma (<a href="/get-started/#code-first">code-led</a>), or existing libraries you want to reconcile (<a href="/get-started/#both-libraries">both</a>).</p>
  <p class="section-note"><strong>V1 is incomplete.</strong> React is the V1 code target and the immediate code-import priority. Lit and Web Components work is paused for a planned V1.1 follow-up. All three complete journeys remain unqualified; <a href="/system/">the current plan</a> names the remaining work and release criteria.</p>
</div>

<section id="positions">
  <h2>What the project is built around</h2>
  <p>A shared specification, reusable conversion rules and explicit limits.</p>
  <div class="positions">
    <div class="position"><h3>Bidirectional</h3><p>Contract readers and emitters exist for both surfaces. Bounded round-trip measurements are not yet proof of complete autonomous library conversion.</p></div>
    <div class="position"><h3>Deterministic</h3><p>Supported conversions use defined rules rather than AI inference. AI is not required to convert a contract; optional assistance does not establish missing facts.</p></div>
    <div class="position"><h3>Explicit limits</h3><p>Readers report unsupported or ambiguous facts. A useful result must say what it preserves and what still needs an explicit decision.</p></div>
    <div class="position"><h3>Open</h3><p>The schema, the engine, and every instrument that verifies them are in one repository under one permissive license, with no gated tier — because a spec the community can't fully use isn't a spec.</p></div>
  </div>
</section>

<section id="model">
  <h2>React ↔ shared contracts ↔ Figma</h2>
  <p>The contract is a structured specification of a component: its parts, layout, tokens, properties, states, content areas and references to other components. Readers extract supported facts from React or Figma; deterministic generators translate the contract into the other surface.</p>
  <div class="diagram"><img src="/assets/product-loop.svg" alt="Intended V1 workflows: React library to shared contract to editable Figma component sets; Figma library to shared contract to reusable React; changes compared, repaired under policy and independently verified." width="1080" height="600"></div>
  <p><strong>Reusable rules make composition possible.</strong> A table made from rows, cells, checkboxes and menus should reuse rules for layout, token bindings, properties, slots and nested component references. The goal includes advanced component sets and instance swaps; it does not require a separate handcrafted converter for every possible composition.</p>
  <p><strong>Appearance cannot supply arbitrary behavior.</strong> A drawn sorted column does not specify its sorting algorithm or data source. Supported behavior must come from the existing implementation or an explicit behavior definition. Neither a drawing nor a rendered snapshot can recover arbitrary application logic.</p>
  <p>The intended maintenance loop compares both surfaces with their last verified baseline, proposes supported changes, applies authorized repairs and verifies the result. That complete loop remains unfinished. See <a href="/system/">the plan and measures of success</a> and <a href="/how-it-works/">the engine walkthroughs</a>.</p>
</section>

<section id="contract">
  <h2>What a contract looks like</h2>
  <p>One versioned JSON document per component records supported props, anatomy, token bindings, slots, accessibility semantics and declared events. Component references connect those documents into a library. This excerpt comes from the repository's reference implementation.</p>
  ${shippingExample("banner.contract.json", {
    paths: ["id", "name", "version", "props", "anatomy.root.tokens"],
    limit: { props: 1 },
  })}
  <p>The same contract supplies the React and Figma generators. Generated output still needs independent checks of appearance, structure, editability and supported behavior. Every field is specified in <a href="/spec/">the schema reference</a>.</p>
</section>

<section id="numbers">
  <h2>Repository measurements</h2>
  ${numbers}
  <h3>Measured scope and its limits</h3>
  <p>The committed reports record ${w.measured} components from ${w.libraries} third-party libraries at <strong>${w.meanEqual}% mean computed-style equality</strong> against the original package rendering (exact string match, no tolerance, ${w.cells} cells), and Figma-kit-to-code results of <strong>${w.canvasMean}</strong> over ${w.canvasScored} scored variants. Those ${w.measured} components represent <strong>${w.coverage}</strong> of the ${w.librarySize} in their source libraries and were selected for tractability. These are scoped engine measurements, not qualification of the complete React V1 journeys or a prediction for an arbitrary library.</p>
  <div class="doors">
    <a class="door" href="/what-works/">What works — measured, denominator first <span class="door__arrow">→</span></a>
    <a class="door" href="${docUrl(LIMITS_REL)}">Known limitations — what it costs <span class="door__arrow">→</span></a>
  </div>
</section>

<section id="doors-again">
  <h2>Three doors in</h2>
  <div class="cards">
    <a class="card" href="/spec/"><h3>Read the Spec</h3><p>Every schema branch, with constraints, refusal rules, and real shipping contracts as examples.</p><span class="card__meta">generated from the schema</span></a>
    <a class="card" href="${PLAYGROUND_URL}"><h3>Try the Playground</h3><p>Explore contract imports, previews and engine diagnostics. Follow the current journey guide for available actions and unfinished delivery steps.</p><span class="card__meta">development application · V1 in progress</span></a>
    <a class="card" href="/get-started/"><h3>Get started</h3><p>Start with a React library, a Figma library or both. Installation, available workflows and remaining limits are explained for each starting point.</p><span class="card__meta">three starting points · one shared contract</span></a>
  </div>
</section>
`;

  const html = layout(
    {
      path: "/",
      title:
        "Design System Contracts — an open specification for component contracts",
      description:
        "React libraries and editable Figma component sets, connected through shared contracts and deterministic conversion rules. Explore the current capabilities and unfinished V1 journeys.",
    },
    body,
  );
  return { route: "/", html };
}
