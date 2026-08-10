/**
 * Mocked `figma` global for the plugin-engine headless harness
 * (scripts/plugin-engine-check.mjs) — the canvas-side twin of the VM pattern
 * core-browser-check uses. It implements ONLY what the emitted sync scripts,
 * the embedded dump script, and the plugin's own inventory/marker scripts
 * actually call: node creation + tree ops, shared-plugin-data markers,
 * component properties, the variables API (collections, modes, aliases,
 * resolveForConsumer), text styles, and page traversal.
 *
 * Fidelity notes (deliberate, harness-scoped):
 *   - Auto-layout sizing IS modeled (2026-07-21, closes handoff 08#2 blind
 *     spot #1): width/height of an auto-layout frame with AUTO sizing are
 *     computed from children + itemSpacing + padding, and a child set to
 *     layoutSizing* FILL contributes ZERO intrinsic size — exactly real
 *     Figma's degenerate hug↔fill cycle, so a collapsed frame (the live
 *     composite dialog at ~3px) is now measurable headlessly. Text measures
 *     by a deterministic estimate (chars × fontSize × 0.6); the model exists
 *     to catch COLLAPSE, not to be pixel-accurate.
 *   - Component properties follow the REAL API contract (2026-07-21, closes
 *     blind spot #2): non-variant properties live on the COMPONENT_SET (or a
 *     standalone COMPONENT) — variant children REFUSE addComponentProperty /
 *     componentPropertyDefinitions like real Figma, and the set no longer
 *     hoists variant-minted defs (the old lenient hoist is what hid the live
 *     "Badge instance text not applied" bug). Instances deep-clone their
 *     main's subtree and setProperties REFLECTS TEXT/BOOLEAN values onto the
 *     cloned nodes via componentPropertyReferences; unknown keys THROW.
 *   - NATIVE SLOTS (2026-08-08, native-slots round) are modeled from the live
 *     probes in docs/research/slots-recon-probes.md, refusals included:
 *     `createSlot` exists on COMPONENT nodes only; the auto-minted SLOT
 *     property renames with its layer; slot properties LIFT to the set on
 *     combineAsVariants, MERGING same-named ones into one new id (measured
 *     live) while a post-combine `createSlot()` mints a duplicate — the trap
 *     the amend path must unify; `layoutMode = 'GRID'` on a slot throws Figma's verbatim
 *     message; `setProperties` refuses a SLOT key verbatim; and instance slot
 *     content is stored AGAINST THE PROPERTY ID, so it survives the slot node
 *     being rebuilt exactly when the rebuilt node is rebound to the same id.
 *     That last one is the amend-survival invariant — the mock is where it
 *     must fail forever if the emitter stops rebinding.
 *   - createNodeFromSvg validates (non-empty, no duplicate attributes) and
 *     returns an empty 16×16 frame (vector internals out of scope).
 *   - Fonts always "load"; text style application is exact (textStyleId).
 *   - PROTOTYPE REACTIONS (2026-07-26, prototype-wiring round): `reactions`
 *     is a GETTER over `_reactions` and the setter THROWS; writes go through
 *     `setReactionsAsync`, which validates CHANGE_TO destinations the way
 *     real Figma does — the destination must be a sibling under the SAME
 *     component set. A plain-assignment mock that silently succeeded would
 *     let a whole failure class pass headlessly.
 *     NAMED DEVIATION (stricter than real Figma, deliberately): Figma's own
 *     typings say `reactions` is read-only only when the manifest declares
 *     `"documentAccess": "dynamic-page"`. figma-sync/plugin/manifest.json
 *     does NOT, so assignment would currently work on a live canvas. The
 *     mock refuses anyway because setReactionsAsync is correct under BOTH
 *     manifest modes and this keeps the emitter on the portable path — see
 *     figma-sync/plugin/typings/reactions.d.ts for the vendored evidence.
 */

let nextId = 1;
const newId = () => `${nextId++}:${nextId}`;

