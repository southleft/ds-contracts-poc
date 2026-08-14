# LIVE-APPLY RECEIPT — the golden-path bundle, applied to a real blank Figma file

*Companion to [GOLDEN-PATH-RECEIPT.md](GOLDEN-PATH-RECEIPT.md). That receipt
proves the bundle BUILDS reproducibly on a clean machine. This one proves the
bundle APPLIES — the half the other receipt explicitly said it did not cover.*

    date        2026-08-13
    repo        feat/public-beta-prep @ a023a6d3
    target      "DS Contracts Testing v2"  ·  Y8Jhw6R49wTLuXZ0is2GmV
    bridge      Figma Desktop Bridge, WebSocket, plugin 1.39.0, target PINNED (lock: true)

## THE FILE WAS BLANK, AND THAT WAS VERIFIED BEFORE ANYTHING WAS WRITTEN

    pages 1 ("Page 1")   nodes 0   component sets 0
    variable collections 0   variables 0   styles 0

No other connected file was touched. `BMjUA…`, `GnQnj…`, `59mLQ…` (MUI Test 1)
and `Hherk…` (Slots Testing) were all connected at the same time and were
excluded by target lock; every `figma_execute` call additionally re-checked
`figma.fileKey` and would have refused by name on a mismatch.

## STEP 2 — BUILD (commands exactly as docs/BETA.md writes them)

    $ npm run plugin:zip
      exit 0    playground/public/ds-contracts-sync-runner-plugin.zip
                4 files, 926,672 bytes; engine bundle 0.67 MB minified
                "dump script verified, engine receipt verified"

    $ npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
        --out flowbite.bundle.json \
        --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
        --icons examples/tailwind/assets/icons
      exit 0    5 contract(s) + tokenSet "Tokens"; 92,764 bytes

    sha256  bb96f43e1969bf5202752508af36e5e6472d145c280e84c34b842f7c59051327

That sha is the same one the clean-machine receipt records for the dev tree,
both fresh clones, and the published `@ds-contracts/cli@0.4.0`. **The bytes
applied below are the bytes a stranger builds.**

## STEP 3 — APPLY, VIA THE ENGINE, NOT AROUND IT

The plugin's own engine did the planning. Nothing was hand-authored:

    engine      scripts/build-plugin-zip.mjs → buildEngineBundle()
                705,091 bytes, input hash 75b9d8e8196d
                (the same hash the plugin-dist stamp shows: "engine 75b9d8e8196d · 705091B")

    DSC.parseIncomingText(flowbite.bundle.json)   → ok, kind "bundle", 5 contracts
    DSC.planGenerate(contracts, {                   → ok, 11 steps
      withTokens: true,
      fileKey: 'Y8Jhw6R49wTLuXZ0is2GmV',
      tokenSet: parsed.tokenSet,
      icons:    parsed.icons })

    step 00  tokens            51,522 ch   → {created 304, updated 0, aliased 21}
    step 01  component         87,387 ch   → Alert          node 1:344
    step 02  version-marker       539 ch   → flowbite.alert 0.2.0
    step 03  component        103,350 ch   → Badge
    step 04  version-marker       539 ch   → flowbite.badge
    step 05  component        164,116 ch   → Button
    step 06  version-marker       541 ch   → flowbite.button
    step 07  component         69,092 ch   → Card
    step 08  version-marker       537 ch   → flowbite.card
    step 09  component        102,162 ch   → ToggleSwitch
    step 10  version-marker       553 ch   → flowbite.toggleswitch

All 11 steps returned ok; none threw. Each step's code was evaluated with
`figma` in scope — the same `runScript` shape `code.js` uses and
`scripts/plugin-engine-check.mjs` replays headlessly.

## STEP 4 — INVENTORY

| expected | found | type | variants | contractId | version |
|---|---|---|---|---|---|
| Alert | ✔ | COMPONENT_SET | 4 | `flowbite.alert` | 0.2.0 |
| Badge | ✔ | COMPONENT_SET | 24 | `flowbite.badge` | 0.2.0 |
| Button | ✔ | COMPONENT_SET | 45 | `flowbite.button` | 0.2.0 |
| Card | ✔ | **COMPONENT** | 1 | `flowbite.card` | 0.2.0 |
| ToggleSwitch | ✔ | COMPONENT_SET | 6 | `flowbite.toggleswitch` | 0.2.0 |

**Nothing is missing and nothing extra was created.** Card is a standalone
COMPONENT rather than a COMPONENT_SET because its contract carries no variant
axis — that is the contract's shape, not a fault.

    variable collection   "Tokens"   modes: Light, Dark   304 variables

Screenshots taken from the live runtime (`exportAsync`, current state):
Alert's four tones render token-bound and correct; Button's 45 variants render
across five colours × sizes × the default/disabled/hover/focus/active planes.

## TWO THINGS WORTH RECORDING, because both cost time and neither is a defect

1. **The engine cannot run inside the Figma PLUGIN SANDBOX.** Loading it there
   fails with `TypeError: BigInt is not a function`. That is not a bug: in the
   real plugin the engine runs in the **UI iframe** (a full browser JS context)
   and only the *generated step scripts* run in the sandbox. The apply above
   respects that split — engine in node, steps in the sandbox.
2. **A page-level inventory reports zero.** The engine creates **one page per
   component** with the set inside a `SECTION`, so a walk over
   `page.children` finds nothing and a first pass wrongly read "all five
   missing". `findAll` (skipping nodes whose parent is a COMPONENT_SET) is the
   correct inventory. Recorded so the next reader does not re-derive it.

## WHAT THIS RECEIPT STILL DOES NOT COVER

The bundle was applied through the engine over the Desktop Bridge, which is how
the plugin applies it — but **a human pasting JSON into the plugin's Build tab
was not performed here.** What is proven is that the planned steps land the
documented artifacts in a blank file. The UI paste itself remains a human step.

---

**SHA SUPERSEDED 2026-08-14.** This receipt applied the FIVE-component bundle
(`bb96f43e…`). The kit climb added a sixth (TextInput) and applied it to the
same file as a NEW page, leaving these five untouched — verified before and
after. The bundle is now `22d50bf1…`. See `KIT-CLIMB.md`.
