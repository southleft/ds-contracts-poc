import type ts from "typescript";

export type HelperPrimitive = string | number | boolean | null | undefined;
export type HelperValueShape =
  | { kind: "opaque" }
  | { kind: "literal"; type: string; value?: HelperPrimitive }
  | { kind: "record"; fields: Array<[string, HelperValueShape]> }
  | { kind: "array"; items: HelperValueShape[] };
export interface HelperSourcePoint {
  file: string;
  sha256: string;
  start: number;
  end: number;
}
export interface HelperRuntimeImport {
  importer: string;
  specifier: string;
  file: string;
}
export type HelperRuntimeValue =
  | { kind: "literal"; type: string; value?: HelperPrimitive }
  | { kind: "native"; name: string }
  | { kind: "reference"; id: number };
export interface HelperRuntimeBindings {
  functions: number[];
  bindings: Array<{
    binding: HelperSourcePoint;
    declarationKind: string;
    name: string;
    reads: HelperSourcePoint[];
    value: HelperRuntimeValue;
  }>;
  nodes: Array<{
    id: number;
    kind: "record" | "array" | "function";
    fields: Array<[string, HelperRuntimeValue]>;
    source?: HelperSourcePoint;
    length?: number;
  }>;
}
export type HelperModelResult =
  | { status: "refused"; reason: string; steps: number }
  | {
      status: "modeled";
      input: HelperValueShape;
      output: HelperValueShape;
      extraArguments: HelperValueShape[];
      calls: Array<{
        source: HelperSourcePoint;
        site: HelperSourcePoint | null;
        phase?: "module-initialization";
      }>;
      writes: Array<{
        target: number;
        origin: string;
        key: string;
        operation: "delete" | "set";
        source: HelperSourcePoint | null;
      }>;
      intrinsics: string[];
      definitions: HelperSourcePoint[];
      runtimeBindings: HelperRuntimeBindings;
      steps: number;
    };

/** Internal model only. Runtime provenance and effects remain unverified. */
export function modelReactHelperCall(options: {
  program: ts.Program;
  call: ts.CallExpression;
  parameter: ts.Identifier;
  properties: ReadonlyArray<readonly [string, HelperPrimitive]>;
  contentKey: string;
  source(node: ts.Node): HelperSourcePoint;
  runtimeFiles?: readonly string[];
  resolution?: readonly HelperRuntimeImport[];
}): HelperModelResult;

export type ComponentValueShape =
  | { kind: "opaque" }
  | { kind: "parameter"; index: number }
  | { kind: "literal"; type: string; value?: HelperPrimitive }
  | { kind: "record"; fields: Array<[string, ComponentValueShape]> }
  | { kind: "array"; items: ComponentValueShape[] }
  | {
      kind: "jsx";
      tag: { kind: "host"; name: string } | { kind: "fragment" };
      key: string | null;
      source: HelperSourcePoint;
      props: { kind: "record"; fields: Array<[string, ComponentValueShape]> };
    };
export type ComponentModelResult =
  | Extract<HelperModelResult, { status: "refused" }>
  | (Omit<Extract<HelperModelResult, { status: "modeled" }>, "output"> & {
      component: HelperSourcePoint;
      output: Extract<ComponentValueShape, { kind: "jsx" }>;
      decisions: Array<{
        source: HelperSourcePoint;
        kind: string;
        taken: boolean;
      }>;
      content: "forwarded" | "not-directly-forwarded";
    });
/** Source-only containing-function model. No runtime or native admission. */
export function modelReactComponentCall(
  options: Parameters<typeof modelReactHelperCall>[0] & {
    component: ts.FunctionLikeDeclaration;
  },
): ComponentModelResult;

export type CompiledModelInput = HelperPrimitive | {opaque:string};
export type CompiledValueShape =
  | {kind:"opaque"}
  | {kind:"input";key:string}
  | {kind:"closure";name:string;read:number}
  | {kind:"parameter";index:number}
  | {kind:"literal";type:string;value?:HelperPrimitive}
  | {kind:"record";fields:Array<[string,CompiledValueShape]>}
  | {kind:"array";items:CompiledValueShape[]}
  | {kind:"jsx";tag:{kind:"host";name:string};key:string|null;source:HelperSourcePoint;
      props:{kind:"record";fields:Array<[string,CompiledValueShape]>}};
