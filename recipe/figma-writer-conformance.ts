import { readFileSync } from "node:fs";

import ts from "typescript";

import {
  RECIPE_FIGMA_SHARED_DATA_KEY_PATTERN,
  RECIPE_FIGMA_VARIABLE_NAME_PATTERN,
  RECIPE_FIGMA_WRITER_VERSION,
} from "./interpret.js";

const TYPINGS_PATH = "node_modules/@figma/plugin-typings/plugin-api.d.ts";
const TYPINGS_PACKAGE_PATH = "node_modules/@figma/plugin-typings/package.json";
const SHARED_NAMESPACE_PATTERN = /^[A-Za-z0-9_.]+$/;

type InterfaceIndex = Map<
  string,
  {
    extends: string[];
    methods: Set<string>;
    writable: Set<string>;
    all: Set<string>;
  }
>;

export interface WriterConformanceCounts {
  apiCalls: number;
  propertyNames: number;
  variants: number;
  variables: number;
  pluginDataWrites: number;
  propertyWrites: number;
  bindings: number;
}

export interface WriterConformanceReport {
  ok: boolean;
  failures: string[];
  typingsVersion: string;
  apiCalls: string[];
  propertyNames: string[];
  counts: WriterConformanceCounts;
  result?: Record<string, any>;
}

export interface WriterConformanceExpectations {
  variants?: number;
  writerVersion?: number;
  requiredMarkers?: readonly string[];
}

const memberName = (node: ts.PropertyName | undefined): string | undefined => {
  if (node === undefined) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return undefined;
};

const buildInterfaceIndex = (source: string): InterfaceIndex => {
  const file = ts.createSourceFile(
    TYPINGS_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const index: InterfaceIndex = new Map();
  for (const statement of file.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    const methods = new Set<string>();
    const writable = new Set<string>();
    const all = new Set<string>();
    for (const member of statement.members) {
      const name = memberName(member.name);
      if (name === undefined) continue;
      all.add(name);
      if (
        ts.isMethodSignature(member) ||
        (ts.isPropertySignature(member) &&
          member.type !== undefined &&
          ts.isFunctionTypeNode(member.type))
      ) {
        methods.add(name);
      }
      if (
        ts.isPropertySignature(member) &&
        !member.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
        )
      ) {
        writable.add(name);
      }
    }
    index.set(statement.name.text, {
      extends:
        statement.heritageClauses?.flatMap((clause) =>
          clause.types.map((type) => type.expression.getText(file)),
        ) ?? [],
      methods,
      writable,
      all,
    });
  }
  return index;
};

const inheritedMembers = (
  index: InterfaceIndex,
  interfaceName: string,
  field: "methods" | "writable" | "all",
  seen = new Set<string>(),
): Set<string> => {
  if (seen.has(interfaceName)) return new Set();
  seen.add(interfaceName);
  const entry = index.get(interfaceName);
  if (entry === undefined) return new Set();
  const result = new Set(entry[field]);
  for (const parent of entry.extends) {
    for (const member of inheritedMembers(index, parent, field, seen)) {
      result.add(member);
    }
  }
  return result;
};

const literal = (node: ts.Expression): string | undefined =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;

