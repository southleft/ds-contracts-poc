import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
import {PLUGIN_DUMP_VERSION,isDumpSet,type DumpCallerOccurrences} from './types.js';

// Protocol controls only. No native capture, public contract or qualification.
const reader=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const plain=(value:any)=>JSON.parse(JSON.stringify(value));
const run=async(figma:any,source=reader)=>{
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}},appearanceText:figma.__appearanceText,appearanceSegments:figma.__appearanceSegments});
 // Native Plugin API values originate in its JS realm; reconstruct that realm
 // in this VM mock without relaxing the existing strict appearance observer.
 if(figma.__appearanceText)vm.runInContext('appearanceText.getStyledTextSegments=()=>JSON.parse(JSON.stringify(appearanceSegments()));',context);
 return plain(await vm.runInContext(`(async()=>{${source}\n})()`,context));
};
const visit=(node:any,fn:(n:any)=>void)=>{fn(node);for(const c of node.children??[])visit(c,fn);};
function fixture(){
 const {figma:mock}=createFigmaMock();const figma:any=mock;figma.fileKey='protocol-control-file';
 const mains=[0,1].map(i=>{
  const main=figma.createComponent();main.name='Mode='+i;main.resize(140,44);
  const slot=main.createSlot();slot.name='Children';slot.limitViolations=[];
  const chrome=figma.createFrame();chrome.name='Inherited layout';chrome.resize(140,44);slot.appendChild(chrome);
  return main;
 });
 const set=figma.combineAsVariants(mains,figma.currentPage);set.name='Arbitrary family';
 const board=figma.createFrame();board.name='Caller board';board.resize(140,44);figma.currentPage.appendChild(board);
 const instance=mains[0].createInstance();instance.name='Different display name';board.appendChild(instance);
 instance.overrides=[{id:instance.id,overriddenFields:['width','pluginData']}];
 const slot=instance.children[0],chrome=slot.children[0];slot.limitViolations=[];
 const text=figma.createText();text.characters='Observed payment';text.fontName={family:'Inter',style:'Regular',variationSettings:{wght:400,slnt:0}};
 text.fontWeight=400;text.textCase='ORIGINAL';text.textDecoration='NONE';text.lineHeight={unit:'AUTO'};text.letterSpacing={unit:'PIXELS',value:0};
 text.fills=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:1}];
 text.getStyledTextSegments=()=>[{start:0,end:text.characters.length,characters:text.characters,fontName:text.fontName,fontSize:text.fontSize,fontWeight:text.fontWeight,lineHeight:text.lineHeight,letterSpacing:text.letterSpacing,textCase:text.textCase,textDecoration:text.textDecoration,fills:text.fills}];
 figma.__appearanceText=text;figma.__appearanceSegments=text.getStyledTextSegments;
 chrome.appendChild(text);
 figma.currentPage.selection=[board];figma.skipInvisibleInstanceChildren=true;
 return {figma,mains,set,board,instance,slot,chrome,text};
}

test('selected FRAME preserves actual INSTANCE/SLOT trees and complete owning family without disposition authority',async()=>{
 const f=fixture(),dump=await run(f.figma),channel:DumpCallerOccurrences=dump._occurrences;
 assert.equal(channel.version,1);assert.equal(isDumpSet(channel),false);assert.deepEqual(channel.requested,[f.board.id]);
 const root=channel.roots[0];assert.equal(root.source.nodeId,f.board.id);assert.equal(root.root.type,'FRAME');
 const instance=root.root.children![0],slot=instance.children![0],capturedText=slot.children![0].children![0];
 assert.equal(instance.type,'INSTANCE');assert.equal(instance.nodeId,f.instance.id);assert.equal(instance.instanceSlotObservation!.mainComponentId,f.mains[0].id);
 assert.equal(instance.instanceSlotObservation!.mainComponentKey,f.mains[0].key);assert.equal(instance.instanceSlotObservation!.ownerId,f.set.id);
 assert.equal(slot.type,'SLOT');assert.equal(slot.nodeId,f.slot.id);assert.equal(slot.slotKey,f.slot.componentPropertyReferences.slotContentId);
 assert.equal(capturedText.text!.characters,f.text.characters);const appearance=capturedText.text!.sourceAppearance;assert(appearance && 'runs' in appearance);assert.deepEqual(appearance.runs[0].fontName.variationSettings,{wght:400,slnt:0});
 assert.deepEqual(instance.instanceSlotObservation!.slots[0].assignmentDisposition,{status:'unsupported',code:'caller-slot-assignment-disposition-unobserved'});
 assert.equal(root.lowering.status,'unsupported');assert.equal(dump['Arbitrary family'].variants.length,2);
 assert.equal(channel.dependencyInventory,'complete');assert.equal(dump._provenance.closure.unresolved.length,0);assert.equal(dump._provenance.closure.cycles.length,0);
 assert(dump._degradations.some((d:any)=>d.code==='caller-slot-assignment-disposition-unobserved'));
 assert.equal(f.figma.skipInvisibleInstanceChildren,true);
});

