/**
 * CSS/DOM CONFORMANCE FIXTURE — generator.
 *
 *   npx tsx conformance/build.ts
 *
 * Reads the HAND-AUTHORED case directories (conformance/cases/<id>/case.json,
 * Case.tsx, case.css) and derives, deterministically:
 *
 *   MANIFEST.json              the index of every case + its declared expectation
 *   lib/index.jsx              the fixture library's named exports
 *   lib/conformance.css        the fixture library's stylesheet (@imports)
 *   seeds/<id>.contract.json   one minimal seed contract per case (the prop
 *                              space the capture enumerates against — empty,
 *                              because the fixture varies CSS, not props)
 *   conformance.config.json    a REAL extract/computed CaptureConfig
 *   .sandbox/                  the capture harness (git-ignored)
 *
 * THE MANIFEST IS THE DENOMINATOR. It is derived from the case directories and
 * from NOTHING ELSE — deliberately not from isFusable, styled, DECLARED_CHANNELS,
 * CHANNEL_TO_COMPUTED, TOKEN_CHANNELS or carriedParts. That independence is the
 * entire point of the fixture: a construct the engine's own filters never open
 * is still in the denominator here, so it can still fail.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const HERE = path.resolve(new URL('.', import.meta.url).pathname);
export const REPO = path.resolve(HERE, '..');

export type Disposition = 'CARRIED' | 'LOWERED' | 'REFUSED' | 'UNSUPPORTED';
export const DISPOSITIONS: readonly Disposition[] = ['CARRIED', 'LOWERED', 'REFUSED', 'UNSUPPORTED'];

export interface CaseEntry {
  id: string;
  feature: string;
  construct: string;
  why: string;
  expect: Disposition;
  /** The refusal/receipt string the engine must produce. Empty ONLY for
   *  CARRIED cases (nothing to name — the carriage IS the receipt). */
  expectName: string;
  expectWhere: string;
  observable: {
    part: string;
    channel: string;
    /** The value the BROWSER is expected to compute. This is what the gate
     *  measures against — a channel seen with some OTHER value is not this
     *  construct. */
    capturedValue: string;
    /** The value the CONTRACT is expected to carry, when a declared, lossless
     *  transform sits between the two (oklch() → sRGB hex is the only one
     *  today). Absent = the contract must carry the captured value itself. */
    carriedValue?: string;
  };
  canvas: {
    expect: 'PRESENT' | 'ABSENT';
    /** RC3 (burn-down round 2) — `PRESENT` alone is satisfied by a RECEIPT:
     *  conformance/canvas.ts grades a construct that comes back with nothing
     *  proposed as NAMED (green) as long as some artifact mentions the
     *  channel, and NAMED is exactly what a non-lowered ring, border or
     *  elevation produces. `mustDraw` says the manifest is not satisfied by
     *  a name: the proposal must actually carry the channel. The verdict is
     *  MUTE, the mirror of HARMFUL (declared ABSENT, carried anyway).
     *
     *  IT IS A STRICT ADDITION AND NEVER A WAIVER — a case without it is
     *  graded exactly as before. 23 of the fixture's PRESENT cases do NOT
     *  declare it today (21 of them the grid family, whose canvas refusal is
     *  a real named wall); adopting them is a separate round, named in
     *  conformance/README.md, not a hole this flag opens. */
    mustDraw?: boolean;
    note: string;
  };
  blockStage?: boolean;
  stage?: { width: number; height: number; padding: number };
  sampleText?: string;
  /** REJECTED-SETS ROUND — a case whose construct only EXISTS across a prop
   *  space (fluent.card: flex-direction that varies on the orientation axis)
   *  declares its enum axes here. The seed contract carries them as real
   *  enum props and the config lists them as capture axes — the UNMODIFIED
   *  runner enumerates the combos exactly as it does for a real library.
   *  Case.tsx receives each prop by name (default = the declared default). */
  axes?: Array<{ prop: string; values: string[]; default: string }>;
  /** RC3 (burn-down round 2) — THE INSTRUMENT HOLE THE PREVIOUS ROUND NAMED
   *  AND COULD NOT CLOSE: "the conformance fixture cannot exercise state
   *  previews at all", so every ring/border/elevation a library spells on
   *  `:focus-visible` was un-measurable here and its defect could only be
   *  written down as a wall.
   *
   *  It was never the CAPTURE that was missing — `extract/computed/run.ts`
   *  already enumerates `__hover` / `__focus-visible` / `__active` for every
   *  case (the committed `receipts/pair--*__focus-visible.png` prove it). It
   *  was the SEED: `states: []` with no `bindings.figma.statePreviews`, so
   *  the state deltas the capture measured had nowhere to land and the
   *  compiled set drew no State plane to round-trip.
   *
   *  It was not the FUSE either: the enriched contract of the existing
   *  `antd-focus-outline-ring` case already carries
   *  `states: ["focus-visible"]` with a full outline pair under it. What was
   *  missing is the ONE binding that decides whether a declared state plane
   *  is DRAWN — `bindings.figma.statePreviews` — which promote sets for a
   *  real library and the seed writer never set here. Without it
   *  core/emit-figma-script.ts:5546 answers every state question with "the
   *  focus-visible plane is not drawn — bindings.figma.statePreviews is off",
   *  a true sentence that makes the canvas gate green on a ring nobody drew.
   *
   *  A case that declares this gets the binding on its seed, and the states
   *  the capture already measured become real State preview cells for the
   *  canvas gate to dump and propose. Cases that do not declare it are
   *  byte-identical to before. */
  statePreviews?: boolean;
  /** A2 LAYOUT PROMOTION (conformance/layout-cases-draft): the case's
   *  TWO-DIRECTION disposition spec, carried VERBATIM from the hand-authored
   *  draft. `codeToCanvas` is the direction this fixture's gate measures
   *  (CSS/DOM → computed capture → contract); `canvasToCode` is the dump →
   *  propose-figma direction, and as of 2026-08-08 it is MEASURED, not merely
   *  declared: each case's `dumpSnippet` is expanded into the full dump v1.17
   *  grammar under extract/figma/conformance/cases/ and run through the real
   *  reader (core/propose-figma.ts gridCarriageOf / invertGridLayout /
   *  attachGridPlacement / hoistGridAreas) against that fixture's own
   *  hand-authored MANIFEST — gated by the registered eval
   *  `grid-canvas-conformance`, with the closed loop (contract → canvas →
   *  contract, identity-asserted, red-tested on the canvas half) gated by
   *  `grid-roundtrip-identity`. The A2 grammar's other three registered evals
   *  (`npm run eval`) remain: grid-bento-carriage (contract → .figma.js →
   *  strict-mock readback — the codeToCanvas half), grid-css-emitters (the
   *  canonical G6 spellings on all three CSS surfaces) and grid-code-proposer
   *  (CSS → contract inversion, the G7 refusals by name, the round-trip
   *  comparator's grid buckets).
   *  This comment has been wrong twice, both times in the same class. First it
   *  claimed canvasToCode was "eval-gated today" while the named fixtures were
   *  run by no eval at all. Then it claimed the reader did not exist — six
   *  commits AFTER it landed (0161ef9f) — an absence measured with a plain
   *  `grep` that silently skips core/propose-figma.ts: the file holds three
   *  literal NUL bytes as composite-key separators, so file(1) calls it binary
   *  data and grep reports no match for patterns with 63 real hits. Use
   *  `grep -a` on that file, and prefer a gate to a sentence.
   *  `UNREACHABLE` means the source surface cannot construct
   *  the case (proved by the cited probe) — the direction exists to prove the
   *  reader never invents it, and such cases ship NO dump.snippet.json by
   *  declaration. */
  directions?: Record<string, { expect: string; note?: string }>;
  /** The A1 probe receipt that justifies the disposition (docs/research/
   *  grid-recon-probes.md P1–P14). */
  probe?: string;
  /** Design-side fixture file in the case directory ('dump.snippet.json'),
   *  or null when the canvasToCode direction is UNREACHABLE (the canvas
   *  cannot hold the construct — absence is the declaration, not an
   *  omission). Absent entirely on pre-A2 cases. */
  dumpSnippet?: string | null;
}

