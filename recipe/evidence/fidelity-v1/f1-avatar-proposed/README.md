# F1 · avatar@1 — the third archetype the one command covers

`recipe/fixture-reader/schema-avatar.ts`, `draftAvatarRoles` and
`propose-avatar.ts`; `npm run recipe:point -- --archetype avatar --library <lib>`.
Five captures were pointed at, every one **13 leaves read, 0 invented**:

| library | kind | reviewed | manifest row | score (v6, page `218:90709`) |
|---|---|---|---|---|
| mui | its own capture, beside the hand table | none | `avatar/mui-proposed` | **0.00%** (hand row: 4%) |
| antd | its own capture, beside the hand table | none | `avatar/antd-proposed` | **0.00%** (hand row: 2.73%) |
| altitude | **held out** — never hand-tabled | none | `avatar/altitude` | **0.38%** |
| shadcn | held out | font fallback (Inter Variable → Inter, named) | none: captured before `--keep-originals`, no real render to score | — |
| fluent | held out | font fallback (Segoe UI → Arial Bold, named degradation) | none: same | — |

The proposed MUI and AntD rows beat the hand rows for a reason worth
recording: the hand tables pin the initials `JD` and (AntD) an SF Pro font
where the capture renders `A` in Roboto. The proposals read the capture, so
they are the like-for-like rows. The one token the MUI proposal reads
differently from the hand table is `rest.boxBorder` — the capture's
`border-top-color` (white) under a 0px border, where the hand table wrote
transparent; nothing renders either way.

## What the reader learned

- **A `50%` radius is half the box**; a clamped huge length (Tailwind's
  rounded-full as `3.35544e+07px`, Fluent's `10000px`) is carried as read.
- **Font style names differ by foundry spelling.** Altitude's IBM Plex Sans
  is "SemiBold" in Figma and `Semibold` from a CSS weight of 600. The writer's
  provenance check now compares style names without case or spacing (a
  runtime rule; every archetype was reminted through it, scores unchanged).
- **A font the minting machine lacks is a reviewed fact, not a guess.**
  `--set typography.label.resolved="Family/Style" --why …` declares the
  fallback the writer will find; the fixture carries the requested face, the
  resolved face, `resolution: "fallback"` and a named degradation, and the
  writer refuses any other combination as a provenance tamper.
- **A proposal names its refusals from the capture** (hover, focus-visible,
  active) because a reviewed source must refuse something.

## Files

- shots: `recipe/evidence/fidelity-v1/shots/avatar-*-v6.png`; scorecards in the gate's output
- proposals: `recipe/evidence/pointed/avatar-{mui,antd,altitude,shadcn,fluent}/`
