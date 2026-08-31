import type { RecipeEnvelope } from "../envelope.js";
import {
  BUTTON_ICON_PRESENCE,
  BUTTON_SIZES,
  BUTTON_STATES,
  BUTTON_VARIANTS,
  buttonParameterValue,
  buttonParameterVariable,
  collapseButtonRecipe,
  type ButtonColorParameter,
  type ButtonNumberParameter,
  type ButtonRecipeInstance,
} from "../recipes/button.js";
import type { RecipeSelection } from "../recipe.js";

export interface EmittedButtonFile {
  path: string;
  contents: string;
}

export interface ButtonOutputBundle {
  react: EmittedButtonFile[];
  webComponent: EmittedButtonFile[];
}

const cssVarName = (variable: string): string =>
  `--${variable
    .replaceAll(".", "-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase()}`;

type TokenLeaf = { variable: string; fallback: string | number };

const collectTokenLeaves = (
  value: unknown,
  leaves = new Map<string, string | number>(),
): Map<string, string | number> => {
  if (Array.isArray(value)) {
    for (const child of value) collectTokenLeaves(child, leaves);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      const prior = leaves.get(record.variable);
      if (prior !== undefined && prior !== record.fallback) {
        throw new TypeError(
          `button output: token ${record.variable} has conflicting fallbacks`,
        );
      }
      leaves.set(record.variable, record.fallback);
    }
    for (const child of Object.values(record)) {
      collectTokenLeaves(child, leaves);
    }
  }
  return leaves;
};

const parameterValue = (
  parameter: ButtonNumberParameter | ButtonColorParameter,
  unit = "",
): string => {
  const variable = buttonParameterVariable(parameter);
  if (variable) return `var(${cssVarName(variable)})`;
  const value = buttonParameterValue(parameter);
  return typeof value === "number" ? `${value}${unit}` : value;
};

const fontWeightForStyle = (style: string): number => {
  const normalized = style.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  const weights: Record<string, number> = {
    thin: 100,
    extralight: 200,
    light: 300,
    regular: 400,
    normal: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  };
  const weight = weights[normalized];
  if (weight === undefined) {
    throw new TypeError(
      `button output: unsupported generic font style ${style}`,
    );
  }
  return weight;
};

const shadowValue = (
  effect: ButtonRecipeInstance["tokens"]["appearance"]["primary"]["focusVisible"]["effects"][number],
): string =>
  `${effect.kind === "inner-shadow" ? "inset " : ""}${effect.offsetX}px ${effect.offsetY}px ${effect.blur}px ${effect.spread}px ${parameterValue(effect.color)}`;

