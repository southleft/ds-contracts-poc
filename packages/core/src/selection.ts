import { SelectionSchema, isSupportedOmittedCodeBinding, walkAnatomy, type Contract, type Part } from '@ds-contracts/schema';
import { isArrayType, isEnum } from './anatomy.js';
import { contractApiNames } from './prop-collision.js';
import { gridCellPlan } from './grid.js';

/** Static/canvas projection of the observed records. A controlled value with
 * no enabled matching item selects no panel, exactly as the React runtime. */
export function selectedSampleKey(contract: Contract, requested: string | undefined): string | undefined {
  const s = contract.selection;
  if (!s || requested === undefined) return undefined;
  const repeat = walkAnatomy(contract).find(row => row.name === s.itemPart)?.part.repeat;
  const item = repeat?.sample.find(record => record[repeat.keyField!] === requested);
  return item && (!s.disabledField || item[s.disabledField] !== true) ? requested : undefined;
}

/** Validate relationships, not labels. A finite panel domain must be complete
 * before any surface can project the selection declaration. */
export function selectionErrors(contract: Contract, byId: Map<string, Contract>): string[] {
  const s = contract.selection;
  if (!s) return [];
  const shape = SelectionSchema.safeParse(s);
  if (!shape.success) return [`${contract.id}: selection-schema-invalid: ${shape.error.message}`];
  const errors: string[] = [];
  const fail = (code: string, detail: string) => errors.push(`${contract.id}: ${code}: ${detail}`);
  const rows = walkAnatomy(contract);
  const find = (name: string) => {
    const matches = rows.filter(row => row.name === name);
    if (matches.length !== 1) fail('selection-part-ambiguous', name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  if (Object.keys(contract.anatomy).join() !== 'root' || contract.bindings.code.runtime || contract.semantics.elementByProp ||
      !['div','section','article','nav','header','footer'].includes(contract.semantics.element))
    fail('selection-root-unsupported', 'one generated flow-container root is required');
  const value = contract.props.find(p => p.name === s.valueProp);
  const values = value && isEnum(value) ? value.type.enum : [];
  if (!value || !isEnum(value) || value.required || value.bindings.code.values || !isSupportedOmittedCodeBinding(value.bindings.code.prop) ||
      typeof value.default !== 'string' || !values.includes(value.default) || values.some(v => !v) || new Set(values).size !== values.length)
    fail('selection-value-invalid', 'an optional enum with a declared default and canonical string code values is required');
  if ((contract.events ?? []).some(e => e.toggles?.prop === s.valueProp))
    fail('selection-controller-conflict', s.valueProp);
  const callback = s.bindings.code.prop;
  const existing = contractApiNames({...contract, selection: undefined});
  if (existing.includes(callback) || (value && existing.includes(`${value.bindings.code.prop}Prop`)))
    fail('selection-binding-collision', callback);
  const list = find(s.listPart), item = find(s.itemPart);
  const ordinary = (p: Part) => !p.component && !p.repeat && !p.icon && !p.shape && !p.meter && !p.content && p.text === undefined && !p.slot;
  if (!list || list.path.length < 2 || !ordinary(list.part) || (list.part.element ?? 'div') !== 'div' ||
      Object.keys(list.part.parts ?? {}).join() !== s.itemPart || list.part.visibleWhen ||
      (!list.part.attrs?.['aria-label'] && !list.part.attrs?.['aria-labelledby']))
    fail('selection-list-invalid', 'a named div containing the item template and an accessible label is required');
  if (list?.part.attrs?.role !== undefined && list.part.attrs.role !== 'tablist')
    fail('selection-list-role-conflict', s.listPart);
  if (!item?.part.repeat?.keyField || !item.part.component || item.part.visibleWhen ||
      item.path.slice(0, -1).join('/') !== list?.path.join('/'))
    fail('selection-item-invalid', 'a directly contained, explicitly keyed component repeat is required');
  const repeat = item?.part.repeat;
  const items = contract.props.find(p => p.name === repeat?.itemsProp);
  const fields = items && isArrayType(items) ? items.type.arrayOf : {};
  if (!repeat?.keyField || fields[repeat.keyField] !== 'text')
    fail('selection-items-invalid', 'the keyed repeat must reference a declared array with a text identity field');
  const dep = item?.part.component && byId.get(item.part.component.id);
  const reserved = ['ref','id','role','type','tabIndex','hidden','style','onClick','onKeyDown','onFocus','onBlur','onPointerDown','onPointerCancel'];
  if (!dep || dep.semantics.element !== 'button' || dep.semantics.elementByProp || Object.keys(dep.anatomy).join() !== 'root' ||
      dep.bindings.code.runtime || dep.selection || (dep.events?.length ?? 0) > 0 ||
      contractApiNames(dep).some(n => reserved.includes(n)) ||
      (dep.semantics.role !== undefined && dep.semantics.role !== 'tab') ||
      (dep.anatomy.root.attrs?.role !== undefined && dep.anatomy.root.attrs.role !== 'tab') ||
      ['id','hidden','tabIndex','aria-controls','aria-selected'].some(n => Object.hasOwn(dep.anatomy.root.attrs ?? {}, n)) ||
      (dep.anatomy.root.attrs?.type !== undefined && dep.anatomy.root.attrs.type !== 'button'))
    fail('selection-item-host-unsupported', 'the item must expose a generated native button without competing behavior or control attributes');
  const selected = dep?.props.find(p => p.name === s.selected.prop);
  const interactive = new Set(['button','a','input','select','textarea','label']);
  const visited = new Set<string>();
  const hasInteractiveDescendant = (child: Contract): boolean => {
    if (visited.has(child.id)) return false;
    visited.add(child.id);
    return walkAnatomy(child).some(row => {
      if (row.path.length > 1 && (interactive.has(row.part.element ?? '') ||
          (row.part.attrs?.tabIndex !== undefined && row.part.attrs.tabIndex !== '-1'))) return true;
      const ids = [...(row.part.component ? [row.part.component.id] : []), ...(row.part.slot?.defaultContent ?? []).map(item => item.id)];
      return ids.some(id => { const target = byId.get(id); return target && (interactive.has(target.semantics.element) || hasInteractiveDescendant(target)); });
    });
  };
  if (dep && hasInteractiveDescendant(dep)) fail('selection-item-nested-interactive-unsupported', dep.id);
  if (!selected || !isEnum(selected) || !selected.type.enum.includes(s.selected.on) || !selected.type.enum.includes(s.selected.off) || s.selected.on === s.selected.off)
    fail('selection-item-state-invalid', 'selected on/off must name distinct values of a child enum');
  if (Object.hasOwn(fields, s.selected.prop) || Object.hasOwn(item?.part.component?.props ?? {}, s.selected.prop))
    fail('selection-item-state-conflict', 'selection owns the child state; it cannot also be a record field or fixed input');
  const disabled = dep?.props.find(p => p.bindings.code.prop === 'disabled');
  if (s.disabledField !== undefined && (fields[s.disabledField] !== 'boolean' || disabled?.name !== s.disabledField || disabled.type !== 'boolean' ||
      (disabled.name !== 'disabled' && dep?.anatomy.root.attrs?.disabled !== `{${disabled.name}}`)))
    fail('selection-disabled-invalid', 'disabledField must map to a child boolean forwarded to native disabled');
  if (s.disabledField === undefined && disabled && disabled.default !== false)
    fail('selection-disabled-default-unsupported', 'a disabled default requires an explicit per-item disabled field');
  if (s.disabledField === undefined && disabled && Object.hasOwn(fields, disabled.name))
    fail('selection-disabled-field-required', 'a supplied disabled field must participate in selection');
  if (disabled && Object.hasOwn(item?.part.component?.props ?? {}, disabled.name))
    fail('selection-disabled-fixed-unsupported', 'disabled must be supplied by the item field or false default');
  const panelValues = s.panels.map(p => p.value), panelParts = s.panels.map(p => p.part);
  const gridWrappers = gridCellPlan(contract).wrappedInstances;
  if (new Set(panelValues).size !== values.length || panelValues.length !== values.length || panelValues.some(v => !values.includes(v)) || new Set(panelParts).size !== panelParts.length)
    fail('selection-panel-map-incomplete', 'each enum value must map to exactly one distinct panel part');
  for (const panel of s.panels) {
    const row = find(panel.part), p = row?.part;
    if (!p || !row || row.path.length < 2 || p.repeat || p.icon || p.shape || p.meter || p.content || p.text !== undefined || p.optional ||
        (p.element ?? 'div') !== 'div' || p.visibleWhen?.prop !== s.valueProp || p.visibleWhen.equals !== panel.value ||
        row.path.includes(s.listPart) || row.path.includes(s.itemPart) || row.path.slice(0,-1).some(n => panelParts.includes(n)))
      fail('selection-panel-invalid', `${panel.part} must be a distinct div panel with visibleWhen selecting only ${panel.value}`);
    if (p && ['id','role','hidden','tabIndex','aria-labelledby','style'].some(n => Object.hasOwn(p.attrs ?? {}, n)))
      fail('selection-panel-attrs-conflict', panel.part);
    if (p?.component) {
      const child = byId.get(p.component.id);
      if (!child || child.semantics.element !== 'div' || child.semantics.elementByProp || Object.keys(child.anatomy).join() !== 'root' ||
          child.bindings.code.runtime || contractApiNames(child).some(n => ['id','role','hidden','style','tabIndex'].includes(n)) ||
          (child.semantics.role !== undefined && child.semantics.role !== 'tabpanel') ||
          (child.anatomy.root.attrs?.role !== undefined && child.anatomy.root.attrs.role !== 'tabpanel') ||
          ['id','hidden','tabIndex','aria-labelledby'].some(n => Object.hasOwn(child.anatomy.root.attrs ?? {}, n)) ||
          Object.keys(p.component.overrides ?? {}).length > 0 || p.placement || gridWrappers.has(panel.part))
        fail('selection-panel-host-unsupported', panel.part);
    }
  }
  for (const name of [s.listPart, ...panelParts]) {
    const row = rows.find(row => row.name === name);
    if (row?.path.slice(0,-1).some(name => rows.find(row => row.name === name)?.part.visibleWhen))
      fail('selection-conditional-ancestor-unsupported', name);
  }
  if (repeat) {
    const keys = repeat.sample.map(record => record[repeat.keyField!]);
    if (repeat.sample.some(record => !Object.hasOwn(record, repeat.keyField!)) ||
        new Set(keys).size !== keys.length || keys.some(key => typeof key !== 'string' || !values.includes(key)) || !keys.includes(value?.default as string))
      fail('selection-sample-map-invalid', 'sample identities must be unique own declared values and include the initial selection');
    const initial = repeat.sample.find(record => record[repeat.keyField!] === value?.default);
    if (s.disabledField && repeat.sample.some(record => !Object.hasOwn(record, s.disabledField!) || typeof record[s.disabledField!] !== 'boolean'))
      fail('selection-disabled-sample-invalid', 'every observed record must supply its declared disabled boolean');
    if (s.disabledField && initial?.[s.disabledField] === true)
      fail('selection-sample-initial-disabled', 'the observed initial selection must be enabled');
  }
  for (const event of contract.events ?? []) {
    if ([s.listPart,s.itemPart,...panelParts].includes(event.trigger)) fail('selection-event-conflict', event.name);
  }
  return errors;
}
