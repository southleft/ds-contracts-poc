/**
 * `figma receive` — the dev door's pure core, unit-pinned (same discipline
 * as workers/assist/test: plain node:test, tsx-run, no framework).
 *
 * The load-bearing pin: WITHOUT --apply the plan's contractWrite is null —
 * the shell executes exactly the plan, so the no-silent-write guarantee is
 * proved here, not hoped for. A final integration case runs the REAL
 * receiveCommand shell against an in-process fake bridge and asserts the
 * existing contract file's bytes never move without --apply.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_PROPOSAL_TYPE,
  DRAWABLE_EMPTY,
  assertContractsNotDrawableEmpty,
  commitReceiveWrites,
  containedOutputPath,
  contractFileNameForId,
  figmaCommand,
  findExistingContractFile,
  isDrawableEmptyContract,
  parseProposal,
  planReceive,
  proposalFileNameForId,
  toBundle,
  unifiedDiff,
  type ProposalEnvelope,
} from "../src/commands/figma.js";
import {
  assertDestinationsUnderRoot,
  assertSafeRepoPath,
  assertUniqueDestinations,
  buildPlan,
  proposePrCommand,
} from "../src/commands/propose-pr.js";
import { revisionOf } from "../../../core/contract-provenance.js";
import { CliUsageError } from "../src/lib.js";

// The envelope exactly as an OLDER plugin engine's proposeDiff exportJson
// built it (no childStubs / mintedTokens) — kept as-is so backward
// compatibility is proved by every case that uses it. Anatomy carries a
// drawable token binding so --apply happy paths are not drawable-empty.
const ENVELOPE = {
  type: CONTRACT_PROPOSAL_TYPE,
  baseContractId: "polaris.badge",
  baseVersion: "1.0.0",
  setName: "Badge",
  summary: ["version: 1.0.0 → 1.1.0"],
  proposedContract: {
    id: "polaris.badge",
    name: "Badge",
    version: "1.1.0",
    props: [],
    anatomy: {
      root: { tokens: { "background-color": "{color.bg}" } },
    },
  },
  proposalNotes: [],
};

/** Schema-valid blank anatomy — the quiet failure Wave 1 acceptance #4 closes. */
const BLANK_CONTRACT = {
  id: "acme.blank",
  name: "Blank",
  version: "0.0.1",
  status: "draft",
  description: "stub anatomy — nothing drawable",
  semantics: { element: "div" },
  props: [],
  states: [],
  anatomy: { root: {} },
  anchors: {
    figma: { fileKey: null, componentSetKey: null },
    code: { importPath: "./Blank", export: "Blank" },
  },
};

const DRAWABLE_CONTRACT = {
  ...BLANK_CONTRACT,
  id: "acme.pill",
  name: "Pill",
  description: "carries a drawable token binding",
  anatomy: { root: { tokens: { "background-color": "{color.bg}" } } },
};

// ENVELOPE v2 (the export-envelope round): the same shape PLUS the two
// payloads the doors used to drop — childStubs and mintedTokens.
const STUB = { id: "polaris.icon", name: "Icon", version: "0.0.1", props: [] };
const MINTED = {
  tree: {
    imported: {
      "stub-icon": { width: { $type: "dimension", $value: "24px" } },
    },
  },
  count: 1,
  entries: [{ path: "imported.stub-icon.width", value: "24px" }],
};
const ENVELOPE_V2 = {
  ...ENVELOPE,
  childStubs: [STUB],
  mintedTokens: MINTED,
};

// ---------------------------------------------------------------------------
// parseProposal — envelope referee
// ---------------------------------------------------------------------------

test("parseProposal: the plugin exportJson envelope parses, fields carried", () => {
  const r = parseProposal(JSON.parse(JSON.stringify(ENVELOPE)));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.proposal.baseContractId, "polaris.badge");
    assert.equal(r.proposal.setName, "Badge");
    assert.deepEqual(r.proposal.summary, ["version: 1.0.0 → 1.1.0"]);
    assert.equal(
      (r.proposal.proposedContract as { version?: string }).version,
      "1.1.0",
    );
  }
});

test("parseProposal v2: childStubs + mintedTokens survive the parse; an OLD envelope without them still parses with the fields absent", () => {
  const v2 = parseProposal(JSON.parse(JSON.stringify(ENVELOPE_V2)));
  assert.ok(v2.ok);
  if (v2.ok) {
    assert.equal(v2.proposal.childStubs?.length, 1);
    assert.equal(
      (v2.proposal.childStubs?.[0] as { id?: string }).id,
      "polaris.icon",
    );
    assert.deepEqual(v2.proposal.mintedTokens?.tree, MINTED.tree);
    assert.equal(v2.proposal.mintedTokens?.count, 1);
  }
  const v1 = parseProposal(JSON.parse(JSON.stringify(ENVELOPE)));
  assert.ok(v1.ok);
  if (v1.ok) {
    assert.equal(
      v1.proposal.childStubs,
      undefined,
      "an old envelope parses with NO stubs invented",
    );
    assert.equal(
      v1.proposal.mintedTokens,
      undefined,
      "an old envelope parses with NO minted tree invented",
    );
  }
});

test("parseProposal v2: PRESENT-but-malformed payloads refuse by name (silently dropping a payload is the defect this closes)", () => {
  for (const [patch, needle] of [
    [{ childStubs: "not-an-array" }, "childStubs"],
    [{ childStubs: [null] }, "childStubs"],
    [{ mintedTokens: { count: 3 } }, "mintedTokens"],
    [{ mintedTokens: { tree: [1, 2] } }, "mintedTokens"],
  ] as Array<[Record<string, unknown>, string]>) {
    const r = parseProposal({
      ...JSON.parse(JSON.stringify(ENVELOPE)),
      ...patch,
    });
    assert.ok(!r.ok, JSON.stringify(patch));
    if (!r.ok)
      assert.ok(r.error.includes(needle), `${r.error} should name "${needle}"`);
  }
});

