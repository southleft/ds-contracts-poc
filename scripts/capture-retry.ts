// Chromium on CI runners sometimes refuses a page capture with this exact protocol error: seven times in six fast-lane
// jobs on 2026-11-09 and 2026-11-10, at four call sites. A capture is retried once on that error and nothing else; any
// other failure, or the same error twice, is thrown unchanged. The failed call returned no image, and Playwright restores
// what it changed for the capture (background, animations) before it throws. So a retry changes no measurement, only
// whether a capture happens.
export const CAPTURE_REFUSED = 'Protocol error (Page.captureScreenshot): Unable to capture screenshot';
export async function retryCapture<T>(shot: () => Promise<T>): Promise<T> {
  try { return await shot(); } catch (e) { if (!(e instanceof Error) || !e.message.includes(CAPTURE_REFUSED)) throw e; }
  return shot();
}
