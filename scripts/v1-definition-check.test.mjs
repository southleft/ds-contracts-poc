import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DOCUMENT_PATH,
  loadRepositoryContext,
  parsePostV1Entries,
  parseRequirementTables,
  validateV1Definition,
} from './v1-definition-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = readFileSync(path.join(ROOT, DOCUMENT_PATH), 'utf8');
const CONTEXT = loadRepositoryContext(ROOT);

function replaceOnce(markdown, before, after) {
  const first = markdown.indexOf(before);
  assert.notEqual(first, -1, `fixture text not found: ${before}`);
  assert.equal(markdown.indexOf(before, first + before.length), -1, `fixture text is not unique: ${before}`);
  return `${markdown.slice(0, first)}${after}${markdown.slice(first + before.length)}`;
}

function removeRequirement(markdown, id) {
  return markdown
    .split('\n')
    .filter((line) => !line.includes(`**${id}**`))
    .join('\n');
}

function requirementLine(markdown, id) {
  const line = markdown.split('\n').find((candidate) => candidate.includes(`**${id}**`));
  assert.ok(line, `missing fixture row ${id}`);
  return line;
}

function expectFailure(markdown, pattern) {
  const diagnostics = validateV1Definition(markdown, CONTEXT);
  assert.ok(
    diagnostics.some((diagnostic) => pattern.test(diagnostic)),
    `expected ${pattern}; got:\n${diagnostics.join('\n')}`,
  );
  assert.ok(
    diagnostics.every((diagnostic) => /^docs\/26-v1-definition\.md:\d+: /.test(diagnostic)),
    `all diagnostics must carry source lines:\n${diagnostics.join('\n')}`,
  );
}

test('the real v1 definition is a valid baseline', () => {
  assert.equal(parseRequirementTables(BASELINE).length, 23);
  assert.equal(parsePostV1Entries(BASELINE).length, 5);
  assert.deepEqual(validateV1Definition(BASELINE, CONTEXT), []);
});

test('rejects a missing requirement ID', () => {
  expectFailure(removeRequirement(BASELINE, 'V1-SCOPE-01'), /missing requirement ID "V1-SCOPE-01"/);
});

test('rejects a duplicate requirement ID', () => {
  const row = requirementLine(BASELINE, 'V1-SCOPE-01');
  expectFailure(replaceOnce(BASELINE, row, `${row}\n${row}`), /duplicate requirement ID "V1-SCOPE-01"/);
});

test('rejects an unexpected requirement ID', () => {
  expectFailure(replaceOnce(BASELINE, '**V1-SCOPE-01**', '**V1-SCOPE-99**'), /unexpected requirement ID "V1-SCOPE-99"/);
});

test('rejects empty requirement table cells', () => {
  const row = requirementLine(BASELINE, 'V1-SCOPE-01');
  const empty = row.replace(
    'The supported audience is a design-system team working on web DOM components, using the contract as the reviewed source between code and Figma. Native mobile and non-DOM renderers are excluded.',
    '',
  );
  expectFailure(replaceOnce(BASELINE, row, empty), /requirement table row has an empty cell/);
});

test('rejects stale V1 tokens outside the pinned ID column', () => {
  expectFailure(`${BASELINE}\nStale release key: V1-OLD-99.\n`, /stale V1 token "V1-OLD-99"/);
});

test('rejects acceptance cells without an evidence mapping', () => {
  const row = requirementLine(BASELINE, 'V1-REL-01');
  const unmapped = row.replace(
    'Evidence: the release PR contains a complete P0/P1 audit ledger with task ID, closing commit, acceptance command, and result; zero rows may be open, waived, or missing.',
    'A reviewer looks at the release.',
  );
  expectFailure(replaceOnce(BASELINE, row, unmapped), /V1-REL-01 has no command or Evidence: mapping/);
});

test('rejects TODO or TBD evidence', () => {
  const row = requirementLine(BASELINE, 'V1-REL-01');
  const pending = row.replace('Evidence: the release PR', 'Evidence: TODO — the release PR');
  expectFailure(replaceOnce(BASELINE, row, pending), /contains TODO\/TBD evidence/);
});

test('rejects nonexistent root npm scripts', () => {
  const row = requirementLine(BASELINE, 'V1-SCOPE-01');
  const invalid = row.replace('npm run docs:check', 'npm run docs:not-real');
  expectFailure(replaceOnce(BASELINE, row, invalid), /npm run docs:not-real.*nonexistent script/);
});

