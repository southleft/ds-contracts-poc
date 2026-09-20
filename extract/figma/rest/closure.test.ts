/**
 * docs/23 §D.43 — "a REST import follows its instances". The closure walk on
 * a recorded CBDS response (Icon → the standalone Placeholder component) and on
 * REST-shaped synthetic responses for the cases no designer file exhibits on
 * demand: transitive chains, a cycle, a remote (library) component, a missing
 * one, the cap, deterministic order, and the byte-identical `--no-closure`
 * path. Then the proposer's side: a closure child that refuses becomes a named
 * stub, a requested set that refuses still refuses. No network.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  closureDegradations,
  followInstances,
  partitionClosureRefusals,
  pickRequestedContract,
  type FetchNodesBatch,
} from "./closure.js";
import {
  fetchNodes,
  importFromUrl,
  MAX_RETRY_AFTER_SECONDS,
  type FetchLike,
} from "./fetch.js";
import { mapRestToDump, type RestNode, type RestNodesResponse } from "./map.js";

const TOKENS = [
  "tokens/primitives.tokens.json",
  "tokens/semantic.tokens.json",
  "tokens/modes/semantic.light.tokens.json",
  "tokens/modes/brand.default.tokens.json",
].join(",");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const recorded = JSON.parse(
  readFileSync(
    path.join(HERE, "fixtures", "closure-cbds-icon.rest.json"),
    "utf8",
  ),
) as {
  responses: Record<string, RestNodesResponse>;
};

/** A replay transport over recorded /nodes responses (merged per request),
 *  refusing variables with the scope 403 the live token gets. */
function replay(
  responses: Record<string, RestNodesResponse>,
  log: string[] = [],
): FetchLike {
  return async (url) => {
    log.push(url);
    const ok = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    if (url.includes("/variables/local")) {
      const body =
        '{"status":403,"error":true,"message":"This endpoint requires the file_variables:read scope"}';
      return {
        ok: false,
        status: 403,
        json: async () => JSON.parse(body),
        text: async () => body,
      };
    }
    const ids = decodeURIComponent(
      new URL(url).searchParams.get("ids") ?? "",
    ).split(",");
    const nodes: RestNodesResponse["nodes"] = {};
    let name: string | undefined;
    for (const id of ids) {
      const r = responses[id];
      nodes[id] = r?.nodes?.[id] ?? null;
      name ??= r?.name;
    }
    return ok({ ...(name ? { name } : {}), nodes });
  };
}

const ICON_URL =
  "https://www.figma.com/design/WofZT8xaxXuc2Q6Je9S4XE/CBDS?node-id=188-894";

test("recorded CBDS: Icon follows its instances to the standalone Placeholder component, dependencies first", async () => {
  const log: string[] = [];
  const { dump, report } = await importFromUrl(ICON_URL, "t", {
    fetchImpl: replay(recorded.responses, log),
    closure: true,
  });
  assert.deepEqual(report.sets, ["Placeholder", "Icon"]);
  assert.deepEqual(
    Object.keys(dump).filter((k) => !k.startsWith("_")),
    ["Placeholder", "Icon"],
  );
  const closure = dump._provenance?.closure;
  assert.ok(closure);
  assert.deepEqual(closure.requested, [
    { nodeId: "188:894", name: "Icon", type: "COMPONENT_SET" },
  ]);
  assert.deepEqual(closure.pulled, [
    {
      nodeId: "187:877",
      name: "Placeholder",
      type: "COMPONENT",
      round: 1,
      referencedBy: ["Icon"],
    },
  ]);
  assert.deepEqual(closure.unresolved, []);
  // variables + the requested set + ONE closure round; the fixpoint stops there.
  assert.equal(log.filter((u) => u.includes("/nodes?")).length, 2);
});

