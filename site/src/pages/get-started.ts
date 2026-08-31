/**
 * Get started — goal-first. A visitor arrives with one of three situations
 * ("there's a component on the canvas and I want code", "my components are in
 * code and I want them in Figma", "I already have both"), so the page is
 * organised by situation, not by persona or by machinery. The lettering is
 * canonical — docs/00-choose-your-path.md owns it: A = design-first,
 * B = code-first, C = reconcile.
 *
 * Every `npx @ds-contracts/cli` command line on this page is rendered from
 * evals/fixtures/journey-commands.json through site/src/journeys.ts — the same
 * file the journey evals execute — and the build refuses any hand-typed
 * command (see assertJourneyCommands in site/build.ts). Command lines written
 * as `ds-contracts …` (no npx prefix) are outside that guard by construction:
 * they are verb-shape illustrations verified against the shipping USAGE block
 * in packages/cli/src/cli.ts, which the /cli/ page renders verbatim.
 *
 * Package versions rendered as PUBLISHED are read from
 * scripts/registry-truth.json — the hand-maintained record of what is
 * actually on npm — never from the source tree's package.json files, whose
 * working-tree versions may never have been published (the build guard in
 * site/src/registry-truth.ts refuses the lie by name).
 */
import { layout, codeBlock, PLAYGROUND_URL, REPO_URL } from "../html.js";
import { journeyStep, MANIFEST_REL } from "../journeys.js";
import { whatWorksData, docUrl, LIMITS_REL } from "../what-works.js";
import { published } from "../registry-truth.js";

