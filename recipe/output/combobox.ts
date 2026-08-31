import type { RecipeEnvelope } from "../envelope.js";
import {
  COMBOBOX_APPEARANCES,
  COMBOBOX_SIZES,
  collapseComboboxRecipe,
  type ComboboxColorParameter,
  type ComboboxNumberParameter,
  type ComboboxRecipeInstance,
} from "../recipes/combobox.js";
import type { RecipeSelection } from "../recipe.js";
import {
  assertSafeOutputFiles,
  buildCssTokenNameMap,
  cssTokenName,
  parseFontFamilyStack,
  quoteFontFamilyStack,
} from "../output-safety.js";

export interface EmittedComboboxFile {
  path: string;
  contents: string;
}
export interface ComboboxOutputBundle {
  react: EmittedComboboxFile[];
  webComponent: EmittedComboboxFile[];
}

const collectLeaves = (
  value: unknown,
  leaves = new Map<string, string | number>(),
): Map<string, string | number> => {
  if (Array.isArray(value)) {
    for (const child of value) collectLeaves(child, leaves);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      const prior = leaves.get(record.variable);
      if (prior !== undefined && prior !== record.fallback)
        throw new TypeError(
          `combobox output: token ${record.variable} has conflicting fallbacks`,
        );
      leaves.set(record.variable, record.fallback);
      return leaves;
    }
    for (const child of Object.values(record)) collectLeaves(child, leaves);
  }
  return leaves;
};
const token = (
  parameter: ComboboxNumberParameter | ComboboxColorParameter,
): string => `var(${cssTokenName(parameter.variable)})`;
const fontFamily = (
  font: ComboboxRecipeInstance["tokens"]["typography"]["input"],
) => {
  for (const candidate of font.fallbackChain)
    parseFontFamilyStack(candidate.family);
  return quoteFontFamilyStack(
    font.fallbackChain.map((candidate) => candidate.family),
  );
};

