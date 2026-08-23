/**
 * DESIGN→CODE CENSUS — the pipeline half.
 *
 *   npx tsx extract/figma/census/design-to-code.ts --write     # record rows
 *   (the gate runs computeKit() in memory and compares — scripts/canvas-census-check.ts --phase design-to-code)
 *
 * THE OWNER'S BAR (2026-08-23): "seamlessly transition a designed component,
 * along with all its properties and metadata, to a coded component without
 * using AI. A deterministic way of creating something from design to code."
 *
 * WHAT A DESIGNER RUNS (the exact CLI sequence this module re-executes from
 * the committed fixtures, in-process, byte-for-byte):
 *
 *   1. npm run extract:figma:rest -- https://www.figma.com/design/<fileKey> \
 *        --out dump.json                       # REST GET only; FIGMA_TOKEN
 *   2. npm run extract:figma -- dump.json --out proposed \
 *        --tokens <the kit's DTCG files>       # add --reviewable-inversion
 *                                              # for an unstamped foreign kit
 *   3. npx ds-contracts generate proposed/*.contract.proposed.json \
 *        --out src --stories --tokens <kit DTCG>,proposed/minted.dtcg.json
 *      (and --target web-components --emitter
 *       @ds-contracts/emitter-web-components for the WC surface)
 *
 * DETERMINISM IS MEASURED, NOT ASSUMED: propose runs TWICE and generate runs
 * TWICE per kit; the gate refuses unless both passes are byte-identical
 * (sha256 per file), and the committed row JSON pins those hashes so any
 * engine drift flips `census:check --phase design-to-code` red by name.
 *
 * TOKEN LAYER RULE (flowbite): the kit's own DTCG files are the corpus; the
 * freshly minted tree supplies ONLY names the corpus does not already define
 * (the corpus value wins — the fresh mint re-derives a handful of geometry
 * leaves from REST-rounded boxes, e.g. 71.23px vs the authored 71.2344px,
 * and `generate` rightly refuses a two-value slot; the prune is recorded).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { ContractSchema } from "../../../scripts/contract-schema.js";
import {
  componentIdSlug,
  proposeBatchFromDump,
  type FigmaProposalResult,
} from "../../../core/propose-figma.js";
import { mapRestToDump, type RestNodesResponse } from "../rest/map.js";
import { loadTokenCorpus, mergeTokenTrees } from "../tokens.js";
import { generateComponents } from "../../../scripts/generate-components.js";
import { getEmitters, registerEmitter } from "../../../core/emitter.js";
import { buildEmitterCtxWithRouting } from "../../../packages/cli/src/lib.js";
import type { Contract } from "../../../scripts/contract-schema.js";
import { accountSet, type SetAccount } from "./d2c-facts.js";
import type { DumpDegradation, DumpFile, DumpSet } from "../types.js";
import { REPO } from "./corpus.js";

export const D2C_FIXTURE_DIR = "extract/figma/fixtures/census-d2c";
export const D2C_DIR = "parity/receipts/v1/census/design-to-code";
export const D2C_RECEIPT_PATH = "parity/receipts/v1/DESIGN-TO-CODE-CENSUS.md";

export interface D2cKitDef {
  kit: string;
  fileKey: string;
  /** exact for a stamped, pipeline-drawn kit; reviewable-inversion for a
   *  foreign designer kit. */
  mode: "exact" | "reviewable-inversion";
  /** The kit's own DTCG corpus (empty = foreign kit with no DTCG twin — an
   *  empty corpus object, the exam shape). */
  corpusFiles: string[];
  describe: string;
}

