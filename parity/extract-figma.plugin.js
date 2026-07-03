// Figma-side extraction script (Plugin API). Transport-agnostic: run via
// figma-console-mcp figma_execute or the Figma MCP use_figma, then save the
// returned JSON to parity/snapshots/figma-components.json (sets) and
// parity/snapshots/figma-tokens.json (collections).
//
// v2 (composition): also extracts standalone COMPONENTs (not just sets),
// INSTANCE_SWAP preferredValues, and the names of nested component instances
// (for verifying contract `component` refs like Card ⊃ Avatar).
//
// GUARD: every script that touches the file verifies the file name first —
// multi-file bridge routing has been observed to target the wrong file.
if (figma.root.name !== 'DS Contracts POC') throw new Error('WRONG FILE: routed to ' + figma.root.name);
await figma.loadAllPagesAsync();

const rgbToHex = (c) => {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return ('#' + h(c.r) + h(c.g) + h(c.b)).toUpperCase();
};

// --- Component sets AND standalone components ---
const sets = [];
for (const page of figma.root.children) {
  const nodes = page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] });
  for (const node of nodes) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue; // variants
    if (node.name === 'Slot') continue; // utility, not a contract component
    const defs = {};
    for (const [key, def] of Object.entries(node.componentPropertyDefinitions)) {
      defs[key] = {
        type: def.type,
        defaultValue: def.defaultValue,
        variantOptions: def.variantOptions || null,
        preferredValues: def.preferredValues || null,
      };
    }
    // Nested instances: which components does this one compose?
    const probe = node.type === 'COMPONENT_SET' ? node.defaultVariant : node;
    const nestedInstances = [];
    for (const inst of probe.findAllWithCriteria({ types: ['INSTANCE'] })) {
      const main = await inst.getMainComponentAsync();
      if (!main) continue;
      const owner = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent.name : main.name;
      if (!nestedInstances.includes(owner)) nestedInstances.push(owner);
    }
    sets.push({
      name: node.name,
      nodeId: node.id,
      key: node.key,
      description: node.description,
      variantCount: node.type === 'COMPONENT_SET' ? node.children.length : 1,
      properties: defs,
      nestedInstances,
    });
  }
}

// --- Variables ---
const collections = [];
for (const col of await figma.variables.getLocalVariableCollectionsAsync()) {
  const vars = [];
  for (const id of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    const values = {};
    for (const mode of col.modes) {
      const val = v.valuesByMode[mode.modeId];
      if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
        const target = await figma.variables.getVariableByIdAsync(val.id);
        values[mode.name] = '{' + target.name + '}';
      } else if (val && typeof val === 'object' && 'r' in val) {
        values[mode.name] = rgbToHex(val);
      } else {
        values[mode.name] = val;
      }
    }
    vars.push({ name: v.name, type: v.resolvedType, scopes: v.scopes, codeSyntax: v.codeSyntax.WEB || null, values });
  }
  collections.push({ name: col.name, modes: col.modes.map((m) => m.name), variables: vars });
}

return { fileName: figma.root.name, sets, collections };
