/**
 * Unfrozen v19 writer source. Live stacks through v78 still pin the hashed
 * v18 program `9653ecd2…81ac` and payload `07a5124f…12de`, which wrap frozen
 * v17 `05a06546…c2e2` / `f5e1294a…7ce9` and v16 `a01d95b3…d6b3` /
 * `b091cf61…0597`. Those files stay frozen.
 *
 * Compile names content-row `[placeholder FILL, trailing]` and `visible:false`
 * on the 24 floating+placeholder+not-focus-visible+(none|trailing) texts.
 * Figma auto-layout drops `visible:false` siblings, so named FILL occupancy
 * is silently lost and trailing packs to content-row start. Recipe CSS already
 * hides the same variants with `::placeholder { opacity: 0 }` while the input
 * stays in flow (`recipe/output/input-field.ts`). Restore/extract already set
 * `visible=true` to keep the node in auto-layout for FILL measure. This module
 * copies the v18 first-segment-bind payload and adds one program teaching:
 * hidden FILL content keeps `visible` true and `opacity` 0 so the main axis
 * still occupies and "Enter an amount" is not painted. Do not add a spacer,
 * pixel width, or `primaryAxisAlign: MAX`. Do not patch hashed v16/v17/v18.
 */
import { createWriterTransportArtifact } from "./writer-transport.js";
import {
  buildInputLiveV18WriterPayload,
  INPUT_LIVE_V18_FIRST_SEGMENT_BIND,
  V16_WRITER_PAYLOAD_SHA256,
  V16_WRITER_PROGRAM_SHA256,
  V17_WRITER_PAYLOAD_SHA256,
  V17_WRITER_PROGRAM_SHA256,
  V17_WRITER_SOURCE_SHA256,
} from "./input-field-figma-writer-v18.js";

export {
  V16_WRITER_PAYLOAD_SHA256,
  V16_WRITER_PROGRAM_SHA256,
  V17_WRITER_PAYLOAD_SHA256,
  V17_WRITER_PROGRAM_SHA256,
  V17_WRITER_SOURCE_SHA256,
};

export const INPUT_FIELD_FIGMA_V19_WRITER_VERSION = 19;
export const V18_WRITER_PROGRAM_SHA256 =
  "9653ecd2e5992a76b1e6f2d77ded4f35c1f31bcc5c9c3818c691600ba73181ac";
export const V18_WRITER_PAYLOAD_SHA256 =
  "07a5124f3b38053b5e39ecc2b79640d1e5097a54e7b52de6d5cce1322e1f12de";
export const V18_WRITER_SOURCE_SHA256 =
  "e8537cb46c58c45a3e0359710b220b6c17e6e4735b125d2a24db7fcf37990800";
export const V19_WRITER_PROGRAM_SHA256 =
  "0ed357dbe2acb272d1348d90cf689510f7b967e82f6c0cf834ad1a315ed759e0";
export const V19_WRITER_PAYLOAD_SHA256 =
  "5d0f232375dbe83cb865bf27abb5321d871e0a16ddf1d8ee7628d14be6261681";

export const INPUT_LIVE_V19_STALE_VISIBLE_OPACITY =
  "node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;";
export const INPUT_LIVE_V19_HIDDEN_FILL_OCCUPANCY =
  'const hiddenFillContent=(ir.role==="input-field/content/placeholder"||ir.role==="input-field/content/value")&&ir.width&&ir.width.mode==="fill"&&ir.visible===false;void "INPUT-WRITER-HIDDEN-FILL-OCCUPANCY";node.visible=hiddenFillContent||ir.visible!==false;node.opacity=hiddenFillContent?0:(ir.opacity===undefined?1:ir.opacity);';

export function buildInputLiveV19WriterPayload(v16Payload: string): string {
  const v18 = v16Payload.includes(INPUT_LIVE_V18_FIRST_SEGMENT_BIND)
    ? v16Payload
    : buildInputLiveV18WriterPayload(v16Payload);
  const occurrences =
    v18.split(INPUT_LIVE_V19_STALE_VISIBLE_OPACITY).length - 1;
  if (occurrences !== 1) {
    throw new TypeError(
      `Input live v19 writer payload missing unique visible/opacity assign (${occurrences})`,
    );
  }
  if (v18.includes(INPUT_LIVE_V19_HIDDEN_FILL_OCCUPANCY)) {
    throw new TypeError(
      "Input live v19 writer payload already preserves hidden FILL occupancy",
    );
  }
  return v18.replace(
    INPUT_LIVE_V19_STALE_VISIBLE_OPACITY,
    INPUT_LIVE_V19_HIDDEN_FILL_OCCUPANCY,
  );
}

export function buildInputLiveV19WriterProgram(v16Payload: string): {
  payload: Buffer;
  program: Buffer;
} {
  const payload = Buffer.from(buildInputLiveV19WriterPayload(v16Payload));
  const program = Buffer.from(createWriterTransportArtifact(payload).wrapper);
  return { payload, program };
}
