/** Scoped command reference. Product onboarding lives in USER-JOURNEYS.md. */
import { layout, codeBlock, PLAYGROUND_URL, REPO_URL } from "../html.js";
import { journeyStep, MANIFEST_REL } from "../journeys.js";

export function operatorGuidePage() {
  const generate = journeyStep("engineer", "generate-stories");
  const push = journeyStep("designer", "figma-push");
  const emit = journeyStep("designer", "figma-emit");
  const body = `
<p class="eyebrow">Technical reference</p>
<h1>Existing CLI and plugin workflows</h1>
<p class="lede">These are manually configured engine workflows with scoped coverage. Start with the <a href="/get-started/">user guide</a> for installation and the three intended application journeys. A command completing does not establish the full v1 conversion or repair criteria.</p>

<h2 id="a">Figma proposal to generated code</h2>
<ol class="steps">
<li><h3>Read the component set</h3><p>In the companion plugin's <strong>Send</strong> tab, select a set or use <strong>Scan this file</strong>, then choose <strong>Read the set &amp; diff</strong>. Supply a trusted base contract when one exists. An unfamiliar set produces a proposal; inspect its notes, unbound facts, child dependencies and token values before adopting it.</p></li>
<li><h3>Receive and review the proposal</h3>${codeBlock("ds-contracts figma receive --out contracts", "bash", "Receives a proposal artifact. Applying it requires an explicit --apply invocation and a configured generation target.")}<p>The plugin can also copy the proposal or prepare a repository change. Review the concrete files and target before sending. A native metadata marker alone does not authenticate a canonical contract.</p></li>
<li><h3>Generate from a reviewed contract</h3>${codeBlock(generate.command, "bash", generate.doc)}<p>The React emitter produces component files, styles and stories for supported contracts. This command fixture verifies generation; it does not qualify arbitrary design-only libraries, infer undeclared behavior or verify installation in a consumer.</p></li>
</ol>

<h2 id="b">Code source to Figma</h2>
<p>Static extraction can recover supported API and styling facts, but may produce incomplete anatomy. Original appearance needs a configured browser capture with the source library, states, tokens, styles and fonts available.</p>
${codeBlock("ds-contracts init --detect\nds-contracts extract --draft-capture-config", "bash", "Detect configuration and draft capture inputs. Review inferred values and unresolved fields before capture.")}
<p>The existing onboarding path provides a setup/review phase and a continuation phase:</p>
${codeBlock("ds-contracts onboard @acme/ui\n# Review the generated configuration before continuing.\nds-contracts onboard --continue", "bash", "Illustrative package name. Requires supported adapters and a reviewed capture configuration; not an arbitrary-library conversion guarantee.")}
<p>For manual delivery of an already prepared contract bundle:</p>
${codeBlock(push.command, "bash", push.doc)}
<p>The designer receives the bundle through the plugin's <strong>Build</strong> tab, reviews its scope and applies it. A live native comparison is still necessary to establish fidelity.</p>
<p>The lower-level emitter can produce a native writer program from a supported contract:</p>
${codeBlock(emit.command, "bash", emit.doc)}
<p>This is an engine operation. It is not the new source-validation app's integrated generation flow. See <a href="${REPO_URL}/blob/main/docs/21-bring-your-own-design-system.md">capture and onboarding reference</a> for configuration details and named limitations.</p>

<h2 id="c">Compare existing libraries</h2>
${codeBlock("ds-contracts diff", "bash", "Configured comparison: exit 0 clean, 1 drift, 2 configuration error.")}
<p>Use fresh observations and a trusted baseline. A comparison result is not authorization to overwrite either library, and the sync coordinator does not yet complete two-way repair. Identity mapping, initial agreement and ownership policy must be established first. Follow the <a href="/get-started/#both-libraries">existing-library journey</a>.</p>

<h2 id="adopt">Package and source setup</h2>
<p>Published CLI packages, the source checkout and hosted demos can be different revisions. Use an explicit package version appropriate to the workflow you are evaluating. For the current source application, follow <a href="/get-started/#install">local installation</a>; do not assume a global package install includes open-PR changes.</p>
<p>The <a href="/cli/">CLI reference</a> lists the command surface from the checked-out source. Configuration, token inputs and output targets remain explicit.</p>

<h2 id="plugin">Install the companion development plugin</h2>
<p>From a checkout, run <code>npm run plugin:zip</code>. In Figma desktop choose <strong>Plugins → Development → Import plugin from manifest</strong> and select <code>figma-sync/plugin-dist/manifest.json</code>. The source directory <code>figma-sync/plugin/</code> is not the built distribution.</p>
<p>A <a href="${PLAYGROUND_URL}/ds-contracts-sync-runner-plugin.zip">packaged plugin from the hosted playground</a> is another option, but its revision may differ from your checkout. Existing manual plugin operations and the new app's unfinished authenticated transport are separate capabilities.</p>

<h2 id="tested">What these command checks establish</h2>
<p>The three versioned command examples above come from <a href="${REPO_URL}/blob/main/${MANIFEST_REL}">${MANIFEST_REL}</a>, also consumed by the journey evals. The site build checks their exact command text. Other command shapes are checked against the CLI's usage surface. Those checks establish documented engine operations, not complete product readiness.</p>
<p><a href="/system/">Current status and milestone exits</a> · <a href="/get-started/">Return to the user guide</a></p>
`;
  return {
    route: "/operator-guide/",
    html: layout(
      {
        path: "/operator-guide/",
        title: "CLI and plugin workflows — Design System Contracts",
        description:
          "Scoped manual import, generation, comparison and plugin setup commands, with explicit product boundaries.",
      },
      body,
    ),
  };
}
