/**
 * PUBLISHED-PACKAGE FRESHNESS — `npm run publish:check`.
 *
 * WHY THIS EXISTS. On 2026-08-03 a 332-line rewrite of `onboard` landed in
 * this tree — the review gate that had never printed, the phase-2 runner that
 * could never resolve, the host-repo extraction guard — under the SAME version
 * the registry already served. Every doc's first runnable command is
 * `npm i -g @ds-contracts/cli`, so an adopter following the README got the
 * pre-fix build while this repo's gates were green on the fixed one. Same
 * shape as the deployment incident the week before: the BUILD was fresh, the
 * DISTRIBUTED ARTIFACT was not, and nothing compared them.
 *
 * WHAT IT CHECKS — each publishable workspace's locally packed files against
 * the bytes the registry serves for that workspace's package.json version:
 *   · version NOT published yet  → PASS, and says so (a pending release is a
 *     normal state; it is only a defect when the docs point at the old one)
 *   · version published, every packed file byte-identical → PASS
 *   · version published, any file missing/extra/different → REFUSE. The tree
 *     has moved without a version bump, so npm serves content this repo does
 *     not test.
 *
 * Needs network (registry read only — it never publishes; that requires the
 * owner's OTP and is deliberately a human act).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PACKAGES = [
  "packages/cli",
  "packages/schema",
  "packages/emitter-web-components",
];
const sha = (b) => createHash("sha256").update(b).digest("hex");
const MAX_TARBALL_BYTES = 50 * 1024 * 1024;

export async function downloadAndExtractTarball(
  tarballUrl,
  destination,
  fetchImpl = globalThis.fetch,
) {
  const requestedUrl = new URL(tarballUrl);
  if (requestedUrl.protocol !== "https:") {
    throw new Error(
      `REFUSED: registry tarball URL must use HTTPS, got ${requestedUrl.protocol}`,
    );
  }

  const response = await fetchImpl(requestedUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `REFUSED: registry tarball download returned HTTP ${response.status}.`,
    );
  }
  if (response.url && new URL(response.url).protocol !== "https:") {
    throw new Error("REFUSED: registry tarball redirected to a non-HTTPS URL.");
  }

  const tarball = Buffer.from(await response.arrayBuffer());
  if (tarball.length > MAX_TARBALL_BYTES) {
    throw new Error(
      `REFUSED: registry tarball is ${tarball.length} bytes (limit ${MAX_TARBALL_BYTES}).`,
    );
  }

  const archive = path.join(destination, "package.tgz");
  writeFileSync(archive, tarball, { flag: "wx" });
  // The registry controls tarballUrl, but it never reaches a shell. `tar` gets
  // fixed argv entries and reads only the local path we created above.
  execFileSync("tar", ["xzf", archive, "-C", destination], { stdio: "ignore" });
}

function collectPackedFiles(root, relative = "") {
  const files = new Map();
  for (const entry of readdirSync(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      for (const [nested, bytes] of collectPackedFiles(root, file)) {
        files.set(nested, bytes);
      }
      continue;
    }
    const absolute = path.join(root, file);
    if (!entry.isFile() || !lstatSync(absolute).isFile()) {
      throw new Error(`REFUSED: packed entry ${file} is not a regular file.`);
    }
    files.set(file.split(path.sep).join("/"), readFileSync(absolute));
  }
  return files;
}

export function comparePackedTrees(localRoot, registryRoot) {
  const local = collectPackedFiles(localRoot);
  const registry = collectPackedFiles(registryRoot);
  const missing = [...local.keys()].filter((file) => !registry.has(file));
  const extra = [...registry.keys()].filter((file) => !local.has(file));
  const different = [...local.keys()].filter(
    (file) => registry.has(file) && !local.get(file).equals(registry.get(file)),
  );
  return {
    local,
    registry,
    missing: missing.sort(),
    extra: extra.sort(),
    different: different.sort(),
  };
}

function summarizeFiles(label, files) {
  if (files.length === 0) return null;
  const shown = files.slice(0, 5).join(", ");
  const remainder = files.length > 5 ? ` (+${files.length - 5} more)` : "";
  return `    ${label}: ${shown}${remainder}`;
}

function assertPackedTreesMatch(name, version, localRoot, registryRoot) {
  const result = comparePackedTrees(localRoot, registryRoot);
  const { missing, extra, different } = result;
  if (missing.length || extra.length || different.length) {
    const details = [
      summarizeFiles("registry missing", missing),
      summarizeFiles("registry extra", extra),
      summarizeFiles("bytes differ", different),
    ].filter(Boolean);
    throw new Error(
      `REFUSED: ${name}@${version} registry contents differ ` +
        `(${missing.length} missing, ${extra.length} extra, ${different.length} different).\n` +
        details.join("\n"),
    );
  }
  return result;
}

function packLocalPackage(packageDir, destination) {
  const output = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", destination, packageDir],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const packed = JSON.parse(output);
  const filename = packed?.[0]?.filename;
  if (
    typeof filename !== "string" ||
    filename !== path.basename(filename) ||
    !filename.endsWith(".tgz")
  ) {
    throw new Error(
      "REFUSED: npm pack did not return a safe tarball filename.",
    );
  }
  const archive = path.join(destination, filename);
  const extractRoot = path.join(destination, "local");
  mkdirSync(extractRoot);
  execFileSync("tar", ["xzf", archive, "-C", extractRoot], { stdio: "ignore" });
  return path.join(extractRoot, "package");
}

function registryMetadata(name, version) {
  try {
    return JSON.parse(
      execFileSync("npm", ["view", `${name}@${version}`, "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : "";
    if (/\bE404\b|404 Not Found/i.test(stderr)) return null;
    throw new Error(
      `REFUSED: npm registry lookup failed for ${name}@${version}` +
        (stderr ? `: ${stderr.trim().split("\n").at(-1)}` : "."),
    );
  }
}

async function falsifyShellInjection() {
  const tmp = mkdtempSync(path.join(tmpdir(), "dsc-pub-injection-"));
  const fixtureRoot = path.join(tmp, "fixture");
  const extractRoot = path.join(tmp, "extract");
  const marker = path.join(tmp, "SHELL_EXECUTED");
  const fixtureTarball = path.join(tmp, "fixture.tgz");

  try {
    mkdirSync(path.join(fixtureRoot, "package", "dist"), { recursive: true });
    mkdirSync(extractRoot);
    writeFileSync(
      path.join(fixtureRoot, "package", "dist", "cli.js"),
      "safe fixture\n",
    );
    execFileSync("tar", ["czf", fixtureTarball, "-C", fixtureRoot, "package"], {
      stdio: "ignore",
    });
    const fixtureBytes = readFileSync(fixtureTarball);
    const hostileUrl = `https://registry.example/package.tgz"; touch "${marker}"; #`;

    await downloadAndExtractTarball(hostileUrl, extractRoot, async () => ({
      ok: true,
      status: 200,
      url: "https://registry.example/package.tgz",
      arrayBuffer: async () =>
        fixtureBytes.buffer.slice(
          fixtureBytes.byteOffset,
          fixtureBytes.byteOffset + fixtureBytes.byteLength,
        ),
    }));

    if (existsSync(marker)) throw new Error(`shell payload created ${marker}`);
    if (!existsSync(path.join(extractRoot, "package", "dist", "cli.js"))) {
      throw new Error("safe argv extraction did not produce the fixture");
    }
    console.log(
      "  ✔ hostile registry URL remained data; no shell syntax executed.",
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function falsifyFileComparison() {
  const tmp = mkdtempSync(path.join(tmpdir(), "dsc-pub-files-"));
  const local = path.join(tmp, "local");
  const registry = path.join(tmp, "registry");
  try {
    mkdirSync(local);
    mkdirSync(registry);
    writeFileSync(path.join(local, "same.txt"), "same\n");
    writeFileSync(path.join(registry, "same.txt"), "same\n");
    writeFileSync(path.join(local, "missing.txt"), "local only\n");
    writeFileSync(path.join(registry, "extra.txt"), "registry only\n");
    writeFileSync(path.join(local, "different.txt"), "local bytes\n");
    writeFileSync(path.join(registry, "different.txt"), "registry bytes\n");

    const { missing, extra, different } = comparePackedTrees(local, registry);
    if (
      missing.join() !== "missing.txt" ||
      extra.join() !== "extra.txt" ||
      different.join() !== "different.txt"
    ) {
      throw new Error(
        `file comparison did not classify drift correctly: ${JSON.stringify({
          missing,
          extra,
          different,
        })}`,
      );
    }
    console.log(
      "  ✔ packed-file comparison caught missing, extra, and different bytes.",
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function checkPackage(packagePath) {
  const packageDir = path.join(ROOT, packagePath);
  const pkg = JSON.parse(
    readFileSync(path.join(packageDir, "package.json"), "utf8"),
  );
  const { name, version } = pkg;
  const dist = path.join(packageDir, "dist");
  if (!existsSync(dist)) {
    throw new Error(
      `REFUSED: ${packagePath}/dist is not built — build all three packages before publish:check.`,
    );
  }

  const published = registryMetadata(name, version);
  if (!published) {
    console.log(
      `  ✔ SOURCE AHEAD — ${name}@${version} is not published; registry byte comparison skipped.`,
    );
    return;
  }

  const tarballUrl = published?.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(
      `REFUSED: registry returned no tarball URL for ${name}@${version}.`,
    );
  }

  const tmp = mkdtempSync(path.join(tmpdir(), "dsc-pub-"));
  try {
    const localRoot = packLocalPackage(packageDir, tmp);
    const registryExtract = path.join(tmp, "registry");
    mkdirSync(registryExtract);
    await downloadAndExtractTarball(tarballUrl, registryExtract);
    const registryRoot = path.join(registryExtract, "package");
    if (!existsSync(registryRoot)) {
      throw new Error(
        `REFUSED: ${name}@${version} tarball has no package root.`,
      );
    }
    const result = assertPackedTreesMatch(
      name,
      version,
      localRoot,
      registryRoot,
    );
    const bytes = [...result.local.values()].reduce(
      (sum, file) => sum + file.length,
      0,
    );
    const digest = sha(
      Buffer.concat(
        [...result.local.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .flatMap(([file, contents]) => [Buffer.from(file), contents]),
      ),
    );
    console.log(
      `  ✔ ${name}@${version}: ${result.local.size} packed files match byte-for-byte ` +
        `(${bytes} bytes, tree sha ${digest.slice(0, 12)}…).`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.includes("--falsify-injection")) {
    await falsifyShellInjection();
    return;
  }
  if (process.argv.includes("--falsify-files")) {
    falsifyFileComparison();
    return;
  }

  const failures = [];
  for (const packagePath of PACKAGES) {
    try {
      await checkPackage(packagePath);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
