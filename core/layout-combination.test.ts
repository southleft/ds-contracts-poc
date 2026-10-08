import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema, resolveLayout, reachablePresenceTupleKeys} from '../scripts/contract-schema.js';
import {emitReact, validateContract} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {mountGenerated} from './react-test-runtime.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(){return ContractSchema.parse({id:'probe.joint',name:'JointProbe',version:'1.0.0',archetype:'none',description:'Multi-axis layout',semantics:{element:'div'},states:[],
 props:['tone','size'].map(name=>({name,type:{enum:['a','b']},default:'a',bindings:{code:{prop:name},figma:{kind:'VARIANT',property:name,values:{a:'A',b:'B'}}}})),
 anatomy:{root:{layout:{display:'flex',direction:'row',align:'start'},literals:{width:'100px',height:'30px'},layoutByCombination:{props:['tone','size'],rows:[['a','a'],['a','b'],['b','a'],['b','b']].map(values=>({values,layout:{direction:'row',justify:'start',align:values.every(v=>v==='b')?'center':'start'}}))},parts:{child:{literals:{width:'10px',height:'10px','background-color':'#6750a4'}}}}},bindings:{code:{anchors:{importPath:'./JointProbe',export:'JointProbe'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});}
function errors(c:ReturnType<typeof fixture>){const out:string[]=[];validateContract(c,new Map([[c.id,c]]),out,new Map());return out;}
test('complete joint layout agrees in both React renderers and native compilation',async()=>{
 const c=fixture();assert.deepEqual(errors(c),[]);const root=c.anatomy.root!;
 assert.equal(resolveLayout(root,{tone:'b',size:'b'})?.align,'center');
 assert.equal(resolveLayout(root,{tone:'b',size:'a'})?.align,'start');
 const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,4);
 assert.equal(native.variants.filter(v=>v.spec.layout?.counter==='CENTER').length,1);
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const code=inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,code.tsx,code.css);
   for(const row of root.layoutByCombination!.rows){await render(Object.fromEntries(['tone','size'].map((p,i)=>[p,row.values[i]])));
    const actual=await page.locator('#root > *').evaluate(n=>{const child=n.firstElementChild!;return {align:getComputedStyle(n).alignItems,y:child.getBoundingClientRect().y-n.getBoundingClientRect().y};});
    assert.deepEqual(actual,{align:row.layout.align==='center'?'center':'flex-start',y:row.layout.align==='center'?10:0});
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
});
test('joint layout refuses incomplete, duplicate, unknown and foreign-owned tables',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.layoutByCombination.rows.pop(),
  (c:any)=>c.anatomy.root.layoutByCombination.rows.push(c.anatomy.root.layoutByCombination.rows[0]),
  (c:any)=>c.anatomy.root.layoutByCombination.props[0]='missing',
  (c:any)=>c.anatomy.root.component={id:'foreign'},
 ]){const c=fixture();change(c);assert(errors(c).some(e=>e.includes('layoutByCombination')));}
});

