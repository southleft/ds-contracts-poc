/**
 * `ds-contracts propose-pr <file> --repo owner/name` — a canvas proposal
 * becomes a reviewable PR carrying BOTH halves: the contract AND the code it
 * generates.
 *
 * THE LOOP THIS CLOSES (task #40). The plugin's Send tab reads a selected
 * component set and proposes a CONTRACT. Until now this command committed
 * that contract and stopped, so the PR contained a document nobody could
 * run, and a human had to know to go away and run `ds-contracts generate`
 * separately. That second hop was invisible. It is now part of the same PR:
 * the registered emitters run here, and their output is committed next to
 * the contract.
 *
 * PROVENANCE IS PRINTED, NOT ASSUMED. A component set this tool GENERATED
 * carries a ds_contracts/contractId marker, and canvas → contract → code is
 * a true round trip. A HAND-BUILT set carries no marker: the contract is an
 * INVERSION of what could be read off the canvas, so the generated component
 * is a starting point, not a reproduction. The plugin knows which case it is
 * and stamps it into the CONTRACT-PROPOSAL envelope; the PR body prints the
 * matching sentence from core/canvas-code-plan.ts. When the input is a bare
 * contract document there is no canvas provenance to state, and the body
 * says exactly that instead of picking a side.
 *
 * Token discipline (the playground credential pattern): the fine-grained
 * GitHub token comes from --token or the DS_CONTRACTS_GITHUB_TOKEN /
 * GITHUB_TOKEN env vars, lives in one local variable for the duration of
 * the run, and is NEVER persisted, logged, or echoed. gh REST via fetch —
 * no gh binary, no SDK.
 *
 * <file> is a proposed contract document (*.contract.json), a CONTRACT-
 * PROPOSAL envelope straight out of the plugin (the contract inside is
 * unwrapped — committing the envelope would put a non-contract where a
 * contract belongs), or a parity/diagnose diff report (JSON, committed
 * verbatim, no code).
 *
 * TARGETS ARE NEVER GUESSED. --target wins; otherwise ds-contracts.config.json's
 * `generate` section decides (the file `init --detect` writes); with neither,
 * the PR carries the contract alone and says so. A missing framework is a
 * fact to report, not a default to invent.
 *
 * --dry-run prints the exact REST steps, every file, both diffs and the
 * provenance sentence — no token, no network. The eval pins this plan.
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  provenanceSentence,
  type CanvasProvenance,
} from "../../../../core/canvas-code-plan.js";
import {
  assertContractProvenance,
  type ProvenancedContract,
} from "../../../../core/contract-provenance.js";
import { emitterByName, getEmitters } from "../../../../core/emitter.js";
import { generateComponents } from "../../../../scripts/generate-components.js";
import {
  contractFileNameForId,
  proposalFileNameForId,
  unifiedDiff,
} from "./figma.js";
import {
  buildEmitterCtxWithRouting,
  CliUsageError,
  expandTokenArgs,
  flagString,
  loadContracts,
  parseFlags,
  parseTokenEntry,
  splitList,
  tokenPathsOf,
  withTokenDiagnostics,
} from "../lib.js";

const API = "https://api.github.com";

/** One file the PR would contain. */
export interface PrFile {
  /** Repository-relative destination path. */
  destPath: string;
  contents: string;
  /** 'contract' = the source of truth (the proposal AND any auto-proposed
   *  stub contract); 'tokens' = the minted DTCG tree the proposal's refs
   *  resolve through; 'code' = an emitter projection. */
  kind: "contract" | "tokens" | "code";
  /** Emit target for code files (react, html, …); undefined otherwise. */
  target?: string;
  /** Proposal origin, used to preserve an existing real contract instead of
   * replacing it with an auto-proposed stub. */
  proposalRole?: "main" | "stub";
}

interface PrPlan {
  repo: string;
  base: string | null; // null → repo default branch, resolved live
  branch: string;
  destPath: string;
  title: string;
  body: string;
  contentBytes: number;
  /** Every file the PR would carry — the contract first, then code. */
  files: PrFile[];
  provenance: CanvasProvenance;
}

// ---------------------------------------------------------------------------
// Input: contract document, CONTRACT-PROPOSAL envelope, or diff report
// ---------------------------------------------------------------------------

const CONTRACT_PROPOSAL_TYPE = "CONTRACT-PROPOSAL";

export interface ProposalInput {
  /** Exactly the bytes that get committed at the contract path. */
  content: string;
  /** The parsed document `summarize()` reads (the contract, when there is one). */
  parsed: unknown;
  /** The contract document itself, when the input carries one. */
  contract: Record<string, unknown> | null;
  provenance: CanvasProvenance;
  /** True when a CONTRACT-PROPOSAL envelope was unwrapped to its contract. */
  unwrapped: boolean;
  /** ENVELOPE v2: the envelope's auto-proposed stub contracts (each files as
   *  its own *.contract.json next to the proposal). Empty for old envelopes
   *  and bare contract documents. */
  childStubs: Array<Record<string, unknown>>;
  /** ENVELOPE v2: the minted DTCG tree the proposal's {imported.*} refs
   *  resolve through. null when the envelope minted nothing. */
  mintedTree: Record<string, unknown> | null;
  /** Plain-words notes about how the input was read — always surfaced. */
  notes: string[];
}

