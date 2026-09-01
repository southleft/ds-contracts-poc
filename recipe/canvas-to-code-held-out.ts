/**
 * Stage 3f — held-out canvas→code exam (docs/35 §5).
 *
 * Substrate (option 1): Scratch file `byMp6lt0Ij9b2QbkDGFwBh`, page
 * `antd exam 2026-08-23` (`33:2`), COMPONENT_SET `Card` (`33:5093`).
 * Card is NOT a first-class recipe stay (no recipe:card:* gate, not on any
 * signed/boilerplate stay page). Observe taken read-only via Figma Console
 * MCP — zero Figma writes.
 *
 * Pipeline: committed observe → canvas facts → bridge → proposeFromDump →
 * React emitter → Chromium computed-style diff. Zero silent losses; every
 * refusal/residual is named (receipted or explained named-delta).
 *
 * No grade is minted: overallSuccess stays false, humanGrade stays pending.
 *
 *   tsx recipe/canvas-to-code-held-out.ts --write
 *   tsx recipe/canvas-to-code-held-out.ts --check
 */
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import {
  deriveCanvasFacts,
  sha256OfBytes,
  type CanvasFactsDocument,
} from "./canvas-facts.js";
import {
  runCanvasToCodeFromFacts,
  type RenderDiffResult,
  type RenderLedgerRow,
} from "./canvas-to-code.js";
import type { BridgeLedgerRow } from "./canvas-facts-to-dump.js";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import { canonicalJson } from "./normalize.js";
import type { SceneNodeSnapshot } from "./scene-readback.js";

export const HELD_OUT_VERSION = "canvas-to-code-held-out-v1";
export const HELD_OUT_ROOT = "recipe/evidence/canvas-to-code-held-out-v1";
export const HELD_OUT_OBSERVE_PATH = `${HELD_OUT_ROOT}/observe-antd-exam-card.json.gz`;
export const HELD_OUT_CANVAS_FACTS_PATH = `${HELD_OUT_ROOT}/canvas-facts-card.json.gz`;
export const HELD_OUT_BRIDGE_PATH = `${HELD_OUT_ROOT}/bridge-card.json.gz`;
export const HELD_OUT_RENDER_LEDGER_PATH = `${HELD_OUT_ROOT}/render-ledger-card.json.gz`;
export const HELD_OUT_RECEIPT_PATH = `${HELD_OUT_ROOT}/receipt.json`;
export const HELD_OUT_BLOCKERS_PATH = `${HELD_OUT_ROOT}/named-blockers.json`;

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

/** Provenance of the held-out substrate — option 1 of the 3f mission. */
export const HELD_OUT_SUBSTRATE = {
  kind: "scratch-designer-set-not-in-stay-list" as const,
  option: 1 as const,
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  pageId: "33:2",
  pageName: "antd exam 2026-08-23",
  setId: "33:5093",
  setName: "Card",
  axes: ["Size", "Variant"] as const,
  variants: 4,
  method: "read-only-mcp-extract" as const,
  figmaWrites: 0 as const,
  /** Why this set is held-out: never a first-class recipe stay. */
  notInStayList:
    "Card has no recipe:card:* gate and no signed/boilerplate stay page; the antd exam 2026-08-23 page is census/exam chrome, not a recipe mint stay.",
};

export interface HeldOutNamedBlocker {
  id: string;
  stage: "observe" | "canvas-facts" | "bridge" | "emit" | "render" | "product";
  severity: "named-residual" | "named-harness-limit" | "product-incomplete";
  detail: string;
}

export interface HeldOutReceipt {
  artifactVersion: typeof HELD_OUT_VERSION;
  method: "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff";
  substrate: typeof HELD_OUT_SUBSTRATE & {
    observePath: typeof HELD_OUT_OBSERVE_PATH;
    observeSha256: string;
    canvasFactsPath: typeof HELD_OUT_CANVAS_FACTS_PATH;
    /** One-time read-only MCP extract produced the committed observe; exam runs offline. */
    liveReads: 0;
  };
  canvasFacts: {
    nodes: number;
    facts: number;
    normalizations: number;
    receiptedNormalizations: number;
  };
  bridge: {
    facts: number;
    named: number;
    carried: number;
    receipted: number;
    silent: number;
    tokenRenames: number;
  };
  proposal: {
    contractId: string;
    componentName: string;
    projection: string;
    notes: number;
    unbound: number;
    mintedTokens: number;
    childStubs: number;
  };
  emitted: Array<{ path: string; sha256: string }>;
  render: RenderDiffResult["counts"] & { cellsMounted: number };
  deltaSummaries: string[];
  namedBlockers: HeldOutNamedBlocker[];
  humanGrade: "pending";
  gradeInvented: false;
  overallSuccess: false;
  productV1: "incomplete";
}

