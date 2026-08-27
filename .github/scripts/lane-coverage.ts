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
 *   5. a member of a COMPOSITE script (a body that is only
 *      `npm run a && npm run b …`, e.g. `maintain`) that no lane runs and no
 *      EXCLUDED entry names — the suffix regex cannot see `functional:flowbite`
 *      or `parity:flowbite`, but "npm run maintain is green" is a team claim,
 *      so every member is a gate whatever its name, and the COMPOSITE COVERAGE
 *      table proves the local set and the CI set are the same set
 *
 * FALSIFICATION. Delete any gate step from a workflow → (1) fires. Rename a
 * step's script → (2) fires. Drop an `if:` guard → (4) fires. There is no way
 * to weaken a lane and keep this green.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  collectLaneMap,
  RUN_RE,
  type Job,
  type ManifestEntry,
  type Step,
} from "./lane-map";

const ROOT = process.cwd();

/** Gate-shaped by suffix, plus the ones whose names do not carry one. */
const NAMED_GATES = new Set([
  "typecheck",
  "eval",
  "dagger:census",
  "site:build",
  "parity",
  // the team gate and its Figma-token half — composites, expanded below
  "maintain",
  "maintain:visual",
  // the definition of v1, run end to end — every row of docs/26 on the commit
  "v1:readiness",
]);
// `check` unanchored to a separator on purpose: the 33 spell it three ways —
// `mint:check`, `plugin:ui-check`, `core:browser-check`. An earlier cut of this
// file used /(:check|:fresh)$/ and silently dropped the last two from the
// coverage census while still printing a confident "33".
const isGate = (name: string) =>
  /(check|:fresh)$/.test(name) || NAMED_GATES.has(name);

/**
 * A composite script is a body that is NOTHING BUT a `&&` chain of
 * `npm run <x>` — `maintain` is the one this was written for. Returns the
 * member names, or null when the body carries anything else (a composite that
 * also runs tsx/node inline is a gate in its own right and is judged by name).
 */
const COMPOSITE_RE =
  /^\s*npm run [A-Za-z0-9:_-]+(?:\s*&&\s*npm run [A-Za-z0-9:_-]+)*\s*$/;
