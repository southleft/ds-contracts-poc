import path from 'node:path';
import {CliUsageError,flagString,parseFlags} from '../lib.js';
import {prepareNativeSession,writeNativeJson} from './prepared-native-session.js';
import {servePreparedNative} from './prepared-native-serve.js';

export async function preparedNativeCommand(argv:string[],log=(line:string)=>console.log(line)) {
  const flags=parseFlags(argv,{value:['prepared','out','file-key','mode','brand'],bool:['write','resume','retry-creation']});
  const source=flagString(flags,'prepared'),out=flagString(flags,'out'),fileKey=flagString(flags,'file-key');
  if(flags.positionals.length||Boolean(source)===Boolean(flags.flags.get('resume'))||!out||!fileKey)throw new CliUsageError('react-to-figma requires --prepared <checked-output> or --resume, with --out <session> and --file-key <target>; add --write to connect Figma.');
  const retry=Boolean(flags.flags.get('retry-creation'));
  if(retry&&(!flags.flags.get('resume')||!flags.flags.get('write')))throw new CliUsageError('--retry-creation requires --resume --write and a confirmed creation refusal.');
  const mode=flagString(flags,'mode')??'light',brand=flagString(flags,'brand')??'default';
  if(mode!=='light'&&mode!=='dark')throw new CliUsageError('--mode must be light or dark');
  const run=prepareNativeSession(source?path.resolve(source):undefined,path.resolve(out),{fileKey,mode,brand});
  let interrupted=false, observed=false;
  try {
    if(flags.flags.get('write'))
      ({interrupted}=await servePreparedNative(run,log,5181,retry));
  } finally {
    const snapshot=run.jobs.get(run.id),file=path.join(run.root,'result.json');
    observed=snapshot.phase==='component-structure-observed'&&snapshot.sourceCurrent;
    writeNativeJson(file,{operation:snapshot,interrupted,behavior:'not-established',visual:'not-checked',apiEquivalence:'not-established'});
    log('native: '+snapshot.phase+'; result: '+file);
    log('Native structure does not establish visual, behavior or public API equivalence.');
  }
  if(interrupted)return 130;
  if(!flags.flags.get('write')){log('Prepared only. Repeat with --write to connect the companion.');return 0;}
  return observed?0:1;
}
