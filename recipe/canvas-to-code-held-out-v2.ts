/**
 * Canvas→code held-out exam v2 — designer-drawn substrates (docs/26 amendment,
 * F-C2C; closes OWNER-PARKED P1).
 *
 * v1 (`canvas-to-code-held-out.ts`) measured a Card this repository had minted
 * itself. v2 measures component sets drawn by people who never used this tool,
 * in files this repository never wrote (see the manifest). It is the same
 * pipeline — committed observe → canvas facts → bridge → proposeFromDump →
 * React emitter → Chromium computed-style diff — with two additions:
 *
 * - **Refusal is a result.** A subject the bridge or proposer cannot express is
 *   recorded as `outcome: "refused-by-name"` with the stage and message, never
 *   as an absent row. The gate passes only when every observed subject is
 *   either accounting-clean (zero silent, zero unexplained) or refused by name.
 * - **Provenance is pinned.** Each subject's observe carries the file's REST
 *   version and two identical observe runs (see `run-held-out-observe.ts`).
 *
 *   tsx recipe/canvas-to-code-held-out-v2.ts --write [--subject <slug>]
 *   tsx recipe/canvas-to-code-held-out-v2.ts --check
 *
 * Nothing here mints a grade: `humanGrade: "pending"`, `overallSuccess: false`.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  deriveCanvasFacts,
  sha256OfBytes,
  type CanvasFactsDocument,
} from "./canvas-facts.js";
import {
  runCanvasToCodeFromFacts,
  type RenderDiffResult,
} from "./canvas-to-code.js";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import type { HeldOutNamedBlocker } from "./canvas-to-code-held-out.js";
import {
  HELD_OUT_V2_ROOT,
  HELD_OUT_V2_SUBJECTS,
  HELD_OUT_V2_VERSION,
  subjectBySlug,
  type HeldOutSubject,
} from "./canvas-to-code-held-out-v2-manifest.js";
import { buildHeldOutObserveProgram } from "./held-out-observe-program.js";
import { canonicalJson } from "./normalize.js";
import { portableGzipSync } from "./portable-gzip.js";
import type { SceneNodeSnapshot } from "./scene-readback.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

export type HeldOutV2Stage =
  | "observe"
  | "canvas-facts"
  | "bridge"
  | "propose"
  | "emit"
  | "render";

export interface HeldOutV2ObserveMeta {
  artifactVersion: string;
  subject: string;
  fileKey: string;
  fileName: string;
  pageId: string;
  pageName: string;
  setNodeId: string;
  setName: string;
  variants: number;
  propertyDefinitions: Record<
    string,
    { type: string; defaultValue?: unknown; variantOptions?: string[] }
  >;
  fileVersion: string;
  fileLastModified: string;
  observeSha256: string;
  observeUncompressedSha256: string;
  programSha256: string;
  doubleObserve: { runs: unknown[]; identical: boolean };
  figmaWrites: number;
}

export interface HeldOutV2Receipt {
  artifactVersion: typeof HELD_OUT_V2_VERSION;
  method: "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff";
  subject: HeldOutSubject & {
    observePath: string;
    observeSha256: string;
    fileVersion: string;
    fileLastModified: string;
    variants: number;
    /** One-time read-only bridge observe produced the committed bytes; the exam runs offline. */
    liveReads: 0;
    figmaWrites: 0;
  };
  outcome: "accounting-zero-silent" | "refused-by-name";
  refusal?: { stage: HeldOutV2Stage; message: string };
  canvasFacts?: {
    nodes: number;
    facts: number;
    normalizations: number;
    receiptedNormalizations: number;
  };
  bridge?: {
    facts: number;
    named: number;
    carried: number;
    receipted: number;
    silent: number;
    tokenRenames: number;
  };
  proposal?: {
    contractId: string;
    componentName: string;
    projection: string;
    notes: number;
    unbound: number;
    mintedTokens: number;
    childStubs: number;
  };
  emitted?: Array<{ path: string; sha256: string }>;
  render?: RenderDiffResult["counts"] & { cellsMounted: number };
  deltaSummaries?: string[];
  namedBlockers: HeldOutNamedBlocker[];
  humanGrade: "pending";
  gradeInvented: false;
  overallSuccess: false;
  productV1: "incomplete";
}

