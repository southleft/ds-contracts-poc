import {walkAnatomy,type Contract,type ComponentRef} from '../scripts/contract-schema.js';
function validate(dep:Contract,ref:ComponentRef){
 for(const [name,table] of Object.entries(ref.paintPropsByCombination??{})){
  const prop=dep.props.find(p=>p.name===name),colors=prop&&typeof prop.type==='object'&&'enum' in prop.type?prop.type.enum:[];
  if(!prop||!walkAnatomy(dep).some(w=>(w.part.shapeFillOverrideProp===name||w.part.textColorOverrideProp===name))||table.rows.some(r=>r.value!==null&&!colors.includes(r.value)))throw Error('component-paint-argument-child-unqualified:'+name);
  if(Object.hasOwn(ref.props??{},name)||Object.hasOwn(ref.booleanPropsByCombination??{},name))throw Error('component-argument-conflicting-fixed-value:'+name);
 }

 for(const [name,table] of Object.entries(ref.enumPropsByCombination??{})){
  const prop=dep.props.find(p=>p.name===name),values=prop&&typeof prop.type==='object'&&'enum' in prop.type?prop.type.enum:undefined;
  if(!values||table.rows.some(row=>row.value!==null&&!values.includes(row.value)))throw Error('component-enum-argument-child-unqualified:'+name);
  if(prop?.required&&table.rows.some(row=>row.value===null))throw Error('component-argument-required-child-cannot-be-omitted:'+name);
  if(Object.hasOwn(ref.props??{},name)||Object.hasOwn(ref.paintPropsByCombination??{},name)||Object.hasOwn(ref.booleanPropsByCombination??{},name))throw Error('component-argument-conflicting-fixed-value:'+name);
 }

 for(const name of Object.keys(ref.booleanPropsByCombination??{})){
  const prop=dep.props.find(p=>p.name===name);
  if(prop?.type!=='boolean')throw Error('component-argument-child-must-be-boolean:'+dep.id+':'+name);
  if(prop.required && ref.booleanPropsByCombination![name].rows.some(row=>row.value===null))throw Error('component-argument-required-child-cannot-be-omitted:'+name);
  if(Object.hasOwn(ref.props??{},name))throw Error('component-argument-conflicting-fixed-value:'+name);
 }
}
export function resolveBooleanArguments(dep:Contract,ref:ComponentRef,subst:Record<string,string>):NonNullable<ComponentRef['props']>{
 validate(dep,ref);const props={...ref.props};
 for(const [name,table] of Object.entries({...ref.booleanPropsByCombination,...ref.paintPropsByCombination,...ref.enumPropsByCombination})){
  const values=table.props.map(p=>subst[p]??null),row=table.rows.find(r=>JSON.stringify(r.values)===JSON.stringify(values));
  if(!row)throw Error('component-argument-combination-unqualified:'+name);
  if(row.value!==null)props[name]=row.value;
 }
 return props;
}
export function reactBooleanArguments(parent:Contract,dep:Contract,ref:ComponentRef):string{
 validate(dep,ref);return Object.entries({...ref.booleanPropsByCombination,...ref.paintPropsByCombination,...ref.enumPropsByCombination}).map(([name,table])=>{
  const code=dep.props.find(p=>p.name===name)!.bindings.code.prop;
  // Large finite tables must not become hundreds of nested conditional AST
  // nodes: formatters overflow their stack before the component can compile.
  if(table.rows.length>64){
   const entries=table.rows.filter(row=>row.value!==null);
   const values=[...new Set(entries.map(row=>JSON.stringify(row.value)))];
   const object=entries.map(row=>`${JSON.stringify(JSON.stringify(row.values))}: ${JSON.stringify(row.value)}`).join(', ');
   const key=table.props.map(name=>{const alias=parent.props.find(p=>p.name===name)!.bindings.code.prop;return `${alias} === undefined ? null : String(${alias})`;}).join(', ');
   return ` ${code}={({${object}} as Record<string, ${[...values,'undefined'].join(' | ')}>)[JSON.stringify([${key}])]}`;
  }
  const expr=table.rows.map(row=>{
   const condition=table.props.map((p,i)=>{const alias=parent.props.find(prop=>prop.name===p)!.bindings.code.prop;
    return row.values[i]===null?`${alias} === undefined`:`String(${alias}) === ${JSON.stringify(row.values[i])}`;}).join(' && ');
   return `(${condition}) ? ${row.value===null?'undefined':JSON.stringify(row.value)} : `;
  }).join('')+'undefined';
  return ` ${code}={${expr}}`;
 }).join('');
}
