// Design-side extraction — run this in YOUR design file.
//
// Transport-agnostic Plugin API script (same boundary as figma-sync/): run it
// through any console/plugin-runner bridge that executes Plugin API code in
// an open file, then save the returned JSON to extract/design.json and point
// extract.config.json's design.source at it.
//
// Reads ONLY the API surface (docs/11 scope): every local component set's
// variant axes + options, boolean/text/instance-swap properties. No anatomy,
// no styles, no page structure. Read-only — mutates nothing.
await figma.loadAllPagesAsync();
const components = [];
for (const page of figma.root.children) {
  for (const node of page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') continue;
    const entry = {
      name: node.name,
      nodeId: node.id,
      page: page.name,
      variantProps: {},
      boolProps: [],
      textProps: [],
      swapProps: [],
    };
    let defs = {};
    try {
      defs = node.componentPropertyDefinitions || {};
    } catch (e) {
      // standalone COMPONENT outside a set can throw for variant defs; skip
    }
    for (const rawName of Object.keys(defs)) {
      const def = defs[rawName];
      const name = rawName.split('#')[0]; // strip the tool's property-id suffix
      if (def.type === 'VARIANT') entry.variantProps[name] = def.variantOptions || [];
      else if (def.type === 'BOOLEAN') entry.boolProps.push(name);
      else if (def.type === 'TEXT') entry.textProps.push(name);
      else if (def.type === 'INSTANCE_SWAP') entry.swapProps.push(name);
    }
    components.push(entry);
  }
}
return {
  fileName: figma.root.name,
  fileKey: figma.fileKey || null,
  extractedAt: 'design-dump-v1',
  components,
};
