# GOLDEN-PATH RECEIPT — clean-machine runs, 2026-08-13 (five stems) and 2026-08-22 (eight stems)

Every line below was RUN, in this order, on a **fresh `git clone` of
`origin/main`** into an empty directory — not on the development tree. Exit
codes are recorded as observed. The one number that matters most is the last
one: the artifact a stranger produces is **byte-identical** to the one the
development tree produces.

    repo      https://github.com/southleft/ds-contracts-poc.git
    commit    7c2a23d2  (main at the time of the run)
    node      v20.19.4  (package.json requires >=20)
    machine   macOS arm64, no prior repo state, no global installs

## RE-RUN 2026-08-22 — eight stems, branch `phase-0/one-truth` at 7066eb86

Same shape as the 2026-08-13 run below, re-executed because that run was at
FIVE stems and the sha BETA.md quoted for eight (`af0a5dee…`) came from a
feature-branch tree nobody could rebuild. This run used a fresh
`git clone --branch phase-0/one-truth` of the local repository into an
empty scratch directory (not `origin/main`: the branch was not yet pushed
when it ran; the CI lanes on the PR are the origin-side re-measurement).
Node v20.19.4, macOS arm64.

    $ git clone --branch phase-0/one-truth <repo> golden-clone
      exit 0        HEAD 7066eb86

    $ npm ci --no-audit --no-fund
      exit 0        3.5s

    $ npm run plugin:zip
      exit 0        playground/public/ds-contracts-sync-runner-plugin.zip
                    (4 files, 971,503 bytes; engine bundle 0.71 MB minified)
                    stamp "engine 86aa7cf30c1e · 741407B"
                    "dump script verified, engine receipt verified"
                    ← on main at 2d0ffef1 this step REFUSED (receipt stale);
                      the commit changed three nodeIds without re-recording.

    $ npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
        --out flowbite.bundle.json \
        --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
        --icons examples/tailwind/assets/icons \
        --name Tailwind
      exit 0        8 contract(s) + tokenSet "Tailwind"
                    68 base tokens, minted tree, 5 icon assets, 109,841 bytes

    $ npx tsx packages/cli/src/cli.ts generate examples/tailwind/contracts \
        --out ./out-react --target react \
        --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
        --icons examples/tailwind/assets/icons
      exit 0        Alert, Badge, Button, Card, HelperText, Kbd, Label,
                    ToggleSwitch — 25 files

    $ npm run maintain                            exit 0   297 ✔ (token-free)
    $ npm run eval:record:check                   exit 1   by design: the
                    committed evals/results.json predates provenance
                    stamping; the next commit on the branch carries the
                    record the full suite wrote on this tree.

    dev tree bundle      sha256 2714be6104ae881ef94db4766d418cb1eecaeffa1e5b528131ae71c95a6774c5
    fresh clone bundle   sha256 2714be6104ae881ef94db4766d418cb1eecaeffa1e5b528131ae71c95a6774c5
    committed examples/tailwind/figma/tailwind.bundle.json   → IDENTICAL (cmp)

The CLI prints "109775 bytes" for a 109,841-byte file (it reports the JS
string length, not the encoded size) — cosmetic, named here so nobody
chases it as a determinism defect.

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
