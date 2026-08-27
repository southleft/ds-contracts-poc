import type { RecipeEnvelope } from "../envelope.js";
import {
  INPUT_FIELD_SIZES,
  INPUT_FIELD_STATES,
  collapseInputFieldRecipe,
  type InputFieldColorParameter,
  type InputFieldNumberParameter,
  type InputFieldRecipeInstance,
} from "../recipes/input-field.js";
import type { RecipeSelection } from "../recipe.js";
import {
  assertSafeOutputFiles,
  buildCssTokenNameMap,
  cssTokenName,
  parseFontFamilyStack,
  quoteFontFamilyStack,
} from "../output-safety.js";

export interface EmittedInputFieldFile {
  path: string;
  contents: string;
}

export interface InputFieldOutputBundle {
  react: EmittedInputFieldFile[];
  webComponent: EmittedInputFieldFile[];
}

const parameterValue = (
  parameter: InputFieldNumberParameter | InputFieldColorParameter,
): string => `var(${cssTokenName(parameter.variable)})`;

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
          `input-field output: token ${record.variable} has conflicting fallbacks`,
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
      `input-field output: unsupported generic font style ${style}`,
    );
  }
  return weight;
};

const fontFamilyValue = (
  font: InputFieldRecipeInstance["tokens"]["typography"]["input"],
): string => {
  const declared = font.fallbackChain.map(({ family }) => family);
  for (const family of declared) parseFontFamilyStack(family);
  return quoteFontFamilyStack(declared);
};

const shadowValue = (
  effect: InputFieldRecipeInstance["tokens"]["states"]["default"]["effects"][number],
): string =>
  `${effect.kind === "inner-shadow" ? "inset " : ""}${effect.offsetX}px ${effect.offsetY}px ${effect.blur}px ${effect.spread}px ${parameterValue(effect.color)}`;

