import ts from 'typescript';
import {observeReactRuntimeDependencies} from './react-runtime-export.js';
import {observeReactRuntimeHelperCandidates} from './react-runtime-helper-candidates.js';
import {prepareReactEffectProgram} from './react-helper-effects.js';
import {readReactElementCreationSites} from './react-element-creation.js';
import {linkRootDependencies} from './link-root-dependencies.js';
import type {ReactReference} from './react-reference.js';
import type {ReactSourceProgram} from './react-source-program.js';
export function discoverCompiledDependencies(reference:ReactReference,input:ReactSourceProgram){let program=structuredClone(input);
const discovered:Array<{component:string;module:string;span:{start:number;end:number};target:ReactSourceProgram['components'][number]['componentReferences'][number]['target']}>=[],visited=new Set<string>();
for(let round=0;round<20;round++){
 let added=0;
 for(const c of program.components){const key=JSON.stringify([c.module,c.span]);if(visited.has(key))continue;visited.add(key);
 const {sf,checker,requireCurrent}=prepareReactEffectProgram(reference,c.module,{},{});const sites=readReactElementCreationSites(sf.text,sf.fileName,c.module,true);
 const visit=(n:any)=>{if(ts.isCallExpression(n)&&n.arguments.length&&n.getStart(sf)>=c.span.start&&n.end<=c.span.end&&sites.some(s=>s.factory==='createElement'&&s.span.start===n.getStart(sf)&&s.span.end===n.end)){
 let target=n.arguments[0];const chain=[];while(ts.isPropertyAccessExpression(target)){chain.unshift(target.name.text);target=target.expression;}
 if(ts.isIdentifier(target)){const symbol=checker.getSymbolAtLocation(target),declarations=symbol?.declarations??[];if(declarations.length===1){const d=declarations[0];let imported:string[]|null=null,stmt:ts.Node|undefined=d;while(stmt&&!ts.isImportDeclaration(stmt))stmt=stmt.parent;
 if(stmt&&ts.isStringLiteral(stmt.moduleSpecifier)){if(ts.isImportSpecifier(d))imported=[d.propertyName?.text??d.name.text,...chain];else if(ts.isNamespaceImport(d)&&chain.length)imported=chain;else if(ts.isImportClause(d))imported=['default',...chain];
 if(imported){const ref={span:{start:n.getStart(sf),end:n.end},target:{kind:'component' as const,name:n.arguments[0].getText(sf),module:stmt.moduleSpecifier.text,export:imported.join('.'),dependencyProblem:'implementation-unavailable'}};c.componentReferences.push(ref);discovered.push({component:c.exportName,module:c.module,...ref});added++;}
 }}}
 }ts.forEachChild(n,visit);};visit(sf);requireCurrent();}
 if(!added)break;const before=program.components.length;program=observeReactRuntimeDependencies(reference,program).program;if(program.components.length===before)break;
}
program=observeReactRuntimeHelperCandidates(reference,program);
const linked=linkRootDependencies(reference,program);program=linked.program;return {program,observations:[...discovered,...linked.observations]};}
