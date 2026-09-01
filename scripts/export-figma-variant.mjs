#!/usr/bin/env node
// READ-ONLY: export one variant (or a named child of it) of a component set on a
// Scratch page to a PNG, resolved by NAME. Used to score states the fidelity
// manifest does not carry as rows (e.g. every state of a proposed library).
//   node scripts/export-figma-variant.mjs <pageId> "<set name>" "<variant name>" "<child prefix|>" out.png
import { readFileSync, writeFileSync } from "node:fs"; import { pathToFileURL } from "node:url";
const [,, pageId, setName, variantName, childPrefix, outPng] = process.argv;
const SDK="/Users/tjpitre/Sites/figma-console-mcp/node_modules/@modelcontextprotocol/sdk/dist/esm", LOCAL="/Users/tjpitre/Sites/figma-console-mcp/dist/local.js", KEY="byMp6lt0Ij9b2QbkDGFwBh";
const env={}; for (const l of readFileSync("/Users/tjpitre/Sites/ds-contracts-poc/.env.local","utf8").split(/\r?\n/)) { const m=l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if(m) env[m[1]]=m[2].replace(/^['"]|['"]$/g,""); }
const tok=env.FIGMA_TOKEN||env.FIGMA_ACCESS_TOKEN||"";
const {Client}=await import(pathToFileURL(`${SDK}/client/index.js`).href); const {StdioClientTransport}=await import(pathToFileURL(`${SDK}/client/stdio.js`).href);
const t=new StdioClientTransport({command:process.execPath,args:[LOCAL],env:{...process.env,FIGMA_TOKEN:tok,FIGMA_ACCESS_TOKEN:tok},stderr:"pipe"}); const c=new Client({name:"export-variant",version:"1"},{capabilities:{}}); await c.connect(t);
const parse=(r)=>{const x=r.content?.find(p=>p.type==="text")?.text??"{}";try{return JSON.parse(x)}catch{return{raw:x}}};
const call=async(n,a)=>parse(await c.callTool({name:n,arguments:a},undefined,{timeout:120000,maxTotalTimeout:120000}));
for(let i=0;i<30;i++){const s=await call("figma_get_status",{probe:true});const fs=s?.transport?.websocket?.connectedFiles??s?.files??[];if(fs.some(f=>f.fileKey===KEY))break;await new Promise(r=>setTimeout(r,2000));}
const code=`await figma.loadAllPagesAsync(); const page=await figma.getNodeByIdAsync(${JSON.stringify(pageId)}); const set=page.findAllWithCriteria({types:["COMPONENT_SET"]}).find(n=>n.name===${JSON.stringify(setName)}); if(!set) throw new Error("no set"); const variant=set.children.find(v=>v.name===${JSON.stringify(variantName)}); if(!variant) throw new Error("no variant "+set.children.map(v=>v.name).join("|")); let node=variant; if(${JSON.stringify(childPrefix)}) node=variant.children.find(k=>String(k.name).startsWith(${JSON.stringify(childPrefix)}))||variant.findOne(n=>String(n.name).startsWith(${JSON.stringify(childPrefix)})); const bytes=await node.exportAsync({format:"PNG",constraint:{type:"SCALE",value:1}}); return {bytes:Array.from(bytes), w:node.width, h:node.height};`;
const r=await call("figma_execute",{code,fileKey:KEY,timeout:60000}); await c.close();
if(!r.success) { console.error(r.error); process.exit(1); }
writeFileSync(outPng, Buffer.from(r.result.bytes)); console.log(outPng, r.result.w+"x"+r.result.h);
