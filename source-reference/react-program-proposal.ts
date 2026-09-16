import { createHash } from "node:crypto";
import {
  proposeFromCode,
  type ProposeCodeResult,
} from "../core/propose-code.js";
import type { SourceFileInput } from "../core/extract-react-tsx.js";
import type { ExtractedProp } from "../extract/types.js";
import type {
  ReactSourceProgram,
  ReactTypeFact,
} from "./react-source-program.js";

export interface ReactProgramProposal {
  status: "incomplete";
  acceptedContract: null;
  result: ProposeCodeResult;
  components: {
    name: string;
    module: string;
    carried: string[];
    platform: string[];
    unsupported: { name: string; type: string; reason: string }[];
    problems: string[];
  }[];
  problems: string[];
}

/** Explicit boundary for the initial source-backed API projection. Platform
 * forwarding remains recorded separately; inherited DOM APIs are not hundreds
 * of Figma axes. Stateful native HTML props are admitted as typed candidates,
 * never evidence that an observed appearance responds to them. */
const reservedProps = new Set([
  "children",
  "className",
  "style",
  "ref",
  "key",
  "id",
]);
const stateProps = new Set(["disabled", "required", "readOnly"]);
function kind(
  type: ReactTypeFact,
): Pick<ExtractedProp, "kind" | "values" | "codeValues"> | undefined {
  const members =
    type.kind === "union"
      ? type.members.filter((t) => t.kind !== "undefined")
      : [type];
  if (
    members.length === 1 &&
    ["string", "number", "boolean", "function"].includes(members[0].kind)
  )
    return {
      kind:
        members[0].kind === "function"
          ? "event"
          : (members[0].kind as "string" | "number" | "boolean"),
    };
  if (
    members.length &&
    members.every((t) => t.kind === "literal" && typeof t.value === "string")
  )
    return {
      kind: "enum",
      values: members.map((t) => (t as { value: string }).value),
    };
  // A literal true-only or false-only API is not the full boolean domain.
  if (
    members.length === 2 &&
    members.every(
      (t) => t.kind === "literal" && typeof t.value === "boolean",
    ) &&
    new Set(members.map((t) => (t as { value: boolean }).value)).size === 2
  )
    return { kind: "boolean" };
  if (
    members.length &&
    members.every((t) => t.kind === "literal" || t.kind === "null")
  ) {
    const entries: [string, string | number | boolean | null][] = [];
    const reserved = new Set(
      members.flatMap((t) =>
        t.kind === "literal" && typeof t.value === "string" ? [t.value] : [],
      ),
    );
    const used = new Set<string>();
    for (const member of members) {
      const value = member.kind === "literal" ? member.value : null;
      const base =
        typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(value)
          ? value
          : value === null
            ? "null"
            : `${typeof value}-${String(value).replace(/[^a-zA-Z0-9-]/g, "-")}`;
      let key = base,
        suffix = 1;
      while (used.has(key) || (typeof value !== "string" && reserved.has(key)))
        key = `${base}-${suffix++}`;
      used.add(key);
      entries.push([key, value]);
    }
    return {
      kind: "enum",
      values: entries.map(([k]) => k),
      codeValues: Object.fromEntries(entries),
    };
  }
  return undefined;
}

/** Connect verified installed-program facts to the existing pure proposer.
 * Every source text is hash-checked; unresolved APIs are never silently replaced
 * with the syntactic reader's guesses. This is an incomplete proposal, not a
 * conversion admission: root/component correspondence, styles and native
 * property effects still require observation and verification. */
