import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {ContractSchema,FillStackSchema,resolveFillStack,type Contract} from '../scripts/contract-schema.js';
import {observeFillStack} from '../extract/figma/fill-stack-observation.js';
import {sourceFillStack} from './ordered-paint-stack.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {revisionOf} from './contract-provenance.js';
import {generatedTypeErrors} from './react-test-runtime.js';
const bytes=readFileSync(new URL('../extract/figma/fixtures/native-group-plane/18x18.png',import.meta.url)),image=`url('data:image/png;base64,${bytes.toString('base64')}')`;
const solid=(index:number,opacity=1)=>({index,type:'SOLID' as const,color:{r:1,g:0,b:0},visible:true,opacity,blendMode:'NORMAL' as const});
const bitmap=(index:number,opacity=1)=>({index,type:'IMAGE' as const,imageHash:'original',image,scaleMode:'FILL' as const,visible:true,opacity,blendMode:'NORMAL' as const});
const stack=FillStackSchema.parse({version:1,order:'bottom-to-top',paints:[solid(0),bitmap(1,.5)]});
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
const make=(name='PaintHost'):Contract=>ContractSchema.parse({id:'test.'+name.toLowerCase(),name,version:'1.0.0',status:'draft',description:'Ordered paints',props:[],states:[],semantics:{element:'div'},anatomy:{root:{literals:{width:'24px',height:'24px'},fillStack:stack,parts:{Label:{text:'Content'}}}},bindings:{figma:{anchors:{fileKey:'file',componentSetKey:'key'}},code:{anchors:{importPath:'./'+name,export:name}}}});
async function ssr(name:string,tsx:string,dependencies:Record<string,string>={},props:Record<string,unknown>={}){
 const output=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {${name}} from 'subject';exports.html=(props)=>renderToStaticMarkup(React.createElement(${name},props));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom/server'],plugins:[{name:'memory',setup(b){b.onResolve({filter:/^(subject|\.\.?\/)/},a=>a.path==='subject'?{path:name,namespace:'memory'}:dependencies[a.path.split('/').pop()!]?{path:a.path.split('/').pop()!,namespace:'memory'}:a.path.endsWith('.css')?{path:'style',namespace:'css'}:undefined);b.onLoad({filter:/.*/,namespace:'memory'},a=>({contents:a.path===name?tsx:dependencies[a.path],loader:'tsx',resolveDir:process.cwd()}));b.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default new Proxy({}, {get:(_,name)=>String(name)})',loader:'js'}));}}]});
 const mod={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return mod.exports.html(props) as string;
}
test('complete mixed paint source preserves hidden, alpha and original image bytes; unsupported hidden effects refuse',()=>{
 const raw:any[]=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:0,visible:false},{type:'IMAGE',imageHash:'original',scaleMode:'FILL',opacity:.5}];
 const n:any={name:'Paint',type:'FRAME',sourceFillStack:observeFillStack(raw)};const before=JSON.stringify(n);
 const p=sourceFillStack(n,{original:{imageHash:'original',mimeType:'image/png',base64:bytes.toString('base64'),byteLength:bytes.length}},'Paint','Default');
 assert.equal(p.paints[0].visible,false);assert.equal(p.paints[0].opacity,0);assert.equal(p.paints[1].opacity,.5);assert.equal(JSON.stringify(n),before);
 raw[0].blendMode='MULTIPLY' as never;n.sourceFillStack=observeFillStack(raw);assert.throws(()=>sourceFillStack(n,{},'Paint','Default'),/fill-stack|original-image/);
});
test('missing joint rows, competing paint and wrong original indices refuse',()=>{
 const c=make();for(const change of [(x:any)=>x.anatomy.root.fillStack.paints.reverse(),(x:any)=>x.anatomy.root.literals['background-color']='red',(x:any)=>{x.anatomy.root.fillStackByCombination={props:['mode'],rows:[]};}]){const x=structuredClone(c);change(x);assert.equal(ContractSchema.safeParse(x).success,false);}
 assert.throws(()=>resolveFillStack({fillStackByCombination:{props:['mode'],rows:[{values:['a'],stack}]}},{mode:'b'}),/selected-row-missing/);
});
test('both React surfaces render ordered independent image opacity and one original asset literal',async()=>{
 const c=make();const scope=new Map([[c.id,c]]);
 for(const kind of ['module','inline']){
  const out=kind==='module'?emitReact(c,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:scope}):emitReactInline(c,{tokens,icons:new Map(),contracts:scope});
  assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);
  const html=await ssr(c.name,out.tsx,{}, {style:{opacity:.25}});assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);assert(html.indexOf('data-dsc-paint-index="0"')<html.indexOf('data-dsc-paint-index="1"'));assert.match(html,/opacity:0.5/);assert.match(html,/opacity:0.25/);assert.match(html,/isolation:isolate/);assert.match(html,/Content/);
  assert.equal(out.tsx.split(bytes.toString('base64')).length-1,1);
 }
});
test('whole-fills override replaces all planes; omission restores exact originals on both React surfaces',async()=>{
 const c=make();c.props=[{name:'color',type:{enum:['rgba(0,0,255,1)']},bindings:{figma:{kind:'NONE'},code:{prop:'color'}}}];const part=c.anatomy.root.parts!.Label;delete part.text;part.fillStack=structuredClone(stack);part.shapeFillOverrideProp='color';delete c.anatomy.root.fillStack;
 const parsed=ContractSchema.parse(c),scope=new Map([[c.id,parsed]]);
 for(const kind of ['module','inline']){
  const out=kind==='module'?emitReact(parsed,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:scope}):emitReactInline(parsed,{tokens,icons:new Map(),contracts:scope});
  assert.equal((await ssr(c.name,out.tsx)).match(/data-dsc-paint-index=/g)?.length,2);
  const replaced=await ssr(c.name,out.tsx,{}, {color:'rgba(0,0,255,1)'});assert.equal(replaced.match(/data-dsc-paint-index=/g)?.length??0,0);assert.match(replaced,/background-color:rgba\(0,0,255,1\)/);await assert.rejects(ssr(c.name,out.tsx,{}, {color:'rgba(0,255,0,1)'}),/shape-fill-override-value-unqualified/);
 }
});
test('one child instance receives full root stack and omission keeps its default paint',async()=>{
 const child=make('PaintChild');delete child.anatomy.root.fillStack;child.anatomy.root.literals!['background-color']='blue';
 const parent=make('PaintParent');delete parent.anatomy.root.fillStack;parent.anatomy.root.parts={Instance:{component:{id:child.id},fillStack:stack,fillStackSource:{fileKey:'file',setKey:'key',contractRevision:revisionOf(child)}}};
 const c=ContractSchema.parse(parent),scope=new Map([[child.id,child],[c.id,c]]);
 for(const kind of ['module','inline']){
  const emit=(c:Contract)=>kind==='module'?emitReact(c,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:scope}):emitReactInline(c,{tokens,icons:new Map(),contracts:scope});
  const out=emit(c),dep=emit(child);assert.deepEqual(generatedTypeErrors(c.name,out.tsx,{[child.name]:dep.tsx}),[]);
  const html=await ssr(c.name,out.tsx,{[child.name]:dep.tsx});assert.equal((html.match(/Content/g)||[]).length,1);assert.equal((html.match(/data-dsc-paint-index=/g)||[]).length,2);
  const original=await ssr(child.name,dep.tsx);assert.equal(original.match(/data-dsc-paint-index=/g)?.length??0,0);assert(!original.includes('data-dsc-stack-active'));
 }
});
test('ordinary proposal reaches stack carrier without changing input or inventing an empty fill',()=>{
 const raw:any[]=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:0},{type:'SOLID',color:{r:1,g:1,b:1},opacity:Math.fround(.00001)}];
 const source:any={setName:'LayeredBox',type:'COMPONENT',variants:[{name:'Default',type:'FRAME',bbox:{width:20,height:20},sourceFillStack:observeFillStack(raw),sourceNormalFillComposition:{issue:'solid-fill-composition-source-paint-stack-unqualified'},fill:{hex:'000000',alpha:0}}]};
 const before=JSON.stringify(source);const out=proposeFromDump(source,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(out.contract);assert.equal(c.anatomy.root.fillStack?.paints.length,2);assert.equal(c.anatomy.root.fillStack?.paints[1].opacity,Math.fround(.00001));assert.equal(c.anatomy.root.tokens?.['background-color'],undefined);assert.equal(JSON.stringify(source),before);
});

