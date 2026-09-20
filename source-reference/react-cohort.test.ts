import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import {
  builtinReactCohort,
  loadReactCohort,
  parseReactCases,
  reactCasesFile,
} from "./react-cohort.js";
import { reactReferenceEntry } from "./react-reference-cases.js";
import {
  reactReferenceProfile,
  reactReferenceProfileFor,
  reactWitnessesMatch,
} from "./react-reference-profiles.js";
import {
  buildReactReference,
  createReactReferenceService,
  reactReferenceHtml,
  reactReferenceUnchanged,
} from "./react-reference.js";
import { buildReactOwnershipReference } from "./react-ownership.js";
import type { ReactSourceProgram } from "./react-source-program.js";
import { inventoryEvidence } from "./react-validation-evidence.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const badgeSource =
  "import React from 'react';export const Badge=(props)=> <span data-slot=\"badge\" {...props}/>;";
const avatarSource =
  "import React from 'react';export const Avatar=(props)=> <span data-slot=\"avatar\" {...props}/>;";
const badge = { module: "./src/components/ui/badge", export: "Badge" };
/** `<!--` then `<script` once put the HTML parser in the double-escaped script
 * state: the real closing tag was swallowed and the page mounted nothing. */
const hostileText = 'A <!-- <script> </script> "quoted"';
const witness = {
  path: ['[data-slot="badge"]'],
  requiredStyles: { display: "inline" },
};
/** A family the application was never written around. */
const declaration = () => ({
  version: 1,
  source: "Fixture family",
  theme: "Fixture light",
  fontFamily: "Inter",
  sideEffectImports: ["./tailwind.css"],
  requiredTokens: { "--original": "red" },
  witnessFiles: { "src/components/ui/badge.tsx": sha(badgeSource), "src/components/ui/avatar.tsx": sha(avatarSource) },
  cases: [
    {
      id: "badge-row",
      subject: "Badge",
      label: "Beside an avatar",
      mount: {
        tag: "div",
        props: { style: { display: "flex", gap: 8 } },
        children: [
          { ...badge, children: [hostileText] },
          { module: "./src/components/ui/avatar", export: "Avatar" },
        ],
      },
      witness,
    },
    {
      id: "badge-default",
      subject: "Badge",
      label: "Default",
      negativeControl: true,
      mount: { ...badge, props: { title: "status" }, children: ["New"] },
      witness: {
        ...witness,
        fontPath: ['[data-slot="badge"]'],
        associatedLabelText: "Status",
        probes: {
          state: {
            path: ['[data-slot="badge"]'],
            styles: { opacity: "1" },
            properties: { hidden: false, title: "status" },
          },
        },
      },
    },
  ],
});
const edited = (change: (d: any) => void) => {
  const d = declaration() as any;
  change(d);
  return JSON.stringify(d);
};

function fixture(withBuiltinSources = false) {
  const root = mkdtempSync(path.join(tmpdir(), "react-cohort-"));
  const put = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  put("package.json", '{"type":"module"}');
  put("package-lock.json", "{}");
  put("tsconfig.json", "{}");
  put("src/index.css", ":root{--original:red}");
  put("capture-input.css", ":root{--original:red}");
  put("tailwind.css", ":root{--original:red}");
  put("src/components/ui/badge.tsx", badgeSource);
  put("src/components/ui/avatar.tsx", avatarSource);
  if (withBuiltinSources) {
    put("src/components/ui/button.tsx", "import React from 'react';export const Button=(props)=> <button {...props}/>;");
    put("src/components/ui/checkbox.tsx", "import React from 'react';export const Checkbox=(props)=> <input type='checkbox' {...props}/>;");
    put("src/components/ui/card.tsx", "import React from 'react';const Part=(props)=><div {...props}/>;export {Part as Card,Part as CardHeader,Part as CardTitle,Part as CardDescription,Part as CardContent,Part as CardFooter};");
    put("node_modules/lucide-react/package.json", '{"main":"index.js"}');
    put("node_modules/lucide-react/index.js", "export const PlusIcon=()=>null;");
    put("node_modules/@fontsource-variable/inter/package.json", '{"main":"index.css"}');
    put("node_modules/@fontsource-variable/inter/index.css", "body{font-family:sans-serif}");
  }
  mkdirSync(path.join(root, "node_modules"), { recursive: true });
  for (const name of ["react", "react-dom", "scheduler"])
    symlinkSync(path.resolve("node_modules", name), path.join(root, "node_modules", name), "dir");
  return { root, put };
}

