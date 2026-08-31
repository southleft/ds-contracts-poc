import { createHash } from "node:crypto";

import type { Integrity, RecipeEnvelope } from "./envelope.js";
import { canonicalJson, canonicalJsonBytes } from "./normalize.js";

/**
 * Hash and normalization domain. A future canonicalization contract must use
 * a new domain, even if it continues to use SHA-256.
 */
export const RECIPE_HASH_DOMAIN = "ds-contracts/recipe-envelope-json/v1";
export const RECIPE_HASH_ALGORITHM = "sha256" as const;

export type RecipeEnvelopeHashInput =
  RecipeEnvelope | Omit<RecipeEnvelope, "integrity">;

const assertDomain = (domain: string): void => {
  if (domain.length === 0 || domain.includes("\0")) {
    throw new TypeError("hash domain must be non-empty and contain no NUL");
  }
};

/**
 * SHA-256(domain || NUL || canonical-json-utf8).
 *
 * The NUL is unambiguous because domains containing NUL are refused.
 */
export function hashCanonicalJson(value: unknown, domain: string): string {
  assertDomain(domain);
  const domainBytes = new TextEncoder().encode(`${domain}\0`);
  return createHash(RECIPE_HASH_ALGORITHM)
    .update(domainBytes)
    .update(canonicalJsonBytes(value))
    .digest("hex");
}

function withoutIntegrity(
  envelope: RecipeEnvelopeHashInput,
): Record<PropertyKey, unknown> {
  const unsigned: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(envelope)) {
    if (key === "integrity") continue;
    const descriptor = Object.getOwnPropertyDescriptor(envelope, key)!;
    Object.defineProperty(unsigned, key, descriptor);
  }
  return unsigned;
}

/** The canonical JSON payload covered by a recipe envelope's integrity field. */
export function canonicalRecipeEnvelopeJson(
  envelope: RecipeEnvelopeHashInput,
): string {
  return canonicalJson(withoutIntegrity(envelope));
}

/**
 * Hash a recipe envelope with `integrity` omitted. An authored or stale
 * integrity value therefore cannot influence its replacement.
 */
export function hashRecipeEnvelope(envelope: RecipeEnvelopeHashInput): string {
  return hashCanonicalJson(withoutIntegrity(envelope), RECIPE_HASH_DOMAIN);
}

/** Derive the only integrity record accepted by the v1 recipe hash contract. */
export function deriveRecipeIntegrity(
  envelope: RecipeEnvelopeHashInput,
): Integrity {
  return {
    algorithm: RECIPE_HASH_ALGORITHM,
    domain: RECIPE_HASH_DOMAIN,
    canonicalHash: hashRecipeEnvelope(envelope),
  };
}
