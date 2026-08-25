/**
 * FIRST-PASS EXAM — the two runners.
 *
 * `extract/figma/census/first-pass.ts` owns the vocabulary, the packets, the
 * receipt and the ratchet. This file owns the two chains themselves, and it
 * obeys one rule above all others: **every stage runs ONCE**. There is no
 * retry parameter, no repair branch and no fallback that quietly substitutes a
 * different input. A stage that does not return ok stops that set's chain, is
 * recorded with the engine's exact words, and the harness moves to the next
 * set.
 *
 * A stage is a DOCUMENTED command wherever one exists — the runner shells out
 * to the same `npx tsx …` line docs/21 and docs/29 tell a user to type, so the
 * exam cannot pass through a private code path a real user has no access to.
 * The two in-process stages are `validate` (the referee, `validateContract`,
 * which has no CLI verb of its own — docs/07) and `render`/`ref` (screenshots).
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { chromiumExecutable } from "../visual-parity/render.js";
import { figmaToken } from "../visual-parity/env.js";
import {
  ContractSchema,
  type Contract,
} from "../../../scripts/contract-schema.js";
import { validateContract } from "../../../core/emit-react.js";
import { REPO } from "./corpus.js";
import {
  CELL_CAP,
  FORBIDDEN_FILE_KEYS,
  SCRATCH_FILE_KEY,
  artifactOf,
  classify,
  clearPacketImages,
  headSha,
  makeShadowRoot,
  packetDir,
  refusalMessage,
  runOnce,
  slugify,
  stableJson,
  today,
  writeAttempt,
  writeManifest,
  type AbsentImage,
  type CanvasToCodeExam,
  type CodeToCanvasExam,
  type ExamManifest,
  type SetAttempt,
  type StageRecord,
  type StageStatus,
} from "./first-pass.js";

const TSX = path.join(REPO, "node_modules", ".bin", "tsx");

interface Chain {
  set: string;
  id: string | null;
  source: Record<string, string | number | null>;
  stages: StageRecord[];
  stopped: boolean;
}

const newChain = (set: string, source: Chain["source"]): Chain => ({
  set,
  id: null,
  source,
  stages: [],
  stopped: false,
});

/** Record one stage. Returns true when the chain may continue. A chain that
 *  has already stopped records every remaining stage as SKIPPED — an omitted
 *  stage would read as "not applicable", which is a different claim. */
function record(
  c: Chain,
  stage: string,
  status: StageStatus,
  ms: number,
  command: string | null,
  message: string,
  artifacts: StageRecord["artifacts"] = [],
): boolean {
  c.stages.push({ stage, status, ms, command, message, artifacts });
  if (status !== "ok") c.stopped = true;
  return status === "ok";
}

function skipRest(c: Chain, stages: string[]): void {
  for (const s of stages) {
    if (c.stages.some((x) => x.stage === s)) continue;
    c.stages.push({
      stage: s,
      status: "SKIPPED",
      ms: 0,
      command: null,
      message: `an earlier stage stopped this chain (${c.stages.find((x) => x.status !== "ok" && x.status !== "SKIPPED")?.stage ?? "?"})`,
      artifacts: [],
    });
  }
}

function finish(
  exam: string,
  direction: SetAttempt["direction"],
  c: Chain,
  images: SetAttempt["images"],
): SetAttempt {
  const stop =
    c.stages.find((s) => s.status !== "ok" && s.status !== "SKIPPED") ?? null;
  return {
    exam,
    direction,
    set: c.set,
    id: c.id,
    source: c.source,
    stages: c.stages,
    chainComplete: c.stages.every((s) => s.status === "ok"),
    firstStop: stop
      ? { stage: stop.stage, status: stop.status, message: stop.message }
      : null,
    images,
    totalMs: c.stages.reduce((n, s) => n + s.ms, 0),
  };
}

const emptyImages = (): SetAttempt["images"] => ({
  ref: [],
  code: [],
  canvas: [],
  absent: [],
});

function copyImage(
  from: string,
  exam: string,
  set: string,
  name: string,
): string {
  const dir = packetDir(exam, set);
  mkdirSync(dir, { recursive: true });
  const to = path.join(dir, name);
  writeFileSync(to, readFileSync(from));
  return path.relative(REPO, to);
}

// ---------------------------------------------------------------------------
// The canvas bridge — probed, never assumed
// ---------------------------------------------------------------------------

/**
 * `--mint` drives the figma-console bridge. A Node process reaches that bridge
 * only if a COMMAND endpoint answers: the local server speaks MCP over stdio to
 * its client and WebSocket to plugin clients, and neither of those accepts a
 * command from here. This probe looks for one on the documented port range and
 * reports what it found. It never guesses, and it never opens a socket to a
 * file key it has not asserted first.
 */
export function probeBridge(): { available: boolean; message: string } {
  const ports: number[] = [];
  for (let p = 9223; p <= 9232; p++) ports.push(p);
  const seen: string[] = [];
  for (const p of ports) {
    try {
      const out = execFileSync(
        "curl",
        [
          "-s",
          "-m",
          "2",
          "-o",
          "/dev/null",
          "-w",
          "%{http_code}",
          `http://127.0.0.1:${p}/health`,
        ],
        { encoding: "utf8" },
      ).trim();
      if (out !== "000") seen.push(`${p}:${out}`);
    } catch {
      /* a closed port is not an error */
    }
  }
  return {
    available: false,
    message:
      `no figma-console COMMAND endpoint answered on 127.0.0.1:9223-9232 ` +
      `(probed /health: ${seen.length > 0 ? seen.join(", ") : "nothing answered"}). ` +
      `The local bridge serves MCP over stdio to its own client and WebSocket to plugin clients; ` +
      `a Node process cannot issue a canvas write through either. Bundle produced, mint pending — ` +
      `the emitted script carries the WRONG-FILE guard on ${SCRATCH_FILE_KEY} and is the runnable artifact.`,
  };
}

