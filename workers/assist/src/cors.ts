/**
 * Browser CORS policy. The assist surface is exposed to the playground on
 * Cloudflare Pages (plus its *.pages.dev preview deployments, one label
 * deep). This limits which browser pages can read responses; it is NOT
 * authentication or authorization because non-browser callers can omit or
 * spoof Origin. Sensitive bridge data uses an explicit capability instead.
 */
import type { Env } from './env';

const PLAYGROUND_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?ds-contracts-playground\.pages\.dev$/;

export function resolveOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  if (PLAYGROUND_ORIGIN_RE.test(origin)) return origin;
  if (env.ASSIST_DEV_ORIGIN && origin === env.ASSIST_DEV_ORIGIN) return origin;
  return null;
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-bridge-read-capability',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
