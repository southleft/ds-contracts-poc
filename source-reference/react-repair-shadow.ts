/** A root shadow as React rendered it, read the way the compiler reads it:
 * the engine's own box-shadow parser (the one that turned the computed value
 * into native effects) and the native reader's float32-tolerant comparison. */
import {createFigmaEngine,type NodeSpec} from '../core/emit-figma-script.js';
import {nativeShadowStackMatches} from '../core/native-source-observation.js';

let engine:ReturnType<typeof createFigmaEngine>|undefined;
// The parser reads no token: an empty corpus compiles the same reader.
const reader=()=>engine??=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()} as unknown as Parameters<typeof createFigmaEngine>[0]);

export function repairShadowShows(css:unknown,effects:unknown):boolean {
  if(typeof css!=='string')return false;
  const stack=reader().parseShadowStack(css);
  return !!stack&&nativeShadowStackMatches({effectStack:stack} as NodeSpec,effects);
}
