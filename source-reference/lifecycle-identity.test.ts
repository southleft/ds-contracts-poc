import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright-core";
import type { CemDeclarationFacts } from "../extract/adapters/cem.js";
import {
  captureStableSemantics,
  semanticHash,
  type SemanticObservation,
} from "./semantics.js";
import {
  deriveLifecycleIdentityPolicy,
  installLifecycleIdentityProbe,
  semanticReplayMatches,
  comparableSemantics,
} from "./lifecycle-identity.js";
const sha = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
const source = `import { nanoid as uniqueId } from 'nanoid';
export class ReferenceField extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this.fieldId=this.getAttribute('fieldid') ?? undefined; this.noteId=this.getAttribute('noteid') ?? undefined; this.note='Help'; this.checked=false; }
  connectedCallback() {
    this.fieldId=this.fieldId || uniqueId();
    if (this.note) { this.noteId=this.noteId || uniqueId(); }
    this.shadowRoot.innerHTML='<input id="'+this.fieldId+'" aria-describedby="'+this.noteId+'"><label for="'+this.fieldId+'">Label</label><slot name="note"><span id="'+this.noteId+'">Help</span></slot>';
  }
}`;
const declaration: CemDeclarationFacts = {
  modulePath: "field.ts",
  className: "ReferenceField",
  tagName: "reference-field",
  properties: [
    { name: "fieldId", attribute: "fieldid", typeText: "string" },
    { name: "noteId", attribute: "noteid", typeText: "string" },
    { name: "checked", typeText: "boolean" },
  ],
  attributes: [],
  slots: [{ name: "note" }],
  events: [],
  cssParts: [],
  cssProperties: [],
};
const input = (text = source) => ({
  source: text,
  sourceSha256: sha(text),
  modulePath: declaration.modulePath,
  className: declaration.className,
});
const policy = deriveLifecycleIdentityPolicy(input(), declaration)!;

test("lifecycle ID candidates require exact source, declared strings and lexically resolved fallback assignments", () => {
  assert.deepEqual(
    policy.properties.map((p) => p.name),
    ["fieldId", "noteId"],
  );
  assert.equal(
    deriveLifecycleIdentityPolicy(
      { ...input(), sourceSha256: "0".repeat(64) },
      declaration,
    ),
    undefined,
  );
  assert.equal(
    deriveLifecycleIdentityPolicy(
      input(source.replace("'nanoid'", "'lookalike'")),
      declaration,
    ),
    undefined,
  );
  assert.equal(
    deriveLifecycleIdentityPolicy(
      input(
        source.replace(
          "connectedCallback() {",
          'connectedCallback() { const uniqueId=()=>"fake";',
        ),
      ),
      declaration,
    ),
    undefined,
  );
  assert.equal(
    deriveLifecycleIdentityPolicy(
      input(source.replaceAll(" || uniqueId()", " ?? uniqueId()")),
      declaration,
    ),
    undefined,
  );
  assert.equal(
    deriveLifecycleIdentityPolicy(input(), {
      ...declaration,
      properties: declaration.properties.map((p) => ({
        ...p,
        typeText: "number",
      })),
    }),
    undefined,
  );
  assert.equal(
    deriveLifecycleIdentityPolicy(
      input(
        source
          .replace(
            "connectedCallback() {",
            "connectedCallback() { function nested() {",
          )
          .replace(
            "\n    this.shadowRoot.innerHTML",
            "\n    }\n    this.shadowRoot.innerHTML",
          ),
      ),
      declaration,
    ),
    undefined,
  );
});

