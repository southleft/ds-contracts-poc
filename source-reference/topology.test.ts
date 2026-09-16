import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { chromium, type Page } from "playwright-core";
import { captureJs } from "../extract/computed/capture.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import {
  captureSourceTopology,
  topologyPseudoProblems,
  type TopologyInput,
} from "./topology.js";

const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
async function measured(page: Page): Promise<TopologyInput> {
  const channels = await page.evaluate(() =>
    [...getComputedStyle(document.documentElement)].sort(),
  );
  const tree = await page.evaluate<CapturedNode>(
    `(() => { const window = {__ALL_PROPS:${JSON.stringify(channels)}}; return ${captureJs("#stage", undefined, undefined, ["test-button", "button"])}; })()`,
  );
  return {
    hostPath: ["test-button"],
    rootPath: ["test-button", "button"],
    stageSelector: "#stage",
    channels,
    tree,
    treeSha256: sha(JSON.stringify(tree)),
    sourcePngSha256: sha(
      await page.screenshot({ fullPage: true, caret: "initial" }),
    ),
  };
}
async function fixture(page: Page, light: string, shadow: string) {
  await page.setContent(
    `<div id="stage"><test-button>${light}</test-button></div>`,
  );
  await page.evaluate((html) => {
    document
      .querySelector("test-button")!
      .attachShadow({ mode: "open" }).innerHTML = html;
  }, shadow);
}

test("exact slot identities survive identical text, literal aria labels and comment/path offsets without source writes", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(
      page,
      "Same",
      "<!-- lit marker --><button aria-label='Same'><span><slot></slot></span><span>Same</span><slot name='after'>Same</slot></button>",
    );
    const input = await measured(page);
    const before = await page.evaluate(() => ({
      light: document.body.innerHTML,
      shadow: document.querySelector("test-button")!.shadowRoot!.innerHTML,
      allProps: Object.hasOwn(window, "__ALL_PROPS"),
      sheetSkips: Object.hasOwn(window, "__DSC_SHEET_SKIPS"),
    }));
    const result = await captureSourceTopology(page, input);
    assert.equal(result.status, "captured", JSON.stringify(result));
    const observed = result.observation!;
    assert.equal(observed.rootDomPath, "host/shadow/1");
    const defaultSlot = observed.slots.find((slot) => slot.name === "")!;
    assert.equal(defaultSlot.semanticPath, "0/0/0");
    assert.deepEqual(defaultSlot.assigned, ["host/0"]);
    assert.deepEqual(defaultSlot.fallback, []);
    assert.deepEqual(defaultSlot.visualPaths, ["/nodes/0/el/nodes/0"]);
    const same = observed.nodes.filter(
      (node) => node.text === "Same" && node.visualPath !== undefined,
    );
    assert.equal(same.length, 3);
    assert.equal(new Set(same.map((node) => node.domPath)).size, 3);
    assert.deepEqual(
      same.find((node) => node.domPath === "host/0")!.slotChain,
      [defaultSlot.domPath],
    );
    assert.equal(
      same.find((node) => node.visualPath === "/nodes/1/el/nodes/0")!.slotChain,
      undefined,
      "equal literal text is not slotted content",
    );
    assert.equal(
      observed.nodes.find((node) => node.visualPath === "")!.attributes![
        "aria-label"
      ],
      "Same",
    );
    assert.equal(
      observed.slots.find((slot) => slot.name === "after")!.distribution,
      "fallback",
    );
    assert.equal(result.sourceTreeSha256, input.treeSha256);
    assert.equal(result.observationSha256, sha(JSON.stringify(observed)));
    assert.deepEqual(
      await page.evaluate(() => ({
        light: document.body.innerHTML,
        shadow: document.querySelector("test-button")!.shadowRoot!.innerHTML,
        allProps: Object.hasOwn(window, "__ALL_PROPS"),
        sheetSkips: Object.hasOwn(window, "__DSC_SHEET_SKIPS"),
      })),
      before,
    );

    // Compare path convention only; this synthetic DOM is not a new Altitude
    // capture or a semantic-binding qualification of the saved source.
    const archive = JSON.parse(
      readFileSync(
        "source-reference/fixtures/contract-plan-button-recorded.json",
        "utf8",
      ),
    );
    const files = JSON.parse(
      gunzipSync(Buffer.from(archive.payload, "base64")).toString(),
    );
    const recorded = JSON.parse(
      files["atoms-button--default/source-semantics.json"].utf8,
    );
    assert.equal(
      recorded.observation.slots.find(
        (slot: { name: string }) => slot.name === "",
      ).path,
      defaultSlot.semanticPath,
    );
  } finally {
    await browser.close();
  }
});

