// Preload for byte-frozen proof builders.
//
// Node's zlib writes the HOST operating-system code into byte 9 of every gzip
// header (19 on macOS, 3 on Linux). The four signed lineages (combobox v42,
// table v38, calendar v50, input-field v85) hash their compressed envelopes
// AND their own builder source into an owner-signed antecedent hash set, so
// neither the envelopes nor the builders can change to become portable. Their
// `--check` re-derives the envelopes and byte-compares them, which passes on
// the OS that recorded them and fails on any other.
//
// This preload makes the checking machine stamp the byte the recording
// machine stamped, and nothing else: it wraps zlib.gzipSync and rewrites
// header byte 9 to GZIP_OS_BYTE. Usage (CI, per step):
//   NODE_OPTIONS="--import ./scripts/gzip-os-byte-shim.mjs" GZIP_OS_BYTE=19 npm run <check>
// It refuses to load without an explicit GZIP_OS_BYTE so it can never be on by accident.
import { syncBuiltinESMExports } from "node:module";
import zlib from "node:zlib";

const raw = process.env.GZIP_OS_BYTE;
if (raw === undefined || raw === "") {
  throw new Error("gzip-os-byte-shim: GZIP_OS_BYTE must be set explicitly (e.g. 19 for macOS, 3 for Linux)");
}
const osByte = Number(raw);
if (!Number.isInteger(osByte) || osByte < 0 || osByte > 255) {
  throw new Error(`gzip-os-byte-shim: GZIP_OS_BYTE must be an integer 0..255, got ${JSON.stringify(raw)}`);
}

const originalGzipSync = zlib.gzipSync;
function gzipSyncStamped(input, options) {
  const out = originalGzipSync(input, options);
  if (out.length >= 10 && out[0] === 0x1f && out[1] === 0x8b) out[9] = osByte;
  return out;
}
Object.defineProperty(zlib, "gzipSync", { value: gzipSyncStamped, writable: true, configurable: true });
// Named ESM imports (`import { gzipSync } from "node:zlib"`) are live bindings that only
// follow a patch after this call.
syncBuiltinESMExports();
if (process.env.GZIP_OS_BYTE_SHIM_VERBOSE) {
  process.stderr.write(`gzip-os-byte-shim: zlib.gzipSync stamps header OS byte ${osByte}\n`);
}