export const D2C_KITS: D2cKitDef[] = [
  {
    kit: "flowbite",
    fileKey: "59mLQlOMiD5w5za6SUcoO5",
    mode: "exact",
    corpusFiles: [
      "examples/tailwind/tokens/tailwind.dtcg.json",
      "examples/tailwind/tokens/tailwind-minted.dtcg.json",
    ],
    describe:
      "the Flowbite eight (demo file 59mLQlOMiD5w5za6SUcoO5) — stamped, pipeline-drawn sets; EXACT mode over the REST route (dump v1.32 plugin_data stamps)",
  },
  {
    kit: "figma-ds",
    fileKey: "aekVseUceg35tVn62knRrj",
    mode: "reviewable-inversion",
    corpusFiles: [],
    describe:
      'the hand-built "Figma Design System" kit (aekVseUceg35tVn62knRrj) — 15 unstamped designer sets, foreign-kit shape (no DTCG twin, empty corpus)',
  },
];

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface D2cSetResult {
  setName: string;
  id: string;
  nodeId: string;
  variantCount: number;
  proposal: FigmaProposalResult & { setName: string };
  contract: Contract;
  account: SetAccount;
}

export interface D2cKitRun {
  def: D2cKitDef;
  dump: DumpFile;
  sets: D2cSetResult[];
  /** sha256 per generated file, both surfaces, run 1. */
  fileHashes: Map<string, string>;
  /** Byte-idempotence proof: propose twice + generate twice, all equal. */
  idempotent: { propose: boolean; generate: boolean; detail: string };
  /** Minted leaves dropped because the kit corpus already defines the path
   *  (corpus value wins) — named, never silent. */
  mintedPruned: string[];
  generatedCount: { react: number; wc: number };
  tokensCss: string;
}

const sha = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

const VARIABLES_REFUSAL = {
  kind: "scope" as const,
  status: 403,
  message:
    "the capture token lacked the file_variables:read scope (HTTP 403, recorded at fixture capture) — every binding degrades to its resolved literal",
  fix: "regenerate the token with file_variables:read",
};

export function mapKit(kit: D2cKitDef): { fixture: RestNodesResponse; dump: DumpFile } {
  const fixture = loadFixture(kit);
  const { dump } = mapRestToDump(fixture, {
    fileKey: kit.fileKey,
    variablesUnavailable: VARIABLES_REFUSAL,
  });
  return { fixture, dump };
}

export function loadFixture(kit: D2cKitDef): RestNodesResponse {
  return JSON.parse(
    readFileSync(path.join(REPO, D2C_FIXTURE_DIR, `${kit.kit}.rest-nodes.json`), "utf8"),
  ) as RestNodesResponse;
}

export function proposeKit(kit: D2cKitDef, dump: DumpFile) {
  const corpus =
    kit.corpusFiles.length > 0
      ? loadTokenCorpus(REPO, { files: kit.corpusFiles })
      : loadTokenCorpus(REPO, { files: [path.join(D2C_FIXTURE_DIR, "empty.dtcg.json")] });
  return proposeBatchFromDump(dump as unknown as Record<string, unknown>, {
    corpus,
    contractIdByName: new Map(),
    contractsById: new Map(),
    contractIdByKey: new Map(),
    fileKey: (dump._provenance?.fileKey as string) ?? null,
    projectionMode: kit.mode,
    mintUnbound: true,
    hiddenCaptured: false,
  });
}

/** Prune fresh-minted leaves whose dotted path an existing corpus file
 *  already defines — the corpus value wins; returns the pruned refs. */
function pruneMinted(
  minted: Record<string, unknown>,
  corpusTrees: Array<Record<string, unknown>>,
): string[] {
  const pruned: string[] = [];
  const has = (tree: Record<string, unknown>, segs: string[]): boolean => {
    let cur: unknown = tree;
    for (const s of segs) {
      if (!cur || typeof cur !== "object") return false;
      cur = (cur as Record<string, unknown>)[s];
    }
    return !!cur && typeof cur === "object" && "$value" in (cur as object);
  };
  const walk = (node: Record<string, unknown>, segs: string[]): void => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$") || !v || typeof v !== "object") continue;
      const next = [...segs, k];
      if ("$value" in (v as object)) {
        if (corpusTrees.some((t) => has(t, next))) {
          delete node[k];
          pruned.push(next.join("."));
        }
      } else {
        walk(v as Record<string, unknown>, next);
        if (Object.keys(v as object).filter((x) => !x.startsWith("$")).length === 0) delete node[k];
      }
    }
  };
  walk(minted, []);
  return pruned.sort();
}