test("assigned versus fallback distribution, split text nodes and new path offsets remain distinct", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(
      page,
      "",
      "<button><slot name='before'><slot name='after'>Fallback</slot></slot><span><slot></slot></span></button>",
    );
    await page.evaluate(() => {
      const host = document.querySelector("test-button")!;
      host.append(
        document.createTextNode("Same"),
        document.createTextNode("Same"),
      );
    });
    let result = await captureSourceTopology(page, await measured(page));
    assert.equal(result.status, "captured", JSON.stringify(result));
    assert.equal(
      result.observation!.nodes.filter(
        (node) => node.text === "Same" && node.visualPath !== undefined,
      ).length,
      2,
    );
    const fallback = result.observation!.nodes.find(
      (node) => node.text === "Fallback",
    )!;
    assert.equal(
      fallback.slotChain!.length,
      2,
      "recursive slot fallback records every exact boundary",
    );
    const oldDefaultPath = result.observation!.slots.find(
      (slot) => slot.name === "",
    )!.semanticPath;
    await page.evaluate(() => {
      const host = document.querySelector("test-button")!;
      const content = document.createElement("span");
      content.slot = "before";
      content.textContent = "Assigned";
      host.append(content);
      host
        .shadowRoot!.querySelector("button")!
        .prepend(document.createElement("span"));
    });
    result = await captureSourceTopology(page, await measured(page));
    assert.equal(result.status, "captured", JSON.stringify(result));
    assert.equal(
      result.observation!.slots.find((slot) => slot.name === "before")!
        .distribution,
      "assigned",
    );
    assert.equal(
      result.observation!.nodes.find((node) => node.text === "Fallback")!
        .visualPath,
      undefined,
      "inactive fallback remains source topology, never visible content",
    );
    assert.notEqual(
      result.observation!.slots.find((slot) => slot.name === "")!.semanticPath,
      oldDefaultPath,
      "re-observe conditional sibling shifts rather than reuse old positional IDs",
    );
  } finally {
    await browser.close();
  }
});

test("nested shadow ownership and raw SVG identity survive while nonpainting metadata is explicit", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(
      page,
      "<test-icon slot='before'></test-icon>Text",
      "<button><slot name='before'></slot><span><slot></slot></span></button>",
    );
    await page.evaluate(() => {
      document
        .querySelector("test-icon")!
        .attachShadow({ mode: "open" }).innerHTML =
        "<svg width='12' height='12'><title>Not visible text</title><path d='M0 0h12v12H0z'/></svg>";
    });
    const result = await captureSourceTopology(page, await measured(page));
    assert.equal(result.status, "captured", JSON.stringify(result));
    const svg = result.observation!.nodes.find((node) => node.tag === "svg")!;
    assert.equal(svg.shadowHostDomPath, "host/0");
    assert.equal(svg.visualPath, "/nodes/0/el/nodes/0/el");
    assert.ok(svg.slotChain?.length);
    assert.equal(
      result.observation!.omitted[0].reason,
      "svg-nonpainting-metadata",
    );
    assert.equal(
      result.observation!.nodes.find(
        (node) => node.text === "Not visible text",
      )!.visualPath,
      undefined,
    );
  } finally {
    await browser.close();
  }
});

test("wrong image/tree and ambiguous roots refuse without partial topology", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(page, "Text", "<button><slot></slot></button>");
    const input = await measured(page);
    for (const [changed, code] of [
      [
        { ...input, treeSha256: "0".repeat(64) },
        "topology-source-evidence-invalid",
      ],
      [
        { ...input, sourcePngSha256: "0".repeat(64) },
        "topology-source-image-changed",
      ],
      [{ ...input, channels: ["display"] }, "topology-source-tree-changed"],
      [{ ...input, stageSelector: "#missing" }, "topology-source-tree-changed"],
    ] as const) {
      const result = await captureSourceTopology(page, changed);
      assert.deepEqual(result.problems, [code]);
      assert.equal(result.observation, undefined);
    }
    await fixture(
      page,
      "Text",
      "<button>First</button><button>Second</button>",
    );
    let result = await captureSourceTopology(page, await measured(page));
    assert.deepEqual(result.problems, ["topology-path-not-unique"]);
  } finally {
    await browser.close();
  }
});

test("a distribution getter that mutates and restores source attributes cannot pass unchanged pixels", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(page, "Text", "<button><slot></slot></button>");
    const input = await measured(page);
    await page.evaluate(() => {
      const slot = document
        .querySelector("test-button")!
        .shadowRoot!.querySelector("slot")!;
      const original = slot.assignedNodes.bind(slot);
      slot.assignedNodes = (options) => {
        slot.setAttribute("data-probe", "temporary");
        slot.removeAttribute("data-probe");
        return original(options);
      };
    });
    const result = await captureSourceTopology(page, input);
    assert.deepEqual(result.problems, ["topology-source-mutated"]);
    assert.equal(result.observation, undefined);
  } finally {
    await browser.close();
  }
});