const css = (instance: ButtonRecipeInstance): string => {
  const lines = [
    "/* Experimental button@1 recipe output. Generated; do not edit. */",
    ":root, :host {",
  ];
  const leaves = collectTokenLeaves(instance.tokens);
  for (const [variable, fallback] of [...leaves].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    lines.push(
      `  ${cssVarName(variable)}: ${typeof fallback === "number" ? `${fallback}px` : fallback};`,
    );
  }
  lines.push(
    "}",
    "",
    ".recipe-button {",
    "  box-sizing: border-box;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    `  border-style: solid;`,
    `  border-width: ${parameterValue(instance.tokens.borderWidth, "px")};`,
    `  border-radius: ${parameterValue(instance.tokens.radius, "px")};`,
    `  font-family: ${instance.tokens.typography.fontFamily};`,
    `  font-style: normal;`,
    "  outline: none;",
    "  cursor: pointer;",
    "}",
    "",
  );

  for (const sizeName of BUTTON_SIZES) {
    const size = instance.tokens.sizes[sizeName];
    lines.push(
      `.recipe-button[data-size="${sizeName}"] {`,
      ...(size.minWidth === null
        ? []
        : [`  min-width: ${parameterValue(size.minWidth, "px")};`]),
      `  padding: ${parameterValue(size.paddingY, "px")} ${parameterValue(size.paddingX, "px")};`,
      `  gap: ${parameterValue(size.gap, "px")};`,
      `  font-size: ${parameterValue(size.fontSize, "px")};`,
      `  line-height: ${parameterValue(size.lineHeight, "px")};`,
      `  font-weight: ${fontWeightForStyle(size.fontStyle)};`,
      "}",
      `.recipe-button[data-size="${sizeName}"] .recipe-button__icon,`,
      `.recipe-button[data-size="${sizeName}"] .recipe-button__loading {`,
      `  width: ${parameterValue(size.iconSize, "px")};`,
      `  height: ${parameterValue(size.iconSize, "px")};`,
      "}",
      "",
    );
  }

  const appearance = (
    selector: string,
    value: ButtonRecipeInstance["tokens"]["appearance"]["primary"]["default"],
  ) => {
    lines.push(
      `${selector} {`,
      `  background: ${parameterValue(value.background)};`,
      `  color: ${parameterValue(value.foreground)};`,
      `  border-color: ${parameterValue(value.border)};`,
      `  box-shadow: ${value.effects.length === 0 ? "none" : value.effects.map(shadowValue).join(", ")};`,
      "}",
    );
  };
  for (const variant of BUTTON_VARIANTS) {
    const values = instance.tokens.appearance[variant];
    appearance(
      `.recipe-button[data-variant="${variant}"][data-state="default"], .recipe-button[data-variant="${variant}"][data-state="loading"]`,
      values.default,
    );
    appearance(
      `.recipe-button[data-variant="${variant}"][data-state="hover"], .recipe-button[data-variant="${variant}"]:hover:not(:disabled):not([aria-disabled="true"])`,
      values.hover,
    );
    appearance(
      `.recipe-button[data-variant="${variant}"][data-state="pressed"], .recipe-button[data-variant="${variant}"]:active:not(:disabled):not([aria-disabled="true"])`,
      values.pressed,
    );
    appearance(
      `.recipe-button[data-variant="${variant}"][data-state="focus-visible"], .recipe-button[data-variant="${variant}"]:focus-visible`,
      values.focusVisible,
    );
    appearance(
      `.recipe-button[data-variant="${variant}"][data-state="disabled"], .recipe-button[data-variant="${variant}"]:disabled`,
      values.disabled,
    );
  }
  lines.push(
    '.recipe-button[aria-disabled="true"] { cursor: not-allowed; }',
    ".recipe-button__icon, .recipe-button__loading { flex: none; }",
    ".recipe-button__loading { border: 2px solid currentColor; border-right-color: transparent; border-radius: 999px; }",
    ".recipe-button__label { white-space: nowrap; }",
    "",
  );
  return `${lines.join("\n")}\n`;
};

const reactComponent = (instance: ButtonRecipeInstance): string => `import {
  forwardRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export type ButtonVariant = ${BUTTON_VARIANTS.map((value) => JSON.stringify(value)).join(" | ")};
export type ButtonSize = ${BUTTON_SIZES.map((value) => JSON.stringify(value)).join(" | ")};
export type ButtonState = ${BUTTON_STATES.map((value) => JSON.stringify(value)).join(" | ")};
export type ButtonIcons = ${BUTTON_ICON_PRESENCE.map((value) => JSON.stringify(value)).join(" | ")};

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  state?: ButtonState;
  label?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onPress?: () => void;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = ${JSON.stringify(instance.axes.variant.default)},
    size = ${JSON.stringify(instance.axes.size.default)},
    state = "default",
    label = ${JSON.stringify(instance.label.default)},
    leadingIcon,
    trailingIcon,
    loading = false,
    disabled = false,
    onClick,
    onPress,
    type = "button",
    ...rest
  },
  ref,
) {
  const effectiveDisabled = disabled || state === "disabled";
  const effectiveLoading = loading || state === "loading";
  const effectiveState: ButtonState = effectiveDisabled
    ? "disabled"
    : effectiveLoading
      ? "loading"
      : state;
  const icons: ButtonIcons =
    leadingIcon && trailingIcon
      ? "both"
      : leadingIcon
        ? "leading"
        : trailingIcon
          ? "trailing"
          : "none";
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (effectiveDisabled || effectiveLoading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    onPress?.();
  };

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className="recipe-button"
      data-variant={variant}
      data-size={size}
      data-state={effectiveState}
      data-icons={icons}
      disabled={effectiveDisabled}
      aria-disabled={effectiveDisabled || effectiveLoading || undefined}
      aria-busy={effectiveLoading || undefined}
      onClick={handleClick}
    >
      {effectiveLoading ? (
        <span className="recipe-button__loading" aria-hidden="true" />
      ) : leadingIcon ? (
        <span className="recipe-button__icon recipe-button__icon--leading" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className="recipe-button__label">{label}</span>
      {trailingIcon ? (
        <span className="recipe-button__icon recipe-button__icon--trailing" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});
`;

