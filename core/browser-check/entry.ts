/** Browser-bundle smoke entry — imports the WHOLE barrel so any node:* import
 *  anywhere in the core module graph fails the bundle. */
import * as core from '../index.js';
// Touch enough surface that tree-shaking cannot drop the heavy paths.
console.log(Object.keys(core).length, core.emitters.length);
