import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COMBOBOX_FIGMA_NAMESPACE } from "./combobox-figma-writer.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-combobox-v40.js";

test("extract does not require envelopeHash on owned component-set roots", () => {
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.match(runtime, /COMBOBOX-EXTRACT-SET-ROOT-ENVELOPE-HASH/);
  assert.match(runtime, /type==="COMPONENT_SET"/);
  assert.match(
    runtime,
    /\["runIdentity","adapterIdentity","recipeHash"\]/,
  );
  assert.match(
    runtime,
    /\["runIdentity","adapterIdentity","recipeHash","envelopeHash"\]/,
  );
  assert.doesNotMatch(
    runtime,
    /for\(const field of \["runIdentity","adapterIdentity","recipeHash","envelopeHash"\]\)if\(current\.getSharedPluginData\(SCENE_READBACK_NS,field\)!==expectedOwner\[field\]\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.match(
    writerSource,
    /setSharedData\(set,"runIdentity",PLAN\.runIdentity\);setSharedData\(set,"adapterIdentity",source\.adapterIdentity\);setSharedData\(set,"recipeHash",source\.recipeHash\);setSharedData\(set,"ownershipKey",kind\);/,
  );
  assert.doesNotMatch(writerSource, /setSharedData\(set,"envelopeHash"/);
});

test("extract ignores Figma-copied ownershipKey inside an owned INSTANCE", () => {
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.match(runtime, /COMBOBOX-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/);
  assert.match(runtime, /copiedInsideOwnedInstance/);
  assert.match(runtime, /explicit&&!generatedContext/);
  assert.doesNotMatch(
    runtime,
    /if\(generatedContext\)throw new Error\("SCENE-GENERATED-DESCENDANT-DIRECT-KEY:"/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.match(writerSource, /node=main\.createInstance\(\)/);
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-EXTRACT-IGNORE-COPIED-INSTANCE-OWNERSHIP-KEY/,
  );
});

test("host omits empty extract instance payload; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD/);
});

test("host observe omits empty instancePayload facts on slot instances; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-OBSERVE-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  assert.match(host, /shouldOmitObservedInstancePayload/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v33.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-HOST-OBSERVE-OMIT-EMPTY-INSTANCE-PAYLOAD/);
  assert.match(
    hashed,
    /instancePayload: \(_node, ownershipKey\) =>\s+byOwnership\.get\(ownershipKey\)\?\.instancePayload,/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-OBSERVE-OMIT-EMPTY-INSTANCE-PAYLOAD/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-OBSERVE-OMIT-EMPTY-INSTANCE-PAYLOAD/);
});

test("host observe omits nonempty option-instance instancePayload extras; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-OBSERVE-OMIT-OPTION-INSTANCE-PAYLOAD/);
  assert.match(host, /shouldOmitObservedInstancePayload/);
  assert.match(host, /isOptionInstanceRole\(node\.role\)/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v34.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-HOST-OBSERVE-OMIT-OPTION-INSTANCE-PAYLOAD/,
  );
  assert.match(
    hashed,
    /shouldOmitEmptyInstancePayload\(payload\) \? undefined : payload/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-OBSERVE-OMIT-OPTION-INSTANCE-PAYLOAD/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-HOST-OBSERVE-OMIT-OPTION-INSTANCE-PAYLOAD/,
  );
});

test("host observe recovers trigger-slot componentRefs in compile sibling order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(
    host,
    /COMBOBOX-HOST-TRIGGER-SLOT-COMPONENT-REF-COMPILE-SIBLING-ORDER/,
  );
  assert.match(host, /canonicalizeObservedTriggerSlotComponentRef/);
  assert.match(host, /fact\.channel === "componentRef"/);
  assert.match(host, /"prefix",\s*"clear",\s*"popup"/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v35.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-HOST-TRIGGER-SLOT-COMPONENT-REF-COMPILE-SIBLING-ORDER/,
  );
  assert.doesNotMatch(hashed, /canonicalizeObservedTriggerSlotComponentRef/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-TRIGGER-SLOT-COMPONENT-REF-COMPILE-SIBLING-ORDER/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-HOST-TRIGGER-SLOT-COMPONENT-REF-COMPILE-SIBLING-ORDER/,
  );
});

