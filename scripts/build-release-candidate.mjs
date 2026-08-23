#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "dist", "release-candidate");
const PACKAGES = [
  {
    directory: "packages/schema",
    expected: [
      "README.md",
      "contract.schema.json",
      "dist/contract-schema.d.ts",
      "dist/contract-schema.js",
      "dist/index.d.ts",
      "dist/index.js",
      "dist/validate.d.ts",
      "dist/validate.js",
      "package.json",
    ],
  },
  {
    directory: "packages/core",
    // Reviewed 2026-08-22 for slice 2 (anatomy / elements / grid / validate / css
    // joined the package — the analysis half of emit-react).
    expected: [
      "README.md",
      "dist/anatomy.d.ts",
      "dist/anatomy.js",
      "dist/contract-provenance.d.ts",
      "dist/contract-provenance.js",
      "dist/css.d.ts",
      "dist/css.js",
      "dist/elements.d.ts",
      "dist/elements.js",
      "dist/emitter.d.ts",
      "dist/emitter.js",
      "dist/grid.d.ts",
      "dist/grid.js",
      "dist/index.d.ts",
      "dist/index.js",
      "dist/naming.d.ts",
      "dist/naming.js",
      "dist/tokens.d.ts",
      "dist/tokens.js",
      "dist/validate.d.ts",
      "dist/validate.js",
      "package.json",
    ],
  },
  {
    directory: "packages/cli",
    expected: ["README.md", "dist/cli.js", "dist/computed.js", "package.json"],
  },
  {
    directory: "packages/emitter-web-components",
    expected: ["README.md", "dist/index.d.ts", "dist/index.js", "package.json"],
  },
];

const GATES = [
  {
    name: "build-schema",
    command: ["npm", "--prefix", "packages/schema", "run", "build"],
  },
  {
    name: "build-core",
    command: ["npm", "--prefix", "packages/core", "run", "build"],
  },
  {
    name: "test-v1-definition",
    command: ["npm", "run", "test:v1-definition"],
  },
  {
    name: "v1-definition",
    command: ["npm", "run", "v1:definition:check"],
  },
  { name: "typecheck-root", command: ["npm", "run", "typecheck"] },
  {
    name: "typecheck-github-scripts",
    command: ["npx", "tsc", "--noEmit", "-p", ".github/scripts/tsconfig.json"],
  },
  {
    name: "typecheck-cli",
    command: ["npm", "--prefix", "packages/cli", "run", "typecheck"],
  },
  {
    name: "typecheck-schema",
    command: ["npm", "--prefix", "packages/schema", "run", "typecheck"],
  },
  {
    name: "typecheck-core",
    command: ["npm", "--prefix", "packages/core", "run", "typecheck"],
  },
  {
    name: "typecheck-emitter",
    command: [
      "npm",
      "--prefix",
      "packages/emitter-web-components",
      "run",
      "typecheck",
    ],
  },
  {
    name: "typecheck-worker",
    command: ["npm", "--prefix", "workers/assist", "run", "typecheck"],
  },
  {
    name: "typecheck-playground",
    command: ["npm", "run", "typecheck:playground"],
  },
  {
    name: "typecheck-dashboard",
    command: ["npm", "run", "typecheck:dashboard"],
  },
  { name: "typecheck-site", command: ["npm", "run", "typecheck:site"] },
  {
    name: "test-cli",
    command: ["npm", "--prefix", "packages/cli", "run", "test"],
  },
  {
    name: "test-worker",
    command: ["npm", "--prefix", "workers/assist", "run", "test"],
  },
  { name: "test-playground", command: ["npm", "run", "test:playground"] },
  {
    name: "generation-atomic",
    command: ["npm", "run", "generation:atomic:check"],
  },
  {
    name: "contract-provenance",
    command: ["npm", "run", "provenance:check"],
  },
  {
    name: "static-empty-content",
    command: ["npm", "run", "static:empty-content:check"],
  },
  {
    name: "parity-variant-drift",
    command: ["npm", "run", "variant-drift:check"],
  },
  {
    name: "parity-snapshot-schema",
    command: ["npm", "run", "snapshot:schema:check"],
  },
  {
    name: "parity-token-snapshot",
    command: ["npm", "run", "tokens:snapshot:check"],
  },
  {
    name: "audit-production",
    command: ["npm", "run", "audit:production"],
  },
  {
    name: "audit-all-dependencies",
    command: ["npm", "run", "audit:dependencies"],
  },
  {
    name: "build-cli",
    command: ["npm", "--prefix", "packages/cli", "run", "build"],
  },
  {
    name: "build-emitter",
    command: [
      "npm",
      "--prefix",
      "packages/emitter-web-components",
      "run",
      "build",
    ],
  },
];