/** PascalCase export name for a case id. PascalCase is not cosmetic: the
 *  enriched contract's `name` becomes the generated React component and its
 *  file names, and core/emit-react validateContract refuses anything else. */
export const exportNameFor = (id: string): string =>
  'Case' + id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');

/** The capture output directory for a case — `comp.name.toLowerCase()`, the
 *  UNMODIFIED runner's own rule (extract/computed/run.ts). Mirrored here, not
 *  imported, so the gate reads the same layout the runner writes. */
export const outDirFor = (id: string): string => exportNameFor(id).toLowerCase();

export function loadCases(): CaseEntry[] {
  const dir = path.join(HERE, 'cases');
  const ids = readdirSync(dir).filter((d) => existsSync(path.join(dir, d, 'case.json'))).sort();
  const out: CaseEntry[] = [];
  for (const id of ids) {
    const e = JSON.parse(readFileSync(path.join(dir, id, 'case.json'), 'utf8')) as CaseEntry;
    if (e.id !== id) throw new Error(`${id}/case.json declares id "${e.id}" — the directory name IS the id`);
    if (!DISPOSITIONS.includes(e.expect)) {
      throw new Error(`${id}: expect "${e.expect}" is outside the closed vocabulary (${DISPOSITIONS.join(', ')}) — there is no fifth value`);
    }
    if (e.expect !== 'CARRIED' && !e.expectName) {
      throw new Error(`${id}: expect ${e.expect} with no expectName — UNSUPPORTED is not a free pass; a construct the engine does not carry must still be NAMED in an artifact`);
    }
    if (!e.observable?.channel) throw new Error(`${id}: observable.channel is required — it is what the gate measures`);
    for (const f of ['Case.tsx', 'case.css']) {
      if (!existsSync(path.join(dir, id, f))) throw new Error(`${id}: missing ${f}`);
    }
    if (e.dumpSnippet && !existsSync(path.join(dir, id, e.dumpSnippet))) {
      throw new Error(`${id}: declares design-side fixture ${e.dumpSnippet} but the file is missing — a declared direction with no artifact is decoration`);
    }
    out.push(e);
  }
  return out;
}

