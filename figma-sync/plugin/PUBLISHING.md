# Publishing DS Contracts Sync Runner to the Figma Community

Publishing turns the dev-import into a normal one-click install for anyone — the goal is
to make the deterministic path the *easy* path. Figma requires the submission to come from
your account through the Figma UI; this is the checklist.

## 1. Pre-flight (the package is ready)

- `manifest.json` — `name`, `id`, `api: 1.0.0`, `main: code.js`, `ui: ui.html`,
  `editorType: [figma]`, `networkAccess` scoped to the pairing bridge + `api.github.com`
  (both optional flows; the core Generate path needs **no network**). ✓
- Engine bundle is drift-guarded (`engine.receipt.json`) and verified by
  `npm run plugin:check` (gated in the eval suite). ✓
- Rebuild the shippable zip: `node scripts/build-plugin-zip.mjs` →
  `playground/public/ds-contracts-sync-runner-plugin.zip`.

## 2. Assets to upload in the Figma publish dialog

| Asset | Spec | Source |
|---|---|---|
| Plugin icon | 128×128 PNG | `figma-sync/plugin/assets/icon.png` (starter provided — replace with final brand art) |
| Cover art | 1920×960 PNG/JPG | screenshot of a generated set on canvas works well |
| Name | — | "DS Contracts Sync Runner" |
| Tagline | ≤ short line | "Build your Figma library from contracts — deterministically." |
| Description | — | see below |
| Tags | — | design systems, tokens, components, sync, code connect |

**Description (paste-ready):**
> DS Contracts Sync Runner builds and updates your Figma component library from
> machine-readable component *contracts*. Paste a contract and it emits and runs the sync
> locally — the canvas is a byte-reproducible function of the contract, token-bound and
> identity-marked, with no AI in the conversion. Edit on canvas and it proposes the
> contract change back. The same deterministic engine runs in your CI via the
> `@ds-contracts/cli`, so code and design stay in lockstep.

## 3. Publish flow (in Figma desktop, your account)

1. **Plugins → Development → DS Contracts Sync Runner → Publish…** (or Manage plugins →
   Publish).
2. Fill in name, tagline, description, tags; upload the 128×128 icon and cover art.
3. Set visibility (Public for Community, or Private/Org for internal-only).
4. Submit. Figma reviews public plugins (typically a short turnaround).
5. Once approved, it installs from Community with one click — no dev-import.

## 4. Versioning

Bump nothing in the manifest for content changes; re-publish updates from the same dialog.
Keep the engine receipt fresh: any core change requires
`node scripts/build-plugin-zip.mjs --update-engine-receipt` (a reviewed, deliberate step —
the eval suite refuses a silent drift).
