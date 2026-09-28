/** A source edit candidate, not a write permit. The host must supply an
 * authenticated original component identity, rebuild CSS in isolation and
 * observe every affected case before choosing a unique candidate. No source
 * code, class helper or project build script is executed by this module. */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { ReactOwnership } from './react-ownership.js';

type SourceIdentity = ReactOwnership['components'][number]['source'];
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const equal=(a:number,b:number)=>a===b||Math.fround(a)===Math.fround(b);
const fail=(reason:string):never=>{throw Error('react-utility-source-'+reason);};
const unwrap=(expression:ts.Expression):ts.Expression=>
  ts.isParenthesizedExpression(expression)||ts.isAsExpression(expression)||ts.isSatisfiesExpression(expression)
    ?unwrap(expression.expression):expression;

/** The string literals of the one root element's className, in source order,
 * read exactly as the source reader reads the declaration. */
function rootClassLiterals(text:string,source:SourceIdentity) {
  const file=ts.createSourceFile(source.module,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if((file as ts.SourceFile & {parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length)fail('syntax-invalid');
  let declaration:ts.Node|undefined;
  const find=(node:ts.Node)=>{
    if(node.getStart(file)===source.span.start&&node.end===source.span.end&&
        (ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node)))declaration=node;
    ts.forEachChild(node,find);
  };
  find(file);
  if(!declaration)fail('declaration-unavailable');
  let fn:ts.FunctionDeclaration|ts.ArrowFunction|ts.FunctionExpression;
  if(ts.isFunctionDeclaration(declaration!))fn=declaration!;
  else {
    const initial=(declaration! as ts.VariableDeclaration).initializer;
    if(!initial)fail('function-unavailable');
    let value=unwrap(initial!);
    // Recognize only the same one-function wrapper shape as the source reader.
    // Its identity and actual output remain the host's observation obligation.
    if(ts.isCallExpression(value)&&value.arguments.length===1)value=unwrap(value.arguments[0]);
    if(!ts.isArrowFunction(value)&&!ts.isFunctionExpression(value))fail('function-unavailable');
    fn=value as ts.ArrowFunction|ts.FunctionExpression;
  }
  if(!fn.body)fail('function-unavailable');
  const returns:ts.Expression[]=[];
  if(ts.isBlock(fn.body!)) {
    for(const statement of (fn.body! as ts.Block).statements) {
      if(ts.isReturnStatement(statement)&&statement.expression)returns.push(statement.expression);
      if(ts.isIfStatement(statement)||ts.isSwitchStatement(statement)||ts.isTryStatement(statement)||
          ts.isIterationStatement(statement,false))fail('conditional-root-unsupported');
    }
  } else returns.push(fn.body! as ts.Expression);
  if(returns.length!==1)fail('root-unavailable');
  const root=unwrap(returns[0]);
  const element=ts.isJsxElement(root)?root.openingElement:ts.isJsxSelfClosingElement(root)?root:undefined;
  if(!element)fail('root-unavailable');
  const attributes=element!.attributes.properties.filter((p):p is ts.JsxAttribute=>ts.isJsxAttribute(p)&&p.name.getText(file)==='className');
  if(attributes.length!==1||!attributes[0].initializer)fail('class-unavailable');
  const literals:ts.StringLiteralLike[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isStringLiteralLike(node)){literals.push(node);return;}
    // Do not propose a replacement in an unevaluated nested callback or in
    // template substitutions whose runtime class boundaries are unknown.
    if(ts.isArrowFunction(node)||ts.isFunctionExpression(node)||ts.isTemplateExpression(node))return;
    ts.forEachChild(node,visit);
  };
  visit(attributes[0].initializer!);
  return {file,literals};
}
/** Whitespace-separated class tokens whose bytes are exactly the source bytes. */
function* rootClassTokens(text:string,source:SourceIdentity) {
  const {file,literals}=rootClassLiterals(text,source);
  for(const literal of literals) {
    const start=literal.getStart(file)+1,raw=text.slice(start,literal.end-1);
    // An escape or JSX entity needs its own source mapping. Never estimate an
    // offset from the cooked string and accidentally replace different bytes.
    if(raw!==literal.text||raw.includes('\\')||raw.includes('&'))continue;
    for(const token of raw.matchAll(/\S+/g))yield {token:token[0],offset:start+token.index!};
  }
}
const candidateFor=(text:string,source:SourceIdentity,offset:number,before:string,after:string,rank?:0|1)=>{
  const result=text.slice(0,offset)+after+text.slice(offset+before.length);
  return {qualification:'unverified-source-candidate' as const,source:structuredClone(source),
    beforeSha256:source.sourceSha256,afterSha256:sha(result),
    edit:{start:offset,end:offset+before.length,before,after},result,
    ...(rank===undefined?{}:{rank}),
    limitations:['isolated-css-build-required','all-case-observation-required','unique-effect-required','source-write-not-authorized']};
};
export type ReactUtilitySourceCandidate=ReturnType<typeof candidateFor>;

export function proposeReactOpacityUtilityEdits(text:string,source:SourceIdentity,change:{before:number;after:number}) {
  if(sha(text)!==source.sourceSha256)fail('changed');
  if(![change.before,change.after].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||equal(change.before,change.after))
    fail('opacity-change-invalid');
  const percent=Math.round(change.after*100);
  const suffix=equal(percent/100,change.after)?String(percent):`[${change.after}]`;
  const candidates:ReactUtilitySourceCandidate[]=[];
  for(const {token,offset} of rootClassTokens(text,source)) {
    const match=/^(.*:)?opacity-(\d+(?:\.\d+)?|\[(?:\d*\.)?\d+\])$/.exec(token);
    if(!match)continue;
    const before=match[2].startsWith('[')?Number(match[2].slice(1,-1)):Number(match[2])/100;
    if(!equal(before,change.before))continue;
    candidates.push(candidateFor(text,source,offset,token,(match[1]??'')+'opacity-'+suffix));
  }
  if(!candidates.length)fail('opacity-utility-unavailable');
  return candidates;
}

/** A native effect as the readback records it. */
export type NativeShadowEffect={type:string;visible?:boolean;blendMode?:string;radius:number;spread?:number;
  offset:{x:number;y:number};color:{r:number;g:number;b:number;a:number}};
const SHADOW_SIZES=['2xs','xs','sm','md','lg','xl','2xl','none'];
/** The shortest decimal the Plugin API stores as the same float32. */
const decimal=(n:number)=>{
  for(let places=0;places<=7;places++){const d=Number(n.toFixed(places));if(Math.fround(d)===Math.fround(n))return d;}
  return undefined;
};
const zeroGeometry=(e:NativeShadowEffect)=>e.offset.x===0&&e.offset.y===0&&e.radius===0&&(e.spread??0)===0;
const sameEffect=(a:NativeShadowEffect,b:NativeShadowEffect)=>a.type===b.type&&[
  [a.offset.x,b.offset.x],[a.offset.y,b.offset.y],[a.radius,b.radius],[a.spread??0,b.spread??0],
  [a.color.r,b.color.r],[a.color.g,b.color.g],[a.color.b,b.color.b],[a.color.a,b.color.a]].every(([x,y])=>equal(x,y));
/** One layer as a Tailwind arbitrary value, or nothing when a number has no
 * exact CSS spelling (a color channel off the 8-bit grid, say). */
function arbitraryLayer(e:NativeShadowEffect) {
  if(e.visible===false||(e.blendMode!==undefined&&e.blendMode!=='NORMAL')||!['DROP_SHADOW','INNER_SHADOW'].includes(e.type))return undefined;
  const lengths=[e.offset.x,e.offset.y,e.radius,e.spread??0].map(decimal);
  const bytes=[e.color.r,e.color.g,e.color.b].map(c=>Math.round(c*255));
  if(lengths.some(n=>n===undefined)||bytes.some((b,i)=>b<0||b>255||Math.fround(b/255)!==Math.fround([e.color.r,e.color.g,e.color.b][i])))return undefined;
  const alpha=decimal(e.color.a);if(alpha===undefined||alpha<0||alpha>1)return undefined;
  return (e.type==='INNER_SHADOW'?'inset_':'')+lengths.map(n=>n+'px').join('_')+`_rgb(${bytes.join('_')}/${alpha})`;
}

/** Root shadow utility candidates for a designer's effect edit (§D.177).
 * Every named size of the scale is proposed (rank 0) beside one exact
 * arbitrary value (rank 1). The theme is never read or guessed: a staged
 * render of every recorded state selects, and a named utility that renders
 * the edit is preferred to the arbitrary spelling of the same shadow. */
export function proposeReactShadowUtilityEdits(text:string,source:SourceIdentity,
  change:{before:NativeShadowEffect[];after:NativeShadowEffect[]}) {
  if(sha(text)!==source.sourceSha256)fail('changed');
  const {before,after}=change;
  if(!Array.isArray(before)||!Array.isArray(after)||!before.length||!after.length||
      (before.length===after.length&&before.every((e,i)=>sameEffect(e,after[i]))))fail('shadow-change-invalid');
  // Leading invisible layers are other utilities' composition slots; they stay.
  let kept=0;
  while(kept<before.length-1&&kept<after.length&&zeroGeometry(before[kept])&&sameEffect(before[kept],after[kept]))kept++;
  const tail=after.slice(kept).map(arbitraryLayer);
  const arbitrary=tail.length&&tail.every(Boolean)?`shadow-[${tail.join(',')}]`:undefined;
  const candidates:ReactUtilitySourceCandidate[]=[];
  for(const {token,offset} of rootClassTokens(text,source)) {
    const match=/^(.*:)?shadow-(2xs|xs|sm|md|lg|xl|2xl|none|\[[^\s\]]+\])$/.exec(token);
    if(!match)continue;
    const prefix=match[1]??'';
    for(const size of SHADOW_SIZES)if(size!==match[2])candidates.push(candidateFor(text,source,offset,token,prefix+'shadow-'+size,0));
    if(arbitrary&&arbitrary!=='shadow-'+match[2])candidates.push(candidateFor(text,source,offset,token,prefix+arbitrary,1));
  }
  if(!candidates.length)fail('shadow-utility-unavailable');
  return candidates;
}