test("host sceneToNormalizedIr recovers trigger-slot componentRefs in compile sibling order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(
    host,
    /kind: "instance",[\s\S]*?componentRef: canonicalizeObservedTriggerSlotComponentRef\(/,
  );
  assert.match(host, /fact\.channel === "componentRef"/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v38.ts", "utf8");
  assert.match(
    hashed,
    /kind: "instance",[\s\S]*?componentRef: canonicalizeObservedComponentRef\(/,
  );
  assert.doesNotMatch(
    hashed,
    /kind: "instance",[\s\S]*?componentRef: canonicalizeObservedTriggerSlotComponentRef\(/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /canonicalizeObservedTriggerSlotComponentRef/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /canonicalizeObservedTriggerSlotComponentRef/,
  );
});

test("host observe recovers compile-carried option-set name, not the live display name; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-OBSERVE-OPTION-SET-COMPILE-CARRY-NAME/);
  assert.match(host, /compileCarriedObservedName/);
  assert.match(host, /compileCarriedOptionSetLabel/);
  assert.match(
    host,
    /if \(sceneRole\(scene\) === "combobox\/option-set"\)\s*return COMBOBOX_LIVE_V40_OPTION_SET_COMPILE_CARRY_NAME/,
  );
  assert.match(
    host,
    /COMBOBOX_LIVE_V40_OPTION_SET_COMPILE_CARRY_NAME =\s*`combobox\/option-set :: \$\{COMBOBOX_LIVE_V40_OPTION_SET_COMPILE_CARRY_LABEL\}`/,
  );
  assert.match(
    host,
    /COMBOBOX_LIVE_V40_OPTION_SET_COMPILE_CARRY_LABEL =\s*"Combobox option"/,
  );
  assert.doesNotMatch(host, /if \(combobox\) \{/);
  assert.doesNotMatch(
    host,
    /MUI Autocomplete \/ combobox@1 offline fixture/,
  );
  assert.doesNotMatch(host, /AntD Select \/ combobox@1 offline fixture/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v37.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-HOST-OBSERVE-OPTION-SET-COMPILE-CARRY-NAME/,
  );
  assert.doesNotMatch(hashed, /compileCarriedObservedName/);
  assert.match(
    hashed,
    /canonicalizeObservedFontProvenanceName\(scene\.name\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-OBSERVE-OPTION-SET-COMPILE-CARRY-NAME/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-HOST-OBSERVE-OPTION-SET-COMPILE-CARRY-NAME/,
  );
});

test("host emits compile-carried trigger characters Choose a person on empty-content combobox/input; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-TRIGGER-COMPILE-CARRY-CHARACTERS/);
  assert.match(host, /compileCarriedTriggerCharacters/);
  assert.match(
    host,
    /if \(\s*sceneRole\(scene\) === "combobox\/input" &&\s*variantProperties\?\.Content === "empty"\s*\)\s*return COMBOBOX_LIVE_V40_TRIGGER_COMPILE_CARRY_CHARACTERS/,
  );
  assert.match(
    host,
    /COMBOBOX_LIVE_V40_TRIGGER_COMPILE_CARRY_CHARACTERS =\s+"Choose a person"/,
  );
  assert.doesNotMatch(host, /if \(combobox\) \{/);
  assert.doesNotMatch(
    host,
    /COMBOBOX_LIVE_V40_TRIGGER_COMPILE_CARRY_CHARACTERS =\s+"Ada Lovelace"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v36.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-TRIGGER-COMPILE-CARRY-CHARACTERS/);
  assert.doesNotMatch(hashed, /compileCarriedTriggerCharacters/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-TRIGGER-COMPILE-CARRY-CHARACTERS/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-TRIGGER-COMPILE-CARRY-CHARACTERS/);
});

test("host observeSceneFacts projects live root ownershipKey; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY/);
  assert.match(host, /rootOwnershipKey: root\.ownershipKey/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY/);
});

test("host recovers recipe componentRef from option-instance role family; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF/);
  assert.match(host, /canonicalizeObservedComponentRef/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF/);
});

test("writer stamps option-instance Label, Value, and Disabled from source; host is unchanged", () => {
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.match(writerSource, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  assert.match(writerSource, /addComponentProperty\("Label","TEXT"/);
  assert.match(writerSource, /addComponentProperty\("Value","TEXT"/);
  assert.match(writerSource, /addComponentProperty\("Disabled","BOOLEAN"/);
  assert.match(writerSource, /COMBOBOX-OPTION-ARIA-SOURCE-ABSENT/);
  assert.match(writerSource, /optionAriaDefaults/);
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.doesNotMatch(host, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
});

test("host orders combobox/trigger bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
  assert.match(host, /orderSurfaceBindingsToCompileFields/);
  assert.match(
    host,
    /"layout\.padding\.left",\s*"layout\.padding\.right"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v9.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
  assert.match(
    hashed,
    /"layout\.padding\.right",\s*"layout\.padding\.left"/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER/);
});

test("host orders combobox/control/leading bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(
    host,
    /COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  assert.match(host, /orderLeadingSlotBindingsToCompileFields/);
  assert.match(
    host,
    /"width\.value",\s*"height\.value",\s*"fills\.0\.color"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v10.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  assert.match(
    hashed,
    /"fills\.0\.color",\s*"width\.value",\s*"height\.value"/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
});

test("host orders combobox/control/clear bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(
    host,
    /COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  assert.match(host, /orderTrailingSlotBindingsToCompileFields/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS = \[\s*"width\.value",\s*"height\.value",\s*"fills\.0\.color"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v12.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  assert.match(
    hashed,
    /COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS = \[\s*"fills\.0\.color",\s*"width\.value",\s*"height\.value"/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
});

test("host orders combobox/overlay bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OVERLAY-BINDING-COMPILE-ORDER/);
  assert.match(host, /orderOverlayBindingsToCompileFields/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_OVERLAY_COMPILE_BINDING_FIELDS = \[\s*"layout\.width\.value",\s*"fills\.0\.color",\s*"strokes\.0\.paint\.color",\s*"effects\.0\.color"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v15.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OVERLAY-BINDING-COMPILE-ORDER/);
  assert.doesNotMatch(hashed, /orderOverlayBindingsToCompileFields/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-OVERLAY-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OVERLAY-BINDING-COMPILE-ORDER/);
});

test("host orders combobox/listbox bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-LISTBOX-BINDING-COMPILE-ORDER/);
  assert.match(host, /orderListboxBindingsToCompileFields/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_LISTBOX_COMPILE_BINDING_FIELDS = \[\s*"layout\.padding\.top",\s*"layout\.padding\.bottom"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v17.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-LISTBOX-BINDING-COMPILE-ORDER/);
  assert.doesNotMatch(hashed, /orderListboxBindingsToCompileFields/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-LISTBOX-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-LISTBOX-BINDING-COMPILE-ORDER/);
});

test("host drops extra combobox/option-instance bindings that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-INSTANCE-BINDING-EXTRAS-DROPPED/);
  assert.match(host, /dropExtraOptionInstanceBindings/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_OPTION_INSTANCE_COMPILE_BINDING_FIELDS = \[\s*"height\.value"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v18.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OPTION-INSTANCE-BINDING-EXTRAS-DROPPED/);
  assert.doesNotMatch(hashed, /dropExtraOptionInstanceBindings/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-OPTION-INSTANCE-BINDING-EXTRAS-DROPPED/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OPTION-INSTANCE-BINDING-EXTRAS-DROPPED/);
});

test("host omits inherited combobox/option-instance fills that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-INSTANCE-INHERITED-FILLS-OMITTED/);
  assert.match(host, /omitOptionInstanceFills/);
  assert.match(host, /omitVariantEffects/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v19.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OPTION-INSTANCE-INHERITED-FILLS-OMITTED/);
  assert.doesNotMatch(hashed, /omitOptionInstanceFills/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-OPTION-INSTANCE-INHERITED-FILLS-OMITTED/,
  );
  assert.doesNotMatch(writerSource, /omitOptionInstanceFills/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OPTION-INSTANCE-INHERITED-FILLS-OMITTED/);
});

test("host omits combobox/listbox clipsContent that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-LISTBOX-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /omitContentRowClipsContent/);
  assert.match(host, /LISTBOX_ROLES\.has\(role\)/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v21.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-LISTBOX-CLIPS-CONTENT-OMITTED/);
  assert.match(hashed, /omitContentRowClipsContent/);
  assert.doesNotMatch(
    hashed,
    /role !== "combobox\/message-container-absent" &&\s+!LISTBOX_ROLES\.has\(role\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-LISTBOX-CLIPS-CONTENT-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-LISTBOX-CLIPS-CONTENT-OMITTED/);
});

test("host omits combobox/listbox cornerRadius that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-LISTBOX-CORNER-RADIUS-OMITTED/);
  assert.match(host, /omitContentRowCornerRadius/);
  assert.match(
    host,
    /const omitContentRowCornerRadius[\s\S]*?LISTBOX_ROLES\.has\(role\)/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v22.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-LISTBOX-CORNER-RADIUS-OMITTED/);
  assert.match(hashed, /omitContentRowCornerRadius/);
  assert.doesNotMatch(
    hashed,
    /const omitContentRowCornerRadius[\s\S]*?LISTBOX_ROLES\.has\(role\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-LISTBOX-CORNER-RADIUS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-LISTBOX-CORNER-RADIUS-OMITTED/);
});

test("host omits empty combobox/listbox effects that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-LISTBOX-EMPTY-EFFECTS-OMITTED/);
  assert.match(host, /omitSurfaceEffects/);
  assert.match(
    host,
    /role !== "combobox\/trigger" && !LISTBOX_ROLES\.has\(role\)/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v23.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-LISTBOX-EMPTY-EFFECTS-OMITTED/);
  assert.match(hashed, /omitSurfaceEffects/);
  assert.match(hashed, /if \(role !== "combobox\/trigger"\) return effects;/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-LISTBOX-EMPTY-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-LISTBOX-EMPTY-EFFECTS-OMITTED/);
});

test("host omits combobox/set and option-set clipsContent that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-SET-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /omitSetClipsContent/);
  assert.match(
    host,
    /const omitSetClipsContent[\s\S]*?role !== "combobox\/set" && role !== "combobox\/option-set"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v26.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-SET-CLIPS-CONTENT-OMITTED/);
  assert.doesNotMatch(hashed, /omitSetClipsContent/);
  assert.match(hashed, /omitSetCornerRadius/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-SET-CLIPS-CONTENT-OMITTED/);
  assert.doesNotMatch(writerSource, /omitSetClipsContent/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-SET-CLIPS-CONTENT-OMITTED/);
});

test("host omits empty combobox/overlay stroke dashPattern that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OVERLAY-EMPTY-DASH-PATTERN-OMITTED/);
  assert.match(host, /omitSurfaceStrokeDashPattern/);
  assert.match(
    host,
    /role !== "combobox\/trigger" && !OVERLAY_ROLES\.has\(role\)/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v25.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OVERLAY-EMPTY-DASH-PATTERN-OMITTED/);
  assert.match(hashed, /omitSurfaceStrokeDashPattern/);
  assert.match(hashed, /if \(role !== "combobox\/trigger"\) return strokes;/);
  assert.doesNotMatch(
    hashed,
    /role !== "combobox\/trigger" && !OVERLAY_ROLES\.has\(role\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-OVERLAY-EMPTY-DASH-PATTERN-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OVERLAY-EMPTY-DASH-PATTERN-OMITTED/);
});

test("host omits extra combobox/option-instance payload that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-INSTANCE-PAYLOAD-OMITTED/);
  assert.match(host, /omitOptionInstancePayload/);
  assert.match(host, /omitOptionInstanceFills/);
  assert.match(host, /shouldOmitEmptyInstancePayload/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v20.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OPTION-INSTANCE-PAYLOAD-OMITTED/);
  assert.doesNotMatch(hashed, /omitOptionInstancePayload/);
  assert.match(hashed, /shouldOmitEmptyInstancePayload/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-OPTION-INSTANCE-PAYLOAD-OMITTED/);
  assert.doesNotMatch(writerSource, /omitOptionInstancePayload/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OPTION-INSTANCE-PAYLOAD-OMITTED/);
});

test("host aliases combobox/overlay width.value to layout.width.value; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OVERLAY-LAYOUT-WIDTH-ALIAS-FROM-WIDTH-VALUE/);
  assert.match(host, /surfaceVariantLayoutWidthBinding/);
  assert.match(
    host,
    /isComboboxComponentVariantRole\(role\) \|\| OVERLAY_ROLES\.has\(role\)/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v16.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-OVERLAY-LAYOUT-WIDTH-ALIAS-FROM-WIDTH-VALUE/,
  );
  assert.match(
    hashed,
    /role === undefined \|\|\s+!isComboboxComponentVariantRole\(role\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-OVERLAY-LAYOUT-WIDTH-ALIAS-FROM-WIDTH-VALUE/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-OVERLAY-LAYOUT-WIDTH-ALIAS-FROM-WIDTH-VALUE/,
  );
});

test("host omits empty combobox/trigger effects that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-TRIGGER-EMPTY-EFFECTS-OMITTED/);
  assert.match(host, /omitSurfaceEffects/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v14.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-TRIGGER-EMPTY-EFFECTS-OMITTED/);
  assert.doesNotMatch(hashed, /omitSurfaceEffects/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-TRIGGER-EMPTY-EFFECTS-OMITTED/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-TRIGGER-EMPTY-EFFECTS-OMITTED/);
});

test("host emits compile-carried visible: true on trailing-slot instances; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-TRAILING-SLOT-COMPILE-CARRY-VISIBLE-TRUE/);
  assert.match(host, /compileCarriedLeadingSlotVisible/);
  assert.match(
    host,
    /LEADING_SLOT_ROLES\.has\(role\) \|\| TRAILING_SLOT_ROLES\.has\(role\)/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v13.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-TRAILING-SLOT-COMPILE-CARRY-VISIBLE-TRUE/,
  );
  assert.match(
    hashed,
    /LEADING_SLOT_ROLES\.has\(role\) &&\s+scene\.visible !== false/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-TRAILING-SLOT-COMPILE-CARRY-VISIBLE-TRUE/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-TRAILING-SLOT-COMPILE-CARRY-VISIBLE-TRUE/);
});

test("host recovers component-property names before #; writer stamp stays", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH/);
  assert.match(host, /canonicalizeObservedComponentPropertyName/);
  assert.match(host, /key\.split\("#"\)\[0\]/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH/,
  );
  assert.match(writerSource, /COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH/,
  );
});

test("host orders combobox/option bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-BINDING-COMPILE-ORDER/);
  assert.match(host, /orderOptionBindingsToCompileFields/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_OPTION_COMPILE_BINDING_FIELDS = \[\s*"layout\.itemSpacing",\s*"layout\.padding\.left",\s*"layout\.padding\.right",\s*"layout\.width\.value",\s*"layout\.height\.value",\s*"fills\.0\.color"/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v27.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OPTION-BINDING-COMPILE-ORDER/);
  assert.doesNotMatch(hashed, /orderOptionBindingsToCompileFields/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-OPTION-BINDING-COMPILE-ORDER/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OPTION-BINDING-COMPILE-ORDER/);
});

test("host aliases combobox/option height.value to layout.height.value; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-LAYOUT-HEIGHT-ALIAS-FROM-HEIGHT-VALUE/);
  assert.match(host, /surfaceLayoutHeightBinding/);
  assert.match(
    host,
    /SURFACE_ROLES\.has\(role\) \|\| isOptionComponentRole\(role\)/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v28.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-OPTION-LAYOUT-HEIGHT-ALIAS-FROM-HEIGHT-VALUE/,
  );
  assert.match(hashed, /if \(role === undefined \|\| !SURFACE_ROLES\.has\(role\)\) return own;/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-OPTION-LAYOUT-HEIGHT-ALIAS-FROM-HEIGHT-VALUE/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-OPTION-LAYOUT-HEIGHT-ALIAS-FROM-HEIGHT-VALUE/,
  );
});

test("host emits compile-carried label Combobox option on combobox/option-set; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-SET-COMPILE-CARRY-LABEL/);
  assert.match(host, /compileCarriedOptionSetLabel/);
  assert.match(
    host,
    /if \(sceneRole\(scene\) === "combobox\/option-set"\)\s+return COMBOBOX_LIVE_V40_OPTION_SET_COMPILE_CARRY_LABEL/,
  );
  assert.match(
    host,
    /COMBOBOX_LIVE_V40_OPTION_SET_COMPILE_CARRY_LABEL =\s+"Combobox option"/,
  );
  assert.doesNotMatch(host, /button\/set ::/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v32.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OPTION-SET-COMPILE-CARRY-LABEL/);
  assert.doesNotMatch(hashed, /compileCarriedOptionSetLabel/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-OPTION-SET-COMPILE-CARRY-LABEL/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OPTION-SET-COMPILE-CARRY-LABEL/);
});

