import { walkAnatomy, type Contract, type Part } from '../scripts/contract-schema.js';
import { selectionErrors } from '../packages/core/src/selection.js';
import { REACT_SELECTION_RUNTIME } from './react-selection-runtime.js';
import { REACT_REPEAT_RUNTIME } from './react-repeat-runtime.js';
import { reactInitialValue } from './react-initial-value.js';
import { codeValueExpression, codeValueUnion } from './code-values.js';

/** One plan consumed by both React projections. Native/static projection uses
 * the declared enum and visibleWhen facts; no part names imply behavior. */
export function reactSelectionPlan(contract: Contract, byId: Map<string, Contract>) {
  const s = contract.selection;
  if (!s) return undefined;
  const errors = selectionErrors(contract, byId);
  if (errors.length) throw Error(errors.join('\n'));
  const rows = walkAnatomy(contract);
  const item = rows.find(r => r.name === s.itemPart)!.part;
  const list = rows.find(r => r.name === s.listPart)!.part;
  const repeat = item.repeat!;
  const records = contract.props.find(p => p.name === repeat.itemsProp)!;
  const value = contract.props.find(p => p.name === s.valueProp)!;
  const dep = byId.get(item.component!.id)!;
  const selectedProp = dep.props.find(p => p.name === s.selected.prop)!;
  const code = value.bindings.code.prop, callback = s.bindings.code.prop;
  const union = codeValueUnion(value);
  const panels = new Map(s.panels.map(p => [rows.find(r => r.name === p.part)!.part, p]));
  const key = `__dscItem[${JSON.stringify(repeat.keyField)}]`;
  const body = REACT_SELECTION_RUNTIME.replace(/^import .*\n/gm, '').replace(/^export /gm, '');
  const runtime = `import * as __dscReact from 'react';
${REACT_REPEAT_RUNTIME}const __dscUseSingleSelection = (() => {
  const { useEffect, useId, useRef, useState } = __dscReact;
  type ButtonHTMLAttributes<T> = __dscReact.ButtonHTMLAttributes<T>;
  type HTMLAttributes<T> = __dscReact.HTMLAttributes<T>;
${body}
  return useSingleSelection;
})();

`;
  const initial = value.bindings.code.initial ? reactInitialValue(contract, value) : JSON.stringify(value.default);
  const prelude = [
    `  const __dscItems = __dscRepeatItems(${records.bindings.code.prop}, ${JSON.stringify(repeat.keyField)}) ?? [];`,
    `  for (const __dscItem of __dscItems) if (!${JSON.stringify(s.panels.map(p => p.value))}.includes(${key})) throw Error('selection-key-unmapped');`,
    `  if (${code}Prop !== undefined && !${JSON.stringify(s.panels.map(p => p.value))}.includes(${code}Prop)) throw Error('selection-value-unmapped');`,
    ...(s.disabledField ? [`  for (const __dscItem of __dscItems) if (!Object.prototype.hasOwnProperty.call(__dscItem, ${JSON.stringify(s.disabledField)}) || typeof __dscItem[${JSON.stringify(s.disabledField)}] !== 'boolean') throw Error('selection-disabled-invalid');`] : []),
    `  const [__dscInitialSelection] = __dscReact.useState<${union} | undefined>(${initial});`,
    `  const __dscSelection = __dscUseSingleSelection({ items: __dscItems.map(__dscItem => ({ key: ${key}${s.disabledField ? `, disabled: __dscItem[${JSON.stringify(s.disabledField)}]` : ''} })), value: ${code}Prop, defaultValue: __dscInitialSelection, onValueChange: key => ${callback}?.(key as ${union}), orientation: ${JSON.stringify(s.orientation)}, direction: ${JSON.stringify(s.direction)}, activation: ${JSON.stringify(s.activation)} });`,
    `  const ${code} = ${code}Prop ?? __dscSelection.selected as ${union} | undefined;`,
    `  const __dscPanelAttrs = (key: string, focusable: boolean) => { const { style: _style, ...attrs } = __dscSelection.panelProps(key, focusable); return attrs; };`,
  ];
  const panelCall = (part: Part, noStyle = false) => {
    const panel = panels.get(part);
    return panel ? `${noStyle ? '__dscPanelAttrs' : '__dscSelection.panelProps'}(${JSON.stringify(panel.value)}, ${panel.focusable})` : undefined;
  };
  return {
    item, list, panels, code, callback, runtime, prelude,
    propLine: `  /** Reports a requested selection; controlled consumers decide whether to accept it. */\n  ${callback}?: (value: ${union}) => void;`,
    itemAttrs: ` {...__dscSelection.itemProps(${key})} ${selectedProp.bindings.code.prop}={${codeValueExpression(selectedProp, `${key} === __dscSelection.selected ? ${JSON.stringify(s.selected.on)} : ${JSON.stringify(s.selected.off)}`)}}`,
    attrs: (part: Part, inline = false) => part === list ? ' {...__dscSelection.listProps}'
      : panels.has(part) ? ` {...${panelCall(part, inline && !part.component)}}` : '',
    style: (part: Part) => panels.has(part) ? `...${panelCall(part)}.style` : undefined,
    wrap: (part: Part, jsx: string) => panels.has(part)
      ? `{__dscSelection.has(${JSON.stringify(panels.get(part)!.value)}) ? (${jsx}) : null}` : undefined,
  };
}
