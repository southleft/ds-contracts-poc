/** Current-engine replay, separate from the immutable canvas-to-code-v1 evidence. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCanvasToCode} from './canvas-to-code.js';
import {prepareRecording} from './canvas-to-code-held-out-current.js';

export const CURRENT_CANVAS_TO_CODE_ROOT = 'recipe/evidence/canvas-to-code-current-global-error-2026-10-06';

export async function recordCurrentCanvasToCode(root: string) {
  prepareRecording(root);
  return runCanvasToCode(true, root);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const run = args.length === 1 && args[0] === '--check'
    ? runCanvasToCode(false, CURRENT_CANVAS_TO_CODE_ROOT)
    : args.length === 2 && args[0] === '--record-to' && typeof args[1] === 'string' && !args[1].startsWith('--')
      ? recordCurrentCanvasToCode(path.resolve(args[1]))
      : Promise.reject(new Error('Use --check or --record-to <new-directory>; historical evidence is not replaced.'));
  run.then(receipt => console.log(JSON.stringify({render:receipt.render,qualification:'computed-style accounting; not a visual or product grade'})))
    .catch(error => { console.error(String(error)); process.exitCode = 1; });
}
