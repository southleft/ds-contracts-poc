/**
 * Observe runner for the canvas→code held-out exam v2.
 *
 *   tsx recipe/run-held-out-observe.ts --subject altitude-badge[,altitude-chip,…] [--port 9231] [--runs 2]
 *
 * The Desktop Bridge plugin already holds a WebSocket to the agent session's
 * MCP server, so this runner does NOT spawn a second server (a second one would
 * never see the file). Instead it opens a tiny HTTP receiver on localhost — a
 * port the bridge plugin's manifest allows the sandbox to fetch (9223..9232) —
 * SERVES each subject's observe program, and waits for every run to POST its
 * result back. The agent runs a ~400-byte bootstrap per (subject, run) through
 * `figma_execute`; the bootstrap fetches the program from this receiver,
 * evaluates it against `figma`, and posts the scene here. No transcription.
 *
 * Determinism and provenance, enforced before a byte is written:
 * - REST `version` + `lastModified` are pinned BEFORE the first run and AFTER
 *   the last; if they differ the observe refuses (FILE-MOVED-DURING-OBSERVE).
 * - every run's canonical scene must hash equal (OBSERVE-NONDETERMINISTIC).
 * - the program text is read-only by construction (`assertReadOnlyProgram`) and
 *   every run reports `writes: 0`.
 * - the bootstrap refuses a served program of the wrong byte length; the
 *   receiver records the program's sha256 and the exam's --check re-derives it
 *   from the manifest and refuses a mismatch.
 *
 * Output per subject: `<HELD_OUT_V2_ROOT>/<slug>/observe.json.gz` (canonical
 * JSON of the scene, gzip level 9, portable OS byte) and `observe-meta.json`.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/**
 * The bootstrap the agent runs through figma_execute: fetch the subject's
 * observe program from this receiver, evaluate it against `figma`, POST the
 * result back. It carries the program's byte length so a truncated or foreign
 * body is refused before evaluation.
 */
export function buildBootstrap(subject: HeldOutSubject, port: number, run: number): string {
  const program = buildHeldOutObserveProgram(subject);
  const base = `http://localhost:${port}`;
  const code = `const __u=${JSON.stringify(`${base}/program?subject=${subject.slug}`)};
const __src=await (await fetch(__u)).text();
if(__src.length!==${program.length})throw new Error("PROGRAM-LENGTH:"+__src.length);
const __result=await (new Function("figma","return (async()=>{"+__src+"\\n})()"))(figma);
const __body=JSON.stringify({slug:${JSON.stringify(subject.slug)},run:${run},result:__result});
const __res=await fetch(${JSON.stringify(`${base}/observe`)},{method:"POST",headers:{"content-type":"text/plain"},body:__body});
const __ack=await __res.json();
if(!__res.ok)throw new Error("RECEIVER:"+JSON.stringify(__ack));
return {posted:true,slug:${JSON.stringify(subject.slug)},run:${run},writes:__result.writes,variants:__result.variants,bytes:__body.length,sceneSha256:__ack.sceneSha256};`;
  assertReadOnlyProgram(code);
  return code;
}

interface ObserveResult {
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
}

interface ObserveRun {
  run: number;
  result: ObserveResult;
  receivedAt: string;
  sceneSha256: string;
}

