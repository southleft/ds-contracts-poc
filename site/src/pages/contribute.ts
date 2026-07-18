/**
 * Contribute — the community surface: the RFC convention (rendered from
 * site/governance/ at build time so the site and the repo cannot disagree),
 * the claims rule, code of conduct pointer, and the license statement.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { layout, codeBlock, REPO_URL } from '../html.js';

export function contributePage(): { route: string; html: string } {
  // Render the committed governance template so the page cannot drift from
  // the file contributors actually copy.
  const templateMd = readFileSync(path.join(process.cwd(), 'site/governance/TEMPLATE.md'), 'utf8');
  const templateHtml = marked.parse(templateMd, { async: false }) as string;

  const body = `
<p class="eyebrow">Contribute</p>
<h1>An open spec, governed in the open</h1>
<p class="lede">100% open source and community-supported: the schema, the engine, and every instrument that verifies them are in one repository under one permissive license, with no gated tier. Here is how changes happen.</p>

<h2 id="claims-rule">The claims rule</h2>
<p>The repository's credibility rests on one norm above all others: <strong>no capability claim without an eval behind it</strong>. A statement of capability does not enter the docs until an adversarial check backs it in the eval suite. If you're adding a capability: <em>fixture first, eval second, claim last.</em> Every change must leave the gates green:</p>
${codeBlock(`npm run build     # tokens → schema → all components, contract-validated
npm run parity    # three-way differ: code, canvas, tokens vs contracts
npm run eval      # the full deterministic suite
npx tsc --noEmit  # src, scripts, extract, parity, evals`, 'bash', 'CONTRIBUTING.md — the gates')}

<h2 id="rfc">Proposing a schema change — the RFC convention</h2>
<p>The schema grows by demonstrated need. A proposal starts from a <strong>field case</strong> — a real component in a real system that cannot be expressed honestly today — and must state its projection on <em>all four emitters</em>, its refusal rules, and its receipts plan before any code lands. Proposals live as numbered files under <a href="${REPO_URL}/tree/main/site/governance"><code>site/governance/</code></a>; rejected proposals are kept, with reasons — a rejected proposal is a receipt too.</p>
<p>The site itself enforces the documentation step: the <a href="/spec/#coverage">coverage guard</a> fails the build when the schema grows a branch this reference doesn't document, so an accepted RFC cannot ship undocumented.</p>
<p class="section-note">No RFCs predate this convention. The schema's v2–v13 history was built before it existed and is documented as history — in <a href="${REPO_URL}/blob/main/MILESTONES.md">MILESTONES.md</a> and the <a href="/spec/versioning/">versioning page</a> — not retro-fitted into RFC files.</p>

<h3>The template</h3>
<p>Copy <a href="${REPO_URL}/blob/main/site/governance/TEMPLATE.md"><code>site/governance/TEMPLATE.md</code></a> — rendered below from the committed file:</p>
<div class="card" style="padding:24px" id="rfc-template">${templateHtml}</div>

<h2 id="other-ways">Other ways to contribute</h2>
<ul>
<li><strong>Skepticism.</strong> Genuinely welcome — start with <a href="${REPO_URL}/blob/main/docs/14-questions-and-objections.md">Questions &amp; Objections</a>, where every hard question is asked the skeptic's way and answered with receipts. An unanswered hard question is an issue worth opening.</li>
<li><strong>Field cases.</strong> Run the extraction against your own library (<a href="/get-started/#adopt">get started · path 3</a>) and report what the pipeline couldn't carry. Named degradations from real systems are how the schema has grown every round so far.</li>
<li><strong>A second implementation.</strong> The roadmap's endgame is an implementation this repo's authors didn't write passing a conformance kit. If you're building one — in any language, against any design tool — open an issue early; the conformance kit is being shaped by exactly this conversation.</li>
</ul>

<h2 id="conduct">Code of conduct</h2>
<p>Contributions are governed by the repository's <a href="${REPO_URL}/blob/main/CONTRIBUTING.md">contribution norms</a>. The project follows the spirit of the <a href="https://www.contributor-covenant.org/version/2/1/code_of_conduct/">Contributor Covenant v2.1</a>: be direct about the work, decent to the people. Report conduct issues via GitHub issues or privately to the maintainers.</p>

<h2 id="license">License</h2>
<p><a href="${REPO_URL}/blob/main/LICENSE">MIT</a> — the schema, the reference implementation, the extraction adapters, the eval suite, the playground, and this site. Fully open, no gated tier, no "open core." A spec the community can't fully use isn't a spec.</p>
`;
  const html = layout(
    {
      path: '/contribute/',
      title: 'Contribute — Design System Contracts',
      description: 'How to propose schema changes (the RFC convention), the claims rule — fixture first, eval second, claim last — code of conduct, and the MIT license statement.',
    },
    body,
  );
  return { route: '/contribute/', html };
}
