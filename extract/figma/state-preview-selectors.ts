/**
 * docs/23 §D.164 — a contract that opts in to code state previews emits each
 * previewable state as `:is(:hover, [data-state-preview="hover"])` instead of
 * `:hover` (same specificity, same live pseudo-class). Checks that read CSS as
 * text read that exact alternative as the pseudo-class it contains; any other
 * spelling is left alone, so a check still fails on it.
 */
const PREVIEW_ALTERNATIVE = /:is\(:(hover|active|focus-visible), \[data-state-preview=(["'])\1\2\]\)/g;

export const withoutStatePreviewAlternatives = (css: string): string =>
  css.replace(PREVIEW_ALTERNATIVE, ':$1');