test('native compiler retains two paints and one unchanged dependency instance',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const child=make('NativeChild');delete child.anatomy.root.fillStack;
 const parent=make('NativeParent');delete parent.anatomy.root.fillStack;parent.anatomy.root.parts={Instance:{component:{id:child.id},fillStack:stack,fillStackSource:{fileKey:'file',setKey:'key',contractRevision:revisionOf(child)}}};
 const c=ContractSchema.parse(parent),scope=new Map([[child.id,child],[c.id,c]]),engine=createFigmaEngine({tokens,icons:new Map()});
 const data=engine.compileComponentData(c,scope);const refs:any[]=[];const visit=(n:any)=>{if(n.type==='instance')refs.push(n);n.children?.forEach(visit);};visit(data.variants[0].spec);
 assert.equal(refs.length,1);assert.equal(refs[0].depContractId,child.id);assert.equal(refs[0].fillStack.paints.length,2);assert.equal(refs[0].fillStack.paints[1].opacity,.5);
 assert.equal(data.variants[0].spec.lits?.width,24);assert.equal(data.variants[0].spec.lits?.height,24);
 const invalid=structuredClone(c);invalid.anatomy.root.parts!.Instance.fillStackSource!.contractRevision='foreign';assert.throws(()=>engine.compileComponentData(invalid,scope),/fill-stack-reference-owner/);
});