function refuse(message) {
  throw new Error(`REFUSED: ${message}`);
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function parseArguments() {
  const args = process.argv.slice(2);
  let output = DEFAULT_OUTPUT;
  let check = false;
  let selfTest = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--check") {
      check = true;
    } else if (argument === "--self-test") {
      selfTest = true;
    } else if (argument === "--output") {
      const value = args[index + 1];
      if (!value) refuse("--output requires a directory.");
      output = path.resolve(ROOT, value);
      index += 1;
    } else {
      refuse(`unknown argument ${JSON.stringify(argument)}.`);
    }
  }
  return { check, output, selfTest };
}

function assertCleanCheckout() {
  const dirty = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (dirty) {
    refuse(
      `release candidates require a clean checkout; found:\n${dirty
        .split("\n")
        .slice(0, 20)
        .map((line) => `  ${line}`)
        .join("\n")}`,
    );
  }
}

function assertIgnoredOutput(output) {
  const relative = path.relative(ROOT, output);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    refuse("output must be a directory inside the repository.");
  }
  const probe = path
    .join(relative, ".release-candidate-output")
    .split(path.sep)
    .join("/");
  const result = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--no-index", probe],
    {
      cwd: ROOT,
      stdio: "ignore",
    },
  );
  if (result.status !== 0) {
    refuse(`output directory ${relative} is not ignored by git.`);
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function packageMetadata() {
  return PACKAGES.map(({ directory }) => {
    const manifest = readJson(path.join(ROOT, directory, "package.json"));
    if (
      typeof manifest.name !== "string" ||
      typeof manifest.version !== "string"
    ) {
      refuse(`${directory}/package.json has no string name/version.`);
    }
    return { directory, name: manifest.name, version: manifest.version };
  });
}

function validateSourcePackageFiles() {
  for (const pkg of PACKAGES) {
    for (const expected of pkg.expected.filter(
      (file) => !file.startsWith("dist/"),
    )) {
      const absolute = path.join(ROOT, pkg.directory, expected);
      if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
        refuse(
          `${pkg.directory} is missing expected package source ${expected}.`,
        );
      }
    }
  }
}

function validateGateConfiguration() {
  const names = new Set();
  for (const gate of GATES) {
    if (names.has(gate.name)) refuse(`duplicate gate name ${gate.name}.`);
    names.add(gate.name);
    if (gate.command[0] !== "npm") continue;

    const prefixIndex = gate.command.indexOf("--prefix");
    const directory =
      prefixIndex === -1
        ? ROOT
        : path.join(ROOT, gate.command[prefixIndex + 1]);
    const runIndex = gate.command.indexOf("run");
    const script = gate.command[runIndex + 1];
    const manifestPath = path.join(directory, "package.json");
    if (
      runIndex === -1 ||
      !script ||
      !existsSync(manifestPath) ||
      !readJson(manifestPath).scripts?.[script]
    ) {
      refuse(`${gate.name} does not resolve to an existing npm script.`);
    }
  }
}

function runGate(gate) {
  const [file, ...args] = gate.command;
  console.log(`\n━━ ${gate.name}: ${gate.command.join(" ")}`);
  const result = spawnSync(file, args, {
    cwd: ROOT,
    env: { ...process.env, CI: "true" },
    stdio: "inherit",
  });
  const status =
    result.error || result.status !== 0 || result.signal ? "failed" : "passed";
  return {
    name: gate.name,
    command: gate.command,
    status,
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message,
  };
}

