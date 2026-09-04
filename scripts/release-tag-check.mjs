/**
 * RELEASE TAG GUARD — `npm run release-tag:check`.
 *
 * AUD-U17 (closed 2026-09-03 by disposition): the premature, unsigned
 * v1.0.0-rc.1 tag (34d92c08, 1,054 commits behind, before the recipe pivot)
 * was deleted on origin and locally under the owner's authorisation, and the
 * RELEASE_CHECKLIST row "Signed RC tag approved" records that no RC tag exists
 * until there is a release commit to sign. This guard refuses if such a tag
 * reappears — locally or on origin — before that row names a release commit.
 * An unreachable origin is a refusal, not a pass: a guard that cannot look
 * must not say "clean".
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAG = "v1.0.0-rc.1";
const checklist = readFileSync(path.join(ROOT, "RELEASE_CHECKLIST.md"), "utf8");
const releaseNamed = /Exact release commit approved — owner\/date: \*\*[0-9a-f]{7,}/.test(checklist);
if (releaseNamed) {
  console.log("✔ release-tag:check — a release commit is named; RC tags are the release process's business now");
  process.exit(0);
}
const local = execFileSync("git", ["tag", "-l", TAG], { cwd: ROOT, encoding: "utf8" }).trim();
let remote;
try {
  remote = execFileSync("git", ["ls-remote", "--tags", "origin", TAG], { cwd: ROOT, encoding: "utf8", timeout: 30_000 }).trim();
} catch (e) {
  console.error(`✖ release-tag:check — could not query origin for ${TAG} (${String(e).slice(0, 120)}); a guard that cannot look does not say clean`);
  process.exit(1);
}
if (local || remote) {
  console.error(`✖ release-tag:check — ${TAG} exists (${local ? "locally" : ""}${local && remote ? " and " : ""}${remote ? "on origin" : ""}) while RELEASE_CHECKLIST.md names no release commit. AUD-U17's disposition (2026-09-03) was to delete it until there is something to sign.`);
  process.exit(1);
}
console.log(`✔ release-tag:check — no ${TAG} locally or on origin; the checklist records the 2026-09-03 disposition`);
