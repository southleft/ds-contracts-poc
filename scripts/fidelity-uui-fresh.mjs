import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The Untitled UI fidelity gate. Recomputes renders/fidelity.json — the table
// behind the kit's headline canvas→code number — into a temp dir from the
// COMMITTED bytes (renders/*.png, references/*.png, dumps-v2, the geometry
// sidecar) via FIDELITY_RESCORE=committed, then byte-compares it against the
// committed copy and refuses on drift. The render step itself is NOT
// re-exercised here: a full render pass measures ~1.8 s/variant (~18 min over
// 599 references), so rendering is exercised by `npm run fidelity:uui` only;
// this gate proves the committed table is exactly re-derivable from the
// committed evidence, through the same scoring kernel, on any machine.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMITTED = path.join(ROOT, "examples", "untitled-ui", "renders");
const temp = mkdtempSync(path.join(tmpdir(), "ds-contracts-fidelity-uui-"));

try {
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", "examples/untitled-ui/fidelity-score.mts"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        FIDELITY_RESCORE: "committed",
        FIDELITY_RENDERS_DIR: temp,
      },
      encoding: "utf8",
    },
  );
  if (run.status !== 0) {
    process.stderr.write(run.stdout ?? "");
    process.stderr.write(run.stderr ?? "");
    process.exit(run.status ?? 1);
  }

  const stale = [];
  for (const file of ["fidelity.json"]) {
    const expected = readFileSync(path.join(COMMITTED, file));
    const actual = readFileSync(path.join(temp, file));
    if (!expected.equals(actual)) stale.push(file);
  }
  if (stale.length > 0) {
    console.error(
      `REFUSED: Untitled UI fidelity evidence is stale: ${stale.join(", ")}. ` +
        "The committed table no longer re-derives from the committed renders, references, " +
        "dumps, and geometry. Run `npm run fidelity:uui`, review the changed scores, and commit " +
        "renders/ — the accuracy ratchet (npm run accuracy:check) holds the per-set floors.",
    );
    process.exit(1);
  }
  console.log(
    "✔ Untitled UI fidelity.json is byte-identical to a clean re-derivation from committed bytes",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
