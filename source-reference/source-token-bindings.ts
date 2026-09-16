/** Source-named token observations, not token minting or Contract admission.
 * The authenticated host supplies both original evidence and exact DTCG bytes.
 * A digest checks consistency; it does not authenticate a new source or theme. */
import { createHash } from "node:crypto";
import { revisionOf } from "../core/contract-provenance.js";
import { flattenTokens, makeResolveLiteral } from "../core/tokens.js";
import { normalizeValue } from "../extract/computed/lib.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";
import {
  projectSourceBoundAnatomy,
  type SourceAnatomyIdentity,
  type SourceOwnedElement,
} from "./source-bound-anatomy.js";

export interface SourceTokenBindingsInput {
  source: SourceVisualContractInput;
  /** This bounded adapter qualifies the recorded Altitude dark/default input,
   * not an arbitrary mode selected by relabeling a file. Every captured root
   * --al-* value must also match its exact named leaf in these bytes. */
  tokens: { mode: "dark"; brand: "default"; json: string; sha256: string };
}
export interface SourceTokenCandidate {
  variableName: string;
  rawValue: string;
  selector: string;
  tokenPath?: string;
  capturedVariableValue?: string;
  tokenValue?: string;
  matches: boolean;
  problems: string[];
}
export interface SourceTokenOutcome extends SourceAnatomyIdentity {
  domPath: string;
  visualPath: string;
  channel: string;
  computedValue?: string;
  status: "bound" | "ambiguous" | "unresolved";
  candidates: SourceTokenCandidate[];
  binding?: {
    variableName: string;
    tokenPath: string;
    tokenValue: string;
    capturedVariableValue: string;
    computedValue: string;
    /** All matching same-name records survive; no winning selector is inferred. */
    selectors: string[];
  };
  problems: string[];
}
export interface SourceTokenCase {
  id: string;
  status: "observed" | "refused";
  sourceTreeSha256?: string;
  projectionTreeSha256?: string;
  topologyObservationSha256?: string;
  environment: {
    checked: number;
    mismatches: Array<{
      variableName: string;
      tokenPath: string;
      capturedValue: string;
      tokenValue?: string;
      problem: string;
    }>;
  };
  outcomes: SourceTokenOutcome[];
  unreferencedChannels: Array<
    SourceAnatomyIdentity & {
      domPath: string;
      visualPath: string;
      channels: string[];
    }
  >;
  excludedSampleIds: string[];
  problems: string[];
}
export interface SourceTokenBindings {
  version: 1;
  status: "source-bindings-observed" | "refused";
  acceptedContract: null;
  qualification: "recorded-source-names-and-values-only";
  sourceRevision: string;
  semanticsRevision: string;
  tokensSha256: string;
  mode: "dark";
  brand: "default";
  cases: SourceTokenCase[];
  problems: string[];
  limitations: string[];
}
const hash = /^[a-f0-9]{64}$/;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const own = (v: object, name: string) => Object.hasOwn(v, name);
const pathOf = (name: string): string | undefined =>
  /^--al-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ? name.slice(5) : undefined;
const identity = (element: SourceOwnedElement) => ({
  templateId: element.templateId,
  sourceNodeId: element.sourceNodeId,
  sourceSpan: { ...element.sourceSpan },
  domPath: element.domPath,
  visualPath: element.visualPath,
});
const refusedCase = (id: string): SourceTokenCase => ({
  id,
  status: "refused",
  environment: { checked: 0, mismatches: [] },
  outcomes: [],
  unreferencedChannels: [],
  excludedSampleIds: [],
  problems: [],
});
function fail(code: string): never {
  throw Error(`source-token-${code}`);
}

/** Bounded, lossless normalization. In particular alpha is not rounded to an
 * 8-bit color and relative units are not converted at an assumed 16px base. */