export function getStartedPage(): { route: string; html: string } {
  const cli = published("@ds-contracts/cli");
  const schema = published("@ds-contracts/schema");
  // The expectations section quotes the measured pair; both halves are read
  // from the generated report, never typed in here.
  const w = whatWorksData().n;
  const limits = docUrl(LIMITS_REL);

  const designerPush = journeyStep("designer", "figma-push");
  const designerEmit = journeyStep("designer", "figma-emit");
  const engineerGenerate = journeyStep("engineer", "generate-stories");

  const body = `
<p class="eyebrow">Get started</p>
<h1>What do you want to do?</h1>
<p class="lede">Three situations bring people here, and they are genuinely different amounts of work. Find yours, then read only that section. Everything runs on the published <code>@ds-contracts/cli</code> and the companion Figma plugin; the terminal commands below are <a href="#tested">executed by the eval suite from the same file this page renders</a>.</p>
<p class="section-note"><strong>Current state (2026-08-30).</strong> Paths A–C below are the universal-contract journeys. They still run. They are <strong>not</strong> the recipe-IR v1 proof (five live-minted, owner-signed archetypes; product v1 incomplete, F1 unmet). The playground linked from this site drives the same pre-pivot envelope. See <a href="${REPO_URL}/blob/main/docs/32-recipe-ir-pivot.md">docs/32</a>.</p>

<div class="table-wrap"><table>
<thead><tr><th></th><th>Your situation</th><th>Ends with</th></tr></thead>
<tbody>
<tr><td><strong><a href="#a">A</a></strong></td><td>“I have a component on the <strong>canvas</strong>. I want <strong>code</strong>.”</td><td>A typed React component, CSS Modules and Storybook stories, in your repo.</td></tr>
<tr><td><strong><a href="#b">B</a></strong></td><td>“I have components in <strong>code</strong>. I want them in <strong>Figma</strong>.”</td><td>A designer clicks <strong>Check for updates</strong> and your real components appear on their canvas, token-bound.</td></tr>
<tr><td><strong><a href="#c">C</a></strong></td><td>“I already have a mature Figma library <em>and</em> a mature codebase.”</td><td>A property-by-property disagreement report, and a CI gate that stops the gap growing.</td></tr>
</tbody></table></div>

<p>One rule spans all three: <strong>the surfaces never sync side-to-side.</strong> A designer's change and an engineer's change both travel <em>through the contract</em>, as a reviewable diff. Nothing writes to your repo without a pull request, and nothing writes to the canvas except an Apply a human clicked. That is <a href="/how-it-works/protocol/">the protocol</a>.</p>

<p class="receipt-line"><strong>Beta note.</strong> Of the three situations below, exactly ONE is supported end-to-end for the beta by a documented, receipted, clean-machine command list: <strong>B on the Flowbite lane</strong>. Read <a href="${REPO_URL}/blob/main/docs/BETA.md">docs/BETA.md</a> before you start. The other two are real and they run, but they are not what the beta promises. How a fact travels either way — verb by verb, with what each step refuses — is on <a href="/how-it-works/flow/">How it flows</a>.</p>

<h2 id="playground">First, the zero-install door</h2>
<p><a href="${PLAYGROUND_URL}">${PLAYGROUND_URL.replace("https://", "")}</a> runs the repository's actual engine in your browser — no backend, no accounts, no analytics; credentials are session-only and never leave the browser. Ten minutes there teaches the model faster than any page here.</p>
<p><strong>Try this first:</strong> open <em>Examples</em>, pick the Badge, and then break its contract on purpose — delete a required field, or point a token binding at a name that does not exist. The refusal appears on screen, named. That refusal is the product; everything else on this page is plumbing around it.</p>
<p>The playground also imports: a <strong>figma.com component URL</strong> (your token, with an honest degradation ladder when your plan gates the variables endpoint); a <strong>public GitHub file URL</strong> or pasted TSX + CSS Module; a pasted <strong>plugin dump</strong> (<code>extract/figma/dump.plugin.js</code>, in the JSON tab — native variable names on any plan); and your own DTCG tokens. One route is <em>off</em>, and the button says so: live relay from the plugin, whose <em>Send to Playground</em> tab was removed when its seven tabs were re-housed into Build / Changes / Send. Use the URL route or paste a dump instead.</p>

<hr>

<h2 id="a">A · “I have a component on the canvas; I want code”</h2>
<p class="lede">A designer has a component set in Figma; you want a real, typed React component in your repo. The generation half of this is fully deterministic — the same contract produces byte-identical output on any machine, with no model in the path.</p>

<ol class="steps">
<li><h3>Read the set</h3><p>In the plugin, open the <strong>Send</strong> tab. Select the set on canvas (or find it with <em>Scan this file</em>), leave the base-contract box empty if this tool did not build it, and click <strong>Read the set &amp; diff</strong>. The engine reads the live set and proposes a contract from what is actually drawn: variants become props, layers become anatomy, bound variables become token refs. With a base contract you get a <em>diff</em> (what changed); without one you get a <em>proposal</em> (what this set is).</p></li>

<li><h3>Get the contract into the repo — three doors, all reviewable, and the code comes with it</h3>
<p>The PR carries <strong>both halves: the contract AND the component it generates</strong>. It used to carry a document nobody could run, with an invisible second hop where a human had to know to go away and run <code>generate</code>. Which target it emits is never guessed — the plugin's <code>--target</code> wins, otherwise the <code>generate</code> section of <code>ds-contracts.config.json</code> decides; with neither recorded the change carries the contract alone <strong>and says so</strong>.</p>
<ul>
<li><strong>GitHub PR.</strong> Fill in <code>owner/repo</code> and a fine-grained token scoped to that one repo (session-only, never stored; closing the plugin forgets it). Leave <em>Dry run</em> ticked first to see the exact plan — every file, both diffs, the provenance sentence — and send nothing.</li>
<li><strong>Send to repo, no GitHub token.</strong> The developer runs <code>ds-contracts figma receive --out contracts</code>, which prints a 6-character code; the designer types it into the plugin. The proposal travels the pairing bridge and lands as a reviewed local diff — <strong>the CLI writes nothing without <code>--apply</code></strong>, and with <code>--apply</code> it writes the generated component alongside the contract from that same config.</li>
<li><strong>Copy the JSON out</strong> and commit it yourself, then run <code>generate</code> (next step).</li>
</ul></li>

<li><h3>Generate</h3>${codeBlock(engineerGenerate.command, "bash", engineerGenerate.doc)}<p>Typed React + CSS Modules + CSF3 Storybook stories, prettier-formatted — the same byte-guarded generator the reference repo ships. Styles are token names compiled to <code>var(--…)</code> custom properties; <a href="/how-it-works/styles/">how styles are applied</a> walks the whole chain. <code>--target</code> also accepts <code>html</code>, <code>react-inline</code>, <code>figma-script</code>, or any emitter you register with <code>--emitter</code>; an unknown target is refused with the list of registered names.</p></li>

<li><h3>Review in Storybook, beside the frame</h3><p>The emitted stories cover the default plus every enum value and boolean. Open them next to the Figma frame — you are reviewing two renderings of one contract, not a translation.</p></li>

<li><h3>CI holds the line</h3><p>On every PR that touches <code>contracts/</code>, the <a href="${REPO_URL}/blob/main/examples/ci/design-led.yml">design-led workflow</a> regenerates and then runs the referee: <code>ds-contracts diff</code> exits <code>0</code> clean · <code>1</code> drift (findings named) · <code>2</code> config error. A PR that would leave code and contracts disagreeing cannot merge. Full flag-by-flag detail: <a href="/cli/">the CLI reference</a>.</p></li>
</ol>

<h3 id="a-asymmetry">The honest asymmetry — and the change states which one it is</h3>
<p>For a set <strong>this tool generated</strong> — it carries a <code>ds_contracts/contractId</code> marker — journey A is a <strong>true round trip</strong>: re-running the emitters reproduces the component <strong>byte for byte</strong> from the contract in the PR, the proposal is measured against the contract that built it, and the reference repo's own components re-extract to zero mismatches in both directions, red-tested.</p>
<p>For a <strong>hand-built</strong> set — no marker — it is <strong>an inversion, not a reproduction</strong>. The proposal is what can be read off the canvas — real structure, real variants, real bound variables — but a canvas cannot tell you about a <code>useEffect</code>, a keyboard handler, or why a value is what it is. <strong>Treat the generated component as a strong, correct-by-construction starting point, not as your finished component</strong>, and review it as new code. That boundary is deliberate and permanent: see <a href="${REPO_URL}/blob/main/docs/16-sync-boundary.md">the sync boundary</a>.</p>
<p>You do not have to remember which case you are in. The plugin stamps the provenance into the proposal envelope and the PR body prints the matching sentence; when a contract arrives with no canvas provenance recorded, the body says <em>that</em> rather than picking a side. Both surfaces read one module, so the preview a designer sees and the sentence a reviewer reads cannot drift apart.</p>

<hr>

<h2 id="b">B · “I have components in code; I want them in Figma”</h2>
<p class="lede">Your real Button — its real padding, its real colors, its real variants — as a native Figma component set, built by a machine rather than redrawn by a person. <strong>No copy-paste, no manual redraw.</strong></p>

<h3 id="b-limit">Read this before you start: what you cannot do</h3>
<p><strong>You cannot point the Figma plugin at a GitHub URL or an npm package name and get components.</strong> This is structural, not a missing feature:</p>
<ul>
<li>To know what your component looks like, the tool has to <strong>run</strong> it in a real browser and read the computed styles. That is what makes the result true rather than guessed.</li>
<li>A Figma plugin is a sandboxed iframe. No Node, no npm, no bundler, no browser engine of its own. It cannot install your package and it cannot render it.</li>
</ul>
<p>So the browser step happens on a machine you control — your laptop or your CI — and what travels to Figma is a finished JSON bundle. Which is fine: it means the slow, fallible step is on the side that can debug it.</p>

<h3 id="b-static">The fast check: does your library even need the browser step?</h3>
<p>Static extraction (<code>ds-contracts extract</code>, no <code>--computed</code>) runs anywhere in seconds and always proposes schema-valid contracts carrying your <strong>API surface</strong> — props, enum values, defaults, events. Whether it <em>also</em> gives you anatomy — the parts, their layout, and which token paints each channel — depends on how your library is styled:</p>
<div class="table-wrap"><table>
<thead><tr><th>Your library</th><th>What static extraction produces</th></tr></thead>
<tbody>
<tr><td>React + co-located <code>&lt;Component&gt;.module.css</code></td><td><strong>API surface <em>and</em> anatomy</strong> — parts, token bindings, layout, states, read from the stylesheet. Best-effort, not guaranteed: a whole-library run against Polaris produced anatomy for 109 of 182 components; the rest came back as stubs.</td></tr>
<tr><td>React + StyleX</td><td>API surface and <strong>structure only</strong> — parts, no styling. Styling is flagged for review.</td></tr>
<tr><td>React + Tailwind, Emotion, styled-components, any runtime styling</td><td><strong>API surface only.</strong> Anatomy comes back as the stub <code>{"root": {}}</code>.</td></tr>
<tr><td>Web Components via a Custom Elements Manifest (<code>cem</code>)</td><td><strong>API surface only.</strong> A manifest has no styling channel.</td></tr>
</tbody></table></div>
<p>Each proposal says which one you got: <em>“API surface AND anatomy … read from source”</em> versus <em>“API surface only; anatomy, tokens, and design bindings await reconciliation and human review.”</em></p>
<p class="section-note"><strong>The quiet failure, named.</strong> A stub anatomy is schema-valid, so nothing refuses it — and the Figma emitter will build the set anyway. What lands on the canvas is a correctly <em>named</em> component with the right variant axes and <strong>blank frames inside</strong>: no fills, no padding, no bound variables. The tool is not lying; it is faithfully rendering a contract that says nothing about appearance. If your canvas sets come out empty, this is why, and the fix is the computed capture below.</p>

<h3 id="b-path">The path</h3>
<p><strong>One command, two phases.</strong> ${codeBlock(
    `npm i -g @ds-contracts/cli

ds-contracts onboard @acme/ui       # detect · sandbox · seed · draft · STOP
# …review the draft (step 3 below), then:
ds-contracts onboard --continue     # capture · promote · emit · bundle · publish`,
    "bash",
    'phase 1 does everything a machine can decide and stops at the one place a human must; phase 2 runs the rest without stopping and ends with the designer clicking "Check for updates" — no JSON on a clipboard',
  )}</p>
