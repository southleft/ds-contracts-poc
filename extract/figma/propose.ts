/**
 * DESIGN → CONTRACT: propose a full contract (API + anatomy + token bindings)
 * from a node-tree dump of a drawn component set.
 *
 * This ends the "anatomy is human-owned" era for the DESIGN side: a designer
 * draws a net-new component, dump.plugin.js captures its structure, and this
 * module inverts the exact forward mappings scripts/generate-figma.ts applies
 * — so a contract-generated set round-trips to its own contract (the receipt:
 * extract/figma/roundtrip.ts → ROUNDTRIP.md).
 *
 * Inversion rules (each is the inverse of a documented generator rule):
 *
 *   LAYOUT      mode/primary/counter → direction/justify/align via the inverse
 *               of layoutSpec's ALIGN_FIGMA/JUSTIFY_FIGMA maps. MIN inverts to
 *               "unspecified" (start ≡ absent on the canvas). align:stretch is
 *               observable only through its artifact — every eligible child
 *               (FRAME/TEXT without a bound width; instances are excluded by
 *               the generator) carries layoutSizingHorizontal FILL in a column
 *               parent. fillWidth in a ROW parent inverts to layout.grow.
 *               A root drawn exactly at the generator's root default
 *               (row/center/center) proposes NO layout block.
 *
 *   TOKENS      Variable names use SLASHES on the canvas; contract refs use
 *               DOTS in braces. paddingLeft==paddingRight → padding-inline
 *               (same for -block); an asymmetric pair carries as the per-side
 *               longhand channels (padding-left/right, padding-top/bottom)
 *               instead of refusing; four equal radii → border-radius; four
 *               equal stroke weights → border-width; itemSpacing → gap; a
 *               bound width on the ROOT → max-width (a component's outer
 *               dimension is fluid-up-to in code; the canvas renders the max),
 *               elsewhere → width.
 *
 *   ENUM SUBST  Where the same node path binds different tokens across an
 *               enum axis's variants and the paths differ in exactly ONE
 *               segment that equals the variant's canonical value, emit the
 *               substituted ref ({color.feedback.{variant}.background}).
 *               Identical bindings emit the literal ref. Differences that do
 *               NOT correlate with an axis are reported as drift — never
 *               guessed.
 *
 *   TEXT        A text node riding a named TextStyle carries its token
 *               identity ("badge" ← font.badge.size) → font-size ref; the
 *               style group's declared weight token → font-weight, emitted
 *               only when the style's Inter style ≠ 'Medium' (Medium is the
 *               runtime default — a weight token resolving to it is canvas-
 *               indistinguishable from no weight token, a declared fidelity
 *               limit). Style-less text matches (fontSize, fontStyle) against
 *               the derived-style definitions; a unique hit adopts that
 *               identity, anything else is reported. font-family is never
 *               recoverable (everything renders Inter — fidelity scope).
 *
 *   PROPS       Variant axes → enum props (canonical values = camelCase of
 *               the Figma values, default = the first variant's value — the
 *               generator emits the default combo first). A two-value axis
 *               proposes a boolean ONLY when its options are literally
 *               true/false (mirroring extract/reconcile.ts isBoolAxis); an
 *               Off/On axis stays a two-value enum — both states render
 *               truthfully on both surfaces — with a note that a code boolean
 *               is a compatible code-side binding. propRefs.characters →
 *               TEXT props (default = the bound node's characters).
 *
 *   SLOTS       A NATIVE SLOT node (Schema 2025) is a slot part: its layer
 *               name IS its SLOT property's display name, its drawn INSTANCE
 *               child is design-time `defaultContent`, and a "Show
 *               <Property>" visibility binding marks the part optional (and
 *               is NOT an API prop). preferredValues (dump v1.18 carries them
 *               for SLOT as well as INSTANCE_SWAP) resolve by component key
 *               into `accepts` (acceptsMode 'prefer'); unresolvable keys stay
 *               a NAMED note. Uncaptured preferredValues degrade BY NAME with
 *               the reason — REST returns componentPropertyDefinitions EMPTY
 *               for SLOT properties (live probe), so over that transport
 *               accepts is invisible, never "unconstrained". The SLOT
 *               `description` (dump v1.18 slotDescriptions) is read back as a
 *               NOTE where it names a constraint Figma refuses to enforce
 *               (min/max/required/restrict) — the canvas holds the words, not
 *               the rule, so nothing is re-derived from it. The LEGACY
 *               spelling still inverts: a frame whose sole child is a
 *               Slot-utility instance bound to an INSTANCE_SWAP property is
 *               the same slot part (the utility instance's own styling is
 *               elided), which is what lets a pre-native canvas round-trip.
 *               Drawn content becomes defaultContent: LINKED when the child
 *               resolves, else a geometry STUB (dump v1.5 bbox). The first
 *               non-optional slot in tree order is judged the default slot
 *               (name "children").
 *
 *   COMPOSITION A non-Slot INSTANCE child → anatomy `component` ref, id
 *               resolved by componentSetKey FIRST (dump v1.5 instanceSetKey/
 *               instanceKey against in-scope contracts' anchors — rename-
 *               safe), drawn name as the fallback; a name match whose keys
 *               CONTRADICT is refused by name (a foreign kit's "Button" must
 *               not link to ds.button). Its internals (the child component's
 *               own geometry/paints) belong to the child contract and are
 *               elided — but a child with NO contract in scope ships a STUB
 *               rendering the OBSERVED bounding box + primary paint (dump
 *               v1.5) as minted imported.stub-* tokens. Fixed prop values
 *               ride componentProperties; a value tracking a parent enum
 *               axis 1:1 threads as "{parentProp}". Absences stay declared
 *               limits, not guesses.
 *
 *   ARTIFACTS   Two generator artifacts are recognized and folded away:
 *               (1) the auto-injected `label` text node (a root with no parts
 *               but a children-bound text prop) — its text tokens hoist to
 *               the ROOT and the node itself is not a part; (2) the styled-
 *               static-text WRAPPER frame (an empty frame at the generator's
 *               wrap default row/center/center with fills/fixed size, e.g.
 *               Switch's thumb) — proposed as a leaf part with tokens only,
 *               the wrap-default layout elided.
 *
 *   SPACERS     An empty, paint-less, binding-less fill-width frame is a
 *               spacer (a grow part). Spacers present in only a subset of
 *               variants — presence correlated with a single axis value —
 *               reconstruct their visibleWhen ({ prop, equals }); that is how
 *               Switch's structural thumb alignment survives the round trip.
 *
 *   UNBOUND     A raw (variable-less) paint or nonzero literal dimension on a
 *               non-utility node NEVER becomes a token. It is a named entry
 *               in the proposal report: node path, property, raw value, and
 *               nearest-token candidates computed from tokens/*.tokens.json
 *               by value match. The proposal stays schema-valid without it.
 *
 * Every proposal is validated against ContractSchema before it is written.
 */
