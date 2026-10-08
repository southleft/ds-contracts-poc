import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('editor validation uses reachable import token values and preserves missing, invalid and active-layer refusals',async()=>{
 const server=await createServer({configFile:false,root:path.join(repo,'playground'),logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null,fs:{allow:[repo]}},resolve:{alias:{'@ds-contracts/core':path.join(repo,'packages/core/src/index.ts'),'@ds-contracts/schema':path.join(repo,'packages/schema/src/index.ts')}},optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const {validateContractText}=await server.ssrLoadModule('/src/engine/validate.ts');
  const {recordImport,clearWorkspace}=await server.ssrLoadModule('/src/engine/workspace.ts');
  const {setMintedTokens,setCapturedTokens}=await server.ssrLoadModule('/src/engine/token-source.ts');
  const base={version:'1.0.0',description:'Linked token validation',semantics:{element:'div'},props:[],states:[],bindings:{code:{anchors:{importPath:'./Example',export:'Example'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
  const child={...base,id:'proof.scope-child',name:'ScopeChild',anatomy:{root:{instanceRootInputs:['width','background-color'],layout:{display:'flex',direction:'row'},literals:{width:'24px',height:'20px'}}}};
  const parent={...base,id:'proof.scope-parent',name:'ScopeParent',anatomy:{root:{parts:{usage:{component:{id:child.id,rootOverrides:{width:'{imported.scope.width}','background-color':'{imported.scope.paint}'}}}}}}};
  const layer=(width:string)=>({tree:{imported:{scope:{width:{$type:'dimension',$value:width},paint:{$type:'color',$value:'#123456'}}}},count:2,entries:[{ref:'{imported.scope.width}',value:width,usageSites:[]},{ref:'{imported.scope.paint}',value:'#123456',usageSites:[]}]});
  for(const mode of ['linked','missing','invalid','unrelated','active-invalid']){
   clearWorkspace();setMintedTokens(null);setCapturedTokens(null);
   recordImport({name:child.name,contractId:child.id,source:'json',contractText:JSON.stringify(child),receipts:{source:'test',groups:[]},...(mode==='missing'||mode==='unrelated'?{}:{mintedTokens:layer(mode==='invalid'?'-2px':'41px')})});
   if(mode==='unrelated'){const other={...child,id:'proof.unrelated',name:'Unrelated'};recordImport({name:other.name,contractId:other.id,source:'json',contractText:JSON.stringify(other),receipts:{source:'test',groups:[]},mintedTokens:layer('41px')});}
   if(mode==='active-invalid')setMintedTokens(layer('-3px'));
   const result=validateContractText(JSON.stringify(parent));
   if(mode==='linked')assert.equal(result.status,'valid',JSON.stringify(result));
   else{assert.equal(result.status,'violations',mode);assert(result.issues.some((s:string)=>s.includes('instance-root-input-value-unsupported')),mode);}
  }
 }finally{await server.close();}
});
