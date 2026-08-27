import {
  createHash,
  createPublicKey,
  randomUUID,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  assertInputLiveV27RootProofs,
  INPUT_LIVE_V27_CAPTURE_MAX_RAW_RESPONSE_BYTES,
  INPUT_LIVE_V27_RESPONSE_CONTRACTS,
  type InputLiveV27RootProof,
} from "./input-field-live-v27-contract.js";
import { canonicalJson } from "./normalize.js";

export const INPUT_LIVE_V27_BROKER_VERSION = "input-live-v27-broker-v2";
export const INPUT_LIVE_V27_SIGNED_WRITER_TIMEOUT_MS = 300_000;
export const INPUT_LIVE_V27_SIGNED_NON_WRITER_TIMEOUT_MS = 120_000;
export const INPUT_LIVE_V27_DYNAMIC_TOOL = Object.freeze({
  namespace: "user-Figma Console",
  tool: "figma_execute",
});
export const INPUT_LIVE_V27_TARGET = Object.freeze({
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  fileName: "Scratch Project",
  editorType: "figma",
});
export const INPUT_LIVE_V27_REMOTE_PHASES = [
  "writer",
  "restore",
  "extract",
  "probe",
  "capture",
  "cleanup",
] as const;
export const INPUT_LIVE_V27_TECHNICAL_GATES = [
  "sceneExtraction",
  "hostNormalization",
  "accounting",
  "fixedPoint",
  "usability",
  "restoration",
  "clipping",
  "overlap",
  "adornmentContent",
  "stateSemantics",
] as const;

export type InputLiveV27RemotePhase =
  (typeof INPUT_LIVE_V27_REMOTE_PHASES)[number];
export type InputLiveV27AuthorizationMode = "live" | "simulated";

export interface InputLiveV27CommitPins {
  protocolCommit: string;
  runnerCommit: string;
  codeCommit: string;
  authorizationCommit: string;
}

export interface InputLiveV27TransactionAuthorization extends InputLiveV27CommitPins {
  mode: InputLiveV27AuthorizationMode;
  authorizationSha256: string;
  protocolSha256: string;
  runnerSha256: string;
  codeTreeSha256: string;
  signingPublicKeySha256: string;
}

interface BrokerTarget {
  fileKey: string;
  fileName: string;
  editorType: string;
}

export interface InputLiveV27Manifest {
  artifactVersion: "input-live-v27-broker-manifest-v2";
  brokerVersion: typeof INPUT_LIVE_V27_BROKER_VERSION;
  transactionId: string;
  attempt: number;
  createdAt: string;
  expectedDynamicTool: typeof INPUT_LIVE_V27_DYNAMIC_TOOL;
  target: typeof INPUT_LIVE_V27_TARGET;
  authorization: InputLiveV27TransactionAuthorization;
  proofPlanSha256: string;
  captureManifestSha256: string;
  captureRequests: 128;
  maximumAttempts: 3;
  signing: {
    algorithm: "Ed25519";
    publicKeyPem: string;
  };
  cleanupRequestPersistedAfterWriter: true;
}

export interface InputLiveV27ResponseContract {
  schema: string;
  cardinality: Readonly<Record<string, number>>;
  maximumRawResponseBytes: number;
}

interface InputLiveV27RequestBody {
  artifactVersion: "input-live-v27-broker-request-v2";
  brokerVersion: typeof INPUT_LIVE_V27_BROKER_VERSION;
  transactionId: string;
  attempt: number;
  requestId: string;
  phase: InputLiveV27RemotePhase;
  sequence: number;
  captureIndex: number | null;
  createdAt: string;
  expectedDynamicTool: typeof INPUT_LIVE_V27_DYNAMIC_TOOL;
  target: typeof INPUT_LIVE_V27_TARGET;
  predecessorRequestSha256: string | null;
  previousAcceptedReceiptSha256: string | null;
  commitPins: InputLiveV27CommitPins;
  authorizationSha256: string;
  proofPlanSha256: string;
  captureManifestSha256: string;
  programBytes: number;
  programSha256: string;
  requestBindingSha256: string;
  arguments: {
    fileKey: typeof INPUT_LIVE_V27_TARGET.fileKey;
    timeout: number;
    code: string;
  };
  argumentsSha256: string;
  expectedResponse: InputLiveV27ResponseContract;
  oneMcpCallOnly: true;
  capture: boolean;
}

export interface InputLiveV27Request extends InputLiveV27RequestBody {
  requestSha256: string;
  signature: {
    algorithm: "Ed25519";
    valueBase64: string;
  };
}