test('proposer carries a complete observed tuple and refuses conflicting evidence',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const dump:any={setName:'JointObserved',type:'COMPONENT_SET',propertyDefinitions:Object.fromEntries(['Tone','Size'].map(p=>[p,{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}])),variants:[['A','A'],['A','B'],['B','A'],['B','B']].map(([Tone,Size])=>({name:`Tone=${Tone}, Size=${Size}`,type:'COMPONENT',variantProperties:{Tone,Size},layout:{mode:'HORIZONTAL',primary:'MIN',counter:Tone==='B'&&Size==='B'?'CENTER':'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},fixedSize:{width:100,height:30},children:[{name:'mark',type:'RECTANGLE',shape:{kind:'rect',width:10,height:10}}]}))};
 const options={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,contractIdByName:new Map<string,string>()};
 const good=proposeFromDump(dump,options);const c=ContractSchema.parse(good.contract);
 assert.equal(c.anatomy.root.layoutByCombination?.rows.length,4);
 const conflict=structuredClone(dump.variants[3]);conflict.layout.counter='MIN';dump.variants.push(conflict);
 assert.throws(()=>proposeFromDump(dump,options), /duplicates tuple/);
});

test('nested boolean layout uses exact false and true planes in both React renderers',async()=>{
 const c=fixture();
 c.props[0]={name:'tone',type:'boolean',default:false,bindings:{code:{prop:'tone'},figma:{kind:'VARIANT',property:'Tone',values:{true:'True',false:'False'}}}};
 const table=c.anatomy.root.layoutByCombination!;
 for(const row of table.rows)row.values[0]=row.values[0]==='a'?'false':'true';
 const container=c.anatomy.root;c.anatomy.root={layout:{display:'flex'},parts:{container}};
 assert.deepEqual(errors(c),[]);
 const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const code=inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,code.tsx,code.css);
   for(const row of table.rows){await render({tone:row.values[0]==='true',size:row.values[1]});
    const y=await page.locator('#root > * > *').evaluate(n=>n.firstElementChild!.getBoundingClientRect().y-n.getBoundingClientRect().y);
    assert.equal(y,row.layout.align==='center'?10:0);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
});

for(const gate of ['joint','single'] as const)test(`joint layout covers exactly the declared drawn ${gate} presence domain`,async()=>{
 const {validateContract:validate}=await import('../packages/core/src/validate.js');
 const c=fixture();
 c.bindings.figma.drawnVariants=[{tone:'a',size:'a'},{tone:'a',size:'b'},{tone:'b',size:'b'}];
 if(gate==='joint')c.anatomy.root.presenceByCombination={props:['tone','size'],rows:[{values:['a','a'],present:false},{values:['a','b'],present:true},{values:['b','b'],present:true}]};
 else c.anatomy.root.visibleWhen={prop:'size',equals:['b']};
 c.anatomy.root.layoutByCombination!.rows=c.anatomy.root.layoutByCombination!.rows.filter(r=>r.values[1]==='b');
 const issues=()=>{const e:string[]=[];validate(c,new Map([[c.id,c]]),e,new Map(),{drawnVariants:'figma-domain'});return e;};
 assert.deepEqual(issues(),[]);
 const saved=structuredClone(c.anatomy.root.layoutByCombination!.rows);
 c.anatomy.root.layoutByCombination!.rows.pop();assert(issues().some(e=>e.includes('drawn presence domain')));
 c.anatomy.root.layoutByCombination!.rows=[...saved,{values:['b','a'],layout:{justify:'end'}}];assert(issues().some(e=>e.includes('drawn presence domain')));
 c.anatomy.root.layoutByCombination!.rows=[...saved,{values:['a','a'],layout:{justify:'end'}}];assert(issues().some(e=>e.includes('drawn presence domain')));
});

for(const gate of ['joint','single'] as const)test(`full variant domain requires layout exactly where its ${gate}-gated container is present`,async()=>{
 const c=fixture(),part=c.anatomy.root;
 if(gate==='joint')part.presenceByCombination={props:['tone','size'],rows:[['a','a'],['a','b'],['b','a'],['b','b']].map(values=>({values,present:values[1]==='b'}))};
 else part.visibleWhen={prop:'size',equals:['b']};
 part.layoutByCombination!.rows=part.layoutByCombination!.rows.filter(r=>r.values[1]==='b');
 c.anatomy.root={layout:{display:'flex'},parts:{container:part}};
 assert.deepEqual(errors(c),[]);
 const saved=structuredClone(part.layoutByCombination!.rows);
 part.layoutByCombination!.rows.pop();assert(errors(c).some(e=>e.includes('presence domain')),'missing visible layout must refuse');
 part.layoutByCombination!.rows=[...saved,{values:['a','a'],layout:{justify:'end'}}];assert(errors(c).some(e=>e.includes('presence domain')),'hidden layout must not acquire authority');
 part.layoutByCombination!.rows=saved;
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
  const code=inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,code.tsx,code.css);
   for(const [tone,size] of [['a','b'],['b','a'],['b','b'],['a','b']]){
    await render({tone,size});const element=page.locator('#root > * > *');
    if(size==='a')assert.equal(await element.isVisible(),false);
    else assert.equal(await element.evaluate(n=>getComputedStyle(n).alignItems),tone==='b'?'center':'flex-start');
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
});

test('presence projection accounts for external axes and explicit absent variants before deduplication',()=>{
 const c=fixture(),part=c.anatomy.root;
 part.presenceByCombination={props:['size'],rows:[{values:['a'],present:false},{values:['b'],present:true}]};
 assert.deepEqual([...reachablePresenceTupleKeys(c,['tone'],part)!].sort(),['["a"]','["b"]']);
 c.bindings.figma.absentVariants=[{tone:'b',size:'b'}];
 assert.deepEqual([...reachablePresenceTupleKeys(c,['tone'],part)!],['["a"]']);
 part.presenceByCombination.rows.pop();assert.equal(reachablePresenceTupleKeys(c,['tone'],part),null,'missing presence observations grant no omission permission');
});

test('conditional parent growth composes with joint internal layout without competing overrides',async()=>{
 const c=fixture(), container=c.anatomy.root;
 delete container.literals!.width;
 container.literalsByProp=[{prop:'tone',map:{a:{width:'100px'}}}];
 container.layoutByProp={prop:'tone',map:{b:{grow:true,growBasis:'zero'}}};
 c.anatomy.root={layout:{display:'flex',direction:'row'},literals:{width:'200px',height:'30px'},parts:{container}};
 assert.deepEqual(errors(c),[]);
 const contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
 const native=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,4);
 for(const variant of native.variants){
  const item=variant.spec.children!.find(node=>node.name==='container')!;
  assert.equal(item.fillW===true,variant.name.includes('tone=B'));
  assert.equal(item.layout?.counter,variant.name.includes('tone=B, size=B')?'CENTER':'MIN');
 }
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const code=inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set()});
  const page=await browser.newPage();try{const render=await mountGenerated(page,c.name,code.tsx,code.css);
   for(const tone of ['a','b'])for(const size of ['a','b']){
    await render({tone,size});
    const actual=await page.locator('#root > * > *').evaluate(n=>({width:n.getBoundingClientRect().width,y:n.firstElementChild!.getBoundingClientRect().y-n.getBoundingClientRect().y,grow:getComputedStyle(n).flexGrow}));
    assert.deepEqual(actual,{width:tone==='b'?200:100,y:tone==='b'&&size==='b'?10:0,grow:tone==='b'?'1':'0'},`${inline?'inline':'css'} ${tone}/${size}`);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
 container.layoutByProp.map.b.align='end';
 assert(errors(c).some(e=>e.includes('layoutByCombination')),'competing internal layout remains refused');
});

for(const sparse of [false,true])test(`childless rectangles preserve frame alignment and item stretch on ${sparse?'declared sparse':'complete'} tuples`,async()=>{
 const {proposeFromDump,proposeDeclaredDrawnCandidate}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const dump:any={setName:'MixedImage',type:'COMPONENT_SET',propertyDefinitions:Object.fromEntries(['Kind','State'].map(p=>[p,{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}])),variants:[['A','A'],['A','B'],['B','A'],['B','B']].map(([Kind,State])=>({name:`Kind=${Kind}, State=${State}`,type:'COMPONENT',variantProperties:{Kind,State},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Surface',type:Kind==='A'?'FRAME':'RECTANGLE',fill:{hex:'ffffff'},fixedSize:{width:100,height:40},...(Kind==='A'?{layout:{mode:'HORIZONTAL',primary:State==='A'?'MIN':'MAX',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},children:[{name:'Mark',type:'RECTANGLE',fill:{hex:'000000'},fixedSize:{width:10,height:10}}]}:{})}]}))};
 for(const v of dump.variants){v.fixedSize={width:100,height:60};if(v.variantProperties.Kind==='A'){delete v.children[0].fixedSize.width;v.children[0].fillWidth=true;}}
 if(sparse)dump.variants=dump.variants.filter((v:any)=>!(v.variantProperties.Kind==='B'&&v.variantProperties.State==='A'));
 const opts={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,stampsObservable:true,contractIdByName:new Map<string,string>()};
 const proposal=sparse?proposeDeclaredDrawnCandidate(dump,opts,dump.variants.map((v:any)=>v.variantProperties)).proposal:proposeFromDump(dump,opts);
 const c=ContractSchema.parse(proposal.contract),surface=Object.values(c.anatomy.root.parts!)[0];
 assert.equal(resolveLayout(surface,{kind:'a',state:'a'})?.justify,'start');
 assert.equal(resolveLayout(surface,{kind:'a',state:'b'})?.justify,'end');
 assert.equal(surface.layoutByCombination?.rows.length,sparse?3:4);
 assert.equal(resolveLayout(surface,{kind:'a',state:'b'})?.alignSelf,'stretch');
 assert.equal(resolveLayout(surface,{kind:'b',state:'b'})?.alignSelf,'auto');
});

test('captured hidden presence limits joint layout authority to drawn cells',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');
 const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const dump:any={setName:'HiddenLayout',type:'COMPONENT_SET',propertyDefinitions:Object.fromEntries(['Kind','State'].map(p=>[p,{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']}])),variants:[['A','A'],['A','B'],['B','A'],['B','B']].map(([Kind,State])=>({name:`Kind=${Kind}, State=${State}`,type:'COMPONENT',variantProperties:{Kind,State},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Panel',type:'FRAME',hidden:Kind!==State,layout:{mode:'HORIZONTAL',primary:Kind==='B'&&State==='B'?'MAX':'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Label',type:'TEXT',text:{characters:'Content',fontSize:14,fontStyle:'Regular'}}]}]}))};
 const result=proposeFromDump(dump,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,hiddenCaptured:true});
 const c=ContractSchema.parse(result.contract),panel=c.anatomy.root.parts!.Panel;
 assert(panel.presenceByCombination);
 assert.deepEqual(panel.layoutByCombination?.rows.map(r=>r.values),[['a','a'],['b','b']]);
 assert.equal(resolveLayout(panel,{kind:'b',state:'b'})?.justify,'end');
 assert.deepEqual(errors(c),[]);
 const missing=structuredClone(c);missing.anatomy.root.parts!.Panel.layoutByCombination!.rows.pop();
 assert(errors(missing).some(e=>e.includes('presence domain')),'missing drawn layout remains a validation error');
});
