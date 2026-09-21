import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SourceProfile } from "./check.js";
import {
  reactReferenceCases,
  reactReferenceEntry,
} from "./react-reference-cases.js";
import {
  reactReferenceProfile,
  reactWitnessFiles,
} from "./react-reference-profiles.js";

/** The cohort a reference was built from: which original cases exist, the
 * program that mounts them and the independent witnesses that judge each
 * capture. It is carried by the built reference so that every reader uses the
 * cohort belonging to the bytes it reads; there is no module-level selection.
 * It is never serialized: provenance and evidence name their own fields. */
export interface ReactCohortCase {
  id: string;
  subject: string;
  label: string;
}
export interface ReactCohort {
  declared: boolean;
  source: string;
  theme: string;
  cases: readonly ReactCohortCase[];
  entry: string;
  profile(id: string): SourceProfile;
  witnessFiles: Readonly<Record<string, string>>;
  negativeCaseIds: readonly string[];
  /** Only a declared cohort: its bytes are source and enter the identity. */
  declaration?: { file: string; sha256: string };
  /** Only a declared cohort: the `./`-relative modules its cases mount. The
   * build resolves each to a source file that the witnesses must pin. */
  mountedModules?: readonly string[];
}

/** The cohort this application was first written around. Its entry bytes and
 * case records are frozen: the recorded reference identity and every sealed
 * observation made from it depend on them byte for byte. */
export const builtinReactCohort: ReactCohort = {
  declared: false,
  source: "shadcn source sandbox",
  theme: "Light (sandbox stylesheet)",
  cases: reactReferenceCases,
  entry: reactReferenceEntry,
  profile: reactReferenceProfile,
  witnessFiles: reactWitnessFiles,
  negativeCaseIds: ["button-default", "checkbox-unchecked", "card-composed"],
};

export const reactCasesFile = "ds-contracts.react.json";
const maxBytes = 256 * 1024,
  maxCases = 64,
  maxDepth = 12;
const refuse = (problem: string): never => {
  throw Error("react-cases-" + problem);
};
const caseIdPattern = /^[a-z][a-z-]{0,79}$/;
const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const relativeModule = /^\.\/[A-Za-z0-9_@./-]+$/;
const packageModule =
  /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(?:\/[A-Za-z0-9_.~-]+)*$/;
const refusedTags = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
]);
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ReactCaseElement = (
  | { module: string; export: string }
  | { tag: string }
) & { props?: Record<string, Json>; children?: (string | ReactCaseElement)[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const label = (value: unknown) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 160 &&
  // Single-line display text: no control characters (code points < 32, 127).
  ![...value].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
function keys(value: unknown, allowed: string[], required: string[], problem: string) {
  if (!isRecord(value)) return refuse(problem);
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    refuse(problem);
  return value;
}
const moduleValid = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 200 &&
  !value.split("/").includes("..") &&
  (relativeModule.test(value) || packageModule.test(value));

/** Plain data only. An object literal's `__proto__` key is syntax, not data,
 * so it is refused at every depth rather than trusted to a serializer. */
function plainJson(value: unknown, depth: number): value is Json {
  if (depth > maxDepth) return false;
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => plainJson(v, depth + 1));
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, v]) =>
        !["__proto__", "constructor", "prototype", "dangerouslySetInnerHTML"].includes(key) &&
        plainJson(v, depth + 1),
    )
  );
}
function element(value: unknown, depth: number): ReactCaseElement {
  if (depth > maxDepth) refuse("too-deep");
  if (!isRecord(value)) return refuse("mount-invalid");
  const component = Object.hasOwn(value, "module") || Object.hasOwn(value, "export");
  keys(
    value,
    [...(component ? ["module", "export"] : ["tag"]), "props", "children"],
    component ? ["module", "export"] : ["tag"],
    "mount-invalid",
  );
  if (component) {
    if (!moduleValid(value.module)) refuse("module-invalid");
    if (typeof value.export !== "string" || !identifier.test(value.export) || value.export.length > 80)
      refuse("export-invalid");
  } else if (
    typeof value.tag !== "string" ||
    !/^[a-z][a-z0-9]*$/.test(value.tag) ||
    value.tag.length > 40 ||
    refusedTags.has(value.tag)
  )
    refuse("tag-invalid");
  if (value.props !== undefined) {
    const props = value.props;
    if (
      !isRecord(props) ||
      !plainJson(props, 1) ||
      Object.keys(props).some(
        (key) => key.startsWith("on") || ["ref", "key", "children"].includes(key),
      )
    )
      refuse("props-invalid");
  }
  if (value.children !== undefined && !Array.isArray(value.children))
    refuse("children-invalid");
  const children = ((value.children as unknown[] | undefined) ?? []).map((child) =>
    typeof child === "string" ? child : element(child, depth + 1),
  );
  return {
    ...(component
      ? { module: value.module as string, export: value.export as string }
      : { tag: value.tag as string }),
    ...(value.props === undefined ? {} : { props: value.props as Record<string, Json> }),
    ...(children.length ? { children } : {}),
  };
}
const selectors = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 8 &&
  value.every((s) => typeof s === "string" && s.trim().length > 0 && s.length <= 300);