/** Assert the emitted bytes will only ever write to the scratch file. */
export function assertFileKeyGuard(js: string, file: string): string | null {
  const guard = `const EXPECTED_FILE_KEY = ${JSON.stringify(SCRATCH_FILE_KEY)};`;
  if (!js.includes(guard))
    return `${file}: the emitted script does not carry the WRONG-FILE guard on ${SCRATCH_FILE_KEY} — refusing to call it mintable`;
  for (const k of FORBIDDEN_FILE_KEYS)
    if (js.includes(k))
      return `${file}: the emitted script names the forbidden file key ${k}`;
  return null;
}

// ---------------------------------------------------------------------------
// Direction A — code → canvas
// ---------------------------------------------------------------------------

const A_STAGES = [
  "capture",
  "promote",
  "validate",
  "generate",
  "bundle",
  "mint",
];

interface LibManifest {
  library: string;
  exampleDir: string;
  captureOut: string;
  dtcg: string;
  mintedOut: string;
  mintedDoc: string;
  components: string[];
  emit: { out: string; icons: string };
  bundle: { out: string; name: string; modes?: string[] };
}

/** The icon map `generate` builds from --icons. The referee needs the SAME map
 *  the emitter will get, or it refuses an asset that is on disk. */
function loadIcons(dir: string): Map<string, string> {
  try {
    return new Map(
      readdirSync(dir)
        .filter((f) => f.endsWith(".svg"))
        .map((f) => [
          f.replace(/\.svg$/, ""),
          readFileSync(path.join(dir, f), "utf8").trim(),
        ]),
    );
  } catch {
    return new Map();
  }
}