export type CompiledModelResult =
  | (Extract<HelperModelResult,{status:"refused"}> & {at?:HelperSourcePoint})
  | (Omit<Extract<HelperModelResult,{status:"modeled"}>,"input"|"output"> & {
      component:HelperSourcePoint;
      input:CompiledValueShape;
      output:Extract<CompiledValueShape,{kind:"jsx"}>;
      decisions:Array<{source:HelperSourcePoint;kind:string;taken:boolean}>;
      content:"forwarded"|"not-directly-forwarded";
      nativeEffects:Array<{source:HelperSourcePoint;kind:"symbol-for"|"global-symbol-data-write";key:string;value?:CompiledValueShape}>;
    });
export type CompiledEffectAssumption = {operation:number} & (
  {status:"refused";reason:string} |
  {status:"verified";kind:"symbol-for";key:string} |
  {status:"verified";kind:"global-symbol-data-write";key:string;value:HelperPrimitive}
);
/** Source-only model under recorded input/closure assumptions. The import and
 * selected factory call must be authenticated by the host. Never native authority. */
export function modelReactCompiledCall(options:
  Omit<Parameters<typeof modelReactHelperCall>[0],"properties"> & {
    properties:ReadonlyArray<readonly [string,CompiledModelInput]>;
    component:ts.FunctionLikeDeclaration;
    closureSites:ReadonlyArray<{name:string;span:{start:number;end:number};kind:"value"|"typeof"}>;
    closureReads:ReadonlyArray<{read:number;value:CompiledModelInput}>;
    operations:ReadonlyArray<{span:{start:number;end:number};kind:"member-call"|"write"}>;
    effects:ReadonlyArray<CompiledEffectAssumption>;
  },
):CompiledModelResult;

export type JsxValueShape =
  | {kind:"opaque"}
  | {kind:"input";key:string}
  | {kind:"parameter";index:number}
  | {kind:"literal";type:string;value?:HelperPrimitive}
  | {kind:"record";fields:Array<[string,JsxValueShape]>}
  | {kind:"array";items:JsxValueShape[]}
  | {kind:"jsx";tag:{kind:"host";name:string}|{kind:"fragment"}|{kind:"source-binding";source:HelperSourcePoint};
      key:string|null;source:HelperSourcePoint;props:{kind:"record";fields:Array<[string,JsxValueShape]>}};
export type JsxModelResult =
  | (Extract<HelperModelResult,{status:"refused"}> & {at?:HelperSourcePoint})
  | (Omit<Extract<ComponentModelResult,{status:"modeled"}>,"input"|"output"> & {
      input:JsxValueShape;output:Extract<JsxValueShape,{kind:"jsx"}>;
      jsxTargets:Array<{site:HelperSourcePoint;read:HelperSourcePoint;binding:HelperSourcePoint}>;
    });
/** Full original function source model, with no runtime/native admission. */
export function modelReactJsxComponent(options:
  Omit<Parameters<typeof modelReactHelperCall>[0],"call"|"properties"> & {
    component:ts.FunctionLikeDeclaration;
    properties:ReadonlyArray<readonly [string,CompiledModelInput]>;
    jsxTarget?(name:ts.JsxTagNameExpression):HelperSourcePoint|undefined;
  }):JsxModelResult;


export type TargetValueShape =
  | Exclude<JsxValueShape,{kind:"record"|"array"|"jsx"}>
  | {kind:"record";fields:Array<[string,TargetValueShape]>}
  | {kind:"array";items:TargetValueShape[]}
  | {kind:"jsx";tag:Extract<JsxValueShape,{kind:"jsx"}>["tag"];key:string|null;source:HelperSourcePoint;props:{kind:"record";fields:Array<[string,TargetValueShape]>}}
  | {kind:"callback";source:HelperSourcePoint;qualification:"callback-body-unverified";capturePhase:"render-return";
      captures:Array<{name:string;binding:HelperSourcePoint;value:TargetValueShape}>;
      dependencies:Array<{name:string;read:HelperSourcePoint;binding?:HelperSourcePoint}>};
export type TargetModelResult =
  | Extract<JsxModelResult,{status:"refused"}>
  | (Omit<Extract<JsxModelResult,{status:"modeled"}>,"input"|"output"> & {
      input:TargetValueShape;output:Extract<TargetValueShape,{kind:"jsx"}>;
      targetFactories:Array<{source:HelperSourcePoint;factory:"jsx"|"jsxs"}>;
      deferred?:TargetCallbackProjection;
    });
export type TargetCallbackValueShape =
  | Exclude<TargetValueShape,{kind:"record"|"array"|"jsx"|"callback"}>
  | {kind:"callback-input";key:string}
  | {kind:"record";fields:Array<[string,TargetCallbackValueShape]>}
  | {kind:"array";items:TargetCallbackValueShape[]}
  | {kind:"jsx";tag:Extract<JsxValueShape,{kind:"jsx"}>["tag"];key:string|null;source:HelperSourcePoint;props:{kind:"record";fields:Array<[string,TargetCallbackValueShape]>}};
