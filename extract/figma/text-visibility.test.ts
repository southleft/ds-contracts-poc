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

test("complete two-axis hidden observations render their exact truth table", async () => {
  const input = set();
  input.variants[0].children![0].hidden = true;
  const result = propose(input), contract = ContractSchema.parse(result.contract);
  assert.equal(contract.anatomy.root.parts?.Caption.visibleWhen, undefined);
  const {reactEmitter, reactInlineEmitter} = await import('../../core/emitter.js');
  const browser = await chromium.launch();
  try {
    for (const emitter of [reactEmitter,reactInlineEmitter]) {
      const out=emitter.emit(contract,{contracts:new Map([[contract.id,contract]]),icons:new Map(),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}}});
      const page=await browser.newPage();
      try {
        const render=await mountGenerated(page,contract.name,out.find(f=>f.path.endsWith('.tsx'))!.contents,out.find(f=>f.path.endsWith('.css'))?.contents??'');
        for(const caption of ['shown','hidden'])for(const tone of ['calm','strong']){
          await render({caption,tone});
          assert.equal(await page.locator('#root').innerText(),caption==='shown'&&tone==='strong'?'Drawn caption':'',`${emitter.name}: ${caption}/${tone}`);
        }
      } finally {await page.close();}
    }
  } finally {await browser.close();}
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

test("hidden everywhere remains non-rendering instead of acquiring a fabricated condition", () => {
  const input = set();
  for (const variant of input.variants) variant.children![0].hidden = true;
  const result = propose(input);
  assert.equal(
    ContractSchema.parse(result.contract).anatomy.root.parts?.Caption
      .visibleWhen,
    undefined,
  );
  assert.equal(ContractSchema.parse(result.contract).anatomy.root.parts?.Caption.declared?.display, "none");
  assert.ok(result.notes.some((note) => note.includes("hidden in every captured occurrence")));
});

test("boolean axes carry both truthy and typed false-side presence on React and native variants", async () => {
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
      invert ? {prop: "caption", equals: false} : { prop: "caption" },
    );
    const contract = ContractSchema.parse(result.contract);
    const {reactEmitter, reactInlineEmitter} = await import('../../core/emitter.js');
    const {createFigmaEngine} = await import('../../core/emit-figma-script.js');
    const scope = new Map([[contract.id, contract]]);
    const tokens = {primitives: result.mintedTokens?.tree ?? {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}};
    const browser = await chromium.launch();
    try {
      for (const emitter of [reactEmitter, reactInlineEmitter]) {
        const files = emitter.emit(contract, {contracts: scope, icons: new Map(), tokens});
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(page, contract.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents);
          const codeProp = contract.props.find(p => p.name === 'caption')!.bindings.code.prop;
          for (const value of [false, true, false]) {
            await render({[codeProp]: value});
            assert.equal(await page.locator('#root').innerText(), value !== invert ? 'Drawn caption' : '');
          }
        } finally {await page.close();}
      }
    } finally {await browser.close();}
    const engine = createFigmaEngine({tokens, icons: new Map()});
    const compiled = engine.compileComponentData(contract, scope);
    for (const variant of compiled.variants)
      assert.equal(JSON.stringify(variant.spec).includes('Drawn caption'), variant.name.includes('Caption=True') !== invert);
    if (invert) {
      contract.props.find(p => p.name === 'caption')!.bindings.figma.kind = 'BOOLEAN';
      assert.throws(() => engine.compileComponentData(contract, scope), /FIGMA_BOOLEAN_EQUALITY_VISIBILITY_UNQUALIFIED/);
    }
  }
});

