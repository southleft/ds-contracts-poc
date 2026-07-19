/**
 * The 12-component showcase curation — the HUMAN-REVIEW layer of promotion.
 *
 * Everything here is a named decision an adopting reviewer would make while
 * promoting the extractor's proposals to committed contracts:
 *
 *   · which CSS-module class is the root, which classes name the enum-axis
 *     variants (Polaris's `variationName('size', size)` convention — the
 *     extractor cannot read it through the `classNames()` helper, so the
 *     mapping is declared here and every promoted binding cites the CSS
 *     rule it came from)
 *   · the anatomy skeleton (part tree, elements, sample content) — anatomy
 *     is human-owned/reviewed in this repo's model (docs/11); the skeleton
 *     mirrors the component's real JSX, which the promotion ledger records
 *   · the verification combos and the selectors that locate the REAL
 *     Polaris rendering of each part (verify.ts)
 *
 * The promotion script (promote.ts) REFUSES any curated axis/part whose
 * class does not exist in the component's real module.css, and every
 * binding it emits is mechanically resolved from the real CSS + the real
 * published token set — curation points, it never values.
 *
 * COMPONENT SELECTION (owner list: Button, Badge, Banner, Card, Checkbox,
 * TextField, Tag, Avatar, Spinner, ProgressBar, RadioButton, Divider —
 * "adjust by what extracts richest, say why"):
 *   · Card DROPPED: it extracts 0 props and no anatomy — a thin wrapper
 *     over the Box primitive whose entire API is typed from
 *     @shopify/polaris-tokens aliases (outside single-file extraction
 *     scope, every prop a named skip). Nothing to show but the skip list.
 *   · Divider DROPPED for the same reason (0 props: borderColor/borderWidth
 *     are token-alias types from another package).
 *   · Text and Thumbnail ADDED: both are flagship-recognizable and among
 *     the richest extractions (Text: 4 enum axes over a pure CSS-module
 *     typography scale; Thumbnail: a size axis with a per-size
 *     border-radius override that exercises tokensByProp).
 */

export interface AxisCuration {
  /** Extracted enum prop name (must exist on the proposal — refused otherwise). */
  prop: string;
  /** canonical value → CSS-module class (must exist in the file). */
  classOf: Record<string, string>;
}

export interface PartCuration {
  name: string;
  /** '.Class' part selector in the module.css (match target). */
  cssClass?: string;
  /** Bare descendant selector under the root ('svg') when the styled node
   *  is not a classed element. */
  nestedSelector?: string;
  element?: string;
  attrs?: Record<string, string>;
  content?: { prop: string };
  text?: string;
  icon?: { asset: string; size?: number };
  visibleWhen?: { prop: string; equals?: string };
  optional?: boolean;
  animation?: 'spin' | 'pulse';
  shape?: { kind: 'polygon' | 'ellipse' | 'rect'; width: number; height: number; sides?: number };
  /** Why the shape's literal size is honest (cited source). */
  shapeCite?: string;
  parts?: PartCuration[];
  /** Verification: selector for THIS part inside the real Polaris DOM
   *  (relative to the combo container). */
  polarisSelector?: string;
}

export interface ExtraBindingCuration {
  /** Target part name ('root' or a curated part). */
  part: string;
  /** Plain bindings channel → token ref. */
  tokens?: Record<string, string>;
  /** Per-enum-value bindings: prop + value → channel → token ref. */
  tokensByProp?: { prop: string; map: Record<string, Record<string, string>> };
  /** REQUIRED provenance: where in Polaris's source these values are stated. */
  cite: string;
}

export interface ComboCuration {
  id: string;
  props: Record<string, string | number | boolean>;
}

