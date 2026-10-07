import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
import {mapRestToDump} from './rest/map.js';
test('both canonical readers retain visibility values and numeric targets across duplicate names and nested instances',async()=>{
 const {figma:mock}=createFigmaMock(),figma:any=mock;
 const main=figma.createComponent(),nestedMain=figma.createComponent();main.name='Main';nestedMain.name='Nested main';
 const variant=figma.createComponent();variant.name='Case=One';variant.fills=[];
 const instance=(owner:any)=>{const n=figma.createFrame();n.type='INSTANCE';n.name='Shared';n.componentId=owner.id;n.getMainComponentAsync=async()=>owner;return n;};
 const root=instance(main);variant.appendChild(root);
 const text=(parent:any,visible:any)=>{const n=figma.createText();n.name='Duplicate';n.characters='Ink';n.visible=visible;parent.appendChild(n);return n;};
 const a=text(root,true),b=text(root,false),nested=instance(nestedMain);root.appendChild(nested);const c=text(nested,false),defaultVisible=text(root,true);
 root.overrides=[a,b,c,defaultVisible].map(n=>({id:n.id,overriddenFields:['visible']}));
 const set=figma.combineAsVariants([variant],figma.currentPage);set.name='VisibilityCapture';
 const raw=(n:any):any=>({id:n.id,name:n.name,type:n.type,visible:n===defaultVisible?undefined:n.visible,componentId:n.componentId,overrides:n.overrides,fills:[],characters:n.characters,style:{fontFamily:'Inter',fontStyle:'Regular',fontSize:12},absoluteBoundingBox:{x:0,y:0,width:20,height:20},children:n.children?.map(raw)});
 const rest=mapRestToDump({name:'visibility ownership',nodes:{set:{document:raw(set)}}}).dump as any;
 const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,'const TARGET_SETS = ["VisibilityCapture"];');
 const native=JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}\n})()`,{figma,console:{log(){},warn(){},error(){}}})));
 const expected=[
  {nodeId:a.id,instanceId:root.id,componentId:main.id,instancePath:[],childPath:[0],visible:true},
  {nodeId:b.id,instanceId:root.id,componentId:main.id,instancePath:[],childPath:[1],visible:false},
  {nodeId:c.id,instanceId:nested.id,componentId:nestedMain.id,instancePath:[2],childPath:[0],visible:false},
  {nodeId:defaultVisible.id,instanceId:root.id,componentId:main.id,instancePath:[],childPath:[3],visible:true},
 ];
 for(const dump of [rest,native]){
  const rows=dump.VisibilityCapture.variants[0].children[0].hostOverrides;
  assert.equal(rows.length,4);assert.deepEqual(rows.map((h:any)=>h.visibilityTarget),expected);
  assert.equal(rows[0].path,rows[1].path,'duplicate display paths must not collapse distinct override identities');
 }
 const noMain=raw(set);delete noMain.children[0].children[0].componentId;
 const refused=mapRestToDump({name:'unresolved owner',nodes:{set:{document:noMain}}}).dump as any;
 assert.equal(refused.VisibilityCapture.variants[0].children[0].hostOverrides[0].visibilityTarget,undefined);
});
