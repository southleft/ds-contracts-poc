/** Host-only validated replay memo. The caller freshly reads and hashes every
 * input byte and filename before lookup; this never stores source authority.
 * One compressed entry is retained. Every hit is a detached deserialized copy.
 */
import {serialize,deserialize} from 'node:v8';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
export function createNativeJournalReplayMemo<T>(limits={storedBytes:128*1024*1024,decodedBytes:1024*1024*1024}) {
 let entry:{key:string;data:Buffer}|undefined;
 return {
  get(key:string):T|undefined {
   if(!entry||entry.key!==key)return undefined;
   try{return deserialize(inflateRawSync(entry.data,{maxOutputLength:limits.decodedBytes})) as T;}catch{entry=undefined;return undefined;}
  },
  put(key:string,value:T,inputBytes=0):void {
   entry=undefined;
   // The journal already bounds individual files and two decoded sweeps. Keep
   // headroom for the plan/state copies before attempting serialization.
   if(inputBytes+Math.min(192*1024*1024,limits.decodedBytes/4)>limits.decodedBytes)return;
   try {
    const decoded=serialize(value);if(decoded.length>limits.decodedBytes)return;
    const data=deflateRawSync(decoded,{level:1});
    if(data.length<=limits.storedBytes)entry={key,data};
   }catch{/* Allocation/codec refusal falls back to ordinary complete replay. */}
  },
  clear():void {entry=undefined;},
 };
}
