import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V3_ANTECEDENT_COMMIT,
  INPUT_LIVE_V3_AUTHORIZATION_PATH,
  INPUT_LIVE_V3_PROTOCOL_PATH,
  INPUT_LIVE_V3_PROTOCOL_SHA256,
  validateInputLiveV3Authorization,
  type AuthorizationValidation,
} from "./input-field-live-v3-authorization.js";

const readJson = (filePath: string): Record<string, any> =>
  JSON.parse(readFileSync(filePath, "utf8"));

const fixture = (): AuthorizationValidation => ({
  authorization: readJson(INPUT_LIVE_V3_AUTHORIZATION_PATH),
  antecedentProtocol: readJson(INPUT_LIVE_V3_PROTOCOL_PATH),
  captureProtocol: readJson(INPUT_LIVE_V3_PROTOCOL_PATH),
  antecedentProtocolHash: INPUT_LIVE_V3_PROTOCOL_SHA256,
  captureProtocolHash: INPUT_LIVE_V3_PROTOCOL_SHA256,
  clean: true,
  authorizationCommitted: true,
  authorizationAddingCommits: ["authorization-commit"],
  authorizationCommit: "authorization-commit",
  authorizationBytesMatchFirstAddition: true,
  authorizationPresentAtCodeCommit: true,
  antecedentIsStrictAncestor: true,
  authorizationIsAncestorOfCodeCommit: true,
  codeCommit: "capture-code-commit",
});

test("authorization declaration covers chronology, gates, target, and no outcomes", () => {
  assert.deepEqual(validateInputLiveV3Authorization(fixture()), []);
});

test("authorization self-test rejects every chronology and content bypass", () => {
  const plants: Array<{
    name: string;
    pattern: RegExp;
    mutate: (value: AuthorizationValidation) => void;
  }> = [
    {
      name: "changed antecedent bytes/hash",
      pattern: /antecedent protocol bytes\/hash changed/,
      mutate: (value) => {
        value.antecedentProtocolHash = "0".repeat(64);
      },
    },
    {
      name: "changed capture protocol bytes/hash",
      pattern: /capture protocol bytes\/hash changed/,
      mutate: (value) => {
        value.captureProtocolHash = "0".repeat(64);
      },
    },
    {
      name: "wrong antecedent commit",
      pattern: /antecedent commit\/path\/criterion hash/,
      mutate: (value) => {
        value.authorization.antecedent.commit = "0".repeat(40);
      },
    },
    {
      name: "non-ancestor",
      pattern: /does not descend from antecedent/,
      mutate: (value) => {
        value.antecedentIsStrictAncestor = false;
      },
    },
    {
      name: "dirty capture start",
      pattern: /dirty-start capture/,
      mutate: (value) => {
        value.clean = false;
      },
    },
    {
      name: "missing scene gate",
      pattern: /missing required scene-derived gates/,
      mutate: (value) => {
        value.authorization.requiredGates.sceneDerived.pop();
      },
    },
    {
      name: "missing Task 2 gate",
      pattern: /missing required Task 2 gates/,
      mutate: (value) => {
        value.authorization.requiredGates.task2.pop();
      },
    },
    {
      name: "wrong Figma key",
      pattern: /wrong authorized writable Figma key/,
      mutate: (value) => {
        value.authorization.capture.authorizedWritableFigmaFileKeys = ["wrong"];
      },
    },
    {
      name: "result leakage",
      pattern: /result leakage\/posthoc metrics/,
      mutate: (value) => {
        value.authorization.data = { geometry: 0 };
      },
    },
    {
      name: "modified threshold",
      pattern: /capture criterion thresholds changed/,
      mutate: (value) => {
        value.captureProtocol.hardGates.thresholds.overlap.maximumPixels = 3;
      },
    },
    {
      name: "uncommitted authorization",
      pattern: /pending-uncommitted-authorization/,
      mutate: (value) => {
        value.authorizationCommitted = false;
        value.authorizationAddingCommits = [];
        value.authorizationCommit = undefined;
      },
    },
    {
      name: "changed authorization after first addition",
      pattern: /authorization bytes changed after first-add commit/,
      mutate: (value) => {
        value.authorizationBytesMatchFirstAddition = false;
      },
    },
    {
      name: "authorization absent from capture commit",
      pattern: /authorization artifact missing from codeCommit/,
      mutate: (value) => {
        value.authorizationPresentAtCodeCommit = false;
      },
    },
    {
      name: "capture commit predates authorization",
      pattern: /codeCommit predates authorization/,
      mutate: (value) => {
        value.authorizationIsAncestorOfCodeCommit = false;
      },
    },
    {
      name: "receipt predates authorization",
      pattern: /capture receipt predates authorization/,
      mutate: (value) => {
        value.receipt = {
          value: {
            chronology: {
              antecedentCommit: INPUT_LIVE_V3_ANTECEDENT_COMMIT,
              authorizationCommit: "authorization-commit",
              codeCommit: "capture-code-commit",
            },
          },
          addingCommits: ["receipt-commit"],
          authorizationIsAncestor: false,
        };
      },
    },
  ];

  for (const plant of plants) {
    const value = fixture();
    plant.mutate(value);
    assert.match(
      validateInputLiveV3Authorization(value).join("\n"),
      plant.pattern,
      plant.name,
    );
  }
});

test("receipt must record antecedent, authorization, and capture code commits", () => {
  const value = fixture();
  value.receipt = {
    value: {
      chronology: {
        antecedentCommit: INPUT_LIVE_V3_ANTECEDENT_COMMIT,
        authorizationCommit: "authorization-commit",
        codeCommit: "wrong",
      },
    },
    addingCommits: ["receipt-commit"],
    authorizationIsAncestor: true,
  };
  assert.match(
    validateInputLiveV3Authorization(value).join("\n"),
    /capture receipt chronology fields/,
  );
});
