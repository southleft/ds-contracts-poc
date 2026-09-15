import { createHash } from "node:crypto";
import type { Page } from "playwright-core";
import { captureJs, SHADOW_HELPERS_JS } from "../extract/computed/capture.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import type { SourceProfile } from "./check.js";
import { captureReference } from "./replay.js";
import { watchSourceFailures } from "./observe.js";

/** Use the production shadow/slot/pseudo/CSS-variable reader against the
 * ORIGINAL rendering. No mounting, reparenting, styles or role-map injection. */
export async function captureValidatedTree(
  page: Page,
  profile: SourceProfile,
  failures: ReturnType<typeof watchSourceFailures>,
  stageSelector: string,
  varPrefix: string,
) {
  const source = await captureReference(page, profile, failures);
  if (source.status !== "valid")
    return { status: "refused" as const, problems: source.problems };
  const identity = await page.evaluate(`(() => {
    ${SHADOW_HELPERS_JS}
    let scope = document, expected = null;
    for (const selector of ${JSON.stringify(profile.path)}) { expected = scope?.querySelector(selector); scope = expected?.shadowRoot; }
    const stage = document.querySelector(${JSON.stringify(stageSelector)});
    let ancestor = expected;
    while (ancestor && ancestor !== stage) ancestor = ancestor.parentElement || ancestor.getRootNode()?.host;
    return !!expected && !!stage && ancestor === stage;
  })()`);
  if (!identity)
    return {
      status: "refused" as const,
      problems: ["capture-root-does-not-match-validated-source"],
    };
  // The existing reader takes the complete browser longhand census, not a
  // hand-selected handful of source-witness properties.
  const channels = (await page.evaluate(
    `(() => { const channels = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = channels; return channels; })()`,
  )) as string[];
  const script = captureJs(stageSelector, undefined, varPrefix, profile.path);
  const tree = (await page.evaluate(script)) as CapturedNode | null;
  const repeat = (await page.evaluate(script)) as CapturedNode | null;
  const unchanged = await page.screenshot({ fullPage: true });
  const sha = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");
  const problems: string[] = [];
  if (!tree) problems.push("capture-tree-missing");
  if (JSON.stringify(tree) !== JSON.stringify(repeat))
    problems.push("capture-tree-not-stable");
  if (sha(unchanged) !== source.secondSha256)
    problems.push("capture-render-changed");
  if (failures.failedResources.length || failures.runtimeErrors.length)
    problems.push("capture-source-failed");
  if (problems.length || !tree) return { status: "refused" as const, problems };
  const boundary = (await page.evaluate(
    `(window.__DSC_SHEET_SKIPS || []).map(s => ({kind:s.kind, reason:'stylesheet-rules-unreadable'}))`,
  )) as { kind: string; reason: string }[];
  const census = {
    elements: 0,
    textRuns: 0,
    pseudoPlanes: 0,
    tokenCandidateChannels: 0,
  };
  const visit = (node: CapturedNode) => {
    census.elements++;
    census.pseudoPlanes += Object.keys(node.pseudo).length;
    census.tokenCandidateChannels += Object.keys(node.vrefs ?? {}).length;
    for (const child of node.nodes) {
      if (child.t === "el") visit(child.el);
      else if (child.v.trim()) census.textRuns++;
    }
  };
  visit(tree);
  return {
    status: "captured" as const,
    problems: [],
    tree,
    channels,
    census,
    boundary,
    treeSha256: sha(JSON.stringify(tree)),
    sourcePngSha256: source.secondSha256,
    scope:
      "Measured source tree for compilation, not a Figma result or behavioral qualification. CSS variable references are candidates, not verified bindings.",
  };
}