const banner = (what: string) =>
  `/* GENERATED by conformance/build.ts — do not edit. ${what} */\n`;

function seedContract(c: CaseEntry): Record<string, unknown> {
  return {
    $schema: './contract.schema.json',
    id: `conformance.${c.id}`,
    name: exportNameFor(c.id),
    version: '0.1.0',
    status: 'draft',
    description: `SEED contract for the CSS/DOM conformance fixture case "${c.id}" (${c.feature}). The fixture varies CSS CONSTRUCTS, not prop spaces, so the prop space is deliberately EMPTY: every axis the capture would enumerate is held at nothing, and the whole measurement is the computed truth of one mounted rendering. Construct: ${c.construct}`,
    semantics: { element: 'div' },
    props: (c.axes ?? []).map((a) => ({
      name: a.prop,
      type: { enum: a.values },
      default: a.default,
      bindings: {
        figma: {
          kind: 'VARIANT',
          property: a.prop[0].toUpperCase() + a.prop.slice(1),
          values: Object.fromEntries(a.values.map((v) => [v, v[0].toUpperCase() + v.slice(1)])),
        },
        code: { prop: a.prop },
      },
    })),
    states: [],
    anatomy: { root: {} },
    bindings: {
      figma: { ...(c.statePreviews ? { statePreviews: true } : {}), anchors: { fileKey: null, componentSetKey: null } },
      code: { anchors: { importPath: '@ds-contracts/conformance', export: exportNameFor(c.id) } },
    },
  };
}

