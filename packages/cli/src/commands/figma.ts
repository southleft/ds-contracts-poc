/**
 * `ds-contracts figma` — the canvas as an emit target, both directions.
 *
 *   figma <contracts..> --out <dir> [--tokens f,f] [--icons dir] [--file-key KEY]
 *       emit one Figma Plugin API sync script per contract
 *       (core/emit-figma-script — referee-gated, same engine as the repo)
 *
 *   figma bundle <contracts..> --tokens <base.dtcg.json[,minted.dtcg.json]>
 *       [--modes <light.json[,dark.json]>] [--name <collection>] --out <file.json>
 *       emit a SELF-CONTAINED CONTRACTS-BUNDLE (contracts + tokenSet) — the
 *       one JSON a foreign-library user pastes into the plugin's Generate
 *       tab. The tokenSet carries the flat DTCG base, optional light/dark
 *       mode overrides, and the minted tree; the plugin syncs it as one
 *       named variable collection (Light/Dark modes, Figma-native aliases
 *       for {alias} minted leaves) and resolves the contracts against
 *       base + minted. Deterministic: same inputs → byte-identical bundle.
 *
 *   figma push <bundle-or-contract.json> --code <PAIRING-CODE> [--bridge <url>]
 *       send a CONTRACTS-BUNDLE through the plugin bridge under a pairing
 *       code (the reverse direction of Send-to-Playground). A single
 *       contract document is wrapped into a one-contract bundle. The bridge
 *       stays a dumb pipe: the payload is tagged, never inspected beyond
 *       "is it JSON / is it a well-formed bundle envelope".
 *
 *   figma claim-channel [--bridge <url>]
 *       mint a STANDING CI↔Figma channel: a { writeKey, readKey } pair.
 *       The write key is a CI secret (it publishes); the read key —
 *       sha256(writeKey) — is the half a designer pastes into the plugin.
 *       One-way derivation, so a leaked Figma-side key can read but can
 *       never inject. See workers/assist/src/channel.ts.
 *
 *   figma publish <bundle-or-contract.json> [--channel-key KEY] [--bridge <url>]
 *       [--repo o/n] [--run-id ID] [--run-url URL] [--commit SHA] [--ref REF]
 *       [--no-provenance] [--dry-run]
 *       publish a CONTRACTS-BUNDLE to the standing channel. The designer's
 *       plugin finds it waiting — no pairing code, no human courier, no
 *       synchronous window. GitHub Actions context is auto-detected into a
 *       provenance SIBLING of the bundle (never inside the bundle bytes, so
 *       `figma bundle` output stays byte-deterministic).
 *
 *   figma receive --out <contracts-dir> [--bridge <url>] [--apply]
 *       the DEV DOOR: open a bridge session, print the pairing code, wait
 *       for the plugin's Send tab to send its CONTRACT-PROPOSAL under
 *       that code, then land it as a REVIEWED LOCAL DIFF. Without --apply
 *       nothing but the proposal artifact (<out>/.proposals/<id>.proposal.json)
 *       is written — the contract file is never touched silently. With
 *       --apply the contract file is written too, PLUS the envelope's other
 *       two engine outputs (v2): each auto-proposed childStub as its own
 *       contract file and the minted DTCG tree as <id>.minted.dtcg.json —
 *       then the exact runnable `generate` command (minted tree on --tokens)
 *       is printed so the first generate succeeds instead of refusing the
 *       stubs' refs by name. AND the component code that contract generates
 *       (the same resolveCodeConfig/generateCodeFiles propose-pr uses — the
 *       target comes from ds-contracts.config.json and is never guessed;
 *       with none recorded the refusal is printed and no code is written).
 *       git stays yours.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { figmaScriptEmitter } from "../../../../core/emitter.js";
import {
  contractFileNameForId,
  flatIdStem,
  proposalFileNameForId,
} from "../../../../core/canvas-code-plan.js";
import {
  assertContractProvenance,
  markAwaitingCodeAdoption,
  revisionOf,
  type ProvenancedContract,
} from "../../../../core/contract-provenance.js";
import {
  buildEmitterCtxWithRouting,
  CliUsageError,
  expandContractArgs,
  expandTokenArgs,
  flagString,
  loadContracts,
  loadIcons,
  parseFlags,
  splitList,
  withTokenDiagnostics,
} from "../lib.js";
// propose-pr's three code-plan functions are imported LAZILY, inside the
// --apply branch of receive (see below) — not here. Statically, this module
// would pull in scripts/generate-components.ts, whose direct-run shell ends
// in a top-level await; three eval probes import this file through `tsx -e`
// (CJS), where a top-level await is a hard transform error. The dev door
// needs the generator only when it is actually about to generate.

export const DEFAULT_BRIDGE_URL =
  "https://ds-contracts-assist.southleft-llc.workers.dev";

/** The bundle envelope the bridge and the plugin agree on. */
export const CONTRACTS_BUNDLE_TYPE = "CONTRACTS-BUNDLE";

/** Stable refusal name — empty/stub anatomy must not report Apply or bundle
 *  publication as success (Wave 1 acceptance #4). Matches the CI anatomy gate
 *  in `examples/ci/code-led.yml` (substance predicate) and regate's
 *  `empty anatomy table`. */
export const DRAWABLE_EMPTY = "drawable-empty";

export interface ContractsBundle {
  type: typeof CONTRACTS_BUNDLE_TYPE;
  version: 1;
  contracts: unknown[];
  /** Foreign token set (figma bundle writes it) — rides through push
   *  verbatim so the plugin can sync it; never inspected here. */
  tokenSet?: unknown;
  /** Bundle-carried icon assets ({name: svgMarkup}; figma bundle --icons
   *  writes it) — rides through push verbatim. */
  icons?: unknown;
}

/** True when an anatomy node (or any descendant part) carries drawable
 *  substance: non-empty token bindings, a component ref, non-empty content,
 *  or a child part that itself is drawable. Hollow `parts: { label: {} }`
 *  and empty `content: {}` do not count — they still paint blank frames. */
function anatomyNodeHasDrawableSubstance(node: unknown): boolean {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const n = node as Record<string, unknown>;
  const tokens = n.tokens;
  if (
    tokens &&
    typeof tokens === "object" &&
    !Array.isArray(tokens) &&
    Object.keys(tokens).length > 0
  ) {
    return true;
  }
  if (n.component !== undefined && n.component !== null) return true;
  const content = n.content;
  if (content !== undefined && content !== null) {
    if (typeof content === "object" && !Array.isArray(content)) {
      if (Object.keys(content).length > 0) return true;
    } else if (content !== "") {
      return true;
    }
  }
  const parts = n.parts;
  if (parts && typeof parts === "object" && !Array.isArray(parts)) {
    for (const child of Object.values(parts as Record<string, unknown>)) {
      if (anatomyNodeHasDrawableSubstance(child)) return true;
    }
  }
  return false;
}

/** True when a contract has nothing the canvas can draw — missing/empty
 *  anatomy (regate: "empty anatomy table"), or a root/tree with no drawable
 *  substance (CI stub test: `"anatomy":{"root":{}}`). PURE. */
export function isDrawableEmptyContract(contract: unknown): boolean {
  if (!contract || typeof contract !== "object" || Array.isArray(contract))
    return true;
  const anatomy = (contract as { anatomy?: unknown }).anatomy;
  if (!anatomy || typeof anatomy !== "object" || Array.isArray(anatomy))
    return true;
  const roots = Object.keys(anatomy as object);
  if (roots.length === 0) return true;
  const root =
    (anatomy as Record<string, unknown>).root ??
    (anatomy as Record<string, unknown>)[roots[0]];
  return !anatomyNodeHasDrawableSubstance(root);
}

/** Named refusal for canvas success paths (bundle / publish / receive --apply). */
export function drawableEmptyRefusalMessage(
  contract: unknown,
  surface: "bundle" | "publish" | "apply",
): string {
  const id =
    contract &&
    typeof contract === "object" &&
    typeof (contract as { id?: unknown }).id === "string"
      ? (contract as { id: string }).id
      : "(unnamed)";
  const verb =
    surface === "apply"
      ? "apply refuses rather than writing blank frames"
      : surface === "publish"
        ? "publish refuses rather than delivering blank frames"
        : "bundle refuses rather than publishing blank frames";
  return `${DRAWABLE_EMPTY}: ${id} — anatomy has nothing drawable (empty anatomy / empty root / hollow parts or content with no tokens, content binding, or component); ${verb}. Run computed capture or carry real anatomy first.`;
}

