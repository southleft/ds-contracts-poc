/**
 * Runtime-styled paste detection for playground cost routing (docs/18 G6).
 * Pure source-text heuristics — no package.json, no network.
 *
 * When a paste is runtime/atomic styled AND has no co-located CSS Module
 * anatomy path, the playground must lead with a cost panel (computed capture
 * / onboard), not a raw generator refusal wall.
 */

export type StylingKind =
  | "emotion"
  | "styled-components"
  | "stylex"
  | "tailwind"
  | "css-module"
  | "plain";

export interface StylingDetectResult {
  kind: StylingKind;
  /** True when static propose will at best recover API + stub anatomy. */
  needsComputedCapture: boolean;
  /** Short designer/engineer-facing cost lines. */
  costLines: string[];
  /** Primary CTA copy. */
  cta: string;
}

const EMOTION =
  /@emotion\/(styled|react|css)|from\s+['"]@emotion\//i;
const STYLED_COMPONENTS =
  /from\s+['"]styled-components['"]|styled\.[A-Za-z]|styled\s*\(/;
const STYLEX = /@stylexjs\/|stylex\.(create|props|defineVars)/i;
const TAILWIND_CLASSY =
  /\bclass(?:Name)?\s*=\s*{?["'`][^"'`]*(?:flex|grid|px-|py-|gap-|text-|bg-|rounded-|w-|h-)[^"'`]*["'`]/;
const CSS_MODULE_IMPORT =
  /import\s+\w+\s+from\s+['"][^'"]+\.module\.(css|scss|sass)['"]/;

export function detectStyling(
  tsx: string,
  css: string = "",
): StylingDetectResult {
  const hasCssModule =
    CSS_MODULE_IMPORT.test(tsx) ||
    (css.trim().length > 0 && !/styled\.|@emotion|@stylexjs/.test(css));

  if (EMOTION.test(tsx)) {
    return cost(
      "emotion",
      !hasCssModule,
      "Emotion / CSS-in-JS — static extract recovers the API surface; anatomy needs a real Chromium capture.",
    );
  }
  if (STYLED_COMPONENTS.test(tsx)) {
    return cost(
      "styled-components",
      !hasCssModule,
      "styled-components — static extract recovers props/axes; drawn anatomy needs computed capture.",
    );
  }
  if (STYLEX.test(tsx)) {
    return cost(
      "stylex",
      !hasCssModule,
      "StyleX — static propose cannot read compiled style atoms as canvas anatomy.",
    );
  }
  if (TAILWIND_CLASSY.test(tsx) && !hasCssModule) {
    return cost(
      "tailwind",
      true,
      "Utility-class markup without a co-located CSS Module — anatomy is measured via computed capture, not guessed from class names.",
    );
  }
  if (hasCssModule || css.trim().length > 0) {
    return {
      kind: "css-module",
      needsComputedCapture: false,
      costLines: [],
      cta: "",
    };
  }
  return {
    kind: "plain",
    needsComputedCapture: false,
    costLines: [],
    cta: "",
  };
}

function cost(
  kind: StylingKind,
  needsComputedCapture: boolean,
  lead: string,
): StylingDetectResult {
  if (!needsComputedCapture) {
    return { kind, needsComputedCapture: false, costLines: [], cta: "" };
  }
  return {
    kind,
    needsComputedCapture: true,
    costLines: [
      lead,
      "Static propose here would emit stub anatomy (correctly named empty frames) — that is not a successful conversion.",
      "Cost: run `ds-contracts onboard <package>` (or `extract --draft-capture-config`) so Chromium measures the drawn tree; review the draft capture config before phase 2.",
      "Scorecard: `npm run extract:computed:scorecard` counts components that stay unmeasurable without computed capture.",
    ],
    cta: "Propose API surface anyway (stub anatomy — incomplete)",
  };
}
