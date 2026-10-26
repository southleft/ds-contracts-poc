import {type Contract,type Part,instanceRootColor,instanceRootValue} from '../scripts/contract-schema.js';
import {tokenModeValues} from '../packages/core/src/anatomy.js';
import {STROKE_RING_RUNTIME} from './react-stroke-ring-runtime.js';

export const hasInsideRootStroke=(part:Part):boolean=>part.instanceRootInputs?.includes('border-color')===true&&part.instanceRootInputs.includes('border-width');
export function insideRootStrokePair(part:Part,child:Contract):boolean {
 const own=part.component?.rootOverrides;
 if(!own?.['border-width']&&!own?.['border-color'])return false;
 if(!own['border-width']||!own['border-color']||Object.keys(own).length!==2||!hasInsideRootStroke(child.anatomy.root))throw Error('instance-inside-stroke-pair-unqualified');
 return true;
}
export function insideRootStrokeTransport(parent:Contract,child:Contract,part:Part,values:Record<string,string|number|boolean|undefined>,tokens:unknown,cssVariables=false):Record<string,string|number> {
 if(!insideRootStrokePair(part,child))return {};
 const result:Record<string,string|number>={};
 for(const channel of ['border-width','border-color']as const){
  let path=part.component!.rootOverrides![channel]!.slice(1,-1);
  path=path.replace(/\{([^}]+)\}/g,(_,name:string)=>{if(!parent.props.some(p=>p.name===name)||values[name]===undefined)throw Error('instance-inside-stroke-unbounded-input');return String(values[name]);});
  const modes=tokenModeValues(tokens,path);
  if(modes.length!==2||modes.some(v=>v===undefined)||new Set(modes).size!==1)throw Error('instance-inside-stroke-mode-unqualified');
  const value=channel==='border-color'?instanceRootColor(modes[0]):`${instanceRootValue(channel,modes[0])}px`;
  result[cssVariables?(channel==='border-color'?'--_stroke-color':'--_stroke-width'):(channel==='border-color'?'borderColor':'borderWidth')]=cssVariables?`var(--${path.replaceAll('.','-')})`:value;
 }
 return result;
}

/** Activate the existing foreground ring only for an actual paired usage input.
 * Omission returns the identical host: no position, isolation or extra child. */
export function insideRootStrokeRuntime(contract:Contract,mode:'module'|'inline',hasRingRuntime=false,layer=1):string {
 if(!hasInsideRootStroke(contract.anatomy.root))return '';
 const root=contract.anatomy.root,position=root.declared?.position??root.literals?.position;
 if(root.tokens?.position!==undefined||position!==undefined&&!['relative','absolute','fixed','sticky'].includes(position))throw Error('instance-inside-stroke-position-unqualified');
 const field=mode==='module'?'rest.style':'style',width=mode==='module'?'--_stroke-width':'borderWidth',color=mode==='module'?'--_stroke-color':'borderColor';
 const helper=`
import * as __DscStrokeReact from 'react';
${mode==='module'?'type CSSProperties = __DscStrokeReact.CSSProperties;':''}
${hasRingRuntime?'':STROKE_RING_RUNTIME}
function __dscInsideRootStroke(child:__DscStrokeReact.ReactElement<any>,input:__DscStrokeReact.CSSProperties|undefined):__DscStrokeReact.ReactElement<any> {
 const source=input as Record<string,unknown>|undefined,w=source?.[${JSON.stringify(width)}],c=source?.[${JSON.stringify(color)}];
 if(w===undefined&&c===undefined)return child;
 if(w===undefined||c===undefined||typeof child.type!=='string')throw new Error('instance-inside-stroke-pair-unqualified');
 const old=child.props.style||{},base={...old};delete base[${JSON.stringify(width)}];delete base[${JSON.stringify(color)}];
 const ring=strokeRingOverlay({borderWidth:w,borderColor:c} as CSSProperties,${layer});
 return __DscStrokeReact.cloneElement(child,{style:{...base,${position===undefined?'position:base.position??\'relative\',':''}isolation:'isolate'}},child.props.children,__DscStrokeReact.createElement('span',{'aria-hidden':true,'data-dsc-inside-stroke':'',style:ring}));
}
`;
 return helper;
}
