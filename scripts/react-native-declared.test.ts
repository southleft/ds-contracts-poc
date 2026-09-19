import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PNG } from "pngjs";
import {
  collectDeclaredEvidence,
  type DeclaredSpec,
} from "./react-native-declared-record.js";
import {
  checkDeclaredEvidence,
  DECLARED_EVIDENCE,
} from "./react-native-declared-check.js";
import { REPO, sha256 } from "./react-native-fidelity-check.js";
import { sourceSide } from "./react-native-fidelity-pair.js";
import { execFileSync } from "node:child_process";

const temp = (run: (dir: string) => void): void => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "declared-fidelity-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const read = (dir: string, file: string): any =>
  JSON.parse(readFileSync(path.join(dir, file), "utf8"));
const write = (dir: string, file: string, value: unknown): Buffer => {
  const data = Buffer.from(`${JSON.stringify(value)}\n`),
    target = path.join(dir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, data);
  return data;
};
const edit = (dir: string, file: string, mutate: (data: any) => void): void => {
  const data = read(dir, file);
  mutate(data);
  write(dir, file, data);
};
const OP = "source-native-app/operations/probe";
const INSPECT = "react-initial-inspections/probe/inspection";

function comparisonFixture(dir: string): DeclaredSpec[] {
  const specs = fixture(dir),
    ownership = "react-source-ownership/reference/ownership";
  const original = readFileSync(path.join(dir, INSPECT, "states/0.png"));
  const bounds = { x: 0, y: 0, width: 10, height: 10 };
  const framed = sourceSide(original, bounds, "source-framing/probe.json", []);
  const report = write(dir, `${ownership}/report.json`, {
    rows: [
      {
        id: "case",
        matched: true,
        sourceImage: sha256(original),
        observedImage: sha256(original),
      },
    ],
  });
  write(dir, `${ownership}/case/source-tree.json`, {
    status: "captured",
    sourcePngSha256: sha256(original),
    tree: { nodes: [] },
  });
  writeFileSync(path.join(dir, ownership, "case/source.png"), original);
  const inventory = write(dir, `${ownership}/integrity.json`, {
    files: Object.fromEntries(
      ["report.json", "case/source-tree.json", "case/source.png"].map(
        (file) => [file, sha256(readFileSync(path.join(dir, ownership, file)))],
      ),
    ),
  });
  edit(dir, `${OP}/operation.json`, (h) => {
    h.request = {
      root: {
        referenceId: "reference",
        ownership: { id: "ownership", sha256: sha256(report) },
        caseId: "case",
        inventorySha256: sha256(inventory),
      },
    };
  });
  edit(dir, `${OP}/events/00000001.json`, (e) => {
    e.envelope.result = { content: e.envelope.result };
  });
  write(dir, "source-framing/probe.json", {
    version: 1,
    qualification: "unqualified",
    sourceSha256: sha256(original),
    imageSha256: sha256(framed.png),
    bounds,
    crop: framed.source.crop,
  });
  chain(dir);
  specs[0].source = {
    kind: "comparison",
    framing: "source-framing/probe.json",
  };
  return specs;
}

test("caller-frame recording authenticates ownership and recomputes its framing record", () =>
  temp((dir) => {
    const specs = comparisonFixture(dir);
    assert.equal(
      collectDeclaredEvidence(dir, specs).manifest.cohorts[0].pairs[0].variant,
      "case",
    );
    edit(dir, "source-framing/probe.json", (f) => {
      f.imageSha256 = "changed";
    });
    assert.throws(
      () => collectDeclaredEvidence(dir, specs),
      /comparison-framing-changed/,
    );
  }));
test("a framing record for another source cannot be substituted", () =>
  temp((dir) => {
    const specs = comparisonFixture(dir);
    edit(dir, "source-framing/probe.json", (f) => {
      f.sourceSha256 = "other";
    });
    assert.throws(
      () => collectDeclaredEvidence(dir, specs),
      /comparison-framing-mismatch/,
    );
  }));
test("record CLI refuses an existing output directory before reading the archive", () =>
  temp((dir) => {
    writeFileSync(path.join(dir, "preserved.txt"), "preserve me");
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            "--import",
            "tsx",
            path.join(REPO, "scripts/react-native-declared-record.ts"),
            "--out",
            dir,
          ],
          { stdio: "pipe" },
        ),
      /output-exists/,
    );
    assert.equal(
      readFileSync(path.join(dir, "preserved.txt"), "utf8"),
      "preserve me",
    );
    assert.deepEqual(readdirSync(dir), ["preserved.txt"]);
  }));

