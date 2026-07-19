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
 *   - Geometry is not laid out: width/height start at Figma's 100×100 frame
 *     default and change only via resize()/resizeWithoutConstraints().
 *   - createNodeFromSvg returns an empty 16×16 frame (vector internals are
 *     out of scope for the engine checks).
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
      this.width = 100;
      this.height = 100;
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
        this.fontSize = 16;
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
      this.width = w;
      this.height = h;
    }

    resizeWithoutConstraints(w, h) {
      this.resize(w, h);
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
    get componentPropertyDefinitions() {
      if (this.type === 'COMPONENT_SET') {
        // Variant axes ride the children names, mirrored as VARIANT defs.
        // Real Figma surfaces properties defined on variants at SET level
        // after combineAsVariants — mirror that (dedupe by name prefix).
        const defs = { ...this._propDefs };
        const have = new Set(Object.keys(defs).map((k) => k.split('#')[0]));
        for (const ch of this.children ?? []) {
          for (const [key, def] of Object.entries(ch._propDefs ?? {})) {
            const name = key.split('#')[0];
            if (have.has(name)) continue;
            have.add(name);
            defs[key] = def;
          }
        }
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

    createInstance() {
      const inst = new MockNode('INSTANCE');
      inst.name = this.name;
      inst._mainComponent = this;
      inst.children = [];
      const source = this.parent?.type === 'COMPONENT_SET' ? this.parent : this;
      inst.componentProperties = {};
      for (const [key, def] of Object.entries(source.componentPropertyDefinitions ?? {})) {
        inst.componentProperties[key] = { type: def.type, value: def.defaultValue };
      }
      inst.setProperties = (props) => {
        for (const [key, value] of Object.entries(props)) {
          inst.componentProperties[key] = {
            type: inst.componentProperties[key]?.type ?? 'TEXT',
            value,
          };
        }
      };
      inst.getMainComponentAsync = async () => inst._mainComponent;
      inst.width = this.width;
      inst.height = this.height;
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
    createComponent: () => new MockNode('COMPONENT'),
    createText: () => new MockNode('TEXT'),
    createRectangle: () => new MockNode('RECTANGLE'),
    createEllipse: () => new MockNode('ELLIPSE'),
    createPolygon: () => {
      const n = new MockNode('REGULAR_POLYGON');
      n.pointCount = 3;
      return n;
    },
    createNodeFromSvg: () => {
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