test('rejects nonexistent --prefix npm scripts', () => {
  const row = requirementLine(BASELINE, 'V1-CI-02');
  const invalid = row.replace('npm --prefix packages/cli run build', 'npm --prefix packages/cli run not-real');
  expectFailure(
    replaceOnce(BASELINE, row, invalid),
    /npm --prefix packages\/cli run not-real.*nonexistent script/,
  );
});

test('rejects broken relative link targets', () => {
  expectFailure(
    replaceOnce(BASELINE, '[What Works](24-what-works.md)', '[What Works](missing.md)'),
    /broken relative link target "missing\.md"/,
  );
});

test('rejects broken relative link anchors', () => {
  expectFailure(
    replaceOnce(
      BASELINE,
      '23-known-limitations.md#a4-out-of-scope-by-decision--not-gaps',
      '23-known-limitations.md#not-a-real-heading',
    ),
    /broken relative link anchor/,
  );
});

test('rejects post-v1 exclusions without docs/23 anchors', () => {
  expectFailure(
    replaceOnce(
      BASELINE,
      '([Known Limitations §A](23-known-limitations.md#a--irreducible))',
      '(Known Limitations §A)',
    ),
    /post-v1 exclusion 1 lacks an anchored docs\/23 link/,
  );
});

test('rejects normalized post-v1 entry drift', () => {
  expectFailure(
    replaceOnce(BASELINE, '**Experimental component classes:** overlays', '**Experimental component classes:** all overlays'),
    /post-v1 entry 2 drifted/,
  );
});

test('rejects Node floor drift from manifests', () => {
  expectFailure(
    replaceOnce(BASELINE, 'support Node 20 or newer', 'support Node 21 or newer'),
    /Node floor in prose does not match manifest floor >=20/,
  );
});

test('rejects React floor drift from manifests', () => {
  expectFailure(
    replaceOnce(BASELINE, 'React and React DOM 18 or newer', 'React and React DOM 19 or newer'),
    /React floor in prose does not match manifest floor >=18/,
  );
});

test('rejects drift in the PROVEN archetype list', () => {
  expectFailure(replaceOnce(BASELINE, '; slider. Each claim', '. Each claim'), /PROVEN archetypes drifted/);
});

test('rejects drift in the ATTEMPTED archetype list', () => {
  expectFailure(replaceOnce(BASELINE, ', pagination, and table/data-grid', ', and table/data-grid'), /ATTEMPTED — BOUNDED archetypes drifted/);
});

test('rejects drift in named CI lanes', () => {
  expectFailure(
    replaceOnce(BASELINE, 'npm run ci:lane catalog-visual', 'npm run ci:lane visual'),
    /named CI lanes drifted/,
  );
});

test('rejects new mutable percentage claims', () => {
  expectFailure(`${BASELINE}\nCurrent coverage is 99%.\n`, /unrecognized mutable percentage claim "99%"/);
});

test('rejects new mutable semver claims', () => {
  expectFailure(`${BASELINE}\nThe release currently uses 1.2.3.\n`, /unrecognized mutable semver claim "1.2.3"/);
});

test('rejects new mutable count claims', () => {
  expectFailure(`${BASELINE}\nThe release currently has 23 requirements.\n`, /unrecognized mutable count claim "23 requirements"/);
});

test('rejects compatibility commands that are not the exact derived assertion', () => {
  expectFailure(
    replaceOnce(BASELINE, `')process.exit(1)"\``, `')throw new Error('floor drift')"\``),
    /compatibility assertion must exactly derive and compare all manifest floors/,
  );
});

test('rejects newly introduced direct commands', () => {
  const row = requirementLine(BASELINE, 'V1-EVID-01');
  const invalid = row.replace('`npm run eval', '`node scripts/ungated.mjs && npm run eval');
  expectFailure(replaceOnce(BASELINE, row, invalid), /contains unrecognized direct command "node scripts\/ungated\.mjs"/);
});

test('rejects npm audit commands other than the production high-severity form', () => {
  expectFailure(
    replaceOnce(BASELINE, 'npm audit --omit=dev --audit-level=high', 'npm audit --audit-level=high'),
    /npm audit command must be exactly/,
  );
});
