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
} from "./scene-readback-combobox-v29.js";
import {
  verifyComboboxLiveV29FixedSceneFixedPoint,
  type ComboboxLiveV29FixedFixedPoint,
} from "./combobox-live-v29-fixed-point.js";

export const COMBOBOX_LIVE_V29_VERIFIER_VERSION = "combobox-live-v29-verifier-v1";

export function buildComboboxLiveV29RawPropertyRuntime(): string {
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

export interface ComboboxLiveV29RawNode extends Omit<
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
  children: ComboboxLiveV29RawNode[];
}

export interface ComboboxLiveV29NormalizedScene {
  scene: SceneNodeSnapshot;
  canonicalBindings: Array<{
    ownershipKey: string;
    bindings: CanonicalFigmaBinding[];
  }>;
  variableTable: LocalVariableRecord[];
}

export interface ComboboxLiveV29SceneProof {
  accounting: SceneComparison;
  fixedPoint: ComboboxLiveV29FixedFixedPoint;
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

export function normalizeComboboxLiveV29Scene(
  root: ComboboxLiveV29RawNode,
  variableTable: readonly LocalVariableRecord[],
): ComboboxLiveV29NormalizedScene {
  const canonicalBindings: ComboboxLiveV29NormalizedScene["canonicalBindings"] =
    [];
  const visit = (raw: ComboboxLiveV29RawNode): SceneNodeSnapshot => {
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

export function proveComboboxLiveV29Scene<Instance>(
  normalized: ComboboxLiveV29NormalizedScene,
  expected: ExpectedScenePlan,
  envelope: RecipeEnvelope,
  selection: unknown,
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): ComboboxLiveV29SceneProof {
  return {
    accounting: compareSceneToExpectedPlan(expected, normalized.scene),
    fixedPoint: verifyComboboxLiveV29FixedSceneFixedPoint(
      normalized.scene,
      envelope,
      selection,
      collapse,
      compile,
    ),
  };
}

export function compileComboboxLiveV29ExpectedScenePlan(
  ir: IRNode,
): ExpectedScenePlan {
  return compileExpectedScenePlan(ir);
}

export function assertComboboxLiveV29PreCaptureGates(payload: unknown): void {
  if (payload === null || typeof payload !== "object")
    throw new TypeError("v8 pre-capture gate payload absent");
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
    "adornmentContent",
    "stateSemantics",
  ];
  const failed = required.filter((name) => gate[name] !== true);
  if (failed.length > 0)
    throw new TypeError(
      `captures forbidden before gates pass: ${failed.join(",")}`,
    );
}

export function normalizedSceneIr(
  normalized: ComboboxLiveV29NormalizedScene,
): IRNode {
  return sceneToNormalizedIr(normalized.scene);
}
