/** RGBA pixels as a PNG data URL. The proposer also runs inside the Figma
 *  plugin bundle, which has no Node modules, so this encoder uses stored
 *  (uncompressed) deflate blocks and its own checksums and base64. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1, b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: Uint8Array): number[] {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

function storedZlib(raw: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01];
  for (let offset = 0; offset < raw.length || offset === 0; offset += 65535) {
    const length = Math.min(65535, raw.length - offset);
    const final = offset + length >= raw.length ? 1 : 0;
    out.push(final, length & 0xff, length >>> 8, ~length & 0xff, (~length >>> 8) & 0xff);
    for (let i = 0; i < length; i++) out.push(raw[offset + i]!);
    if (final) break;
  }
  out.push(...u32(adler32(raw)));
  return Uint8Array.from(out);
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64[(n >>> 18) & 63]! + BASE64[(n >>> 12) & 63]! +
      (b === undefined ? '=' : BASE64[(n >>> 6) & 63]!) + (c === undefined ? '=' : BASE64[n & 63]!);
  }
  return out;
}

export function rgbaPngDataUrl(width: number, height: number, rgba: Uint8Array): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4)
    throw Error(`png-data-url-invalid-raster:${width}x${height}:${rgba.length}`);
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const header = Uint8Array.from([...u32(width), ...u32(height), 8, 6, 0, 0, 0]);
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', header), ...chunk('IDAT', storedZlib(raw)), ...chunk('IEND', new Uint8Array()),
  ]);
  return `url("data:image/png;base64,${base64(png)}")`;
}