export async function runCodeToCanvas(
  def: CodeToCanvasExam,
  opts: { mint: boolean; work: string },
): Promise<{ manifest: ExamManifest; attempts: SetAttempt[] }> {
  const lib = JSON.parse(
    readFileSync(path.join(REPO, def.manifest), "utf8"),
  ) as LibManifest;

  // The shadow root. Everything the chain WRITES is a private copy; everything
  // it READS is a symlink to the checkout. Then the OUTPUTS are emptied — an
  // exam that inherits committed contracts is measuring nothing.
  const root = makeShadowRoot(opts.work, [
    lib.captureOut,
    `${lib.exampleDir}/contracts`,
    `${lib.exampleDir}/tokens`,
    lib.emit.out,
    lib.emit.icons,
    "extract/computed/configs",
  ]);
  const wipe = (
    rel: string,
    keep: (f: string) => boolean = () => false,
  ): void => {
    const dir = path.join(root, rel);
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir))
      if (!keep(f)) rmSync(path.join(dir, f), { recursive: true, force: true });
  };
  wipe(lib.captureOut);
  wipe(`${lib.exampleDir}/contracts`);
  wipe(lib.emit.out);
  // tokens/ holds the library's OWN DTCG (an INPUT — the library's token
  // export, docs/21 §2.2) beside the minted tree and MINTED.md, which are
  // promote's OUTPUTS. Only the outputs go.
  for (const out of [lib.mintedOut, lib.mintedDoc])
    rmSync(path.join(root, out), { force: true });

  // THE FIRST-EVER STATE, reproduced faithfully. `capture` reads
  // `tokens.minted` and refuses a declared path that does not exist, and
  // refuses a ZERO-LEAF tree unless the config declares
  // `"mintedBootstrap": true` — which docs/20 §"the ordering guard" names as
  // the recipe for "a library's genuine FIRST-EVER pass". A library nobody has
  // captured has no minted tree, so that is the state an exam must start from;
  // starting from the committed tree would let the exam inherit the product of
  // an earlier heal loop and measure nothing.
  writeFileSync(path.join(root, lib.mintedOut), "{}\n");
  const shadowConfig = path.join(root, def.captureConfig);
  const cfgJson = JSON.parse(readFileSync(shadowConfig, "utf8")) as Record<
    string,
    unknown
  >;
  (cfgJson.tokens as Record<string, unknown>).mintedBootstrap = true;
  cfgJson["__note:first-pass-exam"] =
    "mintedBootstrap set by the first-pass exam in its shadow root ONLY — the committed config is untouched. See docs/31.";
  writeFileSync(shadowConfig, JSON.stringify(cfgJson, null, 2) + "\n");

  const chains = new Map<string, Chain>();
  const outDir = path.join(root, lib.captureOut);

  // ---- capture, once per set -------------------------------------------
  for (const set of def.sets) {
    const c = newChain(set, {
      library: def.library,
      config: def.captureConfig,
    });
    chains.set(set, c);
    const args = [
      "extract/computed/run.ts",
      "--root",
      root,
      "--harness",
      path.join(root, def.harness),
      "--config",
      path.join(root, def.captureConfig),
      "--component",
      set,
      "--out",
      outDir,
      "--keep-originals",
    ];
    const r = runOnce(TSX, args, { cwd: root });
    const compDir = path.join(outDir, set.toLowerCase());
    const arts = [
      "enriched.contract.json",
      "scorecard.json",
      "captured-truth.json",
    ]
      .map((f) => path.join(compDir, f))
      .filter(existsSync)
      .map((f) => artifactOf(f, false));
    record(
      c,
      "capture",
      r.ok ? "ok" : classify(r),
      r.ms,
      `npx tsx extract/computed/run.ts --harness ${def.harness} --config ${def.captureConfig} --component ${set} --out ${lib.captureOut} --keep-originals`,
      r.ok ? `${arts.length} artifact(s)` : refusalMessage(r),
      arts,
    );
  }

  // ---- promote, once for the library -----------------------------------
  const promoteCmd = `npx tsx packages/cli/src/cli.ts promote --config ${def.manifest}`;
  const pr = runOnce(
    TSX,
    [
      "packages/cli/src/cli.ts",
      "promote",
      "--config",
      def.manifest,
      "--root",
      root,
    ],
    { cwd: root },
  );
  for (const [set, c] of chains) {
    if (c.stopped) continue;
    const stem = set.toLowerCase();
    const cp = path.join(
      root,
      lib.exampleDir,
      "contracts",
      `${stem}.contract.json`,
    );
    const made = existsSync(cp);
    record(
      c,
      "promote",
      pr.ok && made ? "ok" : pr.ok ? "ERROR" : classify(pr),
      pr.ms,
      promoteCmd,
      pr.ok && made
        ? `${path.relative(root, cp)}`
        : pr.ok
          ? `promote exited 0 but wrote no ${stem}.contract.json`
          : refusalMessage(pr),
      made ? [artifactOf(cp, false)] : [],
    );
    if (made)
      c.id = (JSON.parse(readFileSync(cp, "utf8")) as { id: string }).id;
  }

  // ---- validate (the referee, in process) + generate --------------------
  // The CANONICAL token layer list, exactly as `ds-contracts onboard --continue`
  // builds it: the library's own DTCG, then the tree promote just minted.
  const tokenArgs = [lib.dtcg, lib.mintedOut]
    .map((f) => path.join(root, f))
    .join(",");
  const iconsDir = path.join(root, lib.emit.icons);
  const icons = loadIcons(iconsDir);
  const byId = new Map<string, Contract>();
  for (const [, c] of chains) {
    if (c.stopped) continue;
    const cp = path.join(
      root,
      lib.exampleDir,
      "contracts",
      `${c.set.toLowerCase()}.contract.json`,
    );
    try {
      const parsed = ContractSchema.parse(JSON.parse(readFileSync(cp, "utf8")));
      byId.set(parsed.id, parsed);
    } catch {
      /* the validate stage below records it by name */
    }
  }
  for (const [set, c] of chains) {
    if (c.stopped) continue;
    const cp = path.join(
      root,
      lib.exampleDir,
      "contracts",
      `${set.toLowerCase()}.contract.json`,
    );
    const t0 = Date.now();
    const errors: string[] = [];
    try {
      const parsed = ContractSchema.parse(JSON.parse(readFileSync(cp, "utf8")));
      validateContract(parsed, byId, errors, icons);
    } catch (e) {
      errors.push(String((e as Error).message ?? e));
    }
    if (
      !record(
        c,
        "validate",
        errors.length === 0 ? "ok" : "REFUSED",
        Date.now() - t0,
        "core/emit-react.ts validateContract (the referee — no CLI verb; docs/07)",
        errors.length === 0 ? "no violations" : errors.join("\n"),
      )
    )
      continue;

    const gOut = path.join(opts.work, "generated", slugify(set));
    const gr = runOnce(
      TSX,
      [
        "packages/cli/src/cli.ts",
        "generate",
        cp,
        "--out",
        gOut,
        "--tokens",
        tokenArgs,
        "--icons",
        iconsDir,
        "--stories",
      ],
      { cwd: root },
    );
    const gen = existsSync(gOut)
      ? readdirSync(gOut, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => path.join(e.parentPath ?? gOut, e.name))
      : [];
    record(
      c,
      "generate",
      gr.ok && gen.length > 0 ? "ok" : gr.ok ? "ERROR" : classify(gr),
      gr.ms,
      `npx ds-contracts generate ${path.relative(root, cp)} --out <out> --tokens <dtcg>,<minted> --icons ${lib.emit.icons} --stories`,
      gr.ok && gen.length > 0
        ? `${gen.length} file(s)`
        : gr.ok
          ? "generate exited 0 and wrote nothing"
          : refusalMessage(gr),
      gen.map((f) => artifactOf(f, false)),
    );
  }

  // ---- bundle, once for the library ------------------------------------
  const contractsDir = path.join(root, lib.exampleDir, "contracts");
  const figmaOut = path.join(root, lib.emit.out);
  const emitCmd = `npx ds-contracts figma ${lib.exampleDir}/contracts --out ${lib.emit.out} --tokens <dtcg>,<minted>`;
  const er = runOnce(
    TSX,
    [
      "packages/cli/src/cli.ts",
      "figma",
      contractsDir,
      "--out",
      figmaOut,
      "--tokens",
      tokenArgs,
      "--icons",
      iconsDir,
    ],
    { cwd: root },
  );
  const bundlePath = path.join(root, lib.bundle.out);
  const br = er.ok
    ? runOnce(
        TSX,
        [
          "packages/cli/src/cli.ts",
          "figma",
          "bundle",
          contractsDir,
          "--tokens",
          tokenArgs,
          ...(lib.bundle.modes?.length
            ? [
                "--modes",
                lib.bundle.modes.map((f) => path.join(root, f)).join(","),
              ]
            : []),
          "--name",
          lib.bundle.name,
          "--icons",
          iconsDir,
          "--out",
          bundlePath,
        ],
        { cwd: root },
      )
    : null;
  const scriptFor = (id: string): string | null => {
    if (!existsSync(figmaOut)) return null;
    for (const f of readdirSync(figmaOut).sort()) {
      if (!f.endsWith(".figma.js")) continue;
      const p = path.join(figmaOut, f);
      if (readFileSync(p, "utf8").includes(`"${id}"`)) return p;
    }
    return null;
  };
  for (const [, c] of chains) {
    if (c.stopped) continue;
    const script = c.id ? scriptFor(c.id) : null;
    const okBundle =
      er.ok && br?.ok === true && existsSync(bundlePath) && script !== null;
    const arts: StageRecord["artifacts"] = [];
    if (script) arts.push(artifactOf(script, false));
    if (existsSync(bundlePath)) arts.push(artifactOf(bundlePath, false));
    record(
      c,
      "bundle",
      okBundle
        ? "ok"
        : !er.ok
          ? classify(er)
          : br && !br.ok
            ? classify(br)
            : "ERROR",
      er.ms + (br?.ms ?? 0),
      `${emitCmd} && npx ds-contracts figma bundle ${lib.exampleDir}/contracts --name ${lib.bundle.name} --out ${lib.bundle.out}`,
      okBundle
        ? `${path.basename(script!)} + ${path.basename(bundlePath)}`
        : !er.ok
          ? refusalMessage(er)
          : br && !br.ok
            ? refusalMessage(br)
            : `emit exited 0 but produced no .figma.js carrying ${c.id ?? "the contract id"}`,
      arts,
    );
  }

  // ---- mint -------------------------------------------------------------
  const mintDir = path.join(opts.work, "mint");
  const mr = runOnce(
    TSX,
    [
      "packages/cli/src/cli.ts",
      "figma",
      contractsDir,
      "--out",
      mintDir,
      "--tokens",
      tokenArgs,
      "--icons",
      iconsDir,
      "--file-key",
      SCRATCH_FILE_KEY,
    ],
    { cwd: root },
  );
  const bridge = opts.mint
    ? probeBridge()
    : {
        available: false,
        message:
          "--mint was not requested; the exam stops at the runnable script by design",
      };
  const mintScriptFor = (id: string): string | null => {
    if (!existsSync(mintDir)) return null;
    for (const f of readdirSync(mintDir).sort()) {
      if (!f.endsWith(".figma.js")) continue;
      const p = path.join(mintDir, f);
      if (readFileSync(p, "utf8").includes(`"${id}"`)) return p;
    }
    return null;
  };
  for (const [, c] of chains) {
    if (c.stopped) continue;
    const script = c.id ? mintScriptFor(c.id) : null;
    if (!mr.ok || !script) {
      record(
        c,
        "mint",
        mr.ok ? "ERROR" : classify(mr),
        mr.ms,
        `npx ds-contracts figma ${lib.exampleDir}/contracts --out <scratch> --file-key ${SCRATCH_FILE_KEY}`,
        mr.ok
          ? "the scratch-key re-emit produced no script for this contract"
          : refusalMessage(mr),
      );
      continue;
    }
    const js = readFileSync(script, "utf8");
    const guardFail = assertFileKeyGuard(js, path.basename(script));
    record(
      c,
      "mint",
      guardFail ? "ERROR" : "PENDING",
      mr.ms,
      `npx ds-contracts figma … --file-key ${SCRATCH_FILE_KEY}  →  run through the figma-console bridge`,
      guardFail ??
        `runnable script emitted with the WRONG-FILE guard on ${SCRATCH_FILE_KEY}; bridge: ${bridge.message}`,
      [artifactOf(script, false)],
    );
  }

  // ---- the packet -------------------------------------------------------
  const attempts: SetAttempt[] = [];
  for (const [set, c] of chains) {
    skipRest(c, A_STAGES);
    clearPacketImages(def.exam, set);
    const images = emptyImages();
    const compDir = path.join(outDir, set.toLowerCase());
    const rowsPath = path.join(compDir, "pixel-rows.json");
    if (!existsSync(rowsPath)) {
      images.absent.push({
        kind: "ref",
        reason: `capture wrote no pixel-rows.json for ${set} — there is no cell list to sample`,
      });
      images.absent.push({
        kind: "code",
        reason: "same: no capture cell list",
      });
    } else {
      const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as Array<{
        key: string;
      }>;
      const keys = rows
        .map((r) => r.key)
        .filter((k) => k.endsWith("__default"))
        .slice(0, CELL_CAP);
      for (const key of keys) {
        const slug = slugify(key.replace(/__default$/, ""));
        const orig = path.join(compDir, "orig-shots", `${key}.png`);
        const gate = path.join(compDir, "gate-shots", `${key}.png`);
        if (existsSync(orig))
          images.ref.push(copyImage(orig, def.exam, set, `ref-${slug}.png`));
        else
          images.absent.push({
            kind: "ref",
            reason: `orig-shots/${key}.png absent (the real-library render was not kept)`,
          });
        if (existsSync(gate))
          images.code.push(copyImage(gate, def.exam, set, `code-${slug}.png`));
        else
          images.absent.push({
            kind: "code",
            reason: `gate-shots/${key}.png absent (the contract render did not run)`,
          });
      }
      if (keys.length === 0)
        images.absent.push({
          kind: "ref",
          reason: "the capture sampled no __default cell",
        });
    }
    images.absent.push({
      kind: "canvas",
      reason: `mint ${c.stages.find((s) => s.stage === "mint")?.status ?? "SKIPPED"} — ${bridge.message}`,
    });
    const a = finish(def.exam, "code-to-canvas", c, images);
    // Re-hash the images now that they live in the packet.
    for (const st of a.stages)
      if (st.stage === "capture")
        st.artifacts.push(
          ...[...images.ref, ...images.code].map((p) =>
            artifactOf(path.join(REPO, p), true),
          ),
        );
    attempts.push(a);
    writeAttempt(a);
  }

  const manifest: ExamManifest = {
    exam: def.exam,
    direction: "code-to-canvas",
    describe: def.describe,
    heldOut: def.heldOut,
    date: today(),
    engineSha: headSha(),
    input: {
      library: def.library,
      manifest: def.manifest,
      captureConfig: def.captureConfig,
      harness: def.harness,
      tokens: [lib.dtcg, lib.mintedOut],
    },
    sets: def.sets,
    mint: {
      requested: opts.mint,
      fileKey: SCRATCH_FILE_KEY,
      status: attempts.some((a) =>
        a.stages.some((s) => s.stage === "mint" && s.status === "ok"),
      )
        ? "ok"
        : "PENDING",
      message: bridge.message,
    },
    noRetry: true,
    cellCap: CELL_CAP,
  };
  writeManifest(manifest);
  return { manifest, attempts };
}