test("--no-closure (the library default) is the mapper on the requested response alone: no closure provenance, no extra request", async () => {
  const log: string[] = [];
  const off = await importFromUrl(ICON_URL, "t", {
    fetchImpl: replay(recorded.responses, log),
  });
  assert.equal(log.filter((u) => u.includes("/nodes?")).length, 1);
  assert.equal(off.dump._provenance?.closure, undefined);
  assert.deepEqual(off.report.sets, ["Icon"]);
  // Byte-identical to mapping the one recorded response directly with the
  // options importFromUrl derives (the pre-closure path, unchanged).
  const direct = mapRestToDump(recorded.responses["188:894"], {
    variablesUnavailable: {
      kind: "scope",
      status: 403,
      message: (off.dump._provenance?.variables as { message: string }).message,
      fix: "regenerate the token with file_variables:read",
    },
    fileKey: "WofZT8xaxXuc2Q6Je9S4XE",
  });
  assert.equal(JSON.stringify(off.dump), JSON.stringify(direct.dump));
});

// ---------------------------------------------------------------------------
// Synthetic REST-shaped responses
// ---------------------------------------------------------------------------

type Meta = { name: string; componentSetId?: string; remote?: boolean };
const inst = (
  name: string,
  componentId: string,
  children: RestNode[] = [],
): RestNode =>
  ({
    id: `i-${name}-${componentId}`,
    name,
    type: "INSTANCE",
    componentId,
    children,
  }) as RestNode;
const set = (
  id: string,
  name: string,
  variantChildren: RestNode[][],
): RestNode => ({
  id,
  name,
  type: "COMPONENT_SET",
  children: variantChildren.map((kids, i) => ({
    id: `${id}v${i}`,
    name: `V=${i}`,
    type: "COMPONENT",
    children: kids,
  })),
});
const entry = (
  doc: RestNode,
  components: Record<string, Meta> = {},
  componentSets: Record<string, { name: string; remote?: boolean }> = {},
) => ({
  document: doc,
  components,
  componentSets,
});
const resp = (id: string, e: ReturnType<typeof entry>): RestNodesResponse => ({
  name: "Kit",
  nodes: { [id]: e },
});

/** Transport over synthetic entries keyed by id; records every batch. */
function batches(
  all: Record<string, ReturnType<typeof entry> | null>,
  calls: string[][] = [],
): FetchNodesBatch {
  return async (ids) => {
    calls.push(ids);
    return {
      name: "Kit",
      nodes: Object.fromEntries(ids.map((id) => [id, all[id] ?? null])),
    };
  };
}

// A → B (set) → C (set) ; A → Lib (remote) ; A → Gone (no metadata)
const A = entry(
  set("1:0", "A", [
    [inst("b", "2:1"), inst("lib", "9:1"), inst("gone", "8:1")],
  ]),
  {
    "2:1": { name: "V=0", componentSetId: "2:0" },
    "9:1": { name: "Library Icon", remote: true },
  },
);
const B = entry(set("2:0", "B", [[inst("c", "3:1")]]), {
  "3:1": { name: "V=0", componentSetId: "3:0" },
});
const C = entry(set("3:0", "C", [[]]));

test("transitive: A → B → C are all mapped, C first; remote and missing references are named per reference", async () => {
  const calls: string[][] = [];
  const { response, closure } = await followInstances(
    resp("1:0", A),
    ["1:0"],
    batches({ "2:0": B, "3:0": C }, calls),
  );
  assert.deepEqual(Object.keys(response.nodes), ["3:0", "2:0", "1:0"]);
  assert.deepEqual(
    closure.pulled.map((p) => [p.name, p.round, p.referencedBy]),
    [
      ["C", 2, ["B"]],
      ["B", 1, ["A"]],
    ],
  );
  assert.deepEqual(calls, [["2:0"], ["3:0"]]);
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.reason, u.referencedFrom]),
    [
      ["8:1", "not-found", ["A:V=0/gone"]],
      ["9:1", "remote-library-component", ["A:V=0/lib"]],
    ],
  );
  const rows = closureDegradations(closure);
  assert.deepEqual(
    rows.map((r) => [r.nodePath, r.message.split(":")[0]]),
    [
      ["A:V=0/gone", "not-found"],
      ["A:V=0/lib", "remote-library-component"],
    ],
  );
  // The mapper carries it: provenance verbatim, one degradation row per reference.
  const mapped = mapRestToDump(response, { closure, fileKey: "k" });
  assert.deepEqual(mapped.report.sets, ["C", "B", "A"]);
  assert.deepEqual(mapped.dump._provenance?.closure, closure);
  assert.equal(
    mapped.dump._degradations?.filter(
      (d) => d.code === "instance-closure-unresolved",
    ).length,
    2,
  );
});

