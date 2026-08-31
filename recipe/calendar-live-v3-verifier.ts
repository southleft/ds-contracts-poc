import { Buffer } from "node:buffer";

import type { RecipeEnvelope } from "./envelope.js";
import {
  normalizeFigmaBindings,
  normalizeFigmaUnit,
  type CanonicalFigmaBinding,
  type LocalVariableRecord,
} from "./figma-property-normalizer-v8.js";
import type { IRNode } from "./figma-ir.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  sceneToNormalizedIr,
  type ExpectedScenePlan,
  type SceneComparison,
  type SceneNodeSnapshot,
} from "./scene-readback-calendar-v1.js";
import {
  verifyCalendarLiveV3FixedSceneFixedPoint,
  type CalendarLiveV3FixedFixedPoint,
} from "./calendar-live-v3-fixed-point.js";

export const CALENDAR_LIVE_V3_VERIFIER_VERSION = "calendar-live-v3-verifier-v1";

export function buildCalendarLiveV3RawPropertyRuntime(): string {
  return String.raw`
const INPUT_V4_MIXED={$figma:"MIXED"};
const inputV4RawValue=value=>{
  if(value===figma.mixed)return INPUT_V4_MIXED;
  if(value===undefined||value===null||typeof value!=="object")return value;
  if(Array.isArray(value))return value.map(inputV4RawValue);
  return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,inputV4RawValue(child)]));
};
const inputV4CaptureVariableTable=async()=>{
  const collections=new Map((await figma.variables.getLocalVariableCollectionsAsync()).map(collection=>[collection.id,collection.name]));
  const variables=await figma.variables.getLocalVariablesAsync();
  return variables.map(variable=>({
    id:variable.id,
    name:variable.name,
    resolvedType:variable.resolvedType,
    collectionId:variable.variableCollectionId,
    collectionName:collections.get(variable.variableCollectionId)||"",
    remote:false
  })).sort((left,right)=>left.id.localeCompare(right.id));
};
const inputV4RawNodeProperties=node=>({
  rawBoundVariables:inputV4RawValue(node.boundVariables||{}),
  rawPaintBindings:{
    fills:Array.isArray(node.fills)?node.fills.map(paint=>({boundVariables:inputV4RawValue(paint.boundVariables||{})})):[],
    strokes:Array.isArray(node.strokes)?node.strokes.map(paint=>({boundVariables:inputV4RawValue(paint.boundVariables||{})})):[],
    effects:Array.isArray(node.effects)?node.effects.map(effect=>({boundVariables:inputV4RawValue(effect.boundVariables||{})})):[]
  },
  lineHeight:"lineHeight" in node?inputV4RawValue(node.lineHeight):undefined,
  letterSpacing:"letterSpacing" in node?inputV4RawValue(node.letterSpacing):undefined
});`;
}

export interface CalendarLiveV3RawNode extends Omit<
  SceneNodeSnapshot,
  "boundVariables" | "letterSpacing" | "lineHeight" | "children"
> {
  rawBoundVariables?: Readonly<Record<string, unknown>>;
  rawPaintBindings?: {
    fills?: readonly {
      boundVariables?: Readonly<Record<string, unknown>>;
    }[];
    strokes?: readonly {
      boundVariables?: Readonly<Record<string, unknown>>;
    }[];
    effects?: readonly {
      boundVariables?: Readonly<Record<string, unknown>>;
    }[];
  };
  lineHeight?: unknown;
  letterSpacing?: unknown;
  children: CalendarLiveV3RawNode[];
}

export interface CalendarLiveV3NormalizedScene {
  scene: SceneNodeSnapshot;
  canonicalBindings: Array<{
    ownershipKey: string;
    bindings: CanonicalFigmaBinding[];
  }>;
  variableTable: LocalVariableRecord[];
}

export interface CalendarLiveV3SceneProof {
  accounting: SceneComparison;
  fixedPoint: CalendarLiveV3FixedFixedPoint;
}

const decodedVariableIdentity = (name: string): string => {
  const match = name.match(
    /^token\/(?:color|float|string|boolean)\/id-([0-9a-f]+)$/,
  );
  if (!match || match[1]!.length % 2 !== 0)
    throw new TypeError(`non-canonical local variable name ${name}`);
  const bytes = Buffer.from(match[1]!, "hex");
  const decoded = bytes.toString("utf8");
  if (Buffer.from(decoded, "utf8").toString("hex") !== match[1])
    throw new TypeError(`invalid UTF-8 local variable name ${name}`);
  return decoded;
};

