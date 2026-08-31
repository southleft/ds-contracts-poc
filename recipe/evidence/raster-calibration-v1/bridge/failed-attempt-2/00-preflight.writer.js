
if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("CALIBRATION-WRONG-TARGET");
await figma.loadAllPagesAsync();
const pages=figma.root.children.map(page=>({id:page.id,name:page.name,topLevelNodeIds:page.children.map(node=>node.id)}));
const collections=(await figma.variables.getLocalVariableCollectionsAsync()).map(collection=>({id:collection.id,name:collection.name,variableIds:[...collection.variableIds]})).sort((a,b)=>a.id.localeCompare(b.id));
return{fileKey:figma.fileKey,fileName:figma.root.name,editorType:figma.editorType,pages,collections,matchingCalibrationPages:pages.filter(page=>page.name==="Recipe Raster Calibration / daeac5691a14").length};
