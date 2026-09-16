import { proveLitStaticTemplates } from "./lit-static-template-proof.js";
import { deriveLifecycleIdentityPolicy } from "./lifecycle-identity.js";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { readCemDeclarations } from "../extract/adapters/cem.js";
import type { LitTemplateInput } from "../extract/adapters/lit-template.js";
import {
  altitudeCohort,
  altitudeButtonVariants,
  altitudeRevision,
} from "./altitude-cohort.js";
import {
  planSourceContract,
  type ContractPlanInput,
  type HashBoundJson,
} from "./contract-plan.js";
import {
  loadRecordedSourceProgram,
  type RecordedSourceProgram,
} from "./source-program.js";
import type { SemanticIntake } from "./semantics.js";
import type { TopologyInput } from "./topology.js";

export interface BindingEvidenceRequest {
  version: 1 | 2;
  component?: "al-checkbox";
  baseline: { id: string; sha256: string };
  supplement?: { id: string; sha256: string };
}
export interface BindingEvidenceRow {
  story: string;
  runId: string;
  eligible: boolean;
  problems: string[];
  profile: (typeof altitudeCohort)[number]["profile"];
  replay?: { harPath: string; harSha256: string; url: string };
  semantics?: SemanticIntake;
  topology?: TopologyInput;
}
export interface BindingEvidence {
  request: BindingEvidenceRequest;
  source: LitTemplateInput;
  sourcePath: string;
  sourceProgramSha256: string;
  /** Server-only graph already authenticated by the evidence loader. Older
   * evidence/test seams may omit it; newer derivations must refuse absence. */
  sourceProgram?: RecordedSourceProgram;
  sourceRevision: string;
  rows: BindingEvidenceRow[];
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const sha = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export function isBindingEvidenceRequest(
  value: unknown,
): value is BindingEvidenceRequest {
  const ref = (v: unknown) =>
    object(v) &&
    Object.keys(v).every((key) => ["id", "sha256"].includes(key)) &&
    typeof v.id === "string" &&
    UUID.test(v.id) &&
    typeof v.sha256 === "string" &&
    HASH.test(v.sha256);
  return (
    object(value) &&
    (value.version === 1 || value.version === 2) &&
    Object.keys(value).every((key) =>
      (value.version === 1
        ? ["version", "baseline", "supplement"]
        : ["version", "baseline", "component"]
      ).includes(key),
    ) &&
    (value.version === 1
      ? value.component === undefined
      : value.component === "al-checkbox" && value.supplement === undefined) &&
    ref(value.baseline) &&
    (value.supplement === undefined || ref(value.supplement))
  );
}

export const bindingComponent = (request: BindingEvidenceRequest) =>
  request.version === 2 ? "al-checkbox" : "al-button";
export const bindingStories = (request: BindingEvidenceRequest) =>
  [
    ...altitudeCohort.filter(
      (row) => row.profile.path[0] === bindingComponent(request),
    ),
    ...(request.version === 1 && request.supplement
      ? altitudeButtonVariants
      : []),
  ].map((row) => row.story);

// Parsed URLs depend only on these exact bytes and the requested story. Keep
// freshness/path/hash validation at the caller; never cache an evidence verdict.
const archiveUrls = new Map<string, string>();

/** These are recorded replay URLs, never arbitrary URLs supplied by the UI.
 * Do not expose archives or their URLs in public application responses. */
export function recordedStoryUrl(harBytes: Uint8Array, story: string): string {
  const cacheKey = sha(harBytes) + ":" + story;
  const cached = archiveUrls.get(cacheKey);
  if (cached) return cached;
  const har = JSON.parse(Buffer.from(harBytes).toString("utf8"));
  if (!Array.isArray(har?.log?.entries))
    throw new Error("binding-archive-invalid");
  const candidates = new Set<string>();
  for (const entry of har.log.entries) {
    if (
      entry?.request?.method !== "GET" ||
      typeof entry.request.url !== "string"
    )
      continue;
    let url: URL;
    try {
      url = new URL(entry.request.url);
    } catch {
      continue;
    }
    if (
      url.pathname !== "/iframe.html" ||
      url.searchParams.get("id") !== story ||
      url.searchParams.get("viewMode") !== "story"
    )
      continue;
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.hash ||
      [...url.searchParams.keys()].sort().join(",") !== "id,viewMode"
    )
      throw new Error("binding-archive-origin-refused");
    candidates.add(url.href);
  }
  if (candidates.size !== 1)
    throw new Error("binding-archive-story-not-unique");
  const result = [...candidates][0];
  if (archiveUrls.size >= 16)
    archiveUrls.delete(archiveUrls.keys().next().value!);
  archiveUrls.set(cacheKey, result);
  return result;
}