<p>Phase 2 re-checks the review gate <em>before anything else runs</em>, and there is no flag that skips it. The steps below are what those two commands run — worth reading, because they are what you are debugging when something goes wrong.</p>
<ol class="steps">
<li><h3>Point it at your repo</h3>${codeBlock(
    `npm i -g @ds-contracts/cli
ds-contracts init --detect`,
    "bash",
    'writes ds-contracts.config.json — --detect prefills adapter, root, tokens and styling hints from what it finds, marked "detected", never "confirmed"',
  )}<p><code>--detect</code> reads your <code>package.json</code> and your source tree, prints every prefill with the reason it chose that value, and writes them into a <code>"$detected"</code> block in the config. <strong>Confirm each value, then delete that block</strong> — the config is not yours until you have. A wrong <code>tokens</code> path is the one that bites: extraction binds <code>var(--x)</code> against a <em>real</em> token tree, so pointing it at a tree that does not exist means nothing binds.</p></li>

<li><h3>Read the source, and draft the capture config</h3>${codeBlock(`ds-contracts extract --draft-capture-config`, "bash", 'proposed contracts from your API surface + a DRAFT capture config marked with "__review:*" on every field the tool could not infer')}<p>The draft is machine-generated and deliberately incomplete. It marks the things static source cannot tell it — <code>classAllow</code>, <code>varPrefix</code>, <code>mount</code>, <code>fixedProps</code> — each with one line of guidance and no guessed value.</p></li>

