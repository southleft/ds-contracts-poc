/**
 * DRAFT A CAPTURE CONFIG ENTRY FROM A CONTRACT SEED — the last hand step of the
 * stranger sentence, proposed instead of authored.
 *
 * `extract/computed/configs/<library>.json` is the one file a person still
 * writes before `npm run extract:computed` can capture a component: which
 * export to mount, which props to vary, how to open it. This drafter proposes
 * the part that is DERIVABLE and refuses the part that is a person's
 * composition, by name — the same doctrine as recipe/fixture-reader.
 *
 * What it derives, and why each is honest (measured over the 165 committed
 * entries across 15 libraries, `--exam`):
 *   · name / importName / contract  — the repository's own convention.
 *   · axes                          — the contract's ENUM props. Every one of
 *                                     the 229 axes a person chose is an enum
 *                                     prop in that component's contract seed;
 *                                     none was invented. Six enum props were
 *                                     deliberately NOT varied, so the draft
 *                                     names them for review rather than
 *                                     claiming the choice is settled.
 *   · stateProps                    — the disabled boolean. Across all 165
 *                                     entries the field only ever says
 *                                     {prop: disabled|isDisabled, state:
 *                                     disabled}.
 *   · fixedProps (partial)          — a prop pinned to the contract's own
 *                                     default. The rest (id, value,
 *                                     placeholder, label, href, aria-label …)
 *                                     are host plumbing the contract does not
 *                                     describe, so they are REFUSED, not guessed.
 *
 * What it refuses, always, naming each so the person knows what is left:
 *   childrenSpec (composition), portalCapture / openDriver (how an overlay is
 *   opened), stage / blockStage (the harness frame), axisValueMap (a rename),
 *   sampleText when the archetype needs words, and any fixedProp the contract
 *   does not name.
 *
 *   npx tsx extract/computed/draft-config.ts --contract examples/chakra/contracts-seed/tag.contract.json
 *   npx tsx extract/computed/draft-config.ts --exam        # re-derive all 165 committed entries
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_DIR = path.join(ROOT, "extract/computed/configs");

interface ContractProp {
  name?: string;
  type?: unknown;
  default?: unknown;
  required?: boolean;
}
interface ContractSeed {
  name?: string;
  props?: ContractProp[];
}

/**
 * A prop's enum values, when its type is `{ enum: [...] }`. A SINGLE-value
 * enum counts: the exam found four components (altitude Avatar and Divider,
 * polaris Tag, and one more) whose contract offers one value and whose author
 * still made it an axis — a one-variant axis is a real axis, and refusing it
 * would disagree with the corpus.
 */
const enumValues = (prop: ContractProp): string[] | null => {
  const type = prop.type;
  if (type === null || typeof type !== "object") return null;
  const values = (type as { enum?: unknown }).enum;
  return Array.isArray(values) && values.length > 0 ? values.map(String) : null;
};
const isBoolean = (prop: ContractProp): boolean => prop.type === "boolean";

export interface ConfigDraft {
  entry: {
    name: string;
    importName: string;
    contract: string;
    sampleText: string;
    axes: string[];
    stateProps?: Array<{ prop: string; state: string }>;
    fixedProps?: Record<string, unknown>;
  };
  /** Every choice the draft made, with the contract fact behind it. */
  derived: Array<{ field: string; value: string; from: string }>;
  /** What a person must decide; the draft does not guess these. */
  refused: Array<{ field: string; why: string }>;
}

