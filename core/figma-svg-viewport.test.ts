import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine, type NodeSpec} from './emit-figma-script.js';

function compile(svg:string,size?:number) {
 const contract=ContractSchema.parse({id:'test.svg-viewport',name:'ViewportProbe',description:'SVG viewport preserves authored stroke scaling',version:'0.1.0',status:'draft',archetype:'none',props:[],states:[],semantics:{element:'div'},
  anatomy:{root:{layout:{display:'flex'},parts:{glyph:{icon:{asset:'glyph',...(size===undefined?{}:{size})},literals:{color:'#0a0a0a'}}}}},
  bindings:{code:{anchors:{importPath:'test',export:'ViewportProbe'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map([['glyph',svg]])});
 const root=engine.compileComponentData(contract,new Map([[contract.id,contract]])).variants[0].spec;
 const all=(n:NodeSpec):NodeSpec[]=>[n,...(n.children??[]).flatMap(all)];
 return all(root).find(n=>n.type==='svg')!;
}
const path='<path d="M20 6L9 17L4 12" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round"/>';
for(const attrs of ['', 'width="24"', "width='24' height='24'", 'width="24" height="24"']) {
 test(`import the declared icon viewport before native scaling: ${attrs||'viewBox only'}`,()=>{
  const icon=compile(`<svg ${attrs} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${path}</svg>`,14);
  const tag=icon.svg!.match(/^<svg\b[^>]*>/)![0];
  assert.equal(icon.iconSize,14);
  assert.equal((tag.match(/\swidth=/g)??[]).length,1);assert.match(tag,/\swidth="14"/);
  assert.equal((tag.match(/\sheight=/g)??[]).length,1);assert.match(tag,/\sheight="14"/);
  assert.match(icon.svg!,/viewBox="0 0 24 24"/);
  assert.match(icon.svg!,/stroke-width="2"/,'viewport transforms the stroke; its authored user-unit weight stays intact');
  assert.match(icon.svg!,/stroke="#0a0a0a"/);assert.match(icon.svg!,/fill="none"/);
 });
}
test('rectangular authored viewBox and alignment survive the square icon viewport',()=>{
 const icon=compile(`<svg viewBox="2 3 24 12" preserveAspectRatio="xMinYMid meet">${path}</svg>`,18);
 assert.match(icon.svg!,/viewBox="2 3 24 12"/);assert.match(icon.svg!,/preserveAspectRatio="xMinYMid meet"/);
 assert.match(icon.svg!,/width="18"/);assert.match(icon.svg!,/height="18"/);
});
test('an icon without a declared size retains its authored viewport',()=>{
 const icon=compile(`<svg width="24" height="12" viewBox="0 0 24 12">${path}</svg>`);
 assert.match(icon.svg!,/width="24"/);assert.match(icon.svg!,/height="12"/);
});