test("pseudo planes retain exact owners, channels and slot distribution without becoming DOM nodes", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await fixture(
      page,
      "<span>Same</span>",
      `<style>
      button::before {content:'Same';color:rgb(1,2,3)}
      button::after {content:'';width:4px;display:block;background:red}
      ::slotted(span)::before {content:'Same';color:rgb(4,5,6)}
      li {display:list-item} input::placeholder {color:rgb(7,8,9)}
      </style><button><slot></slot><li>Same</li><input placeholder='Same'></button>`,
    );
    const input = await measured(page);
    const result = await captureSourceTopology(page, input);
    assert.equal(result.status, "captured", JSON.stringify(result));
    const topology = result.observation!;
    assert.deepEqual(topologyPseudoProblems(topology), []);
    const planes = topology.pseudoPlanes!;
    assert.deepEqual(
      planes.map((p) => p.pseudo),
      ["::before", "::after", "::before", "::marker", "::placeholder"],
    );
    const rootBefore = planes[0],
      slottedBefore = planes[2];
    assert.equal(rootBefore.ownerDomPath, topology.rootDomPath);
    assert.equal(rootBefore.visualPath, "/pseudo/::before");
    assert.equal(rootBefore.style.color, "rgb(1, 2, 3)");
    assert.equal(slottedBefore.ownerDomPath, "host/0");
    assert.equal(slottedBefore.style.color, "rgb(4, 5, 6)");
    assert.deepEqual(slottedBefore.slotChain, [topology.slots[0].domPath]);
    assert.ok(
      planes.every(
        (p) => Object.keys(p.style).length === input.channels.length,
      ),
    );
    assert.equal(
      topology.nodes.some((n) => n.domPath.includes("::")),
      false,
    );
    assert.equal(
      sha(await page.screenshot({ fullPage: true, caret: "initial" })),
      input.sourcePngSha256,
    );
    for (const mutate of [
      (p: typeof rootBefore) => {
        p.ownerDomPath = "host/0";
      },
      (p: typeof rootBefore) => {
        p.visualPath = "/wrong";
      },
      (p: typeof rootBefore) => {
        p.slotChain = ["made-up-slot"];
      },
    ]) {
      const changed = structuredClone(topology);
      mutate(changed.pseudoPlanes![0]);
      assert.deepEqual(topologyPseudoProblems(changed), [
        "topology-pseudo-owner-invalid",
      ]);
    }
    const duplicate = structuredClone(topology);
    duplicate.pseudoPlanes!.push(duplicate.pseudoPlanes![0]);
    assert.deepEqual(topologyPseudoProblems(duplicate), [
      "topology-pseudo-owner-invalid",
    ]);
    const badStyle = structuredClone(topology);
    badStyle.pseudoPlanes![0].style = {};
    assert.deepEqual(topologyPseudoProblems(badStyle), [
      "topology-pseudo-style-invalid",
    ]);
    const forged = structuredClone(input);
    forged.tree.pseudo["::before"]!.color = "rgb(99, 99, 99)";
    forged.treeSha256 = sha(JSON.stringify(forged.tree));
    const refused = await captureSourceTopology(page, forged);
    assert.deepEqual(refused.problems, ["topology-source-tree-changed"]);
    assert.equal(refused.observation, undefined);
  } finally {
    await browser.close();
  }
});

test("independent pseudo read rejects changed CSS even when the initial tree and pixels match", async () => {
  const browser = await chromium.launch(),
    page = await browser.newPage();
  try {
    await fixture(
      page,
      "Text",
      "<style>button::before{content:'Same';color:rgb(1,2,3)}</style><button><slot></slot></button>",
    );
    const input = await measured(page);
    await page.evaluate(() => {
      const original = window.getComputedStyle;
      let reads = 0;
      window.getComputedStyle = function (element, pseudo) {
        const style = original.call(this, element, pseudo);
        if (
          pseudo === "::before" &&
          element.tagName === "BUTTON" &&
          ++reads === 2
        )
          return new Proxy(style, {
            get(target, key) {
              return key === "getPropertyValue"
                ? (name: string) =>
                    name === "color"
                      ? "rgb(99, 99, 99)"
                      : target.getPropertyValue(name)
                : Reflect.get(target, key, target);
            },
          });
        return style;
      };
    });
    const result = await captureSourceTopology(page, input);
    assert.deepEqual(result.problems, ["topology-pseudo-style-mismatch"]);
    assert.equal(result.observation, undefined);
  } finally {
    await browser.close();
  }
});