test("a remote set (componentSets[id].remote) is not followed even when the component entry omits `remote`", async () => {
  const P = entry(
    set("1:0", "P", [[inst("x", "5:1")]]),
    { "5:1": { name: "V=0", componentSetId: "5:0" } },
    { "5:0": { name: "Lib Set", remote: true } },
  );
  const { closure } = await followInstances(
    resp("1:0", P),
    ["1:0"],
    batches({}),
  );
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.name, u.reason]),
    [["5:0", "Lib Set", "remote-library-component"]],
  );
});

test("a cycle A → B → A terminates, fetches each set once and names the cut edge", async () => {
  const A2 = entry(set("1:0", "A", [[inst("b", "2:1")]]), {
    "2:1": { name: "V=0", componentSetId: "2:0" },
  });
  const B2 = entry(set("2:0", "B", [[inst("a", "1:1")]]), {
    "1:1": { name: "V=0", componentSetId: "1:0" },
  });
  const calls: string[][] = [];
  const { response, closure } = await followInstances(
    resp("1:0", A2),
    ["1:0"],
    batches({ "2:0": B2 }, calls),
  );
  assert.deepEqual(calls, [["2:0"]]);
  assert.deepEqual(Object.keys(response.nodes), ["2:0", "1:0"]);
  assert.deepEqual(closure.cycles, [
    { from: "B", to: "A", fromNodeId: "2:0", toNodeId: "1:0" },
  ]);
  // The cut edge is named per instance, as a stub of its own.
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.reason, u.referencedFrom]),
    [["1:0", "cycle-cut", ["B:V=0/a"]]],
  );
  // The mapper spells that instance under a DISTINCT name with no keys, so
  // the proposer can never link it to A's real id.
  const mapped = mapRestToDump(response, { closure, fileKey: "k" }).dump;
  const bInst = (
    mapped.B as {
      variants: Array<{
        children?: Array<{ instanceOf?: string; instanceKey?: string }>;
      }>;
    }
  ).variants[0].children![0];
  assert.equal(bInst.instanceOf, "A (cycle cut)");
  assert.equal(bInst.instanceKey, undefined);
  assert.deepEqual(
    closure.pulled.map((p) => p.name),
    ["B"],
  );
});

test("a standalone COMPONENT is followed by its own id; a same-set reference is cut without another fetch", async () => {
  const S = entry(
    set("1:0", "S", [[inst("self", "1:0v0"), inst("p", "7:7")]]),
    {
      "1:0v0": { name: "V=0", componentSetId: "1:0" },
      "7:7": { name: "Placeholder" },
    },
  );
  const P = entry({
    id: "7:7",
    name: "Placeholder",
    type: "COMPONENT",
    children: [],
  } as RestNode);
  const { closure } = await followInstances(
    resp("1:0", S),
    ["1:0"],
    batches({ "7:7": P }),
  );
  assert.deepEqual(
    closure.pulled.map((p) => [p.nodeId, p.type]),
    [["7:7", "COMPONENT"]],
  );
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.reason, u.referencedFrom]),
    [["1:0", "cycle-cut", ["S:V=0/self"]]],
  );
});

