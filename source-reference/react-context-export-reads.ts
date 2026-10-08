import {planImportRead} from './react-import-read.js';import type {ReactHelperReference} from './react-helper-effects.js';import type {ReactContextFactoryCall} from './react-context-calls.js';import type {HelperSourcePoint} from './react-helper-model.mjs';import type {ReactRuntimeExportDefinition} from './react-runtime-export.js';
export type ContextExportRead={read:HelperSourcePoint;consumer:HelperSourcePoint;target:ReactRuntimeExportDefinition};
export function planContextExportReads(reference:ReactHelperReference,factories:readonly ReactContextFactoryCall[]):ContextExportRead[]{
 const result:ContextExportRead[]=[];
 for(const f of factories){const p=planImportRead(reference,f.arguments[0]);if(p.status==='planned'&&p.resolution.status==='resolved')result.push({read:f.arguments[0],consumer:f.consumer,target:p.resolution.definition});}
 return result;
}
