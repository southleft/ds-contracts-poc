# Native Slots — Pinned Emission Proposal

**Status: IMPLEMENTED 2026-08-08** (native-slots round). Pinned by the
2026-08-08 slots recon (probe receipts:
[slots-recon-probes.md](./slots-recon-probes.md)); the engine now emits native
slots and this document is the specification it was built to. What landed,
against the sections below:

| § | Landed as |
|---|---|
| §1 mapping | `core/emit-figma-script.ts` — the `slot` spec compiles to `owner.createSlot()`; the slot LAYER carries `slot.figmaProperty` (the property follows the layer name); `slotRuntime` is feature-gated, so a slot-less contract emits a byte-identical script |
| §1 sets | `bindSlot` unifies per-variant duplicates: the first id seen is canonical, every other slot node rebinds and its duplicate is deleted. **Live re-measurement (probe 3)** refined the recipe: Figma MERGES same-named slot properties itself at `combineAsVariants` (two pre-combine ids → one new id, both nodes re-pointed), so unification is a no-op on the create path; the duplicate trap is real on the AMEND path, where `createSlot()` on an already-combined variant mints a second set-level property. `bindSlot` reads the node's live reference rather than a cached id, which is why the create path stays correct through the merge |
| §2 rendering | the dashed "Slot" utility is never minted again; `createSlot`'s default white fill is cleared unless the contract paints the part. G4's slot-scoring convention is revised to STRUCTURAL in [layout-grammar-proposal.md](./layout-grammar-proposal.md) |
| §3 amend | the same `bindSlot` rebinds every rebuilt slot to the PRESERVED property id (`defKey` name match over the pre-rebuild definitions) and deletes the auto-minted temporary — the amend-survival invariant, red-tested in `evals/fixtures/native-slots-check.ts` |
| §4 readers | `extract/figma/dump.plugin.js` v1.18 (SLOT preferredValues + `slotDescriptions` + `slotKey`); `core/propose-figma.ts` inverts a native slot incl. defaultContent, optionality and the REST dead end BY NAME; `parity/diff.ts` gains the accepts-violation finding |
| §5 refusals | GRID-in-slot and slot-in-slot refuse at compile; `min`/`max`/`required`/`restrict` carry as words in the SLOT `description` (`REFUSED BY FIGMA: …`) |
| §6 migration | `migrateLegacySlotProperty` retires an INSTANCE_SWAP slot property inside a normal amend, reports `migratedSlots` + `strandedSwapOverrides` by name, and `retireSlotUtility` deletes the utility LAST (only when nothing points at it); `RUNTIME_EMIT_REV` = `rt6-native-slots` |

**Verdict: native slots are carriageable — PARTIAL.** Structure, per-variant
survival, instance fills, grid-cell placement, and plugin-side readback are all
proven. The `accepts` constraint carries only as a soft preference
(`preferredValues` + `description`), `min`/`max`/`required`/`acceptsMode:
"restrict"` have no API analogue (refusal classes below), and REST does not
serialize SLOT property definitions (plugin dump is the authoritative reader).

---

## 1. The mapping: contract slot → native slot

Today a contract `part.slot` emits a wrapper frame + an INSTANCE_SWAP property
defaulting to a **dashed decorative "Slot" utility component** (node 4-429 in the
playground file) — chrome with no function. The native mapping replaces the whole
convention:

| Contract fact | Native emission | Probe basis |
|---|---|---|
| `slot.name` | `SlotNode` minted via `component.createSlot()`, `slot.name = <name>` — the linked SLOT property auto-mints and **renames with the layer** | 2b |
| `slot.figmaProperty` | The SLOT property's display name (rename the slot layer; the property follows) | 2b |
| `slot.accepts` | `editComponentProperty(key, { preferredValues: [{type, key}] })` — resolved through the same `resolveComponentIdentity` path the INSTANCE_SWAP emission uses today | 2b |
| `slot.acceptsMode: "prefer"` / `"open"` | `preferredValues` present / absent. Both are soft — Figma does not block off-list content | 2b |
| `slot.acceptsMode: "restrict"` | **REFUSED** (no enforcement API). Carry the intent in the property `description` (`"Accepts: …"`) and let the differ flag violations | 2b, §5 |
| `slot.defaultContent` | Children appended **inside the SlotNode in the main component** — instances inherit; `resetSlot()` returns to it | 2b |
| `part.optional` (`Show X` boolean) | **Kept.** An empty native slot still renders as a frame occupying space; optional-and-hidden still needs the visibility-bound BOOLEAN, default false, exactly as today | 2b rendering |
| `min` / `max` | **REFUSED** — no count-constraint surface on SlotNode (`minChildren`/`maxChildren` absent) | 2b |
| A2 named-area slot (G4: area name IS the slot anchor) | The SlotNode **is** the area rect: slot as a direct grid child with `gridRowSpan`/`gridColumnSpan`/anchors + `FILL` sizing | 2f |