test("the cap refuses BY NAME past its limit, in sorted id order — never a silent truncation", async () => {
  const W = entry(
    set("1:0", "W", [[inst("z", "6:1"), inst("y", "4:1"), inst("x", "5:1")]]),
    {
      "4:1": { name: "V=0", componentSetId: "4:0" },
      "5:1": { name: "V=0", componentSetId: "5:0" },
      "6:1": { name: "V=0", componentSetId: "6:0" },
    },
  );
  const kid = (id: string, name: string) => entry(set(id, name, [[]]));
  const { closure } = await followInstances(
    resp("1:0", W),
    ["1:0"],
    batches({
      "4:0": kid("4:0", "K4"),
      "5:0": kid("5:0", "K5"),
      "6:0": kid("6:0", "K6"),
    }),
    { cap: 2 },
  );
  assert.deepEqual(closure.pulled.map((p) => p.nodeId).sort(), ["4:0", "5:0"]);
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.reason]),
    [["6:0", "cap-exceeded"]],
  );
  assert.equal(closure.cap, 2);
});

test("batches respect the ids-per-request bound", async () => {
  const kids = Array.from({ length: 5 }, (_, i) => `${i + 10}:0`);
  const W = entry(
    set("1:0", "W", [kids.map((k, i) => inst(`k${i}`, `${k}c`))]),
    Object.fromEntries(
      kids.map((k) => [`${k}c`, { name: "V=0", componentSetId: k }]),
    ),
  );
  const calls: string[][] = [];
  await followInstances(
    resp("1:0", W),
    ["1:0"],
    batches(
      Object.fromEntries(kids.map((k, i) => [k, entry(set(k, `K${i}`, [[]]))])),
      calls,
    ),
    { idsPerRequest: 2 },
  );
  assert.deepEqual(calls, [["10:0", "11:0"], ["12:0", "13:0"], ["14:0"]]);
});

test("null answers, non-components, the Slot utility, a name collision and a failed request each stay stubs, named", async () => {
  const W = entry(
    set("1:0", "W", [
      [inst("a", "2:1"), inst("b", "3:1"), inst("c", "4:1"), inst("d", "5:1")],
    ]),
    {
      "2:1": { name: "x", componentSetId: "2:0" },
      "3:1": { name: "x", componentSetId: "3:0" },
      "4:1": { name: "x", componentSetId: "4:0" },
      "5:1": { name: "x", componentSetId: "5:0" },
    },
  );
  const all = {
    "2:0": null,
    "3:0": entry({
      id: "3:0",
      name: "Frame",
      type: "FRAME",
      children: [],
    } as RestNode),
    "4:0": entry(set("4:0", "Slot", [[]])),
    "5:0": entry(set("5:0", "W", [[]])),
  };
  const { closure } = await followInstances(
    resp("1:0", W),
    ["1:0"],
    batches(all),
  );
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.reason]),
    [
      ["2:0", "not-found"],
      ["3:0", "not-a-component"],
      ["4:0", "utility-slot-set"],
      ["5:0", "set-name-collision"],
    ],
  );
  const failing: FetchNodesBatch = async () => {
    throw new Error("Figma API 500 on /v1/files/k/nodes");
  };
  const failed = await followInstances(resp("1:0", W), ["1:0"], failing);
  assert.ok(failed.closure.unresolved.every((u) => u.reason === "unreadable"));
});

test("an instance nested inside another instance is not followed (the mapper never maps it)", async () => {
  const N = entry(
    set("1:0", "N", [[inst("outer", "2:1", [inst("inner", "3:1")])]]),
    {
      "2:1": { name: "x", componentSetId: "2:0" },
      "3:1": { name: "x", componentSetId: "3:0" },
    },
  );
  const calls: string[][] = [];
  const { closure } = await followInstances(
    resp("1:0", N),
    ["1:0"],
    batches({ "2:0": entry(set("2:0", "Outer", [[]])) }, calls),
  );
  assert.deepEqual(calls, [["2:0"]]);
  assert.deepEqual(
    closure.pulled.map((p) => p.name),
    ["Outer"],
  );
});

