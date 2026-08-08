# Slots Recon — Native Slots API Probes

**Date:** 2026-08-08 · **Branch:** `feat/beta-rounds` (7510916c) · **File probed:**
`Latest DS Contracts Tests` (fileKey `BMjUA2ue5CaZXU4kufxL0z`), section
**"Slots Recon Probes"** on page **"Slots Recon"** (page `4:1160`, section `4:1161`).
All probes ran through the figma-console MCP Desktop Bridge (`figma_execute` with
explicit `fileKey`, plus the dedicated slot tools). `DS Contracts Testing`
(`GnQnjSNBXtgtd2Ht0Hs1C8`) was connected but never targeted. No engine files were
edited; nothing was committed.

Companion proposal: [native-slots-proposal.md](./native-slots-proposal.md).

---

## Probe 1 — what the emitter draws today (node 4-429)

### 1a. The canvas node

```js
const n = await figma.getNodeByIdAsync('4:429');
// → read type, name, fills, strokes, dashPattern, plugin data, children, ancestry
```

Readback (verbatim, trimmed):

```json
{
  "id": "4:429", "type": "COMPONENT", "name": "Slot",
  "parent": { "id": "4:431", "type": "PAGE", "name": "Utilities" },
  "fills": [],
  "strokes": [{ "type": "SOLID", "color": { "r": 0.6, "g": 0.62, "b": 0.68 } }],
  "dashPattern": [4, 4],
  "layoutMode": "HORIZONTAL",
  "pluginData": {},
  "children": [{ "id": "4:430", "type": "TEXT", "name": "Slot", "chars": "Slot" }]
}
```

The owner's read is correct: node 4-429 is the **"Slot" utility COMPONENT** —
a dashed-border (4,4 pattern), gray-stroke, no-fill horizontal auto-layout frame
containing the literal text "Slot". It is purely decorative chrome with no
slot function. It carries **no ds_contracts plugin data**.

### 1b. Where the emitter mints it (READ-ONLY cross-reference)

`core/emit-figma-script.ts`:

- `ensureSlotUtility()` (~line 5414): finds-or-creates exactly this component —
  `dashPattern = [4, 4]`, gray stroke `{r:0.6, g:0.62, b:0.68}`, `characters = 'Slot'`,
  parked on a "Utilities" page. Node 4-429 is its product.
- Slot spec build (~line 3378): a contract `part.slot` becomes
  `{ type: 'slot', slotProperty, slotOptional, slotAccepts, slotDefault }`.
- Property minting (create path ~6000, amend path ~5846, batch ~6116): the slot
  becomes an **INSTANCE_SWAP** component property whose `defaultValue` is the
  Slot utility's id (or the resolved `defaultContent` component), with
  `slotAccepts` → `preferredValues` (soft constraint). Optional slots add a
  `Show <name>` BOOLEAN, default **false** (the dashed chrome must not be the
  showcase default — Toast/ChatMessage live finding, comment at ~5867).
- The file's own header (~line 29) already names the upgrade target:
  "Figma's native SLOT property type + SlotSettings is the upgrade target."

### 1c. The contract slot grammar (schema, READ-ONLY)

`contracts/contract.schema.json` → `definitions.__schema0.properties.slot`:

```json
{ "name": "string (required)",
  "accepts": ["contract ids"],
  "acceptsMode": "prefer | restrict | open",
  "min": "integer >= 0", "max": "integer >= 1",
  "required": "boolean",
  "figmaProperty": "string",
  "defaultContent": [{ "id": "contract id", "props": {}, "text": "string" }] }
```

---

## Probe 2 — the native API, empirically

### 2a. API surface

```js
typeof figma.createSlot            // "undefined"  — NOT on the figma global
// ComponentNode prototype scan:
componentSlotKeys                  // ["createSlot"] — lives on COMPONENT nodes
figma.apiVersion                   // "1.0.0"
comp.addComponentProperty('TestSlotProp', 'SLOT', '')
// → succeeds: { "TestSlotProp#4:377": { "type": "SLOT", "description": null, "preferredValues": [] } }
```

