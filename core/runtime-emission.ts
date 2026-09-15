import { walkAnatomy, type Contract } from "../scripts/contract-schema.js";
import { canonicalJson, revisionOf } from "./contract-provenance.js";

import type { RuntimeEmissionContext } from "../packages/core/src/runtime-emission.js";
export type {
  RuntimeArtifactForEmission,
  RuntimeProjectionBinding,
  RuntimeEmissionContext,
} from "../packages/core/src/runtime-emission.js";
const revision = /^sha256:[a-f0-9]{64}$/;
const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const reserved = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "ref",
  "key",
  "children",
  "dangerouslySetInnerHTML",
  "React",
  "OriginalElement",
  "OriginalElementType",
  "elementName",
  "registered",
  "placeSlot",
  "props",
  "sourceProps",
  "Number",
  "customElements",
  "Error",
  ..."await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(
    " ",
  ),
]);
function refuse(code: string): never {
  throw Error(`RUNTIME-EMISSION-${code}`);
}
const safeName = (name: unknown): name is string =>
  typeof name === "string" && identifier.test(name) && !reserved.has(name);
const safePath = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_./-]+$/.test(value) &&
  !value.startsWith("/") &&
  value.split("/").every((part) => !!part && part !== "." && part !== "..");

/** Deliberately finite syntax: no TypeScript evaluation or guessed aliases.
 * Complex source types remain in the original ref/API declaration but cannot
 * be projected as a differently typed Contract prop. */
function propertyTypeMatches(
  prop: Contract["props"][number],
  typeText: string,
): boolean {
  const pieces = typeText
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part !== "undefined");
  if (prop.type === "text")
    return pieces.length === 1 && pieces[0] === "string";
  if (prop.type === "number")
    return pieces.length === 1 && pieces[0] === "number";
  if (prop.type === "boolean")
    return (
      (pieces.length === 1 && pieces[0] === "boolean") ||
      canonicalJson([...pieces].sort()) === canonicalJson(["false", "true"])
    );
  if (typeof prop.type !== "object" || !("enum" in prop.type)) return false;
  const values: string[] = [];
  for (const piece of pieces) {
    if (!/^(?:"[^"\\]*"|'[^'\\]*')$/.test(piece)) return false;
    values.push(piece.slice(1, -1));
  }
  return (
    canonicalJson([...values].sort()) ===
    canonicalJson([...prop.type.enum].sort())
  );
}

/** Code/Figma location stamps and provenance are not rendering semantics. */
export function runtimeProjectionRevision(contract: Contract): string {
  const copy = structuredClone(contract);
  delete copy.provenance;
  delete copy.bindings.code.runtime;
  copy.bindings.code.anchors = { importPath: "", export: "" };
  copy.bindings.figma.anchors = { fileKey: null, componentSetKey: null };
  return revisionOf(copy);
}

