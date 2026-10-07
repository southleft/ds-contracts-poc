import type {NodeSpec} from './emit-figma-script.js';
/** Literal dimensions belong to an owned bare text box. Styled/token-sized
 * wrappers keep their existing path; explicit HUG cannot also have a width. */
export function nativeLiteralTextBox(spec:NodeSpec):{width:number;height?:number}|undefined {
 if(spec.type!=='text'||spec.fill||spec.fixedWidth||spec.fixedHeight||spec.bindings||spec.lits?.width===undefined)return;
 const width=spec.lits.width,height=spec.lits.height;
 if(!Number.isFinite(width)||width<=0||height!==undefined&&(!Number.isFinite(height)||height<=0)||spec.textAutoResize==='WIDTH_AND_HEIGHT')throw Error('native-literal-text-box-unqualified');
 return {width,...(height===undefined?{}:{height})};
}
export const NATIVE_LITERAL_TEXT_BOX_RUNTIME=`
    if(spec.literalTextBox){
      node.textAutoResize=spec.literalTextBox.height===undefined?'HEIGHT':'NONE';
      node.resize(spec.literalTextBox.width,spec.literalTextBox.height===undefined?Math.max(1,node.height):spec.literalTextBox.height);
    }
`;
