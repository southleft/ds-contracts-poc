// figma_execute — inspect existing Tooltip probe or report missing
const pages = figma.root.children.map((p) => ({ id: p.id, name: p.name, n: p.children.length }));
const tooltip = figma.currentPage.findOne((n) => n.type === 'COMPONENT' && n.name === 'Tooltip');
const vars = await figma.variables.getLocalVariablesAsync();
const padding = vars.find((v) => v.name === 'tooltip/label/padding-left' || v.name.endsWith('padding-left'));
return {
  fileName: figma.root.name,
  pages,
  tooltip: tooltip
    ? { id: tooltip.id, labelId: tooltip.findOne((n) => n.name === 'label')?.id ?? null }
    : null,
  paddingVar: padding ? { id: padding.id, name: padding.name } : null,
  hint: tooltip
    ? 'Probe present — continue with 02-baseline-fingerprint.js'
    : 'Probe missing — seed via official MCP use_figma or paste a minimal Tooltip with bound paddingLeft',
};