const loadObserve = (): {
  scene: SceneNodeSnapshot;
  observeSha256: string;
} => {
  const bytes = readFileSync(path.resolve(REPO, HELD_OUT_OBSERVE_PATH));
  return {
    scene: JSON.parse(gunzipSync(bytes).toString("utf8")) as SceneNodeSnapshot,
    observeSha256: sha256OfBytes(bytes),
  };
};

export function deriveHeldOutCanvasFacts(): CanvasFactsDocument {
  const { scene, observeSha256 } = loadObserve();
  return deriveCanvasFacts(scene, {
    observePath: HELD_OUT_OBSERVE_PATH,
    observeSha256,
  });
}

const blockersFromRun = (
  doc: CanvasFactsDocument,
  diff: RenderDiffResult,
): HeldOutNamedBlocker[] => {
  const blockers: HeldOutNamedBlocker[] = [];
  const receiptedNorms = doc.normalizations.filter((n) =>
    n.kind.includes("receipted"),
  );
  if (receiptedNorms.length > 0) {
    blockers.push({
      id: "canvas-facts-binding-receipts",
      stage: "canvas-facts",
      severity: "named-residual",
      detail: `${receiptedNorms.length} binding normalization(s) receipted (partial/nonuniform stroke side weights, etc.) — no IR spelling; nothing invented. Sample: ${receiptedNorms
        .slice(0, 3)
        .map((n) => `${n.ownershipKey}:${n.kind}`)
        .join("; ")}`,
    });
  }
  const harnessReceipts = diff.ledger.filter(
    (row) =>
      row.disposition === "receipted" &&
      typeof row.landing === "string" &&
      /part-tree harness|secondary TEXT|reviewable-inversion residual/i.test(
        row.landing,
      ),
  );
  if (harnessReceipts.length > 0) {
    blockers.push({
      id: "render-harness-nested-anatomy",
      stage: "render",
      severity: "named-harness-limit",
      detail: `${harnessReceipts.length} render receipt(s) name the root-only Chromium harness / reviewable-inversion residual — nested Card anatomy and secondary TEXT are not silently dropped.`,
    });
  }
  blockers.push({
    id: "product-v1-incomplete",
    stage: "product",
    severity: "product-incomplete",
    detail:
      "docs/26 F-checklist amendment for the canvas→code held-out exam is PROPOSED only — owner sign-off required. overallSuccess stays false; product v1 remains incomplete.",
  });
  blockers.push({
    id: "no-human-grade",
    stage: "product",
    severity: "product-incomplete",
    detail:
      "humanGrade stays pending; this exam invents no grade and does not flip any archetype overallSuccess.",
  });
  return blockers;
};

