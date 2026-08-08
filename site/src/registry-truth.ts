/**
 * Registry truth — the ONLY legal source for a version the site prints as
 * published.
 *
 * WHY. On 2026-08-08 the get-started and CLI pages read the SOURCE tree's
 * package.json files and printed those versions under "published and
 * MIT-licensed" — so a build at any RC commit would claim (for example)
 * `@ds-contracts/cli@0.5.0-rc.2` is on npm when it is not. The source
 * package.json answers "what version is this working tree", which is a
 * different question from "what version can a stranger npm-install today".
 * Only scripts/registry-truth.json — maintained by hand at publish time —
 * answers the second one.
 *
 * Two exports:
 *   - published(pkg): the { latest, next } pair for a package, for pages to
 *     render ("published stable X · RC on the next tag: Y").
 *   - assertRegistryTruth(pages): the build-time guard. It refuses the build,
 *     by name, when (a) any rendered `@ds-contracts/<pkg>@<version>` string
 *     carries a version absent from the manifest, or (b) a source-tree
 *     package.json version that the registry has never seen appears anywhere
 *     in a rendered page. Rendered published claims and npm reality cannot
 *     diverge.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const REGISTRY_TRUTH_REL = "scripts/registry-truth.json";

interface PublishedPair {
  latest: string;
  next: string;
}
interface RegistryTruth {
  packages: Record<string, PublishedPair>;
}

let cached: RegistryTruth | undefined;
function registryTruth(): RegistryTruth {
  if (!cached) {
    const raw = JSON.parse(
      readFileSync(path.join(process.cwd(), REGISTRY_TRUTH_REL), "utf8"),
    ) as RegistryTruth;
    if (!raw.packages || Object.keys(raw.packages).length === 0) {
      throw new Error(
        `${REGISTRY_TRUTH_REL}: no "packages" map — nothing honest to render`,
      );
    }
    for (const [name, pair] of Object.entries(raw.packages)) {
      if (!pair.latest || !pair.next) {
        throw new Error(
          `${REGISTRY_TRUTH_REL}: ${name} needs both "latest" and "next"`,
        );
      }
    }
    cached = raw;
  }
  return cached;
}

/** The published { latest, next } pair for an npm package name. Throws when
 *  the manifest has no entry — an unlisted package has no published version
 *  to print. */
export function published(pkg: string): PublishedPair {
  const pair = registryTruth().packages[pkg];
  if (!pair) {
    throw new Error(
      `${REGISTRY_TRUTH_REL}: no entry for ${pkg} — a package absent from the registry manifest has no published version the site may print`,
    );
  }
  return pair;
}

/** Source-tree package.json paths whose version strings must never leak into
 *  a rendered page unless the registry actually has them. */
const SOURCE_PACKAGES: Record<string, string> = {
  "@ds-contracts/cli": "packages/cli/package.json",
  "@ds-contracts/schema": "packages/schema/package.json",
  "@ds-contracts/emitter-web-components":
    "packages/emitter-web-components/package.json",
};

export interface RegistryTruthReceipt {
  pages: number;
  claims: number;
}

/**
 * The guard. Scans every rendered page and throws (build fails) on the first
 * class of lie it finds. Escaped HTML is normalised first so `&#64;`-style
 * encodings cannot smuggle a version past the scan.
 */
export function assertRegistryTruth(
  pages: Array<{ route: string; html: string }>,
): RegistryTruthReceipt {
  const truth = registryTruth();
  const problems: string[] = [];
  let claims = 0;

  // Source-tree versions the registry has never seen: their literal strings
  // are unpublishable and must not appear in any rendered page at all.
  const unpublished: Array<{ pkg: string; version: string }> = [];
  for (const [pkg, rel] of Object.entries(SOURCE_PACKAGES)) {
    const v = (
      JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8")) as {
        version?: string;
      }
    ).version;
    if (!v) continue;
    const pair = truth.packages[pkg];
    if (!pair || (v !== pair.latest && v !== pair.next))
      unpublished.push({ pkg, version: v });
  }

  const CLAIM = /@ds-contracts\/([a-z0-9-]+)@(\d[0-9A-Za-z.-]*)/g;
  for (const page of pages) {
    const html = page.html
      .replace(/&#64;/g, "@")
      .replace(/&#(?:x2E|46);/g, ".");
    for (const m of html.matchAll(CLAIM)) {
      claims++;
      const pkg = `@ds-contracts/${m[1]}`;
      const version = m[2];
      const pair = truth.packages[pkg];
      if (!pair) {
        problems.push(
          `${page.route} renders "${m[0]}" but ${REGISTRY_TRUTH_REL} has no entry for ${pkg} — an unlisted package must not be printed with a version`,
        );
      } else if (version !== pair.latest && version !== pair.next) {
        problems.push(
          `${page.route} renders "${m[0]}" but ${REGISTRY_TRUTH_REL} says the published versions of ${pkg} are ${pair.latest} (latest) / ${pair.next} (next) — a version absent from the registry must never be printed as published`,
        );
      }
    }
    for (const { pkg, version } of unpublished) {
      if (html.includes(version)) {
        problems.push(
          `${page.route} renders the string "${version}" — that is the SOURCE-TREE version of ${pkg} (${SOURCE_PACKAGES[pkg]}) and ${REGISTRY_TRUTH_REL} does not list it as published; read the version from the registry manifest instead of the source package.json`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `registry-truth guard FAILED — the site refuses to build:\n` +
        problems.map((p) => `   ${p}`).join("\n") +
        `\n  Fix: render versions via published() from site/src/registry-truth.ts; if a new version really is on npm, record it in ${REGISTRY_TRUTH_REL} first.`,
    );
  }
  return { pages: pages.length, claims };
}
