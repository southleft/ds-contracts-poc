/**
 * A GATE ON THE GATES — `npm run ci:lanes`.
 *
 * WHY THIS EXISTS. The defect this whole .github/ directory answers is "33 gate
 * scripts, none of them automated". The obvious way for that defect to come
 * back is quieter: someone adds gate #34, never adds it to a lane, and the
 * checks list stays green while the new surface is unwatched — precisely the
 * `skips: []` shape this repo keeps finding. So the lanes get a receipt of
 * their own.
 *
 * WHAT IT REFUSES, by name:
 *   1. a gate-shaped script in package.json that no workflow invokes and that
 *      is not on the EXCLUDED list below
 *   2. a workflow step invoking `npm run <x>` where <x> is not a script
 *      (a lane pointing at a destination that does not exist)
 *   3. an EXCLUDED entry that no longer names a real script (a stale reason)
 *      or that a lane DOES run (a reason contradicting the wiring)
 *   4. a gate step in fast.yml / full.yml missing the
 *      `steps.setup.outcome == 'success'` guard — without it, GitHub stops the
 *      job at the first red gate and hides every gate behind it, which is the
 *      failure mode the lanes were explicitly shaped to avoid
 *
 * FALSIFICATION. Delete any gate step from a workflow → (1) fires. Rename a
 * step's script → (2) fires. Drop an `if:` guard → (4) fires. There is no way
 * to weaken a lane and keep this green.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const WF_DIR = path.join(ROOT, ".github", "workflows");

/** Gate-shaped by suffix, plus the ones whose names do not carry one. */
const NAMED_GATES = new Set([
  "typecheck",
  "eval",
  "dagger:census",
  "site:build",
  "parity",
]);
// `check` unanchored to a separator on purpose: the 33 spell it three ways —
// `mint:check`, `plugin:ui-check`, `core:browser-check`. An earlier cut of this
// file used /(:check|:fresh)$/ and silently dropped the last two from the
// coverage census while still printing a confident "33".
const isGate = (name: string) =>
  /(check|:fresh)$/.test(name) || NAMED_GATES.has(name);

/**
 * Gate-shaped scripts NO lane runs — each with the reason, so that "not in CI"
 * is a decision on the record and never an oversight. Adding a name here is a
 * deliberate act; the checks in this file make sure the entry stays true.
 */