export async function runHeldOutCanvasToCode(
  write: boolean,
): Promise<HeldOutReceipt> {
  const workRoot = write
    ? path.resolve(REPO, HELD_OUT_ROOT)
    : mkdtempSync(path.join(os.tmpdir(), "held-out-check-"));
  try {
    const doc = deriveHeldOutCanvasFacts();
    const bridge = bridgeCanvasFactsToDump(doc);
    if (bridge.counts.silent !== 0)
      throw new Error(
        `held-out: bridge silent=${String(bridge.counts.silent)} — refuse`,
      );

    const outRoot = write ? workRoot : path.join(workRoot, "out");
    const { build, diff, cellsMounted } = await runCanvasToCodeFromFacts(
      doc,
      outRoot,
      {
        regenerateHint: "tsx recipe/canvas-to-code-held-out.ts --write",
        contractFileName: "card.contract.proposed.json",
      },
    );
    if (diff.counts.silent !== 0 || diff.counts.unexplainedDeltas !== 0)
      throw new Error(
        `held-out: render silent=${String(diff.counts.silent)} unexplained=${String(
          diff.counts.unexplainedDeltas,
        )} — refuse`,
      );

    const namedBlockers = blockersFromRun(doc, diff);
    const receipt: HeldOutReceipt = {
      artifactVersion: HELD_OUT_VERSION,
      method:
        "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff",
      substrate: {
        ...HELD_OUT_SUBSTRATE,
        observePath: HELD_OUT_OBSERVE_PATH,
        observeSha256: doc.source.observeSha256,
        canvasFactsPath: HELD_OUT_CANVAS_FACTS_PATH,
        liveReads: 0,
      },
      canvasFacts: {
        nodes: doc.counts.nodes,
        facts: doc.counts.facts,
        normalizations: doc.normalizations.length,
        receiptedNormalizations: doc.normalizations.filter((n) =>
          n.kind.includes("receipted"),
        ).length,
      },
      bridge: {
        ...bridge.counts,
        tokenRenames: bridge.tokenRenames.length,
      },
      proposal: {
        contractId: String((build.contract as { id?: unknown }).id ?? ""),
        componentName: build.componentName,
        projection:
          (build.proposal.projection as { status?: string }).status ?? "",
        notes: build.proposalNotes.length,
        unbound: build.proposal.unbound.length,
        mintedTokens: build.proposal.mintedTokens?.count ?? 0,
        childStubs: (build.proposal.childStubs ?? []).length,
      },
      emitted: build.emittedFiles,
      render: { ...diff.counts, cellsMounted },
      deltaSummaries: diff.deltaSummaries,
      namedBlockers,
      humanGrade: "pending",
      gradeInvented: false,
      overallSuccess: false,
      productV1: "incomplete",
    };

    if (write) {
      mkdirSync(workRoot, { recursive: true });
      writeFileSync(
        path.resolve(REPO, HELD_OUT_CANVAS_FACTS_PATH),
        gzipSync(Buffer.from(`${canonicalJson(doc)}\n`, "utf8"), {
          level: 9,
        }),
      );
      writeFileSync(
        path.resolve(REPO, HELD_OUT_BRIDGE_PATH),
        gzipSync(
          Buffer.from(
            `${canonicalJson({
              dump: bridge.dump,
              ledger: bridge.ledger,
              tokenRenames: bridge.tokenRenames,
              counts: bridge.counts,
            })}\n`,
            "utf8",
          ),
          { level: 9 },
        ),
      );
      writeFileSync(
        path.resolve(REPO, HELD_OUT_RENDER_LEDGER_PATH),
        gzipSync(
          Buffer.from(
            `${canonicalJson({ ledger: diff.ledger, counts: diff.counts })}\n`,
            "utf8",
          ),
          { level: 9 },
        ),
      );
      writeFileSync(
        path.resolve(REPO, HELD_OUT_BLOCKERS_PATH),
        `${canonicalJson(namedBlockers)}\n`,
      );
      writeFileSync(
        path.resolve(REPO, HELD_OUT_RECEIPT_PATH),
        `${canonicalJson(receipt)}\n`,
      );
    } else {
      const committed = JSON.parse(
        readFileSync(path.resolve(REPO, HELD_OUT_RECEIPT_PATH), "utf8"),
      ) as HeldOutReceipt;
      if (canonicalJson(committed) !== canonicalJson(receipt))
        throw new Error(
          "held-out: committed receipt.json does not match recomputation — re-run `tsx recipe/canvas-to-code-held-out.ts --write` and review the diff",
        );
      for (const file of build.emittedFiles) {
        const committedPath = path.resolve(REPO, HELD_OUT_ROOT, file.path);
        const committedHash = sha256(readFileSync(committedPath));
        if (committedHash !== file.sha256)
          throw new Error(
            `held-out: committed ${file.path} drifted (${committedHash} != ${file.sha256})`,
          );
      }
      const committedFacts = gunzipSync(
        readFileSync(path.resolve(REPO, HELD_OUT_CANVAS_FACTS_PATH)),
      ).toString("utf8");
      if (committedFacts !== `${canonicalJson(doc)}\n`)
        throw new Error(
          "held-out: committed canvas-facts-card.json.gz drifted from recomputation",
        );
      const committedBridge = JSON.parse(
        gunzipSync(
          readFileSync(path.resolve(REPO, HELD_OUT_BRIDGE_PATH)),
        ).toString("utf8"),
      ) as {
        ledger: BridgeLedgerRow[];
        counts: HeldOutReceipt["bridge"];
      };
      if (committedBridge.counts.silent !== 0)
        throw new Error("held-out: committed bridge ledger has silent > 0");
      const committedRender = JSON.parse(
        gunzipSync(
          readFileSync(path.resolve(REPO, HELD_OUT_RENDER_LEDGER_PATH)),
        ).toString("utf8"),
      ) as {
        ledger: RenderLedgerRow[];
        counts: Omit<HeldOutReceipt["render"], "cellsMounted">;
      };
      if (
        committedRender.counts.silent !== 0 ||
        committedRender.counts.unexplainedDeltas !== 0
      )
        throw new Error(
          "held-out: committed render ledger has silent or unexplained deltas",
        );
    }
    return receipt;
  } finally {
    if (!write) rmSync(workRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes("--write");
  runHeldOutCanvasToCode(write)
    .then((receipt) => {
      process.stdout.write(
        `${canonicalJson({
          artifactVersion: receipt.artifactVersion,
          mode: write ? "written" : "checked",
          substrate: {
            option: receipt.substrate.option,
            setName: receipt.substrate.setName,
            pageId: receipt.substrate.pageId,
            setId: receipt.substrate.setId,
          },
          bridge: receipt.bridge,
          render: receipt.render,
          namedBlockers: receipt.namedBlockers.map((b) => b.id),
          overallSuccess: receipt.overallSuccess,
          productV1: receipt.productV1,
        })}\n`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
