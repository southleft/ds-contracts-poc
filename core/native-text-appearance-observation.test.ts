import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {observeTextAppearance} from '../extract/figma/text-appearance-observation.js';
import {nativeTextAppearanceMatches} from './native-text-appearance-observation.js';
import {emitNativeInventoryReadbackScript} from './native-source-observation.js';
function fixture(){const characters='AB\nC',segments=[{start:0,end:3},{start:3,end:4}].map((r,i)=>({...r,characters:characters.slice(r.start,r.end),fontName:{family:'Inter',style:'Regular'},fontSize:14,fontWeight:400,lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',fills:[{type:'SOLID',color:{r:0,g:0,b:i}}]}));return{characters,segments,expected:observeTextAppearance(characters,segments)!};}
test('independent range comparison rejects text, style, paint and coverage tampering',()=>{
 const f=fixture();assert.equal(nativeTextAppearanceMatches(f.expected,f.characters,f.segments),true);
 for(const mutate of [(s:any)=>{s[1].fills[0].color.b=0;},(s:any)=>{s[1].fontWeight=500;},(s:any)=>{s[1].lineHeight={unit:'PIXELS',value:20};},(s:any)=>{s[1].start=2;},(s:any)=>{s[0].characters='wrong';},(s:any)=>{s[1].fills[0].boundVariables={color:{id:'foreign'}};},(s:any)=>s.pop()]){const s=structuredClone(f.segments);mutate(s);assert.equal(nativeTextAppearanceMatches(f.expected,f.characters,s),false,String(mutate));}
 assert.equal(nativeTextAppearanceMatches(f.expected,'stale',f.segments),false);
 const split=[{...f.segments[0],end:1,characters:'A'},{...f.segments[0],start:1,characters:'B\n'},f.segments[1]];
 assert.equal(nativeTextAppearanceMatches(f.expected,f.characters,split),true);
});
test('independent inventory captures marked native ranges twice and detects between-read drift',async()=>{
 for(const drift of [false,true]){
  const f=fixture();let count=0;
  const node:any={id:'text',type:'TEXT',name:'Description',characters:f.characters,children:[],getSharedPluginData:(_:string,key:string)=>key==='textAppearanceOverride'?'contract:appearance':'',getStyledTextSegments:()=>{count++;const s=structuredClone(f.segments);if(drift&&count===2)s[1].fontSize=16;return s;}};
  const page:any={id:'page',type:'PAGE',children:[node],findAll:()=>[node],getSharedPluginData:()=>''};node.parent=page;
  const figma={fileKey:'file',loadAllPagesAsync:async()=>{},getNodeByIdAsync:async()=>page};
  const script=emitNativeInventoryReadbackScript({operation:{id:'op',fileKey:'file'},planRevision:'revision',pageId:'page',nodes:[],comparisons:[]},{}as any,{}as any,['textAppearanceOverride'],false,false,[],[],false,[],false,false,"return {status:'readback-collected',receipt:{}};");
  const result=await vm.runInNewContext('(async()=>{'+script+'})()',{figma});assert.equal(count,2);
  if(drift)assert.notEqual(result.status,'native-readback-collected');else{assert.equal(result.status,'native-readback-collected');assert.equal(nativeTextAppearanceMatches(f.expected,f.characters,result.nodes.find((n:any)=>n.id==='text').values.textAppearanceRuns),true);}
 }
});