const stylesheet = (instance: ComboboxRecipeInstance): string => {
  const leaves = collectLeaves(instance.tokens);
  buildCssTokenNameMap([...leaves.keys()]);
  const lines = [
    "/* Experimental combobox@1 output. Generated; do not edit. */",
    ":root, :host {",
    ...[...leaves]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([identity, fallback]) =>
          `  ${cssTokenName(identity)}: ${typeof fallback === "number" ? `${fallback}px` : fallback};`,
      ),
    "}",
    ".recipe-combobox { display:inline-flex; flex-direction:column; position:relative; box-sizing:border-box; font-family:" +
      fontFamily(instance.tokens.typography.input) +
      "; }",
    ".recipe-combobox__label { display:block; }",
    ".recipe-combobox__trigger { display:flex; align-items:center; box-sizing:border-box; border:1px solid; position:relative; }",
    ".recipe-combobox__input { flex:1 1 auto; width:100%; min-width:0; border:0; outline:0; padding:0; margin:0; background:transparent; font:inherit; }",
    ".recipe-combobox__control { flex:none; border:0; padding:0; background:transparent; color:inherit; display:inline-grid; place-items:center; }",
    ".recipe-combobox__popup { position:absolute; z-index:2; left:0; box-sizing:border-box; border:1px solid; overflow:hidden; }",
    ".recipe-combobox__listbox { display:flex; flex-direction:column; margin:0; list-style:none; box-sizing:border-box; }",
    ".recipe-combobox__option { display:flex; align-items:center; box-sizing:border-box; cursor:default; }",
    '.recipe-combobox__option[aria-disabled="true"] { cursor:not-allowed; }',
  ];
  for (const sizeName of COMBOBOX_SIZES) {
    const size = instance.tokens.sizes[sizeName];
    lines.push(
      `.recipe-combobox[data-size="${sizeName}"] { width:${token(size.width)}; gap:${token(size.stackGap)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__trigger { height:${token(size.triggerHeight)}; padding-inline:${token(size.paddingX)}; gap:${token(size.gap)}; border-radius:${token(instance.tokens.radius)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__input { font-size:${token(size.inputFontSize)}; line-height:${token(size.inputLineHeight)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__label { font-size:${token(size.labelFontSize)}; line-height:${token(size.labelLineHeight)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__helper { font-size:${token(size.helperFontSize)}; line-height:${token(size.helperLineHeight)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__control { width:${token(size.controlSize)}; height:${token(size.controlSize)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__popup { top:calc(${token(size.labelLineHeight)} + ${token(size.stackGap)} + ${token(size.triggerHeight)} + ${token(size.overlayGap)}); width:${token(size.width)}; border-radius:${token(instance.tokens.overlayRadius)}; padding-block:${token(size.listPadding)}; }`,
      `.recipe-combobox[data-size="${sizeName}"] .recipe-combobox__option { height:${token(size.optionHeight)}; padding-inline:${token(size.optionPaddingX)}; font-size:${token(size.inputFontSize)}; line-height:${token(size.inputLineHeight)}; }`,
    );
  }
  for (const appearance of COMBOBOX_APPEARANCES)
    lines.push(
      `.recipe-combobox[data-appearance="${appearance}"] .recipe-combobox__trigger { background:${token(instance.tokens.appearances[appearance].background)}; }`,
    );
  for (const [name, values] of Object.entries(instance.tokens.fieldStates))
    lines.push(
      `.recipe-combobox[data-state="${name}"] .recipe-combobox__trigger { border-color:${token(values.border)}; color:${token(values.text)}; }`,
      `.recipe-combobox[data-state="${name}"] .recipe-combobox__input { color:${token(values.text)}; }`,
      `.recipe-combobox[data-state="${name}"] .recipe-combobox__input::placeholder { color:${token(values.placeholder)}; opacity:1; }`,
      `.recipe-combobox[data-state="${name}"] .recipe-combobox__label { color:${token(values.label)}; }`,
      `.recipe-combobox[data-state="${name}"] .recipe-combobox__helper { color:${token(values.helper)}; }`,
      `.recipe-combobox[data-state="${name}"] .recipe-combobox__control { color:${token(values.control)}; }`,
    );
  for (const [name, values] of Object.entries(instance.tokens.optionStates))
    lines.push(
      `.recipe-combobox__option[data-option-state="${name}"] { background:${token(values.background)}; color:${token(values.text)}; }`,
    );
  lines.push(
    `.recipe-combobox__popup { background:${token(instance.tokens.overlay.background)}; border-color:${token(instance.tokens.overlay.border)}; box-shadow:0 4px 12px ${token(instance.tokens.overlay.shadow)}; }`,
    ".recipe-combobox[data-state=disabled] { cursor:not-allowed; }",
    ".recipe-combobox[aria-busy=true] .recipe-combobox__popup { cursor:progress; }",
    "",
  );
  return `${lines.join("\n")}\n`;
};