test('explicit occurrence IDs use physical identity and ignore display-name changes',async()=>{
 const f=fixture();f.figma.currentPage.selection=[];f.board.name='renamed';
 const dump=await run(f.figma,reader.replace('const TARGET_OCCURRENCES = [];',`const TARGET_OCCURRENCES = [${JSON.stringify(f.board.id)}];`));
 assert.equal(dump._occurrences.roots[0].source.nodeId,f.board.id);assert.equal(dump._occurrences.roots[0].root.name,'renamed');
});

test('direct selected INSTANCE and GROUP roots retain native root types',async()=>{
 for(const type of ['INSTANCE','GROUP']){
  const f=fixture();if(type==='GROUP')f.board.type='GROUP';f.figma.currentPage.selection=[type==='INSTANCE'?f.instance:f.board];
  const dump=await run(f.figma);assert.equal(dump._occurrences.roots[0].root.type,type);
 }
});

test('nested filled INSTANCE dependencies are included without changing main defaults',async()=>{
 const f=fixture(),child= f.figma.createComponent();child.name='Nested child';f.figma.currentPage.appendChild(child);
 const childSlot=child.createSlot();childSlot.name='Nested input';const nested=child.createInstance();nested.overrides=[];f.chrome.appendChild(nested);
 const text=f.figma.createText();text.characters='Nested actual label';nested.children[0].appendChild(text);
 const before=JSON.stringify(child.children.map((n:any)=>n.children.map((c:any)=>c.id)));
 const dump=await run(f.figma);assert(dump['Nested child']);
 const ids=dump._occurrences.roots[0].requiredMains.map((r:any)=>r.componentId);assert(ids.includes(child.id));
 const nodes:any[]=[];visit(dump._occurrences.roots[0].root,n=>nodes.push(n));assert(nodes.some(n=>n.text?.characters==='Nested actual label'));
 assert.equal(JSON.stringify(child.children.map((n:any)=>n.children.map((c:any)=>c.id))),before);
});

test('selected swaps without a physical descendant remain dependencies',async()=>{
 const f=fixture(),target=f.figma.createComponent();target.name='Selected hidden swap';f.figma.currentPage.appendChild(target);
 f.instance._allProps['Content swap#77:1']={type:'INSTANCE_SWAP',value:target.id};
 const dump=await run(f.figma);assert(dump['Selected hidden swap']);assert(dump._occurrences.roots[0].requiredMains.some((v:any)=>v.componentId===target.id));
});

test('unknown SLOT value and pluginData-only overrides never become assignment evidence',async()=>{
 const f=fixture(),key=f.slot.componentPropertyReferences.slotContentId;f.instance._allProps[key]={type:'SLOT',value:{guid:'opaque'},preferredValues:[]};
 f.instance.overrides=[{id:f.slot.id,overriddenFields:['pluginData']}];
 const dump=await run(f.figma),observation=dump._occurrences.roots[0].root.children[0].instanceSlotObservation;
 assert.deepEqual(observation.componentProperties[key].value,{guid:'opaque'});assert.equal(observation.slots[0].assignmentDisposition.status,'unsupported');
});

