/**
 * The two-journeys command manifest — evals/fixtures/journey-commands.json
 * is the docs-drift seam. The journey evals (evals/run.ts, journey-engineer /
 * journey-designer) EXECUTE these exact command lines against the locally
 * built CLI bundle; the site RENDERS the same file. This module is the only
 * door a page has to a journey command, and after the pages are assembled
 * assertJourneyCommands() re-reads every page's text and refuses the build
 * when a rendered `npx @ds-contracts/cli …` line is not byte-equal to a
 * manifest command (hand-typed drift) or a manifest command was never
 * rendered (an untested-vs-undocumented gap in either direction).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface JourneyStep {
  id: string;
  doc: string;
  command: string;
}

export interface JourneyManifest {
  cliPrefix: string;
  journeys: Record<string, { persona: string; eval: string; steps: JourneyStep[] }>;
}

export const MANIFEST_REL = 'evals/fixtures/journey-commands.json';

export const journeyManifest: JourneyManifest = JSON.parse(
  readFileSync(path.join(process.cwd(), MANIFEST_REL), 'utf8'),
) as JourneyManifest;

/** Commands actually pulled through journeyStep() during this build. */
const rendered = new Set<string>();

/** The only way a page obtains a journey command line. Missing → refuse by name. */
export function journeyStep(journey: string, stepId: string): JourneyStep {
  const step = journeyManifest.journeys[journey]?.steps.find((s) => s.id === stepId);
  if (!step) {
    throw new Error(
      `${MANIFEST_REL}: no step "${journey}/${stepId}" — pages may only render commands that exist in the manifest`,
    );
  }
  rendered.add(step.command);
  return step;
}

/** Strip tags and decode the entities esc()/Prism produce; return trimmed
 *  lines. Inline tags (Prism token spans, <code>, links) vanish seamlessly so
 *  a highlighted command stays one line; every other tag becomes a line break
 *  so captions and prose can never glue onto a command's line start. */
function textLines(html: string): string[] {
  const text = html
    .replace(/<\/?(?:span|code|a|em|strong|i|b|abbr|small)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
  return text.split('\n').map((l) => l.trim());
}

const CLI_LINE_PREFIX = 'npx @ds-contracts/cli ';

/**
 * The build assertion. Scans the rendered text of every page: any line that
 * begins with `npx @ds-contracts/cli ` must be byte-equal to a manifest
 * command, and every manifest command must have been rendered through
 * journeyStep() by some page. Throws (failing the build) on either drift.
 */
export function assertJourneyCommands(pages: Array<{ route: string; html: string }>): {
  checked: number;
  commands: number;
} {
  const allowed = new Set<string>();
  for (const j of Object.values(journeyManifest.journeys)) {
    for (const s of j.steps) allowed.add(s.command);
  }
  let checked = 0;
  const offenders: string[] = [];
  for (const page of pages) {
    for (const line of textLines(page.html)) {
      if (!line.startsWith(CLI_LINE_PREFIX)) continue;
      checked += 1;
      if (!allowed.has(line)) offenders.push(`${page.route}: "${line}"`);
    }
  }
  if (offenders.length > 0) {
    throw new Error(
      `journey-command drift — rendered command line(s) absent from ${MANIFEST_REL} (hand-typed?):\n  ` +
        offenders.join('\n  '),
    );
  }
  const unrendered = [...allowed].filter((c) => !rendered.has(c));
  if (unrendered.length > 0) {
    throw new Error(
      `journey-command drift — manifest command(s) in ${MANIFEST_REL} never rendered by any page:\n  ` +
        unrendered.join('\n  '),
    );
  }
  return { checked, commands: allowed.size };
}
