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
  "Input live v3 exhausted; v4 non-executable; v5 and v6 retired; v7 attempt 1 failed closed; v8 attempts 1-2 failed closed; v9 attempts 1-2 failed closed; v10 attempts 1-2 failed closed; v11 attempt 1 failed closed; v12 attempt 1 failed closed; v13 attempt 1 failed closed; v14 attempt 1 failed closed; v15 attempt 1 failed closed; v16 attempt 1 failed closed; v17 attempt 1 failed closed; v18 attempt 1 failed closed; v19 attempt 1 failed closed; v20 attempt 1 failed closed; v21 draft antecedent pending separate authorization; Button/Input false; human signoff pending";
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
  "draft antecedent; pending separate authorization; live execution forbidden";
const V21_BASE_COMMIT = "1cc5177e6d76e92f4950a674d3370959557f03c8";
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
    status.input?.liveV21?.authorizationPresent !== false ||
    status.input?.liveV21?.authorizationCommitted !== false ||
    status.input?.liveV21?.authorizationEffective !== false ||
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
    status.input?.liveV21?.attemptsExecuted !== 0 ||
    status.input?.liveV21?.nextAttempt !== 1 ||
    status.input?.liveV21?.liveExecutionOccurred !== false ||
    status.input?.liveV21?.figmaWrites !== 0 ||
    status.input?.liveV21?.figmaCaptures !== 0 ||
    status.input?.liveV21?.humanSignoff !== "pending" ||
    status.input?.liveV21?.overallInputSuccess !== false
  )
    fail("v3 exhausted/v4-v21 current status");
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
    v21Status.authorization?.present !== false ||
    v21Status.authorization?.committed !== false ||
    v21Status.authorization?.effective !== false ||
    v21Status.authorization?.v20AuthorizationReusable !== false ||
    v21Status.smallestHonestDelta?.taughtSurfaceLayoutHeightFromHeightValue !==
      true ||
    v21Status.smallestHonestDelta?.v20SceneReadbackUnchanged !== true ||
    v21Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v21Status.attemptsExecuted !== 0 ||
    v21Status.liveExecutionOccurred !== false ||
    v21Status.figmaWrites !== 0 ||
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
