# Intrinsic fractional Grid sizing: browser versus Figma

This diagnostic addresses `react-root-grid-constraints-unqualified` in the
original 69-case Radix Grid cohort. It awards no conversion or fidelity pass.

## Browser evidence

Chromium was run through the existing Playwright installation. Four assertions
passed with automatic container height and start content alignment:

| Declared rows | Item heights | Resolved rows | Container height |
| --- | --- | --- | --- |
| `1fr 2fr` | 20, 20 | 20, 40 | 60 |
| `1fr 2fr` | 20, 80 | 40, 80 | 120 |
| `auto auto` | 20, 80 | 20, 80 | 100 |
| `repeat(5,minmax(0px,1fr))` | 24, 24 | 24, 24, 24, 24, 24 | 120 |

The third row is a negative control for replacing fractional rows with HUG.
The fourth checks empty explicit tracks, which matter to the original Grid
rows cases. This is diagnostic input, not a replacement benchmark cohort.

## Fresh native evidence

Writable file: `NqssRZQpSjChxv5VyN1ZvJ` (Live Testing).
Section `140:45964`, named `Grid intrinsic fraction diagnostic 802`, sits below
the existing comparison at y=400. Both frames have one flexible column,
two rows, zero gaps, and children with fixed heights of 20 and 80.

- `140:45965`, HUG written after fractional tracks: actual height 100;
  row metadata became HUG/HUG; child y positions 0 and 20.
- `140:45968`, HUG written before fractional tracks: actual height 100;
  row metadata retained FLEX 1/FLEX 2; child y positions 0 and 33.333332.
  The second 80px child extends beyond the frame. Screenshot inspection
  confirmed the gap and overflow; HUG readback does not prove intrinsic sizing.

## Implementation consequence

Do not implement the apparent shortcut from automatic-height fractional rows
to HUG rows. The original declaration is valid CSS and native GRID does not
currently reproduce its intrinsic sizing by either tested write order.

A subsequent experiment must distinguish source declarations from evaluated
layout: retain fractional tracks in the contract, resolve intrinsic size from
content and caller constraints for native output, and recompute when those
inputs change. A sampled fixed height alone cannot establish this behavior.
Before attempting all 69 cases, demonstrate one original case plus a changed
content control through normal ownership, native emission, and fidelity checks.
The current schema refusal stays in place pending that proof.

Reference: [CSS Grid flexible track sizing](https://www.w3.org/TR/css-grid-1/#algo-flex-tracks).