function seal(dir: string): void {
  const names = [
    "report.json",
    "request.json",
    "states/0.json",
    "states/0.png",
  ];
  const files = Object.fromEntries(
    names.map((name) => [
      name,
      sha256(readFileSync(path.join(dir, INSPECT, name))),
    ]),
  );
  const inventory = write(dir, `${INSPECT}/integrity.json`, { files });
  edit(dir, `${OP}/operation.json`, (header) => {
    header.request.observation.inventorySha256 = sha256(inventory);
    header.request.observation.reportSha256 = files["report.json"];
  });
}
function chain(dir: string): void {
  let previous = sha256(readFileSync(path.join(dir, OP, "operation.json")));
  for (const [sequence, file] of ["00000000.json", "00000001.json"].entries()) {
    const event = read(dir, `${OP}/events/${file}`);
    event.sequence = sequence;
    event.previousSha256 = previous;
    previous = sha256(write(dir, `${OP}/events/${file}`, event));
  }
}
function fixture(dir: string): DeclaredSpec[] {
  const original = new PNG({ width: 900, height: 600 });
  original.data.fill(255);
  const source = PNG.sync.write(original),
    native = new PNG({ width: 18, height: 18 });
  native.data.fill(255);
  const tree = { nodes: [] },
    anchor = { referenceId: "reference", ownership: { id: "ownership" } };
  write(dir, `${INSPECT}/request.json`, { anchor, caseId: "case" });
  write(dir, `${INSPECT}/report.json`, {
    phase: "complete",
    sourceUnchanged: true,
    problems: [],
    observation: {
      rows: [
        {
          id: "0",
          status: "observed",
          changes: { disabled: { kind: "set", value: false } },
          image: sha256(source),
        },
      ],
    },
  });
  write(dir, `${INSPECT}/states/0.json`, {
    tree,
    image: sha256(source),
    bounds: { x: 0, y: 0, width: 10, height: 10 },
  });
  writeFileSync(path.join(dir, INSPECT, "states/0.png"), source);
  write(dir, `${OP}/operation.json`, {
    planRevision: "sha256:original-plan",
    request: { anchor, caseId: "case", observation: { id: "inspection" } },
  });
  seal(dir);
  const command = {
    attemptId: "attempt",
    nonce: "nonce",
    scriptSha256: "script",
    phase: "readback",
    readOnly: true,
  };
  write(dir, `${OP}/events/00000000.json`, { kind: "dispatch", command });
  write(dir, `${OP}/events/00000001.json`, {
    kind: "result",
    envelope: {
      ...command,
      result: {
        status: "native-readback-collected",
        receiptKind: "independent-native-component-readback",
        operationId: "probe",
        acceptedContract: null,
        nativeQualification: "unqualified",
        problems: [],
        planRevision: "sha256:original-plan",
        nodes: [
          { id: "node", type: "COMPONENT", values: { width: 10, height: 10 } },
        ],
        images: [
          {
            nodeId: "node",
            caseId: "variant:disabled=false",
            pngBase64: PNG.sync.write(native).toString("base64"),
            exportBounds: {
              layout: { x: 0, y: 0, width: 10, height: 10 },
              render: { x: 0, y: 0, width: 18, height: 18 },
            },
          },
        ],
      },
    },
  });
  chain(dir);
  return [
    {
      id: "probe",
      component: "Probe",
      description: "Synthetic test",
      operation: "probe",
      journal: OP,
      event: "00000001.json",
      source: { kind: "initial", inspection: INSPECT },
    },
  ];
}

test("recorder is deterministic, reads without archive writes, and never commits execution material", () =>
  temp((dir) => {
    const specs = fixture(dir),
      before = readdirSync(dir, { recursive: true });
    const first = collectDeclaredEvidence(dir, specs),
      second = collectDeclaredEvidence(dir, specs);
    assert.deepEqual(first, second);
    assert.deepEqual(readdirSync(dir, { recursive: true }), before);
    assert.equal(first.manifest.cohorts[0].pairs.length, 1);
    assert.equal(first.manifest.acceptedContract, null);
    assert.doesNotMatch(
      first.files.get("manifest.json")!.toString(),
      /pngBase64|"nonce"|"scriptSha256"/,
    );
  }));

