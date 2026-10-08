import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createFigmaEngine} from './emit-figma-script.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const contract=ContractSchema.parse({id:'test.minted-color',name:'MintedColor',version:'0.1.0',status:'draft',description:'Native color qualification fixture',semantics:{element:'div'},props:[],states:[],anatomy:{root:{literals:{width:'20px',height:'20px','background-color':'#ffffff'}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./MintedColor',export:'MintedColor'}}}});
async function run(values:Record<string,string>){
 const minted=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{$type:'color',$value:v}]));
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:minted,light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const script=engine.buildComponentScript(contract,new Map([[contract.id,contract]]),undefined,minted);
 const {figma}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 return {figma,execute:()=>vm.runInContext('(async()=>{'+script+'})()',context)};
}
test('production provisional writer preserves functional RGB, alpha, short hex and fractional channels',async()=>{
 const h=await run({functional:'rgba(29.000000171363354,29,29,0.37)',rgb:'rgb(0 128 255)',short:'#abc',alpha:'#11223344'});
 await h.execute();const vars=await h.figma.variables.getLocalVariablesAsync();
 const value=(name:string)=>JSON.parse(JSON.stringify(Object.values(vars.find(v=>v.name===name)!.valuesByMode)[0]));
 assert.deepEqual(value('functional'),{r:29.000000171363354/255,g:29/255,b:29/255,a:.37});
 assert.deepEqual(value('rgb'),{r:0,g:128/255,b:1});assert.deepEqual(value('short'),{r:170/255,g:187/255,b:204/255});assert.deepEqual(value('alpha'),{r:17/255,g:34/255,b:51/255,a:68/255});
});
test('malformed provisional color refuses before creating any variables',async()=>{
 for(const bad of ['rgba(1,2,3,NaN)','rgba(1,2,3,2)','rgb(-1,2,3)','rgb(256,2,3)','#zzzzzz']){
  const h=await run({good:'#ffffff',bad});await assert.rejects(h.execute,/minted-color-value-unqualified/);assert.equal((await h.figma.variables.getLocalVariablesAsync()).length,0);
 }
});
