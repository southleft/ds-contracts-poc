/**
 * Astryx DOCS-THEME token emit — `npx tsx examples/astryx/scripts/build-docs-tokens.ts`
 *
 * PURE function of two committed inputs (no network, no browser):
 *   tokens/docs-theme.capture.json   pinned snapshot of astryx.atmeta.com
 *                                    (capture-docs-theme.mts wrote it)
 *   tokens/astryx.dtcg.json          the theme-neutral wrap (name set, order,
 *                                    $type, alias structure)
 *
 * Emits the docs-site theme under the SAME 186 token names:
 *   tokens/astryx-docs.dtcg.json             base tree (light branch)
 *   tokens/modes/astryx-docs.light.dtcg.json only the light-dark() (mode-
 *   tokens/modes/astryx-docs.dark.dtcg.json  varying) entries
 *
 * Rules (deterministic, never guessed):
 *   - a captured value that is ONE full `light-dark(A, B)` wrap splits into
 *     light=A / dark=B (balanced-paren top-level comma); base carries A
 *   - anything else is carried VERBATIM (shadow strings keep their embedded
 *     light-dark(), exactly like the neutral wrap)
 *   - where the neutral wrap aliases ("{font-size-2xl}") AND the capture
 *     proves the alias still holds (captured(token) === captured(target)),
 *     the alias is preserved; otherwise the literal captured value lands
 *   - a name missing on the site falls back to the neutral value and is
 *     receipted BY NAME (0 in the current capture)
 *
 * REFUSES when the pinned capture's own verification section shows cross-page
 * or dark-read disagreements — a token set built from an unstable read would
 * be plausible, valid-looking, and wrong.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const EX = path.join(HERE, '..');
const read = (p: string) => JSON.parse(readFileSync(path.join(EX, p), 'utf8'));

interface DtcgEntry {
  $value: string;
  $type?: string;
}

const capture = read('tokens/docs-theme.capture.json') as {
  verification: { pageDisagreements: string[]; darkDisagreements: Record<string, unknown>; missing: string[] };
  values: Record<string, string>;
};
const neutral = read('tokens/astryx.dtcg.json') as Record<string, DtcgEntry>;

const { pageDisagreements, darkDisagreements } = capture.verification;
if (pageDisagreements.length > 0 || Object.keys(darkDisagreements).length > 0) {
  throw new Error(
    `docs-theme emit REFUSED: the pinned capture is unstable — cross-page [${pageDisagreements.join(', ')}], ` +
      `dark-read [${Object.keys(darkDisagreements).join(', ')}]. Re-capture and inspect before emitting.`,
  );
}

/** Full `light-dark(A, B)` wrap → [A, B] (balanced top-level comma), else null. */
const splitLightDark = (v: string): [string, string] | null => {
  if (!v.startsWith('light-dark(') || !v.endsWith(')')) return null;
  const inner = v.slice('light-dark('.length, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return null;
    } else if (ch === ',' && depth === 0) {
      const rest = inner.slice(i + 1);
      // a second top-level comma means this is NOT a single wrap
      let d = 0;
      for (const c of rest) {
        if (c === '(') d++;
        else if (c === ')') d--;
        else if (c === ',' && d === 0) return null;
      }
      return [inner.slice(0, i).trim(), rest.trim()];
    }
  }
  return null;
};

const base: Record<string, DtcgEntry> = {};
const light: Record<string, DtcgEntry> = {};
const dark: Record<string, DtcgEntry> = {};
const fellBack: string[] = [];
const aliasKept: string[] = [];
const aliasBroken: string[] = [];

for (const [name, neutralEntry] of Object.entries(neutral)) {
  const captured = capture.values[name];
  const entry = (value: string): DtcgEntry => ({
    $value: value,
    ...(neutralEntry.$type !== undefined ? { $type: neutralEntry.$type } : {}),
  });
  if (captured === undefined || captured === '') {
    base[name] = { ...neutralEntry };
    fellBack.push(name);
    continue;
  }
  // alias preservation: the neutral wrap's "{target}" survives only when the
  // capture PROVES the site still resolves token === target
  const aliasMatch = /^\{(.+)\}$/.exec(neutralEntry.$value);
  if (aliasMatch) {
    const target = aliasMatch[1];
    if (capture.values[target] !== undefined && capture.values[target] !== '' && capture.values[target] === captured) {
      base[name] = { ...neutralEntry };
      aliasKept.push(name);
      continue;
    }
    aliasBroken.push(name);
  }
  const modes = splitLightDark(captured);
  if (modes) {
    base[name] = entry(modes[0]);
    light[name] = entry(modes[0]);
    dark[name] = entry(modes[1]);
  } else {
    base[name] = entry(captured);
  }
}

writeFileSync(path.join(EX, 'tokens/astryx-docs.dtcg.json'), JSON.stringify(base, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens/modes/astryx-docs.light.dtcg.json'), JSON.stringify(light, null, 2) + '\n');
writeFileSync(path.join(EX, 'tokens/modes/astryx-docs.dark.dtcg.json'), JSON.stringify(dark, null, 2) + '\n');

// receipt — including the theme delta vs neutral (informational; includes
// whitespace-only serialization diffs — DOCS-THEME.md separates those out)
const changed = Object.keys(neutral).filter((n) => base[n].$value !== neutral[n].$value);
console.log(
  `✔ astryx-docs tokens: ${Object.keys(base).length} base (order/$type/alias structure from the neutral wrap), ` +
    `${Object.keys(light).length} mode-varying → modes/astryx-docs.{light,dark}.dtcg.json`,
);
console.log(
  `  aliases kept: ${aliasKept.length}, aliases broken→literal: ${aliasBroken.length}` +
    (aliasBroken.length ? ` (${aliasBroken.join(', ')})` : ''),
);
console.log(`  site-missing fallbacks: ${fellBack.length}` + (fellBack.length ? ` (${fellBack.join(', ')})` : ''));
console.log(`  values differing from theme-neutral base: ${changed.length}/${Object.keys(neutral).length}`);