<li><h3>Review the draft. This is the one irreducibly human step.</h3><p>Answer each <code>__review:*</code> field by reading your own library, delete the markers you have handled, then delete the top-level marker to approve it. Skip this and the next command refuses:</p>${codeBlock(
    `REFUSED: extract/computed/configs/acme.json is an UNREVIEWED DRAFT capture config
(top-level "__unreviewed-draft" marker). A draft never captures: review every
"__review:*" field (classAllow, varPrefix, mount, stateProps, fixedProps, …),
then delete the marker to approve it.`,
    "text",
    "the refusal, verbatim — draft is not approved",
  )}<p>The refusal exists because a wrong <code>classAllow</code> fails <em>silently</em>: you get a contract that looks perfectly fine and describes the wrong box. The tool would rather stop than hand you that.</p></li>

<li><h3>Capture — the browser step</h3>${codeBlock(
    `ds-contracts extract --computed --config extract/computed/configs/acme.json \\
  --harness examples/acme/.acme-sandbox --out extract/computed/out/acme`,
    "bash",
    "launches a real Chromium, mounts every enumerated prop combination, reads the browser’s computed styles",
  )}<p><code>--harness</code> is a directory with your library <em>actually installed</em> at a pinned version — the capture renders your package, it does not read your package's source. The sweep runs <strong>twice</strong> and refuses if the two runs disagree; that double-run check catches uncontrolled component state, random ids and animation sampling before any of it reaches a contract.</p><p>No browser on the machine? The verb degrades with a named message and exit code <code>3</code> rather than an unnamed module crash — and every other verb keeps working. The exact text is on <a href="/cli/#extract-computed">the CLI page</a>.</p></li>

