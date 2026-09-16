import {
  referenceIdentitySchema,
  semanticReplayMatches,
  type LifecycleIdentityPolicy,
} from "./lifecycle-identity.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  CemDeclarationFacts,
  CemProblem,
} from "../extract/adapters/cem.js";
import {
  checkSource,
  type SourceObservation,
  type SourceProfile,
} from "./check.js";
import {
  assessSemantics,
  semanticHash,
  type AssignedContent,
  type SemanticObservation,
} from "./semantics.js";

/** Exact recorded UTF-8 bytes, not JSON reserialized by the caller. A digest
 * establishes integrity, not authenticity or current-source freshness. */
export interface HashBoundJson {
  utf8: string;
  sha256: string;
}
export interface ContractPlanInput {
  component: Pick<CemDeclarationFacts, "modulePath" | "className" | "tagName">;
  /** Caller verifies these against the run's sourceHashes and actual manifest
   * bytes BEFORE passing facts from readCemDeclarations. No filesystem reads,
   * source checkout validation, or parent/supplement authorization occurs here. */
  source: { revision: string; manifestPath: string; manifestSha256: string };
  declaration: CemDeclarationFacts;
  /** Derived by the host from hash-verified source, never from the receipt. */
  identityPolicy?: LifecycleIdentityPolicy;
  declarationProblems: CemProblem[];
  observations: Array<{
    story: string;
    measurement: HashBoundJson;
    sourceSemantics: HashBoundJson;
    replaySemantics: HashBoundJson;
    sourceTree: HashBoundJson;
    replayTree: HashBoundJson;
    sourcePng: Uint8Array;
    replayPng: Uint8Array;
  }>;
}
export interface ContractPlanFinding {
  code: string;
  channel:
    | "evidence"
    | "identity"
    | "variants"
    | "content"
    | "attributes"
    | "behavior"
    | "tokens"
    | "coverage";
  message: string;
  story?: string;
  property?: string;
  slot?: string;
}
export type EnumState = { kind: "omitted" } | { kind: "value"; value: string };
export interface EnumDomain {
  property: string;
  rawType: string;
  defaultDeclaration?: string;
  omission: boolean;
  states: Array<EnumState & { stories: string[] }>;
  observed: number;
  total: number;
  missing: EnumState[];
}
export interface SourceContractPlan {
  version: 1;
  status: "blocked";
  acceptedContract: null;
  component: ContractPlanInput["component"];
  source: ContractPlanInput["source"];
  declaration: CemDeclarationFacts;
  evidence: { observedStories: string[]; rejectedStories: string[] };
  propertyStates: Array<{
    story: string;
    properties: SemanticObservation["properties"];
    attributes: Record<string, string>;
  }>;
  enumDomains: EnumDomain[];
  slots: Array<{
    name: string;
    observations: Array<{
      story: string;
      path: string;
      assigned: AssignedContent[];
      fallback: AssignedContent[];
    }>;
  }>;
  /** Native properties and ARIA attributes are independent observations. This
   * collection NEVER certifies that a public property drives either channel. */
  nativeStates: Array<{
    story: string;
    path: string;
    tag: string;
    native: SemanticObservation["nativeElements"][number]["properties"];
    aria: Record<string, string>;
  }>;
  findings: ContractPlanFinding[];
  limitations: string[];
}

const digest = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const strings = z.record(z.string(), z.string());
const scalar = z.union([
  z
    .object({
      kind: z.literal("value"),
      value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["undefined", "missing", "non-scalar", "unreadable"]),
    })
    .strict(),
]);
const scalars = z.record(z.string(), scalar);
const assigned: z.ZodType<AssignedContent> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal("text"), text: z.string() }).strict(),
    z
      .object({
        kind: z.literal("element"),
        tag: z.string().min(1),
        attributes: strings,
        properties: scalars,
        children: z.array(assigned),
        shadow: z.array(assigned).optional(),
      })
      .strict(),
  ]),
);
const observation = z
  .object({
    referenceIdentity: referenceIdentitySchema.optional(),
    problems: z.array(z.string()),
    hostTag: z.string().min(1),
    hostCount: z.number().int().nonnegative(),
    shadowRoot: z.boolean(),
    attributes: strings,
    properties: scalars,
    slots: z.array(
      z
        .object({
          name: z.string(),
          path: z.string(),
          assigned: z.array(assigned),
          fallback: z.array(assigned),
        })
        .strict(),
    ),
    nativeElements: z.array(
      z
        .object({
          path: z.string(),
          tag: z.string().min(1),
          attributes: strings,
          properties: scalars,
        })
        .strict(),
    ),
  })
  .strict();
