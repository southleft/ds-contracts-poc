import {createServer} from 'node:http';
import {handleNativeRequest,json} from '../../../../source-reference/native-http.js';
import type {prepareNativeSession} from './prepared-native-session.js';

/** The existing companion uses localhost:5181. The CLI hosts only this one
 * operation, never app routes, supplied scripts, or a caller-selected target. */
export function servePreparedNative(run:ReturnType<typeof prepareNativeSession>, log:(line:string)=>void, port=5181, retry=false) {
  return new Promise<{interrupted:boolean}>((resolve,reject)=>{
    const servers:ReturnType<typeof createServer>[]=[];
    let closed=false, ready=0, previous='';
    const close=()=>{closed=true;process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);for(const server of servers){server.close();server.closeIdleConnections();}};
    const interrupt=()=>{close();resolve({interrupted:true});};
    const failed=(error:unknown)=>{if(!closed){close();reject(error);}};
    for(const host of ['127.0.0.1','::1']) {
      const server=createServer((req,res)=>void(async()=>{
        if(!new RegExp('^/api/source-reference/native/'+run.id+'/(claim|begin|result)$').test(req.url??''))return json(res,404,{error:'Native operation route required.'});
        let finished=false;
        res.once('finish',()=>{if(finished&&!closed){close();resolve({interrupted:false});}});
        await handleNativeRequest(req,res,id=>{
          if(id!==run.id)throw Error('prepared-native-operation-refused');
          return {...run.transport,claim(...args:Parameters<typeof run.transport.claim>){
            let value=run.transport.claim(...args);
            if(value.status==='awaiting-result'&&args[3]) {
              const pending=run.jobs.pendingCommand(run.id);
              if(pending?.readOnly&&pending.attemptId===args[3]&&pending.fileKey===args[2]) {
                run.jobs.retryObservation(run.id);value=run.transport.claim(...args);
              }
            }
            finished=value.status==='finished';return finished?{...value,stopPolling:true}:value;
          }};
        });
        const phase=run.jobs.deliveryState(run.id).phase;
        if(phase!==previous){previous=phase;log('native: '+phase);}
      })().catch(()=>{if(!res.headersSent)json(res,409,{error:'Native delivery refused; the existing journal is retained.'});}));
      servers.push(server);
      server.once('error',(error:NodeJS.ErrnoException)=>failed(Error('prepared-native-port-unavailable: '+host+':'+port+' ('+error.code+')')));
      server.listen(port,host,()=>{
        if(closed){server.close();return;}
        if(++ready!==2)return;
        try {
          if(retry)run.jobs.retryCreation(run.id);
          const connection=run.transport.pair(run.id);
          if(!run.transport.status(run.id).started)run.transport.start(run.id);
          process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
          log('Open the target file in Figma Desktop. In the ds-contracts plugin, open Build → Connect the local source workflow.');
          log('Paste this connection and press Connect / resume: '+connection);
          log('Keep this command running. Ctrl-C preserves the session; resume with --resume --write and the same --out, file, mode and brand. Omit --retry-creation when resuming an interrupted retry.');
        }catch(error){failed(error);}
      });
    }
  });
}