export function proposeReactSourceProgram(
  program: ReactSourceProgram,
  sources: SourceFileInput[],
  prefix = "react-v1",
): ReactProgramProposal {
  const out: ReactProgramProposal = {
    status: "incomplete",
    acceptedContract: null,
    result: { proposals: [], skipped: [] },
    components: [],
    problems: [...program.problems],
  };
  if (program.problems.length) return out;
  for (const component of program.components)
    if (!sources.some((s) => s.sourcePath === component.module))
      out.problems.push(`source-module-missing:${component.module}`);
  const inputs: SourceFileInput[] = [];
  const seen = new Set<string>();
  for (const input of sources) {
    const components = program.components.filter(
      (c) => c.module === input.sourcePath,
    );
    if (!components.length) {
      out.problems.push(`source-module-not-observed:${input.sourcePath}`);
      continue;
    }
    const hash = createHash("sha256").update(input.source).digest("hex");
    if (components.some((c) => c.sourceSha256 !== hash)) {
      out.problems.push(`source-module-changed:${input.sourcePath}`);
      continue;
    }
    const resolvedComponents: NonNullable<
      SourceFileInput["resolvedComponents"]
    > = {};
    for (const component of components) {
      if (seen.has(component.name)) {
        out.problems.push(`duplicate-component-name:${component.name}`);
        continue;
      }
      seen.add(component.name);
      const row: ReactProgramProposal["components"][number] = {
        name: component.name,
        module: component.module,
        carried: [],
        platform: [],
        unsupported: [],
        problems: component.problems.filter(
          (p) => !p.startsWith("unresolved-prop-type:"),
        ),
      };
      out.components.push(row);
      const props: ExtractedProp[] = [];
      for (const prop of component.props) {
        const platform =
          prop.declaredIn.length > 0 &&
          prop.declaredIn.every((d) =>
            /(?:^|\/)node_modules\/@types\/react\//.test(d.file),
          );
        if (
          reservedProps.has(prop.name) ||
          (platform && !stateProps.has(prop.name))
        ) {
          row.platform.push(prop.name);
          continue;
        }
        const classified = kind(prop.type);
        const value = component.defaults[prop.name];
        const explicitUndefined =
          !prop.optional &&
          prop.type.kind === "union" &&
          prop.type.members.some((t) => t.kind === "undefined");
        const unboundCallback =
          classified?.kind === "event" && !/^on[A-Z]/.test(prop.name);
        if (
          !classified ||
          (value === null && !classified?.codeValues) ||
          explicitUndefined ||
          unboundCallback
        ) {
          row.unsupported.push({
            name: prop.name,
            type: prop.type.text,
            reason:
              value === null
                ? "null-default-not-representable"
                : explicitUndefined
                  ? "required-undefined-not-representable"
                  : unboundCallback
                    ? "function-not-an-event"
                    : "type-not-representable",
          });
          props.push({
            name: prop.name,
            kind: "other",
            optional: prop.optional,
            confidence: "declared",
          });
          continue;
        }
        row.carried.push(prop.name);
        props.push({
          name: prop.name,
          ...classified,
          optional: prop.optional,
          confidence: "declared",
          ...(value !== undefined
            ? {
                default: classified.codeValues
                  ? Object.keys(classified.codeValues).find((key) =>
                      Object.is(classified.codeValues![key], value),
                    )
                  : (value as string | number | boolean),
              }
            : {}),
        });
      }
      if (component.root.kind !== "host")
        row.problems.push("root-correspondence-unverified");
      if (component.componentReferences.length)
        row.problems.push("nested-component-correspondence-unverified");
      const notes = [
        "API facts read from the installed TypeScript program; original declaration types remain in the source record.",
        ...row.unsupported.map(
          (p) =>
            `prop \`${p.name}\`: ${p.reason}: ${p.type}; NOT carried into the proposed contract`,
        ),
        ...row.problems,
        ...(row.platform.length
          ? [
              `Platform-forwarded properties are outside this native API proposal: ${row.platform.join(", ")}. Their effects and content mappings remain unqualified.`,
            ]
          : []),
      ];
      resolvedComponents[component.name] = { props, notes };
    }
    inputs.push({ ...input, resolvedComponents });
  }
  if (out.problems.length) return out;
  out.result = proposeFromCode(inputs, {
    tokens: [],
    prefix,
    preserveSourceApi: true,
  });
  out.problems.push(
    "rendered-anatomy-and-token-correspondence-unverified",
    "native-projection-unverified",
  );
  return out;
}
