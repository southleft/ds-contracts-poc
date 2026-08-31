/**
 * Writer preflight against the measured-host ledger (H2).
 *
 * Offline, zero Figma writes. Replays committed Button v5 attempt payloads
 * through static analysis plus a plugin-sandbox that embodies only measured
 * host behaviors and refuses unknown API surface.
 *
 * Acceptance: the three writer classes that cost Button v5 live attempts
 * (no TextEncoder; setBoundVariableForEffect resets geometry; later effects
 * paint on top) are caught on the attempt-1 payload. The current Button
 * writer must be clean of those classes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createContext, runInNewContext } from "node:vm";

import ts from "typescript";

import { FIGMA_RUNTIME_API_AUDIT } from "./figma-runtime-portability.js";
import {
  BUTTON_V5_WRITER_CLASSES,
  MEASURED_HOST_FACTS,
  MEASURED_HOST_LEDGER_VERSION,
  assertMeasuredHostEvidencePins,
  type MeasuredHostFactId,
} from "./measured-host-ledger.js";

export const WRITER_PREFLIGHT_VERSION = "writer-preflight-v1";

const TYPINGS_PATH = "node_modules/@figma/plugin-typings/plugin-api.d.ts";

const BUTTON_V5_ATTEMPT_1 =
  "recipe/evidence/button-live-pivot-v5/writer-attempt-1.js";
const BUTTON_V5_CURRENT_WRITER =
  "recipe/evidence/button-live-pivot-v5/writer.js";

const REFUSED_WEB_APIS = new Set(
  Object.entries(FIGMA_RUNTIME_API_AUDIT.webApis)
    .filter(
      ([name, policy]) =>
        name !== "TextDecoder" &&
        (policy.startsWith("not used") || policy.startsWith("host-only")),
    )
    .map(([name]) => name),
);

export interface WriterPreflightFinding {
  classId: MeasuredHostFactId | "unknown-api-surface";
  message: string;
}

export interface WriterPreflightScan {
  source: string;
  findings: WriterPreflightFinding[];
  classIds: Array<WriterPreflightFinding["classId"]>;
}

export interface WriterPreflightReport {
  artifactVersion: typeof WRITER_PREFLIGHT_VERSION;
  ledgerVersion: typeof MEASURED_HOST_LEDGER_VERSION;
  evidencePinFailures: string[];
  buttonV5Attempt1: WriterPreflightScan;
  currentCommittedWriter: WriterPreflightScan;
  catchesButtonV5WriterClasses: boolean;
  currentWriterClean: boolean;
}

export interface MeasuredHostEffect {
  type?: string;
  spread?: number;
  radius?: number;
  offset?: { x?: number; y?: number };
  color?: unknown;
  boundVariables?: Record<string, unknown>;
}

export interface MeasuredHostSandbox {
  figma: Record<string, unknown>;
  loadedFonts: Set<string>;
  paintedEffects: MeasuredHostEffect[];
  unknownApiCalls: string[];
  run(source: string): unknown;
}

const extractJsonObject = (source: string, start: number): string | null => {
  if (source[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < source.length; index++) {
    const character = source[index]!;
    if (inString) {
      if (escape) escape = false;
      else if (character === "\\") escape = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
};

export function extractWriterPlan(source: string): unknown | null {
  const marker = "const PLAN=";
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const raw = extractJsonObject(source, jsonStart);
  if (raw === null) return null;
  return JSON.parse(raw);
}

const effectColorHex = (effect: Record<string, unknown>): string => {
  const color = effect.color;
  if (typeof color === "string") return color.toLowerCase();
  if (color && typeof color === "object" && "value" in color) {
    const value = (color as { value?: unknown }).value;
    if (typeof value === "string") return value.toLowerCase();
  }
  return "";
};

const effectVariableName = (effect: Record<string, unknown>): string => {
  if (typeof effect.variable === "string") return effect.variable;
  const color = effect.color;
  if (color && typeof color === "object" && "variable" in color) {
    const value = (color as { variable?: unknown }).variable;
    if (typeof value === "string") return value;
  }
  return "";
};

const isWhiteGapFill = (hex: string): boolean => {
  const digits = hex.startsWith("#") ? hex.slice(1) : hex;
  return (
    digits === "ffffffff" ||
    digits === "ffffff" ||
    digits === "fff" ||
    digits === "ffff"
  );
};

/**
 * Measured Button v5 pair: bound outline-color ring + white spread-2 gap.
 * Returns indices into the appearance effects list, or null when the pair
 * is not present (do not invent a sort rule for unrelated shadows).
 */
