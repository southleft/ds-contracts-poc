import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript} from './native-source-observation.js';
import {prepareNativeContractUpdate} from './native-contract-update.js';

export async function nativeBackgroundUpdateFixture(nested:boolean|'shape'=false,fileKey?:string) {
 const f=await nativeComparisonFixture(fileKey),old=structuredClone(f.main);
 // The minimal host does not derive transform matrices from x/y. Model that
 // native relationship for newly allocated rectangles, not in product code.
 const createRectangle=f.figma.createRectangle.bind(f.figma);
 f.figma.createRectangle=()=>{const node=createRectangle();node.getSharedPluginDataKeys=(namespace:string)=>[...node._shared.keys()].filter((key:any)=>key.startsWith(namespace+'/')&&node._shared.get(key)!=='').map((key:any)=>key.slice(namespace.length+1));Object.defineProperty(node,'relativeTransform',{configurable:true,get:()=>[[1,0,node.x],[0,1,node.y]]});return node;};
 old.anatomy.root.literals={width:'116px',height:'36px','border-width':'1px','border-radius':'8px'};
 if(nested==='shape'){delete old.anatomy.root.slot;old.anatomy.root.parts={dot:{shape:{kind:'rect',width:8,height:8},tokens:{'background-color':'{ink}'}}};}
 if(nested===true){delete old.anatomy.root.slot;old.anatomy.root.parts={panel:{layout:{display:'flex',direction:'row'},tokens:{'background-color':'{surface}'},literals:{width:'80px',height:'24px','border-width':'2px','border-radius':'4px'},parts:{content:{slot:{name:'children'}}}}};}
 const byId=new Map([[old.id,old]]),data=f.engine.compileNativeContractDraft(old,byId,f.source);
 const creation=await f.run(f.engine.buildNativeContractDraftScript(old,byId,f.source,f.supplemental));
 assert.equal(creation.status,'created-candidate');
 const before={operation:f.supplemental.operation,planRevision:revisionOf('paint migration baseline'),projection:data.projection,component:data.component,
  tokenInput:f.supplemental.tokens.input,tokenIdentity:f.supplemental.tokens.identity,creation};
 const baseline=await f.run(emitNativeContractReadbackScript(before));
 // Model an old compiler's annotated output for the SAME unchanged contract.
 const contract=structuredClone(old);contract.anatomy.root.declared={'background-clip':'padding-box'};
 if(nested===true)contract.anatomy.root.parts!.panel.declared={'background-clip':'padding-box'};
 const desired=f.engine.compileNativeContractDraft(contract,new Map([[contract.id,contract]]),f.source).component;
 const revision=before.projection.contractRevision;
 const repin=(s:any)=>{s.nativeContractPart.contractRevision=revision;s.children?.forEach(repin);};
 desired.variants.forEach(v=>repin(v.spec));
 const input={before,baseline,desired:{component:desired,revision:revisionOf(desired),tokenInput:before.tokenInput}};
 const {plan}=prepareNativeContractUpdate(input);
 assert.equal(plan.kind,'native-contract-background-update');
 const root=await f.figma.getNodeByIdAsync(creation.variants[0].id);
 return {...f,input,plan,root,nodes:[root]};
}

