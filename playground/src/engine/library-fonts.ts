import { MAX_BYTES } from '../../server/react-library-input.js';
export interface LibraryFontUpload {
  id: number;
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  file: File | null;
  license: File | null;
}
async function encoded(file: File, limit: number): Promise<string> {
  if (!file.size || file.size > limit) throw Error(`${file.name}: file exceeds the font upload size limit.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size) throw Error(`${file.name}: file changed while reading.`);
  let binary = '';
  for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(binary);
}
/** Files stay in session memory. The host validates their formats and declared names. */
export async function encodeLibraryRequest(selection: object, fonts: readonly LibraryFontUpload[]): Promise<string> {
  if (fonts.length > 32) throw Error('Add at most 32 font faces.');
  // Reject before reading large files; the final check also counts metadata and contracts.
  const total = fonts.reduce((sum, face) => sum + Math.ceil((face.file?.size ?? 0) / 3) * 4 + Math.ceil((face.license?.size ?? 0) / 3) * 4, 0);
  if (total > MAX_BYTES) throw Error('React library request exceeds 5 MB including encoded fonts. Use fewer or smaller font files.');
  const uploads = [];
  for (const face of fonts) {
    if (!face.file || !face.family.trim()) throw Error('Choose a font file and enter its family name for every font face.');
    uploads.push({ family: face.family.trim(), weight: face.weight.trim(), style: face.style,
      dataBase64: await encoded(face.file, MAX_BYTES),
      ...(face.license ? { license: { dataBase64: await encoded(face.license, 256 * 1024) } } : {}) });
  }
  const body = JSON.stringify({ ...selection, ...(uploads.length ? { fonts: uploads } : {}) });
  if (new TextEncoder().encode(body).length > MAX_BYTES) throw Error('React library request exceeds 5 MB including encoded fonts. Use fewer or smaller font files.');
  return body;
}
