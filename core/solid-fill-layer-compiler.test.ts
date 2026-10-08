import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createFigmaEngine} from './emit-figma-script.js';
import {planSolidFillBindingTokens} from './solid-fill-binding-tokens.js';
import {qualifySolidFillColorBinding} from '../extract/figma/solid-fill-binding.js';
import {verifyBoundFillLayerReadback} from './solid-fill-layer-observation.js';

function fixture(){
  const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
  c.id='qualification.bound-fill-compiler';c.name='BoundFillCompiler';c.props=[];c.states=[];delete c.a11y;c.semantics={element:'div'};
  c.anatomy={root:{layout:{display:'flex',direction:'row',reversePaint:true},literals:{width:'40px',height:'40px'},
    solidFillComposition:{color:{r:.25,g:.5,b:.75},opacity:.5,blendMode:'MULTIPLY'},solidFillCompositionToken:'paint.alpha',
    parts:{ink:{element:'div',declared:{position:'absolute'},literals:{left:'12px',top:'12px',width:'8px',height:'8px','background-color':'#ff0000'}}}}};
  const tokens={primitives:{paint:{alpha:{$type:'color',$value:'rgba(63.75,127.5,191.25,.5)'}}} as Record<string,any>,semantic:{},light:{},dark:{},brands:{default:{}}};
  const paint=c.anatomy.root.solidFillComposition,value={...paint.color,a:paint.opacity};
  const binding=qualifySolidFillColorBinding({variableId:'paint-alpha',paint},{'paint-alpha':{name:'paint/alpha',collectionId:'paint',modeId:'base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}});
  const plan=planSolidFillBindingTokens([binding]);
  tokens.primitives=plan.tokens;
  c.anatomy.root.solidFillCompositionToken=plan.requestedTokenPaths[0];
  c.anatomy.root.solidFillCompositionSourceBinding=[{owner:'root',nodeName:'BoundFillCompiler',variantName:'Default',binding}];
  return {c,tokens,contracts:new Map([[c.id,c]])};
}

test('compiler writes a proven bound receiver after content and refuses missing provenance',async()=>{
  const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
  for(const nested of [false,true]){
    const f=fixture();
    if(nested){const part=f.c.anatomy.root;f.c.anatomy.root={literals:{width:'40px',height:'40px'},parts:{body:part}};}
    const engine=createFigmaEngine({tokens:f.tokens,icons:new Map()});
    const part=nested?f.c.anatomy.root.parts.body:f.c.anatomy.root;
    const proof=part.solidFillCompositionSourceBinding;
    delete part.solidFillCompositionSourceBinding;
    assert.throws(()=>engine.compileComponentData(f.c,f.contracts));
    assert.throws(()=>engine.buildComponentScript(f.c,f.contracts));
    part.solidFillCompositionSourceBinding=proof;
    const {figma}:any=createFigmaMock();
    const script=engine.buildComponentScriptDraftPaintQualification(f.c,f.contracts,figma.fileKey,f.tokens.primitives);
    const result=await vm.runInNewContext('(async()=>{'+script+'})()', {figma,console:{log(){},warn(){},error(){}}});
    assert.equal(result.createdNodeIds.length,1);
    const root=await figma.getNodeByIdAsync(result.createdNodeIds[0]);
    const host=nested?root.children.find((n:any)=>n.name==='body'):root;
    const layer=host.children.find((n:any)=>n.name==='[ds-contracts bound paint]');
    assert(layer);assert.equal(host.children.at(-1),layer);
    assert.deepEqual(JSON.parse(JSON.stringify(host.fills)),[]);
    const variable=await figma.variables.getVariableByIdAsync(layer.fills[0].boundVariables.color.id);
    assert.equal(variable.name,part.solidFillCompositionToken.replaceAll('.','/'));assert.equal(variable.resolveForConsumer(layer).value.a,.5);
    assert.equal(layer.opacity,1);assert.equal(layer.blendMode,'MULTIPLY');
    assert.deepEqual([host.width,host.height,layer.width,layer.height],[40,40,40,40]);
  }
});

test('bound compiler refuses token value disagreement and replaced source alias graphs',()=>{
  const f=fixture(),paint=f.c.anatomy.root.solidFillComposition,value={...paint.color,a:paint.opacity};
  const binding=qualifySolidFillColorBinding({variableId:'semantic',paint},{semantic:{name:'paint',collectionId:'theme',modeId:'light',modeName:'Light',resolvedType:'COLOR',value,selectedValue:{type:'VARIABLE_ALIAS',id:'primitive'},aliasChain:[{id:'primitive',name:'base',collectionId:'base',modeId:'base',modeName:'Base',resolvedType:'COLOR',value,selectedValue:value}]}});
  const plan=planSolidFillBindingTokens([binding]);
  f.tokens.primitives=plan.tokens;f.c.anatomy.root.solidFillCompositionToken=plan.requestedTokenPaths[0];
  f.c.anatomy.root.solidFillCompositionSourceBinding=[{owner:'root',nodeName:'BoundFillCompiler',variantName:'Default',binding}];
  const build=()=>createFigmaEngine({tokens:f.tokens,icons:new Map()}).buildComponentScriptDraftPaintQualification(f.c,f.contracts,'file',f.tokens.primitives);
  assert.doesNotThrow(build);
  const key=plan.requestedTokenPaths[0].split('.')[1],saved=f.tokens.primitives.sourcePaint[key];
  f.tokens.primitives.sourcePaint[key]={$type:'color',$value:'rgba(63.75,127.5,191.25,.5)'};
  assert.throws(build,/source-token-graph-disagreement/,'equal-valued literal cannot replace an observed alias');
  f.tokens.primitives.sourcePaint[key]=saved;
  f.c.anatomy.root.solidFillCompositionToken='other.paint';assert.throws(build,/source-token-identity/);
  const g=fixture();const gkey=g.c.anatomy.root.solidFillCompositionToken.split('.')[1];g.tokens.primitives.sourcePaint[gkey].$value='rgba(63.75,127.5,191.25,.25)';
  assert.throws(()=>createFigmaEngine({tokens:g.tokens,icons:new Map()}).buildComponentScriptDraftPaintQualification(g.c,g.contracts),/source-token-graph-disagreement|token-value-disagreement/);
});

test('compiler-generated live receiver independently verifies',()=>{
  const observed=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-layer-readback/COMPILED.json',import.meta.url),'utf8'));
  assert.deepEqual(verifyBoundFillLayerReadback(observed.expected,observed.receipt),{status:'bound-fill-layer-observed'});
});

test('post-layout sizing repairs fractional receivers only in the stamped subtree',async()=>{
  const {BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME}=await import('./solid-fill-composition-native.js');
  const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
  const figma:any=createFigmaMock().figma;
  const {apply,settle}=new Function('figma',BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME+';return {apply:applyBoundSolidFillLayer,settle:settleBoundSolidFillLayers};')(figma);
  const collection=figma.variables.createVariableCollection('Fractional paint');
  const variable=figma.variables.createVariable('paint',collection,'COLOR');
  variable.setValueForMode(collection.defaultModeId,{r:.25,g:.5,b:.75,a:.5});
  const spec={solidFillComposition:{color:{r:.25,g:.5,b:.75},opacity:.5,blendMode:'MULTIPLY'},solidFillCompositionToken:'paint.alpha'};
  const root=figma.createComponent(),host=figma.createFrame(),other=figma.createFrame();root.appendChild(host);
  host.resize(85,10);other.resize(85,10);
  const layer=apply(host,spec,variable),unrelated=apply(other,spec,variable);
  host.resizeWithoutConstraints(Math.fround(256/3),10);other.resizeWithoutConstraints(123.5,10);
  settle(root);
  assert.equal(layer.width,host.width);assert.equal(layer.height,host.height);
  assert.equal(unrelated.width,85,'a different component is not mutated');
  assert.deepEqual([layer.x,layer.y],[0,0]);
});

test('all four actual Carbon receivers satisfy the exact independent verifier after layout',()=>{
  const rows=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-layer-readback/CARBON.json',import.meta.url),'utf8'));
  assert.equal(rows.length,4);
  for(const row of rows)assert.deepEqual(verifyBoundFillLayerReadback(row.expected,row.receipt),{status:'bound-fill-layer-observed'});
  assert(rows.some((row:any)=>!Number.isInteger(row.expected.width)));
});