export function assertContractsNotDrawableEmpty(
  contracts: readonly unknown[],
  surface: "bundle" | "publish",
): void {
  for (const contract of contracts) {
    if (isDrawableEmptyContract(contract)) {
      throw new CliUsageError(drawableEmptyRefusalMessage(contract, surface));
    }
  }
}

/** Read a file as a bundle: an existing CONTRACTS-BUNDLE envelope passes
 *  through (its tokenSet included); a single contract document (has id/name)
 *  is wrapped. */
export function toBundle(filePath: string): ContractsBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new CliUsageError(
      `${filePath}: not JSON — ${String(err instanceof Error ? err.message : err)}`,
    );
  }
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { type?: unknown }).type === CONTRACTS_BUNDLE_TYPE
  ) {
    const contracts = (raw as { contracts?: unknown }).contracts;
    if (!Array.isArray(contracts) || contracts.length === 0) {
      throw new CliUsageError(
        `${filePath}: a ${CONTRACTS_BUNDLE_TYPE} needs a non-empty "contracts" array`,
      );
    }
    const tokenSet = (raw as { tokenSet?: unknown }).tokenSet;
    const icons = (raw as { icons?: unknown }).icons;
    for (const [i, contract] of contracts.entries()) {
      assertContractProvenance(
        contract as ProvenancedContract,
        `bundle contract ${i + 1}`,
      );
    }
    // Push/publish share this door — blank anatomy must not ride a success path.
    assertContractsNotDrawableEmpty(contracts, "publish");
    return {
      type: CONTRACTS_BUNDLE_TYPE,
      version: 1,
      contracts,
      ...(tokenSet !== undefined && tokenSet !== null ? { tokenSet } : {}),
      ...(icons !== undefined && icons !== null ? { icons } : {}),
    };
  }
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { id?: unknown }).id === "string"
  ) {
    assertContractProvenance(
      raw as ProvenancedContract,
      String((raw as { id: string }).id),
    );
    assertContractsNotDrawableEmpty([raw], "publish");
    return { type: CONTRACTS_BUNDLE_TYPE, version: 1, contracts: [raw] };
  }
  throw new CliUsageError(
    `${filePath}: neither a contract document (no "id") nor a ${CONTRACTS_BUNDLE_TYPE} envelope`,
  );
}

// ---------------------------------------------------------------------------
// figma bundle — the self-contained foreign-library payload (JSON only).
// ---------------------------------------------------------------------------

const readJsonObject = (filePath: string): Record<string, unknown> => {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new CliUsageError(
      `${filePath}: not JSON — ${String(err instanceof Error ? err.message : err)}`,
    );
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CliUsageError(
      `${filePath}: expected a JSON object (a DTCG token file)`,
    );
  }
  return raw as Record<string, unknown>;
};

async function bundleCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ["tokens", "modes", "name", "out", "icons"],
  });
  if (parsed.positionals.length === 0) {
    throw new CliUsageError("figma bundle needs contract files/directories");
  }
  const out = flagString(parsed, "out");
  if (!out) throw new CliUsageError("figma bundle needs --out <file.json>");
  const tokenFiles = splitList(flagString(parsed, "tokens"));
  if (tokenFiles.length === 0 || tokenFiles.length > 2) {
    throw new CliUsageError(
      "figma bundle needs --tokens <base.dtcg.json[,minted.dtcg.json]> — the flat DTCG base first, the minted tree (optional) second",
    );
  }
  const modeFiles = splitList(flagString(parsed, "modes"));
  if (modeFiles.length > 2) {
    throw new CliUsageError(
      "figma bundle takes --modes <light.json[,dark.json]> — light first, dark (optional) second",
    );
  }

  // Contract referee first (loadContracts refuses violations by name), then
  // embed the RAW documents — the bundle carries the files as written, not a
  // schema-normalized copy ($schema keys and field order survive verbatim).
  const files = expandContractArgs(parsed.positionals);
  loadContracts(files);
  const contracts = files.map(
    (f) => JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>,
  );
  contracts.forEach((contract, i) =>
    assertContractProvenance(
      contract as ProvenancedContract,
      String(contract.id ?? files[i]),
    ),
  );
  // Stub / empty anatomy is schema-valid and used to publish blank Figma
  // frames as a quiet success — refuse by name before any bundle bytes land.
  assertContractsNotDrawableEmpty(contracts, "bundle");

  // MOLECULE round: contracts referencing icon assets (icon.asset) make the
  // bundle carry the SVGs — JSON stays the only thing a user pastes. Exactly
  // the referenced assets embed (sorted — deterministic bytes); a referenced
  // asset missing from --icons, or refs with no --icons at all, refuses BY
  // NAME (a bundle that cannot render its own icons is not a bundle).
  const iconRefs = new Set<string>();
  /** A contract's declared enum props — an icon asset may be a FUNCTION of
   *  one (see below), and resolving it needs the prop's values. */
  const enumsOf = (c: Record<string, unknown>): Map<string, string[]> => {
    const m = new Map<string, string[]>();
    for (const p of (c.props as Array<Record<string, unknown>> | undefined) ??
      []) {
      const values = (p?.type as { enum?: unknown } | undefined)?.enum;
      if (Array.isArray(values) && typeof p.name === "string")
        m.set(p.name, values as string[]);
    }
    return m;
  };
  /** LEDGER §3.4's second blocker, and the last thing keeping Untitled UI —
   *  a real Figma Community kit — off the shipping paste path.
   *
   *  A per-variant icon is spelled as a SUBSTITUTED ref, exactly like a
   *  per-variant token: ds.social-icon's glyph is `{ "asset": "{platform}" }`
   *  over platform = facebook|google|apple|figma|dribbble|xtwitter. Every
   *  emitter already expands that (the React and canvas surfaces render all
   *  six), but the BUNDLER read the ref as a LITERAL filename, went looking
   *  for an icon called "{platform}", and refused the whole bundle by name —
   *  with all six SVGs sitting in the assets directory. So the refusal was
   *  real and the cause was a missing expansion, not a missing asset.
   *
   *  Placeholders expand against the declaring contract's enum values. A
   *  placeholder naming a prop the contract does not declare as an enum is
   *  left VERBATIM, so it still refuses by name downstream — an unresolvable
   *  ref must not be silently dropped from the bundle. */
  const expandAsset = (
    asset: string,
    enums: Map<string, string[]>,
  ): string[] => {
    const phs = [...asset.matchAll(/\{([a-z][\w-]*)\}/gi)].map((m) => m[1]);
    if (phs.length === 0) return [asset];
    let out = [asset];
    for (const ph of phs) {
      const values = enums.get(ph);
      if (!values) continue; // unresolvable — keep it verbatim so it refuses BY NAME
      out = out.flatMap((a) => values.map((v) => a.replaceAll(`{${ph}}`, v)));
    }
    return out;
  };
  const collectIconRefs = (v: unknown, enums: Map<string, string[]>): void => {
    if (v && typeof v === "object") {
      const asset = (v as { icon?: { asset?: unknown } }).icon?.asset;
      if (typeof asset === "string")
        for (const name of expandAsset(asset, enums)) iconRefs.add(name);
      for (const x of Object.values(v)) collectIconRefs(x, enums);
    }
  };
  for (const c of contracts) collectIconRefs(c, enumsOf(c));
  const iconsDir = flagString(parsed, "icons");
  let icons: Record<string, string> | undefined;
  if (iconRefs.size > 0) {
    if (!iconsDir) {
      throw new CliUsageError(
        `these contracts reference ${iconRefs.size} icon asset(s) (${[...iconRefs].sort().join(", ")}) — pass --icons <dir> so the bundle can carry them`,
      );
    }
    const available = loadIcons(iconsDir);
    const missing = [...iconRefs].sort().filter((n) => !available.has(n));
    if (missing.length > 0) {
      throw new CliUsageError(
        `icon asset(s) referenced but not in ${iconsDir}: ${missing.join(", ")}`,
      );
    }
    icons = Object.fromEntries(
      [...iconRefs].sort().map((n) => [n, available.get(n)!]),
    );
  }

  // Nested DTCG trees (Polaris's wrap) flatten to dot-path names — the
  // tokenSet base is flat by format; a nested wrap collapsing to one "token"
  // was the live finding this closes. Flat inputs pass through unchanged.
  const flattenDtcg = (
    node: Record<string, unknown>,
    prefix: string[] = [],
    out: Record<string, unknown> = {},
  ): Record<string, unknown> => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      if (v && typeof v === "object" && "$value" in (v as object))
        out[[...prefix, k].join(".")] = v;
      else if (v && typeof v === "object")
        flattenDtcg(v as Record<string, unknown>, [...prefix, k], out);
    }
    return out;
  };
  const base = flattenDtcg(readJsonObject(path.resolve(tokenFiles[0])));
  const minted = tokenFiles[1]
    ? readJsonObject(path.resolve(tokenFiles[1]))
    : undefined;
  // The mode trees flatten by the SAME rule as base, and for the same reason.
  // They did not, and the failure was silent rather than loud: a NESTED mode
  // file has no key matching base's dot-path names, so every variable fell
  // back to its base value and the plugin built a two-mode collection whose
  // dark mode equalled its light mode — while the CLI line said "modes:
  // light/dark" and the generated script header said "Light/Dark modes". The
  // repo's own mode files are flat by convention, which is why five committed
  // library bundles are unaffected and nothing caught it; the first NESTED
  // mode input (a real captured Figma variable tree — DTCG is nested by
  // nature) exposed it. Same fix, same flattener, both halves now closed.
  const light = modeFiles[0]
    ? flattenDtcg(readJsonObject(path.resolve(modeFiles[0])))
    : undefined;
  const dark = modeFiles[1]
    ? flattenDtcg(readJsonObject(path.resolve(modeFiles[1])))
    : undefined;
  const name = flagString(parsed, "name") ?? "Tokens";

  const bundle = {
    type: CONTRACTS_BUNDLE_TYPE,
    version: 1 as const,
    tokenSet: {
      name,
      base,
      ...(light || dark
        ? { modes: { ...(light ? { light } : {}), ...(dark ? { dark } : {}) } }
        : {}),
      ...(minted ? { minted } : {}),
    },
    ...(icons ? { icons } : {}),
    contracts,
  };
  const text = JSON.stringify(bundle, null, 2) + "\n";
  const outPath = path.resolve(out);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  const baseCount = Object.keys(base).length;
  console.log(
    `✔ Bundle written: ${out} — ${contracts.length} contract(s) + tokenSet "${name}" (${baseCount} base tokens${minted ? ", minted tree" : ""}${light || dark ? `, modes: ${[light && "light", dark && "dark"].filter(Boolean).join("/")}` : ""}${icons ? `, ${Object.keys(icons).length} icon asset(s)` : ""}; ${text.length} bytes). Paste it into the plugin's Build tab — JSON is the only thing a user ever pastes.`,
  );
  return 0;
}