export interface ComponentCuration {
  /** Extraction component name (code-extraction.json). */
  name: string;
  /** Showcase sample defaults for REQUIRED text props that extract without
   *  one (the generator needs a canvas/story sample). Sample ink, named in
   *  the ledger — never a claim about Polaris's own defaults. */
  sampleDefaults?: Record<string, string>;
  /** Contract id suffix (kebab). */
  idSuffix: string;
  /** module.css path relative to the polaris-react components root. */
  cssFile: string;
  rootClass: string;
  element: string;
  role?: string;
  roleByProp?: { prop: string; map: Record<string, string>; cite: string };
  axes: AxisCuration[];
  parts: PartCuration[];
  /** Sample label rendered as the root's bare text (static surfaces only). */
  sampleText?: string;
  extraBindings?: ExtraBindingCuration[];
  /** Curation-level honest-gap notes (each becomes a PROMOTION.md line). */
  notes: string[];
  combos: ComboCuration[];
  /** Rows EXPECTED to mismatch, each with a named cause (the visual-parity
   *  triage discipline: a red row must carry a committed named cause or the
   *  report shouts UNTRIAGED). */
  triage?: { part: string; channel: string; cause: string }[];
  polaris: {
    /** Export name in @shopify/polaris. */
    component: string;
    /** Root element selector inside the combo container. */
    rootSelector: string;
    /** Fixed props every combo passes (label, alt, …). */
    fixedProps?: Record<string, string | number | boolean>;
    /** Children text (omit for childless components). */
    childrenText?: string;
    /** Component needs an onChange={() => {}} to render controlled. */
    needsOnChange?: boolean;
    /** Per-channel selector overrides for ROOT rows (e.g. Banner's tone
     *  surface is an inner Box, not the root). */
    rootRowSelector?: Record<string, string>;
  };
}

const sizes = (m: Record<string, string>) => m;

