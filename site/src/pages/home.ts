/**
 * Home — the front door. The four-position statement is copied verbatim
 * from README.md's positioning paragraph (voice identical, per the site
 * brief); the contract excerpt is a real shipping contract loaded at build
 * time; the numbers strip is computed, never transcribed.
 */
import {
  layout,
  codeBlock,
  themedImage,
  PLAYGROUND_URL,
  REPO_URL,
} from "../html.js";
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
  <p class="lede">A design system's truth should live in a machine-readable <strong>contract</strong> that sits between the surfaces and generates both. This is the working spec for that contract — vendor-neutral, deterministic, and open — with a reference implementation that proves every claim it makes.</p>
  <div class="doors">
    <a class="door door--primary" href="/get-started/">Get started <span class="door__arrow">→</span></a>
    <a class="door" href="${PLAYGROUND_URL}">Try the Playground <span class="door__arrow">→</span></a>
    <a class="door" href="/spec/">Read the Spec <span class="door__arrow">→</span></a>
  </div>
  <p class="section-note">New here and not sure what this <em>does</em>? <a href="/get-started/">Get started</a> is organised by what you want: a component on the canvas that you want as code (<a href="/get-started/#a">A</a>), components in code that you want in Figma (<a href="/get-started/#b">B</a>), or a mature library on both sides that you want reconciled (<a href="/get-started/#c">C</a>).</p>
  <p class="section-note"><strong>Current state (2026-08-30).</strong> This site documents the <em>universal-contract</em> spec and Journeys A–C. The <strong>v1 proof surface is recipe-IR</strong> — five archetypes (Button, Input, Combobox, Table, Calendar) have stayed live Scratch mints and owner-signed grades. Product <strong>v1 is incomplete</strong> (F1: whole-corpus / unseen-library). The <a href="${PLAYGROUND_URL}">playground</a> still runs the pre-pivot engine and is not that proof. Read <a href="${REPO_URL}/blob/main/docs/32-recipe-ir-pivot.md">docs/32</a> and <a href="${REPO_URL}/blob/main/docs/26-v1-definition.md">docs/26</a> before treating anything on this page as v1-complete.</p>
</div>

<section id="positions">
  <h2>Four positions, held together</h2>
  <p>A growing category of tools speaks this vocabulary; this project holds four positions that, together, none of them do.</p>
  <div class="positions">
    <div class="position"><h3>Bidirectional</h3><p>The contract generates <em>both</em> the code and the design canvas, and imports from both — round-trips are proven, not promised.</p></div>
    <div class="position"><h3>Deterministic</h3><p>Every artifact is computed from file data and byte-pinned; no LLM guesses in the pipeline (AI is available as an assistant, never as an authority).</p></div>
    <div class="position"><h3>Receipted</h3><p>Anything the pipeline cannot carry is named on screen — a gap is reported, never papered over with a plausible value.</p></div>
    <div class="position"><h3>Open</h3><p>The schema, the engine, and every instrument that verifies them are in one repository under one permissive license, with no gated tier — because a spec the community can't fully use isn't a spec.</p></div>
  </div>
</section>

<section id="model">
  <h2>The model</h2>
  <p>Every organization that takes design systems seriously eventually splits into two camps. Some come in from the <strong>code side</strong>: the system is an npm package, and the design files are an aging picture of it. Others come in from the <strong>design side</strong>: the system is a canvas library, and the code is an approximation of the pictures. Both camps are answering the same question — <em>where does the truth live?</em> — and both answers fail the same way: whichever surface is declared canonical, the other becomes a hand-maintained copy. Copies drift. Drift erodes trust.</p>
  <div class="diagram">${themedImage("/assets/contract-flow-light.svg", "/assets/contract-flow-dark.svg", "Workflow diagram: the contract sits between the design surface and the code surface. Generation flows outward from the contract to both surfaces; changes on either surface flow back into the contract as promotions, and the contract regenerates the other side. A three-way differ verifies all of it continuously. Surfaces never sync side-to-side.", 'width="920" height="470"')}</div>
  <p>The rule that makes it work: <strong>surfaces never sync side-to-side.</strong> An engineer's new prop and a designer's color change take the same path — flagged by the differ, promoted into the contract as a reviewable diff, then regenerated out to the other surface. One arbiter, version-controlled, no arbitration meetings. It's the governance model that made Git work for code and the DTCG token format work for design tokens, run one level up — at the component-API layer.</p>
  <p>What physically crosses each hop — five hops, one file, and every fact carried, named, or refused by name — is walked verb by verb on <a href="/how-it-works/flow/">How it flows</a>, with the engine replayed beside the prose; its <a href="/how-it-works/flow/#0-glossary">glossary</a> defines every term this site uses.</p>
  <p><a href="/how-it-works/">How it works — three questions, answered with the engine running →</a></p>