export interface HeldOutV2Index {
  artifactVersion: typeof HELD_OUT_V2_VERSION;
  /** The v1 blocker this exam answers. Its opposite is now the substrate fact. */
  answersV1Blocker: "substrate-is-our-own-mint";
  subjects: Array<{
    slug: string;
    fileKey: string;
    setName: string;
    outcome: HeldOutV2Receipt["outcome"];
    refusal?: HeldOutV2Receipt["refusal"];
    variants: number;
    fileVersion: string;
    observeSha256: string;
    silent: number | null;
    unexplained: number | null;
  }>;
}

const subjectDir = (subject: HeldOutSubject): string =>
  path.resolve(REPO, HELD_OUT_V2_ROOT, subject.slug);

export function loadObserve(subject: HeldOutSubject): {
  scene: SceneNodeSnapshot;
  observeSha256: string;
  meta: HeldOutV2ObserveMeta;
  observePath: string;
} {
  const dir = subjectDir(subject);
  const observePath = path.join(dir, "observe.json.gz");
  const metaPath = path.join(dir, "observe-meta.json");
  if (!existsSync(observePath) || !existsSync(metaPath))
    throw new Error(
      `held-out v2: subject ${subject.slug} has no committed observe — run \`tsx recipe/run-held-out-observe.ts --subject ${subject.slug}\` with the file open in Figma Desktop (Desktop Bridge), then \`--write\``,
    );
  const bytes = readFileSync(observePath);
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as HeldOutV2ObserveMeta;
  const observeSha256 = sha256OfBytes(bytes);
  if (meta.observeSha256 !== observeSha256)
    throw new Error(
      `held-out v2: ${subject.slug} observe-meta.observeSha256 ${meta.observeSha256} != bytes ${observeSha256}`,
    );
  if (meta.figmaWrites !== 0) throw new Error(`held-out v2: ${subject.slug} meta reports writes`);
  if (!meta.doubleObserve?.identical)
    throw new Error(`held-out v2: ${subject.slug} observe was not double-run identical`);
  if (meta.fileKey !== subject.fileKey || meta.setNodeId !== subject.setNodeId)
    throw new Error(`held-out v2: ${subject.slug} meta identity != manifest`);
  const programSha256 = sha256(buildHeldOutObserveProgram(subject));
  if (meta.programSha256 !== programSha256)
    throw new Error(
      `held-out v2: ${subject.slug} was observed with a different program (${meta.programSha256} != ${programSha256}) — re-observe`,
    );
  return {
    scene: JSON.parse(gunzipSync(bytes).toString("utf8")) as SceneNodeSnapshot,
    observeSha256,
    meta,
    observePath: path.relative(REPO, observePath),
  };
}

