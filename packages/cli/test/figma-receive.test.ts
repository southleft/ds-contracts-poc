/**
 * `figma receive` — the dev door's pure core, unit-pinned (same discipline
 * as workers/assist/test: plain node:test, tsx-run, no framework).
 *
 * The load-bearing pin: WITHOUT --apply the plan's contractWrite is null —
 * the shell executes exactly the plan, so the no-silent-write guarantee is
 * proved here, not hoped for. A final integration case runs the REAL
 * receiveCommand shell against an in-process fake bridge and asserts the
 * existing contract file's bytes never move without --apply.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CONTRACT_PROPOSAL_TYPE,
  contractFileNameForId,
  figmaCommand,
  findExistingContractFile,
  parseProposal,
  planReceive,
  unifiedDiff,
  type ProposalEnvelope,
} from '../src/commands/figma.js';

// The envelope exactly as the plugin engine's proposeDiff exportJson builds
// it (figma-sync/plugin/engine/entry.ts).
const ENVELOPE = {
  type: CONTRACT_PROPOSAL_TYPE,
  baseContractId: 'polaris.badge',
  baseVersion: '1.0.0',
  setName: 'Badge',
  summary: ['version: 1.0.0 → 1.1.0'],
  proposedContract: { id: 'polaris.badge', name: 'Badge', version: '1.1.0', props: [] },
  proposalNotes: [],
};

// ---------------------------------------------------------------------------
// parseProposal — envelope referee
// ---------------------------------------------------------------------------

test('parseProposal: the plugin exportJson envelope parses, fields carried', () => {
  const r = parseProposal(JSON.parse(JSON.stringify(ENVELOPE)));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.proposal.baseContractId, 'polaris.badge');
    assert.equal(r.proposal.setName, 'Badge');
    assert.deepEqual(r.proposal.summary, ['version: 1.0.0 → 1.1.0']);
    assert.equal((r.proposal.proposedContract as { version?: string }).version, '1.1.0');
  }
});

test('parseProposal: refusals by name — non-object, wrong tag, missing proposedContract, missing id', () => {
  for (const [raw, needle] of [
    ['not-json-object', 'not a JSON object'],
    [{ type: 'CONTRACTS-BUNDLE', contracts: [{}] }, 'not tagged CONTRACT-PROPOSAL'],
    [{ type: CONTRACT_PROPOSAL_TYPE }, 'no "proposedContract" object'],
    [{ type: CONTRACT_PROPOSAL_TYPE, proposedContract: [1] }, 'no "proposedContract" object'],
    [{ type: CONTRACT_PROPOSAL_TYPE, proposedContract: { name: 'x' } }, 'names the contract'],
  ] as Array<[unknown, string]>) {
    const r = parseProposal(raw);
    assert.ok(!r.ok, JSON.stringify(raw));
    if (!r.ok) assert.ok(r.error.includes(needle), `${r.error} should include "${needle}"`);
  }
});

// ---------------------------------------------------------------------------
// unifiedDiff — the reviewed-change renderer
// ---------------------------------------------------------------------------

test('unifiedDiff: identical texts diff to nothing', () => {
  assert.deepEqual(unifiedDiff('a\nb\n', 'a\nb\n', 'x.json'), []);
});

test('unifiedDiff: one changed line yields headers, one hunk, -old +new with context', () => {
  const oldT = ['{', '  "id": "polaris.badge",', '  "version": "1.0.0",', '  "props": []', '}'].join('\n') + '\n';
  const newT = oldT.replace('1.0.0', '1.1.0');
  const d = unifiedDiff(oldT, newT, 'badge.contract.json');
  assert.equal(d[0], '--- a/badge.contract.json');
  assert.equal(d[1], '+++ b/badge.contract.json');
  assert.ok(d[2].startsWith('@@ '), d[2]);
  assert.ok(d.includes('-  "version": "1.0.0",'));
  assert.ok(d.includes('+  "version": "1.1.0",'));
  assert.ok(d.includes(' {'), 'context lines carried');
  assert.equal(d.filter((l) => l.startsWith('@@')).length, 1, 'a single change is a single hunk');
});

test('unifiedDiff: an all-new file is all-additions', () => {
  const d = unifiedDiff('', '{\n}\n', 'new.contract.json');
  assert.ok(d.includes('+{'));
  assert.ok(d.includes('+}'));
  // The old side's single empty line matches the new text's trailing empty
  // line — it rides as context; nothing is removed.
  assert.equal(d.filter((l) => l.startsWith('-') && !l.startsWith('---')).length, 0, 'nothing removed on an all-new file');
});

// ---------------------------------------------------------------------------
// planReceive — the write decision lives in the PURE core
// ---------------------------------------------------------------------------

const proposal = (): ProposalEnvelope => {
  const r = parseProposal(JSON.parse(JSON.stringify(ENVELOPE)));
  if (!r.ok) throw new Error(r.error);
  return r.proposal;
};

test('planReceive WITHOUT --apply: contractWrite is null even when the diff is non-empty — nothing writes silently', () => {
  const existing = { fileName: 'badge.contract.json', text: '{\n  "id": "polaris.badge",\n  "version": "1.0.0"\n}\n' };
  const plan = planReceive(proposal(), existing, false);
  assert.equal(plan.contractWrite, null);
  assert.equal(plan.changed, true);
  assert.ok(plan.diff.length > 0, 'the diff still renders for review');
  assert.equal(plan.fileName, 'badge.contract.json');
  assert.equal(plan.proposalFileName, path.join('.proposals', 'polaris.badge.proposal.json'));
});

test('planReceive WITH --apply: contractWrite carries the canonical new text to the matched file', () => {
  const existing = { fileName: 'oddly-named.contract.json', text: '{"id":"polaris.badge"}' };
  const plan = planReceive(proposal(), existing, true);
  assert.ok(plan.contractWrite);
  // Matched by id: the EXISTING filename wins over the convention.
  assert.equal(plan.contractWrite?.fileName, 'oddly-named.contract.json');
  assert.equal(plan.contractWrite?.contents, JSON.stringify(ENVELOPE.proposedContract, null, 2) + '\n');
});

test('planReceive: byte-identical existing file → changed false, empty diff, no write even with --apply', () => {
  const text = JSON.stringify(ENVELOPE.proposedContract, null, 2) + '\n';
  const plan = planReceive(proposal(), { fileName: 'badge.contract.json', text }, true);
  assert.equal(plan.changed, false);
  assert.deepEqual(plan.diff, []);
  assert.equal(plan.contractWrite, null);
});

test('planReceive: no existing file → the <name>.contract.json convention (namespace prefix drops)', () => {
  const plan = planReceive(proposal(), null, false);
  assert.equal(plan.fileName, 'badge.contract.json');
  assert.equal(contractFileNameForId('acme.pill'), 'pill.contract.json');
  assert.equal(plan.oldText, null);
});

// ---------------------------------------------------------------------------
// findExistingContractFile — id is the identity, filename only the convention
// ---------------------------------------------------------------------------

test('findExistingContractFile: matches by document id across any filename; absent dir/id → null', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dsc-receive-'));
  try {
    writeFileSync(path.join(dir, 'zzz.contract.json'), '{"id":"polaris.badge","version":"1.0.0"}');
    writeFileSync(path.join(dir, 'other.contract.json'), '{"id":"polaris.card"}');
    writeFileSync(path.join(dir, 'broken.contract.json'), '{not json');
    const hit = findExistingContractFile(dir, 'polaris.badge');
    assert.equal(hit?.fileName, 'zzz.contract.json');
    assert.equal(findExistingContractFile(dir, 'polaris.nope'), null);
    assert.equal(findExistingContractFile(path.join(dir, 'absent'), 'polaris.badge'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The SHELL, end to end: real receiveCommand against an in-process fake
// bridge — the existing contract file's bytes never move without --apply.
// ---------------------------------------------------------------------------

test('figma receive (shell) without --apply: proposal artifact saved, contract file untouched; with --apply: written', async () => {
  const dump = JSON.stringify(ENVELOPE);
  let uploaded = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && req.url === '/bridge/session') {
      res.end(JSON.stringify({ code: 'ABC234', ttlSeconds: 900 }));
    } else if (req.method === 'GET' && req.url === '/bridge/ABC234') {
      // First poll delivers (the test plugin "already uploaded").
      uploaded = true;
      res.end(`{"status":"delivered","kind":"proposal","dump":${dump}}`);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'nothing is waiting under that code' }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), 'dsc-receive-shell-'));
  const contractPath = path.join(dir, 'badge.contract.json');
  const before = '{\n  "id": "polaris.badge",\n  "version": "1.0.0"\n}\n';
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(contractPath, before);

    // WITHOUT --apply: the contract file must not move by a byte.
    const code = await figmaCommand(['receive', '--out', dir, '--bridge', bridge]);
    assert.equal(code, 0);
    assert.ok(uploaded, 'the fake bridge served the delivery');
    assert.equal(readFileSync(contractPath, 'utf8'), before, 'contract file bytes moved WITHOUT --apply');
    const artifact = path.join(dir, '.proposals', 'polaris.badge.proposal.json');
    assert.ok(existsSync(artifact), 'proposal artifact saved');
    assert.equal((JSON.parse(readFileSync(artifact, 'utf8')) as { type: string }).type, CONTRACT_PROPOSAL_TYPE);

    // WITH --apply: the contract file becomes the proposal, canonical form.
    const code2 = await figmaCommand(['receive', '--out', dir, '--bridge', bridge, '--apply']);
    assert.equal(code2, 0);
    assert.equal(readFileSync(contractPath, 'utf8'), JSON.stringify(ENVELOPE.proposedContract, null, 2) + '\n');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// A wrong-kind delivery refuses by name and exits non-zero — the dev door
// never lands a canvas dump as a contract.
test('figma receive (shell): a dump-kind delivery is refused by name, nothing written', async () => {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && req.url === '/bridge/session') {
      res.end(JSON.stringify({ code: 'ABC234', ttlSeconds: 900 }));
    } else {
      res.end('{"status":"delivered","kind":"dump","dump":{"Badge":{}}}');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), 'dsc-receive-kind-'));
  try {
    const code = await figmaCommand(['receive', '--out', dir, '--bridge', bridge]);
    assert.equal(code, 1);
    assert.ok(!existsSync(path.join(dir, '.proposals')), 'nothing written on refusal');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