const reactFixture = (): string => `import { Button } from "./Button.js";

export const ButtonFixture = () => (
  <>
    <Button label="Default" />
    <Button variant="secondary" size="small" label="With icons" leadingIcon="←" trailingIcon="→" />
    <Button state="focus-visible" label="Focus" />
    <Button loading label="Loading" />
    <Button disabled label="Disabled" />
  </>
);
`;

const webComponent = (
  instance: ButtonRecipeInstance,
  stylesheet: string,
): string => `const STYLES = ${JSON.stringify(stylesheet)};

export class RecipeButtonElement extends HTMLElement {
  static observedAttributes = ["variant", "size", "state", "label", "loading", "disabled"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const variant = this.getAttribute("variant") || ${JSON.stringify(instance.axes.variant.default)};
    const size = this.getAttribute("size") || ${JSON.stringify(instance.axes.size.default)};
    const authoredState = this.getAttribute("state") || "default";
    const disabled = this.hasAttribute("disabled") || authoredState === "disabled";
    const loading = this.hasAttribute("loading") || authoredState === "loading";
    const state = disabled ? "disabled" : loading ? "loading" : authoredState;
    const label = this.getAttribute("label") || ${JSON.stringify(instance.label.default)};
    const leading = !loading && this.querySelector('[slot="leading-icon"]');
    const trailing = this.querySelector('[slot="trailing-icon"]');
    const icons = leading && trailing ? "both" : leading ? "leading" : trailing ? "trailing" : "none";
    this.shadowRoot.innerHTML =
      "<style>" + STYLES + "</style>" +
      '<button part="button" class="recipe-button" type="button"' +
      ' data-variant="' + variant + '" data-size="' + size + '" data-state="' + state +
      '" data-icons="' + icons + '"' + (disabled ? " disabled" : "") +
      (disabled || loading ? ' aria-disabled="true"' : "") +
      (loading ? ' aria-busy="true"' : "") + ">" +
      (loading
        ? '<span part="loading" class="recipe-button__loading" aria-hidden="true"></span>'
        : leading
          ? '<span part="leading-icon" class="recipe-button__icon recipe-button__icon--leading" aria-hidden="true"><slot name="leading-icon"></slot></span>'
          : "") +
      '<span part="label" class="recipe-button__label"></span>' +
      (trailing
        ? '<span part="trailing-icon" class="recipe-button__icon recipe-button__icon--trailing" aria-hidden="true"><slot name="trailing-icon"></slot></span>'
        : "") +
      "</button>";
    this.shadowRoot.querySelector(".recipe-button__label").textContent = label;
    this.shadowRoot.querySelector("button").addEventListener("click", (event) => {
      if (disabled || loading) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      this.dispatchEvent(new CustomEvent("press", { bubbles: true, composed: true }));
    });
  }
}

export function define(tagName = "recipe-button") {
  if (!customElements.get(tagName)) customElements.define(tagName, RecipeButtonElement);
}

define();
`;

const webComponentFixture = (): string => `<!doctype html>
<script type="module" src="./recipe-button.js"></script>
<recipe-button label="Default"></recipe-button>
<recipe-button variant="secondary" size="small" label="With icons">
  <span slot="leading-icon">←</span><span slot="trailing-icon">→</span>
</recipe-button>
<recipe-button state="focus-visible" label="Focus"></recipe-button>
<recipe-button loading label="Loading"></recipe-button>
<recipe-button disabled label="Disabled"></recipe-button>
`;

export function emitButtonOutputs(
  envelope: RecipeEnvelope,
  selection: RecipeSelection,
): ButtonOutputBundle {
  const instance = collapseButtonRecipe(envelope, selection);
  const stylesheet = css(instance);
  return {
    react: [
      { path: "react/Button.tsx", contents: reactComponent(instance) },
      { path: "react/button.css", contents: stylesheet },
      { path: "react/Button.fixture.tsx", contents: reactFixture() },
    ],
    webComponent: [
      {
        path: "web-component/recipe-button.js",
        contents: webComponent(instance, stylesheet),
      },
      { path: "web-component/recipe-button.css", contents: stylesheet },
      {
        path: "web-component/recipe-button.fixture.html",
        contents: webComponentFixture(),
      },
    ],
  };
}
