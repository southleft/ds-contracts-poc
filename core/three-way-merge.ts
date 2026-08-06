/**
 * Three-way per-channel merge — Wave 3 slice 2 (docs/18 G3).
 *
 * Composes genesis (recorded base) × incoming (theirs) × canvas (mine).
 * Non-overlapping channel edits auto-compose. Same-channel collisions never
 * auto-resolve — the caller must supply an explicit mine/theirs choice.
 * A stale base (canvas sync behind main/delivery) is refused by name so a
 * merge cannot bless an accidental revert.
 *
 * Channel keys are opaque strings (typically `part|channel` from
 * `core/channel-diff.ts`). Values are the human-readable channel values.
 */

export type MergeSide = "genesis" | "incoming" | "canvas";

export type MergeChoice = "mine" | "theirs";

export interface ChannelMap {
  /** Channel key → value. Missing key = absent on that side. */
  [channelKey: string]: string;
}

export interface ThreeWayMergeInput {
  contractId: string;
  genesis: ChannelMap;
  incoming: ChannelMap;
  canvas: ChannelMap;
  /**
   * Explicit resolutions for colliding channels. Key = channel key.
   * `mine` = canvas, `theirs` = incoming. Required for every collision
   * before `compose` succeeds — never inferred.
   */
  choices?: Record<string, MergeChoice>;
  /**
   * Freshness of the genesis / canvas base vs the latest delivered main.
   * When `stale: true`, merge refuses before reading channels.
   */
  base?: {
    stale: boolean;
    /** How many deliveries the canvas is behind (for the refusal message). */
    syncsBehind?: number;
    detail?: string;
  };
}

export interface ChannelCollision {
  channel: string;
  genesis: string | null;
  incoming: string | null;
  canvas: string | null;
}

export interface ThreeWayMergeResult {
  ok: true;
  contractId: string;
  /** Composed channel map after auto-merge + choices. */
  composed: ChannelMap;
  /** Channels taken from incoming only (genesis→incoming, canvas unchanged). */
  autoTheirs: string[];
  /** Channels taken from canvas only (genesis→canvas, incoming unchanged). */
  autoMine: string[];
  /** Channels identical on incoming and canvas (both moved the same way). */
  agreed: string[];
  /** Channels resolved via explicit choices. */
  resolved: Array<{ channel: string; choice: MergeChoice; value: string }>;
  /** Unchanged vs genesis. */
  unchanged: string[];
}

export interface ThreeWayMergeNeedChoices {
  ok: false;
  reason: "need-choices";
  contractId: string;
  collisions: ChannelCollision[];
  message: string;
}

export interface ThreeWayMergeStale {
  ok: false;
  reason: "stale-base";
  contractId: string;
  message: string;
  syncsBehind: number;
}

export type ThreeWayMergeOutcome =
  | ThreeWayMergeResult
  | ThreeWayMergeNeedChoices
  | ThreeWayMergeStale;

const ABSENT = null;

function val(map: ChannelMap, key: string): string | null {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : ABSENT;
}

function allKeys(...maps: ChannelMap[]): string[] {
  const set = new Set<string>();
  for (const m of maps) for (const k of Object.keys(m)) set.add(k);
  return [...set].sort();
}

function same(a: string | null, b: string | null): boolean {
  return a === b;
}

/**
 * Pure three-way merge. Never silently picks a winner on a collision.
 */
