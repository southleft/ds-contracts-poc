/**
 * The Emitter contract — the pluggability story, made a type and PUBLISHED.
 *
 * A contract is the single source of truth; an emitter is ONE projection of
 * it: a pure function (contract + ctx in, file texts out), browser-importable,
 * no paths. The four built-ins (react, html, react-inline, figma-script) live
 * in the reference repo's core/emitter.ts and register themselves into THIS
 * registry at load; a plugin emitter (`ds-contracts generate --emitter
 * <module>`, @ds-contracts/emitter-*) exports an Emitter object and the HOST
 * registers it.
 *
 * Identity note for plugin authors: the registry is process-local. The CLI
 * bundles its own copy of this module, so a plugin that calls
 * registerEmitter() on ITS copy registers into a registry the CLI never
 * reads. Export the Emitter (`default`, `emitter`, or an `emitters` array)
 * and let the CLI register it; registerEmitter() is for hosts that own the
 * generation loop (the CLI, the playground, a custom build script).
 */
import type { Contract } from '@ds-contracts/schema';
import type { TokenTreeInput } from './tokens.js';

export interface EmittedFile {
  /** Suggested file name (relative), e.g. "Badge.tsx", "badge.html". */
  path: string;
  contents: string;
}

/** Everything any emitter may need — data only, no paths. */
export interface EmitterCtx {
  /** Parsed DTCG token trees (see tokens.ts TokenTreeInput). */
  tokens: TokenTreeInput;
  /** Icon asset name → SVG markup. */
  icons: Map<string, string>;
  /** Every known contract by id — composition refs resolve through it. */
  contracts: Map<string, Contract>;
  /** figma-script: overrides the anchor file key in the WRONG FILE guard. */
  fileKey?: string;
  /** figma-script: minted provisional tokens (`imported.*` DTCG tree) — the
   *  script gains a preamble that upserts them as Figma variables, so it runs
   *  in files that never synced them. Absent/empty → no preamble. */
  mintedTokens?: Record<string, unknown>;
  /** react-inline: token resolution mode (default 'light'). */
  mode?: 'light' | 'dark';
}

export interface Emitter {
  name: string;
  label: string;
  emit(contract: Contract, ctx: EmitterCtx): EmittedFile[];
  /** `true` = an explicit-target surface (e.g. Figma Code Connect) that is
   *  NOT one of the generate surfaces: it needs facts a fresh proposal never
   *  carries (a synced set's anchors) and refuses by name without them, so
   *  the "every surface emits" sweeps (census, gauntlet, overlap, theme-mode,
   *  repeat-collection) read `generateSurfaces()` and never count it. */
  optIn?: boolean;
}

/** The LIVE registry. `emitters` keeps its exported name and identity —
 *  registerEmitter() appends to the SAME array, so every consumer that
 *  iterates `emitters` generically (playground tabs, emitters-check,
 *  browser-check) sees plugin emitters without edits. The reference repo's
 *  core/emitter.ts pushes the four built-ins here, in their load-bearing
 *  order, before anything else can. */
export const emitters: Emitter[] = [];
export const emitterByName = new Map<string, Emitter>();

/** Registry snapshot — same live contents as `emitters`, copied so callers
 *  cannot mutate the registry by accident. */
export const getEmitters = (): Emitter[] => [...emitters];

/** The surfaces `generate` runs without an explicit --target — every
 *  registered emitter that is not `optIn`. Same live registry, filtered. */
export const generateSurfaces = (): Emitter[] => emitters.filter((e) => !e.optIn);

/** Register an emitter. Refuses by name: a missing/invalid shape or a name
 *  collision (including the built-ins) never silently shadows an existing
 *  projection. */
export function registerEmitter(emitter: Emitter): Emitter {
  if (!emitter || typeof emitter !== 'object') {
    throw new Error('registerEmitter: not an Emitter object');
  }
  const { name, label, emit } = emitter;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('registerEmitter: emitter.name must be a non-empty string');
  }
  if (typeof label !== 'string' || label.trim() === '') {
    throw new Error(`registerEmitter: emitter "${name}" needs a human-readable label`);
  }
  if (typeof emit !== 'function') {
    throw new Error(`registerEmitter: emitter "${name}" has no emit(contract, ctx) function`);
  }
  if (emitterByName.has(name)) {
    throw new Error(
      `registerEmitter: an emitter named "${name}" is already registered — names are identities, pick another`,
    );
  }
  emitters.push(emitter);
  emitterByName.set(name, emitter);
  return emitter;
}
