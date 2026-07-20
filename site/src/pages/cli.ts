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

<h2 id="init">init</h2>
<p>Writes <code>ds-contracts.config.json</code> in the current directory (refuses if one exists; <code>--force</code> overwrites). One config drives every verb: the <code>code</code>/<code>design</code>/<code>tokens</code>/<code>idPrefix</code>/<code>out</code>/<code>diagnose</code> keys are the extraction/diagnose config the <code>extract</code> and <code>diff</code> verbs read, and <code>generate</code> holds code-generation defaults. Every path is relative to the file. This is the exact template <code>init</code> writes ${badge('generated', 'Evaluated from the TEMPLATE literal in packages/cli/src/commands/init.ts at build time.')}:</p>
${codeBlock(configJson, 'jsonc', 'ds-contracts.config.json as written by ds-contracts init — derived from the shipping source at build time')}
<ul>
<li><code>code.adapter</code> — <code>react-tsx</code> (scan <code>code.root</code> recursively) or <code>cem</code> (point <code>code.manifest</code> at a <code>custom-elements.json</code>).</li>
<li><code>tokens</code> — DTCG files used to referee <code>var(--x)</code> → token-path bindings during anatomy extraction; point at <em>your</em> token set, never a guessed hyphen→dot split.</li>
<li><code>design.source</code> — a plugin-dump JSON for the design side of <code>diff</code>/<code>extract --reconcile</code>; optional.</li>
<li><code>diagnose.contracts</code> — the directory of adopted contracts <code>diff</code> referees against (default <code>&lt;out&gt;/contracts</code>).</li>
</ul>

<h2 id="extract">extract</h2>
<p><code>ds-contracts extract [config] [--reconcile]</code> — code → schema-valid <strong>proposed</strong> contracts (API, anatomy, token bindings), over the same code path as the reference repo's extraction. The config resolves positional → <code>--config</code> → <code>ds-contracts.config.json</code> in the cwd. <code>--reconcile</code> adds the design dump and produces the disagreement report. Components the extractor sees but cannot extract are counted and named — never silently dropped.</p>
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
<tr><td><code>--tokens f,f</code></td><td>comma-separated DTCG files, deep-merged. Your flat token set maps to the primitives collection — the same pattern the Polaris showcase established.</td></tr>
<tr><td><code>--icons &lt;dir&gt;</code></td><td>SVG assets referenced by contract icon names.</td></tr>
<tr><td><code>--stories</code></td><td>emit Storybook stories (react target).</td></tr>
</tbody></table></div>

<h2 id="figma">figma</h2>
<p><code>ds-contracts figma &lt;contracts..&gt; --out &lt;dir&gt; [--tokens f,f] [--icons dir] [--file-key KEY]</code> — emits one Figma Plugin API sync script per contract (the same referee-gated emitter that built the reference repo's entire canvas library). <code>--file-key</code> pins the wrong-file guard: a script anchored to one file refuses to run in another.</p>
<p><code>ds-contracts figma push &lt;file&gt; --code &lt;CODE&gt; [--bridge &lt;url&gt;]</code> — sends a <strong>CONTRACTS-BUNDLE</strong> to the plugin bridge under a pairing code. A single contract document is wrapped into a one-contract bundle automatically; anything that is neither a contract (no <code>id</code>) nor a well-formed bundle envelope is refused. The code is the 6-character pairing code from the plugin's Receive panel — deliver-once, 15-minute TTL; the bridge is a dumb pipe that never inspects the payload beyond "is it JSON / is it a well-formed envelope". The bridge URL resolves <code>--bridge</code> → <code>DS_CONTRACTS_BRIDGE_URL</code> → the public default.</p>

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
<p><code>ds-contracts propose-pr &lt;file&gt; --repo owner/name [--token t] [--base b] [--path p] [--title t] [--dry-run]</code> — a contract change becomes a reviewable pull request. <code>&lt;file&gt;</code> is a proposed contract document or a diff report (JSON); it is committed verbatim to <code>--path/&lt;basename&gt;</code> (default <code>contracts/</code>) on a fresh <code>ds-contracts/propose-…</code> branch and opened as a PR against <code>--base</code> (default: the repo's default branch, resolved live). Plain GitHub REST via <code>fetch</code> — no <code>gh</code> binary, no SDK.</p>
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
