// Native TextNode uses uniform range arrays and PIXELS objects for these
// fields. Keep this explicit until the older general mock adopts that API.
export function nativeTextBindings(figma: any) {
  const create = figma.createText.bind(figma);
  figma.createText = () => {
    const node = create(), bind = node.setBoundVariable.bind(node);
    delete node.clipsContent; // TextNode has no frame clipping field.
    const linked = new Map<string, any>();
    for (const field of ['fontSize', 'fontWeight', 'lineHeight']) {
      const storage = field === 'fontSize' ? '_fontSize' : field;
      let fallback = node[storage];
      Object.defineProperty(node, storage, { configurable: true, enumerable: true,
        get() {
          const variable = linked.get(field); if (!variable) return fallback;
          const value = variable.resolveForConsumer(node).value;
          return field === 'lineHeight' ? { unit: 'PIXELS', value } : value;
        },
        set(value) { fallback = value; },
      });
    }
    node.setBoundVariable = (field: string, variable: any) => {
      bind(field, variable);
      if (variable) linked.set(field, variable); else linked.delete(field);
      if (variable && ['fontSize', 'fontWeight', 'lineHeight'].includes(field)) {
        node.boundVariables[field] = [{ type: 'VARIABLE_ALIAS', id: variable.id }];
        const value = variable.resolveForConsumer(node).value;
        node[field] = field === 'lineHeight' ? { unit: 'PIXELS', value } : value;
      }
    };
    return node;
  };
}

