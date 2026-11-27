import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {canonical,hash,values} from './surface.mjs';
import {capture} from './capture.mjs';
import {emitSystem} from './figma.mjs';
import {planWriteback,applyWriteback} from './writeback.mjs';

const read=p=>readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),save=(p,v)=>writeFileSync(p,canonical(v));
const stable=v=>JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e6)/1e6:x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const same=(a,b,message)=>assert.equal(stable(a),stable(b),message);
const snapshot=v=>v.result?.snapshot??v.result?.after??v.result??v.snapshot??v.after??v;
function verifyProjection(B,native){
 const parent=B.components[B.root];assert.equal(native.parent.component,B.root,'wrong native component');assert.equal(native.variants.length,parent.appearance.variants.length,'variant inventory changed');
 for(const v of native.variants){const expected=parent.appearance.variants.find(x=>x.key===v.key);assert(expected,'unexpected variant');same(v.axes,expected.axes,'variant axes differ');same(Object.keys(v.parts).sort(),Object.keys(parent.appearance.parts).sort(),'part inventory differs');
  for(const [id,part]of Object.entries(parent.appearance.parts)){const cells=values(part,expected.axes);for(const [field,c]of Object.entries(cells))same(v.parts[id].styles[field],c.value,'native value differs: '+id+'.'+field);same(v.parts[id].tokens,Object.fromEntries(Object.entries(cells).filter(([,c])=>c.token).map(([k,c])=>[k,c.token])),'native bindings differ: '+id);}
  for(const [slot,d]of Object.entries(parent.instances)){assert.equal(v.instances[slot]?.component,d.component,'missing component dependency: '+slot);assert.equal(v.instances[slot].revision,B.components[d.component].revision,'dependency revision differs');assert.equal(v.instances[slot].colorToken,d.colorToken,'dependency binding differs');}
 }
 for(const [id,t]of Object.entries(B.system.tokens)){const n=native.tokens[id];assert(n,'missing native token: '+id);same(n.alias??n.value,t.alias??t.value,'native token differs: '+id);assert.equal(n.codeSyntax.WEB,'var('+t.css+')','native code syntax differs');}
}
function policy(P,B,native,root){
 const inputs=[P.source,P.story,P.stylesheet,...Object.values(P.dependencies).map(d=>d.source),...(P.capture.inputs??[])].filter(Boolean);
 return {version:1,system:B.system.id,root,contractSha256:hash(B),nativeBaselineSha256:hash(native),tokens:Object.values(B.system.tokens).map(t=>({id:t.id,file:t.source.file,path:t.source.path})),guards:[...new Set([...inputs,...Object.values(B.system.tokens).map(t=>t.source.file)])],inputs:[...new Set(inputs)].map(file=>({file,sha256:hash(read(path.resolve(root,file)))}))};
}
function identity(n){return {parent:n.parent,components:Object.fromEntries(Object.entries(n.components).map(([id,c])=>[id,c.id])),tokens:Object.fromEntries(Object.entries(n.tokens).map(([id,t])=>[id,t.id])),variants:n.variants.map(v=>({id:v.id,parts:Object.fromEntries(Object.entries(v.parts).map(([id,p])=>[id,p.id])),instances:Object.fromEntries(Object.entries(v.instances).map(([id,i])=>[id,{id:i.id,main:i.main}]))}))};}

