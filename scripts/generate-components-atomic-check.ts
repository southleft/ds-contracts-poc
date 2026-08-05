import assert from "node:assert/strict";
import {
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
import {
  ContractViolationError,
  generateComponents,
} from "./generate-components.js";

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

  await assert.rejects(
    generateComponents({
      contractFiles: [earlyContract, lateContract],
      tokenFiles,
      iconsDir: path.join(root, "assets/icons"),
      outDir: seededOut,
    }),
    (error) =>
      error instanceof ContractViolationError &&
      error.violations.some((violation) =>
        violation.includes("{color.atomic-check.missing}"),
      ),
  );
  assert.equal(
    snapshotTree(seededOut),
    before,
    "a late invalid contract must leave the pre-seeded output byte-identical",
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
    ],
  );
  assert.equal(
    readFileSync(path.join(successOut, "index.ts"), "utf8"),
    "export * from './Button';\n",
  );

  console.log(
    "✔ atomic refusal leaves a pre-seeded output directory byte-identical",
  );
  console.log(
    "✔ successful generation writes the complete expected component file set",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