// ---------------------------------------------------------------------------
// Direction B — canvas → code
// ---------------------------------------------------------------------------

const B_STAGES = [
  "dump",
  "propose",
  "validate",
  "generate-react",
  "generate-wc",
  "render",
  "ref",
];

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface Cell {
  slug: string;
  figmaVariant: string;
  nodeId: string;
  props: Record<string, string | boolean>;
}

async function restNodes(
  fileKey: string,
  ids: string[],
  token: string,
): Promise<Record<string, { document: FigmaNode } | null>> {
  const res = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(ids.join(","))}`,
    { headers: { "X-Figma-Token": token } },
  );
  if (!res.ok) throw new Error(`Figma /nodes ${res.status} for ${fileKey}`);
  return (
    (await res.json()) as {
      nodes: Record<string, { document: FigmaNode } | null>;
    }
  ).nodes;
}

/** Every COMPONENT_SET/COMPONENT under the selected pages, in document order.
 *  The exam selects PAGES, never sets, so it cannot cherry-pick the ones that
 *  pass. */
function setsUnder(node: FigmaNode, out: FigmaNode[]): void {
  if (node.type === "COMPONENT_SET" || node.type === "COMPONENT") {
    out.push(node);
    return;
  }
  for (const c of node.children ?? []) setsUnder(c, out);
}

function cellsFor(contract: Record<string, unknown>, doc: FigmaNode): Cell[] {
  interface Axis {
    name: string;
    property: string;
    boolean: boolean;
    fromDrawn: Record<string, string>;
    def: string;
  }
  const axes: Axis[] = [];
  const childrenText: Record<string, string> = {};
  for (const p of (contract.props ?? []) as Array<Record<string, unknown>>) {
    const b = p.bindings as
      | {
          figma?: {
            kind?: string;
            property?: string;
            values?: Record<string, string>;
          };
          code?: { prop?: string };
        }
      | undefined;
    if (
      p.type === "text" &&
      b?.code?.prop === "children" &&
      typeof p.default === "string"
    )
      childrenText.children = p.default;
    if (b?.figma?.kind !== "VARIANT") continue;
    const values = b.figma.values ?? {};
    const fromDrawn: Record<string, string> = {};
    for (const [canon, drawn] of Object.entries(values))
      fromDrawn[drawn] = canon;
    axes.push({
      name: String(p.name),
      property: b.figma.property ?? String(p.name),
      boolean: p.type === "boolean",
      fromDrawn,
      def: String(p.default ?? ""),
    });
  }
  const propsFor = (variantName: string): Record<string, string | boolean> => {
    const parsed: Record<string, string> = {};
    for (const seg of variantName.split(",")) {
      const eq = seg.indexOf("=");
      if (eq < 0) continue;
      parsed[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
    }
    const out: Record<string, string | boolean> = { ...childrenText };
    for (const a of axes) {
      const drawn = parsed[a.property];
      if (drawn === undefined) continue;
      const canon = a.fromDrawn[drawn] ?? drawn;
      out[a.name] = a.boolean ? canon === "true" || drawn === "True" : canon;
    }
    return out;
  };
  if (doc.type !== "COMPONENT_SET")
    return [
      {
        slug: slugify(doc.name),
        figmaVariant: doc.name,
        nodeId: doc.id,
        props: { ...childrenText },
      },
    ];
  const kids = doc.children ?? [];
  const isDefault = (n: FigmaNode): boolean => {
    const p = propsFor(n.name);
    return axes.every((a) => String(p[a.name] ?? "") === a.def);
  };
  const ordered = [
    ...kids.filter(isDefault),
    ...kids.filter((k) => !isDefault(k)),
  ];
  const seen = new Set<string>();
  const cells: Cell[] = [];
  for (const k of ordered) {
    const slug = slugify(k.name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    cells.push({
      slug,
      figmaVariant: k.name,
      nodeId: k.id,
      props: propsFor(k.name),
    });
    if (cells.length >= CELL_CAP) break;
  }
  return cells;
}

async function fetchRefPngs(
  fileKey: string,
  wanted: Array<{ nodeId: string; outPath: string }>,
  token: string,
): Promise<void> {
  if (wanted.length === 0) return;
  const ids = [...new Set(wanted.map((w) => w.nodeId))];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const res = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(chunk.join(","))}&scale=2&format=png`,
      { headers: { "X-Figma-Token": token } },
    );
    if (!res.ok) throw new Error(`Figma /images ${res.status} for ${fileKey}`);
    const body = (await res.json()) as {
      images: Record<string, string | null>;
    };
    for (const w of wanted.filter((x) => chunk.includes(x.nodeId))) {
      const url = body.images[w.nodeId];
      if (!url) continue;
      const img = await fetch(url);
      if (!img.ok) continue;
      writeFileSync(w.outPath, Buffer.from(await img.arrayBuffer()));
    }
  }
}

