import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';

/** One synchronous freshness check over overlapping pinned input inventories.
 * Every distinct file is read on every call. No result survives this scope;
 * conflicting pins refuse rather than letting the last inventory win.
 * Callers must still validate the observation metadata that supplied each map. */
export function reactInputFilesUnchanged(inventories:ReadonlyArray<Readonly<Record<string,string>>>) {
  try {
    const expected=new Map<string,string>();
    for(const inventory of inventories)for(const [file,hash] of Object.entries(inventory)) {
      if(expected.has(file)&&expected.get(file)!==hash)return false;
      expected.set(file,hash);
    }
    for(const [file,hash] of expected)if(realpathSync(file)!==file||
      createHash('sha256').update(readFileSync(file)).digest('hex')!==hash)return false;
    return true;
  }catch{return false;}
}
