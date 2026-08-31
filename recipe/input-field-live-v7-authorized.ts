import { execFileSync } from "node:child_process";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
} from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV,
  verifyInputLiveV7Authorization,
  type InputLiveV7AuthorizationProof,
} from "./input-field-live-v7-authorization.js";
import { runInputLiveV7Preflight } from "./input-field-live-v7-preflight.js";
import { InputLiveV7Orchestrator } from "./run-input-field-live-v7.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const exactAuthorizationPath = (value: string): string => {
  const expected = path.resolve(
    process.cwd(),
    INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  );
  if (path.resolve(value) !== expected)
    throw new Error(
      `Input live v7 requires exact authorization artifact ${INPUT_LIVE_V7_AUTHORIZATION_V2_PATH}`,
    );
  return expected;
};

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

export function loadInputLiveV7OperatorPrivateKey(
  root: string,
  proof: InputLiveV7AuthorizationProof,
  environment: NodeJS.ProcessEnv = process.env,
): KeyObject {
  const configuredPath = environment[INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV];
  if (!configuredPath)
    throw new Error(
      `${INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV} must name an explicit owner-only Ed25519 PKCS8 PEM path`,
    );
  const repositoryRoot = realpathSync.native(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(),
  );
  const unresolved = path.resolve(root, configuredPath);
  const resolved = path.join(
    realpathSync.native(path.dirname(unresolved)),
    path.basename(unresolved),
  );
  const relative = path.relative(repositoryRoot, resolved);
  const insideRepository =
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
  if (insideRepository) {
    const tracked = execFileSync(
      "git",
      ["ls-files", "--cached", "--full-name", "--", relative],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
    if (tracked)
      throw new Error("Input live v7 refuses a tracked private signing key");
    try {
      execFileSync("git", ["check-ignore", "-q", "--", relative], {
        cwd: repositoryRoot,
        stdio: "ignore",
      });
    } catch {
      throw new Error(
        "Input live v7 refuses a repository-local private key that is not ignored",
      );
    }
    const historical = execFileSync(
      "git",
      ["log", "--all", "--format=%H", "--", relative],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
    if (historical)
      throw new Error(
        "Input live v7 refuses a private key path present in repository history",
      );
  }

  let descriptor: number | undefined;
  let keyBytes: Buffer;
  try {
    descriptor = openSync(
      resolved,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || metadata.nlink !== 1)
      throw new Error(
        "Input live v7 private signing key must be one regular unlinked file",
      );
    if ((metadata.mode & 0o777) !== 0o600)
      throw new Error("Input live v7 private signing key mode must be 0600");
    if (
      typeof process.getuid === "function" &&
      metadata.uid !== process.getuid()
    )
      throw new Error(
        "Input live v7 private signing key must be owned by the current user",
      );
    keyBytes = readFileSync(descriptor);
  } catch (error) {
    throw new Error(
      `Input live v7 private signing key refused: ${
        error instanceof Error ? error.message : "unreadable key"
      }`,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }

  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({
      key: keyBytes,
      format: "pem",
      type: "pkcs8",
    });
  } catch {
    throw new Error(
      "Input live v7 private signing key is not a valid PKCS8 PEM",
    );
  }
  if (privateKey.asymmetricKeyType !== "ed25519")
    throw new Error("Input live v7 private signing key is not Ed25519");
  const publicIdentity = sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      { type: "spki", format: "der" },
    ),
  );
  if (publicIdentity !== proof.signingPublicKeySha256)
    throw new Error(
      "Input live v7 private signing key does not match replacement authorization",
    );
  return privateKey;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const root = process.cwd();
  const directory = path.resolve(
    argument("--transaction") ??
      path.join(root, "private/input-live-v7-transaction"),
  );
  const authorization = verifyInputLiveV7Authorization(root);
  const privateKey = loadInputLiveV7OperatorPrivateKey(root, authorization);
  if (command === "init") {
    const authorizationPath = argument("--authorization");
    if (!authorizationPath)
      throw new Error("--authorization is required for live initialization");
    exactAuthorizationPath(authorizationPath);
    const securityAttestationPath = argument("--security-attestation");
    if (!securityAttestationPath)
      throw new Error(
        "--security-attestation is required after Figma PAT rotation/replacement, MCP restart, owner-only env configuration, zero secret scan, and exact Scratch probe",
      );
    const attempt = Number(argument("--attempt") ?? "1");
    const completedAttempts = (argument("--completed-attempts") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    runInputLiveV7Preflight(
      root,
      authorization,
      securityAttestationPath,
      attempt,
      completedAttempts,
    );
    const orchestrator = InputLiveV7Orchestrator.initialize({
      root,
      transactionDirectory: directory,
      privateKey,
      authorization,
      attempt,
    });
    process.stdout.write(
      `${JSON.stringify(orchestrator.nextAction(), null, 2)}\n`,
    );
    return;
  }
  const orchestrator = InputLiveV7Orchestrator.resume({
    root,
    transactionDirectory: directory,
    privateKey,
  });
  if (command === "status") {
    process.stdout.write(
      `${JSON.stringify(orchestrator.nextAction(), null, 2)}\n`,
    );
    return;
  }
  const responsePath = argument("--response");
  if (!responsePath)
    throw new Error(
      `${command} requires --response with complete raw MCP JSON`,
    );
  const raw = readFileSync(responsePath, "utf8");
  const action =
    command === "cleanup"
      ? orchestrator.ingestCleanup(raw)
      : orchestrator.ingestAndAdvance(raw);
  process.stdout.write(`${JSON.stringify(action, null, 2)}\n`);
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  await main();
