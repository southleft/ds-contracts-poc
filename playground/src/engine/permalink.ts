/**
 * Shareable permalinks (W10) — playground state in the URL hash, no backend.
 *
 * What travels: the contract JSON text, the active output tab, and the theme.
 * What NEVER travels: user tokens, the Figma token, the Anthropic key — the
 * share surface carries the artifact, not the session's secrets.
 *
 * Format: `#s=<v>.<base64url payload>` where v names the codec:
 *   1 — deflate-raw via the browser-native CompressionStream (preferred),
 *   0 — plain UTF-8 JSON (fallback when CompressionStream is unavailable) —
 * so any encoder's output stays decodable by any decoder. Links over
 * SHARE_LIMIT_BYTES are refused with a NAMED warning instead of a silently
 * broken URL (proxies and chat apps truncate long URLs).
 */

export interface ShareState {
  /** The contract editor text, verbatim. */
  contract: string;
  /** The active output tab ('preview' or an emitter name). */
  output: string;
  theme: 'light' | 'dark';
}

/** Above this payload length the Share button warns by name instead of copying. */
export const SHARE_LIMIT_BYTES = 8 * 1024;

// --------------------------------------------------------------- base64url

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

// ------------------------------------------------------- deflate round trip

const pipeThrough = async (bytes: Uint8Array, stream: TransformStream): Promise<Uint8Array> => {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
};

const hasCompressionStream = () => typeof CompressionStream === 'function';

// ------------------------------------------------------------------ public

/** Encode state → the `#s=` payload (`<v>.<base64url>`). */
export async function encodeShareState(state: ShareState): Promise<string> {
  const json = new TextEncoder().encode(
    JSON.stringify({ c: state.contract, o: state.output, t: state.theme }),
  );
  if (hasCompressionStream()) {
    const deflated = await pipeThrough(json, new CompressionStream('deflate-raw'));
    return `1.${toBase64Url(deflated)}`;
  }
  return `0.${toBase64Url(json)}`;
}

/** Decode a `#s=` payload back to state. Throws with a NAMED reason. */
export async function decodeShareState(payload: string): Promise<ShareState> {
  const dot = payload.indexOf('.');
  const version = dot > 0 ? payload.slice(0, dot) : '';
  const body = payload.slice(dot + 1);
  if ((version !== '0' && version !== '1') || !body) {
    throw new Error(`share-link-unreadable: unknown payload version "${version || payload.slice(0, 8)}"`);
  }
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(body);
    if (version === '1') {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('this browser has no DecompressionStream to inflate the link');
      }
      bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    }
  } catch (e) {
    throw new Error(
      `share-link-unreadable: the payload does not decode — ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('share-link-unreadable: the decoded payload is not JSON');
  }
  const record = parsed as { c?: unknown; o?: unknown; t?: unknown };
  if (typeof record.c !== 'string' || typeof record.o !== 'string') {
    throw new Error('share-link-unreadable: the decoded payload is missing the contract or output tab');
  }
  return {
    contract: record.c,
    output: record.o,
    theme: record.t === 'dark' ? 'dark' : 'light',
  };
}

/** The share payload in the current URL's hash, if any. */
export function sharePayloadFromLocation(): string | null {
  const m = window.location.hash.match(/^#s=(.+)$/);
  return m ? m[1] : null;
}
