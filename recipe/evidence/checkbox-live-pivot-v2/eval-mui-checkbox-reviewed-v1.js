if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh")throw new Error("WRONG-FILE:"+figma.fileKey);
await figma.loadAllPagesAsync();
const page=figma.root.children.find(p=>p.name==="Recipe Pivot / Checkbox / 548cf953-c8ce9a83-7856869a-checkbox-v2");
if(!page)throw new Error("CHECKBOX-PAGE-MISSING");
const NS="ds.contracts.checkbox.recipe.v1";
const parts=[];
for(let i=0;i<4;i++){
  const b64=page.getSharedPluginData(NS,"mui-checkbox-reviewed-v1"+"-w"+i);
  if(!b64)throw new Error("CHUNK-MISSING:"+"mui-checkbox-reviewed-v1"+"-w"+i);
  parts.push(decodeURIComponent(escape(atob(b64))));
}
const code=parts.join("");
page.setSharedPluginData(NS,"mui-checkbox-reviewed-v1"+"-w0","");
page.setSharedPluginData(NS,"mui-checkbox-reviewed-v1"+"-w1","");
page.setSharedPluginData(NS,"mui-checkbox-reviewed-v1"+"-w2","");
page.setSharedPluginData(NS,"mui-checkbox-reviewed-v1"+"-w3","");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
return await new AsyncFunction(code)();
