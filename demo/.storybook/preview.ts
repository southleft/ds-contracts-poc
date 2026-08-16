/**
 * The demo's token layer. The components in `demo/generated` bind every paint
 * and metric to `var(--imported-…)` custom properties, so without this import
 * Storybook renders them as unstyled text — correct structure, no paint.
 *
 * Regenerate with:
 *   node scripts/build-tokens.mjs --flat \
 *     examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json,demo/proposed/minted.dtcg.json \
 *     --out demo/generated/tokens.css
 *
 * The third tree is the PROVISIONAL one the inversion minted; it is what makes
 * a re-minted channel resolve instead of falling back to nothing.
 */
import '../generated/tokens.css';

export default { parameters: {} };
