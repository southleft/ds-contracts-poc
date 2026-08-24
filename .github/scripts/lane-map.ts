/**
 * THE LANE MAP — which npm script runs in which CI lane, derived from the
 * workflow files themselves.
 *
 * This is the half of `npm run ci:lanes` (lane-coverage.ts) that READS: every
 * package manifest git configures (root + workspaces), every workflow under
 * .github/workflows, every `npm run <x>` / `npm --prefix <p> run <x>` a step
 * invokes, expanded through the scripts those invocations call in turn
 * (`maintain` ≡ its members). lane-coverage.ts judges that map; scripts/
 * v1-readiness.ts asks it "is this command already a lane step?" so the
 * readiness run can cite the lane instead of running a 35-minute row twice.
 * One derivation, two readers — a second copy would be a receipt that can
 * name a lane the CI no longer has.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface Manifest {
  name?: string;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

export interface ManifestEntry {
  dir: string;
  qualifier: string;
  scripts: Record<string, string>;
}

export interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
}
export interface Job {
  steps?: Step[];
  uses?: string;
}

export interface Workflow {
  file: string;
  lane: string;
  jobs: Record<string, Job>;
}

export interface LaneInvocation {
  dir: string;
  name: string;
  lane: string;
}

export interface LaneMap {
  root: string;
  pkg: Manifest & { scripts: Record<string, string> };
  manifestEntries: ManifestEntry[];
  manifestByDir: Map<string, ManifestEntry>;
  allScripts: Map<string, { entry: ManifestEntry; name: string }>;
  /** qualified script key (`root:eval`) → lanes that reach it */
  invocations: Map<string, Set<string>>;
  /** every (dir, script) a lane reaches, composites expanded, deduped per step */
  ciInvocations: LaneInvocation[];
  workflows: Workflow[];
  problems: string[];
  readManifest: (dir: string) => Manifest;
  scriptKey: (entry: ManifestEntry, name: string) => string;
}

export const RUN_RE =
  /npm(?:\s+--prefix(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+)))?\s+run\s+([A-Za-z0-9:_-]+)/g;

export const globPattern = (pattern: string) =>
  new RegExp(
    `^${pattern
      .replaceAll("\\", "/")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replaceAll("**", "\0")
      .replaceAll("*", "[^/]*")
      .replaceAll("\0", ".*")
      .replace(/\/+$/, "")}$`,
  );

export function collectLaneMap(root: string = process.cwd()): LaneMap {
  const ROOT = root;
  const WF_DIR = path.join(ROOT, ".github", "workflows");

  const manifestCache = new Map<string, Manifest>();
  const readManifest = (dir: string): Manifest => {
    const manifestPath = path.join(dir, "package.json");
    const cached = manifestCache.get(manifestPath);
    if (cached) return cached;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    manifestCache.set(manifestPath, manifest);
    return manifest;
  };

  const pkg = readManifest(ROOT) as Manifest & {
    scripts: Record<string, string>;
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

  const invocations = new Map<string, Set<string>>();
  const problems: string[] = [];
  const ciInvocations: LaneInvocation[] = [];

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

  const workflows: Workflow[] = [];
  const files = existsSync(WF_DIR)
    ? readdirSync(WF_DIR).filter(
        (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
      )
    : [];
  if (files.length === 0)
    problems.push(".github/workflows contains no workflow at all");

  for (const file of files) {
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
    workflows.push({ file, lane, jobs });
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

  return {
    root: ROOT,
    pkg,
    manifestEntries,
    manifestByDir,
    allScripts,
    invocations,
    ciInvocations,
    workflows,
    problems,
    readManifest,
    scriptKey,
  };
}

/**
 * The lanes that reach `npm [--prefix <dir>] run <name>` — directly or through
 * a script the lane runs that calls it. Empty when no lane does.
 */
export function lanesFor(map: LaneMap, dir: string, name: string): Set<string> {
  const resolved = path.resolve(dir);
  const lanes = new Set<string>();
  for (const inv of map.ciInvocations)
    if (path.resolve(inv.dir) === resolved && inv.name === name)
      lanes.add(inv.lane);
  return lanes;
}
