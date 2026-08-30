/**
 * calendar@1 Figma writer.
 *
 * Emits the signed program a live attempt executes in the Figma plugin sandbox
 * to mint a Calendar page on Scratch. It inherits the whole hardened shape of
 * `table-figma-writer.ts` -- exact file identity guard, page ownership, owned
 * variable collections, font provenance, first-segment naming -- and differs
 * only where the anatomy differs.
 *
 * Two calendar-specific things worth stating, because both were learned the
 * hard way in this lineage:
 *
 *  1. THE SET NAME CARRIES THE COMPILE LABEL. Table live v25 refused because
 *     the writer named every set `<role> :: <source display name>` while
 *     compile carried `Table row` / `Table cell`. The IR diff went green and
 *     independent root accounting still refused on the node NAME. This writer
 *     carries `setIr.label` from the start.
 *
 *  2. THE GRID OWNS DAY INSTANCES. A week is not instantiable: day state varies
 *     within a week, and an instance picks one variant for the whole component.
 *     So the calendar variant's weeks are frames of day instances, and only
 *     `calendar@1/day` is ever instantiated.
 *
 *  3. THE DAY BOX EXISTS BEFORE ITS CHILDREN. Calendar live v1 refused
 *     `CALENDAR-TEXT-GEOMETRY:calendar/day/label` because the hug label `26`
 *     was appended into a still-HUG 0-wide day component; `applySizing` of the
 *     FIXED 32px box ran after children. Hug text also records its intrinsic
 *     size before a 0-width parent can collapse it.
 *
 *  4. LOAD THE INSTANCE FONT BEFORE setProperties. Calendar live v2 refused
 *     because `createInstance` then `setProperties(Label)` ran without loading
 *     the instance TEXT font; Figma will not update a TEXT property whose
 *     component font is not loaded in the plugin sandbox.
 *
 *  5. INSTANCE LABEL IS CHARACTERS, NOT setProperties. Calendar live v3
 *     measured that SF Pro Regular is listed and loadable, `setProperties(Label)`
 *     still refuses, and `text.characters` writes. Do not invent a different
 *     font to make the TEXT property API happy.
 *
 *  6. HUG FROM POST-CHARACTER INTRINSIC; WALK A ZERO-GLYPH NAMED FALLBACK.
 *     Calendar live v23 painted day/caption TEXT at 1×15 with characters
 *     present (`26`, `August 2026`) and weekday FIXED 32×15 with `Su`..`Sa`
 *     but null render bounds. SF Pro is listed and `loadFontAsync` succeeds,
 *     then `width` stays 0 after characters. The 1px sliver is
 *     `Math.max(emptyWidth, 1)`, not a source-named 1px glyph. After setting
 *     characters, if intrinsic width is 0, walk the remaining *named*
 *     fallback chain (Segoe UI → Roboto → Helvetica → Arial). Do not invent
 *     Inter. Do not stamp hug from an empty-glyph measure. Do not invent
 *     FIXED text px.
 *
 *  7. AFTER A PAINTED FALLBACK, INSTANCE LABEL IS setProperties.
 *     Calendar live v24 owned day labels painted (Roboto Regular 16×16,
 *     readable `26` in 32×32 cells). Week mint then refused
 *     `CALENDAR-DAY-LABEL-MISMATCH:calendar/day-instance/1` because
 *     `text.characters = Label` silent-fails on instance TEXT bound to the
 *     already-issued Label property once the glyph has a real intrinsic.
 *     `instance.setProperties({[dayLabelProperty]: Label})` after
 *     `loadFontAsync` writes the override; then verify `text.characters`.
 *     Do not invent a font. Do not invent FIXED. Probe stays characters-only.
 *
 *  8. BIND LABEL AFTER INSTANCE CHARACTERS. Calendar live v26 issued and
 *     bound Label before week mint. Instance/1 named 27 stayed Label=26
 *     after setProperties and characters in the same tick as the bind.
 *     After leftover sat, the same setProperties wrote 27. Issue the
 *     property, write instance characters while the day-label TEXT is
 *     still unbound, then bind the mains and setProperties each
 *     already-appended instance to the same source Label. Do not
 *     characters-assign after the bind (that can revert the override
 *     to the default). Do not invent FIXED. Probe stays characters-only.
 *
 *  9. INSTANCE CARRIES THE NAMED DAY-CELL BOX. Calendar live v27 painted
 *     day numbers, then week/month instances hug-collapsed to 16×16
 *     (single-digit 8×16) because applySizing stamped compile hug onto
 *     an instance whose main is already FIXED `dayCell-size` 32×32.
 *     When instancing that main, do not stamp hug — carry the main's
 *     already-named box. Do not invent a new px. Do not change day
 *     label hug. Do not teach FIXED as a fill.
 *
 * No live write happens here. This module builds a program string; executing it
 * requires a separate PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import {
  CALENDAR_DAY_COUNT,
  CALENDAR_DAY_STATES,
  CALENDAR_WEEK_COUNT,
  CALENDAR_WEEK_NUMBERS,
} from "./recipes/calendar.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const CALENDAR_FIGMA_NAMESPACE = "ds.contracts.calendar.recipe.v1";
export const CALENDAR_FIGMA_WRITER_VERSION = 1;
export const CALENDAR_FIGMA_RUN_SUFFIX = "calendar-v31";
export const FORBIDDEN_CALENDAR_V1_RUN_IDENTITY = "19be1c96-calendar-v1";
export const FORBIDDEN_CALENDAR_V2_RUN_IDENTITY = "19be1c96-calendar-v2";
export const FORBIDDEN_CALENDAR_V3_RUN_IDENTITY = "19be1c96-calendar-v3";
export const FORBIDDEN_CALENDAR_V4_RUN_IDENTITY = "19be1c96-calendar-v4";
export const FORBIDDEN_CALENDAR_V5_RUN_IDENTITY = "19be1c96-calendar-v5";
export const FORBIDDEN_CALENDAR_V6_RUN_IDENTITY = "19be1c96-calendar-v6";
export const FORBIDDEN_CALENDAR_V7_RUN_IDENTITY = "19be1c96-calendar-v7";
export const FORBIDDEN_CALENDAR_V8_RUN_IDENTITY = "19be1c96-calendar-v8";
export const FORBIDDEN_CALENDAR_V9_RUN_IDENTITY = "19be1c96-calendar-v9";
export const FORBIDDEN_CALENDAR_V10_RUN_IDENTITY = "19be1c96-calendar-v10";
export const FORBIDDEN_CALENDAR_V11_RUN_IDENTITY = "19be1c96-calendar-v11";
export const FORBIDDEN_CALENDAR_V12_RUN_IDENTITY = "19be1c96-calendar-v12";
export const FORBIDDEN_CALENDAR_V13_RUN_IDENTITY = "19be1c96-calendar-v13";
export const FORBIDDEN_CALENDAR_V14_RUN_IDENTITY = "19be1c96-calendar-v14";
export const FORBIDDEN_CALENDAR_V15_RUN_IDENTITY = "19be1c96-calendar-v15";
export const FORBIDDEN_CALENDAR_V16_RUN_IDENTITY = "19be1c96-calendar-v16";
export const FORBIDDEN_CALENDAR_V17_RUN_IDENTITY = "19be1c96-calendar-v17";
export const FORBIDDEN_CALENDAR_V18_RUN_IDENTITY = "19be1c96-calendar-v18";
export const FORBIDDEN_CALENDAR_V19_RUN_IDENTITY = "19be1c96-calendar-v19";
export const FORBIDDEN_CALENDAR_V20_RUN_IDENTITY = "19be1c96-calendar-v20";
export const FORBIDDEN_CALENDAR_V21_RUN_IDENTITY = "19be1c96-calendar-v21";
export const FORBIDDEN_CALENDAR_V22_RUN_IDENTITY = "19be1c96-calendar-v22";
export const FORBIDDEN_CALENDAR_V23_RUN_IDENTITY = "19be1c96-calendar-v23";
export const FORBIDDEN_CALENDAR_V24_RUN_IDENTITY = "19be1c96-calendar-v24";
export const FORBIDDEN_CALENDAR_V25_RUN_IDENTITY = "19be1c96-calendar-v25";
export const FORBIDDEN_CALENDAR_V26_RUN_IDENTITY = "19be1c96-calendar-v26";
export const FORBIDDEN_CALENDAR_V27_RUN_IDENTITY = "19be1c96-calendar-v27";
export const FORBIDDEN_CALENDAR_V28_RUN_IDENTITY = "19be1c96-calendar-v28";
export const FORBIDDEN_CALENDAR_V29_RUN_IDENTITY = "19be1c96-calendar-v29";
export const FORBIDDEN_CALENDAR_V30_RUN_IDENTITY = "da4456d8-calendar-v30";
export const FORBIDDEN_CALENDAR_V30_PAGE_ID = "180:56126";

/** Never reuse another archetype's identity or write another archetype's page. */
export const FORBIDDEN_INPUT_NAMESPACE = "ds.contracts.input.recipe.v5";
export const FORBIDDEN_INPUT_RUN_IDENTITY = "4a074b24-e8503dd5-input-v5";
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";
export const FORBIDDEN_COMBOBOX_NAMESPACE = "ds.contracts.combobox.recipe.v1";
export const FORBIDDEN_COMBOBOX_RUN_IDENTITY = "70c24cbd-d27f2e85-combobox-v1";
export const FORBIDDEN_COMBOBOX_PAGE_ID = "163:35981";
export const FORBIDDEN_BUTTON_PAGE_ID = "85:6781";
export const FORBIDDEN_TABLE_NAMESPACE = "ds.contracts.table.recipe.v1";
export const FORBIDDEN_TABLE_PAGE_ID = "173:48924";

