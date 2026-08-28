import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  assignButtonSceneOwnership,
  normalizeButtonObserveScene,
  BUTTON_SCENE_INVERSION_ROOT,
  BUTTON_V4_FILE_KEY,
  BUTTON_V4_PAGE_ID,
  BUTTON_V4_PAGE_NAME,
  compileButtonExpectedScenePlans,
  compareButtonSceneInversion,
  hashBytes,
  serializeButtonInversionReport,
  validateButtonSceneInversionEvidence,
  type ButtonExpectedPlanSource,
} from "./button-scene-inversion.js";
import { canonicalJson } from "./normalize.js";
import type { SceneNodeSnapshot } from "./scene-readback.js";

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const writeGzip = (path: string, value: unknown): { sha256: string; uncompressedSha256: string; bytes: number } => {
  const uncompressed = Buffer.from(`${canonicalJson(value)}\n`, "utf8");
  const compressed = gzipSync(uncompressed);
  writeFileSync(path, compressed);
  return {
    sha256: sha256(compressed),
    uncompressedSha256: sha256(uncompressed),
    bytes: compressed.byteLength,
  };
};

const readObserve = (
  path: string,
  plan: ButtonExpectedPlanSource,
): SceneNodeSnapshot => {
  const raw = JSON.parse(
    gunzipSync(readFileSync(path)).toString("utf8"),
  ) as SceneNodeSnapshot;
  return normalizeButtonObserveScene(
    assignButtonSceneOwnership(raw, plan.compileRoot),
  );
};

export function writeButtonExpectedPlans(): {
  altitude: ReturnType<typeof writeGzip>;
  fluent: ReturnType<typeof writeGzip>;
  plans: ButtonExpectedPlanSource[];
} {
  mkdirSync(BUTTON_SCENE_INVERSION_ROOT, { recursive: true });
  const plans = compileButtonExpectedScenePlans();
  const altitude = plans.find((plan) => plan.source === "altitude");
  const fluent = plans.find((plan) => plan.source === "fluent");
  if (!altitude || !fluent) throw new Error("Button expected-plans missing a root");
  return {
    altitude: writeGzip(
      `${BUTTON_SCENE_INVERSION_ROOT}/expected-scene-plan-altitude.json.gz`,
      altitude.expectedScenePlan,
    ),
    fluent: writeGzip(
      `${BUTTON_SCENE_INVERSION_ROOT}/expected-scene-plan-fluent.json.gz`,
      fluent.expectedScenePlan,
    ),
    plans,
  };
}

