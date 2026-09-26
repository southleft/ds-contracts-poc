/** Preserve structured host refusals, but never mistake an empty timeout or
 * proxy error page for a JSON parsing failure or a confirmed operation result. */
export async function readSourceResponse(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    const detail = response.ok ? 'returned an incomplete or invalid response'
      : `could not confirm this request (HTTP ${response.status})`;
    throw Error(`The local app ${detail}. Check the current status before trying again.`);
  }
}