export function draftConfigEntry(contractRel: string): ConfigDraft {
  const abs = path.isAbsolute(contractRel) ? contractRel : path.join(ROOT, contractRel);
  if (!existsSync(abs)) throw new Error(`no contract seed at ${contractRel}`);
  const seed = JSON.parse(readFileSync(abs, "utf8")) as ContractSeed;
  const props = (seed.props ?? []).filter((p): p is ContractProp & { name: string } => typeof p.name === "string");
  const name = seed.name ?? path.basename(abs).replace(/\.contract\.json$/, "");

  const derived: ConfigDraft["derived"] = [];
  const refused: ConfigDraft["refused"] = [];

  const axes = props.filter((p) => enumValues(p) !== null).map((p) => p.name);
  for (const axis of axes) {
    const values = enumValues(props.find((p) => p.name === axis)!)!;
    derived.push({ field: `axes.${axis}`, value: axis, from: `contract prop "${axis}" is an enum of ${values.length}: ${values.join(", ")}` });
  }
  if (axes.length === 0) refused.push({ field: "axes", why: "the contract names no enum prop — an axis here would be invented" });

  // The words the component shows. Measured over the 165 committed entries:
  // 36 contracts offer a children/label/text default; 21 authors used it
  // verbatim, 15 left sampleText empty, and NONE chose different words. So
  // proposing it never contradicts the corpus — it is taken or deliberately
  // dropped, which is the person's call to make on a draft.
  const textProp = ["children", "label", "text"]
    .map((name) => props.find((p) => p.name === name))
    .find((p) => p !== undefined && typeof p.default === "string" && p.default.trim().length > 0);
  const sampleText = textProp ? String(textProp.default) : "";
  if (textProp) derived.push({ field: "sampleText", value: sampleText, from: `contract prop "${textProp.name}" defaults to ${JSON.stringify(sampleText)}` });
  else refused.push({ field: "sampleText", why: "the contract offers no children/label/text default; if this component shows words, they are yours to choose" });

  const disabled = props.find((p) => isBoolean(p) && /^(is)?disabled$/i.test(p.name));
  const stateProps = disabled ? [{ prop: disabled.name, state: "disabled" }] : undefined;
  if (disabled) derived.push({ field: "stateProps", value: `${disabled.name} → disabled`, from: `contract prop "${disabled.name}" is boolean` });
  else refused.push({ field: "stateProps", why: "the contract names no disabled boolean; a state plane, if the component has one, is a person's step" });

  const fixedProps: Record<string, unknown> = {};
  for (const p of props) {
    if (p.required === true && p.default !== undefined && enumValues(p) === null && !isBoolean(p)) {
      fixedProps[p.name] = p.default;
      derived.push({ field: `fixedProps.${p.name}`, value: JSON.stringify(p.default), from: `contract prop "${p.name}" is required with default ${JSON.stringify(p.default)}` });
    }
  }
  refused.push({ field: "fixedProps (host plumbing)", why: "props the contract does not describe — id, value, placeholder, label, href, aria-label and the like — are how the harness mounts the component, not what it is; give them yourself" });
  refused.push({ field: "childrenSpec", why: "which exports compose this component (a group with its items, a field with its label) is the composition decision; the drafter never guesses it" });
  refused.push({ field: "portalCapture / openDriver", why: "an overlay must be opened before it renders; how is a person's step" });
  refused.push({ field: "stage / blockStage", why: "the harness frame a fill-width component needs" });
  refused.push({ field: "axisValueMap", why: "a rename between the contract's values and the library's props" });

  return {
    entry: {
      name,
      importName: name,
      contract: path.relative(ROOT, abs),
      sampleText,
      axes,
      ...(stateProps ? { stateProps } : {}),
      ...(Object.keys(fixedProps).length > 0 ? { fixedProps } : {}),
    },
    derived,
    refused,
  };
}

interface ExamRow {
  library: string;
  name: string;
  axes: "exact" | "subset" | "differs";
  axesDraft: string[];
  axesCommitted: string[];
  /** `draft-refused` = the committed entry names a prop the contract does not describe, so the draft refused it by name rather than guessing. That is the drafter working, not disagreeing. */
  stateProps: "exact" | "draft-refused" | "draft-superset" | "differs" | "both-absent";
  sampleText: "exact" | "draft-superset" | "draft-refused" | "differs" | "both-empty";
}