export async function runRoundtrip(argv,{reader,log=v=>console.log(canonical(v))}={}){
 let [action,...args]=argv;const flags={};for(let i=0;i<args.length;i+=2){assert(args[i].startsWith('--')&&args[i+1]&&!args[i+1].startsWith('--'),'expected --name value');const key=args[i].slice(2);assert(['profile','out','session','root','snapshot','digest','port'].includes(key),'unknown flag: '+key);assert(!flags[key],'duplicate flag: '+key);flags[key]=args[i+1];}
 assert(['start','accept','read','review','apply','refresh','status','sync','discard'].includes(action),'roundtrip action: start | sync | accept | read | review | apply | refresh | status | discard');
 const dir=path.resolve(flags.session??flags.out??'');assert(flags.session||flags.out,'--session or --out required');const stateFile=path.join(dir,'session.json');
 if(action==='start'){assert(flags.profile,'--profile required');assert(!existsSync(dir)||readdirSync(dir).length===0,'output directory is not empty');mkdirSync(dir,{recursive:true});}else assert(existsSync(stateFile),'session does not exist');
 const lock=path.join(dir,'.lock'),fd=openSync(lock,'wx');try{
  let state=action==='start'?{version:1,root:path.resolve(flags.root??process.cwd()),profile:json(path.resolve(flags.profile)),stage:'starting'}:json(stateFile);
  const P=state.profile,target={...P.figma},bundle=()=>json(path.join(dir,'bundle.json'));
  const writeProgram=(B,options)=>{const file=path.join(dir,'figma.js');writeFileSync(file,emitSystem(B,{...target,...options}));return file;};
  if(action==='discard'){assert(state.stage==='reviewed','no reviewed plan to discard');delete state.reviewed;state.stage='ready';save(stateFile,state);log({status:'ready',discarded:'reviewed plan'});return 0;}
  if(action==='sync'){
   assert(['ready','awaiting-figma'].includes(state.stage),'session is not ready to sync');const port=Number(flags.port??9232);assert([9231,9232].includes(port),'supported runner ports: 9231, 9232');
   const program=state.stage==='ready'?writeProgram(bundle(),{action:'read'}):path.join(dir,'figma.js'),{servePrograms}=await import('../commands/react-to-figma-serve.ts');
   const [outcome]=await servePrograms([{name:P.component.id,tokens:'return null;',component:read(program)}],target.fileKey,read(new URL('./react-to-figma-driver.js',import.meta.url)),{port,result:true,log:line=>console.error(line)});
   assert(outcome.written,outcome.error);flags.snapshot=path.join(dir,'transfer.json');save(flags.snapshot,outcome.result);action=state.stage==='ready'?'review':'accept';
  }
  if(action==='status'){log({stage:state.stage,session:dir,system:P.system.id,component:P.component.id});return 0;}
  if(action==='read'){assert(state.native,'accept the first Figma projection before reading');log({program:writeProgram(bundle(),{action:'read'}),next:'Run this program in the named Figma file, save its JSON result, then use roundtrip review --snapshot.'});return 0;}
  if(action==='accept'){
   assert(state.stage==='awaiting-figma','no pending Figma projection');assert(flags.snapshot,'--snapshot required');const native=snapshot(json(path.resolve(flags.snapshot))),B=bundle();for(const g of state.inputs)assert.equal(hash(read(g.file)),g.sha256,'source changed since capture: '+g.file);verifyProjection(B,native);if(state.native)same(identity(native),identity(state.native),'native identity changed');state.native=native;state.policy=policy(P,B,native,state.root);state.stage='ready';save(stateFile,state);save(path.join(dir,'native.json'),native);log({status:'synchronized',session:dir,component:B.root,native:native.parent.id});return 0;
  }
  if(action==='review'){
   assert(state.stage==='ready','accept the pending projection first');assert(flags.snapshot,'--snapshot required');const native=snapshot(json(path.resolve(flags.snapshot))),plan=planWriteback(bundle(),state.native,native,state.policy);save(path.join(dir,'plan.json'),plan);if(!plan.edits.length){log({status:'unchanged',edits:[]});return 0;}state.reviewed=native;state.stage='reviewed';save(stateFile,state);log({status:'review',edits:plan.edits,digest:plan.digest,next:'roundtrip apply --session '+dir+' --digest '+plan.digest});return 0;
  }
  assert(action==='start'||state.stage==='ready'||(action==='apply'&&state.stage==='reviewed'),'session is not ready for this action');
  let rollback=new Map();
  try{
   if(action==='apply'||action==='refresh')for(const g of state.inputs??[]){if(action==='refresh'&&Object.values(P.tokens).some(t=>path.resolve(state.root,t.file)===g.file))continue;assert.equal(hash(read(g.file)),g.sha256,'captured input changed: '+g.file);}
   if(action==='apply'){
    assert(flags.digest,'--digest required');const plan=json(path.join(dir,'plan.json'));for(const f of [...plan.files.map(f=>f.file),...(P.capture.generated??[])]){const file=path.resolve(state.root,f);rollback.set(file,{before:read(file),after:plan.files.find(p=>p.file===f)?.afterSha256});}
    applyWriteback(plan,state.policy,flags.digest);state.native=state.reviewed;
   }
   if(action==='refresh')for(const g of state.policy.inputs)assert.equal(hash(read(path.resolve(state.root,g.file))),g.sha256,'unowned source changed: '+g.file);
   const B=await capture(P,state.root,path.join(dir,'capture'),reader??await import(new URL('./storybook-reader.js',import.meta.url).href));
   if(action!=='start'){
    const before=bundle().components[B.root].appearance,after=B.components[B.root].appearance;
    same(before.axes,after.axes,'unsupported axes change');same(before.props,after.props,'unsupported props change');
    for(const v of before.variants)for(const [id,p]of Object.entries(before.parts))for(const [field,c]of Object.entries(values(p,v.axes))){const next=values(after.parts[id],v.axes)[field];if(!c.token)same(c.value,next.value,'unsupported source style change: '+id+'.'+field);same(c.token,next.token,'source binding changed');}
   }
   save(path.join(dir,'bundle.json'),B);state.inputs=json(path.join(dir,'capture','source-inputs.json'));state.stage='awaiting-figma';delete state.reviewed;const program=writeProgram(B,{action:state.native?'patch':'create',...(state.native?{expected:state.native}:{})});save(stateFile,state);log({status:'awaiting-figma',program,session:dir,next:'roundtrip sync --session '+dir+'; then Connect and run in the named Figma file'});return 0;
  }catch(error){for(const [file,value]of rollback)if(!value.after||hash(read(file))===value.after)writeFileSync(file,value.before);throw error;}
 }finally{closeSync(fd);unlinkSync(lock);}
}
