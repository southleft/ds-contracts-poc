# Console-loop Visual Audit

ReviewedAt: `2026-08-06T13:32:20.271Z`
File: `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)

Standard: `visual.matchDeveloped` / `acceptance.visualMatchDeveloped` true only when Figma-capable props **and** aesthetics match developed references (site receipts or extract/computed pairs). Round-trip `zeroMismatch` is separate.

## Fixes applied this pass

- Restored Astryx collection colors to astryx-docs.dtcg.json (accent #15110C, etc.)
- Cream (#F8F4ED) fills on foreign COMPONENT_SETs so translucent/dark-text variants are reviewable
- Carbon button: CENTER/CENTER, symmetric pad, HUG width (was SPACE_BETWEEN + L15/R63)
- Carbon toggle ON: IBM blue (was support-success green); On labels for toggled variants
- Astryx Switch: added missing white thumb ellipses for Off-state review

## Counts

| library | pass | fail | total |
|---|---:|---:|---:|
| astryx | 1 | 12 | 13 |
| carbon | 2 | 8 | 10 |
| polaris | 0 | 12 | 12 |
| tailwind | 0 | 5 | 5 |
| altitude | 0 | 8 | 8 |
| **total** | **3** | **45** | **48** |

## astryx

| stem | match? | defects | reference used |
|---|---|---|---|
| button | PASS | — | `examples/astryx/receipts/site/Button.png; examples/astryx/tokens/astryx-docs.dtcg.json` |
| badge | FAIL | Accent/default row uses near-black solid; docs Info status is saturated blue with white text — status mapping incomplete.<br>Missing icon treatments present in some docs badge examples; fail closed until status axis maps 1:1 to developed Neutral/Info/Success/Warning/Error row. | `examples/astryx/receipts/site/Badge.png` |
| banner | FAIL | Pastel fills improved on cream, but still dense pill chips without status icons / title+body hierarchy of developed Banner docs.<br>Not full-width alert banners as in examples/astryx/receipts/site/Banner.png. | `examples/astryx/receipts/site/Banner.png` |
| card | FAIL | Color variants still lack developed title/body hierarchy and elevation/border cues from Card docs.<br>Body-only placeholder aesthetic — fail closed. | `examples/astryx/receipts/site/Card.png` |
| checkbox-input | FAIL | Only Size axis; missing checked/indeterminate visual states vs typical Astryx checkbox UX.<br>No developed site Checkbox receipt — fail closed on matchDeveloped. | `none` |
| dropdown-menu-item | FAIL | Not a COMPONENT_SET; missing hover/selected/destructive variants; no developed site reference — fail closed. | `none` |
| dropdown-menu | FAIL | Not a COMPONENT_SET with expected item-state axes; no developed DropdownMenu site receipt — fail closed. | `none` |
| progress-bar | FAIL | Label wrap (Upload/ing) indicates width/padding not matching developed progress chrome.<br>No developed site ProgressBar receipt — fail closed. | `none` |
| slider | FAIL | Active track is near-black (docs OK) but thumb geometry is line/semi-circle, not circular disk in examples/astryx/receipts/site/Slider.png.<br>Vertical variants still show detached/misaligned thumbs vs developed horizontal circular thumb. | `examples/astryx/receipts/site/Slider.png` |
| switch | FAIL | Off-state now has medium-gray track + white circular thumb (manual canvas repair) and matches docs Off aesthetic.<br>No On-state variant axis (only Label Position) — cannot render near-black On from docs; fail closed on full matchDeveloped. | `examples/astryx/receipts/site/Switch.png` |
| text-input | FAIL | Missing light-gray border / leading-icon treatments shown in TextInput docs.<br>Placeholder hierarchy not demonstrated vs examples/astryx/receipts/site/TextInput.png. | `examples/astryx/receipts/site/TextInput.png` |
| toast | FAIL | Title/message clipping and Slot placeholder remain; not a COMPONENT_SET with status variants.<br>No developed site Toast receipt — fail closed. | `none` |
| token | FAIL | No developed site Token receipt — fail closed on matchDeveloped despite cream-surface contrast improvement. | `none` |

## carbon

| stem | match? | defects | reference used |
|---|---|---|---|
| button | PASS | — | `extract/computed/out/carbon/button/receipts/pair--primary.unset.enabled__default.png` |
| toggle | PASS | — | `extract/computed/out/carbon/toggle/receipts/pair--untoggled.enabled__default.png` |
| checkbox | FAIL | Control/label fidelity vs computed pairs still unverified after cream surface; fail closed until pair-level match confirmed. | `extract/computed/out/carbon/checkbox/receipts/pair--unchecked.enabled__default.png` |
| accordion | FAIL | Missing expanded body panel aesthetic vs Carbon accordion developed pairs. | `extract/computed/out/carbon/accordion/receipts/pair--end.unset.enabled__default.png` |
| icon-button | FAIL | Plus glyph placeholder only; not aesthetic match to computed iconbutton pairs — fail closed. | `extract/computed/out/carbon/iconbutton/receipts/pair--primary.unset.enabled__default.png` |
| inline-notification | FAIL | Warning/status iconography fidelity and layout artifacts not match to computed pairs — fail closed. | `extract/computed/out/carbon/inlinenotification/receipts/pair--error.high__default.png` |
| modal | FAIL | Dialog surface/footer button-set strip proportions not verified as match to pair--unset__default — fail closed. | `extract/computed/out/carbon/modal/receipts/pair--unset__default.png` |
| tabs | FAIL | Label truncation and missing Carbon selected underline/bar treatment vs computed tabs pairs. | `extract/computed/out/carbon/tabs/receipts/pair--__default.png` |
| tag | FAIL | Padding/type scale / High Contrast/Outline rows not verified as matchDeveloped — fail closed. | `extract/computed/out/carbon/tag/receipts/pair--unset.unset__default.png` |
| text-input | FAIL | Missing Carbon bottom-border emphasis / helper text vs computed textinput pairs. | `extract/computed/out/carbon/textinput/receipts/pair--unset.enabled__default.png` |

## polaris

| stem | match? | defects | reference used |
|---|---|---|---|
| button | FAIL | Contract tone enum is only critical\|success — no undefined/default Tone, so dark Polaris Primary (examples/polaris/receipts/button/variant-primary.png) cannot be projected.<br>Primary+Critical is flat red without Polaris top-highlight gradient of developed primary receipts.<br>Emit/contract gap, not an intentional COMPILE canvas projection. | `examples/polaris/receipts/button/variant-primary.png; examples/polaris/contracts/button.contract.json` |
| badge | FAIL | Pill radius/padding/progress glyph fidelity vs developed badge receipts incomplete — fail closed. | `examples/polaris/receipts/badge/default.png` |
| banner | FAIL | Warning icon / focus ring fidelity vs tone-* developed receipts — fail closed. | `examples/polaris/receipts/banner/tone-info.png` |
| avatar | FAIL | Saturated magenta placeholder not matching Polaris avatar developed defaults — fail closed. | `examples/polaris/receipts/avatar/default.png` |
| checkbox | FAIL | Unchecked/indeterminate geometry inverted vs Polaris checkbox; labels missing vs developed receipt. | `examples/polaris/receipts/checkbox/default.png` |
| progress-bar | FAIL | Track fills lack Polaris rounded-track fidelity vs developed progress-bar receipts — fail closed. | `examples/polaris/receipts/progress-bar/default.png` |
| radio-button | FAIL | Unchecked solid white disk / checked ring inverted vs Polaris radio outline+dot; labels missing. | `examples/polaris/receipts/radio-button/default.png` |
| spinner | FAIL | Arc contrast/color not match to developed spinner receipts — fail closed. | `examples/polaris/receipts/spinner/default.png` |
| tag | FAIL | Active/focus heavy borders atypical of Polaris Tag; size geometry inconsistent with developed tag receipt. | `examples/polaris/receipts/tag/default.png` |
| text-field | FAIL | Placeholder literal and borderless/disabled cells incomplete vs developed text-field receipt — fail closed. | `examples/polaris/receipts/text-field/default.png` |
| text | FAIL | Ultra-wide set illegible at review scale; type-scale match to minted styles / developed text receipts not confirmed — fail closed. | `examples/polaris/receipts/text/body-md.png` |
| thumbnail | FAIL | 0-radius gray squares; Polaris Thumbnails are rounded — geometry FAIL. | `examples/polaris/receipts/thumbnail/default.png` |

## tailwind

| stem | match? | defects | reference used |
|---|---|---|---|
| button | FAIL | Size ladder still not verified as Flowbite height scale fidelity vs pair--default.md.enabled__default.png — fail closed.<br>Cream surface improved reviewability; aesthetic match not claimed. | `extract/computed/out/tailwind/button/receipts/pair--default.md.enabled__default.png` |
| alert | FAIL | Missing Flowbite alert icons / dismiss control; text-only chips — fail closed. | `extract/computed/out/tailwind/alert/receipts/pair--info__default.png` |
| badge | FAIL | State Active/Hover fill shifts not verified vs Flowbite badge pairs — fail closed. | `extract/computed/out/tailwind/badge/receipts/pair--info.xs__default.png` |
| card | FAIL | Not a COMPONENT_SET; border/shadow aesthetic not match to Flowbite card pairs — fail closed. | `extract/computed/out/tailwind/card/receipts/pair--__default.png` |
| toggle-switch | FAIL | Tracks lack verified white thumb fidelity vs Flowbite toggleswitch pairs — fail closed. | `extract/computed/out/tailwind/toggleswitch/receipts/pair--md.unchecked__default.png` |

## altitude

| stem | match? | defects | reference used |
|---|---|---|---|
| avatar | FAIL | Set collapsed to 24×24 single variant — not match to developed altitude avatar scale — fail closed. | `extract/computed/out/altitude/avatar/receipts` |
| badge | FAIL | Not verified 1:1 vs altitude badge computed pairs — fail closed. | `extract/computed/out/altitude/badge/receipts` |
| button | FAIL | Khaki/orange/blue matrix present on cream surface but not claimed match to altitude button computed pairs — fail closed. | `extract/computed/out/altitude/button/receipts` |
| chip | FAIL | Not verified vs altitude chip computed pairs — fail closed. | `extract/computed/out/altitude/chip/receipts` |
| divider | FAIL | 1×100 stub geometry not a developed divider aesthetic — fail closed. | `extract/computed/out/altitude/divider/receipts` |
| heading | FAIL | Type scale not verified vs altitude heading computed pairs — fail closed. | `extract/computed/out/altitude/heading/receipts` |
| icon-close | FAIL | Not verified vs altitude icon-close computed pairs — fail closed. | `extract/computed/out/altitude/iconclose/receipts` |
| link | FAIL | Not verified vs altitude link computed pairs — fail closed. | `extract/computed/out/altitude/link/receipts` |