test("deterministic: the same file answered in a different key order yields byte-identical closure output", async () => {
  const run = async (reverse: boolean) => {
    const W = entry(set("1:0", "W", [[inst("z", "6:1"), inst("y", "4:1")]]), {
      "6:1": { name: "x", componentSetId: "6:0" },
      "4:1": { name: "x", componentSetId: "4:0" },
    });
    const kids: Record<string, ReturnType<typeof entry>> = {
      "4:0": entry(set("4:0", "K4", [[]])),
      "6:0": entry(set("6:0", "K6", [[]])),
    };
    const t: FetchNodesBatch = async (ids) => {
      const order = reverse ? [...ids].reverse() : ids;
      return {
        name: "Kit",
        nodes: Object.fromEntries(order.map((id) => [id, kids[id]])),
      };
    };
    const out = await followInstances(resp("1:0", W), ["1:0"], t);
    return JSON.stringify(
      mapRestToDump(out.response, { closure: out.closure, fileKey: "k" }).dump,
    ).replace(/"extractedAt":"[^"]*"/, "");
  };
  assert.equal(await run(false), await run(true));
});

// ---------------------------------------------------------------------------
// The proposer's side
// ---------------------------------------------------------------------------

test("partition: a closure-pulled set that refuses is a named stub; a requested one still refuses", () => {
  const skipped = [
    {
      setName: "Tab",
      reason: 'Set "Tab" could not be proposed: axis',
      detail: "state-axis-state-not-carried:active",
    },
    { setName: "Tabs", reason: 'Set "Tabs" could not be proposed: x' },
  ];
  const { refused, closureChildren } = partitionClosureRefusals(skipped, {
    pulled: [
      {
        nodeId: "1",
        name: "Tab",
        type: "COMPONENT_SET",
        round: 1,
        referencedBy: ["Tabs"],
      },
    ],
  });
  assert.deepEqual(
    refused.map((s) => s.setName),
    ["Tabs"],
  );
  assert.equal(closureChildren.length, 1);
  assert.match(
    closureChildren[0].note,
    /^closure-child-refused:Tab:Set "Tab" could not be proposed: axis — state-axis-state-not-carried:active — /,
  );
  // No closure ran → every refusal refuses, as before.
  assert.equal(partitionClosureRefusals(skipped, undefined).refused.length, 2);
});

/** A parent whose one variant instances a child set; the child set came back
 *  with NO variants (as Altitude's Text Passage does on REST), so it refuses. */
function refusingChildDump(asClosure: boolean) {
  const parent = entry(
    {
      id: "1:0",
      name: "Holder",
      type: "COMPONENT_SET",
      componentPropertyDefinitions: {
        Size: { type: "VARIANT", defaultValue: "Md", variantOptions: ["Md"] },
      },
      children: [
        {
          id: "1:1",
          name: "Size=Md",
          type: "COMPONENT",
          layoutMode: "HORIZONTAL",
          absoluteBoundingBox: { x: 0, y: 0, width: 40, height: 20 },
          children: [
            {
              ...inst("chip", "2:1"),
              absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 },
            } as RestNode,
          ],
        },
      ],
    } as RestNode,
    { "2:1": { name: "Tone=A", componentSetId: "2:0" } },
    { "2:0": { name: "Chip" } },
  );
  const child = entry({
    id: "2:0",
    name: "Chip",
    type: "COMPONENT_SET",
    componentPropertyDefinitions: {
      Tone: { type: "VARIANT", defaultValue: "A", variantOptions: ["A"] },
    },
  } as RestNode);
  return { parent, child, asClosure };
}

