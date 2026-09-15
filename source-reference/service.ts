import { execFile, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { altitudeCohort, altitudeRevision } from "./altitude-cohort.js";

const stories = new Set(altitudeCohort.map((e) => e.story));
type RunState = "running" | "complete" | "failed" | "interrupted";
export interface ReferenceJob {
  id: string;
  origin: string;
  state: RunState;
  startedAt: string;
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
  function snapshot(job: ReferenceJob) {
    const dir = path.join(evidenceRoot, job.id);
    const final = read(path.join(dir, "measurement.json"));
    const rows = altitudeCohort.map(({ story, limitations }) => {
      const data = read(path.join(dir, story, "measurement.json"));
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
        compilerInput: data?.compilerInput
          ? {
              ...data.compilerInput,
              status: final?.sourceStable
                ? data.qualified
                  ? data.compilerInput.status
                  : "source-invalid"
                : "awaiting-source-integrity",
            }
          : null,
        sourceImage: existsSync(path.join(dir, story, "source.png"))
          ? `/api/source-reference/${job.id}/${story}/source.png`
          : null,
        replayImage: existsSync(path.join(dir, story, "replay.png"))
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
            "Unknown validation session. Reconnect after a server restart; existing private evidence is preserved.",
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
        const file = path.join(evidenceRoot, id, story, asset);
        if (existsSync(file)) {
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
