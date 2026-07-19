/**
 * Lazy chunk entry — the browser-dependent computed-capture runner.
 *
 * Bundled separately (dist/computed.js, playwright-core EXTERNAL) and
 * imported only by `ds-contracts extract --computed`. The runner reads
 * --config/--harness/--out/--root/--component from process.argv itself, so
 * importing this module IS running it — same contract as
 * `tsx extract/computed/run.ts` in the reference repo.
 */
import '../../../extract/computed/run.js';
