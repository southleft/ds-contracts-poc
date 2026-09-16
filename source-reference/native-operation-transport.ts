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
  type createNativeOperationJobs,
  type NativeOperationPhase,
  type NativeOperationResult,
} from "./native-operation-jobs.js";

type Jobs = ReturnType<typeof createNativeOperationJobs>;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const SECRET = /^[a-f0-9]{64}$/;
function fail(message: string): never {
  throw Error(`native-transport-${message}`);
}
const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const NEXT: Partial<
  Record<ReturnType<Jobs["get"]>["phase"], NativeOperationPhase>
> = {
  prepared: "token-create",
  "tokens-created": "token-readback",
  "tokens-observed": "component-create",
  "components-created": "component-readback",
};

export function createNativeOperationTransport(repoRoot: string, jobs: Jobs) {
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
  ) => {
    authorize(id, secret);
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
    return jobs.accept(id, result);
  };
  const retryObservation = (id: string) => {
    connection(id);
    if (!status(id).started) fail("observation-retry-refused");
    jobs.retryObservation(id);
  };
  return { pair, start, status, authorize, claim, accept, retryObservation };
}