### Component sets (our emission unit)

Slots survive `combineAsVariants` — the SLOT property lifts to set level. But
per-variant `createSlot()` with the same name mints **duplicate properties**
(one per variant). The pinned recipe:

1. Create the slot in the **first** variant (or before combining); note its
   property id (`Name#id`).
2. In every other variant: `createSlot()`, then immediately rebind
   `slot.componentPropertyReferences = { slotContentId: <first id> }` and
   `set.deleteComponentProperty(<duplicate id>)`.
3. End state: **one** set-level SLOT property, N slot nodes (one per variant)
   all referencing it. This is what makes instance fills survive variant
   switching (probe 2d).

`createSlot()` exists only on ComponentNode — never attempt it on the SET node
or a plain frame.

## 2. Empty/filled rendering convention

**A native empty slot's rendering is Figma's, not ours to draw.** The dashed
"Slot" utility (and `ensureSlotUtility()`) is superseded entirely: no dashed
strokes, no "Slot" text, no placeholder instance. An empty slot is an ordinary
frame with whatever fills the contract's part styling gives it (probe: exports
carry zero slot chrome; the slot affordance lives in Figma's UI).

**This revises G4's dual slot-scoring convention**
([layout-grammar-proposal.md](./layout-grammar-proposal.md), "Dual slot-scoring
convention"): the old rule scored an empty area by the SHARED PLACEHOLDER on
both surfaces — canvas dashed frame ↔ code placeholder element. Pixel-parity on
placeholder chrome is now impossible by design, so the convention becomes
**structural, not visual**:

- **Empty slot** — canvas truth: a SLOT node named for the area, placed/spanned
  per the contract, with the contract's own part styling (usually no fill);
  code truth: the placeholder element with the slot class, unchanged. Scoring
  gates on *presence + name + placement geometry* (the slot's box), never on
  placeholder pixels.
- **Filled slot** — unchanged from G4: the same child sequence pins on both
  sides; a slot filled on canvas and its code-side children diff against each
  other as content, and grid placement facts (anchor/span/fill) score as
  geometry.

## 3. Amend-path rules (the interior-rebuild collision)

Probe 2d reproduced the collision exactly: the current amend semantics
(`amendSet`: variant interiors are contract-owned, every child removed and
rebuilt) **destroys instance slot fills** — the rebuilt `createSlot()` mints a
fresh property id, instances re-point to it empty, and the designer's content
orphans against the old id. It also proved the preservation rule: **content is
keyed to the property id and resurrects when the rebuilt slot is rebound to
it.** Pinned rules:

1. **SLOT property ids are preserved identity**, exactly like TEXT/BOOLEAN/
   INSTANCE_SWAP property ids today. Amend resolves slots through the same
   `defKey` name-matching: an existing SLOT property whose display name matches
   the contract slot **is** that slot.
2. Interior rebuild MAY replace the SlotNode, but every rebuilt slot **must be
   rebound** to the matched existing property id
   (`componentPropertyReferences = { slotContentId: k }`) and any
   auto-minted temporary property **must be deleted in the same pass**. Probe
   receipt: fills survive this verbatim sequence. (Preferable when convenient:
   keep the SlotNode itself and rebuild only its siblings — but the rebind rule
   makes even full rebuild safe.)
3. `defaultContent` changes rewrite the slot's children in the **main**
   component only; instance fills are designer-owned overrides and are never
   touched (`resetSlot()` is a designer action, not an amend action).
4. A contract that RENAMES a slot amends by `editComponentProperty`-equivalent
   rename of the slot layer (property follows), never delete+recreate.
5. A contract that REMOVES a slot deletes the property — **REPORTED, never
   silent**, mirroring the extra-variants rule: instance fills orphan into
   parentless backing frames (observed mechanism, probe 2d) and are
   unrecoverable from the designer's view.
6. `accepts` changes are non-destructive: `editComponentProperty` with new
   `preferredValues`/`description` on the preserved id.

## 4. Reader / differ obligations

- **Plugin dump is the authoritative slot reader.** REST serializes SLOT nodes
  (type + `slotContentId` + children) but returned **empty**
  `componentPropertyDefinitions` — `preferredValues`/`description` (the accepts
  carriage) are invisible over REST in the probed build. Any REST-side lane
  must treat slot constraints as *not readable* and defer to the dump.
- `extract/figma/dump.plugin.js` (dump v1.5) already walks SLOT nodes verbatim
  and captures SLOT definitions incl. `preferredValues`/`description`; its
  speculative `slotSettings` read finds nothing in the current build — keep the
  tolerant read, it costs nothing. Propose maps a SLOT node to the same
  contract slot part as the INSTANCE_SWAP convention (already declared in the
  dump header).
- The reader must key slot identity on the **property id**, resolve which
  variant each slot node belongs to (as `figma_get_slots` does), and read
  instance fills as ordinary child subtrees of the instance's slot node.
- The differ gains one obligation: **accepts violations** (content whose
  component key is off the `accepts` list under `acceptsMode: "restrict"`)
  are a *diff finding*, not a canvas impossibility — the canvas cannot refuse
  them, so the differ must name them.
- `instance.setProperties` can never touch a slot
  (`Error: in setProperties: Slot component property values cannot be edited`);
  any tool path that writes slot content must go through the slot node's
  children (append/remove), as `figma_append_to_slot` does.

## 5. Refusal classes (what the API cannot express)

| Contract fact | Why refused | Named degradation |
|---|---|---|
| `slot.min` / `slot.max` | No count-constraint surface on SlotNode or SLOT definition | Carry in property `description`; differ may count children |
| `slot.required` | No API analogue; an empty slot is always legal on canvas | Same as min≥1 degradation |
| `acceptsMode: "restrict"` | `preferredValues` is prefer-only; off-list appends succeed (probed) | Emit `preferredValues` + description; differ flags violations |
| GRID layout **inside** a slot | `Error: in set_layoutMode: GRID layoutMode cannot be applied to Slot frames` | Slot interior limited to NONE/HORIZONTAL/VERTICAL; a grid-layout slot interior is a contract refusal |
| Slot on a non-component frame / on the SET node | `createSlot` undefined there | Not needed — emission unit is variant components |
| Slot nested in another slot; slot deeper than a direct child | API tolerated in probes but unspecified (MCP layer forbids both) | Emitter never produces either; propose treats them as out of contract and reports |

## 6. Migration — existing emitted sets carrying dashed vectors

Existing sets carry: wrapper frame + INSTANCE_SWAP property defaulting to the
"Slot" utility + optional `Show X` boolean. Migration is **amend-gated and
staged**, never a background rewrite:

1. **New emissions** (post-implementation) mint native slots only.
2. **Existing sets** migrate inside a normal amend when the runtime detects an
   INSTANCE_SWAP property whose default resolves to the Slot utility component:
   mint the SlotNode per §1 in each variant (unified property), transfer
   `preferredValues` verbatim, move the `Show X` visibility binding to the
   SlotNode, then delete the INSTANCE_SWAP property and its wrapper instance.
3. **Designer content on the old convention** — an instance whose swap property
   was overridden to a real component — cannot be transferred automatically
   with certainty (property types differ; the swap override is an instance,
   the slot fill is a child subtree). The amend report must NAME each affected
   instance (`migratedSlots` / `strandedSwapOverrides`), mirroring the
   extra-variants never-silent rule. Where the override's main component
   resolves, a best-effort re-instantiation into the new slot is acceptable
   **only if reported**.
4. The "Slot" utility component (node 4-429 class) is deleted only when no
   INSTANCE_SWAP slot reference remains in the file; until then it stays.
5. `RUNTIME_EMIT_REV` bumps with the migration (template change without a
   contracts delta), so unchanged specs still re-amend once.

## 7. Sequencing and A3 impact

- **After** the live grid workflow lands (`core/emit-*` / `extract/figma` are
  mid-rework; this proposal touches the same slot registry, amend loop, and
  dump/propose surfaces).
- Implementation scope, in order: (1) emitter slot registry → native SLOT
  emission + set-level unification; (2) amend preservation rules (§3) with the
  rebind receipt as the regression test; (3) dump/propose slot readback keyed
  on property ids (dump already half-ready); (4) migration pass (§6);
  (5) differ accepts-violation findings.
- **A3 composition-corpus design change:** grid-area slots are natively
  fillable and span-capable (probe 2f), so the corpus should include
  slot-in-grid-cell cases (empty, defaulted, designer-filled, spanning) and
  score them by the structural convention in §2 — placeholder-pixel cases for
  slots drop out of the corpus. Instance-fill survival across amend (§3) is
  corpus-worthy as the one case that bridges A3 and the sync loop.
