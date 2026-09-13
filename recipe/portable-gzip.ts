import { gzipSync } from "node:zlib";

/**
 * Node writes the host operating-system code into byte 9 of every gzip header
 * (19 on macOS, 3 on Linux). That metadata does not describe the payload, but
 * it makes otherwise identical proof artifacts fail byte-for-byte CI checks.
 * RFC 1952 reserves 255 for an unknown OS, which makes the envelope portable.
 *
 * Use this for NEW proof lineages. The four existing signed lineages (combobox
 * v42, table v38, calendar v50, input-field v85) hash their envelopes AND their
 * own builder source into an owner-signed antecedent hash set, so they cannot
 * adopt it; their CI steps re-derive the envelopes as the recording host would
 * via scripts/gzip-os-byte-shim.mjs instead.
 */
export function portableGzipSync(
  input: Parameters<typeof gzipSync>[0],
  options?: Parameters<typeof gzipSync>[1],
): Buffer {
  return portableGzipEnvelope(gzipSync(input, options));
}

/** Normalize an existing gzip envelope without mutating the source buffer. */
export function portableGzipEnvelope(input: Uint8Array): Buffer {
  const compressed = Buffer.from(input);
  if (compressed.length < 10 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
    throw new Error("portable gzip: zlib returned an invalid gzip envelope");
  }
  compressed[9] = 0xff;
  return compressed;
}
