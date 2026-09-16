/** Bounded dependency resolution for the admitted Altitude runtime recipe.
 * Source symbols and guarded constructor registration establish identity;
 * matching DOM tag names alone never admit a child component. */
import { createHash } from "node:crypto";
import ts from "typescript";
import type { LitTemplateInput } from "../extract/adapters/lit-template.js";
import type { RecordedSourceProgram } from "./source-program.js";
import type {
  SourceBoundAnatomy,
  SourceAnatomyIdentity,
} from "./source-bound-anatomy.js";
import {
  altitudeRuntimeRecipeIdentity,
  type RuntimeInputManifest,
  type VerifiedRuntimeArtifact,
} from "./runtime-artifact.js";
import type { VerifiedCandidatePreparation } from "./candidate-jobs.js";
import { buildStatefulCandidatePreparationReport } from "./stateful-candidate-report.js";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// The legacy helper computes aliases but tolerates foreign registrations. The
// admitted build's constructor-equality guard supplies the missing protection.
const registrationHelper =
  "411318b5d99bb1bd5b9766a2fa9028e808097d068a4aac8e6716d263eb05a261";
function fail(code: string): never {
  throw Error(`source-dependency-${code}`);
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export interface SourceComponentDependency {
  host: SourceAnatomyIdentity;
  domPath: string;
  slotName: string;
  distribution: "fallback";
  member: string;
  source: {
    modulePath: string;
    moduleSha256: string;
    className: string;
    tagName: string;
    text: string;
  };
  runtime: {
    artifactRevision: string;
    registrationTag: string;
    qualification: "guarded-original-constructor";
  };
}
export interface SourceComponentDependenciesInput {
  source: LitTemplateInput;
  program: RecordedSourceProgram;
  expectedProgramSha256: string;
  anatomy: SourceBoundAnatomy;
  artifact: VerifiedRuntimeArtifact;
  /** Bytes already inventoried by both the source graph and runtime build. */
  packageJson: string;
}
export function deriveAltitudeComponentDependencies(
  input: SourceComponentDependenciesInput,
) {
  const out: {
    version: 1;
    status: "dependencies-resolved" | "refused";
    acceptedContract: null;
    dependencies: SourceComponentDependency[];
    problems: string[];
    limitations: string[];
  } = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    dependencies: [],
    problems: [],
    limitations: [
      "Original constructor identity in the guarded packaged runtime only. Original replay registration, child anatomy/styles, causal bindings, native component mapping and acceptance remain separate obligations.",
    ],
  };
  try {
    const { source, program, anatomy, artifact } = input;
    const recipe = altitudeRuntimeRecipeIdentity("checkbox");
    if (
      program.version !== 1 ||
      !["recorded", "partial"].includes(program.status) ||
      program.digest !== input.expectedProgramSha256 ||
      sha(JSON.stringify({ ...program, digest: undefined })) !==
        program.digest ||
      anatomy.version !== 2 ||
      anatomy.status !== "structural-projection" ||
      anatomy.problems.length ||
      anatomy.sourceProgramSha256 !== program.digest ||
      anatomy.sourceSha256 !== source.sourceSha256 ||
      source.sourceSha256 !== sha(source.source) ||
      source.className !== "ALCheckbox" ||
      program.className !== source.className ||
      artifact.manifest.adapter !== "altitude-checkbox-v1" ||
      artifact.manifest.source.revision !== program.revision ||
      artifact.manifest.recipe.version !== recipe.version ||
      artifact.manifest.recipe.sha256 !== recipe.sha256 ||
      !same(artifact.manifest.recipe.conditions, recipe.conditions) ||
      !artifact.manifest.recipe.repeatedBuildIdentical
    )
      fail("input-identity-invalid");
    const entry = program.modules.find((m) => m.path === program.entryPath);
    if (
      !entry ||
      entry.path !== "libs/al-web-components/components/checkbox/checkbox.ts" ||
      entry.text !== source.source ||
      entry.sha256 !== source.sourceSha256
    )
      fail("entry-mismatch");
    const inventoried = (path: string, digest: string) => {
      const files = artifact.manifest.inputs.files.filter(
        (f) => f.path === path,
      );
      if (
        files.length !== 1 ||
        files[0].sha256 !== digest ||
        !artifact.manifest.consumedInputs.includes(path)
      )
        fail("runtime-input-unbound");
    };
    for (const module of program.modules) {
      if (sha(module.text) !== module.sha256) fail("module-changed");
    }
    inventoried(entry.path, entry.sha256);
    const file = ts.createSourceFile(
      entry.path,
      entry.text,
      ts.ScriptTarget.Latest,
      true,
    );
    const classes = file.statements
      .filter(ts.isClassDeclaration)
      .filter((c) => c.name?.text === source.className);
    if (classes.length !== 1) fail("class-ambiguous");
    const cls = classes[0];
    const field = (name: string) => {
      const fields = cls.members
        .filter(ts.isPropertyDeclaration)
        .filter((m) => ts.isIdentifier(m.name) && m.name.text === name);
      if (
        fields.length !== 1 ||
        !fields[0].initializer ||
        fields[0].modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)
      )
        fail("field-unavailable");
      return fields[0].initializer!;
    };
    const imported = (local: string) => {
      const rows = entry.imports.flatMap((i) =>
        i.bindings
          .filter((b) => b.local === local)
          .map((b) => ({ ...i, imported: b.imported })),
      );
      if (rows.length !== 1) fail("import-ambiguous");
      return rows[0];
    };
    const call = (value: ts.Expression, count: number) => {
      if (
        !ts.isCallExpression(value) ||
        value.questionDotToken ||
        value.arguments.length !== count
      )
        fail("call-unsupported");
      return value as ts.CallExpression;
    };
    const access = (value: ts.Expression, name?: string) => {
      if (
        !ts.isPropertyAccessExpression(value) ||
        value.questionDotToken ||
        (name && value.name.text !== name)
      )
        fail("member-unsupported");
      return value as ts.PropertyAccessExpression;
    };
    const identifier = (value: ts.Expression) => {
      if (!ts.isIdentifier(value)) fail("symbol-unsupported");
      return (value as ts.Identifier).text;
    };
    const dependencies: SourceComponentDependency[] = [];
    for (const sample of anatomy.samples)
      for (const host of sample.nestedHosts ?? []) {
        if (sample.distribution !== "fallback")
          fail("consumer-host-unqualified");
        const opening = source.source.slice(
          host.sourceSpan.start,
          host.sourceSpan.end,
        );
        const tagField = /^<\$\{this\.([A-Za-z_$][\w$]*)\}/.exec(opening)?.[1];
        if (!tagField) fail("tag-expression-unsupported");
        const staticCall = call(field(tagField), 1),
          staticImport = imported(identifier(staticCall.expression));
        if (
          staticImport.specifier !== "lit/static-html.js" ||
          staticImport.imported !== "unsafeStatic"
        )
          fail("static-import-unsupported");
        const get = call(staticCall.arguments[0], 1),
          map = access(access(get.expression, "get").expression);
        if (map.expression.kind !== ts.SyntaxKind.ThisKeyword)
          fail("map-owner-unsupported");
        const checkUses = (node: ts.Node): void => {
          if (
            ts.isPropertyAccessExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            if (node.name.text === map.name.text && node !== map)
              fail("registration-map-use-unsupported");
            if (node.name.text === tagField && !ts.isTemplateSpan(node.parent))
              fail("tag-field-use-unsupported");
          }
          if (
            ts.isElementAccessExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ThisKeyword
          )
            fail("computed-host-access-unsupported");
          ts.forEachChild(node, checkUses);
        };
        checkUses(cls);
        const childSymbol = identifier(
          access(get.arguments[0], "el").expression,
        );
        const registration = call(field(map.name.text), 1),
          registrationImport = imported(identifier(registration.expression));
        const helper = program.modules.find(
          (m) => m.path === registrationImport.path,
        );
        if (
          registrationImport.imported !== "default" ||
          !helper ||
          helper.sha256 !== registrationHelper
        )
          fail("registration-helper-unsupported");
        inventoried(helper.path, helper.sha256);
        const options = registration.arguments[0];
        if (
          !ts.isObjectLiteralExpression(options) ||
          options.properties.some(
            (p) => !ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name),
          )
        )
          fail("registration-options-unsupported");
        const values = new Map(
          options.properties.map((p) => {
            const prop = p as ts.PropertyAssignment;
            return [
              (prop.name as ts.Identifier).text,
              prop.initializer,
            ] as const;
          }),
        );
        if (
          values.size !== options.properties.length ||
          values.size !== 2 ||
          !values.has("elements") ||
          !values.has("suffix")
        )
          fail("registration-options-unsupported");
        const elements = values.get("elements")!;
        if (
          !ts.isArrayLiteralExpression(elements) ||
          elements.elements.length !== 1 ||
          !ts.isArrayLiteralExpression(elements.elements[0])
        )
          fail("registration-elements-unsupported");
        const tuple = elements.elements[0].elements;
        if (
          tuple.length !== 2 ||
          identifier(access(tuple[0], "el").expression) !== childSymbol ||
          identifier(tuple[1]) !== childSymbol
        )
          fail("constructor-pair-mismatch");
        // This recipe deliberately fixes the original source's versioned mode.
        // Refuse alternate prefix/suffix logic instead of inferring equivalence.
        const suffix = values.get("suffix")!.getText(file).replace(/\s+/g, "");
        if (
          suffix !==
          "(globalThisasany).alAutoRegistry===true?'':PackageJson.version"
        )
          fail("registration-mode-unsupported");
        const pkgImport = imported("PackageJson");
        const pkg = program.assets.find((a) => a.path === pkgImport.path);
        if (
          pkgImport.imported !== "default" ||
          !pkg ||
          pkg.path !== "libs/al-web-components/package.json" ||
          pkg.sha256 !== sha(input.packageJson)
        )
          fail("package-identity-mismatch");
        inventoried(pkg.path, pkg.sha256);
        const version = JSON.parse(input.packageJson).version;
        if (typeof version !== "string" || !version || version.length > 128)
          fail("package-version-invalid");
        const childImport = imported(childSymbol),
          child = program.modules.find((m) => m.path === childImport.path);
        if (
          !child ||
          child.path !==
            "libs/al-web-components/components/field-note/field-note.ts" ||
          childImport.kind !== "local-code" ||
          childImport.imported !== "ALFieldNote"
        )
          fail("child-import-unsupported");
        inventoried(child.path, child.sha256);
        const childFile = ts.createSourceFile(
          child.path,
          child.text,
          ts.ScriptTarget.Latest,
          true,
        );
        const childClasses = childFile.statements
          .filter(ts.isClassDeclaration)
          .filter(
            (c) =>
              c.name?.text === childImport.imported &&
              c.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
          );
        if (childClasses.length !== 1) fail("child-export-ambiguous");
        const tags = childClasses[0].members
          .filter(ts.isPropertyDeclaration)
          .filter(
            (p) =>
              ts.isIdentifier(p.name) &&
              p.name.text === "el" &&
              p.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword),
          );
        if (
          tags.length !== 1 ||
          !tags[0].initializer ||
          !ts.isStringLiteral(tags[0].initializer)
        )
          fail("child-tag-unavailable");
        const tag = tags[0].initializer.text;
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag))
          fail("child-tag-invalid");
        dependencies.push({
          host: {
            templateId: host.templateId,
            sourceNodeId: host.sourceNodeId,
            sourceSpan: host.sourceSpan,
          },
          domPath: host.domPath,
          slotName: sample.sourceName,
          distribution: "fallback",
          member: tagField,
          source: {
            modulePath: child.path,
            moduleSha256: child.sha256,
            className: childImport.imported,
            tagName: tag,
            text: child.text,
          },
          runtime: {
            artifactRevision: artifact.artifactRevision,
            registrationTag: tag + "-" + version.replace(/[\W_]/g, "-"),
            qualification: "guarded-original-constructor",
          },
        });
      }
    if (!dependencies.length) fail("nested-host-unavailable");
    out.dependencies = dependencies;
    out.status = "dependencies-resolved";
  } catch (error) {
    out.problems.push(
      error instanceof Error &&
        /^source-dependency-[a-z-]+$/.test(error.message)
        ? error.message
        : "source-dependency-input-invalid",
    );
  }
  return out;
}

