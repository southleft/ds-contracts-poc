import { createHash } from "node:crypto";
import {
  readLitTemplateBindings,
  type LitNode,
} from "../extract/adapters/lit-template.js";
import {
  loadRecordedSourceProgram,
  type RecordedSourceInput,
} from "./source-program.js";

/** Source syntax, not a DOM join or permission to generate. Kept separate from
 * the acceptance planner so a readable expression cannot satisfy its gates. */
export interface SourceBindingInventory {
  version: 1;
  status: "partial" | "refused";
  acceptedContract: null;
  tagName: string;
  sourceProgramSha256: string;
  entry: { path: string; sha256?: string; className: string };
  modules: Array<{ path: string; sha256: string }>;
  classes: Array<{
    modulePath: string;
    name: string;
    extends?: string;
    publicMembers: string[];
  }>;
  templates: Array<{
    id: string;
    line: number;
    role: string;
    syntaxComplete: boolean;
    unresolvedAncestorTemplateIds?: string[];
    guards: Array<{ expression: string; when: "truthy" | "falsy" }>;
    guardAlternatives?: Array<
      Array<{ expression: string; when: "truthy" | "falsy" }>
    >;
    roots: string[];
    slots: string[];
  }>;
  bindings: Array<{
    templateId: string;
    sourceNodeId: string;
    tag: string;
    channel: string;
    target: string;
    expression: string;
    syntaxKind: string;
    line: number;
  }>;
  problems: string[];
  limitations: string[];
  digest: string;
}

export function inspectRecordedSourceBindings(
  input: RecordedSourceInput & { tagName: string },
): SourceBindingInventory {
  const program = loadRecordedSourceProgram(input);
  const entry = program.modules.find(
    (module) => module.path === program.entryPath,
  );
  const result: SourceBindingInventory = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    tagName: input.tagName,
    sourceProgramSha256: program.digest,
    entry: {
      path: program.entryPath,
      sha256: entry?.sha256,
      className: input.className,
    },
    modules: program.modules.map(({ path, sha256 }) => ({ path, sha256 })),
    classes: [],
    templates: [],
    bindings: [],
    problems: program.problems.map(
      ({ code, path }) => `${code}${path ? `:${path}` : ""}`,
    ),
    limitations: [
      ...program.limitations,
      "Source syntax is not a qualified binding: no expression is executed and no source span is joined to a rendered part here.",
      "Class declarations in the local import graph are not a resolved inheritance chain or complete public API.",
      "No lifecycle, event, form, conditional-render or CSS behavior is carried to React or Figma by this inventory.",
    ],
    digest: "",
  };
  if (program.status !== "refused" && entry) {
    const syntax = readLitTemplateBindings({
      source: entry.text,
      sourceSha256: entry.sha256,
      modulePath: entry.path,
      className: input.className,
    });
    result.problems.push(
      ...syntax.problems.map(
        ({ code, span }) => `${code}${span ? `:line-${span.line}` : ""}`,
      ),
    );
    result.limitations.push(...syntax.limitations);
    if (syntax.status !== "refused") {
      result.status = "partial";
      result.classes = program.modules.flatMap((module) =>
        module.classes.map((cls) => ({
          modulePath: module.path,
          name: cls.name,
          extends: cls.extends,
          publicMembers: cls.members
            .filter(
              (member) => member.visibility === "public" && !member.static,
            )
            .map((member) => member.name),
        })),
      );
      for (const template of syntax.templates) {
        const slots: string[] = [];
        const visit = (node: LitNode) => {
          if (node.kind !== "element") return;
          if (node.slot) slots.push(node.slot.name);
          for (const attribute of node.attributes)
            for (const part of attribute.parts) {
              if (part.kind !== "expression") continue;
              result.bindings.push({
                templateId: template.id,
                sourceNodeId: node.id,
                tag: node.tag,
                channel: attribute.channel,
                target: attribute.name,
                expression: part.expression.raw,
                syntaxKind: part.expression.kind,
                line: part.expression.span.line,
              });
            }
          node.children.forEach(visit);
        };
        template.roots.forEach(visit);
        result.templates.push({
          id: template.id,
          line: template.span.line,
          role: template.role,
          syntaxComplete: template.complete,
          unresolvedAncestorTemplateIds: template.unresolvedAncestorTemplateIds,
          guards: template.guards.map(({ expression, when }) => ({
            expression: expression.raw,
            when,
          })),
          guardAlternatives: template.guardAlternatives?.map((guards) =>
            guards.map(({ expression, when }) => ({
              expression: expression.raw,
              when,
            })),
          ),
          roots: template.roots.flatMap((node) =>
            node.kind === "element" ? [node.tag] : [],
          ),
          slots,
        });
      }
    }
  }
  result.digest = createHash("sha256")
    .update(JSON.stringify({ ...result, digest: undefined }))
    .digest("hex");
  return result;
}
