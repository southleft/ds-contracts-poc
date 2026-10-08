import test from 'node:test';
import {ContractSchema} from '../scripts/contract-schema.js';
import assert from 'node:assert/strict';
import {capturedTokensFromDump,foldVariablePath} from './captured-tokens.js';
import {D2C_KITS,proposeKit} from '../extract/figma/census/design-to-code.js';

const dump = () => ({
  _variables: {
    'Static/Label Large/Size': {type:'FLOAT',value:14},
    'Static/Label Large/Line Height': {type:'FLOAT',value:20},
    'Schemes/On Surface': {type:'COLOR',value:'#112233'},
  },
  StatusLabel: {setName:'StatusLabel',nodeId:'1:1',variants:[{name:'Default',nodeId:'1:2',children:[{
    type:'TEXT',name:'Label',text:{characters:'Status',fontFamily:'Roboto',fontStyle:'Medium',fontSize:14,
      fontSizeVar:'Static/Label Large/Size',lineHeight:20,lineHeightVar:'Static/Label Large/Line Height',fillVar:'Schemes/On Surface'},
    fill:{color:'#112233',var:'Schemes/On Surface'},
  }]}]},
});

test('native whitespace names register and propose the same paths, retaining original names and values',()=>{
  const input=dump(),before=JSON.stringify(input),layer=capturedTokensFromDump(input)!;
  assert.equal(layer.skipped.length,0);
  assert.deepEqual(layer.entries.map(e=>[e.name,e.path,e.value]),[
    ['Static/Label Large/Size','Static.Label-Large.Size','14px'],
    ['Static/Label Large/Line Height','Static.Label-Large.Line-Height','20px'],
    ['Schemes/On Surface','Schemes.On-Surface','#112233'],
  ]);
  const batch=proposeKit(D2C_KITS.find(k=>k.kit==='figma-ds')!,input as any);
  assert.deepEqual(batch.skipped,[]);
  const proposal=batch.proposals[0],part=ContractSchema.parse(proposal.contract).anatomy.root.parts!.Label;
  assert.equal(part.tokens!['font-size'],'{Static.Label-Large.Size}');
  assert.equal(part.tokens!['line-height'],'{Static.Label-Large.Line-Height}');
  assert(proposal.notes.some(n=>n.includes('Static/Label Large/Size')&&n.includes('canvas name remains unchanged')));
  assert.equal(JSON.stringify(input),before);
});

test('whitespace and literal-hyphen identities cannot share a registered value in either input order',()=>{
  for(const pairs of [[['A B',14],['A-B',18]],[['A-B',18],['A B',14]],[['A B',14],['A\tB',14]]]) {
    const input={_variables:Object.fromEntries(pairs.map(([name,value])=>[name,{type:'FLOAT',value}]))};
    assert.throws(()=>capturedTokensFromDump(input),/captured-variable-name-fold-collision/);
  }
});

test('bound names also refuse collisions when no captured variable table exists',()=>{
  const input=dump();delete (input as any)._variables;
  input.StatusLabel.variants[0].children[0].text.lineHeightVar='Static/Label-Large/Size';
  const batch=proposeKit(D2C_KITS.find(k=>k.kit==='figma-ds')!,input as any);
  assert.equal(batch.proposals.length,0);
  assert(batch.skipped.some(s=>s.reason.includes('captured-variable-name-fold-collision')));
});

test('existing legal paths and one-dot-leader handling remain stable',()=>{
  assert.deepEqual(foldVariablePath('brand/action/primary'),{path:'brand.action.primary',folded:false});
  assert.deepEqual(foldVariablePath('spacing/1․5'),{path:'spacing.1-5',folded:true});
  assert.deepEqual(foldVariablePath('Static/Label  Large/Size'),{path:'Static.Label--Large.Size',folded:true});
});

test('contextual paint parentheses retain values and bind through the same registered path',()=>{
  const input=dump(),name='border-subtle (contextual)';
  input._variables={[name]:{type:'COLOR',value:'#112233'}} as any;
  const label=input.StatusLabel.variants[0].children[0];
  label.fill.var=name;label.text.fillVar=name;
  delete (label.text as any).fontSizeVar;delete (label.text as any).lineHeightVar;
  const before=JSON.stringify(input),layer=capturedTokensFromDump(input)!;
  assert.deepEqual(layer.skipped,[]);
  assert.equal(layer.entries[0].path,'border-subtle--u28-contextual-u29-');
  assert.equal(layer.entries[0].name,name);assert.equal(layer.entries[0].value,'#112233');
  const batch=proposeKit(D2C_KITS.find(k=>k.kit==='figma-ds')!,input as any);
  assert.deepEqual(batch.skipped,[]);
  const proposal=batch.proposals[0],part=ContractSchema.parse(proposal.contract).anatomy.root.parts!.Label;
  assert.equal(part.tokens!.color,'{border-subtle--u28-contextual-u29-}');
  assert(proposal.notes.some(n=>n.includes(name)&&n.includes('canvas name remains unchanged')));
  assert.equal(JSON.stringify(input),before);
});

test('encoded parentheses cannot alias a literal spelling in either input order',()=>{
  for(const names of [['paint(x)','paint-u28-x-u29-'],['paint-u28-x-u29-','paint(x)']]) {
    const input={_variables:Object.fromEntries(names.map((name,i)=>[name,{type:'COLOR',value:i?'#ffffff':'#000000'}]))};
    assert.throws(()=>capturedTokensFromDump(input),/captured-variable-name-fold-collision/);
  }
});

