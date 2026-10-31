import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyDump,classifyStoryArgs} from './grammar.js';
import type {DumpFile,DumpNode,DumpSet} from './types.js';

const row = (children:DumpNode[] = [], extra:Partial<DumpNode> = {}):DumpNode => ({
  name:'row',type:'FRAME',layout:{mode:'HORIZONTAL',padding:[4,8,4,8],primarySizing:'AUTO',counterSizing:'AUTO',spacing:4},children,...extra,
});
const text = (characters:string):DumpNode => ({name:characters,type:'TEXT',text:{characters,fontSize:14,fontStyle:'Regular'}} as DumpNode);
const vector:DumpNode = {name:'path',type:'VECTOR'};
const set = (setName:string,variants:DumpNode[],extra:Partial<DumpSet> = {}):DumpSet => ({setName,type:'COMPONENT_SET',variants,...extra});
const variant = (child:DumpNode,extra:Partial<DumpNode> = {}):DumpNode => ({...row([child]),name:'State=Default',type:'COMPONENT',...extra});
const verdict = (file:DumpFile,key:string) => classifyDump(file)[key];

test('an auto-layout set with solid paint, one stroke, a drop shadow and plain properties is in grammar', () => {
  const button = set('Button',[variant(text('Label'),{fill:{hex:'ffffff'},stroke:{hex:'000000'},strokeWeight:1,cornerRadius:4,
    effects:[{type:'DROP_SHADOW',radius:2}],sourceFillStack:{version:1,order:'bottom-to-top',complete:true,paints:[{index:0,paint:{type:'SOLID'}},{index:1,paint:{type:'IMAGE',visible:false}}]}})],
    {propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'md',variantOptions:['sm','md']},Icon:{type:'BOOLEAN',defaultValue:true},Label:{type:'TEXT',defaultValue:'Label'}}});
  assert.deepEqual(verdict({Button:button} as DumpFile,'Button'),{grammar:'in',reasons:[]});
});

test('a set whose name starts with an underscore is still a set, and metadata is not', () => {
  const file = {_Text:set('_Text',[variant({name:'clip',type:'RECTANGLE',mask:{type:'ALPHA'}})]),_degradations:[]} as unknown as DumpFile;
  assert.deepEqual(Object.keys(classifyDump(file)),['_Text']);
  assert.deepEqual(verdict(file,'_Text').reasons,['mask']);
});

