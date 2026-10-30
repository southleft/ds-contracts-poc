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

/** Prepared-library scalar TEXT boxes keep their own identity. This admits only
 * positive token width plus either token/literal fixed height or one glyph with
 * an explicit pixel line-height. It never grants generic styled-text ownership. */
export function nativeTokenTextBox(spec:NodeSpec):{width:number;height?:number;lineHeight?:number}|undefined {
 if(spec.type!=='text'||!spec.fixedWidth)return;
 if(spec.fill||spec.stroke||spec.bindings||spec.lits&&Object.keys(spec.lits).length||spec.children?.length||
   spec.textStyle||spec.authoredTextAppearance||spec.textAppearanceTarget||spec.textSizeTarget||spec.literalTextBox||
   spec.absolute||spec.overlay||spec.insetOverlay||spec.rotation||spec.layout||spec.margins||spec.pct!==undefined||
   spec.fillW||spec.fillH||spec.widthFill||spec.rootFillWidth||spec.fillText||spec.grow||spec.growBasis||spec.crossStretch||
   spec.textTruncation||spec.textAutoResize!==undefined||typeof spec.characters!=='string'||!spec.characters.length)
  throw Error('native-token-text-box-unqualified');
 const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
 const name=(v:unknown)=>typeof v==='string'&&v.length>0&&v.split('/').every(p=>p.length>0);
 if(!valid(spec.fixedWidth.px)||!name(spec.fixedWidth.varName)||spec.fixedHeight&&
   (!valid(spec.fixedHeight.px)||spec.fixedHeight.varName!==undefined&&!name(spec.fixedHeight.varName)))
  throw Error('native-token-text-box-unqualified');
 if(spec.fixedHeight)return {width:spec.fixedWidth.px,height:spec.fixedHeight.px};
 const line=spec.lineHeight;
 if([...spec.characters].length!==1||/[\r\n]/.test(spec.characters)||typeof line!=='object'||line.unit!=='PIXELS'||!valid(line.value))
  throw Error('native-token-text-box-unqualified');
 return {width:spec.fixedWidth.px,lineHeight:line.value};
}
/** Recompute the admitted box from the selected spec, never from a node stamp. */
export function nativeTokenTextBoxMatches(spec:NodeSpec,v:Record<string,unknown>):boolean {
 let box:ReturnType<typeof nativeTokenTextBox>;try{box=nativeTokenTextBox(spec);}catch{return false;}
 const equal=(a:unknown,b:number)=>a===b||a===Math.fround(b);
 return !!box&&JSON.stringify(box)===JSON.stringify(spec.tokenTextBox)&&equal(v.width,box.width)&&
  equal(v.height,box.height??box.lineHeight!)&&v.textAutoResize===(box.height===undefined?'HEIGHT':'NONE')&&v.textAlignVertical==='TOP';
}
export const NATIVE_TOKEN_TEXT_BOX_RUNTIME=`
    if(spec.tokenTextBox){
      node.textAutoResize=spec.tokenTextBox.height===undefined?'HEIGHT':'NONE';
      node.textAlignVertical='TOP';
      node.resize(spec.tokenTextBox.width,spec.tokenTextBox.height===undefined?spec.tokenTextBox.lineHeight:spec.tokenTextBox.height);
      node.setBoundVariable('width',need(spec.fixedWidth.varName));
      if(spec.fixedHeight?.varName)node.setBoundVariable('height',need(spec.fixedHeight.varName));
    }
`;
