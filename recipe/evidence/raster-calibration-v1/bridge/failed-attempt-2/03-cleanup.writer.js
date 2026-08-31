
if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("CALIBRATION-WRONG-TARGET");
await figma.loadAllPagesAsync();
const matches=figma.root.children.filter(page=>page.name==="Recipe Raster Calibration / daeac5691a14");
if(matches.length>1)throw new Error("CALIBRATION-CLEANUP-AMBIGUOUS:"+matches.length);
const removedPageIds=[];
for(const page of matches){removedPageIds.push(page.id);page.remove();}
return{removedPageIds,removedCollectionIds:[]};