async function pushCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ["code", "bridge"] });
  const file = parsed.positionals[0];
  if (!file)
    throw new CliUsageError("figma push needs a bundle or contract JSON file");
  const code = flagString(parsed, "code");
  if (!code) {
    throw new CliUsageError(
      'figma push needs --code <PAIRING-CODE> — the 6-character code the designer TYPES into the Build tab’s "Receive by code" box in the Figma plugin (the plugin never displays a code; you and the designer share one from a bridge session)',
    );
  }
  const base = (
    flagString(parsed, "bridge") ??
    process.env.DS_CONTRACTS_BRIDGE_URL ??
    DEFAULT_BRIDGE_URL
  ).replace(/\/$/, "");
  const bundle = toBundle(file);
  const body = JSON.stringify(bundle);
  const res = await fetch(
    `${base}/bridge/${encodeURIComponent(code.toUpperCase())}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    },
  );
  const answer = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    bytes?: number;
  };
  if (!res.ok) {
    console.error(
      `✘ bridge refused (${res.status}): ${answer.error ?? "unnamed error"}`,
    );
    return 1;
  }
  console.log(
    `✔ Pushed ${CONTRACTS_BUNDLE_TYPE} (${bundle.contracts.length} contract(s), ${body.length} bytes) under code ${code.toUpperCase()} — deliver-once, 15-minute TTL`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// figma claim-channel / figma publish — THE STANDING CI↔FIGMA CHANNEL
// (docs/18 G1, slice S1+S2). PURE CORE first (provenance detection, the
// publish envelope, the dry-run plan — all unit/eval-pinnable with no I/O),
// thin network shells at the bottom.
//
// KEY DISCIPLINE, copied verbatim from propose-pr.ts: the channel write key
// comes from --channel-key or DS_CONTRACTS_CHANNEL_KEY, lives in ONE local
// variable for the duration of the run, and is NEVER persisted, logged, or
// echoed — only a masked prefix ever reaches stdout. --dry-run prints the
// exact plan with no network call and no key required.
// ---------------------------------------------------------------------------

/** The CI-side facts that ride ALONGSIDE the bundle. Never inside it: the
 *  bundle bytes stay exactly what `figma bundle` wrote, so its determinism
 *  guarantee survives contact with the channel. */
export interface ChannelProvenance {
  repo?: string;
  runId?: string;
  runUrl?: string;
  commit?: string;
  ref?: string;
  publishedAt: string;
}

/** GitHub Actions context → provenance. PURE: the environment and the clock
 *  are both arguments. Overrides win over detection; a run with neither
 *  yields null (a publish with no provenance is allowed and says so —
 *  inventing "unknown" fields would be a lie the plugin then renders). */
export function detectProvenance(
  env: Record<string, string | undefined>,
  overrides: {
    repo?: string;
    runId?: string;
    runUrl?: string;
    commit?: string;
    ref?: string;
  },
  now: Date,
): ChannelProvenance | null {
  const repo = overrides.repo ?? env.GITHUB_REPOSITORY;
  const runId = overrides.runId ?? env.GITHUB_RUN_ID;
  const commit = overrides.commit ?? env.GITHUB_SHA;
  const ref = overrides.ref ?? env.GITHUB_REF;
  const server = env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl =
    overrides.runUrl ??
    env.GITHUB_RUN_URL ??
    (repo && runId ? `${server}/${repo}/actions/runs/${runId}` : undefined);
  if (!repo && !runId && !commit && !ref) return null;
  return {
    ...(repo ? { repo } : {}),
    ...(runId ? { runId } : {}),
    ...(runUrl ? { runUrl } : {}),
    ...(commit ? { commit } : {}),
    ...(ref ? { ref } : {}),
    publishedAt: now.toISOString(),
  };
}

/** The publish envelope: bundle + optional provenance SIBLING. PURE. */
export function buildPublishBody(
  bundle: ContractsBundle,
  provenance: ChannelProvenance | null,
): { bundle: ContractsBundle; provenance?: ChannelProvenance } {
  return provenance === null ? { bundle } : { bundle, provenance };
}

/** Everything a log line may ever show of a channel key: its kind prefix and
 *  four characters. Enough to tell two channels apart, useless to a reader. */
export const maskChannelKey = (key: string): string =>
  key.length <= 9 ? "…" : `${key.slice(0, 9)}…`;

/** The --dry-run text — the exact plan, no network, no key needed. PURE. */
export function publishDryRunLines(
  file: string,
  base: string,
  bundle: ContractsBundle,
  provenance: ChannelProvenance | null,
  bytes: number,
): string[] {
  return [
    "DRY RUN — no request leaves this machine, no channel key required. The live run would:",
    `  1. POST ${base}/channel/<writeKey>`,
    `     body: { "bundle": <CONTRACTS-BUNDLE from ${file}>${provenance ? ', "provenance": {…}' : ""} }`,
    `     ${bundle.contracts.length} contract(s), ${bytes} bytes of bundle JSON (cap 4 MB)`,
    provenance
      ? `  2. Provenance sibling (auto-detected, rides UNREAD through the worker): ${[
          provenance.repo && `repo ${provenance.repo}`,
          provenance.runId && `run ${provenance.runId}`,
          provenance.commit && `commit ${provenance.commit.slice(0, 7)}`,
          provenance.ref && `ref ${provenance.ref}`,
        ]
          .filter(Boolean)
          .join(", ")}`
      : "  2. No provenance — not a GitHub Actions run and no --repo/--commit given. The plugin will show the delivery as unattributed.",
    '  3. The worker assigns the next seq and refreshes the channel\'s 30-day TTL. Nothing is delivered anywhere until the designer presses "Check for updates".',
    "  Key source at run time: --channel-key, else DS_CONTRACTS_CHANNEL_KEY — used in memory only, never persisted, never logged.",
  ];
}

const channelBase = (parsed: ReturnType<typeof parseFlags>): string =>
  (
    flagString(parsed, "bridge") ??
    process.env.DS_CONTRACTS_BRIDGE_URL ??
    DEFAULT_BRIDGE_URL
  ).replace(/\/$/, "");

async function claimChannelCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, { value: ["bridge"] });
  const base = channelBase(parsed);
  const res = await fetch(`${base}/channel/claim`, { method: "POST" });
  const answer = (await res.json().catch(() => ({}))) as {
    writeKey?: string;
    readKey?: string;
    ttlSeconds?: number;
    error?: string;
  };
  if (
    !res.ok ||
    typeof answer.writeKey !== "string" ||
    typeof answer.readKey !== "string"
  ) {
    console.error(
      `✘ the channel refused the claim (${res.status}): ${answer.error ?? "unnamed error"}`,
    );
    return 1;
  }
  const days = Math.round((answer.ttlSeconds ?? 30 * 24 * 60 * 60) / 86400);
  console.log(
    "✔ Channel claimed. Two keys, two different jobs — do not mix them up:\n",
  );
  console.log(
    `  WRITE KEY (a CI secret — it PUBLISHES; keep it out of Figma and out of git):`,
  );
  console.log(`    ${answer.writeKey}`);
  console.log(`    → store as the repository secret DS_CONTRACTS_CHANNEL_KEY`);
  console.log(
    `       (GitHub: Settings → Secrets and variables → Actions → New repository secret)\n`,
  );
  console.log(
    `  READ KEY (the designer's half — it only READS; paste it into the Figma plugin):`,
  );
  console.log(`    ${answer.readKey}`);
  console.log(`    → Figma plugin → Changes tab → the channel key field\n`);
  console.log(
    `  The read key is sha256(write key): holding the write key you can compute the read key, but a\n` +
      `  leaked read key can never publish. That is why a shared Figma file cannot inject into your\n` +
      `  source of truth.\n`,
  );
  console.log(
    `  The channel expires after ${days} days with no publish; every publish resets the clock.\n` +
      `  Reads never extend it — a channel CI has abandoned dies on purpose.`,
  );
  return 0;
}

