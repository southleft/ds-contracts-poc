import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const negativeControlNames = [
  "missing-css",
  "missing-theme",
  "missing-font",
  "missing-root",
  "hidden-root",
] as const;
export const negativeCaseIds = [
  "button-default",
  "checkbox-unchecked",
  "card-composed",
] as const;
export function completeNegativeControls(
  rows: {
    id: string;
    negativeControls?: { name: string; rejected: boolean }[];
  }[],
) {
  return negativeCaseIds.every((id) => {
    const matches = rows.filter((row) => row.id === id);
    const controls = matches[0]?.negativeControls;
    return (
      matches.length === 1 &&
      controls?.length === negativeControlNames.length &&
      negativeControlNames.every(
        (name) =>
          controls.filter((c) => c.name === name && c.rejected).length === 1,
      )
    );
  });
}
export const evidenceSha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
/** Paths are produced by our own runner, never supplied in a browser request. */
export function inventoryEvidence(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile())
        files[path.relative(root, file)] = evidenceSha(readFileSync(file));
      else throw Error("unexpected-evidence-entry");
    }
  };
  visit(root);
  return Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
  );
}
export function evidenceUnchanged(root: string, files: Record<string, string>) {
  try {
    return JSON.stringify(inventoryEvidence(root)) === JSON.stringify(files);
  } catch {
    return false;
  }
}