test('non-ASCII variable names register and bind the same lossless codepoint spelling',()=>{
 const input=dump(),name='🌮 Font Size/Body M',height='🌮 Line Height/Body M';
 input._variables={[name]:{type:'FLOAT',value:14},[height]:{type:'FLOAT',value:20}} as any;
 const label=input.StatusLabel.variants[0].children[0];
 label.text.fontSizeVar=name;label.text.lineHeightVar=height;
 delete (label.text as any).fillVar;delete (label.fill as any).var;
 const layer=capturedTokensFromDump(input)!;
 assert.deepEqual(layer.skipped,[]);
 assert.deepEqual(layer.entries.map(e=>[e.name,e.path,e.value]),[
  [name,'-u1f32e--Font-Size.Body-M','14px'],[height,'-u1f32e--Line-Height.Body-M','20px']]);
 const batch=proposeKit(D2C_KITS.find(k=>k.kit==='figma-ds')!,input as any);
 assert.deepEqual(batch.skipped,[]);
 const part=ContractSchema.parse(batch.proposals[0].contract).anatomy.root.parts!.Label;
 assert.equal(part.tokens!['font-size'],'{-u1f32e--Font-Size.Body-M}');
 assert.equal(part.tokens!['line-height'],'{-u1f32e--Line-Height.Body-M}');
 assert(batch.proposals[0].notes.some(n=>n.includes(name)&&n.includes('canvas name remains unchanged')));
 assert.deepEqual(foldVariablePath('字体/é_1'),{path:'-u5b57--u4f53-.-ue9--u5f-1',folded:true});
});
test('encoded Unicode never aliases literal encoded names or another Unicode name',()=>{
 for(const names of [['🌮','-u1f32e-'],['-u1f32e-','🌮'],['é','-ue9-']]){
  assert.throws(()=>capturedTokensFromDump({_variables:Object.fromEntries(names.map((name,i)=>[name,{type:'FLOAT',value:i+1}]))}),/captured-variable-name-fold-collision/);
 }
 assert.notEqual(foldVariablePath('🌮').path,foldVariablePath('🌯').path);
});

import {allocateCapturedVariablePaths} from './captured-tokens.js';
test('prefix leaf allocation preserves descendants and is independent of source enumeration order',()=>{
 const names=['color/icon','color/icon/subtle','color/icon/-value','color/icon/-value-2/child'];
 const forward=allocateCapturedVariablePaths(names),reverse=allocateCapturedVariablePaths([...names].reverse());
 assert.deepEqual([...forward],[...reverse]);
 assert.equal(forward.get('color/icon'),'color.icon.-value-3');
 assert.equal(forward.get('color/icon/subtle'),'color.icon.subtle');
 assert.equal(forward.get('color/icon/-value'),'color.icon.-value');
 assert.equal(new Set(forward.values()).size,names.length);
 const nested=allocateCapturedVariablePaths(['a','a/b','a/b/c']);
 assert.deepEqual([...nested.values()],['a.-value','a.b.-value','a.b.c']);
 assert.deepEqual([...allocateCapturedVariablePaths(['space/small'])],[['space/small','space.small']]);
 assert.throws(()=>allocateCapturedVariablePaths(['A B','A-B']),/fold-collision/);
});

test('group leaves and descendants register distinct values and modes and bind without leaking to the next batch',()=>{
 const input=dump(),label=input.StatusLabel.variants[0].children[0];
 input._variables={
  'color/icon':{type:'COLOR',value:'#112233',modes:{Dark:'#ffffff'}},
  'color/icon/subtle':{type:'COLOR',value:'#445566',modes:{Dark:'#aaaaaa'}},
 } as any;
 label.fill.var='color/icon';label.text.fillVar='color/icon';
 delete (label.text as any).fontSizeVar;delete (label.text as any).lineHeightVar;
 const before=JSON.stringify(input),layer=capturedTokensFromDump(input)!;
 assert.deepEqual(layer.skipped,[]);
 assert.deepEqual(layer.entries.map(e=>[e.name,e.path,e.value]),[
  ['color/icon','color.icon.-value','#112233'],['color/icon/subtle','color.icon.subtle','#445566']]);
 assert.deepEqual((layer.tree as any).color.icon,{
  '-value':{$value:'#112233',$type:'color'},subtle:{$value:'#445566',$type:'color'}});
 assert.equal((layer.modes!.Dark.tree as any).color.icon['-value'].$value,'#ffffff');
 assert.equal((layer.modes!.Dark.tree as any).color.icon.subtle.$value,'#aaaaaa');
 const kit=D2C_KITS.find(k=>k.kit==='figma-ds')!;
 const batch=proposeKit(kit,input as any);
 assert.deepEqual(batch.skipped,[]);
 assert.equal(ContractSchema.parse(batch.proposals[0].contract).anatomy.root.parts!.Label.tokens!.color,'{color.icon.-value}');
 assert.equal(JSON.stringify(input),before);
 delete (input._variables as any)['color/icon/subtle'];
 const next=proposeKit(kit,input as any);
 assert.deepEqual(next.skipped,[]);
 assert.equal(ContractSchema.parse(next.proposals[0].contract).anatomy.root.parts!.Label.tokens!.color,'{color.icon}');
});
