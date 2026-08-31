import path from "node:path";

import {
  INPUT_LIVE_V4_EVIDENCE_ROOT,
  INPUT_LIVE_V4_FIGMA_FILE_KEY,
  INPUT_LIVE_V4_PHASES,
  verifyInputLiveV4Authorization,
} from "./input-field-live-v4-authorization.js";

export interface InputLiveV4CaptureRequest {
  authorizationVerified: boolean;
  target: {
    fileKey: string;
    fileName: string;
    editorType: string;
    connectedExactTargetCount: number;
  };
  attempt: {
    requested: number;
    completedV4Attempts: number[];
    maximum: number;
  };
  evidence: {
    root: string;
    captureArtifactPaths: string[];
  };
  transactionalPhaseOrder: string[];
}

const exactPhaseOrder = (phases: readonly string[]): boolean =>
  JSON.stringify(phases) === JSON.stringify(INPUT_LIVE_V4_PHASES);

export function validateInputLiveV4CaptureRequest(
  value: InputLiveV4CaptureRequest,
): string[] {
  const failures: string[] = [];
  if (!value.authorizationVerified)
    failures.push("v4 authorization verification did not pass");
  if (
    value.target.fileKey !== INPUT_LIVE_V4_FIGMA_FILE_KEY ||
    value.target.fileName !== "Scratch Project" ||
    value.target.editorType !== "figma" ||
    value.target.connectedExactTargetCount !== 1
  )
    failures.push("wrong file or non-unique Scratch target");
  if (
    value.attempt.maximum !== 3 ||
    !Number.isInteger(value.attempt.requested) ||
    value.attempt.requested < 1 ||
    value.attempt.requested > 3 ||
    value.attempt.requested !== value.attempt.completedV4Attempts.length + 1 ||
    value.attempt.completedV4Attempts.some(
      (attempt, index) => attempt !== index + 1,
    )
  )
    failures.push("attempt chronology invalid or attempt exceeds 3");
  if (
    value.evidence.root !== INPUT_LIVE_V4_EVIDENCE_ROOT ||
    value.evidence.captureArtifactPaths.some(
      (artifactPath) =>
        !artifactPath.startsWith(`${INPUT_LIVE_V4_EVIDENCE_ROOT}/`) ||
        /input-field-live-pivot-v3|input-live-v3/i.test(artifactPath),
    )
  )
    failures.push("v3 reuse or wrong evidence root");
  if (!exactPhaseOrder(value.transactionalPhaseOrder))
    failures.push("missing or reordered transactional phases");
  return failures;
}

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const argumentValues = (name: string): string[] =>
  process.argv.flatMap((argument, index) =>
    argument === name && process.argv[index + 1] !== undefined
      ? [process.argv[index + 1]!]
      : [],
  );

const parseCompletedAttempts = (value: string | undefined): number[] =>
  value === undefined || value === ""
    ? []
    : value.split(",").map((item) => Number(item));

export function verifyInputLiveV4Preflight(): void {
  const authorization = verifyInputLiveV4Authorization();
  const request: InputLiveV4CaptureRequest = {
    authorizationVerified: true,
    target: {
      fileKey: argumentValue("--file-key") ?? "",
      fileName: argumentValue("--file-name") ?? "",
      editorType: argumentValue("--editor-type") ?? "",
      connectedExactTargetCount: Number(
        argumentValue("--connected-exact-target-count") ?? 0,
      ),
    },
    attempt: {
      requested: Number(argumentValue("--attempt") ?? 0),
      completedV4Attempts: parseCompletedAttempts(
        argumentValue("--completed-v4-attempts"),
      ),
      maximum: 3,
    },
    evidence: {
      root: argumentValue("--evidence-root") ?? "",
      captureArtifactPaths: argumentValues("--capture-artifact"),
    },
    transactionalPhaseOrder: [...INPUT_LIVE_V4_PHASES],
  };
  const failures = validateInputLiveV4CaptureRequest(request);
  if (failures.length > 0)
    throw new Error(`Input live v4 preflight invalid:\n${failures.join("\n")}`);
  process.stdout.write(
    `Input live v4 attempt ${request.attempt.requested} preflight passed: authorization=${authorization.authorizationCommit} codeCommit=${authorization.codeCommit} target=${request.target.fileKey} capture=false\n`,
  );
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  verifyInputLiveV4Preflight();