test('joint source stack selects all exact tuples including explicit empty and refuses missing rows',()=>{
 const c=make('JointStack');delete c.anatomy.root.fillStack;c.props=[{name:'mode',type:{enum:['a','b']},bindings:{figma:{kind:'VARIANT',property:'Mode',values:{a:'A',b:'B'}},code:{prop:'mode'}}},{name:'enabled',type:'boolean',bindings:{figma:{kind:'VARIANT',property:'Enabled',values:{true:'True',false:'False'}},code:{prop:'enabled'}}}];
 c.anatomy.root.fillStackByCombination={props:['mode','enabled'],rows:[{values:['a','true'],stack},{values:['a','false'],stack:{version:1,order:'bottom-to-top',paints:[]}},{values:['b','true'],stack:{version:1,order:'bottom-to-top',paints:[solid(0,0)]}},{values:['b','false'],stack}]};
 const parsed=ContractSchema.parse(c);assert.equal(resolveFillStack(parsed.anatomy.root,{mode:'a',enabled:'false'})!.paints.length,0);assert.equal(resolveFillStack(parsed.anatomy.root,{mode:'b',enabled:'true'})!.paints[0].opacity,0);
 const missing=structuredClone(c);missing.anatomy.root.fillStackByCombination!.rows.pop();assert.equal(ContractSchema.safeParse(missing).success,false);
});

test('observed binding disagreement retains full selected evidence and never becomes native binding authority',async()=>{
 const raw=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:0,boundVariables:{color:{type:'VARIABLE_ALIAS',id:'ink'}}},{type:'SOLID',color:{r:1,g:1,b:1},opacity:Math.fround(.00001)}];
 const value={r:0,g:0,b:0,a:.5},node:any={name:'Checkbox',type:'FRAME',sourceFillStack:observeFillStack(raw),variableConsumers:{ink:{name:'Ink',collectionId:'palette',modeId:'light',modeName:'Light',resolvedType:'COLOR',value,selectedValue:value}}};
 const stack=sourceFillStack(node,{},'Checkbox','default');const first=stack.paints[0];assert.equal(first.type,'SOLID');if(first.type!=='SOLID')throw Error('type');assert.equal(first.observedBinding?.resolvedBinding.consumer.modeId,'light');assert.equal(first.observedBinding?.bindingRecreated,false);assert.equal(first.unresolvedBinding,undefined);assert.equal(first.opacity,0);
 const {compileNativeFillStack}=await import('./native-fill-stack.js');assert.throws(()=>compileNativeFillStack(stack),/unresolved-binding/);
});

