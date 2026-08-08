/**
 * Brownfield extraction CLI.
 *
 *   npm run extract:code  [-- path/to/extract.config.json]
 *     → <out>/code-extraction.json      raw extraction (adapter output)
 *     → <out>/contracts/*.contract.json ContractSchema-valid PROPOSALS
 *     → <out>/proposals.md              per-component inference/skip notes
 *
 *   npm run reconcile     [-- path/to/extract.config.json]
 *     → <out>/reconciliation.{md,json}  the disagreement report
 *
 * With no config file, defaults run against THIS repo's own library and
 * parity snapshot — a fresh clone can watch the whole loop work before
 * pointing it at their system (see docs/13).
 */
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { loadConfig, outDir, idPrefix } from "./config.js";
import {
  extractReactTsx,
  type SkippedComponent,
} from "./adapters/react-tsx.js";
import { extractCem } from "./adapters/cem.js";
import { proposeContract, proposalsReport } from "./propose.js";
import { loadDesign, reconcile, writeReconciliation } from "./reconcile.js";
import type { ExtractedComponent } from "./types.js";
import { promoteStaticCandidate } from "./static-promotion.js";
import type { ProvenancedContract } from "../core/contract-provenance.js";
/** The extraction run as a FUNCTION (Phase 1): the ds-contracts CLI's
 *  `extract` verb and `npm run extract:code` / `npm run reconcile` share this
 *  one code path. Throws on refusals (both shells surface the message). */
