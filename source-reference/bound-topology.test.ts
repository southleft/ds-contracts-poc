import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { chromium, type Page } from "playwright-core";
import type { CemDeclarationFacts } from "../extract/adapters/cem.js";
import { captureJs } from "../extract/computed/capture.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import {
  captureBoundSourceTopology,
  type BoundTopologyInput,
} from "./bound-topology.js";
import {
  assessSemantics,
  captureStableSemantics,
  semanticHash,
} from "./semantics.js";
import { captureSourceTopology } from "./topology.js";

const sha = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const declaration: CemDeclarationFacts = {
  modulePath: "source-button.ts",
  className: "SourceButton",
  tagName: "source-button",
  attributes: [],
  properties: [],
  slots: [{ name: "" }, { name: "after" }],
  events: [],
  cssParts: [],
  cssProperties: [],
};
async function fixture(page: Page) {
  await page.setContent(
    '<div id="stage"><source-button><span>Same</span>Same<!-- owner comment --></source-button></div>',
  );
  await page.evaluate(() => {
    document
      .querySelector("source-button")!
      .attachShadow({ mode: "open" }).innerHTML =
      '<!-- lit marker --><button aria-label="Original"><span><slot>Fallback</slot></span><span>Same</span><slot name="after">Fallback</slot></button>';
  });
}
async function record(page: Page): Promise<BoundTopologyInput> {
  const channels = await page.evaluate(() =>
    [...getComputedStyle(document.documentElement)].sort(),
  );
  const tree = await page.evaluate<CapturedNode>(
    `(() => { const window = {__ALL_PROPS:${JSON.stringify(channels)}}; return ${captureJs("#stage", undefined, undefined, ["source-button", "button"])}; })()`,
  );
  const sourcePngSha256 = sha(
    await page.screenshot({ fullPage: true, caret: "initial" }),
  );
  const treeSha256 = semanticHash(tree);
  const observed = await captureStableSemantics(
    page,
    ["source-button"],
    declaration,
    sourcePngSha256,
    0,
  );
  const semantics = assessSemantics(declaration, observed, {
    valid: true,
    sourcePngSha256,
    sourceTreeSha256: treeSha256,
  });
  assert.equal(
    semantics.status,
    "observed",
    JSON.stringify(semantics.problems),
  );
  return {
    topology: {
      hostPath: ["source-button"],
      rootPath: ["source-button", "button"],
      stageSelector: "#stage",
      channels,
      tree,
      treeSha256,
      sourcePngSha256,
    },
    semantics,
    quietMs: 0,
  };
}

test("unchanged source independently matches recorded semantics and exact visual topology without claiming AST bindings", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(page);
    const input = await record(page);
    const result = await captureBoundSourceTopology(page, input);
    assert.equal(result.status, "topology-matched", JSON.stringify(result));
    assert.deepEqual(result.problems, []);
    assert.equal(
      result.semanticObservationSha256,
      input.semantics.observationSha256,
    );
    assert.equal(result.declarationSha256, input.semantics.declarationSha256);
    assert.equal(result.topology?.observation?.rootDomPath, "host/shadow/1");
    const slots = result.topology!.observation!.slots;
    assert.deepEqual(slots[0].assigned, ["host/0", "host/1"]);
    assert.equal(slots[1].distribution, "fallback");
    assert.ok(
      result.limitations.some((limitation) =>
        limitation.includes("not source AST-to-runtime binding"),
      ),
    );
  } finally {
    await browser.close();
  }
});

test("ARIA-only drift refuses the old semantic answer key even when raw tree and source PNG are byte-identical", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(page);
    const input = await record(page);
    await page.evaluate(() => {
      document
        .querySelector("source-button")!
        .shadowRoot!.querySelector("button")!
        .setAttribute("aria-label", "Changed without pixels");
    });
    const changed = await record(page);
    assert.equal(changed.topology.treeSha256, input.topology.treeSha256);
    assert.equal(
      changed.topology.sourcePngSha256,
      input.topology.sourcePngSha256,
    );
    assert.notEqual(
      changed.semantics.observationSha256,
      input.semantics.observationSha256,
    );
    assert.equal(
      (await captureSourceTopology(page, input.topology)).status,
      "captured",
      "the preexisting pixel/tree topology seam alone cannot detect stale semantic evidence",
    );
    const result = await captureBoundSourceTopology(page, input);
    assert.equal(result.status, "refused");
    assert.deepEqual(result.problems, ["bound-semantic-before-mismatch"]);
    assert.equal(
      result.topology,
      undefined,
      "never return usable topology on stale semantics",
    );
    assert.equal(
      (await captureBoundSourceTopology(page, changed)).status,
      "topology-matched",
      "independently re-recorded matching evidence remains allowed",
    );
  } finally {
    await browser.close();
  }
});