const EXCLUDED: Record<string, string> = {
  "root:parity":
    "RED at 8a5c455 for a wall-clock reason: parity/figma-{components,tokens}.json are 27.0 days " +
    "old and the differ refuses snapshots older than 14 (MAX_SNAPSHOT_AGE_DAYS). Refreshing them " +
    "needs a human running parity/extract-figma.plugin.js inside the live Figma file. It also " +
    "rewrites parity/report.json on every run, so it would dirty the checkout. The differ logic is " +
    "covered by the C3-detection eval family in the full lane, and its CANVAS-VARIANT surface — the " +
    "Phase 1 exit criterion, a hand edit to a part's layout inside one variant — by variant-drift:check " +
    "in the fast lane, which spawns this exact differ over a committed fixture pair with " +
    "PARITY_SNAPSHOT_DIR + PARITY_REPORT so neither the snapshots nor the report are touched.",
  "root:seed:verify":
    "Regenerates library seeds from committed capture configs; it is an authoring instrument, not a " +
    "drift gate — figma:fresh and dagger:census are what hold the committed artifacts still.",
  "root:extract:computed:drift":
    "Needs a banked capture directory under extract/computed/out/** whose transient surfaces are " +
    "gitignored; it replays a capture rather than asserting an invariant. The stylesheet-ceiling " +
    "gate is the part of that pipeline with a fixture, and it runs in the full lane.",
  "root:mint:code:check":
    "Superseded surface kept for the code-side mint path; core/mint-check.ts (mint:check, full lane) " +
    "is the gate the minting invariants are pinned in. Listed here so its absence is visible.",
  "root:console-loop:evidence:check":
    "Subsumed: console-loop:all:evidence:check (fast lane) runs this first-party lane plus all six " +
    "others through the aggregator without short-circuit; the per-lane scripts remain for local triage.",
  "root:console-loop:mui:evidence:check":
    "Subsumed by console-loop:all:evidence:check (fast lane) — see console-loop:evidence:check.",
  "root:console-loop:altitude:evidence:check":
    "Subsumed by console-loop:all:evidence:check (fast lane) — see console-loop:evidence:check.",
  "root:console-loop:astryx:evidence:check":
    "Subsumed by console-loop:all:evidence:check (fast lane) — see console-loop:evidence:check.",
  "root:console-loop:carbon:evidence:check":
    "Subsumed by console-loop:all:evidence:check (fast lane) — see console-loop:evidence:check.",
  "root:console-loop:polaris:evidence:check":
    "Subsumed by console-loop:all:evidence:check (fast lane) — see console-loop:evidence:check.",
  "root:console-loop:tailwind:evidence:check":
    "Subsumed by console-loop:all:evidence:check (fast lane) — see console-loop:evidence:check.",
  "root:fidelity:uui:fresh":
    "Byte-compares renders/fidelity.json against a re-derivation whose kernel runs canvas drawImage " +
    "resampling inside Chromium, so its byte-identity across OSes is UNVERIFIED (catalog-visual keeps " +
    "a separate baseline.linux.json for exactly this class of platform-sensitive score). Verified " +
    "0-exit and drift-detecting on the recording platform (macOS arm64, 5.4s); it joins the " +
    "catalog-visual lane the moment one Linux run reproduces the committed table byte-for-byte. The " +
    "per-set fidelity FLOORS are already CI-enforced in the fast lane: accuracy:check reads the same " +
    "committed fidelity.json and holds each set's mean above baseline minus 0.3.",
};

/** Tracked tests intentionally outside CI need a durable, file-specific reason. */
const TEST_EXCLUDED: Record<string, string> = {};

interface Manifest {
  name?: string;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

const manifestCache = new Map<string, Manifest>();
const readManifest = (dir: string): Manifest => {
  const manifestPath = path.join(dir, "package.json");
  const cached = manifestCache.get(manifestPath);
  if (cached) return cached;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  manifestCache.set(manifestPath, manifest);
  return manifest;
};

const pkg = readManifest(ROOT) as {
  scripts: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

const workspacePatterns = Array.isArray(pkg.workspaces)
  ? pkg.workspaces
  : (pkg.workspaces?.packages ?? []);
const packageManifestDirs: string[] = [];
const collectPackageManifestDirs = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.name === "node_modules" ||
      entry.name === ".git"
    )
      continue;
    const child = path.join(dir, entry.name);
    if (existsSync(path.join(child, "package.json")))
      packageManifestDirs.push(child);
    collectPackageManifestDirs(child);
  }
};
collectPackageManifestDirs(ROOT);
const globPattern = (pattern: string) =>
  new RegExp(
    `^${pattern
      .replaceAll("\\", "/")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replaceAll("**", "\0")
      .replaceAll("*", "[^/]*")
      .replaceAll("\0", ".*")
      .replace(/\/+$/, "")}$`,
  );
const workspaceDirs = new Set<string>();
for (const pattern of workspacePatterns) {
  const matcher = globPattern(pattern);
  const matches = packageManifestDirs.filter((dir) =>
    matcher.test(path.relative(ROOT, dir).split(path.sep).join("/")),
  );
  if (matches.length === 0)
    throw new Error(
      `root workspace pattern ${JSON.stringify(pattern)} matches no package manifest`,
    );
  for (const match of matches) workspaceDirs.add(match);
}

