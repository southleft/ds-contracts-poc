import { importFromUrl, type ClientOptions } from '../../../extract/figma/rest/fetch.js';

/** The application follows the same bounded, same-file dependency walk as
 * the CLI. A browser user supplies only the URL and token. */
export function importFigmaUrl(url: string, token: string, transport: ClientOptions = {}) {
  return importFromUrl(url, token, { ...transport, closure: true });
}
