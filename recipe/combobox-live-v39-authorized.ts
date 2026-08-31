import { createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { COMBOBOX_LIVE_V39_AUTHORIZATION_PATH } from "./build-combobox-live-proof-v39.js";
import { verifyComboboxLiveV39Authorization } from "./combobox-live-v39-authorization.js";
import { runComboboxLiveV39Preflight } from "./combobox-live-v39-preflight.js";
import { ComboboxLiveV39Orchestrator } from "./run-combobox-live-v39.js";

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
    COMBOBOX_LIVE_V39_AUTHORIZATION_PATH,
  );
  if (path.resolve(value) !== expected)
    throw new Error(
      `Combobox live v39 requires exact authorization artifact ${COMBOBOX_LIVE_V39_AUTHORIZATION_PATH}`,
    );
  return expected;
};

async function main(): Promise<void> {
  const command = process.argv[2];
  const root = process.cwd();
  const directory = path.resolve(
    argument("--transaction") ??
      path.join(root, "private/combobox-live-v39-transaction"),
  );
  const keyPath = argument("--private-key");
  if (!keyPath)
    throw new Error(
      "--private-key must point to an external Ed25519 PKCS8 PEM; private keys are never stored in repository artifacts",
    );
  const privateKey = createPrivateKey(readFileSync(keyPath));
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
    const authorization = verifyComboboxLiveV39Authorization(root);
    runComboboxLiveV39Preflight(
      root,
      authorization,
      securityAttestationPath,
      attempt,
      completedAttempts,
    );
    const orchestrator = ComboboxLiveV39Orchestrator.initialize({
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
  const orchestrator = ComboboxLiveV39Orchestrator.resume({
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