export function mergeThreeWay(input: ThreeWayMergeInput): ThreeWayMergeOutcome {
  const { contractId, genesis, incoming, canvas, choices = {}, base } = input;

  if (base?.stale) {
    const behind = base.syncsBehind ?? 1;
    return {
      ok: false,
      reason: "stale-base",
      contractId,
      syncsBehind: behind,
      message:
        base.detail ??
        `${contractId}: stale-base REFUSED — canvas is ${behind} sync${behind === 1 ? "" : "s"} behind; deliver before proposing or merging.`,
    };
  }

  const keys = allKeys(genesis, incoming, canvas);
  const composed: ChannelMap = {};
  const autoTheirs: string[] = [];
  const autoMine: string[] = [];
  const agreed: string[] = [];
  const unchanged: string[] = [];
  const resolved: ThreeWayMergeResult["resolved"] = [];
  const collisions: ChannelCollision[] = [];

  for (const channel of keys) {
    const g = val(genesis, channel);
    const t = val(incoming, channel);
    const m = val(canvas, channel);

    // All equal (including all absent — shouldn't appear via allKeys)
    if (same(g, t) && same(t, m)) {
      if (g !== ABSENT) composed[channel] = g!;
      unchanged.push(channel);
      continue;
    }

    // Both sides moved to the same value
    if (!same(t, g) && !same(m, g) && same(t, m)) {
      if (t !== ABSENT) composed[channel] = t!;
      else delete composed[channel];
      agreed.push(channel);
      continue;
    }

    // Only theirs changed
    if (!same(t, g) && same(m, g)) {
      if (t !== ABSENT) composed[channel] = t!;
      autoTheirs.push(channel);
      continue;
    }

    // Only mine changed
    if (same(t, g) && !same(m, g)) {
      if (m !== ABSENT) composed[channel] = m!;
      autoMine.push(channel);
      continue;
    }

    // Collision: both changed differently
    const choice = choices[channel];
    if (choice === "mine" || choice === "theirs") {
      const value = choice === "mine" ? m : t;
      if (value !== ABSENT) composed[channel] = value!;
      resolved.push({
        channel,
        choice,
        value: value ?? "(absent)",
      });
      continue;
    }

    collisions.push({
      channel,
      genesis: g,
      incoming: t,
      canvas: m,
    });
  }

  if (collisions.length > 0) {
    return {
      ok: false,
      reason: "need-choices",
      contractId,
      collisions,
      message:
        `${contractId}: three-way merge needs explicit mine/theirs for ${collisions.length} colliding channel(s): ` +
        collisions.map((c) => c.channel).join(", ") +
        " — no silent winner.",
    };
  }

  return {
    ok: true,
    contractId,
    composed,
    autoTheirs,
    autoMine,
    agreed,
    resolved,
    unchanged,
  };
}

/** Build a ChannelMap from ChannelChange-like rows (before = genesis side). */
export function channelMapFromPairs(
  rows: Array<{ what: string; channel?: string; value: string }>,
): ChannelMap {
  const out: ChannelMap = {};
  for (const row of rows) {
    const key = row.channel ? `${row.what}|${row.channel}` : row.what;
    out[key] = row.value;
  }
  return out;
}

/** English lines for CLI / PR bodies — never invents a resolution. */
export function summarizeMergeOutcome(outcome: ThreeWayMergeOutcome): string[] {
  if (!outcome.ok) {
    if (outcome.reason === "stale-base") return [outcome.message];
    return [
      outcome.message,
      ...outcome.collisions.map(
        (c) =>
          `  conflict ${c.channel}: genesis=${c.genesis ?? "(absent)"} · theirs=${c.incoming ?? "(absent)"} · mine=${c.canvas ?? "(absent)"}`,
      ),
    ];
  }
  const lines = [
    `${outcome.contractId}: three-way merge composed (${Object.keys(outcome.composed).length} channel(s))`,
  ];
  if (outcome.autoTheirs.length)
    lines.push(`  auto theirs: ${outcome.autoTheirs.join(", ")}`);
  if (outcome.autoMine.length)
    lines.push(`  auto mine: ${outcome.autoMine.join(", ")}`);
  if (outcome.agreed.length)
    lines.push(`  agreed both: ${outcome.agreed.join(", ")}`);
  if (outcome.resolved.length)
    lines.push(
      `  resolved: ${outcome.resolved.map((r) => `${r.channel}=${r.choice}`).join(", ")}`,
    );
  return lines;
}
