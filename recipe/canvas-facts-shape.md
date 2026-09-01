# Canvas facts — the stable canvas→code input shape (`canvas-facts-v1`)

> Stage 3a of the canvas→code journey ([docs/35](../docs/35-two-journey-v1-plan.md) §5).
> Produced by `recipe/canvas-facts.ts` from a committed scene observe
> (`SceneNodeSnapshot`, the `recipe/scene-readback.ts` readback shape).
> Nothing here mints a grade; `overallSuccess` is untouched.

A **canvas-facts document** is the machine-readable statement of everything a
scene observe shows, in the same fact vocabulary the scene-inversion gates
already prove lossless (`sceneToNormalizedIr` → `compileExpectedScenePlan`).
It is derived from the canvas ALONE:

- **Ownership keys are structural** (`root`, `root/children/N`, …) — never
  taken from a compile plan, so the document carries zero forward-direction
  provenance.
- **Nothing is invented.** A live value the vocabulary cannot spell is folded
  only when the fold is mechanical AND recorded in `normalizations`; anything
  else stays a named receipt downstream.

## Top-level shape (`CanvasFactsDocument`)

| Field | Contents |
|---|---|
| `version` | `"canvas-facts-v1"` |
| `source` | `{ observePath, observeSha256 }` — the committed observe artifact this was derived from, byte-pinned |
| `scene` | The observe tree with structural ownership keys assigned and binding spellings normalized (see `normalizations`); every other value is the observe verbatim |
| `hierarchy` | Node hierarchy + roles: `{ ownershipKey, type, name, role?, variantProperties?, children[] }` per node |
| `facts` | The full fact projection (see channel table below) — `SceneFact[]`: `{ id, baseId, nodeOwnershipKey, channel, occurrence, value, observedProperty }` |
| `tokenIdentities` | Every distinct bound-variable name: `{ variableName, tokenIdentity, resolvedType, bindingSites }`. `tokenIdentity` is the dot-path decoded from the writer's hex encoding (`token/<type>/id-<hex>`), or `null` when the live name does not decode — named, never guessed |
| `normalizations` | Named binding-spelling folds applied before projection (see below) — never silent |
| `counts` | `{ nodes, facts, byChannel }` |

## Fact channels

The projection is scene-readback's own (one fact per channel occurrence per
node, stable ids `<ownershipKey>#<channel>@<occurrence>`):

- **Geometry / layout** — `layout.mode`, `layout.primaryAxisAlign`,
  `layout.counterAxisAlign`, `layout.itemSpacing`, `layout.padding`,
  `layout.positioning` (+ `layout.offset`/`layout.constraints` when absolute),
  `width.mode`/`width.value`, `height.mode`/`height.value`,
  `layout.minWidth`/`layout.minHeight`, `clipsContent`
- **Paints / effects** — `fill` (one per paint), `stroke`, `effect`,
  `cornerRadius` (four corners)
- **Text + typography** — `characters`, `type` (fontFamily, fontStyle,
  fontSize, lineHeight, letterSpacing?, textCase?, textDecoration?), `align`,
  `verticalAlign`
- **Bound variables** — `binding` (field, live variableName, resolvedType)
- **Component-set axes / variants** — `variantAxis` (set), `variantProperties`
  (component), `componentRef` + `properties` (instances)
- **Hierarchy / identity** — `kind`, `name`, `role`, `child`, `visible`,
  `opacity`

## Named normalizations (`CanvasBindingNormalization`)

Figma's readback API spells three binding facts in ways the IR vocabulary
does not carry. Each fold is mechanical and RECORDED:

1. `paint-alias-duplicate-dropped` — the API reports `fills.0` **and**
   `fills.0.color` for the same variable (likewise `strokes.N`/`effects.N`);
   the alias spelling is dropped, the fact survives once.
2. `uniform-stroke-side-weights-collapsed` — `strokeTop/Right/Bottom/LeftWeight`
   all binding ONE variable collapse to `strokes.0.weight`.
3. `nonuniform-stroke-side-weights-receipted` — per-side weights binding
   DIFFERENT variables have no IR spelling; the bindings are removed from the
   projection and this receipt is the named loss the downstream ledger MUST
   carry. Nothing is invented.
4. `partial-stroke-side-weights-receipted` — fewer than four of
   `strokeTop/Right/Bottom/LeftWeight` are bound (e.g. a header divider that
   only binds `strokeBottomWeight`); same RECEIPT doctrine as (3).

## Committed artifacts

| Path | Contents |
|---|---|
| `recipe/evidence/canvas-to-code-v1/canvas-facts-button.json.gz` | Button canvas-facts document (canonical JSON, gzipped), derived from `recipe/evidence/button-scene-inversion-v2/observe-altitude.json.gz` |

`tsx recipe/emit-canvas-facts.ts --check` re-derives and compares byte-for-byte
(fail closed); `--write` refreshes after a reviewed change.
