import assert from "node:assert/strict";
import { test } from "node:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runExtractCommand } from "../../../extract/run.js";
import { promote, type PromoteConfig } from "../src/promote.js";

const json = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";

function extractionFixture(): {
  root: string;
  config: string;
  out: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "ds-extract-integrity-"));
  const out = path.join(root, "out");
  const manifest = path.join(root, "custom-elements.json");
  writeFileSync(
    manifest,
    json({
      modules: [
        {
          path: "button.js",
          declarations: [
            {
              kind: "class",
              customElement: true,
              name: "Button",
              tagName: "x-button",
              attributes: [{ name: "disabled", type: { text: "boolean" } }],
            },
          ],
        },
      ],
    }),
  );
  const config = path.join(root, "extract.config.json");
  writeFileSync(
    config,
    json({
      code: { adapter: "cem", manifest },
      idPrefix: "ds",
      out,
    }),
  );
  return { root, config, out };
}

test("explicit canonical paths fail closed while ordinary extraction stays proposal-only", () => {
  const typo = extractionFixture();
  assert.throws(
    () =>
      runExtractCommand("code", typo.config, {
        canonicalDir: path.join(typo.root, "typo"),
      }),
    /canonical directory REFUSED.*does not exist/,
  );
  assert.equal(
    existsSync(typo.out),
    false,
    "the refusal reached no output write",
  );

  const filePath = extractionFixture();
  const notDirectory = path.join(filePath.root, "canonical.json");
  writeFileSync(notDirectory, "{}\n");
  assert.throws(
    () =>
      runExtractCommand("code", filePath.config, {
        canonicalDir: notDirectory,
      }),
    /canonical directory REFUSED.*not a directory/,
  );
  assert.equal(
    existsSync(filePath.out),
    false,
    "the non-directory refusal reached no output write",
  );

  const empty = extractionFixture();
  const canonical = path.join(empty.root, "canonical");
  mkdirSync(canonical);
  assert.throws(
    () =>
      runExtractCommand("code", empty.config, {
        canonicalDir: canonical,
      }),
    /canonical directory REFUSED.*missing expected canonical id\(s\): ds\.button/,
  );
  assert.equal(
    existsSync(empty.out),
    false,
    "the missing-id refusal reached no output write",
  );

  const ordinary = extractionFixture();
  assert.doesNotThrow(() => runExtractCommand("code", ordinary.config));
  const proposal = JSON.parse(
    readFileSync(
      path.join(ordinary.out, "contracts", "button.contract.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  assert.equal(proposal.id, "ds.button");
  assert.equal(proposal.provenance, undefined);
});

test("late dangling-ref refusal preserves every destination byte", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ds-promote-atomic-"));
  const capture = path.join(root, "capture", "button");
  const contracts = path.join(root, "example", "contracts");
  const icons = path.join(root, "example", "assets", "icons");
  const tokens = path.join(root, "example", "tokens");
  mkdirSync(path.join(capture, "assets"), { recursive: true });
  mkdirSync(contracts, { recursive: true });
  mkdirSync(icons, { recursive: true });
  mkdirSync(tokens, { recursive: true });

  writeFileSync(
    path.join(capture, "enriched.contract.json"),
    json({
      id: "ds.button",
      name: "Button",
      version: "0.0.0",
      description: "candidate",
      props: [],
      anatomy: { root: { tokens: { color: "{imported.button.missing}" } } },
    }),
  );
  writeFileSync(
    path.join(capture, "enriched.extension.json"),
    json({
      mintedTokens: {
        imported: {
          button: {
            root: {
              color: { $type: "color", $value: "#ffffff" },
            },
          },
        },
      },
    }),
  );
  writeFileSync(path.join(capture, "assets", "new.svg"), "<svg>new</svg>\n");
  writeFileSync(
    path.join(root, "base.dtcg.json"),
    json({ white: { $type: "color", $value: "#ffffff" } }),
  );

  const destinations = new Map<string, string>([
    [
      path.join(contracts, "button.contract.json"),
      json({ id: "ds.button", name: "Button", description: "old" }),
    ],
    [path.join(contracts, "button.extension.json"), "old extension\n"],
    [path.join(contracts, "button.anchors.json"), "old anchors\n"],
    [path.join(icons, "new.svg"), "<svg>old</svg>\n"],
    [path.join(tokens, "minted.json"), "old minted\n"],
    [path.join(tokens, "MINTED.md"), "old receipt\n"],
  ]);
  for (const [destination, body] of destinations) {
    writeFileSync(destination, body);
  }

  const cfg: PromoteConfig = {
    library: "test",
    exampleDir: "example",
    captureOut: "capture",
    dtcg: "base.dtcg.json",
    mintedOut: "example/tokens/minted.json",
    mintedDoc: "example/tokens/MINTED.md",
    components: ["button"],
    contractVersion: "1.0.0",
    promoterPath: "test promoter",
    possessive: "the test's",
    mintedDocTitle: "Test minted tokens",
  };
  assert.throws(
    () => promote(root, cfg, () => {}),
    /promotion REFUSED.*dangling: button: \{imported\.button\.missing\}/s,
  );
  for (const [destination, before] of destinations) {
    assert.equal(
      readFileSync(destination, "utf8"),
      before,
      `${path.relative(root, destination)} changed despite refusal`,
    );
  }

  writeFileSync(
    path.join(capture, "enriched.contract.json"),
    json({
      id: "ds.button",
      name: "Button",
      version: "0.0.0",
      description: "candidate",
      props: [],
      anatomy: {
        root: { tokens: { color: "{imported.button.root.color}" } },
      },
    }),
  );
  writeFileSync(
    path.join(capture, "enriched.extension.json"),
    json({
      mintedTokens: {
        imported: {
          button: {
            root: {
              color: { $type: "color", $value: "{missing.token}" },
            },
          },
        },
      },
    }),
  );
  assert.throws(
    () => promote(root, cfg, () => {}),
    /promotion REFUSED.*bad alias: imported\.button\.root\.color -> \{missing\.token\}/s,
  );
  for (const [destination, before] of destinations) {
    assert.equal(
      readFileSync(destination, "utf8"),
      before,
      `${path.relative(root, destination)} changed despite bad-alias refusal`,
    );
  }

  writeFileSync(
    path.join(capture, "enriched.extension.json"),
    json({
      mintedTokens: {
        imported: {
          button: {
            root: {
              color: { $type: "color", $value: "#ffffff" },
            },
          },
        },
      },
    }),
  );
  const extensionDestination = path.join(contracts, "button.extension.json");
  unlinkSync(extensionDestination);
  const beforeInjectedFailure = new Map<string, string | null>(
    [...destinations.keys()].map((destination) => [
      destination,
      existsSync(destination) ? readFileSync(destination, "utf8") : null,
    ]),
  );
  let observedInstalledDestinations = 0;
  assert.throws(
    () =>
      promote(root, cfg, () => {}, {
        beforeInstall(index) {
          if (index !== 2) return;
          assert.notEqual(
            readFileSync(path.join(contracts, "button.contract.json"), "utf8"),
            beforeInjectedFailure.get(
              path.join(contracts, "button.contract.json"),
            ),
          );
          assert.equal(existsSync(extensionDestination), true);
          observedInstalledDestinations = 2;
          throw new Error("injected filesystem failure on third install");
        },
      }),
    /injected filesystem failure on third install/,
  );
  assert.equal(
    observedInstalledDestinations,
    2,
    "the injected failure must happen after replacements landed",
  );
  for (const [destination, before] of beforeInjectedFailure) {
    assert.equal(
      existsSync(destination),
      before !== null,
      `${path.relative(root, destination)} presence changed after rollback`,
    );
    if (before !== null) {
      assert.equal(
        readFileSync(destination, "utf8"),
        before,
        `${path.relative(root, destination)} bytes changed after rollback`,
      );
    }
  }
  for (const directory of [contracts, icons, tokens]) {
    assert.deepEqual(
      readdirSync(directory).filter((file) => file.includes(".promotion-")),
      [],
      `${path.relative(root, directory)} retained transaction debris`,
    );
  }

  const assetDestination = path.join(icons, "new.svg");
  const preservedBackup = `${assetDestination}.promotion-${process.pid}-2.bak`;
  const preservedStage = `${assetDestination}.promotion-${process.pid}-2.tmp`;
  let recoveryDiagnostic = "";
  assert.throws(
    () =>
      promote(root, cfg, () => {}, {
        beforeInstall(index) {
          if (index === 2) {
            throw new Error("injected filesystem failure on third install");
          }
        },
        beforeRestore(index) {
          if (index === 2) {
            throw new Error("injected rollback restoration failure");
          }
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      recoveryDiagnostic = error.message;
      return true;
    },
  );
  assert.equal(existsSync(assetDestination), false);
  assert.equal(
    readFileSync(preservedBackup, "utf8"),
    beforeInjectedFailure.get(assetDestination),
    "the unrecovered backup must retain the original destination bytes",
  );
  assert.equal(
    existsSync(preservedStage),
    true,
    "the staged replacement must survive incomplete rollback",
  );
  assert.match(recoveryDiagnostic, /rollback was incomplete/);
  assert.ok(
    recoveryDiagnostic.includes(preservedBackup),
    "the diagnostic must name the exact backup recovery path",
  );
  assert.ok(
    recoveryDiagnostic.includes(preservedStage),
    "the diagnostic must name the exact staged recovery path",
  );
});