const parseComposite = (body: string): string[] | null => {
  if (!COMPOSITE_RE.test(body)) return null;
  return [...body.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map((m) => m[1]!);
};

/**
 * Gate-shaped scripts NO lane runs — each with the reason, so that "not in CI"
 * is a decision on the record and never an oversight. Adding a name here is a
 * deliberate act; the checks in this file make sure the entry stays true.
 */
const EXCLUDED: Record<string, string> = {
  "root:recipe:input-field:live:v6:check":
    "Retired phase-sensitive historical composite: it is intentionally red after its published " +
    "authorization because its self-test asserts the real repository must still be pre-authorization. " +
    "V6 bytes are held by recipe:pivot-status:check; v7 replaces the lifecycle in the fast lane.",
  "root:recipe:input-field:live:v6:generated:check":
    "Retired with v6: its index hashes authorization lifecycle files. Pivot status holds every indexed " +
    "v6 byte while v7 generated freshness excludes lifecycle files.",
  "root:recipe:input-field:live:v6:authorization:self-test":
    "Retired exact defect specimen. It remains on disk to prove the phase-sensitive failure class and " +
    "is planted by the hermetic v7 authorization test.",
  "root:recipe:input-field:live:v6:smoke":
    "The same broker semantics run through input-field-live-v7-broker.test.ts in the v7 fast-lane " +
    "composite; the immutable v6 broker test also remains covered by test:recipe.",
  "root:sync:spine":
    "The live drift spine: needs the FIGMA_TOKEN secret + network (Figma REST) and, with --open-pr, an " +
    "authenticated gh — none of which belong in a PR gate, and its red means 'a drifted row has no " +
    "recorded human decision' (decided drift is a warning; a crash is a distinct red), never 'this " +
    "commit is wrong'. It runs on the scheduled sync-spine.yml lane (invoked via tsx there, so " +
    "this entry stays true) and degrades to a NAMED skip when the secret is absent. The committed twin " +
    "is the fixture-mode eval sync-spine-drift (eval lane) + sync:ledger:check (fast lane), which pin " +
    "the same plan/pull/cursor/decision arithmetic over the committed fixture canvas and keep " +
    "sync/PENDING.md the byte-exact render of the ledger.",
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
const TEST_EXCLUDED: Record<string, string> = {
  "recipe/input-field-live-v6-authorization.test.ts":
    "Retired exact lifecycle-defect specimen: its real-repository pending assertion is intentionally red " +
    "after v6 authorization. V7's hermetic test reads and plants this source without executing it.",
};

// Everything below reads the lane map lane-map.ts derives from the workflow
// files; scripts/v1-readiness.ts reads the same map to cite lanes.
const map = collectLaneMap(ROOT);
const {
  manifestEntries,
  allScripts,
  invocations,
  ciInvocations,
  problems,
  readManifest,
  scriptKey,
} = map;

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
  const chain = parseComposite(
    "npm run a:check && npm run b && npm run c:fresh",
  );
  const mixed = parseComposite("npm run a:check && tsx scripts/b.ts");
  const single = parseComposite("npm run only");
  if (
    JSON.stringify(chain) !== JSON.stringify(["a:check", "b", "c:fresh"]) ||
    mixed !== null ||
    JSON.stringify(single) !== JSON.stringify(["only"])
  )
    throw new Error(
      `composite parser falsification failed: ${JSON.stringify({ chain, mixed, single })}`,
    );
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
    "✔ lane coverage self-test: composite parser accepts a pure npm-run chain and refuses a mixed body; valid bootstrap/control passes; second unguarded job, missing/duplicate setup, pre-setup run/action, and unguarded post-setup action fail",
  );
  process.exit(0);
}

for (const { file, lane, jobs } of map.workflows)
  validateReportingJobs(file, lane, jobs, problems);

// (1) every gate-shaped script in the root and every configured workspace is
// in a lane or named as excluded. Keys are package-qualified so identically
// named workspace gates cannot collapse into one apparently-covered entry.
// Composite scripts (`npm run a && npm run b …`) are expanded to their
// members, transitively, within their own manifest. Every leaf is a gate BY
// MEMBERSHIP regardless of its name, so `maintain` being green locally and the
// lanes being green are provably the same set of commands.
interface Composite {
  key: string;
  entry: ManifestEntry;
  members: string[]; // direct members — script names in the same manifest
  leaves: string[]; // transitive non-composite members — qualified keys
}
const composites = new Map<string, Composite>();
for (const entry of manifestEntries)
  for (const [name, body] of Object.entries(entry.scripts)) {
    const members = parseComposite(body);
    if (members)
      composites.set(scriptKey(entry, name), {
        key: scriptKey(entry, name),
        entry,
        members,
        leaves: [],
      });
  }
const expandLeaves = (key: string, trail: string[] = []): string[] => {
  const composite = composites.get(key);
  if (!composite) return [key];
  if (trail.includes(key)) {
    problems.push(
      `composite script ${key} recurses through ${[...trail, key].join(" → ")}`,
    );
    return [];
  }
  const leaves: string[] = [];
  for (const member of composite.members) {
    const memberKey = scriptKey(composite.entry, member);
    if (!allScripts.has(memberKey)) {
      problems.push(
        `composite script ${key} runs \`npm run ${member}\` — no such script in ` +
          `${composite.entry.qualifier}'s package.json`,
      );
      continue;
    }
    for (const leaf of expandLeaves(memberKey, [...trail, key]))
      if (!leaves.includes(leaf)) leaves.push(leaf);
  }
  return leaves;
};
for (const composite of composites.values())
  composite.leaves = expandLeaves(composite.key);
