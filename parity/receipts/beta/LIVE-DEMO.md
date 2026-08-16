# LIVE DEMO — the take

**Read this before the camera is on. Follow it while it is.** Two beats, one
round trip: a code library becomes Figma components, and those Figma components
become code. Nothing in the middle is a model.

**Target: 10–12 minutes.** Roughly 4 min for Beat 1, 5 min for Beat 2, 2 min
for the honest caveat at the end.

Every command below was executed end-to-end on `feat/font-slant-carry` on
2026-08-16 and exited 0.

---

## Before you hit record

```bash
cd ~/Sites/ds-contracts-poc
git status                 # clean tree, feat/font-slant-carry
npm run plugin:zip         # ~10s, must exit 0
```

Have open, ready to alt-tab:

1. **Terminal** in the repo root.
2. **Figma desktop**, file **`MUI Test 1`** (`59mLQlOMiD5w5za6SUcoO5`), sitting
   on page **`Button (flowbite.button)`**.
3. **Editor** on `examples/tailwind/contracts/button.contract.json` — the
   thing everything else is generated from.

> **Do not open `Y8Jhw6R49wTLuXZ0is2GmV`.** It holds shipped pages that this
> demo must not write to. `59mLQ…` is the demo file.

The Figma file already holds the eight Flowbite sets. **That is the point** —
Beat 1 shows them RE-SYNCING, which is the product (amend in place, same node
ids, no duplicates). If you want a from-nothing build instead, say so on camera
and use a brand-new file; the same commands work.

---

## BEAT 1 — the codebase becomes Figma (~4 min)

**Say:** *"This is a real third-party library — Flowbite. Eight components live
in this repo as contracts. I have never opened Figma to make them."*

Show `button.contract.json`: props, anatomy, token bindings. Point out that
there is no geometry and no code in it.

```bash
npx tsx packages/cli/src/cli.ts figma bundle examples/tailwind/contracts \
  --out flowbite.bundle.json \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json \
  --icons examples/tailwind/assets/icons
```

**Must print:** `8 contract(s) + tokenSet "Tokens" (68 base tokens, minted
tree, 5 icon asset(s); 108497 bytes)`.

**Say:** *"One JSON. That is the only thing anybody pastes."*

Then in Figma: **Plugins → DS Contracts Sync Runner → Build tab → paste
`flowbite.bundle.json` → run.**

**What must appear:**

| | |
|---|---|
| pages | 8 Flowbite pages (Alert, Badge, Button, Card, HelperText, Kbd, Label, ToggleSwitch) |
| Button | **45 variants** — 5 colours × 5 sizes + states |
| Badge | **24 variants** |
| total | **91 variants across 8 sets** |
| variables | a **`Tokens`** collection, **331** variables, **Light / Dark** modes |

Click one Button cell → the fill is **bound to a variable**, not a hex. That is
the beat: *the token survived the trip.*

---

## BEAT 2 — those Figma components become code (~5 min)

**Say:** *"Now the other direction — and I am reading the canvas, not the
contracts I started from."*

```bash
# 1. read the canvas → a dump          (dump v1.25)
# 2. invert the dump → proposed contracts
npm run extract:figma -- demo/flowbite.dump.json \
  --out demo/proposed \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json

# 3. contracts → typed React + CSS Modules + stories
npx tsx packages/cli/src/cli.ts generate demo/proposed/*.contract.proposed.json \
  --target react --out demo/generated --stories \
  --tokens examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json,demo/proposed/minted.dtcg.json
```

**Must print:** `✔ Generated 8 component(s)` → `demo/generated` — 33 files.

> **Getting the dump.** Step 1 needs `extract/figma/dump.plugin.js` executed
> inside the file, which the Sync Runner's **Send** tab does. The rehearsal
> drove it through the console bridge and POSTed the result to
> `demo/flowbite.dump.json`. **Produce the dump before you record** and have
> the file on disk; do not debug a bridge on camera.

Open `demo/generated/ButtonFlowbiteButton/ButtonFlowbiteButton.tsx`:

- it is a **`<button>`**, not a `<div>` — the host element survived
- `color`, `size`, `disabled` are typed unions
- the CSS binds `var(--imported-button-root-…)` — **the same token names**

Then show it running:

```bash
node scripts/build-tokens.mjs --flat \
  examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json,demo/proposed/minted.dtcg.json \
  --out demo/generated/tokens.css

npm run storybook -- -c demo/.storybook -p 6007
```

> Leave that terminal open — it is a dev server, not a build. The root
> `npm run storybook` is a DIFFERENT config (this repo's own library) and will
> not show these components.

Open **http://localhost:6007** → **Components/ButtonFlowbiteButton → Matrix**.
Five colours × five sizes, painted, next to the Figma window.

**Say:** *"Left is Figma. Right is React that was generated from Figma. Neither
was hand-written, and no model was involved."*

---

## The honest 90 seconds — say this, do not skip it

**One row of the Button matrix has no border.** That is the `alternative`
variant, and it is **the engine refusing to guess**, not a bug. The run says so
by name:

> `Button (flowbite.button):root: stroke weight bindings are not uniform —
> border-width not representable, review`

Flowbite gives `alternative` a 1px border and the other colours none. One
`border-width` at the root cannot say that, so the inverter **carried the
colour and refused the width** rather than inventing one. Show the line in
`demo/proposed/figma-proposals.md`.

Also true, and worth saying plainly:

- **Geometry does not round-trip.** Width, height and insets are deliberately
  excluded (`FC-GEOMETRY-EXCLUDED`, "Option B") — the canvas is not the source
  of truth for size.
- **The kit is 8 of 46 Flowbite components (17.4%).** Spinner, TextInput and
  Blockquote are captured with receipts and deliberately **held** — a scorecard
  is not a shipped stem.
- **This is a re-sync, not a first build**, on a file that already had the
  eight sets — which is exactly the case a design system lives in.

---

## If something goes wrong on camera

| symptom | do this |
|---|---|
| `plugin:zip` says the engine bundle is **STALE vs core** | someone changed `core/` without re-recording. `node scripts/build-plugin-zip.mjs --update-engine-receipt`, then re-run. The dry run for this page hit exactly this |
| bundle command errors | `npm run plugin:zip` first — the engine receipt must verify |
| plugin cannot import | Figma **desktop** only; import `figma-sync/plugin-dist/manifest.json` |
| `extract:figma` refuses a set | say the refusal out loud — it is the product working; move to the next stem |
| Storybook shows unstyled text | the `--flat` token build did not run; re-run it and reload |
| Storybook port busy | `-p 6008`; the root `npm run storybook` is a DIFFERENT config |

**Never** run `git push`, and never write `Y8Jhw6R49wTLuXZ0is2GmV`.

---

## What this demo does not claim

It does not claim v1 shipped, that a whole library can be captured, or that the
inversion is lossless. It claims one thing, and shows it twice: **the hop
between design and code is deterministic, and every fact it cannot carry is
named out loud.**
