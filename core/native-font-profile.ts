/** Font-axis comparison is exact. Missing source axes never authorize native
 * materialized defaults; a separate calibration must establish those values. */
export function nativeFontAxesValid(value:unknown):value is Record<string,number> {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 return Reflect.ownKeys(value).every(tag=>{const d=Object.getOwnPropertyDescriptor(value,tag);return typeof tag==='string'&&/^[\x20-\x7e]{4}$/.test(tag)&&!!d&&d.enumerable&&'value'in d&&typeof d.value==='number'&&Number.isFinite(d.value);});
}
export function nativeFontNameExact(actual:unknown,expected:unknown):boolean {
 const a=actual as {family?:unknown;style?:unknown;variationSettings?:unknown}|undefined;
 const e=expected as {family?:unknown;style?:unknown;variationSettings?:unknown}|undefined;
 if(!a||!e||typeof e.family!=='string'||!e.family||typeof e.style!=='string'||!e.style||a.family!==e.family||a.style!==e.style)return false;
 if(e.variationSettings===undefined)return a.variationSettings===undefined;
 if(!nativeFontAxesValid(e.variationSettings)||!nativeFontAxesValid(a.variationSettings))return false;
 const expectedAxes=e.variationSettings,actualAxes=a.variationSettings;
 const keys=Object.keys(expectedAxes).sort(),other=Object.keys(actualAxes).sort();
 return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&actualAxes[key]===expectedAxes[key]);
}
export function nativeFontDefaultProfileRequired(actual:unknown,expected:unknown):boolean {
 const a=actual as {family?:unknown;style?:unknown;variationSettings?:unknown}|undefined;
 const e=expected as {family?:unknown;style?:unknown;variationSettings?:unknown}|undefined;
 return !!a&&!!e&&a.family===e.family&&a.style===e.style&&e.variationSettings===undefined&&a.variationSettings!==undefined;
}

/** Emitted only for an appearance writer, including explicit-only controls. */
export const NATIVE_FONT_NAME_EXACT_RUNTIME=`
function nativeFontAxesValid(value) {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 return Reflect.ownKeys(value).every(tag=>{const d=Object.getOwnPropertyDescriptor(value,tag);return typeof tag==='string'&&/^[\\x20-\\x7e]{4}$/.test(tag)&&!!d&&d.enumerable&&'value'in d&&typeof d.value==='number'&&Number.isFinite(d.value);});
}
function nativeFontNameExact(actual,expected) {
 if(!actual||!expected||typeof expected.family!=='string'||!expected.family||typeof expected.style!=='string'||!expected.style||actual.family!==expected.family||actual.style!==expected.style)return false;
 if(expected.variationSettings===undefined)return actual.variationSettings===undefined;
 if(!nativeFontAxesValid(expected.variationSettings)||!nativeFontAxesValid(actual.variationSettings))return false;
 const keys=Object.keys(expected.variationSettings).sort(),other=Object.keys(actual.variationSettings).sort();
 return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&actual.variationSettings[key]===expected.variationSettings[key]);
}
function nativeFontDefaultProfileRequired(actual,expected) {
 return !!actual&&!!expected&&actual.family===expected.family&&actual.style===expected.style&&expected.variationSettings===undefined&&actual.variationSettings!==undefined;
}
`;

/** Writer preflight metadata is never accepted as an independent native observation. */
export const NATIVE_AUTHORED_FONT_PROFILE_RUNTIME=`
${NATIVE_FONT_NAME_EXACT_RUNTIME}
const authoredFontProfiles=new Map();
const authoredFontCalibrations={version:1,receiptKind:'named-face-default-calibration',authority:'writer-preflight-only',nativeQualification:'unqualified',profiles:[]};
if(typeof NATIVE_RESULT!=='undefined')NATIVE_RESULT.authoredFontCalibrations=authoredFontCalibrations;
const authoredFontKey=font=>JSON.stringify([font.family,font.style]);
const authoredFontCopy=value=>JSON.parse(JSON.stringify(value));
function authoredFontAxes(font,tags) {
 if(tags===null){if(font.variationSettings!==undefined)throw Error('authored-font-profile-static-axes');return;}
 if(!Array.isArray(tags)||!tags.length||new Set(tags).size!==tags.length||tags.some(tag=>typeof tag!=='string'||!/^[\\x20-\\x7e]{4}$/.test(tag))||
  !nativeFontAxesValid(font.variationSettings)||JSON.stringify([...tags].sort())!==JSON.stringify(Object.keys(font.variationSettings).sort()))throw Error('authored-font-profile-axis-inventory');
}
async function prepareAuthoredFont(font) {
 if(!font||typeof font.family!=='string'||!font.family||typeof font.style!=='string'||!font.style||
  typeof figma.loadFontAsync!=='function'||typeof figma.getFontFamilyVariationAxes!=='function')throw Error('authored-font-profile-api-unavailable');
 const request={family:font.family,style:font.style},key=authoredFontKey(request);
 if(font.variationSettings===undefined&&authoredFontProfiles.has(key))return authoredFontProfiles.get(key);
 let tags;
 try{tags=figma.getFontFamilyVariationAxes(request.family);await figma.loadFontAsync(font);}
 catch(error){throw Error('authored-font-profile-font-unavailable');}
 if(font.variationSettings!==undefined){authoredFontAxes(font,tags);return;}
 if(typeof figma.createText!=='function')throw Error('authored-font-profile-api-unavailable');
 const record={requested:request,probeId:null,status:'refused',removed:false};
 authoredFontCalibrations.profiles.push(record);
 let probe,profile;
 try{
  // Fonts are loaded before allocation. No await while the owned probe exists.
  probe=figma.createText();record.probeId=probe&&probe.id;
  if(!probe||typeof probe.id!=='string'||!probe.id||probe.type!=='TEXT'||probe.characters!==''||typeof probe.remove!=='function')throw Error('authored-font-profile-probe-invalid');
  probe.fontName=request;
  const observed=authoredFontCopy(probe.fontName),weight=probe.fontWeight;
  if(observed.family!==request.family||observed.style!==request.style||typeof weight!=='number'||!Number.isFinite(weight)||weight<1||weight>1000)throw Error('authored-font-profile-face-mismatch');
  authoredFontAxes(observed,tags);
  profile={requested:request,fontName:observed,fontWeight:weight};
 }finally{
  if(probe){try{probe.remove();record.removed=probe.removed===true;}catch(error){record.removed=false;}}
  if(probe&&!record.removed)throw Error('authored-font-profile-probe-removal-unverified');
 }
 record.status='calibrated';record.profile=authoredFontCopy(profile);
 authoredFontProfiles.set(key,profile);return profile;
}
function authoredExpectedFontName(font) {
 if(font.variationSettings!==undefined){if(!nativeFontAxesValid(font.variationSettings))throw Error('authored-font-profile-explicit-axes-invalid');return font;}
 const profile=authoredFontProfiles.get(authoredFontKey(font));
 if(!profile)throw Error('authored-font-default-profile-unverified');
 return profile.fontName;
}
function authoredFontNameSame(actual,expected) {
 return nativeFontNameExact(actual,authoredExpectedFontName(expected));
}
function authoredScalarFontName(font,weight,boundWeight) {
 const expected=authoredFontCopy(authoredExpectedFontName(font));
 // A verified scalar FONT_WEIGHT binding owns only the registered weight axis.
 // Every other materialized default remains pinned to the independent probe.
 if(boundWeight&&expected.variationSettings&&Object.hasOwn(expected.variationSettings,'wght'))expected.variationSettings.wght=weight;
 return expected;
}
`;
