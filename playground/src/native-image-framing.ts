import type { SourceFrame } from '../../source-reference/source-framing.js';
import type { NativeImageSummary } from '../../source-reference/native-operation-images.js';

/** Align observed layout origins, never search or resize image pixels. Keep
 * enough whitespace to show all shadow outsets on either surface. */
export function nativeImageFraming(source: SourceFrame | undefined, image: NativeImageSummary | undefined) {
  const empty={paddingLeft:0,paddingTop:0};
  if(!source || !image?.layoutOffset) return {source:empty,native:{paddingLeft:8,paddingTop:8}};
  const original={x:source.bounds.x-source.crop.x,y:source.bounds.y-source.crop.y},native=image.layoutOffset;
  const x=Math.max(original.x,native.x),y=Math.max(original.y,native.y);
  return {source:{paddingLeft:x-original.x,paddingTop:y-original.y},native:{paddingLeft:x-native.x,paddingTop:y-native.y}};
}
