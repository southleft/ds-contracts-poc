/** Resolve a number only from verified variable inventory and consumer modes. */
export function nativeBoundNumber(name: string, variables: unknown[], modes: Record<string,string>): number | undefined {
 const record=(v: unknown): v is Record<string,any> => !!v && typeof v === 'object' && !Array.isArray(v);
 let variable=variables.find((v): v is Record<string,any> => record(v) && v.name === name);
 const seen=new Set<string>();
 while(variable){
  if(typeof variable.id !== 'string' || seen.has(variable.id) || variable.resolvedType !== 'FLOAT') return;
  seen.add(variable.id);
  const mode=modes[variable.variableCollectionId];
  if(typeof mode !== 'string') return;
  const value=variable.valuesByMode?.[mode];
  if(record(value) && value.type === 'VARIABLE_ALIAS')
   variable=variables.find((v): v is Record<string,any> => record(v) && v.id === value.id);
  else return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
 }
}
