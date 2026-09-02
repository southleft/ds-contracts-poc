# F1 · tooltip@1 — the fourth archetype the one command covers

`schema-tooltip.ts`, `draftTooltipRoles`, `propose-tooltip.ts`;
`npm run recipe:point -- --archetype tooltip --library <lib>`. One role — the
painted tip that carries the text — plus the popper wrapper and arrow the
capture also holds, which a proposal now names as refusals from the ledger
(`floatingRefusals`: a positioned transparent wrapper is the placement;
a class containing "arrow" or a text-less svg inside the tip is the arrow) —
and a box-shadow the archetype has no leaf for (`shadowRefusal`).

| library | reviewed | manifest row | score (v9, page `219:92051`) |
|---|---|---|---|
| antd | none (14 read, 0 invented; shadow + placement + arrow refused by name) | `tooltip/antd-proposed` | **3.01%** = the hand row |
| mui | none (14 read; `line-height: normal` → unit `auto`) | none — see below | — |
| shadcn | font fallback Inter Variable → Inter (named) | `tooltip/shadcn` (re-captured) | **4.73%** |
| chakra | none (14 read, 0 invented; placement + arrow + openDelay refused) | `tooltip/chakra` — HELD OUT, captured 2026-09-02 | 8.83%, named `font-substrate` |

**Chakra, held out, captured the same day through the portal path.** A
person wrote the seed contract and the config entry; the in-stage form
refused by name as multi-root (Chakra's Positioner must sit in a `Portal`),
the portal capture kept one real screenshot, and the command proposed the
fixture with no `--set`. Inter Medium 12px resolved *exact* in Figma, and
still the box is two columns narrower (216 vs 218): Chromium hugs the label
at 217.016px, Figma at 216 — the face's advance widths, not a read. Padding,
fill, radius and height agree. Named in the ratchet as `font-substrate`,
the fourth row of that class among the held-outs (Carbon Tag, Altitude
Link, MUI Link).

**MUI has no real render to score.** Its tooltip was captured before
`--keep-originals`, and the re-capture refuses under the determinism rule:
the closed-state popper's `transform` differs between the two sweeps
(`matrix(1,0,0,1,19,53)` vs another offset) — the popper is repositioning
against its anchor, a runtime fact the double-sweep correctly refuses to
call stable. Named here, not worked around.

## An instrument defect fixed on the way

Every portal re-capture crashed on its second sweep with
`props is not iterable`: `run.ts` reloads the portal page for the
determinism sweep and the reload drops `window.__ALL_PROPS`, the longhand
list the in-page reader iterates. It is set again after the reload and held
to the first page's set. shadcn's tooltip is the first portal component
re-captured with real screenshots.
