/** Local companion-plugin delivery. The journal owns compilation and truth;
 * this module owns pairing and exclusive command handoff, never rendering.
 * A lost delivery remains unknown. It is never made deliverable a second time.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  type NativeOperationCommand,
  type NativeOperationPhase,
  type NativeOperationResult,
} from "./native-operation-jobs.js";

/** Creation and updates share delivery guarantees while retaining separate
 * typed journals. Neither controller accepts caller-supplied programs. */
export interface NativeDeliveryJobs {
  get(id: string): { phase: string; sourceCurrent: boolean };
  deliveryState(id: string): { phase: string; pendingPhase?: NativeOperationPhase; fileKey: string };
  dispatch(id: string, phase: NativeOperationPhase): NativeOperationCommand;
  pendingCommand(id: string): NativeOperationCommand | null;
  abandonedObservationPhase(id: string, attemptId: string): NativeOperationPhase | null;
  accept(id: string, result: NativeOperationResult): unknown;
  retryObservation(id: string): unknown;
  inspectSizing?(id: string): NativeOperationCommand;
  /** Journals that can settle an unresolved write by reading the canvas. */
  resolveWriteOutcome?(id: string): NativeOperationCommand;
  beginWrite?(id: string, attemptId: string): void;
  observeDesign?(id: string): NativeOperationCommand;
  rearmWrite?(id: string): void;
  /** Operator attestation that the companion that began the latest write is gone. */
  attestDead?(id: string): unknown;
  writeOutcomeRead?(id: string): { writeAttemptId: string; readAttemptId: string } | null;
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const SECRET = /^[a-f0-9]{64}$/;
function fail(message: string): never {
  throw Error(`native-transport-${message}`);
}
const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const NEXT: Partial<
  Record<string, NativeOperationPhase>
> = {
  prepared: "token-create",
  "comparison-repair-observed": "comparison-repair-apply",
  "comparison-recovery-observed": "comparison-recovery-apply",
  "tokens-created": "token-readback",
  "tokens-observed": "component-create",
  "components-created": "component-readback",
  "update-prepared": "update-preflight-readback",
  "update-preflight-observed": "update-apply",
  "update-applied": "update-readback",
};

export function createNativeOperationTransport<Jobs extends NativeDeliveryJobs>(repoRoot: string, jobs: Jobs) {
  const root = path.join(repoRoot, "private", "source-native-transport");
  const seen = new Map<string, number>();
  const ensure = (directory: string, create = true) => {
    if (create && !existsSync(directory)) mkdirSync(directory, { mode: 0o700 });
    if (
      !lstatSync(directory).isDirectory() ||
      lstatSync(directory).isSymbolicLink()
    )
      fail("directory-invalid");
  };
  const directory = (id: string, create = true) => {
    if (!UUID.test(id)) fail("identity-invalid");
    ensure(path.join(repoRoot, "private"), create);
    ensure(root, create);
    const target = path.join(root, id);
    ensure(target, create);
    return target;
  };
  const read = (file: string): any => {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096)
      fail("record-invalid");
    return JSON.parse(readFileSync(file, "utf8"));
  };
  // Exclusive and durable before delivery. Even a torn record fails closed.
  const write = (file: string, value: unknown) => {
    const fd = openSync(file, "wx", 0o600);
    try {
      writeFileSync(fd, JSON.stringify(value));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const parent = openSync(path.dirname(file), "r");
    try {
      fsyncSync(parent);
    } finally {
      closeSync(parent);
    }
  };
  const connection = (id: string) => {
    const value = read(path.join(directory(id, false), "connection.json"));
    if (value.version !== 1 || value.id !== id || !SECRET.test(value.secret))
      fail("connection-invalid");
    return value as { version: 1; id: string; secret: string };
  };
  const authorize = (id: string, secret: string) => {
    if (!SECRET.test(secret)) fail("unauthorized");
    const saved = connection(id);
    if (!timingSafeEqual(Buffer.from(saved.secret), Buffer.from(secret)))
      fail("unauthorized");
  };
  const pair = (id: string) => {
    jobs.get(id); // Must be an actual valid journal, never caller-chosen script.
    const file = path.join(directory(id), "connection.json");
    if (!existsSync(file)) {
      try {
        write(file, {
          version: 1,
          id,
          secret: randomBytes(32).toString("hex"),
        });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
    }
    return `dscn_${id}.${connection(id).secret}`;
  };
  const start = (id: string) => {
    connection(id);
    const snapshot = jobs.get(id);
    if (!snapshot.sourceCurrent || !NEXT[snapshot.phase]) fail("start-refused");
    const file = path.join(directory(id), "started.json");
    if (!existsSync(file)) {
      try {
        write(file, { version: 1, id });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
    }
  };
  const status = (id: string, observedAt = Date.now()) => {
    const dir = directory(id);
    // Liveness is sampled at request entry, before synchronous source validation
    // can prevent the event loop from processing another plugin heartbeat.
    const lastSeen = seen.get(id);
    const connected = lastSeen !== undefined && observedAt - lastSeen < 15_000;
    const started = existsSync(path.join(dir, "started.json"));
    const state = started ? jobs.deliveryState(id) : null;
    return {
      paired: existsSync(path.join(dir, "connection.json")),
      connected,
      started,
      finished: !!state && !state.pendingPhase && !NEXT[state.phase],
    };
  };
  const claim = (
    id: string,
    secret: string,
    fileKey: string,
    replaceReadbackAttemptId?: string,
    resolveWriteAttemptId?: string,
    protocol?: number,
  ) => {
    authorize(id, secret);
    // A companion that died mid-write holds that write's marker and will run
    // nothing else. It may take exactly one thing: the read that settles it.
    if (resolveWriteAttemptId !== undefined && (replaceReadbackAttemptId !== undefined || !UUID.test(resolveWriteAttemptId) ||
        jobs.writeOutcomeRead?.(id)?.writeAttemptId !== resolveWriteAttemptId)) {
      seen.set(id, Date.now());
      return { status: "awaiting-result" as const };
    }
    if (fileKey !== jobs.deliveryState(id).fileKey) fail("file-refused");
    seen.set(id, Date.now());
    const dir = directory(id),
      state = status(id);
    if (!state.started) return { status: "ready" as const };
    if (state.finished) return { status: "finished" as const };
    const replacingPhase =
      replaceReadbackAttemptId === undefined
        ? null
        : UUID.test(replaceReadbackAttemptId)
          ? jobs.abandonedObservationPhase(id, replaceReadbackAttemptId)
          : null;
    if (replaceReadbackAttemptId !== undefined && !replacingPhase)
      return { status: "awaiting-result" as const };
    const snapshot = jobs.deliveryState(id);
    // A journal with the begin handshake hands a write only to a companion that
    // will ask first. An older sandbox left open across an upgrade gets nothing:
    // checked before dispatch and before the claim file, so no attempt is burned.
    const writes = (phase?: string) => !!phase && !phase.endsWith("-readback");
    if (jobs.beginWrite && protocol !== 2 && writes(snapshot.pendingPhase ?? NEXT[snapshot.phase])) {
      seen.set(id, Date.now());
      return { status: "companion-upgrade-required" as const };
    }
    if (!snapshot.pendingPhase) {
      const next = NEXT[snapshot.phase];
      if (!next) return { status: "finished" as const };
      if (replaceReadbackAttemptId !== undefined)
        return { status: "awaiting-result" as const };
      jobs.dispatch(id, next);
    }
    const command = jobs.pendingCommand(id);
    if (!command) fail("command-unavailable");
    if (
      replaceReadbackAttemptId !== undefined &&
      (!command.readOnly ||
        command.phase !== replacingPhase ||
        command.attemptId === replaceReadbackAttemptId)
    ) {
      return { status: "awaiting-result" as const };
    }
    const file = path.join(dir, `${command.attemptId}.json`);
    if (existsSync(file)) {
      if (read(file).commandSha256 !== sha(command)) fail("claim-invalid");
      return { status: "awaiting-result" as const };
    }
    try {
      write(file, {
        version: 1,
        id,
        attemptId: command.attemptId,
        commandSha256: sha(command),
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST")
        return { status: "awaiting-result" as const };
      throw e;
    }
    return {
      status: "command" as const,
      command,
      ...(replaceReadbackAttemptId === undefined
        ? {}
        : { supersedesReadbackAttemptId: replaceReadbackAttemptId }),
      ...(resolveWriteAttemptId === undefined ? {} : { resolvesWriteAttemptId: resolveWriteAttemptId }),
    };
  };
  const accept = (
    id: string,
    secret: string,
    result: NativeOperationResult,
  ) => {
    authorize(id, secret);
    if (!result || !UUID.test(result.attemptId)) fail("result-invalid");
    const record = read(path.join(directory(id), `${result.attemptId}.json`));
    if (
      record.version !== 1 ||
      record.id !== id ||
      record.attemptId !== result.attemptId
    )
      fail("claim-invalid");
    // The journal verifies every correlation field and stores the result before
    // checking fresh source; a stale source must never erase a late native ack.
    return jobs.accept(id, result) as ReturnType<Jobs['accept']>;
  };
  const retryObservation = (id: string) => {
    connection(id);
    if (!status(id).started) fail("observation-retry-refused");
    jobs.retryObservation(id);
  };
  const inspectSizing = (id: string) => {
    connection(id);
    if (!status(id).started || !jobs.inspectSizing) fail('sizing-observation-refused');
    jobs.inspectSizing(id);
  };
  const resolveWriteOutcome = (id: string) => {
    connection(id);
    if (!status(id).started || !jobs.resolveWriteOutcome) fail("write-outcome-resolution-refused");
    jobs.resolveWriteOutcome(id);
  };
  /** The companion asks before executing a write it was handed. Journals
   * without the handshake (creation) answer yes, as they always have. */
  const begin = (id: string, secret: string, attemptId: string) => {
    authorize(id, secret);
    if (!UUID.test(attemptId)) fail("begin-invalid");
    const record = read(path.join(directory(id), `${attemptId}.json`));
    if (record.version !== 1 || record.id !== id || record.attemptId !== attemptId) fail("claim-invalid");
    jobs.beginWrite?.(id, attemptId);
    return { status: "begun" as const };
  };
  const observeDesign = (id: string) => {
    connection(id);
    if (!status(id).started || !jobs.observeDesign) fail("design-observation-refused");
    jobs.observeDesign(id);
  };
  const rearmWrite = (id: string) => {
    connection(id);
    if (!status(id).started || !jobs.rearmWrite) fail("write-rearm-refused");
    jobs.rearmWrite(id);
  };
  /** The operator attests that the companion granted `begin` is gone. The
   * journal revokes that attempt; the canvas read that settles it is a separate step. */
  const attestDead = (id: string, observedAt = Date.now()) => {
    connection(id);
    const state = status(id, observedAt);
    if (!state.started || !jobs.attestDead) fail("write-attestation-refused");
    // A companion that polled within the liveness window is not gone. A companion
    // busy executing does not poll, so this cannot prove absence: it only refuses
    // an attestation that is visibly false.
    if (state.connected) throw Error("native-update-attest-dead-companion-connected");
    jobs.attestDead(id);
  };
  return { pair, start, status, authorize, claim, begin, accept, retryObservation, inspectSizing, resolveWriteOutcome, rearmWrite, attestDead, observeDesign };
}