test("the built-in cohort is frozen: entry bytes, case records and negative controls", () => {
  // The recorded reference identity and every sealed observation made from the
  // built-in cohort depend on these bytes. A deliberate change re-records them.
  assert.equal(sha(reactReferenceEntry), "828b06f236b366090c86cb7b891f499a8d21c4fae5b747c33c60d93b6a7fc25a");
  assert.equal(sha(JSON.stringify(builtinReactCohort.cases)), "b9226e907da968c8f169a4513bbab2a82b020de03ea840ec1c181c900dd0a980");
  assert.equal(builtinReactCohort.entry, reactReferenceEntry);
  assert.equal(builtinReactCohort.declared, false);
  assert.equal(builtinReactCohort.declaration, undefined);
  assert.equal(builtinReactCohort.cases.length, 10);
  assert.deepEqual(builtinReactCohort.negativeCaseIds, ["button-default", "checkbox-unchecked", "card-composed"]);
  // Exactly one control per subject: the same rule a declaration must satisfy.
  for (const subject of new Set(builtinReactCohort.cases.map((c) => c.subject)))
    assert.equal(builtinReactCohort.cases.filter((c) => c.subject === subject && builtinReactCohort.negativeCaseIds.includes(c.id)).length, 1, subject);
  for (const c of builtinReactCohort.cases)
    assert.deepEqual(builtinReactCohort.profile(c.id), reactReferenceProfile(c.id));
});

test("a subject without an authored witness is refused, never given another subject's witness", () => {
  assert.throws(() => reactReferenceProfileFor({ id: "switch-on", subject: "Switch" }), /^Error: react-reference-subject-unwitnessed$/);
  assert.throws(() => reactReferenceProfile("switch-on"), /^Error: react-reference-case-unknown$/);
  assert.throws(() => builtinReactCohort.profile("switch-on"), /^Error: react-reference-case-unknown$/);
  assert.throws(() => parseReactCases(JSON.stringify(declaration())).profile("button-default"), /^Error: react-reference-case-unknown$/);
  assert.equal(reactReferenceProfileFor({ id: "card-content", subject: "Card" }).path[0], '[data-slot="card"]');
});

test("entry generation is deterministic, byte-stable and carries declared strings only as data", () => {
  const cohort = parseReactCases(JSON.stringify(declaration()));
  assert.equal(cohort.entry, [
    "",
    "import React from 'react';",
    "import {createRoot} from 'react-dom/client';",
    'import {Avatar as __c0} from "./src/components/ui/avatar";',
    'import {Badge as __c1} from "./src/components/ui/badge";',
    'import "./tailwind.css";',
    "const selected = new URLSearchParams(location.search).get('case');",
    'const known = ["badge-row","badge-default"];',
    "if (!known.includes(selected)) throw Error('Unknown reference case');",
    "const mounts = new Map([",
    '["badge-row",()=>React.createElement("div",{"style":{"display":"flex","gap":8}},React.createElement(__c1,null,"A <!-- <script> </script> \\"quoted\\""),React.createElement(__c0,null))],',
    '["badge-default",()=>React.createElement(__c1,{"title":"status"},"New")],',
    "]);",
    "createRoot(document.getElementById('root')).render(mounts.get(selected)());",
    "",
  ].join("\n"));
  assert.equal(parseReactCases(JSON.stringify(declaration())).entry, cohort.entry);
  // Whitespace is not program text; a repeated side-effect import is one import.
  assert.equal(parseReactCases(JSON.stringify(declaration(), null, 4)).entry, cohort.entry);
  assert.equal(parseReactCases(edited((d) => d.sideEffectImports.push("./tailwind.css"))).entry, cohort.entry);
  // Stylesheet order is cascade order and is kept as declared.
  assert.match(parseReactCases(edited((d) => (d.sideEffectImports = ["./z.css", "./a.css"]))).entry, /import "\.\/z\.css";\nimport "\.\/a\.css";/);
  assert.deepEqual(cohort.cases, [
    { id: "badge-row", subject: "Badge", label: "Beside an avatar" },
    { id: "badge-default", subject: "Badge", label: "Default" },
  ]);
  assert.deepEqual(cohort.negativeCaseIds, ["badge-default"]);
  assert.equal(cohort.source, "Fixture family");
  assert.equal(cohort.theme, "Fixture light");
  const profile = cohort.profile("badge-default");
  assert.deepEqual({ ...profile, provenance: undefined }, {
    id: "badge-default", provenance: undefined, fontFamily: "Inter", requiredTokens: { "--original": "red" },
    path: ['[data-slot="badge"]'], fontPath: ['[data-slot="badge"]'], associatedLabelText: "Status",
    requiredStyles: { display: "inline" },
    probes: { state: { path: ['[data-slot="badge"]'], styles: { opacity: "1" }, properties: { hidden: false, title: "status" } } },
  });
  assert.match(profile.provenance, new RegExp(`^ds-contracts\\.react\\.json sha256 ${sha(JSON.stringify(declaration()))}: `));
  profile.requiredStyles.display = "none";
  assert.equal(cohort.profile("badge-default").requiredStyles.display, "inline", "a reader cannot alter a witness");
});

