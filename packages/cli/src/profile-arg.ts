/** `--profile <file | bundled name>` (reviewer, 2026-11-25, install failures 2 and 4). A bare name (lower-case letters,
 *  digits and hyphens) that is not a file here names a profile bundled with the CLI, dist/profiles/<name>/profile.json:
 *  build.mjs copies the committed profile and every file its `setup` names, byte for byte, at the same relative paths
 *  beside it. Every `setup` path must then resolve (scripts/profile-setup.ts), or the run is refused by name before
 *  anything is read. Returns the profile's path, or undefined when there is no such file or bundled profile. */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assertSetupPaths } from '../../../scripts/profile-setup.js';

export const bundledProfiles = (distDir: string): string[] => { const d = path.join(distDir, 'profiles'); return existsSync(d) ? readdirSync(d).sort() : []; };

export function resolveProfileArg(arg: string, distDir: string): string | undefined {
  const file = !existsSync(arg) && /^[a-z0-9][a-z0-9-]*$/.test(arg) ? path.join(distDir, 'profiles', arg, 'profile.json') : arg;
  if (!existsSync(file)) return undefined;
  assertSetupPaths(file);
  return file;
}
