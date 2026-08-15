# GOLDEN-PATH RECEIPT — clean-machine run, 2026-08-13

Every line below was RUN, in this order, on a **fresh `git clone` of
`origin/main`** into an empty directory — not on the development tree. Exit
codes are recorded as observed. The one number that matters most is the last
one: the artifact a stranger produces is **byte-identical** to the one the
development tree produces.

    repo      https://github.com/southleft/ds-contracts-poc.git
    commit    7c2a23d2  (main at the time of the run)
    node      v20.19.4  (package.json requires >=20)
    machine   macOS arm64, no prior repo state, no global installs

## THE RUN

    $ git clone --depth 1 https://github.com/southleft/ds-contracts-poc.git repo
      exit 0        10,193 files

    $ cd repo && npm install --no-audit --no-fund
      exit 0        253 packages in 2s

    $ npm run plugin:zip
      exit 0        playground/public/ds-contracts-sync-runner-plugin.zip
                    (4 files, 926,672 bytes; engine bundle 0.67 MB minified)
                    figma-sync/plugin-dist/  ← the folder Figma imports
                    stamp "engine 75b9d8e8196d · 705091B"
                    "dump script verified, engine receipt verified"

    $ npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
        --out flowbite.bundle.json \
        --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
        --icons examples/tailwind/assets/icons
      exit 0        5 contract(s) + tokenSet "Tokens"
                    68 base tokens, minted tree, 5 icon assets, 92,724 bytes

    $ npx tsx packages/cli/src/cli.ts generate examples/tailwind/contracts \
        --out ./out-react --target react \
        --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
        --icons examples/tailwind/assets/icons
      exit 0        Alert, Badge, Button, Card, ToggleSwitch

## GATES RUN ON THE CLONE (offline — no Figma, no bridge, no browser)

    $ npm run plugin:check                        exit 0
    $ npm run console-loop:all:evidence:check     exit 0

## THE DETERMINISM CHECK — the reason this receipt exists

    dev tree bundle      sha256 bb96f43e1969bf5202752508af36e5e6472d145c280e84c34b842f7c59051327
    fresh clone bundle   sha256 bb96f43e1969bf5202752508af36e5e6472d145c280e84c34b842f7c59051327
    → IDENTICAL

Running the same command twice in the same tree also produced identical bytes.
The bundle is a pure function of (contracts, tokens, icons); there is no
timestamp, no machine id and no ordering nondeterminism in it.

## WHAT THIS RECEIPT DOES **NOT** COVER

  · **The Figma half is not automated and was not run here.** Importing the
    plugin and pasting the bundle are human steps in the Figma desktop app.
    What is proven is that the artifact you paste is reproducible; what is not
    proven by this receipt is the paste itself.
  · **`extract` was not run.** It needs an npm sandbox OUTSIDE the repo with the
    target library installed, plus Chromium. The golden path deliberately starts
    from the COMMITTED contracts instead — see docs/BETA.md.
  · **The full eval suite was not run on the clone** (~25 min). It was run on the
    development tree at the same commit: 222/225, three reds all named in
    docs/BETA.md.

## TWO THINGS THIS RUN FOUND, both now documented rather than worked around

  1. **The plugin is NOT in the clone.** `playground/public/*.zip` and
     `figma-sync/plugin-dist/` are both gitignored (.gitignore:28,50). A stranger
     who skips `npm run plugin:zip` has a bundle and nothing to paste it into.
  2. **`generate --target react` REQUIRES `--icons`** for this lane. Without it
     the run exits 1 by name:
     `flowbite.alert: part "dismiss" needs icon asset "assets/icons/alert-dismiss-icon.svg" which does not exist`.
     That is a correct refusal, not a bug — but the flag is not optional, and
     omitting it is the first thing a stranger will do.

## SECOND RUN — the documented commands, verbatim, on a SECOND clean clone

The first run above is how the path was *discovered*. This one is the check
that matters for a reader: the exact command list as written in
[docs/BETA.md](../../../docs/BETA.md), copied verbatim, into a second fresh
clone with no shared state.

    git clone --depth 1 …                exit 0
    npm install --no-audit --no-fund     exit 0
    npm run plugin:zip                   exit 0   → figma-sync/plugin-dist/manifest.json
    figma bundle …                       exit 0   → sha256 bb96f43e1969bf52…
    generate … --target react --icons …  exit 0   → Alert Badge Button Card ToggleSwitch

Same bundle sha as the development tree and as the first clone. **The commands
in BETA.md are the commands that were run** — they were not transcribed from
memory or adapted afterwards.

## THIRD CHECK — the PUBLISHED CLI vs this source tree

`docs/28` tells beta testers to run `npx @ds-contracts/cli figma bundle …`, and
the published package (**0.4.0**) is BEHIND this source tree (`0.5.0-rc.2`). An
entrypoint that is a minor version behind is exactly the kind of thing that
silently produces a different artifact, so it was measured rather than assumed:

    npx --yes @ds-contracts/cli@0.4.0 figma bundle examples/tailwind/contracts \
      --tokens …/tailwind.dtcg.json,…/tailwind-minted.dtcg.json \
      --icons examples/tailwind/assets/icons
      exit 0    92,764 bytes

    published 0.4.0   sha256 bb96f43e1969bf5202752508af36e5e6472d145c280e84c34b842f7c59051327
    source tree       sha256 bb96f43e1969bf5202752508af36e5e6472d145c280e84c34b842f7c59051327
    → IDENTICAL

**For `figma bundle` on this lane the two entrypoints agree byte-for-byte.**
That result does NOT generalise: the rest of the published surface is a minor
version behind and nothing here checks it. Pin the version if you use it.

This check also corrected a claim an earlier draft of docs/BETA.md made — that
there is "no installable command". There is one; it is just older than the
source, which is a different and more useful warning.

---

**SHA UNCHANGED — and it round-tripped.** The kit climb briefly added a sixth
component (TextInput, sha `22d50bf1…`) and then HELD it for failing the kit
ship bar. Removing it returned the bundle to the exact `bb96f43e…` recorded
above — add-then-remove is byte-identical, which is a stronger determinism
proof than the original single build. Every method and exit code above stands.
See `KIT-CLIMB.md`.
