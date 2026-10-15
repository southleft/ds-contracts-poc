import {mkdtempSync,readFileSync,realpathSync,rmSync,statSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright-core';
import {consumerSlotNames} from './design-consumer-slots.js';
import {resolveToolchain} from './package-react-library.js';

const MARKER='Consumer child content';

/** Only the installed public API can establish that children is a Boolean
 * input. A contract annotation alone must not hide an accepted string. */
export async function installedBooleanChildren(consumer:string,packageName:string,component:string):Promise<boolean>{
  const ts=await import('typescript');
  const toolchain=resolveToolchain();
  const work=mkdtempSync(path.join(consumer,'.children-types-'));
  try{
    const file=path.join(work,'probe.tsx');
    const source=[
      `import { ${component} as Component } from ${JSON.stringify(packageName)};`,
      "import type {ComponentProps} from 'react';",
      'type Children = ComponentProps<typeof Component>["children"];',
      'declare const props: Omit<ComponentProps<typeof Component>, "children">;',
      'const trueValue = <Component {...props} children={true} />;',
      'const falseValue = <Component {...props} children={false} />;',
      `const stringValue = <Component {...props} children=${JSON.stringify(MARKER)} />;`,
    ].join('\n');
    writeFileSync(file,source);
    const options: import('typescript').CompilerOptions={
      noEmit:true,strict:true,skipLibCheck:false,types:[],
      jsx:ts.JsxEmit.ReactJSX,
      target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
      moduleResolution:ts.ModuleResolutionKind.Bundler,allowArbitraryExtensions:true,
      paths:{react:[path.join(toolchain.reactTypes,'index.d.ts')],'react/jsx-runtime':[path.join(toolchain.reactTypes,'jsx-runtime.d.ts')]},
    };
    // A bundler loads the package's side-effect CSS, but TypeScript needs a
    // module declaration. Admit only an actual CSS file within this installed
    // package. Missing assets, CSS value imports, and unrelated diagnostics
    // still refuse; no wildcard declaration or skipped diagnostic is used.
    const installed=path.resolve(consumer,'node_modules',...packageName.split('/'));
    const cssDeclaration=(name:string):string|undefined=>{
      if(!name.endsWith('.d.css.ts'))return;
      const css=path.resolve(name.slice(0,-'.d.css.ts'.length)+'.css');
      try{
        // TypeScript can canonicalize a symlinked consumer (including macOS
        // /var -> /private/var). Compare physical paths on both sides.
        if(!realpathSync(css).startsWith(realpathSync(installed)+path.sep)||!statSync(css).isFile())return;
      }catch{return;}
      return 'export {};';
    };
    const host=ts.createCompilerHost(options);
    const fileExists=host.fileExists,readFile=host.readFile;
    host.fileExists=name=>fileExists(name)||cssDeclaration(name)!==undefined;
    host.readFile=name=>readFile(name)??cssDeclaration(name);
    const program=ts.createProgram([file],options,host);
    const diagnostics=ts.getPreEmitDiagnostics(program);
    const assignmentLine=(diagnostic:typeof diagnostics[number])=>
      (diagnostic.code===2322||diagnostic.code===2769)&&diagnostic.file?.fileName===file&&diagnostic.start!==undefined
        ?diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line:-1;
    // Only the three deliberately varied assignment sites are expected to
    // differ. Missing imports and unrelated invalid declarations prove nothing.
    const unrelated=diagnostics.filter(d=>![4,5,6].includes(assignmentLine(d)));
    if(unrelated.length)throw Error('children-type-check-unqualified: '+unrelated.map(d=>
      `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`).join(' | '));
    const parsed=program.getSourceFile(file)!;
    const alias=parsed.statements.find(ts.isTypeAliasDeclaration)!;
    const checker=program.getTypeChecker();
    const imported=parsed.statements.find(ts.isImportDeclaration)?.importClause?.namedBindings;
    const componentType=imported&&ts.isNamedImports(imported)
      ?checker.getTypeAtLocation(imported.elements[0].name):undefined;
    const type=checker.getTypeFromTypeNode(alias.type);
    const members=type.isUnion()?type.types:[type];
    const booleanOnly=members.some(t=>(t.flags&ts.TypeFlags.BooleanLike)!==0)&&
      members.every(t=>(t.flags&(ts.TypeFlags.BooleanLike|ts.TypeFlags.Undefined))!==0);
    // A last-signature ComponentProps projection cannot prove every overload.
    // Keep overloaded public APIs on the original runtime marker path.
    const singleSignature=componentType&&checker.getSignaturesOfType(componentType,ts.SignatureKind.Call).length===1;
    return !!singleSignature&&booleanOnly&&diagnostics.length===1&&diagnostics[0].code===2322&&assignmentLine(diagnostics[0])===6;
  }finally{rmSync(work,{recursive:true,force:true});}
}

/** Retains the existing children receipt and acceptance rules. A Boolean
 * visibility prop is already exercised by the ordinary variant probes; text
 * outside its proven installed type must not replace it on the live page. */
export async function probeConsumerChildren(page:Page,contract:any,consumer:string,packageName:string,component:string,keys:string[]){
  const declaresSlot=consumerSlotNames(contract.anatomy).includes('children');
  const childrenProps=contract.props.filter((p:any)=>(p.bindings?.code?.prop??p.name)==='children');
  if(!declaresSlot&&childrenProps.length===1&&childrenProps[0].type==='boolean'&&
    await installedBooleanChildren(consumer,packageName,component)){
    return {contractDeclaresSlot:false,renderedAtRuntime:false,refusedByType:true};
  }
  await page.evaluate(m=>(window as any).__consumer.setVariantOverride({children:m}),MARKER);
  const cellTexts=await Promise.all(keys.map(key=>page.locator(`[data-cell="${key}"]`).innerText()));
  const shown=cellTexts.length>0&&cellTexts.every(t=>t.includes(MARKER));
  await page.evaluate(()=>(window as any).__consumer.setVariantOverride(null));
  const declaration=readFileSync(path.join(consumer,'node_modules',...packageName.split('/'),'dist',component,`${component}.d.ts`),'utf8');
  const propsInterface=declaration.slice(declaration.indexOf(`interface ${component}Props`));
  const refusedByType=/Omit<[^>]*>,\s*(?:'[^']*'\s*\|\s*)*'children'/.test(propsInterface.split('{')[0]);
  return {contractDeclaresSlot:declaresSlot,renderedAtRuntime:shown,refusedByType};
}

export function consumerChildrenProblems(receipt:{contractDeclaresSlot:boolean;renderedAtRuntime:boolean;refusedByType:boolean}):string[]{
  if(receipt.contractDeclaresSlot&&!receipt.renderedAtRuntime)return ['children-slot-discarded'];
  if(!receipt.contractDeclaresSlot&&!receipt.renderedAtRuntime&&!receipt.refusedByType)return ['children-accepted-but-discarded'];
  return [];
}