export interface InputLiveV27Receipt {
  artifactVersion: "input-live-v27-broker-receipt-v2";
  brokerVersion: typeof INPUT_LIVE_V27_BROKER_VERSION;
  transactionId: string;
  requestId: string;
  phase: InputLiveV27RemotePhase;
  sequence: number;
  requestSha256: string;
  responseSha256: string;
  payloadSha256: string;
  previousAcceptedReceiptSha256: string | null;
  acceptedAt: string;
  receiptSha256: string;
}

export interface InputLiveV27AcceptedResponse<T = unknown> {
  request: InputLiveV27Request;
  receipt: InputLiveV27Receipt;
  payload: T;
  rawPayload: unknown;
}

export interface InputLiveV27IssueOptions {
  captureIndex?: number;
  timeout?: number;
  now?: string;
  expectedResponse?: InputLiveV27ResponseContract;
}

const MANIFEST_FILE = "manifest.json";
const GATES_FILE = "host-technical-gates.json";
const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;

const atomicWrite = (target: string, bytes: string): void => {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, bytes, { flag: "wx" });
  try {
    linkSync(temporary, target);
  } finally {
    unlinkSync(temporary);
  }
};

const equalTarget = (value: unknown): value is typeof INPUT_LIVE_V27_TARGET =>
  value !== null &&
  typeof value === "object" &&
  (value as BrokerTarget).fileKey === INPUT_LIVE_V27_TARGET.fileKey &&
  (value as BrokerTarget).fileName === INPUT_LIVE_V27_TARGET.fileName &&
  (value as BrokerTarget).editorType === INPUT_LIVE_V27_TARGET.editorType;

const acceptFileContext = (value: unknown): boolean => {
  if (value === null || typeof value !== "object") return false;
  const context = value as Partial<BrokerTarget>;
  if (
    context.fileKey !== INPUT_LIVE_V27_TARGET.fileKey ||
    context.fileName !== INPUT_LIVE_V27_TARGET.fileName
  )
    return false;
  if (context.editorType === undefined || context.editorType === null)
    return true;
  return context.editorType === INPUT_LIVE_V27_TARGET.editorType;
};

const requestId = (
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): string => {
  if (phase !== "capture") {
    if (captureIndex !== undefined)
      throw new TypeError(`Input live v12 ${phase} cannot have capture index`);
    return phase;
  }
  if (
    !Number.isInteger(captureIndex) ||
    captureIndex === undefined ||
    captureIndex < 0 ||
    captureIndex >= 128
  )
    throw new TypeError("Input live v12 capture index must be 0..127");
  return `capture-${String(captureIndex).padStart(3, "0")}`;
};

export const inputLiveV27RequestSequence = (
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): number => {
  if (phase === "writer") return 1;
  if (phase === "cleanup") return 2;
  if (phase === "restore") return 3;
  if (phase === "extract") return 4;
  if (phase === "probe") return 5;
  requestId(phase, captureIndex);
  return 6 + captureIndex!;
};

const requestDirectory = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): string =>
  path.join(
    directory,
    "requests",
    `${String(inputLiveV27RequestSequence(phase, captureIndex)).padStart(3, "0")}-${requestId(phase, captureIndex)}`,
  );
export const inputLiveV27RequestPath = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): string =>
  path.join(requestDirectory(directory, phase, captureIndex), "request.json");
export const inputLiveV27ResponsePath = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): string =>
  path.join(
    requestDirectory(directory, phase, captureIndex),
    "response.raw.json",
  );
export const inputLiveV27ReceiptPath = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): string =>
  path.join(requestDirectory(directory, phase, captureIndex), "receipt.json");

const identityLeakPaths = (value: unknown, prefix = ""): string[] => {
  if (typeof value === "string")
    return /figd_[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._~-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(
      value,
    )
      ? [prefix || "$"]
      : [];
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      identityLeakPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      return [
        ...(/^(?:authorization|accessToken|apiKey|secret|privateKey|cookie)$/i.test(
          key,
        )
          ? [field]
          : []),
        ...identityLeakPaths(child, field),
      ];
    },
  );
};

const assertNoIdentityLeak = (value: unknown, label: string): void => {
  const leaks = identityLeakPaths(value);
  if (leaks.length)
    throw new TypeError(`${label} identity leak: ${leaks.join(",")}`);
};

const antecedentResultLeakPaths = (value: unknown, prefix = "$"): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      antecedentResultLeakPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(/^(?:outcome|outcomes|result|results|measurement|observed|score|winner)$/i.test(
        key,
      )
        ? [`${prefix}.${key}`]
        : []),
      ...antecedentResultLeakPaths(child, `${prefix}.${key}`),
    ],
  );
};