export const CALENDAR_FIGMA_VARIANTS_PER_SOURCE =
  CALENDAR_WEEK_NUMBERS.length +
  CALENDAR_WEEK_NUMBERS.length +
  CALENDAR_DAY_STATES.length;

/**
 * Day instances per source, derived rather than guessed. Only
 * `calendar@1/day` is instantiable, and it appears in exactly two places:
 *
 *   the week template, once per WeekNumbers variant   2 x 7  =  14
 *   every calendar variant, weeks x days          4 x 3 x 7  =  84
 *                                                              ---
 *                                                               98
 *
 * The first draft of this constant said 14 was 7 -- it forgot the week
 * template has a variant per WeekNumbers -- and the writer refused with
 * "requires 91 day instances; found 98" rather than minting a wrong page.
 * That refusal is the constant earning its place.
 */
export const CALENDAR_FIGMA_INSTANCES_PER_SOURCE =
  CALENDAR_WEEK_NUMBERS.length * CALENDAR_DAY_COUNT +
  CALENDAR_WEEK_NUMBERS.length * CALENDAR_WEEK_COUNT * CALENDAR_DAY_COUNT;

export interface CalendarVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface CalendarFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface CalendarFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  calendarAxes: Record<string, string[]>;
  weekAxes: Record<string, string[]>;
  dayAxes: Record<string, string[]>;
  calendarSet: ComponentSetNode;
  weekSet: ComponentSetNode;
  daySet: ComponentSetNode;
  variables: CalendarVariablePlan[];
  dayDefaults: { Label: string };
  instanceCount: number;
  comparedIrFacts: number;
}

