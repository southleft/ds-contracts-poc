import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PARITY_SNAPSHOT_VERSION,
  SnapshotInputError,
  parseFigmaComponentsSnapshot,
  parseFigmaTokensSnapshot,
} from './snapshot-schema.js';

const ROOT = process.cwd();
const scratch = mkdtempSync(path.join(os.tmpdir(), 'snapshot-schema-check-'));

const fail = (message: string): never => {
  console.error(`\n✖ snapshot-schema-check: ${message}\n`);
  rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
};
const assert = (condition: unknown, message: string): void => {
  if (!condition) fail(message);
};
const json = (value: unknown): string => JSON.stringify(value);

const currentComponents = {
  snapshotVersion: PARITY_SNAPSHOT_VERSION,
  fileName: 'Schema fixture',
  fileKey: 'fixture-file-key',
  extractedAt: 1_754_000_000_000,
  sets: [
    {
      name: 'Badge',
      nodeId: '1:2',
      key: 'component-key',
      variantCount: 1,
      properties: {
        Variant: {
          type: 'VARIANT',
          defaultValue: 'Info',
          variantOptions: ['Info'],
          preferredValues: null,
          additivePropertyMetadata: true,
        },
      },
      nestedInstances: [],
      contractId: 'ds.badge',
      setFingerprint: 'v6:1',
      setSnapshot: [':COMPONENT_SET/Badge|description|generated'],
      setLive: 'v6:1',
      setLiveSnapshot: [':COMPONENT_SET/Badge|description|generated'],
      setMeasurementError: null,
      variants: [
        {
          name: 'Variant=Info',
          fingerprint: 'v6:2',
          snapshot: [':COMPONENT/Variant=Info|sizing|FILL/HUG'],
          live: 'v6:2',
          liveSnapshot: [':COMPONENT/Variant=Info|sizing|FILL/HUG'],
          measurementError: null,
        },
      ],
      additiveSetMetadata: 'preserved',
    },
  ],
  additiveTopLevelMetadata: { receipt: true },
};

const currentTokens = {
  snapshotVersion: PARITY_SNAPSHOT_VERSION,
  fileName: 'Schema fixture',
  fileKey: 'fixture-file-key',
  extractedAt: 1_754_000_000_000,
  collections: [
    {
      name: 'Semantic',
      modes: ['Light', 'Dark'],
      variables: [
        {
          name: 'color/text',
          type: 'COLOR',
          scopes: ['ALL_FILLS'],
          codeSyntax: 'var(--color-text)',
          values: { Light: '{color/gray/900}', Dark: '#FFFFFF' },
          additiveVariableMetadata: 1,
        },
      ],
      additiveCollectionMetadata: true,
    },
  ],
  additiveTopLevelMetadata: { receipt: true },
};

function expectRefusal(
  run: () => unknown,
  file: string,
  expectedPath: string,
  expectedDetail: RegExp,
): SnapshotInputError {
  try {
    run();
  } catch (error) {
    if (!(error instanceof SnapshotInputError)) {
      fail(`${file} refusal is not a named SnapshotInputError: ${String(error)}`);
    }
    const refusal = error as SnapshotInputError;
    assert(refusal.file === file, `${file} refusal retains its source file`);
    assert(refusal.fieldPath === expectedPath, `${file} refusal names ${expectedPath} (got ${refusal.fieldPath})`);
    assert(expectedDetail.test(refusal.message), `${file} refusal is actionable (got ${refusal.message})`);
    return refusal;
  }
  return fail(`${file} unexpectedly accepted malformed input at ${expectedPath}`);
}