test("every unusable declaration is refused by name", () => {
  const nested = (depth: number): unknown => depth ? { tag: "div", children: [nested(depth - 1)] } : { ...badge };
  const deepProps = (depth: number): unknown => depth ? { v: deepProps(depth - 1) } : 1;
  const refusals: Array<[string, (d: any) => void]> = [
    ["version-unsupported", (d) => (d.version = 2)],
    ["version-unsupported", (d) => delete d.version],
    ["shape-invalid", (d) => (d.extra = true)],
    ["shape-invalid", (d) => delete d.witnessFiles],
    ["label-invalid", (d) => (d.source = "")],
    ["label-invalid", (d) => (d.theme = "two\nlines")],
    ["label-invalid", (d) => (d.fontFamily = 7)],
    ["label-invalid", (d) => (d.cases[0].label = " ")],
    ["side-effect-import-invalid", (d) => (d.sideEffectImports = ["../outside.css"])],
    ["side-effect-import-invalid", (d) => (d.sideEffectImports = ["/etc/passwd"])],
    ["side-effect-import-invalid", (d) => (d.sideEffectImports = "./tailwind.css")],
    ["tokens-invalid", (d) => (d.requiredTokens = {})],
    ["tokens-invalid", (d) => (d.requiredTokens = { primary: "red" })],
    ["witness-files-invalid", (d) => (d.witnessFiles = {})],
    ["witness-files-invalid", (d) => (d.witnessFiles = { "../badge.tsx": sha("x") })],
    ["witness-files-invalid", (d) => (d.witnessFiles = { "/abs/badge.tsx": sha("x") })],
    ["witness-files-invalid", (d) => (d.witnessFiles = { "src/badge.tsx": "not-a-hash" })],
    ["witness-files-invalid", (d) => (d.witnessFiles["ds-contracts.react.json"] = sha("self"))],
    ["cases-invalid", (d) => (d.cases = [])],
    ["cases-invalid", (d) => (d.cases = {})],
    ["too-large", (d) => (d.cases = Array.from({ length: 65 }, (_, i) => ({ ...d.cases[1], id: "badge-" + "a".repeat(i + 1) })))],
    ["case-invalid", (d) => (d.cases[0].extra = 1)],
    ["case-invalid", (d) => delete d.cases[0].witness],
    ["id-invalid", (d) => (d.cases[0].id = "Badge_Row")],
    ["id-invalid", (d) => (d.cases[0].id = "badge-2")],
    ["id-invalid", (d) => (d.cases[0].id = "a".repeat(81))],
    ["id-duplicate", (d) => (d.cases[0].id = "badge-default")],
    ["subject-invalid", (d) => (d.cases[0].subject = "Badge Row")],
    ["subject-not-mounted", (d) => (d.cases[0].subject = "Avatar", d.cases[0].mount = { ...badge })],
    ["negative-control-required", (d) => delete d.cases[1].negativeControl],
    ["negative-control-required", (d) => (d.cases[0].negativeControl = true)],
    ["negative-control-required", (d) => (d.cases[1].negativeControl = "yes")],
    ["negative-control-required", (d) => (d.cases[0].subject = "Avatar")],
    ["mount-invalid", (d) => (d.cases[0].mount = "Badge")],
    ["mount-invalid", (d) => (d.cases[0].mount = { ...badge, tag: "div" })],
    ["mount-invalid", (d) => (d.cases[0].mount = { module: badge.module })],
    ["mount-invalid", (d) => (d.cases[0].mount = { ...badge, code: "alert(1)" })],
    ["module-invalid", (d) => (d.cases[0].mount = { ...badge, module: "../../etc/badge" })],
    ["module-invalid", (d) => (d.cases[0].mount = { ...badge, module: "./src/../../badge" })],
    ["module-invalid", (d) => (d.cases[0].mount = { ...badge, module: "/abs/badge" })],
    ["module-invalid", (d) => (d.cases[0].mount = { ...badge, module: 'x";alert(1);"' })],
    ["module-invalid", (d) => (d.cases[0].mount = { ...badge, module: "https://example.com/badge.js" })],
    ["export-invalid", (d) => (d.cases[0].mount = { ...badge, export: "Badge;alert(1)" })],
    ["export-invalid", (d) => (d.cases[0].mount = { ...badge, export: "a b" })],
    ["tag-invalid", (d) => (d.cases[0].mount.tag = "script")],
    ["tag-invalid", (d) => (d.cases[0].mount.tag = "iframe")],
    ["tag-invalid", (d) => (d.cases[0].mount.tag = "my-element")],
    ["tag-invalid", (d) => (d.cases[0].mount.tag = "Div")],
    ["props-invalid", (d) => (d.cases[0].mount.props = { onClick: "alert(1)" })],
    ["props-invalid", (d) => (d.cases[0].mount.props = { dangerouslySetInnerHTML: { __html: "<b>x</b>" } })],
    ["props-invalid", (d) => (d.cases[0].mount.props = { style: { dangerouslySetInnerHTML: 1 } })],
    ["props-invalid", (d) => (d.cases[0].mount.props = { ref: "r" })],
    ["props-invalid", (d) => (d.cases[0].mount.props = { key: "k" })],
    ["props-invalid", (d) => (d.cases[0].mount.props = { children: "x" })],
    ["props-invalid", (d) => (d.cases[0].mount.props = ["a"])],
    ["props-invalid", (d) => (d.cases[0].mount.props = { v: deepProps(12) })],
    ["children-invalid", (d) => (d.cases[0].mount.children = "text")],
    ["mount-invalid", (d) => (d.cases[0].mount.children = [7])],
    ["too-deep", (d) => (d.cases[0].mount = nested(12))],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, path: [] })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, requiredStyles: {} })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, sampledFrom: "converter" })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, fontPath: "x" })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, associatedLabelText: "" })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, probes: { state: {} } })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, probes: { state: { path: ["a"], extra: 1 } } })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, probes: { state: { path: ["a"], properties: { checked: null } } } })],
    ["witness-invalid", (d) => (d.cases[0].witness = { ...witness, probes: { "bad name": { path: ["a"] } } })],
  ];
  for (const [problem, change] of refusals)
    assert.throws(() => parseReactCases(edited(change)), new RegExp(`^Error: react-cases-${problem}$`), problem + ": " + change);
  // Twelve levels are admitted; the thirteenth is refused.
  parseReactCases(edited((d) => (d.cases[0].mount = nested(11))));
  assert.throws(() => parseReactCases("{not json"), /^Error: react-cases-json-invalid$/);
  assert.throws(() => parseReactCases("[]"), /^Error: react-cases-shape-invalid$/);
  assert.throws(() => parseReactCases(" ".repeat(256 * 1024 + 1)), /^Error: react-cases-too-large$/);
  // `__proto__` in an object literal is syntax. It must never reach the program.
  assert.throws(() => parseReactCases(JSON.stringify(declaration()).replace('{"title":"status"}', '{"__proto__":{"polluted":true}}')), /^Error: react-cases-props-invalid$/);
});

