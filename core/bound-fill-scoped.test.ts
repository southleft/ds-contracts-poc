import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFigmaEngine} from './emit-figma-script.js';
import {verifyNativePreparedLibraryReadback} from './native-source-observation.js';
import {BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME} from './solid-fill-composition-native.js';

const evidence=JSON.parse(readFileSync(new URL('./fixtures/bound-fill-scoped/CARBON.json',import.meta.url),'utf8'));
test('actual scoped Carbon allocation and independent inventory verify against current compiler output',()=>{
 const e=structuredClone(evidence),engine=createFigmaEngine({tokens:e.tokens,icons:new Map()}),contracts=new Map([[e.c.id,e.c]]);
 assert.deepEqual(engine.compileNativePreparedLibrary(e.c,contracts,e.source,e.operation.id),engine.compileNativePreparedLibraryDraftPaintQualification(e.c,contracts,e.source,e.operation.id));
 const compiled=engine.compileNativePreparedLibraryDraftPaintQualification(e.c,contracts,e.source,e.operation.id);
 assert.deepEqual(JSON.parse(JSON.stringify(compiled.components)),e.input.graphComponents);
 assert(compiled.boundNames.includes(e.c.anatomy.root.solidFillCompositionToken.replaceAll('.','/')));
 const layers=e.receipt.nodes.filter((n:any)=>n.name==='[ds-contracts bound paint]');
 assert.equal(layers.length,4);
 for(const layer of layers)assert(e.input.creation.nodes.some((n:any)=>n.id===layer.id&&n.type==='RECTANGLE'));
 const result=verifyNativePreparedLibraryReadback(e.input,e.receipt);
 assert.equal(result.status,'supported-structure-observed',JSON.stringify(result));
 assert.equal(result.acceptedContract,null);
 for(const mutate of [
  (r:any)=>{r.nodes.find((n:any)=>n.name==='[ds-contracts bound paint]').metadata.nativeSourceOperation='{}';},
  (r:any)=>{r.nodes.find((n:any)=>n.name==='[ds-contracts bound paint]').values.width-=.25;},
  (r:any)=>{r.nodes.find((n:any)=>n.name==='[ds-contracts bound paint]').values.fills[0].boundVariables.color.id='redirected';},
 ]){const changed=structuredClone(e.receipt);mutate(changed);assert.notEqual(verifyNativePreparedLibraryReadback(e.input,changed).status,'supported-structure-observed');}
 const missing=structuredClone(e.input);missing.creation.nodes=missing.creation.nodes.filter((n:any)=>n.id!==layers[0].id);
 assert.notEqual(verifyNativePreparedLibraryReadback(missing,e.receipt).status,'supported-structure-observed');
});

test('scoped receiver registration happens before layer mutations and host paint removal',async()=>{
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');const figma:any=createFigmaMock().figma;
 const host=figma.createFrame();host.resize(40,20);const prior=JSON.stringify(host.fills);
 const collection=figma.variables.createVariableCollection('Owned layer');const variable=figma.variables.createVariable('paint',collection,'COLOR');variable.setValueForMode(collection.defaultModeId,{r:1,g:1,b:1,a:.5});
 const apply=new Function('figma',BOUND_SOLID_FILL_LAYER_NATIVE_RUNTIME+';return applyBoundSolidFillLayer;')(figma);
 let registered:any;
 assert.throws(()=>apply(host,{solidFillComposition:{color:{r:1,g:1,b:1},opacity:.5,blendMode:'MULTIPLY'},solidFillCompositionToken:'paint'},variable,(layer:any)=>{registered=layer;throw Error('registration-refused');}),/registration-refused/);
 assert(registered);assert.notEqual(registered.name,'[ds-contracts bound paint]');assert.equal(JSON.stringify(host.fills),prior);assert.equal(host.children.length,0);
 registered.remove();
});