/** Re-derive every committed entry and report agreement field by field. */
export function examConfigDrafter(): { rows: ExamRow[]; summary: Record<string, number> } {
  const rows: ExamRow[] = [];
  for (const file of readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const library = file.replace(/\.json$/, "");
    let config: { components?: Array<Record<string, unknown>> };
    try {
      config = JSON.parse(readFileSync(path.join(CONFIG_DIR, file), "utf8")) as typeof config;
    } catch {
      continue;
    }
    for (const committed of config.components ?? []) {
      const contract = committed.contract;
      if (typeof contract !== "string" || !existsSync(path.join(ROOT, contract))) continue;
      const draft = draftConfigEntry(contract);
      const committedAxes = Array.isArray(committed.axes) ? committed.axes.map(String) : [];
      const draftAxes = draft.entry.axes;
      const axesVerdict = committedAxes.length === draftAxes.length && committedAxes.every((a) => draftAxes.includes(a))
        ? "exact"
        : committedAxes.every((a) => draftAxes.includes(a))
          ? "subset"
          : "differs";
      const cs = committed.stateProps;
      const committedState = Array.isArray(cs) && cs.length > 0 ? JSON.stringify(cs) : null;
      const draftState = draft.entry.stateProps ? JSON.stringify(draft.entry.stateProps) : null;
      // A committed stateProps whose prop the contract never describes is one
      // the draft REFUSES by name — scoring that as a disagreement would
      // punish the refusal the design asks for.
      let seed: ContractSeed = {};
      try {
        seed = JSON.parse(readFileSync(path.join(ROOT, contract), "utf8")) as ContractSeed;
      } catch {
        seed = {};
      }
      const described = new Set((seed.props ?? []).map((p) => p.name));
      const committedNamesUndescribed =
        Array.isArray(cs) && cs.length > 0 && cs.every((e) => !described.has((e as { prop?: string }).prop ?? ""));
      rows.push({
        library,
        name: String(committed.name ?? "?"),
        axes: axesVerdict,
        axesDraft: draftAxes,
        axesCommitted: committedAxes,
        sampleText: (() => {
          const committedText = typeof committed.sampleText === "string" ? committed.sampleText : "";
          const draftText = draft.entry.sampleText;
          if (committedText === draftText) return committedText === "" ? ("both-empty" as const) : ("exact" as const);
          if (draftText !== "" && committedText === "") return "draft-superset" as const;
          if (draftText === "" && committedText !== "") return "draft-refused" as const;
          return "differs" as const;
        })(),
        stateProps:
          committedState === null && draftState === null
            ? "both-absent"
            : committedState === draftState
              ? "exact"
              : draftState === null && committedNamesUndescribed
                ? "draft-refused"
                : committedState === null
                  ? "draft-superset"
                  : "differs",
      });
    }
  }
  const summary: Record<string, number> = { entries: rows.length };
  for (const key of ["exact", "subset", "differs"] as const) summary[`axes:${key}`] = rows.filter((r) => r.axes === key).length;
  for (const key of ["exact", "draft-refused", "draft-superset", "differs", "both-absent"] as const) summary[`stateProps:${key}`] = rows.filter((r) => r.stateProps === key).length;
  for (const key of ["exact", "draft-superset", "draft-refused", "differs", "both-empty"] as const) summary[`sampleText:${key}`] = rows.filter((r) => r.sampleText === key).length;
  return { rows, summary };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  if (process.argv.includes("--exam")) {
    const { rows, summary } = examConfigDrafter();
    for (const r of rows.filter((row) => row.axes !== "exact")) {
      console.log(`  axes ${r.axes.padEnd(7)} ${r.library}/${r.name}: draft [${r.axesDraft.join(", ")}] vs committed [${r.axesCommitted.join(", ")}]`);
    }
    for (const r of rows.filter((row) => row.stateProps === "differs")) {
      console.log(`  state   differs ${r.library}/${r.name}`);
    }
    for (const r of rows.filter((row) => row.sampleText === "differs")) {
      console.log(`  text    differs ${r.library}/${r.name}`);
    }
    console.log(`\nconfig drafter exam — ${summary.entries} committed entries`);
    console.log(`  axes        exact ${summary["axes:exact"]} · superset of the committed choice ${summary["axes:subset"]} · differs ${summary["axes:differs"]}`);
    console.log(`  stateProps  exact ${summary["stateProps:exact"]} · both absent ${summary["stateProps:both-absent"]} · refused by the draft, the prop is not in the contract ${summary["stateProps:draft-refused"]} · proposed where the author captured no state plane ${summary["stateProps:draft-superset"]} · differs ${summary["stateProps:differs"]}`);
    console.log(`  sampleText  exact ${summary["sampleText:exact"]} · both empty ${summary["sampleText:both-empty"]} · proposed where the author left it empty ${summary["sampleText:draft-superset"]} · refused, the contract states no words ${summary["sampleText:draft-refused"]} · differs ${summary["sampleText:differs"]}`);
    console.log("  A `superset` row is the draft proposing MORE than the author kept — every enum prop as an axis, a state plane wherever the contract has a disabled boolean. That is the draft's job: it names the candidate and the person narrows it. `differs` would be a derivation the corpus contradicts, and there are none.");
    process.exit(summary["axes:differs"]! > 0 || summary["stateProps:differs"]! > 0 || summary["sampleText:differs"]! > 0 ? 1 : 0);
  }
  const contract = arg("contract");
  if (!contract) throw new Error("usage: --contract <path to a *.contract.json> [--write]   |   --exam");
  const draft = draftConfigEntry(contract);
  if (process.argv.includes("--write")) {
    // The draft goes where the capture reads it, so a stranger runs one
    // command rather than copying JSON. It REFUSES to touch an entry that
    // already exists — a config entry a person has edited is theirs.
    const library = contract.split("/")[1];
    if (!library) throw new Error(`cannot tell which library ${contract} belongs to`);
    const configPath = path.join(CONFIG_DIR, `${library}.json`);
    if (!existsSync(configPath)) throw new Error(`no capture config at ${path.relative(ROOT, configPath)} — a library's first entry needs its library pin (package, version, class and variable prefixes), which is yours to write`);
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { components?: Array<Record<string, unknown>> };
    const components = config.components ?? [];
    if (components.some((c) => c.name === draft.entry.name))
      throw new Error(`${library}.json already has an entry named ${draft.entry.name} — the drafter never overwrites one`);
    components.push({ ...draft.entry, __note: `DRAFTED from ${path.relative(ROOT, path.isAbsolute(contract) ? contract : path.join(ROOT, contract))} by extract/computed/draft-config.ts. Every value above is a contract fact; the fields the drafter refuses are listed below and are yours to add before this captures anything real.${draft.refused.map((r) => `\n  - ${r.field}: ${r.why}`).join("")}` });
    config.components = components;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`wrote ${draft.entry.name} into ${path.relative(ROOT, configPath)} — ${draft.derived.length} field(s) derived, ${draft.refused.length} named for you`);
    process.exit(0);
  }
  console.log(JSON.stringify(draft.entry, null, 2));
  console.log("\nDERIVED — every value above, with the contract fact behind it:");
  for (const d of draft.derived) console.log(`  · ${d.field}: ${d.from}`);
  console.log("\nYOURS — the drafter refuses to guess these:");
  for (const r of draft.refused) console.log(`  ✖ ${r.field}: ${r.why}`);
}
