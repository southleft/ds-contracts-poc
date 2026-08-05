#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DOCUMENT_PATH = 'docs/26-v1-definition.md';

export const REQUIREMENT_IDS = Object.freeze([
  'V1-SCOPE-01',
  'V1-JOURNEY-01',
  'V1-JOURNEY-02',
  'V1-JOURNEY-03',
  'V1-CLASS-01',
  'V1-CLASS-02',
  'V1-COMPAT-01',
  'V1-COMPAT-02',
  'V1-COMPAT-03',
  'V1-COMPAT-04',
  'V1-EVID-01',
  'V1-EVID-02',
  'V1-EVID-03',
  'V1-EVID-04',
  'V1-EVID-05',
  'V1-SEC-01',
  'V1-SEC-02',
  'V1-CI-01',
  'V1-CI-02',
  'V1-REL-01',
  'V1-REL-02',
  'V1-REL-03',
]);

export const PROVEN_ARCHETYPES = Object.freeze([
  'button',
  'badge/tag/chip',
  'checkbox/radio',
  'toggle/switch',
  'banner/alert/toast',
  'input/field',
  'card',
  'avatar',
  'tabs',
  'accordion',
  'progress/spinner',
  'slider',
]);

export const ATTEMPTED_ARCHETYPES = Object.freeze([
  'select/combobox',
  'modal/dialog',
  'tooltip/popover',
  'menu/dropdown',
  'pagination',
  'table/data-grid',
]);

export const REQUIRED_CI_LANES = Object.freeze(['fast', 'full', 'catalog-visual']);

export const POST_V1_ENTRIES = Object.freeze([
  '**Medium and architecture boundaries:** irreducible CSS↔canvas mismatches, web DOM only, closed shadow roots, no behavior/motion beyond the declared interaction surface, no model in conversion, desktop development-plugin distribution, and no background polling ([Known Limitations §A](23-known-limitations.md#a--irreducible)).',
  '**Experimental component classes:** overlays, portals, complex tables, comboboxes, menus, pagination, and every never-attempted/absent archetype; especially data grids, trees, virtualized lists, date pickers, rich text, and charts ([§§B.1–B.10 and C.1.1](23-known-limitations.md#b1-overlays-and-portals-lose-their-source-token-names-in-every-library)).',
  '**Brownfield workflow gaps:** no in-place adoption of a hand-built Figma set, API-only reconciliation, and no general concurrent-change merge or write-back workflow ([§§B.11–B.13](23-known-limitations.md#b11-adopting-a-hand-built-figma-set-is-not-a-verb-this-tool-has)).',
  '**Known fidelity and reader ceilings:** text wrapping and webfont metrics, multi-axis geometry/paint products, unopened pseudo-element channels, responsive/viewport constructs, shorthand and `calc()` token references, and the other measured residuals in [§§B and C](23-known-limitations.md#b--not-built-yet).',
  '**Coverage beyond the measured slice:** no whole-library, primitives-only, or exhaustive-correctness promise. The unmeasured long tail remains post-v1 research ([Known Limitations §C.1](23-known-limitations.md#c1-coverage--how-much-of-a-library-is-actually-captured)).',
]);

const ID_SET = new Set(REQUIREMENT_IDS);
const LINK_RE = /\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const NPM_RUN_RE = /\bnpm\s+(?:--prefix\s+([^\s`;&]+)\s+)?run\s+([A-Za-z0-9:_-]+)/g;

const normalizeSpace = (value) => value.replace(/\s+/g, ' ').trim();
const stripEmphasis = (value) => value.replace(/^\*\*|\*\*$/g, '').trim();

export function splitMarkdownRow(line) {
  const cells = [];
  let cell = '';
  let codeFenceLength = 0;
  for (let index = 1; index < line.length - 1; index += 1) {
    const character = line[index];
    if (character === '\\' && line[index + 1] === '|') {
      cell += '|';
      index += 1;
      continue;
    }
    if (character === '`') {
      let run = 1;
      while (line[index + run] === '`') run += 1;
      codeFenceLength = codeFenceLength === 0 ? run : codeFenceLength === run ? 0 : codeFenceLength;
      cell += '`'.repeat(run);
      index += run - 1;
      continue;
    }
    if (character === '|' && codeFenceLength === 0) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseRequirementTables(markdown) {
  const rows = [];
  const lines = markdown.split(/\r?\n/);
  let inRequirements = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+Requirements\s*$/.test(line)) {
      inRequirements = true;
      continue;
    }
    if (inRequirements && /^##\s+/.test(line)) break;
    if (!inRequirements || !/^\s*\|.*\|\s*$/.test(line)) continue;
    const cells = splitMarkdownRow(line.trim());
    if (cells.length !== 3) continue;
    const id = stripEmphasis(cells[0]);
    if (id === 'ID' || /^-+$/.test(id)) continue;
    rows.push({
      id,
      requirement: cells[1],
      acceptance: cells[2],
      line: index + 1,
    });
  }
  return rows;
}

export function parsePostV1Entries(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let inSection = false;
  let current;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+Approved post-v1 limitations\s*$/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection) continue;
    const start = line.match(/^(\d+)\.\s+(.*)$/);
    if (start) {
      if (current) entries.push(current);
      current = { number: Number(start[1]), line: index + 1, parts: [start[2]] };
    } else if (current && (/^\s{2,}\S/.test(line) || line.trim() === '')) {
      if (line.trim()) current.parts.push(line.trim());
    } else if (current) {
      entries.push(current);
      current = undefined;
    }
  }
  if (current) entries.push(current);
  return entries.map(({ parts, ...entry }) => ({ ...entry, text: normalizeSpace(parts.join(' ')) }));
}

