import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { canonicalJson } from "./normalize.js";

export const INPUT_LIVE_V4_PHASES = [
  "preflight",
  "writer-result",
  "raw-scene-and-variable-table",
  "host-normalization",
  "accounting-and-fixed-point",
  "usability-and-restoration",
  "captures-and-objective",
  "retention-and-cleanup",
] as const;

export type InputLiveV4Phase = (typeof INPUT_LIVE_V4_PHASES)[number];

export interface InputLiveV4JournalEntry {
  artifactVersion: "input-live-v4-phase-journal-v1";
  attempt: number;
  phase: InputLiveV4Phase;
  phaseIndex: number;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
  payload: unknown;
}

export interface InputLiveV4WriterOwnership {
  pageId: string;
  setIds: string[];
  sectionIds: string[];
  collectionIds: string[];
  createdNodeIds: string[];
  counts: {
    sources: number;
    variants: number;
    collections: number;
    nodes: number;
  };
}

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const entryHashInput = (
  entry: Omit<InputLiveV4JournalEntry, "entrySha256">,
): string => canonicalJson(entry);

const assertAttempt = (attempt: number): void => {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3)
    throw new TypeError("Input live v4 attempt must be 1..3");
};

export function createInputLiveV4JournalEntry(
  attempt: number,
  phase: InputLiveV4Phase,
  payload: unknown,
  previous?: InputLiveV4JournalEntry,
): InputLiveV4JournalEntry {
  assertAttempt(attempt);
  const phaseIndex = INPUT_LIVE_V4_PHASES.indexOf(phase);
  if (phaseIndex < 0) throw new TypeError(`unknown v4 phase ${phase}`);
  if (phaseIndex === 0 && previous !== undefined)
    throw new TypeError("preflight cannot have a previous phase");
  if (phaseIndex > 0) {
    const recoveryCleanup =
      phase === "retention-and-cleanup" &&
      previous !== undefined &&
      previous.phaseIndex < phaseIndex - 1 &&
      payload !== null &&
      typeof payload === "object" &&
      (payload as Record<string, unknown>).recoveryAfterFailure === true;
    if (
      previous === undefined ||
      previous.attempt !== attempt ||
      (previous.phaseIndex !== phaseIndex - 1 && !recoveryCleanup)
    )
      throw new TypeError(`phase reorder before ${phase}`);
  }
  const payloadSha256 = sha256(canonicalJson(payload));
  const body = {
    artifactVersion: "input-live-v4-phase-journal-v1" as const,
    attempt,
    phase,
    phaseIndex,
    previousEntrySha256: previous?.entrySha256 ?? null,
    payloadSha256,
    payload,
  };
  return { ...body, entrySha256: sha256(entryHashInput(body)) };
}

export function validateInputLiveV4Journal(
  entries: readonly InputLiveV4JournalEntry[],
): string[] {
  const failures: string[] = [];
  if (entries.length === 0) return ["journal has zero completed phases"];
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    const recoveryCleanup =
      entry.phase === "retention-and-cleanup" &&
      previous !== undefined &&
      previous.phaseIndex < entry.phaseIndex - 1 &&
      entry.payload !== null &&
      typeof entry.payload === "object" &&
      (entry.payload as Record<string, unknown>).recoveryAfterFailure === true;
    if (
      entry.phase !== INPUT_LIVE_V4_PHASES[entry.phaseIndex] ||
      (index === 0
        ? entry.phaseIndex !== 0
        : entry.phaseIndex !== previous!.phaseIndex + 1 && !recoveryCleanup)
    )
      failures.push(`phase ${entry.phaseIndex}: order`);
    if (entry.attempt !== entries[0]?.attempt)
      failures.push(`phase ${index}: attempt drift`);
    const expectedPrevious = index === 0 ? null : previous!.entrySha256;
    if (entry.previousEntrySha256 !== expectedPrevious)
      failures.push(`phase ${index}: broken previous hash`);
    let payloadHash = "";
    let entryHash = "";
    try {
      payloadHash = sha256(canonicalJson(entry.payload));
      const { entrySha256: _entrySha256, ...body } = entry;
      entryHash = sha256(entryHashInput(body));
    } catch {
      failures.push(`phase ${index}: non-canonical payload`);
    }
    if (payloadHash !== entry.payloadSha256)
      failures.push(`phase ${index}: payload hash`);
    if (entryHash !== entry.entrySha256)
      failures.push(`phase ${index}: entry hash`);
  });
  return failures;
}

