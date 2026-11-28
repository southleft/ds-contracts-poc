import { fileHash } from "./files.mjs";
import { readFileSync, writeFileSync, openSync, closeSync, renameSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { canonical, hash } from "./surface.mjs";

export const read = (p) => readFileSync(p, "utf8"),
  json = (p) => JSON.parse(read(p)),
  save = (p, v) => writeFileSync(p, canonical(v));
export function saveState(file, state) {
  const temporary = file + ".next";
  const fd = openSync(temporary, "wx", 0o600);
  let pending = true;
  try {
    try {
      writeFileSync(fd, canonical(state));
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, file);
    pending = false;
  } finally {
    if (pending && existsSync(temporary)) unlinkSync(temporary);
  }
}
export function policy(P, B, native, root) {
  const tokenFiles = new Set(Object.values(B.system.tokens).map((t) => t.source.file)),
    inputs = [
      P.source,
      P.story,
      P.stylesheet,
      ...Object.values(P.dependencies).map((d) => d.source),
      ...(P.capture.inputs ?? []),
    ].filter((file) => file && !tokenFiles.has(file));
  return {
    version: 1,
    system: B.system.id,
    root,
    contractSha256: hash(B),
    nativeBaselineSha256: hash(native),
    tokens: Object.values(B.system.tokens).map((t) => ({ id: t.id, file: t.source.file, path: t.source.path })),
    guards: [...new Set([...inputs, ...Object.values(B.system.tokens).map((t) => t.source.file)])],
    inputs: [...new Set(inputs)].map((file) => ({ file, sha256: fileHash(path.resolve(root, file)) })),
  };
}

export function acquireLock(file, onInterrupt = () => {}) {
  const fd = openSync(file, "wx");
  const stop = (code) => {
    try { onInterrupt(); } catch (error) { console.error(error.message); }
    process.exit(code);
  };
  const interrupt = () => stop(130), terminate = () => stop(143);
  let held = true;
  const release = () => {
    if (!held) return;
    held = false;
    process.off("exit", release);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    closeSync(fd);
    unlinkSync(file);
  };
  process.once("exit", release);
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  return release;
}