for(const [label,mutate,expected] of [
 ['array non-index native member',(f:any)=>{const value:any[]=[];(value as any)['4294967295']='must not disappear';f.instance._allProps[f.slot.componentPropertyReferences.slotContentId].value=value;},/RAW_WITNESS_UNSUPPORTED/],
 ['opaque native property',(f:any)=>{f.instance._allProps['opaque#80:1']={type:'TEXT',value:new Date(0)};},/RAW_WITNESS_UNSUPPORTED/],
 ['hidden native witness member',(f:any)=>{const property=f.instance._allProps[f.slot.componentPropertyReferences.slotContentId];property.value={visible:'carried'};Object.defineProperty(property.value,'hidden',{value:'not-carried',enumerable:false});},/RAW_WITNESS_UNSUPPORTED/],
 ['malformed native record',(f:any)=>{const main=f.mains[0];Object.defineProperty(main.parent,'componentPropertyDefinitions',{get:()=>42,configurable:true});},/NATIVE_WITNESS_INCOMPLETE/],
 ['selected main absent from owner',(f:any)=>{f.set.children=f.set.children.filter((n:any)=>n!==f.mains[0]);},/OWNER_MEMBERSHIP_DISAGREEMENT/],
 ['main declaration child wrong parent',(f:any)=>{f.mains[0].children[0].children[0].parent=f.board;},/DECLARATION_PARENT_DISAGREEMENT/],
 ['raw slot mismatch',(f:any)=>{f.slot.componentPropertyReferences.slotContentId='Foreign#88:1';},/SLOT_INVENTORY_DISAGREEMENT/],
 ['ambiguous repeated SLOT binding',(f:any)=>{const extra=f.figma.createFrame();extra.type='SLOT';extra.componentPropertyReferences={...f.slot.componentPropertyReferences};f.instance.appendChild(extra);},/SLOT_BINDING_AMBIGUOUS/],
 ['missing SLOT property',(f:any)=>{delete f.instance._allProps[f.slot.componentPropertyReferences.slotContentId];},/SLOT_PROPERTY_DISAGREEMENT/],
 ['wrong parent',(f:any)=>{f.text.parent=f.board;},/PARENT_DISAGREEMENT/],
 ['unreadable main',(f:any)=>{f.instance.getMainComponentAsync=async()=>null;},/MAIN_IDENTITY_REQUIRED/],
 ['changed main between independent reads',(f:any)=>{let reads=0;const other=f.mains[1];f.instance.getMainComponentAsync=async()=>++reads===1?f.mains[0]:other;},/MAIN_CHANGED/],
 ['foreign swap ID',(f:any)=>{f.instance._allProps['swap#80:1']={type:'INSTANCE_SWAP',value:'foreign'};},/MAIN_IDENTITY_REQUIRED/],
 ['dependency cycle',(f:any)=>{const recursive=f.mains[0].createInstance();recursive.overrides=[];f.mains[0].children[0].appendChild(recursive);},/DEPENDENCY_CAPTURE_CYCLE/],
] as const)test('strict reader refuses '+label+' and restores traversal flag',async()=>{
 const f=fixture();mutate(f);await assert.rejects(run(f.figma),expected);assert.equal(f.figma.skipInvisibleInstanceChildren,true);
});

test('bounded reader refuses complete-tree overflow without truncating',async()=>{
 const f=fixture();await assert.rejects(run(f.figma,reader.replace('const DEPENDENCY_NODE_CAP = 50000;','const DEPENDENCY_NODE_CAP = 3;')),/CALLER_OCCURRENCE_NODE_CAP/);assert.equal(f.figma.skipInvisibleInstanceChildren,true);
});

test('ordinary declared capture has no occurrence channel or new instance observation',async()=>{
 const f=fixture();f.figma.currentPage.selection=[f.set];const after=await run(f.figma);
 assert.equal(after._occurrences,undefined);assert.equal(after._provenance.dumpVersion,PLUGIN_DUMP_VERSION);
 assert.equal(after['Arbitrary family'].variants.length,2);
 for(const variant of after['Arbitrary family'].variants)visit(variant,n=>assert.equal(n.instanceSlotObservation,undefined));
});

test('filled text paint, native image bytes and variable bindings use current channels',async()=>{
 const f=fixture();const collection=f.figma.variables.createVariableCollection('Current tokens');const variable=f.figma.variables.createVariable('ink/actual',collection,'COLOR');variable.setValueForMode(collection.modes[0].modeId,{r:1,g:0,b:0});
 const paint={type:'SOLID',color:{r:1,g:0,b:0},opacity:1,boundVariables:{color:{type:'VARIABLE_ALIAS',id:variable.id}}};f.text.fills=[paint];
 const image=f.figma.createRectangle();image.fills=[{type:'IMAGE',imageHash:'original-control-bytes',scaleMode:'FILL'}];f.chrome.appendChild(image);
 const bytes=Uint8Array.from([137,80,78,71,13,10,26,10]);f.figma.getImageByHash=()=>({getBytesAsync:async()=>bytes});f.figma.base64Encode=(b:Uint8Array)=>Buffer.from(b).toString('base64');
 const dump=await run(f.figma);assert.equal(dump._variables['ink/actual'].value,'#ff0000');assert.deepEqual(Buffer.from(dump._imageAssets['original-control-bytes'].base64,'base64'),Buffer.from(bytes));
 const nodes:any[]=[];visit(dump._occurrences.roots[0].root,n=>nodes.push(n));assert(nodes.some(n=>n.text?.fillVar==='ink/actual'));assert(nodes.some(n=>n.imageFill));
});


test('owner reparenting after occurrence observation refuses retained source identity',async()=>{
 const f=fixture(),spare=f.figma.createComponent();spare.name='Mode=Spare';const changed=f.figma.combineAsVariants([spare],f.figma.currentPage);changed.name='Changed live owner';
 f.figma.__postObservation=()=>changed.appendChild(f.mains[0]);
 // Deliberate protocol race at the observation/family phase boundary. This
 // hook is injected into this test's source string only, never the reader.
 const control=reader.replace('if (INCLUDE_DEPENDENCIES || observedOccurrences) {','figma.__postObservation();\nif (INCLUDE_DEPENDENCIES || observedOccurrences) {');
 await assert.rejects(run(f.figma,control),/CALLER_OCCURRENCE_CAPTURED_MAIN_IDENTITY_CHANGED/);assert.equal(f.figma.skipInvisibleInstanceChildren,true);
});
