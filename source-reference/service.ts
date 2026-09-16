import { execFile, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { createBindingJobs } from "./binding-jobs.js";
import {
  createCandidateJobs,
  type CandidateJobsOptions,
} from "./candidate-jobs.js";
import { validateCandidatePreparationReport } from "./candidate-report.js";
import { validateCandidateVisualReport } from "./candidate-visual-report.js";
import {
  createNativeOperationJobs,
  prepareVerifiedNativeOperation,
  prepareVerifiedNativeComponentWrite,
  type NativeOperationJobsOptions,
} from "./native-operation-jobs.js";
import type { BindingEvidenceRequest } from "./binding-evidence.js";
import { createNativeOperationTransport } from "./native-operation-transport.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  altitudeCohort,
  altitudeButtonVariants,
  altitudeRevision,
} from "./altitude-cohort.js";
import { readCemDeclarations } from "../extract/adapters/cem.js";
import {
  inspectRecordedSourceBindings,
  type SourceBindingInventory,
} from "./source-bindings.js";
import {
  planSourceContract,
  type HashBoundJson,
  type ContractPlanInput,
  type SourceContractPlan,
} from "./contract-plan.js";

type CohortId = "baseline" | "button-variants";
const cohort = (id: CohortId = "baseline") =>
  id === "baseline" ? altitudeCohort : altitudeButtonVariants;
const stories = new Set(
  [...altitudeCohort, ...altitudeButtonVariants].map((e) => e.story),
);
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
type RunState = "running" | "complete" | "failed" | "interrupted";
export interface ReferenceJob {
  id: string;
  origin?: string;
  state: RunState;
  startedAt?: string;
  recovered?: true;
  completedAt?: string;
  problem?: string;
  cohortId?: CohortId;
  parent?: { id: string; measurementSha256: string };
}
type Launch = (
  args: string[],
  done: (error: unknown) => void,
) => Pick<ChildProcess, "kill">;

export function loopbackOrigin(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Enter a local Storybook origin.");
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Only an unauthenticated local Storybook origin is supported.",
    );
  return url.origin;
}

/** Dev-only service. No remote files, shell interpolation, HAR downloads or
 * owner grades. Native execution belongs to the authenticated companion plugin;
 * request values cannot choose a script, native target or checkout. */