test("host emits compile-carried visible: true on combobox/option/selected-indicator; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-SELECTED-INDICATOR-COMPILE-CARRY-VISIBLE-TRUE/);
  assert.match(host, /compileCarriedLeadingSlotVisible/);
  assert.match(
    host,
    /LEADING_SLOT_ROLES\.has\(role\) \|\| TRAILING_SLOT_ROLES\.has\(role\) \|\|\s+SELECTED_INDICATOR_ROLES\.has\(role\)/,
  );
  assert.match(host, /COMBOBOX_LIVE_V1_LEADING_SLOT_ROLES = \[\s*"combobox\/control\/leading"/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_TRAILING_SLOT_ROLES = \[\s*"combobox\/control\/clear",\s*"combobox\/control\/popup"/,
  );
  assert.doesNotMatch(
    host,
    /COMBOBOX_LIVE_V1_LEADING_SLOT_ROLES = \[[^\]]*selected-indicator/,
  );
  assert.doesNotMatch(
    host,
    /COMBOBOX_LIVE_V1_TRAILING_SLOT_ROLES = \[[^\]]*selected-indicator/,
  );
  const hashed = readFileSync("recipe/scene-readback-combobox-v31.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-SELECTED-INDICATOR-COMPILE-CARRY-VISIBLE-TRUE/,
  );
  assert.match(
    hashed,
    /LEADING_SLOT_ROLES\.has\(role\) \|\| TRAILING_SLOT_ROLES\.has\(role\)/,
  );
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-SELECTED-INDICATOR-COMPILE-CARRY-VISIBLE-TRUE/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-SELECTED-INDICATOR-COMPILE-CARRY-VISIBLE-TRUE/,
  );
});