export function validateInputLiveV4WriterOwnership(
  value: unknown,
): asserts value is InputLiveV4WriterOwnership {
  if (value === null || typeof value !== "object")
    throw new TypeError("writer journal payload absent");
  const writer = value as InputLiveV4WriterOwnership;
  const lists = [
    writer.setIds,
    writer.sectionIds,
    writer.collectionIds,
    writer.createdNodeIds,
  ];
  if (
    !writer.pageId ||
    lists.some(
      (list) =>
        !Array.isArray(list) ||
        list.length === 0 ||
        list.some((id) => typeof id !== "string" || id.length === 0) ||
        new Set(list).size !== list.length,
    ) ||
    writer.counts?.sources !== 2 ||
    writer.counts?.variants !== 256 ||
    writer.counts.collections !== writer.collectionIds.length ||
    writer.counts.nodes !== writer.createdNodeIds.length
  )
    throw new TypeError("writer journal has zero, duplicate, or invalid IDs/counts");
}

export class InputLiveV4PhaseJournal {
  readonly #directory: string;
  readonly #attempt: number;
  #entries: InputLiveV4JournalEntry[];

  constructor(directory: string, attempt: number) {
    assertAttempt(attempt);
    this.#directory = directory;
    this.#attempt = attempt;
    mkdirSync(directory, { recursive: true });
    this.#entries = this.#readExisting();
    const failures =
      this.#entries.length === 0
        ? []
        : validateInputLiveV4Journal(this.#entries);
    if (failures.length > 0)
      throw new TypeError(`invalid existing journal:\n${failures.join("\n")}`);
  }

  get entries(): readonly InputLiveV4JournalEntry[] {
    return this.#entries;
  }

  append(phase: InputLiveV4Phase, payload: unknown): InputLiveV4JournalEntry {
    const entry = createInputLiveV4JournalEntry(
      this.#attempt,
      phase,
      payload,
      this.#entries.at(-1),
    );
    const target = path.join(
      this.#directory,
      `${String(entry.phaseIndex + 1).padStart(2, "0")}-${phase}.json`,
    );
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(entry, null, 2)}\n`, {
      flag: "wx",
    });
    renameSync(temporary, target);
    this.#entries = [...this.#entries, entry];
    return entry;
  }

  writerOwnership(): InputLiveV4WriterOwnership {
    const writerArtifact = path.join(
      this.#directory,
      "02-writer-result.json",
    );
    const writer = existsSync(writerArtifact)
      ? (
          JSON.parse(
            readFileSync(writerArtifact, "utf8"),
          ) as InputLiveV4JournalEntry
        ).payload
      : undefined;
    validateInputLiveV4WriterOwnership(writer);
    return writer;
  }

  #readExisting(): InputLiveV4JournalEntry[] {
    const entries: InputLiveV4JournalEntry[] = [];
    for (let index = 0; index < INPUT_LIVE_V4_PHASES.length; index++) {
      const phase = INPUT_LIVE_V4_PHASES[index]!;
      const artifact = path.join(
        this.#directory,
        `${String(index + 1).padStart(2, "0")}-${phase}.json`,
      );
      if (existsSync(artifact))
        entries.push(
          JSON.parse(readFileSync(artifact, "utf8")) as InputLiveV4JournalEntry,
        );
    }
    return entries;
  }
}
