/**
 * Get started — the two journeys, first-person. Every `npx @ds-contracts/cli`
 * command line on this page is rendered from evals/fixtures/journey-commands.json
 * through site/src/journeys.ts — the same file the journey evals execute — and
 * the build refuses any hand-typed command (see assertJourneyCommands in
 * site/build.ts). Package versions are read from the packages' package.json
 * files at build time, never transcribed.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { layout, codeBlock, PLAYGROUND_URL, REPO_URL } from '../html.js';
import { journeyStep, MANIFEST_REL } from '../journeys.js';

function pkgVersion(rel: string): string {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), rel), 'utf8')) as { version?: string };
  if (!pkg.version) throw new Error(`${rel}: no version field`);
  return pkg.version;
}

export function getStartedPage(): { route: string; html: string } {
  const cliVersion = pkgVersion('packages/cli/package.json');
  const schemaVersion = pkgVersion('packages/schema/package.json');

  const designerPush = journeyStep('designer', 'figma-push');
  const designerEmit = journeyStep('designer', 'figma-emit');
  const engineerGenerate = journeyStep('engineer', 'generate-stories');

  const body = `
<p class="eyebrow">Get started</p>
<h1>Two journeys, one contract</h1>
<p class="lede">The contract carries the sync so neither side has to. Pick the seat you're actually in — a designer whose team treats code as truth, or an engineer whose team treats Figma as truth — and walk the loop that serves it. Both journeys run on the published CLI and are <a href="#tested">executed by the eval suite from the same file this page renders</a>.</p>

<h2 id="playground">First, the zero-install door</h2>
<p><a href="${PLAYGROUND_URL}">${PLAYGROUND_URL.replace('https://', '')}</a> runs the repository's actual engine in your browser — no backend, no accounts, no analytics; credentials are session-only and never leave the browser. Import a component from a figma.com URL, from the <strong>companion Figma plugin</strong> (a one-time pairing code relays a full-fidelity dump — token names <em>and</em> resolved values, on any plan), or from a public GitHub file URL; edit the proposed contract under governance with refusals named on screen; share it as a ~1&nbsp;KB permalink. Ten minutes there teaches the model faster than any page here.</p>

<h2 id="designer">Journey 1 · "I'm a designer on a code-led team"</h2>
<p>Code is the truth in your organization, and today that means your library is an aging picture of it. In this loop <strong>you never touch a terminal</strong> — CI and a colleague's push do the machinery; you review and decide in Figma.</p>
<ol class="steps">
<li><h3>CI keeps the contracts current</h3><p>The <a href="${REPO_URL}/blob/main/examples/ci/code-led.yml">code-led workflow</a> runs the published CLI's <code>extract</code> on every push to main: components → schema-valid contracts, committed to <code>contracts/</code> in the repo (contracts-in-git are the canon), plus a <strong>CONTRACTS-BUNDLE</strong> artifact — the exact envelope the plugin bridge carries. Skipped components are counted in the job summary, never silently dropped.</p></li>
<li><h3>The bundle comes to you</h3><p>Open the plugin's <strong>Update library</strong> tab and click <strong>Receive by code</strong> — it shows a one-time 6-character pairing code. A colleague (or a CI operator) delivers the artifact to it:</p>${codeBlock(designerPush.command, 'bash', `${designerPush.doc}`)}<p>The pairing code is minted where you're looking, deliver-once, 15-minute TTL — no account linking, no standing webhook into your file.</p></li>
<li><h3>Your library amends in place</h3><p><strong>Check against this file</strong> diffs every received contract against the components already on your canvas — by identity marker, not by name — then <strong>Apply selected</strong> reconciles them <em>in place</em>: same node ids, same component keys, instance overrides preserved. New components land as new sets. (The first-ever landing can also be compiled directly from a contract as a Plugin&nbsp;API sync script:</p>${codeBlock(designerEmit.command, 'bash', designerEmit.doc)}<p class="section-note">— that is the same emitter the reference repo built its entire canvas library with.)</p></li>
<li><h3>You change something? It becomes a PR</h3><p>Edit the component on canvas the way you always have, then open the plugin's <strong>Propose</strong> tab: it reads the live set, diffs it against the contract, and opens the difference as a <strong>pull request</strong> — a proposed contract change, reviewable by your engineers like any code change (your fine-grained GitHub token, session-only, never stored; a dry-run sends nothing).</p></li>
<li><h3>The PR is the review</h3><p>Merging the proposal is the adoption decision. The <a href="${REPO_URL}/blob/main/examples/ci/design-led.yml">design-led workflow</a> regenerates the code from the changed contracts, gates on <code>ds-contracts diff</code>, and posts story screenshots on the PR — both sides see the same change before it lands. No side edits the other side directly, ever: that is <a href="/how-it-works/protocol/">the protocol</a>.</p></li>
</ol>

<h2 id="engineer">Journey 2 · "I'm an engineer on a design-led team"</h2>
<p>Figma is the truth in your organization, and today that means hand-translating frames into components and hoping. In this loop <strong>you never open Figma</strong> — the design reaches you as a contract, and everything downstream is deterministic.</p>
<ol class="steps">
<li><h3>The design arrives as a contract</h3><p>The designer sends the component set through the plugin (or the playground's Figma-URL import); the engine proposes a full contract — API, anatomy, token bindings, with the captured token layer and every minted <code>imported.*</code> provisional token named. It reaches your repo as a file in <code>contracts/</code>, usually via a PR (the plugin's Propose tab or <code>ds-contracts propose-pr</code>).</p></li>
<li><h3>Generate straight into the repo</h3>${codeBlock(engineerGenerate.command, 'bash', engineerGenerate.doc)}<p>Typed React + CSS Modules + CSF3 Storybook stories, prettier-formatted — the same byte-guarded generator the reference repo ships. Styles are token names compiled to <code>var(--…)</code> custom properties; <a href="/how-it-works/styles/">how styles are applied</a> walks the whole chain.</p></li>
<li><h3>Review in Storybook, beside the frame</h3><p>The emitted stories cover the default plus every enum value and boolean. Open them next to the Figma frame — you are reviewing two renderings of one contract, not a translation.</p></li>
<li><h3>CI holds the line</h3><p>On every PR that touches <code>contracts/</code>, the <a href="${REPO_URL}/blob/main/examples/ci/design-led.yml">design-led workflow</a> regenerates and then runs the referee: <code>ds-contracts diff</code> exits <code>0</code> clean · <code>1</code> drift (findings named) · <code>2</code> config error. A PR that would leave code and contracts disagreeing cannot merge. Full flag-by-flag detail: <a href="/cli/">the CLI reference</a>.</p></li>
</ol>

<h2 id="tested">These commands are tested, literally</h2>
<p class="receipt-line">Every <code>npx @ds-contracts/cli</code> command line above is rendered from <a href="${REPO_URL}/blob/main/${MANIFEST_REL}"><code>${MANIFEST_REL}</code></a> — the same manifest the <code>journey-engineer</code> and <code>journey-designer</code> evals <em>execute</em> end-to-end against the CLI build. The site build fails on any hand-typed command, and both evals refuse if the manifest drifts from what actually runs. Documented commands and tested commands cannot diverge. The CI recipes are held to the same bar: every <code>run:</code> step in <a href="${REPO_URL}/tree/main/examples/ci">examples/ci/</a> has been executed verbatim against the published CLI (<a href="${REPO_URL}/blob/main/examples/ci/VALIDATION.md">VALIDATION.md</a>).</p>

<h2 id="adopt">Adopt it in your own library</h2>
<p>Everything above is published and MIT-licensed: <code>@ds-contracts/cli@${cliVersion}</code> (the whole engine, esbuild-bundled, zero required runtime dependencies) and <code>@ds-contracts/schema@${schemaVersion}</code> (the contract schema, its generated JSON Schema, and the <code>validateContract</code> referee). Point the extraction at what you already have — proposals only, nothing overwritten:</p>
${codeBlock(`npm i -g @ds-contracts/cli
ds-contracts init       # writes ds-contracts.config.json — point code.root at your components
ds-contracts extract    # your components → schema-valid PROPOSED contracts
ds-contracts diff       # the continuous referee: contracts vs code (and design, when configured)`, 'bash')}
<p>Adapters ship for <code>react-tsx</code> (function components, forwardRef/memo, any props-type convention, cva variants, defaults, <code>on*</code> events, CSS Modules anatomy) and <code>cem</code> — any library publishing a Custom Elements Manifest. Extraction reads the API surface only; it will not guess your anatomy or tokens, and every inference ships with a note. Want another output surface? <a href="/emitters/">Write an emitter</a> — <code>@ds-contracts/emitter-web-components</code> is the worked example.</p>
<p>If you just want the <em>contract format</em>: point your editor's <code>$schema</code> at the published JSON Schema — <code>@ds-contracts/schema/contract.schema.json</code> — and read <a href="/spec/">the reference</a>, which is generated from the same source. Running the full reference machinery (evals, instruments, the census) still means cloning <a href="${REPO_URL}">the repository</a>: <code>npm install &amp;&amp; npm run build &amp;&amp; npm run eval</code>.</p>
`;
  const html = layout(
    {
      path: '/get-started/',
      title: 'Get started — Design System Contracts',
      description:
        'Two first-person journeys on the published CLI — a designer on a code-led team, an engineer on a design-led team — plus the zero-install playground. Every command rendered from the manifest the evals execute.',
    },
    body,
  );
  return { route: '/get-started/', html };
}