const flagProp={name:'show',type:'boolean' as const,bindings:{figma:{kind:'VARIANT' as const,property:'Show',values:{true:'True',false:'False'}},code:{prop:'show'}}};
const modeProp={name:'detail',type:{enum:['a','b']},bindings:{figma:{kind:'VARIANT' as const,property:'Detail',values:{a:'A',b:'B'}},code:{prop:'detail'}}};
for(const gate of ['boolean','scalar','presence','ancestor','root-boolean','root-presence'])test(`stack lookup is lazy beneath ${gate} gate on both React surfaces`,async()=>{
 const c=make('Guarded');delete c.anatomy.root.fillStack;c.props=[structuredClone(flagProp),structuredClone(modeProp)];
 const target:any={fillStackByCombination:{props:['detail'],rows:[{values:['a'],stack},{values:['b'],stack}]},parts:{Label:{text:'Gated content'}}};
 if(gate==='boolean')target.visibleWhen={prop:'show'};
 if(gate==='scalar')target.visibleWhen={prop:'detail',equals:'a'};
 if(gate==='presence')target.presenceByCombination={props:['show'],rows:[{values:['true'],present:true},{values:['false'],present:false}]};
 if(gate==='ancestor')c.anatomy.root.parts={Outer:{visibleWhen:{prop:'show'},parts:{Target:target}}};
 else if(gate.startsWith('root-')){c.anatomy.root={...c.anatomy.root,...target};if(gate==='root-boolean')c.anatomy.root.visibleWhen={prop:'show'};else c.anatomy.root.presenceByCombination={props:['show'],rows:[{values:['true'],present:true},{values:['false'],present:false}]};}
 else c.anatomy.root.parts={Target:target};
 if(gate==='root-presence'){assert.equal(ContractSchema.safeParse(c).success,false,'root presence remains an existing unsupported contract');return;}
 const parsed=ContractSchema.parse(c),scope=new Map([[c.id,parsed]]);
 for(const kind of ['module','inline']){
  const out=kind==='module'?emitReact(parsed,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:scope}):emitReactInline(parsed,{tokens,icons:new Map(),contracts:scope});
  const hidden=await ssr(c.name,out.tsx,{},gate==='scalar'?{detail:'b'}:{show:false});assert(!hidden.includes('Gated content'));assert(!hidden.includes('data-dsc-paint-index'));
  const shown=await ssr(c.name,out.tsx,{}, {show:true,detail:'a'});assert(shown.includes('Gated content'));assert.equal((shown.match(/data-dsc-paint-index=/g)||[]).length,2);
 }
});

test('positioned stack retains absolute geometry while only unpositioned owners gain a containing block',async()=>{
 const c=make('Positioned');delete c.anatomy.root.fillStack;c.anatomy.root.parts={Absolute:{declared:{position:'absolute'},literals:{width:'21px',height:'23px',left:'7px',top:'9px'},fillStack:stack}};
 const parsed=ContractSchema.parse(c),scope=new Map([[c.id,parsed]]),baseline=structuredClone(parsed);delete baseline.anatomy.root.parts!.Absolute.fillStack;
 const before=emitReact(baseline,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:new Map([[c.id,baseline]])});
 const after=emitReact(parsed,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:scope});
 const rule=(css:string)=>css.match(/\.Absolute\s*\{([^}]+)\}/)?.[1];assert(rule(after.css));assert.equal(rule(after.css),rule(before.css));assert(!after.css.includes('.Absolute { position: relative; }'));
 const inline=emitReactInline(parsed,{tokens,icons:new Map(),contracts:scope});const html=await ssr(c.name,inline.tsx);const style=html.match(/<div style="([^"]+)" data-dsc-stack-active=""/)?.[1];assert(style);const values=Object.fromEntries(style.split(';').map(v=>v.split(':')));assert.deepEqual(Object.fromEntries(['position','left','top','width','height'].map(k=>[k,values[k]])),{position:'absolute',left:'7px',top:'9px',width:'21px',height:'23px'});
 const {createFigmaEngine}=await import('./emit-figma-script.js');const engine=createFigmaEngine({tokens,icons:new Map()});const native=engine.compileComponentData(parsed,scope).variants[0].spec.children![0];const original=engine.compileComponentData(baseline,new Map([[c.id,baseline]])).variants[0].spec.children![0];assert.deepEqual(native.absolute,original.absolute);assert.deepEqual(native.lits,original.lits);
});