function validateProposalChildren(
  contract: Record<string, unknown>,
  childStubs: Array<Record<string, unknown>>,
): void {
  const mainId = typeof contract.id === "string" ? contract.id : null;
  const mainFile = mainId ? contractFileNameForId(mainId) : null;
  const seenIds = new Set<string>();
  const seenFiles = new Map<string, string>();
  for (const [i, stub] of childStubs.entries()) {
    const stubId =
      typeof stub.id === "string" && stub.id.length > 0 ? stub.id : null;
    if (!stubId) {
      throw new CliUsageError(
        `childStubs[${i}] has no non-empty string id — propose-pr refuses an unidentifiable contract before planning any write.`,
      );
    }
    if (stubId === mainId) {
      throw new CliUsageError(
        `child stub "${stubId}" collides with the main proposed contract id — no files or requests were written.`,
      );
    }
    if (seenIds.has(stubId)) {
      throw new CliUsageError(
        `duplicate child stub id "${stubId}" — no files or requests were written.`,
      );
    }
    seenIds.add(stubId);
    const stubFile = contractFileNameForId(stubId);
    if (stubFile === mainFile) {
      throw new CliUsageError(
        `child stub "${stubId}" resolves to the main contract destination "${stubFile}" — no files or requests were written.`,
      );
    }
    const prior = seenFiles.get(stubFile);
    if (prior) {
      throw new CliUsageError(
        `child stubs "${prior}" and "${stubId}" resolve to the same destination "${stubFile}" — no files or requests were written.`,
      );
    }
    seenFiles.set(stubFile, stubId);
  }
}

/** Shared by propose-pr and figma receive --apply: generated destinations are
 *  built from untrusted proposal content (contract.name) and must never carry
 *  absolute paths, empty segments, or `..`. */
export function assertSafeRepoPath(destPath: string): void {
  const segments = destPath.split("/");
  if (
    destPath.length === 0 ||
    path.isAbsolute(destPath) ||
    path.win32.isAbsolute(destPath) ||
    destPath.includes("\\") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new CliUsageError(
      `REFUSED unsafe repository destination "${destPath}" — destinations must be relative, normalized paths.`,
    );
  }
}

export function assertUniqueDestinations(
  files: Array<{ destPath: string }>,
): void {
  const seen = new Set<string>();
  for (const file of files) {
    assertSafeRepoPath(file.destPath);
    if (seen.has(file.destPath)) {
      throw new CliUsageError(
        `REFUSED duplicate destination "${file.destPath}" — no files or requests were written.`,
      );
    }
    seen.add(file.destPath);
  }
}

/** Defense in depth: every generated path must resolve under the configured
 *  generate.out tree (trusted config), not merely look relative. */
export function assertDestinationsUnderRoot(
  files: Array<{ destPath: string }>,
  cwd: string,
  rootDir: string,
): void {
  const resolvedRoot = path.resolve(cwd, rootDir);
  for (const file of files) {
    assertSafeRepoPath(file.destPath);
    const resolved = path.resolve(cwd, file.destPath);
    if (
      resolved !== resolvedRoot &&
      !resolved.startsWith(resolvedRoot + path.sep)
    ) {
      throw new CliUsageError(
        `REFUSED generated destination "${file.destPath}" — resolves outside generate.out (${resolvedRoot}); no files were written.`,
      );
    }
  }
}

/**
 * Read <file> and decide what is actually being proposed.
 *
 * DEFECT THIS FIXES: the plugin's download link names a base-less proposal
 * `<id>.contract.json`, but its CONTENTS are a CONTRACT-PROPOSAL envelope.
 * Committing that verbatim (what this command used to do) puts an envelope
 * where the repo expects a contract — `generate` and every loader then
 * refuse it. `figma receive` already unwraps; this now does the same.
 */
