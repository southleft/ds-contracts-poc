# Decisions ledger — Switch contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| label-2.font-size | axis:labelPosition=start | `{imported.switch.label-2.font-size}` | `{font-size-base}` | `14px` | `16px` | 1 |
| label-2.font-weight | axis:labelPosition=start | `{imported.switch.label-2.font-weight}` | `{font-weight-medium}` | `500` | `400` | 1 |
| switch-2.background-color | axis:labelPosition=start | `{imported.switch.switch-2.background-color}` | `{color-background-gray}` | `rgba(10, 19, 23, 0.2)` | `rgba(0, 0, 0, 0)` | 1 |
| switch-2.border-bottom-left-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-2.border-bottom-right-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-2.border-top-left-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-2.border-top-right-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb-2.border-bottom-left-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb-2.border-bottom-right-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb-2.border-top-left-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb-2.border-top-right-radius | axis:labelPosition=start | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch.background-color | axis:labelPosition=end | `{imported.switch.switch.background-color}` | `{color-background-gray}` | `rgba(10, 19, 23, 0.2)` | `rgba(0, 0, 0, 0)` | 1 |
| switch.border-bottom-left-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch.border-bottom-right-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch.border-top-left-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch.border-top-right-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb.border-bottom-left-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb.border-bottom-right-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb.border-top-left-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| switch-thumb.border-top-right-radius | axis:labelPosition=end | `{imported.shared.size-9999}` | `{radius-full}` | `9999px` | `0px` | 1 |
| label.font-size | axis:labelPosition=end | `{imported.switch.label.font-size}` | `{font-size-base}` | `14px` | `16px` | 1 |
| label.font-weight | axis:labelPosition=end | `{imported.switch.label.font-weight}` | `{font-weight-medium}` | `500` | `400` | 1 |
| label-2.color | axis:labelPosition=start | `{imported.shared.color-4e606f}` | `{color-text-secondary}` | `rgba(78, 96, 111, 1)` | `rgba(0, 0, 0, 1)` | 1 |
| label.color | axis:labelPosition=end | `{imported.shared.color-4e606f}` | `{color-text-secondary}` | `rgba(78, 96, 111, 1)` | `rgba(0, 0, 0, 1)` | 1 |

## Named causes

- **label-2.font-size** (1 items): UNTRIAGED — a defect until triaged
- **label-2.font-weight** (1 items): UNTRIAGED — a defect until triaged
- **switch-2.background-color** (1 items): UNTRIAGED — a defect until triaged
- **switch-2.border-bottom-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-2.border-bottom-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-2.border-top-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-2.border-top-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb-2.border-bottom-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb-2.border-bottom-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb-2.border-top-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb-2.border-top-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch.background-color** (1 items): UNTRIAGED — a defect until triaged
- **switch.border-bottom-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch.border-bottom-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch.border-top-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch.border-top-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb.border-bottom-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb.border-bottom-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb.border-top-left-radius** (1 items): UNTRIAGED — a defect until triaged
- **switch-thumb.border-top-right-radius** (1 items): UNTRIAGED — a defect until triaged
- **label.font-size** (1 items): UNTRIAGED — a defect until triaged
- **label.font-weight** (1 items): UNTRIAGED — a defect until triaged
- **label-2.color** (1 items): UNTRIAGED — a defect until triaged
- **label.color** (1 items): UNTRIAGED — a defect until triaged