function listFiles(root, relative = "") {
  const files = [];
  for (const entry of readdirSync(path.join(root, relative), {
    withFileTypes: true,
  }).sort((a, b) => a.name.localeCompare(b.name))) {
    const nested = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, nested));
    } else if (entry.isFile() && lstatSync(path.join(root, nested)).isFile()) {
      files.push(nested.split(path.sep).join("/"));
    } else {
      refuse(`packed entry ${nested} is not a regular file.`);
    }
  }
  return files;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function safePackFilename(output) {
  let result;
  try {
    result = JSON.parse(output);
  } catch {
    refuse("npm pack did not return JSON.");
  }
  const record = result?.[0];
  const filename = record?.filename;
  if (
    typeof filename !== "string" ||
    filename !== path.basename(filename) ||
    !filename.endsWith(".tgz")
  ) {
    refuse("npm pack did not return a safe tarball filename.");
  }
  if (
    !Array.isArray(record.files) ||
    record.files.some(
      (file) =>
        !file || typeof file !== "object" || typeof file.path !== "string",
    )
  ) {
    refuse("npm pack JSON did not contain a complete file list.");
  }
  return {
    filename,
    files: record.files.map(({ path: file }) => file).sort(),
  };
}

function assertExactFileSet(label, actualFiles, expectedFiles) {
  const actual = [...new Set(actualFiles)].sort();
  const expected = [...new Set(expectedFiles)].sort();
  const missing = expected.filter((file) => !actual.includes(file));
  const extra = actual.filter((file) => !expected.includes(file));
  if (missing.length || extra.length) {
    refuse(
      `${label} file set differs from the reviewed allowlist` +
        `${missing.length ? `; missing: ${missing.join(", ")}` : ""}` +
        `${extra.length ? `; extra: ${extra.join(", ")}` : ""}.`,
    );
  }
}

function runFileSetSelfTest() {
  const expected = ["README.md", "dist/index.js", "package.json"];
  assertExactFileSet("baseline fixture", [...expected], expected);
  for (const extra of [
    ".env.production",
    "coverage/coverage-final.json",
    "dist/index.js.map",
  ]) {
    let refused = false;
    try {
      assertExactFileSet("extra-file fixture", [...expected, extra], expected);
    } catch (error) {
      refused =
        error instanceof Error &&
        error.message.includes("extra:") &&
        error.message.includes(extra);
    }
    if (!refused) throw new Error(`extra-file fixture was accepted: ${extra}`);
  }
  console.log(
    "✔ RC allowlist self-test: credential, coverage, and source-map extras all refused",
  );
}

