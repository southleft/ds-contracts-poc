import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import { proposeFromDump } from "../../core/propose-figma.js";
import { tokenCorpusFromJson } from "../../core/token-corpus.js";
import { tokenInventoryFromJson } from "../../core/tokens.js";
import { ContractSchema } from "../../scripts/contract-schema.js";
import { emitReact } from "../../core/emit-react.js";
import { mountGenerated } from "../../core/react-test-runtime.js";
import type { DumpSet } from "./types.js";

const corpus = tokenCorpusFromJson({
  primitives: {},
  semantic: {},
  light: {},
  brandDefault: {},
});
const set = (): DumpSet => ({
  setName: "Notice",
  type: "COMPONENT_SET",
  propertyDefinitions: {
    Caption: {
      type: "VARIANT",
      defaultValue: "Shown",
      variantOptions: ["Shown", "Hidden"],
    },
    Tone: {
      type: "VARIANT",
      defaultValue: "Calm",
      variantOptions: ["Calm", "Strong"],
    },
  },
  variants: ["Shown", "Hidden"].flatMap((Caption) =>
    ["Calm", "Strong"].map((Tone) => ({
      name: `Caption=${Caption}, Tone=${Tone}`,
      variantProperties: { Caption, Tone },
      type: "COMPONENT",
      children: [
        {
          name: "Caption",
          type: "TEXT",
          ...(Caption === "Hidden" ? { hidden: true } : {}),
          text: { characters: "Drawn caption", fontSize: 14, fontStyle: "Regular" },
        },
      ],
    })),
  ),
});
const propose = (input = set()) =>
  proposeFromDump(input, { corpus, contractIdByName: new Map(), mintUnbound: true, hiddenCaptured: true });

test("drawn hidden text follows an enum axis through proposal and actual generated React", async () => {
  const result = propose();
  const contract = ContractSchema.parse(result.contract);
  assert.deepEqual(contract.anatomy.root.parts?.Caption.visibleWhen, {
    prop: "caption",
    equals: "shown",
  });
  const emitted = emitReact(contract, {
    contracts: new Map([[contract.id, contract]]),
    icons: new Map(),
    tokens: tokenInventoryFromJson([result.mintedTokens?.tree ?? {}]),
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const render = await mountGenerated(
      page,
      contract.name,
      emitted.tsx,
      emitted.css,
    );
    await render({ caption: "shown", tone: "calm" });
    assert.equal(await page.locator("#root").innerText(), "Drawn caption");
    await render({ caption: "hidden", tone: "strong" });
    assert.equal(await page.locator("#root").innerText(), "");
    await render({ caption: "shown", tone: "strong" });
    assert.equal(await page.locator("#root").innerText(), "Drawn caption");
  } finally {
    await browser.close();
  }
});

test("a direct text visibility binding uses its captured boolean default", () => {
  const input = set();
  input.boolDefaults = { ShowCaption: false };
  for (const variant of input.variants) {
    variant.children![0].propRefs = { visible: "ShowCaption" };
    variant.children![0].hidden = true;
  }
  const contract = ContractSchema.parse(propose(input).contract);
  const prop = contract.props.find(
    (p) => p.bindings.figma.property === "ShowCaption",
  );
  assert.equal(prop?.default, false);
  assert.deepEqual(contract.anatomy.root.parts?.Caption.visibleWhen, {
    prop: prop?.name,
  });
});

test("text with a contradictory hidden pattern stays named instead of inventing a visibility axis", () => {
  const input = set();
  input.variants[0].children![0].hidden = true;
  const result = propose(input);
  assert.equal(
    ContractSchema.parse(result.contract).anatomy.root.parts?.Caption
      .visibleWhen,
    undefined,
  );
  assert.ok(
    result.notes.some((note) =>
      note.includes("hidden in 3/4 variants without correlating"),
    ),
  );
});

test("partial presence never guesses a hidden predicate from incomplete observations", () => {
  const input = set();
  for (const variant of input.variants)
    if (variant.variantProperties!.Tone === "Strong") variant.children = [];
  const result = propose(input);
  assert.deepEqual(
    ContractSchema.parse(result.contract).anatomy.root.parts?.Caption
      .visibleWhen,
    { prop: "tone", equals: "calm" },
  );
  assert.ok(
    result.notes.some((note) =>
      note.includes("combined presence/visibility requires review"),
    ),
  );
});

test("different or partially missing text bindings stay named instead of choosing the first reference", () => {
  for (const different of [false, true]) {
    const input = set();
    input.variants[0].children![0].propRefs = { visible: "ShowCaption" };
    if (different)
      input.variants[1].children![0].propRefs = { visible: "ShowOther" };
    const result = propose(input);
    assert.equal(
      ContractSchema.parse(result.contract).anatomy.root.parts?.Caption
        .visibleWhen,
      undefined,
    );
    assert.ok(
      result.notes.some((note) =>
        note.includes("visibility property reference differs or is missing"),
      ),
    );
  }
});

test("hidden everywhere is recorded as an unsupported helper instead of a fabricated condition", () => {
  const input = set();
  for (const variant of input.variants) variant.children![0].hidden = true;
  const result = propose(input);
  assert.equal(
    ContractSchema.parse(result.contract).anatomy.root.parts?.Caption
      .visibleWhen,
    undefined,
  );
  assert.ok(
    result.notes.some((note) => note.includes("hidden in every variant")),
  );
});

test("boolean axes carry the truthy condition and name an unrepresentable inverse", () => {
  for (const invert of [false, true]) {
    const input = set();
    input.propertyDefinitions!.Caption = {
      type: "VARIANT",
      defaultValue: "True",
      variantOptions: ["True", "False"],
    };
    for (const variant of input.variants) {
      const value =
        variant.variantProperties!.Caption === "Shown" ? "True" : "False";
      variant.variantProperties!.Caption = value;
      variant.name = `Caption=${value}, Tone=${variant.variantProperties!.Tone}`;
      variant.children![0].hidden = invert
        ? value === "True"
        : value === "False";
    }
    const result = propose(input);
    assert.deepEqual(
      ContractSchema.parse(result.contract).anatomy.root.parts?.Caption
        .visibleWhen,
      invert ? undefined : { prop: "caption" },
    );
    if (invert)
      assert.ok(
        result.notes.some((note) => note.includes("without correlating")),
      );
  }
});
