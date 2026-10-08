import {z} from 'zod';
import {PRESENCE_STATES,validateStatePresence} from './state-presence.js';
/** Boundary for observed plans; not yet part of the public contract schema.
 * Domains are supplied by the importing contract, never inferred from rows. */
export function statePresenceSchema(domains: Readonly<Record<string, readonly (string | null)[]>>) {
 return z.strictObject({
  props:z.array(z.string().min(1)).max(8),
  states:z.array(z.enum(PRESENCE_STATES)).min(1).max(PRESENCE_STATES.length),
  rows:z.array(z.strictObject({values:z.array(z.string().nullable()),state:z.enum(PRESENCE_STATES),present:z.boolean()})).min(1).max(4096),
 }).superRefine((table,ctx)=>{
  try{validateStatePresence(table,domains);}catch(error){ctx.addIssue({code:'custom',message:String(error instanceof Error?error.message:error)});}
 });
}
