import ts from "typescript";
import { realpathSync } from "node:fs";

/** A bounded abstract evaluator. Never executes source code or imports its modules.
 * Its result describes a model under explicit runtime preconditions, not a React
 * children fact or native-conversion authority. The host supplies witnessed ASTs.
 */
export function modelReactHelperCall(options) {
  return modelReactCall(options, false);
}

/** Models the complete containing function, not merely the selected helper.
 * The result still needs an authenticated component entry/return observation. */
export function modelReactComponentCall(options) {
  return modelReactCall(options, true);
}
/** Same bounded evaluator for a witnessed compiled factory boundary. The host
 * must authenticate the import/site; recorded values remain model assumptions,
 * never proof of their runtime provenance or permission to inspect an object. */
export function modelReactCompiledCall(options) {
  return modelReactCall(options, true, true);
}
/** Complete original JSX function under actual input assumptions. Imported JSX
 * targets are source bindings only; their runtime values and lookup effects must
 * be established separately. No caller children or selected helper is invented. */
export function modelReactJsxComponent(options) {
  return modelReactCall(options, true, false, true);
}
/** Compiled dependency render with deferred callback values. Callback bodies
 * and module dependencies remain explicit obligations, never executed here. */
export function modelReactTargetRender(options) {
  return modelReactCall(options, true, false, true, true);
}
/** Conditional consumer projection only. Context calls are explicit assumptions;
 * this entry point grants no helper, hook, target lookup or render authority. */
export function modelReactContextConsumer(options) {
  return modelReactCall(options, true, false, true, true, true);
}
/** Source helper path under witnessed closure reads and native hook assumptions.
 * Unknown objects remain opaque; this is not a native or provider-effects gate. */
