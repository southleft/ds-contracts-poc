import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(root, "plan.json"), "utf8"));
const NS = plan.namespace;
const PAGE = plan.pageName;
const RUN = plan.runIdentity;
const FILE = "byMp6lt0Ij9b2QbkDGFwBh";
const SIGNED = [
  "115:295378",
  "163:35981",
  "183:70641",
  "173:48924",
  "181:64873",
  "183:69150",
  "85:6781",
  "183:74742",
];

const writers = [
  "writer-astryx-checkbox-reviewed-v1.js",
  "writer-mui-checkbox-reviewed-v1.js",
  "writer-antd-checkbox-reviewed-v1.js",
];

writeFileSync(
  join(root, "create-page.js"),
  `if(figma.fileKey!==${JSON.stringify(FILE)})throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!=="Scratch Project")throw new Error("WRONG-FILE-NAME:"+figma.root.name);
const signed=${JSON.stringify(SIGNED)};
if(signed.includes(figma.currentPage.id))throw new Error("ON-SIGNED-PAGE:"+figma.currentPage.id);
await figma.loadAllPagesAsync();
const pageName=${JSON.stringify(PAGE)};
const NS=${JSON.stringify(NS)};
const runIdentity=${JSON.stringify(RUN)};
let page=figma.root.children.find(p=>p.name===pageName);
if(page){
  if(page.getSharedPluginData(NS,"pageOwner")!=="recipe/checkbox/"+runIdentity)throw new Error("CHECKBOX-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(page.getSharedPluginData(NS,"runIdentity")!==runIdentity)throw new Error("CHECKBOX-PAGE-IDENTITY-MISMATCH:"+page.id);
  if(signed.includes(page.id))throw new Error("PAGE-IS-SIGNED:"+page.id);
  return{pageId:page.id,pageName:page.name,created:false};
}
page=figma.createPage();
page.name=pageName;
if(signed.includes(page.id))throw new Error("CREATED-SIGNED:"+page.id);
page.setSharedPluginData(NS,"pageOwner","recipe/checkbox/"+runIdentity);
page.setSharedPluginData(NS,"runIdentity",runIdentity);
page.setSharedPluginData(NS,"writerVersion","2");
return{pageId:page.id,pageName:page.name,created:true};
`,
);

const header = `if(figma.fileKey!==${JSON.stringify(FILE)})throw new Error("WRONG-FILE:"+figma.fileKey);
await figma.loadAllPagesAsync();
const page=figma.root.children.find(p=>p.name===${JSON.stringify(PAGE)});
if(!page)throw new Error("CHECKBOX-PAGE-MISSING");
const NS=${JSON.stringify(NS)};
`;

for (const writerName of writers) {
  const src = readFileSync(join(root, writerName), "utf8");
  const slug = writerName.replace("writer-", "").replace(".js", "");
  const n = 4;
  const size = Math.ceil(src.length / n);
  for (let i = 0; i < n; i++) {
    const chunk = src.slice(i * size, (i + 1) * size);
    const b64 = Buffer.from(chunk, "utf8").toString("base64");
    writeFileSync(
      join(root, `store-${slug}-w${i}.js`),
      `${header}page.setSharedPluginData(NS,${JSON.stringify(`${slug}-w${i}`)},${JSON.stringify(b64)});
return{key:${JSON.stringify(`${slug}-w${i}`)},chars:${chunk.length},b64:${b64.length}};
`,
    );
  }
  writeFileSync(
    join(root, `eval-${slug}.js`),
    `${header}const parts=[];
for(let i=0;i<4;i++){
  const b64=page.getSharedPluginData(NS,${JSON.stringify(slug)}+"-w"+i);
  if(!b64)throw new Error("CHUNK-MISSING:"+${JSON.stringify(slug)}+"-w"+i);
  parts.push(decodeURIComponent(escape(atob(b64))));
}
const code=parts.join("");
page.setSharedPluginData(NS,${JSON.stringify(slug)}+"-w0","");
page.setSharedPluginData(NS,${JSON.stringify(slug)}+"-w1","");
page.setSharedPluginData(NS,${JSON.stringify(slug)}+"-w2","");
page.setSharedPluginData(NS,${JSON.stringify(slug)}+"-w3","");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
return await new AsyncFunction(code)();
`,
  );
}

console.log(
  JSON.stringify({
    pageName: PAGE,
    runIdentity: RUN,
    writers,
    chunksPerWriter: 4,
  }),
);
