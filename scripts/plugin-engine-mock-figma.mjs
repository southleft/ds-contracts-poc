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
 *   - createNodeFromSvg validates (non-empty, no duplicate attributes) and
 *     returns an empty 16×16 frame (vector internals out of scope).
 *   - Fonts always "load"; text style application is exact (textStyleId).
 */

let nextId = 1;
const newId = () => `${nextId++}:${nextId}`;

export function createFigmaMock() {
  const allStyles = [];
  const collections = [];
  const variables = [];
  const mixed = Symbol('figma.mixed');

  class MockNode {
    constructor(type) {
      this.type = type;
      this.id = newId();
      this.key = `key-${this.id}`;
      this.name = type;
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
      this.layoutMode = 'NONE';
      this.primaryAxisAlignItems = 'MIN';
      this.counterAxisAlignItems = 'MIN';
      this.primaryAxisSizingMode = 'AUTO';
      this.counterAxisSizingMode = 'AUTO';
      this.itemSpacing = 0;
      this.paddingTop = 0;
      this.paddingRight = 0;
      this.paddingBottom = 0;
      this.paddingLeft = 0;
      this.layoutSizingHorizontal = 'HUG';
      this.layoutSizingVertical = 'HUG';
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
    }

    appendChild(node) {
      if (node.parent) {
        const i = node.parent.children.indexOf(node);
        if (i >= 0) node.parent.children.splice(i, 1);
      }
      node.parent = this;
      this.children.push(node);
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
      this._w = w;
      this._h = h;
      this._resized = true;
    }

    resizeWithoutConstraints(w, h) {
      this.resize(w, h);
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
      return Math.max(content + pad, min ?? 0);
    }

    get width() {
      if (this.layoutSizingHorizontal === 'FILL' && this.parent?.layoutMode && this.parent.layoutMode !== 'NONE') {
        return Math.max(0, this.parent.width - this.parent.paddingLeft - this.parent.paddingRight);
      }
      return this._intrinsicSize('w', 0);
    }

    set width(v) {
      this._w = v;
    }

    get height() {
      if (this.layoutSizingVertical === 'FILL' && this.parent?.layoutMode && this.parent.layoutMode !== 'NONE') {
        return Math.max(0, this.parent.height - this.parent.paddingTop - this.parent.paddingBottom);
      }
      return this._intrinsicSize('h', 0);
    }

    set height(v) {
      this._h = v;
    }

    setSharedPluginData(namespace, key, value) {
      this._shared.set(`${namespace}/${key}`, value);
    }

    getSharedPluginData(namespace, key) {
      return this._shared.get(`${namespace}/${key}`) ?? '';
    }

    setBoundVariable(field, variable) {
      this.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id };
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
      for (const [key, def] of Object.entries(source.componentPropertyDefinitions ?? {})) {
        inst._allProps[key] = { type: def.type, value: def.defaultValue };
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
      const n = new MockNode('REGULAR_POLYGON');
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