export function resolveRuntimeEmission(
  contract: Contract,
  context?: RuntimeEmissionContext,
) {
  const reference = contract.bindings.code.runtime;
  if (!reference) refuse("REFERENCE-MISSING");
  if (!context) refuse("TRUSTED-CONTEXT-MISSING");
  const artifact = context.artifacts.get(reference.artifactRevision);
  const binding = context.bindings.get(reference.bindingRevision);
  if (!artifact || !binding) refuse("ARTIFACT-OR-BINDING-UNAVAILABLE");
  if (
    reference.version !== 1 ||
    reference.kind !== "custom-element" ||
    !revision.test(reference.artifactRevision) ||
    !revision.test(reference.interfaceRevision) ||
    !revision.test(reference.bindingRevision) ||
    artifact.artifactRevision !== reference.artifactRevision ||
    artifact.interfaceRevision !== reference.interfaceRevision ||
    revisionOf(artifact.interface) !== reference.interfaceRevision ||
    revisionOf(binding) !== reference.bindingRevision ||
    binding.version !== 1 ||
    binding.artifactRevision !== reference.artifactRevision ||
    binding.interfaceRevision !== reference.interfaceRevision
  )
    refuse("IDENTITY-MISMATCH");
  if (binding.contractRevision !== runtimeProjectionRevision(contract))
    refuse("UNQUALIFIED-CONTRACT-CHANGE");
  if (
    context.tokens === undefined ||
    !revision.test(binding.tokenRevision) ||
    revisionOf(context.tokens) !== binding.tokenRevision
  )
    refuse("UNQUALIFIED-TOKEN-CHANGE");
  const api = artifact.interface;
  if (
    canonicalJson(api.peerRuntime) !==
    canonicalJson({
      name: "react",
      major: 19,
      mounting: "direct-custom-element",
    })
  )
    refuse("ADAPTER-UNSUPPORTED");
  if (
    !safePath(api.module.path) ||
    !safePath(api.declaration.path) ||
    !/\.[cm]?js$/.test(api.module.path) ||
    !/\.d\.[cm]?ts$/.test(api.declaration.path) ||
    !safeName(api.module.exportName) ||
    !safeName(api.declaration.exportName) ||
    !/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(artifact.registrationTag) ||
    !Array.isArray(api.writableProperties) ||
    api.writableProperties.some((name) => !safeName(name)) ||
    new Set(api.writableProperties).size !== api.writableProperties.length ||
    !Array.isArray(api.properties) ||
    api.writableProperties.some(
      (name) =>
        api.properties.filter(
          (prop) =>
            prop.name === name &&
            prop.writable &&
            typeof prop.typeText === "string",
        ).length !== 1,
    ) ||
    !Array.isArray(api.slots) ||
    api.slots.some((slot) => typeof slot.name !== "string") ||
    new Set(api.slots.map((slot) => slot.name)).size !== api.slots.length ||
    !Array.isArray(artifact.stylesheets) ||
    artifact.stylesheets.some(
      (file) => !safePath(file) || !file.endsWith(".css"),
    )
  )
    refuse("INTERFACE-UNSAFE");
  if (!safeName(contract.name)) refuse("EXPORT-NAME-UNSAFE");
  if ((contract.events?.length ?? 0) > 0) refuse("DECLARED-EVENT-UNQUALIFIED");
  const seen = new Set<string>();
  for (const mapping of binding.properties) {
    const prop = contract.props.find(
      (prop) => prop.name === mapping.contractProp,
    );
    if (
      !prop ||
      !safeName(prop.bindings.code.prop) ||
      !api.writableProperties.includes(mapping.sourceProperty) ||
      seen.has(mapping.sourceProperty) ||
      binding.properties.filter((m) => m.contractProp === mapping.contractProp)
        .length !== 1
    )
      refuse("PROPERTY-MAPPING-INVALID");
    seen.add(mapping.sourceProperty);
    // Aliases need a proved translation; initially keep the exact original API.
    if (prop.bindings.code.prop !== mapping.sourceProperty)
      refuse("PROPERTY-ALIAS-UNQUALIFIED");
    if (
      !propertyTypeMatches(
        prop,
        api.properties.find((prop) => prop.name === mapping.sourceProperty)!
          .typeText,
      )
    )
      refuse("PROPERTY-TYPE-MISMATCH");
    if (prop.default !== undefined) refuse("DECLARED-DEFAULT-UNQUALIFIED");
  }
  if (
    contract.props.some(
      (prop) => !binding.properties.some((m) => m.contractProp === prop.name),
    )
  )
    refuse("PROPERTY-UNMAPPED");
  const slots = walkAnatomy(contract).flatMap(({ part }) =>
    part.slot ? [part.slot] : [],
  );
  if (
    slots.some(
      (slot) =>
        slot.required !== undefined ||
        slot.min !== undefined ||
        slot.max !== undefined ||
        slot.accepts !== undefined ||
        slot.acceptsMode !== undefined ||
        slot.defaultContent !== undefined,
    )
  )
    refuse("SLOT-CONSTRAINT-UNQUALIFIED");
  if (
    slots.some(
      (slot) =>
        binding.slots.filter((m) => m.contractSlot === slot.name).length !== 1,
    ) ||
    binding.slots.some(
      (mapping) =>
        !slots.some((slot) => slot.name === mapping.contractSlot) ||
        !api.slots.some((slot) => slot.name === mapping.sourceSlot),
    ) ||
    new Set(binding.slots.map((mapping) => mapping.sourceSlot)).size !==
      binding.slots.length
  )
    refuse("SLOT-MAPPING-INVALID");
  const named = binding.slots.filter((mapping) => mapping.sourceSlot !== "");
  if (
    named.some(
      (mapping) =>
        !safeName(mapping.contractSlot) ||
        api.writableProperties.includes(mapping.contractSlot),
    ) ||
    binding.slots.some(
      (mapping) =>
        mapping.sourceSlot === "" && mapping.contractSlot !== "children",
    )
  )
    refuse("SLOT-ALIAS-UNSAFE");
  return { artifact, binding, namedSlots: named };
}

/** The existing React emitter calls this lowering only with an explicit
 * retained-runtime contract reference. Original runtime behavior is not
 * reconstructed from captured DOM or guessed from a visual archetype. */
