/**
 * Unfrozen v18 writer source. Live stacks through v75 still pin the hashed
 * v17 program `05a06546…c2e2` and payload `f5e1294a…7ce9`, which themselves
 * wrap frozen v16 `a01d95b3…d6b3` / `b091cf61…0597`. Those files stay frozen.
 * This module copies the v17 HUG payload and adds one program teaching: bind
 * TEXT component properties by first-segment / sceneRole (split ` :: ` before
 * testing `=`), the same class as V74 probe `role()`. Hashed v16/v17 still
 * bind with stale `name.includes("=")` on the full name, so every
 * `font-provenance=` TEXT matches 0. Do not patch hashed v16 or v17 bytes.
 */
import { createWriterTransportArtifact } from "./writer-transport.js";
import {
  buildInputLiveV17WriterPayload,
  INPUT_LIVE_V17_SET_HUG_ASSIGNMENT,
  V16_WRITER_PAYLOAD_SHA256,
  V16_WRITER_PROGRAM_SHA256,
} from "./input-field-figma-writer-v17.js";

export { V16_WRITER_PAYLOAD_SHA256, V16_WRITER_PROGRAM_SHA256 };

export const INPUT_FIELD_FIGMA_V18_WRITER_VERSION = 18;
export const V17_WRITER_PROGRAM_SHA256 =
  "05a0654618f46df22152870410362bbd44339f767139013ff219bb717488c2e2";
export const V17_WRITER_PAYLOAD_SHA256 =
  "f5e1294a09074cf4dfe7509e4a27531a288d8ffb93828664b2b9e92fe7137ce9";
export const V17_WRITER_SOURCE_SHA256 =
  "449661f6758715a77c7e84aadc8a480220ae880c65d812d866110a657a40a637";

export const INPUT_LIVE_V18_STALE_FULL_NAME_BIND =
  'const role=(descendant.name.includes("/")&&!descendant.name.includes("=")?descendant.name.split(" :: ",1)[0]:"");';
export const INPUT_LIVE_V18_FIRST_SEGMENT_BIND =
  'const role=(()=>{const head=descendant.name.split(" :: ",1)[0]??"";return head.includes("/")&&!head.includes("=")?head:"";})();';

export function buildInputLiveV18WriterPayload(v16Payload: string): string {
  const v17 = v16Payload.includes(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT)
    ? v16Payload
    : buildInputLiveV17WriterPayload(v16Payload);
  const occurrences = v17.split(INPUT_LIVE_V18_STALE_FULL_NAME_BIND).length - 1;
  if (occurrences !== 1) {
    throw new TypeError(
      `Input live v18 writer payload missing unique stale full-name bind (${occurrences})`,
    );
  }
  if (v17.includes(INPUT_LIVE_V18_FIRST_SEGMENT_BIND)) {
    throw new TypeError(
      "Input live v18 writer payload already binds by first-segment role",
    );
  }
  return v17.replace(
    INPUT_LIVE_V18_STALE_FULL_NAME_BIND,
    INPUT_LIVE_V18_FIRST_SEGMENT_BIND,
  );
}

export function buildInputLiveV18WriterProgram(v16Payload: string): {
  payload: Buffer;
  program: Buffer;
} {
  const payload = Buffer.from(buildInputLiveV18WriterPayload(v16Payload));
  const program = Buffer.from(createWriterTransportArtifact(payload).wrapper);
  return { payload, program };
}
