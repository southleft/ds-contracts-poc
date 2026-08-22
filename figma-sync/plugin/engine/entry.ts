/**
 * PLUGIN ENGINE ENTRY — the core barrel, packaged for the Sync Runner plugin.
 *
 * scripts/build-plugin-zip.mjs bundles this file (esbuild, platform=browser,
 * IIFE) together with the repo's tokens, contracts and icons (injected as
 * `__DSC_DATA__` at build time) and embeds the result in the packaged
 * ui.html, where it lands on `window.DSC`. Everything here is PURE compute —
 * contract text in, plain-words reports and Plugin-API script text out. The
 * scripts are EXECUTED by code.js through the same run-paste machinery the
 * paste tab uses; this module never touches the `figma` global itself, which
 * is why the headless harness (scripts/plugin-engine-check.mjs) can exercise
 * every flow in a VM with a mocked `figma`.
 *
 * Error discipline: the playground's plain-words rule — raw validator or
 * exception JSON never leaves this module as a headline; technical text
 * rides `detail` fields.
 *
 * NAMED SCOPE (v1):
 *   - Token resolution is the repo token tree baked into the bundle — OR,
 *     when a CONTRACTS-BUNDLE carries a `tokenSet` section (a foreign
 *     library's flat DTCG base + optional light/dark modes + minted tree),
 *     that tokenSet: its contracts resolve against base + minted and the
 *     tokens plan step syncs the literal set as one named collection
 *     (Light/Dark modes, Figma-native aliases for minted {alias} leaves).
 *     Either way a contract that references tokens outside its inventory is
 *     refused BY NAME (the emitter's own "Cannot resolve token" refusal,
 *     surfaced in plain words).
 *   - The propose diff is API-LEVEL (version, props, slots, variant axes)
 *     plus a single named line when anatomy/style bytes differ — interior
 *     style diffs are summarized, not itemized.
 *   - The UPDATE report's interior diff (G8) itemizes per channel only when
 *     the recorded installed version matches a baked contract's version (the
 *     sets this plugin generated); otherwise it says so and stays summary-
 *     level — never a guessed diff.
 */
import {
  CODE_TARGET_LABELS,
  ContractSchema,
  RUNTIME_EMIT_REV,
  assertContractProvenance,
  componentRefsOf,
  contractFileNameForId,
  createFigmaEngine,
  dumpCapturesHidden,
  emitTokenSetScript,
  mintedTokensFileNameForId,
  parseTokenSet,
  plannedCodePaths,
  proposeBatchFromDump,
  markAwaitingCodeAdoption,
  provenanceHeadline,
  provenanceSentence,
  slotsOf,
  sortByDependencies,
  tokenCorpusFromJson,
  tokenSetTokenTrees,
  type CanvasProvenance,
  type Contract,
  type TokenCorpus,
  type TokenSetPayload,
} from "../../../core/index.js";
import { FINGERPRINT_SRC } from "../../../core/canvas-fingerprint.js";

// ---------------------------------------------------------------------------
// Data baked in at bundle time (scripts/build-plugin-zip.mjs).
// ---------------------------------------------------------------------------