export function createFigmaMock() {
  const allStyles = [];
  const collections = [];
  const variables = [];
  // setBoundVariable value reflection skips fields whose mock accessors have
  // layout semantics (width/height ride resize + auto-layout sizing).
  const NUMERIC_REFLECT_EXCLUDE = new Set(['width', 'height']);
  const mixed = Symbol('figma.mixed');

  class MockNode {
    constructor(type) {
      this.type = type;
      this.id = newId();
      this.key = `key-${this.id}`;
      // `name` is an ACCESSOR, because renaming a SLOT layer renames its
      // linked SLOT property (probe 2b) — a plain field could not carry that.
      // Defined per node and ENUMERABLE so everything that walks own keys
      // still sees `name` exactly where it was; the backing `_name` is
      // deliberately non-enumerable so no walker sees the name twice.
      Object.defineProperty(this, '_name', { value: type, writable: true, enumerable: false });
      Object.defineProperty(this, 'name', {
        enumerable: true,
        configurable: true,
        get() { return this._name; },
        set(v) {
          this._name = v;
          if (this.type === 'SLOT') this._renameSlotProperty(v);
        },
      });
      this.parent = null;
      this.removed = false;
      this.visible = true;
      this.opacity = 1;
      this.rotation = 0;
      this._w = 100;
      this._h = 100;
      this.x = 0;
      this.y = 0;
      this.fills = [];
      this.strokes = [];
      this.strokeWeight = 1;
      this.strokeAlign = 'INSIDE';
      this.dashPattern = [];
      this.effects = [];
      this.cornerRadius = 0;
      // GRID layout mode state (see the grid accessor block below — modeled
      // from the live probes in docs/research/grid-recon-probes.md).
      this._gridRows = [];
      this._gridCols = [];
      this._gridItemsPositioning = 'MANUAL';
      this._gridAutoTracks = 'NONE';
      this.gridRowGap = 0;
      this.gridColumnGap = 0;
      this.layoutMode = 'NONE';
      this.primaryAxisAlignItems = 'MIN';
      this.counterAxisAlignItems = 'MIN';
      this.primaryAxisSizingMode = 'AUTO';
      this.counterAxisSizingMode = 'AUTO';
      this.itemSpacing = 0;
      // REAL Plugin API defaults, spelled exactly as Figma spells them. The
      // POLYGON incident (this mock returned REST's 'REGULAR_POLYGON', so the
      // test agreed with the bug for six dump versions) is why these are
      // written from the API docs and not from what the dump happens to read:
      // layoutWrap is 'NO_WRAP' | 'WRAP', counterAxisSpacing is null when it
      // FOLLOWS itemSpacing, counterAxisAlignContent is 'AUTO' | 'SPACE_BETWEEN'.
      this._layoutWrap = 'NO_WRAP';
      // NOT null. `null` is WRITE-ONLY on counterAxisSpacing — the Plugin API
      // says "Set this property to null to have it sync with itemSpacing. This
      // will never return null." A read always yields a number, and the SYNC
      // state reads as a number EQUAL to itemSpacing. The first cut of this
      // mock defaulted it to null, which made the dump's "following spacing"
      // branch untestable: `typeof null !== 'number'` passed for a state Figma
      // cannot produce, so the assertion proved nothing about the real one.
      // That is the POLYGON incident exactly (this mock returned REST's
      // 'REGULAR_POLYGON' and the test agreed with the bug for six dump
      // versions) — in the very field whose comment claims to have learned it.
      this.counterAxisSpacing = 0;
      this.counterAxisAlignContent = 'AUTO';
      this.paddingTop = 0;
      this.paddingRight = 0;
      this.paddingBottom = 0;
      this.paddingLeft = 0;
      this._lsH = 'HUG';
      this._lsV = 'HUG';
      this.layoutPositioning = 'AUTO';
      this.constraints = { horizontal: 'MIN', vertical: 'MIN' };
      this.minWidth = null;
      this.maxWidth = null;
      this.minHeight = null;
      this.maxHeight = null;
      this.clipsContent = true;
      this.description = '';
      this.boundVariables = {};
      this.componentPropertyReferences = {};
      this._reactions = [];
      this._shared = new Map();
      if (type !== 'TEXT') this.children = [];
      if (type === 'TEXT') {
        this.characters = '';
        // REAL-FIGMA VALIDATION (live finding 2026-07-22, Astryx genesis run):
        // TextNode.fontSize refuses values < 1 — the lenient mock let a
        // rem-parsed 0.875 through every headless gate and the real canvas
        // threw 'Property "fontSize" failed validation'. Same message here.
        this._fontSize = 16;
        Object.defineProperty(this, 'fontSize', {
          get() { return this._fontSize; },
          set(v) {
            if (!(typeof v === 'number' && v >= 1)) {
              throw new Error('in set_fontSize: Property "fontSize" failed validation: Number must be greater than or equal to 1');
            }
            this._fontSize = v;
          },
        });
        this.fontName = { family: 'Inter', style: 'Regular' };
        this.letterSpacing = { unit: 'PERCENT', value: 0 };
        this.lineHeight = { unit: 'AUTO' };
        this.textCase = 'ORIGINAL';
        this.textDecoration = 'NONE';
        this.textAlignHorizontal = 'LEFT';
        this.textStyleId = '';
      }
      if (type === 'COMPONENT' || type === 'COMPONENT_SET') {
        this._propDefs = {};
        this._propSeq = 0;
      }
      if (type === 'SLOT') {
        // createSlot()'s own defaults, verbatim from probe 2b: 100×100, no
        // auto-layout, and a SOLID WHITE fill (NOT the empty fills a
        // createFrame starts with — an emitter that forgets to clear it ships
        // a white box where the contract asked for nothing).
        this.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        // FC-SLOT-BIRTH-BOX (measured live 2026-08-10, DS Contracts Testing
        // Card 1:459 / Body 67:10995): that 100×100 BIRTH BOX OUTLIVES the
        // sizing writes that should dissolve it. After the emitter set
        // layoutMode VERTICAL + primaryAxisSizingMode AUTO, the node reported
        // layoutSizingVertical === 'HUG' with ZERO children and 8+8 padding —
        // and still measured 100 tall, where hug is 16. Re-asserting HUG is a
        // no-op (Figma already believes it hugs); ONLY a FIXED resize
        // round-trip forces the relayout a childless slot never gets.
        // This mock computed hug honestly and so scored the card PERFECT
        // headlessly while the canvas shipped a 320×142 card against a 320×58
        // reference. A mock that is kinder than Figma is an alibi, not a test.
        this._birthBox = { w: true, h: true };
        this._w = 100;
        this._h = 100;
      }
      // COMPONENT only, NOT plain FRAME — and the difference is measured, not
      // assumed. The live evidence is a childless COMPONENT (MUI Divider
      // 83:1610, 288x100 where the library is 288x1) and a childless SLOT.
      // Asserting it for FRAME as well was an inference, and the canvas
      // refutes it: MUI Switch's childless FRAME children measure
      // switch-track 34x14 and switch-thumb 20x20 live (read from 21:612,
      // both FIXED), not 100x100. Modeling FRAME made the mock harsher than
      // Figma, which drove the track to 1x1 through the very re-measure this
      // work added and broke the mui compile receipt's 34x14 pin.
      if (type === 'COMPONENT') {
        // THE BIRTH BOX WAS NEVER A SLOT FACT. Measured live 2026-08-10 on MUI
        // Divider (set 83:1610) — a plain COMPONENT with zero children, zero
        // padding, layoutSizingVertical 'HUG': it measured 288×100 where the
        // library divider is 288×1. Modeling this ONLY on SLOT made this mock
        // structurally unable to see the divider defect, so the amend-path hole
        // below could not have been caught here — the same "kinder than Figma"
        // alibi that shipped the 320×142 card. The box is honored only while
        // the axis reports HUG (a FILL or FIXED axis is driven by the parent or
        // by an explicit resize, and neither consults it) and it is dissolved
        // by the first relayout: an appended child or a resize.
        this._birthBox = { w: true, h: true };
      }
    }

    // --- NATIVE SLOTS (Figma Schema 2025) ----------------------------------
    // Modeled from docs/research/slots-recon-probes.md, refusals included.
    // The three facts this harness must never let regress:
    //   · createSlot lives on ComponentNode ONLY (2a)
    //   · a slot layer RENAME renames its linked SLOT property (2b)
    //   · instance slot content rides the PROPERTY ID, not the slot node —
    //     it survives node replacement when the rebuilt slot is rebound (2d)
    createSlot() {
      if (this.type !== 'COMPONENT') {
        throw new Error(
          `createSlot is not a function on a ${this.type} — SlotNode can only be created on a ComponentNode ` +
          '(probe 2a: typeof frame.createSlot / set.createSlot === "undefined")',
        );
      }
      const slot = new MockNode('SLOT');
      slot._name = 'Slot';
      this.appendChild(slot);
      const owner = this._slotPropertyOwner();
      const key = owner.addComponentProperty('Slot', 'SLOT', '');
      // A SLOT definition carries no defaultValue — its keys are exactly
      // type/description/preferredValues (probe 2b readback).
      owner._propDefs[key] = { type: 'SLOT', description: null, preferredValues: [] };
      slot.componentPropertyReferences = { slotContentId: key };
      return slot;
    }

    /** The node that OWNS component properties for this component: the set
     *  when it is a variant (probe 2c — slots lift to set level), else itself. */
    _slotPropertyOwner() {
      return this.parent?.type === 'COMPONENT_SET' ? this.parent : this;
    }

    resetSlot() {
      if (this.type !== 'SLOT') throw new Error(`resetSlot is not a function on a ${this.type}`);
      this.children = [];
    }

    /** The INSTANCE this node lives inside, if any (slot fills are recorded
     *  per instance, keyed by property id — probe 2d's parentless backing
     *  frame, modeled as a map). */
    _owningInstance() {
      for (let n = this; n; n = n.parent) if (n.type === 'INSTANCE') return n;
      return null;
    }

    /** Renaming a SLOT layer renames the linked property, keeping its ID
     *  (probe 2b: `Slot#4:378` → `Content#4:378`). Every node bound to the old
     *  key follows — in real Figma the key is derived, here it is rewritten. */
    _renameSlotProperty(next) {
      const key = this.componentPropertyReferences?.slotContentId;
      if (!key || !key.includes('#')) return;
      const id = key.slice(key.indexOf('#') + 1);
      const nextKey = `${next}#${id}`;
      if (nextKey === key) return;
      let owner = null;
      for (let n = this.parent; n; n = n.parent) {
        if ((n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n._propDefs?.[key]) { owner = n; break; }
        if (n.type === 'COMPONENT' && n._slotPropertyOwner()._propDefs?.[key]) { owner = n._slotPropertyOwner(); break; }
      }
      if (!owner) return;
      owner._propDefs[nextKey] = owner._propDefs[key];
      delete owner._propDefs[key];
      for (const n of [owner, ...owner.findAll()]) {
        if (n.componentPropertyReferences?.slotContentId === key) {
          n.componentPropertyReferences = { ...n.componentPropertyReferences, slotContentId: nextKey };
        }
      }
    }

    appendChild(node) {
      if (node.parent) {
        const i = node.parent.children.indexOf(node);
        if (i >= 0) node.parent.children.splice(i, 1);
      }
      node.parent = this;
      this.children.push(node);
      // FC-SLOT-BIRTH-BOX: a node with children HAS relaid out — that is
      // precisely why the box only ever survives on childless nodes, and why
      // the emitter's repair is scoped to `children.length === 0`.
      if (this._birthBox) this._birthBox = { w: false, h: false };
      // GRID auto-slot (P3): children appended to a MANUAL grid slot into the
      // first free cell in row-major order — deterministic. Overflow is
      // absorbed by GROWING the explicit row count (P9: append of a 5th child
      // onto a 2×2 grew gridRowCount to 3) — a write the contract did not
      // make, which is exactly what the emitted runtime's declaration guard
      // must catch. Under ROW_AUTO_FLOW anchors are computed from order.
      if (this._layoutMode === 'GRID' && this._gridItemsPositioning === 'MANUAL' && typeof node._gridRow !== 'number') {
        const rows = this._gridRows.length;
        const cols = this._gridCols.length;
        const taken = (r, c) => this.children.some((ch) => {
          if (ch === node || ch.layoutPositioning === 'ABSOLUTE') return false;
          if (typeof ch._gridRow !== 'number') return false;
          return r >= ch._gridRow && r < ch._gridRow + (ch._gridRowSpan ?? 1) &&
                 c >= ch._gridCol && c < ch._gridCol + (ch._gridColSpan ?? 1);
        });
        let slotted = false;
        for (let r = 0; r < rows && !slotted; r++) {
          for (let c = 0; c < cols && !slotted; c++) {
            if (!taken(r, c)) { node._gridRow = r; node._gridCol = c; slotted = true; }
          }
        }
        if (!slotted) {
          this._gridRows.push({ type: 'FLEX', value: 1 }); // P9 absorption
          node._gridRow = rows;
          node._gridCol = 0;
        }
      }
      // INSTANCE SLOT FILL (probe 2d): content appended into an instance's
      // slot is stored against the slot's PROPERTY ID — Figma keeps it in a
      // parentless backing frame, which is why it survives the slot node
      // being replaced and reappears the moment a rebuilt slot is rebound to
      // the same id. Modeled as a per-instance map so the survival invariant
      // is measurable headlessly instead of asserted.
      if (this.type === 'SLOT' && !this._restoringSlotFill) {
        const inst = this._owningInstance();
        const key = this.componentPropertyReferences?.slotContentId;
        if (inst && key) {
          inst._slotFills = inst._slotFills ?? {};
          inst._slotFills[key] = (inst._slotFills[key] ?? []).concat([node]);
        }
      }
    }

    insertChild(index, node) {
      this.appendChild(node);
      this.children.pop();
      this.children.splice(index, 0, node);
    }

    remove() {
      if (this.parent) {
        const i = this.parent.children.indexOf(this);
        if (i >= 0) this.parent.children.splice(i, 1);
      }
      this.parent = null;
      this.removed = true;
    }

    resize(w, h) {
      // G8/GP4b — on a GRID frame a resize that CHANGES a hugged axis silently
      // reverts BOTH the sizing mode (HUG -> FIXED) and that axis's HUG tracks
      // (-> FLEX). Measured live 2026-08-08. A width-only resize leaves a
      // hugged height alone (GP4c), so the revert is per-axis and value-gated:
      // this is what forces the emitter to write the hug LAST.
      if (this._layoutMode === 'GRID') {
        if (this._lsH === 'HUG' && w !== this.width) {
          this._lsH = 'FIXED';
          this._gridCols = this._gridCols.map((t) => (t.type === 'HUG' ? { type: 'FLEX', value: 1 } : t));
        }
        if (this._lsV === 'HUG' && h !== this.height) {
          this._lsV = 'FIXED';
          this._gridRows = this._gridRows.map((t) => (t.type === 'HUG' ? { type: 'FLEX', value: 1 } : t));
        }
      }
      this._w = w;
      this._h = h;
      this._resized = true;
      // FC-SLOT-BIRTH-BOX: the resize IS the relayout trigger. Measured live:
      // a Body slot pinned FIXED and resized to height 1 came back 16 — the
      // padding-only hug — not 1, so Figma re-measures on resize and the stale
      // birth box is gone for good from that point on.
      if (this._birthBox) this._birthBox = { w: false, h: false };
    }

    resizeWithoutConstraints(w, h) {
      this.resize(w, h);
    }

    // --- GRID layout mode (A2; docs/research/grid-recon-probes.md P1-P14) --
    // Modeled from the LIVE probe receipts, refusals included — a mock that
    // accepts what Figma refuses is an alibi, not a test (the layoutWrap
    // lesson below, applied in advance). What is enforced:
    //   · sizes-vs-count length validation with the P2 error text
    //   · the FLEX|FIXED|HUG enum fence + min/max key refusal (P2b/P6)
    //   · SILENT zero normalization (P2b: 0px snaps, 0fr clamps) — the write
    //     hazard the schema exists to fence out
    //   · anchors as READ-ONLY getters; placement via the child-side
    //     setGridChildPosition only, refused under ROW_AUTO_FLOW (P3/P5)
    //   · span bounds + occupancy throws with the P3 error texts
    //   · the align enum fence (STRETCH/BASELINE rejected, P3)
    //   · P10 mode-switch destruction (tracks reset on entering GRID, clear
    //     on leaving) and P9 overflow absorption (see appendChild).
    set layoutMode(v) {
      // Probe 2b, verbatim: a slot's own interior cannot be a grid.
      if (v === 'GRID' && this.type === 'SLOT') {
        throw new Error('in set_layoutMode: GRID layoutMode cannot be applied to Slot frames');
      }
      const prev = this._layoutMode;
      this._layoutMode = v;
      if (v === 'GRID' && prev !== 'GRID') {
        // P1 fresh-grid defaults; P10: prior tracks never survive the switch.
        this._gridRows = [{ type: 'FLEX', value: 1 }, { type: 'FLEX', value: 1 }];
        this._gridCols = [{ type: 'FLEX', value: 1 }, { type: 'FLEX', value: 1 }];
        this.gridRowGap = 0;
        this.gridColumnGap = 0;
        this._gridItemsPositioning = 'MANUAL';
        this._gridAutoTracks = 'NONE';
      }
      if (v !== 'GRID' && prev === 'GRID') {
        this._gridRows = []; // P10: gridColumnSizes reads [] off-grid
        this._gridCols = [];
      }
    }

    get layoutMode() {
      return this._layoutMode ?? 'NONE';
    }

    _validateGridTracks(sizes, field, count) {
      if (!Array.isArray(sizes)) {
        throw new Error(`in set_${field}: Expected an array of grid track sizes`);
      }
      if (sizes.length !== count) {
        throw new Error(
          `in set_${field}: Grid track sizes must be the same length as the grid ${field === 'gridRowSizes' ? 'row' : 'column'} count`,
        );
      }
      return sizes.map((t, i) => {
        if (!t || typeof t !== 'object') {
          throw new Error(`in set_${field}: Property '${field}' failed validation at index ${i}`);
        }
        const extra = Object.keys(t).filter((k) => k !== 'type' && k !== 'value');
        if (extra.length > 0) {
          throw new Error(
            `in set_${field}: Property '${field}' failed validation: Unrecognized key(s) in object: ${extra.map((k) => `'${k}'`).join(', ')} at index ${i}`,
          );
        }
        if (t.type !== 'FIXED' && t.type !== 'FLEX' && t.type !== 'HUG') {
          throw new Error(
            `in set_${field}: Invalid enum value. Expected 'FLEX' | 'FIXED' | 'HUG', received '${t.type}'`,
          );
        }
        // P2b: zero writes are ACCEPTED and silently rewritten — the exact
        // hazard. FIXED 0 snaps to the track's rendered px (modeled as 100);
        // FLEX 0 clamps to 1fr. HUG's value reads back as noise 1.
        if (t.type === 'FIXED' && t.value === 0) return { type: 'FIXED', value: 100 };
        if (t.type === 'FLEX' && t.value === 0) return { type: 'FLEX', value: 1 };
        // FC-GRID-HUG-VALUE (live probe, 2026-08-08): READ and WRITE are not
        // symmetric. {type:'HUG'} round-trips as {type:'HUG', value:1} — but
        // WRITING {type:'HUG', value:1} makes the API reinterpret the entry
        // as FIXED at that value, and no later HUG write recovers it. The
        // mock modeled only the read noise, so every emitter that mirrored
        // the read shape back into a write looked correct headlessly while
        // silently shipping a 1px fixed track to the canvas.
        if (t.type === 'HUG') {
          return Object.prototype.hasOwnProperty.call(t, 'value') && t.value !== undefined
            ? { type: 'FIXED', value: t.value }
            : { type: 'HUG', value: 1 };
        }
        return { type: t.type, value: t.value };
      });
    }

    get gridRowCount() { return this._gridRows.length; }
    set gridRowCount(n) {
      // P2c: growing the count appends {FLEX,1} tracks; it never invents FIXED.
      while (this._gridRows.length < n) this._gridRows.push({ type: 'FLEX', value: 1 });
      this._gridRows.length = Math.min(this._gridRows.length, n);
    }
    get gridColumnCount() { return this._gridCols.length; }
    set gridColumnCount(n) {
      while (this._gridCols.length < n) this._gridCols.push({ type: 'FLEX', value: 1 });
      this._gridCols.length = Math.min(this._gridCols.length, n);
    }
    get gridRowSizes() { return this._gridRows.map((t) => ({ ...t })); }
    set gridRowSizes(sizes) {
      this._gridRows = this._validateGridTracks(sizes, 'gridRowSizes', this._gridRows.length);
    }
    get gridColumnSizes() { return this._gridCols.map((t) => ({ ...t })); }
    set gridColumnSizes(sizes) {
      this._gridCols = this._validateGridTracks(sizes, 'gridColumnSizes', this._gridCols.length);
    }
    get gridItemsPositioning() { return this._gridItemsPositioning; }
    set gridItemsPositioning(v) {
      if (v !== 'MANUAL' && v !== 'ROW_AUTO_FLOW') {
        throw new Error(`in set_gridItemsPositioning: Invalid enum value. Expected 'MANUAL' | 'ROW_AUTO_FLOW', received '${v}'`);
      }
      this._gridItemsPositioning = v;
    }
    get gridAutoTracks() { return this._gridAutoTracks; }
    set gridAutoTracks(v) {
      if (v !== 'NONE' && v !== 'ROWS') {
        throw new Error(`in set_gridAutoTracks: Invalid enum value. Expected 'NONE' | 'ROWS', received '${v}'`);
      }
      this._gridAutoTracks = v;
    }

    // Child-side placement — the ONE setter (P3: a method on the CHILD; the
    // parent spelling throws 'Node is not a grid child').
    setGridChildPosition(rowIndex, columnIndex) {
      const p = this.parent;
      if (!p || p.layoutMode !== 'GRID') throw new Error('Node is not a grid child');
      if (p.gridItemsPositioning === 'ROW_AUTO_FLOW') {
        throw new Error(
          'cannot set grid child position directly inside of a grid with automatically positioned items, use parent.insertChild() instead',
        );
      }
      // FC-GRID-APPEND-AUTOPLACE (live probe, 2026-08-08): appendChild does
      // NOT park a grid child nowhere — the canvas auto-places it row-major
      // into the next free cell, so by the time an emitter places anything
      // every sibling already OCCUPIES a cell. A one-pass "place them all in
      // contract order" therefore hits P3's occupancy throw on the canonical
      // bento's SECOND child. The mock previously defaulted unplaced anchors
      // to (0,0) and never collided, so the bento eval was green against a
      // canvas that could not build it.
      const holder = p.children.find(
        (c) =>
          c !== this &&
          c.layoutPositioning !== 'ABSOLUTE' &&
          c.gridRowAnchorIndex === rowIndex &&
          c.gridColumnAnchorIndex === columnIndex,
      );
      if (holder) {
        throw new Error(
          "in setGridChildPosition: Cannot set grid child position: Can't place child at this position because it is occupied by another node",
        );
      }
      this._gridRow = rowIndex;
      this._gridCol = columnIndex;
    }
    // Anchors are READ-ONLY getters (P3). Under ROW_AUTO_FLOW they report
    // row-major order-computed cells (P5) — including beyond the declared
    // rows (P9's lossy readback). QUIRK kept faithfully: ABSOLUTE children
    // still report anchors (P13) — readers must gate.
    _autoFlowAnchor() {
      const p = this.parent;
      const cols = Math.max(1, p._gridCols.length);
      const inFlow = p.children.filter((c) => c.layoutPositioning !== 'ABSOLUTE');
      const i = Math.max(0, inFlow.indexOf(this));
      return { row: Math.floor(i / cols), col: i % cols };
    }
    get gridRowAnchorIndex() {
      const p = this.parent;
      if (!p || p.layoutMode !== 'GRID') return 0;
      if (p.gridItemsPositioning === 'ROW_AUTO_FLOW') return this._autoFlowAnchor().row;
      return this._gridRow ?? 0;
    }
    get gridColumnAnchorIndex() {
      const p = this.parent;
      if (!p || p.layoutMode !== 'GRID') return 0;
      if (p.gridItemsPositioning === 'ROW_AUTO_FLOW') return this._autoFlowAnchor().col;
      return this._gridCol ?? 0;
    }

    _setGridSpan(axis, n) {
      const p = this.parent;
      if (!p || p.layoutMode !== 'GRID') throw new Error('Node is not a grid child');
      const word = axis === 'row' ? 'Row' : 'Column';
      const count = axis === 'row' ? p._gridRows.length : p._gridCols.length;
      if (n > count) throw new Error(`${word} span exceeds grid ${axis} count`);
      const r = this._gridRow ?? 0;
      const c = this._gridCol ?? 0;
      const rs = axis === 'row' ? n : (this._gridRowSpan ?? 1);
      const cs = axis === 'row' ? (this._gridColSpan ?? 1) : n;
      for (const sib of p.children) {
        if (sib === this || sib.layoutPositioning === 'ABSOLUTE' || typeof sib._gridRow !== 'number') continue;
        const sr = sib._gridRow, sc = sib._gridCol;
        const srs = sib._gridRowSpan ?? 1, scs = sib._gridColSpan ?? 1;
        if (r < sr + srs && sr < r + rs && c < sc + scs && sc < c + cs) {
          throw new Error(
            `Cannot set child to specified ${axis} span due to existing children in adjacent ${axis}s`,
          );
        }
      }
      if (axis === 'row') this._gridRowSpan = n; else this._gridColSpan = n;
    }
    get gridRowSpan() { return this._gridRowSpan ?? 1; }
    set gridRowSpan(n) { this._setGridSpan('row', n); }
    get gridColumnSpan() { return this._gridColSpan ?? 1; }
    set gridColumnSpan(n) { this._setGridSpan('column', n); }

    get gridChildHorizontalAlign() { return this._gridHAlign ?? 'AUTO'; }
    set gridChildHorizontalAlign(v) {
      if (v !== 'AUTO' && v !== 'MIN' && v !== 'CENTER' && v !== 'MAX') {
        throw new Error(`in set_gridChildHorizontalAlign: Invalid enum value. Expected 'AUTO' | 'MIN' | 'CENTER' | 'MAX', received '${v}'`);
      }
      this._gridHAlign = v;
    }
    get gridChildVerticalAlign() { return this._gridVAlign ?? 'AUTO'; }
    set gridChildVerticalAlign(v) {
      if (v !== 'AUTO' && v !== 'MIN' && v !== 'CENTER' && v !== 'MAX') {
        throw new Error(`in set_gridChildVerticalAlign: Invalid enum value. Expected 'AUTO' | 'MIN' | 'CENTER' | 'MAX', received '${v}'`);
      }
      this._gridVAlign = v;
    }

    // Track pixel resolution for the cell-size model: FIXED = its px, FLEX =
    // its share of the free space (P2's minmax(0,Nfr) semantics), HUG = 0
    // (content sizing is out of the mock's scope). Gap-corrected exactly as
    // P4 verified ((500-10)/2 × (240-10)/2).
    _gridTrackPx(tracks, total, gap, hugPx) {
      const hug = hugPx ?? tracks.map(() => 0);
      const fixed = tracks.reduce(
        (a, t, i) => a + (t.type === 'FIXED' ? t.value : t.type === 'HUG' ? hug[i] : 0),
        0,
      );
      const frTotal = tracks.reduce((a, t) => a + (t.type === 'FLEX' ? t.value : 0), 0);
      const free = Math.max(0, total - fixed - gap * Math.max(0, tracks.length - 1));
      return tracks.map((t, i) =>
        t.type === 'FIXED' ? t.value
        : t.type === 'HUG' ? hug[i]
        : t.type === 'FLEX' && frTotal > 0 ? (free * t.value) / frTotal
        : 0,
      );
    }
    // --- G8: an INTRINSICALLY SIZED grid axis (probes GP1-GP13, 2026-08-08) --
    // layoutSizing{Horizontal,Vertical} were plain assignable fields, so the
    // canvas's two hard facts about hugging a GRID frame were both invisible
    // headlessly: (a) hugging an axis that carries a FLEX track NORMALIZES
    // every FLEX track on that axis to HUG and the fr ratio is silently gone
    // (GP1/GP5/GP12), and (b) an axis with no FLEX track hugs exactly, leaving
    // the OTHER axis's tracks untouched (GP2/GP3/GP13). Modeled as accessors so
    // an emitter that hugs the wrong axis produces a visibly wrong track list
    // instead of a green field write.
    set layoutSizingHorizontal(v) {
      if (v === 'HUG' && this._layoutMode === 'GRID') {
        this._gridCols = this._gridCols.map((t) => (t.type === 'FLEX' ? { type: 'HUG', value: 1 } : t));
      }
      this._lsH = v;
    }
    get layoutSizingHorizontal() {
      return this._lsH;
    }
    set layoutSizingVertical(v) {
      if (v === 'HUG' && this._layoutMode === 'GRID') {
        this._gridRows = this._gridRows.map((t) => (t.type === 'FLEX' ? { type: 'HUG', value: 1 } : t));
      }
      this._lsV = v;
    }
    get layoutSizingVertical() {
      return this._lsV;
    }

    // A HUG track measures the tallest/widest child anchored in it. The child's
    // INTRINSIC size is used, never its cell size — a cell lookup would close the
    // loop the canvas itself refuses to solve (GP14: FILL on a hugged axis is
    // circular and Figma freezes the stale box, which is why the emitter hugs
    // such children instead of filling them, G3′). A FILL child that reaches
    // here contributes its own last measure, exactly as the canvas fixed point
    // does, rather than the 0 the flex rule in _intrinsicSize would give.
    _gridHugTrackPx(axis, depth) {
      const tracks = axis === 'w' ? this._gridCols : this._gridRows;
      const out = tracks.map(() => 0);
      for (const ch of this.children ?? []) {
        if (ch.visible === false || ch.layoutPositioning === 'ABSOLUTE') continue;
        const anchor = axis === 'w' ? ch.gridColumnAnchorIndex : ch.gridRowAnchorIndex;
        if (typeof anchor !== 'number') continue;
        const span = axis === 'w' ? (ch._gridColSpan ?? 1) : (ch._gridRowSpan ?? 1);
        if (span !== 1) continue; // a spanning child sizes no single track alone
        if (tracks[anchor]?.type !== 'HUG') continue;
        out[anchor] = Math.max(out[anchor], ch._intrinsicSize(axis, (depth ?? 0) + 1));
      }
      return out;
    }

    _gridCellSize(axis) {
      const p = this.parent;
      const tracks = axis === 'w' ? p._gridCols : p._gridRows;
      const gap = axis === 'w' ? p.gridColumnGap : p.gridRowGap;
      const total = axis === 'w' ? p.width : p.height;
      const anchor = axis === 'w' ? this.gridColumnAnchorIndex : this.gridRowAnchorIndex;
      const span = axis === 'w' ? (this._gridColSpan ?? 1) : (this._gridRowSpan ?? 1);
      const px = this._gridTrackPx(tracks, total, gap, p._gridHugTrackPx(axis, 0));
      let size = gap * Math.max(0, span - 1);
      for (let i = anchor; i < Math.min(anchor + span, px.length); i++) size += px[i];
      return size;
    }

    // --- layoutWrap ENFORCES the Plugin API's own precondition --------------
    // "This property can only be set on layers with layoutMode === 'HORIZONTAL'.
    // Setting it on layers without this property will throw an Error."
    // A plain assignable field let core/emit-figma-script.ts write layoutWrap
    // onto a VERTICAL stack from v15 onward with every gate green — the
    // contract `layout: { direction: 'column', wrap: true }` is legal CSS and
    // schema-valid, and it killed the whole generate run on a real canvas.
    // A mock that accepts what Figma refuses is not a test, it is an alibi.
    set layoutWrap(value) {
      if (value === 'WRAP' && this.layoutMode !== 'HORIZONTAL') {
        throw new Error(
          `layoutWrap can only be set on layers with layoutMode === "HORIZONTAL" (got "${this.layoutMode}")`,
        );
      }
      this._layoutWrap = value;
    }

    get layoutWrap() {
      return this._layoutWrap ?? 'NO_WRAP';
    }

    // --- computed auto-layout sizing (see the fidelity note above) ----------
    // Real Figma derives an AUTO-sized auto-layout frame's box from its
    // children; a FILL child contributes no intrinsic size on that axis. The
    // old mock's constant 100×100 made a collapsed frame indistinguishable
    // from a healthy one — the exact class the live composite dialog fell in.
    _measureText(axis) {
      if (this._resized) return axis === 'w' ? this._w : this._h;
      const size = this.fontSize || 16;
      return axis === 'w'
        ? Math.round(String(this.characters ?? '').length * size * 0.6)
        : Math.round(size * 1.4);
    }

    _intrinsicSize(axis, depth) {
      if (depth > 32) return 0; // cycle guard — never expected, never fatal
      if (this.type === 'TEXT') return this._measureText(axis);
      const fillField = axis === 'w' ? 'layoutSizingHorizontal' : 'layoutSizingVertical';
      // A GRID frame's box is its own (tracks divide it; children never sum
      // into it) — the flex hug math below would be an invented fact here.
      // EXCEPT on an axis the contract declared intrinsic (G8): there the box
      // IS the resolved track list plus gaps plus padding (GP2/GP3/GP13).
      if (this.layoutMode === 'GRID') {
        const hugged = axis === 'w' ? this._lsH === 'HUG' : this._lsV === 'HUG';
        if (!hugged) return axis === 'w' ? this._w : this._h;
        const tracks = axis === 'w' ? this._gridCols : this._gridRows;
        const gap = axis === 'w' ? this.gridColumnGap : this.gridRowGap;
        const pad = axis === 'w'
          ? this.paddingLeft + this.paddingRight
          : this.paddingTop + this.paddingBottom;
        const px = this._gridTrackPx(tracks, 0, gap, this._gridHugTrackPx(axis, depth));
        const sum = px.reduce((a, b) => a + b, 0) + gap * Math.max(0, tracks.length - 1);
        return sum + pad;
      }
      if (this.layoutMode === 'NONE' || !this.children || this.children.length === 0) {
        return axis === 'w' ? this._w : this._h;
      }
      const horizontalIsPrimary = this.layoutMode === 'HORIZONTAL';
      const axisIsPrimary = (axis === 'w') === horizontalIsPrimary;
      const sizingMode = axisIsPrimary ? this.primaryAxisSizingMode : this.counterAxisSizingMode;
      if (sizingMode === 'FIXED') return axis === 'w' ? this._w : this._h;
      const pad = axis === 'w' ? this.paddingLeft + this.paddingRight : this.paddingTop + this.paddingBottom;
      const inFlow = this.children.filter((c) => c.visible !== false && c.layoutPositioning !== 'ABSOLUTE');
      // The degenerate: a FILL child has no intrinsic contribution — a HUG
      // parent whose every child FILLs resolves to padding alone (~collapse).
      const contribs = inFlow.map((c) => (c[fillField] === 'FILL' ? 0 : c._intrinsicSize(axis, depth + 1)));
      const content = axisIsPrimary
        ? contribs.reduce((a, b) => a + b, 0) + this.itemSpacing * Math.max(0, inFlow.length - 1)
        : contribs.reduce((a, b) => Math.max(a, b), 0);
      const min = axis === 'w' ? this.minWidth : this.minHeight;
      const max = axis === 'w' ? this.maxWidth : this.maxHeight;
      // MOLECULE LIVE-DEFECT ROUND (round 6): min/max sizing CLAMP the
      // computed box in real Figma. The mock modelled `min` only, so a
      // `maxWidth`-bound hugging box (the new max-width lowering: MUI's
      // Tooltip bubble, MUI's Tab) was unmeasurable headlessly.
      return Math.min(Math.max(content + pad, min ?? 0), max ?? Infinity);
    }

    // The mock had NO absoluteBoundingBox at all, so the dump's `abs` block —
    // and with it EVERY absolutely-placed fact: offsets, sizes and constraints
    // — could never fire here. A whole capture path was untestable, which is
    // how a 3-of-5 constraint map (STRETCH and SCALE silently dropped) lived
    // behind a green plugin gate. Absolute position is the accumulated x/y up
    // the parent chain, which is what Figma reports.
    get absoluteBoundingBox() {
      let x = this.x;
      let y = this.y;
      let p = this.parent;
      while (p && typeof p.x === 'number') {
        x += p.x;
        y += p.y;
        p = p.parent;
      }
      return { x, y, width: this.width, height: this.height };
    }

    get width() {
      // FC-SLOT-BIRTH-BOX: while the birth box stands, the node measures 100
      // no matter what HUG claims. See the constructor. Gated on HUG: a FILL
      // axis is measured by the parent and a FIXED axis by its own resize, and
      // neither reads the stale box.
      if (this._birthBox?.w && this._lsH === 'HUG') return this._w;
      // REAL-FIGMA CONTRACT (round 6, live Dialog finding): an ABSOLUTELY
      // POSITIONED child is OUT of the auto-layout flow — FILL sizing does
      // not apply to it (Figma converts the sizing back to FIXED the moment
      // layoutPositioning becomes ABSOLUTE, and constraints take over). The
      // lenient mock honored FILL anyway, so Dialog's inset:0 backdrop
      // measured a perfect full-bleed layer headlessly while the real canvas
      // drew the SQUAT GREY BAND the owner photographed. Absolute children
      // now measure by their own box, exactly like the canvas.
      if (
        this.layoutSizingHorizontal === 'FILL' &&
        this.layoutPositioning !== 'ABSOLUTE' &&
        this.parent?.layoutMode === 'GRID'
      ) {
        // A FILL grid child fills its CELL AREA, not the parent box (P4's
        // gap-corrected cell math, verified live: (500-10)/2 × (240-10)/2).
        return this._gridCellSize('w');
      }
      if (
        this.layoutSizingHorizontal === 'FILL' &&
        this.layoutPositioning !== 'ABSOLUTE' &&
        this.parent?.layoutMode && this.parent.layoutMode !== 'NONE'
      ) {
        return Math.max(0, this.parent.width - this.parent.paddingLeft - this.parent.paddingRight);
      }
      return this._intrinsicSize('w', 0);
    }

    set width(v) {
      this._w = v;
    }

    get height() {
      // FC-SLOT-BIRTH-BOX: see the width getter and the constructor.
      if (this._birthBox?.h && this._lsV === 'HUG') return this._h;
      // See the width getter: ABSOLUTE children never FILL (round 6).
      if (
        this.layoutSizingVertical === 'FILL' &&
        this.layoutPositioning !== 'ABSOLUTE' &&
        this.parent?.layoutMode === 'GRID'
      ) {
        return this._gridCellSize('h'); // cell area, not parent box (P4)
      }
      if (
        this.layoutSizingVertical === 'FILL' &&
        this.layoutPositioning !== 'ABSOLUTE' &&
        this.parent?.layoutMode && this.parent.layoutMode !== 'NONE'
      ) {
        return Math.max(0, this.parent.height - this.parent.paddingTop - this.parent.paddingBottom);
      }
      return this._intrinsicSize('h', 0);
    }

    set height(v) {
      this._h = v;
    }

    // --- prototype reactions (see the fidelity note above) -----------------
    get reactions() {
      return this._reactions;
    }

    set reactions(_v) {
      throw new Error(
        'in set_reactions: reactions is read-only; use setReactionsAsync to update the value',
      );
    }

    async setReactionsAsync(reactions) {
      if (!Array.isArray(reactions)) {
        throw new Error('in setReactionsAsync: expected an array of Reaction');
      }
      const owner = this.parent && this.parent.type === 'COMPONENT_SET' ? this.parent : null;
      for (const r of reactions) {
        if (!r || typeof r !== 'object') throw new Error('in setReactionsAsync: expected a Reaction object');
        if (r.trigger !== null && (!r.trigger || typeof r.trigger.type !== 'string')) {
          throw new Error('in setReactionsAsync: Reaction.trigger must be a Trigger or null');
        }
        const actions = r.actions ?? (r.action ? [r.action] : []);
        for (const a of actions) {
          if (!a || a.type !== 'NODE') continue;
          if (a.navigation !== 'CHANGE_TO') continue;
          // Real Figma refuses a CHANGE_TO whose destination is not a
          // sibling variant of the SAME component set — a variant swap is
          // intra-set by definition. Refuse BY NAME.
          const dest = a.destinationId ? root.findOne((n) => n.id === a.destinationId) : null;
          if (!dest) {
            throw new Error(
              `in setReactionsAsync: CHANGE_TO destinationId "${a.destinationId}" does not resolve to a node in this file`,
            );
          }
          if (!owner || dest.parent !== owner) {
            throw new Error(
              `in setReactionsAsync: CHANGE_TO destination "${dest.name}" is not a variant of the same component set as "${this.name}" (navigation CHANGE_TO requires sibling variants)`,
            );
          }
        }
      }
      this._reactions = reactions.map((r) => ({ ...r }));
    }

    setSharedPluginData(namespace, key, value) {
      this._shared.set(`${namespace}/${key}`, value);
    }

    getSharedPluginData(namespace, key) {
      return this._shared.get(`${namespace}/${key}`) ?? '';
    }

    setBoundVariable(field, variable) {
      this.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id };
      // Real Figma REFLECTS the bound variable's value onto the property —
      // a FLOAT variable bound to topLeftRadius changes the rendered radius.
      // (MUI round live-paste-2: the mock recorded the alias only, so the
      // thumb radius pin read 0 while the real canvas would draw 10.)
      try {
        const r = variable.resolveForConsumer?.();
        if (r && r.resolvedType === 'FLOAT' && typeof r.value === 'number' && !NUMERIC_REFLECT_EXCLUDE.has(field)) {
          this[field] = r.value;
        }
      } catch { /* non-resolvable — alias recorded, value untouched */ }
    }

    findOne(cb) {
      for (const n of this.findAll()) if (cb(n)) return n;
      return null;
    }

    findAll(cb) {
      const out = [];
      const walk = (node) => {
        for (const child of node.children ?? []) {
          out.push(child);
          walk(child);
        }
      };
      walk(this);
      return cb ? out.filter(cb) : out;
    }

    findAllWithCriteria({ types }) {
      return this.findAll((n) => types.includes(n.type));
    }

    // --- component properties ---------------------------------------------
    // REAL-API contract (2026-07-21): non-variant properties belong to the
    // COMPONENT_SET (or a standalone COMPONENT). A variant child refuses both
    // definition reads and property minting — real Figma throws here, and the
    // old mock's lenient set-level hoist of variant-minted defs is exactly
    // what let the live "set-instance text not applied" bug pass 146 gates.
    get variantProperties() {
      if (this.type !== 'COMPONENT' || this.parent?.type !== 'COMPONENT_SET') {
        return null;
      }
      const tuple = {};
      for (const seg of String(this.name).split(',')) {
        const [axis, value] = seg.split('=').map((part) => part?.trim());
        if (axis && value !== undefined) tuple[axis] = value;
      }
      return Object.keys(tuple).length > 0 ? tuple : null;
    }

    get componentPropertyDefinitions() {
      if (this.type === 'COMPONENT' && this.parent?.type === 'COMPONENT_SET') {
        throw new Error(
          'Cannot get componentPropertyDefinitions on a variant — read them on the component set',
        );
      }
      if (this.type === 'COMPONENT_SET') {
        // Variant axes ride the children names, mirrored as VARIANT defs.
        const defs = { ...this._propDefs };
        const axes = new Map();
        for (const ch of this.children ?? []) {
          for (const seg of String(ch.name).split(',')) {
            const [axis, value] = seg.split('=').map((s) => s?.trim());
            if (!axis || value === undefined) continue;
            if (!axes.has(axis)) axes.set(axis, new Set());
            axes.get(axis).add(value);
          }
        }
        for (const [axis, values] of axes) {
          defs[axis] = { type: 'VARIANT', defaultValue: [...values][0], variantOptions: [...values] };
        }
        return defs;
      }
      return { ...this._propDefs };
    }

    addComponentProperty(name, type, defaultValue, opts) {
      if (this.type === 'COMPONENT' && this.parent?.type === 'COMPONENT_SET') {
        throw new Error(
          `Cannot add component property "${name}" on a variant — add it to the component set`,
        );
      }
      const key = type === 'VARIANT' ? name : `${name}#${this.id}:${this._propSeq++}`;
      this._propDefs[key] = { type, defaultValue, ...(opts?.preferredValues ? { preferredValues: opts.preferredValues } : {}) };
      return key;
    }

    deleteComponentProperty(key) {
      if (this._propDefs?.[key]) {
        delete this._propDefs[key];
        return;
      }
      for (const ch of this.children ?? []) {
        if (ch._propDefs?.[key]) {
          delete ch._propDefs[key];
          return;
        }
      }
      throw new Error(`deleteComponentProperty: no property ${key}`);
    }

    editComponentProperty(key, patch) {
      if (this._propDefs[key]) {
        Object.assign(this._propDefs[key], patch);
        return key;
      }
      // Set-level edits reach variant-defined properties in real Figma.
      for (const ch of this.children ?? []) {
        if (ch._propDefs?.[key]) {
          Object.assign(ch._propDefs[key], patch);
          return key;
        }
      }
      throw new Error(`editComponentProperty: no property ${key}`);
    }

    // --- component/instance ------------------------------------------------
    get defaultVariant() {
      return this.children?.[0] ?? null;
    }

    // Deep-clone the main component's subtree so an instance CARRIES its
    // rendered content — real instances do, and reflecting a TEXT property
    // onto the bound text node's characters is only observable if the nodes
    // exist. The old `children: []` stub made every text-binding failure
    // invisible headlessly.
    _cloneForInstance() {
      const clone = new MockNode(this.type === 'COMPONENT' || this.type === 'COMPONENT_SET' ? 'FRAME' : this.type);
      for (const field of [
        'name', 'visible', 'opacity', 'rotation', 'fills', 'strokes', 'strokeWeight', 'strokeAlign',
        'effects', 'cornerRadius', 'layoutMode', 'primaryAxisAlignItems', 'counterAxisAlignItems',
        'primaryAxisSizingMode', 'counterAxisSizingMode', 'itemSpacing',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'layoutSizingHorizontal', 'layoutSizingVertical', 'layoutPositioning', 'constraints',
        'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'clipsContent',
        '_w', '_h', '_resized', 'x', 'y',
      ]) {
        if (this[field] !== undefined) clone[field] = this[field];
      }
      // GRID facts survive instancing (P12: instances place, span and fill
      // in cells natively) — deep copies, never shared track arrays.
      if (this._layoutMode === 'GRID') {
        clone._gridRows = this._gridRows.map((t) => ({ ...t }));
        clone._gridCols = this._gridCols.map((t) => ({ ...t }));
        clone._gridItemsPositioning = this._gridItemsPositioning;
        clone._gridAutoTracks = this._gridAutoTracks;
        clone.gridRowGap = this.gridRowGap;
        clone.gridColumnGap = this.gridColumnGap;
      }
      for (const gf of ['_gridRow', '_gridCol', '_gridRowSpan', '_gridColSpan', '_gridHAlign', '_gridVAlign']) {
        if (this[gf] !== undefined) clone[gf] = this[gf];
      }
      clone.componentPropertyReferences = { ...this.componentPropertyReferences };
      if (this.type === 'TEXT') {
        for (const field of ['characters', 'fontSize', 'fontName', 'letterSpacing', 'lineHeight', 'textCase', 'textDecoration', 'textAlignHorizontal', 'textStyleId']) {
          clone[field] = this[field];
        }
      }
      if (this.type === 'INSTANCE') clone.componentProperties = { ...(this.componentProperties ?? {}) };
      for (const child of this.children ?? []) clone.appendChild(child._cloneForInstance());
      return clone;
    }

    createInstance() {
      const inst = new MockNode('INSTANCE');
      inst.name = this.name;
      inst._mainComponent = this;
      inst.children = [];
      for (const child of this.children ?? []) inst.appendChild(child._cloneForInstance());
      for (const field of [
        'layoutMode', 'primaryAxisAlignItems', 'counterAxisAlignItems',
        'primaryAxisSizingMode', 'counterAxisSizingMode', 'itemSpacing',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fills', 'strokes',
        'cornerRadius', 'minWidth', 'minHeight', '_w', '_h', '_resized',
      ]) {
        if (this[field] !== undefined) inst[field] = this[field];
      }
      const source = this.parent?.type === 'COMPONENT_SET' ? this.parent : this;
      // REAL-FIGMA QUIRK (live finding 2026-07-22, Desktop Bridge inspection,
      // supersedes the 07-21 "mixed VARIANT+TEXT call" inference — that was
      // wrong): a freshly created instance's componentProperties can LAG,
      // listing only the VARIANT axes and omitting set-level TEXT/BOOLEAN
      // properties (observed live: `available: Variant, Size, State` on a
      // Button instance whose set demonstrably carried Label/Disabled/
      // Loading; a later probe of the SAME set exposed everything). But
      // setProperties with the FULL set-level key WORKS even while the key
      // is not listed (probe-verified). Model both halves: `_allProps` is
      // the full truth (validation + reflection); `componentProperties`
      // exposes the possibly-lagged view — the harness sets
      // `_hideNonVariantOnInstances` on a set to simulate the lag.
      inst._allProps = {};
      inst._slotFills = {};
      for (const [key, def] of Object.entries(source.componentPropertyDefinitions ?? {})) {
        // A SLOT property has NO value on an instance (probe 2d:
        // `{ "type": "SLOT", "preferredValues": [] }` — no value field). Its
        // content is children, not a value.
        inst._allProps[key] = def.type === 'SLOT'
          ? { type: 'SLOT', preferredValues: def.preferredValues ?? [] }
          : { type: def.type, value: def.defaultValue };
      }
      const lagged = source._hideNonVariantOnInstances === true;
      Object.defineProperty(inst, 'componentProperties', {
        get() {
          const out = {};
          for (const [key, def] of Object.entries(inst._allProps)) {
            if (lagged && def.type !== 'VARIANT') continue;
            out[key] = { ...def };
          }
          return out;
        },
      });
      // Real setProperties: keys unknown to the SET throw; TEXT/BOOLEAN
      // values REFLECT onto the cloned nodes via componentPropertyReferences
      // — so a wired-but-unapplied text property is a headless assertion
      // away. Full set-level keys apply even during the exposure lag.
      inst.setProperties = (props) => {
        for (const [key, value] of Object.entries(props)) {
          const def = inst._allProps[key];
          // Probe 2d, verbatim: slot content is never a property VALUE. Any
          // tool path that writes slot content goes through the slot node's
          // children.
          if (def && def.type === 'SLOT') {
            throw new Error('in setProperties: Slot component property values cannot be edited');
          }
          if (!def) {
            throw new Error(
              `in setProperties: "${key}" is not a component property on this instance (available: ${Object.keys(inst._allProps).join(', ') || 'none'})`,
            );
          }
          inst._allProps[key] = { type: def.type, value };
          const targets = [inst, ...inst.findAll()];
          if (def.type === 'TEXT') {
            for (const n of targets) {
              if (n.componentPropertyReferences?.characters === key) n.characters = value;
            }
          }
          if (def.type === 'BOOLEAN') {
            for (const n of targets) {
              if (n.componentPropertyReferences?.visible === key) n.visible = value;
            }
          }
        }
      };
      inst.getMainComponentAsync = async () => inst._mainComponent;
      // HARNESS-ONLY (underscore, like `_hideNonVariantOnInstances`): real
      // instances re-derive from their main continuously; this mock clones
      // once at creation. `_refreshFromMain()` is that re-derivation, made
      // explicit so a test can ask what a designer would SEE after an amend.
      // Slot content is re-attached BY PROPERTY ID — a fill whose id no
      // longer exists on the set does not come back (probe 2d: it orphans
      // into a parentless backing frame, unrecoverable from the designer's
      // view). That asymmetry is the whole point of the rebind rule.
      inst._refreshFromMain = () => {
        for (const child of [...inst.children]) child.remove();
        for (const child of inst._mainComponent.children ?? []) inst.appendChild(child._cloneForInstance());
        const owner = inst._mainComponent.parent?.type === 'COMPONENT_SET'
          ? inst._mainComponent.parent
          : inst._mainComponent;
        const live = owner.componentPropertyDefinitions ?? {};
        for (const node of [inst, ...inst.findAll()]) {
          if (node.type !== 'SLOT') continue;
          const key = node.componentPropertyReferences?.slotContentId;
          if (!key || !live[key]) continue;
          for (const fill of inst._slotFills[key] ?? []) {
            node._restoringSlotFill = true;
            node.appendChild(fill);
            node._restoringSlotFill = false;
          }
        }
        return inst;
      };
      return inst;
    }

    async setTextStyleIdAsync(id) {
      this.textStyleId = id;
    }
  }

  class MockTextStyle {
    constructor() {
      this.id = `S:${newId()}`;
      this.name = '';
      this.fontName = { family: 'Inter', style: 'Regular' };
      this.fontSize = 16;
      this.description = '';
      this._shared = new Map();
    }
    setSharedPluginData(ns, key, value) {
      this._shared.set(`${ns}/${key}`, value);
    }
    getSharedPluginData(ns, key) {
      return this._shared.get(`${ns}/${key}`) ?? '';
    }
  }

  class MockVariable {
    constructor(name, collection, resolvedType) {
      this.id = `VariableID:${newId()}`;
      this.name = name;
      this.variableCollectionId = collection.id;
      this.resolvedType = resolvedType;
      this.valuesByMode = {};
      this.scopes = [];
      this._codeSyntax = {};
    }
    setValueForMode(modeId, value) {
      this.valuesByMode[modeId] = value;
    }
    setVariableCodeSyntax(platform, value) {
      this._codeSyntax[platform] = value;
    }
    resolveForConsumer() {
      // Default-mode resolution, alias chains chased across collections.
      let value = this.valuesByMode[Object.keys(this.valuesByMode)[0]];
      let type = this.resolvedType;
      let guard = 0;
      while (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS' && guard++ < 10) {
        const target = variables.find((v) => v.id === value.id);
        if (!target) return null;
        value = target.valuesByMode[Object.keys(target.valuesByMode)[0]];
        type = target.resolvedType;
      }
      return { resolvedType: type, value };
    }
  }

  class MockCollection {
    constructor(name) {
      this.id = `VariableCollectionId:${newId()}`;
      this.name = name;
      this._modeSeq = 0;
      this.modes = [{ name: 'Mode 1', modeId: this._newModeId() }];
    }
    _newModeId() {
      return `${this.id}:m${this._modeSeq++}`;
    }
    renameMode(modeId, name) {
      const m = this.modes.find((x) => x.modeId === modeId);
      if (m) m.name = name;
    }
    addMode(name) {
      const modeId = this._newModeId();
      this.modes.push({ name, modeId });
      return modeId;
    }
  }

  const firstPage = new MockNode('PAGE');
  firstPage.name = 'Page 1';
  const root = new MockNode('DOCUMENT');
  root.appendChild(firstPage);

  const figma = {
    mixed,
    fileKey: null,
    root,
    currentPage: firstPage,
    notify() {},
    async loadAllPagesAsync() {},
    async loadFontAsync() {},
    async setCurrentPageAsync(page) {
      figma.currentPage = page;
    },
    createPage() {
      const p = new MockNode('PAGE');
      root.appendChild(p);
      return p;
    },
    createFrame: () => new MockNode('FRAME'),
    createSection: () => new MockNode('SECTION'),
    createComponent: () => new MockNode('COMPONENT'),
    createText: () => new MockNode('TEXT'),
    createRectangle: () => new MockNode('RECTANGLE'),
    createEllipse: () => new MockNode('ELLIPSE'),
    createPolygon: () => {
      // The REAL Plugin API returns type 'POLYGON' here; 'REGULAR_POLYGON' is
      // the REST spelling. The mock used to return the REST one, which is
      // precisely why extract/figma/dump.plugin.js could key its shape map on
      // REGULAR_POLYGON for six dump versions without a single test failing:
      // the mock agreed with the bug. A mock that speaks a dialect the real
      // API does not is worse than no mock — it manufactures confidence.
      const n = new MockNode('POLYGON');
      n.pointCount = 3;
      return n;
    },
    createNodeFromSvg: (svg) => {
      // Real Figma refuses malformed SVG with "Failed to convert SVG file".
      // The old no-op mock accepted anything, which let an emitter bug (an
      // <svg> with two `fill` attributes) pass every headless gate and only
      // fail on a live canvas. Validate the way the real API would: non-empty,
      // and NO duplicate attributes on any tag (invalid XML).
      if (typeof svg !== 'string' || svg.trim() === '') {
        throw new Error('in createNodeFromSvg: Failed to convert SVG file (empty)');
      }
      for (const tag of svg.match(/<[a-zA-Z][^>]*>/g) ?? []) {
        const seen = new Set();
        for (const m of tag.matchAll(/[\s"']([a-zA-Z_:][\w:.-]*)\s*=/g)) {
          if (seen.has(m[1])) {
            throw new Error(`in createNodeFromSvg: Failed to convert SVG file (duplicate attribute "${m[1]}")`);
          }
          seen.add(m[1]);
        }
      }
      const n = new MockNode('FRAME');
      n.resize(16, 16);
      return n;
    },
    createTextStyle: () => {
      const s = new MockTextStyle();
      allStyles.push(s);
      return s;
    },
    async getLocalTextStylesAsync() {
      return [...allStyles];
    },
    async getStyleByIdAsync(id) {
      return allStyles.find((s) => s.id === id) ?? null;
    },
    async getNodeByIdAsync(id) {
      if (root.id === id) return root;
      return root.findOne((n) => n.id === id);
    },
    combineAsVariants(nodes, page) {
      const set = new MockNode('COMPONENT_SET');
      page.appendChild(set);
      for (const n of nodes) set.appendChild(n);
      // SLOT properties minted on a component BEFORE combining LIFT to set
      // level — and same-named ones MERGE into ONE property with a NEW id,
      // with every slot node re-pointed at it. Measured live 2026-08-08 on
      // `Latest DS Contracts Tests`: two variants minted `Body#4:391` and
      // `Body#4:392`, and after combineAsVariants the set carried exactly
      // `Body#4:393` with both slot nodes referencing it.
      //
      // This corrects a first cut of this mock that kept the duplicates. That
      // version was not merely wrong, it was an ALIBI: it made the emitter's
      // create-path unification look load-bearing when Figma does that work
      // itself. The duplicate-property trap is REAL, but it lives on the
      // AMEND path — `createSlot()` on an already-combined variant mints a
      // second set-level property under the same name (probe 2c, and
      // re-confirmed live), which is modeled by createSlot minting on the
      // parent set. That is where the emitter's rebind actually earns its
      // keep, and where the eval red-tests it.
      const merged = new Map();
      for (const n of nodes) {
        for (const [key, def] of Object.entries(n._propDefs ?? {})) {
          if (def.type !== 'SLOT') continue;
          delete n._propDefs[key];
          const display = key.split('#')[0];
          if (!merged.has(display)) {
            merged.set(display, `${display}#${set.id}:${set._propSeq++}`);
            set._propDefs[merged.get(display)] = def;
          }
        }
      }
      for (const [display, mergedKey] of merged) {
        for (const n of [set, ...set.findAll()]) {
          const ref = n.componentPropertyReferences?.slotContentId;
          if (ref && ref.split('#')[0] === display) {
            n.componentPropertyReferences = { ...n.componentPropertyReferences, slotContentId: mergedKey };
          }
        }
      }
      return set;
    },
    viewport: {
      scrollAndZoomIntoView() {},
    },
    ui: null,
    variables: {
      createVariableCollection(name) {
        const c = new MockCollection(name);
        collections.push(c);
        return c;
      },
      createVariable(name, collection, type) {
        const v = new MockVariable(name, collection, type);
        variables.push(v);
        return v;
      },
      // MUI round: the genesis token sync emits REAL variable aliases for
      // source-aliased minted leaves. Validates like real Figma: the argument
      // must be a Variable, not an id or a value.
      createVariableAlias(variable) {
        if (!variable || typeof variable.id !== 'string' || !variable.id.startsWith('VariableID:')) {
          throw new Error('in createVariableAlias: expected a Variable');
        }
        return { type: 'VARIABLE_ALIAS', id: variable.id };
      },
      async getLocalVariablesAsync() {
        return [...variables];
      },
      async getLocalVariableCollectionsAsync() {
        return [...collections];
      },
      async getVariableByIdAsync(id) {
        return variables.find((v) => v.id === id) ?? null;
      },
      async getVariableCollectionByIdAsync(id) {
        return collections.find((c) => c.id === id) ?? null;
      },
      setBoundVariableForPaint(paint, field, variable) {
        return {
          ...paint,
          boundVariables: { ...(paint.boundVariables ?? {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } },
        };
      },
    },
  };

  return { figma, root, firstPage, variables, collections, styles: allStyles };
}