async function capture(browser: Browser, attributes = "", instrument = true) {
  const context = await browser.newContext({
    viewport: { width: 600, height: 200 },
  });
  if (instrument) await installLifecycleIdentityProbe(context, policy);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Test-only runtime for the source pattern: no network or real package claim.
  const script = source
    .replace(
      "import { nanoid as uniqueId } from 'nanoid';",
      'const uniqueId=()=>crypto.getRandomValues(new Uint32Array(2)).join("-");',
    )
    .replace("export class", "class");
  await page.goto(
    "data:text/html," +
      encodeURIComponent(
        `<reference-field ${attributes}></reference-field><script>${script};customElements.define('reference-field',ReferenceField);</script>`,
      ),
  );
  const png = sha(await page.screenshot({ fullPage: true, caret: "initial" }));
  const observation = await captureStableSemantics(
    page,
    ["reference-field"],
    declaration,
    png,
    10,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(observation.problems, []);
  assert.equal(observation.nativeElements.length, 2);
  return { context, page, observation, png };
}

test("separate generated IDs compare by their proven local references; raw receipts remain different and unchanged", async () => {
  const browser = await chromium.launch();
  try {
    const a = await capture(browser),
      b = await capture(browser);
    const raw = JSON.stringify([a.observation, b.observation]);
    assert.notEqual(semanticHash(a.observation), semanticHash(b.observation));
    assert.equal(a.png, b.png);
    assert.equal(
      semanticReplayMatches(a.observation, b.observation, policy),
      true,
    );
    assert.equal(JSON.stringify([a.observation, b.observation]), raw);
    assert.equal(
      semanticReplayMatches(a.observation, b.observation),
      false,
      "receipt cannot authorize its own policy",
    );
    const before = await capture(browser, "", false),
      after = await capture(browser, "", false);
    assert.equal(
      semanticReplayMatches(before.observation, after.observation, policy),
      false,
      "legacy evidence stays refused without lifecycle proof",
    );
    assert.equal(
      semanticReplayMatches(before.observation, before.observation),
      true,
      "unchanged old exact observations still work",
    );
    await Promise.all(
      [a.context, b.context, before.context, after.context].map((c) =>
        c.close(),
      ),
    );
  } finally {
    await browser.close();
  }
});

test("caller identifiers stay exact; duplicate IDs, wrong scopes, broken edges, changed values and stale graphs refuse", async () => {
  const browser = await chromium.launch();
  try {
    const a = await capture(browser),
      b = await capture(browser);
    const supplied = await capture(
      browser,
      'fieldid="caller-field" noteid="caller-note"',
    );
    const sameCaller = await capture(
      browser,
      'fieldid="caller-field" noteid="caller-note"',
    );
    const changedCaller = await capture(
      browser,
      'fieldid="other-field" noteid="caller-note"',
    );
    assert.equal(
      semanticReplayMatches(
        supplied.observation,
        sameCaller.observation,
        policy,
      ),
      true,
    );
    assert.equal(
      semanticReplayMatches(
        supplied.observation,
        changedCaller.observation,
        policy,
      ),
      false,
    );
    assert.deepEqual(
      comparableSemantics(supplied.observation, policy).properties.fieldId,
      { kind: "value", value: "caller-field" },
    );
    const changes: Array<[string, (o: SemanticObservation) => void]> = [
      [
        "checked",
        (o) => {
          o.properties.checked = { kind: "value", value: true };
        },
      ],
      [
        "native disabled",
        (o) => {
          o.nativeElements[0].properties.disabled = {
            kind: "value",
            value: true,
          };
        },
      ],
      [
        "native value",
        (o) => {
          o.nativeElements[0].properties.value = {
            kind: "value",
            value: "changed",
          };
        },
      ],
      [
        "label for",
        (o) => {
          o.nativeElements[1].attributes.for = "missing";
        },
      ],
      [
        "help ref",
        (o) => {
          o.nativeElements[0].attributes["aria-describedby"] = "missing";
        },
      ],
      [
        "duplicate ID",
        (o) => {
          const n = o.referenceIdentity!.nodes[0];
          o.referenceIdentity!.nodes.push({
            ...structuredClone(n),
            path: "host::shadow/9",
          });
        },
      ],
      [
        "wrong scope",
        (o) => {
          o.referenceIdentity!.nodes[0].scope = "host::shadow/7::shadow";
        },
      ],
      [
        "unresolved graph ref",
        (o) => {
          o.referenceIdentity!.nodes[0].references["aria-describedby"] =
            "missing";
        },
      ],
      [
        "scope escape",
        (o) => {
          o.referenceIdentity!.outsideUses.push("for:label:generated");
        },
      ],
      [
        "missing lifecycle",
        (o) => {
          o.referenceIdentity!.connections = [];
        },
      ],
      [
        "multiple connects",
        (o) => {
          o.referenceIdentity!.connections.push(
            structuredClone(o.referenceIdentity!.connections[0]),
          );
        },
      ],
      [
        "changed lifecycle value",
        (o) => {
          o.referenceIdentity!.connections[0].fieldId.after = {
            kind: "value",
            value: "changed",
          };
        },
      ],
      [
        "missing proof node",
        (o) => {
          o.referenceIdentity!.nodes.splice(1, 1);
        },
      ],
      [
        "source policy changed",
        (o) => {
          o.referenceIdentity!.policy.sourceSha256 = "0".repeat(64);
        },
      ],
    ];
    for (const [name, change] of changes) {
      const altered = structuredClone(b.observation);
      change(altered);
      assert.equal(
        semanticReplayMatches(a.observation, altered, policy),
        false,
        name,
      );
    }
    const stale = structuredClone(a.observation);
    stale.nativeElements[1].attributes.for = "broken";
    assert.equal(
      semanticReplayMatches(stale, stale, policy),
      false,
      "even equal receipts must corroborate their graph",
    );
    await Promise.all(
      [
        a.context,
        b.context,
        supplied.context,
        sameCaller.context,
        changedCaller.context,
      ].map((c) => c.close()),
    );
  } finally {
    await browser.close();
  }
});
