/** A system profile's `setup` paths (reviewer, 2026-11-25, install failure 2). Each resolves against the profile file's
 *  own folder first, then the working directory. So a profile shipped beside its setup files works outside a checkout,
 *  and the committed Carbon profile, whose setup paths are repository paths, still works in one. A path that resolves
 *  nowhere is refused by name, never read. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function resolveSetupPath(profileFile: string, rel: string, exists: (file: string) => boolean = existsSync): string | undefined {
  return (path.isAbsolute(rel) ? [rel] : [path.join(path.dirname(profileFile), rel), rel]).find((f) => exists(f));
}

export const setupMissing = (field: string, rel: string) => Error(`profile-setup-file-missing:${field}: ${rel} (looked beside the profile, then in ${process.cwd()})`);

/** Every `setup` path of the profile at `profileFile` resolves, or the first that does not is refused by name. */
export function assertSetupPaths(profileFile: string): void {
  const setup = (JSON.parse(readFileSync(profileFile, 'utf8')) as { setup?: Record<string, unknown> }).setup ?? {};
  for (const [field, rel] of Object.entries(setup)) if (typeof rel === 'string' && !resolveSetupPath(profileFile, rel)) throw setupMissing(field, rel);
}
