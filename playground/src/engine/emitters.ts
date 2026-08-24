/**
 * The emitter registry, with the built-ins registered on a path the bundler
 * cannot drop.
 *
 * core/emitter.ts registers react / html / react-inline / figma-script (and
 * the opt-in Code Connect pair) into packages/core's `emitters` array at
 * load. The root package.json declares `"sideEffects": ["**\/*.css"]`, so the
 * production bundle (Rolldown under Vite) treats every other module as
 * side-effect free and drops that load-time loop — the dev server does not
 * tree-shake, so the loss is invisible there. Found 2026-08-23 walking the
 * BUILT Playground: the registry was EMPTY, every Code tab had no emitter,
 * and the Code → Figma walkthrough refused `no emitter registered as
 * "figma-script"`. A bare value import of the four does not survive either:
 * a module assumed side-effect free keeps only the statements its used
 * exports depend on.
 *
 * So the registration is an expression whose VALUE the page uses: `emitters`
 * here is the registry returned by a call that registers any built-in the
 * load-time loop did not. In node and in the dev server the loop ran first
 * and this registers nothing; in the bundle it is what fills the registry.
 * The guard refuses at load if any built-in is still missing.
 */
import {
  emitters as registry,
  figmaScriptEmitter,
  htmlEmitter,
  reactEmitter,
  reactInlineEmitter,
  registerEmitter,
  type Emitter,
} from '../../../core/index.js';

export const BUILTIN_EMITTERS: readonly Emitter[] = [reactEmitter, htmlEmitter, reactInlineEmitter, figmaScriptEmitter];

function withBuiltins(target: Emitter[]): Emitter[] {
  for (const e of BUILTIN_EMITTERS) {
    if (!target.includes(e)) registerEmitter(e);
  }
  for (const e of BUILTIN_EMITTERS) {
    if (!target.includes(e)) {
      throw new Error(`playground: built-in emitter "${e.name}" is not in the registry after registration (playground/src/engine/emitters.ts)`);
    }
  }
  return target;
}

/** The live registry — the same array core exports — with the built-ins present. */
export const emitters: Emitter[] = withBuiltins(registry);
