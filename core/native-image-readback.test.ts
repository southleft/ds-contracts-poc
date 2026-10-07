import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {emitNativeInventoryReadbackScript} from './native-source-observation.js';
function setup(mode='normal'){
 const bytes=Buffer.from('original image bytes'),calls:string[]=[];
 const node:any={id:'image-node',type:'FRAME',name:'Photo',children:[],fills:[{type:'IMAGE',imageHash:'observed-hash',scaleMode:'FILL'}],getSharedPluginData:(key:string,name:string)=>name==='imageOverride'?'test.image:photo':''};
 const page:any={id:'page',type:'PAGE',name:'Page',children:[node],findAll:()=>[node],getSharedPluginData:()=>''};node.parent=page;
 let count=0;
 const figma:any={fileKey:'file',loadAllPagesAsync:async()=>{},getNodeByIdAsync:async()=>page,base64Encode:(b:Uint8Array)=>Buffer.from(b).toString('base64'),getImageByHash:(hash:string)=>{calls.push(hash);return mode==='missing'?null:{getBytesAsync:async()=>{count++;if(mode==='throw')throw Error('image unavailable');if(mode==='changed'&&count===2)return Buffer.from('changed image bytes');return bytes;}};}};
 const expected={operation:{id:'op',fileKey:'file'},planRevision:'revision',pageId:'page',nodes:[],comparisons:[]};
 const script=emitNativeInventoryReadbackScript(expected,{} as any,{} as any,['imageOverride'],false,false,[],[],false,[],false,false,"return {status:'readback-collected',receipt:{}};");
 return {calls,bytes,node,script,run:()=>vm.runInNewContext('(async()=>{'+script+'})()',{figma})};
}
test('original image inventory reads observed hashes independently twice and records target marker',async()=>{
 const f=setup(),result=await f.run();assert.equal(result.status,'native-readback-collected',JSON.stringify(result));
 assert.deepEqual(f.calls,['observed-hash','observed-hash']);
 const row=result.nodes.find((n:any)=>n.id==='image-node');assert.equal(row.imageAssets['observed-hash'],f.bytes.toString('base64'));assert.equal(row.metadata.imageOverride,'test.image:photo');
 assert.equal(f.script.includes(f.bytes.toString('base64')),false,'expected bytes never enter readback script');
});
test('original image inventory refuses unavailable and changing assets',async()=>{
 for(const mode of ['missing','throw','changed']){const r=await setup(mode).run();assert.equal(r.status,'refused');assert.equal(r.nodes,undefined);assert.match(r.problems.join(','),mode==='changed'?/changed-during-observation/:/unavailable/);}
});
