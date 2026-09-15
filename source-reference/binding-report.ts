import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";
import type { BindingEvidence } from "./binding-evidence.js";
import type { BindingTraceReport } from "./binding-jobs.js";
import { matchLitRender } from "./lit-render-match.js";
import { planBindingInterventions } from "./binding-plan.js";
import { checkDependency } from "./binding-differential.js";
import { semanticHash } from "./semantics.js";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const same = isDeepStrictEqual;
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
function requireEvidence(condition: unknown, code: string): asserts condition {
  if (!condition) throw Error(`binding-report-${code}`);
}

/** Re-derive published counts from raw correspondence and finite probe evidence.
 * A consistent local record is not a signature or a complete behavior proof. */
export function validateBindingReport(
  report: BindingTraceReport,
  evidence: BindingEvidence,
  image: (story: string, name: string) => Buffer,
): void {
  const checked = new Map<string, string>();
  const imageSha = (story: string, name: string) => {
    const key = `${story}/${name}`;
    const cached = checked.get(key);
    if (cached) return cached;
    const bytes = image(story, name);
    // Bound allocation before decoding. This is an artifact safety limit,
    // not a visual score, tolerance, crop, or resizing operation.
    requireEvidence(
      bytes.length >= 33 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.readUInt32BE(8) === 13 &&
        bytes.toString("ascii", 12, 16) === "IHDR" &&
        bytes.readUInt32BE(16) > 0 &&
        bytes.readUInt32BE(20) > 0 &&
        bytes.readUInt32BE(16) * bytes.readUInt32BE(20) <= 16_777_216,
      "image-invalid",
    );
    try {
      PNG.sync.read(bytes, { checkCRC: true });
    } catch {
      throw Error("binding-report-image-invalid");
    }
    const digest = sha(bytes);
    checked.set(key, digest);
    return digest;
  };
  requireEvidence(
    same(report.request, evidence.request) &&
      report.sourceProgramSha256 === evidence.sourceProgramSha256 &&
      report.sourceStable === true,
    "source-identity-mismatch",
  );
  requireEvidence(
    Array.isArray(report.rows) &&
      report.rows.length === evidence.rows.length &&
      same(
        report.rows.map((row) => row.story),
        evidence.rows.map((row) => row.story),
      ),
    "denominator-mismatch",
  );
  for (const [index, row] of report.rows.entries()) {
    const input = evidence.rows[index];
    requireEvidence(strings(row.problems), "problems-invalid");
    let match;
    if (row.correspondence) {
      requireEvidence(
        input.eligible &&
          input.semantics &&
          input.topology &&
          row.boundTopology &&
          row.correspondence,
        "original-unavailable",
      );
      requireEvidence(
        row.boundTopology.sourcePngSha256 === input.semantics.sourcePngSha256 &&
          row.boundTopology.sourceTreeSha256 ===
            input.semantics.sourceTreeSha256,
        "topology-original-mismatch",
      );
      match = matchLitRender({
        source: evidence.source,
        semantics: input.semantics,
        boundTopology: row.boundTopology,
      });
      requireEvidence(
        same(row.correspondence, match),
        "correspondence-mismatch",
      );
      requireEvidence(
        imageSha(row.story, "replay.png") === input.semantics.sourcePngSha256,
        "replay-image-mismatch",
      );
    }
    const matched = match?.status === "structure-matched";
    requireEvidence(
      row.status === (matched ? "structure-matched" : "refused") &&
        row.matchedElements === (matched ? match!.nodes.length : 0) &&
        row.mappedSlots === (matched ? match!.slots.length : 0),
      "structure-count-mismatch",
    );
    if (!matched)
      requireEvidence(row.problems.length > 0, "refusal-reason-missing");
    const plans = planBindingInterventions(row.story, match, row.boundTopology);
    requireEvidence(
      Array.isArray(row.differentials) &&
        row.differentials.length === plans.length &&
        row.plannedDependencies === plans.length,
      "probe-denominator-mismatch",
    );
    let observed = 0;
    for (const [probeIndex, plan] of plans.entries()) {
      const probe = row.differentials[probeIndex];
      requireEvidence(
        probe.key === plan.key && strings(probe.problems),
        "probe-plan-mismatch",
      );
      if (!probe.result) {
        requireEvidence(probe.problems.length > 0, "probe-refusal-missing");
        continue;
      }
      const value = probe.result;
      requireEvidence(
        plan.intervention &&
          input.replay &&
          input.semantics &&
          value.version === 1 &&
          value.acceptedContract === null &&
          value.sourceSha256 === evidence.source.sourceSha256 &&
          value.declarationSha256 === input.semantics.declarationSha256 &&
          value.semanticObservationSha256 ===
            input.semantics.observationSha256 &&
          value.harSha256 === input.replay.harSha256 &&
          same(value.intervention, plan.intervention) &&
          value.inputSha256 ===
            semanticHash({
              replay: { ...input.replay, profile: input.profile },
              source: evidence.source,
              semantics: input.semantics,
              intervention: plan.intervention,
            }) &&
          value.digest === semanticHash({ ...value, digest: undefined }),
        "probe-identity-mismatch",
      );
      requireEvidence(
        Array.isArray(value.cases) &&
          value.cases.length === plan.intervention.values.length &&
          value.denominator === value.cases.length &&
          strings(value.problems),
        "probe-cases-mismatch",
      );
      let casesObserved = 0;
      for (const [caseIndex, item] of value.cases.entries()) {
        requireEvidence(
          same(item.value, plan.intervention.values[caseIndex]) &&
            strings(item.problems),
          "probe-value-mismatch",
        );
        if (item.status === "refused") {
          requireEvidence(item.problems.length > 0, "case-refusal-missing");
          continue;
        }
        requireEvidence(
          item.status === "observed" &&
            item.problems.length === 0 &&
            item.before &&
            item.after &&
            item.beforeSha256 === semanticHash(item.before) &&
            item.afterSha256 === semanticHash(item.after) &&
            same(item.before, input.semantics.observation) &&
            item.after.problems.length === 0 &&
            item.beforePngSha256 === input.semantics.sourcePngSha256 &&
            item.afterPngSha256 &&
            imageSha(
              row.story,
              `probe-${probeIndex}-case-${caseIndex}-before.png`,
            ) === item.beforePngSha256 &&
            imageSha(
              row.story,
              `probe-${probeIndex}-case-${caseIndex}-after.png`,
            ) === item.afterPngSha256,
          "case-artifacts-mismatch",
        );
        requireEvidence(
          item.afterReadiness?.fontsReady &&
            item.afterReadiness.failedResources.length === 0 &&
            item.afterReadiness.runtimeErrors.length === 0 &&
            item.afterReadiness.platformFonts.some(
              (font) => font.glyphCount > 0,
            ) &&
            item.afterReadiness.platformFonts
              .filter((font) => font.glyphCount > 0)
              .every((font) => font.familyName === input.profile.fontFamily),
          "case-fonts-unready",
        );
        const intervention = plan.intervention;
        const receipt =
          intervention.kind === "property"
            ? {
                kind: "source-property-setter",
                property: intervention.name,
                value: item.value,
              }
            : {
                kind: "assigned-text-data",
                domPath: intervention.assignedDomPath,
                before: item.before.slots
                  .find(
                    (slot) =>
                      slot.path === intervention.path &&
                      slot.name === intervention.name,
                  )
                  ?.assigned.find((node) => node.kind === "text")?.text,
                after:
                  item.value.kind === "value" ? item.value.value : undefined,
                preservedSiblings: [],
              };
        requireEvidence(
          same(item.interventionReceipt, receipt),
          "case-intervention-mismatch",
        );
        requireEvidence(
          checkDependency(
            plan.intervention,
            item.value,
            item.before,
            item.after,
            item.beforePngSha256,
            item.afterPngSha256,
          ).length === 0,
          "case-dependency-mismatch",
        );
        casesObserved++;
      }
      const complete = casesObserved === value.cases.length;
      requireEvidence(
        value.observed === casesObserved &&
          value.status === (complete ? "dependency-observed" : "refused") &&
          (!complete ||
            (value.problems.length === 0 && probe.problems.length === 0)),
        "dependency-count-mismatch",
      );
      if (complete) observed++;
    }
    requireEvidence(
      row.observedDependencies === observed,
      "probe-count-mismatch",
    );
  }
}