export function githubAnchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

export function markdownAnchors(markdown) {
  const anchors = new Set();
  const repetitions = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = githubAnchor(match[1]);
    const seen = repetitions.get(base) ?? 0;
    repetitions.set(base, seen + 1);
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
  }
  return anchors;
}

function exactFloor(range) {
  const match = typeof range === 'string' ? range.match(/^>=(\d+)$/) : null;
  return match ? Number(match[1]) : null;
}

function lineForOffset(markdown, offset) {
  return markdown.slice(0, offset).split(/\r?\n/).length;
}

function expectedCompatibilityCommand(rootManifest, cliManifest) {
  const nodeFloor = rootManifest.engines?.node;
  const cliNodeFloor = cliManifest.engines?.node;
  const reactFloor = rootManifest.peerDependencies?.react;
  const reactDomFloor = rootManifest.peerDependencies?.['react-dom'];
  return `node -e "const r=require('./package.json'),c=require('./packages/cli/package.json');if(r.engines.node!=='${nodeFloor}'||c.engines.node!=='${cliNodeFloor}'||r.peerDependencies.react!=='${reactFloor}'||r.peerDependencies['react-dom']!=='${reactDomFloor}')process.exit(1)"`;
}

function parseArchetypeList(text, startPattern, endPattern) {
  const start = text.match(startPattern);
  if (!start) return [];
  return start[1]
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index, values) => {
      if (index !== values.length - 1) return value;
      return value.replace(endPattern, '').trim();
    });
}

