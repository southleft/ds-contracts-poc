import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAudit } from './audit-classify.mjs';

test("the CI 500 that reddened the lane is an ENDPOINT failure, not a finding", () => {
  const v = classifyAudit({ error: 'Internal Server Error' }, 1, 'npm error audit endpoint returned an error');
  assert.equal(v.kind, 'endpoint');
  assert.match(v.reason, /Internal Server Error/);
});

test("a dead registry names its reason even though error.summary is EMPTY", () => {
  // The shape that made the first version print "failed — " with a blank reason.
  const parsed = { message: 'request to https://127.0.0.1:9/…/quick failed, reason: connect ECONNREFUSED', error: { summary: '', detail: '' } };
  const v = classifyAudit(parsed, 1, '');
  assert.equal(v.kind, 'endpoint');
  assert.match(v.reason, /ECONNREFUSED/);
});

test("a high advisory is a FINDING and is named", () => {
  const parsed = {
    metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 2, critical: 0 }, dependencies: { total: 400 } },
    vulnerabilities: { lodash: { severity: 'high' }, minimist: { severity: 'high' }, chalk: { severity: 'low' } },
  };
  const v = classifyAudit(parsed, 1, '');
  assert.equal(v.kind, 'vulnerable');
  assert.equal(v.count, 2);
  assert.deepEqual(v.names.sort(), ['lodash (high)', 'minimist (high)']);
});

test("critical counts with high", () => {
  const v = classifyAudit({ metadata: { vulnerabilities: { high: 0, critical: 1 } }, vulnerabilities: { x: { severity: 'critical' } } }, 1, '');
  assert.equal(v.kind, 'vulnerable');
  assert.equal(v.count, 1);
});

test("a clean answer is clean, and low/moderate do not fail it", () => {
  const v = classifyAudit({ metadata: { vulnerabilities: { low: 3, moderate: 1, high: 0, critical: 0 }, dependencies: { total: 386 } } }, 0, '');
  assert.equal(v.kind, 'clean');
  assert.equal(v.total, 4);
  assert.equal(v.dependencies, 386);
});

test("exit 0 with unparseable output is an endpoint failure, never a pass", () => {
  assert.equal(classifyAudit(null, 0, '').kind, 'endpoint');
});
