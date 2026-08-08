# Visual-truth — headless canvas-vs-code scorecard report

Source: `rest-images-api` (Figma REST renders at scale 2, no desktop app, no plugin bridge), scored under the one bar (`pctAAMasked <= 5` AND `compositionOk`) with the developed-score normalization policy. Written by `scripts/visual-truth-report.mjs`; regenerate with `npm run visual-truth:report`.

generatedFrom: sha256:ebd9b2c7c50352d6b28eb62c144cb8f559b8adbd44f376e01cae4bc906705756 (128 scorecards)

## Summary

**10 pass / 71 fail / 47 skip / 0 error** across 128 stems.

## Per-lane pass counts vs RATCHET floors

| lane | scored | headless pass | ratchet floor | meets floor |
|---|---:|---:|---:|---|
| first-party | 11/49 | 0 | 0 | yes |
| mui | 26/31 | 4 | 0 | yes |
| tailwind | 5/5 | 2 | 2 | yes |
| altitude | 7/8 | 2 | 4 | **NO** |
| astryx | 10/13 | 0 | 0 | yes |
| carbon | 10/10 | 2 | 2 | yes |
| polaris | 12/12 | 0 | 0 | yes |

## Worst-first

| lane | stem | pctAAMasked | compositionOk | status |
|---|---|---:|---|---|
| first-party | progress-bar | 90.91% | false | fail |
| first-party | button | 90.90% | false | fail |
| first-party | badge | 86.86% | false | fail |
| mui | button | 86.77% | true | fail |
| mui | linear-progress | 85.95% | false | fail |
| polaris | button | 77.58% | false | fail |
| polaris | thumbnail | 77.47% | false | fail |
| mui | drawer | 73.30% | false | fail |
| carbon | tag | 71.86% | false | fail |
| first-party | avatar | 68.73% | false | fail |
| astryx | banner | 63.67% | false | fail |
| polaris | progress-bar | 59.77% | true | fail |
| mui | dialog | 51.54% | true | fail |
| mui | badge | 50.19% | false | fail |
| mui | switch | 50.00% | true | fail |
| mui | slider | 48.47% | true | fail |
| carbon | checkbox | 41.92% | false | fail |
| carbon | button | 37.79% | true | fail |
| astryx | token | 31.39% | false | fail |
| first-party | switch | 31.20% | true | fail |
| astryx | slider | 30.69% | false | fail |
| mui | card | 30.06% | true | fail |
| first-party | spinner | 29.92% | true | fail |
| first-party | checkbox | 29.06% | true | fail |
| mui | breadcrumbs | 25.70% | true | fail |
| astryx | progress-bar | 25.39% | false | fail |
| mui | paper | 24.76% | true | fail |
| mui | input-adornment | 23.44% | true | fail |
| altitude | icon-close | 22.27% | true | fail |
| polaris | radio-button | 19.90% | true | fail |
| astryx | card | 19.31% | false | fail |
| polaris | badge | 16.93% | false | fail |
| mui | circular-progress | 16.09% | true | fail |
| polaris | tag | 14.93% | true | fail |
| carbon | modal | 14.64% | true | fail |
| mui | link | 14.60% | false | fail |
| polaris | avatar | 14.54% | true | fail |
| polaris | text | 13.60% | false | fail |
| altitude | heading | 13.00% | true | fail |
| astryx | badge | 12.74% | true | fail |
| polaris | checkbox | 11.35% | false | fail |
| astryx | switch | 11.24% | true | fail |
| mui | tabs | 11.21% | true | fail |
| mui | menu | 11.14% | false | fail |
| mui | alert | 10.27% | true | fail |
| carbon | tabs | 9.96% | false | fail |
| polaris | banner | 8.91% | true | fail |
| astryx | checkbox-input | 8.82% | false | fail |
| polaris | spinner | 8.82% | true | fail |
| mui | avatar | 8.57% | true | fail |
| mui | autocomplete | 8.56% | true | fail |
| carbon | accordion | 7.86% | true | fail |
| tailwind | card | 7.81% | true | fail |
| polaris | text-field | 7.26% | false | fail |
| first-party | slider | 7.03% | false | fail |
| astryx | button | 6.94% | true | fail |
| carbon | toggle | 6.81% | true | fail |
| tailwind | toggle-switch | 6.72% | true | fail |
| mui | text-field | 6.49% | true | fail |
| carbon | inline-notification | 6.38% | true | fail |
| first-party | banner | 6.02% | false | fail |
| altitude | link | 6.01% | true | fail |
| altitude | badge | 6.00% | true | fail |
| tailwind | alert | 5.89% | true | fail |
| mui | chip | 5.88% | true | fail |
| mui | tooltip | 5.88% | true | fail |
| first-party | text-field | 5.88% | false | fail |
| mui | accordion | 5.05% | false | fail |
| first-party | card | 2.38% | false | fail |
| astryx | text-input | 1.80% | false | fail |
| altitude | avatar | 0.36% | false | fail |
| carbon | text-input | 4.29% | true | pass |
| altitude | button | 3.96% | true | pass |
| tailwind | badge | 3.96% | true | pass |
| mui | snackbar | 3.63% | true | pass |
| altitude | chip | 3.37% | true | pass |
| carbon | icon-button | 3.30% | true | pass |
| tailwind | button | 2.21% | true | pass |
| mui | table | 1.65% | true | pass |
| mui | checkbox | 0.62% | true | pass |
| mui | divider | 0.00% | true | pass |
| altitude | divider | — | — | skip (node-gone) |
| astryx | dropdown-menu | — | — | skip (no-reference) |
| astryx | dropdown-menu-item | — | — | skip (no-reference) |
| astryx | toast | — | — | skip (no-reference) |
| first-party | accordion-item | — | — | skip (no-reference) |
| first-party | avatar-group | — | — | skip (no-reference) |
| first-party | blockquote | — | — | skip (no-reference) |
| first-party | breadcrumb-item | — | — | skip (no-reference) |
| first-party | breadcrumbs | — | — | skip (no-reference) |
| first-party | chat-message | — | — | skip (no-reference) |
| first-party | chat-message-metadata | — | — | skip (no-reference) |
| first-party | chat-system-message | — | — | skip (no-reference) |
| first-party | citation | — | — | skip (no-reference) |
| first-party | code | — | — | skip (no-reference) |
| first-party | divider | — | — | skip (no-reference) |
| first-party | empty-state | — | — | skip (no-reference) |
| first-party | field | — | — | skip (no-reference) |
| first-party | heading | — | — | skip (no-reference) |
| first-party | icon-button | — | — | skip (no-reference) |
| first-party | kbd | — | — | skip (no-reference) |
| first-party | list | — | — | skip (no-reference) |
| first-party | list-item | — | — | skip (no-reference) |
| first-party | metadata-list | — | — | skip (no-reference) |
| first-party | metadata-list-item | — | — | skip (no-reference) |
| first-party | pagination | — | — | skip (no-reference) |
| first-party | section | — | — | skip (no-reference) |
| first-party | side-nav-item | — | — | skip (no-reference) |
| first-party | skeleton | — | — | skip (no-reference) |
| first-party | status-dot | — | — | skip (no-reference) |
| first-party | tab | — | — | skip (no-reference) |
| first-party | tab-list | — | — | skip (no-reference) |
| first-party | table | — | — | skip (no-reference) |
| first-party | table-cell | — | — | skip (no-reference) |
| first-party | table-header-cell | — | — | skip (no-reference) |
| first-party | table-row | — | — | skip (no-reference) |
| first-party | text-area | — | — | skip (no-reference) |
| first-party | toast | — | — | skip (no-reference) |
| first-party | token | — | — | skip (no-reference) |
| first-party | toolbar | — | — | skip (no-reference) |
| first-party | top-nav | — | — | skip (no-reference) |
| first-party | top-nav-item | — | — | skip (no-reference) |
| first-party | typeahead-item | — | — | skip (no-reference) |
| mui | fab | — | — | skip (no-reference) |
| mui | icon-button | — | — | skip (no-reference) |
| mui | radio | — | — | skip (no-reference) |
| mui | select | — | — | skip (no-reference) |
| mui | table-pagination | — | — | skip (no-reference) |

## Skip inventory

- **no-reference** (46): astryx/dropdown-menu, astryx/dropdown-menu-item, astryx/toast, first-party/accordion-item, first-party/avatar-group, first-party/blockquote, first-party/breadcrumb-item, first-party/breadcrumbs, first-party/chat-message, first-party/chat-message-metadata, first-party/chat-system-message, first-party/citation, first-party/code, first-party/divider, first-party/empty-state, first-party/field, first-party/heading, first-party/icon-button, first-party/kbd, first-party/list, first-party/list-item, first-party/metadata-list, first-party/metadata-list-item, first-party/pagination, first-party/section, first-party/side-nav-item, first-party/skeleton, first-party/status-dot, first-party/tab, first-party/tab-list, first-party/table, first-party/table-cell, first-party/table-header-cell, first-party/table-row, first-party/text-area, first-party/toast, first-party/token, first-party/toolbar, first-party/top-nav, first-party/top-nav-item, first-party/typeahead-item, mui/fab, mui/icon-button, mui/radio, mui/select, mui/table-pagination
- **node-gone** (1): altitude/divider

