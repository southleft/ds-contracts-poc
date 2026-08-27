/**
 * THE CANONICAL ENVELOPE — the reviewed artifact of the recipe pivot.
 *
 * EXPERIMENTAL. Phase 0 of docs/32-recipe-ir-pivot.md. Types and schema only;
 * the legacy contract schema (@ds-contracts/schema) is untouched and remains
 * the thing the shipped engine reads.
 *
 * An envelope pairs a drawable tree (figma-ir.ts) with a FULL ACCOUNT of what
 * happened to every input fact. The account is the point. Today the pipeline
 * reports dropped facts on the surfaces a person reads (`code-only-facts:check`)
 * — a reporting discipline layered over a pipeline that is free to drop
 * silently. Here it is an INVARIANT OF THE ARTIFACT: an envelope whose account
 * does not cover an input fact is invalid, and `checkTotality` is what says so
 * by name.
 *
 * Every input fact ends in exactly one of three places:
 *
 *   · `accounting.carried`  — the IR draws it.
 *   · `extensions`          — it is code-only BY DECISION, and says why.
 *   · `receipts`            — it is not carried, and says why not.
 *
 * There is no fourth outcome and no default. That is the difference between
 * "we report our losses" and "we cannot ship an unreported loss".
 */
import * as z from "zod";
import { DECLARABLE_ARCHETYPES } from "@ds-contracts/schema";
import { IRNodeSchema } from "./figma-ir.js";
import { RECIPE_HASH_ALGORITHM, RECIPE_HASH_DOMAIN } from "./hash.js";

// ---------------------------------------------------------------------------
// Fact references — the unit the account is kept in
// ---------------------------------------------------------------------------

/**
 * One input fact, addressed. `path` is the structural path it arrived on
 * (`root/1/0`), `channel` is its name in the source vocabulary — a CSS
 * property, a declared layout field, a token binding. Input facts are the ONLY
 * place a CSS channel name is allowed to appear in an envelope; the IR half is
 * closed against them.
 */
export const FactRefSchema = z.strictObject({
  path: z.string().min(1),
  channel: z.string().min(1),
});
export type FactRef = z.infer<typeof FactRefSchema>;

/** The identity two accounts are compared on. */
export const factId = (fact: FactRef): string => `${fact.path}#${fact.channel}`;

// ---------------------------------------------------------------------------
// Loss receipts
// ---------------------------------------------------------------------------

/**
 * A CLOSED enum, and closed is the feature. A sixth kind of loss requires
 * editing this line, which requires a review — which is exactly the gate that
 * "and everything else falls through to a generic drop" removes.
 *
 *   · `no-figma-primitive` — the canvas has nothing to draw it with.
 *   · `code-only`          — it belongs to code by decision; see `extensions`.
 *   · `lowered`            — carried in a different shape; `evidence` names the
 *                            spec/lowering.json rule, and the value recorded is
 *                            what was NOT preserved by the lowering.
 *   · `refused-by-recipe`  — the recipe declined it as wrong for the archetype.
 *   · `inert`              — provably no independent visual effect. The only
 *                            value that asserts an absence of consequence, so
 *                            it may cite ONLY an INERT row of
 *                            spec/channel-table.json.
 */
