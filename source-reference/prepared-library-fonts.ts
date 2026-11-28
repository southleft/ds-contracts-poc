/** A prepared library must load its declared faces before allocating its token scope. */
type Font = {family:string;styles:string[]};
const valid = (fonts:unknown):fonts is Font[] => Array.isArray(fonts) && fonts.length>0 && fonts.every(font =>
  font && typeof font==='object' && !Array.isArray(font) && Object.keys(font).sort().join(',')==='family,styles' &&
  typeof font.family==='string' && font.family.trim()===font.family && font.family.length>0 &&
  Array.isArray(font.styles) && font.styles.length>0 && font.styles.every((style:unknown)=>typeof style==='string' && style.length>0 && style.trim()===style));
const problem = (font:Font) => 'native-font-unavailable:'+JSON.stringify(font);

export function declaredLibraryFontRefusal(value:unknown,fonts:unknown):value is string {
  return valid(fonts) && fonts.some(font=>problem(font)===value);
}

export function preflightLibraryFonts(script:string,fonts:unknown,fileKey:string,preparationRevision:string):string {
  if(!valid(fonts))throw Error('prepared-library-font-requirements-invalid');
  return `{
  const refusal=problem=>({version:1,status:'refused',acceptedContract:null,nativeQualification:'unqualified',
    preparationRevision:${JSON.stringify(preparationRevision)},receiptKind:'creation-objects-only',
    allocation:{collection:null,modes:[],variables:[]},problems:[problem]});
  const fileKey=${JSON.stringify(fileKey)};
  if(figma.fileKey!==fileKey)return refusal('native-token-write-file-mismatch');
  if(typeof figma.loadFontAsync!=='function')return refusal('native-token-write-api-unavailable');
  for(const font of ${JSON.stringify(fonts)}){
    let loaded=false;
    for(const style of font.styles){
      try{await figma.loadFontAsync({family:font.family,style});loaded=true;break}catch{}
    }
    if(figma.fileKey!==fileKey)return refusal('native-token-write-file-mismatch');
    if(!loaded)return refusal('native-font-unavailable:'+JSON.stringify(font));
  }
}
${script}`;
}
