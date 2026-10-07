import ts from 'typescript';import path from 'node:path';
import {prepareReactEffectProgram,type ReactHelperReference} from './react-helper-effects.js';
import {readReactContextConsumerEffects} from './react-target-effects.js';
import type {ReactTargetInitializer} from './react-target-initializer.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
import type {ReactContextBindings} from './react-context-calls.js';
export type ContextImportFunctionRequest={initializer:ReactTargetInitializer;invocation:ReactElementInvocation};
/** Conditional source model chooses candidate identities; fresh runtime equality
 * against original lexical declarations is still required. No body authority. */
export function planContextImportFunctions(reference:ReactHelperReference,requests:readonly ContextImportFunctionRequest[]):ReactContextBindings{
 const result:ReactContextBindings={reads:[],functions:[]};
 for(const request of requests){
  const model=readReactContextConsumerEffects(reference,request.initializer,request.invocation,[]);if(model.status!=='modeled')throw Error('context-import-model-refused:'+model.reason);
  for(const binding of model.runtimeBindings.bindings){
   if(!['ImportClause','ImportSpecifier'].includes(binding.declarationKind)||binding.value.kind!=='reference')continue;
   const candidate=model.runtimeBindings.nodes[binding.value.id];if(candidate?.kind!=='function')continue;if(!candidate.source)throw Error('context-import-function-source-unavailable');const functionSource=candidate.source;
   const {sf,requireCurrent}=prepareReactEffectProgram(reference,functionSource.file,{},{});let fn:ts.FunctionDeclaration|undefined;
   const scan=(n:ts.Node)=>{if(ts.isFunctionDeclaration(n)&&n.getStart(sf)===functionSource.start&&n.end===functionSource.end)fn=n;ts.forEachChild(n,scan);};scan(sf);
   if(!fn?.name||reference.files[path.resolve(reference.sourceRoot,functionSource.file)]!==functionSource.sha256)throw Error('context-import-function-source-changed');
   let scope:typeof functionSource|undefined;
   if(!ts.isSourceFile(fn.parent)){
    if(!ts.isBlock(fn.parent)||!ts.isFunctionExpression(fn.parent.parent)||fn.parent.parent.parameters.length||fn.parent.parent.name||fn.parent.parent.asteriskToken||fn.parent.parent.modifiers?.length)throw Error('context-import-function-scope-unmodeled');
    let callNode:ts.Node=fn.parent.parent;while(ts.isParenthesizedExpression(callNode.parent))callNode=callNode.parent;
    if(!ts.isCallExpression(callNode.parent)||callNode.parent.expression!==callNode||callNode.parent.arguments.length)throw Error('context-import-function-scope-not-direct-iife');
    let statement:ts.Node=callNode.parent;while(ts.isParenthesizedExpression(statement.parent))statement=statement.parent;
    if(!ts.isExpressionStatement(statement.parent)||!ts.isSourceFile(statement.parent.parent))throw Error('context-import-function-scope-not-direct-iife');
    scope={file:functionSource.file,sha256:functionSource.sha256,start:fn.parent.getStart(sf),end:fn.parent.end};
   }
   result.functions.push({source:functionSource,name:fn.name.text,...(scope?{scope}:{})});
   for(const read of binding.reads){if(read.file!==binding.binding.file||read.sha256!==binding.binding.sha256)throw Error('context-import-read-outside-binding-module');result.reads.push({read,binding:binding.binding,consumer:request.initializer.render,name:binding.name,kind:'value',functionSource:functionSource});}
   requireCurrent();
  }
 }
 return result;
}