interface ManifestEntry {
  dir: string;
  qualifier: string;
  scripts: Record<string, string>;
}
const manifestEntries: ManifestEntry[] = [
  { dir: ROOT, qualifier: "root", scripts: pkg.scripts },
  ...[...workspaceDirs].sort().map((dir) => {
    const manifest = readManifest(dir);
    if (!manifest.name)
      throw new Error(
        `${path.relative(ROOT, dir)}/package.json has no package name`,
      );
    return {
      dir,
      qualifier: manifest.name,
      scripts: manifest.scripts ?? {},
    };
  }),
];
const manifestByDir = new Map(
  manifestEntries.map((entry) => [path.resolve(entry.dir), entry]),
);
const scriptKey = (entry: ManifestEntry, name: string) =>
  `${entry.qualifier}:${name}`;
const allScripts = new Map<string, { entry: ManifestEntry; name: string }>();
for (const entry of manifestEntries)
  for (const name of Object.keys(entry.scripts))
    allScripts.set(scriptKey(entry, name), { entry, name });

interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
}
interface Job {
  steps?: Step[];
  uses?: string;
}

const CHECKOUT_ACTION =
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
const SETUP_NODE_ACTION =
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const SETUP_MARKER =
  'echo "Every step below runs even if an earlier one fails; the job fails at the end."';
const bootstrapSignature = (step: Step) => {
  if (step.id === "setup")
    return `setup:${step.run?.trim() ?? ""}:${step.uses ?? ""}`;
  if (step.uses) return `uses:${step.uses}`;
  if (step.run) return `run:${step.run.trim()}`;
  return "non-executable";
};
const EXPECTED_BOOTSTRAP = [
  `uses:${CHECKOUT_ACTION}`,
  `uses:${SETUP_NODE_ACTION}`,
  "run:npm ci",
  `setup:${SETUP_MARKER}:`,
];

const validateReportingJobs = (
  file: string,
  lane: string,
  jobs: Record<string, Job>,
  target: string[],
) => {
  if (lane !== "fast" && lane !== "full") return;

  for (const [jobId, job] of Object.entries(jobs)) {
    const steps = job.steps ?? [];
    const executable = steps.some((step) => Boolean(step.run || step.uses));

    // A reusable-workflow job (`uses:` at job level) has no step list to
    // validate here. A steps-based job becomes executable for either `run` OR
    // `uses`; action-only jobs do not get a setup-free escape hatch.
    if (!executable) continue;

    const setupIndexes = steps.flatMap((step, index) =>
      step.id === "setup" ? [index] : [],
    );
    if (setupIndexes.length !== 1) {
      target.push(
        `${file} job "${jobId}" has executable run steps and must contain exactly one step with ` +
          `\`id: setup\`; found ${setupIndexes.length}`,
      );
      continue;
    }

    const setupIndex = setupIndexes[0];
    const actualBootstrap = steps
      .slice(0, setupIndex + 1)
      .filter((step) => step.run || step.uses)
      .map(bootstrapSignature);
    if (
      actualBootstrap.length !== EXPECTED_BOOTSTRAP.length ||
      actualBootstrap.some(
        (signature, index) => signature !== EXPECTED_BOOTSTRAP[index],
      )
    ) {
      target.push(
        `${file} job "${jobId}" has an unapproved pre-setup sequence; expected pinned checkout, ` +
          `pinned setup-node, exact \`npm ci\`, then the setup marker; found ${actualBootstrap.join(" → ")}`,
      );
    }

    for (const [stepIndex, step] of steps.entries()) {
      if (
        stepIndex > setupIndex &&
        (step.run || step.uses) &&
        !(step.if ?? "").includes("steps.setup.outcome == 'success'")
      ) {
        const label =
          step.name ?? step.run?.trim() ?? step.uses ?? "executable step";
        target.push(
          `${file} job "${jobId}" step "${label}" has no ` +
            `\`steps.setup.outcome == 'success'\` guard — an earlier failure would hide this result`,
        );
      }
    }
  }
};