export function readProposalInput(file: string): ProposalInput {
  let raw: string;
  let parsed: unknown;
  try {
    raw = readFileSync(file, "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CliUsageError(
      `${file}: not readable JSON — ${String(err instanceof Error ? err.message : err)}`,
    );
  }
  const notes: string[] = [];
  const doc = parsed as Record<string, unknown>;
  const isEnvelope =
    !!doc && typeof doc === "object" && doc.type === CONTRACT_PROPOSAL_TYPE;

  if (isEnvelope) {
    const proposed = doc.proposedContract;
    if (!proposed || typeof proposed !== "object" || Array.isArray(proposed)) {
      throw new CliUsageError(
        `${path.basename(file)}: a ${CONTRACT_PROPOSAL_TYPE} with no "proposedContract" object — re-run "Read the set & diff" in the plugin and download again.`,
      );
    }
    const contract = proposed as Record<string, unknown>;
    assertContractProvenance(
      contract as ProvenancedContract,
      String(contract.id ?? path.basename(file)),
    );
    // The plugin stamps { toolGenerated } from the set's marker. An older
    // build sends no provenance at all — that is 'unrecorded', never a guess.
    const stamped = doc.provenance as { toolGenerated?: unknown } | undefined;
    let provenance: CanvasProvenance = "unrecorded";
    if (stamped && typeof stamped.toolGenerated === "boolean") {
      provenance = stamped.toolGenerated ? "tool-generated" : "hand-built";
    } else if (stamped) {
      // A CURRENT envelope can legitimately carry provenance with no verdict
      // (kind 'unrecorded' — the exporter did not know). Blaming "an older
      // plugin build" here was false for a fresh v2 envelope (verified live,
      // 2026-08-03); say what is actually known.
      notes.push(
        'The proposal envelope carries a provenance object with NO tool-generated/hand-built verdict — the exporter did not record one. The PR says "not recorded" rather than picking a side.',
      );
    } else {
      notes.push(
        'The proposal envelope carries no canvas provenance at all — it came from a plugin build older than the round-trip stamp. The PR says "not recorded" rather than picking a side.',
      );
    }
    notes.push(
      `Input is a ${CONTRACT_PROPOSAL_TYPE} envelope — the contract inside it is what gets committed (the envelope itself is not a contract).`,
    );
    // ENVELOPE v2 payloads: absent on older plugin builds (accepted as-is);
    // present-but-malformed is a named refusal — dropping a payload silently
    // is the exact defect the export-envelope round closes.
    let childStubs: Array<Record<string, unknown>> = [];
    if (doc.childStubs !== undefined && doc.childStubs !== null) {
      if (
        !Array.isArray(doc.childStubs) ||
        doc.childStubs.some(
          (s) => s === null || typeof s !== "object" || Array.isArray(s),
        )
      ) {
        throw new CliUsageError(
          `${path.basename(file)}: the envelope's "childStubs" is not an array of contract objects — re-export the proposal from the plugin's Send tab.`,
        );
      }
      childStubs = doc.childStubs as Array<Record<string, unknown>>;
    }
    let mintedTree: Record<string, unknown> | null = null;
    if (doc.mintedTokens !== undefined && doc.mintedTokens !== null) {
      const tree = (doc.mintedTokens as { tree?: unknown }).tree;
      if (
        typeof doc.mintedTokens !== "object" ||
        Array.isArray(doc.mintedTokens) ||
        tree === null ||
        typeof tree !== "object" ||
        Array.isArray(tree)
      ) {
        throw new CliUsageError(
          `${path.basename(file)}: the envelope's "mintedTokens" has no DTCG "tree" object — re-export the proposal from the plugin's Send tab.`,
        );
      }
      mintedTree = tree as Record<string, unknown>;
      if (Object.keys(mintedTree).length === 0) mintedTree = null;
    }
    if (childStubs.length > 0) {
      notes.push(
        `The envelope carries ${childStubs.length} auto-proposed STUB contract(s) (${childStubs
          .map((s) => String((s as { id?: unknown }).id ?? "?"))
          .join(
            ", ",
          )}) — each is committed as its own contract file so the proposal's component refs resolve; replace each stub by importing the real child set.`,
      );
    }
    if (mintedTree) {
      notes.push(
        "The envelope carries a minted token tree — committed as a DTCG file so the proposal's {imported.*} refs resolve; every name in it is machine-derived and provisional.",
      );
    }
    validateProposalChildren(contract, childStubs);
    return {
      content: JSON.stringify(contract, null, 2) + "\n",
      parsed: contract,
      contract,
      provenance,
      unwrapped: true,
      childStubs,
      mintedTree,
      notes,
    };
  }

  const looksLikeContract =
    !!doc &&
    typeof doc === "object" &&
    typeof doc.id === "string" &&
    typeof doc.name === "string";
  if (looksLikeContract)
    assertContractProvenance(doc as ProvenancedContract, String(doc.id));
  return {
    content: raw,
    parsed,
    contract: looksLikeContract ? doc : null,
    provenance: "unrecorded",
    unwrapped: false,
    childStubs: [],
    mintedTree: null,
    notes: looksLikeContract
      ? []
      : [
          "Input is not a contract document — it is committed verbatim and no code is generated from it.",
        ],
  };
}

// ---------------------------------------------------------------------------
// Targets: config-driven, never guessed
// ---------------------------------------------------------------------------

export interface CodeConfig {
  targets: string[];
  /** Repository-relative directory the generated files land in. */
  outDir: string;
  tokenFiles: string[];
  iconsDir?: string;
  stories: boolean;
  /** Where the targets came from — printed, so nothing looks like a guess. */
  source: "flag" | "config";
}

interface GenerateSection {
  target?: unknown;
  out?: unknown;
  tokens?: unknown;
  icons?: unknown;
  stories?: unknown;
}

/** PURE: flags + the repo's config → the code plan inputs, or a named
 *  reason there is no code to generate. */