export async function runCanvasToCode(
  def: CanvasToCodeExam,
  opts: { work: string },
): Promise<{ manifest: ExamManifest; attempts: SetAttempt[] }> {
  if (FORBIDDEN_FILE_KEYS.includes(def.fileKey))
    throw new Error(
      `first-pass: exam ${def.exam} names the forbidden file key ${def.fileKey}`,
    );
  const token = figmaToken();

  // ---- the selection, read-only ----------------------------------------
  const pageNodes = await restNodes(def.fileKey, def.pages, token);
  const sets: FigmaNode[] = [];
  for (const id of def.pages) {
    const entry = pageNodes[id];
    if (!entry) continue;
    setsUnder(entry.document, sets);
  }
  const corpus = def.corpusFiles
    .map((f) => path.join(REPO, f))
    .filter(existsSync);

  const chains = new Map<string, Chain>();
  const cellsBySet = new Map<string, Cell[]>();
  const nameBySet = new Map<string, string>();
  const reactOutBySet = new Map<string, string>();

  for (const doc of sets) {
    const c = newChain(doc.name, {
      fileKey: def.fileKey,
      nodeId: doc.id,
      type: doc.type,
    });
    chains.set(doc.name, c);
    const slug = slugify(doc.name);

    // ---- dump (documented CLI, READ-ONLY REST) --------------------------
    const dumpPath = path.join(opts.work, "dumps", `${slug}.json`);
    mkdirSync(path.dirname(dumpPath), { recursive: true });
    const url = `https://www.figma.com/design/${def.fileKey}/exam?node-id=${doc.id.replace(":", "-")}`;
    const dr = runOnce(
      TSX,
      ["extract/figma/rest/cli.ts", url, "--out", dumpPath],
      {
        cwd: REPO,
        env: { FIGMA_TOKEN: token },
      },
    );
    const dumpOk = dr.ok && existsSync(dumpPath);
    if (
      !record(
        c,
        "dump",
        dumpOk ? "ok" : dr.ok ? "ERROR" : classify(dr),
        dr.ms,
        `npm run extract:figma:rest -- "<url>?node-id=${doc.id}" --out <dump>`,
        dumpOk ? path.basename(dumpPath) : refusalMessage(dr),
        dumpOk ? [artifactOf(dumpPath, false)] : [],
      )
    )
      continue;

    // ---- propose --------------------------------------------------------
    const propOut = path.join(opts.work, "proposed", slug);
    const propArgs = ["extract/figma/propose.ts", dumpPath, "--out", propOut];
    if (corpus.length > 0) propArgs.push("--tokens", corpus.join(","));
    if (def.mode === "reviewable-inversion")
      propArgs.push("--reviewable-inversion");
    const prr = runOnce(TSX, propArgs, {
      cwd: REPO,
      env: { FIGMA_TOKEN: token },
    });
    const proposed = existsSync(propOut)
      ? readdirSync(propOut)
          .filter((f) => f.endsWith(".contract.proposed.json"))
          .sort()
      : [];
    const main =
      proposed.find((f) => !f.endsWith(".stub.contract.proposed.json")) ?? null;
    if (
      !record(
        c,
        "propose",
        prr.ok && main ? "ok" : prr.ok ? "ERROR" : classify(prr),
        prr.ms,
        `npm run extract:figma -- <dump> --out <proposed>${corpus.length ? " --tokens <kit dtcg>" : ""}${def.mode === "reviewable-inversion" ? " --reviewable-inversion" : ""}`,
        prr.ok && main
          ? `${proposed.length} proposal file(s)`
          : prr.ok
            ? "propose exited 0 and wrote no contract"
            : refusalMessage(prr),
        proposed.map((f) => artifactOf(path.join(propOut, f), false)),
      )
    )
      continue;

    const mainPath = path.join(propOut, main!);
    const raw = JSON.parse(readFileSync(mainPath, "utf8")) as Record<
      string,
      unknown
    >;
    c.id = String(raw.id ?? "");
    nameBySet.set(doc.name, String(raw.name ?? ""));

    // ---- validate (the referee, in process) -----------------------------
    const t0 = Date.now();
    const errors: string[] = [];
    const byId = new Map<string, Contract>();
    for (const f of proposed) {
      try {
        const p = ContractSchema.parse(
          JSON.parse(readFileSync(path.join(propOut, f), "utf8")),
        );
        byId.set(p.id, p);
      } catch (e) {
        errors.push(`${f}: ${String((e as Error).message ?? e)}`);
      }
    }
    if (errors.length === 0) {
      const parsed = byId.get(c.id);
      if (!parsed) errors.push(`${main}: parsed no contract with id ${c.id}`);
      // An EMPTY icon map on purpose: the generate stage below is invoked
      // WITHOUT --icons (a proposal from a canvas carries no SVG sidecar), so
      // the referee must see the same empty map the emitter will.
      else validateContract(parsed, byId, errors, new Map<string, string>());
    }
    if (
      !record(
        c,
        "validate",
        errors.length === 0 ? "ok" : "REFUSED",
        Date.now() - t0,
        "core/emit-react.ts validateContract (the referee — no CLI verb; docs/07)",
        errors.length === 0 ? "no violations" : errors.join("\n"),
      )
    )
      continue;

    // ---- generate React + Web Components --------------------------------
    // EXACTLY the documented layer list — the kit's own DTCG files, then the
    // freshly minted tree (DESIGN-TO-CODE-CENSUS.md § "The designer's CLI
    // sequence"). The census's pipeline half additionally PRUNES minted leaves
    // the corpus already defines; that prune is a repair, so a first-pass exam
    // must not perform it.
    const tokenList = [...corpus, path.join(propOut, "minted.dtcg.json")]
      .filter(existsSync)
      .join(",");
    const files = proposed.map((f) => path.join(propOut, f));
    const reactOut = path.join(opts.work, "react", slug);
    const rr = runOnce(
      TSX,
      [
        "packages/cli/src/cli.ts",
        "generate",
        ...files,
        "--out",
        reactOut,
        "--tokens",
        tokenList,
      ],
      { cwd: REPO },
    );
    const reactFiles = existsSync(reactOut)
      ? readdirSync(reactOut, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => path.join(e.parentPath ?? reactOut, e.name))
      : [];
    if (
      !record(
        c,
        "generate-react",
        rr.ok && reactFiles.length > 0 ? "ok" : rr.ok ? "ERROR" : classify(rr),
        rr.ms,
        `npx ds-contracts generate <proposed>/*.contract.proposed.json --out <react> --tokens <kit>,<minted>`,
        rr.ok && reactFiles.length > 0
          ? `${reactFiles.length} file(s)`
          : rr.ok
            ? "generate exited 0 and wrote nothing"
            : refusalMessage(rr),
        reactFiles.map((f) => artifactOf(f, false)),
      )
    )
      continue;
    reactOutBySet.set(doc.name, reactOut);

    const wcOut = path.join(opts.work, "wc", slug);
    const wr = runOnce(
      TSX,
      [
        "packages/cli/src/cli.ts",
        "generate",
        ...files,
        "--out",
        wcOut,
        "--target",
        "web-components",
        "--emitter",
        "@ds-contracts/emitter-web-components",
        "--tokens",
        tokenList,
      ],
      { cwd: REPO },
    );
    const wcFiles = existsSync(wcOut)
      ? readdirSync(wcOut, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => path.join(e.parentPath ?? wcOut, e.name))
      : [];
    if (
      !record(
        c,
        "generate-wc",
        wr.ok && wcFiles.length > 0 ? "ok" : wr.ok ? "ERROR" : classify(wr),
        wr.ms,
        `npx ds-contracts generate <proposed>/*.contract.proposed.json --out <wc> --target web-components --emitter @ds-contracts/emitter-web-components`,
        wr.ok && wcFiles.length > 0
          ? `${wcFiles.length} file(s)`
          : wr.ok
            ? "generate exited 0 and wrote nothing"
            : refusalMessage(wr),
        wcFiles.map((f) => artifactOf(f, false)),
      )
    )
      continue;

    cellsBySet.set(doc.name, cellsFor(raw, doc));
  }

  // ---- render the generated React, then export Figma's own render -------
  const imagesBySet = new Map<string, SetAttempt["images"]>();
  for (const doc of sets) imagesBySet.set(doc.name, emptyImages());
  for (const doc of sets) clearPacketImages(def.exam, doc.name);
  const renderMs = await renderGenerated(
    def,
    sets,
    chains,
    cellsBySet,
    nameBySet,
    reactOutBySet,
    imagesBySet,
    opts.work,
  );
  await exportRefs(def, sets, chains, cellsBySet, imagesBySet, token, renderMs);

  const attempts: SetAttempt[] = [];
  for (const doc of sets) {
    const c = chains.get(doc.name)!;
    skipRest(c, B_STAGES);
    const images = imagesBySet.get(doc.name)!;
    images.absent.push({
      kind: "canvas",
      reason:
        "canvas→code writes nothing to any canvas — the canvas IS the source here, and Figma's own render of it is ref-*.png",
    });
    const a = finish(def.exam, "canvas-to-code", c, images);
    for (const st of a.stages)
      if (st.stage === "render" || st.stage === "ref")
        st.artifacts.push(
          ...(st.stage === "render" ? images.code : images.ref).map((p) =>
            artifactOf(path.join(REPO, p), true),
          ),
        );
    attempts.push(a);
    writeAttempt(a);
  }

  const manifest: ExamManifest = {
    exam: def.exam,
    direction: "canvas-to-code",
    describe: def.describe,
    heldOut: def.heldOut,
    date: today(),
    engineSha: headSha(),
    input: {
      kit: def.kit,
      fileKey: def.fileKey,
      pages: def.pages,
      mode: def.mode,
      corpus:
        def.corpusFiles.length > 0
          ? def.corpusFiles
          : ["(none — foreign kit, empty corpus)"],
    },
    sets: sets.map((s) => s.name),
    mint: {
      requested: false,
      fileKey: "(none)",
      status: "SKIPPED",
      message:
        "canvas→code is READ-ONLY; no exam in this direction writes to any Figma file",
    },
    noRetry: true,
    cellCap: CELL_CAP,
  };
  writeManifest(manifest);
  return { manifest, attempts };
}