export const CURATION: ComponentCuration[] = [
  {
    name: 'Button',
    idSuffix: 'button',
    cssFile: 'Button/Button.module.css',
    rootClass: 'Button',
    element: 'button',
    axes: [
      {
        prop: 'variant',
        classOf: {
          plain: 'variantPlain',
          primary: 'variantPrimary',
          secondary: 'variantSecondary',
          tertiary: 'variantTertiary',
          monochromePlain: 'variantMonochromePlain',
        },
      },
      { prop: 'tone', classOf: { critical: 'toneCritical', success: 'toneSuccess' } },
      {
        prop: 'size',
        classOf: sizes({ micro: 'sizeMicro', slim: 'sizeSlim', medium: 'sizeMedium', large: 'sizeLarge' }),
      },
      {
        prop: 'textAlign',
        classOf: { left: 'textAlignLeft', right: 'textAlignRight', center: 'textAlignCenter', start: 'textAlignStart', end: 'textAlignEnd' },
      },
    ],
    parts: [],
    sampleText: 'Button',
    notes: [
      'label: Polaris renders children through the Text primitive (variant bodySm, fontWeight medium) — children is platform API (named skip in extraction), so the showcase renders a static sample label and typography channels are NOT carried (they live in Text.module.css, another component\'s file)',
      'tone styling is conditioned on BOTH tone and variant classes (`.toneCritical:is(.variantPrimary)`) — a value conditioned on more than one axis is refused by name (the mint-code discipline), so tone carries no bindings',
      'primary/tertiary background pairs a gradient layer with the fill token (`var(--pc-button-bg-gradient), var(--p-color-bg-fill-brand)`) — a two-layer background is not a single binding; refused by name where it occurs',
      'icon/disclosure props are named extraction skips (composed types); the icon anatomy is not promoted',
    ],
    combos: [
      { id: 'default', props: {} },
      { id: 'variant-primary', props: { variant: 'primary' } },
      { id: 'variant-tertiary', props: { variant: 'tertiary' } },
      { id: 'variant-plain', props: { variant: 'plain' } },
      { id: 'size-micro', props: { size: 'micro' } },
      { id: 'size-large', props: { size: 'large' } },
    ],
    polaris: { component: 'Button', rootSelector: 'button.Polaris-Button', childrenText: 'Button' },
  },
  {
    name: 'Badge',
    idSuffix: 'badge',
    cssFile: 'Badge/Badge.module.css',
    rootClass: 'Badge',
    element: 'span',
    axes: [],
    parts: [],
    sampleText: 'Fulfilled',
    notes: [
      'tone / progress / icon / size props are NAMED extraction drops: BadgeProps is an intersection with a union of interfaces in the sibling types.ts — outside single-file scope. The committed contract carries the extracted API verbatim (1 prop), so only the DEFAULT badge is comparable; the tone axis is the showcase\'s clearest architecture-gap exhibit',
      'label typography rides the Text primitive (bodySm) inside the badge — not carried (another file); root-level font-weight IS carried (declared on .Badge itself)',
    ],
    combos: [{ id: 'default', props: {} }],
    polaris: { component: 'Badge', rootSelector: '.Polaris-Badge', childrenText: 'Fulfilled' },
  },
  {
    name: 'Banner',
    idSuffix: 'banner',
    cssFile: 'Banner/Banner.module.css',
    rootClass: 'Banner',
    element: 'div',
    role: 'status',
    roleByProp: {
      prop: 'tone',
      map: { success: 'status', info: 'status', warning: 'alert', critical: 'alert' },
      cite: "Banner.tsx: role={tone === 'warning' || tone === 'critical' ? 'alert' : 'status'}",
    },
    axes: [],
    parts: [
      {
        name: 'title',
        element: 'h2',
        content: { prop: 'title' },
        optional: false,
        polarisSelector: '.Polaris-Text--headingSm',
      },
      {
        name: 'body',
        element: 'span',
        text: 'Your order has shipped.',
      },
    ],
    extraBindings: [
      {
        part: 'root',
        tokensByProp: {
          prop: 'tone',
          map: {
            success: { 'background-color': '{p.color-bg-fill-success}', color: '{p.color-text-success-on-bg-fill}' },
            warning: { 'background-color': '{p.color-bg-fill-warning}', color: '{p.color-text-warning-on-bg-fill}' },
            critical: { 'background-color': '{p.color-bg-fill-critical}', color: '{p.color-text-critical-on-bg-fill}' },
            info: { 'background-color': '{p.color-bg-fill-info}', color: '{p.color-text-info-on-bg-fill}' },
          },
        },
        cite: "Banner/utilities.ts bannerAttributes[tone].withinPage — tone colors do NOT live in Banner.module.css; they thread through the Box primitive's background/color props as token aliases ('bg-fill-success' → --p-color-bg-fill-success). Promoted from that source map, alias names verbatim",
      },
    ],
    notes: [
      "tone → colors is a STYLING CHANNEL OUTSIDE CSS MODULES (prop-driven Box tokens) — the extractor cannot see it; the promotion cites Banner/utilities.ts and carries the withinPage variant (the default rendering context). The withinContentContainer palette is NOT carried (context-conditional, not a prop)",
      'the withinPage bevel/border-radius rides a postcss @mixin (shadow-bevel) behind a breakpoint custom-media query — named refusals (mixins and @media are not contract channels)',
      'title typography (headingSm) rides the Text primitive — not carried; the body sample text is a static showcase part (children is platform API)',
      'Polaris renders the tone surface on an inner Box, not the outer .Polaris-Banner (which stays bg-surface): the verify rows point at that inner Box by selector, and the structural difference is a named note',
    ],
    combos: [
      { id: 'tone-info', props: { tone: 'info', title: 'Order shipped' } },
      { id: 'tone-success', props: { tone: 'success', title: 'Order shipped' } },
      { id: 'tone-warning', props: { tone: 'warning', title: 'Order shipped' } },
      { id: 'tone-critical', props: { tone: 'critical', title: 'Order shipped' } },
    ],
    polaris: {
      component: 'Banner',
      rootSelector: '.Polaris-Banner',
      childrenText: 'Your order has shipped.',
      rootRowSelector: {
        'background-color': '.Polaris-Box[style*="--pc-box-background"]',
        color: '.Polaris-Box[style*="--pc-box-background"]',
      },
    },
  },
  {
    name: 'Checkbox',
    idSuffix: 'checkbox',
    cssFile: 'Checkbox/Checkbox.module.css',
    rootClass: 'Checkbox',
    element: 'span',
    axes: [],
    parts: [
      {
        name: 'input',
        cssClass: '.Input',
        element: 'input',
        attrs: { type: 'checkbox', name: '{name}', value: '{value}' },
      },
      {
        name: 'backdrop',
        cssClass: '.Backdrop',
        shape: { kind: 'rect', width: 20, height: 20 },
        shapeCite:
          'Choice.module.css .Control { --pc-choice-size: 18px; @media (--p-breakpoints-md-down) { --pc-choice-size: 20px } } — the control box is a component-private LITERAL, not a token; the showcase renders at a sub-md viewport, so the 20px value is carried as shape geometry (the schema\'s literal-decor channel), cited here',
        polarisSelector: '.Polaris-Checkbox__Backdrop',
      },
    ],
    triage: [
      {
        part: 'backdrop',
        channel: 'border-width',
        cause:
          "in Polaris's real composition the Choice wrapper's `.ChoiceLabel .Backdrop` rule sets border-width: 0 and repaints the outline as an inset box-shadow — a foreign-class descendant rule (named unmatched in PROMOTION.md); the carried binding renders the component's own standalone `.Backdrop` base rule",
      },
    ],
    notes: [
      'label is a ReactNode prop (named slot candidate in extraction) — not carried; the receipts show Polaris WITH its label and this surface without one, by declared scope',
      'checked/indeterminate visuals ride sibling combinators (`.Input:checked + .Backdrop`) and postcss mixins (control-backdrop) — combinators and mixins are named refusals, so the checked-state styling is not carried',
      'the Checkbox extraction carries no checked prop (it is controlled via the Choice wrapper) — base (unchecked) rendering is the comparable state',
    ],
    combos: [{ id: 'default', props: {} }],
    polaris: {
      component: 'Checkbox',
      rootSelector: '.Polaris-Checkbox',
      fixedProps: { label: 'Save this information' },
      needsOnChange: true,
    },
  },
  {
    name: 'RadioButton',
    idSuffix: 'radio-button',
    cssFile: 'RadioButton/RadioButton.module.css',
    rootClass: 'RadioButton',
    element: 'span',
    axes: [],
    parts: [
      {
        name: 'input',
        cssClass: '.Input',
        element: 'input',
        attrs: { type: 'radio', name: '{name}', value: '{value}' },
      },
      {
        name: 'backdrop',
        cssClass: '.Backdrop',
        shape: { kind: 'rect', width: 20, height: 20 },
        shapeCite:
          'Choice.module.css .Control --pc-choice-size (18px, 20px below the md breakpoint) — literal control geometry carried as shape, same citation discipline as Checkbox',
        polarisSelector: '.Polaris-RadioButton__Backdrop',
      },
    ],
    notes: [
      'label rides the Choice wrapper (ReactNode — named slot candidate); not carried',
      'checked-dot and focus ring ride ::before/::after pseudo-elements and sibling combinators — named refusals',
    ],
    combos: [{ id: 'default', props: {} }],
    polaris: {
      component: 'RadioButton',
      rootSelector: '.Polaris-RadioButton',
      fixedProps: { label: 'Accounts are disabled' },
      needsOnChange: true,
    },
  },
  {
    name: 'TextField',
    idSuffix: 'text-field',
    cssFile: 'TextField/TextField.module.css',
    rootClass: 'TextField',
    element: 'div',
    axes: [
      { prop: 'variant', classOf: { borderless: 'borderless' } },
      { prop: 'size', classOf: { slim: 'slim' } },
    ],
    parts: [
      {
        name: 'input',
        cssClass: '.Input',
        element: 'input',
        attrs: { name: '{name}', value: '{value}', placeholder: '{placeholder}' },
        polarisSelector: 'input.Polaris-TextField__Input',
      },
      {
        name: 'backdrop',
        cssClass: '.Backdrop',
        element: 'div',
        polarisSelector: '.Polaris-TextField__Backdrop',
      },
    ],
    notes: [
      'the 34-prop API surface is the gauntlet\'s headline redemption: TextField extracted silently HOLLOW (0 props) in the 2026-07-12 run (intersection-of-named-refs, failure class C); the post-gauntlet fix carries the full surface with the composition note attached',
      'label/helpText/prefix/suffix are ReactNode props — named slot candidates, not carried; Polaris renders its label above the field and this surface does not',
      'the input\'s min-height rides the GLOBAL --pg-control-height custom property (not a published token) — named refusal',
      'the backdrop\'s border is a shorthand mixing two tokens (`var(--p-border-width-0165) solid var(--p-color-input-border)`) plus a hard-coded #898f94 border-top-color (Polaris\'s own a11y patch, polaris#7838) — both named refusals, both visible in the receipts as the hairline difference',
      "align/variant/size axes: only the classes that exist in the module.css are curated ('borderless', 'slim'); align has no styling classes (it styles the inner Input via a different class family — out of promoted scope by name)",
    ],
    sampleDefaults: { autoComplete: 'off' },
    combos: [{ id: 'default', props: { value: 'Jaded Pixel' } }],
    polaris: {
      component: 'TextField',
      rootSelector: '.Polaris-TextField',
      fixedProps: { label: 'Store name', autoComplete: 'off' },
      needsOnChange: true,
    },
  },
  {
    name: 'Tag',
    idSuffix: 'tag',
    cssFile: 'Tag/Tag.module.css',
    rootClass: 'Tag',
    element: 'span',
    axes: [],
    parts: [],
    sampleText: 'Wholesale',
    notes: [
      'disabled styling is a boolean-driven CLASS on a span (`&.disabled`), not a :disabled pseudo-state — boolean-conditional token bindings have no contract channel (stylesWhen is literal-only by design); named gap',
      'the size prop and onClick/onRemove/url interplay are named extraction notes (union-typed props); the default (non-interactive span) rendering is the comparable state',
      'padding-inline is `calc(var(--p-space-100) + var(--p-space-050))` — calc() over two tokens is not a single binding; named refusal',
      'label typography rides the Text primitive (bodySm, truncate) — not carried',
    ],
    combos: [{ id: 'default', props: {} }],
    polaris: { component: 'Tag', rootSelector: 'span.Polaris-Tag', childrenText: 'Wholesale' },
  },
  {
    name: 'Avatar',
    idSuffix: 'avatar',
    cssFile: 'Avatar/Avatar.module.css',
    rootClass: 'Avatar',
    element: 'span',
    axes: [
      {
        prop: 'size',
        classOf: sizes({ xs: 'sizeXs', sm: 'sizeSm', md: 'sizeMd', lg: 'sizeLg', xl: 'sizeXl' }),
      },
    ],
    parts: [
      {
        name: 'initials',
        cssClass: '.Text',
        element: 'span',
        content: { prop: 'initials' },
        polarisSelector: '.Polaris-Avatar text',
      },
    ],
    notes: [
      'per-size widths are component-private literals (--pc-avatar-*-size: 20…40px) — named refusals; the size axis carries no bindings and the receipts show the geometry gap',
      'Polaris renders initials as SVG <text> inside the avatar circle; this surface renders a styled span — the initials part\'s font bindings (.Text rule) carry, the SVG projection does not',
      'the name-hash background variations (styleOne…styleSeven) are driven by a hash of the name prop — value-derived styling has no contract channel; named gap (base avatar-bg-fill carries)',
    ],
    combos: [
      { id: 'default', props: { initials: 'TP' } },
    ],
    triage: [
      {
        part: 'root',
        channel: 'background',
        cause:
          'Polaris hashes the name/initials into one of seven palette classes (styleOne…styleSeven) that override the base avatar tokens — value-derived styling has no contract channel (named in PROMOTION.md), so the carried BASE binding renders the base palette while Polaris renders the hashed one',
      },
      {
        part: 'root',
        channel: 'color',
        cause:
          'same name-hash palette override as background — the base color token is carried, the hashed one is not derivable from a prop',
      },
    ],
    polaris: { component: 'Avatar', rootSelector: 'span.Polaris-Avatar', fixedProps: { initials: 'TP' } },
  },
  {
    name: 'Spinner',
    idSuffix: 'spinner',
    cssFile: 'Spinner/Spinner.module.css',
    rootClass: 'Spinner',
    element: 'span',
    axes: [
      { prop: 'size', classOf: { small: 'sizeSmall', large: 'sizeLarge' } },
    ],
    parts: [
      {
        name: 'glyphLarge',
        nestedSelector: 'svg',
        icon: { asset: 'polaris-spinner-large', size: 44 },
        visibleWhen: { prop: 'size', equals: 'large' },
        polarisSelector: '.Polaris-Spinner svg',
      },
      {
        name: 'glyphSmall',
        nestedSelector: 'svg',
        icon: { asset: 'polaris-spinner-small', size: 20 },
        visibleWhen: { prop: 'size', equals: 'small' },
        polarisSelector: '.Polaris-Spinner svg',
      },
    ],
    notes: [
      'the spinner glyph is an inline SVG in Spinner.tsx (one per size) — both are carried verbatim as showcase icon assets (MIT, attributed); the 20/44px glyph sizes are the SVG viewBox literals from the same file, carried through the icon channel\'s size field',
      'the spin animation is a motion-token keyframe reference (var(--p-motion-keyframes-spin)) — the contract carries the schema\'s `animation: spin` channel instead; the duration/easing tokens are named refusals (animation shorthand)',
    ],
    combos: [
      { id: 'default', props: {} },
      { id: 'size-small', props: { size: 'small' } },
    ],
    polaris: { component: 'Spinner', rootSelector: '.Polaris-Spinner', fixedProps: { accessibilityLabel: 'Loading' } },
  },
  {
    name: 'ProgressBar',
    idSuffix: 'progress-bar',
    cssFile: 'ProgressBar/ProgressBar.module.css',
    rootClass: 'ProgressBar',
    element: 'div',
    axes: [
      {
        prop: 'tone',
        classOf: { highlight: 'toneHighlight', primary: 'tonePrimary', success: 'toneSuccess', critical: 'toneCritical' },
      },
      { prop: 'size', classOf: { small: 'sizeSmall', medium: 'sizeMedium', large: 'sizeLarge' } },
    ],
    parts: [
      {
        name: 'indicator',
        cssClass: '.Indicator',
        element: 'div',
        polarisSelector: '.Polaris-ProgressBar__Indicator',
      },
    ],
    notes: [
      'the bar heights are component-private literals with calc() scaling (--pc-progress-bar-height-base: 16px; small/large are calc() over it) — named refusals; the receipts show the missing height honestly',
      'the fill fraction is runtime behavior (CSSTransition + scaleX(progress/100)) — the schema\'s meter channel needs a max prop and Polaris\'s API has none (max is hard-coded 100), so the indicator is carried as a plain part and the verify combos pass animated={false} on the Polaris side (fill at 0 both sides)',
    ],
    combos: [
      { id: 'default', props: {} },
      { id: 'tone-primary', props: { tone: 'primary' } },
      { id: 'tone-success', props: { tone: 'success' } },
      { id: 'tone-critical', props: { tone: 'critical' } },
    ],
    polaris: {
      component: 'ProgressBar',
      rootSelector: '.Polaris-ProgressBar',
      fixedProps: { progress: 75, animated: false },
    },
  },
  {
    name: 'Text',
    idSuffix: 'text',
    cssFile: 'Text/Text.module.css',
    rootClass: 'root',
    element: 'p',
    axes: [
      {
        prop: 'variant',
        classOf: {
          headingXs: 'headingXs', headingSm: 'headingSm', headingMd: 'headingMd', headingLg: 'headingLg',
          headingXl: 'headingXl', heading2xl: 'heading2xl', heading3xl: 'heading3xl',
          bodyXs: 'bodyXs', bodySm: 'bodySm', bodyMd: 'bodyMd', bodyLg: 'bodyLg',
        },
      },
      { prop: 'fontWeight', classOf: { regular: 'regular', medium: 'medium', semibold: 'semibold', bold: 'bold' } },
      { prop: 'alignment', classOf: { start: 'start', center: 'center', end: 'end', justify: 'justify' } },
      {
        prop: 'tone',
        classOf: {
          success: 'success', critical: 'critical', caution: 'caution', subdued: 'subdued',
          disabled: 'disabled', magic: 'magic', 'magic-subdued': 'magic-subdued',
          'text-inverse': 'text-inverse', 'text-inverse-secondary': 'text-inverse-secondary',
        },
      },
    ],
    parts: [],
    sampleText: 'Online store dashboard',
    notes: [
      "the `as` axis maps values to HTML elements — three of Polaris's values (dt, dd, legend) are outside the contract element vocabulary, so elementByProp is NOT promoted (its coverage rule refuses partial maps); the root element is fixed to `p` and the gap is named",
      "tone values 'base' and 'inherit' have no styling class in the module.css — absent from the promoted map by construction",
      'the responsive variant classes step font-size at breakpoints via custom-media @media rules — named refusals; the carried bindings are the base (sub-md) values and verification renders sub-md',
    ],
    combos: [
      { id: 'body-md', props: { variant: 'bodyMd' } },
      { id: 'heading-lg', props: { variant: 'headingLg' } },
      { id: 'body-sm-bold', props: { variant: 'bodySm', fontWeight: 'bold' } },
      { id: 'tone-critical', props: { variant: 'bodyMd', tone: 'critical' } },
    ],
    triage: [
      {
        part: 'root',
        channel: 'font-weight',
        cause:
          "the fontWeight axis mechanically resolves per-value bindings (.bold → {p.font-weight-bold}) but the schema carries ONE tokensByProp per part and the variant axis won by curation order — the named schema limit in PROMOTION.md; the combo shows Polaris's bold (700) against the variant's weight (450)",
      },
    ],
    polaris: {
      component: 'Text',
      rootSelector: '.Polaris-Text--root',
      fixedProps: { as: 'p' },
      childrenText: 'Online store dashboard',
    },
  },
  {
    name: 'Thumbnail',
    idSuffix: 'thumbnail',
    sampleDefaults: { alt: 'Black choker necklace' },
    cssFile: 'Thumbnail/Thumbnail.module.css',
    rootClass: 'Thumbnail',
    element: 'span',
    axes: [
      {
        prop: 'size',
        classOf: sizes({ extraSmall: 'sizeExtraSmall', small: 'sizeSmall', medium: 'sizeMedium', large: 'sizeLarge' }),
      },
    ],
    parts: [],
    notes: [
      'per-size widths are component-private literals (--pc-thumbnail-*-size: 24…80px) — named refusals; the size axis still carries the extraSmall border-radius override (border-radius-150), the showcase\'s cleanest tokensByProp exhibit',
      'the inset bevel rides an ::after pseudo-element (shadow-border-inset) — named refusal',
      'the image itself is the source prop (URL) — media content, not a styling channel',
    ],
    combos: [
      { id: 'default', props: {} },
      { id: 'size-extra-small', props: { size: 'extraSmall' } },
    ],
    polaris: {
      component: 'Thumbnail',
      rootSelector: 'span.Polaris-Thumbnail',
      fixedProps: {
        alt: 'Black choker necklace',
        source:
          'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23d8d8d8%22/%3E%3C/svg%3E',
      },
    },
  },
];
