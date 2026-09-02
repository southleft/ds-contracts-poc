# Visual-truth — headless canvas-vs-code scorecard report

Source: `rest-images-api` (Figma REST renders at scale 1 — like-for-like with the bridge lane's scale-1 cell exports; no desktop app, no plugin bridge), scored under the one bar (`pctAAMasked <= 5` AND `compositionOk`) with the developed-score normalization policy. Written by `scripts/visual-truth-report.mjs`; regenerate with `npm run visual-truth:report`.

generatedFrom: sha256:9c40a44f5077c6683541a3ab54860db4d2165e2c24cd5953448eb4c2ba2289f9 (133 scorecards)

## Summary

**31 pass / 64 fail / 38 skip / 0 error** across 133 stems.

## Per-lane pass counts vs RATCHET floors

| lane | scored | headless pass | ratchet floor | meets floor |
|---|---:|---:|---:|---|
| first-party | 18/54 | 10 | 10 | yes |
| mui | 31/31 | 7 | 7 | yes |
| tailwind | 5/5 | 4 | 4 | yes |
| altitude | 8/8 | 4 | 4 | yes |
| astryx | 11/13 | 0 | 1 | **NO** |
| carbon | 10/10 | 2 | 2 | yes |
| polaris | 12/12 | 4 | 3 | yes |

### Advisory lanes (below floor by recorded decision)

- **astryx** — floor held at 1 since 2026-08-22; headless passes measured 0 then, 0 now. `npm run visual-truth:check` reports this lane as a WARNING, not an error, so the required lane stays red-capable for every other lane; it fails again if the count drops below 0, and refuses the entry as stale once the lane meets its floor. Backed by: BRIDGE only: astryx/badge 4.88 pctAAMasked, compositionOk (parity/receipts/console-loop/astryx/scores/badge.json). The HEADLESS card for the same stem and the same reference (orig-shots/blue__default.png) reads 5.36 (visual-truth/astryx/badge.json, re-run and re-scored 2026-08-11 under composite-over-white; sha pins and receipt reference verified current). Both-instrument pass set: empty. Lifts when: Any astryx stem scores <= 5 with compositionOk on the headless instrument (astryx/badge at 5.36 is the nearest). visual-truth:check then refuses this entry as stale until it is deleted, at which point the lane is enforced again at floor 1.

## Worst-first

| lane | stem | pctAAMasked | compositionOk | status |
|---|---|---:|---|---|
| first-party | progress-bar | 99.69% | false | fail |
| mui | dialog | 94.61% | false | fail |
| astryx | button | 90.69% | false | fail |
| mui | menu | 78.93% | false | fail |
| mui | snackbar | 72.85% | false | fail |
| mui | badge | 63.25% | false | fail |
| mui | avatar | 59.13% | false | fail |
| mui | linear-progress | 56.18% | false | fail |
| carbon | button | 39.38% | false | fail |
| mui | radio | 38.50% | true | fail |
| mui | fab | 34.76% | false | fail |
| mui | card | 31.48% | true | fail |
| mui | drawer | 31.45% | true | fail |
| first-party | spinner | 30.00% | false | fail |
| mui | link | 29.44% | false | fail |
| mui | paper | 25.94% | true | fail |
| carbon | inline-notification | 25.10% | true | fail |
| mui | icon-button | 24.84% | false | fail |
| astryx | progress-bar | 24.81% | false | fail |
| mui | tooltip | 23.47% | true | fail |
| mui | circular-progress | 20.23% | true | fail |
| altitude | icon-close | 19.75% | true | fail |
| carbon | checkbox | 19.65% | true | fail |
| polaris | button | 19.58% | true | fail |
| mui | button | 18.80% | true | fail |
| polaris | checkbox | 18.67% | true | fail |
| astryx | slider | 17.12% | false | fail |
| altitude | link | 16.83% | true | fail |
| altitude | badge | 16.70% | true | fail |
| polaris | progress-bar | 14.97% | true | fail |
| mui | breadcrumbs | 14.73% | true | fail |
| carbon | modal | 14.63% | true | fail |
| first-party | token | 14.62% | true | fail |
| astryx | switch | 14.12% | true | fail |
| astryx | checkbox-input | 14.07% | true | fail |
| mui | select | 11.74% | true | fail |
| astryx | text-input | 11.43% | true | fail |
| carbon | tabs | 11.05% | false | fail |
| polaris | avatar | 10.71% | true | fail |
| mui | tabs | 10.48% | false | fail |
| astryx | banner | 10.43% | true | fail |
| astryx | card | 9.58% | false | fail |
| carbon | accordion | 9.23% | true | fail |
| mui | autocomplete | 8.93% | true | fail |
| mui | alert | 8.25% | true | fail |
| polaris | radio-button | 7.85% | true | fail |
| polaris | text | 7.77% | true | fail |
| mui | table-pagination | 7.64% | true | fail |
| mui | text-field | 7.61% | true | fail |
| polaris | spinner | 7.46% | true | fail |
| first-party | button | 7.13% | true | fail |
| first-party | slider | 7.04% | false | fail |
| carbon | toggle | 6.51% | true | fail |
| astryx | token | 6.19% | false | fail |
| tailwind | toggle-switch | 6.19% | true | fail |
| first-party | text-field | 5.84% | true | fail |
| polaris | badge | 5.74% | true | fail |
| astryx | toast | 5.57% | false | fail |
| altitude | avatar | 5.47% | false | fail |
| astryx | badge | 5.36% | true | fail |
| carbon | text-input | 5.26% | true | fail |
| first-party | checkbox | 5.14% | true | fail |
| first-party | card | 1.60% | false | fail |
| mui | chip | 0.74% | false | fail |
| first-party | banner | 4.69% | true | pass |
| polaris | banner | 4.64% | true | pass |
| mui | accordion | 4.54% | true | pass |
| first-party | switch | 4.22% | true | pass |
| polaris | text-field | 4.21% | true | pass |
| first-party | avatar | 4.17% | true | pass |
| tailwind | alert | 3.85% | true | pass |
| tailwind | card | 3.38% | true | pass |
| altitude | button | 2.98% | true | pass |
| carbon | tag | 2.85% | true | pass |
| mui | table | 2.58% | true | pass |
| polaris | tag | 2.50% | true | pass |
| tailwind | badge | 2.43% | true | pass |
| altitude | heading | 2.39% | true | pass |
| carbon | icon-button | 2.08% | true | pass |
| first-party | badge | 2.00% | true | pass |
| tailwind | button | 1.97% | true | pass |
| first-party | sidebar-layout | 0.75% | true | pass |
| mui | input-adornment | 0.69% | true | pass |
| altitude | chip | 0.67% | true | pass |
| first-party | two-column | 0.63% | true | pass |
| mui | slider | 0.56% | true | pass |
| first-party | grid-gallery | 0.34% | true | pass |
| mui | switch | 0.28% | true | pass |
| first-party | bento-grid | 0.10% | true | pass |
| first-party | page-shell | 0.08% | true | pass |
| altitude | divider | 0.00% | true | pass |
| first-party | divider | 0.00% | true | pass |
| mui | checkbox | 0.00% | true | pass |
| mui | divider | 0.00% | true | pass |
| polaris | thumbnail | 0.00% | true | pass |
| astryx | dropdown-menu | — | — | skip (no-reference) |
| astryx | dropdown-menu-item | — | — | skip (no-reference) |
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
| first-party | toolbar | — | — | skip (no-reference) |
| first-party | top-nav | — | — | skip (no-reference) |
| first-party | top-nav-item | — | — | skip (no-reference) |
| first-party | typeahead-item | — | — | skip (no-reference) |

## Skip inventory

- **no-reference** (38): astryx/dropdown-menu, astryx/dropdown-menu-item, first-party/accordion-item, first-party/avatar-group, first-party/blockquote, first-party/breadcrumb-item, first-party/breadcrumbs, first-party/chat-message, first-party/chat-message-metadata, first-party/chat-system-message, first-party/citation, first-party/code, first-party/empty-state, first-party/field, first-party/heading, first-party/icon-button, first-party/kbd, first-party/list, first-party/list-item, first-party/metadata-list, first-party/metadata-list-item, first-party/pagination, first-party/section, first-party/side-nav-item, first-party/skeleton, first-party/status-dot, first-party/tab, first-party/tab-list, first-party/table, first-party/table-cell, first-party/table-header-cell, first-party/table-row, first-party/text-area, first-party/toast, first-party/toolbar, first-party/top-nav, first-party/top-nav-item, first-party/typeahead-item

