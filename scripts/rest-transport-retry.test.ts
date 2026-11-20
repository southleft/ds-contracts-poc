import assert from 'node:assert/strict';
import test from 'node:test';
import { retryTransport, TRANSPORT_WAITS_MS } from './rest-transport-retry.js';

test('the runner rides out a REST transport blip: four failures pass after 5, 15, 45 and 90 s, a fifth voids; other errors are never retried', async () => {
  const run = async (failures: number, error: () => Error = () => new TypeError('fetch failed')) => {
    let calls = 0; const tries: number[] = [], waits: number[] = [];
    try {
      const value = await retryTransport(async () => { if (calls++ < failures) throw error(); return 'read'; }, (t) => tries.push(t), async (ms) => { waits.push(ms); });
      return { value, calls, tries, waits };
    } catch (e) { return { thrown: (e as Error).message, calls, tries, waits }; }
  };
  assert.deepEqual(await run(4), { value: 'read', calls: 5, tries: [1, 2, 3, 4], waits: [5000, 15000, 45000, 90000] });
  assert.deepEqual(await run(5), { thrown: 'fetch failed', calls: 5, tries: [1, 2, 3, 4], waits: [...TRANSPORT_WAITS_MS] }, 'the fifth failure voids, as the third did before');
  assert.deepEqual(await run(1, () => Object.assign(new Error('socket'), { cause: { code: 'ECONNRESET' } })), { value: 'read', calls: 2, tries: [1], waits: [5000] });
  assert.deepEqual(await run(1, () => new SyntaxError('Unexpected token')), { thrown: 'Unexpected token', calls: 1, tries: [], waits: [] }, 'not a transport failure: never retried');
  assert.deepEqual(await run(0), { value: 'read', calls: 1, tries: [], waits: [] });
});