export interface PluginEngineData {
  tokens: {
    primitives: Record<string, unknown>;
    semantic: Record<string, unknown>;
    light: Record<string, unknown>;
    dark: Record<string, unknown>;
    brands: Record<string, Record<string, unknown>>;
  };
  /** The repo's shipping contract documents — the reference scope
   *  composition refs resolve through when a pasted contract needs them. */
  contracts: unknown[];
  /** Icon asset name → SVG markup (assets/icons/*.svg). */
  icons: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Plain-words plumbing
// ---------------------------------------------------------------------------

export interface PlainIssue {
  /** Human sentence, safe as a visible headline. */
  headline: string;
  /** Verbatim technical text when it differs. */
  detail?: string;
}

const plain = (headline: string, detail?: string): PlainIssue =>
  detail && detail !== headline ? { headline, detail } : { headline };

const errText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** Engine refusals are already named sentences; anything JSON-shaped or
 *  enormous is demoted to detail (the playground's plain-error rule). */
const plainFromThrow = (prefix: string, e: unknown): PlainIssue => {
  const message = errText(e);
  if (/^\s*[[{"]/.test(message) || message.length > 600) {
    return plain(
      `${prefix} failed with a technical error (full text below).`,
      message,
    );
  }
  return plain(`${prefix}: ${message}`);
};

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export interface GenerateStep {
  kind: "tokens" | "component" | "version-marker";
  /** Plain-words step title for the run log. */
  title: string;
  contractId?: string;
  code: string;
}

export type ParsedIncoming =
  | {
      ok: true;
      kind: "contract" | "bundle";
      contracts: unknown[];
      /** The bundle's foreign token set (name + flat DTCG base + optional
       *  modes/minted) — null when the paste rides the baked repo tokens. */
      tokenSet: TokenSetPayload | null;
      /** Bundle-carried icon assets ({name: svgMarkup}) — null when the
       *  paste carries none; merged over the baked repo icons at plan time. */
      icons: Record<string, string> | null;
    }
  | { ok: false; issue: PlainIssue };

/** One per-channel style difference between the installed spec and the
 *  incoming one (G8) — rendered by the UI with the Drift tab's pretty
 *  printer so both reports speak one language. */
export interface StyleChange {
  /** Part name (anatomy path tail) the change sits on. */
  part: string;
  /** Designer channel word ("fill", "gap", "radius", "text color", …). */
  channel: string;
  was: string;
  now: string;
  /** Variant names carrying this change; null = every variant. */
  variants: string[] | null;
}

export interface UpdateRow {
  contractId: string;
  setName: string;
  version: string;
  action: "create" | "amend" | "skip" | "refused";
  /** The exact plain-words report line for this contract. */
  line: string;
  nodeId?: string;
  /** G2 (covenant repair): the Apply checkbox's starting state. False for
   *  canvas-edited amend targets — warn and default-safe, never block. */
  defaultSelected: boolean;
  /** G2: the target set has un-proposed canvas edits (its recomputed canvas
   *  state no longer matches the state its last sync recorded). */
  canvasEdited?: boolean;
  /** G2: the NAMED overwrite warning for a canvas-edited amend target. */
  warning?: string;
  /** G8: per-channel diff of the two compiled specs (installed vs incoming).
   *  null = the installed spec could not be matched (version unrecorded or
   *  not a baked contract's version), so nothing can be itemized honestly. */
  styleChanges?: StyleChange[] | null;
}

export interface UpdatePlan {
  rows: UpdateRow[];
  /** rows[].line plus the counts + nothing-applied tail — the whole report. */
  lines: string[];
}

export interface InventoryRow {
  contractId: string | null;
  name: string;
  nodeId: string;
  key: string | null;
  type: string;
  specHash: string | null;
  version: string | null;
  variants: number;
  props: string[];
  /** G2: canvas state vs the stamp its last sync recorded — the same
   *  recompute the Drift tab runs, joined into the update check so Apply
   *  can never silently overwrite a designer's edit. null = no stamp. */
  /** 'version-changed': the stamp predates the current fingerprint scheme
   *  (v4→v5 prototype wiring, v5→v6 resolved bindings) — regenerate to re-baseline.
   *  Deliberately NOT 'canvas-edited': that would be a false alarm. */
  drift: "in-sync" | "canvas-edited" | "unstamped" | "version-changed" | null;
  /** BROWNFIELD: false only on rows a `scanScriptSource()` run kept because
   *  the file made them by hand. The marked-only inventory every existing
   *  caller runs emits `true` on every row. */
  contractBacked?: boolean;
  /** Page the set lives on (scan rows; the marked inventory carries it too). */
  page?: string;
  /** Variant axis name → its options, straight off componentPropertyDefinitions. */
  variantAxes?: Record<string, string[]>;
  /** Property counts by kind — the API surface extract/figma-dump.js reads. */
  propKinds?: { variant: number; boolean: number; text: number; swap: number };
}

// ---------------------------------------------------------------------------
// THE STANDING CHANNEL — plugin side (docs/18 G1, slices S1+S2).
//
// Everything below is MODULE-LEVEL and PURE: no `figma`, no fetch, no engine
// data. That is deliberate — the eval imports these functions directly under
// tsx while the headless gate exercises the SAME functions through the built
// bundle on `window.DSC`, so the two can never drift.
//
// THE HOLE THIS CLOSES (the round's named defect): `updatePlan` compared
// specHash for EQUALITY only. No ordering existed anywhere, so receiving an
// OLDER bundle applied as an ordinary, default-SELECTED change — a silent
// downgrade, the canvas twin of docs/18's G4 silent revert. The channel's
// monotonic `seq` gives the file something to compare against, and the
// apply log gives it a memory.
// ---------------------------------------------------------------------------

/** CI-side facts that ride ALONGSIDE a channel delivery. Written by
 *  `ds-contracts figma publish`, stored and echoed by the worker WITHOUT
 *  being read, rendered here. Every field optional: a publish from a laptop
 *  has none, and inventing them would be a lie the plugin then displays. */
export interface ChannelProvenance {
  repo?: string;
  runId?: string;
  runUrl?: string;
  commit?: string;
  ref?: string;
  publishedAt?: string;
}

/** One `GET /channel/<readKey>` answer, as the UI receives it. */
export interface ChannelDelivery {
  status: "current" | "update";
  seq: number;
  publishedAt: string | null;
  bytes?: number;
  provenance?: ChannelProvenance | null;
  /** Absent on `status: 'current'` and on a `meta=1` head read. */
  bundle?: unknown;
}

/**
 * ONE RECORD SHAPE, designed to be the seed of docs/18 G13's apply log: the
 * entries array IS the log, this round just reads its head. Key names are
 * chosen for that future (source / channel / seq / publishedAt / appliedAt /
 * contractIds / bytes) so G13 adds a viewer, not a migration.
 *
 * It lives in ROOT pluginData — file-local, so it travels with the file and
 * is readable by anyone who can open it. Which is why `channel` stores a
 * FINGERPRINT of the read key and never the key.
 */
export interface ApplyLogEntry {
  /** How the bundle arrived. 'channel' is new this round; the pairing-code
   *  and paste paths are unchanged and do not write entries yet. */
  source: "channel" | "bridge" | "paste";
  /** First 12 characters of the read key — enough to tell two channels
   *  apart, useless as a credential. null for non-channel sources. */
  channel: string | null;
  /** The channel delivery number. null for sources that have no ordering
   *  (a pairing-code receive, a paste) — which is exactly why those keep
   *  today's behaviour: there is nothing honest to compare. */
  seq: number | null;
  publishedAt: string | null;
  appliedAt: string;
  contractIds: string[];
  bytes: number | null;
}

export interface ApplyLog {
  version: 1;
  entries: ApplyLogEntry[];
}

/** Root pluginData key under the ds_contracts namespace. */
export const APPLY_LOG_KEY = "applyLog";
/** Entries are capped so the record cannot grow without bound in a file
 *  synced daily for a year. Newest first; the tail falls off. */
export const APPLY_LOG_MAX_ENTRIES = 50;

/** Channel identity WITHOUT the credential. */
export const channelFingerprint = (readKey: string): string =>
  String(readKey || "").slice(0, 12);

export function emptyApplyLog(): ApplyLog {
  return { version: 1, entries: [] };
}

/** Tolerant reader: anything unreadable is treated as "no history", never as
 *  an error. A corrupt record must not be able to block an update. */
export function parseApplyLog(raw: string | null | undefined): ApplyLog {
  if (!raw) return emptyApplyLog();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyApplyLog();
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return emptyApplyLog();
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return emptyApplyLog();
  const clean: ApplyLogEntry[] = [];
  for (const e of entries) {
    if (e === null || typeof e !== "object" || Array.isArray(e)) continue;
    const o = e as Record<string, unknown>;
    clean.push({
      source:
        o.source === "channel" || o.source === "bridge" || o.source === "paste"
          ? o.source
          : "paste",
      channel: typeof o.channel === "string" ? o.channel : null,
      seq: typeof o.seq === "number" && Number.isFinite(o.seq) ? o.seq : null,
      publishedAt: typeof o.publishedAt === "string" ? o.publishedAt : null,
      appliedAt: typeof o.appliedAt === "string" ? o.appliedAt : "",
      contractIds: Array.isArray(o.contractIds)
        ? o.contractIds.filter((x): x is string => typeof x === "string")
        : [],
      bytes:
        typeof o.bytes === "number" && Number.isFinite(o.bytes)
          ? o.bytes
          : null,
    });
  }
  return { version: 1, entries: clean };
}

/** Newest first, capped. PURE — returns a new log. */
export function appendApplyEntry(
  log: ApplyLog,
  entry: ApplyLogEntry,
): ApplyLog {
  return {
    version: 1,
    entries: [entry, ...log.entries].slice(0, APPLY_LOG_MAX_ENTRIES),
  };
}

/** The highest delivery this FILE has applied from THIS channel. null = it
 *  has never applied from this channel, so nothing can be compared and
 *  nothing is claimed. Seq numbers from a DIFFERENT channel are deliberately
 *  ignored: two channels number independently, so comparing them would
 *  manufacture a warning out of nothing. */
export function lastAppliedSeq(
  log: ApplyLog,
  channel: string | null,
): number | null {
  if (!channel) return null;
  let best: number | null = null;
  for (const e of log.entries) {
    if (e.source !== "channel" || e.channel !== channel || e.seq === null)
      continue;
    if (best === null || e.seq > best) best = e.seq;
  }
  return best;
}

export interface ChannelFreshness {
  stale: boolean;
  /** The named warning, or the reassurance. Rendered verbatim. */
  line: string;
  lastAppliedSeq: number | null;
  seq: number;
}

/**
 * THE FRESHNESS GUARD. Same posture as the drift-aware overwrite warning
 * (G2): WARN AND DEFAULT-SAFE, never block. A designer who genuinely wants
 * to roll back ticks the boxes themselves.
 *
 * It fires when a delivery is not newer than what this file already applied
 * from this channel. With a monotonic worker that means one of:
 *   - the channel expired (30 days without a publish) and was re-claimed, so
 *     its numbering restarted at 1 while the file remembers 7;
 *   - the read key was repointed at a different, lower-numbered channel;
 *   - the same delivery is being applied twice.
 */
export function channelFreshness(
  delivery: { seq: number },
  log: ApplyLog,
  channel: string | null,
): ChannelFreshness {
  const last = lastAppliedSeq(log, channel);
  const seq = Number.isFinite(delivery.seq) ? delivery.seq : 0;
  if (last === null || seq > last) {
    return { stale: false, line: "", lastAppliedSeq: last, seq };
  }
  const line =
    seq === last
      ? `this delivery (#${seq}) is the one this file last applied — re-applying it changes nothing, so every box starts unchecked.`
      : `this delivery (#${seq}) is older than what this file last applied (#${last}) — applying it would roll this library BACKWARDS. Every box starts unchecked; tick them only if rolling back is what you want.`;
  return { stale: true, line, lastAppliedSeq: last, seq };
}

/** "4 minutes ago" / "2 days ago". Presentation only — never an artifact,
 *  so a clock difference can never change a byte anyone commits. */
export function relativeWhen(
  iso: string | null | undefined,
  now: Date,
): string {
  if (!iso) return "at an unrecorded time";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "at an unrecorded time";
  const secs = Math.round((now.getTime() - then) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * The provenance line rendered ABOVE the update report:
 *   "acme/design-system — CI run #17654321, commit 9f1c2ab, published 4 minutes ago"
 * A delivery with no provenance says so plainly rather than showing blanks —
 * "unattributed" is a fact a lead needs, not a gap to paper over.
 */
export function provenanceLine(
  provenance: ChannelProvenance | null | undefined,
  publishedAt: string | null,
  now: Date,
): string {
  const when = `published ${relativeWhen(publishedAt ?? provenance?.publishedAt ?? null, now)}`;
  if (!provenance || typeof provenance !== "object") {
    return `Unattributed delivery (no CI provenance was published with it) — ${when}.`;
  }
  const parts: string[] = [];
  if (provenance.repo) parts.push(provenance.repo);
  const tail: string[] = [];
  if (provenance.runId) tail.push(`CI run #${provenance.runId}`);
  if (provenance.commit)
    tail.push(`commit ${String(provenance.commit).slice(0, 7)}`);
  if (provenance.ref)
    tail.push(String(provenance.ref).replace(/^refs\/heads\//, "branch "));
  tail.push(when);
  if (parts.length === 0 && tail.length === 1) {
    return `Unattributed delivery (no CI provenance was published with it) — ${when}.`;
  }
  return `${parts.length > 0 ? `${parts.join(" ")} — ` : ""}${tail.join(", ")}.`;
}

/** Read-only script: hand the UI this file's apply log. Runs through the
 *  SAME engine-run path inventoryScriptSource uses; mutates nothing. */
export function applyLogScriptSource(): string {
  return `// ds-contracts plugin: read the file-local apply log (nothing changes).
const raw = figma.root.getSharedPluginData('ds_contracts', ${JSON.stringify(APPLY_LOG_KEY)});
return { applyLog: raw || null };
`;
}

/** Write one entry, newest first, capped — the read-modify-write happens in
 *  the script so the file is the single writer. */
export function recordApplyScriptSource(entry: ApplyLogEntry): string {
  return `// ds-contracts plugin: record this apply in the file-local apply log.
const KEY = ${JSON.stringify(APPLY_LOG_KEY)};
const MAX = ${APPLY_LOG_MAX_ENTRIES};
let log = { version: 1, entries: [] };
try {
  const parsed = JSON.parse(figma.root.getSharedPluginData('ds_contracts', KEY) || 'null');
  if (parsed && Array.isArray(parsed.entries)) log = { version: 1, entries: parsed.entries };
} catch (e) { /* unreadable history is treated as none — never a blocker */ }
log.entries = [${JSON.stringify(entry)}].concat(log.entries).slice(0, MAX);
figma.root.setSharedPluginData('ds_contracts', KEY, JSON.stringify(log));
return { applyLogEntries: log.entries.length, seq: ${JSON.stringify(entry.seq)} };
`;
}

export function createPluginEngine(data: PluginEngineData) {
  const icons = new Map(Object.entries(data.icons));
  const engine = createFigmaEngine({ tokens: data.tokens, icons });
  const corpus = tokenCorpusFromJson({
    primitives: data.tokens.primitives,
    semantic: data.tokens.semantic,
    light: data.tokens.light,
    brandDefault: data.tokens.brands.default ?? {},
  });

  /** The baked reference scope (repo contracts), schema-parsed once. */
  const bakedById = new Map<string, Contract>();
  for (const raw of data.contracts) {
    const parsed = ContractSchema.safeParse(raw);
    if (parsed.success) bakedById.set(parsed.data.id, parsed.data);
  }

  // -------------------------------------------------------------------------
  // Parsing + validation (plain words)
  // -------------------------------------------------------------------------

  function parseIncomingText(text: string): ParsedIncoming {
    if (!text.trim()) {
      return {
        ok: false,
        issue: plain(
          "Nothing to read — paste a contract or bundle JSON first.",
        ),
      };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return {
        ok: false,
        issue: plain(
          "That paste isn't valid JSON — a missing quote, comma, or bracket is the usual cause.",
          errText(e),
        ),
      };
    }
    return parseIncomingValue(raw);
  }

  function parseIncomingValue(raw: unknown): ParsedIncoming {
    if (
      raw &&
      typeof raw === "object" &&
      (raw as { type?: unknown }).type === "CONTRACTS-BUNDLE"
    ) {
      const contracts = (raw as { contracts?: unknown }).contracts;
      if (!Array.isArray(contracts) || contracts.length === 0) {
        return {
          ok: false,
          issue: plain(
            'That is tagged CONTRACTS-BUNDLE but has no contracts — it needs a non-empty "contracts" array (ds-contracts figma push builds one).',
          ),
        };
      }
      // Optional foreign token set: contracts + tokens in ONE JSON paste —
      // the whole point is that JSON is the only thing a user ever pastes.
      const rawTokenSet = (raw as { tokenSet?: unknown }).tokenSet;
      let tokenSet: TokenSetPayload | null = null;
      if (rawTokenSet !== undefined && rawTokenSet !== null) {
        const parsedSet = parseTokenSet(rawTokenSet);
        if (!parsedSet.ok) {
          return {
            ok: false,
            issue: plain(
              `This bundle's token set does not parse — ${parsedSet.error}`,
            ),
          };
        }
        tokenSet = parsedSet.tokenSet;
      }
      // Optional bundle-carried icon assets (MOLECULE round — Autocomplete's
      // floor-reconstructed indicator/chip-delete SVGs): {name: svgMarkup},
      // the same map the CLI's --icons dir provides. Without it, a contract
      // referencing icon assets keeps the emitter's own named refusal.
      const rawIcons = (raw as { icons?: unknown }).icons;
      let icons: Record<string, string> | null = null;
      if (rawIcons !== undefined && rawIcons !== null) {
        if (typeof rawIcons !== "object" || Array.isArray(rawIcons)) {
          return {
            ok: false,
            issue: plain(
              'This bundle\'s "icons" section must be an object of {name: "<svg…>"} entries.',
            ),
          };
        }
        const bad = Object.entries(rawIcons as Record<string, unknown>).find(
          ([, v]) => typeof v !== "string",
        );
        if (bad) {
          return {
            ok: false,
            issue: plain(
              `This bundle's "icons" entry "${bad[0]}" is not SVG text — every value must be a string.`,
            ),
          };
        }
        icons = rawIcons as Record<string, string>;
      }
      return { ok: true, kind: "bundle", contracts, tokenSet, icons };
    }
    if (
      raw &&
      typeof raw === "object" &&
      typeof (raw as { id?: unknown }).id === "string"
    ) {
      return {
        ok: true,
        kind: "contract",
        contracts: [raw],
        tokenSet: null,
        icons: null,
      };
    }
    return {
      ok: false,
      issue: plain(
        'That JSON is neither a contract document (no "id") nor a CONTRACTS-BUNDLE envelope.',
      ),
    };
  }

  /** Schema referee, zod issues in words ("path: message" lines). */
  function validateOne(
    raw: unknown,
    label: string,
  ): { ok: true; contract: Contract } | { ok: false; issues: PlainIssue[] } {
    try {
      assertContractProvenance(raw as Record<string, unknown>, label);
    } catch (e) {
      return { ok: false, issues: [plain(errText(e))] };
    }
    const parsed = ContractSchema.safeParse(raw);
    if (parsed.success) return { ok: true, contract: parsed.data };
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) =>
        plain(
          `${label} — ${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`,
        ),
      );
    if (parsed.error.issues.length > 8) {
      issues.push(
        plain(
          `${label} — …and ${parsed.error.issues.length - 8} more schema issue(s).`,
        ),
      );
    }
    return { ok: false, issues };
  }

  const labelOf = (raw: unknown, index: number): string => {
    if (raw && typeof raw === "object") {
      const id = (raw as { id?: unknown }).id;
      if (typeof id === "string" && id) return id;
      const name = (raw as { name?: unknown }).name;
      if (typeof name === "string" && name) return name;
    }
    return `contract ${index + 1}`;
  };

  // -------------------------------------------------------------------------
  // Scope + ordering
  // -------------------------------------------------------------------------

  /** Incoming contracts + every baked contract they transitively reference,
   *  dependency-ordered (deps first). Throws with the sorter's own named
   *  message on unknown refs / cycles. */
  function orderedClosure(incoming: Contract[]): Contract[] {
    const byId = new Map<string, Contract>(bakedById);
    for (const c of incoming) byId.set(c.id, c); // incoming wins on id
    const wanted = new Map<string, Contract>();
    const pull = (c: Contract) => {
      if (wanted.has(c.id)) return;
      wanted.set(c.id, c);
      for (const { ref } of componentRefsOf(c)) {
        const dep = byId.get(ref.id);
        if (dep) pull(dep);
      }
      for (const { slot } of slotsOf(c)) {
        for (const id of slot.accepts ?? []) {
          const dep = byId.get(id);
          if (dep) pull(dep);
        }
      }
    };
    for (const c of incoming) pull(c);
    return sortByDependencies([...wanted.values()]);
  }

  function scopeFor(incoming: Contract[]): Map<string, Contract> {
    const byId = new Map<string, Contract>(bakedById);
    for (const c of incoming) byId.set(c.id, c);
    return byId;
  }

  // -------------------------------------------------------------------------
  // specHash mirror — djb2 over the compiled ComponentData, byte-for-byte
  // what the emitted runtime stores as ds_contracts/specHash. The headless
  // harness EXECUTES an emitted script and asserts this mirror equals the
  // stored marker, so drift between the two fails a pinned eval by name.
  // -------------------------------------------------------------------------

  function specHashOf(
    contract: Contract,
    byId: Map<string, Contract>,
    eng: typeof engine = engine,
  ): string {
    const compiled = eng.compileComponentData(contract, byId);
    // The emitted runtime salts its stored hash with RUNTIME_EMIT_REV (so a
    // runtime-template-only fix still forces amend); the mirror must salt
    // identically — the wave introduced the salt in the runtime only, and
    // stored-vs-mirror equality failed by construction once reachable.
    const s = JSON.stringify(compiled) + "|" + RUNTIME_EMIT_REV;
    let h = 5381;
    for (let i = 0; i < s.length; i++)
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return String(h);
  }

  /** Engine over a bundle's foreign tokenSet — the SAME construction the CLI
   *  applies for `figma <contracts> --tokens base,minted`, so the plugin's
   *  bundle path and the script path compile IDENTICAL component data. The
   *  token inventory is base + minted and NOTHING else — a contract ref
   *  outside both keeps the emitter's own named "Cannot resolve token"
   *  refusal. MOLECULE round: bundle-carried icon assets merge OVER the
   *  baked repo icons (`figma bundle --icons` embeds them — Autocomplete's
   *  floor-reconstructed SVGs); a missing asset keeps the emitter's named
   *  "needs icon asset" refusal. */
  const mergedIcons = (
    bundleIcons: Record<string, string> | null | undefined,
  ): Map<string, string> =>
    bundleIcons ? new Map([...icons, ...Object.entries(bundleIcons)]) : icons;
  const foreignEngineFor = (
    tokenSet: TokenSetPayload,
    bundleIcons?: Record<string, string> | null,
  ): typeof engine =>
    createFigmaEngine({
      tokens: tokenSetTokenTrees(tokenSet),
      icons: mergedIcons(bundleIcons),
    });

  // -------------------------------------------------------------------------
  // Generate from contract
  // -------------------------------------------------------------------------

  interface PlanOptions {
    /** Sync the token collections first (fresh files need it; re-running is
     *  an upsert). Default true. */
    withTokens?: boolean;
    /** The CURRENT file's key — overrides each script's WRONG FILE guard so
     *  the set lands where the designer is looking. '' disables the guard
     *  (unshared drafts have no key). */
    fileKey?: string | null;
    /** The bundle's foreign token set (parseIncoming* surfaces it). When
     *  present, the tokens step syncs THAT set as its own named collection
     *  and the bundle's contracts resolve against base + minted instead of
     *  the baked repo tokens. */
    tokenSet?: TokenSetPayload | null;
    /** Bundle-carried icon assets (parseIncoming* surfaces them) — merged
     *  over the baked repo icons for the incoming contracts' compile. */
    icons?: Record<string, string> | null;
  }

  function planGenerate(
    rawContracts: unknown[],
    opts: PlanOptions = {},
  ):
    | { ok: true; steps: GenerateStep[]; notes: string[] }
    | { ok: false; issues: PlainIssue[] } {
    const issues: PlainIssue[] = [];
    const incoming: Contract[] = [];
    const seen = new Set<string>();
    rawContracts.forEach((raw, i) => {
      const v = validateOne(raw, labelOf(raw, i));
      if (!v.ok) {
        issues.push(...v.issues);
        return;
      }
      if (seen.has(v.contract.id)) {
        issues.push(
          plain(
            `This bundle carries "${v.contract.id}" twice — each contract id must appear once.`,
          ),
        );
        return;
      }
      seen.add(v.contract.id);
      incoming.push(v.contract);
    });
    if (issues.length > 0) return { ok: false, issues };

    let ordered: Contract[];
    try {
      ordered = orderedClosure(incoming);
    } catch (e) {
      return {
        ok: false,
        issues: [plainFromThrow("Could not order the contracts", e)],
      };
    }
    const byId = scopeFor(incoming);
    const fileKey = opts.fileKey ?? "";
    const notes: string[] = [];
    const incomingIds = new Set(incoming.map((c) => c.id));
    const deps = ordered.filter((c) => !incomingIds.has(c.id));
    if (deps.length > 0) {
      notes.push(
        `Also syncing ${deps.length} referenced component(s) first: ${deps.map((c) => c.name).join(", ")}.`,
      );
    }

    // Foreign token set (bundle-carried): its contracts compile against
    // base + minted through an engine built EXACTLY the way the CLI builds
    // one for `--tokens base,minted`; baked repo dependencies keep the
    // baked engine (they were written against the repo tokens).
    const tokenSet = opts.tokenSet ?? null;
    const bundleIcons = opts.icons ?? null;
    const foreign = tokenSet
      ? foreignEngineFor(tokenSet, bundleIcons)
      : bundleIcons
        ? createFigmaEngine({
            tokens: data.tokens,
            icons: mergedIcons(bundleIcons),
          })
        : null;

    const steps: GenerateStep[] = [];
    if (opts.withTokens !== false) {
      if (tokenSet) {
        steps.push({
          kind: "tokens",
          title: `Token variables — "${tokenSet.name}" collection from the bundle's token set (upserted; prune is opt-in via DS_PRUNE_TOKENS and leftovers are named)`,
          code: emitTokenSetScript(tokenSet, fileKey || null),
        });
      }
      if (!tokenSet || deps.length > 0) {
        // The repo collections: always for a repo paste; for a foreign
        // bundle only when baked dependencies ride along (they bind these).
        steps.push({
          kind: "tokens",
          title: "Token variables (collections upserted; prune is opt-in via DS_PRUNE_TOKENS and leftovers are named)",
          code: engine.buildTokensScript(fileKey || null),
        });
      }
    }
    for (const contract of ordered) {
      const eng = foreign && incomingIds.has(contract.id) ? foreign : engine;
      let code: string;
      try {
        code = eng.buildComponentScript(contract, byId, fileKey);
      } catch (e) {
        // The emitter's referee refusal (named violations) or an
        // unresolvable token — both are the engine's own words.
        return {
          ok: false,
          issues: [plainFromThrow(`${contract.name} refused`, e)],
        };
      }
      steps.push({
        kind: "component",
        title: `${contract.name} (${contract.id} v${contract.version})`,
        contractId: contract.id,
        code,
      });
      steps.push({
        kind: "version-marker",
        title: `${contract.name}: record version ${contract.version}`,
        contractId: contract.id,
        code: versionMarkerScript(contract.id, contract.version),
      });
    }
    return { ok: true, steps, notes };
  }

  /** Post-sync marker: the emitted runtime stores contractId + specHash;
   *  the plugin adds the VERSION so the next Update-library report can say
   *  "1.4.0 → 1.5.0" instead of "(installed version not recorded)".
   *
   *  STILL OPEN (G1 round, measured and deliberately NOT taken): the SCRIPT
   *  path — a committed `*.figma.js` run through the paste box or the local
   *  runner — never stamps `ds_contracts/version`, so a library synced that
   *  way reports "(installed version not recorded)" forever and G8's
   *  per-channel style diff (which needs the installed version to match a
   *  baked contract) silently degrades to summary level.
   *
   *  Why it was not fixed here: `ComponentData` (core/emit-figma-script.ts)
   *  carries no version field, and `specHash` is a djb2 over
   *  `JSON.stringify(ComponentData)` — adding one would change the hash of
   *  EVERY contract, so every generated set in every file would report as
   *  changed on the next check. Threading a separate `CONTRACT_VERSIONS`
   *  constant through `buildSyncScript` avoids that but rewrites every
   *  committed `*.figma.js` (~100 files across figma-sync/ and examples/)
   *  plus the golden manifest. That is a reviewable blast radius of its
   *  own, not a rider on a channel round. */
  function versionMarkerScript(contractId: string, version: string): string {
    return `// ds-contracts plugin: record installed contract version (read-mostly follow-up).
await figma.loadAllPagesAsync();
let target = null;
for (const page of figma.root.children) {
  target = page.findOne((n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
    n.getSharedPluginData('ds_contracts', 'contractId') === ${JSON.stringify(contractId)});
  if (target) break;
}
if (target) target.setSharedPluginData('ds_contracts', 'version', ${JSON.stringify(version)});
return { marker: 'version', contractId: ${JSON.stringify(contractId)}, version: ${JSON.stringify(version)}, found: !!target };
`;
  }

  // -------------------------------------------------------------------------
  // Update library — inventory + plain-words change report BEFORE applying
  // -------------------------------------------------------------------------

  /** Read-only scan for our identity markers — runs through the same
   *  run-script path, mutates nothing. G2: the scan also RECOMPUTES each
   *  set's canvas fingerprint (the same dsCanvasFingerprint the Drift tab
   *  runs) against the stamp genesis wrote, so the update check knows which
   *  targets carry un-proposed canvas edits BEFORE anything applies.
   *
   *  BROWNFIELD (`includeUnmarked`): the walk below has ALWAYS visited every
   *  local set — the marker test was a `continue`, which is why a hand-built
   *  library inventoried as `[]` and the panel said "nothing here is
   *  contract-backed yet" to a file with 300 sets. With the flag on, the
   *  unmarked sets are KEPT (contractBacked:false) instead of dropped, and
   *  every row carries its variant axes and property kinds — the same facts
   *  extract/figma-dump.js reads, from the walk that was already running.
   *  Default OFF: every existing caller (the update check, the Send tab's
   *  base pre-fill) keeps exactly today's marked-only rows. */
  function inventoryScriptSource(
    opts: { includeUnmarked?: boolean } = {},
  ): string {
    const skipUnmarked = opts.includeUnmarked
      ? "    const contractBacked = !!(contractId || specHash);"
      : "    if (!contractId && !specHash) continue;\n    const contractBacked = true;";
    return `// ds-contracts plugin: read-only marker inventory (nothing changes).
${FINGERPRINT_SRC}
await figma.loadAllPagesAsync();
// v6 REQUIRES THIS, AND ITS ABSENCE WAS A FALSE ALARM, NOT A MISSING FEATURE.
// The v6 snapshot spells bindings by NAME (\`|bound:paddingLeft|space/inset-x/sm\`)
// via an id→name map that only an ASYNC Figma API can fill, so every path that
// COMPUTES a fingerprint must preload it — not merely the paths that STAMP one.
// This path recomputes to compare against the stamp. Without the preload every
// bound field resolved to \`(unresolved)\`, the recompute could never equal the
// stamp, and the verdict below read 'canvas-edited' for every stamped set on an
// UNTOUCHED file — telling a designer that applying would overwrite edits that
// do not exist. Caught by plugin:check's update-report pin, which read
// "1 set has un-proposed canvas edits" where it expected
// "1 to update · 1 new · 0 unchanged."
await dsLoadVarNames();
const rows = [];
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue;
    const contractId = node.getSharedPluginData('ds_contracts', 'contractId');
    const specHash = node.getSharedPluginData('ds_contracts', 'specHash');
${skipUnmarked}
    let props = [];
    const variantAxes = {};
    const propKinds = { variant: 0, boolean: 0, text: 0, swap: 0 };
    try {
      const defs = node.componentPropertyDefinitions || {};
      props = Object.keys(defs).map((k) => k.split('#')[0]);
      for (const rawName of Object.keys(defs)) {
        const def = defs[rawName];
        const plainName = rawName.split('#')[0];
        if (def.type === 'VARIANT') { variantAxes[plainName] = def.variantOptions || []; propKinds.variant++; }
        else if (def.type === 'BOOLEAN') propKinds.boolean++;
        else if (def.type === 'TEXT') propKinds.text++;
        else if (def.type === 'INSTANCE_SWAP') propKinds.swap++;
      }
    } catch (e) { /* non-set components can throw — the row still counts */ }
    let drift = null;
    try {
      const stored = node.getSharedPluginData('ds_contracts', 'canvasFingerprint');
      if (stored) {
        // VERSION HONESTY (v4→v5 prototype wiring, v5→v6 resolved bindings): a stamp from an
        // older scheme is not comparable — reporting 'canvas-edited' would
        // be a false alarm on an untouched file. 'version-changed' names it.
        drift = stored.indexOf('v6:') !== 0 ? (/^v\\d+:/.test(stored) ? 'version-changed' : 'unstamped')
          : stored === dsCanvasFingerprint(node) ? 'in-sync' : 'canvas-edited';
      }
    } catch (e) { /* recompute threw — no drift verdict, never a blocker */ }
    rows.push({
      contractId: contractId || null,
      name: node.name,
      nodeId: node.id,
      key: node.key || null,
      type: node.type,
      specHash: specHash || null,
      version: node.getSharedPluginData('ds_contracts', 'version') || null,
      variants: node.type === 'COMPONENT_SET' ? node.children.length : 1,
      props: props,
      drift: drift,
      contractBacked: contractBacked,
      page: page.name,
      variantAxes: variantAxes,
      propKinds: propKinds,
    });
  }
}
return { inventory: rows };
`;
  }

  /** BROWNFIELD — "scan this file": the SAME read-only walk, unfiltered.
   *  This is the caller extract/figma-dump.js never had inside the plugin. */
  function scanScriptSource(): string {
    return inventoryScriptSource({ includeUnmarked: true });
  }

  /** Plain-words summary of a full scan — what the file HAS, including the
   *  part this tool did not make. Pure: the UI renders it, the check pins it. */
  function scanReport(rows: InventoryRow[]): {
    total: number;
    backed: number;
    foreign: number;
    headline: string;
    lines: string[];
    rows: InventoryRow[];
  } {
    const total = rows.length;
    const backed = rows.filter((r) => r.contractBacked).length;
    const foreign = total - backed;
    const axisCount = (r: InventoryRow) =>
      Object.keys(r.variantAxes ?? {}).length;
    const headline =
      total === 0
        ? "No component sets in this file."
        : foreign === 0
          ? `${total} component set${total === 1 ? "" : "s"} — all contract-backed.`
          : backed === 0
            ? `${total} component set${total === 1 ? "" : "s"} — none contract-backed yet.`
            : `${total} component set${total === 1 ? "" : "s"} — ${backed} contract-backed, ${foreign} not yet.`;
    const lines = rows
      .slice()
      .sort(
        (a, b) =>
          (a.page ?? "").localeCompare(b.page ?? "") ||
          a.name.localeCompare(b.name),
      )
      .map((r) => {
        const axes = Object.entries(r.variantAxes ?? {})
          .map(([name, options]) => `${name} (${options.length})`)
          .join(", ");
        const kinds = r.propKinds ?? {
          variant: 0,
          boolean: 0,
          text: 0,
          swap: 0,
        };
        const bits = [
          `${r.variants} variant${r.variants === 1 ? "" : "s"}`,
          axes ? `axes: ${axes}` : "no variant axes",
          `${kinds.boolean} boolean · ${kinds.text} text · ${kinds.swap} swap`,
        ];
        return `${r.name} — ${r.contractBacked ? `contract-backed (${r.contractId ?? "no id"})` : "not under contract"} · ${bits.join(" · ")} · ${r.page ?? "unknown page"}`;
      });
    return { total, backed, foreign, headline, lines, rows };
  }

  /** The downloadable/copyable scan artifact — the same rows, as JSON. */
  function scanExportJson(
    rows: InventoryRow[],
    fileKey: string | null = null,
  ): string {
    const s = scanReport(rows);
    return JSON.stringify(
      {
        type: "FIGMA-FILE-SCAN",
        version: 1,
        fileKey: fileKey || null,
        totals: {
          sets: s.total,
          contractBacked: s.backed,
          notUnderContract: s.foreign,
        },
        sets: s.rows.map((r) => ({
          name: r.name,
          page: r.page ?? null,
          nodeId: r.nodeId,
          key: r.key,
          type: r.type,
          contractBacked: !!r.contractBacked,
          contractId: r.contractId,
          version: r.version,
          variants: r.variants,
          variantAxes: r.variantAxes ?? {},
          propKinds: r.propKinds ?? {
            variant: 0,
            boolean: 0,
            text: 0,
            swap: 0,
          },
          props: r.props,
        })),
      },
      null,
      2,
    );
  }

  /** Expected property-name surface of a compiled contract (variant axes,
   *  boolean/text props, slot swap + visibility props) — the API the file's
   *  componentPropertyDefinitions should carry after a sync. */
  function expectedProps(
    contract: Contract,
    byId: Map<string, Contract>,
    eng: typeof engine = engine,
  ): string[] {
    const compiled = eng.compileComponentData(contract, byId);
    const names = new Set<string>();
    for (const bp of compiled.boolProps) names.add(bp.property);
    for (const tp of compiled.textProps) names.add(tp.property);
    const collect = (
      spec: import("../../../core/emit-figma-script.js").NodeSpec,
    ) => {
      if (spec.contentProp) names.add(spec.contentProp);
      if (spec.slotProperty) {
        names.add(spec.slotProperty);
        if (spec.slotOptional) names.add(`Show ${spec.slotProperty}`);
      }
      for (const child of spec.children ?? []) collect(child);
    };
    for (const v of compiled.variants) collect(v.spec);
    for (const v of compiled.stateVariants ?? []) collect(v.spec);
    // Variant axes ride the variant names ("Size=sm, Tone=critical") — the
    // State preview axis included (stateVariants carry ", State=…").
    for (const v of [...compiled.variants, ...(compiled.stateVariants ?? [])]) {
      for (const seg of v.name.split(",")) {
        const axis = seg.split("=")[0]?.trim();
        if (axis) names.add(axis);
      }
    }
    return [...names];
  }

  // -------------------------------------------------------------------------
  // G8 — plain-words style diffs. Flatten a compiled spec into
  // `variant>path|channel|value` lines (designer channel words, variable
  // names, hex literals), then pair-diff two flattenings the same way the
  // Drift tab pairs canvas snapshots. Pure compute over data already in hand
  // at plan time.
  // -------------------------------------------------------------------------

  type SpecNode = import("../../../core/emit-figma-script.js").NodeSpec;
  type CompiledData = ReturnType<typeof engine.compileComponentData>;

  /** Plugin-API binding fields → the designer's words. */
  const FIELD_WORDS: Record<string, string> = {
    paddingLeft: "padding left",
    paddingRight: "padding right",
    paddingTop: "padding top",
    paddingBottom: "padding bottom",
    itemSpacing: "gap",
    strokeWeight: "border width",
    strokeTopWeight: "border width (top)",
    strokeRightWeight: "border width (right)",
    strokeBottomWeight: "border width (bottom)",
    strokeLeftWeight: "border width (left)",
    cornerRadius: "radius",
    topLeftRadius: "radius (top left)",
    topRightRadius: "radius (top right)",
    bottomLeftRadius: "radius (bottom left)",
    bottomRightRadius: "radius (bottom right)",
    minWidth: "min width",
    minHeight: "min height",
    maxWidth: "max width",
    maxHeight: "max height",
    width: "width",
    height: "height",
    radius: "radius",
  };
  const fieldWord = (field: string): string => FIELD_WORDS[field] ?? field;

  const hexOfRgba = (c: {
    r: number;
    g: number;
    b: number;
    a?: number;
  }): string => {
    const h = (x: number) =>
      Math.round((x || 0) * 255)
        .toString(16)
        .padStart(2, "0");
    const alpha = c.a !== undefined && c.a < 1 ? h(c.a) : "";
    return `#${h(c.r)}${h(c.g)}${h(c.b)}${alpha}`;
  };
  const djb2 = (s: string): string => {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return String(h);
  };
  /** Names ride inside `variant>path|channel|value` lines — keep the
   *  separators out of them. */
  const cleanSeg = (s: string): string => s.replace(/[|>]/g, "/");

  function specStyleLines(compiled: CompiledData): string[] {
    const lines: string[] = [];
    const push = (id: string, channel: string, value: unknown) => {
      if (value === undefined || value === null || value === "") return;
      lines.push(`${id}|${channel}|${String(value)}`);
    };
    const walk = (spec: SpecNode, id: string) => {
      if (spec.fill) push(id, "fill", spec.fill);
      if (spec.lits?.fillClear) push(id, "fill", "transparent");
      if (spec.lits?.fillColor)
        push(id, "fill", hexOfRgba(spec.lits.fillColor));
      if (spec.stroke) push(id, "stroke", spec.stroke);
      if (spec.layout) {
        push(
          id,
          "layout",
          `${spec.layout.mode === "HORIZONTAL" ? "row" : "column"} ${spec.layout.primary}/${spec.layout.counter}${spec.layout.wrap ? " wrap" : ""}`,
        );
      }
      for (const [field, varName] of Object.entries(spec.bindings ?? {}))
        push(id, fieldWord(field), varName);
      for (const [key, value] of Object.entries(spec.lits ?? {})) {
        if (typeof value === "number") push(id, fieldWord(key), value);
      }
      if (spec.lits?.radiusCorners)
        push(id, "radius", JSON.stringify(spec.lits.radiusCorners));
      if (spec.lits?.strokeSides)
        push(id, "border widths", JSON.stringify(spec.lits.strokeSides));
      if (spec.characters !== undefined)
        push(id, "text", `"${spec.characters}"`);
      if (spec.fontSize !== undefined) push(id, "text size", spec.fontSize);
      if (spec.fontStyle) push(id, "text weight", spec.fontStyle);
      if (spec.textStyle) push(id, "text style", spec.textStyle);
      if (spec.fontFamily) push(id, "font", spec.fontFamily);
      if (spec.textFill) push(id, "text color", spec.textFill);
      if (spec.lineHeight !== undefined)
        push(id, "line height", spec.lineHeight);
      if (spec.opacity !== undefined) push(id, "opacity", spec.opacity);
      if (spec.fixedWidth)
        push(
          id,
          "width",
          `${spec.fixedWidth.px}px (${spec.fixedWidth.varName})`,
        );
      if (spec.fixedHeight) {
        push(
          id,
          "height",
          `${spec.fixedHeight.px}px${spec.fixedHeight.varName ? ` (${spec.fixedHeight.varName})` : ""}`,
        );
      }
      if (spec.dropShadow) push(id, "shadow", JSON.stringify(spec.dropShadow));
      if (spec.effectStack)
        push(
          id,
          "shadow",
          `${spec.effectStack.length} layer(s) · ${djb2(JSON.stringify(spec.effectStack))}`,
        );
      if (spec.gradient) push(id, "gradient", JSON.stringify(spec.gradient));
      if (spec.svg) push(id, "icon", `svg·${djb2(spec.svg)}`);
      if (spec.visibleProp)
        push(
          id,
          "shown when",
          `${spec.visibleProp}${spec.visibleDefault === false ? " (off by default)" : ""}`,
        );
      for (const child of spec.children ?? [])
        walk(child, `${id}/${cleanSeg(child.name)}`);
    };
    for (const v of [...compiled.variants, ...(compiled.stateVariants ?? [])]) {
      walk(v.spec, `${cleanSeg(v.name)}>${cleanSeg(v.spec.name)}`);
    }
    const setId = `set>${cleanSeg(compiled.setName)}`;
    push(
      setId,
      "description",
      compiled.description.replace(/\s+/g, " ").slice(0, 120),
    );
    for (const bp of compiled.boolProps)
      push(setId, `${bp.property} default`, String(bp.default));
    for (const tp of compiled.textProps)
      push(setId, `${tp.property} default`, `"${tp.default}"`);
    return lines;
  }

  /** Pair-diff two flattenings (the Drift tab's prefix-pairing rule), then
   *  aggregate identical changes across variants. */
  function styleDiffOf(
    beforeLines: string[],
    afterLines: string[],
    variantCount: number,
  ): StyleChange[] {
    const cut = (l: string): [string, string] => {
      const i = l.indexOf("|");
      const j = l.indexOf("|", i + 1);
      return j > 0 ? [l.slice(0, j), l.slice(j + 1)] : [l, ""];
    };
    const inA = new Set(beforeLines);
    const inB = new Set(afterLines);
    const removed = beforeLines.filter((l) => !inB.has(l));
    const added = afterLines.filter((l) => !inA.has(l));
    const remByPrefix = new Map<string, string[]>();
    for (const l of removed) {
      const [p] = cut(l);
      const arr = remByPrefix.get(p) ?? [];
      arr.push(l);
      remByPrefix.set(p, arr);
    }
    const used = new Set<string>();
    const raw: Array<{ prefix: string; was: string; now: string }> = [];
    for (const l of added) {
      const [p, v] = cut(l);
      const candidates = (remByPrefix.get(p) ?? []).filter((r) => !used.has(r));
      if (candidates.length === 1) {
        used.add(candidates[0]);
        raw.push({ prefix: p, was: cut(candidates[0])[1], now: v });
      } else {
        raw.push({ prefix: p, was: "(absent)", now: v });
      }
    }
    for (const l of removed) {
      if (used.has(l)) continue;
      const [p, v] = cut(l);
      raw.push({ prefix: p, was: v, now: "(removed)" });
    }
    const agg = new Map<string, { change: StyleChange; vnames: string[] }>();
    for (const r of raw) {
      const gt = r.prefix.indexOf(">");
      const variant = gt >= 0 ? r.prefix.slice(0, gt) : "";
      const rest = gt >= 0 ? r.prefix.slice(gt + 1) : r.prefix;
      const bar = rest.lastIndexOf("|");
      const pathPart = bar >= 0 ? rest.slice(0, bar) : rest;
      const channel = bar >= 0 ? rest.slice(bar + 1) : "";
      const part = pathPart.split("/").pop() ?? pathPart;
      const key = `${pathPart}|${channel}|${r.was}|${r.now}`;
      const entry = agg.get(key);
      if (entry) {
        if (!entry.vnames.includes(variant)) entry.vnames.push(variant);
      } else {
        agg.set(key, {
          change: { part, channel, was: r.was, now: r.now, variants: null },
          vnames: [variant],
        });
      }
    }
    return [...agg.values()].map(({ change, vnames }) => ({
      ...change,
      variants:
        vnames.length >= variantCount ||
        (vnames.length === 1 && vnames[0] === "set")
          ? null
          : vnames,
    }));
  }

  function updatePlan(
    rawContracts: unknown[],
    inventory: InventoryRow[],
    tokenSet: TokenSetPayload | null = null,
    bundleIcons: Record<string, string> | null = null,
    /** G1/S2 FRESHNESS GUARD. Non-null only for a channel delivery that is
     *  not newer than what this file already applied from that channel. A
     *  pairing-code receive or a paste passes null and keeps EXACTLY today's
     *  behaviour — they carry no ordering, so there is nothing honest to
     *  compare and inventing a warning would be worse than none. */
    freshness: ChannelFreshness | null = null,
  ): UpdatePlan {
    // A bundle-carried foreign token set (and any bundle-carried icons):
    // every incoming contract compiles against base + minted (the same
    // engine choice planGenerate makes).
    const foreign = tokenSet
      ? foreignEngineFor(tokenSet, bundleIcons)
      : bundleIcons
        ? createFigmaEngine({
            tokens: data.tokens,
            icons: mergedIcons(bundleIcons),
          })
        : null;
    const eng = foreign ?? engine;
    const rows: UpdateRow[] = [];
    const incoming: Contract[] = [];
    const parsedByIndex = new Map<number, Contract>();
    rawContracts.forEach((raw, i) => {
      const v = validateOne(raw, labelOf(raw, i));
      if (v.ok) {
        incoming.push(v.contract);
        parsedByIndex.set(i, v.contract);
      }
    });
    const byId = scopeFor(incoming);

    const seenIds = new Set<string>();
    rawContracts.forEach((raw, i) => {
      const contract = parsedByIndex.get(i);
      if (contract) {
        if (seenIds.has(contract.id)) {
          rows.push({
            contractId: contract.id,
            setName: contract.name,
            version: contract.version,
            action: "refused",
            defaultSelected: false,
            line: `• ${contract.name}: refused — this bundle carries "${contract.id}" twice; each contract id must appear once.`,
          });
          return;
        }
        seenIds.add(contract.id);
      }
      if (!contract) {
        const v = validateOne(raw, labelOf(raw, i));
        const first = v.ok ? plain("unknown") : v.issues[0];
        rows.push({
          contractId: labelOf(raw, i),
          setName: labelOf(raw, i),
          version: "",
          action: "refused",
          defaultSelected: false,
          line: `• ${labelOf(raw, i)}: refused — ${first.headline}`,
        });
        return;
      }
      const found =
        inventory.find((r) => r.contractId === contract.id) ??
        inventory.find(
          (r) =>
            r.key !== null &&
            contract.anchors.figma.componentSetKey !== null &&
            r.key === contract.anchors.figma.componentSetKey,
        ) ??
        null;

      let compiledVariants = 0;
      let hash: string | null = null;
      let expected: string[] = [];
      let compiledIncoming: CompiledData | null = null;
      try {
        compiledIncoming = eng.compileComponentData(contract, byId);
        compiledVariants =
          compiledIncoming.variants.length +
          (compiledIncoming.stateVariants?.length ?? 0);
        hash = specHashOf(contract, byId, eng);
        expected = expectedProps(contract, byId, eng);
      } catch (e) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: "refused",
          defaultSelected: false,
          line: `• ${contract.name}: refused — ${plainFromThrow("the contract cannot compile", e).headline}`,
        });
        return;
      }

      if (!found) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: "create",
          defaultSelected: true,
          line: `• ${contract.name} ${contract.version}: new — will be created (${compiledVariants} variant${compiledVariants === 1 ? "" : "s"}).`,
        });
        return;
      }
      if (found.specHash !== null && found.specHash === hash) {
        rows.push({
          contractId: contract.id,
          setName: contract.name,
          version: contract.version,
          action: "skip",
          defaultSelected: false,
          nodeId: found.nodeId,
          line: `• ${contract.name} ${contract.version}: unchanged — will be skipped.`,
        });
        return;
      }
      const from = found.version ?? null;
      const fromText = from
        ? `${from} → `
        : "(installed version not recorded) → ";
      const added = expected.filter((p) => !found.props.includes(p));
      const removed = found.props.filter((p) => !expected.includes(p));
      const segments: string[] = [];
      for (const p of added) segments.push(`+prop ${p}`);
      for (const p of removed)
        segments.push(`prop ${p} left the contract (kept — retire by hand)`);

      // G8: itemize the interior per channel. The installed spec is in hand
      // exactly when the recorded installed version is a baked contract's
      // version (the sets this plugin generated) — then both compiled specs
      // diff per channel; otherwise nothing can be itemized honestly.
      let styleChanges: StyleChange[] | null = null;
      const baked = bakedById.get(contract.id) ?? null;
      if (baked && found.version !== null && baked.version === found.version) {
        try {
          const installed = engine.compileComponentData(
            baked,
            new Map(bakedById),
          );
          styleChanges = styleDiffOf(
            specStyleLines(installed),
            specStyleLines(compiledIncoming),
            Math.max(compiledVariants, 1),
          );
        } catch {
          styleChanges = null;
        }
      }
      if (segments.length === 0) {
        if (styleChanges && styleChanges.length > 0) {
          segments.push(
            `${styleChanges.length} style change${styleChanges.length === 1 ? "" : "s"} inside — listed below`,
          );
        } else if (styleChanges) {
          segments.push(
            "changes inside that this report cannot itemize — apply to see them, or hold this set",
          );
        } else {
          segments.push("style changes inside the component (no prop changes)");
        }
      }

      // G2 (covenant repair): a canvas-edited target gets a NAMED overwrite
      // warning and starts UNCHECKED. Warn and default-safe — never block.
      const canvasEdited = found.drift === "canvas-edited";
      rows.push({
        contractId: contract.id,
        setName: contract.name,
        version: contract.version,
        action: "amend",
        defaultSelected: !canvasEdited,
        canvasEdited,
        warning: canvasEdited
          ? `${contract.name} has un-proposed canvas edits — applying will overwrite them. Review them in the Changes tab (or propose them) first; its box starts unchecked.`
          : undefined,
        styleChanges,
        nodeId: found.nodeId,
        line: `• ${contract.name} ${fromText}${contract.version}: ${segments.join("; ")}.`,
      });
    });

    // G1/S2: a stale channel delivery unchecks EVERY actionable row and says
    // why on each one. Same posture as the canvas-edit warning above — warn
    // and default-safe, never block; a deliberate rollback is still one
    // click per component away.
    if (freshness && freshness.stale) {
      for (const row of rows) {
        if (row.action !== "amend" && row.action !== "create") continue;
        row.defaultSelected = false;
        row.warning = row.warning
          ? `${row.warning} Also: ${freshness.line}`
          : freshness.line;
      }
    }

    const count = (a: UpdateRow["action"]) =>
      rows.filter((r) => r.action === a).length;
    const canvasWarned = rows.filter((r) => r.canvasEdited);
    const lines = [
      ...rows.map((r) => r.line),
      ...(freshness && freshness.stale
        ? [`⚠ Out of order — ${freshness.line}`]
        : []),
      ...(canvasWarned.length > 0
        ? [
            `⚠ ${canvasWarned.length} set${canvasWarned.length === 1 ? " has" : "s have"} un-proposed canvas edits — applying overwrites the edits, so ${canvasWarned.length === 1 ? "its box starts" : "their boxes start"} unchecked.`,
          ]
        : []),
      `${count("amend")} to update · ${count("create")} new · ${count("skip")} unchanged${count("refused") ? ` · ${count("refused")} refused` : ""}.`,
      "Nothing has been applied — review the list, then Apply.",
    ];
    return { rows, lines };
  }

  /** Scripts for the selected rows only (amend/create), dependency-ordered,
   *  tokens first — the Apply step behind the mandatory report+confirm. */
  function updateApplySteps(
    rawContracts: unknown[],
    selectedContractIds: string[],
    opts: PlanOptions = {},
  ): ReturnType<typeof planGenerate> {
    const selected: unknown[] = [];
    for (const raw of rawContracts) {
      const id =
        raw && typeof raw === "object" ? (raw as { id?: unknown }).id : null;
      if (typeof id === "string" && selectedContractIds.includes(id))
        selected.push(raw);
    }
    if (selected.length === 0) {
      return {
        ok: false,
        issues: [
          plain("Nothing selected — tick at least one component to apply."),
        ],
      };
    }
    return planGenerate(selected, opts);
  }

  // -------------------------------------------------------------------------
  // Propose change — dump → proposal → bounded API-level diff vs the base
  // -------------------------------------------------------------------------

  const DIFF_SCOPE_NOTE =
    "Scope: this diff covers the API surface (version, props, slots, variant axes) and names when anatomy/style bytes differ — interior style changes are summarized, not itemized.";

  // ---------------------------------------------------------------------------
  // G3 STALE-BASE GUARD (partial — docs/18 Flow 7 step 4). The Send tab diffs
  // the canvas against WHATEVER base contract is in the box, and a canvas N
  // syncs behind main makes that diff manufacture the engineer's merged
  // changes as the designer's reverts — a silent revert the PR then blames on
  // her. The full three-way merge (G3) is out of scope here; this guard is
  // the freshness HALF: the set's stored sync markers (ds_contracts/
  // contractId + specHash — what this canvas was LAST SYNCED FROM) are
  // compared against the provided base's spec fingerprint. Same posture as
  // G2 and the channel guard: WARN AND NAME, never block.
  // ---------------------------------------------------------------------------

  interface BaseFreshness {
    /** 'stale' = the markers say the canvas was last synced from something
     *  OTHER than the provided base. 'unverifiable' = the set carries no
     *  readable sync fingerprint (or the base does not compile) — named,
     *  never silently promoted to 'match'. 'baseless' = no base to check. */
    verdict: "match" | "stale" | "unverifiable" | "baseless";
    stale: boolean;
    /** The named warning (stale) or the named non-verdict (unverifiable);
     *  null when there is nothing to say. Stale's line ALSO rides
     *  summaryLines so the PR body and every export door carry it. */
    line: string | null;
    baseSpecHash: string | null;
    canvasSpecHash: string | null;
  }

  function baseFreshnessOf(
    baseData: Contract | null,
    markers:
      | {
          contractId?: string | null;
          specHash?: string | null;
          version?: string | null;
        }
      | null
      | undefined,
    tokenSet: TokenSetPayload | null | undefined,
  ): BaseFreshness {
    if (!baseData) {
      return {
        verdict: "baseless",
        stale: false,
        line: null,
        baseSpecHash: null,
        canvasSpecHash: null,
      };
    }
    const canvasSpecHash =
      markers && typeof markers.specHash === "string" && markers.specHash
        ? markers.specHash
        : null;
    const canvasContractId =
      markers && typeof markers.contractId === "string" && markers.contractId
        ? markers.contractId
        : null;
    let baseSpecHash: string | null = null;
    try {
      const eng = tokenSet ? foreignEngineFor(tokenSet) : engine;
      baseSpecHash = specHashOf(baseData, scopeFor([baseData]), eng);
    } catch {
      baseSpecHash = null; // an uncompilable base cannot be fingerprinted — unverifiable, not stale
    }
    if (canvasContractId !== null && canvasContractId !== baseData.id) {
      return {
        verdict: "stale",
        stale: true,
        line: `⚠ Stale base: this set's sync marker records contract "${canvasContractId}" but the base you diffed against is "${baseData.id}" — the proposal may contain reverts. Deliver the current contracts to this file (Build tab) and propose again.`,
        baseSpecHash,
        canvasSpecHash,
      };
    }
    if (canvasSpecHash === null || baseSpecHash === null) {
      return {
        verdict: "unverifiable",
        stale: false,
        line: "Base freshness not verified: this set carries no readable sync fingerprint (or the base does not compile), so the diff cannot confirm the base is what this canvas was last synced from.",
        baseSpecHash,
        canvasSpecHash,
      };
    }
    if (canvasSpecHash === baseSpecHash) {
      return {
        verdict: "match",
        stale: false,
        line: null,
        baseSpecHash,
        canvasSpecHash,
      };
    }
    const versionDetail =
      markers?.version && markers.version !== baseData.version
        ? ` (this canvas last synced v${markers.version}; the base you provided is v${baseData.version})`
        : "";
    return {
      verdict: "stale",
      stale: true,
      line: `⚠ Stale base: this canvas was last synced from a different contract version than the base you diffed against${versionDetail} — the proposal may contain reverts. Deliver the current contract to this file (Build tab, or your team's channel) and propose again; every "-prop"/default line below could be someone else's merged change coming back out.`,
      baseSpecHash,
      canvasSpecHash,
    };
  }

  const BASELESS_SCOPE_NOTE =
    "Scope: this is a proposal READ FROM THE CANVAS, not a diff — there is no base contract to compare against, so nothing here is called a change. Review it, then adopt it into your repo as the contract for this set.";

  interface ProposeDiffResult {
    ok: true;
    setName: string;
    proposal: Record<string, unknown>;
    summaryLines: string[];
    /** The downloadable artifact: base id/version, proposal, summary. */
    exportJson: string;
    proposalNotes: string[];
    /** BROWNFIELD: true when no base contract was supplied. The proposal
     *  stands alone; `summaryLines` describes it instead of diffing it. */
    baseless: boolean;
    /** Which token corpus the nearest-token suggestions came from — a
     *  brownfield file suggesting THIS repo's tokens would be a confidently
     *  wrong answer, so the answer names its source. */
    tokenSource: string;
    /** Canvas values that bound to no token, with the corpus's nearest
     *  candidates. Reported, never applied. */
    unbound: Array<{
      nodePath: string;
      property: string;
      value: string | number;
      suggestions: string[];
    }>;
    /** ENVELOPE v2 (the export-envelope round): auto-proposed STUB contracts
     *  for nested instances with no contract in scope. The engine has always
     *  produced these; the export doors used to DROP them — which made the
     *  engine's own "auto-proposed alongside (childStubs…)" note a false
     *  receipt on every surface. Absent when the proposal needed none. */
    childStubs?: Array<Record<string, unknown>>;
    /** ENVELOPE v2: the provisional DTCG tree the proposal's minted refs
     *  resolve through (mintUnbound is always on here), plus one entry per
     *  minted leaf. Absent when nothing was minted. */
    mintedTokens?: {
      tree: Record<string, unknown>;
      count: number;
      entries: unknown[];
    };
    /** THE ASYMMETRY. 'tool-generated' when the set carries a
     *  ds_contracts/contractId marker (this tool drew it, so code comes back
     *  byte for byte); 'hand-built' when it does not (the contract is an
     *  INVERSION and the code is a starting point). 'unrecorded' only when
     *  the caller could not say. Stamped into the export envelope so
     *  `propose-pr` prints the same sentence on the PR. */
    provenance: CanvasProvenance;
    /** What this proposal turns into on the code side — shown in Send
     *  BEFORE anything leaves the canvas. */
    codePlan: CodePlanView;
    /** G3 STALE-BASE GUARD (partial): the base-vs-canvas sync-fingerprint
     *  verdict. When stale, `line` also rides summaryLines (and therefore
     *  the PR body and every export door). */
    baseFreshness: BaseFreshness;
  }

  /** The Send tab's "what code does this produce" answer. Names come from
   *  core/canvas-code-plan.ts, the SAME module propose-pr writes files
   *  from — the panel can never promise a file the CLI does not write. */
  interface CodePlanView {
    target: string;
    targetLabel: string;
    /** Output-root-relative file names the default target would write. */
    paths: string[];
    /** Every other registered emitter a repo can choose instead. */
    altTargets: string[];
    headline: string;
    sentence: string;
  }

  /** The plugin cannot see a repo's ds-contracts.config.json, so it shows
   *  the DEFAULT target and names the alternatives rather than guessing
   *  which one a given repo picked. */
  function codePlanFor(
    contractName: string,
    provenance: CanvasProvenance,
  ): CodePlanView {
    const target = "react";
    return {
      target,
      targetLabel: CODE_TARGET_LABELS[target] ?? target,
      paths: plannedCodePaths(contractName, target),
      // Names only, from the shared label table — importing the emitter
      // registry here would drag three code generators (+76 KB minified)
      // into the plugin zip to print two words.
      altTargets: Object.keys(CODE_TARGET_LABELS).filter(
        (n) => n !== target && n !== "figma-script",
      ),
      headline: provenanceHeadline(provenance),
      sentence: provenanceSentence(provenance),
    };
  }

  /** The corpus nearest-token suggestions resolve against. A bundle-carried
   *  foreign token set REPLACES the baked repo tokens here — the same choice
   *  planGenerate/updatePlan make for compiling, applied to proposing. The
   *  user's tree lands in the semantic slot (the playground's adapter shape:
   *  one modeless tree, suggestions ordered semantic-first). */
  function proposalCorpus(tokenSet: TokenSetPayload | null | undefined): {
    corpus: TokenCorpus;
    label: string;
  } {
    if (!tokenSet)
      return { corpus, label: "the tokens baked into this plugin build" };
    const trees = tokenSetTokenTrees(tokenSet);
    return {
      corpus: tokenCorpusFromJson({
        primitives: {},
        semantic: trees.primitives,
        light: {},
        brandDefault: {},
      }),
      label: `your token set "${tokenSet.name}" (from the bundle you pasted)`,
    };
  }

  function proposeDiff(
    dump: Record<string, unknown>,
    setName: string,
    /** null/undefined = BASE-LESS: propose from the canvas anyway. A value
     *  that is present but does not parse is still a named refusal. */
    baseRaw: unknown,
    opts: {
      tokenSet?: TokenSetPayload | null;
      /** From the file's marker inventory: did THIS tool draw the set?
       *  Omitted/null = the caller genuinely does not know, which is
       *  'unrecorded' — never quietly one of the two real answers. */
      toolGenerated?: boolean | null;
      /** G3 STALE-BASE GUARD (partial): the set's stored sync markers from
       *  the SAME inventory row `toolGenerated` reads — the canvas's "what I
       *  was last synced from" fingerprint (ds_contracts/contractId +
       *  specHash + version). Omitted/null with a base present = the guard
       *  reports 'unverifiable' by name, never a silent 'match'. */
      canvasMarkers?: {
        contractId?: string | null;
        specHash?: string | null;
        version?: string | null;
      } | null;
    } = {},
  ): ProposeDiffResult | { ok: false; issue: PlainIssue } {
    const baseless = baseRaw === null || baseRaw === undefined;
    const base = baseless ? null : ContractSchema.safeParse(baseRaw);
    if (base && !base.success) {
      return {
        ok: false,
        issue: plain(
          "The base contract does not parse against the schema — paste the contract this set was generated from.",
          base.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("\n"),
        ),
      };
    }
    const baseData = base && base.success ? base.data : null;
    const { corpus: activeCorpus, label: tokenSource } = proposalCorpus(
      opts.tokenSet,
    );
    const provenance = (dump as { _provenance?: { fileKey?: string | null } })
      ._provenance;
    const targetSet = dump[setName] as
      | {
          propertyDefinitions?: Record<string, unknown>;
          variants?: Array<{ variantProperties?: Record<string, unknown> }>;
        }
      | undefined;
    const hasStructuredProjection =
      !!targetSet?.propertyDefinitions &&
      (targetSet.variants ?? []).every(
        (variant) => !!variant.variantProperties,
      );
    let batch;
    try {
      batch = proposeBatchFromDump(dump as never, {
        corpus: activeCorpus,
        contractIdByName: new Map(
          [...bakedById.values()].map(
            (c) => [c.name, c.id] as [string, string],
          ),
        ),
        contractIdByKey: new Map(
          [...bakedById.values()]
            .filter((c) => c.anchors.figma.componentSetKey !== null)
            .map(
              (c) =>
                [c.anchors.figma.componentSetKey as string, c.id] as [
                  string,
                  string,
                ],
            ),
        ),
        contractsById: new Map(bakedById),
        fileKey: provenance?.fileKey ?? null,
        // Structured dumps prove the matrix in exact mode.
        // Unstructured dumps with a known hand-built / tool-generated
        // provenance stay on reviewable inversion (name-based path; the
        // asymmetry copy still rides `toolGenerated`). Unrecorded
        // provenance without structured evidence fails closed in exact.
        projectionMode:
          hasStructuredProjection || opts.toolGenerated == null
            ? "exact"
            : "reviewable-inversion",
        mintUnbound: true,
        hiddenCaptured: dumpCapturesHidden(provenance as never),
      });
    } catch (e) {
      return { ok: false, issue: plainFromThrow("The proposal failed", e) };
    }
    const proposal =
      batch.proposals.find((p) => p.setName === setName) ?? batch.proposals[0];
    if (!proposal) {
      const skip =
        batch.skipped.find((s) => s.setName === setName) ?? batch.skipped[0];
      return {
        ok: false,
        issue: skip
          ? plain(skip.reason, skip.detail)
          : plain(`No component set named "${setName}" was in the dump.`),
      };
    }
    const proposedContract = baseData?.provenance
      ? markAwaitingCodeAdoption(
          baseData as unknown as Record<string, unknown>,
          proposal.contract,
        )
      : proposal.contract;
    if (baseData && !baseData.provenance) {
      proposal.notes.push(
        "Awaiting-code-adoption provenance was not stamped: the base is an old unprovenanced contract. Run one matching code extraction to bootstrap it before accepting this design-led proposal.",
      );
    }
    const summaryLines = baseData
      ? boundedContractDiff(baseData, proposedContract)
      : baselessProposalLines(proposal.contract, proposal.unbound, tokenSource);
    // G3 stale-base guard — a STALE verdict's warning leads the summary, so
    // the panel, the export envelope, and the PR body all carry it; the
    // other verdicts ride only the structured field (no manufactured alarm).
    const baseFreshness = baseFreshnessOf(
      baseData,
      opts.canvasMarkers,
      opts.tokenSet,
    );
    if (baseFreshness.stale && baseFreshness.line) {
      summaryLines.unshift(baseFreshness.line);
    }
    const canvasProvenance: CanvasProvenance =
      opts.toolGenerated === true
        ? "tool-generated"
        : opts.toolGenerated === false
          ? "hand-built"
          : "unrecorded";
    const contractName = String(
      (proposal.contract as { name?: unknown }).name ?? proposal.setName,
    );
    const codePlan = codePlanFor(contractName, canvasProvenance);
    const exportJson = JSON.stringify(
      {
        type: "CONTRACT-PROPOSAL",
        baseContractId: baseData ? baseData.id : null,
        baseVersion: baseData ? baseData.version : null,
        setName: proposal.setName,
        summary: summaryLines,
        proposedContract,
        projection: proposal.projection,
        proposalNotes: proposal.notes,
        // ENVELOPE v2 — the two payloads the export doors used to DROP: the
        // stub contracts and the minted DTCG tree ride the SAME envelope the
        // proposal does, so `figma receive` / `propose-pr` can land a set
        // whose generate actually succeeds. Fields are absent when empty;
        // old parsers ignore unknown fields, new parsers accept old
        // envelopes without them.
        ...(proposal.childStubs && proposal.childStubs.length > 0
          ? { childStubs: proposal.childStubs }
          : {}),
        ...(proposal.mintedTokens
          ? { mintedTokens: proposal.mintedTokens }
          : {}),
        // THE ASYMMETRY, carried to the code side. `propose-pr` reads this
        // and prints the matching sentence in the PR body; without it the
        // PR would have to say "not recorded".
        provenance: {
          toolGenerated:
            canvasProvenance === "unrecorded"
              ? null
              : canvasProvenance === "tool-generated",
          kind: canvasProvenance,
          note: provenanceSentence(canvasProvenance),
        },
        // G3 STALE-BASE GUARD (partial): the base-freshness verdict rides
        // the envelope so `figma receive` / `propose-pr` — and any human
        // reading the export — see the same warning the panel showed. Old
        // parsers ignore the unknown field.
        baseFreshness: {
          verdict: baseFreshness.verdict,
          stale: baseFreshness.stale,
          line: baseFreshness.line,
          baseSpecHash: baseFreshness.baseSpecHash,
          canvasSpecHash: baseFreshness.canvasSpecHash,
        },
      },
      null,
      2,
    );
    return {
      ok: true,
      setName: proposal.setName,
      proposal: proposedContract,
      summaryLines,
      exportJson,
      proposalNotes: proposal.notes,
      baseless,
      tokenSource,
      unbound: proposal.unbound,
      ...(proposal.childStubs && proposal.childStubs.length > 0
        ? { childStubs: proposal.childStubs }
        : {}),
      ...(proposal.mintedTokens ? { mintedTokens: proposal.mintedTokens } : {}),
      provenance: canvasProvenance,
      codePlan,
      baseFreshness,
    };
  }

  /** BROWNFIELD — what a proposal SAYS when there is nothing to diff it
   *  against. Describes the API surface the canvas drew, names the token
   *  corpus the suggestions came from, and counts the unbound values. */
  function baselessProposalLines(
    proposedRaw: Record<string, unknown>,
    unbound: Array<{
      property: string;
      value: string | number;
      suggestions: string[];
    }>,
    tokenSource: string,
  ): string[] {
    const lines: string[] = [];
    const parsed = ContractSchema.safeParse(proposedRaw);
    if (!parsed.success) {
      return [
        "The proposed contract did not parse against the schema — see the export for the raw proposal.",
        BASELESS_SCOPE_NOTE,
      ];
    }
    const p = parsed.data;
    lines.push(
      `No base contract — proposing "${p.id}" v${p.version} from what is drawn.`,
    );
    for (const prop of p.props) {
      const t = propTypeText(prop.type);
      const dflt =
        prop.default === undefined
          ? ""
          : ` (default ${JSON.stringify(prop.default)})`;
      lines.push(`prop ${prop.name} (${t})${dflt}`);
    }
    if (!p.props.length)
      lines.push(
        "no component properties — this set draws a single fixed variant.",
      );
    const slotNames = [...slotsOf(p)].map((s) => s.slot.name);
    if (slotNames.length) lines.push(`slots: ${slotNames.join(", ")}`);
    lines.push(`nearest-token suggestions come from ${tokenSource}.`);
    lines.push(
      unbound.length === 0
        ? "every drawn value resolved to a token — nothing unbound."
        : `${unbound.length} drawn value${unbound.length === 1 ? "" : "s"} bound to no token (reported, never invented) — e.g. ${unbound
            .slice(0, 3)
            .map(
              (u) =>
                `${u.property} ${String(u.value)}${u.suggestions.length ? ` → nearest: ${u.suggestions[0]}` : " → no candidate"}`,
            )
            .join("; ")}.`,
    );
    lines.push(BASELESS_SCOPE_NOTE);
    return lines;
  }

  /** Plain-words spelling of a prop's declared type — shared by the diff and
   *  the base-less proposal summary so both reports speak one language. */
  function propTypeText(t: Contract["props"][number]["type"]): string {
    if (typeof t === "string") return t;
    if ("enum" in t) return `enum(${t.enum.join("|")})`;
    return "arrayOf";
  }

  /** Bounded API-level contract diff, plain words. */
  function boundedContractDiff(
    base: Contract,
    proposedRaw: Record<string, unknown>,
  ): string[] {
    const lines: string[] = [];
    const proposed = ContractSchema.safeParse(proposedRaw);
    if (!proposed.success) {
      return [
        "The proposed contract did not parse against the schema — see the export for the raw proposal.",
        DIFF_SCOPE_NOTE,
      ];
    }
    const p = proposed.data;
    const typeText = propTypeText;
    const baseProps = new Map(base.props.map((x) => [x.name, x]));
    const propProps = new Map(p.props.map((x) => [x.name, x]));
    for (const [name, prop] of propProps) {
      const b = baseProps.get(name);
      if (!b) {
        lines.push(`+prop ${name} (${typeText(prop.type)})`);
        continue;
      }
      if (typeText(b.type) !== typeText(prop.type)) {
        lines.push(
          `prop ${name}: type ${typeText(b.type)} → ${typeText(prop.type)}`,
        );
      }
      if (JSON.stringify(b.default) !== JSON.stringify(prop.default)) {
        lines.push(
          `prop ${name}: default ${b.default === undefined ? "(none)" : JSON.stringify(b.default)} → ${prop.default === undefined ? "(none)" : JSON.stringify(prop.default)}`,
        );
      }
    }
    for (const [name] of baseProps) {
      if (!propProps.has(name))
        lines.push(`-prop ${name} (not observed in the drawn set)`);
    }
    const baseSlots = new Set([...slotsOf(base)].map((s) => s.slot.name));
    const propSlots = new Set([...slotsOf(p)].map((s) => s.slot.name));
    for (const s of propSlots) if (!baseSlots.has(s)) lines.push(`+slot ${s}`);
    for (const s of baseSlots)
      if (!propSlots.has(s))
        lines.push(`-slot ${s} (not observed in the drawn set)`);
    if (JSON.stringify(base.anatomy) !== JSON.stringify(p.anatomy)) {
      lines.push(
        "anatomy/style changes (see the exported proposal for the full trees)",
      );
    }
    if (lines.length === 0)
      lines.push(
        "No API-level differences — the drawn set matches its contract.",
      );
    lines.push(DIFF_SCOPE_NOTE);
    return lines;
  }

  // -------------------------------------------------------------------------
  // Propose → GitHub PR (BYO fine-grained token; DRY-RUN plan is pure)
  // -------------------------------------------------------------------------

  interface PrRequest {
    /** Plain-words step name shown in dry-run and live logs. */
    title: string;
    method: "GET" | "POST" | "PUT";
    url: string;
    /** null for GETs; a template for writes (dry-run shows it verbatim). */
    body: Record<string, unknown> | null;
  }

  interface PrPlanInput {
    owner: string;
    repo: string;
    /** Base branch; empty → resolved live from the repo's default branch. */
    base: string;
    /** Path of the contract file inside the repo. */
    path: string;
    contractJson: string;
    contractId: string;
    baseVersion: string;
    summaryLines: string[];
    /** Deterministic override for the harness; live runs derive from Date. */
    branchSuffix?: string;
    /** ENVELOPE v2 — the payloads the other two delivery doors already
     *  carry. Absent/empty → the plan is byte-identical to the historic
     *  contract-only plan (one PUT, same body). Present → each stub files
     *  as its own *.contract.json and the minted tree as *.minted.dtcg.json
     *  NEXT TO the contract, under the SAME names `figma receive` /
     *  `propose-pr` write — without them the committed proposal references
     *  child ids and minted token refs `generate` refuses by name. */
    childStubs?: Array<Record<string, unknown>>;
    mintedTokens?: {
      tree: Record<string, unknown>;
      count: number;
      entries?: unknown[];
    } | null;
  }

  /** One file the PR commits — path, exact bytes, and the commit message the
   *  live run uses (the dry-run request templates quote the same message). */
  interface PrPlanFile {
    path: string;
    contents: string;
    kind: "contract" | "tokens";
    role: "main" | "stub" | "minted-tokens";
    message: string;
  }

  function prPlan(input: PrPlanInput): {
    branch: string;
    title: string;
    body: string;
    files: PrPlanFile[];
    requests: PrRequest[];
  } {
    const api = "https://api.github.com";
    const suffix =
      input.branchSuffix ??
      new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").toLowerCase();
    const branch = `ds-contracts/propose-${input.contractId.replace(/[^a-z0-9.-]+/gi, "-")}-${suffix}`;
    const repoUrl = `${api}/repos/${input.owner}/${input.repo}`;
    const title = `Proposed contract change: ${input.contractId} (from Figma)`;
    // Sidecars land NEXT TO the contract — the CLI's propose-pr convention
    // (dir from the contract path; file names from the shared core helpers).
    const destDir = input.path.includes("/")
      ? input.path.slice(0, input.path.lastIndexOf("/"))
      : "";
    const inDir = (name: string) => (destDir ? `${destDir}/${name}` : name);
    const mainMessage = `propose: ${input.contractId} contract change from Figma`;
    const files: PrPlanFile[] = [
      {
        path: input.path,
        contents: input.contractJson,
        kind: "contract",
        role: "main",
        message: mainMessage,
      },
    ];
    for (const [i, stub] of (input.childStubs ?? []).entries()) {
      const stubId =
        typeof stub.id === "string" && stub.id.length > 0 ? stub.id : null;
      if (!stubId)
        throw new Error(
          `PR plan REFUSED: childStubs[${i}] has no non-empty string id — an unidentifiable stub contract cannot be filed, and dropping it silently would re-open the door this plan closes. No request was planned.`,
        );
      files.push({
        path: inDir(contractFileNameForId(stubId)),
        contents: JSON.stringify(stub, null, 2) + "\n",
        kind: "contract",
        role: "stub",
        message: `${mainMessage} — stub contract ${stubId}`,
      });
    }
    if (input.mintedTokens && input.mintedTokens.tree) {
      files.push({
        path: inDir(mintedTokensFileNameForId(input.contractId || "proposal")),
        contents: JSON.stringify(input.mintedTokens.tree, null, 2) + "\n",
        kind: "tokens",
        role: "minted-tokens",
        message: `${mainMessage} — minted token tree`,
      });
    }
    // The CLI's refusal, mirrored: two files planning the same destination
    // would silently clobber each other on the branch.
    const seen = new Set<string>();
    for (const f of files) {
      if (seen.has(f.path))
        throw new Error(
          `PR plan REFUSED: two files resolve to the same destination "${f.path}" — no request was planned.`,
        );
      seen.add(f.path);
    }
    const sidecars = files.filter((f) => f.role !== "main");
    const body = [
      `A designer proposed this change from Figma via the DS Contracts Sync Runner plugin.`,
      "",
      `Base: ${input.contractId} v${input.baseVersion}`,
      "",
      "## Summary",
      ...input.summaryLines.map((l) => `- ${l}`),
      "",
      // ENVELOPE v2 — every file the PR carries, named in the body. A
      // sidecar-less plan keeps the historic contract-only body verbatim.
      ...(sidecars.length > 0
        ? [
            "## Files",
            `- \`${input.path}\` — the proposed contract (the source of truth)`,
            ...sidecars.map((f) =>
              f.role === "stub"
                ? `- \`${f.path}\` — auto-proposed STUB contract for a nested instance with no contract in scope (API from observed values only; import the real child set to replace it)`
                : `- \`${f.path}\` — the provisional minted token tree the proposal's \`imported.*\` refs resolve through (rename these tokens on adoption)`,
            ),
            "",
            `The ${sidecars.length} sidecar file(s) are the contract's companions — without them \`generate\` refuses the proposal's child ids and minted token refs by name. Nothing else in the repository is touched.`,
            "",
          ]
        : []),
      "_The contract file in this PR is the proposed document; review it like any other contract diff._",
    ].join("\n");
    const requests: PrRequest[] = [
      {
        title: input.base
          ? `Confirm base branch "${input.base}" exists`
          : "Resolve the default branch",
        method: "GET",
        url: input.base ? `${repoUrl}/git/ref/heads/${input.base}` : repoUrl,
        body: null,
      },
      {
        title: `Create branch ${branch}`,
        method: "POST",
        url: `${repoUrl}/git/refs`,
        body: { ref: `refs/heads/${branch}`, sha: "<base branch head sha>" },
      },
      ...files.map(
        (f): PrRequest => ({
          title: `Commit ${f.path} on ${branch}`,
          method: "PUT",
          url: `${repoUrl}/contents/${f.path}`,
          body: {
            message: f.message,
            branch,
            content:
              f.role === "main"
                ? "<base64 of the proposed contract>"
                : f.role === "stub"
                  ? "<base64 of the stub contract>"
                  : "<base64 of the minted token tree>",
            sha: "<existing file sha, when the file already exists>",
          },
        }),
      ),
      {
        title: "Open the pull request",
        method: "POST",
        url: `${repoUrl}/pulls`,
        body: {
          title,
          head: branch,
          base: input.base || "<default branch>",
          body,
        },
      },
    ];
    return { branch, title, body, files, requests };
  }

  /** Dry-run text — the exact plan, no network, no token needed. */
  function prDryRunLines(input: PrPlanInput): string[] {
    const { branch, requests } = prPlan(input);
    return [
      `DRY RUN — no request leaves this window. The live run would:`,
      ...requests.map((r, i) => `${i + 1}. ${r.title} — ${r.method} ${r.url}`),
      `Branch: ${branch}`,
      `Token: used for these requests only, kept in this window's memory, never stored.`,
    ];
  }

  /** G9 — the sample-library cold start: a curated CONTRACTS-BUNDLE built
   *  from the contracts already baked into this build (Card + the components
   *  it composes). One click on the Build tab feeds it straight into the
   *  existing generate path — no paste, no repo, no CLI. */
  const SAMPLE_IDS = ["ds.card", "ds.badge", "ds.avatar", "ds.button"];

  return {
    contractCount: bakedById.size,
    /** Raw JSON text of a baked repo contract (Propose pre-fills the base
     *  box from a set's identity marker) — null when the id is not baked. */
    bakedContract: (id: string): string | null => {
      const c = bakedById.get(id);
      return c ? JSON.stringify(c, null, 2) : null;
    },
    /** The baked sample bundle (G9) — null when this build carries none of
     *  the curated contracts (a stripped custom build). */
    sampleBundleJson: (): string | null => {
      const picked = SAMPLE_IDS.map((id) => bakedById.get(id)).filter(
        (c): c is Contract => !!c,
      );
      if (picked.length === 0) return null;
      return JSON.stringify(
        {
          type: "CONTRACTS-BUNDLE",
          version: 1,
          note: "Sample library — the reference contracts baked into this plugin build.",
          contracts: picked,
        },
        null,
        2,
      );
    },
    parseIncomingText,
    parseIncomingValue,
    validateOne,
    planGenerate,
    inventoryScriptSource,
    // BROWNFIELD — the read-only "what is in this file" half. Same walk,
    // marker filter off; the marked inventory above is untouched.
    scanScriptSource,
    scanReport,
    scanExportJson,
    updatePlan,
    updateApplySteps,
    // THE STANDING CHANNEL (G1) — the same module-level pure functions the
    // eval imports directly, re-exported here so ui.html reaches them on
    // window.DSC and the two paths can never drift.
    channelFingerprint,
    parseApplyLog,
    appendApplyEntry,
    lastAppliedSeq,
    channelFreshness,
    provenanceLine,
    relativeWhen,
    applyLogScriptSource,
    recordApplyScriptSource,
    APPLY_LOG_MAX_ENTRIES,
    specHashOf: (raw: unknown) => {
      const v = validateOne(raw, labelOf(raw, 0));
      if (!v.ok) throw new Error(v.issues[0].headline);
      return specHashOf(v.contract, scopeFor([v.contract]));
    },
    proposeDiff,
    // Canvas → code, named before it happens: the files a proposal turns
    // into and the provenance sentence that says how far to trust them.
    codePlanFor,
    prPlan,
    prDryRunLines,
  };
}

export type PluginEngine = ReturnType<typeof createPluginEngine>;
