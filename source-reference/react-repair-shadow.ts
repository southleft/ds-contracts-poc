/** A root shadow as React rendered it, read the way the compiler reads it:
 * the engine's own box-shadow parser (the one that turned the computed value
 * into native effects) and the native reader's float32-tolerant comparison. */
import {createFigmaEngine,type NodeSpec} from '../core/emit-figma-script.js';
import {nativeShadowStackMatches} from '../core/native-source-observation.js';

let engine:ReturnType<typeof createFigmaEngine>|undefined;
// The parser reads no token: an empty corpus compiles the same reader.
const reader=()=>engine??=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()} as unknown as Parameters<typeof createFigmaEngine>[0]);

export function repairShadowShows(css:unknown,effects:unknown):boolean {
  if(typeof css!=='string')return false;
  const stack=reader().parseShadowStack(css);
  return !!stack&&nativeShadowStackMatches({effectStack:stack} as NodeSpec,effects);
}

/** CSSOM "serialize an identifier": the spelling Chromium's selectorText
 * gives a class name, e.g. `shadow-\[0px_1px\]` for `shadow-[0px_1px]`. */
export function cssIdentifier(value:string) {
  let out='';
  for(let i=0;i<value.length;i++) {
    const c=value.charCodeAt(i),ch=value[i];
    if(c===0)out+='�';
    else if((c>=1&&c<=0x1f)||c===0x7f||(i===0&&c>=0x30&&c<=0x39)||(i===1&&c>=0x30&&c<=0x39&&value.charCodeAt(0)===0x2d))out+='\\'+c.toString(16)+' ';
    else if(i===0&&value.length===1&&c===0x2d)out+='\\'+ch;
    else if(c>=0x80||c===0x2d||c===0x5f||(c>=0x30&&c<=0x39)||(c>=0x41&&c<=0x5a)||(c>=0x61&&c<=0x7a))out+=ch;
    else out+='\\'+ch;
  }
  return out;
}

type ShadowNode={style:Record<string,string>;vrefs?:Record<string,unknown>};
/** A root shadow class swap may change the shadow's own variable chain and
 * nothing else: the same variables in the same order, declared by the edited
 * rule instead of the original, each changed value the one the render reports
 * on the root (§D.177). Accepted changes are copied onto `expected`. */
export function acceptShadowVariables(expected:ShadowNode,actual:ShadowNode,edit:{before:string;after:string}):boolean {
  const was=expected.vrefs?.['box-shadow'],now=actual.vrefs?.['box-shadow'];
  if(was===undefined&&now===undefined)return true;
  if(!Array.isArray(was)||!Array.isArray(now)||was.length!==now.length)return false;
  const from='.'+cssIdentifier(edit.before),to='.'+cssIdentifier(edit.after);
  const names:string[]=[];
  for(let i=0;i<was.length;i++) {
    const a=was[i],b=now[i];
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a[0]!==b[0]||a[3]!==b[3]||typeof a[0]!=='string')return false;
    if(a[2]!==b[2]&&!(a[2]===from&&b[2]===to))return false;
    if(a[1]!==b[1]) {
      if(!a[0].startsWith('--')||actual.style[a[0]]!==b[1]||expected.style[a[0]]!==a[1])return false;
      names.push(a[0]);
    }
  }
  for(const name of names)expected.style[name]=actual.style[name];
  expected.vrefs!['box-shadow']=structuredClone(now);
  return true;
}