const blockersFor = (
  subject: HeldOutSubject,
  meta: HeldOutV2ObserveMeta,
  doc: CanvasFactsDocument | null,
  diff: RenderDiffResult | null,
): HeldOutNamedBlocker[] => {
  const blockers: HeldOutNamedBlocker[] = [];
  const nonVariant = Object.entries(meta.propertyDefinitions ?? {}).filter(
    ([, def]) => def.type !== "VARIANT",
  );
  if (nonVariant.length > 0)
    blockers.push({
      id: "observe-non-variant-property-definitions",
      stage: "observe",
      severity: "named-residual",
      detail: `${nonVariant.length} non-VARIANT component propert${nonVariant.length === 1 ? "y" : "ies"} (${nonVariant
        .map(([key, def]) => `${key}: ${def.type}`)
        .join(", ")}) — SceneNodeSnapshot has no slot for BOOLEAN/TEXT/INSTANCE_SWAP props; named here from the observe meta, not dropped silently.`,
    });
  if (subject.publishedSetNodeId && subject.publishedSetNodeId !== subject.setNodeId)
    blockers.push({
      id: "published-set-id-stale",
      stage: "observe",
      severity: "named-residual",
      detail: `the published component-set id ${subject.publishedSetNodeId} no longer exists on canvas; the set was resolved by page + name to ${subject.setNodeId}. Published ids are provenance only.`,
    });
  if (doc) {
    const receipted = doc.normalizations.filter((n) => n.kind.includes("receipted"));
    if (receipted.length > 0)
      blockers.push({
        id: "canvas-facts-binding-receipts",
        stage: "canvas-facts",
        severity: "named-residual",
        detail: `${receipted.length} binding normalization(s) receipted — no IR spelling; nothing invented. Sample: ${receipted
          .slice(0, 3)
          .map((n) => `${n.ownershipKey}:${n.kind}`)
          .join("; ")}`,
      });
  }
  if (diff) {
    const harness = diff.ledger.filter(
      (row) =>
        row.disposition === "receipted" &&
        typeof row.landing === "string" &&
        /part-tree harness|secondary TEXT|reviewable-inversion residual/i.test(row.landing),
    );
    if (harness.length > 0)
      blockers.push({
        id: "render-harness-nested-anatomy",
        stage: "render",
        severity: "named-harness-limit",
        detail: `${harness.length} render receipt(s) name the root-only Chromium harness / reviewable-inversion residual — nested anatomy and secondary TEXT are not silently dropped.`,
      });
  }
  blockers.push({
    id: "product-v1-incomplete",
    stage: "product",
    severity: "product-incomplete",
    detail:
      "Passing this gate proves accounting honesty on a designer-drawn substrate. It does not flip overallSuccess; the owner grades and signs.",
  });
  blockers.push({
    id: "no-human-grade",
    stage: "product",
    severity: "product-incomplete",
    detail: "humanGrade stays pending; this exam invents no grade.",
  });
  return blockers;
};

const gz = (value: unknown): Buffer =>
  portableGzipSync(Buffer.from(`${canonicalJson(value)}\n`, "utf8"), { level: 9 });

