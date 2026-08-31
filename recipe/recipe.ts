import * as z from "zod";

import type { RecipeEnvelope } from "./envelope.js";
import { hashCanonicalJson } from "./hash.js";

export const RECIPE_INSTANCE_HASH_DOMAIN =
  "ds-contracts/recipe-instance-json/v1";

export const RecipeRefSchema = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
export type RecipeRef = z.infer<typeof RecipeRefSchema>;

export const RecipeSelectionSchema = z.strictObject({
  candidates: z.array(RecipeRefSchema).min(1),
  selectedBy: z.string().min(1),
  mechanism: z.enum(["human-review", "reviewed-config"]),
  source: z.string().min(1),
  reviewedAt: z.string().min(1),
  manualCost: z.strictObject({
    value: z.number().int().positive(),
    unit: z.literal("reviewed-mapping"),
    note: z.string().min(1),
  }),
});
export type RecipeSelection = z.infer<typeof RecipeSelectionSchema>;

export class RecipeRefusal extends Error {
  constructor(
    readonly recipe: RecipeRef,
    readonly findings: readonly string[],
  ) {
    super(`${recipe.id}@${recipe.version}: ${findings.join("; ")}`);
    this.name = "RecipeRefusal";
  }
}

export function requireExactRecipeSelection(
  input: unknown,
  expected: RecipeRef,
): RecipeSelection {
  const parsed = RecipeSelectionSchema.safeParse(input);
  if (!parsed.success) {
    const absent =
      input === undefined ||
      input === null ||
      (typeof input === "object" &&
        !Array.isArray(input) &&
        !("candidates" in input));
    throw new RecipeRefusal(expected, [
      absent
        ? "recipe selection is absent; code→canvas requires a reviewed human/config adapter and never infers from component or library names"
        : `recipe selection provenance is malformed: ${parsed.error.issues[0]?.message ?? "invalid selection"}`,
    ]);
  }
  if (parsed.data.candidates.length !== 1) {
    throw new RecipeRefusal(expected, [
      `recipe selection is ambiguous: expected exactly one reviewed candidate, found ${parsed.data.candidates.length}`,
    ]);
  }
  const selected = parsed.data.candidates[0]!;
  if (selected.id !== expected.id || selected.version !== expected.version) {
    throw new RecipeRefusal(expected, [
      `reviewed selection chose ${selected.id}@${selected.version}; explicit ${expected.id}@${expected.version} selection is required`,
    ]);
  }
  return parsed.data;
}

/**
 * A recipe owns archetype semantics in both directions. Callers must select a
 * recipe by exact id and version before collapse; the registry never guesses
 * from component names or tree shape.
 */
export interface Recipe<Instance> {
  readonly ref: RecipeRef;
  normalize(input: unknown): Instance;
  compile(input: unknown): RecipeEnvelope;
  collapse(envelope: unknown, selection: unknown): Instance;
}

const recipeKey = ({ id, version }: RecipeRef): string => `${id}@${version}`;

export class RecipeRegistry {
  readonly #recipes = new Map<string, Recipe<unknown>>();

  constructor(recipes: readonly Recipe<unknown>[]) {
    for (const recipe of recipes) {
      const ref = RecipeRefSchema.parse(recipe.ref);
      const key = recipeKey(ref);
      if (this.#recipes.has(key)) {
        throw new TypeError(`duplicate recipe registration: ${key}`);
      }
      this.#recipes.set(key, recipe);
    }
  }

  select(ref: RecipeRef): Recipe<unknown> {
    const parsed = RecipeRefSchema.parse(ref);
    const selected = this.#recipes.get(recipeKey(parsed));
    if (!selected) {
      throw new RecipeRefusal(parsed, [
        "recipe is not registered; selection by component or library name is forbidden",
      ]);
    }
    return selected;
  }

  refs(): RecipeRef[] {
    return [...this.#recipes.values()]
      .map((recipe) => recipe.ref)
      .sort((left, right) => recipeKey(left).localeCompare(recipeKey(right)));
  }
}

export function hashRecipeInstance<Instance>(
  recipe: Recipe<Instance>,
  input: unknown,
): string {
  return hashCanonicalJson(
    {
      recipe: recipe.ref,
      instance: recipe.normalize(input),
    },
    RECIPE_INSTANCE_HASH_DOMAIN,
  );
}