const css = (instance: InputFieldRecipeInstance): string => {
  const tokenLeaves = collectTokenLeaves(instance.tokens);
  buildCssTokenNameMap([...tokenLeaves.keys()]);
  const lines = [
    "/* Experimental input-field@1 recipe output. Generated; do not edit. */",
    ":root, :host {",
  ];
  for (const [variable, fallback] of [...tokenLeaves].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    lines.push(
      `  ${cssTokenName(variable)}: ${typeof fallback === "number" ? `${fallback}px` : fallback};`,
    );
  }
  lines.push(
    "}",
    "",
    ".recipe-input-field {",
    "  display: inline-flex;",
    "  flex-direction: column;",
    "  box-sizing: border-box;",
    `  position: ${instance.structure.labelPlacement === "floating" ? "relative" : "static"};`,
    `  font-family: ${fontFamilyValue(instance.tokens.typography.input)};`,
    "}",
    ".recipe-input-field__label-row {",
    "  display: flex;",
    "  align-items: baseline;",
    "}",
    ".recipe-input-field__surface {",
    "  display: flex;",
    "  align-items: center;",
    "  box-sizing: border-box;",
    `  border-style: solid;`,
    `  border-radius: ${parameterValue(instance.tokens.radius)};`,
    "}",
    ".recipe-input-field__input {",
    "  flex: 1 1 auto;",
    "  min-width: 0;",
    "  width: 100%;",
    "  box-sizing: border-box;",
    "  border: 0;",
    "  padding: 0;",
    "  margin: 0;",
    "  background: transparent;",
    "  outline: none;",
    `  font-family: ${fontFamilyValue(instance.tokens.typography.input)};`,
    `  font-style: normal;`,
    `  font-weight: ${fontWeightForStyle(instance.tokens.typography.input.resolvedStyle)};`,
    "}",
    ".recipe-input-field__adornment {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  flex: none;",
    "}",
    "",
  );

  for (const sizeName of INPUT_FIELD_SIZES) {
    const size = instance.tokens.sizes[sizeName];
    lines.push(
      `.recipe-input-field[data-size="${sizeName}"] {`,
      `  width: ${parameterValue(size.width)};`,
      `  min-width: ${parameterValue(size.minWidth)};`,
      `  gap: ${parameterValue(size.stackGap)};`,
      "}",
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__label-row {`,
      `  gap: ${parameterValue(size.labelGap)};`,
      `  font-size: ${parameterValue(size.inactiveLabelFontSize)};`,
      `  line-height: ${parameterValue(size.inactiveLabelLineHeight)};`,
      `  font-family: ${fontFamilyValue(instance.tokens.typography.label)};`,
      `  font-weight: ${fontWeightForStyle(instance.tokens.typography.label.resolvedStyle)};`,
      "}",
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__surface {`,
      `  min-height: ${parameterValue(size.surfaceHeight)};`,
      `  padding-inline: ${parameterValue(size.paddingX)};`,
      `  gap: ${parameterValue(size.surfaceGap)};`,
      "}",
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__input {`,
      `  font-size: ${parameterValue(size.inputFontSize)};`,
      `  line-height: ${parameterValue(size.inputLineHeight)};`,
      "}",
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__message {`,
      `  font-size: ${parameterValue(size.messageFontSize)};`,
      `  line-height: ${parameterValue(size.messageLineHeight)};`,
      `  font-family: ${fontFamilyValue(instance.tokens.typography.message)};`,
      `  font-weight: ${fontWeightForStyle(instance.tokens.typography.message.resolvedStyle)};`,
      "}",
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__adornment {`,
      `  height: ${parameterValue(size.adornmentSize)};`,
      "}",
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__adornment--leading { width: ${instance.structure.adornmentSizing === "intrinsic-extent" ? parameterValue(size.leadingAdornmentExtent) : parameterValue(size.adornmentSize)}; }`,
      `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__adornment--trailing { width: ${instance.structure.adornmentSizing === "intrinsic-extent" ? parameterValue(size.trailingAdornmentExtent) : parameterValue(size.adornmentSize)}; }`,
      ...(instance.structure.sizingPolicy === "adornment-additive"
        ? [
            `.recipe-input-field[data-size="${sizeName}"][data-adornments="leading"] { width: calc(${parameterValue(size.width)} + ${parameterValue(size.leadingAdornmentExtent)}); }`,
            `.recipe-input-field[data-size="${sizeName}"][data-adornments="trailing"] { width: calc(${parameterValue(size.width)} + ${parameterValue(size.trailingAdornmentExtent)}); }`,
            `.recipe-input-field[data-size="${sizeName}"][data-adornments="both"] { width: calc(${parameterValue(size.width)} + ${parameterValue(size.leadingAdornmentExtent)} + ${parameterValue(size.trailingAdornmentExtent)}); }`,
          ]
        : []),
      ...(instance.structure.helperPlacement === "content-inset"
        ? [
            `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__message { margin-inline: ${parameterValue(size.helperInsetX)}; }`,
          ]
        : []),
      ...(instance.structure.labelPlacement === "floating"
        ? [
            `:host([size="${sizeName}"]) { box-sizing: border-box; }`,
            `:host([size="${sizeName}"][state="focus-visible"]), :host([size="${sizeName}"][value]:not([value=""])), :host([size="${sizeName}"][data-adornments="leading"]), :host([size="${sizeName}"][data-adornments="both"]) { padding-top: calc(0px - ${parameterValue(size.labelFloatingOffsetY)}); }`,
            `.recipe-input-field[data-size="${sizeName}"] .recipe-input-field__label-row { position: absolute; z-index: 1; left: ${parameterValue(size.labelInsetX)}; top: ${parameterValue(size.labelInactiveOffsetY)}; }`,
            `.recipe-input-field[data-size="${sizeName}"][data-state="focus-visible"] .recipe-input-field__label-row, .recipe-input-field[data-size="${sizeName}"][data-content="value"] .recipe-input-field__label-row, .recipe-input-field[data-size="${sizeName}"][data-adornments="leading"] .recipe-input-field__label-row, .recipe-input-field[data-size="${sizeName}"][data-adornments="both"] .recipe-input-field__label-row { top: ${parameterValue(size.labelFloatingOffsetY)}; padding-inline: ${parameterValue(size.labelGap)}; font-size: ${parameterValue(size.labelFontSize)}; line-height: ${parameterValue(size.labelLineHeight)}; background: ${parameterValue(instance.tokens.states.default.background)}; }`,
            `.recipe-input-field[data-size="${sizeName}"]:not([data-state="focus-visible"])[data-content="placeholder"][data-adornments="none"] .recipe-input-field__input::placeholder, .recipe-input-field[data-size="${sizeName}"]:not([data-state="focus-visible"])[data-content="placeholder"][data-adornments="trailing"] .recipe-input-field__input::placeholder { opacity: 0; }`,
          ]
        : []),
      "",
    );
  }

  const emitState = (
    selector: string,
    appearance: InputFieldRecipeInstance["tokens"]["states"]["default"],
  ) => {
    lines.push(
      `${selector} .recipe-input-field__surface {`,
      `  background: ${parameterValue(appearance.background)};`,
      `  border-color: ${parameterValue(appearance.border)};`,
      `  border-width: ${parameterValue(appearance.borderWidth)};`,
      `  box-shadow: ${appearance.effects.length === 0 ? "none" : appearance.effects.map(shadowValue).join(", ")};`,
      "}",
      `${selector} .recipe-input-field__input { color: ${parameterValue(appearance.inputText)}; }`,
      `${selector} .recipe-input-field__input::placeholder { color: ${parameterValue(appearance.placeholderText)}; opacity: 1; }`,
      `${selector} .recipe-input-field__label-row { color: ${parameterValue(appearance.labelText)};${instance.structure.labelPlacement === "floating" ? ` background: ${parameterValue(appearance.background)};` : ""} }`,
      `${selector} .recipe-input-field__message { color: ${parameterValue(appearance.messageText)}; }`,
      `${selector} .recipe-input-field__adornment { color: ${parameterValue(appearance.adornmentText)}; }`,
      `${selector} .recipe-input-field__required { color: ${parameterValue(appearance.requiredIndicatorText)}; }`,
    );
  };
  emitState(
    '.recipe-input-field[data-state="default"]',
    instance.tokens.states.default,
  );
  emitState(
    '.recipe-input-field[data-state="focus-visible"], .recipe-input-field:focus-within:not([data-state="error"]):not([data-state="disabled"])',
    instance.tokens.states.focusVisible,
  );
  emitState(
    '.recipe-input-field[data-state="error"]',
    instance.tokens.states.error,
  );
  emitState(
    '.recipe-input-field[data-state="disabled"]',
    instance.tokens.states.disabled,
  );
  lines.push(
    '.recipe-input-field[data-state="disabled"] { cursor: not-allowed; }',
    '.recipe-input-field[data-state="disabled"] .recipe-input-field__input { cursor: not-allowed; }',
    "",
  );
  return `${lines.join("\n")}\n`;
};

const reactComponent = (instance: InputFieldRecipeInstance): string => `import {
  forwardRef,
  useCallback,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export type InputFieldSize = ${INPUT_FIELD_SIZES.map((value) => JSON.stringify(value)).join(" | ")};
export type InputFieldState = ${INPUT_FIELD_STATES.map((value) => JSON.stringify(value)).join(" | ")};

export interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "value" | "defaultValue" | "onChange" | "onInput" | "onFocus" | "onBlur" | "prefix"> {
  id: string;
  size?: InputFieldSize;
  state?: InputFieldState;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  leadingAdornment?: ReactNode;
  trailingAdornment?: ReactNode;
  rootClassName?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onInput?: (event: FormEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    id,
    size = ${JSON.stringify(instance.axes.size.default)},
    state = "default",
    label = ${JSON.stringify(instance.content.label.default)},
    required = ${instance.axes.required.default === "true"},
    disabled = false,
    value,
    defaultValue,
    placeholder = ${JSON.stringify(instance.content.placeholder.default)},
    helperText = ${JSON.stringify(instance.content.helper.default)},
    errorText,
    leadingAdornment,
    trailingAdornment,
    rootClassName,
    onChange,
    onInput,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || "");
  const [focused, setFocused] = useState(false);
  const currentValue = controlled ? value : uncontrolledValue;
  const effectiveDisabled = disabled || state === "disabled";
  const effectiveError = state === "error" || Boolean(errorText);
  const effectiveState: InputFieldState = effectiveDisabled
    ? "disabled"
    : effectiveError
      ? "error"
      : focused || state === "focus-visible"
        ? "focus-visible"
        : "default";
  const message = effectiveError
    ? (errorText || ${JSON.stringify(instance.content.error.default)})
    : helperText;
  const messageId = message ? \`\${id}-message\` : undefined;
  const adornments =
    leadingAdornment && trailingAdornment
      ? "both"
      : leadingAdornment
        ? "leading"
        : trailingAdornment
          ? "trailing"
          : "none";
  const content = currentValue !== "" ? "value" : "placeholder";
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (!controlled) setUncontrolledValue(event.currentTarget.value);
    onChange?.(event);
  }, [controlled, onChange]);
  const handleFocus = useCallback((event: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  }, [onFocus]);
  const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(event);
  }, [onBlur]);
  const labelId = \`\${id}-label\`;
  const leadingId = \`\${id}-leading-adornment\`;
  const trailingId = \`\${id}-trailing-adornment\`;
  const labelledBy = [
    labelId,
    ${instance.slots.leading.payload.accessibility.relation === "labelledby-control"} && leadingAdornment ? leadingId : undefined,
    ${instance.slots.trailing.payload.accessibility.relation === "labelledby-control"} && trailingAdornment ? trailingId : undefined,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={["recipe-input-field", rootClassName].filter(Boolean).join(" ")}
      data-size={size}
      data-state={effectiveState}
      data-content={content}
      data-required={required ? "true" : "false"}
      data-adornments={adornments}
      data-font-requested={${JSON.stringify(`${instance.tokens.typography.input.requestedFamily}/${instance.tokens.typography.input.requestedStyle}`)}}
      data-font-source={${JSON.stringify(instance.tokens.typography.input.requestSource)}}
      data-font-resolved={${JSON.stringify(`${instance.tokens.typography.input.resolvedFamily}/${instance.tokens.typography.input.resolvedStyle}`)}}
      data-font-resolution={${JSON.stringify(instance.tokens.typography.input.resolution)}}
      data-font-degradation={${JSON.stringify(instance.tokens.typography.input.degradation ?? "")} || undefined}
    >
      <div className="recipe-input-field__label-row">
        <label id={labelId} className="recipe-input-field__label" htmlFor={id}>{label}</label>
        {required ? <span className="recipe-input-field__required" aria-hidden="true">*</span> : null}
      </div>
      <div className="recipe-input-field__surface">
        {leadingAdornment ? (
          <span id={leadingId} className="recipe-input-field__adornment recipe-input-field__adornment--leading" aria-hidden={${instance.slots.leading.payload.accessibility.decorative}}>
            {leadingAdornment}
          </span>
        ) : null}
        <input
          {...inputProps}
          ref={ref}
          id={id}
          className="recipe-input-field__input"
          type="text"
          value={controlled ? currentValue : undefined}
          defaultValue={controlled ? undefined : defaultValue}
          placeholder={placeholder}
          required={required}
          disabled={effectiveDisabled}
          aria-invalid={effectiveError || undefined}
          aria-describedby={messageId}
          aria-labelledby={labelledBy}
          onChange={handleChange}
          onInput={onInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {trailingAdornment ? (
          <span id={trailingId} className="recipe-input-field__adornment recipe-input-field__adornment--trailing" aria-hidden={${instance.slots.trailing.payload.accessibility.decorative}}>
            {trailingAdornment}
          </span>
        ) : null}
      </div>
      {message ? (
        <div
          id={messageId}
          className="recipe-input-field__message"
          role={effectiveError ? "alert" : undefined}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
});
`;

const reactFixture =
  (): string => `import { InputField } from "./InputField.js";

export const InputFieldFixture = () => (
  <>
    <InputField id="account-name" label="Account name" placeholder="Enter a value" />
    <InputField id="amount" size="small" value="125.00" required leadingAdornment="$" trailingAdornment="USD" />
    <InputField id="invalid-name" state="error" errorText="Enter a valid name." />
    <InputField id="disabled-name" disabled value="Jaded Pixel" />
  </>
);
`;

const webComponent = (
  instance: InputFieldRecipeInstance,
  stylesheet: string,
): string => `const STYLES = ${JSON.stringify(stylesheet)};
let nextControlId = 0;
const SIZES = ${JSON.stringify(INPUT_FIELD_SIZES)};
const STATES = ${JSON.stringify(INPUT_FIELD_STATES)};
const LEADING_LABELS_CONTROL = ${instance.slots.leading.payload.accessibility.relation === "labelledby-control"};
const TRAILING_LABELS_CONTROL = ${instance.slots.trailing.payload.accessibility.relation === "labelledby-control"};

export class RecipeInputFieldElement extends HTMLElement {
  static observedAttributes = [
    "label", "size", "state", "value", "placeholder", "helper-text",
    "error-text", "required", "disabled",
  ];

  constructor() {
    super();
    this.controlId = this.id || \`recipe-input-field-\${++nextControlId}\`;
    this.currentValue = this.getAttribute("value") || "";
    this.focused = false;
    const shadow = this.attachShadow({ mode: "open" });
    this.styleNode = document.createElement("style");
    this.styleNode.textContent = STYLES;
    this.rootNode = document.createElement("div");
    this.rootNode.className = "recipe-input-field";
    this.labelRow = document.createElement("div");
    this.labelRow.className = "recipe-input-field__label-row";
    this.labelNode = document.createElement("label");
    this.labelNode.className = "recipe-input-field__label";
    this.requiredNode = document.createElement("span");
    this.requiredNode.className = "recipe-input-field__required";
    this.requiredNode.setAttribute("aria-hidden", "true");
    this.requiredNode.textContent = "*";
    this.surfaceNode = document.createElement("div");
    this.surfaceNode.className = "recipe-input-field__surface";
    this.leadingNode = document.createElement("span");
    this.leadingNode.className = "recipe-input-field__adornment recipe-input-field__adornment--leading";
    this.leadingSlot = document.createElement("slot");
    this.leadingSlot.name = "leading-adornment";
    this.leadingNode.append(this.leadingSlot);
    this.inputNode = document.createElement("input");
    this.inputNode.className = "recipe-input-field__input";
    this.inputNode.type = "text";
    this.trailingNode = document.createElement("span");
    this.trailingNode.className = "recipe-input-field__adornment recipe-input-field__adornment--trailing";
    this.trailingSlot = document.createElement("slot");
    this.trailingSlot.name = "trailing-adornment";
    this.trailingNode.append(this.trailingSlot);
    this.messageNode = document.createElement("div");
    this.messageNode.className = "recipe-input-field__message";
    this.labelRow.append(this.labelNode, this.requiredNode);
    this.surfaceNode.append(this.leadingNode, this.inputNode, this.trailingNode);
    this.rootNode.append(this.labelRow, this.surfaceNode, this.messageNode);
    shadow.append(this.styleNode, this.rootNode);
    this.inputNode.addEventListener("input", () => {
      this.currentValue = this.inputNode.value;
      this.patch();
      this.dispatchEvent(new CustomEvent("value-input", {
        detail: { value: this.currentValue }, bubbles: true, composed: true,
      }));
    });
    this.inputNode.addEventListener("change", () => {
      this.dispatchEvent(new CustomEvent("value-change", {
        detail: { value: this.currentValue }, bubbles: true, composed: true,
      }));
    });
    this.inputNode.addEventListener("focus", () => {
      this.focused = true;
      this.patch();
      this.dispatchEvent(new CustomEvent("control-focus", { bubbles: true, composed: true }));
    });
    this.inputNode.addEventListener("blur", () => {
      this.focused = false;
      this.patch();
      this.dispatchEvent(new CustomEvent("control-blur", { bubbles: true, composed: true }));
    });
    this.leadingSlot.addEventListener("slotchange", () => this.patch());
    this.trailingSlot.addEventListener("slotchange", () => this.patch());
  }

  connectedCallback() {
    if (this.id) this.controlId = this.id;
    this.patch();
  }
  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === "value") this.currentValue = newValue || "";
    if (this.rootNode) this.patch();
  }
  get value() { return this.currentValue; }
  set value(next) {
    this.currentValue = String(next ?? "");
    this.patch();
  }

  patch() {
    const requestedSize = this.getAttribute("size") || ${JSON.stringify(instance.axes.size.default)};
    const size = SIZES.includes(requestedSize) ? requestedSize : ${JSON.stringify(instance.axes.size.default)};
    const authoredState = this.getAttribute("state") || "default";
    const disabled = this.hasAttribute("disabled") || authoredState === "disabled";
    const errorText = this.getAttribute("error-text") || "";
    const error = authoredState === "error" || errorText.length > 0;
    const state = disabled ? "disabled" : error ? "error" : this.focused || authoredState === "focus-visible" ? "focus-visible" : STATES.includes(authoredState) ? authoredState : "default";
    const label = this.getAttribute("label") || ${JSON.stringify(instance.content.label.default)};
    const placeholder = this.getAttribute("placeholder") || ${JSON.stringify(instance.content.placeholder.default)};
    const helper = this.getAttribute("helper-text") || ${JSON.stringify(instance.content.helper.default)};
    const message = error ? (errorText || ${JSON.stringify(instance.content.error.default)}) : helper;
    const required = this.hasAttribute("required");
    const leading = this.leadingSlot.assignedNodes({ flatten: true }).length > 0;
    const trailing = this.trailingSlot.assignedNodes({ flatten: true }).length > 0;
    const adornments = leading && trailing ? "both" : leading ? "leading" : trailing ? "trailing" : "none";
    const messageId = \`\${this.controlId}-message\`;
    const labelId = \`\${this.controlId}-label\`;
    const leadingId = \`\${this.controlId}-leading-adornment\`;
    const trailingId = \`\${this.controlId}-trailing-adornment\`;
    this.dataset.adornments = adornments;
    this.rootNode.dataset.size = size;
    this.rootNode.dataset.state = state;
    this.rootNode.dataset.content = this.currentValue ? "value" : "placeholder";
    this.rootNode.dataset.required = required ? "true" : "false";
    this.rootNode.dataset.adornments = adornments;
    this.rootNode.dataset.fontRequested = ${JSON.stringify(`${instance.tokens.typography.input.requestedFamily}/${instance.tokens.typography.input.requestedStyle}`)};
    this.rootNode.dataset.fontSource = ${JSON.stringify(instance.tokens.typography.input.requestSource)};
    this.rootNode.dataset.fontResolved = ${JSON.stringify(`${instance.tokens.typography.input.resolvedFamily}/${instance.tokens.typography.input.resolvedStyle}`)};
    this.rootNode.dataset.fontResolution = ${JSON.stringify(instance.tokens.typography.input.resolution)};
    this.rootNode.dataset.fontDegradation = ${JSON.stringify(instance.tokens.typography.input.degradation ?? "")};
    this.labelNode.id = labelId;
    this.labelNode.htmlFor = this.controlId;
    this.labelNode.textContent = label;
    this.requiredNode.hidden = !required;
    this.leadingNode.hidden = !leading;
    this.leadingNode.id = leadingId;
    this.leadingNode.setAttribute("aria-hidden", ${instance.slots.leading.payload.accessibility.decorative} ? "true" : "false");
    this.trailingNode.hidden = !trailing;
    this.trailingNode.id = trailingId;
    this.trailingNode.setAttribute("aria-hidden", ${instance.slots.trailing.payload.accessibility.decorative} ? "true" : "false");
    this.inputNode.id = this.controlId;
    if (this.inputNode.value !== this.currentValue) this.inputNode.value = this.currentValue;
    this.inputNode.placeholder = placeholder;
    this.inputNode.required = required;
    this.inputNode.disabled = disabled;
    this.inputNode.setAttribute("aria-labelledby", [
      labelId,
      LEADING_LABELS_CONTROL && leading ? leadingId : "",
      TRAILING_LABELS_CONTROL && trailing ? trailingId : "",
    ].filter(Boolean).join(" "));
    if (message) this.inputNode.setAttribute("aria-describedby", messageId);
    else this.inputNode.removeAttribute("aria-describedby");
    if (error) this.inputNode.setAttribute("aria-invalid", "true");
    else this.inputNode.removeAttribute("aria-invalid");
    this.messageNode.id = messageId;
    this.messageNode.textContent = message;
    this.messageNode.hidden = !message;
    if (error) this.messageNode.setAttribute("role", "alert");
    else this.messageNode.removeAttribute("role");
  }
}

export function define(tagName = "recipe-input-field") {
  if (!customElements.get(tagName)) customElements.define(tagName, RecipeInputFieldElement);
}

define();
`;

const webComponentFixture = (): string => `<!doctype html>
<script type="module" src="./recipe-input-field.js"></script>
<recipe-input-field id="account-name" label="Account name" placeholder="Enter a value"></recipe-input-field>
<recipe-input-field id="amount" size="small" value="125.00" required>
  <span slot="leading-adornment">$</span><span slot="trailing-adornment">USD</span>
</recipe-input-field>
<recipe-input-field id="invalid-name" state="error" error-text="Enter a valid name."></recipe-input-field>
<recipe-input-field id="disabled-name" disabled value="Jaded Pixel"></recipe-input-field>
`;

export function emitInputFieldOutputs(
  envelope: RecipeEnvelope,
  selection: RecipeSelection,
): InputFieldOutputBundle {
  const instance = collapseInputFieldRecipe(envelope, selection);
  const stylesheet = css(instance);
  const fontReceipt = `${JSON.stringify(
    {
      artifactVersion: "input-field-font-provenance-v1",
      fonts: instance.tokens.typography,
      adornments: {
        leading: instance.slots.leading.payload.font,
        trailing: instance.slots.trailing.payload.font,
      },
      fallbackPolicy:
        "resolved family/style must match the declared chain; fallback requires named degradation; zero-width refuses",
    },
    null,
    2,
  )}\n`;
  const bundle = {
    react: [
      {
        path: "react/InputField.tsx",
        contents: reactComponent(instance),
      },
      { path: "react/input-field.css", contents: stylesheet },
      {
        path: "react/InputField.fixture.tsx",
        contents: reactFixture(),
      },
      { path: "react/input-field-font-provenance.json", contents: fontReceipt },
    ],
    webComponent: [
      {
        path: "web-component/recipe-input-field.js",
        contents: webComponent(instance, stylesheet),
      },
      {
        path: "web-component/recipe-input-field.css",
        contents: stylesheet,
      },
      {
        path: "web-component/recipe-input-field.fixture.html",
        contents: webComponentFixture(),
      },
      {
        path: "web-component/input-field-font-provenance.json",
        contents: fontReceipt,
      },
    ],
  };
  assertSafeOutputFiles(bundle.react, "react");
  assertSafeOutputFiles(bundle.webComponent, "web-component");
  return bundle;
}
