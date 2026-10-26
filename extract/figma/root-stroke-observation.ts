import type {DumpNode} from './types.js';
/** A representative hex is not a stack certificate. Inspect every original
 * entry (including hidden ones) before exposing the bounded root-stroke API. */
export function insideRootStrokeObservation(node:DumpNode):{color:string;weight:number;variableId?:string}|undefined {
 const stack=node.sourceStrokeStack,pattern=node.sourceStrokePattern;
 if(!pattern||pattern.version!==1||pattern.complete!==true||!Array.isArray(pattern.dashes)||pattern.dashes.length!==0)return undefined;
 if(!stack||stack.version!==1||stack.complete!==true||stack.order!=='bottom-to-top'||stack.paints.length!==1||stack.paints[0].index!==0||
    node.strokeAlign!=='INSIDE'||node.strokesIncludedInLayout!==false||node.strokeWeights||
    typeof node.strokeWeight!=='number'||!Number.isFinite(node.strokeWeight)||node.strokeWeight<0)return undefined;
 const raw=stack.paints[0].paint;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
 const p=raw as Record<string,any>,c=p.color;
 if(p.type!=='SOLID'||(p.visible!==undefined&&p.visible!==true)||(p.blendMode??'NORMAL')!=='NORMAL'||
    Object.keys(p).some(k=>!['type','visible','blendMode','color','opacity','boundVariables'].includes(k))||
    !c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['r','g','b','a'].includes(k))||
    !['r','g','b'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k])&&c[k]>=0&&c[k]<=1)||
    ![c.a??1,p.opacity??1].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))return undefined;
 const bound=p.boundVariables,alias=bound?.color;
 if(bound&&(!alias||Object.keys(bound).length!==1||alias.type!=='VARIABLE_ALIAS'||Object.keys(alias).some(k=>!['type','id'].includes(k))||typeof alias.id!=='string'||!alias.id))return undefined;
 return {color:`rgba(${c.r*255},${c.g*255},${c.b*255},${(c.a??1)*(p.opacity??1)})`,weight:node.strokeWeight,...(alias?{variableId:alias.id}:{})};
}
