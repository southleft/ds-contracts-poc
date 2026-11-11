# Manual tests

How to try both directions by hand on the Carbon kit today. Every number here is **tuned, regression only**: it comes from components the tuning work has already looked at, so it isn't progress (AGENTS.md rule 7). Run everything from this checkout with Node 20.19 (`.nvmrc`) after `npm ci` and `npm run prep:core`.

## Figma to React: one Carbon set into a React package and a per-variant report

```bash
( set -a; . ./.env.local; set +a; npm run figma:to-react -- --url "<component-set link>" --out ./out/try-1 --fonts <font manifest> --allow-failures )
```

- **The link:** use Figma's **Copy link to selection** on the component set. You can use `--dump <dump.json>` in place of `--url` to convert a saved dump.
- **The token:** the subshell loads `FIGMA_TOKEN` for this one command; never print it.
- **`--fonts`:** a sha256-pinned manifest of the font files the design draws. A face that isn't supplied is refused by name (exit 3). It is never counted as a pass or a failure.
- **`--profile examples/carbon/profile.json`:** switches on the engine conventions the profile names. The installed CLI can't switch a convention on.

**Reading the result.** `out/try-1/result.json` names the component, the package (`.tgz`), the request hash and each variant's verdict.

| Verdict | Meaning |
|---|---|
| PASS | Every check passed. |
| FAIL | A named check failed. |
| UNVERIFIED | Something couldn't be measured. That's not a pass. |
| NOT CHECKED | No browser comparison ran. |

A written package alone isn't a pass. The package compiles as part of the command: a TypeScript error stops it with `tsc failed`.

## React to Figma: Storybook stories into Scratch Contracts

This command writes only to **Scratch Contracts** (file key `ewm0gLcgAUjbxlfLf95RSc`). Write nowhere else.

> **Warning:** the archive step renames every page, set, variable and collection in the file it is given. The runner refuses any file whose name doesn't contain "Scratch" (`file-not-scratch`), but check the file key before you start.
>
> **Residual risk:** the runner's local server answers any web page on this machine (the driver needs that). Close other browser tabs on `localhost` during a run.

1. **Bring Figma forward.** Bring the Scratch Contracts tab to the front, and keep it there: a hidden tab runs about one step a minute, and the runner refuses to start.
2. **Start the runner** (pick a new tag every time):

   ```bash
   ( set -a; . ./.env.local; set +a; npx tsx scripts/react-to-figma-run.ts --run private/r2f-<tag> --tag <tag> --file-key ewm0gLcgAUjbxlfLf95RSc --only <titles.json> --profile examples/carbon/profile.json )
   ```

   - `--only` lists the component titles to write: one title for a quick try, or the tuning list.
   - `--pilot` runs three of them.
   - The runner holds localhost port 9232 (the Desktop Bridge plugin can only fetch ports 9223–9232) and refuses to start if it's taken.
3. **Run the driver.** In Claude, ask it to run `scripts/react-to-figma-driver.js` in Scratch Contracts through the Desktop Bridge (`figma_execute`). The runner's terminal shows progress. A bridge time-out doesn't stop the driver.

**What it does to the file.** First it renames every older page, set, variable and collection with ` · archived <tag>`, so nothing old is reused or overwritten. Nothing is deleted. Then it writes one set at a time and reads each back by node id before checking it.

**Reading the result:**
- **`checks.json`:** one line per component: `check` (the receipt), `failed` (a code) or `refused` (why no contract was built).
- **`receipt.json`:** each Figma call's time and flags, the file totals before and after, and any faults and retries.
- **`stop.json`** (only if the attempt stopped): the stop rule that fired. A stopped attempt is void; start again with a new tag.

To score the receipts:

```bash
npx tsx scripts/reading.ts --r2f private/r2f-<tag>/reader/stories.json --checks private/r2f-<tag>/checks.json --profile examples/carbon/profile.json
```

## Today's numbers and the top named misses

**React to Figma:** attempt `r2f-20261111-a2` ran on 2026-11-11 at c14ee3d8c (main plus #391). It was sealed with no stop, fault or retry, and it doesn't include the icon fix (#392/#393) or the rotation fix (#394).

| Measure (tuned, regression only) | Result |
|---|---|
| Sets read | 66 |
| Written and checked | 42 |
| Refused at the contract step | 24: `not-one-element` 21, unregistered token channel 2, `flow-pseudo-host-layout` 1 |
| Variants | 513: 58 pass, 377 fail, 78 unverified, 0 font-blocked |
| Headline | 10.1% over 41 in-grammar sets |
| Raw first pass | 55/518 |
| Whole sets | 2/41 |

Its top named misses:

| Miss | Variants | Sets |
|---|---|---|
| `text-style-unmeasured`: under diagnosis by the ruler work | 486 | 3 |
| `content-size-mismatch` | 209 | 12 |
| `content-missing`: icon parts not written; the icon and rotation fixes (#392–#394) are queued | 186 | 8 |
| Layout image difference (white / black) | 169 / 164 | 11 |
| `image-framing-unqualified` (fractional origin 81, fractional translation 10) | 91 | — |
| Reference capture refused by the reader: a reader item, counted as a failure | 49 | 4 |
| `text-not-editable` (set problem) | — | 12 |

**Figma to React:** 40.7% over 36 in-grammar sets with the imperceptible-blend convention on, at the #383 head. It's from the preview run at efea33775, repo script only. The draw B baseline before it was 35.8%. The baseline's top misses:

| Miss | Variants | Sets |
|---|---|---|
| Content missing | 567 | 25 |
| `child-paint-order-owner-unqualified` | 301 | 9 |
| Layout image difference on black | 283 | 16 |
| `figma-source-instance-identity-refused` | 274 | 6 |

New with the convention on (#388 targets both; not re-measured since):

| Miss | Sets |
|---|---|
| tsc `TS2367` in the generated `NotificationToast.tsx` | 1 |
| `react-library-duplicate-component` | 2 |