- `createSlot()` exists on **ComponentNode only**. Probed `typeof frame.createSlot`
  → `"undefined"` (plain FRAME) and `typeof set.createSlot` → `"undefined"`
  (COMPONENT_SET). Dead end recorded: you cannot mint a slot on a set node
  directly, nor on a non-component frame.
- `'SLOT'` is a valid `addComponentProperty` type.
- SlotNode prototype adds one member over FrameNode: **`resetSlot`**.

### 2b. `createSlot()` mechanics (ProbeA/Card, `4:1162`)

```js
const slot = comp.createSlot();
```

```json
{ "id": "4:1164", "type": "SLOT", "name": "Slot",
  "width": 100, "height": 100, "layoutMode": "NONE",
  "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }],
  "strokes": [], "dashPattern": [],
  "parentId": "4:1162", "childCount": 0 }
```

Auto-minted linked property: `Slot#4:378` (type SLOT), bound via
`slot.componentPropertyReferences = { "slotContentId": "Slot#4:378" }` — a **new
componentPropertyReferences key** (`slotContentId`), not `mainComponent`.

Follow-up mutations, all verbatim:

| Operation | Result |
|---|---|
| `slot.name = 'Content'` | Property renames with it: `Content#4:378` |
| `slot.layoutMode = 'VERTICAL'` | OK — slots take auto-layout |
| `slot.layoutMode = 'GRID'` | **`Error: in set_layoutMode: GRID layoutMode cannot be applied to Slot frames`** |
| `slot.layoutSizingHorizontal = 'FILL'` | OK |
| `editComponentProperty(key, { description, preferredValues: [{type:'COMPONENT_SET', key: badge.key}] })` | OK — both persist on the SLOT definition |
| SLOT definition keys | `["type", "description", "preferredValues"]` — **no `slotSettings`** in this build (dump.plugin.js v1.5 speculatively reads `def.slotSettings`; it is absent here) |
| Append default content inside the slot in the main | OK — `slot.appendChild(text)` works; renders as the slot's default |
| `slotContentHash` / `minChildren` / `maxChildren` / `slotBehavior` on SlotNode | all absent — **no count/required constraint surface** |

**Empty/filled rendering:** a slot renders as an ordinary frame — its own fills
(default solid white), no dashed chrome, no badge in exports. Screenshot receipts:
ProbeA/Card (`4:1162`) shows header + default content, nothing slot-flavored;
ProbeF/GridCard (`4:1194`) with a single empty slot exports as a blank white
frame. The slot affordance is Figma-UI-side only — **exports and screenshots
carry zero slot chrome**.

### 2c. Slots inside COMPONENT_SETs (the emission-unit question)

Build: two variants (`Size=Small`, `Size=Large`), `createSlot()` on Small
**before** combining, then `figma.combineAsVariants([v1, v2], section)` →
ProbeB/Set (`4:1172`).