export interface CalendarFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: CalendarFigmaSourcePlan[];
  code: string;
}

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    for (const child of node.children) walk(child, visit);
};

const atPath = (value: unknown, field: string): unknown =>
  field.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return (current as Record<string | number, unknown>)[key];
  }, value);

const variableType = (
  binding: VariableBinding,
  value: unknown,
): "COLOR" | "FLOAT" => {
  if (binding.type === "COLOR") {
    if (typeof value !== "string")
      throw new TypeError(
        `calendar live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `calendar live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `calendar live writer: unsupported binding type ${binding.type}`,
  );
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind !== "frame")
    throw new TypeError("calendar live writer requires calendar/library frame");
  const found = root.children.filter((child) => child.role === role);
  if (found.length !== 1 || found[0]!.kind !== "component-set")
    throw new TypeError(`calendar live writer: required ${role} set`);
  return found[0];
};

const axisValues = (set: ComponentSetNode, name: string): string[] => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  if (!axis) throw new TypeError(`calendar live writer: missing ${name} axis`);
  return [...axis.values];
};

const countComparedFacts = (node: IRNode): number => {
  let total = 0;
  walk(node, (candidate) => {
    total += 1;
    total += (candidate.bindings ?? []).length;
  });
  return total;
};

const planSource = (
  input: CalendarFigmaWriterInput,
): CalendarFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "calendar" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("calendar live writer requires calendar@1");
  if (input.envelope.archetype !== "calendar / date-picker")
    throw new TypeError("calendar live writer requires the calendar archetype");

  const calendarSet = requireSet(input.envelope.ir, "calendar/set");
  const weekSet = requireSet(input.envelope.ir, "calendar/week-set");
  const daySet = requireSet(input.envelope.ir, "calendar/day-set");

  const calendarAxes = { WeekNumbers: axisValues(calendarSet, "WeekNumbers") };
  const weekAxes = { WeekNumbers: axisValues(weekSet, "WeekNumbers") };
  const dayAxes = { State: axisValues(daySet, "State") };

  if (
    canonicalJson(calendarAxes.WeekNumbers) !==
    canonicalJson(CALENDAR_WEEK_NUMBERS)
  )
    throw new TypeError("calendar live writer: incomplete calendar axes");
  if (
    canonicalJson(weekAxes.WeekNumbers) !== canonicalJson(CALENDAR_WEEK_NUMBERS)
  )
    throw new TypeError("calendar live writer: incomplete week axis");
  if (canonicalJson(dayAxes.State) !== canonicalJson(CALENDAR_DAY_STATES))
    throw new TypeError("calendar live writer: incomplete day State axis");

  if (
    calendarSet.children.length !== CALENDAR_WEEK_NUMBERS.length ||
    weekSet.children.length !== CALENDAR_WEEK_NUMBERS.length ||
    daySet.children.length !== CALENDAR_DAY_STATES.length
  )
    throw new TypeError("calendar live writer: incomplete variant matrix");

  const registry = new Map<string, CalendarVariablePlan>();
  let instanceCount = 0;
  const dayOccurrences: Array<{ Label: string }> = [];

  for (const root of [calendarSet, weekSet, daySet])
    walk(root, (node) => {
      if (node.kind === "instance") {
        instanceCount += 1;
        if (node.componentRef !== "calendar@1/day")
          throw new TypeError(
            `calendar live writer: unknown instance ${node.componentRef}`,
          );
        const label = node.properties.Label;
        const state = node.properties.State;
        if (typeof label !== "string")
          throw new TypeError(
            "calendar live writer: day instance has no Label",
          );
        if (!CALENDAR_DAY_STATES.includes(state as never))
          throw new TypeError(
            "calendar live writer: day instance has no State",
          );
        dayOccurrences.push({ Label: label });
      }
      for (const binding of node.bindings ?? []) {
        const value = atPath(node, binding.field);
        const type = variableType(binding, value);
        const key = `${type}:${binding.variable}`;
        const previous = registry.get(key);
        if (previous && canonicalJson(previous.value) !== canonicalJson(value))
          throw new TypeError(
            `calendar live writer: conflicting fallback for ${binding.variable}`,
          );
        registry.set(key, {
          identity: binding.variable,
          name: sanitizeFigmaVariableName(binding.variable, type),
          type,
          value: value as string | number,
        });
      }
    });

  buildFigmaVariableNameMap(
    [...registry.values()].map(({ identity, type }) => ({
      tokenIdentity: identity,
      type,
    })),
  );
  if (registry.size === 0)
    throw new TypeError("calendar live writer: zero planned variables");
  if (instanceCount !== CALENDAR_FIGMA_INSTANCES_PER_SOURCE)
    throw new TypeError(
      `calendar live writer requires ${CALENDAR_FIGMA_INSTANCES_PER_SOURCE} day instances; found ${instanceCount}`,
    );
  if (dayOccurrences.length === 0)
    throw new TypeError(
      "calendar live writer: no day instances to default from",
    );

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    calendarAxes,
    weekAxes,
    dayAxes,
    calendarSet,
    weekSet,
    daySet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    dayDefaults: dayOccurrences[0]!,
    instanceCount,
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateCalendarFigmaSourcePlans(
  plans: readonly CalendarFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("calendar live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("calendar live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (typeof plan.dayDefaults.Label !== "string")
      failures.push(
        `${plan.adapterIdentity}: day defaults missing source Label`,
      );
    if (
      plan.calendarSet.children.length +
        plan.weekSet.children.length +
        plan.daySet.children.length !==
      CALENDAR_FIGMA_VARIANTS_PER_SOURCE
    )
      failures.push(
        `${plan.adapterIdentity}: expected ${CALENDAR_FIGMA_VARIANTS_PER_SOURCE} variants`,
      );
  }
  return failures;
}

