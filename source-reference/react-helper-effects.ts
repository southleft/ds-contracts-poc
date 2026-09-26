import ts from "typescript";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  modelReactHelperCall,
  modelReactComponentCall,
  type ComponentModelResult,
  type HelperModelResult,
  type HelperPrimitive,
  type HelperRuntimeImport,
  type HelperSourcePoint,
} from "./react-helper-model.mjs";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isSatisfiesExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isTypeAssertionExpression(node)
    ? unwrap(node.expression)
    : node;

export interface ReactHelperCandidate {
  call: { start: number; end: number };
  parameter: { start: number; end: number };
  contentKey: string;
}

/** Finds a possible helper boundary; this is neither an effects proof nor a
 * children-forwarding fact. Only direct first-parameter calls are modeled. */
export function reactHelperCandidates(
  fn: ts.FunctionLikeDeclaration,
  checker: ts.TypeChecker,
): ReactHelperCandidate[] {
  const parameter = fn.parameters[0];
  if (
    !parameter ||
    parameter.initializer ||
    !ts.isIdentifier(parameter.name) ||
    !fn.body ||
    !ts.isBlock(fn.body)
  )
    return [];
  const input = checker.getSymbolAtLocation(parameter.name);
  const candidates: ReactHelperCandidate[] = [];
  for (const statement of fn.body.statements) {
    if (ts.isReturnStatement(statement)) break;
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isObjectBindingPattern(declaration.name) ||
        !declaration.initializer
      )
        continue;
      const call = unwrap(declaration.initializer);
      if (!ts.isCallExpression(call) || !call.arguments.length) continue;
      const argument = unwrap(call.arguments[0]);
      if (
        !ts.isIdentifier(argument) ||
        checker.getSymbolAtLocation(argument) !== input
      )
        continue;
      for (const binding of declaration.name.elements) {
        const key = binding.propertyName ?? binding.name;
        if (
          binding.dotDotDotToken ||
          binding.initializer ||
          !ts.isIdentifier(binding.name) ||
          !(ts.isIdentifier(key) || ts.isStringLiteral(key)) ||
          key.text !== "children"
        )
          continue;
        candidates.push({
          call: { start: call.getStart(), end: call.end },
          parameter: {
            start: parameter.name.getStart(),
            end: parameter.name.end,
          },
          contentKey: key.text,
        });
      }
    }
  }
  return candidates;
}

export interface ReactHelperReference {
  sourceRoot: string;
  files: Readonly<Record<string, string>>;
  /** Captured by the same bundler build, not inferred from declaration paths. */
  runtimeImports?: readonly HelperRuntimeImport[];
}
type ReactEffectEvidence = {
  version: 1;
  acceptedContract: null;
  runtimeVerified: false;
  sourceFiles: Record<string, string>;
  checkerFiles: Record<string, string>;
  callSite?: HelperSourcePoint;
  instrumentation?: {
    helper: HelperSourcePoint;
    metadata: HelperSourcePoint[];
  };
  runtimeRequirements: readonly string[];
};
export type ReactHelperEffects = ReactEffectEvidence & HelperModelResult;

/** A source model for a specified data context. A separate guarded render must
 * establish its runtime requirements before any caller-content admission. */
export function readReactHelperEffects(
  reference: ReactHelperReference,
  module: string,
  candidate: ReactHelperCandidate,
  properties: Readonly<Record<string, unknown>>,
): ReactHelperEffects {
  return readReactEffects(
    "helper",
    reference,
    module,
    candidate,
    properties,
  ) as ReactHelperEffects;
}
export type ReactComponentEffects = Omit<
  ReactEffectEvidence,
  "instrumentation"
> &
  ComponentModelResult;