const validateAuthorization = (
  authorization: InputLiveV27TransactionAuthorization,
): void => {
  const hashes = [
    authorization.authorizationSha256,
    authorization.protocolSha256,
    authorization.runnerSha256,
    authorization.codeTreeSha256,
    authorization.signingPublicKeySha256,
  ];
  if (
    !["live", "simulated"].includes(authorization.mode) ||
    hashes.some((hash) => !SHA256.test(hash)) ||
    Object.values({
      protocolCommit: authorization.protocolCommit,
      runnerCommit: authorization.runnerCommit,
      codeCommit: authorization.codeCommit,
      authorizationCommit: authorization.authorizationCommit,
    }).some((commit) => !SHA40.test(commit))
  )
    throw new TypeError("Input live v12 authorization pins are malformed");
};

const readManifest = (directory: string): InputLiveV27Manifest => {
  const manifest = json<InputLiveV27Manifest>(
    path.join(directory, MANIFEST_FILE),
  );
  validateAuthorization(manifest.authorization);
  const resultLeaks = antecedentResultLeakPaths(manifest);
  if (resultLeaks.length)
    throw new TypeError(
      `Input live v12 antecedent result leakage: ${resultLeaks.join(",")}`,
    );
  let signingPublicKeySha256 = "";
  try {
    signingPublicKeySha256 = sha256(
      createPublicKey(manifest.signing.publicKeyPem).export({
        type: "spki",
        format: "der",
      }),
    );
  } catch {
    signingPublicKeySha256 = "";
  }
  if (
    manifest.artifactVersion !== "input-live-v27-broker-manifest-v2" ||
    manifest.brokerVersion !== INPUT_LIVE_V27_BROKER_VERSION ||
    manifest.attempt < 1 ||
    manifest.attempt > 3 ||
    manifest.maximumAttempts !== 3 ||
    manifest.captureRequests !== 128 ||
    !SHA256.test(manifest.proofPlanSha256) ||
    !SHA256.test(manifest.captureManifestSha256) ||
    !equalTarget(manifest.target) ||
    canonicalJson(manifest.expectedDynamicTool) !==
      canonicalJson(INPUT_LIVE_V27_DYNAMIC_TOOL) ||
    manifest.signing?.algorithm !== "Ed25519" ||
    typeof manifest.signing.publicKeyPem !== "string" ||
    signingPublicKeySha256 !== manifest.authorization.signingPublicKeySha256 ||
    manifest.cleanupRequestPersistedAfterWriter !== true
  )
    throw new TypeError("invalid Input live v12 broker manifest");
  return manifest;
};

const unsignedBody = (
  request: InputLiveV27Request,
): InputLiveV27RequestBody => {
  const {
    requestSha256: _requestSha256,
    signature: _signature,
    ...body
  } = request;
  return body;
};

const readRequestIfPresent = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): InputLiveV27Request | undefined => {
  const file = inputLiveV27RequestPath(directory, phase, captureIndex);
  return existsSync(file) ? json<InputLiveV27Request>(file) : undefined;
};

const readReceiptIfPresent = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): InputLiveV27Receipt | undefined => {
  const file = inputLiveV27ReceiptPath(directory, phase, captureIndex);
  return existsSync(file) ? json<InputLiveV27Receipt>(file) : undefined;
};

const predecessor = (
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): {
  request: InputLiveV27Request | undefined;
  receipt: InputLiveV27Receipt | undefined;
} => {
  if (phase === "writer") return { request: undefined, receipt: undefined };
  if (phase === "cleanup" || phase === "restore")
    return {
      request: readRequestIfPresent(directory, "writer"),
      receipt: readReceiptIfPresent(directory, "writer"),
    };
  if (phase === "extract")
    return {
      request: readRequestIfPresent(directory, "restore"),
      receipt: readReceiptIfPresent(directory, "restore"),
    };
  if (phase === "probe")
    return {
      request: readRequestIfPresent(directory, "extract"),
      receipt: readReceiptIfPresent(directory, "extract"),
    };
  if (captureIndex === 0)
    return {
      request: readRequestIfPresent(directory, "probe"),
      receipt: readReceiptIfPresent(directory, "probe"),
    };
  return {
    request: readRequestIfPresent(directory, "capture", captureIndex! - 1),
    receipt: readReceiptIfPresent(directory, "capture", captureIndex! - 1),
  };
};

const responseContractFor = (
  phase: InputLiveV27RemotePhase,
): InputLiveV27ResponseContract => ({
  ...INPUT_LIVE_V27_RESPONSE_CONTRACTS[phase],
  maximumRawResponseBytes:
    phase === "capture"
      ? INPUT_LIVE_V27_CAPTURE_MAX_RAW_RESPONSE_BYTES
      : 64_000_000,
});

