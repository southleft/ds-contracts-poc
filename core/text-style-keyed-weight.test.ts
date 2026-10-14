import test from 'node:test';import assert from 'node:assert/strict';
import {createFigmaEngine} from './emit-figma-script.js';
function fixture(){const identity={name:'Body',key:'source-body-key'};return {primitives:{imported:{text:{body:{'font-size':{$value:'12px',$type:'dimension',$extensions:{dsContracts:{textStyle:identity}}},'font-weight':{$value:'400',$type:'number'}}},sample:{label:{'font-size':{sm:{$value:'12px',$type:'dimension',$extensions:{dsContracts:{textStyle:{...identity}}}}}}}}},semantic:{},light:{},dark:{},brands:{default:{}}};}
test('a size alias with matching source key inherits known weight without a neighboring weight token',()=>{
 const engine=createFigmaEngine({tokens:fixture(),icons:new Map()});const script=engine.buildTokensScript(null);
 const styles=JSON.parse(script.match(/const TEXT_STYLES = (.*);/)![1]);
 assert.equal(styles.length,1);assert.equal(styles[0].fontStyle,'Regular');assert.equal(styles[0].tokenPath,'imported.text.body.font-size');assert.equal(styles[0].sourceStyleKey,'source-body-key');
});
test('keyed weight reuse does not hide explicit conflicts or infer identity from names',()=>{
 for(const edit of [(t:any)=>t.$extensions.dsContracts.textStyle.weight=600,(t:any)=>delete t.$extensions.dsContracts.textStyle.key,(t:any)=>t.$extensions.dsContracts.textStyle.key='other-key',(t:any)=>t.$value='13px']){
  const tokens=fixture();edit(tokens.primitives.imported.sample.label['font-size'].sm);assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}),/text-style-identity-refused/);
 }
});