export function normalizeCalendarLiveV3Scene(
  root: CalendarLiveV3RawNode,
  variableTable: readonly LocalVariableRecord[],
): CalendarLiveV3NormalizedScene {
  const canonicalBindings: CalendarLiveV3NormalizedScene["canonicalBindings"] = [];
  const visit = (raw: CalendarLiveV3RawNode): SceneNodeSnapshot => {
    const bindings = normalizeFigmaBindings({
      nodeBoundVariables: raw.rawBoundVariables,
      fills: raw.rawPaintBindings?.fills,
      strokes: raw.rawPaintBindings?.strokes,
      effects: raw.rawPaintBindings?.effects,
      variableTable,
    });
    canonicalBindings.push({ ownershipKey: raw.ownershipKey, bindings });
    const lineHeight = normalizeFigmaUnit("lineHeight", raw.lineHeight, {
      allowAuto: true,
      allowPercent: true,
      allowPixels: true,
    });
    const letterSpacing = normalizeFigmaUnit(
      "letterSpacing",
      raw.letterSpacing,
      {
        allowAuto: false,
        allowPercent: true,
        allowPixels: true,
      },
    );
    const {
      rawBoundVariables: _rawBoundVariables,
      rawPaintBindings: _rawPaintBindings,
      lineHeight: _lineHeight,
      letterSpacing: _letterSpacing,
      children,
      ...rest
    } = raw;
    return {
      ...rest,
      ...(lineHeight === undefined
        ? {}
        : {
            lineHeight:
              lineHeight.unit === "auto"
                ? ({ unit: "AUTO" } as const)
                : {
                    unit:
                      lineHeight.unit === "px"
                        ? ("PIXELS" as const)
                        : ("PERCENT" as const),
                    value: lineHeight.value,
                  },
          }),
      ...(letterSpacing === undefined || letterSpacing.unit === "auto"
        ? {}
        : {
            letterSpacing: {
              unit:
                letterSpacing.unit === "px"
                  ? ("PIXELS" as const)
                  : ("PERCENT" as const),
              value: letterSpacing.value,
            },
          }),
      boundVariables: bindings.map((binding) => ({
        field: binding.field,
        variableName: decodedVariableIdentity(binding.variable.name),
        resolvedType: binding.variable.resolvedType,
      })),
      children: children.map(visit),
    };
  };
  return {
    scene: visit(root),
    canonicalBindings,
    variableTable: variableTable.map((variable) => ({ ...variable })),
  };
}

export function proveCalendarLiveV3Scene<Instance>(
  normalized: CalendarLiveV3NormalizedScene,
  expected: ExpectedScenePlan,
  envelope: RecipeEnvelope,
  selection: unknown,
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): CalendarLiveV3SceneProof {
  return {
    accounting: compareSceneToExpectedPlan(expected, normalized.scene),
    fixedPoint: verifyCalendarLiveV3FixedSceneFixedPoint(
      normalized.scene,
      envelope,
      selection,
      collapse,
      compile,
    ),
  };
}

export function compileCalendarLiveV3ExpectedScenePlan(
  ir: IRNode,
  rootOwnershipKey?: string,
): ExpectedScenePlan {
  return compileExpectedScenePlan(ir, { rootOwnershipKey });
}

export function assertCalendarLiveV3PreCaptureGates(payload: unknown): void {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("table live v17 pre-capture gate payload absent");
  const gate = payload as Record<string, unknown>;
  const required = [
    "sceneExtraction",
    "hostNormalization",
    "accounting",
    "fixedPoint",
    "usability",
    "restoration",
    "clipping",
    "overlap",
    "stateSemantics",
    "contentHug",
  ];
  const failed = required.filter((name) => gate[name] !== true);
  if (failed.length > 0)
    throw new TypeError(
      `captures forbidden before gates pass: ${failed.join(",")}`,
    );
}

export function normalizedSceneIr(
  normalized: CalendarLiveV3NormalizedScene,
): IRNode {
  return sceneToNormalizedIr(normalized.scene);
}
