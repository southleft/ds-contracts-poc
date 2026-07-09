/**
 * The Emitter interface — the pluggability story, made a type.
 *
 * A contract is the single source of truth; an emitter is ONE projection of
 * it. The four registered here prove the spread: scoped-CSS React (the
 * shipping generator), static HTML+CSS (no build step), inline-styles React
 * (no token pipeline), and the Figma sync script (the canvas itself is just
 * another emit target). A new surface = a new pure function over the same
 * contract — nothing upstream changes.
 *
 * Every emitter is pure (contract + ctx in, file texts out) and browser-
 * importable. Only `react` is wired into `npm run generate`; its output is
 * byte-guarded by evals/golden.json. The others are receipted by
 * core/emitters-check.ts.
 */
import type { Contract } from '../scripts/contract-schema.js';
import type { TokenTreeInput } from './tokens.js';
import { tokenInventoryFromJson } from './tokens.js';
import { emitReact } from './emit-react.js';
import { emitHtml } from './emit-html.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitFigmaScript } from './emit-figma-script.js';
import { kebab } from '../extract/types.js';

export interface EmittedFile {
  /** Suggested file name (relative), e.g. "Badge.tsx", "badge.html". */
  path: string;
  contents: string;
}

/** Everything any emitter may need — data only, no paths. */
export interface EmitterCtx {
  /** Parsed DTCG token trees (see core/tokens.ts TokenTreeInput). */
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
}

const inventoryOf = (t: TokenTreeInput) =>
  tokenInventoryFromJson([t.primitives, t.semantic, t.light, t.dark]);

export const reactEmitter: Emitter = {
  name: 'react',
  label: 'React + CSS Modules (the shipping generator)',
  emit(contract, ctx) {
    const { tsx, css, stories } = emitReact(contract, {
      tokens: inventoryOf(ctx.tokens),
      icons: ctx.icons,
      contracts: ctx.contracts,
    });
    return [
      { path: `${contract.name}.tsx`, contents: tsx },
      { path: `${contract.name}.module.css`, contents: css },
      { path: `${contract.name}.stories.tsx`, contents: stories },
    ];
  },
};

export const htmlEmitter: Emitter = {
  name: 'html',
  label: 'Static HTML + CSS (no build step)',
  emit(contract, ctx) {
    const { html, css } = emitHtml(contract, {
      tokens: inventoryOf(ctx.tokens),
      icons: ctx.icons,
      contracts: ctx.contracts,
    });
    return [
      { path: `${kebab(contract.name)}.html`, contents: html },
      { path: `${kebab(contract.name)}.css`, contents: css },
    ];
  },
};

export const reactInlineEmitter: Emitter = {
  name: 'react-inline',
  label: 'React + inline styles, tokens resolved to literals (no token pipeline)',
  emit(contract, ctx) {
    const { tsx } = emitReactInline(contract, {
      tokens: ctx.tokens,
      icons: ctx.icons,
      contracts: ctx.contracts,
      mode: ctx.mode,
    });
    return [{ path: `${contract.name}.inline.tsx`, contents: tsx }];
  },
};

export const figmaScriptEmitter: Emitter = {
  name: 'figma-script',
  label: 'Figma Plugin API sync script (the canvas as an emit target)',
  emit(contract, ctx) {
    return [
      {
        path: `${kebab(contract.name)}.figma.js`,
        contents: emitFigmaScript(contract, {
          tokens: ctx.tokens,
          icons: ctx.icons,
          contracts: ctx.contracts,
          fileKey: ctx.fileKey,
          mintedTokens: ctx.mintedTokens,
        }),
      },
    ];
  },
};

export const emitters: Emitter[] = [reactEmitter, htmlEmitter, reactInlineEmitter, figmaScriptEmitter];
export const emitterByName = new Map(emitters.map((e) => [e.name, e]));