test("the propose CLI: a refusing CLOSURE child falls back to its stub, named closure-child-refused; the same set REQUESTED still refuses the run", async () => {
  const work = mkdtempSync(path.join(tmpdir(), "closure-propose-"));
  try {
    const { parent, child } = refusingChildDump(true);
    const followed = await followInstances(
      resp("1:0", parent),
      ["1:0"],
      batches({ "2:0": child }),
    );
    assert.deepEqual(
      followed.closure.pulled.map((p) => p.name),
      ["Chip"],
    );
    const withClosure = mapRestToDump(followed.response, {
      closure: followed.closure,
      fileKey: "k",
    }).dump;
    writeFileSync(path.join(work, "closure.json"), JSON.stringify(withClosure));
    const tokens = TOKENS;
    const propose = (dumpFile: string, out: string) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          path.join(ROOT, "extract/figma/propose.ts"),
          dumpFile,
          "--out",
          out,
          "--tokens",
          tokens,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
        },
      );
    const ok = propose(
      path.join(work, "closure.json"),
      path.join(work, "out-closure"),
    );
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(
      ok.stderr,
      /closure-child-refused:Chip:Set "Chip" could not be proposed/,
    );
    const written = readdirSync(path.join(work, "out-closure"));
    assert.ok(
      written.includes("holder.contract.proposed.json"),
      written.join(","),
    );
    assert.ok(
      written.some((f) => /chip\.stub\.contract\.proposed\.json$/.test(f)),
      written.join(","),
    );
    assert.match(
      readFileSync(
        path.join(work, "out-closure", "figma-proposals.md"),
        "utf8",
      ),
      /closure-child-refused:Chip:/,
    );

    // The same two sets with NO closure record: Chip is not a closure child,
    // so its refusal refuses the whole run exactly as before.
    const plain = mapRestToDump(
      { name: "Kit", nodes: { "2:0": child, "1:0": parent } },
      { fileKey: "k" },
    ).dump;
    writeFileSync(path.join(work, "plain.json"), JSON.stringify(plain));
    const refused = propose(
      path.join(work, "plain.json"),
      path.join(work, "out-plain"),
    );
    assert.equal(refused.status, 2);
    assert.match(
      refused.stderr,
      /REFUSED: 1 component set\(s\) could not be proposed/,
    );
    assert.equal(
      existsSync(path.join(work, "out-plain", "holder.contract.proposed.json")),
      false,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Review fixes
// ---------------------------------------------------------------------------

for (const selfReference of [false, true])
  test(`review H2: a ${selfReference ? "same-set" : "cross-set"} cycle proposes AND generates — the cut edge is a distinct stub, so generate sees no cycle`, async () => {
    const work = mkdtempSync(path.join(tmpdir(), "closure-cycle-"));
    try {
      const box = (w: number, h: number) => ({
        x: 0,
        y: 0,
        width: w,
        height: h,
      });
      const cInst = (name: string, componentId: string) =>
        ({
          id: `i-${name}`,
          name,
          type: "INSTANCE",
          componentId,
          absoluteBoundingBox: box(20, 20),
          children: [],
        }) as RestNode;
      // The reviewer's probe (probe-cycle.mts): Holder's Md variant instances
      // Chip; Chip instances Holder's Sm variant — legal in Figma.
      const H = {
        document: {
          id: "1:0",
          name: "Holder",
          type: "COMPONENT_SET",
          componentPropertyDefinitions: {
            Size: {
              type: "VARIANT",
              defaultValue: "Md",
              variantOptions: ["Md", "Sm"],
            },
          },
          children: [
            {
              id: "1:1",
              name: "Size=Md",
              type: "COMPONENT",
              layoutMode: "HORIZONTAL",
              absoluteBoundingBox: box(40, 20),
              children: [
                cInst(
                  selfReference ? "holder" : "chip",
                  selfReference ? "1:2" : "2:1",
                ),
              ],
            },
            {
              id: "1:2",
              name: "Size=Sm",
              type: "COMPONENT",
              layoutMode: "HORIZONTAL",
              absoluteBoundingBox: box(20, 20),
              children: [],
            },
          ],
        } as RestNode,
        components: {
          [selfReference ? "1:2" : "2:1"]: {
            name: selfReference ? "Size=Sm" : "Tone=A",
            componentSetId: selfReference ? "1:0" : "2:0",
          },
        },
        componentSets: {
          [selfReference ? "1:0" : "2:0"]: {
            name: selfReference ? "Holder" : "Chip",
          },
        },
      };
      const C = {
        document: {
          id: "2:0",
          name: "Chip",
          type: "COMPONENT_SET",
          componentPropertyDefinitions: {
            Tone: { type: "VARIANT", defaultValue: "A", variantOptions: ["A"] },
          },
          children: [
            {
              id: "2:1",
              name: "Tone=A",
              type: "COMPONENT",
              layoutMode: "HORIZONTAL",
              absoluteBoundingBox: box(20, 20),
              children: [cInst("holder", "1:2")],
            },
          ],
        } as RestNode,
        components: { "1:2": { name: "Size=Sm", componentSetId: "1:0" } },
        componentSets: { "1:0": { name: "Holder" } },
      };
      const f = await followInstances(
        { name: "Kit", nodes: { "1:0": H } },
        ["1:0"],
        async (ids) => ({
          name: "Kit",
          nodes: Object.fromEntries(
            ids.map((id) => [id, id === "2:0" ? C : null]),
          ),
        }),
      );
      assert.equal(
        f.closure.cycles.length,
        1,
        "a same-set reference is a cycle too",
      );
      assert.equal(f.closure.cycles[0].from, selfReference ? "Holder" : "Chip");
      assert.equal(f.closure.cycles[0].to, "Holder");
      writeFileSync(
        path.join(work, "dump.json"),
        JSON.stringify(
          mapRestToDump(f.response, { closure: f.closure, fileKey: "k" }).dump,
        ),
      );
      const tokens = TOKENS;
      const out = path.join(work, "p");
      const prop = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          path.join(ROOT, "extract/figma/propose.ts"),
          path.join(work, "dump.json"),
          "--out",
          out,
          "--tokens",
          tokens,
        ],
        { cwd: ROOT, encoding: "utf8" },
      );
      assert.equal(prop.status, 0, prop.stderr);
      const files = readdirSync(out)
        .filter((x) => x.endsWith(".contract.proposed.json"))
        .sort();
      assert.deepEqual(files, [
        ...(selfReference ? [] : ["chip.contract.proposed.json"]),
        "ds-holder-cycle-cut.stub.contract.proposed.json",
        "holder.contract.proposed.json",
      ]);
      const gen = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          path.join(ROOT, "packages/cli/src/cli.ts"),
          "generate",
          ...files.map((x) => path.join(out, x)),
          "--out",
          path.join(work, "gen"),
          "--tokens",
          `${tokens},${path.join(out, "minted.dtcg.json")}`,
        ],
        { cwd: ROOT, encoding: "utf8" },
      );
      assert.equal(gen.status, 0, gen.stdout + gen.stderr);
      assert.doesNotMatch(
        gen.stdout + gen.stderr,
        /Circular contract dependency/,
      );
      assert.ok(existsSync(path.join(work, "gen", "Holder", "Holder.tsx")));
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

test("review C1: the requested contract is picked by its anchor node id — never by position — and refused by name when absent or ambiguous", () => {
  const c = (file: string, nodeId?: string) => ({
    file,
    contract: {
      id: file,
      bindings: { figma: { anchors: nodeId ? { nodeId } : {} } },
    },
  });
  // Altitude Tabs' folder: alphabetically, button sorts first.
  const folder = [
    c("button.contract.proposed.json", "3538:36730"),
    c("ds-tab-2.stub.contract.proposed.json", "3558:61955"),
    c("icon.contract.proposed.json", "3598:836"),
    c("tabs.contract.proposed.json", "3558:61955"),
  ];
  assert.deepEqual(pickRequestedContract(folder, "3558:61955"), {
    file: "tabs.contract.proposed.json",
  });
  assert.match(
    (pickRequestedContract(folder, "9:9") as { refusal: string }).refusal,
    /^requested-contract-not-found:9:9/,
  );
  assert.match(
    (
      pickRequestedContract(
        [...folder, c("tabs-2.contract.proposed.json", "3558:61955")],
        "3558:61955",
      ) as { refusal: string }
    ).refusal,
    /^requested-contract-ambiguous:3558:61955 — 2 /,
  );
});

test("review (low): an integer-like set name is never followed — JavaScript would reorder it ahead of its dependencies", async () => {
  const P = entry(set("1:0", "P", [[inst("x", "2:1"), inst("y", "3:1")]]), {
    "2:1": { name: "x", componentSetId: "2:0" },
    "3:1": { name: "y", componentSetId: "3:0" },
  });
  const { closure } = await followInstances(
    resp("1:0", P),
    ["1:0"],
    batches({
      "2:0": entry(set("2:0", "42", [[]])),
      "3:0": entry(set("3:0", "Fine", [[]])),
    }),
  );
  assert.deepEqual(
    closure.pulled.map((p) => p.name),
    ["Fine"],
  );
  assert.deepEqual(
    closure.unresolved.map((u) => [u.targetId, u.reason]),
    [["2:0", "set-name-integer-like"]],
  );
  // A REQUESTED set named like an index follows nothing, by name.
  const N = entry(set("1:0", "7", [[inst("y", "3:1")]]), {
    "3:1": { name: "y", componentSetId: "3:0" },
  });
  const calls: string[][] = [];
  const r = await followInstances(
    resp("1:0", N),
    ["1:0"],
    batches({ "3:0": entry(set("3:0", "Fine", [[]])) }, calls),
  );
  assert.deepEqual(calls, []);
  assert.deepEqual(
    r.closure.unresolved.map((u) => [u.targetId, u.reason]),
    [["3:0", "set-name-integer-like"]],
  );
});

test("review M4: a 429 waits what Retry-After says up to the cap, announced each time; a longer wait REFUSES by name", async () => {
  const answers = (retryAfter: string, then: "ok" | "429") => {
    let n = 0;
    return (async () => {
      n += 1;
      const limited = n === 1 || then === "429";
      const body = limited ? "rate limited" : JSON.stringify({ nodes: {} });
      return {
        ok: !limited,
        status: limited ? 429 : 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "retry-after" ? retryAfter : null,
        },
        json: async () => JSON.parse(body),
        text: async () => body,
      };
    }) as FetchLike;
  };
  const waits: number[] = [];
  const announced: string[] = [];
  const ok = await fetchNodes("k", ["1:0"], "t", {
    fetchImpl: answers("2", "ok"),
    sleep: async (ms) => void waits.push(ms),
    onRateLimited: (i) => announced.push(`${i.attempt}:${i.waitSeconds}`),
  });
  assert.deepEqual(ok, { nodes: {} });
  assert.deepEqual(waits, [2000]);
  assert.deepEqual(announced, ["1:2"]);
  await assert.rejects(
    fetchNodes("k", ["1:0"], "t", {
      fetchImpl: answers(String(MAX_RETRY_AFTER_SECONDS + 1), "ok"),
      sleep: async (ms) => void waits.push(ms),
      onRateLimited: () => {},
    }),
    /rate-limit-wait-exceeds-cap: Retry-After 61 s is over the 60 s/,
  );
  assert.deepEqual(waits, [2000]); // never slept on the refused one
  // Every retry 429s: three announced waits, then the 429 throws as an HTTP error.
  const many: string[] = [];
  await assert.rejects(
    fetchNodes("k", ["1:0"], "t", {
      fetchImpl: answers("1", "429"),
      sleep: async () => {},
      onRateLimited: (i) => many.push(String(i.attempt)),
    }),
    /Figma API 429/,
  );
  assert.deepEqual(many, ["1", "2", "3"]);
});