async function publishCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: [
      "channel-key",
      "bridge",
      "repo",
      "run-id",
      "run-url",
      "commit",
      "ref",
    ],
    bool: ["dry-run", "no-provenance"],
  });
  const file = parsed.positionals[0];
  if (!file)
    throw new CliUsageError(
      "figma publish needs a bundle or contract JSON file",
    );
  const base = channelBase(parsed);
  const bundle = toBundle(file);
  const bundleBytes = JSON.stringify(bundle).length;

  const provenance =
    parsed.flags.get("no-provenance") === true
      ? null
      : detectProvenance(
          process.env,
          {
            repo: flagString(parsed, "repo"),
            runId: flagString(parsed, "run-id"),
            runUrl: flagString(parsed, "run-url"),
            commit: flagString(parsed, "commit"),
            ref: flagString(parsed, "ref"),
          },
          new Date(),
        );

  if (parsed.flags.get("dry-run") === true) {
    for (const line of publishDryRunLines(
      file,
      base,
      bundle,
      provenance,
      bundleBytes,
    )) {
      console.log(line);
    }
    return 0;
  }

  const key =
    flagString(parsed, "channel-key") ?? process.env.DS_CONTRACTS_CHANNEL_KEY;
  if (!key) {
    throw new CliUsageError(
      "figma publish needs the channel WRITE key: --channel-key, or the DS_CONTRACTS_CHANNEL_KEY env var (in CI: a repository secret). Run `ds-contracts figma claim-channel` once to mint a pair. It is used in memory only — never stored, never logged.",
    );
  }

  const body = JSON.stringify(buildPublishBody(bundle, provenance));
  const res = await fetch(`${base}/channel/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const answer = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    seq?: number;
    bytes?: number;
    publishedAt?: string;
    error?: string;
  };
  if (!res.ok) {
    // The worker's refusals are plain words already — echo them verbatim, and
    // never the key itself.
    console.error(
      `✘ the channel refused the publish to ${maskChannelKey(key)} (${res.status}): ${answer.error ?? "unnamed error"}`,
    );
    return 1;
  }
  console.log(
    `✔ Published delivery #${answer.seq} to channel ${maskChannelKey(key)} — ${bundle.contracts.length} contract(s), ${answer.bytes ?? bundleBytes} bytes, at ${answer.publishedAt ?? "now"}.` +
      (provenance
        ? `\n  Provenance: ${[
            provenance.repo,
            provenance.runId && `run #${provenance.runId}`,
            provenance.commit && `commit ${provenance.commit.slice(0, 7)}`,
          ]
            .filter(Boolean)
            .join(" · ")}`
        : "\n  No provenance attached (not a GitHub Actions run) — the plugin will show this delivery as unattributed.") +
      `\n  The designer's plugin finds it on its next "Check for updates". Nothing applies without their review.`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// figma receive — the dev door (plugin Send tab → reviewed local diff).
// PURE CORE below (parse / plan / diff — unit-pinned, no I/O), thin shell at
// the bottom (network + filesystem, executes exactly what the plan says).
// ---------------------------------------------------------------------------

/** The proposal envelope the plugin's Send tab exports (engine
 *  proposeDiff's exportJson) and the bridge tags as kind 'proposal'. */
export const CONTRACT_PROPOSAL_TYPE = "CONTRACT-PROPOSAL";

export type ProposalProjection =
  | {
      status: "verified-exact";
      propertyNames: string[];
      expectedCount: number;
      observedCount: number;
      tupleSetHash: string;
      tuples: string[];
    }
  | {
      status: "legacy-unverified";
      reason: "structured-exact-evidence-absent";
    };

export interface ProposalEnvelope {
  type: typeof CONTRACT_PROPOSAL_TYPE;
  baseContractId: string;
  baseVersion?: string;
  setName?: string;
  summary: string[];
  proposedContract: Record<string, unknown>;
  proposalNotes: string[];
  /** Exact returned-tuple proof, or an explicit legacy inversion receipt.
   *  Absent only on pre-v1.14 envelopes. */
  projection?: ProposalProjection;
  /** ENVELOPE v2: auto-proposed STUB contracts for nested instances with no
   *  contract in scope. The engine always produced these; the export doors
   *  used to drop them, leaving the proposed contract with dangling
   *  component refs that `generate` refuses by name. Absent on envelopes
   *  from older plugin builds — that absence is accepted, never an error. */
  childStubs?: Array<Record<string, unknown>>;
  /** ENVELOPE v2: the minted DTCG tree the proposal's `{imported.*}` refs
   *  resolve through, plus per-leaf entries. Absent on older envelopes. */
  mintedTokens?: {
    tree: Record<string, unknown>;
    count?: number;
    entries?: unknown[];
  };
}

