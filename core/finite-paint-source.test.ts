import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema, absentVariantAxes, walkAnatomy} from '../scripts/contract-schema.js';
import {resolveBooleanArguments} from './component-boolean-arguments.js';
import {shapeFillValue} from './source-shape-fill-control.js';
import {observedTextOverrideColor} from './source-text-color-control.js';
import {reactDrawnVariantGuard} from './react-drawn-variants.js';

const opts = {fileKey:'file',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true,hiddenCaptured:true,stampsObservable:true,drawnVariantSurface:'react-runtime' as const};
function fixture(kind:'text'|'shape') {
  const layout = {mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
  const normal = {paint:{color:{r:.5,g:.25,b:0},opacity:1,blendMode:'NORMAL'}};
  const child:any = {setName:'PaintChild',key:'child-key',nodeId:'set-child',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Off',variantOptions:['Off','On']}},variants:['Off','On'].map((mode,i) => ({name:'Mode='+mode,type:'COMPONENT',nodeId:'main-'+i,variantProperties:{Mode:mode},layout,children:[0,1].map(index => ({name:'Duplicate',type:kind==='text'?'TEXT':'RECTANGLE',nodeId:(index?'target-':'other-')+i,fill:{hex:'804000'},...(kind==='text'?{text:{characters:index?'Payload':'Other',fontSize:14,fontStyle:'Regular',lineHeight:18}}:{width:12,height:12,sourceNormalFillComposition:normal})}))}))};
  const counts = Array.from({length:9},(_,i)=>i+2);
  const definitions:any = {Layout:{type:'VARIANT',defaultValue:'Horizontal',variantOptions:['Horizontal','Vertical']}};
  for(const count of counts)definitions['Items '+count] = {type:'VARIANT',defaultValue:count===2?'true':'false',variantOptions:['true','false']};
  const parent:any = {setName:'PaintParent',key:'parent-key',nodeId:'set-parent',type:'COMPONENT_SET',propertyDefinitions:definitions,variants:['Horizontal','Vertical'].flatMap((direction,plane) => counts.map(count => {
    const tuple = {Layout:direction,...Object.fromEntries(counts.map(n=>['Items '+n,n===count?'true':'false']))};
    return {name:Object.entries(tuple).map(([k,v])=>k+'='+v).join(', '),type:'COMPONENT',nodeId:'parent-'+plane+'-'+count,variantProperties:tuple,layout,children:Array.from({length:count},(_,index)=>{
      const id='usage-'+plane+'-'+count+'-'+index;
      const target={nodeId:'I'+id+';target-0',instanceId:id,componentId:'main-0',instancePath:[],childPath:[1]};
      return {name:'Item '+(index+1),type:'INSTANCE',nodeId:id,instanceOf:'PaintChild',instanceKey:'child-key',componentProperties:{Mode:'Off'},...(plane===0?{hostOverrides:[{path:'Duplicate',fields:['fills'],fill:{hex:kind==='text'?'112233':count%2?'008040':'804000'},...(kind==='text'?{textFillTarget:target}:{shapeFillTarget:target,sourceNormalFillComposition:{paint:{color:count%2?{r:0,g:.5,b:.25}:{r:.5,g:.25,b:0},opacity:1,blendMode:'NORMAL'}}})}]}:{})};
    })};
  }))};
  return {child,parent};
}

for(const kind of ['text','shape'] as const)test('source '+kind+' paint compacts sparse overflow without changing full tuple admission or child authority',()=>{
  const source=fixture(kind),before=JSON.stringify(source),result=proposeBatchFromDump({PaintChild:source.child,PaintParent:source.parent},opts);
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(result.skipped,[]);
  const cp=result.proposals.find(p=>p.setName==='PaintChild')!,pp=result.proposals.find(p=>p.setName==='PaintParent')!;
  const child=ContractSchema.parse(cp.contract),parent=ContractSchema.parse(pp.contract);
  const bindings=kind==='text'?cp.textColorBindings!:cp.shapeFillBindings!,prop=bindings[0].prop;
  assert.equal(absentVariantAxes(parent).length,10);
  assert.equal(parent.bindings.figma.drawnVariants!.length,18);
  const controlled=walkAnatomy(parent).filter(w=>w.part.component?.paintPropsByCombination?.[prop]);
  assert.equal(controlled.length,kind==='text'?8:9);
  for(const {name,part} of controlled){
    const table=part.component!.paintPropsByCombination![prop];assert(table.props.length<=8,JSON.stringify({kind,props:table.props,rows:table.rows}));
    for(const tuple of parent.bindings.figma.drawnVariants!){
      const subst=Object.fromEntries(Object.entries(tuple).map(([name,value])=>[name,String(value)]));
      const args=resolveBooleanArguments(child,part.component!,subst),row=table.rows.find(r=>JSON.stringify(r.values)===JSON.stringify(table.props.map(p=>subst[p])));
      const sourceVariant=source.parent.variants.find((variant:any)=>Object.entries(tuple).every(([name,value])=>{const axis=parent.props.find(p=>p.name===name)!;return variant.variantProperties[axis.bindings.figma.property!]===((axis.bindings.figma.values?.[String(value)])??String(value));}));
      assert(sourceVariant);const index=Number(name.match(/(\d+)$/)?.[1])-1;assert(Number.isInteger(index)&&index>=0,name);
      const override=sourceVariant.children[index]?.hostOverrides?.[0],expected=override?(kind==='text'?observedTextOverrideColor(override):shapeFillValue(override)):undefined;
      assert(row);assert.equal(row.value,expected??null,'source paint differs for '+name+':'+JSON.stringify(tuple));if(row.value===null)assert(!Object.hasOwn(args,prop));else assert.equal(args[prop],row.value);
    }
  }
  // Evaluate the production guard rather than a reconstructed permission rule.
  const axes=absentVariantAxes(parent),names=axes.map((_,i)=>'v'+i);
  const guard=reactDrawnVariantGuard(parent,name=>names[axes.findIndex(a=>a.prop.name===name)]).join('\n');
  const code=transformSync('('+names.join(',')+')=>{'+guard+'; return true;}',{loader:'ts',format:'cjs'}).code;
  const accept=vm.runInNewContext(code);
  for(const tuple of parent.bindings.figma.drawnVariants!)assert.equal(accept(...axes.map(a=>tuple[a.prop.name])),true);
  const unknown={...parent.bindings.figma.drawnVariants![0]};
  const counts=axes.filter(a=>a.prop.bindings.figma.property?.startsWith('Items '));
  for(const axis of counts)unknown[axis.prop.name]=false;
  assert(controlled.some(({part})=>{const t=part.component!.paintPropsByCombination![prop];return t.rows.some(r=>JSON.stringify(r.values)===JSON.stringify(t.props.map(p=>String(unknown[p]))));}),'the guard must reject even when a reduced paint key exists');
  assert.throws(()=>accept(...axes.map(a=>unknown[a.prop.name])),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
  unknown[counts[0].prop.name]=true;unknown[counts[1].prop.name]=true;
  assert.throws(()=>accept(...axes.map(a=>unknown[a.prop.name])),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
  const badEnum={...parent.bindings.figma.drawnVariants![0]};
  const enumAxis=axes.find(a=>a.prop.name==='layout')!;badEnum[enumAxis.prop.name]='diagonal';
  assert.throws(()=>accept(...axes.map(a=>badEnum[a.prop.name])),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
  const badBoolean={...parent.bindings.figma.drawnVariants![0]};badBoolean[counts[0].prop.name]='false';
  assert.throws(()=>accept(...axes.map(a=>badBoolean[a.prop.name])),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
  badBoolean[counts[0].prop.name]='unknown';
  assert.throws(()=>accept(...axes.map(a=>badBoolean[a.prop.name])),(e:any)=>e.code==='DRAWN_VARIANT_UNDECLARED');
  const withoutGuard=structuredClone(parent);delete withoutGuard.bindings.figma.drawnVariants;
  assert.equal(ContractSchema.safeParse(withoutGuard).success,false);
  const broken=structuredClone(parent),table=walkAnatomy(broken).find(w=>w.part.component?.paintPropsByCombination?.[prop])!.part.component!.paintPropsByCombination![prop];table.rows.pop();
  assert.equal(ContractSchema.safeParse(broken).success,false);
  // An incorrect source target cannot acquire the child's exact paint input.
  const poisoned=structuredClone(source);poisoned.parent.variants[0].children[0].hostOverrides[0][kind==='text'?'textFillTarget':'shapeFillTarget'].nodeId='Iwrong;target-0';
  const refused=proposeBatchFromDump({PaintChild:poisoned.child,PaintParent:poisoned.parent},opts);
  assert(refused.skipped.some(p=>p.setName==='PaintChild'&&p.reason.includes(kind==='text'?'text-color-demand-source-target-unqualified':'shape-fill-demand-source-target-unqualified')),JSON.stringify(refused.skipped));
});