const strings = (value: unknown, required: boolean): value is Record<string, string> =>
  isRecord(value) &&
  (!required || Object.keys(value).length > 0) &&
  Object.entries(value).every(
    ([key, v]) => key.length > 0 && key.length <= 120 && key !== "__proto__" && typeof v === "string" && v.length <= 400,
  );
type Witness = Omit<SourceProfile, "id" | "provenance" | "requiredTokens" | "fontFamily">;
function witness(value: unknown): Witness {
  const problem = "witness-invalid";
  const w = keys(value, ["path", "fontPath", "fontOrigin", "textContent", "associatedLabelText", "requiredStyles", "probes"], ["path", "requiredStyles"], problem);
  if (!selectors(w.path) || !strings(w.requiredStyles, true)) return refuse(problem);
  if (w.fontPath !== undefined && !selectors(w.fontPath)) refuse(problem);
  if (w.fontOrigin !== undefined && w.fontOrigin !== "web") refuse(problem);
  if (w.associatedLabelText !== undefined && !label(w.associatedLabelText)) refuse(problem);
  if (w.textContent !== undefined && (w.textContent !== "absent" || w.fontPath !== undefined || w.associatedLabelText !== undefined || w.fontOrigin !== undefined)) refuse(problem);
  const probes: NonNullable<SourceProfile["probes"]> = {};
  if (w.probes !== undefined) {
    if (!isRecord(w.probes) || Object.keys(w.probes).length > 16) refuse(problem);
    for (const [name, raw] of Object.entries(w.probes as Record<string, unknown>)) {
      if (!/^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(name)) refuse(problem);
      const probe = keys(raw, ["path", "styles", "properties"], ["path"], problem);
      if (!selectors(probe.path) || (probe.styles !== undefined && !strings(probe.styles, false)))
        refuse(problem);
      if (
        probe.properties !== undefined &&
        (!isRecord(probe.properties) ||
          Object.entries(probe.properties).some(
            ([key, v]) =>
              !identifier.test(key) ||
              !(typeof v === "boolean" || typeof v === "string" || (typeof v === "number" && Number.isFinite(v))),
          ))
      )
        refuse(problem);
      probes[name] = {
        path: probe.path as string[],
        ...(probe.styles ? { styles: probe.styles as Record<string, string> } : {}),
        ...(probe.properties ? { properties: probe.properties as Record<string, string | number | boolean> } : {}),
      };
    }
  }
  return {
    path: w.path,
    ...(w.fontPath ? { fontPath: w.fontPath as string[] } : {}),
    ...(w.fontOrigin === "web" ? { fontOrigin: "web" as const } : {}),
    ...(w.textContent === "absent" ? { textContent: "absent" as const } : {}),
    ...(w.associatedLabelText === undefined ? {} : { associatedLabelText: w.associatedLabelText as string }),
    requiredStyles: w.requiredStyles,
    ...(w.probes === undefined ? {} : { probes }),
  };
}

