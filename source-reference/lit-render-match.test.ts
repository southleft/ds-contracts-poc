import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { matchLitRender, type LitRenderInput } from "./lit-render-match.js";
import { assessSemantics, semanticHash } from "./semantics.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const source = JSON.parse(
  readFileSync(
    new URL(
      "../extract/fixtures/lit-template/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const recorded = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/lit-render-match/altitude-button.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
function actual(story = "atoms-button--default"): LitRenderInput {
  const row = recorded.records.find(
    (r: { story: string }) => r.story === story,
  );
  assert.equal(sha(row.measurement.json), row.measurement.sha256);
  assert.equal(sha(row.semantics.json), row.semantics.sha256);
  assert.equal(sha(source.source), recorded.sourceSha256);
  return {
    source: structuredClone(source),
    semantics: JSON.parse(row.semantics.json),
    boundTopology: JSON.parse(row.measurement.json).bound,
  };
}
function synthetic(render: string, story?: string): LitRenderInput {
  const input = actual(story);
  const text = `import {html} from 'lit'; import {ifDefined} from 'lit/directives/if-defined.js'; export class ALButton { render() { ${render} } }`;
  input.source = {
    source: text,
    sourceSha256: sha(text),
    className: "ALButton",
    modulePath: "synthetic/button.ts",
  };
  return input;
}
function rebind(input: LitRenderInput): void {
  input.semantics = assessSemantics(
    input.semantics.declaration,
    input.semantics.observation,
    {
      valid: true,
      sourcePngSha256: input.semantics.sourcePngSha256,
      sourceTreeSha256: input.semantics.sourceTreeSha256,
    },
  );
  input.boundTopology.declarationSha256 = input.semantics.declarationSha256;
  input.boundTopology.semanticObservationSha256 =
    input.semantics.observationSha256;
  input.boundTopology.topology!.observationSha256 = semanticHash(
    input.boundTopology.topology!.observation,
  );
}
const button =
  'html`<button part="button"><span><slot></slot></span></button>`';

test("TypeScript-only return wrappers preserve matching while static HTML interpolation cannot borrow ordinary Lit proof", () => {
  const ordinary = matchLitRender(synthetic(`return ${button};`));
  const wrapped = matchLitRender(synthetic(`return (${button}) as TemplateResult<1>;`));
  assert.equal(wrapped.status, "structure-matched");
  assert.deepEqual(wrapped.nodes.map(n => [n.tag, n.domPath]), ordinary.nodes.map(n => [n.tag, n.domPath]));
  for (const module of ['lit/static-html.js', 'lit-html/static.js']) {
    const input = synthetic('return html`<button part="button" data-unknown=${this.value}><span><slot></slot></span></button>`;');
    input.source.source = input.source.source.replace("from 'lit'", `from '${module}'`);
    input.source.sourceSha256 = sha(input.source.source);
    const result = matchLitRender(input);
    assert.equal(result.status, "refused");
    assert.ok(result.problems.includes("render-source-topology-unresolved"));
    assert.ok(result.sourceRead.problems.some(p => p.code === "static-html-values-unverified"));
    assert.deepEqual(result.bindings, []);
  }
});

test("static template correspondence requires exact observed parser input and the same image, tree and host", () => {
  const input = synthetic('return html`<button part="button" data-value=${this.value}><span><slot></slot></span></button>`;');
  input.source.source = input.source.source.replace("from 'lit'", "from 'lit/static-html.js'");
  input.source.sourceSha256 = sha(input.source.source);
  input.staticRender = {
    sourcePngSha256: input.semantics.sourcePngSha256,
    sourceTreeSha256: input.semantics.sourceTreeSha256!,
    observation: {version:1,policy:{version:1,sourceSha256:input.source.sourceSha256,className:'ALButton',tagName:'al-button'},
      status:'captured',problems:[],renders:1,last:{staticFields:[],value:{kind:'template',
        strings:['<button part="button" data-value=', '><span><slot></slot></span></button>'],values:[{kind:'undefined'}]}}},
  };
  assert.equal(matchLitRender(input).status,'structure-matched');
  for(const mutate of [
    (i:LitRenderInput)=>{i.staticRender!.sourcePngSha256='0'.repeat(64);},
    (i:LitRenderInput)=>{i.staticRender!.sourceTreeSha256='0'.repeat(64);},
    (i:LitRenderInput)=>{i.staticRender!.observation.policy.tagName='other-element';},
    (i:LitRenderInput)=>{i.staticRender!.observation.last!.value={kind:'template',strings:['<different></different>'],values:[]};},
  ]) {
    const changed=structuredClone(input);mutate(changed);
    refused(changed,/render-static-observation-identity-mismatch|static-template-parser-input-unexplained/);
  }
});
function refused(input: LitRenderInput, code: string | RegExp) {
  const result = matchLitRender(input);
  assert.equal(result.status, "refused", JSON.stringify(result));
  assert.equal(result.acceptedContract, null);
  assert.equal(result.bindings.length, 0);
  assert.equal(result.slots.length, 0);
  assert.ok(
    result.problems.some((p) =>
      typeof code === "string" ? p === code : code.test(p),
    ),
    JSON.stringify(result.problems),
  );
  return result;
}

test("three byte-preserved actual Button probes each have one structural correspondence", () => {
  for (const story of [
    "atoms-button--default",
    "atoms-button--secondary",
    "atoms-button--default-icon-before",
  ]) {
    const input = actual(story),
      result = matchLitRender(input);
    assert.equal(
      result.status,
      "structure-matched",
      JSON.stringify(result.problems),
    );
    assert.equal(result.acceptedContract, null);
    assert.equal(result.sourceSha256, source.sourceSha256);
    assert.equal(result.evaluatedShapes, 4);
    assert.equal(result.matchingShapes, 1);
    assert.equal(result.nodes[0].domPath, "host/shadow/2");
    assert.equal(result.nodes[0].visualPath, "");
    assert.ok(result.selectedTemplateIds.includes("template:6200:7046"));
    assert.ok(!result.selectedTemplateIds.includes("template:5409:6172"));
    assert.equal(
      result.guards.find((g) => g.expression.raw === "this.href")?.when,
      "falsy",
    );
    assert.equal(
      result.guards.find((g) => g.expression.raw === "this.href")?.evidence,
      "observed-scalar",
    );
    const helpers = result.guards.filter(
      (g) => g.evidence === "structure-only-unproven",
    );
    assert.equal(helpers.length, 2);
    assert.ok(helpers.every((g) => /slotNotEmpty/.test(g.expression.raw)));
    assert.ok(result.limitations.some((l) => l.startsWith("unproven-guard@")));
  }
});

test("exact AST slot identity joins shifting runtime paths without binding equal label text", () => {
  const base = matchLitRender(actual()),
    icon = matchLitRender(actual("atoms-button--default-icon-before"));
  assert.equal(base.slots[0].sourceNodeId, "element:6873");
  const iconDefault = icon.slots.find((s) => s.name === "")!;
  assert.equal(iconDefault.sourceNodeId, base.slots[0].sourceNodeId);
  assert.equal(base.slots[0].semanticPath, "0/0/0");
  assert.equal(iconDefault.semanticPath, "0/1/0");
  assert.deepEqual(base.slots[0].assigned, ["host/0"]);
  assert.deepEqual(iconDefault.assigned, ["host/0", "host/2"]);
  assert.equal(iconDefault.visualPaths.length, 2);
  const before = icon.slots.find((s) => s.name === "before")!;
  assert.deepEqual(before.assigned, ["host/1"]);
  assert.ok(
    before.visualPaths.length > before.assigned.length,
    "flattened descendants are not content arity",
  );
  const label = base.bindings.find((b) => b.sourceProperty === "label")!;
  assert.equal(label.attribute.name, "aria-label");
  assert.equal(label.observedAttributes["aria-label"], "Label");
  assert.equal(
    source.source.slice(label.sourceSpan.start, label.sourceSpan.end),
    "aria-label=${ifDefined(this.label)}",
  );
  assert.ok(!("sourceProperty" in base.slots[0]));
  assert.ok(base.limitations.some((l) => l.includes("Equal text")));
});

test("native and ARIA channels remain distinct; events and unsupported attributes retain spans", () => {
  const result = matchLitRender(actual());
  const disabled = result.bindings.find(
    (b) => b.sourceProperty === "isDisabled",
  )!;
  assert.equal(disabled.attribute.rawName, "aria-disabled");
  assert.equal(disabled.attribute.channel, "attribute");
  assert.equal(disabled.native?.properties.disabled.kind, "value");
  assert.deepEqual(disabled.native?.properties.disabled, {
    kind: "value",
    value: false,
  });
  assert.ok(!result.bindings.some((b) => b.attribute.name === "disabled"));
  assert.equal(
    result.bindings.find((b) => b.attribute.rawName === "@click")?.attribute
      .channel,
    "event",
  );
  const classBinding = result.bindings.find(
    (b) => b.attribute.name === "class",
  )!;
  assert.equal(classBinding.sourceProperty, undefined);
  assert.equal(classBinding.attribute.parts[0].kind, "expression");
  assert.ok(
    result.limitations.some((l) => l.includes("directive implementations")),
  );
});

test("hash changes, mismatched source class and swapped evidence rows fail closed", () => {
  const text = actual();
  text.source.source += "\n";
  refused(text, "render-source-refused");
  const observation = actual();
  observation.semantics.observation.properties.label = {
    kind: "value",
    value: "wrong",
  };
  refused(observation, "render-evidence-hash-mismatch");
  const topology = actual();
  topology.boundTopology.topology!.observation!.nodes[0].attributes!.fake =
    "yes";
  refused(topology, "render-evidence-hash-mismatch");
  const swapped = actual();
  swapped.boundTopology = actual("atoms-button--secondary").boundTopology;
  refused(swapped, "render-evidence-identity-mismatch");
  const cls = actual();
  cls.semantics.declaration.className = "Other";
  rebind(cls);
  refused(cls, "render-source-class-mismatch");
});

test("record status cannot override mismatched semantic/native facts", () => {
  const input = actual();
  input.boundTopology.topology!.observation!.nodes.find(
    (n) => n.domPath === "host/shadow/2",
  )!.attributes!["aria-label"] = "Other";
  rebind(input);
  refused(input, "bound-topology-native-path-mismatch");
  const refusedStatus = actual();
  refusedStatus.semantics.problems.push("capture-unstable");
  refused(refusedStatus, "render-evidence-refused");
});

test("same sample label cannot rescue a wrong literal slot identity or swapped root", () => {
  refused(
    synthetic(
      'return html`<button part="button"><span><slot name="after"></slot></span></button>`;',
    ),
    "render-structure-mismatch",
  );
  refused(
    synthetic('return html`<a part="button"><span><slot></slot></span></a>`;'),
    "render-structure-mismatch",
  );
});

test("missing, extra and reordered element structure cannot match", () => {
  refused(
    synthetic('return html`<button part="button"><slot></slot></button>`;'),
    "render-structure-mismatch",
  );
  refused(
    synthetic(
      'return html`<button part="button"><span><slot></slot><div></div></span></button>`;',
    ),
    "render-structure-mismatch",
  );
  const reordered = synthetic(
    'return html`<button part="button"><span><slot></slot></span><span class="al-c-button__icon"><slot name="before"></slot></span></button>`;',
    "atoms-button--default-icon-before",
  );
  refused(reordered, "render-structure-mismatch");
});

test("literal attributes constrain correspondence; dynamic classes never become an identity heuristic", () => {
  refused(
    synthetic(
      'return html`<button part="other"><span><slot></slot></span></button>`;',
    ),
    "render-structure-mismatch",
  );
  const input = synthetic(
    'return html`<button part="button" class=${this.unknownClass}><span><slot></slot></span></button>`;',
  );
  const result = matchLitRender(input);
  assert.equal(result.status, "structure-matched");
  assert.equal(
    result.bindings.find((b) => b.attribute.name === "class")?.sourceProperty,
    "unknownClass",
  );
  assert.ok(
    result.limitations.some((l) => l.includes("Dynamic/composite attributes")),
  );
});

test("scalar root guard chooses actual branch and wrong captured guard refuses", () => {
  const render = `if(this.href) return html\`<a><span><slot></slot></span></a>\`; return ${button};`;
  assert.equal(matchLitRender(synthetic(render)).status, "structure-matched");
  const wrong = synthetic(render);
  wrong.semantics.observation.properties.href = {
    kind: "value",
    value: "https://example.invalid",
  };
  rebind(wrong);
  refused(wrong, "render-structure-mismatch");
});

test("missing, unreadable and non-scalar guards are unknown rather than false", () => {
  for (const kind of ["missing", "unreadable", "non-scalar"] as const) {
    const input = synthetic(
      `if(this.ready) return html\`<a></a>\`; return ${button};`,
    );
    input.semantics.observation.properties.ready = { kind };
    rebind(input);
    refused(input, /guard-property-unobserved:ready/);
  }
});

test("unknown helper root alternatives and empty nested shapes must be unique", () => {
  const ambiguous = synthetic(`return this.choose() ? ${button} : ${button};`);
  assert.equal(
    refused(ambiguous, "render-structural-correspondence-ambiguous")
      .matchingShapes,
    2,
  );
  refused(
    synthetic(
      'return html`<button part="button">${this.choose() && html``}<span><slot></slot></span></button>`;',
    ),
    "render-structural-correspondence-ambiguous",
  );
});

test("multiple source paths and unresolved nested helpers cannot be selected by DOM resemblance", () => {
  refused(
    synthetic(`if(this.ready){} return ${button};`),
    "render-template-selection-unresolved",
  );
  refused(
    synthetic(
      `return html\`<button>\${this.wrap(html\`<span><slot></slot></span>\`)}</button>\`;`,
    ),
    /render-template-selection-unresolved|render-child-expression-unresolved/,
  );
  refused(
    synthetic(`return this.choose() ? ${button} : this.makeUnknownTemplate();`),
    "render-source-topology-unresolved",
  );
});

test("bounded shape enumeration rejects truncation and invalid caps", () => {
  refused({ ...actual(), maxShapes: 3 }, "render-shape-limit-exceeded");
  for (const maxShapes of [0, -1, 129, 1.5])
    refused({ ...actual(), maxShapes }, "render-shape-limit-invalid");
  assert.equal(
    matchLitRender({ ...actual(), maxShapes: 4 }).status,
    "structure-matched",
  );
});

test("comment and ASCII whitespace policy is explicit; visible source text is not silently dropped", () => {
  assert.equal(
    matchLitRender(
      synthetic(
        'return html`\n<!-- source marker --><button part="button">\n <span><slot></slot></span>\t</button>\n`;',
      ),
    ).status,
    "structure-matched",
  );
  refused(
    synthetic(
      'return html`<button part="button"><span>Label<slot></slot></span></button>`;',
    ),
    "render-source-text-unbound",
  );
  refused(
    synthetic(
      'return html`<button part="button">${0 && html`<div></div>`}<span><slot></slot></span></button>`;',
    ),
    "render-child-expression-unresolved",
  );
});

test("unbound visible runtime content and extra outer roots refuse instead of disappearing", () => {
  const text = actual();
  text.boundTopology.topology!.observation!.nodes.push({
    domPath: "host/shadow/2/30",
    kind: "text",
    text: "Injected",
  });
  rebind(text);
  refused(text, "render-structure-mismatch");
  const extra = actual();
  extra.boundTopology.topology!.observation!.nodes.push({
    domPath: "host/shadow/5",
    kind: "element",
    tag: "div",
    namespace: "http://www.w3.org/1999/xhtml",
    attributes: {},
    semanticPath: "1",
    shadowHostDomPath: "host",
  });
  rebind(extra);
  refused(extra, "render-structure-mismatch");
});

test("duplicate topology IDs, slot distribution and scalar object lies refuse even after digest recomputation", () => {
  const ids = actual();
  ids.boundTopology.topology!.observation!.nodes.push(
    structuredClone(ids.boundTopology.topology!.observation!.nodes[0]),
  );
  rebind(ids);
  refused(ids, "render-topology-node-malformed");
  const slots = actual();
  slots.boundTopology.topology!.observation!.slots[0].distribution = "fallback";
  rebind(slots);
  refused(slots, "render-structure-mismatch");
  const scalar = actual();
  scalar.semantics.observation.properties.href = {
    kind: "value",
    value: {},
  } as never;
  rebind(scalar);
  scalar.semantics.status = "observed";
  scalar.semantics.problems = [];
  refused(scalar, "render-scalar-observation-malformed");
});

test("semantic target paths must derive from the actual ordered DOM identity", () => {
  const input = actual();
  input.boundTopology.topology!.observation!.nodes.find(
    (n) => n.tag === "span",
  )!.semanticPath = "0";
  rebind(input);
  refused(input, "render-topology-semantic-path-mismatch");
});

test("opaque earlier render returns cannot steal a later template's correspondence", () => {
  for (const statement of [
    "try { return this.other(); } catch {}",
    "switch(this.ready) { case true: return this.other(); }",
    "while(this.ready) { return this.other(); }",
  ]) {
    refused(
      synthetic(`${statement} return ${button};`),
      "render-source-topology-unresolved",
    );
  }
  assert.equal(
    matchLitRender(
      synthetic(
        `const label = (() => { return 'same'; })(); return ${button};`,
      ),
    ).status,
    "structure-matched",
  );
});

test("a render mutation cannot select an unexecuted same-shaped branch from post-render properties", () => {
  const first =
    'html`<button part="button" aria-label=${ifDefined(this.label)}><span><slot></slot></span></button>`';
  const second =
    'html`<button part="button" aria-label=${ifDefined(this.name)}><span><slot></slot></span></button>`';
  for (const mutation of [
    'this.href = "changed";',
    '(() => { this.href = "changed"; })();',
    '(function () { this.href = "changed"; }).call(this);',
  ]) {
    const input = synthetic(
      `if(!this.href) { ${mutation} return ${first}; } return ${second};`,
    );
    // The first branch ran with href omitted; render changed it before the
    // observation. Both branches have the same structural skeleton, but only
    // the first actually supplied aria-label from label (not from name).
    input.semantics.observation.properties.href = {
      kind: "value",
      value: "changed",
    };
    rebind(input);
    const result = refused(input, "render-source-topology-unresolved");
    assert.ok(
      result.sourceRead.problems.some(
        (problem) => problem.code === "render-state-mutation-unresolved",
      ),
    );
    assert.equal(result.selectedTemplateIds.length, 0);
  }
});