export async function runKit(kit: D2cKitDef): Promise<D2cKitRun> {
  const fixture = loadFixture(kit);
  const map = () =>
    mapRestToDump(fixture, { fileKey: kit.fileKey, variablesUnavailable: VARIABLES_REFUSAL });
  const { dump } = map();

  // Propose twice — byte-identical or refuse.
  const batch1 = proposeKit(kit, dump);
  const batch2 = proposeKit(kit, map().dump);
  if (batch1.skipped.length > 0) {
    throw new Error(
      `${kit.kit}: ${batch1.skipped.length} set(s) refused to propose — ${batch1.skipped
        .map((s) => `${s.setName}: ${s.reason}`)
        .join("; ")}`,
    );
  }
  const proposeBytes = (b: typeof batch1) =>
    JSON.stringify(b.proposals.map((p) => [p.setName, p.contract, p.mintedTokens?.tree ?? null, p.notes]));
  const proposeIdempotent = proposeBytes(batch1) === proposeBytes(batch2);

  // Merge minted trees; prune against the kit corpus (corpus wins).
  const minted: Record<string, unknown> = {};
  for (const p of batch1.proposals)
    if (p.mintedTokens) Object.assign(minted, mergeTokenTrees([minted, p.mintedTokens.tree]));
  const corpusTrees = kit.corpusFiles.map(
    (f) => JSON.parse(readFileSync(path.join(REPO, f), "utf8")) as Record<string, unknown>,
  );
  const mintedPruned = pruneMinted(minted, corpusTrees);

  // Write proposals + minted into a temp dir, generate BOTH surfaces TWICE.
  const generateOnce = async (label: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), `d2c-${kit.kit}-${label}-`));
    const contractFiles: string[] = [];
    for (const p of batch1.proposals) {
      const f = path.join(dir, `${componentIdSlug(p.setName)}.contract.proposed.json`);
      writeFileSync(f, JSON.stringify(p.contract, null, 2) + "\n");
      contractFiles.push(f);
      for (const stub of p.childStubs ?? []) {
        const sf = path.join(dir, `${componentIdSlug(String((stub as { id?: unknown }).id))}.stub.contract.proposed.json`);
        writeFileSync(sf, JSON.stringify(stub, null, 2) + "\n");
        if (!contractFiles.includes(sf)) contractFiles.push(sf);
      }
    }
    const mintedFile = path.join(dir, "minted.dtcg.json");
    writeFileSync(mintedFile, JSON.stringify(minted, null, 2) + "\n");
    const tokenFiles = [
      ...kit.corpusFiles.map((f) => path.join(REPO, f)),
      mintedFile,
    ];
    const reactOut = path.join(dir, "react");
    const cwd = process.cwd();
    process.chdir(REPO); // generateComponents resolves icons/tokens against cwd
    let generated: string[];
    let tokensCssPath: string;
    try {
      const res = await generateComponents({
        contractFiles,
        tokenFiles,
        outDir: reactOut,
        stories: true,
        regenerateHint: "extract/figma/census/design-to-code.ts (design→code census)",
      });
      generated = res.generated;
      tokensCssPath = res.tokensCss.path;
    } finally {
      process.chdir(cwd);
    }
    // WC surface — the registered emitter, same contracts, same tokens.
    const wcMod = (await import("@ds-contracts/emitter-web-components")) as unknown as {
      default: Parameters<typeof registerEmitter>[0];
    };
    if (!getEmitters().some((e) => e.name === "web-components")) registerEmitter(wcMod.default);
    const wc = getEmitters().find((e) => e.name === "web-components");
    if (!wc) throw new Error("web-components emitter did not register");
    const contracts = new Map<string, Contract>();
    for (const f of contractFiles) contracts.set(
      (JSON.parse(readFileSync(f, "utf8")) as { id: string }).id,
      ContractSchema.parse(JSON.parse(readFileSync(f, "utf8"))),
    );
    const { ctx } = buildEmitterCtxWithRouting(contracts, tokenFiles, undefined, kit.fileKey);
    const files = new Map<string, string>();
    for (const [, contract] of contracts) {
      for (const file of wc.emit(contract, ctx)) files.set(`wc/${file.path}`, file.contents);
    }
    // Collect every byte generated.
    const collected = new Map<string, string>();
    const walkDir = (d: string, prefix: string): void => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const abs = path.join(d, entry.name);
        if (entry.isDirectory()) walkDir(abs, `${prefix}${entry.name}/`);
        else collected.set(`react/${prefix}${entry.name}`, readFileSync(abs, "utf8"));
      }
    };
    walkDir(reactOut, "");
    for (const [k, v] of files) collected.set(k, v);
    const tokensCss = readFileSync(tokensCssPath, "utf8");
    rmSync(dir, { recursive: true, force: true });
    return { collected, generatedCount: { react: generated.length, wc: contracts.size }, tokensCss };
  };
  const g1 = await generateOnce("a");
  const g2 = await generateOnce("b");
  const hash1 = new Map([...g1.collected].map(([k, v]) => [k, sha(v)] as const));
  const hash2 = new Map([...g2.collected].map(([k, v]) => [k, sha(v)] as const));
  const generateIdempotent =
    hash1.size === hash2.size && [...hash1].every(([k, v]) => hash2.get(k) === v);
  const detailParts: string[] = [];
  if (!generateIdempotent) {
    for (const [k, v] of hash1) if (hash2.get(k) !== v) detailParts.push(k);
  }

  // Per-set accounting.
  const degradations = (dump._degradations ?? []) as DumpDegradation[];
  const captureGaps = ((dump._provenance as { captureGaps?: string[] } | undefined)?.captureGaps ?? []);
  const sets: D2cSetResult[] = [];
  for (const p of batch1.proposals) {
    const dumpSet = (dump as unknown as Record<string, DumpSet>)[p.setName];
    const entry = Object.values(fixture.nodes).find((e) => e?.document.name === p.setName);
    if (!entry) throw new Error(`${kit.kit}: fixture has no node entry for set "${p.setName}"`);
    const doc = entry.document;
    const meta = entry.componentSets?.[doc.id] ?? entry.components?.[doc.id];
    const generatedForSet = new Map(
      [...g1.collected].filter(([k]) => {
        const name = (p.contract as { name?: string }).name ?? "";
        const tag = String((p.contract as { id?: string }).id ?? "").replace(/\./, "-");
        return k.includes(`/${name}.`) || k.includes(`/${name}/`) || k.includes(tag);
      }),
    );
    const contract = ContractSchema.parse(p.contract);
    const account = accountSet({
      doc: doc as never,
      meta,
      dumpSet,
      degradations: degradations.filter(
        (d) => d.nodePath.startsWith(`${p.setName}:`) || d.nodePath.startsWith("file:") || d.nodePath.startsWith(p.setName),
      ),
      captureGaps,
      contract: p.contract as Record<string, unknown>,
      notes: p.notes,
      generated: generatedForSet,
    });
    sets.push({
      setName: p.setName,
      id: String((p.contract as { id?: unknown }).id),
      nodeId: doc.id,
      variantCount: dumpSet.variants.length,
      proposal: p,
      contract,
      account,
    });
  }
  return {
    def: kit,
    dump,
    sets,
    fileHashes: hash1,
    idempotent: {
      propose: proposeIdempotent,
      generate: generateIdempotent,
      detail: detailParts.join(", "),
    },
    mintedPruned,
    generatedCount: g1.generatedCount,
    tokensCss: g1.tokensCss,
  };
}