export async function runHeldOutV2Subject(
  subject: HeldOutSubject,
  write: boolean,
): Promise<HeldOutV2Receipt> {
  const dir = subjectDir(subject);
  if (subject.absentOnCanvas) return refuseAbsent(subject, write);
  const observeRefusalPath = path.join(dir, "observe-refusal.json");
  if (existsSync(observeRefusalPath) && !existsSync(path.join(dir, "observe.json.gz")))
    return refuseAtObserve(subject, write, JSON.parse(readFileSync(observeRefusalPath, "utf8")) as { code: string; message: string; fileVersion: string });
  const { scene, observeSha256, meta, observePath } = loadObserve(subject);
  const workRoot = write ? dir : mkdtempSync(path.join(os.tmpdir(), `held-out-v2-${subject.slug}-`));
  const base = {
    artifactVersion: HELD_OUT_V2_VERSION as typeof HELD_OUT_V2_VERSION,
    method:
      "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff" as const,
    subject: {
      ...subject,
      observePath,
      observeSha256,
      fileVersion: meta.fileVersion,
      fileLastModified: meta.fileLastModified,
      variants: meta.variants,
      liveReads: 0 as const,
      figmaWrites: 0 as const,
    },
    humanGrade: "pending" as const,
    gradeInvented: false as const,
    overallSuccess: false as const,
    productV1: "incomplete" as const,
  };
  const refuse = (stage: HeldOutV2Stage, error: unknown): HeldOutV2Receipt => ({
    ...base,
    outcome: "refused-by-name",
    refusal: { stage, message: error instanceof Error ? error.message : String(error) },
    namedBlockers: [
      {
        id: "subject-refused-by-name",
        stage: stage === "propose" || stage === "emit" ? "emit" : stage,
        severity: "named-residual",
        detail: `refused at ${stage}: ${error instanceof Error ? error.message : String(error)}`,
      },
      ...blockersFor(subject, meta, null, null),
    ],
  });

  try {
    let doc: CanvasFactsDocument;
    try {
      doc = deriveCanvasFacts(scene, { observePath, observeSha256 });
    } catch (error) {
      return finish(refuse("canvas-facts", error));
    }
    let bridge: ReturnType<typeof bridgeCanvasFactsToDump>;
    try {
      bridge = bridgeCanvasFactsToDump(doc);
    } catch (error) {
      return finish(refuse("bridge", error));
    }
    if (bridge.counts.silent !== 0)
      throw new Error(`held-out v2: bridge silent=${String(bridge.counts.silent)} — refuse`);

    const outRoot = write ? workRoot : path.join(workRoot, "out");
    let run: Awaited<ReturnType<typeof runCanvasToCodeFromFacts>>;
    try {
      run = await runCanvasToCodeFromFacts(doc, outRoot, {
        regenerateHint: `tsx recipe/canvas-to-code-held-out-v2.ts --write --subject ${subject.slug}`,
        contractFileName: `${subject.archetype}.contract.proposed.json`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stage: HeldOutV2Stage = /could not be proposed|propose/i.test(message)
        ? "propose"
        : /render|chromium|mount/i.test(message)
          ? "render"
          : "emit";
      return finish(refuse(stage, error));
    }
    const { build, diff, cellsMounted } = run;
    if (diff.counts.silent !== 0 || diff.counts.unexplainedDeltas !== 0)
      throw new Error(
        `held-out v2: render silent=${String(diff.counts.silent)} unexplained=${String(diff.counts.unexplainedDeltas)} — refuse`,
      );

    const receipt: HeldOutV2Receipt = {
      ...base,
      outcome: "accounting-zero-silent",
      canvasFacts: {
        nodes: doc.counts.nodes,
        facts: doc.counts.facts,
        normalizations: doc.normalizations.length,
        receiptedNormalizations: doc.normalizations.filter((n) => n.kind.includes("receipted")).length,
      },
      bridge: { ...bridge.counts, tokenRenames: bridge.tokenRenames.length },
      proposal: {
        contractId: String((build.contract as { id?: unknown }).id ?? ""),
        componentName: build.componentName,
        projection: (build.proposal.projection as { status?: string }).status ?? "",
        notes: build.proposalNotes.length,
        unbound: build.proposal.unbound.length,
        mintedTokens: build.proposal.mintedTokens?.count ?? 0,
        childStubs: (build.proposal.childStubs ?? []).length,
      },
      emitted: build.emittedFiles,
      render: { ...diff.counts, cellsMounted },
      deltaSummaries: diff.deltaSummaries,
      namedBlockers: blockersFor(subject, meta, doc, diff),
    };

    if (write) {
      writeFileSync(path.join(dir, "canvas-facts.json.gz"), gz(doc));
      writeFileSync(
        path.join(dir, "bridge.json.gz"),
        gz({ dump: bridge.dump, ledger: bridge.ledger, tokenRenames: bridge.tokenRenames, counts: bridge.counts }),
      );
      writeFileSync(path.join(dir, "render-ledger.json.gz"), gz({ ledger: diff.ledger, counts: diff.counts }));
      writeFileSync(path.join(dir, "named-blockers.json"), `${canonicalJson(receipt.namedBlockers)}\n`);
      writeFileSync(path.join(dir, "receipt.json"), `${canonicalJson(receipt)}\n`);
      if (existsSync(path.join(dir, "refusal.json"))) rmSync(path.join(dir, "refusal.json"));
    } else {
      const committed = JSON.parse(readFileSync(path.join(dir, "receipt.json"), "utf8")) as HeldOutV2Receipt;
      if (canonicalJson(committed) !== canonicalJson(receipt))
        throw new Error(
          `held-out v2: ${subject.slug} committed receipt.json does not match recomputation — re-run \`tsx recipe/canvas-to-code-held-out-v2.ts --write --subject ${subject.slug}\` and review the diff`,
        );
      for (const file of build.emittedFiles) {
        const committedHash = sha256(readFileSync(path.join(dir, file.path)));
        if (committedHash !== file.sha256)
          throw new Error(`held-out v2: ${subject.slug} committed ${file.path} drifted (${committedHash} != ${file.sha256})`);
      }
      const committedFacts = gunzipSync(readFileSync(path.join(dir, "canvas-facts.json.gz"))).toString("utf8");
      if (committedFacts !== `${canonicalJson(doc)}\n`)
        throw new Error(`held-out v2: ${subject.slug} committed canvas-facts.json.gz drifted from recomputation`);
    }
    return receipt;
  } finally {
    if (!write) rmSync(workRoot, { recursive: true, force: true });
  }

  function finish(receipt: HeldOutV2Receipt): HeldOutV2Receipt {
    if (write) {
      writeFileSync(path.join(dir, "refusal.json"), `${canonicalJson(receipt.refusal)}\n`);
      writeFileSync(path.join(dir, "named-blockers.json"), `${canonicalJson(receipt.namedBlockers)}\n`);
      writeFileSync(path.join(dir, "receipt.json"), `${canonicalJson(receipt)}\n`);
      for (const stale of ["canvas-facts.json.gz", "bridge.json.gz", "render-ledger.json.gz", "generated"])
        rmSync(path.join(dir, stale), { recursive: true, force: true });
    } else {
      const committed = JSON.parse(readFileSync(path.join(dir, "receipt.json"), "utf8")) as HeldOutV2Receipt;
      if (canonicalJson(committed) !== canonicalJson(receipt))
        throw new Error(
          `held-out v2: ${subject.slug} committed refusal receipt does not match recomputation — re-run --write and review`,
        );
      if (existsSync(path.join(dir, "generated")))
        throw new Error(`held-out v2: ${subject.slug} is refused yet carries generated/ — stale evidence`);
    }
    return receipt;
  }
}

/** A published set that no longer exists on canvas: a refusal at observe, with
 *  the measurement that says so. Nothing is observed; nothing is invented. */
function refuseAbsent(subject: HeldOutSubject, write: boolean): HeldOutV2Receipt {
  const dir = subjectDir(subject);
  const absent = subject.absentOnCanvas!;
  const receipt: HeldOutV2Receipt = {
    artifactVersion: HELD_OUT_V2_VERSION,
    method:
      "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff",
    subject: {
      ...subject,
      observePath: "",
      observeSha256: "",
      fileVersion: absent.fileVersion,
      fileLastModified: "",
      variants: 0,
      liveReads: 0,
      figmaWrites: 0,
    },
    outcome: "refused-by-name",
    refusal: { stage: "observe", message: `set-not-on-canvas: ${absent.reason} (measured ${absent.measuredAt}, file version ${absent.fileVersion})` },
    namedBlockers: [
      {
        id: "set-not-on-canvas",
        stage: "observe",
        severity: "named-residual",
        detail: `${subject.setName} is published (${subject.publishedSetNodeId}) but has no component set on canvas: ${absent.reason}`,
      },
      {
        id: "product-v1-incomplete",
        stage: "product",
        severity: "product-incomplete",
        detail: "Passing this gate proves accounting honesty on a designer-drawn substrate. It does not flip overallSuccess; the owner grades and signs.",
      },
      { id: "no-human-grade", stage: "product", severity: "product-incomplete", detail: "humanGrade stays pending; this exam invents no grade." },
    ],
    humanGrade: "pending",
    gradeInvented: false,
    overallSuccess: false,
    productV1: "incomplete",
  };
  if (write) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "refusal.json"), `${canonicalJson(receipt.refusal)}\n`);
    writeFileSync(path.join(dir, "named-blockers.json"), `${canonicalJson(receipt.namedBlockers)}\n`);
    writeFileSync(path.join(dir, "receipt.json"), `${canonicalJson(receipt)}\n`);
  } else {
    const committed = JSON.parse(readFileSync(path.join(dir, "receipt.json"), "utf8")) as HeldOutV2Receipt;
    if (canonicalJson(committed) !== canonicalJson(receipt))
      throw new Error(`held-out v2: ${subject.slug} committed absent-set receipt does not match the manifest — re-run --write`);
  }
  return receipt;
}