export function findMeasuredFocusRingGapPair(
  effects: unknown,
): { ring: number; gap: number } | null {
  if (!Array.isArray(effects)) return null;
  let ring = -1;
  let gap = -1;
  for (const [index, entry] of effects.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const effect = entry as Record<string, unknown>;
    if (effect.kind !== "drop-shadow") continue;
    const variable = effectVariableName(effect);
    const hex = effectColorHex(effect);
    if (variable.includes("outline-color")) ring = index;
    else if (isWhiteGapFill(hex) && effect.spread === 2) gap = index;
  }
  if (ring < 0 || gap < 0) return null;
  return { ring, gap };
}

const parseWriter = (source: string): ts.SourceFile =>
  ts.createSourceFile(
    "writer.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );

const identifierIsCalled = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  return (
    (ts.isCallExpression(parent) && parent.expression === node) ||
    (ts.isNewExpression(parent) && parent.expression === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.expression === node)
  );
};

const scanRefusedWebApis = (source: string): WriterPreflightFinding[] => {
  const findings: WriterPreflightFinding[] = [];
  const file = parseWriter(source);
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && REFUSED_WEB_APIS.has(node.text)) {
      if (node.text === "TextEncoder") {
        findings.push({
          classId: "plugin-sandbox-no-textencoder",
          message: `writer calls TextEncoder (plugin sandbox has none; ${MEASURED_HOST_FACTS[0]!.evidence.path})`,
        });
      } else if (identifierIsCalled(node) || ts.isNewExpression(node.parent)) {
        findings.push({
          classId: "unknown-api-surface",
          message: `writer uses refused web API ${node.text} (${FIGMA_RUNTIME_API_AUDIT.webApis[node.text as keyof typeof FIGMA_RUNTIME_API_AUDIT.webApis]})`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
};

const enclosingBlock = (node: ts.Node): ts.Block | ts.SourceFile => {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isBlock(current) || ts.isSourceFile(current)) return current;
    current = current.parent;
  }
  return node.getSourceFile();
};

const restoreMentionsGeometry = (block: ts.Node, after: number): boolean => {
  let sawOffset = false;
  let sawRadius = false;
  let sawSpread = false;
  const visit = (node: ts.Node): void => {
    if (node.getStart() <= after) {
      ts.forEachChild(node, visit);
      return;
    }
    if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
      if (node.text === "offset") sawOffset = true;
      if (node.text === "radius") sawRadius = true;
      if (node.text === "spread") sawSpread = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(block);
  return sawOffset && sawRadius && sawSpread;
};

const scanBoundEffectGeometry = (source: string): WriterPreflightFinding[] => {
  const findings: WriterPreflightFinding[] = [];
  const file = parseWriter(source);
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "setBoundVariableForEffect"
    ) {
      const parent = node.parent;
      const returnedBare =
        (ts.isReturnStatement(parent) && parent.expression === node) ||
        (ts.isArrowFunction(parent) && parent.body === node);
      if (returnedBare) {
        findings.push({
          classId: "setBoundVariableForEffect-resets-shadow-geometry",
          message:
            "setBoundVariableForEffect result is returned without carrying compile-planned offset/radius/spread (Button v5 attempt 4)",
        });
      } else if (
        !restoreMentionsGeometry(enclosingBlock(node), node.getEnd())
      ) {
        findings.push({
          classId: "setBoundVariableForEffect-resets-shadow-geometry",
          message:
            "setBoundVariableForEffect is used without a measured geometry restore in the enclosing block (Button v5 attempt 4)",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
};

const scanFocusRingPaintOrder = (source: string): WriterPreflightFinding[] => {
  const findings: WriterPreflightFinding[] = [];
  const plan = extractWriterPlan(source);
  if (!plan || typeof plan !== "object" || !("sources" in plan)) {
    return findings;
  }
  const sources = (plan as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return findings;
  for (const sourcePlan of sources) {
    if (!sourcePlan || typeof sourcePlan !== "object") continue;
    const appearance = (sourcePlan as { appearance?: unknown }).appearance;
    if (!appearance || typeof appearance !== "object") continue;
    for (const [state, cell] of Object.entries(
      appearance as Record<string, unknown>,
    )) {
      if (!cell || typeof cell !== "object") continue;
      const pair = findMeasuredFocusRingGapPair(
        (cell as { effects?: unknown }).effects,
      );
      if (pair && pair.gap < pair.ring) {
        findings.push({
          classId: "later-effect-entries-paint-on-top",
          message: `${(sourcePlan as { adapterIdentity?: string }).adapterIdentity ?? "source"} ${state}: white spread-2 gap is listed before the outline ring; Figma will bury the gap (Button v5 attempt 5)`,
        });
      }
    }
  }
  return findings;
};

const inheritedMethods = (
  index: Map<string, { extends: string[]; methods: Set<string> }>,
  interfaceName: string,
  seen = new Set<string>(),
): Set<string> => {
  if (seen.has(interfaceName)) return new Set();
  seen.add(interfaceName);
  const entry = index.get(interfaceName);
  if (!entry) return new Set();
  const methods = new Set(entry.methods);
  for (const parent of entry.extends) {
    for (const method of inheritedMethods(index, parent, seen)) {
      methods.add(method);
    }
  }
  return methods;
};

const buildTypingsMethodIndex = (): Map<
  string,
  { extends: string[]; methods: Set<string> }
> => {
  const source = readFileSync(TYPINGS_PATH, "utf8");
  const file = ts.createSourceFile(
    TYPINGS_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const index = new Map<
    string,
    { extends: string[]; methods: Set<string> }
  >();
  for (const statement of file.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    const methods = new Set<string>();
    for (const member of statement.members) {
      if (
        !member.name ||
        !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
      ) {
        continue;
      }
      if (
        ts.isMethodSignature(member) ||
        (ts.isPropertySignature(member) &&
          member.type !== undefined &&
          ts.isFunctionTypeNode(member.type))
      ) {
        methods.add(member.name.text);
      }
    }
    index.set(statement.name.text, {
      extends:
        statement.heritageClauses?.flatMap((clause) =>
          clause.types.map((type) => type.expression.getText(file)),
        ) ?? [],
      methods,
    });
  }
  return index;
};

const scanUnknownPluginApi = (source: string): WriterPreflightFinding[] => {
  const findings: WriterPreflightFinding[] = [];
  const index = buildTypingsMethodIndex();
  const pluginMethods = inheritedMethods(index, "PluginAPI");
  const variableMethods = inheritedMethods(index, "VariablesAPI");
  const file = parseWriter(source);
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
        if (!pluginMethods.has(name)) {
          findings.push({
            classId: "unknown-api-surface",
            message: `PluginAPI does not declare figma.${name}() — refuse rather than guess`,
          });
        }
      } else if (
        ts.isPropertyAccessExpression(access.expression) &&
        ts.isIdentifier(access.expression.expression) &&
        access.expression.expression.text === "figma" &&
        access.expression.name.text === "variables"
      ) {
        const name = access.name.text;
        if (!variableMethods.has(name)) {
          findings.push({
            classId: "unknown-api-surface",
            message: `VariablesAPI does not declare figma.variables.${name}() — refuse rather than guess`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
};

const scanInstanceTextFont = (source: string): WriterPreflightFinding[] => {
  if (!source.includes("setProperties")) return [];
  if (source.includes("loadFontAsync")) return [];
  return [
    {
      classId: "instance-text-property-requires-loaded-font",
      message:
        "writer calls setProperties without loadFontAsync (Calendar v2: instance TEXT property refuses an unloaded component font)",
    },
  ];
};

const uniqueFindings = (
  findings: WriterPreflightFinding[],
): WriterPreflightFinding[] => {
  const seen = new Set<string>();
  const unique: WriterPreflightFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.classId}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return unique;
};

export function scanWriterSource(
  source: string,
  label: string,
): WriterPreflightScan {
  const findings = uniqueFindings([
    ...scanRefusedWebApis(source),
    ...scanBoundEffectGeometry(source),
    ...scanFocusRingPaintOrder(source),
    ...scanUnknownPluginApi(source),
    ...scanInstanceTextFont(source),
  ]);
  return {
    source: label,
    findings,
    classIds: [...new Set(findings.map((finding) => finding.classId))],
  };
}

const fontKey = (font: { family?: string; style?: string } | string): string =>
  typeof font === "string"
    ? font
    : `${font.family ?? ""}:${font.style ?? ""}`;

export function createMeasuredHostSandbox(): MeasuredHostSandbox {
  const loadedFonts = new Set<string>();
  const paintedEffects: MeasuredHostEffect[] = [];
  const unknownApiCalls: string[] = [];

  const refuse = (name: string): never => {
    unknownApiCalls.push(name);
    throw new Error(`MEASURED-HOST-UNKNOWN-API:${name}`);
  };

  const variables = {
    setBoundVariableForEffect(
      effect: MeasuredHostEffect,
      field: string,
      variable: unknown,
    ): MeasuredHostEffect {
      // MEASURED Button v5 attempt 4: binding call resets shadow geometry.
      return {
        ...effect,
        boundVariables: { ...(effect.boundVariables ?? {}), [field]: variable },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
      };
    },
    setBoundVariableForPaint(paint: Record<string, unknown>, field: string, variable: unknown) {
      return { ...paint, boundVariables: { [field]: variable } };
    },
    createVariableCollection() {
      return { id: "VariableCollectionId:sandbox", name: "sandbox", modes: [] };
    },
    createVariable() {
      return { id: "VariableID:sandbox" };
    },
  };

  const figmaTarget: Record<string, unknown> = {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    editorType: "figma",
    root: { name: "Scratch Project" },
    currentPage: { name: "sandbox", children: [] as unknown[] },
    variables: new Proxy(variables, {
      get(target, property, receiver) {
        if (typeof property === "symbol") return Reflect.get(target, property, receiver);
        if (property in target) return Reflect.get(target, property, receiver);
        return () => refuse(`figma.variables.${String(property)}`);
      },
    }),
    async loadFontAsync(font: { family?: string; style?: string } | string) {
      loadedFonts.add(fontKey(font));
    },
    mixed: Symbol("mixed"),
  };

  const figma = new Proxy(figmaTarget, {
    get(target, property, receiver) {
      if (typeof property === "symbol") return Reflect.get(target, property, receiver);
      if (property in target) return Reflect.get(target, property, receiver);
      return () => refuse(`figma.${String(property)}`);
    },
  });

  const assignEffects = (effects: MeasuredHostEffect[]) => {
    paintedEffects.length = 0;
    paintedEffects.push(...effects.map((effect) => ({ ...effect })));
  };

  const instance = {
    fontName: { family: "SF Pro", style: "Regular" },
    setProperties(_properties: Record<string, string>) {
      // MEASURED Calendar v2: TEXT property refuses unless the component font is loaded.
      if (!loadedFonts.has(fontKey(instance.fontName))) {
        throw new Error(
          "in setProperties: Unable to update this text property because the component uses a font that isn't available.",
        );
      }
    },
  };

  const run = (source: string): unknown => {
    const context = createContext({
      figma,
      assignEffects,
      loadedFonts,
      instance,
      TypeError,
      Error,
      Object,
      Array,
      Map,
      Set,
      JSON,
      Math,
      Promise,
      String,
      Number,
      Boolean,
      Uint8Array,
      Uint32Array,
      DataView,
      Symbol,
      console,
      // Measured Button v5 attempt 1: the binding exists but is not a constructor.
      TextEncoder: undefined,
    });
    return runInNewContext(source, context, { timeout: 1000 });
  };

  return { figma, loadedFonts, paintedEffects, unknownApiCalls, run };
}

/** Top of the painted stack — later list entries sit on top. */
export function paintedTopEffect(
  effects: readonly MeasuredHostEffect[],
): MeasuredHostEffect | undefined {
  return effects[effects.length - 1];
}

export function replayButtonV5AttemptPayloads(): WriterPreflightReport {
  const evidencePinFailures = assertMeasuredHostEvidencePins();
  const buttonV5Attempt1 = scanWriterSource(
    readFileSync(BUTTON_V5_ATTEMPT_1, "utf8"),
    BUTTON_V5_ATTEMPT_1,
  );
  const currentCommittedWriter = scanWriterSource(
    readFileSync(BUTTON_V5_CURRENT_WRITER, "utf8"),
    BUTTON_V5_CURRENT_WRITER,
  );
  const catchesButtonV5WriterClasses = BUTTON_V5_WRITER_CLASSES.every((classId) =>
    buttonV5Attempt1.classIds.includes(classId),
  );
  const currentWriterClean = !BUTTON_V5_WRITER_CLASSES.some((classId) =>
    currentCommittedWriter.classIds.includes(classId),
  );
  return {
    artifactVersion: WRITER_PREFLIGHT_VERSION,
    ledgerVersion: MEASURED_HOST_LEDGER_VERSION,
    evidencePinFailures,
    buttonV5Attempt1,
    currentCommittedWriter,
    catchesButtonV5WriterClasses,
    currentWriterClean,
  };
}

export function buildWriterPreflightReport(): WriterPreflightReport {
  return replayButtonV5AttemptPayloads();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildWriterPreflightReport();
  const out = "recipe/evidence/writer-preflight-v1.json";
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`writer preflight ${report.artifactVersion}`);
  console.log(`  ledger: ${report.ledgerVersion}`);
  console.log(
    `  evidence pins: ${report.evidencePinFailures.length === 0 ? "ok" : report.evidencePinFailures.join("; ")}`,
  );
  console.log(
    `  button v5 attempt 1 classes: ${report.buttonV5Attempt1.classIds.join(", ") || "(none)"}`,
  );
  console.log(
    `  catches Button v5 writer classes: ${report.catchesButtonV5WriterClasses}`,
  );
  console.log(
    `  current committed writer clean: ${report.currentWriterClean}`,
  );
  if (report.currentCommittedWriter.findings.length > 0) {
    for (const finding of report.currentCommittedWriter.findings) {
      console.log(`  current writer: ${finding.classId}: ${finding.message}`);
    }
  }
  console.log(`writer preflight -> ${out}`);
  if (
    report.evidencePinFailures.length > 0 ||
    !report.catchesButtonV5WriterClasses ||
    !report.currentWriterClean
  ) {
    process.exitCode = 1;
  }
}