function sameList(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

/**
 * Pure validation entry point. All repository state is supplied through
 * `context`, so tests can mutate the real Markdown in memory without touching
 * the checkout.
 */
export function validateV1Definition(markdown, context) {
  const diagnostics = [];
  const lines = markdown.split(/\r?\n/);
  const fail = (line, message) => diagnostics.push(`${DOCUMENT_PATH}:${line}: ${message}`);
  const rows = parseRequirementTables(markdown);
  const rowById = new Map();

  for (const row of rows) {
    if (!row.id || !row.requirement || !row.acceptance) {
      fail(row.line, `requirement table row has an empty cell`);
    }
    if (!ID_SET.has(row.id)) fail(row.line, `unexpected requirement ID "${row.id}"`);
    const prior = rowById.get(row.id);
    if (prior) fail(row.line, `duplicate requirement ID "${row.id}" (first seen on line ${prior.line})`);
    else rowById.set(row.id, row);
    if (row.acceptance && !/`[^`]+`/.test(row.acceptance) && !/\bEvidence\s*:/i.test(row.acceptance)) {
      fail(row.line, `${row.id || 'requirement row'} has no command or Evidence: mapping`);
    }
    if (/\b(?:TODO|TBD)\b/i.test(row.acceptance)) {
      fail(row.line, `${row.id || 'requirement row'} contains TODO/TBD evidence`);
    }
  }

  for (const id of REQUIREMENT_IDS) {
    if (!rowById.has(id)) fail(25, `missing requirement ID "${id}"`);
  }

  const tokenRe = /\bV1-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g;
  let tokenMatch;
  while ((tokenMatch = tokenRe.exec(markdown)) !== null) {
    const line = lineForOffset(markdown, tokenMatch.index);
    const row = rows.find((candidate) => candidate.line === line && candidate.id === tokenMatch[0]);
    if (!ID_SET.has(tokenMatch[0]) || !row) fail(line, `stale V1 token "${tokenMatch[0]}" outside the pinned ID column`);
  }

  const postEntries = parsePostV1Entries(markdown);
  if (postEntries.length !== POST_V1_ENTRIES.length) {
    fail(83, `approved post-v1 register has ${postEntries.length} entries; expected ${POST_V1_ENTRIES.length}`);
  }
  for (let index = 0; index < POST_V1_ENTRIES.length; index += 1) {
    const entry = postEntries[index];
    if (!entry) continue;
    if (entry.number !== index + 1) fail(entry.line, `post-v1 entry ${index + 1} is numbered ${entry.number}`);
    if (entry.text !== POST_V1_ENTRIES[index]) fail(entry.line, `post-v1 entry ${index + 1} drifted from its pinned normalized text`);
    if (!/\]\(23-known-limitations\.md#[^)]+\)/.test(entry.text)) {
      fail(entry.line, `post-v1 exclusion ${index + 1} lacks an anchored docs/23 link`);
    }
  }

  const rootManifest = context.manifests.get('.');
  const cliManifest = context.manifests.get('packages/cli');
  if (!rootManifest || !cliManifest) {
    fail(1, `validation context is missing root or packages/cli manifest`);
  } else {
    const rootNode = exactFloor(rootManifest.engines?.node);
    const cliNode = exactFloor(cliManifest.engines?.node);
    const react = exactFloor(rootManifest.peerDependencies?.react);
    const reactDom = exactFloor(rootManifest.peerDependencies?.['react-dom']);
    const compat = rowById.get('V1-COMPAT-01');
    if (rootNode === null || cliNode === null || rootNode !== cliNode) {
      fail(compat?.line ?? 1, `root and CLI Node floors must be matching exact >=major ranges`);
    }
    if (react === null || reactDom === null || react !== reactDom) {
      fail(compat?.line ?? 1, `React and React DOM floors must be matching exact >=major ranges`);
    }
    if (compat) {
      if (!new RegExp(`\\bNode ${rootNode} or newer\\b`).test(compat.requirement)) {
        fail(compat.line, `Node floor in prose does not match manifest floor ${rootManifest.engines?.node}`);
      }
      if (!new RegExp(`\\bReact and React DOM ${react} or newer\\b`).test(compat.requirement)) {
        fail(compat.line, `React floor in prose does not match manifest floor ${rootManifest.peerDependencies?.react}`);
      }
      const command = expectedCompatibilityCommand(rootManifest, cliManifest);
      if (compat.acceptance !== `\`${command}\``) {
        fail(compat.line, `compatibility assertion must exactly derive and compare all manifest floors`);
      }
    }
  }

  const audit = rowById.get('V1-SEC-02');
  if (audit && audit.acceptance !== '`npm audit --omit=dev --audit-level=high`') {
    fail(audit.line, `npm audit command must be exactly "npm audit --omit=dev --audit-level=high"`);
  }

  for (const row of rows) {
    for (const code of row.acceptance.matchAll(/`([^`]+)`/g)) {
      for (const segment of code[1].split(/\s*&&\s*/)) {
        if (/^npm\s+(?:--prefix\s+\S+\s+)?run\s+\S+/.test(segment)) continue;
        if (row.id === 'V1-COMPAT-01' && segment.startsWith('node -e ')) continue;
        if (row.id === 'V1-SEC-02' && segment.startsWith('npm audit ')) continue;
        fail(row.line, `${row.id} contains unrecognized direct command "${segment}"`);
      }
    }
  }

  const classProven = rowById.get('V1-CLASS-01');
  if (classProven) {
    const actual = parseArchetypeList(
      classProven.requirement,
      /PROVEN\*\* archetypes[^:]*:\s*(.+?)(?=\. Each claim)/,
      /\.$/,
    );
    if (!sameList(actual, PROVEN_ARCHETYPES)) {
      fail(classProven.line, `PROVEN archetypes drifted; expected ${PROVEN_ARCHETYPES.join('; ')}`);
    }
  }
  const classAttempted = rowById.get('V1-CLASS-02');
  if (classAttempted) {
    const match = classAttempted.requirement.match(/experimental, not v1-supported:\s*(.+?)\. Never-attempted/);
    const actual = match
      ? match[1].split(',').map((value) => value.trim().replace(/^and\s+/, ''))
      : [];
    if (!sameList(actual, ATTEMPTED_ARCHETYPES)) {
      fail(classAttempted.line, `ATTEMPTED — BOUNDED archetypes drifted; expected ${ATTEMPTED_ARCHETYPES.join(', ')}`);
    }
  }

  const ci = rowById.get('V1-CI-01');
  if (ci) {
    const lanes = [...ci.acceptance.matchAll(/\bnpm run ci:lane ([A-Za-z0-9-]+)/g)].map((match) => match[1]);
    if (!sameList(lanes, REQUIRED_CI_LANES)) {
      fail(ci.line, `named CI lanes drifted; expected ${REQUIRED_CI_LANES.join(', ')}`);
    }
  }
  for (const lane of REQUIRED_CI_LANES) {
    if (!context.ciLanes.has(lane)) fail(ci?.line ?? 1, `named CI lane "${lane}" has no workflow`);
  }

  for (const row of rows) {
    NPM_RUN_RE.lastIndex = 0;
    let match;
    while ((match = NPM_RUN_RE.exec(row.acceptance)) !== null) {
      const prefix = match[1] ? path.posix.normalize(match[1].replace(/^\.\//, '')) : '.';
      const manifest = context.manifests.get(prefix);
      if (!manifest) {
        fail(row.line, `npm --prefix "${prefix}" has no package manifest`);
      } else if (!Object.hasOwn(manifest.scripts ?? {}, match[2])) {
        const command = prefix === '.' ? `npm run ${match[2]}` : `npm --prefix ${prefix} run ${match[2]}`;
        fail(row.line, `"${command}" names a nonexistent script`);
      }
    }
  }

  LINK_RE.lastIndex = 0;
  let linkMatch;
  while ((linkMatch = LINK_RE.exec(markdown)) !== null) {
    const raw = linkMatch[1];
    if (/^(?:https?:|mailto:|data:)/.test(raw)) continue;
    const line = lineForOffset(markdown, linkMatch.index);
    const [targetPart, anchor] = raw.split('#', 2);
    const target = targetPart
      ? path.posix.normalize(path.posix.join(path.posix.dirname(DOCUMENT_PATH), targetPart))
      : DOCUMENT_PATH;
    if (!context.files.has(target) && target !== DOCUMENT_PATH) {
      fail(line, `broken relative link target "${raw}"`);
      continue;
    }
    if (anchor) {
      const targetMarkdown = target === DOCUMENT_PATH ? markdown : context.files.get(target);
      if (typeof targetMarkdown !== 'string' || !markdownAnchors(targetMarkdown).has(decodeURIComponent(anchor))) {
        fail(line, `broken relative link anchor "${raw}"`);
      }
    }
  }

  const mutablePatterns = [
    ['percentage', /\b\d+(?:\.\d+)?%/g],
    ['semver', /(?:\^|~)?v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g],
    ['count', /\b\d+\s+(?:requirements?|entries?|checks?|lanes?|archetypes?|components?|variants?|rows?|items?)\b/gi],
  ];
  lines.forEach((line, index) => {
    for (const [kind, pattern] of mutablePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        fail(index + 1, `unrecognized mutable ${kind} claim "${match[0]}" is not derived`);
      }
    }
  });

  return diagnostics;
}

export function loadRepositoryContext(root) {
  const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
  const manifests = new Map([
    ['.', readJson('package.json')],
    ['packages/cli', readJson('packages/cli/package.json')],
    ['packages/schema', readJson('packages/schema/package.json')],
    [
      'packages/emitter-web-components',
      readJson('packages/emitter-web-components/package.json'),
    ],
  ]);
  const files = new Map();
  for (const relative of [
    DOCUMENT_PATH,
    'docs/23-known-limitations.md',
    'docs/24-what-works.md',
    'parity/receipts/live-figma-variant-drift.md',
    'CONTRIBUTING.md',
  ]) {
    const absolute = path.join(root, relative);
    if (existsSync(absolute)) files.set(relative, readFileSync(absolute, 'utf8'));
  }
  const ciLanes = new Set(
    ['fast', 'full', 'catalog-visual'].filter((lane) =>
      existsSync(path.join(root, '.github', 'workflows', `${lane}.yml`)),
    ),
  );
  return { manifests, files, ciLanes };
}

export function runV1DefinitionCheck(root) {
  const context = loadRepositoryContext(root);
  const markdown = context.files.get(DOCUMENT_PATH);
  const diagnostics = validateV1Definition(markdown, context);
  if (diagnostics.length) {
    console.error(`✖ v1 definition gate found ${diagnostics.length} defect(s):`);
    diagnostics.forEach((diagnostic) => console.error(`  ${diagnostic}`));
    return 1;
  }
  console.log(
    `✔ v1 definition is deterministic: ${REQUIREMENT_IDS.length} requirements, ` +
      `${POST_V1_ENTRIES.length} post-v1 limitations, and ${REQUIRED_CI_LANES.length} named CI lanes`,
  );
  return 0;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runV1DefinitionCheck(ROOT);
}