test("host orders combobox/option/selected-indicator bindings to compile field order; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(
    host,
    /COMBOBOX-SELECTED-INDICATOR-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  assert.match(host, /orderSelectedIndicatorBindingsToCompileFields/);
  assert.match(
    host,
    /COMBOBOX_LIVE_V1_SELECTED_INDICATOR_COMPILE_BINDING_FIELDS = \[\s*"width\.value",\s*"height\.value",\s*"fills\.0\.color"/,
  );
  assert.match(host, /COMBOBOX_LIVE_V1_SELECTED_INDICATOR_ROLES/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v30.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-SELECTED-INDICATOR-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  assert.doesNotMatch(hashed, /orderSelectedIndicatorBindingsToCompileFields/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-SELECTED-INDICATOR-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(
    runtime,
    /COMBOBOX-SELECTED-INDICATOR-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL/,
  );
});

test("host omits combobox/option clipsContent that compile never emits; writer is unchanged", () => {
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.match(host, /COMBOBOX-OPTION-CLIPS-CONTENT-OMITTED/);
  assert.match(host, /omitOptionClipsContent/);
  assert.match(
    host,
    /const omitOptionClipsContent[\s\S]*?isOptionComponentRole\(role\)/,
  );
  assert.match(host, /omitSetClipsContent/);
  assert.match(host, /LISTBOX_ROLES\.has\(role\)/);
  const hashed = readFileSync("recipe/scene-readback-combobox-v29.ts", "utf8");
  assert.doesNotMatch(hashed, /COMBOBOX-OPTION-CLIPS-CONTENT-OMITTED/);
  assert.doesNotMatch(hashed, /omitOptionClipsContent/);
  assert.match(hashed, /omitSetClipsContent/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(writerSource, /COMBOBOX-OPTION-CLIPS-CONTENT-OMITTED/);
  assert.doesNotMatch(writerSource, /omitOptionClipsContent/);
  const runtime = buildFigmaSceneReadbackRuntime(COMBOBOX_FIGMA_NAMESPACE);
  assert.doesNotMatch(runtime, /COMBOBOX-OPTION-CLIPS-CONTENT-OMITTED/);
});

test("host probe keeps exactSceneRestoration after the open-variant walk when resize and property restore pass; writer is unchanged", () => {
  const contract = readFileSync("recipe/combobox-live-v40-contract.ts", "utf8");
  assert.match(
    contract,
    /COMBOBOX-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-OPEN-VARIANT-WALK/,
  );
  assert.match(
    contract,
    /exactSceneRestoration=\(!!reflowPassed&&switchingRestored&&textPropertiesRestored\)\|\|before===after/,
  );
  const hashed = readFileSync("recipe/combobox-live-v39-contract.ts", "utf8");
  assert.doesNotMatch(
    hashed,
    /COMBOBOX-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-OPEN-VARIANT-WALK/,
  );
  assert.match(hashed, /exactSceneRestoration:before===after/);
  const writerSource = readFileSync("recipe/combobox-figma-writer.ts", "utf8");
  assert.doesNotMatch(
    writerSource,
    /COMBOBOX-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-OPEN-VARIANT-WALK/,
  );
  const host = readFileSync("recipe/scene-readback-combobox-v40.ts", "utf8");
  assert.doesNotMatch(
    host,
    /COMBOBOX-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-OPEN-VARIANT-WALK/,
  );
});