export const LOSS_REASONS = [
  "no-figma-primitive",
  "code-only",
  "lowered",
  "refused-by-recipe",
  "inert",
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const LossReceiptSchema = z.strictObject({
  fact: FactRefSchema,
  /** The value that was not carried, as it arrived. Never elided to a count. */
  value: z.string(),
  reason: z.enum(LOSS_REASONS),
  /**
   * The row, door, or rule that justifies the reason — a real reference a
   * reader can open. `recipe:receipts:check` (docs/32 §10) resolves these, so
   * an unresolvable citation is a red, not prose.
   */
  evidence: z.string().min(1),
});
export type LossReceipt = z.infer<typeof LossReceiptSchema>;

// ---------------------------------------------------------------------------
// Code-only extensions
// ---------------------------------------------------------------------------

export const EXTENSION_KINDS = [
  "behaviour",
  "a11y",
  "keyboard",
  "virtualization",
  "motion",
  "data",
] as const;
export type ExtensionKind = (typeof EXTENSION_KINDS)[number];

/**
 * A fact that lives in code BY DESIGN rather than by failure. A combobox's
 * `aria-activedescendant` is not a canvas loss to apologise for; it is a real
 * part of the component that the canvas is the wrong medium for. Declaring it
 * keeps it out of the receipt census without letting it vanish.
 */
export const CodeOnlyExtensionSchema = z.strictObject({
  /** `<archetype-slug>/<name>` — the stable name a reader cites. */
  id: z.string().min(1),
  kind: z.enum(EXTENSION_KINDS),
  /** What it does, in one line. */
  stated: z.string().min(1),
  /** Why the canvas is the wrong medium for it. */
  why: z.string().min(1),
  /** The input facts this extension absorbs. May be empty for pure behaviour. */
  absorbs: z.array(FactRefSchema),
});
export type CodeOnlyExtension = z.infer<typeof CodeOnlyExtensionSchema>;

// ---------------------------------------------------------------------------
// The envelope
// ---------------------------------------------------------------------------

/** Derived, never authored — see `integrity` below. */
export const IntegritySchema = z.strictObject({
  algorithm: z.literal(RECIPE_HASH_ALGORITHM),
  /** Versioned domain included in the hashed bytes, not descriptive metadata. */
  domain: z.literal(RECIPE_HASH_DOMAIN),
  canonicalHash: z.string().regex(/^[0-9a-f]{64}$/, "hash must be 64 hex"),
});
export type Integrity = z.infer<typeof IntegritySchema>;

export const ENVELOPE_VERSION = 1;

/**
 * A LITERAL, not a range. A reader that does not know a version refuses rather
 * than best-efforting its way through a document it does not understand.
 */
export const RecipeEnvelopeSchema = z.strictObject({
  envelope: z.literal(ENVELOPE_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  archetype: z.enum(DECLARABLE_ARCHETYPES),
  recipe: z.strictObject({
    id: z.string().min(1),
    version: z.number().int().positive(),
  }),
  ir: IRNodeSchema,
  accounting: z.strictObject({
    /** Input facts the IR draws. The third leg of the totality rule. */
    carried: z.array(FactRefSchema),
  }),
  extensions: z.array(CodeOnlyExtensionSchema),
  receipts: z.array(LossReceiptSchema),
  provenance: z.strictObject({
    source: z.string().min(1),
    tool: z.string().min(1),
    generatedAt: z.string().min(1),
    selection: z
      .strictObject({
        candidates: z
          .array(
            z.strictObject({
              id: z.string().min(1),
              version: z.number().int().positive(),
            }),
          )
          .min(1),
        selectedBy: z.string().min(1),
        mechanism: z.enum(["human-review", "reviewed-config"]),
        source: z.string().min(1),
        reviewedAt: z.string().min(1),
        manualCost: z.strictObject({
          value: z.number().int().positive(),
          unit: z.literal("reviewed-mapping"),
          note: z.string().min(1),
        }),
      })
      .optional(),
  }),
  /**
   * Computed over the canonical envelope with `integrity` REMOVED, so the hash
   * can never be part of what it hashes. recipe/hash.ts owns the derivation.
   */
  integrity: IntegritySchema,
});
export type RecipeEnvelope = z.infer<typeof RecipeEnvelopeSchema>;

// ---------------------------------------------------------------------------
// The totality rule
// ---------------------------------------------------------------------------

export interface TotalityResult {
  /** Input facts in none of the three places. Non-empty ⇒ the envelope lies. */
  unaccounted: FactRef[];
  /** Input facts in more than one place — two answers is no answer. */
  doubleCounted: Array<{ fact: FactRef; places: string[] }>;
  /** Accounted facts the input never contained — an invented account. */
  invented: FactRef[];
}

/**
 * THE REFEREE. Pure: an input fact set and an envelope in, findings out. No fs,
 * no hashing, no Figma.
 *
 * `invented` is here because the failure this rule is written against runs both
 * ways. An envelope that under-reports is a silent loss; an envelope that
 * reports a receipt for a fact the input never carried is a fabricated
 * disclosure, and a census built on those would be worse than no census. Both
 * are named.
 */
export function checkTotality(
  inputFacts: readonly FactRef[],
  envelope: Pick<RecipeEnvelope, "accounting" | "extensions" | "receipts">,
): TotalityResult {
  const places = new Map<string, { fact: FactRef; places: string[] }>();
  const note = (fact: FactRef, place: string) => {
    const key = factId(fact);
    const seen = places.get(key);
    if (seen) seen.places.push(place);
    else places.set(key, { fact, places: [place] });
  };

  for (const fact of envelope.accounting.carried) note(fact, "carried");
  for (const extension of envelope.extensions)
    for (const fact of extension.absorbs)
      note(fact, `extension:${extension.id}`);
  for (const receipt of envelope.receipts)
    note(receipt.fact, `receipt:${receipt.reason}`);

  const input = new Map<string, FactRef[]>();
  for (const fact of inputFacts) {
    const key = factId(fact);
    input.set(key, [...(input.get(key) ?? []), fact]);
  }

  const unaccounted: FactRef[] = [];
  for (const [key, facts] of input) {
    const accounted = places.get(key)?.places.length ?? 0;
    unaccounted.push(...facts.slice(accounted));
  }

  const doubleCounted = [...places.entries()]
    .filter(([key, entry]) => {
      const expectedOccurrences = input.get(key)?.length ?? 0;
      return (
        expectedOccurrences > 0 && entry.places.length > expectedOccurrences
      );
    })
    .map(([, entry]) => entry);

  const invented: FactRef[] = [];
  for (const [key, entry] of places) {
    const expectedOccurrences = input.get(key)?.length ?? 0;
    const excess = entry.places.length - expectedOccurrences;
    for (let index = 0; index < excess; index += 1) {
      invented.push(entry.fact);
    }
  }

  return { unaccounted, doubleCounted, invented };
}

/** `<id>: <violation>` — the house deep-referee grammar. */
export function totalityLines(
  envelopeId: string,
  result: TotalityResult,
): string[] {
  const lines: string[] = [];
  for (const fact of result.unaccounted) {
    lines.push(
      `${envelopeId}: input fact ${factId(fact)} is neither carried, nor absorbed by a ` +
        `code-only extension, nor receipted — a silent loss the envelope may not ship with`,
    );
  }
  for (const { fact, places } of result.doubleCounted) {
    lines.push(
      `${envelopeId}: input fact ${factId(fact)} is accounted for in ${places.length} places ` +
        `(${places.join(", ")}) — two answers is no answer`,
    );
  }
  for (const fact of result.invented) {
    lines.push(
      `${envelopeId}: the account names ${factId(fact)}, which the input never carried — ` +
        `a fabricated disclosure`,
    );
  }
  return lines;
}

export const isTotal = (result: TotalityResult): boolean =>
  result.unaccounted.length === 0 &&
  result.doubleCounted.length === 0 &&
  result.invented.length === 0;