test('each out-of-grammar fact is named, and the reasons come back sorted', () => {
  const v = variant(row([
    row([text('a')],{layout:{mode:'GRID',padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'}}),
    row([text('b')],{layout:{mode:'HORIZONTAL',wrap:true,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'}}),
    {...text('badge'),abs:{x:0,y:0,right:0,bottom:0,width:8,height:8}},
    {name:'clip',type:'RECTANGLE',mask:{type:'ALPHA'}},
    {name:'photo',type:'RECTANGLE',imageFill:true},
    {name:'ramp',type:'RECTANGLE',gradient:{start:{x:0,y:0},end:{x:1,y:0},stops:[]}},
    {name:'border',type:'RECTANGLE',sourceStrokePattern:{version:1,complete:true,dashes:[2,2]}},
    {name:'stack',type:'RECTANGLE',sourceStrokeStack:{version:1,order:'bottom-to-top',complete:true,paints:[{index:0,paint:{type:'SOLID'}},{index:1,paint:{type:'SOLID'}}]}},
    {name:'glow',type:'RECTANGLE',effects:[{type:'LAYER_BLUR',radius:4},{type:'INNER_SHADOW'}]},
  ]));
  assert.deepEqual(verdict({Card:set('Card',[v])} as DumpFile,'Card'),{grammar:'out',reasons:[
    'absolute-child','dashed-stroke','effect-inner-shadow','effect-layer-blur','gradient-fill','grid-layout','image-fill','layout-wrap','mask','multiple-strokes',
  ]});
});

test('a free-form frame holding text is out; a drawing (no text, no auto layout) is in wherever it sits', () => {
  const icon:DumpNode = {name:'Icon / Check',type:'INSTANCE',instanceOf:'Icon / Check'};
  const freeForm = {name:'Field',type:'FRAME',children:[text('Label'),row()]} as DumpNode;
  const box = {name:'Box',type:'FRAME',stroke:{hex:'000000'},children:[{...icon,abs:{x:1,y:1,right:1,bottom:1,width:14,height:14}}]} as DumpNode;
  const drawn = {name:'Icon=Check',type:'COMPONENT',children:[vector,{name:'group',type:'GROUP',children:[vector]},{...icon,abs:{x:0,y:0,right:0,bottom:0,width:24,height:24}}]} as DumpNode;
  const placed = variant({...icon,abs:{x:0,y:0,right:0,bottom:0,width:8,height:8}});
  const file = {Field:set('Field',[variant(freeForm)]),Checkbox:set('Checkbox',[variant(box)]),Icon:set('Icon',[drawn]),Dot:set('Dot',[placed])} as DumpFile;
  assert.deepEqual(verdict(file,'Field').reasons,['free-form-frame']);
  assert.deepEqual(verdict(file,'Checkbox'),{grammar:'in',reasons:[]});
  assert.deepEqual(verdict(file,'Icon'),{grammar:'in',reasons:[]});
  assert.deepEqual(verdict(file,'Dot').reasons,['absolute-child']);
});

test('degradations count for their own set only, and a rotated vector is part of an SVG', () => {
  const file = {Tag:set('Tag',[variant(text('t'))]),Chip:set('Chip',[variant(text('c'))]),_degradations:[
    {code:'rotation-unsupported',nodePath:'Tag:State=Default/arrow',message:'rotation 3.14 on a VECTOR has no dump projection'},
    {code:'paint-stack-truncated',nodePath:'Tag:State=Default',message:'fill: 2 visible fill paints'},
    {code:'text-channel-unsupported',nodePath:'Tag:State=Default/t',message:'numeric fontWeight is mixed or unavailable across character ranges'},
    {code:'text-channel-unsupported',nodePath:'Tag:State=Default/t',message:'native fontWeight variable unavailable'},
    {code:'rotation-unsupported',nodePath:'Chip:State=Default',message:'rotation 0.5 on a FRAME has no dump projection'},
  ]} as unknown as DumpFile;
  assert.deepEqual(verdict(file,'Tag').reasons,['mixed-text-style','multiple-fills']);
  assert.deepEqual(verdict(file,'Chip').reasons,['rotation']);
});

test('an instance of, or a swap to, an out-of-grammar set takes the parent out, through chains', () => {
  const masked = set('Masked',[{...variant(text('m')),componentKey:'k-masked'}],{key:'s-masked'});
  masked.variants[0].children!.push({name:'clip',type:'RECTANGLE',mask:{type:'ALPHA'}});
  const middle = set('Middle',[{...variant({name:'m',type:'INSTANCE',instanceKey:'k-masked'}),componentKey:'k-middle'}]);
  const top = set('Top',[variant({name:'mid',type:'INSTANCE',instanceKey:'k-middle'})]);
  const picker = set('Picker',[variant(text('p'))],{propertyDefinitions:{Icon:{type:'INSTANCE_SWAP',defaultValue:'',preferredValues:[{type:'COMPONENT_SET',key:'s-masked'}]}}});
  const v = classifyDump({Masked:masked,Middle:middle,Top:top,Picker:picker} as DumpFile);
  assert.deepEqual(v.Middle.reasons,['nested-component-out-of-grammar']);
  assert.deepEqual(v.Top.reasons,['nested-component-out-of-grammar']);
  assert.deepEqual(v.Picker.reasons,['instance-swap-out-of-grammar']);
});

test('story arguments: option lists, true/false and text are in; actions are ignored; the rest is named', () => {
  assert.deepEqual(classifyStoryArgs({
    size:{control:'select',options:['sm','md']},tone:{type:{name:'enum',value:['a','b']}},disabled:{type:{name:'boolean'}},
    label:{control:{type:'text'}},onClick:{type:{name:'function'}},
  }),{grammar:'in',reasons:[]});
  assert.deepEqual(classifyStoryArgs({
    count:{control:'number'},style:{control:{type:'object'}},children:{type:{name:'other'}},variant:{control:'radio'},
  }).reasons,['arg-number','arg-object','arg-other','arg-radio-without-options']);
});