export function runExtractCommand(
  command: string,
  configArg?: string,
  options: {
    canonicalDir?: string;
    acknowledgeUnprovenancedMismatch?: boolean;
  } = {},
): void {
  const { config, from } = loadConfig(configArg);
  const out = outDir(config);

  const skipped: SkippedComponent[] = [];
  function runExtract(): ExtractedComponent[] {
    if (config.code.adapter === "react-tsx") {
      if (!config.code.root)
        throw new Error("react-tsx adapter needs code.root");
      return extractReactTsx(config.code.root, skipped, {
        tokenFiles: config.tokens,
      });
    }
    if (!config.code.manifest)
      throw new Error("cem adapter needs code.manifest");
    return extractCem(config.code.manifest, skipped);
  }

  if (command === "code") {
    console.log(`Config: ${from}`);
    const extracted = runExtract();
    if (extracted.length === 0) {
      // The adapter refuses BY NAME when it opened no file at all (see the
      // zero-candidate refusal in adapters/react-tsx.ts). Reaching here means
      // files WERE opened and every component in them was skipped — so the
      // skip ledger is the diagnosis, and dropping it (as this message used
      // to) leaves the same nothing-named silence one layer up: proposals.md,
      // which normally carries the ledger, is never written on this path.
      throw new Error(
        "No components found — check code.root / code.manifest and that props are visible in source." +
          (skipped.length > 0
            ? `\n${skipped.length} component(s) were SEEN and skipped by name:\n` +
              skipped.map((s) => `  · ${s.name} (${s.source}): ${s.reason}`).join("\n")
            : "\nThe walker opened source files but found no exported PascalCase component in any of them — nothing was skipped by name, so there is no component-level ledger to show."),
      );
    }
    // A normal extraction writes PROPOSALS and must remain repeatable over its
    // own prior output. Stale-source protection activates only at an explicit
    // canonical promotion boundary (`--canonical <adopted-contracts>`); using
    // out/contracts implicitly would treat yesterday's proposals as adopted
    // truth and make a second extraction refuse itself.
    const results = extracted.map((component) => ({
      component,
      proposal: proposeContract(component, idPrefix(config)),
    }));
    const canonicalDir = options.canonicalDir;
    const canonicalById = new Map<string, ProvenancedContract>();
    if (canonicalDir !== undefined) {
      if (!existsSync(canonicalDir)) {
        throw new Error(
          `canonical directory REFUSED — explicitly supplied path does not exist: ${canonicalDir}`,
        );
      }
      if (!statSync(canonicalDir).isDirectory()) {
        throw new Error(
          `canonical directory REFUSED — explicitly supplied path is not a directory: ${canonicalDir}`,
        );
      }
      const canonicalFiles = readdirSync(canonicalDir)
        .filter((f) => f.endsWith(".contract.json"))
        .sort();
      for (const file of canonicalFiles) {
        const raw = JSON.parse(
          readFileSync(path.join(canonicalDir, file), "utf8"),
        ) as ProvenancedContract;
        if (typeof raw.id !== "string" || raw.id.length === 0) {
          throw new Error(
            `canonical directory REFUSED — ${file} does not contain a non-empty canonical id`,
          );
        }
        if (canonicalById.has(raw.id)) {
          throw new Error(
            `canonical directory REFUSED — duplicate canonical id "${raw.id}"`,
          );
        }
        canonicalById.set(raw.id, raw);
      }
      const expectedIds = results.map(({ proposal }) =>
        String(proposal.contract.id),
      );
      const missingIds = expectedIds.filter((id) => !canonicalById.has(id));
      if (missingIds.length > 0) {
        throw new Error(
          `canonical directory REFUSED — missing expected canonical id(s): ${missingIds.join(", ")}`,
        );
      }
    }
    if (canonicalDir !== undefined) {
      for (const result of results) {
        const raw = result.proposal.contract as ProvenancedContract;
        result.proposal.contract = promoteStaticCandidate(
          canonicalById.get(String(raw.id)) ?? null,
          raw,
          result.component,
          {
            acknowledgeUnprovenancedMismatch:
              options.acknowledgeUnprovenancedMismatch,
          },
        ) as typeof result.proposal.contract;
      }
    }
    mkdirSync(path.join(out, "contracts"), { recursive: true });
    writeFileSync(
      path.join(out, "code-extraction.json"),
      JSON.stringify(extracted, null, 2) + "\n",
    );
    for (const { component, proposal } of results) {
      writeFileSync(
        path.join(
          out,
          "contracts",
          `${(proposal.contract.id as string).replace(/^[^.]+\./, "")}.contract.json`,
        ),
        JSON.stringify(proposal.contract, null, 2) + "\n",
      );
    }
    let report = proposalsReport(results);
    if (skipped.length > 0) {
      report +=
        "\n## Components seen but NOT extractable (review required)\n\n" +
        "These components were found but their props could not be read — reported, never silently dropped:\n\n" +
        skipped
          .map((s) => `- **${s.name}** (\`${s.source}\`) — ${s.reason}`)
          .join("\n") +
        "\n";
    }
    writeFileSync(path.join(out, "proposals.md"), report + "\n");
    const withAnatomy = extracted.filter((c) => c.anatomy).length;
    const rawValueCount = extracted.reduce(
      (n, c) => n + (c.anatomy?.rawValues.length ?? 0),
      0,
    );
    console.log(
      `✔ Extracted ${extracted.length} component(s) → ${out}/code-extraction.json\n` +
        `✔ ${results.length} proposed contract(s) → ${out}/contracts/ (all schema-valid)\n` +
        (withAnatomy > 0
          ? `✔ ${withAnatomy} proposal(s) carry EXTRACTED anatomy (structure + token bindings)` +
            (rawValueCount > 0
              ? ` — ${rawValueCount} raw CSS value(s) reported with candidates, none invented\n`
              : "\n")
          : "") +
        (skipped.length > 0
          ? `⚠ ${skipped.length} component(s) seen but not extractable — listed in ${out}/proposals.md\n`
          : "") +
        `✔ Review notes → ${out}/proposals.md\n` +
        // The next-step verb depends on the shell: inside this repo the npm
        // script exists; a standalone adopter (the bundled ds-contracts CLI)
        // has no `npm run reconcile` — their verb is `extract --reconcile`.
        // Same filename test as the direct-run shell at the bottom of this
        // file: bundling into the CLI changes argv[1] away from extract/run.*.
        `Next: dump your design library with extract/figma-dump.js, point design.source at it, then reconcile: ${
          process.argv[1] &&
          /extract[\\/]run\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))
            ? "npm run reconcile"
            : "ds-contracts extract --reconcile"
        }`,
    );
  } else if (command === "reconcile") {
    console.log(`Config: ${from}`);
    const extractionPath = path.join(out, "code-extraction.json");
    if (!existsSync(extractionPath)) {
      throw new Error(
        `${extractionPath} not found — run \`npm run extract:code\` first.`,
      );
    }
    const codeSide = JSON.parse(
      readFileSync(extractionPath, "utf8"),
    ) as ExtractedComponent[];
    const designSource = config.design?.source;
    if (!designSource) {
      throw new Error(
        'No design.source in config. Run extract/figma-dump.js in your design file, save the JSON, and point design.source at it (or use "parity-snapshot" in this repo).',
      );
    }
    const designSide = loadDesign(designSource);
    // The contract-id prefix doubles as the vendor prefix on code names
    // (SlButton ⇄ kit "Button") — every prefix-stripped match is flagged.
    const r = reconcile(codeSide, designSide, {
      stripCodePrefix: idPrefix(config),
    });
    writeReconciliation(r, out);
    console.log(
      `✔ Reconciled ${r.stats.matched}/${r.stats.components} components — ` +
        `${r.stats.propsAgree} properties agree, ${r.stats.propsDiffer} need a decision\n` +
        `✔ Report → ${out}/reconciliation.md`,
    );
  } else {
    throw new Error(`Unknown command "${command}" — use "code" or "reconcile"`);
  }
}

// Direct-run shell: `tsx extract/run.ts code|reconcile [config]`.
// Filename-matched so bundling into the ds-contracts CLI never triggers it.
if (
  process.argv[1] &&
  /extract[\\/]run\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))
) {
  const [, , command, configArg] = process.argv;
  runExtractCommand(command, configArg);
}
