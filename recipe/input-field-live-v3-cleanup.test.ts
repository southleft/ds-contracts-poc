import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInputLiveV3CleanupRuntime,
  runInputLiveV3PhasesWithCleanup,
  type InputLiveV3CleanupResult,
} from "./input-field-live-v3-cleanup.js";

const NS = "ds.contracts.input.recipe.v2";
const RUN = "test-input-v3";
const PAGE_NAME = `Recipe Pivot / Input Field / ${RUN}`;
const OWNER = `recipe/input-field/${RUN}`;
const COLLECTION_OWNER = `${OWNER}/variable-collection`;
const ADAPTERS = ["material", "commerce"] as const;
const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (
  ...arguments_: string[]
) => (...values: unknown[]) => Promise<any>;

const pluginData = (values: Record<string, string>) => ({
  getSharedPluginData(namespace: string, key: string) {
    return namespace === NS ? (values[key] ?? "") : "";
  },
});

const fixture = (collision = false) => {
  const root: { name: string; children: any[] } = {
    name: "Scratch Project",
    children: [],
  };
  const safePage = {
    id: "safe",
    name: "Unrelated",
    ...pluginData({}),
    remove() {
      root.children = root.children.filter((page) => page !== safePage);
    },
  };
  const ownedPage = {
    id: "owned",
    name: PAGE_NAME,
    ...pluginData({ pageOwner: OWNER, runIdentity: RUN }),
    remove() {
      root.children = root.children.filter((page) => page !== ownedPage);
    },
  };
  root.children = [safePage, ownedPage];
  const collections: any[] = ADAPTERS.map((adapterIdentity, index) => {
    const collection = {
      id: `owned-collection-${index}`,
      name: `Recipe Input / ${RUN} / ${adapterIdentity}`,
      ...pluginData({
        collectionOwner: COLLECTION_OWNER,
        runIdentity: RUN,
        adapterIdentity,
      }),
      remove() {
        collections.splice(collections.indexOf(collection), 1);
      },
    };
    return collection;
  });
  const unrelated = {
    id: "unrelated-collection",
    name: collision ? `Recipe Input / ${RUN} / material` : "Unrelated",
    ...pluginData({}),
    remove() {
      collections.splice(collections.indexOf(unrelated), 1);
    },
  };
  collections.push(unrelated);
  let currentPage = ownedPage;
  const figma = {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    editorType: "figma",
    root,
    get currentPage() {
      return currentPage;
    },
    async loadAllPagesAsync() {},
    async setCurrentPageAsync(page: any) {
      currentPage = page;
    },
    variables: {
      async getLocalVariableCollectionsAsync() {
        return collections;
      },
    },
  };
  return { figma, root, collections, safePage, unrelated };
};

const cleanupCode = buildInputLiveV3CleanupRuntime({
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  fileName: "Scratch Project",
  editorType: "figma",
  namespace: NS,
  pageName: PAGE_NAME,
  runIdentity: RUN,
  adapterIdentities: ADAPTERS,
});

const executeCleanup = async (
  figma: Record<string, any>,
): Promise<InputLiveV3CleanupResult> =>
  new AsyncFunction("figma", cleanupCode)(figma);

test("cleanup switches pages, removes exact ownership, and is idempotent", async () => {
  const value = fixture();
  const first = await executeCleanup(value.figma);
  assert.deepEqual(first.requestedNodeIds, ["owned"]);
  assert.deepEqual(first.requestedCollectionIds, [
    "owned-collection-0",
    "owned-collection-1",
  ]);
  assert.equal(first.complete, true);
  assert.deepEqual(value.root.children, [value.safePage]);
  assert.deepEqual(value.collections, [value.unrelated]);
  assert.equal(value.figma.currentPage, value.safePage);

  const second = await executeCleanup(value.figma);
  assert.deepEqual(second.requestedNodeIds, []);
  assert.deepEqual(second.requestedCollectionIds, []);
  assert.equal(second.complete, true);
  assert.deepEqual(value.root.children, [value.safePage]);
  assert.deepEqual(value.collections, [value.unrelated]);
});

test("cleanup refuses matching names without exact ownership", async () => {
  const value = fixture(true);
  await assert.rejects(
    executeCleanup(value.figma),
    /INPUT-V3-CLEANUP-OWNERSHIP-COLLISION/,
  );
  assert.equal(value.root.children.length, 2);
  assert.equal(value.collections.length, 3);
});

test("every post-writer failure phase reaches the same cleanup finally path", async () => {
  for (const failedPhase of [
    "verification",
    "extraction",
    "evidence",
  ] as const) {
    let cleanups = 0;
    const result = await runInputLiveV3PhasesWithCleanup(
      (["verification", "extraction", "evidence"] as const).map((name) => ({
        name,
        async run() {
          if (name === failedPhase) throw new Error(`failed:${name}`);
          return name;
        },
      })),
      async () => {
        cleanups += 1;
        return {
          requestedNodeIds: ["owned"],
          removedNodeIds: ["owned"],
          requestedCollectionIds: ["one", "two"],
          removedCollectionIds: ["one", "two"],
          remainingOwnedNodes: 0,
          remainingOwnedCollections: 0,
          complete: true,
        };
      },
    );
    assert.equal(result.failedPhase, failedPhase);
    assert.match(String(result.failure), new RegExp(`failed:${failedPhase}`));
    assert.equal(result.cleanup.complete, true);
    assert.equal(cleanups, 1);
  }
});