<li><h3>Promote</h3>${codeBlock(`ds-contracts promote --config examples/acme/ds-library.json`, "bash", "computed-capture artifacts → promoted contracts + a minted token tree, driven by the per-library manifest")}<p>This <em>used to be</em> a script you copied and retargeted — six near-identical copies under <code>examples/*/scripts/</code>, which is why a fix in one of them stayed latent in the other five. It is now one module driven by a per-library <code>ds-library.json</code>, and the four libraries it took over reproduce their committed artifacts byte-for-byte. Two keep their own scripts by name: <strong>polaris</strong> (a different contract generation) and <strong>astryx</strong> (its re-anchoring ledger must be re-applied after the mint merge). <a href="${REPO_URL}/blob/main/docs/21-bring-your-own-design-system.md">docs/21 §2.6</a> walks it, including the refusals it prints (a state preview that would render identically to Default is refused by name, not worked around).</p></li>

<li><h3>Bundle: one JSON file, everything inside</h3>${codeBlock(
    `ds-contracts figma bundle examples/acme/contracts --out acme.bundle.json \\
  --tokens examples/acme/tokens/acme.dtcg.json,examples/acme/tokens/acme-minted.dtcg.json \\
  --modes light.json,dark.json --name Acme`,
    "bash",
    "contracts + your token set + referenced icons → one self-contained CONTRACTS-BUNDLE; same inputs produce identical bytes",
  )}<p>The bundle carries its own token set, so a foreign library never depends on the reference repo's tokens. The plugin syncs it as a named variable collection with Light/Dark modes and native variable aliases, then builds every component set bound to it. <strong>JSON is the only thing anyone pastes; there is no script step.</strong></p></li>

<li><h3>Deliver it — the durable way</h3>${codeBlock(
    `ds-contracts figma claim-channel     # once, ever
ds-contracts figma publish acme.bundle.json`,
    "bash",
    "claim-channel mints a write key (a CI secret) and a read key = sha256(write key) — the half the designer holds, which can never publish",
  )}<p>You keep the write key in CI; you send the designer the read key (it starts with <code>dscr_</code>) and they paste it once into the plugin's <strong>Changes</strong> tab. From then on CI publishes whenever and the plugin checks whenever — no codes to trade, nobody waiting. Deliveries carry a monotonic <code>seq</code>, so an out-of-order delivery is <em>named</em> and starts every Apply box unchecked, and GitHub Actions provenance (“repo — CI run #N, commit abc1234, published 4 minutes ago”) renders above the change report.</p><p class="section-note"><strong>Named limit:</strong> deliveries are not signed. Anyone holding the write key can publish any provenance, so there is no “verified” badge on a delivery. Stated rather than papered over.</p></li>

<li><h3>The designer reviews and applies</h3><p>In the plugin's <strong>Changes</strong> tab: <strong>Check for updates</strong> → a per-set report in plain words (“interior/style changes, no API change”) → tick the rows you want → <strong>Apply selected</strong>. Applying is <em>in place</em>: same node ids, same component keys, so instances placed around the file keep their component-property overrides (text, variant, boolean). New components land as new sets. Rows whose set has been edited on canvas warn that applying would overwrite that edit, and start unchecked.</p></li>
</ol>

<h3 id="b-other-doors">Two other ways to deliver the same bundle</h3>
<p><strong>Ad-hoc, both people online.</strong> The one-time 6-character pairing code, folded into “Other ways to receive” in the plugin's <strong>Build</strong> tab:</p>
${codeBlock(designerPush.command, "bash", designerPush.doc)}
<p>Deliver-once, 15-minute TTL, and you both have to be there in that minute. It carries no ordering, so it gets no freshness warning — a limit we state rather than paper over. Good for a one-off from a laptop; bad as a daily habit.</p>
<p><strong>No CLI at all.</strong> The bundle is plain JSON. Send it however you send files; the designer pastes it into the box on the plugin's <strong>Build</strong> tab and clicks <em>Generate in this file</em>. A designer with no repo access and no terminal can go end-to-end this way.</p>
<p><strong>First landing from a single contract.</strong> A contract can also be compiled directly to a Figma Plugin API sync script — the same emitter the reference repo built its entire canvas library with:</p>
${codeBlock(designerEmit.command, "bash", designerEmit.doc)}
<p class="section-note">This is the older, lower-level door. Prefer <code>figma bundle</code> unless you are debugging the emitter.</p>

<hr>

<h2 id="c">C · “I already have both”</h2>
<p class="lede">Brownfield: a mature Figma library your team drew by hand, a mature codebase, and no shared account of how far apart they are. Start diagnostic. Do not generate anything yet.</p>
<ol class="steps">
<li><h3>Look at the Figma side</h3><p>The plugin's <strong>Send → Scan this file</strong> does a read-only pass over every local component set — <em>including ones this tool never made</em> — and reports what is there and which sets could come under contract. Nothing is changed. Any set can then be proposed as a contract with no base contract at all.</p></li>
<li><h3>Get the disagreement report</h3>${codeBlock(`ds-contracts extract --reconcile`, "bash", "code-side contracts vs a Figma dump — every property classified agree / options-differ / code-only / design-only")}<p>This is the artifact that ends the “which one is right” argument, because it is per-property and mechanical rather than a judgement call.</p></li>
<li><h3>Then hold the line</h3>${codeBlock(`ds-contracts diff`, "bash", "the standing referee — exit 0 clean · 1 drift (findings named) · 2 config error")}<p>Wire it into CI and the gap stops growing while you close it. This is the referee running over surfaces the CLI did <em>not</em> generate.</p></li>
</ol>
<p class="section-note"><strong>Not supported yet, stated plainly:</strong> <em>adopting</em> an existing set — stamping a hand-built Figma component as contract-backed so future syncs amend it in place — is not a verb this tool has. Coexistence inside a foreign enterprise kit is proven, and in-place amend of a set <em>this tool created</em> inside that kit is proven forensically; amending a hand-built set is not. Plan on the hand-built set being <em>read</em> and a new contract-backed set being <em>built</em>, not on the old one being upgraded.</p>

<hr>

<h2 id="expect">What can I expect?</h2>
<p>Two numbers pull in opposite directions, both are true, and neither is publishable without the other. The measured answers live on <a href="/what-works/">What works</a> (what it does) and in <a href="${limits}">Known Limitations</a> (what it costs).</p>
<p><strong>Fidelity per captured component is high — ${w.meanEqual}% mean.</strong> What lands on the canvas is the browser's own computed truth for your real component: not an approximation, not a screenshot, not a guess. Measured against the original npm package rendering in the same pinned Chromium, as an exact string match with no tolerance, ${w.measured} components across ${w.libraries} libraries score <strong>${w.meanEqual}% mean computed-style equality</strong> (${w.cellWeighted}% cell-weighted over ${w.cells} cells; ${w.over90} at ≥90%, ${w.over80} at ≥80%). <a href="/what-works/#worst-first">All ${w.measured} are listed worst-first</a>, none omitted.</p>
<p><strong>Coverage per library is partial — and it is ${w.coverage}.</strong> A first pass will not be your whole library. Each foreign-library round in the reference repo committed a dozen or so components out of a library of one to two hundred: about 4% to 12% per library on the contracts-committed denominator, and <strong>${w.measured} of ${w.librarySize} = ${w.coverage}</strong> on the stricter measured-scorecard one. Read the fidelity number above as “on the easy ${w.coverage}” — that is why <a href="/what-works/#denominator">the denominator is printed first</a>. Budget hours per library for the recon and the config; the capture itself is machine time. The size denominators come from <a href="${REPO_URL}/blob/main/docs/22-generality.md">docs/22 §8.3</a>.</p>
<p>Beyond that, four properties you can rely on:</p>
<ul>
<li><strong>It refuses rather than guesses.</strong> A token ref outside the inventory, an illegal contract, an unreviewed draft config, a state preview that would render identically to Default — each stops with a message naming the thing. A plausible substituted value is treated as worse than a crash.</li>
<li><strong>Everything it cannot carry, it names.</strong> Every extraction writes a <code>*.extension.json</code> sidecar listing each captured fact the vocabulary refuses, with the reason. Nothing is dropped on the floor.</li>
<li><strong>Re-running is always safe.</strong> Same input, same bytes; applying an update preserves node ids, component keys and instance overrides.</li>
<li><strong>The known gaps are written down, not discovered.</strong> Three you will meet soon: <strong>overlay components</strong> (Dialog, Menu, Tooltip) have no hover/focus/active planes in the captured truth, so those contracts declare <code>states: []</code> by design; <strong>text wrapping is not implemented</strong>, so a hugging text node inside a narrower fixed-width ancestor clips; <strong>the capture harness loads no webfonts</strong>, so absolute text widths are fallback-font widths. The complete inventory is <a href="${limits}">docs/23 — Known Limitations</a>, whose counterpart is <a href="/what-works/">What works</a>; the evidence behind the generality claim and where it leaks is <a href="${REPO_URL}/blob/main/docs/22-generality.md">docs/22 §8</a>.</li>
</ul>

<h2 id="tested">These commands are tested, literally</h2>
<p class="receipt-line">Every <code>npx @ds-contracts/cli</code> command line above is rendered from <a href="${REPO_URL}/blob/main/${MANIFEST_REL}"><code>${MANIFEST_REL}</code></a> — the same manifest the <code>journey-engineer</code> and <code>journey-designer</code> evals <em>execute</em> end-to-end against the CLI build. The site build fails on any hand-typed command, and both evals refuse if the manifest drifts from what actually runs. Documented commands and tested commands cannot diverge. The remaining verb-shape lines (written <code>ds-contracts …</code>) are checked against the shipping usage block, which <a href="/cli/#usage">the CLI page</a> renders verbatim from source at build time. The CI recipes are held to the same bar: every <code>run:</code> step in <a href="${REPO_URL}/tree/main/examples/ci">examples/ci/</a> has been executed verbatim against the published CLI (<a href="${REPO_URL}/blob/main/examples/ci/VALIDATION.md">VALIDATION.md</a>).</p>

<h2 id="adopt">The packages</h2>
<p>Everything above is published and MIT-licensed: <code>@ds-contracts/cli@${cli.latest}</code> — published stable; the release candidate on the <code>next</code> tag is <code>${cli.next}</code> — (the whole engine, esbuild-bundled, zero required runtime dependencies) and <code>@ds-contracts/schema@${schema.latest}</code> — published stable, <code>${schema.next}</code> on <code>next</code> — (the contract schema, its generated JSON Schema, and the <code>validateContract</code> referee). These versions are read from the repo's registry-truth manifest — the record of what is actually on npm — never from the source tree's <code>package.json</code>, which may carry a newer, not-yet-published candidate. Point the extraction at what you already have — proposals only, nothing overwritten:</p>
${codeBlock(
  `npm i -g @ds-contracts/cli
ds-contracts init --detect   # writes ds-contracts.config.json — confirm code.root and tokens
ds-contracts extract         # your components → schema-valid PROPOSED contracts
ds-contracts diff            # the continuous referee: contracts vs code (and design, when configured)`,
  "bash",
)}
<p>Adapters ship for <code>react-tsx</code> (function components, forwardRef/memo, any props-type convention, cva variants, defaults, <code>on*</code> events, CSS Modules anatomy) and <code>cem</code> — any library publishing a Custom Elements Manifest. Every inference ships with a note, and nothing is invented. Want another output surface? <a href="/emitters/">Write an emitter</a> — <code>@ds-contracts/emitter-web-components</code> is the worked example.</p>
<p>If you just want the <em>contract format</em>: point your editor's <code>$schema</code> at the published JSON Schema — <code>@ds-contracts/schema/contract.schema.json</code> — and read <a href="/spec/">the reference</a>, which is generated from the same source. Running the full reference machinery (evals, instruments, the census) still means cloning <a href="${REPO_URL}">the repository</a>: <code>npm install &amp;&amp; npm run build &amp;&amp; npm run eval</code>.</p>

<h2 id="plugin">Installing the Figma plugin</h2>
<p>The plugin is <strong>not on the Figma Community</strong>, and that is a decision rather than a pending task. Distribution is the manifest-upload developer-plugin path, with two routes to the manifest: <strong>no clone</strong> — download the packaged zip the playground serves at <a href="${PLAYGROUND_URL}/ds-contracts-sync-runner-plugin.zip">/ds-contracts-sync-runner-plugin.zip</a>, unzip it, and import the <code>manifest.json</code> inside; or <strong>from a clone</strong> — <code>npm run plugin:zip</code> refreshes <code>figma-sync/plugin-dist/</code> and you import <code>figma-sync/plugin-dist/manifest.json</code>. Either way, in Figma desktop use <strong>Plugins → Development → Import plugin from manifest…</strong>. Never import from <code>figma-sync/plugin/</code>, which is a stub with no engine. The consequence, stated as a property: someone imports the manifest once per file owner — only the clone route requires repo access.</p>
`;
  const html = layout(
    {
      path: "/get-started/",
      title: "Get started — Design System Contracts",
      description:
        "Three situations, three paths: a canvas component into code, code components into Figma, or a brownfield pair reconciled. Real commands, the structural limits stated up front, and every CLI line rendered from the manifest the evals execute.",
    },
    body,
  );
  return { route: "/get-started/", html };
}
