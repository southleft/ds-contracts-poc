/** Durable host-selected source-file changes. This is a filesystem mechanism,
 * not a source-repair approval: the caller must authenticate the selected
 * preview, compiler census and fresh native intent before apply or recovery.
 * Files are moved into recovery storage before an exclusive hard-link install.
 * A new file at the destination is never overwritten. The before/after blobs
 * are immutable; held originals and installation links may retain external edits. */
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,fchmodSync,linkSync,lstatSync,mkdirSync,openSync,
  readFileSync,readdirSync,realpathSync,renameSync,writeFileSync,mkdtempSync} from 'node:fs';
import path from 'node:path';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const hash=/^[a-f0-9]{64}$/;
const fail=(reason:string):never=>{throw Error('react-source-transaction-'+reason);};
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
type FileEdit={file:string;beforeSha256:string;afterSha256:string;mode:number};
export interface SourceFileTransaction {
  version:1;sourceRoot:string;selectionRevision:string;
  inputs:Record<string,string>;edits:FileEdit[];
}
type Event={sequence:number;previous:string;kind:'apply'|'rollback'|'file-intent'|'file-complete'|'complete';
  direction:'apply'|'rollback';index?:number};
type Hooks={checkpoint?:(point:string,index?:number)=>void};
export type SourceTransactionState={id:string;direction:'apply'|'rollback'|undefined;
  phase:'prepared'|'incomplete'|'applied'|'rolled-back'|'conflict';
  files:Array<{file:string;state:'before'|'after'|'missing'|'changed'}>;problems:string[]};