/** Envelope referee — refusals by name, never a guess. PURE. */
export function parseProposal(
  raw: unknown,
): { ok: true; proposal: ProposalEnvelope } | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "the delivered payload is not a JSON object" };
  }
  const o = raw as Record<string, unknown>;
  if (o.type !== CONTRACT_PROPOSAL_TYPE) {
    return {
      ok: false,
      error: `the payload is not tagged ${CONTRACT_PROPOSAL_TYPE} (got type ${JSON.stringify(o.type ?? null)})`,
    };
  }
  const proposed = o.proposedContract;
  if (
    proposed === null ||
    typeof proposed !== "object" ||
    Array.isArray(proposed)
  ) {
    return {
      ok: false,
      error:
        'the proposal has no "proposedContract" object — re-run Read the set & diff in the plugin and send again',
    };
  }
  const id = (proposed as { id?: unknown }).id ?? o.baseContractId;
  if (typeof id !== "string" || id.length === 0) {
    return {
      ok: false,
      error:
        "neither proposedContract.id nor baseContractId names the contract — the proposal cannot be matched to a file",
    };
  }
  let projection: ProposalProjection | undefined;
  if (o.projection !== undefined && o.projection !== null) {
    if (typeof o.projection !== "object" || Array.isArray(o.projection)) {
      return {
        ok: false,
        error:
          'the proposal "projection" receipt is not an object — re-export from the plugin',
      };
    }
    const p = o.projection as Record<string, unknown>;
    if (p.status === "legacy-unverified") {
      if (p.reason !== "structured-exact-evidence-absent") {
        return {
          ok: false,
          error:
            "the proposal's legacy projection receipt has an unknown reason",
        };
      }
      projection = {
        status: "legacy-unverified",
        reason: "structured-exact-evidence-absent",
      };
    } else if (p.status === "verified-exact") {
      const propertyNames = p.propertyNames;
      const tuples = p.tuples;
      if (
        !Array.isArray(propertyNames) ||
        propertyNames.some((value) => typeof value !== "string") ||
        new Set(propertyNames).size !== propertyNames.length ||
        !Array.isArray(tuples) ||
        tuples.some((value) => typeof value !== "string") ||
        new Set(tuples).size !== tuples.length ||
        !Number.isInteger(p.expectedCount) ||
        !Number.isInteger(p.observedCount) ||
        p.expectedCount !== tuples.length ||
        p.observedCount !== tuples.length ||
        p.tupleSetHash !==
          revisionOf([...tuples].sort()).slice("sha256:".length)
      ) {
        return {
          ok: false,
          error:
            "the proposal's verified-exact projection receipt is malformed or does not match its tuple set",
        };
      }
      projection = {
        status: "verified-exact",
        propertyNames: [...propertyNames],
        expectedCount: p.expectedCount as number,
        observedCount: p.observedCount as number,
        tupleSetHash: p.tupleSetHash as string,
        tuples: [...tuples],
      };
    } else {
      return {
        ok: false,
        error: `the proposal projection is not verified exact or explicitly legacy (got ${JSON.stringify(p.status ?? null)})`,
      };
    }
  }
  // ENVELOPE v2 payloads. ABSENT fields are the old envelope shape and pass
  // untouched (backward compatible); a PRESENT-but-malformed field is a
  // named refusal — silently dropping a payload is exactly the defect this
  // round closes.
  let childStubs: Array<Record<string, unknown>> | undefined;
  if (o.childStubs !== undefined && o.childStubs !== null) {
    if (
      !Array.isArray(o.childStubs) ||
      o.childStubs.some(
        (s) => s === null || typeof s !== "object" || Array.isArray(s),
      )
    ) {
      return {
        ok: false,
        error:
          "the proposal's \"childStubs\" is not an array of contract objects — re-export the proposal from the plugin's Send tab",
      };
    }
    childStubs = o.childStubs as Array<Record<string, unknown>>;
  }
  let mintedTokens: ProposalEnvelope["mintedTokens"];
  if (o.mintedTokens !== undefined && o.mintedTokens !== null) {
    const mt = o.mintedTokens as {
      tree?: unknown;
      count?: unknown;
      entries?: unknown;
    };
    if (
      typeof o.mintedTokens !== "object" ||
      Array.isArray(o.mintedTokens) ||
      mt.tree === null ||
      typeof mt.tree !== "object" ||
      Array.isArray(mt.tree)
    ) {
      return {
        ok: false,
        error:
          'the proposal\'s "mintedTokens" has no DTCG "tree" object — re-export the proposal from the plugin\'s Send tab',
      };
    }
    // DEPTH GUARD (2026-08-03, adversarial verifier): a hostile deeply-nested
    // tree used to blow the stack as an uncaught RangeError in planReceive —
    // AFTER deliver-once had burned the payload, so the failure looked like a
    // vanished delivery. A real DTCG tree is a few levels deep; 64 is far past
    // any legitimate shape. Iterative, so the guard itself cannot overflow.
    {
      const MAX_DEPTH = 64;
      const stack: Array<{ n: Record<string, unknown>; d: number }> = [
        { n: mt.tree as Record<string, unknown>, d: 1 },
      ];
      while (stack.length > 0) {
        const { n, d } = stack.pop()!;
        if (d > MAX_DEPTH) {
          return {
            ok: false,
            error: `the proposal's "mintedTokens.tree" nests deeper than ${MAX_DEPTH} levels — no DTCG token tree has that shape; the delivery is refused as malformed`,
          };
        }
        for (const v of Object.values(n)) {
          if (v !== null && typeof v === "object" && !Array.isArray(v))
            stack.push({ n: v as Record<string, unknown>, d: d + 1 });
        }
      }
    }
    mintedTokens = {
      tree: mt.tree as Record<string, unknown>,
      count: typeof mt.count === "number" ? mt.count : undefined,
      entries: Array.isArray(mt.entries) ? mt.entries : undefined,
    };
  }
  return {
    ok: true,
    proposal: {
      type: CONTRACT_PROPOSAL_TYPE,
      baseContractId:
        typeof o.baseContractId === "string" ? o.baseContractId : id,
      baseVersion:
        typeof o.baseVersion === "string" ? o.baseVersion : undefined,
      setName: typeof o.setName === "string" ? o.setName : undefined,
      summary: Array.isArray(o.summary)
        ? o.summary.filter((s): s is string => typeof s === "string")
        : [],
      proposedContract: proposed as Record<string, unknown>,
      ...(projection ? { projection } : {}),
      proposalNotes: Array.isArray(o.proposalNotes)
        ? o.proposalNotes.filter((s): s is string => typeof s === "string")
        : [],
      ...(childStubs && childStubs.length > 0 ? { childStubs } : {}),
      ...(mintedTokens ? { mintedTokens } : {}),
    },
  };
}

/** id → filename convention: the namespace prefix drops
 *  (`polaris.badge` → `badge.contract.json`) — the same convention the
 *  plugin's PR path pre-fills. PURE.
 *
 *  TRAVERSAL-PROOF (2026-08-03, adversarial verifier): the id arrives inside a
 *  pasted/received envelope, i.e. from OUTSIDE this process's trust boundary,
 *  and the old form let `ds.../../x` walk the write out of --out (executed:
 *  ESCAPED-STUB.contract.json landed one directory above the target). Every
 *  character outside the schema's own id alphabet is replaced, path separators
 *  included, so the result is always a single flat filename.
 *
 *  MOVED to core/canvas-code-plan.ts (the plugin's GitHub PR door now plans
 *  the same file layout, and the naming rule must be ONE function on both
 *  sides) — re-exported here so every existing CLI import keeps working. */
export {
  contractFileNameForId,
  flatIdStem,
  mintedTokensFileNameForId,
  proposalFileNameForId,
} from "../../../../core/canvas-code-plan.js";

/** Resolve a planned output below a trusted root. Both native and Windows
 * absolute forms are rejected so a plan remains safe across platforms. */
export function containedOutputPath(root: string, plannedPath: string): string {
  if (
    plannedPath.length === 0 ||
    path.isAbsolute(plannedPath) ||
    path.win32.isAbsolute(plannedPath)
  ) {
    throw new CliUsageError(
      `receive REFUSED: planned write "${plannedPath}" is not a relative path inside --out; nothing was written.`,
    );
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, plannedPath);
  if (
    resolved === resolvedRoot ||
    !resolved.startsWith(resolvedRoot + path.sep)
  ) {
    throw new CliUsageError(
      `receive REFUSED: planned write "${plannedPath}" resolves OUTSIDE --out (${resolved}) — the delivery carries a hostile or malformed id; nothing was written.`,
    );
  }
  return resolved;
}

export interface ReceiveCommitOptions {
  /** Fault-injection seam used by rollback tests. */
  beforeInstall?: (index: number, destination: string) => void;
}

/** Commit every receive/apply artifact as one rollback-capable transaction.
 * All bodies must be generated and validated before this function is called. */