/** Render the GENERATED React — the same bytes the generate stage hashed —
 *  through esbuild and a headless Chromium, one page for the whole exam. */
async function renderGenerated(
  def: CanvasToCodeExam,
  sets: FigmaNode[],
  chains: Map<string, Chain>,
  cellsBySet: Map<string, Cell[]>,
  nameBySet: Map<string, string>,
  reactOutBySet: Map<string, string>,
  imagesBySet: Map<string, SetAttempt["images"]>,
  work: string,
): Promise<number> {
  const live = sets.filter(
    (d) =>
      !chains.get(d.name)!.stopped && (cellsBySet.get(d.name) ?? []).length > 0,
  );
  if (live.length === 0) return 0;
  const dir = path.join(work, "render");
  mkdirSync(dir, { recursive: true });
  const imports: string[] = [];
  const jsx: string[] = [];
  const rendered: FigmaNode[] = [];
  for (const doc of live) {
    const name = nameBySet.get(doc.name) ?? "";
    const out = reactOutBySet.get(doc.name)!;
    const entry = path.join(out, name, `${name}.tsx`);
    if (!name || !existsSync(entry)) continue;
    const alias = `C${rendered.length}`;
    imports.push(
      `import { ${name} as ${alias} } from ${JSON.stringify("./" + path.relative(dir, path.join(out, name, name)))};`,
    );
    if (existsSync(path.join(out, "tokens.css")))
      imports.push(
        `import ${JSON.stringify("./" + path.relative(dir, path.join(out, "tokens.css")))};`,
      );
    for (const cell of cellsBySet.get(doc.name)!) {
      const props = Object.entries(cell.props)
        .map(
          ([k, v]) =>
            `${JSON.stringify(k)}: ${typeof v === "boolean" ? String(v) : JSON.stringify(v)}`,
        )
        .join(", ");
      jsx.push(
        `<div data-cell=${JSON.stringify(`${slugify(doc.name)}__${cell.slug}`)} style={{ display: 'inline-block', padding: 16, background: '#fff' }}>{createElement(${alias} as never, { ${props} } as never)}</div>`,
      );
    }
    rendered.push(doc);
  }
  const t0 = Date.now();
  if (rendered.length === 0) return 0;
  writeFileSync(
    path.join(dir, "entry.tsx"),
    [
      `import { createElement } from 'react';`,
      `import { createRoot } from 'react-dom/client';`,
      ...imports,
      `createRoot(document.getElementById('app')!).render(`,
      `  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24, alignItems: 'flex-start', background: '#fff' }}>`,
      ...jsx.map((j) => `    ${j},`),
      `  </div>,`,
      `);`,
    ].join("\n"),
  );
  writeFileSync(
    path.join(dir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="bundle.css"><style>body{margin:0;background:#fff;font-family:Inter,system-ui,sans-serif}</style></head><body><div id="app"></div><script src="bundle.js"></script></body></html>`,
  );
  let buildError: string | null = null;
  try {
    await build({
      entryPoints: [path.join(dir, "entry.tsx")],
      bundle: true,
      outfile: path.join(dir, "bundle.js"),
      jsx: "automatic",
      loader: { ".module.css": "local-css", ".css": "css" },
      absWorkingDir: REPO,
      nodePaths: [path.join(REPO, "node_modules")],
      logLevel: "silent",
    });
  } catch (e) {
    buildError = String((e as Error).message ?? e);
  }
  const ms = Date.now() - t0;
  if (buildError) {
    for (const doc of rendered) {
      const c = chains.get(doc.name)!;
      record(
        c,
        "render",
        "ERROR",
        ms,
        "esbuild bundle of the generated React",
        buildError,
      );
      imagesBySet.get(doc.name)!.absent.push({
        kind: "code",
        reason: `the generated React did not bundle: ${buildError.split("\n")[0]}`,
      });
    }
    return ms;
  }
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
  });
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 1400, height: 2400 },
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`file://${path.join(dir, "index.html")}`);
  await page.waitForTimeout(600);
  for (const doc of rendered) {
    const c = chains.get(doc.name)!;
    const images = imagesBySet.get(doc.name)!;
    const missed: string[] = [];
    for (const cell of cellsBySet.get(doc.name)!) {
      const h = await page.$(
        `[data-cell="${slugify(doc.name)}__${cell.slug}"]`,
      );
      if (!h) {
        missed.push(cell.slug);
        images.absent.push({
          kind: "code",
          reason: `cell ${cell.slug} did not mount on the page`,
        });
        continue;
      }
      const target = path.join(
        packetDir(def.exam, doc.name),
        `code-${cell.slug}.png`,
      );
      mkdirSync(path.dirname(target), { recursive: true });
      await h.screenshot({ path: target });
      images.code.push(path.relative(REPO, target));
    }
    record(
      c,
      "render",
      images.code.length > 0 ? "ok" : "ERROR",
      Math.round(ms / rendered.length),
      "esbuild bundle of the generated React → playwright-core screenshot at deviceScaleFactor 2",
      images.code.length > 0
        ? `${images.code.length} cell(s)${missed.length ? `; ${missed.length} did not mount` : ""}${pageErrors.length ? `; ${pageErrors.length} page error(s), first: ${pageErrors[0]}` : ""}`
        : `no cell mounted${pageErrors.length ? `; first page error: ${pageErrors[0]}` : ""}`,
    );
  }
  await browser.close();
  return ms;
}