test("corrupt hashes, mismatched references and forged summary status are rejected before a browser read", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(page);
    const original = await record(page);
    const cases: Array<[string, (input: BoundTopologyInput) => void]> = [
      [
        "bound-semantic-evidence-invalid",
        (input) => {
          input.semantics.declaration.className = "Forged";
        },
      ],
      [
        "bound-semantic-evidence-invalid",
        (input) => {
          input.semantics.observation.nativeElements[0].attributes[
            "aria-label"
          ] = "Forged";
        },
      ],
      [
        "bound-semantic-evidence-invalid",
        (input) => {
          input.semantics.status = "refused";
        },
      ],
      [
        "bound-semantic-reference-mismatch",
        (input) => {
          delete input.semantics.sourceTreeSha256;
        },
      ],
      [
        "bound-semantic-reference-mismatch",
        (input) => {
          input.semantics.sourcePngSha256 = "a".repeat(64);
        },
      ],
      [
        "bound-semantic-assessment-mismatch",
        (input) => {
          input.semantics.coverage.renderedSlots = 99;
        },
      ],
      [
        "bound-semantic-assessment-mismatch",
        (input) => {
          input.semantics.observation.problems.push("forged-green");
          input.semantics.observationSha256 = semanticHash(
            input.semantics.observation,
          );
        },
      ],
    ];
    for (const [problem, mutate] of cases) {
      const input = structuredClone(original);
      mutate(input);
      const result = await captureBoundSourceTopology({} as Page, input);
      assert.equal(result.status, "refused");
      assert.deepEqual(result.problems, [problem]);
      assert.equal(result.topology, undefined);
    }
  } finally {
    await browser.close();
  }
});

test("semantic-only changes between probes, including changes reverted before any probe, cannot be published", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const revert of [false, true]) {
      await fixture(page);
      const input = await record(page);
      let monitors = 0;
      // Use real browser probes throughout. Change ARIA immediately before the
      // topology monitor starts, after the first semantic window has closed.
      const changingPage = new Proxy(page, {
        get(target, property) {
          const value = Reflect.get(target, property);
          if (property === "evaluateHandle")
            return async (...args: unknown[]) => {
              if (++monitors === 3)
                await page.evaluate((revert) => {
                  const button = document
                    .querySelector("source-button")!
                    .shadowRoot!.querySelector("button")!;
                  button.setAttribute("aria-label", "Changed between brackets");
                  if (revert) button.setAttribute("aria-label", "Original");
                }, revert);
              return Reflect.apply(value, target, args);
            };
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const result = await captureBoundSourceTopology(changingPage, input);
      assert.equal(
        monitors,
        4,
        "continuous monitor, semantic-before, topology and semantic-after all ran",
      );
      assert.equal(result.status, "refused");
      assert.deepEqual(result.problems, [
        ...(revert ? [] : ["bound-semantic-after-mismatch"]),
        "bound-source-mutated-during-window",
      ]);
      assert.equal(result.topology, undefined);
      assert.equal(
        sha(await page.screenshot({ fullPage: true, caret: "initial" })),
        input.topology.sourcePngSha256,
      );
    }
  } finally {
    await browser.close();
  }
});

test("individually stable semantic and visual captures cannot pass an inconsistent native-element or slot-name join", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const variant of ["native", "slot"] as const) {
      await fixture(page);
      await page.evaluate((variant) => {
        const shadow = document.querySelector("source-button")!.shadowRoot!;
        if (variant === "native") {
          Object.defineProperty(shadow.querySelector("button"), "localName", {
            value: "input",
          });
        } else {
          Object.defineProperty(
            shadow.querySelector('slot[name="after"]'),
            "name",
            { value: "" },
          );
        }
      }, variant);
      const input = await record(page);
      const result = await captureBoundSourceTopology(page, input);
      assert.equal(result.status, "refused", variant);
      assert.ok(
        result.problems.includes(
          variant === "native"
            ? "bound-topology-native-path-mismatch"
            : "bound-topology-slot-content-mismatch",
        ),
        JSON.stringify(result),
      );
      assert.equal(result.topology, undefined);
    }
  } finally {
    await browser.close();
  }
});
