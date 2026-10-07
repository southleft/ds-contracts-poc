import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {walkAnatomy,ContractSchema} from '../scripts/contract-schema.js';
import {composedFillHiddenChild} from '../packages/core/src/anatomy.js';
import {solidFillCompositionRules} from '../packages/core/src/css.js';
import {readFileSync} from 'node:fs';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
test('captured permanently hidden text stays hidden while a Boolean visibility binding stays editable',()=>{
 for(const bound of [false,true]){
  const set:any={setName:'Visibility',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default']},...(bound?{Show:{type:'BOOLEAN',defaultValue:false}}:{})},variants:[{name:'Mode=Default',variantProperties:{Mode:'Default'},type:'COMPONENT',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Label',type:'TEXT',hidden:true,...(bound?{propRefs:{visible:'Show'}}:{}),text:{characters:'Hidden label',fontSize:14,fontStyle:'Regular',lineHeight:18}}]}]};
  const before=JSON.stringify(set),r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map()}),c=ContractSchema.parse(r.contract);
  const part=walkAnatomy(c).find(x=>x.part.text==='Hidden label'||x.part.content)?.part;assert(part);
  assert.equal(part.declared?.display,bound?undefined:'none');
  if(bound)assert(part.visibleWhen);
  assert.equal(JSON.stringify(set),before);
 }
});
test('conditional display requires foreground stacking instead of the permanently hidden exemption',()=>{
 const c=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 c.props=[];c.states=[];c.semantics={element:'div'};
 const child:any={text:'Hidden',declared:{display:'none'}};
 c.anatomy={root:{solidFillComposition:{color:{r:1,g:1,b:1},opacity:0.5,blendMode:'MULTIPLY'},parts:{child}}};
 assert(composedFillHiddenChild(child));assert.doesNotThrow(()=>solidFillCompositionRules(c));
 for(const extra of [{declaredStates:{hover:{display:'block'}}},{stylesWhen:[{prop:'show',equals:'true',styles:{display:'block'}}]},{literals:{display:'block'}},{visibilityOverrideProp:'show'}]){
  c.anatomy.root.parts.child={...child,...extra};assert(!composedFillHiddenChild(c.anatomy.root.parts.child));
  assert.match(solidFillCompositionRules(c).join('\n'),/\.child \{\n  position: relative;/);
  c.anatomy.root.parts.child.declared={...c.anatomy.root.parts.child.declared,position:'static'};
  assert.throws(()=>solidFillCompositionRules(c),/child-stacking-unqualified/);
 }
});
test('Carbon hidden columns retain their own visibility instead of becoming a visible repeat',()=>{
 const set=JSON.parse(readFileSync(new URL('./fixtures/hidden-repeat/structured-list.json',import.meta.url),'utf8'));
 const before=JSON.stringify(set),r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),fileKey:'A451UfD58U7XU21FzaqfHL',drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 const parts=c.anatomy.root.parts!;
 for(const key of ['col6','col7','col8'])if(parts[key]){assert.equal(parts[key].declared?.display,'none');assert.equal(parts[key].repeat,undefined);}
 assert(r.notes.some(note=>note.includes('repeat-visibility-not-uniform')));
 assert(!Object.values(parts).some(part=>part.repeat));
 for(const key of ['col1','col2','col3','col4','col5'])assert.notEqual(parts[key].declared?.display,'none');
 assert.equal(JSON.stringify(set),before);
});
test('Primer loading hides dormant slots through presence instead of styling consumer content',()=>{
 const dump=JSON.parse(readFileSync(new URL('./fixtures/hidden-repeat/primer-loading.json',import.meta.url),'utf8'));
 const set:any=Object.values(dump)[0],before=JSON.stringify(set);
 const r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 const dormant=walkAnatomy(c).filter(({part})=>part.slot&&part.presenceByCombination?.rows.every(row=>!row.present));
 assert(dormant.length>0);
 for(const {part}of dormant){assert.equal(part.declared,undefined);assert(part.presenceByCombination!.rows.length>0);}
 assert.equal(JSON.stringify(set),before);
});

test('leaf rectangle inside strokes retain a separate foreground ring over composed fill',async t=>{
 const {chromium}=await import('playwright-core');
 const {PNG}=await import('pngjs');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));
 base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 base.anatomy={root:{strokesIncludedInLayout:false,literals:{width:'20px',height:'20px','border-top-width':'0px','border-right-width':'0px','border-bottom-width':'2px','border-left-width':'0px','border-color':'#0000ff80'},solidFillComposition:{color:{r:1,g:0,b:0},opacity:.5,blendMode:'MULTIPLY'}}};
 const c=ContractSchema.parse(base),browser=await chromium.launch();t.after(()=>browser.close());
 const context={contracts:new Map([[c.id,c]]),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,context),page=await browser.newPage();
  const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  await render({});const image=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
  assert.deepEqual([image.width,image.height],[20,20]);
  const pixel=(x:number,y:number)=>[...image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4)];
  assert.deepEqual(pixel(10,10),[255,0,0,128]);
  const edge=pixel(10,19);for(const [i,expected]of [85,0,170,192].entries())assert(Math.abs(edge[i]-expected)<=1,JSON.stringify(edge));
  await page.close();
 }
});

test('only leaf inside-stroked rectangles derive the non-layout composed-paint carrier',()=>{
 const rectangle:any={name:'Background',type:'RECTANGLE',nodeId:'rect',fixedSize:{width:20,height:20},
  stroke:{hex:'0000ff',alpha:.5},strokeAlign:'INSIDE',strokeWeights:{top:0,right:0,bottom:2,left:0},
  sourceFillComposition:{paint:{color:{r:1,g:0,b:0},opacity:.5,blendMode:'MULTIPLY'}}};
 const set:any={setName:'StrokePaint',type:'COMPONENT',variants:[{name:'StrokePaint',type:'COMPONENT',children:[rectangle]}]};
 const before=JSON.stringify(set),r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(r.contract),part=Object.values(c.anatomy.root.parts!)[0];
 assert.equal(part.strokesIncludedInLayout,false);assert(part.solidFillComposition);
 assert(r.notes.some(n=>n.includes('source auto-layout flag was not inferred')));
 assert.equal(JSON.stringify(set),before);
 for(const change of [{type:'FRAME'},{strokeAlign:'CENTER'},{strokesIncludedInLayout:true}]){
  const bad=structuredClone(set);Object.assign(bad.variants[0].children[0],change);
  assert.throws(()=>proposeFromDump(bad,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map()}));
 }
});
