import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';import {reactEmitter,reactInlineEmitter} from './emitter.js';import {mountGenerated} from './react-test-runtime.js';import {lowerCenteredFillPadding,centeredFixedPaddingProjections} from './react-centered-fill.js';import {mintedTokenCss} from './mint-tokens.js';
function parse(v:unknown){const r=ContractSchema.safeParse(v);if(!r.success)throw Error(JSON.stringify(r.error.issues));return r.data}
function fixture(column=false){return parse({id:'test.equal-fill',name:'EqualFill',version:'0.1.0',status:'draft',description:'Centered fill geometry',semantics:{element:'div'},props:[],states:[],anatomy:{root:{layout:{display:'flex',direction:column?'column':'row'},literals:{width:column?'32px':'64px',height:column?'64px':'32px','padding-inline':'2px','padding-block':'2px',gap:'2px'},parts:{indicator:{layout:{display:'flex',direction:column?'column':'row',align:'center',justify:'center',grow:true,growBasis:'zero',alignSelf:'stretch'},tokens:{[column?'padding-block':'padding-inline']:'{pad}'},parts:{glyph:{shape:{kind:'path',width:12,height:12,paths:[{data:'M0 0L12 0L12 12L0 12Z',windingRule:'NONZERO'}]},literals:{'background-color':'#000000'}}}},handle:{layout:{grow:true,growBasis:'zero',alignSelf:'stretch'},literals:{'background-color':'#ffffff'}}}}},bindings:{code:{anchors:{importPath:'./EqualFill',export:'EqualFill'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}})}
const tokens={primitives:{pad:{$type:'dimension',$value:'13px'},shrink:{$type:'number',$value:0}},semantic:{},light:{},dark:{},brands:{default:{}}};
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

test('a reversed hug keeps a content floor so a one-pixel-short container cannot slide the line backward', async () => {
  const { layoutOverrideDecls } = await import('../packages/core/src/anatomy.js');
  assert.deepEqual(layoutOverrideDecls({ direction: 'row-reverse', align: 'start', justify: 'start' }), [
    'flex-direction: row-reverse', 'align-items: flex-start', 'justify-content: flex-start', 'min-width: max-content',
  ]);
  assert.equal(layoutOverrideDecls({ direction: 'row-reverse', grow: true }).includes('min-width: max-content'), false);
  assert.equal(layoutOverrideDecls({ direction: 'row-reverse' }, undefined, { tokens: { width: '{size}' } }).includes('min-width: max-content'), false, 'a designed width keeps wrapping');
  assert.ok(layoutOverrideDecls({ direction: 'column-reverse' }).includes('min-height: max-content'));
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
  (c:any)=>c.anatomy.root.parts.child.component={id:'other.child'},
  (c:any)=>c.anatomy.root.parts.child.literals['padding-inline']='16px',
 ]){const c=fixedBox();change(c);assert.equal(lowerCenteredFillPadding(c,fixedTokens),c);}
});


// The retained Primer source has a complete state/size/disabled table, not
// layoutByProp. Keep this in the existing geometry regression: no new corpus.
function jointFixture(column=false,mixed=false){
 const c=fixture(column),root=c.anatomy.root,direction=column?'column':'row';
 c.props=[
  {name:'state',type:{enum:['on','off']},default:'on',bindings:{code:{prop:'state'},figma:{kind:'VARIANT',property:'State',values:{on:'On',off:'Off'}}}},
  {name:'size',type:{enum:['medium','small']},default:'medium',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{medium:'Medium',small:'Small'}}}},
  {name:'disabled',type:'boolean',default:false,bindings:{code:{prop:'disabled'},figma:{kind:'VARIANT',property:'Disabled',values:{true:'True',false:'False'}}}},
 ];
 root.layoutByCombination={props:['state','size','disabled'],rows:['on','off'].flatMap(state=>['medium','small'].flatMap(size=>['false','true'].map(disabled=>({values:[state,size,disabled],layout:{direction:state==='on'?direction:(direction+'-reverse') as 'row-reverse'|'column-reverse',align:'center',justify:'start',reversePaint:state==='off'}}))))};
 const extra=mixed?30:0;
 root.literalsByProp=[{prop:'size',map:Object.fromEntries([['medium',64,32],['small',48,24]].map(([size,main,cross])=>[size,{width:((column?cross:Number(main)+extra))+'px',height:((column?Number(main)+extra:cross))+'px'}]))}];
 if(mixed){
  const {indicator,handle}=root.parts!;
  // The fixed and HUG siblings retain their own border/padding and consume
  // 10 + 16 px plus two added 2 px gaps, leaving the original FILL share.
  root.parts={fixed:{tokens:{'flex-shrink':'{shrink}'},literals:{width:'10px',height:'10px','border-width':'1px','border-color':'#000000'},declared:{'border-style':'solid'}},indicator,
   hug:{layout:{display:'flex',direction},literals:{[column?'padding-block':'padding-inline']:'2px','border-width':'1px','border-color':'#000000'},declared:{'border-style':'solid'},parts:{mark:{shape:{kind:'path',width:10,height:10,paths:[{data:'M0 0L10 0L10 10L0 10Z',windingRule:'NONZERO'}]},literals:{'background-color':'#000000'}}}},handle};
 }
 return parse(c);
}

