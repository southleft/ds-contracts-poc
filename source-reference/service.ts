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
import type { IncomingMessage, ServerResponse } from "node:http";
import { altitudeCohort, altitudeRevision } from "./altitude-cohort.js";

const stories = new Set(altitudeCohort.map((e) => e.story));
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

/** Dev-only service. No remote files, shell interpolation, Figma writes, HAR
 * downloads or owner grades. Request values cannot choose a script or checkout. */
export function createReferenceService(repoRoot: string, launch?: Launch) {
  const evidenceRoot = path.join(repoRoot, "private", "source-reference-app");
  const checkout = path.resolve(repoRoot, "..", "altitude");
  const jobs = new Map<string, ReferenceJob>();
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
        if (
          !object(final) ||
          final.sourceRevision !== altitudeRevision ||
          typeof final.sourceStable !== "boolean" ||
          final.denominator !== altitudeCohort.length ||
          typeof final.recordedAt !== "string" ||
          !Number.isFinite(Date.parse(final.recordedAt)) ||
          new Date(final.recordedAt).toISOString() !== final.recordedAt ||
          !Array.isArray(final.rows) ||
          final.rows.length !== altitudeCohort.length ||
          !final.rows.every(validRow) ||
          new Set(final.rows.map((row) => row.story)).size !== stories.size
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
  for (const job of recovered) jobs.set(job.id, job);
  function snapshot(job: ReferenceJob) {
    const finalFile = evidenceFile(job.id, "measurement.json");
    const final = finalFile ? read(finalFile) : null;
    const rows = altitudeCohort.map(({ story, limitations }) => {
      const rowFile = evidenceFile(job.id, story, "measurement.json");
      const data = rowFile ? read(rowFile) : null;
      const problems = [
        ...new Set<string>([
          ...(data?.source?.problems ?? []),
          ...(data?.replay?.problems ?? []),
          ...(data?.error ? [data.error] : []),
        ]),
      ];
      if (final?.sourceStable === false)
        problems.push("source-changed-during-capture");
      return {
        story,
        limitations,
        status: !data
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
                final?.sourceStable === false
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
                final?.sourceStable === false
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
      denominator: altitudeCohort.length,
      qualified: rows.filter((r) => r.status === "valid").length,
      sourceStable: final?.sourceStable ?? null,
      rows,
      fidelity: "not measured",
      usability: "not qualified",
      workflow: "source validation only",
    };
  }
  function start(origin: string) {
    if (active) return active.job;
    mkdirSync(evidenceRoot, { recursive: true });
    const job: ReferenceJob = {
      id: randomUUID(),
      origin,
      state: "running",
      startedAt: new Date().toISOString(),
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
      ],
      (error) => {
        if (job.state !== "interrupted") {
          const final = read(path.join(output, "measurement.json"));
          // Exit 1 with a complete measurement is an honest refusal, not lost work.
          job.state =
            final?.rows?.length === altitudeCohort.length
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
    if (req.headers.origin && req.headers.origin !== host.origin) {
      json(res, 403, { error: "Same-origin access required." });
      return;
    }
    const route = (req.url ?? "")
      .split("?")[0]
      .replace(/^\/api\/source-reference\/?/, "");
    if (req.method === "GET" && !route) {
      json(res, 200, {
        adapter: "Altitude Web Components",
        sourceRevision: altitudeRevision,
        defaultOrigin: "http://127.0.0.1:6017",
        checkoutAvailable: existsSync(
          path.join(checkout, "libs/al-web-components/.storybook/preview.ts"),
        ),
        latest: [...jobs.values()].at(-1)
          ? snapshot([...jobs.values()].at(-1)!)
          : null,
      });
      return;
    }
    if (req.method === "POST" && !route) {
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
        const origin = loopbackOrigin(
          JSON.parse(Buffer.concat(chunks).toString()).origin,
        );
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
          !altitudeCohort.every((e) => index.entries?.[e.story])
        ) {
          json(res, 422, {
            error: "This Storybook does not expose the fixed Altitude cohort.",
          });
          return;
        }
        json(res, 202, snapshot(start(origin)));
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
        json(res, 200, snapshot(job));
        return;
      }
      if (
        !extra.length &&
        stories.has(story) &&
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
      if (active) {
        active.job.state = "interrupted";
        active.child.kill("SIGTERM");
        active = undefined;
      }
    },
  };
}