test("the declaration is a regular file in the configured root; absence selects the built-in cohort", () => {
  const { root, put } = fixture();
  try {
    assert.equal(loadReactCohort(root), builtinReactCohort);
    put("elsewhere.json", JSON.stringify(declaration()));
    symlinkSync(path.join(root, "elsewhere.json"), path.join(root, reactCasesFile));
    assert.throws(() => loadReactCohort(root), /^Error: react-cases-not-regular-file$/);
    rmSync(path.join(root, reactCasesFile));
    mkdirSync(path.join(root, reactCasesFile));
    assert.throws(() => loadReactCohort(root), /^Error: react-cases-not-regular-file$/);
    rmSync(path.join(root, reactCasesFile), { recursive: true });
    put(reactCasesFile, JSON.stringify(declaration()) + " ".repeat(256 * 1024));
    assert.throws(() => loadReactCohort(root), /^Error: react-cases-too-large$/);
    put(reactCasesFile, JSON.stringify(declaration()));
    const cohort = loadReactCohort(root);
    assert.equal(cohort.declared, true);
    assert.deepEqual(cohort.declaration, { file: path.join(root, reactCasesFile), sha256: sha(JSON.stringify(declaration())) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a declaration's bytes are part of the reference identity; its absence changes nothing", async () => {
  const { root, put } = fixture(true);
  try {
    const builtin = await buildReactReference(root);
    assert.equal(builtin.cohort, builtinReactCohort);
    assert.ok(!Object.keys(builtin.files).some((f) => f.endsWith(reactCasesFile)));
    assert.ok(reactReferenceUnchanged(builtin));
    put(reactCasesFile, JSON.stringify(declaration()));
    assert.equal(reactReferenceUnchanged(builtin), false, "a declaration added after load makes the built-in reference stale");
    const declared = await buildReactReference(root);
    assert.equal(declared.cohort.declared, true);
    assert.ok(reactReferenceUnchanged(declared));
    assert.notEqual(declared.id, builtin.id);
    // The build records real paths, so the entry is found by name.
    assert.equal(Object.entries(declared.files).find(([f]) => f.endsWith("/" + reactCasesFile))?.[1], sha(JSON.stringify(declaration())));
    assert.equal((await buildReactReference(root)).id, declared.id, "deterministic");
    assert.ok(reactWitnessesMatch(declared));
    // Only a witness value changes: the program is identical, the identity is not.
    put(reactCasesFile, edited((d) => (d.cases[0].witness.requiredStyles.display = "inline-flex")));
    assert.equal(reactReferenceUnchanged(declared), false, "an edited declaration invalidates the loaded reference");
    const rewitnessed = await buildReactReference(root);
    assert.equal(rewitnessed.cohort.entry, declared.cohort.entry);
    assert.notEqual(rewitnessed.id, declared.id);
    // A changed source file no longer matches the owner's pinned witness.
    put("src/components/ui/badge.tsx", badgeSource + "\n// changed\n");
    assert.equal(reactWitnessesMatch(await buildReactReference(root)), false);
    // Removing the declaration restores the built-in identity exactly.
    put("src/components/ui/badge.tsx", badgeSource);
    const current = await buildReactReference(root);
    assert.ok(reactReferenceUnchanged(current));
    rmSync(path.join(root, reactCasesFile));
    assert.equal(reactReferenceUnchanged(current), false, "a removed declaration invalidates the reference built from it");
    assert.equal((await buildReactReference(root)).id, builtin.id);
    assert.ok(reactReferenceUnchanged(builtin), "and the built-in reference is current again");
    // Anything at the declaration path stales a built-in reference, usable or not.
    for (const broken of ["{not json", JSON.stringify({ version: 2 })]) {
      put(reactCasesFile, broken);
      assert.equal(reactReferenceUnchanged(builtin), false, broken);
      rmSync(path.join(root, reactCasesFile));
    }
    mkdirSync(path.join(root, reactCasesFile));
    assert.equal(reactReferenceUnchanged(builtin), false, "a directory at the declaration path");
    rmSync(path.join(root, reactCasesFile), { recursive: true });
    symlinkSync(path.join(root, "missing-target.json"), path.join(root, reactCasesFile));
    assert.equal(reactReferenceUnchanged(builtin), false, "a dangling symlink at the declaration path");
    rmSync(path.join(root, reactCasesFile));
    // A declared reference whose file becomes a symlink to identical bytes is stale too.
    put(reactCasesFile, JSON.stringify(declaration()));
    const regular = await buildReactReference(root);
    put("copy.json", JSON.stringify(declaration()));
    rmSync(path.join(root, reactCasesFile));
    symlinkSync(path.join(root, "copy.json"), path.join(root, reactCasesFile));
    assert.equal(reactReferenceUnchanged(regular), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("witnesses must pin the resolved source of every mounted workspace module; a vacuous map is refused", async () => {
  const { root, put } = fixture();
  try {
    // Pinning only a file that never changes would let a changed component keep its witnesses.
    put(reactCasesFile, edited((d) => (d.witnessFiles = { "package.json": sha('{"type":"module"}') })));
    await assert.rejects(buildReactReference(root), /^Error: react-cases-witness-files-incomplete$/);
    // Every mounted module, not just the subject's: Avatar is mounted beside Badge.
    put(reactCasesFile, edited((d) => delete d.witnessFiles["src/components/ui/avatar.tsx"]));
    await assert.rejects(buildReactReference(root), /^Error: react-cases-witness-files-incomplete$/);
    // Resolution is the bundler's: the specifier has no extension, the pinned file does.
    put(reactCasesFile, edited((d) => (d.witnessFiles = { "src/components/ui/badge": sha(badgeSource), "src/components/ui/avatar": sha(avatarSource) })));
    await assert.rejects(buildReactReference(root), /^Error: react-cases-witness-files-incomplete$/);
    put(reactCasesFile, JSON.stringify(declaration()));
    const reference = await buildReactReference(root);
    assert.ok(reactWitnessesMatch(reference));
    assert.deepEqual(reference.cohort.mountedModules, ["./src/components/ui/avatar", "./src/components/ui/badge"]);
    // A changed component source without renewed witnesses: covered, and no longer matching.
    put("src/components/ui/avatar.tsx", avatarSource + "\n// changed\n");
    const changed = await buildReactReference(root);
    assert.notEqual(changed.id, reference.id);
    assert.equal(reactWitnessesMatch(changed), false);
    assert.equal(builtinReactCohort.mountedModules, undefined, "the built-in cohort already pins its component files and is unchanged");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a loaded built-in reference is refused once a declaration appears; operations of another cohort are not offered", async () => {
  const { root, put } = fixture(true);
  const repo = mkdtempSync(path.join(tmpdir(), "react-cohort-repo-"));
  const operation = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
  const moved = [
    { operationId: operation(1), caseId: "button-default", kind: "root", followedReferenceId: "f".repeat(64), fileKey: "k", phase: "component-structure-observed" },
    { operationId: operation(2), caseId: "badge-default", kind: "root", followedReferenceId: "f".repeat(64), fileKey: "k", phase: "component-structure-observed" },
  ];
  const adopted: string[] = [];
  const handle = createReactReferenceService(repo, root, () => ({
    jobs: { listReact: () => [], listReactMoved: () => moved, withReadSnapshot: (read: () => unknown) => read(),
      reactSuccessionSubject: (id: string) => ({ kind: "react-root-draft", caseId: moved.find((m) => m.operationId === id)!.caseId }) },
    transport: {}, successions: { adopt: (id: string) => adopted.push(id) }, updateJobs: { updateHistory: () => [] },
  }) as any);
  const server = createServer((req, res) => void handle(req, res, new URL(req.url!, "http://localhost").pathname.replace("/api/source-reference/", "")));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  try {
    const builtin = await (await fetch(base + "/react", { method: "POST" })).json();
    assert.equal(builtin.source, "shadcn source sandbox");
    assert.deepEqual((await (await fetch(base + `/react/${builtin.id}/native`)).json()).moved.map((m: { caseId: string }) => m.caseId), ["button-default"],
      "the built-in cohort offers its own moved operation and not another cohort's");
    assert.equal((await fetch(base + `/react/${builtin.id}?case=button-default`)).status, 200);
    put(reactCasesFile, "{not json");
    assert.equal((await fetch(base + `/react/${builtin.id}?case=button-default`)).status, 409, "a broken declaration added after load");
    put(reactCasesFile, JSON.stringify(declaration()));
    assert.equal((await fetch(base + `/react/${builtin.id}?case=button-default`)).status, 409, "a usable declaration added after load");
    const declared = await (await fetch(base + "/react", { method: "POST" })).json();
    assert.notEqual(declared.id, builtin.id);
    assert.deepEqual((await (await fetch(base + `/react/${declared.id}/native`)).json()).moved.map((m: { caseId: string }) => m.caseId), ["badge-default"],
      "an operation whose case this cohort does not have cannot follow it and is not offered");
    // The action itself refuses by name; hiding the offer is not the guard.
    const refused = await fetch(base + `/react/${declared.id}/native-operation/${operation(1)}/adopt-source`, { method: "POST" });
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).reason, "react-source-succession-case-not-in-cohort");
    assert.deepEqual(adopted, []);
    put(reactCasesFile, edited((d) => (d.witnessFiles = { "package.json": sha('{"type":"module"}') })));
    const vacuous = await fetch(base + "/react", { method: "POST" });
    assert.equal(vacuous.status, 409);
    assert.equal((await vacuous.json()).reason, "react-cases-witness-files-incomplete");
  } finally {
    handle.close();
    server.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test("same-named cases from another workspace cannot follow the loaded source through the HTTP action", async () => {
  const { root, put } = fixture();
  put(reactCasesFile, JSON.stringify(declaration()));
  const repo = mkdtempSync(path.join(tmpdir(), "react-succession-route-"));
  const current = await buildReactReference(root);
  const sourceFile = Object.keys(current.files).find(file => file.endsWith("/src/components/ui/badge.tsx"))!;
  const archivedPin = (n: number, file: string) => {
    const referenceId = sha(String(n)), id = `10000000-0000-4000-8000-00000000000${n}`;
    const source = { module: "src/components/ui/badge.tsx", exportName: "Badge", sourceSha256: sha(badgeSource), span: { start: 0, end: 10 } };
    const report = { id, referenceId, state: "complete", sourceUnchanged: true, rows: [{ id: "badge-default", matched: true, problems: [],
      ownership: { components: [{ id: "instance-0", source, roots: [""] }], problems: [] } }] };
    const dir = path.join(repo, "private/react-source-ownership", referenceId, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "report.json"), JSON.stringify(report));
    writeFileSync(path.join(dir, "program.json"), JSON.stringify({ version: 1, problems: [], files: { [file]: sha(badgeSource) }, components: [source] }));
    const seal = JSON.stringify({ version: 1, files: inventoryEvidence(dir) });
    writeFileSync(path.join(dir, "integrity.json"), seal);
    return { version: 1, kind: "react-root-draft", referenceId, caseId: "badge-default", ownership: { id, sha256: sha(JSON.stringify(report)) },
      inventorySha256: sha(seal), matrixRevision: "sha256:" + referenceId };
  };
  const pins = [archivedPin(1, sourceFile), archivedPin(2, path.join(repo, "foreign/src/components/ui/badge.tsx")), archivedPin(3, sourceFile)];
  pins[2].inventorySha256 = "0".repeat(64);
  const moved = pins.map(pin => ({ operationId: pin.ownership.id, caseId: pin.caseId, kind: "root", followedReferenceId: pin.referenceId,
    fileKey: "test", phase: "component-structure-observed" }));
  const adopted: string[] = [];
  let stateWrapped = false, unresolved: { pending: boolean; phase: string }[] = [];
  const handle = createReactReferenceService(repo, root, () => ({ jobs: { listReact: () => [], listReactMoved: () => moved,
    withReadSnapshot: (read: () => unknown) => read(), reactSuccessionSubject: (id: string) => {
      const pin = pins.find(pin => pin.ownership.id === id)!;
      return !stateWrapped ? pin : { version: 1, kind: 'react-state-api-draft',
        initial: { version: 1, kind: 'react-initial-draft', anchor: pin, caseId: pin.caseId,
          observation: { id: pin.ownership.id, inventorySha256: pin.inventorySha256, reportSha256: pin.ownership.sha256 } },
        observation: { key: 'a'.repeat(64), id: pin.ownership.id, inventorySha256: 'b'.repeat(64), reportSha256: 'c'.repeat(64) } };
    } },
    transport: {}, successions: { adopt: (id: string) => adopted.push(id) }, updateJobs: { updateHistory: () => unresolved } }) as any);
  const server = createServer((req, res) => void handle(req, res, new URL(req.url!, "http://localhost").pathname.slice(1)));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const loaded = await (await fetch(base + "/react", { method: "POST" })).json();
    const offered = await (await fetch(base + `/react/${loaded.id}/native`)).json();
    assert.deepEqual(offered.moved.map((row: { operationId: string }) => row.operationId), [pins[0].ownership.id, pins[2].ownership.id]);
    assert.equal(offered.moved[0].successionProblem, undefined);
    assert.equal(offered.moved[1].successionProblem, "react-source-succession-identity-unavailable", "unreadable evidence stays visible and disabled");
    for (const [index, reason] of [[1, "react-source-succession-component-mismatch"], [2, "react-source-succession-identity-unavailable"]] as const) {
      const response = await fetch(base + `/react/${loaded.id}/native-operation/${pins[index].ownership.id}/adopt-source`, { method: "POST" });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).reason, reason);
    }
    stateWrapped = true;
    for (const entry of [{ pending: true, phase: 'update-verified' }, { pending: false, phase: 'update-prepared' },
      { pending: false, phase: 'update-written' }]) {
      unresolved = [entry];
      const response = await fetch(base + `/react/${loaded.id}/native-operation/${pins[0].ownership.id}/adopt-source`, { method: 'POST' });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).reason, 'react-source-succession-update-unresolved');
    }
    unresolved = [];
    const missingExperiment = await fetch(base + `/react/${loaded.id}/native-operation/${pins[0].ownership.id}/adopt-source`, { method: 'POST' });
    assert.equal(missingExperiment.status, 409, 'appearance or an older state pin cannot substitute for a fresh complete experiment');
    assert.deepEqual(adopted, [], "refused requests never append a source succession");
  } finally {
    handle.close(); server.close();
    rmSync(root, { recursive: true, force: true }); rmSync(repo, { recursive: true, force: true });
  }
});

test("the application serves a declared family it was never written around, and names a refused declaration", async () => {
  const { root, put } = fixture();
  const repo = mkdtempSync(path.join(tmpdir(), "react-cohort-repo-"));
  put(reactCasesFile, JSON.stringify(declaration()));
  const handle = createReactReferenceService(repo, root);
  const server = createServer((req, res) => void handle(req, res, new URL(req.url!, "http://localhost").pathname.replace("/api/source-reference/", "")));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/source-reference`;
  try {
    const reference = await (await fetch(base + "/react", { method: "POST" })).json();
    assert.equal(reference.source, "Fixture family");
    assert.equal(reference.theme, "Fixture light");
    assert.deepEqual(reference.cases.map((c: { id: string }) => c.id), ["badge-row", "badge-default"]);
    assert.equal((await fetch(base + `/react/${reference.id}?case=badge-default`)).status, 200);
    assert.equal((await fetch(base + `/react/${reference.id}?case=button-default`)).status, 404, "a built-in case is not part of a declared cohort");
    const provenance = JSON.parse(readFileSync(path.join(repo, "private/react-source-references", reference.id, "provenance.json"), "utf8"));
    assert.equal(provenance.entrySha256, sha(parseReactCases(JSON.stringify(declaration())).entry));
    assert.deepEqual(provenance.cases, reference.cases.map(({ id, subject, label }: Record<string, string>) => ({ id, subject, label })));
    put(reactCasesFile, edited((d) => (d.cases[0].mount.tag = "script")));
    assert.equal((await fetch(base + `/react/${reference.id}?case=badge-default`)).status, 409, "the loaded reference no longer matches its declaration");
    const refused = await fetch(base + "/react", { method: "POST" });
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).reason, "react-cases-tag-invalid");
  } finally {
    handle.close();
    server.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test("the generated entry keeps the built-in runtime contract and accepts the structure observer's extension", async (t) => {
  const { root, put } = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(reactCasesFile, JSON.stringify(declaration()));
  const original = await buildReactReference(root);
  const file = Object.keys(original.files).find((f) => f.endsWith("/src/components/ui/badge.tsx"))!;
  const observed = await buildReactOwnershipReference(path.dirname(path.dirname(path.dirname(path.dirname(file)))), original, {
    files: { [file]: original.files[file] }, problems: [],
    components: [{ module: "src/components/ui/badge.tsx", exportName: "Badge", sourceSha256: original.files[file], span: { start: 0, end: 1 } }],
  } as unknown as ReactSourceProgram);
  assert.equal(observed.cohort, original.cohort, "the observed program is built from the original's cohort");
  assert.deepEqual(observed.files, original.files);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const render = async (caseId: string, html: string) => {
    const page = await browser.newPage(), errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => route.request().url().startsWith("http://127.0.0.1/cohort") ? route.fulfill({ status: 200, contentType: "text/html", body: html }) : route.abort());
    await page.goto("http://127.0.0.1/cohort?case=" + caseId);
    return { page, errors };
  };
  const row = await render("badge-row", reactReferenceHtml(observed));
  await row.page.locator('[data-slot="badge"]').waitFor({ timeout: 15000 });
  assert.equal(await row.page.locator('[data-slot="badge"]').textContent(), hostileText, "declared text is data, never markup or code");
  // The extra escaping touches only `<!--`. `<script` stays as written: alone it
  // is inert, and the built-in bundle contains it, so rewriting it would change
  // the bytes of a reference.html that is already saved for that reference.
  const inert = { css: "a{}", javascript: 'const a="<script>";const b="</script>";' };
  assert.equal(reactReferenceHtml(inert), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>a{}</style></head><body style="padding:32px"><div id="root"></div><script>const a="<script>";const b="<\\/script>";</script></body></html>`);
  assert.ok(reactReferenceHtml({ css: "", javascript: 'const c="<!--";' }).includes('const c="\\x3C!--";'));
  assert.ok(!reactReferenceHtml(observed).slice(reactReferenceHtml(observed).indexOf("<script>")).includes("<!--"));
  assert.equal(await row.page.locator('#root > div > [data-slot="avatar"]').count(), 1);
  assert.equal(await row.page.locator("#root > div").evaluate((node) => getComputedStyle(node).gap), "8px");
  assert.deepEqual(await row.page.evaluate(() => {
    const w = window as unknown as { __DSC_REACT_EXPORTS: Array<{ identity: { exportName: string }; value: unknown }>; __DSC_REACT_CLONE_ELEMENT: unknown };
    return { exports: w.__DSC_REACT_EXPORTS.map((e) => [e.identity.exportName, typeof e.value]), clone: typeof w.__DSC_REACT_CLONE_ELEMENT };
  }), { exports: [["Badge", "function"]], clone: "function" });
  assert.deepEqual(row.errors, []);
  const single = await render("badge-default", reactReferenceHtml(original));
  await single.page.locator('[data-slot="badge"][title="status"]').waitFor({ timeout: 15000 });
  assert.equal(await single.page.locator("#root > *").count(), 1);
  const unknown = await render("button-default", reactReferenceHtml(original));
  await unknown.page.waitForTimeout(200);
  assert.deepEqual(unknown.errors, ["Unknown reference case"]);
  assert.equal(await unknown.page.locator("#root > *").count(), 0);
});

test("declared workspaces need no unused sandbox CSS inputs; presence changes invalidate a saved reference", async () => {
  const { root, put } = fixture();
  try {
    put(reactCasesFile, JSON.stringify(declaration()));
    rmSync(path.join(root, "src/index.css"));
    rmSync(path.join(root, "capture-input.css"));
    const first = await buildReactReference(root);
    assert.ok(reactReferenceUnchanged(first));
    assert.ok(first.css.includes("--original"), "the imported stylesheet is still bundled");
    assert.ok(first.files[path.join(first.sourceRoot, "tailwind.css")], "the imported stylesheet is still pinned");
    assert.equal(first.files[path.join(first.sourceRoot, "capture-input.css")], undefined);
    assert.equal((await buildReactReference(root)).id, first.id);
    put("capture-input.css", "/* optional legacy input now exists */");
    assert.equal(reactReferenceUnchanged(first), false);
    const added = await buildReactReference(root);
    assert.notEqual(added.id, first.id);
    assert.equal(added.files[path.join(added.sourceRoot, "capture-input.css")], sha("/* optional legacy input now exists */"));
    rmSync(path.join(root, "capture-input.css"));
    assert.equal(reactReferenceUnchanged(added), false);
    assert.equal((await buildReactReference(root)).id, first.id);
    put("tailwind.css", ":root{--original:blue}");
    assert.equal(reactReferenceUnchanged(first), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("missing built-in inputs and unreadable declared inputs still refuse", async () => {
  const { root, put } = fixture(true);
  try {
    rmSync(path.join(root, "capture-input.css"));
    await assert.rejects(buildReactReference(root), /ENOENT/);
    put(reactCasesFile, JSON.stringify(declaration()));
    symlinkSync(path.join(root, "missing-target.css"), path.join(root, "capture-input.css"));
    await assert.rejects(buildReactReference(root), /ENOENT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