/** The observe itself refused (e.g. two read-only runs disagreed). Recorded from
 *  the receiver's observe-refusal.json; nothing downstream runs. */
function refuseAtObserve(
  subject: HeldOutSubject,
  write: boolean,
  refusal: { code: string; message: string; fileVersion: string },
): HeldOutV2Receipt {
  const dir = subjectDir(subject);
  const receipt: HeldOutV2Receipt = {
    artifactVersion: HELD_OUT_V2_VERSION,
    method:
      "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff",
    subject: {
      ...subject,
      observePath: "",
      observeSha256: "",
      fileVersion: refusal.fileVersion,
      fileLastModified: "",
      variants: 0,
      liveReads: 0,
      figmaWrites: 0,
    },
    outcome: "refused-by-name",
    refusal: { stage: "observe", message: `${refusal.code}: ${refusal.message}` },
    namedBlockers: [
      { id: "subject-refused-by-name", stage: "observe", severity: "named-residual", detail: `refused at observe: ${refusal.code}: ${refusal.message}` },
      {
        id: "product-v1-incomplete",
        stage: "product",
        severity: "product-incomplete",
        detail: "Passing this gate proves accounting honesty on a designer-drawn substrate. It does not flip overallSuccess; the owner grades and signs.",
      },
      { id: "no-human-grade", stage: "product", severity: "product-incomplete", detail: "humanGrade stays pending; this exam invents no grade." },
    ],
    humanGrade: "pending",
    gradeInvented: false,
    overallSuccess: false,
    productV1: "incomplete",
  };
  if (write) {
    writeFileSync(path.join(dir, "refusal.json"), `${canonicalJson(receipt.refusal)}\n`);
    writeFileSync(path.join(dir, "named-blockers.json"), `${canonicalJson(receipt.namedBlockers)}\n`);
    writeFileSync(path.join(dir, "receipt.json"), `${canonicalJson(receipt)}\n`);
  } else {
    const committed = JSON.parse(readFileSync(path.join(dir, "receipt.json"), "utf8")) as HeldOutV2Receipt;
    if (canonicalJson(committed) !== canonicalJson(receipt))
      throw new Error(`held-out v2: ${subject.slug} committed observe-refusal receipt does not match — re-run --write`);
  }
  return receipt;
}

