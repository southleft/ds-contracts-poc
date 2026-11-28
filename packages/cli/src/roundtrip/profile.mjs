import { fileHash } from "./files.mjs";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { validateVariants } from "./surface.mjs";
import { resolveBundle, seal } from "./model.mjs";

export function inspectProfile(P, root) {
  assert.equal(P.version, 1, "unsupported roundtrip profile");
  for (const key of ["system", "component", "appearance", "tokens", "dependencies", "instances", "capture", "figma"])
    assert(P[key], "missing profile field: " + key);
  assert(P.appearance.variants.length > 0 && P.appearance.variants.length <= 128, "invalid declared variants");
  validateVariants(P.appearance.variants);
  assert(/^[A-Za-z_$][\w$]*$/.test(P.component.export), "invalid component export");
  for (const v of P.appearance.variants) assert(/^[\w-]+$/.test(v.key), "invalid variant key");
  assert(existsSync(path.resolve(root, P.capture.font.file)), "missing font: " + P.capture.font.family);
  const local = (p) => path.resolve(root, p),
    read = (p) => readFileSync(local(p), "utf8"),
    tokens = {};
  for (const [id, p] of Object.entries(P.tokens)) {
    assert(["primitive", "semantic", "component"].includes(p.tier), "invalid token tier: " + id);
    let value = JSON.parse(read(p.file)),
      type;
    for (const k of id.split(".")) {
      type = value.$type ?? value.type ?? type;
      value = value[k];
      assert(value, "missing token: " + id);
    }
    type = value.$type ?? value.type ?? type;
    assert.equal(type, "color", "unsupported token type: " + id);
    const field = p.field ?? "$value",
      literal = value[field];
    assert.equal(typeof literal, "string");
    const alias = literal.match(/^\{(.+)\}$/);
    tokens[id] = {
      id,
      tier: p.tier,
      role: p.role ?? p.tier,
      type,
      scopes: p.scopes ?? [],
      css: p.css ?? "--" + id.replaceAll(".", "-"),
      ...(alias ? { alias: alias[1] } : { value: literal.toLowerCase() }),
      source: { file: p.file, path: [...id.split("."), field], sha256: fileHash(local(p.file)) },
    };
  }
  const components = {};
  for (const [id, d] of Object.entries(P.dependencies)) {
    assert(d.selector, "missing dependency selector: " + id);
    if (d.export) assert(/^[A-Za-z_$][\w$]*$/.test(d.export), "invalid dependency export");
    components[id] = {
      id,
      name: d.name,
      kind: "svg",
      source: { path: d.source, sha256: fileHash(local(d.source)) },
      svg: "",
      viewport: "",
      inputs: { color: "currentColor" },
      requires: [],
    };
  }
  const parent = {
    id: P.component.id,
    name: P.component.name,
    kind: "component",
    source: { path: P.source, sha256: fileHash(local(P.source)) },
    requires: Object.keys(components).map((id) => ({ id, revision: "" })),
    instances: P.instances,
    codeOnly: P.codeOnly ?? [],
  };
  components[parent.id] = parent;
  for (const dep of Object.values(P.instances))
    assert(components[dep.component], "missing-component-contract: " + dep.component);
  const B = seal({
    contract: "system-aware/0.1",
    root: parent.id,
    system: { ...P.system, architecture: P.architecture, tokens },
    components,
  });
  for (const d of parent.requires) d.revision = components[d.id].revision;
  seal(B);
  const graph = resolveBundle(B);
  assert.equal(graph.status, "ready", JSON.stringify(graph.gaps));
  return B;
}