export function createReferenceService(
  repoRoot: string,
  launch?: Launch,
  bindingLaunch?: Launch,
  candidateOptions: Partial<
    Pick<
      CandidateJobsOptions,
      "run" | "validateReport" | "validateVisualReport"
    >
  > = {},
  nativeOptions?: NativeOperationJobsOptions,
) {
  const evidenceRoot = path.join(repoRoot, "private", "source-reference-app");
  const checkout = path.resolve(repoRoot, "..", "altitude");
  const jobs = new Map<string, ReferenceJob>();
  const bindingJobs = createBindingJobs(repoRoot, bindingLaunch);
  // Trusted in-process callbacks only. HTTP requests never choose builders,
  // validators, original source paths, revisions or artifact locations.
  const candidateJobs = createCandidateJobs(repoRoot, {
    selectLatestVerified: (request) =>
      bindingJobs.selectLatestVerified(request),
    validateReport:
      candidateOptions.validateReport ?? validateCandidatePreparationReport,
    visualJobVersion: 3,
    validateVisualReport:
      candidateOptions.validateVisualReport ?? validateCandidateVisualReport,
    ...(candidateOptions.run ? { run: candidateOptions.run } : {}),
  });
  const nativeJobs = createNativeOperationJobs(
    repoRoot,
    nativeOptions ?? {
      prepare: (request, operation) =>
        prepareVerifiedNativeOperation(
          repoRoot,
          candidateJobs.selectLatestVisualVerified(request),
          operation,
        ),
      buildComponent: (request, context) =>
        prepareVerifiedNativeComponentWrite(
          repoRoot,
          candidateJobs.selectLatestVisualVerified(request),
          context,
        ),
    },
  );
  let active:
    { job: ReferenceJob; child: Pick<ChildProcess, "kill"> } | undefined;
  const execute: Launch =
    launch ??
    ((args, done) =>
      execFile(
        process.execPath,
        args,
        { cwd: repoRoot, timeout: 240000, maxBuffer: 1024 * 1024 },
        (error) => done(error),
      ));
  const read = (file: string) => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  };
  // Recovery and image reads never follow symlinks out of the fixed evidence
  // root. Request values cannot supply an arbitrary path or a filename.
  const evidenceFile = (...parts: string[]): string | null => {
    try {
      let current = evidenceRoot;
      if (!lstatSync(current).isDirectory()) return null;
      for (const part of parts.slice(0, -1)) {
        current = path.join(current, part);
        if (!lstatSync(current).isDirectory()) return null;
      }
      const file = path.join(current, parts.at(-1)!);
      return lstatSync(file).isFile() ? file : null;
    } catch {
      return null;
    }
  };
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const strings = (value: unknown) =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
  const fileHash = (file: string) =>
    createHash("sha256").update(readFileSync(file)).digest("hex");
  const parentMatches = (
    parent: unknown,
    sourceHashes?: unknown,
  ): parent is NonNullable<ReferenceJob["parent"]> => {
    if (
      !object(parent) ||
      typeof parent.id !== "string" ||
      !UUID.test(parent.id) ||
      typeof parent.measurementSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(parent.measurementSha256)
    )
      return false;
    const file = evidenceFile(parent.id, "measurement.json");
    const record = file ? read(file) : null;
    return (
      !!file &&
      fileHash(file) === parent.measurementSha256 &&
      record?.sourceStable === true &&
      record.sourceRevision === altitudeRevision &&
      (record.cohortId ?? "baseline") === "baseline" &&
      object(record.sourceHashes) &&
      Object.keys(record.sourceHashes).length > 0 &&
      (sourceHashes === undefined ||
        JSON.stringify(record.sourceHashes) === JSON.stringify(sourceHashes))
    );
  };
  const supplementMatches = (
    parent: unknown,
    sourceHashes: unknown,
  ): parent is NonNullable<ReferenceJob["parent"]> =>
    object(sourceHashes) &&
    Object.keys(sourceHashes).length > 0 &&
    parentMatches(parent, sourceHashes);
  const validRow = (row: unknown): row is Record<string, unknown> => {
    if (
      !object(row) ||
      !stories.has(String(row.story)) ||
      typeof row.qualified !== "boolean"
    )
      return false;
    if (row.error !== undefined && typeof row.error !== "string") return false;
    for (const field of [
      "source",
      "replay",
      "compilerInput",
      "semanticIntake",
    ]) {
      if (row[field] === undefined) continue;
      const value = row[field];
      if (!object(value) || !strings(value.problems)) return false;
      if (value.status !== undefined && typeof value.status !== "string")
        return false;
      if (value.limitations !== undefined && !strings(value.limitations))
        return false;
    }
    if (row.qualified) {
      const source = row.source;
      const replay = row.replay;
      if (
        row.error !== undefined ||
        !object(source) ||
        !object(replay) ||
        source.status !== "valid" ||
        replay.status !== "valid" ||
        typeof source.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(source.sha256) ||
        source.sha256 !== replay.sha256 ||
        (source.problems as string[]).length ||
        (replay.problems as string[]).length
      )
        return false;
    } else if (
      !(typeof row.error === "string" && row.error.length > 0) &&
      (!object(row.source) ||
        typeof row.source.status !== "string" ||
        !object(row.replay) ||
        typeof row.replay.status !== "string")
    )
      return false;
    return true;
  };
  const rowEvidenceMatches = (id: string, row: unknown) => {
    if (!validRow(row)) return false;
    const rowFile = evidenceFile(id, String(row.story), "measurement.json");
    const stored = rowFile ? read(rowFile) : null;
    if (!validRow(stored) || JSON.stringify(stored) !== JSON.stringify(row))
      return false;
    if (!row.qualified) return true;
    return ["source.png", "replay.png"].every((asset) => {
      const file = evidenceFile(id, String(row.story), asset);
      return (
        !!file &&
        fileHash(file) === (row.source as Record<string, unknown>).sha256
      );
    });
  };
  // Completed cohorts can be reopened without launching a process or changing
  // evidence. A full final record AND matching per-story records are required;
  // an abandoned directory or a ten-item but duplicated list is not completion.
  const recovered: ReferenceJob[] = [];
  try {
    if (lstatSync(evidenceRoot).isDirectory()) {
      for (const entry of readdirSync(evidenceRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !UUID.test(entry.name)) continue;
        const file = evidenceFile(entry.name, "measurement.json");
        const final = file ? read(file) : null;
        const selection = final?.cohortId ?? "baseline";
        if (!["baseline", "button-variants"].includes(selection)) continue;
        const selected = cohort(selection);
        const selectedStories = new Set(selected.map(({ story }) => story));
        if (
          !object(final) ||
          final.sourceRevision !== altitudeRevision ||
          typeof final.sourceStable !== "boolean" ||
          final.denominator !== selected.length ||
          typeof final.recordedAt !== "string" ||
          !Number.isFinite(Date.parse(final.recordedAt)) ||
          new Date(final.recordedAt).toISOString() !== final.recordedAt ||
          !Array.isArray(final.rows) ||
          final.rows.length !== selected.length ||
          !final.rows.every(validRow) ||
          !final.rows.every((row) => selectedStories.has(String(row.story))) ||
          new Set(final.rows.map((row) => row.story)).size !==
            selected.length ||
          (selection === "baseline"
            ? final.parent !== undefined
            : !supplementMatches(final.parent, final.sourceHashes))
        )
          continue;
        const qualified = final.sourceStable
          ? final.rows.filter((row) => row.qualified).length
          : 0;
        if (
          final.qualified !== qualified ||
          !final.rows.every((row) => {
            const rowFile = evidenceFile(
              entry.name,
              String(row.story),
              "measurement.json",
            );
            const stored = rowFile ? read(rowFile) : null;
            if (
              !validRow(stored) ||
              JSON.stringify(stored) !== JSON.stringify(row)
            )
              return false;
            if (!row.qualified) return true;
            // Matching metadata is not matching evidence: re-read the saved
            // image bytes before restoring any qualified row. This verifies
            // existing artifacts only; it does not render or refresh a source.
            return ["source.png", "replay.png"].every((asset) => {
              const image = evidenceFile(entry.name, String(row.story), asset);
              if (!image) return false;
              try {
                return (
                  createHash("sha256")
                    .update(readFileSync(image))
                    .digest("hex") ===
                  (row.source as Record<string, unknown>).sha256
                );
              } catch {
                return false;
              }
            });
          })
        )
          continue;
        recovered.push({
          id: entry.name,
          state: "complete",
          recovered: true,
          completedAt: final.recordedAt,
          cohortId: selection,
          ...(selection === "button-variants" &&
          supplementMatches(final.parent, final.sourceHashes)
            ? { parent: final.parent }
            : {}),
        });
      }
    }
  } catch {
    /* Missing/unreadable evidence is not fabricated as a completed run. */
  }
  recovered.sort(
    (a, b) =>
      a.completedAt!.localeCompare(b.completedAt!) || a.id.localeCompare(b.id),
  );
  for (const job of recovered.filter((job) => !job.parent))
    jobs.set(job.id, job);
  for (const job of recovered.filter((job) => job.parent))
    if (jobs.has(job.parent!.id)) jobs.set(job.id, job);
  function snapshot(job: ReferenceJob) {
    const finalFile = evidenceFile(job.id, "measurement.json");
    const final = finalFile ? read(finalFile) : null;
    const parentValid =
      !job.parent ||
      (final
        ? supplementMatches(job.parent, final.sourceHashes)
        : parentMatches(job.parent));
    const rows = cohort(job.cohortId).map(({ story, limitations }) => {
      const rowFile = evidenceFile(job.id, story, "measurement.json");
      const rawData = rowFile ? read(rowFile) : null;
      const data = validRow(rawData) ? (rawData as Record<string, any>) : null;
      const problems = [
        ...new Set<string>([
          ...(data?.source?.problems ?? []),
          ...(data?.replay?.problems ?? []),
          ...(data?.error ? [data.error] : []),
        ]),
      ];
      if (final?.sourceStable === false)
        problems.push("source-changed-during-capture");
      if (!parentValid) problems.push("supplement-parent-changed");
      // Recovery is not a permanent integrity grant. Recheck the bytes shown
      // now, including final/per-story agreement, before exposing a valid row.
      const recordedRow = (Array.isArray(final?.rows) ? final.rows : []).find(
        (row: { story?: string }) => row?.story === story,
      );
      const evidenceValid = !final || rowEvidenceMatches(job.id, recordedRow);
      if (!evidenceValid) problems.push("source-evidence-changed");
      return {
        story,
        limitations,
        status:
          !parentValid || !evidenceValid
            ? "invalid"
            : !data
              ? job.state === "running"
                ? "pending"
                : "not-captured"
              : data.qualified && final?.sourceStable
                ? "valid"
                : final?.sourceStable === false || !data.qualified
                  ? "invalid"
                  : "awaiting-source-integrity",
        problems,
        semanticIntake: data?.semanticIntake
          ? {
              ...data.semanticIntake,
              status:
                !parentValid || !evidenceValid || final?.sourceStable === false
                  ? "source-invalid"
                  : final?.sourceStable === true
                    ? data.qualified
                      ? data.semanticIntake.status
                      : "source-invalid"
                    : "awaiting-source-integrity",
            }
          : null,
        compilerInput: data?.compilerInput
          ? {
              ...data.compilerInput,
              status:
                !parentValid || !evidenceValid || final?.sourceStable === false
                  ? "source-invalid"
                  : final?.sourceStable === true
                    ? data.qualified
                      ? data.compilerInput.status
                      : "source-invalid"
                    : "awaiting-source-integrity",
            }
          : null,
        sourceImage: evidenceFile(job.id, story, "source.png")
          ? `/api/source-reference/${job.id}/${story}/source.png`
          : null,
        replayImage: evidenceFile(job.id, story, "replay.png")
          ? `/api/source-reference/${job.id}/${story}/replay.png`
          : null,
      };
    });
    return {
      ...job,
      sourceRevision: altitudeRevision,
      theme: "Altitude dark · IBM Plex Sans",
      denominator: cohort(job.cohortId).length,
      qualified: rows.filter((r) => r.status === "valid").length,
      sourceStable: parentValid ? (final?.sourceStable ?? null) : false,
      rows,
      fidelity: "not measured",
      usability: "not qualified",
      workflow: "source validation only",
    };
  }
  function contractAdmission(job: ReferenceJob) {
    const plans: SourceContractPlan[] = [];
    const sourceBindings: SourceBindingInventory[] = [];
    const problems: string[] = [];
    try {
      const file = evidenceFile(job.id, "measurement.json");
      const final = file ? read(file) : null;
      if (job.state !== "complete" || !final?.sourceStable || job.parent)
        throw new Error("baseline-not-complete");
      const manifestPath = "libs/al-web-components/custom-elements.json";
      const manifestBytes = readFileSync(path.join(checkout, manifestPath));
      const manifestSha256 = createHash("sha256")
        .update(manifestBytes)
        .digest("hex");
      if (
        final.sourceRevision !== altitudeRevision ||
        final.sourceHashes?.[manifestPath] !== manifestSha256
      )
        throw new Error("recorded-manifest-unavailable-or-changed");
      const manifest = readCemDeclarations(
        JSON.parse(manifestBytes.toString()),
      );
      const readBlob = (
        id: string,
        story: string,
        asset: string,
      ): HashBoundJson => {
        const file = evidenceFile(id, story, asset);
        if (!file) return { utf8: "", sha256: "" };
        const utf8 = readFileSync(file, "utf8");
        return {
          utf8,
          sha256: createHash("sha256").update(utf8).digest("hex"),
        };
      };
      // Select only the latest explicit supplement, never union different
      // attempts to hide refusals. All attempts remain separately inspectable.
      const latestSupplement = [...jobs.values()]
        .filter((child) => child.parent?.id === job.id)
        .at(-1);
      const inputs = [job];
      if (latestSupplement?.state === "complete") {
        const childFile = evidenceFile(latestSupplement.id, "measurement.json");
        const childFinal = childFile ? read(childFile) : null;
        if (
          childFinal?.sourceStable === true &&
          supplementMatches(latestSupplement.parent, childFinal.sourceHashes)
        )
          inputs.push(latestSupplement);
        else problems.push("supplement-source-identity-invalid");
      }
      for (const tagName of new Set(
        altitudeCohort.map(({ profile }) => profile.path[0]),
      )) {
        const declarations = manifest.declarations.filter(
          (declaration) => declaration.tagName === tagName,
        );
        if (declarations.length !== 1) {
          problems.push(`declaration-not-unique:${tagName}`);
          continue;
        }
        const declaration = declarations[0];
        sourceBindings.push(
          inspectRecordedSourceBindings({
            checkout,
            revision: final.sourceRevision,
            manifestPath,
            manifestSha256,
            sourceHashes: final.sourceHashes,
            tagName,
            modulePath: declaration.modulePath,
            className: declaration.className,
          }),
        );
        const observations: ContractPlanInput["observations"] = [];
        for (const input of inputs) {
          const recordFile = evidenceFile(input.id, "measurement.json");
          const record = recordFile ? read(recordFile) : null;
          for (const { story, profile } of cohort(input.cohortId).filter(
            (entry) => entry.profile.path[0] === tagName,
          )) {
            const measurement = readBlob(input.id, story, "measurement.json");
            let stored: Record<string, unknown> | null = null;
            try {
              stored = JSON.parse(measurement.utf8);
            } catch {
              /* retain malformed row as rejected evidence below */
            }
            const recorded = record?.rows?.find(
              (row: { story?: string }) => row.story === story,
            );
            // The pinned adapter's authored witnesses must not be replaced by
            // expectations learned from the output or changed receipt prose.
            if (
              !stored ||
              !rowEvidenceMatches(input.id, recorded) ||
              JSON.stringify(stored) !== JSON.stringify(recorded) ||
              JSON.stringify(stored.profile) !== JSON.stringify(profile)
            ) {
              problems.push(`recorded-state-identity-invalid:${story}`);
              measurement.sha256 = ""; // the planner keeps and rejects this row
            }
            const image = (asset: string) => {
              const file = evidenceFile(input.id, story, asset);
              return file ? readFileSync(file) : new Uint8Array();
            };
            observations.push({
              story,
              measurement,
              sourceSemantics: readBlob(
                input.id,
                story,
                "source-semantics.json",
              ),
              replaySemantics: readBlob(
                input.id,
                story,
                "replay-semantics.json",
              ),
              sourceTree: readBlob(input.id, story, "source-tree.json"),
              replayTree: readBlob(input.id, story, "replay-tree.json"),
              sourcePng: image("source.png"),
              replayPng: image("replay.png"),
            });
          }
        }
        plans.push(
          planSourceContract({
            component: {
              tagName,
              modulePath: declaration.modulePath,
              className: declaration.className,
            },
            source: {
              revision: final.sourceRevision,
              manifestPath,
              manifestSha256,
            },
            declaration,
            declarationProblems: manifest.problems,
            observations,
          }),
        );
      }
    } catch {
      // No raw parser/filesystem error or source contents returned to the UI.
      problems.push("recorded-contract-evidence-unavailable");
    }
    return {
      status: "blocked" as const,
      acceptedContract: null,
      plans,
      sourceBindings,
      problems,
    };
  }
  const nativeTransport = createNativeOperationTransport(repoRoot, nativeJobs);
  const snapshotWithSupplement = (job: ReferenceJob) => {
    const candidates = candidateJobs.list(job.id);
    const nativeOperation = nativeJobs.forBaseline(job.id);
    return {
      ...snapshot(job),
      supplements: [...jobs.values()]
        .filter((child) => child.parent?.id === job.id)
        .map(snapshot),
      contractAdmission: contractAdmission(job),
      bindingTraces: bindingJobs.list(job.id),
      candidatePreparations: candidates.filter(
        (candidate) =>
          candidate.operation === undefined ||
          candidate.operation === "source-preparation",
      ),
      candidateVisuals: candidates.filter(
        (candidate) => candidate.operation === "source-visual-assembly",
      ),
      nativeOperation,
      nativeConnection:
        nativeOperation && nativeOperation.phase !== "evidence-unavailable"
          ? nativeTransport.status(nativeOperation.id)
          : null,
    };
  };
  function start(
    origin: string,
    cohortId: CohortId = "baseline",
    parent?: ReferenceJob["parent"],
  ) {
    if (active) return active.job;
    mkdirSync(evidenceRoot, { recursive: true });
    const job: ReferenceJob = {
      id: randomUUID(),
      origin,
      state: "running",
      startedAt: new Date().toISOString(),
      cohortId,
      ...(parent ? { parent } : {}),
    };
    jobs.set(job.id, job);
    const output = path.join(evidenceRoot, job.id);
    const child = execute(
      [
        "--import",
        "tsx",
        "source-reference/cohort-run.ts",
        origin,
        checkout,
        output,
        cohortId,
        ...(parent ? [parent.id, parent.measurementSha256] : []),
      ],
      (error) => {
        if (job.state !== "interrupted") {
          const final = read(path.join(output, "measurement.json"));
          // Exit 1 with a complete measurement is an honest refusal, not lost work.
          job.state =
            final?.rows?.length === cohort(cohortId).length
              ? "complete"
              : "failed";
          if (job.state === "failed")
            job.problem = error
              ? "Validation stopped before a complete measurement. Check the pinned checkout and running Storybook, then retry."
              : "Validation did not produce a complete measurement.";
        }
        if (active?.job.id === job.id) active = undefined;
      },
    );
    active = { job, child };
    return job;
  }
  const json = (res: ServerResponse, status: number, value: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(value));
  };
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const remote = req.socket.remoteAddress;
    if (!remote || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
      json(res, 403, { error: "Local access only." });
      return;
    }
    // Guard DNS rebinding as well as cross-origin writes/reads.
    let host: URL;
    try {
      host = new URL(`http://${req.headers.host}`);
      loopbackOrigin(host.origin);
    } catch {
      json(res, 403, { error: "Local host required." });
      return;
    }
    const route = (req.url ?? "")
      .split("?")[0]
      .replace(/^\/api\/source-reference\/?/, "");
    // The plugin is a different origin. Only these two routes accept its
    // high-entropy pairing capability; no general service CORS exemption.
    const pluginRoute = /^native\/([a-f0-9-]+)\/(claim|result)$/.exec(route);
    const body = async (limit: number) => {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw Error("JSON required");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > limit) throw Error("Request too large");
        chunks.push(bytes);
      }
      return JSON.parse(Buffer.concat(chunks).toString());
    };
    if (pluginRoute) {
      if (req.headers.origin === "null") {
        res.setHeader("Access-Control-Allow-Origin", "null");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type",
        );
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      } else if (req.headers.origin && req.headers.origin !== host.origin) {
        json(res, 403, { error: "Plugin origin required." });
        return;
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== "POST") {
        json(res, 405, { error: "POST required." });
        return;
      }
      const secret =
        /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? "")?.[1] ??
        "";
      try {
        nativeTransport.authorize(pluginRoute[1], secret);
      } catch {
        json(res, 403, { error: "Native connection refused." });
        return;
      }
      try {
        const payload = await body(
          pluginRoute[2] === "claim" ? 2048 : 4 * 1024 * 1024,
        );
        if (pluginRoute[2] === "claim") {
          if (
            !object(payload) ||
            Object.keys(payload).some(
              (key) => !["fileKey", "replaceReadbackAttemptId"].includes(key),
            ) ||
            typeof payload.fileKey !== "string" ||
            (payload.replaceReadbackAttemptId !== undefined &&
              (typeof payload.replaceReadbackAttemptId !== "string" ||
                !UUID.test(payload.replaceReadbackAttemptId)))
          ) {
            json(res, 400, {
              error:
                "Only the active file and an optional interrupted readback identity are accepted.",
            });
            return;
          }
          json(
            res,
            200,
            nativeTransport.claim(
              pluginRoute[1],
              secret,
              payload.fileKey,
              payload.replaceReadbackAttemptId,
            ),
          );
        } else {
          json(
            res,
            200,
            nativeTransport.accept(pluginRoute[1], secret, payload),
          );
        }
      } catch {
        json(res, 409, {
          error:
            "Native delivery could not proceed. Inspect the operation in the local app; a missing result does not authorize another creation.",
        });
      }
      return;
    }
    if (req.headers.origin && req.headers.origin !== host.origin) {
      json(res, 403, { error: "Same-origin access required." });
      return;
    }
    const nativeAction =
      /^([a-f0-9-]+)\/button-native-(connection|start|retry-observation)$/.exec(
        route,
      );
    if (req.method === "POST" && nativeAction) {
      try {
        const payload = await body(2048);
        if (!object(payload) || Object.keys(payload).length) {
          json(res, 400, { error: "Only an empty object is accepted." });
          return;
        }
        const baseline = jobs.get(nativeAction[1]);
        const operation =
          baseline && !baseline.parent
            ? nativeJobs.forBaseline(baseline.id)
            : null;
        if (
          !baseline ||
          !operation ||
          operation.phase === "evidence-unavailable"
        ) {
          json(res, 409, {
            error: "Prepare a verified native operation first.",
          });
          return;
        }
        if (nativeAction[2] === "connection") {
          // Development manifest explicitly allows this one local app port.
          if (host.port !== "5181") {
            json(res, 409, {
              error: "Native pairing requires the local app on port 5181.",
            });
            return;
          }
          json(res, 200, { connection: nativeTransport.pair(operation.id) });
        } else {
          if (active || candidateJobs.running || bindingJobs.running) {
            json(res, 409, {
              error: "Wait for the current source operation to finish.",
            });
            return;
          }
          if (nativeAction[2] === "retry-observation")
            nativeTransport.retryObservation(operation.id);
          else nativeTransport.start(operation.id);
          json(res, 202, snapshotWithSupplement(baseline));
        }
      } catch {
        json(res, 409, {
          error:
            "Native connection or start refused. Inspect the saved operation before retrying.",
        });
      }
      return;
    }
    if (req.method === "GET" && !route) {
      json(res, 200, {
        adapter: "Altitude Web Components",
        sourceRevision: altitudeRevision,
        defaultOrigin: "http://127.0.0.1:6017",
        checkoutAvailable: existsSync(
          path.join(checkout, "libs/al-web-components/.storybook/preview.ts"),
        ),
        latest: [...jobs.values()].filter((job) => !job.parent).at(-1)
          ? snapshotWithSupplement(
              [...jobs.values()].filter((job) => !job.parent).at(-1)!,
            )
          : null,
      });
      return;
    }
    const supplementalMatch = /^([a-f0-9-]+)\/button-variants$/i.exec(route);
    const bindingMatch = /^([a-f0-9-]+)\/button-bindings$/i.exec(route);
    const candidateMatch = /^([a-f0-9-]+)\/button-candidate$/i.exec(route);
    const visualMatch = /^([a-f0-9-]+)\/button-visual-candidate$/i.exec(route);
    const nativeMatch = /^([a-f0-9-]+)\/button-native-operation$/i.exec(route);
    if (
      req.method === "POST" &&
      (bindingMatch || candidateMatch || visualMatch || nativeMatch)
    ) {
      const preparingCandidate =
        !!candidateMatch || !!visualMatch || !!nativeMatch;
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        json(res, 415, { error: "JSON required." });
        return;
      }
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2048) throw Error("Request too large.");
          chunks.push(Buffer.from(chunk));
        }
        let request: unknown;
        try {
          request = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          json(res, 400, { error: "A JSON object is required." });
          return;
        }
        if (
          !object(request) ||
          (nativeMatch && Object.keys(request).length !== 0) ||
          Object.keys(request).some((key) => key !== "retry") ||
          (request.retry !== undefined &&
            (preparingCandidate
              ? request.retry !== true
              : typeof request.retry !== "boolean"))
        ) {
          json(res, 400, {
            error: nativeMatch
              ? "Only an empty object is accepted; source evidence, native target and operation identity are fixed."
              : preparingCandidate
                ? "Only an empty object or retry: true is accepted; source evidence and preparation are fixed."
                : "Only an optional Boolean retry is accepted; source, scripts and replay targets are fixed.",
          });
          return;
        }
        // These actions use the same host-selected baseline and latest
        // supplement. Caller-supplied IDs/hashes cannot override this request.
        const baseline = jobs.get(
          (nativeMatch ?? visualMatch ?? candidateMatch ?? bindingMatch)![1],
        );
        const file = baseline
          ? evidenceFile(baseline.id, "measurement.json")
          : null;
        const parent = file
          ? { id: baseline!.id, measurementSha256: fileHash(file) }
          : undefined;
        if (
          !baseline ||
          baseline.parent ||
          baseline.state !== "complete" ||
          !file ||
          !parentMatches(parent)
        ) {
          json(res, 409, {
            error: preparingCandidate
              ? "A complete unchanged original baseline is required for source candidate preparation."
              : "A complete unchanged original baseline is required for binding replay.",
          });
          return;
        }
        if (
          active ||
          (nativeMatch && candidateJobs.running) ||
          (preparingCandidate ? bindingJobs.running : candidateJobs.running)
        ) {
          json(res, 409, {
            error:
              "Another source capture, binding replay or candidate operation is running. Wait for it to finish.",
          });
          return;
        }
        const supplement = [...jobs.values()]
          .filter((child) => child.parent?.id === baseline.id)
          .at(-1);
        const evidence: BindingEvidenceRequest = {
          version: 1,
          baseline: { id: baseline.id, sha256: parent!.measurementSha256 },
        };
        if (supplement) {
          const childFile = evidenceFile(supplement.id, "measurement.json");
          const child = childFile ? read(childFile) : null;
          if (
            supplement.state !== "complete" ||
            !childFile ||
            !supplementMatches(child?.parent, child?.sourceHashes)
          ) {
            json(res, 409, {
              error:
                "The latest supplemental source evidence is incomplete or changed; it cannot be silently omitted.",
            });
            return;
          }
          evidence.supplement = {
            id: supplement.id,
            sha256: fileHash(childFile),
          };
        }
        if (nativeMatch) nativeJobs.prepare(evidence);
        else if (visualMatch)
          candidateJobs.startVisual(evidence, request.retry === true);
        else if (candidateMatch)
          candidateJobs.start(evidence, request.retry === true);
        else bindingJobs.start(evidence, request.retry === true);
        json(res, 202, snapshotWithSupplement(baseline));
      } catch {
        json(res, 409, {
          error: nativeMatch
            ? "Native operation preparation is unavailable. It requires the current verified visual candidate; changed evidence and existing operation history cannot be replaced. No native execution was requested."
            : visualMatch
              ? "Visual candidate derivation could not start. A current verified source/runtime preparation is required; unavailable, changed or active evidence cannot be reused."
              : preparingCandidate
                ? "Source candidate preparation could not start. Complete a current binding trace for the fixed original evidence; unavailable, changed or active evidence cannot be prepared."
                : "Binding replay could not start. Its fixed original evidence is unavailable, changed, or another replay is active.",
        });
      }
      return;
    }
    const bindingImage =
      /^bindings\/([a-f0-9-]+)\/([a-z-]+)\/(replay\.png|probe-[0-2]-case-[0-2]-(?:before|after)\.png)$/i.exec(
        route,
      );
    if (req.method === "GET" && bindingImage) {
      const bytes = bindingJobs.image(
        bindingImage[1],
        bindingImage[2],
        bindingImage[3],
      );
      if (!bytes) {
        json(res, 404, {
          error:
            "Binding image is unavailable or its evidence no longer validates.",
        });
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.end(bytes);
      return;
    }
    if (req.method === "POST" && (!route || supplementalMatch)) {
      if (bindingJobs.running || candidateJobs.running) {
        json(res, 409, {
          error:
            "A source binding replay or candidate preparation is running. Wait before starting another capture.",
        });
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json")) {
        json(res, 415, { error: "JSON required." });
        return;
      }
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2048) throw new Error("Request too large.");
          chunks.push(Buffer.from(chunk));
        }
        const request = JSON.parse(Buffer.concat(chunks).toString());
        const origin = loopbackOrigin(request.origin);
        const baseline = supplementalMatch
          ? jobs.get(supplementalMatch[1])
          : undefined;
        let parent: ReferenceJob["parent"];
        if (supplementalMatch) {
          const file = baseline
            ? evidenceFile(baseline.id, "measurement.json")
            : null;
          parent = file
            ? { id: baseline!.id, measurementSha256: fileHash(file) }
            : undefined;
          if (
            !baseline ||
            baseline.parent ||
            baseline.state !== "complete" ||
            !parentMatches(parent)
          ) {
            json(res, 409, {
              error:
                "A complete unchanged baseline source record is required before supplementing states.",
            });
            return;
          }
          const existing = [...jobs.values()]
            .filter((job) => job.parent?.id === baseline.id)
            .at(-1);
          if (
            existing &&
            (existing.state === "running" ||
              (existing.state === "complete" &&
                (request.retry !== true ||
                  snapshot(existing).qualified ===
                    altitudeButtonVariants.length)))
          ) {
            json(res, 200, snapshotWithSupplement(baseline));
            return;
          }
        }
        if (
          active &&
          (active.job.parent?.id ?? null) !== (baseline?.id ?? null)
        ) {
          json(res, 409, {
            error:
              "Another source capture is already running. Its evidence is preserved; wait for that run to finish.",
          });
          return;
        }
        const selection: CohortId = baseline ? "button-variants" : "baseline";
        // Fail promptly when no source is connected instead of ten navigation timeouts.
        const response = await fetch(`${origin}/index.json`, {
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        });
        const index = (await response.json()) as {
          entries?: Record<string, unknown>;
        };
        if (
          !response.ok ||
          !cohort(selection).every((e) => index.entries?.[e.story])
        ) {
          json(res, 422, {
            error: "This Storybook does not expose the fixed Altitude cohort.",
          });
          return;
        }
        // Storybook preflight awaited network I/O. Re-check immediately before
        // launching: another request may have started a replay/preparation.
        if (bindingJobs.running || candidateJobs.running) {
          json(res, 409, {
            error:
              "A source binding replay or candidate preparation started during preflight. No capture was launched.",
          });
          return;
        }
        const job = start(origin, selection, parent);
        json(res, 202, snapshotWithSupplement(baseline ?? job));
      } catch {
        json(res, 400, {
          error:
            "Cannot connect. Use the running local Altitude Storybook origin; remote URLs and credentials are not accepted.",
        });
      }
      return;
    }
    if (req.method === "GET") {
      const [id, story, asset, ...extra] = route.split("/");
      const job = jobs.get(id);
      if (!job) {
        json(res, 404, {
          error:
            "Unknown or incomplete validation session. Completed compatible cohorts are recovered after restart; private evidence is preserved.",
        });
        return;
      }
      if (!story) {
        json(res, 200, snapshotWithSupplement(job));
        return;
      }
      if (
        !extra.length &&
        cohort(job.cohortId).some((entry) => entry.story === story) &&
        ["source.png", "replay.png"].includes(asset)
      ) {
        const file = evidenceFile(id, story, asset);
        if (file) {
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "no-store");
          res.end(readFileSync(file));
          return;
        }
      }
    }
    json(res, 404, { error: "Unknown source-reference resource." });
  }
  return {
    handle,
    close() {
      candidateJobs.close();
      bindingJobs.close();
      if (active) {
        active.job.state = "interrupted";
        active.child.kill("SIGTERM");
        active = undefined;
      }
    },
  };
}
