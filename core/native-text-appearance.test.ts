import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {mapNativeTextAppearances,NATIVE_TEXT_APPEARANCE_RUNTIME} from './native-text-appearance.js';
const appearance={characters:'A\nB',runs:[{start:0,end:2},{start:2,end:3}].map((r,i)=>({...r,fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fill:{paint:{color:{r:0,g:0,b:i},opacity:1,blendMode:'NORMAL'}}}))};
const contract=()=>ContractSchema.parse({id:'test.appearance-native',name:'AppearanceNative',version:'0.1.0',status:'draft',description:'Native ranges',semantics:{element:'div'},props:[{name:'appearance',type:{enum:['observed']},bindings:{code:{prop:'appearance'},figma:{kind:'NONE'}}}],states:[],anatomy:{root:{parts:{text:{text:appearance.characters,textAppearanceOverride:{prop:'appearance',choices:{observed:appearance}}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./AppearanceNative',export:'AppearanceNative'}}}});
function target(){const rows=new Map<number,any>(),calls:any[]=[];const n:any={type:'TEXT',characters:appearance.characters,children:[],getSharedPluginData:()=>contract().id+':appearance',calls};
 for(const name of ['FontName','FontSize','LineHeight','LetterSpacing','TextCase','TextDecoration','Fills'])n['setRange'+name]=(start:number,end:number,value:any)=>{calls.push(name);const row=rows.get(start)??{start,end,characters:n.characters.slice(start,end),fontWeight:400};row[name[0].toLowerCase()+name.slice(1)]=value;rows.set(start,row);};
 n.getStyledTextSegments=(_:unknown,start:number)=>[rows.get(start)];return n;}
function execution(children:any[],failFont=false){const figma={skipInvisibleInstanceChildren:true,loadFontAsync:async()=>{if(failFont)throw Error('missing font');}};return{figma,run:()=>vm.runInNewContext('(async()=>{'+NATIVE_TEXT_APPEARANCE_RUNTIME+'})()',{figma,node:{children},spec:{instanceTextAppearances:mapNativeTextAppearances(contract(),{appearance:'observed'}, {})}})};}
test('native mapper preserves omission and resolves finite references and maps',()=>{
 const c=contract(),expected=mapNativeTextAppearances(c,{appearance:'observed'},{});
 assert.deepEqual(mapNativeTextAppearances(c,{appearance:'{selected}'},{selected:'observed'}),expected);
 assert.deepEqual(mapNativeTextAppearances(c,{appearance:{prop:'selected',map:{yes:'observed'}}},{selected:'yes'}),expected);
 assert.equal(mapNativeTextAppearances(c,{},{}),undefined);assert.throws(()=>mapNativeTextAppearances(c,{appearance:'bad'},{}),/unqualified/);
});
test('native writer reads every applied range and restores visibility flag',async()=>{
 const n=target(),e=execution([n]);await e.run();assert.equal(n.calls.length,14);assert.equal(e.figma.skipInvisibleInstanceChildren,true);
 const bad=target();bad.getStyledTextSegments=()=>[];const failed=execution([bad]);await assert.rejects(failed.run,/readback-incomplete/);assert.equal(failed.figma.skipInvisibleInstanceChildren,true);
});
test('missing, duplicate, nested, stale text and missing font refuse before range writes',async()=>{
 for(const kind of ['missing','duplicate','nested','characters','font']){
  const n=target();let children=[n];if(kind==='missing')children=[];if(kind==='duplicate')children=[n,target()];if(kind==='nested')children=[{type:'INSTANCE',children:[n]} as any];if(kind==='characters')n.characters='stale';
  const e=execution(children,kind==='font');await assert.rejects(e.run,/unqualified|missing font/);assert.equal(n.calls.length,0);assert.equal(e.figma.skipInvisibleInstanceChildren,true);
 }
});
test('production native compiler routes appearance only to selected instance',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');const c=contract();
 const parent=ContractSchema.parse({...c,id:'test.appearance-parent',name:'AppearanceParent',props:[],anatomy:{root:{parts:{omitted:{component:{id:c.id}},selected:{component:{id:c.id,props:{appearance:'observed'}}}}}}});
 const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}),byId=new Map([[c.id,c],[parent.id,parent]]);
 const data=engine.compileComponentData(parent,byId);assert.equal(data.variants[0].spec.children?.[0].instanceTextAppearances,undefined);assert.deepEqual(data.variants[0].spec.children?.[1].instanceTextAppearances,mapNativeTextAppearances(c,{appearance:'observed'},{}));
 assert.match(engine.buildComponentScript(parent,byId),/text-appearance-native-readback-mismatch/);
});