try {
  // Malformed top-level input must not fall through to generic property access.
  expectRefusal(
    () => parseFigmaComponentsSnapshot(json([]), 'figma-components.json'),
    'figma-components.json',
    '$',
    /expected object/i,
  );
  console.log('  §1 malformed top-level    array refused at figma-components.json $');

  // A wrong nested type carries the complete field path.
  const wrongType = structuredClone(currentTokens);
  (wrongType.collections[0].variables[0] as { values: unknown }).values = { Light: {}, Dark: '#FFFFFF' };
  expectRefusal(
    () => parseFigmaTokensSnapshot(json(wrongType), 'figma-tokens.json'),
    'figma-tokens.json',
    '$.collections[0].variables[0].values.Light',
    /invalid input|expected/i,
  );
  console.log('  §2 wrong field type       token object refused with collection/variable/mode path');

  // Variant rows and their measurement evidence are wire-validated.
  const malformedVariant = structuredClone(currentComponents);
  (malformedVariant.sets[0].variants[0] as { liveSnapshot: unknown }).liveSnapshot = [42];
  expectRefusal(
    () => parseFigmaComponentsSnapshot(json(malformedVariant), 'figma-components.json'),
    'figma-components.json',
    '$.sets[0].variants[0].liveSnapshot[0]',
    /expected string/i,
  );
  console.log('  §3 malformed variant      non-string measurement line refused at exact row path');

  // Version selection happens before shape parsing and rejects future writers.
  expectRefusal(
    () =>
      parseFigmaComponentsSnapshot(
        json({ ...currentComponents, snapshotVersion: PARITY_SNAPSHOT_VERSION + 1 }),
        'figma-components.json',
      ),
    'figma-components.json',
    '$.snapshotVersion',
    /unsupported future snapshot version 2/,
  );
  console.log('  §4 future version         version 2 refused by version 1 reader');

  // The committed pre-version shape takes an explicit normalization path.
  const legacy = {
    fileName: 'Legacy fixture',
    fileKey: 'legacy-key',
    legacyReceipt: 'keep-me',
    sets: [
      {
        name: 'Badge',
        nodeId: '1:2',
        key: 'key',
        variantCount: 1,
        properties: {},
        nestedInstances: [],
      },
    ],
  };
  const normalizedLegacy = parseFigmaComponentsSnapshot(json(legacy), 'figma-components.json');
  assert(normalizedLegacy.sourceVersion === 'legacy-unversioned', 'legacy snapshot uses the named migration path');
  assert(normalizedLegacy.value.snapshotVersion === PARITY_SNAPSHOT_VERSION, 'legacy snapshot normalizes to version 1');
  assert(
    (normalizedLegacy.value as typeof normalizedLegacy.value & { legacyReceipt?: string }).legacyReceipt === 'keep-me',
    'safe additive top-level metadata survives normalization',
  );
  console.log('  §5 legacy normalization   unversioned snapshot normalized to v1; additive metadata preserved');

  // The extractor's pinned current shapes validate without migration.
  const parsedComponents = parseFigmaComponentsSnapshot(json(currentComponents), 'figma-components.json');
  const parsedTokens = parseFigmaTokensSnapshot(json(currentTokens), 'figma-tokens.json');
  assert(parsedComponents.sourceVersion === 1 && parsedTokens.sourceVersion === 1, 'current snapshots do not migrate');
  assert(
    (parsedComponents.value.sets[0] as typeof parsedComponents.value.sets[0] & { additiveSetMetadata?: string })
      .additiveSetMetadata === 'preserved',
    'safe additive set metadata is preserved',
  );
  console.log('  §6 current shape          components + collections/modes/aliases accepted as pinned v1');

  // Drive the real differ to pin the public refusal contract and exit code.
  const malformedDir = path.join(scratch, 'malformed');
  mkdirSync(malformedDir);
  writeFileSync(path.join(malformedDir, 'figma-components.json'), json({ sets: 'not-an-array' }));
  const differ = spawnSync(path.join(ROOT, 'node_modules', '.bin', 'tsx'), ['parity/diff.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PARITY_SNAPSHOT_DIR: malformedDir,
      PARITY_REPORT: path.join(scratch, 'must-not-exist.json'),
    },
  });
  const output = `${differ.stdout ?? ''}${differ.stderr ?? ''}`;
  assert(differ.status === 2, `real differ exits 2 for malformed snapshot (got ${differ.status})`);
  assert(
    /SNAPSHOT_INPUT_REFUSAL: .*figma-components\.json at \$\.sets:/.test(output),
    `real differ prints named file + field refusal (got ${output})`,
  );
  console.log('  §7 differ refusal         malformed input exits 2 with named file + $.sets path');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log('\n✔ snapshot-schema-check: parity snapshot inputs are versioned, normalized, and refused before use.');
