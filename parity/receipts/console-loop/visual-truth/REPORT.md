# Visual-truth — headless canvas-vs-code scorecard report

Source: `rest-images-api` (Figma REST renders at scale 1 — like-for-like with the bridge lane's scale-1 cell exports; no desktop app, no plugin bridge), scored under the one bar (`pctAAMasked <= 5` AND `compositionOk`) with the developed-score normalization policy. Written by `scripts/visual-truth-report.mjs`; regenerate with `npm run visual-truth:report`.

generatedFrom: sha256:0ea41c05d100de1da25502259fd9fe605f6e3942d3bf6121dbd065edff04f503 (128 scorecards)

## Summary

**15 pass / 72 fail / 41 skip / 0 error** across 128 stems.

## Per-lane pass counts vs RATCHET floors

| lane | scored | headless pass | ratchet floor | meets floor |
|---|---:|---:|---:|---|
| first-party | 11/49 | 0 | 0 | yes |
| mui | 31/31 | 4 | 4 | yes |
| tailwind | 5/5 | 3 | 3 | yes |
| altitude | 8/8 | 6 | 6 | yes |
| astryx | 10/13 | 0 | 0 | yes |
| carbon | 10/10 | 2 | 2 | yes |
| polaris | 12/12 | 0 | 0 | yes |

## Worst-first

| lane | stem | pctAAMasked | compositionOk | status |
|---|---|---:|---|---|
| first-party | progress-bar | 99.69% | false | fail |
| carbon | tag | 92.44% | false | fail |
| mui | button | 88.31% | true | fail |
| first-party | badge | 87.46% | true | fail |
| polaris | button | 77.83% | false | fail |
| polaris | thumbnail | 77.25% | false | fail |
| first-party | avatar | 63.19% | true | fail |
| astryx | card | 62.53% | false | fail |
| astryx | banner | 61.91% | false | fail |
| first-party | button | 59.86% | false | fail |
| polaris | progress-bar | 59.77% | true | fail |
| mui | linear-progress | 56.18% | false | fail |
| mui | drawer | 55.03% | false | fail |
| mui | badge | 54.63% | false | fail |
| mui | dialog | 53.79% | true | fail |
| first-party | banner | 50.21% | false | fail |
| mui | switch | 49.88% | true | fail |
| mui | slider | 48.16% | true | fail |
| polaris | badge | 41.38% | true | fail |
| mui | radio | 38.50% | true | fail |
| carbon | button | 35.66% | true | fail |
| astryx | token | 35.29% | false | fail |
| first-party | switch | 31.95% | true | fail |
| mui | card | 31.48% | true | fail |
| carbon | checkbox | 31.44% | true | fail |
| astryx | progress-bar | 30.34% | false | fail |
| astryx | slider | 30.29% | false | fail |
| first-party | spinner | 30.00% | false | fail |
| first-party | checkbox | 28.94% | true | fail |
| mui | paper | 25.94% | true | fail |
| carbon | inline-notification | 25.31% | true | fail |
| mui | icon-button | 24.84% | false | fail |
| mui | input-adornment | 24.22% | true | fail |
| mui | tooltip | 23.47% | true | fail |
| astryx | checkbox-input | 22.25% | false | fail |
| mui | circular-progress | 21.24% | true | fail |
| polaris | radio-button | 21.14% | true | fail |
| mui | breadcrumbs | 20.49% | true | fail |
| carbon | tabs | 17.59% | false | fail |
| mui | table-pagination | 17.54% | true | fail |
| mui | tabs | 15.48% | true | fail |
| altitude | badge | 15.44% | true | fail |
| polaris | checkbox | 14.84% | false | fail |
| carbon | modal | 14.63% | true | fail |
| polaris | avatar | 14.54% | true | fail |
| mui | link | 14.15% | false | fail |
| polaris | tag | 14.03% | true | fail |
| astryx | badge | 12.62% | true | fail |
| mui | avatar | 12.14% | true | fail |
| mui | select | 11.24% | true | fail |
| mui | menu | 10.68% | false | fail |
| polaris | text | 10.55% | false | fail |
| first-party | text-field | 10.42% | false | fail |
| polaris | text-field | 9.60% | false | fail |
| polaris | banner | 8.95% | true | fail |
| carbon | accordion | 8.94% | true | fail |
| astryx | switch | 8.78% | true | fail |
| carbon | toggle | 8.56% | true | fail |
| mui | autocomplete | 8.48% | true | fail |
| astryx | button | 8.00% | true | fail |
| polaris | spinner | 7.79% | true | fail |
| tailwind | card | 7.68% | true | fail |
| first-party | card | 7.36% | false | fail |
| mui | accordion | 7.34% | false | fail |
| first-party | slider | 7.04% | false | fail |
| mui | alert | 6.49% | true | fail |
| mui | chip | 6.47% | true | fail |
| mui | text-field | 6.33% | true | fail |
| tailwind | toggle-switch | 6.19% | true | fail |
| mui | fab | 2.13% | false | fail |
| astryx | text-input | 1.72% | false | fail |
| altitude | avatar | 0.13% | false | fail |
| carbon | text-input | 4.72% | true | pass |
| altitude | icon-close | 4.69% | true | pass |
| altitude | heading | 4.39% | true | pass |
| altitude | button | 4.23% | true | pass |
| tailwind | alert | 3.85% | true | pass |
| tailwind | badge | 2.43% | true | pass |
| mui | table | 2.36% | true | pass |
| mui | snackbar | 2.09% | true | pass |
| carbon | icon-button | 2.08% | true | pass |
| altitude | link | 2.01% | true | pass |
| tailwind | button | 1.97% | true | pass |
| altitude | chip | 0.67% | true | pass |
| altitude | divider | 0.00% | true | pass |
| mui | checkbox | 0.00% | true | pass |
| mui | divider | 0.00% | true | pass |
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

## Skip inventory

- **no-reference** (41): astryx/dropdown-menu, astryx/dropdown-menu-item, astryx/toast, first-party/accordion-item, first-party/avatar-group, first-party/blockquote, first-party/breadcrumb-item, first-party/breadcrumbs, first-party/chat-message, first-party/chat-message-metadata, first-party/chat-system-message, first-party/citation, first-party/code, first-party/divider, first-party/empty-state, first-party/field, first-party/heading, first-party/icon-button, first-party/kbd, first-party/list, first-party/list-item, first-party/metadata-list, first-party/metadata-list-item, first-party/pagination, first-party/section, first-party/side-nav-item, first-party/skeleton, first-party/status-dot, first-party/tab, first-party/tab-list, first-party/table, first-party/table-cell, first-party/table-header-cell, first-party/table-row, first-party/text-area, first-party/toast, first-party/token, first-party/toolbar, first-party/top-nav, first-party/top-nav-item, first-party/typeahead-item