export async function runHeldOutV2(
  write: boolean,
  only?: string,
): Promise<{ index: HeldOutV2Index; receipts: HeldOutV2Receipt[] }> {
  const subjects = only ? [subjectBySlug(only)] : [...HELD_OUT_V2_SUBJECTS];
  const receipts: HeldOutV2Receipt[] = [];
  for (const subject of subjects) receipts.push(await runHeldOutV2Subject(subject, write));
  // The index always covers EVERY manifest subject: a subject without a
  // committed observe is a red by name, not an absent row.
  const rows: HeldOutV2Index["subjects"] = [];
  for (const subject of HELD_OUT_V2_SUBJECTS) {
    const receiptPath = path.join(subjectDir(subject), "receipt.json");
    if (!existsSync(receiptPath))
      throw new Error(
        `held-out v2: manifest subject ${subject.slug} has no committed receipt — observe it and run --write`,
      );
    const r = JSON.parse(readFileSync(receiptPath, "utf8")) as HeldOutV2Receipt;
    rows.push({
      slug: subject.slug,
      fileKey: subject.fileKey,
      setName: subject.setName,
      outcome: r.outcome,
      ...(r.refusal ? { refusal: r.refusal } : {}),
      variants: r.subject.variants,
      fileVersion: r.subject.fileVersion,
      observeSha256: r.subject.observeSha256,
      silent: r.render?.silent ?? r.bridge?.silent ?? null,
      unexplained: r.render?.unexplainedDeltas ?? null,
    });
  }
  const index: HeldOutV2Index = {
    artifactVersion: HELD_OUT_V2_VERSION,
    answersV1Blocker: "substrate-is-our-own-mint",
    subjects: rows,
  };
  const indexPath = path.resolve(REPO, HELD_OUT_V2_ROOT, "index.json");
  if (write) {
    mkdirSync(path.dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, `${canonicalJson(index)}\n`);
  } else {
    const committed = readFileSync(indexPath, "utf8");
    if (committed !== `${canonicalJson(index)}\n`)
      throw new Error("held-out v2: committed index.json does not match recomputation — re-run --write");
  }
  return { index, receipts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes("--write");
  const at = process.argv.indexOf("--subject");
  const only = at > -1 ? process.argv[at + 1] : undefined;
  runHeldOutV2(write, only)
    .then(({ index }) => {
      for (const row of index.subjects)
        process.stdout.write(
          `${row.outcome === "accounting-zero-silent" ? "✔" : "◌"} ${row.slug} (${row.setName}, ${row.variants} variants, file ${row.fileVersion}): ${row.outcome}${
            row.refusal ? ` — ${row.refusal.stage}: ${row.refusal.message}` : ` — silent ${row.silent}, unexplained ${row.unexplained}`
          }\n`,
        );
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
