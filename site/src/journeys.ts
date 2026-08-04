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

/** Verb-shape lines are rendered as `ds-contracts <verb> …` (no npx). */
const VERB_LINE_PREFIX = 'ds-contracts ';

/** The USAGE block in the shipping CLI source — the same bytes the /cli/
 *  page renders verbatim, and the CLI's authoritative verb surface. */
const CLI_SOURCE_REL = 'packages/cli/src/cli.ts';

/**
 * Parse the CLI's real verb surface out of its USAGE block: every command
 * line in the `Commands:` section yields its verb words ("extract",
 * "figma push", "propose-pr", …). Refuses loudly when the parse collapses —
 * a silently empty verb set would wave every dead verb through.
 */
function cliVerbSurface(): Set<string> {
  const source = readFileSync(path.join(process.cwd(), CLI_SOURCE_REL), 'utf8');
  const usage = /const USAGE = `([\s\S]*?)`;\n/.exec(source)?.[1];
  if (!usage) {
    throw new Error(`${CLI_SOURCE_REL}: USAGE block not found — the verb-surface guard cannot run`);
  }
  const verbs = new Set<string>();
  let inCommands = false;
  for (const line of usage.split('\n')) {
    if (line === 'Commands:') {
      inCommands = true;
      continue;
    }
    if (inCommands && line.length > 0 && !line.startsWith(' ')) inCommands = false;
    if (!inCommands) continue;
    // A command line starts at exactly two spaces with the verb word(s);
    // continuation/description lines are indented deeper or start with a
    // flag/placeholder. Two-word verbs ("figma push") are captured whole.
    const m = /^  ([a-z][a-z-]*(?: [a-z][a-z-]+)?)(?=\s|$)/.exec(line);
    if (m) verbs.add(m[1]);
  }
  if (verbs.size < 8) {
    throw new Error(
      `${CLI_SOURCE_REL}: USAGE parse found only ${verbs.size} verb(s) (${[...verbs].join(', ')}) — ` +
        'the verb-surface guard no longer matches the block; fix the parser, do not skip the check',
    );
  }
  return verbs;
}

/**
 * The build assertion, both prefixes. Scans the rendered text of every page:
 *
 * 1. Any line that begins with `npx @ds-contracts/cli ` must be byte-equal
 *    to a manifest command, and every manifest command must have been
 *    rendered through journeyStep() by some page.
 * 2. Any line that begins with `ds-contracts ` (the verb-shape
 *    illustrations — claim-channel, publish, receive, propose-pr, onboard,
 *    …) must name a verb the shipping CLI actually has, read from the
 *    USAGE block in ${CLI_SOURCE_REL}. Until 2026-08-03 these lines were
 *    outside every gate: a retired verb could sit on the site forever.
 *
 * Throws (failing the build) on any drift.
 */
export function assertJourneyCommands(pages: Array<{ route: string; html: string }>): {
  checked: number;
  commands: number;
  verbLines: number;
} {
  const allowed = new Set<string>();
  for (const j of Object.values(journeyManifest.journeys)) {
    for (const s of j.steps) allowed.add(s.command);
  }
  const verbs = cliVerbSurface();
  let checked = 0;
  let verbLines = 0;
  const offenders: string[] = [];
  const verbOffenders: string[] = [];
  for (const page of pages) {
    for (const line of textLines(page.html)) {
      if (line.startsWith(CLI_LINE_PREFIX)) {
        checked += 1;
        if (!allowed.has(line)) offenders.push(`${page.route}: "${line}"`);
        continue;
      }
      if (!line.startsWith(VERB_LINE_PREFIX)) continue;
      const tokens = line.slice(VERB_LINE_PREFIX.length).split(/\s+/);
      const head = tokens[0] ?? '';
      // Not a verb-shaped word: the rendered USAGE header ("ds-contracts
      // 0.8.0 — …") and pure shapes ("ds-contracts <command> --help …").
      if (!/^[a-z][a-z-]*$/.test(head)) continue;
      verbLines += 1;
      const second = tokens[1] && /^[a-z][a-z-]+$/.test(tokens[1]) ? tokens[1] : null;
      if (second && verbs.has(`${head} ${second}`)) continue;
      // A bare lowercase word after a multi-word verb head must BE one of
      // its subcommands — on the site, plain `figma`'s positionals are
      // always paths or <placeholders>, so "ds-contracts figma send" is a
      // dead subcommand, not a contracts directory.
      const headHasSubcommands = [...verbs].some((v) => v.startsWith(`${head} `));
      if (verbs.has(head) && !(headHasSubcommands && second)) continue;
      verbOffenders.push(
        `${page.route}: "${line.slice(0, 80)}" — verb "${second ? `${head} ${second}` : head}" is not in the CLI's surface`,
      );
    }
  }
  if (offenders.length > 0) {
    throw new Error(
      `journey-command drift — rendered command line(s) absent from ${MANIFEST_REL} (hand-typed?):\n  ` +
        offenders.join('\n  '),
    );
  }
  if (verbOffenders.length > 0) {
    throw new Error(
      `verb-surface drift — rendered \`ds-contracts …\` line(s) name a verb the shipping CLI (${CLI_SOURCE_REL} USAGE) does not have:\n  ` +
        verbOffenders.join('\n  '),
    );
  }
  const unrendered = [...allowed].filter((c) => !rendered.has(c));
  if (unrendered.length > 0) {
    throw new Error(
      `journey-command drift — manifest command(s) in ${MANIFEST_REL} never rendered by any page:\n  ` +
        unrendered.join('\n  '),
    );
  }
  return { checked, commands: allowed.size, verbLines };
}