// ---------------------------------------------------------------------------
// Row JSON — committed per set; the gate recomputes and compares.
// ---------------------------------------------------------------------------

export interface D2cRowJson {
  kit: string;
  id: string;
  setName: string;
  nodeId: string;
  mode: string;
  variantCount: number;
  contractSha256: string;
  carriage: { carried: number; named: number; silent: number };
  silentRows: Array<{ path: string; channel: string; value: string }>;
  /** channel → [carried, named, silent] across the set's rows. */
  channels: Record<string, [number, number, number]>;
  /** API surface landing table — the facts a designer asks about first. */
  api: Array<{ fact: string; value: string; disposition: string; landing: string }>;
  generatedFiles: Record<string, string>;
  notesCount: number;
}

export function rowJson(kit: D2cKitRun, set: D2cSetResult): D2cRowJson {
  const channels: Record<string, [number, number, number]> = {};
  for (const r of set.account.rows) {
    const c = (channels[r.channel] ??= [0, 0, 0]);
    if (r.disposition === "CARRIED") c[0]++;
    else if (r.disposition === "NAMED") c[1]++;
    else c[2]++;
  }
  const api = set.account.rows
    .filter((r) => r.path === set.setName || r.path.startsWith(`${set.setName}.propertyDefinitions`))
    .map((r) => ({ fact: r.channel, value: r.value, disposition: r.disposition, landing: r.evidence }));
  const prefixes = [`react/${set.contract.name}/`, `react/${set.contract.name}.`, `wc/${set.id.replace(/\./, "-")}`];
  const generatedFiles: Record<string, string> = {};
  for (const [k, v] of kit.fileHashes)
    if (prefixes.some((p) => k.startsWith(p))) generatedFiles[k] = v;
  return {
    kit: kit.def.kit,
    id: set.id,
    setName: set.setName,
    nodeId: set.nodeId,
    mode: kit.def.mode,
    variantCount: set.variantCount,
    contractSha256: sha(JSON.stringify(set.proposal.contract)),
    carriage: {
      carried: set.account.carried,
      named: set.account.named,
      silent: set.account.silent,
    },
    silentRows: set.account.rows
      .filter((r) => r.disposition === "SILENT")
      .map((r) => ({ path: r.path, channel: r.channel, value: r.value })),
    channels,
    api,
    generatedFiles,
    notesCount: set.proposal.notes.length,
  };
}

