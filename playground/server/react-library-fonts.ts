/** Browser font inputs contain bytes and face metadata, never local paths or URLs. */
import { consumerFontsFromBytes, type ConsumerFont } from '../../scripts/design-consumer-fonts.js';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).sort().join(',') === names.sort().join(',');
function refuse(reason: string): never { throw Error('react-library-fonts-' + reason); }
function bytes(value: unknown, max: number): Buffer {
  if (typeof value !== 'string' || !value.length || value.length % 4 !== 0 || value.length > Math.ceil(max / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) refuse('invalid-bytes');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length > max || decoded.toString('base64') !== value) refuse('invalid-bytes');
  return decoded;
}
export function parseLibraryFonts(value: unknown): ConsumerFont[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.length || value.length > 32) refuse('invalid-faces');
  return consumerFontsFromBytes(value.map(face => {
    if (!record(face) || !keys(face, ['family', 'weight', 'style', 'dataBase64', ...(Object.hasOwn(face, 'license') ? ['license'] : [])])) refuse('invalid-face');
    let licenseBytes: Buffer | undefined;
    if (face.license !== undefined) {
      if (!record(face.license) || !keys(face.license, ['dataBase64'])) refuse('invalid-license');
      licenseBytes = bytes(face.license.dataBase64, 256 * 1024);
    }
    return { family: face.family as string, weight: face.weight as string, style: face.style as 'normal' | 'italic',
      bytes: bytes(face.dataBase64, 16 * 1024 * 1024), ...(licenseBytes ? { licenseBytes } : {}) };
  }));
}