/** Native-planning input from a host-verified preparation. Re-derive the saved
 * anatomy before resolving dependencies; no caller-supplied child list or path
 * can authorize an import. All original cases, including refusals, survive. */
export function prepareStatefulSourceDependencies(input: {
  preparation: VerifiedCandidatePreparation;
  artifact: VerifiedRuntimeArtifact;
  inputs: RuntimeInputManifest;
  packageJson: string;
}) {
  const { preparation, artifact, inputs, packageJson } = input;
  const report = buildStatefulCandidatePreparationReport(
    preparation.selection,
    artifact,
    inputs,
    { anatomyVersion: 2 },
  );
  if (canonicalJson(report) !== canonicalJson(preparation.report))
    fail("preparation-changed");
  const { evidence } = preparation.selection;
  if (!evidence.sourceProgram) fail("source-program-unavailable");
  const cases = report.anatomy!.cases.map((anatomy) => ({
    id: anatomy.caseId,
    ...deriveAltitudeComponentDependencies({
      source: evidence.source,
      program: evidence.sourceProgram!,
      expectedProgramSha256: evidence.sourceProgramSha256,
      anatomy,
      artifact,
      packageJson,
    }),
  }));
  const dependencies = new Map<string, SourceComponentDependency["source"]>();
  for (const row of cases)
    for (const dependency of row.dependencies) {
      const id = `${dependency.source.modulePath}#${dependency.source.className}`;
      const existing = dependencies.get(id);
      if (
        existing &&
        canonicalJson(existing) !== canonicalJson(dependency.source)
      )
        fail("child-identity-conflict");
      dependencies.set(id, dependency.source);
    }
  return {
    version: 1 as const,
    purpose: "stateful-native-dependency-input" as const,
    acceptedContract: null,
    nativeQualification: "unqualified" as const,
    preparation: { id: preparation.id, reportSha256: preparation.reportSha256 },
    artifactRevision: artifact.artifactRevision,
    sourceProgramSha256: evidence.sourceProgramSha256,
    cases,
    components: [...dependencies].map(([identity, source]) => ({
      identity,
      source,
    })),
    coverage: {
      expected: cases.length,
      resolved: cases.filter((c) => c.status === "dependencies-resolved")
        .length,
    },
    revision: revisionOf(cases),
  };
}
