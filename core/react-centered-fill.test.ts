import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';import {lowerCenteredFillPadding} from './react-centered-fill.js';import {mintedTokenCss} from './mint-tokens.js';
function parse(v:unknown){const r=ContractSchema.safeParse(v);if(!r.success)throw Error(JSON.stringify(r.error.issues));return r.data}
function fixture(column=false){return parse({id:'test.equal-fill',name:'EqualFill',version:'0.1.0',status:'draft',description:'Centered fill geometry',semantics:{element:'div'},props:[],states:[],anatomy:{root:{layout:{display:'flex',direction:column?'column':'row'},literals:{width:column?'32px':'64px',height:column?'64px':'32px','padding-inline':'2px','padding-block':'2px',gap:'2px'},parts:{indicator:{layout:{display:'flex',direction:column?'column':'row',align:'center',justify:'center',grow:true,growBasis:'zero',alignSelf:'stretch'},tokens:{[column?'padding-block':'padding-inline']:'{pad}'},parts:{glyph:{shape:{kind:'path',width:12,height:12,paths:[{data:'M0 0L12 0L12 12L0 12Z',windingRule:'NONZERO'}]},literals:{'background-color':'#000000'}}}},handle:{layout:{grow:true,growBasis:'zero',alignSelf:'stretch'},literals:{'background-color':'#ffffff'}}}}},bindings:{code:{anchors:{importPath:'./EqualFill',export:'EqualFill'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}})}
const tokens={primitives:{pad:{$type:'dimension',$value:'13px'}},semantic:{},light:{},dark:{},brands:{default:{}}};
test('centered fixed graphics preserve equal FILL outer sizes above and below the padding sum on both React surfaces',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const column of [false,true])for(const size of [64,48])for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=fixture(column);c.anatomy.root.literals![column?'height':'width']=size+'px';const before=JSON.stringify(c),ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()},files=emitter.emit(c,ctx),page=await browser.newPage();try{
   await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   const geometry=await page.locator('#root > *').evaluate(root=>{const r=root.getBoundingClientRect(),children=Array.from(root.children).map(n=>n.getBoundingClientRect()),glyph=root.children[0].children[0].getBoundingClientRect();return {children:children.map(b=>({width:b.width,height:b.height})),glyph:{x:glyph.x-r.x,y:glyph.y-r.y}}});
   const share=(size-6)/2;assert.deepEqual(geometry.children,[{width:column?28:share,height:column?share:28},{width:column?28:share,height:column?share:28}]);assert.equal(geometry.glyph[column?'y':'x'],2+(share-12)/2);assert.equal(JSON.stringify(c),before);
  }finally{await page.close()}
 }
});
test('centered FILL padding lowering preserves asymmetric, conditional, unresolved and flexible-content layouts',()=>{
 for(const mutate of [
  (c:any)=>c.anatomy.root.parts.indicator.layout.justify='start',
  (c:any)=>c.anatomy.root.parts.indicator.layout.wrap=true,
  (c:any)=>c.anatomy.root.layoutByProp={prop:'unused',map:{other:{direction:'column'}}},
  (c:any)=>c.anatomy.root.parts.indicator.literals={'padding-left':'2px'},
  (c:any)=>c.anatomy.root.parts.indicator.layoutByProp={prop:'unused',map:{}},
  (c:any)=>c.anatomy.root.parts.indicator.parts.glyph.layout={grow:true},
  (c:any)=>c.anatomy.root.parts.indicator.parts.glyph.shape.parentViewport={width:20,height:20,x:0,y:0},
  (c:any)=>c.anatomy.root.parts.indicator.tokens['padding-inline']='{missing}',
 ]){const c=fixture();mutate(c);assert.equal(lowerCenteredFillPadding(c,tokens),c)}
});

test('parent row reversal preserves the axis while the split public CSS generator uses the same lowering',async()=>{
 const c=fixture();c.anatomy.root.layoutByProp={prop:'unused',map:{off:{direction:'row-reverse'}}};assert.notEqual(lowerCenteredFillPadding(c,tokens),c);
 const {generateCss}=await import('./emit-react.js');const {tokenInventoryFromJson}=await import('./tokens.js');const errors:string[]=[];const css=generateCss(fixture(),tokenInventoryFromJson([tokens.primitives]),errors,tokens);assert.deepEqual(errors,[]);assert(!css.includes('padding-inline: var(--pad)'));
});

function fixedBox(){
 const c=fixture();c.props=[{name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}];
 c.anatomy.root={tokens:{width:'{box.{size}}',height:'{box.{size}}','padding-inline':'{pad}','padding-block':'{pad}'},parts:{child:{text:'X',literals:{width:'12px',height:'12px'},tokens:{'flex-shrink':'{shrink}'}}}};
 return c;
}
const fixedTokens={...tokens,primitives:{shrink:{$type:'number',$value:0},pad:{$type:'dimension',$value:'16px'},box:{small:{$type:'dimension',$value:'28px'},large:{$type:'dimension',$value:'48px'}}}};
test('fixed centered boxes keep outer dimensions and child center below the padding sum on both React surfaces',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const c=fixedBox(),before=JSON.stringify(c),scope=new Map([[c.id,c]]),engine=createFigmaEngine({tokens:fixedTokens,icons:new Map()}),native=JSON.stringify(engine.compileComponentData(c,scope));
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{tokens:fixedTokens,contracts:scope,icons:new Map<string,string>()}),page=await browser.newPage();
  try{const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(fixedTokens.primitives)});
   for(const size of ['small','large','small']){await render({size});const boxes=await page.locator('#root > *').evaluate(n=>{const a=n.getBoundingClientRect(),b=n.children[0].getBoundingClientRect();return[a.width,a.height,b.x-a.x,b.y-a.y]});const edge=size==='small'?28:48;assert.deepEqual(boxes,[edge,edge,(edge-12)/2,(edge-12)/2]);}
  }finally{await page.close();}
 }
 assert.equal(JSON.stringify(c),before);assert.equal(JSON.stringify(engine.compileComponentData(c,scope)),native);
});
test('fixed centered padding retains unresolved dimensions, asymmetric padding and flexible children',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.tokens.width='{missing}',
  (c:any)=>c.anatomy.root.tokens.height='50%',
  (c:any)=>c.anatomy.root.literals={'padding-left':'4px'},
  (c:any)=>c.anatomy.root.declared={'background-clip':'content-box'},
  (c:any)=>c.anatomy.root.layout={display:'flex',align:'start',justify:'center'},
  (c:any)=>c.anatomy.root.stylesWhen=[{prop:'size',equals:'small',styles:{'padding-inline':'4px'}}],
  (c:any)=>c.anatomy.root.parts.child.literals['flex-shrink']='1',
  (c:any)=>c.anatomy.root.parts.child.literals.width='auto',
  (c:any)=>c.anatomy.root.parts.child.literals['margin-left']='1px',
  (c:any)=>c.anatomy.root.parts.other={text:'extra'},
 ]){const c=fixedBox();change(c);assert.equal(lowerCenteredFillPadding(c,fixedTokens),c);}
});
