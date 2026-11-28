import assert from "node:assert/strict";
import { tokenValue } from "./token-value.mjs";
import { writeFileSync, renameSync, unlinkSync, openSync, closeSync, statSync } from "node:fs";
import path from "node:path";
import { hash } from "./surface.mjs";
import { patchJSON, read } from "./model.mjs";
import { fail, equal, allowed, localFile, checkGuards } from "./plan.mjs";
export { planWriteback } from "./plan.mjs";

/** All checks and file preparation precede commits; only reviewed JSON values can be written. */
export function applyWriteback(plan, policy, expectedDigest) {
  const { digest, ...body } = plan;
  assert.equal(plan.version, 1);
  assert.equal(plan.system, policy.system);
  assert.equal(plan.policySha256, hash(policy), "ownership policy changed");
  assert.equal(digest, hash(body), "plan digest mismatch");
  assert.equal(digest, expectedDigest, "reviewed plan digest required");
  checkGuards(policy, plan.guards);
  const prepared = [];
  for (const f of plan.files) {
    const file = localFile(policy, f.file),
      before = read(file);
    if (hash(before) !== f.beforeSha256) fail("source-revision-conflict", f.file);
    let after = before;
    for (const e of plan.edits.filter((e) => e.file === f.file)) {
      if (!allowed(policy, e.file, e.path)) fail("unowned-token", e.id);
      if (typeof e.after !== "string") fail("unsupported-token-value", e.id);
      if (!/^\{[\w.-]+\}$/.test(e.after)) {
        const owner = policy.tokens.find((t) => t.file === e.file && JSON.stringify(t.path) === JSON.stringify(e.path));
        try {
          tokenValue(owner?.type ?? "color", e.after);
        } catch {
          fail("unsupported-token-value", e.id);
        }
      }
      after = patchJSON(after, e.path, e.before, e.after);
    }
    assert.equal(hash(after), f.afterSha256, "planned output differs");
    prepared.push({
      file,
      before,
      after,
      temp: file + ".ds-contracts-writeback",
    });
  }
  equal(
    [...new Set(plan.edits.map((e) => e.file))].sort(),
    plan.files.map((f) => f.file).sort(),
    "plan file inventory mismatch",
  );
  const committed = [];
  try {
    for (const p of prepared) {
      const fd = openSync(p.temp, "wx", statSync(p.file).mode);
      p.ownsTemp = true;
      try {
        writeFileSync(fd, p.after);
      } finally {
        closeSync(fd);
      }
    }
    checkGuards(policy, plan.guards);
    for (const p of prepared) {
      if (read(p.file) !== p.before) fail("source-revision-conflict", p.file);
      renameSync(p.temp, p.file);
      committed.push(p);
    }
  } catch (error) {
    const failures = [];
    for (const p of committed.reverse()) {
      try {
        if (read(p.file) === p.after) writeFileSync(p.file, p.before);
      } catch (rollback) {
        failures.push(
          new Error(`rollback failed for ${p.file}: ${rollback.message}`, {
            cause: rollback,
          }),
        );
      }
    }
    if (failures.length)
      throw new AggregateError([error, ...failures], `${error.message}; ${failures.map((f) => f.message).join("; ")}`, {
        cause: error,
      });
    throw error;
  } finally {
    for (const p of prepared)
      if (p.ownsTemp)
        try {
          unlinkSync(p.temp);
        } catch {}
  }
  return {
    status: plan.edits.length ? "applied" : "unchanged",
    digest,
    written: prepared.map((p) => path.relative(policy.root, p.file)),
    after: plan.files.map((f) => ({ file: f.file, sha256: f.afterSha256 })),
  };
}
