/**
 * The built-in emitters + the registry, for the reference repo.
 *
 * The Emitter/EmitterCtx/EmittedFile shapes and the registry itself
 * (emitters, emitterByName, getEmitters, registerEmitter) moved to
 * packages/core/src/emitter.ts (@ds-contracts/core) so a plugin emitter built
 * outside this repo types against the SAME contract the CLI enforces. This
 * module re-exports them (every `../core/emitter.js` import keeps working)
 * and registers the built-ins — scoped-CSS React (the shipping generator),
 * static HTML+CSS (no build step), inline-styles React (no token pipeline),
 * the Figma sync script (the canvas itself is just another emit target), and
 * the two Figma Code Connect flavours (core/emit-code-connect.ts — the set ↔
 * code mapping, opt-in, never part of `npm run generate`) — into that
 * registry, in their load-bearing order, at load.
 *
 * Every emitter is pure (contract + ctx in, file texts out) and browser-
 * importable. Only `react` is wired into `npm run generate`; its output is
 * byte-guarded by evals/golden.json. The others are receipted by
 * core/emitters-check.ts.
 */
import type { TokenTreeInput } from './tokens.js';
import { tokenInventoryFromJson } from './tokens.js';
import { emitReact } from './emit-react.js';
import { emitHtml } from './emit-html.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitFigmaScript } from './emit-figma-script.js';
import { codeConnectEmitter, codeConnectHtmlEmitter } from './emit-code-connect.js';
import { kebab } from '../extract/types.js';
import { registerEmitter, type Emitter } from '../packages/core/src/emitter.js';

export {
  emitterByName,
  emitters,
  getEmitters,
  registerEmitter,
  type EmittedFile,
  type Emitter,
  type EmitterCtx,
} from '../packages/core/src/emitter.js';

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

export { codeConnectEmitter, codeConnectHtmlEmitter } from './emit-code-connect.js';

/** The built-ins register FIRST — in this order — so `emitters` reads
 *  react, html, react-inline, figma-script, code-connect, code-connect-html
 *  before any plugin appends. The registry refuses a second registration by
 *  name, so importing this module twice through different paths would refuse
 *  loudly rather than shadow. */
for (const e of [
  reactEmitter,
  htmlEmitter,
  reactInlineEmitter,
  figmaScriptEmitter,
  codeConnectEmitter,
  codeConnectHtmlEmitter,
])
  registerEmitter(e);
