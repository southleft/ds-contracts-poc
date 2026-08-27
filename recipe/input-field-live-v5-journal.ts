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
import {
  INPUT_LIVE_V5_PHASES,
  type InputLiveV5AuthorizationProof,
} from "./input-field-live-v5-authorization.js";

export type InputLiveV5Phase = (typeof INPUT_LIVE_V5_PHASES)[number];

export interface InputLiveV5WriterOwnership {
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

export interface InputLiveV5JournalEntry {
  artifactVersion: "input-live-v5-phase-journal-v1";
  attempt: number;
  phase: InputLiveV5Phase;
  phaseIndex: number;
  previousEntrySha256: string | null;
  payloadSha256: string;
  entrySha256: string;
  payload: unknown;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const assertAttempt = (attempt: number): void => {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3)
    throw new TypeError("Input live v5 attempt must be 1..3");
};

export function assertInputLiveV5WriterOwnership(
  value: unknown,
): asserts value is InputLiveV5WriterOwnership {
  if (!value || typeof value !== "object")
    throw new TypeError("v5 writer ownership absent");
  const writer = value as InputLiveV5WriterOwnership;
  const lists = [
    writer.setIds,
    writer.sectionIds,
    writer.collectionIds,
    writer.createdNodeIds,
  ];
  if (
    typeof writer.pageId !== "string" ||
    writer.pageId.length === 0 ||
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
    throw new TypeError("v5 writer ownership has invalid or zero IDs/counts");
}

export function createInputLiveV5JournalEntry(
  attempt: number,
  phase: InputLiveV5Phase,
  payload: unknown,
  previous?: InputLiveV5JournalEntry,
): InputLiveV5JournalEntry {
  assertAttempt(attempt);
  const phaseIndex = INPUT_LIVE_V5_PHASES.indexOf(phase);
  if (phaseIndex < 0) throw new TypeError(`unknown v5 phase ${phase}`);
  const recoveryCleanup =
    phase === "retention-and-cleanup" &&
    previous !== undefined &&
    previous.phaseIndex < phaseIndex - 1 &&
    typeof payload === "object" &&
    payload !== null &&
    (payload as Record<string, unknown>).recoveryAfterFailure === true;
  if (
    (phaseIndex === 0 && previous !== undefined) ||
    (phaseIndex > 0 &&
      (previous === undefined ||
        previous.attempt !== attempt ||
        (previous.phaseIndex !== phaseIndex - 1 && !recoveryCleanup)))
  )
    throw new TypeError(`phase reorder before ${phase}`);
  const payloadSha256 = sha256(canonicalJson(payload));
  const body = {
    artifactVersion: "input-live-v5-phase-journal-v1" as const,
    attempt,
    phase,
    phaseIndex,
    previousEntrySha256: previous?.entrySha256 ?? null,
    payloadSha256,
    payload,
  };
  return {
    ...body,
    entrySha256: sha256(canonicalJson(body)),
  };
}

export function validateInputLiveV5Journal(
  entries: readonly InputLiveV5JournalEntry[],
): string[] {
  const failures: string[] = [];
  if (entries.length === 0) return ["journal has zero completed phases"];
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    const recoveryCleanup =
      entry.phase === "retention-and-cleanup" &&
      previous !== undefined &&
      previous.phaseIndex < entry.phaseIndex - 1 &&
      typeof entry.payload === "object" &&
      entry.payload !== null &&
      (entry.payload as Record<string, unknown>).recoveryAfterFailure === true;
    if (
      entry.phase !== INPUT_LIVE_V5_PHASES[entry.phaseIndex] ||
      (index === 0
        ? entry.phaseIndex !== 0
        : entry.phaseIndex !== previous!.phaseIndex + 1 && !recoveryCleanup)
    )
      failures.push(`phase ${index}: order`);
    if (entry.previousEntrySha256 !== (previous?.entrySha256 ?? null))
      failures.push(`phase ${index}: previous hash`);
    if (entry.payloadSha256 !== sha256(canonicalJson(entry.payload)))
      failures.push(`phase ${index}: payload hash`);
    const { entrySha256: _entrySha256, ...body } = entry;
    if (entry.entrySha256 !== sha256(canonicalJson(body)))
      failures.push(`phase ${index}: entry hash`);
  });
  return failures;
}

export class InputLiveV5PhaseJournal {
  readonly #directory: string;
  readonly #attempt: number;
  #entries: InputLiveV5JournalEntry[] = [];

  constructor(directory: string, attempt: number) {
    assertAttempt(attempt);
    this.#directory = directory;
    this.#attempt = attempt;
    mkdirSync(directory, { recursive: true });
    this.#entries = this.#readExisting();
    const failures =
      this.#entries.length === 0
        ? []
        : validateInputLiveV5Journal(this.#entries);
    if (failures.length)
      throw new TypeError(
        `invalid existing v5 journal:\n${failures.join("\n")}`,
      );
  }

  get entries(): readonly InputLiveV5JournalEntry[] {
    return this.#entries;
  }

  append(phase: InputLiveV5Phase, payload: unknown): InputLiveV5JournalEntry {
    const entry = createInputLiveV5JournalEntry(
      this.#attempt,
      phase,
      payload,
      this.#entries.at(-1),
    );
    const target = this.#artifactPath(entry.phaseIndex, phase);
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(entry, null, 2)}\n`, {
      flag: "wx",
    });
    renameSync(temporary, target);
    this.#entries = [...this.#entries, entry];
    return entry;
  }

  writerOwnership(): InputLiveV5WriterOwnership {
    const artifact = this.#artifactPath(1, "writer-result");
    const writer = existsSync(artifact)
      ? (JSON.parse(readFileSync(artifact, "utf8")) as InputLiveV5JournalEntry)
          .payload
      : undefined;
    assertInputLiveV5WriterOwnership(writer);
    return writer;
  }

  #artifactPath(index: number, phase: InputLiveV5Phase): string {
    return path.join(
      this.#directory,
      `${String(index + 1).padStart(2, "0")}-${phase}.json`,
    );
  }

  #readExisting(): InputLiveV5JournalEntry[] {
    return INPUT_LIVE_V5_PHASES.flatMap((phase, index) => {
      const artifact = this.#artifactPath(index, phase);
      return existsSync(artifact)
        ? [
            JSON.parse(
              readFileSync(artifact, "utf8"),
            ) as InputLiveV5JournalEntry,
          ]
        : [];
    });
  }
}

export const authorizationJournalPayload = (
  proof: InputLiveV5AuthorizationProof,
): Record<string, unknown> => ({
  authorizationMode: proof.mode,
  protocolCommit: proof.protocolCommit,
  authorizationCommit: proof.authorizationCommit,
  codeCommit: proof.codeCommit,
  upstreamCommit: proof.upstreamCommit,
  target: proof.target,
  capture: false,
});
