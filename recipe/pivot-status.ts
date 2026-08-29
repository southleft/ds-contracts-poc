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
import { validateButtonStatusPlant } from "./button-scene-inversion.js";
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
  "Input live v3 exhausted; v4 non-executable; v5 and v6 retired; v7 attempt 1 failed closed; v8 attempts 1-2 failed closed; v9 attempts 1-2 failed closed; v10 attempts 1-2 failed closed; v11 attempt 1 failed closed; v12 attempt 1 failed closed; v13 attempt 1 failed closed; v14 attempt 1 failed closed; v15 attempt 1 failed closed; v16 attempt 1 failed closed; v17 attempt 1 failed closed; v18 attempt 1 failed closed; v19 attempt 1 failed closed; v20 attempt 1 failed closed; v21 attempt 1 failed closed; v22 attempt 1 failed closed; v23 attempt 1 failed closed; v24 attempt 1 failed closed; v25 attempt 1 failed closed; v26 attempt 1 failed closed; v27 attempt 1 failed closed; v28 attempt 1 failed closed; v29 attempt 1 failed closed; v30 attempt 1 failed closed; v31 attempt 1 failed closed; v32 attempt 1 failed closed; v33 attempt 1 failed closed; v34 attempt 1 failed closed; v35 attempt 1 failed closed; v36 attempt 1 failed closed; v37 attempt 1 failed closed; v38 attempt 1 failed closed; v39 attempt 1 failed closed; v40 attempt 1 failed closed; v41 attempt 1 failed closed; v42 attempt 1 failed closed; v43 attempt 1 failed closed; v44 attempt 1 failed closed; v45 attempt 1 failed closed; v46 attempt 1 failed closed; v47 attempt 1 failed closed; v48 attempt 1 failed closed; v49 attempt 1 failed closed; v50 attempt 1 failed closed; v51 attempt 1 failed closed; v52 attempt 1 failed closed; v53 attempt 1 failed closed; v54 attempt 1 failed closed; v55 attempt 1 failed closed; v56 attempt 1 failed closed; v57 attempt 1 failed closed; v58 attempt 1 failed closed; v59 attempt 1 failed closed; v60 attempt 1 failed closed; v61 attempt 1 failed closed; v62 attempt 1 failed closed; v63 attempt 1 failed closed; v64 attempt 1 failed closed; v65 attempt 1 failed closed; v66 attempt 1 failed closed; v67 attempt 1 failed closed; v68 attempt 1 failed closed; v69 attempt 1 failed closed; v70 attempt 1 failed closed; v71 attempt 1 failed closed; v72 attempt 1 failed closed; v73 attempt 1 failed closed; v74 attempt 1 failed closed; v75 attempt 1 failed closed; v76 attempt 1 failed closed; v77 attempt 1 failed closed; v78 attempt 1 failed closed; v79 attempt 1 failed closed; v80 attempt 1 failed closed; v81 attempt 1 failed closed; v82 attempt 1 failed closed; v83 attempt 1 failed closed; v84 attempt 1 closed after cleanup; mint did not stay; v85 attempt 1 mint stayed; Input live human grade passed 2026-08-28 (TJ Pitre; page 115:295378); Button extras-drop teach landed (silent derived, Altitude 149/8706, Fluent 149/8778, extras 1, not zero); stopped on fonts/set chrome; Button human signoff pending; Combobox live v1 attempt 1 failed closed at restore 240 vs 144; mint cleaned; Combobox live v2 attempt 1 failed closed at extract SCENE-DIRECT-OWNERSHIP-METADATA envelopeHash; restore 144 held; mint cleaned; Combobox live v3 attempt 1 failed closed at extract SCENE-GENERATED-DESCENDANT-DIRECT-KEY; restore 144 held; mint cleaned; Combobox live v4 attempt 1 failed closed at host normalize payload.content.text; extract walk cleared; restore 144 held; mint cleaned; Combobox live v5 attempt 1 failed closed at host observeSceneFacts scene projection lost root; empty-payload teaching cleared; restore 144 held; mint cleaned; Combobox live v6 attempt 1 failed closed at collapse non-instance repetition; observeSceneFacts live-root teaching cleared; restore 144 held; mint cleaned; Combobox live v7 attempt 1 failed closed at collapse invalid ARIA/data model; componentRef teaching cleared; restore 144 held; mint cleaned; Combobox live v8 attempt 1 failed closed at collapse invalid ARIA/data model; writer ARIA stamp teaching cleared; restore 144 held; mint cleaned; Combobox live v9 attempt 1 failed closed at collapse unsupported structural edit; host property-name-before-# teaching cleared; restore 144 held; mint cleaned; Combobox live v10 attempt 1 failed closed at collapse unsupported structural edit; host trigger binding compile-order teaching cleared; restore 144 held; mint cleaned; Combobox live v11 attempt 1 failed closed at collapse unsupported structural edit; host leading-slot binding compile-order teaching cleared; restore 144 held; mint cleaned; Combobox live v12 attempt 1 failed closed at collapse unsupported structural edit; host leading-slot compile-carry visible teaching cleared; restore 144 held; mint cleaned; Combobox live v13 attempt 1 failed closed at collapse unsupported structural edit; host trailing-slot binding compile-order teaching cleared; restore 144 held; mint cleaned; Combobox live v14 attempt 1 failed closed at collapse unsupported structural edit; host trailing-slot compile-carry visible teaching cleared; restore 144 held; mint cleaned; Combobox live v15 attempt 1 failed closed at collapse unsupported structural edit; host trigger empty-effects teaching cleared; restore 144 held; mint cleaned; Combobox live v16 attempt 1 failed closed at collapse unsupported structural edit; host overlay binding compile-order teaching cleared; restore 144 held; mint cleaned; Combobox live v17 attempt 1 failed closed at collapse unsupported structural edit; host overlay width-alias teaching cleared; restore 144 held; mint cleaned; Combobox live v18 attempt 1 failed closed at collapse unsupported structural edit; host listbox binding compile-order teaching cleared; restore 144 held; mint cleaned; Combobox live v19 attempt 1 failed closed at collapse unsupported structural edit; host option-instance binding extras-drop teaching cleared; restore 144 held; mint cleaned; Combobox live v20 attempt 1 failed closed at collapse unsupported structural edit; host option-instance inherited-fills omit teaching cleared; restore 144 held; mint cleaned; Combobox live v21 attempt 1 failed closed at collapse unsupported structural edit; host option-instance payload omit teaching cleared; restore 144 held; mint cleaned; Combobox live v22 attempt 1 failed closed at collapse unsupported structural edit; host listbox clipsContent omit teaching cleared; restore 144 held; mint cleaned; Combobox live v23 attempt 1 failed closed at collapse unsupported structural edit; host listbox cornerRadius omit teaching cleared; restore 144 held; mint cleaned; Combobox live v24 attempt 1 failed closed at collapse unsupported structural edit; host listbox empty-effects omit teaching cleared; restore 144 held; mint cleaned; Combobox live v25 attempt 1 failed closed at collapse unsupported structural edit; host listbox empty-strokes omit teaching cleared; restore 144 held; mint cleaned; Combobox live v26 attempt 1 failed closed at collapse unsupported structural edit; host overlay empty-dashPattern omit teaching cleared; restore 144 held; mint cleaned; Combobox live v27 attempt 1 failed closed at collapse unsupported structural edit; host set-root clipsContent omit teaching cleared; restore 144 held; mint cleaned; Combobox live v28 attempt 1 failed closed at collapse unsupported structural edit; host option binding compile-order teaching cleared; restore 144 held; mint cleaned; Combobox live v29 attempt 1 failed closed at collapse unsupported structural edit; host option height-alias teaching cleared; restore 144 held; mint cleaned; Combobox live v30 attempt 1 failed closed at collapse unsupported structural edit; host option clipsContent omit teaching cleared; restore 144 held; mint cleaned; Input 115:295378 stayed; Combobox live v41 attempt 1 mint stayed on page 163:35981; probe and 72 captures passed; cleanup persisted not executed; TJ named feedback 2026-08-29 empty/loading listbox padding not a miss (listPadding 4/0/4/0 survived); no remint; Combobox live human grade passed 2026-08-29 (TJ Pitre; page 163:35981); RECORD f330a082 humanSignoff stays pending; Table live v1 PREPARE f42aaa461 and AUTHORIZE fd3d20e98 landed; attempt 1 failed closed at writer TABLE-FONT-PROVENANCE-TAMPER:Arial:Bold; host lists Inter Semi Bold; mint cleaned; Input 115:295378 and Combobox 163:35981 stayed; Table live v2 PREPARE ccc0e8975 and AUTHORIZE 4272b14ec landed; attempt 1 failed closed at writer TABLE-COMPONENT-PROPERTY-REFERENCES-UNRECOGNIZED-KEY:Label#165:24507; header Inter Semi Bold teaching cleared; mint cleaned; Input 115:295378 and Combobox 163:35981 stayed; do not restart v2 attempt 2 as-is; Table live v3 PREPARE 868ec9b0a and AUTHORIZE 1c03d3665 landed; attempt 1 failed closed at writer TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER; nested cell-label TEXT characters teaching cleared; mint cleaned; Input 115:295378 and Combobox 163:35981 stayed; do not restart v3 attempt 2 as-is; Table live v4 prepared; one teaching bind row Cell N on original non-instance-sublayer TEXT in the row component through host-listed characters; remaining Data Table, Calendar, Button leftover inversion; product v1 incomplete";
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
const V46_SCENE_READBACK_SHA256_PIN =
  "8e81de6ed4a199eb2563881cba5b82a7d41e4e7acaa462250a1525f10c6374df";
const V47_ROOT = "recipe/evidence/input-field-live-pivot-v47";
const V47_PROTOCOL_SHA256 =
  "9b06466d4832f1b35e464d4abdf189fabfcfad1f11d253e5b1b3b8b59f6217a2";
const V47_PLAN_SHA256 =
  "76d92d7a2402aecb2542003058edc3fb5fb5681f81ecd838f05bbcbd74892712";
const V47_CAPTURE_MANIFEST_SHA256 =
  "325cbd97c16864c5b061170585ed680be43131e83eb8f81632f73e9214c598b5";
const V47_REQUEST_MANIFEST_SHA256 =
  "892bb1b709b89714fe0cb6d1d67d9186c9bf02e9e8714b7ff9d6fc552ea4a139";
const V47_INDEX_SHA256 =
  "1bcb077c1027293313c5a13fd8edce84d07926926fa520b122e0d9b16abe4aaa";
const V47_HASH_SET_SHA256 =
  "d4a2817a6a1223eecf31074a36c60342ca4c5242f6192361cf5175f47e88f053";
const V47_AUTHORIZATION_TEMPLATE_SHA256 =
  "1a2116083e69f6ce5fcc12762282c6f6f48ab7e8e310a423ad5a3f77e3b3d96d";
const V47_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v47-status.json";
const V47_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message-container clipsContent; cleanup complete";
const V47_BASE_COMMIT = "59af9ac2b328d6b09fdaade6dc72fb8b20ae2210";
const V47_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v47-attempt-1.json";
const V47_ATTEMPT_1_SHA256 =
  "882a411c04e584023dece06869566c83b03bbe806f3733417cf8028d2853bf95";
const V47_ANTECEDENT_COMMIT = "6f54b8485aeab163764fb9dee17a85dd34e2a205";
const V47_AUTHORIZATION_PATH = `${V47_ROOT}/capture-authorization.json`;
const V47_AUTHORIZATION_SHA256 =
  "ec849b01af1a9c3f0dfeab908eb4c4e121ef0168e7e80c4193ca50ed04e245f6";
const V47_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "66cdf310038c25480ebb0b0f03f00a581dea826227f3533b9308ce7295365f13";
const V47_SCENE_READBACK_SHA256_PIN =
  "8696c4a047e0f6ec8a8a49c78db8ff725a5e4e61afe0e452ad5cd835bf11b49c";
const V48_ROOT = "recipe/evidence/input-field-live-pivot-v48";
const V48_PROTOCOL_SHA256 =
  "dcd15e579d79d6e190c045b31d2cc4ef0b4c75ed1037d3a2bf0d5066b04e3883";
const V48_PLAN_SHA256 =
  "63cc096da1b50e443acfa860c38ed681def37cc814898f22e5eb59471cdf6bdc";
const V48_CAPTURE_MANIFEST_SHA256 =
  "8e2c742e7e4d631a18563912fef27da9fb92c34e5e91ebbd2ace92b4b2069ede";
const V48_REQUEST_MANIFEST_SHA256 =
  "d4ff630050ec246ed100e89a7703cbb2a7d15fe01527b943f08403e49908aabe";
const V48_INDEX_SHA256 =
  "02d7172e47b4cb2a465fdc4d1618f2ae1a9b27c24f901dd2a6d55e7d8ce4562c";
const V48_HASH_SET_SHA256 =
  "32b57338e4a8bbfcb15adb47190230c780d7040078693c8a9d07354130d1a69c";
const V48_AUTHORIZATION_TEMPLATE_SHA256 =
  "8bf76877e81b8324b81ba1dd8eacd370031cf937438f78f0b14a24bf1cad9b52";
const V48_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v48-status.json";
const V48_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message-container cornerRadius; cleanup complete";
const V48_BASE_COMMIT = "f37a99bf97ae6547d3cdf8bb5ca7ee29f4fe269c";
const V48_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v48-attempt-1.json";
const V48_ATTEMPT_1_SHA256 =
  "571be348582a7ca3f839e1fa1185d1bea62d0be2673857a73dde51f825218070";
const V48_ANTECEDENT_COMMIT = "bdb000e3ae75863594aa40f5dc6318af53af2000";
const V48_AUTHORIZATION_PATH = `${V48_ROOT}/capture-authorization.json`;
const V48_AUTHORIZATION_SHA256 =
  "38fac942caa02fa92b18f7410e51b173c65538d60d4523f2925967f7f6c43b62";
const V48_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "c46c65ccb8c922ef457de75bfafda574ee8e4d1703ec41312fd00b0516f86211";
const V48_SCENE_READBACK_SHA256_PIN =
  "ee191e3b30982ab238afea52e492ae4a15ef0ea3825e8875245c0a73e6f92d8d";
const V49_ROOT = "recipe/evidence/input-field-live-pivot-v49";
const V49_PROTOCOL_SHA256 =
  "dba18739946c6ee18625234c6a7a00d45a07efe1c0f15fa8e6b706d5b1ad0b8b";
const V49_PLAN_SHA256 =
  "f4e973f65d7b1a973529acc5f181f8f4b7b051f2929da016df83d97f307a17dd";
const V49_CAPTURE_MANIFEST_SHA256 =
  "317c33fdeb21d3589f09172b5547f68acc45a5333947334bf7bed813f065268c";
const V49_REQUEST_MANIFEST_SHA256 =
  "30d6af0e9bfee2b5adae479eeea1e31b022eb1c24acae260c11dd882f1f0ac98";
const V49_INDEX_SHA256 =
  "bc8782ca1e68fb64d152cad7e2530772bb85ac3d96164e0d9a113260780d36b3";
const V49_HASH_SET_SHA256 =
  "2e06ff6160360f2a7e3bbf54771b5420704bb3b4dbfd845beca7e4b5a8334dae";
const V49_AUTHORIZATION_TEMPLATE_SHA256 =
  "25778474a3323eda593029e43a76d104fdcdf22bb46fafb1d428fc3309e96dba";
const V49_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v49-status.json";
const V49_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message-container effects; cleanup complete";
const V49_BASE_COMMIT = "68d2849b28cbf5c925c4e4403733ae1d3f3969fd";
const V49_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v49-attempt-1.json";
const V49_ATTEMPT_1_SHA256 =
  "65a178e6c926bc7110e622a2bd21949f3060f0ed30306b58b0265b165cf40aae";
const V49_ANTECEDENT_COMMIT = "52442d178d16d35ad5f67483cfd053d394c633d1";
const V49_AUTHORIZATION_PATH = `${V49_ROOT}/capture-authorization.json`;
const V49_AUTHORIZATION_SHA256 =
  "f39494933f103e87876395bcc3e669244939e008ff79816a43589bbff53441c9";
const V49_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "a5b0b0f31afcc23dca32ab97ffcede51c79c96a9fb4fe44b5eaa165423602a5d";
const V49_SCENE_READBACK_SHA256_PIN =
  "d3206a68dbea208b2d1f612a7d1606d26c295d6648b05d3e83eff6a79efd6dc6";
const V50_ROOT = "recipe/evidence/input-field-live-pivot-v50";
const V50_PROTOCOL_SHA256 =
  "a50fdc9d6e92d6d81bde2e1d5f038605fd53cfcfe33334839c00bf82809e77a5";
const V50_PLAN_SHA256 =
  "c40da4c44d9b0de096871346fd0ef64d712d676c64776fee5ba3bf64c8fb6d46";
const V50_CAPTURE_MANIFEST_SHA256 =
  "00c20004e456f15b657a7e636810cab6768e3595ba3e826d980b6f91570960de";
const V50_REQUEST_MANIFEST_SHA256 =
  "d8eb3a2f40ac4923c2aacc367b99b97069fc0516580a5b6f53a0a515a2a9cae2";
const V50_INDEX_SHA256 =
  "9a427acb4327a50fdb5936f4b80588d994a11c5f770ea1cba9ef7934331e08a3";
const V50_HASH_SET_SHA256 =
  "ba8314db50657d0feb8514b45ca8012dba4b5d25e6ca99e975e94bf7315d4b3f";
const V50_AUTHORIZATION_TEMPLATE_SHA256 =
  "88791fb9aaa2ca4ab497f541063f9df0171ace255891b2037f9a316e54888e58";
const V50_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v50-status.json";
const V50_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused message-container strokes; cleanup complete";
const V50_BASE_COMMIT = "3b77e39ae62b59d50c6adebdaf58a9b2ac19845e";
const V50_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v50-attempt-1.json";
const V50_ATTEMPT_1_SHA256 =
  "5ddacd04a997cf86b07c6a82b36e5d72a4e239c8c8421671a1922abf761d1ecd";
const V50_ANTECEDENT_COMMIT = "b1a74248dea95eebeab7c7c40c1afc1eadb3fcec";
const V50_AUTHORIZATION_PATH = `${V50_ROOT}/capture-authorization.json`;
const V50_AUTHORIZATION_SHA256 =
  "52eee8c911ca08798a26aaf76d314f3bc92cef213b154228ddc9638213cc0574";
const V50_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "92fb1475f58d9ca85f327001c03b0ae4bc46bc0bb6db5254da67b12f80ef93ee";
const V50_SCENE_READBACK_SHA256_PIN =
  "60920dfdc6bc7ecf292f61f53c35ab2e5c9ef855c141ed40789e3b7a3815797e";
const V51_ROOT = "recipe/evidence/input-field-live-pivot-v51";
const V51_PROTOCOL_SHA256 =
  "6fd3c438b65a030a31be5e23292f08620cb3d5b6d07dc7b3a6ef47e168acdb37";
const V51_PLAN_SHA256 =
  "5d95c5eb56cc4c26924a189579453fcb04ffcaa85ba288a449f86324bb6f419c";
const V51_CAPTURE_MANIFEST_SHA256 =
  "8cb1c616a305efe9f57df061e4161c6a4663f5d459499852bc7af9335ca8ff53";
const V51_REQUEST_MANIFEST_SHA256 =
  "6ffe39ddece0f7b3d7548edd0564c82cc1696520fd449fd7c452dd470b031847";
const V51_INDEX_SHA256 =
  "a8ea2199a911f4e5f411efb07741053b11d0ffd4938098d40411e6870a8051cd";
const V51_HASH_SET_SHA256 =
  "03d327ea780fa395de4fa79be2d78b47671b3e929f851c1948b0e757807dbfd5";
const V51_AUTHORIZATION_TEMPLATE_SHA256 =
  "96dcb9b6971cf94ca53ee8c58652e53844ed8873646296e1baea4f13f819e964";
const V51_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v51-status.json";
const V51_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused variant cornerRadius; cleanup complete";
const V51_BASE_COMMIT = "9b5c487f39784cb00bfd88d38a9b03835ede9b66";
const V51_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v51-attempt-1.json";
const V51_ATTEMPT_1_SHA256 =
  "5b6fa61d14e635084d588c9d428a93a86ca998d74e9837a789d903e46d5c9b45";
const V51_ANTECEDENT_COMMIT = "32e4d58df3de0aa86ce162babceef0ea046e1998";
const V51_AUTHORIZATION_PATH = `${V51_ROOT}/capture-authorization.json`;
const V51_AUTHORIZATION_SHA256 =
  "e3de348c136d5acebcb01b84321b261d72a57def576b8473dc1dccfc13b57949";
const V51_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "a3a2478355f0a3f1f3eae13912248df26f744062872405608054498bf9f4c440";
const V51_SCENE_READBACK_SHA256_PIN =
  "5160037b2db00cf657098bbe114cc4c0d94c70c76b39b7d1c0946ac6aa8768da";
const V52_ROOT = "recipe/evidence/input-field-live-pivot-v52";
const V52_PROTOCOL_SHA256 =
  "97a63c3a9e28a27f20be88019bb526fcbebf2743cbca463e8f743934cae52882";
const V52_PLAN_SHA256 =
  "5296c284fb49bac26daa458668873332959ffd4f2d482ead2273bea03cdf9db2";
const V52_CAPTURE_MANIFEST_SHA256 =
  "67469c818fc40b1b855177ae57e76ff1bc38169cace7ad4164416f9474e35499";
const V52_REQUEST_MANIFEST_SHA256 =
  "d97334e59613107aa37a515383b5de8313e28a8599babc7150063ffd1e6c82c0";
const V52_INDEX_SHA256 =
  "d649571a4e3deaaa4a4c83c6024e6479f9afb3832621f8754eea6067a2ed65ba";
const V52_HASH_SET_SHA256 =
  "84b0af9890e19d515610c1a0c9f38e6a188566a4cba10ca225afcc1d3d4b9187";
const V52_AUTHORIZATION_TEMPLATE_SHA256 =
  "a16b3f85b5ffd73a0bfaeb8051681ae4c14a3af55fc0f873d21bf9eebb24f7df";
const V52_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v52-status.json";
const V52_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused variant effects; cleanup complete";
const V52_BASE_COMMIT = "cd38d41524a9b3c9582cbf529a0f1a9ebbfaf98f";
const V52_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v52-attempt-1.json";
const V52_ATTEMPT_1_SHA256 =
  "8d5f0b3e4212cd52a5dba7f3d83c3b083e39f66940e35a6fc714588a3fc7adb4";
const V52_ANTECEDENT_COMMIT = "4646704cfbd743630aff50e954dab0db8dda15c1";
const V52_AUTHORIZATION_PATH = `${V52_ROOT}/capture-authorization.json`;
const V52_AUTHORIZATION_SHA256 =
  "3c3d00cd825bd23cf7afa347b21b6ac7792045de0fbce1b44dde1f195779d744";
const V52_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "d0e74db72349b9d640561832cf4bf47e4068f9f3d4a07959e4c3ad94c791d49f";
const V52_SCENE_READBACK_SHA256_PIN =
  "499d96fd912a1e1614a25a20052d63f2b0581e08bddc0da6576b7130d1a8a71b";
const V53_ROOT = "recipe/evidence/input-field-live-pivot-v53";
const V53_PROTOCOL_SHA256 =
  "21a54bf57de7ded0ec72d544d8f2a7ab0699d328096cc970a306fbcb44240eae";
const V53_PLAN_SHA256 =
  "3891a5a72ea7ec001419e040e6f76f87a5356ea4d86881a6deb407671e7144a5";
const V53_CAPTURE_MANIFEST_SHA256 =
  "46c5dbae76b02d7fcfbc28bff368d24fe9669c6fb1fefcfa3fbebc4e0ef9d571";
const V53_REQUEST_MANIFEST_SHA256 =
  "5f680572856b5973bfe60a98200590663982e7ba521bea24dd5c61aba80d30e0";
const V53_INDEX_SHA256 =
  "6df0d393cb0097f12760598b10d48248f9cfc74009c4d333d3c193be50f0a57b";
const V53_HASH_SET_SHA256 =
  "b8e2b693db47b685ec381f6581114d4cf12dbedd29413bf27f8948dcf9ac9d00";
const V53_AUTHORIZATION_TEMPLATE_SHA256 =
  "16ed1dc39c35d5decd8f9a1556bb73f7b2b14188ec313c25bfee81bb26b5bfea";
const V53_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v53-status.json";
const V53_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused variant strokes; cleanup complete";
const V53_BASE_COMMIT = "50e024b8b546e4701213e5e71c2bb174579e2953";
const V53_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v53-attempt-1.json";
const V53_ATTEMPT_1_SHA256 =
  "58f73567abd17dda411aa1903bcc158f564a15c495e29863b6ab9146b174204d";
const V53_ANTECEDENT_COMMIT = "34f5b20a738770c073d8b2ebffc236293066ddbb";
const V53_AUTHORIZATION_PATH = `${V53_ROOT}/capture-authorization.json`;
const V53_AUTHORIZATION_SHA256 =
  "9bd80794f13755c6b0712162151307da72addd4c87250fa52a82aa358761876c";
const V53_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "6d4081f61748a588bc1a323f47c11730758de10a3a0319d8f51d2e846563dd02";
const V53_SCENE_READBACK_SHA256_PIN =
  "df703ca45fb962cc34ee7a5cb54bac5fb6e927ebdb1a07d1b1ac2b9a4a364d50";
const V54_ROOT = "recipe/evidence/input-field-live-pivot-v54";
const V54_PROTOCOL_SHA256 =
  "e3ab30292c129c6351b0afa8bc7c77736176c243359ce26559a32f747d35153d";
const V54_PLAN_SHA256 =
  "af488ebda038de00db04af83e659d587c4eff9e85151ed75e2c0270f902b24ee";
const V54_CAPTURE_MANIFEST_SHA256 =
  "59cdf797c6acae35f0a9e3e78bc24b361398b97155f4cdda3fa62ecaa6705dee";
const V54_REQUEST_MANIFEST_SHA256 =
  "4ea12cd7f045bff6835afdb1870054bb46792e739055dc790418e4a3e880240c";
const V54_INDEX_SHA256 =
  "fa120b104bcc191513c5f39f10f36138ed3e7b31e9ecae0cce4e7cb0573ac047";
const V54_HASH_SET_SHA256 =
  "ed529d3b56329d3f54152bd837a7ce45b22f8c3e8c6057f57b736a7cbd36daaf";
const V54_AUTHORIZATION_TEMPLATE_SHA256 =
  "586054c5586bd92ba1b66dbfa20d5a62b817cf16f29c51a01700f7ee33c98b71";
const V54_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v54-status.json";
const V54_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused leading-slot binding field order; cleanup complete";
const V54_BASE_COMMIT = "88770e6adc4120e53372fc554e502dad49b57bfb";
const V54_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v54-attempt-1.json";
const V54_ATTEMPT_1_SHA256 =
  "2ae88a0fc29e97910f57f049690fe64b532e1e2fb85b1e8160acf26d0c35cdf6";
const V54_ANTECEDENT_COMMIT = "384095f379168cb5ff44c803eae28ff181e393a9";
const V54_AUTHORIZATION_PATH = `${V54_ROOT}/capture-authorization.json`;
const V54_AUTHORIZATION_SHA256 =
  "49e6885f437869cf932b6797629b4ffd347b82387c0f82894abf6f207260a940";
const V54_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "9df9d259ee55a79dd1e9be562e9aeedab885741f11df49137a783841ca59fa2d";
const V54_SCENE_READBACK_SHA256_PIN =
  "4cc8f210f962c80aed7208102d88b66aff91d418a3438862c067ef91a47b62eb";
const V55_ROOT = "recipe/evidence/input-field-live-pivot-v55";
const V55_PROTOCOL_SHA256 =
  "642bf05dd817b8b23e20da5e0ab892208d86ad3be3ac81cc1f191d3a3dda29c7";
const V55_PLAN_SHA256 =
  "2186a545a470a4e722ae7f26941951c81ea87d38a7a9fe4a95f794e61038419a";
const V55_CAPTURE_MANIFEST_SHA256 =
  "2d19b604507dfe69dd4b3315a46079408114aa2e612cf5bcbc55e3675501ac0c";
const V55_REQUEST_MANIFEST_SHA256 =
  "3954b31a3fe67e062f2ef1395901a570f92083667056a77e86024706ab5a1dec";
const V55_INDEX_SHA256 =
  "aaf8c7dea4d31106caa1e02d3608e762db1a52b9662e9ca94a4837283b493599";
const V55_HASH_SET_SHA256 =
  "89b9500c9c7a9af2e509ac9804a7558b78e0c5c7284b374ee7fe3480d2a0b9c2";
const V55_AUTHORIZATION_TEMPLATE_SHA256 =
  "978922877220e1766b6bfcbdd8e036b85ce3de89adaed8b2d308b951770e4c21";
const V55_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v55-status.json";
const V55_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused trailing-slot binding field order; cleanup complete";
const V55_BASE_COMMIT = "fd75454c6b5e8c5021f9ac7906e634363ea4cf5a";
const V55_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v55-attempt-1.json";
const V55_ATTEMPT_1_SHA256 =
  "3e8fee7754f21993ffdf4868afbe3659499eb0b49b2fcdd2e9a3acd6f8d3d435";
const V55_ANTECEDENT_COMMIT = "975fe07e85595c4d1bf33b4fac8009149a68dbeb";
const V55_AUTHORIZATION_PATH = `${V55_ROOT}/capture-authorization.json`;
const V55_AUTHORIZATION_SHA256 =
  "ff5e07b255b0913dedb9e896cb2752c9700f81405cf42246ceec2d40568c335f";
const V55_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "530b6927f36da65cfe12ea72622d3b88073970abc6641f0109ff0bd9b769bcbd";
const V55_SCENE_READBACK_SHA256_PIN =
  "642790c1e59d7af8f90585b6bd5bb2cd8d5b71a14a21ee2c82009eb6b24f9b76";
const V56_ROOT = "recipe/evidence/input-field-live-pivot-v56";
const V56_PROTOCOL_SHA256 =
  "9bf9fb9cec896ba5e6c190a257377bb17336cbbf5a3af90451e6a0f4fbaf3f09";
const V56_PLAN_SHA256 =
  "98c3b49fffbf81791a0ff017b0cd8c621fc68f5b13262fbeb28c17cbd2ec291f";
const V56_CAPTURE_MANIFEST_SHA256 =
  "2afc1ddcd6e7c47f20c1f08e0f5a568157f3b19d7a43aee8f2679fa31a15f5a2";
const V56_REQUEST_MANIFEST_SHA256 =
  "d08c47923772479f1c37984f6820f904193e9db050a3fed6b957a7ce9000894d";
const V56_INDEX_SHA256 =
  "1c01c6ae05e3482d9a11b63b2eb258c4050f5f96626196a2a03b2b6ca33ac502";
const V56_HASH_SET_SHA256 =
  "160cc4f502d2f86c8c827406f4e4c0b4b95337b18d00c51a58ae8d59310688cf";
const V56_AUTHORIZATION_TEMPLATE_SHA256 =
  "d26162a44c3b05de5817b989fdd1a642c6d426b4ab43f98ed903a7fc4ffbecee";
const V56_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v56-status.json";
const V56_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused required-indicator binding extras and field order; cleanup complete";
const V56_BASE_COMMIT = "0dbd8066894e739fb09c0d3919fff1961de79e25";
const V56_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v56-attempt-1.json";
const V56_ATTEMPT_1_SHA256 =
  "3cc2ef35042c0c7ee73e9927ea7fe2dabb13c7cc3baf5a06cafa1d6945bc79c2";
const V56_ANTECEDENT_COMMIT = "de7df3a31256ae5e728214553902facb7e89e265";
const V56_AUTHORIZATION_PATH = `${V56_ROOT}/capture-authorization.json`;
const V56_AUTHORIZATION_SHA256 =
  "2b391e58efd8ee1701a29b3c620f82fd5b6b5bcd0d8c2618c6022a5d0c3fcc4a";
const V56_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "f11ee09ba711a1bdfef65acd400f800aba2459317bc4d9e1ab51c2d105ef1afe";
const V56_SCENE_READBACK_SHA256_PIN =
  "e4491546aa1a1c7a7037bab2e8a46008254fe6a13e38e83da14118692b16c132";
const V57_ROOT = "recipe/evidence/input-field-live-pivot-v57";
const V57_PROTOCOL_SHA256 =
  "e2d4f80899c8a866e00f07ff2ba7908edebf629a440f24eb17b2d6ee7ebbb223";
const V57_PLAN_SHA256 =
  "c1d609aebb6903162a2e58dcef9596234f2150edc1951042cad5f5bb3259eece";
const V57_CAPTURE_MANIFEST_SHA256 =
  "fb63ace298d404b47f78c87463fa2f99c69295bb820d412686d0de432abd42b0";
const V57_REQUEST_MANIFEST_SHA256 =
  "f4e79f607c89485be296b5cfb076c1b00afbaa324b2fb395a200a9139988d994";
const V57_INDEX_SHA256 =
  "5b2d91f7e2f83191d666ee97b69b46273a6b9ad215ea6764f77b3ba8425451ab";
const V57_HASH_SET_SHA256 =
  "c9df551ac95c227ca8ab1027811f7c92c9376c638809f630faa5a1cf8eb5d094";
const V57_AUTHORIZATION_TEMPLATE_SHA256 =
  "52e8219e392cc7d702ab6c678f19baaaeea506ae7d875d1634aeb5cdfb68e1c3";
const V57_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v57-status.json";
const V57_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused required-indicator type.letterSpacing; cleanup complete";
const V57_BASE_COMMIT = "6b7f6643739157299660b7f77451dbe6f55a561e";
const V57_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v57-attempt-1.json";
const V57_ATTEMPT_1_SHA256 =
  "f50b7b42d1fbf2546b9d19e0518054e68b4b48a7bd84d22847b902d041a2547a";
const V57_ANTECEDENT_COMMIT = "187bce50e3311c3f4040d7eb263ffdbab02d5b06";
const V57_AUTHORIZATION_PATH = `${V57_ROOT}/capture-authorization.json`;
const V57_AUTHORIZATION_SHA256 =
  "6bec9ff3be636f978e08098f42935782da5bfec2d71b92a99bf791d731fb1c13";
const V57_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "ac3fc235272d0f435ecb569ded3dceab541b9bbca72d3c72cb126daa8a9af74f";
const V57_SCENE_READBACK_SHA256_PIN =
  "a46a9f703023dbc7d15a6f7f4e06704310a1e0f4e488e615eeeef1aef2232add";
const V58_ROOT = "recipe/evidence/input-field-live-pivot-v58";
const V58_PROTOCOL_SHA256 =
  "3a16bbdfc7e23fb132e91484ba996ca4a99e9d04672fe97b7fe5f30c5ad41ec5";
const V58_PLAN_SHA256 =
  "bf2732f126de7d3fa95c589a9511f6a4ec5dbdd28a66aa14fdcf0a291023ba7d";
const V58_CAPTURE_MANIFEST_SHA256 =
  "068d1ff5f2063e9b6ac19865cff2f537cc6b0e8446fd8b9bb17561d31df5908f";
const V58_REQUEST_MANIFEST_SHA256 =
  "06dffe9c86d9b9ac1f3b4de812fd9fdf1dcdc48750f8f587df72eea8e2af7f47";
const V58_INDEX_SHA256 =
  "1e368a9f02b8e61fdf0935d977a38021e8c70157876abd6ce5ba5e8ff69f980c";
const V58_HASH_SET_SHA256 =
  "921e055707a9f259c87e0243ca962d67455e90f624a9f06615a9820bc5a4dc2b";
const V58_AUTHORIZATION_TEMPLATE_SHA256 =
  "cfa8e4c5d23dab1b4e1ec36912a43711c1a8c432df2000a9a76741cd9fd0f4dd";
const V58_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v58-status.json";
const V58_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused required-indicator type.textCase; cleanup complete";
const V58_BASE_COMMIT = "0794b6710e6440123103a4863e0da1a13ea74bab";
const V58_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v58-attempt-1.json";
const V58_ATTEMPT_1_SHA256 =
  "41e2de5c5f8c79ea289178b1439a3e122d9760a979c25078bb6b402365807d54";
const V58_ANTECEDENT_COMMIT = "76ee865c07fd9bcf90ce04ed86c7a638294b9488";
const V58_AUTHORIZATION_PATH = `${V58_ROOT}/capture-authorization.json`;
const V58_AUTHORIZATION_SHA256 =
  "efd7160b5bb49b987d698d127904206dbd427be60d7db1e54457c05604de70ce";
const V58_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "9f5e529985ee2a229bad9bf64002db2622d648c215f7b5bdb24d988b0dc7bcc1";
const V58_SCENE_READBACK_SHA256_PIN =
  "76f3bab2e9bcd17b4aab5067cb0ededae2f7e07f051c7ddf787789cfbabec691";
const V59_ROOT = "recipe/evidence/input-field-live-pivot-v59";
const V59_PROTOCOL_SHA256 =
  "33c5330f60a1a22ac114856bae598e34dee6c0ddc4efa635ea357ce8548a3f22";
const V59_PLAN_SHA256 =
  "681ca14a1c22c8c693ecc3bddadc039f09c00222904476cedf8c66bfc671ee86";
const V59_CAPTURE_MANIFEST_SHA256 =
  "749212430c6a73db489caaeb77caf24e3d9a08650a024a77606b71637e882d7e";
const V59_REQUEST_MANIFEST_SHA256 =
  "de12867833d7c8ddb1a9d0847ec50d128bed2be77328d49c0bb639e18d809dba";
const V59_INDEX_SHA256 =
  "1e3247fb49fe2244c38130ece0f218b4133e0b73742eac1777ab22f9fee3f4b1";
const V59_HASH_SET_SHA256 =
  "ec6cc886ae0fc02e7492ae4fbfc8af6354356dea154f53cdd1a3157d27484760";
const V59_AUTHORIZATION_TEMPLATE_SHA256 =
  "02dc5d6a50a9828bcbef8bb3fc886e984fc852c3e35a675e1917a6de5a6570ae";
const V59_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v59-status.json";
const V59_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused required-indicator type.textDecoration; cleanup complete";
const V59_BASE_COMMIT = "a0c763627bbfc0d58bba5b62f52a8d5804f749b9";
const V59_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v59-attempt-1.json";
const V59_ATTEMPT_1_SHA256 =
  "1bd4ab893d8ab0ea27d97283ddd846b2547b94fce3831eb39678154029893111";
const V59_ANTECEDENT_COMMIT = "42a1388bfcfc403030cb719f92c98c7e89dbf6e3";
const V59_AUTHORIZATION_PATH = `${V59_ROOT}/capture-authorization.json`;
const V59_AUTHORIZATION_SHA256 =
  "da9e763ba3815daf2d98e8f9665a549e3ac282bde9b0cb240ea6d3775f362f9a";
const V59_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "42cb6cb1e0d28993946e64a3c2bf173354acdd96c33ced65f1373cd7f37461df";
const V59_SCENE_READBACK_SHA256_PIN =
  "2c4592161da30d317ef6e84613c95d041ddca0edaa7fba80a7376c57c9bcd2f9";
const V60_ROOT = "recipe/evidence/input-field-live-pivot-v60";
const V60_PROTOCOL_SHA256 =
  "eee3bf02f51c8ee72c776936e6a4b963f145fc665b21c3314517cc427ae51115";
const V60_PLAN_SHA256 =
  "0be685e00add49a4fda1b836d4128f517fea8c560dbdbceadef58d9075959454";
const V60_CAPTURE_MANIFEST_SHA256 =
  "8762cc94f62c48dc769f346de2c13adad8cae597d89704275f046d2225831823";
const V60_REQUEST_MANIFEST_SHA256 =
  "865f21c4992f26534ee8abb764e1a87f45c0a7a686c3f13e1ffff59d3c9f3a48";
const V60_INDEX_SHA256 =
  "ae063073e0cd93ebc4a46b514ab00208708567b758da5681354e60c99da905fb";
const V60_HASH_SET_SHA256 =
  "2f71d2f0a0d514c90467596d213254f6bcefad31166c052c35ef62c942f140c4";
const V60_AUTHORIZATION_TEMPLATE_SHA256 =
  "d7fef773072575446acd50fbeb2bf085440198f058c677dcbe6c6db0a537042a";
const V60_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v60-status.json";
const V60_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set cornerRadius; cleanup complete";
const V60_BASE_COMMIT = "554d994da97966181fddd39fbde54b611eb17b6a";
const V60_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v60-attempt-1.json";
const V60_ATTEMPT_1_SHA256 =
  "3914795cde011c63c974f31e8acb14cedbdcb8f50bea8f608882dc5ed5fc65e0";
const V60_ANTECEDENT_COMMIT = "f86ee4e597e2acf961f457b2fb718ea117d1fb91";
const V60_AUTHORIZATION_PATH = `${V60_ROOT}/capture-authorization.json`;
const V60_AUTHORIZATION_SHA256 =
  "29a99e9c6a320e30e2ee0c8a7249032b3a427ba7d837f362823bc626a842e7e5";
const V60_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "063f0fb75d9b4b567a9e9b3f56fff23c8e65eca3cd9dae4302a56e8820cfc309";
const V60_SCENE_READBACK_SHA256_PIN =
  "c0241c506cc15811b2d483a3d7622c583b25d1e4878527b4ddfaabc72a19b4d1";
const V61_ROOT = "recipe/evidence/input-field-live-pivot-v61";
const V61_PROTOCOL_SHA256 =
  "724289bf12ffccfc0e6547f7c7d957015d171b15d1043b88f9424e95503a92f4";
const V61_PLAN_SHA256 =
  "aee22ef258b4c3484e6705e8e55c445e46d8dc6e36d41e6e14515f8596cb964f";
const V61_CAPTURE_MANIFEST_SHA256 =
  "44e46cea22df733d1ef7ab2d2a88e953a59e447f2c3f1c00acc36806879ce139";
const V61_REQUEST_MANIFEST_SHA256 =
  "bd2b29ca3c40072e7cc9f62038cb30c3e958f0981198886925b87110d41c3888";
const V61_INDEX_SHA256 =
  "e5e6f712c266748d99971df0f28da861bbd55c9ded0075d002ace1106df39b0c";
const V61_HASH_SET_SHA256 =
  "c1792479c237481df9ee9a053669a68bd9740af73204e977ad4ae6596ff3ce76";
const V61_AUTHORIZATION_TEMPLATE_SHA256 =
  "c50b0b5816093edd3987b24effd755aadb4d857e28744cdb6fbf27c6a48d71d0";
const V61_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v61-status.json";
const V61_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set effects; cleanup complete";
const V61_BASE_COMMIT = "9583f514266df65fd49bd12d41d106f5a94e1c20";
const V61_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v61-attempt-1.json";
const V61_ATTEMPT_1_SHA256 =
  "1e0e773bbc8e69d06f3f57fd45dfd846c376e2fc4b89220c4f4d8d1513049f9b";
const V61_ANTECEDENT_COMMIT = "08c808c31a72826aa4c691a1aab273b9b6158600";
const V61_AUTHORIZATION_PATH = `${V61_ROOT}/capture-authorization.json`;
const V61_AUTHORIZATION_SHA256 =
  "8e27c3d989d4a9800e40ab8598e6090794255cf8cee64f0bd2ace3a139a791cd";
const V61_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "427d17f43b6265216ded9a62e3665e268a948629f76fef0c7ff57f2bd8074b44";
const V62_ROOT = "recipe/evidence/input-field-live-pivot-v62";
const V62_PROTOCOL_SHA256 =
  "bfa7c9016fd0563e6648f981953eaffab53dd1fc8e1f169e1687dff06e3f9bf6";
const V62_PLAN_SHA256 =
  "a8da5c81241389032707109612869ffc89d4e9c406478678d607be1862d3b8b0";
const V62_CAPTURE_MANIFEST_SHA256 =
  "7f742412ece1fb33ad1fa7891aed322c1a6307a8f9816be5a16983acb70deef0";
const V62_REQUEST_MANIFEST_SHA256 =
  "6eb41ea4d2fcb6ad159f09a072501a7f40b935c754d77c6cf619802f203b8885";
const V62_INDEX_SHA256 =
  "442c1f1d1125bb5fe28edfd2b3e7a92ed99ee66458de1366f4998f414ea37cc2";
const V62_HASH_SET_SHA256 =
  "c916046e2444cf08b3903ef09a2390814d6bbda149cba5f45c899e6910dd90f2";
const V62_AUTHORIZATION_TEMPLATE_SHA256 =
  "d7daaf53b6bd726cf2591175a6c86dd77cc25b72e930c0dd371edd0cea092ca1";
const V62_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v62-status.json";
const V62_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set fills.length; cleanup complete";
const V62_BASE_COMMIT = "40a22952789673aea76ce4d961a40ada8209011f";
const V62_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v62-attempt-1.json";
const V62_ATTEMPT_1_SHA256 =
  "f0358888a1ead75a624c2e8226aa530706099a2697366274b843ce9357bc31d4";
const V62_ANTECEDENT_COMMIT = "0f6b3f0fe7aa6204a88b99ea5b823d2179ed2cb4";
const V62_AUTHORIZATION_PATH = `${V62_ROOT}/capture-authorization.json`;
const V62_AUTHORIZATION_SHA256 =
  "bd887c496b95c0fe7638b2ff321a437ca7c03c48975abed259ca57e36fcfb3ba";
const V62_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "b7422fa3bebef2a6482e5ba158cb73a9450c9e8c2ba78afbc15a0c2cf9414ae5";
const V63_ROOT = "recipe/evidence/input-field-live-pivot-v63";
const V63_PROTOCOL_SHA256 =
  "e9f5a92fdce928479bdc2f8439b6da80e362a2cd4bf4e7518dd2db9e07393fc4";
const V63_PLAN_SHA256 =
  "8663d908256a0829834204288717ee2cdc72e091d8ac21fc1f5b427eaded0568";
const V63_CAPTURE_MANIFEST_SHA256 =
  "e4a05ba661edac9548ec4be53286ca43277f48742290799e903b581ece266c4d";
const V63_REQUEST_MANIFEST_SHA256 =
  "de9126b475c09dc1ed78fdbf8003361fd656ac812f7f9fbf5796a539804d5dda";
const V63_INDEX_SHA256 =
  "70425813fa5986bb8c22164df4df768049302d09d3610b952bd0889275d3425b";
const V63_HASH_SET_SHA256 =
  "040893db9ac12f8897d4d6898fd205581c0a7dc8402e984b58fe844c57024207";
const V63_AUTHORIZATION_TEMPLATE_SHA256 =
  "15798e4e11d648fcd84e52a661e675d26dd6ab1a22fcb7b2860dca32e1042bea";
const V63_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v63-status.json";
const V63_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set layout.mode; cleanup complete";
const V63_BASE_COMMIT = "42279ccda7cf3c1f8cae0dd1408ec7ad86c90f03";
const V63_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v63-attempt-1.json";
const V63_ATTEMPT_1_SHA256 =
  "87372e07b5245a391c59f698c043577705a2a2762559772477769036fd8f15be";
const V63_ANTECEDENT_COMMIT = "08bcae728ec245222c2c9eec07938c8f86af78f0";
const V63_AUTHORIZATION_PATH = `${V63_ROOT}/capture-authorization.json`;
const V63_AUTHORIZATION_SHA256 =
  "169d85c1eb93c5bd9c4c4c586b1355b135503a19a128800109519a3f3e543cf9";
const V63_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "3efd14ed27a07f1146f486eaa84dc811ec323c01fb54dfc48b37b902edde299a";
const V64_ROOT = "recipe/evidence/input-field-live-pivot-v64";
const V64_PROTOCOL_SHA256 =
  "257c23c25e6083d7e8fd4f9c05271c8e18043c990425ef5325c8fb1df1e29261";
const V64_PLAN_SHA256 =
  "4230ebd08f438dfae596abcaf956dab765d3bd096a3059df0ffd8770625cda19";
const V64_CAPTURE_MANIFEST_SHA256 =
  "f08a3b822a8a3edd55f8f1799ddaac4f5bae33243a2ba8be5b9d4c16de2dcee3";
const V64_REQUEST_MANIFEST_SHA256 =
  "08dd0738739d6c50d2bdbcde8ff735674f1418d64b6dff6a7e09aa4256d6a3be";
const V64_INDEX_SHA256 =
  "5d6b32ee7190d6ad789292ba9242dd8b05c36d3234ef1b2fe21b204638304ac6";
const V64_HASH_SET_SHA256 =
  "86956d80d0d3da748692831a72840f4ba47efc0e500520d27112f7c7b953fd7a";
const V64_AUTHORIZATION_TEMPLATE_SHA256 =
  "5bec15ba35421e02e89eaec70d8767391090bee59c6a3636b3063603e0ad6de4";
const V64_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v64-status.json";
const V64_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set layout.padding.bottom; cleanup complete";
const V64_BASE_COMMIT = "5aad4d905912bea70f4704109b9b27e4c0764e11";
const V64_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v64-attempt-1.json";
const V64_ATTEMPT_1_SHA256 =
  "e624849c3bc96dbb74b0a740c35744f0f871778b08621e1cf515a0457793fb8f";
const V64_ANTECEDENT_COMMIT = "efcc7cf17dbd06f108dbe5edbcbee119067ca91d";
const V64_AUTHORIZATION_PATH = `${V64_ROOT}/capture-authorization.json`;
const V64_AUTHORIZATION_SHA256 =
  "bf69bca502af34653721726d153480c4b7be9f3639adf6c4b3924f9f53ccc2cf";
const V64_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "00d3469d4b98e5bc80422104ac796a3b5bd6b96b8ad141b4ab425631e58efe6a";
const V65_ROOT = "recipe/evidence/input-field-live-pivot-v65";
const V65_PROTOCOL_SHA256 =
  "70a64fd2a6d06045e767fa10883a1aa2c48e421aeb3710c8404dc43dc499c0d1";
const V65_PLAN_SHA256 =
  "906477747df9a21cf683456adc2e9693ca7005c89d9a082af1355b7c4171174a";
const V65_CAPTURE_MANIFEST_SHA256 =
  "026d2f9bcba807cc3871623096eb1d139b7096e85a39e67aaa08adcad5fa3cd4";
const V65_REQUEST_MANIFEST_SHA256 =
  "33058fa4f1f7bdc869d4b8be2d92159b2ec266168bd7bc498a8fb25cdf7d89e9";
const V65_INDEX_SHA256 =
  "c58cea06652ca0adb51e6a68276f820e3bfa196e4191c454fb0602e751151356";
const V65_HASH_SET_SHA256 =
  "e6cde315480f936f192ef73bf807b2e49049fb022018d9347acfe2c27a4b3f74";
const V65_AUTHORIZATION_TEMPLATE_SHA256 =
  "d4d10b0dd4e0b0b877182f1da93039358b0424304b74737cd1d534385719a5c7";
const V65_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v65-status.json";
const V65_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set layout.width.mode; cleanup complete";
const V65_BASE_COMMIT = "172aed6a0f3cfb985382801a8ba98c88473336df";
const V65_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v65-attempt-1.json";
const V65_ATTEMPT_1_SHA256 =
  "f80ff1df5bc5c0da2a1de80c32046670e2a056a46bf89c1b4917505b5756c87d";
const V65_ANTECEDENT_COMMIT = "4102d81390d981e5fde5db7b8d46b9b2f3ab83c4";
const V65_AUTHORIZATION_PATH = `${V65_ROOT}/capture-authorization.json`;
const V65_AUTHORIZATION_SHA256 =
  "ef81aeec6f342967dcc09334a63de5a24f521d02b9f4911bca22a5ae6a0fdb86";
const V65_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "d1e7efd2fece7c3416b7a6bc7c1f2da838181ac6276737c71ef0995c0f28788e";
const V66_ROOT = "recipe/evidence/input-field-live-pivot-v66";
const V66_PROTOCOL_SHA256 =
  "9c8364a981e66eff9efd2a79201a1344c9c80c910ff96904b0773ba1f75be600";
const V66_PLAN_SHA256 =
  "8f5b423c6ede95c003686c52d1a2e31df4101f510c869e3d28f737782f7d9c06";
const V66_CAPTURE_MANIFEST_SHA256 =
  "d2eee1797a3c16faa37b3036a0dcc041bd561401cce75e4f4dd887988ced10f4";
const V66_REQUEST_MANIFEST_SHA256 =
  "189c78ae3962a966a1adf124d13f9759d2bc3902bc68f75c46c311a0709baad9";
const V66_INDEX_SHA256 =
  "e368b48be937996cc888f0792c9d89a4cd9c753ce0f1b3b110a6fa914e052e59";
const V66_HASH_SET_SHA256 =
  "6556a22c8f7b62f45253034785ed08629908e71d9d5ac5fac0a31c69dedc274c";
const V66_AUTHORIZATION_TEMPLATE_SHA256 =
  "6fd83bf7e816ec2381390d450f8b15c2f5312efb980571f20ec65c94edd6c774";
const V66_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v66-status.json";
const V66_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused set strokes; cleanup complete";
const V66_BASE_COMMIT = "5ccc52545b604c1f44b7ad0e7ea6cf58ed8c65f0";
const V66_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v66-attempt-1.json";
const V66_ATTEMPT_1_SHA256 =
  "9e053ba8168d9596f9d67ae7afcb80cb724ae8c2495952402b560e6307e43cb8";
const V66_ANTECEDENT_COMMIT = "4f08701a7204d36cee363e5fd4725e8fd1af01cb";
const V66_AUTHORIZATION_PATH = `${V66_ROOT}/capture-authorization.json`;
const V66_AUTHORIZATION_SHA256 =
  "8dde188b1f6764c286e260b4149857abf1de3acc8abaa0359e90755f5ddb4c0d";
const V66_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "78ad6a53d3858803f0ca20958989165e2a3a995be2414767ea68b90ce350c55f";
const V67_ROOT = "recipe/evidence/input-field-live-pivot-v67";
const V67_PROTOCOL_SHA256 =
  "004629b0e96461e227f84c660801011b48ea54a17c143f33f649e4225e5b9dfb";
const V67_PLAN_SHA256 =
  "8a305ba4c36b2877f84018c196d69292dcd8f2c584efe038894969e36069c1c4";
const V67_CAPTURE_MANIFEST_SHA256 =
  "318eceea99156af5174b2cfa6cf921ce05e1506a17b46efaf45f46f8e7919053";
const V67_REQUEST_MANIFEST_SHA256 =
  "1d2e5b3e904c354b9342eb85828b30d8749f8e25bf6e5e5396e104ad79b4d5ca";
const V67_INDEX_SHA256 =
  "c5f2f551ce0b64390b42735e90ac6cd2d5e4283f21da85ed7a150b8b68c95384";
const V67_HASH_SET_SHA256 =
  "28a152f6aa24a0f8928fa9944fc991b7e5f976161c92cfbd508828b1cfb39371";
const V67_AUTHORIZATION_TEMPLATE_SHA256 =
  "4f704a79e6df896f534f791bf4fdd8da35a5cccbe762c6d8d6bc295ed156ac92";
const V67_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v67-status.json";
const V67_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused Polar label-row bindings[1].field; cleanup complete";
const V67_BASE_COMMIT = "0ec36dec9aed15dd11b230c5fa373bbe102360a6";
const V67_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v67-attempt-1.json";
const V67_ATTEMPT_1_SHA256 =
  "c80357afa2fc1802f5b9e2b1a2410ed53e0d375c6dce041d645ed47d479e7436";
const V67_ANTECEDENT_COMMIT = "c129c6b8df484061cdf3fb6bc695c8b78c41db58";
const V67_AUTHORIZATION_PATH = `${V67_ROOT}/capture-authorization.json`;
const V67_AUTHORIZATION_SHA256 =
  "62288d19db1fd59b51e15077ae0782f46146f6eec2b0d94a54dcf8d69d112294";
const V67_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "0126571b64968a906002cce76976da9435267c714a875788b46b84500b50ebf1";
const V68_ROOT = "recipe/evidence/input-field-live-pivot-v68";
const V68_PROTOCOL_SHA256 =
  "1387fc53a9df4056ba546b6a138df148b06b6650b9ea5ed90f0ae7fe46093ef3";
const V68_PLAN_SHA256 =
  "ba1b30251096ac489038801ff687b98d0d73f2485557809e9d243185e2136418";
const V68_CAPTURE_MANIFEST_SHA256 =
  "e014fd392cd9aef7e453750124a318e5cef49ed5890d68b4a345980936d33e61";
const V68_REQUEST_MANIFEST_SHA256 =
  "286d90eca8bf5492395f9c84abfdc98922d2c496be981efdf9cb3c93ad9c7013";
const V68_INDEX_SHA256 =
  "c0026cb6fce6cdb094e83f9bd84eeac82a2ca865ae0a95e02af4c84435575e07";
const V68_HASH_SET_SHA256 =
  "3df08ee2b5c48879928334f61aafc8536325cf0ee22aae4445c77c80525f312f";
const V68_AUTHORIZATION_TEMPLATE_SHA256 =
  "865c662431d985f7588231ce1f3f561daa2e2cb3703875842b031797827f7aa1";
const V68_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v68-status.json";
const V68_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; host refused Polar surface bindings[0].field; cleanup complete";
const V68_BASE_COMMIT = "b2c2805f5fb0e49b66d1a9a7ae719c2479e5c732";
const V68_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v68-attempt-1.json";
const V68_ATTEMPT_1_SHA256 =
  "3ef6bcc5960960e5cfa70befb8633c59cafb63ce15c1b6e5635edf4c2fa1e802";
const V68_ANTECEDENT_COMMIT = "9df90119ab1b29c7f340f8b340e4b57661948bf2";
const V68_AUTHORIZATION_PATH = `${V68_ROOT}/capture-authorization.json`;
const V68_AUTHORIZATION_SHA256 =
  "94175d4aff4488c65589d295fa0a310be047b966ea16a28d5a3581c1f1203412";
const V68_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "d36af9c965b0c6731f8eca3772923c6b1c3e78e6c29494a37ebd7f9bbd0f1c05";
const V69_ROOT = "recipe/evidence/input-field-live-pivot-v69";
const V69_PROTOCOL_SHA256 =
  "47e86f6c06352463f431f2e7d7a0303f2b6d35bbb8e12bcadf6e2429215fb532";
const V69_PLAN_SHA256 =
  "b5a72ccfe5fb723f35c7f30ad8f3c518dfcc56654f348443303fe23a8acab64d";
const V69_CAPTURE_MANIFEST_SHA256 =
  "4cd65f60392b64641ad5584288a500d451bdb07bb2535cbf567c370e4e584075";
const V69_REQUEST_MANIFEST_SHA256 =
  "f785278dbe1afc68a41051b56a01683f938e5455b20d8c2d5b9d075199df85c0";
const V69_INDEX_SHA256 =
  "e84dd63369b41ae97c8126f2c0d21c6edad57df4affcf8292552009c431b60a0";
const V69_HASH_SET_SHA256 =
  "467c0810057c16f66c66fb423b5eb2a88815db7ed82f5a8c2791e2bee42f6c12";
const V69_AUTHORIZATION_TEMPLATE_SHA256 =
  "4ee2d22069f1f05211de75dac8100159e686a5c9c0d9f1febd4b35e0821479fa";
const V69_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v69-status.json";
const V69_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-mismatched; cleanup complete";
const V69_BASE_COMMIT = "8cc8ed4f516b375556bff396a3f965e825cc7826";
const V69_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v69-attempt-1.json";
const V69_ATTEMPT_1_SHA256 =
  "dbbf8d668ca69e0af86acd183f35924d425d97b568dc3d9bc98e458f7c857333";
const V69_ANTECEDENT_COMMIT = "2c4cba6b635eefe4649f63327ae4fa604b93c97a";
const V69_AUTHORIZATION_PATH = `${V69_ROOT}/capture-authorization.json`;
const V69_AUTHORIZATION_SHA256 =
  "7ab2a3f0dec58cda42aa92dd59672d42c9e35c1a5439b5621be184070a42b2fa";
const V69_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "bbfa4133357dfc87235cd4410925acf24aed468ac087c1d1e8f37705b392b36d";
const V70_ROOT = "recipe/evidence/input-field-live-pivot-v70";
const V70_PROTOCOL_SHA256 =
  "5679f00542e4d1633250e8f45ce6cc91217b08aaecb9549a8b03dfd59bf6129c";
const V70_PLAN_SHA256 =
  "53539aaca689660558bc762c64bd260a9faa2e1961d99c944ed668785f7e75b8";
const V70_CAPTURE_MANIFEST_SHA256 =
  "08408bb5f40c12bc8265de5c4b1904649608c927d63e615e2a7de187f252fc5a";
const V70_REQUEST_MANIFEST_SHA256 =
  "5495729985dc13c44fb3eb83ce69777854e67d292b333fe2df4537399eb1070c";
const V70_INDEX_SHA256 =
  "d5d3d68fdc90954862f467c889a8a0b68fcd4e62b6316cb8abdb066aaaa9a2de";
const V70_HASH_SET_SHA256 =
  "d534be4c90d9e0ba1c5e3c416910f9a2dfc5f6b040a6bf149a9a03ed797678b1";
const V70_AUTHORIZATION_TEMPLATE_SHA256 =
  "e50af3f3475cab59d60eb41368bc58ef48c389f84a499e9977159b14fba092a3";
const V70_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v70-status.json";
const V70_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-mismatched; cleanup complete";
const V70_BASE_COMMIT = "04350cb9d5bf829af0084438a5c90843b2c936a6";
const V70_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v70-attempt-1.json";
const V70_ATTEMPT_1_SHA256 =
  "6dab317c62e4dac8662f5fa88b8ea866c47748866e91c3646c7236b3769ce47a";
const V70_ANTECEDENT_COMMIT = "7dec097c890d1fb888024b43ecddeec880321083";
const V70_AUTHORIZATION_PATH = `${V70_ROOT}/capture-authorization.json`;
const V70_AUTHORIZATION_SHA256 =
  "64567c9f95c68d8f03fd784b2cf28f3f1f8ce26004421d06f35d82d629588073";
const V70_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "4cec0fd5afe392a52618fdcfa80f17ebb7703657594785b35da62a9bed50a97b";
const V71_ROOT = "recipe/evidence/input-field-live-pivot-v71";
const V71_PROTOCOL_SHA256 =
  "bc3a538d879f52903742486cc2e2f7d904336045cb77d9e453cafde279596117";
const V71_PLAN_SHA256 =
  "a681638dc5aa33967200c75e73a4ad7f9eabcd672eb7f522ea72351e8d76b5fd";
const V71_CAPTURE_MANIFEST_SHA256 =
  "7aff62a36c532bf675a5d109833a2ebd9614f67173acc859c4c897438e226b1a";
const V71_REQUEST_MANIFEST_SHA256 =
  "71229eb707178ea52cb6bcdeb9a13acaf3b6e742540f02fc813cf2577c76bb37";
const V71_INDEX_SHA256 =
  "46f4e75e41461c13315771c1b03fabc20c938b56a04947d754dc7d308433930e";
const V71_HASH_SET_SHA256 =
  "f04680ec26cbeb8dfa81333567d67f06c3fad4eda7fba735393907bbf43610b3";
const V71_AUTHORIZATION_TEMPLATE_SHA256 =
  "03ee541f2ef7dc3ac9c6fcf56401da30c766bbe26f6d55e302a8fbf086689526";
const V71_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v71-status.json";
const V71_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-mismatched; cleanup complete";
const V71_BASE_COMMIT = "42b7187d64960c2d4346fe29d7c8b9eb62d2f89d";
const V71_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v71-attempt-1.json";
const V71_ATTEMPT_1_SHA256 =
  "96a9ebbe6eb43ccb36c1bc87b09aebfb84072841d04a182e39ecdf95889ffcdf";
const V71_ANTECEDENT_COMMIT = "01c3b92ab24642b187cfb441aa621452b22cc4e3";
const V71_AUTHORIZATION_PATH = `${V71_ROOT}/capture-authorization.json`;
const V71_AUTHORIZATION_SHA256 =
  "1de20ef035c0b67ad84972cda9b6672e87d31521d8db85c64db2dff95d88aacf";
const V71_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "945cf2f238f40218f1bf601079edf7f9a294105a77a9797c0a066b03c5361d69";
const V72_ROOT = "recipe/evidence/input-field-live-pivot-v72";
const V72_PROTOCOL_SHA256 =
  "b0a487d6f823ed9df6c98d67948065408cd3857917e9778a913383db8c576dee";
const V72_PLAN_SHA256 =
  "40f8890fd5471747de5cd2d4f3cf478e058970bfbc0a3a8d504def35e55b30ef";
const V72_CAPTURE_MANIFEST_SHA256 =
  "e4a60abaa874cf9b6214c02890fb47659dc56f658388639f39ad455c42ca6ee3";
const V72_REQUEST_MANIFEST_SHA256 =
  "69e04d9768aa2eb547c6626abd5181e5fe1ac63654cb13e46f518c22d5ef0475";
const V72_INDEX_SHA256 =
  "3409911929ca248fcdf1284943bc97e9b3d6f79ff366e051af2b6e7927ff3757";
const V72_HASH_SET_SHA256 =
  "76ea7fb9cbea9ac2dbe7386c40c7ca45346da2460c695012edd4a3abbb8121ba";
const V72_AUTHORIZATION_TEMPLATE_SHA256 =
  "2bb04dc4a02da2a31f60019bf21a2758528e2187eba2b46856aaf5307f3d66c8";
const V72_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v72-status.json";
const V72_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-mismatched; cleanup complete";
const V72_BASE_COMMIT = "4e1c203dafd8989b513b74efde340f370ebb9812";
const V72_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v72-attempt-1.json";
const V72_ATTEMPT_1_SHA256 =
  "77c2197668f04e45c1811a70750a763cff276a108713dcd01248dee98ba286c0";
const V72_ANTECEDENT_COMMIT = "a2dcad5c04a79c6a5ce6d6859395eb4dce0eb26a";
const V72_AUTHORIZATION_PATH = `${V72_ROOT}/capture-authorization.json`;
const V72_AUTHORIZATION_SHA256 =
  "029131405e4873a2455d98ffc113a978c896759bfa342d7a0d9c16d0c3050496";
const V72_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "936cfd3f56cefa41ba9fe33494ac78e1ec2646ec4f82e33af39fd6c4931796fe";
const V73_ROOT = "recipe/evidence/input-field-live-pivot-v73";
const V73_PROTOCOL_SHA256 =
  "4ba3e79ce86cea7673a4dabf611cacf8f348e78e6f9b3b1b842d938d781123c6";
const V73_PLAN_SHA256 =
  "3e86afb65a53c1c0680fb0d17d4be9d3cbf30292c6eaaab7c65663c207bfd4cb";
const V73_CAPTURE_MANIFEST_SHA256 =
  "c498673245890fd69017c8fbf04cd86216ae271c60e141a2dcdf041fd596fd98";
const V73_REQUEST_MANIFEST_SHA256 =
  "407313f8174a49d292eff51efec095832a83dd8975aef222201c0cb1662bea5a";
const V73_INDEX_SHA256 =
  "d2d4ef64f9810b35492a6108487b6dfa6d099f20111b068a8c34ec017e2c4ec8";
const V73_HASH_SET_SHA256 =
  "9ecae62b862d9202953869c8b16311ef76f2536ea309e53884cbbdb565c86a8a";
const V73_AUTHORIZATION_TEMPLATE_SHA256 =
  "a6ea648c39fd66c0bf969b45661ee0c8e2dd65f0892bf402333d579a3afcae92";
const V73_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v73-status.json";
const V73_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-zero; probe/usability/restoration failed; cleanup complete";
const V73_BASE_COMMIT = "b7ca64184884bdddc9393056de87a0ae248d6501";
const V73_ANTECEDENT_COMMIT = "a0bea7197119793da5283954bf5e70609a038162";
const V73_AUTHORIZATION_PATH = `${V73_ROOT}/capture-authorization.json`;
const V73_AUTHORIZATION_SHA256 =
  "85caa395611c60e6ef76431935d8192255a87277cd951e86f08ae986328c797b";
const V73_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "f642994b12dcecf2c3630def11a1b439438b7dfed3283557577078897a71f332";
const V73_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v73-attempt-1.json";
const V73_ATTEMPT_1_SHA256 =
  "3f75d932b1a73b334aaf37ff588789f81c1d5a187441ba800ed539639426e9ff";
const V74_ROOT = "recipe/evidence/input-field-live-pivot-v74";
const V74_PROTOCOL_SHA256 =
  "b253ae91a13a2238ae081cdd5fb6dd65f947f1bd84f1670b3f870e23f59b786f";
const V74_PLAN_SHA256 =
  "da942083176c5dbb445a3a7c885c150cd6801ce4362fd6a0a9d41425507ee804";
const V74_CAPTURE_MANIFEST_SHA256 =
  "2878e20da46510ddfc4ea79c379d97751273a5ac82d8fd014c9ab50efd133af1";
const V74_REQUEST_MANIFEST_SHA256 =
  "2b87f1e5bad0c59937a4f18bfe882f540d4fde9e9cc3cb92c02004b412d64d6b";
const V74_INDEX_SHA256 =
  "5e62706cebd29b978323884b30cfeac875027d1dca14f4551a3d7ebe34d91a5f";
const V74_HASH_SET_SHA256 =
  "1f0e0bd0206193039a38d5f2600bfa976d1ff9294bc229e6f2f5b40123501186";
const V74_AUTHORIZATION_TEMPLATE_SHA256 =
  "c38a41f2af8ae2b5cf2c3b9264028748d2eb90b2b7b9859630c70771ee2204a3";
const V74_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v74-status.json";
const V74_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-zero; probe first-segment role held; probe/usability/restoration failed; cleanup complete";
const V74_BASE_COMMIT = "99211d3f819a109817743a489995cb63a9292331";
const V74_ANTECEDENT_COMMIT = "ca299c1ae5dcdbe67106997604ead808473a1d65";
const V74_AUTHORIZATION_PATH = `${V74_ROOT}/capture-authorization.json`;
const V74_AUTHORIZATION_SHA256 =
  "365e6d5c3f7199e0eac0c0161007ad6fc853a4360b18789912f9074e20782e2e";
const V74_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "eaa2fc6af223d5a0fbf98d211834c4d5b9de2e69b3b7729856c4608b9c358d61";
const V74_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v74-attempt-1.json";
const V74_ATTEMPT_1_SHA256 =
  "bfb7d5670c052cca764b4fa3d057920835af5db45ebd99f72a84e64cba67fda4";
const V75_ROOT = "recipe/evidence/input-field-live-pivot-v75";
const V75_PROTOCOL_SHA256 =
  "bf4fc6d13a2ed0386453e40144755b7f3614fe1630f39c859399f72d67f9193b";
const V75_PLAN_SHA256 =
  "145ada59bbacab8359bbd8ad2996ebf03cef0b056d865354311b1f1f54b1f4bf";
const V75_CAPTURE_MANIFEST_SHA256 =
  "a9ed56661180c7b80f781a5a71d20974edd9fd392fd4b83dded4d0a4bdda1317";
const V75_REQUEST_MANIFEST_SHA256 =
  "005e37ed384728947ccf10516b0b277b1a848cf27c86a89c9405e3445ef0612c";
const V75_INDEX_SHA256 =
  "b42844ec6165062ce26615428e18df8123a446115cc940d35fa1de548ab05889";
const V75_HASH_SET_SHA256 =
  "b07ad2bace5b25f7dcdb750078d4c8c340aecb8dfa70397a3a8c2fb6dba84780";
const V75_AUTHORIZATION_TEMPLATE_SHA256 =
  "4b9d4fe5d3a7c9f5317b23864c961e30e43bdfc551415b053fb7f955ae93a3b4";
const V75_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v75-status.json";
const V75_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-zero; probe Polar reflow/contentFill held; MUI contentFill newly false; probe/usability/restoration failed; cleanup complete";
const V75_BASE_COMMIT = "57867ac50e3a4264d543f8feac6b2ce8f2c0976a";
const V75_ANTECEDENT_COMMIT = "f12bf40ba9c81b65f34d25e0c4155be6e29238ce";
const V75_AUTHORIZATION_PATH = `${V75_ROOT}/capture-authorization.json`;
const V75_AUTHORIZATION_SHA256 =
  "ea17c49752ad42bf9e83d197d973ed5ff1b7afeef3998b358006db5e62ea2acd";
const V75_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "2748d17cf71e07d7509ffca3fa1983b8067ceb7089e4d4fa63d4f6e914be9924";
const V75_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v75-attempt-1.json";
const V75_ATTEMPT_1_SHA256 =
  "f2f42334e56b92a88837c01285bb55dcc8f1de290c4be43811119c859ed28d61";
const V76_ROOT = "recipe/evidence/input-field-live-pivot-v76";
const V76_PROTOCOL_SHA256 =
  "b8182ebb5f23b9fd863001ddb65a27110940208d7d0b5b3ae2011567089526ef";
const V76_PLAN_SHA256 =
  "86ce517b28c3cc3a78b06c57e226f9950864401d70aa5e81caf70648d7c717ad";
const V76_CAPTURE_MANIFEST_SHA256 =
  "86194d0e4829a2e849f13962e61f0a8a032edfd2bec2814b03049d48e7230cd6";
const V76_REQUEST_MANIFEST_SHA256 =
  "63750b7f089324514063980ea8547f2ee912c6214fb6a8935e7592c97127af41";
const V76_INDEX_SHA256 =
  "2fe97436ae8dca0b97bd7f95dc052ab0911bf7ae05f6dfdebfebb17a71edd606";
const V76_HASH_SET_SHA256 =
  "b726956240200180581298cd5fa2ffdb0f49da22e8c77ce5b1387c4f8917b61f";
const V76_AUTHORIZATION_TEMPLATE_SHA256 =
  "3b5bcd3e1f6fa74cf6725486fa28379e3bc59e8e5c7ff266049f69a4e8dca0da";
const V76_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v76-status.json";
const V76_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-zero; writer first-segment Label bind held; MUI contentFill still false; probe/usability/restoration failed; cleanup complete";
const V76_BASE_COMMIT = "2a298d3a90d0b3230c7f152fcd19cb40daec5a92";
const V76_ANTECEDENT_COMMIT = "046342fb5a53cb5a0a8fd4a7769141b6b157912e";
const V76_AUTHORIZATION_PATH = `${V76_ROOT}/capture-authorization.json`;
const V76_AUTHORIZATION_SHA256 =
  "c0fb1c451536d8f6e8d1586530be64a7875ef35e489f010bf24d6ecb4c785349";
const V76_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "a2db82fbf07c8aa2f8226b3677508b0e453aa10ec02c44882e1c607ea4ee1d6e";
const V76_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v76-attempt-1.json";
const V76_ATTEMPT_1_SHA256 =
  "faa398c9811550c1b06affbf83e310e221ad26e7e6e24844bc82585d9dfd5899";
const V77_ROOT = "recipe/evidence/input-field-live-pivot-v77";
const V77_PROTOCOL_SHA256 =
  "01cfea7e899047c11aca35d32cb0e2753529c09aebe2b8f3a061a876eeaff63c";
const V77_PLAN_SHA256 =
  "a539e1d09fc03f5f829ae6056c724eb299c6e1274d727c8b877cddfa3556ef04";
const V77_CAPTURE_MANIFEST_SHA256 =
  "e6449a92fed2704728a3cb16de4d4583c8dbf6f3d432974a973597acbe5494d3";
const V77_REQUEST_MANIFEST_SHA256 =
  "b7c6317ed4734fa54023d97e590661432fd0bc8645bf8accd268fbd0a7eeb6e0";
const V77_INDEX_SHA256 =
  "bf120c82c5c0386bf42ff6d043083badbb019484d638632dd4b671795fccbe49";
const V77_HASH_SET_SHA256 =
  "8d298ba2ac4ca7f3cafed2f3ff95279a835cd6ee34dcacd1f8bce40cc4d1fcc8";
const V77_AUTHORIZATION_TEMPLATE_SHA256 =
  "e09a35d5d0ca63fe1c91c244130689d85d9537159aa3f41d01e295dd990741e9";
const V77_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v77-status.json";
const V77_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-zero; writer first-segment Label bind held; probe reveal-then-measure hidden content FILL held; MUI and Polar contentFill true; clip 104 and overlap 12 remain; probe/usability/restoration failed; cleanup complete";
const V77_BASE_COMMIT = "34b2831c241e10c87555167619c172638a56ff4a";
const V77_ANTECEDENT_COMMIT = "ea2ec61599478a990914c009b639c5d1078c7b36";
const V77_AUTHORIZATION_PATH = `${V77_ROOT}/capture-authorization.json`;
const V77_AUTHORIZATION_SHA256 =
  "29dbdc6aa85eb67b8e41cec81a37897db253068980b891b7b021f329de9a6429";
const V77_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "8a5d96fb73dd9082f895f34fd686b0f8d2a7c3d50f9d0b0fb9443ada992724c7";
const V77_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v77-attempt-1.json";
const V77_ATTEMPT_1_SHA256 =
  "3d851f724d4a986470e8e3bb4ee71cdf48d188f06ae8ad1727c97a9dc4489d7c";
const V78_ROOT = "recipe/evidence/input-field-live-pivot-v78";
const V78_PROTOCOL_SHA256 =
  "7b68417aed384177f723b2b3216958e3a24eec4a51e6b5c20b1ce4b52c9be773";
const V78_PLAN_SHA256 =
  "a712af4b096e1f80c8b37a4bca5369db9c30d68560450baeb9ae3eeaef5b1ec7";
const V78_CAPTURE_MANIFEST_SHA256 =
  "d848222966b5c399af4364720b2706478e87f4eaf33b191559b5e01a62a03f7b";
const V78_REQUEST_MANIFEST_SHA256 =
  "c7430728d8eb03052bfdbb53cf8f1633e9ba47a19b1f08f7958e32d4dc6abcc2";
const V78_INDEX_SHA256 =
  "379717e644412e987de4988f244b49b34c4ce95edd990f64be9546959adc9073";
const V78_HASH_SET_SHA256 =
  "4880540941ffcc0742b555efaf21278e6be939fdbc8b83694c617cea5b182280";
const V78_AUTHORIZATION_TEMPLATE_SHA256 =
  "2b40166f50765d024bb075dd71a5b77c8e5e66e66569e8984bd134ad31c51f12";
const V78_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v78-status.json";
const V78_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; independent root accounting silent-zero; probe exclude overlay-label AABB held; MUI clip 0; overlap 12 remain; probe/usability/restoration failed; cleanup complete";
const V78_BASE_COMMIT = "da30631885c9141dbec5d171e278ad3afa7a6d29";
const V78_ANTECEDENT_COMMIT = "d17d9b450b51d650aed01140e5d63dc0d4a1fb77";
const V78_AUTHORIZATION_PATH = `${V78_ROOT}/capture-authorization.json`;
const V78_AUTHORIZATION_SHA256 =
  "26ab82447c0af00b2c900a068ac5ca14da34676e8150e3fe5e8ea3101c0e1309";
const V78_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "bdefb90d153faab15a38bbd687674c07c7e56d98496b8e6d4f9894a4e8e3288c";
const V78_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v78-attempt-1.json";
const V78_ATTEMPT_1_SHA256 =
  "fd6060fc8e70adc4bb652a292712faf10982d82601c624a063331c0ea72abba8";
const V79_ROOT = "recipe/evidence/input-field-live-pivot-v79";
const V79_PROTOCOL_SHA256 =
  "b2f3f3f9c13695eba949ab5f74f3593a52563bb34f818dbaf1dd1fb3f0e134bf";
const V79_PLAN_SHA256 =
  "92acc11c2a7816f85dd44688c0e8b46089f3a7e00240ea29dea5a971c6d114cb";
const V79_CAPTURE_MANIFEST_SHA256 =
  "55397d821ac8037af7695a9f3aae088773f82fd0a8c58cf05f6f7a31179b3157";
const V79_REQUEST_MANIFEST_SHA256 =
  "4d9bb882be7d6d4374091a2c1db0f7fc222dd66b851c6e33e0d48b4a55f85f2d";
const V79_INDEX_SHA256 =
  "8935b97745c03fd909bd5af63aa2f32d2475ad05c6b56f127eb35d906cad0f20";
const V79_HASH_SET_SHA256 =
  "e829ccd6755dff45984a85d240058d698ef412d7ceebe6782d3e53be4e52d06d";
const V79_AUTHORIZATION_TEMPLATE_SHA256 =
  "0f293a59d67f8cc935d9499014113ece7c6347ab962ac98f22e88e6cd2e9c8ba";
const V79_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v79-status.json";
const V79_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; hidden FILL occupancy held on canvas (trailing x=165 not 0); recipe collapse refused opacity; probe not issued; cleanup complete";
const V79_BASE_COMMIT = "09c128734eb8d0ed7761ba3e503cba64a4915ccf";
const V79_ANTECEDENT_COMMIT = "eed3b4f2601edca8596c030f59e87fe4e7bf1b46";
const V79_AUTHORIZATION_PATH = `${V79_ROOT}/capture-authorization.json`;
const V79_AUTHORIZATION_SHA256 =
  "14a92ed634db4f83e2431ca4f1714fc7482f3c6511d8eb1f4245584fcd8dc7e6";
const V79_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "0de7fe7c1d172ba55cb2e25a2b927d12889521014795a81a415c0d7df26a32f4";
const V79_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v79-attempt-1.json";
const V79_ATTEMPT_1_SHA256 =
  "d6cf9bda566400ec3620748e8f343894b3435bacecf94060ab85d2e867a560fa";
const V80_ROOT = "recipe/evidence/input-field-live-pivot-v80";
const V80_PROTOCOL_SHA256 =
  "b617ef2845bc0bbc563b5e2568fbeef58f49e7b163e0d4a2482fb9a793537b8c";
const V80_PLAN_SHA256 =
  "a90261e2b17eb8c5faf959a6a2ee5131d047a4bd923b85d869f3bdbdd4c84080";
const V80_CAPTURE_MANIFEST_SHA256 =
  "ff69c2cd7b930f7c460c14de7e84fe9f4a2484f3bff4c3c5b8ecb552d2225c8d";
const V80_REQUEST_MANIFEST_SHA256 =
  "9a27d5660a334381d6e0f63555faf20da59208cde5974e81b73cdb2da44c18c6";
const V80_INDEX_SHA256 =
  "6a8d38cacac8f908a9c29ae1091169f33f7b1fd018a283acc27ecbb48a9a6b86";
const V80_HASH_SET_SHA256 =
  "25a865db36dd4c576dadef27efd2ff8544d896d1327a5c856acbd4b9372fdf1b";
const V80_AUTHORIZATION_TEMPLATE_SHA256 =
  "8df1594ad8aa50d9e390327f83d7014cb450bf01e5fc7b15d5ec1d3253727f6b";
const V80_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v80-status.json";
const V80_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; hidden FILL occupancy held on canvas (trailing x=165 not 0); host omit content opacity held; recipe collapse refused visible; probe not issued; cleanup complete";
const V80_BASE_COMMIT = "cb03fc893cc13c03caeccaedbb618bb973819857";
const V80_ANTECEDENT_COMMIT = "55b813d176ef5a18fe9a4092cbfe4a417263d8e0";
const V80_AUTHORIZATION_PATH = `${V80_ROOT}/capture-authorization.json`;
const V80_AUTHORIZATION_SHA256 =
  "6827081220c33e7d3da7ab1815889dd1e3a3cd5f40fa344e62e66a7392d6ce16";
const V80_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "88a8b66965c0ccdee4824346229ab8bab64f8b6f53c8fbc3e9a30c936c9c3ecf";
const V80_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v80-attempt-1.json";
const V80_ATTEMPT_1_SHA256 =
  "caff0b43aa96f1b57d8a40d894c22e61ccc88b05e29dd1ef9035bd923f6969d7";
const V81_ROOT = "recipe/evidence/input-field-live-pivot-v81";
const V81_PROTOCOL_SHA256 =
  "dd1b4ad78952e5ab78dbee60a137a252e49202b74cfc593729d3bd9fdf229e90";
const V81_PLAN_SHA256 =
  "b33ee91c2269be083194e3baa36f638bdf177a4fb093f6e2fcfd8b244e3a6591";
const V81_CAPTURE_MANIFEST_SHA256 =
  "b77f413972243848fb40224685a784c308c0c0dbb9e97a45c34c357b8b107dca";
const V81_REQUEST_MANIFEST_SHA256 =
  "0d80be8f5a3dda2f59a04255c714f769df8ff54de29f4a9952f7d251007c744f";
const V81_INDEX_SHA256 =
  "f281e8d76718f536520c8eef6a41ecee9965033b44ebebb872c4e5a1c80cf707";
const V81_HASH_SET_SHA256 =
  "ab166954f1cad0046ee680c7a03f18841080a44692450a0d1775b477c20245b3";
const V81_AUTHORIZATION_TEMPLATE_SHA256 =
  "d9bc99548fc61ceb1e9650db9f8a22a427bc3f8f753eb38bf184935bde694167";
const V81_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v81-status.json";
const V81_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; hidden FILL occupancy held on canvas (trailing x=165 not 0); compile-carry live visible held; host omit content opacity held; independent root accounting refused opacity 1 vs live 0; probe not issued; cleanup complete";
const V81_BASE_COMMIT = "11ca5e2e6af42c57235e1931e33dfeae0d06a404";
const V81_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v81-attempt-1.json";
const V81_ATTEMPT_1_SHA256 =
  "506a1a369fc266b5cffefb42658e2669f57b736a726e013490f960592c302013";
const V81_ANTECEDENT_COMMIT = "54bc7cf4cd7144fd53588a71502b32701e4a50c1";
const V81_AUTHORIZATION_PATH = `${V81_ROOT}/capture-authorization.json`;
const V81_AUTHORIZATION_SHA256 =
  "f574483288d66faad3616eb79d9a8ba9a0500470ea9352be6856315d37c0ecc2";
const V81_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "c72c806e5c72e2a43e1f854801e4bd226cbf79f5fb5b66f74515ec53925c2bde";
const V82_ROOT = "recipe/evidence/input-field-live-pivot-v82";
const V82_PROTOCOL_SHA256 =
  "8057a272a469f64dac31c8396e9436ee31fbed2ea2d213bc6f306424ac1585fe";
const V82_PLAN_SHA256 =
  "962c5c1a3845889a2ba929af981708bc65ba50688685b4101f98f162d94b9a0f";
const V82_CAPTURE_MANIFEST_SHA256 =
  "b62d03fa66ae88b7396533d52507190e08e422d571407ee7ef1df25191b07d20";
const V82_REQUEST_MANIFEST_SHA256 =
  "ac55219a2d431e3f1ca49510dffb881adda640f851d878a9b8712b0b790bea2b";
const V82_INDEX_SHA256 =
  "67af60edcd0c30fed505978480415cd20a8efab89c6a9402efc5038ead867c0a";
const V82_HASH_SET_SHA256 =
  "668855e4005e6390cc7db5848476ae277a9f1b74287cecc48576ee9c642949f9";
const V82_AUTHORIZATION_TEMPLATE_SHA256 =
  "dac4e1026160529c77a04de24b1674d60711149c8177a23e650e26e9c5ca1b43";
const V82_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v82-status.json";
const V82_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; hidden FILL occupancy held on canvas (trailing x=165 not 0); compile-carry live occupancy opacity 0 held; independent root accounting 0/0 both; recipe collapse refused fixed-point; probe not issued; cleanup complete";
const V82_BASE_COMMIT = "a2de22fda1493770ad7c3c52697b7d5ec0916434";
const V82_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v82-attempt-1.json";
const V82_ATTEMPT_1_SHA256 =
  "9cb65d4c22438c2ef623fc199a68c7851c777022cca9e60e385cd59bcacdd427";
const V82_ANTECEDENT_COMMIT = "ac760e1e4fd84ae126fc8aa44e29f305834d022e";
const V82_AUTHORIZATION_PATH = `${V82_ROOT}/capture-authorization.json`;
const V82_AUTHORIZATION_SHA256 =
  "ed4dbc4d074d6ea82957551a7829f43146e93a796ddf5e78b46cbaac4ae43731";
const V82_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "e2da16a269e0d1aff1978bcf6173f301834f6217244bc97ee9297d9db3bc5425";
const V83_ROOT = "recipe/evidence/input-field-live-pivot-v83";
const V83_PROTOCOL_SHA256 =
  "0a6844bb1703967be14c6b266311446ee5f0cb6038f9d6e6c52f7947264d91a4";
const V83_PLAN_SHA256 =
  "e51407ec2f4cecae66ad99bde7b8e574a677f72c2c46aa0ac864de1749baced1";
const V83_CAPTURE_MANIFEST_SHA256 =
  "47fba3aa7c1208e72c00042d3dac4ba0482129deef78dfc8472be43f5f0eace9";
const V83_REQUEST_MANIFEST_SHA256 =
  "4ce53e942e815ebe334cd380c8e88b677addbd6a1711259cb3cf392dfb8fbfd6";
const V83_INDEX_SHA256 =
  "07759dd6ac3098caafb564254a2765bd6739389140d245a4d6a2ff3f98c91c4a";
const V83_HASH_SET_SHA256 =
  "2c9c1655ab616df843ca9755abbc81059bd47c5fc9447e7c32ece2d5016706ad";
const V83_AUTHORIZATION_TEMPLATE_SHA256 =
  "7ce94940ef29a836bc08a3ee138d72a038cdc4be254a9ae25f7a063d5a050cb9";
const V83_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v83-status.json";
const V83_STATUS =
  "attempt 1 failed closed; writer and restore accepted; extract issued; hidden FILL occupancy held on canvas (trailing x=165 not 0); compile-carry live occupancy opacity 0 held; collapse omit invented default-1 content TEXT opacity held; independent root accounting 0/0 both; recipe collapse fixed-point stable; probe issued; probe refused overlap 24 cells max 22.5; cleanup complete";
const V83_BASE_COMMIT = "737fe2d046f7fb9b832a9440b33554084a75daf8";
const V83_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v83-attempt-1.json";
const V83_ATTEMPT_1_SHA256 =
  "9bf846c88755d2cd754225b29cbf1d66b96e86b308e3011c5cb58aefcf463f91";
const V83_ANTECEDENT_COMMIT = "aeae9942afd29442da341d304466d94a973de0b4";
const V83_AUTHORIZATION_PATH = `${V83_ROOT}/capture-authorization.json`;
const V83_AUTHORIZATION_SHA256 =
  "259b21bc2a848f72bdfee3d01ca2b6fc7c1ad98052dd9f55c7eff89ae7ecc45d";
const V83_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "6e8412ab4a94965693529db9e34d83c1dd54d11be96001d53ee98219d5a1b2cd";
const V84_ROOT = "recipe/evidence/input-field-live-pivot-v84";
const V84_PROTOCOL_SHA256 =
  "710aabbcbec7d47138268c3f5768afd668e6684207040dda7612ab28b5cf9d5e";
const V84_PLAN_SHA256 =
  "0c23ab2a2dc2d3631a1d6ac06a66e42ecd359af22c564541dded08b6e09ed5d2";
const V84_CAPTURE_MANIFEST_SHA256 =
  "5585ec3ff0412530c8431f927556e519c8ab0520094d7b8da516f723fb7f7274";
const V84_REQUEST_MANIFEST_SHA256 =
  "23b79efe1d0a7162f178fa110d54774e3f78fd412b5fada694ce08632b109c20";
const V84_INDEX_SHA256 =
  "6e05a1e5b6475654838f951282b4e6ebb9241352dd8b633dd384072fa3c3fd2f";
const V84_HASH_SET_SHA256 =
  "1496a61f2fb5c34df7048813ea82afeb24c0900e1d91f7084d066e6b7aa9078d";
const V84_AUTHORIZATION_TEMPLATE_SHA256 =
  "293cb0cc7bda8c81b29ec1c1a92c88601a1096d36318ac028db06c1c84e63012";
const V84_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v84-status.json";
const V84_STATUS =
  "attempt 1 closed after required cleanup; writer restore extract probe accepted; hidden FILL occupancy held on canvas (trailing x=165 not 0); compile-carry live occupancy opacity 0 held; collapse omit invented default-1 content TEXT opacity held; independent root accounting 0/0 both; recipe collapse fixed-point stable; probe issued; probe overlap 0 after excluding opacity-0 occupancy spacers; 128 captures technicalPassed; mint cleaned; mint did not stay";
const V84_BASE_COMMIT = "317b5e6959a2851e0810c0442bfc311055ffb9c5";
const V84_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v84-attempt-1.json";
const V84_ATTEMPT_1_SHA256 =
  "e9ac7506724d99bbe01c67dcd391d41294179758c852b754964212dfca42e0ca";
const V84_ANTECEDENT_COMMIT = "80d600cc34990e301d9d039597f275c92bff39e2";
const V84_AUTHORIZATION_PATH = `${V84_ROOT}/capture-authorization.json`;
const V84_AUTHORIZATION_SHA256 =
  "77ee88f1e5b975cf245bb911bc324b3da450c442ba64b682e7a30a729dfeadee";
const V84_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "ddac8401271684c50733127bd6a349de2c10a96babb58a47d6f019b0de4a56b0";
const V85_ROOT = "recipe/evidence/input-field-live-pivot-v85";
const V85_PROTOCOL_SHA256 =
  "1cae4b0a01e36b9a5404375af65e77f3ad4c166e86f22e1bdb04e65d7e34d93b";
const V85_PLAN_SHA256 =
  "b987cd06a95b213ee3f39207446de904827bdd29ab4cdb7c1d61c9822f4bed52";
const V85_CAPTURE_MANIFEST_SHA256 =
  "e21a036862bb1e77b8e60c6802ce276adaec2e007a223eba9edf953e97634506";
const V85_REQUEST_MANIFEST_SHA256 =
  "2b8db37b81deb6713349bd41edaa18e06ad2d40e5638906d01b6a3f4e2716408";
const V85_INDEX_SHA256 =
  "b3b7df6d5c27abb97ba3f46e9554ad1442a25522cebaa10a7890243b2dd79bad";
const V85_HASH_SET_SHA256 =
  "8c97bc73accc20f1977d9dfc14126476c349e389c7e7cce9a2340b6309cdebb7";
const V85_AUTHORIZATION_TEMPLATE_SHA256 =
  "fd736e3121b109c64a3bec0c2a59a5cacb2569ca4012ca38e01a19099df688f7";
const V85_STATUS_PATH =
  "recipe/evidence/input-field-live-pivot-v85-status.json";
const V85_STATUS =
  "attempt 1 mint stayed; writer restore extract probe accepted; hidden FILL occupancy held on canvas (trailing x=165 not 0); compile-carry live occupancy opacity 0 held; collapse omit invented default-1 content TEXT opacity held; independent root accounting 0/0 both; recipe collapse fixed-point stable; probe issued; probe overlap 0 after excluding opacity-0 occupancy spacers; 128 captures technicalPassed; cleanup persisted not executed; page 115:295378 still present; mint stayed";
const V85_BASE_COMMIT = "da51ea5e92908e0dac154776c79ec8f6729132f5";
const V85_ATTEMPT_1_PATH =
  "recipe/evidence/input-field-live-pivot-v85-attempt-1.json";
const V85_ATTEMPT_1_SHA256 =
  "c39e45ac44801cd5e5128d65b409afcc4fe189730d375591db7ae506fd30d054";
const V85_ANTECEDENT_COMMIT = "4084b2cfb71784413bfae8dd8604810b972bf5bf";
const V85_AUTHORIZATION_PATH = `${V85_ROOT}/capture-authorization.json`;
const V85_AUTHORIZATION_SHA256 =
  "06c007a1e6e9d9dc807402ea9a637503e19cae46b2f20fef15894822b5253863";
const V85_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "80b92e1bdb21b1745a3f616e51e549d3cb2fb7e5e8cd4dfb3f7a01bc32f917f3";
const V85_HUMAN_SIGNOFF_PATH =
  "recipe/evidence/input-field-live-v85-human-signoff.json";
const V85_HUMAN_SIGNOFF_SHA256 =
  "a6a4c3a14f5ccb507f104122d15e2a4c05bc4c88e2be574320b1641efcf66560";
const COMBOBOX_V41_NAMED_FEEDBACK_PATH =
  "recipe/evidence/combobox-v41-empty-listbox-diagnosis.json";
const COMBOBOX_V41_NAMED_FEEDBACK_SHA256 =
  "2e6ce68391a53299636f6e752fefa161076562218a627f71a0657aaf12e11b3a";
const COMBOBOX_V41_HUMAN_SIGNOFF_PATH =
  "recipe/evidence/combobox-live-v41-human-signoff.json";
const COMBOBOX_V41_HUMAN_SIGNOFF_SHA256 =
  "fb69322bfbd7c18859971571f3d32079c6a0cc8d7585e497defa0824f45733e2";
const TABLE_LIVE_V1_ATTEMPT_1_PATH =
  "recipe/evidence/table-live-pivot-v1-attempt-1.json";
const TABLE_LIVE_V1_ATTEMPT_1_SHA256 =
  "25885a3c18e204814c90ab937aa5f15a9203f533366083ea2e284ebfdfe90913";
const TABLE_LIVE_V1_STATUS_PATH =
  "recipe/evidence/table-live-pivot-v1-status.json";
const TABLE_LIVE_V1_STATUS_SHA256 =
  "cae7800eae0b22fbf29d12bedb07f609d1b8e4262c7ee1d75e063af51ff43f37";
const TABLE_LIVE_V2_ATTEMPT_1_PATH =
  "recipe/evidence/table-live-pivot-v2-attempt-1.json";
const TABLE_LIVE_V2_ATTEMPT_1_SHA256 =
  "d1d19d98a2fcf3c13a52bd555dedc5660cce3ca2541d5cf5a1c6aa42436e5145";
const TABLE_LIVE_V2_STATUS_PATH =
  "recipe/evidence/table-live-pivot-v2-status.json";
const TABLE_LIVE_V2_STATUS_SHA256 =
  "fefe98fad1ca6d3222f3e23d6272d55519a1620ecc320fa7f17fa8a4bfa8a165";
const TABLE_LIVE_V3_ATTEMPT_1_PATH =
  "recipe/evidence/table-live-pivot-v3-attempt-1.json";
const TABLE_LIVE_V3_ATTEMPT_1_SHA256 =
  "39b5411efc07167d9445327e658d9e8df361459bf28e6ab57dee7499bcef3e34";
const TABLE_LIVE_V3_STATUS_PATH =
  "recipe/evidence/table-live-pivot-v3-status.json";
const TABLE_LIVE_V3_STATUS_SHA256 =
  "d23fc5ea319611489f43799499ac7876352ea488ce0217492a708a8fa1812081";
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
    status.combobox?.status !==
      "v41-live-human-grade-passed; product v1 incomplete" ||
    status.combobox?.writer?.status !== "offline-hermetic-v1" ||
    status.combobox?.writer?.liveFigma !== false ||
    status.combobox?.writer?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.writer?.path !== "recipe/combobox-figma-writer.ts" ||
    status.combobox?.recipe?.sourceReferencesRendered !== false ||
    status.combobox?.recipe?.aiGraded !== false ||
    status.combobox?.recipe?.liveFigma !== false ||
    status.combobox?.legacyContext?.variants !== 6 ||
    status.combobox?.offlineProof?.pairedCellsPlanned !== 24 ||
    status.combobox?.offlineProof?.comboboxVariants !== 64 ||
    status.combobox?.offlineProof?.optionVariants !== 8 ||
    status.combobox?.offlineProof?.components !== 72 ||
    status.combobox?.offlineProof?.instances !== 242 ||
    status.combobox?.liveV1?.prepared !== true ||
    status.combobox?.liveV1?.liveFigma !== false ||
    status.combobox?.liveV1?.humanSignoff !== "pending" ||
    status.combobox?.liveV1?.pageId !== null ||
    status.combobox?.liveV1?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV1?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV1?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV1?.attempt1?.refusedClass !==
      "COMBOBOX-V1-RESTORE-COUNT" ||
    status.combobox?.liveV1?.attempt1?.observedCount !== 240 ||
    status.combobox?.liveV1?.attempt1?.expectedCount !== 144 ||
    status.combobox?.liveV1?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV1?.nextTeaching !==
      "restore option/label only from option-set" ||
    status.combobox?.liveV2?.prepared !== true ||
    status.combobox?.liveV2?.liveFigma !== false ||
    status.combobox?.liveV2?.humanSignoff !== "pending" ||
    status.combobox?.liveV2?.pageId !== null ||
    status.combobox?.liveV2?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV2?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV2?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v2" ||
    status.combobox?.liveV2?.teaching !==
      "restore option/label only from option-set; restore input only from combobox/set" ||
    status.combobox?.liveV2?.ownedFillTexts !== 144 ||
    status.combobox?.liveV2?.writerUnchangedFromV1 !== true ||
    status.combobox?.liveV2?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV2?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV2?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV2?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV2?.attempt1?.refusedClass !==
      "SCENE-DIRECT-OWNERSHIP-METADATA" ||
    status.combobox?.liveV2?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV2?.nextTeaching !==
      "extract must not require envelopeHash on owned component-set roots" ||
    status.combobox?.liveV3?.prepared !== true ||
    status.combobox?.liveV3?.liveFigma !== false ||
    status.combobox?.liveV3?.humanSignoff !== "pending" ||
    status.combobox?.liveV3?.pageId !== null ||
    status.combobox?.liveV3?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV3?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV3?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v3" ||
    status.combobox?.liveV3?.teaching !==
      "extract must not require envelopeHash on owned component-set roots" ||
    status.combobox?.liveV3?.ownedFillTexts !== 144 ||
    status.combobox?.liveV3?.writerUnchangedFromV1 !== true ||
    status.combobox?.liveV3?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV3?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV3?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV3?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV3?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV3?.attempt1?.refusedClass !==
      "SCENE-GENERATED-DESCENDANT-DIRECT-KEY" ||
    status.combobox?.liveV3?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV3?.nextTeaching !==
      "extract must ignore Figma-copied ownershipKey on descendants inside an owned INSTANCE" ||
    status.combobox?.liveV4?.prepared !== true ||
    status.combobox?.liveV4?.liveFigma !== false ||
    status.combobox?.liveV4?.humanSignoff !== "pending" ||
    status.combobox?.liveV4?.pageId !== null ||
    status.combobox?.liveV4?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV4?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV4?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v4" ||
    status.combobox?.liveV4?.teaching !==
      "extract must ignore Figma-copied ownershipKey on descendants inside an owned INSTANCE" ||
    status.combobox?.liveV4?.ownedFillTexts !== 144 ||
    status.combobox?.liveV4?.writerUnchangedFromV1 !== true ||
    status.combobox?.liveV4?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV4?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV4?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV4?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV4?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV4?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV4?.attempt1?.refusedClass !==
      "payload.content.text" ||
    status.combobox?.liveV4?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV4?.nextTeaching !==
      "host must omit instance payload when extract instancePayload has empty text and empty fills" ||
    status.combobox?.liveV5?.prepared !== true ||
    status.combobox?.liveV5?.liveFigma !== false ||
    status.combobox?.liveV5?.humanSignoff !== "pending" ||
    status.combobox?.liveV5?.pageId !== null ||
    status.combobox?.liveV5?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV5?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV5?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v5" ||
    status.combobox?.liveV5?.teaching !==
      "host must omit instance payload when extract instancePayload has empty text and empty fills" ||
    status.combobox?.liveV5?.ownedFillTexts !== 144 ||
    status.combobox?.liveV5?.writerUnchangedFromV1 !== true ||
    status.combobox?.liveV5?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV5?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV5?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV5?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV5?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV5?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV5?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV5?.attempt1?.emptyPayloadTeachingCleared !==
      true ||
    status.combobox?.liveV5?.attempt1?.refusedClass !==
      "scene projection lost root" ||
    status.combobox?.liveV5?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV5?.nextTeaching !==
      "host observeSceneFacts must project with the live scene root ownershipKey, not default root" ||
    status.combobox?.liveV6?.prepared !== true ||
    status.combobox?.liveV6?.liveFigma !== false ||
    status.combobox?.liveV6?.humanSignoff !== "pending" ||
    status.combobox?.liveV6?.pageId !== null ||
    status.combobox?.liveV6?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV6?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV6?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v6" ||
    status.combobox?.liveV6?.teaching !==
      "host observeSceneFacts must project with the live scene root ownershipKey, not default root" ||
    status.combobox?.liveV6?.ownedFillTexts !== 144 ||
    status.combobox?.liveV6?.writerUnchangedFromV1 !== true ||
    status.combobox?.liveV6?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV6?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV6?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV6?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV6?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV6?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV6?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV6?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV6?.attempt1?.observeSceneFactsLiveRootTeachingCleared !==
      true ||
    status.combobox?.liveV6?.attempt1?.refusedClass !==
      "non-instance repetition" ||
    status.combobox?.liveV6?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV6?.nextTeaching !==
      "host sceneToNormalizedIr must recover option-instance componentRef as combobox@1/option, not the live Figma main-component name" ||
    status.combobox?.liveV7?.prepared !== true ||
    status.combobox?.liveV7?.liveFigma !== false ||
    status.combobox?.liveV7?.humanSignoff !== "pending" ||
    status.combobox?.liveV7?.pageId !== null ||
    status.combobox?.liveV7?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV7?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV7?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v7" ||
    status.combobox?.liveV7?.teaching !==
      "host sceneToNormalizedIr must recover option-instance componentRef as combobox@1/option, not the live Figma main-component name" ||
    status.combobox?.liveV7?.ownedFillTexts !== 144 ||
    status.combobox?.liveV7?.writerUnchangedFromV1 !== true ||
    status.combobox?.liveV7?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV7?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV7?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV7?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV7?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV7?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV7?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV7?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV7?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV7?.attempt1?.hostComponentRefTeachingCleared !==
      true ||
    status.combobox?.liveV7?.attempt1?.refusedClass !==
      "invalid ARIA/data model" ||
    status.combobox?.liveV7?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV7?.nextTeaching !==
      "writer must stamp option-instance Label, Value, and Disabled component properties named from source so live extract carries the recipe ARIA/data model, not only Size and Option state" ||
    status.combobox?.liveV8?.prepared !== true ||
    status.combobox?.liveV8?.liveFigma !== false ||
    status.combobox?.liveV8?.humanSignoff !== "pending" ||
    status.combobox?.liveV8?.pageId !== null ||
    status.combobox?.liveV8?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV8?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV8?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v8" ||
    status.combobox?.liveV8?.teaching !==
      "writer must stamp option-instance Label, Value, and Disabled component properties named from source so live extract carries the recipe ARIA/data model, not only Size and Option state" ||
    status.combobox?.liveV8?.ownedFillTexts !== 144 ||
    status.combobox?.liveV8?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV8?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV8?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV8?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV8?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV8?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV8?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV8?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV8?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV8?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV8?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV8?.attempt1?.writerAriaStampTeachingCleared !==
      true ||
    status.combobox?.liveV8?.attempt1?.refusedClass !==
      "invalid ARIA/data model" ||
    status.combobox?.liveV8?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV8?.nextTeaching !==
      "host sceneToNormalizedIr must recover option-instance Label, Value, and Disabled from live Figma component-property keys by the name before #, carrying the already-stamped source values" ||
    status.combobox?.liveV9?.prepared !== true ||
    status.combobox?.liveV9?.liveFigma !== false ||
    status.combobox?.liveV9?.humanSignoff !== "pending" ||
    status.combobox?.liveV9?.pageId !== null ||
    status.combobox?.liveV9?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV9?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV9?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v9" ||
    status.combobox?.liveV9?.teaching !==
      "host sceneToNormalizedIr must recover option-instance Label, Value, and Disabled from live Figma component-property keys by the name before #, carrying the already-stamped source values" ||
    status.combobox?.liveV9?.ownedFillTexts !== 144 ||
    status.combobox?.liveV9?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV9?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV9?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV9?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV9?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV9?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV9?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV9?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV9?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV9?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV9?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV9?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV9?.attempt1?.hostPropertyNameBeforeHashTeachingCleared !==
      true ||
    status.combobox?.liveV9?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV9?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV9?.nextTeaching !==
      "host must order combobox/trigger bindings to compile field order so layout.padding.left precedes layout.padding.right, not live extract order or the inherited Input surface list that ranks padding.right first" ||
    status.combobox?.liveV10?.prepared !== true ||
    status.combobox?.liveV10?.liveFigma !== false ||
    status.combobox?.liveV10?.humanSignoff !== "pending" ||
    status.combobox?.liveV10?.pageId !== null ||
    status.combobox?.liveV10?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV10?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV10?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v10" ||
    status.combobox?.liveV10?.teaching !==
      "host must order combobox/trigger bindings to compile field order so layout.padding.left precedes layout.padding.right, not live extract order or the inherited Input surface list that ranks padding.right first" ||
    status.combobox?.liveV10?.ownedFillTexts !== 144 ||
    status.combobox?.liveV10?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV10?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV10?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV10?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV10?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV10?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV10?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV10?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV10?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV10?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV10?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV10?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV10?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV10?.attempt1?.hostTriggerBindingCompileOrderTeachingCleared !==
      true ||
    status.combobox?.liveV10?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV10?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV10?.nextTeaching !==
      "host must order combobox/control/leading bindings to compile field order so width.value precedes height.value precedes fills.0.color, not live extract order or the inherited fills-first slot list" ||
    status.combobox?.liveV11?.prepared !== true ||
    status.combobox?.liveV11?.liveFigma !== false ||
    status.combobox?.liveV11?.humanSignoff !== "pending" ||
    status.combobox?.liveV11?.pageId !== null ||
    status.combobox?.liveV11?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV11?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV11?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v11" ||
    status.combobox?.liveV11?.teaching !==
      "host must order combobox/control/leading bindings to compile field order so width.value precedes height.value precedes fills.0.color, not live extract order or the inherited fills-first slot list" ||
    status.combobox?.liveV11?.ownedFillTexts !== 144 ||
    status.combobox?.liveV11?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV11?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV11?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV11?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV11?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV11?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV11?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV11?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV11?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV11?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV11?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV11?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV11?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV11?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV11?.attempt1?.hostLeadingSlotBindingCompileOrderTeachingCleared !==
      true ||
    status.combobox?.liveV11?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV11?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV11?.nextTeaching !==
      "host must emit compile-carried visible: true on leading-slot instances instead of omitting the default-true visible flag" ||
    status.combobox?.liveV12?.prepared !== true ||
    status.combobox?.liveV12?.liveFigma !== false ||
    status.combobox?.liveV12?.humanSignoff !== "pending" ||
    status.combobox?.liveV12?.pageId !== null ||
    status.combobox?.liveV12?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV12?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV12?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v12" ||
    status.combobox?.liveV12?.teaching !==
      "host must emit compile-carried visible: true on leading-slot instances instead of omitting the default-true visible flag" ||
    status.combobox?.liveV12?.ownedFillTexts !== 144 ||
    status.combobox?.liveV12?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV12?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV12?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV12?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV12?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV12?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV12?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV12?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV12?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV12?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV12?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV12?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV12?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV12?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV12?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV12?.attempt1?.hostLeadingSlotCompileCarryVisibleTeachingCleared !==
      true ||
    status.combobox?.liveV12?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV12?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV12?.nextTeaching !==
      "host must order combobox/control/clear bindings to compile field order so width.value precedes height.value precedes fills.0.color, not live extract order or the inherited fills-first trailing-slot list" ||
    status.combobox?.liveV13?.prepared !== true ||
    status.combobox?.liveV13?.liveFigma !== false ||
    status.combobox?.liveV13?.humanSignoff !== "pending" ||
    status.combobox?.liveV13?.pageId !== null ||
    status.combobox?.liveV13?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV13?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV13?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v13" ||
    status.combobox?.liveV13?.teaching !==
      "host must order combobox/control/clear bindings to compile field order so width.value precedes height.value precedes fills.0.color, not live extract order or the inherited fills-first trailing-slot list" ||
    status.combobox?.liveV13?.ownedFillTexts !== 144 ||
    status.combobox?.liveV13?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV13?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV13?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV13?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV13?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV13?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV13?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV13?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV13?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV13?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV13?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV13?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV13?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV13?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV13?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV13?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV13?.attempt1?.hostTrailingSlotBindingCompileOrderTeachingCleared !==
      true ||
    status.combobox?.liveV13?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV13?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV13?.nextTeaching !==
      "host must emit compile-carried visible: true on trailing-slot instances instead of omitting the default-true visible flag" ||
    status.combobox?.liveV14?.prepared !== true ||
    status.combobox?.liveV14?.liveFigma !== false ||
    status.combobox?.liveV14?.humanSignoff !== "pending" ||
    status.combobox?.liveV14?.pageId !== null ||
    status.combobox?.liveV14?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV14?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV14?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v14" ||
    status.combobox?.liveV14?.teaching !==
      "host must emit compile-carried visible: true on trailing-slot instances instead of omitting the default-true visible flag" ||
    status.combobox?.liveV14?.ownedFillTexts !== 144 ||
    status.combobox?.liveV14?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV14?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV14?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV14?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV14?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV14?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV14?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV14?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV14?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV14?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV14?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV14?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV14?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV14?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV14?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV14?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV14?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV14?.attempt1?.hostTrailingSlotCompileCarryVisibleTeachingCleared !==
      true ||
    status.combobox?.liveV14?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV14?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV14?.nextTeaching !==
      "host must omit empty effects on combobox/trigger that compile never emits" ||
    status.combobox?.liveV15?.prepared !== true ||
    status.combobox?.liveV15?.liveFigma !== false ||
    status.combobox?.liveV15?.humanSignoff !== "pending" ||
    status.combobox?.liveV15?.pageId !== null ||
    status.combobox?.liveV15?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV15?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV15?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v15" ||
    status.combobox?.liveV15?.teaching !==
      "host must omit empty effects on combobox/trigger that compile never emits" ||
    status.combobox?.liveV15?.ownedFillTexts !== 144 ||
    status.combobox?.liveV15?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV15?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV15?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV15?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV15?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV15?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV15?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV15?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV15?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV15?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV15?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV15?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV15?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV15?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV15?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV15?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV15?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV15?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV15?.attempt1?.hostTriggerEmptyEffectsTeachingCleared !==
      true ||
    status.combobox?.liveV15?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV15?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV15?.nextTeaching !==
      "host must order combobox/overlay bindings to compile field order so layout.width.value precedes fills.0.color precedes strokes.0.paint.color precedes effects.0.color precedes cornerRadius corners, not live extract order" ||
    status.combobox?.liveV16?.prepared !== true ||
    status.combobox?.liveV16?.liveFigma !== false ||
    status.combobox?.liveV16?.humanSignoff !== "pending" ||
    status.combobox?.liveV16?.pageId !== null ||
    status.combobox?.liveV16?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV16?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV16?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v16" ||
    status.combobox?.liveV16?.teaching !==
      "host must order combobox/overlay bindings to compile field order so layout.width.value precedes fills.0.color precedes strokes.0.paint.color precedes effects.0.color precedes cornerRadius corners, not live extract order" ||
    status.combobox?.liveV16?.ownedFillTexts !== 144 ||
    status.combobox?.liveV16?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV16?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV16?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV16?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV16?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV16?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV16?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV16?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV16?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV16?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV16?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV16?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV16?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV16?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV16?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV16?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV16?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV16?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV16?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV16?.attempt1?.hostOverlayBindingCompileOrderTeachingCleared !==
      true ||
    status.combobox?.liveV16?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV16?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV16?.nextTeaching !==
      "host must alias combobox/overlay width.value to layout.width.value so that field precedes fills.0.color, same class as variant layout width alias, not leave width.value last as an unknown extract field" ||
    status.combobox?.liveV17?.prepared !== true ||
    status.combobox?.liveV17?.liveFigma !== false ||
    status.combobox?.liveV17?.humanSignoff !== "pending" ||
    status.combobox?.liveV17?.pageId !== null ||
    status.combobox?.liveV17?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV17?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV17?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v17" ||
    status.combobox?.liveV17?.teaching !==
      "host must alias combobox/overlay width.value to layout.width.value so that field precedes fills.0.color, same class as variant layout width alias, not leave width.value last as an unknown extract field" ||
    status.combobox?.liveV17?.ownedFillTexts !== 144 ||
    status.combobox?.liveV17?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV17?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV17?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV17?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV17?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV17?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV17?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV17?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV17?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV17?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV17?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV17?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV17?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV17?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV17?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV17?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV17?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV17?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV17?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV17?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV17?.attempt1?.hostOverlayWidthAliasTeachingCleared !==
      true ||
    status.combobox?.liveV17?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV17?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV17?.nextTeaching !==
      "host must order combobox/listbox bindings to compile field order so layout.padding.top precedes layout.padding.bottom, not start at layout.padding.bottom" ||
    status.combobox?.liveV18?.prepared !== true ||
    status.combobox?.liveV18?.liveFigma !== false ||
    status.combobox?.liveV18?.humanSignoff !== "pending" ||
    status.combobox?.liveV18?.pageId !== null ||
    status.combobox?.liveV18?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV18?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV18?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v18" ||
    status.combobox?.liveV18?.teaching !==
      "host must order combobox/listbox bindings to compile field order so layout.padding.top precedes layout.padding.bottom, not start at layout.padding.bottom" ||
    status.combobox?.liveV18?.ownedFillTexts !== 144 ||
    status.combobox?.liveV18?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV18?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV18?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV18?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV18?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV18?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV18?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV18?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV18?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV18?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV18?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV18?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV18?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV18?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV18?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV18?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV18?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV18?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV18?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV18?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV18?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV18?.attempt1?.hostListboxBindingCompileOrderTeachingCleared !==
      true ||
    status.combobox?.liveV18?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV18?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV18?.nextTeaching !==
      "host must drop extra combobox/option-instance bindings that compile never emits, keeping only height.value, not also emit inherited fills.0.color, layout.itemSpacing, layout.padding.left, and layout.padding.right" ||
    status.combobox?.liveV19?.prepared !== true ||
    status.combobox?.liveV19?.liveFigma !== false ||
    status.combobox?.liveV19?.humanSignoff !== "pending" ||
    status.combobox?.liveV19?.pageId !== null ||
    status.combobox?.liveV19?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV19?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV19?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v19" ||
    status.combobox?.liveV19?.teaching !==
      "host must drop extra combobox/option-instance bindings that compile never emits, keeping only height.value, not also emit inherited fills.0.color, layout.itemSpacing, layout.padding.left, and layout.padding.right" ||
    status.combobox?.liveV19?.ownedFillTexts !== 144 ||
    status.combobox?.liveV19?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV19?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV19?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV19?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV19?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV19?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV19?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV19?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV19?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV19?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV19?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV19?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV19?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV19?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV19?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV19?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV19?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV19?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV19?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV19?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV19?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV19?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV19?.attempt1?.hostOptionInstanceBindingExtrasTeachingCleared !==
      true ||
    status.combobox?.liveV19?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV19?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV19?.nextTeaching !==
      "host must omit inherited fills on combobox/option-instance that compile never emits, not also emit the inherited solid paint" ||
    status.combobox?.liveV20?.prepared !== true ||
    status.combobox?.liveV20?.liveFigma !== false ||
    status.combobox?.liveV20?.humanSignoff !== "pending" ||
    status.combobox?.liveV20?.pageId !== null ||
    status.combobox?.liveV20?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV20?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV20?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v20" ||
    status.combobox?.liveV20?.teaching !==
      "host must omit inherited fills on combobox/option-instance that compile never emits, not also emit the inherited solid paint" ||
    status.combobox?.liveV20?.ownedFillTexts !== 144 ||
    status.combobox?.liveV20?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV20?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV20?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV20?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV20?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV20?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV20?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV20?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV20?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV20?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV20?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV20?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV20?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV20?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV20?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV20?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV20?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV20?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV20?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV20?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV20?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV20?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV20?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV20?.attempt1?.hostOptionInstanceFillsOmitTeachingCleared !==
      true ||
    status.combobox?.liveV20?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV20?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV20?.nextTeaching !==
      "host must omit extra payload on combobox/option-instance that compile never emits, not also emit the extract instance payload" ||
    status.combobox?.liveV21?.prepared !== true ||
    status.combobox?.liveV21?.liveFigma !== false ||
    status.combobox?.liveV21?.humanSignoff !== "pending" ||
    status.combobox?.liveV21?.pageId !== null ||
    status.combobox?.liveV21?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV21?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV21?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v21" ||
    status.combobox?.liveV21?.teaching !==
      "host must omit extra payload on combobox/option-instance that compile never emits, not also emit the extract instance payload" ||
    status.combobox?.liveV21?.ownedFillTexts !== 144 ||
    status.combobox?.liveV21?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV21?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV21?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV21?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV21?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV21?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV21?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV21?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV21?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV21?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV21?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV21?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV21?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV21?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV21?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV21?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV21?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV21?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV21?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV21?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV21?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV21?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV21?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV21?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV21?.attempt1?.hostOptionInstancePayloadOmitTeachingCleared !==
      true ||
    status.combobox?.liveV21?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV21?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV21?.nextTeaching !==
      "host must omit clipsContent on combobox/listbox that compile never emits, not also emit the live listbox clip flag" ||
    status.combobox?.liveV22?.prepared !== true ||
    status.combobox?.liveV22?.liveFigma !== false ||
    status.combobox?.liveV22?.humanSignoff !== "pending" ||
    status.combobox?.liveV22?.pageId !== null ||
    status.combobox?.liveV22?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV22?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV22?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v22" ||
    status.combobox?.liveV22?.teaching !==
      "host must omit clipsContent on combobox/listbox that compile never emits, not also emit the live listbox clip flag" ||
    status.combobox?.liveV22?.ownedFillTexts !== 144 ||
    status.combobox?.liveV22?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV22?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV22?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV22?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV22?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV22?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV22?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV22?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV22?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV22?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV22?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV22?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV22?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV22?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV22?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV22?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV22?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV22?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV22?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV22?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV22?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV22?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV22?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV22?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV22?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV22?.attempt1?.hostListboxClipsContentOmitTeachingCleared !==
      true ||
    status.combobox?.liveV22?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV22?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV22?.nextTeaching !==
      "host must omit cornerRadius on combobox/listbox that compile never emits, not also emit the live listbox zero radii" ||
    status.combobox?.liveV23?.prepared !== true ||
    status.combobox?.liveV23?.liveFigma !== false ||
    status.combobox?.liveV23?.humanSignoff !== "pending" ||
    status.combobox?.liveV23?.pageId !== null ||
    status.combobox?.liveV23?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV23?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV23?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v23" ||
    status.combobox?.liveV23?.teaching !==
      "host must omit cornerRadius on combobox/listbox that compile never emits, not also emit the live listbox zero radii" ||
    status.combobox?.liveV23?.ownedFillTexts !== 144 ||
    status.combobox?.liveV23?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV23?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV23?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV23?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV23?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV23?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV23?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV23?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV23?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV23?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV23?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV23?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV23?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV23?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV23?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV23?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV23?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV23?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV23?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV23?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV23?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV23?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV23?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV23?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV23?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV23?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV23?.attempt1?.hostListboxCornerRadiusOmitTeachingCleared !==
      true ||
    status.combobox?.liveV23?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV23?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV23?.nextTeaching !==
      "host must omit empty effects on combobox/listbox that compile never emits, not also emit the live listbox empty effects array" ||
    status.combobox?.liveV24?.prepared !== true ||
    status.combobox?.liveV24?.liveFigma !== false ||
    status.combobox?.liveV24?.humanSignoff !== "pending" ||
    status.combobox?.liveV24?.pageId !== null ||
    status.combobox?.liveV24?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV24?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV24?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v24" ||
    status.combobox?.liveV24?.teaching !==
      "host must omit empty effects on combobox/listbox that compile never emits, not also emit the live listbox empty effects array" ||
    status.combobox?.liveV24?.ownedFillTexts !== 144 ||
    status.combobox?.liveV24?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV24?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV24?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV24?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV24?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV24?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV24?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV24?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV24?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV24?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV24?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV24?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV24?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV24?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV24?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV24?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV24?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV24?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV24?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV24?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV24?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV24?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV24?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV24?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV24?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV24?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV24?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV24?.attempt1?.hostListboxEmptyEffectsOmitTeachingCleared !==
      true ||
    status.combobox?.liveV24?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV24?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV24?.nextTeaching !==
      "host must omit empty strokes on combobox/listbox that compile never emits, not also emit the live listbox empty strokes array" ||
    status.combobox?.liveV25?.prepared !== true ||
    status.combobox?.liveV25?.liveFigma !== false ||
    status.combobox?.liveV25?.humanSignoff !== "pending" ||
    status.combobox?.liveV25?.pageId !== null ||
    status.combobox?.liveV25?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV25?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV25?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v25" ||
    status.combobox?.liveV25?.teaching !==
      "host must omit empty strokes on combobox/listbox that compile never emits, not also emit the live listbox empty strokes array" ||
    status.combobox?.liveV25?.ownedFillTexts !== 144 ||
    status.combobox?.liveV25?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV25?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV25?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV25?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV25?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV25?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV25?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV25?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV25?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV25?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV25?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV25?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV25?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV25?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV25?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV25?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV25?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV25?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV25?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV25?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV25?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV25?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV25?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV25?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV25?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV25?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV25?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV25?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV25?.attempt1?.hostListboxEmptyStrokesOmitTeachingCleared !==
      true ||
    status.combobox?.liveV25?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV25?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV25?.nextTeaching !==
      "host must omit empty dashPattern on overlay strokes that compile never emits, not also emit the live overlay empty dashPattern" ||
    status.combobox?.liveV26?.prepared !== true ||
    status.combobox?.liveV26?.liveFigma !== false ||
    status.combobox?.liveV26?.humanSignoff !== "pending" ||
    status.combobox?.liveV26?.pageId !== null ||
    status.combobox?.liveV26?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV26?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV26?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v26" ||
    status.combobox?.liveV26?.teaching !==
      "host must omit empty dashPattern on overlay strokes that compile never emits, not also emit the live overlay empty dashPattern" ||
    status.combobox?.liveV26?.ownedFillTexts !== 144 ||
    status.combobox?.liveV26?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV26?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV26?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV26?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV26?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV26?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV26?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV26?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV26?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV26?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV26?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV26?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV26?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV26?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV26?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV26?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV26?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV26?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV26?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV26?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV26?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV26?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV26?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV26?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV26?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV26?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV26?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV26?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV26?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV26?.attempt1?.hostOverlayEmptyDashPatternOmitTeachingCleared !==
      true ||
    status.combobox?.liveV26?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV26?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV26?.nextTeaching !==
      "host must omit clipsContent on combobox/set and combobox/option-set that compile never emits, not also emit the live set clip flag" ||
    status.combobox?.liveV27?.prepared !== true ||
    status.combobox?.liveV27?.liveFigma !== false ||
    status.combobox?.liveV27?.humanSignoff !== "pending" ||
    status.combobox?.liveV27?.pageId !== null ||
    status.combobox?.liveV27?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV27?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV27?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v27" ||
    status.combobox?.liveV27?.teaching !==
      "host must omit clipsContent on combobox/set and combobox/option-set that compile never emits, not also emit the live set clip flag" ||
    status.combobox?.liveV27?.ownedFillTexts !== 144 ||
    status.combobox?.liveV27?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV27?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV27?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV27?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV27?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV27?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV27?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV27?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV27?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV27?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV27?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV27?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV27?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV27?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV27?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV27?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV27?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV27?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV27?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV27?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV27?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV27?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV27?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV27?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV27?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV27?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV27?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV27?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV27?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV27?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV27?.attempt1?.hostSetRootClipsContentOmitTeachingCleared !==
      true ||
    status.combobox?.liveV27?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV27?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV27?.nextTeaching !==
      "host must order combobox/option bindings to compile field order so layout.itemSpacing precedes layout.padding.left precedes layout.padding.right precedes layout.width.value precedes layout.height.value precedes fills.0.color, not live extract order starting at fills.0.color" ||
    status.combobox?.liveV28?.prepared !== true ||
    status.combobox?.liveV28?.liveFigma !== false ||
    status.combobox?.liveV28?.humanSignoff !== "pending" ||
    status.combobox?.liveV28?.pageId !== null ||
    status.combobox?.liveV28?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV28?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV28?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v28" ||
    status.combobox?.liveV28?.teaching !==
      "host must order combobox/option bindings to compile field order so layout.itemSpacing precedes layout.padding.left precedes layout.padding.right precedes layout.width.value precedes layout.height.value precedes fills.0.color, not live extract order starting at fills.0.color" ||
    status.combobox?.liveV28?.ownedFillTexts !== 144 ||
    status.combobox?.liveV28?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV28?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV28?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV28?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV28?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV28?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV28?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV28?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV28?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV28?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV28?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV28?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV28?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV28?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV28?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV28?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV28?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV28?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV28?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV28?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV28?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV28?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV28?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV28?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV28?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV28?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV28?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV28?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV28?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV28?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV28?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV28?.attempt1?.hostOptionBindingCompileOrderTeachingCleared !==
      true ||
    status.combobox?.liveV28?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV28?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV28?.nextTeaching !==
      "host must alias combobox/option height.value to layout.height.value so compile-order ranks it before fills.0.color, not leave height.value unknown after the option sort" ||
    status.combobox?.liveV29?.prepared !== true ||
    status.combobox?.liveV29?.liveFigma !== false ||
    status.combobox?.liveV29?.humanSignoff !== "pending" ||
    status.combobox?.liveV29?.pageId !== null ||
    status.combobox?.liveV29?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV29?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV29?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v29" ||
    status.combobox?.liveV29?.teaching !==
      "host must alias combobox/option height.value to layout.height.value so compile-order ranks it before fills.0.color, not leave height.value unknown after the option sort" ||
    status.combobox?.liveV29?.ownedFillTexts !== 144 ||
    status.combobox?.liveV29?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV29?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV29?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV29?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV29?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV29?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV29?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV29?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV29?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV29?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV29?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV29?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV29?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV29?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV29?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV29?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV29?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV29?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV29?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV29?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV29?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV29?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV29?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV29?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV29?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV29?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV29?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV29?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV29?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV29?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV29?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV29?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV29?.attempt1?.hostOptionHeightAliasTeachingCleared !==
      true ||
    status.combobox?.liveV29?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV29?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV29?.nextTeaching !==
      "host must omit clipsContent on combobox/option that compile never emits, not also emit the live option clip flag" ||
    status.combobox?.liveV30?.prepared !== true ||
    status.combobox?.liveV30?.liveFigma !== false ||
    status.combobox?.liveV30?.humanSignoff !== "pending" ||
    status.combobox?.liveV30?.pageId !== null ||
    status.combobox?.liveV30?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV30?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV30?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v30" ||
    status.combobox?.liveV30?.teaching !==
      "host must omit clipsContent on combobox/option that compile never emits, not also emit the live option clip flag" ||
    status.combobox?.liveV30?.ownedFillTexts !== 144 ||
    status.combobox?.liveV30?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV30?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV30?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV30?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV30?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV30?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV30?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV30?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV30?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV30?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV30?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV30?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV30?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV30?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV30?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV30?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV30?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV30?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV30?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV30?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV30?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV30?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV30?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV30?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV30?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV30?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV30?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV30?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV30?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV30?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV30?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV30?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV30?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV30?.attempt1?.hostOptionClipsContentOmitTeachingCleared !==
      true ||
    status.combobox?.liveV30?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV30?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV30?.nextTeaching !==
      "host must order combobox/option/selected-indicator bindings to compile field order so width.value precedes height.value precedes fills.0.color, not live extract order starting at fills.0.color" ||
    status.combobox?.liveV31?.prepared !== true ||
    status.combobox?.liveV31?.liveFigma !== false ||
    status.combobox?.liveV31?.humanSignoff !== "pending" ||
    status.combobox?.liveV31?.pageId !== null ||
    status.combobox?.liveV31?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV31?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV31?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v31" ||
    status.combobox?.liveV31?.teaching !==
      "host must order combobox/option/selected-indicator bindings to compile field order so width.value precedes height.value precedes fills.0.color, not live extract order starting at fills.0.color" ||
    status.combobox?.liveV31?.ownedFillTexts !== 144 ||
    status.combobox?.liveV31?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV31?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV31?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV31?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV31?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV31?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV31?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV31?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV31?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV31?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV31?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV31?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV31?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV31?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV31?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV31?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV31?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV31?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV31?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV31?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV31?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV31?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV31?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV31?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV31?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV31?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV31?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV31?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV31?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV31?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV31?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV31?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV31?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV31?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV31?.attempt1
      ?.hostSelectedIndicatorBindingCompileOrderTeachingCleared !== true ||
    status.combobox?.liveV31?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV31?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV31?.nextTeaching !==
      "host must emit compile-carried visible: true on combobox/option/selected-indicator instead of omitting the default-true visible flag" ||
    status.combobox?.liveV32?.prepared !== true ||
    status.combobox?.liveV32?.liveFigma !== false ||
    status.combobox?.liveV32?.humanSignoff !== "pending" ||
    status.combobox?.liveV32?.pageId !== null ||
    status.combobox?.liveV32?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV32?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV32?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v32" ||
    status.combobox?.liveV32?.teaching !==
      "host must emit compile-carried visible: true on combobox/option/selected-indicator instead of omitting the default-true visible flag" ||
    status.combobox?.liveV32?.ownedFillTexts !== 144 ||
    status.combobox?.liveV32?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV32?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV32?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV32?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV32?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV32?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV32?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV32?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV32?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV32?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV32?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV32?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV32?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV32?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV32?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV32?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV32?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV32?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV32?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV32?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV32?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV32?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV32?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV32?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV32?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV32?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV32?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV32?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV32?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV32?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV32
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV32?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV32?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV32?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV32?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV32?.attempt1
      ?.hostSelectedIndicatorCompileCarryVisibleTeachingCleared !== true ||
    status.combobox?.liveV32?.attempt1?.refusedClass !==
      "unsupported structural edit" ||
    status.combobox?.liveV32?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV32?.nextTeaching !==
      "host must emit compile-carried label Combobox option on combobox/option-set instead of the live display name after ::" ||
    status.combobox?.liveV33?.prepared !== true ||
    status.combobox?.liveV33?.liveFigma !== false ||
    status.combobox?.liveV33?.humanSignoff !== "pending" ||
    status.combobox?.liveV33?.pageId !== null ||
    status.combobox?.liveV33?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV33?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV33?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v33" ||
    status.combobox?.liveV33?.teaching !==
      "host must emit compile-carried label Combobox option on combobox/option-set instead of the live display name after ::" ||
    status.combobox?.liveV33?.ownedFillTexts !== 144 ||
    status.combobox?.liveV33?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV33?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV33?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV33?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV33?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV33?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV33?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV33?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV33?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV33?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV33?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV33?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV33?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV33?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV33?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV33?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV33?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV33?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV33?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV33?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV33?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV33?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV33?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV33?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV33?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV33?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV33?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV33?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV33?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV33?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV33
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV33
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV33?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV33?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV33?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV33?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV33?.attempt1
      ?.hostOptionSetCompileCarryLabelTeachingCleared !== true ||
    status.combobox?.liveV33?.attempt1?.refusedClass !==
      "independent root accounting" ||
    status.combobox?.liveV33?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV33?.nextTeaching !==
      "host observe must omit empty instancePayload facts on slot instances instead of re-injecting live instance descendant payloads that IR and compile omit" ||
    status.input?.overallSuccess !== false ||
    status.input?.status !==
      "v85-live-human-grade-passed; product v1 incomplete" ||
    status.input?.liveHumanGrade?.status !== "passed" ||
    status.input?.liveHumanGrade?.reviewer !== "TJ Pitre" ||
    status.input?.liveHumanGrade?.pageId !== "115:295378" ||
    status.input?.liveHumanGrade?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh" ||
    status.input?.liveHumanGrade?.recordCommit !==
      "c35bae604bbc901a13861c9db9ed79c17a31d909" ||
    status.input?.liveHumanGrade?.evidencePath !== V85_HUMAN_SIGNOFF_PATH ||
    sha256(readRepositoryEvidence(V85_HUMAN_SIGNOFF_PATH)) !==
      V85_HUMAN_SIGNOFF_SHA256 ||
    status.input?.liveHumanGrade?.recordTimeHumanSignoffUnchanged !==
      "pending" ||
    status.input?.liveHumanGrade?.productV1Complete !== false ||
    status.input?.liveHumanGrade?.buttonHumanGradeInvented !== false ||
    status.input?.liveV2?.result !== "failed"
  )
    fail("corrected Button/Input status");
  if (
    status.combobox?.liveV34?.prepared !== true ||
    status.combobox?.liveV34?.liveFigma !== false ||
    status.combobox?.liveV34?.humanSignoff !== "pending" ||
    status.combobox?.liveV34?.pageId !== null ||
    status.combobox?.liveV34?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV34?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV34?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v34" ||
    status.combobox?.liveV34?.teaching !==
      "host observe must omit empty instancePayload facts on slot instances instead of re-injecting live instance descendant payloads that IR and compile omit" ||
    status.combobox?.liveV34?.ownedFillTexts !== 144 ||
    status.combobox?.liveV34?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV34?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV34?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV34?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV34?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV34?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV34?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV34?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV34?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV34?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV34?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV34?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV34?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV34?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV34?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV34?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV34?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV34?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV34?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV34?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV34?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV34?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV34?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV34?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV34?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV34?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV34?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV34?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV34?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV34?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV34
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV34
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV34
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV34?.hostObserveOmitsEmptySlotInstancePayload !==
      true ||
    status.combobox?.liveV34?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV34?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV34?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV34?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV34?.attempt1
      ?.hostObserveEmptySlotInstancePayloadTeachingCleared !== true ||
    status.combobox?.liveV34?.attempt1?.refusedClass !==
      "independent root accounting" ||
    status.combobox?.liveV34?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV34?.nextTeaching !==
      "host observe must omit extra nonempty option-instance instancePayload facts that IR and compile omit, not only empty slot-instance payloads"
  )
    fail("combobox live v34 prepare");
  if (
    status.combobox?.liveV35?.prepared !== true ||
    status.combobox?.liveV35?.liveFigma !== false ||
    status.combobox?.liveV35?.humanSignoff !== "pending" ||
    status.combobox?.liveV35?.pageId !== null ||
    status.combobox?.liveV35?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV35?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV35?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v35" ||
    status.combobox?.liveV35?.teaching !==
      "host observe must omit extra nonempty option-instance instancePayload facts that IR and compile omit, not only empty slot-instance payloads" ||
    status.combobox?.liveV35?.ownedFillTexts !== 144 ||
    status.combobox?.liveV35?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV35?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV35?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV35?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV35?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV35?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV35?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV35?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV35?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV35?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV35?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV35?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV35?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV35?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV35?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV35?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV35?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV35?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV35?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV35?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV35?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV35?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV35?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV35?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV35?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV35?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV35?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV35?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV35?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV35?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV35
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV35
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV35
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV35
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV35?.hostObserveOmitsOptionInstanceInstancePayload !==
      true ||
    status.combobox?.liveV35?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV35?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV35?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV35?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV35?.attempt1
      ?.hostObserveNonemptyOptionInstanceInstancePayloadTeachingCleared !==
      true ||
    status.combobox?.liveV35?.attempt1?.refusedClass !==
      "independent root accounting" ||
    status.combobox?.liveV35?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV35?.nextTeaching !==
      "host observe must recover trigger-slot componentRefs in compile sibling order (prefix then clear then popup), not the live selected-first order (selected then prefix then clear)"
  )
    fail("combobox live v35 prepare");
  if (
    status.combobox?.liveV36?.prepared !== true ||
    status.combobox?.liveV36?.liveFigma !== false ||
    status.combobox?.liveV36?.humanSignoff !== "pending" ||
    status.combobox?.liveV36?.pageId !== null ||
    status.combobox?.liveV36?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV36?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV36?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v36" ||
    status.combobox?.liveV36?.teaching !==
      "host observe must recover trigger-slot componentRefs in compile sibling order (prefix then clear then popup), not the live selected-first order (selected then prefix then clear)" ||
    status.combobox?.liveV36?.ownedFillTexts !== 144 ||
    status.combobox?.liveV36?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV36?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV36?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV36?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV36?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV36?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV36?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV36?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV36?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV36?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV36?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV36?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV36?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV36?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV36?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV36?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV36?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV36?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV36?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV36?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV36?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV36?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV36?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV36?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV36?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV36?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV36?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV36?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV36?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV36?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV36
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV36
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV36
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV36
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV36
      ?.hostObserveOmitsOptionInstanceInstancePayloadUnchangedFromV35 !==
      true ||
    status.combobox?.liveV36
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrder !== true ||
    status.combobox?.liveV36?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV36?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV36?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV36?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV36?.attempt1
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrderTeachingCleared !==
      true ||
    status.combobox?.liveV36?.attempt1?.refusedClass !==
      "independent root accounting" ||
    status.combobox?.liveV36?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV36?.nextTeaching !==
      "host observe must recover compile-carried trigger characters, not the live selected-option characters"
  )
    fail("combobox live v36 prepare");
  if (
    status.combobox?.liveV37?.prepared !== true ||
    status.combobox?.liveV37?.liveFigma !== false ||
    status.combobox?.liveV37?.humanSignoff !== "pending" ||
    status.combobox?.liveV37?.pageId !== null ||
    status.combobox?.liveV37?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV37?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV37?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v37" ||
    status.combobox?.liveV37?.teaching !==
      "host observe must recover compile-carried trigger characters, not the live selected-option characters" ||
    status.combobox?.liveV37?.ownedFillTexts !== 144 ||
    status.combobox?.liveV37?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV37?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV37?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV37?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV37?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV37?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV37?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV37?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV37?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV37?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV37?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV37?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV37?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV37?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV37?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV37?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV37?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV37?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV37?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV37?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV37?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV37?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV37?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV37?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV37?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV37?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV37?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV37?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV37?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV37?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV37
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV37
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV37
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV37
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV37
      ?.hostObserveOmitsOptionInstanceInstancePayloadUnchangedFromV35 !==
      true ||
    status.combobox?.liveV37
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV36 !==
      true ||
    status.combobox?.liveV37?.hostRecoversCompileCarriedTriggerCharacters !==
      true ||
    status.combobox?.liveV37?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV37?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV37?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV37?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV37?.attempt1
      ?.hostRecoversCompileCarriedTriggerCharactersTeachingCleared !==
      true ||
    status.combobox?.liveV37?.attempt1?.refusedClass !==
      "independent root accounting" ||
    status.combobox?.liveV37?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV37?.nextTeaching !==
      "host observe must recover compile-carried option-set name, not the live display name"
  )
    fail("combobox live v37 prepare");
  if (
    status.combobox?.liveV38?.prepared !== true ||
    status.combobox?.liveV38?.liveFigma !== false ||
    status.combobox?.liveV38?.humanSignoff !== "pending" ||
    status.combobox?.liveV38?.pageId !== null ||
    status.combobox?.liveV38?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV38?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV38?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v38" ||
    status.combobox?.liveV38?.teaching !==
      "host observe must recover compile-carried option-set name, not the live display name" ||
    status.combobox?.liveV38?.ownedFillTexts !== 144 ||
    status.combobox?.liveV38?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV38?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV38?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV38?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV38?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV38?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV38?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV38?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV38?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV38?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV38?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV38?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV38?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV38?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV38?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV38?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV38?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV38?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV38?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV38?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV38?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV38?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV38?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV38?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV38?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV38?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV38?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV38?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV38?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV38?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV38
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV38
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV38
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV38
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV38
      ?.hostObserveOmitsOptionInstanceInstancePayloadUnchangedFromV35 !==
      true ||
    status.combobox?.liveV38
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV36 !==
      true ||
    status.combobox?.liveV38
      ?.hostRecoversCompileCarriedTriggerCharactersUnchangedFromV37 !==
      true ||
    status.combobox?.liveV38?.hostObserveRecoversCompileCarriedOptionSetName !==
      true ||
    status.combobox?.liveV38?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV38?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV38?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV38?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV38?.attempt1
      ?.hostObserveRecoversCompileCarriedOptionSetNameTeachingCleared !==
      true ||
    status.combobox?.liveV38?.attempt1?.refusedClass !==
      "two-cycle scene-derived fixed-point" ||
    status.combobox?.liveV38?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV38?.nextTeaching !==
      "host sceneToNormalizedIr must recover trigger-slot componentRefs in compile sibling order (prefix then clear then popup), not the live selected-first order"
  )
    fail("combobox live v38 prepare");
  if (
    status.combobox?.liveV39?.prepared !== true ||
    status.combobox?.liveV39?.liveFigma !== false ||
    status.combobox?.liveV39?.humanSignoff !== "pending" ||
    status.combobox?.liveV39?.pageId !== null ||
    status.combobox?.liveV39?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV39?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV39?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v39" ||
    status.combobox?.liveV39?.teaching !==
      "host sceneToNormalizedIr must recover trigger-slot componentRefs in compile sibling order (prefix then clear then popup), not the live selected-first order" ||
    status.combobox?.liveV39?.ownedFillTexts !== 144 ||
    status.combobox?.liveV39?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV39?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV39?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV39?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV39?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV39?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV39?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV39?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV39?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV39?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV39?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV39?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV39?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV39?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV39?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV39?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV39?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV39?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV39?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV39?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV39?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV39?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV39?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV39?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV39?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV39?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV39?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV39?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV39?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV39?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV39
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV39
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV39
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV39
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV39
      ?.hostObserveOmitsOptionInstanceInstancePayloadUnchangedFromV35 !==
      true ||
    status.combobox?.liveV39
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV36 !==
      true ||
    status.combobox?.liveV39
      ?.hostRecoversCompileCarriedTriggerCharactersUnchangedFromV37 !==
      true ||
    status.combobox?.liveV39
      ?.hostObserveRecoversCompileCarriedOptionSetNameUnchangedFromV38 !==
      true ||
    status.combobox?.liveV39
      ?.hostSceneToNormalizedIrRecoversTriggerSlotComponentRefCompileSiblingOrder !==
      true ||
    status.combobox?.liveV39?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV39?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV39?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV39?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV39?.attempt1
      ?.hostSceneToNormalizedIrRecoversTriggerSlotComponentRefCompileSiblingOrderTeachingCleared !==
      true ||
    status.combobox?.liveV39?.attempt1?.refusedClass !==
      "probe/usability/restoration" ||
    status.combobox?.liveV39?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV39?.nextTeaching !==
      "host probe must keep exactSceneRestoration after the open-variant walk, not refuse both sources when resize and property restore already pass"
  )
    fail("combobox live v39 prepare");
  if (
    status.combobox?.liveV40?.prepared !== true ||
    status.combobox?.liveV40?.liveFigma !== false ||
    status.combobox?.liveV40?.humanSignoff !== "pending" ||
    status.combobox?.liveV40?.pageId !== null ||
    status.combobox?.liveV40?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV40?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV40?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v40" ||
    status.combobox?.liveV40?.teaching !==
      "host probe must keep exactSceneRestoration after the open-variant walk, not refuse both sources when resize and property restore already pass" ||
    status.combobox?.liveV40?.ownedFillTexts !== 144 ||
    status.combobox?.liveV40?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV40?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV40?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV40?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV40?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV40?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV40?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV40?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV40?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV40?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV40?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV40?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV40?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV40?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV40?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV40?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV40?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV40?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV40?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV40?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV40?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV40?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV40?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV40?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV40?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV40?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV40?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV40?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV40?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV40?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV40
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV40
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV40
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV40
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV40
      ?.hostObserveOmitsOptionInstanceInstancePayloadUnchangedFromV35 !==
      true ||
    status.combobox?.liveV40
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV36 !==
      true ||
    status.combobox?.liveV40
      ?.hostRecoversCompileCarriedTriggerCharactersUnchangedFromV37 !==
      true ||
    status.combobox?.liveV40
      ?.hostObserveRecoversCompileCarriedOptionSetNameUnchangedFromV38 !==
      true ||
    status.combobox?.liveV40
      ?.hostSceneToNormalizedIrRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV39 !==
      true ||
    status.combobox?.liveV40
      ?.hostProbeKeepsExactSceneRestorationAfterOpenVariantWalk !== true ||
    status.combobox?.liveV40?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV40?.attempt1?.status !== "failed-closed" ||
    status.combobox?.liveV40?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV40?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV40?.attempt1
      ?.hostProbeKeepsExactSceneRestorationAfterOpenVariantWalkTeachingCleared !==
      true ||
    status.combobox?.liveV40?.attempt1?.refusedClass !==
      "probe/usability/restoration" ||
    status.combobox?.liveV40?.attempt1?.mintStayed !== false ||
    status.combobox?.liveV40?.nextTeaching !==
      "measure the live overlapping node pairs on the 24 Open=true Content=options cells (antd medium 9, mui medium 7, both small 5) after overlay/listbox/option-instance/occupancy exclusions, then teach that measured pair class; do not invent Polar 9/30/0 or overlap-zero"
  )
    fail("combobox live v40 prepare");
  if (
    status.combobox?.liveV41?.prepared !== true ||
    status.combobox?.liveV41?.liveFigma !== true ||
    status.combobox?.liveV41?.humanSignoff !== "pending" ||
    status.combobox?.liveV41?.pageId !== "163:35981" ||
    status.combobox?.liveV41?.forbiddenInputPageId !== "115:295378" ||
    status.combobox?.liveV41?.namespace !== "ds.contracts.combobox.recipe.v1" ||
    status.combobox?.liveV41?.evidenceRoot !==
      "recipe/evidence/combobox-live-pivot-v41" ||
    status.combobox?.liveV41?.teaching !==
      "probe must measure live overlapping node pairs on the 24 Open=true Content=options cells after existing overlay/listbox/option-instance/occupancy exclusions, then not score the measured overlay-nested option/label and selected-indicator against in-flow message/helper and message/error" ||
    status.combobox?.liveV41?.ownedFillTexts !== 144 ||
    status.combobox?.liveV41?.writerUnchangedFromV1 !== false ||
    status.combobox?.liveV41?.restoreUnchangedFromV2 !== true ||
    status.combobox?.liveV41?.extractSetRootEnvelopeHashUnchangedFromV3 !==
      true ||
    status.combobox?.liveV41?.extractCopiedOwnershipKeyUnchangedFromV4 !==
      true ||
    status.combobox?.liveV41?.hostOmitsEmptyInstancePayloadUnchangedFromV5 !==
      true ||
    status.combobox?.liveV41?.hostProjectsLiveRootOwnershipKeyUnchangedFromV6 !==
      true ||
    status.combobox?.liveV41?.hostRecoversRecipeComponentRefUnchangedFromV7 !==
      true ||
    status.combobox?.liveV41?.writerAriaStampUnchangedFromV8 !== true ||
    status.combobox?.liveV41?.hostRecoversComponentPropertyNameUnchangedFromV9 !==
      true ||
    status.combobox?.liveV41?.hostTriggerBindingCompileOrderUnchangedFromV10 !==
      true ||
    status.combobox?.liveV41?.hostLeadingSlotBindingCompileOrderUnchangedFromV11 !==
      true ||
    status.combobox?.liveV41?.hostLeadingSlotCompileCarryVisibleUnchangedFromV12 !==
      true ||
    status.combobox?.liveV41?.hostTrailingSlotBindingCompileOrderUnchangedFromV13 !==
      true ||
    status.combobox?.liveV41?.hostTrailingSlotCompileCarryVisibleUnchangedFromV14 !==
      true ||
    status.combobox?.liveV41?.hostTriggerEmptyEffectsUnchangedFromV15 !==
      true ||
    status.combobox?.liveV41?.hostOverlayBindingCompileOrderUnchangedFromV16 !==
      true ||
    status.combobox?.liveV41?.hostOverlayWidthAliasUnchangedFromV17 !== true ||
    status.combobox?.liveV41?.hostListboxBindingCompileOrderUnchangedFromV18 !==
      true ||
    status.combobox?.liveV41?.hostOptionInstanceBindingExtrasUnchangedFromV19 !==
      true ||
    status.combobox?.liveV41?.hostOptionInstanceFillsOmitUnchangedFromV20 !==
      true ||
    status.combobox?.liveV41?.hostOptionInstancePayloadOmitUnchangedFromV21 !==
      true ||
    status.combobox?.liveV41?.hostListboxClipsContentOmitUnchangedFromV22 !==
      true ||
    status.combobox?.liveV41?.hostListboxCornerRadiusOmitUnchangedFromV23 !==
      true ||
    status.combobox?.liveV41?.hostListboxEmptyEffectsOmitUnchangedFromV24 !==
      true ||
    status.combobox?.liveV41?.hostListboxEmptyStrokesOmitUnchangedFromV25 !==
      true ||
    status.combobox?.liveV41?.hostOverlayEmptyDashPatternOmitUnchangedFromV26 !==
      true ||
    status.combobox?.liveV41?.hostSetRootClipsContentOmitUnchangedFromV27 !==
      true ||
    status.combobox?.liveV41?.hostOptionBindingCompileOrderUnchangedFromV28 !==
      true ||
    status.combobox?.liveV41?.hostOptionHeightAliasUnchangedFromV29 !== true ||
    status.combobox?.liveV41?.hostOptionClipsContentOmitUnchangedFromV30 !==
      true ||
    status.combobox?.liveV41
      ?.hostSelectedIndicatorBindingCompileOrderUnchangedFromV31 !== true ||
    status.combobox?.liveV41
      ?.hostSelectedIndicatorCompileCarryVisibleUnchangedFromV32 !== true ||
    status.combobox?.liveV41
      ?.hostOptionSetCompileCarryLabelUnchangedFromV33 !== true ||
    status.combobox?.liveV41
      ?.hostObserveOmitsEmptySlotInstancePayloadUnchangedFromV34 !== true ||
    status.combobox?.liveV41
      ?.hostObserveOmitsOptionInstanceInstancePayloadUnchangedFromV35 !==
      true ||
    status.combobox?.liveV41
      ?.hostRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV36 !==
      true ||
    status.combobox?.liveV41
      ?.hostRecoversCompileCarriedTriggerCharactersUnchangedFromV37 !==
      true ||
    status.combobox?.liveV41
      ?.hostObserveRecoversCompileCarriedOptionSetNameUnchangedFromV38 !==
      true ||
    status.combobox?.liveV41
      ?.hostSceneToNormalizedIrRecoversTriggerSlotComponentRefCompileSiblingOrderUnchangedFromV39 !==
      true ||
    status.combobox?.liveV41
      ?.hostProbeKeepsExactSceneRestorationAfterOpenVariantWalkUnchangedFromV40 !==
      true ||
    status.combobox?.liveV41
      ?.hostProbeExcludesOverlayOptionLabelMessageOverlap !== true ||
    status.combobox?.liveV41?.runIdentity !==
      "70c24cbd-d27f2e85-combobox-v1" ||
    status.combobox?.liveV41?.attempt1?.status !== "stayed-pending-human" ||
    status.combobox?.liveV41?.attempt1?.restoreAccepted !== true ||
    status.combobox?.liveV41?.attempt1?.restoredCount !== 144 ||
    status.combobox?.liveV41?.attempt1?.extractWalkCleared !== true ||
    status.combobox?.liveV41?.attempt1?.probePassed !== true ||
    status.combobox?.liveV41?.attempt1?.capturesIssued !== 72 ||
    status.combobox?.liveV41?.attempt1?.technicalPassed !== true ||
    status.combobox?.liveV41?.attempt1
      ?.hostProbeExcludesOverlayOptionLabelMessageOverlapTeachingCleared !==
      true ||
    status.combobox?.liveV41?.attempt1?.refusedClass !== null ||
    status.combobox?.liveV41?.attempt1?.mintStayed !== true ||
    status.combobox?.liveV41?.attempt1?.pageId !== "163:35981" ||
    status.combobox?.liveV41?.attempt1?.cleanupExecuted !== false ||
    status.combobox?.namedFeedback20260829?.kind !==
      "named-feedback-not-human-grade" ||
    status.combobox?.namedFeedback20260829?.verdict !==
      "empty-loading-listbox-padding-not-a-miss" ||
    status.combobox?.namedFeedback20260829?.reminted !== false ||
    status.combobox?.namedFeedback20260829?.humanSignoff !== "pending" ||
    status.combobox?.namedFeedback20260829?.overallSuccess !== false ||
    status.combobox?.namedFeedback20260829?.productV1Complete !== false ||
    status.combobox?.namedFeedback20260829?.pageId !== "163:35981" ||
    status.combobox?.namedFeedback20260829?.fileKey !==
      "byMp6lt0Ij9b2QbkDGFwBh" ||
    status.combobox?.namedFeedback20260829?.reviewer !== "TJ Pitre" ||
    status.combobox?.namedFeedback20260829?.evidencePath !==
      COMBOBOX_V41_NAMED_FEEDBACK_PATH ||
    sha256(readRepositoryEvidence(COMBOBOX_V41_NAMED_FEEDBACK_PATH)) !==
      COMBOBOX_V41_NAMED_FEEDBACK_SHA256 ||
    status.combobox?.namedFeedback20260829?.nextHill !==
      "Data Table once TJ has seen the empty/loading conclusion" ||
    status.combobox?.liveHumanGrade?.status !== "passed" ||
    status.combobox?.liveHumanGrade?.reviewer !== "TJ Pitre" ||
    status.combobox?.liveHumanGrade?.pageId !== "163:35981" ||
    status.combobox?.liveHumanGrade?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh" ||
    status.combobox?.liveHumanGrade?.recordCommit !==
      "f330a0821a5c442662c9df755c9f65e825fe5baa" ||
    status.combobox?.liveHumanGrade?.evidencePath !==
      COMBOBOX_V41_HUMAN_SIGNOFF_PATH ||
    sha256(readRepositoryEvidence(COMBOBOX_V41_HUMAN_SIGNOFF_PATH)) !==
      COMBOBOX_V41_HUMAN_SIGNOFF_SHA256 ||
    status.combobox?.liveHumanGrade?.diagnosisPath !==
      COMBOBOX_V41_NAMED_FEEDBACK_PATH ||
    status.combobox?.liveHumanGrade?.recordTimeHumanSignoffUnchanged !==
      "pending" ||
    status.combobox?.liveHumanGrade?.productV1Complete !== false ||
    status.combobox?.liveHumanGrade?.buttonHumanGradeInvented !== false ||
    status.combobox?.liveHumanGrade?.dataTableHumanGradeInvented !== false ||
    status.combobox?.liveHumanGrade?.nextHill !== "Data Table"
  )
    fail("combobox live v41 prepare");
  if (
    status.table?.overallSuccess !== false ||
    status.table?.status !==
      "live-v4-prepared; product v1 incomplete" ||
    status.table?.humanSignoff !== "pending" ||
    status.table?.liveFigma !== false ||
    status.table?.humanGradeInvented !== false ||
    status.table?.recipe?.id !== "table" ||
    status.table?.recipe?.version !== 1 ||
    status.table?.recipe?.liveFigma !== false ||
    status.table?.recipe?.writer !== true ||
    status.table?.recipe?.writerIdentity !== "ds.contracts.table.recipe.v1" ||
    status.table?.recipe?.sourceReferencesRendered !== false ||
    status.table?.recipe?.aiGraded !== false ||
    status.table?.offlineProof?.pairedCellsPlanned !== 8 ||
    status.table?.offlineProof?.components !== 10 ||
    status.table?.offlineProof?.instances !== 22 ||
    status.table?.offlineProof?.gate !== "recipe:table:check" ||
    status.table?.live?.prepared !== true ||
    status.table?.live?.pageId !== null ||
    status.table?.live?.forbiddenInputPageId !== "115:295378" ||
    status.table?.live?.forbiddenComboboxPageId !== "163:35981" ||
    status.table?.live?.runIdentity !== "83a27edf-82d19508-table-v1" ||
    status.table?.live?.namespace !== "ds.contracts.table.recipe.v1" ||
    status.table?.live?.evidenceRoot !==
      "recipe/evidence/table-live-pivot-v1" ||
    status.table?.live?.attempt1?.status !== "failed-closed" ||
    status.table?.live?.attempt1?.writerAccepted !== false ||
    status.table?.live?.attempt1?.refusedClass !==
      "TABLE-FONT-PROVENANCE-TAMPER" ||
    status.table?.live?.attempt1?.refused !==
      "TABLE-FONT-PROVENANCE-TAMPER:Arial:Bold" ||
    status.table?.live?.attempt1?.observedFont !== "Arial:Bold" ||
    status.table?.live?.attempt1?.namedFromSource !== "Inter SemiBold" ||
    status.table?.live?.attempt1?.hostListed !== "Inter Semi Bold" ||
    status.table?.live?.attempt1?.restoreIssued !== false ||
    status.table?.live?.attempt1?.extractIssued !== false ||
    status.table?.live?.attempt1?.probeIssued !== false ||
    status.table?.live?.attempt1?.capturesIssued !== 0 ||
    status.table?.live?.attempt1?.mintStayed !== false ||
    status.table?.live?.attempt1?.cleanedPageId !== "165:40622" ||
    status.table?.live?.attempt1?.cleanedCollectionId !==
      "VariableCollectionId:165:40624" ||
    status.table?.live?.attempt1?.cleanupExecuted !== true ||
    status.table?.live?.attempt1?.signedCleanupIssued !== false ||
    status.table?.live?.nextTeaching !==
      "name first-party header font as host-listed Inter Semi Bold" ||
    sha256(readRepositoryEvidence(TABLE_LIVE_V1_ATTEMPT_1_PATH)) !==
      TABLE_LIVE_V1_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(TABLE_LIVE_V1_STATUS_PATH)) !==
      TABLE_LIVE_V1_STATUS_SHA256 ||
    status.table?.liveV2?.prepared !== true ||
    status.table?.liveV2?.liveFigma !== false ||
    status.table?.liveV2?.humanSignoff !== "pending" ||
    status.table?.liveV2?.pageId !== null ||
    status.table?.liveV2?.forbiddenInputPageId !== "115:295378" ||
    status.table?.liveV2?.forbiddenComboboxPageId !== "163:35981" ||
    status.table?.liveV2?.runIdentity !== "cc811f47-82d19508-table-v2" ||
    status.table?.liveV2?.namespace !== "ds.contracts.table.recipe.v1" ||
    status.table?.liveV2?.evidenceRoot !==
      "recipe/evidence/table-live-pivot-v2" ||
    status.table?.liveV2?.teaching !==
      "name first-party header font as host-listed Inter Semi Bold" ||
    status.table?.liveV2?.namedFromSourceFamily !== "Inter" ||
    status.table?.liveV2?.carriedHostStyle !== "Semi Bold" ||
    status.table?.liveV2?.resolution !== "requested" ||
    status.table?.liveV2?.doNotRestartV1Attempt2 !== true ||
    status.table?.liveV2?.doNotRestartV2Attempt2 !== true ||
    status.table?.liveV2?.hostNormalizeUnchangedFromV1 !== true ||
    status.table?.liveV2?.attempt1?.status !== "failed-closed" ||
    status.table?.liveV2?.attempt1?.writerAccepted !== false ||
    status.table?.liveV2?.attempt1?.refusedClass !==
      "TABLE-COMPONENT-PROPERTY-REFERENCES-UNRECOGNIZED-KEY" ||
    status.table?.liveV2?.attempt1?.refused !==
      "TABLE-COMPONENT-PROPERTY-REFERENCES-UNRECOGNIZED-KEY:Label#165:24507" ||
    status.table?.liveV2?.attempt1?.headerFontTeachingCleared !== true ||
    status.table?.liveV2?.attempt1?.restoreIssued !== false ||
    status.table?.liveV2?.attempt1?.extractIssued !== false ||
    status.table?.liveV2?.attempt1?.probeIssued !== false ||
    status.table?.liveV2?.attempt1?.capturesIssued !== 0 ||
    status.table?.liveV2?.attempt1?.mintStayed !== false ||
    status.table?.liveV2?.attempt1?.cleanedPageId !== "165:40645" ||
    status.table?.liveV2?.attempt1?.cleanedCollectionId !==
      "VariableCollectionId:165:40647" ||
    status.table?.liveV2?.attempt1?.cleanupExecuted !== true ||
    status.table?.liveV2?.attempt1?.signedCleanupIssued !== false ||
    status.table?.liveV2?.nextTeaching !==
      "bind row Cell N through the nested cell-label TEXT characters field (host-listed), not through the instance Label# property id as a componentPropertyReferences key" ||
    sha256(readRepositoryEvidence(TABLE_LIVE_V2_ATTEMPT_1_PATH)) !==
      TABLE_LIVE_V2_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(TABLE_LIVE_V2_STATUS_PATH)) !==
      TABLE_LIVE_V2_STATUS_SHA256 ||
    status.table?.liveV3?.prepared !== true ||
    status.table?.liveV3?.liveFigma !== false ||
    status.table?.liveV3?.humanSignoff !== "pending" ||
    status.table?.liveV3?.pageId !== null ||
    status.table?.liveV3?.forbiddenInputPageId !== "115:295378" ||
    status.table?.liveV3?.forbiddenComboboxPageId !== "163:35981" ||
    status.table?.liveV3?.runIdentity !== "cc811f47-82d19508-table-v3" ||
    status.table?.liveV3?.namespace !== "ds.contracts.table.recipe.v1" ||
    status.table?.liveV3?.evidenceRoot !==
      "recipe/evidence/table-live-pivot-v3" ||
    status.table?.liveV3?.teaching !==
      "bind row Cell N through the nested cell-label TEXT characters field (host-listed), not through the instance Label# property id as a componentPropertyReferences key" ||
    status.table?.liveV3?.namedFromSourceFamily !== "Inter" ||
    status.table?.liveV3?.carriedHostStyle !== "Semi Bold" ||
    status.table?.liveV3?.resolution !== "requested" ||
    status.table?.liveV3?.doNotRestartV1Attempt2 !== true ||
    status.table?.liveV3?.doNotRestartV2Attempt2 !== true ||
    status.table?.liveV3?.doNotRestartV3Attempt2 !== true ||
    status.table?.liveV3?.headerFontTeachingUnchangedFromV2 !== true ||
    status.table?.liveV3?.hostNormalizeUnchangedFromV1 !== true ||
    status.table?.liveV3?.attempt1?.status !== "failed-closed" ||
    status.table?.liveV3?.attempt1?.writerAccepted !== false ||
    status.table?.liveV3?.attempt1?.refusedClass !==
      "TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER" ||
    status.table?.liveV3?.attempt1?.refused !==
      "TABLE-COMPONENT-PROPERTY-REFERENCES-INSTANCE-SUBLAYER" ||
    status.table?.liveV3?.attempt1?.nestedCellLabelCharactersTeachingCleared !==
      true ||
    status.table?.liveV3?.attempt1?.restoreIssued !== false ||
    status.table?.liveV3?.attempt1?.extractIssued !== false ||
    status.table?.liveV3?.attempt1?.probeIssued !== false ||
    status.table?.liveV3?.attempt1?.capturesIssued !== 0 ||
    status.table?.liveV3?.attempt1?.mintStayed !== false ||
    status.table?.liveV3?.attempt1?.cleanedPageId !== "165:40704" ||
    status.table?.liveV3?.attempt1?.cleanedCollectionId !==
      "VariableCollectionId:165:40706" ||
    status.table?.liveV3?.attempt1?.cleanupExecuted !== true ||
    status.table?.liveV3?.attempt1?.signedCleanupIssued !== false ||
    status.table?.liveV3?.nextTeaching !==
      "bind row Cell N on original non-instance-sublayer TEXT in the row component through host-listed characters; do not set componentPropertyReferences on TEXT nested inside a cell INSTANCE" ||
    sha256(readRepositoryEvidence(TABLE_LIVE_V3_ATTEMPT_1_PATH)) !==
      TABLE_LIVE_V3_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(TABLE_LIVE_V3_STATUS_PATH)) !==
      TABLE_LIVE_V3_STATUS_SHA256 ||
    status.table?.liveV4?.prepared !== true ||
    status.table?.liveV4?.liveFigma !== false ||
    status.table?.liveV4?.humanSignoff !== "pending" ||
    status.table?.liveV4?.pageId !== null ||
    status.table?.liveV4?.forbiddenInputPageId !== "115:295378" ||
    status.table?.liveV4?.forbiddenComboboxPageId !== "163:35981" ||
    status.table?.liveV4?.runIdentity !== "cc811f47-82d19508-table-v4" ||
    status.table?.liveV4?.namespace !== "ds.contracts.table.recipe.v1" ||
    status.table?.liveV4?.evidenceRoot !==
      "recipe/evidence/table-live-pivot-v4" ||
    status.table?.liveV4?.teaching !==
      "bind row Cell N on original non-instance-sublayer TEXT in the row component through host-listed characters; do not set componentPropertyReferences on TEXT nested inside a cell INSTANCE" ||
    status.table?.liveV4?.namedFromSourceFamily !== "Inter" ||
    status.table?.liveV4?.carriedHostStyle !== "Semi Bold" ||
    status.table?.liveV4?.resolution !== "requested" ||
    status.table?.liveV4?.doNotRestartV1Attempt2 !== true ||
    status.table?.liveV4?.doNotRestartV2Attempt2 !== true ||
    status.table?.liveV4?.doNotRestartV3Attempt2 !== true ||
    status.table?.liveV4?.headerFontTeachingUnchangedFromV2 !== true ||
    status.table?.liveV4?.hostNormalizeUnchangedFromV1 !== true
  )
    fail("table live v1 attempt 1 / v2 attempt 1 / v3 attempt 1 / v4 prepare");
  for (const message of validateButtonStatusPlant(status.button ?? {}))
    fail(message);
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
    status.input?.liveV46?.overallInputSuccess !== false ||
    status.input?.liveV47?.status !== V47_STATUS ||
    status.input?.liveV47?.baseCommit !== V47_BASE_COMMIT ||
    status.input?.liveV47?.protocolSha256 !== V47_PROTOCOL_SHA256 ||
    status.input?.liveV47?.proofPlanSha256 !== V47_PLAN_SHA256 ||
    status.input?.liveV47?.captureManifestSha256 !==
      V47_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV47?.requestManifestSha256 !==
      V47_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV47?.antecedentIndexSha256 !== V47_INDEX_SHA256 ||
    status.input?.liveV47?.antecedentHashSetSha256 !== V47_HASH_SET_SHA256 ||
    status.input?.liveV47?.authorizationTemplateSha256 !==
      V47_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV47?.antecedentCommit !== V47_ANTECEDENT_COMMIT ||
    status.input?.liveV47?.authorizationPresent !== true ||
    status.input?.liveV47?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV47?.authorizationEffective !== false ||
    status.input?.liveV47?.authorizationPath !== V47_AUTHORIZATION_PATH ||
    status.input?.liveV47?.authorizationSha256 !== V47_AUTHORIZATION_SHA256 ||
    status.input?.liveV47?.signingPublicKeySpkiSha256 !==
      V47_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV47?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV47?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV47?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV47?.v46AuthorizationReusable !== false ||
    status.input?.liveV47?.v46AntecedentBytesUnchanged !== true ||
    status.input?.liveV47?.v46SceneReadbackUnchanged !== true ||
    status.input?.liveV47?.v45SceneReadbackUnchanged !== true ||
    status.input?.liveV47?.taughtMessageTextDecorationOmitted !== true ||
    status.input?.liveV47?.taughtMessageTextCaseOmitted !== true ||
    status.input?.liveV47?.taughtMessageLetterSpacingOmitted !== true ||
    status.input?.liveV47?.taughtMessageBindingCompileOrder !== true ||
    status.input?.liveV47?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV47?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV47?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV47?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV47?.sceneReadbackCarried !== true ||
    status.input?.liveV47?.carriedV3Verifier !== true ||
    status.input?.liveV47?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV47?.carriedSceneReadback !==
      "recipe/scene-readback-v47.ts" ||
    status.input?.liveV47?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v47.ts" ||
    status.input?.liveV47?.sourceRoots !== 2 ||
    status.input?.liveV47?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV47?.captureCells !== 128 ||
    status.input?.liveV47?.remoteRequests !== 133 ||
    status.input?.liveV47?.hostPhases !== 3 ||
    status.input?.liveV47?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV47?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV47?.attemptsExecuted !== 1 ||
    status.input?.liveV47?.nextAttempt !== 2 ||
    status.input?.liveV47?.liveExecutionOccurred !== true ||
    status.input?.liveV47?.figmaWrites !== 4 ||
    status.input?.liveV47?.figmaCaptures !== 0 ||
    status.input?.liveV47?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV47?.attempt1Path !== V47_ATTEMPT_1_PATH ||
    status.input?.liveV47?.attempt1Sha256 !== V47_ATTEMPT_1_SHA256 ||
    status.input?.liveV47
      ?.restartAsV47Attempt2WithoutMessageContainerClipsContentOmitForbidden !==
      true ||
    status.input?.liveV47?.humanSignoff !== "pending" ||
    status.input?.liveV47?.overallInputSuccess !== false ||
    status.input?.liveV48?.status !== V48_STATUS ||
    status.input?.liveV48?.baseCommit !== V48_BASE_COMMIT ||
    status.input?.liveV48?.protocolSha256 !== V48_PROTOCOL_SHA256 ||
    status.input?.liveV48?.proofPlanSha256 !== V48_PLAN_SHA256 ||
    status.input?.liveV48?.captureManifestSha256 !==
      V48_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV48?.requestManifestSha256 !==
      V48_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV48?.antecedentIndexSha256 !== V48_INDEX_SHA256 ||
    status.input?.liveV48?.antecedentHashSetSha256 !== V48_HASH_SET_SHA256 ||
    status.input?.liveV48?.authorizationTemplateSha256 !==
      V48_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV48?.antecedentCommit !== V48_ANTECEDENT_COMMIT ||
    status.input?.liveV48?.authorizationPresent !== true ||
    status.input?.liveV48?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV48?.authorizationEffective !== false ||
    status.input?.liveV48?.authorizationPath !== V48_AUTHORIZATION_PATH ||
    status.input?.liveV48?.authorizationSha256 !== V48_AUTHORIZATION_SHA256 ||
    status.input?.liveV48?.signingPublicKeySpkiSha256 !==
      V48_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV48?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV48?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV48?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV48?.v47AuthorizationReusable !== false ||
    status.input?.liveV48?.v47AntecedentBytesUnchanged !== true ||
    status.input?.liveV48?.v47SceneReadbackUnchanged !== true ||
    status.input?.liveV48?.v46SceneReadbackUnchanged !== true ||
    status.input?.liveV48?.taughtMessageContainerClipsContentOmitted !== true ||
    status.input?.liveV48?.taughtMessageTextDecorationOmitted !== true ||
    status.input?.liveV48?.taughtMessageTextCaseOmitted !== true ||
    status.input?.liveV48?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV48?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV48?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV48?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV48?.sceneReadbackCarried !== true ||
    status.input?.liveV48?.carriedV3Verifier !== true ||
    status.input?.liveV48?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV48?.carriedSceneReadback !==
      "recipe/scene-readback-v48.ts" ||
    status.input?.liveV48?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v48.ts" ||
    status.input?.liveV48?.sourceRoots !== 2 ||
    status.input?.liveV48?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV48?.captureCells !== 128 ||
    status.input?.liveV48?.remoteRequests !== 133 ||
    status.input?.liveV48?.hostPhases !== 3 ||
    status.input?.liveV48?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV48?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV48?.attemptsExecuted !== 1 ||
    status.input?.liveV48?.nextAttempt !== 2 ||
    status.input?.liveV48?.liveExecutionOccurred !== true ||
    status.input?.liveV48?.figmaWrites !== 4 ||
    status.input?.liveV48?.figmaCaptures !== 0 ||
    status.input?.liveV48?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV48?.attempt1Path !== V48_ATTEMPT_1_PATH ||
    status.input?.liveV48?.attempt1Sha256 !== V48_ATTEMPT_1_SHA256 ||
    status.input?.liveV48
      ?.restartAsV48Attempt2WithoutMessageContainerCornerRadiusOmitForbidden !==
      true ||
    status.input?.liveV48?.humanSignoff !== "pending" ||
    status.input?.liveV48?.overallInputSuccess !== false ||
    status.input?.liveV49?.status !== V49_STATUS ||
    status.input?.liveV49?.baseCommit !== V49_BASE_COMMIT ||
    status.input?.liveV49?.protocolSha256 !== V49_PROTOCOL_SHA256 ||
    status.input?.liveV49?.proofPlanSha256 !== V49_PLAN_SHA256 ||
    status.input?.liveV49?.captureManifestSha256 !==
      V49_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV49?.requestManifestSha256 !==
      V49_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV49?.antecedentIndexSha256 !== V49_INDEX_SHA256 ||
    status.input?.liveV49?.antecedentHashSetSha256 !== V49_HASH_SET_SHA256 ||
    status.input?.liveV49?.authorizationTemplateSha256 !==
      V49_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV49?.antecedentCommit !== V49_ANTECEDENT_COMMIT ||
    status.input?.liveV49?.authorizationPresent !== true ||
    status.input?.liveV49?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV49?.authorizationEffective !== false ||
    status.input?.liveV49?.authorizationPath !== V49_AUTHORIZATION_PATH ||
    status.input?.liveV49?.authorizationSha256 !== V49_AUTHORIZATION_SHA256 ||
    status.input?.liveV49?.signingPublicKeySpkiSha256 !==
      V49_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV49?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV49?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV49?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV49?.v48AuthorizationReusable !== false ||
    status.input?.liveV49?.v48AntecedentBytesUnchanged !== true ||
    status.input?.liveV49?.v48SceneReadbackUnchanged !== true ||
    status.input?.liveV49?.v47SceneReadbackUnchanged !== true ||
    status.input?.liveV49?.taughtMessageContainerCornerRadiusOmitted !== true ||
    status.input?.liveV49?.taughtMessageContainerClipsContentOmitted !== true ||
    status.input?.liveV49?.taughtMessageTextDecorationOmitted !== true ||
    status.input?.liveV49?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV49?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV49?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV49?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV49?.sceneReadbackCarried !== true ||
    status.input?.liveV49?.carriedV3Verifier !== true ||
    status.input?.liveV49?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV49?.carriedSceneReadback !==
      "recipe/scene-readback-v49.ts" ||
    status.input?.liveV49?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v49.ts" ||
    status.input?.liveV49?.sourceRoots !== 2 ||
    status.input?.liveV49?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV49?.captureCells !== 128 ||
    status.input?.liveV49?.remoteRequests !== 133 ||
    status.input?.liveV49?.hostPhases !== 3 ||
    status.input?.liveV49?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV49?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV49?.attemptsExecuted !== 1 ||
    status.input?.liveV49?.nextAttempt !== 2 ||
    status.input?.liveV49?.liveExecutionOccurred !== true ||
    status.input?.liveV49?.figmaWrites !== 4 ||
    status.input?.liveV49?.figmaCaptures !== 0 ||
    status.input?.liveV49?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV49?.attempt1Path !== V49_ATTEMPT_1_PATH ||
    status.input?.liveV49?.attempt1Sha256 !== V49_ATTEMPT_1_SHA256 ||
    status.input?.liveV49
      ?.restartAsV49Attempt2WithoutMessageContainerEffectsOmitForbidden !==
      true ||
    status.input?.liveV49?.humanSignoff !== "pending" ||
    status.input?.liveV49?.overallInputSuccess !== false ||
    status.input?.liveV50?.status !== V50_STATUS ||
    status.input?.liveV50?.baseCommit !== V50_BASE_COMMIT ||
    status.input?.liveV50?.protocolSha256 !== V50_PROTOCOL_SHA256 ||
    status.input?.liveV50?.proofPlanSha256 !== V50_PLAN_SHA256 ||
    status.input?.liveV50?.captureManifestSha256 !==
      V50_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV50?.requestManifestSha256 !==
      V50_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV50?.antecedentIndexSha256 !== V50_INDEX_SHA256 ||
    status.input?.liveV50?.antecedentHashSetSha256 !== V50_HASH_SET_SHA256 ||
    status.input?.liveV50?.authorizationTemplateSha256 !==
      V50_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV50?.antecedentCommit !== V50_ANTECEDENT_COMMIT ||
    status.input?.liveV50?.authorizationPresent !== true ||
    status.input?.liveV50?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV50?.authorizationEffective !== false ||
    status.input?.liveV50?.authorizationPath !== V50_AUTHORIZATION_PATH ||
    status.input?.liveV50?.authorizationSha256 !== V50_AUTHORIZATION_SHA256 ||
    status.input?.liveV50?.signingPublicKeySpkiSha256 !==
      V50_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV50?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV50?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV50?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV50?.v49AuthorizationReusable !== false ||
    status.input?.liveV50?.v49AntecedentBytesUnchanged !== true ||
    status.input?.liveV50?.v49SceneReadbackUnchanged !== true ||
    status.input?.liveV50?.v48SceneReadbackUnchanged !== true ||
    status.input?.liveV50?.taughtMessageContainerEffectsOmitted !== true ||
    status.input?.liveV50?.taughtMessageContainerCornerRadiusOmitted !== true ||
    status.input?.liveV50?.taughtMessageContainerClipsContentOmitted !== true ||
    status.input?.liveV50?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV50?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV50?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV50?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV50?.sceneReadbackCarried !== true ||
    status.input?.liveV50?.carriedV3Verifier !== true ||
    status.input?.liveV50?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV50?.carriedSceneReadback !==
      "recipe/scene-readback-v50.ts" ||
    status.input?.liveV50?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v50.ts" ||
    status.input?.liveV50?.sourceRoots !== 2 ||
    status.input?.liveV50?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV50?.captureCells !== 128 ||
    status.input?.liveV50?.remoteRequests !== 133 ||
    status.input?.liveV50?.hostPhases !== 3 ||
    status.input?.liveV50?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV50?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV50?.attemptsExecuted !== 1 ||
    status.input?.liveV50?.nextAttempt !== 2 ||
    status.input?.liveV50?.liveExecutionOccurred !== true ||
    status.input?.liveV50?.figmaWrites !== 4 ||
    status.input?.liveV50?.figmaCaptures !== 0 ||
    status.input?.liveV50?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV50?.attempt1Path !== V50_ATTEMPT_1_PATH ||
    status.input?.liveV50?.attempt1Sha256 !== V50_ATTEMPT_1_SHA256 ||
    status.input?.liveV50
      ?.restartAsV50Attempt2WithoutMessageContainerStrokesOmitForbidden !==
      true ||
    status.input?.liveV50?.humanSignoff !== "pending" ||
    status.input?.liveV50?.overallInputSuccess !== false ||
    status.input?.liveV51?.status !== V51_STATUS ||
    status.input?.liveV51?.baseCommit !== V51_BASE_COMMIT ||
    status.input?.liveV51?.protocolSha256 !== V51_PROTOCOL_SHA256 ||
    status.input?.liveV51?.proofPlanSha256 !== V51_PLAN_SHA256 ||
    status.input?.liveV51?.captureManifestSha256 !==
      V51_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV51?.requestManifestSha256 !==
      V51_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV51?.antecedentIndexSha256 !== V51_INDEX_SHA256 ||
    status.input?.liveV51?.antecedentHashSetSha256 !== V51_HASH_SET_SHA256 ||
    status.input?.liveV51?.authorizationTemplateSha256 !==
      V51_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV51?.antecedentCommit !== V51_ANTECEDENT_COMMIT ||
    status.input?.liveV51?.authorizationPresent !== true ||
    status.input?.liveV51?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV51?.authorizationEffective !== false ||
    status.input?.liveV51?.authorizationPath !== V51_AUTHORIZATION_PATH ||
    status.input?.liveV51?.authorizationSha256 !== V51_AUTHORIZATION_SHA256 ||
    status.input?.liveV51?.signingPublicKeySpkiSha256 !==
      V51_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV51?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV51?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV51?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV51?.v50AuthorizationReusable !== false ||
    status.input?.liveV51?.v50AntecedentBytesUnchanged !== true ||
    status.input?.liveV51?.v50SceneReadbackUnchanged !== true ||
    status.input?.liveV51?.v49SceneReadbackUnchanged !== true ||
    status.input?.liveV51?.taughtMessageContainerStrokesOmitted !== true ||
    status.input?.liveV51?.taughtMessageContainerEffectsOmitted !== true ||
    status.input?.liveV51?.taughtMessageContainerCornerRadiusOmitted !== true ||
    status.input?.liveV51?.taughtMessageContainerClipsContentOmitted !== true ||
    status.input?.liveV51?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV51?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV51?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV51?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV51?.sceneReadbackCarried !== true ||
    status.input?.liveV51?.carriedV3Verifier !== true ||
    status.input?.liveV51?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV51?.carriedSceneReadback !==
      "recipe/scene-readback-v51.ts" ||
    status.input?.liveV51?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v51.ts" ||
    status.input?.liveV51?.sourceRoots !== 2 ||
    status.input?.liveV51?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV51?.captureCells !== 128 ||
    status.input?.liveV51?.remoteRequests !== 133 ||
    status.input?.liveV51?.hostPhases !== 3 ||
    status.input?.liveV51?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV51?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV51?.attemptsExecuted !== 1 ||
    status.input?.liveV51?.nextAttempt !== 2 ||
    status.input?.liveV51?.liveExecutionOccurred !== true ||
    status.input?.liveV51?.figmaWrites !== 4 ||
    status.input?.liveV51?.figmaCaptures !== 0 ||
    status.input?.liveV51?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV51?.attempt1Path !== V51_ATTEMPT_1_PATH ||
    status.input?.liveV51?.attempt1Sha256 !== V51_ATTEMPT_1_SHA256 ||
    status.input?.liveV51
      ?.restartAsV51Attempt2WithoutVariantCornerRadiusOmitForbidden !==
      true ||
    status.input?.liveV51?.humanSignoff !== "pending" ||
    status.input?.liveV51?.overallInputSuccess !== false ||
    status.input?.liveV52?.status !== V52_STATUS ||
    status.input?.liveV52?.baseCommit !== V52_BASE_COMMIT ||
    status.input?.liveV52?.protocolSha256 !== V52_PROTOCOL_SHA256 ||
    status.input?.liveV52?.proofPlanSha256 !== V52_PLAN_SHA256 ||
    status.input?.liveV52?.captureManifestSha256 !==
      V52_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV52?.requestManifestSha256 !==
      V52_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV52?.antecedentIndexSha256 !== V52_INDEX_SHA256 ||
    status.input?.liveV52?.antecedentHashSetSha256 !== V52_HASH_SET_SHA256 ||
    status.input?.liveV52?.authorizationTemplateSha256 !==
      V52_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV52?.antecedentCommit !== V52_ANTECEDENT_COMMIT ||
    status.input?.liveV52?.authorizationPresent !== true ||
    status.input?.liveV52?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV52?.authorizationEffective !== false ||
    status.input?.liveV52?.authorizationPath !== V52_AUTHORIZATION_PATH ||
    status.input?.liveV52?.authorizationSha256 !== V52_AUTHORIZATION_SHA256 ||
    status.input?.liveV52?.signingPublicKeySpkiSha256 !==
      V52_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV52?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV52?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV52?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV52?.v51AuthorizationReusable !== false ||
    status.input?.liveV52?.v51AntecedentBytesUnchanged !== true ||
    status.input?.liveV52?.v51SceneReadbackUnchanged !== true ||
    status.input?.liveV52?.v50SceneReadbackUnchanged !== true ||
    status.input?.liveV52?.taughtVariantCornerRadiusOmitted !== true ||
    status.input?.liveV52?.taughtMessageContainerStrokesOmitted !== true ||
    status.input?.liveV52?.taughtMessageContainerEffectsOmitted !== true ||
    status.input?.liveV52?.taughtMessageContainerCornerRadiusOmitted !== true ||
    status.input?.liveV52?.taughtMessageContainerClipsContentOmitted !== true ||
    status.input?.liveV52?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV52?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV52?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV52?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV52?.sceneReadbackCarried !== true ||
    status.input?.liveV52?.carriedV3Verifier !== true ||
    status.input?.liveV52?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV52?.carriedSceneReadback !==
      "recipe/scene-readback-v52.ts" ||
    status.input?.liveV52?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v52.ts" ||
    status.input?.liveV52?.sourceRoots !== 2 ||
    status.input?.liveV52?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV52?.captureCells !== 128 ||
    status.input?.liveV52?.remoteRequests !== 133 ||
    status.input?.liveV52?.hostPhases !== 3 ||
    status.input?.liveV52?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV52?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV52?.attemptsExecuted !== 1 ||
    status.input?.liveV52?.nextAttempt !== 2 ||
    status.input?.liveV52?.liveExecutionOccurred !== true ||
    status.input?.liveV52?.figmaWrites !== 4 ||
    status.input?.liveV52?.figmaCaptures !== 0 ||
    status.input?.liveV52?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV52?.attempt1Path !== V52_ATTEMPT_1_PATH ||
    status.input?.liveV52?.attempt1Sha256 !== V52_ATTEMPT_1_SHA256 ||
    status.input?.liveV52
      ?.restartAsV52Attempt2WithoutVariantEffectsOmitForbidden !==
      true ||
    status.input?.liveV52?.humanSignoff !== "pending" ||
    status.input?.liveV52?.overallInputSuccess !== false ||
    status.input?.liveV53?.status !== V53_STATUS ||
    status.input?.liveV53?.baseCommit !== V53_BASE_COMMIT ||
    status.input?.liveV53?.protocolSha256 !== V53_PROTOCOL_SHA256 ||
    status.input?.liveV53?.proofPlanSha256 !== V53_PLAN_SHA256 ||
    status.input?.liveV53?.captureManifestSha256 !==
      V53_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV53?.requestManifestSha256 !==
      V53_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV53?.antecedentIndexSha256 !== V53_INDEX_SHA256 ||
    status.input?.liveV53?.antecedentHashSetSha256 !== V53_HASH_SET_SHA256 ||
    status.input?.liveV53?.authorizationTemplateSha256 !==
      V53_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV53?.antecedentCommit !== V53_ANTECEDENT_COMMIT ||
    status.input?.liveV53?.authorizationPresent !== true ||
    status.input?.liveV53?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV53?.authorizationEffective !== false ||
    status.input?.liveV53?.authorizationPath !== V53_AUTHORIZATION_PATH ||
    status.input?.liveV53?.authorizationSha256 !== V53_AUTHORIZATION_SHA256 ||
    status.input?.liveV53?.signingPublicKeySpkiSha256 !==
      V53_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV53?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV53?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV53?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV53?.v52AuthorizationReusable !== false ||
    status.input?.liveV53?.v52AntecedentBytesUnchanged !== true ||
    status.input?.liveV53?.v52SceneReadbackUnchanged !== true ||
    status.input?.liveV53?.v51SceneReadbackUnchanged !== true ||
    status.input?.liveV53?.taughtVariantEffectsOmitted !== true ||
    status.input?.liveV53?.taughtVariantCornerRadiusOmitted !== true ||
    status.input?.liveV53?.taughtMessageContainerStrokesOmitted !== true ||
    status.input?.liveV53?.taughtMessageContainerEffectsOmitted !== true ||
    status.input?.liveV53?.taughtMessageContainerCornerRadiusOmitted !== true ||
    status.input?.liveV53?.taughtMessageContainerClipsContentOmitted !== true ||
    status.input?.liveV53?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV53?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV53?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV53?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV53?.sceneReadbackCarried !== true ||
    status.input?.liveV53?.carriedV3Verifier !== true ||
    status.input?.liveV53?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV53?.carriedSceneReadback !==
      "recipe/scene-readback-v53.ts" ||
    status.input?.liveV53?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v53.ts" ||
    status.input?.liveV53?.sourceRoots !== 2 ||
    status.input?.liveV53?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV53?.captureCells !== 128 ||
    status.input?.liveV53?.remoteRequests !== 133 ||
    status.input?.liveV53?.hostPhases !== 3 ||
    status.input?.liveV53?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV53?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV53?.attemptsExecuted !== 1 ||
    status.input?.liveV53?.nextAttempt !== 2 ||
    status.input?.liveV53?.liveExecutionOccurred !== true ||
    status.input?.liveV53?.figmaWrites !== 4 ||
    status.input?.liveV53?.figmaCaptures !== 0 ||
    status.input?.liveV53?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV53?.attempt1Path !== V53_ATTEMPT_1_PATH ||
    status.input?.liveV53?.attempt1Sha256 !== V53_ATTEMPT_1_SHA256 ||
    status.input?.liveV53
      ?.restartAsV53Attempt2WithoutVariantStrokesOmitForbidden !==
      true ||
    status.input?.liveV53?.humanSignoff !== "pending" ||
    status.input?.liveV53?.overallInputSuccess !== false ||
    status.input?.liveV54?.status !== V54_STATUS ||
    status.input?.liveV54?.baseCommit !== V54_BASE_COMMIT ||
    status.input?.liveV54?.protocolSha256 !== V54_PROTOCOL_SHA256 ||
    status.input?.liveV54?.proofPlanSha256 !== V54_PLAN_SHA256 ||
    status.input?.liveV54?.captureManifestSha256 !==
      V54_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV54?.requestManifestSha256 !==
      V54_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV54?.antecedentIndexSha256 !== V54_INDEX_SHA256 ||
    status.input?.liveV54?.antecedentHashSetSha256 !== V54_HASH_SET_SHA256 ||
    status.input?.liveV54?.authorizationTemplateSha256 !==
      V54_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV54?.antecedentCommit !== V54_ANTECEDENT_COMMIT ||
    status.input?.liveV54?.authorizationPresent !== true ||
    status.input?.liveV54?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV54?.authorizationEffective !== false ||
    status.input?.liveV54?.authorizationPath !== V54_AUTHORIZATION_PATH ||
    status.input?.liveV54?.authorizationSha256 !== V54_AUTHORIZATION_SHA256 ||
    status.input?.liveV54?.signingPublicKeySpkiSha256 !==
      V54_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV54?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV54?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV54?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV54?.v53AuthorizationReusable !== false ||
    status.input?.liveV54?.v53AntecedentBytesUnchanged !== true ||
    status.input?.liveV54?.v53SceneReadbackUnchanged !== true ||
    status.input?.liveV54?.v52SceneReadbackUnchanged !== true ||
    status.input?.liveV54?.taughtVariantStrokesOmitted !== true ||
    status.input?.liveV54?.taughtVariantEffectsOmitted !== true ||
    status.input?.liveV54?.taughtVariantCornerRadiusOmitted !== true ||
    status.input?.liveV54?.taughtMessageContainerStrokesOmitted !== true ||
    status.input?.liveV54?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV54?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV54?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV54?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV54?.sceneReadbackCarried !== true ||
    status.input?.liveV54?.carriedV3Verifier !== true ||
    status.input?.liveV54?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV54?.carriedSceneReadback !==
      "recipe/scene-readback-v54.ts" ||
    status.input?.liveV54?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v54.ts" ||
    status.input?.liveV54?.sourceRoots !== 2 ||
    status.input?.liveV54?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV54?.captureCells !== 128 ||
    status.input?.liveV54?.remoteRequests !== 133 ||
    status.input?.liveV54?.hostPhases !== 3 ||
    status.input?.liveV54?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV54?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV54?.attemptsExecuted !== 1 ||
    status.input?.liveV54?.nextAttempt !== 2 ||
    status.input?.liveV54?.liveExecutionOccurred !== true ||
    status.input?.liveV54?.figmaWrites !== 4 ||
    status.input?.liveV54?.figmaCaptures !== 0 ||
    status.input?.liveV54?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV54?.attempt1Path !== V54_ATTEMPT_1_PATH ||
    status.input?.liveV54?.attempt1Sha256 !== V54_ATTEMPT_1_SHA256 ||
    status.input?.liveV54
      ?.restartAsV54Attempt2WithoutLeadingSlotBindingCompileOrderForbidden !==
      true ||
    status.input?.liveV54?.humanSignoff !== "pending" ||
    status.input?.liveV54?.overallInputSuccess !== false ||
    status.input?.liveV55?.status !== V55_STATUS ||
    status.input?.liveV55?.baseCommit !== V55_BASE_COMMIT ||
    status.input?.liveV55?.protocolSha256 !== V55_PROTOCOL_SHA256 ||
    status.input?.liveV55?.proofPlanSha256 !== V55_PLAN_SHA256 ||
    status.input?.liveV55?.captureManifestSha256 !==
      V55_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV55?.requestManifestSha256 !==
      V55_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV55?.antecedentIndexSha256 !== V55_INDEX_SHA256 ||
    status.input?.liveV55?.antecedentHashSetSha256 !== V55_HASH_SET_SHA256 ||
    status.input?.liveV55?.authorizationTemplateSha256 !==
      V55_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV55?.antecedentCommit !== V55_ANTECEDENT_COMMIT ||
    status.input?.liveV55?.authorizationPresent !== true ||
    status.input?.liveV55?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV55?.authorizationEffective !== false ||
    status.input?.liveV55?.authorizationPath !== V55_AUTHORIZATION_PATH ||
    status.input?.liveV55?.authorizationSha256 !== V55_AUTHORIZATION_SHA256 ||
    status.input?.liveV55?.signingPublicKeySpkiSha256 !==
      V55_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV55?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV55?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV55?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV55?.v54AuthorizationReusable !== false ||
    status.input?.liveV55?.v54AntecedentBytesUnchanged !== true ||
    status.input?.liveV55?.v54SceneReadbackUnchanged !== true ||
    status.input?.liveV55?.v53SceneReadbackUnchanged !== true ||
    status.input?.liveV55?.taughtLeadingSlotBindingCompileOrder !== true ||
    status.input?.liveV55?.taughtVariantStrokesOmitted !== true ||
    status.input?.liveV55?.taughtVariantEffectsOmitted !== true ||
    status.input?.liveV55?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV55?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV55?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV55?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV55?.sceneReadbackCarried !== true ||
    status.input?.liveV55?.carriedV3Verifier !== true ||
    status.input?.liveV55?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV55?.carriedSceneReadback !==
      "recipe/scene-readback-v55.ts" ||
    status.input?.liveV55?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v55.ts" ||
    status.input?.liveV55?.sourceRoots !== 2 ||
    status.input?.liveV55?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV55?.captureCells !== 128 ||
    status.input?.liveV55?.remoteRequests !== 133 ||
    status.input?.liveV55?.hostPhases !== 3 ||
    status.input?.liveV55?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV55?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV55?.attemptsExecuted !== 1 ||
    status.input?.liveV55?.nextAttempt !== 2 ||
    status.input?.liveV55?.liveExecutionOccurred !== true ||
    status.input?.liveV55?.figmaWrites !== 4 ||
    status.input?.liveV55?.figmaCaptures !== 0 ||
    status.input?.liveV55?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV55?.attempt1Path !== V55_ATTEMPT_1_PATH ||
    status.input?.liveV55?.attempt1Sha256 !== V55_ATTEMPT_1_SHA256 ||
    status.input?.liveV55
      ?.restartAsV55Attempt2WithoutTrailingSlotBindingCompileOrderForbidden !==
      true ||
    status.input?.liveV55?.humanSignoff !== "pending" ||
    status.input?.liveV55?.overallInputSuccess !== false ||
    status.input?.liveV56?.status !== V56_STATUS ||
    status.input?.liveV56?.baseCommit !== V56_BASE_COMMIT ||
    status.input?.liveV56?.protocolSha256 !== V56_PROTOCOL_SHA256 ||
    status.input?.liveV56?.proofPlanSha256 !== V56_PLAN_SHA256 ||
    status.input?.liveV56?.captureManifestSha256 !==
      V56_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV56?.requestManifestSha256 !==
      V56_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV56?.antecedentIndexSha256 !== V56_INDEX_SHA256 ||
    status.input?.liveV56?.antecedentHashSetSha256 !== V56_HASH_SET_SHA256 ||
    status.input?.liveV56?.authorizationTemplateSha256 !==
      V56_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV56?.antecedentCommit !== V56_ANTECEDENT_COMMIT ||
    status.input?.liveV56?.authorizationPresent !== true ||
    status.input?.liveV56?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV56?.authorizationEffective !== false ||
    status.input?.liveV56?.authorizationPath !== V56_AUTHORIZATION_PATH ||
    status.input?.liveV56?.authorizationSha256 !== V56_AUTHORIZATION_SHA256 ||
    status.input?.liveV56?.signingPublicKeySpkiSha256 !==
      V56_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV56?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV56?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV56?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV56?.v55AuthorizationReusable !== false ||
    status.input?.liveV56?.v55AntecedentBytesUnchanged !== true ||
    status.input?.liveV56?.v55SceneReadbackUnchanged !== true ||
    status.input?.liveV56?.v54SceneReadbackUnchanged !== true ||
    status.input?.liveV56?.taughtTrailingSlotBindingCompileOrder !== true ||
    status.input?.liveV56?.taughtLeadingSlotBindingCompileOrder !== true ||
    status.input?.liveV56?.taughtVariantStrokesOmitted !== true ||
    status.input?.liveV56?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV56?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV56?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV56?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV56?.sceneReadbackCarried !== true ||
    status.input?.liveV56?.carriedV3Verifier !== true ||
    status.input?.liveV56?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV56?.carriedSceneReadback !==
      "recipe/scene-readback-v56.ts" ||
    status.input?.liveV56?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v56.ts" ||
    status.input?.liveV56?.sourceRoots !== 2 ||
    status.input?.liveV56?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV56?.captureCells !== 128 ||
    status.input?.liveV56?.remoteRequests !== 133 ||
    status.input?.liveV56?.hostPhases !== 3 ||
    status.input?.liveV56?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV56?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV56?.attemptsExecuted !== 1 ||
    status.input?.liveV56?.nextAttempt !== 2 ||
    status.input?.liveV56?.liveExecutionOccurred !== true ||
    status.input?.liveV56?.figmaWrites !== 4 ||
    status.input?.liveV56?.figmaCaptures !== 0 ||
    status.input?.liveV56?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV56?.attempt1Path !== V56_ATTEMPT_1_PATH ||
    status.input?.liveV56?.attempt1Sha256 !== V56_ATTEMPT_1_SHA256 ||
    status.input?.liveV56
      ?.restartAsV56Attempt2WithoutRequiredIndicatorBindingCompileOrderForbidden !==
      true ||
    status.input?.liveV56?.humanSignoff !== "pending" ||
    status.input?.liveV56?.overallInputSuccess !== false ||
    status.input?.liveV57?.status !== V57_STATUS ||
    status.input?.liveV57?.baseCommit !== V57_BASE_COMMIT ||
    status.input?.liveV57?.protocolSha256 !== V57_PROTOCOL_SHA256 ||
    status.input?.liveV57?.proofPlanSha256 !== V57_PLAN_SHA256 ||
    status.input?.liveV57?.captureManifestSha256 !==
      V57_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV57?.requestManifestSha256 !==
      V57_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV57?.antecedentIndexSha256 !== V57_INDEX_SHA256 ||
    status.input?.liveV57?.antecedentHashSetSha256 !== V57_HASH_SET_SHA256 ||
    status.input?.liveV57?.authorizationTemplateSha256 !==
      V57_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV57?.antecedentCommit !== V57_ANTECEDENT_COMMIT ||
    status.input?.liveV57?.authorizationPresent !== true ||
    status.input?.liveV57?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV57?.authorizationEffective !== false ||
    status.input?.liveV57?.authorizationPath !== V57_AUTHORIZATION_PATH ||
    status.input?.liveV57?.authorizationSha256 !== V57_AUTHORIZATION_SHA256 ||
    status.input?.liveV57?.signingPublicKeySpkiSha256 !==
      V57_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV57?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV57?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV57?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV57?.v56AuthorizationReusable !== false ||
    status.input?.liveV57?.v56AntecedentBytesUnchanged !== true ||
    status.input?.liveV57?.v56SceneReadbackUnchanged !== true ||
    status.input?.liveV57?.v55SceneReadbackUnchanged !== true ||
    status.input?.liveV57?.taughtRequiredIndicatorBindingExtrasDropped !==
      true ||
    status.input?.liveV57?.taughtRequiredIndicatorBindingCompileOrder !==
      true ||
    status.input?.liveV57?.taughtTrailingSlotBindingCompileOrder !== true ||
    status.input?.liveV57?.taughtLeadingSlotBindingCompileOrder !== true ||
    status.input?.liveV57?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV57?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV57?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV57?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV57?.sceneReadbackCarried !== true ||
    status.input?.liveV57?.carriedV3Verifier !== true ||
    status.input?.liveV57?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV57?.carriedSceneReadback !==
      "recipe/scene-readback-v57.ts" ||
    status.input?.liveV57?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v57.ts" ||
    status.input?.liveV57?.sourceRoots !== 2 ||
    status.input?.liveV57?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV57?.captureCells !== 128 ||
    status.input?.liveV57?.remoteRequests !== 133 ||
    status.input?.liveV57?.hostPhases !== 3 ||
    status.input?.liveV57?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV57?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV57?.attemptsExecuted !== 1 ||
    status.input?.liveV57?.nextAttempt !== 2 ||
    status.input?.liveV57?.liveExecutionOccurred !== true ||
    status.input?.liveV57?.figmaWrites !== 4 ||
    status.input?.liveV57?.figmaCaptures !== 0 ||
    status.input?.liveV57?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV57?.attempt1Path !== V57_ATTEMPT_1_PATH ||
    status.input?.liveV57?.attempt1Sha256 !== V57_ATTEMPT_1_SHA256 ||
    status.input?.liveV57
      ?.restartAsV57Attempt2WithoutRequiredIndicatorLetterSpacingOmitForbidden !==
      true ||
    status.input?.liveV57?.humanSignoff !== "pending" ||
    status.input?.liveV57?.overallInputSuccess !== false ||
    status.input?.liveV58?.status !== V58_STATUS ||
    status.input?.liveV58?.baseCommit !== V58_BASE_COMMIT ||
    status.input?.liveV58?.protocolSha256 !== V58_PROTOCOL_SHA256 ||
    status.input?.liveV58?.proofPlanSha256 !== V58_PLAN_SHA256 ||
    status.input?.liveV58?.captureManifestSha256 !==
      V58_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV58?.requestManifestSha256 !==
      V58_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV58?.antecedentIndexSha256 !== V58_INDEX_SHA256 ||
    status.input?.liveV58?.antecedentHashSetSha256 !== V58_HASH_SET_SHA256 ||
    status.input?.liveV58?.authorizationTemplateSha256 !==
      V58_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV58?.antecedentCommit !== V58_ANTECEDENT_COMMIT ||
    status.input?.liveV58?.authorizationPresent !== true ||
    status.input?.liveV58?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV58?.authorizationEffective !== false ||
    status.input?.liveV58?.authorizationPath !== V58_AUTHORIZATION_PATH ||
    status.input?.liveV58?.authorizationSha256 !== V58_AUTHORIZATION_SHA256 ||
    status.input?.liveV58?.signingPublicKeySpkiSha256 !==
      V58_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV58?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV58?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV58?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV58?.v57AuthorizationReusable !== false ||
    status.input?.liveV58?.v57AntecedentBytesUnchanged !== true ||
    status.input?.liveV58?.v57SceneReadbackUnchanged !== true ||
    status.input?.liveV58?.v56SceneReadbackUnchanged !== true ||
    status.input?.liveV58?.taughtRequiredIndicatorLetterSpacingOmitted !==
      true ||
    status.input?.liveV58?.taughtRequiredIndicatorBindingCompileOrder !==
      true ||
    status.input?.liveV58?.taughtRequiredIndicatorBindingExtrasDropped !==
      true ||
    status.input?.liveV58?.taughtTrailingSlotBindingCompileOrder !== true ||
    status.input?.liveV58?.taughtLeadingSlotBindingCompileOrder !== true ||
    status.input?.liveV58?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV58?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV58?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV58?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV58?.sceneReadbackCarried !== true ||
    status.input?.liveV58?.carriedV3Verifier !== true ||
    status.input?.liveV58?.liveHostDoesNotImportSceneReadbackTs !== true ||
    status.input?.liveV58?.carriedSceneReadback !==
      "recipe/scene-readback-v58.ts" ||
    status.input?.liveV58?.carriedV3VerifierPath !==
      "recipe/input-field-live-v3-verifier-v58.ts" ||
    status.input?.liveV58?.sourceRoots !== 2 ||
    status.input?.liveV58?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV58?.captureCells !== 128 ||
    status.input?.liveV58?.remoteRequests !== 133 ||
    status.input?.liveV58?.hostPhases !== 3 ||
    status.input?.liveV58?.transportFacts?.signedWriterTimeoutMs !== 300_000 ||
    status.input?.liveV58?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV58?.attemptsExecuted !== 1 ||
    status.input?.liveV58?.nextAttempt !== 2 ||
    status.input?.liveV58?.liveExecutionOccurred !== true ||
    status.input?.liveV58?.figmaWrites !== 4 ||
    status.input?.liveV58?.figmaCaptures !== 0 ||
    status.input?.liveV58?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV58?.attempt1Path !== V58_ATTEMPT_1_PATH ||
    status.input?.liveV58?.attempt1Sha256 !== V58_ATTEMPT_1_SHA256 ||
    status.input?.liveV58
      ?.restartAsV58Attempt2WithoutRequiredIndicatorTextCaseOmitForbidden !==
      true ||
    status.input?.liveV58?.humanSignoff !== "pending" ||
    status.input?.liveV58?.overallInputSuccess !== false ||
    status.input?.liveV59?.status !== V59_STATUS ||
    status.input?.liveV59?.baseCommit !== V59_BASE_COMMIT ||
    status.input?.liveV59?.protocolSha256 !== V59_PROTOCOL_SHA256 ||
    status.input?.liveV59?.proofPlanSha256 !== V59_PLAN_SHA256 ||
    status.input?.liveV59?.captureManifestSha256 !==
      V59_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV59?.requestManifestSha256 !==
      V59_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV59?.antecedentIndexSha256 !== V59_INDEX_SHA256 ||
    status.input?.liveV59?.antecedentHashSetSha256 !== V59_HASH_SET_SHA256 ||
    status.input?.liveV59?.authorizationTemplateSha256 !==
      V59_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV59?.antecedentCommit !== V59_ANTECEDENT_COMMIT ||
    status.input?.liveV59?.authorizationPresent !== true ||
    status.input?.liveV59?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV59?.authorizationEffective !== false ||
    status.input?.liveV59?.authorizationPath !== V59_AUTHORIZATION_PATH ||
    status.input?.liveV59?.authorizationSha256 !== V59_AUTHORIZATION_SHA256 ||
    status.input?.liveV59?.signingPublicKeySpkiSha256 !==
      V59_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV59?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV59?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV59?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV59?.v58AuthorizationReusable !== false ||
    status.input?.liveV59?.v58AntecedentBytesUnchanged !== true ||
    status.input?.liveV59?.v58SceneReadbackUnchanged !== true ||
    status.input?.liveV59?.taughtRequiredIndicatorTextCaseOmitted !== true ||
    status.input?.liveV59?.taughtRequiredIndicatorLetterSpacingOmitted !==
      true ||
    status.input?.liveV59?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV59?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV59?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV59?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV59?.sceneReadbackCarried !== true ||
    status.input?.liveV59?.carriedSceneReadback !==
      "recipe/scene-readback-v59.ts" ||
    status.input?.liveV59?.sourceRoots !== 2 ||
    status.input?.liveV59?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV59?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV59?.attemptsExecuted !== 1 ||
    status.input?.liveV59?.nextAttempt !== 2 ||
    status.input?.liveV59?.liveExecutionOccurred !== true ||
    status.input?.liveV59?.figmaWrites !== 4 ||
    status.input?.liveV59?.figmaCaptures !== 0 ||
    status.input?.liveV59?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV59?.attempt1Path !== V59_ATTEMPT_1_PATH ||
    status.input?.liveV59?.attempt1Sha256 !== V59_ATTEMPT_1_SHA256 ||
    status.input?.liveV59
      ?.restartAsV59Attempt2WithoutRequiredIndicatorTextDecorationOmitForbidden !==
      true ||
    status.input?.liveV59?.humanSignoff !== "pending" ||
    status.input?.liveV59?.overallInputSuccess !== false ||
    status.input?.liveV60?.status !== V60_STATUS ||
    status.input?.liveV60?.baseCommit !== V60_BASE_COMMIT ||
    status.input?.liveV60?.protocolSha256 !== V60_PROTOCOL_SHA256 ||
    status.input?.liveV60?.proofPlanSha256 !== V60_PLAN_SHA256 ||
    status.input?.liveV60?.captureManifestSha256 !==
      V60_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV60?.requestManifestSha256 !==
      V60_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV60?.antecedentIndexSha256 !== V60_INDEX_SHA256 ||
    status.input?.liveV60?.antecedentHashSetSha256 !== V60_HASH_SET_SHA256 ||
    status.input?.liveV60?.authorizationTemplateSha256 !==
      V60_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV60?.antecedentCommit !== V60_ANTECEDENT_COMMIT ||
    status.input?.liveV60?.authorizationPresent !== true ||
    status.input?.liveV60?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV60?.authorizationEffective !== false ||
    status.input?.liveV60?.authorizationPath !== V60_AUTHORIZATION_PATH ||
    status.input?.liveV60?.authorizationSha256 !== V60_AUTHORIZATION_SHA256 ||
    status.input?.liveV60?.signingPublicKeySpkiSha256 !==
      V60_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV60?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV60?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV60?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV60?.v59AuthorizationReusable !== false ||
    status.input?.liveV60?.v59AntecedentBytesUnchanged !== true ||
    status.input?.liveV60?.v59SceneReadbackUnchanged !== true ||
    status.input?.liveV60?.taughtRequiredIndicatorTextDecorationOmitted !==
      true ||
    status.input?.liveV60?.taughtRequiredIndicatorTextCaseOmitted !== true ||
    status.input?.liveV60?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV60?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV60?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV60?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV60?.sceneReadbackCarried !== true ||
    status.input?.liveV60?.carriedSceneReadback !==
      "recipe/scene-readback-v60.ts" ||
    status.input?.liveV60?.sourceRoots !== 2 ||
    status.input?.liveV60?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV60?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV60?.attemptsExecuted !== 1 ||
    status.input?.liveV60?.nextAttempt !== 2 ||
    status.input?.liveV60?.liveExecutionOccurred !== true ||
    status.input?.liveV60?.figmaWrites !== 4 ||
    status.input?.liveV60?.figmaCaptures !== 0 ||
    status.input?.liveV60?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV60?.attempt1Path !== V60_ATTEMPT_1_PATH ||
    status.input?.liveV60?.attempt1Sha256 !== V60_ATTEMPT_1_SHA256 ||
    status.input?.liveV60
      ?.restartAsV60Attempt2WithoutSetCornerRadiusOmitForbidden !== true ||
    status.input?.liveV60?.humanSignoff !== "pending" ||
    status.input?.liveV60?.overallInputSuccess !== false ||
    status.input?.liveV61?.status !== V61_STATUS ||
    status.input?.liveV61?.baseCommit !== V61_BASE_COMMIT ||
    status.input?.liveV61?.protocolSha256 !== V61_PROTOCOL_SHA256 ||
    status.input?.liveV61?.proofPlanSha256 !== V61_PLAN_SHA256 ||
    status.input?.liveV61?.captureManifestSha256 !==
      V61_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV61?.requestManifestSha256 !==
      V61_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV61?.antecedentIndexSha256 !== V61_INDEX_SHA256 ||
    status.input?.liveV61?.antecedentHashSetSha256 !== V61_HASH_SET_SHA256 ||
    status.input?.liveV61?.authorizationTemplateSha256 !==
      V61_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV61?.antecedentCommit !== V61_ANTECEDENT_COMMIT ||
    status.input?.liveV61?.authorizationPresent !== true ||
    status.input?.liveV61?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV61?.authorizationEffective !== false ||
    status.input?.liveV61?.authorizationPath !== V61_AUTHORIZATION_PATH ||
    status.input?.liveV61?.authorizationSha256 !== V61_AUTHORIZATION_SHA256 ||
    status.input?.liveV61?.signingPublicKeySpkiSha256 !==
      V61_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV61?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV61?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV61?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV61?.v60AuthorizationReusable !== false ||
    status.input?.liveV61?.v60AntecedentBytesUnchanged !== true ||
    status.input?.liveV61?.v60SceneReadbackUnchanged !== true ||
    status.input?.liveV61?.taughtSetCornerRadiusOmitted !== true ||
    status.input?.liveV61?.taughtRequiredIndicatorTextDecorationOmitted !==
      true ||
    status.input?.liveV61?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV61?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV61?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV61?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV61?.sceneReadbackCarried !== true ||
    status.input?.liveV61?.carriedSceneReadback !==
      "recipe/scene-readback-v61.ts" ||
    status.input?.liveV61?.sourceRoots !== 2 ||
    status.input?.liveV61?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV61?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV61?.attemptsExecuted !== 1 ||
    status.input?.liveV61?.nextAttempt !== 2 ||
    status.input?.liveV61?.liveExecutionOccurred !== true ||
    status.input?.liveV61?.figmaWrites !== 4 ||
    status.input?.liveV61?.figmaCaptures !== 0 ||
    status.input?.liveV61?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV61?.attempt1Path !== V61_ATTEMPT_1_PATH ||
    status.input?.liveV61?.attempt1Sha256 !== V61_ATTEMPT_1_SHA256 ||
    status.input?.liveV61
      ?.restartAsV61Attempt2WithoutSetEffectsOmitForbidden !== true ||
    status.input?.liveV61?.humanSignoff !== "pending" ||
    status.input?.liveV61?.overallInputSuccess !== false ||
    status.input?.liveV62?.status !== V62_STATUS ||
    status.input?.liveV62?.baseCommit !== V62_BASE_COMMIT ||
    status.input?.liveV62?.protocolSha256 !== V62_PROTOCOL_SHA256 ||
    status.input?.liveV62?.proofPlanSha256 !== V62_PLAN_SHA256 ||
    status.input?.liveV62?.captureManifestSha256 !==
      V62_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV62?.requestManifestSha256 !==
      V62_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV62?.antecedentIndexSha256 !== V62_INDEX_SHA256 ||
    status.input?.liveV62?.antecedentHashSetSha256 !== V62_HASH_SET_SHA256 ||
    status.input?.liveV62?.authorizationTemplateSha256 !==
      V62_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV62?.antecedentCommit !== V62_ANTECEDENT_COMMIT ||
    status.input?.liveV62?.authorizationPresent !== true ||
    status.input?.liveV62?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV62?.authorizationEffective !== false ||
    status.input?.liveV62?.authorizationPath !== V62_AUTHORIZATION_PATH ||
    status.input?.liveV62?.authorizationSha256 !== V62_AUTHORIZATION_SHA256 ||
    status.input?.liveV62?.signingPublicKeySpkiSha256 !==
      V62_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV62?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV62?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV62?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV62?.v61AuthorizationReusable !== false ||
    status.input?.liveV62?.v61AntecedentBytesUnchanged !== true ||
    status.input?.liveV62?.v61SceneReadbackUnchanged !== true ||
    status.input?.liveV62?.taughtSetEffectsOmitted !== true ||
    status.input?.liveV62?.taughtSetCornerRadiusOmitted !== true ||
    status.input?.liveV62?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV62?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV62?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV62?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV62?.sceneReadbackCarried !== true ||
    status.input?.liveV62?.carriedSceneReadback !==
      "recipe/scene-readback-v62.ts" ||
    status.input?.liveV62?.sourceRoots !== 2 ||
    status.input?.liveV62?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV62?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV62?.attemptsExecuted !== 1 ||
    status.input?.liveV62?.nextAttempt !== 2 ||
    status.input?.liveV62?.liveExecutionOccurred !== true ||
    status.input?.liveV62?.figmaWrites !== 4 ||
    status.input?.liveV62?.figmaCaptures !== 0 ||
    status.input?.liveV62?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV62?.attempt1Path !== V62_ATTEMPT_1_PATH ||
    status.input?.liveV62?.attempt1Sha256 !== V62_ATTEMPT_1_SHA256 ||
    status.input?.liveV62
      ?.restartAsV62Attempt2WithoutSetFillsOmitForbidden !== true ||
    status.input?.liveV62?.humanSignoff !== "pending" ||
    status.input?.liveV62?.overallInputSuccess !== false ||
    status.input?.liveV63?.status !== V63_STATUS ||
    status.input?.liveV63?.baseCommit !== V63_BASE_COMMIT ||
    status.input?.liveV63?.protocolSha256 !== V63_PROTOCOL_SHA256 ||
    status.input?.liveV63?.proofPlanSha256 !== V63_PLAN_SHA256 ||
    status.input?.liveV63?.captureManifestSha256 !==
      V63_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV63?.requestManifestSha256 !==
      V63_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV63?.antecedentIndexSha256 !== V63_INDEX_SHA256 ||
    status.input?.liveV63?.antecedentHashSetSha256 !== V63_HASH_SET_SHA256 ||
    status.input?.liveV63?.authorizationTemplateSha256 !==
      V63_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV63?.antecedentCommit !== V63_ANTECEDENT_COMMIT ||
    status.input?.liveV63?.authorizationPresent !== true ||
    status.input?.liveV63?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV63?.authorizationEffective !== false ||
    status.input?.liveV63?.authorizationPath !== V63_AUTHORIZATION_PATH ||
    status.input?.liveV63?.authorizationSha256 !== V63_AUTHORIZATION_SHA256 ||
    status.input?.liveV63?.signingPublicKeySpkiSha256 !==
      V63_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV63?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV63?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV63?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV63?.v62AuthorizationReusable !== false ||
    status.input?.liveV63?.v62AntecedentBytesUnchanged !== true ||
    status.input?.liveV63?.v62SceneReadbackUnchanged !== true ||
    status.input?.liveV63?.taughtSetFillsOmitted !== true ||
    status.input?.liveV63?.taughtSetEffectsOmitted !== true ||
    status.input?.liveV63?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV63?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV63?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV63?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV63?.sceneReadbackCarried !== true ||
    status.input?.liveV63?.carriedSceneReadback !==
      "recipe/scene-readback-v63.ts" ||
    status.input?.liveV63?.sourceRoots !== 2 ||
    status.input?.liveV63?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV63?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV63?.attemptsExecuted !== 1 ||
    status.input?.liveV63?.nextAttempt !== 2 ||
    status.input?.liveV63?.liveExecutionOccurred !== true ||
    status.input?.liveV63?.figmaWrites !== 4 ||
    status.input?.liveV63?.figmaCaptures !== 0 ||
    status.input?.liveV63?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV63?.attempt1Path !== V63_ATTEMPT_1_PATH ||
    status.input?.liveV63?.attempt1Sha256 !== V63_ATTEMPT_1_SHA256 ||
    status.input?.liveV63
      ?.restartAsV63Attempt2WithoutSetLayoutModeRewriteForbidden !== true ||
    status.input?.liveV63?.humanSignoff !== "pending" ||
    status.input?.liveV63?.overallInputSuccess !== false ||
    status.input?.liveV64?.status !== V64_STATUS ||
    status.input?.liveV64?.baseCommit !== V64_BASE_COMMIT ||
    status.input?.liveV64?.protocolSha256 !== V64_PROTOCOL_SHA256 ||
    status.input?.liveV64?.proofPlanSha256 !== V64_PLAN_SHA256 ||
    status.input?.liveV64?.captureManifestSha256 !==
      V64_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV64?.requestManifestSha256 !==
      V64_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV64?.antecedentIndexSha256 !== V64_INDEX_SHA256 ||
    status.input?.liveV64?.antecedentHashSetSha256 !== V64_HASH_SET_SHA256 ||
    status.input?.liveV64?.authorizationTemplateSha256 !==
      V64_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV64?.antecedentCommit !== V64_ANTECEDENT_COMMIT ||
    status.input?.liveV64?.authorizationPresent !== true ||
    status.input?.liveV64?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV64?.authorizationEffective !== false ||
    status.input?.liveV64?.authorizationPath !== V64_AUTHORIZATION_PATH ||
    status.input?.liveV64?.authorizationSha256 !== V64_AUTHORIZATION_SHA256 ||
    status.input?.liveV64?.signingPublicKeySpkiSha256 !==
      V64_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV64?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV64?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV64?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV64?.v63AuthorizationReusable !== false ||
    status.input?.liveV64?.v63AntecedentBytesUnchanged !== true ||
    status.input?.liveV64?.v63SceneReadbackUnchanged !== true ||
    status.input?.liveV64?.taughtSetLayoutModeHorizontal !== true ||
    status.input?.liveV64?.taughtSetFillsOmitted !== true ||
    status.input?.liveV64?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV64?.v16RestoreBytesUnchanged !== true ||
    status.input?.liveV64?.v16RuntimeBytesUnchanged !== true ||
    status.input?.liveV64?.v16ExtractBytesUnchanged !== true ||
    status.input?.liveV64?.sceneReadbackCarried !== true ||
    status.input?.liveV64?.carriedSceneReadback !==
      "recipe/scene-readback-v64.ts" ||
    status.input?.liveV64?.sourceRoots !== 2 ||
    status.input?.liveV64?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV64?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV64?.attemptsExecuted !== 1 ||
    status.input?.liveV64?.nextAttempt !== 2 ||
    status.input?.liveV64?.liveExecutionOccurred !== true ||
    status.input?.liveV64?.figmaWrites !== 4 ||
    status.input?.liveV64?.figmaCaptures !== 0 ||
    status.input?.liveV64?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV64?.attempt1Path !== V64_ATTEMPT_1_PATH ||
    status.input?.liveV64?.attempt1Sha256 !== V64_ATTEMPT_1_SHA256 ||
    status.input?.liveV64
      ?.restartAsV64Attempt2WithoutSetPaddingRewriteForbidden !== true ||
    status.input?.liveV64?.humanSignoff !== "pending" ||
    status.input?.liveV64?.overallInputSuccess !== false ||
    status.input?.liveV65?.status !== V65_STATUS ||
    status.input?.liveV65?.baseCommit !== V65_BASE_COMMIT ||
    status.input?.liveV65?.protocolSha256 !== V65_PROTOCOL_SHA256 ||
    status.input?.liveV65?.proofPlanSha256 !== V65_PLAN_SHA256 ||
    status.input?.liveV65?.captureManifestSha256 !==
      V65_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV65?.requestManifestSha256 !==
      V65_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV65?.antecedentIndexSha256 !== V65_INDEX_SHA256 ||
    status.input?.liveV65?.antecedentHashSetSha256 !== V65_HASH_SET_SHA256 ||
    status.input?.liveV65?.authorizationTemplateSha256 !==
      V65_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV65?.antecedentCommit !== V65_ANTECEDENT_COMMIT ||
    status.input?.liveV65?.authorizationPresent !== true ||
    status.input?.liveV65?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV65?.authorizationEffective !== false ||
    status.input?.liveV65?.authorizationPath !== V65_AUTHORIZATION_PATH ||
    status.input?.liveV65?.authorizationSha256 !== V65_AUTHORIZATION_SHA256 ||
    status.input?.liveV65?.signingPublicKeySpkiSha256 !==
      V65_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV65?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV65?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV65?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV65?.v64AuthorizationReusable !== false ||
    status.input?.liveV65?.v64AntecedentBytesUnchanged !== true ||
    status.input?.liveV65?.v64SceneReadbackUnchanged !== true ||
    status.input?.liveV65?.taughtSetLayoutPadding32 !== true ||
    status.input?.liveV65?.taughtSetLayoutModeHorizontal !== true ||
    status.input?.liveV65?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV65?.sceneReadbackCarried !== true ||
    status.input?.liveV65?.carriedSceneReadback !==
      "recipe/scene-readback-v65.ts" ||
    status.input?.liveV65?.sourceRoots !== 2 ||
    status.input?.liveV65?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV65?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV65?.attemptsExecuted !== 1 ||
    status.input?.liveV65?.nextAttempt !== 2 ||
    status.input?.liveV65?.liveExecutionOccurred !== true ||
    status.input?.liveV65?.figmaWrites !== 4 ||
    status.input?.liveV65?.figmaCaptures !== 0 ||
    status.input?.liveV65?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV65?.attempt1Path !== V65_ATTEMPT_1_PATH ||
    status.input?.liveV65?.attempt1Sha256 !== V65_ATTEMPT_1_SHA256 ||
    status.input?.liveV65
      ?.restartAsV65Attempt2WithoutWriterSetHugForbidden !== true ||
    status.input?.liveV65?.humanSignoff !== "pending" ||
    status.input?.liveV65?.overallInputSuccess !== false ||
    status.input?.liveV66?.status !== V66_STATUS ||
    status.input?.liveV66?.baseCommit !== V66_BASE_COMMIT ||
    status.input?.liveV66?.protocolSha256 !== V66_PROTOCOL_SHA256 ||
    status.input?.liveV66?.proofPlanSha256 !== V66_PLAN_SHA256 ||
    status.input?.liveV66?.captureManifestSha256 !==
      V66_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV66?.requestManifestSha256 !==
      V66_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV66?.antecedentIndexSha256 !== V66_INDEX_SHA256 ||
    status.input?.liveV66?.antecedentHashSetSha256 !== V66_HASH_SET_SHA256 ||
    status.input?.liveV66?.authorizationTemplateSha256 !==
      V66_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV66?.antecedentCommit !== V66_ANTECEDENT_COMMIT ||
    status.input?.liveV66?.authorizationPresent !== true ||
    status.input?.liveV66?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV66?.authorizationEffective !== false ||
    status.input?.liveV66?.authorizationPath !== V66_AUTHORIZATION_PATH ||
    status.input?.liveV66?.authorizationSha256 !== V66_AUTHORIZATION_SHA256 ||
    status.input?.liveV66?.signingPublicKeySpkiSha256 !==
      V66_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV66?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV66?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV66?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV66?.v65AuthorizationReusable !== false ||
    status.input?.liveV66?.v65AntecedentBytesUnchanged !== true ||
    status.input?.liveV66?.v65SceneReadbackUnchanged !== true ||
    status.input?.liveV66?.taughtSetLayoutSizingHorizontalHug !== true ||
    status.input?.liveV66?.taughtSetLayoutPadding32 !== true ||
    status.input?.liveV66?.taughtSetLayoutModeHorizontal !== true ||
    status.input?.liveV66?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV66?.v17WriterMinted !== true ||
    status.input?.liveV66?.v16WriterProgramUnchanged !== true ||
    status.input?.liveV66?.v16WriterPayloadUnchanged !== true ||
    status.input?.liveV66?.sceneReadbackCarried !== true ||
    status.input?.liveV66?.carriedSceneReadback !==
      "recipe/scene-readback-v66.ts" ||
    status.input?.liveV66?.sourceRoots !== 2 ||
    status.input?.liveV66?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV66?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV66?.attemptsExecuted !== 1 ||
    status.input?.liveV66?.nextAttempt !== 2 ||
    status.input?.liveV66?.liveExecutionOccurred !== true ||
    status.input?.liveV66?.figmaWrites !== 4 ||
    status.input?.liveV66?.figmaCaptures !== 0 ||
    status.input?.liveV66?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV66?.attempt1Path !== V66_ATTEMPT_1_PATH ||
    status.input?.liveV66?.attempt1Sha256 !== V66_ATTEMPT_1_SHA256 ||
    status.input?.liveV66
      ?.restartAsV66Attempt2WithoutSetStrokesOmitForbidden !== true ||
    status.input?.liveV66?.humanSignoff !== "pending" ||
    status.input?.liveV66?.overallInputSuccess !== false ||
    status.input?.liveV67?.status !== V67_STATUS ||
    status.input?.liveV67?.baseCommit !== V67_BASE_COMMIT ||
    status.input?.liveV67?.protocolSha256 !== V67_PROTOCOL_SHA256 ||
    status.input?.liveV67?.proofPlanSha256 !== V67_PLAN_SHA256 ||
    status.input?.liveV67?.captureManifestSha256 !==
      V67_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV67?.requestManifestSha256 !==
      V67_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV67?.antecedentIndexSha256 !== V67_INDEX_SHA256 ||
    status.input?.liveV67?.antecedentHashSetSha256 !== V67_HASH_SET_SHA256 ||
    status.input?.liveV67?.authorizationTemplateSha256 !==
      V67_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV67?.antecedentCommit !== V67_ANTECEDENT_COMMIT ||
    status.input?.liveV67?.authorizationPresent !== true ||
    status.input?.liveV67?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV67?.authorizationEffective !== false ||
    status.input?.liveV67?.authorizationPath !== V67_AUTHORIZATION_PATH ||
    status.input?.liveV67?.authorizationSha256 !== V67_AUTHORIZATION_SHA256 ||
    status.input?.liveV67?.signingPublicKeySpkiSha256 !==
      V67_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV67?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV67?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV67?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV67?.v66AuthorizationReusable !== false ||
    status.input?.liveV67?.v66AntecedentBytesUnchanged !== true ||
    status.input?.liveV67?.v66SceneReadbackUnchanged !== true ||
    status.input?.liveV67?.taughtSetStrokesOmitted !== true ||
    status.input?.liveV67?.taughtSetLayoutSizingHorizontalHug !== true ||
    status.input?.liveV67?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV67?.v17WriterMinted !== true ||
    status.input?.liveV67?.sceneReadbackCarried !== true ||
    status.input?.liveV67?.carriedSceneReadback !==
      "recipe/scene-readback-v67.ts" ||
    status.input?.liveV67?.sourceRoots !== 2 ||
    status.input?.liveV67?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV67?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV67?.attemptsExecuted !== 1 ||
    status.input?.liveV67?.nextAttempt !== 2 ||
    status.input?.liveV67?.liveExecutionOccurred !== true ||
    status.input?.liveV67?.figmaWrites !== 4 ||
    status.input?.liveV67?.figmaCaptures !== 0 ||
    status.input?.liveV67?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV67?.attempt1Path !== V67_ATTEMPT_1_PATH ||
    status.input?.liveV67?.attempt1Sha256 !== V67_ATTEMPT_1_SHA256 ||
    status.input?.liveV67
      ?.restartAsV67Attempt2WithoutLabelRowBindingOrderForbidden !== true ||
    status.input?.liveV67?.humanSignoff !== "pending" ||
    status.input?.liveV67?.overallInputSuccess !== false ||
    status.input?.liveV68?.status !== V68_STATUS ||
    status.input?.liveV68?.baseCommit !== V68_BASE_COMMIT ||
    status.input?.liveV68?.protocolSha256 !== V68_PROTOCOL_SHA256 ||
    status.input?.liveV68?.proofPlanSha256 !== V68_PLAN_SHA256 ||
    status.input?.liveV68?.captureManifestSha256 !==
      V68_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV68?.requestManifestSha256 !==
      V68_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV68?.antecedentIndexSha256 !== V68_INDEX_SHA256 ||
    status.input?.liveV68?.antecedentHashSetSha256 !== V68_HASH_SET_SHA256 ||
    status.input?.liveV68?.authorizationTemplateSha256 !==
      V68_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV68?.antecedentCommit !== V68_ANTECEDENT_COMMIT ||
    status.input?.liveV68?.authorizationPresent !== true ||
    status.input?.liveV68?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV68?.authorizationEffective !== false ||
    status.input?.liveV68?.authorizationPath !== V68_AUTHORIZATION_PATH ||
    status.input?.liveV68?.authorizationSha256 !== V68_AUTHORIZATION_SHA256 ||
    status.input?.liveV68?.signingPublicKeySpkiSha256 !==
      V68_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV68?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV68?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV68?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV68?.v67AuthorizationReusable !== false ||
    status.input?.liveV68?.v67AntecedentBytesUnchanged !== true ||
    status.input?.liveV68?.v67SceneReadbackUnchanged !== true ||
    status.input?.liveV68?.taughtLabelRowBindingCompileOrder !== true ||
    status.input?.liveV68?.taughtSetStrokesOmitted !== true ||
    status.input?.liveV68?.taughtSetLayoutSizingHorizontalHug !== true ||
    status.input?.liveV68?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV68?.v17WriterMinted !== true ||
    status.input?.liveV68?.sceneReadbackCarried !== true ||
    status.input?.liveV68?.carriedSceneReadback !==
      "recipe/scene-readback-v68.ts" ||
    status.input?.liveV68?.sourceRoots !== 2 ||
    status.input?.liveV68?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV68?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV68?.attemptsExecuted !== 1 ||
    status.input?.liveV68?.nextAttempt !== 2 ||
    status.input?.liveV68?.liveExecutionOccurred !== true ||
    status.input?.liveV68?.figmaWrites !== 4 ||
    status.input?.liveV68?.figmaCaptures !== 0 ||
    status.input?.liveV68?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV68?.attempt1Path !== V68_ATTEMPT_1_PATH ||
    status.input?.liveV68?.attempt1Sha256 !== V68_ATTEMPT_1_SHA256 ||
    status.input?.liveV68
      ?.restartAsV68Attempt2WithoutPolarSurfaceBindingOrderForbidden !== true ||
    status.input?.liveV68?.humanSignoff !== "pending" ||
    status.input?.liveV68?.overallInputSuccess !== false ||
    status.input?.liveV69?.status !== V69_STATUS ||
    status.input?.liveV69?.baseCommit !== V69_BASE_COMMIT ||
    status.input?.liveV69?.protocolSha256 !== V69_PROTOCOL_SHA256 ||
    status.input?.liveV69?.proofPlanSha256 !== V69_PLAN_SHA256 ||
    status.input?.liveV69?.captureManifestSha256 !==
      V69_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV69?.requestManifestSha256 !==
      V69_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV69?.antecedentIndexSha256 !== V69_INDEX_SHA256 ||
    status.input?.liveV69?.antecedentHashSetSha256 !== V69_HASH_SET_SHA256 ||
    status.input?.liveV69?.authorizationTemplateSha256 !==
      V69_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV69?.antecedentCommit !== V69_ANTECEDENT_COMMIT ||
    status.input?.liveV69?.authorizationPresent !== true ||
    status.input?.liveV69?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV69?.authorizationEffective !== false ||
    status.input?.liveV69?.authorizationPath !== V69_AUTHORIZATION_PATH ||
    status.input?.liveV69?.authorizationSha256 !== V69_AUTHORIZATION_SHA256 ||
    status.input?.liveV69?.signingPublicKeySpkiSha256 !==
      V69_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV69?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV69?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV69?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV69?.v68AuthorizationReusable !== false ||
    status.input?.liveV69?.v68AntecedentBytesUnchanged !== true ||
    status.input?.liveV69?.v68SceneReadbackUnchanged !== true ||
    status.input?.liveV69?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    status.input?.liveV69?.taughtLabelRowBindingCompileOrder !== true ||
    status.input?.liveV69?.taughtSetStrokesOmitted !== true ||
    status.input?.liveV69?.taughtSetLayoutSizingHorizontalHug !== true ||
    status.input?.liveV69?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV69?.v17WriterMinted !== true ||
    status.input?.liveV69?.sceneReadbackCarried !== true ||
    status.input?.liveV69?.carriedSceneReadback !==
      "recipe/scene-readback-v69.ts" ||
    status.input?.liveV69?.sourceRoots !== 2 ||
    status.input?.liveV69?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV69?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV69?.attemptsExecuted !== 1 ||
    status.input?.liveV69?.nextAttempt !== 2 ||
    status.input?.liveV69?.liveExecutionOccurred !== true ||
    status.input?.liveV69?.figmaWrites !== 4 ||
    status.input?.liveV69?.figmaCaptures !== 0 ||
    status.input?.liveV69?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV69?.attempt1Path !== V69_ATTEMPT_1_PATH ||
    status.input?.liveV69?.attempt1Sha256 !== V69_ATTEMPT_1_SHA256 ||
    status.input?.liveV69
      ?.restartAsV69Attempt2WithoutAccountingFactValueDiagnosisForbidden !==
      true ||
    status.input?.liveV69?.humanSignoff !== "pending" ||
    status.input?.liveV69?.overallInputSuccess !== false ||
    status.input?.liveV70?.status !== V70_STATUS ||
    status.input?.liveV70?.baseCommit !== V70_BASE_COMMIT ||
    status.input?.liveV70?.protocolSha256 !== V70_PROTOCOL_SHA256 ||
    status.input?.liveV70?.proofPlanSha256 !== V70_PLAN_SHA256 ||
    status.input?.liveV70?.captureManifestSha256 !==
      V70_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV70?.requestManifestSha256 !==
      V70_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV70?.antecedentIndexSha256 !== V70_INDEX_SHA256 ||
    status.input?.liveV70?.antecedentHashSetSha256 !== V70_HASH_SET_SHA256 ||
    status.input?.liveV70?.authorizationTemplateSha256 !==
      V70_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV70?.antecedentCommit !== V70_ANTECEDENT_COMMIT ||
    status.input?.liveV70?.authorizationPresent !== true ||
    status.input?.liveV70?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV70?.authorizationEffective !== false ||
    status.input?.liveV70?.authorizationPath !== V70_AUTHORIZATION_PATH ||
    status.input?.liveV70?.authorizationSha256 !== V70_AUTHORIZATION_SHA256 ||
    status.input?.liveV70?.signingPublicKeySpkiSha256 !==
      V70_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV70?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV70?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV70?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV70?.v69AuthorizationReusable !== false ||
    status.input?.liveV70?.v69AntecedentBytesUnchanged !== true ||
    status.input?.liveV70?.v69SceneReadbackUnchanged !== true ||
    status.input?.liveV70?.taughtFontProvenanceNameKeyOrder !== true ||
    status.input?.liveV70?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    status.input?.liveV70?.taughtLabelRowBindingCompileOrder !== true ||
    status.input?.liveV70?.taughtSetStrokesOmitted !== true ||
    status.input?.liveV70?.taughtSetLayoutSizingHorizontalHug !== true ||
    status.input?.liveV70?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV70?.v17WriterMinted !== true ||
    status.input?.liveV70?.sceneReadbackCarried !== true ||
    status.input?.liveV70?.carriedSceneReadback !==
      "recipe/scene-readback-v70.ts" ||
    status.input?.liveV70?.sourceRoots !== 2 ||
    status.input?.liveV70?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV70?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV70?.attemptsExecuted !== 1 ||
    status.input?.liveV70?.nextAttempt !== 2 ||
    status.input?.liveV70?.liveExecutionOccurred !== true ||
    status.input?.liveV70?.figmaWrites !== 4 ||
    status.input?.liveV70?.figmaCaptures !== 0 ||
    status.input?.liveV70?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV70?.attempt1Path !== V70_ATTEMPT_1_PATH ||
    status.input?.liveV70?.attempt1Sha256 !== V70_ATTEMPT_1_SHA256 ||
    status.input?.liveV70
      ?.restartAsV70Attempt2WithoutPolarValueDriftDiagnosisForbidden !==
      true ||
    status.input?.liveV70?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV70?.v71FillDiscriminatorNotKindTypeOnlyOnBothLibraries !==
      true ||
    status.input?.liveV70?.humanSignoff !== "pending" ||
    status.input?.liveV70?.overallInputSuccess !== false ||
    status.input?.liveV71?.status !== V71_STATUS ||
    status.input?.liveV71?.baseCommit !== V71_BASE_COMMIT ||
    status.input?.liveV71?.protocolSha256 !== V71_PROTOCOL_SHA256 ||
    status.input?.liveV71?.proofPlanSha256 !== V71_PLAN_SHA256 ||
    status.input?.liveV71?.captureManifestSha256 !==
      V71_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV71?.requestManifestSha256 !==
      V71_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV71?.antecedentIndexSha256 !== V71_INDEX_SHA256 ||
    status.input?.liveV71?.antecedentHashSetSha256 !== V71_HASH_SET_SHA256 ||
    status.input?.liveV71?.authorizationTemplateSha256 !==
      V71_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV71?.antecedentCommit !== V71_ANTECEDENT_COMMIT ||
    status.input?.liveV71?.authorizationPresent !== true ||
    status.input?.liveV71?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV71?.authorizationEffective !== false ||
    status.input?.liveV71?.authorizationPath !== V71_AUTHORIZATION_PATH ||
    status.input?.liveV71?.authorizationSha256 !== V71_AUTHORIZATION_SHA256 ||
    status.input?.liveV71?.signingPublicKeySpkiSha256 !==
      V71_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV71?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV71?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV71?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV71?.v70AuthorizationReusable !== false ||
    status.input?.liveV71?.v70SceneReadbackUnchanged !== true ||
    status.input?.liveV71?.taughtInstancePayloadFillKind !== true ||
    status.input?.liveV71?.taughtFontProvenanceNameKeyOrder !== true ||
    status.input?.liveV71?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    status.input?.liveV71?.taughtLabelRowBindingCompileOrder !== true ||
    status.input?.liveV71?.taughtSetStrokesOmitted !== true ||
    status.input?.liveV71?.taughtSetLayoutSizingHorizontalHug !== true ||
    status.input?.liveV71?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV71?.v17WriterMinted !== true ||
    status.input?.liveV71?.sceneReadbackCarried !== true ||
    status.input?.liveV71?.carriedSceneReadback !==
      "recipe/scene-readback-v71.ts" ||
    status.input?.liveV71?.sourceRoots !== 2 ||
    status.input?.liveV71?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV71?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV71?.attemptsExecuted !== 1 ||
    status.input?.liveV71?.nextAttempt !== 2 ||
    status.input?.liveV71?.liveExecutionOccurred !== true ||
    status.input?.liveV71?.figmaWrites !== 4 ||
    status.input?.liveV71?.figmaCaptures !== 0 ||
    status.input?.liveV71?.createdNodesThenRemoved !== 2317 ||
    status.input?.liveV71?.attempt1Path !== V71_ATTEMPT_1_PATH ||
    status.input?.liveV71?.attempt1Sha256 !== V71_ATTEMPT_1_SHA256 ||
    status.input?.liveV71
      ?.restartAsV71Attempt2WithoutSizeAxisOrderDiagnosisForbidden !== true ||
    status.input?.liveV71?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV71?.v72SizeAxisOrderOnlyOnBothLibraries !== true ||
    status.input?.liveV71?.humanSignoff !== "pending" ||
    status.input?.liveV71?.overallInputSuccess !== false ||
    status.input?.liveV72?.status !== V72_STATUS ||
    status.input?.liveV72?.baseCommit !== V72_BASE_COMMIT ||
    status.input?.liveV72?.protocolSha256 !== V72_PROTOCOL_SHA256 ||
    status.input?.liveV72?.proofPlanSha256 !== V72_PLAN_SHA256 ||
    status.input?.liveV72?.captureManifestSha256 !==
      V72_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV72?.requestManifestSha256 !==
      V72_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV72?.antecedentIndexSha256 !== V72_INDEX_SHA256 ||
    status.input?.liveV72?.antecedentHashSetSha256 !== V72_HASH_SET_SHA256 ||
    status.input?.liveV72?.authorizationTemplateSha256 !==
      V72_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV72?.antecedentCommit !== V72_ANTECEDENT_COMMIT ||
    status.input?.liveV72?.authorizationPresent !== true ||
    status.input?.liveV72?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV72?.authorizationEffective !== false ||
    status.input?.liveV72?.authorizationPath !== V72_AUTHORIZATION_PATH ||
    status.input?.liveV72?.authorizationSha256 !== V72_AUTHORIZATION_SHA256 ||
    status.input?.liveV72?.signingPublicKeySpkiSha256 !==
      V72_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV72?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV72?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV72?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV72?.v71AuthorizationReusable !== false ||
    status.input?.liveV72?.v71SceneReadbackUnchanged !== true ||
    status.input?.liveV72?.taughtVariantAxisSizeOrder !== true ||
    status.input?.liveV72?.taughtInstancePayloadFillKind !== true ||
    status.input?.liveV72?.taughtFontProvenanceNameKeyOrder !== true ||
    status.input?.liveV72?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV72?.v17WriterMinted !== true ||
    status.input?.liveV72?.sceneReadbackCarried !== true ||
    status.input?.liveV72?.carriedSceneReadback !==
      "recipe/scene-readback-v72.ts" ||
    status.input?.liveV72?.sourceRoots !== 2 ||
    status.input?.liveV72?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV72?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV72?.attemptsExecuted !== 1 ||
    status.input?.liveV72?.nextAttempt !== 2 ||
    status.input?.liveV72?.liveExecutionOccurred !== true ||
    status.input?.liveV72?.figmaWrites !== 4 ||
    status.input?.liveV72?.attempt1Path !== V72_ATTEMPT_1_PATH ||
    status.input?.liveV72?.attempt1Sha256 !== V72_ATTEMPT_1_SHA256 ||
    status.input?.liveV72
      ?.restartAsV72Attempt2WithoutPolarValueDriftDiagnosisForbidden !== true ||
    status.input?.liveV72?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV72?.doNotOpenV73ForPolarWidthOrSpreadValues !== true ||
    status.input?.liveV72?.remainingPolarIntrinsicSizeWidthValueDrift !==
      true ||
    status.input?.liveV72?.remainingPolarEffectSpreadValueDrift !== true ||
    status.input?.liveV72?.polarWidthAndSpreadNamedRequiredFacts !== true ||
    status.input?.liveV72?.v73ClassificationRequiredCompareDropForbidden !==
      true ||
    status.input?.liveV72?.muiSilentZeroBecauseExtractMatchesExpected !==
      true ||
    status.input?.liveV72?.writerV17AskedPolar8And2578125AndSpread1And3 !==
      true ||
    status.input?.liveV72?.extractV72PolarLeading9Trailing30FocusSpread0 !==
      true ||
    status.input?.liveV72?.v73NotOpened !== true ||
    status.input?.liveV72?.humanSignoff !== "pending" ||
    status.input?.liveV72?.overallInputSuccess !== false ||
    status.input?.liveV73?.status !== V73_STATUS ||
    status.input?.liveV73?.baseCommit !== V73_BASE_COMMIT ||
    status.input?.liveV73?.protocolSha256 !== V73_PROTOCOL_SHA256 ||
    status.input?.liveV73?.proofPlanSha256 !== V73_PLAN_SHA256 ||
    status.input?.liveV73?.captureManifestSha256 !==
      V73_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV73?.requestManifestSha256 !==
      V73_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV73?.antecedentIndexSha256 !== V73_INDEX_SHA256 ||
    status.input?.liveV73?.antecedentHashSetSha256 !== V73_HASH_SET_SHA256 ||
    status.input?.liveV73?.authorizationTemplateSha256 !==
      V73_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV73?.antecedentCommit !== V73_ANTECEDENT_COMMIT ||
    status.input?.liveV73?.authorizationPresent !== true ||
    status.input?.liveV73?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV73?.authorizationEffective !== false ||
    status.input?.liveV73?.authorizationPath !== V73_AUTHORIZATION_PATH ||
    status.input?.liveV73?.authorizationSha256 !== V73_AUTHORIZATION_SHA256 ||
    status.input?.liveV73?.signingPublicKeySpkiSha256 !==
      V73_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV73?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV73?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV73?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV73?.v72AuthorizationReusable !== false ||
    status.input?.liveV73?.v72SceneReadbackUnchanged !== true ||
    status.input?.liveV73?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV73?.taughtVariantAxisSizeOrder !== true ||
    status.input?.liveV73?.taughtInstancePayloadFillKind !== true ||
    status.input?.liveV73?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV73?.v17WriterMinted !== true ||
    status.input?.liveV73?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV73?.unnamedSourcePxCarriedNotRequiredEquals !== true ||
    status.input?.liveV73?.sceneReadbackCarried !== true ||
    status.input?.liveV73?.carriedSceneReadback !==
      "recipe/scene-readback-v73.ts" ||
    status.input?.liveV73?.sourceRoots !== 2 ||
    status.input?.liveV73?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV73?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV73?.attemptsExecuted !== 1 ||
    status.input?.liveV73?.nextAttempt !== 2 ||
    status.input?.liveV73?.liveExecutionOccurred !== true ||
    status.input?.liveV73?.figmaWrites !== 5 ||
    status.input?.liveV73?.attempt1Path !== V73_ATTEMPT_1_PATH ||
    status.input?.liveV73?.attempt1Sha256 !== V73_ATTEMPT_1_SHA256 ||
    status.input?.liveV73
      ?.restartAsV73Attempt2WithoutProbeDiagnosisForbidden !== true ||
    status.input?.liveV73?.unnamedSourcePxCarriedTeachingHeld !== true ||
    status.input?.liveV73?.accountingSilentZeroBoth !== true ||
    status.input?.liveV73?.mintCleaned !== true ||
    status.input?.liveV73?.mintStayed !== false ||
    status.input?.liveV73?.doNotClaimV1Complete !== true ||
    status.input?.liveV73?.humanSignoff !== "pending" ||
    status.input?.liveV73?.overallInputSuccess !== false ||
    status.input?.liveV74?.status !== V74_STATUS ||
    status.input?.liveV74?.baseCommit !== V74_BASE_COMMIT ||
    status.input?.liveV74?.protocolSha256 !== V74_PROTOCOL_SHA256 ||
    status.input?.liveV74?.proofPlanSha256 !== V74_PLAN_SHA256 ||
    status.input?.liveV74?.captureManifestSha256 !==
      V74_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV74?.requestManifestSha256 !==
      V74_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV74?.antecedentIndexSha256 !== V74_INDEX_SHA256 ||
    status.input?.liveV74?.antecedentHashSetSha256 !== V74_HASH_SET_SHA256 ||
    status.input?.liveV74?.authorizationTemplateSha256 !==
      V74_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV74?.antecedentCommit !== V74_ANTECEDENT_COMMIT ||
    status.input?.liveV74?.authorizationPresent !== true ||
    status.input?.liveV74?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV74?.authorizationEffective !== false ||
    status.input?.liveV74?.authorizationPath !== V74_AUTHORIZATION_PATH ||
    status.input?.liveV74?.authorizationSha256 !== V74_AUTHORIZATION_SHA256 ||
    status.input?.liveV74?.signingPublicKeySpkiSha256 !==
      V74_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV74?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV74?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV74?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV74?.v73AuthorizationReusable !== false ||
    status.input?.liveV74?.v73SceneReadbackUnchanged !== true ||
    status.input?.liveV74?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV74?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV74?.taughtVariantAxisSizeOrder !== true ||
    status.input?.liveV74?.taughtInstancePayloadFillKind !== true ||
    status.input?.liveV74?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV74?.v17WriterMinted !== true ||
    status.input?.liveV74?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV74?.unnamedSourcePxCarriedNotRequiredEquals !== true ||
    status.input?.liveV74?.sceneReadbackCarried !== true ||
    status.input?.liveV74?.carriedSceneReadback !==
      "recipe/scene-readback-v74.ts" ||
    status.input?.liveV74?.sourceRoots !== 2 ||
    status.input?.liveV74?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV74?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV74?.attemptsExecuted !== 1 ||
    status.input?.liveV74?.nextAttempt !== 2 ||
    status.input?.liveV74?.liveExecutionOccurred !== true ||
    status.input?.liveV74?.figmaWrites !== 5 ||
    status.input?.liveV74?.attempt1Path !== V74_ATTEMPT_1_PATH ||
    status.input?.liveV74?.attempt1Sha256 !== V74_ATTEMPT_1_SHA256 ||
    status.input?.liveV74?.restartAsV74Attempt2WithoutRemainingProbeDiagnosisForbidden !==
      true ||
    status.input?.liveV74?.taughtProbeFirstSegmentRoleHeld !== true ||
    status.input?.liveV74?.accountingSilentZeroBoth !== true ||
    status.input?.liveV74?.mintCleaned !== true ||
    status.input?.liveV74?.mintStayed !== false ||
    status.input?.liveV74?.doNotClaimV1Complete !== true ||
    status.input?.liveV74?.humanSignoff !== "pending" ||
    status.input?.liveV74?.overallInputSuccess !== false ||
    status.input?.liveV75?.status !== V75_STATUS ||
    status.input?.liveV75?.baseCommit !== V75_BASE_COMMIT ||
    status.input?.liveV75?.protocolSha256 !== V75_PROTOCOL_SHA256 ||
    status.input?.liveV75?.proofPlanSha256 !== V75_PLAN_SHA256 ||
    status.input?.liveV75?.captureManifestSha256 !==
      V75_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV75?.requestManifestSha256 !==
      V75_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV75?.antecedentIndexSha256 !== V75_INDEX_SHA256 ||
    status.input?.liveV75?.antecedentHashSetSha256 !== V75_HASH_SET_SHA256 ||
    status.input?.liveV75?.authorizationTemplateSha256 !==
      V75_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV75?.antecedentCommit !== V75_ANTECEDENT_COMMIT ||
    status.input?.liveV75?.authorizationPresent !== true ||
    status.input?.liveV75?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV75?.authorizationEffective !== false ||
    status.input?.liveV75?.authorizationPath !== V75_AUTHORIZATION_PATH ||
    status.input?.liveV75?.authorizationSha256 !== V75_AUTHORIZATION_SHA256 ||
    status.input?.liveV75?.signingPublicKeySpkiSha256 !==
      V75_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV75?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV75?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV75?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV75?.v74AuthorizationReusable !== false ||
    status.input?.liveV75?.v74SceneReadbackUnchanged !== true ||
    status.input?.liveV75?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV75?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV75?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV75?.taughtVariantAxisSizeOrder !== true ||
    status.input?.liveV75?.taughtInstancePayloadFillKind !== true ||
    status.input?.liveV75?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV75?.v17WriterMinted !== true ||
    status.input?.liveV75?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV75?.unnamedSourcePxCarriedNotRequiredEquals !== true ||
    status.input?.liveV75?.sceneReadbackCarried !== true ||
    status.input?.liveV75?.carriedSceneReadback !==
      "recipe/scene-readback-v75.ts" ||
    status.input?.liveV75?.sourceRoots !== 2 ||
    status.input?.liveV75?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV75?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV75?.attemptsExecuted !== 1 ||
    status.input?.liveV75?.nextAttempt !== 2 ||
    status.input?.liveV75?.liveExecutionOccurred !== true ||
    status.input?.liveV75?.figmaWrites !== 5 ||
    status.input?.liveV75?.attempt1Path !== V75_ATTEMPT_1_PATH ||
    status.input?.liveV75?.attempt1Sha256 !== V75_ATTEMPT_1_SHA256 ||
    status.input?.liveV75?.taughtProbePolarReflowAgainstContentTextHeld !==
      true ||
    status.input?.liveV75?.muiContentFillNewlyFalseAfterSplit !== true ||
    status.input?.liveV75?.accountingSilentZeroBoth !== true ||
    status.input?.liveV75?.mintCleaned !== true ||
    status.input?.liveV75?.mintStayed !== false ||
    status.input?.liveV75?.doNotClaimV1Complete !== true ||
    status.input?.liveV75?.humanSignoff !== "pending" ||
    status.input?.liveV75?.overallInputSuccess !== false ||
    status.input?.liveV76?.status !== V76_STATUS ||
    status.input?.liveV76?.baseCommit !== V76_BASE_COMMIT ||
    status.input?.liveV76?.protocolSha256 !== V76_PROTOCOL_SHA256 ||
    status.input?.liveV76?.proofPlanSha256 !== V76_PLAN_SHA256 ||
    status.input?.liveV76?.captureManifestSha256 !==
      V76_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV76?.requestManifestSha256 !==
      V76_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV76?.antecedentIndexSha256 !== V76_INDEX_SHA256 ||
    status.input?.liveV76?.antecedentHashSetSha256 !== V76_HASH_SET_SHA256 ||
    status.input?.liveV76?.authorizationTemplateSha256 !==
      V76_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV76?.antecedentCommit !== V76_ANTECEDENT_COMMIT ||
    status.input?.liveV76?.authorizationPresent !== true ||
    status.input?.liveV76?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV76?.authorizationEffective !== false ||
    status.input?.liveV76?.authorizationPath !== V76_AUTHORIZATION_PATH ||
    status.input?.liveV76?.authorizationSha256 !== V76_AUTHORIZATION_SHA256 ||
    status.input?.liveV76?.signingPublicKeySpkiSha256 !==
      V76_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV76?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV76?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV76?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV76?.v75AuthorizationReusable !== false ||
    status.input?.liveV76?.v75SceneReadbackUnchanged !== true ||
    status.input?.liveV76?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV76?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV76?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV76?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV76?.taughtVariantAxisSizeOrder !== true ||
    status.input?.liveV76?.taughtInstancePayloadFillKind !== true ||
    status.input?.liveV76?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV76?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV76?.v18WriterMinted !== true ||
    status.input?.liveV76?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV76?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV76?.unnamedSourcePxCarriedNotRequiredEquals !== true ||
    status.input?.liveV76?.sceneReadbackCarried !== true ||
    status.input?.liveV76?.carriedSceneReadback !==
      "recipe/scene-readback-v76.ts" ||
    status.input?.liveV76?.sourceRoots !== 2 ||
    status.input?.liveV76?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV76?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV76?.attemptsExecuted !== 1 ||
    status.input?.liveV76?.nextAttempt !== 2 ||
    status.input?.liveV76?.liveExecutionOccurred !== true ||
    status.input?.liveV76?.figmaWrites !== 5 ||
    status.input?.liveV76?.attempt1Path !== V76_ATTEMPT_1_PATH ||
    status.input?.liveV76?.attempt1Sha256 !== V76_ATTEMPT_1_SHA256 ||
    status.input?.liveV76?.taughtWriterFirstSegmentBindHeld !== true ||
    status.input?.liveV76?.muiContentFillStillFalseAfterHiddenDefaultSample !==
      true ||
    status.input?.liveV76?.accountingSilentZeroBoth !== true ||
    status.input?.liveV76?.mintCleaned !== true ||
    status.input?.liveV76?.mintStayed !== false ||
    status.input?.liveV76?.doNotClaimV1Complete !== true ||
    status.input?.liveV76?.humanSignoff !== "pending" ||
    status.input?.liveV76?.overallInputSuccess !== false ||
    status.input?.liveV77?.status !== V77_STATUS ||
    status.input?.liveV77?.baseCommit !== V77_BASE_COMMIT ||
    status.input?.liveV77?.protocolSha256 !== V77_PROTOCOL_SHA256 ||
    status.input?.liveV77?.proofPlanSha256 !== V77_PLAN_SHA256 ||
    status.input?.liveV77?.captureManifestSha256 !==
      V77_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV77?.requestManifestSha256 !==
      V77_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV77?.antecedentIndexSha256 !== V77_INDEX_SHA256 ||
    status.input?.liveV77?.antecedentHashSetSha256 !== V77_HASH_SET_SHA256 ||
    status.input?.liveV77?.authorizationTemplateSha256 !==
      V77_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV77?.antecedentCommit !== V77_ANTECEDENT_COMMIT ||
    status.input?.liveV77?.authorizationPresent !== true ||
    status.input?.liveV77?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV77?.authorizationEffective !== false ||
    status.input?.liveV77?.authorizationPath !== V77_AUTHORIZATION_PATH ||
    status.input?.liveV77?.authorizationSha256 !== V77_AUTHORIZATION_SHA256 ||
    status.input?.liveV77?.signingPublicKeySpkiSha256 !==
      V77_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV77?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV77?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV77?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV77?.v76AuthorizationReusable !== false ||
    status.input?.liveV77?.v76SceneReadbackUnchanged !== true ||
    status.input?.liveV77?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV77?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV77?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV77?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV77?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV77?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV77?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV77?.v18WriterMinted !== true ||
    status.input?.liveV77?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV77?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV77?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV77?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV77?.sceneReadbackCarried !== true ||
    status.input?.liveV77?.carriedSceneReadback !==
      "recipe/scene-readback-v77.ts" ||
    status.input?.liveV77?.sourceRoots !== 2 ||
    status.input?.liveV77?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV77?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV77?.attemptsExecuted !== 1 ||
    status.input?.liveV77?.nextAttempt !== 2 ||
    status.input?.liveV77?.liveExecutionOccurred !== true ||
    status.input?.liveV77?.figmaWrites !== 5 ||
    status.input?.liveV77?.attempt1Path !== V77_ATTEMPT_1_PATH ||
    status.input?.liveV77?.attempt1Sha256 !== V77_ATTEMPT_1_SHA256 ||
    status.input?.liveV77?.taughtProbeRevealThenMeasureHiddenContentFillHeld !==
      true ||
    status.input?.liveV77?.contentFillPassedBoth !== true ||
    status.input?.liveV77?.muiClip104AndOverlap12Remain !== true ||
    status.input?.liveV77?.taughtWriterFirstSegmentBindHeld !== true ||
    status.input?.liveV77?.accountingSilentZeroBoth !== true ||
    status.input?.liveV77?.mintCleaned !== true ||
    status.input?.liveV77?.mintStayed !== false ||
    status.input?.liveV77?.doNotClaimV1Complete !== true ||
    status.input?.liveV77?.humanSignoff !== "pending" ||
    status.input?.liveV77?.overallInputSuccess !== false ||
    status.input?.liveV78?.status !== V78_STATUS ||
    status.input?.liveV78?.baseCommit !== V78_BASE_COMMIT ||
    status.input?.liveV78?.protocolSha256 !== V78_PROTOCOL_SHA256 ||
    status.input?.liveV78?.proofPlanSha256 !== V78_PLAN_SHA256 ||
    status.input?.liveV78?.captureManifestSha256 !==
      V78_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV78?.requestManifestSha256 !==
      V78_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV78?.antecedentIndexSha256 !== V78_INDEX_SHA256 ||
    status.input?.liveV78?.antecedentHashSetSha256 !== V78_HASH_SET_SHA256 ||
    status.input?.liveV78?.authorizationTemplateSha256 !==
      V78_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV78?.antecedentCommit !== V78_ANTECEDENT_COMMIT ||
    status.input?.liveV78?.authorizationPresent !== true ||
    status.input?.liveV78?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV78?.authorizationEffective !== false ||
    status.input?.liveV78?.authorizationPath !== V78_AUTHORIZATION_PATH ||
    status.input?.liveV78?.authorizationSha256 !== V78_AUTHORIZATION_SHA256 ||
    status.input?.liveV78?.signingPublicKeySpkiSha256 !==
      V78_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV78?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV78?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV78?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV78?.v77AuthorizationReusable !== false ||
    status.input?.liveV78?.v77SceneReadbackUnchanged !== true ||
    status.input?.liveV78?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV78?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV78?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV78?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV78?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV78?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV78?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV78?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV78?.v18WriterMinted !== true ||
    status.input?.liveV78?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV78?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV78?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV78?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV78?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV78?.sceneReadbackCarried !== true ||
    status.input?.liveV78?.carriedSceneReadback !==
      "recipe/scene-readback-v78.ts" ||
    status.input?.liveV78?.sourceRoots !== 2 ||
    status.input?.liveV78?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV78?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV78?.attemptsExecuted !== 1 ||
    status.input?.liveV78?.nextAttempt !== 2 ||
    status.input?.liveV78?.liveExecutionOccurred !== true ||
    status.input?.liveV78?.figmaWrites !== 5 ||
    status.input?.liveV78?.attempt1Path !== V78_ATTEMPT_1_PATH ||
    status.input?.liveV78?.attempt1Sha256 !== V78_ATTEMPT_1_SHA256 ||
    status.input?.liveV78?.taughtProbeExcludeOverlayLabelAabbHeld !== true ||
    status.input?.liveV78?.contentFillPassedBoth !== true ||
    status.input?.liveV78?.muiClipClearedOverlap12Remain !== true ||
    status.input?.liveV78?.taughtWriterFirstSegmentBindHeld !== true ||
    status.input?.liveV78?.accountingSilentZeroBoth !== true ||
    status.input?.liveV78?.mintCleaned !== true ||
    status.input?.liveV78?.mintStayed !== false ||
    status.input?.liveV78?.doNotClaimV1Complete !== true ||
    status.input?.liveV78?.humanSignoff !== "pending" ||
    status.input?.liveV78?.overallInputSuccess !== false ||
    status.input?.liveV79?.status !== V79_STATUS ||
    status.input?.liveV79?.baseCommit !== V79_BASE_COMMIT ||
    status.input?.liveV79?.protocolSha256 !== V79_PROTOCOL_SHA256 ||
    status.input?.liveV79?.proofPlanSha256 !== V79_PLAN_SHA256 ||
    status.input?.liveV79?.captureManifestSha256 !==
      V79_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV79?.requestManifestSha256 !==
      V79_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV79?.antecedentIndexSha256 !== V79_INDEX_SHA256 ||
    status.input?.liveV79?.antecedentHashSetSha256 !== V79_HASH_SET_SHA256 ||
    status.input?.liveV79?.authorizationTemplateSha256 !==
      V79_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV79?.antecedentCommit !== V79_ANTECEDENT_COMMIT ||
    status.input?.liveV79?.authorizationPresent !== true ||
    status.input?.liveV79?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV79?.authorizationEffective !== false ||
    status.input?.liveV79?.authorizationPath !== V79_AUTHORIZATION_PATH ||
    status.input?.liveV79?.authorizationSha256 !== V79_AUTHORIZATION_SHA256 ||
    status.input?.liveV79?.signingPublicKeySpkiSha256 !==
      V79_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV79?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV79?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV79?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV79?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV79?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV79?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV79?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV79?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV79?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV79?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV79?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV79?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV79?.v18WriterMinted !== true ||
    status.input?.liveV79?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV79?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV79?.v19WriterMinted !== true ||
    status.input?.liveV79?.v78SceneReadbackUnchanged !== true ||
    status.input?.liveV79?.v78AuthorizationReusable !== false ||
    status.input?.liveV79?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV79?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV79?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV79?.sceneReadbackCarried !== true ||
    status.input?.liveV79?.carriedSceneReadback !==
      "recipe/scene-readback-v79.ts" ||
    status.input?.liveV79?.sourceRoots !== 2 ||
    status.input?.liveV79?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV79?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV79?.attemptsExecuted !== 1 ||
    status.input?.liveV79?.nextAttempt !== 2 ||
    status.input?.liveV79?.liveExecutionOccurred !== true ||
    status.input?.liveV79?.figmaWrites !== 4 ||
    status.input?.liveV79?.attempt1Path !== V79_ATTEMPT_1_PATH ||
    status.input?.liveV79?.attempt1Sha256 !== V79_ATTEMPT_1_SHA256 ||
    status.input?.liveV79?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV79?.recipeCollapseRefusedOpacity !== true ||
    status.input?.liveV79?.probeIssued !== false ||
    status.input?.liveV79?.mintCleaned !== true ||
    status.input?.liveV79?.mintStayed !== false ||
    status.input?.liveV79?.doNotClaimV1Complete !== true ||
    status.input?.liveV79?.humanSignoff !== "pending" ||
    status.input?.liveV79?.overallInputSuccess !== false ||
    status.input?.liveV80?.status !== V80_STATUS ||
    status.input?.liveV80?.baseCommit !== V80_BASE_COMMIT ||
    status.input?.liveV80?.protocolSha256 !== V80_PROTOCOL_SHA256 ||
    status.input?.liveV80?.proofPlanSha256 !== V80_PLAN_SHA256 ||
    status.input?.liveV80?.captureManifestSha256 !==
      V80_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV80?.requestManifestSha256 !==
      V80_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV80?.antecedentIndexSha256 !== V80_INDEX_SHA256 ||
    status.input?.liveV80?.antecedentHashSetSha256 !== V80_HASH_SET_SHA256 ||
    status.input?.liveV80?.authorizationTemplateSha256 !==
      V80_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV80?.antecedentCommit !== V80_ANTECEDENT_COMMIT ||
    status.input?.liveV80?.authorizationPresent !== true ||
    status.input?.liveV80?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV80?.authorizationEffective !== false ||
    status.input?.liveV80?.authorizationPath !== V80_AUTHORIZATION_PATH ||
    status.input?.liveV80?.authorizationSha256 !== V80_AUTHORIZATION_SHA256 ||
    status.input?.liveV80?.signingPublicKeySpkiSha256 !==
      V80_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV80?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV80?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV80?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV80?.taughtContentOpacityOmitted !== true ||
    status.input?.liveV80?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV80?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV80?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV80?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV80?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV80?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV80?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV80?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV80?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV80?.v18WriterMinted !== true ||
    status.input?.liveV80?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV80?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV80?.v19WriterMinted !== true ||
    status.input?.liveV80?.v78SceneReadbackUnchanged !== true ||
    status.input?.liveV80?.v79SceneReadbackUnchanged !== true ||
    status.input?.liveV80?.v79AuthorizationReusable !== false ||
    status.input?.liveV80?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV80?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV80?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV80?.sceneReadbackCarried !== true ||
    status.input?.liveV80?.carriedSceneReadback !==
      "recipe/scene-readback-v80.ts" ||
    status.input?.liveV80?.sourceRoots !== 2 ||
    status.input?.liveV80?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV80?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV80?.attemptsExecuted !== 1 ||
    status.input?.liveV80?.nextAttempt !== 2 ||
    status.input?.liveV80?.liveExecutionOccurred !== true ||
    status.input?.liveV80?.figmaWrites !== 4 ||
    status.input?.liveV80?.attempt1Path !== V80_ATTEMPT_1_PATH ||
    status.input?.liveV80?.attempt1Sha256 !== V80_ATTEMPT_1_SHA256 ||
    status.input?.liveV80?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV80?.taughtContentOpacityOmittedHeld !== true ||
    status.input?.liveV80?.recipeCollapseRefusedVisible !== true ||
    status.input?.liveV80?.probeIssued !== false ||
    status.input?.liveV80?.mintCleaned !== true ||
    status.input?.liveV80?.mintStayed !== false ||
    status.input?.liveV80?.doNotClaimV1Complete !== true ||
    status.input?.liveV80?.humanSignoff !== "pending" ||
    status.input?.liveV80?.overallInputSuccess !== false ||
    status.input?.liveV81?.status !== V81_STATUS ||
    status.input?.liveV81?.baseCommit !== V81_BASE_COMMIT ||
    status.input?.liveV81?.protocolSha256 !== V81_PROTOCOL_SHA256 ||
    status.input?.liveV81?.proofPlanSha256 !== V81_PLAN_SHA256 ||
    status.input?.liveV81?.captureManifestSha256 !==
      V81_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV81?.requestManifestSha256 !==
      V81_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV81?.antecedentIndexSha256 !== V81_INDEX_SHA256 ||
    status.input?.liveV81?.antecedentHashSetSha256 !== V81_HASH_SET_SHA256 ||
    status.input?.liveV81?.authorizationTemplateSha256 !==
      V81_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV81?.antecedentCommit !== V81_ANTECEDENT_COMMIT ||
    status.input?.liveV81?.authorizationPresent !== true ||
    status.input?.liveV81?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV81?.authorizationEffective !== false ||
    status.input?.liveV81?.authorizationPath !== V81_AUTHORIZATION_PATH ||
    status.input?.liveV81?.authorizationSha256 !== V81_AUTHORIZATION_SHA256 ||
    status.input?.liveV81?.signingPublicKeySpkiSha256 !==
      V81_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV81?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV81?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV81?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV81?.taughtCompileCarryLiveVisible !== true ||
    status.input?.liveV81?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV81?.taughtContentOpacityOmitted !== true ||
    status.input?.liveV81?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV81?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV81?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV81?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV81?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV81?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV81?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV81?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV81?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV81?.v18WriterMinted !== true ||
    status.input?.liveV81?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV81?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV81?.v19WriterMinted !== true ||
    status.input?.liveV81?.v80SceneReadbackUnchanged !== true ||
    status.input?.liveV81?.v79SceneReadbackUnchanged !== true ||
    status.input?.liveV81?.v80AuthorizationReusable !== false ||
    status.input?.liveV81?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV81?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV81?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV81?.sceneReadbackCarried !== true ||
    status.input?.liveV81?.carriedSceneReadback !==
      "recipe/scene-readback-v81.ts" ||
    status.input?.liveV81?.sourceRoots !== 2 ||
    status.input?.liveV81?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV81?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV81?.attemptsExecuted !== 1 ||
    status.input?.liveV81?.nextAttempt !== 2 ||
    status.input?.liveV81?.liveExecutionOccurred !== true ||
    status.input?.liveV81?.figmaWrites !== 4 ||
    status.input?.liveV81?.attempt1Path !== V81_ATTEMPT_1_PATH ||
    status.input?.liveV81?.attempt1Sha256 !== V81_ATTEMPT_1_SHA256 ||
    status.input?.liveV81?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV81?.taughtContentOpacityOmittedHeld !== true ||
    status.input?.liveV81?.taughtCompileCarryLiveVisibleHeld !== true ||
    status.input?.liveV81?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV81?.accountingRefusedOpacity !== true ||
    status.input?.liveV81?.probeIssued !== false ||
    status.input?.liveV81?.mintCleaned !== true ||
    status.input?.liveV81?.mintStayed !== false ||
    status.input?.liveV81?.doNotClaimV1Complete !== true ||
    status.input?.liveV81?.humanSignoff !== "pending" ||
    status.input?.liveV81?.overallInputSuccess !== false ||
    status.input?.liveV82?.status !== V82_STATUS ||
    status.input?.liveV82?.baseCommit !== V82_BASE_COMMIT ||
    status.input?.liveV82?.protocolSha256 !== V82_PROTOCOL_SHA256 ||
    status.input?.liveV82?.proofPlanSha256 !== V82_PLAN_SHA256 ||
    status.input?.liveV82?.captureManifestSha256 !==
      V82_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV82?.requestManifestSha256 !==
      V82_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV82?.antecedentIndexSha256 !== V82_INDEX_SHA256 ||
    status.input?.liveV82?.antecedentHashSetSha256 !== V82_HASH_SET_SHA256 ||
    status.input?.liveV82?.authorizationTemplateSha256 !==
      V82_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV82?.antecedentCommit !== V82_ANTECEDENT_COMMIT ||
    status.input?.liveV82?.authorizationPresent !== true ||
    status.input?.liveV82?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV82?.authorizationEffective !== false ||
    status.input?.liveV82?.authorizationPath !== V82_AUTHORIZATION_PATH ||
    status.input?.liveV82?.authorizationSha256 !== V82_AUTHORIZATION_SHA256 ||
    status.input?.liveV82?.signingPublicKeySpkiSha256 !==
      V82_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV82?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV82?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV82?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV82?.taughtCompileCarryLiveOpacity !== true ||
    status.input?.liveV82?.inventOpacityVariableForbidden !== true ||
    status.input?.liveV82?.inventCompileTextOpacityForbidden !== true ||
    status.input?.liveV82?.taughtCompileCarryLiveVisible !== true ||
    status.input?.liveV82?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV82?.taughtContentOpacityOmitted !== true ||
    status.input?.liveV82?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV82?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV82?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV82?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV82?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV82?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV82?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV82?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV82?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV82?.v18WriterMinted !== true ||
    status.input?.liveV82?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV82?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV82?.v19WriterMinted !== true ||
    status.input?.liveV82?.v81SceneReadbackUnchanged !== true ||
    status.input?.liveV82?.v80SceneReadbackUnchanged !== true ||
    status.input?.liveV82?.v79SceneReadbackUnchanged !== true ||
    status.input?.liveV82?.v81AuthorizationReusable !== false ||
    status.input?.liveV82?.v80AuthorizationReusable !== false ||
    status.input?.liveV82?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV82?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV82?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV82?.sceneReadbackCarried !== true ||
    status.input?.liveV82?.carriedSceneReadback !==
      "recipe/scene-readback-v82.ts" ||
    status.input?.liveV82?.sourceRoots !== 2 ||
    status.input?.liveV82?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV82?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV82?.attemptsExecuted !== 1 ||
    status.input?.liveV82?.nextAttempt !== 2 ||
    status.input?.liveV82?.liveExecutionOccurred !== true ||
    status.input?.liveV82?.figmaWrites !== 4 ||
    status.input?.liveV82?.attempt1Path !== V82_ATTEMPT_1_PATH ||
    status.input?.liveV82?.attempt1Sha256 !== V82_ATTEMPT_1_SHA256 ||
    status.input?.liveV82?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV82?.taughtContentOpacityOmittedHeld !== true ||
    status.input?.liveV82?.taughtCompileCarryLiveVisibleHeld !== true ||
    status.input?.liveV82?.taughtCompileCarryLiveOpacityHeld !== true ||
    status.input?.liveV82?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV82?.independentRootAccountingPassed !== true ||
    status.input?.liveV82?.recipeCollapseRefusedFixedPoint !== true ||
    status.input?.liveV82?.probeIssued !== false ||
    status.input?.liveV82?.mintCleaned !== true ||
    status.input?.liveV82?.mintStayed !== false ||
    status.input?.liveV82?.doNotClaimV1Complete !== true ||
    status.input?.liveV82?.humanSignoff !== "pending" ||
    status.input?.liveV82?.overallInputSuccess !== false ||
    status.input?.liveV83?.status !== V83_STATUS ||
    status.input?.liveV83?.baseCommit !== V83_BASE_COMMIT ||
    status.input?.liveV83?.protocolSha256 !== V83_PROTOCOL_SHA256 ||
    status.input?.liveV83?.proofPlanSha256 !== V83_PLAN_SHA256 ||
    status.input?.liveV83?.captureManifestSha256 !==
      V83_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV83?.requestManifestSha256 !==
      V83_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV83?.antecedentIndexSha256 !== V83_INDEX_SHA256 ||
    status.input?.liveV83?.antecedentHashSetSha256 !== V83_HASH_SET_SHA256 ||
    status.input?.liveV83?.authorizationTemplateSha256 !==
      V83_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV83?.antecedentCommit !== V83_ANTECEDENT_COMMIT ||
    status.input?.liveV83?.authorizationPresent !== true ||
    status.input?.liveV83?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV83?.authorizationEffective !== false ||
    status.input?.liveV83?.authorizationPath !== V83_AUTHORIZATION_PATH ||
    status.input?.liveV83?.authorizationSha256 !== V83_AUTHORIZATION_SHA256 ||
    status.input?.liveV83?.signingPublicKeySpkiSha256 !==
      V83_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV83?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV83?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV83?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV83?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    status.input?.liveV83?.taughtCompileCarryLiveOpacity !== true ||
    status.input?.liveV83?.inventOpacityVariableForbidden !== true ||
    status.input?.liveV83?.inventCompileTextOpacityForbidden !== true ||
    status.input?.liveV83?.taughtCompileCarryLiveVisible !== true ||
    status.input?.liveV83?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV83?.taughtContentOpacityOmitted !== true ||
    status.input?.liveV83?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV83?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV83?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV83?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV83?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV83?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV83?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV83?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV83?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV83?.v18WriterMinted !== true ||
    status.input?.liveV83?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV83?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV83?.v19WriterMinted !== true ||
    status.input?.liveV83?.v82SceneReadbackUnchanged !== true ||
    status.input?.liveV83?.v81SceneReadbackUnchanged !== true ||
    status.input?.liveV83?.v80SceneReadbackUnchanged !== true ||
    status.input?.liveV83?.v82AuthorizationReusable !== false ||
    status.input?.liveV83?.v81AuthorizationReusable !== false ||
    status.input?.liveV83?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV83?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV83?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV83?.sceneReadbackCarried !== true ||
    status.input?.liveV83?.carriedSceneReadback !==
      "recipe/scene-readback-v83.ts" ||
    status.input?.liveV83?.sourceRoots !== 2 ||
    status.input?.liveV83?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV83?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV83?.attemptsExecuted !== 1 ||
    status.input?.liveV83?.nextAttempt !== 2 ||
    status.input?.liveV83?.liveExecutionOccurred !== true ||
    status.input?.liveV83?.figmaWrites !== 5 ||
    status.input?.liveV83?.attempt1Path !== V83_ATTEMPT_1_PATH ||
    status.input?.liveV83?.attempt1Sha256 !== V83_ATTEMPT_1_SHA256 ||
    status.input?.liveV83?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV83?.taughtContentOpacityOmittedHeld !== true ||
    status.input?.liveV83?.taughtCompileCarryLiveVisibleHeld !== true ||
    status.input?.liveV83?.taughtCompileCarryLiveOpacityHeld !== true ||
    status.input?.liveV83?.taughtCollapseOmitInventedContentTextOpacityHeld !==
      true ||
    status.input?.liveV83?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV83?.independentRootAccountingPassed !== true ||
    status.input?.liveV83?.recipeCollapseFixedPointStable !== true ||
    status.input?.liveV83?.recipeCollapseRefusedFixedPoint !== false ||
    status.input?.liveV83?.probeIssued !== true ||
    status.input?.liveV83?.probeOtherwiseGreen !== false ||
    status.input?.liveV83?.mintCleaned !== true ||
    status.input?.liveV83?.mintStayed !== false ||
    status.input?.liveV83?.doNotClaimV1Complete !== true ||
    status.input?.liveV83?.humanSignoff !== "pending" ||
    status.input?.liveV83?.overallInputSuccess !== false ||
    status.input?.liveV84?.status !== V84_STATUS ||
    status.input?.liveV84?.baseCommit !== V84_BASE_COMMIT ||
    status.input?.liveV84?.protocolSha256 !== V84_PROTOCOL_SHA256 ||
    status.input?.liveV84?.proofPlanSha256 !== V84_PLAN_SHA256 ||
    status.input?.liveV84?.captureManifestSha256 !==
      V84_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV84?.requestManifestSha256 !==
      V84_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV84?.antecedentIndexSha256 !== V84_INDEX_SHA256 ||
    status.input?.liveV84?.antecedentHashSetSha256 !== V84_HASH_SET_SHA256 ||
    status.input?.liveV84?.authorizationTemplateSha256 !==
      V84_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV84?.antecedentCommit !== V84_ANTECEDENT_COMMIT ||
    status.input?.liveV84?.authorizationPresent !== true ||
    status.input?.liveV84?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV84?.authorizationEffective !== false ||
    status.input?.liveV84?.authorizationPath !== V84_AUTHORIZATION_PATH ||
    status.input?.liveV84?.authorizationSha256 !== V84_AUTHORIZATION_SHA256 ||
    status.input?.liveV84?.signingPublicKeySpkiSha256 !==
      V84_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV84?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV84?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV84?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV84?.taughtProbeExcludeOpacityZeroOccupancyOverlap !==
      true ||
    status.input?.liveV84?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    status.input?.liveV84?.taughtCompileCarryLiveOpacity !== true ||
    status.input?.liveV84?.inventOpacityVariableForbidden !== true ||
    status.input?.liveV84?.inventCompileTextOpacityForbidden !== true ||
    status.input?.liveV84?.taughtCompileCarryLiveVisible !== true ||
    status.input?.liveV84?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV84?.taughtContentOpacityOmitted !== true ||
    status.input?.liveV84?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV84?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV84?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV84?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV84?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV84?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV84?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV84?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV84?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV84?.v18WriterMinted !== true ||
    status.input?.liveV84?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV84?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV84?.v19WriterMinted !== true ||
    status.input?.liveV84?.v83SceneReadbackUnchanged !== true ||
    status.input?.liveV84?.v82SceneReadbackUnchanged !== true ||
    status.input?.liveV84?.v81SceneReadbackUnchanged !== true ||
    status.input?.liveV84?.v83AuthorizationReusable !== false ||
    status.input?.liveV84?.v82AuthorizationReusable !== false ||
    status.input?.liveV84?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV84?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV84?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV84?.sceneReadbackCarried !== true ||
    status.input?.liveV84?.carriedSceneReadback !==
      "recipe/scene-readback-v84.ts" ||
    status.input?.liveV84?.sourceRoots !== 2 ||
    status.input?.liveV84?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV84?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV84?.attemptsExecuted !== 1 ||
    status.input?.liveV84?.nextAttempt !== 2 ||
    status.input?.liveV84?.liveExecutionOccurred !== true ||
    status.input?.liveV84?.figmaWrites !== 133 ||
    status.input?.liveV84?.attempt1Path !== V84_ATTEMPT_1_PATH ||
    status.input?.liveV84?.attempt1Sha256 !== V84_ATTEMPT_1_SHA256 ||
    status.input?.liveV84?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV84?.taughtContentOpacityOmittedHeld !== true ||
    status.input?.liveV84?.taughtCompileCarryLiveVisibleHeld !== true ||
    status.input?.liveV84?.taughtCompileCarryLiveOpacityHeld !== true ||
    status.input?.liveV84?.taughtCollapseOmitInventedContentTextOpacityHeld !==
      true ||
    status.input?.liveV84?.taughtProbeExcludeOpacityZeroOccupancyOverlapHeld !==
      true ||
    status.input?.liveV84?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV84?.independentRootAccountingPassed !== true ||
    status.input?.liveV84?.recipeCollapseFixedPointStable !== true ||
    status.input?.liveV84?.recipeCollapseRefusedFixedPoint !== false ||
    status.input?.liveV84?.probeIssued !== true ||
    status.input?.liveV84?.probeOtherwiseGreen !== true ||
    status.input?.liveV84?.mintCleaned !== true ||
    status.input?.liveV84?.mintStayed !== false ||
    status.input?.liveV84?.doNotClaimV1Complete !== true ||
    status.input?.liveV84?.humanSignoff !== "pending" ||
    status.input?.liveV84?.overallInputSuccess !== false ||
    status.input?.liveV85?.status !== V85_STATUS ||
    status.input?.liveV85?.baseCommit !== V85_BASE_COMMIT ||
    status.input?.liveV85?.protocolSha256 !== V85_PROTOCOL_SHA256 ||
    status.input?.liveV85?.proofPlanSha256 !== V85_PLAN_SHA256 ||
    status.input?.liveV85?.captureManifestSha256 !==
      V85_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV85?.requestManifestSha256 !==
      V85_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV85?.antecedentIndexSha256 !== V85_INDEX_SHA256 ||
    status.input?.liveV85?.antecedentHashSetSha256 !== V85_HASH_SET_SHA256 ||
    status.input?.liveV85?.authorizationTemplateSha256 !==
      V85_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV85?.antecedentCommit !== V85_ANTECEDENT_COMMIT ||
    status.input?.liveV85?.authorizationPresent !== true ||
    status.input?.liveV85?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV85?.authorizationEffective !== false ||
    status.input?.liveV85?.authorizationPath !== V85_AUTHORIZATION_PATH ||
    status.input?.liveV85?.authorizationSha256 !== V85_AUTHORIZATION_SHA256 ||
    status.input?.liveV85?.signingPublicKeySpkiSha256 !==
      V85_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV85?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized" ||
    status.input?.liveV85?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV85?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV85?.taughtCleanupOnFailureOnly !== true ||
    status.input?.liveV85?.taughtProbeExcludeOpacityZeroOccupancyOverlap !==
      true ||
    status.input?.liveV85?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    status.input?.liveV85?.taughtCompileCarryLiveOpacity !== true ||
    status.input?.liveV85?.inventOpacityVariableForbidden !== true ||
    status.input?.liveV85?.inventCompileTextOpacityForbidden !== true ||
    status.input?.liveV85?.taughtCompileCarryLiveVisible !== true ||
    status.input?.liveV85?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV85?.taughtContentOpacityOmitted !== true ||
    status.input?.liveV85?.taughtWriterHiddenFillOccupancy !== true ||
    status.input?.liveV85?.taughtProbeExcludeOverlayLabelAabb !== true ||
    status.input?.liveV85?.taughtProbeRevealThenMeasureHiddenContentFill !==
      true ||
    status.input?.liveV85?.taughtWriterFirstSegmentBind !== true ||
    status.input?.liveV85?.taughtProbePolarReflowAgainstContentText !== true ||
    status.input?.liveV85?.taughtProbeFirstSegmentRole !== true ||
    status.input?.liveV85?.taughtUnnamedSourcePxCarriedNotRequiredEquals !==
      true ||
    status.input?.liveV85?.v16WriterBytesUnchanged !== true ||
    status.input?.liveV85?.v17WriterProgramUnchanged !== true ||
    status.input?.liveV85?.v18WriterMinted !== true ||
    status.input?.liveV85?.v18WriterProgramUnchanged !== true ||
    status.input?.liveV85?.v18WriterPayloadUnchanged !== true ||
    status.input?.liveV85?.v19WriterMinted !== true ||
    status.input?.liveV85?.v84SceneReadbackUnchanged !== true ||
    status.input?.liveV85?.v83SceneReadbackUnchanged !== true ||
    status.input?.liveV85?.v82SceneReadbackUnchanged !== true ||
    status.input?.liveV85?.v84AuthorizationReusable !== false ||
    status.input?.liveV85?.v83AuthorizationReusable !== false ||
    status.input?.liveV85?.inventPolarPixelOrSpreadValuesForbidden !== true ||
    status.input?.liveV85?.inventPolarContentRowForbidden !== true ||
    status.input?.liveV85?.inventOverlapZeroForbidden !== true ||
    status.input?.liveV85?.sceneReadbackCarried !== true ||
    status.input?.liveV85?.carriedSceneReadback !==
      "recipe/scene-readback-v85.ts" ||
    status.input?.liveV85?.sourceRoots !== 2 ||
    status.input?.liveV85?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV85?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV85?.attemptsExecuted !== 1 ||
    status.input?.liveV85?.nextAttempt !== 2 ||
    status.input?.liveV85?.liveExecutionOccurred !== true ||
    status.input?.liveV85?.figmaWrites !== 132 ||
    status.input?.liveV85?.attempt1Path !== V85_ATTEMPT_1_PATH ||
    status.input?.liveV85?.attempt1Sha256 !== V85_ATTEMPT_1_SHA256 ||
    status.input?.liveV85?.taughtWriterHiddenFillOccupancyHeld !== true ||
    status.input?.liveV85?.taughtContentOpacityOmittedHeld !== true ||
    status.input?.liveV85?.taughtCompileCarryLiveVisibleHeld !== true ||
    status.input?.liveV85?.taughtCompileCarryLiveOpacityHeld !== true ||
    status.input?.liveV85?.taughtCollapseOmitInventedContentTextOpacityHeld !==
      true ||
    status.input?.liveV85?.taughtProbeExcludeOpacityZeroOccupancyOverlapHeld !==
      true ||
    status.input?.liveV85?.taughtCleanupOnFailureOnlyHeld !== true ||
    status.input?.liveV85?.inventHostVisibleFalseForbidden !== true ||
    status.input?.liveV85?.independentRootAccountingPassed !== true ||
    status.input?.liveV85?.recipeCollapseFixedPointStable !== true ||
    status.input?.liveV85?.recipeCollapseRefusedFixedPoint !== false ||
    status.input?.liveV85?.probeIssued !== true ||
    status.input?.liveV85?.probeOtherwiseGreen !== true ||
    status.input?.liveV85?.mintCleaned !== false ||
    status.input?.liveV85?.mintStayed !== true ||
    status.input?.liveV85?.doNotClaimV1Complete !== true ||
    status.input?.liveV85?.humanSignoff !== "pending" ||
    status.input?.liveV85?.overallInputSuccess !== false
  )
    fail("v3 exhausted/v4-v85 current status");
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
  const v47Protocol = readRepositoryJson<Record<string, any>>(
    `${V47_ROOT}/protocol.json`,
  );
  const v47Index = readRepositoryJson<Record<string, any>>(
    `${V47_ROOT}/antecedent-index.json`,
  );
  const v47Status = readRepositoryJson<Record<string, any>>(V47_STATUS_PATH);
  const v48Protocol = readRepositoryJson<Record<string, any>>(
    `${V48_ROOT}/protocol.json`,
  );
  const v48Index = readRepositoryJson<Record<string, any>>(
    `${V48_ROOT}/antecedent-index.json`,
  );
  const v48Status = readRepositoryJson<Record<string, any>>(V48_STATUS_PATH);
  const v49Protocol = readRepositoryJson<Record<string, any>>(
    `${V49_ROOT}/protocol.json`,
  );
  const v49Index = readRepositoryJson<Record<string, any>>(
    `${V49_ROOT}/antecedent-index.json`,
  );
  const v49Status = readRepositoryJson<Record<string, any>>(V49_STATUS_PATH);
  const v50Protocol = readRepositoryJson<Record<string, any>>(
    `${V50_ROOT}/protocol.json`,
  );
  const v50Index = readRepositoryJson<Record<string, any>>(
    `${V50_ROOT}/antecedent-index.json`,
  );
  const v50Status = readRepositoryJson<Record<string, any>>(V50_STATUS_PATH);
  const v51Protocol = readRepositoryJson<Record<string, any>>(
    `${V51_ROOT}/protocol.json`,
  );
  const v51Index = readRepositoryJson<Record<string, any>>(
    `${V51_ROOT}/antecedent-index.json`,
  );
  const v51Status = readRepositoryJson<Record<string, any>>(V51_STATUS_PATH);
  const v52Protocol = readRepositoryJson<Record<string, any>>(
    `${V52_ROOT}/protocol.json`,
  );
  const v52Index = readRepositoryJson<Record<string, any>>(
    `${V52_ROOT}/antecedent-index.json`,
  );
  const v52Status = readRepositoryJson<Record<string, any>>(V52_STATUS_PATH);
  const v53Protocol = readRepositoryJson<Record<string, any>>(
    `${V53_ROOT}/protocol.json`,
  );
  const v53Index = readRepositoryJson<Record<string, any>>(
    `${V53_ROOT}/antecedent-index.json`,
  );
  const v53Status = readRepositoryJson<Record<string, any>>(V53_STATUS_PATH);
  const v54Protocol = readRepositoryJson<Record<string, any>>(
    `${V54_ROOT}/protocol.json`,
  );
  const v54Index = readRepositoryJson<Record<string, any>>(
    `${V54_ROOT}/antecedent-index.json`,
  );
  const v54Status = readRepositoryJson<Record<string, any>>(V54_STATUS_PATH);
  const v55Protocol = readRepositoryJson<Record<string, any>>(
    `${V55_ROOT}/protocol.json`,
  );
  const v55Index = readRepositoryJson<Record<string, any>>(
    `${V55_ROOT}/antecedent-index.json`,
  );
  const v55Status = readRepositoryJson<Record<string, any>>(V55_STATUS_PATH);
  const v56Protocol = readRepositoryJson<Record<string, any>>(
    `${V56_ROOT}/protocol.json`,
  );
  const v56Index = readRepositoryJson<Record<string, any>>(
    `${V56_ROOT}/antecedent-index.json`,
  );
  const v56Status = readRepositoryJson<Record<string, any>>(V56_STATUS_PATH);
  const v57Protocol = readRepositoryJson<Record<string, any>>(
    `${V57_ROOT}/protocol.json`,
  );
  const v57Index = readRepositoryJson<Record<string, any>>(
    `${V57_ROOT}/antecedent-index.json`,
  );
  const v57Status = readRepositoryJson<Record<string, any>>(V57_STATUS_PATH);
  const v58Protocol = readRepositoryJson<Record<string, any>>(
    `${V58_ROOT}/protocol.json`,
  );
  const v58Index = readRepositoryJson<Record<string, any>>(
    `${V58_ROOT}/antecedent-index.json`,
  );
  const v58Status = readRepositoryJson<Record<string, any>>(V58_STATUS_PATH);
  const v59Protocol = readRepositoryJson<Record<string, any>>(
    `${V59_ROOT}/protocol.json`,
  );
  const v59Index = readRepositoryJson<Record<string, any>>(
    `${V59_ROOT}/antecedent-index.json`,
  );
  const v59Status = readRepositoryJson<Record<string, any>>(V59_STATUS_PATH);
  const v60Protocol = readRepositoryJson<Record<string, any>>(
    `${V60_ROOT}/protocol.json`,
  );
  const v60Index = readRepositoryJson<Record<string, any>>(
    `${V60_ROOT}/antecedent-index.json`,
  );
  const v60Status = readRepositoryJson<Record<string, any>>(V60_STATUS_PATH);
  const v61Protocol = readRepositoryJson<Record<string, any>>(
    `${V61_ROOT}/protocol.json`,
  );
  const v61Index = readRepositoryJson<Record<string, any>>(
    `${V61_ROOT}/antecedent-index.json`,
  );
  const v61Status = readRepositoryJson<Record<string, any>>(V61_STATUS_PATH);
  const v62Protocol = readRepositoryJson<Record<string, any>>(
    `${V62_ROOT}/protocol.json`,
  );
  const v62Index = readRepositoryJson<Record<string, any>>(
    `${V62_ROOT}/antecedent-index.json`,
  );
  const v62Status = readRepositoryJson<Record<string, any>>(V62_STATUS_PATH);
  const v63Protocol = readRepositoryJson<Record<string, any>>(
    `${V63_ROOT}/protocol.json`,
  );
  const v63Index = readRepositoryJson<Record<string, any>>(
    `${V63_ROOT}/antecedent-index.json`,
  );
  const v63Status = readRepositoryJson<Record<string, any>>(V63_STATUS_PATH);
  const v64Protocol = readRepositoryJson<Record<string, any>>(
    `${V64_ROOT}/protocol.json`,
  );
  const v64Index = readRepositoryJson<Record<string, any>>(
    `${V64_ROOT}/antecedent-index.json`,
  );
  const v64Status = readRepositoryJson<Record<string, any>>(V64_STATUS_PATH);
  const v65Protocol = readRepositoryJson<Record<string, any>>(
    `${V65_ROOT}/protocol.json`,
  );
  const v65Index = readRepositoryJson<Record<string, any>>(
    `${V65_ROOT}/antecedent-index.json`,
  );
  const v65Status = readRepositoryJson<Record<string, any>>(V65_STATUS_PATH);
  const v66Protocol = readRepositoryJson<Record<string, any>>(
    `${V66_ROOT}/protocol.json`,
  );
  const v66Index = readRepositoryJson<Record<string, any>>(
    `${V66_ROOT}/antecedent-index.json`,
  );
  const v66Status = readRepositoryJson<Record<string, any>>(V66_STATUS_PATH);
  const v67Protocol = readRepositoryJson<Record<string, any>>(
    `${V67_ROOT}/protocol.json`,
  );
  const v67Index = readRepositoryJson<Record<string, any>>(
    `${V67_ROOT}/antecedent-index.json`,
  );
  const v67Status = readRepositoryJson<Record<string, any>>(V67_STATUS_PATH);
  const v68Protocol = readRepositoryJson<Record<string, any>>(
    `${V68_ROOT}/protocol.json`,
  );
  const v68Index = readRepositoryJson<Record<string, any>>(
    `${V68_ROOT}/antecedent-index.json`,
  );
  const v68Status = readRepositoryJson<Record<string, any>>(V68_STATUS_PATH);
  const v69Protocol = readRepositoryJson<Record<string, any>>(
    `${V69_ROOT}/protocol.json`,
  );
  const v69Index = readRepositoryJson<Record<string, any>>(
    `${V69_ROOT}/antecedent-index.json`,
  );
  const v69Status = readRepositoryJson<Record<string, any>>(V69_STATUS_PATH);
  const v70Protocol = readRepositoryJson<Record<string, any>>(
    `${V70_ROOT}/protocol.json`,
  );
  const v70Index = readRepositoryJson<Record<string, any>>(
    `${V70_ROOT}/antecedent-index.json`,
  );
  const v70Status = readRepositoryJson<Record<string, any>>(V70_STATUS_PATH);
  const v71Protocol = readRepositoryJson<Record<string, any>>(
    `${V71_ROOT}/protocol.json`,
  );
  const v71Index = readRepositoryJson<Record<string, any>>(
    `${V71_ROOT}/antecedent-index.json`,
  );
  const v71Status = readRepositoryJson<Record<string, any>>(V71_STATUS_PATH);
  const v72Protocol = readRepositoryJson<Record<string, any>>(
    `${V72_ROOT}/protocol.json`,
  );
  const v72Index = readRepositoryJson<Record<string, any>>(
    `${V72_ROOT}/antecedent-index.json`,
  );
  const v72Status = readRepositoryJson<Record<string, any>>(V72_STATUS_PATH);
  const v73Protocol = readRepositoryJson<Record<string, any>>(
    `${V73_ROOT}/protocol.json`,
  );
  const v73Index = readRepositoryJson<Record<string, any>>(
    `${V73_ROOT}/antecedent-index.json`,
  );
  const v73Status = readRepositoryJson<Record<string, any>>(V73_STATUS_PATH);
  const v74Protocol = readRepositoryJson<Record<string, any>>(
    `${V74_ROOT}/protocol.json`,
  );
  const v74Index = readRepositoryJson<Record<string, any>>(
    `${V74_ROOT}/antecedent-index.json`,
  );
  const v74Status = readRepositoryJson<Record<string, any>>(V74_STATUS_PATH);
  const v75Protocol = readRepositoryJson<Record<string, any>>(
    `${V75_ROOT}/protocol.json`,
  );
  const v75Index = readRepositoryJson<Record<string, any>>(
    `${V75_ROOT}/antecedent-index.json`,
  );
  const v75Status = readRepositoryJson<Record<string, any>>(V75_STATUS_PATH);
  const v76Protocol = readRepositoryJson<Record<string, any>>(
    `${V76_ROOT}/protocol.json`,
  );
  const v76Index = readRepositoryJson<Record<string, any>>(
    `${V76_ROOT}/antecedent-index.json`,
  );
  const v76Status = readRepositoryJson<Record<string, any>>(V76_STATUS_PATH);
  const v77Protocol = readRepositoryJson<Record<string, any>>(
    `${V77_ROOT}/protocol.json`,
  );
  const v77Index = readRepositoryJson<Record<string, any>>(
    `${V77_ROOT}/antecedent-index.json`,
  );
  const v77Status = readRepositoryJson<Record<string, any>>(V77_STATUS_PATH);
  const v78Protocol = readRepositoryJson<Record<string, any>>(
    `${V78_ROOT}/protocol.json`,
  );
  const v78Index = readRepositoryJson<Record<string, any>>(
    `${V78_ROOT}/antecedent-index.json`,
  );
  const v78Status = readRepositoryJson<Record<string, any>>(V78_STATUS_PATH);
  const v79Protocol = readRepositoryJson<Record<string, any>>(
    `${V79_ROOT}/protocol.json`,
  );
  const v79Index = readRepositoryJson<Record<string, any>>(
    `${V79_ROOT}/antecedent-index.json`,
  );
  const v79Status = readRepositoryJson<Record<string, any>>(V79_STATUS_PATH);
  const v80Protocol = readRepositoryJson<Record<string, any>>(
    `${V80_ROOT}/protocol.json`,
  );
  const v80Index = readRepositoryJson<Record<string, any>>(
    `${V80_ROOT}/antecedent-index.json`,
  );
  const v80Status = readRepositoryJson<Record<string, any>>(V80_STATUS_PATH);
  const v81Protocol = readRepositoryJson<Record<string, any>>(
    `${V81_ROOT}/protocol.json`,
  );
  const v81Index = readRepositoryJson<Record<string, any>>(
    `${V81_ROOT}/antecedent-index.json`,
  );
  const v81Status = readRepositoryJson<Record<string, any>>(V81_STATUS_PATH);
  const v82Protocol = readRepositoryJson<Record<string, any>>(
    `${V82_ROOT}/protocol.json`,
  );
  const v82Index = readRepositoryJson<Record<string, any>>(
    `${V82_ROOT}/antecedent-index.json`,
  );
  const v82Status = readRepositoryJson<Record<string, any>>(V82_STATUS_PATH);
  const v83Protocol = readRepositoryJson<Record<string, any>>(
    `${V83_ROOT}/protocol.json`,
  );
  const v83Index = readRepositoryJson<Record<string, any>>(
    `${V83_ROOT}/antecedent-index.json`,
  );
  const v83Status = readRepositoryJson<Record<string, any>>(V83_STATUS_PATH);
  const v84Protocol = readRepositoryJson<Record<string, any>>(
    `${V84_ROOT}/protocol.json`,
  );
  const v84Index = readRepositoryJson<Record<string, any>>(
    `${V84_ROOT}/antecedent-index.json`,
  );
  const v84Status = readRepositoryJson<Record<string, any>>(V84_STATUS_PATH);
  const v85Protocol = readRepositoryJson<Record<string, any>>(
    `${V85_ROOT}/protocol.json`,
  );
  const v85Index = readRepositoryJson<Record<string, any>>(
    `${V85_ROOT}/antecedent-index.json`,
  );
  const v85Status = readRepositoryJson<Record<string, any>>(V85_STATUS_PATH);

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
  if (
    sha256(readRepositoryEvidence(`${V47_ROOT}/protocol.json`)) !==
      V47_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V47_ROOT}/proof-plan.json`)) !==
      V47_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V47_ROOT}/capture-manifest.json`)) !==
      V47_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V47_ROOT}/request-manifest.json`)) !==
      V47_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V47_ROOT}/antecedent-index.json`)) !==
      V47_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V47_ROOT}/authorization-template.json`),
    ) !== V47_AUTHORIZATION_TEMPLATE_SHA256 ||
    v47Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v47.ts" ||
    v47Protocol.hostNormalization?.taughtMessageTextDecorationOmitted !==
      true ||
    v47Protocol.hostNormalization?.taughtMessageTextCaseOmitted !== true ||
    v47Protocol.hostNormalization?.taughtMessageLetterSpacingOmitted !==
      true ||
    v47Protocol.hostNormalization?.taughtMessageBindingCompileOrder !==
      true ||
    v47Protocol.hostNormalization?.v46SceneReadbackUnchanged !== true ||
    v47Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v47Protocol.execution?.remoteRequests !== 133 ||
    v47Index.hashSetSha256 !== V47_HASH_SET_SHA256 ||
    v47Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v47Status.artifactVersion !== "input-live-v47-status-v1" ||
    v47Status.status !== V47_STATUS ||
    v47Status.baseCommit !== V47_BASE_COMMIT ||
    v47Status.antecedent?.commit !== V47_ANTECEDENT_COMMIT ||
    v47Status.authorization?.present !== true ||
    v47Status.authorization?.commitStateDerivedByHistory !== true ||
    v47Status.authorization?.effective !== false ||
    v47Status.authorization?.path !== V47_AUTHORIZATION_PATH ||
    v47Status.authorization?.sha256 !== V47_AUTHORIZATION_SHA256 ||
    v47Status.authorization?.signingPublicKeySpkiSha256 !==
      V47_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V47_AUTHORIZATION_PATH)) !==
      V47_AUTHORIZATION_SHA256 ||
    v47Status.authorization?.v46AuthorizationReusable !== false ||
    v47Status.smallestHonestDelta?.taughtMessageTextDecorationOmitted !==
      true ||
    v47Status.smallestHonestDelta?.v46SceneReadbackUnchanged !== true ||
    v47Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v47Status.attemptsExecuted !== 1 ||
    v47Status.nextAttempt !== 2 ||
    v47Status.liveExecutionOccurred !== true ||
    v47Status.figmaWrites !== 4 ||
    v47Status.figmaCaptures !== 0 ||
    v47Status.createdNodesThenRemoved !== 2317 ||
    v47Status.attempt1Path !== V47_ATTEMPT_1_PATH ||
    v47Status.attempt1Sha256 !== V47_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V47_ATTEMPT_1_PATH)) !==
      V47_ATTEMPT_1_SHA256 ||
    v47Status.restartAsV47Attempt2WithoutMessageContainerClipsContentOmitForbidden !==
      true ||
    v47Status.overallInputSuccess !== false
  )
    failures.push("v47 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V48_ROOT}/protocol.json`)) !==
      V48_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V48_ROOT}/proof-plan.json`)) !==
      V48_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V48_ROOT}/capture-manifest.json`)) !==
      V48_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V48_ROOT}/request-manifest.json`)) !==
      V48_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V48_ROOT}/antecedent-index.json`)) !==
      V48_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V48_ROOT}/authorization-template.json`),
    ) !== V48_AUTHORIZATION_TEMPLATE_SHA256 ||
    v48Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v48.ts" ||
    v48Protocol.hostNormalization?.taughtMessageContainerClipsContentOmitted !==
      true ||
    v48Protocol.hostNormalization?.taughtMessageTextDecorationOmitted !==
      true ||
    v48Protocol.hostNormalization?.v47SceneReadbackUnchanged !== true ||
    v48Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v48Protocol.execution?.remoteRequests !== 133 ||
    v48Index.hashSetSha256 !== V48_HASH_SET_SHA256 ||
    v48Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v48Status.artifactVersion !== "input-live-v48-status-v1" ||
    v48Status.status !== V48_STATUS ||
    v48Status.baseCommit !== V48_BASE_COMMIT ||
    v48Status.antecedent?.commit !== V48_ANTECEDENT_COMMIT ||
    v48Status.authorization?.present !== true ||
    v48Status.authorization?.commitStateDerivedByHistory !== true ||
    v48Status.authorization?.effective !== false ||
    v48Status.authorization?.path !== V48_AUTHORIZATION_PATH ||
    v48Status.authorization?.sha256 !== V48_AUTHORIZATION_SHA256 ||
    v48Status.authorization?.signingPublicKeySpkiSha256 !==
      V48_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V48_AUTHORIZATION_PATH)) !==
      V48_AUTHORIZATION_SHA256 ||
    v48Status.authorization?.v47AuthorizationReusable !== false ||
    v48Status.smallestHonestDelta?.taughtMessageContainerClipsContentOmitted !==
      true ||
    v48Status.smallestHonestDelta?.v47SceneReadbackUnchanged !== true ||
    v48Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v48Status.attemptsExecuted !== 1 ||
    v48Status.nextAttempt !== 2 ||
    v48Status.liveExecutionOccurred !== true ||
    v48Status.figmaWrites !== 4 ||
    v48Status.figmaCaptures !== 0 ||
    v48Status.createdNodesThenRemoved !== 2317 ||
    v48Status.attempt1Path !== V48_ATTEMPT_1_PATH ||
    v48Status.attempt1Sha256 !== V48_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V48_ATTEMPT_1_PATH)) !==
      V48_ATTEMPT_1_SHA256 ||
    v48Status.restartAsV48Attempt2WithoutMessageContainerCornerRadiusOmitForbidden !==
      true ||
    v48Status.overallInputSuccess !== false
  )
    failures.push("v48 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V49_ROOT}/protocol.json`)) !==
      V49_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V49_ROOT}/proof-plan.json`)) !==
      V49_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V49_ROOT}/capture-manifest.json`)) !==
      V49_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V49_ROOT}/request-manifest.json`)) !==
      V49_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V49_ROOT}/antecedent-index.json`)) !==
      V49_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V49_ROOT}/authorization-template.json`),
    ) !== V49_AUTHORIZATION_TEMPLATE_SHA256 ||
    v49Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v49.ts" ||
    v49Protocol.hostNormalization?.taughtMessageContainerCornerRadiusOmitted !==
      true ||
    v49Protocol.hostNormalization?.taughtMessageContainerClipsContentOmitted !==
      true ||
    v49Protocol.hostNormalization?.v48SceneReadbackUnchanged !== true ||
    v49Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v49Protocol.execution?.remoteRequests !== 133 ||
    v49Index.hashSetSha256 !== V49_HASH_SET_SHA256 ||
    v49Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v49Status.artifactVersion !== "input-live-v49-status-v1" ||
    v49Status.status !== V49_STATUS ||
    v49Status.baseCommit !== V49_BASE_COMMIT ||
    v49Status.antecedent?.commit !== V49_ANTECEDENT_COMMIT ||
    v49Status.authorization?.present !== true ||
    v49Status.authorization?.commitStateDerivedByHistory !== true ||
    v49Status.authorization?.effective !== false ||
    v49Status.authorization?.path !== V49_AUTHORIZATION_PATH ||
    v49Status.authorization?.sha256 !== V49_AUTHORIZATION_SHA256 ||
    v49Status.authorization?.signingPublicKeySpkiSha256 !==
      V49_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V49_AUTHORIZATION_PATH)) !==
      V49_AUTHORIZATION_SHA256 ||
    v49Status.authorization?.v48AuthorizationReusable !== false ||
    v49Status.smallestHonestDelta?.taughtMessageContainerCornerRadiusOmitted !==
      true ||
    v49Status.smallestHonestDelta?.v48SceneReadbackUnchanged !== true ||
    v49Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v49Status.attemptsExecuted !== 1 ||
    v49Status.nextAttempt !== 2 ||
    v49Status.liveExecutionOccurred !== true ||
    v49Status.figmaWrites !== 4 ||
    v49Status.figmaCaptures !== 0 ||
    v49Status.createdNodesThenRemoved !== 2317 ||
    v49Status.attempt1Path !== V49_ATTEMPT_1_PATH ||
    v49Status.attempt1Sha256 !== V49_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V49_ATTEMPT_1_PATH)) !==
      V49_ATTEMPT_1_SHA256 ||
    v49Status.restartAsV49Attempt2WithoutMessageContainerEffectsOmitForbidden !==
      true ||
    v49Status.overallInputSuccess !== false
  )
    failures.push("v49 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V50_ROOT}/protocol.json`)) !==
      V50_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V50_ROOT}/proof-plan.json`)) !==
      V50_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V50_ROOT}/capture-manifest.json`)) !==
      V50_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V50_ROOT}/request-manifest.json`)) !==
      V50_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V50_ROOT}/antecedent-index.json`)) !==
      V50_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V50_ROOT}/authorization-template.json`),
    ) !== V50_AUTHORIZATION_TEMPLATE_SHA256 ||
    v50Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v50.ts" ||
    v50Protocol.hostNormalization?.taughtMessageContainerEffectsOmitted !==
      true ||
    v50Protocol.hostNormalization?.taughtMessageContainerCornerRadiusOmitted !==
      true ||
    v50Protocol.hostNormalization?.v49SceneReadbackUnchanged !== true ||
    v50Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v50Protocol.execution?.remoteRequests !== 133 ||
    v50Index.hashSetSha256 !== V50_HASH_SET_SHA256 ||
    v50Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v50Status.artifactVersion !== "input-live-v50-status-v1" ||
    v50Status.status !== V50_STATUS ||
    v50Status.baseCommit !== V50_BASE_COMMIT ||
    v50Status.antecedent?.commit !== V50_ANTECEDENT_COMMIT ||
    v50Status.authorization?.present !== true ||
    v50Status.authorization?.commitStateDerivedByHistory !== true ||
    v50Status.authorization?.effective !== false ||
    v50Status.authorization?.path !== V50_AUTHORIZATION_PATH ||
    v50Status.authorization?.sha256 !== V50_AUTHORIZATION_SHA256 ||
    v50Status.authorization?.signingPublicKeySpkiSha256 !==
      V50_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V50_AUTHORIZATION_PATH)) !==
      V50_AUTHORIZATION_SHA256 ||
    v50Status.authorization?.v49AuthorizationReusable !== false ||
    v50Status.smallestHonestDelta?.taughtMessageContainerEffectsOmitted !==
      true ||
    v50Status.smallestHonestDelta?.v49SceneReadbackUnchanged !== true ||
    v50Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v50Status.attemptsExecuted !== 1 ||
    v50Status.nextAttempt !== 2 ||
    v50Status.liveExecutionOccurred !== true ||
    v50Status.figmaWrites !== 4 ||
    v50Status.figmaCaptures !== 0 ||
    v50Status.createdNodesThenRemoved !== 2317 ||
    v50Status.attempt1Path !== V50_ATTEMPT_1_PATH ||
    v50Status.attempt1Sha256 !== V50_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V50_ATTEMPT_1_PATH)) !==
      V50_ATTEMPT_1_SHA256 ||
    v50Status.restartAsV50Attempt2WithoutMessageContainerStrokesOmitForbidden !==
      true ||
    v50Status.overallInputSuccess !== false
  )
    failures.push("v50 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V51_ROOT}/protocol.json`)) !==
      V51_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V51_ROOT}/proof-plan.json`)) !==
      V51_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V51_ROOT}/capture-manifest.json`)) !==
      V51_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V51_ROOT}/request-manifest.json`)) !==
      V51_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V51_ROOT}/antecedent-index.json`)) !==
      V51_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V51_ROOT}/authorization-template.json`),
    ) !== V51_AUTHORIZATION_TEMPLATE_SHA256 ||
    v51Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v51.ts" ||
    v51Protocol.hostNormalization?.taughtMessageContainerStrokesOmitted !==
      true ||
    v51Protocol.hostNormalization?.taughtMessageContainerEffectsOmitted !==
      true ||
    v51Protocol.hostNormalization?.v50SceneReadbackUnchanged !== true ||
    v51Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v51Protocol.execution?.remoteRequests !== 133 ||
    v51Index.hashSetSha256 !== V51_HASH_SET_SHA256 ||
    v51Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v51Status.artifactVersion !== "input-live-v51-status-v1" ||
    v51Status.status !== V51_STATUS ||
    v51Status.baseCommit !== V51_BASE_COMMIT ||
    v51Status.antecedent?.commit !== V51_ANTECEDENT_COMMIT ||
    v51Status.authorization?.present !== true ||
    v51Status.authorization?.commitStateDerivedByHistory !== true ||
    v51Status.authorization?.effective !== false ||
    v51Status.authorization?.path !== V51_AUTHORIZATION_PATH ||
    v51Status.authorization?.sha256 !== V51_AUTHORIZATION_SHA256 ||
    v51Status.authorization?.signingPublicKeySpkiSha256 !==
      V51_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V51_AUTHORIZATION_PATH)) !==
      V51_AUTHORIZATION_SHA256 ||
    v51Status.authorization?.v50AuthorizationReusable !== false ||
    v51Status.smallestHonestDelta?.taughtMessageContainerStrokesOmitted !==
      true ||
    v51Status.smallestHonestDelta?.v50SceneReadbackUnchanged !== true ||
    v51Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v51Status.attemptsExecuted !== 1 ||
    v51Status.nextAttempt !== 2 ||
    v51Status.liveExecutionOccurred !== true ||
    v51Status.figmaWrites !== 4 ||
    v51Status.figmaCaptures !== 0 ||
    v51Status.createdNodesThenRemoved !== 2317 ||
    v51Status.attempt1Path !== V51_ATTEMPT_1_PATH ||
    v51Status.attempt1Sha256 !== V51_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V51_ATTEMPT_1_PATH)) !==
      V51_ATTEMPT_1_SHA256 ||
    v51Status.restartAsV51Attempt2WithoutVariantCornerRadiusOmitForbidden !==
      true ||
    v51Status.overallInputSuccess !== false
  )
    failures.push("v51 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V52_ROOT}/protocol.json`)) !==
      V52_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V52_ROOT}/proof-plan.json`)) !==
      V52_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V52_ROOT}/capture-manifest.json`)) !==
      V52_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V52_ROOT}/request-manifest.json`)) !==
      V52_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V52_ROOT}/antecedent-index.json`)) !==
      V52_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V52_ROOT}/authorization-template.json`),
    ) !== V52_AUTHORIZATION_TEMPLATE_SHA256 ||
    v52Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v52.ts" ||
    v52Protocol.hostNormalization?.taughtVariantCornerRadiusOmitted !==
      true ||
    v52Protocol.hostNormalization?.taughtMessageContainerStrokesOmitted !==
      true ||
    v52Protocol.hostNormalization?.v51SceneReadbackUnchanged !== true ||
    v52Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v52Protocol.execution?.remoteRequests !== 133 ||
    v52Index.hashSetSha256 !== V52_HASH_SET_SHA256 ||
    v52Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v52Status.artifactVersion !== "input-live-v52-status-v1" ||
    v52Status.status !== V52_STATUS ||
    v52Status.baseCommit !== V52_BASE_COMMIT ||
    v52Status.antecedent?.commit !== V52_ANTECEDENT_COMMIT ||
    v52Status.authorization?.present !== true ||
    v52Status.authorization?.commitStateDerivedByHistory !== true ||
    v52Status.authorization?.effective !== false ||
    v52Status.authorization?.path !== V52_AUTHORIZATION_PATH ||
    v52Status.authorization?.sha256 !== V52_AUTHORIZATION_SHA256 ||
    v52Status.authorization?.signingPublicKeySpkiSha256 !==
      V52_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V52_AUTHORIZATION_PATH)) !==
      V52_AUTHORIZATION_SHA256 ||
    v52Status.authorization?.v51AuthorizationReusable !== false ||
    v52Status.smallestHonestDelta?.taughtVariantCornerRadiusOmitted !==
      true ||
    v52Status.smallestHonestDelta?.v51SceneReadbackUnchanged !== true ||
    v52Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v52Status.attemptsExecuted !== 1 ||
    v52Status.nextAttempt !== 2 ||
    v52Status.liveExecutionOccurred !== true ||
    v52Status.figmaWrites !== 4 ||
    v52Status.figmaCaptures !== 0 ||
    v52Status.createdNodesThenRemoved !== 2317 ||
    v52Status.attempt1Path !== V52_ATTEMPT_1_PATH ||
    v52Status.attempt1Sha256 !== V52_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V52_ATTEMPT_1_PATH)) !==
      V52_ATTEMPT_1_SHA256 ||
    v52Status.restartAsV52Attempt2WithoutVariantEffectsOmitForbidden !==
      true ||
    v52Status.overallInputSuccess !== false
  )
    failures.push("v52 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V53_ROOT}/protocol.json`)) !==
      V53_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V53_ROOT}/proof-plan.json`)) !==
      V53_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V53_ROOT}/capture-manifest.json`)) !==
      V53_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V53_ROOT}/request-manifest.json`)) !==
      V53_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V53_ROOT}/antecedent-index.json`)) !==
      V53_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V53_ROOT}/authorization-template.json`),
    ) !== V53_AUTHORIZATION_TEMPLATE_SHA256 ||
    v53Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v53.ts" ||
    v53Protocol.hostNormalization?.taughtVariantEffectsOmitted !==
      true ||
    v53Protocol.hostNormalization?.taughtVariantCornerRadiusOmitted !==
      true ||
    v53Protocol.hostNormalization?.v52SceneReadbackUnchanged !== true ||
    v53Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v53Protocol.execution?.remoteRequests !== 133 ||
    v53Index.hashSetSha256 !== V53_HASH_SET_SHA256 ||
    v53Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v53Status.artifactVersion !== "input-live-v53-status-v1" ||
    v53Status.status !== V53_STATUS ||
    v53Status.baseCommit !== V53_BASE_COMMIT ||
    v53Status.antecedent?.commit !== V53_ANTECEDENT_COMMIT ||
    v53Status.authorization?.present !== true ||
    v53Status.authorization?.commitStateDerivedByHistory !== true ||
    v53Status.authorization?.effective !== false ||
    v53Status.authorization?.path !== V53_AUTHORIZATION_PATH ||
    v53Status.authorization?.sha256 !== V53_AUTHORIZATION_SHA256 ||
    v53Status.authorization?.signingPublicKeySpkiSha256 !==
      V53_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V53_AUTHORIZATION_PATH)) !==
      V53_AUTHORIZATION_SHA256 ||
    v53Status.authorization?.v52AuthorizationReusable !== false ||
    v53Status.smallestHonestDelta?.taughtVariantEffectsOmitted !==
      true ||
    v53Status.smallestHonestDelta?.v52SceneReadbackUnchanged !== true ||
    v53Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v53Status.attemptsExecuted !== 1 ||
    v53Status.nextAttempt !== 2 ||
    v53Status.liveExecutionOccurred !== true ||
    v53Status.figmaWrites !== 4 ||
    v53Status.figmaCaptures !== 0 ||
    v53Status.createdNodesThenRemoved !== 2317 ||
    v53Status.attempt1Path !== V53_ATTEMPT_1_PATH ||
    v53Status.attempt1Sha256 !== V53_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V53_ATTEMPT_1_PATH)) !==
      V53_ATTEMPT_1_SHA256 ||
    v53Status.restartAsV53Attempt2WithoutVariantStrokesOmitForbidden !==
      true ||
    v53Status.overallInputSuccess !== false
  )
    failures.push("v53 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V54_ROOT}/protocol.json`)) !==
      V54_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V54_ROOT}/proof-plan.json`)) !==
      V54_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V54_ROOT}/capture-manifest.json`)) !==
      V54_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V54_ROOT}/request-manifest.json`)) !==
      V54_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V54_ROOT}/antecedent-index.json`)) !==
      V54_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V54_ROOT}/authorization-template.json`),
    ) !== V54_AUTHORIZATION_TEMPLATE_SHA256 ||
    v54Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v54.ts" ||
    v54Protocol.hostNormalization?.taughtVariantStrokesOmitted !==
      true ||
    v54Protocol.hostNormalization?.taughtVariantEffectsOmitted !==
      true ||
    v54Protocol.hostNormalization?.v53SceneReadbackUnchanged !== true ||
    v54Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v54Protocol.execution?.remoteRequests !== 133 ||
    v54Index.hashSetSha256 !== V54_HASH_SET_SHA256 ||
    v54Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v54Status.artifactVersion !== "input-live-v54-status-v1" ||
    v54Status.status !== V54_STATUS ||
    v54Status.baseCommit !== V54_BASE_COMMIT ||
    v54Status.antecedent?.commit !== V54_ANTECEDENT_COMMIT ||
    v54Status.authorization?.present !== true ||
    v54Status.authorization?.commitStateDerivedByHistory !== true ||
    v54Status.authorization?.effective !== false ||
    v54Status.authorization?.path !== V54_AUTHORIZATION_PATH ||
    v54Status.authorization?.sha256 !== V54_AUTHORIZATION_SHA256 ||
    v54Status.authorization?.signingPublicKeySpkiSha256 !==
      V54_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V54_AUTHORIZATION_PATH)) !==
      V54_AUTHORIZATION_SHA256 ||
    v54Status.authorization?.v53AuthorizationReusable !== false ||
    v54Status.smallestHonestDelta?.taughtVariantStrokesOmitted !==
      true ||
    v54Status.smallestHonestDelta?.v53SceneReadbackUnchanged !== true ||
    v54Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v54Status.attemptsExecuted !== 1 ||
    v54Status.nextAttempt !== 2 ||
    v54Status.liveExecutionOccurred !== true ||
    v54Status.figmaWrites !== 4 ||
    v54Status.figmaCaptures !== 0 ||
    v54Status.createdNodesThenRemoved !== 2317 ||
    v54Status.attempt1Path !== V54_ATTEMPT_1_PATH ||
    v54Status.attempt1Sha256 !== V54_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V54_ATTEMPT_1_PATH)) !==
      V54_ATTEMPT_1_SHA256 ||
    v54Status.restartAsV54Attempt2WithoutLeadingSlotBindingCompileOrderForbidden !==
      true ||
    v54Status.overallInputSuccess !== false
  )
    failures.push("v54 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V55_ROOT}/protocol.json`)) !==
      V55_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V55_ROOT}/proof-plan.json`)) !==
      V55_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V55_ROOT}/capture-manifest.json`)) !==
      V55_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V55_ROOT}/request-manifest.json`)) !==
      V55_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V55_ROOT}/antecedent-index.json`)) !==
      V55_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V55_ROOT}/authorization-template.json`),
    ) !== V55_AUTHORIZATION_TEMPLATE_SHA256 ||
    v55Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v55.ts" ||
    v55Protocol.hostNormalization?.taughtLeadingSlotBindingCompileOrder !==
      true ||
    v55Protocol.hostNormalization?.taughtVariantStrokesOmitted !==
      true ||
    v55Protocol.hostNormalization?.v54SceneReadbackUnchanged !== true ||
    v55Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v55Protocol.execution?.remoteRequests !== 133 ||
    v55Index.hashSetSha256 !== V55_HASH_SET_SHA256 ||
    v55Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v55Status.artifactVersion !== "input-live-v55-status-v1" ||
    v55Status.status !== V55_STATUS ||
    v55Status.baseCommit !== V55_BASE_COMMIT ||
    v55Status.antecedent?.commit !== V55_ANTECEDENT_COMMIT ||
    v55Status.authorization?.present !== true ||
    v55Status.authorization?.commitStateDerivedByHistory !== true ||
    v55Status.authorization?.effective !== false ||
    v55Status.authorization?.path !== V55_AUTHORIZATION_PATH ||
    v55Status.authorization?.sha256 !== V55_AUTHORIZATION_SHA256 ||
    v55Status.authorization?.signingPublicKeySpkiSha256 !==
      V55_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V55_AUTHORIZATION_PATH)) !==
      V55_AUTHORIZATION_SHA256 ||
    v55Status.authorization?.v54AuthorizationReusable !== false ||
    v55Status.smallestHonestDelta?.taughtLeadingSlotBindingCompileOrder !==
      true ||
    v55Status.smallestHonestDelta?.v54SceneReadbackUnchanged !== true ||
    v55Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v55Status.attemptsExecuted !== 1 ||
    v55Status.nextAttempt !== 2 ||
    v55Status.liveExecutionOccurred !== true ||
    v55Status.figmaWrites !== 4 ||
    v55Status.figmaCaptures !== 0 ||
    v55Status.createdNodesThenRemoved !== 2317 ||
    v55Status.attempt1Path !== V55_ATTEMPT_1_PATH ||
    v55Status.attempt1Sha256 !== V55_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V55_ATTEMPT_1_PATH)) !==
      V55_ATTEMPT_1_SHA256 ||
    v55Status.restartAsV55Attempt2WithoutTrailingSlotBindingCompileOrderForbidden !==
      true ||
    v55Status.overallInputSuccess !== false
  )
    failures.push("v55 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V56_ROOT}/protocol.json`)) !==
      V56_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V56_ROOT}/proof-plan.json`)) !==
      V56_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V56_ROOT}/capture-manifest.json`)) !==
      V56_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V56_ROOT}/request-manifest.json`)) !==
      V56_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V56_ROOT}/antecedent-index.json`)) !==
      V56_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V56_ROOT}/authorization-template.json`),
    ) !== V56_AUTHORIZATION_TEMPLATE_SHA256 ||
    v56Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v56.ts" ||
    v56Protocol.hostNormalization?.taughtTrailingSlotBindingCompileOrder !==
      true ||
    v56Protocol.hostNormalization?.taughtLeadingSlotBindingCompileOrder !==
      true ||
    v56Protocol.hostNormalization?.v55SceneReadbackUnchanged !== true ||
    v56Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v56Protocol.execution?.remoteRequests !== 133 ||
    v56Index.hashSetSha256 !== V56_HASH_SET_SHA256 ||
    v56Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v56Status.artifactVersion !== "input-live-v56-status-v1" ||
    v56Status.status !== V56_STATUS ||
    v56Status.baseCommit !== V56_BASE_COMMIT ||
    v56Status.antecedent?.commit !== V56_ANTECEDENT_COMMIT ||
    v56Status.authorization?.present !== true ||
    v56Status.authorization?.commitStateDerivedByHistory !== true ||
    v56Status.authorization?.effective !== false ||
    v56Status.authorization?.path !== V56_AUTHORIZATION_PATH ||
    v56Status.authorization?.sha256 !== V56_AUTHORIZATION_SHA256 ||
    v56Status.authorization?.signingPublicKeySpkiSha256 !==
      V56_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V56_AUTHORIZATION_PATH)) !==
      V56_AUTHORIZATION_SHA256 ||
    v56Status.authorization?.v55AuthorizationReusable !== false ||
    v56Status.smallestHonestDelta?.taughtTrailingSlotBindingCompileOrder !==
      true ||
    v56Status.smallestHonestDelta?.v55SceneReadbackUnchanged !== true ||
    v56Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v56Status.attemptsExecuted !== 1 ||
    v56Status.nextAttempt !== 2 ||
    v56Status.liveExecutionOccurred !== true ||
    v56Status.figmaWrites !== 4 ||
    v56Status.figmaCaptures !== 0 ||
    v56Status.createdNodesThenRemoved !== 2317 ||
    v56Status.attempt1Path !== V56_ATTEMPT_1_PATH ||
    v56Status.attempt1Sha256 !== V56_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V56_ATTEMPT_1_PATH)) !==
      V56_ATTEMPT_1_SHA256 ||
    v56Status.restartAsV56Attempt2WithoutRequiredIndicatorBindingCompileOrderForbidden !==
      true ||
    v56Status.overallInputSuccess !== false
  )
    failures.push("v56 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V57_ROOT}/protocol.json`)) !==
      V57_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V57_ROOT}/proof-plan.json`)) !==
      V57_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V57_ROOT}/capture-manifest.json`)) !==
      V57_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V57_ROOT}/request-manifest.json`)) !==
      V57_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V57_ROOT}/antecedent-index.json`)) !==
      V57_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V57_ROOT}/authorization-template.json`),
    ) !== V57_AUTHORIZATION_TEMPLATE_SHA256 ||
    v57Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v57.ts" ||
    v57Protocol.hostNormalization?.taughtRequiredIndicatorBindingCompileOrder !==
      true ||
    v57Protocol.hostNormalization?.taughtRequiredIndicatorBindingExtrasDropped !==
      true ||
    v57Protocol.hostNormalization?.taughtTrailingSlotBindingCompileOrder !==
      true ||
    v57Protocol.hostNormalization?.v56SceneReadbackUnchanged !== true ||
    v57Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v57Protocol.execution?.remoteRequests !== 133 ||
    v57Index.hashSetSha256 !== V57_HASH_SET_SHA256 ||
    v57Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v57Status.artifactVersion !== "input-live-v57-status-v1" ||
    v57Status.status !== V57_STATUS ||
    v57Status.baseCommit !== V57_BASE_COMMIT ||
    v57Status.antecedent?.commit !== V57_ANTECEDENT_COMMIT ||
    v57Status.authorization?.present !== true ||
    v57Status.authorization?.commitStateDerivedByHistory !== true ||
    v57Status.authorization?.effective !== false ||
    v57Status.authorization?.path !== V57_AUTHORIZATION_PATH ||
    v57Status.authorization?.sha256 !== V57_AUTHORIZATION_SHA256 ||
    v57Status.authorization?.signingPublicKeySpkiSha256 !==
      V57_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V57_AUTHORIZATION_PATH)) !==
      V57_AUTHORIZATION_SHA256 ||
    v57Status.authorization?.v56AuthorizationReusable !== false ||
    v57Status.smallestHonestDelta?.taughtRequiredIndicatorBindingCompileOrder !==
      true ||
    v57Status.smallestHonestDelta?.taughtRequiredIndicatorBindingExtrasDropped !==
      true ||
    v57Status.smallestHonestDelta?.v56SceneReadbackUnchanged !== true ||
    v57Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v57Status.attemptsExecuted !== 1 ||
    v57Status.nextAttempt !== 2 ||
    v57Status.liveExecutionOccurred !== true ||
    v57Status.figmaWrites !== 4 ||
    v57Status.figmaCaptures !== 0 ||
    v57Status.createdNodesThenRemoved !== 2317 ||
    v57Status.attempt1Path !== V57_ATTEMPT_1_PATH ||
    v57Status.attempt1Sha256 !== V57_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V57_ATTEMPT_1_PATH)) !==
      V57_ATTEMPT_1_SHA256 ||
    v57Status.restartAsV57Attempt2WithoutRequiredIndicatorLetterSpacingOmitForbidden !==
      true ||
    v57Status.overallInputSuccess !== false
  )
    failures.push("v57 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V58_ROOT}/protocol.json`)) !==
      V58_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V58_ROOT}/proof-plan.json`)) !==
      V58_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V58_ROOT}/capture-manifest.json`)) !==
      V58_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V58_ROOT}/request-manifest.json`)) !==
      V58_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V58_ROOT}/antecedent-index.json`)) !==
      V58_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V58_ROOT}/authorization-template.json`),
    ) !== V58_AUTHORIZATION_TEMPLATE_SHA256 ||
    v58Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v58.ts" ||
    v58Protocol.hostNormalization?.taughtRequiredIndicatorLetterSpacingOmitted !==
      true ||
    v58Protocol.hostNormalization?.taughtRequiredIndicatorBindingCompileOrder !==
      true ||
    v58Protocol.hostNormalization?.taughtRequiredIndicatorBindingExtrasDropped !==
      true ||
    v58Protocol.hostNormalization?.v57SceneReadbackUnchanged !== true ||
    v58Protocol.hostNormalization?.v16ExtractBytesUnchanged !== true ||
    v58Protocol.execution?.remoteRequests !== 133 ||
    v58Index.hashSetSha256 !== V58_HASH_SET_SHA256 ||
    v58Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v58Status.artifactVersion !== "input-live-v58-status-v1" ||
    v58Status.status !== V58_STATUS ||
    v58Status.baseCommit !== V58_BASE_COMMIT ||
    v58Status.antecedent?.commit !== V58_ANTECEDENT_COMMIT ||
    v58Status.authorization?.present !== true ||
    v58Status.authorization?.commitStateDerivedByHistory !== true ||
    v58Status.authorization?.effective !== false ||
    v58Status.authorization?.path !== V58_AUTHORIZATION_PATH ||
    v58Status.authorization?.sha256 !== V58_AUTHORIZATION_SHA256 ||
    v58Status.authorization?.signingPublicKeySpkiSha256 !==
      V58_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V58_AUTHORIZATION_PATH)) !==
      V58_AUTHORIZATION_SHA256 ||
    v58Status.smallestHonestDelta?.taughtRequiredIndicatorLetterSpacingOmitted !==
      true ||
    v58Status.smallestHonestDelta?.taughtRequiredIndicatorBindingCompileOrder !==
      true ||
    v58Status.smallestHonestDelta?.v57SceneReadbackUnchanged !== true ||
    v58Status.smallestHonestDelta?.v16ExtractBytesUnchanged !== true ||
    v58Status.attemptsExecuted !== 1 ||
    v58Status.nextAttempt !== 2 ||
    v58Status.liveExecutionOccurred !== true ||
    v58Status.figmaWrites !== 4 ||
    v58Status.figmaCaptures !== 0 ||
    v58Status.createdNodesThenRemoved !== 2317 ||
    v58Status.attempt1Path !== V58_ATTEMPT_1_PATH ||
    v58Status.attempt1Sha256 !== V58_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V58_ATTEMPT_1_PATH)) !==
      V58_ATTEMPT_1_SHA256 ||
    v58Status.restartAsV58Attempt2WithoutRequiredIndicatorTextCaseOmitForbidden !==
      true ||
    v58Status.overallInputSuccess !== false
  )
    failures.push("v58 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V59_ROOT}/protocol.json`)) !==
      V59_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V59_ROOT}/proof-plan.json`)) !==
      V59_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V59_ROOT}/capture-manifest.json`)) !==
      V59_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V59_ROOT}/request-manifest.json`)) !==
      V59_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V59_ROOT}/antecedent-index.json`)) !==
      V59_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V59_ROOT}/authorization-template.json`),
    ) !== V59_AUTHORIZATION_TEMPLATE_SHA256 ||
    v59Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v59.ts" ||
    v59Protocol.hostNormalization?.taughtRequiredIndicatorTextCaseOmitted !==
      true ||
    v59Protocol.hostNormalization?.v58SceneReadbackUnchanged !== true ||
    v59Index.hashSetSha256 !== V59_HASH_SET_SHA256 ||
    v59Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v59Status.artifactVersion !== "input-live-v59-status-v1" ||
    v59Status.status !== V59_STATUS ||
    v59Status.baseCommit !== V59_BASE_COMMIT ||
    v59Status.antecedent?.commit !== V59_ANTECEDENT_COMMIT ||
    v59Status.authorization?.present !== true ||
    v59Status.authorization?.commitStateDerivedByHistory !== true ||
    v59Status.authorization?.effective !== false ||
    v59Status.authorization?.path !== V59_AUTHORIZATION_PATH ||
    v59Status.authorization?.sha256 !== V59_AUTHORIZATION_SHA256 ||
    v59Status.authorization?.signingPublicKeySpkiSha256 !==
      V59_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V59_AUTHORIZATION_PATH)) !==
      V59_AUTHORIZATION_SHA256 ||
    v59Status.smallestHonestDelta?.taughtRequiredIndicatorTextCaseOmitted !==
      true ||
    v59Status.smallestHonestDelta?.v58SceneReadbackUnchanged !== true ||
    v59Status.attemptsExecuted !== 1 ||
    v59Status.nextAttempt !== 2 ||
    v59Status.liveExecutionOccurred !== true ||
    v59Status.figmaWrites !== 4 ||
    v59Status.figmaCaptures !== 0 ||
    v59Status.createdNodesThenRemoved !== 2317 ||
    v59Status.attempt1Path !== V59_ATTEMPT_1_PATH ||
    v59Status.attempt1Sha256 !== V59_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V59_ATTEMPT_1_PATH)) !==
      V59_ATTEMPT_1_SHA256 ||
    v59Status.restartAsV59Attempt2WithoutRequiredIndicatorTextDecorationOmitForbidden !==
      true ||
    v59Status.overallInputSuccess !== false
  )
    failures.push("v59 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V60_ROOT}/protocol.json`)) !==
      V60_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V60_ROOT}/proof-plan.json`)) !==
      V60_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V60_ROOT}/capture-manifest.json`)) !==
      V60_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V60_ROOT}/request-manifest.json`)) !==
      V60_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V60_ROOT}/antecedent-index.json`)) !==
      V60_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V60_ROOT}/authorization-template.json`),
    ) !== V60_AUTHORIZATION_TEMPLATE_SHA256 ||
    v60Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v60.ts" ||
    v60Protocol.hostNormalization?.taughtRequiredIndicatorTextDecorationOmitted !==
      true ||
    v60Protocol.hostNormalization?.v59SceneReadbackUnchanged !== true ||
    v60Index.hashSetSha256 !== V60_HASH_SET_SHA256 ||
    v60Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v60Status.artifactVersion !== "input-live-v60-status-v1" ||
    v60Status.status !== V60_STATUS ||
    v60Status.baseCommit !== V60_BASE_COMMIT ||
    v60Status.antecedent?.commit !== V60_ANTECEDENT_COMMIT ||
    v60Status.authorization?.present !== true ||
    v60Status.authorization?.commitStateDerivedByHistory !== true ||
    v60Status.authorization?.effective !== false ||
    v60Status.authorization?.path !== V60_AUTHORIZATION_PATH ||
    v60Status.authorization?.sha256 !== V60_AUTHORIZATION_SHA256 ||
    v60Status.authorization?.signingPublicKeySpkiSha256 !==
      V60_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V60_AUTHORIZATION_PATH)) !==
      V60_AUTHORIZATION_SHA256 ||
    v60Status.smallestHonestDelta?.taughtRequiredIndicatorTextDecorationOmitted !==
      true ||
    v60Status.smallestHonestDelta?.v59SceneReadbackUnchanged !== true ||
    v60Status.attemptsExecuted !== 1 ||
    v60Status.nextAttempt !== 2 ||
    v60Status.liveExecutionOccurred !== true ||
    v60Status.figmaWrites !== 4 ||
    v60Status.figmaCaptures !== 0 ||
    v60Status.createdNodesThenRemoved !== 2317 ||
    v60Status.attempt1Path !== V60_ATTEMPT_1_PATH ||
    v60Status.attempt1Sha256 !== V60_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V60_ATTEMPT_1_PATH)) !==
      V60_ATTEMPT_1_SHA256 ||
    v60Status.restartAsV60Attempt2WithoutSetCornerRadiusOmitForbidden !==
      true ||
    v60Status.overallInputSuccess !== false
  )
    failures.push("v60 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V61_ROOT}/protocol.json`)) !==
      V61_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V61_ROOT}/proof-plan.json`)) !==
      V61_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V61_ROOT}/capture-manifest.json`)) !==
      V61_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V61_ROOT}/request-manifest.json`)) !==
      V61_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V61_ROOT}/antecedent-index.json`)) !==
      V61_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V61_ROOT}/authorization-template.json`),
    ) !== V61_AUTHORIZATION_TEMPLATE_SHA256 ||
    v61Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v61.ts" ||
    v61Protocol.hostNormalization?.taughtSetCornerRadiusOmitted !== true ||
    v61Protocol.hostNormalization?.v60SceneReadbackUnchanged !== true ||
    v61Index.hashSetSha256 !== V61_HASH_SET_SHA256 ||
    v61Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v61Status.artifactVersion !== "input-live-v61-status-v1" ||
    v61Status.status !== V61_STATUS ||
    v61Status.baseCommit !== V61_BASE_COMMIT ||
    v61Status.antecedent?.commit !== V61_ANTECEDENT_COMMIT ||
    v61Status.authorization?.present !== true ||
    v61Status.authorization?.commitStateDerivedByHistory !== true ||
    v61Status.authorization?.effective !== false ||
    v61Status.authorization?.path !== V61_AUTHORIZATION_PATH ||
    v61Status.authorization?.sha256 !== V61_AUTHORIZATION_SHA256 ||
    v61Status.authorization?.signingPublicKeySpkiSha256 !==
      V61_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V61_AUTHORIZATION_PATH)) !==
      V61_AUTHORIZATION_SHA256 ||
    v61Status.smallestHonestDelta?.taughtSetCornerRadiusOmitted !== true ||
    v61Status.smallestHonestDelta?.v60SceneReadbackUnchanged !== true ||
    v61Status.attemptsExecuted !== 1 ||
    v61Status.nextAttempt !== 2 ||
    v61Status.liveExecutionOccurred !== true ||
    v61Status.figmaWrites !== 4 ||
    v61Status.figmaCaptures !== 0 ||
    v61Status.createdNodesThenRemoved !== 2317 ||
    v61Status.attempt1Path !== V61_ATTEMPT_1_PATH ||
    v61Status.attempt1Sha256 !== V61_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V61_ATTEMPT_1_PATH)) !==
      V61_ATTEMPT_1_SHA256 ||
    v61Status.restartAsV61Attempt2WithoutSetEffectsOmitForbidden !==
      true ||
    v61Status.overallInputSuccess !== false
  )
    failures.push("v61 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V62_ROOT}/protocol.json`)) !==
      V62_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V62_ROOT}/proof-plan.json`)) !==
      V62_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V62_ROOT}/capture-manifest.json`)) !==
      V62_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V62_ROOT}/request-manifest.json`)) !==
      V62_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V62_ROOT}/antecedent-index.json`)) !==
      V62_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V62_ROOT}/authorization-template.json`),
    ) !== V62_AUTHORIZATION_TEMPLATE_SHA256 ||
    v62Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v62.ts" ||
    v62Protocol.hostNormalization?.taughtSetEffectsOmitted !== true ||
    v62Protocol.hostNormalization?.v61SceneReadbackUnchanged !== true ||
    v62Index.hashSetSha256 !== V62_HASH_SET_SHA256 ||
    v62Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v62Status.artifactVersion !== "input-live-v62-status-v1" ||
    v62Status.status !== V62_STATUS ||
    v62Status.baseCommit !== V62_BASE_COMMIT ||
    v62Status.antecedent?.commit !== V62_ANTECEDENT_COMMIT ||
    v62Status.authorization?.present !== true ||
    v62Status.authorization?.commitStateDerivedByHistory !== true ||
    v62Status.authorization?.effective !== false ||
    v62Status.authorization?.path !== V62_AUTHORIZATION_PATH ||
    v62Status.authorization?.sha256 !== V62_AUTHORIZATION_SHA256 ||
    v62Status.authorization?.signingPublicKeySpkiSha256 !==
      V62_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V62_AUTHORIZATION_PATH)) !==
      V62_AUTHORIZATION_SHA256 ||
    v62Status.smallestHonestDelta?.taughtSetEffectsOmitted !== true ||
    v62Status.smallestHonestDelta?.v61SceneReadbackUnchanged !== true ||
    v62Status.attemptsExecuted !== 1 ||
    v62Status.nextAttempt !== 2 ||
    v62Status.liveExecutionOccurred !== true ||
    v62Status.figmaWrites !== 4 ||
    v62Status.figmaCaptures !== 0 ||
    v62Status.createdNodesThenRemoved !== 2317 ||
    v62Status.attempt1Path !== V62_ATTEMPT_1_PATH ||
    v62Status.attempt1Sha256 !== V62_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V62_ATTEMPT_1_PATH)) !==
      V62_ATTEMPT_1_SHA256 ||
    v62Status.restartAsV62Attempt2WithoutSetFillsOmitForbidden !==
      true ||
    v62Status.overallInputSuccess !== false
  )
    failures.push("v62 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V63_ROOT}/protocol.json`)) !==
      V63_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V63_ROOT}/proof-plan.json`)) !==
      V63_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V63_ROOT}/capture-manifest.json`)) !==
      V63_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V63_ROOT}/request-manifest.json`)) !==
      V63_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V63_ROOT}/antecedent-index.json`)) !==
      V63_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V63_ROOT}/authorization-template.json`),
    ) !== V63_AUTHORIZATION_TEMPLATE_SHA256 ||
    v63Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v63.ts" ||
    v63Protocol.hostNormalization?.taughtSetFillsOmitted !== true ||
    v63Protocol.hostNormalization?.v62SceneReadbackUnchanged !== true ||
    v63Index.hashSetSha256 !== V63_HASH_SET_SHA256 ||
    v63Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v63Status.artifactVersion !== "input-live-v63-status-v1" ||
    v63Status.status !== V63_STATUS ||
    v63Status.baseCommit !== V63_BASE_COMMIT ||
    v63Status.antecedent?.commit !== V63_ANTECEDENT_COMMIT ||
    v63Status.authorization?.present !== true ||
    v63Status.authorization?.commitStateDerivedByHistory !== true ||
    v63Status.authorization?.effective !== false ||
    v63Status.authorization?.path !== V63_AUTHORIZATION_PATH ||
    v63Status.authorization?.sha256 !== V63_AUTHORIZATION_SHA256 ||
    v63Status.authorization?.signingPublicKeySpkiSha256 !==
      V63_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V63_AUTHORIZATION_PATH)) !==
      V63_AUTHORIZATION_SHA256 ||
    v63Status.smallestHonestDelta?.taughtSetFillsOmitted !== true ||
    v63Status.smallestHonestDelta?.v62SceneReadbackUnchanged !== true ||
    v63Status.attemptsExecuted !== 1 ||
    v63Status.nextAttempt !== 2 ||
    v63Status.liveExecutionOccurred !== true ||
    v63Status.figmaWrites !== 4 ||
    v63Status.figmaCaptures !== 0 ||
    v63Status.createdNodesThenRemoved !== 2317 ||
    v63Status.attempt1Path !== V63_ATTEMPT_1_PATH ||
    v63Status.attempt1Sha256 !== V63_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V63_ATTEMPT_1_PATH)) !==
      V63_ATTEMPT_1_SHA256 ||
    v63Status.restartAsV63Attempt2WithoutSetLayoutModeRewriteForbidden !==
      true ||
    v63Status.overallInputSuccess !== false
  )
    failures.push("v63 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V64_ROOT}/protocol.json`)) !==
      V64_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V64_ROOT}/proof-plan.json`)) !==
      V64_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V64_ROOT}/capture-manifest.json`)) !==
      V64_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V64_ROOT}/request-manifest.json`)) !==
      V64_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V64_ROOT}/antecedent-index.json`)) !==
      V64_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V64_ROOT}/authorization-template.json`),
    ) !== V64_AUTHORIZATION_TEMPLATE_SHA256 ||
    v64Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v64.ts" ||
    v64Protocol.hostNormalization?.taughtSetLayoutModeHorizontal !== true ||
    v64Protocol.hostNormalization?.v63SceneReadbackUnchanged !== true ||
    v64Index.hashSetSha256 !== V64_HASH_SET_SHA256 ||
    v64Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v64Status.artifactVersion !== "input-live-v64-status-v1" ||
    v64Status.status !== V64_STATUS ||
    v64Status.baseCommit !== V64_BASE_COMMIT ||
    v64Status.antecedent?.commit !== V64_ANTECEDENT_COMMIT ||
    v64Status.authorization?.present !== true ||
    v64Status.authorization?.commitStateDerivedByHistory !== true ||
    v64Status.authorization?.effective !== false ||
    v64Status.authorization?.path !== V64_AUTHORIZATION_PATH ||
    v64Status.authorization?.sha256 !== V64_AUTHORIZATION_SHA256 ||
    v64Status.authorization?.signingPublicKeySpkiSha256 !==
      V64_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V64_AUTHORIZATION_PATH)) !==
      V64_AUTHORIZATION_SHA256 ||
    v64Status.smallestHonestDelta?.taughtSetLayoutModeHorizontal !== true ||
    v64Status.smallestHonestDelta?.v63SceneReadbackUnchanged !== true ||
    v64Status.attemptsExecuted !== 1 ||
    v64Status.nextAttempt !== 2 ||
    v64Status.liveExecutionOccurred !== true ||
    v64Status.figmaWrites !== 4 ||
    v64Status.figmaCaptures !== 0 ||
    v64Status.createdNodesThenRemoved !== 2317 ||
    v64Status.attempt1Path !== V64_ATTEMPT_1_PATH ||
    v64Status.attempt1Sha256 !== V64_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V64_ATTEMPT_1_PATH)) !==
      V64_ATTEMPT_1_SHA256 ||
    v64Status.restartAsV64Attempt2WithoutSetPaddingRewriteForbidden !==
      true ||
    v64Status.overallInputSuccess !== false
  )
    failures.push("v64 draft antecedent/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V65_ROOT}/protocol.json`)) !==
      V65_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V65_ROOT}/proof-plan.json`)) !==
      V65_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V65_ROOT}/capture-manifest.json`)) !==
      V65_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V65_ROOT}/request-manifest.json`)) !==
      V65_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V65_ROOT}/antecedent-index.json`)) !==
      V65_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V65_ROOT}/authorization-template.json`),
    ) !== V65_AUTHORIZATION_TEMPLATE_SHA256 ||
    v65Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v65.ts" ||
    v65Protocol.hostNormalization?.taughtSetLayoutPadding32 !== true ||
    v65Protocol.hostNormalization?.v64SceneReadbackUnchanged !== true ||
    v65Index.hashSetSha256 !== V65_HASH_SET_SHA256 ||
    v65Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v65Status.artifactVersion !== "input-live-v65-status-v1" ||
    v65Status.status !== V65_STATUS ||
    v65Status.baseCommit !== V65_BASE_COMMIT ||
    v65Status.antecedent?.commit !== V65_ANTECEDENT_COMMIT ||
    v65Status.authorization?.present !== true ||
    v65Status.authorization?.commitStateDerivedByHistory !== true ||
    v65Status.authorization?.effective !== false ||
    v65Status.authorization?.path !== V65_AUTHORIZATION_PATH ||
    v65Status.authorization?.sha256 !== V65_AUTHORIZATION_SHA256 ||
    v65Status.authorization?.signingPublicKeySpkiSha256 !==
      V65_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V65_AUTHORIZATION_PATH)) !==
      V65_AUTHORIZATION_SHA256 ||
    v65Status.smallestHonestDelta?.taughtSetLayoutPadding32 !== true ||
    v65Status.smallestHonestDelta?.v64SceneReadbackUnchanged !== true ||
    v65Status.attemptsExecuted !== 1 ||
    v65Status.nextAttempt !== 2 ||
    v65Status.liveExecutionOccurred !== true ||
    v65Status.figmaWrites !== 4 ||
    v65Status.figmaCaptures !== 0 ||
    v65Status.createdNodesThenRemoved !== 2317 ||
    v65Status.attempt1Path !== V65_ATTEMPT_1_PATH ||
    v65Status.attempt1Sha256 !== V65_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V65_ATTEMPT_1_PATH)) !==
      V65_ATTEMPT_1_SHA256 ||
    v65Status.restartAsV65Attempt2WithoutWriterSetHugForbidden !==
      true ||
    v65Status.overallInputSuccess !== false
  )
    failures.push("v65 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V66_ROOT}/protocol.json`)) !==
      V66_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V66_ROOT}/proof-plan.json`)) !==
      V66_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V66_ROOT}/capture-manifest.json`)) !==
      V66_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V66_ROOT}/request-manifest.json`)) !==
      V66_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V66_ROOT}/antecedent-index.json`)) !==
      V66_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V66_ROOT}/authorization-template.json`),
    ) !== V66_AUTHORIZATION_TEMPLATE_SHA256 ||
    v66Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v66.ts" ||
    v66Protocol.hostNormalization?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v66Protocol.hostNormalization?.v65SceneReadbackUnchanged !== true ||
    v66Protocol.hostNormalization?.v17WriterMinted !== true ||
    v66Index.hashSetSha256 !== V66_HASH_SET_SHA256 ||
    v66Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v66Status.artifactVersion !== "input-live-v66-status-v1" ||
    v66Status.status !== V66_STATUS ||
    v66Status.baseCommit !== V66_BASE_COMMIT ||
    v66Status.antecedent?.commit !== V66_ANTECEDENT_COMMIT ||
    v66Status.authorization?.present !== true ||
    v66Status.authorization?.commitStateDerivedByHistory !== true ||
    v66Status.authorization?.effective !== false ||
    v66Status.authorization?.path !== V66_AUTHORIZATION_PATH ||
    v66Status.authorization?.sha256 !== V66_AUTHORIZATION_SHA256 ||
    v66Status.authorization?.signingPublicKeySpkiSha256 !==
      V66_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V66_AUTHORIZATION_PATH)) !==
      V66_AUTHORIZATION_SHA256 ||
    v66Status.smallestHonestDelta?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v66Status.smallestHonestDelta?.v65SceneReadbackUnchanged !== true ||
    v66Status.attemptsExecuted !== 1 ||
    v66Status.nextAttempt !== 2 ||
    v66Status.liveExecutionOccurred !== true ||
    v66Status.figmaWrites !== 4 ||
    v66Status.figmaCaptures !== 0 ||
    v66Status.createdNodesThenRemoved !== 2317 ||
    v66Status.attempt1Path !== V66_ATTEMPT_1_PATH ||
    v66Status.attempt1Sha256 !== V66_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V66_ATTEMPT_1_PATH)) !==
      V66_ATTEMPT_1_SHA256 ||
    v66Status.restartAsV66Attempt2WithoutSetStrokesOmitForbidden !==
      true ||
    v66Status.overallInputSuccess !== false
  )
    failures.push("v66 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V67_ROOT}/protocol.json`)) !==
      V67_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V67_ROOT}/proof-plan.json`)) !==
      V67_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V67_ROOT}/capture-manifest.json`)) !==
      V67_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V67_ROOT}/request-manifest.json`)) !==
      V67_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V67_ROOT}/antecedent-index.json`)) !==
      V67_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V67_ROOT}/authorization-template.json`),
    ) !== V67_AUTHORIZATION_TEMPLATE_SHA256 ||
    v67Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v67.ts" ||
    v67Protocol.hostNormalization?.taughtSetStrokesOmitted !== true ||
    v67Protocol.hostNormalization?.v66SceneReadbackUnchanged !== true ||
    v67Protocol.hostNormalization?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v67Index.hashSetSha256 !== V67_HASH_SET_SHA256 ||
    v67Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v67Status.artifactVersion !== "input-live-v67-status-v1" ||
    v67Status.status !== V67_STATUS ||
    v67Status.baseCommit !== V67_BASE_COMMIT ||
    v67Status.antecedent?.commit !== V67_ANTECEDENT_COMMIT ||
    v67Status.authorization?.present !== true ||
    v67Status.authorization?.commitStateDerivedByHistory !== true ||
    v67Status.authorization?.effective !== false ||
    v67Status.authorization?.path !== V67_AUTHORIZATION_PATH ||
    v67Status.authorization?.sha256 !== V67_AUTHORIZATION_SHA256 ||
    v67Status.authorization?.signingPublicKeySpkiSha256 !==
      V67_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V67_AUTHORIZATION_PATH)) !==
      V67_AUTHORIZATION_SHA256 ||
    v67Status.smallestHonestDelta?.taughtSetStrokesOmitted !== true ||
    v67Status.smallestHonestDelta?.v66SceneReadbackUnchanged !== true ||
    v67Status.attemptsExecuted !== 1 ||
    v67Status.nextAttempt !== 2 ||
    v67Status.liveExecutionOccurred !== true ||
    v67Status.figmaWrites !== 4 ||
    v67Status.figmaCaptures !== 0 ||
    v67Status.createdNodesThenRemoved !== 2317 ||
    v67Status.attempt1Path !== V67_ATTEMPT_1_PATH ||
    v67Status.attempt1Sha256 !== V67_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V67_ATTEMPT_1_PATH)) !==
      V67_ATTEMPT_1_SHA256 ||
    v67Status.restartAsV67Attempt2WithoutLabelRowBindingOrderForbidden !==
      true ||
    v67Status.overallInputSuccess !== false
  )
    failures.push("v67 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V68_ROOT}/protocol.json`)) !==
      V68_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V68_ROOT}/proof-plan.json`)) !==
      V68_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V68_ROOT}/capture-manifest.json`)) !==
      V68_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V68_ROOT}/request-manifest.json`)) !==
      V68_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V68_ROOT}/antecedent-index.json`)) !==
      V68_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V68_ROOT}/authorization-template.json`),
    ) !== V68_AUTHORIZATION_TEMPLATE_SHA256 ||
    v68Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v68.ts" ||
    v68Protocol.hostNormalization?.taughtLabelRowBindingCompileOrder !==
      true ||
    v68Protocol.hostNormalization?.v67SceneReadbackUnchanged !== true ||
    v68Protocol.hostNormalization?.taughtSetStrokesOmitted !== true ||
    v68Protocol.hostNormalization?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v68Index.hashSetSha256 !== V68_HASH_SET_SHA256 ||
    v68Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v68Status.artifactVersion !== "input-live-v68-status-v1" ||
    v68Status.status !== V68_STATUS ||
    v68Status.baseCommit !== V68_BASE_COMMIT ||
    v68Status.antecedent?.commit !== V68_ANTECEDENT_COMMIT ||
    v68Status.authorization?.present !== true ||
    v68Status.authorization?.commitStateDerivedByHistory !== true ||
    v68Status.authorization?.effective !== false ||
    v68Status.authorization?.path !== V68_AUTHORIZATION_PATH ||
    v68Status.authorization?.sha256 !== V68_AUTHORIZATION_SHA256 ||
    v68Status.authorization?.signingPublicKeySpkiSha256 !==
      V68_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V68_AUTHORIZATION_PATH)) !==
      V68_AUTHORIZATION_SHA256 ||
    v68Status.smallestHonestDelta?.taughtLabelRowBindingCompileOrder !==
      true ||
    v68Status.smallestHonestDelta?.v67SceneReadbackUnchanged !== true ||
    v68Status.smallestHonestDelta?.taughtSetStrokesOmitted !== true ||
    v68Status.attemptsExecuted !== 1 ||
    v68Status.nextAttempt !== 2 ||
    v68Status.liveExecutionOccurred !== true ||
    v68Status.figmaWrites !== 4 ||
    v68Status.figmaCaptures !== 0 ||
    v68Status.createdNodesThenRemoved !== 2317 ||
    v68Status.attempt1Path !== V68_ATTEMPT_1_PATH ||
    v68Status.attempt1Sha256 !== V68_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V68_ATTEMPT_1_PATH)) !==
      V68_ATTEMPT_1_SHA256 ||
    v68Status.restartAsV68Attempt2WithoutPolarSurfaceBindingOrderForbidden !==
      true ||
    v68Status.overallInputSuccess !== false
  )
    failures.push("v68 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V69_ROOT}/protocol.json`)) !==
      V69_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V69_ROOT}/proof-plan.json`)) !==
      V69_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V69_ROOT}/capture-manifest.json`)) !==
      V69_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V69_ROOT}/request-manifest.json`)) !==
      V69_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V69_ROOT}/antecedent-index.json`)) !==
      V69_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V69_ROOT}/authorization-template.json`),
    ) !== V69_AUTHORIZATION_TEMPLATE_SHA256 ||
    v69Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v69.ts" ||
    v69Protocol.hostNormalization?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    v69Protocol.hostNormalization?.taughtLabelRowBindingCompileOrder !==
      true ||
    v69Protocol.hostNormalization?.v68SceneReadbackUnchanged !== true ||
    v69Protocol.hostNormalization?.taughtSetStrokesOmitted !== true ||
    v69Protocol.hostNormalization?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v69Index.hashSetSha256 !== V69_HASH_SET_SHA256 ||
    v69Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v69Status.artifactVersion !== "input-live-v69-status-v1" ||
    v69Status.status !== V69_STATUS ||
    v69Status.baseCommit !== V69_BASE_COMMIT ||
    v69Status.antecedent?.commit !== V69_ANTECEDENT_COMMIT ||
    v69Status.authorization?.present !== true ||
    v69Status.authorization?.commitStateDerivedByHistory !== true ||
    v69Status.authorization?.effective !== false ||
    v69Status.authorization?.path !== V69_AUTHORIZATION_PATH ||
    v69Status.authorization?.sha256 !== V69_AUTHORIZATION_SHA256 ||
    v69Status.authorization?.signingPublicKeySpkiSha256 !==
      V69_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V69_AUTHORIZATION_PATH)) !==
      V69_AUTHORIZATION_SHA256 ||
    v69Status.smallestHonestDelta?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    v69Status.smallestHonestDelta?.taughtLabelRowBindingCompileOrder !==
      true ||
    v69Status.smallestHonestDelta?.v68SceneReadbackUnchanged !== true ||
    v69Status.smallestHonestDelta?.taughtSetStrokesOmitted !== true ||
    v69Status.attemptsExecuted !== 1 ||
    v69Status.nextAttempt !== 2 ||
    v69Status.liveExecutionOccurred !== true ||
    v69Status.figmaWrites !== 4 ||
    v69Status.figmaCaptures !== 0 ||
    v69Status.createdNodesThenRemoved !== 2317 ||
    v69Status.attempt1Path !== V69_ATTEMPT_1_PATH ||
    v69Status.attempt1Sha256 !== V69_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V69_ATTEMPT_1_PATH)) !==
      V69_ATTEMPT_1_SHA256 ||
    v69Status.restartAsV69Attempt2WithoutAccountingFactValueDiagnosisForbidden !==
      true ||
    v69Status.overallInputSuccess !== false
  )
    failures.push("v69 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V70_ROOT}/protocol.json`)) !==
      V70_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V70_ROOT}/proof-plan.json`)) !==
      V70_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V70_ROOT}/capture-manifest.json`)) !==
      V70_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V70_ROOT}/request-manifest.json`)) !==
      V70_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V70_ROOT}/antecedent-index.json`)) !==
      V70_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V70_ROOT}/authorization-template.json`),
    ) !== V70_AUTHORIZATION_TEMPLATE_SHA256 ||
    v70Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v70.ts" ||
    v70Protocol.hostNormalization?.taughtFontProvenanceNameKeyOrder !==
      true ||
    v70Protocol.hostNormalization?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    v70Protocol.hostNormalization?.taughtLabelRowBindingCompileOrder !==
      true ||
    v70Protocol.hostNormalization?.v69SceneReadbackUnchanged !== true ||
    v70Protocol.hostNormalization?.taughtSetStrokesOmitted !== true ||
    v70Protocol.hostNormalization?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v70Index.hashSetSha256 !== V70_HASH_SET_SHA256 ||
    v70Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v70Status.artifactVersion !== "input-live-v70-status-v1" ||
    v70Status.status !== V70_STATUS ||
    v70Status.baseCommit !== V70_BASE_COMMIT ||
    v70Status.antecedent?.commit !== V70_ANTECEDENT_COMMIT ||
    v70Status.authorization?.present !== true ||
    v70Status.authorization?.commitStateDerivedByHistory !== true ||
    v70Status.authorization?.effective !== false ||
    v70Status.authorization?.path !== V70_AUTHORIZATION_PATH ||
    v70Status.authorization?.sha256 !== V70_AUTHORIZATION_SHA256 ||
    v70Status.authorization?.signingPublicKeySpkiSha256 !==
      V70_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V70_AUTHORIZATION_PATH)) !==
      V70_AUTHORIZATION_SHA256 ||
    v70Status.smallestHonestDelta?.taughtFontProvenanceNameKeyOrder !==
      true ||
    v70Status.smallestHonestDelta?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    v70Status.smallestHonestDelta?.taughtLabelRowBindingCompileOrder !==
      true ||
    v70Status.smallestHonestDelta?.v69SceneReadbackUnchanged !== true ||
    v70Status.smallestHonestDelta?.taughtSetStrokesOmitted !== true ||
    v70Status.attemptsExecuted !== 1 ||
    v70Status.nextAttempt !== 2 ||
    v70Status.liveExecutionOccurred !== true ||
    v70Status.figmaWrites !== 4 ||
    v70Status.figmaCaptures !== 0 ||
    v70Status.createdNodesThenRemoved !== 2317 ||
    v70Status.attempt1Path !== V70_ATTEMPT_1_PATH ||
    v70Status.attempt1Sha256 !== V70_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V70_ATTEMPT_1_PATH)) !==
      V70_ATTEMPT_1_SHA256 ||
    v70Status.restartAsV70Attempt2WithoutPolarValueDriftDiagnosisForbidden !==
      true ||
    v70Status.inventPolarPixelOrSpreadValuesForbidden !== true ||
    v70Status.v71FillDiscriminatorNotKindTypeOnlyOnBothLibraries !== true ||
    v70Status.overallInputSuccess !== false
  )
    failures.push("v70 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V71_ROOT}/protocol.json`)) !==
      V71_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V71_ROOT}/proof-plan.json`)) !==
      V71_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V71_ROOT}/capture-manifest.json`)) !==
      V71_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V71_ROOT}/request-manifest.json`)) !==
      V71_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V71_ROOT}/antecedent-index.json`)) !==
      V71_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V71_ROOT}/authorization-template.json`),
    ) !== V71_AUTHORIZATION_TEMPLATE_SHA256 ||
    v71Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v71.ts" ||
    v71Protocol.hostNormalization?.taughtInstancePayloadFillKind !== true ||
    v71Protocol.hostNormalization?.taughtFontProvenanceNameKeyOrder !==
      true ||
    v71Protocol.hostNormalization?.v70SceneReadbackUnchanged !== true ||
    v71Protocol.hostNormalization?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    v71Protocol.hostNormalization?.taughtLabelRowBindingCompileOrder !==
      true ||
    v71Protocol.hostNormalization?.taughtSetStrokesOmitted !== true ||
    v71Protocol.hostNormalization?.taughtSetLayoutSizingHorizontalHug !==
      true ||
    v71Index.hashSetSha256 !== V71_HASH_SET_SHA256 ||
    v71Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v71Status.artifactVersion !== "input-live-v71-status-v1" ||
    v71Status.status !== V71_STATUS ||
    v71Status.baseCommit !== V71_BASE_COMMIT ||
    v71Status.antecedent?.commit !== V71_ANTECEDENT_COMMIT ||
    v71Status.authorization?.present !== true ||
    v71Status.authorization?.commitStateDerivedByHistory !== true ||
    v71Status.authorization?.effective !== false ||
    v71Status.authorization?.path !== V71_AUTHORIZATION_PATH ||
    v71Status.authorization?.sha256 !== V71_AUTHORIZATION_SHA256 ||
    v71Status.authorization?.signingPublicKeySpkiSha256 !==
      V71_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V71_AUTHORIZATION_PATH)) !==
      V71_AUTHORIZATION_SHA256 ||
    v71Status.smallestHonestDelta?.taughtInstancePayloadFillKind !== true ||
    v71Status.smallestHonestDelta?.taughtFontProvenanceNameKeyOrder !==
      true ||
    v71Status.smallestHonestDelta?.v70SceneReadbackUnchanged !== true ||
    v71Status.smallestHonestDelta?.taughtSurfaceBindingItemSpacingCompileOrder !==
      true ||
    v71Status.smallestHonestDelta?.taughtLabelRowBindingCompileOrder !==
      true ||
    v71Status.smallestHonestDelta?.taughtSetStrokesOmitted !== true ||
    v71Status.attemptsExecuted !== 1 ||
    v71Status.liveExecutionOccurred !== true ||
    v71Status.figmaWrites !== 4 ||
    v71Status.attempt1Path !== V71_ATTEMPT_1_PATH ||
    v71Status.attempt1Sha256 !== V71_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V71_ATTEMPT_1_PATH)) !==
      V71_ATTEMPT_1_SHA256 ||
    v71Status.restartAsV71Attempt2WithoutSizeAxisOrderDiagnosisForbidden !==
      true ||
    v71Status.inventPolarPixelOrSpreadValuesForbidden !== true ||
    v71Status.v72SizeAxisOrderOnlyOnBothLibraries !== true ||
    v71Status.overallInputSuccess !== false
  )
    failures.push("v71 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V72_ROOT}/protocol.json`)) !==
      V72_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V72_ROOT}/proof-plan.json`)) !==
      V72_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V72_ROOT}/capture-manifest.json`)) !==
      V72_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V72_ROOT}/request-manifest.json`)) !==
      V72_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V72_ROOT}/antecedent-index.json`)) !==
      V72_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V72_ROOT}/authorization-template.json`),
    ) !== V72_AUTHORIZATION_TEMPLATE_SHA256 ||
    v72Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v72.ts" ||
    v72Protocol.hostNormalization?.taughtVariantAxisSizeOrder !== true ||
    v72Protocol.hostNormalization?.taughtInstancePayloadFillKind !== true ||
    v72Protocol.hostNormalization?.v71SceneReadbackUnchanged !== true ||
    v72Index.hashSetSha256 !== V72_HASH_SET_SHA256 ||
    v72Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v72Status.artifactVersion !== "input-live-v72-status-v1" ||
    v72Status.status !== V72_STATUS ||
    v72Status.baseCommit !== V72_BASE_COMMIT ||
    v72Status.antecedent?.commit !== V72_ANTECEDENT_COMMIT ||
    v72Status.authorization?.present !== true ||
    v72Status.authorization?.commitStateDerivedByHistory !== true ||
    v72Status.authorization?.effective !== false ||
    v72Status.authorization?.path !== V72_AUTHORIZATION_PATH ||
    v72Status.authorization?.sha256 !== V72_AUTHORIZATION_SHA256 ||
    v72Status.authorization?.signingPublicKeySpkiSha256 !==
      V72_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V72_AUTHORIZATION_PATH)) !==
      V72_AUTHORIZATION_SHA256 ||
    v72Status.smallestHonestDelta?.taughtVariantAxisSizeOrder !== true ||
    v72Status.smallestHonestDelta?.taughtInstancePayloadFillKind !== true ||
    v72Status.smallestHonestDelta?.v71SceneReadbackUnchanged !== true ||
    v72Status.attemptsExecuted !== 1 ||
    v72Status.liveExecutionOccurred !== true ||
    v72Status.figmaWrites !== 4 ||
    v72Status.attempt1Path !== V72_ATTEMPT_1_PATH ||
    v72Status.attempt1Sha256 !== V72_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V72_ATTEMPT_1_PATH)) !==
      V72_ATTEMPT_1_SHA256 ||
    v72Status.restartAsV72Attempt2WithoutPolarValueDriftDiagnosisForbidden !==
      true ||
    v72Status.inventPolarPixelOrSpreadValuesForbidden !== true ||
    v72Status.doNotOpenV73ForPolarWidthOrSpreadValues !== true ||
    v72Status.remainingPolarIntrinsicSizeWidthValueDrift !== true ||
    v72Status.remainingPolarEffectSpreadValueDrift !== true ||
    v72Status.polarWidthAndSpreadNamedRequiredFacts !== true ||
    v72Status.v73ClassificationRequiredCompareDropForbidden !== true ||
    v72Status.muiSilentZeroBecauseExtractMatchesExpected !== true ||
    v72Status.writerV17AskedPolar8And2578125AndSpread1And3 !== true ||
    v72Status.extractV72PolarLeading9Trailing30FocusSpread0 !== true ||
    v72Status.v73NotOpened !== true ||
    v72Status.overallInputSuccess !== false
  )
    failures.push("v72 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V73_ROOT}/protocol.json`)) !==
      V73_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V73_ROOT}/proof-plan.json`)) !==
      V73_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V73_ROOT}/capture-manifest.json`)) !==
      V73_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V73_ROOT}/request-manifest.json`)) !==
      V73_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V73_ROOT}/antecedent-index.json`)) !==
      V73_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V73_ROOT}/authorization-template.json`),
    ) !== V73_AUTHORIZATION_TEMPLATE_SHA256 ||
    v73Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v73.ts" ||
    v73Protocol.hostNormalization
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v73Protocol.hostNormalization?.taughtVariantAxisSizeOrder !== true ||
    v73Protocol.hostNormalization?.taughtInstancePayloadFillKind !== true ||
    v73Protocol.hostNormalization?.v72SceneReadbackUnchanged !== true ||
    v73Index.hashSetSha256 !== V73_HASH_SET_SHA256 ||
    v73Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v73Status.artifactVersion !== "input-live-v73-status-v1" ||
    v73Status.status !== V73_STATUS ||
    v73Status.baseCommit !== V73_BASE_COMMIT ||
    v73Status.antecedent?.commit !== V73_ANTECEDENT_COMMIT ||
    v73Status.authorization?.present !== true ||
    v73Status.authorization?.commitStateDerivedByHistory !== true ||
    v73Status.authorization?.effective !== false ||
    v73Status.authorization?.path !== V73_AUTHORIZATION_PATH ||
    v73Status.authorization?.sha256 !== V73_AUTHORIZATION_SHA256 ||
    v73Status.authorization?.signingPublicKeySpkiSha256 !==
      V73_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V73_AUTHORIZATION_PATH)) !==
      V73_AUTHORIZATION_SHA256 ||
    v73Status.smallestHonestDelta
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v73Status.smallestHonestDelta?.taughtVariantAxisSizeOrder !== true ||
    v73Status.smallestHonestDelta?.v72SceneReadbackUnchanged !== true ||
    v73Status.attemptsExecuted !== 1 ||
    v73Status.liveExecutionOccurred !== true ||
    v73Status.figmaWrites !== 5 ||
    v73Status.attempt1Path !== V73_ATTEMPT_1_PATH ||
    v73Status.attempt1Sha256 !== V73_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V73_ATTEMPT_1_PATH)) !==
      V73_ATTEMPT_1_SHA256 ||
    v73Status.restartAsV73Attempt2WithoutProbeDiagnosisForbidden !== true ||
    v73Status.unnamedSourcePxCarriedTeachingHeld !== true ||
    v73Status.accountingSilentZeroBoth !== true ||
    v73Status.mintCleaned !== true ||
    v73Status.mintStayed !== false ||
    v73Status.doNotClaimV1Complete !== true ||
    v73Status.overallInputSuccess !== false
  )
    failures.push("v73 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V74_ROOT}/protocol.json`)) !==
      V74_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V74_ROOT}/proof-plan.json`)) !==
      V74_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V74_ROOT}/capture-manifest.json`)) !==
      V74_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V74_ROOT}/request-manifest.json`)) !==
      V74_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V74_ROOT}/antecedent-index.json`)) !==
      V74_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V74_ROOT}/authorization-template.json`),
    ) !== V74_AUTHORIZATION_TEMPLATE_SHA256 ||
    v74Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v74.ts" ||
    v74Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v74Protocol.hostNormalization
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v74Protocol.hostNormalization?.v73SceneReadbackUnchanged !== true ||
    v74Index.hashSetSha256 !== V74_HASH_SET_SHA256 ||
    v74Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v74Status.artifactVersion !== "input-live-v74-status-v1" ||
    v74Status.status !== V74_STATUS ||
    v74Status.baseCommit !== V74_BASE_COMMIT ||
    v74Status.antecedent?.commit !== V74_ANTECEDENT_COMMIT ||
    v74Status.authorization?.present !== true ||
    v74Status.authorization?.commitStateDerivedByHistory !== true ||
    v74Status.authorization?.effective !== false ||
    v74Status.authorization?.path !== V74_AUTHORIZATION_PATH ||
    v74Status.authorization?.sha256 !== V74_AUTHORIZATION_SHA256 ||
    v74Status.authorization?.signingPublicKeySpkiSha256 !==
      V74_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V74_AUTHORIZATION_PATH)) !==
      V74_AUTHORIZATION_SHA256 ||
    v74Status.smallestHonestDelta?.taughtProbeFirstSegmentRole !== true ||
    v74Status.smallestHonestDelta
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v74Status.smallestHonestDelta?.v73SceneReadbackUnchanged !== true ||
    v74Status.attemptsExecuted !== 1 ||
    v74Status.liveExecutionOccurred !== true ||
    v74Status.figmaWrites !== 5 ||
    v74Status.attempt1Path !== V74_ATTEMPT_1_PATH ||
    v74Status.attempt1Sha256 !== V74_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V74_ATTEMPT_1_PATH)) !==
      V74_ATTEMPT_1_SHA256 ||
    v74Status.restartAsV74Attempt2WithoutRemainingProbeDiagnosisForbidden !==
      true ||
    v74Status.taughtProbeFirstSegmentRoleHeld !== true ||
    v74Status.accountingSilentZeroBoth !== true ||
    v74Status.mintCleaned !== true ||
    v74Status.mintStayed !== false ||
    v74Status.doNotClaimV1Complete !== true ||
    v74Status.overallInputSuccess !== false
  )
    failures.push("v74 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V75_ROOT}/protocol.json`)) !==
      V75_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V75_ROOT}/proof-plan.json`)) !==
      V75_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V75_ROOT}/capture-manifest.json`)) !==
      V75_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V75_ROOT}/request-manifest.json`)) !==
      V75_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V75_ROOT}/antecedent-index.json`)) !==
      V75_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V75_ROOT}/authorization-template.json`),
    ) !== V75_AUTHORIZATION_TEMPLATE_SHA256 ||
    v75Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v75.ts" ||
    v75Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v75Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v75Protocol.hostNormalization
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v75Protocol.hostNormalization?.v74SceneReadbackUnchanged !== true ||
    v75Index.hashSetSha256 !== V75_HASH_SET_SHA256 ||
    v75Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v75Status.artifactVersion !== "input-live-v75-status-v1" ||
    v75Status.status !== V75_STATUS ||
    v75Status.baseCommit !== V75_BASE_COMMIT ||
    v75Status.antecedent?.commit !== V75_ANTECEDENT_COMMIT ||
    v75Status.authorization?.present !== true ||
    v75Status.authorization?.commitStateDerivedByHistory !== true ||
    v75Status.authorization?.effective !== false ||
    v75Status.authorization?.path !== V75_AUTHORIZATION_PATH ||
    v75Status.authorization?.sha256 !== V75_AUTHORIZATION_SHA256 ||
    v75Status.authorization?.signingPublicKeySpkiSha256 !==
      V75_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V75_AUTHORIZATION_PATH)) !==
      V75_AUTHORIZATION_SHA256 ||
    v75Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v75Status.smallestHonestDelta?.taughtProbeFirstSegmentRole !== true ||
    v75Status.smallestHonestDelta
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v75Status.smallestHonestDelta?.v74SceneReadbackUnchanged !== true ||
    v75Status.attemptsExecuted !== 1 ||
    v75Status.liveExecutionOccurred !== true ||
    v75Status.figmaWrites !== 5 ||
    v75Status.attempt1Path !== V75_ATTEMPT_1_PATH ||
    v75Status.attempt1Sha256 !== V75_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V75_ATTEMPT_1_PATH)) !==
      V75_ATTEMPT_1_SHA256 ||
    v75Status.taughtProbePolarReflowAgainstContentTextHeld !== true ||
    v75Status.muiContentFillNewlyFalseAfterSplit !== true ||
    v75Status.mintCleaned !== true ||
    v75Status.overallInputSuccess !== false
  )
    failures.push("v75 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V76_ROOT}/protocol.json`)) !==
      V76_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V76_ROOT}/proof-plan.json`)) !==
      V76_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V76_ROOT}/capture-manifest.json`)) !==
      V76_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V76_ROOT}/request-manifest.json`)) !==
      V76_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V76_ROOT}/antecedent-index.json`)) !==
      V76_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V76_ROOT}/authorization-template.json`),
    ) !== V76_AUTHORIZATION_TEMPLATE_SHA256 ||
    v76Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v76.ts" ||
    v76Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v76Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v76Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v76Protocol.hostNormalization
      ?.taughtUnnamedSourcePxCarriedNotRequiredEquals !== true ||
    v76Protocol.hostNormalization?.v75SceneReadbackUnchanged !== true ||
    v76Protocol.hostNormalization?.v18WriterMinted !== true ||
    v76Index.hashSetSha256 !== V76_HASH_SET_SHA256 ||
    v76Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v76Status.artifactVersion !== "input-live-v76-status-v1" ||
    v76Status.status !== V76_STATUS ||
    v76Status.baseCommit !== V76_BASE_COMMIT ||
    v76Status.antecedent?.commit !== V76_ANTECEDENT_COMMIT ||
    v76Status.authorization?.present !== true ||
    v76Status.authorization?.commitStateDerivedByHistory !== true ||
    v76Status.authorization?.effective !== false ||
    v76Status.authorization?.path !== V76_AUTHORIZATION_PATH ||
    v76Status.authorization?.sha256 !== V76_AUTHORIZATION_SHA256 ||
    v76Status.authorization?.signingPublicKeySpkiSha256 !==
      V76_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V76_AUTHORIZATION_PATH)) !==
      V76_AUTHORIZATION_SHA256 ||
    v76Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v76Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v76Status.smallestHonestDelta?.taughtProbeFirstSegmentRole !== true ||
    v76Status.smallestHonestDelta?.v75SceneReadbackUnchanged !== true ||
    v76Status.smallestHonestDelta?.v18WriterMinted !== true ||
    v76Status.attemptsExecuted !== 1 ||
    v76Status.liveExecutionOccurred !== true ||
    v76Status.figmaWrites !== 5 ||
    v76Status.attempt1Path !== V76_ATTEMPT_1_PATH ||
    v76Status.attempt1Sha256 !== V76_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V76_ATTEMPT_1_PATH)) !==
      V76_ATTEMPT_1_SHA256 ||
    v76Status.taughtWriterFirstSegmentBindHeld !== true ||
    v76Status.muiContentFillStillFalseAfterHiddenDefaultSample !== true ||
    v76Status.mintCleaned !== true ||
    v76Status.overallInputSuccess !== false
  )
    failures.push("v76 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V77_ROOT}/protocol.json`)) !==
      V77_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V77_ROOT}/proof-plan.json`)) !==
      V77_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V77_ROOT}/capture-manifest.json`)) !==
      V77_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V77_ROOT}/request-manifest.json`)) !==
      V77_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V77_ROOT}/antecedent-index.json`)) !==
      V77_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V77_ROOT}/authorization-template.json`),
    ) !== V77_AUTHORIZATION_TEMPLATE_SHA256 ||
    v77Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v77.ts" ||
    v77Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v77Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v77Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v77Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v77Protocol.hostNormalization?.v76SceneReadbackUnchanged !== true ||
    v77Protocol.hostNormalization?.v18WriterMinted !== true ||
    v77Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v77Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v77Index.hashSetSha256 !== V77_HASH_SET_SHA256 ||
    v77Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v77Status.artifactVersion !== "input-live-v77-status-v1" ||
    v77Status.status !== V77_STATUS ||
    v77Status.baseCommit !== V77_BASE_COMMIT ||
    v77Status.antecedent?.commit !== V77_ANTECEDENT_COMMIT ||
    v77Status.authorization?.present !== true ||
    v77Status.authorization?.commitStateDerivedByHistory !== true ||
    v77Status.authorization?.effective !== false ||
    v77Status.authorization?.path !== V77_AUTHORIZATION_PATH ||
    v77Status.authorization?.sha256 !== V77_AUTHORIZATION_SHA256 ||
    v77Status.authorization?.signingPublicKeySpkiSha256 !==
      V77_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V77_AUTHORIZATION_PATH)) !==
      V77_AUTHORIZATION_SHA256 ||
    v77Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v77Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v77Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v77Status.smallestHonestDelta?.v76SceneReadbackUnchanged !== true ||
    v77Status.smallestHonestDelta?.v18WriterMinted !== true ||
    v77Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v77Status.attemptsExecuted !== 1 ||
    v77Status.liveExecutionOccurred !== true ||
    v77Status.figmaWrites !== 5 ||
    v77Status.attempt1Path !== V77_ATTEMPT_1_PATH ||
    v77Status.attempt1Sha256 !== V77_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V77_ATTEMPT_1_PATH)) !==
      V77_ATTEMPT_1_SHA256 ||
    v77Status.taughtProbeRevealThenMeasureHiddenContentFillHeld !== true ||
    v77Status.contentFillPassedBoth !== true ||
    v77Status.muiClip104AndOverlap12Remain !== true ||
    v77Status.mintCleaned !== true ||
    v77Status.overallInputSuccess !== false
  )
    failures.push("v77 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V78_ROOT}/protocol.json`)) !==
      V78_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V78_ROOT}/proof-plan.json`)) !==
      V78_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V78_ROOT}/capture-manifest.json`)) !==
      V78_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V78_ROOT}/request-manifest.json`)) !==
      V78_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V78_ROOT}/antecedent-index.json`)) !==
      V78_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V78_ROOT}/authorization-template.json`),
    ) !== V78_AUTHORIZATION_TEMPLATE_SHA256 ||
    v78Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v78.ts" ||
    v78Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v78Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v78Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v78Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v78Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v78Protocol.hostNormalization?.v77SceneReadbackUnchanged !== true ||
    v78Protocol.hostNormalization?.v18WriterMinted !== true ||
    v78Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v78Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v78Index.hashSetSha256 !== V78_HASH_SET_SHA256 ||
    v78Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v78Status.artifactVersion !== "input-live-v78-status-v1" ||
    v78Status.status !== V78_STATUS ||
    v78Status.baseCommit !== V78_BASE_COMMIT ||
    v78Status.antecedent?.commit !== V78_ANTECEDENT_COMMIT ||
    v78Status.authorization?.present !== true ||
    v78Status.authorization?.commitStateDerivedByHistory !== true ||
    v78Status.authorization?.effective !== false ||
    v78Status.authorization?.path !== V78_AUTHORIZATION_PATH ||
    v78Status.authorization?.sha256 !== V78_AUTHORIZATION_SHA256 ||
    v78Status.authorization?.signingPublicKeySpkiSha256 !==
      V78_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V78_AUTHORIZATION_PATH)) !==
      V78_AUTHORIZATION_SHA256 ||
    v78Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v78Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v78Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v78Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v78Status.smallestHonestDelta?.v77SceneReadbackUnchanged !== true ||
    v78Status.smallestHonestDelta?.v18WriterMinted !== true ||
    v78Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v78Status.attemptsExecuted !== 1 ||
    v78Status.liveExecutionOccurred !== true ||
    v78Status.figmaWrites !== 5 ||
    v78Status.attempt1Path !== V78_ATTEMPT_1_PATH ||
    v78Status.attempt1Sha256 !== V78_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V78_ATTEMPT_1_PATH)) !==
      V78_ATTEMPT_1_SHA256 ||
    v78Status.taughtProbeExcludeOverlayLabelAabbHeld !== true ||
    v78Status.contentFillPassedBoth !== true ||
    v78Status.muiClipClearedOverlap12Remain !== true ||
    v78Status.mintCleaned !== true ||
    v78Status.overallInputSuccess !== false
  )
    failures.push("v78 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V79_ROOT}/protocol.json`)) !==
      V79_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V79_ROOT}/proof-plan.json`)) !==
      V79_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V79_ROOT}/capture-manifest.json`)) !==
      V79_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V79_ROOT}/request-manifest.json`)) !==
      V79_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V79_ROOT}/antecedent-index.json`)) !==
      V79_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V79_ROOT}/authorization-template.json`),
    ) !== V79_AUTHORIZATION_TEMPLATE_SHA256 ||
    v79Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v79.ts" ||
    v79Protocol.hostNormalization?.taughtWriterHiddenFillOccupancy !== true ||
    v79Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v79Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v79Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v79Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v79Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v79Protocol.hostNormalization?.v78SceneReadbackUnchanged !== true ||
    v79Protocol.hostNormalization?.v19WriterMinted !== true ||
    v79Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v79Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v79Index.hashSetSha256 !== V79_HASH_SET_SHA256 ||
    v79Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v79Status.artifactVersion !== "input-live-v79-status-v1" ||
    v79Status.status !== V79_STATUS ||
    v79Status.baseCommit !== V79_BASE_COMMIT ||
    v79Status.antecedent?.commit !== V79_ANTECEDENT_COMMIT ||
    v79Status.authorization?.present !== true ||
    v79Status.authorization?.commitStateDerivedByHistory !== true ||
    v79Status.authorization?.effective !== false ||
    v79Status.authorization?.path !== V79_AUTHORIZATION_PATH ||
    v79Status.authorization?.sha256 !== V79_AUTHORIZATION_SHA256 ||
    v79Status.authorization?.signingPublicKeySpkiSha256 !==
      V79_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V79_AUTHORIZATION_PATH)) !==
      V79_AUTHORIZATION_SHA256 ||
    v79Status.smallestHonestDelta?.taughtWriterHiddenFillOccupancy !== true ||
    v79Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v79Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v79Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v79Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v79Status.smallestHonestDelta?.v78SceneReadbackUnchanged !== true ||
    v79Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v79Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v79Status.attemptsExecuted !== 1 ||
    v79Status.liveExecutionOccurred !== true ||
    v79Status.figmaWrites !== 4 ||
    v79Status.attempt1Path !== V79_ATTEMPT_1_PATH ||
    v79Status.attempt1Sha256 !== V79_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V79_ATTEMPT_1_PATH)) !==
      V79_ATTEMPT_1_SHA256 ||
    v79Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v79Status.recipeCollapseRefusedOpacity !== true ||
    v79Status.probeIssued !== false ||
    v79Status.mintCleaned !== true ||
    v79Status.overallInputSuccess !== false
  )
    failures.push("v79 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V80_ROOT}/protocol.json`)) !==
      V80_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V80_ROOT}/proof-plan.json`)) !==
      V80_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V80_ROOT}/capture-manifest.json`)) !==
      V80_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V80_ROOT}/request-manifest.json`)) !==
      V80_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V80_ROOT}/antecedent-index.json`)) !==
      V80_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V80_ROOT}/authorization-template.json`),
    ) !== V80_AUTHORIZATION_TEMPLATE_SHA256 ||
    v80Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v80.ts" ||
    v80Protocol.hostNormalization?.taughtContentOpacityOmitted !== true ||
    v80Protocol.hostNormalization?.taughtWriterHiddenFillOccupancy !== true ||
    v80Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v80Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v80Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v80Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v80Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v80Protocol.hostNormalization?.v79SceneReadbackUnchanged !== true ||
    v80Protocol.hostNormalization?.v78SceneReadbackUnchanged !== true ||
    v80Protocol.hostNormalization?.v19WriterMinted !== true ||
    v80Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v80Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v80Index.hashSetSha256 !== V80_HASH_SET_SHA256 ||
    v80Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v80Status.artifactVersion !== "input-live-v80-status-v1" ||
    v80Status.status !== V80_STATUS ||
    v80Status.baseCommit !== V80_BASE_COMMIT ||
    v80Status.antecedent?.commit !== V80_ANTECEDENT_COMMIT ||
    v80Status.authorization?.present !== true ||
    v80Status.authorization?.commitStateDerivedByHistory !== true ||
    v80Status.authorization?.effective !== false ||
    v80Status.authorization?.path !== V80_AUTHORIZATION_PATH ||
    v80Status.authorization?.sha256 !== V80_AUTHORIZATION_SHA256 ||
    v80Status.authorization?.signingPublicKeySpkiSha256 !==
      V80_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V80_AUTHORIZATION_PATH)) !==
      V80_AUTHORIZATION_SHA256 ||
    v80Status.smallestHonestDelta?.taughtContentOpacityOmitted !== true ||
    v80Status.smallestHonestDelta?.taughtWriterHiddenFillOccupancy !== true ||
    v80Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v80Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v80Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v80Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v80Status.smallestHonestDelta?.v79SceneReadbackUnchanged !== true ||
    v80Status.smallestHonestDelta?.v78SceneReadbackUnchanged !== true ||
    v80Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v80Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v80Status.attemptsExecuted !== 1 ||
    v80Status.liveExecutionOccurred !== true ||
    v80Status.figmaWrites !== 4 ||
    v80Status.attempt1Path !== V80_ATTEMPT_1_PATH ||
    v80Status.attempt1Sha256 !== V80_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V80_ATTEMPT_1_PATH)) !==
      V80_ATTEMPT_1_SHA256 ||
    v80Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v80Status.taughtContentOpacityOmittedHeld !== true ||
    v80Status.recipeCollapseRefusedVisible !== true ||
    v80Status.probeIssued !== false ||
    v80Status.mintCleaned !== true ||
    v80Status.overallInputSuccess !== false
  )
    failures.push("v80 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V81_ROOT}/protocol.json`)) !==
      V81_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V81_ROOT}/proof-plan.json`)) !==
      V81_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V81_ROOT}/capture-manifest.json`)) !==
      V81_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V81_ROOT}/request-manifest.json`)) !==
      V81_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V81_ROOT}/antecedent-index.json`)) !==
      V81_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V81_ROOT}/authorization-template.json`),
    ) !== V81_AUTHORIZATION_TEMPLATE_SHA256 ||
    v81Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v81.ts" ||
    v81Protocol.hostNormalization?.taughtCompileCarryLiveVisible !== true ||
    v81Protocol.hostNormalization?.inventHostVisibleFalseForbidden !== true ||
    v81Protocol.hostNormalization?.taughtContentOpacityOmitted !== true ||
    v81Protocol.hostNormalization?.taughtWriterHiddenFillOccupancy !== true ||
    v81Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v81Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v81Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v81Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v81Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v81Protocol.hostNormalization?.v80SceneReadbackUnchanged !== true ||
    v81Protocol.hostNormalization?.v79SceneReadbackUnchanged !== true ||
    v81Protocol.hostNormalization?.v19WriterMinted !== true ||
    v81Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v81Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v81Index.hashSetSha256 !== V81_HASH_SET_SHA256 ||
    v81Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v81Status.artifactVersion !== "input-live-v81-status-v1" ||
    v81Status.status !== V81_STATUS ||
    v81Status.baseCommit !== V81_BASE_COMMIT ||
    v81Status.antecedent?.commit !== V81_ANTECEDENT_COMMIT ||
    v81Status.authorization?.present !== true ||
    v81Status.authorization?.commitStateDerivedByHistory !== true ||
    v81Status.authorization?.effective !== false ||
    v81Status.authorization?.path !== V81_AUTHORIZATION_PATH ||
    v81Status.authorization?.sha256 !== V81_AUTHORIZATION_SHA256 ||
    v81Status.authorization?.signingPublicKeySpkiSha256 !==
      V81_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V81_AUTHORIZATION_PATH)) !==
      V81_AUTHORIZATION_SHA256 ||
    v81Status.smallestHonestDelta?.taughtCompileCarryLiveVisible !== true ||
    v81Status.smallestHonestDelta?.inventHostVisibleFalseForbidden !== true ||
    v81Status.smallestHonestDelta?.taughtContentOpacityOmitted !== true ||
    v81Status.smallestHonestDelta?.taughtWriterHiddenFillOccupancy !== true ||
    v81Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v81Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v81Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v81Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v81Status.smallestHonestDelta?.v80SceneReadbackUnchanged !== true ||
    v81Status.smallestHonestDelta?.v79SceneReadbackUnchanged !== true ||
    v81Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v81Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v81Status.attemptsExecuted !== 1 ||
    v81Status.liveExecutionOccurred !== true ||
    v81Status.figmaWrites !== 4 ||
    v81Status.attempt1Path !== V81_ATTEMPT_1_PATH ||
    v81Status.attempt1Sha256 !== V81_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V81_ATTEMPT_1_PATH)) !==
      V81_ATTEMPT_1_SHA256 ||
    v81Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v81Status.taughtContentOpacityOmittedHeld !== true ||
    v81Status.taughtCompileCarryLiveVisibleHeld !== true ||
    v81Status.inventHostVisibleFalseForbidden !== true ||
    v81Status.accountingRefusedOpacity !== true ||
    v81Status.probeIssued !== false ||
    v81Status.mintCleaned !== true ||
    v81Status.overallInputSuccess !== false
  )
    failures.push("v81 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V82_ROOT}/protocol.json`)) !==
      V82_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V82_ROOT}/proof-plan.json`)) !==
      V82_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V82_ROOT}/capture-manifest.json`)) !==
      V82_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V82_ROOT}/request-manifest.json`)) !==
      V82_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V82_ROOT}/antecedent-index.json`)) !==
      V82_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V82_ROOT}/authorization-template.json`),
    ) !== V82_AUTHORIZATION_TEMPLATE_SHA256 ||
    v82Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v82.ts" ||
    v82Protocol.hostNormalization?.taughtCompileCarryLiveOpacity !== true ||
    v82Protocol.hostNormalization?.inventOpacityVariableForbidden !== true ||
    v82Protocol.hostNormalization?.inventCompileTextOpacityForbidden !==
      true ||
    v82Protocol.hostNormalization?.taughtCompileCarryLiveVisible !== true ||
    v82Protocol.hostNormalization?.inventHostVisibleFalseForbidden !== true ||
    v82Protocol.hostNormalization?.taughtContentOpacityOmitted !== true ||
    v82Protocol.hostNormalization?.taughtWriterHiddenFillOccupancy !== true ||
    v82Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v82Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v82Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v82Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v82Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v82Protocol.hostNormalization?.v81SceneReadbackUnchanged !== true ||
    v82Protocol.hostNormalization?.v80SceneReadbackUnchanged !== true ||
    v82Protocol.hostNormalization?.v79SceneReadbackUnchanged !== true ||
    v82Protocol.hostNormalization?.v19WriterMinted !== true ||
    v82Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v82Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v82Index.hashSetSha256 !== V82_HASH_SET_SHA256 ||
    v82Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v82Status.artifactVersion !== "input-live-v82-status-v1" ||
    v82Status.status !== V82_STATUS ||
    v82Status.baseCommit !== V82_BASE_COMMIT ||
    v82Status.antecedent?.commit !== V82_ANTECEDENT_COMMIT ||
    v82Status.authorization?.present !== true ||
    v82Status.authorization?.commitStateDerivedByHistory !== true ||
    v82Status.authorization?.effective !== false ||
    v82Status.authorization?.path !== V82_AUTHORIZATION_PATH ||
    v82Status.authorization?.sha256 !== V82_AUTHORIZATION_SHA256 ||
    v82Status.authorization?.signingPublicKeySpkiSha256 !==
      V82_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V82_AUTHORIZATION_PATH)) !==
      V82_AUTHORIZATION_SHA256 ||
    v82Status.smallestHonestDelta?.taughtCompileCarryLiveOpacity !== true ||
    v82Status.smallestHonestDelta?.inventOpacityVariableForbidden !== true ||
    v82Status.smallestHonestDelta?.inventCompileTextOpacityForbidden !==
      true ||
    v82Status.smallestHonestDelta?.taughtCompileCarryLiveVisible !== true ||
    v82Status.smallestHonestDelta?.inventHostVisibleFalseForbidden !== true ||
    v82Status.smallestHonestDelta?.taughtContentOpacityOmitted !== true ||
    v82Status.smallestHonestDelta?.taughtWriterHiddenFillOccupancy !== true ||
    v82Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v82Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v82Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v82Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v82Status.smallestHonestDelta?.v81SceneReadbackUnchanged !== true ||
    v82Status.smallestHonestDelta?.v80SceneReadbackUnchanged !== true ||
    v82Status.smallestHonestDelta?.v79SceneReadbackUnchanged !== true ||
    v82Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v82Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v82Status.attemptsExecuted !== 1 ||
    v82Status.liveExecutionOccurred !== true ||
    v82Status.figmaWrites !== 4 ||
    v82Status.attempt1Path !== V82_ATTEMPT_1_PATH ||
    v82Status.attempt1Sha256 !== V82_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V82_ATTEMPT_1_PATH)) !==
      V82_ATTEMPT_1_SHA256 ||
    v82Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v82Status.taughtContentOpacityOmittedHeld !== true ||
    v82Status.taughtCompileCarryLiveVisibleHeld !== true ||
    v82Status.taughtCompileCarryLiveOpacityHeld !== true ||
    v82Status.inventHostVisibleFalseForbidden !== true ||
    v82Status.independentRootAccountingPassed !== true ||
    v82Status.recipeCollapseRefusedFixedPoint !== true ||
    v82Status.probeIssued !== false ||
    v82Status.mintCleaned !== true ||
    v82Status.overallInputSuccess !== false
  )
    failures.push("v82 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V83_ROOT}/protocol.json`)) !==
      V83_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V83_ROOT}/proof-plan.json`)) !==
      V83_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V83_ROOT}/capture-manifest.json`)) !==
      V83_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V83_ROOT}/request-manifest.json`)) !==
      V83_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V83_ROOT}/antecedent-index.json`)) !==
      V83_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V83_ROOT}/authorization-template.json`),
    ) !== V83_AUTHORIZATION_TEMPLATE_SHA256 ||
    v83Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v83.ts" ||
    v83Protocol.hostNormalization?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    v83Protocol.hostNormalization?.taughtCompileCarryLiveOpacity !== true ||
    v83Protocol.hostNormalization?.inventOpacityVariableForbidden !== true ||
    v83Protocol.hostNormalization?.inventCompileTextOpacityForbidden !==
      true ||
    v83Protocol.hostNormalization?.taughtCompileCarryLiveVisible !== true ||
    v83Protocol.hostNormalization?.inventHostVisibleFalseForbidden !== true ||
    v83Protocol.hostNormalization?.taughtContentOpacityOmitted !== true ||
    v83Protocol.hostNormalization?.taughtWriterHiddenFillOccupancy !== true ||
    v83Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v83Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v83Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v83Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v83Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v83Protocol.hostNormalization?.v82SceneReadbackUnchanged !== true ||
    v83Protocol.hostNormalization?.v81SceneReadbackUnchanged !== true ||
    v83Protocol.hostNormalization?.v80SceneReadbackUnchanged !== true ||
    v83Protocol.hostNormalization?.v19WriterMinted !== true ||
    v83Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v83Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v83Index.hashSetSha256 !== V83_HASH_SET_SHA256 ||
    v83Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v83Status.artifactVersion !== "input-live-v83-status-v1" ||
    v83Status.status !== V83_STATUS ||
    v83Status.baseCommit !== V83_BASE_COMMIT ||
    v83Status.antecedent?.commit !== V83_ANTECEDENT_COMMIT ||
    v83Status.authorization?.present !== true ||
    v83Status.authorization?.commitStateDerivedByHistory !== true ||
    v83Status.authorization?.effective !== false ||
    v83Status.authorization?.path !== V83_AUTHORIZATION_PATH ||
    v83Status.authorization?.sha256 !== V83_AUTHORIZATION_SHA256 ||
    v83Status.authorization?.signingPublicKeySpkiSha256 !==
      V83_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V83_AUTHORIZATION_PATH)) !==
      V83_AUTHORIZATION_SHA256 ||
    v83Status.smallestHonestDelta?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    v83Status.smallestHonestDelta?.taughtCompileCarryLiveOpacity !== true ||
    v83Status.smallestHonestDelta?.inventOpacityVariableForbidden !== true ||
    v83Status.smallestHonestDelta?.inventCompileTextOpacityForbidden !==
      true ||
    v83Status.smallestHonestDelta?.taughtCompileCarryLiveVisible !== true ||
    v83Status.smallestHonestDelta?.inventHostVisibleFalseForbidden !== true ||
    v83Status.smallestHonestDelta?.taughtContentOpacityOmitted !== true ||
    v83Status.smallestHonestDelta?.taughtWriterHiddenFillOccupancy !== true ||
    v83Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v83Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v83Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v83Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v83Status.smallestHonestDelta?.v82SceneReadbackUnchanged !== true ||
    v83Status.smallestHonestDelta?.v81SceneReadbackUnchanged !== true ||
    v83Status.smallestHonestDelta?.v80SceneReadbackUnchanged !== true ||
    v83Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v83Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v83Status.attemptsExecuted !== 1 ||
    v83Status.liveExecutionOccurred !== true ||
    v83Status.figmaWrites !== 5 ||
    v83Status.attempt1Path !== V83_ATTEMPT_1_PATH ||
    v83Status.attempt1Sha256 !== V83_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V83_ATTEMPT_1_PATH)) !==
      V83_ATTEMPT_1_SHA256 ||
    v83Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v83Status.taughtContentOpacityOmittedHeld !== true ||
    v83Status.taughtCompileCarryLiveVisibleHeld !== true ||
    v83Status.taughtCompileCarryLiveOpacityHeld !== true ||
    v83Status.taughtCollapseOmitInventedContentTextOpacityHeld !== true ||
    v83Status.inventHostVisibleFalseForbidden !== true ||
    v83Status.independentRootAccountingPassed !== true ||
    v83Status.recipeCollapseFixedPointStable !== true ||
    v83Status.recipeCollapseRefusedFixedPoint !== false ||
    v83Status.probeIssued !== true ||
    v83Status.probeOtherwiseGreen !== false ||
    v83Status.mintCleaned !== true ||
    v83Status.mintStayed !== false ||
    v83Status.overallInputSuccess !== false
  )
    failures.push("v83 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V84_ROOT}/protocol.json`)) !==
      V84_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V84_ROOT}/proof-plan.json`)) !==
      V84_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V84_ROOT}/capture-manifest.json`)) !==
      V84_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V84_ROOT}/request-manifest.json`)) !==
      V84_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V84_ROOT}/antecedent-index.json`)) !==
      V84_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V84_ROOT}/authorization-template.json`),
    ) !== V84_AUTHORIZATION_TEMPLATE_SHA256 ||
    v84Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v84.ts" ||
    v84Protocol.hostNormalization
      ?.taughtProbeExcludeOpacityZeroOccupancyOverlap !== true ||
    v84Protocol.hostNormalization?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    v84Protocol.hostNormalization?.taughtCompileCarryLiveOpacity !== true ||
    v84Protocol.hostNormalization?.inventOpacityVariableForbidden !== true ||
    v84Protocol.hostNormalization?.inventCompileTextOpacityForbidden !==
      true ||
    v84Protocol.hostNormalization?.taughtCompileCarryLiveVisible !== true ||
    v84Protocol.hostNormalization?.inventHostVisibleFalseForbidden !== true ||
    v84Protocol.hostNormalization?.taughtContentOpacityOmitted !== true ||
    v84Protocol.hostNormalization?.taughtWriterHiddenFillOccupancy !== true ||
    v84Protocol.hostNormalization?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v84Protocol.hostNormalization
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v84Protocol.hostNormalization?.taughtWriterFirstSegmentBind !== true ||
    v84Protocol.hostNormalization?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v84Protocol.hostNormalization?.taughtProbeFirstSegmentRole !== true ||
    v84Protocol.hostNormalization?.v83SceneReadbackUnchanged !== true ||
    v84Protocol.hostNormalization?.v82SceneReadbackUnchanged !== true ||
    v84Protocol.hostNormalization?.v81SceneReadbackUnchanged !== true ||
    v84Protocol.hostNormalization?.v19WriterMinted !== true ||
    v84Protocol.hostNormalization?.v18WriterProgramUnchanged !== true ||
    v84Protocol.hostNormalization?.v18WriterPayloadUnchanged !== true ||
    v84Index.hashSetSha256 !== V84_HASH_SET_SHA256 ||
    v84Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v84Status.artifactVersion !== "input-live-v84-status-v1" ||
    v84Status.status !== V84_STATUS ||
    v84Status.baseCommit !== V84_BASE_COMMIT ||
    v84Status.antecedent?.commit !== V84_ANTECEDENT_COMMIT ||
    v84Status.authorization?.present !== true ||
    v84Status.authorization?.commitStateDerivedByHistory !== true ||
    v84Status.authorization?.effective !== false ||
    v84Status.authorization?.path !== V84_AUTHORIZATION_PATH ||
    v84Status.authorization?.sha256 !== V84_AUTHORIZATION_SHA256 ||
    v84Status.authorization?.signingPublicKeySpkiSha256 !==
      V84_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V84_AUTHORIZATION_PATH)) !==
      V84_AUTHORIZATION_SHA256 ||
    v84Status.smallestHonestDelta
      ?.taughtProbeExcludeOpacityZeroOccupancyOverlap !== true ||
    v84Status.smallestHonestDelta?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    v84Status.smallestHonestDelta?.taughtCompileCarryLiveOpacity !== true ||
    v84Status.smallestHonestDelta?.inventOpacityVariableForbidden !== true ||
    v84Status.smallestHonestDelta?.inventCompileTextOpacityForbidden !==
      true ||
    v84Status.smallestHonestDelta?.taughtCompileCarryLiveVisible !== true ||
    v84Status.smallestHonestDelta?.inventHostVisibleFalseForbidden !== true ||
    v84Status.smallestHonestDelta?.taughtContentOpacityOmitted !== true ||
    v84Status.smallestHonestDelta?.taughtWriterHiddenFillOccupancy !== true ||
    v84Status.smallestHonestDelta?.taughtProbeExcludeOverlayLabelAabb !==
      true ||
    v84Status.smallestHonestDelta
      ?.taughtProbeRevealThenMeasureHiddenContentFill !== true ||
    v84Status.smallestHonestDelta?.taughtWriterFirstSegmentBind !== true ||
    v84Status.smallestHonestDelta?.taughtProbePolarReflowAgainstContentText !==
      true ||
    v84Status.smallestHonestDelta?.v83SceneReadbackUnchanged !== true ||
    v84Status.smallestHonestDelta?.v82SceneReadbackUnchanged !== true ||
    v84Status.smallestHonestDelta?.v81SceneReadbackUnchanged !== true ||
    v84Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v84Status.smallestHonestDelta?.v18WriterProgramUnchanged !== true ||
    v84Status.attemptsExecuted !== 1 ||
    v84Status.liveExecutionOccurred !== true ||
    v84Status.figmaWrites !== 133 ||
    v84Status.attempt1Path !== V84_ATTEMPT_1_PATH ||
    v84Status.attempt1Sha256 !== V84_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V84_ATTEMPT_1_PATH)) !==
      V84_ATTEMPT_1_SHA256 ||
    v84Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v84Status.taughtContentOpacityOmittedHeld !== true ||
    v84Status.taughtCompileCarryLiveVisibleHeld !== true ||
    v84Status.taughtCompileCarryLiveOpacityHeld !== true ||
    v84Status.taughtCollapseOmitInventedContentTextOpacityHeld !== true ||
    v84Status.taughtProbeExcludeOpacityZeroOccupancyOverlapHeld !== true ||
    v84Status.inventHostVisibleFalseForbidden !== true ||
    v84Status.independentRootAccountingPassed !== true ||
    v84Status.recipeCollapseFixedPointStable !== true ||
    v84Status.recipeCollapseRefusedFixedPoint !== false ||
    v84Status.probeIssued !== true ||
    v84Status.probeOtherwiseGreen !== true ||
    v84Status.mintCleaned !== true ||
    v84Status.mintStayed !== false ||
    v84Status.overallInputSuccess !== false
  )
    failures.push("v84 authorization/status mismatch");
  if (
    sha256(readRepositoryEvidence(`${V85_ROOT}/protocol.json`)) !==
      V85_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V85_ROOT}/proof-plan.json`)) !==
      V85_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V85_ROOT}/capture-manifest.json`)) !==
      V85_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V85_ROOT}/request-manifest.json`)) !==
      V85_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V85_ROOT}/antecedent-index.json`)) !==
      V85_INDEX_SHA256 ||
    sha256(
      readRepositoryEvidence(`${V85_ROOT}/authorization-template.json`),
    ) !== V85_AUTHORIZATION_TEMPLATE_SHA256 ||
    v85Protocol.hostNormalization?.carriedSceneReadback !==
      "recipe/scene-readback-v85.ts" ||
    v85Protocol.hostNormalization?.taughtCleanupOnFailureOnly !== true ||
    v85Protocol.execution?.cleanupOnFailureOnly !== true ||
    v85Protocol.execution?.cleanupMustNotExecuteOnMainComplete !== true ||
    v85Protocol.execution?.requestOrder?.at(-1) === "cleanup" ||
    !v85Protocol.execution?.requestOrder?.includes(
      "persist signed cleanup recovery request",
    ) ||
    v85Protocol.hostNormalization
      ?.taughtProbeExcludeOpacityZeroOccupancyOverlap !== true ||
    v85Protocol.hostNormalization?.taughtCollapseOmitInventedContentTextOpacity !==
      true ||
    v85Protocol.hostNormalization?.v84SceneReadbackUnchanged !== true ||
    v85Protocol.hostNormalization?.v83SceneReadbackUnchanged !== true ||
    v85Protocol.hostNormalization?.v19WriterMinted !== true ||
    v85Index.hashSetSha256 !== V85_HASH_SET_SHA256 ||
    v85Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v85Status.artifactVersion !== "input-live-v85-status-v1" ||
    v85Status.status !== V85_STATUS ||
    v85Status.baseCommit !== V85_BASE_COMMIT ||
    v85Status.antecedent?.commit !== V85_ANTECEDENT_COMMIT ||
    v85Status.authorization?.present !== true ||
    v85Status.authorization?.commitStateDerivedByHistory !== true ||
    v85Status.authorization?.effective !== false ||
    v85Status.authorization?.path !== V85_AUTHORIZATION_PATH ||
    v85Status.authorization?.sha256 !== V85_AUTHORIZATION_SHA256 ||
    v85Status.authorization?.signingPublicKeySpkiSha256 !==
      V85_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    sha256(readRepositoryEvidence(V85_AUTHORIZATION_PATH)) !==
      V85_AUTHORIZATION_SHA256 ||
    v85Status.smallestHonestDelta?.taughtCleanupOnFailureOnly !== true ||
    v85Status.smallestHonestDelta
      ?.taughtProbeExcludeOpacityZeroOccupancyOverlap !== true ||
    v85Status.smallestHonestDelta?.v84SceneReadbackUnchanged !== true ||
    v85Status.smallestHonestDelta?.v83SceneReadbackUnchanged !== true ||
    v85Status.smallestHonestDelta?.v19WriterMinted !== true ||
    v85Status.attemptsExecuted !== 1 ||
    v85Status.liveExecutionOccurred !== true ||
    v85Status.figmaWrites !== 132 ||
    v85Status.attempt1Path !== V85_ATTEMPT_1_PATH ||
    v85Status.attempt1Sha256 !== V85_ATTEMPT_1_SHA256 ||
    sha256(readRepositoryEvidence(V85_ATTEMPT_1_PATH)) !==
      V85_ATTEMPT_1_SHA256 ||
    v85Status.taughtWriterHiddenFillOccupancyHeld !== true ||
    v85Status.taughtContentOpacityOmittedHeld !== true ||
    v85Status.taughtCompileCarryLiveVisibleHeld !== true ||
    v85Status.taughtCompileCarryLiveOpacityHeld !== true ||
    v85Status.taughtCollapseOmitInventedContentTextOpacityHeld !== true ||
    v85Status.taughtProbeExcludeOpacityZeroOccupancyOverlapHeld !== true ||
    v85Status.taughtCleanupOnFailureOnlyHeld !== true ||
    v85Status.inventHostVisibleFalseForbidden !== true ||
    v85Status.independentRootAccountingPassed !== true ||
    v85Status.recipeCollapseFixedPointStable !== true ||
    v85Status.recipeCollapseRefusedFixedPoint !== false ||
    v85Status.probeIssued !== true ||
    v85Status.probeOtherwiseGreen !== true ||
    v85Status.mintCleaned !== false ||
    v85Status.mintStayed !== true ||
    v85Status.doNotClaimV1Complete !== true ||
    v85Status.overallInputSuccess !== false
  )
    failures.push("v85 authorization/status mismatch");
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
  for (const [artifactPath, metadata] of Object.entries(
    v47Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v47 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v47-authorization") ||
      artifactPath.includes("input-field-live-v47-preflight") ||
      artifactPath.includes("input-field-live-v47-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v47 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v47Index.artifacts?.["recipe/scene-readback-v47.ts"] ||
    !v47Index.artifacts?.["recipe/scene-readback-runtime-v47.ts"] ||
    !v47Index.artifacts?.["recipe/input-field-live-v3-verifier-v47.ts"] ||
    !v47Index.artifacts?.["recipe/input-field-live-v47-restore.ts"] ||
    !v47Index.artifacts?.[`${V47_ROOT}/programs/restore-blueprint.js`] ||
    !v47Index.artifacts?.[`${V47_ROOT}/programs/writer-payload.js`] ||
    v47Index.artifacts?.["recipe/scene-readback.ts"] ||
    v47Index.artifacts?.["recipe/scene-readback-v46.ts"] ||
    v47Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v47Index.artifacts?.["recipe/input-field-live-v3-verifier-v46.ts"] ||
    v47Index.artifacts?.["recipe/input-field-live-v46-restore.ts"]
  )
    failures.push(
      "v47 must hash carried scene-readback-v47 and leave hashed v46 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v46.ts")) !==
    V46_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v46 scene-readback restamped while preparing v47");
  for (const [artifactPath, metadata] of Object.entries(
    v48Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v48 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v48-authorization") ||
      artifactPath.includes("input-field-live-v48-preflight") ||
      artifactPath.includes("input-field-live-v48-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v48 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v48Index.artifacts?.["recipe/scene-readback-v48.ts"] ||
    !v48Index.artifacts?.["recipe/scene-readback-runtime-v48.ts"] ||
    !v48Index.artifacts?.["recipe/input-field-live-v3-verifier-v48.ts"] ||
    !v48Index.artifacts?.["recipe/input-field-live-v48-restore.ts"] ||
    !v48Index.artifacts?.[`${V48_ROOT}/programs/restore-blueprint.js`] ||
    !v48Index.artifacts?.[`${V48_ROOT}/programs/writer-payload.js`] ||
    v48Index.artifacts?.["recipe/scene-readback.ts"] ||
    v48Index.artifacts?.["recipe/scene-readback-v47.ts"] ||
    v48Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v48Index.artifacts?.["recipe/input-field-live-v3-verifier-v47.ts"] ||
    v48Index.artifacts?.["recipe/input-field-live-v47-restore.ts"]
  )
    failures.push(
      "v48 must hash carried scene-readback-v48 and leave hashed v47 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v47.ts")) !==
    V47_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v47 scene-readback restamped while preparing v48");
  for (const [artifactPath, metadata] of Object.entries(
    v49Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v49 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v49-authorization") ||
      artifactPath.includes("input-field-live-v49-preflight") ||
      artifactPath.includes("input-field-live-v49-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v49 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v49Index.artifacts?.["recipe/scene-readback-v49.ts"] ||
    !v49Index.artifacts?.["recipe/scene-readback-runtime-v49.ts"] ||
    !v49Index.artifacts?.["recipe/input-field-live-v3-verifier-v49.ts"] ||
    !v49Index.artifacts?.["recipe/input-field-live-v49-restore.ts"] ||
    !v49Index.artifacts?.[`${V49_ROOT}/programs/restore-blueprint.js`] ||
    !v49Index.artifacts?.[`${V49_ROOT}/programs/writer-payload.js`] ||
    v49Index.artifacts?.["recipe/scene-readback.ts"] ||
    v49Index.artifacts?.["recipe/scene-readback-v48.ts"] ||
    v49Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v49Index.artifacts?.["recipe/input-field-live-v3-verifier-v48.ts"] ||
    v49Index.artifacts?.["recipe/input-field-live-v48-restore.ts"]
  )
    failures.push(
      "v49 must hash carried scene-readback-v49 and leave hashed v48 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v48.ts")) !==
    V48_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v48 scene-readback restamped while preparing v49");
  for (const [artifactPath, metadata] of Object.entries(
    v50Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v50 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v50-authorization") ||
      artifactPath.includes("input-field-live-v50-preflight") ||
      artifactPath.includes("input-field-live-v50-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v50 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    !v50Index.artifacts?.["recipe/scene-readback-v50.ts"] ||
    !v50Index.artifacts?.["recipe/scene-readback-runtime-v50.ts"] ||
    !v50Index.artifacts?.["recipe/input-field-live-v3-verifier-v50.ts"] ||
    !v50Index.artifacts?.["recipe/input-field-live-v50-restore.ts"] ||
    !v50Index.artifacts?.[`${V50_ROOT}/programs/restore-blueprint.js`] ||
    !v50Index.artifacts?.[`${V50_ROOT}/programs/writer-payload.js`] ||
    v50Index.artifacts?.["recipe/scene-readback.ts"] ||
    v50Index.artifacts?.["recipe/scene-readback-v49.ts"] ||
    v50Index.artifacts?.["recipe/input-field-live-v3-verifier.ts"] ||
    v50Index.artifacts?.["recipe/input-field-live-v3-verifier-v49.ts"] ||
    v50Index.artifacts?.["recipe/input-field-live-v49-restore.ts"]
  )
    failures.push(
      "v50 must hash carried scene-readback-v50 and leave hashed v49 restore/runtime out",
    );
  if (
    sha256(readRepositoryEvidence("recipe/scene-readback-v49.ts")) !==
    V49_SCENE_READBACK_SHA256_PIN
  )
    failures.push("hashed v49 scene-readback restamped while preparing v50");
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
