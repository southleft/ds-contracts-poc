import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { capturedTokensFromDump, capturedTokensDocument } from '../../../core/captured-tokens.js';
import { applyCapturedAliasTrees } from '../../../core/captured-aliases.js';
import { flattenTokens, type TokenTreeInput } from '../../../core/tokens.js';
import { applyLinkedScope } from '../../../playground/src/engine/linked-scope.js';
import { emitTokensCss, tokensCssLayers } from '../../../core/emit-tokens-css.js';

const value = {r: Math.fround(37/255), g: Math.fround(99/255), b: Math.fround(235/255), a: 1};
const primitive = {id:'p', name:'custom/blue', collectionId:'primitives', modeId:'p-light', modeName:'Light', resolvedType:'COLOR', value, selectedValue:value};
const semantic = {...primitive, id:'s', name:'brand/accent/600', collectionId:'semantic', modeId:'s-light', selectedValue:{type:'VARIABLE_ALIAS', id:'p'}};
const component = {...semantic, name:'color/checkbox/checked/background', collectionId:'components', modeId:'c-light', selectedValue:{type:'VARIABLE_ALIAS', id:'s'}, aliasChain:[semantic, primitive]};
delete (component as {id?:string}).id;
function dump(): any {
  return {_variables: Object.fromEntries([primitive, semantic, component].map(c=>[c.name,{type:'COLOR',value:'#2563eb'}])),
    Checkbox:{setName:'Checkbox', variants:[{variableConsumers:{c:structuredClone(component)}}]}};
}
const node = (d:any) => d.Checkbox.variants[0];
const empty:TokenTreeInput = {primitives:{},semantic:{},light:{},dark:{},brands:{}};

test('selected alias graph preserves identity, native precision and edges through linked tokens and CSS', () => {
  const input=dump(), before=JSON.stringify(input), layer=capturedTokensFromDump(input)!;
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(layer,capturedTokensFromDump(input));
  const leaves=flattenTokens(layer.tree), root=leaves.get('color.checkbox.checked.background')!;
  assert.equal(root.value,'{brand.accent.600}');
  assert.equal(leaves.get('brand.accent.600')!.value,'{custom.blue}');
  assert.deepEqual(root.extensions!['ds-contracts-source'],{variableId:'c',collectionId:'components',modeId:'c-light',modeName:'Light',scope:'selected-mode',tier:'unspecified'});
  assert.equal(leaves.get('custom.blue')!.value,`rgba(${value.r*255},${value.g*255},${value.b*255},1)`);
  const tree=applyLinkedScope(empty,{trees:[layer.tree],mintedTrees:[],paths:new Set(),receipts:[]});
  assert.deepEqual(flattenTokens(tree.semantic),leaves);
  assert.match(emitTokensCss(tokensCssLayers(tree)).css,/--brand-accent-600: var\(--custom-blue\)/);
  assert.match(capturedTokensDocument(input)!.receipt,/token tiers, other modes and interaction behavior are not inferred/);
  const noTable=dump(); delete noTable._variables;
  assert.equal(capturedTokensFromDump(noTable)!.entries.length,3);
  node(input).hostOverrides={nested:{variableConsumers:{c:structuredClone(component)}}};
  node(input).instanceSwapContent={root:{variableConsumers:{c:structuredClone(component)}}};
  assert.deepEqual(capturedTokensFromDump(input),layer);
});

test('reserved-looking names need validated carrier ownership; invalid templates retain named refusal only', () => {
  const ordinary=dump();node(ordinary).variableConsumers.c.name='dsc-native-template/user-color';
  const layer=capturedTokensFromDump(ordinary)!;
  assert.equal(layer.entries.find(e=>e.name==='dsc-native-template/user-color')!.reference,'{brand.accent.600}');
  const invalid=dump();invalid.Checkbox.rootSlot={textTemplate:1};
  node(invalid).children=[{children:[{text:{fillVar:'dsc-native-template/user-color'},variableConsumers:node(invalid).variableConsumers}]}];
  const refused=capturedTokensFromDump(invalid)!;
  assert.equal(refused.count,0);assert.equal(refused.skipped.length,1);
  assert.match(refused.skipped[0].reason,/TEMPLATE/);
  node(invalid).variableConsumers.c.aliasChain={bad:true};
  assert.match(capturedTokensFromDump(invalid)!.skipped[0].reason,/TEMPLATE/);
});

