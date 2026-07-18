/**
 * Get started — three short paths, honest about what is packaged today vs
 * planned. The plugin-bridge steps mirror the playground's own in-product
 * instructions (playground/src/pages/Playground.tsx).
 */
import { layout, codeBlock, PLAYGROUND_URL, REPO_URL } from '../html.js';

export function getStartedPage(): { route: string; html: string } {
  const body = `
<p class="eyebrow">Get started</p>
<h1>Three ways in</h1>
<p class="lede">Try the loop in a browser, point it at one of your own components, or run the whole machinery locally. Each path is short — and each says exactly what you get.</p>

<h2 id="playground">1 · Try the playground — zero install</h2>
<p><a href="${PLAYGROUND_URL}">${PLAYGROUND_URL.replace('https://', '')}</a> runs the repository's actual engine in your browser — no backend, no accounts, no analytics; credentials are session-only and never leave the browser.</p>
<ul>
<li>a gallery of live-emitted examples from the shipping contracts</li>
<li>a governed contract editor — schema violations and generator refusals shown on screen, by name</li>
<li>import from a figma.com URL, from the companion plugin, or from a public GitHub file URL</li>
<li>paste your own DTCG tokens and watch every consumer rebind to them</li>
<li>describe a component in a sentence and let an AI (your key) propose a contract the schema can refuse</li>
<li>share any contract as a ~1&nbsp;KB permalink</li>
</ul>

<h2 id="import">2 · Import your own component — the plugin bridge</h2>
<p>The companion Figma plugin relays a full-fidelity dump of your live selection into the playground — token <em>names and</em> resolved values, on any Figma plan. It is read-only in your file and never sends your Figma token; the bridge holds a dump for at most 15 minutes and deletes it the moment your tab picks it up.</p>
<ol class="steps">
<li><h3>Get the plugin</h3><p>In the playground's <strong>Figma</strong> tab, download the plugin zip and unzip it.</p></li>
<li><h3>Load it in Figma desktop</h3><p>Open your file in the Figma <strong>desktop app</strong> (development plugins only load there — any plan works, no admin approval), then <strong>Plugins → Development → Import plugin from manifest…</strong> and pick <code>manifest.json</code>.</p></li>
<li><h3>Pair</h3><p>In the playground, choose <strong>Receive from plugin</strong> to mint a one-time pairing code; in Figma, run <strong>DS Contracts Sync Runner</strong>, open its <strong>Send to Playground</strong> tab, and enter the code.</p></li>
<li><h3>Select and send</h3><p>Select a component set on the canvas and send it. The engine proposes a full contract — API, anatomy, token bindings — with every inference named in its notes.</p></li>
<li><h3>Read the receipts</h3><p>Unbound values arrive with nearest-token candidates; anything the capture read but the schema can't carry is a named degradation, never a silent loss. Edit the proposal under governance and export it, or share it as a permalink.</p></li>
</ol>
<p class="section-note">No plugin handy? A figma.com URL import works too (your token, session-only) — with an honest degradation ladder when your plan gates the variables endpoint. Code-side, paste a public GitHub file URL and the co-located stylesheet is auto-discovered.</p>

<h2 id="adopt">3 · Adopt the schema in your project</h2>
<p><strong>What exists today, honestly stated:</strong> the schema, the engine, and the extraction adapters live in <a href="${REPO_URL}">the repository</a> and are MIT-licensed — but <strong>no npm package is published yet</strong>. The repo has a package build (<code>npm run build:lib</code> emits a typed <code>dist/</code>, smoke-tested by <code>npm run verify:package</code>) and the engine is proven browser-safe (<code>npm run core:browser-check</code>); publishing it is a roadmap item, not a shipped fact. Today, adoption means cloning:</p>
${codeBlock(`git clone ${REPO_URL}.git && cd ds-contracts-poc
npm install
npm run build      # tokens → schema → all components, validated against the contracts
npm run eval       # the full deterministic suite — see the numbers yourself`, 'bash')}
<p>Then point the extraction at your own library — proposals only, nothing overwritten:</p>
${codeBlock(`// extract.config.json (repo root)
{
  "code": { "adapter": "react-tsx", "root": "../your-repo/src/components" },
  "idPrefix": "acme",
  "out": "extract/out"
}`, 'jsonc')}
${codeBlock(`npm run extract:code   # your components → schema-valid PROPOSED contracts
npm run reconcile      # the disagreement report: where your code and design libraries diverge
npm run diagnose       # the continuous referee — checks surfaces against contracts, generates nothing`, 'bash')}
<p>Adapters ship for <code>react-tsx</code> (function components, forwardRef/memo, any props-type convention, cva variants, defaults, <code>on*</code> events, CSS Modules anatomy) and <code>cem</code> — any library publishing a Custom Elements Manifest. Extraction reads the API surface only; it will not guess your anatomy or tokens, and every inference ships with a note. Full walkthrough: <a href="${REPO_URL}/blob/main/docs/13-try-it-with-your-system.md">docs/13 — Try It With Your Own System</a>.</p>
<p>If you just want the <em>contract format</em>: the JSON Schema is emitted at <code>contracts/contract.schema.json</code> (point your editor's <code>$schema</code> at it), and <a href="/spec/">this site's reference</a> is generated from the same source. A versioned, standalone schema artifact is part of the spec-hardening roadmap phase.</p>
`;
  const html = layout(
    {
      path: '/get-started/',
      title: 'Get started — Design System Contracts',
      description: 'Three short paths: try the playground, import your own component through the plugin bridge, or clone the repo and run the schema against your own library.',
    },
    body,
  );
  return { route: '/get-started/', html };
}
