# Decisions ledger — Slider contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| label.font-size | base | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 6 |
| label.font-weight | base | `{imported.slider.label.font-weight}` | `{font-weight-medium}` | `500` | `400` | 6 |
| slider-track.border-bottom-left-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| slider-track.border-bottom-right-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| slider-track.border-top-left-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| slider-track.border-top-right-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| part-1-0-1.border-bottom-left-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| part-1-0-1.border-bottom-right-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| part-1-0-1.border-top-left-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| part-1-0-1.border-top-right-radius | base | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 6 |
| slider-thumb.border-bottom-left-radius | axis:valueDisplay=tooltip | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 2 |
| slider-thumb.border-bottom-right-radius | axis:valueDisplay=tooltip | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 2 |
| slider-thumb.border-top-left-radius | axis:valueDisplay=tooltip | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 2 |
| slider-thumb.border-top-right-radius | axis:valueDisplay=tooltip | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 2 |
| tooltip.border-bottom-left-radius | axis:valueDisplay=tooltip | `{imported.shared.size-12}` | `{radius-container}` | `12px` | `0px` | 2 |
| tooltip.border-bottom-right-radius | axis:valueDisplay=tooltip | `{imported.shared.size-12}` | `{radius-container}` | `12px` | `0px` | 2 |
| tooltip.border-top-left-radius | axis:valueDisplay=tooltip | `{imported.shared.size-12}` | `{radius-container}` | `12px` | `0px` | 2 |
| tooltip.border-top-right-radius | axis:valueDisplay=tooltip | `{imported.shared.size-12}` | `{radius-container}` | `12px` | `0px` | 2 |
| tooltip.font-size | axis:valueDisplay=tooltip | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 2 |
| label-2.font-size | axis:valueDisplay=tooltip | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 2 |
| slider-thumb-2.border-bottom-left-radius | axis:valueDisplay=none|text | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 4 |
| slider-thumb-2.border-bottom-right-radius | axis:valueDisplay=none|text | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 4 |
| slider-thumb-2.border-top-left-radius | axis:valueDisplay=none|text | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 4 |
| slider-thumb-2.border-top-right-radius | axis:valueDisplay=none|text | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 4 |
| label-3.font-size | axis:valueDisplay=text | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 2 |
| label.color | base | `{imported.slider.label.color}` | `{color-text-secondary}` | `rgba(78, 96, 111, 1)` | `rgba(0, 0, 0, 1)` | 6 |
| part-1-0-1.background-color | base | `{imported.shared.color-0064e0}` | `{color-accent}` | `rgba(0, 100, 224, 1)` | `rgba(0, 0, 0, 0)` | 6 |
| slider-thumb.background-color | axis:valueDisplay=tooltip | `{imported.shared.color-0064e0}` | `{color-accent}` | `rgba(0, 100, 224, 1)` | `rgba(0, 0, 0, 0)` | 2 |
| tooltip.background-color | axis:valueDisplay=tooltip | `{imported.shared.color-0a1317}` | `{color-background-inverted}` | `rgba(10, 19, 23, 1)` | `rgba(0, 0, 0, 0)` | 2 |
| slider-thumb-2.background-color | axis:valueDisplay=none|text | `{imported.shared.color-0064e0}` | `{color-accent}` | `rgba(0, 100, 224, 1)` | `rgba(0, 0, 0, 0)` | 4 |
| label-3.color | axis:valueDisplay=text | `{imported.shared.color-0a1317}` | `{color-on-warning}` | `rgba(10, 19, 23, 1)` | `rgba(0, 0, 0, 1)` | 2 |

## Named causes

- **label.font-size** (6 items): UNTRIAGED — a defect until triaged
- **label.font-weight** (6 items): UNTRIAGED — a defect until triaged
- **slider-track.border-bottom-left-radius** (6 items): UNTRIAGED — a defect until triaged
- **slider-track.border-bottom-right-radius** (6 items): UNTRIAGED — a defect until triaged
- **slider-track.border-top-left-radius** (6 items): UNTRIAGED — a defect until triaged
- **slider-track.border-top-right-radius** (6 items): UNTRIAGED — a defect until triaged
- **part-1-0-1.border-bottom-left-radius** (6 items): UNTRIAGED — a defect until triaged
- **part-1-0-1.border-bottom-right-radius** (6 items): UNTRIAGED — a defect until triaged
- **part-1-0-1.border-top-left-radius** (6 items): UNTRIAGED — a defect until triaged
- **part-1-0-1.border-top-right-radius** (6 items): UNTRIAGED — a defect until triaged
- **slider-thumb.border-bottom-left-radius** (2 items): UNTRIAGED — a defect until triaged
- **slider-thumb.border-bottom-right-radius** (2 items): UNTRIAGED — a defect until triaged
- **slider-thumb.border-top-left-radius** (2 items): UNTRIAGED — a defect until triaged
- **slider-thumb.border-top-right-radius** (2 items): UNTRIAGED — a defect until triaged
- **tooltip.border-bottom-left-radius** (2 items): UNTRIAGED — a defect until triaged
- **tooltip.border-bottom-right-radius** (2 items): UNTRIAGED — a defect until triaged
- **tooltip.border-top-left-radius** (2 items): UNTRIAGED — a defect until triaged
- **tooltip.border-top-right-radius** (2 items): UNTRIAGED — a defect until triaged
- **tooltip.font-size** (2 items): UNTRIAGED — a defect until triaged
- **label-2.font-size** (2 items): UNTRIAGED — a defect until triaged
- **slider-thumb-2.border-bottom-left-radius** (4 items): UNTRIAGED — a defect until triaged
- **slider-thumb-2.border-bottom-right-radius** (4 items): UNTRIAGED — a defect until triaged
- **slider-thumb-2.border-top-left-radius** (4 items): UNTRIAGED — a defect until triaged
- **slider-thumb-2.border-top-right-radius** (4 items): UNTRIAGED — a defect until triaged
- **label-3.font-size** (2 items): UNTRIAGED — a defect until triaged
- **label.color** (6 items): UNTRIAGED — a defect until triaged
- **part-1-0-1.background-color** (6 items): UNTRIAGED — a defect until triaged
- **slider-thumb.background-color** (2 items): UNTRIAGED — a defect until triaged
- **tooltip.background-color** (2 items): UNTRIAGED — a defect until triaged
- **slider-thumb-2.background-color** (4 items): UNTRIAGED — a defect until triaged
- **label-3.color** (2 items): UNTRIAGED — a defect until triaged

