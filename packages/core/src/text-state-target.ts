import {walkAnatomy,type Contract} from '@ds-contracts/schema';
/** A state paint addresses one existing, child-owned text input. Component
 * and consumer-content boundaries need their own scope proof, not a broad
 * descendant selector. */
export function textStateProp(channel:string):string|undefined {
 return channel.startsWith('text-color:') ? channel.slice('text-color:'.length) : undefined;
}
export function textStateTarget(child:Contract|undefined,channel:string):boolean {
 const prop=textStateProp(channel);if(!child||!prop)return false;
 const parts=walkAnatomy(child);
 return !parts.some(w=>w.part.component||w.part.slot||w.part.repeat) &&
  parts.filter(w=>w.part.textColorOverrideProp===prop).length===1 &&
  child.props.some(p=>p.name===prop&&typeof p.type==='object'&&'enum' in p.type&&p.bindings.figma.kind==='NONE');
}