test('void and dynamic roots cannot be silently promoted to paint-plane hosts',()=>{
 const c=make('RefusedRoot');c.semantics.element='input';delete c.anatomy.root.parts;
 assert.throws(()=>emitReact(c,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:new Map([[c.id,c]])}),/fill-stack-react-native-host/);
 const collision=make('Collision');collision.props=[{name:'label',type:'text',bindings:{figma:{kind:'NONE'},code:{prop:'__dscFillStack'}}}];assert.throws(()=>emitReact(collision,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:new Map([[collision.id,collision]])}),/legal camelCase|fill-stack-internal-input-collision/);
 const d=make('Dynamic');d.props=[{name:'as',type:{enum:['a','b']},bindings:{figma:{kind:'VARIANT',property:'As',values:{a:'A',b:'B'}},code:{prop:'as'}}}];d.semantics.elementByProp={prop:'as',map:{a:'div',b:'span'}};
 assert.throws(()=>emitReact(d,{tokens:new Set(),tokenValues:tokens,icons:new Map(),contracts:new Map([[d.id,d]])}),/fill-stack-react-native-root/);
});

for(const callerContent of [false,true])test(`ordinary native batch writer assigns stack to the same child instance${callerContent?' with caller content':''} and verifies original asset bytes`,async()=>{
 const vm=await import('node:vm'),{createHash}=await import('node:crypto'),{createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs'),{createFigmaEngine}=await import('./emit-figma-script.js'),{nativeFillStackMatches}=await import('./native-fill-stack.js');
 const {figma}=createFigmaMock(),assets=new Map<string,Buffer>();Object.assign(figma,{fileKey:'mock-source-file',base64Decode:(s:string)=>new Uint8Array(Buffer.from(s,'base64')),createImage:(bytes:Uint8Array)=>{const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,Buffer.from(bytes));return{hash};}});
 const fileKey=figma.fileKey;assert(typeof fileKey==='string');
 const child=make('BatchChild');child.bindings.figma.anchors.fileKey=fileKey;delete child.anatomy.root.fillStack;if(callerContent)child.anatomy.root.parts={Body:{slot:{name:'content'}}};
 const parent=make('BatchParent');parent.bindings.figma.anchors.fileKey=fileKey;delete parent.anatomy.root.fillStack;parent.anatomy.root.parts={Instance:{component:{id:child.id},fillStack:stack,fillStackSource:{fileKey,setKey:'key',contractRevision:revisionOf(child)}}};
 if(callerContent){parent.anatomy.root.parts!.Instance.component!.contentSlot='content';parent.anatomy.root.parts!.Instance.parts={Caller:{text:'Caller content'}};}
 const scope=new Map([[child.id,child],[parent.id,parent]]),engine=createFigmaEngine({tokens,icons:new Map()}),childData=engine.compileComponentData(child,scope),parentData=engine.compileComponentData(parent,scope);
 await vm.runInNewContext('(async()=>{'+engine.buildBatchScript([childData,parentData],fileKey)+'})()',{figma,console:{log(){},warn(){},error(){}}});
 const owner=figma.root.findOne(n=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;assert(owner);const instances=owner.findAll(n=>n.type==='INSTANCE');assert.equal(instances.length,1);const fills=(instances[0] as any).fills;assert.equal(fills.length,2);assert.equal(fills[1].opacity,.5);if(callerContent)assert.deepEqual(owner.findAll(n=>n.type==='TEXT').map(n=>n.characters),['Caller content']);
 const spec=parentData.variants[0].spec.children!.find(n=>n.type==='instance')!;assert(spec.fillStack);assert(nativeFillStackMatches(spec.fillStack,fills,{imageBase64ByHash:Object.fromEntries([...assets].map(([key,value])=>[key,value.toString('base64')]))}));
});

test('ordinary source proposal carries an instance root stack through the same qualified child reference',()=>{
 const asset={imageHash:'original',mimeType:'image/png' as const,base64:bytes.toString('base64'),byteLength:bytes.length};
 const options={fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,imageAssets:{original:asset}};
 const childSet:any={setName:'SourceChild',type:'COMPONENT_SET',nodeId:'10:1',key:'child-key',propertyDefinitions:{Kind:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default']}},variants:[{name:'Kind=Default',type:'COMPONENT',nodeId:'10:2',variantProperties:{Kind:'Default'},componentKey:'child-main-key',bbox:{width:24,height:24},imageFill:true,imagePaints:[{index:0,imageHash:'original',scaleMode:'FILL'}],sourceFillStack:observeFillStack([{type:'IMAGE',imageHash:'original',scaleMode:'FILL'}])}]};
 const child=ContractSchema.parse(proposeFromDump(childSet,{...options,contractIdByName:new Map()}).contract);
 const rootPaint=[{type:'IMAGE',imageHash:'original',scaleMode:'FILL'},{type:'IMAGE',imageHash:'original',scaleMode:'FILL',opacity:.5}];
 const parentSet:any={setName:'SourceParent',type:'COMPONENT',nodeId:'20:1',key:'parent-key',propertyDefinitions:{},variants:[{name:'SourceParent',type:'COMPONENT',nodeId:'20:2',variantProperties:{},bbox:{width:24,height:24},children:[{name:'SourceChild',type:'INSTANCE',nodeId:'20:3',instanceOf:'SourceChild',instanceKey:'child-main-key',instanceSetKey:'child-key',componentProperties:{Kind:'Default'},instanceGeometry:{nodeId:'20:3',componentId:'10:2',transform:[[1,0,0],[0,1,0]],localSize:{width:24,height:24}},bbox:{width:24,height:24},imageFill:true,imagePaints:rootPaint.map((p,i)=>({index:i,...p})),sourceFillStack:observeFillStack(rootPaint)}]}]};
 const parent=ContractSchema.parse(proposeFromDump(parentSet,{...options,contractIdByName:new Map([['SourceChild',child.id]]),contractsById:new Map([[child.id,child]])}).contract);
 const ref=Object.values(parent.anatomy.root.parts??{}).find(p=>p.component);assert(ref);assert.equal(ref.component!.id,child.id);assert.equal(ref.fillStack?.paints.length,2);assert.equal(ref.fillStackSource?.contractRevision,revisionOf(child));
});

test('a legacy root paint input cannot compete with a source-owned whole stack',()=>{
 const child=make('ConflictChild'),parent=make('ConflictParent');delete parent.anatomy.root.fillStack;
 parent.anatomy.root.parts={Instance:{component:{id:child.id,rootOverrides:{'background-color':'{color.blue}'}},fillStack:stack,fillStackSource:{fileKey:'file',setKey:'key',contractRevision:revisionOf(child)}}};
 const result=ContractSchema.safeParse(parent);assert.equal(result.success,false);if(!result.success)assert(result.error.issues.some(i=>i.message==='fill-stack-competing-root-paint-input'));
});

test('native authored whole-fills control replaces all original planes and omission retains them',async()=>{
 const vm=await import('node:vm'),{createHash}=await import('node:crypto'),{createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs'),{createFigmaEngine}=await import('./emit-figma-script.js');
 const {figma}=createFigmaMock();Object.assign(figma,{fileKey:'mock-source-file',base64Decode:(s:string)=>new Uint8Array(Buffer.from(s,'base64')),createImage:(bytes:Uint8Array)=>({hash:createHash('sha1').update(bytes).digest('hex')})});
 const child=make('WholeFillChild');child.bindings.figma.anchors.fileKey='mock-source-file';delete child.anatomy.root.fillStack;
 child.props=[{name:'color',type:{enum:['rgba(0,0,255,1)']},bindings:{figma:{kind:'NONE'},code:{prop:'color'}}}];child.anatomy.root.parts={Surface:{fillStack:stack,shapeFillOverrideProp:'color'}};
 const parents=[false,true].map(supplied=>{const p=make(supplied?'WholeFillSupplied':'WholeFillOmitted');p.bindings.figma.anchors.fileKey='mock-source-file';delete p.anatomy.root.fillStack;p.anatomy.root.parts={Instance:{component:{id:child.id,...(supplied?{props:{color:'rgba(0,0,255,1)'}}:{})}}};return p;});
 const scope=new Map([child,...parents].map(c=>[c.id,c])),engine=createFigmaEngine({tokens,icons:new Map()}),data=[child,...parents].map(c=>engine.compileComponentData(c,scope));
 await vm.runInNewContext('(async()=>{'+engine.buildBatchScript(data,'mock-source-file')+'})()',{figma,console:{log(){},warn(){},error(){}}});
 for(const [i,parent]of parents.entries()){const owner=figma.root.findOne(n=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id)!;assert(owner);const instances=owner.findAll(n=>n.type==='INSTANCE');assert.equal(instances.length,1);const targets=instances[0].findAll(n=>n.getSharedPluginData('ds_contracts','shapeFillOverride')===child.id+':color');assert.equal(targets.length,1);const paints=(targets[0] as any).fills;assert.equal(paints.length,i===1?1:2);if(i===1)assert.deepEqual({...paints[0].color},{r:0,g:0,b:1});}
});
