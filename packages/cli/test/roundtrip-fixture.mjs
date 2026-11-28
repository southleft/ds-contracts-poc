import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { hash, canonical } from "../src/roundtrip/surface.mjs";
import { seal } from "../src/roundtrip/model.mjs";
import { planWriteback } from "../src/roundtrip/plan.mjs";

export function fixture(t) {
  const base = resolve(process.cwd().endsWith("/packages/cli") ? "../../private" : "private", "roundtrip-tests");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "writeback-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const save = (p, value) => writeFileSync(join(dir, p), typeof value === "string" ? value : canonical(value));
  const read = (p) => readFileSync(join(dir, p), "utf8");
  save("tokens.json", '{\n  "primitive": "#123456", "semantic": "{primitive}", "component": "{semantic}"\n}\n');
  save("source.tsx", "authored behavior");
  const tokens = {};
  for (const [i, id] of ["primitive", "semantic", "component"].entries()) {
    tokens[id] = {
      id,
      type: "color",
      tier: id,
      css: "--" + id,
      ...(i ? { alias: i === 1 ? "primitive" : "semantic" } : { value: "#123456" }),
      source: { file: "tokens.json", path: [id], sha256: hash(read("tokens.json")) },
    };
  }
  const source = { path: "source.tsx", sha256: hash(read("source.tsx")) };
  const B = seal({
    contract: "system-aware/0.1",
    root: "parent",
    system: { id: "test", version: "1", tokens },
    components: {
      glyph: { id: "glyph", source, requires: [] },
      parent: {
        id: "parent",
        source,
        requires: [],
        instances: { icon: { component: "glyph", colorToken: "component" } },
      },
    },
  });
  B.components.parent.requires = [{ id: "glyph", revision: B.components.glyph.revision }];
  seal(B);
  const before = {
    tokens: Object.fromEntries(
      Object.entries(tokens).map(([id, token]) => [
        id,
        {
          id,
          ...(token.alias ? { alias: token.alias } : { value: token.value }),
          codeSyntax: { WEB: "var(--" + id + ")" },
        },
      ]),
    ),
    variants: [
      {
        parts: { root: { styles: { fill: "#123456", padding: [0, 0, 0, 0] }, tokens: { fill: "component" } } },
        instances: { icon: { main: "glyph-id", colorToken: "component", vectors: [{ color: "#123456" }] } },
      },
    ],
  };
  const after = structuredClone(before);
  after.tokens.primitive.value = after.variants[0].parts.root.styles.fill = "#abcdef";
  after.variants[0].instances.icon.vectors[0].color = "#abcdef";
  const policy = {
    version: 1,
    system: "test",
    root: dir,
    contractSha256: hash(B),
    nativeBaselineSha256: hash(before),
    tokens: Object.values(tokens).map((token) => ({ id: token.id, file: token.source.file, path: token.source.path })),
    guards: ["tokens.json", "source.tsx"],
    inputs: [],
  };
  return { dir, B, before, after, policy, save, read };
}

export function sessionFixture(t) {
  const f = fixture(t);
  f.B.components.parent.appearance = {
    contract: "0.3",
    component: { name: "Test", slug: "test" },
    axes: [],
    props: [],
    variants: [{ key: "default", axes: {} }],
    parts: {
      root: { kind: "frame", parent: null, order: 0, styles: { layout: { base: { value: "row", token: null } } } },
    },
  };
  seal(f.B);
  f.policy.contractSha256 = hash(f.B);
  const plan = planWriteback(f.B, f.before, f.after, f.policy);
  const state = {
    version: 1,
    root: f.dir,
    profile: {
      system: { id: "test" },
      component: { id: "parent" },
      source: "source.tsx",
      dependencies: {},
      capture: { generated: ["generated.css"] },
      tokens: {},
      figma: { fileKey: "test-file", page: "Test", prefix: "Test" },
    },
    stage: "reviewed",
    native: f.before,
    reviewed: f.after,
    policy: f.policy,
    inputs: [],
    bundle: f.B,
  };
  f.save("generated.css", "original generated");
  f.save("bundle.json", f.B);
  f.save("plan.json", plan);
  f.save("session.json", state);
  f.save("figma.js", "pending program");
  const captureSource = async (_P, _root, out) => {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "source-inputs.json"), "[]");
    const next = structuredClone(f.B);
    next.system.tokens.primitive.value = "#abcdef";
    return seal(next);
  };
  return { ...f, state, plan, captureSource, args: ["apply", "--session", f.dir, "--digest", plan.digest] };
}