const staticInventory = (
  writerCode: string,
  interfaces: InterfaceIndex,
): {
  failures: string[];
  apiCalls: string[];
  propertyNames: string[];
} => {
  const failures: string[] = [];
  const apiCalls = new Set<string>();
  const propertyNames = new Set<string>();
  const file = ts.createSourceFile(
    "writer.js",
    writerCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const pluginMethods = inheritedMembers(interfaces, "PluginAPI", "methods");
  const variableMethods = inheritedMembers(
    interfaces,
    "VariablesAPI",
    "methods",
  );
  const objectInterfaces: Record<string, string> = {
    page: "PageNode",
    section: "SectionNode",
    old: "SectionNode",
    collection: "VariableCollection",
    variable: "Variable",
    helpers: "FrameNode",
    helper: "ComponentNode",
    glyph: "RectangleNode",
    component: "ComponentNode",
    instance: "InstanceNode",
    label: "TextNode",
    set: "ComponentSetNode",
    descendant: "SceneNode",
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const access = node.expression;
      if (
        ts.isIdentifier(access.expression) &&
        access.expression.text === "figma"
      ) {
        const name = access.name.text;
        apiCalls.add(`PluginAPI.${name}`);
        if (!pluginMethods.has(name)) {
          failures.push(`PluginAPI does not declare figma.${name}()`);
        }
      } else if (
        ts.isPropertyAccessExpression(access.expression) &&
        ts.isIdentifier(access.expression.expression) &&
        access.expression.expression.text === "figma" &&
        access.expression.name.text === "variables"
      ) {
        const name = access.name.text;
        apiCalls.add(`VariablesAPI.${name}`);
        if (!variableMethods.has(name)) {
          failures.push(
            `VariablesAPI does not declare figma.variables.${name}()`,
          );
        }
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression)
    ) {
      const objectName = node.left.expression.text;
      const interfaceName = objectInterfaces[objectName];
      if (interfaceName !== undefined) {
        const property = node.left.name.text;
        propertyNames.add(`${interfaceName}.${property}`);
        if (
          interfaceName === "SceneNode" ||
          !inheritedMembers(interfaces, interfaceName, "writable").has(property)
        ) {
          if (
            interfaceName !== "SceneNode" ||
            ![
              "componentPropertyReferences",
              "blendMode",
              "layoutSizingHorizontal",
              "layoutSizingVertical",
              "opacity",
              "textAutoResize",
              "visible",
            ].includes(property)
          ) {
            failures.push(
              `${interfaceName} does not declare writable property ${property}`,
            );
          }
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["setSharedData", "getSharedData"].includes(node.expression.text)
    ) {
      const key = node.arguments[1] && literal(node.arguments[1]);
      if (key === undefined) {
        failures.push(`${node.expression.text} key must be a string literal`);
      } else if (!RECIPE_FIGMA_SHARED_DATA_KEY_PATTERN.test(key)) {
        failures.push(`invalid shared-plugin-data key ${JSON.stringify(key)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  const namespaceMatch = writerCode.match(/const NS = "([^"]+)"/);
  if (
    namespaceMatch === null ||
    namespaceMatch[1]!.length < 3 ||
    !SHARED_NAMESPACE_PATTERN.test(namespaceMatch[1]!)
  ) {
    failures.push(
      `invalid shared-plugin-data namespace ${JSON.stringify(namespaceMatch?.[1])}`,
    );
  }
  if (apiCalls.size === 0) failures.push("writer contains no Plugin API calls");
  if (propertyNames.size === 0) {
    failures.push("writer contains no checked Plugin API property assignments");
  }
  return {
    failures,
    apiCalls: [...apiCalls].sort(),
    propertyNames: [...propertyNames].sort(),
  };
};

interface MockMetrics {
  variants: number;
  variables: number;
  pluginDataWrites: number;
  propertyWrites: number;
  bindings: number;
}

const createLiveMock = (
  interfaces: InterfaceIndex,
): { figma: Record<string, any>; metrics: MockMetrics } => {
  let nextId = 1;
  const metrics: MockMetrics = {
    variants: 0,
    variables: 0,
    pluginDataWrites: 0,
    propertyWrites: 0,
    bindings: 0,
  };
  const collections: any[] = [];
  const variables: any[] = [];
  const interfaceForType: Record<string, string> = {
    DOCUMENT: "DocumentNode",
    PAGE: "PageNode",
    SECTION: "SectionNode",
    FRAME: "FrameNode",
    COMPONENT: "ComponentNode",
    COMPONENT_SET: "ComponentSetNode",
    INSTANCE: "InstanceNode",
    TEXT: "TextNode",
    RECTANGLE: "RectangleNode",
    ELLIPSE: "EllipseNode",
  };

  const cloneSceneNode = (source: any): any => {
    const cloned = makeNode(
      source.type,
      interfaceForType[source.type] ?? "SceneNode",
      Array.isArray(source.children),
      source.componentProperties
        ? { componentProperties: structuredClone(source.componentProperties) }
        : {},
    );
    cloned.name = source.name;
    cloned.width = source.width;
    cloned.height = source.height;
    cloned.x = source.x;
    cloned.y = source.y;
    if (source.visible !== undefined) cloned.visible = source.visible;
    if (source.opacity !== undefined) cloned.opacity = source.opacity;
    if (source.characters !== undefined) cloned.characters = source.characters;
    if (source.fontName !== undefined) cloned.fontName = source.fontName;
    if (source.fontSize !== undefined) cloned.fontSize = source.fontSize;
    if (source.lineHeight !== undefined) cloned.lineHeight = source.lineHeight;
    if (source.textAlignHorizontal !== undefined)
      cloned.textAlignHorizontal = source.textAlignHorizontal;
    if (source.textAlignVertical !== undefined)
      cloned.textAlignVertical = source.textAlignVertical;
    if (source.textAutoResize !== undefined)
      cloned.textAutoResize = source.textAutoResize;
    if (source.blendMode !== undefined) cloned.blendMode = source.blendMode;
    if (source.componentPropertyReferences) {
      cloned.componentPropertyReferences = {
        ...source.componentPropertyReferences,
      };
    }
    for (const child of source.children ?? []) {
      cloned.appendChild(cloneSceneNode(child));
    }
    return cloned;
  };

  const makeNode = (
    type: string,
    interfaceName: string,
    withChildren = false,
    extras: {
      componentProperties?: Record<
        string,
        { type: string; value: string | boolean }
      >;
    } = {},
  ): any => {
    const pluginData = new Map<string, string>();
    const target: Record<string, any> = {
      id: `mock:${nextId++}`,
      type,
      name: type,
      parent: null,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      removed: false,
      setSharedPluginData(namespace: string, key: string, value: string) {
        if (namespace.length < 3 || !SHARED_NAMESPACE_PATTERN.test(namespace)) {
          throw new Error(
            "setSharedPluginData namespace may contain only alphanumeric characters, underscore, or period",
          );
        }
        if (!RECIPE_FIGMA_SHARED_DATA_KEY_PATTERN.test(key)) {
          throw new Error(`invalid shared plugin data key: ${key}`);
        }
        pluginData.set(`${namespace}:${key}`, value);
        metrics.pluginDataWrites += 1;
      },
      getSharedPluginData(namespace: string, key: string) {
        return pluginData.get(`${namespace}:${key}`) ?? "";
      },
      remove() {
        if (target.parent?.children) {
          target.parent.children = target.parent.children.filter(
            (child: any) => child !== proxy,
          );
        }
        target.removed = true;
      },
      resize(width: number, height: number) {
        proxy.width = width;
        proxy.height = height;
      },
      resizeWithoutConstraints(width: number, height: number) {
        proxy.width = width;
        proxy.height = height;
      },
      setBoundVariable(_field: string, _variable: any) {
        metrics.bindings += 1;
      },
      findAllWithCriteria(criteria: { types: string[] }) {
        const matches: any[] = [];
        const walk = (node: any): void => {
          for (const child of node.children ?? []) {
            if (criteria.types.includes(child.type)) matches.push(child);
            walk(child);
          }
        };
        walk(proxy);
        return matches;
      },
    };
    if (withChildren) {
      target.children = [];
      target.appendChild = (child: any) => {
        if (child.parent?.children) {
          child.parent.children = child.parent.children.filter(
            (candidate: any) => candidate !== child,
          );
        }
        target.children.push(child);
        child.parent = proxy;
        return child;
      };
    }
    if (type === "INSTANCE") {
      target.componentProperties = extras.componentProperties ?? {};
      target.setProperties = (updates: Record<string, string | boolean>) => {
        for (const [key, value] of Object.entries(updates)) {
          if (!target.componentProperties[key]) {
            throw new Error(`setProperties unknown key ${key}`);
          }
          target.componentProperties[key] = {
            ...target.componentProperties[key],
            value,
          };
        }
      };
    }
    if (type === "COMPONENT") {
      target.createInstance = () => {
        const defs = target.parent?._componentPropertyDefinitions ?? {};
        const instance = makeNode("INSTANCE", "InstanceNode", true, {
          componentProperties: Object.fromEntries(
            Object.entries(defs).map(([key, def]) => [
              key,
              {
                type: (def as { type: string }).type,
                value: (def as { defaultValue: string | boolean }).defaultValue,
              },
            ]),
          ),
        });
        for (const child of target.children ?? []) {
          instance.appendChild(cloneSceneNode(child));
        }
        // A real instance inherits its main component's auto-layout, which is
        // why measuring through an instance works on the canvas. Without this
        // the mock reports layoutMode "NONE" on every instance and any writer
        // that walks a subtree's geometry sees a shape Figma never produces.
        for (const property of [
          "layoutMode",
          "layoutSizingHorizontal",
          "layoutSizingVertical",
          "itemSpacing",
          "paddingLeft",
          "paddingRight",
          "paddingTop",
          "paddingBottom",
          "primaryAxisSizingMode",
          "counterAxisSizingMode",
        ])
          if (target[property] !== undefined)
            instance[property] = target[property];
        return instance;
      };
    }
    if (type === "COMPONENT_SET") {
      target._componentPropertyDefinitions = {};
      target.addComponentProperty = (
        name: string,
        typeName?: string,
        defaultValue?: string | boolean,
      ) => {
        const key = `${name}#mock`;
        target._componentPropertyDefinitions[key] = {
          type: typeName,
          defaultValue,
        };
        return key;
      };
    }
    const writable = inheritedMembers(interfaces, interfaceName, "writable");
    const methods = inheritedMembers(interfaces, interfaceName, "methods");
    const internalWritable = new Set([
      "parent",
      "children",
      "removed",
      "width",
      "height",
      "x",
      "y",
    ]);
    const proxy = new Proxy(target, {
      set(object, property, value) {
        if (
          typeof property === "string" &&
          !property.startsWith("_") &&
          !internalWritable.has(property) &&
          !writable.has(property)
        ) {
          throw new Error(
            `${interfaceName} live mock rejects unsupported writable property ${property}`,
          );
        }
        if (property === "componentPropertyReferences") {
          let ancestor = object.parent;
          while (ancestor) {
            if (ancestor.type === "INSTANCE") {
              throw new Error(
                "in set_componentPropertyReferences: Cannot set component property references on instance sublayer",
              );
            }
            ancestor = ancestor.parent;
          }
          const keys =
            value && typeof value === "object" ? Object.keys(value) : [];
          const allowed =
            type === "TEXT"
              ? ["characters", "visible"]
              : type === "INSTANCE"
                ? ["mainComponent", "visible"]
                : ["visible"];
          const unrecognized = keys.filter((key) => !allowed.includes(key));
          if (unrecognized.length) {
            throw new Error(
              `in set_componentPropertyReferences: Property "node.componentPropertyReferences.value" failed validation: Unrecognized key(s) in object: '${unrecognized[0]}'`,
            );
          }
        }
        object[property as any] = value;
        if (
          typeof property === "string" &&
          !internalWritable.has(property) &&
          !property.startsWith("_")
        ) {
          metrics.propertyWrites += 1;
        }
        return true;
      },
      get(object, property) {
        const value = object[property as any];
        if (
          typeof property === "string" &&
          typeof value === "function" &&
          !methods.has(property) &&
          !["remove"].includes(property)
        ) {
          throw new Error(
            `${interfaceName} live mock rejects unsupported method ${property}()`,
          );
        }
        return value;
      },
    });
    return proxy;
  };

  const root = makeNode("DOCUMENT", "DocumentNode", true);
  root.name = "Scratch Project";
  const initialPage = makeNode("PAGE", "PageNode", true);
  initialPage.name = "Existing page";
  root.appendChild(initialPage);
  let currentPage = initialPage;
  const appendToCurrent = (node: any): any => {
    currentPage.appendChild(node);
    return node;
  };

  const figma: Record<string, any> = {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    editorType: "figma",
    root,
    get currentPage() {
      return currentPage;
    },
    async loadAllPagesAsync() {},
    async setCurrentPageAsync(page: any) {
      currentPage = page;
    },
    createPage() {
      const page = makeNode("PAGE", "PageNode", true);
      root.appendChild(page);
      return page;
    },
    createSection() {
      return appendToCurrent(makeNode("SECTION", "SectionNode", true));
    },
    createFrame() {
      return appendToCurrent(makeNode("FRAME", "FrameNode", true));
    },
    createComponent() {
      return appendToCurrent(makeNode("COMPONENT", "ComponentNode", true));
    },
    createRectangle() {
      return appendToCurrent(makeNode("RECTANGLE", "RectangleNode"));
    },
    createEllipse() {
      return appendToCurrent(makeNode("ELLIPSE", "EllipseNode"));
    },
    createText() {
      return appendToCurrent(makeNode("TEXT", "TextNode"));
    },
    combineAsVariants(components: any[], parent: any) {
      const set = makeNode("COMPONENT_SET", "ComponentSetNode", true);
      parent.appendChild(set);
      for (const component of components) set.appendChild(component);
      metrics.variants += components.length;
      return set;
    },
    async listAvailableFontsAsync() {
      const families = [
        "IBM Plex Sans",
        "Segoe UI",
        "Segoe UI Web (West European)",
        "SF Pro",
        "Inter",
        "Roboto",
        "Helvetica Neue",
      ];
      const styles = [
        "Regular",
        "Medium",
        "Bold",
        "Semi Bold",
        "SemiBold",
        "Semibold",
      ];
      return families.flatMap((family) =>
        styles.map((style) => ({ fontName: { family, style } })),
      );
    },
    async loadFontAsync() {},
    variables: {
      createVariableCollection(name: string) {
        const pluginData = new Map<string, string>();
        const collection: Record<string, any> = {
          id: `collection:${nextId++}`,
          name,
          modes: [{ modeId: `mode:${nextId++}`, name: "Mode 1" }],
          remote: false,
          hiddenFromPublishing: false,
          renameMode(modeId: string, name: string) {
            const mode = collection.modes.find(
              (candidate: any) => candidate.modeId === modeId,
            );
            if (mode) mode.name = name;
          },
          setSharedPluginData(namespace: string, key: string, value: string) {
            pluginData.set(`${namespace}:${key}`, value);
            metrics.pluginDataWrites += 1;
          },
          getSharedPluginData(namespace: string, key: string) {
            return pluginData.get(`${namespace}:${key}`) ?? "";
          },
          remove() {
            collection.removed = true;
          },
        };
        collections.push(collection);
        return collection;
      },
      createVariable(name: string, collection: any, resolvedType: string) {
        if (!RECIPE_FIGMA_VARIABLE_NAME_PATTERN.test(name)) {
          throw new Error(
            `createVariable rejected invalid Figma variable name: ${name}`,
          );
        }
        if (!collections.includes(collection)) {
          throw new Error("createVariable requires a VariableCollection");
        }
        const pluginData = new Map<string, string>();
        const variable: Record<string, any> = {
          id: `variable:${nextId++}`,
          name,
          resolvedType,
          scopes: [],
          setSharedPluginData(namespace: string, key: string, value: string) {
            pluginData.set(`${namespace}:${key}`, value);
            metrics.pluginDataWrites += 1;
          },
          getSharedPluginData(namespace: string, key: string) {
            return pluginData.get(`${namespace}:${key}`) ?? "";
          },
          setValueForMode() {},
          setVariableCodeSyntax() {},
        };
        variables.push(variable);
        metrics.variables += 1;
        return variable;
      },
      async getVariableCollectionByIdAsync(id: string) {
        return collections.find((collection) => collection.id === id) ?? null;
      },
      setBoundVariableForPaint(paint: any) {
        metrics.bindings += 1;
        return { ...paint, boundVariables: { color: true } };
      },
      setBoundVariableForEffect(effect: any) {
        metrics.bindings += 1;
        return { ...effect, boundVariables: { color: true } };
      },
    },
  };
  return { figma, metrics };
};

const executeWithLiveMock = async (
  writerCode: string,
  interfaces: InterfaceIndex,
): Promise<{ result: Record<string, any>; metrics: MockMetrics }> => {
  const { figma, metrics } = createLiveMock(interfaces);
  const AsyncFunction = Object.getPrototypeOf(async function () {})
    .constructor as new (
    ...arguments_: string[]
  ) => (...values: any[]) => Promise<any>;
  const execute = new AsyncFunction("figma", writerCode);
  const result = (await execute(figma)) as Record<string, any>;
  return { result, metrics };
};

export async function validateFigmaWriterConformance(
  writerCode: string,
  expectations: WriterConformanceExpectations = {},
): Promise<WriterConformanceReport> {
  const expectedVariants = expectations.variants ?? 288;
  const expectedWriterVersion =
    expectations.writerVersion ?? RECIPE_FIGMA_WRITER_VERSION;
  const typings = readFileSync(TYPINGS_PATH, "utf8");
  const typingsVersion = (
    JSON.parse(readFileSync(TYPINGS_PACKAGE_PATH, "utf8")) as {
      version: string;
    }
  ).version;
  const interfaces = buildInterfaceIndex(typings);
  const inventory = staticInventory(writerCode, interfaces);
  const failures = [...inventory.failures];
  let result: Record<string, any> | undefined;
  let metrics: MockMetrics = {
    variants: 0,
    variables: 0,
    pluginDataWrites: 0,
    propertyWrites: 0,
    bindings: 0,
  };
  if (failures.length === 0) {
    try {
      const execution = await executeWithLiveMock(writerCode, interfaces);
      result = execution.result;
      metrics = execution.metrics;
    } catch (error) {
      failures.push(
        `live mock execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const sourceVariantCount = Array.isArray(result?.sources)
    ? result.sources.reduce(
        (sum: number, source: { variantCount?: number }) =>
          sum + (source.variantCount ?? 0),
        0,
      )
    : 0;
  for (const [label, value] of [
    ["planned/minted variants", metrics.variants],
    ["reported variants", sourceVariantCount],
    ["variables", metrics.variables],
    ["plugin data writes", metrics.pluginDataWrites],
    ["property writes", metrics.propertyWrites],
    ["bindings", metrics.bindings],
  ] as const) {
    if (value <= 0) failures.push(`${label} count must be nonzero`);
  }
  if (
    metrics.variants !== expectedVariants ||
    sourceVariantCount !== expectedVariants
  ) {
    failures.push(
      `writer must plan and mint exactly ${expectedVariants} variants; mock=${metrics.variants}, reported=${sourceVariantCount}`,
    );
  }
  if (result?.writerVersion !== expectedWriterVersion) {
    failures.push(
      `writer result must report writerVersion ${expectedWriterVersion}`,
    );
  }
  for (const marker of expectations.requiredMarkers ?? [
    "BUTTON-LABEL-GEOMETRY",
    'component.layoutSizingHorizontal = "HUG"',
  ]) {
    if (!writerCode.includes(marker)) {
      failures.push(`writer omits required conformance marker ${marker}`);
    }
  }
  return {
    ok: failures.length === 0,
    failures,
    typingsVersion,
    apiCalls: inventory.apiCalls,
    propertyNames: inventory.propertyNames,
    counts: {
      apiCalls: inventory.apiCalls.length,
      propertyNames: inventory.propertyNames.length,
      variants: metrics.variants,
      variables: metrics.variables,
      pluginDataWrites: metrics.pluginDataWrites,
      propertyWrites: metrics.propertyWrites,
      bindings: metrics.bindings,
    },
    result,
  };
}
