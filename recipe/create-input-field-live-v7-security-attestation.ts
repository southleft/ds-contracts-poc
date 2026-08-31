import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  verifyInputLiveV7Authorization,
} from "./input-field-live-v7-authorization.js";
import {
  INPUT_LIVE_V7_SECURITY_ATTESTATION_DEFAULT_PATH,
  inputLiveV7AttestationSha256,
  validateInputLiveV7SecurityAttestation,
  type InputLiveV7SecurityAttestation,
} from "./input-field-live-v7-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const factsPath = argument("--facts");
if (!factsPath)
  throw new Error(
    "--facts must name an owner-only 0600 JSON file recorded after replacement PAT verification, MCP restart, exact Scratch bridge+REST probes, and zero secret scans",
  );
const factsMetadata = statSync(factsPath);
if (!factsMetadata.isFile() || (factsMetadata.mode & 0o777) !== 0o600)
  throw new Error("post-restart security facts file must be regular mode 0600");

const facts = JSON.parse(readFileSync(factsPath, "utf8")) as Record<
  string,
  unknown
>;
const suppliedBinding = facts.binding as
  Record<string, unknown> | null | undefined;
if (facts.attestationSha256 !== null && facts.attestationSha256 !== undefined)
  throw new Error("security facts cannot supply the final hash");
if (
  suppliedBinding &&
  (suppliedBinding.authorizationPath !== INPUT_LIVE_V7_AUTHORIZATION_V2_PATH ||
    suppliedBinding.authorizationSha256 !== null ||
    suppliedBinding.authorizationCommit !== null ||
    suppliedBinding.codeCommit !== null ||
    suppliedBinding.signingPublicKeySha256 !== null)
)
  throw new Error("security facts cannot supply commit binding");
delete facts.binding;
delete facts.attestationSha256;

const proof = verifyInputLiveV7Authorization();
const body: Omit<InputLiveV7SecurityAttestation, "attestationSha256"> = {
  ...(facts as Omit<
    InputLiveV7SecurityAttestation,
    "binding" | "attestationSha256"
  >),
  binding: {
    authorizationPath: INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
    authorizationSha256: proof.authorizationSha256,
    authorizationCommit: proof.authorizationCommit,
    codeCommit: proof.codeCommit,
    signingPublicKeySha256: proof.signingPublicKeySha256,
  },
};
const attestation: InputLiveV7SecurityAttestation = {
  ...body,
  attestationSha256: inputLiveV7AttestationSha256(body),
};
const failures = validateInputLiveV7SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Input live v7 post-commit security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? INPUT_LIVE_V7_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(
  `Input live v7 security attestation created at ${output}; sha256=${attestation.attestationSha256}\n`,
);
