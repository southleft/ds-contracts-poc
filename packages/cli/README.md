# @ds-contracts/cli

> **Not the v1 proof surface.** This package is the **universal-contract**
> CLI (extract / generate / bundle / onboard). Recipe-IR lives under
> `recipe/` in the reference repo, is not exported here, and npm publish
> of a recipe surface is deferred. Product v1 is incomplete (F1). See the
> repo README and `docs/32-recipe-ir-pivot.md`.

`ds-contracts` — contracts as the deterministic bridge between design and code. Every verb is a thin shell over the same engine the reference repo's npm scripts run, esbuild-bundled. Only `figma-to-react` uses the installed dependencies: it packages with the pinned `esbuild`, `typescript` and `@types/react`, and checks with `playwright-core`. `playwright-core` is optional and loaded only when needed, as it is for `extract --computed`.

## Figma → React: `figma-to-react`

A Figma component set becomes an installable React package, checked against the design. No clone of the reference repo is needed:

```sh
FIGMA_TOKEN=<token> npx @ds-contracts/cli@0.5.0-rc.3 figma-to-react --url "<figma component set link>" --out ./out
npx @ds-contracts/cli@0.5.0-rc.3 figma-to-react --dump ./dump.json --out ./out
```

The command is new in `0.5.0-rc.3`. A bare `npx @ds-contracts/cli` installs npm's `latest` tag (0.4.0), which does not have it, so name the version. If that version is not on npm yet (publishing is an owner step), build it from a checkout (see [Release status](#release-status)).

| Flag | Meaning |
| --- | --- |
| `--url <link>` | A Figma link to the component set (with its `node-id`). Reads the set and the same-file component sets it uses. Needs `FIGMA_TOKEN`. |
| `--dump <file>` | A saved REST dump instead of a link (for example, the `dump.json` a `--url` run keeps in `--out`). |
| `--out <dir>` | Where the package and reports go. Required. |
| `--name <npm name>` | The package name. Default: `@ds-contracts-generated/<component>`. |
| `--allow-failures` | Exit 0 even when a variant fails; the report still says FAIL. |

It writes `<out>/<name>.tgz` (install it with `npm install <path>`), `<out>/request.json`, `<out>/result.json` and the check's receipt and images in `<out>/check`. It is the same engine, generator and packager as the reference repo's `npm run figma:to-react`; `npm run cli:figma-to-react:smoke:check` proves the installed package reproduces that command's pinned output.

The check installs the package in a clean Vite app, mounts every Figma variant and prints one line per variant:

- **PASS**: within the 5% image limit on white and on black, and every text and icon Figma draws is rendered.
- **FAIL**, with the reasons. Any FAIL exits 1 unless `--allow-failures`. The package is written either way.
- **UNVERIFIED**: nothing failed, but something could not be measured. Without `FIGMA_TOKEN` there are no Figma images, so every variant of a `--dump` run is UNVERIFIED. Never shown as a pass.

A green check is printed only when every variant passed.

**Requirements:**

- **Node 20.19+ in the 20.x series, or 22.12+** (the check builds with Vite 7), on **macOS or Linux**. Windows is refused by name in this release.
- **npm and network access to the registry.** npx installs the CLI with `esbuild`, `typescript`, `@types/react` and `playwright-core`; the check installs `react`, `react-dom` and `vite` into its temporary app.
- **A Chromium for the check:** `npx playwright-core@1.61.1 install chromium` (the version this CLI pins; the command prints the exact line when the browser is missing). On Linux, add `--with-deps` for the system libraries. Without a Chromium the command packages anyway, prints NOT CHECKED and exits 0.
- **`FIGMA_TOKEN`**, a Figma personal access token with file read access, from the environment only. Required for `--url`. With `--dump`, it lets the check fetch Figma's images.

**Known limit:** the reference repo's demo contracts and tokens are bundled with the engine and still inform name linking and nearest-token matching, exactly as they do in the in-repo command. A set named like a demo component can link to it. The generated package ships only the tokens its components reach.

## All commands

