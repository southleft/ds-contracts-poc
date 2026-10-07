import type { DumpFile, DumpImageAsset, DumpNode } from '../types.js';
import type { RestPaint } from './map.js';

/** Keep original paint-stack positions and source transforms; no rasterization. */
export function restImagePaints(fills: RestPaint[] | undefined): DumpNode['imagePaints'] {
  const paints = (fills ?? []).flatMap((paint, index) => {
    if (paint.type !== 'IMAGE' || paint.visible === false) return [];
    const out: NonNullable<DumpNode['imagePaints']>[number] = { index, imageHash: paint.imageRef };
    for (const key of ['scaleMode', 'imageTransform', 'rotation', 'scalingFactor', 'opacity', 'blendMode', 'filters'] as const)
      if (paint[key] !== undefined) out[key] = JSON.parse(JSON.stringify(paint[key]));
    return [out];
  });
  return paints.length ? paints : undefined;
}

export type ImageResponse = {
  ok: boolean; status: number;
  body?: ReadableStream<Uint8Array> | null;
  arrayBuffer?: () => Promise<ArrayBuffer>;
};
const EACH = 8 * 1024 * 1024, TOTAL = 4 * EACH;
/** Same byte budgets as the native plugin; SHA-1 binds bytes to Figma's imageRef.
 * Credentials are used only by the supplied API reader, never by asset requests. */
export async function collectRestImageAssets(dump: DumpFile,
  getImages: () => Promise<unknown>, download: (url: string) => Promise<ImageResponse>): Promise<Record<string, DumpImageAsset>> {
  const hashes = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const node = value as DumpNode;
    for (const paint of node.imagePaints ?? []) if (typeof paint.imageHash === 'string') hashes.add(paint.imageHash);
    for (const [key, child] of Object.entries(value)) if (key !== '_imageAssets') visit(child);
  };
  visit(dump);
  const assets: Record<string, DumpImageAsset> = Object.create(null);
  if (!hashes.size) return assets;
  let images: Record<string, unknown>;
  try { images = (await getImages() as {meta?: {images?: Record<string, unknown>}})?.meta?.images ?? {}; }
  catch { for (const hash of hashes) assets[hash] = { imageHash: hash, refused: 'rest-image-map-unavailable' }; return assets; }
  let total = 0, attempts = 0;
  for (const hash of hashes) {
    try {
      if (!/^[a-f0-9]{40}$/.test(hash)) throw Error('rest-image-ref-invalid');
      if (++attempts > 64 || total >= TOTAL) throw Error('native-image-byte-budget-unqualified');
      const raw = images[hash];
      if (typeof raw !== 'string') throw Error('rest-image-ref-unavailable');
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !['figma.com', 'amazonaws.com'].some(host => url.hostname === host || url.hostname.endsWith('.' + host)))
        throw Error('rest-image-origin-unqualified');
      const response = await download(raw);
      if (!response.ok) throw Error('rest-image-download-failed');
      const chunks: Uint8Array[] = []; let length = 0;
      if (response.body) {
        const reader = response.body.getReader();
        try { while (true) { const item = await reader.read(); if (item.done) break;
          length += item.value.byteLength;
          if (length > EACH || total + length > TOTAL) { await reader.cancel(); throw Error('native-image-byte-budget-unqualified'); }
          chunks.push(item.value);
        }} finally { reader.releaseLock(); }
      } else if (response.arrayBuffer) {
        const bytes = new Uint8Array(await response.arrayBuffer()); length = bytes.length; chunks.push(bytes);
      } else throw Error('rest-image-byte-transport-unavailable');
      if (!length || length > EACH || total + length > TOTAL) throw Error('native-image-byte-budget-unqualified');
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      total += length;
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (digest !== hash) throw Error('rest-image-hash-mismatch');
      const starts = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
      const mimeType = starts([137,80,78,71,13,10,26,10]) ? 'image/png' : starts([255,216,255]) ? 'image/jpeg'
        : starts([71,73,70,56]) ? 'image/gif' : starts([82,73,70,70]) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80 ? 'image/webp' : undefined;
      if (!mimeType) throw Error('native-image-format-unqualified');
      let binary = ''; for (let start = 0; start < bytes.length; start += 16384) binary += String.fromCharCode(...bytes.subarray(start, start + 16384));
      assets[hash] = { imageHash: hash, mimeType, byteLength: length, base64: btoa(binary) };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      assets[hash] = { imageHash: hash, refused: /^(?:rest-image|native-image)-[a-z-]+$/.test(message) ? message : 'rest-image-capture-failed' };
    }
  }
  return assets;
}