export function commitReceiveWrites(
  plannedWrites: Map<string, string>,
  options: ReceiveCommitOptions = {},
): void {
  const records: Array<{
    destination: string;
    temporary: string;
    backup: string;
    originalMoved: boolean;
    installed: boolean;
  }> = [];
  try {
    let index = 0;
    for (const [destination, contents] of plannedWrites) {
      mkdirSync(path.dirname(destination), { recursive: true });
      const suffix = `.receive-${process.pid}-${index++}`;
      const record = {
        destination,
        temporary: `${destination}${suffix}.tmp`,
        backup: `${destination}${suffix}.bak`,
        originalMoved: false,
        installed: false,
      };
      writeFileSync(record.temporary, contents);
      records.push(record);
    }
    for (const [index, record] of records.entries()) {
      if (existsSync(record.destination)) {
        renameSync(record.destination, record.backup);
        record.originalMoved = true;
      }
      options.beforeInstall?.(index, record.destination);
      renameSync(record.temporary, record.destination);
      record.installed = true;
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const record of [...records].reverse()) {
      try {
        if (record.installed && existsSync(record.destination)) {
          unlinkSync(record.destination);
        }
        if (record.originalMoved && existsSync(record.backup)) {
          renameSync(record.backup, record.destination);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "receive commit failed and rollback was incomplete; manual recovery artifacts were preserved",
      );
    }
    for (const record of records) {
      if (existsSync(record.temporary)) unlinkSync(record.temporary);
      if (existsSync(record.backup)) unlinkSync(record.backup);
    }
    throw error;
  }
  for (const record of records) {
    if (existsSync(record.backup)) unlinkSync(record.backup);
  }
}

/** Minimal unified diff (LCS over lines, 3 lines of context) — zero-dep by
 *  repo culture; contract files are small so O(n·m) is fine. PURE. */
export function unifiedDiff(
  oldText: string,
  newText: string,
  filePath: string,
): string[] {
  if (oldText === newText) return [];
  const a = oldText.split("\n");
  const b = newText.split("\n");
  // LCS table.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  // Walk into ops: ' ' keep, '-' del, '+' add.
  const ops: Array<{
    tag: " " | "-" | "+";
    line: string;
    ai: number;
    bi: number;
  }> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) ops.push({ tag: " ", line: a[i], ai: i++, bi: j++ });
    else if (lcs[i + 1][j] >= lcs[i][j + 1])
      ops.push({ tag: "-", line: a[i], ai: i++, bi: j });
    else ops.push({ tag: "+", line: b[j], ai: i, bi: j++ });
  }
  while (i < a.length) ops.push({ tag: "-", line: a[i], ai: i++, bi: j });
  while (j < b.length) ops.push({ tag: "+", line: b[j], ai: i, bi: j++ });
  // Group into hunks with 3 lines of context.
  const CONTEXT = 3;
  const changed = ops.map((op) => op.tag !== " ");
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (!changed[k]) continue;
    for (
      let c = Math.max(0, k - CONTEXT);
      c <= Math.min(ops.length - 1, k + CONTEXT);
      c++
    )
      keep[c] = true;
  }
  const out: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  let k = 0;
  while (k < ops.length) {
    if (!keep[k]) {
      k++;
      continue;
    }
    const start = k;
    let end = k;
    while (end < ops.length && keep[end]) end++;
    const hunk = ops.slice(start, end);
    const aStart = (hunk.find((h) => h.tag !== "+")?.ai ?? hunk[0].ai) + 1;
    const bStart = (hunk.find((h) => h.tag !== "-")?.bi ?? hunk[0].bi) + 1;
    const aCount = hunk.filter((h) => h.tag !== "+").length;
    const bCount = hunk.filter((h) => h.tag !== "-").length;
    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
    for (const h of hunk) out.push(h.tag + h.line);
    k = end;
  }
  return out;
}

export interface ReceivePlan {
  contractId: string;
  /** Target contract filename inside --out (existing match by id, else the
   *  <name>.contract.json convention). */
  fileName: string;
  /** Proposal artifact filename, always written: .proposals/<id>.proposal.json */
  proposalFileName: string;
  proposalText: string;
  newText: string;
  oldText: string | null;
  changed: boolean;
  diff: string[];
  /** The ONLY contract-file write the shell may perform. null = the shell
   *  MUST NOT touch the contract file (the no-silent-write guarantee lives
   *  here, in the pure core, where it is unit-pinned). */
  contractWrite: { fileName: string; contents: string } | null;
  /** ENVELOPE v2 — stub contracts landing as their own files. Empty without
   *  --apply (the covenant: nothing but the proposal artifact is written)
   *  and empty when the envelope carries none (old plugin builds). */
  stubWrites: Array<{ contractId: string; fileName: string; contents: string }>;
  /** Stubs NOT written, each with its named reason (e.g. a REAL contract
   *  with that id already sits in --out — a stub must never overwrite it). */
  stubSkips: Array<{ contractId: string; reason: string }>;
  /** ENVELOPE v2 — the minted DTCG tree as its own token file. null without
   *  --apply or when the envelope minted nothing. */
  mintedWrite: { fileName: string; contents: string } | null;
  /** The exact runnable generate invocation for everything this plan writes
   *  (contract + stubs, --tokens including the minted tree), or null when
   *  nothing lands (no --apply). */
  nextCommand: string | null;
}

/** What the shell knows about the destination — planReceive stays PURE. */
export interface ReceiveContext {
  /** Contract ids among the envelope's childStubs that already have a REAL
   *  contract file in --out (matched by id). Those stubs are skipped BY
   *  NAME — a stub must never overwrite an adopted contract. */
  existingStubIds?: ReadonlySet<string>;
  /** ds-contracts.config.json `generate.tokens` — carried into the printed
   *  generate command ahead of the minted tree. */
  configTokens?: string[];
  /** `generate.out` from the config; the printed command falls back to
   *  "generated" so it stays runnable. */
  codeOutDir?: string | null;
  /** The --out directory as the user typed it (for printable paths). */
  outDirLabel?: string;
}

/** Decide everything about landing a delivered proposal — PURE. The shell
 *  supplies the delivered envelope, the existing file (matched by contract
 *  id, or null), whether --apply was given, and the destination facts. */
export function planReceive(
  proposal: ProposalEnvelope,
  existing: { fileName: string; text: string } | null,
  apply: boolean,
  ctx: ReceiveContext = {},
): ReceivePlan {
  let proposedContract = structuredClone(
    proposal.proposedContract,
  ) as ProvenancedContract;
  if (existing) {
    const base = JSON.parse(existing.text) as ProvenancedContract;
    assertContractProvenance(base, String(base.id ?? existing.fileName));
    if (!proposedContract.provenance && base.provenance) {
      proposedContract = markAwaitingCodeAdoption(base, proposedContract);
    }
  }
  assertContractProvenance(
    proposedContract,
    String(proposedContract.id ?? proposal.baseContractId),
  );
  const preparedProposal = { ...proposal, proposedContract };
  const contractId = String(proposedContract.id ?? proposal.baseContractId);
  const fileName = existing
    ? existing.fileName
    : contractFileNameForId(contractId);
  const newText = JSON.stringify(proposedContract, null, 2) + "\n";
  const oldText = existing ? existing.text : null;
  const changed = oldText !== newText;

  // ENVELOPE v2 payloads — planned ONLY under --apply (the no-silent-write
  // covenant covers every file, not just the headline contract; without
  // --apply the proposal artifact carries all three payloads verbatim).
  const stubWrites: ReceivePlan["stubWrites"] = [];
  const stubSkips: ReceivePlan["stubSkips"] = [];
  const seenStubIds = new Set<string>([contractId]);
  const seenWriteNames = new Set<string>([fileName]);
  for (const stub of proposal.childStubs ?? []) {
    const stubId = typeof stub.id === "string" ? stub.id : null;
    if (!stubId) {
      stubSkips.push({
        contractId: "(unnamed)",
        reason:
          'this stub carries no "id" — it cannot be filed and is kept only inside the proposal artifact',
      });
      continue;
    }
    if (seenStubIds.has(stubId)) {
      stubSkips.push({
        contractId: stubId,
        reason: "a contract with this id is already part of this delivery",
      });
      continue;
    }
    seenStubIds.add(stubId);
    if (ctx.existingStubIds?.has(stubId)) {
      stubSkips.push({
        contractId: stubId,
        reason: `a contract with id "${stubId}" already exists in --out — the auto-proposed stub is NOT written over it (the real contract wins; the stub stays in the proposal artifact)`,
      });
      continue;
    }
    if (!apply) continue; // named below via nextCommand/printout, never written silently
    const stubFileName = contractFileNameForId(stubId);
    if (seenWriteNames.has(stubFileName)) {
      stubSkips.push({
        contractId: stubId,
        reason: `its destination "${stubFileName}" collides with another contract in this delivery — it is NOT written over it and stays in the proposal artifact`,
      });
      continue;
    }
    seenWriteNames.add(stubFileName);
    stubWrites.push({
      contractId: stubId,
      fileName: stubFileName,
      contents: JSON.stringify(stub, null, 2) + "\n",
    });
  }
  const mintedTree = proposal.mintedTokens?.tree;
  // Same trust boundary as the stub ids: contractId is envelope-supplied, so
  // it is flattened to a single filename (no separators can survive).
  const mintedFileName = `${flatIdStem(contractId, "proposal")}.minted.dtcg.json`;
  const mintedWrite =
    apply && mintedTree && Object.keys(mintedTree).length > 0
      ? {
          fileName: mintedFileName,
          contents: JSON.stringify(mintedTree, null, 2) + "\n",
        }
      : null;

  // The runnable next step: generate over EVERYTHING this plan writes, with
  // --tokens naming the minted tree (plus the repo's configured token files)
  // so the first generate resolves every {imported.*} ref instead of
  // refusing it by name.
  const outLabel = ctx.outDirLabel ?? ".";
  const inDir = (f: string) => path.join(outLabel, f);
  const contractArgs = [
    inDir(fileName),
    ...stubWrites.map((s) => inDir(s.fileName)),
  ];
  const tokenArgs = [
    ...(ctx.configTokens ?? []),
    ...(mintedWrite ? [inDir(mintedFileName)] : []),
  ];
  const nextCommand = apply
    ? `npx ds-contracts generate ${contractArgs.join(" ")} --out ${ctx.codeOutDir ?? "generated"} --stories${tokenArgs.length > 0 ? ` --tokens ${tokenArgs.join(",")}` : ""}`
    : null;

  return {
    contractId,
    fileName,
    proposalFileName: path.join(
      ".proposals",
      proposalFileNameForId(contractId),
    ),
    proposalText: JSON.stringify(preparedProposal, null, 2) + "\n",
    newText,
    oldText,
    changed,
    diff: unifiedDiff(oldText ?? "", newText, fileName),
    contractWrite: apply && changed ? { fileName, contents: newText } : null,
    stubWrites,
    stubSkips,
    mintedWrite,
    nextCommand,
  };
}

