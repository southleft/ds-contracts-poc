import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated} from './react-test-runtime.js';
import {mintedTokenCss} from './mint-tokens.js';
import {tokenInventoryFromJson} from './tokens.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {validateContract} from '../packages/core/src/validate.js';

const primitives={floor:{width:{$value:'24px',$type:'dimension'},height:{$value:'18px',$type:'dimension'}}};
const tokens={primitives,semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(kind:'single'|'joint'|'base',bound:'token'|'literal',direction:'row'|'column'){
 const map={fixed:{grow:false},fill:{grow:true,growBasis:'zero'}};
 return ContractSchema.parse({id:'test.growth-floor',name:'GrowthFloor',version:'0.1.0',status:'draft',description:'Explicit item floors under changing available space',
  semantics:{element:'div'},props:[{name:'mode',type:{enum:['fixed','fill']},default:'fixed',bindings:{figma:{kind:'VARIANT',property:'Mode'},code:{prop:'mode'}}},{name:'tone',type:{enum:['a','b']},default:'a',bindings:{figma:{kind:'VARIANT',property:'Tone'},code:{prop:'tone'}}}],states:[],
  anatomy:{root:{layout:{display:'flex',direction},literals:{width:'120px',height:'120px'},parts:{item:{layout:{display:'flex',...(kind==='base'?{grow:true,growBasis:'zero'}:{})},
   ...(bound==='token'?{tokens:{'min-width':'{floor.width}','min-height':'{floor.height}'}}:{literals:{'min-width':'24px','min-height':'18px'}}),
   ...(kind==='base'?{}:kind==='single'?{layoutByProp:{prop:'mode',map}}:{layoutByCombination:{props:['mode','tone'],rows:Object.entries(map).flatMap(([mode,layout])=>['a','b'].map(tone=>({values:[mode,tone],layout})))}}),
   parts:{mark:{shape:{kind:'rect',width:2,height:2}}}}}}},bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:null}},code:{anchors:{importPath:'./GrowthFloor',export:'GrowthFloor'}}}});
}
test('explicit base floors survive conditional growth and shrinking space in both React consumers',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();
 for(const kind of ['single','joint','base'] as const)for(const bound of ['token','literal'] as const)for(const direction of ['row','column'] as const){
  const c=fixture(kind,bound,direction),contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
  const outputs=[emitReact(c,{contracts,icons,tokens:tokenInventoryFromJson([primitives])}),{...emitReactInline(c,{contracts,icons,tokens}),css:''}];
  for(const output of outputs){const render=await mountGenerated(page,c.name,output.tsx,mintedTokenCss(primitives)+output.css);
   for(const mode of ['fixed','fill'])for(const tone of ['a','b'])for(const available of [12,120]){
    await render({mode,tone});const actual=await page.locator('#root > :first-child').evaluate((root,available)=>{const r=root as HTMLElement;r.style.width=available+'px';r.style.height=available+'px';const item=r.children[0] as HTMLElement,box=item.getBoundingClientRect(),style=getComputedStyle(item);return {width:box.width,height:box.height,minWidth:style.minWidth,minHeight:style.minHeight};},available);
    const expected={width:direction==='row'&&mode==='fixed'&&kind!=='base'?24:Math.max(24,available),height:direction==='column'&&mode==='fixed'&&kind!=='base'?18:Math.max(18,available),minWidth:'24px',minHeight:'18px'};
    assert.deepEqual(actual,expected,JSON.stringify({kind,bound,direction,mode,tone,available}));
   }
  }
  const data=createFigmaEngine({tokens,icons}).compileComponentData(c,contracts);
  for(const variant of data.variants){const item=variant.spec.children!.find(n=>n.name==='item')!;assert(item);if(bound==='literal'){assert.equal(item.lits?.minWidth,24);assert.equal(item.lits?.minHeight,18);}else{assert.equal(item.bindings?.minWidth,'floor/width');assert.equal(item.bindings?.minHeight,'floor/height');}}
 }
});
test('conditional floors and explicit flex authority still refuse constrained growth',()=>{
 for(const field of ['min-width','min-height','flex-basis','min-inline-size']){const c=fixture('joint','literal','row');const item=c.anatomy.root.parts!.item;
  item.declared={[field]:'24px'};const errors:string[]=[];validateContract(c,new Map([[c.id,c]]),errors,new Map());assert(errors.some(e=>e.includes('growth-constraint-unproven')),field);
 }
});
