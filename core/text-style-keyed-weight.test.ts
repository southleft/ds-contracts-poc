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