const named = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    typeText: z.string().optional(),
    default: z.string().optional(),
  })
  .strict();
const declarationSchema = z
  .object({
    modulePath: z.string().min(1),
    className: z.string().min(1),
    tagName: z.string().min(1),
    description: z.string().optional(),
    attributes: z.array(named.extend({ fieldName: z.string().optional() })),
    properties: z.array(
      named.extend({
        attribute: z.string().optional(),
        readonly: z.boolean().optional(),
      }),
    ),
    slots: z.array(named),
    events: z.array(named),
    cssParts: z.array(named),
    cssProperties: z.array(named),
  })
  .strict();
const profileSchema = z.object({
  id: z.string(),
  provenance: z.string(),
  path: z.array(z.string()),
  fontPath: z.array(z.string()).optional(),
  fontFamily: z.string(),
  requiredStyles: strings,
  requiredTokens: strings,
  probes: z
    .record(
      z.string(),
      z.object({
        path: z.array(z.string()),
        styles: strings.optional(),
        properties: z
          .record(
            z.string(),
            z.union([z.string(), z.number().finite(), z.boolean()]),
          )
          .optional(),
      }),
    )
    .optional(),
});
const sourceObservation = z.object({
  found: z.boolean(),
  visible: z.boolean(),
  width: z.number().finite(),
  height: z.number().finite(),
  text: z.string(),
  styles: strings,
  tokens: strings,
  fontsReady: z.boolean(),
  platformFonts: z.array(
    z.object({ familyName: z.string(), glyphCount: z.number().finite() }),
  ),
  failedResources: z.array(z.string()),
  runtimeErrors: z.array(z.string()),
  probes: z
    .record(
      z.string(),
      z.object({
        found: z.boolean(),
        visible: z.boolean(),
        styles: strings,
        properties: z.record(
          z.string(),
          z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
        ),
      }),
    )
    .optional(),
});
const reference = z.object({
  status: z.literal("valid"),
  problems: z.array(z.string()),
  sha256: sha,
  observation: sourceObservation,
});
const measured = z.object({
  story: z.string(),
  qualified: z.literal(true),
  // A recorded capture failure overrides successful fields. Extra metadata
  // may survive this schema, but an error must never become observed coverage.
  error: z.never().optional(),
  profile: profileSchema,
  source: reference,
  replay: reference.extend({ matchesSource: z.literal(true) }),
  compilerInput: z.object({
    status: z.literal("verified-capture"),
    problems: z.array(z.string()),
    treeSha256: sha,
  }),
  semanticIntake: z.object({
    status: z.literal("observed"),
    problems: z.array(z.string()),
    manifestSha256: sha,
    tagName: z.string(),
    declaration: declarationSchema,
    observation,
    observationSha256: sha,
    declarationSha256: sha,
  }),
});
const intake = z.object({
  status: z.literal("observed"),
  problems: z.array(z.string()),
  declaration: declarationSchema,
  observation,
  observationSha256: sha,
  declarationSha256: sha,
  sourceTreeSha256: sha,
  sourcePngSha256: sha,
});
const treeRecord = z.object({
  status: z.literal("captured"),
  problems: z.array(z.string()),
  tree: z.record(z.string(), z.unknown()),
  treeSha256: sha,
  sourcePngSha256: sha,
});
const jsonSchema = z.object({ utf8: z.string(), sha256: sha });

function bound<T>(
  record: HashBoundJson,
  schema: z.ZodType<T>,
  label: string,
): T {
  if (
    !jsonSchema.safeParse(record).success ||
    digest(record.utf8) !== record.sha256
  )
    throw new Error(`artifact-hash-mismatch:${label}`);
  let value: unknown;
  try {
    value = JSON.parse(record.utf8);
  } catch {
    throw new Error(`artifact-json-invalid:${label}`);
  }
  if (!schema.safeParse(value).success)
    throw new Error(`artifact-shape-invalid:${label}`);
  // Keep original object order/fields for canonical semanticHash comparisons;
  // schema parsing must not silently remove data prior to hash validation.
  return value as T;
}
function requireEvidence(ok: boolean, code: string): asserts ok {
  if (!ok) throw new Error(code);
}
function jsonEqual(a: unknown, b: unknown) {
  return semanticHash(a) === semanticHash(b);
}

