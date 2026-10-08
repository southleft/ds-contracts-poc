import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const runner = fileURLToPath(new URL('./run-lane.ts', import.meta.url));
const loader = import.meta.resolve('tsx');
function run(condition: string, files: string[] = [], command = 'node -e "require(\'fs\').writeFileSync(\'ran\', \'yes\')"') {
  const root = mkdtempSync(path.join(tmpdir(), 'lane-guard-'));
  try {
    mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
    for (const file of files) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), '{}');
    }
    writeFileSync(path.join(root, '.github/workflows/fast.yml'), JSON.stringify({ jobs: { test: { steps: [{
      if: '${{ !cancelled() && steps.setup.outcome == \'success\' && ' + condition + ' }}', run: command,
    }] } } }));
    const result = spawnSync(process.execPath, ['--import', loader, runner, 'fast'], { cwd: root, encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr, ran: existsSync(path.join(root, 'ran')) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('absent sandbox skips command without counting a pass; present sandbox runs it', () => {
  const file = 'recipe/sandboxes/input-field-mui/node_modules/@mui/material/package.json';
  const condition = `hashFiles('${file}') != ''`;
  const absent = run(condition);
  assert.equal(absent.status, 0);
  assert.equal(absent.ran, false);
  assert.match(absent.output, /0\/1 gates passed/);
  assert.match(absent.output, /1 gate\(s\) skipped/);
  const present = run(condition, [file]);
  assert.equal(present.status, 0);
  assert.equal(present.ran, true);
});

test('attestation wildcard runs only for matching input files', () => {
  const condition = "hashFiles('private/*-security-attestation.json') != ''";
  assert.equal(run(condition, ['private/other.json']).ran, false);
  assert.equal(run(condition, ['private/release-security-attestation.json']).ran, true);
});

test('real failures propagate and unsupported conditions fail without executing', () => {
  const failure = run("hashFiles('present.json') != ''", ['present.json'], 'node -e "process.exit(7)"');
  assert.equal(failure.status, 1);
  const unknown = run("hashFiles('missing.json') != '' && unexpected() ");
  assert.equal(unknown.status, 1);
  assert.equal(unknown.ran, false);
  assert.match(unknown.output, /Unsupported local gate condition/);
});
