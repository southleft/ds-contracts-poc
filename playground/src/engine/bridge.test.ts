import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { createBridgeSession, pollBridge } from './bridge';

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

const capability = 'ab'.repeat(24);

test('bridge dump reads require and send the session read capability', async (t) => {
  await t.test('sends the capability header on every poll', async () => {
    let pollHeaders: Headers | undefined;
    globalThis.fetch = async (_input, init) => {
      if (init?.method === 'POST') {
        return Response.json({
          code: 'ABC234',
          readCapability: capability,
          ttlSeconds: 900,
        });
      }
      pollHeaders = new Headers(init?.headers);
      return Response.json({ status: 'waiting' });
    };

    const result = await createBridgeSession();
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const poll = await pollBridge(
      result.session.code,
      result.session.readCapability,
    );
    assert.deepEqual(poll, { status: 'waiting' });
    assert.equal(pollHeaders?.get('X-Bridge-Read-Capability'), capability);
  });

  await t.test(
    'refuses absent or malformed session capabilities locally',
    async () => {
      let fetchCalls = 0;
      const sessionBodies = [
        { code: 'ABC234', ttlSeconds: 900 },
        { code: 'ABC234', readCapability: 'not-a-capability', ttlSeconds: 900 },
      ];
      globalThis.fetch = async () => {
        const body = sessionBodies[fetchCalls];
        fetchCalls += 1;
        return Response.json(body);
      };

      const absent = await createBridgeSession();
      const malformed = await createBridgeSession();
      assert.equal(absent.ok, false);
      assert.equal(malformed.ok, false);

      const callsBeforeLocalPoll = fetchCalls;
      const localPoll = await pollBridge('ABC234', '');
      assert.equal(localPoll.status, 'error');
      assert.equal(fetchCalls, callsBeforeLocalPoll);
    },
  );

  await t.test(
    'does not expose the capability in user-facing errors',
    async () => {
      globalThis.fetch = async () =>
        Response.json(
          { error: `named refusal must not echo ${capability}` },
          { status: 403 },
        );

      const poll = await pollBridge('ABC234', capability);
      assert.equal(poll.status, 'error');
      if (poll.status !== 'error') return;
      assert.equal(poll.message.includes(capability), false);
      assert.match(poll.message, /\[redacted\]/);
    },
  );
});