test('complete same-axis layout tables preserve FILL shares and centered glyphs through size/reversal changes',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const column of [false,true])for(const mixed of [false,true])for(const emitter of [reactEmitter,reactInlineEmitter]){
  const c=jointFixture(column,mixed),before=JSON.stringify(c),files=emitter.emit(c,{tokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()}),page=await browser.newPage();
  try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   const rows=c.anatomy.root.layoutByCombination!.rows;
   // Return to the first tuple to catch stale conditional styles as well.
   for(const row of [...rows,rows[0]]){
    const [state,size,disabled]=row.values;await render({state,size,disabled:disabled==='true'});
    const geometry=await page.locator('#root > *').evaluate((root,{column,mixed})=>{
     const r=root.getBoundingClientRect(),items=Array.from(root.children),boxes=items.map(n=>n.getBoundingClientRect()),indicator=boxes[mixed?1:0],glyph=items[mixed?1:0].firstElementChild!.getBoundingClientRect();
     return {main:column?r.height:r.width,items:boxes.map(b=>({size:column?b.height:b.width,start:column?b.y-r.y:b.x-r.x,cross:column?b.width:b.height})),glyphOffset:column?glyph.y-indicator.y:glyph.x-indicator.x};
    },{column,mixed});
    const main=size==='small'?48:64,cross=size==='small'?24:32,share=(main-6)/2,sizes=mixed?[10,share,16,share]:[share,share];
    assert.equal(geometry.main,main+(mixed?30:0));
    let cursor=2;
    for(let i=0;i<sizes.length;i++){
     const expectedStart=state==='on'?cursor:geometry.main-cursor-sizes[i];
     assert.equal(geometry.items[i].size,sizes[i]);assert.equal(geometry.items[i].start,expectedStart);cursor+=sizes[i]+2;
    }
    for(const i of mixed?[1,3]:[0,1])assert.equal(geometry.items[i].cross,cross-4);
    assert.equal(geometry.glyphOffset,(share-12)/2);
   }
   assert.equal(JSON.stringify(c),before);
  }finally{await page.close();}
 }
});

test('joint-table admission retains cross-axis, grid, wrap and content guards',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.layoutByCombination.rows[3].layout.direction='column',
  (c:any)=>c.anatomy.root.layoutByCombination.rows[3].layout.direction='column-reverse',
  (c:any)=>c.anatomy.root.layout.display='grid',
  (c:any)=>c.anatomy.root.layout.wrap=true,
  (c:any)=>c.anatomy.root.layoutByCombination.rows[3].layout={grow:true,growBasis:'zero'},
  (c:any)=>c.anatomy.root.layoutByCombination.rows[3].layout.childOrder=['handle','indicator'],
  (c:any)=>c.anatomy.root.parts.indicator.layout.wrap=true,
  (c:any)=>c.anatomy.root.parts.indicator.layout.justify='start',
  (c:any)=>c.anatomy.root.parts.indicator.layoutByCombination=c.anatomy.root.layoutByCombination,
  (c:any)=>c.anatomy.root.parts.indicator.literals={'padding-left':'2px'},
  (c:any)=>c.anatomy.root.parts.indicator.parts.glyph.layout={grow:true},
 ]){const c=jointFixture();change(c);assert.equal(lowerCenteredFillPadding(c,tokens),c);}
});


