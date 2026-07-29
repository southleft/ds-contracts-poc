/**
 * CLI reference — /cli/. Documents what IS: the usage block, the init config
 * template, and the computed-capture degradation message are extracted from
 * the shipping CLI sources (packages/cli/src/**) at build time, so this page
 * cannot drift from the binary npm serves. Curated prose around them explains
 * each verb's real flags — read from the command modules, reviewed by hand.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { layout, codeBlock, badge, REPO_URL } from '../html.js';

/** Slice a source region and refuse by name when the pattern stops matching. */
function slice(relPath: string, pattern: RegExp, label: string): string {
  const text = readFileSync(path.join(process.cwd(), relPath), 'utf8');
  const m = text.match(pattern);
  if (!m || m[1] === undefined) {
    throw new Error(`cli page: ${label} — ${relPath} no longer matches ${pattern}; update the extraction`);
  }
  return m[1];
}

/** Evaluate a sliced literal from trusted repo source (build time only). */
function evalLiteral<T>(literal: string, label: string): T {
  try {
    return new Function(`return (${literal});`)() as T;
  } catch (err) {
    throw new Error(`cli page: ${label} — sliced literal no longer evaluates: ${String(err)}`);
  }
}

export function cliPage(): { route: string; html: string } {
  const cliVersion = (
    JSON.parse(readFileSync(path.join(process.cwd(), 'packages/cli/package.json'), 'utf8')) as { version: string }
  ).version;

  // The usage block IS the reference (cli.ts says so itself) — render it verbatim.
  const usage = slice('packages/cli/src/cli.ts', /const USAGE = `([\s\S]*?)`;\n/, 'USAGE block').replace(
    '${VERSION}',
    cliVersion,
  );

  // The exact config `init` writes: the TEMPLATE literal, JSON-stringified the
  // same way initCommand does.
  const templateLiteral = slice(
    'packages/cli/src/commands/init.ts',
    /const TEMPLATE = (\{[\s\S]*?\n\}) as const;/,
    'init TEMPLATE',
  );
  const configJson = JSON.stringify(evalLiteral<Record<string, unknown>>(templateLiteral, 'init TEMPLATE'), null, 2);

  // The named degradation the lazy --computed seam prints (exit 3).
  const degradeLiteral = slice(
    'packages/cli/src/commands/extract.ts',
    /export const COMPUTED_DEGRADE_MESSAGE =\n?([\s\S]*?);\n/,
    'COMPUTED_DEGRADE_MESSAGE',
  );
  const degradeMessage = evalLiteral<string>(degradeLiteral, 'COMPUTED_DEGRADE_MESSAGE');

  const body = `
<p class="eyebrow">Reference</p>
<h1>The CLI — <code>@ds-contracts/cli</code></h1>
<p class="lede">Every verb is a thin shell over the same engine the reference repository runs — esbuild-bundled, zero required runtime dependencies, Node ≥ 20. Install it globally or run it with <code>npx</code>; the two journeys on <a href="/get-started/">Get started</a> are built from these verbs.</p>
${codeBlock(`npm i -g @ds-contracts/cli     # or: npx --yes @ds-contracts/cli@${cliVersion} <command>`, 'bash')}

<h2 id="usage">Usage ${badge('generated', 'Extracted verbatim from packages/cli/src/cli.ts at build time — the CLI names this block its own reference.')}</h2>
${codeBlock(usage.trimEnd(), 'text', `packages/cli/src/cli.ts — the shipping usage block, v${cliVersion}; extracted at build time`)}
<p class="section-note">The last line is the CLI's own honesty: <code>--help</code> on a verb shows nothing beyond this block — this page and that block are the reference.</p>

<h2 id="onboard">onboard — the whole code→canvas pipeline, in two phases</h2>
<p><code>ds-contracts onboard &lt;package-or-path&gt; [--components a,b,c] [--workspace &lt;dir&gt;]</code> then <code>ds-contracts onboard --continue [--channel-key K] [--from &lt;stage&gt;] [--dry-run] [--bridge &lt;url&gt;]</code>. Phase 1 detects the adapter and styling method, creates or reuses a pinned sandbox, seeds contracts from the static pass, drafts the capture config — and <strong>stops</strong>, printing what a human must decide and why each field matters. Phase 2 runs capture → promote → emit → bundle → publish without stopping, one progress line per stage, and ends with a summary naming what was produced <em>and what was refused</em>.</p>
<p><strong>The stop is the design.</strong> A drafted capture config carries a top-level <code>"__unreviewed-draft"</code> marker, and phase 2 refuses it <em>by name</em> before anything else runs — including when you resume a later stage with <code>--from bundle</code>. There is no <code>--yes</code> and no <code>--force</code> past it, because <code>classAllow</code>, <code>varPrefix</code> and the mount recipe do not <em>error</em> when they are wrong; they produce a confident wrong contract.</p>
<p>A directory that already carries a <code>ds-library.json</code> manifest is <strong>adopted</strong> rather than re-detected — which is also what a second <code>onboard</code> run on the same library does. Capture runs as <em>one sweep for the whole library</em> unless narrowed with <code>--components</code>: the runner's read-boundary frontier receipts are collected across a run, so a narrowed sweep and a full sweep produce different bytes for the same component. A component the capture <strong>quarantines</strong> ships no contract, drops out of the bundle, is named in the summary, and makes the exit status non-zero — a quarantine is a defect, not a waiver.</p>

<h2 id="promote">promote</h2>
<p><code>ds-contracts promote --config &lt;ds-library.json&gt; [--root &lt;dir&gt;]</code> — computed-capture artifacts → promoted contracts and a minted token tree: the source-alias pass (a minted leaf whose covering combos all name one token, value-verified twice, becomes a DTCG alias to it), provenance-anchor sidecars, a <code>figmaStatePreviews</code> probe against the real referee, and a resolution guard that refuses the whole promotion on a single dangling ref. This was six near-identical copies of a script under <code>examples/*/scripts/</code> until it became one module; four libraries reproduce their committed artifacts byte-for-byte through it, and two (polaris, astryx) keep their own scripts by name.</p>

<h2 id="init">init</h2>
<p><code>ds-contracts init [--detect] [--force]</code> — the first command anyone runs. Writes <code>ds-contracts.config.json</code> in the current directory (refuses if one exists; <code>--force</code> overwrites). One config drives every verb: the <code>code</code>/<code>design</code>/<code>tokens</code>/<code>idPrefix</code>/<code>out</code>/<code>diagnose</code> keys are the extraction/diagnose config the <code>extract</code> and <code>diff</code> verbs read, and <code>generate</code> holds code-generation defaults. Every path is relative to the file. This is the exact template <code>init</code> writes ${badge('generated', 'Evaluated from the TEMPLATE literal in packages/cli/src/commands/init.ts at build time.')}:</p>
${codeBlock(configJson, 'jsonc', 'ds-contracts.config.json as written by ds-contracts init — derived from the shipping source at build time')}
<ul>
<li><code>code.adapter</code> — <code>react-tsx</code> (scan <code>code.root</code> recursively) or <code>cem</code> (point <code>code.manifest</code> at a <code>custom-elements.json</code>).</li>
<li><code>tokens</code> — DTCG files used to referee <code>var(--x)</code> → token-path bindings during anatomy extraction; point at <em>your</em> token set, never a guessed hyphen→dot split.</li>
<li><code>design.source</code> — a plugin-dump JSON for the design side of <code>diff</code>/<code>extract --reconcile</code>; optional.</li>
<li><code>diagnose.contracts</code> — the directory of adopted contracts <code>diff</code> referees against (default <code>&lt;out&gt;/contracts</code>).</li>
</ul>
<p><code>--detect</code> prefills <code>code.adapter</code>, <code>code.root</code>, the token paths and a styling hint by reading your <code>package.json</code> and source tree. Every detected value is marked <em>detected, NOT confirmed</em> — it is a first guess to correct, not an answer. The styling hint is the one that decides your whole path: co-located CSS Modules means the static pass can extract anatomy directly; runtime or atomic styling means the static pass reads the API surface only and styling truth needs <code>extract --computed</code>.</p>

<h2 id="extract">extract</h2>
<p><code>ds-contracts extract [config] [--reconcile] [--draft-capture-config] [--accept-candidates exact|&lt;file&gt;]</code> — code → schema-valid <strong>proposed</strong> contracts, over the same code path as the reference repo's extraction. The config resolves positional → <code>--config</code> → <code>ds-contracts.config.json</code> in the cwd. Components the extractor sees but cannot extract are counted and named — never silently dropped.</p>
<p><strong>What you get depends on how your library is styled.</strong> The API surface — props, enum values, defaults, <code>on*</code> events — is always proposed. Anatomy (parts, layout, token bindings) is read from source only by the <code>react-tsx</code> adapter with a co-located <code>&lt;Component&gt;.module.css</code>, and even there it is best-effort; StyleX yields structure without styling; Tailwind, Emotion, styled-components and the <code>cem</code> adapter yield the stub <code>{"root": {}}</code>. Each proposal's description says which it is. A stub anatomy is schema-valid and <em>will</em> emit a canvas set — a correctly named component set with blank interiors — so read the descriptions before you bundle.</p>
<ul>
<li><code>--reconcile</code> — adds the configured design dump and produces the disagreement report: every property classified <em>agree</em> / <em>options-differ</em> / <em>code-only</em> / <em>design-only</em>. The brownfield starting point. Cannot be combined with the two flags below (they run on the code pass).</li>
<li><code>--draft-capture-config</code> — also writes a <strong>draft</strong> computed-capture config with a <code>"__review:*"</code> marker on every field static source cannot infer (<code>classAllow</code>, <code>varPrefix</code>, <code>mount</code>, <code>fixedProps</code>, <code>stateProps</code>), each with one line of guidance and no guessed value. The draft carries a top-level <code>"__unreviewed-draft"</code> key and <strong>the capture runner refuses any config still carrying it</strong> — draft is not approved.</li>
<li><code>--accept-candidates exact|&lt;file&gt;</code> — bulk raw-value → token acceptance over the unbound-value report. Only unique exact-value candidates are eligible, every acceptance is ledgered, and ambiguity is refused by name. On a large brownfield library this is the dominant day-one labor.</li>
</ul>
<h3 id="extract-computed">extract --computed — the one browser-dependent verb</h3>
<p><code>ds-contracts extract --computed --config &lt;capture.json&gt; [--harness &lt;dir&gt;] [--out &lt;dir&gt;] [--root &lt;dir&gt;] [--component &lt;name&gt;]</code> drives a real Chromium to capture computed styles. It is deliberately a <strong>lazy seam</strong>: the capture code lives in a separately bundled chunk imported only when the flag is passed, and <code>playwright-core</code> is an <em>optional</em> dependency — so the base install stays browser-free, and when the browser is absent the verb degrades with a named message and <strong>exit code 3</strong> instead of an unnamed module crash ${badge('generated', 'The message below is evaluated from the COMPUTED_DEGRADE_MESSAGE constant in packages/cli/src/commands/extract.ts at build time.')}:</p>
${codeBlock(degradeMessage, 'text', 'the named degradation, verbatim from the shipping source — every other verb keeps working without a browser')}

<h2 id="generate">generate</h2>
<p><code>ds-contracts generate &lt;contracts..&gt; --out &lt;dir&gt;</code> — contract → code. Positionals are <code>*.contract.json</code> files or directories; their union is both the generation set <em>and</em> the resolution scope for composition refs (a parent and its referenced children travel together).</p>
<div class="table-wrap"><table>
<thead><tr><th>Flag</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>--target react</code> (default)</td><td>the shipping generator — typed TSX + CSS Modules + per-component index + root barrel, prettier-formatted; with <code>--stories</code>, CSF3 Storybook stories. The exact code path the reference repo byte-guards with its golden manifest.</td></tr>
<tr><td><code>--target html | react-inline | figma-script | &lt;registered&gt;</code></td><td>any emitter in the open registry — files are written exactly as the emitter returns them. An unknown target is refused with the list of registered names.</td></tr>
<tr><td><code>--emitter &lt;module&gt;</code></td><td>dynamic-imports a plugin emitter module (path or bare npm specifier) and <code>registerEmitter()</code>s it <em>before</em> generation. The module exports an Emitter as <code>default</code>, <code>emitter</code>, or an <code>emitters</code> array — anything else is refused by name. See <a href="/emitters/">writing an emitter</a>.</td></tr>
<tr><td><code>--tokens f,f</code></td><td>comma-separated DTCG files, <strong>a directory</strong> (every <code>*.tokens.json</code> / <code>*.dtcg.json</code> inside it, recursive), or slot-named entries <code>slot=file</code>. Each file is <em>routed</em> to one of the five token slots — <code>primitives</code>, <code>semantic</code>, <code>light</code>, <code>dark</code>, <code>brand.&lt;name&gt;</code>. A flat foreign set with no slot named lands in <code>primitives</code> (the pattern the Polaris showcase established); the layered <code>*.tokens.json</code> convention routes itself. <strong>Two files that define the same token differently inside one slot are refused by name</strong> — the layer that would have been silently overwritten is the whole reason the flag knows about slots (a light tree merged over a dark one emits a dark component whose header says light).</td></tr>
<tr><td><code>--icons &lt;dir&gt;</code></td><td>SVG assets referenced by contract icon names.</td></tr>
<tr><td><code>--stories</code></td><td>emit Storybook stories (react target).</td></tr>
</tbody></table></div>

<h2 id="figma">figma</h2>
<p><code>ds-contracts figma &lt;contracts..&gt; --out &lt;dir&gt; [--tokens f,f] [--icons dir] [--file-key KEY]</code> — emits one Figma Plugin API sync script per contract (the same referee-gated emitter that built the reference repo's entire canvas library). <code>--file-key</code> pins the wrong-file guard: a script anchored to one file refuses to run in another.</p>
<h3 id="figma-bundle">figma bundle — the one file a user pastes</h3>
<p><code>ds-contracts figma bundle &lt;contracts..&gt; --out &lt;file&gt; --tokens &lt;base[,minted]&gt; [--modes &lt;light[,dark]&gt;] [--name &lt;collection&gt;] [--icons dir]</code> — packs contracts, a token set and any referenced icon assets into <strong>one self-contained CONTRACTS-BUNDLE JSON</strong>. This is the recommended artifact for a foreign library, and it is the answer to “what exactly does my designer paste?”: <strong>this file, and nothing else.</strong> There is no script step.</p>
<p>The bundle's optional <code>tokenSet</code> carries the library's own tokens — flat DTCG <code>base</code>, optional per-mode <code>modes.light</code>/<code>modes.dark</code>, and an optional nested <code>minted</code> tree whose <code>{alias}</code> leaves become Figma-native variable aliases. The plugin syncs it first as a named variable collection with Light/Dark modes, then builds every component set bound to it. Contracts resolve their token refs against <code>base</code> + <code>minted</code>; a ref outside both is <strong>refused by name</strong>, exactly like a repo contract referencing an unknown repo token. Icon assets referenced by contracts embed as SVG text and <code>--icons</code> is required when such refs exist. Deterministic: the same inputs produce identical bytes.</p>
<h3 id="figma-push">figma push</h3>
<p><code>ds-contracts figma push &lt;file&gt; --code &lt;CODE&gt; [--bridge &lt;url&gt;]</code> — sends a <strong>CONTRACTS-BUNDLE</strong> to the plugin bridge under a pairing code. A single contract document is wrapped into a one-contract bundle automatically; anything that is neither a contract (no <code>id</code>) nor a well-formed bundle envelope is refused. The code is the 6-character pairing code from &ldquo;Receive by code&rdquo;, folded into &ldquo;Other ways to receive&rdquo; in the plugin's <strong>Build</strong> tab — deliver-once, 15-minute TTL, and it carries no ordering, so an out-of-order paste gets no freshness warning (the standing channel's <code>seq</code> guard covers only <code>figma publish</code>). For the durable door see <code>figma claim-channel</code> / <code>figma publish</code>; the bridge is a dumb pipe that never inspects the payload beyond "is it JSON / is it a well-formed envelope". The bridge URL resolves <code>--bridge</code> → <code>DS_CONTRACTS_BRIDGE_URL</code> → the public default.</p>
<p><code>ds-contracts figma claim-channel [--bridge &lt;url&gt;]</code> — mints a <strong>standing CI↔Figma channel</strong>: a <em>write key</em> (a CI secret; it publishes) and a <em>read key</em> that is <code>sha256(writeKey)</code>. The read key is the half the designer pastes into the plugin's <strong>Changes</strong> tab, and it can never publish — so leaked plugin storage cannot inject into the source of truth. Write-with-read-key and read-with-write-key are both refused, and key <em>existence</em> 404s indistinguishably from a bad key (the shape is not a secret; existence is).</p>
<p><code>ds-contracts figma publish &lt;file&gt; [--channel-key K] [--bridge &lt;url&gt;] [--dry-run] [--repo o/n] [--run-id] [--commit] [--ref] [--run-url] [--no-provenance]</code> — publishes a CONTRACTS-BUNDLE to that channel. CI pushes whenever, the designer checks whenever, neither waits. GitHub Actions context auto-detects into a provenance <strong>sibling</strong> of the envelope — never inside the bundle bytes, so <code>figma bundle</code> stays byte-deterministic — and the plugin renders it above the change report. Publishes are last-write-wins with a monotonic <code>seq</code>; a delivery older than what the file last applied is <em>named</em> and every actionable row starts unchecked. Reads are non-consuming peeks; there is no timer, because a Figma plugin has no background execution — the plugin checks on open and on a button.</p>
<h3 id="figma-receive">figma receive — the dev door, the other direction</h3>
<p><code>ds-contracts figma receive --out &lt;contracts-dir&gt; [--bridge &lt;url&gt;] [--apply]</code> — the only verb that runs on the <em>developer's</em> machine to take something <em>out</em> of Figma. It prints a 6-character pairing code and waits; the designer types that code into “Send to repo” in the plugin's <strong>Send</strong> tab, and the proposed contract travels the bridge and lands as a reviewed local diff. <strong>It writes nothing without <code>--apply</code></strong> — the default is show-me-first. With <code>--apply</code> it also <strong>generates the component code that contract produces</strong>, from the <code>generate</code> section of <code>ds-contracts.config.json</code> — the same both-halves rule as <code>propose-pr</code>; with no target recorded it says so and writes no code rather than inventing a framework. Use it when the designer has no GitHub token and you do not want one issued.</p>

<p><strong>Named limits.</strong> Deliveries are <strong>not signed</strong>: anyone holding the write key can publish any provenance, so there is no "verified" badge. The read half of the channel — a headless drift recompute so CI can referee the canvas without a human clicking a tab — is not started. Key discipline matches <code>propose-pr</code>: <code>--channel-key</code> or <code>DS_CONTRACTS_CHANNEL_KEY</code>, in memory only, never persisted or logged, and <code>--dry-run</code> prints the plan and never a key.</p>

<h2 id="diff">diff</h2>
<p><code>ds-contracts diff [config]</code> — the parity referee over surfaces this CLI did <em>not</em> generate: contracts ⟷ code (react-tsx or cem adapter) and, when <code>design.source</code> is configured, contracts ⟷ design. One code path with the reference repo's own diagnose referee. The exit codes are the CI contract:</p>
<div class="table-wrap"><table>
<thead><tr><th>Exit</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td><code>0</code></td><td>clean — every checked surface matches the contracts</td></tr>
<tr><td><code>1</code></td><td>drift — findings named on stderr, report JSON written; fail the job</td></tr>
<tr><td><code>2</code></td><td>configuration or input error — fix the config, not the contracts</td></tr>
</tbody></table></div>
<p>This is the gate the <a href="${REPO_URL}/blob/main/examples/ci/design-led.yml">design-led CI recipe</a> runs after regeneration — a PR that would leave the surfaces disagreeing cannot merge. The <a href="/how-it-works/protocol/">protocol page</a> explains why the referee, not a person, holds this authority.</p>

<h2 id="propose-pr">propose-pr</h2>
<p><code>ds-contracts propose-pr &lt;file&gt; --repo owner/name [--token t] [--base b] [--path p] [--title t] [--target t] [--code-path d] [--tokens f,f] [--icons d] [--stories] [--no-code] [--dry-run]</code> — a contract change becomes a reviewable pull request <strong>carrying both halves: the contract AND the code it generates</strong>. <code>&lt;file&gt;</code> is a proposed contract document, a CONTRACT-PROPOSAL envelope straight out of the plugin's Send tab (the contract inside is unwrapped — committing the envelope would put a non-contract where a contract belongs), or a parity/diagnose diff report (JSON, committed verbatim, no code). The contract lands at <code>--path/&lt;basename&gt;</code> (default <code>contracts/</code>) on a fresh <code>ds-contracts/propose-…</code> branch, opened against <code>--base</code> (default: the repo's default branch, resolved live). Plain GitHub REST via <code>fetch</code> — no <code>gh</code> binary, no SDK.</p>
<p><strong>The code half.</strong> Until this landed, the PR contained a document nobody could run and a human had to know to go away and run <code>generate</code> — an invisible second hop. Now the registered emitters run here and their output is committed next to the contract. <strong>Targets are never guessed:</strong> <code>--target</code> wins; otherwise the <code>generate</code> section of <code>ds-contracts.config.json</code> decides (the block <code>init --detect</code> writes); with neither, the PR carries the contract alone <em>and the body says so</em>. A <code>--target</code> that cannot be honored is a refusal, not a degradation — a named flag with nowhere to write is an error, while a config-derived target degrades loudly and still proposes the contract. <code>--no-code</code> asks for the contract alone on purpose. The react root barrel is deliberately <em>not</em> in the PR: it lists every component in the library and a proposal knows one — the body says that too.</p>
<p><strong>The provenance sentence is printed, not assumed.</strong> A component set this tool generated carries a <code>ds_contracts/contractId</code> marker, so canvas → contract → code is a true round trip and re-running the emitters reproduces the component <strong>byte for byte</strong>. A hand-built set carries no marker: the contract is an <strong>inversion</strong> of what could be read off the canvas, so the emitted component is a <strong>starting point, not a reproduction</strong>. The plugin stamps which case it is into the CONTRACT-PROPOSAL envelope and the PR body prints the matching sentence; with no recorded provenance the body says exactly that instead of picking a side. Both ends read one module (<code>core/canvas-code-plan.ts</code>), so the plugin's preview and the PR cannot drift apart.</p>
<p><strong>Token discipline:</strong> the fine-grained token (contents:write + pull-requests:write on the target repo) comes from <code>--token</code>, else <code>DS_CONTRACTS_GITHUB_TOKEN</code>, else <code>GITHUB_TOKEN</code>. It lives in one local variable for the duration of the run and is never persisted, logged, or echoed. <code>--dry-run</code> prints the exact five REST steps the live run would take — no network calls, no token required — and that plan output is pinned by an eval.</p>

<h2 id="exit-codes">Exit codes, across the CLI</h2>
<div class="table-wrap"><table>
<thead><tr><th>Exit</th><th>When</th></tr></thead>
<tbody>
<tr><td><code>0</code></td><td>success (including <code>diff</code> clean and <code>propose-pr --dry-run</code>)</td></tr>
<tr><td><code>1</code></td><td>a named refusal (contract violations listed one per line), <code>diff</code> drift, or a runtime error</td></tr>
<tr><td><code>2</code></td><td>usage or configuration error — unknown command/flag, missing required flag, bad config (also: bare <code>ds-contracts</code> with no command)</td></tr>
<tr><td><code>3</code></td><td><code>extract --computed</code> only — the browser harness is unavailable; the named degradation above</td></tr>
</tbody></table></div>

<p class="receipt-line">The published package is smoke-tested by the eval suite (<code>cli-smoke</code>), and both journey walkthroughs execute these verbs end-to-end from <a href="${REPO_URL}/blob/main/evals/fixtures/journey-commands.json">the same manifest the docs render</a>. Source: <a href="${REPO_URL}/tree/main/packages/cli">packages/cli/</a>.</p>
`;
  const html = layout(
    {
      path: '/cli/',
      title: 'CLI reference — Design System Contracts',
      description:
        'Every ds-contracts verb with its real flags — init, extract (and the lazy --computed seam), generate, figma / figma push, diff exit codes, propose-pr token handling — extracted from the shipping CLI source at build time.',
    },
    body,
  );
  return { route: '/cli/', html };
}
