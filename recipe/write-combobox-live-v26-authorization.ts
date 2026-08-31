import { generateKeyPairSync } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  COMBOBOX_LIVE_V26_AUTHORIZATION_PATH,
  COMBOBOX_LIVE_V26_INDEX_PATH,
} from "./build-combobox-live-proof-v26.js";
import {
  buildComboboxLiveV26AuthorizationArtifact,
  readComboboxLiveV26HistoryState,
} from "./combobox-live-v26-authorization.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const root = process.cwd();
const state = readComboboxLiveV26HistoryState(root);
if (!state.antecedentCommit)
  throw new Error("Combobox live v26 AUTHORIZE requires a published PREPARE commit");
const keyDirectory = path.resolve(
  argument("--private-key-dir") ?? path.join(root, "private"),
);
mkdirSync(keyDirectory, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const privateKeyPath = path.join(keyDirectory, "combobox-live-v26-operator.pem");
writeFileSync(
  privateKeyPath,
  privateKey.export({ type: "pkcs8", format: "pem" }),
  { flag: "wx", mode: 0o600 },
);
chmodSync(privateKeyPath, 0o600);
const artifact = buildComboboxLiveV26AuthorizationArtifact({
  antecedentCommit: state.antecedentCommit,
  antecedentIndexBytes: readFileSync(path.join(root, COMBOBOX_LIVE_V26_INDEX_PATH)),
  signingPublicKey: publicKey,
});
const authorizationPath = path.join(root, COMBOBOX_LIVE_V26_AUTHORIZATION_PATH);
writeFileSync(
  authorizationPath,
  `${JSON.stringify(artifact, null, 2)}\n`,
  { flag: "wx" },
);
process.stdout.write(
  `Wrote ${COMBOBOX_LIVE_V26_AUTHORIZATION_PATH} for antecedent ${state.antecedentCommit}. Private key stays at ${privateKeyPath}.\n`,
);