import type { MinimalChildContract } from "../../core/propose-figma.js";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DumpFile } from "./types.js";
import {
  loadTokenCorpus,
  mergeTokenTrees,
  NoTokenCorpusError,
} from "./tokens.js";
import { loadConfig } from "../config.js";
import {
  capturedTokensDocument,
  capturedVariablesAbsentReceipt,
} from "../../core/captured-tokens.js";
import {
  componentIdSlug,
  dumpCapturesHidden,
  figmaProposalsReport,
  proposeBatchFromDump,
  proposeFromDump,
  type FigmaProposalResult,
} from "../../core/propose-figma.js";

// The inversion engine itself is the pure core module — re-exported here so
// existing importers (extract/figma/roundtrip.ts) keep their import path.
export {
  camel,
  figmaProposalsReport,
  mergeOrders,
  proposeFromDump,
  textOverrideDemandFromDumps,
  type FigmaProposalResult,
  type TextOverrideDemand,
  type UnboundValue,
} from "../../core/propose-figma.js";

// ---------------------------------------------------------------------------
// Corpus helpers + report
// ---------------------------------------------------------------------------

export function loadContractIdsByName(dir: string): Map<string, string> {
  return loadContracts(dir).byName;
}

/** Name→id map plus the contracts themselves (for fixed-prop canonicalization). */
export function loadContracts(dir: string): {
  byName: Map<string, string>;
  byId: Map<string, MinimalChildContract>;
  /** componentSetKey → id (dump v1.5 session linking — key checked FIRST). */
  byKey: Map<string, string>;
} {
  const out = new Map<string, string>();
  const contractsById = new Map<string, MinimalChildContract>();
  const byKey = new Map<string, string>();
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".contract.json"));
  } catch {
    return { byName: out, byId: contractsById, byKey };
  }
  for (const f of files) {
    try {
      const c = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as {
        id?: string;
        name?: string;
        bindings?: { figma?: { anchors?: { componentSetKey?: string | null } } };
      };
      if (c.id && c.name) {
        out.set(c.name, c.id);
        contractsById.set(c.id, c as unknown as MinimalChildContract);
        const key = c.bindings?.figma?.anchors?.componentSetKey;
        if (key) byKey.set(key, c.id);
      }
    } catch {
      /* not a contract — skip */
    }
  }
  return { byName: out, byId: contractsById, byKey };
}