- First attempt failed — dead end verbatim:
  **`Error: in combineAsVariants: Grouped nodes must be in the same page as the parent`**
  (the components were minted on `figma.currentPage`, the section lived on the
  Slots Recon page; re-parenting the components to the section's page fixed it).
- After combining, the slot property **moved to set level**:
  `set.componentPropertyDefinitions` = `{ "Body#4:380": {type:"SLOT"}, "Size": {type:"VARIANT"} }`.
  **Slots survive componentization.**
- `v2.createSlot()` post-combine with the same layer name minted a **second**
  property — `Body#4:382` alongside `Body#4:380`. Same display name, two IDs.
  **The per-variant duplicate-property trap.**
- Unification works:
  ```js
  s2.componentPropertyReferences = { slotContentId: 'Body#4:380' };  // OK
  set.deleteComponentProperty('Body#4:382');                          // OK
  ```
  Final set CPD: one `Body#4:380` shared by both variants' slot nodes.

### 2d. Instance behavior + the amend collision (ProbeD/Instance, `4:1174`)

**Fill on an instance:**

```js
const islot = inst.findOne(n => n.type === 'SLOT');   // I4:1174;4:1170, cpr slotContentId Body#4:380
islot.appendChild(text('DESIGNER FILL'));              // plain appendChild works on an instance's slot
inst.componentProperties                               // includes "Body#4:380": { "type": "SLOT", "preferredValues": [] } — no value field
inst.setProperties({ 'Body#4:380': 'anything' })
// → Error: in setProperties: Slot component property values cannot be edited
```

**Variant switch:** `inst.setProperties({ Size: 'Large' })` → the instance's slot
node id changes (`I4:1174;4:1173`) but keeps `slotContentId: Body#4:380` and the
children read back `["DESIGNER FILL"]`. Switch back: still there.
**Slot content rides the PROPERTY ID, not the slot node.**

**Amend simulation — the emitter's exact interior-rebuild semantics**
(`for (const child of [...comp.children]) child.remove();` then rebuild,
per `amendSet` ~line 5812):

1. Removed all of Small's children (including SLOT `4:1170`), rebuilt a text +
   fresh `createSlot()` named `Body`.
2. Result: new property `Body#4:385` minted; the old `Body#4:380` stayed on the
   set (orphaned); the instance's slot re-pointed to `Body#4:385` **with empty
   children**. **The designer's fill is gone from view. Collision confirmed.**
3. **Preservation rule test:** rebind the rebuilt slot to the ORIGINAL id —
   ```js
   newSlot.componentPropertyReferences = { slotContentId: 'Body#4:380' };
   set.deleteComponentProperty('Body#4:385');
   ```
   → the instance slot reads back `children: ["DESIGNER FILL"]`.
   **The fill RESURRECTED.** Instance slot content is stored against the
   property ID and survives node replacement, exactly like TEXT/BOOLEAN
   overrides survive today because property IDs do.
4. Mechanism observed: the fill lives in a **parentless backing FRAME** named
   after the slot (`4:1178` "Body", parent chain length 1) holding the content
   nodes; `resetSlot()`/property deletion detach the reference but the backing
   frame remained reachable by id in-session.

### 2e. Readback surfaces

**MCP `figma_get_slots`** — works on COMPONENT_SET and INSTANCE; returns slot id,
name, `propertyKey`, dimensions, layoutMode, children, and (on sets) which
variant each slot node belongs to. `figma_append_to_slot` and `figma_reset_slot`
receipts taken on `4:1174` (append minted `4:1192` "MCP appended"; reset returned
`childCount: 0`).

**Plugin-API node walk (dump.plugin.js style):** the instance walk sees
`{ type: "SLOT", name: "Body", cpr: { slotContentId: "Body#4:380" }, children: [...] }` —
children are ordinary nodes. `dump.plugin.js` (dump v1.5+) already walks SLOT
nodes verbatim and reads `SLOT` property definitions incl. `preferredValues`
and `description`; its speculative `slotSettings` read finds nothing in this
build. `'componentPropertyDefinitions' in slotNode` → false (definitions stay
on the component/set).

**REST file-nodes endpoint** (`GET /v1/files/:key/nodes?ids=4:1172,4:1174`, HTTP 200):

- SLOT nodes serialize with `"type": "SLOT"`, their
  `componentPropertyReferences.slotContentId`, and children walked — structure
  round-trips.
- **`componentPropertyDefinitions` came back `{}`** on the set and
  `componentProperties` `{}` on the instance — the SLOT definitions
  (and therefore `preferredValues`/`description`, i.e. the accepts carriage)
  **do not serialize over REST in this build**. The plugin dump is the only
  readback that sees the constraint. Recorded as a REST dead end.
- `exportAsync` on a SLOT node directly: works (265-byte PNG for the empty slot).

### 2f. Slots × auto-layout and GRID (ProbeF/GridCard `4:1194`, NestHost `4:1197`)

- Component with `layoutMode = 'GRID'`, `gridRowCount = 2`, `gridColumnCount = 2`:
  `g.createSlot()` **succeeds** — a slot can be a grid CHILD.
- `gs.gridRowSpan = 1; gs.gridColumnSpan = 2` → OK; `gridRowAnchorIndex`/`gridColumnAnchorIndex`
  readable (0,0); `layoutSizingHorizontal/Vertical = 'FILL'` → OK.
  **A named-area slot can occupy and span grid cells — the A2/A3 marriage holds.**
- The one refusal is the slot's own interior: `layoutMode = 'GRID'` **on** the
  slot throws (verbatim in 2b). A slot's internal layout is NONE/HORIZONTAL/VERTICAL only.
- **Nesting:** a slot moved into a nested frame (`component > Inner > DeepSlot`)
  keeps its property binding (`DeepSlot#4:389`) — the "direct child" restriction
  in the MCP tool docs is not enforced by the raw API in this build. A slot
  appended **inside another slot** also did not throw. Both are
  API-tolerated-but-unspecified; treat as out of contract (see proposal refusals).

---

## Probe 3 — the EMITTER's own call sequence, live (2026-08-08, native-slots round)

Run against the same file (`BMjUA2ue5CaZXU4kufxL0z`, page **Slots Recon**) in a
throwaway section `EMITTER VERIFY — native slots`, deleted immediately after.
It replays exactly what `core/emit-figma-script.ts` now emits, including the one
call §2 never exercised: `editComponentProperty` on the SET, post-combine.

| Step | Live result |
|---|---|
| `createSlot()` on two pre-combine variants, both renamed `Body` | ids `Body#4:391`, `Body#4:392` |
| `combineAsVariants([v1, v2], section)` | set CPD = **`["Body#4:393", "Size"]`** — same-named slot properties **MERGE into ONE NEW id**, and BOTH slot nodes come back re-pointed at it (`slotContentId: Body#4:393`) |
| `set.editComponentProperty(Body#4:393, { preferredValues, description })` | **OK** — both persist on the SLOT definition at set level (the previously unprobed call) |
| interior rebuild: remove children, `v1.createSlot()`, rename `Body` | mints `Body#4:394`; set CPD = `["Body#4:393", "Body#4:394", "Size"]` — **the duplicate trap, live, on the AMEND path** |
| rebind to `Body#4:393` + `set.deleteComponentProperty('Body#4:394')` | set CPD back to `["Body#4:393", "Size"]`, and the designer instance's slot reads back **`children: ["DESIGNER FILL"]`** — the fill survived the interior rebuild |

**This corrected the headless model.** `scripts/plugin-engine-mock-figma.mjs`
first modelled combineAsVariants as *keeping* both pre-combine properties, which
made the create path's unification look load-bearing when Figma performs that
merge itself. The mock now merges on combine (live-matched) and mints a
duplicate for a post-combine `createSlot()` (probe 2c, re-confirmed above), so
the emitter's rebind is exercised where it actually earns its keep: the amend
path. The unification code still runs on the create path and is a no-op there.

## Probe inventory on canvas (all inside section `4:1161`)

| Node | Id | Purpose |
|---|---|---|
| ProbeA/Card | `4:1162` | createSlot mechanics, rename→property link, default content, preferredValues/description |
| ProbeB/Set | `4:1172` | combineAsVariants survival, duplicate-property trap, unification |
| ProbeD/Instance | `4:1174` | instance fill, variant-switch carriage, amend collision + resurrection, MCP append/reset receipts |
| ProbeF/GridCard | `4:1194` | slot as grid child with spans + FILL |
| ProbeF/NestHost | `4:1197` | nested-slot tolerance |

Node 4-429 (the dashed Slot utility) was inspected read-only and left untouched.