test('explicit pixel and percent line heights retain size-variable identity instead of an incompatible AUTO style',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 for(const lineHeight of [undefined,'20px','150%']){
  const c=ContractSchema.parse({id:'ds.body',name:'Body',version:'0.1.0',status:'draft',description:'Text identity',semantics:{element:'div'},props:[],states:[],anatomy:{root:{parts:{label:{text:'Email',tokens:{'font-size':'{imported.text.body.font-size}','font-weight':'{imported.text.body.font-weight}'},...(lineHeight?{literals:{'line-height':lineHeight}}:{})}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./Body',export:'Body'}}}});
  const engine=createFigmaEngine({tokens:fixture(),icons:new Map()}),scope=new Map([[c.id,c]]),spec=engine.compileComponentData(c,scope).variants[0].spec.children![0];
  if(lineHeight){assert.equal(spec.textStyle,undefined);assert.equal(spec.fontSizeVar,'imported/text/body/font-size');assert.deepEqual(spec.lineHeight,{value:lineHeight==='20px'?20:150,unit:lineHeight==='20px'?'PIXELS':'PERCENT'});}
  else {assert.equal(spec.textStyle,'Body');assert.equal(spec.fontSizeVar,undefined);}
 }
});

test('captured pixel and percent line heights agree in layered and flat style definitions and exact consumers',async()=>{
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const {emitTokenSetScript}=await import('./token-set.js');
 for(const [raw,expected] of [['20px',{value:20,unit:'PIXELS'}],['150%',{value:150,unit:'PERCENT'}]] as const){
  const tokens:any=fixture();
  for(const [group,axis] of [[tokens.primitives.imported.text.body,false],[tokens.primitives.imported.sample.label,true]] as const){
   const leaf={$value:raw,$type:'dimension',$extensions:{dsContracts:{textStyle:{name:'Body',key:'source-body-key'}}}};
   group['line-height']=axis?{sm:leaf}:leaf;
  }
  // Flat sets require their own declared weight; the alias-weight policy is
  // independently covered above, not smuggled into this line-height test.
  tokens.primitives.imported.sample.label['font-weight']={$value:'400',$type:'number'};
  const engine=createFigmaEngine({tokens,icons:new Map()});
  for(const script of [engine.buildTokensScript(null),emitTokenSetScript({name:'Test',base:{},minted:tokens.primitives},null)]){
   const styles=JSON.parse(script.match(/const TEXT_STYLES = (.*);/)![1]);
   assert.equal(styles.length,1);assert.deepEqual(styles[0].lineHeight,expected);
   assert.match(script,/s\.lineHeight = t\.lineHeight \|\| \{ unit: 'AUTO' \}/);
  }
  for(const actual of [raw,undefined,'21px']){
   const c=ContractSchema.parse({id:'ds.body',name:'Body',version:'0.1.0',status:'draft',description:'Text identity',semantics:{element:'div'},props:[],states:[],anatomy:{root:{parts:{label:{text:'Email',tokens:{'font-size':'{imported.text.body.font-size}','font-weight':'{imported.text.body.font-weight}'},...(actual?{literals:{'line-height':actual}}:{})}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./Body',export:'Body'}}}});
   const spec=engine.compileComponentData(c,new Map([[c.id,c]])).variants[0].spec.children![0];
   assert.equal(spec.textStyle,actual===raw?'Body':undefined);
   if(actual===raw)assert.deepEqual(spec.lineHeight,expected);
   else assert.equal(spec.fontSizeVar,'imported/text/body/font-size');
  }
 }
});

test('line-height identity requires the same name and key, and contradictory definitions refuse',async()=>{
 const {capturedStyleLineHeight}=await import('./text-style-line-height.js');
 for(const identity of [undefined,{name:'Other',key:'source-body-key'},{name:'Body',key:'other'},{name:'Body'}]){
  assert.equal(capturedStyleLineHeight('imported.text.body.font-size',{name:'Body',key:'source-body-key'},()=>({value:'20px',identity})),undefined);
 }
 const tokens:any=fixture();
 tokens.primitives.imported.text.body['line-height']={$value:'20px',$extensions:{dsContracts:{textStyle:{name:'Body',key:'source-body-key'}}}};
 tokens.primitives.imported.sample.label['line-height']={sm:{$value:'21px',$extensions:{dsContracts:{textStyle:{name:'Body',key:'source-body-key'}}}}};
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}),/text-style-identity-refused/);
});

test('flat style line-height aliases resolve their declared value instead of dropping the unit or identity',async()=>{
 const {emitTokenSetScript}=await import('./token-set.js');
 const tokens:any=fixture();delete tokens.primitives.imported.sample;
 tokens.primitives.imported.text.body['line-height']={$value:'{leading}',$extensions:{dsContracts:{textStyle:{name:'Body',key:'source-body-key'}}}};
 for(const value of ['20px','150%']){
  const script=emitTokenSetScript({name:'Test',base:{leading:{$value:value,$type:'dimension'}},minted:tokens.primitives},null);
  const styles=JSON.parse(script.match(/const TEXT_STYLES = (.*);/)![1]);
  assert.deepEqual(styles[0].lineHeight,value==='20px'?{value:20,unit:'PIXELS'}:{value:150,unit:'PERCENT'});
 }
});

test('component typography overrides cannot overwrite shared style leaves or sibling variant tables',async()=>{
 const {mintTokens}=await import('./mint-tokens.js');
 const axes=[{propName:'size',values:['small','large']}];
 const observation=(values:number[])=>({nodePath:'root/label',part:'label',cssProperty:'font-size',kind:'px' as const,styleName:'Body',styleKey:'body-key',occurrences:values.map((value,i)=>({variant:`Size=${axes[0].values[i]}`,axisValues:{size:axes[0].values[i]},value}))});
 const first=mintTokens('First',[observation([12,18])],axes),second=mintTokens('Second',[observation([14,24])],axes),uniform=mintTokens('Label',[observation([16,16])],axes);
 const at=(tree:any,path:string):any=>path.split('.').reduce((node,key)=>node?.[key],tree);
 const merge=(a:any,b:any)=>{for(const [k,v] of Object.entries(b)){if(v&&typeof v==='object'&&!('$value' in v))merge(a[k]??={},v);else a[k]=v;}};
 for(const order of [[first,second,uniform],[uniform,second,first]]){
  const tree:any={};for(const result of order)merge(tree,result.tree);
  for(const [result,values]of [[first,[12,18]],[second,[14,24]],[uniform,[16,16]]] as const){
   const ref=result.bindings[0].ref!;for(const [i,size]of axes[0].values.entries()){
    const path=ref.slice(1,-1).replace('{size}',size),leaf=at(tree,path);
    assert.equal(leaf?.$value,values[i]+'px',path+' must survive library merge');
    assert.equal(leaf?.$extensions?.dsContracts?.textStyle?.key,'body-key');
   }
  }
 }
 assert.equal(uniform.bindings[0].ref,'{imported.text.body.font-size}','uniform named style remains shared');
});

test('authored MUI styles preserve the existing React line heights on every TextField variant',async()=>{
 const {readFileSync}=await import('node:fs');
 const {ContractSchema}=await import('../scripts/contract-schema.js');
 const read=(p:string)=>JSON.parse(readFileSync(new URL('../examples/mui/'+p,import.meta.url),'utf8'));
 const tokens={primitives:{...read('tokens/mui.dtcg.json'),...read('tokens/mui-minted.dtcg.json')},semantic:{},light:{},dark:{},brands:{default:{}}};
 const c=ContractSchema.parse(read('contracts/text-field.contract.json'));
 const dep=ContractSchema.parse(read('contracts/input-adornment.contract.json'));
 const engine=createFigmaEngine({tokens,icons:new Map()});
 const styles=JSON.parse(engine.buildTokensScript(null).match(/const TEXT_STYLES = (.*);/)![1]);
 const expected=new Map([['MUI/Input Label/Regular',23],['MUI/Helper and Error/Regular',19.92]]);
 const sync=readFileSync(new URL('../examples/mui/figma/00-tokens.figma.js',import.meta.url),'utf8');
 const synced=JSON.parse(sync.match(/const TEXT_STYLES = (.*);/)![1]);
 assert.equal(synced.length,2);
 for(const style of synced)assert.deepEqual(style.lineHeight,{unit:'PIXELS',value:expected.get(style.name)});
 assert.match(sync,/s\.lineHeight = t\.lineHeight/);
 for(const [name,value] of expected)assert.deepEqual(styles.find((s:any)=>s.name===name).lineHeight,{unit:'PIXELS',value});
 const data=engine.compileComponentData(c,new Map([[c.id,c],[dep.id,dep]]));
 for(const variant of data.variants){
  const nodes:any[]=[];const walk=(n:any)=>{if(n.textStyle)nodes.push(n);for(const child of n.children??[])walk(child);};walk(variant.spec);
  assert.equal(nodes.length,2);
  for(const node of nodes)assert.deepEqual(node.lineHeight,{unit:'PIXELS',value:expected.get(node.textStyle)});
 }
});

function equalSizeNamedStyles(reverse=false):any {
 const variants=[false,true].flatMap(populated=>['Default','Compact'].map(density=>({
  name:`Populated=${populated},Density=${density}`,nodeId:`variant-${populated}-${density}`,type:'COMPONENT',
  variantProperties:{Populated:String(populated),Density:density},
  layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'FIXED',counterSizing:'FIXED'},fixedSize:{width:160,height:20},
  children:[{name:'Label',nodeId:`label-${populated}-${density}`,type:'TEXT',fixedSize:{width:100,height:20},
   text:{characters:populated?'2022-01-01':'开始日期',fontSize:14,fontWeight:400,fontStyle:'Regular',lineHeight:20,fontFamily:populated?'Inter':'PingFang SC',
    style:populated?'Paragraph/regular/EN-Regular':'Paragraph/regular/CN-Regular',styleKey:populated?'520ae6d88c220051c8ac0b0e5efd893ca867732f':'46c8ca2c076db835fc545ba95b8cb495a2effdfd',textAutoResize:'NONE'}}],
 })));
 return {setName:'StyleIdentity',type:'COMPONENT_SET',nodeId:'style-set',propertyDefinitions:{Populated:{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']},Density:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Compact']}},variants:reverse?variants.reverse():variants};
}

test('equal-size named styles retain one original text and its font for both values, defaults and source orders',async t=>{
 const {proposeFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const {ContractSchema,walkAnatomy}=await import('../scripts/contract-schema.js');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated}=await import('./react-test-runtime.js');
 const {mintedTokenCss}=await import('./mint-tokens.js');
 const {chromium}=await import('playwright-core');const browser=await chromium.launch();t.after(()=>browser.close());
 const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
 for(const reverse of [false,true]){
  const source=equalSizeNamedStyles(reverse),before=JSON.stringify(source);
  const result=proposeFromDump(source,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
  assert.equal(JSON.stringify(source),before,'original paths, node IDs and text facts are not rewritten');
  const c=ContractSchema.parse(result.contract);
  assert(result.notes.some(note=>note.includes('source-text-style-partition')));
  assert.equal(walkAnatomy(c).filter(({part})=>part.text==='开始日期'||part.text==='2022-01-01').length,2);
  const minted=result.mintedTokens!.tree;const identities:any[]=[];
  const visit=(node:any)=>{if(!node||typeof node!=='object')return;if(node.$extensions?.dsContracts?.textStyle)identities.push(node.$extensions.dsContracts.textStyle);else for(const value of Object.values(node))visit(value);};visit(minted);
  for(const [name,key] of [['Paragraph/regular/CN-Regular','46c8ca2c076db835fc545ba95b8cb495a2effdfd'],['Paragraph/regular/EN-Regular','520ae6d88c220051c8ac0b0e5efd893ca867732f']])
   assert(identities.some(identity=>identity.name===name&&identity.key===key),'exact source style name/key retained');
  const ctx={contracts:new Map([[c.id,c]]),icons:new Map<string,string>(),tokens:{primitives:minted,semantic:{},light:{},dark:{},brands:{default:{}}}};
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const files=emitter.emit(c,ctx),page=await browser.newPage();
   try{
    const render=await mountGenerated(page,c.name,files[0].contents,files.find(file=>file.path.endsWith('.css'))?.contents);
    await page.addStyleTag({content:mintedTokenCss(minted)});
    for(const [props,text,family] of [[{},'开始日期','PingFang SC'],[{populated:true},'2022-01-01','Inter'],[{populated:false},'开始日期','PingFang SC'],[{populated:true,density:'compact'},'2022-01-01','Inter'],[{populated:false,density:'compact'},'开始日期','PingFang SC']] as const){
     await render(props);assert.equal((await page.locator('#root').innerText()).trim(),text);
     const leaves=await page.locator('#root').evaluate(root=>[...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&el.textContent?.trim()&&el.getBoundingClientRect().width>0).map(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return {text:el.textContent?.trim(),family:s.fontFamily.split(',')[0].trim().replaceAll('"',''),size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,width:b.width,height:b.height};}));
     assert.deepEqual(leaves,[{text,family,size:'14px',weight:'400',lineHeight:'20px',width:100,height:20}]);
    }
   }finally{await page.close();}
  }
 }
});

test('equal-size style identities still refuse ambiguous, hidden, or caller-bound text',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');const {tokenCorpusFromJson}=await import('./token-corpus.js');
 const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
 for(const [reason,edit] of [
  ['noncorrelated axis',(s:any)=>{s.variants[1].children[0].text={...s.variants[2].children[0].text};}],
  ['missing font family',(s:any)=>{delete s.variants[0].children[0].text.fontFamily;}],
  ['hidden Compact text in each style branch',(s:any)=>{for(const v of s.variants)if(v.variantProperties.Density==='Compact')v.children[0].hidden=true;}],
  ['one shared text control with different drawn defaults',(s:any)=>{s.propertyDefinitions.Value={type:'TEXT',defaultValue:'开始日期'};for(const v of s.variants)v.children[0].propRefs={characters:'Value'};}],
 ] as const){
  const source=equalSizeNamedStyles();edit(source);
  assert.throws(()=>proposeFromDump(source,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'}),/text-style-identity-refused/,reason);
 }
});
