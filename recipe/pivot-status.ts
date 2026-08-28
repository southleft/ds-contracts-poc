import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT,
  readInputLiveV3Attempt1HardFailure,
  readInputLiveV3Attempt2HardFailure,
  readInputLiveV3Attempt3HardFailure,
} from "./input-field-live-v3-evidence.js";
import {
  INPUT_LIVE_V4_ANTECEDENT_COMMIT,
  INPUT_LIVE_V4_AUTHORIZATION_PATH,
} from "./input-field-live-v4-authorization.js";
import {
  INPUT_LIVE_V4_PROTOCOL_SHA256,
  INPUT_LIVE_V4_STATUS,
  readInputLiveV4Protocol,
} from "./input-field-live-v4-evidence.js";
import {
  readRepositoryEvidence,
  readRepositoryJson,
  resolveRepositoryEvidencePath,
} from "./evidence-path.js";

export const INPUT_LIVE_V3_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v3/protocol.json";
export const INPUT_LIVE_V3_PROTOCOL_SHA256 =
  "f4decf46da7cd3870e247d5304d632028356580e58ce68bedcb7acb7c0e31a23";
export const PIVOT_STATUS_PATH = "recipe/evidence/status-index.json";
const V3_ROOT = "recipe/evidence/input-field-live-pivot-v3";
const DRAFT_STATUS =
  "draft-uncommitted; chronology unproven; capture forbidden";
const STATUS_INDEX_STATUS =
  "Input live v3 exhausted; v4 non-executable; v5 and v6 retired; v7 attempt 1 failed closed; v8 attempts 1-2 failed closed; v9 attempts 1-2 failed closed; v10 attempts 1-2 failed closed; v11 attempt 1 failed closed; v12 attempt 1 failed closed; v13 attempt 1 failed closed; v14 attempt 1 failed closed; v15 attempt 1 failed closed; v16 attempt 1 failed closed; v17 attempt 1 failed closed; v18 attempt 1 failed closed; v19 attempt 1 failed closed; v20 attempt 1 failed closed; v21 attempt 1 failed closed; v22 attempt 1 failed closed; v23 attempt 1 failed closed; v24 attempt 1 failed closed; v25 attempt 1 failed closed; v26 attempt 1 failed closed; v27 attempt 1 failed closed; v28 attempt 1 failed closed; v29 attempt 1 failed closed; v30 attempt 1 failed closed; v31 attempt 1 failed closed; v32 attempt 1 failed closed; v33 attempt 1 failed closed; v34 attempt 1 failed closed; v35 attempt 1 failed closed; v36 attempt 1 failed closed; v37 attempt 1 failed closed; v38 attempt 1 failed closed; v39 attempt 1 failed closed; v40 attempt 1 failed closed; v41 attempt 1 failed closed; v42 attempt 1 failed closed; v43 attempt 1 failed closed; v44 attempt 1 failed closed; v45 attempt 1 failed closed; v46 attempt 1 failed closed; Button/Input false; human signoff pending";
const V4_PENDING_STATUS =
  "authorization artifact prepared; pending parent commit and upstream publication; capture forbidden";
const V4_FAILURE_STATUS =
  "authorization and preflight passed; committed entrypoint refused before phase 1 and writer; lineage invalid for execution";
const V4_FAILURE_PATH =
  "recipe/evidence/input-field-live-pivot-v4-failure.json";
const V4_FAILURE_SHA256 =
  "43161312f76b50cb1bd392b0ca55d8892f3af4f5bfd809ec94b944ed0e7a48ee";
const V5_ROOT = "recipe/evidence/input-field-live-pivot-v5";
const V5_STATUS =
  "authorization lineage published; execution blocked by reviewed transaction-contract defects; capture forbidden";
const V5_INDEX_STATUS = "authorization prepared uncommitted; capture forbidden";
const V5_ANTECEDENT_COMMIT = "a29d034b746d0831ce93f88f1aeb5630ad4b0453";
const V5_AUTHORIZATION_COMMIT = "7c240e7862ee4b97d9da5002c7f2a02827477413";
const V5_PROTOCOL_FIRST_ADD_COMMIT = "e9f9712a55147a4329f51cfd4bf024866dfd489f";
const V5_PROTOCOL_SHA256 =
  "6fdc4b99923aed0990a1f46fe1bdce620e2f63f0b38263983cd2da5443d9b6cf";
const V5_PLAN_SHA256 =
  "09fbdda142727a0238bb0f30721e30015cdfb714c24314d0b33d6b7b53081b10";
const V5_AUTHORIZATION_SHA256 =
  "acb54eda9a4994c9f1d7502b79d21adcaf28cca06b0566f344a9647219ff39e6";
const V6_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v6/protocol.json";
const V6_PROTOCOL_SHA256 =
  "0d79c50a4a21763eae067ff18f2ad65bc071f2fca5af7cfd4335f775c9d5e296";
const V6_BROKER_PATH = "recipe/input-field-live-v6-broker.ts";
const V6_BROKER_SHA256 =
  "d4bdd418ac56658954fbc0ed1e3d9c4ab152d016a35740cf6c34b5ce96d26e79";
const V6_CONTRACT_PATH = "recipe/input-field-live-v6-contract.ts";
const V6_CONTRACT_SHA256 =
  "11741375907f0dd69678a6ba652a9a1b00b685ae47994ee88ae34e753e52144a";
const V6_RUNNER_PATH = "recipe/run-input-field-live-v6.ts";
const V6_RUNNER_SHA256 =
  "3c2ae18d2a346eb299549244322cbbfcb97667649ae6719bf2b703a8b9285673";
const V6_TEST_PATH = "recipe/input-field-live-v6-broker.test.ts";
const V6_TEST_SHA256 =
  "c0a9504f0b03ae80b942c6acb1133b40bd8e9ff9cde35bae2e0bfe0dfa3d9cbc";
const V6_INDEX_PATH = "recipe/evidence/input-field-live-pivot-v6/index.json";
const V6_INDEX_SHA256 =
  "5f57d9425a722e23e627e66de6b6b1e73e937cae946707fffe62ffb17d24f103";
const V6_AUTHORIZATION_PATH =
  "recipe/evidence/input-field-live-pivot-v6/capture-authorization.json";
const V6_AUTHORIZATION_SHA256 =
  "82f7cfadd7161419b091c632c45f1f746fa1434af03b3e154ec6ca3fc288e17c";
const V6_AUTHORIZATION_LAYER_PATH =
  "recipe/input-field-live-v6-authorization.ts";
const V6_AUTHORIZATION_LAYER_SHA256 =
  "ea3ff5871ad499fbd676e9deb89f3fa22c1a2c565236de5cb8d6a04a4986c336";
const V6_PREFLIGHT_PATH = "recipe/input-field-live-v6-preflight.ts";
const V6_PREFLIGHT_SHA256 =
  "14bc407c60adf67d69ee10c63e5dfe7d06a59638d29754536428372f844224c3";
const V6_AUTHORIZATION_TEST_PATH =
  "recipe/input-field-live-v6-authorization.test.ts";
const V6_AUTHORIZATION_TEST_SHA256 =
  "640eb5af45dc184d49233fd03bf0f6b50d1a56f3b3e899ee35995e1003eaa524";
const V6_SECURITY_ATTESTATION_TEMPLATE_PATH =
  "recipe/evidence/input-field-live-pivot-v6/operator-security-attestation-template.json";
const V6_SECURITY_ATTESTATION_TEMPLATE_SHA256 =
  "7d7f1360aa5eb37788cb74063cadab247b101ee61321a4880b95d2edaf3deec1";
const V6_PLAN_SHA256 =
  "28c22a4b86fe98e558c48278c624a229da6417b5abcbdd6587cb533197fdf199";
const V6_CAPTURE_MANIFEST_SHA256 =
  "b58506dd5bc238cafc7b346ddad6fa5d1c1178e5ec6e566f0cc799e4c43e9571";
const V6_REQUEST_MANIFEST_SHA256 =
  "03126813dfe8a9e7fa9c18db8f906d3e65c33e162bbdc768341802cddeb634b2";
const V5_SUPERSEDING_PATH =
  "recipe/evidence/input-field-live-pivot-v5-superseding-status.json";
const V5_SUPERSEDING_SHA256 =
  "df74b9d8971e1fab57c96926ccb0a65b9254861fa20b0d53107edd3a8589e8ba";
const V6_STATUS =
  "retired before live use; authorization history valid; comprehensive check phase-dependent and red";
const V6_PROTOCOL_STATUS =
  "draft uncommitted; pending separate authorization; live write and capture forbidden";
const V6_SUPERSEDING_PATH =
  "recipe/evidence/input-field-live-pivot-v6-superseding-status.json";
const V6_SUPERSEDING_SHA256 =
  "6cf34dbe952aa6163162fb85d3194743467a278c568dfc2d9bbcf8aa3ed04742";
const V7_ROOT = "recipe/evidence/input-field-live-pivot-v7";
const V7_PROTOCOL_SHA256 =
  "9d61904d916563ed50a4c1d4cefc3c6303a6586eb2d5a00a03be9b492d69b757";
const V7_PLAN_SHA256 =
  "da5e1eddf71989c6462bbf3ed14065059f9dbc10c60df08014dda6757bdc6ef7";
const V7_CAPTURE_MANIFEST_SHA256 =
  "28e0a47dcfb065c5406f2882f8d3662afee050dc84364e7f2fe04ba3f0d6b7ef";
const V7_REQUEST_MANIFEST_SHA256 =
  "3e34d59b783a98cb8b081febaafb380bf45898981f96b285e11783cca1b63397";
const V7_INDEX_SHA256 =
  "3fa459844440098aae47432ba58108eff51edc332086b2d93de795d5f192f069";
const V7_HASH_SET_SHA256 =
  "09437c70458cda74a774dfa056cd91d0ac836d73d2e1d6a8567e6fe631df5be7";
const V7_AUTHORIZATION_TEMPLATE_SHA256 =
  "b7ceb531e84d5a4002e9a4240925a15837841cc922dda4cac492e903ba07978b";
const V7_ANTECEDENT_COMMIT = "117f1cddce797393b1b705da62323615e584d54b";
const V7_FIRST_AUTHORIZATION_PATH = `${V7_ROOT}/capture-authorization.json`;
const V7_FIRST_AUTHORIZATION_SHA256 =
  "43277ff2f422c9117e2f4f1b5c0fea241cc967977666529d91e0f14fd7489fda";
const V7_AUTHORIZATION_PATH = `${V7_ROOT}/capture-authorization-v2.json`;
const V7_AUTHORIZATION_SHA256 =
  "de501693a52b0d050fc1b7048a355ca9195c3ca2ab982a28fd1b9509c397e76d";
const V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "8eb7c6f6fcd2bd497997028f8e026abc30d8af8507bc2b903347da892403dbcf";
const V7_STATUS_PATH = "recipe/evidence/input-field-live-pivot-v7-status.json";
const V7_SUPERSEDING_PATH =
  "recipe/evidence/input-field-live-pivot-v7-superseding-status.json";
const V7_SUPERSEDING_SHA256 =
  "bbfebd3c186ffec4acb91fe488003a3e5f4c7ec195f1b437dd4ece576799e794";
const V7_LIVE_STATUS =
  "attempt 1 failed closed; writer and extract accepted; host normalize refused strokeBottomWeight; cleanup complete; superseded by v8";
const V8_ROOT = "recipe/evidence/input-field-live-pivot-v8";
const V8_PROTOCOL_SHA256 =
  "a4f4665e3cd5a3a552306f4e515e78bb5f874bdfe371603a3aaf50533ed6da96";
const V8_PLAN_SHA256 =
  "773db93f3a5180f64836c8198cbbcc58d9ccc7097eec6010612cec4974122435";
const V8_CAPTURE_MANIFEST_SHA256 =
  "199c7ac28649dbf1e5aba9efc7770d623cd74615333713089feb237586a2c890";
const V8_REQUEST_MANIFEST_SHA256 =
  "defc1561c86f206301ad91015c28bf361bfaf92881dcef5b1712ab8adb793b12";
const V8_INDEX_SHA256 =
  "d89e2db1df68921b1957f11f0ce0cd2a97d38a63f9808bc00ef5ce518ea95b07";
const V8_HASH_SET_SHA256 =
  "9f80320703587f1308615bce0e38fbca6c734fb7eb1fd5dae12b3280523eeafd";
const V8_AUTHORIZATION_TEMPLATE_SHA256 =
  "218822d276f3a657fbe9cf638044da3792636813ca1f53379f875539562e61bf";
const V8_ANTECEDENT_COMMIT = "9e34ee653b07e705ef6309cc3d900add81fba47b";
const V8_AUTHORIZATION_PATH = `${V8_ROOT}/capture-authorization.json`;
const V8_AUTHORIZATION_SHA256 =
  "fb82f474f1d4f07fd3c3ebf780ea982cdb87f3f431c3e6525fadc9b3c0ddcc5f";
const V8_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "324bde931b04fccdb405ad23c4cbc0cb2a8c4fdac98b5efefd9bd0fc595481aa";
const V8_STATUS_PATH = "recipe/evidence/input-field-live-pivot-v8-status.json";
const V8_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v8-attempt-1.json";
const V8_ATTEMPT_1_SHA256 =
  "4a8275101a1f1cd441d11c0969e9d2798ad2a496463e291d836470d9813f85b9";
const V8_ATTEMPT_2_PATH =
  "recipe/evidence/input-field-live-pivot-v8-attempt-2.json";
const V8_ATTEMPT_2_SHA256 =
  "5da53aefb6a36979a6e3f84ec05066472e41a43f8c40121ccf9c046427c85456";
const V8_STATUS =
  "attempt 2 failed closed; host IR refused VARIABLE_ALIAS and bound-variable-only fills; cleanup complete; do not restart v8 as-is";
const V8_BASE_COMMIT = "5adac899b1dcde25c4c533d9686cfd665430f2f9";
const V9_ROOT = "recipe/evidence/input-field-live-pivot-v9";
const V9_PROTOCOL_SHA256 =
  "d2075acce902fd86b658958d3a25047b770144f54b8215c8498d51a2fa94a5b6";
const V9_PLAN_SHA256 =
  "937d6afef50c71fc2184c35ed56617b8f9e8f18842e3fd198ab072102c98509d";
const V9_CAPTURE_MANIFEST_SHA256 =
  "b67277faaa92b4e3a4e5d85606b01ecc98800d3a2025b03093031425b16b91e3";
const V9_REQUEST_MANIFEST_SHA256 =
  "61424394fd789640bececbf149bd64e165f97c0b1cf048c5af9f538c811a282a";
const V9_INDEX_SHA256 =
  "ef6a72fd392d2866d06136e8200d2cff750585705eafacdc41e20b95cfac2942";
const V9_HASH_SET_SHA256 =
  "6111066edba80ab6494f6d2b412754a060519621bd586086f5db8f1abed97138";
const V9_AUTHORIZATION_TEMPLATE_SHA256 =
  "1c6e0d698f20b0eee59eeb65e550647ad71def6c191613869ac35dc3ed809fa7";
const V9_ANTECEDENT_COMMIT = "1a16642bddbb8c8a3fb44cd0e086a7ff8328e294";
const V9_AUTHORIZATION_PATH = `${V9_ROOT}/capture-authorization.json`;
const V9_AUTHORIZATION_SHA256 =
  "56930e91dd321695f3e3343ddd5a9c0d0dbc3c51f0ff8305ab998d0d8f2269c7";
const V9_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "c98c4cf0b1deef2b2d71c9f7e7f550e602ac334a620142516f4537f47ea9c686";
const V9_STATUS_PATH = "recipe/evidence/input-field-live-pivot-v9-status.json";
const V9_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v9-attempt-1.json";
const V9_ATTEMPT_1_SHA256 =
  "aad14b8a83c8b91935e24c06c1432d846e8d3322e66514c76acc36b9ef3c36fc";
const V9_ATTEMPT_2_PATH =
  "recipe/evidence/input-field-live-pivot-v9-attempt-2.json";
const V9_ATTEMPT_2_SHA256 =
  "af5099944f2260400bceb6aa47f3ca375dd67b6d9a80d02cc2337d4efa7db20a";
const V9_STATUS =
  "attempt 2 failed closed; host normalize used hashed v3 verifier scene-readback.ts; cleanup complete; do not restart v9 as-is";
const V9_BASE_COMMIT = "1d49f4db6db14eca0c4185326153c972d50b7127";
const V10_ROOT = "recipe/evidence/input-field-live-pivot-v10";
const V10_PROTOCOL_SHA256 =
  "8ffa74cf1f0fefd7d615dfa60d68b75c6dd10e4af501e6a670ef57169fa6f7a1";
const V10_PLAN_SHA256 =
  "fdbbd3ff2fbd03d8102a635596c6a84e837fdc274ff1cd57f4303faf56ef1b9b";
const V10_CAPTURE_MANIFEST_SHA256 =
  "6e84bfbc4b06b4f8ea0867ab81a95143446d6c7ef6903bdf929696daf7ddda47";
const V10_REQUEST_MANIFEST_SHA256 =
  "8b86eceb2f52eaad11731e62b9e7aead1046269f245fa3efb4c01a92f4461e9a";
const V10_INDEX_SHA256 =
  "4a054aadf5902fed939da30c1b54833bcc7a54f88b145f5348c4d9b3108524bc";
const V10_HASH_SET_SHA256 =
  "c39fba6f31281ab89bfc7a6e256985b47f0c5c7133dba0d6c7700c2d36a002a2";
const V10_AUTHORIZATION_TEMPLATE_SHA256 =
  "cc37e0d6da97a40a1d076f7ecba35ed2394ba101fa007ff08bf9ffcb135af57b";
const V10_ANTECEDENT_COMMIT = "0da647b79ed8a2660b9858c6008a08cbae8dbbf3";
const V10_AUTHORIZATION_PATH = `${V10_ROOT}/capture-authorization.json`;
const V10_AUTHORIZATION_SHA256 =
  "393996857f730419f9f92b1d2d30abaa9b5e896866e2694d50e3999c4e7b5e57";
const V10_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "d651c665ee361bfc72f1bf671e5e45493c9a9eb7444493bc764551793909d25d";
const V10_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v10-status.json";
const V10_STATUS =
  "attempt 2 failed closed; host dropped text roles on font-provenance= names; cleanup complete; do not restart v10 as-is";
const V10_BASE_COMMIT = "2618e4e15cd88ad9f3428f1a8026a0fee2ede04f";
const V10_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v10-attempt-1.json";
const V10_ATTEMPT_1_SHA256 =
  "a3acc3dda0e8dedd616a53a7129db08bf4ed8ff839cd65c5919b286440ba320a";
const V10_ATTEMPT_2_PATH =
  "recipe/evidence/input-field-live-pivot-v10-attempt-2.json";
const V10_ATTEMPT_2_SHA256 =
  "8a98000b9187c097024d976c4c56242498093a38f4e1e7ea4307bd8a73e1fd48";
const V11_ROOT = "recipe/evidence/input-field-live-pivot-v11";
const V11_PROTOCOL_SHA256 =
  "17aadf8e73aa9a7141e3122caa00e4c70bd7c362bdc5f70780861730a18cf589";
const V11_PLAN_SHA256 =
  "7da24adbd0b25e620477601ccce77dc32ded44a5b7bf6ca2a502524227109181";
const V11_CAPTURE_MANIFEST_SHA256 =
  "756c7e8cdbc13f6cd366adecdfba636ffe1c5681707cede281128107d4667a15";
const V11_REQUEST_MANIFEST_SHA256 =
  "2139e6025b13245848178c5621b6d07be0cd8cc970ddd181427fbad3d323a38d";
const V11_INDEX_SHA256 =
  "65ca9866da8fc90f354ceb53d57dc383f64d9f39d9b9f9ad3752df499c9628c7";
const V11_HASH_SET_SHA256 =
  "46f4e656cc97f18ddc21510fa9d1c787f0bbcac2b6cd276e7ccfb87e10c57a76";
const V11_AUTHORIZATION_TEMPLATE_SHA256 =
  "79720598df9a44363ec447cc014a4ebb2010e95ab1b39e79e9767ee4e1c0e270";
const V11_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v11-status.json";
const V11_STATUS =
  "attempt 1 failed closed; writer and extract accepted; host refused MUI content fill; cleanup complete";
const V11_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v11-attempt-1.json";
const V11_ATTEMPT_1_SHA256 =
  "20555b3b54392be99f41799c734393c28b30ecde17cfd1b2f1dde4f4eeac2f75";
const V11_BASE_COMMIT = "93df43839e974870630a227562851a86eb0fa8ce";
const V11_ANTECEDENT_COMMIT = "f1861d527dd09345c56ee862de7776fbc4d0a7a2";
const V11_AUTHORIZATION_PATH = `${V11_ROOT}/capture-authorization.json`;
const V11_AUTHORIZATION_SHA256 =
  "c681d7178be473943f4863d59bd30af9de435c23189a9392d2cbc0be3bc0a818";
const V11_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "d4b38596d2015c2c732c304071946fe7b9a8fe2827813415165ceeb416a76a02";
const V12_ROOT = "recipe/evidence/input-field-live-pivot-v12";
const V12_PROTOCOL_SHA256 =
  "ddd6e4bec408ebf277bd5fcd10aa3685c47facd6330f7c854d500ebfa437840d";
const V12_PLAN_SHA256 =
  "2c27c92f9f4b26092f29148d8ce46f9153f46a8e0943466d41905d9e5e11bbfe";
const V12_CAPTURE_MANIFEST_SHA256 =
  "ddc69bbeafd21620634f0cd20cf7e327670309e140b6cbfc0b25b121ffd2b8c0";
const V12_REQUEST_MANIFEST_SHA256 =
  "a717cff8c8f71ded2eb4f0375cf7f0d9862740b481febfcf98b8339dc0b5abb2";
const V12_INDEX_SHA256 =
  "b2225989a92599fd8dbc1daf3d1f91c3f787cb2169547f8c1e640189bd7f45ef";
const V12_HASH_SET_SHA256 =
  "c98ab30369e1be05dac4004908b5d6e53ef101aa69252d63ef6fa530bd397bf3";
const V12_AUTHORIZATION_TEMPLATE_SHA256 =
  "27d88d4d5869d42a43faf887867742e8222b89addf14a7465c137ce96fce10b5";
const V12_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v12-status.json";
const V12_STATUS =
  "attempt 1 failed closed; writer and extract accepted; host refused MUI content fill after in-writer restore; cleanup complete";
const V12_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v12-attempt-1.json";
const V12_ATTEMPT_1_SHA256 =
  "33267b5761dbe57a4d74765492bafea2dc79ff1520099c35091f3bdaabbcdb6f";
const V12_BASE_COMMIT = "f36968a7426201961bc50fd1534b8a113a6cb700";
const V12_ANTECEDENT_COMMIT = "8570f3e8c318977a51f5f41a7474dcc535b53b26";
const V12_AUTHORIZATION_PATH = `${V12_ROOT}/capture-authorization.json`;
const V12_AUTHORIZATION_SHA256 =
  "124b04ff2daae9d62ecd1167014fefbdf6c231578e3f966b545972af4a2b8a03";
const V12_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "649580fc43fa90a541d4ad4f3c7882e1854c1e15776a1aec698eb7623f325687";
const V13_ROOT = "recipe/evidence/input-field-live-pivot-v13";
const V13_PROTOCOL_SHA256 =
  "03bc63bb216b74de488b38424bd81925c3fda80b8529023610112cfd6cbe68d3";
const V13_PLAN_SHA256 =
  "4c62ffe9ad1d1db31749e9d813506df511b31ad19422634ac10936338e8089e1";
const V13_CAPTURE_MANIFEST_SHA256 =
  "91c0b99f301e751130b7d06df3c599c5fcb60abd4b47a0fb919f2c728cb8433e";
const V13_REQUEST_MANIFEST_SHA256 =
  "a150304c1fdcb40745b0896e2116981a4ef4f33c649b585cb04baecf71673211";
const V13_INDEX_SHA256 =
  "b4bbe16ddc5ed81b19a53bbb28b31051f1390c5c92172333456a56d5f08c202e";
const V13_HASH_SET_SHA256 =
  "33ee9507f441650c98c52c459b8c85028ea2018d9499a0a8654920cd1b71f8db";
const V13_AUTHORIZATION_TEMPLATE_SHA256 =
  "8c0329a717e00552e628dbea38e62074c6a57843b999bdc4e8eb4ce4d3f8d7b8";
const V13_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v13-status.json";
const V13_STATUS =
  "attempt 1 failed closed; writer accepted; hashed post-writer restore threw INPUT-V13-RESTORE-NOT-FILL; extract not issued; cleanup complete";
const V13_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v13-attempt-1.json";
const V13_ATTEMPT_1_SHA256 =
  "436bfe32562fc392942253cc9320ffc1f54fcd81a76c54496eeaffb80a7db653";
const V13_BASE_COMMIT = "685131cc33b56f40b4f520ed16d0998c5fd93164";
const V13_ANTECEDENT_COMMIT = "4c0710109f4e8a2eba701afe96ba4af9f4924dad";
const V13_AUTHORIZATION_PATH = `${V13_ROOT}/capture-authorization.json`;
const V13_AUTHORIZATION_SHA256 =
  "c000714eb070e41df760fd789458c650a7a941f4c17293f80bb4f742bb1bd372";
const V13_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "fdde0b7a293e7f6fc4e8b28e9bbffefb49aaf538ba6649b4c943d27ba22483fa";
const V14_ROOT = "recipe/evidence/input-field-live-pivot-v14";
const V14_PROTOCOL_SHA256 =
  "6fa68416b714d3b2e36cbe57be5fb2f05e9271a9e7f3ef955ed73071e3115a42";
const V14_PLAN_SHA256 =
  "89e092d519f38734650c27424d98515c327b28ab691ab6e847d87fd75765e033";
const V14_CAPTURE_MANIFEST_SHA256 =
  "6732b1ab7ec8a8c0716a9d69860e9607f325a6b8eb7c338491d9d133a206f577";
const V14_REQUEST_MANIFEST_SHA256 =
  "63aee5e693f139a01b2c41e8001bce9382b7264c83a3e797659df8c4afd04f33";
const V14_INDEX_SHA256 =
  "5846c279ec903b48d2cbdcf3b4626f037409c6a0bd1d276e7c15edfc12c389dc";
const V14_HASH_SET_SHA256 =
  "591d3f6dff2f631969467db6a4d45ccf81db7d2e8f80af5b073d6035f17cce16";
const V14_AUTHORIZATION_TEMPLATE_SHA256 =
  "16ad9316a9996feef844850a8d7001949f6f25984a0b5f37402bb88b09cb95b0";
const V14_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v14-status.json";
const V14_STATUS =
  "attempt 1 failed closed; writer accepted; hashed two-pass restore threw INPUT-V14-RESTORE-NOT-FILL; extract not issued; cleanup complete";
const V14_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v14-attempt-1.json";
const V14_ATTEMPT_1_SHA256 =
  "84c81d777bceda7dd2dc49ab031060c7f1a7dcb4d5bfc7e1b2ed516dfc657adf";
const V14_BASE_COMMIT = "75f3de450d1a9db1828edb0fb606cd86aaf208f8";
const V14_ANTECEDENT_COMMIT = "961d08f94853d2b90cd3b68963f5bc113e5ae066";
const V14_AUTHORIZATION_PATH = `${V14_ROOT}/capture-authorization.json`;
const V14_AUTHORIZATION_SHA256 =
  "0a608d7aab9c788be5af5f06df594b567c4997f6a7dfd32ecec560082b8ae57d";
const V14_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "6e8061a22d1464e44ecc8469ea0a5e46b0b7c26169f194c15edec85ed8bb4415";
const V15_ROOT = "recipe/evidence/input-field-live-pivot-v15";
const V15_PROTOCOL_SHA256 =
  "9eae721bbd84956ef16924e079a3ed7e58a97b52197ffd974d64a0df153af38a";
const V15_PLAN_SHA256 =
  "a28781f64fbf17c9e0164d2bf20cc53dd1d29f76da67b6acb388827046da76bf";
const V15_CAPTURE_MANIFEST_SHA256 =
  "a6b97af8f63dae252716ce8e39c6f81a88ecb7994e9ee65ed02b0bb722cac0c8";
const V15_REQUEST_MANIFEST_SHA256 =
  "e93615ac92b114ea332a4bd7d44f65a6df5c1d20b390f7c333efac39ed41cc78";
const V15_INDEX_SHA256 =
  "8c944fa92e1afa2ca09c6bc6d938490e1927077d613c603cdbc1f3a5023659d7";
const V15_HASH_SET_SHA256 =
  "b3194a4bff9ffa0d0033e58eebd024c91d29dd832fbf26b7bf12d04df23bdf24";
const V15_AUTHORIZATION_TEMPLATE_SHA256 =
  "504963863f1bb9eca046f72c1117d10d2d22d1ce82697d238d2e2281f5bf5634";
const V15_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v15-status.json";
const V15_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused MUI content fill; cleanup complete";
const V15_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v15-attempt-1.json";
const V15_ATTEMPT_1_SHA256 =
  "74b068d2ea29e4d3cee917ff130dc33e074f1025026fee42cf15efd1849731cb";
const V15_BASE_COMMIT = "0c56dc335dca4bf1ed5ed1ea06a2e3d1858c710e";
const V15_ANTECEDENT_COMMIT = "c1d3f0ac38f00fd005e80ed4d9e35ff393dbad58";
const V15_AUTHORIZATION_PATH = `${V15_ROOT}/capture-authorization.json`;
const V15_AUTHORIZATION_SHA256 =
  "2618b5df73ef7a1d4e4973729a99638d44ca5cd22f909b7207231982f9063374";
const V15_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "ff0f180c12a7b39572bb4de024c29d90bdda3a0dafaab6e40d25a611f00afed7";
const V16_ROOT = "recipe/evidence/input-field-live-pivot-v16";
const V16_PROTOCOL_SHA256 =
  "9e1d5d1db0dc925e1241b2088d0ad39d1ea38e7c19f8c09b70e8b9ce9de5b094";
const V16_PLAN_SHA256 =
  "a022f4b8a2723f563473d2fec2f60620ea261a8a5e3629a271047ee7f48486c6";
const V16_CAPTURE_MANIFEST_SHA256 =
  "53d9d94390d2e65872e05f325f962f5637bcb08224622eb4966727f34b00a977";
const V16_REQUEST_MANIFEST_SHA256 =
  "35acb1c81419122bb9a6630f35ace4c7b19af23913b657c9f9f634f465d15522";
const V16_INDEX_SHA256 =
  "f9eabfeecb2e4b7d81e3d43c4dfd4666e99f079e86d15eb8ce63e0e020a5c392";
const V16_HASH_SET_SHA256 =
  "ef4075e4fd16392e011756f4004b51c5eb4dce6c49f5c36d1d6a87d2e68666bd";
const V16_AUTHORIZATION_TEMPLATE_SHA256 =
  "86d7939cf3bc628861da6eb9317686b182fb322edba69bf134de88b4ea486629";
const V16_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v16-status.json";
const V16_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; hidden FIXED cleared; host refused leading slot solid paint; cleanup complete";
const V16_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v16-attempt-1.json";
const V16_ATTEMPT_1_SHA256 =
  "25518ea2ae4837c1787c7a6076118961b6a255d1bbd3cb56480ac26d344cf23a";
const V16_BASE_COMMIT = "72a3c5d8b9bbce9e53b730374d4a0796aa33a2be";
const V16_ANTECEDENT_COMMIT = "a764804c4191d161d08ab9527938ce6d29009af7";
const V16_AUTHORIZATION_PATH = `${V16_ROOT}/capture-authorization.json`;
const V16_AUTHORIZATION_SHA256 =
  "377ae973efecf53cbb3684ec449dd4f9f388ce36ad5e19572e681fb85ba15f8f";
const V16_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "cf89747d6dc04c6944170c2e4ea1450055eaabebeb6ba72aec05c049f1fa7ae0";
const V17_ROOT = "recipe/evidence/input-field-live-pivot-v17";
const V17_PROTOCOL_SHA256 =
  "01205d5c09c4a524ec992e7ec143075a205050fabe05efb839cd4981af6f935a";
const V17_PLAN_SHA256 =
  "b509569d92087ea02fa5a6d516215f7a455acf1d8f9c26ff7b87d650080805c7";
const V17_CAPTURE_MANIFEST_SHA256 =
  "69a32f440c485405a6e7fdf2090f9019c711298127a6e93886e64b4c74e0aa9c";
const V17_REQUEST_MANIFEST_SHA256 =
  "4de28e2b0642e3ce6cac30a8f42b996a175a7271e17d73acee912410cd79e621";
const V17_INDEX_SHA256 =
  "097ad396bdcaeb26ae091b18c4f9c5429fd4cb31a4f7c1e18e62146d5326d4b6";
const V17_HASH_SET_SHA256 =
  "847c60747734535fb81e178bfe52448eb0ceab0cffce61136ceddb002f86ded9";
const V17_AUTHORIZATION_TEMPLATE_SHA256 =
  "cc88455094b602b638a17d9ffa890b92917da566e4236c978a56f944f48045a8";
const V17_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v17-status.json";
const V17_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused leading slot color binding; cleanup complete";
const V17_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v17-attempt-1.json";
const V17_ATTEMPT_1_SHA256 =
  "f738d983cf4171a8f9bb3c8f2476ad83cb7e10fbb5fa53d1a3ff6ad844a10a6d";
const V17_BASE_COMMIT = "09b37d378b5750e6f2cefe2a6ebee953f7cb3dcc";
const V17_ANTECEDENT_COMMIT = "2a764e90d7683afd39ab08ad5b8cbf3e639c56a2";
const V17_AUTHORIZATION_PATH = `${V17_ROOT}/capture-authorization.json`;
const V17_AUTHORIZATION_SHA256 =
  "2f2a7fdb89b983f566f78da5bf0fc52f037cb8f33818941207b6854fe3e88b73";
const V17_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "66cbff883845e854f6d1fa03e478db12554ef8986d39dd347c90543c57661da3";
const V18_ROOT = "recipe/evidence/input-field-live-pivot-v18";
const V18_PROTOCOL_SHA256 =
  "c82b0debfba42095520c58d412e211af022a907269463155f01fc513d252239d";
const V18_PLAN_SHA256 =
  "903de60ced84f63cd38d1244d4dca83f1872805a6e8504e3600de3d27273c269";
const V18_CAPTURE_MANIFEST_SHA256 =
  "b21275e8a322297146c34cfbc0f86e582616cbd6346468f5526fd43458612f86";
const V18_REQUEST_MANIFEST_SHA256 =
  "a5831634ef8d26ee18ebdfda4a0feecef96a0f28d25bfeba8ca6f7296645949d";
const V18_INDEX_SHA256 =
  "7eadba3d0bdf170d6569c5e69087528b8667b669225a91016091033dacebfa75";
const V18_HASH_SET_SHA256 =
  "9ed64f20071e95785f2f4c16427e6149fec354715ac4915e005a76b70fe4e3bb";
const V18_AUTHORIZATION_TEMPLATE_SHA256 =
  "79c4ec3a5c98b84e0657f785df70ec158310d1fe74e9c3d6c2b364ebbb545c03";
const V18_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v18-status.json";
const V18_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused surface strokes.0.weight; cleanup complete";
const V18_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v18-attempt-1.json";
const V18_ATTEMPT_1_SHA256 =
  "e68dea24d839da6e8002658123b7e5ce21abf8a609c29122dfb461a2bc72672c";
const V18_BASE_COMMIT = "cd247ebbe050b74232dd4ad24602d733a7c1bb48";
const V18_ANTECEDENT_COMMIT = "cfdc6a7cff19b619640dc9dcea0d79a79f1ade75";
const V18_AUTHORIZATION_PATH = `${V18_ROOT}/capture-authorization.json`;
const V18_AUTHORIZATION_SHA256 =
  "7a95ddb633dbad6c8bf10110af41d18acfc11719dabc28044b28dead846671e0";
const V18_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "8d2c69e5310eb77f4c0bbb9f42d0bb23d01df03318d73705cf0ff40f33a70cb8";
const V19_ROOT = "recipe/evidence/input-field-live-pivot-v19";
const V19_PROTOCOL_SHA256 =
  "c66987b6c56660aa38962abbc1cc3a9dd12e1a63d539329016b8d7601b29522d";
const V19_PLAN_SHA256 =
  "94454e4a7cb4cf08cd1390a542a5df5047561091c498eb034ff848f31e5a704a";
const V19_CAPTURE_MANIFEST_SHA256 =
  "d9240b450b6fb9e78177b9b08d8580ed515ea5d5dc801e1f8188dcef0e7e4df5";
const V19_REQUEST_MANIFEST_SHA256 =
  "0c6f23180d7fd1ab4fa6dc199a5192ef48d2bc153b0a42747dc9514fee3aefbd";
const V19_INDEX_SHA256 =
  "fc5d43842b0c6cafb1cbbcf62980492a842f77598f60f0d3bed1a1957232082f";
const V19_HASH_SET_SHA256 =
  "7d3681aaffbe1273031424ae4a3d58d81df0d482e748dc74b3989a6300ce616d";
const V19_AUTHORIZATION_TEMPLATE_SHA256 =
  "8d0caceb537cd809f2e15aa5d48c208f6f94ddb1cfb9de34baff99d28ddd0322";
const V19_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v19-status.json";
const V19_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused variant layout.width.value; cleanup complete";
const V19_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v19-attempt-1.json";
const V19_ATTEMPT_1_SHA256 =
  "2e9126c40c8b24fb12f70362667fe13d51d08fd1c3841ec1d57195c4d579671c";
const V19_BASE_COMMIT = "7a576062c2998f5fa0733c856f7b0424a07b674d";
const V19_ANTECEDENT_COMMIT = "53e0ee50e1c7ab08442bec8b666cd95cbd92e600";
const V19_AUTHORIZATION_PATH = `${V19_ROOT}/capture-authorization.json`;
const V19_AUTHORIZATION_SHA256 =
  "fc8c0d6baf426239507c5d1c8e8c5c40d1b9c01f7a0bddd90230b9956b6012e1";
const V19_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "af528b74b14780f6978056ff803c452b27a714830eeb405a1a47fa936a970de5";
const V20_ROOT = "recipe/evidence/input-field-live-pivot-v20";
const V20_PROTOCOL_SHA256 =
  "26c3963c6ec9d3861f21864574749bd34f1788ad4ef43f20365419e559f87457";
const V20_PLAN_SHA256 =
  "cc98c2d57d7aea3c0b5805551cab9ab6b6e6235f66be21b493258a47832d7db4";
const V20_CAPTURE_MANIFEST_SHA256 =
  "d27a59179341768bc65207e391bc28bf8666c212ed9b0d40915e2c7c61dbae23";
const V20_REQUEST_MANIFEST_SHA256 =
  "881bc283a5fdf27f0b3da416b83a2b7615eb8e728a8b92fc082ad424348a8543";
const V20_INDEX_SHA256 =
  "72207d604be0227da52ab915d8f904ebd829c6f8ba21dff284e01f88ac4579b2";
const V20_HASH_SET_SHA256 =
  "77e11c350bc72b932005b94c5d6bc42e84fe1223e500ea98a1c3a67472f7a512";
const V20_AUTHORIZATION_TEMPLATE_SHA256 =
  "ff10ae48cb5c7b0a67283befa361dca5f47d13a7965f45a8b216062ba77e5a41";
const V20_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v20-status.json";
const V20_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused surface layout.height.value; cleanup complete";
const V20_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v20-attempt-1.json";
const V20_ATTEMPT_1_SHA256 =
  "20288480b8dbaa83db4b2c1e9ea0668c13b3079f79d2df6283a6828b4144f571";
const V20_BASE_COMMIT = "4e0e582d2b64202d07a99a5471bc5ff40b87bb9c";
const V20_ANTECEDENT_COMMIT = "d49f2da22d897b4a42e1a0e0f8ef302c61383417";
const V20_AUTHORIZATION_PATH = `${V20_ROOT}/capture-authorization.json`;
const V20_AUTHORIZATION_SHA256 =
  "f43874d8748b45cfc02ea2621e877bcc22028a8153b71f55485396e18c595422";
const V20_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "40f026cd0bd21e156746997fac2aba7fbe5a36890f3a8e561c6fe70022eaddc7";
const V21_ROOT = "recipe/evidence/input-field-live-pivot-v21";
const V21_PROTOCOL_SHA256 =
  "daf727012e12e1f6c5187e2013c4c53454db369d4b51c1d9bec02800e9390b98";
const V21_PLAN_SHA256 =
  "69f33d7c102b1c884d83edbc481b7dfb0bdb3b1dee2a21fd9202138eeda7d218";
const V21_CAPTURE_MANIFEST_SHA256 =
  "ece35b85c754f0ed5ee7a776ef1f6dbb2ee67f4cf2119ca5a6845f3d36212957";
const V21_REQUEST_MANIFEST_SHA256 =
  "a601fc22ccacc377866bc20006917764462139f26975502a2aac2fa95ede0380";
const V21_INDEX_SHA256 =
  "131f1abbabaedad7a5c521d908e374c65db8f2ab02b8ee3b40d59433967a42ff";
const V21_HASH_SET_SHA256 =
  "06c80632ce8fa1dc1f646d4ca0652212037f5b42906141441be990ac5510f796";
const V21_AUTHORIZATION_TEMPLATE_SHA256 =
  "ae2897a85daa6ec6d5407b18b9b42f57a371d05ead0363fc6edfc24e9a24faec";
const V21_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v21-status.json";
const V21_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused variant bindings.length; cleanup complete";
const V21_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v21-attempt-1.json";
const V21_ATTEMPT_1_SHA256 =
  "6bbd0f6dccce3c4b83c87b2f9793d50d46ba0fc3d5c994236ce7f934b9594f57";
const V21_BASE_COMMIT = "1cc5177e6d76e92f4950a674d3370959557f03c8";
const V21_ANTECEDENT_COMMIT = "21fd65bb5a1f9874b96de05547dc092298738f59";
const V21_AUTHORIZATION_PATH = `${V21_ROOT}/capture-authorization.json`;
const V21_AUTHORIZATION_SHA256 =
  "15afeb3ecab3bc6493f6738a07c97e69f8bbe628afe92538a0c9bb807f865d3a";
const V21_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "d26147dd1a658f2a3d585437c44105eabe7dfe3abfeac349a138e1163175d09f";
const V22_ROOT = "recipe/evidence/input-field-live-pivot-v22";
const V22_PROTOCOL_SHA256 =
  "05f623519040794aa2e1b41e9b5bbaeff08bed7d1df871f2ba682d2de607385e";
const V22_PLAN_SHA256 =
  "cfb224bb496d6c690b9e824674cc900602d14ae6805a1e177f6a9e132fe50000";
const V22_CAPTURE_MANIFEST_SHA256 =
  "bd75d88f9aa1338c2504b6b2e097e0e54998bcf4db4c685accd5380f83c1b249";
const V22_REQUEST_MANIFEST_SHA256 =
  "b411ed8b31c53d204af82cbd26eb6ccaf41dfda05614763171e6ef5914afe857";
const V22_INDEX_SHA256 =
  "10bac5a8b65db4c6618132818eadf7345c6045bcf3e48e29c2b2e547e0692c7f";
const V22_HASH_SET_SHA256 =
  "948c240ba4d92ae1a182cc9741bcc03e9f1759ffc2d1d20b3174c7ab04b4a5a6";
const V22_AUTHORIZATION_TEMPLATE_SHA256 =
  "affd3ecb36a94f5927d50afd1f6369bc2961417bffeac5bc7c3369d583a91841";
const V22_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v22-status.json";
const V22_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused variant bindings[1].field; cleanup complete";
const V22_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v22-attempt-1.json";
const V22_ATTEMPT_1_SHA256 =
  "4ea930a3a31a7f835a0af8adb7ef5d7c07f405304c79aacc66f9ae3b5d45468a";
const V22_BASE_COMMIT = "2ce24dc2292ed8c85fa5bd0eae38ff87fc503a65";
const V22_ANTECEDENT_COMMIT = "edcfe4fbc45c72932d414f4b006d163a18f922d5";
const V22_AUTHORIZATION_PATH = `${V22_ROOT}/capture-authorization.json`;
const V22_AUTHORIZATION_SHA256 =
  "d29a41ee155fb6645d0ccd40a136933530f91b4b6f90bc1dcdc377be5fa5b0e3";
const V22_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "020c28eb8a67e123d0c4b5965a92a2968716fedfc2f02b0875e272fe4c32598c";
const V23_ROOT = "recipe/evidence/input-field-live-pivot-v23";
const V23_PROTOCOL_SHA256 =
  "e9f4dad3cbe3e034ab3c6d14412b464856964416c814a9df6e6b2a3d9e65c914";
const V23_PLAN_SHA256 =
  "9a6cc1846db81c77c650405a6d25deafd08adb209c2ef25c50c6379adffeaa2b";
const V23_CAPTURE_MANIFEST_SHA256 =
  "a58cf7b4764d822febeea9f24b6626d95f542704e5e1cd63e4c48753837cf840";
const V23_REQUEST_MANIFEST_SHA256 =
  "db159e01c92e9d20f2abde856670fc13f09da152fde984a444a7c3a15c865d38";
const V23_INDEX_SHA256 =
  "d332815baade80b48e8caa1182296058403cb55fa3a7b7f4b893da7be4a2e305";
const V23_HASH_SET_SHA256 =
  "ede8f5ff46d10b2f860e9cc75762ce97512af4b18bb3340fd1af8ea261f44ee3";
const V23_AUTHORIZATION_TEMPLATE_SHA256 =
  "283bdf1e481d5f9441ea05e7ef6544061f66e89849e425c83f2cc7927961bfff";
const V23_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v23-status.json";
const V23_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused surface bindings.length; cleanup complete";
const V23_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v23-attempt-1.json";
const V23_ATTEMPT_1_SHA256 =
  "39e3c76ab9d795c304343c40e99deb8882b5b0a2b94edc91556cc4e53b08f452";
const V23_BASE_COMMIT = "033c94d7a0a6bdba07be064e2e79ce377a6e75d7";
const V23_ANTECEDENT_COMMIT = "7817a11e1340cb386030b4a9d05fde2d6fc72e22";
const V23_AUTHORIZATION_PATH = `${V23_ROOT}/capture-authorization.json`;
const V23_AUTHORIZATION_SHA256 =
  "e36c14bc051a75ebb3a8f2bb42738c0fdcc4c13a4ad13933b09d21934f9c1d1c";
const V23_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "7a72ee82c5ea05f7d8cba29c0893933376fe56aa7ce4d86ef6622583442f691b";
const V24_ROOT = "recipe/evidence/input-field-live-pivot-v24";
const V24_PROTOCOL_SHA256 =
  "d9292b735676802ac92361f5174449d2c55f6d5bbeeccdfe5ce83ebde7cb892c";
const V24_PLAN_SHA256 =
  "92272b9dd094e377260dc292f874a7ad240355d3c0ef1af52efae2c39dece45c";
const V24_CAPTURE_MANIFEST_SHA256 =
  "0ef928bf788fb029e2db7496dbdf9c4f9e632134fe1951ef46b76dd72de2be5b";
const V24_REQUEST_MANIFEST_SHA256 =
  "50d7bd64195b2b1825892959f5d43feb509b76683e3bcfc47d263d5a2a3d732a";
const V24_INDEX_SHA256 =
  "b704897dabc85854479d0fea26fab5b0646373a1f06305fe7af77310f0279ef5";
const V24_HASH_SET_SHA256 =
  "7132d6d0bf580e41f3d39b688f7b7796ab53245d85b4d3201b8bd13d5d0ec253";
const V24_AUTHORIZATION_TEMPLATE_SHA256 =
  "28064b4874c19ee4b2f5a6faeeda7ed0dceef86e8748cc75b9adc8c44d4a3583";
const V24_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v24-status.json";
const V24_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused surface bindings[0].field; cleanup complete";
const V24_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v24-attempt-1.json";
const V24_ATTEMPT_1_SHA256 =
  "b24de818261cc88d84b30d6dea2f11902893fae321e24e127588113bc3ea5cc8";
const V24_BASE_COMMIT = "824cdd6a2bffe4bd67ee6757cd1a86c8bfac21aa";
const V24_SCENE_READBACK_SHA256_PIN =
  "f8efe1c1dbfb7a8013716be81855971f05cc17c7653a81a8a97a2dde4f93c2ae";
const V25_ROOT = "recipe/evidence/input-field-live-pivot-v25";
const V25_PROTOCOL_SHA256 =
  "ae5287f5eab58d53a9ff14cfe06bfd45b2bbb1c8ba75996bff4d405d3c65f8cc";
const V25_PLAN_SHA256 =
  "ed1344a20d9c9883c8c1c3cf6c4584a1799d0f12cc39dce1b343322c9a91b26f";
const V25_CAPTURE_MANIFEST_SHA256 =
  "98b61b718b70951491c09375b9706bc63dc30112cc0a6b0115356e033ae0232e";
const V25_REQUEST_MANIFEST_SHA256 =
  "c15b390bbd1276623417ec8df98ea497c67540db48c83a37557e383b39bec4dd";
const V25_INDEX_SHA256 =
  "232e19729f42c08cd6a00713d377d0798190dd4bf31548bbfcc76782d5cec76c";
const V25_HASH_SET_SHA256 =
  "474cf5b321e3728d6afb5d035e6967c75165a4b76be1f5d98cf259300b166230";
const V25_AUTHORIZATION_TEMPLATE_SHA256 =
  "f40c82633e04f41bb646b61f90efc1b036e9406bc11da8e9f5f14c306cf651ac";
const V25_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v25-status.json";
const V25_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content/placeholder bindings[0].field; cleanup complete";
const V25_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v25-attempt-1.json";
const V25_ATTEMPT_1_SHA256 =
  "ff0a44ba5fd9e1bcb920ebc3b42f013471025aaeffefe86213c38026c276d6d6";
const V25_BASE_COMMIT = "316a81051cdc9f95e28d9410e03eb56e1bad57b5";
const V25_ANTECEDENT_COMMIT = "5dcdd4fca890713d6378f8491f442761dab1837e";
const V25_AUTHORIZATION_PATH = `${V25_ROOT}/capture-authorization.json`;
const V25_AUTHORIZATION_SHA256 =
  "c274c71b272072d47087498c442c63f750bcba1cdc39ba1dcf031dc663d2d662";
const V25_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "a15336a1c85f3fc7f3f5a669f2173fecca8c957377511e9c3f1b8466202562ae";
const V25_SCENE_READBACK_SHA256_PIN =
  "4c4b10322a56b37ad2162c1ff5499bbafa19a01f184353f73b2dbd0c7407751b";
const V26_ROOT = "recipe/evidence/input-field-live-pivot-v26";
const V26_PROTOCOL_SHA256 =
  "21a7a8c66dbe80935c0f5b3c51b754d9b50d7a73f0fee4e71226f029f91d44ce";
const V26_PLAN_SHA256 =
  "19558a0e945e7000d4b02bbc5367084a165076f1b55c7ac25b9e3dc5e7d10efe";
const V26_CAPTURE_MANIFEST_SHA256 =
  "269fca1bc88b750424ae53da52b9b48669c50dcd9b868358f930a43833548e86";
const V26_REQUEST_MANIFEST_SHA256 =
  "f3ce012a5352dd7c1e1b6149eb95d4e75bc213ef1adee0758cdf6ccde29356ac";
const V26_INDEX_SHA256 =
  "a905a0896facb39793e579ae61397fcb5b9b0f0e82601d1b4a921539df4c516f";
const V26_HASH_SET_SHA256 =
  "c7665742633101b1b84f3d2a0d6ff21ab59cefb7103d0afb9195956ce3dcc63f";
const V26_AUTHORIZATION_TEMPLATE_SHA256 =
  "cd7b9bc7bbc364176c542ce847256ec6395d109d4ecfe29a0f3b34d2b97fcffb";
const V26_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v26-status.json";
const V26_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content/placeholder height.mode; cleanup complete";
const V26_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v26-attempt-1.json";
const V26_ATTEMPT_1_SHA256 =
  "0da96a75beb493f7bba564f021dd4428682254df4efd5bfc2e1f63665a2d6e77";
const V26_BASE_COMMIT = "629078879e34b8380bb52a39eb6ff5e8794e7166";
const V26_ANTECEDENT_COMMIT = "ae5811a45a2508a5387b99df4fcebbb12a8ab167";
const V26_AUTHORIZATION_PATH = `${V26_ROOT}/capture-authorization.json`;
const V26_AUTHORIZATION_SHA256 =
  "86b97761fe7ab95027c1fbe9aeffe4be672fe1fb9e5d2e889f1f0c98f3e38b40";
const V26_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "e8f4ae846769df4a62f977ccfb6df299b7fdbdb2234ae51233519b20d69ed1e9";
const V27_ROOT = "recipe/evidence/input-field-live-pivot-v27";
const V27_PROTOCOL_SHA256 =
  "d96a59404bd20deeb45e15bce9418488d90b461e5646e3f5a11d12df0ab5d8d7";
const V27_PLAN_SHA256 =
  "6397da1b326061f680244a64bfb26d0af3c3477be44b60131e7bac5865ed3f48";
const V27_CAPTURE_MANIFEST_SHA256 =
  "49dee85ddcf13ed8c5071a9c91fe2128e66f3ccb6e4d0146671b7e96458f4602";
const V27_REQUEST_MANIFEST_SHA256 =
  "84f173bfccaa63524b4962f26d03eb6cef73786a0ec3d21a327031a88795a5c6";
const V27_INDEX_SHA256 =
  "692ba21729c1949819e10452fe815fe09b8d16b8ab44aa9c139fc3f26a461827";
const V27_HASH_SET_SHA256 =
  "4b860a61caceb3e6e3632089c6edd34d1d201dc81b0dcb32d2472e8703918a4a";
const V27_AUTHORIZATION_TEMPLATE_SHA256 =
  "fcd2a44cf8871a4d61a712326a41ab2538e76d1f2a0966a65509a8bb7a1d15aa";
const V27_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v27-status.json";
const V27_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content/placeholder type.letterSpacing; cleanup complete";
const V27_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v27-attempt-1.json";
const V27_ATTEMPT_1_SHA256 =
  "f8530a0afc1af4ef1bb0df1a9366c7eca6fc4e5c0a3866d74a8429791b3debc7";
const V27_BASE_COMMIT = "b4f12c030ec24ae2e90541fa84981f7d2ec63bc1";
const V27_ANTECEDENT_COMMIT = "99b26f7f2448f8dfe1f7cb14d3e0b5ddd84f0e75";
const V27_AUTHORIZATION_PATH = `${V27_ROOT}/capture-authorization.json`;
const V27_AUTHORIZATION_SHA256 =
  "da8dfaef750b3e2151ee33effe42a825963d69719de9ea6c7b05a5cb1f316b8f";
const V27_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "02f574f89ab1363fbf6ebfae2211f5d2c134a14b96807bf19f625a541f14ee24";
const V28_ROOT = "recipe/evidence/input-field-live-pivot-v28";
const V28_PROTOCOL_SHA256 =
  "79b35db764371486fa63c63574b5e0e5d17404aaf5e02a0471f219c88a3cfc51";
const V28_PLAN_SHA256 =
  "edbebf1ed2ad21f5f46c92dd3642596ada6b9f1e436622b49552bd1ac2b39f3b";
const V28_CAPTURE_MANIFEST_SHA256 =
  "1b8eff6ecd8d08598c31ed8954456e801a26709c0712d8dd6473c15575ed5be0";
const V28_REQUEST_MANIFEST_SHA256 =
  "f2a18a5d11108b09d40b20286f7e57dbdb478eae64e6faf5fa27ac01e1272bcb";
const V28_INDEX_SHA256 =
  "ae452c62e4867fddca3b2a1b4ac0a123c8a057ce7581020cfee4ad72e7c3f3cd";
const V28_HASH_SET_SHA256 =
  "0262d622c35f172a156e546593844b42b0fb6bf148e4f24612671a411ee5828d";
const V28_AUTHORIZATION_TEMPLATE_SHA256 =
  "e51c58a11cd3fed18bc56665042dd1bad2333530132905f128215ac7d377eced";
const V28_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v28-status.json";
const V28_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content/placeholder type.textCase; cleanup complete";
const V28_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v28-attempt-1.json";
const V28_ATTEMPT_1_SHA256 =
  "769d9634c65271a3ba799417d12bbd85a1429e9b09c2b2a1acb3b9b1517c0137";
const V28_BASE_COMMIT = "1f455f99710f617106e192c904b6609d0f04b6ee";
const V28_ANTECEDENT_COMMIT = "2141a920c6eaa9e21412e5e42d2f10328bc51d52";
const V28_AUTHORIZATION_PATH = `${V28_ROOT}/capture-authorization.json`;
const V28_AUTHORIZATION_SHA256 =
  "4bf14963ace7c3cff8f90a097f276e9e764a37a954daf7bf7e0e48bd96376fbf";
const V28_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "c6b31af37139b42eb281440301de5ee67f0944ef965782faeb18a69d79906db8";
const V29_ROOT = "recipe/evidence/input-field-live-pivot-v29";
const V29_PROTOCOL_SHA256 =
  "cbf2908da4bae1adc17916299c4b642c80636010d99d7585f9b5de9918276a71";
const V29_PLAN_SHA256 =
  "0f74013d9edfadc5126d376ea297077b24bb8ae9b27a281d448e92568a7f71a5";
const V29_CAPTURE_MANIFEST_SHA256 =
  "4228cb783a36e3f1448a158dd0115de2856bb4c8b4885fb23e763f19b6f48bf5";
const V29_REQUEST_MANIFEST_SHA256 =
  "c87de59ddc42e4823f5fc3379a21617472d631211534c4b5bdec3c1eac1499de";
const V29_INDEX_SHA256 =
  "3020fb1f63de66f4eed689361a889d9cdb27a521ac4bba43b53a1a877762a5ee";
const V29_HASH_SET_SHA256 =
  "c4b0d2b4e75ec4cf9d460f20f9e520099f105a07efbeb6e1dae9b4da41b2d2c3";
const V29_AUTHORIZATION_TEMPLATE_SHA256 =
  "cfb30449431f769bbb144bb33bd51b2fe0e95dc6b689bda15f83a0908185806e";
const V29_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v29-status.json";
const V29_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content/placeholder type.textDecoration; cleanup complete";
const V29_BASE_COMMIT = "fbdc29e8247daaf2a1fb1c3a155a34f033dcf9fe";
const V29_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v29-attempt-1.json";
const V29_ATTEMPT_1_SHA256 =
  "8e2bb26cf23dd2dacf5ab8d1ed5e49a8f2b2129c28ccf1029c73fe8617328328";
const V29_ANTECEDENT_COMMIT = "b54a2ea24a7172cb0caa9a9072ed2fd40f661ad0";
const V29_AUTHORIZATION_PATH = `${V29_ROOT}/capture-authorization.json`;
const V29_AUTHORIZATION_SHA256 =
  "5d4850eaed7f8ab57d36040e23dd66b1f4eaec78ca43cb292575fdaec06c4a01";
const V29_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "29af345ee115b69609c97c301a4732259a63ee3a4313c4445d08662b3c4cf130";
const V30_ROOT = "recipe/evidence/input-field-live-pivot-v30";
const V30_PROTOCOL_SHA256 =
  "25fcf787746d62055a3d1b603d905b59609805cca943ec70227bff1771647110";
const V30_PLAN_SHA256 =
  "d2a49aeeb61906019bdd6d5f16c945fbc00ea1619cf2b7f09f24381d662b7598";
const V30_CAPTURE_MANIFEST_SHA256 =
  "4b207a4ab6115484c50331ff2dfd23774db93628a110c0e5837ae3ce2c5d62bd";
const V30_REQUEST_MANIFEST_SHA256 =
  "ccd6248b12d6cdb403ebba56d633d5700d17813fe87457c203ba8f6b3bcfd9a8";
const V30_INDEX_SHA256 =
  "2d571d91900c421993e46c0ecceb251b576dcba78ebefd3132f4bc175e67909b";
const V30_HASH_SET_SHA256 =
  "accc5c80ea470532e7ec45b79d8af54ae44d336afadfac31f348c3d8f980f750";
const V30_AUTHORIZATION_TEMPLATE_SHA256 =
  "ef7ac6202c995e409e8be1b7526889ebb605f0b86126f8dc6a5336d51a291c8b";
const V30_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v30-status.json";
const V30_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content-row clipsContent; cleanup complete";
const V30_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v30-attempt-1.json";
const V30_ATTEMPT_1_SHA256 =
  "73e6e05ac51b71b391ee9d0e49bbf00fa9017b9c566bbc9a22abe15774aaaed9";
const V30_BASE_COMMIT = "0bde28a6429369d0f6c612d831ea0c14374ba732";
const V30_ANTECEDENT_COMMIT = "fdad5d7bb2920b8688946b8a5d735b337a843551";
const V30_AUTHORIZATION_PATH = `${V30_ROOT}/capture-authorization.json`;
const V30_AUTHORIZATION_SHA256 =
  "5c489d305e69f1a850874c8962bba1dbf053eeab19ba3ba3e8781052ec63c8a5";
const V30_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "52b157be09d08c7296c062267663c604e152ee7c368e0620a26490a5a872fc60";
const V31_ROOT = "recipe/evidence/input-field-live-pivot-v31";
const V31_PROTOCOL_SHA256 =
  "efcb0b75df93257b0e03fd9df96c646c52bea4a79d570cc98dc9c576f5477218";
const V31_PLAN_SHA256 =
  "dd654b1330f936d90076370b7b7d17b4d94ae2e238e33e8d852e11e54d9b5d70";
const V31_CAPTURE_MANIFEST_SHA256 =
  "f885ff52e6c5ccb802807e10e7fb59262367ddae792107824d1c9307759fba9e";
const V31_REQUEST_MANIFEST_SHA256 =
  "542fdb385a66585434cc8fcd079090d1e4160d5aed292f0299d6073d49ad2e58";
const V31_INDEX_SHA256 =
  "84d6ae0831e158cf14dbdd123defd1ccd0da50290a260c4b26893e20ac69f6e8";
const V31_HASH_SET_SHA256 =
  "0de5c2e038d642091d49c191e77d357b26c21194a857272be6d72ed892c9e98d";
const V31_AUTHORIZATION_TEMPLATE_SHA256 =
  "9e94693fb1bd37bf04ec2d75d1f4a6430d026e22aa0a0b2bc4f746d06e1261ad";
const V31_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v31-status.json";
const V31_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content-row cornerRadius; cleanup complete";
const V31_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v31-attempt-1.json";
const V31_ATTEMPT_1_SHA256 =
  "4499eb974868fae455200f1bca28e75fce0123ca2523fa2786bd9846d88bcde1";
const V31_BASE_COMMIT = "5bbbd79ff2b58c0297f3cfcc35bbcde2c13635f8";
const V31_ANTECEDENT_COMMIT = "d5c7aa643f6f69a6fccd2377e23d749d90c07547";
const V31_AUTHORIZATION_PATH = `${V31_ROOT}/capture-authorization.json`;
const V31_AUTHORIZATION_SHA256 =
  "c52dc7e5ff2f8bc5a7096b2dd9bf5abd3834cc298486e02818537e9ce92dd0e7";
const V31_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "a9afe8aa161c81ce584765a9a2fb02945b84c4ddf1760af5c72e356e445300d6";
const V32_ROOT = "recipe/evidence/input-field-live-pivot-v32";
const V32_PROTOCOL_SHA256 =
  "7db70b361dd596f92b18e502e9b7af261ecd6c2a57fe3f30c67f7ccbaece7a58";
const V32_PLAN_SHA256 =
  "90e46020f08e013cab13281b6b830d7f2145bbf6c429b1ec0857d9cc78826db6";
const V32_CAPTURE_MANIFEST_SHA256 =
  "5a7179752a8afc26b13232c110eecbecce939f37c1063f83b9e50ed815cbfeb5";
const V32_REQUEST_MANIFEST_SHA256 =
  "bc23b3f85b2ccdef31ca6d795af513ec7a00aef6209ce5a5a2e19e6463199a1c";
const V32_INDEX_SHA256 =
  "f10062e820f799d1dab3b41939e55f4c8ca1da6d7cf4cb3f611629391a9a4648";
const V32_HASH_SET_SHA256 =
  "8384d4d93fc867a5654387f23f11a259982743bdd72a7da9d4efb1325474ab9a";
const V32_AUTHORIZATION_TEMPLATE_SHA256 =
  "80accc61909fea8e1c7f3616d4fe5b96dbebfe991f8949e65d8e2b684ebe1e7f";
const V32_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v32-status.json";
const V32_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content-row effects; cleanup complete";
const V32_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v32-attempt-1.json";
const V32_ATTEMPT_1_SHA256 =
  "8cfb209f92fcc84be3eeb0b26bece9b72cb46d4e2d36fa4292a3c02f9444445d";
const V32_BASE_COMMIT = "c3f623cad90d60c4df38c2907d65ed2e447a3250";
const V32_ANTECEDENT_COMMIT = "1c034dd099c60778880a646a61691e0117978948";
const V32_AUTHORIZATION_PATH = `${V32_ROOT}/capture-authorization.json`;
const V32_AUTHORIZATION_SHA256 =
  "38c4194338cc6dd44cd6b0f56515e4d73c82aace1119b396f372f6368dc8f566";
const V32_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "23d17df323f7f07709eb8bc4242dabd6751bb6c9d4bc6a5ec4d7e7bc2b992aa0";
const V33_ROOT = "recipe/evidence/input-field-live-pivot-v33";
const V33_PROTOCOL_SHA256 =
  "d4125e2aba6fc1553efc2873b8f4724b2dd89ece8eb2d74e5a8ccd0a7837340a";
const V33_PLAN_SHA256 =
  "e9d91a3e30895c1664d6d0244306eaa95e517f9073d205d88719326545c76bbb";
const V33_CAPTURE_MANIFEST_SHA256 =
  "483701eb329888f186bfd8efab28c1e68bcf7665d85e16c32a9f7eb5c742ee6e";
const V33_REQUEST_MANIFEST_SHA256 =
  "908239883cff3766e0c56c92905088f5b3997e9a84ab5380fb50eb03cf077db6";
const V33_INDEX_SHA256 =
  "26eca04b916de5737702d5a7cf2c642d84a2e3457fac17521b30b8b1c7694ea5";
const V33_HASH_SET_SHA256 =
  "4e7a73438174dfc00e251d15955d07e3c60a8fa19fdbdfb50e0b1840a6b35d61";
const V33_AUTHORIZATION_TEMPLATE_SHA256 =
  "cfcd361b72e6aba08046a9b7f4c67ff85f2a8a7501826aabeccedbe45e0add10";
const V33_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v33-status.json";
const V33_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused content-row strokes; cleanup complete";
const V33_BASE_COMMIT = "081133af75dfd99356608fb9ba7aed89d349df8d";
const V33_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v33-attempt-1.json";
const V33_ATTEMPT_1_SHA256 =
  "eb104418532069e6b83c251cb064928d6c09a43e9a89fc8bed657ef847574676";
const V33_ANTECEDENT_COMMIT = "dc0c7fa0a51973e894c286ad6f4be48fd12b5a0a";
const V33_AUTHORIZATION_PATH = `${V33_ROOT}/capture-authorization.json`;
const V33_AUTHORIZATION_SHA256 =
  "0b37e33f7ff5c9eb96e078d76ee649a16ddd5196809319e21a0c89e029968657";
const V33_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "0db7e3ec14cfae5a55d3cd9fcd8e4542b00844020c3a82bdc4157b0d09b6ea8a";
const V28_SCENE_READBACK_SHA256_PIN =
  "44540881e24bd2e28f40917a4d6c289462f5ada0c9a30d8c565e18aad2521ac2";
const V29_SCENE_READBACK_SHA256_PIN =
  "95eebb6dcc343d3a715989b836dbe4650cc9bbe798b880382a1a0bda49e60a51";
const V30_SCENE_READBACK_SHA256_PIN =
  "ba3f671b69a4a348a4ea910cc85d1291f43d9b4b630500b6082b1408e560ca0e";
const V31_SCENE_READBACK_SHA256_PIN =
  "700ce0a06982ead66076fd5f5b39bc3cbe3de37467b7e8d531f34469dc33f2ab";
const V32_SCENE_READBACK_SHA256_PIN =
  "275b30092b67d851c27226e60d20154ab0417f03d26184551ed6dfbc0c756eee";
const V33_SCENE_READBACK_SHA256_PIN =
  "421c41d4ff87720e4de3a3c60c949c2b10be7468eeab9a9ac885c0033fbed578";
const V34_ROOT = "recipe/evidence/input-field-live-pivot-v34";
const V34_PROTOCOL_SHA256 =
  "2451fb785864163a432df63b38a9758378ac39987775f958090f3f7133efd104";
const V34_PLAN_SHA256 =
  "a52217124491da3891b295b2a0a5761cc95048f2f4d31ea19b7b5e9a3f033db6";
const V34_CAPTURE_MANIFEST_SHA256 =
  "f132dc7961c971ff3e2aa6e74587529215b835edbca1a0d1498be84173adfed6";
const V34_REQUEST_MANIFEST_SHA256 =
  "d800e24781f8b8e866bb010ce74df114119b0002d4c74cfa476a38f4f4b354aa";
const V34_INDEX_SHA256 =
  "cd0a09a4272a35402b769353508960ac903a3f2b65da08f6c0635057e915b94d";
const V34_HASH_SET_SHA256 =
  "834998d57066141a7749bf2e801311cd73d808215b25591d677c3a8a639cf093";
const V34_AUTHORIZATION_TEMPLATE_SHA256 =
  "0aa114dba0f62d896b91992d3931cfd68acb637c2056b286d62c1ffec0d060c3";
const V34_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v34-status.json";
const V34_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label bindings[0].field; cleanup complete";
const V34_BASE_COMMIT = "e729ab475f0617288b162576b702a0148ceb98a3";
const V34_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v34-attempt-1.json";
const V34_ATTEMPT_1_SHA256 =
  "d503daa1a3e2eabdf7cc815e852fbc2bcb08768128609df0ef0acf7b9f87fa4a";
const V34_ANTECEDENT_COMMIT = "8db64d02a3d87f4b34f9cf64ff7cbeac3a060d41";
const V34_AUTHORIZATION_PATH = `${V34_ROOT}/capture-authorization.json`;
const V34_AUTHORIZATION_SHA256 =
  "6995d6670392925d57baafd886e1ca84b57514766368af1a77e41606b4ff3673";
const V34_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "bd3cde85208f02733c951cb18009d9617813b36ec67906c1b91c275e2207b7cf";
const V34_SCENE_READBACK_SHA256_PIN =
  "9da3d6a6d0583cd18b778906427d369b701cf3ac1799c679186f8c5e6b60d864";
const V35_ROOT = "recipe/evidence/input-field-live-pivot-v35";
const V35_PROTOCOL_SHA256 =
  "36aba71c1c55702d8d9c77d00e9e7bc98df04cc75b5f91916f87389d2d524b43";
const V35_PLAN_SHA256 =
  "30abf049b3fe98a9bb2f2d865f2dbac3a9924279f531b412443306e1076ae74a";
const V35_CAPTURE_MANIFEST_SHA256 =
  "e2aa38e58ea554eb36cfdb2249aabfa3195c3bcaf5f2af32a12cb1b8bce79225";
const V35_REQUEST_MANIFEST_SHA256 =
  "7c66ccd8dc0256bde3316a15180a03f7d0624d1903f075b58e8941819c55ec7d";
const V35_INDEX_SHA256 =
  "0d3170e9e9f17f67b5e28530082c94d3e82f83e975357033899237dcb457a32d";
const V35_HASH_SET_SHA256 =
  "0e4d41c5ffef4bf7f7611def14796811cb89ecc1a7852f51da35119525b2e678";
const V35_AUTHORIZATION_TEMPLATE_SHA256 =
  "f010e5b2cec4983268c5cf07c895a7bfdb984febe005a05b572ca89a0bc903d3";
const V35_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v35-status.json";
const V35_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label type.letterSpacing; cleanup complete";
const V35_BASE_COMMIT = "b19f3d16cdb845fb275450ad9a4fd5a9383a88cc";
const V35_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v35-attempt-1.json";
const V35_ATTEMPT_1_SHA256 =
  "bcdbc4b0a0c81a6161b00830337834acbdd4c6c4e0bbe8d0867194b817ec2e01";
const V35_ANTECEDENT_COMMIT = "341e690a223d598dd93d3680333adcb89fab07a8";
const V35_AUTHORIZATION_PATH = `${V35_ROOT}/capture-authorization.json`;
const V35_AUTHORIZATION_SHA256 =
  "1fb2e51a2eb7f4abc56a518c1b00ad9c876d0ac7f172d48e1656ddfd92198436";
const V35_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "9d552892da07d207717d5c59a37c2fd4e4929c93d9eba5ecd3e1242f800dfc42";
const V35_SCENE_READBACK_SHA256_PIN =
  "efcbd6dbd43a9dce8b9ec15c2e55138f74aee0b2e4bdccf91d56201ed1e31f30";
const V36_ROOT = "recipe/evidence/input-field-live-pivot-v36";
const V36_PROTOCOL_SHA256 =
  "ab448b18cd45fcdc9b0cddc15747acf7951ab7e87adeedf0278012fcb1361aad";
const V36_PLAN_SHA256 =
  "b12db4d98f0e51907f47bf8d734c1ef1f32fff413a670d4a9212f6510f6eac2b";
const V36_CAPTURE_MANIFEST_SHA256 =
  "78a3153b9fd314350ffd40c9226aee23d8dc876741cb0ffd7184e6152a84d3bf";
const V36_REQUEST_MANIFEST_SHA256 =
  "329a6839bae3b7ba8c2aa3d4dff2b081b634d051dae7a9ecba653b0877aa9fe6";
const V36_INDEX_SHA256 =
  "fb5ce6613db4711041df2d750507ca1961e1f3bdcc368a67c741c30029ce8d3d";
const V36_HASH_SET_SHA256 =
  "3ecbb882ab48b06358f198b6560e216ed84cf89791524acaa6e5f326fcd4cc1b";
const V36_AUTHORIZATION_TEMPLATE_SHA256 =
  "5b480ead50a87a04a572fdc7c5f1248b2989857c261d576ca4521d46e0ce6ba1";
const V36_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v36-status.json";
const V36_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label type.textCase; cleanup complete";
const V36_BASE_COMMIT = "c91346c066ec65495fc2147a813a3ef530d1306f";
const V36_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v36-attempt-1.json";
const V36_ATTEMPT_1_SHA256 =
  "73be7459aab797989436b20e73d5cfdd3848352e2602e383ef31bdfcc481a4ec";
const V36_ANTECEDENT_COMMIT = "7f7b53c1c5cb954c9b27d42cf9ecd2285834d330";
const V36_AUTHORIZATION_PATH = `${V36_ROOT}/capture-authorization.json`;
const V36_AUTHORIZATION_SHA256 =
  "380133132ac908be9d922b18e209b2f63f69a15bcc309b5346d7f25696bea55d";
const V36_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "959fe2c8a939f6389e08d2e74fcae6aea13a8c98d38f666cc40d5da90334a617";
const V36_SCENE_READBACK_SHA256_PIN =
  "0991fb68b43d45d8f235b5a0197cd72e526baec98b3c057dfb7a3a6c55bb3f15";
const V37_ROOT = "recipe/evidence/input-field-live-pivot-v37";
const V37_PROTOCOL_SHA256 =
  "d22d50cd5f9e25dde822e23fbe1564b85e26adb346052163e178607ee5c0c0e8";
const V37_PLAN_SHA256 =
  "9a735c441d5a2b8e8534a30b6303017905dee028740ddfb95c231da4ee21f451";
const V37_CAPTURE_MANIFEST_SHA256 =
  "f711475ea14d8abe689a0d3e7b819dc2cc6fa84a00c61a6b43136f53e311ff69";
const V37_REQUEST_MANIFEST_SHA256 =
  "75f13f2a066ccb9df4af36359345fbe453830b4010438c33e1dbc9e280559648";
const V37_INDEX_SHA256 =
  "773f4add78533aa5dd68aa04873b94e2e45e1db9d9a6cf6c47d9a2a43d231f07";
const V37_HASH_SET_SHA256 =
  "b5e3b6735d86bc002f464b425ad48f73d6a8d364ee7f670fa8e2d97da672ef7e";
const V37_AUTHORIZATION_TEMPLATE_SHA256 =
  "0554bf27da161a49ec9abbcfa3c389c9973a0144b7a28aa1749298b378752698";
const V37_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v37-status.json";
const V37_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label type.textDecoration; cleanup complete";
const V37_BASE_COMMIT = "8860527506a7ad93201bb809fa17e0e0261dbf48";
const V37_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v37-attempt-1.json";
const V37_ATTEMPT_1_SHA256 =
  "e6f67f56e11a60e4e0c50f32ba45f5b9233f474d43b91ef8835cc8bc32b8bbf2";
const V37_ANTECEDENT_COMMIT = "5f50cd9b0931926c4b57c9e033643f82b7af643d";
const V37_AUTHORIZATION_PATH = `${V37_ROOT}/capture-authorization.json`;
const V37_AUTHORIZATION_SHA256 =
  "6b5b72811ffe1215ceb557d5314e21c5b30931eb04e2f01935a596a43f612db0";
const V37_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "476ce4a0f89fbc2a9ac59ac4b0c37e6b4a7e4bc0ff7bae7c6421598873dac892";
const V37_SCENE_READBACK_SHA256_PIN =
  "625de907cc42fd2b616c1de1a366c753dd179ca86086ffb6d3b83f00aa03c47d";
const V38_ROOT = "recipe/evidence/input-field-live-pivot-v38";
const V38_PROTOCOL_SHA256 =
  "efeac157a8ff344724b8fa0b7f17ee5fee4d43f2a28e0739f6bcb04269c42fdc";
const V38_PLAN_SHA256 =
  "d92d4faa4328275b78f8f1d4c3de454e66f7ff1ef1448594ada8e2047be33bb6";
const V38_CAPTURE_MANIFEST_SHA256 =
  "5c4044db1d1900635c4b4f3ab63e8acd67bd07c92e13c46e40cb7b61c0ba125e";
const V38_REQUEST_MANIFEST_SHA256 =
  "0362860de86e06ce652990616c03e8965665b5b799087f785d08e38c5ec48ace";
const V38_INDEX_SHA256 =
  "533c9920e23d92265acd852aee08b8d8a25473893f7788fbfa99eba74c7aad3b";
const V38_HASH_SET_SHA256 =
  "414a4003f1d78ab86399d23850e990650785654bc358418e487598e464c1cdf5";
const V38_AUTHORIZATION_TEMPLATE_SHA256 =
  "56ff4461031a3e35e244ee1cbf577292959cc7667a7bc5e66533b8aecd5e261e";
const V38_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v38-status.json";
const V38_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label-row clipsContent; cleanup complete";
const V38_BASE_COMMIT = "1cd6c01021d4da206d86b0e931d6edb5c3269883";
const V38_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v38-attempt-1.json";
const V38_ATTEMPT_1_SHA256 =
  "0ce81cd9be9f6fff07b3fc4932e32c7f5182e5f4ea8999150d3f2df89ae9cde7";
const V38_ANTECEDENT_COMMIT = "72910ee2ba80869b2ffc05e09bb660ff0d26e69b";
const V38_AUTHORIZATION_PATH = `${V38_ROOT}/capture-authorization.json`;
const V38_AUTHORIZATION_SHA256 =
  "40a7388ff6fcd7f6aa617e34e062417fbe5f5266cbdfc9e74ec545a990b5f7c6";
const V38_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "9d68f5629f8affb82f1b8744831d6860bf7532e8bf2969bce3e4952023b1068c";
const V38_SCENE_READBACK_SHA256_PIN =
  "6b53b3c127c19897cc5c92f155771a69d9a443dbc75f2b97e2a6446a74889561";
const V39_ROOT = "recipe/evidence/input-field-live-pivot-v39";
const V39_PROTOCOL_SHA256 =
  "e91f2ec8ef9866b7c59db41635c20f8af8c9556a26bf1456128d98353c9597b9";
const V39_PLAN_SHA256 =
  "14b52ad968b50cbcc8304ad957f8a97c235246c3e2d1e6ed3c2adcaa431a8f14";
const V39_CAPTURE_MANIFEST_SHA256 =
  "64541fdafc639d30effc4cecd45b3a9700742949f7bf0d7ae05ff8c221343a06";
const V39_REQUEST_MANIFEST_SHA256 =
  "30dbf9af03b874df7b4b632d577c03cf780f3b3ce4eeb304ad96a11dcfd659e4";
const V39_INDEX_SHA256 =
  "8a3bc4dd584731709d4ebc9c9e03f1b38884ad9f4dece586901bf08a2f0d525d";
const V39_HASH_SET_SHA256 =
  "6a3a9503af857b8e66792a6c2456c216c5127fd3df8a281533b09724d8310b2a";
const V39_AUTHORIZATION_TEMPLATE_SHA256 =
  "95cc35d0a60555743eaeafb3258555b92732b32df39b4b4d1df8d6f2c0f6c4d0";
const V39_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v39-status.json";
const V39_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label-row cornerRadius; cleanup complete";
const V39_BASE_COMMIT = "b487b6c538e8da184db3adbf8f440df81545b226";
const V39_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v39-attempt-1.json";
const V39_ATTEMPT_1_SHA256 =
  "5dabd78be0179502d726a62e4685aaa1eb3fffbf0a17b5e51e8c11f6fd131904";
const V39_ANTECEDENT_COMMIT = "0498e173b1f449fdbb95c9bea43f9c63a941ae60";
const V39_AUTHORIZATION_PATH = `${V39_ROOT}/capture-authorization.json`;
const V39_AUTHORIZATION_SHA256 =
  "6a22f47efe5e16ec483c2187b43ff6435b49b48cc76e68bdc936409877d26288";
const V39_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "497106364fd559b1ad31dd03b7ced1d4e1efc963dabaad3853b4cecb7ee7ea47";
const V39_SCENE_READBACK_SHA256_PIN =
  "39d5dc991857826a742dca1a3f4b5bac14971eaa71bb2d9e804d693ab8b70418";
const V40_ROOT = "recipe/evidence/input-field-live-pivot-v40";
const V40_PROTOCOL_SHA256 =
  "3edbb43e048422812daec569a72610022b29bcd99325906f615203c5d705b2ac";
const V40_PLAN_SHA256 =
  "e56f4bcc1ba20838dbc97e73b01dd44eab03d54028ac082e875070681cde3da5";
const V40_CAPTURE_MANIFEST_SHA256 =
  "6c3b9cde9635656759d6e5619c91b428373d7660c7d976149e8d5ed878cc001c";
const V40_REQUEST_MANIFEST_SHA256 =
  "c47c3388be058213e800cf3c9e2317abeae2dcca91670b453706f9573c1d0ad1";
const V40_INDEX_SHA256 =
  "057edcea2a24f56ebfa54d7da7b213ada80ba163829950746fefde378ed8be92";
const V40_HASH_SET_SHA256 =
  "30139e99c3146dc66d96b01638a3d0c8453485fc94e341bdbfe52731554184ec";
const V40_AUTHORIZATION_TEMPLATE_SHA256 =
  "026bed69c7b2a7fd1dadb304b0a490a6ccb034a8bdc78eada56791dbcac46342";
const V40_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v40-status.json";
const V40_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label-row effects; cleanup complete";
const V40_BASE_COMMIT = "bc3d55551f8ff6e048a3bfc2b3b62a1e4c6d9707";
const V40_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v40-attempt-1.json";
const V40_ATTEMPT_1_SHA256 =
  "d757e65cf1d24a0cb09d4858618b3db78658c972b6f391e99421b027b2e8b593";
const V40_ANTECEDENT_COMMIT = "2cc7315b1c8352b398a3187d75c5b993bf87d4d1";
const V40_AUTHORIZATION_PATH = `${V40_ROOT}/capture-authorization.json`;
const V40_AUTHORIZATION_SHA256 =
  "af94e16aa7458b2a83798ac5c0bed00d5dd34177ab3c783634e7e844ef365203";
const V40_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "8fa620654380c8eced8affbed4ca55b3a076ad7116eab9ab5d9a2fd21317790a";
const V40_SCENE_READBACK_SHA256_PIN =
  "8256184bf54a8a8af3c5be36c2d52229cfaedb63b89dcb0b6f75d58c8700c604";
const V41_ROOT = "recipe/evidence/input-field-live-pivot-v41";
const V41_PROTOCOL_SHA256 =
  "8d37b4a516150e3f21f180c3d1bd2688870538dd9e93b03ea8451ecf2313d5b2";
const V41_PLAN_SHA256 =
  "7976854844d69f0bd2dda0a233c8f32bb260e7aeb480a5d62bfb3485f244c7fa";
const V41_CAPTURE_MANIFEST_SHA256 =
  "4db0dbf1232eb3a6e4646ce26337c5416707ed3865a97eca3e40a75420a702eb";
const V41_REQUEST_MANIFEST_SHA256 =
  "a789b9ba3e9738caa273f8ed2c6c9eefc12321c2549c6169dd7e6bce8a76857f";
const V41_INDEX_SHA256 =
  "5c7e46c1ce10f7c28c1c6a823dc969ed228d731b5fb83e9f1a0d9a7f14849922";
const V41_HASH_SET_SHA256 =
  "bc9015df970ac81abc7de7066898bf1b8a9e76ffaf94f86e28b3300edee74fe0";
const V41_AUTHORIZATION_TEMPLATE_SHA256 =
  "0248ec0f1f67aff1ba51fb2cc3ccaa0ada9c8f0de6e25370b05a0331313811b4";
const V41_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v41-status.json";
const V41_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused label-row strokes; cleanup complete";
const V41_BASE_COMMIT = "c53334c3ea620e90d7dead37794c94fc5c57d13a";
const V41_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v41-attempt-1.json";
const V41_ATTEMPT_1_SHA256 =
  "7c433ea041d7eb56088c8144dfd236b2ec5771743e3f456e1c6d1b091424e881";
const V41_ANTECEDENT_COMMIT = "774eea2d24d21308594eba61d0ceb2ca4243b589";
const V41_AUTHORIZATION_PATH = `${V41_ROOT}/capture-authorization.json`;
const V41_AUTHORIZATION_SHA256 =
  "46ff0dc094444ab71eb692517cbbb01d75b86247e49c525521b4b4b9564bb2bb";
const V41_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "44015abb112d8f04fa2403e3fd52efa46b8607a82f9f38cdd1f1dad5a5a87a72";
const V41_SCENE_READBACK_SHA256_PIN =
  "5b543463e8bf6ee5f833059cc04cd3a510b05524db99cab5f3fc05754c20624d";
const V42_ROOT = "recipe/evidence/input-field-live-pivot-v42";
const V42_PROTOCOL_SHA256 =
  "fc9bf1083a771b10782f85ead4cb59a58197b7efe0698c7fd176171fbc0eacbe";
const V42_PLAN_SHA256 =
  "73dda94b671f0b705a9d07f34fb4be4b897f8f74d57e18b7dfc6e5f45367a071";
const V42_CAPTURE_MANIFEST_SHA256 =
  "be04c7a6f7f1d90f42d861ebf4241c230a8ac93fe24ad6faa8fb108ae54a1131";
const V42_REQUEST_MANIFEST_SHA256 =
  "b038b35f29a816d0b346ad0c99566c815f78c242d87b02bdaf79a62c2f9a6107";
const V42_INDEX_SHA256 =
  "2a861eb4f670abf8a60ae2f344473deda5d83c2338e916cf70e95252c4022056";
const V42_HASH_SET_SHA256 =
  "7456bcab32ea416b71954c74f733b105dac94ad2664508f824f730a2ff3ad9f8";
const V42_AUTHORIZATION_TEMPLATE_SHA256 =
  "e5b643fdd1884bd63a19ab1c003c0c4987a83984b4405c3e0225d11f2c0683c7";
const V42_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v42-status.json";
const V42_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused surface stroke dashPattern; cleanup complete";
const V42_BASE_COMMIT = "b802dfe51a68eb2a197c56db089c4eb03816035b";
const V42_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v42-attempt-1.json";
const V42_ATTEMPT_1_SHA256 =
  "4b22e4836cb43ec8c402050de1b6cf773eb9e68a7da706233973733368ae9e17";
const V42_ANTECEDENT_COMMIT = "773d61beeb7da56a8c32dd0fbe35ca43863b5496";
const V42_AUTHORIZATION_PATH = `${V42_ROOT}/capture-authorization.json`;
const V42_AUTHORIZATION_SHA256 =
  "af25c244914df2fd76e44f036257dd34f8e114dc60f0ffb77d3b04051fc3f52f";
const V42_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "9abcb0dd7859fd9210b378a328d7def05a2dcb9c15df67e79fd14e80ad352d22";
const V42_SCENE_READBACK_SHA256_PIN =
  "670aba5fe07b423a6cfd9851ddbd5e3a57a404980b8039bcb6a8fb1d1adee186";
const V43_ROOT = "recipe/evidence/input-field-live-pivot-v43";
const V43_PROTOCOL_SHA256 =
  "10aaec4a6ad6d4827b6dde3eafce682ca0333fcc079a70930d7009f60d2e0e6e";
const V43_PLAN_SHA256 =
  "218ca059050e8d1b1dee34f20b13ce7e70afccef503c7ff950268ca5fe4f391b";
const V43_CAPTURE_MANIFEST_SHA256 =
  "ff9f0160a53937a8cbc2b23be1f7a080c25b7abe040a77f96f25a864f7cc4572";
const V43_REQUEST_MANIFEST_SHA256 =
  "ee09fe0fb861a550d5e8d0880e418f989124ad429762c673697f7614280c3c95";
const V43_INDEX_SHA256 =
  "92182006293e6fc003492f98651f898b55bea63a0272a7619d22139e11135d3b";
const V43_HASH_SET_SHA256 =
  "a4a6843d3d1fd6b91d978e1d481c380eca00f5881fd9a59b3b66935a4186440c";
const V43_AUTHORIZATION_TEMPLATE_SHA256 =
  "59eb0682cd351869e8c78eeae3dfc80e57b86fd395d0351f98376c3567ee5c38";
const V43_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v43-status.json";
const V43_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message/helper bindings field order; cleanup complete";
const V43_BASE_COMMIT = "ef594ad743547ceda32bfae0c1d18ef94072206c";
const V43_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v43-attempt-1.json";
const V43_ATTEMPT_1_SHA256 =
  "a33054277c652af5db1fc6514a800fd6cc1b797a50dcd29164710d7302fe6e26";
const V43_ANTECEDENT_COMMIT = "34f42760a0f38e3d7b253d6ccd3d2905eb90e341";
const V43_AUTHORIZATION_PATH = `${V43_ROOT}/capture-authorization.json`;
const V43_AUTHORIZATION_SHA256 =
  "8cfcd36604c9d3b996d2a5de678bbcc2ef0f6d32c16cf00062b5c25be1f0546a";
const V43_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "cec298e708d912be31cd7126c6abc823e4300bdd252c40627b3b566f49fecf37";
const V43_SCENE_READBACK_SHA256_PIN =
  "9760800b8bcda2cb7dce79c4bacc29d43f0dc66962f6b7d44de2a11e552cb909";
const V44_ROOT = "recipe/evidence/input-field-live-pivot-v44";
const V44_PROTOCOL_SHA256 =
  "fe2c7be1b49cf91115859d4abc10bdd1349aefdc9f1ec4e78ade28411de7552d";
const V44_PLAN_SHA256 =
  "47f83936923043a0968cee7f68bfebc61269144ae6b8f5879e140ebb2a667445";
const V44_CAPTURE_MANIFEST_SHA256 =
  "451d2d688d2796014bc3a4c522eabb2e69acecee7a78f0fe25dcd2e5207ff431";
const V44_REQUEST_MANIFEST_SHA256 =
  "5feda6ff2315198eb8e8f139a1eb02fe9d9cc544cc7554fd94117b6c414aafb4";
const V44_INDEX_SHA256 =
  "0ad2ab3500e76112f9f5a2b2e68568ef7e2e061427859e0bcbc9fd8421bdc690";
const V44_HASH_SET_SHA256 =
  "3f2a259129849272ec67d5b2617cb7d8021def9e2f565eecafb01503a942388c";
const V44_AUTHORIZATION_TEMPLATE_SHA256 =
  "4226307fede97227d1b4464396dc094d6246ec1dd69084a56715a9cdd960d027";
const V44_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v44-status.json";
const V44_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message/helper type.letterSpacing; cleanup complete";
const V44_BASE_COMMIT = "81b916f84b9f099eecb03b22d4ce880d11112f2a";
const V44_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v44-attempt-1.json";
const V44_ATTEMPT_1_SHA256 =
  "a06188219c6ec99ed7f203a86f0b7ef3babd2830441095cb33616510947262e0";
const V44_ANTECEDENT_COMMIT = "1f1e3f8dbdd14daace494187abf2ca93ac3747db";
const V44_AUTHORIZATION_PATH = `${V44_ROOT}/capture-authorization.json`;
const V44_AUTHORIZATION_SHA256 =
  "ef435279b3822e80098d120f13277ced8a2bc98c515fd3920460e2a1f93f13c4";
const V44_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "2eacc22723b5ea4b15e4a8b0f4bef442e0e09d9721490891975b25d38d128240";
const V44_SCENE_READBACK_SHA256_PIN =
  "3093131174abb7f493d34898f1fe8b6f96b6b0b3986694b9522f42f6cf3c91f7";
const V45_ROOT = "recipe/evidence/input-field-live-pivot-v45";
const V45_PROTOCOL_SHA256 =
  "01f1b259ffe21205618763f96edd17ed7943a9fe1c0be70cb812df04201cc7fc";
const V45_PLAN_SHA256 =
  "c49200a053bdef11295808a4f83b165b3f1b7c33936ae82bb246aaf8bed5d8b2";
const V45_CAPTURE_MANIFEST_SHA256 =
  "a2f40c1beafb499c7e74a66f6f2fb45f16e7ef1037169d5b06815a84f6d4a504";
const V45_REQUEST_MANIFEST_SHA256 =
  "f4f31e28eb4b89505673c42a01108ac08e8ab815c1068db5e229bd5bc77f9af4";
const V45_INDEX_SHA256 =
  "0ec100cde764417de0cf7fea85630b39e24ded8ebd0811af8d960d9461ac2883";
const V45_HASH_SET_SHA256 =
  "93c882496ebe9e891fa4e4732de5d346621cfa4f5403374db4233e16a0b52576";
const V45_AUTHORIZATION_TEMPLATE_SHA256 =
  "5adb2719c34f1dcd17ba2512c925ce2c3b914785a2c803e63eedc0782da3d2e8";
const V45_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v45-status.json";
const V45_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message/helper type.textCase; cleanup complete";
const V45_BASE_COMMIT = "03bc86822ad76b7e761bd94796ee95631cc77a55";
const V45_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v45-attempt-1.json";
const V45_ATTEMPT_1_SHA256 =
  "24e5c816b1fc15f3391abbde969afcb27e07eb26b7aa868b24845adbab36bf06";
const V45_ANTECEDENT_COMMIT = "4fb4eca0d23ee1989d27e168755f2ee7d1d44726";
const V45_AUTHORIZATION_PATH = `${V45_ROOT}/capture-authorization.json`;
const V45_AUTHORIZATION_SHA256 =
  "5a70f34f09a55399428d0fd1d4b835a9d98adfd5c13e1b8d0957fca4b75d9341";
const V45_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "21c0870d60139355fc093822d53016b5bc537b3f09cac9c27c13945cf44488cb";
const V45_SCENE_READBACK_SHA256_PIN =
  "70b2b9bb3ae82f3f7425267ff165a7e6595f1254657be1888b39d00d4d14369e";
const V46_ROOT = "recipe/evidence/input-field-live-pivot-v46";
const V46_PROTOCOL_SHA256 =
  "9e5d2fb8e3691573e4f3cf6c0a52401251b881bf7df8639d22a94858d2b32c2c";
const V46_PLAN_SHA256 =
  "c763a8e69fc457d2651fdd007cebf015a75e16be169fbd49b635a5dd7760ba33";
const V46_CAPTURE_MANIFEST_SHA256 =
  "153a4676d25646147875a39ab0fc5f718600e126f10647fe2b47216a90021d2d";
const V46_REQUEST_MANIFEST_SHA256 =
  "89c24187eab0003e1ae01b0a104077ec1412a0d5623afe0dab87c09b9a1f25f2";
const V46_INDEX_SHA256 =
  "aefb34b505a4ddd6ffca0e49a6c5e620258cc3296d56c582386e576427374099";
const V46_HASH_SET_SHA256 =
  "70a767b9c2146e97f8e2d952921d554d48646c6b59ae8645c7185566b4594e31";
const V46_AUTHORIZATION_TEMPLATE_SHA256 =
  "12c18494e8db76650177aa9382c76d887458797acd3f316e9179832a30e02dc3";
const V46_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v46-status.json";
const V46_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message/helper type.textDecoration; cleanup complete";
const V46_BASE_COMMIT = "e08ad72da7aeab038c75018649ae104dbe499941";
const V46_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v46-attempt-1.json";
const V46_ATTEMPT_1_SHA256 =
  "8edd744481258ae1fada59f5d275954bbab874f82e067102c4348d961cbc74c0";
const V46_ANTECEDENT_COMMIT = "e7ecd4cacc407f84ca3e2db71b565832a0ff74bb";
const V46_AUTHORIZATION_PATH = `${V46_ROOT}/capture-authorization.json`;
const V46_AUTHORIZATION_SHA256 =
  "ef0c92cbaaa6a6f27a77fe2949f9bbeb1c97cd6591fcc02ea75cfe509bdb5b82";
const V46_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "430aa775d338c965f4e55ede7a8fb658f11eefc9e7008671f9054bf54ebb28bf";
const V24_ANTECEDENT_COMMIT = "753eef85aa026561542e45f492bf25b9ac84b599";
const V24_AUTHORIZATION_PATH = `${V24_ROOT}/capture-authorization.json`;
const V24_AUTHORIZATION_SHA256 =
  "da1d1a73d96be48173d83e04a20cc0f3b65bc94de6d678c3a79b7730b50fdc7b";
const V24_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "afe03ed60ef54cca0989f6d760184dbef2deb5ff2eed3cdc239c55c42be196b9";
const V23_SCENE_READBACK_SHA256 =
  "346ebdc5630010553ac44b57afc852aaea6e4a5dcac18d2bba5a94542e40c256";
const V22_SCENE_READBACK_SHA256 =
  "422419ddad44f6ff77f31c6e23ae55ad14cf37cb7693450669505a68fc1a0728";
const V21_SCENE_READBACK_SHA256 =
  "306879eb6bdb225739733ce2aa48bdd1a945453132d0f9beb1c4c208901f019a";
const V20_SCENE_READBACK_SHA256 =
  "fb0a1934792454ca2cd2a925f70a0ce117b2cd6ed72076196f5f98aeefbacbb8";
const V19_SCENE_READBACK_SHA256 =
  "6fea0cbd9c096b28d7c9178bb1c5e5b901a45d843c42ecac39b71e915a46e25f";
const V18_SCENE_READBACK_SHA256 =
  "3028b85f4605c058dfe79344417c75a5ac2a550d8f693d1d61f72931a64a7cab";
const V17_SCENE_READBACK_SHA256 =
  "4a99833d5576a23134a5be6a1b62225eadfae46949563249dd324d0e5d514762";
const V16_RESTORE_SOURCE_SHA256 =
  "a7df1e4af2ff4872a43a122e2dbfb3f0123aa53575ab93478a434f0bfd6ab1b1";
const V16_RESTORE_BLUEPRINT_SHA256 =
  "8dd1f997392a365fc80bede5157fe654876cacb5369176c39dd209a9694388ef";
const V16_RUNTIME_SOURCE_SHA256 =
  "266dc3738fbe8c89a4edeef58f2818a231969366ead07ededbf442c9d66440b5";
const V16_EXTRACT_BLUEPRINT_SHA256 =
  "6c76021228bdb5e4e1a42f0b01f4ff95dd83739c95b2a964f4c40fc894d46494";
const V15_RESTORE_SOURCE_SHA256 =
  "005196311279494e58dd419c5c7626aaa55617b540ef825442df478891d469fc";
const V15_RESTORE_BLUEPRINT_SHA256 =
  "da9775162035d50aa60c9539467dec2e6b7d9d50f82b9fedd6b6df7b0d7afee9";
const V15_RUNTIME_SOURCE_SHA256 =
  "b8d80b16f6371fe865fa09770d8aec5d653ccf8049a78be695d19d822f089ec1";
const V14_RESTORE_SOURCE_SHA256 =
  "daa6ec8dea23b1e195c650a01fe5a44e05f531ef0949be944759bbcb2c80f2ce";
const V14_RESTORE_BLUEPRINT_SHA256 =
  "cbb6ddf1433899b10e88f5f74f41b6b17f8664db9fe6d41da40d734ccd687290";
const V13_RESTORE_SOURCE_SHA256 =
  "4c140645423313cf0a45b181d39eefafaed8c7bf535c9ac5a12eef060196cd0a";
const V13_RESTORE_BLUEPRINT_SHA256 =
  "77997efc45e5067e5a8ee78b073da36bb2ed09fafe7cfada2b23ad30a78ae838";
const V12_WRITER_PROGRAM_SHA256 =
  "a01d95b3b2a46999d4228814101d5e8b19ef35bb0f0b9113b1d9d438e150d6b3";
const V12_WRITER_PAYLOAD_SHA256 =
  "b091cf61288e21aea4031e7717957e5329f2fb1ec164757b08f1f0d9ea830597";
const V11_WRITER_PROGRAM_SHA256 =
  "a839d5bd2304fa18b449692676345486606bca6a79dd8bd84e8b9b307b9f7826";
const V11_WRITER_PAYLOAD_SHA256 =
  "aedb679f27be7b8159f4822f5cfb61aeef7f85e7ea824af884f14ad2f3c5e1a2";
const V4_AUTHORIZATION_COMMIT = "bd343680b446a828190f176e525e5616752f9e5f";
const V4_AUTHORIZATION_SHA256 =
  "6c0c4d772280af24b9387193a5b7723ebfff73eff9e66a89eec9d22ebd4f258b";
const V4_INDEX_PATH = "recipe/evidence/input-field-live-pivot-v4/index.json";
const V3_INDEX_STATUS = "attempt 3 hard failure; v3 permanently exhausted";
const V3_PREPARED_FILES = [
  "capture-authorization.json",
  "conformance-report.json",
  "cleanup-attempt-1.json",
  "cleanup-attempt-2.json",
  "cleanup-attempt-3.json",
  "expected-scene-plan-mui.json.gz",
  "expected-scene-plan-polaris.json.gz",
  "index.json",
  "live-attempt-1.json",
  "live-attempt-2.json",
  "live-attempt-3.json",
  "protocol.json",
  "transport-envelope.json",
  "writer-plan.json",
  "writer-wrapper.txt",
  "writer.js",
  "screenshots",
] as const;
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export function validatePivotStatus(
  status: Record<string, any>,
  protocol: Record<string, any>,
  index: Record<string, any>,
  v3Files: readonly string[],
  protocolHash: string,
): string[] {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };
  if (
    status.status !== STATUS_INDEX_STATUS ||
    protocol.status !== DRAFT_STATUS ||
    index.status !== V3_INDEX_STATUS
  )
    fail("criterion/authorization chronology status");
  if (
    status.chronology?.externallyVerifiable !== true ||
    status.chronology?.antecedentCommit !==
      "be6b01300ad99d8a29ea4c11508d192dec84bbea" ||
    protocol.chronology?.externallyVerifiable !== false
  )
    fail("chronology overclaim");
  if (
    protocol.chronology?.captureAuthorized !== false ||
    index.captureAuthorized !== true ||
    status.input?.liveV3?.captureAuthorizationDerivedByGate !== true ||
    status.input?.liveV3?.captureOccurred !== true
  )
    fail("capture authorization/status");
  if (
    status.button?.overallSuccess !== false ||
    status.button?.status !== "pending" ||
    status.combobox?.overallSuccess !== false ||
    status.combobox?.status !== "offline-technical-proof-ungraded" ||
    status.combobox?.recipe?.sourceReferencesRendered !== false ||
    status.combobox?.recipe?.aiGraded !== false ||
    status.combobox?.recipe?.liveFigma !== false ||
    status.combobox?.legacyContext?.variants !== 6 ||
    status.combobox?.offlineProof?.pairedCellsPlanned !== 24 ||
    status.combobox?.offlineProof?.comboboxVariants !== 64 ||
    status.combobox?.offlineProof?.optionVariants !== 8 ||
    status.combobox?.offlineProof?.components !== 72 ||
    status.combobox?.offlineProof?.instances !== 242 ||
    status.input?.overallSuccess !== false ||
    status.input?.status !== "blocked" ||
    status.input?.liveV2?.result !== "failed"
  )
    fail("corrected Button/Input status");
  if (
    protocol.historicalApplication?.inputLiveV2Status !== "failed" ||
    protocol.historicalApplication?.recertified !== false ||
    protocol.humanGate?.mandatory !== true ||
    protocol.visualRelativeProgression?.exactPixelDifference !==
      "diagnostic-only"
  )
    fail("v3 acceptance safeguards");
  if (
    protocol.denominator?.cellsPerSource !== 128 ||
    protocol.hardGates?.allCellsMustPass !== true ||
    protocol.readbackAndAccounting?.silentDerived !== true ||
    protocol.readbackAndAccounting?.multisetOccurrencesPreserved !== true
  )
    fail("v3 hard gate");
  if (
    protocolHash !== INPUT_LIVE_V3_PROTOCOL_SHA256 ||
    index.protocol?.sha256 !== protocolHash ||
    status.input?.liveV3?.protocolSha256 !== protocolHash
  )
    fail("protocol hash");
  if (
    index.result?.status !== "hard-failure" ||
    index.result?.attempt !== 3 ||
    index.result?.writerExecutionSucceeded !== true ||
    index.result?.mintedVariants !== null ||
    index.result?.verifierCompleted !== false ||
    index.result?.sceneFactsExpected !== 43_726 ||
    index.result?.sceneFactsMeasured !== null ||
    index.result?.sceneAccounting !== null ||
    index.result?.fixedPointCyclesMeasured !== null ||
    index.result?.usability !== null ||
    index.result?.restoration !== null ||
    index.result?.objectiveRowsMeasured !== null ||
    index.result?.capturedCells !== 128 ||
    index.result?.capturesScored !== false ||
    index.result?.successReceiptWritten !== false ||
    index.overallInputSuccess !== false ||
    !Array.isArray(index.captureArtifacts) ||
    index.captureArtifacts.length !== 7 ||
    status.input?.liveV3?.attemptsExecuted !== 3 ||
    status.input?.liveV3?.attempt2?.sceneFactsMeasured !== 0 ||
    status.input?.liveV3?.attempt2?.successReceiptWritten !== false ||
    status.input?.liveV3?.attempt3?.sceneFactsMeasured !== null ||
    status.input?.liveV3?.attempt3?.capturedCells !== 128 ||
    status.input?.liveV3?.attempt3?.capturesScored !== false ||
    status.input?.liveV3?.attempt3?.objectiveRowsMeasured !== null ||
    status.input?.liveV3?.attempt3?.exactFigmaIdsAvailable !== false ||
    status.input?.liveV3?.attempt3?.remainingOwnedNodes !== 0 ||
    status.input?.liveV3?.attempt3?.remainingOwnedCollections !== 0 ||
    status.input?.liveV4?.status !== V4_FAILURE_STATUS ||
    status.input?.liveV4?.protocolStatus !== INPUT_LIVE_V4_STATUS ||
    status.input?.liveV4?.antecedentCommit !==
      INPUT_LIVE_V4_ANTECEDENT_COMMIT ||
    status.input?.liveV4?.protocolSha256 !== INPUT_LIVE_V4_PROTOCOL_SHA256 ||
    status.input?.liveV4?.normalizationFixturesSha256 !==
      "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13" ||
    status.input?.liveV4?.authorizationPath !==
      INPUT_LIVE_V4_AUTHORIZATION_PATH ||
    status.input?.liveV4?.authorizationSha256 !== V4_AUTHORIZATION_SHA256 ||
    status.input?.liveV4?.authorizationCommit !== V4_AUTHORIZATION_COMMIT ||
    status.input?.liveV4?.authorizationState !==
      "committed and published but non-executable entrypoint" ||
    status.input?.liveV4?.authorizationEstablishedOnlyByHistoryVerifier !==
      true ||
    status.input?.liveV4?.authorizationVerifierPassed !== true ||
    status.input?.liveV4?.preflightPassed !== true ||
    status.input?.liveV4?.entrypointRefusedBeforePhase1 !== true ||
    status.input?.liveV4?.writerReached !== false ||
    status.input?.liveV4?.bridgeInvocations !== 0 ||
    status.input?.liveV4?.generatedWriterPresent !== false ||
    status.input?.liveV4?.generatedTransportPresent !== false ||
    status.input?.liveV4?.phaseJournalsWritten !== 0 ||
    status.input?.liveV4?.captureArtifactsWritten !== 0 ||
    status.input?.liveV4?.figmaArtifactsCreated !== 0 ||
    status.input?.liveV4?.failureEvidencePath !== V4_FAILURE_PATH ||
    status.input?.liveV4?.failureEvidenceSha256 !== V4_FAILURE_SHA256 ||
    status.input?.liveV4?.authorizationReusableForV5 !== false ||
    status.input?.liveV4?.authorized !== false ||
    status.input?.liveV4?.liveExecutionOccurred !== false ||
    status.input?.liveV4?.attemptsExecuted !== 0 ||
    status.input?.liveV4?.nextAttempt !== null ||
    status.input?.liveV4?.humanSignoff !== "pending" ||
    status.input?.liveV5?.status !== V5_STATUS ||
    status.input?.liveV5?.antecedentCommit !== V5_ANTECEDENT_COMMIT ||
    status.input?.liveV5?.protocolFirstAddCommit !==
      V5_PROTOCOL_FIRST_ADD_COMMIT ||
    status.input?.liveV5?.protocolSha256 !== V5_PROTOCOL_SHA256 ||
    status.input?.liveV5?.writerPlanSha256 !== V5_PLAN_SHA256 ||
    status.input?.liveV5?.authorizationSha256 !== V5_AUTHORIZATION_SHA256 ||
    status.input?.liveV5?.authorizationPresent !== true ||
    status.input?.liveV5?.authorizationCommitted !== true ||
    status.input?.liveV5?.authorizationCommit !== V5_AUTHORIZATION_COMMIT ||
    status.input?.liveV5?.authorizationLineageValidAtCommit !== true ||
    status.input?.liveV5?.executionReady !== false ||
    status.input?.liveV5?.executionBlockers?.length !== 4 ||
    status.input?.liveV5?.v4AuthorizationReused !== false ||
    status.input?.liveV5?.attemptsExecuted !== 0 ||
    status.input?.liveV5?.nextAttempt !== null ||
    status.input?.liveV5?.maximumFutureAttempts !== 3 ||
    status.input?.liveV5?.liveExecutionOccurred !== false ||
    status.input?.liveV5?.captureArtifactsPresent !== false ||
    status.input?.liveV5?.outcomes !== null ||
    status.input?.liveV5?.humanSignoff !== "pending" ||
    status.input?.liveV5?.supersedingStatusPath !== V5_SUPERSEDING_PATH ||
    status.input?.liveV5?.supersedingStatusSha256 !== V5_SUPERSEDING_SHA256 ||
    status.input?.liveV5?.semanticallyRetired !== true ||
    status.input?.liveV5?.authorizationAuthorizesAttemptNow !== false ||
    status.input?.liveV6?.status !== V6_STATUS ||
    status.input?.liveV6?.antecedentCommit !==
      "8737fab9f35aeae43b25734e8f9709a4247c379b" ||
    status.input?.liveV6?.antecedentTree !==
      "1065a502feddd59ce8d11985e3f6e14365d65bfd" ||
    status.input?.liveV6?.antecedentTreeSha256 !==
      "7c93434bd6e742be7f8137af68239976b1ac226ff4d27346f52c3b86d5d5de68" ||
    status.input?.liveV6?.protocolPath !== V6_PROTOCOL_PATH ||
    status.input?.liveV6?.protocolSha256 !== V6_PROTOCOL_SHA256 ||
    status.input?.liveV6?.brokerPath !== V6_BROKER_PATH ||
    status.input?.liveV6?.brokerSha256 !== V6_BROKER_SHA256 ||
    status.input?.liveV6?.contractPath !== V6_CONTRACT_PATH ||
    status.input?.liveV6?.contractSha256 !== V6_CONTRACT_SHA256 ||
    status.input?.liveV6?.runnerPath !== V6_RUNNER_PATH ||
    status.input?.liveV6?.runnerSha256 !== V6_RUNNER_SHA256 ||
    status.input?.liveV6?.testPath !== V6_TEST_PATH ||
    status.input?.liveV6?.testSha256 !== V6_TEST_SHA256 ||
    status.input?.liveV6?.authorizationPath !== V6_AUTHORIZATION_PATH ||
    status.input?.liveV6?.authorizationSha256 !== V6_AUTHORIZATION_SHA256 ||
    status.input?.liveV6?.authorizationLayerPath !==
      V6_AUTHORIZATION_LAYER_PATH ||
    status.input?.liveV6?.authorizationLayerSha256 !==
      V6_AUTHORIZATION_LAYER_SHA256 ||
    status.input?.liveV6?.preflightPath !== V6_PREFLIGHT_PATH ||
    status.input?.liveV6?.preflightSha256 !== V6_PREFLIGHT_SHA256 ||
    status.input?.liveV6?.authorizationTestPath !==
      V6_AUTHORIZATION_TEST_PATH ||
    status.input?.liveV6?.authorizationTestSha256 !==
      V6_AUTHORIZATION_TEST_SHA256 ||
    status.input?.liveV6?.operatorSecurityAttestationTemplatePath !==
      V6_SECURITY_ATTESTATION_TEMPLATE_PATH ||
    status.input?.liveV6?.operatorSecurityAttestationTemplateSha256 !==
      V6_SECURITY_ATTESTATION_TEMPLATE_SHA256 ||
    status.input?.liveV6?.signingPublicKeySpkiSha256 !==
      "c5d04bf950dea3e1b62a2a274031677546e9c24bbee4cabb64773d0f1a7b3ac4" ||
    status.input?.liveV6?.evidenceIndexPath !== V6_INDEX_PATH ||
    status.input?.liveV6?.evidenceIndexSha256 !== V6_INDEX_SHA256 ||
    status.input?.liveV6?.proofPlanSha256 !== V6_PLAN_SHA256 ||
    status.input?.liveV6?.captureManifestSha256 !==
      V6_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV6?.requestManifestSha256 !==
      V6_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV6?.supportedSeparateStdioMcpClientTransport !== true ||
    status.input?.liveV6?.cursorDynamicToolDirectlyCallableFromNode !== false ||
    status.input?.liveV6?.externalOperatorOnly !== true ||
    status.input?.liveV6?.sourceRoots !== 2 ||
    status.input?.liveV6?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV6?.variantProbes !== 256 ||
    status.input?.liveV6?.captureCells !== 128 ||
    status.input?.liveV6?.remoteRequests !== 132 ||
    status.input?.liveV6?.hostPhases !== 3 ||
    status.input?.liveV6?.cleanupRequestPersistedAfterWriter !== true ||
    status.input?.liveV6?.authorizationPresent !== true ||
    status.input?.liveV6?.authorizationCommitted !== true ||
    status.input?.liveV6?.authorizationEffective !== false ||
    status.input?.liveV6?.beforeCommitGate !==
      "historical antecedent phase only" ||
    status.input?.liveV6?.authorizationCommit !==
      "e5d6814982cbbe498ed630e7d988eae10bcb5d77" ||
    status.input?.liveV6?.authorizationHistoryValid !== true ||
    status.input?.liveV6?.comprehensiveCheckGreenPostAuthorization !== false ||
    status.input?.liveV6?.phaseSensitiveSelfTestDefect !== true ||
    status.input?.liveV6?.semanticallyRetired !== true ||
    status.input?.liveV6?.retiredBeforeLiveUse !== true ||
    status.input?.liveV6?.supersedingStatusPath !== V6_SUPERSEDING_PATH ||
    status.input?.liveV6?.supersedingStatusSha256 !== V6_SUPERSEDING_SHA256 ||
    status.input?.liveV6?.authorized !== false ||
    status.input?.liveV6?.security?.status !==
      "blocked-pending-user-account-action" ||
    status.input?.liveV6?.security?.exposedFigmaPatRevokedOrReplaced !==
      false ||
    status.input?.liveV6?.security?.rotationClaimed !== false ||
    status.input?.liveV6?.security?.mcpProcessesRestartedAfterRotation !==
      false ||
    status.input?.liveV6?.security
      ?.ownerOnlyEnvironmentFileConfigurationRequired !== true ||
    status.input?.liveV6?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV6?.security?.currentRepositorySecretScanMatches !== 0 ||
    status.input?.liveV6?.security
      ?.currentRepositorySecretScanEstablishesRotation !== false ||
    status.input?.liveV6?.security?.credentialDataStored !== false ||
    status.input?.liveV6?.attemptsExecuted !== 0 ||
    status.input?.liveV6?.nextAttempt !== null ||
    status.input?.liveV6?.maximumAttempts !== 3 ||
    status.input?.liveV6?.humanSignoff !== "pending" ||
    status.input?.liveV6?.liveExecutionOccurred !== false ||
    status.input?.liveV6?.figmaWrites !== 0 ||
    status.input?.liveV6?.figmaCaptures !== 0 ||
    status.input?.liveV6?.outcomes !== null ||
    status.input?.liveV6?.overallInputSuccess !== false ||
    status.input?.liveV7?.status !== V7_LIVE_STATUS ||
    status.input?.liveV7?.baseCommit !==
      "41e34588ec78fa0b1cb5a75c3b77b96b82680576" ||
    status.input?.liveV7?.antecedentCommit !== V7_ANTECEDENT_COMMIT ||
    status.input?.liveV7?.protocolSha256 !== V7_PROTOCOL_SHA256 ||
    status.input?.liveV7?.proofPlanSha256 !== V7_PLAN_SHA256 ||
    status.input?.liveV7?.captureManifestSha256 !==
      V7_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV7?.requestManifestSha256 !==
      V7_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV7?.antecedentIndexSha256 !== V7_INDEX_SHA256 ||
    status.input?.liveV7?.antecedentHashSetSha256 !== V7_HASH_SET_SHA256 ||
    status.input?.liveV7?.authorizationTemplateSha256 !==
      V7_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV7?.authorizationPresent !== true ||
    status.input?.liveV7?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV7?.authorizationEffective !== false ||
    status.input?.liveV7?.firstAuthorizationPath !==
      V7_FIRST_AUTHORIZATION_PATH ||
    status.input?.liveV7?.firstAuthorizationSha256 !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    status.input?.liveV7?.firstAuthorizationBytesPreserved !== true ||
    status.input?.liveV7?.firstAuthorizationUsableForExecution !== false ||
    status.input?.liveV7?.firstAuthorizationSupersededReason !==
      "signer private key unavailable" ||
    status.input?.liveV7?.authorizationPath !== V7_AUTHORIZATION_PATH ||
    status.input?.liveV7?.authorizationSha256 !== V7_AUTHORIZATION_SHA256 ||
    status.input?.liveV7?.signingPublicKeySpkiSha256 !==
      V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV7?.precommitHistoryState !== "pending-v2" ||
    status.input?.liveV7?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized-v2" ||
    status.input?.liveV7?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV7?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV7?.sourceRoots !== 2 ||
    status.input?.liveV7?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV7?.captureCells !== 128 ||
    status.input?.liveV7?.remoteRequests !== 132 ||
    status.input?.liveV7?.hostPhases !== 3 ||
    status.input?.liveV7?.requestSignature !== "Ed25519" ||
    status.input?.liveV7?.captureBeforeTechnicalGates !== false ||
    status.input?.liveV7?.security?.figmaPatRevokedOrReplacedRequired !==
      true ||
    status.input?.liveV7?.security?.replacementPatActiveForProject !== true ||
    status.input?.liveV7?.security?.oldTokenRevoked !== false ||
    status.input?.liveV7?.security?.ownerRiskAcceptance !== true ||
    status.input?.liveV7?.security?.figmaPatRevokedOrReplaced !== true ||
    status.input?.liveV7?.security?.mcpRestartAfterRotationRequired !== true ||
    status.input?.liveV7?.security?.mcpRestartedAfterRotation !== true ||
    status.input?.liveV7?.security?.ownerOnlyEnvironmentFileMode0600Required !==
      true ||
    status.input?.liveV7?.security?.ownerOnlyEnvironmentFilesMode0600 !==
      true ||
    status.input?.liveV7?.security?.repositorySecretScanZeroRequired !== true ||
    status.input?.liveV7?.security?.repositorySecretScanZero !== true ||
    status.input?.liveV7?.security?.exactScratchReadOnlyProbeRequired !==
      true ||
    status.input?.liveV7?.security?.exactScratchBridgeProbePassed !== true ||
    status.input?.liveV7?.security?.exactScratchRestProbePassed !== true ||
    status.input?.liveV7?.security?.tokenValuesForbidden !== true ||
    status.input?.liveV7?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV7?.attemptsExecuted !== 1 ||
    status.input?.liveV7?.nextAttempt !== null ||
    status.input?.liveV7?.maximumFutureAttempts !== 3 ||
    status.input?.liveV7?.liveExecutionOccurred !== true ||
    status.input?.liveV7?.figmaCaptures !== 0 ||
    status.input?.liveV7?.humanSignoff !== "pending" ||
    status.input?.liveV7?.overallInputSuccess !== false ||
    status.input?.liveV7?.semanticallyRetired !== true ||
    status.input?.liveV7?.authorizationAuthorizesAttemptNow !== false ||
    status.input?.liveV7?.supersedingStatusPath !== V7_SUPERSEDING_PATH ||
    status.input?.liveV7?.supersedingStatusSha256 !== V7_SUPERSEDING_SHA256 ||
    status.input?.liveV8?.status !== V8_STATUS ||
    status.input?.liveV8?.baseCommit !== V8_BASE_COMMIT ||
    status.input?.liveV8?.protocolSha256 !== V8_PROTOCOL_SHA256 ||
    status.input?.liveV8?.proofPlanSha256 !== V8_PLAN_SHA256 ||
    status.input?.liveV8?.captureManifestSha256 !==
      V8_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV8?.requestManifestSha256 !==
      V8_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV8?.antecedentIndexSha256 !== V8_INDEX_SHA256 ||
    status.input?.liveV8?.antecedentHashSetSha256 !== V8_HASH_SET_SHA256 ||
    status.input?.liveV8?.authorizationTemplateSha256 !==
      V8_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV8?.antecedentCommit !== V8_ANTECEDENT_COMMIT ||
    status.input?.liveV8?.authorizationPresent !== true ||
    status.input?.liveV8?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV8?.authorizationEffective !== false ||
    status.input?.liveV8?.authorizationPath !== V8_AUTHORIZATION_PATH ||
    status.input?.liveV8?.authorizationSha256 !== V8_AUTHORIZATION_SHA256 ||
    status.input?.liveV8?.signingPublicKeySpkiSha256 !==
      V8_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV8?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV8?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV8?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV8?.v7AuthorizationReusable !== false ||
    status.input?.liveV8?.v7AntecedentBytesUnchanged !== true ||
    status.input?.liveV8?.sourceRoots !== 2 ||
    status.input?.liveV8?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV8?.captureCells !== 128 ||
    status.input?.liveV8?.remoteRequests !== 132 ||
    status.input?.liveV8?.hostPhases !== 3 ||
    status.input?.liveV8?.requestSignature !== "Ed25519" ||
    status.input?.liveV8?.captureBeforeTechnicalGates !== false ||
    status.input?.liveV8?.perSideStrokeWeightFields?.length !== 4 ||
    !status.input?.liveV8?.perSideStrokeWeightFields?.includes(
      "strokeBottomWeight",
    ) ||
    status.input?.liveV8?.transportFacts?.oneCallDiskOperatorRequired !==
      true ||
    status.input?.liveV8?.transportFacts?.honorSignedTimeoutRequired !== true ||
    status.input?.liveV8?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV8?.transportFacts
      ?.fileContextEditorTypeReconstructedFromExactScratchTarget !== true ||
    status.input?.liveV8?.transportFacts?.emptyCodeEnvelopeRefused !== true ||
    status.input?.liveV8?.transportFacts
      ?.cursorReadMustNotIngestSignedWriter !== true ||
    status.input?.liveV8?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV8?.security?.tokenValuesForbidden !== true ||
    status.input?.liveV8?.attemptsExecuted !== 2 ||
    status.input?.liveV8?.nextAttempt !== 3 ||
    status.input?.liveV8?.maximumFutureAttempts !== 3 ||
    status.input?.liveV8?.liveExecutionOccurred !== true ||
    status.input?.liveV8?.figmaWrites !== 4 ||
    status.input?.liveV8?.figmaCaptures !== 0 ||
    status.input?.liveV8?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV8?.attempt1Path !== V8_ATTEMPT_1_PATH ||
    status.input?.liveV8?.attempt1Sha256 !== V8_ATTEMPT_1_SHA256 ||
    status.input?.liveV8?.attempt2Path !== V8_ATTEMPT_2_PATH ||
    status.input?.liveV8?.attempt2Sha256 !== V8_ATTEMPT_2_SHA256 ||
    status.input?.liveV8
      ?.restartAsV8Attempt3WithoutSceneReadbackTeachingForbidden !== true ||
    status.input?.liveV8?.humanSignoff !== "pending" ||
    status.input?.liveV8?.overallInputSuccess !== false ||
    status.input?.liveV9?.status !== V9_STATUS ||
    status.input?.liveV9?.baseCommit !== V9_BASE_COMMIT ||
    status.input?.liveV9?.protocolSha256 !== V9_PROTOCOL_SHA256 ||
    status.input?.liveV9?.proofPlanSha256 !== V9_PLAN_SHA256 ||
    status.input?.liveV9?.captureManifestSha256 !==
      V9_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV9?.requestManifestSha256 !==
      V9_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV9?.antecedentIndexSha256 !== V9_INDEX_SHA256 ||
    status.input?.liveV9?.antecedentHashSetSha256 !== V9_HASH_SET_SHA256 ||
    status.input?.liveV9?.authorizationTemplateSha256 !==
      V9_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV9?.antecedentCommit !== V9_ANTECEDENT_COMMIT ||
    status.input?.liveV9?.authorizationPresent !== true ||
    status.input?.liveV9?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV9?.authorizationEffective !== false ||
    status.input?.liveV9?.authorizationPath !== V9_AUTHORIZATION_PATH ||
    status.input?.liveV9?.authorizationSha256 !== V9_AUTHORIZATION_SHA256 ||
    status.input?.liveV9?.signingPublicKeySpkiSha256 !==
      V9_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV9?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV9?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV9?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV9?.v7AuthorizationReusable !== false ||
    status.input?.liveV9?.v8AuthorizationReusable !== false ||
    status.input?.liveV9?.v8AntecedentBytesUnchanged !== true ||
    status.input?.liveV9?.sceneReadbackCarried !== true ||
    !status.input?.liveV9?.taughtLiveFillKinds?.includes("VARIABLE_ALIAS") ||
    !status.input?.liveV9?.taughtLiveFillKinds?.includes(
      "boundVariablesOnly",
    ) ||
    status.input?.liveV9?.carriedSceneReadback !==
      "recipe/scene-readback-v9.ts" ||
    status.input?.liveV9?.sourceRoots !== 2 ||
    status.input?.liveV9?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV9?.captureCells !== 128 ||
    status.input?.liveV9?.remoteRequests !== 132 ||
    status.input?.liveV9?.hostPhases !== 3 ||
    status.input?.liveV9?.requestSignature !== "Ed25519" ||
    status.input?.liveV9?.captureBeforeTechnicalGates !== false ||
    status.input?.liveV9?.transportFacts?.oneCallDiskOperatorRequired !==
      true ||
    status.input?.liveV9?.transportFacts?.honorSignedTimeoutRequired !== true ||
    status.input?.liveV9?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV9?.transportFacts
      ?.fileContextEditorTypeReconstructedFromExactScratchTarget !== true ||
    status.input?.liveV9?.transportFacts?.emptyCodeEnvelopeRefused !== true ||
    status.input?.liveV9?.transportFacts
      ?.cursorReadMustNotIngestSignedWriter !== true ||
    status.input?.liveV9?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV9?.security?.tokenValuesForbidden !== true ||
    status.input?.liveV9?.attemptsExecuted !== 2 ||
    status.input?.liveV9?.nextAttempt !== 3 ||
    status.input?.liveV9?.maximumFutureAttempts !== 3 ||
    status.input?.liveV9?.liveExecutionOccurred !== true ||
    status.input?.liveV9?.figmaWrites !== 4 ||
    status.input?.liveV9?.figmaCaptures !== 0 ||
    status.input?.liveV9?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV9?.attempt1Path !== V9_ATTEMPT_1_PATH ||
    status.input?.liveV9?.attempt1Sha256 !== V9_ATTEMPT_1_SHA256 ||
    status.input?.liveV9?.attempt2Path !== V9_ATTEMPT_2_PATH ||
    status.input?.liveV9?.attempt2Sha256 !== V9_ATTEMPT_2_SHA256 ||
    status.input?.liveV9
      ?.restartAsV9Attempt2WithoutComponentSetStrokeTeachingForbidden !==
      true ||
    status.input?.liveV9
      ?.restartAsV9Attempt3WithoutCarriedV3VerifierForbidden !== true ||
    status.input?.liveV9?.humanSignoff !== "pending" ||
    status.input?.liveV9?.overallInputSuccess !== false ||
    status.input?.liveV10?.status !== V10_STATUS ||
    status.input?.liveV10?.baseCommit !== V10_BASE_COMMIT ||
    status.input?.liveV10?.protocolSha256 !== V10_PROTOCOL_SHA256 ||
    status.input?.liveV10?.proofPlanSha256 !== V10_PLAN_SHA256 ||
    status.input?.liveV10?.captureManifestSha256 !==
      V10_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV10?.requestManifestSha256 !==
      V10_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV10?.antecedentIndexSha256 !== V10_INDEX_SHA256 ||
    status.input?.liveV10?.antecedentHashSetSha256 !== V10_HASH_SET_SHA256 ||
    status.input?.liveV10?.authorizationTemplateSha256 !==
      V10_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV10?.antecedentCommit !== V10_ANTECEDENT_COMMIT ||
    status.input?.liveV10?.authorizationPresent !== true ||
    status.input?.liveV10?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV10?.authorizationEffective !== false ||
    status.input?.liveV10?.authorizationPath !== V10_AUTHORIZATION_PATH ||
    status.input?.liveV10?.authorizationSha256 !== V10_AUTHORIZATION_SHA256 ||
    status.input?.liveV10?.signingPublicKeySpkiSha256 !==
      V10_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV10?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV10?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV10?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV10?.v7AuthorizationReusable !== false ||
    status.input?.liveV10?.v8AuthorizationReusable !== false ||
    status.input?.liveV10?.v9AuthorizationReusable !== false ||
    status.input?.liveV10?.v8AntecedentBytesUnchanged !== true ||
    status.input?.liveV10?.v9AntecedentBytesUnchanged !== true ||
    status.input?.liveV10?.sceneReadbackCarried !== true ||
    status.input?.liveV10?.carriedV3Verifier !== true ||
    status.input?.liveV10?.liveHostDoesNotImportSceneReadbackTs !== true ||
    !status.input?.liveV10?.taughtLiveFillKinds?.includes("VARIABLE_ALIAS") ||
    !status.input?.liveV10?.taughtLiveFillKinds?.includes(
      "boundVariablesOnly",
    ) ||
    status.input?.liveV10?.carriedSceneReadback !==
      "recipe/scene-readback-v10.ts" ||
    status.input?.liveV10?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v10.ts" ||
    status.input?.liveV10?.sourceRoots !== 2 ||
    status.input?.liveV10?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV10?.captureCells !== 128 ||
    status.input?.liveV10?.remoteRequests !== 132 ||
    status.input?.liveV10?.hostPhases !== 3 ||
    status.input?.liveV10?.requestSignature !== "Ed25519" ||
    status.input?.liveV10?.captureBeforeTechnicalGates !== false ||
    status.input?.liveV10?.transportFacts?.oneCallDiskOperatorRequired !==
      true ||
    status.input?.liveV10?.transportFacts?.honorSignedTimeoutRequired !==
      true ||
    status.input?.liveV10?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV10?.transportFacts
      ?.fileContextEditorTypeReconstructedFromExactScratchTarget !== true ||
    status.input?.liveV10?.transportFacts?.emptyCodeEnvelopeRefused !== true ||
    status.input?.liveV10?.transportFacts
      ?.cursorReadMustNotIngestSignedWriter !== true ||
    status.input?.liveV10?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV10?.security?.tokenValuesForbidden !== true ||
    status.input?.liveV10?.attemptsExecuted !== 2 ||
    status.input?.liveV10?.nextAttempt !== 3 ||
    status.input?.liveV10?.maximumFutureAttempts !== 3 ||
    status.input?.liveV10?.liveExecutionOccurred !== true ||
    status.input?.liveV10?.figmaWrites !== 4 ||
    status.input?.liveV10?.figmaCaptures !== 0 ||
    status.input?.liveV10?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV10?.attempt1Path !== V10_ATTEMPT_1_PATH ||
    status.input?.liveV10?.attempt1Sha256 !== V10_ATTEMPT_1_SHA256 ||
    status.input?.liveV10?.attempt2Path !== V10_ATTEMPT_2_PATH ||
    status.input?.liveV10?.attempt2Sha256 !== V10_ATTEMPT_2_SHA256 ||
    status.input?.liveV10
      ?.restartAsV10Attempt2WithoutAxisOrderTeachingForbidden !== true ||
    status.input?.liveV10
      ?.restartAsV10Attempt3WithoutCarriedFirstSegmentRoleForbidden !== true ||
    status.input?.liveV10?.humanSignoff !== "pending" ||
    status.input?.liveV10?.overallInputSuccess !== false ||
    status.input?.liveV11?.status !== V11_STATUS ||
    status.input?.liveV11?.baseCommit !== V11_BASE_COMMIT ||
    status.input?.liveV11?.protocolSha256 !== V11_PROTOCOL_SHA256 ||
    status.input?.liveV11?.proofPlanSha256 !== V11_PLAN_SHA256 ||
    status.input?.liveV11?.captureManifestSha256 !==
      V11_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV11?.requestManifestSha256 !==
      V11_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV11?.antecedentIndexSha256 !== V11_INDEX_SHA256 ||
    status.input?.liveV11?.antecedentHashSetSha256 !== V11_HASH_SET_SHA256 ||
    status.input?.liveV11?.authorizationTemplateSha256 !==
      V11_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV11?.antecedentCommit !== V11_ANTECEDENT_COMMIT ||
    status.input?.liveV11?.authorizationPresent !== true ||
    status.input?.liveV11?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV11?.authorizationEffective !== false ||
    status.input?.liveV11?.authorizationPath !== V11_AUTHORIZATION_PATH ||
    status.input?.liveV11?.authorizationSha256 !== V11_AUTHORIZATION_SHA256 ||
    status.input?.liveV11?.signingPublicKeySpkiSha256 !==
      V11_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV11?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV11?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV11?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV11?.v10AuthorizationReusable !== false ||
    status.input?.liveV11?.v10AntecedentBytesUnchanged !== true ||
    status.input?.liveV11?.sceneReadbackCarried !== true ||
    status.input?.liveV11?.carriedV3Verifier !== true ||
    status.input?.liveV11?.taughtFirstSegmentRoleRecovery !== true ||
    status.input?.liveV11?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV11?.carriedSceneReadback !==
      "recipe/scene-readback-v11.ts" ||
    status.input?.liveV11?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v11.ts" ||
    status.input?.liveV11?.sourceRoots !== 2 ||
    status.input?.liveV11?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV11?.captureCells !== 128 ||
    status.input?.liveV11?.remoteRequests !== 132 ||
    status.input?.liveV11?.hostPhases !== 3 ||
    status.input?.liveV11?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV11?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV11?.attemptsExecuted !== 1 ||
    status.input?.liveV11?.nextAttempt !== 2 ||
    status.input?.liveV11?.liveExecutionOccurred !== true ||
    status.input?.liveV11?.figmaWrites !== 2 ||
    status.input?.liveV11?.figmaCaptures !== 0 ||
    status.input?.liveV11?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV11?.attempt1Path !== V11_ATTEMPT_1_PATH ||
    status.input?.liveV11?.attempt1Sha256 !== V11_ATTEMPT_1_SHA256 ||
    status.input?.liveV11
      ?.restartAsV11Attempt2WithoutContentFillFixForbidden !== true ||
    status.input?.liveV11?.humanSignoff !== "pending" ||
    status.input?.liveV11?.overallInputSuccess !== false ||
    status.input?.liveV12?.status !== V12_STATUS ||
    status.input?.liveV12?.baseCommit !== V12_BASE_COMMIT ||
    status.input?.liveV12?.protocolSha256 !== V12_PROTOCOL_SHA256 ||
    status.input?.liveV12?.proofPlanSha256 !== V12_PLAN_SHA256 ||
    status.input?.liveV12?.captureManifestSha256 !==
      V12_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV12?.requestManifestSha256 !==
      V12_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV12?.antecedentIndexSha256 !== V12_INDEX_SHA256 ||
    status.input?.liveV12?.antecedentHashSetSha256 !== V12_HASH_SET_SHA256 ||
    status.input?.liveV12?.authorizationTemplateSha256 !==
      V12_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV12?.antecedentCommit !== V12_ANTECEDENT_COMMIT ||
    status.input?.liveV12?.authorizationPresent !== true ||
    status.input?.liveV12?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV12?.authorizationEffective !== false ||
    status.input?.liveV12?.authorizationPath !== V12_AUTHORIZATION_PATH ||
    status.input?.liveV12?.authorizationSha256 !== V12_AUTHORIZATION_SHA256 ||
    status.input?.liveV12?.signingPublicKeySpkiSha256 !==
      V12_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV12?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV12?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV12?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV12?.v11AuthorizationReusable !== false ||
    status.input?.liveV12?.v11AntecedentBytesUnchanged !== true ||
    status.input?.liveV12?.taughtPostSettleContentFillRestore !== true ||
    status.input?.liveV12?.v11WriterBytesUnchanged !== false ||
    status.input?.liveV12?.sceneReadbackCarried !== true ||
    status.input?.liveV12?.carriedV3Verifier !== true ||
    status.input?.liveV12?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV12?.carriedSceneReadback !==
      "recipe/scene-readback-v12.ts" ||
    status.input?.liveV12?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v12.ts" ||
    status.input?.liveV12?.sourceRoots !== 2 ||
    status.input?.liveV12?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV12?.captureCells !== 128 ||
    status.input?.liveV12?.remoteRequests !== 132 ||
    status.input?.liveV12?.hostPhases !== 3 ||
    status.input?.liveV12?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV12?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV12?.attemptsExecuted !== 1 ||
    status.input?.liveV12?.nextAttempt !== 2 ||
    status.input?.liveV12?.liveExecutionOccurred !== true ||
    status.input?.liveV12?.figmaWrites !== 2 ||
    status.input?.liveV12?.figmaCaptures !== 0 ||
    status.input?.liveV12?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV12?.attempt1Path !== V12_ATTEMPT_1_PATH ||
    status.input?.liveV12?.attempt1Sha256 !== V12_ATTEMPT_1_SHA256 ||
    status.input?.liveV12
      ?.restartAsV12Attempt2WithoutPostWriterFillRestoreForbidden !== true ||
    status.input?.liveV12?.humanSignoff !== "pending" ||
    status.input?.liveV12?.overallInputSuccess !== false ||
    status.input?.liveV13?.status !== V13_STATUS ||
    status.input?.liveV13?.baseCommit !== V13_BASE_COMMIT ||
    status.input?.liveV13?.protocolSha256 !== V13_PROTOCOL_SHA256 ||
    status.input?.liveV13?.proofPlanSha256 !== V13_PLAN_SHA256 ||
    status.input?.liveV13?.captureManifestSha256 !==
      V13_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV13?.requestManifestSha256 !==
      V13_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV13?.antecedentIndexSha256 !== V13_INDEX_SHA256 ||
    status.input?.liveV13?.antecedentHashSetSha256 !== V13_HASH_SET_SHA256 ||
    status.input?.liveV13?.authorizationTemplateSha256 !==
      V13_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV13?.antecedentCommit !== V13_ANTECEDENT_COMMIT ||
    status.input?.liveV13?.authorizationPresent !== true ||
    status.input?.liveV13?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV13?.authorizationEffective !== false ||
    status.input?.liveV13?.authorizationPath !== V13_AUTHORIZATION_PATH ||
    status.input?.liveV13?.authorizationSha256 !== V13_AUTHORIZATION_SHA256 ||
    status.input?.liveV13?.signingPublicKeySpkiSha256 !==
      V13_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV13?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV13?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV13?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV13?.v12AuthorizationReusable !== false ||
    status.input?.liveV13?.v12AntecedentBytesUnchanged !== true ||
    status.input?.liveV13?.taughtPostSettleContentFillRestore !== true ||
    status.input?.liveV13?.taughtPostWriterContentFillRestore !== true ||
    status.input?.liveV13?.v12WriterBytesUnchanged !== true ||
    status.input?.liveV13?.sceneReadbackCarried !== true ||
    status.input?.liveV13?.carriedV3Verifier !== true ||
    status.input?.liveV13?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV13?.carriedSceneReadback !==
      "recipe/scene-readback-v13.ts" ||
    status.input?.liveV13?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v13.ts" ||
    status.input?.liveV13?.sourceRoots !== 2 ||
    status.input?.liveV13?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV13?.captureCells !== 128 ||
    status.input?.liveV13?.remoteRequests !== 133 ||
    status.input?.liveV13?.hostPhases !== 3 ||
    status.input?.liveV13?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV13?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV13?.attemptsExecuted !== 1 ||
    status.input?.liveV13?.nextAttempt !== 2 ||
    status.input?.liveV13?.liveExecutionOccurred !== true ||
    status.input?.liveV13?.figmaWrites !== 2 ||
    status.input?.liveV13?.figmaCaptures !== 0 ||
    status.input?.liveV13?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV13?.attempt1Path !== V13_ATTEMPT_1_PATH ||
    status.input?.liveV13?.attempt1Sha256 !== V13_ATTEMPT_1_SHA256 ||
    status.input?.liveV13
      ?.restartAsV13Attempt2WithoutHashedRestoreChangeForbidden !== true ||
    status.input?.liveV13?.humanSignoff !== "pending" ||
    status.input?.liveV13?.overallInputSuccess !== false ||
    status.input?.liveV14?.status !== V14_STATUS ||
    status.input?.liveV14?.baseCommit !== V14_BASE_COMMIT ||
    status.input?.liveV14?.protocolSha256 !== V14_PROTOCOL_SHA256 ||
    status.input?.liveV14?.proofPlanSha256 !== V14_PLAN_SHA256 ||
    status.input?.liveV14?.captureManifestSha256 !==
      V14_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV14?.requestManifestSha256 !==
      V14_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV14?.antecedentIndexSha256 !== V14_INDEX_SHA256 ||
    status.input?.liveV14?.antecedentHashSetSha256 !== V14_HASH_SET_SHA256 ||
    status.input?.liveV14?.authorizationTemplateSha256 !==
      V14_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV14?.antecedentCommit !== V14_ANTECEDENT_COMMIT ||
    status.input?.liveV14?.authorizationPresent !== true ||
    status.input?.liveV14?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV14?.authorizationEffective !== false ||
    status.input?.liveV14?.authorizationPath !== V14_AUTHORIZATION_PATH ||
    status.input?.liveV14?.authorizationSha256 !== V14_AUTHORIZATION_SHA256 ||
    status.input?.liveV14?.signingPublicKeySpkiSha256 !==
      V14_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV14?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV14?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV14?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV14?.v13AuthorizationReusable !== false ||
    status.input?.liveV14?.v13AntecedentBytesUnchanged !== true ||
    status.input?.liveV14?.taughtTwoPassParentThenContentFillRestore !== true ||
    status.input?.liveV14?.taughtHiddenTextFillReveal !== true ||
    status.input?.liveV14?.v13WriterBytesUnchanged !== true ||
    status.input?.liveV14?.v13RestoreBytesUnchanged !== true ||
    status.input?.liveV14?.sceneReadbackCarried !== true ||
    status.input?.liveV14?.carriedV3Verifier !== true ||
    status.input?.liveV14?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV14?.carriedSceneReadback !==
      "recipe/scene-readback-v14.ts" ||
    status.input?.liveV14?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v14.ts" ||
    status.input?.liveV14?.sourceRoots !== 2 ||
    status.input?.liveV14?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV14?.captureCells !== 128 ||
    status.input?.liveV14?.remoteRequests !== 133 ||
    status.input?.liveV14?.hostPhases !== 3 ||
    status.input?.liveV14?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV14?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV14?.attemptsExecuted !== 1 ||
    status.input?.liveV14?.nextAttempt !== 2 ||
    status.input?.liveV14?.liveExecutionOccurred !== true ||
    status.input?.liveV14?.figmaWrites !== 2 ||
    status.input?.liveV14?.figmaCaptures !== 0 ||
    status.input?.liveV14?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV14?.attempt1Path !== V14_ATTEMPT_1_PATH ||
    status.input?.liveV14?.attempt1Sha256 !== V14_ATTEMPT_1_SHA256 ||
    status.input?.liveV14
      ?.restartAsV14Attempt2WithoutHashedRestoreChangeForbidden !== true ||
    status.input?.liveV14?.humanSignoff !== "pending" ||
    status.input?.liveV14?.overallInputSuccess !== false ||
    status.input?.liveV15?.status !== V15_STATUS ||
    status.input?.liveV15?.baseCommit !== V15_BASE_COMMIT ||
    status.input?.liveV15?.protocolSha256 !== V15_PROTOCOL_SHA256 ||
    status.input?.liveV15?.proofPlanSha256 !== V15_PLAN_SHA256 ||
    status.input?.liveV15?.captureManifestSha256 !==
      V15_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV15?.requestManifestSha256 !==
      V15_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV15?.antecedentIndexSha256 !== V15_INDEX_SHA256 ||
    status.input?.liveV15?.antecedentHashSetSha256 !== V15_HASH_SET_SHA256 ||
    status.input?.liveV15?.authorizationTemplateSha256 !==
      V15_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV15?.antecedentCommit !== V15_ANTECEDENT_COMMIT ||
    status.input?.liveV15?.authorizationPresent !== true ||
    status.input?.liveV15?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV15?.authorizationEffective !== false ||
    status.input?.liveV15?.authorizationPath !== V15_AUTHORIZATION_PATH ||
    status.input?.liveV15?.authorizationSha256 !== V15_AUTHORIZATION_SHA256 ||
    status.input?.liveV15?.signingPublicKeySpkiSha256 !==
      V15_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV15?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV15?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV15?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV15?.v14AuthorizationReusable !== false ||
    status.input?.liveV15?.v14AntecedentBytesUnchanged !== true ||
    status.input?.liveV15?.taughtTwoPassParentThenContentFillRestore !== true ||
    status.input?.liveV15?.taughtHiddenTextFillReveal !== true ||
    status.input?.liveV15?.taughtMeasureFillWhileVisible !== true ||
    status.input?.liveV15?.v14WriterBytesUnchanged !== true ||
    status.input?.liveV15?.v14RestoreBytesUnchanged !== true ||
    status.input?.liveV15?.sceneReadbackCarried !== true ||
    status.input?.liveV15?.carriedV3Verifier !== true ||
    status.input?.liveV15?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV15?.carriedSceneReadback !==
      "recipe/scene-readback-v15.ts" ||
    status.input?.liveV15?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v15.ts" ||
    status.input?.liveV15?.sourceRoots !== 2 ||
    status.input?.liveV15?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV15?.captureCells !== 128 ||
    status.input?.liveV15?.remoteRequests !== 133 ||
    status.input?.liveV15?.hostPhases !== 3 ||
    status.input?.liveV15?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV15?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV15?.attemptsExecuted !== 1 ||
    status.input?.liveV15?.nextAttempt !== 2 ||
    status.input?.liveV15?.liveExecutionOccurred !== true ||
    status.input?.liveV15?.figmaWrites !== 4 ||
    status.input?.liveV15?.figmaCaptures !== 0 ||
    status.input?.liveV15?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV15?.attempt1Path !== V15_ATTEMPT_1_PATH ||
    status.input?.liveV15?.attempt1Sha256 !== V15_ATTEMPT_1_SHA256 ||
    status.input?.liveV15
      ?.restartAsV15Attempt2WithoutPersistedFillAfterHideForbidden !== true ||
    status.input?.liveV15?.humanSignoff !== "pending" ||
    status.input?.liveV15?.overallInputSuccess !== false ||
    status.input?.liveV16?.status !== V16_STATUS ||
    status.input?.liveV16?.baseCommit !== V16_BASE_COMMIT ||
    status.input?.liveV16?.protocolSha256 !== V16_PROTOCOL_SHA256 ||
    status.input?.liveV16?.proofPlanSha256 !== V16_PLAN_SHA256 ||
    status.input?.liveV16?.captureManifestSha256 !==
      V16_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV16?.requestManifestSha256 !==
      V16_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV16?.antecedentIndexSha256 !== V16_INDEX_SHA256 ||
    status.input?.liveV16?.antecedentHashSetSha256 !== V16_HASH_SET_SHA256 ||
    status.input?.liveV16?.authorizationTemplateSha256 !==
      V16_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV16?.antecedentCommit !== V16_ANTECEDENT_COMMIT ||
    status.input?.liveV16?.authorizationPresent !== true ||
    status.input?.liveV16?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV16?.authorizationEffective !== false ||
    status.input?.liveV16?.authorizationPath !== V16_AUTHORIZATION_PATH ||
    status.input?.liveV16?.authorizationSha256 !== V16_AUTHORIZATION_SHA256 ||
    status.input?.liveV16?.signingPublicKeySpkiSha256 !==
      V16_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV16?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV16?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV16?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV16?.v15AuthorizationReusable !== false ||
    status.input?.liveV16?.v15AntecedentBytesUnchanged !== true ||
    status.input?.liveV16?.taughtMeasureFillWhileVisible !== true ||
    status.input?.liveV16?.taughtExtractMeasureHiddenContentFillWhileVisible !==
      true ||
    status.input?.liveV16?.v15WriterBytesUnchanged !== true ||
    status.input?.liveV16?.v15RestoreBytesUnchanged !== true ||
    status.input?.liveV16?.v15RuntimeBytesUnchanged !== true ||
    status.input?.liveV16?.sceneReadbackCarried !== true ||
    status.input?.liveV16?.carriedV3Verifier !== true ||
    status.input?.liveV16?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV16?.carriedSceneReadback !==
      "recipe/scene-readback-v16.ts" ||
    status.input?.liveV16?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v16.ts" ||
    status.input?.liveV16?.sourceRoots !== 2 ||
    status.input?.liveV16?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV16?.captureCells !== 128 ||
    status.input?.liveV16?.remoteRequests !== 133 ||
    status.input?.liveV16?.hostPhases !== 3 ||
    status.input?.liveV16?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV16?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV16?.attemptsExecuted !== 1 ||
    status.input?.liveV16?.nextAttempt !== 2 ||
    status.input?.liveV16?.liveExecutionOccurred !== true ||
    status.input?.liveV16?.figmaWrites !== 4 ||
    status.input?.liveV16?.figmaCaptures !== 0 ||
    status.input?.liveV16?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV16?.attempt1Path !== V16_ATTEMPT_1_PATH ||
    status.input?.liveV16?.attempt1Sha256 !== V16_ATTEMPT_1_SHA256 ||
    status.input?.liveV16
      ?.restartAsV16Attempt2WithoutLeadingSlotSolidPaintForbidden !== true ||
    status.input?.liveV16?.humanSignoff !== "pending" ||
    status.input?.liveV16?.overallInputSuccess !== false ||
    status.input?.liveV17?.status !== V17_STATUS ||
    status.input?.liveV17?.baseCommit !== V17_BASE_COMMIT ||
    status.input?.liveV17?.protocolSha256 !== V17_PROTOCOL_SHA256 ||
    status.input?.liveV17?.proofPlanSha256 !== V17_PLAN_SHA256 ||
    status.input?.liveV17?.captureManifestSha256 !==
      V17_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV17?.requestManifestSha256 !==
      V17_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV17?.antecedentIndexSha256 !== V17_INDEX_SHA256 ||
    status.input?.liveV17?.antecedentHashSetSha256 !== V17_HASH_SET_SHA256 ||
    status.input?.liveV17?.authorizationTemplateSha256 !==
      V17_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV17?.antecedentCommit !== V17_ANTECEDENT_COMMIT ||
    status.input?.liveV17?.authorizationPresent !== true ||
    status.input?.liveV17?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV17?.authorizationEffective !== false ||
    status.input?.liveV17?.authorizationPath !== V17_AUTHORIZATION_PATH ||
    status.input?.liveV17?.authorizationSha256 !== V17_AUTHORIZATION_SHA256 ||
    status.input?.liveV17?.signingPublicKeySpkiSha256 !==
      V17_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV17?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV17?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV17?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV17?.v16AuthorizationReusable !== false ||
    status.input?.liveV17?.v16AntecedentBytesUnchanged !== true ||
    status.input?.liveV17?.taughtLeadingSlotSolidPaintFromPayloadOrChild !==
      true ||
    status.input?.liveV17?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV17?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV17?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV17?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV17?.sceneReadbackCarried !== true ||
    status.input?.liveV17?.carriedV3Verifier !== true ||
    status.input?.liveV17?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV17?.carriedSceneReadback !==
      "recipe/scene-readback-v17.ts" ||
    status.input?.liveV17?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v17.ts" ||
    status.input?.liveV17?.sourceRoots !== 2 ||
    status.input?.liveV17?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV17?.captureCells !== 128 ||
    status.input?.liveV17?.remoteRequests !== 133 ||
    status.input?.liveV17?.hostPhases !== 3 ||
    status.input?.liveV17?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV17?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV17?.attemptsExecuted !== 1 ||
    status.input?.liveV17?.nextAttempt !== 2 ||
    status.input?.liveV17?.liveExecutionOccurred !== true ||
    status.input?.liveV17?.figmaWrites !== 4 ||
    status.input?.liveV17?.figmaCaptures !== 0 ||
    status.input?.liveV17?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV17?.attempt1Path !== V17_ATTEMPT_1_PATH ||
    status.input?.liveV17?.attempt1Sha256 !== V17_ATTEMPT_1_SHA256 ||
    status.input?.liveV17
      ?.restartAsV17Attempt2WithoutLeadingSlotColorBindingForbidden !== true ||
    status.input?.liveV17?.humanSignoff !== "pending" ||
    status.input?.liveV17?.overallInputSuccess !== false ||
    status.input?.liveV18?.status !== V18_STATUS ||
    status.input?.liveV18?.baseCommit !== V18_BASE_COMMIT ||
    status.input?.liveV18?.protocolSha256 !== V18_PROTOCOL_SHA256 ||
    status.input?.liveV18?.proofPlanSha256 !== V18_PLAN_SHA256 ||
    status.input?.liveV18?.captureManifestSha256 !==
      V18_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV18?.requestManifestSha256 !==
      V18_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV18?.antecedentIndexSha256 !== V18_INDEX_SHA256 ||
    status.input?.liveV18?.antecedentHashSetSha256 !== V18_HASH_SET_SHA256 ||
    status.input?.liveV18?.authorizationTemplateSha256 !==
      V18_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV18?.antecedentCommit !== V18_ANTECEDENT_COMMIT ||
    status.input?.liveV18?.authorizationPresent !== true ||
    status.input?.liveV18?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV18?.authorizationEffective !== false ||
    status.input?.liveV18?.authorizationPath !== V18_AUTHORIZATION_PATH ||
    status.input?.liveV18?.authorizationSha256 !== V18_AUTHORIZATION_SHA256 ||
    status.input?.liveV18?.signingPublicKeySpkiSha256 !==
      V18_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV18?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV18?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV18?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV18?.v17AuthorizationReusable !== false ||
    status.input?.liveV18?.v17AntecedentBytesUnchanged !== true ||
    status.input?.liveV18?.v17SceneReadbackUnchanged !== true ||
    status.input?.liveV18?.taughtLeadingSlotColorBindingFromChild !== true ||
    status.input?.liveV18?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV18?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV18?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV18?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV18?.sceneReadbackCarried !== true ||
    status.input?.liveV18?.carriedV3Verifier !== true ||
    status.input?.liveV18?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV18?.carriedSceneReadback !==
      "recipe/scene-readback-v18.ts" ||
    status.input?.liveV18?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v18.ts" ||
    status.input?.liveV18?.sourceRoots !== 2 ||
    status.input?.liveV18?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV18?.captureCells !== 128 ||
    status.input?.liveV18?.remoteRequests !== 133 ||
    status.input?.liveV18?.hostPhases !== 3 ||
    status.input?.liveV18?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV18?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV18?.attemptsExecuted !== 1 ||
    status.input?.liveV18?.nextAttempt !== 2 ||
    status.input?.liveV18?.liveExecutionOccurred !== true ||
    status.input?.liveV18?.figmaWrites !== 4 ||
    status.input?.liveV18?.figmaCaptures !== 0 ||
    status.input?.liveV18?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV18?.attempt1Path !== V18_ATTEMPT_1_PATH ||
    status.input?.liveV18?.attempt1Sha256 !== V18_ATTEMPT_1_SHA256 ||
    status.input?.liveV18
      ?.restartAsV18Attempt2WithoutSurfaceStrokeWeightForbidden !== true ||
    status.input?.liveV18?.humanSignoff !== "pending" ||
    status.input?.liveV18?.overallInputSuccess !== false ||
    status.input?.liveV19?.status !== V19_STATUS ||
    status.input?.liveV19?.baseCommit !== V19_BASE_COMMIT ||
    status.input?.liveV19?.protocolSha256 !== V19_PROTOCOL_SHA256 ||
    status.input?.liveV19?.proofPlanSha256 !== V19_PLAN_SHA256 ||
    status.input?.liveV19?.captureManifestSha256 !==
      V19_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV19?.requestManifestSha256 !==
      V19_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV19?.antecedentIndexSha256 !== V19_INDEX_SHA256 ||
    status.input?.liveV19?.antecedentHashSetSha256 !== V19_HASH_SET_SHA256 ||
    status.input?.liveV19?.authorizationTemplateSha256 !==
      V19_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV19?.antecedentCommit !== V19_ANTECEDENT_COMMIT ||
    status.input?.liveV19?.authorizationPresent !== true ||
    status.input?.liveV19?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV19?.authorizationEffective !== false ||
    status.input?.liveV19?.authorizationPath !== V19_AUTHORIZATION_PATH ||
    status.input?.liveV19?.authorizationSha256 !== V19_AUTHORIZATION_SHA256 ||
    status.input?.liveV19?.signingPublicKeySpkiSha256 !==
      V19_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV19?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV19?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV19?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV19?.v18AuthorizationReusable !== false ||
    status.input?.liveV19?.v18AntecedentBytesUnchanged !== true ||
    status.input?.liveV19?.v18SceneReadbackUnchanged !== true ||
    status.input?.liveV19?.taughtUniformPerSideStrokeWeightAsStrokes0Weight !==
      true ||
    status.input?.liveV19?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV19?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV19?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV19?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV19?.sceneReadbackCarried !== true ||
    status.input?.liveV19?.carriedV3Verifier !== true ||
    status.input?.liveV19?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV19?.carriedSceneReadback !==
      "recipe/scene-readback-v19.ts" ||
    status.input?.liveV19?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v19.ts" ||
    status.input?.liveV19?.sourceRoots !== 2 ||
    status.input?.liveV19?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV19?.captureCells !== 128 ||
    status.input?.liveV19?.remoteRequests !== 133 ||
    status.input?.liveV19?.hostPhases !== 3 ||
    status.input?.liveV19?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV19?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV19?.attemptsExecuted !== 1 ||
    status.input?.liveV19?.nextAttempt !== 2 ||
    status.input?.liveV19?.liveExecutionOccurred !== true ||
    status.input?.liveV19?.figmaWrites !== 4 ||
    status.input?.liveV19?.figmaCaptures !== 0 ||
    status.input?.liveV19?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV19?.attempt1Path !== V19_ATTEMPT_1_PATH ||
    status.input?.liveV19?.attempt1Sha256 !== V19_ATTEMPT_1_SHA256 ||
    status.input?.liveV19
      ?.restartAsV19Attempt2WithoutVariantLayoutWidthForbidden !== true ||
    status.input?.liveV19?.humanSignoff !== "pending" ||
    status.input?.liveV19?.overallInputSuccess !== false ||
    status.input?.liveV20?.status !== V20_STATUS ||
    status.input?.liveV20?.baseCommit !== V20_BASE_COMMIT ||
    status.input?.liveV20?.protocolSha256 !== V20_PROTOCOL_SHA256 ||
    status.input?.liveV20?.proofPlanSha256 !== V20_PLAN_SHA256 ||
    status.input?.liveV20?.captureManifestSha256 !==
      V20_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV20?.requestManifestSha256 !==
      V20_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV20?.antecedentIndexSha256 !== V20_INDEX_SHA256 ||
    status.input?.liveV20?.antecedentHashSetSha256 !== V20_HASH_SET_SHA256 ||
    status.input?.liveV20?.authorizationTemplateSha256 !==
      V20_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV20?.antecedentCommit !== V20_ANTECEDENT_COMMIT ||
    status.input?.liveV20?.authorizationPresent !== true ||
    status.input?.liveV20?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV20?.authorizationEffective !== false ||
    status.input?.liveV20?.authorizationPath !== V20_AUTHORIZATION_PATH ||
    status.input?.liveV20?.authorizationSha256 !== V20_AUTHORIZATION_SHA256 ||
    status.input?.liveV20?.signingPublicKeySpkiSha256 !==
      V20_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV20?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV20?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV20?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV20?.v19AuthorizationReusable !== false ||
    status.input?.liveV20?.v19AntecedentBytesUnchanged !== true ||
    status.input?.liveV20?.v19SceneReadbackUnchanged !== true ||
    status.input?.liveV20?.taughtVariantLayoutWidthFromWidthValue !== true ||
    status.input?.liveV20?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV20?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV20?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV20?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV20?.sceneReadbackCarried !== true ||
    status.input?.liveV20?.carriedV3Verifier !== true ||
    status.input?.liveV20?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV20?.carriedSceneReadback !==
      "recipe/scene-readback-v20.ts" ||
    status.input?.liveV20?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v20.ts" ||
    status.input?.liveV20?.sourceRoots !== 2 ||
    status.input?.liveV20?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV20?.captureCells !== 128 ||
    status.input?.liveV20?.remoteRequests !== 133 ||
    status.input?.liveV20?.hostPhases !== 3 ||
    status.input?.liveV20?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV20?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV20?.attemptsExecuted !== 1 ||
    status.input?.liveV20?.nextAttempt !== 2 ||
    status.input?.liveV20?.liveExecutionOccurred !== true ||
    status.input?.liveV20?.figmaWrites !== 4 ||
    status.input?.liveV20?.figmaCaptures !== 0 ||
    status.input?.liveV20?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV20?.attempt1Path !== V20_ATTEMPT_1_PATH ||
    status.input?.liveV20?.attempt1Sha256 !== V20_ATTEMPT_1_SHA256 ||
    status.input?.liveV20
      ?.restartAsV20Attempt2WithoutSurfaceLayoutHeightForbidden !== true ||
    status.input?.liveV20?.humanSignoff !== "pending" ||
    status.input?.liveV20?.overallInputSuccess !== false ||
    status.input?.liveV21?.status !== V21_STATUS ||
    status.input?.liveV21?.baseCommit !== V21_BASE_COMMIT ||
    status.input?.liveV21?.protocolSha256 !== V21_PROTOCOL_SHA256 ||
    status.input?.liveV21?.proofPlanSha256 !== V21_PLAN_SHA256 ||
    status.input?.liveV21?.captureManifestSha256 !==
      V21_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV21?.requestManifestSha256 !==
      V21_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV21?.antecedentIndexSha256 !== V21_INDEX_SHA256 ||
    status.input?.liveV21?.antecedentHashSetSha256 !== V21_HASH_SET_SHA256 ||
    status.input?.liveV21?.authorizationTemplateSha256 !==
      V21_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV21?.antecedentCommit !== V21_ANTECEDENT_COMMIT ||
    status.input?.liveV21?.authorizationPresent !== true ||
    status.input?.liveV21?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV21?.authorizationEffective !== false ||
    status.input?.liveV21?.authorizationPath !== V21_AUTHORIZATION_PATH ||
    status.input?.liveV21?.authorizationSha256 !== V21_AUTHORIZATION_SHA256 ||
    status.input?.liveV21?.signingPublicKeySpkiSha256 !==
      V21_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV21?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV21?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV21?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV21?.v20AuthorizationReusable !== false ||
    status.input?.liveV21?.v20AntecedentBytesUnchanged !== true ||
    status.input?.liveV21?.v20SceneReadbackUnchanged !== true ||
    status.input?.liveV21?.taughtSurfaceLayoutHeightFromHeightValue !== true ||
    status.input?.liveV21?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV21?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV21?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV21?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV21?.sceneReadbackCarried !== true ||
    status.input?.liveV21?.carriedV3Verifier !== true ||
    status.input?.liveV21?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV21?.carriedSceneReadback !==
      "recipe/scene-readback-v21.ts" ||
    status.input?.liveV21?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v21.ts" ||
    status.input?.liveV21?.sourceRoots !== 2 ||
    status.input?.liveV21?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV21?.captureCells !== 128 ||
    status.input?.liveV21?.remoteRequests !== 133 ||
    status.input?.liveV21?.hostPhases !== 3 ||
    status.input?.liveV21?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV21?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV21?.attemptsExecuted !== 1 ||
    status.input?.liveV21?.nextAttempt !== 2 ||
    status.input?.liveV21?.liveExecutionOccurred !== true ||
    status.input?.liveV21?.figmaWrites !== 4 ||
    status.input?.liveV21?.figmaCaptures !== 0 ||
    status.input?.liveV21?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV21?.attempt1Path !== V21_ATTEMPT_1_PATH ||
    status.input?.liveV21?.attempt1Sha256 !== V21_ATTEMPT_1_SHA256 ||
    status.input?.liveV21
      ?.restartAsV21Attempt2WithoutVariantBindingsLengthForbidden !== true ||
    status.input?.liveV21?.humanSignoff !== "pending" ||
    status.input?.liveV21?.overallInputSuccess !== false ||
    status.input?.liveV22?.status !== V22_STATUS ||
    status.input?.liveV22?.baseCommit !== V22_BASE_COMMIT ||
    status.input?.liveV22?.protocolSha256 !== V22_PROTOCOL_SHA256 ||
    status.input?.liveV22?.proofPlanSha256 !== V22_PLAN_SHA256 ||
    status.input?.liveV22?.captureManifestSha256 !==
      V22_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV22?.requestManifestSha256 !==
      V22_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV22?.antecedentIndexSha256 !== V22_INDEX_SHA256 ||
    status.input?.liveV22?.antecedentHashSetSha256 !== V22_HASH_SET_SHA256 ||
    status.input?.liveV22?.authorizationTemplateSha256 !==
      V22_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV22?.antecedentCommit !== V22_ANTECEDENT_COMMIT ||
    status.input?.liveV22?.authorizationPresent !== true ||
    status.input?.liveV22?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV22?.authorizationEffective !== false ||
    status.input?.liveV22?.authorizationPath !== V22_AUTHORIZATION_PATH ||
    status.input?.liveV22?.authorizationSha256 !== V22_AUTHORIZATION_SHA256 ||
    status.input?.liveV22?.signingPublicKeySpkiSha256 !==
      V22_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV22?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV22?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV22?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV22?.v21AuthorizationReusable !== false ||
    status.input?.liveV22?.v21AntecedentBytesUnchanged !== true ||
    status.input?.liveV22?.v21SceneReadbackUnchanged !== true ||
    status.input?.liveV22?.taughtLayoutBindingAliasWithoutSourceField !==
      true ||
    status.input?.liveV22?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV22?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV22?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV22?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV22?.sceneReadbackCarried !== true ||
    status.input?.liveV22?.carriedV3Verifier !== true ||
    status.input?.liveV22?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV22?.carriedSceneReadback !==
      "recipe/scene-readback-v22.ts" ||
    status.input?.liveV22?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v22.ts" ||
    status.input?.liveV22?.sourceRoots !== 2 ||
    status.input?.liveV22?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV22?.captureCells !== 128 ||
    status.input?.liveV22?.remoteRequests !== 133 ||
    status.input?.liveV22?.hostPhases !== 3 ||
    status.input?.liveV22?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV22?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV22?.attemptsExecuted !== 1 ||
    status.input?.liveV22?.nextAttempt !== 2 ||
    status.input?.liveV22?.liveExecutionOccurred !== true ||
    status.input?.liveV22?.figmaWrites !== 4 ||
    status.input?.liveV22?.figmaCaptures !== 0 ||
    status.input?.liveV22?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV22?.attempt1Path !== V22_ATTEMPT_1_PATH ||
    status.input?.liveV22?.attempt1Sha256 !== V22_ATTEMPT_1_SHA256 ||
    status.input?.liveV22
      ?.restartAsV22Attempt2WithoutVariantBindingsFieldForbidden !== true ||
    status.input?.liveV22?.humanSignoff !== "pending" ||
    status.input?.liveV22?.overallInputSuccess !== false ||
    status.input?.liveV23?.status !== V23_STATUS ||
    status.input?.liveV23?.baseCommit !== V23_BASE_COMMIT ||
    status.input?.liveV23?.protocolSha256 !== V23_PROTOCOL_SHA256 ||
    status.input?.liveV23?.proofPlanSha256 !== V23_PLAN_SHA256 ||
    status.input?.liveV23?.captureManifestSha256 !==
      V23_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV23?.requestManifestSha256 !==
      V23_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV23?.antecedentIndexSha256 !== V23_INDEX_SHA256 ||
    status.input?.liveV23?.antecedentHashSetSha256 !== V23_HASH_SET_SHA256 ||
    status.input?.liveV23?.authorizationTemplateSha256 !==
      V23_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV23?.antecedentCommit !== V23_ANTECEDENT_COMMIT ||
    status.input?.liveV23?.authorizationPresent !== true ||
    status.input?.liveV23?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV23?.authorizationEffective !== false ||
    status.input?.liveV23?.authorizationPath !== V23_AUTHORIZATION_PATH ||
    status.input?.liveV23?.authorizationSha256 !== V23_AUTHORIZATION_SHA256 ||
    status.input?.liveV23?.signingPublicKeySpkiSha256 !==
      V23_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV23?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV23?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV23?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV23?.v22AuthorizationReusable !== false ||
    status.input?.liveV23?.v22AntecedentBytesUnchanged !== true ||
    status.input?.liveV23?.v22SceneReadbackUnchanged !== true ||
    status.input?.liveV23?.taughtLayoutBindingAliasCompileIndex !== true ||
    status.input?.liveV23?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV23?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV23?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV23?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV23?.sceneReadbackCarried !== true ||
    status.input?.liveV23?.carriedV3Verifier !== true ||
    status.input?.liveV23?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV23?.carriedSceneReadback !==
      "recipe/scene-readback-v23.ts" ||
    status.input?.liveV23?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v23.ts" ||
    status.input?.liveV23?.sourceRoots !== 2 ||
    status.input?.liveV23?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV23?.captureCells !== 128 ||
    status.input?.liveV23?.remoteRequests !== 133 ||
    status.input?.liveV23?.hostPhases !== 3 ||
    status.input?.liveV23?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV23?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV23?.attemptsExecuted !== 1 ||
    status.input?.liveV23?.nextAttempt !== 2 ||
    status.input?.liveV23?.liveExecutionOccurred !== true ||
    status.input?.liveV23?.figmaWrites !== 4 ||
    status.input?.liveV23?.figmaCaptures !== 0 ||
    status.input?.liveV23?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV23?.attempt1Path !== V23_ATTEMPT_1_PATH ||
    status.input?.liveV23?.attempt1Sha256 !== V23_ATTEMPT_1_SHA256 ||
    status.input?.liveV23
      ?.restartAsV23Attempt2WithoutSurfaceBindingsLengthForbidden !== true ||
    status.input?.liveV23?.humanSignoff !== "pending" ||
    status.input?.liveV23?.overallInputSuccess !== false ||
    status.input?.liveV24?.status !== V24_STATUS ||
    status.input?.liveV24?.baseCommit !== V24_BASE_COMMIT ||
    status.input?.liveV24?.protocolSha256 !== V24_PROTOCOL_SHA256 ||
    status.input?.liveV24?.proofPlanSha256 !== V24_PLAN_SHA256 ||
    status.input?.liveV24?.captureManifestSha256 !==
      V24_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV24?.requestManifestSha256 !==
      V24_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV24?.antecedentIndexSha256 !== V24_INDEX_SHA256 ||
    status.input?.liveV24?.antecedentHashSetSha256 !== V24_HASH_SET_SHA256 ||
    status.input?.liveV24?.authorizationTemplateSha256 !==
      V24_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV24?.antecedentCommit !== V24_ANTECEDENT_COMMIT ||
    status.input?.liveV24?.authorizationPresent !== true ||
    status.input?.liveV24?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV24?.authorizationEffective !== false ||
    status.input?.liveV24?.authorizationPath !== V24_AUTHORIZATION_PATH ||
    status.input?.liveV24?.authorizationSha256 !== V24_AUTHORIZATION_SHA256 ||
    status.input?.liveV24?.signingPublicKeySpkiSha256 !==
      V24_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV24?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV24?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV24?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV24?.v23AuthorizationReusable !== false ||
    status.input?.liveV24?.v23AntecedentBytesUnchanged !== true ||
    status.input?.liveV24?.v23SceneReadbackUnchanged !== true ||
    status.input?.liveV24?.taughtSurfaceBindingExtrasDropped !== true ||
    status.input?.liveV24?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV24?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV24?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV24?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV24?.sceneReadbackCarried !== true ||
    status.input?.liveV24?.carriedV3Verifier !== true ||
    status.input?.liveV24?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV24?.carriedSceneReadback !==
      "recipe/scene-readback-v24.ts" ||
    status.input?.liveV24?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v24.ts" ||
    status.input?.liveV24?.sourceRoots !== 2 ||
    status.input?.liveV24?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV24?.captureCells !== 128 ||
    status.input?.liveV24?.remoteRequests !== 133 ||
    status.input?.liveV24?.hostPhases !== 3 ||
    status.input?.liveV24?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV24?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV24?.attemptsExecuted !== 1 ||
    status.input?.liveV24?.nextAttempt !== 2 ||
    status.input?.liveV24?.liveExecutionOccurred !== true ||
    status.input?.liveV24?.figmaWrites !== 4 ||
    status.input?.liveV24?.figmaCaptures !== 0 ||
    status.input?.liveV24?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV24?.attempt1Path !== V24_ATTEMPT_1_PATH ||
    status.input?.liveV24?.attempt1Sha256 !== V24_ATTEMPT_1_SHA256 ||
    status.input?.liveV24
      ?.restartAsV24Attempt2WithoutSurfaceBindingsFieldForbidden !== true ||
    status.input?.liveV24?.humanSignoff !== "pending" ||
    status.input?.liveV24?.overallInputSuccess !== false ||
    status.input?.liveV25?.status !== V25_STATUS ||
    status.input?.liveV25?.baseCommit !== V25_BASE_COMMIT ||
    status.input?.liveV25?.protocolSha256 !== V25_PROTOCOL_SHA256 ||
    status.input?.liveV25?.proofPlanSha256 !== V25_PLAN_SHA256 ||
    status.input?.liveV25?.captureManifestSha256 !==
      V25_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV25?.requestManifestSha256 !==
      V25_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV25?.antecedentIndexSha256 !== V25_INDEX_SHA256 ||
    status.input?.liveV25?.antecedentHashSetSha256 !== V25_HASH_SET_SHA256 ||
    status.input?.liveV25?.authorizationTemplateSha256 !==
      V25_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV25?.antecedentCommit !== V25_ANTECEDENT_COMMIT ||
    status.input?.liveV25?.authorizationPresent !== true ||
    status.input?.liveV25?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV25?.authorizationEffective !== false ||
    status.input?.liveV25?.authorizationPath !== V25_AUTHORIZATION_PATH ||
    status.input?.liveV25?.authorizationSha256 !== V25_AUTHORIZATION_SHA256 ||
    status.input?.liveV25?.signingPublicKeySpkiSha256 !==
      V25_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV25?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV25?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV25?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV25?.v24AuthorizationReusable !== false ||
    status.input?.liveV25?.v24AntecedentBytesUnchanged !== true ||
    status.input?.liveV25?.v24SceneReadbackUnchanged !== true ||
    status.input?.liveV25?.taughtSurfaceBindingCompileOrder !== true ||
    status.input?.liveV25?.taughtSurfaceBindingExtrasDropped !== true ||
    status.input?.liveV25?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV25?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV25?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV25?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV25?.sceneReadbackCarried !== true ||
    status.input?.liveV25?.carriedV3Verifier !== true ||
    status.input?.liveV25?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV25?.carriedSceneReadback !==
      "recipe/scene-readback-v25.ts" ||
    status.input?.liveV25?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v25.ts" ||
    status.input?.liveV25?.sourceRoots !== 2 ||
    status.input?.liveV25?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV25?.captureCells !== 128 ||
    status.input?.liveV25?.remoteRequests !== 133 ||
    status.input?.liveV25?.hostPhases !== 3 ||
    status.input?.liveV25?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV25?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV25?.attemptsExecuted !== 1 ||
    status.input?.liveV25?.nextAttempt !== 2 ||
    status.input?.liveV25?.liveExecutionOccurred !== true ||
    status.input?.liveV25?.figmaWrites !== 4 ||
    status.input?.liveV25?.figmaCaptures !== 0 ||
    status.input?.liveV25?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV25?.attempt1Path !== V25_ATTEMPT_1_PATH ||
    status.input?.liveV25?.attempt1Sha256 !== V25_ATTEMPT_1_SHA256 ||
    status.input?.liveV25
      ?.restartAsV25Attempt2WithoutContentPlaceholderBindingsFieldForbidden !==
      true ||
    status.input?.liveV25?.humanSignoff !== "pending" ||
    status.input?.liveV25?.overallInputSuccess !== false ||
    status.input?.liveV26?.status !== V26_STATUS ||
    status.input?.liveV26?.baseCommit !== V26_BASE_COMMIT ||
    status.input?.liveV26?.protocolSha256 !== V26_PROTOCOL_SHA256 ||
    status.input?.liveV26?.proofPlanSha256 !== V26_PLAN_SHA256 ||
    status.input?.liveV26?.captureManifestSha256 !==
      V26_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV26?.requestManifestSha256 !==
      V26_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV26?.antecedentIndexSha256 !== V26_INDEX_SHA256 ||
    status.input?.liveV26?.antecedentHashSetSha256 !== V26_HASH_SET_SHA256 ||
    status.input?.liveV26?.authorizationTemplateSha256 !==
      V26_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV26?.antecedentCommit !== V26_ANTECEDENT_COMMIT ||
    status.input?.liveV26?.authorizationPresent !== true ||
    status.input?.liveV26?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV26?.authorizationEffective !== false ||
    status.input?.liveV26?.authorizationPath !== V26_AUTHORIZATION_PATH ||
    status.input?.liveV26?.authorizationSha256 !== V26_AUTHORIZATION_SHA256 ||
    status.input?.liveV26?.signingPublicKeySpkiSha256 !==
      V26_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV26?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV26?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV26?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV26?.v25AuthorizationReusable !== false ||
    status.input?.liveV26?.v25AntecedentBytesUnchanged !== true ||
    status.input?.liveV26?.v25SceneReadbackUnchanged !== true ||
    status.input?.liveV26?.taughtContentBindingCompileOrder !== true ||
    status.input?.liveV26?.taughtContentBindingExtrasDropped !== true ||
    status.input?.liveV26?.taughtSurfaceBindingCompileOrder !== true ||
    status.input?.liveV26?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV26?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV26?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV26?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV26?.sceneReadbackCarried !== true ||
    status.input?.liveV26?.carriedV3Verifier !== true ||
    status.input?.liveV26?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV26?.carriedSceneReadback !==
      "recipe/scene-readback-v26.ts" ||
    status.input?.liveV26?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v26.ts" ||
    status.input?.liveV26?.sourceRoots !== 2 ||
    status.input?.liveV26?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV26?.captureCells !== 128 ||
    status.input?.liveV26?.remoteRequests !== 133 ||
    status.input?.liveV26?.hostPhases !== 3 ||
    status.input?.liveV26?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV26?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV26?.attemptsExecuted !== 1 ||
    status.input?.liveV26?.nextAttempt !== 2 ||
    status.input?.liveV26?.liveExecutionOccurred !== true ||
    status.input?.liveV26?.figmaWrites !== 4 ||
    status.input?.liveV26?.figmaCaptures !== 0 ||
    status.input?.liveV26?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV26?.attempt1Path !== V26_ATTEMPT_1_PATH ||
    status.input?.liveV26?.attempt1Sha256 !== V26_ATTEMPT_1_SHA256 ||
    status.input?.liveV26
      ?.restartAsV26Attempt2WithoutContentPlaceholderHeightModeForbidden !==
      true ||
    status.input?.liveV26?.humanSignoff !== "pending" ||
    status.input?.liveV26?.overallInputSuccess !== false ||
    status.input?.liveV27?.status !== V27_STATUS ||
    status.input?.liveV27?.baseCommit !== V27_BASE_COMMIT ||
    status.input?.liveV27?.protocolSha256 !== V27_PROTOCOL_SHA256 ||
    status.input?.liveV27?.proofPlanSha256 !== V27_PLAN_SHA256 ||
    status.input?.liveV27?.captureManifestSha256 !==
      V27_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV27?.requestManifestSha256 !==
      V27_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV27?.antecedentIndexSha256 !== V27_INDEX_SHA256 ||
    status.input?.liveV27?.antecedentHashSetSha256 !== V27_HASH_SET_SHA256 ||
    status.input?.liveV27?.authorizationTemplateSha256 !==
      V27_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV27?.antecedentCommit !== V27_ANTECEDENT_COMMIT ||
    status.input?.liveV27?.authorizationPresent !== true ||
    status.input?.liveV27?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV27?.authorizationEffective !== false ||
    status.input?.liveV27?.authorizationPath !== V27_AUTHORIZATION_PATH ||
    status.input?.liveV27?.authorizationSha256 !== V27_AUTHORIZATION_SHA256 ||
    status.input?.liveV27?.signingPublicKeySpkiSha256 !==
      V27_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV27?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV27?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV27?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV27?.v26AuthorizationReusable !== false ||
    status.input?.liveV27?.v26AntecedentBytesUnchanged !== true ||
    status.input?.liveV27?.v26SceneReadbackUnchanged !== true ||
    status.input?.liveV27?.taughtContentHiddenFixedHeightAsHug !== true ||
    status.input?.liveV27?.taughtContentBindingCompileOrder !== true ||
    status.input?.liveV27?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV27?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV27?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV27?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV27?.sceneReadbackCarried !== true ||
    status.input?.liveV27?.carriedV3Verifier !== true ||
    status.input?.liveV27?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV27?.carriedSceneReadback !==
      "recipe/scene-readback-v27.ts" ||
    status.input?.liveV27?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v27.ts" ||
    status.input?.liveV27?.sourceRoots !== 2 ||
    status.input?.liveV27?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV27?.captureCells !== 128 ||
    status.input?.liveV27?.remoteRequests !== 133 ||
    status.input?.liveV27?.hostPhases !== 3 ||
    status.input?.liveV27?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV27?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV27?.attemptsExecuted !== 1 ||
    status.input?.liveV27?.nextAttempt !== 2 ||
    status.input?.liveV27?.liveExecutionOccurred !== true ||
    status.input?.liveV27?.figmaWrites !== 4 ||
    status.input?.liveV27?.figmaCaptures !== 0 ||
    status.input?.liveV27?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV27?.attempt1Path !== V27_ATTEMPT_1_PATH ||
    status.input?.liveV27?.attempt1Sha256 !== V27_ATTEMPT_1_SHA256 ||
    status.input?.liveV27
      ?.restartAsV27Attempt2WithoutContentPlaceholderLetterSpacingForbidden !==
      true ||
    status.input?.liveV27?.humanSignoff !== "pending" ||
    status.input?.liveV27?.overallInputSuccess !== false ||
    status.input?.liveV28?.status !== V28_STATUS ||
    status.input?.liveV28?.baseCommit !== V28_BASE_COMMIT ||
    status.input?.liveV28?.protocolSha256 !== V28_PROTOCOL_SHA256 ||
    status.input?.liveV28?.proofPlanSha256 !== V28_PLAN_SHA256 ||
    status.input?.liveV28?.captureManifestSha256 !==
      V28_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV28?.requestManifestSha256 !==
      V28_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV28?.antecedentIndexSha256 !== V28_INDEX_SHA256 ||
    status.input?.liveV28?.antecedentHashSetSha256 !== V28_HASH_SET_SHA256 ||
    status.input?.liveV28?.authorizationTemplateSha256 !==
      V28_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV28?.antecedentCommit !== V28_ANTECEDENT_COMMIT ||
    status.input?.liveV28?.authorizationPresent !== true ||
    status.input?.liveV28?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV28?.authorizationEffective !== false ||
    status.input?.liveV28?.authorizationPath !== V28_AUTHORIZATION_PATH ||
    status.input?.liveV28?.authorizationSha256 !== V28_AUTHORIZATION_SHA256 ||
    status.input?.liveV28?.signingPublicKeySpkiSha256 !==
      V28_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV28?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV28?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV28?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV28?.v27AuthorizationReusable !== false ||
    status.input?.liveV28?.v27AntecedentBytesUnchanged !== true ||
    status.input?.liveV28?.v27SceneReadbackUnchanged !== true ||
    status.input?.liveV28?.taughtContentLetterSpacingOmitted !== true ||
    status.input?.liveV28?.taughtContentHiddenFixedHeightAsHug !== true ||
    status.input?.liveV28?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV28?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV28?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV28?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV28?.sceneReadbackCarried !== true ||
    status.input?.liveV28?.carriedV3Verifier !== true ||
    status.input?.liveV28?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV28?.carriedSceneReadback !==
      "recipe/scene-readback-v28.ts" ||
    status.input?.liveV28?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v28.ts" ||
    status.input?.liveV28?.sourceRoots !== 2 ||
    status.input?.liveV28?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV28?.captureCells !== 128 ||
    status.input?.liveV28?.remoteRequests !== 133 ||
    status.input?.liveV28?.hostPhases !== 3 ||
    status.input?.liveV28?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV28?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV28?.attemptsExecuted !== 1 ||
    status.input?.liveV28?.nextAttempt !== 2 ||
    status.input?.liveV28?.liveExecutionOccurred !== true ||
    status.input?.liveV28?.figmaWrites !== 4 ||
    status.input?.liveV28?.figmaCaptures !== 0 ||
    status.input?.liveV28?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV28?.attempt1Path !== V28_ATTEMPT_1_PATH ||
    status.input?.liveV28?.attempt1Sha256 !== V28_ATTEMPT_1_SHA256 ||
    status.input?.liveV28
      ?.restartAsV28Attempt2WithoutContentPlaceholderTextCaseForbidden !==
      true ||
    status.input?.liveV28?.humanSignoff !== "pending" ||
    status.input?.liveV28?.overallInputSuccess !== false ||
    status.input?.liveV29?.status !== V29_STATUS ||
    status.input?.liveV29?.baseCommit !== V29_BASE_COMMIT ||
    status.input?.liveV29?.protocolSha256 !== V29_PROTOCOL_SHA256 ||
    status.input?.liveV29?.proofPlanSha256 !== V29_PLAN_SHA256 ||
    status.input?.liveV29?.captureManifestSha256 !==
      V29_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV29?.requestManifestSha256 !==
      V29_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV29?.antecedentIndexSha256 !== V29_INDEX_SHA256 ||
    status.input?.liveV29?.antecedentHashSetSha256 !== V29_HASH_SET_SHA256 ||
    status.input?.liveV29?.authorizationTemplateSha256 !==
      V29_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV29?.antecedentCommit !== V29_ANTECEDENT_COMMIT ||
    status.input?.liveV29?.authorizationPresent !== true ||
    status.input?.liveV29?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV29?.authorizationEffective !== false ||
    status.input?.liveV29?.authorizationPath !== V29_AUTHORIZATION_PATH ||
    status.input?.liveV29?.authorizationSha256 !== V29_AUTHORIZATION_SHA256 ||
    status.input?.liveV29?.signingPublicKeySpkiSha256 !==
      V29_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV29?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV29?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV29?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV29?.v28AuthorizationReusable !== false ||
    status.input?.liveV29?.v28AntecedentBytesUnchanged !== true ||
    status.input?.liveV29?.v28SceneReadbackUnchanged !== true ||
    status.input?.liveV29?.taughtContentTextCaseOmitted !== true ||
    status.input?.liveV29?.taughtContentLetterSpacingOmitted !== true ||
    status.input?.liveV29?.taughtContentHiddenFixedHeightAsHug !== true ||
    status.input?.liveV29?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV29?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV29?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV29?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV29?.sceneReadbackCarried !== true ||
    status.input?.liveV29?.carriedV3Verifier !== true ||
    status.input?.liveV29?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV29?.carriedSceneReadback !==
      "recipe/scene-readback-v29.ts" ||
    status.input?.liveV29?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v29.ts" ||
    status.input?.liveV29?.sourceRoots !== 2 ||
    status.input?.liveV29?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV29?.captureCells !== 128 ||
    status.input?.liveV29?.remoteRequests !== 133 ||
    status.input?.liveV29?.hostPhases !== 3 ||
    status.input?.liveV29?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV29?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV29?.attemptsExecuted !== 1 ||
    status.input?.liveV29?.nextAttempt !== 2 ||
    status.input?.liveV29?.liveExecutionOccurred !== true ||
    status.input?.liveV29?.figmaWrites !== 4 ||
    status.input?.liveV29?.figmaCaptures !== 0 ||
    status.input?.liveV29?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV29?.attempt1Path !== V29_ATTEMPT_1_PATH ||
    status.input?.liveV29?.attempt1Sha256 !== V29_ATTEMPT_1_SHA256 ||
    status.input?.liveV29
      ?.restartAsV29Attempt2WithoutContentPlaceholderTextDecorationForbidden !==
      true ||
    status.input?.liveV29?.humanSignoff !== "pending" ||
    status.input?.liveV29?.overallInputSuccess !== false ||
    status.input?.liveV30?.status !== V30_STATUS ||
    status.input?.liveV30?.baseCommit !== V30_BASE_COMMIT ||
    status.input?.liveV30?.protocolSha256 !== V30_PROTOCOL_SHA256 ||
    status.input?.liveV30?.proofPlanSha256 !== V30_PLAN_SHA256 ||
    status.input?.liveV30?.captureManifestSha256 !==
      V30_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV30?.requestManifestSha256 !==
      V30_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV30?.antecedentIndexSha256 !== V30_INDEX_SHA256 ||
    status.input?.liveV30?.antecedentHashSetSha256 !== V30_HASH_SET_SHA256 ||
    status.input?.liveV30?.authorizationTemplateSha256 !==
      V30_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV30?.antecedentCommit !== V30_ANTECEDENT_COMMIT ||
    status.input?.liveV30?.authorizationPresent !== true ||
    status.input?.liveV30?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV30?.authorizationEffective !== false ||
    status.input?.liveV30?.authorizationPath !== V30_AUTHORIZATION_PATH ||
    status.input?.liveV30?.authorizationSha256 !== V30_AUTHORIZATION_SHA256 ||
    status.input?.liveV30?.signingPublicKeySpkiSha256 !==
      V30_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV30?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV30?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV30?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV30?.v29AuthorizationReusable !== false ||
    status.input?.liveV30?.v29AntecedentBytesUnchanged !== true ||
    status.input?.liveV30?.v29SceneReadbackUnchanged !== true ||
    status.input?.liveV30?.taughtContentTextDecorationOmitted !== true ||
    status.input?.liveV30?.taughtContentTextCaseOmitted !== true ||
    status.input?.liveV30?.taughtContentLetterSpacingOmitted !== true ||
    status.input?.liveV30?.taughtContentHiddenFixedHeightAsHug !== true ||
    status.input?.liveV30?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV30?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV30?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV30?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV30?.sceneReadbackCarried !== true ||
    status.input?.liveV30?.carriedV3Verifier !== true ||
    status.input?.liveV30?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV30?.carriedSceneReadback !==
      "recipe/scene-readback-v30.ts" ||
    status.input?.liveV30?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v30.ts" ||
    status.input?.liveV30?.sourceRoots !== 2 ||
    status.input?.liveV30?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV30?.captureCells !== 128 ||
    status.input?.liveV30?.remoteRequests !== 133 ||
    status.input?.liveV30?.hostPhases !== 3 ||
    status.input?.liveV30?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV30?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV30?.attemptsExecuted !== 1 ||
    status.input?.liveV30?.nextAttempt !== 2 ||
    status.input?.liveV30?.liveExecutionOccurred !== true ||
    status.input?.liveV30?.figmaWrites !== 4 ||
    status.input?.liveV30?.figmaCaptures !== 0 ||
    status.input?.liveV30?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV30?.attempt1Path !== V30_ATTEMPT_1_PATH ||
    status.input?.liveV30?.attempt1Sha256 !== V30_ATTEMPT_1_SHA256 ||
    status.input?.liveV30
      ?.restartAsV30Attempt2WithoutContentRowClipsContentForbidden !==
      true ||
    status.input?.liveV30?.humanSignoff !== "pending" ||
    status.input?.liveV30?.overallInputSuccess !== false ||
    status.input?.liveV31?.status !== V31_STATUS ||
    status.input?.liveV31?.baseCommit !== V31_BASE_COMMIT ||
    status.input?.liveV31?.protocolSha256 !== V31_PROTOCOL_SHA256 ||
    status.input?.liveV31?.proofPlanSha256 !== V31_PLAN_SHA256 ||
    status.input?.liveV31?.captureManifestSha256 !==
      V31_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV31?.requestManifestSha256 !==
      V31_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV31?.antecedentIndexSha256 !== V31_INDEX_SHA256 ||
    status.input?.liveV31?.antecedentHashSetSha256 !== V31_HASH_SET_SHA256 ||
    status.input?.liveV31?.authorizationTemplateSha256 !==
      V31_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV31?.antecedentCommit !== V31_ANTECEDENT_COMMIT ||
    status.input?.liveV31?.authorizationPresent !== true ||
    status.input?.liveV31?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV31?.authorizationEffective !== false ||
    status.input?.liveV31?.authorizationPath !== V31_AUTHORIZATION_PATH ||
    status.input?.liveV31?.authorizationSha256 !== V31_AUTHORIZATION_SHA256 ||
    status.input?.liveV31?.signingPublicKeySpkiSha256 !==
      V31_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV31?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV31?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV31?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV31?.v30AuthorizationReusable !== false ||
    status.input?.liveV31?.v30AntecedentBytesUnchanged !== true ||
    status.input?.liveV31?.v30SceneReadbackUnchanged !== true ||
    status.input?.liveV31?.taughtContentRowClipsContentOmitted !== true ||
    status.input?.liveV31?.taughtContentTextDecorationOmitted !== true ||
    status.input?.liveV31?.taughtContentTextCaseOmitted !== true ||
    status.input?.liveV31?.taughtContentLetterSpacingOmitted !== true ||
    status.input?.liveV31?.taughtContentHiddenFixedHeightAsHug !== true ||
    status.input?.liveV31?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV31?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV31?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV31?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV31?.sceneReadbackCarried !== true ||
    status.input?.liveV31?.carriedV3Verifier !== true ||
    status.input?.liveV31?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV31?.carriedSceneReadback !==
      "recipe/scene-readback-v31.ts" ||
    status.input?.liveV31?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v31.ts" ||
    status.input?.liveV31?.sourceRoots !== 2 ||
    status.input?.liveV31?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV31?.captureCells !== 128 ||
    status.input?.liveV31?.remoteRequests !== 133 ||
    status.input?.liveV31?.hostPhases !== 3 ||
    status.input?.liveV31?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV31?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV31?.attemptsExecuted !== 1 ||
    status.input?.liveV31?.nextAttempt !== 2 ||
    status.input?.liveV31?.liveExecutionOccurred !== true ||
    status.input?.liveV31?.figmaWrites !== 4 ||
    status.input?.liveV31?.figmaCaptures !== 0 ||
    status.input?.liveV31?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV31?.attempt1Path !== V31_ATTEMPT_1_PATH ||
    status.input?.liveV31?.attempt1Sha256 !== V31_ATTEMPT_1_SHA256 ||
    status.input?.liveV31
      ?.restartAsV31Attempt2WithoutContentRowCornerRadiusForbidden !==
      true ||
    status.input?.liveV31?.humanSignoff !== "pending" ||
    status.input?.liveV31?.overallInputSuccess !== false ||
    status.input?.liveV32?.status !== V32_STATUS ||
    status.input?.liveV32?.baseCommit !== V32_BASE_COMMIT ||
    status.input?.liveV32?.protocolSha256 !== V32_PROTOCOL_SHA256 ||
    status.input?.liveV32?.proofPlanSha256 !== V32_PLAN_SHA256 ||
    status.input?.liveV32?.captureManifestSha256 !==
      V32_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV32?.requestManifestSha256 !==
      V32_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV32?.antecedentIndexSha256 !== V32_INDEX_SHA256 ||
    status.input?.liveV32?.antecedentHashSetSha256 !== V32_HASH_SET_SHA256 ||
    status.input?.liveV32?.authorizationTemplateSha256 !==
      V32_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV32?.antecedentCommit !== V32_ANTECEDENT_COMMIT ||
    status.input?.liveV32?.authorizationPresent !== true ||
    status.input?.liveV32?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV32?.authorizationEffective !== false ||
    status.input?.liveV32?.authorizationPath !== V32_AUTHORIZATION_PATH ||
    status.input?.liveV32?.authorizationSha256 !== V32_AUTHORIZATION_SHA256 ||
    status.input?.liveV32?.signingPublicKeySpkiSha256 !==
      V32_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV32?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV32?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV32?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV32?.v31AuthorizationReusable !== false ||
    status.input?.liveV32?.v31AntecedentBytesUnchanged !== true ||
    status.input?.liveV32?.v31SceneReadbackUnchanged !== true ||
    status.input?.liveV32?.taughtContentRowCornerRadiusOmitted !== true ||
    status.input?.liveV32?.taughtContentRowClipsContentOmitted !== true ||
    status.input?.liveV32?.taughtContentTextDecorationOmitted !== true ||
    status.input?.liveV32?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV32?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV32?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV32?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV32?.sceneReadbackCarried !== true ||
    status.input?.liveV32?.carriedV3Verifier !== true ||
    status.input?.liveV32?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV32?.carriedSceneReadback !==
      "recipe/scene-readback-v32.ts" ||
    status.input?.liveV32?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v32.ts" ||
    status.input?.liveV32?.sourceRoots !== 2 ||
    status.input?.liveV32?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV32?.captureCells !== 128 ||
    status.input?.liveV32?.remoteRequests !== 133 ||
    status.input?.liveV32?.hostPhases !== 3 ||
    status.input?.liveV32?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV32?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV32?.attemptsExecuted !== 1 ||
    status.input?.liveV32?.nextAttempt !== 2 ||
    status.input?.liveV32?.liveExecutionOccurred !== true ||
    status.input?.liveV32?.figmaWrites !== 4 ||
    status.input?.liveV32?.figmaCaptures !== 0 ||
    status.input?.liveV32?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV32?.attempt1Path !== V32_ATTEMPT_1_PATH ||
    status.input?.liveV32?.attempt1Sha256 !== V32_ATTEMPT_1_SHA256 ||
    status.input?.liveV32
      ?.restartAsV32Attempt2WithoutContentRowEffectsForbidden !==
      true ||
    status.input?.liveV32?.humanSignoff !== "pending" ||
    status.input?.liveV32?.overallInputSuccess !== false ||
    status.input?.liveV33?.status !== V33_STATUS ||
    status.input?.liveV33?.baseCommit !== V33_BASE_COMMIT ||
    status.input?.liveV33?.protocolSha256 !== V33_PROTOCOL_SHA256 ||
    status.input?.liveV33?.proofPlanSha256 !== V33_PLAN_SHA256 ||
    status.input?.liveV33?.captureManifestSha256 !==
      V33_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV33?.requestManifestSha256 !==
      V33_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV33?.antecedentIndexSha256 !== V33_INDEX_SHA256 ||
    status.input?.liveV33?.antecedentHashSetSha256 !== V33_HASH_SET_SHA256 ||
    status.input?.liveV33?.authorizationTemplateSha256 !==
      V33_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV33?.antecedentCommit !== V33_ANTECEDENT_COMMIT ||
    status.input?.liveV33?.authorizationPresent !== true ||
    status.input?.liveV33?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV33?.authorizationEffective !== false ||
    status.input?.liveV33?.authorizationPath !== V33_AUTHORIZATION_PATH ||
    status.input?.liveV33?.authorizationSha256 !== V33_AUTHORIZATION_SHA256 ||
    status.input?.liveV33?.signingPublicKeySpkiSha256 !==
      V33_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV33?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV33?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV33?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV33?.v32AuthorizationReusable !== false ||
    status.input?.liveV33?.v32AntecedentBytesUnchanged !== true ||
    status.input?.liveV33?.v32SceneReadbackUnchanged !== true ||
    status.input?.liveV33?.taughtContentRowEffectsOmitted !== true ||
    status.input?.liveV33?.taughtContentRowCornerRadiusOmitted !== true ||
    status.input?.liveV33?.taughtContentRowClipsContentOmitted !== true ||
    status.input?.liveV33?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV33?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV33?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV33?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV33?.sceneReadbackCarried !== true ||
    status.input?.liveV33?.carriedV3Verifier !== true ||
    status.input?.liveV33?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV33?.carriedSceneReadback !==
      "recipe/scene-readback-v33.ts" ||
    status.input?.liveV33?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v33.ts" ||
    status.input?.liveV33?.sourceRoots !== 2 ||
    status.input?.liveV33?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV33?.captureCells !== 128 ||
    status.input?.liveV33?.remoteRequests !== 133 ||
    status.input?.liveV33?.hostPhases !== 3 ||
    status.input?.liveV33?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV33?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV33?.attemptsExecuted !== 1 ||
    status.input?.liveV33?.nextAttempt !== 2 ||
    status.input?.liveV33?.liveExecutionOccurred !== true ||
    status.input?.liveV33?.figmaWrites !== 4 ||
    status.input?.liveV33?.figmaCaptures !== 0 ||
    status.input?.liveV33?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV33?.attempt1Path !== V33_ATTEMPT_1_PATH ||
    status.input?.liveV33?.attempt1Sha256 !== V33_ATTEMPT_1_SHA256 ||
    status.input?.liveV33
      ?.restartAsV33Attempt2WithoutContentRowStrokesForbidden !==
      true ||
    status.input?.liveV33?.humanSignoff !== "pending" ||
    status.input?.liveV33?.overallInputSuccess !== false ||
    status.input?.liveV34?.status !== V34_STATUS ||
    status.input?.liveV34?.baseCommit !== V34_BASE_COMMIT ||
    status.input?.liveV34?.protocolSha256 !== V34_PROTOCOL_SHA256 ||
    status.input?.liveV34?.proofPlanSha256 !== V34_PLAN_SHA256 ||
    status.input?.liveV34?.captureManifestSha256 !==
      V34_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV34?.requestManifestSha256 !==
      V34_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV34?.antecedentIndexSha256 !== V34_INDEX_SHA256 ||
    status.input?.liveV34?.antecedentHashSetSha256 !== V34_HASH_SET_SHA256 ||
    status.input?.liveV34?.authorizationTemplateSha256 !==
      V34_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV34?.antecedentCommit !== V34_ANTECEDENT_COMMIT ||
    status.input?.liveV34?.authorizationPresent !== true ||
    status.input?.liveV34?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV34?.authorizationEffective !== false ||
    status.input?.liveV34?.authorizationPath !== V34_AUTHORIZATION_PATH ||
    status.input?.liveV34?.authorizationSha256 !== V34_AUTHORIZATION_SHA256 ||
    status.input?.liveV34?.signingPublicKeySpkiSha256 !==
      V34_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV34?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV34?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV34?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV34?.v33AuthorizationReusable !== false ||
    status.input?.liveV34?.v33AntecedentBytesUnchanged !== true ||
    status.input?.liveV34?.v33SceneReadbackUnchanged !== true ||
    status.input?.liveV34?.taughtContentRowStrokesOmitted !== true ||
    status.input?.liveV34?.taughtContentRowEffectsOmitted !== true ||
    status.input?.liveV34?.taughtContentRowCornerRadiusOmitted !== true ||
    status.input?.liveV34?.taughtContentRowClipsContentOmitted !== true ||
    status.input?.liveV34?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV34?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV34?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV34?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV34?.sceneReadbackCarried !== true ||
    status.input?.liveV34?.carriedV3Verifier !== true ||
    status.input?.liveV34?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV34?.carriedSceneReadback !==
      "recipe/scene-readback-v34.ts" ||
    status.input?.liveV34?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v34.ts" ||
    status.input?.liveV34?.sourceRoots !== 2 ||
    status.input?.liveV34?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV34?.captureCells !== 128 ||
    status.input?.liveV34?.remoteRequests !== 133 ||
    status.input?.liveV34?.hostPhases !== 3 ||
    status.input?.liveV34?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV34?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV34?.attemptsExecuted !== 1 ||
    status.input?.liveV34?.nextAttempt !== 2 ||
    status.input?.liveV34?.liveExecutionOccurred !== true ||
    status.input?.liveV34?.figmaWrites !== 4 ||
    status.input?.liveV34?.figmaCaptures !== 0 ||
    status.input?.liveV34?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV34?.attempt1Path !== V34_ATTEMPT_1_PATH ||
    status.input?.liveV34?.attempt1Sha256 !== V34_ATTEMPT_1_SHA256 ||
    status.input?.liveV34
      ?.restartAsV34Attempt2WithoutLabelBindingFieldForbidden !==
      true ||
    status.input?.liveV34?.humanSignoff !== "pending" ||
    status.input?.liveV34?.overallInputSuccess !== false ||
    status.input?.liveV35?.status !== V35_STATUS ||
    status.input?.liveV35?.baseCommit !== V35_BASE_COMMIT ||
    status.input?.liveV35?.protocolSha256 !== V35_PROTOCOL_SHA256 ||
    status.input?.liveV35?.proofPlanSha256 !== V35_PLAN_SHA256 ||
    status.input?.liveV35?.captureManifestSha256 !==
      V35_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV35?.requestManifestSha256 !==
      V35_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV35?.antecedentIndexSha256 !== V35_INDEX_SHA256 ||
    status.input?.liveV35?.antecedentHashSetSha256 !== V35_HASH_SET_SHA256 ||
    status.input?.liveV35?.authorizationTemplateSha256 !==
      V35_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV35?.antecedentCommit !== V35_ANTECEDENT_COMMIT ||
    status.input?.liveV35?.authorizationPresent !== true ||
    status.input?.liveV35?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV35?.authorizationEffective !== false ||
    status.input?.liveV35?.authorizationPath !== V35_AUTHORIZATION_PATH ||
    status.input?.liveV35?.authorizationSha256 !== V35_AUTHORIZATION_SHA256 ||
    status.input?.liveV35?.signingPublicKeySpkiSha256 !==
      V35_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV35?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV35?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV35?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV35?.v34AuthorizationReusable !== false ||
    status.input?.liveV35?.v34AntecedentBytesUnchanged !== true ||
    status.input?.liveV35?.v34SceneReadbackUnchanged !== true ||
    status.input?.liveV35?.taughtLabelBindingExtrasDropped !== true ||
    status.input?.liveV35?.taughtLabelBindingCompileOrder !== true ||
    status.input?.liveV35?.taughtContentRowStrokesOmitted !== true ||
    status.input?.liveV35?.taughtContentRowEffectsOmitted !== true ||
    status.input?.liveV35?.taughtContentRowCornerRadiusOmitted !== true ||
    status.input?.liveV35?.taughtContentRowClipsContentOmitted !== true ||
    status.input?.liveV35?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV35?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV35?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV35?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV35?.sceneReadbackCarried !== true ||
    status.input?.liveV35?.carriedV3Verifier !== true ||
    status.input?.liveV35?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV35?.carriedSceneReadback !==
      "recipe/scene-readback-v35.ts" ||
    status.input?.liveV35?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v35.ts" ||
    status.input?.liveV35?.sourceRoots !== 2 ||
    status.input?.liveV35?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV35?.captureCells !== 128 ||
    status.input?.liveV35?.remoteRequests !== 133 ||
    status.input?.liveV35?.hostPhases !== 3 ||
    status.input?.liveV35?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV35?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV35?.attemptsExecuted !== 1 ||
    status.input?.liveV35?.nextAttempt !== 2 ||
    status.input?.liveV35?.liveExecutionOccurred !== true ||
    status.input?.liveV35?.figmaWrites !== 4 ||
    status.input?.liveV35?.figmaCaptures !== 0 ||
    status.input?.liveV35?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV35?.attempt1Path !== V35_ATTEMPT_1_PATH ||
    status.input?.liveV35?.attempt1Sha256 !== V35_ATTEMPT_1_SHA256 ||
    status.input?.liveV35
      ?.restartAsV35Attempt2WithoutLabelLetterSpacingForbidden !==
      true ||
    status.input?.liveV35?.humanSignoff !== "pending" ||
    status.input?.liveV35?.overallInputSuccess !== false ||
    status.input?.liveV36?.status !== V36_STATUS ||
    status.input?.liveV36?.baseCommit !== V36_BASE_COMMIT ||
    status.input?.liveV36?.protocolSha256 !== V36_PROTOCOL_SHA256 ||
    status.input?.liveV36?.proofPlanSha256 !== V36_PLAN_SHA256 ||
    status.input?.liveV36?.captureManifestSha256 !==
      V36_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV36?.requestManifestSha256 !==
      V36_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV36?.antecedentIndexSha256 !== V36_INDEX_SHA256 ||
    status.input?.liveV36?.antecedentHashSetSha256 !== V36_HASH_SET_SHA256 ||
    status.input?.liveV36?.authorizationTemplateSha256 !==
      V36_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV36?.antecedentCommit !== V36_ANTECEDENT_COMMIT ||
    status.input?.liveV36?.authorizationPresent !== true ||
    status.input?.liveV36?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV36?.authorizationEffective !== false ||
    status.input?.liveV36?.authorizationPath !== V36_AUTHORIZATION_PATH ||
    status.input?.liveV36?.authorizationSha256 !== V36_AUTHORIZATION_SHA256 ||
    status.input?.liveV36?.signingPublicKeySpkiSha256 !==
      V36_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV36?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV36?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV36?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV36?.v35AuthorizationReusable !== false ||
    status.input?.liveV36?.v35AntecedentBytesUnchanged !== true ||
    status.input?.liveV36?.v35SceneReadbackUnchanged !== true ||
    status.input?.liveV36?.taughtLabelLetterSpacingOmitted !== true ||
    status.input?.liveV36?.taughtLabelBindingExtrasDropped !== true ||
    status.input?.liveV36?.taughtLabelBindingCompileOrder !== true ||
    status.input?.liveV36?.taughtContentRowStrokesOmitted !== true ||
    status.input?.liveV36?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV36?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV36?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV36?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV36?.sceneReadbackCarried !== true ||
    status.input?.liveV36?.carriedV3Verifier !== true ||
    status.input?.liveV36?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV36?.carriedSceneReadback !==
      "recipe/scene-readback-v36.ts" ||
    status.input?.liveV36?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v36.ts" ||
    status.input?.liveV36?.sourceRoots !== 2 ||
    status.input?.liveV36?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV36?.captureCells !== 128 ||
    status.input?.liveV36?.remoteRequests !== 133 ||
    status.input?.liveV36?.hostPhases !== 3 ||
    status.input?.liveV36?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV36?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV36?.attemptsExecuted !== 1 ||
    status.input?.liveV36?.nextAttempt !== 2 ||
    status.input?.liveV36?.liveExecutionOccurred !== true ||
    status.input?.liveV36?.figmaWrites !== 4 ||
    status.input?.liveV36?.figmaCaptures !== 0 ||
    status.input?.liveV36?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV36?.attempt1Path !== V36_ATTEMPT_1_PATH ||
    status.input?.liveV36?.attempt1Sha256 !== V36_ATTEMPT_1_SHA256 ||
    status.input?.liveV36
      ?.restartAsV36Attempt2WithoutLabelTextCaseForbidden !==
      true ||
    status.input?.liveV36?.humanSignoff !== "pending" ||
    status.input?.liveV36?.overallInputSuccess !== false ||
    status.input?.liveV37?.status !== V37_STATUS ||
    status.input?.liveV37?.baseCommit !== V37_BASE_COMMIT ||
    status.input?.liveV37?.protocolSha256 !== V37_PROTOCOL_SHA256 ||
    status.input?.liveV37?.proofPlanSha256 !== V37_PLAN_SHA256 ||
    status.input?.liveV37?.captureManifestSha256 !==
      V37_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV37?.requestManifestSha256 !==
      V37_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV37?.antecedentIndexSha256 !== V37_INDEX_SHA256 ||
    status.input?.liveV37?.antecedentHashSetSha256 !== V37_HASH_SET_SHA256 ||
    status.input?.liveV37?.authorizationTemplateSha256 !==
      V37_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV37?.antecedentCommit !== V37_ANTECEDENT_COMMIT ||
    status.input?.liveV37?.authorizationPresent !== true ||
    status.input?.liveV37?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV37?.authorizationEffective !== false ||
    status.input?.liveV37?.authorizationPath !== V37_AUTHORIZATION_PATH ||
    status.input?.liveV37?.authorizationSha256 !== V37_AUTHORIZATION_SHA256 ||
    status.input?.liveV37?.signingPublicKeySpkiSha256 !==
      V37_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV37?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV37?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV37?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV37?.v36AuthorizationReusable !== false ||
    status.input?.liveV37?.v36AntecedentBytesUnchanged !== true ||
    status.input?.liveV37?.v36SceneReadbackUnchanged !== true ||
    status.input?.liveV37?.taughtLabelTextCaseOmitted !== true ||
    status.input?.liveV37?.taughtLabelLetterSpacingOmitted !== true ||
    status.input?.liveV37?.taughtLabelBindingExtrasDropped !== true ||
    status.input?.liveV37?.taughtLabelBindingCompileOrder !== true ||
    status.input?.liveV37?.taughtContentRowStrokesOmitted !== true ||
    status.input?.liveV37?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV37?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV37?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV37?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV37?.sceneReadbackCarried !== true ||
    status.input?.liveV37?.carriedV3Verifier !== true ||
    status.input?.liveV37?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV37?.carriedSceneReadback !==
      "recipe/scene-readback-v37.ts" ||
    status.input?.liveV37?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v37.ts" ||
    status.input?.liveV37?.sourceRoots !== 2 ||
    status.input?.liveV37?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV37?.captureCells !== 128 ||
    status.input?.liveV37?.remoteRequests !== 133 ||
    status.input?.liveV37?.hostPhases !== 3 ||
    status.input?.liveV37?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV37?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV37?.attemptsExecuted !== 1 ||
    status.input?.liveV37?.nextAttempt !== 2 ||
    status.input?.liveV37?.liveExecutionOccurred !== true ||
    status.input?.liveV37?.figmaWrites !== 4 ||
    status.input?.liveV37?.figmaCaptures !== 0 ||
    status.input?.liveV37?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV37?.attempt1Path !== V37_ATTEMPT_1_PATH ||
    status.input?.liveV37?.attempt1Sha256 !== V37_ATTEMPT_1_SHA256 ||
    status.input?.liveV37
      ?.restartAsV37Attempt2WithoutLabelTextDecorationForbidden !==
      true ||
    status.input?.liveV37?.humanSignoff !== "pending" ||
    status.input?.liveV37?.overallInputSuccess !== false ||
    status.input?.liveV38?.status !== V38_STATUS ||
    status.input?.liveV38?.baseCommit !== V38_BASE_COMMIT ||
    status.input?.liveV38?.protocolSha256 !== V38_PROTOCOL_SHA256 ||
    status.input?.liveV38?.proofPlanSha256 !== V38_PLAN_SHA256 ||
    status.input?.liveV38?.captureManifestSha256 !==
      V38_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV38?.requestManifestSha256 !==
      V38_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV38?.antecedentIndexSha256 !== V38_INDEX_SHA256 ||
    status.input?.liveV38?.antecedentHashSetSha256 !== V38_HASH_SET_SHA256 ||
    status.input?.liveV38?.authorizationTemplateSha256 !==
      V38_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV38?.antecedentCommit !== V38_ANTECEDENT_COMMIT ||
    status.input?.liveV38?.authorizationPresent !== true ||
    status.input?.liveV38?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV38?.authorizationEffective !== false ||
    status.input?.liveV38?.authorizationPath !== V38_AUTHORIZATION_PATH ||
    status.input?.liveV38?.authorizationSha256 !== V38_AUTHORIZATION_SHA256 ||
    status.input?.liveV38?.signingPublicKeySpkiSha256 !==
      V38_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV38?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV38?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV38?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV38?.v37AuthorizationReusable !== false ||
    status.input?.liveV38?.v37AntecedentBytesUnchanged !== true ||
    status.input?.liveV38?.v37SceneReadbackUnchanged !== true ||
    status.input?.liveV38?.taughtLabelTextDecorationOmitted !== true ||
    status.input?.liveV38?.taughtLabelTextCaseOmitted !== true ||
    status.input?.liveV38?.taughtLabelLetterSpacingOmitted !== true ||
    status.input?.liveV38?.taughtLabelBindingExtrasDropped !== true ||
    status.input?.liveV38?.taughtLabelBindingCompileOrder !== true ||
    status.input?.liveV38?.taughtContentRowStrokesOmitted !== true ||
    status.input?.liveV38?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV38?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV38?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV38?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV38?.sceneReadbackCarried !== true ||
    status.input?.liveV38?.carriedV3Verifier !== true ||
    status.input?.liveV38?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV38?.carriedSceneReadback !==
      "recipe/scene-readback-v38.ts" ||
    status.input?.liveV38?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v38.ts" ||
    status.input?.liveV38?.sourceRoots !== 2 ||
    status.input?.liveV38?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV38?.captureCells !== 128 ||
    status.input?.liveV38?.remoteRequests !== 133 ||
    status.input?.liveV38?.hostPhases !== 3 ||
    status.input?.liveV38?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV38?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV38?.attemptsExecuted !== 1 ||
    status.input?.liveV38?.nextAttempt !== 2 ||
    status.input?.liveV38?.liveExecutionOccurred !== true ||
    status.input?.liveV38?.figmaWrites !== 4 ||
    status.input?.liveV38?.figmaCaptures !== 0 ||
    status.input?.liveV38?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV38?.attempt1Path !== V38_ATTEMPT_1_PATH ||
    status.input?.liveV38?.attempt1Sha256 !== V38_ATTEMPT_1_SHA256 ||
    status.input?.liveV38
      ?.restartAsV38Attempt2WithoutLabelRowClipsContentForbidden !==
      true ||
    status.input?.liveV38?.humanSignoff !== "pending" ||
    status.input?.liveV38?.overallInputSuccess !== false ||
    status.input?.liveV39?.status !== V39_STATUS ||
    status.input?.liveV39?.baseCommit !== V39_BASE_COMMIT ||
    status.input?.liveV39?.protocolSha256 !== V39_PROTOCOL_SHA256 ||
    status.input?.liveV39?.proofPlanSha256 !== V39_PLAN_SHA256 ||
    status.input?.liveV39?.captureManifestSha256 !==
      V39_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV39?.requestManifestSha256 !==
      V39_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV39?.antecedentIndexSha256 !== V39_INDEX_SHA256 ||
    status.input?.liveV39?.antecedentHashSetSha256 !== V39_HASH_SET_SHA256 ||
    status.input?.liveV39?.authorizationTemplateSha256 !==
      V39_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV39?.antecedentCommit !== V39_ANTECEDENT_COMMIT ||
    status.input?.liveV39?.authorizationPresent !== true ||
    status.input?.liveV39?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV39?.authorizationEffective !== false ||
    status.input?.liveV39?.authorizationPath !== V39_AUTHORIZATION_PATH ||
    status.input?.liveV39?.authorizationSha256 !== V39_AUTHORIZATION_SHA256 ||
    status.input?.liveV39?.signingPublicKeySpkiSha256 !==
      V39_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV39?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV39?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV39?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV39?.v38AuthorizationReusable !== false ||
    status.input?.liveV39?.v38AntecedentBytesUnchanged !== true ||
    status.input?.liveV39?.v38SceneReadbackUnchanged !== true ||
    status.input?.liveV39?.taughtLabelRowClipsContentOmitted !== true ||
    status.input?.liveV39?.taughtLabelTextDecorationOmitted !== true ||
    status.input?.liveV39?.taughtLabelTextCaseOmitted !== true ||
    status.input?.liveV39?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV39?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV39?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV39?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV39?.sceneReadbackCarried !== true ||
    status.input?.liveV39?.carriedV3Verifier !== true ||
    status.input?.liveV39?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV39?.carriedSceneReadback !==
      "recipe/scene-readback-v39.ts" ||
    status.input?.liveV39?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v39.ts" ||
    status.input?.liveV39?.sourceRoots !== 2 ||
    status.input?.liveV39?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV39?.captureCells !== 128 ||
    status.input?.liveV39?.remoteRequests !== 133 ||
    status.input?.liveV39?.hostPhases !== 3 ||
    status.input?.liveV39?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV39?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV39?.attemptsExecuted !== 1 ||
    status.input?.liveV39?.nextAttempt !== 2 ||
    status.input?.liveV39?.liveExecutionOccurred !== true ||
    status.input?.liveV39?.figmaWrites !== 4 ||
    status.input?.liveV39?.figmaCaptures !== 0 ||
    status.input?.liveV39?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV39?.attempt1Path !== V39_ATTEMPT_1_PATH ||
    status.input?.liveV39?.attempt1Sha256 !== V39_ATTEMPT_1_SHA256 ||
    status.input?.liveV39
      ?.restartAsV39Attempt2WithoutLabelRowCornerRadiusForbidden !==
      true ||
    status.input?.liveV39?.humanSignoff !== "pending" ||
    status.input?.liveV39?.overallInputSuccess !== false ||
    status.input?.liveV40?.status !== V40_STATUS ||
    status.input?.liveV40?.baseCommit !== V40_BASE_COMMIT ||
    status.input?.liveV40?.protocolSha256 !== V40_PROTOCOL_SHA256 ||
    status.input?.liveV40?.proofPlanSha256 !== V40_PLAN_SHA256 ||
    status.input?.liveV40?.captureManifestSha256 !==
      V40_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV40?.requestManifestSha256 !==
      V40_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV40?.antecedentIndexSha256 !== V40_INDEX_SHA256 ||
    status.input?.liveV40?.antecedentHashSetSha256 !== V40_HASH_SET_SHA256 ||
    status.input?.liveV40?.authorizationTemplateSha256 !==
      V40_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV40?.antecedentCommit !== V40_ANTECEDENT_COMMIT ||
    status.input?.liveV40?.authorizationPresent !== true ||
    status.input?.liveV40?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV40?.authorizationEffective !== false ||
    status.input?.liveV40?.authorizationPath !== V40_AUTHORIZATION_PATH ||
    status.input?.liveV40?.authorizationSha256 !== V40_AUTHORIZATION_SHA256 ||
    status.input?.liveV40?.signingPublicKeySpkiSha256 !==
      V40_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV40?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV40?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV40?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV40?.v39AuthorizationReusable !== false ||
    status.input?.liveV40?.v39AntecedentBytesUnchanged !== true ||
    status.input?.liveV40?.v39SceneReadbackUnchanged !== true ||
    status.input?.liveV40?.taughtLabelRowCornerRadiusOmitted !== true ||
    status.input?.liveV40?.taughtLabelRowClipsContentOmitted !== true ||
    status.input?.liveV40?.taughtLabelTextDecorationOmitted !== true ||
    status.input?.liveV40?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV40?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV40?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV40?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV40?.sceneReadbackCarried !== true ||
    status.input?.liveV40?.carriedV3Verifier !== true ||
    status.input?.liveV40?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV40?.carriedSceneReadback !==
      "recipe/scene-readback-v40.ts" ||
    status.input?.liveV40?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v40.ts" ||
    status.input?.liveV40?.sourceRoots !== 2 ||
    status.input?.liveV40?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV40?.captureCells !== 128 ||
    status.input?.liveV40?.remoteRequests !== 133 ||
    status.input?.liveV40?.hostPhases !== 3 ||
    status.input?.liveV40?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV40?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV40?.attemptsExecuted !== 1 ||
    status.input?.liveV40?.nextAttempt !== 2 ||
    status.input?.liveV40?.liveExecutionOccurred !== true ||
    status.input?.liveV40?.figmaWrites !== 4 ||
    status.input?.liveV40?.figmaCaptures !== 0 ||
    status.input?.liveV40?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV40?.attempt1Path !== V40_ATTEMPT_1_PATH ||
    status.input?.liveV40?.attempt1Sha256 !== V40_ATTEMPT_1_SHA256 ||
    status.input?.liveV40
      ?.restartAsV40Attempt2WithoutLabelRowEffectsForbidden !==
      true ||
    status.input?.liveV40?.humanSignoff !== "pending" ||
    status.input?.liveV40?.overallInputSuccess !== false ||
    status.input?.liveV41?.status !== V41_STATUS ||
    status.input?.liveV41?.baseCommit !== V41_BASE_COMMIT ||
    status.input?.liveV41?.protocolSha256 !== V41_PROTOCOL_SHA256 ||
    status.input?.liveV41?.proofPlanSha256 !== V41_PLAN_SHA256 ||
    status.input?.liveV41?.captureManifestSha256 !==
      V41_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV41?.requestManifestSha256 !==
      V41_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV41?.antecedentIndexSha256 !== V41_INDEX_SHA256 ||
    status.input?.liveV41?.antecedentHashSetSha256 !== V41_HASH_SET_SHA256 ||
    status.input?.liveV41?.authorizationTemplateSha256 !==
      V41_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV41?.antecedentCommit !== V41_ANTECEDENT_COMMIT ||
    status.input?.liveV41?.authorizationPresent !== true ||
    status.input?.liveV41?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV41?.authorizationEffective !== false ||
    status.input?.liveV41?.authorizationPath !== V41_AUTHORIZATION_PATH ||
    status.input?.liveV41?.authorizationSha256 !== V41_AUTHORIZATION_SHA256 ||
    status.input?.liveV41?.signingPublicKeySpkiSha256 !==
      V41_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV41?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV41?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV41?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV41?.v40AuthorizationReusable !== false ||
    status.input?.liveV41?.v40AntecedentBytesUnchanged !== true ||
    status.input?.liveV41?.v40SceneReadbackUnchanged !== true ||
    status.input?.liveV41?.taughtLabelRowEffectsOmitted !== true ||
    status.input?.liveV41?.taughtLabelRowCornerRadiusOmitted !== true ||
    status.input?.liveV41?.taughtLabelRowClipsContentOmitted !== true ||
    status.input?.liveV41?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV41?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV41?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV41?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV41?.sceneReadbackCarried !== true ||
    status.input?.liveV41?.carriedV3Verifier !== true ||
    status.input?.liveV41?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV41?.carriedSceneReadback !==
      "recipe/scene-readback-v41.ts" ||
    status.input?.liveV41?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v41.ts" ||
    status.input?.liveV41?.sourceRoots !== 2 ||
    status.input?.liveV41?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV41?.captureCells !== 128 ||
    status.input?.liveV41?.remoteRequests !== 133 ||
    status.input?.liveV41?.hostPhases !== 3 ||
    status.input?.liveV41?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV41?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV41?.attemptsExecuted !== 1 ||
    status.input?.liveV41?.nextAttempt !== 2 ||
    status.input?.liveV41?.liveExecutionOccurred !== true ||
    status.input?.liveV41?.figmaWrites !== 4 ||
    status.input?.liveV41?.figmaCaptures !== 0 ||
    status.input?.liveV41?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV41?.attempt1Path !== V41_ATTEMPT_1_PATH ||
    status.input?.liveV41?.attempt1Sha256 !== V41_ATTEMPT_1_SHA256 ||
    status.input?.liveV41
      ?.restartAsV41Attempt2WithoutLabelRowStrokesForbidden !==
      true ||
    status.input?.liveV41?.humanSignoff !== "pending" ||
    status.input?.liveV41?.overallInputSuccess !== false ||
    status.input?.liveV42?.status !== V42_STATUS ||
    status.input?.liveV42?.baseCommit !== V42_BASE_COMMIT ||
    status.input?.liveV42?.protocolSha256 !== V42_PROTOCOL_SHA256 ||
    status.input?.liveV42?.proofPlanSha256 !== V42_PLAN_SHA256 ||
    status.input?.liveV42?.captureManifestSha256 !==
      V42_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV42?.requestManifestSha256 !==
      V42_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV42?.antecedentIndexSha256 !== V42_INDEX_SHA256 ||
    status.input?.liveV42?.antecedentHashSetSha256 !== V42_HASH_SET_SHA256 ||
    status.input?.liveV42?.authorizationTemplateSha256 !==
      V42_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV42?.antecedentCommit !== V42_ANTECEDENT_COMMIT ||
    status.input?.liveV42?.authorizationPresent !== true ||
    status.input?.liveV42?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV42?.authorizationEffective !== false ||
    status.input?.liveV42?.authorizationPath !== V42_AUTHORIZATION_PATH ||
    status.input?.liveV42?.authorizationSha256 !== V42_AUTHORIZATION_SHA256 ||
    status.input?.liveV42?.signingPublicKeySpkiSha256 !==
      V42_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV42?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV42?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV42?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV42?.v41AuthorizationReusable !== false ||
    status.input?.liveV42?.v41AntecedentBytesUnchanged !== true ||
    status.input?.liveV42?.v41SceneReadbackUnchanged !== true ||
    status.input?.liveV42?.v40SceneReadbackUnchanged !== true ||
    status.input?.liveV42?.taughtLabelRowStrokesOmitted !== true ||
    status.input?.liveV42?.taughtLabelRowEffectsOmitted !== true ||
    status.input?.liveV42?.taughtLabelRowCornerRadiusOmitted !== true ||
    status.input?.liveV42?.taughtLabelRowClipsContentOmitted !== true ||
    status.input?.liveV42?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV42?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV42?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV42?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV42?.sceneReadbackCarried !== true ||
    status.input?.liveV42?.carriedV3Verifier !== true ||
    status.input?.liveV42?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV42?.carriedSceneReadback !==
      "recipe/scene-readback-v42.ts" ||
    status.input?.liveV42?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v42.ts" ||
    status.input?.liveV42?.sourceRoots !== 2 ||
    status.input?.liveV42?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV42?.captureCells !== 128 ||
    status.input?.liveV42?.remoteRequests !== 133 ||
    status.input?.liveV42?.hostPhases !== 3 ||
    status.input?.liveV42?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV42?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV42?.attemptsExecuted !== 1 ||
    status.input?.liveV42?.nextAttempt !== 2 ||
    status.input?.liveV42?.liveExecutionOccurred !== true ||
    status.input?.liveV42?.figmaWrites !== 4 ||
    status.input?.liveV42?.figmaCaptures !== 0 ||
    status.input?.liveV42?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV42?.attempt1Path !== V42_ATTEMPT_1_PATH ||
    status.input?.liveV42?.attempt1Sha256 !== V42_ATTEMPT_1_SHA256 ||
    status.input?.liveV42
      ?.restartAsV42Attempt2WithoutSurfaceStrokeDashPatternForbidden !==
      true ||
    status.input?.liveV42?.humanSignoff !== "pending" ||
    status.input?.liveV42?.overallInputSuccess !== false ||
    status.input?.liveV43?.status !== V43_STATUS ||
    status.input?.liveV43?.baseCommit !== V43_BASE_COMMIT ||
    status.input?.liveV43?.protocolSha256 !== V43_PROTOCOL_SHA256 ||
    status.input?.liveV43?.proofPlanSha256 !== V43_PLAN_SHA256 ||
    status.input?.liveV43?.captureManifestSha256 !==
      V43_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV43?.requestManifestSha256 !==
      V43_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV43?.antecedentIndexSha256 !== V43_INDEX_SHA256 ||
    status.input?.liveV43?.antecedentHashSetSha256 !== V43_HASH_SET_SHA256 ||
    status.input?.liveV43?.authorizationTemplateSha256 !==
      V43_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV43?.antecedentCommit !== V43_ANTECEDENT_COMMIT ||
    status.input?.liveV43?.authorizationPresent !== true ||
    status.input?.liveV43?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV43?.authorizationEffective !== false ||
    status.input?.liveV43?.authorizationPath !== V43_AUTHORIZATION_PATH ||
    status.input?.liveV43?.authorizationSha256 !== V43_AUTHORIZATION_SHA256 ||
    status.input?.liveV43?.signingPublicKeySpkiSha256 !==
      V43_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV43?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV43?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV43?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV43?.v42AuthorizationReusable !== false ||
    status.input?.liveV43?.v42AntecedentBytesUnchanged !== true ||
    status.input?.liveV43?.v42SceneReadbackUnchanged !== true ||
    status.input?.liveV43?.v41SceneReadbackUnchanged !== true ||
    status.input?.liveV43?.taughtSurfaceStrokeDashPatternOmitted !== true ||
    status.input?.liveV43?.taughtLabelRowStrokesOmitted !== true ||
    status.input?.liveV43?.taughtLabelRowEffectsOmitted !== true ||
    status.input?.liveV43?.taughtLabelRowCornerRadiusOmitted !== true ||
    status.input?.liveV43?.taughtLabelRowClipsContentOmitted !== true ||
    status.input?.liveV43?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV43?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV43?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV43?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV43?.sceneReadbackCarried !== true ||
    status.input?.liveV43?.carriedV3Verifier !== true ||
    status.input?.liveV43?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV43?.carriedSceneReadback !==
      "recipe/scene-readback-v43.ts" ||
    status.input?.liveV43?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v43.ts" ||
    status.input?.liveV43?.sourceRoots !== 2 ||
    status.input?.liveV43?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV43?.captureCells !== 128 ||
    status.input?.liveV43?.remoteRequests !== 133 ||
    status.input?.liveV43?.hostPhases !== 3 ||
    status.input?.liveV43?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV43?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV43?.attemptsExecuted !== 1 ||
    status.input?.liveV43?.nextAttempt !== 2 ||
    status.input?.liveV43?.liveExecutionOccurred !== true ||
    status.input?.liveV43?.figmaWrites !== 4 ||
    status.input?.liveV43?.figmaCaptures !== 0 ||
    status.input?.liveV43?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV43?.attempt1Path !== V43_ATTEMPT_1_PATH ||
    status.input?.liveV43?.attempt1Sha256 !== V43_ATTEMPT_1_SHA256 ||
    status.input?.liveV43
      ?.restartAsV43Attempt2WithoutMessageHelperBindingOrderForbidden !==
      true ||
    status.input?.liveV43?.humanSignoff !== "pending" ||
    status.input?.liveV43?.overallInputSuccess !== false ||
    status.input?.liveV44?.status !== V44_STATUS ||
    status.input?.liveV44?.baseCommit !== V44_BASE_COMMIT ||
    status.input?.liveV44?.protocolSha256 !== V44_PROTOCOL_SHA256 ||
    status.input?.liveV44?.proofPlanSha256 !== V44_PLAN_SHA256 ||
    status.input?.liveV44?.captureManifestSha256 !==
      V44_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV44?.requestManifestSha256 !==
      V44_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV44?.antecedentIndexSha256 !== V44_INDEX_SHA256 ||
    status.input?.liveV44?.antecedentHashSetSha256 !== V44_HASH_SET_SHA256 ||
    status.input?.liveV44?.authorizationTemplateSha256 !==
      V44_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV44?.antecedentCommit !== V44_ANTECEDENT_COMMIT ||
    status.input?.liveV44?.authorizationPresent !== true ||
    status.input?.liveV44?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV44?.authorizationEffective !== false ||
    status.input?.liveV44?.authorizationPath !== V44_AUTHORIZATION_PATH ||
    status.input?.liveV44?.authorizationSha256 !== V44_AUTHORIZATION_SHA256 ||
    status.input?.liveV44?.signingPublicKeySpkiSha256 !==
      V44_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV44?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV44?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV44?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV44?.v43AuthorizationReusable !== false ||
    status.input?.liveV44?.v43AntecedentBytesUnchanged !== true ||
    status.input?.liveV44?.v43SceneReadbackUnchanged !== true ||
    status.input?.liveV44?.v42SceneReadbackUnchanged !== true ||
    status.input?.liveV44?.taughtMessageBindingCompileOrder !== true ||
    status.input?.liveV44?.taughtSurfaceStrokeDashPatternOmitted !== true ||
    status.input?.liveV44?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV44?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV44?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV44?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV44?.sceneReadbackCarried !== true ||
    status.input?.liveV44?.carriedV3Verifier !== true ||
    status.input?.liveV44?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV44?.carriedSceneReadback !==
      "recipe/scene-readback-v44.ts" ||
    status.input?.liveV44?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v44.ts" ||
    status.input?.liveV44?.sourceRoots !== 2 ||
    status.input?.liveV44?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV44?.captureCells !== 128 ||
    status.input?.liveV44?.remoteRequests !== 133 ||
    status.input?.liveV44?.hostPhases !== 3 ||
    status.input?.liveV44?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV44?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV44?.attemptsExecuted !== 1 ||
    status.input?.liveV44?.nextAttempt !== 2 ||
    status.input?.liveV44?.liveExecutionOccurred !== true ||
    status.input?.liveV44?.figmaWrites !== 4 ||
    status.input?.liveV44?.figmaCaptures !== 0 ||
    status.input?.liveV44?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV44?.attempt1Path !== V44_ATTEMPT_1_PATH ||
    status.input?.liveV44?.attempt1Sha256 !== V44_ATTEMPT_1_SHA256 ||
    status.input?.liveV44
      ?.restartAsV44Attempt2WithoutMessageLetterSpacingOmitForbidden !==
      true ||
    status.input?.liveV44?.humanSignoff !== "pending" ||
    status.input?.liveV44?.overallInputSuccess !== false ||
    status.input?.liveV45?.status !== V45_STATUS ||
    status.input?.liveV45?.baseCommit !== V45_BASE_COMMIT ||
    status.input?.liveV45?.protocolSha256 !== V45_PROTOCOL_SHA256 ||
    status.input?.liveV45?.proofPlanSha256 !== V45_PLAN_SHA256 ||
    status.input?.liveV45?.captureManifestSha256 !==
      V45_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV45?.requestManifestSha256 !==
      V45_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV45?.antecedentIndexSha256 !== V45_INDEX_SHA256 ||
    status.input?.liveV45?.antecedentHashSetSha256 !== V45_HASH_SET_SHA256 ||
    status.input?.liveV45?.authorizationTemplateSha256 !==
      V45_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV45?.antecedentCommit !== V45_ANTECEDENT_COMMIT ||
    status.input?.liveV45?.authorizationPresent !== true ||
    status.input?.liveV45?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV45?.authorizationEffective !== false ||
    status.input?.liveV45?.authorizationPath !== V45_AUTHORIZATION_PATH ||
    status.input?.liveV45?.authorizationSha256 !== V45_AUTHORIZATION_SHA256 ||
    status.input?.liveV45?.signingPublicKeySpkiSha256 !==
      V45_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV45?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV45?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV45?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV45?.v44AuthorizationReusable !== false ||
    status.input?.liveV45?.v44AntecedentBytesUnchanged !== true ||
    status.input?.liveV45?.v44SceneReadbackUnchanged !== true ||
    status.input?.liveV45?.v43SceneReadbackUnchanged !== true ||
    status.input?.liveV45?.taughtMessageLetterSpacingOmitted !== true ||
    status.input?.liveV45?.taughtMessageBindingCompileOrder !== true ||
    status.input?.liveV45?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV45?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV45?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV45?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV45?.sceneReadbackCarried !== true ||
    status.input?.liveV45?.carriedV3Verifier !== true ||
    status.input?.liveV45?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV45?.carriedSceneReadback !==
      "recipe/scene-readback-v45.ts" ||
    status.input?.liveV45?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v45.ts" ||
    status.input?.liveV45?.sourceRoots !== 2 ||
    status.input?.liveV45?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV45?.captureCells !== 128 ||
    status.input?.liveV45?.remoteRequests !== 133 ||
    status.input?.liveV45?.hostPhases !== 3 ||
    status.input?.liveV45?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV45?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV45?.attemptsExecuted !== 1 ||
    status.input?.liveV45?.nextAttempt !== 2 ||
    status.input?.liveV45?.liveExecutionOccurred !== true ||
    status.input?.liveV45?.figmaWrites !== 4 ||
    status.input?.liveV45?.figmaCaptures !== 0 ||
    status.input?.liveV45?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV45?.attempt1Path !== V45_ATTEMPT_1_PATH ||
    status.input?.liveV45?.attempt1Sha256 !== V45_ATTEMPT_1_SHA256 ||
    status.input?.liveV45
      ?.restartAsV45Attempt2WithoutMessageTextCaseOmitForbidden !== true ||
    status.input?.liveV45?.humanSignoff !== "pending" ||
    status.input?.liveV45?.overallInputSuccess !== false ||
    status.input?.liveV46?.status !== V46_STATUS ||
    status.input?.liveV46?.baseCommit !== V46_BASE_COMMIT ||
    status.input?.liveV46?.protocolSha256 !== V46_PROTOCOL_SHA256 ||
    status.input?.liveV46?.proofPlanSha256 !== V46_PLAN_SHA256 ||
    status.input?.liveV46?.captureManifestSha256 !==
      V46_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV46?.requestManifestSha256 !==
      V46_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV46?.antecedentIndexSha256 !== V46_INDEX_SHA256 ||
    status.input?.liveV46?.antecedentHashSetSha256 !== V46_HASH_SET_SHA256 ||
    status.input?.liveV46?.authorizationTemplateSha256 !==
      V46_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV46?.antecedentCommit !== V46_ANTECEDENT_COMMIT ||
    status.input?.liveV46?.authorizationPresent !== true ||
    status.input?.liveV46?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV46?.authorizationEffective !== false ||
    status.input?.liveV46?.authorizationPath !== V46_AUTHORIZATION_PATH ||
    status.input?.liveV46?.authorizationSha256 !== V46_AUTHORIZATION_SHA256 ||
    status.input?.liveV46?.signingPublicKeySpkiSha256 !==
      V46_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV46?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV46?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV46?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV46?.v45AuthorizationReusable !== false ||
    status.input?.liveV46?.v45AntecedentBytesUnchanged !== true ||
    status.input?.liveV46?.v45SceneReadbackUnchanged !== true ||
    status.input?.liveV46?.v44SceneReadbackUnchanged !== true ||
    status.input?.liveV46?.taughtMessageTextCaseOmitted !== true ||
    status.input?.liveV46?.taughtMessageLetterSpacingOmitted !== true ||
    status.input?.liveV46?.taughtMessageBindingCompileOrder !== true ||
    status.input?.liveV46?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV46?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV46?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV46?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV46?.sceneReadbackCarried !== true ||
    status.input?.liveV46?.carriedV3Verifier !== true ||
    status.input?.liveV46?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV46?.carriedSceneReadback !==
      "recipe/scene-readback-v46.ts" ||
    status.input?.liveV46?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v46.ts" ||
    status.input?.liveV46?.sourceRoots !== 2 ||
    status.input?.liveV46?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV46?.captureCells !== 128 ||
    status.input?.liveV46?.remoteRequests !== 133 ||
    status.input?.liveV46?.hostPhases !== 3 ||
    status.input?.liveV46?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV46?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV46?.attemptsExecuted !== 1 ||
    status.input?.liveV46?.nextAttempt !== 2 ||
    status.input?.liveV46?.liveExecutionOccurred !== true ||
    status.input?.liveV46?.figmaWrites !== 4 ||
    status.input?.liveV46?.figmaCaptures !== 0 ||
    status.input?.liveV46?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV46?.attempt1Path !== V46_ATTEMPT_1_PATH ||
    status.input?.liveV46?.attempt1Sha256 !== V46_ATTEMPT_1_SHA256 ||
    status.input?.liveV46
      ?.restartAsV46Attempt2WithoutMessageTextDecorationOmitForbidden !==
      true ||
    status.input?.liveV46?.humanSignoff !== "pending" ||
    status.input?.liveV46?.overallInputSuccess !== false
  )
    fail("v3 exhausted/v4-v46 current status");
  const unexpected = v3Files.filter(
    (file) =>
      !V3_PREPARED_FILES.includes(file as (typeof V3_PREPARED_FILES)[number]),
  );
  if (unexpected.length > 0)
    fail(`capture forbidden; unexpected v3 artifacts: ${unexpected.join(",")}`);
  return failures;
}

export function validateInputLiveV4PendingStatus(
  index: Record<string, any>,
  authorizationHash: string,
): string[] {
  const failures: string[] = [];
  if (
    index.artifactVersion !== "input-live-v4-index-v1" ||
    index.status !== V4_PENDING_STATUS ||
    index.antecedent?.commit !== INPUT_LIVE_V4_ANTECEDENT_COMMIT ||
    index.antecedent?.protocolPath !==
      "recipe/evidence/input-field-live-pivot-v4/protocol.json" ||
    index.antecedent?.protocolSha256 !== INPUT_LIVE_V4_PROTOCOL_SHA256
  )
    failures.push("v4 pending index identity/antecedent");
  if (
    authorizationHash !== V4_AUTHORIZATION_SHA256 ||
    index.authorization?.path !== INPUT_LIVE_V4_AUTHORIZATION_PATH ||
    index.authorization?.sha256 !== authorizationHash ||
    index.authorization?.firstAddCommit !== null ||
    index.authorization?.committed !== false ||
    index.authorization?.upstreamPublished !== false ||
    index.authorization?.authorized !== false ||
    index.authorization?.discoveredAfterCommit !== true
  )
    failures.push("v4 pending-uncommitted authorization status");
  if (
    index.attempts?.executed !== 0 ||
    index.attempts?.next !== 1 ||
    index.attempts?.maximum !== 3 ||
    index.attempts?.v3AttemptsDoNotCarryForward !== true ||
    index.liveExecutionOccurred !== false ||
    index.captureArtifactsPresent !== false ||
    index.protocolCriteriaAltered !== false ||
    index.humanSignoff !== "pending" ||
    index.overallInputSuccess !== false
  )
    failures.push("v4 pending attempts/results/signoff status");
  return failures;
}

export function verifyPivotStatus(): void {
  const status = readRepositoryJson<Record<string, any>>(PIVOT_STATUS_PATH);
  const protocol = readRepositoryJson<Record<string, any>>(
    INPUT_LIVE_V3_PROTOCOL_PATH,
  );
  const index = readRepositoryJson<Record<string, any>>(
    `${V3_ROOT}/index.json`,
  );
  const v4Index = readRepositoryJson<Record<string, any>>(V4_INDEX_PATH);
  const v5Index = readRepositoryJson<Record<string, any>>(
    `${V5_ROOT}/index.json`,
  );
  const v6Protocol = readRepositoryJson<Record<string, any>>(V6_PROTOCOL_PATH);
  const v6Index = readRepositoryJson<Record<string, any>>(V6_INDEX_PATH);
  const v6Superseding =
    readRepositoryJson<Record<string, any>>(V6_SUPERSEDING_PATH);
  const v7Protocol = readRepositoryJson<Record<string, any>>(
    `${V7_ROOT}/protocol.json`,
  );
  const v7Index = readRepositoryJson<Record<string, any>>(
    `${V7_ROOT}/antecedent-index.json`,
  );
  const v7Status = readRepositoryJson<Record<string, any>>(V7_STATUS_PATH);
  const v7Superseding =
    readRepositoryJson<Record<string, any>>(V7_SUPERSEDING_PATH);
  const v8Protocol = readRepositoryJson<Record<string, any>>(
    `${V8_ROOT}/protocol.json`,
  );
  const v8Index = readRepositoryJson<Record<string, any>>(
    `${V8_ROOT}/antecedent-index.json`,
  );
  const v8Status = readRepositoryJson<Record<string, any>>(V8_STATUS_PATH);
  const v8Authorization = readRepositoryJson<Record<string, any>>(
    V8_AUTHORIZATION_PATH,
  );
  const v9Protocol = readRepositoryJson<Record<string, any>>(
    `${V9_ROOT}/protocol.json`,
  );
  const v9Index = readRepositoryJson<Record<string, any>>(
    `${V9_ROOT}/antecedent-index.json`,
  );
  const v9Status = readRepositoryJson<Record<string, any>>(V9_STATUS_PATH);
  const v9Authorization = readRepositoryJson<Record<string, any>>(
    V9_AUTHORIZATION_PATH,
  );
  const v10Protocol = readRepositoryJson<Record<string, any>>(
    `${V10_ROOT}/protocol.json`,
  );
  const v10Index = readRepositoryJson<Record<string, any>>(
    `${V10_ROOT}/antecedent-index.json`,
  );
  const v10Status = readRepositoryJson<Record<string, any>>(V10_STATUS_PATH);
  const v10Authorization = readRepositoryJson<Record<string, any>>(
    V10_AUTHORIZATION_PATH,
  );
  const v11Protocol = readRepositoryJson<Record<string, any>>(
    `${V11_ROOT}/protocol.json`,
  );
  const v11Index = readRepositoryJson<Record<string, any>>(
    `${V11_ROOT}/antecedent-index.json`,
  );
  const v11Status = readRepositoryJson<Record<string, any>>(V11_STATUS_PATH);
  const v12Protocol = readRepositoryJson<Record<string, any>>(
    `${V12_ROOT}/protocol.json`,
  );
  const v12Index = readRepositoryJson<Record<string, any>>(
    `${V12_ROOT}/antecedent-index.json`,
  );
  const v12Status = readRepositoryJson<Record<string, any>>(V12_STATUS_PATH);
  const v13Protocol = readRepositoryJson<Record<string, any>>(
    `${V13_ROOT}/protocol.json`,
  );
  const v13Index = readRepositoryJson<Record<string, any>>(
    `${V13_ROOT}/antecedent-index.json`,
  );
  const v13Status = readRepositoryJson<Record<string, any>>(V13_STATUS_PATH);
  const v14Protocol = readRepositoryJson<Record<string, any>>(
    `${V14_ROOT}/protocol.json`,
  );
  const v14Index = readRepositoryJson<Record<string, any>>(
    `${V14_ROOT}/antecedent-index.json`,
  );
  const v14Status = readRepositoryJson<Record<string, any>>(V14_STATUS_PATH);
  const v15Protocol = readRepositoryJson<Record<string, any>>(
    `${V15_ROOT}/protocol.json`,
  );
  const v15Index = readRepositoryJson<Record<string, any>>(
    `${V15_ROOT}/antecedent-index.json`,
  );
  const v15Status = readRepositoryJson<Record<string, any>>(V15_STATUS_PATH);
  const v16Protocol = readRepositoryJson<Record<string, any>>(
    `${V16_ROOT}/protocol.json`,
  );
  const v16Index = readRepositoryJson<Record<string, any>>(
    `${V16_ROOT}/antecedent-index.json`,
  );
  const v16Status = readRepositoryJson<Record<string, any>>(V16_STATUS_PATH);
  const v17Protocol = readRepositoryJson<Record<string, any>>(
    `${V17_ROOT}/protocol.json`,
  );
  const v17Index = readRepositoryJson<Record<string, any>>(
    `${V17_ROOT}/antecedent-index.json`,
  );
  const v17Status = readRepositoryJson<Record<string, any>>(V17_STATUS_PATH);
  const v18Protocol = readRepositoryJson<Record<string, any>>(
    `${V18_ROOT}/protocol.json`,
  );
  const v18Index = readRepositoryJson<Record<string, any>>(
    `${V18_ROOT}/antecedent-index.json`,
  );
  const v18Status = readRepositoryJson<Record<string, any>>(V18_STATUS_PATH);
  const v19Protocol = readRepositoryJson<Record<string, any>>(
    `${V19_ROOT}/protocol.json`,
  );
  const v19Index = readRepositoryJson<Record<string, any>>(
    `${V19_ROOT}/antecedent-index.json`,
  );
  const v19Status = readRepositoryJson<Record<string, any>>(V19_STATUS_PATH);
  const v20Protocol = readRepositoryJson<Record<string, any>>(
    `${V20_ROOT}/protocol.json`,
  );
  const v20Index = readRepositoryJson<Record<string, any>>(
    `${V20_ROOT}/antecedent-index.json`,
  );
  const v20Status = readRepositoryJson<Record<string, any>>(V20_STATUS_PATH);
  const v21Protocol = readRepositoryJson<Record<string, any>>(
    `${V21_ROOT}/protocol.json`,
  );
  const v21Index = readRepositoryJson<Record<string, any>>(
    `${V21_ROOT}/antecedent-index.json`,
  );
  const v21Status = readRepositoryJson<Record<string, any>>(V21_STATUS_PATH);
  const v22Protocol = readRepositoryJson<Record<string, any>>(
    `${V22_ROOT}/protocol.json`,
  );
  const v22Index = readRepositoryJson<Record<string, any>>(
    `${V22_ROOT}/antecedent-index.json`,
  );
  const v22Status = readRepositoryJson<Record<string, any>>(V22_STATUS_PATH);
  const v23Protocol = readRepositoryJson<Record<string, any>>(
    `${V23_ROOT}/protocol.json`,
  );
  const v23Index = readRepositoryJson<Record<string, any>>(
    `${V23_ROOT}/antecedent-index.json`,
  );
  const v23Status = readRepositoryJson<Record<string, any>>(V23_STATUS_PATH);
  const v24Protocol = readRepositoryJson<Record<string, any>>(
    `${V24_ROOT}/protocol.json`,
  );
  const v24Index = readRepositoryJson<Record<string, any>>(
    `${V24_ROOT}/antecedent-index.json`,
  );
  const v24Status = readRepositoryJson<Record<string, any>>(V24_STATUS_PATH);
  const v25Protocol = readRepositoryJson<Record<string, any>>(
    `${V25_ROOT}/protocol.json`,
  );
  const v25Index = readRepositoryJson<Record<string, any>>(
    `${V25_ROOT}/antecedent-index.json`,
  );
  const v25Status = readRepositoryJson<Record<string, any>>(V25_STATUS_PATH);
  const v26Protocol = readRepositoryJson<Record<string, any>>(
    `${V26_ROOT}/protocol.json`,
  );
  const v26Index = readRepositoryJson<Record<string, any>>(
    `${V26_ROOT}/antecedent-index.json`,
  );
  const v26Status = readRepositoryJson<Record<string, any>>(V26_STATUS_PATH);
  const v27Protocol = readRepositoryJson<Record<string, any>>(
    `${V27_ROOT}/protocol.json`,
  );
  const v27Index = readRepositoryJson<Record<string, any>>(
    `${V27_ROOT}/antecedent-index.json`,
  );
  const v27Status = readRepositoryJson<Record<string, any>>(V27_STATUS_PATH);
  const v28Protocol = readRepositoryJson<Record<string, any>>(
    `${V28_ROOT}/protocol.json`,
  );
  const v28Index = readRepositoryJson<Record<string, any>>(
    `${V28_ROOT}/antecedent-index.json`,
  );
  const v28Status = readRepositoryJson<Record<string, any>>(V28_STATUS_PATH);
  const v29Protocol = readRepositoryJson<Record<string, any>>(
    `${V29_ROOT}/protocol.json`,
  );
  const v29Index = readRepositoryJson<Record<string, any>>(
    `${V29_ROOT}/antecedent-index.json`,
  );
  const v29Status = readRepositoryJson<Record<string, any>>(V29_STATUS_PATH);
  const v30Protocol = readRepositoryJson<Record<string, any>>(
    `${V30_ROOT}/protocol.json`,
  );
  const v30Index = readRepositoryJson<Record<string, any>>(
    `${V30_ROOT}/antecedent-index.json`,
  );
  const v30Status = readRepositoryJson<Record<string, any>>(V30_STATUS_PATH);
  const v31Protocol = readRepositoryJson<Record<string, any>>(
    `${V31_ROOT}/protocol.json`,
  );
  const v31Index = readRepositoryJson<Record<string, any>>(
    `${V31_ROOT}/antecedent-index.json`,
  );
  const v31Status = readRepositoryJson<Record<string, any>>(V31_STATUS_PATH);
  const v32Protocol = readRepositoryJson<Record<string, any>>(
    `${V32_ROOT}/protocol.json`,
  );
  const v32Index = readRepositoryJson<Record<string, any>>(
    `${V32_ROOT}/antecedent-index.json`,
  );
  const v32Status = readRepositoryJson<Record<string, any>>(V32_STATUS_PATH);
  const v33Protocol = readRepositoryJson<Record<string, any>>(
    `${V33_ROOT}/protocol.json`,
  );
  const v33Index = readRepositoryJson<Record<string, any>>(
    `${V33_ROOT}/antecedent-index.json`,
  );
  const v33Status = readRepositoryJson<Record<string, any>>(V33_STATUS_PATH);
  const v34Protocol = readRepositoryJson<Record<string, any>>(
    `${V34_ROOT}/protocol.json`,
  );
  const v34Index = readRepositoryJson<Record<string, any>>(
    `${V34_ROOT}/antecedent-index.json`,
  );
  const v34Status = readRepositoryJson<Record<string, any>>(V34_STATUS_PATH);
  const v35Protocol = readRepositoryJson<Record<string, any>>(
    `${V35_ROOT}/protocol.json`,
  );
  const v35Index = readRepositoryJson<Record<string, any>>(
    `${V35_ROOT}/antecedent-index.json`,
  );
  const v35Status = readRepositoryJson<Record<string, any>>(V35_STATUS_PATH);
  const v36Protocol = readRepositoryJson<Record<string, any>>(
    `${V36_ROOT}/protocol.json`,
  );
  const v36Index = readRepositoryJson<Record<string, any>>(
    `${V36_ROOT}/antecedent-index.json`,
  );
  const v36Status = readRepositoryJson<Record<string, any>>(V36_STATUS_PATH);
  const v37Protocol = readRepositoryJson<Record<string, any>>(
    `${V37_ROOT}/protocol.json`,
  );
  const v37Index = readRepositoryJson<Record<string, any>>(
    `${V37_ROOT}/antecedent-index.json`,
  );
  const v37Status = readRepositoryJson<Record<string, any>>(V37_STATUS_PATH);
  const v38Protocol = readRepositoryJson<Record<string, any>>(
    `${V38_ROOT}/protocol.json`,
  );
  const v38Index = readRepositoryJson<Record<string, any>>(
    `${V38_ROOT}/antecedent-index.json`,
  );
  const v38Status = readRepositoryJson<Record<string, any>>(V38_STATUS_PATH);
  const v39Protocol = readRepositoryJson<Record<string, any>>(
    `${V39_ROOT}/protocol.json`,
  );
  const v39Index = readRepositoryJson<Record<string, any>>(
    `${V39_ROOT}/antecedent-index.json`,
  );
  const v39Status = readRepositoryJson<Record<string, any>>(V39_STATUS_PATH);
  const v40Protocol = readRepositoryJson<Record<string, any>>(
    `${V40_ROOT}/protocol.json`,
  );
  const v40Index = readRepositoryJson<Record<string, any>>(
    `${V40_ROOT}/antecedent-index.json`,
  );
  const v40Status = readRepositoryJson<Record<string, any>>(V40_STATUS_PATH);
  const v41Protocol = readRepositoryJson<Record<string, any>>(
    `${V41_ROOT}/protocol.json`,
  );
  const v41Index = readRepositoryJson<Record<string, any>>(
    `${V41_ROOT}/antecedent-index.json`,
  );
  const v41Status = readRepositoryJson<Record<string, any>>(V41_STATUS_PATH);
  const v42Protocol = readRepositoryJson<Record<string, any>>(
    `${V42_ROOT}/protocol.json`,
  );
  const v42Index = readRepositoryJson<Record<string, any>>(
    `${V42_ROOT}/antecedent-index.json`,
  );
  const v42Status = readRepositoryJson<Record<string, any>>(V42_STATUS_PATH);
  const v43Protocol = readRepositoryJson<Record<string, any>>(
    `${V43_ROOT}/protocol.json`,
  );
  const v43Index = readRepositoryJson<Record<string, any>>(
    `${V43_ROOT}/antecedent-index.json`,
  );
  const v43Status = readRepositoryJson<Record<string, any>>(V43_STATUS_PATH);
  const v44Protocol = readRepositoryJson<Record<string, any>>(
    `${V44_ROOT}/protocol.json`,
  );
  const v44Index = readRepositoryJson<Record<string, any>>(
    `${V44_ROOT}/antecedent-index.json`,
  );
  const v44Status = readRepositoryJson<Record<string, any>>(V44_STATUS_PATH);
  const v45Protocol = readRepositoryJson<Record<string, any>>(
    `${V45_ROOT}/protocol.json`,
  );
  const v45Index = readRepositoryJson<Record<string, any>>(
    `${V45_ROOT}/antecedent-index.json`,
  );
  const v45Status = readRepositoryJson<Record<string, any>>(V45_STATUS_PATH);
  const v46Protocol = readRepositoryJson<Record<string, any>>(
    `${V46_ROOT}/protocol.json`,
  );
  const v46Index = readRepositoryJson<Record<string, any>>(
    `${V46_ROOT}/antecedent-index.json`,
  );
  const v46Status = readRepositoryJson<Record<string, any>>(V46_STATUS_PATH);
  const v5Superseding =
    readRepositoryJson<Record<string, any>>(V5_SUPERSEDING_PATH);
  const protocolHash = sha256(
    readRepositoryEvidence(INPUT_LIVE_V3_PROTOCOL_PATH),
  );
  const files = readdirSync(resolveRepositoryEvidencePath(V3_ROOT));
  const failures = validatePivotStatus(
    status,
    protocol,
    index,
    files,
    protocolHash,
  );
  failures.push(
    ...validateInputLiveV4PendingStatus(
      v4Index,
      sha256(readRepositoryEvidence(INPUT_LIVE_V4_AUTHORIZATION_PATH)),
    ),
  );
  if (
    sha256(readRepositoryEvidence(V4_FAILURE_PATH)) !== V4_FAILURE_SHA256 ||
    sha256(readRepositoryEvidence(`${V5_ROOT}/protocol.json`)) !==
      V5_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V5_ROOT}/writer-plan.json`)) !==
      V5_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V5_ROOT}/capture-authorization.json`)) !==
      V5_AUTHORIZATION_SHA256
  )
    failures.push("v4 failure or v5 draft evidence hash mismatch");
  if (
    sha256(readRepositoryEvidence(V6_PROTOCOL_PATH)) !== V6_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(V6_BROKER_PATH)) !== V6_BROKER_SHA256 ||
    sha256(readRepositoryEvidence(V6_TEST_PATH)) !== V6_TEST_SHA256 ||
    sha256(readRepositoryEvidence(V6_CONTRACT_PATH)) !== V6_CONTRACT_SHA256 ||
    sha256(readRepositoryEvidence(V6_RUNNER_PATH)) !== V6_RUNNER_SHA256 ||
    sha256(readRepositoryEvidence(V6_INDEX_PATH)) !== V6_INDEX_SHA256 ||
    sha256(readRepositoryEvidence(V6_AUTHORIZATION_PATH)) !==
      V6_AUTHORIZATION_SHA256 ||
    sha256(readRepositoryEvidence(V6_AUTHORIZATION_LAYER_PATH)) !==
      V6_AUTHORIZATION_LAYER_SHA256 ||
    sha256(readRepositoryEvidence(V6_PREFLIGHT_PATH)) !== V6_PREFLIGHT_SHA256 ||
    sha256(readRepositoryEvidence(V6_AUTHORIZATION_TEST_PATH)) !==
      V6_AUTHORIZATION_TEST_SHA256 ||
    sha256(readRepositoryEvidence(V6_SECURITY_ATTESTATION_TEMPLATE_PATH)) !==
      V6_SECURITY_ATTESTATION_TEMPLATE_SHA256 ||
    sha256(readRepositoryEvidence(V5_SUPERSEDING_PATH)) !==
      V5_SUPERSEDING_SHA256 ||
    sha256(readRepositoryEvidence(V6_SUPERSEDING_PATH)) !==
      V6_SUPERSEDING_SHA256 ||
    v6Protocol.artifactVersion !==
      "input-live-v6-external-operator-protocol-draft-v1" ||
    v6Protocol.status !== V6_PROTOCOL_STATUS ||
    v6Protocol.authorization?.authorized !== false ||
    v6Protocol.authorization?.liveExecutionPermitted !== false ||
    v6Protocol.authorization?.maximumAttempts !== 3 ||
    v6Protocol.operatorBoundary?.expectedDynamicTool?.namespace !==
      "user-Figma Console" ||
    v6Protocol.operatorBoundary?.expectedDynamicTool?.tool !==
      "figma_execute" ||
    v6Protocol.authorization?.exactScratchOnly?.fileKey !==
      "byMp6lt0Ij9b2QbkDGFwBh" ||
    v6Protocol.execution?.remoteRequests !== 132 ||
    v6Protocol.execution?.hostPhases !== 3 ||
    v6Protocol.hostNormalizationAndAccounting?.perSource !== true ||
    v6Protocol.captureObjective?.plannedCells !== 128 ||
    v6Protocol.captureObjective?.capturesPerformedByThisAntecedentTask !== 0 ||
    v6Protocol.offlineSimulation?.figmaCalls !== 0 ||
    v6Protocol.outcomes !== null ||
    v6Protocol.overallInputSuccess !== false ||
    v6Index.artifactVersion !== "input-live-v6-evidence-index-v1" ||
    v6Index.counts?.sources !== 2 ||
    v6Index.counts?.expectedSceneFacts !== 43_726 ||
    v6Index.counts?.captureCells !== 128 ||
    v6Index.counts?.remoteRequests !== 132 ||
    v6Index.counts?.hostPhases !== 3 ||
    v6Index.status !==
      "authorization-prepared-uncommitted; security-blocked; live execution forbidden; no live outcomes" ||
    v6Index.authorizationPresent !== true ||
    v6Index.authorizationCommitted !== false ||
    v6Index.authorizationEffective !== false ||
    v6Index.authorizationPath !== V6_AUTHORIZATION_PATH ||
    v6Index.authorizationSha256 !== V6_AUTHORIZATION_SHA256 ||
    v6Index.security?.rotationCompleted !== false ||
    v6Index.security?.mcpRestartCompleted !== false ||
    v6Index.security?.liveExecutionForbidden !== true ||
    v6Index.security?.currentRepositorySecretScanMatches !== 0 ||
    v6Index.security?.tokenValuesStored !== false ||
    v6Index.outcomes !== null ||
    v5Superseding.artifactVersion !== "input-live-v5-superseding-status-v1" ||
    v5Superseding.authorization?.bytesChanged !== false ||
    v5Superseding.authorization?.authorizesAttemptNow !== false ||
    v5Superseding.blockers?.length !== 4 ||
    v5Superseding.attemptsExecuted !== 0 ||
    v5Superseding.outcomes !== null ||
    v6Superseding.artifactVersion !== "input-live-v6-superseding-status-v1" ||
    v6Superseding.retiredBeforeLiveUse !== true ||
    v6Superseding.authorizationHistory?.authorizationCommit !==
      "e5d6814982cbbe498ed630e7d988eae10bcb5d77" ||
    v6Superseding.authorizationHistory?.valid !== true ||
    v6Superseding.preserved?.protocol?.sha256 !== V6_PROTOCOL_SHA256 ||
    v6Superseding.preserved?.authorization?.sha256 !==
      V6_AUTHORIZATION_SHA256 ||
    v6Superseding.preserved?.index?.sha256 !== V6_INDEX_SHA256 ||
    v6Superseding.retirementReason?.defectClass !==
      "non-hermetic phase-sensitive self-test" ||
    v6Superseding.attemptsExecuted !== 0 ||
    v6Superseding.liveAttemptAuthorized !== false
  )
    failures.push("v6 broker protocol/status overclaim or hash mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v6Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v6 indexed artifact hash mismatch: ${artifactPath}`);
  }
  const v7AuthorizationPath = resolveRepositoryEvidencePath(
    V7_AUTHORIZATION_PATH,
  );
  const v7FirstAuthorizationPath = resolveRepositoryEvidencePath(
    V7_FIRST_AUTHORIZATION_PATH,
  );
  const v7Authorization = readRepositoryJson<Record<string, any>>(
    V7_AUTHORIZATION_PATH,
  );
  const v7Serialized = JSON.stringify([v7Protocol, v7Index, v7Status]);
  if (
    sha256(readRepositoryEvidence(`${V7_ROOT}/protocol.json`)) !==
      V7_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/proof-plan.json`)) !==
      V7_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/capture-manifest.json`)) !==
      V7_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/request-manifest.json`)) !==
      V7_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/antecedent-index.json`)) !==
      V7_INDEX_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/authorization-template.json`)) !==
      V7_AUTHORIZATION_TEMPLATE_SHA256 ||
    v7Protocol.artifactVersion !==
      "input-live-v7-external-operator-protocol-v1" ||
    v7Protocol.lifecycle?.authorizationExcludedFromAntecedentFreshness !==
      true ||
    v7Protocol.lifecycle?.laterAuthorizationDoesNotRecomputeAntecedent !==
      true ||
    v7Protocol.lifecycle?.v6AuthorizationReusable !== false ||
    v7Protocol.execution?.remoteRequests !== 132 ||
    v7Protocol.execution?.attemptsExecuted !== 0 ||
    v7Protocol.proof?.roots !== 2 ||
    v7Protocol.proof?.expectedFacts !== 43_726 ||
    v7Protocol.proof?.captures !== 128 ||
    v7Protocol.proof?.captureBeforeHashBoundTechnicalGates !== false ||
    v7Protocol.proof?.humanSignoffMandatory !== true ||
    v7Protocol.futureAuthorizationPrerequisites?.figmaPatRevokedOrReplaced !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites?.mcpRestartedAfterRotation !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites
      ?.ownerOnlyEnvironmentFileMode0600 !== true ||
    v7Protocol.futureAuthorizationPrerequisites?.repositorySecretScanZero !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites?.exactScratchReadOnlyProbe !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites?.tokenValuesForbidden !==
      true ||
    v7Index.artifactVersion !== "input-live-v7-antecedent-index-v1" ||
    v7Index.hashSetSha256 !== V7_HASH_SET_SHA256 ||
    v7Index.counts?.expectedSceneFacts !== 43_726 ||
    v7Index.counts?.remoteRequests !== 132 ||
    v7Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v7Status.artifactVersion !== "input-live-v7-status-v2" ||
    v7Status.status !==
      "replacement authorization prepared; post-commit attestation pending; live execution forbidden" ||
    v7Status.antecedent?.commit !== V7_ANTECEDENT_COMMIT ||
    v7Status.authorization?.present !== true ||
    v7Status.authorization?.commitStateDerivedByHistory !== true ||
    v7Status.authorization?.effective !== false ||
    v7Status.authorization?.firstAuthorization?.path !==
      V7_FIRST_AUTHORIZATION_PATH ||
    v7Status.authorization?.firstAuthorization?.sha256 !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    v7Status.authorization?.firstAuthorization?.bytesPreserved !== true ||
    v7Status.authorization?.firstAuthorization?.usableForExecution !== false ||
    v7Status.authorization?.replacementPath !== V7_AUTHORIZATION_PATH ||
    v7Status.authorization?.replacementSha256 !== V7_AUTHORIZATION_SHA256 ||
    v7Status.authorization?.replacementSigningPublicKeySpkiSha256 !==
      V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v7Status.authorization?.precommitHistoryState !== "pending-v2" ||
    v7Status.securityPrerequisites?.status !==
      "current read-only facts verified; post-commit attestation pending" ||
    v7Status.securityPrerequisites?.replacementPatActiveForProject !== true ||
    v7Status.securityPrerequisites?.oldTokenRevoked !== false ||
    v7Status.securityPrerequisites?.ownerRiskAcceptance !== true ||
    v7Status.securityPrerequisites?.figmaPatRevokedOrReplaced !== true ||
    v7Status.securityPrerequisites?.mcpRestartedAfterRotation !== true ||
    v7Status.securityPrerequisites?.ownerOnlyEnvironmentFilesMode0600 !==
      true ||
    v7Status.securityPrerequisites?.repositorySecretScanZero !== true ||
    v7Status.securityPrerequisites?.exactScratchBridgeProbePassed !== true ||
    v7Status.securityPrerequisites?.exactScratchRestProbePassed !== true ||
    v7Status.attemptsExecuted !== 0 ||
    v7Status.maximumFutureAttempts !== 3 ||
    v7Status.liveExecutionOccurred !== false ||
    /"(?:outcome|outcomes|result|results|measurement|observed|score|winner)"\s*:/.test(
      v7Serialized,
    ) ||
    !existsSync(v7AuthorizationPath) ||
    !existsSync(v7FirstAuthorizationPath) ||
    sha256(readRepositoryEvidence(V7_FIRST_AUTHORIZATION_PATH)) !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    sha256(readRepositoryEvidence(V7_AUTHORIZATION_PATH)) !==
      V7_AUTHORIZATION_SHA256 ||
    v7Authorization.artifactVersion !==
      "input-live-v7-capture-authorization-v2" ||
    v7Authorization.authorizationId !== "input-live-v7" ||
    v7Authorization.antecedent?.commit !== V7_ANTECEDENT_COMMIT ||
    v7Authorization.antecedent?.indexSha256 !== V7_INDEX_SHA256 ||
    v7Authorization.antecedent?.hashSetSha256 !== V7_HASH_SET_SHA256 ||
    v7Authorization.signingPublicKey?.spkiSha256 !==
      V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v7Authorization.supersession?.supersedesPath !==
      V7_FIRST_AUTHORIZATION_PATH ||
    v7Authorization.supersession?.supersedesSha256 !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    v7Authorization.supersession?.firstAuthorizationUsableForExecution !==
      false ||
    v7Authorization.supersession?.criteriaChanged !== false ||
    v7Authorization.execution?.v6AuthorizationReusable !== false ||
    v7Authorization.humanSignoff?.status !== "pending"
  )
    failures.push("v7 antecedent/status lifecycle or hash mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v7Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v7 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v7-authorization") ||
      artifactPath.includes("input-field-live-v7-preflight") ||
      artifactPath.includes("input-field-live-v7-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v7 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    sha256(readRepositoryEvidence(V7_SUPERSEDING_PATH)) !==
      V7_SUPERSEDING_SHA256 ||
    v7Superseding.artifactVersion !== "input-live-v7-superseding-status-v1" ||
    v7Superseding.supersededBy !== "input-live-v8" ||
    v7Superseding.authorizationReusableForV8 !== false ||
    v7Superseding.preserved?.antecedent?.bytesChanged !== false ||
    v7Superseding.preserved?.replacementAuthorization?.bytesChanged !== false ||
    v7Superseding.attempt1?.closed !== true ||
    v7Superseding.attempt1?.writerAccepted !== true ||
    v7Superseding.attempt1?.extractAccepted !== true ||
    v7Superseding.attempt1?.hostNormalizeFailed !== true ||
    v7Superseding.attempt1?.unsupportedField !== "strokeBottomWeight" ||
    v7Superseding.attempt1?.inPlacePatchForbidden !== true ||
    v7Superseding.attempt1?.cleanupComplete !== true ||
    v7Superseding.attempt1?.capturesPersisted !== 0 ||
    v7Superseding.attemptsExecuted !== 1 ||
    v7Superseding.nextAttempt !== null ||
    v7Superseding.liveSuccess !== false ||
    sha256(readRepositoryEvidence(`${V8_ROOT}/protocol.json`)) !==
      V8_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V8_ROOT}/proof-plan.json`)) !==
      V8_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V8_ROOT}/capture-manifest.json`)) !==
      V8_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V8_ROOT}/request-manifest.json`)) !==
      V8_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V8_ROOT}/antecedent-index.json`)) !==
      V8_INDEX_SHA256 ||
    sha256(readRepositoryEvidence(`${V8_ROOT}/authorization-template.json`)) !==
      V8_AUTHORIZATION_TEMPLATE_SHA256 ||
    v8Protocol.artifactVersion !==
      "input-live-v8-external-operator-protocol-v1" ||
    v8Protocol.lifecycle?.v7AuthorizationReusable !== false ||
    v8Protocol.transportFacts?.oneCallDiskOperatorRequired !== true ||
    v8Protocol.transportFacts?.honorSignedTimeoutRequired !== true ||
    v8Protocol.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    v8Protocol.transportFacts
      ?.fileContextEditorTypeReconstructedFromExactScratchTarget !== true ||
    v8Protocol.transportFacts?.emptyCodeEnvelopeRefused !== true ||
    v8Protocol.hostNormalization?.uniformStrokeWeightSibling !==
      "strokeWeight" ||
    !v8Protocol.hostNormalization?.perSideStrokeWeightFields?.includes(
      "strokeBottomWeight",
    ) ||
    v8Protocol.execution?.attemptsExecuted !== 0 ||
    v8Index.artifactVersion !== "input-live-v8-antecedent-index-v1" ||
    v8Index.hashSetSha256 !== V8_HASH_SET_SHA256 ||
    v8Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v8Status.artifactVersion !== "input-live-v8-status-v1" ||
    v8Status.status !== V8_STATUS ||
    v8Status.baseCommit !== V8_BASE_COMMIT ||
    v8Status.antecedent?.commit !== V8_ANTECEDENT_COMMIT ||
    v8Status.authorization?.present !== true ||
    v8Status.authorization?.commitStateDerivedByHistory !== true ||
    v8Status.authorization?.effective !== false ||
    v8Status.authorization?.path !== V8_AUTHORIZATION_PATH ||
    v8Status.authorization?.sha256 !== V8_AUTHORIZATION_SHA256 ||
    v8Status.authorization?.signingPublicKeySpkiSha256 !==
      V8_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v8Status.authorization?.precommitHistoryState !==
      "pending-uncommitted-authorization" ||
    v8Status.authorization?.expectedHistoryModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    v8Status.authorization?.v7AuthorizationReusable !== false ||
    v8Status.attemptsExecuted !== 2 ||
    v8Status.nextAttempt !== 3 ||
    v8Status.liveExecutionOccurred !== true ||
    v8Status.figmaWrites !== 4 ||
    v8Status.figmaCaptures !== 0 ||
    v8Status.createdNodesThenRemoved !== 2317 ||
    v8Status.attempt1Path !== V8_ATTEMPT_1_PATH ||
    v8Status.attempt1Sha256 !== V8_ATTEMPT_1_SHA256 ||
    v8Status.attempt2Path !== V8_ATTEMPT_2_PATH ||
    v8Status.attempt2Sha256 !== V8_ATTEMPT_2_SHA256 ||
    v8Status.restartAsV8Attempt3WithoutSceneReadbackTeachingForbidden !==
      true ||
    v8Status.overallInputSuccess !== false ||
    sha256(readRepositoryEvidence(V8_ATTEMPT_1_PATH)) !== V8_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V8_ATTEMPT_2_PATH)) !== V8_ATTEMPT_2_SHA256 ||
    sha256(readRepositoryEvidence(V8_AUTHORIZATION_PATH)) !==
      V8_AUTHORIZATION_SHA256 ||
    v8Authorization.artifactVersion !==
      "input-live-v8-capture-authorization-v1" ||
    v8Authorization.authorizationId !== "input-live-v8" ||
    v8Authorization.authorizationIntent !== true ||
    v8Authorization.antecedent?.commit !== V8_ANTECEDENT_COMMIT ||
    v8Authorization.antecedent?.indexSha256 !== V8_INDEX_SHA256 ||
    v8Authorization.antecedent?.hashSetSha256 !== V8_HASH_SET_SHA256 ||
    v8Authorization.signingPublicKey?.spkiSha256 !==
      V8_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v8Authorization.signingPublicKey?.privateKeyStoredInRepository !== false ||
    v8Authorization.execution?.v7AuthorizationReusable !== false ||
    v8Authorization.execution?.attemptsExecuted !== 0 ||
    v8Authorization.humanSignoff?.status !== "pending"
  )
    failures.push("v7 supersession or v8 authorization/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v8Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v8 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v8-authorization") ||
      artifactPath.includes("input-field-live-v8-preflight") ||
      artifactPath.includes("input-field-live-v8-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v8 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    sha256(readRepositoryEvidence(`${V9_ROOT}/protocol.json`)) !==
      V9_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V9_ROOT}/proof-plan.json`)) !==
      V9_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V9_ROOT}/capture-manifest.json`)) !==
      V9_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V9_ROOT}/request-manifest.json`)) !==
      V9_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V9_ROOT}/antecedent-index.json`)) !==
      V9_INDEX_SHA256 ||
    sha256(readRepositoryEvidence(`${V9_ROOT}/authorization-template.json`)) !==
      V9_AUTHORIZATION_TEMPLATE_SHA256 ||
    v9Protocol.artifactVersion !==
      "input-live-v9-external-operator-protocol-v1" ||
    v9Protocol.lifecycle?.v7AuthorizationReusable !== false ||
    v9Protocol.lifecycle?.v8AuthorizationReusable !== false ||
    v9Protocol.lifecycle?.v8AntecedentBytesUnchanged !== true ||
    v9Protocol.lifecycle?.sceneReadbackCarried !== true ||
    v9Protocol.transportFacts?.oneCallDiskOperatorRequired !== true ||
    v9Protocol.transportFacts?.honorSignedTimeoutRequired !== true ||
    v9Protocol.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    v9Protocol.transportFacts
      ?.fileContextEditorTypeReconstructedFromExactScratchTarget !== true ||
    v9Protocol.transportFacts?.emptyCodeEnvelopeRefused !== true ||
    !v9Protocol.hostNormalization?.taughtLiveFillKinds?.includes(
      "VARIABLE_ALIAS",
    ) ||
    !v9Protocol.hostNormalization?.taughtLiveFillKinds?.includes(
      "boundVariablesOnly",
    ) ||
    v9Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v9.ts" ||
    v9Protocol.hostNormalization?.v8SceneReadbackUnchanged !== true ||
    v9Protocol.execution?.attemptsExecuted !== 0 ||
    v9Index.artifactVersion !== "input-live-v9-antecedent-index-v1" ||
    v9Index.hashSetSha256 !== V9_HASH_SET_SHA256 ||
    v9Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v9Status.artifactVersion !== "input-live-v9-status-v1" ||
    v9Status.status !== V9_STATUS ||
    v9Status.baseCommit !== V9_BASE_COMMIT ||
    v9Status.antecedent?.commit !== V9_ANTECEDENT_COMMIT ||
    v9Status.authorization?.present !== true ||
    v9Status.authorization?.commitStateDerivedByHistory !== true ||
    v9Status.authorization?.effective !== false ||
    v9Status.authorization?.path !== V9_AUTHORIZATION_PATH ||
    v9Status.authorization?.sha256 !== V9_AUTHORIZATION_SHA256 ||
    v9Status.authorization?.signingPublicKeySpkiSha256 !==
      V9_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v9Status.authorization?.precommitHistoryState !==
      "pending-uncommitted-authorization" ||
    v9Status.authorization?.expectedHistoryModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    v9Status.authorization?.v7AuthorizationReusable !== false ||
    v9Status.authorization?.v8AuthorizationReusable !== false ||
    v9Status.smallestHonestDelta?.v8SceneReadbackUnchanged !== true ||
    v9Status.attemptsExecuted !== 2 ||
    v9Status.nextAttempt !== 3 ||
    v9Status.liveExecutionOccurred !== true ||
    v9Status.figmaWrites !== 4 ||
    v9Status.figmaCaptures !== 0 ||
    v9Status.createdNodesThenRemoved !== 2317 ||
    v9Status.attempt1Path !== V9_ATTEMPT_1_PATH ||
    v9Status.attempt1Sha256 !== V9_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V9_ATTEMPT_1_PATH)) !== V9_ATTEMPT_1_SHA256 ||
    v9Status.attempt2Path !== V9_ATTEMPT_2_PATH ||
    v9Status.attempt2Sha256 !== V9_ATTEMPT_2_SHA256 ||
    sha256(readRepositoryEvidence(V9_ATTEMPT_2_PATH)) !== V9_ATTEMPT_2_SHA256 ||
    v9Status.restartAsV9Attempt3WithoutCarriedV3VerifierForbidden !== true ||
    v9Status.overallInputSuccess !== false ||
    sha256(readRepositoryEvidence(V9_AUTHORIZATION_PATH)) !==
      V9_AUTHORIZATION_SHA256 ||
    v9Authorization.artifactVersion !==
      "input-live-v9-capture-authorization-v1" ||
    v9Authorization.authorizationId !== "input-live-v9" ||
    v9Authorization.authorizationIntent !== true ||
    v9Authorization.antecedent?.commit !== V9_ANTECEDENT_COMMIT ||
    v9Authorization.antecedent?.indexSha256 !== V9_INDEX_SHA256 ||
    v9Authorization.antecedent?.hashSetSha256 !== V9_HASH_SET_SHA256 ||
    v9Authorization.signingPublicKey?.spkiSha256 !==
      V9_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v9Authorization.signingPublicKey?.privateKeyStoredInRepository !== false ||
    v9Authorization.execution?.v7AuthorizationReusable !== false ||
    v9Authorization.execution?.v8AuthorizationReusable !== false ||
    v9Authorization.execution?.attemptsExecuted !== 0 ||
    v9Authorization.humanSignoff?.status !== "pending"
  )
    failures.push("v9 authorization/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v9Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v9 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v9-authorization") ||
      artifactPath.includes("input-field-live-v9-preflight") ||
      artifactPath.includes("input-field-live-v9-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v9 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v9Index.artifacts?.["recipe/scene-readback-v9.ts"] ||
    !v9Index.artifacts?.["recipe/scene-readback-runtime-v9.ts"] ||
    v9Index.artifacts?.["recipe/scene-readback.ts"] ||
    v9Index.artifacts?.["recipe/scene-readback-runtime.ts"]
  )
    failures.push("v9 must hash carried scene-readback and leave v8 bytes out");
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback.ts")) !==
      v8Index.artifacts?.["recipe/scene-readback.ts"]?.sha256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime.ts")) !==
      v8Index.artifacts?.["recipe/scene-readback-runtime.ts"]?.sha256
  )
    failures.push("v8 scene-readback bytes restamped while preparing v9");
  if (
    sha256(readRepositoryEvidence(`${V10_ROOT}/protocol.json`)) !==
      V10_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V10_ROOT}/proof-plan.json`)) !==
      V10_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V10_ROOT}/capture-manifest.json`)) !==
      V10_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V10_ROOT}/request-manifest.json`)) !==
      V10_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V10_ROOT}/antecedent-index.json`)) !==
      V10_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V10_ROOT}/authorization-template.json`),
    ) !== V10_AUTHORIZATION_TEMPLATE_SHA256 ||
    v10Protocol.artifactVersion !==
      "input-live-v10-external-operator-protocol-v1" ||
    v10Protocol.lifecycle?.v7AuthorizationReusable !== false ||
    v10Protocol.lifecycle?.v8AuthorizationReusable !== false ||
    v10Protocol.lifecycle?.v9AuthorizationReusable !== false ||
    v10Protocol.lifecycle?.v8AntecedentBytesUnchanged !== true ||
    v10Protocol.lifecycle?.v9AntecedentBytesUnchanged !== true ||
    v10Protocol.lifecycle?.sceneReadbackCarried !== true ||
    v10Protocol.lifecycle?.carriedV3Verifier !== true ||
    v10Protocol.transportFacts?.oneCallDiskOperatorRequired !== true ||
    v10Protocol.transportFacts?.honorSignedTimeoutRequired !== true ||
    v10Protocol.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    v10Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v10.ts" ||
    v10Protocol.hostNormalization?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v10.ts" ||
    v10Protocol.hostNormalization?.liveHostDoesNotImportSceneReadbackTs !==
      true ||
    v10Protocol.execution?.attemptsExecuted !== 0 ||
    v10Index.artifactVersion !== "input-live-v10-antecedent-index-v1" ||
    v10Index.hashSetSha256 !== V10_HASH_SET_SHA256 ||
    v10Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v10Status.artifactVersion !== "input-live-v10-status-v1" ||
    v10Status.status !== V10_STATUS ||
    v10Status.baseCommit !== V10_BASE_COMMIT ||
    v10Status.antecedent?.commit !== V10_ANTECEDENT_COMMIT ||
    v10Status.authorization?.present !== true ||
    v10Status.authorization?.commitStateDerivedByHistory !== true ||
    v10Status.authorization?.effective !== false ||
    v10Status.authorization?.path !== V10_AUTHORIZATION_PATH ||
    v10Status.authorization?.sha256 !== V10_AUTHORIZATION_SHA256 ||
    v10Status.authorization?.signingPublicKeySpkiSha256 !==
      V10_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v10Status.authorization?.precommitHistoryState !==
      "pending-uncommitted-authorization" ||
    v10Status.authorization?.expectedHistoryModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    v10Status.authorization?.v9AuthorizationReusable !== false ||
    sha256(readRepositoryEvidence(V10_AUTHORIZATION_PATH)) !==
      V10_AUTHORIZATION_SHA256 ||
    v10Authorization.artifactVersion !==
      "input-live-v10-capture-authorization-v1" ||
    v10Authorization.authorizationId !== "input-live-v10" ||
    v10Authorization.authorizationIntent !== true ||
    v10Authorization.antecedent?.commit !== V10_ANTECEDENT_COMMIT ||
    v10Authorization.antecedent?.indexSha256 !== V10_INDEX_SHA256 ||
    v10Authorization.antecedent?.hashSetSha256 !== V10_HASH_SET_SHA256 ||
    v10Authorization.signingPublicKey?.spkiSha256 !==
      V10_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v10Authorization.signingPublicKey?.privateKeyStoredInRepository !== false ||
    v10Authorization.execution?.v9AuthorizationReusable !== false ||
    v10Authorization.execution?.attemptsExecuted !== 0 ||
    v10Authorization.humanSignoff?.status !== "pending" ||
    v10Status.smallestHonestDelta?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v10.ts" ||
    v10Status.smallestHonestDelta?.liveHostDoesNotImportSceneReadbackTs !==
      true ||
    v10Status.smallestHonestDelta?.v9AntecedentBytesUnchanged !== true ||
    v10Status.attemptsExecuted !== 2 ||
    v10Status.nextAttempt !== 3 ||
    v10Status.liveExecutionOccurred !== true ||
    v10Status.figmaWrites !== 4 ||
    v10Status.figmaCaptures !== 0 ||
    v10Status.createdNodesThenRemoved !== 2317 ||
    v10Status.attempt1Path !== V10_ATTEMPT_1_PATH ||
    v10Status.attempt1Sha256 !== V10_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V10_ATTEMPT_1_PATH)) !==
      V10_ATTEMPT_1_SHA256 ||
    v10Status.attempt2Path !== V10_ATTEMPT_2_PATH ||
    v10Status.attempt2Sha256 !== V10_ATTEMPT_2_SHA256 ||
    sha256(readRepositoryEvidence(V10_ATTEMPT_2_PATH)) !==
      V10_ATTEMPT_2_SHA256 ||
    v10Status.restartAsV10Attempt2WithoutAxisOrderTeachingForbidden !== true ||
    v10Status.restartAsV10Attempt3WithoutCarriedFirstSegmentRoleForbidden !==
      true ||
    v10Status.overallInputSuccess !== false
  )
    failures.push("v10 authorization/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v10Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v10 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v10-authorization") ||
      artifactPath.includes("input-field-live-v10-preflight") ||
      artifactPath.includes("input-field-live-v10-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v10 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v10Index.artifacts?.["recipe/scene-readback-v10.ts"] ||
    !v10Index.artifacts?.["recipe/scene-readback-runtime-v10.ts"] ||
    !v10Index.artifacts?.["recipe/input-field-live-v3-verifier-v10.ts"] ||
    v10Index.artifacts?.["recipe/scene-readback.ts"] ||
    v10Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"]
  )
    failures.push(
      "v10 must hash carried scene-readback and v3 verifier-v10 and leave hashed v8/v9 host path out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v9.ts")) !==
      v9Index.artifacts?.["recipe/scene-readback-v9.ts"]?.sha256 ||
    sha256(readRepositoryEvidence("recipe/input-field-live-v3-verifier.ts")) !==
      v9Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"]?.sha256
  )
    failures.push("v9 hashed host-path bytes restamped while preparing v10");
  if (
    sha256(readRepositoryEvidence(`${V11_ROOT}/protocol.json`)) !==
      V11_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V11_ROOT}/proof-plan.json`)) !==
      V11_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V11_ROOT}/capture-manifest.json`)) !==
      V11_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V11_ROOT}/request-manifest.json`)) !==
      V11_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V11_ROOT}/antecedent-index.json`)) !==
      V11_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V11_ROOT}/authorization-template.json`),
    ) !== V11_AUTHORIZATION_TEMPLATE_SHA256 ||
    v11Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v11.ts" ||
    v11Protocol.hostNormalization?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v11.ts" ||
    v11Index.hashSetSha256 !== V11_HASH_SET_SHA256 ||
    v11Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v11Status.artifactVersion !== "input-live-v11-status-v1" ||
    v11Status.status !== V11_STATUS ||
    v11Status.baseCommit !== V11_BASE_COMMIT ||
    v11Status.antecedent?.commit !== V11_ANTECEDENT_COMMIT ||
    v11Status.authorization?.present !== true ||
    v11Status.authorization?.commitStateDerivedByHistory !== true ||
    v11Status.authorization?.effective !== false ||
    v11Status.authorization?.path !== V11_AUTHORIZATION_PATH ||
    v11Status.authorization?.sha256 !== V11_AUTHORIZATION_SHA256 ||
    v11Status.authorization?.signingPublicKeySpkiSha256 !==
      V11_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V11_AUTHORIZATION_PATH)) !==
      V11_AUTHORIZATION_SHA256 ||
    v11Status.authorization?.v10AuthorizationReusable !== false ||
    v11Status.smallestHonestDelta?.taughtFirstSegmentRoleRecovery !== true ||
    v11Status.smallestHonestDelta?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v11.ts" ||
    v11Status.attemptsExecuted !== 1 ||
    v11Status.nextAttempt !== 2 ||
    v11Status.liveExecutionOccurred !== true ||
    v11Status.figmaWrites !== 2 ||
    v11Status.figmaCaptures !== 0 ||
    v11Status.createdNodesThenRemoved !== 2317 ||
    v11Status.attempt1Path !== V11_ATTEMPT_1_PATH ||
    v11Status.attempt1Sha256 !== V11_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V11_ATTEMPT_1_PATH)) !==
      V11_ATTEMPT_1_SHA256 ||
    v11Status.restartAsV11Attempt2WithoutContentFillFixForbidden !== true ||
    v11Status.overallInputSuccess !== false
  )
    failures.push("v11 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v11Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v11 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v11-authorization") ||
      artifactPath.includes("input-field-live-v11-preflight") ||
      artifactPath.includes("input-field-live-v11-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v11 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v11Index.artifacts?.["recipe/scene-readback-v11.ts"] ||
    !v11Index.artifacts?.["recipe/scene-readback-runtime-v11.ts"] ||
    !v11Index.artifacts?.["recipe/input-field-live-v3-verifier-v11.ts"] ||
    v11Index.artifacts?.["recipe/scene-readback.ts"] ||
    v11Index.artifacts?.["recipe/scene-readback-v10.ts"] ||
    v11Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v11Index.artifacts?.["recipe/input-field-live-v3-verifier-v10.ts"]
  )
    failures.push(
      "v11 must hash carried scene-readback-v11 and leave hashed v8/v10 host path out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v10.ts")) !==
      v10Index.artifacts?.["recipe/scene-readback-v10.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v10.ts"),
    ) !==
      v10Index.artifacts?.["recipe/input-field-live-v3-verifier-v10.ts"]?.sha256
  )
    failures.push("v10 hashed host-path bytes restamped while preparing v11");
  if (
    sha256(readRepositoryEvidence(`${V12_ROOT}/protocol.json`)) !==
      V12_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V12_ROOT}/proof-plan.json`)) !==
      V12_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V12_ROOT}/capture-manifest.json`)) !==
      V12_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V12_ROOT}/request-manifest.json`)) !==
      V12_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V12_ROOT}/antecedent-index.json`)) !==
      V12_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V12_ROOT}/authorization-template.json`),
    ) !== V12_AUTHORIZATION_TEMPLATE_SHA256 ||
    v12Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v12.ts" ||
    v12Protocol.hostNormalization?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v12.ts" ||
    v12Protocol.hostNormalization?.taughtPostSettleContentFillRestore !==
      true ||
    v12Protocol.hostNormalization?.v11WriterBytesUnchanged !== false ||
    v12Index.hashSetSha256 !== V12_HASH_SET_SHA256 ||
    v12Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v12Status.artifactVersion !== "input-live-v12-status-v1" ||
    v12Status.status !== V12_STATUS ||
    v12Status.baseCommit !== V12_BASE_COMMIT ||
    v12Status.antecedent?.commit !== V12_ANTECEDENT_COMMIT ||
    v12Status.authorization?.present !== true ||
    v12Status.authorization?.commitStateDerivedByHistory !== true ||
    v12Status.authorization?.effective !== false ||
    v12Status.authorization?.path !== V12_AUTHORIZATION_PATH ||
    v12Status.authorization?.sha256 !== V12_AUTHORIZATION_SHA256 ||
    v12Status.authorization?.signingPublicKeySpkiSha256 !==
      V12_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V12_AUTHORIZATION_PATH)) !==
      V12_AUTHORIZATION_SHA256 ||
    v12Status.authorization?.v11AuthorizationReusable !== false ||
    v12Status.smallestHonestDelta?.taughtPostSettleContentFillRestore !==
      true ||
    v12Status.smallestHonestDelta?.v11WriterBytesUnchanged !== false ||
    v12Status.smallestHonestDelta?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v12.ts" ||
    v12Status.attemptsExecuted !== 1 ||
    v12Status.nextAttempt !== 2 ||
    v12Status.liveExecutionOccurred !== true ||
    v12Status.figmaWrites !== 2 ||
    v12Status.figmaCaptures !== 0 ||
    v12Status.createdNodesThenRemoved !== 2317 ||
    v12Status.attempt1Path !== V12_ATTEMPT_1_PATH ||
    v12Status.attempt1Sha256 !== V12_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V12_ATTEMPT_1_PATH)) !==
      V12_ATTEMPT_1_SHA256 ||
    v12Status.restartAsV12Attempt2WithoutPostWriterFillRestoreForbidden !==
      true ||
    v12Status.overallInputSuccess !== false
  )
    failures.push("v12 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v12Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v12 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v12-authorization") ||
      artifactPath.includes("input-field-live-v12-preflight") ||
      artifactPath.includes("input-field-live-v12-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v12 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v12Index.artifacts?.["recipe/scene-readback-v12.ts"] ||
    !v12Index.artifacts?.["recipe/scene-readback-runtime-v12.ts"] ||
    !v12Index.artifacts?.["recipe/input-field-live-v3-verifier-v12.ts"] ||
    !v12Index.artifacts?.["recipe/input-field-live-v12-writer-patch.ts"] ||
    !v12Index.artifacts?.[`${V12_ROOT}/programs/writer-payload.js`] ||
    v12Index.artifacts?.["recipe/scene-readback.ts"] ||
    v12Index.artifacts?.["recipe/scene-readback-v11.ts"] ||
    v12Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v12Index.artifacts?.["recipe/input-field-live-v3-verifier-v11.ts"]
  )
    failures.push(
      "v12 must hash carried scene-readback-v12 and writer patch and leave hashed v11 host path out",
    );
  if (
    sha256(readRepositoryEvidence(`${V11_ROOT}/programs/writer.txt`)) !==
      V11_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V11_ROOT}/programs/writer-payload.js`)) !==
      V11_WRITER_PAYLOAD_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v11.ts")) !==
      v11Index.artifacts?.["recipe/scene-readback-v11.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v11.ts"),
    ) !==
      v11Index.artifacts?.["recipe/input-field-live-v3-verifier-v11.ts"]?.sha256
  )
    failures.push(
      "v11 hashed host-path or writer bytes restamped while preparing v12",
    );
  if (
    sha256(readRepositoryEvidence(`${V13_ROOT}/protocol.json`)) !==
      V13_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/proof-plan.json`)) !==
      V13_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/capture-manifest.json`)) !==
      V13_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/request-manifest.json`)) !==
      V13_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/antecedent-index.json`)) !==
      V13_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V13_ROOT}/authorization-template.json`),
    ) !== V13_AUTHORIZATION_TEMPLATE_SHA256 ||
    v13Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v13.ts" ||
    v13Protocol.hostNormalization?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v13.ts" ||
    v13Protocol.hostNormalization?.taughtPostWriterContentFillRestore !==
      true ||
    v13Protocol.hostNormalization?.v12WriterBytesUnchanged !== true ||
    v13Protocol.execution?.remoteRequests !== 133 ||
    v13Index.hashSetSha256 !== V13_HASH_SET_SHA256 ||
    v13Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v13Status.artifactVersion !== "input-live-v13-status-v1" ||
    v13Status.status !== V13_STATUS ||
    v13Status.baseCommit !== V13_BASE_COMMIT ||
    v13Status.antecedent?.commit !== V13_ANTECEDENT_COMMIT ||
    v13Status.authorization?.present !== true ||
    v13Status.authorization?.commitStateDerivedByHistory !== true ||
    v13Status.authorization?.effective !== false ||
    v13Status.authorization?.path !== V13_AUTHORIZATION_PATH ||
    v13Status.authorization?.sha256 !== V13_AUTHORIZATION_SHA256 ||
    v13Status.authorization?.signingPublicKeySpkiSha256 !==
      V13_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V13_AUTHORIZATION_PATH)) !==
      V13_AUTHORIZATION_SHA256 ||
    v13Status.authorization?.v12AuthorizationReusable !== false ||
    v13Status.smallestHonestDelta?.taughtPostWriterContentFillRestore !==
      true ||
    v13Status.smallestHonestDelta?.v12WriterBytesUnchanged !== true ||
    v13Status.smallestHonestDelta?.carriedV3Verifier !==
      "recipe/input-field-live-v3-verifier-v13.ts" ||
    v13Status.denominator?.remoteRequests !== 133 ||
    v13Status.attemptsExecuted !== 1 ||
    v13Status.nextAttempt !== 2 ||
    v13Status.liveExecutionOccurred !== true ||
    v13Status.figmaWrites !== 2 ||
    v13Status.figmaCaptures !== 0 ||
    v13Status.createdNodesThenRemoved !== 2317 ||
    v13Status.attempt1Path !== V13_ATTEMPT_1_PATH ||
    v13Status.attempt1Sha256 !== V13_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V13_ATTEMPT_1_PATH)) !==
      V13_ATTEMPT_1_SHA256 ||
    v13Status.restartAsV13Attempt2WithoutHashedRestoreChangeForbidden !==
      true ||
    v13Status.overallInputSuccess !== false
  )
    failures.push("v13 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v13Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v13 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v13-authorization") ||
      artifactPath.includes("input-field-live-v13-preflight") ||
      artifactPath.includes("input-field-live-v13-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v13 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v13Index.artifacts?.["recipe/scene-readback-v13.ts"] ||
    !v13Index.artifacts?.["recipe/scene-readback-runtime-v13.ts"] ||
    !v13Index.artifacts?.["recipe/input-field-live-v3-verifier-v13.ts"] ||
    !v13Index.artifacts?.["recipe/input-field-live-v13-restore.ts"] ||
    !v13Index.artifacts?.[`${V13_ROOT}/programs/restore-blueprint.js`] ||
    !v13Index.artifacts?.[`${V13_ROOT}/programs/writer-payload.js`] ||
    v13Index.artifacts?.["recipe/scene-readback.ts"] ||
    v13Index.artifacts?.["recipe/scene-readback-v12.ts"] ||
    v13Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v13Index.artifacts?.["recipe/input-field-live-v3-verifier-v12.ts"] ||
    v13Index.artifacts?.["recipe/input-field-live-v13-writer-patch.ts"]
  )
    failures.push(
      "v13 must hash carried scene-readback-v13 and post-writer restore and leave hashed v12 host path out",
    );
  if (
    sha256(readRepositoryEvidence(`${V12_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V12_ROOT}/programs/writer-payload.js`)) !==
      V12_WRITER_PAYLOAD_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/programs/writer-payload.js`)) !==
      V12_WRITER_PAYLOAD_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v12.ts")) !==
      v12Index.artifacts?.["recipe/scene-readback-v12.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v12.ts"),
    ) !==
      v12Index.artifacts?.["recipe/input-field-live-v3-verifier-v12.ts"]?.sha256
  )
    failures.push(
      "v12 hashed host-path or writer bytes restamped while preparing v13",
    );
  if (
    sha256(readRepositoryEvidence(`${V14_ROOT}/protocol.json`)) !==
      V14_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V14_ROOT}/proof-plan.json`)) !==
      V14_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V14_ROOT}/capture-manifest.json`)) !==
      V14_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V14_ROOT}/request-manifest.json`)) !==
      V14_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V14_ROOT}/antecedent-index.json`)) !==
      V14_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V14_ROOT}/authorization-template.json`),
    ) !== V14_AUTHORIZATION_TEMPLATE_SHA256 ||
    v14Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v14.ts" ||
    v14Protocol.hostNormalization?.taughtTwoPassParentThenContentFillRestore !==
      true ||
    v14Protocol.hostNormalization?.taughtHiddenTextFillReveal !== true ||
    v14Protocol.hostNormalization?.v13RestoreBytesUnchanged !== true ||
    v14Protocol.execution?.remoteRequests !== 133 ||
    v14Index.hashSetSha256 !== V14_HASH_SET_SHA256 ||
    v14Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v14Status.artifactVersion !== "input-live-v14-status-v1" ||
    v14Status.status !== V14_STATUS ||
    v14Status.baseCommit !== V14_BASE_COMMIT ||
    v14Status.antecedent?.commit !== V14_ANTECEDENT_COMMIT ||
    v14Status.authorization?.present !== true ||
    v14Status.authorization?.commitStateDerivedByHistory !== true ||
    v14Status.authorization?.effective !== false ||
    v14Status.authorization?.path !== V14_AUTHORIZATION_PATH ||
    v14Status.authorization?.sha256 !== V14_AUTHORIZATION_SHA256 ||
    v14Status.authorization?.signingPublicKeySpkiSha256 !==
      V14_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V14_AUTHORIZATION_PATH)) !==
      V14_AUTHORIZATION_SHA256 ||
    v14Status.authorization?.v13AuthorizationReusable !== false ||
    v14Status.smallestHonestDelta?.taughtTwoPassParentThenContentFillRestore !==
      true ||
    v14Status.smallestHonestDelta?.taughtHiddenTextFillReveal !== true ||
    v14Status.smallestHonestDelta?.v13RestoreBytesUnchanged !== true ||
    v14Status.attemptsExecuted !== 1 ||
    v14Status.nextAttempt !== 2 ||
    v14Status.liveExecutionOccurred !== true ||
    v14Status.figmaWrites !== 2 ||
    v14Status.figmaCaptures !== 0 ||
    v14Status.createdNodesThenRemoved !== 2317 ||
    v14Status.attempt1Path !== V14_ATTEMPT_1_PATH ||
    v14Status.attempt1Sha256 !== V14_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V14_ATTEMPT_1_PATH)) !==
      V14_ATTEMPT_1_SHA256 ||
    v14Status.restartAsV14Attempt2WithoutHashedRestoreChangeForbidden !==
      true ||
    v14Status.overallInputSuccess !== false
  )
    failures.push("v14 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v14Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v14 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v14-authorization") ||
      artifactPath.includes("input-field-live-v14-preflight") ||
      artifactPath.includes("input-field-live-v14-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v14 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v14Index.artifacts?.["recipe/scene-readback-v14.ts"] ||
    !v14Index.artifacts?.["recipe/scene-readback-runtime-v14.ts"] ||
    !v14Index.artifacts?.["recipe/input-field-live-v3-verifier-v14.ts"] ||
    !v14Index.artifacts?.["recipe/input-field-live-v14-restore.ts"] ||
    !v14Index.artifacts?.[`${V14_ROOT}/programs/restore-blueprint.js`] ||
    !v14Index.artifacts?.[`${V14_ROOT}/programs/writer-payload.js`] ||
    v14Index.artifacts?.["recipe/scene-readback.ts"] ||
    v14Index.artifacts?.["recipe/scene-readback-v13.ts"] ||
    v14Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v14Index.artifacts?.["recipe/input-field-live-v3-verifier-v13.ts"] ||
    v14Index.artifacts?.["recipe/input-field-live-v13-restore.ts"]
  )
    failures.push(
      "v14 must hash carried scene-readback-v14 and two-pass restore and leave hashed v13 restore out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/input-field-live-v13-restore.ts")) !==
      V13_RESTORE_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V13_ROOT}/programs/restore-blueprint.js`),
    ) !== V13_RESTORE_BLUEPRINT_SHA256 ||
    sha256(readRepositoryEvidence(`${V13_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V14_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v13.ts")) !==
      v13Index.artifacts?.["recipe/scene-readback-v13.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v13.ts"),
    ) !==
      v13Index.artifacts?.["recipe/input-field-live-v3-verifier-v13.ts"]?.sha256
  )
    failures.push(
      "v13 hashed host-path, writer, or restore bytes restamped while preparing v14",
    );
  if (
    sha256(readRepositoryEvidence(`${V15_ROOT}/protocol.json`)) !==
      V15_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V15_ROOT}/proof-plan.json`)) !==
      V15_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V15_ROOT}/capture-manifest.json`)) !==
      V15_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V15_ROOT}/request-manifest.json`)) !==
      V15_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V15_ROOT}/antecedent-index.json`)) !==
      V15_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V15_ROOT}/authorization-template.json`),
    ) !== V15_AUTHORIZATION_TEMPLATE_SHA256 ||
    v15Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v15.ts" ||
    v15Protocol.hostNormalization?.taughtTwoPassParentThenContentFillRestore !==
      true ||
    v15Protocol.hostNormalization?.taughtHiddenTextFillReveal !== true ||
    v15Protocol.hostNormalization?.taughtMeasureFillWhileVisible !== true ||
    v15Protocol.hostNormalization?.v14RestoreBytesUnchanged !== true ||
    v15Protocol.execution?.remoteRequests !== 133 ||
    v15Index.hashSetSha256 !== V15_HASH_SET_SHA256 ||
    v15Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v15Status.artifactVersion !== "input-live-v15-status-v1" ||
    v15Status.status !== V15_STATUS ||
    v15Status.baseCommit !== V15_BASE_COMMIT ||
    v15Status.antecedent?.commit !== V15_ANTECEDENT_COMMIT ||
    v15Status.authorization?.present !== true ||
    v15Status.authorization?.commitStateDerivedByHistory !== true ||
    v15Status.authorization?.effective !== false ||
    v15Status.authorization?.path !== V15_AUTHORIZATION_PATH ||
    v15Status.authorization?.sha256 !== V15_AUTHORIZATION_SHA256 ||
    v15Status.authorization?.signingPublicKeySpkiSha256 !==
      V15_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V15_AUTHORIZATION_PATH)) !==
      V15_AUTHORIZATION_SHA256 ||
    v15Status.authorization?.v14AuthorizationReusable !== false ||
    v15Status.smallestHonestDelta?.taughtTwoPassParentThenContentFillRestore !==
      true ||
    v15Status.smallestHonestDelta?.taughtHiddenTextFillReveal !== true ||
    v15Status.smallestHonestDelta?.taughtMeasureFillWhileVisible !== true ||
    v15Status.smallestHonestDelta?.v14RestoreBytesUnchanged !== true ||
    v15Status.attemptsExecuted !== 1 ||
    v15Status.nextAttempt !== 2 ||
    v15Status.liveExecutionOccurred !== true ||
    v15Status.figmaWrites !== 4 ||
    v15Status.figmaCaptures !== 0 ||
    v15Status.createdNodesThenRemoved !== 2317 ||
    v15Status.attempt1Path !== V15_ATTEMPT_1_PATH ||
    v15Status.attempt1Sha256 !== V15_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V15_ATTEMPT_1_PATH)) !==
      V15_ATTEMPT_1_SHA256 ||
    v15Status.restartAsV15Attempt2WithoutPersistedFillAfterHideForbidden !==
      true ||
    v15Status.overallInputSuccess !== false
  )
    failures.push("v15 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v15Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v15 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v15-authorization") ||
      artifactPath.includes("input-field-live-v15-preflight") ||
      artifactPath.includes("input-field-live-v15-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v15 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v15Index.artifacts?.["recipe/scene-readback-v15.ts"] ||
    !v15Index.artifacts?.["recipe/scene-readback-runtime-v15.ts"] ||
    !v15Index.artifacts?.["recipe/input-field-live-v3-verifier-v15.ts"] ||
    !v15Index.artifacts?.["recipe/input-field-live-v15-restore.ts"] ||
    !v15Index.artifacts?.[`${V15_ROOT}/programs/restore-blueprint.js`] ||
    !v15Index.artifacts?.[`${V15_ROOT}/programs/writer-payload.js`] ||
    v15Index.artifacts?.["recipe/scene-readback.ts"] ||
    v15Index.artifacts?.["recipe/scene-readback-v14.ts"] ||
    v15Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v15Index.artifacts?.["recipe/input-field-live-v3-verifier-v14.ts"] ||
    v15Index.artifacts?.["recipe/input-field-live-v14-restore.ts"]
  )
    failures.push(
      "v15 must hash carried scene-readback-v15 and measure-visible restore and leave hashed v14 restore out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/input-field-live-v14-restore.ts")) !==
      V14_RESTORE_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V14_ROOT}/programs/restore-blueprint.js`),
    ) !== V14_RESTORE_BLUEPRINT_SHA256 ||
    sha256(readRepositoryEvidence(`${V14_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V15_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v14.ts")) !==
      v14Index.artifacts?.["recipe/scene-readback-v14.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v14.ts"),
    ) !==
      v14Index.artifacts?.["recipe/input-field-live-v3-verifier-v14.ts"]?.sha256
  )
    failures.push(
      "v14 hashed host-path, writer, or restore bytes restamped while preparing v15",
    );
  if (
    sha256(readRepositoryEvidence(`${V16_ROOT}/protocol.json`)) !==
      V16_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/proof-plan.json`)) !==
      V16_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/capture-manifest.json`)) !==
      V16_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/request-manifest.json`)) !==
      V16_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/antecedent-index.json`)) !==
      V16_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/authorization-template.json`),
    ) !== V16_AUTHORIZATION_TEMPLATE_SHA256 ||
    v16Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v16.ts" ||
    v16Protocol.hostNormalization?.taughtMeasureFillWhileVisible !== true ||
    v16Protocol.hostNormalization
      ?.taughtExtractMeasureHiddenContentFillWhileVisible !== true ||
    v16Protocol.hostNormalization?.v15RestoreBytesUnchanged !== true ||
    v16Protocol.hostNormalization?.v15RuntimeBytesUnchanged !== true ||
    v16Protocol.execution?.remoteRequests !== 133 ||
    v16Index.hashSetSha256 !== V16_HASH_SET_SHA256 ||
    v16Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v16Status.artifactVersion !== "input-live-v16-status-v1" ||
    v16Status.status !== V16_STATUS ||
    v16Status.baseCommit !== V16_BASE_COMMIT ||
    v16Status.antecedent?.commit !== V16_ANTECEDENT_COMMIT ||
    v16Status.authorization?.present !== true ||
    v16Status.authorization?.commitStateDerivedByHistory !== true ||
    v16Status.authorization?.effective !== false ||
    v16Status.authorization?.path !== V16_AUTHORIZATION_PATH ||
    v16Status.authorization?.sha256 !== V16_AUTHORIZATION_SHA256 ||
    v16Status.authorization?.signingPublicKeySpkiSha256 !==
      V16_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V16_AUTHORIZATION_PATH)) !==
      V16_AUTHORIZATION_SHA256 ||
    v16Status.authorization?.v15AuthorizationReusable !== false ||
    v16Status.smallestHonestDelta?.taughtMeasureFillWhileVisible !== true ||
    v16Status.smallestHonestDelta
      ?.taughtExtractMeasureHiddenContentFillWhileVisible !== true ||
    v16Status.smallestHonestDelta?.v15RestoreBytesUnchanged !== true ||
    v16Status.smallestHonestDelta?.v15RuntimeBytesUnchanged !== true ||
    v16Status.attemptsExecuted !== 1 ||
    v16Status.nextAttempt !== 2 ||
    v16Status.liveExecutionOccurred !== true ||
    v16Status.figmaWrites !== 4 ||
    v16Status.figmaCaptures !== 0 ||
    v16Status.createdNodesThenRemoved !== 2317 ||
    v16Status.attempt1Path !== V16_ATTEMPT_1_PATH ||
    v16Status.attempt1Sha256 !== V16_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V16_ATTEMPT_1_PATH)) !==
      V16_ATTEMPT_1_SHA256 ||
    v16Status.restartAsV16Attempt2WithoutLeadingSlotSolidPaintForbidden !==
      true ||
    v16Status.overallInputSuccess !== false
  )
    failures.push("v16 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v16Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v16 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v16-authorization") ||
      artifactPath.includes("input-field-live-v16-preflight") ||
      artifactPath.includes("input-field-live-v16-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v16 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v16Index.artifacts?.["recipe/scene-readback-v16.ts"] ||
    !v16Index.artifacts?.["recipe/scene-readback-runtime-v16.ts"] ||
    !v16Index.artifacts?.["recipe/input-field-live-v3-verifier-v16.ts"] ||
    !v16Index.artifacts?.["recipe/input-field-live-v16-restore.ts"] ||
    !v16Index.artifacts?.[`${V16_ROOT}/programs/restore-blueprint.js`] ||
    !v16Index.artifacts?.[`${V16_ROOT}/programs/writer-payload.js`] ||
    v16Index.artifacts?.["recipe/scene-readback.ts"] ||
    v16Index.artifacts?.["recipe/scene-readback-v15.ts"] ||
    v16Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v16Index.artifacts?.["recipe/input-field-live-v3-verifier-v15.ts"] ||
    v16Index.artifacts?.["recipe/input-field-live-v15-restore.ts"]
  )
    failures.push(
      "v16 must hash carried scene-readback-v16 and leave hashed v15 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/input-field-live-v15-restore.ts")) !==
      V15_RESTORE_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V15_ROOT}/programs/restore-blueprint.js`),
    ) !== V15_RESTORE_BLUEPRINT_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v15.ts")) !==
      V15_RUNTIME_SOURCE_SHA256 ||
    sha256(readRepositoryEvidence(`${V15_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v15.ts")) !==
      v15Index.artifacts?.["recipe/scene-readback-v15.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v15.ts"),
    ) !==
      v15Index.artifacts?.["recipe/input-field-live-v3-verifier-v15.ts"]?.sha256
  )
    failures.push(
      "v15 hashed host-path, writer, restore, or runtime bytes restamped while preparing v16",
    );
  if (
    sha256(readRepositoryEvidence(`${V17_ROOT}/protocol.json`)) !==
      V17_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V17_ROOT}/proof-plan.json`)) !==
      V17_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V17_ROOT}/capture-manifest.json`)) !==
      V17_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V17_ROOT}/request-manifest.json`)) !==
      V17_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V17_ROOT}/antecedent-index.json`)) !==
      V17_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V17_ROOT}/authorization-template.json`),
    ) !== V17_AUTHORIZATION_TEMPLATE_SHA256 ||
    v17Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v17.ts" ||
    v17Protocol.hostNormalization?.taughtLeadingSlotSolidPaintFromPayloadOrChild !==
      true ||
    v17Protocol.hostNormalization?.v16RestoreBytesUnchanged !== true ||
    v17Protocol.hostNormalization?.v16RuntimeBytesUnchanged !== true ||
    v17Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v17Protocol.execution?.remoteRequests !== 133 ||
    v17Index.hashSetSha256 !== V17_HASH_SET_SHA256 ||
    v17Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v17Status.artifactVersion !== "input-live-v17-status-v1" ||
    v17Status.status !== V17_STATUS ||
    v17Status.baseCommit !== V17_BASE_COMMIT ||
    v17Status.antecedent?.commit !== V17_ANTECEDENT_COMMIT ||
    v17Status.authorization?.present !== true ||
    v17Status.authorization?.commitStateDerivedByHistory !== true ||
    v17Status.authorization?.effective !== false ||
    v17Status.authorization?.path !== V17_AUTHORIZATION_PATH ||
    v17Status.authorization?.sha256 !== V17_AUTHORIZATION_SHA256 ||
    v17Status.authorization?.signingPublicKeySpkiSha256 !==
      V17_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V17_AUTHORIZATION_PATH)) !==
      V17_AUTHORIZATION_SHA256 ||
    v17Status.authorization?.v16AuthorizationReusable !== false ||
    v17Status.smallestHonestDelta?.taughtLeadingSlotSolidPaintFromPayloadOrChild !==
      true ||
    v17Status.smallestHonestDelta?.v16RestoreBytesUnchanged !== true ||
    v17Status.smallestHonestDelta?.v16RuntimeBytesUnchanged !== true ||
    v17Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v17Status.attemptsExecuted !== 1 ||
    v17Status.nextAttempt !== 2 ||
    v17Status.liveExecutionOccurred !== true ||
    v17Status.figmaWrites !== 4 ||
    v17Status.figmaCaptures !== 0 ||
    v17Status.createdNodesThenRemoved !== 2317 ||
    v17Status.attempt1Path !== V17_ATTEMPT_1_PATH ||
    v17Status.attempt1Sha256 !== V17_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V17_ATTEMPT_1_PATH)) !==
      V17_ATTEMPT_1_SHA256 ||
    v17Status.restartAsV17Attempt2WithoutLeadingSlotColorBindingForbidden !==
      true ||
    v17Status.overallInputSuccess !== false
  )
    failures.push("v17 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v17Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v17 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v17-authorization") ||
      artifactPath.includes("input-field-live-v17-preflight") ||
      artifactPath.includes("input-field-live-v17-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v17 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v17Index.artifacts?.["recipe/scene-readback-v17.ts"] ||
    !v17Index.artifacts?.["recipe/scene-readback-runtime-v17.ts"] ||
    !v17Index.artifacts?.["recipe/input-field-live-v3-verifier-v17.ts"] ||
    !v17Index.artifacts?.["recipe/input-field-live-v17-restore.ts"] ||
    !v17Index.artifacts?.[`${V17_ROOT}/programs/restore-blueprint.js`] ||
    !v17Index.artifacts?.[`${V17_ROOT}/programs/writer-payload.js`] ||
    v17Index.artifacts?.["recipe/scene-readback.ts"] ||
    v17Index.artifacts?.["recipe/scene-readback-v16.ts"] ||
    v17Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v17Index.artifacts?.["recipe/input-field-live-v3-verifier-v16.ts"] ||
    v17Index.artifacts?.["recipe/input-field-live-v16-restore.ts"]
  )
    failures.push(
      "v17 must hash carried scene-readback-v17 and leave hashed v16 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/input-field-live-v16-restore.ts")) !==
      V16_RESTORE_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v16.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence(`${V17_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v16.ts")) !==
      v16Index.artifacts?.["recipe/scene-readback-v16.ts"]?.sha256 ||
    sha256(
      readRepositoryEvidence("recipe/input-field-live-v3-verifier-v16.ts"),
    ) !==
      v16Index.artifacts?.["recipe/input-field-live-v3-verifier-v16.ts"]?.sha256
  )
    failures.push(
      "v16 hashed host-path, writer, restore, runtime, or extract bytes restamped while preparing v17",
    );
  if (
    sha256(readRepositoryEvidence(`${V18_ROOT}/protocol.json`)) !==
      V18_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V18_ROOT}/proof-plan.json`)) !==
      V18_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V18_ROOT}/capture-manifest.json`)) !==
      V18_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V18_ROOT}/request-manifest.json`)) !==
      V18_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V18_ROOT}/antecedent-index.json`)) !==
      V18_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V18_ROOT}/authorization-template.json`),
    ) !== V18_AUTHORIZATION_TEMPLATE_SHA256 ||
    v18Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v18.ts" ||
    v18Protocol.hostNormalization?.taughtLeadingSlotColorBindingFromChild !==
      true ||
    v18Protocol.hostNormalization?.v16RestoreBytesUnchanged !== true ||
    v18Protocol.hostNormalization?.v16RuntimeBytesUnchanged !== true ||
    v18Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v18Protocol.execution?.remoteRequests !== 133 ||
    v18Index.hashSetSha256 !== V18_HASH_SET_SHA256 ||
    v18Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v18Status.artifactVersion !== "input-live-v18-status-v1" ||
    v18Status.status !== V18_STATUS ||
    v18Status.baseCommit !== V18_BASE_COMMIT ||
    v18Status.antecedent?.commit !== V18_ANTECEDENT_COMMIT ||
    v18Status.authorization?.present !== true ||
    v18Status.authorization?.commitStateDerivedByHistory !== true ||
    v18Status.authorization?.effective !== false ||
    v18Status.authorization?.path !== V18_AUTHORIZATION_PATH ||
    v18Status.authorization?.sha256 !== V18_AUTHORIZATION_SHA256 ||
    v18Status.authorization?.signingPublicKeySpkiSha256 !==
      V18_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V18_AUTHORIZATION_PATH)) !==
      V18_AUTHORIZATION_SHA256 ||
    v18Status.authorization?.v17AuthorizationReusable !== false ||
    v18Status.smallestHonestDelta?.taughtLeadingSlotColorBindingFromChild !==
      true ||
    v18Status.smallestHonestDelta?.v17SceneReadbackUnchanged !== true ||
    v18Status.smallestHonestDelta?.v16RestoreBytesUnchanged !== true ||
    v18Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v18Status.attemptsExecuted !== 1 ||
    v18Status.nextAttempt !== 2 ||
    v18Status.liveExecutionOccurred !== true ||
    v18Status.figmaWrites !== 4 ||
    v18Status.figmaCaptures !== 0 ||
    v18Status.createdNodesThenRemoved !== 2317 ||
    v18Status.attempt1Path !== V18_ATTEMPT_1_PATH ||
    v18Status.attempt1Sha256 !== V18_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V18_ATTEMPT_1_PATH)) !==
      V18_ATTEMPT_1_SHA256 ||
    v18Status.restartAsV18Attempt2WithoutSurfaceStrokeWeightForbidden !==
      true ||
    v18Status.overallInputSuccess !== false
  )
    failures.push("v18 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v18Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v18 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v18-authorization") ||
      artifactPath.includes("input-field-live-v18-preflight") ||
      artifactPath.includes("input-field-live-v18-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v18 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v18Index.artifacts?.["recipe/scene-readback-v18.ts"] ||
    !v18Index.artifacts?.["recipe/scene-readback-runtime-v18.ts"] ||
    !v18Index.artifacts?.["recipe/input-field-live-v3-verifier-v18.ts"] ||
    !v18Index.artifacts?.["recipe/input-field-live-v18-restore.ts"] ||
    !v18Index.artifacts?.[`${V18_ROOT}/programs/restore-blueprint.js`] ||
    !v18Index.artifacts?.[`${V18_ROOT}/programs/writer-payload.js`] ||
    v18Index.artifacts?.["recipe/scene-readback.ts"] ||
    v18Index.artifacts?.["recipe/scene-readback-v17.ts"] ||
    v18Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v18Index.artifacts?.["recipe/input-field-live-v3-verifier-v17.ts"] ||
    v18Index.artifacts?.["recipe/input-field-live-v17-restore.ts"]
  )
    failures.push(
      "v18 must hash carried scene-readback-v18 and leave hashed v17 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v17.ts")) !==
      V17_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V18_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v18.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`)) !==
      V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v17 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v18",
    );
  if (
    sha256(readRepositoryEvidence(`${V19_ROOT}/protocol.json`)) !==
      V19_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V19_ROOT}/proof-plan.json`)) !==
      V19_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V19_ROOT}/capture-manifest.json`)) !==
      V19_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V19_ROOT}/request-manifest.json`)) !==
      V19_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V19_ROOT}/antecedent-index.json`)) !==
      V19_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V19_ROOT}/authorization-template.json`),
    ) !== V19_AUTHORIZATION_TEMPLATE_SHA256 ||
    v19Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v19.ts" ||
    v19Protocol.hostNormalization
      ?.taughtUniformPerSideStrokeWeightAsStrokes0Weight !== true ||
    v19Protocol.hostNormalization?.v18SceneReadbackUnchanged !== true ||
    v19Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v19Protocol.execution?.remoteRequests !== 133 ||
    v19Index.hashSetSha256 !== V19_HASH_SET_SHA256 ||
    v19Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v19Status.artifactVersion !== "input-live-v19-status-v1" ||
    v19Status.status !== V19_STATUS ||
    v19Status.baseCommit !== V19_BASE_COMMIT ||
    v19Status.antecedent?.commit !== V19_ANTECEDENT_COMMIT ||
    v19Status.authorization?.present !== true ||
    v19Status.authorization?.commitStateDerivedByHistory !== true ||
    v19Status.authorization?.effective !== false ||
    v19Status.authorization?.path !== V19_AUTHORIZATION_PATH ||
    v19Status.authorization?.sha256 !== V19_AUTHORIZATION_SHA256 ||
    v19Status.authorization?.signingPublicKeySpkiSha256 !==
      V19_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V19_AUTHORIZATION_PATH)) !==
      V19_AUTHORIZATION_SHA256 ||
    v19Status.authorization?.v18AuthorizationReusable !== false ||
    v19Status.smallestHonestDelta
      ?.taughtUniformPerSideStrokeWeightAsStrokes0Weight !== true ||
    v19Status.smallestHonestDelta?.v18SceneReadbackUnchanged !== true ||
    v19Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v19Status.attemptsExecuted !== 1 ||
    v19Status.nextAttempt !== 2 ||
    v19Status.liveExecutionOccurred !== true ||
    v19Status.figmaWrites !== 4 ||
    v19Status.figmaCaptures !== 0 ||
    v19Status.createdNodesThenRemoved !== 2317 ||
    v19Status.attempt1Path !== V19_ATTEMPT_1_PATH ||
    v19Status.attempt1Sha256 !== V19_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V19_ATTEMPT_1_PATH)) !==
      V19_ATTEMPT_1_SHA256 ||
    v19Status.restartAsV19Attempt2WithoutVariantLayoutWidthForbidden !==
      true ||
    v19Status.overallInputSuccess !== false
  )
    failures.push("v19 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v19Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v19 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v19-authorization") ||
      artifactPath.includes("input-field-live-v19-preflight") ||
      artifactPath.includes("input-field-live-v19-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v19 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v19Index.artifacts?.["recipe/scene-readback-v19.ts"] ||
    !v19Index.artifacts?.["recipe/scene-readback-runtime-v19.ts"] ||
    !v19Index.artifacts?.["recipe/input-field-live-v3-verifier-v19.ts"] ||
    !v19Index.artifacts?.["recipe/input-field-live-v19-restore.ts"] ||
    !v19Index.artifacts?.[`${V19_ROOT}/programs/restore-blueprint.js`] ||
    !v19Index.artifacts?.[`${V19_ROOT}/programs/writer-payload.js`] ||
    v19Index.artifacts?.["recipe/scene-readback.ts"] ||
    v19Index.artifacts?.["recipe/scene-readback-v18.ts"] ||
    v19Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v19Index.artifacts?.["recipe/input-field-live-v3-verifier-v18.ts"] ||
    v19Index.artifacts?.["recipe/input-field-live-v18-restore.ts"]
  )
    failures.push(
      "v19 must hash carried scene-readback-v19 and leave hashed v18 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v18.ts")) !==
      V18_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V19_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v19.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v18 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v19",
    );
  if (
    sha256(readRepositoryEvidence(`${V20_ROOT}/protocol.json`)) !==
      V20_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V20_ROOT}/proof-plan.json`)) !==
      V20_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V20_ROOT}/capture-manifest.json`)) !==
      V20_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V20_ROOT}/request-manifest.json`)) !==
      V20_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V20_ROOT}/antecedent-index.json`)) !==
      V20_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V20_ROOT}/authorization-template.json`),
    ) !== V20_AUTHORIZATION_TEMPLATE_SHA256 ||
    v20Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v20.ts" ||
    v20Protocol.hostNormalization?.taughtVariantLayoutWidthFromWidthValue !==
      true ||
    v20Protocol.hostNormalization?.v19SceneReadbackUnchanged !== true ||
    v20Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v20Protocol.execution?.remoteRequests !== 133 ||
    v20Index.hashSetSha256 !== V20_HASH_SET_SHA256 ||
    v20Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v20Status.artifactVersion !== "input-live-v20-status-v1" ||
    v20Status.status !== V20_STATUS ||
    v20Status.baseCommit !== V20_BASE_COMMIT ||
    v20Status.antecedent?.commit !== V20_ANTECEDENT_COMMIT ||
    v20Status.authorization?.present !== true ||
    v20Status.authorization?.commitStateDerivedByHistory !== true ||
    v20Status.authorization?.effective !== false ||
    v20Status.authorization?.path !== V20_AUTHORIZATION_PATH ||
    v20Status.authorization?.sha256 !== V20_AUTHORIZATION_SHA256 ||
    v20Status.authorization?.signingPublicKeySpkiSha256 !==
      V20_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V20_AUTHORIZATION_PATH)) !==
      V20_AUTHORIZATION_SHA256 ||
    v20Status.authorization?.v19AuthorizationReusable !== false ||
    v20Status.smallestHonestDelta?.taughtVariantLayoutWidthFromWidthValue !==
      true ||
    v20Status.smallestHonestDelta?.v19SceneReadbackUnchanged !== true ||
    v20Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v20Status.attemptsExecuted !== 1 ||
    v20Status.nextAttempt !== 2 ||
    v20Status.liveExecutionOccurred !== true ||
    v20Status.figmaWrites !== 4 ||
    v20Status.figmaCaptures !== 0 ||
    v20Status.createdNodesThenRemoved !== 2317 ||
    v20Status.attempt1Path !== V20_ATTEMPT_1_PATH ||
    v20Status.attempt1Sha256 !== V20_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V20_ATTEMPT_1_PATH)) !==
      V20_ATTEMPT_1_SHA256 ||
    v20Status.restartAsV20Attempt2WithoutSurfaceLayoutHeightForbidden !==
      true ||
    v20Status.overallInputSuccess !== false
  )
    failures.push("v20 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v20Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v20 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v20-authorization") ||
      artifactPath.includes("input-field-live-v20-preflight") ||
      artifactPath.includes("input-field-live-v20-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v20 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v20Index.artifacts?.["recipe/scene-readback-v20.ts"] ||
    !v20Index.artifacts?.["recipe/scene-readback-runtime-v20.ts"] ||
    !v20Index.artifacts?.["recipe/input-field-live-v3-verifier-v20.ts"] ||
    !v20Index.artifacts?.["recipe/input-field-live-v20-restore.ts"] ||
    !v20Index.artifacts?.[`${V20_ROOT}/programs/restore-blueprint.js`] ||
    !v20Index.artifacts?.[`${V20_ROOT}/programs/writer-payload.js`] ||
    v20Index.artifacts?.["recipe/scene-readback.ts"] ||
    v20Index.artifacts?.["recipe/scene-readback-v19.ts"] ||
    v20Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v20Index.artifacts?.["recipe/input-field-live-v3-verifier-v19.ts"] ||
    v20Index.artifacts?.["recipe/input-field-live-v19-restore.ts"]
  )
    failures.push(
      "v20 must hash carried scene-readback-v20 and leave hashed v19 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v19.ts")) !==
      V19_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v18.ts")) !==
      V18_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V20_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v20.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v19 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v20",
    );
  if (
    sha256(readRepositoryEvidence(`${V21_ROOT}/protocol.json`)) !==
      V21_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V21_ROOT}/proof-plan.json`)) !==
      V21_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V21_ROOT}/capture-manifest.json`)) !==
      V21_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V21_ROOT}/request-manifest.json`)) !==
      V21_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V21_ROOT}/antecedent-index.json`)) !==
      V21_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V21_ROOT}/authorization-template.json`),
    ) !== V21_AUTHORIZATION_TEMPLATE_SHA256 ||
    v21Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v21.ts" ||
    v21Protocol.hostNormalization?.taughtSurfaceLayoutHeightFromHeightValue !==
      true ||
    v21Protocol.hostNormalization?.v20SceneReadbackUnchanged !== true ||
    v21Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v21Protocol.execution?.remoteRequests !== 133 ||
    v21Index.hashSetSha256 !== V21_HASH_SET_SHA256 ||
    v21Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v21Status.artifactVersion !== "input-live-v21-status-v1" ||
    v21Status.status !== V21_STATUS ||
    v21Status.baseCommit !== V21_BASE_COMMIT ||
    v21Status.antecedent?.commit !== V21_ANTECEDENT_COMMIT ||
    v21Status.authorization?.present !== true ||
    v21Status.authorization?.commitStateDerivedByHistory !== true ||
    v21Status.authorization?.effective !== false ||
    v21Status.authorization?.path !== V21_AUTHORIZATION_PATH ||
    v21Status.authorization?.sha256 !== V21_AUTHORIZATION_SHA256 ||
    v21Status.authorization?.signingPublicKeySpkiSha256 !==
      V21_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V21_AUTHORIZATION_PATH)) !==
      V21_AUTHORIZATION_SHA256 ||
    v21Status.authorization?.v20AuthorizationReusable !== false ||
    v21Status.smallestHonestDelta?.taughtSurfaceLayoutHeightFromHeightValue !==
      true ||
    v21Status.smallestHonestDelta?.v20SceneReadbackUnchanged !== true ||
    v21Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v21Status.attemptsExecuted !== 1 ||
    v21Status.nextAttempt !== 2 ||
    v21Status.liveExecutionOccurred !== true ||
    v21Status.figmaWrites !== 4 ||
    v21Status.figmaCaptures !== 0 ||
    v21Status.createdNodesThenRemoved !== 2317 ||
    v21Status.attempt1Path !== V21_ATTEMPT_1_PATH ||
    v21Status.attempt1Sha256 !== V21_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V21_ATTEMPT_1_PATH)) !==
      V21_ATTEMPT_1_SHA256 ||
    v21Status.restartAsV21Attempt2WithoutVariantBindingsLengthForbidden !==
      true ||
    v21Status.overallInputSuccess !== false
  )
    failures.push("v21 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v21Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v21 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v21-authorization") ||
      artifactPath.includes("input-field-live-v21-preflight") ||
      artifactPath.includes("input-field-live-v21-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v21 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v21Index.artifacts?.["recipe/scene-readback-v21.ts"] ||
    !v21Index.artifacts?.["recipe/scene-readback-runtime-v21.ts"] ||
    !v21Index.artifacts?.["recipe/input-field-live-v3-verifier-v21.ts"] ||
    !v21Index.artifacts?.["recipe/input-field-live-v21-restore.ts"] ||
    !v21Index.artifacts?.[`${V21_ROOT}/programs/restore-blueprint.js`] ||
    !v21Index.artifacts?.[`${V21_ROOT}/programs/writer-payload.js`] ||
    v21Index.artifacts?.["recipe/scene-readback.ts"] ||
    v21Index.artifacts?.["recipe/scene-readback-v20.ts"] ||
    v21Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v21Index.artifacts?.["recipe/input-field-live-v3-verifier-v20.ts"] ||
    v21Index.artifacts?.["recipe/input-field-live-v20-restore.ts"]
  )
    failures.push(
      "v21 must hash carried scene-readback-v21 and leave hashed v20 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v20.ts")) !==
      V20_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v19.ts")) !==
      V19_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v18.ts")) !==
      V18_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V21_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v21.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v20 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v21",
    );
  if (
    sha256(readRepositoryEvidence(`${V22_ROOT}/protocol.json`)) !==
      V22_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V22_ROOT}/proof-plan.json`)) !==
      V22_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V22_ROOT}/capture-manifest.json`)) !==
      V22_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V22_ROOT}/request-manifest.json`)) !==
      V22_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V22_ROOT}/antecedent-index.json`)) !==
      V22_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V22_ROOT}/authorization-template.json`),
    ) !== V22_AUTHORIZATION_TEMPLATE_SHA256 ||
    v22Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v22.ts" ||
    v22Protocol.hostNormalization?.taughtLayoutBindingAliasWithoutSourceField !==
      true ||
    v22Protocol.hostNormalization?.v21SceneReadbackUnchanged !== true ||
    v22Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v22Protocol.execution?.remoteRequests !== 133 ||
    v22Index.hashSetSha256 !== V22_HASH_SET_SHA256 ||
    v22Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v22Status.artifactVersion !== "input-live-v22-status-v1" ||
    v22Status.status !== V22_STATUS ||
    v22Status.baseCommit !== V22_BASE_COMMIT ||
    v22Status.antecedent?.commit !== V22_ANTECEDENT_COMMIT ||
    v22Status.authorization?.present !== true ||
    v22Status.authorization?.commitStateDerivedByHistory !== true ||
    v22Status.authorization?.effective !== false ||
    v22Status.authorization?.path !== V22_AUTHORIZATION_PATH ||
    v22Status.authorization?.sha256 !== V22_AUTHORIZATION_SHA256 ||
    v22Status.authorization?.signingPublicKeySpkiSha256 !==
      V22_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V22_AUTHORIZATION_PATH)) !==
      V22_AUTHORIZATION_SHA256 ||
    v22Status.authorization?.v21AuthorizationReusable !== false ||
    v22Status.smallestHonestDelta?.taughtLayoutBindingAliasWithoutSourceField !==
      true ||
    v22Status.smallestHonestDelta?.v21SceneReadbackUnchanged !== true ||
    v22Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v22Status.attemptsExecuted !== 1 ||
    v22Status.nextAttempt !== 2 ||
    v22Status.liveExecutionOccurred !== true ||
    v22Status.figmaWrites !== 4 ||
    v22Status.figmaCaptures !== 0 ||
    v22Status.createdNodesThenRemoved !== 2317 ||
    v22Status.attempt1Path !== V22_ATTEMPT_1_PATH ||
    v22Status.attempt1Sha256 !== V22_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V22_ATTEMPT_1_PATH)) !==
      V22_ATTEMPT_1_SHA256 ||
    v22Status.restartAsV22Attempt2WithoutVariantBindingsFieldForbidden !==
      true ||
    v22Status.overallInputSuccess !== false
  )
    failures.push("v22 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v22Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v22 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v22-authorization") ||
      artifactPath.includes("input-field-live-v22-preflight") ||
      artifactPath.includes("input-field-live-v22-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v22 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v22Index.artifacts?.["recipe/scene-readback-v22.ts"] ||
    !v22Index.artifacts?.["recipe/scene-readback-runtime-v22.ts"] ||
    !v22Index.artifacts?.["recipe/input-field-live-v3-verifier-v22.ts"] ||
    !v22Index.artifacts?.["recipe/input-field-live-v22-restore.ts"] ||
    !v22Index.artifacts?.[`${V22_ROOT}/programs/restore-blueprint.js`] ||
    !v22Index.artifacts?.[`${V22_ROOT}/programs/writer-payload.js`] ||
    v22Index.artifacts?.["recipe/scene-readback.ts"] ||
    v22Index.artifacts?.["recipe/scene-readback-v21.ts"] ||
    v22Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v22Index.artifacts?.["recipe/input-field-live-v3-verifier-v21.ts"] ||
    v22Index.artifacts?.["recipe/input-field-live-v21-restore.ts"]
  )
    failures.push(
      "v22 must hash carried scene-readback-v22 and leave hashed v21 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v21.ts")) !==
      V21_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v20.ts")) !==
      V20_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v19.ts")) !==
      V19_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v18.ts")) !==
      V18_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V22_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v22.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v21 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v22",
    );
  if (
    sha256(readRepositoryEvidence(`${V23_ROOT}/protocol.json`)) !==
      V23_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V23_ROOT}/proof-plan.json`)) !==
      V23_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V23_ROOT}/capture-manifest.json`)) !==
      V23_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V23_ROOT}/request-manifest.json`)) !==
      V23_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V23_ROOT}/antecedent-index.json`)) !==
      V23_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V23_ROOT}/authorization-template.json`),
    ) !== V23_AUTHORIZATION_TEMPLATE_SHA256 ||
    v23Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v23.ts" ||
    v23Protocol.hostNormalization?.taughtLayoutBindingAliasCompileIndex !==
      true ||
    v23Protocol.hostNormalization?.v22SceneReadbackUnchanged !== true ||
    v23Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v23Protocol.execution?.remoteRequests !== 133 ||
    v23Index.hashSetSha256 !== V23_HASH_SET_SHA256 ||
    v23Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v23Status.artifactVersion !== "input-live-v23-status-v1" ||
    v23Status.status !== V23_STATUS ||
    v23Status.baseCommit !== V23_BASE_COMMIT ||
    v23Status.antecedent?.commit !== V23_ANTECEDENT_COMMIT ||
    v23Status.authorization?.present !== true ||
    v23Status.authorization?.commitStateDerivedByHistory !== true ||
    v23Status.authorization?.effective !== false ||
    v23Status.authorization?.path !== V23_AUTHORIZATION_PATH ||
    v23Status.authorization?.sha256 !== V23_AUTHORIZATION_SHA256 ||
    v23Status.authorization?.signingPublicKeySpkiSha256 !==
      V23_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V23_AUTHORIZATION_PATH)) !==
      V23_AUTHORIZATION_SHA256 ||
    v23Status.authorization?.v22AuthorizationReusable !== false ||
    v23Status.smallestHonestDelta?.taughtLayoutBindingAliasCompileIndex !==
      true ||
    v23Status.smallestHonestDelta?.v22SceneReadbackUnchanged !== true ||
    v23Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v23Status.attemptsExecuted !== 1 ||
    v23Status.nextAttempt !== 2 ||
    v23Status.liveExecutionOccurred !== true ||
    v23Status.figmaWrites !== 4 ||
    v23Status.figmaCaptures !== 0 ||
    v23Status.createdNodesThenRemoved !== 2317 ||
    v23Status.attempt1Path !== V23_ATTEMPT_1_PATH ||
    v23Status.attempt1Sha256 !== V23_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V23_ATTEMPT_1_PATH)) !==
      V23_ATTEMPT_1_SHA256 ||
    v23Status.restartAsV23Attempt2WithoutSurfaceBindingsLengthForbidden !==
      true ||
    v23Status.overallInputSuccess !== false
  )
    failures.push("v23 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v23Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v23 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v23-authorization") ||
      artifactPath.includes("input-field-live-v23-preflight") ||
      artifactPath.includes("input-field-live-v23-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v23 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v23Index.artifacts?.["recipe/scene-readback-v23.ts"] ||
    !v23Index.artifacts?.["recipe/scene-readback-runtime-v23.ts"] ||
    !v23Index.artifacts?.["recipe/input-field-live-v3-verifier-v23.ts"] ||
    !v23Index.artifacts?.["recipe/input-field-live-v23-restore.ts"] ||
    !v23Index.artifacts?.[`${V23_ROOT}/programs/restore-blueprint.js`] ||
    !v23Index.artifacts?.[`${V23_ROOT}/programs/writer-payload.js`] ||
    v23Index.artifacts?.["recipe/scene-readback.ts"] ||
    v23Index.artifacts?.["recipe/scene-readback-v22.ts"] ||
    v23Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v23Index.artifacts?.["recipe/input-field-live-v3-verifier-v22.ts"] ||
    v23Index.artifacts?.["recipe/input-field-live-v22-restore.ts"]
  )
    failures.push(
      "v23 must hash carried scene-readback-v23 and leave hashed v22 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v22.ts")) !==
      V22_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v21.ts")) !==
      V21_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v20.ts")) !==
      V20_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v19.ts")) !==
      V19_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v18.ts")) !==
      V18_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V23_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v23.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v22 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v23",
    );
  if (
    sha256(readRepositoryEvidence(`${V24_ROOT}/protocol.json`)) !==
      V24_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V24_ROOT}/proof-plan.json`)) !==
      V24_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V24_ROOT}/capture-manifest.json`)) !==
      V24_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V24_ROOT}/request-manifest.json`)) !==
      V24_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V24_ROOT}/antecedent-index.json`)) !==
      V24_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V24_ROOT}/authorization-template.json`),
    ) !== V24_AUTHORIZATION_TEMPLATE_SHA256 ||
    v24Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v24.ts" ||
    v24Protocol.hostNormalization?.taughtSurfaceBindingExtrasDropped !==
      true ||
    v24Protocol.hostNormalization?.v23SceneReadbackUnchanged !== true ||
    v24Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v24Protocol.execution?.remoteRequests !== 133 ||
    v24Index.hashSetSha256 !== V24_HASH_SET_SHA256 ||
    v24Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v24Status.artifactVersion !== "input-live-v24-status-v1" ||
    v24Status.status !== V24_STATUS ||
    v24Status.baseCommit !== V24_BASE_COMMIT ||
    v24Status.antecedent?.commit !== V24_ANTECEDENT_COMMIT ||
    v24Status.authorization?.present !== true ||
    v24Status.authorization?.commitStateDerivedByHistory !== true ||
    v24Status.authorization?.effective !== false ||
    v24Status.authorization?.path !== V24_AUTHORIZATION_PATH ||
    v24Status.authorization?.sha256 !== V24_AUTHORIZATION_SHA256 ||
    v24Status.authorization?.signingPublicKeySpkiSha256 !==
      V24_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V24_AUTHORIZATION_PATH)) !==
      V24_AUTHORIZATION_SHA256 ||
    v24Status.authorization?.v23AuthorizationReusable !== false ||
    v24Status.smallestHonestDelta?.taughtSurfaceBindingExtrasDropped !==
      true ||
    v24Status.smallestHonestDelta?.v23SceneReadbackUnchanged !== true ||
    v24Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v24Status.attemptsExecuted !== 1 ||
    v24Status.nextAttempt !== 2 ||
    v24Status.liveExecutionOccurred !== true ||
    v24Status.figmaWrites !== 4 ||
    v24Status.figmaCaptures !== 0 ||
    v24Status.createdNodesThenRemoved !== 2317 ||
    v24Status.attempt1Path !== V24_ATTEMPT_1_PATH ||
    v24Status.attempt1Sha256 !== V24_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V24_ATTEMPT_1_PATH)) !==
      V24_ATTEMPT_1_SHA256 ||
    v24Status.restartAsV24Attempt2WithoutSurfaceBindingsFieldForbidden !==
      true ||
    v24Status.overallInputSuccess !== false
  )
    failures.push("v24 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v24Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v24 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v24-authorization") ||
      artifactPath.includes("input-field-live-v24-preflight") ||
      artifactPath.includes("input-field-live-v24-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v24 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v24Index.artifacts?.["recipe/scene-readback-v24.ts"] ||
    !v24Index.artifacts?.["recipe/scene-readback-runtime-v24.ts"] ||
    !v24Index.artifacts?.["recipe/input-field-live-v3-verifier-v24.ts"] ||
    !v24Index.artifacts?.["recipe/input-field-live-v24-restore.ts"] ||
    !v24Index.artifacts?.[`${V24_ROOT}/programs/restore-blueprint.js`] ||
    !v24Index.artifacts?.[`${V24_ROOT}/programs/writer-payload.js`] ||
    v24Index.artifacts?.["recipe/scene-readback.ts"] ||
    v24Index.artifacts?.["recipe/scene-readback-v23.ts"] ||
    v24Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v24Index.artifacts?.["recipe/input-field-live-v3-verifier-v23.ts"] ||
    v24Index.artifacts?.["recipe/input-field-live-v23-restore.ts"]
  )
    failures.push(
      "v24 must hash carried scene-readback-v24 and leave hashed v23 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v23.ts")) !==
      V23_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v22.ts")) !==
      V22_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v21.ts")) !==
      V21_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v20.ts")) !==
      V20_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v19.ts")) !==
      V19_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V24_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v24.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v23 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v24",
    );
  if (
    sha256(readRepositoryEvidence(`${V25_ROOT}/protocol.json`)) !==
      V25_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V25_ROOT}/proof-plan.json`)) !==
      V25_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V25_ROOT}/capture-manifest.json`)) !==
      V25_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V25_ROOT}/request-manifest.json`)) !==
      V25_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V25_ROOT}/antecedent-index.json`)) !==
      V25_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V25_ROOT}/authorization-template.json`),
    ) !== V25_AUTHORIZATION_TEMPLATE_SHA256 ||
    v25Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v25.ts" ||
    v25Protocol.hostNormalization?.taughtSurfaceBindingCompileOrder !==
      true ||
    v25Protocol.hostNormalization?.taughtSurfaceBindingExtrasDropped !==
      true ||
    v25Protocol.hostNormalization?.v24SceneReadbackUnchanged !== true ||
    v25Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v25Protocol.execution?.remoteRequests !== 133 ||
    v25Index.hashSetSha256 !== V25_HASH_SET_SHA256 ||
    v25Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v25Status.artifactVersion !== "input-live-v25-status-v1" ||
    v25Status.status !== V25_STATUS ||
    v25Status.baseCommit !== V25_BASE_COMMIT ||
    v25Status.antecedent?.commit !== V25_ANTECEDENT_COMMIT ||
    v25Status.authorization?.present !== true ||
    v25Status.authorization?.commitStateDerivedByHistory !== true ||
    v25Status.authorization?.effective !== false ||
    v25Status.authorization?.path !== V25_AUTHORIZATION_PATH ||
    v25Status.authorization?.sha256 !== V25_AUTHORIZATION_SHA256 ||
    v25Status.authorization?.signingPublicKeySpkiSha256 !==
      V25_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V25_AUTHORIZATION_PATH)) !==
      V25_AUTHORIZATION_SHA256 ||
    v25Status.authorization?.v24AuthorizationReusable !== false ||
    v25Status.smallestHonestDelta?.taughtSurfaceBindingCompileOrder !==
      true ||
    v25Status.smallestHonestDelta?.taughtSurfaceBindingExtrasDropped !==
      true ||
    v25Status.smallestHonestDelta?.v24SceneReadbackUnchanged !== true ||
    v25Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v25Status.attemptsExecuted !== 1 ||
    v25Status.nextAttempt !== 2 ||
    v25Status.liveExecutionOccurred !== true ||
    v25Status.figmaWrites !== 4 ||
    v25Status.figmaCaptures !== 0 ||
    v25Status.createdNodesThenRemoved !== 2317 ||
    v25Status.attempt1Path !== V25_ATTEMPT_1_PATH ||
    v25Status.attempt1Sha256 !== V25_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V25_ATTEMPT_1_PATH)) !==
      V25_ATTEMPT_1_SHA256 ||
    v25Status.restartAsV25Attempt2WithoutContentPlaceholderBindingsFieldForbidden !==
      true ||
    v25Status.overallInputSuccess !== false
  )
    failures.push("v25 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v25Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v25 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v25-authorization") ||
      artifactPath.includes("input-field-live-v25-preflight") ||
      artifactPath.includes("input-field-live-v25-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v25 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v25Index.artifacts?.["recipe/scene-readback-v25.ts"] ||
    !v25Index.artifacts?.["recipe/scene-readback-runtime-v25.ts"] ||
    !v25Index.artifacts?.["recipe/input-field-live-v3-verifier-v25.ts"] ||
    !v25Index.artifacts?.["recipe/input-field-live-v25-restore.ts"] ||
    !v25Index.artifacts?.[`${V25_ROOT}/programs/restore-blueprint.js`] ||
    !v25Index.artifacts?.[`${V25_ROOT}/programs/writer-payload.js`] ||
    v25Index.artifacts?.["recipe/scene-readback.ts"] ||
    v25Index.artifacts?.["recipe/scene-readback-v24.ts"] ||
    v25Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v25Index.artifacts?.["recipe/input-field-live-v3-verifier-v24.ts"] ||
    v25Index.artifacts?.["recipe/input-field-live-v24-restore.ts"]
  )
    failures.push(
      "v25 must hash carried scene-readback-v25 and leave hashed v24 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v24.ts")) !==
      V24_SCENE_READBACK_SHA256_PIN ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v23.ts")) !==
      V23_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v22.ts")) !==
      V22_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v21.ts")) !==
      V21_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v20.ts")) !==
      V20_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v19.ts")) !==
      V19_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V25_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v25.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v24 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v25",
    );
  if (
    sha256(readRepositoryEvidence(`${V26_ROOT}/protocol.json`)) !==
      V26_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V26_ROOT}/proof-plan.json`)) !==
      V26_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V26_ROOT}/capture-manifest.json`)) !==
      V26_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V26_ROOT}/request-manifest.json`)) !==
      V26_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V26_ROOT}/antecedent-index.json`)) !==
      V26_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V26_ROOT}/authorization-template.json`),
    ) !== V26_AUTHORIZATION_TEMPLATE_SHA256 ||
    v26Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v26.ts" ||
    v26Protocol.hostNormalization?.taughtContentBindingCompileOrder !==
      true ||
    v26Protocol.hostNormalization?.taughtContentBindingExtrasDropped !==
      true ||
    v26Protocol.hostNormalization?.taughtSurfaceBindingCompileOrder !==
      true ||
    v26Protocol.hostNormalization?.v25SceneReadbackUnchanged !== true ||
    v26Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v26Protocol.execution?.remoteRequests !== 133 ||
    v26Index.hashSetSha256 !== V26_HASH_SET_SHA256 ||
    v26Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v26Status.artifactVersion !== "input-live-v26-status-v1" ||
    v26Status.status !== V26_STATUS ||
    v26Status.baseCommit !== V26_BASE_COMMIT ||
    v26Status.antecedent?.commit !== V26_ANTECEDENT_COMMIT ||
    v26Status.authorization?.present !== true ||
    v26Status.authorization?.commitStateDerivedByHistory !== true ||
    v26Status.authorization?.effective !== false ||
    v26Status.authorization?.path !== V26_AUTHORIZATION_PATH ||
    v26Status.authorization?.sha256 !== V26_AUTHORIZATION_SHA256 ||
    v26Status.authorization?.signingPublicKeySpkiSha256 !==
      V26_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V26_AUTHORIZATION_PATH)) !==
      V26_AUTHORIZATION_SHA256 ||
    v26Status.authorization?.v25AuthorizationReusable !== false ||
    v26Status.smallestHonestDelta?.taughtContentBindingCompileOrder !==
      true ||
    v26Status.smallestHonestDelta?.taughtContentBindingExtrasDropped !==
      true ||
    v26Status.smallestHonestDelta?.v25SceneReadbackUnchanged !== true ||
    v26Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v26Status.attemptsExecuted !== 1 ||
    v26Status.nextAttempt !== 2 ||
    v26Status.liveExecutionOccurred !== true ||
    v26Status.figmaWrites !== 4 ||
    v26Status.figmaCaptures !== 0 ||
    v26Status.createdNodesThenRemoved !== 2317 ||
    v26Status.attempt1Path !== V26_ATTEMPT_1_PATH ||
    v26Status.attempt1Sha256 !== V26_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V26_ATTEMPT_1_PATH)) !==
      V26_ATTEMPT_1_SHA256 ||
    v26Status.restartAsV26Attempt2WithoutContentPlaceholderHeightModeForbidden !==
      true ||
    v26Status.overallInputSuccess !== false
  )
    failures.push("v26 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V27_ROOT}/protocol.json`)) !==
      V27_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V27_ROOT}/proof-plan.json`)) !==
      V27_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V27_ROOT}/capture-manifest.json`)) !==
      V27_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V27_ROOT}/request-manifest.json`)) !==
      V27_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V27_ROOT}/antecedent-index.json`)) !==
      V27_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V27_ROOT}/authorization-template.json`),
    ) !== V27_AUTHORIZATION_TEMPLATE_SHA256 ||
    v27Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v27.ts" ||
    v27Protocol.hostNormalization?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v27Protocol.hostNormalization?.taughtContentBindingCompileOrder !==
      true ||
    v27Protocol.hostNormalization?.v26SceneReadbackUnchanged !== true ||
    v27Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v27Protocol.execution?.remoteRequests !== 133 ||
    v27Index.hashSetSha256 !== V27_HASH_SET_SHA256 ||
    v27Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v27Status.artifactVersion !== "input-live-v27-status-v1" ||
    v27Status.status !== V27_STATUS ||
    v27Status.baseCommit !== V27_BASE_COMMIT ||
    v27Status.antecedent?.commit !== V27_ANTECEDENT_COMMIT ||
    v27Status.authorization?.present !== true ||
    v27Status.authorization?.commitStateDerivedByHistory !== true ||
    v27Status.authorization?.effective !== false ||
    v27Status.authorization?.path !== V27_AUTHORIZATION_PATH ||
    v27Status.authorization?.sha256 !== V27_AUTHORIZATION_SHA256 ||
    v27Status.authorization?.signingPublicKeySpkiSha256 !==
      V27_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V27_AUTHORIZATION_PATH)) !==
      V27_AUTHORIZATION_SHA256 ||
    v27Status.authorization?.v26AuthorizationReusable !== false ||
    v27Status.smallestHonestDelta?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v27Status.smallestHonestDelta?.taughtContentBindingCompileOrder !==
      true ||
    v27Status.smallestHonestDelta?.v26SceneReadbackUnchanged !== true ||
    v27Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v27Status.attemptsExecuted !== 1 ||
    v27Status.nextAttempt !== 2 ||
    v27Status.liveExecutionOccurred !== true ||
    v27Status.figmaWrites !== 4 ||
    v27Status.figmaCaptures !== 0 ||
    v27Status.createdNodesThenRemoved !== 2317 ||
    v27Status.attempt1Path !== V27_ATTEMPT_1_PATH ||
    v27Status.attempt1Sha256 !== V27_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V27_ATTEMPT_1_PATH)) !==
      V27_ATTEMPT_1_SHA256 ||
    v27Status.restartAsV27Attempt2WithoutContentPlaceholderLetterSpacingForbidden !==
      true ||
    v27Status.overallInputSuccess !== false
  )
    failures.push("v27 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V28_ROOT}/protocol.json`)) !==
      V28_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V28_ROOT}/proof-plan.json`)) !==
      V28_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V28_ROOT}/capture-manifest.json`)) !==
      V28_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V28_ROOT}/request-manifest.json`)) !==
      V28_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V28_ROOT}/antecedent-index.json`)) !==
      V28_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V28_ROOT}/authorization-template.json`),
    ) !== V28_AUTHORIZATION_TEMPLATE_SHA256 ||
    v28Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v28.ts" ||
    v28Protocol.hostNormalization?.taughtContentLetterSpacingOmitted !==
      true ||
    v28Protocol.hostNormalization?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v28Protocol.hostNormalization?.v27SceneReadbackUnchanged !== true ||
    v28Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v28Protocol.execution?.remoteRequests !== 133 ||
    v28Index.hashSetSha256 !== V28_HASH_SET_SHA256 ||
    v28Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v28Status.artifactVersion !== "input-live-v28-status-v1" ||
    v28Status.status !== V28_STATUS ||
    v28Status.baseCommit !== V28_BASE_COMMIT ||
    v28Status.antecedent?.commit !== V28_ANTECEDENT_COMMIT ||
    v28Status.authorization?.present !== true ||
    v28Status.authorization?.commitStateDerivedByHistory !== true ||
    v28Status.authorization?.effective !== false ||
    v28Status.authorization?.path !== V28_AUTHORIZATION_PATH ||
    v28Status.authorization?.sha256 !== V28_AUTHORIZATION_SHA256 ||
    v28Status.authorization?.signingPublicKeySpkiSha256 !==
      V28_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V28_AUTHORIZATION_PATH)) !==
      V28_AUTHORIZATION_SHA256 ||
    v28Status.authorization?.v27AuthorizationReusable !== false ||
    v28Status.smallestHonestDelta?.taughtContentLetterSpacingOmitted !==
      true ||
    v28Status.smallestHonestDelta?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v28Status.smallestHonestDelta?.v27SceneReadbackUnchanged !== true ||
    v28Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v28Status.attemptsExecuted !== 1 ||
    v28Status.nextAttempt !== 2 ||
    v28Status.liveExecutionOccurred !== true ||
    v28Status.figmaWrites !== 4 ||
    v28Status.figmaCaptures !== 0 ||
    v28Status.createdNodesThenRemoved !== 2317 ||
    v28Status.attempt1Path !== V28_ATTEMPT_1_PATH ||
    v28Status.attempt1Sha256 !== V28_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V28_ATTEMPT_1_PATH)) !==
      V28_ATTEMPT_1_SHA256 ||
    v28Status.restartAsV28Attempt2WithoutContentPlaceholderTextCaseForbidden !==
      true ||
    v28Status.overallInputSuccess !== false
  )
    failures.push("v28 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V29_ROOT}/protocol.json`)) !==
      V29_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V29_ROOT}/proof-plan.json`)) !==
      V29_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V29_ROOT}/capture-manifest.json`)) !==
      V29_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V29_ROOT}/request-manifest.json`)) !==
      V29_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V29_ROOT}/antecedent-index.json`)) !==
      V29_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V29_ROOT}/authorization-template.json`),
    ) !== V29_AUTHORIZATION_TEMPLATE_SHA256 ||
    v29Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v29.ts" ||
    v29Protocol.hostNormalization?.taughtContentTextCaseOmitted !== true ||
    v29Protocol.hostNormalization?.taughtContentLetterSpacingOmitted !==
      true ||
    v29Protocol.hostNormalization?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v29Protocol.hostNormalization?.v28SceneReadbackUnchanged !== true ||
    v29Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v29Protocol.execution?.remoteRequests !== 133 ||
    v29Index.hashSetSha256 !== V29_HASH_SET_SHA256 ||
    v29Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v29Status.artifactVersion !== "input-live-v29-status-v1" ||
    v29Status.status !== V29_STATUS ||
    v29Status.baseCommit !== V29_BASE_COMMIT ||
    v29Status.antecedent?.commit !== V29_ANTECEDENT_COMMIT ||
    v29Status.authorization?.present !== true ||
    v29Status.authorization?.commitStateDerivedByHistory !== true ||
    v29Status.authorization?.effective !== false ||
    v29Status.authorization?.path !== V29_AUTHORIZATION_PATH ||
    v29Status.authorization?.sha256 !== V29_AUTHORIZATION_SHA256 ||
    v29Status.authorization?.signingPublicKeySpkiSha256 !==
      V29_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V29_AUTHORIZATION_PATH)) !==
      V29_AUTHORIZATION_SHA256 ||
    v29Status.authorization?.v28AuthorizationReusable !== false ||
    v29Status.smallestHonestDelta?.taughtContentTextCaseOmitted !== true ||
    v29Status.smallestHonestDelta?.taughtContentLetterSpacingOmitted !==
      true ||
    v29Status.smallestHonestDelta?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v29Status.smallestHonestDelta?.v28SceneReadbackUnchanged !== true ||
    v29Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v29Status.attemptsExecuted !== 1 ||
    v29Status.nextAttempt !== 2 ||
    v29Status.liveExecutionOccurred !== true ||
    v29Status.figmaWrites !== 4 ||
    v29Status.figmaCaptures !== 0 ||
    v29Status.createdNodesThenRemoved !== 2317 ||
    v29Status.attempt1Path !== V29_ATTEMPT_1_PATH ||
    v29Status.attempt1Sha256 !== V29_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V29_ATTEMPT_1_PATH)) !==
      V29_ATTEMPT_1_SHA256 ||
    v29Status.restartAsV29Attempt2WithoutContentPlaceholderTextDecorationForbidden !==
      true ||
    v29Status.overallInputSuccess !== false
  )
    failures.push("v29 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V30_ROOT}/protocol.json`)) !==
      V30_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V30_ROOT}/proof-plan.json`)) !==
      V30_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V30_ROOT}/capture-manifest.json`)) !==
      V30_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V30_ROOT}/request-manifest.json`)) !==
      V30_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V30_ROOT}/antecedent-index.json`)) !==
      V30_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V30_ROOT}/authorization-template.json`),
    ) !== V30_AUTHORIZATION_TEMPLATE_SHA256 ||
    v30Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v30.ts" ||
    v30Protocol.hostNormalization?.taughtContentTextDecorationOmitted !==
      true ||
    v30Protocol.hostNormalization?.taughtContentTextCaseOmitted !== true ||
    v30Protocol.hostNormalization?.taughtContentLetterSpacingOmitted !==
      true ||
    v30Protocol.hostNormalization?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v30Protocol.hostNormalization?.v29SceneReadbackUnchanged !== true ||
    v30Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v30Protocol.execution?.remoteRequests !== 133 ||
    v30Index.hashSetSha256 !== V30_HASH_SET_SHA256 ||
    v30Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v30Status.artifactVersion !== "input-live-v30-status-v1" ||
    v30Status.status !== V30_STATUS ||
    v30Status.baseCommit !== V30_BASE_COMMIT ||
    v30Status.antecedent?.commit !== V30_ANTECEDENT_COMMIT ||
    v30Status.authorization?.present !== true ||
    v30Status.authorization?.commitStateDerivedByHistory !== true ||
    v30Status.authorization?.effective !== false ||
    v30Status.authorization?.path !== V30_AUTHORIZATION_PATH ||
    v30Status.authorization?.sha256 !== V30_AUTHORIZATION_SHA256 ||
    v30Status.authorization?.signingPublicKeySpkiSha256 !==
      V30_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V30_AUTHORIZATION_PATH)) !==
      V30_AUTHORIZATION_SHA256 ||
    v30Status.authorization?.v29AuthorizationReusable !== false ||
    v30Status.smallestHonestDelta?.taughtContentTextDecorationOmitted !==
      true ||
    v30Status.smallestHonestDelta?.taughtContentTextCaseOmitted !== true ||
    v30Status.smallestHonestDelta?.taughtContentLetterSpacingOmitted !==
      true ||
    v30Status.smallestHonestDelta?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v30Status.smallestHonestDelta?.v29SceneReadbackUnchanged !== true ||
    v30Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v30Status.attemptsExecuted !== 1 ||
    v30Status.nextAttempt !== 2 ||
    v30Status.liveExecutionOccurred !== true ||
    v30Status.figmaWrites !== 4 ||
    v30Status.figmaCaptures !== 0 ||
    v30Status.createdNodesThenRemoved !== 2317 ||
    v30Status.attempt1Path !== V30_ATTEMPT_1_PATH ||
    v30Status.attempt1Sha256 !== V30_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V30_ATTEMPT_1_PATH)) !==
      V30_ATTEMPT_1_SHA256 ||
    v30Status.restartAsV30Attempt2WithoutContentRowClipsContentForbidden !==
      true ||
    v30Status.overallInputSuccess !== false
  )
    failures.push("v30 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V31_ROOT}/protocol.json`)) !==
      V31_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V31_ROOT}/proof-plan.json`)) !==
      V31_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V31_ROOT}/capture-manifest.json`)) !==
      V31_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V31_ROOT}/request-manifest.json`)) !==
      V31_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V31_ROOT}/antecedent-index.json`)) !==
      V31_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V31_ROOT}/authorization-template.json`),
    ) !== V31_AUTHORIZATION_TEMPLATE_SHA256 ||
    v31Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v31.ts" ||
    v31Protocol.hostNormalization?.taughtContentRowClipsContentOmitted !==
      true ||
    v31Protocol.hostNormalization?.taughtContentTextDecorationOmitted !==
      true ||
    v31Protocol.hostNormalization?.taughtContentTextCaseOmitted !== true ||
    v31Protocol.hostNormalization?.taughtContentLetterSpacingOmitted !==
      true ||
    v31Protocol.hostNormalization?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v31Protocol.hostNormalization?.v30SceneReadbackUnchanged !== true ||
    v31Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v31Protocol.execution?.remoteRequests !== 133 ||
    v31Index.hashSetSha256 !== V31_HASH_SET_SHA256 ||
    v31Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v31Status.artifactVersion !== "input-live-v31-status-v1" ||
    v31Status.status !== V31_STATUS ||
    v31Status.baseCommit !== V31_BASE_COMMIT ||
    v31Status.antecedent?.commit !== V31_ANTECEDENT_COMMIT ||
    v31Status.authorization?.present !== true ||
    v31Status.authorization?.commitStateDerivedByHistory !== true ||
    v31Status.authorization?.effective !== false ||
    v31Status.authorization?.path !== V31_AUTHORIZATION_PATH ||
    v31Status.authorization?.sha256 !== V31_AUTHORIZATION_SHA256 ||
    v31Status.authorization?.signingPublicKeySpkiSha256 !==
      V31_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V31_AUTHORIZATION_PATH)) !==
      V31_AUTHORIZATION_SHA256 ||
    v31Status.authorization?.v30AuthorizationReusable !== false ||
    v31Status.smallestHonestDelta?.taughtContentRowClipsContentOmitted !==
      true ||
    v31Status.smallestHonestDelta?.taughtContentTextDecorationOmitted !==
      true ||
    v31Status.smallestHonestDelta?.taughtContentTextCaseOmitted !== true ||
    v31Status.smallestHonestDelta?.taughtContentLetterSpacingOmitted !==
      true ||
    v31Status.smallestHonestDelta?.taughtContentHiddenFixedHeightAsHug !==
      true ||
    v31Status.smallestHonestDelta?.v30SceneReadbackUnchanged !== true ||
    v31Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v31Status.attemptsExecuted !== 1 ||
    v31Status.nextAttempt !== 2 ||
    v31Status.liveExecutionOccurred !== true ||
    v31Status.figmaWrites !== 4 ||
    v31Status.figmaCaptures !== 0 ||
    v31Status.createdNodesThenRemoved !== 2317 ||
    v31Status.attempt1Path !== V31_ATTEMPT_1_PATH ||
    v31Status.attempt1Sha256 !== V31_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V31_ATTEMPT_1_PATH)) !==
      V31_ATTEMPT_1_SHA256 ||
    v31Status.restartAsV31Attempt2WithoutContentRowCornerRadiusForbidden !==
      true ||
    v31Status.overallInputSuccess !== false
  )
    failures.push("v31 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V32_ROOT}/protocol.json`)) !==
      V32_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V32_ROOT}/proof-plan.json`)) !==
      V32_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V32_ROOT}/capture-manifest.json`)) !==
      V32_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V32_ROOT}/request-manifest.json`)) !==
      V32_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V32_ROOT}/antecedent-index.json`)) !==
      V32_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V32_ROOT}/authorization-template.json`),
    ) !== V32_AUTHORIZATION_TEMPLATE_SHA256 ||
    v32Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v32.ts" ||
    v32Protocol.hostNormalization?.taughtContentRowCornerRadiusOmitted !==
      true ||
    v32Protocol.hostNormalization?.taughtContentRowClipsContentOmitted !==
      true ||
    v32Protocol.hostNormalization?.v31SceneReadbackUnchanged !== true ||
    v32Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v32Protocol.execution?.remoteRequests !== 133 ||
    v32Index.hashSetSha256 !== V32_HASH_SET_SHA256 ||
    v32Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v32Status.artifactVersion !== "input-live-v32-status-v1" ||
    v32Status.status !== V32_STATUS ||
    v32Status.baseCommit !== V32_BASE_COMMIT ||
    v32Status.antecedent?.commit !== V32_ANTECEDENT_COMMIT ||
    v32Status.authorization?.present !== true ||
    v32Status.authorization?.commitStateDerivedByHistory !== true ||
    v32Status.authorization?.effective !== false ||
    v32Status.authorization?.path !== V32_AUTHORIZATION_PATH ||
    v32Status.authorization?.sha256 !== V32_AUTHORIZATION_SHA256 ||
    v32Status.authorization?.signingPublicKeySpkiSha256 !==
      V32_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V32_AUTHORIZATION_PATH)) !==
      V32_AUTHORIZATION_SHA256 ||
    v32Status.authorization?.v31AuthorizationReusable !== false ||
    v32Status.smallestHonestDelta?.taughtContentRowCornerRadiusOmitted !==
      true ||
    v32Status.smallestHonestDelta?.taughtContentRowClipsContentOmitted !==
      true ||
    v32Status.smallestHonestDelta?.v31SceneReadbackUnchanged !== true ||
    v32Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v32Status.attemptsExecuted !== 1 ||
    v32Status.nextAttempt !== 2 ||
    v32Status.liveExecutionOccurred !== true ||
    v32Status.figmaWrites !== 4 ||
    v32Status.figmaCaptures !== 0 ||
    v32Status.createdNodesThenRemoved !== 2317 ||
    v32Status.attempt1Path !== V32_ATTEMPT_1_PATH ||
    v32Status.attempt1Sha256 !== V32_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V32_ATTEMPT_1_PATH)) !==
      V32_ATTEMPT_1_SHA256 ||
    v32Status.restartAsV32Attempt2WithoutContentRowEffectsForbidden !==
      true ||
    v32Status.overallInputSuccess !== false
  )
    failures.push("v32 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V33_ROOT}/protocol.json`)) !==
      V33_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V33_ROOT}/proof-plan.json`)) !==
      V33_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V33_ROOT}/capture-manifest.json`)) !==
      V33_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V33_ROOT}/request-manifest.json`)) !==
      V33_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V33_ROOT}/antecedent-index.json`)) !==
      V33_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V33_ROOT}/authorization-template.json`),
    ) !== V33_AUTHORIZATION_TEMPLATE_SHA256 ||
    v33Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v33.ts" ||
    v33Protocol.hostNormalization?.taughtContentRowEffectsOmitted !==
      true ||
    v33Protocol.hostNormalization?.taughtContentRowCornerRadiusOmitted !==
      true ||
    v33Protocol.hostNormalization?.v32SceneReadbackUnchanged !== true ||
    v33Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v33Protocol.execution?.remoteRequests !== 133 ||
    v33Index.hashSetSha256 !== V33_HASH_SET_SHA256 ||
    v33Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v33Status.artifactVersion !== "input-live-v33-status-v1" ||
    v33Status.status !== V33_STATUS ||
    v33Status.baseCommit !== V33_BASE_COMMIT ||
    v33Status.antecedent?.commit !== V33_ANTECEDENT_COMMIT ||
    v33Status.authorization?.present !== true ||
    v33Status.authorization?.commitStateDerivedByHistory !== true ||
    v33Status.authorization?.effective !== false ||
    v33Status.authorization?.path !== V33_AUTHORIZATION_PATH ||
    v33Status.authorization?.sha256 !== V33_AUTHORIZATION_SHA256 ||
    v33Status.authorization?.signingPublicKeySpkiSha256 !==
      V33_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V33_AUTHORIZATION_PATH)) !==
      V33_AUTHORIZATION_SHA256 ||
    v33Status.authorization?.v32AuthorizationReusable !== false ||
    v33Status.smallestHonestDelta?.taughtContentRowEffectsOmitted !==
      true ||
    v33Status.smallestHonestDelta?.taughtContentRowCornerRadiusOmitted !==
      true ||
    v33Status.smallestHonestDelta?.v32SceneReadbackUnchanged !== true ||
    v33Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v33Status.attemptsExecuted !== 1 ||
    v33Status.nextAttempt !== 2 ||
    v33Status.liveExecutionOccurred !== true ||
    v33Status.figmaWrites !== 4 ||
    v33Status.figmaCaptures !== 0 ||
    v33Status.createdNodesThenRemoved !== 2317 ||
    v33Status.attempt1Path !== V33_ATTEMPT_1_PATH ||
    v33Status.attempt1Sha256 !== V33_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V33_ATTEMPT_1_PATH)) !==
      V33_ATTEMPT_1_SHA256 ||
    v33Status.restartAsV33Attempt2WithoutContentRowStrokesForbidden !==
      true ||
    v33Status.overallInputSuccess !== false
  )
    failures.push("v33 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V34_ROOT}/protocol.json`)) !==
      V34_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V34_ROOT}/proof-plan.json`)) !==
      V34_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V34_ROOT}/capture-manifest.json`)) !==
      V34_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V34_ROOT}/request-manifest.json`)) !==
      V34_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V34_ROOT}/antecedent-index.json`)) !==
      V34_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V34_ROOT}/authorization-template.json`),
    ) !== V34_AUTHORIZATION_TEMPLATE_SHA256 ||
    v34Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v34.ts" ||
    v34Protocol.hostNormalization?.taughtContentRowStrokesOmitted !==
      true ||
    v34Protocol.hostNormalization?.taughtContentRowEffectsOmitted !==
      true ||
    v34Protocol.hostNormalization?.v33SceneReadbackUnchanged !== true ||
    v34Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v34Protocol.execution?.remoteRequests !== 133 ||
    v34Index.hashSetSha256 !== V34_HASH_SET_SHA256 ||
    v34Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v34Status.artifactVersion !== "input-live-v34-status-v1" ||
    v34Status.status !== V34_STATUS ||
    v34Status.baseCommit !== V34_BASE_COMMIT ||
    v34Status.antecedent?.commit !== V34_ANTECEDENT_COMMIT ||
    v34Status.authorization?.present !== true ||
    v34Status.authorization?.commitStateDerivedByHistory !== true ||
    v34Status.authorization?.effective !== false ||
    v34Status.authorization?.path !== V34_AUTHORIZATION_PATH ||
    v34Status.authorization?.sha256 !== V34_AUTHORIZATION_SHA256 ||
    v34Status.authorization?.signingPublicKeySpkiSha256 !==
      V34_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V34_AUTHORIZATION_PATH)) !==
      V34_AUTHORIZATION_SHA256 ||
    v34Status.authorization?.v33AuthorizationReusable !== false ||
    v34Status.smallestHonestDelta?.taughtContentRowStrokesOmitted !==
      true ||
    v34Status.smallestHonestDelta?.taughtContentRowEffectsOmitted !==
      true ||
    v34Status.smallestHonestDelta?.v33SceneReadbackUnchanged !== true ||
    v34Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v34Status.attemptsExecuted !== 1 ||
    v34Status.nextAttempt !== 2 ||
    v34Status.liveExecutionOccurred !== true ||
    v34Status.figmaWrites !== 4 ||
    v34Status.figmaCaptures !== 0 ||
    v34Status.createdNodesThenRemoved !== 2317 ||
    v34Status.attempt1Path !== V34_ATTEMPT_1_PATH ||
    v34Status.attempt1Sha256 !== V34_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V34_ATTEMPT_1_PATH)) !==
      V34_ATTEMPT_1_SHA256 ||
    v34Status.restartAsV34Attempt2WithoutLabelBindingFieldForbidden !==
      true ||
    v34Status.overallInputSuccess !== false
  )
    failures.push("v34 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V35_ROOT}/protocol.json`)) !==
      V35_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V35_ROOT}/proof-plan.json`)) !==
      V35_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V35_ROOT}/capture-manifest.json`)) !==
      V35_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V35_ROOT}/request-manifest.json`)) !==
      V35_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V35_ROOT}/antecedent-index.json`)) !==
      V35_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V35_ROOT}/authorization-template.json`),
    ) !== V35_AUTHORIZATION_TEMPLATE_SHA256 ||
    v35Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v35.ts" ||
    v35Protocol.hostNormalization?.taughtLabelBindingExtrasDropped !==
      true ||
    v35Protocol.hostNormalization?.taughtLabelBindingCompileOrder !==
      true ||
    v35Protocol.hostNormalization?.taughtContentRowStrokesOmitted !==
      true ||
    v35Protocol.hostNormalization?.v34SceneReadbackUnchanged !== true ||
    v35Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v35Protocol.execution?.remoteRequests !== 133 ||
    v35Index.hashSetSha256 !== V35_HASH_SET_SHA256 ||
    v35Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v35Status.artifactVersion !== "input-live-v35-status-v1" ||
    v35Status.status !== V35_STATUS ||
    v35Status.baseCommit !== V35_BASE_COMMIT ||
    v35Status.antecedent?.commit !== V35_ANTECEDENT_COMMIT ||
    v35Status.authorization?.present !== true ||
    v35Status.authorization?.commitStateDerivedByHistory !== true ||
    v35Status.authorization?.effective !== false ||
    v35Status.authorization?.path !== V35_AUTHORIZATION_PATH ||
    v35Status.authorization?.sha256 !== V35_AUTHORIZATION_SHA256 ||
    v35Status.authorization?.signingPublicKeySpkiSha256 !==
      V35_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V35_AUTHORIZATION_PATH)) !==
      V35_AUTHORIZATION_SHA256 ||
    v35Status.authorization?.v34AuthorizationReusable !== false ||
    v35Status.smallestHonestDelta?.taughtLabelBindingExtrasDropped !==
      true ||
    v35Status.smallestHonestDelta?.taughtLabelBindingCompileOrder !==
      true ||
    v35Status.smallestHonestDelta?.v34SceneReadbackUnchanged !== true ||
    v35Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v35Status.attemptsExecuted !== 1 ||
    v35Status.nextAttempt !== 2 ||
    v35Status.liveExecutionOccurred !== true ||
    v35Status.figmaWrites !== 4 ||
    v35Status.figmaCaptures !== 0 ||
    v35Status.createdNodesThenRemoved !== 2317 ||
    v35Status.attempt1Path !== V35_ATTEMPT_1_PATH ||
    v35Status.attempt1Sha256 !== V35_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V35_ATTEMPT_1_PATH)) !==
      V35_ATTEMPT_1_SHA256 ||
    v35Status.restartAsV35Attempt2WithoutLabelLetterSpacingForbidden !==
      true ||
    v35Status.overallInputSuccess !== false
  )
    failures.push("v35 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V36_ROOT}/protocol.json`)) !==
      V36_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V36_ROOT}/proof-plan.json`)) !==
      V36_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V36_ROOT}/capture-manifest.json`)) !==
      V36_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V36_ROOT}/request-manifest.json`)) !==
      V36_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V36_ROOT}/antecedent-index.json`)) !==
      V36_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V36_ROOT}/authorization-template.json`),
    ) !== V36_AUTHORIZATION_TEMPLATE_SHA256 ||
    v36Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v36.ts" ||
    v36Protocol.hostNormalization?.taughtLabelLetterSpacingOmitted !==
      true ||
    v36Protocol.hostNormalization?.taughtLabelBindingExtrasDropped !==
      true ||
    v36Protocol.hostNormalization?.v35SceneReadbackUnchanged !== true ||
    v36Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v36Protocol.execution?.remoteRequests !== 133 ||
    v36Index.hashSetSha256 !== V36_HASH_SET_SHA256 ||
    v36Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v36Status.artifactVersion !== "input-live-v36-status-v1" ||
    v36Status.status !== V36_STATUS ||
    v36Status.baseCommit !== V36_BASE_COMMIT ||
    v36Status.antecedent?.commit !== V36_ANTECEDENT_COMMIT ||
    v36Status.authorization?.present !== true ||
    v36Status.authorization?.commitStateDerivedByHistory !== true ||
    v36Status.authorization?.effective !== false ||
    v36Status.authorization?.path !== V36_AUTHORIZATION_PATH ||
    v36Status.authorization?.sha256 !== V36_AUTHORIZATION_SHA256 ||
    v36Status.authorization?.signingPublicKeySpkiSha256 !==
      V36_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V36_AUTHORIZATION_PATH)) !==
      V36_AUTHORIZATION_SHA256 ||
    v36Status.authorization?.v35AuthorizationReusable !== false ||
    v36Status.smallestHonestDelta?.taughtLabelLetterSpacingOmitted !==
      true ||
    v36Status.smallestHonestDelta?.v35SceneReadbackUnchanged !== true ||
    v36Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v36Status.attemptsExecuted !== 1 ||
    v36Status.nextAttempt !== 2 ||
    v36Status.liveExecutionOccurred !== true ||
    v36Status.figmaWrites !== 4 ||
    v36Status.figmaCaptures !== 0 ||
    v36Status.createdNodesThenRemoved !== 2317 ||
    v36Status.attempt1Path !== V36_ATTEMPT_1_PATH ||
    v36Status.attempt1Sha256 !== V36_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V36_ATTEMPT_1_PATH)) !==
      V36_ATTEMPT_1_SHA256 ||
    v36Status.restartAsV36Attempt2WithoutLabelTextCaseForbidden !==
      true ||
    v36Status.overallInputSuccess !== false
  )
    failures.push("v36 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V37_ROOT}/protocol.json`)) !==
      V37_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V37_ROOT}/proof-plan.json`)) !==
      V37_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V37_ROOT}/capture-manifest.json`)) !==
      V37_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V37_ROOT}/request-manifest.json`)) !==
      V37_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V37_ROOT}/antecedent-index.json`)) !==
      V37_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V37_ROOT}/authorization-template.json`),
    ) !== V37_AUTHORIZATION_TEMPLATE_SHA256 ||
    v37Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v37.ts" ||
    v37Protocol.hostNormalization?.taughtLabelTextCaseOmitted !==
      true ||
    v37Protocol.hostNormalization?.taughtLabelLetterSpacingOmitted !==
      true ||
    v37Protocol.hostNormalization?.v36SceneReadbackUnchanged !== true ||
    v37Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v37Protocol.execution?.remoteRequests !== 133 ||
    v37Index.hashSetSha256 !== V37_HASH_SET_SHA256 ||
    v37Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v37Status.artifactVersion !== "input-live-v37-status-v1" ||
    v37Status.status !== V37_STATUS ||
    v37Status.baseCommit !== V37_BASE_COMMIT ||
    v37Status.antecedent?.commit !== V37_ANTECEDENT_COMMIT ||
    v37Status.authorization?.present !== true ||
    v37Status.authorization?.commitStateDerivedByHistory !== true ||
    v37Status.authorization?.effective !== false ||
    v37Status.authorization?.path !== V37_AUTHORIZATION_PATH ||
    v37Status.authorization?.sha256 !== V37_AUTHORIZATION_SHA256 ||
    v37Status.authorization?.signingPublicKeySpkiSha256 !==
      V37_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V37_AUTHORIZATION_PATH)) !==
      V37_AUTHORIZATION_SHA256 ||
    v37Status.authorization?.v36AuthorizationReusable !== false ||
    v37Status.smallestHonestDelta?.taughtLabelTextCaseOmitted !==
      true ||
    v37Status.smallestHonestDelta?.v36SceneReadbackUnchanged !== true ||
    v37Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v37Status.attemptsExecuted !== 1 ||
    v37Status.nextAttempt !== 2 ||
    v37Status.liveExecutionOccurred !== true ||
    v37Status.figmaWrites !== 4 ||
    v37Status.figmaCaptures !== 0 ||
    v37Status.createdNodesThenRemoved !== 2317 ||
    v37Status.attempt1Path !== V37_ATTEMPT_1_PATH ||
    v37Status.attempt1Sha256 !== V37_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V37_ATTEMPT_1_PATH)) !==
      V37_ATTEMPT_1_SHA256 ||
    v37Status.restartAsV37Attempt2WithoutLabelTextDecorationForbidden !==
      true ||
    v37Status.overallInputSuccess !== false
  )
    failures.push("v37 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V38_ROOT}/protocol.json`)) !==
      V38_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V38_ROOT}/proof-plan.json`)) !==
      V38_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V38_ROOT}/capture-manifest.json`)) !==
      V38_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V38_ROOT}/request-manifest.json`)) !==
      V38_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V38_ROOT}/antecedent-index.json`)) !==
      V38_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V38_ROOT}/authorization-template.json`),
    ) !== V38_AUTHORIZATION_TEMPLATE_SHA256 ||
    v38Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v38.ts" ||
    v38Protocol.hostNormalization?.taughtLabelTextDecorationOmitted !==
      true ||
    v38Protocol.hostNormalization?.taughtLabelTextCaseOmitted !==
      true ||
    v38Protocol.hostNormalization?.v37SceneReadbackUnchanged !== true ||
    v38Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v38Protocol.execution?.remoteRequests !== 133 ||
    v38Index.hashSetSha256 !== V38_HASH_SET_SHA256 ||
    v38Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v38Status.artifactVersion !== "input-live-v38-status-v1" ||
    v38Status.status !== V38_STATUS ||
    v38Status.baseCommit !== V38_BASE_COMMIT ||
    v38Status.antecedent?.commit !== V38_ANTECEDENT_COMMIT ||
    v38Status.authorization?.present !== true ||
    v38Status.authorization?.commitStateDerivedByHistory !== true ||
    v38Status.authorization?.effective !== false ||
    v38Status.authorization?.path !== V38_AUTHORIZATION_PATH ||
    v38Status.authorization?.sha256 !== V38_AUTHORIZATION_SHA256 ||
    v38Status.authorization?.signingPublicKeySpkiSha256 !==
      V38_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V38_AUTHORIZATION_PATH)) !==
      V38_AUTHORIZATION_SHA256 ||
    v38Status.authorization?.v37AuthorizationReusable !== false ||
    v38Status.smallestHonestDelta?.taughtLabelTextDecorationOmitted !==
      true ||
    v38Status.smallestHonestDelta?.v37SceneReadbackUnchanged !== true ||
    v38Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v38Status.attemptsExecuted !== 1 ||
    v38Status.nextAttempt !== 2 ||
    v38Status.liveExecutionOccurred !== true ||
    v38Status.figmaWrites !== 4 ||
    v38Status.figmaCaptures !== 0 ||
    v38Status.createdNodesThenRemoved !== 2317 ||
    v38Status.attempt1Path !== V38_ATTEMPT_1_PATH ||
    v38Status.attempt1Sha256 !== V38_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V38_ATTEMPT_1_PATH)) !==
      V38_ATTEMPT_1_SHA256 ||
    v38Status.restartAsV38Attempt2WithoutLabelRowClipsContentForbidden !==
      true ||
    v38Status.overallInputSuccess !== false
  )
    failures.push("v38 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V39_ROOT}/protocol.json`)) !==
      V39_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V39_ROOT}/proof-plan.json`)) !==
      V39_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V39_ROOT}/capture-manifest.json`)) !==
      V39_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V39_ROOT}/request-manifest.json`)) !==
      V39_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V39_ROOT}/antecedent-index.json`)) !==
      V39_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V39_ROOT}/authorization-template.json`),
    ) !== V39_AUTHORIZATION_TEMPLATE_SHA256 ||
    v39Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v39.ts" ||
    v39Protocol.hostNormalization?.taughtLabelRowClipsContentOmitted !==
      true ||
    v39Protocol.hostNormalization?.taughtLabelTextDecorationOmitted !==
      true ||
    v39Protocol.hostNormalization?.v38SceneReadbackUnchanged !== true ||
    v39Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v39Protocol.execution?.remoteRequests !== 133 ||
    v39Index.hashSetSha256 !== V39_HASH_SET_SHA256 ||
    v39Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v39Status.artifactVersion !== "input-live-v39-status-v1" ||
    v39Status.status !== V39_STATUS ||
    v39Status.baseCommit !== V39_BASE_COMMIT ||
    v39Status.antecedent?.commit !== V39_ANTECEDENT_COMMIT ||
    v39Status.authorization?.present !== true ||
    v39Status.authorization?.commitStateDerivedByHistory !== true ||
    v39Status.authorization?.effective !== false ||
    v39Status.authorization?.path !== V39_AUTHORIZATION_PATH ||
    v39Status.authorization?.sha256 !== V39_AUTHORIZATION_SHA256 ||
    v39Status.authorization?.signingPublicKeySpkiSha256 !==
      V39_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V39_AUTHORIZATION_PATH)) !==
      V39_AUTHORIZATION_SHA256 ||
    v39Status.authorization?.v38AuthorizationReusable !== false ||
    v39Status.smallestHonestDelta?.taughtLabelRowClipsContentOmitted !==
      true ||
    v39Status.smallestHonestDelta?.v38SceneReadbackUnchanged !== true ||
    v39Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v39Status.attemptsExecuted !== 1 ||
    v39Status.nextAttempt !== 2 ||
    v39Status.liveExecutionOccurred !== true ||
    v39Status.figmaWrites !== 4 ||
    v39Status.figmaCaptures !== 0 ||
    v39Status.createdNodesThenRemoved !== 2317 ||
    v39Status.attempt1Path !== V39_ATTEMPT_1_PATH ||
    v39Status.attempt1Sha256 !== V39_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V39_ATTEMPT_1_PATH)) !==
      V39_ATTEMPT_1_SHA256 ||
    v39Status.restartAsV39Attempt2WithoutLabelRowCornerRadiusForbidden !==
      true ||
    v39Status.overallInputSuccess !== false
  )
    failures.push("v39 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V40_ROOT}/protocol.json`)) !==
      V40_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V40_ROOT}/proof-plan.json`)) !==
      V40_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V40_ROOT}/capture-manifest.json`)) !==
      V40_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V40_ROOT}/request-manifest.json`)) !==
      V40_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V40_ROOT}/antecedent-index.json`)) !==
      V40_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V40_ROOT}/authorization-template.json`),
    ) !== V40_AUTHORIZATION_TEMPLATE_SHA256 ||
    v40Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v40.ts" ||
    v40Protocol.hostNormalization?.taughtLabelRowCornerRadiusOmitted !==
      true ||
    v40Protocol.hostNormalization?.taughtLabelRowClipsContentOmitted !==
      true ||
    v40Protocol.hostNormalization?.v39SceneReadbackUnchanged !== true ||
    v40Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v40Protocol.execution?.remoteRequests !== 133 ||
    v40Index.hashSetSha256 !== V40_HASH_SET_SHA256 ||
    v40Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v40Status.artifactVersion !== "input-live-v40-status-v1" ||
    v40Status.status !== V40_STATUS ||
    v40Status.baseCommit !== V40_BASE_COMMIT ||
    v40Status.antecedent?.commit !== V40_ANTECEDENT_COMMIT ||
    v40Status.authorization?.present !== true ||
    v40Status.authorization?.commitStateDerivedByHistory !== true ||
    v40Status.authorization?.effective !== false ||
    v40Status.authorization?.path !== V40_AUTHORIZATION_PATH ||
    v40Status.authorization?.sha256 !== V40_AUTHORIZATION_SHA256 ||
    v40Status.authorization?.signingPublicKeySpkiSha256 !==
      V40_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V40_AUTHORIZATION_PATH)) !==
      V40_AUTHORIZATION_SHA256 ||
    v40Status.authorization?.v39AuthorizationReusable !== false ||
    v40Status.smallestHonestDelta?.taughtLabelRowCornerRadiusOmitted !==
      true ||
    v40Status.smallestHonestDelta?.v39SceneReadbackUnchanged !== true ||
    v40Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v40Status.attemptsExecuted !== 1 ||
    v40Status.nextAttempt !== 2 ||
    v40Status.liveExecutionOccurred !== true ||
    v40Status.figmaWrites !== 4 ||
    v40Status.figmaCaptures !== 0 ||
    v40Status.createdNodesThenRemoved !== 2317 ||
    v40Status.attempt1Path !== V40_ATTEMPT_1_PATH ||
    v40Status.attempt1Sha256 !== V40_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V40_ATTEMPT_1_PATH)) !==
      V40_ATTEMPT_1_SHA256 ||
    v40Status.restartAsV40Attempt2WithoutLabelRowEffectsForbidden !==
      true ||
    v40Status.overallInputSuccess !== false
  )
    failures.push("v40 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V41_ROOT}/protocol.json`)) !==
      V41_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V41_ROOT}/proof-plan.json`)) !==
      V41_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V41_ROOT}/capture-manifest.json`)) !==
      V41_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V41_ROOT}/request-manifest.json`)) !==
      V41_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V41_ROOT}/antecedent-index.json`)) !==
      V41_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V41_ROOT}/authorization-template.json`),
    ) !== V41_AUTHORIZATION_TEMPLATE_SHA256 ||
    v41Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v41.ts" ||
    v41Protocol.hostNormalization?.taughtLabelRowEffectsOmitted !== true ||
    v41Protocol.hostNormalization?.taughtLabelRowCornerRadiusOmitted !==
      true ||
    v41Protocol.hostNormalization?.v40SceneReadbackUnchanged !== true ||
    v41Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v41Protocol.execution?.remoteRequests !== 133 ||
    v41Index.hashSetSha256 !== V41_HASH_SET_SHA256 ||
    v41Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v41Status.artifactVersion !== "input-live-v41-status-v1" ||
    v41Status.status !== V41_STATUS ||
    v41Status.baseCommit !== V41_BASE_COMMIT ||
    v41Status.antecedent?.commit !== V41_ANTECEDENT_COMMIT ||
    v41Status.authorization?.present !== true ||
    v41Status.authorization?.commitStateDerivedByHistory !== true ||
    v41Status.authorization?.effective !== false ||
    v41Status.authorization?.path !== V41_AUTHORIZATION_PATH ||
    v41Status.authorization?.sha256 !== V41_AUTHORIZATION_SHA256 ||
    v41Status.authorization?.signingPublicKeySpkiSha256 !==
      V41_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V41_AUTHORIZATION_PATH)) !==
      V41_AUTHORIZATION_SHA256 ||
    v41Status.authorization?.v40AuthorizationReusable !== false ||
    v41Status.smallestHonestDelta?.taughtLabelRowEffectsOmitted !== true ||
    v41Status.smallestHonestDelta?.v40SceneReadbackUnchanged !== true ||
    v41Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v41Status.attemptsExecuted !== 1 ||
    v41Status.nextAttempt !== 2 ||
    v41Status.liveExecutionOccurred !== true ||
    v41Status.figmaWrites !== 4 ||
    v41Status.figmaCaptures !== 0 ||
    v41Status.createdNodesThenRemoved !== 2317 ||
    v41Status.attempt1Path !== V41_ATTEMPT_1_PATH ||
    v41Status.attempt1Sha256 !== V41_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V41_ATTEMPT_1_PATH)) !==
      V41_ATTEMPT_1_SHA256 ||
    v41Status.restartAsV41Attempt2WithoutLabelRowStrokesForbidden !==
      true ||
    v41Status.overallInputSuccess !== false
  )
    failures.push("v41 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V42_ROOT}/protocol.json`)) !==
      V42_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V42_ROOT}/proof-plan.json`)) !==
      V42_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V42_ROOT}/capture-manifest.json`)) !==
      V42_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V42_ROOT}/request-manifest.json`)) !==
      V42_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V42_ROOT}/antecedent-index.json`)) !==
      V42_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V42_ROOT}/authorization-template.json`),
    ) !== V42_AUTHORIZATION_TEMPLATE_SHA256 ||
    v42Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v42.ts" ||
    v42Protocol.hostNormalization?.taughtLabelRowStrokesOmitted !== true ||
    v42Protocol.hostNormalization?.taughtLabelRowEffectsOmitted !== true ||
    v42Protocol.hostNormalization?.taughtLabelRowCornerRadiusOmitted !==
      true ||
    v42Protocol.hostNormalization?.v41SceneReadbackUnchanged !== true ||
    v42Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v42Protocol.execution?.remoteRequests !== 133 ||
    v42Index.hashSetSha256 !== V42_HASH_SET_SHA256 ||
    v42Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v42Status.artifactVersion !== "input-live-v42-status-v1" ||
    v42Status.status !== V42_STATUS ||
    v42Status.baseCommit !== V42_BASE_COMMIT ||
    v42Status.antecedent?.commit !== V42_ANTECEDENT_COMMIT ||
    v42Status.authorization?.present !== true ||
    v42Status.authorization?.commitStateDerivedByHistory !== true ||
    v42Status.authorization?.effective !== false ||
    v42Status.authorization?.path !== V42_AUTHORIZATION_PATH ||
    v42Status.authorization?.sha256 !== V42_AUTHORIZATION_SHA256 ||
    v42Status.authorization?.signingPublicKeySpkiSha256 !==
      V42_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V42_AUTHORIZATION_PATH)) !==
      V42_AUTHORIZATION_SHA256 ||
    v42Status.authorization?.v41AuthorizationReusable !== false ||
    v42Status.smallestHonestDelta?.taughtLabelRowStrokesOmitted !== true ||
    v42Status.smallestHonestDelta?.v41SceneReadbackUnchanged !== true ||
    v42Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v42Status.attemptsExecuted !== 1 ||
    v42Status.nextAttempt !== 2 ||
    v42Status.liveExecutionOccurred !== true ||
    v42Status.figmaWrites !== 4 ||
    v42Status.figmaCaptures !== 0 ||
    v42Status.createdNodesThenRemoved !== 2317 ||
    v42Status.attempt1Path !== V42_ATTEMPT_1_PATH ||
    v42Status.attempt1Sha256 !== V42_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V42_ATTEMPT_1_PATH)) !==
      V42_ATTEMPT_1_SHA256 ||
    v42Status.restartAsV42Attempt2WithoutSurfaceStrokeDashPatternForbidden !==
      true ||
    v42Status.overallInputSuccess !== false
  )
    failures.push("v42 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V43_ROOT}/protocol.json`)) !==
      V43_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V43_ROOT}/proof-plan.json`)) !==
      V43_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V43_ROOT}/capture-manifest.json`)) !==
      V43_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V43_ROOT}/request-manifest.json`)) !==
      V43_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V43_ROOT}/antecedent-index.json`)) !==
      V43_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V43_ROOT}/authorization-template.json`),
    ) !== V43_AUTHORIZATION_TEMPLATE_SHA256 ||
    v43Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v43.ts" ||
    v43Protocol.hostNormalization?.taughtSurfaceStrokeDashPatternOmitted !==
      true ||
    v43Protocol.hostNormalization?.taughtLabelRowStrokesOmitted !== true ||
    v43Protocol.hostNormalization?.taughtLabelRowEffectsOmitted !== true ||
    v43Protocol.hostNormalization?.taughtLabelRowCornerRadiusOmitted !==
      true ||
    v43Protocol.hostNormalization?.v42SceneReadbackUnchanged !== true ||
    v43Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v43Protocol.execution?.remoteRequests !== 133 ||
    v43Index.hashSetSha256 !== V43_HASH_SET_SHA256 ||
    v43Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v43Status.artifactVersion !== "input-live-v43-status-v1" ||
    v43Status.status !== V43_STATUS ||
    v43Status.baseCommit !== V43_BASE_COMMIT ||
    v43Status.antecedent?.commit !== V43_ANTECEDENT_COMMIT ||
    v43Status.authorization?.present !== true ||
    v43Status.authorization?.commitStateDerivedByHistory !== true ||
    v43Status.authorization?.effective !== false ||
    v43Status.authorization?.path !== V43_AUTHORIZATION_PATH ||
    v43Status.authorization?.sha256 !== V43_AUTHORIZATION_SHA256 ||
    v43Status.authorization?.signingPublicKeySpkiSha256 !==
      V43_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V43_AUTHORIZATION_PATH)) !==
      V43_AUTHORIZATION_SHA256 ||
    v43Status.authorization?.v42AuthorizationReusable !== false ||
    v43Status.smallestHonestDelta?.taughtSurfaceStrokeDashPatternOmitted !==
      true ||
    v43Status.smallestHonestDelta?.v42SceneReadbackUnchanged !== true ||
    v43Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v43Status.attemptsExecuted !== 1 ||
    v43Status.nextAttempt !== 2 ||
    v43Status.liveExecutionOccurred !== true ||
    v43Status.figmaWrites !== 4 ||
    v43Status.figmaCaptures !== 0 ||
    v43Status.createdNodesThenRemoved !== 2317 ||
    v43Status.attempt1Path !== V43_ATTEMPT_1_PATH ||
    v43Status.attempt1Sha256 !== V43_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V43_ATTEMPT_1_PATH)) !==
      V43_ATTEMPT_1_SHA256 ||
    v43Status.restartAsV43Attempt2WithoutMessageHelperBindingOrderForbidden !==
      true ||
    v43Status.overallInputSuccess !== false
  )
    failures.push("v43 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V44_ROOT}/protocol.json`)) !==
      V44_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V44_ROOT}/proof-plan.json`)) !==
      V44_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V44_ROOT}/capture-manifest.json`)) !==
      V44_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V44_ROOT}/request-manifest.json`)) !==
      V44_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V44_ROOT}/antecedent-index.json`)) !==
      V44_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V44_ROOT}/authorization-template.json`),
    ) !== V44_AUTHORIZATION_TEMPLATE_SHA256 ||
    v44Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v44.ts" ||
    v44Protocol.hostNormalization?.taughtMessageBindingCompileOrder !==
      true ||
    v44Protocol.hostNormalization?.taughtSurfaceStrokeDashPatternOmitted !==
      true ||
    v44Protocol.hostNormalization?.v43SceneReadbackUnchanged !== true ||
    v44Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v44Protocol.execution?.remoteRequests !== 133 ||
    v44Index.hashSetSha256 !== V44_HASH_SET_SHA256 ||
    v44Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v44Status.artifactVersion !== "input-live-v44-status-v1" ||
    v44Status.status !== V44_STATUS ||
    v44Status.baseCommit !== V44_BASE_COMMIT ||
    v44Status.antecedent?.commit !== V44_ANTECEDENT_COMMIT ||
    v44Status.authorization?.present !== true ||
    v44Status.authorization?.commitStateDerivedByHistory !== true ||
    v44Status.authorization?.effective !== false ||
    v44Status.authorization?.path !== V44_AUTHORIZATION_PATH ||
    v44Status.authorization?.sha256 !== V44_AUTHORIZATION_SHA256 ||
    v44Status.authorization?.signingPublicKeySpkiSha256 !==
      V44_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V44_AUTHORIZATION_PATH)) !==
      V44_AUTHORIZATION_SHA256 ||
    v44Status.authorization?.v43AuthorizationReusable !== false ||
    v44Status.smallestHonestDelta?.taughtMessageBindingCompileOrder !==
      true ||
    v44Status.smallestHonestDelta?.v43SceneReadbackUnchanged !== true ||
    v44Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v44Status.attemptsExecuted !== 1 ||
    v44Status.nextAttempt !== 2 ||
    v44Status.liveExecutionOccurred !== true ||
    v44Status.figmaWrites !== 4 ||
    v44Status.figmaCaptures !== 0 ||
    v44Status.createdNodesThenRemoved !== 2317 ||
    v44Status.attempt1Path !== V44_ATTEMPT_1_PATH ||
    v44Status.attempt1Sha256 !== V44_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V44_ATTEMPT_1_PATH)) !==
      V44_ATTEMPT_1_SHA256 ||
    v44Status.restartAsV44Attempt2WithoutMessageLetterSpacingOmitForbidden !==
      true ||
    v44Status.overallInputSuccess !== false
  )
    failures.push("v44 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V45_ROOT}/protocol.json`)) !==
      V45_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V45_ROOT}/proof-plan.json`)) !==
      V45_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V45_ROOT}/capture-manifest.json`)) !==
      V45_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V45_ROOT}/request-manifest.json`)) !==
      V45_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V45_ROOT}/antecedent-index.json`)) !==
      V45_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V45_ROOT}/authorization-template.json`),
    ) !== V45_AUTHORIZATION_TEMPLATE_SHA256 ||
    v45Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v45.ts" ||
    v45Protocol.hostNormalization?.taughtMessageLetterSpacingOmitted !==
      true ||
    v45Protocol.hostNormalization?.taughtMessageBindingCompileOrder !==
      true ||
    v45Protocol.hostNormalization?.v44SceneReadbackUnchanged !== true ||
    v45Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v45Protocol.execution?.remoteRequests !== 133 ||
    v45Index.hashSetSha256 !== V45_HASH_SET_SHA256 ||
    v45Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v45Status.artifactVersion !== "input-live-v45-status-v1" ||
    v45Status.status !== V45_STATUS ||
    v45Status.baseCommit !== V45_BASE_COMMIT ||
    v45Status.antecedent?.commit !== V45_ANTECEDENT_COMMIT ||
    v45Status.authorization?.present !== true ||
    v45Status.authorization?.commitStateDerivedByHistory !== true ||
    v45Status.authorization?.effective !== false ||
    v45Status.authorization?.path !== V45_AUTHORIZATION_PATH ||
    v45Status.authorization?.sha256 !== V45_AUTHORIZATION_SHA256 ||
    v45Status.authorization?.signingPublicKeySpkiSha256 !==
      V45_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V45_AUTHORIZATION_PATH)) !==
      V45_AUTHORIZATION_SHA256 ||
    v45Status.authorization?.v44AuthorizationReusable !== false ||
    v45Status.smallestHonestDelta?.taughtMessageLetterSpacingOmitted !==
      true ||
    v45Status.smallestHonestDelta?.v44SceneReadbackUnchanged !== true ||
    v45Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v45Status.attemptsExecuted !== 1 ||
    v45Status.nextAttempt !== 2 ||
    v45Status.liveExecutionOccurred !== true ||
    v45Status.figmaWrites !== 4 ||
    v45Status.figmaCaptures !== 0 ||
    v45Status.createdNodesThenRemoved !== 2317 ||
    v45Status.attempt1Path !== V45_ATTEMPT_1_PATH ||
    v45Status.attempt1Sha256 !== V45_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V45_ATTEMPT_1_PATH)) !==
      V45_ATTEMPT_1_SHA256 ||
    v45Status.restartAsV45Attempt2WithoutMessageTextCaseOmitForbidden !==
      true ||
    v45Status.overallInputSuccess !== false
  )
    failures.push("v45 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V46_ROOT}/protocol.json`)) !==
      V46_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V46_ROOT}/proof-plan.json`)) !==
      V46_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V46_ROOT}/capture-manifest.json`)) !==
      V46_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V46_ROOT}/request-manifest.json`)) !==
      V46_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V46_ROOT}/antecedent-index.json`)) !==
      V46_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V46_ROOT}/authorization-template.json`),
    ) !== V46_AUTHORIZATION_TEMPLATE_SHA256 ||
    v46Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v46.ts" ||
    v46Protocol.hostNormalization?.taughtMessageTextCaseOmitted !== true ||
    v46Protocol.hostNormalization?.taughtMessageLetterSpacingOmitted !==
      true ||
    v46Protocol.hostNormalization?.taughtMessageBindingCompileOrder !==
      true ||
    v46Protocol.hostNormalization?.v45SceneReadbackUnchanged !== true ||
    v46Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v46Protocol.execution?.remoteRequests !== 133 ||
    v46Index.hashSetSha256 !== V46_HASH_SET_SHA256 ||
    v46Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v46Status.artifactVersion !== "input-live-v46-status-v1" ||
    v46Status.status !== V46_STATUS ||
    v46Status.baseCommit !== V46_BASE_COMMIT ||
    v46Status.antecedent?.commit !== V46_ANTECEDENT_COMMIT ||
    v46Status.authorization?.present !== true ||
    v46Status.authorization?.commitStateDerivedByHistory !== true ||
    v46Status.authorization?.effective !== false ||
    v46Status.authorization?.path !== V46_AUTHORIZATION_PATH ||
    v46Status.authorization?.sha256 !== V46_AUTHORIZATION_SHA256 ||
    v46Status.authorization?.signingPublicKeySpkiSha256 !==
      V46_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V46_AUTHORIZATION_PATH)) !==
      V46_AUTHORIZATION_SHA256 ||
    v46Status.authorization?.v45AuthorizationReusable !== false ||
    v46Status.smallestHonestDelta?.taughtMessageTextCaseOmitted !== true ||
    v46Status.smallestHonestDelta?.v45SceneReadbackUnchanged !== true ||
    v46Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v46Status.attemptsExecuted !== 1 ||
    v46Status.nextAttempt !== 2 ||
    v46Status.liveExecutionOccurred !== true ||
    v46Status.figmaWrites !== 4 ||
    v46Status.figmaCaptures !== 0 ||
    v46Status.createdNodesThenRemoved !== 2317 ||
    v46Status.attempt1Path !== V46_ATTEMPT_1_PATH ||
    v46Status.attempt1Sha256 !== V46_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V46_ATTEMPT_1_PATH)) !==
      V46_ATTEMPT_1_SHA256 ||
    v46Status.restartAsV46Attempt2WithoutMessageTextDecorationOmitForbidden !==
      true ||
    v46Status.overallInputSuccess !== false
  )
    failures.push("v46 draft antecedent/status mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v26Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v26 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v26-authorization") ||
      artifactPath.includes("input-field-live-v26-preflight") ||
      artifactPath.includes("input-field-live-v26-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v26 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v26Index.artifacts?.["recipe/scene-readback-v26.ts"] ||
    !v26Index.artifacts?.["recipe/scene-readback-runtime-v26.ts"] ||
    !v26Index.artifacts?.["recipe/input-field-live-v3-verifier-v26.ts"] ||
    !v26Index.artifacts?.["recipe/input-field-live-v26-restore.ts"] ||
    !v26Index.artifacts?.[`${V26_ROOT}/programs/restore-blueprint.js`] ||
    !v26Index.artifacts?.[`${V26_ROOT}/programs/writer-payload.js`] ||
    v26Index.artifacts?.["recipe/scene-readback.ts"] ||
    v26Index.artifacts?.["recipe/scene-readback-v25.ts"] ||
    v26Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v26Index.artifacts?.["recipe/input-field-live-v3-verifier-v25.ts"] ||
    v26Index.artifacts?.["recipe/input-field-live-v25-restore.ts"]
  )
    failures.push(
      "v26 must hash carried scene-readback-v26 and leave hashed v25 restore/runtime out",
    );
  for (const [artifactPath, metadata] of Object.entries(
    v27Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v27 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v27-authorization") ||
      artifactPath.includes("input-field-live-v27-preflight") ||
      artifactPath.includes("input-field-live-v27-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v27 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v27Index.artifacts?.["recipe/scene-readback-v27.ts"] ||
    !v27Index.artifacts?.["recipe/scene-readback-runtime-v27.ts"] ||
    !v27Index.artifacts?.["recipe/input-field-live-v3-verifier-v27.ts"] ||
    !v27Index.artifacts?.["recipe/input-field-live-v27-restore.ts"] ||
    !v27Index.artifacts?.[`${V27_ROOT}/programs/restore-blueprint.js`] ||
    !v27Index.artifacts?.[`${V27_ROOT}/programs/writer-payload.js`] ||
    v27Index.artifacts?.["recipe/scene-readback.ts"] ||
    v27Index.artifacts?.["recipe/scene-readback-v26.ts"] ||
    v27Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v27Index.artifacts?.["recipe/input-field-live-v3-verifier-v26.ts"] ||
    v27Index.artifacts?.["recipe/input-field-live-v26-restore.ts"]
  )
    failures.push(
      "v27 must hash carried scene-readback-v27 and leave hashed v26 restore/runtime out",
    );
  for (const [artifactPath, metadata] of Object.entries(
    v28Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v28 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v28-authorization") ||
      artifactPath.includes("input-field-live-v28-preflight") ||
      artifactPath.includes("input-field-live-v28-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v28 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v28Index.artifacts?.["recipe/scene-readback-v28.ts"] ||
    !v28Index.artifacts?.["recipe/scene-readback-runtime-v28.ts"] ||
    !v28Index.artifacts?.["recipe/input-field-live-v3-verifier-v28.ts"] ||
    !v28Index.artifacts?.["recipe/input-field-live-v28-restore.ts"] ||
    !v28Index.artifacts?.[`${V28_ROOT}/programs/restore-blueprint.js`] ||
    !v28Index.artifacts?.[`${V28_ROOT}/programs/writer-payload.js`] ||
    v28Index.artifacts?.["recipe/scene-readback.ts"] ||
    v28Index.artifacts?.["recipe/scene-readback-v27.ts"] ||
    v28Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v28Index.artifacts?.["recipe/input-field-live-v3-verifier-v27.ts"] ||
    v28Index.artifacts?.["recipe/input-field-live-v27-restore.ts"]
  )
    failures.push(
      "v28 must hash carried scene-readback-v28 and leave hashed v27 restore/runtime out",
    );
  for (const [artifactPath, metadata] of Object.entries(
    v29Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v29 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v29-authorization") ||
      artifactPath.includes("input-field-live-v29-preflight") ||
      artifactPath.includes("input-field-live-v29-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v29 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v29Index.artifacts?.["recipe/scene-readback-v29.ts"] ||
    !v29Index.artifacts?.["recipe/scene-readback-runtime-v29.ts"] ||
    !v29Index.artifacts?.["recipe/input-field-live-v3-verifier-v29.ts"] ||
    !v29Index.artifacts?.["recipe/input-field-live-v29-restore.ts"] ||
    !v29Index.artifacts?.[`${V29_ROOT}/programs/restore-blueprint.js`] ||
    !v29Index.artifacts?.[`${V29_ROOT}/programs/writer-payload.js`] ||
    v29Index.artifacts?.["recipe/scene-readback.ts"] ||
    v29Index.artifacts?.["recipe/scene-readback-v28.ts"] ||
    v29Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v29Index.artifacts?.["recipe/input-field-live-v3-verifier-v28.ts"] ||
    v29Index.artifacts?.["recipe/input-field-live-v28-restore.ts"]
  )
    failures.push(
      "v29 must hash carried scene-readback-v29 and leave hashed v28 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v28.ts")) !==
    V28_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v28 scene-readback restamped while preparing v29");
  for (const [artifactPath, metadata] of Object.entries(
    v30Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v30 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v30-authorization") ||
      artifactPath.includes("input-field-live-v30-preflight") ||
      artifactPath.includes("input-field-live-v30-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v30 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v30Index.artifacts?.["recipe/scene-readback-v30.ts"] ||
    !v30Index.artifacts?.["recipe/scene-readback-runtime-v30.ts"] ||
    !v30Index.artifacts?.["recipe/input-field-live-v3-verifier-v30.ts"] ||
    !v30Index.artifacts?.["recipe/input-field-live-v30-restore.ts"] ||
    !v30Index.artifacts?.[`${V30_ROOT}/programs/restore-blueprint.js`] ||
    !v30Index.artifacts?.[`${V30_ROOT}/programs/writer-payload.js`] ||
    v30Index.artifacts?.["recipe/scene-readback.ts"] ||
    v30Index.artifacts?.["recipe/scene-readback-v29.ts"] ||
    v30Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v30Index.artifacts?.["recipe/input-field-live-v3-verifier-v29.ts"] ||
    v30Index.artifacts?.["recipe/input-field-live-v29-restore.ts"]
  )
    failures.push(
      "v30 must hash carried scene-readback-v30 and leave hashed v29 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v29.ts")) !==
    V29_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v29 scene-readback restamped while preparing v30");
  for (const [artifactPath, metadata] of Object.entries(
    v31Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v31 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v31-authorization") ||
      artifactPath.includes("input-field-live-v31-preflight") ||
      artifactPath.includes("input-field-live-v31-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v31 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v31Index.artifacts?.["recipe/scene-readback-v31.ts"] ||
    !v31Index.artifacts?.["recipe/scene-readback-runtime-v31.ts"] ||
    !v31Index.artifacts?.["recipe/input-field-live-v3-verifier-v31.ts"] ||
    !v31Index.artifacts?.["recipe/input-field-live-v31-restore.ts"] ||
    !v31Index.artifacts?.[`${V31_ROOT}/programs/restore-blueprint.js`] ||
    !v31Index.artifacts?.[`${V31_ROOT}/programs/writer-payload.js`] ||
    v31Index.artifacts?.["recipe/scene-readback.ts"] ||
    v31Index.artifacts?.["recipe/scene-readback-v30.ts"] ||
    v31Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v31Index.artifacts?.["recipe/input-field-live-v3-verifier-v30.ts"] ||
    v31Index.artifacts?.["recipe/input-field-live-v30-restore.ts"]
  )
    failures.push(
      "v31 must hash carried scene-readback-v31 and leave hashed v30 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v30.ts")) !==
    V30_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v30 scene-readback restamped while preparing v31");
  for (const [artifactPath, metadata] of Object.entries(
    v32Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v32 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v32-authorization") ||
      artifactPath.includes("input-field-live-v32-preflight") ||
      artifactPath.includes("input-field-live-v32-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v32 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v32Index.artifacts?.["recipe/scene-readback-v32.ts"] ||
    !v32Index.artifacts?.["recipe/scene-readback-runtime-v32.ts"] ||
    !v32Index.artifacts?.["recipe/input-field-live-v3-verifier-v32.ts"] ||
    !v32Index.artifacts?.["recipe/input-field-live-v32-restore.ts"] ||
    !v32Index.artifacts?.[`${V32_ROOT}/programs/restore-blueprint.js`] ||
    !v32Index.artifacts?.[`${V32_ROOT}/programs/writer-payload.js`] ||
    v32Index.artifacts?.["recipe/scene-readback.ts"] ||
    v32Index.artifacts?.["recipe/scene-readback-v31.ts"] ||
    v32Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v32Index.artifacts?.["recipe/input-field-live-v3-verifier-v31.ts"] ||
    v32Index.artifacts?.["recipe/input-field-live-v31-restore.ts"]
  )
    failures.push(
      "v32 must hash carried scene-readback-v32 and leave hashed v31 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v31.ts")) !==
    V31_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v31 scene-readback restamped while preparing v32");
  for (const [artifactPath, metadata] of Object.entries(
    v33Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v33 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v33-authorization") ||
      artifactPath.includes("input-field-live-v33-preflight") ||
      artifactPath.includes("input-field-live-v33-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v33 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v33Index.artifacts?.["recipe/scene-readback-v33.ts"] ||
    !v33Index.artifacts?.["recipe/scene-readback-runtime-v33.ts"] ||
    !v33Index.artifacts?.["recipe/input-field-live-v3-verifier-v33.ts"] ||
    !v33Index.artifacts?.["recipe/input-field-live-v33-restore.ts"] ||
    !v33Index.artifacts?.[`${V33_ROOT}/programs/restore-blueprint.js`] ||
    !v33Index.artifacts?.[`${V33_ROOT}/programs/writer-payload.js`] ||
    v33Index.artifacts?.["recipe/scene-readback.ts"] ||
    v33Index.artifacts?.["recipe/scene-readback-v32.ts"] ||
    v33Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v33Index.artifacts?.["recipe/input-field-live-v3-verifier-v32.ts"] ||
    v33Index.artifacts?.["recipe/input-field-live-v32-restore.ts"]
  )
    failures.push(
      "v33 must hash carried scene-readback-v33 and leave hashed v32 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v32.ts")) !==
    V32_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v32 scene-readback restamped while preparing v33");
  for (const [artifactPath, metadata] of Object.entries(
    v34Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v34 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v34-authorization") ||
      artifactPath.includes("input-field-live-v34-preflight") ||
      artifactPath.includes("input-field-live-v34-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v34 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v34Index.artifacts?.["recipe/scene-readback-v34.ts"] ||
    !v34Index.artifacts?.["recipe/scene-readback-runtime-v34.ts"] ||
    !v34Index.artifacts?.["recipe/input-field-live-v3-verifier-v34.ts"] ||
    !v34Index.artifacts?.["recipe/input-field-live-v34-restore.ts"] ||
    !v34Index.artifacts?.[`${V34_ROOT}/programs/restore-blueprint.js`] ||
    !v34Index.artifacts?.[`${V34_ROOT}/programs/writer-payload.js`] ||
    v34Index.artifacts?.["recipe/scene-readback.ts"] ||
    v34Index.artifacts?.["recipe/scene-readback-v33.ts"] ||
    v34Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v34Index.artifacts?.["recipe/input-field-live-v3-verifier-v33.ts"] ||
    v34Index.artifacts?.["recipe/input-field-live-v33-restore.ts"]
  )
    failures.push(
      "v34 must hash carried scene-readback-v34 and leave hashed v33 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v33.ts")) !==
    V33_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v33 scene-readback restamped while preparing v34");
  for (const [artifactPath, metadata] of Object.entries(
    v35Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v35 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v35-authorization") ||
      artifactPath.includes("input-field-live-v35-preflight") ||
      artifactPath.includes("input-field-live-v35-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v35 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v35Index.artifacts?.["recipe/scene-readback-v35.ts"] ||
    !v35Index.artifacts?.["recipe/scene-readback-runtime-v35.ts"] ||
    !v35Index.artifacts?.["recipe/input-field-live-v3-verifier-v35.ts"] ||
    !v35Index.artifacts?.["recipe/input-field-live-v35-restore.ts"] ||
    !v35Index.artifacts?.[`${V35_ROOT}/programs/restore-blueprint.js`] ||
    !v35Index.artifacts?.[`${V35_ROOT}/programs/writer-payload.js`] ||
    v35Index.artifacts?.["recipe/scene-readback.ts"] ||
    v35Index.artifacts?.["recipe/scene-readback-v34.ts"] ||
    v35Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v35Index.artifacts?.["recipe/input-field-live-v3-verifier-v34.ts"] ||
    v35Index.artifacts?.["recipe/input-field-live-v34-restore.ts"]
  )
    failures.push(
      "v35 must hash carried scene-readback-v35 and leave hashed v34 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v34.ts")) !==
    V34_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v34 scene-readback restamped while preparing v35");
  for (const [artifactPath, metadata] of Object.entries(
    v36Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v36 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v36-authorization") ||
      artifactPath.includes("input-field-live-v36-preflight") ||
      artifactPath.includes("input-field-live-v36-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v36 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v36Index.artifacts?.["recipe/scene-readback-v36.ts"] ||
    !v36Index.artifacts?.["recipe/scene-readback-runtime-v36.ts"] ||
    !v36Index.artifacts?.["recipe/input-field-live-v3-verifier-v36.ts"] ||
    !v36Index.artifacts?.["recipe/input-field-live-v36-restore.ts"] ||
    !v36Index.artifacts?.[`${V36_ROOT}/programs/restore-blueprint.js`] ||
    !v36Index.artifacts?.[`${V36_ROOT}/programs/writer-payload.js`] ||
    v36Index.artifacts?.["recipe/scene-readback.ts"] ||
    v36Index.artifacts?.["recipe/scene-readback-v35.ts"] ||
    v36Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v36Index.artifacts?.["recipe/input-field-live-v3-verifier-v35.ts"] ||
    v36Index.artifacts?.["recipe/input-field-live-v35-restore.ts"]
  )
    failures.push(
      "v36 must hash carried scene-readback-v36 and leave hashed v35 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v35.ts")) !==
    V35_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v35 scene-readback restamped while preparing v36");
  for (const [artifactPath, metadata] of Object.entries(
    v37Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v37 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v37-authorization") ||
      artifactPath.includes("input-field-live-v37-preflight") ||
      artifactPath.includes("input-field-live-v37-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v37 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v37Index.artifacts?.["recipe/scene-readback-v37.ts"] ||
    !v37Index.artifacts?.["recipe/scene-readback-runtime-v37.ts"] ||
    !v37Index.artifacts?.["recipe/input-field-live-v3-verifier-v37.ts"] ||
    !v37Index.artifacts?.["recipe/input-field-live-v37-restore.ts"] ||
    !v37Index.artifacts?.[`${V37_ROOT}/programs/restore-blueprint.js`] ||
    !v37Index.artifacts?.[`${V37_ROOT}/programs/writer-payload.js`] ||
    v37Index.artifacts?.["recipe/scene-readback.ts"] ||
    v37Index.artifacts?.["recipe/scene-readback-v36.ts"] ||
    v37Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v37Index.artifacts?.["recipe/input-field-live-v3-verifier-v36.ts"] ||
    v37Index.artifacts?.["recipe/input-field-live-v36-restore.ts"]
  )
    failures.push(
      "v37 must hash carried scene-readback-v37 and leave hashed v36 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v36.ts")) !==
    V36_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v36 scene-readback restamped while preparing v37");
  for (const [artifactPath, metadata] of Object.entries(
    v38Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v38 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v38-authorization") ||
      artifactPath.includes("input-field-live-v38-preflight") ||
      artifactPath.includes("input-field-live-v38-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v38 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v38Index.artifacts?.["recipe/scene-readback-v38.ts"] ||
    !v38Index.artifacts?.["recipe/scene-readback-runtime-v38.ts"] ||
    !v38Index.artifacts?.["recipe/input-field-live-v3-verifier-v38.ts"] ||
    !v38Index.artifacts?.["recipe/input-field-live-v38-restore.ts"] ||
    !v38Index.artifacts?.[`${V38_ROOT}/programs/restore-blueprint.js`] ||
    !v38Index.artifacts?.[`${V38_ROOT}/programs/writer-payload.js`] ||
    v38Index.artifacts?.["recipe/scene-readback.ts"] ||
    v38Index.artifacts?.["recipe/scene-readback-v37.ts"] ||
    v38Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v38Index.artifacts?.["recipe/input-field-live-v3-verifier-v37.ts"] ||
    v38Index.artifacts?.["recipe/input-field-live-v37-restore.ts"]
  )
    failures.push(
      "v38 must hash carried scene-readback-v38 and leave hashed v37 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v37.ts")) !==
    V37_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v37 scene-readback restamped while preparing v38");
  for (const [artifactPath, metadata] of Object.entries(
    v39Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v39 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v39-authorization") ||
      artifactPath.includes("input-field-live-v39-preflight") ||
      artifactPath.includes("input-field-live-v39-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v39 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v39Index.artifacts?.["recipe/scene-readback-v39.ts"] ||
    !v39Index.artifacts?.["recipe/scene-readback-runtime-v39.ts"] ||
    !v39Index.artifacts?.["recipe/input-field-live-v3-verifier-v39.ts"] ||
    !v39Index.artifacts?.["recipe/input-field-live-v39-restore.ts"] ||
    !v39Index.artifacts?.[`${V39_ROOT}/programs/restore-blueprint.js`] ||
    !v39Index.artifacts?.[`${V39_ROOT}/programs/writer-payload.js`] ||
    v39Index.artifacts?.["recipe/scene-readback.ts"] ||
    v39Index.artifacts?.["recipe/scene-readback-v38.ts"] ||
    v39Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v39Index.artifacts?.["recipe/input-field-live-v3-verifier-v38.ts"] ||
    v39Index.artifacts?.["recipe/input-field-live-v38-restore.ts"]
  )
    failures.push(
      "v39 must hash carried scene-readback-v39 and leave hashed v38 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v38.ts")) !==
    V38_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v38 scene-readback restamped while preparing v39");
  for (const [artifactPath, metadata] of Object.entries(
    v40Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v40 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v40-authorization") ||
      artifactPath.includes("input-field-live-v40-preflight") ||
      artifactPath.includes("input-field-live-v40-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v40 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v40Index.artifacts?.["recipe/scene-readback-v40.ts"] ||
    !v40Index.artifacts?.["recipe/scene-readback-runtime-v40.ts"] ||
    !v40Index.artifacts?.["recipe/input-field-live-v3-verifier-v40.ts"] ||
    !v40Index.artifacts?.["recipe/input-field-live-v40-restore.ts"] ||
    !v40Index.artifacts?.[`${V40_ROOT}/programs/restore-blueprint.js`] ||
    !v40Index.artifacts?.[`${V40_ROOT}/programs/writer-payload.js`] ||
    v40Index.artifacts?.["recipe/scene-readback.ts"] ||
    v40Index.artifacts?.["recipe/scene-readback-v39.ts"] ||
    v40Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v40Index.artifacts?.["recipe/input-field-live-v3-verifier-v39.ts"] ||
    v40Index.artifacts?.["recipe/input-field-live-v39-restore.ts"]
  )
    failures.push(
      "v40 must hash carried scene-readback-v40 and leave hashed v39 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v39.ts")) !==
    V39_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v39 scene-readback restamped while preparing v40");
  for (const [artifactPath, metadata] of Object.entries(
    v41Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v41 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v41-authorization") ||
      artifactPath.includes("input-field-live-v41-preflight") ||
      artifactPath.includes("input-field-live-v41-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v41 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v41Index.artifacts?.["recipe/scene-readback-v41.ts"] ||
    !v41Index.artifacts?.["recipe/scene-readback-runtime-v41.ts"] ||
    !v41Index.artifacts?.["recipe/input-field-live-v3-verifier-v41.ts"] ||
    !v41Index.artifacts?.["recipe/input-field-live-v41-restore.ts"] ||
    !v41Index.artifacts?.[`${V41_ROOT}/programs/restore-blueprint.js`] ||
    !v41Index.artifacts?.[`${V41_ROOT}/programs/writer-payload.js`] ||
    v41Index.artifacts?.["recipe/scene-readback.ts"] ||
    v41Index.artifacts?.["recipe/scene-readback-v40.ts"] ||
    v41Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v41Index.artifacts?.["recipe/input-field-live-v3-verifier-v40.ts"] ||
    v41Index.artifacts?.["recipe/input-field-live-v40-restore.ts"]
  )
    failures.push(
      "v41 must hash carried scene-readback-v41 and leave hashed v40 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v40.ts")) !==
    V40_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v40 scene-readback restamped while preparing v41");
  for (const [artifactPath, metadata] of Object.entries(
    v42Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v42 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v42-authorization") ||
      artifactPath.includes("input-field-live-v42-preflight") ||
      artifactPath.includes("input-field-live-v42-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v42 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v42Index.artifacts?.["recipe/scene-readback-v42.ts"] ||
    !v42Index.artifacts?.["recipe/scene-readback-runtime-v42.ts"] ||
    !v42Index.artifacts?.["recipe/input-field-live-v3-verifier-v42.ts"] ||
    !v42Index.artifacts?.["recipe/input-field-live-v42-restore.ts"] ||
    !v42Index.artifacts?.[`${V42_ROOT}/programs/restore-blueprint.js`] ||
    !v42Index.artifacts?.[`${V42_ROOT}/programs/writer-payload.js`] ||
    v42Index.artifacts?.["recipe/scene-readback.ts"] ||
    v42Index.artifacts?.["recipe/scene-readback-v41.ts"] ||
    v42Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v42Index.artifacts?.["recipe/input-field-live-v3-verifier-v41.ts"] ||
    v42Index.artifacts?.["recipe/input-field-live-v41-restore.ts"]
  )
    failures.push(
      "v42 must hash carried scene-readback-v42 and leave hashed v41 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v41.ts")) !==
    V41_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v41 scene-readback restamped while preparing v42");
  for (const [artifactPath, metadata] of Object.entries(
    v43Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v43 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v43-authorization") ||
      artifactPath.includes("input-field-live-v43-preflight") ||
      artifactPath.includes("input-field-live-v43-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v43 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v43Index.artifacts?.["recipe/scene-readback-v43.ts"] ||
    !v43Index.artifacts?.["recipe/scene-readback-runtime-v43.ts"] ||
    !v43Index.artifacts?.["recipe/input-field-live-v3-verifier-v43.ts"] ||
    !v43Index.artifacts?.["recipe/input-field-live-v43-restore.ts"] ||
    !v43Index.artifacts?.[`${V43_ROOT}/programs/restore-blueprint.js`] ||
    !v43Index.artifacts?.[`${V43_ROOT}/programs/writer-payload.js`] ||
    v43Index.artifacts?.["recipe/scene-readback.ts"] ||
    v43Index.artifacts?.["recipe/scene-readback-v42.ts"] ||
    v43Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v43Index.artifacts?.["recipe/input-field-live-v3-verifier-v42.ts"] ||
    v43Index.artifacts?.["recipe/input-field-live-v42-restore.ts"]
  )
    failures.push(
      "v43 must hash carried scene-readback-v43 and leave hashed v42 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v42.ts")) !==
    V42_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v42 scene-readback restamped while preparing v43");
  for (const [artifactPath, metadata] of Object.entries(
    v44Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v44 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v44-authorization") ||
      artifactPath.includes("input-field-live-v44-preflight") ||
      artifactPath.includes("input-field-live-v44-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v44 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v44Index.artifacts?.["recipe/scene-readback-v44.ts"] ||
    !v44Index.artifacts?.["recipe/scene-readback-runtime-v44.ts"] ||
    !v44Index.artifacts?.["recipe/input-field-live-v3-verifier-v44.ts"] ||
    !v44Index.artifacts?.["recipe/input-field-live-v44-restore.ts"] ||
    !v44Index.artifacts?.[`${V44_ROOT}/programs/restore-blueprint.js`] ||
    !v44Index.artifacts?.[`${V44_ROOT}/programs/writer-payload.js`] ||
    v44Index.artifacts?.["recipe/scene-readback.ts"] ||
    v44Index.artifacts?.["recipe/scene-readback-v43.ts"] ||
    v44Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v44Index.artifacts?.["recipe/input-field-live-v3-verifier-v43.ts"] ||
    v44Index.artifacts?.["recipe/input-field-live-v43-restore.ts"]
  )
    failures.push(
      "v44 must hash carried scene-readback-v44 and leave hashed v43 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v43.ts")) !==
    V43_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v43 scene-readback restamped while preparing v44");
  for (const [artifactPath, metadata] of Object.entries(
    v45Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v45 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v45-authorization") ||
      artifactPath.includes("input-field-live-v45-preflight") ||
      artifactPath.includes("input-field-live-v45-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v45 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v45Index.artifacts?.["recipe/scene-readback-v45.ts"] ||
    !v45Index.artifacts?.["recipe/scene-readback-runtime-v45.ts"] ||
    !v45Index.artifacts?.["recipe/input-field-live-v3-verifier-v45.ts"] ||
    !v45Index.artifacts?.["recipe/input-field-live-v45-restore.ts"] ||
    !v45Index.artifacts?.[`${V45_ROOT}/programs/restore-blueprint.js`] ||
    !v45Index.artifacts?.[`${V45_ROOT}/programs/writer-payload.js`] ||
    v45Index.artifacts?.["recipe/scene-readback.ts"] ||
    v45Index.artifacts?.["recipe/scene-readback-v44.ts"] ||
    v45Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v45Index.artifacts?.["recipe/input-field-live-v3-verifier-v44.ts"] ||
    v45Index.artifacts?.["recipe/input-field-live-v44-restore.ts"]
  )
    failures.push(
      "v45 must hash carried scene-readback-v45 and leave hashed v44 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v44.ts")) !==
    V44_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v44 scene-readback restamped while preparing v45");
  for (const [artifactPath, metadata] of Object.entries(
    v46Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v46 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v46-authorization") ||
      artifactPath.includes("input-field-live-v46-preflight") ||
      artifactPath.includes("input-field-live-v46-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v46 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v46Index.artifacts?.["recipe/scene-readback-v46.ts"] ||
    !v46Index.artifacts?.["recipe/scene-readback-runtime-v46.ts"] ||
    !v46Index.artifacts?.["recipe/input-field-live-v3-verifier-v46.ts"] ||
    !v46Index.artifacts?.["recipe/input-field-live-v46-restore.ts"] ||
    !v46Index.artifacts?.[`${V46_ROOT}/programs/restore-blueprint.js`] ||
    !v46Index.artifacts?.[`${V46_ROOT}/programs/writer-payload.js`] ||
    v46Index.artifacts?.["recipe/scene-readback.ts"] ||
    v46Index.artifacts?.["recipe/scene-readback-v45.ts"] ||
    v46Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v46Index.artifacts?.["recipe/input-field-live-v3-verifier-v45.ts"] ||
    v46Index.artifacts?.["recipe/input-field-live-v45-restore.ts"]
  )
    failures.push(
      "v46 must hash carried scene-readback-v46 and leave hashed v45 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v45.ts")) !==
    V45_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v45 scene-readback restamped while preparing v46");
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v25.ts")) !==
      V25_SCENE_READBACK_SHA256_PIN ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v24.ts")) !==
      V24_SCENE_READBACK_SHA256_PIN ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v23.ts")) !==
      V23_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-v22.ts")) !==
      V22_SCENE_READBACK_SHA256 ||
    sha256(readRepositoryEvidence(`${V26_ROOT}/programs/writer.txt`)) !==
      V12_WRITER_PROGRAM_SHA256 ||
    sha256(readRepositoryEvidence("recipe/scene-readback-runtime-v26.ts")) !==
      V16_RUNTIME_SOURCE_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/extract-blueprint.js`),
    ) !== V16_EXTRACT_BLUEPRINT_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V16_ROOT}/programs/restore-blueprint.js`),
    ) !== V16_RESTORE_BLUEPRINT_SHA256
  )
    failures.push(
      "v16/v25 hashed writer, restore, runtime, extract, or scene-readback restamped while preparing v26",
    );
  if (
    v5Index.artifactVersion !== "input-live-v5-index-v1" ||
    v5Index.status !== V5_INDEX_STATUS ||
    v5Index.antecedent?.executableCommit !== V5_ANTECEDENT_COMMIT ||
    v5Index.antecedent?.protocolFirstAddCommit !==
      V5_PROTOCOL_FIRST_ADD_COMMIT ||
    v5Index.protocol?.sha256 !== V5_PROTOCOL_SHA256 ||
    v5Index.authorization?.sha256 !== V5_AUTHORIZATION_SHA256 ||
    v5Index.authorization?.present !== true ||
    v5Index.authorization?.committed !== false ||
    v5Index.authorization?.authorized !== false ||
    v5Index.authorization?.v4AuthorizationReusable !== false ||
    v5Index.attempts?.executed !== 0 ||
    v5Index.attempts?.next !== 1 ||
    v5Index.attempts?.maximum !== 3 ||
    v5Index.liveExecutionOccurred !== false ||
    v5Index.captureArtifactsPresent !== false ||
    v5Index.outcomes !== null ||
    v5Index.humanSignoff !== "pending" ||
    v5Index.overallInputSuccess !== false
  )
    failures.push("v5 draft authorization/attempt/status overclaim");
  for (const artifact of [
    v5Index.authorization,
    v5Index.generated?.writer,
    v5Index.generated?.transportEnvelope,
    v5Index.generated?.transportWrapper,
    v5Index.generated?.writerPlan,
    v5Index.generated?.conformance,
    ...(v5Index.generated?.expectedScenePlans ?? []),
  ] as Array<{ path: string; sha256: string }>) {
    if (
      !artifact?.path ||
      !artifact.sha256 ||
      sha256(readRepositoryEvidence(artifact.path)) !== artifact.sha256
    )
      failures.push(`v5 generated artifact hash mismatch: ${artifact?.path}`);
  }
  for (const [dependencyPath, dependencyHash] of Object.entries(
    protocol.implementationDependencies?.sha256 ?? {},
  )) {
    if (
      typeof dependencyHash !== "string" ||
      sha256(
        execFileSync(
          "git",
          ["show", `${INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT}:${dependencyPath}`],
          { encoding: "buffer" },
        ),
      ) !== dependencyHash
    ) {
      failures.push(`v3 attempt-1 dependency hash mismatch: ${dependencyPath}`);
    }
  }
  if (
    Object.keys(protocol.implementationDependencies?.sha256 ?? {}).length === 0
  ) {
    failures.push("v3 implementation dependency denominator is zero");
  }
  for (const [dependencyPath, dependencyHash] of Object.entries(
    index.runtimeCorrection?.dependencies ?? {},
  )) {
    if (
      typeof dependencyHash !== "string" ||
      sha256(
        execFileSync(
          "git",
          [
            "show",
            `6903d31eb015933a6796722d25f6155fb13332ce:${dependencyPath}`,
          ],
          { encoding: "buffer" },
        ),
      ) !== dependencyHash
    )
      failures.push(
        `v3 correction dependency hash mismatch: ${dependencyPath}`,
      );
  }
  if (
    Object.keys(index.runtimeCorrection?.dependencies ?? {}).length === 0 ||
    index.runtimeCorrection?.nextAttempt !== null ||
    index.runtimeCorrection?.maximumAttempts !== 3 ||
    index.runtimeCorrection?.authorizationReusable !== false ||
    index.runtimeCorrection?.newAuthorizationArtifactRequired !== true
  )
    failures.push("v3 correction dependency/attempt status");
  try {
    readInputLiveV3Attempt1HardFailure();
  } catch (error) {
    failures.push(
      `v3 attempt 1 hard-failure evidence: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    readInputLiveV3Attempt2HardFailure();
  } catch (error) {
    failures.push(
      `v3 attempt 2 hard-failure evidence: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    readInputLiveV3Attempt3HardFailure();
  } catch (error) {
    failures.push(
      `v3 attempt 3 hard-failure evidence: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    readInputLiveV4Protocol();
  } catch (error) {
    failures.push(
      `v4 draft protocol: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    sha256(
      readRepositoryEvidence(
        "recipe/evidence/input-field-live-pivot-v4/normalization-fixtures.json",
      ),
    ) !== "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13"
  )
    failures.push("v4 normalization fixture hash mismatch");
  for (const artifact of [
    ...status.button.supersededHistoricalArtifacts,
    ...status.input.liveV2.historicalArtifacts,
  ] as Array<{ path: string; sha256: string }>) {
    if (sha256(readRepositoryEvidence(artifact.path)) !== artifact.sha256) {
      failures.push(`historical artifact hash mismatch: ${artifact.path}`);
    }
  }
  if (failures.length > 0)
    throw new Error(`recipe pivot status invalid:\n${failures.join("\n")}`);
  process.stdout.write(`Recipe pivot status: ${STATUS_INDEX_STATUS}\n`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  verifyPivotStatus();
}