function rgba(value: string): number[] | undefined {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hex) {
    const expanded =
      hex[1].length <= 4 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4]
      .map((i) => parseInt(expanded.slice(i, i + 2), 16))
      .concat(
        expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1,
      );
  }
  if (v === "transparent") return [0, 0, 0, 0];
  const rgb =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/.exec(
      v,
    );
  if (!rgb) return;
  const values = [
    Number(rgb[1]),
    Number(rgb[2]),
    Number(rgb[3]),
    rgb[4] === undefined ? 1 : Number(rgb[4]),
  ];
  return values.every(Number.isFinite) &&
    values.slice(0, 3).every((n) => n <= 255) &&
    values[3] <= 1
    ? values
    : undefined;
}
function equivalent(
  tokenValue: string,
  computed: string,
  type: string,
): boolean {
  if (normalizeValue(tokenValue.trim()) === normalizeValue(computed.trim()))
    return true;
  if (type !== "color") return false;
  const a = rgba(tokenValue),
    b = rgba(computed);
  return !!a && !!b && a.every((n, index) => n === b[index]);
}

/** Re-derives source-owned topology before inspecting references. Only the
 * mechanical --al-X → X mapping is permitted. No scan for equal-valued tokens,
 * source class/name heuristic, sample-reference promotion or target write. */