function conditionalFixedBox(){
 const c=fixedBox();
 c.props.push({name:'alignment',type:{enum:['center','start']},default:'center',bindings:{code:{prop:'alignment'},figma:{kind:'VARIANT',property:'Alignment',values:{center:'Center',start:'Start'}}}},
  {name:'disabled',type:'boolean',default:false,bindings:{code:{prop:'disabled'},figma:{kind:'BOOLEAN',property:'Disabled'}}});
 const root=c.anatomy.root;
 root.layout={display:'flex',direction:'row',align:'center',justify:'center'};
 root.layoutByCombination={props:['alignment','size'],rows:['center','start'].flatMap(alignment=>['small','large'].map(size=>({values:[alignment,size],layout:{direction:'row' as const,align:'center' as const,justify:alignment as 'center'|'start'}})))};
 root.tokensByProp={prop:'size',map:{small:{'min-width':'{box.small}','max-width':'{box.small}','min-height':'{box.small}','max-height':'{box.small}'},large:{'min-width':'{box.large}','max-width':'{box.large}','min-height':'{box.large}','max-height':'{box.large}'}}};
 root.stylesWhen=[{prop:'disabled',equals:'true',styles:{'justify-content':'start'}}];
 return parse(c);
}

test('complete fixed tuples share one proof and retain unsafe selectors without changing source or native data',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const c=conditionalFixedBox(),before=JSON.stringify(c),scope=new Map([[c.id,c]]),engine=createFigmaEngine({tokens:fixedTokens,icons:new Map()}),native=JSON.stringify(engine.compileComponentData(c,scope));
 const proof=centeredFixedPaddingProjections(c,fixedTokens);
 assert.equal(proof.length,1);assert.deepEqual(proof[0].path,['root']);assert.deepEqual(proof[0].props,['alignment','disabled','size']);
 assert.deepEqual(proof[0].rows.map(r=>r.values),[['center','false','small'],['center','false','large']]);
 const lowered=lowerCenteredFillPadding(c,fixedTokens);
 assert.deepEqual(lowered.anatomy.root.tokens,c.anatomy.root.tokens);
 assert.deepEqual(lowered.anatomy.root.literalsByCombination?.at(-1)?.rows,proof[0].rows);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{tokens:fixedTokens,contracts:scope,icons:new Map<string,string>()}),page=await browser.newPage();
  try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(fixedTokens.primitives)});
   for(const props of [{size:'small',alignment:'center',disabled:false},{size:'large',alignment:'center',disabled:false},{size:'small',alignment:'start',disabled:false},{size:'small',alignment:'center',disabled:true},{size:'small',alignment:'center',disabled:false}]){
    await render(props);const actual=await page.locator('#root > *').evaluate(n=>{const a=n.getBoundingClientRect(),b=n.children[0].getBoundingClientRect(),s=getComputedStyle(n);return{width:a.width,height:a.height,x:b.x-a.x,y:b.y-a.y,padding:s.paddingInlineStart}});
    const qualifies=props.alignment==='center'&&!props.disabled,edge=props.size==='small'?28:48;
    if(qualifies)assert.deepEqual(actual,{width:edge,height:edge,x:(edge-12)/2,y:(edge-12)/2,padding:'0px'});
    else assert.deepEqual(actual,{width:32,height:32,x:16,y:10,padding:'16px'});
   }
  }finally{await page.close();}
 }
 assert.equal(JSON.stringify(c),before);assert.equal(JSON.stringify(engine.compileComponentData(c,scope)),native);
});

