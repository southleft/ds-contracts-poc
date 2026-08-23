/**
 * Contract provenance v1 — deterministic identity plus the smallest
 * stale-source guard needed to prevent a design-led contract from being
 * silently replaced by an unchanged code extraction.
 *
 * Browser-safe by design: this module is exported by core/index.ts and used
 * inside the Figma plugin, so it has no node:* imports.
 */

export interface ContractSourceProvenance {
  kind: "code" | "design";
  adapter: string;
  revision: string;
}

export interface AwaitingCodeAdoption {
  designRevision: string;
  sourceRevision: string;
}

export interface ContractProvenance {
  version: 1;
  canonicalRevision: string;
  source: ContractSourceProvenance;
  awaitingCodeAdoption?: AwaitingCodeAdoption;
}

export type ProvenancedContract = Record<string, unknown> & {
  provenance?: ContractProvenance;
};

const REVISION_RE = /^sha256:[0-9a-f]{64}$/;

/** RFC-8785-shaped JSON for the JSON values contracts/extractions contain. */
export function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (Array.isArray(value))
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`;
  }
  return "null";
}

// Compact synchronous SHA-256. Revisions must be available in browser/plugin
// planning code, where SubtleCrypto is async and not consistently available.
function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => {
      h[i] = (h[i] + v) >>> 0;
    });
  }
  return h.map((n) => n.toString(16).padStart(8, "0")).join("");
}

export const revisionOf = (value: unknown): string =>
  `sha256:${sha256(canonicalJson(value))}`;

export function canonicalRevisionOf(contract: ProvenancedContract): string {
  const { provenance: _ignored, ...canonical } = contract;
  return revisionOf(canonical);
}

export function assertContractProvenance(
  contract: ProvenancedContract,
  label = String(contract.id ?? "contract"),
): void {
  const p = contract.provenance;
  if (p === undefined) return;
  const refuse = (field: string, detail: string): never => {
    throw new Error(`${label}: provenance.${field} ${detail}`);
  };
  if (!p || typeof p !== "object") refuse("(root)", "must be an object");
  if (p.version !== 1) refuse("version", "must equal 1");
  if (!REVISION_RE.test(p.canonicalRevision))
    refuse("canonicalRevision", "must be a sha256 revision");
  if (!p.source || typeof p.source !== "object")
    refuse("source", "must be an object");
  if (p.source.kind !== "code" && p.source.kind !== "design")
    refuse("source.kind", 'must be "code" or "design"');
  if (!p.source.adapter)
    refuse("source.adapter", "must name the extraction adapter");
  if (!REVISION_RE.test(p.source.revision))
    refuse("source.revision", "must be a sha256 revision");
  if (p.canonicalRevision !== canonicalRevisionOf(contract)) {
    refuse(
      "canonicalRevision",
      "does not match the contract contents (excluding provenance)",
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(p, "awaitingCodeAdoption") &&
    p.awaitingCodeAdoption !== undefined
  ) {
    const a = p.awaitingCodeAdoption;
    if (!a || typeof a !== "object") {
      refuse("awaitingCodeAdoption", "must be an object");
    }
    if (p.source.kind !== "code") {
      refuse(
        "source.kind",
        'must equal "code" while awaitingCodeAdoption is present',
      );
    }
    if (!REVISION_RE.test(a.designRevision))
      refuse(
        "awaitingCodeAdoption.designRevision",
        "must be a sha256 revision",
      );
    if (!REVISION_RE.test(a.sourceRevision))
      refuse(
        "awaitingCodeAdoption.sourceRevision",
        "must be a sha256 revision",
      );
    if (a.designRevision !== p.canonicalRevision) {
      refuse(
        "awaitingCodeAdoption.designRevision",
        "must equal canonicalRevision",
      );
    }
    if (a.sourceRevision !== p.source.revision) {
      refuse(
        "awaitingCodeAdoption.sourceRevision",
        "must equal source.revision",
      );
    }
  }
}

/** Stamp an accepted design proposal using the base's last code source. */
export function markAwaitingCodeAdoption(
  base: ProvenancedContract,
  proposed: ProvenancedContract,
): ProvenancedContract {
  assertContractProvenance(base, String(base.id ?? "base contract"));
  if (!base.provenance) {
    throw new Error(
      `${String(base.id ?? "contract")}: design promotion REFUSED — the canonical contract has no provenance; run a matching code extraction once to bootstrap it before accepting a design-led change.`,
    );
  }
  const out = structuredClone(proposed);
  delete out.provenance;
  const canonicalRevision = canonicalRevisionOf(out);
  out.provenance = {
    version: 1,
    canonicalRevision,
    source: { ...base.provenance.source },
    awaitingCodeAdoption: {
      designRevision: canonicalRevision,
      sourceRevision: base.provenance.source.revision,
    },
  };
  return out;
}