/** Pinning only files that never change would let a changed component keep
 * its old witnesses. Every mounted workspace module must resolve to a pinned
 * file; resolution is the bundler's, recorded by the build, never guessed. */
export function requireWitnessedModules(cohort: ReactCohort, resolved: ReadonlyMap<string, string>) {
  for (const module of cohort.mountedModules ?? []) {
    const file = resolved.get(module);
    if (!file || !Object.hasOwn(cohort.witnessFiles, file)) refuse("witness-files-incomplete");
  }
}
const components = (node: ReactCaseElement): Array<{ module: string; export: string }> => [
  ...("module" in node ? [{ module: node.module, export: node.export }] : []),
  ...(node.children ?? []).flatMap((child) => (typeof child === "string" ? [] : components(child))),
];
/** Deterministic program text. Every declared string reaches the program only
 * through JSON.stringify, and every component only through a generated alias,
 * so a declaration can select what is mounted but cannot author code. The
 * runtime contract is the built-in entry's: `?case=`, the same refusal for an
 * unknown id, `#root`, and a `React` binding the structure observer extends. */
function reactCasesEntry(
  cases: ReadonlyArray<{ id: string; mount: ReactCaseElement }>,
  sideEffectImports: readonly string[],
) {
  const imported = [
    ...new Map(
      cases.flatMap((c) => components(c.mount)).map((c) => [JSON.stringify([c.module, c.export]), c]),
    ).entries(),
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const alias = new Map(imported.map(([key], i) => [key, "__c" + i]));
  const emit = (node: ReactCaseElement): string =>
    "React.createElement(" +
    [
      "module" in node ? alias.get(JSON.stringify([node.module, node.export]))! : JSON.stringify(node.tag),
      node.props ? JSON.stringify(node.props) : "null",
      ...(node.children ?? []).map((child) => (typeof child === "string" ? JSON.stringify(child) : emit(child))),
    ].join(",") +
    ")";
  return [
    "",
    "import React from 'react';",
    "import {createRoot} from 'react-dom/client';",
    ...imported.map(([key, c]) => `import {${c.export} as ${alias.get(key)}} from ${JSON.stringify(c.module)};`),
    // Stylesheet order is cascade order: declared order is kept, never sorted.
    ...[...new Set(sideEffectImports)].map((m) => `import ${JSON.stringify(m)};`),
    "const selected = new URLSearchParams(location.search).get('case');",
    `const known = ${JSON.stringify(cases.map((c) => c.id))};`,
    "if (!known.includes(selected)) throw Error('Unknown reference case');",
    "const mounts = new Map([",
    ...cases.map((c) => `[${JSON.stringify(c.id)},()=>${emit(c.mount)}],`),
    "]);",
    "createRoot(document.getElementById('root')).render(mounts.get(selected)());",
    "",
  ].join("\n");
}

/** A workspace declares its own cohort; the application is not edited to admit
 * a component family. Witnesses are authored by the workspace owner from the
 * source's own CSS, tokens and font metadata. They are an independent check of
 * the capture and are never sampled from converter output. A changed source
 * requires renewed witnesses. Unknown keys are refused, not ignored. */
export function parseReactCases(bytes: Buffer | string, file = reactCasesFile): ReactCohort {
  const buffer = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  if (buffer.length > maxBytes) refuse("too-large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    refuse("json-invalid");
  }
  if (!isRecord(parsed)) return refuse("shape-invalid");
  if (parsed.version !== 1) refuse("version-unsupported");
  const d = keys(
    parsed,
    ["version", "source", "theme", "fontFamily", "sideEffectImports", "requiredTokens", "witnessFiles", "cases"],
    ["version", "source", "theme", "fontFamily", "requiredTokens", "witnessFiles", "cases"],
    "shape-invalid",
  );
  if (!label(d.source) || !label(d.theme) || !label(d.fontFamily)) refuse("label-invalid");
  const sideEffectImports = d.sideEffectImports ?? [];
  if (!Array.isArray(sideEffectImports) || sideEffectImports.length > 16 || !sideEffectImports.every(moduleValid))
    return refuse("side-effect-import-invalid");
  const requiredTokens = d.requiredTokens;
  if (!strings(requiredTokens, true) || Object.keys(requiredTokens).some((token) => !/^--[A-Za-z0-9_-]+$/.test(token)))
    return refuse("tokens-invalid");
  const witnessFiles = d.witnessFiles;
  if (
    !strings(witnessFiles, true) ||
    Object.entries(witnessFiles).some(
      ([name, hash]) =>
        !/^[A-Za-z0-9_@.][A-Za-z0-9_@./-]*$/.test(name) ||
        name.split("/").some((part) => part === ".." || part === "." || part === "") ||
        // The declaration cannot witness itself; its bytes are identity already.
        name === reactCasesFile ||
        !/^[a-f0-9]{64}$/.test(hash),
    )
  )
    return refuse("witness-files-invalid");
  if (!Array.isArray(d.cases) || !d.cases.length) return refuse("cases-invalid");
  if (d.cases.length > maxCases) refuse("too-large");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const seen = new Set<string>();
  const cases = d.cases.map((raw: unknown) => {
    const c = keys(raw, ["id", "subject", "label", "negativeControl", "mount", "witness"], ["id", "subject", "label", "mount", "witness"], "case-invalid");
    if (typeof c.id !== "string" || !caseIdPattern.test(c.id)) return refuse("id-invalid");
    if (seen.has(c.id)) refuse("id-duplicate");
    seen.add(c.id);
    if (typeof c.subject !== "string" || !identifier.test(c.subject) || c.subject.length > 80) refuse("subject-invalid");
    if (!label(c.label)) refuse("label-invalid");
    if (c.negativeControl !== undefined && typeof c.negativeControl !== "boolean") refuse("negative-control-required");
    const mount = element(c.mount, 1);
    // The structure observer selects the root instance by this export name.
    if (!components(mount).some((m) => m.export === c.subject)) refuse("subject-not-mounted");
    return { id: c.id, subject: c.subject as string, label: c.label as string, negativeControl: c.negativeControl === true, mount, witness: witness(c.witness) };
  });
  // Corruption controls must reject once for every subject: no more, no fewer.
  for (const subject of new Set(cases.map((c) => c.subject)))
    if (cases.filter((c) => c.subject === subject && c.negativeControl).length !== 1)
      refuse("negative-control-required");
  const provenance = `${reactCasesFile} sha256 ${sha256}: witnesses authored by the workspace owner from source CSS, tokens and font metadata`;
  return {
    declared: true,
    source: d.source as string,
    theme: d.theme as string,
    cases: cases.map(({ id, subject, label }) => ({ id, subject, label })),
    entry: reactCasesEntry(cases, sideEffectImports),
    profile(id) {
      const selected = cases.find((c) => c.id === id);
      if (!selected) throw Error("react-reference-case-unknown");
      return structuredClone({ id, provenance, fontFamily: d.fontFamily as string, requiredTokens, ...selected.witness });
    },
    witnessFiles,
    negativeCaseIds: cases.filter((c) => c.negativeControl).map((c) => c.id),
    declaration: { file, sha256 },
    mountedModules: [...new Set(cases.flatMap((c) => components(c.mount)).map((c) => c.module).filter((m) => m.startsWith("./")))].sort(),
  };
}

/** The source root is host-configured. Absence selects the built-in cohort;
 * anything present but unusable is refused by name, never silently skipped. */
export function loadReactCohort(sourceRoot: string): ReactCohort {
  const file = path.join(sourceRoot, reactCasesFile);
  let stat;
  try {
    stat = lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return builtinReactCohort;
    return refuse("unreadable");
  }
  if (!stat.isFile()) refuse("not-regular-file");
  if (stat.size > maxBytes) refuse("too-large");
  return parseReactCases(readFileSync(file), file);
}
