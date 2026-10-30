import assert from 'node:assert/strict';
import test from 'node:test';
import { PNG } from 'pngjs';
import { rgbaPngDataUrl } from './png-data-url.js';

const decode = (url: string) => PNG.sync.read(Buffer.from(url.slice('url("data:image/png;base64,'.length, -2), 'base64'));

test('encoded pixels decode to the same RGBA raster', () => {
  const width = 37, height = 5, pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 31 + 7) & 0xff;
  const png = decode(rgbaPngDataUrl(width, height, pixels));
  assert.equal(png.width, width);
  assert.equal(png.height, height);
  assert.deepEqual(new Uint8Array(png.data), pixels);
});

test('a raster above one stored deflate block still decodes', () => {
  const width = 200, height = 100, pixels = new Uint8Array(width * height * 4).fill(200);
  assert.deepEqual(new Uint8Array(decode(rgbaPngDataUrl(width, height, pixels)).data), pixels);
});

test('a malformed raster refuses', () => {
  assert.throws(() => rgbaPngDataUrl(2, 2, new Uint8Array(3)), /png-data-url-invalid-raster/);
});
