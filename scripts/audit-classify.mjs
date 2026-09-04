/**
 * THE npm-audit VERDICT, AS A PURE FUNCTION — so the branch that matters can be
 * tested with planted shapes instead of by waiting for npm's endpoint to break.
 *
 * Three outcomes, and the whole point is that the middle one is not the last one:
 *   · 'clean'    — the endpoint answered and there is nothing high or critical.
 *   · 'endpoint' — the endpoint did not answer. NOTHING WAS AUDITED. Retryable;
 *                  if it never answers the caller still fails, but says this.
 *   · 'vulnerable' — the endpoint answered and named high/critical advisories.
 *
 * Shapes measured 2026-09-04 from real runs:
 *   · the CI 500:      { error: 'Internal Server Error' }
 *   · two CI runs:     { error: 'Bad Request' }
 *   · a dead registry: { message: 'request to … ECONNREFUSED', error: { summary: '', detail: '' } }
 * The last is why an empty `error.summary` may not be read as "no error": the
 * key's PRESENCE is the signal, and the text comes from whichever field has any.
 */
export function classifyAudit(parsed, status, stderr = '') {
  if (parsed !== null && typeof parsed === 'object' && 'error' in parsed) {
    return { kind: 'endpoint', reason: reasonFrom(parsed, status, stderr) };
  }
  if (parsed === null) {
    return status === 0
      ? { kind: 'endpoint', reason: 'npm exited 0 but wrote no parseable JSON' }
      : { kind: 'endpoint', reason: reasonFrom(parsed, status, stderr) };
  }
  const vulns = parsed.metadata?.vulnerabilities ?? {};
  const high = (vulns.high ?? 0) + (vulns.critical ?? 0);
  if (high > 0) {
    const names = Object.entries(parsed.vulnerabilities ?? {})
      .filter(([, v]) => v?.severity === 'high' || v?.severity === 'critical')
      .map(([name, v]) => `${name} (${v.severity})`);
    return { kind: 'vulnerable', count: high, names };
  }
  const total = Object.values(vulns).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  return { kind: 'clean', total, dependencies: parsed.metadata?.dependencies?.total ?? null };
}

function reasonFrom(parsed, status, stderr) {
  const e = parsed?.error;
  const fromError = typeof e === 'string' ? e : [e?.summary, e?.detail].filter((x) => x && String(x).trim()).join(' — ');
  const fromStderr = String(stderr || '')
    .split('\n')
    .filter((l) => /npm (warn|error)/.test(l) && !/debug-0\.log/.test(l))
    .join(' ')
    .trim();
  return [parsed?.message, fromError, fromStderr].find((x) => x && String(x).trim()) ?? `npm exited ${status} with no diagnosis`;
}