export function modelReactContextHelper(options) {
  return modelReactCall(options,false,false,false,false,false,true);
}
function modelReactCall(options, componentMode, compiledMode = false, jsxMode = false, targetMode = false, contextMode = false, helperMode = false) {
  const {
    program,
    call,
    parameter,
    properties,
    contentKey,
    source,
    runtimeFiles = [],
    resolution = [],
  } = options;
  const checker = program.getTypeChecker();
  const unwrap = (e) =>
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isTypeAssertionExpression(e)
      ? unwrap(e.expression)
      : e;
  const symbol = (n) =>
    ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n
      ? checker.getShorthandAssignmentValueSymbol(n.parent)
      : checker.getSymbolAtLocation(n);
  const unalias = (s) =>
    s?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
  const keyName = (n) =>
    ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)
      ? n.text
      : undefined;
  const opaque = { kind: "opaque", label: "caller-content" };
  const opaqueArguments = { kind: "opaque-call-arguments" };
  const component = options.component;
  const decisions = [];
  const jsxTargets = [], targetFactories = [], returnedCallbacks = [];
  const contextCalls = [], callbackCalls = [], refCalls = [], effectCalls = [], factoryCalls = [], hookCalls = [], contextObjects = new Map(), targetReads = [], mutableBindings = [], contextFunctionCalls = [];
  let describingDeferred = false;
  function decision(node, kind, taken) {
    if (componentMode || helperMode) decisions.push({ source: source(node), kind, taken });
  }
  class Refused extends Error {
    constructor(reason, node) {
      super(reason);
      this.reason = reason;
      this.node = node;
    }
  }
  const isBox = (v) => !!v && typeof v === "object";
  const isHeap = (v) =>
    isBox(v) && ["record", "array", "function", "set"].includes(v.kind);
  class Scope {
    constructor(parent = null) {
      this.parent = parent;
      this.cells = new Map();
      this.special = new Map();
      this.closed = false;
    }
    lookup(s) {
      for (let scope = this; scope; scope = scope.parent)
        if (scope.cells.has(s)) return scope.cells.get(s);
    }
    own(s, value) {
      const c = { value, owner: this };
      this.cells.set(s, c);
      return c;
    }
    specialValue(name) {
      for (let scope = this; scope; scope = scope.parent)
        if (scope.special.has(name)) return scope.special.get(name);
      return MISSING;
    }
  }
  const MISSING = Symbol("missing");
  class Evaluator {
    constructor() {
      this.steps = 0;
      this.nextId = 0;
      this.modules = new Map();
      this.globals = new Map();
      this.reading = new Set();
      this.calls = [];
      this.writes = [];
      this.intrinsics = new Set();
      this.sourceDefinitions = new Map();
      this.loadingModules = new Set();
      this.commonjsFiles = new Set();
      this.iterating = new Set();
      this.bindingReads = new Map();
      this.functionValues = [];
      this.closureCursor = 0;
      this.helperHooks=[];this.helperReturnSource=null;
      this.compiledFactoryReached = false;
      this.effectCursor = 0;
      this.nativeEffects = [];
      this.initializationDepth = 0;
    }
    tick(n) {
      if (++this.steps > 100000) throw new Refused("step-budget", n);
    }
    record(entries = [], origin = "local", kind = "record") {
      return { kind, id: ++this.nextId, origin, fields: new Map(entries) };
    }
    array(items = [], origin = "local") {
      return {
        ...this.record(
          items.map((v, i) => [String(i), v]),
          origin,
          "array",
        ),
        length: items.length,
      };
    }
    builtin(name) {
      this.intrinsics.add(name);
      return { kind: "builtin", name };
    }
    inspect(v, n) {
      if (v?.kind === 'opaque-ref-reference') throw new Refused('ref-reference-inspected',n);
      if (v?.kind === 'opaque-hook-reference') throw new Refused('hook-reference-inspected', n);
      if (v?.kind === 'opaque-factory-reference') throw new Refused('factory-reference-inspected', n);
      if (v?.kind === 'opaque-callback-reference') throw new Refused('callback-reference-inspected', n);
      if (helperMode && v?.kind === 'native-context') throw new Refused('context-helper-context-inspected',n);
      if (helperMode && v?.kind === 'helper-argument') throw new Refused('context-helper-argument-inspected',n);
      if (v?.kind === "opaque-context-field")
        throw new Refused("opaque-context-field-inspected:" + v.key, n);
      if (v?.kind === "opaque-callback-input")
        throw new Refused("opaque-callback-input-inspected:" + v.key, n);
      if (v?.kind === "opaque-property")
        throw new Refused("opaque-input-inspected:" + v.key, n);
      if (v?.kind === "opaque-closure")
        throw new Refused("opaque-closure-inspected:" + v.name, n);
      if (v === opaque) throw new Refused("opaque-content-inspected", n);
      if (v?.kind === "opaque-parameter")
        throw new Refused("opaque-parameter-inspected", n);
      if (v === opaqueArguments)
        throw new Refused("component-arguments-unmodeled", n);
      if (v?.kind === "jsx") throw new Refused("jsx-value-inspected", n);
      return v;
    }
    scalar(v, n) {
      this.inspect(v, n);
      if (isBox(v)) throw new Refused("object-coercion-unproved", n);
      return v;
    }
    truth(v, n) {
      if(helperMode&&v?.kind==='native-context')return true;
      this.inspect(v, n);
      return isHeap(v) || v?.kind === "builtin" ? true : !!v;
    }
    keys(v, n) {
      this.inspect(v, n);
      if (!isHeap(v)) throw new Refused("own-keys-nondata", n);
      const keys = [...v.fields.keys()],
        index = (k) =>
          String(Number(k)) === k &&
          Number.isInteger(Number(k)) &&
          Number(k) >= 0 &&
          Number(k) < 4294967295;
      return [
        ...keys.filter(index).sort((a, b) => Number(a) - Number(b)),
        ...keys.filter((k) => !index(k)),
      ];
    }
    get(v, k, n) {
      if (compiledMode && v?.kind === "opaque-closure" && k === "for" && n &&
          ts.isCallExpression(n.parent) && n.parent.expression === n) {
        const effect = this.nativeEffect(n.parent, "member-call");
        if (effect.kind !== "symbol-for") throw new Refused("compiled-native-member-unmodeled", n);
        return {kind:"guarded-symbol-for",effect,site:n.parent};
      }
      this.inspect(v, n);
      k = this.scalar(k, n);
      k = String(k);
      if (v === null || v === undefined)
        throw new Refused("null-property-read", n);
      if (isHeap(v)) {
        if (v.fields.has(k)) return v.fields.get(k);
        if (v.kind === "array" && k === "length") return v.length;
        if (
          v.kind === "array" &&
          ["includes", "push", "join", "some", "map"].includes(k)
        )
          return this.builtin("Array.prototype." + k);
        if (v.kind === "set" && k === "has")
          return this.builtin("Set.prototype.has");
        if (v.kind === "function" && ["apply", "call"].includes(k))
          return this.builtin("Function.prototype." + k);
        if (k === "hasOwnProperty")
          return this.builtin("Object.prototype.hasOwnProperty");
        if (k === "toString" && v.kind === "record")
          return this.builtin("Object.prototype.toString");
        if (
          v.kind !== "record" ||
          [
            "constructor",
            "__proto__",
            "valueOf",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "toLocaleString",
            "__defineGetter__",
            "__defineSetter__",
            "__lookupGetter__",
            "__lookupSetter__",
          ].includes(k)
        )
          throw new Refused("inherited-property-unmodeled:" + k, n);
        return undefined;
      }
      if (v?.kind === "builtin") {
        if (
          v.name === "Object" &&
          ["assign", "keys", "fromEntries", "prototype"].includes(k)
        )
          return this.builtin(v.name + "." + k);
        if (
          v.name === "Object.prototype" &&
          ["hasOwnProperty", "toString"].includes(k)
        )
          return this.builtin(v.name + "." + k);
        if (v.name === "Array" && k === "isArray")
          return this.builtin(v.name + "." + k);
        if (["apply", "call"].includes(k))
          return this.builtin("Function.prototype." + k);
        throw new Refused("intrinsic-property-unmodeled", n);
      }
      if (typeof v === "string") {
        if (k === "length") return v.length;
        if (["startsWith", "substring", "includes"].includes(k))
          return this.builtin("String.prototype." + k);
        if (/^\d+$/.test(k)) return v[Number(k)];
      }
      throw new Refused("property-unmodeled:" + k, n);
    }
    put(v, k, value, n, remove = false) {
      this.inspect(v, n);
      if (!isHeap(v)) throw new Refused("write-target-not-owned-data", n);
      if (["module-state", "input-props", "input-data", "context-value"].includes(v.origin))
        throw new Refused("external-data-write", n);
      k = String(this.scalar(k, n));
      if (["__proto__", "prototype"].includes(k))
        throw new Refused("prototype-write", n);
      if (v.kind === "array" && (k === "length" || remove))
        throw new Refused("array-shape-write-unmodeled", n);
      if (
        v.kind === "function" &&
        ["name", "length", "arguments", "caller"].includes(k)
      )
        throw new Refused("function-property-write-unmodeled", n);
      if (this.iterating.has(v))
        throw new Refused("iteration-receiver-write-unmodeled", n);
      if (v.kind === "set")
        throw new Refused("set-property-write-unmodeled", n);
      const index =
        String(Number(k)) === k &&
        Number.isInteger(Number(k)) &&
        Number(k) >= 0 &&
        Number(k) < 4294967295;
      if (v.kind === "array" && index && Number(k) > v.length)
        throw new Refused("array-sparse-write-unmodeled", n);
      this.writes.push({
        target: v.id,
        origin: v.origin,
        key: k,
        operation: remove ? "delete" : "set",
        source: n ? source(n) : null,
      });
      if (remove) v.fields.delete(k);
      else {
        v.fields.set(k, value);
        if (v.kind === "array" && index)
          v.length = Math.max(v.length, Number(k) + 1);
      }
      return value;
    }
    items(v, n) {
      if (v?.kind !== "array") throw new Refused("nonliteral-iterator", n);
      return Array.from({ length: v.length }, (_, i) =>
        v.fields.get(String(i)),
      );
    }
    moduleScope(sf) {
      let env = this.modules.get(sf.fileName);
      if (!env) {
        env = new Scope();
        env.closed = true;
        this.modules.set(sf.fileName, env);
      }
      return env;
    }
    fn(n, env) {
      if (
        n.asteriskToken ||
        n.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
      )
        throw new Refused("function-kind-unmodeled", n);
      const vars = new Set();
      const collect = (node) => {
        if (ts.isFunctionLike(node)) return;
        if (
          ts.isVariableDeclaration(node) &&
          !(node.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))
        ) {
          if (!ts.isIdentifier(node.name))
            throw new Refused("var-pattern-unmodeled", node);
          const key = symbol(node.name);
          if (vars.has(key))
            throw new Refused("var-redeclaration-unmodeled", node);
          vars.add(key);
        }
        ts.forEachChild(node, collect);
      };
      if (n.body) collect(n.body);
      const f = {
        ...this.record([], "source-function", "function"),
        node: n,
        env,
      };
      this.sourceDefinitions.set(n, source(n));
      this.functionValues.push(f);
      return f;
    }
    bindingRead(n, decl, value) {
      if (!decl || !decl.name || !ts.isIdentifier(decl.name))
        throw new Refused("runtime-binding-declaration-unmodeled", n);
      const binding = source(decl),
        site = source(n);
      const key = JSON.stringify(binding);
      const old = this.bindingReads.get(key);
      if (old && old.value !== value)
        throw new Refused("runtime-binding-value-varies", n);
      const entry = old ?? {
        binding,
        declarationKind: ts.SyntaxKind[decl.kind],
        name: decl.name.text,
        value,
        reads: [],
      };
      if (
        !entry.reads.some((r) => r.file === site.file && r.start === site.start)
      )
        entry.reads.push(site);
      this.bindingReads.set(key, entry);
      return value;
    }
    identifier(n, env) {
      const captured = this.closureRead(n, "value");
      if (captured !== MISSING) return captured;
      const s = symbol(n),
        cell = env.lookup(s);
      if (cell)
        return cell.owner.closed
          ? this.bindingRead(n, unalias(s)?.valueDeclaration, cell.value)
          : cell.value;
      if (compiledMode || helperMode)
        throw new Refused("compiled-binding-unobserved:" + n.text, n);
      const raw = s,
        decl = unalias(s)?.valueDeclaration;
      if (
        n.text === "arguments" &&
        (!decl || decl.getSourceFile().isDeclarationFile)
      ) {
        const a = env.specialValue("arguments");
        if (a !== MISSING) return a;
      }
      if (
        n.text === "module" &&
        this.commonjsFiles.has(n.getSourceFile().fileName)
      ) {
        const m = env.specialValue("module");
        if (m !== MISSING) return m;
      }
      if (
        n.text === "undefined" &&
        (!decl || decl.getSourceFile().isDeclarationFile)
      )
        return undefined;
      if (
        ["Object", "Array", "Set"].includes(n.text) &&
        s?.declarations?.every((d) =>
          program.isSourceFileDefaultLibrary(d.getSourceFile()),
        )
      )
        return this.builtin(n.text);
      const imported = raw?.declarations?.find(
        (d) => ts.isImportClause(d) || ts.isImportSpecifier(d),
      );
      if (imported && (!decl || decl.getSourceFile().isDeclarationFile)) {
        let imp = imported;
        while (imp && !ts.isImportDeclaration(imp)) imp = imp.parent;
        if (!imp || !ts.isStringLiteral(imp.moduleSpecifier))
          throw new Refused("import-origin-unresolved", n);
        const edge = resolution.find(
          (r) =>
            r.importer === realpathSync(imp.getSourceFile().fileName) &&
            r.specifier === imp.moduleSpecifier.text,
        );
        if (!edge || !runtimeFiles.includes(edge.file))
          throw new Refused("executable-import-unresolved", n);
        if (!ts.isImportClause(imported) || !imported.name)
          throw new Refused("runtime-named-import-unmodeled", n);
        return this.bindingRead(n, imported, this.cjs(edge.file, n));
      }
      if (!decl || decl.getSourceFile().isDeclarationFile)
        throw new Refused("binding-without-source:" + n.text, n);
      source(decl);
      const global = this.moduleScope(decl.getSourceFile()),
        old = global.lookup(unalias(s));
      if (old) return this.bindingRead(n, decl, old.value);
      if (ts.isFunctionDeclaration(decl) && ts.isSourceFile(decl.parent)) {
        const f = this.fn(decl, global);
        this.sealModule(f);
        global.own(unalias(s), f);
        return this.bindingRead(n, decl, f);
      }
      // An initialized module var is not a constant. In this separate model,
      // only a literal initializer may supply a conditional value, with an
      // explicit same-value-at-every-read obligation in runtimeBindings.
      if (contextMode && ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) &&
          decl.initializer && !(decl.parent.flags & ts.NodeFlags.Const) &&
          ts.isSourceFile(decl.parent.parent.parent)) {
        const init = unwrap(decl.initializer);
        if (ts.isStringLiteral(init) || ts.isNumericLiteral(init) ||
            [ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(init.kind)) {
          const value = this.expr(init, global);
          global.own(unalias(s), value);
          mutableBindings.push({binding:source(decl),value:shape(value)});
          return this.bindingRead(n, decl, value);
        }
      }
      if (
        ts.isVariableDeclaration(decl) &&
        decl.initializer &&
        ts.isIdentifier(decl.name) &&
        decl.parent.flags & ts.NodeFlags.Const &&
        ts.isSourceFile(decl.parent.parent.parent)
      ) {
        if (this.reading.has(decl)) throw new Refused("cyclic-initializer", n);
        this.reading.add(decl);
        let v;
        this.initializationDepth++;
        try { v = this.expr(decl.initializer, global); }
        finally { this.initializationDepth--; }
        this.reading.delete(decl);
        this.sealModule(v);
        global.own(unalias(s), v);
        return this.bindingRead(n, decl, v);
      }
      throw new Refused("unbound-or-mutable-source-binding:" + n.text, n);
    }
    closureRead(n, kind) {
      if (!compiledMode && !helperMode) return MISSING;
      const point = source(n);
      const index = options.closureSites.findIndex(s => s.kind === kind &&
        s.span.start === point.start && s.span.end === point.end);
      if (index < 0) return MISSING;
      const read = options.closureReads[this.closureCursor];
      if (!read || read.read !== index)
        throw new Refused("compiled-closure-read-order-mismatch", n);
      const cursor = this.closureCursor++;
      const value = read.value;
      if(helperMode&&value&&typeof value==='object'&&'nativeContext' in value)return {kind:'native-context',context:value.nativeContext};
      return value && typeof value === "object" && typeof value.opaque === "string"
        ? {kind:"opaque-closure", name:options.closureSites[index].name, read:cursor, observedKind:value.opaque}
        : value;
    }
    helperContextCall(n,env){
      const p=source(n),same=q=>q.file===p.file&&q.sha256===p.sha256&&q.start===p.start&&q.end===p.end;
      if(!options.nativeCalls.some(c=>same(c.site)))return MISSING;
      if(n.questionDotToken||n.arguments.length!==1||n.arguments.some(ts.isSpreadElement))throw new Refused('context-helper-native-call-unmodeled',n);
      const callee=unwrap(n.expression);
      const receiver=ts.isIdentifier(callee)?this.expr(callee,env):ts.isPropertyAccessExpression(callee)&&!callee.questionDotToken&&ts.isIdentifier(callee.expression)&&callee.name.text==='useContext'?this.expr(callee.expression,env):null;
      if(receiver?.kind!=='opaque-closure'||receiver.observedKind!==(ts.isIdentifier(callee)?'function':'object'))throw new Refused('context-helper-native-binding-unobserved',n);
      const context=this.expr(n.arguments[0],env),assumed=options.nativeCalls[this.helperHooks.length];
      if(!assumed||!same(assumed.site)||context?.kind!=='native-context'||context.context!==assumed.context)throw new Refused('context-helper-native-context-mismatch',n);
      if((assumed.receiver==='bare')!==ts.isIdentifier(callee))throw new Refused('context-helper-native-receiver-mismatch',n);
      this.helperHooks.push({site:p,context:assumed.context});
      const value=assumed.value;
      if(value&&typeof value==='object'&&'contextValue' in value){
        let result=contextObjects.get(value.contextValue);
        if(!result){
          result=this.record(value.fields.map(([key,v])=>[key,isBox(v)?{kind:'opaque-context-field',value:value.contextValue,key}:v]),'context-value');
          result.contextId=value.contextValue;result.assumptions=value.fields;contextObjects.set(value.contextValue,result);
        }else if(result.assumptions.length!==value.fields.length||result.assumptions.some(([k,v],i)=>{const [key,item]=value.fields[i];return k!==key||(isBox(v)?!isBox(item)||v.opaque!==item.opaque:!Object.is(v,item));}))throw new Refused('context-helper-value-changed',n);
        return result;
      }
      return value;
    }
    nativeEffect(n, kind) {
      const effect = options.effects[this.effectCursor],point = source(n);
      const operation = effect && options.operations[effect.operation];
      if (!operation || operation.kind !== kind || operation.span.start !== point.start || operation.span.end !== point.end)
        throw new Refused("compiled-native-operation-order-mismatch", n);
      this.effectCursor++;
      if (effect.status !== "verified") throw new Refused("compiled-native-effect-unproved:" + effect.reason, n);
      return effect;
    }
    targetJsx(n, env) {
      const factory = options.factory(n);
      if (!factory) return MISSING;
      if (n.questionDotToken || n.arguments.length < 2 || n.arguments.length > 3 || n.arguments.some(ts.isSpreadElement))
        throw new Refused("target-factory-call-unmodeled", n);
      let tag = options.target(n.arguments[0]);
      if (!tag) {
        const value = this.scalar(this.expr(n.arguments[0], env), n.arguments[0]);
        if (typeof value !== "string" || !value) throw new Refused("target-element-type-unmodeled", n.arguments[0]);
        tag = {kind:"host",name:value};
      }
      if (tag.kind === "source-binding") jsxTargets.push({site:source(n),read:source(n.arguments[0]),binding:tag.source});
      if (contextMode && tag.kind === "source-read") targetReads.push({site:source(n),read:tag.source});
      const given = this.expr(n.arguments[1], env);
      if (given?.kind !== "record") throw new Refused("target-props-not-data", n);
      let key = null;
      if (n.arguments[2]) {
        const value = this.scalar(this.expr(n.arguments[2], env), n.arguments[2]);
        if (value !== undefined) key = String(value);
      }
      const props = this.record(this.keys(given,n).map(k=>[k,this.get(given,k,n)]));
      if (props.fields.has("key")) {
        const value = this.scalar(props.fields.get("key"),n);
        if (value !== undefined) key = String(value);
        props.fields.delete("key");
      }
      targetFactories.push({source:source(n),factory});
      return {kind:"jsx",tag,props,key,source:source(n)};
    }
    contextCall(n, env) {
      const point = source(n), same = p => p.file === point.file && p.sha256 === point.sha256 && p.start === point.start && p.end === point.end;
      if (!options.contextCalls.some(c => same(c.site))) return MISSING;
      const assumed = options.contextCalls[contextCalls.length], callee = unwrap(n.expression);
      if (!assumed || !same(assumed.site)) throw new Refused("context-model-call-order-mismatch", n);
      if (!ts.isIdentifier(callee) || callee.text === "eval" || n.questionDotToken || n.arguments.some(ts.isSpreadElement))
        throw new Refused("context-model-call-unmodeled", n);
      const entry = {site:point,arguments:[],value:assumed.value.id};contextCalls.push(entry);
      // The witnessed original callee is an explicit precondition. Evaluate
      // every original argument; never replace an argument expression by its
      // recorded value or execute the helper to obtain a result.
      const args = n.arguments.map(a => this.scalar(this.expr(a, env), a));
      if (args.length !== assumed.arguments.length || args.some((v,i) => !Object.is(v,assumed.arguments[i])))
        throw new Refused("context-model-arguments-mismatch", n);
      let value = contextObjects.get(assumed.value.id);
      if (value) {
        const fields = value.assumptions;
        if (fields.length !== assumed.value.fields.length || fields.some(([k,v],i) => {
          const [key,item] = assumed.value.fields[i];
          return k !== key || (isBox(v) ? !isBox(item) || v.opaque !== item.opaque : !Object.is(v,item));
        })) throw new Refused("context-model-value-changed", n);
      } else {
        value = this.record(assumed.value.fields.map(([key,v]) => [key,
          isBox(v) ? {kind:"opaque-context-field",value:assumed.value.id,key} : v]),"context-value");
        value.contextId = assumed.value.id;value.assumptions = assumed.value.fields;
        contextObjects.set(assumed.value.id,value);
      }
      entry.arguments = args.map(v=>shape(v));
      return value;
    }
    hookCall(n,env) {
      const point=source(n),same=(a,b)=>a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;
      if(!(options.hookCalls??[]).some(c=>same(c.site,point)))return MISSING;
      const assumed=options.hookCalls[hookCalls.length];
      if(!assumed||!same(assumed.site,point)||assumed.consumerCallsBefore!==contextCalls.length+callbackCalls.length+contextFunctionCalls.length+factoryCalls.length+hookCalls.length)throw new Refused('hook-model-call-order',n);
      if(n.questionDotToken||!ts.isIdentifier(unwrap(n.expression))||n.arguments.some(ts.isSpreadElement))throw new Refused('hook-model-call-unmodeled',n);
      const counts=[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length];
      const arguments_=n.arguments.map(arg=>shape(this.expr(arg,env)));
      if(counts.some((v,i)=>v!==[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length][i]))throw new Refused('hook-model-argument-calls-unmodeled',n);
      hookCalls.push({...assumed,arguments:arguments_});return assumed.value?.opaque===true?{kind:'opaque-hook-reference',invocation:assumed.invocation}:assumed.value;
    }
    factoryCall(n,env) {
      const point=source(n),same=(a,b)=>a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;
      if(!(options.factoryCalls??[]).some(c=>same(c.site,point)))return MISSING;
      const assumed=options.factoryCalls[factoryCalls.length];
      if(!assumed||!same(assumed.site,point)||assumed.consumerCallsBefore!==contextCalls.length+callbackCalls.length+contextFunctionCalls.length+factoryCalls.length+hookCalls.length)throw new Refused('factory-model-call-order',n);
      if(n.questionDotToken||!ts.isIdentifier(unwrap(n.expression))||n.arguments.some(ts.isSpreadElement))throw new Refused('factory-model-call-unmodeled',n);
      const counts=[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length];
      const arguments_=n.arguments.map(arg=>{
        const value=this.expr(arg,env),literal=unwrap(arg);
        if(value?.kind==='function'){
          if(!(ts.isArrowFunction(literal)||ts.isFunctionExpression(literal))||value.node!==literal)throw new Refused('factory-model-function-argument-unmodeled',arg);
          return {kind:'deferred-literal',source:source(literal),qualification:'body-and-captures-unverified'};
        }
        return shape(value);
      });
      if(counts.some((v,i)=>v!==[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length][i]))throw new Refused('factory-model-argument-calls-unmodeled',n);
      factoryCalls.push({...assumed,arguments:arguments_});return {kind:'opaque-factory-reference',origin:assumed.origin,source:assumed.source};
    }
    effectCall(n,env) {
      const point=source(n),same=(a,b)=>a.file===b.file&&a.sha256===b.sha256&&a.start===b.start&&a.end===b.end;
      if(!(options.effectCalls??[]).some(c=>same(c.site,point)))return MISSING;
      const assumed=options.effectCalls[effectCalls.length];
      if(!assumed||!same(assumed.site,point)||assumed.consumerCallsBefore!==contextCalls.length+callbackCalls.length+contextFunctionCalls.length+factoryCalls.length+hookCalls.length||assumed.refCallsBefore!==refCalls.length)
        throw new Refused('effect-model-call-order-mismatch',n);
      if(n.arguments.length!==2||n.questionDotToken||n.arguments.some(ts.isSpreadElement))throw new Refused('effect-model-call-unmodeled',n);
      const literal=unwrap(n.arguments[0]),deps=unwrap(n.arguments[1]);
      if(!(ts.isArrowFunction(literal)||ts.isFunctionExpression(literal))||!same(source(literal),assumed.callback)||!ts.isArrayLiteralExpression(deps)||deps.elements.some(e=>ts.isSpreadElement(e)||ts.isOmittedExpression(e)))throw new Refused('effect-model-arguments-unmodeled',n);
      const counts=[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length];
      // Create the original function value without freezing its lexical cells
      // or applying render-return capture semantics to this earlier argument.
      const callback=this.expr(n.arguments[0],env);if(callback?.kind!=='function')throw new Refused('effect-model-callback-unmodeled',n);
      const dependencies=this.items(this.expr(n.arguments[1],env),n).map(v=>shape(v));
      if(counts.some((v,i)=>v!==[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length][i]))throw new Refused('effect-model-argument-calls-unmodeled',n);
      effectCalls.push({...assumed,dependencies});return undefined;
    }
    refCall(n,env) {
      const point=source(n),same=p=>p.file===point.file&&p.sha256===point.sha256&&p.start===point.start&&p.end===point.end;
      if (!(options.refCalls??[]).some(c=>same(c.site))) return MISSING;
      const assumed=options.refCalls[refCalls.length];
      if(!assumed||!same(assumed.site)||assumed.consumerCallsBefore!==contextCalls.length+callbackCalls.length+contextFunctionCalls.length+factoryCalls.length+hookCalls.length)
        throw new Refused('ref-model-call-order-mismatch',n);
      if(n.arguments.length!==1||n.questionDotToken||n.arguments.some(ts.isSpreadElement))throw new Refused('ref-model-call-unmodeled',n);
      const counts=[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length];
      const argument=shape(this.expr(n.arguments[0],env));
      if(counts.some((v,i)=>v!==[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length][i]))throw new Refused('ref-model-argument-calls-unmodeled',n);
      refCalls.push({...assumed,argument});return {kind:'opaque-ref-reference',state:assumed.state,call:assumed.call};
    }
    callbackCall(n, env) {
      const point=source(n),same=p=>p.file===point.file&&p.sha256===point.sha256&&p.start===point.start&&p.end===point.end;
      if (!(options.callbackCalls??[]).some(c=>same(c.site))) return MISSING;
      const assumed=options.callbackCalls[callbackCalls.length],callee=unwrap(n.expression);
      if (!assumed||!same(assumed.site)||assumed.contextCallsBefore!==contextCalls.length)
        throw new Refused('callback-model-call-order-mismatch',n);
      if (!ts.isIdentifier(callee)||callee.text==='eval'||n.questionDotToken||n.arguments.some(ts.isSpreadElement))
        throw new Refused('callback-model-call-unmodeled',n);
      // The host must prove this original callee and its creation path. Evaluate
      // the original argument expressions and retain their provenance, not the
      // observed values. Nested calls need a separate entry-order model.
      const counts=[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length];
      const args=n.arguments.map(a=>shape(this.expr(a,env)));
      if (counts.some((v,i)=>v!==[this.calls.length,contextCalls.length,callbackCalls.length,refCalls.length,effectCalls.length,factoryCalls.length,hookCalls.length][i]))
        throw new Refused('callback-model-argument-calls-unmodeled',n);
      callbackCalls.push({...assumed,arguments:args});
      return {kind:'opaque-callback-reference',origin:assumed.origin,source:assumed.source};
    }
    compiledJsx(n, env) {
      // Import binding/site authentication is a host precondition. The browser
      // observer separately joins this exact call to the registered JSX factory.
      const callee = unwrap(n.expression);
      const imported = ts.isIdentifier(callee) ? this.expr(callee, env) :
        ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
          ? this.expr(callee.expression, env) : undefined;
      if (imported?.kind !== "opaque-closure" ||
        imported.observedKind !== (ts.isIdentifier(callee) ? "function" : "object"))
        throw new Refused("compiled-factory-binding-unobserved", n);
      const target = this.scalar(this.expr(n.arguments[0], env), n.arguments[0]);
      if (typeof target !== "string" || !target)
        throw new Refused("compiled-host-target-unmodeled", n.arguments[0]);
      const given = this.expr(n.arguments[1], env);
      if (given?.kind !== "record") throw new Refused("compiled-props-not-data", n);
      let key = null;
      if (n.arguments[2]) {
        const value = this.scalar(this.expr(n.arguments[2], env), n.arguments[2]);
        if (value !== undefined) key = String(value);
      }
      // Evaluate every argument before the factory reads the props record.
      // The key expression may change locally owned props through an alias.
      const props = this.record(this.keys(given,n).map(k=>[k,this.get(given,k,n)]));
      if (props.fields.has("key")) {
        const value = this.scalar(props.fields.get("key"), n);
        if (value !== undefined) key = String(value);
        props.fields.delete("key");
      }
      this.compiledFactoryReached = true;
      return {kind:"jsx",tag:{kind:"host",name:target},props,key,source:source(n)};
    }
    sealModule(v, seen = new Set()) {
      if (!isHeap(v) || seen.has(v)) return;
      seen.add(v);
      v.origin = "module-state";
      for (const value of v.fields.values()) this.sealModule(value, seen);
    }
    closeScope(scope, seen = new Set()) {
      if (!scope || seen.has(scope)) return;
      seen.add(scope);
      scope.closed = true;
      for (const cell of scope.cells.values()) {
        this.sealModule(cell.value);
        if (cell.value?.kind === "function")
          this.closeScope(cell.value.env, seen);
      }
      this.closeScope(scope.parent, seen);
    }
    cjs(file, n) {
      if (this.globals.has(file)) return this.globals.get(file);
      if (this.loadingModules.has(file))
        throw new Refused("cyclic-runtime-module", n);
      const sf = program.getSourceFile(file);
      if (!sf || !runtimeFiles.includes(file))
        throw new Refused("runtime-file-unavailable", n);
      const containsModule = (name) =>
        ts.isIdentifier(name)
          ? name.text === "module"
          : (ts.isObjectBindingPattern(name) ||
              ts.isArrayBindingPattern(name)) &&
            name.elements.some(
              (e) => ts.isBindingElement(e) && containsModule(e.name),
            );
      const inspectBindings = (node) => {
        if (
          (ts.isVariableDeclaration(node) ||
            ts.isParameter(node) ||
            ts.isBindingElement(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isClassDeclaration(node) ||
            ts.isImportClause(node) ||
            ts.isImportSpecifier(node) ||
            ts.isNamespaceImport(node)) &&
          node.name &&
          containsModule(node.name)
        )
          throw new Refused("shadowed-commonjs-module", node);
        ts.forEachChild(node, inspectBindings);
      };
      inspectBindings(sf);
      this.commonjsFiles.add(sf.fileName);
      this.loadingModules.add(file);
      source(sf);
      const env = this.moduleScope(sf),
        module = this.record([["exports", this.record()]], "loader");
      env.special.set("module", module);
      let signal;
      this.initializationDepth++;
      try { signal = this.statements(sf.statements, env); }
      finally { this.initializationDepth--; }
      if (signal) throw new Refused("runtime-module-control-flow", n);
      const exports = module.fields.get("exports");
      if (exports?.kind !== "function")
        throw new Refused("runtime-default-not-function", n);
      this.sealModule(exports);
      this.closeScope(exports.env);
      this.globals.set(file, exports);
      this.loadingModules.delete(file);
      return exports;
    }
    bind(pattern, value, env, n) {
      if (ts.isIdentifier(pattern)) {
        env.own(symbol(pattern), value);
        return;
      }
      if (ts.isObjectBindingPattern(pattern)) {
        const excluded = new Set();
        for (const part of pattern.elements) {
          let v;
          if (part.dotDotDotToken) {
            v = this.record();
            for (const key of this.keys(value, n))
              if (!excluded.has(key))
                v.fields.set(key, this.get(value, key, n));
          } else {
            const key = keyName(part.propertyName ?? part.name);
            if (key === undefined) throw new Refused("computed-binding", part);
            excluded.add(key);
            v = this.get(value, key, part);
            if (part.initializer) this.inspect(v, part);
            if (part.initializer)
              decision(part, "binding-default", v === undefined);
            if (v === undefined && part.initializer)
              v = this.expr(part.initializer, env);
          }
          this.bind(part.name, v, env, part);
        }
        return;
      }
      if (ts.isArrayBindingPattern(pattern)) {
        const values = this.items(value, n);
        let index = 0;
        for (const part of pattern.elements) {
          if (ts.isOmittedExpression(part)) {
            index++;
            continue;
          }
          let v = part.dotDotDotToken
            ? this.array(values.slice(index))
            : values[index++];
          if (part.initializer) this.inspect(v, part);
          if (part.initializer)
            decision(part, "binding-default", v === undefined);
          if (v === undefined && part.initializer)
            v = this.expr(part.initializer, env);
          this.bind(part.name, v, env, part);
        }
        return;
      }
      throw new Refused("binding-unmodeled", pattern);
    }
    call(target, args, receiver, n) {
      this.tick(n);
      if (compiledMode && target?.kind === "guarded-symbol-for") {
        if (args.length !== 1 || typeof args[0] !== "string" || args[0] !== target.effect.key)
          throw new Refused("compiled-native-call-arguments-mismatch", n);
        this.nativeEffects.push({source:source(target.site),kind:"symbol-for",key:args[0]});
        return {kind:"registered-symbol",key:args[0]};
      }
      if (target?.kind === "builtin")
        return this.intrinsic(target.name, args, receiver, n);
      if (target?.kind !== "function")
        throw new Refused("call-target-unresolved", n);
      this.calls.push({
        source: source(target.node),
        site: n ? source(n) : null,
        ...(jsxMode && this.initializationDepth ? {phase:"module-initialization"} : {}),
      });
      const contextCall=contextMode&&n?{source:source(target.node),site:source(n),arguments:args.map(v=>shape(v))}:null;
      if(contextCall)contextFunctionCalls.push(contextCall);
      const env = new Scope(target.env);
      if (!ts.isArrowFunction(target.node))
        env.special.set(
          "arguments",
          componentMode && target.node === component
            ? opaqueArguments
            : this.array(args),
        );
      let index = 0;
      for (const p of target.node.parameters) {
        let value = p.dotDotDotToken
          ? this.array(args.slice(index))
          : args[index++];
        if (p.initializer) this.inspect(value, p);
        if (p.initializer)
          decision(p, "parameter-default", value === undefined);
        if (value === undefined && p.initializer)
          value = this.expr(p.initializer, env);
        this.bind(p.name, value, env, p);
      }
      if (!target.node.body) throw new Refused("call-body-missing", n);
      let output;
      if (!ts.isBlock(target.node.body)) output=this.expr(target.node.body, env);
      else {
        const signal = this.statements(target.node.body.statements, env);
        if (signal && signal.kind !== "return") throw new Refused("escaped-loop-control", n);
        output=signal?.value;
        if(helperMode&&target.node===component)this.helperReturnSource=signal?.source??null;
      }
      if(contextCall)contextCall.output=shape(output);
      return output;
    }
    intrinsic(name, args, receiver, n) {
      this.intrinsics.add(name);
      switch (name) {
        case "Object.assign": {
          const [target, ...sources] = args;
          for (const s of sources)
            for (const key of this.keys(s, n))
              this.put(target, key, this.get(s, key, n), n);
          return target;
        }
        case "Object.keys":
          return this.array(this.keys(args[0], n));
        case "Object.fromEntries": {
          const out = this.record();
          for (const pair of this.items(args[0], n)) {
            const [k, v] = this.items(pair, n);
            this.put(out, k, v, n);
          }
          return out;
        }
        case "Array.isArray":
          this.inspect(args[0], n);
          return args[0]?.kind === "array";
        case "Object.prototype.hasOwnProperty": {
          if (receiver?.kind === "function")
            throw new Refused("function-own-properties-unmodeled", n);
          const key = String(this.scalar(args[0], n));
          return (
            (receiver?.kind === "array" && key === "length") ||
            this.keys(receiver, n).includes(key)
          );
        }
        case "Function.prototype.call":
          return this.call(receiver, args.slice(1), args[0], n);
        case "Function.prototype.apply":
          return this.call(receiver, this.items(args[1], n), args[0], n);
        case "Set.prototype.has":
          return receiver.items.some((v) => {
            const a = this.scalar(v, n),
              b = this.scalar(args[0], n);
            return a === b || (Number.isNaN(a) && Number.isNaN(b));
          });
        case "Array.prototype.includes":
          return this.items(receiver, n)
            .map((v) => this.scalar(v, n))
            .includes(this.scalar(args[0], n), this.scalar(args[1], n));
        case "Array.prototype.push":
          for (const a of args)
            this.put(receiver, String(receiver.length), a, n);
          return receiver.length;
        case "Array.prototype.join":
          return this.items(receiver, n)
            .map((v) => this.scalar(v, n))
            .join(this.scalar(args[0], n));
        case "Array.prototype.some": {
          const values = this.items(receiver, n),
            nested = this.iterating.has(receiver);
          this.iterating.add(receiver);
          try {
            return values.some((v, i) =>
              this.truth(this.call(args[0], [v, i, receiver], undefined, n), n),
            );
          } finally {
            if (!nested) this.iterating.delete(receiver);
          }
        }
        case "Array.prototype.map": {
          const values = this.items(receiver, n),
            nested = this.iterating.has(receiver);
          this.iterating.add(receiver);
          try {
            return this.array(
              values.map((v, i) =>
                this.call(args[0], [v, i, receiver], undefined, n),
              ),
            );
          } finally {
            if (!nested) this.iterating.delete(receiver);
          }
        }
        case "String.prototype.startsWith":
          return this.scalar(receiver, n).startsWith(
            this.scalar(args[0], n),
            this.scalar(args[1], n),
          );
        case "String.prototype.substring":
          return this.scalar(receiver, n).substring(
            ...args.map((v) => this.scalar(v, n)),
          );
        case "String.prototype.includes":
          return this.scalar(receiver, n).includes(
            this.scalar(args[0], n),
            this.scalar(args[1], n),
          );
        default:
          throw new Refused("intrinsic-unmodeled:" + name, n);
      }
    }
    ref(n, env) {
      n = unwrap(n);
      if (ts.isIdentifier(n)) {
        const cell = env.lookup(symbol(n));
        if (!cell || cell.owner.closed || cell.owner.readonly)
          throw new Refused("nonlocal-binding-write", n);
        return {
          get: () => cell.value,
          set: (v) => {
            cell.value = v;
            return v;
          },
        };
      }
      if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
        const object = this.expr(n.expression, env),
          key = ts.isPropertyAccessExpression(n)
            ? n.name.text
            : this.expr(n.argumentExpression, env);
        if (compiledMode && object?.kind === "opaque-closure" && key?.kind === "registered-symbol" &&
            ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
          const effect = this.nativeEffect(n.parent, "write");
          if (effect.kind !== "global-symbol-data-write" || effect.key !== key.key)
            throw new Refused("compiled-native-write-key-mismatch", n);
          return {set:value=>{
            this.scalar(value,n);
            if (!Object.is(value,effect.value)) throw new Refused("compiled-native-write-value-mismatch", n);
            this.nativeEffects.push({source:source(n.parent),kind:"global-symbol-data-write",key:key.key,value:shape(value)});
            return value;
          }};
        }
        return {
          get: () => this.get(object, key, n),
          set: (v) => this.put(object, key, v, n),
          delete: () => this.put(object, key, undefined, n, true),
        };
      }
      throw new Refused("assignment-target-unmodeled", n);
    }
    jsx(n, env) {
      const fragment = ts.isJsxFragment(n),
        opening = fragment
          ? undefined
          : ts.isJsxElement(n)
            ? n.openingElement
            : n;
      let tag;
      if (fragment) tag = { kind: "fragment" };
      else if (
        ts.isIdentifier(opening.tagName) &&
        /^[a-z]/.test(opening.tagName.text)
      )
        tag = { kind: "host", name: opening.tagName.text };
      else {
        const name = opening.tagName;
        // A local alias can resolve to an intrinsic host. Imported components
        // need a separate registered JSX-target binding; never guess from names.
        if (ts.isIdentifier(name) && env.lookup(symbol(name))) {
          const value = this.scalar(this.expr(name, env), name);
          if (typeof value !== "string" || !value)
            throw new Refused("jsx-tag-unmodeled", name);
          tag = { kind: "host", name: value };
        } else {
          const binding = jsxMode && options.jsxTarget?.(name);
          if (!binding) throw new Refused("jsx-component-target-unmodeled", name);
          tag = { kind: "source-binding", source: binding };
          jsxTargets.push({ site: source(n), read: source(name), binding });
        }
      }
      const props = this.record();
      for (const attr of opening?.attributes.properties ?? []) {
        if (ts.isJsxSpreadAttribute(attr)) {
          const value = this.expr(attr.expression, env);
          for (const key of this.keys(value, attr))
            props.fields.set(key, this.get(value, key, attr));
        } else {
          if (!ts.isIdentifier(attr.name) && !ts.isJsxNamespacedName(attr.name))
            throw new Refused("jsx-attribute-name-unmodeled", attr);
          const key = attr.name.getText(),
            init = attr.initializer;
          if (key === "__proto__")
            throw new Refused("jsx-attribute-prototype-unmodeled", attr);
          let value = true;
          if (init) {
            if (ts.isStringLiteral(init)) {
              if (/[&\r\n\t]/.test(init.text))
                throw new Refused("jsx-attribute-text-unmodeled", init);
              value = init.text;
            } else if (ts.isJsxExpression(init) && init.expression)
              value = this.expr(init.expression, env);
            else throw new Refused("jsx-attribute-value-unmodeled", attr);
          }
          props.fields.set(key, value);
        }
      }
      const children = [];
      for (const child of fragment || ts.isJsxElement(n) ? n.children : []) {
        if (ts.isJsxText(child)) {
          if (child.text.includes("&"))
            throw new Refused("jsx-text-entity-unmodeled", child);
          const lines = child.text.split(/\r\n|\n|\r/);
          let text = "";
          const last = lines.findLastIndex((line) => /[^ \t]/.test(line));
          for (let i = 0; i < lines.length; i++) {
            let line = lines[i].replaceAll("\t", " ");
            if (i !== 0) line = line.replace(/^ +/, "");
            if (i !== lines.length - 1) line = line.replace(/ +$/, "");
            if (line) text += line + (i < last ? " " : "");
          }
          if (text) children.push(text);
        } else if (ts.isJsxExpression(child)) {
          if (child.dotDotDotToken)
            throw new Refused("jsx-spread-child-unmodeled", child);
          if (child.expression) children.push(this.expr(child.expression, env));
        } else children.push(this.expr(child, env));
      }
      if (children.length)
        props.fields.set(
          "children",
          children.length === 1 ? children[0] : this.array(children),
        );
      const escapeSeen = new Set();
      const checkEscape = (value, role) => {
        if (value === opaque) {
          if (role !== "children") throw new Refused("jsx-content-escape", n);
          return;
        }
        if (value?.kind === "opaque-parameter") {
          if (role !== "ref") throw new Refused("jsx-parameter-escape", n);
          return;
        }
        if (value?.kind === "jsx") {
          if (role !== "children") throw new Refused("jsx-value-escape", n);
          return;
        }
        if (isHeap(value)) {
          if (escapeSeen.has(value))
            throw new Refused("jsx-prop-cycle-or-alias-unmodeled", n);
          escapeSeen.add(value);
          for (const nested of value.fields.values())
            checkEscape(
              nested,
              role === "children" && value.kind === "array"
                ? "children"
                : "data",
            );
          escapeSeen.delete(value);
        }
      };
      for (const [key, value] of props.fields)
        checkEscape(
          value,
          key === "children" ? "children" : key === "ref" ? "ref" : "data",
        );
      const key = props.fields.get("key");
      if (props.fields.has("key")) {
        this.scalar(key, n);
        if (
          key !== undefined &&
          key !== null &&
          !["string", "number", "boolean"].includes(typeof key)
        )
          throw new Refused("jsx-key-unmodeled", n);
        props.fields.delete("key");
      }
      return {
        kind: "jsx",
        tag,
        props,
        key: key === undefined ? null : String(key),
        source: source(n),
      };
    }
    expr(n, env) {
      this.tick(n);
      n = unwrap(n);
      if (
        componentMode &&
        (ts.isJsxElement(n) ||
          ts.isJsxSelfClosingElement(n) ||
          ts.isJsxFragment(n))
      )
        return this.jsx(n, env);
      if (ts.isIdentifier(n)) return this.identifier(n, env);
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
        return n.text;
      if (ts.isNumericLiteral(n)) return Number(n.text);
      if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
      if (n.kind === ts.SyntaxKind.NullKeyword) return null;
      if (ts.isArrowFunction(n) || ts.isFunctionExpression(n))
        return this.fn(n, env);
      if (ts.isObjectLiteralExpression(n)) {
        const value = this.record();
        if(contextMode)value.literalSource=source(n);
        for (const p of n.properties) {
          if (ts.isSpreadAssignment(p)) {
            const v = this.expr(p.expression, env);
            // CopyDataProperties skips nullish sources in object literals.
            // General own-key reads and opaque values retain their guards.
            if(v===null||v===undefined)continue;
            for (const k of this.keys(v, p))
              value.fields.set(k, this.get(v, k, p));
            continue;
          }
          if (
            !ts.isPropertyAssignment(p) &&
            !ts.isShorthandPropertyAssignment(p)
          )
            throw new Refused("nondata-object-member", p);
          const k = ts.isComputedPropertyName(p.name)
            ? this.scalar(this.expr(p.name.expression, env), p)
            : keyName(p.name);
          if (k === undefined || k === "__proto__")
            throw new Refused("object-key-unmodeled", p);
          value.fields.set(
            String(k),
            this.expr(ts.isPropertyAssignment(p) ? p.initializer : p.name, env),
          );
        }
        return value;
      }
      if (ts.isArrayLiteralExpression(n)) {
        const items = [];
        for (const e of n.elements) {
          if (ts.isSpreadElement(e))
            items.push(...this.items(this.expr(e.expression, env), e));
          else if (ts.isOmittedExpression(e))
            throw new Refused("sparse-array", e);
          else items.push(this.expr(e, env));
        }
        const value=this.array(items);if(contextMode)value.literalSource=source(n);return value;
      }
      if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
        const owner = this.expr(n.expression, env);
        if (n.questionDotToken && (owner === undefined || owner === null))
          return undefined;
        return this.get(
          owner,
          ts.isPropertyAccessExpression(n)
            ? n.name.text
            : this.expr(n.argumentExpression, env),
          n,
        );
      }
      if (ts.isCallExpression(n)) {
        if (helperMode) {const value=this.helperContextCall(n,env);if(value!==MISSING)return value;}
        if (contextMode) {const value=this.hookCall(n,env);if(value!==MISSING)return value;}
        if (contextMode) {const value=this.factoryCall(n,env);if(value!==MISSING)return value;}
        if (contextMode) {const value=this.effectCall(n,env);if(value!==MISSING)return value;}
        if (contextMode) {const value=this.refCall(n,env);if(value!==MISSING)return value;}
        if (contextMode) {const value=this.contextCall(n,env);if(value!==MISSING)return value;}
        if (contextMode) {const value=this.callbackCall(n,env);if(value!==MISSING)return value;}
        if (targetMode) {const value=this.targetJsx(n,env);if(value!==MISSING)return value;}
        if (compiledMode && n === call) return this.compiledJsx(n, env);
        let receiver, target;
        const e = unwrap(n.expression);
        if (
          ts.isPropertyAccessExpression(e) ||
          ts.isElementAccessExpression(e)
        ) {
          receiver = this.expr(e.expression, env);
          if (
            e.questionDotToken &&
            (receiver === null || receiver === undefined)
          )
            return undefined;
          target = this.get(
            receiver,
            ts.isPropertyAccessExpression(e)
              ? e.name.text
              : this.expr(e.argumentExpression, env),
            e,
          );
        } else target = this.expr(e, env);
        if (n.questionDotToken && (target === null || target === undefined))
          return undefined;
        const args = [];
        for (const a of n.arguments) {
          if (ts.isSpreadElement(a))
            args.push(...this.items(this.expr(a.expression, env), a));
          else args.push(this.expr(a, env));
        }
        return this.call(target, args, receiver, n);
      }
      if (ts.isNewExpression(n)) {
        const target = this.expr(n.expression, env);
        if (
          target?.kind !== "builtin" ||
          target.name !== "Set" ||
          n.arguments?.length !== 1
        )
          throw new Refused("constructor-unmodeled", n);
        return {
          ...this.record([], "local", "set"),
          items: this.items(this.expr(n.arguments[0], env), n),
        };
      }
      if (ts.isConditionalExpression(n)) {
        const chosen = this.truth(this.expr(n.condition, env), n.condition);
        decision(n.condition, "conditional", chosen);
        return this.expr(chosen ? n.whenTrue : n.whenFalse, env);
      }
      if (ts.isVoidExpression(n)) {
        this.expr(n.expression, env);
        return undefined;
      }
      if (ts.isTypeOfExpression(n)) {
        const captured = this.closureRead(n, "typeof");
        if (captured !== MISSING) {
          if (typeof captured !== "string" || !["undefined","boolean","number","string","symbol","bigint","object","function"].includes(captured))
            throw new Refused("compiled-typeof-observation-invalid", n);
          return captured;
        }
        const v = this.inspect(this.expr(n.expression, env), n);
        return v?.kind === "builtin" && v.name.endsWith(".prototype")
          ? "object"
          : v?.kind === "function" || v?.kind === "builtin"
            ? "function"
            : isHeap(v)
              ? "object"
              : typeof v;
      }
      if (ts.isDeleteExpression(n)) {
        const r = this.ref(n.expression, env);
        if (!r.delete) throw new Refused("delete-binding", n);
        r.delete();
        return true;
      }
      if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) {
        if (
          [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(
            n.operator,
          )
        ) {
          const r = this.ref(n.operand, env),
            before = this.scalar(r.get(), n);
          if (typeof before !== "number")
            throw new Refused("increment-coercion-unmodeled", n);
          r.set(before + (n.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1));
          return ts.isPostfixUnaryExpression(n) ? before : r.get();
        }
        const v = this.expr(n.operand, env);
        if (n.operator === ts.SyntaxKind.ExclamationToken)
          return !this.truth(v, n);
        if (n.operator === ts.SyntaxKind.MinusToken) return -this.scalar(v, n);
        if (n.operator === ts.SyntaxKind.PlusToken) return +this.scalar(v, n);
        throw new Refused("unary-unmodeled", n);
      }
      if (ts.isTemplateExpression(n)) {
        let text = n.head.text;
        for (const span of n.templateSpans)
          text +=
            String(this.scalar(this.expr(span.expression, env), span)) +
            span.literal.text;
        return text;
      }
      if (ts.isBinaryExpression(n)) {
        const op = n.operatorToken.kind;
        if (op === ts.SyntaxKind.EqualsToken)
          return this.ref(n.left, env).set(this.expr(n.right, env));
        if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
          const l = this.expr(n.left, env);
          const chosen = this.truth(l, n.left);
          decision(n.left, "logical-and", chosen);
          return chosen ? this.expr(n.right, env) : l;
        }
        if (op === ts.SyntaxKind.BarBarToken) {
          const l = this.expr(n.left, env);
          const chosen = this.truth(l, n.left);
          decision(n.left, "logical-or", chosen);
          return chosen ? l : this.expr(n.right, env);
        }
        if (op === ts.SyntaxKind.QuestionQuestionToken) {
          const l = this.inspect(this.expr(n.left, env), n.left);
          const chosen = l === undefined || l === null;
          decision(n.left, "nullish", chosen);
          return chosen ? this.expr(n.right, env) : l;
        }
        const l = this.expr(n.left, env),
          r = this.expr(n.right, env);
        if (op === ts.SyntaxKind.InKeyword) {
          const k = String(this.scalar(l, n));
          this.inspect(r, n);
          if (!isHeap(r)) throw new Refused("in-nondata", n);
          if (r.fields.has(k) || (r.kind === "array" && k === "length"))
            return true;
          if (r.kind !== "record")
            throw new Refused("in-prototype-unmodeled", n);
          return [
            "constructor",
            "__defineGetter__",
            "__defineSetter__",
            "hasOwnProperty",
            "__lookupGetter__",
            "__lookupSetter__",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "toString",
            "valueOf",
            "__proto__",
            "toLocaleString",
          ].includes(k);
        }
        // Strict equality of known native identities performs no coercion.
        // Runtime guards still have to establish these exact intrinsic values.
        if ((op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
            l?.kind === "builtin" && r?.kind === "builtin") {
          const same = l.name === r.name;
          return op === ts.SyntaxKind.EqualsEqualsEqualsToken ? same : !same;
        }
        const a = this.scalar(l, n),
          b = this.scalar(r, n);
        switch (op) {
          case ts.SyntaxKind.EqualsEqualsEqualsToken:
            return a === b;
          case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            return a !== b;
          case ts.SyntaxKind.LessThanToken:
            return a < b;
          case ts.SyntaxKind.LessThanEqualsToken:
            return a <= b;
          case ts.SyntaxKind.GreaterThanToken:
            return a > b;
          case ts.SyntaxKind.PlusToken:
            return a + b;
          case ts.SyntaxKind.MinusToken:
            return a - b;
          default:
            throw new Refused("binary-unmodeled:" + ts.tokenToString(op), n);
        }
      }
      throw new Refused("expression-unmodeled:" + ts.SyntaxKind[n.kind], n);
    }
    statements(statements, env) {
      for (const s of statements)
        if (ts.isFunctionDeclaration(s) && s.name)
          env.own(symbol(s.name), this.fn(s, env));
      for (const s of statements) {
        const signal = this.statement(s, env);
        if (signal) return signal;
      }
    }
    statement(n, env) {
      this.tick(n);
      if (ts.isBlock(n)) return this.statements(n.statements, new Scope(env));
      if (ts.isVariableStatement(n)) {
        for (const d of n.declarationList.declarations)
          this.bind(
            d.name,
            d.initializer ? this.expr(d.initializer, env) : undefined,
            env,
            d,
          );
        return;
      }
      if (ts.isExpressionStatement(n)) {
        this.expr(n.expression, env);
        return;
      }
      if (ts.isReturnStatement(n))
        return {
          kind: "return",
          ...(helperMode?{source:source(n)}:{}),
          value: n.expression ? this.expr(n.expression, env) : undefined,
        };
      if (ts.isIfStatement(n)) {
        const chosen = this.truth(this.expr(n.expression, env), n.expression);
        decision(n.expression, "if", chosen);
        return chosen
          ? this.statement(n.thenStatement, env)
          : n.elseStatement
            ? this.statement(n.elseStatement, env)
            : undefined;
      }
      if (ts.isContinueStatement(n)) {
        if (n.label) throw new Refused("label-control", n);
        return { kind: "continue" };
      }
      if (ts.isBreakStatement(n)) {
        if (n.label) throw new Refused("label-control", n);
        return { kind: "break" };
      }
      if (ts.isForInStatement(n) || ts.isForOfStatement(n)) {
        if (
          !ts.isVariableDeclarationList(n.initializer) ||
          n.initializer.declarations.length !== 1 ||
          n.awaitModifier
        )
          throw new Refused("loop-binding-unmodeled", n);
        if (!(n.initializer.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))) {
          // Model a function-scoped loop variable only when its binding cannot
          // escape the body or be captured. Per-iteration cells are equivalent
          // in this bounded case; hoisting and later reads stay unsupported.
          const declaration = n.initializer.declarations[0];
          if (!ts.isIdentifier(declaration.name) || declaration.initializer)
            throw new Refused("loop-var-scope-unmodeled", n);
          const binding = symbol(declaration.name);
          let owner = n.parent;
          while (owner && !ts.isFunctionLike(owner) && !ts.isSourceFile(owner)) owner = owner.parent;
          let escaped = !binding, captured = false;
          const check = (node) => {
            if (node !== declaration.name && ts.isIdentifier(node) && symbol(node) === binding &&
                (node.getStart() < n.statement.getStart() || node.end > n.statement.end)) escaped = true;
            if (ts.isFunctionLike(node) && node.getStart() >= n.statement.getStart() && node.end <= n.statement.end) captured = true;
            ts.forEachChild(node, check);
          };
          check(owner);
          if (escaped || captured) throw new Refused("loop-var-scope-unmodeled", n);
        }
        const value = this.expr(n.expression, env),
          values = ts.isForInStatement(n)
            ? this.keys(value, n)
            : this.items(value, n);
        for (const v of values) {
          const scope = new Scope(env);
          this.bind(n.initializer.declarations[0].name, v, scope, n);
          const signal = this.statement(n.statement, scope);
          if (signal?.kind === "return") return signal;
          if (signal?.kind === "break") break;
        }
        return;
      }
      if (ts.isForStatement(n)) {
        let bodyVar = false,
          bodyFunction = false;
        const inspect = (node) => {
          if (ts.isFunctionLike(node)) {
            bodyFunction = true;
            return;
          }
          if (
            ts.isVariableDeclaration(node) &&
            !(node.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))
          )
            bodyVar = true;
          ts.forEachChild(node, inspect);
        };
        inspect(n.statement);
        if (n.condition) inspect(n.condition);
        if (n.incrementor) inspect(n.incrementor);
        if (
          bodyFunction &&
          n.initializer &&
          ts.isVariableDeclarationList(n.initializer) &&
          n.initializer.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)
        )
          throw new Refused("loop-lexical-capture-unmodeled", n);
        if (bodyVar && bodyFunction)
          throw new Refused("loop-var-capture-unmodeled", n);
        const scope = new Scope(env);
        if (n.initializer) {
          if (ts.isVariableDeclarationList(n.initializer)) {
            for (const d of n.initializer.declarations)
              this.bind(
                d.name,
                d.initializer ? this.expr(d.initializer, scope) : undefined,
                scope,
                d,
              );
          } else this.expr(n.initializer, scope);
        }
        while (
          !n.condition ||
          this.truth(this.expr(n.condition, scope), n.condition)
        ) {
          this.tick(n);
          const signal = this.statement(n.statement, scope);
          if (signal?.kind === "return") return signal;
          if (signal?.kind === "break") break;
          if (n.incrementor) this.expr(n.incrementor, scope);
        }
        return;
      }
      if (ts.isFunctionDeclaration(n) || ts.isEmptyStatement(n)) return;
      throw new Refused("statement-unmodeled:" + ts.SyntaxKind[n.kind], n);
    }
  }

  const e = new Evaluator();
  function runtimeBindings() {
    const nodes = [],
      seen = new Map();
    function value(v) {
      if (!isBox(v)) return shape(v);
      if (v === opaque || v?.kind === "opaque-parameter")
        throw new Refused("runtime-binding-captures-content");
      if (v.kind === "builtin") return { kind: "native", name: v.name };
      if (!isHeap(v) || v.kind === "set")
        throw new Refused("runtime-binding-value-unmodeled");
      if (seen.has(v)) return { kind: "reference", id: seen.get(v) };
      const id = nodes.length;
      seen.set(v, id);
      const node = { id, kind: v.kind, fields: [] };
      nodes.push(node);
      if (v.kind === "function") node.source = source(v.node);
      if (v.kind === "array") node.length = v.length;
      node.fields = e.keys(v).map((k) => [k, value(e.get(v, k))]);
      return { kind: "reference", id };
    }
    const bindings = [...e.bindingReads.values()].map((b) => ({
      binding: b.binding,
      declarationKind: b.declarationKind,
      name: b.name,
      reads: b.reads,
      value: value(b.value),
    }));
    const functions = e.functionValues.map((v) => value(v).id);
    return { bindings, nodes, functions };
  }
  function shape(value, seen = new Set()) {
    if(contextMode&&value?.kind==='opaque-hook-reference')return {kind:'hook-reference',invocation:value.invocation,qualification:'state-and-effects-unverified'};
    if(contextMode&&value?.kind==='opaque-factory-reference')return {kind:'factory-reference',origin:value.origin,source:value.source,qualification:'body-and-captures-unverified'};
    if(contextMode&&value?.kind==='opaque-ref-reference')return {kind:'ref-reference',state:value.state,call:value.call};
    if (contextMode&&value?.kind==='opaque-callback-reference')
      return {kind:'callback-reference',origin:value.origin,source:value.source,qualification:'callback-body-unverified'};
    if(helperMode&&value?.kind==='native-context')return {kind:'native-context',context:value.context};
    if(helperMode&&value?.kind==='helper-argument')return {kind:'argument',index:value.index};
    if ((contextMode || helperMode) && value?.kind === "opaque-context-field")
      return {kind:"context-field",value:value.value,key:value.key};
    if ((contextMode || helperMode) && value?.contextId !== undefined)
      return {kind:"context-value",value:value.contextId};
    if (value?.kind === "opaque-callback-input")
      return {kind:"callback-input",key:value.key};
    if (value === opaque) return { kind: "opaque" };
    if ((compiledMode || jsxMode) && value?.kind === "opaque-property")
      return {kind:"input",key:value.key};
    if ((compiledMode || helperMode) && value?.kind === "opaque-closure")
      return {kind:"closure",name:value.name,read:value.read};
    if (componentMode && value?.kind === "opaque-parameter")
      return { kind: "parameter", index: value.index };
    if (componentMode && value?.kind === "jsx")
      return {
        kind: "jsx",
        tag: value.tag,
        key: value.key,
        source: value.source,
        props: shape(value.props, seen),
      };
    if (
      value === null ||
      ["string", "number", "boolean", "undefined"].includes(typeof value)
    ) {
      if (
        typeof value === "number" &&
        (!Number.isFinite(value) || Object.is(value, -0))
      )
        throw new Refused("non-json-number");
      return {
        kind: "literal",
        type: typeof value,
        ...(value === undefined ? {} : { value }),
      };
    }
    if (targetMode && value?.kind === "function") {
      if(describingDeferred)throw new Refused("target-callback-nested-output-unmodeled",value.node);
      if (!(ts.isArrowFunction(value.node) || ts.isFunctionExpression(value.node)))
        throw new Refused("target-callback-kind-unmodeled",value.node);
      if (seen.has(value)) throw new Refused("target-callback-cycle",value.node);
      const next = new Set([...seen,value]), captures=[], dependencies=[], captureKeys=new Set();
      const inventory=options.callback(value.node);
      if (inventory.effects.some(effect=>!["call"].includes(effect.kind)))
        throw new Refused("target-callback-effects-unmodeled",value.node);
      for (const read of inventory.reads) {
        const id=ts.isTypeOfExpression(read.node)?unwrap(read.node.expression):read.node;
        const cell=value.env.lookup(symbol(id));
        if (cell && !cell.owner.closed) {
          const declaration=symbol(id)?.valueDeclaration;
          if (!declaration) throw new Refused("target-callback-capture-unbound",id);
          const binding=source(declaration),key=JSON.stringify(binding);
          if (!captureKeys.has(key)) {
            captureKeys.add(key);captures.push({name:read.name,binding,value:shape(cell.value,next)});
          }
        } else dependencies.push({name:read.name,read:source(read.node),...(read.declaration?{binding:read.declaration}:{})});
      }
      returnedCallbacks.push(value);
      return {kind:"callback",source:source(value.node),qualification:"callback-body-unverified",capturePhase:"render-return",captures,dependencies};
    }
    if (!value || !["record", "array"].includes(value.kind))
      throw new Refused("result-shape-unmodeled");
    if (seen.has(value)) throw new Refused("result-cycle");
    const next = new Set([...seen, value]);
    return value.kind === "array"
      ? { kind: "array", items: e.items(value).map((v) => shape(v, next)),...(contextMode&&value.literalSource?{allocation:{id:value.id,source:value.literalSource}}:{}) }
      : {
          kind: "record",
          ...(contextMode&&value.literalSource?{allocation:{id:value.id,source:value.literalSource}}:{}),
          fields: e.keys(value).map((k) => [k, shape(e.get(value, k), next)]),
        };
  }
  try {
    if(helperMode){
      if(!component||!ts.isFunctionDeclaration(component)||!component.body||component.asteriskToken||component.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))throw new Refused('context-helper-function-unmodeled',component);
      const args=options.arguments.map((v,index)=>v&&typeof v==='object'?{kind:'helper-argument',index}:v);
      const output=e.call(e.fn(component,e.moduleScope(component.getSourceFile())),args,undefined,null);
      if(e.closureCursor!==options.closureReads.length||e.helperHooks.length!==options.nativeCalls.length)throw new Refused('context-helper-observation-not-fully-consumed',component);
      return {status:'modeled',output:shape(output),returnSource:e.helperReturnSource,closureReads:e.closureCursor,nativeCalls:e.helperHooks,calls:e.calls,writes:e.writes,decisions,steps:e.steps};
    }
    const first = jsxMode ? undefined : unwrap(call.arguments[0]);
    if (!compiledMode && !jsxMode && (!ts.isIdentifier(first) || symbol(first) !== symbol(parameter)))
      throw new Refused("helper-input-not-direct-parameter", call);
    const input = e.record(
      properties.map(([key, value]) => [
        key,
        key === contentKey ? opaque : (compiledMode || jsxMode) && value && typeof value === "object" && typeof value.opaque === "string"
          ? {kind:"opaque-property",key} : value,
      ]),
      "input-props",
    );
    if (!compiledMode && !jsxMode && !input.fields.has(contentKey))
      throw new Refused("helper-content-input-missing");
    const env = new Scope(e.moduleScope((jsxMode ? component : call).getSourceFile()));
    if(ts.isIdentifier(parameter))env.own(symbol(parameter), input);
    else if(!targetMode||!ts.isObjectBindingPattern(parameter))throw new Refused("target-render-parameter-unmodeled",parameter);
    // Target components bind their original parameter pattern in e.call below.
    // A pattern is not a lexical symbol and must not create an undefined cell.
    let extraArguments = [],
      output;
    if (componentMode) {
      if (!component || component.parameters[0]?.name !== parameter)
        throw new Refused("component-parameter-unmatched", parameter);
      const args = [input];
      for (let i = 1; i < component.parameters.length; i++) {
        args.push({ kind: "opaque-parameter", index: i });
      }
      output = e.call(
        e.fn(component, e.moduleScope(component.getSourceFile())),
        args,
        undefined,
        null,
      );
      if (output?.kind !== "jsx")
        throw new Refused("component-return-not-jsx", component);
      if (
        !compiledMode && !jsxMode && !e.calls.some(
          (c) =>
            c.site &&
            c.site.file === source(call).file &&
            c.site.start === source(call).start &&
            c.site.end === source(call).end,
        )
      )
        throw new Refused("component-helper-call-not-reached", call);
      if (compiledMode && (!e.compiledFactoryReached || e.closureCursor !== options.closureReads.length || e.effectCursor !== options.effects.length))
        throw new Refused("compiled-observation-not-fully-consumed", call);
      if (contextMode && contextCalls.length !== options.contextCalls.length)
        throw new Refused("context-model-calls-not-fully-consumed", component);
      if (contextMode && hookCalls.length !== (options.hookCalls??[]).length)throw new Refused('hook-model-calls-not-fully-consumed',component);
      if (contextMode && factoryCalls.length !== (options.factoryCalls??[]).length)throw new Refused('factory-model-calls-not-fully-consumed',component);
      if (contextMode && effectCalls.length !== (options.effectCalls??[]).length)throw new Refused('effect-model-calls-not-fully-consumed',component);
      if (contextMode && refCalls.length !== (options.refCalls??[]).length)throw new Refused('ref-model-calls-not-fully-consumed',component);
      if (contextMode && callbackCalls.length !== (options.callbackCalls??[]).length)
        throw new Refused('callback-model-calls-not-fully-consumed',component);
    } else {
      extraArguments = call.arguments
        .slice(1)
        .map((argument) => shape(e.expr(argument, env)));
      output = e.expr(call, env);
      if (output?.kind !== "record" || output.fields.get(contentKey) !== opaque)
        throw new Refused("helper-content-not-preserved", call);
    }
    const result = {
      status: "modeled",
      input: shape(input),
      output: shape(output),
      extraArguments,
      calls: [...e.calls],
      writes: [...e.writes],
      intrinsics: [...e.intrinsics].sort(),
      definitions: [...e.sourceDefinitions.values()],
      runtimeBindings: runtimeBindings(),
      ...(compiledMode ? {nativeEffects:e.nativeEffects} : {}),
      ...(jsxMode ? {jsxTargets:[...jsxTargets]} : {}),
      ...(targetMode ? {targetFactories:[...targetFactories]} : {}),
      ...(contextMode ? {contextCalls,callbackCalls,refCalls,effectCalls,factoryCalls,hookCalls,targetReads,mutableBindings,contextFunctionCalls,
        contextValues:[...contextObjects.values()].map(v=>({id:v.contextId,fields:e.keys(v).map(k=>[k,shape(e.get(v,k))])}))} : {}),
      steps: e.steps,
      ...(componentMode
        ? {
            component: source(component),
            decisions:[...decisions],
            content:
              output.props.fields.get("children") === opaque
                ? "forwarded"
                : "not-directly-forwarded",
          }
        : {}),
    };
    if(targetMode && options.deferred){
      const requested=options.deferred,pointKey=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
      const candidates=returnedCallbacks.filter(f=>pointKey(source(f.node))===pointKey(requested.source));
      if(candidates.length!==1)throw new Refused("target-callback-return-ambiguous",component);
      const callback=candidates[0];
      if(callback.node.parameters.length!==1)throw new Refused("target-callback-parameter-unmodeled",callback.node);
      // A deferred call may read its original lexical environment, but cannot
      // silently mutate already-returned render state through a helper call.
      const seen=new Set();
      const protect=value=>{
        if(!isHeap(value)||seen.has(value))return;seen.add(value);
        if(value.origin!=="module-state")value.origin="input-data";
        for(const child of value.fields.values())protect(child);
      };
      for(let env=callback.env;env&&!env.closed;env=env.parent){env.readonly=true;for(const cell of env.cells.values())protect(cell.value);}
      const callbackInput=e.record(requested.properties.map(([key,value])=>[key,
        value&&typeof value==='object'&&typeof value.opaque==='string'?{kind:'opaque-callback-input',key}:value]),'input-data');
      const start={calls:e.calls.length,writes:e.writes.length,decisions:decisions.length,targets:jsxTargets.length,factories:targetFactories.length};
      const callbackOutput=e.call(callback,[callbackInput],undefined,null);
      if(callbackOutput?.kind!=="jsx")throw new Refused("target-callback-return-not-jsx",callback.node);
      describingDeferred=true;
      result.deferred={source:source(callback.node),input:shape(callbackInput),output:shape(callbackOutput),
        calls:e.calls.slice(start.calls),writes:e.writes.slice(start.writes),decisions:decisions.slice(start.decisions),
        jsxTargets:jsxTargets.slice(start.targets),targetFactories:targetFactories.slice(start.factories),
        intrinsics:[...e.intrinsics].sort(),definitions:[...e.sourceDefinitions.values()],runtimeBindings:runtimeBindings()};
      result.steps=e.steps;
    }
    return result;
  } catch (error) {
    if (error instanceof Refused)
      return { status: "refused", reason: error.reason, steps: e.steps,
        ...(contextMode?{callbackCalls,refCalls,effectCalls,factoryCalls,hookCalls}:{}),
        ...((compiledMode || jsxMode || helperMode) && error.node ? {at:source(error.node)} : {}) };
    throw error;
  }
}