function sync(dir:string){const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function directory(dir:string){
  if(realpathSync(dir)!==dir||!lstatSync(dir).isDirectory())fail('directory-changed');
}
function durable(file:string,bytes:string|Buffer,mode=0o600){
  const parent=path.dirname(file);directory(parent);
  const pending=path.join(parent,'.pending');mkdirSync(pending,{recursive:true,mode:0o700});directory(pending);
  const temporary=path.join(pending,randomUUID()),fd=openSync(temporary,'wx',mode);
  try{writeFileSync(fd,bytes);fchmodSync(fd,mode);fsyncSync(fd);}finally{closeSync(fd);}
  // Publish only complete bytes. A process lost during serialization leaves
  // unreferenced pending evidence, never a partial committed journal entry.
  sync(pending);linkSync(temporary,file);sync(parent);
}
function digest(file:string):string|undefined{
  try{const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())fail('file-type-changed');return sha(readFileSync(file));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
}

export function createSourceFileTransactions(repo:string,hooks:Hooks={}) {
  repo=realpathSync(repo);
  const root=path.join(repo,'private/react-source-file-transactions');
  mkdirSync(root,{recursive:true,mode:0o700});directory(root);
  const lockRoot=path.join(root,'locks');mkdirSync(lockRoot,{recursive:true,mode:0o700});directory(lockRoot);
  function lock(sourceRoot:string){
    const folder=path.join(lockRoot,sha(sourceRoot)),nonce=randomUUID();mkdirSync(folder,{recursive:true,mode:0o700});directory(folder);
    const generations=()=>{
      const entries=readdirSync(folder).filter(name=>!name.startsWith('.prepare-')).sort();
      if(entries.some((name,i)=>name!==String(i).padStart(8,'0')))fail('lock-history-invalid');return entries;
    };
    const priorGenerations=generations(),last=priorGenerations.at(-1);let priorLost=false;
    if(last){
      const priorDir=path.join(folder,last);directory(priorDir);
      const prior=JSON.parse(readFileSync(path.join(priorDir,'owner.json'),'utf8')) as {pid:number;nonce:string};
      if(!Number.isInteger(prior.pid)||prior.pid<1||typeof prior.nonce!=='string')fail('lock-invalid');
      const released=path.join(priorDir,'released');
      if(existsSync(released)){if(readFileSync(released,'utf8')!==prior.nonce)fail('lock-release-invalid');}
      else{
        let alive=true;try{process.kill(prior.pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')alive=false;else throw error;}
        if(alive)fail('writer-already-running');priorLost=true;
      }
    }
    // Lock generations are append-only. Competing recovery processes choose
    // the same next slot; only one can atomically install its nonempty directory.
    // No process removes a stale lock and accidentally displaces a newer writer.
    const generation=String(priorGenerations.length).padStart(8,'0'),dir=path.join(folder,generation);
    const prepared=mkdtempSync(path.join(folder,'.prepare-'));
    durable(path.join(prepared,'owner.json'),JSON.stringify({pid:process.pid,nonce,priorLost})+'\n');
    hooks.checkpoint?.('before-lock-publish');
    try{renameSync(prepared,dir);}catch(error){if(['EEXIST','ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code??''))fail('writer-already-running');throw error;}
    sync(folder);
    const assert=()=>{
      directory(dir);const current=JSON.parse(readFileSync(path.join(dir,'owner.json'),'utf8')) as {nonce:string};
      if(generations().at(-1)!==generation||current.nonce!==nonce||existsSync(path.join(dir,'released')))fail('lock-changed');
    };
    return {assert,release:()=>{assert();durable(path.join(dir,'released'),nonce);}};
  }
  const location=(id:string)=>{if(!hash.test(id))fail('id-invalid');directory(root);const dir=path.join(root,id);directory(dir);return dir;};
  function load(id:string){
    const dir=location(id),transaction=JSON.parse(readFileSync(path.join(dir,'transaction.json'),'utf8')) as SourceFileTransaction;
    if(sha(canonical(transaction))!==id||transaction.version!==1)fail('manifest-changed');
    directory(transaction.sourceRoot);directory(path.join(dir,'events'));directory(path.join(dir,'files'));
    for(const [i,edit] of transaction.edits.entries()){
      directory(path.join(dir,'files',String(i)));directory(path.dirname(edit.file));
      if(!edit.file.startsWith(transaction.sourceRoot+path.sep)||
          digest(path.join(dir,'files',String(i),'before'))!==edit.beforeSha256||
          digest(path.join(dir,'files',String(i),'after'))!==edit.afterSha256)fail('evidence-changed');
    }
    let previous=id,active:Event['direction']|undefined,completed=false;const events:Event[]=[],intents=new Set<string>(),finishes=new Set<string>();
    for(const [sequence,name] of readdirSync(path.join(dir,'events')).filter(name=>name!=='.pending').sort().entries()){
      if(name!==String(sequence).padStart(8,'0')+'.json')fail('journal-gap');
      const bytes=readFileSync(path.join(dir,'events',name)),event=JSON.parse(bytes.toString()) as Event;
      if(Object.keys(event).some(k=>!['sequence','previous','kind','direction','index'].includes(k))||
          event.sequence!==sequence||event.previous!==previous||!['apply','rollback','file-intent','file-complete','complete'].includes(event.kind)||
          !['apply','rollback'].includes(event.direction)||
          (event.index!==undefined&&(!Number.isInteger(event.index)||event.index<0||event.index>=transaction.edits.length)))fail('journal-changed');
      if(event.kind==='apply'||event.kind==='rollback'){
        if(event.index!==undefined||event.kind!==event.direction||(event.kind==='apply'?events.length!==0:active!=='apply'))fail('journal-order-invalid');
        active=event.direction;completed=false;
      }else{
        if(active!==event.direction||completed)fail('journal-order-invalid');
        const key=event.direction+':'+event.index;
        if(event.kind==='file-intent'){
          if(event.index===undefined||intents.has(key))fail('journal-order-invalid');intents.add(key);
        }else if(event.kind==='file-complete'){
          if(event.index===undefined||!intents.has(key)||finishes.has(key))fail('journal-order-invalid');finishes.add(key);
        }else{
          if(event.index!==undefined||(active==='apply'&&transaction.edits.some((_edit,i)=>!intents.has('apply:'+i))))fail('journal-order-invalid');
          completed=true;
        }
      }
      events.push(event);previous=sha(bytes);
    }
    const append=(kind:Event['kind'],direction:Event['direction'],index?:number)=>{
      const event:Event={sequence:events.length,previous,kind,direction,...(index===undefined?{}:{index})};
      const bytes=JSON.stringify(event)+'\n';durable(path.join(dir,'events',String(events.length).padStart(8,'0')+'.json'),bytes);
      previous=sha(bytes);events.push(event);hooks.checkpoint?.('journal-'+kind,index);
    };
    return {dir,transaction,events,append};
  }
  function inspect(id:string):SourceTransactionState{
    const {dir,transaction,events}=load(id),problems:string[]=[];
    const direction=events.slice().reverse().find(e=>e.kind==='apply'||e.kind==='rollback')?.direction;
    const files=transaction.edits.map((edit,index)=>{
      let value:string|undefined;
      try{value=digest(edit.file);}catch{problems.push('file-type-changed:'+index);}
      if(value!==undefined&&(lstatSync(edit.file).mode&0o777)!==edit.mode)problems.push('file-mode-changed:'+index);
      const state=value===edit.beforeSha256?'before':value===edit.afterSha256?'after':value===undefined?'missing':'changed';
      const held=path.join(dir,'files',String(index),'held-original');
      const began=events.some(e=>e.kind==='file-intent'&&e.direction==='apply'&&e.index===index);
      if(state==='changed'||(!began&&state!=='before'))problems.push('source-conflict:'+index);
      if(existsSync(held)&&digest(held)!==edit.beforeSha256)problems.push('held-original-changed:'+index);
      if(direction==='apply'&&began&&existsSync(held)&&state==='before')problems.push('source-recreated:'+index);
      if(began&&state!=='before'&&!existsSync(held))problems.push('original-recovery-missing:'+index);
      return {file:edit.file,state} as SourceTransactionState['files'][number];
    });
    for(const [file,expected] of Object.entries(transaction.inputs)){
      if(transaction.edits.some(e=>e.file===file))continue;
      try{if(digest(file)!==expected)problems.push('input-changed');}catch{problems.push('input-changed');}
    }
    const completed=events.at(-1)?.kind==='complete'&&events.at(-1)?.direction===direction;
    const all=files.every(f=>f.state===(direction==='rollback'?'before':'after'));
    return {id,direction,phase:problems.length?'conflict':completed&&all?(direction==='rollback'?'rolled-back':'applied'):direction?'incomplete':'prepared',files,problems};
  }
  return {
    inspect,
    /** Authenticated historical journal, not permission to write or a claim
     * that the original paths still contain this transaction's output. */
    history(id:string) {
      const {transaction,events}=load(id);
      return structuredClone({transaction,events});
    },
    prepare(args:{sourceRoot:string;selectionRevision:string;inputs:Readonly<Record<string,string>>;
      edits:ReadonlyArray<{file:string;beforeSha256:string;after:Buffer}>}) {
      const sourceRoot=realpathSync(args.sourceRoot);directory(sourceRoot);
      if(!/^sha256:[a-f0-9]{64}$/.test(args.selectionRevision)||args.edits.length<1||args.edits.length>8||
          new Set(args.edits.map(e=>e.file)).size!==args.edits.length)fail('selection-invalid');
      const inputs=Object.fromEntries(Object.entries(args.inputs).sort(([a],[b])=>a.localeCompare(b)));
      for(const [file,expected] of Object.entries(inputs))if(!path.isAbsolute(file)||!hash.test(expected)||digest(file)!==expected)fail('input-changed');
      const device=lstatSync(root).dev,selectedInodes=new Set<string>();
      const edits=args.edits.map(edit=>{
        if(!path.isAbsolute(edit.file)||path.resolve(edit.file)!==edit.file||!edit.file.startsWith(sourceRoot+path.sep)||
            path.relative(sourceRoot,edit.file).split(path.sep).includes('node_modules')||
            inputs[edit.file]!==edit.beforeSha256||!edit.after.length||edit.after.length>32*1024*1024)fail('selection-invalid');
        directory(path.dirname(edit.file));const stat=lstatSync(edit.file);
        const inode=stat.dev+':'+stat.ino;
        if(!stat.isFile()||stat.isSymbolicLink()||stat.dev!==device||realpathSync(edit.file)!==edit.file||selectedInodes.has(inode))fail('file-path-unsupported');
        selectedInodes.add(inode);
        const afterSha256=sha(edit.after);if(afterSha256===edit.beforeSha256)fail('unchanged-edit');
        return {file:edit.file,beforeSha256:edit.beforeSha256,afterSha256,mode:stat.mode&0o777};
      });
      const transaction:SourceFileTransaction={version:1,sourceRoot,selectionRevision:args.selectionRevision,inputs,edits};
      const id=sha(canonical(transaction)),target=path.join(root,id);
      if(existsSync(target)){load(id);return inspect(id);}
      const dir=mkdtempSync(path.join(root,'.prepare-'));sync(root);mkdirSync(path.join(dir,'events'));mkdirSync(path.join(dir,'files'));sync(dir);
      for(const [index,edit] of edits.entries()){
        const folder=path.join(dir,'files',String(index));mkdirSync(folder);sync(path.dirname(folder));
        const before=readFileSync(edit.file);if(sha(before)!==edit.beforeSha256)fail('source-changed');
        durable(path.join(folder,'before'),before,edit.mode);durable(path.join(folder,'after'),args.edits[index].after,edit.mode);
      }
      durable(path.join(dir,'transaction.json'),JSON.stringify(transaction)+'\n');
      renameSync(dir,target);sync(root);
      return inspect(id);
    },
    run(id:string,direction:'apply'|'rollback',authenticate:(transaction:SourceFileTransaction)=>undefined) {
      const loaded=load(id),{dir,transaction,events,append}=loaded;
      const heldLock=lock(transaction.sourceRoot);
      try {
      let state=inspect(id);if(state.phase==='conflict')fail('conflict');
      if(state.direction==='rollback'&&direction==='apply')fail('new-review-required-after-rollback');
      if(direction==='rollback'&&!events.some(e=>e.kind==='apply'))fail('apply-not-started');
      // Async canvas preflight must finish before entering this synchronous
      // boundary. A Promise-returning assertion cannot silently permit a write.
      const authorization:unknown=authenticate(structuredClone(transaction));
      if(authorization!==undefined){
        if(authorization instanceof Promise)void authorization.catch(()=>{});
        fail('authentication-must-be-synchronous');
      }
      hooks.checkpoint?.('authenticated');
      heldLock.assert();
      state=inspect(id);if(state.phase==='conflict')fail('conflict');
      if(state.phase===(direction==='apply'?'applied':'rolled-back'))return {...state,wrote:false};
      if(state.direction!==direction)append(direction,direction);
      let wrote=false;
      for(const [index,edit] of transaction.edits.entries()){
        heldLock.assert();
        state=inspect(id);if(state.phase==='conflict')fail('conflict');
        const folder=path.join(dir,'files',String(index)),desired=direction==='apply'?edit.afterSha256:edit.beforeSha256;
        const current=digest(edit.file),held=path.join(folder,direction==='apply'?'held-original':'held-applied');
        const other=direction==='apply'?edit.beforeSha256:edit.afterSha256;
        const intended=events.some(e=>e.kind==='file-intent'&&e.direction===direction&&e.index===index);
        if(current===desired){
          if(direction==='apply'&&!events.some(e=>e.kind==='file-intent'&&e.direction==='apply'&&e.index===index))fail('unowned-after-state');
          continue;
        }
        if(!intended)append('file-intent',direction,index);
        const install=path.join(folder,direction==='apply'?'install-after':'install-before');
        if(!existsSync(install))durable(install,readFileSync(path.join(folder,direction==='apply'?'after':'before')),edit.mode);
        if(digest(install)!==desired)fail('installation-changed');
        hooks.checkpoint?.('before-move',index);
        heldLock.assert();
        if(existsSync(held)){
          if(digest(held)!==other||digest(edit.file)!==undefined)fail('recovery-conflict');
        }else if(current!==undefined){
          if(digest(edit.file)!==other)fail('source-conflict');
          // Rename preserves whichever bytes currently occupy the source path.
          // An edit racing this move is kept in held, then rejected by its hash.
          renameSync(edit.file,held);sync(path.dirname(edit.file));sync(folder);wrote=true;
          hooks.checkpoint?.('moved',index);
          if(digest(held)!==other){
            // Preserve an edit that raced the move at its original path when
            // that path is still empty. Never replace a newly created file.
            try{linkSync(held,edit.file);sync(path.dirname(edit.file));}
            catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
            fail('held-file-conflict');
          }
        }else if(direction==='apply'||!existsSync(path.join(folder,'held-original')))fail('unowned-missing-file');
        try{linkSync(install,edit.file);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')fail('destination-conflict');throw error;}
        sync(path.dirname(edit.file));wrote=true;hooks.checkpoint?.('installed',index);
        if(digest(edit.file)!==desired)fail('installed-file-changed');
        append('file-complete',direction,index);
      }
      heldLock.assert();state=inspect(id);if(state.phase==='conflict'||state.files.some(f=>f.state!==(direction==='apply'?'after':'before')))fail('completion-conflict');
      append('complete',direction);return {...inspect(id),wrote};
      } finally {heldLock.release();}
    },
  };
}