if (process.argv.includes("--self-test")) {
  const guard = "steps.setup.outcome == 'success'";
  const bootstrap = (): Step[] => [
    { uses: CHECKOUT_ACTION },
    { uses: SETUP_NODE_ACTION },
    { run: "npm ci" },
    { id: "setup", run: SETUP_MARKER },
  ];
  const controlProblems: string[] = [];
  validateReportingJobs(
    "guarded.yml",
    "fast",
    {
      guarded: {
        steps: [
          ...bootstrap(),
          { run: "npm test", if: guard },
          { uses: "actions/upload-artifact@pinned", if: guard },
        ],
      },
      reusable: { uses: "owner/repo/.github/workflows/reusable.yml@main" },
    },
    controlProblems,
  );
  if (controlProblems.length)
    throw new Error(
      `guarded/uses-only control was rejected: ${controlProblems.join("; ")}`,
    );

  const selfProblems: string[] = [];
  validateReportingJobs(
    "second-job.yml",
    "fast",
    {
      first: {
        steps: [...bootstrap(), { run: "npm test", if: guard }],
      },
      second: {
        steps: [...bootstrap(), { run: "npm run hidden-gate" }],
      },
    },
    selfProblems,
  );
  validateReportingJobs(
    "removed.yml",
    "fast",
    { fast: { steps: [{ run: "npm test" }] } },
    selfProblems,
  );
  validateReportingJobs(
    "duplicated.yml",
    "full",
    {
      full: {
        steps: [...bootstrap(), { id: "setup", run: SETUP_MARKER }],
      },
    },
    selfProblems,
  );
  validateReportingJobs(
    "pre-run.yml",
    "fast",
    {
      fast: {
        steps: [
          { uses: CHECKOUT_ACTION },
          { uses: SETUP_NODE_ACTION },
          { run: "npm run hidden-gate" },
          { run: "npm ci" },
          { id: "setup", run: SETUP_MARKER },
        ],
      },
    },
    selfProblems,
  );
  validateReportingJobs(
    "pre-action.yml",
    "full",
    {
      full: {
        steps: [{ uses: "attacker/unapproved@main" }, ...bootstrap()],
      },
    },
    selfProblems,
  );
  validateReportingJobs(
    "post-action.yml",
    "full",
    {
      full: {
        steps: [...bootstrap(), { uses: "actions/cache@pinned" }],
      },
    },
    selfProblems,
  );
  if (
    selfProblems.length !== 6 ||
    !selfProblems[0].includes('job "second" step') ||
    !selfProblems[1].endsWith("found 0") ||
    !selfProblems[2].endsWith("found 2") ||
    !selfProblems[3].includes("unapproved pre-setup sequence") ||
    !selfProblems[4].includes("unapproved pre-setup sequence") ||
    !selfProblems[5].includes('step "actions/cache@pinned" has no')
  ) {
    throw new Error(
      `per-job reporting falsification failed: ${selfProblems.join("; ")}`,
    );
  }
  console.log(
    "✔ lane coverage self-test: valid bootstrap/control passes; second unguarded job, missing/duplicate setup, pre-setup run/action, and unguarded post-setup action fail",
  );
  process.exit(0);
}

const invocations = new Map<string, Set<string>>(); // qualified script → lanes
const problems: string[] = [];
const ciInvocations: Array<{ dir: string; name: string; lane: string }> = [];
const RUN_RE =
  /npm(?:\s+--prefix(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+)))?\s+run\s+([A-Za-z0-9:_-]+)/g;

