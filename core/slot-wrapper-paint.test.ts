import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {chromium} from 'playwright-core';import {PNG} from 'pngjs';
import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';import {createFigmaEngine} from './emit-figma-script.js';
test('slot-owned paint matches native backdrop controls and keeps replacement text and clearing',async t=>{
const source=JSON.parse(readFileSync(new URL('./fixtures/solid-fill-composition-native/SOURCE.json',import.meta.url),'utf8'));
const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
const child=structuredClone(base);child.id='ds.slot-ink';child.name='SlotInk';child.anatomy={root:{literals:{width:'8px',height:'8px','background-color':'rgb(128,128,128)'}}};
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:100,height:100}});let exact=0;
for(const [i,row]of source.rows.entries()){
 const c=structuredClone(base);c.anatomy={root:{layout:{display:'flex'},parts:{painted:{layout:{display:'flex',align:'center',justify:'center'},literals:{width:'20px',height:'20px'},solidFillComposition:row.composition,slot:{name:'children',renderDefault:true,defaultContent:[{id:child.id}]}}}}};
 const contracts=new Map([[c.id,c],[child.id,child]]);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);assert.equal(native.variants[0].spec.children![0].solidFillComposition?.blendMode,row.composition.blendMode);
 for(const route of ['module','inline']){
 const emit=(x:any)=>route==='module'?emitReact(x,{tokens:new Set(),icons:new Map(),contracts}):emitReactInline(x,{tokens,icons:new Map(),contracts});const out=emit(c),dep=emit(child);
 if(i===0)assert.deepEqual(generatedTypeErrors(c.name,out.tsx,{[child.name]:dep.tsx}),[]);
 const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'',{[child.name]:dep});
 await page.addStyleTag({content:`html,body{margin:0;background:transparent}#root{width:20px;height:20px;background:${row.backdrop};font:12px Arial}`});
 const png=PNG.sync.read(await page.locator('#root').screenshot({omitBackground:true})),expected=PNG.sync.read(readFileSync(new URL('./fixtures/solid-fill-composition-native/'+row.png,import.meta.url)));assert.deepEqual(png.data,expected.data,route+' '+row.cellId);exact++;
 await render({children:'X'});assert.equal(await page.locator('[data-dsc-slot-foreground]').innerText(),'X');assert.equal(await page.locator('[data-dsc-slot-foreground]').evaluate(n=>getComputedStyle(n).position),'relative');
 await render({children:null});assert.equal(await page.locator('[data-dsc-slot-foreground]').innerText(),'');assert.equal(await page.locator('[data-dsc-slot-foreground]').count(),1);
 }
}assert.equal(exact,48);
});
test('painted slot foreground preserves replacement layout on both React surfaces',async t=>{
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const layouts=[{layout:{display:'flex',direction:'column',align:'start'},declared:{position:'absolute'},literals:{right:'16px',top:'16px'}},{layout:{display:'flex',align:'center',justify:'space-between'},literals:{width:'80px',height:'40px'}},{layout:{display:'flex'},literals:{gap:'7px','padding-inline':'6px','padding-block':'6px',width:'fit-content'}},{layout:{display:'flex',wrap:'wrap'},literals:{width:'50px',gap:'4px'}},{layout:{display:'grid',columns:[{px:30},{px:30}]},literals:{gap:'4px'}},{layout:{display:'flex',direction:'column',align:'stretch'},literals:{width:'90px',gap:'5px'}}];
 const harness=`import {Badge} from './Badge';export function Harness({kind=0}){const content=[<i data-item="" style={{display:'block',width:16,height:16}}/>, 'Hello', <>Hello<b data-item="">world</b></>,<><i data-item="" style={{display:'block',width:32,height:16}}/><i data-item="" style={{display:'block',width:32,height:16}}/></>,<i data-item="" style={{display:'block',width:'100%',height:16,minWidth:8}}/>,<><i data-item="" style={{flex:1,minWidth:20,height:10}}/><i data-item="" style={{flex:2,minWidth:10,height:15}}/></>];return <Badge>{content[kind]}</Badge>}`;
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};const b=await chromium.launch();t.after(()=>b.close());const page=await b.newPage();let comparisons=0;
 for(const layout of layouts)for(const route of ['module','inline']){
  const snapshots:any[][]=[];for(const painted of [false,true]){
   const c=structuredClone(base);c.name='Badge';c.anatomy={root:{declared:{position:'relative'},literals:{width:'200px',height:'100px'},parts:{slot:{element:'div',...layout,slot:{name:'children'},...(painted?{solidFillComposition:{color:{r:1,g:0,b:0},opacity:.5,blendMode:'MULTIPLY'}}:{})}}}};
   const contracts=new Map([[c.id,c]]),out=route==='module'?emitReact(c,{tokens:new Set(),icons:new Map(),contracts}):emitReactInline(c,{tokens,icons:new Map(),contracts});
   const render=await mountGenerated(page,'Harness',harness,'',{Badge:out});await page.addStyleTag({content:'body{margin:0;font:14px Arial}'});const shots=[];
   for(let kind=0;kind<6;kind++){await render({kind});shots.push(await page.locator('#root').evaluate(host=>{const items=[...host.querySelectorAll('[data-item]')].map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT),texts=[];let n;while(n=walker.nextNode()){const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();texts.push([r.x,r.y,r.width,r.height])}return{items,texts}}));}snapshots.push(shots);
  }assert.deepEqual(snapshots[1],snapshots[0],route+' '+JSON.stringify(layout));comparisons+=6;
 }assert.equal(comparisons,72);
});
test('painted slot clearing, optional and collapse gates preserve the existing host lifecycle',async t=>{
 const base=JSON.parse(readFileSync(new URL('../contracts/badge.contract.json',import.meta.url),'utf8'));base.props=[];base.states=[];base.semantics={element:'div'};delete base.a11y;
 const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};const b=await chromium.launch();t.after(()=>b.close());const page=await b.newPage();
 for(const gate of ['optional','collapse'])for(const route of ['module','inline']){
 const c=structuredClone(base);c.anatomy={root:{parts:{slot:{element:'div',layout:{display:'flex'},literals:{width:'20px',height:'20px'},solidFillComposition:{color:{r:1,g:0,b:0},opacity:.5,blendMode:'MULTIPLY'},slot:{name:'children',...(gate==='collapse'?{collapseWhenEmpty:true}:{})},...(gate==='optional'?{optional:true}:{})}}}};
 const contracts=new Map([[c.id,c]]),out=route==='module'?emitReact(c,{tokens:new Set(),icons:new Map(),contracts}):emitReactInline(c,{tokens,icons:new Map(),contracts});const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
 for(const children of ['Text',null,'Again',null]){await render({children});assert.equal(await page.locator('[data-dsc-slot-foreground]').count(),children===null?0:1);assert.equal(await page.locator('#root').innerText(),children??'');}
 const {emitHtml}=await import('./emit-html.js');assert.throws(()=>emitHtml(c,{tokens:new Set(),icons:new Map(),contracts}),/HTML_SLOT_FILL_COMPOSITION_UNQUALIFIED/);
 }
});
