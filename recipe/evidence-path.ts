import { readFileSync } from "node:fs";
import path from "node:path";

export const REPOSITORY_ROOT = path.resolve(
  new URL("..", import.meta.url).pathname,
);

export function resolveRepositoryEvidencePath(file: string): string {
  if (typeof file !== "string" || file.length === 0 || path.isAbsolute(file)) {
    throw new TypeError(`evidence path must be repository-relative: ${file}`);
  }
  const resolved = path.resolve(REPOSITORY_ROOT, file);
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".."
  ) {
    throw new TypeError(`evidence path escapes repository: ${file}`);
  }
  return resolved;
}

export const readRepositoryEvidence = (file: string): Buffer =>
  readFileSync(resolveRepositoryEvidencePath(file));

export const readRepositoryJson = <Value = unknown>(file: string): Value =>
  JSON.parse(readRepositoryEvidence(file).toString("utf8")) as Value;
