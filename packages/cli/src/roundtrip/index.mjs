import { fileHash } from "./files.mjs";
import { read, json, save, saveState, policy, acquireLock } from "./session.mjs";
import { same, snapshot, verifyProjection, identity } from "./projection.mjs";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import { canonical, hash, values } from "./surface.mjs";
import { capture } from "./capture.mjs";
import { emitSystem } from "./figma.mjs";
import { planWriteback, applyWriteback } from "./writeback.mjs";

export async function runRoundtrip(
  argv,
  { reader, captureSource = capture, log = (v) => console.log(canonical(v)) } = {},
) {
  let [action, ...args] = argv;
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(args[i].startsWith("--") && args[i + 1] && !args[i + 1].startsWith("--"), "expected --name value");
    const key = args[i].slice(2);
    assert(["profile", "out", "session", "root", "snapshot", "digest", "port"].includes(key), "unknown flag: " + key);
    assert(!flags[key], "duplicate flag: " + key);
    flags[key] = args[i + 1];
  }
  assert(
    ["start", "accept", "read", "review", "apply", "refresh", "status", "sync", "discard"].includes(action),
    "roundtrip action: start | sync | accept | read | review | apply | refresh | status | discard",
  );
  const dir = path.resolve(flags.session ?? flags.out ?? "");
  assert(flags.session || flags.out, "--session or --out required");
  const stateFile = path.join(dir, "session.json");
  if (action === "start") {
    assert(flags.profile, "--profile required");
    const previous = existsSync(stateFile) ? json(stateFile) : null;
    assert(
      !existsSync(dir) || readdirSync(dir).length === 0 || (previous?.version === 1 && previous.stage === "starting"),
      "output directory is not empty",
    );
    mkdirSync(dir, { recursive: true });
  } else assert(existsSync(stateFile), "session does not exist");
  let onInterrupt = () => {};
  const release = acquireLock(path.join(dir, ".lock"), () => onInterrupt());
  try {
    if (action === "start" && existsSync(stateFile)) {
      const previous = json(stateFile);
      assert(previous.version === 1 && previous.stage === "starting", "session already started");
    }
    let state =
      action === "start"
        ? {
            version: 1,
            root: path.resolve(flags.root ?? process.cwd()),
            profile: json(path.resolve(flags.profile)),
            stage: "starting",
          }
        : json(stateFile);
    if (action === "start") saveState(stateFile, state);
    const P = state.profile,
      target = { ...P.figma },
      bundle = () => state.bundle ?? json(path.join(dir, "bundle.json"));
    const writeProgram = (B, options) => {
      const file = path.join(dir, "figma.js");
      writeFileSync(file, emitSystem(B, { ...target, ...options }));
      return file;
    };
    if (action === "discard") {
      assert(state.stage === "reviewed", "no reviewed plan to discard");
      delete state.reviewed;
      state.stage = "ready";
      saveState(stateFile, state);
      log({ status: "ready", discarded: "reviewed plan" });
      return 0;
    }
    if (action === "sync") {
      assert(["ready", "awaiting-figma"].includes(state.stage), "session is not ready to sync");
      const port = Number(flags.port ?? 9232);
      assert([9231, 9232].includes(port), "supported runner ports: 9231, 9232");
      const program = writeProgram(
          bundle(),
          state.stage === "ready"
            ? { action: "read" }
            : {
                action: state.native ? "patch" : "create",
                ...(state.native ? { expected: state.native } : {}),
              },
        ),
        { servePrograms } = await import("../commands/react-to-figma-serve.ts");
      const [outcome] = await servePrograms(
        [{ name: P.component.id, tokens: "return null;", component: read(program) }],
        target.fileKey,
        read(new URL("./react-to-figma-driver.js", import.meta.url)),
        { port, result: true, log: (line) => console.error(line) },
      );
      assert(outcome.written, outcome.error);
      flags.snapshot = path.join(dir, "transfer.json");
      save(flags.snapshot, outcome.result);
      action = state.stage === "ready" ? "review" : "accept";
    }
    if (action === "status") {
      log({ stage: state.stage, session: dir, system: P.system.id, component: P.component.id });
      return 0;
    }
    if (action === "read") {
      assert(state.stage === "ready", "accept the pending projection before reading");
      assert(state.native, "accept the first Figma projection before reading");
      log({
        program: writeProgram(bundle(), { action: "read" }),
        next: "Run this program in the named Figma file, save its JSON result, then use roundtrip review --snapshot.",
      });
      return 0;
    }
    if (action === "accept") {
      assert(state.stage === "awaiting-figma", "no pending Figma projection");
      assert(flags.snapshot, "--snapshot required");
      const native = snapshot(json(path.resolve(flags.snapshot))),
        B = bundle();
      for (const g of state.inputs) assert.equal(fileHash(g.file), g.sha256, "source changed since capture: " + g.file);
      const comparisons = verifyProjection(B, native),
        differences = comparisons.filter((c) => c.result === "differs");
      if (state.native) same(identity(native), identity(state.native), "native identity changed");
      state.native = native;
      state.policy = policy(P, B, native, state.root);
      state.stage = "ready";
      save(path.join(dir, "native.json"), native);
      save(path.join(dir, "comparison.json"), comparisons);
      saveState(stateFile, state);
      log({
        status: differences.length ? "synchronized-with-measurement-differences" : "synchronized",
        session: dir,
        component: B.root,
        native: native.parent.id,
        ...(differences.length
          ? {
              differences,
              note: "Intrinsic size differs between renderers. Values are reported as differences, not fidelity passes.",
            }
          : {}),
      });
      return 0;
    }
    if (action === "review") {
      assert(state.stage === "ready", "accept the pending projection first");
      assert(flags.snapshot, "--snapshot required");
      const native = snapshot(json(path.resolve(flags.snapshot))),
        plan = planWriteback(bundle(), state.native, native, state.policy);
      save(path.join(dir, "plan.json"), plan);
      if (!plan.edits.length) {
        log({ status: "unchanged", edits: [] });
        return 0;
      }
      state.reviewed = native;
      state.stage = "reviewed";
      saveState(stateFile, state);
      log({
        status: "review",
        edits: plan.edits,
        digest: plan.digest,
        next: "roundtrip apply --session " + dir + " --digest " + plan.digest,
      });
      return 0;
    }
    assert(
      action === "start" || state.stage === "ready" || (action === "apply" && state.stage === "reviewed"),
      "session is not ready for this action",
    );
    let rollback = new Map();
    let committed = false;
    const restore = () => {
      const failures = [];
      for (const [file, value] of rollback)
        try {
          if (value.after && existsSync(file) && hash(read(file)) === value.after) {
            if (value.before === null) unlinkSync(file);
            else writeFileSync(file, value.before);
          }
        } catch (restore) {
          failures.push(new Error(`rollback failed for ${file}: ${restore.message}`, { cause: restore }));
        }
      return failures;
    };
    onInterrupt = () => {
      if (committed) return;
      const failures = restore();
      if (failures.length) throw Error(failures.map((e) => e.message).join("; "));
    };
    try {
      for (const f of P.capture?.generated ?? []) {
        const file = path.resolve(state.root, f);
        rollback.set(file, { before: existsSync(file) ? read(file) : null });
      }
      if (action === "apply" || action === "refresh")
        for (const g of state.inputs ?? []) {
          if (action === "refresh" && Object.values(P.tokens).some((t) => path.resolve(state.root, t.file) === g.file))
            continue;
          assert.equal(fileHash(g.file), g.sha256, "captured input changed: " + g.file);
        }
      if (action === "apply") {
        assert(flags.digest, "--digest required");
        const plan = json(path.join(dir, "plan.json"));
        for (const f of plan.files.map((f) => f.file)) {
          const file = path.resolve(state.root, f);
          rollback.set(file, { before: read(file), after: plan.files.find((p) => p.file === f)?.afterSha256 });
        }
        applyWriteback(plan, state.policy, flags.digest);
        state.native = state.reviewed;
      }
      if (action === "refresh")
        for (const g of state.policy.inputs)
          assert.equal(fileHash(path.resolve(state.root, g.file)), g.sha256, "unowned source changed: " + g.file);
      const B = await captureSource(
        P,
        state.root,
        path.join(dir, "capture"),
        reader ?? (await import(new URL("./storybook-reader.js", import.meta.url).href)),
        {
          onGenerated: (file, sha256) => {
            if (rollback.has(file)) rollback.get(file).after = sha256;
          },
        },
      );
      if (action !== "start") {
        const before = bundle().components[B.root].appearance,
          after = B.components[B.root].appearance;
        same(before.axes, after.axes, "unsupported axes change");
        same(before.props, after.props, "unsupported props change");
        for (const v of before.variants)
          for (const [id, p] of Object.entries(before.parts))
            for (const [field, c] of Object.entries(values(p, v.axes))) {
              const next = values(after.parts[id], v.axes)[field];
              if (!c.token) same(c.value, next.value, "unsupported source style change: " + id + "." + field);
              same(c.token, next.token, "source binding changed");
            }
      }
      const program = path.join(dir, "figma.js");
      const programText = emitSystem(B, {
        ...target,
        action: state.native ? "patch" : "create",
        ...(state.native ? { expected: state.native } : {}),
      });
      state.inputs = json(path.join(dir, "capture", "source-inputs.json"));
      state.bundle = B;
      state.stage = "awaiting-figma";
      delete state.reviewed;
      saveState(stateFile, state);
      committed = true;
      save(path.join(dir, "bundle.json"), B);
      writeFileSync(program, programText);
      log({
        status: "awaiting-figma",
        program,
        session: dir,
        next: "roundtrip sync --session " + dir + "; then Connect and run in the named Figma file",
      });
      return 0;
    } catch (error) {
      if (committed) throw Error("session committed; retry sync to regenerate artifacts: " + error.message);
      const failures = restore();
      if (failures.length)
        throw new AggregateError(
          [error, ...failures],
          `${error.message}; ${failures.map((f) => f.message).join("; ")}`,
          {
            cause: error,
          },
        );
      throw error;
    }
  } finally {
    release();
  }
}