export function build(): { cases: CaseEntry[] } {
  const cases = loadCases();

  // ---- MANIFEST.json — the denominator -------------------------------------
  const manifest = {
    _marker:
      'THE DENOMINATOR. Hand-authored per case, generated into one index. Deliberately NOT derived from isFusable / styled / DECLARED_CHANNELS / CHANNEL_TO_COMPUTED / TOKEN_CHANNELS / carriedParts — every instrument in the pipeline derives its denominator from the same filter that decides carriage, which is why a channel the filter never opened scores 100%. This file is the independent one.',
    generatedBy: 'conformance/build.ts',
    library: '@ds-contracts/conformance@0.1.0',
    count: cases.length,
    byExpectation: Object.fromEntries(
      DISPOSITIONS.map((d) => [d, cases.filter((c) => c.expect === d).length]),
    ),
    cases,
  };
  writeFileSync(path.join(HERE, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

  // ---- lib/index.jsx --------------------------------------------------------
  const exports = cases
    .map((c) => `export { default as ${exportNameFor(c.id)} } from '../cases/${c.id}/Case.tsx';`)
    .join('\n');
  writeFileSync(
    path.join(HERE, 'lib', 'index.jsx'),
    banner('The fixture library\'s named exports — one per case.') + exports + '\n',
  );

  // ---- lib/conformance.css --------------------------------------------------
  const imports = [`@import './base.css';`, ...cases.map((c) => `@import '../cases/${c.id}/case.css';`)].join('\n');
  writeFileSync(
    path.join(HERE, 'lib', 'conformance.css'),
    banner('The fixture library\'s stylesheet — base + one @import per case.') + imports + '\n',
  );

  // ---- seeds ---------------------------------------------------------------
  const seedDir = path.join(HERE, 'seeds');
  rmSync(seedDir, { recursive: true, force: true });
  mkdirSync(seedDir, { recursive: true });
  for (const c of cases) {
    writeFileSync(path.join(seedDir, `${c.id}.contract.json`), JSON.stringify(seedContract(c), null, 2) + '\n');
  }

  // ---- conformance.config.json — a REAL CaptureConfig -----------------------
  const config = {
    __note:
      'A REAL extract/computed CaptureConfig over the conformance cases. The fixture is a library as far as the engine is concerned: it is mounted through the UNMODIFIED pipeline (npm run extract:computed) with a normal config, and NO engine code path special-cases it. Generated by conformance/build.ts from the hand-authored case directories.',
    library: {
      package: '@ds-contracts/conformance',
      version: '0.1.0',
      framework: 'react',
      classPrefix: 'cf-',
      __classAllow: 'Every fixture class is an IDENTITY class (cf-<case-id>, cf-<child-role>); the fixture ships no modifier classes, so the rule keeps all of them and drops everything else (React/UA classes).',
      classAllow: '^cf-',
      __varPrefix: 'The fixture\'s live custom properties are --cf-*; their DTCG twins are the same names with the prefix stripped (conformance/tokens/conformance.dtcg.json). Two of the cases (custom-prop-two-hop, calc-var) deliberately sit OUTSIDE what the one-hop reader can bind, and say so in their manifest entry.',
      varPrefix: '--cf-',
    },
    mount: {
      imports: ["import '@ds-contracts/conformance/lib/conformance.css';"],
      wrapperOpen: '<>',
      wrapperClose: '</>',
    },
    tokens: {
      dtcg: ['conformance/tokens/conformance.dtcg.json'],
      css: 'conformance/tokens/conformance.vars.css',
      __minted:
        'Omitted deliberately: there is no PREVIOUS round for the fixture, so there is no shipped minted tree. loadConfig refuses a declared-but-missing path by name; an absent declaration is the honest first-pass state.',
    },
    browser: { viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' },
    stage: { width: 320, height: 96, padding: 16 },
    enumeration: { cartesianLimit: 512, unsetLabel: 'unset' },
    components: cases.map((c) => ({
      __case: `${c.feature}: ${c.construct} — declared ${c.expect}`,
      name: exportNameFor(c.id),
      importName: exportNameFor(c.id),
      contract: `conformance/seeds/${c.id}.contract.json`,
      sampleText: c.sampleText ?? '',
      axes: (c.axes ?? []).map((a) => a.prop),
      ...(c.blockStage ? { blockStage: true } : {}),
      ...(c.stage ? { stage: c.stage } : {}),
    })),
  };
  writeFileSync(path.join(HERE, 'conformance.config.json'), JSON.stringify(config, null, 2) + '\n');

  return { cases };
}

/** The capture harness: a node_modules tree the UNMODIFIED runner accepts.
 *  Every dependency is a SYMLINK into the repo's own node_modules — the
 *  fixture is network-free by construction (no npm install step exists), and
 *  react/react-dom/esbuild resolve to exactly the versions the repo pins. */
export function buildSandbox(): string {
  const sandbox = path.join(HERE, '.sandbox');
  const nm = path.join(sandbox, 'node_modules');
  rmSync(sandbox, { recursive: true, force: true });
  mkdirSync(path.join(nm, '.bin'), { recursive: true });
  mkdirSync(path.join(nm, '@ds-contracts'), { recursive: true });
  writeFileSync(
    path.join(sandbox, 'package.json'),
    JSON.stringify({ name: 'conformance-sandbox', private: true, version: '0.0.0' }, null, 2) + '\n',
  );
  const repoNm = path.join(REPO, 'node_modules');
  for (const dep of ['react', 'react-dom', 'esbuild', 'scheduler']) {
    const src = path.join(repoNm, dep);
    if (!existsSync(src)) {
      if (dep === 'scheduler') continue;
      throw new Error(`conformance sandbox: ${dep} is not installed at ${src} — run npm install`);
    }
    symlinkSync(src, path.join(nm, dep), 'dir');
  }
  symlinkSync(HERE, path.join(nm, '@ds-contracts', 'conformance'), 'dir');
  symlinkSync(path.join(repoNm, '.bin', 'esbuild'), path.join(nm, '.bin', 'esbuild'));
  return sandbox;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(HERE, 'build.ts')) {
  const { cases } = build();
  const sandbox = buildSandbox();
  console.log(
    `conformance/build: ${cases.length} cases → MANIFEST.json, lib/index.jsx, lib/conformance.css, ${cases.length} seeds, conformance.config.json; harness at ${path.relative(REPO, sandbox)}`,
  );
  for (const d of DISPOSITIONS) {
    console.log(`  ${d.padEnd(12)} ${cases.filter((c) => c.expect === d).length}`);
  }
}
