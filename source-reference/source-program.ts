import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface RecordedSourceInput {
  checkout: string;
  revision: string;
  manifestPath: string;
  manifestSha256: string;
  modulePath: string;
  className: string;
  sourceHashes: Record<string, string>;
}
export interface SourceModule {
  path: string;
  sha256: string;
  text: string;
  imports: Array<{
    specifier: string;
    kind: "local-code" | "local-asset" | "external";
    path?: string;
    bindings: Array<{ local: string; imported: string }>;
  }>;
  classes: Array<{
    name: string;
    extends?: string;
    members: Array<{
      name: string;
      kind: string;
      visibility: "public" | "protected" | "private";
      static: boolean;
      span: { start: number; end: number };
      decorators: string[];
    }>;
  }>;
}
export interface RecordedSourceProgram {
  version: 1;
  status: "recorded" | "partial" | "refused";
  revision: string;
  entryPath: string;
  className: string;
  modules: SourceModule[];
  assets: Array<{ path: string; sha256: string }>;
  problems: Array<{ code: string; path?: string; specifier?: string }>;
  digest: string;
  limitations: string[];
}
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const safePath = (value: string) =>
  typeof value === "string" &&
  !!value &&
  !path.posix.isAbsolute(value) &&
  !value.includes("\\") &&
  !/[\0?#]/.test(value) &&
  value.split("/").every((part) => part && part !== "." && part !== "..");
const codeExtension = /\.(?:ts|tsx|js|jsx)$/;
const assetExtension = /\.(?:css|scss|sass|less|svg|json)$/;

/** Read only the recorded local source graph. No require/import/eval, network,
 * compiler emission or source mutation. Hash identity is not package/runtime
 * resolution proof: external modules remain explicit unresolved boundaries. */
export function loadRecordedSourceProgram(
  input: RecordedSourceInput,
): RecordedSourceProgram {
  const result: RecordedSourceProgram = {
    version: 1,
    status: "refused",
    revision: input.revision,
    entryPath: "",
    className: input.className,
    modules: [],
    assets: [],
    problems: [],
    digest: "",
    limitations: [
      "Source bytes are matched to the recorded run. This is not a dependency rebuild, behavioral acceptance or fresh source render.",
      "Local TypeScript/JavaScript import resolution is a bounded source-graph policy, not emulation of arbitrary bundler aliases, transforms or package exports.",
      "External imports retain their literal module identities; their implementation and actual runtime resolution are not authenticated by this reader.",
      "Imported asset bytes are hashed, but their transitive CSS/Sass/URL dependencies are opaque. Runtime resource acquisition and dependency closure are not exhaustively resolved.",
      "Member inventory includes own public/protected/private declarations and their exact source spans. It does not execute getters, lifecycle methods, decorators or controllers.",
    ],
  };
  const problem = (code: string, sourcePath?: string, specifier?: string) =>
    result.problems.push({
      code,
      ...(sourcePath ? { path: sourcePath } : {}),
      ...(specifier ? { specifier } : {}),
    });
  const finish = () => {
    result.modules.sort((a, b) => a.path.localeCompare(b.path));
    result.assets.sort((a, b) => a.path.localeCompare(b.path));
    result.digest = sha(JSON.stringify({ ...result, digest: undefined }));
    return result;
  };
  if (
    typeof input.revision !== "string" ||
    !/^[a-f0-9]{40}$/.test(input.revision) ||
    typeof input.checkout !== "string" ||
    !path.isAbsolute(input.checkout) ||
    typeof input.className !== "string" ||
    !input.className ||
    !safePath(input.manifestPath) ||
    !safePath(input.modulePath) ||
    typeof input.manifestSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.manifestSha256) ||
    !input.sourceHashes ||
    typeof input.sourceHashes !== "object" ||
    Array.isArray(input.sourceHashes)
  ) {
    problem("source-identity-invalid");
    return finish();
  }
  const sourceRoot = path.posix.dirname(input.manifestPath);
  const inside = (value: string) =>
    safePath(value) &&
    (sourceRoot === "." || value.startsWith(sourceRoot + "/"));
  result.entryPath = path.posix.join(sourceRoot, input.modulePath);
  if (!inside(result.entryPath) || !codeExtension.test(result.entryPath)) {
    problem("source-module-path-invalid");
    return finish();
  }
  let totalBytes = 0;
  const checkedRead = (relative: string) => {
    if (!inside(relative)) throw new Error("source-path-outside-library");
    const expected = input.sourceHashes[relative];
    if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected))
      throw new Error("source-file-not-recorded");
    let file = path.resolve(input.checkout);
    if (!lstatSync(file).isDirectory())
      throw new Error("source-checkout-not-directory");
    for (const [index, part] of relative.split("/").entries()) {
      file = path.join(file, part);
      const stat = lstatSync(file);
      if (
        stat.isSymbolicLink() ||
        (index < relative.split("/").length - 1
          ? !stat.isDirectory()
          : !stat.isFile())
      )
        throw new Error("source-symlink-or-kind-refused");
      if (
        index === relative.split("/").length - 1 &&
        stat.size > 4 * 1024 * 1024
      )
        throw new Error("source-file-size-limit");
    }
    const bytes = readFileSync(file);
    totalBytes += bytes.length;
    if (totalBytes > 12 * 1024 * 1024)
      throw new Error("source-graph-size-limit");
    if (sha(bytes) !== expected) throw new Error("source-file-hash-mismatch");
    return { bytes, sha256: expected };
  };
  try {
    const manifest = checkedRead(input.manifestPath);
    if (manifest.sha256 !== input.manifestSha256)
      throw new Error("source-manifest-hash-mismatch");
  } catch {
    problem("source-manifest-unavailable-or-changed", input.manifestPath);
    return finish();
  }
  const queue = [result.entryPath],
    seen = new Set<string>();
  while (queue.length) {
    const modulePath = queue.shift()!;
    if (seen.has(modulePath)) continue;
    seen.add(modulePath);
    if (seen.size > 128) {
      problem("source-module-count-limit");
      break;
    }
    let bytes: Buffer, hash: string;
    try {
      const checked = checkedRead(modulePath);
      bytes = checked.bytes;
      hash = checked.sha256;
    } catch (error) {
      problem(
        error instanceof Error && error.message.startsWith("source-")
          ? error.message
          : "source-file-unavailable",
        modulePath,
      );
      continue;
    }
    if (!codeExtension.test(modulePath)) {
      result.assets.push({ path: modulePath, sha256: hash });
      problem("source-asset-dependencies-unverified", modulePath);
      continue;
    }
    const text = bytes.toString("utf8");
    if (!Buffer.from(text).equals(bytes)) {
      problem("source-encoding-invalid", modulePath);
      continue;
    }
    const file = ts.createSourceFile(
      modulePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      modulePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const diagnostics = (
      file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics;
    if (diagnostics.length) {
      problem("source-syntax-invalid", modulePath);
      continue;
    }
    const module: SourceModule = {
      path: modulePath,
      sha256: hash,
      text,
      imports: [],
      classes: [],
    };
    result.modules.push(module);
    const resolveLocal = (specifier: string) => {
      const base = path.posix.normalize(
        path.posix.join(path.posix.dirname(modulePath), specifier),
      );
      if (!inside(base)) return { problem: "source-import-outside-library" };
      const suffix = path.posix.extname(base);
      let candidates: string[];
      if (codeExtension.test(base))
        candidates = [
          base,
          ...(/\.(?:js|jsx)$/.test(base)
            ? [base.replace(/\.jsx?$/, ".ts"), base.replace(/\.jsx?$/, ".tsx")]
            : []),
        ];
      else if (assetExtension.test(base)) candidates = [base];
      else if (!suffix)
        candidates = [
          base + ".ts",
          base + ".tsx",
          base + ".js",
          base + ".jsx",
          base + "/index.ts",
          base + "/index.tsx",
          base + "/index.js",
        ];
      else return { problem: "source-import-extension-unsupported" };
      const matches = candidates.filter((candidate) =>
        Object.hasOwn(input.sourceHashes, candidate),
      );
      if (matches.length !== 1)
        return {
          problem: matches.length
            ? "source-import-resolution-ambiguous"
            : "source-import-not-recorded",
        };
      return { path: matches[0] };
    };
    for (const statement of file.statements) {
      if (
        ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)
      ) {
        const specifier = statement.moduleSpecifier;
        if (!specifier) continue;
        if (!ts.isStringLiteral(specifier)) {
          problem("source-import-specifier-unsupported", modulePath);
          continue;
        }
        const bindings: SourceModule["imports"][number]["bindings"] = [];
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          if (clause?.name)
            bindings.push({ local: clause.name.text, imported: "default" });
          if (clause?.namedBindings) {
            if (ts.isNamespaceImport(clause.namedBindings))
              bindings.push({
                local: clause.namedBindings.name.text,
                imported: "*",
              });
            else
              for (const element of clause.namedBindings.elements)
                bindings.push({
                  local: element.name.text,
                  imported: element.propertyName?.text ?? element.name.text,
                });
          }
        }
        if (specifier.text.startsWith(".")) {
          const resolved = resolveLocal(specifier.text);
          if (!resolved.path) {
            problem(resolved.problem!, modulePath, specifier.text);
            continue;
          }
          module.imports.push({
            specifier: specifier.text,
            kind: codeExtension.test(resolved.path)
              ? "local-code"
              : "local-asset",
            path: resolved.path,
            bindings,
          });
          queue.push(resolved.path);
        } else {
          module.imports.push({
            specifier: specifier.text,
            kind: "external",
            bindings,
          });
          problem(
            "external-import-resolution-unverified",
            modulePath,
            specifier.text,
          );
        }
      }
      if (ts.isClassDeclaration(statement)) {
        if (!statement.name) {
          problem("anonymous-class-identity-unsupported", modulePath);
          continue;
        }
        const base = statement.heritageClauses?.find(
          (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
        )?.types[0]?.expression;
        module.classes.push({
          name: statement.name.text,
          ...(base ? { extends: base.getText(file) } : {}),
          members: statement.members.map((member) => {
            const modifiers = ts.canHaveModifiers(member)
              ? (ts.getModifiers(member) ?? [])
              : [];
            const visibility =
              modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ||
              (!!member.name && ts.isPrivateIdentifier(member.name))
                ? "private"
                : modifiers.some(
                      (m) => m.kind === ts.SyntaxKind.ProtectedKeyword,
                    )
                  ? "protected"
                  : "public";
            return {
              name: member.name?.getText(file) ?? "(constructor)",
              kind: ts.SyntaxKind[member.kind],
              visibility,
              static: modifiers.some(
                (m) => m.kind === ts.SyntaxKind.StaticKeyword,
              ),
              span: { start: member.getStart(file), end: member.end },
              decorators: (ts.canHaveDecorators(member)
                ? (ts.getDecorators(member) ?? [])
                : []
              ).map((d) => d.expression.getText(file)),
            };
          }),
        });
      }
    }
    const visit = (node: ts.Node) => {
      if (
        ts.isImportEqualsDeclaration(node) ||
        (ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) &&
              node.expression.text === "require") ||
            (ts.isPropertyAccessExpression(node.expression) &&
              node.expression.name.text === "require"))) ||
        (ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ["Worker", "SharedWorker", "URL"].includes(node.expression.text))
      )
        problem("source-dynamic-module-resolution-unsupported", modulePath);
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  const entry = result.modules.find(
    (module) => module.path === result.entryPath,
  );
  if (entry?.classes.filter((c) => c.name === input.className).length !== 1)
    problem("source-class-identity-not-unique", result.entryPath);
  const fatal = result.problems.some(
    (p) =>
      ![
        "external-import-resolution-unverified",
        "source-asset-dependencies-unverified",
      ].includes(p.code),
  );
  result.status = fatal
    ? "refused"
    : result.problems.length
      ? "partial"
      : "recorded";
  return finish();
}