for (const [name, mutate, expected] of [
  [
    "broken event chain",
    (dir: string) =>
      edit(dir, `${OP}/events/00000001.json`, (e) => {
        e.previousSha256 = "changed";
      }),
    /journal-chain-invalid/,
  ],
  [
    "uncorrelated result",
    (dir: string) => {
      edit(dir, `${OP}/events/00000001.json`, (e) => {
        e.envelope.nonce = "different";
      });
      chain(dir);
    },
    /journal-result-uncorrelated/,
  ],
  [
    "write result presented as a read",
    (dir: string) => {
      edit(dir, `${OP}/events/00000000.json`, (e) => {
        e.command.readOnly = false;
      });
      chain(dir);
    },
    /journal-result-uncorrelated/,
  ],
  [
    "changed source bytes",
    (dir: string) =>
      writeFileSync(path.join(dir, INSPECT, "states/0.png"), "changed"),
    /archive-file-changed/,
  ],
  [
    "changed inventory",
    (dir: string) =>
      edit(dir, `${INSPECT}/integrity.json`, (i) => {
        i.files["states/0.png"] = "changed";
      }),
    /archive-inventory-changed/,
  ],
  [
    "different plan with valid chain",
    (dir: string) => {
      edit(dir, `${OP}/events/00000001.json`, (e) => {
        e.envelope.result.planRevision = "sha256:changed-plan";
      });
      chain(dir);
    },
    /readback-source-plan-changed/,
  ],
  [
    "different source reference with sealed files",
    (dir: string) => {
      edit(dir, `${INSPECT}/request.json`, (r) => {
        r.anchor.referenceId = "different";
      });
      seal(dir);
      chain(dir);
    },
    /inspection-source-mismatch/,
  ],
  [
    "ambiguous variant",
    (dir: string) => {
      edit(dir, `${OP}/events/00000001.json`, (e) => {
        e.envelope.result.images.push(e.envelope.result.images[0]);
      });
      chain(dir);
    },
    /variant-pairing-not-unique/,
  ],
  [
    "missing recorded export origin",
    (dir: string) => {
      edit(dir, `${OP}/events/00000001.json`, (e) => {
        delete e.envelope.result.images[0].exportBounds;
      });
      chain(dir);
    },
    /native-layout-origin-not-recorded/,
  ],
  [
    "unpaired native member",
    (dir: string) => {
      edit(dir, `${OP}/events/00000001.json`, (e) => {
        e.envelope.result.images.push({
          ...e.envelope.result.images[0],
          nodeId: "other",
          caseId: "variant:disabled=true",
        });
      });
      chain(dir);
    },
    /native-variant-unpaired/,
  ],
] as const)
  test(`recorder refuses ${name}`, () =>
    temp((dir) => {
      const specs = fixture(dir);
      mutate(dir);
      assert.throws(() => collectDeclaredEvidence(dir, specs), expected);
    }));

test("a successful committed check retains the historical Badge miss and every alignment refusal", () => {
  const score = checkDeclaredEvidence(path.join(REPO, DECLARED_EVIDENCE));
  assert.equal(score.rows.length, 11);
  const badge = score.rows.find((r) => r.cohort === "family-badge")!;
  assert.equal(badge.historical.pct, 6.25);
  assert.equal(badge.verdict, "named-font-residual");
  assert.equal(
    score.rows.filter(
      (r) => r.cohort === "family-switch" && r.aligned.pct === null,
    ).length,
    9,
  );
});
for (const [name, file, mutate, expected] of [
  [
    "dropped pair",
    "manifest.json",
    (m: any) => {
      m.cohorts[0].pairs.pop();
    },
    /coverage-changed/,
  ],
  [
    "duplicated cohort",
    "manifest.json",
    (m: any) => {
      m.cohorts.push(m.cohorts[0]);
    },
    /duplicate-cohort/,
  ],
  [
    "changed native hash",
    "manifest.json",
    (m: any) => {
      m.cohorts[0].pairs[0].files.native.sha256 = "changed";
    },
    /evidence-hash-mismatch/,
  ],
  [
    "invented score",
    "SCORECARD.json",
    (m: any) => {
      m.rows[0].historical.pct = 99;
    },
    /declared-derived-stale/,
  ],
] as const)
  test(`offline check refuses ${name}`, () =>
    temp((dir) => {
      cpSync(path.join(REPO, DECLARED_EVIDENCE), dir, { recursive: true });
      edit(dir, file, mutate);
      assert.throws(() => checkDeclaredEvidence(dir), expected);
    }));