/** A bounded admission work order, NEVER an accepted Contract. Passing recorded
 * witnesses is sufficient for observed state coverage only. It cannot establish
 * causal bindings, arbitrary behavior, token semantics, or target equivalence. */
export function planSourceContract(
  input: ContractPlanInput,
): SourceContractPlan {
  const findings: ContractPlanFinding[] = [];
  const report: SourceContractPlan = {
    version: 1,
    status: "blocked",
    acceptedContract: null,
    component: input.component,
    source: input.source,
    declaration: input.declaration,
    evidence: { observedStories: [], rejectedStories: [] },
    propertyStates: [],
    enumDomains: [],
    slots: [],
    nativeStates: [],
    findings,
    limitations: [
      "Recorded-byte integrity and stored readiness are rechecked; this is not a fresh capture, authenticated provenance, dependency rebuild, or current-source qualification. The caller verifies source revision, manifest bytes and parent/supplement identity.",
      "Coverage is per declared enum axis, not the Cartesian product of props, states, themes, viewports or consumer content. Missing defaults remain absent; omission is not a fabricated public enum value.",
      "Bounded getter/mutation checks do not prove arbitrary getters pure. Closed nested shadow roots and unrecorded interactions remain unknown.",
      "No accepted semantic contract, automatic bindings, Figma output, behavior approval, owner grade or release qualification is produced.",
    ],
  };
  const add = (
    code: string,
    channel: ContractPlanFinding["channel"],
    message: string,
    rest: Partial<ContractPlanFinding> = {},
  ) => findings.push({ code, channel, message, ...rest });
  const declarationValid = declarationSchema.safeParse(
    input.declaration,
  ).success;
  const identityValid =
    z
      .object({
        modulePath: z.string().min(1),
        className: z.string().min(1),
        tagName: z.string().min(1),
      })
      .safeParse(input.component).success &&
    z
      .object({
        revision: z.string().regex(/^[a-f0-9]{40}$/),
        manifestPath: z.string().min(1),
        manifestSha256: sha,
      })
      .safeParse(input.source).success;
  if (
    !declarationValid ||
    !identityValid ||
    !Array.isArray(input.declarationProblems) ||
    input.declarationProblems.length ||
    !["modulePath", "className", "tagName"].every(
      (key) =>
        input.declaration[key as keyof CemDeclarationFacts] ===
        input.component[key as keyof typeof input.component],
    )
  ) {
    add(
      "declaration-evidence-invalid",
      "identity",
      "Exact, unambiguous reader facts and pinned source identity are required.",
    );
    report.evidence.rejectedStories = input.observations.map(
      (row) => row.story,
    );
    return report;
  }
  for (const field of [
    "properties",
    "attributes",
    "slots",
    "events",
    "cssParts",
    "cssProperties",
  ] as const) {
    const names = input.declaration[field].map((item) => item.name);
    if (new Set(names).size !== names.length)
      add(
        "declaration-identity-ambiguous",
        "identity",
        `Duplicate ${field} identity.`,
      );
  }
  const declaration = input.declaration;
  for (const property of declaration.properties) {
    const members = property.typeText
      ?.split("|")
      .map((member) => member.trim());
    if (
      members?.length &&
      members.every((member) => /^(['"])[^'"\\]*\1$/.test(member))
    ) {
      const values = members.map((member) => member.slice(1, -1));
      if (new Set(values).size !== values.length) {
        add(
          "enum-domain-ambiguous",
          "variants",
          "Duplicate declared enum members.",
          { property: property.name },
        );
        continue;
      }
      const omission = property.default === undefined;
      const states: EnumDomain["states"] = [
        ...(omission
          ? [{ kind: "omitted" as const, stories: [] as string[] }]
          : []),
        ...values.map((value) => ({
          kind: "value" as const,
          value,
          stories: [] as string[],
        })),
      ];
      report.enumDomains.push({
        property: property.name,
        rawType: property.typeText!,
        ...(omission ? {} : { defaultDeclaration: property.default }),
        omission,
        states,
        observed: 0,
        total: states.length,
        missing: [],
      });
      if (!omission && !members.includes(property.default!.trim()))
        add(
          "default-expression-unproven",
          "variants",
          "Raw default expression is preserved, not evaluated.",
          { property: property.name },
        );
    } else
      add(
        "property-domain-unproven",
        "coverage",
        "This property is not a finite string-literal enum; its full input/state domain is not qualified.",
        { property: property.name },
      );
    add(
      "property-binding-unproven",
      "attributes",
      "The declared public property is retained; observations do not prove its target part, transformation or interaction semantics.",
      { property: property.name },
    );
  }
  for (const attribute of declaration.attributes)
    add(
      "attribute-binding-unproven",
      "attributes",
      `Declared attribute ${JSON.stringify(attribute.name)}${attribute.fieldName ? ` maps to field ${JSON.stringify(attribute.fieldName)}` : " has no declared field mapping"}; native forwarding and ARIA semantics require independent proof.`,
      { property: attribute.fieldName ?? attribute.name },
    );
  report.slots = declaration.slots.map((slot) => ({
    name: slot.name,
    observations: [],
  }));
  for (const slot of declaration.slots)
    add(
      "slot-content-binding-unproven",
      "content",
      "Preserve consumer-assigned content and source fallback separately. Neither a matching API string nor a screenshot proves an editable content binding.",
      { slot: slot.name },
    );
  for (const event of declaration.events)
    add(
      "event-behavior-unproven",
      "behavior",
      `Declared event ${JSON.stringify(event.name)} has no measured activation, payload or transition contract.`,
    );
  add(
    "interaction-contract-unproven",
    "behavior",
    "Activation, keyboard, focus, accessibility, native form and link behavior are not established by static observations. Undeclared events are not proved absent.",
  );
  add(
    "token-bindings-unproven",
    "tokens",
    "CSS parts/properties and resolved style witnesses do not establish semantic token bindings, modes or target preservation.",
  );
  add(
    "cross-product-coverage-unproven",
    "coverage",
    "Per-axis observations do not establish combined property, theme, content or interaction coverage.",
  );
  add(
    "inherited-and-method-api-unqualified",
    "coverage",
    "This retained CEM declaration projection does not qualify inherited members, callable methods or the complete source API.",
  );
  const counts = new Map<string, number>();
  for (const row of input.observations)
    counts.set(row.story, (counts.get(row.story) ?? 0) + 1);
  for (const row of input.observations) {
    try {
      requireEvidence(counts.get(row.story) === 1, "story-identity-ambiguous");
      requireEvidence(
        !findings.some((finding) => finding.channel === "identity"),
        "declaration-identity-ambiguous",
      );
      const measurement = bound(row.measurement, measured, "measurement");
      const source = bound(row.sourceSemantics, intake, "source-semantics");
      const replay = bound(
        row.replaySemantics,
        observation,
        "replay-semantics",
      );
      const sourceTree = bound(row.sourceTree, treeRecord, "source-tree");
      const replayTree = bound(row.replayTree, treeRecord, "replay-tree");
      requireEvidence(
        measurement.story === row.story &&
          measurement.profile.path[0] === declaration.tagName,
        "story-component-identity-mismatch",
      );
      requireEvidence(
        measurement.semanticIntake.manifestSha256 ===
          input.source.manifestSha256 &&
          measurement.semanticIntake.tagName === declaration.tagName,
        "manifest-identity-mismatch",
      );
      requireEvidence(
        jsonEqual(source.declaration, declaration) &&
          source.declarationSha256 === semanticHash(declaration) &&
          jsonEqual(measurement.semanticIntake.declaration, declaration) &&
          measurement.semanticIntake.declarationSha256 ===
            source.declarationSha256,
        "declaration-hash-mismatch",
      );
      requireEvidence(
        source.observationSha256 === semanticHash(source.observation) &&
          measurement.semanticIntake.observationSha256 ===
            source.observationSha256 &&
          jsonEqual(measurement.semanticIntake.observation, source.observation),
        "observation-hash-mismatch",
      );
      requireEvidence(
        semanticReplayMatches(source.observation, replay, input.identityPolicy),
        "semantic-replay-mismatch",
      );
      requireEvidence(
        row.sourcePng instanceof Uint8Array &&
          row.replayPng instanceof Uint8Array &&
          row.sourcePng.length > 0 &&
          row.replayPng.length > 0,
        "image-bytes-missing",
      );
      const sourceImage = digest(row.sourcePng),
        replayImage = digest(row.replayPng);
      requireEvidence(
        sourceImage === measurement.source.sha256 &&
          sourceImage === source.sourcePngSha256 &&
          replayImage === measurement.replay.sha256 &&
          sourceImage === replayImage,
        "source-replay-image-mismatch",
      );
      requireEvidence(
        sourceTree.treeSha256 === semanticHash(sourceTree.tree) &&
          replayTree.treeSha256 === semanticHash(replayTree.tree) &&
          sourceTree.treeSha256 === replayTree.treeSha256 &&
          sourceTree.treeSha256 === source.sourceTreeSha256 &&
          sourceTree.treeSha256 === measurement.compilerInput.treeSha256 &&
          sourceTree.sourcePngSha256 === sourceImage &&
          replayTree.sourcePngSha256 === replayImage,
        "source-replay-tree-mismatch",
      );
      requireEvidence(
        [
          measurement.source,
          measurement.replay,
          measurement.compilerInput,
          measurement.semanticIntake,
          source,
          sourceTree,
          replayTree,
        ].every((record) => record.problems.length === 0),
        "recorded-evidence-problems",
      );
      for (const reference of [measurement.source, measurement.replay]) {
        const checked = checkSource(
          measurement.profile as SourceProfile,
          reference.observation as SourceObservation,
        );
        requireEvidence(
          !checked.problems.length,
          `source-readiness-invalid:${checked.problems.join(",")}`,
        );
      }
      const assessment = assessSemantics(declaration, source.observation, {
        valid: true,
        sourcePngSha256: sourceImage,
        sourceTreeSha256: sourceTree.treeSha256,
      });
      requireEvidence(
        !assessment.problems.length,
        `semantic-observation-invalid:${assessment.problems.join(",")}`,
      );
      requireEvidence(
        source.observation.nativeElements.every((element) =>
          Object.values(element.properties).every(
            (property) => property.kind === "value",
          ),
        ),
        "native-property-unobserved",
      );
      requireEvidence(
        new Set(source.observation.slots.map((slot) => slot.path)).size ===
          source.observation.slots.length &&
          new Set(
            source.observation.nativeElements.map((element) => element.path),
          ).size === source.observation.nativeElements.length,
        "semantic-path-identity-ambiguous",
      );
      for (const domain of report.enumDomains) {
        const actual = source.observation.properties[domain.property];
        const state = domain.states.find((state) =>
          state.kind === "omitted"
            ? actual?.kind === "undefined"
            : actual?.kind === "value" && state.value === actual.value,
        );
        requireEvidence(
          !!state,
          `enum-observation-outside-domain:${domain.property}`,
        );
      }
      report.evidence.observedStories.push(row.story);
      report.propertyStates.push({
        story: row.story,
        properties: source.observation.properties,
        attributes: source.observation.attributes,
      });
      for (const domain of report.enumDomains) {
        const actual = source.observation.properties[domain.property];
        domain.states
          .find((state) =>
            state.kind === "omitted"
              ? actual?.kind === "undefined"
              : actual?.kind === "value" && state.value === actual.value,
          )!
          .stories.push(row.story);
      }
      for (const slot of source.observation.slots)
        report.slots
          .find((item) => item.name === slot.name)!
          .observations.push({
            story: row.story,
            path: slot.path,
            assigned: slot.assigned,
            fallback: slot.fallback,
          });
      for (const element of source.observation.nativeElements)
        report.nativeStates.push({
          story: row.story,
          path: element.path,
          tag: element.tag,
          native: element.properties,
          aria: Object.fromEntries(
            Object.entries(element.attributes).filter(([name]) =>
              name.startsWith("aria-"),
            ),
          ),
        });
    } catch (error) {
      report.evidence.rejectedStories.push(row.story);
      add(
        error instanceof Error ? error.message : "evidence-invalid",
        "evidence",
        "This story cannot contribute to observed component coverage.",
        { story: row.story },
      );
    }
  }
  for (const domain of report.enumDomains) {
    domain.observed = domain.states.filter(
      (state) => state.stories.length,
    ).length;
    domain.missing = domain.states
      .filter((state) => !state.stories.length)
      .map(({ stories: _stories, ...state }) => state);
    if (domain.missing.length)
      add(
        "enum-states-unobserved",
        "variants",
        `${domain.observed}/${domain.total} declared/omitted states observed; missing ${domain.missing.map((state) => (state.kind === "omitted" ? "(omitted)" : JSON.stringify(state.value))).join(", ")}.`,
        { property: domain.property },
      );
  }
  for (const slot of report.slots)
    if (!slot.observations.length)
      add(
        "declared-slot-unobserved",
        "content",
        "No qualified recorded story renders this declared slot; do not remove it from the API.",
        { slot: slot.name },
      );
  return report;
}
