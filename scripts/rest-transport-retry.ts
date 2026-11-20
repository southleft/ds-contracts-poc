/** The React to Figma runner's REST transport retry (scripts/react-to-figma-run.ts, the settle reads). A fetch that throws a
 *  network failure (never an HTTP status, never any other error) is retried after each wait in turn, about 2.5 minutes in all:
 *  a20 and a9 were voided by a blip that 3 tries 5 s apart (15 s) did not outlast. Each retry is reported, as before. */
export const TRANSPORT_WAITS_MS = [5_000, 15_000, 45_000, 90_000] as const;
const TRANSPORT_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'];
export const isTransportFailure = (error: unknown): boolean => {
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return (error instanceof TypeError && ['fetch failed', 'terminated'].includes(error.message)) || (typeof code === 'string' && TRANSPORT_CODES.includes(code));
};
export async function retryTransport<T>(read: () => Promise<T>, onRetry: (attempt: number) => void,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      if (!isTransportFailure(error) || attempt >= TRANSPORT_WAITS_MS.length) throw error;
      onRetry(attempt + 1);
      await sleep(TRANSPORT_WAITS_MS[attempt]!);
    }
  }
}
