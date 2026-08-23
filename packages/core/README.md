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

```ts
import type { Emitter } from '@ds-contracts/core';
import { flattenTokens, makeResolveLiteral, kebab } from '@ds-contracts/core';

const vue: Emitter = {
  name: 'vue',
  label: 'Vue single-file components',
  emit(contract, ctx) {
    const all = new Map([
      ...flattenTokens(ctx.tokens.primitives),
      ...flattenTokens(ctx.tokens.semantic),
      ...flattenTokens(ctx.tokens.light),
    ]);
    const literal = makeResolveLiteral(all);
    // ... walk contract.anatomy, resolve `{token.path}` refs with literal(path)
    return [{ path: `${kebab(contract.name)}.vue`, contents: '<template>…</template>' }];
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
`core/contract-provenance.ts`, `core/emitter.ts` and `extract/types.ts`
(`kebab`) are re-export shims over this package's source, so repo and
package cannot drift.

## Versioning

Independent semver, pre-1.0 while the published surface grows: a
**minor** adds exports; a **patch** changes nothing an emitter can observe;
changes to `Emitter`/`EmitterCtx` shapes are **breaking** and bump the
major. The CLI and the web-components emitter bundle this package in from
the same commit, so they never need a matching range; a third-party emitter
pins `^0.x`.