const writerRuntime = (namespace: string, version: number): string =>
  String.raw`
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = ${JSON.stringify(namespace)};
const WRITER_VERSION=${JSON.stringify(String(version))};
const PAGE_OWNER="recipe/calendar/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("CALENDAR-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("CALENDAR-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("CALENDAR-TABLE-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v1")throw new Error("CALENDAR-V1-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v2")throw new Error("CALENDAR-V2-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v3")throw new Error("CALENDAR-V3-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v4")throw new Error("CALENDAR-V4-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v5")throw new Error("CALENDAR-V5-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v6")throw new Error("CALENDAR-V6-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v7")throw new Error("CALENDAR-V7-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v8")throw new Error("CALENDAR-V8-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v9")throw new Error("CALENDAR-V9-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v10")throw new Error("CALENDAR-V10-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v11")throw new Error("CALENDAR-V11-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v12")throw new Error("CALENDAR-V12-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v13")throw new Error("CALENDAR-V13-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v14")throw new Error("CALENDAR-V14-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v15")throw new Error("CALENDAR-V15-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v16")throw new Error("CALENDAR-V16-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v17")throw new Error("CALENDAR-V17-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v18")throw new Error("CALENDAR-V18-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v19")throw new Error("CALENDAR-V19-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v20")throw new Error("CALENDAR-V20-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v21")throw new Error("CALENDAR-V21-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v22")throw new Error("CALENDAR-V22-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v23")throw new Error("CALENDAR-V23-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v24")throw new Error("CALENDAR-V24-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v25")throw new Error("CALENDAR-V25-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v26")throw new Error("CALENDAR-V26-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v27")throw new Error("CALENDAR-V27-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v28")throw new Error("CALENDAR-V28-IDENTITY-REUSE");
if(PLAN.runIdentity==="19be1c96-calendar-v29")throw new Error("CALENDAR-V29-IDENTITY-REUSE");
if(PLAN.runIdentity==="da4456d8-calendar-v30")throw new Error("CALENDAR-V30-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "CALENDAR-MUST-NOT-WRITE-INPUT-PAGE";
void "CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE";
void "CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE";
void "CALENDAR-MUST-NOT-WRITE-TABLE-PAGE";
void "CALENDAR-MUST-NOT-WRITE-V30-PAGE";
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="85:6781")throw new Error("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="173:48924")throw new Error("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="180:56126")throw new Error("CALENDAR-MUST-NOT-WRITE-V30-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(!page){page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);}
else if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("CALENDAR-PAGE-OWNERSHIP-COLLISION:"+page.id);
if(page.id==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="85:6781")throw new Error("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE");
if(page.id==="180:56126")throw new Error("CALENDAR-MUST-NOT-WRITE-V30-PAGE");
await figma.setCurrentPageAsync(page);
setSharedData(page,"pageOwner",PAGE_OWNER);
setSharedData(page,"runIdentity",PLAN.runIdentity);
setSharedData(page,"writerVersion",WRITER_VERSION);
mutatedNodeIds.push(page.id);
const rgba=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:parseInt(hex.slice(7,9),16)/255});
const paint=hex=>{const value=rgba(hex);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const allFonts=await figma.listAvailableFontsAsync();
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&font.fontName.style===candidate.style)).find(Boolean);
  if(!found)throw new Error("CALENDAR-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("CALENDAR-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("CALENDAR-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const source of PLAN.sources){
  const oldSections=page.children.filter(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  for(const old of oldSections){
    const collectionId=getSharedData(old,"variableCollectionId");
    if(collectionId){const collection=await figma.variables.getVariableCollectionByIdAsync(collectionId);if(collection&&!collection.remote){if(getSharedData(collection,"collectionOwner")!==PAGE_OWNER+"/variable-collection"||getSharedData(collection,"runIdentity")!==PLAN.runIdentity)throw new Error("CALENDAR-VARIABLE-COLLECTION-OWNERSHIP-COLLISION:"+collection.id);collection.remove();}}
    old.remove();
  }
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Calendar / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("CALENDAR-VARIABLE-COLLECTION-COLLISION:"+collectionName);
  const collection=figma.variables.createVariableCollection(collectionName);
  setSharedData(collection,"collectionOwner",PAGE_OWNER+"/variable-collection");
  setSharedData(collection,"runIdentity",PLAN.runIdentity);
  setSharedData(collection,"adapterIdentity",source.adapterIdentity);
  collection.renameMode(collection.modes[0].modeId,"Default");
  collection.hiddenFromPublishing=true;
  setSharedData(section,"variableCollectionId",collection.id);
  const modeId=collection.modes[0].modeId,variables=new Map();
  for(const planned of source.variables){
    const variable=figma.variables.createVariable(planned.name,collection,planned.type);
    variable.scopes=["ALL_SCOPES"];
    variable.setValueForMode(modeId,planned.type==="COLOR"?rgba(planned.value):planned.value);
    variable.setVariableCodeSyntax("WEB","var(--"+planned.identity.replace(/[^a-zA-Z0-9_-]+/g,"-").toLowerCase()+")");
    variables.set(planned.type+":"+planned.identity,variable);
  }
  const boundPaint=(hex,binding)=>{
    const base=paint(hex);
    if(!binding)return base;
    const variable=variables.get("COLOR:"+binding.variable);
    if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
    return figma.variables.setBoundVariableForPaint(base,"color",variable);
  };
  const bindFloat=(node,field,binding)=>{
    if(!binding)return;
    const variable=variables.get("FLOAT:"+binding.variable);
    if(!variable)throw new Error("MISSING-FLOAT-VARIABLE:"+binding.variable);
    node.setBoundVariable(field,variable);
  };
  const bindingFor=(ir,field)=>(ir.bindings||[]).find(binding=>binding.field===field);
  const tag=(node,ir,ownershipKey)=>{
    setSharedData(node,"runIdentity",PLAN.runIdentity);
    setSharedData(node,"adapterIdentity",source.adapterIdentity);
    setSharedData(node,"recipeHash",source.recipeHash);
    setSharedData(node,"envelopeHash",source.envelopeHash);
    setSharedData(node,"ownershipKey",ownershipKey);
  };
  const applyPaints=(node,ir)=>{
    if(ir.fills)node.fills=ir.fills.map((entry,index)=>boundPaint(entry.color,bindingFor(ir,"fills."+index+".color")));
    if(ir.strokes){
      node.strokes=ir.strokes.map((entry,index)=>boundPaint(entry.paint.color,bindingFor(ir,"strokes."+index+".paint.color")));
      if(ir.strokes[0]){
        node.strokeWeight=ir.strokes[0].weight;node.strokeAlign=ir.strokes[0].align.toUpperCase();
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    void "CALENDAR-WRITER-MIN-WIDTH-ZERO-UNSET";
    if(layout.minWidth!==undefined)node.minWidth=layout.minWidth===0?null:layout.minWidth;
    if(layout.minHeight!==undefined)node.minHeight=layout.minHeight===0?null:layout.minHeight;
    if(ir.clipsContent!==undefined)node.clipsContent=ir.clipsContent;
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
  };
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
    else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
    else node.layoutSizingHorizontal="FIXED";
    if(height.mode==="fill")node.layoutSizingVertical="FILL";
    else if(height.mode==="hug")node.layoutSizingVertical="HUG";
    else node.layoutSizingVertical="FIXED";
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const applySetLayout=(set,ir)=>{applyLayout(set,ir);applyPaints(set,ir);applySizing(set,ir);};
  const firstSegment=name=>name.split(" :: ",1)[0];
  const sceneRole=name=>{const role=firstSegment(name);return role.includes("=")?"":role;};
  void "CALENDAR-WRITER-FIRST-SEGMENT-BIND";
  const dayByState=new Map();
  let dayLabelProperty="";
  const instanceLabelWrites=[];
  void "CALENDAR-WRITER-BIND-LABEL-AFTER-INSTANCE-CHARACTERS";
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("CALENDAR-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize=ir.width.mode==="fill"?"HEIGHT":"WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "CALENDAR-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "CALENDAR-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
      if(label.characters.trim().length>0&&(label.width<=0||label.absoluteRenderBounds===null)){
        const chain=ir.type.fontProvenance.fallbackChain||[];
        const resolvedFamily=ir.type.fontProvenance.resolvedFamily;
        const resolvedStyle=ir.type.fontProvenance.resolvedStyle;
        let painted=false;
        for(const candidate of chain){
          if(candidate.family===resolvedFamily&&candidate.style===resolvedStyle)continue;
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&entry.fontName.style===candidate.style);
          if(!found)continue;
          await figma.loadFontAsync(found.fontName);
          label.fontName=found.fontName;
          label.characters=ir.characters;
          if(label.width>0&&label.absoluteRenderBounds){painted=true;break;}
        }
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("CALENDAR-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else if(ir.kind==="instance"){
      void "CALENDAR-WRITER-ONLY-DAY-IS-INSTANTIABLE";
      if(ir.componentRef!=="calendar@1/day")throw new Error("CALENDAR-UNKNOWN-INSTANCE:"+ir.componentRef);
      const main=dayByState.get(ir.properties.State);
      if(!main)throw new Error("CALENDAR-DAY-MAIN-ABSENT:"+ir.properties.State);
      node=main.createInstance();
      void "CALENDAR-WRITER-DAY-LABEL-FROM-SET";
      if(!dayLabelProperty)throw new Error("CALENDAR-DAY-PROPERTY-ABSENT:Label");
      if(typeof ir.properties.Label!=="string")throw new Error("CALENDAR-DAY-SOURCE-ABSENT:Label");
      void "CALENDAR-WRITER-LOAD-INSTANCE-FONT-BEFORE-SET-PROPERTIES";
      for(const text of node.findAllWithCriteria({types:["TEXT"]})){
        if(sceneRole(text.name)!=="calendar/day/label")continue;
        if(text.fontName!==figma.mixed)await figma.loadFontAsync(text.fontName);
      }
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"&&ir.width.mode!=="fill"){
      void "CALENDAR-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "CALENDAR-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("CALENDAR-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else if(ir.kind==="instance"){
      void "CALENDAR-WRITER-INSTANCE-CARRIES-DAY-CELL-SIZE";
      const main=dayByState.get(ir.properties.State);
      if(!main)throw new Error("CALENDAR-DAY-MAIN-ABSENT:"+ir.properties.State);
      if(main.layoutSizingHorizontal!=="FIXED"||main.layoutSizingVertical!=="FIXED")throw new Error("CALENDAR-DAY-CELL-NOT-MEASURED:"+main.name);
      node.resizeWithoutConstraints(main.width,main.height);
      node.layoutSizingHorizontal="FIXED";
      node.layoutSizingVertical="FIXED";
      if(node.layoutSizingHorizontal!=="FIXED"||node.layoutSizingVertical!=="FIXED"||node.width!==main.width||node.height!==main.height)throw new Error("CALENDAR-DAY-INSTANCE-HUG:"+ir.role);
    }else applySizing(node,ir);
    if(ir.kind==="instance"){
      void "CALENDAR-WRITER-INSTANCE-LABEL-AFTER-APPEND";
      void "CALENDAR-WRITER-INSTANCE-CHARACTERS-BEFORE-LABEL-BIND";
      void "CALENDAR-WRITER-INSTANCE-LABEL-VIA-CHARACTERS";
      for(const text of node.findAllWithCriteria({types:["TEXT"]})){
        if(sceneRole(text.name)!=="calendar/day/label")continue;
        if(text.fontName!==figma.mixed)await figma.loadFontAsync(text.fontName);
        if(text.characters!==ir.properties.Label)text.characters=ir.properties.Label;
        if(text.characters!==ir.properties.Label)throw new Error("CALENDAR-DAY-LABEL-MISMATCH:"+ir.role);
      }
      const main=dayByState.get(ir.properties.State);
      instanceLabelWrites.push({node,label:ir.properties.Label,boxWidth:main.width,boxHeight:main.height});
    }
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("CALENDAR-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintSet=async(setIr,kind)=>{
    const components=[];
    for(const [componentIndex,ir] of setIr.children.entries()){
      const component=figma.createComponent();component.clipsContent=false;
      component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");
      component.description="recipe-role:"+(ir.role||"");
      tag(component,ir,kind+"/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
      section.appendChild(component);
      if(kind==="day"){
        void "CALENDAR-WRITER-DAY-CELL-BOX-BEFORE-CHILDREN";
        applySizing(component,ir);
      }
      for(const [childIndex,child] of ir.children.entries())await render(child,component,kind+"/children/"+componentIndex+"/children/"+childIndex);
      applySizing(component,ir);
      if(kind==="calendar"&&component.layoutMode!=="VERTICAL")throw new Error("CALENDAR-FAKE-LAYOUT:"+component.name);
      if(kind==="week"&&component.layoutMode!=="HORIZONTAL")throw new Error("CALENDAR-FAKE-LAYOUT:"+component.name);
      if(kind==="day"&&component.layoutMode!=="HORIZONTAL")throw new Error("CALENDAR-FAKE-LAYOUT:"+component.name);
      void "CALENDAR-WRITER-DAY-CELL-BOX";
      if(kind==="day"&&(component.layoutSizingHorizontal!=="FIXED"||component.layoutSizingVertical!=="FIXED"))throw new Error("CALENDAR-DAY-CELL-NOT-MEASURED:"+component.name);
      components.push(component);createdNodeIds.push(component.id);
    }
    const set=figma.combineAsVariants(components,section);
    void "CALENDAR-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
    set.name=setIr.role+" :: "+(setIr.label||source.sourceName);
    set.description="Experimental calendar@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    applySetLayout(set,setIr);
    setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"ownershipKey",kind);
    return set;
  };
  const daySet=await mintSet(source.daySet,"day");
  void "CALENDAR-WRITER-DAY-PROPERTIES";
  dayLabelProperty=daySet.addComponentProperty("Label","TEXT",source.dayDefaults.Label);
  for(const component of daySet.children){
    const props=Object.fromEntries(component.name.split(", ").map(part=>{const index=part.indexOf("=");return [part.slice(0,index),part.slice(index+1)];}));
    dayByState.set(props.State,component);
  }
  const weekSet=await mintSet(source.weekSet,"week");
  const calendarSet=await mintSet(source.calendarSet,"calendar");
  void "CALENDAR-WRITER-BIND-LABEL-AFTER-WEEK-AND-MONTH";
  for(const component of daySet.children){
    for(const descendant of component.findAllWithCriteria({types:["TEXT"]})){
      if(sceneRole(descendant.name)==="calendar/day/label")descendant.componentPropertyReferences={characters:dayLabelProperty};
    }
  }
  void "CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-BIND";
  void "CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-APPEND";
  void "CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-PAINTED-FALLBACK";
  for(const entry of instanceLabelWrites){
    for(const text of entry.node.findAllWithCriteria({types:["TEXT"]})){
      if(sceneRole(text.name)!=="calendar/day/label")continue;
      if(text.fontName!==figma.mixed)await figma.loadFontAsync(text.fontName);
    }
    entry.node.setProperties({[dayLabelProperty]:entry.label});
    void "CALENDAR-WRITER-INSTANCE-CARRIES-DAY-CELL-SIZE";
    entry.node.resizeWithoutConstraints(entry.boxWidth,entry.boxHeight);
    entry.node.layoutSizingHorizontal="FIXED";
    entry.node.layoutSizingVertical="FIXED";
    for(const text of entry.node.findAllWithCriteria({types:["TEXT"]})){
      if(sceneRole(text.name)!=="calendar/day/label")continue;
      if(text.characters!==entry.label)throw new Error("CALENDAR-DAY-LABEL-MISMATCH:"+entry.node.name);
    }
  }
  daySet.x=80;daySet.y=96;weekSet.x=80;weekSet.y=daySet.y+daySet.height+96;calendarSet.x=80;calendarSet.y=weekSet.y+weekSet.height+96;
  section.resizeWithoutConstraints(Math.max(daySet.width,weekSet.width,calendarSet.width)+160,calendarSet.y+calendarSet.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,calendarSetId:calendarSet.id,weekSetId:weekSet.id,daySetId:daySet.id,collectionId:collection.id,variableCount:variables.size,variantCount:calendarSet.children.length+weekSet.children.length+daySet.children.length,calendarCells:calendarSet.children.length,weekCells:weekSet.children.length,dayCells:daySet.children.length,instanceCount:source.instanceCount,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;

export function emitCalendarFigmaWriter(
  inputs: readonly CalendarFigmaWriterInput[],
): CalendarFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateCalendarFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
    `-${CALENDAR_FIGMA_RUN_SUFFIX}`;
  // Compared through a `string` local on purpose. These are defence-in-depth
  // guards against a future edit pointing this writer at another archetype's
  // namespace; comparing the literal constants directly is statically always
  // false, which is what TS2367 says and why every other writer in this repo
  // carries that error. The runtime guard is the point, so keep it and let the
  // type system see it as a real comparison.
  const namespace: string = CALENDAR_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    identity === FORBIDDEN_COMBOBOX_RUN_IDENTITY
  )
    throw new TypeError(
      "calendar writer must not reuse Input, Combobox, or Table identity",
    );

  const pageName = `Recipe Pivot / Calendar / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      sourceName: source.sourceName,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      variables: source.variables,
      dayDefaults: source.dayDefaults,
      instanceCount: source.instanceCount,
      comparedIrFacts: source.comparedIrFacts,
      calendarSet: source.calendarSet,
      weekSet: source.weekSet,
      daySet: source.daySet,
    })),
  };

  const runtime = writerRuntime(
    CALENDAR_FIGMA_NAMESPACE,
    CALENDAR_FIGMA_WRITER_VERSION,
  );

  // Self-checks. Each one pins a lesson this lineage paid for.
  if (
    runtime.includes("CALENDAR-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") === false
  )
    throw new TypeError(
      "calendar writer must carry the compile label into the set name (Table live v25 class)",
    );
  if (
    runtime.includes(
      'set.name=setIr.role+" :: "+(setIr.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "calendar writer set name must prefer the compile label",
    );
  if (runtime.includes("CALENDAR-WRITER-ONLY-DAY-IS-INSTANTIABLE") === false)
    throw new TypeError("calendar writer must instantiate only calendar@1/day");
  if (runtime.includes("CALENDAR-WRITER-DAY-CELL-BOX") === false)
    throw new TypeError(
      "calendar writer must refuse a day cell that is not a measured box",
    );
  if (
    runtime.includes("CALENDAR-WRITER-DAY-CELL-BOX-BEFORE-CHILDREN") === false
  )
    throw new TypeError(
      "calendar writer must size the day cell before minting its hug label",
    );
  if (
    runtime.includes(
      "CALENDAR-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "calendar writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("CALENDAR-V1-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v1 run identity");
  if (runtime.includes("CALENDAR-V2-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v2 run identity");
  if (runtime.includes("CALENDAR-V3-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v3 run identity");
  if (runtime.includes("CALENDAR-V4-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v4 run identity");
  if (runtime.includes("CALENDAR-V5-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v5 run identity");
  if (runtime.includes("CALENDAR-V6-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v6 run identity");
  if (runtime.includes("CALENDAR-V7-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v7 run identity");
  if (runtime.includes("CALENDAR-V8-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v8 run identity");
  if (runtime.includes("CALENDAR-V9-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v9 run identity");
  if (runtime.includes("CALENDAR-V10-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v10 run identity");
  if (runtime.includes("CALENDAR-V11-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v11 run identity");
  if (runtime.includes("CALENDAR-V12-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v12 run identity");
  if (runtime.includes("CALENDAR-V13-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v13 run identity");
  if (runtime.includes("CALENDAR-V14-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v14 run identity");
  if (runtime.includes("CALENDAR-V15-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v15 run identity");
  if (runtime.includes("CALENDAR-V16-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v16 run identity");
  if (runtime.includes("CALENDAR-V17-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v17 run identity");
  if (runtime.includes("CALENDAR-V18-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v18 run identity");
  if (runtime.includes("CALENDAR-V19-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v19 run identity");
  if (runtime.includes("CALENDAR-V20-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v20 run identity");
  if (runtime.includes("CALENDAR-V21-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v21 run identity");
  if (runtime.includes("CALENDAR-V22-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v22 run identity");
  if (runtime.includes("CALENDAR-V23-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v23 run identity");
  if (runtime.includes("CALENDAR-V24-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v24 run identity");
  if (runtime.includes("CALENDAR-V25-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v25 run identity");
  if (runtime.includes("CALENDAR-V26-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v26 run identity");
  if (runtime.includes("CALENDAR-V27-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v27 run identity");
  if (runtime.includes("CALENDAR-V28-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v28 run identity");
  if (runtime.includes("CALENDAR-V29-IDENTITY-REUSE") === false)
    throw new TypeError("calendar writer must refuse the v29 run identity");
  if (
    runtime.includes("CALENDAR-WRITER-INSTANCE-CARRIES-DAY-CELL-SIZE") ===
      false ||
    runtime.includes("CALENDAR-DAY-INSTANCE-HUG") === false
  )
    throw new TypeError(
      "calendar writer must carry the named dayCell-size box on day instances instead of stamping hug",
    );
  if (
    runtime.includes("CALENDAR-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC") ===
      false ||
    runtime.includes("CALENDAR-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH") ===
      false ||
    runtime.includes("CALENDAR-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC") ===
      false ||
    runtime.includes("CALENDAR-FONT-ZERO-INTRINSIC") === false
  )
    throw new TypeError(
      "calendar writer must hug from post-character intrinsic and walk a zero-glyph named fallback",
    );
  if (runtime.includes("Math.max(node.width,1)") && runtime.includes("hugTextIntrinsic={width:Math.max(node.width,1)"))
    throw new TypeError(
      "calendar writer must not stamp hug from a 1px empty-glyph measure",
    );
  if (runtime.includes("CALENDAR-WRITER-INSTANCE-LABEL-AFTER-APPEND") === false)
    throw new TypeError(
      "calendar writer must re-apply instance Label after appendChild",
    );
  if (runtime.includes("CALENDAR-WRITER-DAY-LABEL-FROM-SET") === false)
    throw new TypeError(
      "calendar writer must take day Label presence from the set-issued key",
    );
  if (runtime.includes('propertyKey(node,"Label")'))
    throw new TypeError(
      "calendar writer must not read Label from a fresh instance componentProperties",
    );
  if (
    runtime.includes(
      "CALENDAR-WRITER-LOAD-INSTANCE-FONT-BEFORE-SET-PROPERTIES",
    ) === false
  )
    throw new TypeError(
      "calendar writer must load the instance TEXT font before writing Label",
    );
  if (
    runtime.includes("CALENDAR-WRITER-INSTANCE-LABEL-VIA-CHARACTERS") === false
  )
    throw new TypeError(
      "calendar writer must verify instance Label via text.characters after append",
    );
  if (
    runtime.includes(
      "CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-PAINTED-FALLBACK",
    ) === false ||
    runtime.includes(
      "CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-APPEND",
    ) === false ||
    runtime.includes(
      "CALENDAR-WRITER-INSTANCE-LABEL-VIA-SET-PROPERTIES-AFTER-BIND",
    ) === false ||
    runtime.includes(
      "entry.node.setProperties({[dayLabelProperty]:entry.label})",
    ) === false
  )
    throw new TypeError(
      "calendar writer must write instance Label through the set-issued property after a painted fallback",
    );
  if (
    runtime.includes("CALENDAR-WRITER-BIND-LABEL-AFTER-INSTANCE-CHARACTERS") ===
      false ||
    runtime.includes("CALENDAR-WRITER-BIND-LABEL-AFTER-WEEK-AND-MONTH") ===
      false ||
    runtime.includes("CALENDAR-WRITER-INSTANCE-CHARACTERS-BEFORE-LABEL-BIND") ===
      false
  )
    throw new TypeError(
      "calendar writer must bind day Label after instance characters are already written",
    );
  if (
    runtime.indexOf("const calendarSet=await mintSet") >
    runtime.indexOf(
      "descendant.componentPropertyReferences={characters:dayLabelProperty}",
    )
  )
    throw new TypeError(
      "calendar writer must not bind day Label before week and month instances exist",
    );
  if (runtime.includes("node.setProperties({[property]:ir.properties.Label})"))
    throw new TypeError(
      "calendar writer must not read Label from a fresh instance property key",
    );
  if (
    runtime.includes("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE") === false
  )
    throw new TypeError(
      "calendar writer must refuse the Input, Combobox, Button and Table pages",
    );
  if (runtime.includes("CALENDAR-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "calendar writer must refuse font provenance tampering",
    );

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  if (
    code.includes(FORBIDDEN_INPUT_PAGE_ID) &&
    !runtime.includes("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE")
  )
    throw new TypeError("calendar writer must not target the Input page");

  return {
    pageName,
    runIdentity,
    namespace: CALENDAR_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
