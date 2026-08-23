import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateComponents } from "./generate-components.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenFiles = [
  "tokens/primitives.tokens.json",
  "tokens/semantic.tokens.json",
  "tokens/modes/semantic.light.tokens.json",
  "tokens/modes/semantic.dark.tokens.json",
].map((file) => path.join(root, file));

function snapshotTree(dir: string): string {
  const entries: string[] = [];
  const visit = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const relative = path.relative(dir, absolute);
      if (statSync(absolute).isDirectory()) {
        entries.push(`dir:${relative}`);
        visit(absolute);
      } else {
        entries.push(
          `file:${relative}:${readFileSync(absolute).toString("base64")}`,
        );
      }
    }
  };
  visit(dir);
  return entries.join("\n");
}

const temp = mkdtempSync(path.join(os.tmpdir(), "generate-components-atomic-"));
try {
  const contractsDir = path.join(temp, "contracts");
  const seededOut = path.join(temp, "seeded-output");
  const successOut = path.join(temp, "success-output");
  mkdirSync(contractsDir);
  mkdirSync(path.join(seededOut, "Button"), { recursive: true });

  const button = readFileSync(
    path.join(root, "contracts/button.contract.json"),
    "utf8",
  );
  const invalidHeading = JSON.parse(
    readFileSync(path.join(root, "contracts/heading.contract.json"), "utf8"),
  ) as {
    anatomy: { root: { tokens: Record<string, string> } };
  };
  invalidHeading.anatomy.root.tokens.color = "{color.atomic-check.missing}";

  const earlyContract = path.join(
    contractsDir,
    "01-valid-button.contract.json",
  );
  const lateContract = path.join(
    contractsDir,
    "99-invalid-heading.contract.json",
  );
  writeFileSync(earlyContract, button);
  writeFileSync(lateContract, `${JSON.stringify(invalidHeading, null, 2)}\n`);

  writeFileSync(path.join(seededOut, "keep.txt"), Buffer.from([0, 1, 2, 255]));
  writeFileSync(
    path.join(seededOut, "Button", "Button.tsx"),
    "pre-seeded component\n",
  );
  const before = snapshotTree(seededOut);

  // ATOMIC PER CONTRACT (phase-2 exam): the late invalid Heading is refused
  // BY NAME and leaves no file; the valid Button is generated beside the
  // pre-seeded files, which stay byte-identical.
  const mixed = await generateComponents({
    contractFiles: [earlyContract, lateContract],
    tokenFiles,
    iconsDir: path.join(root, "assets/icons"),
    outDir: seededOut,
  });
  assert.deepEqual(mixed.generated, ["Button"]);
  assert.deepEqual(
    mixed.refused.map((r) => r.id),
    ["ds.heading"],
    "the invalid contract is refused by name",
  );
  assert.ok(
    mixed.refused[0].violations.some((violation) =>
      violation.includes("{color.atomic-check.missing}"),
    ),
  );
  assert.equal(
    existsSync(path.join(seededOut, "Heading")),
    false,
    "a refused contract leaves NO file (no partial Heading/)",
  );
  const after = snapshotTree(seededOut)
    .split("\n")
    .filter((entry) => !entry.startsWith("file:Button/") && !/^file:(index\.ts|tokens\.css):/.test(entry));
  assert.deepEqual(
    after,
    before.split("\n").filter((entry) => !entry.startsWith("file:Button/")),
    "the pre-seeded files a refusal does not own stay byte-identical",
  );
  assert.notEqual(
    readFileSync(path.join(seededOut, "Button", "Button.tsx"), "utf8"),
    "pre-seeded component\n",
    "the valid contract IS generated over its stale pre-seed",
  );

  // Batch-level failures still throw and write nothing: a token file that
  // does not exist is not one contract's fault.
  const untouchedOut = path.join(temp, "untouched-output");
  mkdirSync(untouchedOut);
  writeFileSync(path.join(untouchedOut, "keep.txt"), "keep\n");
  const untouchedBefore = snapshotTree(untouchedOut);
  await assert.rejects(
    generateComponents({
      contractFiles: [earlyContract],
      tokenFiles: [...tokenFiles, path.join(temp, "missing.tokens.json")],
      iconsDir: path.join(root, "assets/icons"),
      outDir: untouchedOut,
    }),
  );
  assert.equal(
    snapshotTree(untouchedOut),
    untouchedBefore,
    "a batch-level failure leaves the output byte-identical",
  );

  const result = await generateComponents({
    contractFiles: [earlyContract],
    tokenFiles,
    iconsDir: path.join(root, "assets/icons"),
    outDir: successOut,
  });
  assert.deepEqual(result.generated, ["Button"]);
  assert.deepEqual(
    snapshotTree(successOut)
      .split("\n")
      .map((entry) => entry.split(":", 2).join(":")),
    [
      "dir:Button",
      "file:Button/Button.module.css",
      "file:Button/Button.stories.tsx",
      "file:Button/Button.tsx",
      "file:Button/index.ts",
      "file:index.ts",
      "file:tokens.css",
    ],
  );
  assert.equal(
    readFileSync(path.join(successOut, "index.ts"), "utf8"),
    "import './tokens.css';\nexport * from './Button';\n",
  );

  console.log(
    "✔ per-contract refusal: the invalid contract is named and leaves no file; the valid one generates; foreign pre-seeded files stay byte-identical",
  );
  console.log(
    "✔ batch-level failure (missing token file) leaves the output byte-identical",
  );
  console.log(
    "✔ successful generation writes the complete expected component file set",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
