/**
 * THE TWO 403s — `npm run figma:rest:refusal:check`.
 *
 * WHY THIS EXISTS. Until 2026-08-04 `fetchVariables` treated every 403 from
 * `/v1/files/:key/variables/local` identically, on the authority of a comment
 * that read "Enterprise-only. A 403 (plan) or 404 is the EXPECTED degraded
 * path". A real call with this repo's own PAT against this repo's own file
 * returned a 403 that says something else entirely:
 *
 *   {"status":403,"error":true,"message":"Invalid scope(s): files:read,
 *    file_comments:write, file_dev_resources:read, file_dev_resources:write,
 *    webhooks:write. This endpoint requires the file_variables:read scope"}
 *
 * with GET /v1/files/:key returning 200 on the same token. That is a SCOPE
 * error — one checkbox the user forgot when minting the token — and it was
 * being reported to them as nothing at all.
 *
 * WHAT THIS GATE PINS, and how each assertion fails:
 *   1. the measured body, verbatim → kind 'scope', userFixable, and the
 *      remedy names the scope. Broaden the matcher to any 403 and (2) fires.
 *   2. a 403 that names NO scope → kind 'unknown', NOT userFixable, and the
 *      message must not assert a plan tier as fact. Collapse the two kinds
 *      back into one and this fires.
 *   3. a 403 that merely says the word "scope" without naming
 *      `file_variables:read` → still 'unknown'. This is the OVER-APPLICATION
 *      probe: a matcher loose enough to catch it would tell users to re-mint
 *      a token that was never the problem.
 *   4. 404 → 'unknown' (a file with no variables endpoint is not a scope bug).
 *   5. end-to-end through fetchVariables with an injected fetch: still returns
 *      undefined (the degradation did not change shape) AND the classified
 *      refusal reaches the caller. Drop the `onVariablesUnavailable` call and
 *      this fires while every classifier assertion above stays green — which
 *      is the whole point of testing the plumbing separately from the rule.
 *   6. a 500 still THROWS. Widening the swallowed set is the quiet way this
 *      degradation becomes a silence.
 *
 * WHAT IT DOES NOT ASSERT. That the Enterprise-plan limit is fictional. The
 * measurement above says the OBSERVED 403 was a scope error; whether a PAT
 * that carries `file_variables:read` then succeeds on this (non-Enterprise)
 * file is UNTESTED and needs a human to mint one. docs/HANDOFF.md carries the
 * one-curl probe and both branches of what it would mean.
 *
 * No credential, no network — every case is a recorded body through an
 * injected fetch.
 */
import { classifyVariablesRefusal, fetchVariables, type FetchLike } from './fetch.js';

const failures: string[] = [];
const ok: string[] = [];
const check = (label: string, cond: boolean, detail: string) => {
  if (cond) ok.push(label);
  else failures.push(`${label} — ${detail}`);
};

/** VERBATIM, as returned by api.figma.com on 2026-08-04. Do not tidy. */
const MEASURED_SCOPE_403 =
  '{"status":403,"error":true,"message":"Invalid scope(s): files:read, file_comments:write, ' +
  'file_dev_resources:read, file_dev_resources:write, webhooks:write. This endpoint requires ' +
  'the file_variables:read scope"}';

// A 403 body shaped like a plan/permission refusal. NOT a recording — this
// project has never observed one, which is exactly why it must classify as
// 'unknown' and not as anything more specific.
const UNNAMED_403 = '{"status":403,"error":true,"message":"Not allowed"}';

// The over-application trap: the word "scope" without the scope that matters.
const DECOY_403 =
  '{"status":403,"error":true,"message":"Invalid scope(s): files:read. This endpoint requires ' +
  'the file_dev_resources:write scope"}';