const requestBinding = (
  manifest: InputLiveV27Manifest,
  value: {
    requestId: string;
    sequence: number;
    predecessorRequestSha256: string | null;
    previousAcceptedReceiptSha256: string | null;
    programSha256: string;
    expectedResponse: InputLiveV27ResponseContract;
  },
): string =>
  sha256(
    canonicalJson({
      brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
      transactionId: manifest.transactionId,
      attempt: manifest.attempt,
      ...value,
      expectedDynamicTool: INPUT_LIVE_V27_DYNAMIC_TOOL,
      target: INPUT_LIVE_V27_TARGET,
      commitPins: {
        protocolCommit: manifest.authorization.protocolCommit,
        runnerCommit: manifest.authorization.runnerCommit,
        codeCommit: manifest.authorization.codeCommit,
        authorizationCommit: manifest.authorization.authorizationCommit,
      },
      authorizationSha256: manifest.authorization.authorizationSha256,
      proofPlanSha256: manifest.proofPlanSha256,
      captureManifestSha256: manifest.captureManifestSha256,
    }),
  );

const wrapProgram = (
  request: {
    transactionId: string;
    requestId: string;
    phase: InputLiveV27RemotePhase;
    sequence: number;
    bindingSha256: string;
    programSha256: string;
  },
  program: string,
): string => String.raw`
return await (async()=>{
const __broker=${JSON.stringify({
  artifactVersion: "input-live-v27-plugin-response-v2",
  brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
  target: INPUT_LIVE_V27_TARGET,
  ...request,
})};
if(figma.fileKey!==__broker.target.fileKey||figma.root.name!==__broker.target.fileName||figma.editorType!==__broker.target.editorType)throw new Error("INPUT-LIVE-V9-WRONG-TARGET");
const payload=await (async()=>{/*INPUT_LIVE_V27_PROGRAM_START*/${program}/*INPUT_LIVE_V27_PROGRAM_END*/})();
return {broker:__broker,payload};
})();`;

const wrappedProgram = (code: string): string => {
  const startMarker = "/*INPUT_LIVE_V27_PROGRAM_START*/";
  const endMarker = "/*INPUT_LIVE_V27_PROGRAM_END*/";
  const start = code.indexOf(startMarker);
  const end = code.indexOf(endMarker);
  if (
    start < 0 ||
    end < start ||
    code.indexOf(startMarker, start + startMarker.length) >= 0 ||
    code.indexOf(endMarker, end + endMarker.length) >= 0
  )
    throw new TypeError("Input live v12 wrapped program markers invalid");
  return code.slice(start + startMarker.length, end);
};