test("parseProposal projection: exact tuples verify, legacy is explicit, and weaker or forged receipts refuse", () => {
  const tuple = JSON.stringify([["Size", "md"]]);
  const exact = {
    status: "verified-exact",
    propertyNames: ["Size"],
    expectedCount: 1,
    observedCount: 1,
    tupleSetHash: revisionOf([tuple]).slice("sha256:".length),
    tuples: [tuple],
  };
  const parsedExact = parseProposal({ ...ENVELOPE, projection: exact });
  assert.ok(parsedExact.ok);
  if (parsedExact.ok)
    assert.equal(parsedExact.proposal.projection?.status, "verified-exact");

  const parsedLegacy = parseProposal({
    ...ENVELOPE,
    projection: {
      status: "legacy-unverified",
      reason: "structured-exact-evidence-absent",
    },
  });
  assert.ok(parsedLegacy.ok);

  for (const projection of [
    { status: "source-matrix-verified" },
    { status: "refused", code: "EXACT_MATRIX_RAGGED" },
    { ...exact, tupleSetHash: "0".repeat(64) },
    { ...exact, tuples: [tuple, tuple], expectedCount: 2, observedCount: 2 },
  ]) {
    const refused = parseProposal({ ...ENVELOPE, projection });
    assert.ok(!refused.ok, JSON.stringify(projection));
    if (!refused.ok) assert.ok(refused.error.includes("projection"));
  }
});

test("parseProposal: refusals by name — non-object, wrong tag, missing proposedContract, missing id", () => {
  for (const [raw, needle] of [
    ["not-json-object", "not a JSON object"],
    [
      { type: "CONTRACTS-BUNDLE", contracts: [{}] },
      "not tagged CONTRACT-PROPOSAL",
    ],
    [{ type: CONTRACT_PROPOSAL_TYPE }, 'no "proposedContract" object'],
    [
      { type: CONTRACT_PROPOSAL_TYPE, proposedContract: [1] },
      'no "proposedContract" object',
    ],
    [
      { type: CONTRACT_PROPOSAL_TYPE, proposedContract: { name: "x" } },
      "names the contract",
    ],
  ] as Array<[unknown, string]>) {
    const r = parseProposal(raw);
    assert.ok(!r.ok, JSON.stringify(raw));
    if (!r.ok)
      assert.ok(
        r.error.includes(needle),
        `${r.error} should include "${needle}"`,
      );
  }
});