export function resolveCodeConfig(
  flags: {
    target?: string;
    codePath?: string;
    tokens?: string;
    icons?: string;
    stories?: boolean;
    noCode: boolean;
  },
  config: { generate?: GenerateSection } | null,
  configPath: string,
): { ok: true; config: CodeConfig } | { ok: false; reason: string } {
  if (flags.noCode) {
    return {
      ok: false,
      reason: "--no-code was given — this PR carries the contract only.",
    };
  }
  const gen = config?.generate ?? undefined;
  const configTarget =
    typeof gen?.target === "string" && gen.target.trim() !== ""
      ? gen.target.trim()
      : undefined;
  const flagTargets = splitList(flags.target);
  const targets =
    flagTargets.length > 0 ? flagTargets : configTarget ? [configTarget] : [];
  if (targets.length === 0) {
    return {
      ok: false,
      reason:
        `No emit target: --target was not given and ${configPath} ` +
        (config ? "has no `generate.target`" : "does not exist") +
        ". This PR carries the CONTRACT ONLY — a framework is not something to guess. " +
        "Run `ds-contracts init --detect` to record your repo's target, or pass --target react|html|react-inline.",
    };
  }
  const unknown = targets.filter((t) => t !== "react" && !emitterByName.has(t));
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: `Unknown --target ${unknown.join(", ")} — registered emitters: react, ${getEmitters()
        .map((e) => e.name)
        .filter((n) => n !== "react")
        .join(", ")}.`,
    };
  }
  const configOut =
    typeof gen?.out === "string" && gen.out.trim() !== ""
      ? gen.out.trim()
      : undefined;
  const outDir = (flags.codePath ?? configOut ?? "").replace(/\/+$/, "");
  if (!outDir) {
    return {
      ok: false,
      reason:
        `--target ${targets.join(", ")} needs somewhere to put the code: pass --code-path <dir>, or record ` +
        `\`generate.out\` in ${configPath}. Guessing a directory would scatter files into a repo layout this command cannot see.`,
    };
  }
  const configTokens = Array.isArray(gen?.tokens)
    ? (gen.tokens as unknown[]).filter(
        (t): t is string => typeof t === "string",
      )
    : [];
  const flagTokens = splitList(flags.tokens);
  const configIcons =
    typeof gen?.icons === "string" && gen.icons.trim() !== ""
      ? gen.icons.trim()
      : undefined;
  return {
    ok: true,
    config: {
      targets,
      outDir,
      tokenFiles: flagTokens.length > 0 ? flagTokens : configTokens,
      iconsDir: flags.icons ?? configIcons,
      stories: flags.stories ?? gen?.stories === true,
      source: flagTargets.length > 0 ? "flag" : "config",
    },
  };
}

/** Read ds-contracts.config.json from cwd. Absent/unreadable → null (the
 *  caller turns that into a named "no target" reason, never a default). */
