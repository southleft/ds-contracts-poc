# @ds-contracts/core

What an emitter needs from the ds-contracts engine, published. A contract is
the single source of truth; an emitter is one projection of it — a pure
function `(contract, ctx) → files`. This package is the contract for that
function, plus the helpers every emitter needs to honour it the way the
CLI's built-ins do:

- **`Emitter` / `EmitterCtx` / `EmittedFile`** — the shapes the CLI enforces
  on `--emitter <module>`.
- **The registry** — `emitters`, `emitterByName`, `getEmitters()`,
  `registerEmitter()`. Process-local: a host that owns the generation loop
  (the CLI, a playground, your build script) registers into its own copy.
- **The token resolver** — `tokenInventoryFromJson` (the set of
  `{token.ref}` paths a contract may bind), `flattenTokens` (DTCG tree →
  dot-path entries, inheriting `$type`), `makeResolveLiteral` (alias-chasing
  literal lookup), `collectTokenPaths`, `aliasTarget`, `px`, `pxOrNull`.
- **`kebab`** — the one spelling of `ComponentName` → `component-name` the
  CLI's file plan uses.
- **Contract provenance** — `canonicalJson`, `revisionOf`,
  `assertContractProvenance`, `markAwaitingCodeAdoption`.
- **The analysis layer** — the contract facts the CLI's built-in emitters
  read, so a plugin emitter reads the same ones: `validateContract(contract,
  byId, errors, icons)` (the deep referee beyond the Zod schema — it APPENDS
  to `errors`, never throws), `generateCss(contract, inventory, errors)` (the
  unformatted scoped stylesheet every code target shares) and
  `stripCanvasOnlyChannels`; multi-root anatomy (`rootElementsOf`,
  `topRoots`, `topRootNames`, `isMultiRoot`); the prop classifiers
  (`isEnum`, `isVariantBool`, `isArrayType`, `enumProps`, `boolProps`,
  `numberProps`, `arrayProps`, `textProps`, `namedTextProps`, `namedSlots`,
  `textDefault`); the A2 grid CSS helpers (`gridCellPlan`, `gridTrackCss`,
  `gridTemplateAreasValue`, `gridGapCss`, `gridParentDecls`,
  `gridPlacementDecls`, `gridChildCrossAxisDecls`, `GRID_SELF_ALIGN`);
  `holderDeclaresPosition`; and the fact tables (`ELEMENT_META`,
  `NATIVE_ROLE_HOSTS`, `PART_STATE_CHANNELS`, `UA_MARGIN_ELEMENTS`,
  `UA_PAINTED_ROOT_ELEMENTS`, `UA_PAINT_CHANNELS`).

```ts
import type { Emitter } from '@ds-contracts/core';
import {
  flattenTokens,
  generateCss,
  kebab,
  makeResolveLiteral,
  tokenInventoryFromJson,
  validateContract,
} from '@ds-contracts/core';

const vue: Emitter = {
  name: 'vue',
  label: 'Vue single-file components',
  emit(contract, ctx) {
    // Refuse the way the built-ins do: the deep referee appends to `errors`.
    const errors: string[] = [];
    validateContract(contract, ctx.contracts, errors, ctx.icons);
    const inventory = tokenInventoryFromJson([ctx.tokens.primitives, ctx.tokens.semantic, ctx.tokens.light, ctx.tokens.dark]);
    const css = generateCss(contract, inventory, errors); // the same sheet the react/html/wc targets emit
    if (errors.length > 0) throw new Error(`Refused:\n${errors.join('\n')}`);
    const all = new Map([
      ...flattenTokens(ctx.tokens.primitives),
      ...flattenTokens(ctx.tokens.semantic),
      ...flattenTokens(ctx.tokens.light),
    ]);
    const literal = makeResolveLiteral(all);
    // ... walk contract.anatomy, resolve `{token.path}` refs with literal(path)
    return [
      { path: `${kebab(contract.name)}.vue`, contents: '<template>…</template>' },
      { path: `${kebab(contract.name)}.css`, contents: css },
    ];
  },
};
export default vue;
```

```sh
ds-contracts generate contracts/ --out vue/ --target vue --emitter ./my-vue-emitter/index.mjs \
  --tokens primitives=tokens.json
```

A plugin module **exports** its Emitter (`default`, `emitter`, or an
`emitters` array); the CLI registers it. Do not call `registerEmitter()` from
the plugin — the CLI bundles its own copy of this registry and never reads
yours.

## Dependency policy

`@ds-contracts/core` depends on `@ds-contracts/schema` (for the `Contract`
type and the anatomy helpers) and nothing else. No TypeScript compiler, no
prettier, no browser automation, no `node:*` at import — every module is
pure and browser-importable. The reference repo's `core/tokens.ts`,
`core/contract-provenance.ts`, `core/emitter.ts`, `extract/types.ts`
(`kebab`) and `core/emit-react.ts` (the analysis half) are re-export shims
over this package's source, so repo and package cannot drift —
`npm run verify:published` regenerates the Flowbite eight's stylesheets
through the packed tarball and refuses on the first byte that differs from
the repo's react emitter.

## Versioning

Independent semver, pre-1.0 while the published surface grows: a
**minor** adds exports; a **patch** changes nothing an emitter can observe;
changes to `Emitter`/`EmitterCtx` shapes are **breaking** and bump the
major. The CLI and the web-components emitter bundle this package in from
the same commit, so they never need a matching range; a third-party emitter
pins `^0.x`.
