# Flowbite contract parity — authored vs code-capture

Recorded 2026-08-17. Authored contracts in
`examples/tailwind/contracts` vs `extract/computed/out/tailwind/<stem>/enriched.contract.json`.

This is hop 5 of [NORTH-STAR.md](./NORTH-STAR.md): align the contracts we have
(authored + captured-from-code + canvas property inventory) and **name** the gaps.

## Alert

- host: authored `div` · captured `div`
- props: authored [color, icon, dismissable, children] · captured [color, icon, dismissable, children]
- props: **aligned**
- parts: authored 9 · captured 9
- parts: **aligned**
- **event gap (standing)** authored declares onDismiss@dismiss; captured-from-code has none — the static/type seed never saw handlers
- canvas (120:1979): **props aligned** · 4 variant(s) · 76 variable binds

## Badge

- host: authored `span` · captured `span`
- props: authored [color, size, children] · captured [color, size, children]
- props: **aligned**
- parts: authored 2 · captured 2
- parts: **aligned**
- events: none on either side (presentational)
- canvas (120:2098): **props aligned** · 24 variant(s) · 288 variable binds

## Button

- host: authored `button` · captured `button`
- props: authored [color, size, children] · captured [color, size, children]
- props: **aligned**
- parts: authored 1 · captured 1
- parts: **aligned**
- events: none on either side (presentational)
- canvas (120:2203): **props aligned** · 45 variant(s) · 630 variable binds

## Card

- host: authored `div` · captured `div`
- props: authored [children] · captured [children]
- props: **aligned**
- parts: authored 2 · captured 2
- parts: **aligned**
- events: none on either side (presentational)
- canvas (120:1999): **props aligned** · 1 variant(s) · 16 variable binds

## HelperText

- host: authored `div` · captured `div`
- props: authored [color, children] · captured [color, children]
- props: **aligned**
- parts: authored 1 · captured 1
- parts: **aligned**
- events: none on either side (presentational)
- canvas (120:2014): **props aligned** · 5 variant(s) · 15 variable binds

## Kbd

- host: authored `span` · captured `span`
- props: authored [children] · captured [children]
- props: **aligned**
- parts: authored 1 · captured 1
- parts: **aligned**
- events: none on either side (presentational)
- canvas (120:1982): **props aligned** · 1 variant(s) · 17 variable binds

## Label

- host: authored `label` · captured `label`
- props: authored [color, children] · captured [color, children]
- props: **aligned**
- parts: authored 1 · captured 1
- parts: **aligned**
- events: none on either side (presentational)
- canvas (120:1996): **props aligned** · 5 variant(s) · 15 variable binds

## ToggleSwitch

- host: authored `button` role=switch · captured `button`
- props: authored [sizing, checked, label] · captured [sizing, checked, label]
- props: **aligned**
- parts: authored 4 · captured 4
- parts: **aligned**
- **event gap (standing)** authored declares onToggle@root; captured-from-code has none — the static/type seed never saw handlers
- canvas (120:2047): **props aligned** · 6 variant(s) · 102 variable binds

## Standing gaps (named, not unfinished)

1. **Events are authored, never recovered.** Capture-from-code and dump-from-Figma do not invent `onToggle` / `onDismiss`. The functional React hop requires the authored `events[]` block.
2. **Canvas cannot run behavior.** Figma shows ToggleSwitch `checked` and Alert `Dismissable` as variants/booleans. That is the correct projection, not a miss.
3. **`FC-FONT-SUBSTRATE`** — ToggleSwitch 6.19%, HelperText 16.96%, Label 16.03%. Text/glyph stems; canvas is Inter, library is the platform system stack. Kbd (boxed) passes at 0.42%. Do not climb the font wall.
4. **Path B orig-shots now exist** for HelperText / Label / Kbd (`extract/computed/out/tailwind/<stem>/orig-shots/*__default.png`). The previous `UNSCORED-NO-ORIG-SHOT` is closed. Code-vs-library AA stays 20/20, 20/20, 4/4.

Authored events with no captured counterpart:
- Alert: onDismiss
- ToggleSwitch: onToggle

**2 named gap(s) in this report.** Gaps are the product. Closing them silently would be a lie.