function packPackage(pkg, destination) {
  const first = path.join(destination, "first");
  const second = path.join(destination, "second");
  mkdirSync(first, { recursive: true });
  mkdirSync(second, { recursive: true });

  const pack = (target) =>
    safePackFilename(
      execFileSync(
        "npm",
        ["pack", "--json", "--pack-destination", target, `./${pkg.directory}`],
        {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    );
  const packedFirst = pack(first);
  const packedSecond = pack(second);
  if (packedFirst.filename !== packedSecond.filename) {
    refuse(`${pkg.name} produced different filenames across two npm packs.`);
  }
  const expected = PACKAGES.find(
    ({ directory }) => directory === pkg.directory,
  ).expected;
  assertExactFileSet(
    `${pkg.name} first npm pack manifest`,
    packedFirst.files,
    expected,
  );
  assertExactFileSet(
    `${pkg.name} second npm pack manifest`,
    packedSecond.files,
    expected,
  );

  const archive = path.join(first, packedFirst.filename);
  const repeatedArchive = path.join(second, packedSecond.filename);
  const digest = sha256(archive);
  if (digest !== sha256(repeatedArchive)) {
    refuse(`${pkg.name}@${pkg.version} npm pack output is not deterministic.`);
  }

  const extract = path.join(destination, "extract");
  mkdirSync(extract);
  execFileSync("tar", ["xzf", archive, "-C", extract], { stdio: "ignore" });
  const packageRoot = path.join(extract, "package");
  if (!existsSync(packageRoot))
    refuse(`${pkg.name} tarball has no package root.`);
  const actual = listFiles(packageRoot);
  assertExactFileSet(`${pkg.name} extracted tarball`, actual, expected);

  const finalArchive = path.join(
    path.dirname(path.dirname(destination)),
    packedFirst.filename,
  );
  writeFileSync(finalArchive, readFileSync(archive), { flag: "wx" });
  return {
    package: pkg.name,
    version: pkg.version,
    filename: path.basename(finalArchive),
    sha256: digest,
    size: lstatSync(finalArchive).size,
    files: actual,
  };
}

function npmVersion() {
  return execFileSync("npm", ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

function main() {
  const { check, output, selfTest } = parseArguments();
  if (selfTest) {
    runFileSetSelfTest();
    return;
  }
  assertIgnoredOutput(output);
  assertCleanCheckout();
  validateSourcePackageFiles();
  validateGateConfiguration();
  const packages = packageMetadata();

  if (check) {
    console.log(
      `✔ RC configuration valid: ${GATES.length} ordered gates, ${packages.length} packages, ignored output ${path.relative(ROOT, output)}.`,
    );
    return;
  }

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const gateResults = GATES.map(runGate);
  const failedGates = gateResults.filter(({ status }) => status !== "passed");

  const trackedChanges = runGit([
    "status",
    "--porcelain=v1",
    "--untracked-files=no",
  ]);
  if (trackedChanges) {
    failedGates.push({
      name: "clean-after-build",
      command: ["git", "status", "--porcelain=v1", "--untracked-files=no"],
      status: "failed",
      exitCode: 1,
      signal: null,
      error: `tracked files changed:\n${trackedChanges}`,
    });
    gateResults.push(failedGates.at(-1));
  } else {
    gateResults.push({
      name: "clean-after-build",
      command: ["git", "status", "--porcelain=v1", "--untracked-files=no"],
      status: "passed",
      exitCode: 0,
      signal: null,
    });
  }

  if (failedGates.length) {
    writeJson(path.join(output, "provenance.json"), {
      schemaVersion: 1,
      commit: runGit(["rev-parse", "HEAD"]),
      node: process.version,
      npm: npmVersion(),
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        runner: process.env.RUNNER_OS ?? null,
      },
      packages,
      gates: gateResults,
      result: "failed",
    });
    refuse(
      `${failedGates.length} release-candidate gate(s) failed: ${failedGates
        .map(({ name }) => name)
        .join(", ")}. See provenance.json.`,
    );
  }

  const scratch = path.join(output, ".pack");
  mkdirSync(scratch);
  let artifacts;
  try {
    artifacts = packages
      .map((pkg) =>
        packPackage(pkg, path.join(scratch, pkg.name.replaceAll("/", "-"))),
      )
      .sort((a, b) => a.filename.localeCompare(b.filename));
    gateResults.push({
      name: "package-release-artifacts",
      command: ["npm", "pack", "<three publishable workspaces>"],
      status: "passed",
      exitCode: 0,
      signal: null,
    });
  } catch (error) {
    gateResults.push({
      name: "package-release-artifacts",
      command: ["npm", "pack", "<three publishable workspaces>"],
      status: "failed",
      exitCode: 1,
      signal: null,
      error: error instanceof Error ? error.message : String(error),
    });
    writeJson(path.join(output, "provenance.json"), {
      schemaVersion: 1,
      commit: runGit(["rev-parse", "HEAD"]),
      node: process.version,
      npm: npmVersion(),
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        runner: process.env.RUNNER_OS ?? null,
      },
      packages,
      gates: gateResults,
      result: "failed",
    });
    throw error;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  const manifest = {
    algorithm: "sha256",
    artifacts: artifacts.map(({ filename, sha256, size }) => ({
      filename,
      sha256,
      size,
    })),
  };
  writeJson(path.join(output, "manifest.json"), manifest);
  writeFileSync(
    path.join(output, "SHA256SUMS"),
    `${artifacts.map(({ sha256, filename }) => `${sha256}  ${filename}`).join("\n")}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  writeJson(path.join(output, "provenance.json"), {
    schemaVersion: 1,
    commit: runGit(["rev-parse", "HEAD"]),
    node: process.version,
    npm: npmVersion(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      runner: process.env.RUNNER_OS ?? null,
    },
    packages,
    gates: gateResults,
    result: "passed",
  });

  console.log(
    `\n✔ release candidate built in ${path.relative(ROOT, output)} (${artifacts.length} deterministic tarballs).`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
