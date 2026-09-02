# F1 · shadcn Switch — the second archetype the one command covers

`npm run recipe:point -- --archetype switch --library shadcn` proposed
`recipe/fixtures/generated/switch.shadcn.ts` from
`extract/computed/out/shadcn/switch/captured-truth.json`: **25 leaves read,
0 reviewed, 9 archetype spellings, 0 invented** — no `--set` at all. The
same command pointed at MUI's own capture proposed
`switch.mui.ts` (21 read, 0 invented), and that proposal scores exactly what
the hand-transcribed MUI fixture scores (4.57%, the manifest's
`switch/mui-proposed` row beside `switch/mui`).

Three CSS facts the reader had to learn to read, all general:

- **A pill radius in exponent notation.** Tailwind's `rounded-full` is a
  clamped huge length that Chromium reports as `3.35544e+07px`; `px()` now
  accepts it and the recipe carries it (Figma clamps a corner radius to half
  the side, as CSS does).
- **`calc(100% - 2px)` travel.** shadcn moves the thumb by `translate`, a
  percentage of the thumb's own width. The travel formula reads the moving
  element's width and evaluates the calc: 16 × 100% − 2 = 14.
- **A transparent border is an inset.** The track has `border border-transparent`;
  CSS lays the content box out after the border, so the thumb sits 1px in.
  `track.padding` is now padding-left + border-left-width. The first mint
  (v9) put the thumb flush against the track edge and the checked state
  scored 6.74%; with the inset read, every state is under the bar.

Also: an `oklch()` colour inside a shadow layer (Tailwind's ring variables)
is converted by the same CSS Color 4 arithmetic as any other oklch fact.

## Scores (bar 5% AA-masked) — switch v10, page `218:88332`

| state | AA masked | ink canvas / real | verdict |
|---|---|---|---|
| unchecked.enabled | **0.00%** | 57.9 / 59.9 | pass, 32×19 both sides |
| checked.enabled | 4.44% | 61.5 / 61.2 | pass |
| unchecked.disabled | **0.00%** | 54.7 / 56.6 | pass |
| checked.disabled | 2.96% | 61.5 / 57.2 | pass |

Four of four states at or under the bar; the manifest scores the unchecked
state (`switch/shadcn`, 0.00%).

## Files

- `canvas-<state>.png` — read-only export of the shadcn variant's `switch/hit`
- `score-<state>.json` / `score-<state>.diff.png` — `recipe/fidelity-score.ts`
- the proposals: `recipe/evidence/pointed/switch-shadcn/` and `switch-mui/`
