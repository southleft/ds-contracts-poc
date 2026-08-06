import assert from "node:assert/strict";
import test from "node:test";
import {
  collectEvidence,
  scoreCorpus,
  scoreFact,
} from "./mui-oracle-offline.mjs";

test("offline oracle scores frozen corpus without fatal fails", () => {
  const report = scoreCorpus();
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.equal(report.accuracyDenominatorsUntouched, true);
  assert.ok(report.summary.facts >= 20);
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.pending, 0, "seeded TextField facts must not remain PENDING");
});

test("speed-dial negative-control fails closed when promoted", () => {
  const component = {
    id: "mui.speed-dial",
    stem: "speed-dial",
    inPilot: false,
    status: "negative-control",
  };
  const fact = {
    channel: "component",
    expect: "UNSUPPORTED",
    expectName: "mui-speed-dial-outside-grammar",
  };
  const clean = scoreFact(fact, { promoted: false }, component);
  assert.equal(clean.result, "MATCH");

  const silent = scoreFact(fact, { promoted: true, contractExists: true }, component);
  assert.equal(silent.result, "FAIL");
  assert.equal(silent.fatal, true);
  assert.match(silent.reason, /silent-success/);
});

test("text-field adornments require nested contract and anchor identity", () => {
  const component = {
    id: "mui.text-field",
    stem: "text-field",
    inPilot: true,
    status: "in-pilot",
  };
  const carried = scoreFact(
    {
      channel: "anatomy.adornment",
      expect: "CARRIED",
    },
    {
      promoted: true,
      contractExists: true,
      figmaExists: true,
      componentRefs: [
        { id: "mui.input-adornment" },
        { id: "mui.input-adornment" },
      ],
      figmaSrc:
        '{"depContractId":"mui.input-adornment","depAnchorKey":"mui.input-adornment"}' +
        '{"depContractId":"mui.input-adornment","depAnchorKey":"mui.input-adornment"}',
    },
    component,
  );
  assert.equal(carried.result, "MATCH");

  const missingAnchor = scoreFact(
    { channel: "anatomy.adornment", expect: "CARRIED" },
    {
      promoted: true,
      contractExists: true,
      figmaExists: true,
      componentRefs: [
        { id: "mui.input-adornment" },
        { id: "mui.input-adornment" },
      ],
      figmaSrc:
        '{"depContractId":"mui.input-adornment"}{"depContractId":"mui.input-adornment"}',
    },
    component,
  );
  assert.equal(missingAnchor.result, "FAIL");
  assert.match(missingAnchor.reason, /depAnchorKey/);
});

test("pilot button evidence includes contract + figma", () => {
  const evidence = collectEvidence("button");
  assert.equal(evidence.contractExists, true);
  assert.equal(evidence.figmaExists, true);
  assert.ok(evidence.variantAxisCount >= 1);
});

test("CHANGE_TO scores from honest figma-script emission only", () => {
  const component = { inPilot: true, status: "in-pilot" };
  const fact = { channel: "prototype.change-to", expect: "CARRIED" };
  const base = { promoted: true, contractExists: true, figmaExists: true };

  const carried = scoreFact(
    fact,
    {
      ...base,
      figmaSrc:
        "actions: [{ navigation: 'CHANGE_TO' }]; reactions = [{ trigger: 'ON_HOVER' }];",
    },
    component,
  );
  assert.equal(carried.result, "MATCH");
  assert.match(carried.reason, /figma-script:CHANGE_TO/);

  const unwired = scoreFact(
    fact,
    { ...base, figmaSrc: "const reactions = [];" },
    component,
  );
  assert.equal(unwired.result, "PENDING");
});

test("checked thumb translation scores from contract and minted leaves", () => {
  const component = { inPilot: true, status: "in-pilot" };
  const fact = { channel: "layout.thumb-translate", expect: "CARRIED" };
  const contract = {
    props: [{ name: "size", type: { enum: ["small", "medium"] } }],
    anatomy: {
      root: {
        parts: {
          "buttonbase-root": {
            tokensByProp: [
              {
                prop: "checked",
                map: {
                  checked: {
                    "translate-x": "{imported.switch.buttonbase-root.translate-x.{size}.checked}",
                  },
                  unchecked: {
                    "translate-x":
                      "{imported.switch.buttonbase-root.translate-x.{size}.unchecked}",
                  },
                },
              },
            ],
          },
        },
      },
    },
  };
  const mintedTokens = {
    imported: {
      switch: {
        "buttonbase-root": {
          "translate-x": {
            small: {
              checked: { $value: "16px" },
              unchecked: { $value: "0px" },
            },
            medium: {
              checked: { $value: "20px" },
              unchecked: { $value: "0px" },
            },
          },
        },
      },
    },
  };
  const base = {
    promoted: true,
    contractExists: true,
    figmaExists: true,
    contract,
  };

  const carried = scoreFact(fact, { ...base, mintedTokens }, component);
  assert.equal(carried.result, "MATCH");
  assert.match(
    carried.reason,
    /anatomy\.root\.parts\.buttonbase-root\.tokensByProp\[0\]\.map\.checked\.translate-x/,
  );

  const missingLeaf = structuredClone(mintedTokens);
  delete missingLeaf.imported.switch["buttonbase-root"]["translate-x"].medium.checked;
  const pending = scoreFact(
    fact,
    { ...base, mintedTokens: missingLeaf },
    component,
  );
  assert.equal(pending.result, "PENDING");
});