const reactSource = (instance: ComboboxRecipeInstance): string => `import {
  forwardRef, useCallback, useId, useMemo, useRef, useState,
  type ChangeEvent, type FocusEvent, type KeyboardEvent, type ReactNode,
} from "react";

export interface ComboboxOption { value: string; label: string; disabled?: boolean; }
export interface ComboboxProps {
  id?: string; label?: string; placeholder?: string; helperText?: string; errorText?: string;
  size?: "small" | "medium"; appearance?: "outlined" | "filled"; disabled?: boolean; loading?: boolean;
  options?: ComboboxOption[]; value?: string | null; defaultValue?: string | null;
  inputValue?: string; defaultInputValue?: string; open?: boolean; defaultOpen?: boolean;
  leadingControl?: ReactNode; clearIndicator?: ReactNode; popupIndicator?: ReactNode;
  onOpenChange?: (open: boolean) => void; onInputChange?: (value: string) => void;
  onChange?: (value: string | null) => void; onHighlightChange?: (value: string | null) => void;
}
const DEFAULT_OPTIONS = ${JSON.stringify(instance.content.options)};
const nextEnabled = (options: ComboboxOption[], start: number, direction: 1 | -1) => {
  if (!options.length) return -1;
  for (let step = 1; step <= options.length; step++) {
    const index = (start + direction * step + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
};
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox({
  id: idProp, label = ${JSON.stringify(instance.content.label.default)},
  placeholder = ${JSON.stringify(instance.content.placeholder.default)},
  helperText = ${JSON.stringify(instance.content.helper.default)}, errorText,
  size = "medium", appearance = "outlined", disabled = false, loading = false,
  options = DEFAULT_OPTIONS, value, defaultValue = ${JSON.stringify(instance.content.selectedValue)},
  inputValue, defaultInputValue = "", open, defaultOpen = false,
  leadingControl = "⌕", clearIndicator = "×", popupIndicator = "▾",
  onOpenChange, onInputChange, onChange, onHighlightChange,
}, forwardedRef) {
  const generatedId = useId();
  const id = idProp || \`combobox-\${generatedId.replaceAll(":", "")}\`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRefs = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const [localValue, setLocalValue] = useState<string | null>(defaultValue);
  const [localQuery, setLocalQuery] = useState(defaultInputValue);
  const [highlighted, setHighlighted] = useState(-1);
  const isOpen = open ?? localOpen;
  const selected = value === undefined ? localValue : value;
  const query = inputValue === undefined ? localQuery : inputValue;
  const filtered = useMemo(() => options.filter(option =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  ), [options, query]);
  const setOpen = useCallback((next: boolean) => {
    if (disabled) return;
    if (open === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  }, [disabled, open, onOpenChange]);
  const setQuery = useCallback((next: string) => {
    if (inputValue === undefined) setLocalQuery(next);
    onInputChange?.(next);
  }, [inputValue, onInputChange]);
  const setHighlight = useCallback((index: number) => {
    setHighlighted(index);
    onHighlightChange?.(index < 0 ? null : filtered[index]?.value ?? null);
  }, [filtered, onHighlightChange]);
  const select = useCallback((option: ComboboxOption) => {
    if (option.disabled) return;
    if (value === undefined) setLocalValue(option.value);
    onChange?.(option.value);
    setQuery(option.label);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onChange, setOpen, setQuery, value]);
  const clear = useCallback(() => {
    if (value === undefined) setLocalValue(null);
    onChange?.(null);
    setQuery("");
    setHighlight(-1);
    inputRef.current?.focus();
  }, [onChange, setHighlight, setQuery, value]);
  const onInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
    setOpen(true);
    const first = nextEnabled(options.filter(option =>
      option.label.toLocaleLowerCase().includes(event.currentTarget.value.toLocaleLowerCase())
    ), -1, 1);
    setHighlight(first);
  }, [options, setHighlight, setOpen, setQuery]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight(nextEnabled(filtered, highlighted, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && isOpen && highlighted >= 0) {
      event.preventDefault();
      const option = filtered[highlighted];
      if (option) select(option);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setOpen(false);
      setHighlight(-1);
    }
  }, [disabled, filtered, highlighted, isOpen, select, setHighlight, setOpen]);
  const labelId = \`\${id}-label\`;
  const helperId = \`\${id}-helper\`;
  const listboxId = \`\${id}-listbox\`;
  const state = disabled ? "disabled" : errorText ? "error" : loading ? "loading" : "default";
  return <div className="recipe-combobox" data-size={size} data-appearance={appearance}
    data-state={state} aria-busy={loading || undefined}>
    <label id={labelId} className="recipe-combobox__label" htmlFor={id}>{label}</label>
    <div className="recipe-combobox__trigger">
      <span className="recipe-combobox__control" aria-hidden="true">{leadingControl}</span>
      <input ref={setRefs} id={id} className="recipe-combobox__input" role="combobox"
        aria-autocomplete="list" aria-expanded={isOpen} aria-controls={listboxId}
        aria-activedescendant={isOpen && highlighted >= 0 ? \`\${id}-option-\${highlighted}\` : undefined}
        aria-labelledby={labelId} aria-describedby={helperText || errorText ? helperId : undefined}
        aria-invalid={Boolean(errorText) || undefined} disabled={disabled}
        value={query} placeholder={selected ? options.find(option => option.value === selected)?.label || placeholder : placeholder}
        onChange={onInput} onKeyDown={onKeyDown} onFocus={() => undefined} />
      {selected && !disabled ? <button type="button" aria-label="Clear" className="recipe-combobox__control" onClick={clear}>{clearIndicator}</button> : null}
      <button type="button" aria-label={isOpen ? "Close" : "Open"} tabIndex={-1}
        className="recipe-combobox__control" disabled={disabled} onMouseDown={event => event.preventDefault()}
        onClick={() => { setOpen(!isOpen); inputRef.current?.focus(); }}>{popupIndicator}</button>
    </div>
    <div id={helperId} className="recipe-combobox__helper" role={errorText ? "alert" : undefined}>{errorText || helperText}</div>
    {isOpen ? <div className="recipe-combobox__popup">
      <ul id={listboxId} role="listbox" className="recipe-combobox__listbox">
        {loading ? <li role="presentation" className="recipe-combobox__option">${instance.content.loading.default}</li>
        : filtered.length === 0 ? <li role="presentation" className="recipe-combobox__option">${instance.content.empty.default}</li>
        : filtered.map((option, index) => {
          const optionState = option.disabled ? "disabled" : index === highlighted ? "highlighted" : option.value === selected ? "selected" : "default";
          return <li id={\`\${id}-option-\${index}\`} key={option.value} role="option"
            aria-selected={option.value === selected} aria-disabled={option.disabled || undefined}
            data-option-state={optionState} className="recipe-combobox__option"
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => !option.disabled && setHighlight(index)}
            onClick={() => select(option)}>{option.label}{option.value === selected ? <span aria-hidden="true">✓</span> : null}</li>;
        })}
      </ul>
    </div> : null}
  </div>;
});
`;