test('supplied incomplete, ambiguous and conflicting graphs refuse instead of becoming literals', () => {
  const cases:Array<[(d:any)=>void,RegExp]>=[
    [d=>delete node(d).variableConsumers.c.aliasChain,/selected-alias-edge/],
    [d=>node(d).variableConsumers.c.aliasChain[1].selectedValue={type:'VARIABLE_ALIAS',id:'c'},/selected-alias-edge/],
    [d=>node(d).variableConsumers.c.aliasChain[1].name=component.name,/name-conflict/],
    [d=>d._variables[primitive.name].value='#000000',/table-conflict/],
    [d=>node(d).variableConsumers.c.resolvedType='FLOAT',/type-unsupported/],
    [d=>{const {id,...direct}=primitive;node(d).hostOverrides={variableConsumers:{[id]:{...direct,name:'different'}}};},/variable-conflict/],
    [d=>{const other=structuredClone(component);other.modeId='other';node(d).instanceSwapContent={root:{variableConsumers:{c:other}}};},/variable-conflict/],
    [d=>node(d).variableConsumers.c.aliasChain[1].name='constructor/blue',/path-invalid/],
    [d=>{node(d).variableConsumers.c.name='color/a-b';node(d).variableConsumers.c.aliasChain[1].name='color/a/b';},/path-conflict/],
    [d=>d._variables['custom-blue']={type:'COLOR',value:'#ffffff'},/path-conflict/],
  ];
  for(const [change,reason] of cases){const input=dump();change(input);assert.throws(()=>capturedTokensFromDump(input),reason);}
  const left=capturedTokensFromDump(dump())!.tree, right=structuredClone(left) as any;
  right.custom.blue.$extensions['ds-contracts-source'].variableId='another';
  assert.throws(()=>applyCapturedAliasTrees(empty,[left,right]),/source-conflict:custom.blue/);
  const tiny=capturedTokensFromDump(dump())!.tree;
  assert.throws(()=>applyLinkedScope({...empty,semantic:{custom:{blue:{$value:'#2563eb',$type:'color'}}}},
    {trees:[tiny],mintedTrees:[],paths:new Set(),receipts:[]}),/unowned-conflict/);
  assert.throws(()=>applyCapturedAliasTrees({...empty,semantic:{custom:{$value:'#fff',$type:'color'}}},[tiny]),/path-conflict/);
  assert.throws(()=>applyCapturedAliasTrees({...empty,semantic:{custom:{blue:{child:{$value:'#fff',$type:'color'}}}}},[tiny]),/path-conflict/);
  const literal=dump();delete node(literal).variableConsumers;
  assert.equal(capturedTokensFromDump(literal)!.entries.some(e=>e.source),false);
});

test('real token composition replaces same-color demo aliases across all layers and refuses explicit sources', async () => {
  const root=new URL('../../../',import.meta.url).pathname;
  const server=await createServer({configFile:false,root:root+'playground',logLevel:'error',appType:'custom',
    server:{middlewareMode:true,hmr:false,ws:false,watch:null,fs:{allow:[root]}},optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const source=await server.ssrLoadModule('/src/engine/token-source.ts');
    source.setCapturedTokens(capturedTokensFromDump(dump()));
    const active=source.activeTokens();
    assert.equal(flattenTokens(active.tree.semantic).get('brand.accent.600')!.value,'{custom.blue}');
    for(const tree of [active.tree.primitives,active.tree.light,active.tree.dark,...Object.values(active.tree.brands)])
      assert.equal(flattenTokens(tree as any).has('brand.accent.600'),false);
    assert.match(active.stylesheets.base,/--brand-accent-600: var\(--custom-blue\)/);
    assert.equal(active.stylesheets.dark,'');assert.equal(active.stylesheets.brands,'');
    assert.equal(active.treesForCode.flatMap((t:any)=>[...flattenTokens(t)]).filter(([p]:any)=>p==='brand.accent.600').length,1);
    const minted={tree:{'custom-blue':{$value:'#fff',$type:'color'}},count:1,entries:[]};
    assert.throws(()=>source.setMintedTokens(minted),/path-conflict/);
    assert.equal(source.activeTokens(),active);assert.equal(source.activeMintedTokens(),null);
    const explicit = JSON.stringify({brand:{accent:{600:{$value:'#2563eb',$type:'color'}}}});
    assert.equal(source.applyUserTokens(explicit).ok,false);
    assert.equal(source.activeTokens(),active);
    source.setCapturedTokens(null);
    source.resetToRepoTokens();
    source.applyUserTokens(JSON.stringify({brand:{accent:{600:{$value:'#2563eb',$type:'color'}}}}));
    const before=source.activeTokens();
    assert.throws(()=>source.setCapturedTokens(capturedTokensFromDump(dump())),/explicit-source-conflict/);
    assert.equal(source.activeTokens(),before);
    assert.equal(source.activeCapturedTokens(),null);
    source.applyUserTokens(JSON.stringify({other:{$value:'#fff',$type:'color'}}));
    const conflicting=dump();delete conflicting._variables[component.name];node(conflicting).variableConsumers.c.name='color';
    source.setCapturedTokens(capturedTokensFromDump(conflicting));
    const beforeReset=source.activeTokens();
    assert.throws(()=>source.resetToRepoTokens(),/path-conflict/);
    assert.equal(source.activeTokens(),beforeReset);
    assert.equal(source.baseTokens().kind,'user');
  } finally {await server.close();}
});
