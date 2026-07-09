/**
 * CORS gate. The Worker serves exactly one client: the playground on
 * Cloudflare Pages (plus its *.pages.dev preview deployments, one label
 * deep). Everything else — including requests with no Origin at all, i.e.
 * curl — is refused with 403. This is a browser-only API on purpose: the
 * origin check is one of the abuse-resistance layers, not a formality.
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
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