export function resolveSourceTokenBindings(
  input: SourceTokenBindingsInput,
): SourceTokenBindings {
  const out: SourceTokenBindings = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "recorded-source-names-and-values-only",
    sourceRevision: "",
    semanticsRevision: "",
    tokensSha256: "",
    mode: "dark",
    brand: "default",
    cases: [],
    problems: [],
    limitations: [
      "The host authenticates original source, readiness, the fixed case manifest and DTCG bytes. Matching hashes are consistency checks, not source or theme authority.",
      "Bound means a unique recorded source variable name matches its exact DTCG leaf, captured variable and computed channel. It does not select a CSS cascade winner or prove authored-versus-UA subtraction.",
      "Source-owned elements retain styles measured with their samples. Assigned content and authored fallback references are excluded, not turned into main-component assets or default content.",
      "Missing references, shorthand/calc expressions, indirect references and relative-unit conversions remain unqualified. Equal values never supply an unrecorded name.",
      "No Contract is accepted or mutated. Native variable modes, runtime editable channels, new themes, interaction states and end-to-end conversion remain separate qualification work.",
    ],
  };
  try {
    const source = input?.source,
      semantics = source?.semantics;
    if (Array.isArray(semantics?.cases))
      out.cases = semantics.cases.map((c) =>
        refusedCase(typeof c?.id === "string" ? c.id : ""),
      );
    if (
      !object(input) ||
      !object(source) ||
      !object(semantics) ||
      semantics.version !== 1 ||
      semantics.status !== "semantic-candidate" ||
      semantics.acceptedContract !== null ||
      !Array.isArray(semantics.cases) ||
      !semantics.cases.length ||
      !Array.isArray(source.cases) ||
      !object(source.source) ||
      !object(semantics.source) ||
      typeof source.source.source !== "string" ||
      !hash.test(source.source.sourceSha256) ||
      sha(source.source.source) !== source.source.sourceSha256 ||
      source.source.sourceSha256 !== semantics.source.sourceSha256 ||
      source.source.className !== semantics.source.className ||
      !hash.test(semantics.source.programSha256) ||
      typeof semantics.source.revision !== "string" ||
      !semantics.source.revision
    )
      fail("source-input-invalid");
    out.sourceRevision = semantics.source.revision;
    out.semanticsRevision = revisionOf(semantics);
    const ids = semantics.cases.map((c) => c.id);
    if (
      ids.some((id) => typeof id !== "string" || !id) ||
      new Set(ids).size !== ids.length ||
      source.cases.some((c) => !object(c) || !ids.includes(c.expectedCaseId)) ||
      new Set(source.cases.map((c) => c.expectedCaseId)).size !==
        source.cases.length
    )
      fail("case-denominator-invalid");
    const tokens = input.tokens;
    if (!object(tokens) || tokens.mode !== "dark" || tokens.brand !== "default")
      fail("context-unsupported");
    if (
      typeof tokens.json !== "string" ||
      !hash.test(tokens.sha256) ||
      sha(tokens.json) !== tokens.sha256
    )
      fail("token-digest-mismatch");
    out.tokensSha256 = tokens.sha256;
    const tree: unknown = JSON.parse(tokens.json);
    if (!object(tree)) fail("dtcg-shape-invalid");
    // Altitude's generated DTCG has flat source names. Do not collapse arbitrary
    // nested/group paths into a hyphenated name that the source never recorded.
    for (const [name, leaf] of Object.entries(tree)) {
      if (name.startsWith("$")) continue;
      if (
        !pathOf(`--al-${name}`) ||
        !object(leaf) ||
        !own(leaf, "$value") ||
        typeof leaf.$type !== "string" ||
        !["color", "dimension", "number", "string"].includes(leaf.$type)
      )
        fail("dtcg-flat-leaf-unqualified");
    }
    const leaves = flattenTokens(tree);
    if (!leaves.size) fail("dtcg-empty");
    const resolve = makeResolveLiteral(leaves);
    const values = new Map<string, string>();
    for (const path of leaves.keys()) {
      let value: unknown;
      try {
        value = resolve(path);
      } catch {
        fail(`dtcg-alias-unresolved:${path}`);
      }
      if (
        (typeof value !== "string" && typeof value !== "number") ||
        (typeof value === "number" && !Number.isFinite(value))
      )
        fail(`dtcg-value-unqualified:${path}`);
      values.set(path, String(value).trim());
    }
    for (const [index, sourceCase] of semantics.cases.entries()) {
      const row = out.cases[index],
        raw = source.cases.find((c) => c.expectedCaseId === sourceCase.id);
      if (
        sourceCase.status !== "structure-matched" ||
        !Array.isArray(sourceCase.problems) ||
        sourceCase.problems.length ||
        !raw
      ) {
        row.problems.push(
          ...(Array.isArray(sourceCase.problems)
            ? sourceCase.problems
            : ["source-token-source-case-invalid"]),
        );
        if (!raw) row.problems.push("source-token-original-tree-unavailable");
        if (!row.problems.length)
          row.problems.push("source-token-source-case-refused");
        continue;
      }
      const projection = projectSourceBoundAnatomy({
        ...raw,
        source: source.source,
        sourceProgramSha256: semantics.source.programSha256,
        case: sourceCase,
      });
      if (
        projection.status !== "structural-projection" ||
        projection.problems.length ||
        !projection.root
      ) {
        row.problems.push(
          ...projection.problems,
          "source-token-projection-refused",
        );
        continue;
      }
      row.sourceTreeSha256 = projection.sourceTreeSha256;
      row.projectionTreeSha256 = projection.projectionTreeSha256;
      row.topologyObservationSha256 = projection.topologyObservationSha256;
      row.excludedSampleIds = projection.samples.map((sample) => sample.id);
      for (const [name, captured] of Object.entries(projection.root.style)
        .filter(([name]) => name.startsWith("--al-"))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        row.environment.checked++;
        const path = pathOf(name),
          value = path ? values.get(path) : undefined;
        if (!path || value === undefined || value !== captured.trim())
          row.environment.mismatches.push({
            variableName: name,
            tokenPath: path ?? "",
            capturedValue: captured,
            ...(value === undefined ? {} : { tokenValue: value }),
            problem:
              !path || value === undefined
                ? "source-token-environment-leaf-missing"
                : "source-token-environment-value-mismatch",
          });
      }
      if (!row.environment.checked || row.environment.mismatches.length) {
        row.problems.push("source-token-context-environment-mismatch");
        continue;
      }
      let malformedReferences = false;
      for (const element of projection.elements) {
        const { node } = element;
        if (
          (node.vrefs !== undefined && !object(node.vrefs)) ||
          (node.vshorthands !== undefined && !object(node.vshorthands)) ||
          (node.vcalcs !== undefined && !object(node.vcalcs))
        ) {
          malformedReferences = true;
          break;
        }
        const channels = [
          ...new Set([
            ...Object.keys(node.vrefs ?? {}),
            ...Object.keys(node.vshorthands ?? {}),
            ...Object.keys(node.vcalcs ?? {}),
          ]),
        ].sort();
        row.unreferencedChannels.push({
          ...identity(element),
          channels: Object.keys(node.style)
            .filter(
              (channel) =>
                !channel.startsWith("--") && !channels.includes(channel),
            )
            .sort(),
        });
        for (const channel of channels) {
          const computed = node.style[channel];
          const outcome: SourceTokenOutcome = {
            ...identity(element),
            channel,
            ...(computed === undefined ? {} : { computedValue: computed }),
            status: "unresolved",
            candidates: [],
            problems: [],
          };
          row.outcomes.push(outcome);
          const refs = node.vrefs?.[channel];
          if (refs !== undefined && !Array.isArray(refs)) {
            malformedReferences = true;
            break;
          }
          if (own(node.vshorthands ?? {}, channel))
            outcome.problems.push("source-token-shorthand-unqualified");
          if (own(node.vcalcs ?? {}, channel))
            outcome.problems.push("source-token-calc-unqualified");
          if (computed === undefined)
            outcome.problems.push("source-token-computed-channel-unavailable");
          for (const ref of refs ?? []) {
            if (
              !Array.isArray(ref) ||
              ![3, 4].includes(ref.length) ||
              !ref.slice(0, 3).every((v) => typeof v === "string") ||
              (ref.length === 4 && ref[3] !== 1)
            ) {
              malformedReferences = true;
              break;
            }
            const [name, rawValue, selector] = ref,
              path = pathOf(name);
            const candidate: SourceTokenCandidate = {
              variableName: name,
              rawValue,
              selector,
              ...(path ? { tokenPath: path } : {}),
              matches: false,
              problems: [],
            };
            outcome.candidates.push(candidate);
            if (ref.length === 4)
              candidate.problems.push(
                "source-token-indirect-reference-unqualified",
              );
            if (!selector)
              candidate.problems.push("source-token-selector-unavailable");
            const variable = own(node.style, name)
              ? node.style[name]
              : undefined;
            const token = path ? values.get(path) : undefined;
            if (!path || token === undefined)
              candidate.problems.push(
                "source-token-recorded-name-leaf-missing",
              );
            if (variable === undefined)
              candidate.problems.push(
                "source-token-captured-variable-unavailable",
              );
            else {
              candidate.capturedVariableValue = variable;
              if (rawValue.trim() !== variable.trim())
                candidate.problems.push(
                  "source-token-recorded-variable-value-mismatch",
                );
            }
            if (token !== undefined) {
              candidate.tokenValue = token;
              if (variable !== undefined && token !== variable.trim())
                candidate.problems.push(
                  "source-token-leaf-variable-value-mismatch",
                );
              if (
                computed !== undefined &&
                !equivalent(token, computed, leaves.get(path!)!.type)
              )
                candidate.problems.push(
                  /(?:^|\d)(?:rem|em|%)\b/.test(token)
                    ? "source-token-relative-unit-context-unqualified"
                    : "source-token-computed-value-mismatch",
                );
            }
            candidate.matches =
              !candidate.problems.length && !outcome.problems.length;
          }
          const matches = outcome.candidates.filter((c) => c.matches);
          const names = new Set(matches.map((c) => c.variableName));
          if (names.size > 1) {
            outcome.status = "ambiguous";
            outcome.problems.push("source-token-recorded-name-ambiguous");
          } else if (names.size === 1) {
            const match = matches[0];
            outcome.status = "bound";
            outcome.binding = {
              variableName: match.variableName,
              tokenPath: match.tokenPath!,
              tokenValue: match.tokenValue!,
              capturedVariableValue: match.capturedVariableValue!,
              computedValue: computed!,
              selectors: [...new Set(matches.map((c) => c.selector))].sort(),
            };
          } else if (!outcome.problems.length)
            outcome.problems.push("source-token-no-recorded-name-matches");
          if (malformedReferences) break;
        }
        if (malformedReferences) break;
      }
      if (malformedReferences) {
        row.outcomes = [];
        row.unreferencedChannels = [];
        row.problems.push("source-token-reference-shape-invalid");
      } else row.status = "observed";
    }
    if (out.cases.some((c) => c.status === "observed"))
      out.status = "source-bindings-observed";
  } catch (error) {
    out.problems.push(
      error instanceof Error ? error.message : "source-token-input-invalid",
    );
    // A global failure must never retain a partial positive from earlier rows.
    for (const row of out.cases) {
      row.status = "refused";
      row.outcomes = [];
      row.unreferencedChannels = [];
      row.problems.push("source-token-request-refused");
    }
  }
  return out;
}
