import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), "ds-figma-propose-atomic-"));

const variant = (name: string) => ({
  name,
  type: "COMPONENT",
  children: [],
});

const run = (dump: Record<string, unknown>, reviewable: boolean) => {
  const dumpPath = path.join(
    temp,
    reviewable ? "reviewable.json" : "exact.json",
  );
  const out = path.join(temp, reviewable ? "reviewable-out" : "exact-out");
  writeFileSync(dumpPath, `${JSON.stringify(dump)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "extract/figma/propose.ts",
      dumpPath,
      "--out",
      out,
      ...(reviewable ? ["--reviewable-inversion"] : []),
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  return { result, out };
};

try {
  const exact = run(
    {
      Good: {
        setName: "Good",
        type: "COMPONENT_SET",
        variants: [variant("Tone=Default")],
      },
    },
    false,
  );
  assert.notEqual(exact.result.status, 0);
  assert.match(
    `${exact.result.stdout}${exact.result.stderr}`,
    /structured propertyDefinitions/,
  );
  assert.equal(
    existsSync(exact.out),
    false,
    "strict refusal must create no output directory",
  );

  const partial = run(
    {
      Good: {
        setName: "Good",
        type: "COMPONENT_SET",
        variants: [variant("Tone=Default")],
      },
      Poisoned: {
        setName: "Poisoned",
        type: "COMPONENT_SET",
        variants: [],
      },
    },
    true,
  );
  assert.notEqual(partial.result.status, 0);
  assert.match(
    `${partial.result.stdout}${partial.result.stderr}`,
    /no proposal artifacts were written/,
  );
  assert.equal(
    existsSync(partial.out) ? readdirSync(partial.out).length : 0,
    0,
    "a late per-set refusal must leave no partial proposal artifacts",
  );

  console.log(
    "✔ Figma proposal CLI refuses legacy exactness and batch failures atomically before output",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