</section>

<section id="contract">
  <h2>What a contract looks like</h2>
  <p>One small, versioned JSON document per component: props and their legal values, anatomy, token bindings, slot constraints, accessibility semantics, declared events. This excerpt is a shipping contract from the reference implementation — the same file generates the typed React component <em>and</em> the canvas component set, and a three-way differ proves both keep matching it.</p>
  ${shippingExample("banner.contract.json", {
    paths: ["id", "name", "version", "props", "anatomy.root.tokens"],
    limit: { props: 1 },
  })}
  <p>One file; two faithful renderings; a differ that can mechanically prove both. Every field is specified in <a href="/spec/">the reference</a> — generated from the schema itself, so the docs cannot drift from the spec.</p>
</section>

<section id="numbers">
  <h2>The proof, counted</h2>
  ${numbers}
  <h3>What it does, and what that costs — the pair</h3>
  <p>Those counts are about this repository. The question an adopter actually asks is what the tool does to <em>their</em> library, and that has two halves which are only honest together. <strong>What it does:</strong> ${w.measured} components from ${w.libraries} third-party libraries score <strong>${w.meanEqual}% mean computed-style equality</strong> against the original package rendering (exact string match, no tolerance, ${w.cells} cells), and in the other direction a Figma kit converts to code at <strong>${w.canvasMean}</strong> over ${w.canvasScored} scored variants. <strong>What that costs:</strong> those ${w.measured} components are <strong>${w.coverage}</strong> of the ${w.librarySize} in the libraries they came from, and they were picked because they were the tractable ones.</p>
  <div class="doors">
    <a class="door" href="/what-works/">What works — measured, denominator first <span class="door__arrow">→</span></a>
    <a class="door" href="${docUrl(LIMITS_REL)}">Known limitations — what it costs <span class="door__arrow">→</span></a>
  </div>
</section>

<section id="doors-again">
  <h2>Three doors in</h2>
  <div class="cards">
    <a class="card" href="/spec/"><h3>Read the Spec</h3><p>Every schema branch, with constraints, refusal rules, and real shipping contracts as examples.</p><span class="card__meta">generated from the schema</span></a>
    <a class="card" href="${PLAYGROUND_URL}"><h3>Try the Playground</h3><p>The <em>pre-pivot</em> <code>core/</code> engine in your browser: import from Figma or code, edit under governance, watch refusals by name. Not the recipe-IR v1 proof.</p><span class="card__meta">universal-contract loop · no accounts</span></a>
    <a class="card" href="/get-started/"><h3>Get started</h3><p>Organised by what you want to do: canvas into code, code into Figma, or both-already-exist reconciled. Real commands, and the structural limits stated up front.</p><span class="card__meta">commands rendered from the tested manifest</span></a>
  </div>
</section>
`;

  const html = layout(
    {
      path: "/",
      title:
        "Design System Contracts — an open specification for component contracts",
      description:
        "A design system's source of truth should be neither the design file nor the code — but a machine-readable contract that sits between them and generates both. An open, deterministic, receipted component-contract specification.",
    },
    body,
  );
  return { route: "/", html };
}
