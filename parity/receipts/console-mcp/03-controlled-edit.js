const LABEL = "2:4";
const label = await figma.getNodeByIdAsync(LABEL);
if (!label) throw new Error("label missing");
const beforeBound = label.boundVariables && label.boundVariables.paddingLeft ? label.boundVariables.paddingLeft.id : null;
label.paddingLeft = 12;
const afterBound = label.boundVariables && label.boundVariables.paddingLeft ? label.boundVariables.paddingLeft.id : null;
return {
  mutatedNodeIds: [label.id],
  before: { paddingLeft: 8, bound: beforeBound },
  after: { paddingLeft: label.paddingLeft, bound: afterBound },
  detached: Boolean(beforeBound && !afterBound)
};
