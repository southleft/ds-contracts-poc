/**
 * ARCHETYPE — the docs/23 §C.1.1 component classes, as schema vocabulary.
 *
 * Two things live here and nothing else:
 *
 *   1. `ARCHETYPES` — the twenty §C.1.1 rows. Since schema 19 a contract may
 *      DECLARE its own row (`archetype`, plus `"none"` for the opt-out that
 *      divider/heading/text-class contracts take). The declaration is what the
 *      REQUIRED-FACTS referee reads (`@ds-contracts/core` required-facts.ts):
 *      per archetype, the load-bearing facts a set must carry before it may be
 *      minted onto the canvas.
 *
 *   2. `archetypeOf` — the NAME-MAP, first-match keyword rules over the
 *      kebab-cased contract name. It is the SEEDING TOOL, never the authority:
 *      `ds-contracts migrate` writes the declared field once from these rules,
 *      a human reviews the diff, and from then on the explicit field wins. A
 *      name the rules do not reach is `"unmapped"` — which enforces nothing and
 *      WARNS "declare archetype", because a guess that mints a wrong set is
 *      worse than an honest refusal to guess.
 *
 * The rules moved here from extract/figma/census/corpus.ts (which now
 * re-exports them) so the census, the schema and the referee cannot drift onto
 * three different name-maps.
 */

/** The twenty §C.1.1 rows plus the census's own residue class. */
export type Archetype =
  | "button"
  | "badge / tag / chip"
  | "checkbox / radio"
  | "toggle / switch"
  | "banner / alert / toast"
  | "input / field"
  | "card"
  | "avatar"
  | "tabs"
  | "accordion"
  | "progress / spinner"
  | "slider"
  | "select / combobox"
  | "modal / dialog"
  | "tooltip / popover"
  | "menu / dropdown"
  | "pagination"
  | "table / data-grid"
  | "calendar / date-picker"
  | "breadcrumb"
  | "nav (top / side)"
  | "unmapped";

/** The twenty-one DECLARABLE rows, in §C.1.1 order (calendar / date-picker
 *  added 2026-08-29 as a reviewed minor contract change per docs/32 D3). `unmapped` is deliberately
 *  absent: it is what the name-map returns when it recognises nothing, never
 *  something a contract may claim. A contract that is genuinely not a
 *  component archetype declares `"none"`. */
export const ARCHETYPES = [
  "button",
  "badge / tag / chip",
  "checkbox / radio",
  "toggle / switch",
  "banner / alert / toast",
  "input / field",
  "card",
  "avatar",
  "tabs",
  "accordion",
  "progress / spinner",
  "slider",
  "select / combobox",
  "modal / dialog",
  "tooltip / popover",
  "menu / dropdown",
  "pagination",
  "table / data-grid",
  "calendar / date-picker",
  "breadcrumb",
  "nav (top / side)",
] as const satisfies readonly Archetype[];

/** What a contract may DECLARE: one of the twenty rows, or the `"none"`
 *  opt-out (a divider, a heading, a code block — typography, rules, glyphs and
 *  images rather than component archetypes). */
export const DECLARABLE_ARCHETYPES = [...ARCHETYPES, "none"] as const;

export type DeclaredArchetype = (typeof DECLARABLE_ARCHETYPES)[number];

const ARCHETYPE_RULES: Array<[RegExp, Archetype]> = [
  [/breadcrumb/, "breadcrumb"],
  [/(^|-)(top|side)-?nav|(^|-)nav($|-)/, "nav (top / side)"],
  [/pagination/, "pagination"],
  [/(^|-)table|data-?grid/, "table / data-grid"],
  [/select|combobox|autocomplete|typeahead/, "select / combobox"],
  [/modal|dialog|drawer/, "modal / dialog"],
  [/tooltip|popover/, "tooltip / popover"],
  [/menu|dropdown/, "menu / dropdown"],
  [/(^|-)tabs?($|-)|tab-?list/, "tabs"],
  [/accordion/, "accordion"],
  [/progress|spinner|skeleton/, "progress / spinner"],
  [/slider/, "slider"],
  [/switch|toggle/, "toggle / switch"],
  [/checkbox|radio/, "checkbox / radio"],
  [/banner|alert|toast|notification|snackbar/, "banner / alert / toast"],
  [/badge|(^|-)tag($|-)|chip/, "badge / tag / chip"],
  [/input|field|text-?area/, "input / field"],
  [/(^|-)card($|-)/, "card"],
  [/avatar/, "avatar"],
  [/button|(^|-)fab($|-)/, "button"],
];

export const kebabName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/** The NAME-MAP. Seeding only — see the module header. */
export function archetypeOf(contract: { id: string; name: string }): Archetype {
  const keys = [
    kebabName(contract.name),
    kebabName(contract.id.split(".").slice(1).join(".")),
  ];
  for (const [re, a] of ARCHETYPE_RULES)
    if (keys.some((k) => re.test(k))) return a;
  return "unmapped";
}

/** How a contract's archetype is RESOLVED for enforcement.
 *  · `declared`  — the contract carries the field; it wins, always.
 *  · `name-map`  — no field, the rules recognised the name (seeding-grade).
 *  · `unmapped`  — no field and no rule matched: enforce nothing, WARN. */
export interface ResolvedArchetype {
  archetype: Archetype | "none";
  source: "declared" | "name-map" | "unmapped";
}

export function resolveArchetype(contract: {
  id: string;
  name: string;
  archetype?: string;
}): ResolvedArchetype {
  if (contract.archetype)
    return {
      archetype: contract.archetype as Archetype | "none",
      source: "declared",
    };
  const mapped = archetypeOf(contract);
  return mapped === "unmapped"
    ? { archetype: "unmapped", source: "unmapped" }
    : { archetype: mapped, source: "name-map" };
}