/** Figma's OWN render of the source cells — GET /v1/images/:key?scale=2. */
async function exportRefs(
  def: CanvasToCodeExam,
  sets: FigmaNode[],
  chains: Map<string, Chain>,
  cellsBySet: Map<string, Cell[]>,
  imagesBySet: Map<string, SetAttempt["images"]>,
  token: string,
  _renderMs: number,
): Promise<void> {
  const wanted: Array<{
    nodeId: string;
    outPath: string;
    set: string;
    slug: string;
  }> = [];
  for (const doc of sets) {
    const c = chains.get(doc.name)!;
    if (c.stopped) continue;
    for (const cell of cellsBySet.get(doc.name) ?? []) {
      const dir = packetDir(def.exam, doc.name);
      mkdirSync(dir, { recursive: true });
      wanted.push({
        nodeId: cell.nodeId,
        outPath: path.join(dir, `ref-${cell.slug}.png`),
        set: doc.name,
        slug: cell.slug,
      });
    }
  }
  const t0 = Date.now();
  let err: string | null = null;
  try {
    await fetchRefPngs(def.fileKey, wanted, token);
  } catch (e) {
    err = String((e as Error).message ?? e);
  }
  const ms = Date.now() - t0;
  const live = sets.filter((d) => !chains.get(d.name)!.stopped);
  for (const doc of live) {
    const c = chains.get(doc.name)!;
    const images = imagesBySet.get(doc.name)!;
    for (const w of wanted.filter((x) => x.set === doc.name)) {
      if (existsSync(w.outPath))
        images.ref.push(path.relative(REPO, w.outPath));
      else
        images.absent.push({
          kind: "ref",
          reason: `Figma rendered no image for node ${w.nodeId} (${w.slug})`,
        });
    }
    record(
      c,
      "ref",
      err ? "ERROR" : images.ref.length > 0 ? "ok" : "ERROR",
      Math.max(1, Math.round(ms / Math.max(1, live.length))),
      `GET /v1/images/${def.fileKey}?ids=<variant>&scale=2 (READ-ONLY)`,
      err ??
        (images.ref.length > 0
          ? `${images.ref.length} reference PNG(s) at scale 2`
          : "Figma returned no image for any cell"),
    );
  }
}