test('fixed tuple projection refuses incomplete domains, conflicting clamps, selector ambiguity and a growing child',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.layoutByCombination.rows.pop(),
  (c:any)=>c.anatomy.root.layoutByCombination.rows.push(c.anatomy.root.layoutByCombination.rows[0]),
  (c:any)=>c.anatomy.root.layoutByCombination.rows[0].values[0]='missing',
  (c:any)=>c.anatomy.root.tokensByProp.map.small['max-width']='{box.large}',
  (c:any)=>c.anatomy.root.parts.child.tokens['flex-shrink']='{pad}',
  (c:any)=>c.anatomy.root.parts.child.layout={grow:true},
  (c:any)=>c.anatomy.root.parts.child.literals['box-sizing']='content-box',
  (c:any)=>c.anatomy.root.states={hover:{width:'{box.large}'}},
  (c:any)=>c.anatomy.root.literals={'padding-left':'1px'},
  (c:any)=>c.anatomy.root.tokensByCombination=[{props:['size'],rows:[{values:['small'],tokens:{width:'{box.large}'}},{values:['large'],tokens:{width:'{box.large}'}}]}],
  (c:any)=>{c.anatomy.root.layoutByProp={prop:'alignment',map:{center:{justify:'start'},start:{justify:'start'}}};},
  (c:any)=>{delete c.props[0].default;},
  (c:any)=>{c.props.push({name:'extra',type:{enum:Array.from({length:300},(_,i)=>String(i))},default:'0',bindings:{code:{prop:'extra'},figma:{kind:'VARIANT',property:'Extra'}}});c.anatomy.root.tokensByProp={prop:'extra',map:Object.fromEntries(c.props.at(-1).type.enum.map((x:string)=>[x,{}]))};},
 ]){
  const c=conditionalFixedBox();change(c);const proof=centeredFixedPaddingProjections(c,fixedTokens);
  assert(!proof.some(p=>p.rows.some(r=>r.values[p.props.indexOf('size')]==='small')));
 }
});


function fixedSlotBox(){
 const c=conditionalFixedBox(),root=c.anatomy.root;
 root.parts={host:{slot:{name:'content',renderDefaultAnatomy:true,collapseWhenEmpty:true},literals:{width:'16px',height:'16px'},tokens:{'flex-shrink':'{shrink}'},parts:{mark:{shape:{kind:'path',width:36,height:7,paths:[{data:'M0 0L36 0L36 7L0 7Z',windingRule:'NONZERO'}]},literals:{'background-color':'#000000'}}}},
  label:{text:'Only in large',visibleWhen:{prop:'size',equals:'large'},literalsByProp:[{prop:'size',map:{large:{width:'12px',height:'12px'}}}],tokens:{'flex-shrink':'{shrink}'}}};
 return parse(c);
}
test('a fixed styled slot host retains its real box with oversized content and an exactly absent sparse sibling',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const c=fixedSlotBox(),before=JSON.stringify(c),proof=centeredFixedPaddingProjections(c,fixedTokens);
 assert.deepEqual(proof.flatMap(p=>p.rows.map(r=>r.values)),[['center','false','small']]);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{tokens:fixedTokens,contracts:new Map([[c.id,c]]),icons:new Map<string,string>()}),page=await browser.newPage();
  try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(fixedTokens.primitives)});
   for(const props of [{size:'small',alignment:'center',disabled:false},{size:'large',alignment:'center',disabled:false},{size:'small',alignment:'center',disabled:false}]){
    await render(props);const actual=await page.locator('#root > *').evaluate(n=>{const a=n.getBoundingClientRect(),host=n.firstElementChild!,b=host.getBoundingClientRect(),inner=host.firstElementChild!.getBoundingClientRect();return{width:a.width,height:a.height,x:b.x-a.x,y:b.y-a.y,host:[b.width,b.height],inner:inner.width,padding:getComputedStyle(n).paddingInlineStart};});
    if(props.size==='small')assert.deepEqual(actual,{width:28,height:28,x:6,y:6,host:[16,16],inner:36,padding:'0px'});
    else assert.equal(actual.padding,'16px');
   }
   await render({size:'small',alignment:'center',disabled:false,content:null});
   assert.deepEqual(await page.locator('#root > *').evaluate(n=>[n.getBoundingClientRect().width,n.children.length]),[28,0]);
  }finally{await page.close();}
 }
 assert.equal(JSON.stringify(c),before);
});

test('slot host projection refuses contents, flexible boxes and missing rows on visible sparse children',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.parts.host.declared={display:'contents'},
  (c:any)=>c.anatomy.root.parts.host.tokens['flex-shrink']='{pad}',
  (c:any)=>c.anatomy.root.parts.host.literals['padding-inline']='16px',
  (c:any)=>c.anatomy.root.parts.host.literals.width='100%',
  (c:any)=>c.anatomy.root.parts.label.visibleWhen.equals='small',
 ]){const c=fixedSlotBox();change(c);assert(!centeredFixedPaddingProjections(c,fixedTokens).some(p=>p.rows.some(r=>r.values[p.props.indexOf('size')]==='small')));}
});

