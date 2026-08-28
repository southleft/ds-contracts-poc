/**
 * Unfrozen v17 writer source. Live stacks through v65 still pin the hashed
 * v16 program `a01d95b3…d6b3` and payload `b091cf61…0597`. Those files stay
 * frozen. This module copies that v16 payload source and adds one program
 * teaching after `combineAsVariants`: `set.layoutSizingHorizontal = "HUG"`.
 * Payload IR already emits set `{mode:hug}`; the v16 program never assigned
 * `layoutSizingHorizontal`, so Figma defaulted the set to FIXED. The HUG
 * write is last on the set-setup statement so it wins over the inherited
 * `primaryAxisSizingMode="FIXED"` without adding a pixel width or FIXED
 * teaching. Do not patch hashed v16 bytes in place.
 */
import { createWriterTransportArtifact } from "./writer-transport.js";

export const V16_WRITER_PROGRAM_SHA256 =
  "a01d95b3b2a46999d4228814101d5e8b19ef35bb0f0b9113b1d9d438e150d6b3";
export const V16_WRITER_PAYLOAD_SHA256 =
  "b091cf61288e21aea4031e7717957e5329f2fb1ec164757b08f1f0d9ea830597";

export const INPUT_FIELD_FIGMA_V17_WRITER_VERSION = 17;
export const INPUT_LIVE_V17_SET_HUG_ANCHOR =
  'set.clipsContent=false;\n  set.description="recipe-role:input-field/set";';
export const INPUT_LIVE_V17_SET_HUG_ASSIGNMENT =
  'set.layoutSizingHorizontal="HUG";';
export const INPUT_LIVE_V17_SET_HUG_MARKER = "layoutSizingHorizontal=\"HUG\"";

export function buildInputLiveV17WriterPayload(v16Payload: string): string {
  if (v16Payload.includes(INPUT_LIVE_V17_SET_HUG_ASSIGNMENT)) {
    throw new TypeError(
      "Input live v17 writer payload already assigns set layoutSizingHorizontal HUG",
    );
  }
  const occurrences = v16Payload.split(INPUT_LIVE_V17_SET_HUG_ANCHOR).length - 1;
  if (occurrences !== 1) {
    throw new TypeError(
      `Input live v17 writer payload missing unique set HUG anchor (${occurrences})`,
    );
  }
  if (!v16Payload.includes("combineAsVariants")) {
    throw new TypeError("Input live v17 writer payload missing combineAsVariants");
  }
  if (!v16Payload.includes('set.layoutMode="HORIZONTAL"')) {
    throw new TypeError(
      "Input live v17 writer payload missing set.layoutMode HORIZONTAL",
    );
  }
  return v16Payload.replace(
    INPUT_LIVE_V17_SET_HUG_ANCHOR,
    `set.clipsContent=false;${INPUT_LIVE_V17_SET_HUG_ASSIGNMENT}\n  set.description="recipe-role:input-field/set";`,
  );
}

export function buildInputLiveV17WriterProgram(v16Payload: string): {
  payload: Buffer;
  program: Buffer;
} {
  const payload = Buffer.from(buildInputLiveV17WriterPayload(v16Payload));
  const program = Buffer.from(createWriterTransportArtifact(payload).wrapper);
  return { payload, program };
}