export function readReactComponentEffects(
  reference: ReactHelperReference,
  module: string,
  candidate: ReactHelperCandidate,
  properties: Readonly<Record<string, unknown>>,
): ReactComponentEffects {
  return readReactEffects(
    "component",
    reference,
    module,
    candidate,
    properties,
  ) as ReactComponentEffects;
}
function readReactEffects(
  scope: "helper" | "component",
  reference: ReactHelperReference,
  module: string,
  candidate: ReactHelperCandidate,
  properties: Readonly<Record<string, unknown>>,
): ReactHelperEffects | ReactComponentEffects {
  const sourceFiles: Record<string, string> = {},
    checkerFiles: Record<string, string> = {};
  const common = {
    version: 1 as const,
    acceptedContract: null,
    runtimeVerified: false as const,
    sourceFiles,
    checkerFiles,
    runtimeRequirements: [
      "original-and-instrumented-render-equivalence",
      "registered-original-transitive-function-and-module-state-identities",
      "registered-original-metadata-identities",
      "registered-React-props-and-unchanged-descriptors",
      "unchanged-native-global-bindings-intrinsic-graph-and-iterators",
      "unchanged-metadata",
      "complete-context-and-result-match",
      "separate-containing-component-content-flow",
      ...(scope === "component"
        ? [
            "registered-original-containing-function-and-all-secondary-parameters",
            "same-invocation-input-helper-call-and-return",
            "observed-returned-JSX-target-props-key-and-opaque-content-identity",
          ]
        : []),
    ],
  };
  let callSite: HelperSourcePoint | undefined;
  try {
    const { program, checker, sf, source, runtimeFiles, requireCurrent } =
      prepareReactEffectProgram(reference, module, sourceFiles, checkerFiles);
    let call: ts.CallExpression | undefined,
      parameter: ts.Identifier | undefined;
    const find = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.getStart() === candidate.call.start &&
        node.end === candidate.call.end
      )
        call = node;
      if (
        ts.isIdentifier(node) &&
        node.getStart() === candidate.parameter.start &&
        node.end === candidate.parameter.end &&
        ts.isParameter(node.parent)
      )
        parameter = node;
      ts.forEachChild(node, find);
    };
    find(sf);
    if (!call || !parameter) throw Error("helper-callsite-unresolved");
    // The selected call must still be one of the containing component's actual
    // direct-parameter content bindings, not a fabricated pair of AST spans.
    const fn = parameter.parent.parent as ts.FunctionLikeDeclaration;
    if (
      !reactHelperCandidates(fn, checker).some(
        (c) =>
          c.call.start === candidate.call.start &&
          c.call.end === candidate.call.end &&
          c.parameter.start === candidate.parameter.start &&
          c.parameter.end === candidate.parameter.end &&
          c.contentKey === candidate.contentKey,
      )
    )
      throw Error("helper-callsite-context-mismatch");
    if (
      Object.getPrototypeOf(properties) !== Object.prototype &&
      Object.getPrototypeOf(properties) !== null
    )
      throw Error("helper-input-not-data");
    const descriptors = Object.getOwnPropertyDescriptors(properties),
      entries: Array<[string, HelperPrimitive]> = [];
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = typeof key === "string" ? descriptors[key] : undefined;
      if (
        typeof key !== "string" ||
        key === "__proto__" ||
        !descriptor ||
        !Object.hasOwn(descriptor, "value")
      )
        throw Error("helper-input-not-data");
      if (key === candidate.contentKey) {
        entries.push([key, undefined]);
        continue;
      }
      const value: unknown = descriptor.value;
      if (
        value !== null &&
        !["string", "number", "boolean", "undefined"].includes(typeof value)
      )
        throw Error("helper-input-domain-unproved");
      if (
        typeof value === "number" &&
        (!Number.isFinite(value) || Object.is(value, -0))
      )
        throw Error("helper-input-number-unmodeled");
      entries.push([key, value as HelperPrimitive]);
    }
    callSite = source(call);
    const modelOptions = {
      program,
      call,
      parameter,
      properties: entries,
      contentKey: candidate.contentKey,
      source,
      runtimeFiles,
      resolution: reference.runtimeImports,
    };
    const result =
      scope === "component"
        ? modelReactComponentCall({ ...modelOptions, component: fn })
        : modelReactHelperCall(modelOptions);
    let instrumentation: ReactHelperEffects["instrumentation"];
    if (scope === "helper" && result.status === "modeled") {
      const helper = result.calls.find(
        (c) =>
          c.site?.file === callSite!.file &&
          c.site.start === callSite!.start &&
          c.site.end === callSite!.end,
      )?.source;
      const declarations = call.arguments.slice(1).map((argument) => {
        const value = unwrap(argument);
        if (!ts.isIdentifier(value)) return undefined;
        let symbol = checker.getSymbolAtLocation(value);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias)
          symbol = checker.getAliasedSymbol(symbol);
        const declaration = symbol?.valueDeclaration;
        return declaration &&
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer
          ? declaration
          : undefined;
      });
      if (helper && declarations.every((d): d is ts.VariableDeclaration => !!d))
        instrumentation = { helper, metadata: declarations.map(source) };
    }
    requireCurrent();
    return {
      ...common,
      callSite,
      ...(instrumentation ? { instrumentation } : {}),
      ...result,
    };
  } catch (error) {
    const reason =
      error instanceof Error && /^helper-[a-z-]+$/.test(error.message)
        ? error.message
        : "helper-model-unavailable";
    return {
      ...common,
      ...(callSite ? { callSite } : {}),
      status: "refused",
      reason,
      steps: 0,
    };
  }
}

