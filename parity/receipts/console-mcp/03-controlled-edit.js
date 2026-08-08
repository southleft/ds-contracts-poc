const tooltip = figma.currentPage.findOne((n) => n.type === "COMPONENT" && n.name === "Tooltip");
const label = tooltip && tooltip.findOne((n) => n.name === "label");
if (!label) throw new Error("label missing — run 01-seed-or-inspect.js");
const beforeBound = label.boundVariables && label.boundVariables.paddingLeft ? label.boundVariables.paddingLeft.id : null;
label.setBoundVariable("paddingLeft", null);
label.paddingLeft = 12;
const afterBound = label.boundVariables && label.boundVariables.paddingLeft ? label.boundVariables.paddingLeft.id : null;
return {
  mutatedNodeIds: [label.id],
  before: { paddingLeft: 8, bound: beforeBound },
  after: { paddingLeft: label.paddingLeft, bound: afterBound },
  detached: Boolean(beforeBound && !afterBound)
};