export const stableRow = (row: D2cRowJson): string => JSON.stringify(row, null, 2) + "\n";

// ---------------------------------------------------------------------------
// CLI: --write records rows under parity/receipts/v1/census/design-to-code/
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  for (const def of D2C_KITS) {
    const run = await runKit(def);
    let silent = 0;
    for (const set of run.sets) {
      silent += set.account.silent;
      if (write) {
        const dir = path.join(REPO, D2C_DIR, def.kit, set.id);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "d2c.json"), stableRow(rowJson(run, set)));
      }
      console.log(
        `${set.account.silent > 0 ? "✘" : "✔"} ${def.kit}/${set.id} — ${set.account.carried} carried · ${set.account.named} named · ${set.account.silent} SILENT` +
          (set.account.silent > 0
            ? `\n${set.account.rows
                .filter((r) => r.disposition === "SILENT")
                .map((r) => `    SILENT ${r.path} · ${r.channel} · ${r.value}`)
                .join("\n")}`
            : ""),
      );
    }
    console.log(
      `${def.kit}: ${run.sets.length} set(s); propose idempotent=${run.idempotent.propose}; generate idempotent=${run.idempotent.generate}${run.idempotent.detail ? ` (${run.idempotent.detail})` : ""}; ` +
        `react ${run.generatedCount.react} component(s) + wc ${run.generatedCount.wc}; minted pruned ${run.mintedPruned.length}; SILENT total ${silent}`,
    );
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) await main();
