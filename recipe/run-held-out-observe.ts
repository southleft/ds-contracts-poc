/**
 * Observe runner for the canvas→code held-out exam v2.
 *
 *   tsx recipe/run-held-out-observe.ts --subject altitude-badge [--port 9231] [--runs 2]
 *
 * The port MUST be one the Desktop Bridge manifest allows the sandbox to fetch
 * (http://localhost:9223 … 9232); any other port fails with "Failed to fetch".
 *
 * The Desktop Bridge plugin already holds a WebSocket to the agent session's
 * MCP server, so this runner does NOT spawn a second server (a second one would
 * never see the file). Instead it opens a tiny HTTP receiver on localhost —
 * which the bridge plugin's manifest allows the sandbox to fetch — prints the
 * observe program the agent must run through `figma_execute` (`--runs` times),
 * and waits for each run to POST its result here.
 *
 * Determinism and provenance, enforced before a byte is written:
 * - REST `version` + `lastModified` are pinned BEFORE the first run and AFTER
 *   the last; if they differ the observe refuses (FILE-MOVED-DURING-OBSERVE).
 * - every run's canonical scene must hash equal (OBSERVE-NONDETERMINISTIC).
 * - the program text is read-only by construction (`assertReadOnlyProgram`) and
 *   every run reports `writes: 0`.
 *
 * Output: `<HELD_OUT_V2_ROOT>/<slug>/observe.json.gz` (canonical JSON of the
 * scene, gzip level 9, portable OS byte) and `observe-meta.json`.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { canonicalJson } from "./normalize.js";
import { portableGzipSync } from "./portable-gzip.js";
import {
  HELD_OUT_V2_ROOT,
  HELD_OUT_V2_VERSION,
  subjectBySlug,
  type HeldOutSubject,
} from "./canvas-to-code-held-out-v2-manifest.js";
import {
  assertReadOnlyProgram,
  buildHeldOutObserveProgram,
} from "./held-out-observe-program.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
};

interface RestPin {
  version: string;
  lastModified: string;
  name: string;
  fetchedAt: string;
}

const figmaToken = (): string => {
  const fromEnv = process.env.FIGMA_TOKEN;
  if (fromEnv) return fromEnv;
  const envPath = path.resolve(REPO, ".env.local");
  if (!existsSync(envPath))
    throw new Error("FIGMA_TOKEN is not set and .env.local is absent");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*FIGMA_TOKEN\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("FIGMA_TOKEN not found in .env.local");
};

async function restPin(fileKey: string): Promise<RestPin> {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
    headers: { "X-Figma-Token": figmaToken() },
  });
  if (!res.ok) throw new Error(`REST pin failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as {
    version?: string;
    lastModified?: string;
    name?: string;
  };
  if (!body.version || !body.lastModified || !body.name)
    throw new Error("REST pin response lacks version/lastModified/name");
  return {
    version: body.version,
    lastModified: body.lastModified,
    name: body.name,
    fetchedAt: new Date().toISOString(),
  };
}

/** The program the agent runs: the observe, then a POST of its result to this runner. */
export function buildPostingProgram(subject: HeldOutSubject, port: number, run: number): string {
  const observe = buildHeldOutObserveProgram(subject);
  const code = `const __observe=async()=>{${observe}\n};
const __result=await __observe();
const __body=JSON.stringify({run:${run},result:__result});
const __res=await fetch(${JSON.stringify(`http://localhost:${port}/observe`)},{method:"POST",headers:{"content-type":"text/plain"},body:__body});
const __ack=await __res.json();
return {posted:__res.ok,run:${run},writes:__result.writes,variants:__result.variants,bytes:__body.length,sceneSha256:__ack.sceneSha256};`;
  assertReadOnlyProgram(code);
  return code;
}

interface ObserveRun {
  run: number;
  result: {
    writes: number;
    fileKey: string;
    rootName: string;
    pageId: string;
    pageName: string;
    setId: string;
    setName: string;
    variants: number;
    propertyDefinitions: Record<string, unknown>;
    scene: unknown;
  };
  receivedAt: string;
  sceneSha256: string;
}

async function main(): Promise<void> {
  const slug = arg("subject");
  if (!slug) throw new Error("--subject <slug> is required");
  const subject = subjectBySlug(slug);
  const port = Number(arg("port") ?? "9231");
  if (port < 9223 || port > 9232)
    throw new Error(`--port ${port} is outside the Desktop Bridge allowlist (9223..9232)`);
  const runsWanted = Number(arg("runs") ?? "2");
  if (!Number.isInteger(runsWanted) || runsWanted < 2)
    throw new Error("--runs must be an integer >= 2 (determinism needs two observes)");

  const pinA = await restPin(subject.fileKey);
  if (pinA.name !== subject.fileName)
    throw new Error(`REST name ${JSON.stringify(pinA.name)} != manifest ${JSON.stringify(subject.fileName)}`);

  const programs = Array.from({ length: runsWanted }, (_, i) =>
    buildPostingProgram(subject, port, i + 1),
  );
  const outDir = path.resolve(REPO, HELD_OUT_V2_ROOT, subject.slug);
  mkdirSync(outDir, { recursive: true });
  for (const [i, program] of programs.entries())
    writeFileSync(path.join(outDir, `observe-program-run${i + 1}.js`), program);

  const runs: ObserveRun[] = [];
  // The plugin sandbox fetches from an opaque origin: answer the CORS preflight
  // and allow any origin (the receiver is loopback-only and lives for one observe).
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  const server = createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    if (req.method !== "POST" || req.url !== "/observe") {
      res.writeHead(404, cors).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          run: number;
          result: ObserveRun["result"];
        };
        if (payload.result.writes !== 0) throw new Error("OBSERVE-REPORTED-WRITES");
        if (payload.result.fileKey !== subject.fileKey) throw new Error("WRONG-FILE");
        if (payload.result.setId !== subject.setNodeId) throw new Error("WRONG-SET");
        const sceneSha256 = sha256(`${canonicalJson(payload.result.scene)}\n`);
        runs.push({
          run: payload.run,
          result: payload.result,
          receivedAt: new Date().toISOString(),
          sceneSha256,
        });
        process.stderr.write(
          `run ${payload.run}: ${payload.result.variants} variants, scene sha ${sceneSha256.slice(0, 16)}…\n`,
        );
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, sceneSha256 }));
      } catch (error) {
        res.writeHead(400, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(error) }));
      }
      if (runs.length >= runsWanted) server.close();
    });
  });
  await new Promise<void>((resolve) => server.listen(port, resolve)); // all loopback families: localhost may resolve to ::1 in the sandbox
  process.stderr.write(
    `held-out observe: receiver on http://localhost:${port}/observe for ${subject.slug} (${subject.fileName} · ${subject.setName} ${subject.setNodeId}).\n` +
      `Run each program in ${path.relative(REPO, outDir)}/observe-program-run{1..${runsWanted}}.js through figma_execute with fileKey ${subject.fileKey}.\n` +
      `PIN-A version ${pinA.version} lastModified ${pinA.lastModified}\n`,
  );
  await new Promise<void>((resolve) => server.on("close", resolve));

  const pinB = await restPin(subject.fileKey);
  if (pinA.version !== pinB.version || pinA.lastModified !== pinB.lastModified)
    throw new Error(
      `FILE-MOVED-DURING-OBSERVE: ${pinA.version}/${pinA.lastModified} -> ${pinB.version}/${pinB.lastModified}; nothing written`,
    );
  const hashes = new Set(runs.map((r) => r.sceneSha256));
  if (hashes.size !== 1)
    throw new Error(`OBSERVE-NONDETERMINISTIC: ${[...hashes].join(" != ")}; nothing written`);

  const first = runs[0];
  const sceneJson = `${canonicalJson(first.result.scene)}\n`;
  const gz = portableGzipSync(Buffer.from(sceneJson, "utf8"), { level: 9 });
  const observePath = path.join(outDir, "observe.json.gz");
  writeFileSync(observePath, gz);
  const meta = {
    artifactVersion: HELD_OUT_V2_VERSION,
    subject: subject.slug,
    fileKey: subject.fileKey,
    fileName: subject.fileName,
    pageId: first.result.pageId,
    pageName: first.result.pageName,
    setNodeId: first.result.setId,
    setName: first.result.setName,
    variants: first.result.variants,
    propertyDefinitions: first.result.propertyDefinitions,
    provenance: subject.provenance,
    publishedSetNodeId: subject.publishedSetNodeId ?? null,
    rest: { before: pinA, after: pinB },
    fileVersion: pinA.version,
    fileLastModified: pinA.lastModified,
    observeSha256: sha256(gz),
    observeUncompressedSha256: first.sceneSha256,
    programSha256: sha256(buildHeldOutObserveProgram(subject)),
    doubleObserve: {
      runs: runs.map((r) => ({ run: r.run, receivedAt: r.receivedAt, sceneSha256: r.sceneSha256 })),
      identical: true,
    },
    figmaWrites: 0,
    transport: "figma_execute via the agent session's Desktop Bridge; result POSTed to a localhost receiver; no transcription",
  };
  writeFileSync(path.join(outDir, "observe-meta.json"), `${canonicalJson(meta)}\n`);
  process.stderr.write(
    `wrote ${path.relative(REPO, observePath)} (${gz.byteLength} bytes, sha ${meta.observeSha256.slice(0, 16)}…) and observe-meta.json; file version ${pinA.version} unchanged across the observe.\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