export function createInputLiveV27Transaction(
  directory: string,
  signingPrivateKey: KeyObject,
  options: {
    authorization: InputLiveV27TransactionAuthorization;
    proofPlanSha256: string;
    captureManifestSha256: string;
    attempt?: number;
    transactionId?: string;
    now?: string;
  },
): InputLiveV27Manifest {
  if (existsSync(path.join(directory, MANIFEST_FILE)))
    throw new Error("Input live v12 transaction already exists");
  validateAuthorization(options.authorization);
  if (
    !SHA256.test(options.proofPlanSha256) ||
    !SHA256.test(options.captureManifestSha256)
  )
    throw new TypeError("Input live v12 transaction plan hashes malformed");
  const attempt = options.attempt ?? 1;
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3)
    throw new TypeError("Input live v12 attempt must be 1..3");
  const signingPublicKey = createPublicKey(
    signingPrivateKey.export({ type: "pkcs8", format: "pem" }),
  );
  const signingPublicKeyPem = signingPublicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const signingPublicKeySha256 = sha256(
    signingPublicKey.export({ type: "spki", format: "der" }),
  );
  if (signingPublicKeySha256 !== options.authorization.signingPublicKeySha256)
    throw new TypeError(
      "Input live v12 private signing key does not match authorized public-key identity",
    );
  const manifest: InputLiveV27Manifest = {
    artifactVersion: "input-live-v27-broker-manifest-v2",
    brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
    transactionId: options.transactionId ?? randomUUID(),
    attempt,
    createdAt: options.now ?? new Date().toISOString(),
    expectedDynamicTool: INPUT_LIVE_V27_DYNAMIC_TOOL,
    target: INPUT_LIVE_V27_TARGET,
    authorization: options.authorization,
    proofPlanSha256: options.proofPlanSha256,
    captureManifestSha256: options.captureManifestSha256,
    captureRequests: 128,
    maximumAttempts: 3,
    signing: {
      algorithm: "Ed25519",
      publicKeyPem: signingPublicKeyPem,
    },
    cleanupRequestPersistedAfterWriter: true,
  };
  atomicWrite(
    path.join(directory, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export function validateInputLiveV27Request(
  directory: string,
  request: InputLiveV27Request,
): void {
  const manifest = readManifest(directory);
  const bodyHash = sha256(canonicalJson(unsignedBody(request)));
  const expectedId = requestId(
    request.phase,
    request.captureIndex === null ? undefined : request.captureIndex,
  );
  const expectedSequence = inputLiveV27RequestSequence(
    request.phase,
    request.captureIndex === null ? undefined : request.captureIndex,
  );
  const expectedPredecessor = predecessor(
    directory,
    request.phase,
    request.captureIndex === null ? undefined : request.captureIndex,
  );
  if (
    request.artifactVersion !== "input-live-v27-broker-request-v2" ||
    request.brokerVersion !== INPUT_LIVE_V27_BROKER_VERSION ||
    request.transactionId !== manifest.transactionId ||
    request.attempt !== manifest.attempt ||
    request.requestId !== expectedId ||
    request.sequence !== expectedSequence ||
    canonicalJson(request.expectedDynamicTool) !==
      canonicalJson(INPUT_LIVE_V27_DYNAMIC_TOOL) ||
    !equalTarget(request.target) ||
    request.arguments.fileKey !== INPUT_LIVE_V27_TARGET.fileKey ||
    request.predecessorRequestSha256 !==
      (expectedPredecessor.request?.requestSha256 ?? null) ||
    request.previousAcceptedReceiptSha256 !==
      (expectedPredecessor.receipt?.receiptSha256 ?? null) ||
    (request.phase !== "writer" && !expectedPredecessor.receipt) ||
    canonicalJson(request.commitPins) !==
      canonicalJson({
        protocolCommit: manifest.authorization.protocolCommit,
        runnerCommit: manifest.authorization.runnerCommit,
        codeCommit: manifest.authorization.codeCommit,
        authorizationCommit: manifest.authorization.authorizationCommit,
      }) ||
    request.authorizationSha256 !==
      manifest.authorization.authorizationSha256 ||
    request.proofPlanSha256 !== manifest.proofPlanSha256 ||
    request.captureManifestSha256 !== manifest.captureManifestSha256 ||
    request.programBytes !==
      Buffer.byteLength(wrappedProgram(request.arguments.code)) ||
    request.programSha256 !== sha256(wrappedProgram(request.arguments.code)) ||
    !SHA256.test(request.requestBindingSha256) ||
    request.argumentsSha256 !== sha256(canonicalJson(request.arguments)) ||
    request.requestSha256 !== bodyHash ||
    !Number.isInteger(request.arguments.timeout) ||
    request.arguments.timeout < 1 ||
    request.arguments.timeout > 300_000 ||
    !Number.isInteger(request.expectedResponse.maximumRawResponseBytes) ||
    request.expectedResponse.maximumRawResponseBytes <= 0 ||
    request.oneMcpCallOnly !== true ||
    request.capture !== (request.phase === "capture") ||
    request.signature?.algorithm !== "Ed25519" ||
    !verify(
      null,
      Buffer.from(bodyHash, "hex"),
      manifest.signing.publicKeyPem,
      Buffer.from(request.signature.valueBase64, "base64"),
    )
  )
    throw new TypeError(
      "Input live v12 request hash/signature/sequence/target mismatch",
    );
  assertNoIdentityLeak(request.arguments, "request");
}

export function issueInputLiveV27Request(
  directory: string,
  signingPrivateKey: KeyObject,
  phase: InputLiveV27RemotePhase,
  program: string,
  options: InputLiveV27IssueOptions = {},
): InputLiveV27Request {
  const captureIndex = phase === "capture" ? options.captureIndex : undefined;
  const id = requestId(phase, captureIndex);
  const targetPath = inputLiveV27RequestPath(directory, phase, captureIndex);
  if (existsSync(targetPath)) {
    const existing = json<InputLiveV27Request>(targetPath);
    validateInputLiveV27Request(directory, existing);
    if (existing.programSha256 !== sha256(program))
      throw new Error(`Input live v12 ${id} request pins other program bytes`);
    return existing;
  }
  if (existsSync(inputLiveV27ReceiptPath(directory, phase, captureIndex)))
    throw new Error(`Input live v12 replay refused: ${id} already accepted`);
  if (program.length === 0)
    throw new TypeError("Input live v12 empty code envelope refused");
  if (phase === "capture") validateInputLiveV27TechnicalGates(directory);
  const manifest = readManifest(directory);
  const prior = predecessor(directory, phase, captureIndex);
  if (phase !== "writer" && (!prior.request || !prior.receipt))
    throw new Error(`Input live v12 out-of-order phase: ${id}`);
  const expectedResponse =
    options.expectedResponse ?? responseContractFor(phase);
  const programSha256 = sha256(program);
  const sequence = inputLiveV27RequestSequence(phase, captureIndex);
  const bindingSha256 = requestBinding(manifest, {
    requestId: id,
    sequence,
    predecessorRequestSha256: prior.request?.requestSha256 ?? null,
    previousAcceptedReceiptSha256: prior.receipt?.receiptSha256 ?? null,
    programSha256,
    expectedResponse,
  });
  const arguments_ = {
    fileKey: INPUT_LIVE_V27_TARGET.fileKey,
    timeout:
      options.timeout ??
      (phase === "writer"
        ? INPUT_LIVE_V27_SIGNED_WRITER_TIMEOUT_MS
        : INPUT_LIVE_V27_SIGNED_NON_WRITER_TIMEOUT_MS),
    code: wrapProgram(
      {
        transactionId: manifest.transactionId,
        requestId: id,
        phase,
        sequence,
        bindingSha256,
        programSha256,
      },
      program,
    ),
  } as const;
  const body: InputLiveV27RequestBody = {
    artifactVersion: "input-live-v27-broker-request-v2",
    brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
    transactionId: manifest.transactionId,
    attempt: manifest.attempt,
    requestId: id,
    phase,
    sequence,
    captureIndex: captureIndex ?? null,
    createdAt: options.now ?? new Date().toISOString(),
    expectedDynamicTool: INPUT_LIVE_V27_DYNAMIC_TOOL,
    target: INPUT_LIVE_V27_TARGET,
    predecessorRequestSha256: prior.request?.requestSha256 ?? null,
    previousAcceptedReceiptSha256: prior.receipt?.receiptSha256 ?? null,
    commitPins: {
      protocolCommit: manifest.authorization.protocolCommit,
      runnerCommit: manifest.authorization.runnerCommit,
      codeCommit: manifest.authorization.codeCommit,
      authorizationCommit: manifest.authorization.authorizationCommit,
    },
    authorizationSha256: manifest.authorization.authorizationSha256,
    proofPlanSha256: manifest.proofPlanSha256,
    captureManifestSha256: manifest.captureManifestSha256,
    programBytes: Buffer.byteLength(program),
    programSha256,
    requestBindingSha256: bindingSha256,
    arguments: arguments_,
    argumentsSha256: sha256(canonicalJson(arguments_)),
    expectedResponse,
    oneMcpCallOnly: true,
    capture: phase === "capture",
  };
  assertNoIdentityLeak(body.arguments, "request");
  const requestSha256 = sha256(canonicalJson(body));
  const request: InputLiveV27Request = {
    ...body,
    requestSha256,
    signature: {
      algorithm: "Ed25519",
      valueBase64: sign(
        null,
        Buffer.from(requestSha256, "hex"),
        signingPrivateKey,
      ).toString("base64"),
    },
  };
  validateInputLiveV27Request(directory, request);
  atomicWrite(targetPath, `${JSON.stringify(request, null, 2)}\n`);
  return request;
}

export function persistInputLiveV27RawResponse(
  directory: string,
  phase: InputLiveV27RemotePhase,
  rawResponse: string,
  captureIndex?: number,
): string {
  const requestFile = inputLiveV27RequestPath(directory, phase, captureIndex);
  if (!existsSync(requestFile))
    throw new Error(
      `Input live v12 response has no request: ${requestId(phase, captureIndex)}`,
    );
  const request = json<InputLiveV27Request>(requestFile);
  if (
    Buffer.byteLength(rawResponse) >
    request.expectedResponse.maximumRawResponseBytes
  )
    throw new Error(
      `Input live v12 response exceeds bounded transport: ${request.requestId}`,
    );
  const target = inputLiveV27ResponsePath(directory, phase, captureIndex);
  if (existsSync(target))
    throw new Error(
      `Input live v12 response replay refused: ${request.requestId}`,
    );
  atomicWrite(target, rawResponse);
  return sha256(rawResponse);
}

const createReceipt = (
  request: InputLiveV27Request,
  responseSha256: string,
  payload: unknown,
  acceptedAt: string,
): InputLiveV27Receipt => {
  const body: Omit<InputLiveV27Receipt, "receiptSha256"> = {
    artifactVersion: "input-live-v27-broker-receipt-v2",
    brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
    transactionId: request.transactionId,
    requestId: request.requestId,
    phase: request.phase,
    sequence: request.sequence,
    requestSha256: request.requestSha256,
    responseSha256,
    payloadSha256: sha256(canonicalJson(payload)),
    previousAcceptedReceiptSha256: request.previousAcceptedReceiptSha256,
    acceptedAt,
  };
  return { ...body, receiptSha256: sha256(canonicalJson(body)) };
};

export function acceptInputLiveV27Response<T = unknown>(
  directory: string,
  phase: InputLiveV27RemotePhase,
  options: {
    captureIndex?: number;
    validate?: (payload: unknown, rawResponseBytes: number) => T;
    now?: string;
  } = {},
): InputLiveV27AcceptedResponse<T> {
  const captureIndex = phase === "capture" ? options.captureIndex : undefined;
  const receiptFile = inputLiveV27ReceiptPath(directory, phase, captureIndex);
  if (existsSync(receiptFile))
    throw new Error(
      `Input live v12 replay refused: ${requestId(phase, captureIndex)} already accepted`,
    );
  const request = json<InputLiveV27Request>(
    inputLiveV27RequestPath(directory, phase, captureIndex),
  );
  validateInputLiveV27Request(directory, request);
  if (phase === "capture") validateInputLiveV27TechnicalGates(directory);
  const rawFile = inputLiveV27ResponsePath(directory, phase, captureIndex);
  if (!existsSync(rawFile))
    throw new Error(`Input live v12 missing response: ${request.requestId}`);
  const raw = readFileSync(rawFile);
  const response = JSON.parse(raw.toString("utf8")) as Record<string, any>;
  assertNoIdentityLeak(response, "response");
  const plugin = response.result?.broker;
  const rawPayload = response.result?.payload;
  if (
    response._mcp !== "figma-console-mcp" ||
    response.success !== true ||
    response.error !== undefined ||
    !acceptFileContext(response.fileContext) ||
    plugin?.artifactVersion !== "input-live-v27-plugin-response-v2" ||
    plugin?.brokerVersion !== INPUT_LIVE_V27_BROKER_VERSION ||
    plugin?.transactionId !== request.transactionId ||
    plugin?.requestId !== request.requestId ||
    plugin?.phase !== request.phase ||
    plugin?.sequence !== request.sequence ||
    plugin?.bindingSha256 !== request.requestBindingSha256 ||
    plugin?.programSha256 !== request.programSha256 ||
    !equalTarget(plugin?.target) ||
    rawPayload === undefined
  )
    throw new TypeError(
      `Input live v12 ${request.requestId} response hash/binding/target mismatch`,
    );
  const payload = options.validate
    ? options.validate(rawPayload, raw.byteLength)
    : (rawPayload as T);
  const receipt = createReceipt(
    request,
    sha256(raw),
    rawPayload,
    options.now ?? new Date().toISOString(),
  );
  atomicWrite(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  return { request, receipt, payload, rawPayload };
}

export function persistInputLiveV27TechnicalGates(
  directory: string,
  rootProofs: readonly InputLiveV27RootProof[],
  probePayloadSha256: string,
  now = new Date().toISOString(),
): string {
  assertInputLiveV27RootProofs(rootProofs);
  const extract = readReceiptIfPresent(directory, "extract");
  const probe = readReceiptIfPresent(directory, "probe");
  if (!extract || !probe)
    throw new Error(
      "Input live v12 host gates require accepted extract and probe",
    );
  if (!SHA256.test(probePayloadSha256))
    throw new TypeError("Input live v12 probe payload hash malformed");
  const gates = Object.fromEntries(
    INPUT_LIVE_V27_TECHNICAL_GATES.map((gate) => [gate, true]),
  );
  const body = {
    artifactVersion: "input-live-v27-host-technical-gates-v2",
    brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
    transactionId: readManifest(directory).transactionId,
    extractReceiptSha256: extract.receiptSha256,
    probeReceiptSha256: probe.receiptSha256,
    probePayloadSha256,
    rootProofsSha256: sha256(canonicalJson(rootProofs)),
    roots: rootProofs.map((proof) => ({
      source: proof.source,
      adapterIdentity: proof.adapterIdentity,
      expectedDenominator: proof.accounting.denominator,
      matched: proof.accounting.matched,
      missing: proof.accounting.missing.length,
      extra: proof.accounting.extra.length,
      mismatched: proof.accounting.mismatched.length,
      duplicateCollapsed: proof.accounting.duplicateCollapsed.length,
      unobserved: proof.accounting.unobserved.length,
      silent: proof.accounting.silent,
      fixedPoint: proof.fixedPoint.stable,
      cycle1SceneIrSha256: proof.fixedPoint.cycle1SceneIrSha256,
      cycle2SceneIrSha256: proof.fixedPoint.cycle2SceneIrSha256,
      cycle1CompiledIrSha256: proof.fixedPoint.cycle1CompiledIrSha256,
      cycle2CompiledIrSha256: proof.fixedPoint.cycle2CompiledIrSha256,
    })),
    gates,
    capture: false,
    createdAt: now,
  };
  const artifact = { ...body, artifactSha256: sha256(canonicalJson(body)) };
  atomicWrite(
    path.join(directory, GATES_FILE),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  return artifact.artifactSha256;
}

export function validateInputLiveV27TechnicalGates(directory: string): void {
  const artifact = json<Record<string, any>>(path.join(directory, GATES_FILE));
  const { artifactSha256, ...body } = artifact;
  const extract = readReceiptIfPresent(directory, "extract");
  const probe = readReceiptIfPresent(directory, "probe");
  if (
    artifact.artifactVersion !== "input-live-v27-host-technical-gates-v2" ||
    artifact.transactionId !== readManifest(directory).transactionId ||
    artifact.extractReceiptSha256 !== extract?.receiptSha256 ||
    artifact.probeReceiptSha256 !== probe?.receiptSha256 ||
    !SHA256.test(artifact.probePayloadSha256) ||
    !SHA256.test(artifact.rootProofsSha256) ||
    !Array.isArray(artifact.roots) ||
    artifact.roots.length !== 2 ||
    new Set(artifact.roots.map((root: any) => root.source)).size !== 2 ||
    artifact.roots.some(
      (root: any) =>
        root.expectedDenominator <= 0 ||
        root.missing !== 0 ||
        root.extra !== 0 ||
        root.mismatched !== 0 ||
        root.duplicateCollapsed !== 0 ||
        root.unobserved !== 0 ||
        root.silent !== 0 ||
        root.fixedPoint !== true,
    ) ||
    INPUT_LIVE_V27_TECHNICAL_GATES.some(
      (gate) => artifact.gates?.[gate] !== true,
    ) ||
    artifact.capture !== false ||
    artifactSha256 !== sha256(canonicalJson(body))
  )
    throw new TypeError("invalid Input live v12 technical gates artifact");
}

export function validateInputLiveV27Receipt(
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): void {
  const request = json<InputLiveV27Request>(
    inputLiveV27RequestPath(directory, phase, captureIndex),
  );
  validateInputLiveV27Request(directory, request);
  const receipt = json<InputLiveV27Receipt>(
    inputLiveV27ReceiptPath(directory, phase, captureIndex),
  );
  const raw = readFileSync(
    inputLiveV27ResponsePath(directory, phase, captureIndex),
  );
  const response = JSON.parse(raw.toString("utf8")) as Record<string, any>;
  const { receiptSha256, ...body } = receipt;
  if (
    receipt.artifactVersion !== "input-live-v27-broker-receipt-v2" ||
    receipt.brokerVersion !== INPUT_LIVE_V27_BROKER_VERSION ||
    receipt.transactionId !== request.transactionId ||
    receipt.requestId !== request.requestId ||
    receipt.phase !== request.phase ||
    receipt.sequence !== request.sequence ||
    receipt.requestSha256 !== request.requestSha256 ||
    receipt.responseSha256 !== sha256(raw) ||
    receipt.payloadSha256 !== sha256(canonicalJson(response.result?.payload)) ||
    receipt.previousAcceptedReceiptSha256 !==
      request.previousAcceptedReceiptSha256 ||
    receiptSha256 !== sha256(canonicalJson(body))
  )
    throw new TypeError(
      `invalid Input live v12 accepted receipt: ${request.requestId}`,
    );
}

export function readInputLiveV27AcceptedRawPayload(
  directory: string,
  phase: InputLiveV27RemotePhase,
  captureIndex?: number,
): unknown {
  validateInputLiveV27Receipt(directory, phase, captureIndex);
  const response = json<Record<string, any>>(
    inputLiveV27ResponsePath(directory, phase, captureIndex),
  );
  return response.result.payload;
}

export function createInputLiveV27FakeDynamicResponse(
  request: InputLiveV27Request,
  payload: unknown,
  overrides: {
    fileContext?: {
      fileKey: string;
      fileName: string;
      editorType?: string;
    };
    pluginTarget?: BrokerTarget;
    extra?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  return {
    _mcp: "figma-console-mcp",
    success: true,
    result: {
      broker: {
        artifactVersion: "input-live-v27-plugin-response-v2",
        brokerVersion: INPUT_LIVE_V27_BROKER_VERSION,
        transactionId: request.transactionId,
        requestId: request.requestId,
        phase: request.phase,
        sequence: request.sequence,
        bindingSha256: request.requestBindingSha256,
        programSha256: request.programSha256,
        target: overrides.pluginTarget ?? INPUT_LIVE_V27_TARGET,
      },
      payload,
    },
    fileContext: overrides.fileContext ?? INPUT_LIVE_V27_TARGET,
    ...overrides.extra,
  };
}

export function listInputLiveV27PersistedRequests(
  directory: string,
): InputLiveV27Request[] {
  const root = path.join(directory, "requests");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .sort()
    .flatMap((entry) => {
      const file = path.join(root, entry, "request.json");
      return existsSync(file) ? [json<InputLiveV27Request>(file)] : [];
    });
}

export const inputLiveV27Sha256 = sha256;