const resolveInvocation = (
  file: string,
  lane: string,
  step: Step,
  prefix: string | undefined,
  name: string,
  seen: Set<string> = new Set(),
) => {
  const dir = prefix ? path.resolve(ROOT, prefix) : ROOT;
  const manifestPath = path.join(dir, "package.json");
  if (!existsSync(manifestPath)) {
    problems.push(
      `${file} step "${step.name ?? step.run?.trim()}" runs an npm script with prefix ` +
        `\`${prefix}\`, but ${path.relative(ROOT, manifestPath)} does not exist`,
    );
    return;
  }
  const manifestScripts = readManifest(dir).scripts ?? {};
  if (!(name in manifestScripts)) {
    problems.push(
      `${file} step "${step.name ?? step.run?.trim()}" runs \`npm${prefix ? ` --prefix ${prefix}` : ""} run ${name}\` ` +
        `— no such script in ${path.relative(ROOT, manifestPath)}`,
    );
    return;
  }
  const dedupeKey = `${dir}\0${name}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  ciInvocations.push({ dir, name, lane });
  const configured = manifestByDir.get(path.resolve(dir));
  if (configured) {
    const key = scriptKey(configured, name);
    invocations.set(key, (invocations.get(key) ?? new Set()).add(lane));
  }
  // Composite scripts (`npm run a && npm run b`) cover their nested gates —
  // otherwise workflow-spine:check leaves anatomy-diff / suggested-diff / …
  // looking unwatched while they actually run in the fast lane.
  const body = manifestScripts[name] ?? "";
  const nested = /npm(?:\s+run)\s+([A-Za-z0-9:_-]+)/g;
  let nm: RegExpExecArray | null;
  while ((nm = nested.exec(body)) !== null) {
    resolveInvocation(file, lane, step, prefix, nm[1]!, seen);
  }
};

const workflows = readdirSync(WF_DIR).filter(
  (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
);
if (workflows.length === 0)
  problems.push(".github/workflows contains no workflow at all");

for (const file of workflows) {
  const lane = file.replace(/\.ya?ml$/, "");
  const raw = readFileSync(path.join(WF_DIR, file), "utf8");
  let doc: { jobs?: Record<string, Job> };
  try {
    doc = parseYaml(raw);
  } catch (e) {
    problems.push(`${file} does not parse as YAML: ${(e as Error).message}`);
    continue;
  }
  const jobs = doc.jobs ?? {};
  validateReportingJobs(file, lane, jobs, problems);
  for (const job of Object.values(jobs)) {
    const stepsInJob = job.steps ?? [];
    for (const step of stepsInJob) {
      const run = step.run ?? "";

      RUN_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = RUN_RE.exec(run)) !== null) {
        const prefix = m[1] ?? m[2] ?? m[3];
        const name = m[4];
        resolveInvocation(file, lane, step, prefix, name);
      }
    }
  }
}

// (1) every gate-shaped script in the root and every configured workspace is
// in a lane or named as excluded. Keys are package-qualified so identically
// named workspace gates cannot collapse into one apparently-covered entry.
const gates = [...allScripts.entries()]
  .filter(([, { name }]) => isGate(name))
  .sort(([a], [b]) => a.localeCompare(b));
const uncovered: string[] = [];
console.log(
  `GATE COVERAGE — ${gates.length} gate-shaped script(s) across ${manifestEntries.length} configured manifest(s)\n`,
);
for (const [key] of gates) {
  const lanes = invocations.get(key);
  if (lanes)
    console.log(`  ✔ ${key.padEnd(52)} ${[...lanes].sort().join(" + ")}`);
  else if (key in EXCLUDED)
    console.log(`  – ${key.padEnd(52)} EXCLUDED BY NAME`);
  else {
    console.log(`  ✖ ${key.padEnd(52)} NO LANE, NO REASON`);
    uncovered.push(key);
  }
}
for (const key of uncovered) {
  problems.push(
    `\`${key}\` is gate-shaped but no workflow runs it and EXCLUDED gives no reason — ` +
      `wire it into a lane, or add it to EXCLUDED in .github/scripts/lane-coverage.ts with why`,
  );
}

// (3) the exclusion list stays true.
for (const [name, reason] of Object.entries(EXCLUDED)) {
  if (!allScripts.has(name)) {
    problems.push(
      `EXCLUDED names "${name}", which is no longer a script — delete the stale reason`,
    );
  }
  if (invocations.has(name)) {
    problems.push(
      `EXCLUDED says "${name}" does not run in CI, but ${[...invocations.get(name)!].join(", ")} runs it — ` +
        `one of the two is a lie. Reason on file: ${reason.slice(0, 80)}…`,
    );
  }
}