// ---------------------------------------------------------------------------
// 1-4 · the classifier
// ---------------------------------------------------------------------------
{
  const r = classifyVariablesRefusal(403, MEASURED_SCOPE_403);
  check('1 measured 403 → scope', r.kind === 'scope', `got kind=${r.kind}`);
  check('1 measured 403 → user-fixable', r.userFixable === true, `got userFixable=${r.userFixable}`);
  check(
    '1 remedy names the scope',
    r.message.includes('file_variables:read'),
    `message does not name the scope: ${r.message}`,
  );
  check('1 body preserved', r.body.includes('Invalid scope(s)'), 'the API\'s own words were dropped');
}
{
  const r = classifyVariablesRefusal(403, UNNAMED_403);
  check('2 unnamed 403 → unknown', r.kind === 'unknown', `got kind=${r.kind}`);
  check('2 unnamed 403 → NOT user-fixable', r.userFixable === false, `got userFixable=${r.userFixable}`);
  check(
    '2 plan tier is hedged, not asserted',
    /UNVERIFIED/.test(r.message) && !/Enterprise-only|is Enterprise/.test(r.message),
    `message asserts a cause this project never measured: ${r.message}`,
  );
}
{
  const r = classifyVariablesRefusal(403, DECOY_403);
  check(
    '3 a 403 naming a DIFFERENT scope → unknown (over-application probe)',
    r.kind === 'unknown',
    `a body about file_dev_resources:write classified as ${r.kind} — the matcher is too loose ` +
      'and would tell the user to re-mint a token that was never the problem',
  );
}
{
  const r = classifyVariablesRefusal(404, '');
  check('4 404 → unknown', r.kind === 'unknown' && !r.userFixable, `got kind=${r.kind}`);
}

// ---------------------------------------------------------------------------
// 5-6 · the plumbing — does a classified refusal actually reach a caller?
// ---------------------------------------------------------------------------
const stubFetch = (status: number, body: string): FetchLike => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => JSON.parse(body || '{}'),
  text: async () => body,
});

{
  const seen: Array<{ kind: string; userFixable: boolean }> = [];
  const result = await fetchVariables('FILEKEY', 'tok', {
    fetchImpl: stubFetch(403, MEASURED_SCOPE_403),
    onVariablesUnavailable: (info) => seen.push({ kind: info.kind, userFixable: info.userFixable }),
  });
  check('5 still degrades to undefined', result === undefined, `got ${JSON.stringify(result)}`);
  check('5 the caller is told', seen.length === 1, `onVariablesUnavailable fired ${seen.length}×`);
  check(
    '5 and told the USER-FIXABLE truth',
    seen[0]?.kind === 'scope' && seen[0]?.userFixable === true,
    `got ${JSON.stringify(seen[0])}`,
  );
}
{
  // No callback supplied — the old call shape must keep working untouched.
  const result = await fetchVariables('FILEKEY', 'tok', { fetchImpl: stubFetch(403, UNNAMED_403) });
  check('5 callback is optional', result === undefined, `got ${JSON.stringify(result)}`);
}
{
  let threw: string | null = null;
  let fired = 0;
  try {
    await fetchVariables('FILEKEY', 'tok', {
      fetchImpl: stubFetch(500, '{"status":500,"error":true,"message":"boom"}'),
      onVariablesUnavailable: () => fired++,
    });
  } catch (e) {
    threw = (e as Error).message;
  }
  check('6 a 500 still throws', threw !== null, 'a server error was swallowed as a degradation');
  check('6 and is not misreported as a refusal', fired === 0, `onVariablesUnavailable fired ${fired}× on a 500`);
}
{
  // The happy path must be untouched by all of the above.
  const payload = '{"meta":{"variables":{"1:2":{"id":"1:2","name":"color/white"}}}}';
  const result = (await fetchVariables('FILEKEY', 'tok', { fetchImpl: stubFetch(200, payload) })) as
    | { meta?: { variables?: Record<string, unknown> } }
    | undefined;
  check(
    '7 a 200 still returns the payload',
    !!result?.meta?.variables && Object.keys(result.meta.variables).length === 1,
    `got ${JSON.stringify(result)}`,
  );
}

// ---------------------------------------------------------------------------
console.log(`THE TWO 403s — ${ok.length + failures.length} assertion(s)\n`);
for (const label of ok) console.log(`  ✔ ${label}`);
if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} failure(s):`);
  for (const f of failures) console.error(`    ${f}`);
  process.exit(1);
}
console.log(
  `\n✔ the scope 403 is separated from every other refusal, the separation is narrow enough to ` +
    `refuse a decoy, and the classified refusal reaches the caller.`,
);
