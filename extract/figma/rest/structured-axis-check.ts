import assert from "node:assert/strict";
import { mapRestToDump, type RestNodesResponse } from "./map.js";
import type { DumpSet } from "../types.js";

const response: RestNodesResponse = {
  name: "Structured axis fixture",
  nodes: {
    "1:1": {
      document: {
        id: "1:1",
        name: "Button",
        type: "COMPONENT_SET",
        componentPropertyDefinitions: {
          Size: {
            type: "VARIANT",
            defaultValue: "Small",
            variantOptions: ["Small", "Large"],
          },
          "Label#1:9": {
            type: "TEXT",
            defaultValue: "Continue",
          },
        },
        children: [
          {
            id: "1:2",
            name: "Size=Small",
            type: "COMPONENT",
            componentProperties: {
              Size: { type: "VARIANT", value: "Small" },
              "Label#1:9": { type: "TEXT", value: "Continue" },
            },
          },
          {
            id: "1:3",
            name: "Size=Large",
            type: "COMPONENT",
            componentProperties: {
              Size: { type: "VARIANT", value: "Large" },
              "Label#1:9": { type: "TEXT", value: "Continue" },
            },
          },
        ],
      },
      componentSets: {
        "1:1": { name: "Button", key: "button-set-key" },
      },
    },
  },
};

const { dump } = mapRestToDump(response);
const set = dump.Button as DumpSet;

assert.deepEqual(set.propertyDefinitions, {
  Size: {
    type: "VARIANT",
    defaultValue: "Small",
    variantOptions: ["Small", "Large"],
  },
  "Label#1:9": {
    type: "TEXT",
    defaultValue: "Continue",
  },
});
assert.deepEqual(
  set.variants.map((variant) => variant.variantProperties),
  [{ Size: "Small" }, { Size: "Large" }],
);
assert.equal(
  Object.hasOwn(set.propertyDefinitions ?? {}, "Label#1:9"),
  true,
  "non-variant property identity suffix must survive verbatim",
);

const legacyResponse = structuredClone(response);
const legacyDocument = legacyResponse.nodes["1:1"]!.document;
delete legacyDocument.componentPropertyDefinitions;
for (const child of legacyDocument.children ?? []) {
  delete child.componentProperties;
}
const legacySet = mapRestToDump(legacyResponse).dump.Button as DumpSet;
assert.equal(
  Object.hasOwn(legacySet, "propertyDefinitions"),
  false,
  "legacy REST input must not synthesize structured definitions",
);
assert.deepEqual(
  legacySet.variants.map((variant) => variant.variantProperties),
  [undefined, undefined],
  "legacy REST input must not infer tuples from presentation names",
);

console.log(
  "✔ REST structured-axis capture preserves definitions, row tuples, property identities, and legacy absence",
);