// Every present Node-style test file (tracked or not-yet-added) must be
// reachable from a test/coverage
// script that a workflow invokes. This follows npm-run indirection across
// prefixed manifests, so `npm run test:cli` cannot hide an incomplete package
// test script behind a green root alias.
const testCommands: Array<{ dir: string; command: string; label: string }> = [];
const visitedTestScripts = new Set<string>();
const visitTestScript = (dir: string, name: string, label: string) => {
  const key = `${dir}\0${name}`;
  if (visitedTestScripts.has(key)) return;
  visitedTestScripts.add(key);

  const command = readManifest(dir).scripts?.[name];
  if (!command) return; // workflow validation already reports this precisely
  testCommands.push({ dir, command, label });

  RUN_RE.lastIndex = 0;
  let nested: RegExpExecArray | null;
  while ((nested = RUN_RE.exec(command)) !== null) {
    const prefix = nested[1] ?? nested[2] ?? nested[3];
    const nestedName = nested[4];
    const nestedDir = prefix ? path.resolve(dir, prefix) : dir;
    if (existsSync(path.join(nestedDir, "package.json"))) {
      visitTestScript(nestedDir, nestedName, `${label} → ${nestedName}`);
    }
  }

  // npm's lifecycle shorthand (`npm test`) is equivalent to `npm run test`.
  if (/(?:^|[;&|]\s*|\s)npm\s+test(?:\s|$)/.test(command)) {
    visitTestScript(dir, "test", `${label} → test`);
  }
};

for (const invocation of ciInvocations) {
  const command = readManifest(invocation.dir).scripts?.[invocation.name] ?? "";
  if (
    /(?:^|:)(?:test|coverage)(?::|$)/.test(invocation.name) ||
    /\b--test\b/.test(command)
  ) {
    visitTestScript(
      invocation.dir,
      invocation.name,
      `${invocation.lane}:${invocation.name}`,
    );
  }
}

const trackedTests = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter((file) => /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(file))
  .sort();

console.log(
  `\nTEST COVERAGE — ${trackedTests.length} present test/spec file(s)\n`,
);
for (const file of trackedTests) {
  const absolute = path.join(ROOT, file);
  const covering = testCommands.filter(({ dir, command }) => {
    const relative = path.relative(dir, absolute).split(path.sep).join("/");
    return !relative.startsWith("../") && command.includes(relative);
  });
  if (covering.length) {
    console.log(
      `  ✔ ${file.padEnd(52)} ${covering.map(({ label }) => label).join(" + ")}`,
    );
  } else if (file in TEST_EXCLUDED) {
    console.log(`  – ${file.padEnd(52)} EXCLUDED BY NAME`);
  } else {
    console.log(`  ✖ ${file.padEnd(52)} NO CI TEST COMMAND, NO REASON`);
    problems.push(
      `${file} is present but no CI-invoked test/coverage script names it — add it to a package test ` +
        `script that a workflow runs, or add a file-specific reason to TEST_EXCLUDED`,
    );
  }
}

for (const [file, reason] of Object.entries(TEST_EXCLUDED)) {
  if (!trackedTests.includes(file)) {
    problems.push(
      `TEST_EXCLUDED names "${file}", which is no longer a present test — delete the stale reason`,
    );
  }
  if (!reason.trim())
    problems.push(`TEST_EXCLUDED gives "${file}" an empty reason`);
}

console.log(`\nEXCLUDED BY NAME (${Object.keys(EXCLUDED).length}):`);
for (const [name, reason] of Object.entries(EXCLUDED))
  console.log(`  · ${name} — ${reason}`);
console.log(
  `\nTEST FILES EXCLUDED BY NAME (${Object.keys(TEST_EXCLUDED).length}):`,
);
for (const [file, reason] of Object.entries(TEST_EXCLUDED))
  console.log(`  · ${file} — ${reason}`);

if (problems.length) {
  console.error(`\n✖ ${problems.length} lane defect(s):`);
  for (const p of problems) console.error(`    ${p}`);
  process.exit(1);
}
console.log(
  `\n✔ every gate-shaped script is either wired into a lane or excluded with a reason; ` +
    `every root/workspace/prefixed lane invocation resolves to its manifest; every present test is CI-reachable; ` +
    `every fast/full executable step reports independently.`,
);