export function writeButtonInversionEvidence(): void {
  const written = writeButtonExpectedPlans();
  const observePaths = {
    altitude: `${BUTTON_SCENE_INVERSION_ROOT}/observe-altitude.json.gz`,
    fluent: `${BUTTON_SCENE_INVERSION_ROOT}/observe-fluent.json.gz`,
  } as const;
  const observes = (["altitude", "fluent"] as const).flatMap((source) => {
    try {
      return [
        {
          source,
          scene: readObserve(
            observePaths[source],
            written.plans.find((plan) => plan.source === source)!,
          ),
        },
      ];
    } catch {
      return [];
    }
  });
  const index: Record<string, unknown> = {
    artifactVersion: BUTTON_SCENE_INVERSION_ROOT.split("/").at(-1),
    method: "expected-plan-vs-observe",
    sourceIrRead: false,
    silentAssigned: false,
    silentDerived: true,
    historicalReadbackRefusedAsObserve: true,
    figmaWrites: 0,
    target: {
      fileKey: BUTTON_V4_FILE_KEY,
      pageId: BUTTON_V4_PAGE_ID,
      pageName: BUTTON_V4_PAGE_NAME,
    },
    expectedScenePlans: {
      altitude: {
        path: `${BUTTON_SCENE_INVERSION_ROOT}/expected-scene-plan-altitude.json.gz`,
        ...written.altitude,
        facts: written.plans[0]?.expectedScenePlan.facts.length,
      },
      fluent: {
        path: `${BUTTON_SCENE_INVERSION_ROOT}/expected-scene-plan-fluent.json.gz`,
        ...written.fluent,
        facts: written.plans[1]?.expectedScenePlan.facts.length,
      },
    },
    observe: {
      altitude: existsSync(observePaths.altitude)
        ? {
            path: observePaths.altitude,
            sha256: sha256(readFileSync(observePaths.altitude)),
          }
        : null,
      fluent: existsSync(observePaths.fluent)
        ? {
            path: observePaths.fluent,
            sha256: sha256(readFileSync(observePaths.fluent)),
          }
        : null,
    },
    observePresent: observes.length === 2,
    overallButtonSuccess: false,
    humanSignoff: "pending",
  };
  if (observes.length === 2) {
    const report = compareButtonSceneInversion(written.plans, observes);
    const serialized = serializeButtonInversionReport(report);
    writeFileSync(
      `${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`,
      `${JSON.stringify(serialized, null, 2)}\n`,
    );
    index.inversion = {
      path: `${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`,
      sha256: hashBytes(
        readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`),
      ),
      ok: report.ok,
      roots: serialized.roots,
    };
    const receipt = {
      kind: "button-scene-derived-inversion",
      version: "button-scene-inversion-v1",
      method: "expected-plan-vs-observe",
      status: {
        sourceIrRead: false,
        silentAssigned: false,
        silentDerived: true,
        ok: false,
        figmaWrites: 0,
        inputPageUntouched: true,
        historicalReadbackRefusedAsObserve: true,
        humanSignoff: "pending",
        buttonSuccess: false,
      },
      target: index.target,
      observeGuard: existsSync(`${BUTTON_SCENE_INVERSION_ROOT}/census.json`)
        ? JSON.parse(
            readFileSync(
              `${BUTTON_SCENE_INVERSION_ROOT}/census.json`,
              "utf8",
            ),
          )
        : null,
      roots: serialized.roots.map((root) => ({
        source: root.source,
        setId: root.setId,
        expectedFacts: root.expectedFacts,
        matched: root.matched,
        silent: root.silent,
        missing: root.missing,
        extra: root.extra,
        mismatched: root.mismatched,
        fixedPointStable: root.fixedPointStable,
        ok: root.ok,
      })),
      artifacts: {
        expectedScenePlanAltitude: (
          index.expectedScenePlans as Record<string, unknown>
        ).altitude,
        expectedScenePlanFluent: (
          index.expectedScenePlans as Record<string, unknown>
        ).fluent,
        observeAltitude: (index.observe as Record<string, unknown>).altitude,
        observeFluent: (index.observe as Record<string, unknown>).fluent,
        inversion: {
          path: (index.inversion as { path: string }).path,
          sha256: (index.inversion as { sha256: string }).sha256,
        },
        census: existsSync(`${BUTTON_SCENE_INVERSION_ROOT}/census.json`)
          ? {
              path: `${BUTTON_SCENE_INVERSION_ROOT}/census.json`,
              sha256: sha256(
                readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/census.json`),
              ),
            }
          : null,
      },
    };
    writeFileSync(
      `${BUTTON_SCENE_INVERSION_ROOT}/receipt.json`,
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    index.census = receipt.artifacts.census;
    index.receipt = {
      path: `${BUTTON_SCENE_INVERSION_ROOT}/receipt.json`,
      sha256: sha256(
        readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/receipt.json`),
      ),
    };
  }
  writeFileSync(
    `${BUTTON_SCENE_INVERSION_ROOT}/index.json`,
    `${JSON.stringify(index, null, 2)}\n`,
  );
  process.stdout.write(
    `${canonicalJson({
      expectedFacts: {
        altitude: written.plans[0]?.expectedScenePlan.facts.length,
        fluent: written.plans[1]?.expectedScenePlan.facts.length,
      },
      observePresent: observes.length === 2,
      overallButtonSuccess: false,
    })}\n`,
  );
}

export function checkButtonInversionEvidence(): void {
  const plans = compileButtonExpectedScenePlans();
  const inversion = JSON.parse(
    readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`, "utf8"),
  );
  const failures = validateButtonSceneInversionEvidence(inversion);
  const observePaths = {
    altitude: `${BUTTON_SCENE_INVERSION_ROOT}/observe-altitude.json.gz`,
    fluent: `${BUTTON_SCENE_INVERSION_ROOT}/observe-fluent.json.gz`,
  } as const;
  const observes = (["altitude", "fluent"] as const).map((source) => ({
    source,
    scene: readObserve(
      observePaths[source],
      plans.find((plan) => plan.source === source)!,
    ),
  }));
  const report = compareButtonSceneInversion(plans, observes);
  const serialized = serializeButtonInversionReport(report);
  if (JSON.stringify(serialized) !== JSON.stringify(inversion)) {
    failures.push(
      "inversion.json does not match a fresh expected-plan vs observe compare",
    );
  }
  const index = JSON.parse(
    readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/index.json`, "utf8"),
  );
  for (const plan of plans) {
    const recorded = index.expectedScenePlans?.[plan.source];
    const uncompressed = Buffer.from(
      `${canonicalJson(plan.expectedScenePlan)}\n`,
      "utf8",
    );
    if (recorded?.uncompressedSha256 !== sha256(uncompressed)) {
      failures.push(`${plan.source} expected-scene-plan hash drifted`);
    }
  }
  if (index.observe?.altitude?.sha256 !== sha256(readFileSync(observePaths.altitude)))
    failures.push("observe-altitude hash drifted");
  if (index.observe?.fluent?.sha256 !== sha256(readFileSync(observePaths.fluent)))
    failures.push("observe-fluent hash drifted");
  if (
    index.inversion?.sha256 !==
    sha256(readFileSync(`${BUTTON_SCENE_INVERSION_ROOT}/inversion.json`))
  )
    failures.push("inversion.json hash drifted");
  if (index.overallButtonSuccess !== false || index.humanSignoff !== "pending")
    failures.push("index must keep Button overall false and signoff pending");
  if (failures.length > 0) {
    throw new Error(`Button scene inversion check failed:\n${failures.join("\n")}`);
  }
  process.stdout.write(
    "Button scene-derived inversion check: derived, not silent-zero, overall false\n",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--check")) checkButtonInversionEvidence();
  else writeButtonInversionEvidence();
}
