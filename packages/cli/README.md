# @ds-contracts/cli

A CLI for inspecting contracts, generating code, and reviewing supported changes
between React and Figma. This source candidate is unpublished. Browser-backed
commands use the installed capture dependencies; the commands below use a locally
built package, not npm's older `next` release.

## Reviewed React ↔ Figma edits: `roundtrip`

This opt-in workflow captures an existing React component with its real stylesheet,
creates native Figma variants and variables, and writes reviewed color and declared
pixel font-size token edits back to the original JSON. It preserves aliases and SVG
dependencies; application behavior stays in React. Layout edits, arbitrary CSS, responsive states and new
application behavior are not supported by this workflow. It is not a benchmark result.

The captured contract identifies the React source file, its SHA-256 and component
export as the behavior owner. `codeOnly` lists responsibilities kept in that source.
Capture does not establish a behavior-test result or equivalence; run the component's own
interaction and accessibility checks after an edit. A changed source invalidates
an outstanding review and must be captured again.

Run the CLI and Figma Desktop on the same machine; the runner connects over localhost.
You need Node 20.19.4, Docker running, Figma Desktop, and a local font file for a
font also installed in Figma. Font versions affect text metrics; a family name alone
is not a fidelity guarantee. The sample uses this repository's Checkbox source,
tokens and build script. The npm tarball includes its profile, not those source
files; run these commands from this source checkout's root after `npm ci`:

```sh
npm run prep:core
npm --prefix packages/cli run build
mkdir -p private/roundtrip-install
npm pack ./packages/cli --pack-destination private/roundtrip-install
npm install --prefix private/roundtrip-install ./private/roundtrip-install/ds-contracts-cli-0.5.0-rc.3.tgz
npm run plugin:zip
unzip playground/public/ds-contracts-sync-runner-plugin.zip -d private/roundtrip-install
cp packages/cli/examples/roundtrip-checkbox.json private/roundtrip-profile.json
DS_CONTRACTS_CLI=./private/roundtrip-install/node_modules/@ds-contracts/cli/dist/cli.js
node "$DS_CONTRACTS_CLI" roundtrip --help
```

In Figma Desktop, choose **Plugins → Development → Import plugin from manifest**
and select `private/roundtrip-install/ds-contracts-sync-runner/manifest.json`.
Open your writable Figma test file and run **DS Contracts Sync Runner** from the
Development menu. This ZIP is the matching plugin build; the npm package alone
does not install it. If older development copies share this plugin name, remove
those registrations in **Manage plugins in development** and run the newly imported
copy. Keep their source folders. The Advanced tab's Diagnostics build stamp must match
the one printed by `npm run plugin:zip`; an older stamp means an older copy is running.

Edit `private/roundtrip-profile.json`: set `figma.fileKey` to that file's key from
its URL and `capture.font.file` to your local Inter font file. Create the page
named by `figma.page` (the sample uses **Contract roundtrip**) in that Figma file.
Keep the file open. The profile explicitly declares source files, token tiers,
selectors and build commands; it does not infer missing tiers. For another
library, supply a profile for that library's actual sources and stylesheet.
Only use profiles you trust: `capture.build` runs their declared local commands.

The sample declares `font.control.size.sm → font.size.200 → 14px` and binds both
text parts to that semantic token. The primitive is in `tokens/primitives.tokens.json`;
the semantic alias is in `tokens/semantic.tokens.json`. Each tier is declared in the
profile; no component-level font token is invented. Font-size literals must be
positive explicit `px` dimensions. Unitless numbers, `rem`, and expressions are refused.
A size edit that also causes unmodeled reflow is refused; review its reported property.
For a first font edit, open the sample's semantic collection in Figma's Variables
table, right-click `font/control/size/sm`'s value and choose **Clear alias**. It retains `14`.
Review must propose exactly `{font.size.200}` → `14px` in the semantic JSON.
Then set that variable back to alias `font/size/200` in the sample's primitive
collection and repeat the review/apply/sync steps. This exercises alias
identity without changing text geometry. Run the component's behavior tests afterward.