export function emitRuntimeReact(
  contract: Contract,
  context?: RuntimeEmissionContext,
): { tsx: string; css: string } {
  const { artifact, namedSlots } = resolveRuntimeEmission(contract, context);
  const prefix = `./runtime/${artifact.artifactRevision.slice(7)}/`;
  const module = prefix + artifact.interface.module.path;
  const declaration =
    prefix +
    artifact.interface.declaration.path.replace(/\.d\.([cm]?)ts$/, ".$1js");
  const members =
    artifact.interface.writableProperties
      .map((name) => JSON.stringify(name))
      .join(" | ") || "never";
  const required = contract.props
    .filter((prop) => prop.required)
    .map((prop) => prop.bindings.code.prop);
  const namedKeys = namedSlots.map((slot) => JSON.stringify(slot.contractSlot));
  const excluded = [
    ...artifact.interface.writableProperties,
    ...namedSlots.map((slot) => slot.contractSlot),
    "children",
    "dangerouslySetInnerHTML",
  ];
  const imports = artifact.stylesheets
    .map((file) => `import ${JSON.stringify(prefix + file)};`)
    .join("\n");
  // Registration happens at module load before React creates the element.
  // The prepared runtime entry separately enforces source import preconditions.
  const tsx = `/** GENERATED retained original runtime. React 19 direct-element adapter.
 * Artifact ${artifact.artifactRevision}; interface ${artifact.interfaceRevision}.
 * Full source property types remain in the original declaration dependency.
 */
import * as React from 'react';
import { ${artifact.interface.module.exportName} as OriginalElement } from ${JSON.stringify(module)};
import type { ${artifact.interface.declaration.exportName} as OriginalElementType } from ${JSON.stringify(declaration)};
${imports}
const elementName = ${JSON.stringify(artifact.registrationTag)};
if (Number(React.version.split('.')[0]) !== 19) throw new Error('RUNTIME-EMISSION-REACT-VERSION');
if (typeof customElements === 'undefined') throw new Error('RUNTIME-EMISSION-BROWSER-REQUIRED');
const registered = customElements.get(elementName);
if (registered && registered !== OriginalElement) throw new Error('RUNTIME-EMISSION-REGISTRATION-COLLISION');
if (!registered) customElements.define(elementName, OriginalElement);
export type ${contract.name}Props = Omit<React.HTMLAttributes<OriginalElementType>, ${excluded.map((key) => JSON.stringify(key)).join(" | ")}> &
  Partial<Pick<OriginalElementType, ${members}>> & { [K in ${required.map((name) => JSON.stringify(name)).join(" | ") || "never"}]-?: Exclude<OriginalElementType[K], undefined> } & {
    children?: React.ReactNode;
    ref?: React.Ref<OriginalElementType>;
${namedKeys.map((key) => `    ${key}?: React.ReactElement<{slot?:string}, string> | readonly React.ReactElement<{slot?:string}, string>[] | null | false;`).join("\n")}
  };
${
  namedSlots.length
    ? `function placeSlot(value: React.ReactNode, name: string): React.ReactNode {
  return React.Children.map(value, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return null;
    if (React.isValidElement(child)) {
      if (child.type === React.Fragment || typeof child.type !== 'string') throw new Error('RUNTIME-EMISSION-SLOTTED-ELEMENT-UNSUPPORTED');
      const existing = (child.props as {slot?:unknown}).slot;
      if (existing !== undefined && existing !== name) throw new Error('RUNTIME-EMISSION-SLOT-CONFLICT');
      return React.cloneElement(child as React.ReactElement<{slot?:string}>, {slot:name});
    }
    throw new Error('RUNTIME-EMISSION-SLOTTED-ELEMENT-UNSUPPORTED');
  });
}`
    : ""
}
export function ${contract.name}(props: ${contract.name}Props) {
${required.map((name) => `  if (props[${JSON.stringify(name)}] === undefined) throw new Error('RUNTIME-EMISSION-REQUIRED-PROPERTY');`).join("\n")}
  const { children${namedSlots.map((slot) => `, ${slot.contractSlot}`).join("")}, ...sourceProps } = props;
  return React.createElement(elementName, sourceProps,
${namedSlots.map((slot) => `    placeSlot(${slot.contractSlot}, ${JSON.stringify(slot.sourceSlot)}),`).join("\n")}
    children);
}
`;
  return {
    tsx,
    css: "/* Original runtime styles are imported with their verified artifact. */\n",
  };
}
