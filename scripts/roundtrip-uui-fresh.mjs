import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMITTED = path.join(ROOT, "extract", "figma", "roundtrip-uui");
const temp = mkdtempSync(path.join(tmpdir(), "ds-contracts-roundtrip-uui-"));

try {
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", "extract/figma/roundtrip-uui/run.ts"],
    {
      cwd: ROOT,
      env: { ...process.env, ROUNDTRIP_UUI_OUT_DIR: temp },
      encoding: "utf8",
    },
  );
  if (run.status !== 0) {
    process.stderr.write(run.stdout ?? "");
    process.stderr.write(run.stderr ?? "");
    process.exit(run.status ?? 1);
  }

  const stale = [];
  for (const file of ["REPORT.md", "report.json"]) {
    const expected = readFileSync(path.join(COMMITTED, file));
    const actual = readFileSync(path.join(temp, file));
    if (!expected.equals(actual)) stale.push(file);
  }
  if (stale.length > 0) {
    console.error(
      `REFUSED: Untitled UI round-trip evidence is stale: ${stale.join(", ")}. ` +
        "Run `npm run extract:figma:roundtrip:uui`, review the changed evidence, and commit it.",
    );
    process.exit(1);
  }
  console.log(
    "✔ Untitled UI round-trip REPORT.md and report.json are byte-identical to a clean regeneration",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
