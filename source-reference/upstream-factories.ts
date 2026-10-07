import ts from 'typescript';
import {readReactElementCreationSites} from './react-element-creation.js';
/** Only import-bound factory calls and their syntactic configs receive origins.
 * Unknown configs still reach the runtime's ordinary provenance refusal. */
export function instrumentUpstreamFactories(text:string,file:string,module:string){
 const sites=readReactElementCreationSites(text,file,module,true);
 if(!sites.length)return text;
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),f=ts.factory;
 const api=(method:string,args:ts.Expression[])=>f.createCallExpression(f.createPropertyAccessExpression(f.createPropertyAccessExpression(f.createIdentifier('globalThis'),'__DSC_RUNTIME_PROOF'),method),undefined,args);
 const result=ts.transform(sf,[context=>{
  const visit=(node:ts.Node):ts.VisitResult<ts.Node>=>{
   let updated=ts.visitEachChild(node,visit,context);
   if(ts.isCallExpression(node)&&ts.isCallExpression(updated)){
    const site=sites.find(s=>s.span.start===node.getStart(sf)&&s.span.end===node.end);
    if(site){
     const args=[...updated.arguments];let config=node.arguments[1];
     while(config&&ts.isParenthesizedExpression(config))config=config.expression;
     if(config&&ts.isObjectLiteralExpression(config))args[1]=api('literal',[args[1]]);
     updated=api(site.factory==='createElement'?'createElement':'jsx',[updated.expression,...args]);
    }
   }
   return updated;
  };return source=>ts.visitNode(source,visit) as ts.SourceFile;
 }]);
 try{return ts.createPrinter().printFile(result.transformed[0]);}finally{result.dispose();}
}