/** Find the *.contract.json in outDir whose document id matches — the id is
 *  the identity, the filename only the convention. Thin I/O helper. */
export function findExistingContractFile(
  outDir: string,
  contractId: string,
): { fileName: string; text: string } | null {
  if (!existsSync(outDir)) return null;
  for (const f of readdirSync(outDir)
    .filter((f) => f.endsWith(".contract.json"))
    .sort()) {
    try {
      const text = readFileSync(path.join(outDir, f), "utf8");
      if ((JSON.parse(text) as { id?: unknown }).id === contractId)
        return { fileName: f, text };
    } catch {
      /* unreadable/non-JSON neighbors are not this command's problem */
    }
  }
  return null;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The two `generate` facts the printed next-command needs, read directly so
 *  this module never statically imports propose-pr (which imports THIS file;
 *  see the lazy-import note at the top). Absent/unreadable → empty facts and
 *  the command falls back to runnable defaults. */
function loadReceiveDsConfig(cwd: string): {
  tokens: string[];
  out: string | null;
} {
  try {
    const raw = JSON.parse(
      readFileSync(path.join(cwd, "ds-contracts.config.json"), "utf8"),
    ) as {
      generate?: { tokens?: unknown; out?: unknown };
    };
    const gen = raw.generate ?? {};
    return {
      tokens: Array.isArray(gen.tokens)
        ? gen.tokens.filter((t): t is string => typeof t === "string")
        : [],
      out:
        typeof gen.out === "string" && gen.out.trim() !== ""
          ? gen.out.trim()
          : null,
    };
  } catch {
    return { tokens: [], out: null };
  }
}

async function receiveCommand(argv: string[]): Promise<number> {
  const parsed = parseFlags(argv, {
    value: ["out", "bridge"],
    bool: ["apply"],
  });
  const out = flagString(parsed, "out");
  if (!out)
    throw new CliUsageError(
      "figma receive needs --out <contracts-dir> — where the reviewed diff lands",
    );
  const apply = parsed.flags.get("apply") === true;
  const base = (
    flagString(parsed, "bridge") ??
    process.env.DS_CONTRACTS_BRIDGE_URL ??
    DEFAULT_BRIDGE_URL
  ).replace(/\/$/, "");
  const outDir = path.resolve(out);

  // 1. Mint the pairing code.
  const created = await fetch(`${base}/bridge/session`, { method: "POST" });
  const session = (await created.json().catch(() => ({}))) as {
    code?: string;
    ttlSeconds?: number;
    error?: string;
  };
  if (!created.ok || typeof session.code !== "string") {
    console.error(
      `✘ bridge refused the session (${created.status}): ${session.error ?? "unnamed error"}`,
    );
    return 1;
  }
  const code = session.code;
  const ttlSeconds = session.ttlSeconds ?? 15 * 60;
  console.log(`Pairing code: ${code}`);
  console.log(
    `In the Figma plugin's Send tab, run "Read the set & diff", then enter this code under "Send to repo". Waiting (code expires in ${Math.round(ttlSeconds / 60)} minutes; Ctrl-C to stop)…`,
  );

  // 2. Poll politely — the same 2.5s cadence the plugin and playground use.
  const deadline = Date.now() + ttlSeconds * 1000;
  let delivered: { kind?: string; dump?: unknown } | null = null;
  while (Date.now() < deadline) {
    let res: Response;
    try {
      res = await fetch(`${base}/bridge/${encodeURIComponent(code)}`);
    } catch {
      await sleep(2500); // transient network blip — keep polling
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      kind?: string;
      dump?: unknown;
      error?: string;
    };
    if (res.ok && body.status === "delivered") {
      delivered = body;
      break;
    }
    if (res.ok && body.status === "waiting") {
      await sleep(2500);
      continue;
    }
    console.error(
      `✘ bridge refused (${res.status}): ${body.error ?? "unnamed error"}`,
    );
    return 1;
  }
  if (!delivered) {
    console.error(
      "✘ Nothing arrived before the code expired — run figma receive again for a fresh code.",
    );
    return 1;
  }
  const kind = delivered.kind ?? "dump";
  if (kind !== "proposal") {
    console.error(
      `✘ Refused — that code carried a ${kind === "dump" ? "canvas dump" : kind}, not a ${CONTRACT_PROPOSAL_TYPE}. figma receive only lands proposals from the plugin's Send tab; deliver-once means this payload is now gone — send again to a fresh code.`,
    );
    return 1;
  }
  const envelope = parseProposal(delivered.dump);
  if (!envelope.ok) {
    console.error(`✘ Refused — ${envelope.error}`);
    return 1;
  }

  // 3. Plan (pure), then execute EXACTLY the plan.
  const proposal = envelope.proposal;
  // ENVELOPE v2 context: which stub ids already have a real contract in
  // --out, and the repo's recorded generate facts for the printed command.
  const existingStubIds = new Set<string>();
  for (const stub of proposal.childStubs ?? []) {
    const stubId = typeof stub.id === "string" ? stub.id : null;
    if (stubId && findExistingContractFile(outDir, stubId))
      existingStubIds.add(stubId);
  }
  const dsConfig = loadReceiveDsConfig(process.cwd());
  const plan = planReceive(
    proposal,
    findExistingContractFile(
      outDir,
      String(proposal.proposedContract.id ?? proposal.baseContractId),
    ),
    apply,
    {
      existingStubIds,
      configTokens: dsConfig.tokens,
      codeOutDir: dsConfig.out,
      outDirLabel: out,
    },
  );

  // --apply must not report success for blank anatomy. Refuse BEFORE
  // commitReceiveWrites mutates anything (proposal, contract, stubs, tokens,
  // or generated code). Without --apply the proposal artifact may still land
  // for review — same split as the CI anatomy gate (contracts commit; canvas
  // delivery does not).
  if (apply && isDrawableEmptyContract(proposal.proposedContract)) {
    console.error(
      `✘ Refused — ${drawableEmptyRefusalMessage(proposal.proposedContract, "apply")}`,
    );
    return 1;
  }

  // Validate the COMPLETE write set before the first mkdir/write. This keeps
  // a hostile late entry from leaving an earlier artifact or contract behind.
  const plannedOutputs = [
    plan.proposalFileName,
    ...(plan.contractWrite ? [plan.contractWrite.fileName] : []),
    ...plan.stubWrites.map((s) => s.fileName),
    ...(plan.mintedWrite ? [plan.mintedWrite.fileName] : []),
  ];
  const outputPaths = new Map(
    plannedOutputs.map((fileName) => [
      fileName,
      containedOutputPath(outDir, fileName),
    ]),
  );
  const outputPath = (fileName: string): string => {
    const resolved = outputPaths.get(fileName);
    if (!resolved) {
      throw new CliUsageError(
        `receive REFUSED: unvalidated planned write "${fileName}"; nothing was written.`,
      );
    }
    return resolved;
  };

  const proposalSaved = () =>
    console.log(`✔ Proposal saved: ${path.join(out, plan.proposalFileName)}`);

  if (proposal.summary.length > 0) {
    console.log(`\nProposed change — ${proposal.setName ?? plan.contractId}:`);
    for (const line of proposal.summary) console.log(`  ${line}`);
  }
  // ENVELOPE v2 payloads, named whether or not they land this run.
  const stubCount = (proposal.childStubs ?? []).length;
  const mintedCount =
    proposal.mintedTokens &&
    proposal.mintedTokens.tree &&
    Object.keys(proposal.mintedTokens.tree).length > 0
      ? (proposal.mintedTokens.count ??
        Object.keys(proposal.mintedTokens.tree).length)
      : 0;
  if (stubCount > 0 || mintedCount > 0) {
    console.log(
      `\nThis proposal also carries ${[
        stubCount > 0
          ? `${stubCount} auto-proposed stub contract(s) (${(proposal.childStubs ?? []).map((s) => String((s as { id?: unknown }).id ?? "?")).join(", ")})`
          : null,
        mintedCount > 0
          ? `a minted token tree (${mintedCount} token(s))`
          : null,
      ]
        .filter(Boolean)
        .join(
          " and ",
        )} — the contract's component/token refs resolve through them.`,
    );
  }
  for (const skip of plan.stubSkips)
    console.log(`  stub ${skip.contractId}: ${skip.reason}`);

  const writeExtras = () => {
    for (const s of plan.stubWrites) {
      console.log(
        `✔ Wrote stub contract ${path.join(out, s.fileName)} (${s.contractId}) — replace it by importing the real child set.`,
      );
    }
    if (plan.mintedWrite) {
      console.log(
        `✔ Wrote minted token tree ${path.join(out, plan.mintedWrite.fileName)} — provisional names; review before adopting.`,
      );
    }
    if (plan.nextCommand) {
      // The banner must not claim a minted tree the delivery did not carry
      // (old envelopes have none — verified live, 2026-08-03).
      console.log(
        plan.mintedWrite
          ? `\nNext — generate the code (the minted tree rides --tokens so every ref resolves):\n  ${plan.nextCommand}`
          : `\nNext — generate the code:\n  ${plan.nextCommand}`,
      );
    }
  };
  const plannedReceiveWrites = (
    codeFiles: Array<{ destPath: string; contents: string }> = [],
  ): Map<string, string> => {
    const writes = new Map<string, string>([
      [outputPath(plan.proposalFileName), plan.proposalText],
    ]);
    if (plan.contractWrite) {
      writes.set(
        outputPath(plan.contractWrite.fileName),
        plan.contractWrite.contents,
      );
    }
    for (const stub of plan.stubWrites) {
      writes.set(outputPath(stub.fileName), stub.contents);
    }
    if (plan.mintedWrite) {
      writes.set(
        outputPath(plan.mintedWrite.fileName),
        plan.mintedWrite.contents,
      );
    }
    for (const file of codeFiles) writes.set(file.destPath, file.contents);
    return writes;
  };

  if (!plan.changed) {
    commitReceiveWrites(plannedReceiveWrites());
    proposalSaved();
    console.log(
      `\n${plan.fileName} already matches the proposal byte-for-byte — nothing to apply to it.`,
    );
    writeExtras();
    return 0;
  }
  console.log(
    plan.oldText === null
      ? `\nNew contract (no ${plan.fileName} in ${out} yet):`
      : "",
  );
  for (const line of plan.diff) console.log(line);

  if (plan.contractWrite === null) {
    commitReceiveWrites(plannedReceiveWrites());
    proposalSaved();
    console.log(
      `\nNothing written to ${plan.fileName}${stubCount > 0 || mintedCount > 0 ? " (nor the stub/minted files above)" : ""} — review the diff, then re-run with --apply to write ${stubCount > 0 || mintedCount > 0 ? "all of it" : "it"} (or apply by hand from ${path.join(out, plan.proposalFileName)}).`,
    );
    return 0;
  }
  // The landed contract is only half of what the proposal is worth: a
  // contract nobody can run is a document. `propose-pr` already carries both
  // halves into one PR; this door now does the same on disk — SAME
  // resolveCodeConfig (a framework is never guessed), SAME generateCodeFiles
  // (the shipping generator), same named refusal printed when there is no
  // recorded target. Reached only under --apply: without it, plan.contractWrite
  // is null and this command's whole contract is that it writes nothing.
  const {
    assertDestinationsUnderRoot,
    assertUniqueDestinations,
    generateCodeFiles,
    loadDsConfig,
    resolveCodeConfig,
  } = await import("./propose-pr.js");
  const rc = resolveCodeConfig(
    { noCode: false },
    loadDsConfig(process.cwd()),
    "ds-contracts.config.json",
  );
  let codeFiles: Array<{ destPath: string; contents: string }> = [];
  let codeNotes: string[] = [];
  if (rc.ok) {
    // ENVELOPE v2: the stubs ride into the generation scope and the minted
    // tree rides the token inventory — without them a foreign-kit proposal's
    // component/token refs refuse by name and the door dead-ends.
    const generated = await generateCodeFiles(
      plan.contractWrite.contents,
      rc.config,
      process.cwd(),
      {
        stubs: proposal.childStubs ?? [],
        mintedTree: proposal.mintedTokens?.tree ?? null,
      },
    );
    codeFiles = generated.files;
    codeNotes = generated.notes;
    // Bridge-delivered contract.name feeds emitter filenames. Propose-pr
    // already refused unsafe destPaths; receive --apply must do the same
    // before commitReceiveWrites or a traversal-shaped name writes outside
    // generate.out / cwd.
    assertUniqueDestinations(codeFiles);
    assertDestinationsUnderRoot(codeFiles, process.cwd(), rc.config.outDir);
  }

  // All parsers, emitters, destination checks, and code generation have
  // completed. Only now may any artifact move into place.
  commitReceiveWrites(plannedReceiveWrites(codeFiles));
  proposalSaved();
  console.log(
    `\n✔ Wrote ${path.join(out, plan.contractWrite.fileName)} — review the diff and commit it yourself (ds-contracts never touches git).`,
  );
  writeExtras();
  if (!rc.ok) {
    console.log(`\nNo component code generated — ${rc.reason}`);
  } else {
    console.log(
      `✔ Generated ${codeFiles.length} file(s): ${codeFiles.map((f) => f.destPath).join(", ")}`,
    );
    for (const n of codeNotes) console.log(`  ${n}`);
  }
  return 0;
}

export async function figmaCommand(argv: string[]): Promise<number> {
  if (argv[0] === "bundle") return bundleCommand(argv.slice(1));
  if (argv[0] === "push") return pushCommand(argv.slice(1));
  if (argv[0] === "claim-channel") return claimChannelCommand(argv.slice(1));
  if (argv[0] === "publish") return publishCommand(argv.slice(1));
  if (argv[0] === "receive") return receiveCommand(argv.slice(1));

  const parsed = parseFlags(argv, {
    value: ["out", "tokens", "icons", "file-key"],
  });
  if (parsed.positionals.length === 0) {
    throw new CliUsageError(
      "figma needs contract files/directories (or the `bundle` / `push` / `publish` / `claim-channel` / `receive` subcommands)",
    );
  }
  const out = flagString(parsed, "out");
  if (!out) throw new CliUsageError("figma needs --out <dir>");
  const files = expandContractArgs(parsed.positionals);
  files.forEach((file) => {
    const raw = JSON.parse(readFileSync(file, "utf8")) as ProvenancedContract;
    assertContractProvenance(raw, String(raw.id ?? file));
  });
  const contracts = loadContracts(files);
  const { ctx, routing } = buildEmitterCtxWithRouting(
    contracts,
    expandTokenArgs(flagString(parsed, "tokens")),
    flagString(parsed, "icons"),
    flagString(parsed, "file-key"),
  );
  const outDir = path.resolve(out);
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const contract of contracts.values()) {
    for (const file of withTokenDiagnostics(routing, () =>
      figmaScriptEmitter.emit(contract, ctx),
    )) {
      writeFileSync(path.join(outDir, file.path), file.contents);
      written.push(file.path);
    }
  }
  console.log(
    `✔ Emitted ${written.length} Figma sync script(s) → ${outDir}: ${written.join(", ")}`,
  );
  return 0;
}