/** Read the same fixed recorded cohort as the app admission planner. This adds
 * archive identity and source-program bytes, not a second acceptance policy.
 * Invalid states remain rows and are never replayed to replace bad originals. */
export function loadBindingEvidence(
  repoRoot: string,
  request: BindingEvidenceRequest,
): BindingEvidence {
  if (!isBindingEvidenceRequest(request))
    throw new Error("binding-request-invalid");
  if (
    !lstatSync(repoRoot).isDirectory() ||
    !lstatSync(path.join(repoRoot, "private")).isDirectory()
  )
    throw new Error("binding-evidence-directory-refused");
  const evidenceRoot = path.join(repoRoot, "private/source-reference-app");
  const file = (id: string, ...parts: string[]): string => {
    let target = evidenceRoot;
    if (!lstatSync(target).isDirectory())
      throw new Error("binding-evidence-directory-refused");
    for (const [index, part] of [id, ...parts].entries()) {
      if (
        !part ||
        part.includes("/") ||
        part.includes("\\") ||
        part === "." ||
        part === ".."
      )
        throw new Error("binding-evidence-path-invalid");
      target = path.join(target, part);
      const stat = lstatSync(target);
      if (
        stat.isSymbolicLink() ||
        (index < parts.length ? !stat.isDirectory() : !stat.isFile())
      )
        throw new Error("binding-evidence-kind-refused");
    }
    return target;
  };
  const record = (
    ref: BindingEvidenceRequest["baseline"],
    supplemental: boolean,
  ) => {
    const bytes = readFileSync(file(ref.id, "measurement.json"));
    if (sha(bytes) !== ref.sha256)
      throw new Error("binding-parent-hash-mismatch");
    const value = JSON.parse(bytes.toString());
    const entries = supplemental ? altitudeButtonVariants : altitudeCohort;
    if (
      value.sourceRevision !== altitudeRevision ||
      value.sourceStable !== true ||
      !object(value.sourceHashes) ||
      value.denominator !== entries.length ||
      !Array.isArray(value.rows) ||
      value.rows.length !== entries.length ||
      !entries.every(
        ({ story }) =>
          value.rows.filter((row: any) => row.story === story).length === 1,
      ) ||
      (value.cohortId ?? "baseline") !==
        (supplemental ? "button-variants" : "baseline")
    )
      throw new Error("binding-parent-shape-invalid");
    if (
      supplemental
        ? value.parent?.id !== request.baseline.id ||
          value.parent?.measurementSha256 !== request.baseline.sha256
        : value.parent !== undefined
    )
      throw new Error("binding-parent-relationship-invalid");
    return { ref, value, entries };
  };
  const baseline = record(request.baseline, false);
  const runs = [
    baseline,
    ...(request.supplement ? [record(request.supplement, true)] : []),
  ];
  if (
    runs.some(
      (run) =>
        JSON.stringify(run.value.sourceHashes) !==
        JSON.stringify(baseline.value.sourceHashes),
    )
  )
    throw new Error("binding-source-identity-mismatch");
  const checkout = path.resolve(repoRoot, "..", "altitude");
  const manifestPath = "libs/al-web-components/custom-elements.json";
  const manifestBytes = readFileSync(path.join(checkout, manifestPath));
  const manifestSha256 = sha(manifestBytes);
  if (baseline.value.sourceHashes[manifestPath] !== manifestSha256)
    throw new Error("binding-manifest-changed");
  const manifest = readCemDeclarations(JSON.parse(manifestBytes.toString()));
  const declarations = manifest.declarations.filter(
    (declaration) => declaration.tagName === bindingComponent(request),
  );
  if (declarations.length !== 1)
    throw new Error("binding-declaration-not-unique");
  const declaration = declarations[0];
  const program = loadRecordedSourceProgram({
    checkout,
    revision: baseline.value.sourceRevision,
    manifestPath,
    manifestSha256,
    modulePath: declaration.modulePath,
    className: declaration.className,
    sourceHashes: baseline.value.sourceHashes,
  });
  const entry = program.modules.find(
    (module) => module.path === program.entryPath,
  );
  if (program.status === "refused" || !entry)
    throw new Error("binding-source-program-refused");
  const source: LitTemplateInput = {
    source: entry.text,
    sourceSha256: entry.sha256,
    modulePath: declaration.modulePath,
    className: declaration.className,
  };
  const observations: ContractPlanInput["observations"] = [];
  const rows: BindingEvidenceRow[] = [];
  for (const run of runs)
    for (const { story, profile } of run.entries.filter(
      (entry) => entry.profile.path[0] === declaration.tagName,
    )) {
      const row: BindingEvidenceRow = {
        story,
        runId: run.ref.id,
        eligible: false,
        profile,
        problems: [],
      };
      rows.push(row);
      const blob = (asset: string): HashBoundJson => {
        try {
          const utf8 = readFileSync(file(run.ref.id, story, asset), "utf8");
          return { utf8, sha256: sha(utf8) };
        } catch {
          return { utf8: "", sha256: "" };
        }
      };
      const png = (asset: string) => {
        try {
          return readFileSync(file(run.ref.id, story, asset));
        } catch {
          return new Uint8Array();
        }
      };
      const measurement = blob("measurement.json");
      try {
        const parsed = JSON.parse(measurement.utf8);
        if (
          JSON.stringify(parsed) !==
            JSON.stringify(
              run.value.rows.find((item: any) => item.story === story),
            ) ||
          JSON.stringify(parsed.profile) !== JSON.stringify(profile)
        )
          throw new Error();
      } catch {
        row.problems.push("binding-recorded-state-identity-invalid");
        measurement.sha256 = "";
      }
      observations.push({
        story,
        measurement,
        sourceSemantics: blob("source-semantics.json"),
        replaySemantics: blob("replay-semantics.json"),
        sourceTree: blob("source-tree.json"),
        replayTree: blob("replay-tree.json"),
        sourcePng: png("source.png"),
        replayPng: png("replay.png"),
      });
    }
  const plan = planSourceContract({
    component: {
      tagName: declaration.tagName,
      modulePath: declaration.modulePath,
      className: declaration.className,
    },
    source: {
      revision: baseline.value.sourceRevision,
      manifestPath,
      manifestSha256,
    },
    declaration,
    identityPolicy: deriveLifecycleIdentityPolicy(source, declaration),
    declarationProblems: manifest.problems,
    observations,
  });
  for (const [index, row] of rows.entries()) {
    if (!plan.evidence.observedStories.includes(row.story)) {
      row.problems.push(
        ...plan.findings
          .filter(
            (finding) =>
              finding.story === row.story && finding.channel === "evidence",
          )
          .map((finding) => finding.code),
      );
      if (!row.problems.length)
        row.problems.push("binding-source-state-not-qualified");
      continue;
    }
    try {
      const raw = observations[index];
      const measurement = JSON.parse(raw.measurement.utf8),
        tree = JSON.parse(raw.sourceTree.utf8),
        semantics = JSON.parse(raw.sourceSemantics.utf8);
      const harPath = file(row.runId, row.story, "source.har"),
        harBytes = readFileSync(harPath),
        harSha256 = sha(harBytes);
      if (measurement.archive?.sha256 !== harSha256)
        throw new Error("binding-archive-hash-mismatch");
      if (request.version === 2) {
        const render = measurement.renderIntake;
        if (
          render?.status !== "verified-parser-input" ||
          render.sourceSha256 !== source.sourceSha256 ||
          render.sourcePngSha256 !== tree.sourcePngSha256
        )
          throw Error("binding-static-original-unverified");
        for (const [name, key] of [
          ["source-render.json", "sourceRenderSha256"],
          ["replay-render.json", "replayRenderSha256"],
        ]) {
          const bytes = readFileSync(file(row.runId, row.story, name));
          if (sha(bytes) !== render[key])
            throw Error("binding-static-original-changed");
          proveLitStaticTemplates(source, JSON.parse(bytes.toString()));
        }
      }
      row.replay = {
        harPath,
        harSha256,
        url: recordedStoryUrl(harBytes, row.story),
      };
      row.semantics = semantics;
      row.topology = {
        hostPath: [declaration.tagName],
        rootPath: row.profile.path,
        stageSelector: "#storybook-root",
        channels: tree.channels,
        varPrefix: "--al-",
        tree: tree.tree,
        treeSha256: tree.treeSha256,
        sourcePngSha256: tree.sourcePngSha256,
      };
      row.eligible = true;
    } catch (error) {
      row.problems.push(
        error instanceof Error && /^binding-[a-z-]+$/.test(error.message)
          ? error.message
          : "binding-recorded-state-unavailable",
      );
    }
  }
  return {
    request,
    source,
    sourcePath: entry.path,
    sourceProgramSha256: program.digest,
    sourceProgram: program,
    sourceRevision: baseline.value.sourceRevision,
    rows,
  };
}