test('fixed centered background longhands retain their paint and intended outer box on both React surfaces',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const c=fixedBox();c.anatomy.root.literals={'background-image':'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)'};c.anatomy.root.declared={'background-position':'center','background-size':'cover','background-repeat':'no-repeat'};
 const before=JSON.stringify(c),scope=new Map([[c.id,c]]);
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{tokens:fixedTokens,contracts:scope,icons:new Map<string,string>()}),page=await browser.newPage();
  try{await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);await page.addStyleTag({content:mintedTokenCss(fixedTokens.primitives)});
   const measured=await page.locator('#root > *').evaluate(root=>{const box=root.getBoundingClientRect(),css=getComputedStyle(root);return {width:box.width,height:box.height,image:css.backgroundImage,position:css.backgroundPosition,size:css.backgroundSize,repeat:css.backgroundRepeat};});
   assert.deepEqual(measured,{width:28,height:28,image:'linear-gradient(rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)',position:'50% 50%',size:'cover',repeat:'no-repeat'});
  }finally{await page.close();}
 }
 assert.equal(JSON.stringify(c),before);
});

test('real parent borders and padding-dependent paint cannot acquire fixed centered authority',()=>{
 for(const change of [
  (c:any)=>c.anatomy.root.tokens['border-width']='{pad}',
  (c:any)=>{c.anatomy.root.tokens['border-width']='{pad}';c.anatomy.root.strokesIncludedInLayout=false;},
  (c:any)=>c.anatomy.root.literals={'border-left-width':'30px'},
  (c:any)=>c.anatomy.root.declared={background:'red content-box'},
  (c:any)=>c.anatomy.root.declared={'background-origin':'content-box'},
  (c:any)=>c.anatomy.root.declared={'border-style':'solid'},
  (c:any)=>c.anatomy.root.declaredStates={hover:{'background-size':'contain'}},
  (c:any)=>c.anatomy.root.declaredStates={hover:{border:'20px solid red'}},
  (c:any)=>c.anatomy.root.declaredStates={hover:{'box-sizing':'content-box'}},
  (c:any)=>c.anatomy.root.states={hover:{'border-width':'{pad}'}},
  (c:any)=>c.anatomy.root.declaredStates={hover:{background:'red content-box'}},
  (c:any)=>c.anatomy.root.literalsByCombination=[{props:['size'],rows:[{values:['small'],literals:{background:'red content-box'}},{values:['large'],literals:{background:'red content-box'}}]}],
 ]){const c=conditionalFixedBox();change(c);assert.equal(centeredFixedPaddingProjections(c,fixedTokens).length,0);}
 const c=conditionalFixedBox();c.anatomy.root.tokensByProp={prop:'size',map:{small:{'border-width':'{pad}'},large:{'border-width':'0px'}}};
 assert(centeredFixedPaddingProjections(c,fixedTokens).every(p=>p.rows.every(r=>r.values[p.props.indexOf('size')]==='large')));
});

test('only explicitly absent root tuples may be omitted from otherwise complete tables',()=>{
 const c=fixedBox();c.anatomy.root.layoutByCombination={props:['size'],rows:[{values:['small'],layout:{direction:'row',align:'center',justify:'center'}}]};
 assert.equal(centeredFixedPaddingProjections(c,fixedTokens).length,0);
 c.bindings.figma.absentVariants=[{size:'large'}];
 assert.deepEqual(centeredFixedPaddingProjections(c,fixedTokens).flatMap(p=>p.rows.map(r=>r.values)),[['small']]);
});


test('child pseudo-state box geometry cannot bypass fixed slot-host proof',()=>{
 for(const geometry of [{'padding-inline':'20px'},{padding:'20px'},{border:'20px solid red'},{display:'contents'},{'box-sizing':'content-box'}])
  for(const channel of ['states','declaredStates','statesByProp']){
   const c=fixedSlotBox(),host=c.anatomy.root.parts!.host;
   if(channel==='states')host.states={hover:geometry} as any;
   if(channel==='declaredStates')host.declaredStates={hover:geometry} as any;
   if(channel==='statesByProp')host.statesByProp=[{prop:'size',state:'hover',map:{small:geometry,large:geometry}}] as any;
   const before=JSON.stringify(c);
   assert.equal(centeredFixedPaddingProjections(c,fixedTokens).length,0,channel+':'+Object.keys(geometry)[0]);
   assert.equal(lowerCenteredFillPadding(c,fixedTokens),c);
   assert.equal(JSON.stringify(c),before);
  }
});