const webComponentSource = (
  instance: ComboboxRecipeInstance,
  css: string,
): string => `const STYLES = ${JSON.stringify(css)};
const DEFAULT_OPTIONS = ${JSON.stringify(instance.content.options)};
let nextId = 0;
const nextEnabled = (options, start, direction) => {
  if (!options.length) return -1;
  for (let step = 1; step <= options.length; step++) {
    const index = (start + direction * step + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
};
export class RecipeComboboxElement extends HTMLElement {
  static observedAttributes = ["label","placeholder","helper-text","error-text","size","appearance","disabled","loading","open","value","options"];
  constructor() {
    super();
    this.controlId = this.id || \`recipe-combobox-\${++nextId}\`;
    this.query = "";
    this.highlighted = -1;
    const root = this.attachShadow({mode:"open"});
    this.styleNode = document.createElement("style"); this.styleNode.textContent = STYLES;
    this.rootNode = document.createElement("div"); this.rootNode.className = "recipe-combobox";
    this.labelNode = document.createElement("label"); this.labelNode.className = "recipe-combobox__label";
    this.triggerNode = document.createElement("div"); this.triggerNode.className = "recipe-combobox__trigger";
    this.leadingNode = document.createElement("span"); this.leadingNode.className = "recipe-combobox__control"; this.leadingNode.textContent = "⌕"; this.leadingNode.setAttribute("aria-hidden","true");
    this.inputNode = document.createElement("input"); this.inputNode.className = "recipe-combobox__input"; this.inputNode.setAttribute("role","combobox"); this.inputNode.setAttribute("aria-autocomplete","list");
    this.clearNode = document.createElement("button"); this.clearNode.type = "button"; this.clearNode.className = "recipe-combobox__control"; this.clearNode.setAttribute("aria-label","Clear"); this.clearNode.textContent = "×";
    this.popupNode = document.createElement("button"); this.popupNode.type = "button"; this.popupNode.tabIndex = -1; this.popupNode.className = "recipe-combobox__control"; this.popupNode.textContent = "▾";
    this.helperNode = document.createElement("div"); this.helperNode.className = "recipe-combobox__helper";
    this.overlayNode = document.createElement("div"); this.overlayNode.className = "recipe-combobox__popup";
    this.listboxNode = document.createElement("ul"); this.listboxNode.className = "recipe-combobox__listbox"; this.listboxNode.setAttribute("role","listbox");
    this.overlayNode.append(this.listboxNode); this.triggerNode.append(this.leadingNode,this.inputNode,this.clearNode,this.popupNode);
    this.rootNode.append(this.labelNode,this.triggerNode,this.helperNode,this.overlayNode); root.append(this.styleNode,this.rootNode);
    this.inputNode.addEventListener("input", () => { this.query = this.inputNode.value; this.open = true; this.highlighted = nextEnabled(this.filtered(),-1,1); this.emit("query-change",{value:this.query}); this.patch(); });
    this.inputNode.addEventListener("keydown", event => this.onKeyDown(event));
    this.clearNode.addEventListener("mousedown", event => event.preventDefault());
    this.clearNode.addEventListener("click", () => { this.value = ""; this.query = ""; this.highlighted = -1; this.emit("selection-change",{value:null}); this.patch(); this.inputNode.focus(); });
    this.popupNode.addEventListener("mousedown", event => event.preventDefault());
    this.popupNode.addEventListener("click", () => { if (!this.disabled) { this.open = !this.open; this.patch(); this.inputNode.focus(); } });
  }
  connectedCallback() { if (this.id) this.controlId = this.id; this.patch(); }
  attributeChangedCallback(name, oldValue, newValue) { if (oldValue !== newValue && this.rootNode) this.patch(); }
  get options() { try { const parsed = JSON.parse(this.getAttribute("options") || "null"); return Array.isArray(parsed) ? parsed : DEFAULT_OPTIONS; } catch { return DEFAULT_OPTIONS; } }
  get disabled() { return this.hasAttribute("disabled"); }
  get open() { return this.hasAttribute("open"); } set open(value) { this.toggleAttribute("open",Boolean(value)); this.emit("open-change",{open:Boolean(value)}); }
  get value() { return this.getAttribute("value") || ""; } set value(value) { if (value) this.setAttribute("value",String(value)); else this.removeAttribute("value"); }
  filtered() { const query = this.query.toLocaleLowerCase(); return this.options.filter(option => option.label.toLocaleLowerCase().includes(query)); }
  emit(name, detail) { this.dispatchEvent(new CustomEvent(name,{detail,bubbles:true,composed:true})); }
  select(option) { if (option.disabled) return; this.value = option.value; this.query = option.label; this.open = false; this.emit("selection-change",{value:option.value}); this.patch(); requestAnimationFrame(() => this.inputNode.focus()); }
  onKeyDown(event) {
    if (this.disabled) return;
    const options = this.filtered();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); this.open = true; this.highlighted = nextEnabled(options,this.highlighted,event.key === "ArrowDown" ? 1 : -1); this.emit("highlight-change",{value:options[this.highlighted]?.value ?? null}); this.patch(); }
    else if (event.key === "Enter" && this.open && this.highlighted >= 0) { event.preventDefault(); const option = options[this.highlighted]; if (option) this.select(option); }
    else if (event.key === "Escape" && this.open) { event.preventDefault(); this.open = false; this.highlighted = -1; this.patch(); }
  }
  patch() {
    const options = this.filtered(); const error = this.getAttribute("error-text") || ""; const loading = this.hasAttribute("loading");
    const selected = this.options.find(option => option.value === this.value); const state = this.disabled ? "disabled" : error ? "error" : loading ? "loading" : "default";
    this.rootNode.dataset.size = ["small","medium"].includes(this.getAttribute("size")) ? this.getAttribute("size") : "medium";
    this.rootNode.dataset.appearance = ["outlined","filled"].includes(this.getAttribute("appearance")) ? this.getAttribute("appearance") : "outlined";
    this.rootNode.dataset.state = state; this.rootNode.setAttribute("aria-busy",loading ? "true" : "false");
    const labelId = \`\${this.controlId}-label\`, helperId = \`\${this.controlId}-helper\`, listboxId = \`\${this.controlId}-listbox\`;
    this.labelNode.id = labelId; this.labelNode.htmlFor = this.controlId; this.labelNode.textContent = this.getAttribute("label") || ${JSON.stringify(instance.content.label.default)};
    this.inputNode.id = this.controlId; if (this.inputNode.value !== this.query) this.inputNode.value = this.query;
    this.inputNode.placeholder = selected?.label || this.getAttribute("placeholder") || ${JSON.stringify(instance.content.placeholder.default)};
    this.inputNode.disabled = this.disabled; this.inputNode.setAttribute("aria-expanded",String(this.open)); this.inputNode.setAttribute("aria-controls",listboxId); this.inputNode.setAttribute("aria-labelledby",labelId);
    if (error) this.inputNode.setAttribute("aria-invalid","true"); else this.inputNode.removeAttribute("aria-invalid");
    const helper = error || this.getAttribute("helper-text") || ${JSON.stringify(instance.content.helper.default)};
    this.helperNode.id = helperId; this.helperNode.textContent = helper; this.inputNode.setAttribute("aria-describedby",helperId); if (error) this.helperNode.setAttribute("role","alert"); else this.helperNode.removeAttribute("role");
    this.clearNode.hidden = !this.value || this.disabled; this.popupNode.disabled = this.disabled; this.popupNode.setAttribute("aria-label",this.open ? "Close" : "Open");
    this.overlayNode.hidden = !this.open; this.listboxNode.id = listboxId;
    const activeId = this.open && this.highlighted >= 0 ? \`\${this.controlId}-option-\${this.highlighted}\` : ""; if (activeId) this.inputNode.setAttribute("aria-activedescendant",activeId); else this.inputNode.removeAttribute("aria-activedescendant");
    this.listboxNode.replaceChildren();
    if (loading || options.length === 0) { const row = document.createElement("li"); row.setAttribute("role","presentation"); row.className = "recipe-combobox__option"; row.textContent = loading ? ${JSON.stringify(instance.content.loading.default)} : ${JSON.stringify(instance.content.empty.default)}; this.listboxNode.append(row); }
    else options.forEach((option,index) => { const row = document.createElement("li"); row.id = \`\${this.controlId}-option-\${index}\`; row.setAttribute("role","option"); row.setAttribute("aria-selected",String(option.value === this.value)); if (option.disabled) row.setAttribute("aria-disabled","true"); row.dataset.optionState = option.disabled ? "disabled" : index === this.highlighted ? "highlighted" : option.value === this.value ? "selected" : "default"; row.className = "recipe-combobox__option"; row.textContent = option.label; if (option.value === this.value) row.append(document.createTextNode(" ✓")); row.addEventListener("mousedown",event => event.preventDefault()); row.addEventListener("mouseenter",() => { if (!option.disabled) { this.highlighted = index; this.patch(); } }); row.addEventListener("click",() => this.select(option)); this.listboxNode.append(row); });
  }
}
export function define(tagName = "recipe-combobox") { if (!customElements.get(tagName)) customElements.define(tagName,RecipeComboboxElement); }
define();
`;

export function emitComboboxOutputs(
  envelope: RecipeEnvelope,
  selection: RecipeSelection,
): ComboboxOutputBundle {
  const instance = collapseComboboxRecipe(envelope, selection);
  const css = stylesheet(instance);
  const provenance = `${JSON.stringify(
    {
      artifactVersion: "combobox-font-token-provenance-v1",
      fonts: instance.tokens.typography,
      source: instance.provenance.source,
    },
    null,
    2,
  )}\n`;
  const bundle = {
    react: [
      { path: "react/Combobox.tsx", contents: reactSource(instance) },
      { path: "react/combobox.css", contents: css },
      {
        path: "react/combobox-provenance.json",
        contents: provenance,
      },
    ],
    webComponent: [
      {
        path: "web-component/recipe-combobox.js",
        contents: webComponentSource(instance, css),
      },
      { path: "web-component/recipe-combobox.css", contents: css },
      {
        path: "web-component/combobox-provenance.json",
        contents: provenance,
      },
    ],
  };
  assertSafeOutputFiles(bundle.react, "react");
  assertSafeOutputFiles(bundle.webComponent, "web-component");
  return bundle;
}