```
ds-contracts figma-to-react (--url <link> | --dump <file>) --out <dir> [--name <npm name>] [--allow-failures]
                                                       # Figma component set → checked React package
ds-contracts init                                      # write ds-contracts.config.json
ds-contracts onboard <package>                         # detect → draft → stop for review
ds-contracts onboard --continue                        # capture → promote → emit → bundle
ds-contracts extract [config] [--reconcile]            # code → proposed contracts (react-tsx | cem)
ds-contracts extract --computed --config <capture.json> --harness <dir> [--out <dir>]
                                                       # real-browser computed-style capture
ds-contracts promote --config <library.json>           # reviewed capture → promoted contracts
ds-contracts generate <contracts..> --out <dir>        # contract → code (+ tokens.css beside it)
    [--target react|html|react-inline|figma-script|<registered>]
    [--tokens f,f | <dir> | slot=file,…] [--icons dir] [--stories] [--emitter <module>]
                                                       # a contract that fails to validate is refused
                                                       # BY NAME; the rest are written; exit 1 with the list
ds-contracts figma <contracts..> --out <dir>           # contract → Figma sync scripts
ds-contracts figma bundle <contracts..> --out <file>   # contracts + tokens → ONE self-contained
    --tokens <base.dtcg.json[,minted.dtcg.json]>       # CONTRACTS-BUNDLE JSON (paste it into the
    [--modes <light.json[,dark.json]>] [--name <col>]  # plugin's Build tab; deterministic bytes)
                                                       # --tokens takes generate's layered grammar too
                                                       # (a directory, primitives=…,semantic=…,brand.<name>=…)
ds-contracts migrate <paths..> [--check]               # schema 16 → 17 codemod (bindings.figma.*);
                                                       # --check names any v16 spelling and writes nothing
ds-contracts figma push <file> --code <CODE>           # send a CONTRACTS-BUNDLE to the plugin bridge
ds-contracts figma receive --out <dir> [--apply]        # receive a proposal; no writes without --apply
ds-contracts diff [config]                             # parity referee — exit 0 clean · 1 drift · 2 error
ds-contracts propose-pr <file> --repo owner/name [--dry-run]
                                                       # open a contract change as a reviewable PR
```

- **Emitter plugins**: `--emitter <module>` dynamic-imports a module exporting an `Emitter` (`default`, `emitter`, or an `emitters` array) and registers it via `registerEmitter()` before generation; `--target <its-name>` then emits through it.
- **propose-pr token discipline**: the fine-grained GitHub token comes from `--token`, `DS_CONTRACTS_GITHUB_TOKEN`, or `GITHUB_TOKEN`; it is used in memory for the run and never persisted or logged. `--dry-run` prints the exact REST plan with no token and no network.
- **`extract --computed`** degrades with a named message (exit 3) when `playwright-core` or its Chromium is absent; every other verb works without a browser.
- **Prop/DOM collisions**: a prop or slot named like a DOM attribute (`content`, `title`, `color`, …) is `Omit<>`-ed from the React base attrs type and named in the emitted header; a prop that is an `HTMLElement` member gets no web-components accessor (the attribute is still observed and rendered). The rule lives in `@ds-contracts/core`.
- **Schema 17**: every Figma-only field lives under `bindings.figma` (`representation`, `statePreviews`, `anchors`; `slot.bindings.figma.property`). A v16 document is refused by name with the new spelling and `ds-contracts migrate` in the message.

## Release status

These versions are the **universal-contract** envelope. Recipe-IR is not
exported here and never shipped as an npm RC; publish of a recipe surface is
deferred. The npm `next` tag carries `@ds-contracts/cli@0.5.0-rc.1` (pre-pivot).
This source tree is ahead at `0.5.0-rc.3` (the first with `figma-to-react`) and
remains unpublished. npm `latest` remains on the stable line; installing
without an exact version does not install this source.

Evaluate the published candidate without moving the stable tag:

```sh
npm exec --package=@ds-contracts/cli@0.5.0-rc.1 -- ds-contracts --help
```

From a checkout, build and run the staged source directly:

```sh
npm --prefix packages/cli run build
node packages/cli/dist/cli.js --help
```

To try `figma-to-react` as a user will get it before it is published, pack the
build (from the checkout root, after the build above) and install the tarball
in an empty directory outside the checkout:

```sh
npm pack ./packages/cli --pack-destination /tmp
mkdir /tmp/try-cli && cp benchmark/inputs/altitude-badge/dump.json /tmp/try-cli/
cd /tmp/try-cli && npm init -y >/dev/null
npm install /tmp/ds-contracts-cli-0.5.0-rc.3.tgz
npx ds-contracts figma-to-react --dump ./dump.json --out ./out
```

See the repository [release process](../../docs/27-release-process.md) for pack
verification, publication approvals, provenance expectations, and rollback.