/** Shared pinned executable/checker context for the bounded effect models. */
export function prepareReactEffectProgram(
  reference:ReactHelperReference,
  module:string,
  sourceFiles:Record<string,string>,
  checkerFiles:Record<string,string>,
) {
    const root = realpathSync(reference.sourceRoot),
      file = realpathSync(path.resolve(root, module));
    if (
      !file.startsWith(root + path.sep) ||
      !Object.hasOwn(reference.files, file)
    )
      throw Error("helper-source-not-witnessed");
    const requireCurrent = () => {
      for (const [name, hash] of Object.entries(reference.files)) {
        if (realpathSync(name) !== name || sha(readFileSync(name)) !== hash)
          throw Error("helper-reference-changed");
      }
      for (const [name, hash] of Object.entries(checkerFiles))
        if (sha(readFileSync(name)) !== hash)
          throw Error("helper-checker-input-changed");
    };
    requireCurrent();
    const read = (name: string) => {
      try {
        const absolute = realpathSync(name),
          bytes = readFileSync(absolute),
          hash = sha(bytes);
        if (checkerFiles[absolute] && checkerFiles[absolute] !== hash)
          throw Error("helper-checker-input-changed");
        checkerFiles[absolute] = hash;
        return bytes.toString("utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return undefined;
        throw error;
      }
    };
    const config = ts.readConfigFile(path.join(root, "tsconfig.json"), read);
    if (config.error) throw Error("helper-config-unreadable");
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      { ...ts.sys, readFile: read },
      root,
      {
        noEmit: true,
        allowJs: true,
        checkJs: false,
        ...(ts.versionMajorMinor.startsWith("6.")
          ? { ignoreDeprecations: "6.0" }
          : {}),
      },
    );
    if (parsed.errors.length) throw Error("helper-config-invalid");
    const runtimeFiles = Object.keys(reference.files).filter((name) =>
      /\.[cm]?js$/.test(name),
    );
    const host = ts.createCompilerHost(parsed.options);
    host.readFile = read;
    const program = ts.createProgram(
      [file, ...runtimeFiles],
      parsed.options,
      host,
    );
    const checker = program.getTypeChecker();
    const sf = program.getSourceFile(file);
    if (!sf) throw Error("helper-source-unreadable");
    const source = (node: ts.Node): HelperSourcePoint => {
      const text = node.getSourceFile(),
        absolute = realpathSync(text.fileName),
        expected = reference.files[absolute];
      if (
        !expected ||
        sha(text.text) !== expected ||
        sha(readFileSync(absolute)) !== expected
      )
        throw Error("helper-executable-source-not-witnessed");
      sourceFiles[absolute] = expected;
      return {
        file: path.relative(root, absolute),
        sha256: expected,
        start: node.getStart(text),
        end: node.end,
      };
    };
    return {root,file,program,checker,sf,source,runtimeFiles,requireCurrent};
}
