import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../../../core/contract-provenance.js';
import {parseLibraryRequest, MAX_BYTES} from '../../../../playground/server/react-library-input.js';
import {retainPreparedReactLibrary} from '../../../../playground/server/react-library-artifact.js';
import {createNativeOperationJobs} from '../../../../source-reference/native-operation-jobs.js';
import {createNativeOperationTransport} from '../../../../source-reference/native-operation-transport.js';
import {preparedLibraryNativeAdapter} from '../../../../source-reference/prepared-library-native.js';
import {isPreparedLibraryNativeRequest, type PreparedLibraryNativeRequest} from '../../../../source-reference/prepared-library-native-request.js';
import {validFigmaFileKey} from '../../../../source-reference/figma-target.js';

const fail=(reason:string):never=>{throw Error('prepared-native-'+reason);};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const archiveName=(name:unknown):name is string=>typeof name==='string'&&/^[A-Za-z0-9._-]+\.tgz$/.test(name);
function read(file:string, limit:number) {
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try {const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size>limit)fail('input-file-invalid');return fs.readFileSync(fd);}
  finally {fs.closeSync(fd);}
}
interface Selection { fileKey:string; mode:'light'|'dark'; brand:string }
interface Session { version:1; id:string|null; request:PreparedLibraryNativeRequest|null; selection:Selection; filename:string; pins:string[] }

/** The source directory stays read-only. Hashes pin supplied bytes; they do not
 * independently attest to visual or runtime equivalence. Reopening authenticates
 * the retained journal before any compiler/current-source check can block an ack. */
export function prepareNativeSession(source:string|undefined,root:string,selection:Selection) {
  if(!validFigmaFileKey(selection.fileKey))fail('file-required');
  if(!['light','dark'].includes(selection.mode)||!/^[a-z0-9][a-z0-9-]*$/.test(selection.brand))fail('selection-invalid');
  const manifest=path.join(root,'session.json');let saved:Session|undefined;
  if(fs.existsSync(root)) {
    const stat=fs.lstatSync(root);if(!stat.isDirectory()||stat.isSymbolicLink())fail('session-directory-invalid');
    if(fs.existsSync(manifest)) {
      const record=JSON.parse(read(manifest,4096).toString()) as Session;
      if(!record)fail('session-invalid');
      saved=record;
      if(saved.version!==1||Object.keys(saved).sort().join()!=='filename,id,pins,request,selection,version'||
        !(saved.id===null&&saved.request===null||typeof saved.id==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(saved.id)&&isPreparedLibraryNativeRequest(saved.request))||!archiveName(saved.filename)||
        !Array.isArray(saved.pins)||saved.pins.length!==3||saved.pins.some(p=>typeof p!=='string'||!/^[a-f0-9]{64}$/.test(p)))fail('session-invalid');
      if(canonicalJson(saved.selection)!==canonicalJson(selection)||saved.request&&(saved.request.mode!==selection.mode||saved.request.brand!==selection.brand))fail('session-selection-changed');
    } else if(fs.readdirSync(root).length)fail('session-unrecognized');
  }
  if(!source&&!saved?.id)fail('resume-ready-session-required');
  const original=source?read(path.join(source,'request.json'),MAX_BYTES):undefined;
  const report=source?read(path.join(source,'result.json'),MAX_BYTES):undefined;
  // --resume uses only the retained journal. --prepared additionally checks
  // the original directory, without reinterpreting a ready session's schema.
  const result=saved?.id?undefined:JSON.parse(report!.toString());
  const filename=saved?.filename??result.tarball;
  if(!archiveName(filename))fail('archive-name-invalid');
  const bytes=source?read(path.join(source,filename),128*1024*1024):undefined;
  const pins=source?[sha(original!),sha(report!),sha(bytes!)]:saved!.pins;
  if(saved&&canonicalJson(pins)!==canonicalJson(saved.pins))fail('session-input-changed');
  let request=saved?.request;
  if(!saved?.id) {
    const raw=JSON.parse(original!.toString());
    if(result.check?.status!=='pass')fail('checked-output-required');
    if(result.requestSha256!==sha(canonicalJson(raw)))fail('request-digest-mismatch');
    if(result.tarballSha256!==pins[2])fail('archive-digest-mismatch');
    const input=parseLibraryRequest(raw);
    if(result.rootId!==input.root.id||result.component!==input.root.name)fail('root-mismatch');
    fs.mkdirSync(root,{recursive:true});
    if(!saved)writeNativeJson(manifest,{version:1,id:null,request:null,selection,filename,pins} satisfies Session,true);
    const artifact=retainPreparedReactLibrary(root,input,{bytes:bytes!,tarballSha256:pins[2],filename,name:result.packageName});
    request={version:1,kind:'prepared-library-native',artifactId:artifact.id,mode:selection.mode,brand:selection.brand};
  }
  process.env.DS_CONTRACTS_FIGMA_FILE=selection.fileKey;
  const jobs=createNativeOperationJobs(root,{prepare:()=>fail('source-kind-refused'),preparedLibrary:preparedLibraryNativeAdapter(root)});
  const reserved=jobs.preparedLibraryPairingOperation(request!);
  if(saved?.id&&reserved!==saved.id)fail('session-journal-mismatch');
  const id=reserved??jobs.prepare(request!).id;
  if(jobs.deliveryState(id).fileKey!==selection.fileKey)fail('session-file-mismatch');
  if(!saved?.id)writeNativeJson(manifest,{version:1,id,request:request!,selection,filename,pins} satisfies Session);
  return {root,id,jobs,transport:createNativeOperationTransport(root,jobs)};
}

/** Derived reports and completed sessions replace atomically; a first preparing
 * record is exclusive. A torn record refuses, and an abandoned temp cannot block
 * a later report. The journal, not these derived reports, is authoritative. */
export function writeNativeJson(file:string,value:unknown,exclusive=false) {
  const temporary=exclusive?file:file+'.'+randomUUID()+'.tmp';
  const fd=fs.openSync(temporary,'wx',0o600);
  try {fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}
  finally {fs.closeSync(fd);}
  if(!exclusive)fs.renameSync(temporary,file);
  const parent=fs.openSync(path.dirname(file),'r');try {fs.fsyncSync(parent);}finally {fs.closeSync(parent);}
}