test('flow reversal preserves mutually exclusive labels and ignores captured absolute decorations', async () => {
  const {reactEmitter, reactInlineEmitter} = await import('../../core/emitter.js');
  for (const reverse of [false, true]) {
    const input: DumpSet = {setName: 'FlowPresence', type: 'COMPONENT_SET', propertyDefinitions: {
      Checked: {type: 'VARIANT', defaultValue: 'True', variantOptions: ['True', 'False']},
      Position: {type: 'VARIANT', defaultValue: 'Before', variantOptions: ['Before', 'After']},
      Activity: {type: 'VARIANT', defaultValue: 'Idle', variantOptions: ['Idle', 'Busy']},
    }, variants: ['True', 'False'].flatMap(Checked => ['Before', 'After'].flatMap(Position => ['Idle', 'Busy'].map(Activity => {
      const text = (name: string) => ({name, type: 'TEXT', text: {characters: name, fontSize: 14, fontStyle: 'Regular'}});
      const flow = [...(Activity === 'Busy' ? [text('Wait')] : []), text(Checked === 'True' ? 'Yes' : 'No'), text('Marker')];
      if (Position === 'After') flow.reverse();
      return {name: `Checked=${Checked}, Position=${Position}, Activity=${Activity}`, type: 'COMPONENT',
        variantProperties: {Checked, Position, Activity},
        layout: {mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 4, padding: [0,0,0,0], primarySizing: 'AUTO', counterSizing: 'AUTO'},
        children: [...flow.slice(0, 1), {name: 'Focus', type: 'RECTANGLE', hidden: true, abs: {x: 0, y: 0, right: 0, bottom: 0, width: 8, height: 8, constraints: {horizontal: 'LEFT', vertical: 'TOP'}}}, ...flow.slice(1)]};
    }))) };
    input.variants[0].layout!.primary = 'MAX'; // An independent alignment anomaly must not erase ordering.
    if (reverse) input.variants.reverse();
    const before = JSON.stringify(input), result = propose(input), contract = ContractSchema.parse(result.contract);
    assert.equal(JSON.stringify(input), before);
    const browser = await chromium.launch();
    try {
      for (const emitter of [reactEmitter, reactInlineEmitter]) {
        const files = emitter.emit(contract, {contracts: new Map([[contract.id, contract]]), icons: new Map(),
          tokens: {primitives: result.mintedTokens?.tree ?? {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}}});
        const page = await browser.newPage();
        try {
          const render = await mountGenerated(page, contract.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents);
          for (const checked of [true, false]) for (const position of ['before','after']) for (const activity of ['idle','busy']) {
            await render({checked, position, activity});
            const expected = [...(activity === 'busy' ? ['Wait'] : []), checked ? 'Yes' : 'No', 'Marker'];
            if (position === 'after') expected.reverse();
            const boxes = await page.locator('#root').getByText(/^(Wait|Yes|No|Marker)$/).evaluateAll(els => els.map(el => ({text: el.textContent, x: el.getBoundingClientRect().x})).sort((a,b) => a.x-b.x).map(el => el.text));
            assert.deepEqual(boxes, expected, `${emitter.name}: ${checked}/${position}/${activity}`);
          }
        } finally {await page.close();}
      }
    } finally {await browser.close();}
  }
});

test('explicit BOOLEAN visibility and captured enum presence remain independent gates', async () => {
  const input = set();
  input.boolDefaults = {Focused: false};
  for (const row of input.variants) {
    if (row.variantProperties!.Caption === 'Hidden') row.children = [];
    else {row.children![0].propRefs = {visible: 'Focused'}; row.children![0].hidden = true;}
  }
  const result = propose(input), contract = ContractSchema.parse(result.contract);
  const part = contract.anatomy.root.parts!.Caption;
  assert.deepEqual(part.visibleWhen, {prop: 'focused'});
  assert(part.stylesWhen?.some(rule => rule.prop === 'caption' && rule.equals === 'hidden' && rule.styles.display === 'none'));
  const {reactEmitter, reactInlineEmitter} = await import('../../core/emitter.js');
  const scope = new Map([[contract.id, contract]]), tokens = {primitives: result.mintedTokens?.tree ?? {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}};
  const browser = await chromium.launch();
  try {
    for (const emitter of [reactEmitter, reactInlineEmitter]) {
      const files = emitter.emit(contract, {contracts: scope, icons: new Map(), tokens});
      const page = await browser.newPage();
      try {
        const render = await mountGenerated(page, contract.name, files[0].contents, files.find(f => f.path.endsWith('.css'))?.contents);
        for (const caption of ['shown','hidden']) for (const focused of [false,true,false]) {
          await render({caption,focused});
          assert.equal(await page.getByText('Drawn caption', {exact:true}).isVisible(), caption === 'shown' && focused);
        }
      } finally {await page.close();}
    }
  } finally {await browser.close();}
  const {createFigmaEngine} = await import('../../core/emit-figma-script.js');
  const variants = createFigmaEngine({tokens, icons: new Map()}).compileComponentData(contract, scope).variants;
  for (const variant of variants) assert.equal(JSON.stringify(variant.spec).includes('"visibleProp":"Focused"'), variant.name.includes('Caption=Shown'));
});