test("commitReceiveWrites rolls back every destination after a late install failure", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ds-receive-rollback-"));
  try {
    const first = path.join(root, "contracts", "button.contract.json");
    const second = path.join(root, "src", "Button.tsx");
    mkdirSync(path.dirname(first), { recursive: true });
    mkdirSync(path.dirname(second), { recursive: true });
    writeFileSync(first, "old-contract\n");
    writeFileSync(second, "old-code\n");
    assert.throws(() =>
      commitReceiveWrites(
        new Map([
          [first, "new-contract\n"],
          [second, "new-code\n"],
        ]),
        {
          beforeInstall(index) {
            if (index === 1)
              throw new Error("late generated-code install failure");
          },
        },
      ),
    );
    assert.equal(readFileSync(first, "utf8"), "old-contract\n");
    assert.equal(readFileSync(second, "utf8"), "old-code\n");
    assert.deepEqual(
      readdirSync(path.dirname(first)).filter((name) =>
        name.includes(".receive-"),
      ),
      [],
    );
    assert.deepEqual(
      readdirSync(path.dirname(second)).filter((name) =>
        name.includes(".receive-"),
      ),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// unifiedDiff — the reviewed-change renderer
// ---------------------------------------------------------------------------

test("unifiedDiff: identical texts diff to nothing", () => {
  assert.deepEqual(unifiedDiff("a\nb\n", "a\nb\n", "x.json"), []);
});

test("unifiedDiff: one changed line yields headers, one hunk, -old +new with context", () => {
  const oldT =
    [
      "{",
      '  "id": "polaris.badge",',
      '  "version": "1.0.0",',
      '  "props": []',
      "}",
    ].join("\n") + "\n";
  const newT = oldT.replace("1.0.0", "1.1.0");
  const d = unifiedDiff(oldT, newT, "badge.contract.json");
  assert.equal(d[0], "--- a/badge.contract.json");
  assert.equal(d[1], "+++ b/badge.contract.json");
  assert.ok(d[2].startsWith("@@ "), d[2]);
  assert.ok(d.includes('-  "version": "1.0.0",'));
  assert.ok(d.includes('+  "version": "1.1.0",'));
  assert.ok(d.includes(" {"), "context lines carried");
  assert.equal(
    d.filter((l) => l.startsWith("@@")).length,
    1,
    "a single change is a single hunk",
  );
});

test("unifiedDiff: an all-new file is all-additions", () => {
  const d = unifiedDiff("", "{\n}\n", "new.contract.json");
  assert.ok(d.includes("+{"));
  assert.ok(d.includes("+}"));
  // The old side's single empty line matches the new text's trailing empty
  // line — it rides as context; nothing is removed.
  assert.equal(
    d.filter((l) => l.startsWith("-") && !l.startsWith("---")).length,
    0,
    "nothing removed on an all-new file",
  );
});

// ---------------------------------------------------------------------------
// planReceive — the write decision lives in the PURE core
// ---------------------------------------------------------------------------

const proposal = (): ProposalEnvelope => {
  const r = parseProposal(JSON.parse(JSON.stringify(ENVELOPE)));
  if (!r.ok) throw new Error(r.error);
  return r.proposal;
};

test("planReceive WITHOUT --apply: contractWrite is null even when the diff is non-empty — nothing writes silently", () => {
  const existing = {
    fileName: "badge.contract.json",
    text: '{\n  "id": "polaris.badge",\n  "version": "1.0.0"\n}\n',
  };
  const plan = planReceive(proposal(), existing, false);
  assert.equal(plan.contractWrite, null);
  assert.equal(plan.changed, true);
  assert.ok(plan.diff.length > 0, "the diff still renders for review");
  assert.equal(plan.fileName, "badge.contract.json");
  assert.equal(
    plan.proposalFileName,
    path.join(".proposals", "polaris.badge.proposal.json"),
  );
});

test("planReceive WITH --apply: contractWrite carries the canonical new text to the matched file", () => {
  const existing = {
    fileName: "oddly-named.contract.json",
    text: '{"id":"polaris.badge"}',
  };
  const plan = planReceive(proposal(), existing, true);
  assert.ok(plan.contractWrite);
  // Matched by id: the EXISTING filename wins over the convention.
  assert.equal(plan.contractWrite?.fileName, "oddly-named.contract.json");
  assert.equal(
    plan.contractWrite?.contents,
    JSON.stringify(ENVELOPE.proposedContract, null, 2) + "\n",
  );
});

test("planReceive: byte-identical existing file → changed false, empty diff, no write even with --apply", () => {
  const text = JSON.stringify(ENVELOPE.proposedContract, null, 2) + "\n";
  const plan = planReceive(
    proposal(),
    { fileName: "badge.contract.json", text },
    true,
  );
  assert.equal(plan.changed, false);
  assert.deepEqual(plan.diff, []);
  assert.equal(plan.contractWrite, null);
});

test("planReceive: no existing file → the <name>.contract.json convention (namespace prefix drops)", () => {
  const plan = planReceive(proposal(), null, false);
  assert.equal(plan.fileName, "badge.contract.json");
  assert.equal(contractFileNameForId("acme.pill"), "pill.contract.json");
  assert.equal(plan.oldText, null);
});

// ---------------------------------------------------------------------------
// planReceive v2 — the envelope's other two payloads land as their own files
// ---------------------------------------------------------------------------

const proposalV2 = (): ProposalEnvelope => {
  const r = parseProposal(JSON.parse(JSON.stringify(ENVELOPE_V2)));
  if (!r.ok) throw new Error(r.error);
  return r.proposal;
};

test("planReceive v2 WITH --apply: stub + minted files planned, and the next command carries the minted tree on --tokens", () => {
  const plan = planReceive(proposalV2(), null, true, {
    configTokens: ["tokens/a.tokens.json"],
    codeOutDir: "src/components",
    outDirLabel: "ctr",
  });
  assert.deepEqual(
    plan.stubWrites.map((s) => ({
      contractId: s.contractId,
      fileName: s.fileName,
    })),
    [{ contractId: "polaris.icon", fileName: "icon.contract.json" }],
  );
  assert.equal(
    plan.stubWrites[0].contents,
    JSON.stringify(STUB, null, 2) + "\n",
  );
  assert.equal(plan.mintedWrite?.fileName, "polaris.badge.minted.dtcg.json");
  assert.equal(
    plan.mintedWrite?.contents,
    JSON.stringify(MINTED.tree, null, 2) + "\n",
  );
  assert.ok(plan.nextCommand, "a runnable generate command is planned");
  const cmd = plan.nextCommand ?? "";
  assert.ok(cmd.startsWith("npx ds-contracts generate "), cmd);
  assert.ok(
    cmd.includes(path.join("ctr", "badge.contract.json")),
    "the command names the landed contract",
  );
  assert.ok(
    cmd.includes(path.join("ctr", "icon.contract.json")),
    "the command names the landed stub",
  );
  assert.ok(
    cmd.includes("--out src/components"),
    "the command uses the recorded generate.out",
  );
  assert.ok(
    cmd.includes(
      `--tokens tokens/a.tokens.json,${path.join("ctr", "polaris.badge.minted.dtcg.json")}`,
    ),
    `the command's --tokens carries the config corpus AND the minted tree (got: ${cmd})`,
  );
});

test("planReceive v2 WITHOUT --apply: the covenant covers the new payloads — no stub/minted writes, no command", () => {
  const plan = planReceive(proposalV2(), null, false, { outDirLabel: "ctr" });
  assert.deepEqual(plan.stubWrites, []);
  assert.equal(plan.mintedWrite, null);
  assert.equal(plan.nextCommand, null);
  assert.equal(plan.contractWrite, null);
});

test("planReceive v2: a stub whose id already has a REAL contract in --out is skipped BY NAME, never overwritten", () => {
  const plan = planReceive(proposalV2(), null, true, {
    existingStubIds: new Set(["polaris.icon"]),
    outDirLabel: "ctr",
  });
  assert.deepEqual(plan.stubWrites, []);
  assert.equal(plan.stubSkips.length, 1);
  assert.equal(plan.stubSkips[0].contractId, "polaris.icon");
  assert.ok(
    plan.stubSkips[0].reason.includes("already exists"),
    plan.stubSkips[0].reason,
  );
});

test("planReceive with an OLD envelope: no stubs or minted files invented, next command still runnable", () => {
  const plan = planReceive(proposal(), null, true, { outDirLabel: "ctr" });
  assert.deepEqual(plan.stubWrites, []);
  assert.equal(plan.mintedWrite, null);
  const cmd = plan.nextCommand ?? "";
  assert.ok(cmd.includes(path.join("ctr", "badge.contract.json")), cmd);
  assert.ok(
    !cmd.includes("--tokens"),
    "no token corpus is invented for an old envelope with no config",
  );
});

// ---------------------------------------------------------------------------
// findExistingContractFile — id is the identity, filename only the convention
// ---------------------------------------------------------------------------

test("findExistingContractFile: matches by document id across any filename; absent dir/id → null", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-receive-"));
  try {
    writeFileSync(
      path.join(dir, "zzz.contract.json"),
      '{"id":"polaris.badge","version":"1.0.0"}',
    );
    writeFileSync(
      path.join(dir, "other.contract.json"),
      '{"id":"polaris.card"}',
    );
    writeFileSync(path.join(dir, "broken.contract.json"), "{not json");
    const hit = findExistingContractFile(dir, "polaris.badge");
    assert.equal(hit?.fileName, "zzz.contract.json");
    assert.equal(findExistingContractFile(dir, "polaris.nope"), null);
    assert.equal(
      findExistingContractFile(path.join(dir, "absent"), "polaris.badge"),
      null,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The SHELL, end to end: real receiveCommand against an in-process fake
// bridge — the existing contract file's bytes never move without --apply.
// ---------------------------------------------------------------------------

test("figma receive (shell) without --apply: proposal artifact saved, contract file untouched; with --apply: written", async () => {
  const dump = JSON.stringify(ENVELOPE);
  let uploaded = false;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/bridge/session") {
      res.end(JSON.stringify({ code: "ABC234", ttlSeconds: 900 }));
    } else if (req.method === "GET" && req.url === "/bridge/ABC234") {
      // First poll delivers (the test plugin "already uploaded").
      uploaded = true;
      res.end(`{"status":"delivered","kind":"proposal","dump":${dump}}`);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "nothing is waiting under that code" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-receive-shell-"));
  const contractPath = path.join(dir, "badge.contract.json");
  const before = '{\n  "id": "polaris.badge",\n  "version": "1.0.0"\n}\n';
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(contractPath, before);

    // WITHOUT --apply: the contract file must not move by a byte.
    const code = await figmaCommand([
      "receive",
      "--out",
      dir,
      "--bridge",
      bridge,
    ]);
    assert.equal(code, 0);
    assert.ok(uploaded, "the fake bridge served the delivery");
    assert.equal(
      readFileSync(contractPath, "utf8"),
      before,
      "contract file bytes moved WITHOUT --apply",
    );
    const artifact = path.join(
      dir,
      ".proposals",
      "polaris.badge.proposal.json",
    );
    assert.ok(existsSync(artifact), "proposal artifact saved");
    assert.equal(
      (JSON.parse(readFileSync(artifact, "utf8")) as { type: string }).type,
      CONTRACT_PROPOSAL_TYPE,
    );

    // WITH --apply: the contract file becomes the proposal, canonical form.
    const code2 = await figmaCommand([
      "receive",
      "--out",
      dir,
      "--bridge",
      bridge,
      "--apply",
    ]);
    assert.equal(code2, 0);
    assert.equal(
      readFileSync(contractPath, "utf8"),
      JSON.stringify(ENVELOPE.proposedContract, null, 2) + "\n",
    );
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ENVELOPE v2 through the REAL shell: without --apply nothing but the
// proposal artifact (stubs and minted tree included INSIDE it); with --apply
// the stub and minted files land next to the contract.
test("figma receive (shell) v2: stub + minted land only WITH --apply; the artifact carries them either way", async () => {
  const dump = JSON.stringify(ENVELOPE_V2);
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/bridge/session") {
      res.end(JSON.stringify({ code: "ABC234", ttlSeconds: 900 }));
    } else if (req.method === "GET" && req.url === "/bridge/ABC234") {
      res.end(`{"status":"delivered","kind":"proposal","dump":${dump}}`);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "nothing is waiting under that code" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-receive-v2-"));
  try {
    // WITHOUT --apply: covenant — only the artifact, which carries all three.
    const code = await figmaCommand([
      "receive",
      "--out",
      dir,
      "--bridge",
      bridge,
    ]);
    assert.equal(code, 0);
    assert.ok(
      !existsSync(path.join(dir, "icon.contract.json")),
      "no stub file without --apply",
    );
    assert.ok(
      !existsSync(path.join(dir, "polaris.badge.minted.dtcg.json")),
      "no minted file without --apply",
    );
    const artifact = JSON.parse(
      readFileSync(
        path.join(dir, ".proposals", "polaris.badge.proposal.json"),
        "utf8",
      ),
    ) as { childStubs?: unknown[]; mintedTokens?: { count?: number } };
    assert.equal(
      artifact.childStubs?.length,
      1,
      "the artifact carries the stubs verbatim",
    );
    assert.equal(
      artifact.mintedTokens?.count,
      1,
      "the artifact carries the minted tree verbatim",
    );

    // WITH --apply: contract + stub + minted all land.
    const code2 = await figmaCommand([
      "receive",
      "--out",
      dir,
      "--bridge",
      bridge,
      "--apply",
    ]);
    assert.equal(code2, 0);
    assert.equal(
      readFileSync(path.join(dir, "badge.contract.json"), "utf8"),
      JSON.stringify(ENVELOPE_V2.proposedContract, null, 2) + "\n",
    );
    assert.equal(
      readFileSync(path.join(dir, "icon.contract.json"), "utf8"),
      JSON.stringify(STUB, null, 2) + "\n",
      "the stub lands as its own contract file",
    );
    assert.equal(
      readFileSync(path.join(dir, "polaris.badge.minted.dtcg.json"), "utf8"),
      JSON.stringify(MINTED.tree, null, 2) + "\n",
      "the minted tree lands as a DTCG file",
    );
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// A wrong-kind delivery refuses by name and exits non-zero — the dev door
// never lands a canvas dump as a contract.
test("figma receive (shell): a dump-kind delivery is refused by name, nothing written", async () => {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/bridge/session") {
      res.end(JSON.stringify({ code: "ABC234", ttlSeconds: 900 }));
    } else {
      res.end('{"status":"delivered","kind":"dump","dump":{"Badge":{}}}');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-receive-kind-"));
  try {
    const code = await figmaCommand([
      "receive",
      "--out",
      dir,
      "--bridge",
      bridge,
    ]);
    assert.equal(code, 1);
    assert.ok(
      !existsSync(path.join(dir, ".proposals")),
      "nothing written on refusal",
    );
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// ADVERSARIAL PINS (2026-08-03) — three attacks a verifier EXECUTED against
// the first cut of envelope v2. Each of these failed before its fix; keeping
// them as tests makes the falsification permanent.
// ---------------------------------------------------------------------------

test("ATTACK: a stub id carrying path separators cannot walk a write out of --out", () => {
  // Executed escape before the fix: id "ds.../../ESCAPED-STUB" landed the
  // write one directory ABOVE the target. The filename convention must yield
  // a single flat name for ANY id.
  for (const hostile of [
    "ds.../../ESCAPED-STUB",
    "ds./etc/passwd",
    "ds..\\..\\win",
    "ds.a/b/c",
    "...",
    "ds.",
  ]) {
    const name = contractFileNameForId(hostile);
    assert.ok(
      !name.includes("/") && !name.includes("\\"),
      `${hostile} → ${name} carries a separator`,
    );
    assert.ok(!name.includes(".."), `${hostile} → ${name} carries a dot-dot`);
    assert.ok(
      name.endsWith(".contract.json") && name.length > ".contract.json".length,
      `${hostile} → ${name} is not a real filename`,
    );
  }
});

test("ATTACK: proposal artifact names are flat for traversal, absolute, Windows, and Unicode separator ids while valid names stay unchanged", () => {
  assert.equal(
    proposalFileNameForId("polaris.badge"),
    "polaris.badge.proposal.json",
  );
  for (const hostile of [
    "../../ESCAPE",
    "/tmp/ESCAPE",
    String.raw`C:\temp\ESCAPE`,
    "ds.a/b",
    "ds.a\u2215b",
    "ds.a\uFF0Fb",
    "...",
  ]) {
    const name = proposalFileNameForId(hostile);
    assert.equal(
      path.basename(name),
      name,
      `${hostile} did not produce a flat basename`,
    );
    assert.ok(
      !name.includes("/") && !name.includes("\\") && !name.includes(".."),
      `${hostile} → ${name}`,
    );
  }
});

test("ATTACK: output containment rejects traversal and both native/Windows absolute planned writes", () => {
  const root = path.resolve("/tmp/contracts");
  assert.equal(
    containedOutputPath(root, path.join(".proposals", "safe.proposal.json")),
    path.join(root, ".proposals", "safe.proposal.json"),
  );
  for (const hostile of [
    "../escape.json",
    "/tmp/escape.json",
    String.raw`C:\temp\escape.json`,
  ]) {
    assert.throws(() => containedOutputPath(root, hostile), /REFUSED/);
  }
});

test("ATTACK: a hostile stub id flows through planReceive to a FLAT in-out filename", () => {
  const raw = JSON.parse(JSON.stringify(ENVELOPE_V2));
  raw.childStubs[0].id = "ds.../../ESCAPED-STUB";
  const r = parseProposal(raw);
  assert.ok(r.ok, !r.ok ? r.error : "");
  if (!r.ok) return;
  const plan = planReceive(r.proposal, null, true, { outDirLabel: "ctr" });
  for (const w of plan.stubWrites) {
    assert.ok(
      !w.fileName.includes("/") && !w.fileName.includes(".."),
      `planned write escapes: ${w.fileName}`,
    );
  }
});

test("ATTACK: no-apply receive with a traversal contract id writes only a contained sanitized proposal artifact", async () => {
  const hostile = {
    ...ENVELOPE,
    baseContractId: "../../ESCAPE",
    proposedContract: { ...ENVELOPE.proposedContract, id: "../../ESCAPE" },
  };
  const dump = JSON.stringify(hostile);
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/bridge/session") {
      res.end(JSON.stringify({ code: "ABC234", ttlSeconds: 900 }));
    } else {
      res.end(`{"status":"delivered","kind":"proposal","dump":${dump}}`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const parent = mkdtempSync(path.join(tmpdir(), "dsc-receive-traversal-"));
  const out = path.join(parent, "out");
  try {
    assert.equal(
      await figmaCommand(["receive", "--out", out, "--bridge", bridge]),
      0,
    );
    const parsed = parseProposal(hostile);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const plan = planReceive(parsed.proposal, null, false);
    assert.ok(existsSync(path.join(out, plan.proposalFileName)));
    assert.ok(
      !existsSync(path.join(parent, "ESCAPE.proposal.json")),
      "artifact escaped --out",
    );
  } finally {
    server.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("propose-pr refuses duplicate stub ids, sanitized destination collisions, and main-contract collisions", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-propose-collisions-"));
  const file = path.join(dir, "proposal.json");
  const cases = [
    {
      stubs: [{ ...STUB }, { ...STUB }],
      error: /duplicate child stub id "polaris\.icon"/,
    },
    {
      stubs: [
        { ...STUB, id: "ds.a/b" },
        { ...STUB, id: "ds.a\u2215b" },
      ],
      error: /same destination/,
    },
    {
      stubs: [{ ...STUB, id: "other.badge" }],
      error: /main contract destination/,
    },
    {
      stubs: [{ ...STUB, id: "polaris.badge" }],
      error: /main proposed contract id/,
    },
  ];
  try {
    for (const c of cases) {
      writeFileSync(file, JSON.stringify({ ...ENVELOPE, childStubs: c.stubs }));
      assert.throws(() => buildPlan(file, "acme/design-system", {}), c.error);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("propose-pr sanitizes hostile main-id sidecar paths and preserves valid destination names", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-propose-paths-"));
  try {
    const valid = path.join(dir, "valid.json");
    writeFileSync(valid, JSON.stringify({ ...ENVELOPE, mintedTokens: MINTED }));
    const validPlan = buildPlan(valid, "acme/design-system", {}).plan;
    assert.ok(
      validPlan.files.some(
        (f) => f.destPath === "contracts/badge.contract.json",
      ),
    );
    assert.ok(
      validPlan.files.some(
        (f) => f.destPath === "contracts/polaris.badge.minted.dtcg.json",
      ),
    );

    for (const hostileId of [
      "../../ESCAPE",
      "/tmp/ESCAPE",
      String.raw`C:\temp\ESCAPE`,
      "ds.a\uFF0Fb",
    ]) {
      const file = path.join(
        dir,
        `${Buffer.from(hostileId).toString("hex")}.json`,
      );
      writeFileSync(
        file,
        JSON.stringify({
          ...ENVELOPE,
          baseContractId: hostileId,
          proposedContract: { ...ENVELOPE.proposedContract, id: hostileId },
          mintedTokens: MINTED,
        }),
      );
      const plan = buildPlan(file, "acme/design-system", {}).plan;
      for (const output of plan.files) {
        assert.ok(output.destPath.startsWith("contracts/"), output.destPath);
        assert.ok(
          !output.destPath.includes("\\") &&
            !output.destPath.split("/").includes(".."),
          output.destPath,
        );
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("propose-pr collision refusal performs no GitHub request and leaves no planned output behind", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-propose-atomic-refusal-"));
  const file = path.join(dir, "proposal.json");
  writeFileSync(
    file,
    JSON.stringify({ ...ENVELOPE, childStubs: [{ ...STUB }, { ...STUB }] }),
  );
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => {
    requests += 1;
    throw new Error("fetch must not be reached");
  }) as typeof fetch;
  try {
    await assert.rejects(
      proposePrCommand([
        file,
        "--repo",
        "acme/design-system",
        "--token",
        "secret",
        "--no-code",
      ]),
      /duplicate child stub id/,
    );
    assert.equal(requests, 0);
    assert.deepEqual(readdirSync(dir), ["proposal.json"]);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("propose-pr live path preserves an existing real contract instead of PUTting its auto-proposed stub", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-propose-preserve-"));
  const file = path.join(dir, "proposal.json");
  writeFileSync(file, JSON.stringify({ ...ENVELOPE, childStubs: [STUB] }));
  const originalFetch = globalThis.fetch;
  const requests: Array<{ method: string; url: string }> = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ method, url });
    if (url.includes("/contents/contracts/icon.contract.json?ref=main")) {
      return new Response(JSON.stringify({ sha: "real-contract-sha" }), {
        status: 200,
      });
    }
    if (url.endsWith("/git/ref/heads/main")) {
      return new Response(JSON.stringify({ object: { sha: "base-sha" } }), {
        status: 200,
      });
    }
    if (method === "POST" && url.endsWith("/git/refs")) {
      return new Response("{}", { status: 201 });
    }
    if (url.includes("/contents/contracts/badge.contract.json?ref=")) {
      return new Response("{}", { status: 404 });
    }
    if (
      method === "PUT" &&
      url.endsWith("/contents/contracts/badge.contract.json")
    ) {
      return new Response("{}", { status: 201 });
    }
    if (method === "POST" && url.endsWith("/pulls")) {
      return new Response(
        JSON.stringify({ html_url: "https://example.test/pr/1", number: 1 }),
        { status: 201 },
      );
    }
    return new Response(
      JSON.stringify({ message: `unexpected ${method} ${url}` }),
      { status: 500 },
    );
  }) as typeof fetch;
  try {
    assert.equal(
      await proposePrCommand([
        file,
        "--repo",
        "acme/design-system",
        "--base",
        "main",
        "--token",
        "secret",
        "--no-code",
      ]),
      0,
    );
    assert.ok(
      requests.some((r) =>
        r.url.includes("/contents/contracts/icon.contract.json?ref=main"),
      ),
    );
    assert.ok(
      !requests.some(
        (r) => r.method === "PUT" && r.url.includes("icon.contract.json"),
      ),
    );
    assert.equal(
      requests.filter((r) => r.method === "PUT").length,
      1,
      JSON.stringify(requests),
    );
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ATTACK: a minted tree nested past any real DTCG shape is refused BY NAME, not a RangeError", () => {
  // Before the fix this blew the stack in planReceive AFTER deliver-once had
  // burned the payload — the failure read as a vanished delivery.
  const raw = JSON.parse(JSON.stringify(ENVELOPE_V2));
  let node: Record<string, unknown> = {};
  const tree = node;
  for (let i = 0; i < 500; i++) {
    const next = {};
    node.n = next;
    node = next;
  }
  node.$value = "#fff";
  raw.mintedTokens = { tree };
  const r = parseProposal(raw);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(/nests deeper than \d+ levels/.test(r.error), r.error);
});

// ---------------------------------------------------------------------------
// drawable-empty — Wave 1 acceptance #4: blank anatomy cannot Apply / bundle
// ---------------------------------------------------------------------------

test("isDrawableEmptyContract: empty/hollow anatomy is empty; substance (tokens/content/component/nested drawable parts) is not", () => {
  assert.equal(isDrawableEmptyContract({ id: "acme.x" }), true);
  assert.equal(isDrawableEmptyContract({ id: "acme.x", anatomy: {} }), true);
  assert.equal(
    isDrawableEmptyContract({ id: "acme.x", anatomy: { root: {} } }),
    true,
  );
  // Cold-review AC4: hollow parts/content must not count as drawable.
  assert.equal(
    isDrawableEmptyContract({
      id: "acme.x",
      anatomy: { root: { parts: { label: {} } } },
    }),
    true,
  );
  assert.equal(
    isDrawableEmptyContract({
      id: "acme.x",
      anatomy: { root: { content: {} } },
    }),
    true,
  );
  assert.equal(
    isDrawableEmptyContract({
      id: "acme.x",
      anatomy: { root: { tokens: { color: "{c}" } } },
    }),
    false,
  );
  assert.equal(
    isDrawableEmptyContract({
      id: "acme.x",
      anatomy: { root: { content: { prop: "label" } } },
    }),
    false,
  );
  assert.equal(
    isDrawableEmptyContract({
      id: "acme.x",
      anatomy: { root: { component: { id: "acme.child" } } },
    }),
    false,
  );
  assert.equal(
    isDrawableEmptyContract({
      id: "acme.x",
      anatomy: {
        root: { parts: { label: { tokens: { color: "{c}" } } } },
      },
    }),
    false,
  );
});

test("figma receive --apply refuses drawable-empty BEFORE commitReceiveWrites mutates the tree", async () => {
  const blankEnvelope = {
    type: CONTRACT_PROPOSAL_TYPE,
    baseContractId: "acme.blank",
    baseVersion: "0.0.1",
    setName: "Blank",
    summary: ["blank anatomy"],
    proposedContract: {
      id: "acme.blank",
      name: "Blank",
      version: "0.0.2",
      props: [],
      anatomy: { root: {} },
    },
    proposalNotes: [],
    childStubs: [STUB],
    mintedTokens: MINTED,
  };
  const dump = JSON.stringify(blankEnvelope);
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/bridge/session") {
      res.end(JSON.stringify({ code: "ABC234", ttlSeconds: 900 }));
    } else if (req.method === "GET" && req.url === "/bridge/ABC234") {
      res.end(`{"status":"delivered","kind":"proposal","dump":${dump}}`);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "nothing is waiting under that code" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-receive-drawable-empty-"));
  try {
    const code = await figmaCommand([
      "receive",
      "--out",
      dir,
      "--bridge",
      bridge,
      "--apply",
    ]);
    assert.equal(code, 1);
    assert.ok(
      !existsSync(path.join(dir, ".proposals")),
      "proposal artifact must not land — refusal is before commitReceiveWrites",
    );
    assert.ok(
      !existsSync(path.join(dir, "blank.contract.json")),
      "blank contract must not be written",
    );
    assert.ok(
      !existsSync(path.join(dir, "icon.contract.json")),
      "stub must not be written on drawable-empty refusal",
    );
    assert.ok(
      !existsSync(path.join(dir, "acme.blank.minted.dtcg.json")),
      "minted tokens must not be written on drawable-empty refusal",
    );
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("figma receive without --apply still saves a drawable-empty proposal for review", async () => {
  const blankEnvelope = {
    type: CONTRACT_PROPOSAL_TYPE,
    baseContractId: "acme.blank",
    baseVersion: "0.0.1",
    setName: "Blank",
    summary: ["blank anatomy"],
    proposedContract: {
      id: "acme.blank",
      name: "Blank",
      version: "0.0.2",
      props: [],
      anatomy: { root: {} },
    },
    proposalNotes: [],
  };
  const dump = JSON.stringify(blankEnvelope);
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && req.url === "/bridge/session") {
      res.end(JSON.stringify({ code: "ABC234", ttlSeconds: 900 }));
    } else {
      res.end(`{"status":"delivered","kind":"proposal","dump":${dump}}`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const bridge = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-receive-blank-review-"));
  try {
    assert.equal(
      await figmaCommand(["receive", "--out", dir, "--bridge", bridge]),
      0,
    );
    assert.ok(
      existsSync(path.join(dir, ".proposals", "acme.blank.proposal.json")),
      "review path may keep the proposal artifact",
    );
    assert.ok(
      !existsSync(path.join(dir, "blank.contract.json")),
      "review path must not write the contract",
    );
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("figma bundle refuses drawable-empty contracts by name and writes nothing", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-bundle-drawable-empty-"));
  try {
    const contractPath = path.join(dir, "blank.contract.json");
    const tokensPath = path.join(dir, "base.dtcg.json");
    const outPath = path.join(dir, "out.bundle.json");
    writeFileSync(contractPath, JSON.stringify(BLANK_CONTRACT, null, 2) + "\n");
    writeFileSync(
      tokensPath,
      JSON.stringify(
        { color: { bg: { $type: "color", $value: "#fff" } } },
        null,
        2,
      ) + "\n",
    );
    await assert.rejects(
      () =>
        figmaCommand([
          "bundle",
          contractPath,
          "--tokens",
          tokensPath,
          "--out",
          outPath,
        ]),
      (err: unknown) => {
        assert.ok(err instanceof CliUsageError);
        assert.ok(
          err.message.startsWith(`${DRAWABLE_EMPTY}:`),
          err.message,
        );
        assert.ok(err.message.includes("acme.blank"), err.message);
        return true;
      },
    );
    assert.ok(!existsSync(outPath), "bundle file must not be written");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("figma emit (script path) warns drawable-empty BY NAME, listing each stub — and stays silent when every contract is drawable", async () => {
  // §B.15's quiet failure, at the one canvas door that does NOT refuse:
  // the per-contract script emitter (CI diffing needs stub emission to
  // work). It must say, at emit time, which sets will land as named empty
  // frames — not let the canvas be the first place anyone finds out.
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-emit-stub-warn-"));
  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    const blankPath = path.join(dir, "blank.contract.json");
    const goodPath = path.join(dir, "pill.contract.json");
    const tokensPath = path.join(dir, "base.dtcg.json");
    const outDir = path.join(dir, "out");
    writeFileSync(blankPath, JSON.stringify(BLANK_CONTRACT, null, 2) + "\n");
    writeFileSync(goodPath, JSON.stringify(DRAWABLE_CONTRACT, null, 2) + "\n");
    writeFileSync(
      tokensPath,
      JSON.stringify(
        { color: { bg: { $type: "color", $value: "#fff" } } },
        null,
        2,
      ) + "\n",
    );

    // Mixed input: emit succeeds for BOTH, but the stub is named in a warning.
    const code = await figmaCommand([
      blankPath,
      goodPath,
      "--tokens",
      tokensPath,
      "--out",
      outDir,
    ]);
    assert.equal(code, 0, "emit is a warning door, not a refusal door");
    const stubWarnings = warnings.filter((w) =>
      w.includes(`${DRAWABLE_EMPTY}:`),
    );
    assert.equal(stubWarnings.length, 1, JSON.stringify(warnings));
    assert.ok(
      stubWarnings[0].includes("acme.blank"),
      `warning must list the stub contract: ${stubWarnings[0]}`,
    );
    assert.ok(
      !stubWarnings[0].includes("acme.pill"),
      `drawable contract must NOT be listed as a stub: ${stubWarnings[0]}`,
    );
    assert.ok(
      /EMPTY frames/i.test(stubWarnings[0]),
      `warning must say what lands on canvas: ${stubWarnings[0]}`,
    );
    assert.ok(
      /computed capture/i.test(stubWarnings[0]),
      `warning must name the fix: ${stubWarnings[0]}`,
    );

    // FALSIFICATION: all-drawable input must emit with NO stub warning.
    warnings.length = 0;
    const code2 = await figmaCommand([
      goodPath,
      "--tokens",
      tokensPath,
      "--out",
      path.join(dir, "out2"),
    ]);
    assert.equal(code2, 0);
    assert.equal(
      warnings.filter((w) => w.includes(`${DRAWABLE_EMPTY}:`)).length,
      0,
      `no stub in the input, no warning: ${JSON.stringify(warnings)}`,
    );
  } finally {
    console.warn = realWarn;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toBundle / publish door refuses drawable-empty; a drawable contract passes the gate", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "dsc-tobundle-drawable-empty-"));
  try {
    const blankPath = path.join(dir, "blank.contract.json");
    const goodPath = path.join(dir, "pill.contract.json");
    const blankBundlePath = path.join(dir, "blank.bundle.json");
    writeFileSync(blankPath, JSON.stringify(BLANK_CONTRACT, null, 2) + "\n");
    writeFileSync(goodPath, JSON.stringify(DRAWABLE_CONTRACT, null, 2) + "\n");
    writeFileSync(
      blankBundlePath,
      JSON.stringify(
        {
          type: "CONTRACTS-BUNDLE",
          version: 1,
          contracts: [BLANK_CONTRACT],
          tokenSet: { name: "T", base: {} },
        },
        null,
        2,
      ) + "\n",
    );
    assert.throws(
      () => toBundle(blankPath),
      (err: unknown) =>
        err instanceof CliUsageError &&
        err.message.startsWith(`${DRAWABLE_EMPTY}:`) &&
        err.message.includes("acme.blank"),
    );
    assert.throws(
      () => toBundle(blankBundlePath),
      (err: unknown) =>
        err instanceof CliUsageError &&
        err.message.startsWith(`${DRAWABLE_EMPTY}:`),
    );
    const ok = toBundle(goodPath);
    assert.equal(ok.contracts.length, 1);
    assert.equal(
      (ok.contracts[0] as { id: string }).id,
      "acme.pill",
    );
    assert.throws(
      () => assertContractsNotDrawableEmpty([BLANK_CONTRACT], "bundle"),
      /drawable-empty/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ATTACK: receive --apply generated-code path guards match propose-pr (traversal + out escape)", () => {
  // Security review Wave 1: receive reused generateCodeFiles but skipped
  // assertSafeRepoPath. Emitters often refuse hostile names earlier; the
  // commit gate must still refuse the destPath shape the review named
  // (`${generate.out}/../outside…`) before commitReceiveWrites.
  assert.throws(
    () => assertSafeRepoPath("generated/../pwned.html"),
    /REFUSED unsafe repository destination/,
  );
  assert.throws(
    () =>
      assertUniqueDestinations([
        { destPath: "generated/Safe.html" },
        { destPath: "generated/../pwned.html" },
      ]),
    /REFUSED unsafe repository destination/,
  );
  const root = mkdtempSync(path.join(tmpdir(), "dsc-receive-code-root-"));
  try {
    assert.throws(
      () =>
        assertDestinationsUnderRoot(
          [{ destPath: "other/pwned.html" }],
          root,
          "generated",
        ),
      /resolves outside generate\.out/,
    );
    assert.doesNotThrow(() =>
      assertDestinationsUnderRoot(
        [{ destPath: "generated/safe.html" }],
        root,
        "generated",
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  // Wiring pin: receiveCommand must call both guards before commit. Kept as
  // a source contract so a future edit that drops the calls fails here.
  // Resolve from this test file — evals run from repo root (and scratch), not
  // packages/cli cwd, so process.cwd()/src/… is the wrong tree.
  const receiveSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/commands/figma.ts"),
    "utf8",
  );
  assert.ok(
    receiveSrc.includes("assertUniqueDestinations(codeFiles)"),
    "receive --apply must call assertUniqueDestinations before commit",
  );
  assert.ok(
    receiveSrc.includes("assertDestinationsUnderRoot(codeFiles"),
    "receive --apply must call assertDestinationsUnderRoot before commit",
  );
});

test("commitReceiveWrites still stages proposal+contract+stub+minted+code as one transaction", () => {
  // Acceptance #5 confirmation: apply's write set is atomic across every
  // artifact class. Drawable-empty refuses before this runs; this pin keeps
  // the transactional commit itself from regressing to per-file writes.
  const root = mkdtempSync(path.join(tmpdir(), "dsc-receive-atomic-classes-"));
  try {
    const writes = new Map([
      [path.join(root, ".proposals", "x.proposal.json"), "proposal\n"],
      [path.join(root, "x.contract.json"), "contract\n"],
      [path.join(root, "child.contract.json"), "stub\n"],
      [path.join(root, "x.minted.dtcg.json"), "tokens\n"],
      [path.join(root, "src", "X.tsx"), "code\n"],
    ]);
    commitReceiveWrites(writes);
    for (const [dest, body] of writes) {
      assert.equal(readFileSync(dest, "utf8"), body);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