// ---------------------------------------------------------------------------
// CLI: npm run extract:figma -- <dump.json> [--out dir] [--contracts dir]
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const readFlag = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const outDir = readFlag("--out") ?? path.join("extract", "out", "figma");
  const contractsDir = readFlag("--contracts") ?? "contracts";
  // BROWNFIELD: the token corpus is an INPUT, not this repo's layout.
  // --tokens wins; otherwise extract.config.json's "tokens" (the field
  // brownfield orgs already point at their own DTCG files); otherwise the
  // reference layout when it exists, and a named refusal when it does not.
  const tokensFlag = readFlag("--tokens");
  const configFlag = readFlag("--config");
  const reviewableIndex = args.indexOf("--reviewable-inversion");
  const reviewableInversion = reviewableIndex >= 0;
  if (reviewableInversion) args.splice(reviewableIndex, 1);
  const dumpPathArg = args[0];
  if (!dumpPathArg) {
    console.error(
      "Usage: npm run extract:figma -- <dump.json> [--out dir] [--contracts dir] [--tokens a.json,b.json] [--config extract.config.json] [--reviewable-inversion]",
    );
    process.exit(2);
  }
  const root = process.cwd();
  const dump = JSON.parse(
    readFileSync(path.resolve(root, dumpPathArg), "utf8"),
  ) as DumpFile;
  const configTokens = (() => {
    try {
      return loadConfig(configFlag).config.tokens;
    } catch {
      return undefined; // a missing/invalid config is not a token-corpus failure
    }
  })();
  const tokenFiles = tokensFlag
    ? tokensFlag
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : configTokens;
  /** Mirror of tokens.ts REPO_LAYOUT — the fallback corpus loadTokenCorpus
   *  reaches for when nothing was supplied. Named here so the printed
   *  generate command and the fallback warning can state the exact files. */
  const REPO_FALLBACK_FILES = [
    "tokens/primitives.tokens.json",
    "tokens/semantic.tokens.json",
    "tokens/modes/semantic.light.tokens.json",
    "tokens/modes/brand.default.tokens.json",
  ];
  const usedFallbackCorpus = !tokenFiles || tokenFiles.length === 0;
  let corpus;
  try {
    corpus = loadTokenCorpus(root, {
      files: tokenFiles,
      supplyHint:
        'pass --tokens <files> or set "tokens" in extract.config.json',
    });
  } catch (e) {
    if (e instanceof NoTokenCorpusError) {
      console.error(e.message);
      process.exit(2);
    }
    throw e;
  }
  if (usedFallbackCorpus) {
    // MEASURED HAZARD (the export-envelope round): with no supplied corpus a
    // FOREIGN kit's canvas values silently bind this repo's demo tokens
    // (e.g. {font.control.size.md}) wherever the raw values coincide —
    // wrong by construction. Named, never silent.
    console.warn(
      `⚠ No token corpus was supplied (--tokens / extract.config.json "tokens") — the repo-demo reference tokens (${REPO_FALLBACK_FILES.join(", ")}) are the matching corpus. ` +
        "For a FOREIGN design kit this binds its canvas values to THIS repo's token names wherever the raw values coincide (e.g. {font.control.size.md}) — wrong by construction. Pass the kit's own DTCG files instead.",
    );
  }
  const corpusFiles = usedFallbackCorpus
    ? REPO_FALLBACK_FILES
    : (tokenFiles as string[]);
  const loaded = loadContracts(path.resolve(root, contractsDir));
  const contractIdByName = loaded.byName;
  const fileKey = dump._provenance?.fileKey ?? null;

  const batch = proposeBatchFromDump(
    dump as unknown as Record<string, unknown>,
    {
      corpus,
      contractIdByName,
      contractsById: loaded.byId,
      contractIdByKey: loaded.byKey,
      fileKey,
      projectionMode: reviewableInversion ? "reviewable-inversion" : "exact",
      mintUnbound: true,
      hiddenCaptured: dumpCapturesHidden(dump._provenance),
    },
  );
  // Batch-level notes (a `_degradations` row whose nodePath names no set —
  // the REST route's `variables-unavailable` receipt lands here) used to be
  // computed and then dropped by this CLI. They print, and they ride the
  // report below.
  for (const n of batch.notes) console.error(`note: ${n}`);
  if (batch.skipped.length > 0) {
    console.error(
      `REFUSED: ${batch.skipped.length} component set(s) could not be proposed; no proposal artifacts were written.`,
    );
    for (const skip of batch.skipped) {
      console.error(
        `  - ${skip.setName}: ${skip.reason}${skip.detail ? ` — ${skip.detail}` : ""}`,
      );
    }
    process.exit(2);
  }
  const results: Array<{ setName: string; proposal: FigmaProposalResult }> =
    batch.proposals.map(({ setName, ...proposal }) => ({
      setName,
      proposal,
    }));
  mkdirSync(path.resolve(root, outDir), { recursive: true });
  const proposalFiles: string[] = [];
  /** ENVELOPE v2 at the CLI door: the engine's other two outputs land as
   *  files instead of being dropped. Stubs dedupe by id across sets; minted
   *  trees merge into ONE DTCG file (the uui-pipeline convention). */
  const stubById = new Map<string, Record<string, unknown>>();
  const mintedTree: Record<string, unknown> = {};
  let mintedCount = 0;
  for (const { setName: name, proposal } of results) {
    // componentIdSlug, not raw kebab: a set name like "Button / Primary /
    // Medium" must not turn the output filename into a directory walk.
    const file = path.resolve(
      root,
      outDir,
      `${componentIdSlug(name)}.contract.proposed.json`,
    );
    writeFileSync(file, JSON.stringify(proposal.contract, null, 2) + "\n");
    proposalFiles.push(path.relative(root, file));
    console.log(
      `✔ ${name} → ${path.relative(root, file)} (${proposal.notes.length} notes, ${proposal.unbound.length} unbound value(s))`,
    );
    for (const stub of proposal.childStubs ?? []) {
      const stubId = String((stub as { id?: unknown }).id ?? "");
      if (stubId) stubById.set(stubId, stub);
    }
    if (proposal.mintedTokens) {
      Object.assign(
        mintedTree,
        mergeTokenTrees([mintedTree, proposal.mintedTokens.tree]),
      );
    }
  }
  // Count the MERGED tree's leaves — summing per-set counts would double-
  // count a leaf two sets both minted, and a wrong count is a wrong receipt.
  const countLeaves = (node: Record<string, unknown>): number =>
    Object.entries(node).reduce((n, [k, v]) => {
      if (k.startsWith("$")) return n;
      if (v && typeof v === "object" && "$value" in (v as object)) return n + 1;
      if (v && typeof v === "object")
        return n + countLeaves(v as Record<string, unknown>);
      return n;
    }, 0);
  mintedCount = countLeaves(mintedTree);
  // A stub whose id a REAL proposal (or an in-scope contract) already claims
  // is not written — the real document wins, and the skip is named.
  const proposedIds = new Set(
    results.map(({ proposal }) =>
      String((proposal.contract as { id?: unknown }).id ?? ""),
    ),
  );
  const stubFiles: string[] = [];
  const stubSkips: string[] = [];
  for (const [stubId, stub] of stubById) {
    if (proposedIds.has(stubId) || loaded.byId.has(stubId)) {
      stubSkips.push(
        `stub ${stubId}: skipped — a real contract with this id is already in scope`,
      );
      continue;
    }
    const file = path.resolve(
      root,
      outDir,
      `${componentIdSlug(stubId)}.stub.contract.proposed.json`,
    );
    writeFileSync(file, JSON.stringify(stub, null, 2) + "\n");
    stubFiles.push(path.relative(root, file));
    console.log(
      `✔ stub ${stubId} → ${path.relative(root, file)} (auto-proposed; replace by importing the real child set)`,
    );
  }
  for (const line of stubSkips) console.log(`  ${line}`);
  let mintedFile: string | null = null;
  if (Object.keys(mintedTree).length > 0) {
    const file = path.resolve(root, outDir, "minted.dtcg.json");
    writeFileSync(file, JSON.stringify(mintedTree, null, 2) + "\n");
    mintedFile = path.relative(root, file);
    console.log(
      `✔ minted token tree (${mintedCount} token(s), provisional names) → ${mintedFile}`,
    );
  }

  // FC-DUMP-PROPOSE-CAPTURED-VARIABLES-DROPPED: the dump's `_variables`
  // channel (values + per-mode trees, dump v1.4/v1.6) used to be discarded
  // here with no receipt — a foreign kit's modes vanished between the dump
  // and this folder while the playground and visual-parity read the same
  // channel. It lands beside minted.dtcg.json as captured.dtcg.json (the
  // same layer capturedTokensFromDump builds for them), and its absence is
  // a named line, never nothing.
  const capturedDoc = capturedTokensDocument(
    dump as unknown as Record<string, unknown>,
  );
  let capturedFile: string | null = null;
  if (capturedDoc) {
    const file = path.resolve(root, outDir, "captured.dtcg.json");
    writeFileSync(file, JSON.stringify(capturedDoc.document, null, 2) + "\n");
    capturedFile = path.relative(root, file);
    console.log(
      `✔ captured variables (${capturedDoc.layer.count} token(s), ${Object.keys(capturedDoc.layer.modes ?? {}).length} mode tree(s), ${capturedDoc.layer.skipped.length} skipped by name) → ${capturedFile}`,
    );
  } else {
    console.log(
      `- ${capturedVariablesAbsentReceipt(dump as unknown as Record<string, unknown>)}`,
    );
  }

  // The runnable next step — the exact generate invocation whose --tokens
  // carries the corpus this run matched against PLUS the minted tree, so the
  // first generate resolves every ref instead of refusing one by name.
  const generateCommand =
    proposalFiles.length > 0
      ? `npx ds-contracts generate ${[...proposalFiles, ...stubFiles].join(" ")} --out ${path.join(outDir, "generated")} --stories --tokens ${[...corpusFiles, ...(capturedFile ? [capturedFile] : []), ...(mintedFile ? [mintedFile] : [])].join(",")}`
      : null;

  const reportExtras = [
    "",
    "## Export envelope (v2) — everything this run wrote",
    "",
    ...proposalFiles.map((f) => `- contract: ${f}`),
    ...stubFiles.map(
      (f) =>
        `- stub contract: ${f} (auto-proposed; replace by importing the real child set)`,
    ),
    ...stubSkips.map((l) => `- ${l}`),
    ...(mintedFile
      ? [
          `- minted token tree: ${mintedFile} (${mintedCount} token(s); machine-derived provisional names)`,
        ]
      : ["- no minted token tree (nothing needed minting)"]),
    ...(capturedDoc && capturedFile
      ? [`- captured variables: ${capturedFile} — ${capturedDoc.receipt}`]
      : [
          `- ${capturedVariablesAbsentReceipt(dump as unknown as Record<string, unknown>)}`,
        ]),
    ...(batch.notes.length > 0
      ? ["", "## Batch notes (receipts no single set owns)", "", ...batch.notes.map((n) => `- ${n}`)]
      : []),
    ...(usedFallbackCorpus
      ? [
          `- ⚠ corpus fallback: no token corpus was supplied, so the repo-demo reference tokens (${REPO_FALLBACK_FILES.join(", ")}) matched the canvas values — for a foreign kit this binds their values to this repo's token names, wrong by construction.`,
        ]
      : [`- token corpus: ${corpusFiles.join(", ")}`]),
    ...(generateCommand
      ? ["", "Next — generate the code:", "", "```", generateCommand, "```"]
      : []),
  ];
  writeFileSync(
    path.resolve(root, outDir, "figma-proposals.md"),
    figmaProposalsReport(results) + reportExtras.join("\n") + "\n",
  );
  console.log(`✔ report → ${path.join(outDir, "figma-proposals.md")}`);
  if (generateCommand) {
    console.log(
      `\nNext — generate the code (the captured and minted trees ride --tokens so every ref resolves):\n  ${generateCommand}`,
    );
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main();
}