export function loadDsConfig(
  cwd: string,
): { generate?: GenerateSection } | null {
  const file = path.join(cwd, "ds-contracts.config.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as {
      generate?: GenerateSection;
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generation: the SAME emitters `ds-contracts generate` runs
// ---------------------------------------------------------------------------

const walk = (dir: string, prefix = ""): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const abs = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
};

/**
 * Run the registered emitters over the proposed contract and return the
 * files the PR should carry.
 *
 * react goes through generateComponents() — the exact function `npm run
 * generate` calls, prettier formatting and all — via a temp directory, so
 * the committed bytes are the bytes the repo's own generator produces. Every
 * other target is the pure emitter registry, straight to strings.
 *
 * The react ROOT BARREL (index.ts listing the whole library) is dropped: it
 * knows one component here and would clobber a real repo's barrel. Named in
 * the returned notes, never silent.
 */
export async function generateCodeFiles(
  contractText: string,
  cfg: CodeConfig,
  cwd: string,
  /** ENVELOPE v2: the proposal's other two engine outputs. The stubs join
   *  the generation scope (their refs must resolve — and their geometry
   *  renders); the minted tree joins the token inventory. Omitting them for
   *  a foreign-kit proposal reproduces the old dead end: `generate` refuses
   *  the dangling refs by name. */
  extras: {
    stubs?: Array<Record<string, unknown>>;
    mintedTree?: Record<string, unknown> | null;
  } = {},
): Promise<{ files: PrFile[]; notes: string[] }> {
  const tmp = mkdtempSync(path.join(tmpdir(), "ds-contracts-propose-"));
  const notes: string[] = [];
  const files: PrFile[] = [];
  try {
    const contractFile = path.join(tmp, "proposed.contract.json");
    writeFileSync(contractFile, contractText);
    const stubFiles: string[] = [];
    (extras.stubs ?? []).forEach((stub, i) => {
      const f = path.join(tmp, `stub-${i}.contract.json`);
      writeFileSync(f, JSON.stringify(stub, null, 2) + "\n");
      stubFiles.push(f);
    });
    let mintedFile: string | null = null;
    if (extras.mintedTree && Object.keys(extras.mintedTree).length > 0) {
      mintedFile = path.join(tmp, "minted.dtcg.json");
      writeFileSync(
        mintedFile,
        JSON.stringify(extras.mintedTree, null, 2) + "\n",
      );
    }
    // Token entries may carry an explicit `slot=` prefix (see lib.ts) — resolve
    // the PATH half against cwd and keep the slot attached.
    const named = cfg.tokenFiles.map((e) => {
      const { prefix, file } = parseTokenEntry(e);
      const abs = path.resolve(cwd, file);
      return prefix ? `${prefix}=${abs}` : abs;
    });
    // Name a missing token file in plain words. Without this the failure
    // surfaces as a raw ENOENT with an absolute path — true, but not an
    // answer. Tokens are the referee for every var(--x) binding, so a
    // missing tree is a real refusal, not a warning.
    const missing = cfg.tokenFiles.filter(
      (f, i) => !existsSync(tokenPathsOf(named)[i]),
    );
    if (missing.length > 0) {
      throw new CliUsageError(
        `the token file(s) ${missing.join(", ")} named for code generation do not exist — ` +
          "fix `generate.tokens` in ds-contracts.config.json (or pass --tokens), or pass --no-code to propose the contract alone.",
      );
    }
    // ENVELOPE v2: with a minted tree in play the corpus must not shrink to
    // JUST that tree — when the config names no token files, the generator's
    // own default layout (the files it would have used anyway) rides along
    // explicitly, so the proposal's repo-bound refs keep resolving.
    const defaultCorpus =
      named.length === 0 && mintedFile
        ? [
            path.join(cwd, "tokens", "primitives.tokens.json"),
            path.join(cwd, "tokens", "semantic.tokens.json"),
            path.join(cwd, "tokens", "modes", "semantic.light.tokens.json"),
            path.join(cwd, "tokens", "modes", "semantic.dark.tokens.json"),
          ].filter(existsSync)
        : [];
    const tokenEntries = expandTokenArgs(
      mintedFile ? [...named, ...defaultCorpus, mintedFile] : named,
    );
    const tokenFiles = tokenPathsOf(tokenEntries);
    const iconsDir = cfg.iconsDir ? path.resolve(cwd, cfg.iconsDir) : undefined;

    for (const target of cfg.targets) {
      if (target === "react") {
        const outDir = path.join(tmp, "out-react");
        await generateComponents({
          contractFiles: [contractFile, ...stubFiles],
          tokenFiles: tokenFiles.length > 0 ? tokenFiles : undefined,
          iconsDir,
          outDir,
          stories: cfg.stories,
        });
        for (const rel of walk(outDir)) {
          if (rel === "index.ts") {
            notes.push(
              "The react root barrel (index.ts) is NOT in this PR — it lists every component in the library and this proposal knows one. Add the export by hand when the component lands.",
            );
            continue;
          }
          files.push({
            destPath: `${cfg.outDir}/${rel}`,
            contents: readFileSync(path.join(outDir, rel), "utf8"),
            kind: "code",
            target,
          });
        }
        continue;
      }
      const emitter = emitterByName.get(target);
      if (!emitter) throw new CliUsageError(`Unknown --target "${target}"`);
      const contracts = loadContracts([contractFile, ...stubFiles]);
      const { ctx, routing } = buildEmitterCtxWithRouting(
        contracts,
        tokenEntries,
        iconsDir,
      );
      for (const contract of contracts.values()) {
        for (const f of withTokenDiagnostics(routing, () =>
          emitter.emit(contract, ctx),
        )) {
          files.push({
            destPath: `${cfg.outDir}/${f.path}`,
            contents: f.contents,
            kind: "code",
            target,
          });
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { files, notes };
}

// ---------------------------------------------------------------------------
// The PR body
// ---------------------------------------------------------------------------

/**
 * Plain-words change summary for the PR body. If the payload looks like a
 * contract (has id/name/version), name it and surface its version + any
 * `changelog` line so a reviewer reads WHAT changed without opening the diff.
 * Falls back to nothing for non-contract diff reports.
 */
export function summarize(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") return "";
  const c = parsed as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : undefined;
  const name = typeof c.name === "string" ? c.name : undefined;
  const version = typeof c.version === "string" ? c.version : undefined;
  const status = typeof c.status === "string" ? c.status : undefined;
  const changelog = typeof c.changelog === "string" ? c.changelog : undefined;
  if (!id && !name && !version) return "";
  const lines: string[] = ["**What changed**", ""];
  const head = [
    name ?? id,
    version ? `v${version}` : undefined,
    status ? `(${status})` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  if (head)
    lines.push(`- Contract: ${head}${id && name ? ` — \`${id}\`` : ""}`);
  if (changelog) lines.push(`- ${changelog}`);
  lines.push("", "");
  return lines.join("\n");
}

const bytes = (s: string): string =>
  `${Buffer.byteLength(s).toLocaleString("en-US")} bytes`;

/** The code half of the body: what was emitted, by which target, from what. */
export function codeSection(
  files: PrFile[],
  cfg: CodeConfig | null,
  reason: string | null,
  notes: string[],
): string {
  const lines: string[] = ["**The code this contract generates**", ""];
  if (!cfg || files.length === 0) {
    lines.push(
      `- No component code is in this PR. ${reason ?? "No emit target was resolved."}`,
    );
    lines.push(
      "- Generate it yourself from the merged contract: `ds-contracts generate <contract> --out <dir> --target react`.",
    );
  } else {
    lines.push(
      `- Target${cfg.targets.length > 1 ? "s" : ""}: ${cfg.targets.join(", ")} — ` +
        (cfg.source === "flag"
          ? "requested with `--target`."
          : "read from `ds-contracts.config.json` (`generate.target`)."),
    );
    for (const f of files)
      lines.push(`- \`${f.destPath}\` — ${bytes(f.contents)} (${f.target})`);
    lines.push(
      "",
      "These files are NOT hand-written and must not be hand-edited: they are exactly what " +
        `\`ds-contracts generate <contract> --out ${cfg.outDir} --target ${cfg.targets.join(",")}\`` +
        " emits from the contract in this PR. Change the contract, re-run, commit.",
    );
  }
  for (const n of notes) lines.push(`- ${n}`);
  lines.push("", "");
  return lines.join("\n");
}

/** Overwrite notice — appended once the live run has looked at the branch.
 *  A PR that replaces someone's component must SAY that on its face. */
export function overwriteSection(existing: string[]): string {
  if (existing.length === 0) return "";
  return [
    "",
    "**Overwrites existing files**",
    "",
    ...existing.map(
      (p) =>
        `- \`${p}\` already exists on the base branch and is REPLACED by this PR.`,
    ),
    "",
  ].join("\n");
}

export function buildPlan(
  file: string,
  repo: string,
  opts: {
    base?: string;
    dir?: string;
    title?: string;
    /** Generated code files (already emitted) to carry alongside the contract. */
    code?: PrFile[];
    codeConfig?: CodeConfig | null;
    /** Named reason there is no code, when there is none. */
    codeReason?: string | null;
    codeNotes?: string[];
  },
): { plan: PrPlan; content: string; input: ProposalInput } {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new CliUsageError(`--repo must be owner/name, got "${repo}"`);
  }
  const input = readProposalInput(file);
  const content = input.content;
  // An unwrapped envelope lands under the SAME filename `figma receive`
  // would give it (id → <name>.contract.json), so the two doors into the
  // repo cannot disagree about where a contract lives. Anything else keeps
  // its own basename.
  const basename =
    input.unwrapped && typeof input.contract?.id === "string"
      ? contractFileNameForId(input.contract.id)
      : path.basename(file);
  const slug = basename
    .replace(/\.json$/, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .toLowerCase();
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const destDir = (opts.dir ?? "contracts").replace(/\/+$/, "");
  assertSafeRepoPath(destDir);
  const destPath = `${destDir}/${basename}`;
  const code = opts.code ?? [];
  // ENVELOPE v2: the stubs and the minted tree land NEXT TO the contract —
  // without them the committed proposal carries refs `generate` refuses by
  // name, and the PR is a document nobody can run.
  const stubFiles: PrFile[] = input.childStubs.map((stub, i) => ({
    destPath: `${destDir}/${typeof stub.id === "string" ? contractFileNameForId(stub.id) : `stub-${i}.contract.json`}`,
    contents: JSON.stringify(stub, null, 2) + "\n",
    kind: "contract" as const,
    proposalRole: "stub" as const,
  }));
  const contractId =
    typeof input.contract?.id === "string"
      ? input.contract.id
      : basename.replace(/\.contract\.json$/, "");
  const mintedFiles: PrFile[] = input.mintedTree
    ? [
        {
          destPath: `${destDir}/${proposalFileNameForId(contractId).replace(/\.proposal\.json$/, "")}.minted.dtcg.json`,
          contents: JSON.stringify(input.mintedTree, null, 2) + "\n",
          kind: "tokens" as const,
        },
      ]
    : [];
  const files: PrFile[] = [
    {
      destPath,
      contents: content,
      kind: "contract",
      proposalRole: "main",
    },
    ...stubFiles,
    ...mintedFiles,
    ...code,
  ];
  assertUniqueDestinations(files);
  const sidecars = stubFiles.length + mintedFiles.length;
  const touches =
    code.length > 0 || sidecars > 0
      ? `The ${[
          sidecars > 0
            ? `${sidecars} envelope sidecar file(s) (stub contracts / minted tokens)`
            : null,
          code.length > 0 ? `${code.length} generated file(s)` : null,
        ]
          .filter(Boolean)
          .join(
            " and ",
          )} are its companions — nothing else in the repository is touched.`
      : "Nothing else in the repository is touched.";
  const plan: PrPlan = {
    repo,
    base: opts.base ?? null,
    branch: `ds-contracts/propose-${slug}-${stamp}`,
    destPath,
    title: opts.title ?? `ds-contracts proposal: ${basename}`,
    body:
      `This PR was opened by \`ds-contracts propose-pr\`.\n\n` +
      `It carries a proposed contract change as a reviewable diff: \`${destPath}\`` +
      (code.length > 0
        ? `, plus the component code that contract generates.`
        : ".") +
      `\n\n` +
      summarize(input.parsed) +
      `**Provenance**\n\n${provenanceSentence(input.provenance)}\n\n` +
      (input.notes.length > 0
        ? input.notes.map((n) => `- ${n}`).join("\n") + "\n\n"
        : "") +
      codeSection(
        code,
        opts.codeConfig ?? null,
        opts.codeReason ?? null,
        opts.codeNotes ?? [],
      ) +
      `Review it like any code change — the contract is the single source of truth; ` +
      `merging it is the adoption decision. ${touches}`,
    contentBytes: Buffer.byteLength(content),
    files,
    provenance: input.provenance,
  };
  return { plan, content, input };
}

async function gh<T>(
  token: string,
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "ds-contracts-cli",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail =
      ((await res.json().catch(() => ({}))) as { message?: string }).message ??
      "";
    throw new Error(
      `GitHub ${method} ${url} → ${res.status}${detail ? ` (${detail})` : ""}`,
    );
  }
  return (await res.json()) as T;
}

// GET that treats 404 as "absent" (null) rather than an error — used to look
// up whether a destination file already exists on the branch.
async function ghMaybe<T>(token: string, url: string): Promise<T | null> {
  const res = await fetch(`${API}${url}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "ds-contracts-cli",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail =
      ((await res.json().catch(() => ({}))) as { message?: string }).message ??
      "";
    throw new Error(
      `GitHub GET ${url} → ${res.status}${detail ? ` (${detail})` : ""}`,
    );
  }
  return (await res.json()) as T;
}

/**
 * The PUT /contents body. A promotion usually UPDATES a file that already
 * lives in the target repo, and GitHub's contents API refuses to overwrite an
 * existing blob unless its current `sha` is supplied — so include it whenever
 * the destination already exists on the branch, and omit it for a create.
 * Pure + exported so the create/update shape is pinnable offline.
 */
export function contentsPutBody(
  plan: PrPlan,
  content: string,
  existingSha: string | null,
  destPath?: string,
): { message: string; content: string; branch: string; sha?: string } {
  return {
    message:
      destPath && destPath !== plan.destPath
        ? `${plan.title} — ${destPath}`
        : plan.title,
    content: Buffer.from(content).toString("base64"),
    branch: plan.branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };
}

// ---------------------------------------------------------------------------
// Dry run — the complete plan, offline
// ---------------------------------------------------------------------------

const PREVIEW_LINES = 16;

/** Both diffs, as far as an offline run can honestly show them: a unified
 *  diff against whatever already sits at the destination path in THIS
 *  checkout, and a head-of-file preview when there is no local counterpart. */
function printFileDiff(f: PrFile, cwd: string): void {
  const local = path.resolve(cwd, f.destPath);
  const existing =
    existsSync(local) && statSync(local).isFile()
      ? readFileSync(local, "utf8")
      : null;
  if (existing !== null) {
    if (existing === f.contents) {
      console.log(
        `--- ${f.destPath} — identical to the file in this checkout, no diff`,
      );
      return;
    }
    for (const line of unifiedDiff(existing, f.contents, f.destPath))
      console.log(line);
    return;
  }
  const lines = f.contents.split("\n");
  console.log(
    `--- ${f.destPath} (NEW here — first ${Math.min(PREVIEW_LINES, lines.length)} of ${lines.length} lines)`,
  );
  for (const line of lines.slice(0, PREVIEW_LINES)) console.log(`+${line}`);
  if (lines.length > PREVIEW_LINES)
    console.log(`… ${lines.length - PREVIEW_LINES} more line(s)`);
}

export async function proposePrCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: [
      "repo",
      "token",
      "base",
      "path",
      "title",
      "target",
      "code-path",
      "tokens",
      "icons",
    ],
    bool: ["dry-run", "no-code", "stories"],
  });
  const file = parsed.positionals[0];
  if (!file)
    throw new CliUsageError("propose-pr needs a contract or diff JSON file");
  const repo = flagString(parsed, "repo");
  if (!repo) throw new CliUsageError("propose-pr needs --repo owner/name");

  const cwd = process.cwd();
  const input = readProposalInput(file);
  const configPath = "ds-contracts.config.json";
  const explicitTarget = flagString(parsed, "target");
  const resolved = resolveCodeConfig(
    {
      target: explicitTarget,
      codePath: flagString(parsed, "code-path"),
      tokens: flagString(parsed, "tokens"),
      icons: flagString(parsed, "icons"),
      stories: parsed.flags.get("stories") === true ? true : undefined,
      noCode: parsed.flags.get("no-code") === true,
    },
    loadDsConfig(cwd),
    configPath,
  );

  // A NAMED flag that cannot be honored is a refusal, not a degradation:
  // `--target react` with nowhere to put the files, or a target no emitter
  // answers to, must stop rather than quietly open a contract-only PR the
  // user did not ask for. A target inferred from the config degrades loudly
  // instead (the contract is still worth proposing).
  if (!resolved.ok && explicitTarget && parsed.flags.get("no-code") !== true) {
    throw new CliUsageError(resolved.reason);
  }
  let code: PrFile[] = [];
  let codeConfig: CodeConfig | null = null;
  let codeReason: string | null = resolved.ok ? null : resolved.reason;
  let codeNotes: string[] = [];
  if (resolved.ok) {
    if (!input.contract) {
      codeReason =
        "The input is not a contract document (no id/name), so there is nothing to emit from — it is committed verbatim.";
    } else {
      try {
        const gen = await generateCodeFiles(
          input.content,
          resolved.config,
          cwd,
          {
            stubs: input.childStubs,
            mintedTree: input.mintedTree,
          },
        );
        code = gen.files;
        codeNotes = gen.notes;
        codeConfig = resolved.config;
      } catch (err) {
        const detail = String(err instanceof Error ? err.message : err);
        // An explicit --target that cannot emit is a REFUSAL: the user asked
        // for code by name. A config-derived target degrades loudly instead,
        // so a repo whose token paths do not line up still gets its contract
        // proposed — with the failure printed and carried into the PR body.
        if (explicitTarget) {
          throw new CliUsageError(
            `--target ${explicitTarget} could not generate code from ${path.basename(file)}:\n${detail}`,
          );
        }
        codeReason = `Code generation REFUSED (target from ${configPath}): ${detail}`;
        console.error(`✘ ${codeReason}`);
      }
    }
  }

  const { plan, content } = buildPlan(file, repo, {
    base: flagString(parsed, "base"),
    dir: flagString(parsed, "path"),
    title: flagString(parsed, "title"),
    code,
    codeConfig,
    codeReason,
    codeNotes,
  });

  if (parsed.flags.get("dry-run") === true) {
    let step = 0;
    console.log(
      "DRY RUN — no network calls, no token required. The live run would:",
    );
    console.log(
      `  ${++step}. GET  /repos/${plan.repo}${plan.base ? "" : "  (resolve the default branch)"}`,
    );
    console.log(
      `  ${++step}. GET  /repos/${plan.repo}/git/ref/heads/${plan.base ?? "<default-branch>"}  (base sha)`,
    );
    console.log(
      `  ${++step}. POST /repos/${plan.repo}/git/refs  { ref: "refs/heads/${plan.branch}" }`,
    );
    for (const f of plan.files) {
      console.log(
        `  ${++step}. PUT  /repos/${plan.repo}/contents/${f.destPath}  (${Buffer.byteLength(f.contents)} bytes, branch ${plan.branch}, ${f.kind === "contract" ? "contract" : f.kind === "tokens" ? "minted tokens" : `code/${f.target}`})`,
      );
    }
    console.log(
      `  ${++step}. POST /repos/${plan.repo}/pulls  { title: ${JSON.stringify(plan.title)}, head: "${plan.branch}", base: "${plan.base ?? "<default-branch>"}" }`,
    );
    console.log(
      "  Token source at run time: --token, else DS_CONTRACTS_GITHUB_TOKEN, else GITHUB_TOKEN — never persisted.",
    );

    console.log(`\nFiles this PR would contain (${plan.files.length}):`);
    for (const f of plan.files) {
      console.log(
        `  ${f.destPath}  ${bytes(f.contents)}  ${f.kind === "contract" ? "(contract — the source of truth)" : f.kind === "tokens" ? "(minted token tree — provisional names)" : `(generated code — ${f.target})`}`,
      );
    }
    if (codeReason && code.length === 0)
      console.log(`  NO CODE — ${codeReason}`);
    if (code.length > 0) {
      console.log(
        '  Every destination is checked against the branch before it is written; anything already there is REPLACED and named in the PR body under "Overwrites existing files".',
      );
    }

    console.log(`\nProvenance: ${provenanceSentence(plan.provenance)}`);
    for (const n of input.notes) console.log(`  - ${n}`);
    for (const n of codeNotes) console.log(`  - ${n}`);

    console.log(
      "\nDiffs (against this checkout — the live run diffs against the target repo):",
    );
    for (const f of plan.files) printFileDiff(f, cwd);

    console.log("\nPR body:");
    console.log(plan.body);
    return 0;
  }

  const token =
    flagString(parsed, "token") ??
    process.env.DS_CONTRACTS_GITHUB_TOKEN ??
    process.env.GITHUB_TOKEN;
  if (!token) {
    throw new CliUsageError(
      "propose-pr needs a fine-grained GitHub token: --token, DS_CONTRACTS_GITHUB_TOKEN, or GITHUB_TOKEN (contents:write + pull-requests:write on the target repo). It is used in memory only — never stored.",
    );
  }

  const base =
    plan.base ??
    (await gh<{ default_branch: string }>(token, "GET", `/repos/${plan.repo}`))
      .default_branch;
  // Preserve adopted contracts: an auto-proposed stub is only a fallback.
  // Resolve every stub against the BASE branch before creating the branch or
  // issuing any PUT, then omit destinations that already contain a contract.
  const preservedStubs: string[] = [];
  const activeFiles: PrFile[] = [];
  for (const f of plan.files) {
    if (f.proposalRole !== "stub") {
      activeFiles.push(f);
      continue;
    }
    const existingBase = await ghMaybe<{ sha: string }>(
      token,
      `/repos/${plan.repo}/contents/${f.destPath}?ref=${encodeURIComponent(base)}`,
    );
    if (existingBase) preservedStubs.push(f.destPath);
    else activeFiles.push(f);
  }
  const ref = await gh<{ object: { sha: string } }>(
    token,
    "GET",
    `/repos/${plan.repo}/git/ref/heads/${base}`,
  );
  await gh(token, "POST", `/repos/${plan.repo}/git/refs`, {
    ref: `refs/heads/${plan.branch}`,
    sha: ref.object.sha,
  });
  // Upsert every file. If a destination already exists on the new branch
  // (the common promotion case — the repo already carries this contract, and
  // possibly this component), GitHub's contents API requires its current sha
  // to replace it. Every replacement is COLLECTED and named in the PR body:
  // a PR that overwrites someone's component says so on its face.
  const overwritten: string[] = [];
  for (const f of activeFiles) {
    const existing = await ghMaybe<{ sha: string }>(
      token,
      `/repos/${plan.repo}/contents/${f.destPath}?ref=${encodeURIComponent(plan.branch)}`,
    );
    if (existing?.sha) overwritten.push(f.destPath);
    await gh(
      token,
      "PUT",
      `/repos/${plan.repo}/contents/${f.destPath}`,
      contentsPutBody(plan, f.contents, existing?.sha ?? null, f.destPath),
    );
    console.log(`  ${existing?.sha ? "updated" : "created"} ${f.destPath}`);
  }
  const pr = await gh<{ html_url: string; number: number }>(
    token,
    "POST",
    `/repos/${plan.repo}/pulls`,
    {
      title: plan.title,
      head: plan.branch,
      base,
      body:
        plan.body +
        (preservedStubs.length > 0
          ? `\n\n**Preserved existing contracts**\n\n${preservedStubs
              .map(
                (p) =>
                  `- \`${p}\` already exists on the base branch; the auto-proposed stub was NOT written over it.`,
              )
              .join("\n")}\n`
          : "") +
        overwriteSection(overwritten),
    },
  );
  console.log(`✔ Opened PR #${pr.number}: ${pr.html_url}`);
  return 0;
}
