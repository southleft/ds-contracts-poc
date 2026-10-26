import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
import {fillStackVariableIds,observeFillStack} from './fill-stack-observation.js';
import {collectRestImageAssets,restImagePaints} from './rest/image-assets.js';
import {mapRestToDump,REST_DUMP_VERSION,type RestNode,type RestPaint} from './rest/map.js';
import {PLUGIN_DUMP_VERSION,type DumpFile,type DumpSet} from './types.js';

const source = readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const start = source.indexOf('// BEGIN SHARED FILL STACK OBSERVATION');
const end = source.indexOf('// END SHARED FILL STACK OBSERVATION');
assert(start >= 0 && end > start);
const pluginHelpers = vm.runInNewContext(`(()=>{${source.slice(start,end)};return {observeFillStack,fillStackVariableIds};})()`);
const plain = <T>(value:T):T => JSON.parse(JSON.stringify(value));
const png = readFileSync(new URL('./fixtures/native-group-plane/18x18.png',import.meta.url));
const imageHash = createHash('sha1').update(png).digest('hex');
const nativePaints = () => [
  {type:'SOLID',color:{r:.25,g:.5,b:.75},opacity:0,visible:true,boundVariables:{color:{type:'VARIABLE_ALIAS',id:'hidden-color'}}},
  {type:'IMAGE',imageHash,visible:false,scaleMode:'CROP',imageTransform:[[.5,0,.25],[0,.5,.125]],filters:{contrast:.3},blendMode:'MULTIPLY',unknown:null},
  {type:'GRADIENT_RADIAL',visible:false,gradientStops:[{position:0,color:{r:1,g:0,b:0,a:.5},boundVariables:{color:{type:'VARIABLE_ALIAS',id:'gradient-stop'}}}],unsupported:{flags:[false,0,null],imageRef:'nested-must-not-rename'}},
  {type:'SOLID',color:{r:1,g:1,b:1,a:0},blendMode:'SCREEN',extra:{nested:['raw',4]}}
];
const restPaints = () => nativePaints().map(paint => {
  const copy = structuredClone(paint) as Record<string,unknown>;
  if (Object.hasOwn(copy,'imageHash')) { copy.imageRef=copy.imageHash; delete copy.imageHash; }
  return copy as unknown as RestPaint;
});

test('source arrays retain empty/single completeness and distinguish absent or mixed fills',()=>{
  for (const paints of [[],[{type:'SOLID'}]]) {
    const expected={version:1,order:'bottom-to-top',complete:true,paints:paints.map((paint,index)=>({index,paint}))};
    assert.deepEqual(observeFillStack(paints),expected);
    assert.deepEqual(plain(pluginHelpers.observeFillStack(paints)),expected);
  }
  for (const input of [undefined,null,Symbol('mixed'),{},'unreadable']) {
    assert.equal(observeFillStack(input),undefined);
    assert.equal(pluginHelpers.observeFillStack(input),undefined);
  }
});

test('raw source stacks preserve every hidden, alpha-zero and unsupported paint without aliases',()=>{
  const paints=nativePaints(),before=structuredClone(paints),observed=observeFillStack(paints)!;
  assert.deepEqual(observed,{version:1,order:'bottom-to-top',complete:true,paints:paints.map((paint,index)=>({index,paint}))});
  assert.deepEqual(plain(pluginHelpers.observeFillStack(paints)),observed);
  const image=observed.paints[1].paint as typeof paints[1];
  image.imageTransform![0][0]=99;
  (observed.paints[2].paint as typeof paints[2]).unsupported!.flags[0]=true;
  assert.deepEqual(paints,before,'nested transforms and unknown fields are deep copies');
});

test('REST normalizes only the top-level image reference and matches the native stack shape',()=>{
  const native=observeFillStack(nativePaints()),rest=observeFillStack(restPaints(),'rest');
  assert.deepEqual(rest,native);
  assert.deepEqual(plain(pluginHelpers.observeFillStack(restPaints(),'rest')),native);
  const source={type:'IMAGE',imageRef:'rest',imageHash:'unrecognized-extra',explicit:undefined};
  const observed=observeFillStack([source],'rest')!.paints[0].paint as Record<string,unknown>;
  assert.deepEqual(observed,source,'colliding unknown data is retained rather than overwritten');
  assert(Object.hasOwn(observed,'explicit'));
  assert(!Object.hasOwn(observeFillStack([{type:'IMAGE'}],'rest')!.paints[0].paint as object,'imageHash'));
});

test('all per-paint bindings are collected, including hidden and nested unsupported paints',()=>{
  const paints=nativePaints();
  (paints[3] as any).boundVariables={color:{type:'VARIABLE_ALIAS',id:'hidden-color'},future:[{type:'VARIABLE_ALIAS',id:'future-channel'}]};
  (paints[3] as any).unbound={type:'VARIABLE_ALIAS',id:'not-a-paint-binding'};
  (paints[3] as any).boundVariables.invalid={type:'OTHER_ALIAS',id:'not-a-variable'};
  const stack=observeFillStack(paints)!;
  const expected=['hidden-color','gradient-stop','future-channel'];
  assert.deepEqual(fillStackVariableIds(stack),expected);
  assert.deepEqual(plain(pluginHelpers.fillStackVariableIds(stack)),expected);
});