export interface TargetCallbackProjection {
  source:HelperSourcePoint;
  input:TargetCallbackValueShape;
  output:Extract<TargetCallbackValueShape,{kind:"jsx"}>;
  calls:Extract<HelperModelResult,{status:"modeled"}>["calls"];
  writes:Extract<HelperModelResult,{status:"modeled"}>["writes"];
  decisions:Extract<ComponentModelResult,{status:"modeled"}>["decisions"];
  jsxTargets:Extract<JsxModelResult,{status:"modeled"}>["jsxTargets"];
  targetFactories:Array<{source:HelperSourcePoint;factory:"jsx"|"jsxs"}>;
  intrinsics:string[];definitions:HelperSourcePoint[];runtimeBindings:HelperRuntimeBindings;
}
/** Source-only dependency projection. Deferred callback bodies do not gain any
 * execution or effects authority from their captured-value description. */
export function modelReactTargetRender(options:
  Omit<Parameters<typeof modelReactJsxComponent>[0],"jsxTarget"|"parameter"> & {
    parameter:ts.Identifier|ts.ObjectBindingPattern;
    factory(node:ts.CallExpression):"jsx"|"jsxs"|undefined;
    target(node:ts.Expression):Extract<JsxValueShape,{kind:"jsx"}>["tag"]|undefined;
    callback(node:ts.ArrowFunction|ts.FunctionExpression):{
      reads:Array<{name:string;node:ts.Node;declaration?:HelperSourcePoint}>;
      effects:ReadonlyArray<{kind:string}>;
    };
    /** Re-evaluate the original render to retain the callback's actual abstract
     * closure, then model one deferred invocation under separate assumptions. */
    deferred?:{source:HelperSourcePoint;properties:ReadonlyArray<readonly [string,CompiledModelInput]>};
  }):TargetModelResult;

/** Assumptions for one consumer execution, in original call-entry order.
 * Value ids identify fresh context objects within one observed run only. */
export interface ContextConsumerCallAssumption {
  site:HelperSourcePoint;
  arguments:HelperPrimitive[];
  value:{id:number;fields:Array<readonly [string,CompiledModelInput]>};
}
/** Conditional callback identity from an independently qualified creation path.
 * This never grants authority to execute or inspect the callback. */
export interface ContextConsumerCallbackAssumption {
  site:HelperSourcePoint;call:number;contextCallsBefore:number;
  origin:number;source:HelperSourcePoint;
}
export interface ContextConsumerHookAssumption {site:HelperSourcePoint;call:number;invocation:number;source:HelperSourcePoint;consumerCallsBefore:number;value:HelperPrimitive|{opaque:true}}
export type ContextConsumerHookCall=ContextConsumerHookAssumption & {arguments:ContextConsumerValueShape[]};
export interface ContextConsumerFactoryAssumption {site:HelperSourcePoint;call:number;origin:number;source:HelperSourcePoint;consumerCallsBefore:number}
export type ContextConsumerFactoryCall=ContextConsumerFactoryAssumption & {arguments:ContextConsumerValueShape[]};
export interface ContextConsumerEffectAssumption {site:HelperSourcePoint;callback:HelperSourcePoint;call:number;effect:number;consumerCallsBefore:number;refCallsBefore:number}
export type ContextConsumerEffectCall = ContextConsumerEffectAssumption & {dependencies:ContextConsumerValueShape[]};
export interface ContextConsumerRefAssumption {site:HelperSourcePoint;call:number;state:number;consumerCallsBefore:number}
export type ContextConsumerRefCall = ContextConsumerRefAssumption & {argument:ContextConsumerValueShape};
export type ContextConsumerCallbackCall = ContextConsumerCallbackAssumption & {arguments:ContextConsumerValueShape[]};
export type ContextConsumerValueShape =
  | Exclude<TargetValueShape,{kind:"record"|"array"|"jsx"|"callback"}>
  | {kind:"context-value";value:number}
  | {kind:"context-field";value:number;key:string}
  | {kind:"ref-reference";state:number;call:number}
  | {kind:"deferred-literal";source:HelperSourcePoint;qualification:"body-and-captures-unverified"}
  | {kind:"hook-reference";invocation:number;qualification:"state-and-effects-unverified"}
  | {kind:"factory-reference";origin:number;source:HelperSourcePoint;qualification:"body-and-captures-unverified"}
  | {kind:"callback-reference";origin:number;source:HelperSourcePoint;qualification:"callback-body-unverified"}
  | {kind:"record";fields:Array<[string,ContextConsumerValueShape]>;allocation?:{id:number;source:HelperSourcePoint}}
  | {kind:"array";items:ContextConsumerValueShape[];allocation?:{id:number;source:HelperSourcePoint}}
  | {kind:"jsx";tag:Extract<JsxValueShape,{kind:"jsx"}>["tag"]|{kind:"source-read";source:HelperSourcePoint};key:string|null;source:HelperSourcePoint;props:{kind:"record";fields:Array<[string,ContextConsumerValueShape]>}}
  | {kind:"callback";source:HelperSourcePoint;qualification:"callback-body-unverified";capturePhase:"render-return";
      captures:Array<{name:string;binding:HelperSourcePoint;value:ContextConsumerValueShape}>;
      dependencies:Array<{name:string;read:HelperSourcePoint;binding?:HelperSourcePoint}>};