// A composite is a GATE composite when it is a named gate itself or when any
// member is gate-shaped (directly or as a gate composite). `build` is
// `tokens && schema && generate` — a generator alias, not a gate; listing its
// members as unwatched gates would be the false-red the lanes refuse to cause.
const gateComposites = new Set<string>();
const isGateComposite = (key: string, trail: string[] = []): boolean => {
  const composite = composites.get(key);
  if (!composite || trail.includes(key)) return false;
  if (gateComposites.has(key)) return true;
  const named = isGate(key.slice(composite.entry.qualifier.length + 1));
  const viaMember = composite.members.some((member) => {
    const memberKey = scriptKey(composite.entry, member);
    return isGate(member) || isGateComposite(memberKey, [...trail, key]);
  });
  if (named || viaMember) gateComposites.add(key);
  return named || viaMember;
};
for (const key of composites.keys()) isGateComposite(key);
const compositeMembers = new Set(
  [...gateComposites].flatMap((key) => composites.get(key)!.leaves),
);

// A composite is judged through its leaves (the COMPOSITE COVERAGE table),
// never as a step of its own — no lane runs `npm run maintain`; the lanes run
// its members, and that is the claim being checked.
const gates = [...allScripts.entries()]
  .filter(
    ([key, { name }]) =>
      !composites.has(key) && (isGate(name) || compositeMembers.has(key)),
  )
  .sort(([a], [b]) => a.localeCompare(b));
const uncovered: string[] = [];
console.log(
  `GATE COVERAGE — ${gates.length} gate-shaped script(s) across ${manifestEntries.length} configured manifest(s) ` +
    `(by suffix, by name, or by composite membership)\n`,
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

// (5) every composite's leaves are each in a lane or excluded by name, so
// "npm run <composite> is green" and "the lanes are green" are the same claim.
// Uncovered leaves were already pushed to `problems` by (1) above.
console.log(
  `\nCOMPOSITE COVERAGE — ${composites.size} composite script(s), ${gateComposites.size} gate-shaped; every leaf of a gate composite is a gate by membership\n`,
);
for (const composite of [...composites.values()].sort((a, b) =>
  a.key.localeCompare(b.key),
)) {
  if (!gateComposites.has(composite.key)) {
    console.log(
      `  · ${composite.key} (${composite.leaves.length} leaf step(s)) alias, not a gate — no gate-shaped member: ${composite.members.join(" && ")}`,
    );
    continue;
  }
  const laneSet = new Set<string>();
  const rows: string[] = [];
  let complete = true;
  for (const leaf of composite.leaves) {
    const lanes = invocations.get(leaf);
    if (lanes) {
      for (const lane of lanes) laneSet.add(lane);
      rows.push(`      ✔ ${leaf.padEnd(48)} ${[...lanes].sort().join(" + ")}`);
    } else if (leaf in EXCLUDED) {
      rows.push(`      – ${leaf.padEnd(48)} EXCLUDED BY NAME`);
    } else {
      complete = false;
      rows.push(`      ✖ ${leaf.padEnd(48)} NO LANE, NO REASON`);
    }
  }
  const verdict = complete
    ? `≡ ${[...laneSet].sort().join(" + ") || "(every leaf excluded by name)"}`
    : "NOT THE SAME SET AS CI";
  console.log(
    `  ${complete ? "✔" : "✖"} ${composite.key} (${composite.leaves.length} leaf step(s)) ${verdict}`,
  );
  for (const row of rows) console.log(row);
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
    // The canvas census added ~1,000 committed PNGs; `git ls-files` output now
    // exceeds spawnSync's 1 MiB default maxBuffer (ENOBUFS).
    maxBuffer: 64 * 1024 * 1024,
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
  `\n✔ every gate-shaped script (by suffix, by name, or by composite membership) is either wired into a lane or excluded with a reason; ` +
    `every root/workspace/prefixed lane invocation resolves to its manifest; every present test is CI-reachable; ` +
    `every fast/full executable step reports independently.`,
);
