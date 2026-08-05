# @ds-contracts/cli

`ds-contracts` — contracts as the deterministic bridge between design and code. Every verb is a thin shell over the same engine the reference repo's npm scripts run, esbuild-bundled so an install has **zero required runtime dependencies** (`playwright-core` is optional, loaded lazily by `extract --computed` only).

```
ds-contracts init                                      # write ds-contracts.config.json
ds-contracts onboard <package>                         # detect → draft → stop for review
ds-contracts onboard --continue                        # capture → promote → emit → bundle
ds-contracts extract [config] [--reconcile]            # code → proposed contracts (react-tsx | cem)
ds-contracts extract --computed --config <capture.json> --harness <dir> [--out <dir>]
                                                       # real-browser computed-style capture
ds-contracts promote --config <library.json>           # reviewed capture → promoted contracts
ds-contracts generate <contracts..> --out <dir>        # contract → code
    [--target react|html|react-inline|figma-script|<registered>]
    [--tokens f,f] [--icons dir] [--stories] [--emitter <module>]
ds-contracts figma <contracts..> --out <dir>           # contract → Figma sync scripts
ds-contracts figma bundle <contracts..> --out <file>   # contracts + tokens → ONE self-contained
    --tokens <base.dtcg.json[,minted.dtcg.json]>       # CONTRACTS-BUNDLE JSON (paste it into the
    [--modes <light.json[,dark.json]>] [--name <col>]  # plugin's Build tab; deterministic bytes)
ds-contracts figma push <file> --code <CODE>           # send a CONTRACTS-BUNDLE to the plugin bridge
ds-contracts figma receive --out <dir> [--apply]        # receive a proposal; no writes without --apply
ds-contracts diff [config]                             # parity referee — exit 0 clean · 1 drift · 2 error
ds-contracts propose-pr <file> --repo owner/name [--dry-run]
                                                       # open a contract change as a reviewable PR
```

- **Emitter plugins**: `--emitter <module>` dynamic-imports a module exporting an `Emitter` (`default`, `emitter`, or an `emitters` array) and registers it via `registerEmitter()` before generation; `--target <its-name>` then emits through it.
- **propose-pr token discipline**: the fine-grained GitHub token comes from `--token`, `DS_CONTRACTS_GITHUB_TOKEN`, or `GITHUB_TOKEN`; it is used in memory for the run and never persisted or logged. `--dry-run` prints the exact REST plan with no token and no network.
- **`extract --computed`** degrades with a named message (exit 3) when `playwright-core` or its Chromium is absent; every other verb works without a browser.

## Release status

This source tree stages `@ds-contracts/cli@0.5.0-rc.1`. It is source-only until
a release owner publishes it. The npm registry check on 2026-08-04 reported
`0.4.0` as `latest`; installing without an exact version therefore installs
`0.4.0`, not this RC.

After the RC is published, evaluate it without moving the stable tag:

```sh
npm exec --package=@ds-contracts/cli@0.5.0-rc.1 -- ds-contracts --help
```

From a checkout, build and run the staged source directly:

```sh
npm --prefix packages/cli run build
node packages/cli/dist/cli.js --help
```

See the repository [release process](../../docs/27-release-process.md) for pack
verification, publication approvals, provenance expectations, and rollback.