async function main(): Promise<void> {
  const slugArg = arg("subject");
  if (!slugArg) throw new Error("--subject <slug>[,<slug>…] is required");
  const subjects = slugArg.split(",").map((s) => subjectBySlug(s.trim()));
  for (const subject of subjects)
    if (subject.absentOnCanvas)
      throw new Error(`${subject.slug} is marked absent on canvas — nothing to observe`);
  const port = Number(arg("port") ?? "9231");
  if (port < 9223 || port > 9232)
    throw new Error(`--port ${port} is outside the Desktop Bridge allowlist (9223..9232)`);
  const runsWanted = Number(arg("runs") ?? "2");
  if (!Number.isInteger(runsWanted) || runsWanted < 2)
    throw new Error("--runs must be an integer >= 2 (determinism needs two observes)");

  const fileKeys = [...new Set(subjects.map((s) => s.fileKey))];
  const pinsA = new Map<string, RestPin>();
  for (const fileKey of fileKeys) {
    const pin = await restPin(fileKey);
    const expected = subjects.find((s) => s.fileKey === fileKey)!.fileName;
    if (pin.name !== expected)
      throw new Error(`REST name ${JSON.stringify(pin.name)} != manifest ${JSON.stringify(expected)}`);
    pinsA.set(fileKey, pin);
  }

  const programs = new Map(subjects.map((s) => [s.slug, buildHeldOutObserveProgram(s)]));
  const runs = new Map<string, ObserveRun[]>(subjects.map((s) => [s.slug, []]));
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  const done = () => [...runs.values()].every((list) => list.length >= runsWanted);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    if (req.method === "GET" && url.pathname === "/program") {
      const slug = url.searchParams.get("subject") ?? "";
      const program = programs.get(slug);
      if (!program) {
        res.writeHead(404, cors).end();
        return;
      }
      res.writeHead(200, { ...cors, "content-type": "text/plain; charset=utf-8" });
      res.end(program);
      return;
    }
    if (req.method !== "POST" || url.pathname !== "/observe") {
      res.writeHead(404, cors).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          slug: string;
          run: number;
          result: ObserveResult;
        };
        const subject = subjects.find((s) => s.slug === payload.slug);
        if (!subject) throw new Error("UNKNOWN-SUBJECT:" + payload.slug);
        if (payload.result.writes !== 0) throw new Error("OBSERVE-REPORTED-WRITES");
        if (payload.result.fileKey !== subject.fileKey) throw new Error("WRONG-FILE");
        if (payload.result.setId !== subject.setNodeId) throw new Error("WRONG-SET");
        const sceneSha256 = sha256(`${canonicalJson(payload.result.scene)}\n`);
        runs.get(subject.slug)!.push({
          run: payload.run,
          result: payload.result,
          receivedAt: new Date().toISOString(),
          sceneSha256,
        });
        process.stderr.write(
          `${subject.slug} run ${payload.run}: ${payload.result.variants} variants, scene sha ${sceneSha256.slice(0, 16)}…\n`,
        );
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, sceneSha256 }));
      } catch (error) {
        res.writeHead(400, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(error) }));
      }
      if (done()) server.close();
    });
  });
  await new Promise<void>((resolve) => server.listen(port, resolve));

  process.stderr.write(
    `held-out observe: receiver on http://localhost:${port} for ${subjects.length} subject(s); ${runsWanted} runs each.\n` +
      [...pinsA.entries()].map(([k, p]) => `PIN-A ${k} version ${p.version} lastModified ${p.lastModified}`).join("\n") +
      "\nBootstraps (run each through figma_execute with the subject's fileKey):\n",
  );
  for (const subject of subjects)
    for (let run = 1; run <= runsWanted; run++) {
      const dir = path.resolve(REPO, HELD_OUT_V2_ROOT, subject.slug);
      mkdirSync(dir, { recursive: true });
      const bootstrap = buildBootstrap(subject, port, run);
      writeFileSync(path.join(dir, `observe-bootstrap-run${run}.js`), bootstrap);
      process.stderr.write(`--- ${subject.slug} run ${run} (fileKey ${subject.fileKey}) ---\n${bootstrap}\n`);
    }
  await new Promise<void>((resolve) => server.on("close", resolve));

  const pinsB = new Map<string, RestPin>();
  for (const fileKey of fileKeys) pinsB.set(fileKey, await restPin(fileKey));
  for (const fileKey of fileKeys) {
    const a = pinsA.get(fileKey)!;
    const b = pinsB.get(fileKey)!;
    if (a.version !== b.version || a.lastModified !== b.lastModified)
      throw new Error(
        `FILE-MOVED-DURING-OBSERVE ${fileKey}: ${a.version}/${a.lastModified} -> ${b.version}/${b.lastModified}; nothing written`,
      );
  }
  let refusals = 0;
  for (const subject of subjects) {
    const list = runs.get(subject.slug)!;
    const hashes = new Set(list.map((r) => r.sceneSha256));
    const dir = path.resolve(REPO, HELD_OUT_V2_ROOT, subject.slug);
    if (hashes.size !== 1) {
      // A subject whose two observes disagree is a RESULT, not a batch failure:
      // keep both scenes for the diff, write no observe, and let the exam record
      // it as refused at the observe stage. Other subjects are unaffected.
      for (const r of list)
        writeFileSync(path.join(dir, `nondeterministic-run${r.run}.json`), `${canonicalJson(r.result.scene)}\n`);
      const refusal = {
        stage: "observe",
        code: "OBSERVE-NONDETERMINISTIC",
        message: `two consecutive read-only observes of ${subject.setName} ${subject.setNodeId} at file version ${pinsA.get(subject.fileKey)!.version} produced different scenes (${[...hashes].map((h) => h.slice(0, 16)).join(" != ")}); both kept as nondeterministic-run{1,2}.json; no observe written`,
        runs: list.map((r) => ({ run: r.run, receivedAt: r.receivedAt, sceneSha256: r.sceneSha256 })),
        fileVersion: pinsA.get(subject.fileKey)!.version,
      };
      writeFileSync(path.join(dir, "observe-refusal.json"), `${canonicalJson(refusal)}\n`);
      for (const stale of ["observe.json.gz", "observe-meta.json"])
        if (existsSync(path.join(dir, stale))) rmSync(path.join(dir, stale));
      process.stderr.write(`${subject.slug}: OBSERVE-NONDETERMINISTIC — recorded as a refusal, both runs kept\n`);
      refusals += 1;
      continue;
    }
    if (existsSync(path.join(dir, "observe-refusal.json"))) rmSync(path.join(dir, "observe-refusal.json"));
    const first = list[0]!;
    const sceneJson = `${canonicalJson(first.result.scene)}\n`;
    const gz = portableGzipSync(Buffer.from(sceneJson, "utf8"), { level: 9 });
    writeFileSync(path.join(dir, "observe.json.gz"), gz);
    const pinA = pinsA.get(subject.fileKey)!;
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
      rest: { before: pinA, after: pinsB.get(subject.fileKey)! },
      fileVersion: pinA.version,
      fileLastModified: pinA.lastModified,
      observeSha256: sha256(gz),
      observeUncompressedSha256: first.sceneSha256,
      programSha256: sha256(programs.get(subject.slug)!),
      doubleObserve: {
        runs: list.map((r) => ({ run: r.run, receivedAt: r.receivedAt, sceneSha256: r.sceneSha256 })),
        identical: true,
      },
      figmaWrites: 0,
      transport:
        "figma_execute bootstrap via the agent session's Desktop Bridge; program served by and result POSTed to a loopback receiver; no transcription",
    };
    writeFileSync(path.join(dir, "observe-meta.json"), `${canonicalJson(meta)}\n`);
    process.stderr.write(
      `wrote ${path.relative(REPO, dir)}/observe.json.gz (${gz.byteLength} bytes, sha ${meta.observeSha256.slice(0, 16)}…) + observe-meta.json\n`,
    );
  }
  process.stderr.write(`done: ${subjects.length - refusals} observed, ${refusals} refused (nondeterministic)\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