function restFixture(fills=restPaints()):RestNode {
  return {id:'1:1',name:'FillStackProbe',type:'COMPONENT',fills:[],children:[
    {id:'1:2',name:'Main paint',type:'RECTANGLE',fills},
    {id:'1:3',name:'Nested',type:'INSTANCE',componentId:'main:nested',children:[
      {id:'1:4',name:'Host paint',type:'RECTANGLE',fills:structuredClone(fills)}
    ],overrides:[{id:'1:4',overriddenFields:['fills']}]}
  ]};
}

test('REST maps complete stacks on nodes and elided host overrides without inventing consumer modes',()=>{
  const node=restFixture(),before=structuredClone(node);
  const {dump,report}=mapRestToDump({name:'Source',nodes:{'1:1':{document:node}}});
  const root=(dump.FillStackProbe as DumpSet).variants[0];
  assert.deepEqual(root.sourceFillStack,observeFillStack([]));
  assert.deepEqual(root.children![0].sourceFillStack,observeFillStack(nativePaints()));
  assert.deepEqual(root.children![1].hostOverrides![0].sourceFillStack,root.children![0].sourceFillStack);
  assert.equal(root.children![0].variableConsumers,undefined);
  assert.equal(root.children![1].hostOverrides![0].variableConsumers,undefined);
  for(const id of ['hidden-color','gradient-stop'])
    assert.equal(report.degradations.filter(d=>d.code==='variable-unresolved' && d.message.includes(id)).length,2,'one observation for each distinct main/host node, including the previously unseen hidden binding');
  assert.deepEqual(root.children![0].imagePaints,restImagePaints(restPaints()),'legacy visible image projection is unchanged');
  assert.deepEqual(node,before);
  assert.equal(dump._provenance?.dumpVersion,REST_DUMP_VERSION);
});

test('REST asset collection includes hidden images held only by a host source stack and deduplicates',async()=>{
  const stack=observeFillStack(restPaints(),'rest')!;
  const dump={probe:{variants:[{name:'Default',hostOverrides:[{path:'Only host',fields:['fills'],sourceFillStack:stack}]}]}} as unknown as DumpFile;
  let reads=0;
  const assets=await collectRestImageAssets(dump,async()=>({meta:{images:{[imageHash]:'https://s3-alpha.figma.com/original'}}}),async()=>{reads++;return new Response(png);});
  assert.equal(reads,1);
  const asset=assets[imageHash];assert('base64' in asset);
  assert.equal(asset.base64,png.toString('base64'));
});

test('canonical plugin captures node and host stacks, hidden image bytes and actual binding consumers',async()=>{
  const {figma:mock}=createFigmaMock({consumerVariableModes:true});const figma:any=mock;
  const collection=figma.variables.createVariableCollection('Paint modes');
  const mode=collection.modes[0].modeId;
  const ink=figma.variables.createVariable('hidden-color',collection,'COLOR');
  ink.setValueForMode(mode,{r:.25,g:.5,b:.75,a:1});
  const paints=nativePaints();
  (paints[0] as any).boundVariables.color.id=ink.id;
  // No variable exists for the unsupported gradient stop: no mode may be invented.
  const main=figma.createComponent();main.name='Nested main';
  const target=figma.createRectangle();target.name='Host paint';target.fills=paints;main.appendChild(target);
  const root=figma.createComponent();root.name='FillStackProbe';root.fills=[];root.setExplicitVariableModeForCollection(collection,mode);
  const own=figma.createRectangle();own.name='Main paint';own.fills=structuredClone(paints);root.appendChild(own);
  const instance=main.createInstance();instance.name='Nested';root.appendChild(instance);
  instance.overrides=[{id:instance.children[0].id,overriddenFields:['fills']}];
  figma.currentPage.appendChild(root);
  let reads=0;
  figma.getImageByHash=(hash:string)=>{assert.equal(hash,imageHash);return{async getBytesAsync(){reads++;return png;}};};
  figma.base64Encode=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64');
  const before=structuredClone(own.fills);
  const scoped=source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["FillStackProbe"];');
  const dump=plain(await vm.runInNewContext(`(async()=>{${scoped}\n})()`,{figma,console:{log(){},warn(){},error(){}}})) as DumpFile;
  const captured=(dump.FillStackProbe as DumpSet).variants[0],ownOut=captured.children![0],host=captured.children![1].hostOverrides![0];
  assert.deepEqual(captured.sourceFillStack,observeFillStack([]));
  assert.deepEqual(ownOut.sourceFillStack,observeFillStack(paints));
  assert.deepEqual(host.sourceFillStack,ownOut.sourceFillStack);
  assert.equal(ownOut.imagePaints,undefined,'hidden IMAGE remains excluded from the legacy channel');
  assert.equal(ownOut.variableConsumers![ink.id].modeId,mode);
  assert.equal(host.variableConsumers![ink.id].modeId,mode);
  assert.equal(ownOut.variableConsumers!['gradient-stop'],undefined);
  assert.equal(reads,1,'shared hidden image asset is read once');
  const asset=dump._imageAssets![imageHash];assert('base64' in asset);
  assert.equal(asset.base64,png.toString('base64'));
  assert.deepEqual(own.fills,before);
  assert.equal(dump._provenance?.dumpVersion,PLUGIN_DUMP_VERSION);
});