```sh
node "$DS_CONTRACTS_CLI" roundtrip start --profile private/roundtrip-profile.json --out private/roundtrip-session
node "$DS_CONTRACTS_CLI" roundtrip sync --session private/roundtrip-session
# In the plugin: Advanced → React to Figma runner → Connect and run.
# Edit a declared color or font-size variable (or its alias) in Figma, then:
node "$DS_CONTRACTS_CLI" roundtrip sync --session private/roundtrip-session
# Connect and run again; review the exact JSON edits and digest printed by the CLI.
node "$DS_CONTRACTS_CLI" roundtrip apply --session private/roundtrip-session --digest <printed-digest>
node "$DS_CONTRACTS_CLI" roundtrip sync --session private/roundtrip-session
# Connect and run to verify the return projection.
```

For code-led token changes, run `refresh`, then `sync`. Use `status` to inspect the
session and `discard` to cancel an unapplied review. If `start` fails before its
session is committed, correct the issue and repeat it. If the error says
**session committed**, retry `sync`. If port 9232 is occupied, add
`--port 9231` to `sync` and select 9231 in the plugin. Unsupported canvas edits and
missing dependencies are refused; undo the unsupported edit and retry. A source
revision conflict requires restoring or reconciling the changed input before retrying.
If a connection drops, press Ctrl-C in the CLI, then repeat `sync` and **Connect and run**; an already completed
patch is recognized from its exact native state and is not applied again.
`read`, `review --snapshot` and `accept --snapshot` remain available for manual exchange.
The session retains the contract, source fingerprints, native snapshot and reviewed plan.
`comparison.json` reports measured properties on both sides. Intrinsic auto-size
differences are shown explicitly; synchronization does not claim pixel fidelity.
Fixed dimensions, styles, variable bindings and unsupported edits remain guarded.

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
| `--fonts <manifest.json>` | Bundle the design's local font files and supplied notices in the React package. Its root import loads the fonts; the check installs the same archive. Checksums and declared family names are verified before fetching or writing. Required for every face the design's text draws: a missing face is refused by name before packaging (exit 3). See [font manifests](../../docs/PREVIEW.md). |
| `--profile <profile.json>` | A system profile. Its `conventions` switch on the engine rules it names; an unknown one is refused by name before any fetch. The profile's sha256 is recorded in `result.json`. |
| `--into <dir>` | Copy the generated sources (each `<Name>/` folder, `index.ts`, `tokens.css`) into a directory of your library once the run exits 0. A path there that holds other content is refused by name and nothing is written; identical files are left as they are. |
| `--allow-failures` | Exit 0 even when a variant fails; the report still says FAIL. |

It writes `<out>/<name>.tgz` (install it with `npm install <path>`), `<out>/request.json`, `<out>/result.json` and the check's receipt and images in `<out>/check`. It is the same engine, generator and packager as the reference repo's `npm run figma:to-react`; `npm run cli:figma-to-react:smoke:check` proves the installed package reproduces that command's pinned output.

This command generates new code. Its report and `result.json` mark behavior as
not established: a visual PASS does not prove interactions, state management or
accessibility. A profile containing `behavior`, `codeOnly`, or a complete
source/component/capture declaration is refused before generation. Use `roundtrip`
with the existing React source when that source owns behavior.

For a new native button, an optional `figmaButton` profile entry explicitly
declares its state input. Use the exact file key and sole requested node ID from
the plugin dump; include its captured dependencies. For example:

```json
{
  "conventions": [],
  "figmaButton": {
    "fileKey": "YOUR_FILE_KEY", "nodeId": "1:2",
    "prop": { "name": "state", "type": { "enum": ["default", "disabled", "loading"] }, "default": "default",
      "bindings": { "code": { "prop": "state" }, "figma": { "kind": "VARIANT", "property": "State",
        "values": { "default": "default", "disabled": "disabled", "loading": "loading" } } } },
    "states": { "default": { "disabled": false, "busy": false },
      "disabled": { "disabled": true, "busy": false }, "loading": { "disabled": true, "busy": true } }
  }
}
```

Run `ds-contracts figma-to-react --dump dump.json --profile profile.json --fonts fonts.json --out out`.
The complete label map and default must exactly match the capture. List every
code value and its Figma label in `prop.bindings.figma.values`. This emits a native
`type="button"` with `onClick`, disabled suppression and loading `aria-busy`;
the application controls the state prop. It does not infer application behavior.
Conflicting metadata, stale domains, missing dependencies and interactive descendants
are refused. The capture stays unchanged. `behavior.owner` reports `system-profile`
or, on reimport of generated native metadata, `native-metadata`; runtime equivalence
still reads `not-asserted`. Run your own behavior tests before adopting the package.

For a prepared-library native return, use a separate return profile containing
`{"conventions":["native-operation-public-names"]}` to recover the public exports.
Omit the original target-bound `figmaButton` entry: retained native metadata supplies
the button policy. Only an exact matching operation stamp and drawn suffix qualify;
ambiguous names refuse.
This does not accept provisional contract IDs or establish behavior equivalence.
The convention is off by default to preserve existing generated imports.

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

## React → Figma: `react-to-figma`

From inside your React library (it needs Storybook 7 or later with a React framework, and Docker):

```sh
npx @ds-contracts/cli react-to-figma --out ./ds-contracts/r2f --file-key <your Figma file key> [--profile <profile.json>]
```

It builds your library's own Storybook with its own `storybook` binary and serves it on `localhost:6116`, reads every story in the pinned reader (a Playwright image run in Docker, so the references reproduce on any machine), and writes each component's contract and, with `--file-key`, the Figma programs that write it into that file. It prints one line per component: written, with its set and variant count, or refused, with every reason. A library without Storybook, with a renderer that is not React, or whose build fails is refused by name before anything is read. `--storybook <url>` reads a Storybook you already serve instead. Add `--write` to put them into Figma: the command serves the programs on `localhost:9232`; open the file in Figma Desktop and, in the ds-contracts plugin, press **React to Figma runner → Connect and run**. Every program refuses a file whose key is not `--file-key`, writes create-only (a set it already wrote is skipped) and archives or renames nothing. The plugin runs only the driver whose sha256 it pins. One line per set: written, with the nodes it created, or the program's error by name (exit 1 if any set failed; `<out>/figma-write.json` keeps the outcomes).
To return a checked `figma-to-react` output to editable Figma, run `ds-contracts react-to-figma --prepared <output-dir> --out <session-dir> --file-key <key> --write`. Keep the CLI open and paste its connection into the companion's **Build → Connect the local source workflow**, then press **Connect / resume**. Port 5181 must be free; no Docker is needed for this prepared path. Omit `--write` to prepare only; optional `--mode light|dark` and `--brand <name>` default to light/default.

The session pins the supplied request, report and archive bytes. Hashes and the supplied passing check report are consistency inputs, not independent equivalence evidence. `<session-dir>/result.json` reports native structure separately from visual, behavior and public API equivalence; public export names are not yet stable across this return.

Resume with `ds-contracts react-to-figma --resume --out <session-dir> --file-key <key> --write`, retaining the same mode/brand. This uses the retained journal even if the original output moved. After fixing a named creation refusal, add `--retry-creation` once; omit it when resuming an interrupted retry. Unknown writes are never repeated. An interrupted initial preparation requires the original, unchanged `--prepared` inputs.

```
ds-contracts figma-to-react (--url <link> | --dump <file>) --out <dir> [--name <npm name>] [--fonts <manifest.json>]
                            [--profile <profile.json>] [--into <dir>] [--allow-failures]
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
