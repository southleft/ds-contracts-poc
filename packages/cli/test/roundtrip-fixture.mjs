import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { hash, canonical } from "../src/roundtrip/surface.mjs";
import { seal } from "../src/roundtrip/model.mjs";

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
  return { B, before, after, policy, save, read };
}