export type ContextConsumerModelResult =
  | (Extract<TargetModelResult,{status:"refused"}> & {callbackCalls?:ContextConsumerCallbackCall[];refCalls?:ContextConsumerRefCall[];effectCalls?:ContextConsumerEffectCall[];factoryCalls?:ContextConsumerFactoryCall[];hookCalls?:ContextConsumerHookCall[]})
  | (Omit<Extract<TargetModelResult,{status:"modeled"}>,"input"|"output"|"deferred"> & {
      input:ContextConsumerValueShape;output:Extract<ContextConsumerValueShape,{kind:"jsx"}>;
      contextCalls:Array<{site:HelperSourcePoint;arguments:HelperValueShape[];value:number}>;
      callbackCalls:ContextConsumerCallbackCall[];
      refCalls:ContextConsumerRefCall[];
      effectCalls:ContextConsumerEffectCall[];
      factoryCalls:ContextConsumerFactoryCall[];
      hookCalls:ContextConsumerHookCall[];
      contextValues:Array<{id:number;fields:Array<[string,ContextConsumerValueShape]>}>;
      targetReads:Array<{site:HelperSourcePoint;read:HelperSourcePoint}>;
      contextFunctionCalls:Array<{source:HelperSourcePoint;site:HelperSourcePoint;arguments:ContextConsumerValueShape[];output:ContextConsumerValueShape}>;
      mutableBindings:Array<{binding:HelperSourcePoint;value:HelperValueShape}>;
    });
/** Separate source-only API; never accepted by the existing target runtime guard. */
export function modelReactContextConsumer(options:
  Omit<Parameters<typeof modelReactTargetRender>[0],"deferred"|"target"> & {
    contextCalls:ContextConsumerCallAssumption[];
    callbackCalls?:ContextConsumerCallbackAssumption[];
    refCalls?:ContextConsumerRefAssumption[];
    effectCalls?:ContextConsumerEffectAssumption[];
    factoryCalls?:ContextConsumerFactoryAssumption[];
    hookCalls?:ContextConsumerHookAssumption[];
    target(node:ts.Expression):Extract<ContextConsumerValueShape,{kind:"jsx"}>["tag"]|undefined;
  }):ContextConsumerModelResult;

export type ContextHelperModelInput=CompiledModelInput|{nativeContext:number};
export type ContextHelperNativeCall={site:HelperSourcePoint;receiver:'bare'|'default'|'namespace';context:number;value:HelperPrimitive|{contextValue:number;fields:Array<readonly [string,CompiledModelInput]>}};
export type ContextHelperModelResult=
 | {status:'refused';reason:string;steps:number;at?:HelperSourcePoint}
 | {status:'modeled';output:ContextConsumerValueShape|{kind:'native-context';context:number}|{kind:'argument';index:number}|{kind:'closure';name:string;read:number};returnSource:HelperSourcePoint|null;closureReads:number;nativeCalls:Array<{site:HelperSourcePoint;context:number}>;calls:Array<{source:HelperSourcePoint;site:HelperSourcePoint|null}>;writes:Extract<HelperModelResult,{status:'modeled'}>['writes'];decisions:Array<{source:HelperSourcePoint;kind:string;taken:boolean}>;steps:number};
export function modelReactContextHelper(options:{program:ts.Program;component:ts.FunctionDeclaration;source(node:ts.Node):HelperSourcePoint;arguments:CompiledModelInput[];closureSites:Array<{name:string;kind:'value'|'typeof';span:{start:number;end:number}}>;closureReads:Array<{read:number;value:ContextHelperModelInput}>;nativeCalls:ContextHelperNativeCall[]}):ContextHelperModelResult;
