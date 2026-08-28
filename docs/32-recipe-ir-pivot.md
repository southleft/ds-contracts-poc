# 32 · The recipe/IR pivot — archetype recipes over a canonical Figma IR

> **Current correction status (supersedes status claims below; historical
> evidence bytes are not rewritten): V7 attempt 1 is closed. The signed writer
> and extract succeeded on Scratch (2×128 variants, 2316 created nodes); host
> normalize/account then refused
> `boundVariables.strokeBottomWeight: unsupported field strokeBottomWeight`.
> That normalizer is in the v7 antecedent hash set and was not patched in
> place. Persisted cleanup completed; owned Input page/collections are gone;
> no captures; no live success. V8 is the replacement lineage: it teaches
> per-side stroke-weight bindings (`strokeTopWeight`, `strokeRightWeight`,
> `strokeBottomWeight`, `strokeLeftWeight`, plus the uniform `strokeWeight`
> sibling) and names the transport facts (one-call disk operator, honor signed
> 300000ms timeout, reconstruct `fileContext.editorType` from the exact Scratch
> target). V8 prepare is published at
> `9e34ee653b07e705ef6309cc3d900add81fba47b`. Authorization was first
> committed at `e163d85787c4449de269ca4314bda9c75a289395`. V8 attempt 1 ran
> Scratch-only: writer accepted (2317 created nodes), extract raw returned
> (~8.3MB), then host normalize/account refused
> `strokes.0.weight.{top,right,bottom,left} is not compatible with FLOAT` in
> `recipe/figma-ir.ts` via `scene-readback.ts`. That IR file is not in the v8
> antecedent hash set and was taught for attempt 2. Attempt 2 then failed
> closed: writer and extract succeeded again, but host normalize refused
> `payload.fills.0.kind` because live fills include `VARIABLE_ALIAS` (1408)
> and bound-variable-only paints (1514). `scene-readback.ts` is in the v8
> antecedent hash set and must not be patched in place. Cleanup accepted;
> owned Input pages are gone; no captures; no live success. Do not restart v8
> attempt 3 as-is. V9 is the replacement lineage: it copies the v8 stack and
> teaches `VARIABLE_ALIAS` and bound-variable-only fills in a carried
> `scene-readback-v9.ts` / `scene-readback-runtime-v9.ts` without restamping
> v8 antecedent bytes. V9 prepare is published at
> `1a16642bddbb8c8a3fb44cd0e086a7ff8328e294`. The separate authorization
> artifact is present and pins that antecedent; commit state is derived from
> Git history. V9 attempt 1 ran Scratch-only: writer accepted (2317 created
> nodes), extract raw returned (~8.3MB), then host normalize/account refused
> unrecognized `strokes`, `effects`, and `cornerRadius` on a component-set at
> `recipe/scene-readback-v9.ts:1139`. That scene-readback file stays hashed;
> unhashed `figma-ir.ts` is taught those component-set fields for attempt 2.
> Attempt 2 then failed closed: writer and extract succeeded again, component-set
> strokes/effects/cornerRadius cleared, but host normalize/account still ran
> hashed `recipe/input-field-live-v3-verifier.ts` → `recipe/scene-readback.ts`
> and refused `payload.fills.0.kind` (`VARIABLE_ALIAS` / bound-variable-only
> fills). `scene-readback.ts` is not in the v9 antecedent hash set, but the
> v3 verifier that calls it is hashed and must not be patched in place.
> Cleanup accepted; owned Input pages are gone; no captures; no live success.
> Do not restart v9 attempt 3 as-is. V10 is the replacement lineage: it copies
> the v9 stack and carries `scene-readback-v10.ts` plus
> `input-field-live-v3-verifier-v10.ts` so live host normalize/account does not
> call hashed `scene-readback.ts`. V10 prepare is published at
> `0da647b79ed8a2660b9858c6008a08cbae8dbbf3`. The separate authorization
> artifact pins that antecedent; commit state is derived from Git history.
> Live execution remains forbidden until runtime security prerequisites pass.
> Writer bytes stay frozen from v8/v9. V10 attempt 1 ran Scratch-only: writer
> accepted (2317 created nodes), extract raw returned (~8.3MB), hashed
> `scene-readback.ts` was no longer on the host path, then collapse refused
> Size axis order `medium,small` versus declared `small,medium` in unhashed
> `recipe/recipes/input-field.ts`. Cleanup accepted; owned Input pages are
> gone; no captures; no live success. Axis-value order is taught as
> non-structural for attempt 2. V10 attempt 2 then failed closed: writer and
> extract succeeded again, Size axis order cleared, but host collapse refused
> `input-field/message/helper` because hashed `sceneRole` treats names that
> contain `font-provenance=` as variant-like and drops live text roles. Helper
> text is present on all 256 variants and recoverable from the first ` :: `
> segment. `scene-readback-v10.ts` is in the v10 antecedent hash set and must
> not be patched in place. Cleanup accepted; owned Input pages are gone; no
> captures; no live success. Do not restart v10 attempt 3 as-is. V11 is the
> replacement lineage: it copies the v10 stack and recovers text roles from
> the first \` :: \` name segment even when a later \`font-provenance=\`
> segment is present. Writer bytes stay frozen from v8/v9/v10. V11 prepare
> is published at `f1861d527dd09345c56ee862de7776fbc4d0a7a2`. Authorization
> is published at `41fc8c77e01a670a38d5cdfb97feba80b638f72e`. V11 attempt 1
> ran Scratch-only: writer accepted (2317 created nodes), extract raw
> returned (8402407 bytes), hashed first-segment role recovery cleared the
> helper-text refusal, then host collapse refused
> `input content must fill the horizontal surface` on MUI
> `medium/default/placeholder/false/none`. Extract shows MUI content
> 104/128 FILL and 24/128 FIXED (all placeholder, Adornments none or
> trailing); Polaris 128/128 FILL. Frozen writer already sets those texts to
> FILL after property bind; Figma later reports FIXED. Do not teach the
> recipe to accept FIXED. Do not restart v11 attempt 2 as-is. Writer bytes
> are in the v11 hash set; the next lineage must re-assert FILL after the
> component set settles. Cleanup accepted; owned Input pages are gone; no
> captures; no live success. V12 is the replacement lineage: it copies the
> v11 stack and carries a writer that re-asserts placeholder/value FILL
> after the component set settles, using the first name segment and
> `textAutoResize=HEIGHT`. V11 writer bytes stay frozen. V12 prepare is
> published at `8570f3e8c318977a51f5f41a7474dcc535b53b26`. Authorization is
> published at `aec7918a6e211be4832e72a3cb6ebfb1cd350869`. V12 attempt 1 ran
> Scratch-only: writer accepted (2317 created nodes), extract raw returned
> (8402407 bytes), then host collapse refused the same MUI content-fill
> check. Extract still shows MUI 104/128 FILL and 24/128 FIXED; Polaris
> 128/128 FILL. In-writer restore did not change the live scene. Do not
> teach the recipe to accept FIXED. Do not restart v12 attempt 2 as-is. The
> next lineage must restore FILL in a signed request after the writer
> plugin returns. Cleanup accepted; owned Input pages are gone; no
> captures; no live success. V13 is the replacement lineage: it copies the
> v12 stack and adds a signed post-writer restore request that re-asserts
> content FILL after the writer plugin returns and before extract. V12
> writer bytes stay frozen. This is a protocol denominator change (133
> remote requests). V13 prepare is published at
> `4c0710109f4e8a2eba701afe96ba4af9f4924dad`. Authorization is published at
> `e21a67cac447e90a38b344ee34af8528b2dd205c`. V13 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, then the hashed
> post-writer restore threw `INPUT-V13-RESTORE-NOT-FILL`. Extract was not
> issued. Do not teach the recipe to accept FIXED. Do not restart v13
> attempt 2 as-is. The next lineage must not patch hashed v13 restore bytes.
> Cleanup accepted; owned Input pages are gone; no captures; no live success.
> V14 is the replacement lineage: it copies the v13 stack and teaches a
> two-pass restore that fills parent surface/content-row first, then
> re-asserts content HEIGHT+FILL, revealing hidden texts only for that
> assignment. V13 writer and restore bytes stay frozen. Do not teach FIXED.
> V14 prepare is published at
> `961d08f94853d2b90cd3b68963f5bc113e5ae066`. Authorization is published at
> `eae2dfb3e884b2b71c2de6814a5586cc85b9443c`. V14 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, then the hashed
> two-pass restore threw `INPUT-V14-RESTORE-NOT-FILL`. Extract was not
> issued. Do not teach the recipe to accept FIXED. Do not restart v14
> attempt 2 as-is. The next lineage must not patch hashed v14 restore bytes.
> Cleanup accepted; owned Input pages are gone; no captures; no live success.
> V15 is the replacement lineage: it copies the v14 stack and teaches a
> restore that measures content FILL **while the text is still visible**,
> then restores visibility. V14 writer and restore bytes stay frozen. Do
> not teach FIXED. V15 prepare is published at
> `c1d3f0ac38f00fd005e80ed4d9e35ff393dbad58`. Authorization is published at
> `4002cb3be87c52ddfa32e2fa15c6bfbdc251238b`. V15 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8402467 bytes). Host collapse refused the same MUI content-fill check.
> Extract still shows MUI 104/128 FILL and 24/128 FIXED (all hidden
> placeholders); Polaris 128/128 FILL. Do not teach the recipe to accept
> FIXED. Do not restart v15 attempt 2 as-is. The next lineage must not
> patch hashed v15 restore bytes. Cleanup accepted; owned Input pages are
> gone; no captures; no live success.
> V16 is the replacement lineage: it copies the v15 stack and teaches
> extract to measure hidden content `layoutSizingHorizontal` **while the
> text is still visible**, then restore visibility before other fields.
> V15 writer, restore, and extract-runtime bytes stay frozen. Do not teach
> FIXED. V16 prepare is published at
> `a764804c4191d161d08ab9527938ce6d29009af7`. Authorization is published at
> `8511c9ca722c9f30c526ce5eb99fa9f4e485d9ec`. V16 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8402443 bytes). Hidden-content FILL teaching cleared the v15 24 MUI
> FIXED cells: MUI 128/128 FILL, Polaris 128/128 FILL. Host collapse then
> refused leading-slot solid paint. All 64+64 leading slot frames extract
> with empty `fills[]`; SOLID paint is on the adornment-content child and
> `instancePayload.fills`. Do not teach FIXED. Do not restart v16 attempt 2
> as-is. The next lineage must not patch hashed v16 extract/runtime bytes.
> Cleanup accepted; owned Input pages are gone; no captures; no live
> success.
> V17 is the replacement lineage: it copies the v16 stack and teaches host
> scene-readback to surface leading/trailing slot solid paint from
> `instancePayload.fills` or the adornment-content child when the slot
> node's own `fills[]` is empty. V16 writer, restore, runtime, and extract
> bytes stay frozen. Do not teach FIXED. V17 prepare is published at
> `2a764e90d7683afd39ab08ad5b8cbf3e639c56a2`. Authorization is published at
> `36dfcad20ecd04d9ff5eddcbe476a60ec66bc940`. V17 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8402443 bytes). Slot-fill teaching surfaced SOLID so host no longer
> refused `fills[0]` as a solid paint. Host collapse then refused the
> leading-slot `fills.0.color` token binding. All 64+64 leading slot
> frames extract with empty `fills[]`; SOLID is on the child and
> `instancePayload.fills`; the COLOR binding lives on the adornment-content
> child, not the slot node. Do not teach FIXED. Do not invent a binding.
> Do not restart v17 attempt 2 as-is. The next lineage must not patch
> hashed v17 scene-readback bytes. Cleanup accepted; owned Input pages
> are gone; no captures; no live success.
> V18 is the replacement lineage: it copies the v17 stack and teaches host
> scene-readback to surface leading/trailing slot `fills.0.color` from the
> adornment-content child's existing COLOR binding when the slot node's
> own bindings lack it. V16 writer, restore, runtime, and extract bytes
> stay frozen. Hashed v17 scene-readback stays frozen. Do not teach FIXED.
> Do not invent a variable. V18 prepare is published at
> `cfdc6a7cff19b619640dc9dcea0d79a79f1ade75`. Authorization is published at
> `829f7c5217e3f4f5342cb2111112b6abb448a29a`. V18 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8402443 bytes). Slot-color teaching surfaced `fills.0.color` so host no
> longer refused the v17 slot-binding gate. Host collapse then refused the
> surface `strokes.0.weight` token binding. All 128+128 surface nodes bind
> the four per-side stroke weights to the same FLOAT and bind no
> `strokeWeight` / `strokes.0.weight`. Do not teach FIXED. Do not invent a
> binding. Do not restart v18 attempt 2 as-is. The next lineage must not
> patch hashed v18 scene-readback bytes. Cleanup accepted; owned Input pages
> are gone; no captures; no live success.
> V19 is the replacement lineage: it copies the v18 stack and teaches host
> scene-readback to surface `strokes.0.weight` from the existing uniform
> per-side stroke-weight FLOAT when the surface node's own `strokeWeight`
> is absent. V16 writer, restore, runtime, and extract bytes stay frozen.
> Hashed v18 scene-readback stays frozen. Do not teach FIXED. Do not invent
> a variable. V19 prepare is published at
> `53e0ee50e1c7ab08442bec8b666cd95cbd92e600`. Authorization is published at
> `d3b5429cac9df5877143dfb79e617b544d7688f0`. V19 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8402443 bytes). Host collapse refused variant `layout.width.value`.
> The first none-adornment variant binds Figma `width` to an existing FLOAT
> and binds no `layout.width.value`. Scene-readback maps `width` to
> `width.value`. Do not teach FIXED. Do not invent a variable. Do not
> restart v19 attempt 2 as-is. The next lineage must not patch hashed v19
> scene-readback bytes. Cleanup accepted; owned Input pages are gone; no
> captures; no live success.
> V20 is the replacement lineage: it copies the v19 stack and teaches host
> scene-readback to surface variant `layout.width.value` from the existing
> Figma `width` / `width.value` FLOAT when `layout.width.value` is absent.
> V16 writer, restore, runtime, and extract bytes stay frozen. Hashed v19
> scene-readback stays frozen. Do not teach FIXED. Do not invent a
> variable. V20 prepare is published at
> `d49f2da22d897b4a42e1a0e0f8ef302c61383417`. Authorization is published at
> `2cd501781de9684d175c5daf71f22fdae60410c2`. V20 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8404014 bytes). Host collapse refused surface `layout.height.value`.
> Every surface binds Figma `height` to an existing FLOAT and binds no
> `layout.height.value`. Scene-readback maps `height` to `height.value`.
> Host did not refuse variant `layout.width.value` this attempt. Do not
> teach FIXED. Do not invent a variable. Do not restart v20 attempt 2
> as-is. The next lineage must not patch hashed v20 scene-readback bytes.
> Cleanup accepted; owned Input pages are gone; no captures; no live
> success.
> V21 is the replacement lineage: it copies the v20 stack and teaches host
> scene-readback to surface `layout.height.value` from the existing Figma
> `height` / `height.value` FLOAT when `layout.height.value` is absent.
> Surface roles only. V16 writer, restore, runtime, and extract bytes stay
> frozen. Hashed v20 scene-readback stays frozen. Do not teach FIXED. Do
> not invent a variable. Authorization is published at
> `33108d6b18f2b37f9e03359949ce757554ae4c44`. V21 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8436213 bytes). Host did not refuse surface `layout.height.value`. Host
> collapse then refused `$.children[0].bindings.length`. The first variant
> has four bindings after scene-readback (`layout.itemSpacing`,
> `layout.minWidth`, `width.value`, `layout.width.value`); recipe compile
> emits three none-adornment variant bindings and does not emit
> `width.value`. Do not teach FIXED. Do not invent a variable. Do not
> restart v21 attempt 2 as-is. The next lineage must not patch hashed v21
> scene-readback bytes. Cleanup accepted; owned Input pages are gone; no
> captures; no live success.
> V22 is the replacement lineage: it copies the v21 stack and teaches host
> scene-readback to alias `layout.width.value` / `layout.height.value` from
> the existing Figma width/height FLOAT without leaving a duplicate
> `width.value` / `height.value` binding. Variant width and surface height
> roles only. V16 writer, restore, runtime, and extract bytes stay frozen.
> Hashed v21 scene-readback stays frozen. Do not teach FIXED. Do not invent
> a variable. Authorization is published at
> `281bb2594408ebbfef6b332c2f8b7b05a56bd7b9`. V22 attempt 1 ran Scratch-only:
> writer accepted (2317 created nodes), cleanup persisted, hashed
> measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8436213 bytes). Host did not refuse `bindings.length`. Host collapse
> then refused `$.children[0].bindings[1].field`. After scene-readback-v22
> the first variant has three bindings (`layout.itemSpacing`,
> `layout.minWidth`, `layout.width.value`); recipe compile emits the same
> three none-adornment fields as `layout.itemSpacing`,
> `layout.width.value`, `layout.minWidth`. The alias appends
> `layout.width.value` after dropping `width.value`. Do not teach FIXED.
> Do not invent a variable. Do not restart v22 attempt 2 as-is. The next
> lineage must not patch hashed v22 scene-readback bytes. Cleanup
> accepted; owned Input pages are gone; no captures; no live success.
> V23 is the replacement lineage: it copies the v22 stack and teaches host
> scene-readback to place aliased `layout.width.value` at the recipe
> compile index (after `layout.itemSpacing`, before `layout.minWidth`)
> instead of appending it. Variant width role only. V16 writer, restore,
> runtime, and extract bytes stay frozen. Hashed v22 scene-readback stays
> frozen. Do not teach FIXED. Do not invent a variable. Authorization is
> published at `3d0791b41d59dfca1c803a02ed917b8aecde2c5f`. V23 attempt 1
> ran Scratch-only: writer accepted (2317 created nodes), cleanup
> persisted, hashed measure-while-visible restore accepted
> (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0),
> then extract issued (8436213 bytes). Host did not refuse variant
> `bindings[1].field`. Host collapse then refused
> `$.children[0].children[0].bindings.length`. After scene-readback-v23
> the first variant has three bindings in compile order
> (`layout.itemSpacing`, `layout.width.value`, `layout.minWidth`). The
> MUI first-variant first child is `input-field/surface` with 18 host
> bindings versus 12 recipe-compile bindings. Do not teach FIXED. Do not
> invent a variable. Do not restart v23 attempt 2 as-is. The next lineage
> must not patch hashed v23 scene-readback bytes. Cleanup accepted; owned
> Input pages are gone; no captures; no live success.
> V24 is the replacement lineage: it copies the v23 stack and teaches host
> scene-readback to drop extra surface bindings that collapse treats as a
> structural length edit (duplicate mapped `fills.0` / `strokes.0` color
> fields, and per-side stroke weights once the uniform `strokes.0.weight`
> alias is present). Surface role only. V16 writer, restore, runtime, and
> extract bytes stay frozen. Hashed v23 scene-readback stays frozen. Do
> not teach FIXED. Do not invent a variable. Authorization is
> published at `5530ad3d4040faa45a0d03943b6da48c618daaf4`. V24 attempt 1
> ran Scratch-only: writer accepted (2317 created nodes), cleanup
> persisted, hashed measure-while-visible restore accepted
> (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0),
> then extract issued (8436213 bytes). Host did not refuse surface
> `bindings.length`. Host collapse then refused
> `$.children[0].children[0].bindings[0].field`. After scene-readback-v24
> the MUI first-variant first child is `input-field/surface` with 12 host
> bindings matching the 12 recipe-compile bindings, but host remaining
> order starts at `cornerRadius.bottomLeft` while compile starts at
> `layout.padding.right`. Do not teach FIXED. Do not invent a variable.
> Do not restart v24 attempt 2 as-is. The next lineage must not patch
> hashed v24 scene-readback bytes. Cleanup accepted; owned Input pages
> are gone; no captures; no live success.
> V25 is the replacement lineage: it copies the v24 stack and teaches host
> scene-readback to place remaining surface bindings at the recipe compile
> field order after extras are dropped. Surface role only. V16 writer,
> restore, runtime, and extract bytes stay frozen. Hashed v24
> scene-readback stays frozen. Do not teach FIXED. Do not invent a
> variable. Authorization is
> published at `dcbeaabf15405006489ed6d2ec6aa3eb5b4ffe8f`. V25 attempt 1
> ran Scratch-only: writer accepted (2317 created nodes), cleanup
> persisted, hashed measure-while-visible restore accepted
> (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0),
> then extract issued (8436213 bytes). Host did not refuse surface
> `bindings[0].field`. Host collapse then refused
> `$.children[0].children[0].children[0].children[0].bindings[0].field`.
> After scene-readback-v25 the MUI first-variant first child is
> `input-field/surface` with 12 host bindings in compile order starting
> at `layout.padding.right`. The refused node is MUI
> `input-field/content/placeholder`: host remaining order starts at
> `fills.0.color` (4 bindings including a duplicate mapped color) while
> compile starts at `type.fontSize` (3 bindings). Do not teach FIXED.
> Do not invent a variable. Do not restart v25 attempt 2 as-is. The next
> lineage must not patch hashed v25 scene-readback bytes. Cleanup
> accepted; owned Input pages are gone; no captures; no live success.
> V26 is the replacement lineage: it copies the v25 stack and teaches host
> scene-readback to drop extra content/placeholder and content/value
> bindings, then place remaining known fields at the recipe compile
> field order (`type.fontSize`, `type.lineHeight.value`, `fills.0.color`).
> Content roles only. V16 writer, restore, runtime, and extract bytes
> stay frozen. Hashed v25 scene-readback stays frozen. Do not teach
> FIXED. Do not invent a variable. Authorization is
> published at `3ca842739d6b45ab40f054f129d4b38b618207a2`. V26 attempt 1
> ran Scratch-only: writer accepted (2317 created nodes), cleanup
> persisted, hashed measure-while-visible restore accepted
> (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0),
> then extract issued (8436213 bytes). Host did not refuse content
> `bindings[0].field`. Host collapse then refused
> `$.children[0].children[0].children[0].children[0].height.mode`.
> After scene-readback-v26 the MUI first-variant content placeholder has
> 3 host bindings in compile order starting at `type.fontSize`. Host
> emits `height.mode` fixed (value 23) on that hidden placeholder;
> compile emits hug. Content width stayed MUI 128/128 FILL and Polaris
> 128/128 FILL. Content height is MUI 24 FIXED / 104 HUG (the 24 FIXED
> are hidden floating placeholders) and Polaris 128/128 HUG. Do not
> teach FIXED as a fill. Do not invent a variable. Do not restart v26
> attempt 2 as-is. The next lineage must not patch hashed v26
> scene-readback bytes. Cleanup accepted; owned Input pages are gone; no
> captures; no live success. V27 is the replacement lineage: it copies
> the v26 stack and teaches host scene-readback to emit hug height for
> hidden content/placeholder and content/value text whose live
> `layoutSizingVertical` is FIXED after measure-while-visible. Content
> roles only. Do not rewrite visible FIXED height. Do not invent a
> variable. Do not teach FIXED as a fill. V16 writer, restore, runtime,
> and extract bytes stay frozen. Hashed v26 scene-readback stays frozen.
> Authorization is published at `64214da458c4f12baacdefe618b0f994b9b0be26`.
> V27 attempt 1 ran Scratch-only: writer accepted (2317 created nodes),
> cleanup persisted, hashed measure-while-visible restore accepted
> (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0),
> then extract issued (8436213 bytes). Host did not refuse
> `height.mode`. Host collapse then refused
> `$.children[0].children[0].children[0].children[0].type.letterSpacing`.
> After scene-readback-v27 the MUI first-variant content placeholder has
> 3 host bindings in compile order starting at `type.fontSize` and host
> `height.mode` hug. Host emits `type.letterSpacing` percent 0; compile
> omits letterSpacing. Content width stayed MUI 128/128 FILL and Polaris
> 128/128 FILL. Do not teach FIXED as a fill. Do not invent a variable.
> Do not invent a letterSpacing value. Do not restart v27 attempt 2
> as-is. The next lineage must not patch hashed v27 scene-readback
> bytes. Cleanup accepted; owned Input pages are gone; no captures; no
> live success. V28 is the replacement lineage: it copies the v27 stack
> and teaches host scene-readback to omit content/placeholder and
> content/value `type.letterSpacing` that recipe compile never emits.
> Content roles only. Do not invent a letterSpacing value. Do not invent
> a variable. Do not teach FIXED as a fill. V16 writer, restore, runtime,
> and extract bytes stay frozen. Hashed v27 scene-readback stays frozen.
> Authorization is published at `6d450ef6bc985816a18a30d17b9893dde9f51fd0`.
> V28 attempt 1 ran Scratch-only: writer accepted (2317 created nodes),
> cleanup persisted, hashed measure-while-visible restore accepted
> (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0),
> then extract issued (8436213 bytes). Host did not refuse
> `type.letterSpacing`. Host collapse then refused
> `$.children[0].children[0].children[0].children[0].type.textCase`.
> After scene-readback-v28 the MUI first-variant content placeholder has
> 3 host bindings in compile order starting at `type.fontSize`, host
> `height.mode` hug, and no `type.letterSpacing`. Host emits
> `type.textCase` original; compile omits textCase. Content width stayed
> MUI 128/128 FILL and Polaris 128/128 FILL. Do not teach FIXED as a
> fill. Do not invent a variable. Do not invent a textCase value. Do
> not restart v28 attempt 2 as-is. The next lineage must not patch
> hashed v28 scene-readback bytes. Cleanup accepted; owned Input pages
> are gone; no captures; no live success. V29 is the replacement lineage:
> it copies the v28 stack and teaches host scene-readback to omit
> content/placeholder and content/value `type.textCase` that recipe
> compile never emits. Content roles only. Do not invent a textCase
> value. Do not invent a variable. Do not teach FIXED as a fill. V16
> writer, restore, runtime, and extract bytes stay frozen. Hashed v28
> scene-readback stays frozen. Authorization is published at
> `a19285e26afed6121b7e6987838e434d1881ebca`. V29 attempt 1 ran
> Scratch-only: writer accepted (2317 created nodes), cleanup persisted,
> hashed measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8436213 bytes). Host did not refuse `type.textCase`. Host collapse
> then refused
> `$.children[0].children[0].children[0].children[0].type.textDecoration`.
> After scene-readback-v29 the MUI first-variant content placeholder has
> 3 host bindings in compile order starting at `type.fontSize`, host
> `height.mode` hug, no `type.letterSpacing`, and no `type.textCase`.
> Host emits `type.textDecoration` none; compile omits textDecoration.
> Content width stayed MUI 128/128 FILL and Polaris 128/128 FILL. Do not
> teach FIXED as a fill. Do not invent a variable. Do not invent a
> textDecoration value. Do not restart v29 attempt 2 as-is. The next
> lineage must not patch hashed v29 scene-readback bytes. Cleanup
> accepted; owned Input pages are gone; no captures; no live success.
> V30 is the replacement lineage: it copies the v29 stack and teaches
> host scene-readback to omit content/placeholder and content/value
> `type.textDecoration` that recipe compile never emits. Content roles
> only. Do not invent a textDecoration value. Do not invent a variable.
> Do not teach FIXED as a fill. V16 writer, restore, runtime, and
> extract bytes stay frozen. Hashed v29 scene-readback stays frozen.
> Authorization is published at
> `babb6e5db745e7eb36037b069dce8a54983f2dec`. V30 attempt 1 ran
> Scratch-only: writer accepted (2317 created nodes), cleanup persisted,
> hashed measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8436213 bytes). Host did not refuse `type.textDecoration`. Host
> collapse then refused
> `$.children[0].children[0].children[0].clipsContent`. After
> scene-readback-v30 the MUI first-variant content placeholder has 3
> host bindings in compile order starting at `type.fontSize`, host
> `height.mode` hug, no `type.letterSpacing`, no `type.textCase`, and no
> `type.textDecoration`. Host emits content-row `clipsContent` true;
> compile omits clipsContent on content-row. Content width stayed MUI
> 128/128 FILL and Polaris 128/128 FILL. Polar has 0 content-row nodes.
> Do not teach FIXED as a fill. Do not invent a variable. Do not invent
> a clipsContent value. Do not restart v30 attempt 2 as-is. The next
> lineage must not patch hashed v30 scene-readback bytes. Cleanup
> accepted; owned Input pages are gone; no captures; no live success.
> V31 is the replacement lineage: it copies the v30 stack and teaches
> host scene-readback to omit `input-field/content-row` `clipsContent`
> that recipe compile never emits. Content-row role only. Do not invent
> a clipsContent value. Do not invent a variable. Do not teach FIXED as
> a fill. Do not lift the omit onto labels. V16 writer, restore,
> runtime, and extract bytes stay frozen. Hashed v30 scene-readback
> stays frozen. Authorization is published at
> `38a97734a6b0a1a37d877e75c9973d3fd69acbba`. V31 attempt 1 ran
> Scratch-only: writer accepted (2317 created nodes), cleanup persisted,
> hashed measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8436213 bytes). Host did not refuse content-row `clipsContent`. Host
> collapse then refused
> `$.children[0].children[0].children[0].cornerRadius`. After
> scene-readback-v31 the MUI first-variant content-row has
> `clipsContent` omitted and still emits `cornerRadius` `{0,0,0,0}`.
> Compile omits content-row `cornerRadius`. Polar has 0 content-row
> nodes. Do not invent a cornerRadius value. Do not restart v31 attempt
> 2 as-is. The next lineage must not patch hashed v31 scene-readback
> bytes. Cleanup accepted; owned Input pages are gone; no captures; no
> live success.
> V32 is the replacement lineage: it copies the v31 stack and teaches
> host scene-readback to omit `input-field/content-row` `cornerRadius`
> that recipe compile never emits. Content-row role only. Do not invent
> a cornerRadius value. Do not invent a variable. Do not teach FIXED as
> a fill. Do not lift the omit onto labels. V16 writer, restore,
> runtime, and extract bytes stay frozen. Hashed v31 scene-readback
> stays frozen. Authorization is published at
> `4bb5a7fe225a90c42037de5797bfcf3101aae298`. V32 attempt 1 ran
> Scratch-only: writer accepted (2317 created nodes), cleanup persisted,
> hashed measure-while-visible restore accepted (`restoredCount` 256,
> `hiddenRevealedForFill` 24, `retriedForFill` 0), then extract issued
> (8436213 bytes). Host did not refuse content-row `clipsContent` or
> `cornerRadius`. Host collapse then refused
> `$.children[0].children[0].children[0].effects`. After
> scene-readback-v32 the MUI first-variant content-row has
> `clipsContent` omitted, `cornerRadius` omitted, and still emits
> `effects` `[]`. Compile omits content-row `effects`. Polar has 0
> content-row nodes. Do not invent an effects value. Do not restart v32
> attempt 2 as-is. The next lineage must not patch hashed v32
> scene-readback bytes. Cleanup accepted; owned Input pages are gone; no
> captures; no live success.
> Button overall success is false/pending.
> Its technical mint, usability, restoration, and 12/12 adjudication bytes are
> retained, but the human grade is not attributable and the historical live
> inversion/accounting was self-referential. Input overall success is false and
> blocked: live v2 improved aggregate geometry and pixel/ink versus legacy but
> still fails adornment-content and MUI-stratum safeguards. Commit
> `be6b01300ad99d8a29ea4c11508d192dec84bbea` now fixes the exact prospective
> `input-live-v3` criterion bytes before capture authorization. A separate
> authorization artifact was first committed at
> `ad7e02d3bfaf79f757ff63085c0a24a64a5c4c7b`. The typed runner, verifier,
> preflight, and evidence writer were committed at
> `5e95105b16f3e30e0fb67a53a6eda7a86c105c61`. All three v3 attempts are now
> permanently exhausted. Attempts 1 and 2 each decoded
> and evaluated their exact committed writer and minted both 128-variant sets.
> Attempt 1 hard-failed because the Figma sandbox's `TextDecoder` is not
> constructible. Attempt 2 passed that correction, then hard-failed before
> extraction on read-only descendant `I86:38597;86:38583`, generated from
> owned instance `86:38597` and helper text `86:38583`, because the descendant
> cannot carry direct shared plugin data. Both attempts measured zero scene
> facts and no objective rows. Runner cleanup failed both times; separate
> exact-ownership manual cleanup restored the unrelated Scratch fingerprint.
> Attempt 3 ran from committed descendant
> `6903d31eb015933a6796722d25f6155fb13332ce`: writer and portable runtime
> returned and 128 captures were persisted, then host normalization failed at
> `recipe/scene-readback.ts:982` on Figma's alias-array fields (`fills.0`,
> `fontSize.0`, `lineHeight.0`) and object-valued `letterSpacing`. No scene,
> accounting, fixed-point, usability, restoration, or objective value is
> assigned. Captures remain unscored. Exact attempt IDs were lost by the
> nontransactional runner. Ownership cleanup left zero pages/collections and
> restored Scratch fingerprint `10ba6b57da3cfa97` exactly.
> Current machine status is
> `recipe/evidence/status-index.json`; exhausted v3 evidence is
> `recipe/evidence/input-field-live-pivot-v3/index.json`. V4 protocol commit
> `25b820868104be65194f83e154f59b70aacf2bae` and authorization commit
> `bd343680b446a828190f176e525e5616752f9e5f` passed authorization and preflight,
> but the committed entrypoint then called `refuseDraftExecution()` before phase
> 1, writer construction, or any bridge invocation. V4 therefore produced zero
> generated writer/transport artifacts, journals, Figma artifacts, or captures
> and no attempt or result. Existing v4 bytes remain unchanged; the failure is
> recorded at `recipe/evidence/input-field-live-pivot-v4-failure.json`. Its
> pre/post fields repeat the last exact verified Scratch fingerprint
> `10ba6b57da3cfa97`; they are not new v4 observations because no bridge call
> occurred.
>
> V5 is the replacement executable antecedent. It retains every v4 product
> criterion and threshold and adds a generated 2×128 writer, exact-byte
> transport, expected scene plans, authorization-aware orchestration, and
> immediate hash-chained journals. The green executable antecedent is
> `a29d034b746d0831ce93f88f1aeb5630ad4b0453`; its protocol was first added by
> `e9f9712a55147a4329f51cfd4bf024866dfd489f`. The separate authorization was
> first committed and published at
> `7c240e7862ee4b97d9da5002c7f2a02827477413`.
>
> A boundary review after authorization found that v5 still cannot run
> honestly. Cursor owns the local MCP stdio session; its HTTP listener exposes
> health only, and its WebSocket listener is the server side used by Desktop
> Bridge plugin clients, not a repository RPC endpoint. The installed MCP does
> support a separate standard MCP stdio client launching another local server,
> and a read-only exact-target probe proved that route against Scratch. That
> transport finding does not repair the v5 transaction contract: its raw phase
> returns one scene although the writer creates two independent set roots, its
> accounting hashes a normalization of itself instead of comparing both pinned
> expected plans, and its writer plan has no objective-cell/reference manifest.
> A v5 adapter that returned success would therefore fake required semantics.
>
> V6's protocol and signed two-root broker are technically complete, and its
> separate authorization history is valid: antecedent
> `8737fab9f35aeae43b25734e8f9709a4247c379b`, authorization
> `e5d6814982cbbe498ed630e7d988eae10bcb5d77`. The comprehensive v6 check is
> nevertheless red after authorization because a unit self-test calls the real
> repository verifier and asserts that authorization must still be uncommitted.
> Its generated index also hashes authorization lifecycle files, so repairing
> that assertion in place would drift the preserved index. No v6 live attempt
> occurred. V6 is retired before use by
> `recipe/evidence/input-field-live-pivot-v6-superseding-status.json`; its
> protocol, authorization, and index bytes are unchanged.
>
> V7 carries the same product and broker criteria into a phase-stable antecedent:
> two independent roots (22,811 MUI facts and 20,915 Polaris facts), 256 variant
> probes, 128 ordered one-cell captures, 132 signed requests, exact Scratch
> targeting, no capture before hash-bound technical gates, durable cleanup after
> host failure, and mandatory human signoff. The immutable broker and runner are
> separate from `input-field-live-v7-authorized.ts`, the history verifier,
> preflight, tests, authorization template, and current status. None of those
> lifecycle files enters
> `recipe/evidence/input-field-live-pivot-v7/antecedent-index.json`.
>
> `npm run recipe:input-field:live:v7:check` is phase-stable. Unit tests use only
> pending/changed/committed fixtures. The separate integration command requires
> an explicit phase: run
> `npm run recipe:input-field:live:v7:history:verify -- --expect-pending-v2`
> while the replacement is uncommitted, then
> `npm run recipe:input-field:live:v7:history:verify -- --expect-authorized-v2`
> after its later commit is published. The offline lifecycle
> simulation creates synthetic Git antecedent and authorization commits and
> proves that the same generated antecedent remains byte-green in both phases.
>
> The first v7 authorization remains byte-identical at SHA-256
> `43277ff2f422c9117e2f4f1b5c0fea241cc967977666529d91e0f14fd7489fda`,
> but is superseded and unusable because its signer private key was not
> retained. Criteria did not change. Replacement
> `capture-authorization-v2.json` pins the same antecedent
> `117f1cddce797393b1b705da62323615e584d54b`; its artifact SHA-256 is
> `de501693a52b0d050fc1b7048a355ca9195c3ca2ab982a28fd1b9509c397e76d`
> and its Ed25519 SPKI identity SHA-256 is
> `8eb7c6f6fcd2bd497997028f8e026abc30d8af8507bc2b903347da892403dbcf`.
> Runtime reads the owner-only PKCS8 key only from
> `INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_PATH`. The precommit verifier reports
> `pending-v2`; after the parent commits and publishes these lifecycle files,
> verify with `--expect-authorized-v2`. Commit state is derived from Git history rather than
> embedded in the authorization or status artifacts.
>
> Read-only checks confirm the replacement PAT can read the exact Scratch
> project, the owner accepts the residual risk with `oldTokenRevoked=false`,
> both environment files are mode 0600, MCP reconnected after their update, and
> exact Scratch bridge and REST probes pass. Runtime attestation must still be
> created only after the replacement authorization/code commit is published and
> a fresh zero-result secret scan is bound to that commit; it may contain no
> token value. The safe template is
> `recipe/evidence/input-field-live-pivot-v7/operator-security-attestation-template.json`;
> the completed untracked attestation belongs at
> `private/input-live-v7-security-attestation.json`. Create it post-commit with
> `npm run recipe:input-field:live:v7:attestation:create -- --facts private/input-live-v7-post-restart-security-facts.json`.
> V7 attempt 1 is closed as recorded above; Input remains false. V8 prepare is
> published at `9e34ee653b07e705ef6309cc3d900add81fba47b`. Authorization is
> published at `e163d85787c4449de269ca4314bda9c75a289395`; verify with
> `--expect-authorized`. V8 attempt 1 failed closed on IR FLOAT compatibility
> for per-side stroke weights; attempt 2 cleared that and failed closed on
> VARIABLE_ALIAS / bound-variable-only fills in hashed scene-readback.
> Cleanup completed both times. V7 authorization is not reusable. V9 prepare
> is published at `1a16642bddbb8c8a3fb44cd0e086a7ff8328e294`. Authorization is
> published at `58cd5c6ac08ebedc4c5a505b6f59e38efe91ac1b`; verify with
> `--expect-authorized`. V9 attempt 1 failed closed on component-set
> strokes/effects/cornerRadius; attempt 2 cleared that and failed closed on the
> hashed v3 verifier still calling v8 `scene-readback.ts`. Cleanup completed
> both times. V7, v8, and v9 authorization are not reusable. Do not restart v9
> attempt 3 as-is. V10 prepare is published at
> `0da647b79ed8a2660b9858c6008a08cbae8dbbf3`. Authorization is present at
> `recipe/evidence/input-field-live-pivot-v10/capture-authorization.json`;
> verify `--expect-authorized` after the authorization commit. V10 attempts
> 1-2 failed closed. V11 prepare is published at
> `f1861d527dd09345c56ee862de7776fbc4d0a7a2`. Authorization is published at
> `41fc8c77e01a670a38d5cdfb97feba80b638f72e`. V11 attempt 1 failed closed on
> MUI content fill (24 placeholder texts FIXED); do not restart attempt 2
> as-is. The ordered remaining-work plan to an honest v1 proof is in
> [Remaining work to v1 proof](#remaining-work-to-v1-proof-2026-08-27).**
>
> Historical implementation record: **Input/Field has an offline
> `input-field@1` recipe and a complete 128-cell matched source/legacy/React/WC
> capture. Every grading round remains separate as preserved historical bytes: v1
> failed at legacy 88/128 versus recipe 40/128; corrected v2 produced an
> internally reliable 0/128 versus 95/128 consensus but could not explain the
> unchanged-control swing; the first calibrated round was refused with invalid
> envelopes and Fleiss κ 0.473; replacement v3 was refused at κ 0.409255 before
> identity; and the paired GOLD raters all failed qualification at 44/48, 42/48,
> and 41/48. Their submissions and receipts are preserved. No more AI raters are
> recruited: repeated recruitment after both absolute and paired instruments
> fail selects for agreement with the instrument rather than establishing
> visual truth. AI absolute recognisability and AI paired preference are no
> longer automated architecture-progression gates.
>
> Progression now has three explicit claims. (1) Deterministic visual fidelity
> is measured relative to each exact independent real-source reference. (2)
> Structural/semantic correctness is measured through DOM, ARIA, state, role,
> WC-parity, accounting, fixed-point, and no-source-branch assertions. Only
> those first two claims may authorize continued engineering. (3) Absolute
> human recognisability remains pending a final independent designer review and
> is required before Input success or release.
>
> Objective v1 remains historical: under the recorded protocol recipe won geometry
> 128–0 and pixel/ink cells 108–20, but failed aggregate pixel/ink at 0.402497
> versus legacy 0.363455. Its 20 losses were 16 MUI disabled cells and four MUI
> error/placeholder/no-adornment cells. The exact causes were an incorrectly
> painted disabled surface (mean 37,802.5 excess threshold-counted ink pixels
> per affected cell), dependent border darkening, unacquired adornment and
> required-indicator ink, and placeholder ink over an inactive floating label.
> New comparison v3 preserves all 128 independent references and all 128 legacy
> outputs byte-for-byte. Objective v2 reuses the same protocol hash and
> thresholds: recipe now wins geometry 128–0 and pixel/ink 128–0; mean geometry
> is 0.003944 versus 0.136296, mean pixel/ink is 0.295210 versus 0.363455, and
> overall weighted error is 0.149577 versus 0.249875. Structural, semantic,
> React/WC parity, accounting, fixed-point, completeness, and catastrophic
> regression checks pass 128/128. Deterministic visual fidelity and structural
> correctness now authorize continued Input engineering. Overall Input remains
> false and human recognisability remains pending final independent designer
> review. Live v1 remains historical. Live v2 repaired generic reflow, explicitly
> declared floating-label overlap, all 256 bounds checks, fixed point, and
> accounting, but still failed the unchanged all-cell raster objective. All v2
> Input-created Figma artifacts were cleaned; census and Button proof remain
> untouched. An independent 24-specimen browser↔Figma calibration then improved
> held-out geometry but regressed held-out pixel/ink under sane coefficient
> bounds, so it was rejected. Input v3 attempts 1–3 are hard failures; attempt
> 3's 128 captures are unscored and no scene or objective value exists.**
>
> Evidence index: immutable objective v1 is
> `recipe/evidence/input-field-objective-comparison-v1/index.json`; corrected
> capture v3 is `recipe/evidence/input-field-comparison-v3/index.json`; and the
> passing locked objective rerun is
> `recipe/evidence/input-field-objective-comparison-v2/index.json`. The failed
> live proof, complete 128-cell capture, cleanup receipts, and ungraded human
> packet are indexed at
> `recipe/evidence/input-field-live-pivot-v1/index.json`. The separate v2
> diagnosis, proof, complete capture, cleanup, and packet are indexed at
> `recipe/evidence/input-field-live-pivot-v2/index.json`.
> Exhausted v3 evidence and all 128 attempt-3 screenshots are indexed at
> `recipe/evidence/input-field-live-pivot-v3/index.json`; the v4 protocol and
> historical authorization declaration are indexed at
> `recipe/evidence/input-field-live-pivot-v4/index.json`; the v4 entrypoint
> failure is separate. V5 protocol and authorization bytes remain preserved at
> `recipe/evidence/input-field-live-pivot-v5/index.json`; its semantic retirement
> is recorded separately at
> `recipe/evidence/input-field-live-pivot-v5-superseding-status.json`. The v6
> protocol, two-root expected plans, exact 128-cell manifest, 132-request
> manifest, source-neutral programs, and authorization history remain preserved
> at `recipe/evidence/input-field-live-pivot-v6/index.json`; its lifecycle defect
> and retirement are recorded separately. V7's authorization-independent hash
> set is `recipe/evidence/input-field-live-pivot-v7/antecedent-index.json`, with
> lifecycle status outside that set. The distinct authorization is declared, but
> v7 live execution remains forbidden until its commit is published and all
> runtime security prerequisites pass.
> The source-neutral calibration corpus, captures, result, exact-byte attempts,
> and cleanup receipt are indexed at
> `recipe/evidence/raster-calibration-v1/index.json`.
> V1 Button comparison remains red and retained;
> corrected v2 passes the offline paired recognisability control; live v1-v3
> remain historical failures; and v4 preserves the technical Scratch mint plus
> 12/12 grade bytes, without proving attributable human signoff or independent
> scene-derived inversion/accounting.** The canonical IR,
> envelope, explicitly selected `button@1` compiler, inverse validator/collapse
> path, React/Web Component outputs, and offline gates exist. On the frozen
> paired v1 slice, legacy scored 9/12 and recipe React 0/12. The separately
> graded v2 batch retained the exact reference and legacy bytes and scored
> legacy 7/12 versus corrected recipe React 12/12. V4 keeps both 144-variant
> sets, all 57 variables, its proof instances, and 12 paired live cells on the
> dedicated Scratch page. The deterministic final adjudication passes every
> required historical Button column under that superseded protocol. Current
> Button success is **false/pending**. The second
> control reuses that architecture offline only; its original-source references
> and blind grade now exist, but no Figma mint, live canvas grade, or
> cross-archetype success claim exists yet.

## Remaining work to v1 proof (2026-08-27)

This is the ordered, falsifiable plan for the rest of the pivot. It does not
declare v1, invent live outcomes, or restamp frozen lineage bytes. Machine
status remains `recipe/evidence/status-index.json`. Sitting start for this remaining-work plan was
`1a16642bddbb8c8a3fb44cd0e086a7ff8328e294` on `pivot/recipe-ir-v1`. Desktop
Bridge stays target-locked on Scratch `byMp6lt0Ij9b2QbkDGFwBh`. The historical
Button page `Recipe Pivot / Button / e6a61d04-b04f4059-v4` remains and must
not be collided with. `Y8Jhw6R49wTLuXZ0is2GmV` and every other connected file
stay read-only. npm publish stays deferred.

**Exit rule.** Continue in this order until every binary row in §F is true, or
until a hard safety or human-only gate blocks progress. Do not cut v1 if any
required row is false. If a hashed lineage file fails closed, open the next
lineage; do not patch hashed bytes in place.

### A · Input live v9 closeout, then v10

| step | action | exit criterion |
| --- | --- | --- |
| A1 | AUTHORIZE INPUT V9 as a **separate** commit. Pin a prepare-era Ed25519 operator signer. Antecedent `1a16642bddbb8c8a3fb44cd0e086a7ff8328e294`. Authorization lifecycle stays out of the antecedent hash set. Artifact SHA-256 `56930e91dd321695f3e3343ddd5a9c0d0dbc3c51f0ff8305ab998d0d8f2269c7`; SPKI SHA-256 `c98c4cf0b1deef2b2d71c9f7e7f550e602ac334a620142516f4537f47ea9c686`. | **Done** at `58cd5c6ac08ebedc4c5a505b6f59e38efe91ac1b`. Antecedent index SHA-256 remains `ef6a72fd392d2866d06136e8200d2cff750585705eafacdc41e20b95cfac2942`. |
| A2 | Fresh private attestation only: replacement PAT + `oldTokenRevoked=false` + `ownerRiskAcceptance=true`; env files mode 0600; MCP restarted; zero-result secret scan bound to the authorize/code commit; Scratch-only read-only probe. Never commit `private/`. Never print tokens. | Attestations at `private/input-live-v9-security-attestation.json` (bound to authorize) and `private/input-live-v9-security-attestation-attempt-2.json` (bound to `1c80badc`) stay untracked. |
| A3 | Attempt 1 Scratch-only live. | **Failed closed.** Writer + extract accepted (2317 nodes, 8364325-byte extract); host IR refused component-set `strokes`/`effects`/`cornerRadius`. Cleanup accepted. Taught unhashed `figma-ir.ts`. RECORD `1c80badc`. |
| A4 | Attempt 2 Scratch-only live after that IR teaching. | **Failed closed.** Writer + extract accepted again; component-set fields cleared; host still ran hashed `input-field-live-v3-verifier.ts` → v8 `scene-readback.ts` and refused `payload.fills.0.kind`. Cleanup accepted. Do **not** restart v9 attempt 3 as-is. |
| A5 | PREPARE INPUT V10. Copy the v9 stack. Carry scene-readback-v10 **and** `input-field-live-v3-verifier-v10.ts` so live host does not invoke v8 `scene-readback.ts`. Keep v9 hashed bytes frozen. Writer bytes frozen from v8/v9. | **Done** at `0da647b79ed8a2660b9858c6008a08cbae8dbbf3`. Antecedent index SHA-256 `4a054aadf5902fed939da30c1b54833bcc7a54f88b145f5348c4d9b3108524bc`. |
| A5b | AUTHORIZE INPUT V10 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `0da647b79ed8a2660b9858c6008a08cbae8dbbf3`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `393996857f730419f9f92b1d2d30abaa9b5e896866e2694d50e3999c4e7b5e57`; SPKI SHA-256 `d651c665ee361bfc72f1bf671e5e45493c9a9eb7444493bc764551793909d25d`. | **Done** at `68b8366013aaf531b9c4f519f043e4cdd1b4e3a2`. |
| A5c | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer + extract accepted (2317 nodes, 8364327-byte extract). Hashed `scene-readback.ts` path cleared. Host collapse refused Size axis order `medium,small` vs declared `small,medium` in unhashed `recipes/input-field.ts`. Cleanup accepted. Teach axis-value order as non-structural, then attempt 2. |
| A5d | Attempt 2 Scratch-only live after Size-axis teaching. | **Failed closed.** Writer + extract accepted (2317 nodes, 8364327-byte extract). Size axis order cleared. Host collapse refused `input-field/message/helper` because hashed `sceneRole` drops roles when `font-provenance=` is in the name. Helper text present on 256/256 variants; first-segment role recoverable. Cleanup accepted. Do **not** restart v10 attempt 3 as-is. |
| A5e | PREPARE INPUT V11. Copy the v10 stack. Carry scene-readback-v11 + runtime that recover role/label from the first ` :: ` segment even when later segments contain `font-provenance=`. Keep v10 hashed bytes frozen. Writer bytes frozen from v8/v9/v10. | **Done** at `f1861d527dd09345c56ee862de7776fbc4d0a7a2`. Antecedent index SHA-256 `65ca9866da8fc90f354ceb53d57dc383f64d9f39d9b9f9ad3752df499c9628c7`. |
| A5f | AUTHORIZE INPUT V11 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `f1861d527dd09345c56ee862de7776fbc4d0a7a2`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `c681d7178be473943f4863d59bd30af9de435c23189a9392d2cbc0be3bc0a818`; SPKI SHA-256 `d4b38596d2015c2c732c304071946fe7b9a8fe2827813415165ceeb416a76a02`. | **Done** at `41fc8c77e01a670a38d5cdfb97feba80b638f72e`. |
| A5g | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer + extract accepted (2317 nodes, 8402407-byte extract). First-segment role recovery cleared. Host collapse refused MUI content fill: 24 placeholder texts extract as FIXED (Adornments none/trailing); Polaris 128/128 FILL. Frozen writer already set FILL after bind. Do **not** teach the recipe to accept FIXED. Do **not** restart v11 attempt 2 as-is. |
| A5h | PREPARE INPUT V12. Copy the v11 stack. Carry a writer that re-asserts placeholder/value `layoutSizingHorizontal=FILL` after the component set settles, using first-segment role and `textAutoResize=HEIGHT`. Keep v11 hashed bytes frozen, including the v11 writer payload. | **Done** at `8570f3e8c318977a51f5f41a7474dcc535b53b26`. Antecedent index SHA-256 `b2225989a92599fd8dbc1daf3d1f91c3f787cb2169547f8c1e640189bd7f45ef`. |
| A5i | AUTHORIZE INPUT V12 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `8570f3e8c318977a51f5f41a7474dcc535b53b26`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `124b04ff2daae9d62ecd1167014fefbdf6c231578e3f966b545972af4a2b8a03`; SPKI SHA-256 `649580fc43fa90a541d4ad4f3c7882e1854c1e15776a1aec698eb7623f325687`. | **Done** at `aec7918a6e211be4832e72a3cb6ebfb1cd350869`. |
| A5j | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer + extract accepted (2317 nodes, 8402407-byte extract). In-writer FILL/HEIGHT restore did not change the live extract: MUI still 104/128 FILL and 24/128 FIXED placeholders; Polaris 128/128 FILL. Do **not** teach the recipe to accept FIXED. Do **not** restart v12 attempt 2 as-is. Cleanup accepted. |
| A5k | PREPARE INPUT V13. Copy the v12 stack. Add a signed post-writer restore request that re-asserts content FILL on the minted Scratch page **after** the writer plugin returns and **before** extract. Keep v12 hashed bytes frozen. This is a protocol denominator change (remote request count). | **Done** at `4c0710109f4e8a2eba701afe96ba4af9f4924dad`. Antecedent index SHA-256 `b4bbe16ddc5ed81b19a53bbb28b31051f1390c5c92172333456a56d5f08c202e`. |
| A5l | AUTHORIZE INPUT V13 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `4c0710109f4e8a2eba701afe96ba4af9f4924dad`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `c000714eb070e41df760fd789458c650a7a941f4c17293f80bb4f742bb1bd372`; SPKI SHA-256 `fdde0b7a293e7f6fc4e8b28e9bbffefb49aaf538ba6649b4c943d27ba22483fa`. Do not patch hashed v12 or v13 bytes. | **Done** at `e21a67cac447e90a38b344ee34af8528b2dd205c`. |
| A5m | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; active request was restore. Hashed restore threw `INPUT-V13-RESTORE-NOT-FILL`. Extract not issued. Do **not** teach FIXED. Do **not** restart v13 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5n | PREPARE INPUT V14. Copy the v13 stack. Do not patch hashed v13 restore or writer bytes. Teach a two-pass restore: parent FILL first, then content HEIGHT+FILL, revealing hidden texts only while assigning. Do not teach FIXED. | **Done** at `961d08f94853d2b90cd3b68963f5bc113e5ae066`. Antecedent index SHA-256 `5846c279ec903b48d2cbdcf3b4626f037409c6a0bd1d276e7c15edfc12c389dc`. |
| A5o | AUTHORIZE INPUT V14 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `961d08f94853d2b90cd3b68963f5bc113e5ae066`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `0a608d7aab9c788be5af5f06df594b567c4997f6a7dfd32ecec560082b8ae57d`; SPKI SHA-256 `6e8061a22d1464e44ecc8469ea0a5e46b0b7c26169f194c15edec85ed8bb4415`. Do not patch hashed v13 or v14 bytes. | **Done** at `eae2dfb3e884b2b71c2de6814a5586cc85b9443c`. |
| A5p | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; active request was restore. Hashed two-pass restore threw `INPUT-V14-RESTORE-NOT-FILL`. Extract not issued. Do **not** teach FIXED. Do **not** restart v14 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5q | PREPARE INPUT V15. Copy the v14 stack. Do not patch hashed v14 restore or writer bytes. Teach restore to measure content FILL while the text is still visible, then restore visibility. Do not teach FIXED. | **Done** at `c1d3f0ac38f00fd005e80ed4d9e35ff393dbad58`. Antecedent index SHA-256 `8c944fa92e1afa2ca09c6bc6d938490e1927077d613c603cdbc1f3a5023659d7`. |
| A5r | AUTHORIZE INPUT V15 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `c1d3f0ac38f00fd005e80ed4d9e35ff393dbad58`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `2618b5df73ef7a1d4e4973729a99638d44ca5cd22f909b7207231982f9063374`; SPKI SHA-256 `ff0f180c12a7b39572bb4de024c29d90bdda3a0dafaab6e40d25a611f00afed7`. Do not patch hashed v14 or v15 bytes. | **Done** at `4002cb3be87c52ddfa32e2fa15c6bfbdc251238b`. |
| A5s | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8402467 bytes). Host refused MUI content fill. Extract still MUI 104/128 FILL and 24/128 FIXED hidden placeholders; Polaris 128/128 FILL. Do **not** teach FIXED. Do **not** restart v15 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5t | PREPARE INPUT V16. Copy the v15 stack. Do not patch hashed v15 restore, writer, or extract-runtime bytes. Teach extract to measure hidden content FILL while the text is still visible, then restore visibility. Do not teach FIXED. | **Done** at `a764804c4191d161d08ab9527938ce6d29009af7`. Antecedent index SHA-256 `f9eabfeecb2e4b7d81e3d43c4dfd4666e99f079e86d15eb8ce63e0e020a5c392`. |
| A5u | AUTHORIZE INPUT V16 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `a764804c4191d161d08ab9527938ce6d29009af7`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `377ae973efecf53cbb3684ec449dd4f9f388ce36ad5e19572e681fb85ba15f8f`; SPKI SHA-256 `cf89747d6dc04c6944170c2e4ea1450055eaabebeb6ba72aec05c049f1fa7ae0`. Do not patch hashed v15 or v16 bytes. | **Done** at `8511c9ca722c9f30c526ce5eb99fa9f4e485d9ec`. |
| A5v | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8402443 bytes). Hidden FIXED cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host refused leading-slot solid paint (`fills[0]` empty on 64+64 slot frames; SOLID is on the child/`instancePayload`). Do **not** teach FIXED. Do **not** restart v16 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5w | PREPARE INPUT V17. Copy the v16 stack. Do not patch hashed v16 extract, restore, writer, or runtime bytes. Teach extract/host to surface leading-slot solid paint from the adornment-content child or `instancePayload.fills`. Do not teach FIXED. | **Done** at `2a764e90d7683afd39ab08ad5b8cbf3e639c56a2`. Antecedent index SHA-256 `097ad396bdcaeb26ae091b18c4f9c5429fd4cb31a4f7c1e18e62146d5326d4b6`. |
| A5x | AUTHORIZE INPUT V17 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `2a764e90d7683afd39ab08ad5b8cbf3e639c56a2`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `2f2a7fdb89b983f566f78da5bf0fc52f037cb8f33818941207b6854fe3e88b73`; SPKI SHA-256 `66cbff883845e854f6d1fa03e478db12554ef8986d39dd347c90543c57661da3`. Do not patch hashed v16 or v17 bytes. | **Done** at `36dfcad20ecd04d9ff5eddcbe476a60ec66bc940`. |
| A5y | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8402443 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host surfaced slot SOLID, then refused leading-slot `fills.0.color` binding (slot nodes bind only height/width; COLOR is on the adornment-content child). Do **not** teach FIXED. Do **not** invent a binding. Do **not** restart v17 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5z | PREPARE INPUT V18. Copy the v17 stack. Do not patch hashed v17 scene-readback, extract, restore, writer, or runtime bytes. Teach host to surface leading-slot `fills.0.color` from the adornment-content child's bindings when the slot node's own bindings lack it. Do not invent variables. Do not teach FIXED. | **Done** at `cfdc6a7cff19b619640dc9dcea0d79a79f1ade75`. Antecedent index SHA-256 `7eadba3d0bdf170d6569c5e69087528b8667b669225a91016091033dacebfa75`. |
| A5aa | AUTHORIZE INPUT V18 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `cfdc6a7cff19b619640dc9dcea0d79a79f1ade75`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `7a95ddb633dbad6c8bf10110af41d18acfc11719dabc28044b28dead846671e0`; SPKI SHA-256 `8d2c69e5310eb77f4c0bbb9f42d0bb23d01df03318d73705cf0ff40f33a70cb8`. Do not patch hashed v17 or v18 bytes. | **Done** at `829f7c5217e3f4f5342cb2111112b6abb448a29a`. |
| A5ab | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8402443 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host surfaced slot `fills.0.color`, then refused surface `strokes.0.weight` (surfaces bind four per-side stroke weights to the same FLOAT; no `strokeWeight`). Do **not** teach FIXED. Do **not** invent a binding. Do **not** restart v18 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ac | PREPARE INPUT V19. Copy the v18 stack. Do not patch hashed v18 scene-readback, extract, restore, writer, or runtime bytes. Teach host to surface `strokes.0.weight` from the existing uniform per-side stroke-weight bindings when the surface node's own `strokeWeight` is absent. Do not invent variables. Do not teach FIXED. | **Done** at `53e0ee50e1c7ab08442bec8b666cd95cbd92e600`. Antecedent index SHA-256 `fc5d43842b0c6cafb1cbbcf62980492a842f77598f60f0d3bed1a1957232082f`. |
| A5ad | AUTHORIZE INPUT V19 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `53e0ee50e1c7ab08442bec8b666cd95cbd92e600`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `fc8c0d6baf426239507c5d1c8e8c5c40d1b9c01f7a0bddd90230b9956b6012e1`; SPKI SHA-256 `af528b74b14780f6978056ff803c452b27a714830eeb405a1a47fa936a970de5`. Do not patch hashed v18 or v19 bytes. | **Done** at `d3b5429cac9df5877143dfb79e617b544d7688f0`. |
| A5ae | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8402443 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host refused variant `layout.width.value` (none-adornment variants bind Figma `width` FLOAT; scene-readback maps it to `width.value`). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v19 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5af | PREPARE INPUT V20. Copy the v19 stack. Do not patch hashed v19 scene-readback, extract, restore, writer, or runtime bytes. Teach host to surface variant `layout.width.value` from the existing Figma `width` / `width.value` FLOAT when `layout.width.value` is absent. Do not invent variables. Do not teach FIXED. | **Done** at `d49f2da22d897b4a42e1a0e0f8ef302c61383417`. Antecedent index SHA-256 `72207d604be0227da52ab915d8f904ebd829c6f8ba21dff284e01f88ac4579b2`. |
| A5ag | AUTHORIZE INPUT V20 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `d49f2da22d897b4a42e1a0e0f8ef302c61383417`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `f43874d8748b45cfc02ea2621e877bcc22028a8153b71f55485396e18c595422`; SPKI SHA-256 `40f026cd0bd21e156746997fac2aba7fbe5a36890f3a8e561c6fe70022eaddc7`. Do not patch hashed v19 or v20 bytes. | **Done** at `2cd501781de9684d175c5daf71f22fdae60410c2`. |
| A5ah | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8404014 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse variant `layout.width.value`, then refused surface `layout.height.value` (surfaces bind Figma `height` FLOAT; scene-readback maps it to `height.value`). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v20 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ai | PREPARE INPUT V21. Copy the v20 stack. Do not patch hashed v20 scene-readback, extract, restore, writer, or runtime bytes. Teach host to surface `layout.height.value` from the existing Figma `height` / `height.value` FLOAT when `layout.height.value` is absent. Do not invent variables. Do not teach FIXED. | **Done** at `21fd65bb5a1f9874b96de05547dc092298738f59`. Antecedent index SHA-256 `131f1abbabaedad7a5c521d908e374c65db8f2ab02b8ee3b40d59433967a42ff`. |
| A5aj | AUTHORIZE INPUT V21 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `21fd65bb5a1f9874b96de05547dc092298738f59`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `15afeb3ecab3bc6493f6738a07c97e69f8bbe628afe92538a0c9bb807f865d3a`; SPKI SHA-256 `d26147dd1a658f2a3d585437c44105eabe7dfe3abfeac349a138e1163175d09f`. Do not patch hashed v20 or v21 bytes. | **Done** at `33108d6b18f2b37f9e03359949ce757554ae4c44`. |
| A5ak | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse surface `layout.height.value`, then refused variant `$.children[0].bindings.length` (live first variant has `width.value` plus surfaced `layout.width.value`; compile emits three none-adornment bindings). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v21 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5al | PREPARE INPUT V22. Copy the v21 stack. Do not patch hashed v21 scene-readback, extract, restore, writer, or runtime bytes. Teach host to surface the existing width/height FLOAT onto the recipe field without leaving a duplicate `width.value` / `height.value` binding that collapse treats as a structural edit. Do not invent variables. Do not teach FIXED. | **Done** at `edcfe4fbc45c72932d414f4b006d163a18f922d5`. Antecedent index SHA-256 `10bac5a8b65db4c6618132818eadf7345c6045bcf3e48e29c2b2e547e0692c7f`. |
| A5am | AUTHORIZE INPUT V22 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `edcfe4fbc45c72932d414f4b006d163a18f922d5`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `d29a41ee155fb6645d0ccd40a136933530f91b4b6f90bc1dcdc377be5fa5b0e3`; SPKI SHA-256 `020c28eb8a67e123d0c4b5965a92a2968716fedfc2f02b0875e272fe4c32598c`. Do not patch hashed v21 or v22 bytes. | **Done** at `281bb2594408ebbfef6b332c2f8b7b05a56bd7b9`. |
| A5an | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse `bindings.length`, then refused variant `$.children[0].bindings[1].field` (alias dropped `width.value` and appended `layout.width.value`; compile wants `layout.width.value` at index 1 before `layout.minWidth`). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v22 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ao | PREPARE INPUT V23. Copy the v22 stack. Do not patch hashed v22 scene-readback, extract, restore, writer, or runtime bytes. Teach host to place the aliased `layout.width.value` at the recipe compile index rather than appending it. Do not invent variables. Do not teach FIXED. | **Done** at `7817a11e1340cb386030b4a9d05fde2d6fc72e22`. Antecedent index SHA-256 `d332815baade80b48e8caa1182296058403cb55fa3a7b7f4b893da7be4a2e305`. |
| A5ap | AUTHORIZE INPUT V23 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `7817a11e1340cb386030b4a9d05fde2d6fc72e22`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `e36c14bc051a75ebb3a8f2bb42738c0fdcc4c13a4ad13933b09d21934f9c1d1c`; SPKI SHA-256 `7a72ee82c5ea05f7d8cba29c0893933376fe56aa7ce4d86ef6622583442f691b`. Do not patch hashed v22 or v23 bytes. | **Done** at `3d0791b41d59dfca1c803a02ed917b8aecde2c5f`. |
| A5aq | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse variant `bindings[1].field`, then refused surface `$.children[0].children[0].bindings.length` (MUI surface host has 18 bindings including duplicate mapped colors, per-side stroke weights plus `strokes.0.weight`, and appended `layout.height.value`; compile emits 12). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v23 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ar | PREPARE INPUT V24. Copy the v23 stack. Do not patch hashed v23 scene-readback, extract, restore, writer, or runtime bytes. Teach host to drop extra surface bindings that collapse treats as a structural length edit (duplicate mapped `fills.0` / `strokes.0` source fields, and per-side stroke weights when the uniform `strokes.0.weight` alias is present). Do not invent variables. Do not teach FIXED. | **Done** at `753eef85aa026561542e45f492bf25b9ac84b599`. Antecedent index SHA-256 `b704897dabc85854479d0fea26fab5b0646373a1f06305fe7af77310f0279ef5`. |
| A5as | AUTHORIZE INPUT V24 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `753eef85aa026561542e45f492bf25b9ac84b599`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `da1d1a73d96be48173d83e04a20cc0f3b65bc94de6d678c3a79b7730b50fdc7b`; SPKI SHA-256 `afe03ed60ef54cca0989f6d760184dbef2deb5ff2eed3cdc239c55c42be196b9`. Do not patch hashed v23 or v24 bytes. | **Done** at `5530ad3d4040faa45a0d03943b6da48c618daaf4`. |
| A5at | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse surface `bindings.length` (extras dropped to 12 host vs 12 compile), then refused surface `$.children[0].children[0].bindings[0].field` (host remaining order starts at `cornerRadius.bottomLeft`; compile starts at `layout.padding.right`). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v24 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5au | PREPARE INPUT V25. Copy the v24 stack. Do not patch hashed v24 scene-readback, extract, restore, writer, or runtime bytes. Teach host to place remaining surface bindings at the recipe compile field order rather than leaving extract/alias encounter order. Do not invent variables. Do not teach FIXED. | **Done** at `5dcdd4fca890713d6378f8491f442761dab1837e`. Antecedent index SHA-256 `232e19729f42c08cd6a00713d377d0798190dd4bf31548bbfcc76782d5cec76c`. |
| A5av | AUTHORIZE INPUT V25 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `5dcdd4fca890713d6378f8491f442761dab1837e`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `c274c71b272072d47087498c442c63f750bcba1cdc39ba1dcf031dc663d2d662`; SPKI SHA-256 `a15336a1c85f3fc7f3f5a669f2173fecca8c957377511e9c3f1b8466202562ae`. Do not patch hashed v24 or v25 bytes. | **Done** at `dcbeaabf15405006489ed6d2ec6aa3eb5b4ffe8f`. |
| A5aw | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse surface `bindings[0].field` (remaining surface bindings now match compile field order), then refused `$.children[0].children[0].children[0].children[0].bindings[0].field` (MUI `input-field/content/placeholder` host has 4 bindings starting at `fills.0.color` including a duplicate mapped color; compile emits 3 starting at `type.fontSize`). Do **not** teach FIXED. Do **not** invent a variable. Do **not** restart v25 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ax | PREPARE INPUT V26. Copy the v25 stack. Do not patch hashed v25 scene-readback, extract, restore, writer, or runtime bytes. Teach host to drop extra content/placeholder and content/value bindings that collapse treats as a structural edit and place remaining text bindings at the recipe compile field order. Do not invent variables. Do not teach FIXED. | **Done** at `ae5811a45a2508a5387b99df4fcebbb12a8ab167`. Antecedent index SHA-256 `a905a0896facb39793e579ae61397fcb5b9b0f0e82601d1b4a921539df4c516f`. |
| A5ay | AUTHORIZE INPUT V26 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `ae5811a45a2508a5387b99df4fcebbb12a8ab167`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `86b97761fe7ab95027c1fbe9aeffe4be672fe1fb9e5d2e889f1f0c98f3e38b40`; SPKI SHA-256 `e8f4ae846769df4a62f977ccfb6df299b7fdbdb2234ae51233519b20d69ed1e9`. Do not patch hashed v25 or v26 bytes. | **Done** at `3ca842739d6b45ab40f054f129d4b38b618207a2`. |
| A5az | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED width remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse content `bindings[0].field` (remaining content bindings now match compile field order), then refused `$.children[0].children[0].children[0].children[0].height.mode` (MUI hidden `input-field/content/placeholder` host emits `height.mode` fixed value 23; compile emits hug). Do **not** teach FIXED as a fill. Do **not** invent a variable. Do **not** restart v26 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ba | PREPARE INPUT V27. Copy the v26 stack. Do not patch hashed v26 scene-readback, extract, restore, writer, or runtime bytes. Teach host to emit hug height for hidden content/placeholder and content/value text whose live `layoutSizingVertical` is FIXED after measure-while-visible. Do not invent variables. Do not teach FIXED as a fill. | **Done** at `99b26f7f2448f8dfe1f7cb14d3e0b5ddd84f0e75`. Antecedent index SHA-256 `692ba21729c1949819e10452fe815fe09b8d16b8ab44aa9c139fc3f26a461827`. |
| A5bb | AUTHORIZE INPUT V27 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `99b26f7f2448f8dfe1f7cb14d3e0b5ddd84f0e75`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `da8dfaef750b3e2151ee33effe42a825963d69719de9ea6c7b05a5cb1f316b8f`; SPKI SHA-256 `02f574f89ab1363fbf6ebfae2211f5d2c134a14b96807bf19f625a541f14ee24`. Do not patch hashed v26 or v27 bytes. | **Done** at `64214da458c4f12baacdefe618b0f994b9b0be26`. |
| A5bc | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED width remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse `height.mode` (hidden content FIXED now host-hug). Host then refused `$.children[0].children[0].children[0].children[0].type.letterSpacing` (MUI hidden `input-field/content/placeholder` host emits percent 0; compile omits letterSpacing). Do **not** teach FIXED as a fill. Do **not** invent a variable. Do **not** invent a letterSpacing value. Do **not** restart v27 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bd | PREPARE INPUT V28. Copy the v27 stack. Do not patch hashed v27 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content/placeholder and content/value `type.letterSpacing` that compile never emits. Do not invent variables. Do not invent a letterSpacing value. Do not teach FIXED as a fill. | **Done** at `2141a920c6eaa9e21412e5e42d2f10328bc51d52`. Antecedent index SHA-256 `ae452c62e4867fddca3b2a1b4ac0a123c8a057ce7581020cfee4ad72e7c3f3cd`. |
| A5be | AUTHORIZE INPUT V28 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `2141a920c6eaa9e21412e5e42d2f10328bc51d52`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `4bf14963ace7c3cff8f90a097f276e9e764a37a954daf7bf7e0e48bd96376fbf`; SPKI SHA-256 `c6b31af37139b42eb281440301de5ee67f0944ef965782faeb18a69d79906db8`. Do not patch hashed v27 or v28 bytes. | **Done** at `6d450ef6bc985816a18a30d17b9893dde9f51fd0`. |
| A5bf | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED width remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse `type.letterSpacing` (content letterSpacing now omitted). Host then refused `$.children[0].children[0].children[0].children[0].type.textCase` (MUI hidden `input-field/content/placeholder` host emits original; compile omits textCase). Do **not** teach FIXED as a fill. Do **not** invent a variable. Do **not** invent a textCase value. Do **not** restart v28 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bg | PREPARE INPUT V29. Copy the v28 stack. Do not patch hashed v28 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content/placeholder and content/value `type.textCase` that compile never emits. Do not invent variables. Do not invent a textCase value. Do not teach FIXED as a fill. | **Done** at `b54a2ea24a7172cb0caa9a9072ed2fd40f661ad0`. Antecedent index SHA-256 `3020fb1f63de66f4eed689361a889d9cdb27a521ac4bba43b53a1a877762a5ee`. |
| A5bh | AUTHORIZE INPUT V29 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `b54a2ea24a7172cb0caa9a9072ed2fd40f661ad0`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `5d4850eaed7f8ab57d36040e23dd66b1f4eaec78ca43cb292575fdaec06c4a01`; SPKI SHA-256 `29af345ee115b69609c97c301a4732259a63ee3a4313c4445d08662b3c4cf130`. Do not patch hashed v28 or v29 bytes. | **Done** at `a19285e26afed6121b7e6987838e434d1881ebca`. |
| A5bi | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED width remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse `type.textCase` (content textCase now omitted). Host then refused `$.children[0].children[0].children[0].children[0].type.textDecoration` (MUI hidden `input-field/content/placeholder` host emits none; compile omits textDecoration). Do **not** teach FIXED as a fill. Do **not** invent a variable. Do **not** invent a textDecoration value. Do **not** restart v29 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bj | PREPARE INPUT V30. Copy the v29 stack. Do not patch hashed v29 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content/placeholder and content/value `type.textDecoration` that compile never emits. Do not invent variables. Do not invent a textDecoration value. Do not teach FIXED as a fill. | **Done** at `fdad5d7bb2920b8688946b8a5d735b337a843551`. Antecedent index SHA-256 `2d571d91900c421993e46c0ecceb251b576dcba78ebefd3132f4bc175e67909b`. |
| A5bk | AUTHORIZE INPUT V30 as a **separate** commit. New prepare-era Ed25519 signer. Antecedent `fdad5d7bb2920b8688946b8a5d735b337a843551`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `5c489d305e69f1a850874c8962bba1dbf053eeab19ba3ba3e8781052ec63c8a5`; SPKI SHA-256 `52b157be09d08c7296c062267663c604e152ee7c368e0620a26490a5a872fc60`. Do not patch hashed v29 or v30 bytes. | **Done** at `babb6e5db745e7eb36037b069dce8a54983f2dec`. |
| A5bl | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Hidden FIXED width remains cleared: MUI 128/128 FILL, Polaris 128/128 FILL. Host did not refuse `type.textDecoration` (content textDecoration now omitted). Host then refused `$.children[0].children[0].children[0].clipsContent` (MUI `input-field/content-row` host emits true; compile omits clipsContent). Polar has 0 content-row nodes. Do **not** teach FIXED as a fill. Do **not** invent a variable. Do **not** invent a clipsContent value. Do **not** restart v30 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bm | PREPARE INPUT V31. Copy the v30 stack. Do not patch hashed v30 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content-row `clipsContent` that compile never emits. Do not invent variables. Do not invent a clipsContent value. Do not teach FIXED as a fill. | **Done** at `d5c7aa643f6f69a6fccd2377e23d749d90c07547`. Antecedent index SHA-256 `84d6ae0831e158cf14dbdd123defd1ccd0da50290a260c4b26893e20ac69f6e8`. |
| A5bn | AUTHORIZE INPUT V31 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `d5c7aa643f6f69a6fccd2377e23d749d90c07547`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `c52dc7e5ff2f8bc5a7096b2dd9bf5abd3834cc298486e02818537e9ce92dd0e7`; SPKI SHA-256 `a9afe8aa161c81ce584765a9a2fb02945b84c4ddf1760af5c72e356e445300d6`. Do not patch hashed v30 or v31 bytes. | **Done** at `38a97734a6b0a1a37d877e75c9973d3fd69acbba`. |
| A5bo | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse content-row `clipsContent`. Host then refused `$.children[0].children[0].children[0].cornerRadius` (MUI `input-field/content-row` host emits `{0,0,0,0}`; compile omits cornerRadius). Polar has 0 content-row nodes. Do **not** invent a cornerRadius value. Do **not** restart v31 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bp | PREPARE INPUT V32. Copy the v31 stack. Do not patch hashed v31 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content-row `cornerRadius` that compile never emits. Do not invent variables. Do not invent a cornerRadius value. Do not teach FIXED as a fill. | **Done** at `1c034dd099c60778880a646a61691e0117978948`. Antecedent index SHA-256 `f10062e820f799d1dab3b41939e55f4c8ca1da6d7cf4cb3f611629391a9a4648`. |
| A5bq | AUTHORIZE INPUT V32 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `1c034dd099c60778880a646a61691e0117978948`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `38c4194338cc6dd44cd6b0f56515e4d73c82aace1119b396f372f6368dc8f566`; SPKI SHA-256 `23d17df323f7f07709eb8bc4242dabd6751bb6c9d4bc6a5ec4d7e7bc2b992aa0`. Do not patch hashed v31 or v32 bytes. | **Done** at `4bb5a7fe225a90c42037de5797bfcf3101aae298`. |
| A5br | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse content-row `clipsContent` or `cornerRadius`. Host then refused `$.children[0].children[0].children[0].effects` (MUI `input-field/content-row` host emits `[]`; compile omits effects). Polar has 0 content-row nodes. Do **not** invent an effects value. Do **not** restart v32 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bs | PREPARE INPUT V33. Copy the v32 stack. Do not patch hashed v32 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content-row `effects` that compile never emits. Do not invent variables. Do not invent an effects value. Do not teach FIXED as a fill. | **Done** at `dc0c7fa0a51973e894c286ad6f4be48fd12b5a0a`. Antecedent index SHA-256 `26eca04b916de5737702d5a7cf2c642d84a2e3457fac17521b30b8b1c7694ea5`. |
| A5bt | AUTHORIZE INPUT V33 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `dc0c7fa0a51973e894c286ad6f4be48fd12b5a0a`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `0b37e33f7ff5c9eb96e078d76ee649a16ddd5196809319e21a0c89e029968657`; SPKI SHA-256 `0db7e3ec14cfae5a55d3cd9fcd8e4542b00844020c3a82bdc4157b0d09b6ea8a`. Do not patch hashed v32 or v33 bytes. | **Done** at `f9a4ef0de155b0ef92417958335c8fff83dc74d4`. |
| A5bu | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse content-row `clipsContent`, `cornerRadius`, or `effects`. Host then refused `$.children[0].children[0].children[0].strokes` (MUI `input-field/content-row` host emits `[]`; compile omits strokes). Polar has 0 content-row nodes. Do **not** invent a strokes value. Do **not** restart v33 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5bv | PREPARE INPUT V34. Copy the v33 stack. Do not patch hashed v33 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit content-row `strokes` that compile never emits. Do not invent variables. Do not invent a strokes value. Do not teach FIXED as a fill. | **Done** at `8db64d02a3d87f4b34f9cf64ff7cbeac3a060d41`. Antecedent index SHA-256 `cd0a09a4272a35402b769353508960ac903a3f2b65da08f6c0635057e915b94d`. |
| A5bw | AUTHORIZE INPUT V34 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `8db64d02a3d87f4b34f9cf64ff7cbeac3a060d41`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `6995d6670392925d57baafd886e1ca84b57514766368af1a77e41606b4ff3673`; SPKI SHA-256 `bd3cde85208f02733c951cb18009d9617813b36ec67906c1b91c275e2207b7cf`. Do not patch hashed v33 or v34 bytes. | **Done** at `9cdffa3d8d7e41e6efee75696e641a7b01f2d461`. |
| A5bx | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse content-row `clipsContent`, `cornerRadius`, `effects`, or `strokes`. Host then refused `$.children[0].children[0].children[1].children[0].bindings[0].field` (MUI `input-field/label` host first field `fills.0.color`; compile first field `type.fontSize`). Polar has 0 content-row nodes. Do **not** invent a variable. Do **not** restart v34 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5by | PREPARE INPUT V35. Copy the v34 stack. Do not patch hashed v34 scene-readback, extract, restore, writer, or runtime bytes. Teach host to drop label binding extras and order label bindings to compile `type.fontSize`, `type.lineHeight.value`, `fills.0.color`. Label role only. Do not invent variables. Do not teach FIXED as a fill. | **Done** at `341e690a223d598dd93d3680333adcb89fab07a8`. Antecedent index SHA-256 `0d3170e9e9f17f67b5e28530082c94d3e82f83e975357033899237dcb457a32d`. |
| A5bz | AUTHORIZE INPUT V35 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `341e690a223d598dd93d3680333adcb89fab07a8`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `1fb2e51a2eb7f4abc56a518c1b00ad9c876d0ac7f172d48e1656ddfd92198436`; SPKI SHA-256 `9d552892da07d207717d5c59a37c2fd4e4929c93d9eba5ecd3e1242f800dfc42`. Do not patch hashed v34 or v35 bytes. | **Done** at `91281f0e65caea3267deee6c4291a7eaa468a0fb`. |
| A5ca | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label `bindings[0].field` or content-row `clipsContent` / `cornerRadius` / `effects` / `strokes`. Host then refused `$.children[0].children[0].children[1].children[0].type.letterSpacing` (MUI `input-field/label` host emits `{unit: percent, value: 0}`; compile omits letterSpacing). Polar has 0 content-row nodes. Do **not** invent a letterSpacing value. Do **not** restart v35 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5cb | PREPARE INPUT V36. Copy the v35 stack. Do not patch hashed v35 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label `letterSpacing` that compile never emits. Label role only. Do not invent variables. Do not invent a letterSpacing value. Do not teach FIXED as a fill. | **Done** at `7f7b53c1c5cb954c9b27d42cf9ecd2285834d330`. Antecedent index SHA-256 `fb5ce6613db4711041df2d750507ca1961e1f3bdcc368a67c741c30029ce8d3d`. |
| A5cc | AUTHORIZE INPUT V36 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `7f7b53c1c5cb954c9b27d42cf9ecd2285834d330`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `380133132ac908be9d922b18e209b2f63f69a15bcc309b5346d7f25696bea55d`; SPKI SHA-256 `959fe2c8a939f6389e08d2e74fcae6aea13a8c98d38f666cc40d5da90334a617`. Do not patch hashed v35 or v36 bytes. | **Done** at `a948115d4461b0d841a0068929beb674dcf8b3f5`. |
| A5cd | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label `type.letterSpacing` or content-row `clipsContent` / `cornerRadius` / `effects` / `strokes`. Host then refused `$.children[0].children[0].children[1].children[0].type.textCase` (MUI `input-field/label` host emits `original`; compile omits textCase). Polar has 0 content-row nodes. Do **not** invent a textCase value. Do **not** restart v36 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ce | PREPARE INPUT V37. Copy the v36 stack. Do not patch hashed v36 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label `textCase` that compile never emits. Label role only. Do not invent variables. Do not invent a textCase value. Do not teach FIXED as a fill. | **Done** at `5f50cd9b0931926c4b57c9e033643f82b7af643d`. Antecedent index SHA-256 `773f4add78533aa5dd68aa04873b94e2e45e1db9d9a6cf6c47d9a2a43d231f07`. |
| A5cf | AUTHORIZE INPUT V37 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `5f50cd9b0931926c4b57c9e033643f82b7af643d`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `6b5b72811ffe1215ceb557d5314e21c5b30931eb04e2f01935a596a43f612db0`; SPKI SHA-256 `476ce4a0f89fbc2a9ac59ac4b0c37e6b4a7e4bc0ff7bae7c6421598873dac892`. Do not patch hashed v36 or v37 bytes. | **Done** at `82a61703c572dd0b0846cae3df8af03162c16539`. |
| A5cg | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label `type.textCase` or content-row `clipsContent` / `cornerRadius` / `effects` / `strokes`. Host then refused `$.children[0].children[0].children[1].children[0].type.textDecoration` (MUI `input-field/label` host emits `none`; compile omits textDecoration). Polar has 0 content-row nodes. Do **not** invent a textDecoration value. Do **not** restart v37 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ch | PREPARE INPUT V38. Copy the v37 stack. Do not patch hashed v37 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label `textDecoration` that compile never emits. Label role only. Do not invent variables. Do not invent a textDecoration value. Do not teach FIXED as a fill. | **Done** at `72910ee2ba80869b2ffc05e09bb660ff0d26e69b`. Antecedent index SHA-256 `533c9920e23d92265acd852aee08b8d8a25473893f7788fbfa99eba74c7aad3b`. |
| A5ci | AUTHORIZE INPUT V38 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `72910ee2ba80869b2ffc05e09bb660ff0d26e69b`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `40a7388ff6fcd7f6aa617e34e062417fbe5f5266cbdfc9e74ec545a990b5f7c6`; SPKI SHA-256 `9d68f5629f8affb82f1b8744831d6860bf7532e8bf2969bce3e4952023b1068c`. Do not patch hashed v37 or v38 bytes. | **Done** at `ac33fda1a27d94f3fe1f9c90fc1445fe8c7ddc35`. |
| A5cj | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label `type.textDecoration` or content-row `clipsContent` / `cornerRadius` / `effects` / `strokes`. Host then refused `$.children[0].children[0].children[1].clipsContent` (MUI `input-field/label-row` host emits `true`; content-row omit does not apply). Polar has 0 content-row nodes. Do **not** invent a clipsContent value. Do **not** restart v38 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ck | PREPARE INPUT V39. Copy the v38 stack. Do not patch hashed v38 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label-row `clipsContent` that compile never emits. Label-row role only. Do not invent variables. Do not invent a clipsContent value. Do not teach FIXED as a fill. | **Done** at `0498e173b1f449fdbb95c9bea43f9c63a941ae60`. Antecedent index SHA-256 `8a3bc4dd584731709d4ebc9c9e03f1b38884ad9f4dece586901bf08a2f0d525d`. |
| A5cl | AUTHORIZE INPUT V39 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `0498e173b1f449fdbb95c9bea43f9c63a941ae60`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `6a22f47efe5e16ec483c2187b43ff6435b49b48cc76e68bdc936409877d26288`; SPKI SHA-256 `497106364fd559b1ad31dd03b7ced1d4e1efc963dabaad3853b4cecb7ee7ea47`. Do not patch hashed v38 or v39 bytes. | **Done** at `ddc093d8471c1e7bf236d5f239d5fc72e76d3ef7`. |
| A5cm | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label-row `clipsContent`. Host then refused `$.children[0].children[0].children[1].cornerRadius` (MUI `input-field/label-row` host still emits all-zero radii; content-row omit does not apply). Polar has 0 content-row nodes. Do **not** invent a cornerRadius value. Do **not** restart v39 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5cn | PREPARE INPUT V40. Copy the v39 stack. Do not patch hashed v39 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label-row `cornerRadius` that compile never emits. Label-row role only. Do not invent variables. Do not invent a cornerRadius value. Do not omit label-row effects or strokes yet. Do not teach FIXED as a fill. | **Done** at `2cc7315b1c8352b398a3187d75c5b993bf87d4d1`. Antecedent index SHA-256 `057edcea2a24f56ebfa54d7da7b213ada80ba163829950746fefde378ed8be92`. |
| A5co | AUTHORIZE INPUT V40 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `2cc7315b1c8352b398a3187d75c5b993bf87d4d1`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `af94e16aa7458b2a83798ac5c0bed00d5dd34177ab3c783634e7e844ef365203`; SPKI SHA-256 `8fa620654380c8eced8affbed4ca55b3a076ad7116eab9ab5d9a2fd21317790a`. Do not patch hashed v39 or v40 bytes. | **Done** at `04179491874f25e55190e1f1ebcbf117e4eb4d74`. |
| A5cp | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label-row `cornerRadius`. Host then refused `$.children[0].children[0].children[1].effects` (MUI `input-field/label-row` host still emits `[]`; content-row omit does not apply). Polar has 0 content-row nodes. Do **not** invent an effects value. Do **not** restart v40 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5cq | PREPARE INPUT V41. Copy the v40 stack. Do not patch hashed v40 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label-row `effects` that compile never emits. Label-row role only. Do not invent variables. Do not invent an effects value. Do not omit label-row strokes yet. Do not teach FIXED as a fill. | **Done** at `774eea2d24d21308594eba61d0ceb2ca4243b589`. Antecedent index SHA-256 `5c7e46c1ce10f7c28c1c6a823dc969ed228d731b5fb83e9f1a0d9a7f14849922`. |
| A5cr | AUTHORIZE INPUT V41 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `774eea2d24d21308594eba61d0ceb2ca4243b589`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `46ff0dc094444ab71eb692517cbbb01d75b86247e49c525521b4b4b9564bb2bb`; SPKI SHA-256 `44015abb112d8f04fa2403e3fd52efa46b8607a82f9f38cdd1f1dad5a5a87a72`. Do not patch hashed v40 or v41 bytes. | **Done** at `b21477f8180088486b3adaefbaa6dad4a6471eb7`. |
| A5cs | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label-row `effects`. Host then refused `$.children[0].children[0].children[1].strokes` (MUI `input-field/label-row` host still emits `[]`; content-row omit does not apply). Polar has 0 content-row nodes. Do **not** invent a strokes value. Do **not** restart v41 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ct | PREPARE INPUT V42. Copy the v41 stack. Do not patch hashed v41 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit label-row `strokes` that compile never emits. Label-row role only. Do not invent variables. Do not invent a strokes value. Do not teach FIXED as a fill. | **Done** at `773d61beeb7da56a8c32dd0fbe35ca43863b5496`. Antecedent index SHA-256 `2a861eb4f670abf8a60ae2f344473deda5d83c2338e916cf70e95252c4022056`. |
| A5cu | AUTHORIZE INPUT V42 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `773d61beeb7da56a8c32dd0fbe35ca43863b5496`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `af25c244914df2fd76e44f036257dd34f8e114dc60f0ffb77d3b04051fc3f52f`; SPKI SHA-256 `9abcb0dd7859fd9210b378a328d7def05a2dcb9c15df67e79fd14e80ad352d22`. Do not patch hashed v41 or v42 bytes. | **Done** at `4549c5cc4f4c35b682309dc86de4e6b8c65bbfb0`. |
| A5cv | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse label-row `strokes`. Host then refused `$.children[0].children[0].strokes[0].dashPattern` (MUI `input-field/surface` host still emits `[]`; compile omits dashPattern). Polar has 0 content-row nodes. Do **not** invent a dashPattern value. Do **not** restart v42 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5cw | PREPARE INPUT V43. Copy the v42 stack. Do not patch hashed v42 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit surface stroke `dashPattern` that compile never emits. Surface stroke only. Do not invent variables. Do not invent a dashPattern value. Do not teach FIXED as a fill. | **Done** at `34f42760a0f38e3d7b253d6ccd3d2905eb90e341`. Antecedent index SHA-256 `92182006293e6fc003492f98651f898b55bea63a0272a7619d22139e11135d3b`. |
| A5cx | AUTHORIZE INPUT V43 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `34f42760a0f38e3d7b253d6ccd3d2905eb90e341`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `8cfcd36604c9d3b996d2a5de678bbcc2ef0f6d32c16cf00062b5c25be1f0546a`; SPKI SHA-256 `cec298e708d912be31cd7126c6abc823e4300bdd252c40627b3b566f49fecf37`. Do not patch hashed v42 or v43 bytes. | **Done** at `d567aeeee77637cf05a96058379283578fc04655`. |
| A5cy | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:160800`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse surface stroke `dashPattern`. Host then refused `$.children[0].children[1].children[0].bindings[0].field` (MUI `input-field/message/helper` host starts at `fills.0.color`; compile starts at `type.fontSize`). Polar has 0 content-row nodes. Do **not** invent a binding field. Do **not** restart v43 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5cz | PREPARE INPUT V44. Copy the v43 stack. Do not patch hashed v43 scene-readback, extract, restore, writer, or runtime bytes. Teach host to restore compile binding order on `input-field/message/helper` and `input-field/message/error` (same three compile fields; extract proved both). Do not invent variables. Do not teach FIXED as a fill. | **Done** at `1f1e3f8dbdd14daace494187abf2ca93ac3747db`. Antecedent index SHA-256 `0ad2ab3500e76112f9f5a2b2e68568ef7e2e061427859e0bcbc9fd8421bdc690`. |
| A5da | AUTHORIZE INPUT V44 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `1f1e3f8dbdd14daace494187abf2ca93ac3747db`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `ef435279b3822e80098d120f13277ced8a2bc98c515fd3920460e2a1f93f13c4`; SPKI SHA-256 `2eacc22723b5ea4b15e4a8b0f4bef442e0e09d9721490891975b25d38d128240`. Do not patch hashed v43 or v44 bytes. | **Done** at `e5cd0b502013a596df94168912b6920fb9d92cc3`. |
| A5db | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:163529`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message helper binding order. Host then refused `$.children[0].children[1].children[0].type.letterSpacing` (MUI `input-field/message/helper` host emits `{unit: percent, value: 0}`; compile omits letterSpacing). Polar has 0 content-row nodes. Do **not** invent a letterSpacing value. Do **not** restart v44 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5dc | PREPARE INPUT V45. Copy the v44 stack. Do not patch hashed v44 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `type.letterSpacing` on `input-field/message/helper` and `input-field/message/error` that compile never emits (extract proved both). Do not invent variables. Do not invent a letterSpacing value. Do not teach FIXED as a fill. | **Done** at `4fb4eca0d23ee1989d27e168755f2ee7d1d44726`. Antecedent index SHA-256 `0ec100cde764417de0cf7fea85630b39e24ded8ebd0811af8d960d9461ac2883`. |
| A5dd | AUTHORIZE INPUT V45 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `4fb4eca0d23ee1989d27e168755f2ee7d1d44726`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `5a70f34f09a55399428d0fd1d4b835a9d98adfd5c13e1b8d0957fca4b75d9341`; SPKI SHA-256 `21c0870d60139355fc093822d53016b5bc537b3f09cac9c27c13945cf44488cb`. Do not patch hashed v44 or v45 bytes. | **Done** at `89774548d3a168b692cf88e5ec21eebbda71a4f5`. |
| A5de | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:166258`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message helper letterSpacing. Host then refused `$.children[0].children[1].children[0].type.textCase` (MUI `input-field/message/helper` host emits `original`; compile omits textCase). Polar has 0 content-row nodes. Do **not** invent a textCase value. Do **not** restart v45 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5df | PREPARE INPUT V46. Copy the v45 stack. Do not patch hashed v45 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `type.textCase` on `input-field/message/helper` and `input-field/message/error` that compile never emits (extract proved both). Do not invent variables. Do not invent a textCase value. Do not teach FIXED as a fill. | **Done** at `e7ecd4cacc407f84ca3e2db71b565832a0ff74bb`. Antecedent index SHA-256 `aefb34b505a4ddd6ffca0e49a6c5e620258cc3296d56c582386e576427374099`. |
| A5dg | AUTHORIZE INPUT V46 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `e7ecd4cacc407f84ca3e2db71b565832a0ff74bb`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `ef0c92cbaaa6a6f27a77fe2949f9bbeb1c97cd6591fcc02ea75cfe509bdb5b82`; SPKI SHA-256 `430aa775d338c965f4e55ede7a8fb658f11eefc9e7008671f9054bf54ebb28bf`. Do not patch hashed v45 or v46 bytes. | **Done** at `fd6a3c88db69af8f57deb96847164d9e7719efdb`. |
| A5dh | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:168987`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message helper textCase. Host then refused `$.children[0].children[1].children[0].type.textDecoration` (MUI `input-field/message/helper` host emits `none`; compile omits textDecoration). Polar has 0 content-row nodes. Do **not** invent a textDecoration value. Do **not** restart v46 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5di | PREPARE INPUT V47. Copy the v46 stack. Do not patch hashed v46 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `type.textDecoration` on `input-field/message/helper` and `input-field/message/error` that compile never emits (extract proved both). Do not invent variables. Do not invent a textDecoration value. Do not teach FIXED as a fill. | **Done** at `6f54b8485aeab163764fb9dee17a85dd34e2a205`. Antecedent index SHA-256 `1bcb077c1027293313c5a13fd8edce84d07926926fa520b122e0d9b16abe4aaa`. |
| A5dj | AUTHORIZE INPUT V47 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `6f54b8485aeab163764fb9dee17a85dd34e2a205`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `ec849b01af1a9c3f0dfeab908eb4c4e121ef0168e7e80c4193ca50ed04e245f6`; SPKI SHA-256 `66cdf310038c25480ebb0b0f03f00a581dea826227f3533b9308ce7295365f13`. Do not patch hashed v46 or v47 bytes. | **Done** at `318696ec4a56e2e2dec8e308584ce1e100f82871`. |
| A5dk | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:171716`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message helper textDecoration. Host then refused `$.children[0].children[1].clipsContent` (MUI `input-field/message-container` host emits `true`; compile omits clipsContent). Polar has 0 content-row nodes. Do **not** invent a clipsContent value. Do **not** restart v47 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5dl | PREPARE INPUT V48. Copy the v47 stack. Do not patch hashed v47 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `clipsContent` on `input-field/message-container` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent a clipsContent value. Do not lift onto surface. Do not teach FIXED as a fill. | **Done** at `bdb000e3ae75863594aa40f5dc6318af53af2000`. Antecedent index SHA-256 `02d7172e47b4cb2a465fdc4d1618f2ae1a9b27c24f901dd2a6d55e7d8ce4562c`. |
| A5dm | AUTHORIZE INPUT V48 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `bdb000e3ae75863594aa40f5dc6318af53af2000`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `38fac942caa02fa92b18f7410e51b173c65538d60d4523f2925967f7f6c43b62`; SPKI SHA-256 `c46c65ccb8c922ef457de75bfafda574ee8e4d1703ec41312fd00b0516f86211`. Do not patch hashed v47 or v48 bytes. | **Done** at `3cbd9de8fe70660ae8775e2ae6a56cfe217879b4`. |
| A5dn | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:174445`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message-container clipsContent. Host then refused `$.children[0].children[1].cornerRadius` (MUI `input-field/message-container` host emits zero radii; compile omits cornerRadius). Polar has 0 content-row nodes. Do **not** invent a cornerRadius value. Do **not** restart v48 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5do | PREPARE INPUT V49. Copy the v48 stack. Do not patch hashed v48 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `cornerRadius` on `input-field/message-container` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent a cornerRadius value. Do not lift onto surface. Do not omit effects/strokes in the same prepare. Do not teach FIXED as a fill. | **Done** at `52442d178d16d35ad5f67483cfd053d394c633d1`. Antecedent index SHA-256 `bc8782ca1e68fb64d152cad7e2530772bb85ac3d96164e0d9a113260780d36b3`. |
| A5dp | AUTHORIZE INPUT V49 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `52442d178d16d35ad5f67483cfd053d394c633d1`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `f39494933f103e87876395bcc3e669244939e008ff79816a43589bbff53441c9`; SPKI SHA-256 `a5b0b0f31afcc23dca32ab97ffcede51c79c96a9fb4fe44b5eaa165423602a5d`. Do not patch hashed v48 or v49 bytes. | **Done** at `37ce970d3b0b4b62fa79f60685c233a02a02c6b4`. |
| A5dq | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:177174`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message-container clipsContent or cornerRadius. Host then refused `$.children[0].children[1].effects` (MUI `input-field/message-container` host emits `[]`; compile omits effects). Polar has 0 content-row nodes. Do **not** invent an effects value. Do **not** restart v49 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5dr | PREPARE INPUT V50. Copy the v49 stack. Do not patch hashed v49 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `effects` on `input-field/message-container` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent an effects value. Do not lift onto surface. Do not omit strokes in the same prepare. Do not teach FIXED as a fill. | **Done** at `b1a74248dea95eebeab7c7c40c1afc1eadb3fcec`. Antecedent index SHA-256 `9a427acb4327a50fdb5936f4b80588d994a11c5f770ea1cba9ef7934331e08a3`. |
| A5ds | AUTHORIZE INPUT V50 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `b1a74248dea95eebeab7c7c40c1afc1eadb3fcec`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `52eee8c911ca08798a26aaf76d314f3bc92cef213b154228ddc9638213cc0574`; SPKI SHA-256 `92fb1475f58d9ca85f327001c03b0ae4bc46bc0bb6db5254da67b12f80ef93ee`. Do not patch hashed v49 or v50 bytes. | **Done** at `bc0f4135094de6290d647dc9002be202113b105f`. |
| A5dt | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:179903`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message-container clipsContent, cornerRadius, or effects. Host then refused `$.children[0].children[1].strokes` (MUI `input-field/message-container` host emits `[]`; compile omits strokes). Polar has 0 content-row nodes. Do **not** invent a strokes value. Do **not** restart v50 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5du | PREPARE INPUT V51. Copy the v50 stack. Do not patch hashed v50 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `strokes` on `input-field/message-container` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent a strokes value. Do not lift onto surface. Do not teach FIXED as a fill. | **Done** at `32e4d58df3de0aa86ce162babceef0ea046e1998`. Antecedent index SHA-256 `a8ea2199a911f4e5f411efb07741053b11d0ffd4938098d40411e6870a8051cd`. |
| A5dv | AUTHORIZE INPUT V51 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `32e4d58df3de0aa86ce162babceef0ea046e1998`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `e3de348c136d5acebcb01b84321b261d72a57def576b8473dc1dccfc13b57949`; SPKI SHA-256 `a3a2478355f0a3f1f3eae13912248df26f744062872405608054498bf9f4c440`. Do not patch hashed v50 or v51 bytes. | **Done** at `d11577c233ebd85a0e0a9b5ee37bf193ca5fbd01`. |
| A5dw | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:182632`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse message-container clipsContent, cornerRadius, effects, or strokes. Host then refused `$.children[0].cornerRadius` (first variant; host emits zero radii; compile omits variant cornerRadius). Polar has 0 content-row nodes. Do **not** invent a cornerRadius value. Do **not** restart v51 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5dx | PREPARE INPUT V52. Copy the v51 stack. Do not patch hashed v51 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `cornerRadius` on `input-field/variant/*` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent a cornerRadius value. Do not lift onto surface. Do not omit variant clipsContent/effects/strokes in the same prepare. Do not teach FIXED as a fill. | **Done** at `4646704cfbd743630aff50e954dab0db8dda15c1`. Antecedent index SHA-256 `d649571a4e3deaaa4a4c83c6024e6479f9afb3832621f8754eea6067a2ed65ba`. |
| A5dy | AUTHORIZE INPUT V52 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `4646704cfbd743630aff50e954dab0db8dda15c1`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `3c3d00cd825bd23cf7afa347b21b6ac7792045de0fbce1b44dde1f195779d744`; SPKI SHA-256 `d0e74db72349b9d640561832cf4bf47e4068f9f3d4a07959e4c3ad94c791d49f`. Do not patch hashed v51 or v52 bytes. | **Done** at `64404899e3f6fd3d3591dcfb2bd31efeb8fada0e`. |
| A5dz | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:185361`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse variant cornerRadius. Host then refused `$.children[0].effects` (first variant; host emits `[]`; compile omits variant effects). Polar has 0 content-row nodes. Do **not** invent an effects value. Do **not** restart v52 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ea | PREPARE INPUT V53. Copy the v52 stack. Do not patch hashed v52 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `effects` on `input-field/variant/*` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent an effects value. Do not lift onto surface. Do not omit variant clipsContent/strokes in the same prepare. Do not teach FIXED as a fill. | **Done** at `34f5b20a738770c073d8b2ebffc236293066ddbb`. Antecedent index SHA-256 `6df0d393cb0097f12760598b10d48248f9cfc74009c4d333d3c193be50f0a57b`. |
| A5eb | AUTHORIZE INPUT V53 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `34f5b20a738770c073d8b2ebffc236293066ddbb`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `9bd80794f13755c6b0712162151307da72addd4c87250fa52a82aa358761876c`; SPKI SHA-256 `6d4081f61748a588bc1a323f47c11730758de10a3a0319d8f51d2e846563dd02`. Do not patch hashed v52 or v53 bytes. | **Done** at `aadee2885e623715a77339f63762de0d1242dc20`. |
| A5ec | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:188090`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse variant effects. Host then refused `$.children[0].strokes` (first variant; host emits `[]`; compile omits variant strokes). Compile-plan facts include variant clipsContent 128/128 both, so clipsContent is not the next omit. Polar has 0 content-row nodes. Do **not** invent a strokes value. Do **not** restart v53 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ed | PREPARE INPUT V54. Copy the v53 stack. Do not patch hashed v53 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `strokes` on `input-field/variant/*` that compile never emits (extract proved 128/128 both). Do not invent variables. Do not invent a strokes value. Do not lift onto surface. Do not omit variant clipsContent in the same prepare. Do not teach FIXED as a fill. | **Done** at `384095f379168cb5ff44c803eae28ff181e393a9`. Antecedent index SHA-256 `fa120b104bcc191513c5f39f10f36138ed3e7b31e9ecae0cce4e7cb0573ac047`. |
| A5ee | AUTHORIZE INPUT V54 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `384095f379168cb5ff44c803eae28ff181e393a9`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `49e6885f437869cf932b6797629b4ffd347b82387c0f82894abf6f207260a940`; SPKI SHA-256 `9df9d259ee55a79dd1e9be562e9aeedab885741f11df49137a783841ca59fa2d`. Do not patch hashed v53 or v54 bytes. | **Done** at `2d9e2002ba66dbe3653b3dca06483c82e77475fc`. |
| A5ef | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:190819`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse variant strokes. Host then refused `$.children[1].children[0].children[0].children[0].bindings[0].field` (MUI leading slot; host `height.value` first; compile `fills.0.color` first). Same three fields; order differs 64/64 both. Do **not** invent a binding field. Do **not** restart v54 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5eg | PREPARE INPUT V55. Copy the v54 stack. Do not patch hashed v54 scene-readback, extract, restore, writer, or runtime bytes. Teach host to order `input-field/slot/leading` bindings to compile field order `fills.0.color`, `width.value`, `height.value` (extract proved 64/64 both). Do not invent variables. Do not invent a binding field. Do not lift onto trailing slot. Do not teach FIXED as a fill. | **Done** at `975fe07e85595c4d1bf33b4fac8009149a68dbeb`. Antecedent index SHA-256 `aaf8c7dea4d31106caa1e02d3608e762db1a52b9662e9ca94a4837283b493599`. |
| A5eh | AUTHORIZE INPUT V55 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `975fe07e85595c4d1bf33b4fac8009149a68dbeb`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `ff5e07b255b0913dedb9e896cb2752c9700f81405cf42246ceec2d40568c335f`; SPKI SHA-256 `530b6927f36da65cfe12ea72622d3b88073970abc6641f0109ff0bd9b769bcbd`. Do not patch hashed v54 or v55 bytes. | **Done** at `7f18c36dbc77cec412d6f29893b78a74e46bb05a`. |
| A5ei | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:193548`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse leading-slot binding order (now compile order 64/64 both). Host then refused `$.children[2].children[0].children[0].children[1].bindings[0].field` (MUI trailing slot; host `height.value` first; compile `fills.0.color` first). Same three fields; order differs 64/64 both. Do **not** invent a binding field. Do **not** restart v55 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ej | PREPARE INPUT V56. Copy the v55 stack. Do not patch hashed v55 scene-readback, extract, restore, writer, or runtime bytes. Teach host to order `input-field/slot/trailing` bindings to compile field order `fills.0.color`, `width.value`, `height.value` (extract proved 64/64 both). Do not invent variables. Do not invent a binding field. Do not lift onto leading slot. Do not teach FIXED as a fill. | **Done** at `de7df3a31256ae5e728214553902facb7e89e265`. Antecedent index SHA-256 `1c01c6ae05e3482d9a11b63b2eb258c4050f5f96626196a2a03b2b6ca33ac502`. |
| A5ek | AUTHORIZE INPUT V56 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `de7df3a31256ae5e728214553902facb7e89e265`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `2b391e58efd8ee1701a29b3c620f82fd5b6b5bcd0d8c2618c6022a5d0c3fcc4a`; SPKI SHA-256 `f11ee09ba711a1bdfef65acd400f800aba2459317bc4d9e1ab51c2d105ef1afe`. Do not patch hashed v55 or v56 bytes. | **Done** at `7049c6ddcc416ab02f9fb3259768defa1ef5fd2f`. |
| A5el | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:196277`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse leading-slot or trailing-slot binding order (both compile order 64/64 both). Host then refused `$.children[4].children[0].children[1].children[1].bindings[0].field` (MUI `input-field/required-indicator`; host duplicate `fills.0.color` first; compile `type.fontSize` first). Same mapped fields; extras and order differ 64/64 both. Do **not** invent a binding field. Do **not** restart v56 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5em | PREPARE INPUT V57. Copy the v56 stack. Do not patch hashed v56 scene-readback, extract, restore, writer, or runtime bytes. Teach host to drop the duplicate mapped `fills.0.color` on `input-field/required-indicator` and order remaining bindings to compile field order `type.fontSize`, `type.lineHeight.value`, `fills.0.color` (extract proved 64/64 both). Do not invent variables. Do not invent a binding field. Do not lift onto label. Do not teach FIXED as a fill. | **Done** at `187bce50e3311c3f4040d7eb263ffdbab02d5b06`. Antecedent index SHA-256 `5b2d91f7e2f83191d666ee97b69b46273a6b9ad215ea6764f77b3ba8425451ab`. |
| A5en | AUTHORIZE INPUT V57 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `187bce50e3311c3f4040d7eb263ffdbab02d5b06`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `6bec9ff3be636f978e08098f42935782da5bfec2d71b92a99bf791d731fb1c13`; SPKI SHA-256 `ac3fc235272d0f435ecb569ded3dceab541b9bbca72d3c72cb126daa8a9af74f`. Do not patch hashed v56 or v57 bytes. | **Done** at `0fd7f8a2a27cb33c9f039788c1e698f83a2d23de`. |
| A5eo | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `106:199006`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse required-indicator binding extras or order (now compile order 64/64 both). Host then refused `$.children[4].children[0].children[1].children[1].type.letterSpacing` (MUI `input-field/required-indicator`; host `{unit: percent, value: 0}`; compile omits letterSpacing). Same 64/64 Polar. Do **not** invent a letterSpacing value. Do **not** restart v57 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ep | PREPARE INPUT V58. Copy the v57 stack. Do not patch hashed v57 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `type.letterSpacing` on `input-field/required-indicator` that compile never emits (extract proved 64/64 both). Do not invent variables. Do not invent a letterSpacing value. Do not lift onto label. Do not omit textCase or textDecoration in the same prepare. Do not teach FIXED as a fill. | **Done** at `76ee865c07fd9bcf90ce04ed86c7a638294b9488`. Antecedent index SHA-256 `1e368a9f02b8e61fdf0935d977a38021e8c70157876abd6ce5ba5e8ff69f980c`. |
| A5eq | AUTHORIZE INPUT V58 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `76ee865c07fd9bcf90ce04ed86c7a638294b9488`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `efd7160b5bb49b987d698d127904206dbd427be60d7db1e54457c05604de70ce`; SPKI SHA-256 `9f5e529985ee2a229bad9bf64002db2622d648c215f7b5bdb24d988b0dc7bcc1`. Do not patch hashed v57 or v58 bytes. | **Done** at `82aa321d40d828d474ca83b82cfd7dbbe1bf59c7`. |
| A5er | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `107:201735`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse required-indicator letterSpacing (now omitted 64/64 both). Host then refused `$.children[4].children[0].children[1].children[1].type.textCase` (MUI `input-field/required-indicator`; host `original`; compile omits textCase). Same 64/64 Polar. Do **not** invent a textCase value. Do **not** restart v58 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5es | PREPARE INPUT V59. Copy the v58 stack. Do not patch hashed v58 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `type.textCase` on `input-field/required-indicator` that compile never emits (extract proved 64/64 both). Do not invent variables. Do not invent a textCase value. Do not lift onto label. Do not omit textDecoration in the same prepare. Do not teach FIXED as a fill. | **Done** at `42a1388bfcfc403030cb719f92c98c7e89dbf6e3`. Antecedent index SHA-256 `1e3247fb49fe2244c38130ece0f218b4133e0b73742eac1777ab22f9fee3f4b1`. |
| A5et | AUTHORIZE INPUT V59 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `42a1388bfcfc403030cb719f92c98c7e89dbf6e3`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `da9e763ba3815daf2d98e8f9665a549e3ac282bde9b0cb240ea6d3775f362f9a`; SPKI SHA-256 `42cb6cb1e0d28993946e64a3c2bf173354acdd96c33ced65f1373cd7f37461df`. Do not patch hashed v58 or v59 bytes. | **Done** at `d835ad4fff7185c6e45d20a2ef3799781d9e487c`. |
| A5eu | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `107:204464`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse required-indicator textCase (now omitted 64/64 both). Host then refused `$.children[4].children[0].children[1].children[1].type.textDecoration` (MUI `input-field/required-indicator`; host `none`; compile omits textDecoration). Same 64/64 Polar. Do **not** invent a textDecoration value. Do **not** restart v59 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ev | PREPARE INPUT V60. Copy the v59 stack. Do not patch hashed v59 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `type.textDecoration` on `input-field/required-indicator` that compile never emits (extract proved 64/64 both). Do not invent variables. Do not invent a textDecoration value. Do not lift onto label. Do not teach FIXED as a fill. | **Done** at `f86ee4e597e2acf961f457b2fb718ea117d1fb91`. Antecedent index SHA-256 `ae063073e0cd93ebc4a46b514ab00208708567b758da5681354e60c99da905fb`. |
| A5ew | AUTHORIZE INPUT V60 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `f86ee4e597e2acf961f457b2fb718ea117d1fb91`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `29a99e9c6a320e30e2ee0c8a7249032b3a427ba7d837f362823bc626a842e7e5`; SPKI SHA-256 `063f0fb75d9b4b567a9e9b3f56fff23c8e65eca3cd9dae4302a56e8820cfc309`. Do not patch hashed v59 or v60 bytes. | **Done** at `5cf3ca2f9b24e84ae3b4da073266f52e8ffdeb47`. |
| A5ex | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `107:207193`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse required-indicator textDecoration (now omitted 64/64 both). Host then refused `$.cornerRadius` (component-set root `input-field/set`; host 5px all sides both sources; compile omits cornerRadius). Do **not** invent a radius. Do **not** restart v60 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ey | PREPARE INPUT V61. Copy the v60 stack. Do not patch hashed v60 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `cornerRadius` on `input-field/set` that compile never emits (extract proved both sources). Do not invent variables. Do not invent a radius value. Do not lift onto variants. Do not omit set clipsContent, fills, strokes, or effects in the same prepare. Do not teach FIXED as a fill. | **Done** at `08c808c31a72826aa4c691a1aab273b9b6158600`. Antecedent index SHA-256 `e5e6f712c266748d99971df0f28da861bbd55c9ded0075d002ace1106df39b0c`. |
| A5ez | AUTHORIZE INPUT V61 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `08c808c31a72826aa4c691a1aab273b9b6158600`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `8e27c3d989d4a9800e40ab8598e6090794255cf8cee64f0bd2ace3a139a791cd`; SPKI SHA-256 `427d17f43b6265216ded9a62e3665e268a948629f76fef0c7ff57f2bd8074b44`. Do not patch hashed v60 or v61 bytes. | **Done** at `8ab3c7c4f79bf0f9c8a5bdbbe050a184f4539494`. |
| A5fa | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `108:209922`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse set cornerRadius (now omitted both sources). Host then refused `$.effects` (component-set root `input-field/set`; host `[]` both sources; compile omits effects). Do **not** invent an effects value. Do **not** restart v61 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fb | PREPARE INPUT V62. Copy the v61 stack. Do not patch hashed v61 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `effects` on `input-field/set` that compile never emits (extract proved both sources). Do not invent variables. Do not invent an effects value. Do not lift onto variants. Do not omit set clipsContent, fills, or strokes in the same prepare. Do not teach FIXED as a fill. | **Done** at `0f6b3f0fe7aa6204a88b99ea5b823d2179ed2cb4`. Antecedent index SHA-256 `442c1f1d1125bb5fe28edfd2b3e7a92ed99ee66458de1366f4998f414ea37cc2`. |
| A5fc | AUTHORIZE INPUT V62 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `0f6b3f0fe7aa6204a88b99ea5b823d2179ed2cb4`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `bd887c496b95c0fe7638b2ff321a437ca7c03c48975abed259ca57e36fcfb3ba`; SPKI SHA-256 `b7422fa3bebef2a6482e5ba158cb73a9450c9e8c2ba78afbc15a0c2cf9414ae5`. Do not patch hashed v61 or v62 bytes. | **Done** at `86b465e91a6515257bafa7649f22ec2db05a3345`. |
| A5fd | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `108:212651`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse set effects (now omitted both sources). Host then refused `$.fills.length` (component-set root `input-field/set`; host `[{kind:solid,color:#f7f7f8ff}]` both sources; compile omits fills). Do **not** invent a fill. Do **not** restart v62 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fe | PREPARE INPUT V63. Copy the v62 stack. Do not patch hashed v62 scene-readback, extract, restore, writer, or runtime bytes. Teach host to omit `fills` on `input-field/set` that compile never emits (extract proved both sources). Do not invent variables. Do not invent a fill. Do not lift onto variants. Do not omit set clipsContent or strokes in the same prepare. Do not teach FIXED as a fill. | **Done** at `08bcae728ec245222c2c9eec07938c8f86af78f0`. Antecedent index SHA-256 `70425813fa5986bb8c22164df4df768049302d09d3610b952bd0889275d3425b`. |
| A5ff | AUTHORIZE INPUT V63 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `08bcae728ec245222c2c9eec07938c8f86af78f0`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `169d85c1eb93c5bd9c4c4c586b1355b135503a19a128800109519a3f3e543cf9`; SPKI SHA-256 `3efd14ed27a07f1146f486eaa84dc811ec323c01fb54dfc48b37b902edde299a`. Do not patch hashed v62 or v63 bytes. | **Done** at `c90f5ee9d1331038968bd48aeaf672370079080b`. |
| A5fg | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `108:215380`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse set fills.length (set fills now `[]` both; hashed v62 still emits the solid). Host then refused `$.layout.mode` (component-set root `input-field/set`; host extract `HORIZONTAL` / IR `horizontal` both; compile emits `vertical`). This is not a compile-absent omit. Do **not** invent a vertical mode. Do **not** restart v63 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fh | PREPARE INPUT V64. Copy the v63 stack. Do not patch hashed v63 scene-readback, extract, restore, writer, or runtime bytes. Teach compile to emit set `layout.mode` `horizontal` — the carried live fact both libraries minted (extract HORIZONTAL / host IR horizontal; frozen v16 writer sets `set.layoutMode="HORIZONTAL"` after `combineAsVariants`; payload IR still said vertical). Do not invent `vertical` onto host. Do not omit `layout.mode`. Do not omit set strokes or change variant clipsContent. Do not invent a variable. Do not teach FIXED as a fill. | **Done** at `efcc7cf17dbd06f108dbe5edbcbee119067ca91d`. Antecedent index SHA-256 `5d6b32ee7190d6ad789292ba9242dd8b05c36d3234ef1b2fe21b204638304ac6`. |
| A5fi | AUTHORIZE INPUT V64 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `efcc7cf17dbd06f108dbe5edbcbee119067ca91d`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `bf69bca502af34653721726d153480c4b7be9f3639adf6c4b3924f9f53ccc2cf`; SPKI SHA-256 `00d3469d4b98e5bc80422104ac796a3b5bd6b96b8ad141b4ab425631e58efe6a`. Do not patch hashed v63 or v64 bytes. | **Done** at `5c3d627cf8ffa07c9dc5575cade0845da0f187c3`. |
| A5fj | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `108:218109`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse set `layout.mode` (now `horizontal` both; teaching held). Host then refused `$.layout.padding.bottom` (component-set root `input-field/set`; host extract padding 32/32/32/32 / IR `{32,32,32,32}` both; compile emits `{0,0,0,0}`). This is not a compile-absent omit. Do **not** invent padding 0 onto host. Do **not** omit `layout.padding.bottom`. Do **not** restart v64 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fk | PREPARE INPUT V65. Copy the v64 stack. Do not patch hashed v64 scene-readback, extract, restore, writer, or runtime bytes. Teach compile to emit set `layout.padding` `{32,32,32,32}` — the carried live fact both libraries minted (extract 32/32/32/32 / host IR 32 all sides; compile had `0`; frozen v16 payload said 0; writer program has 0 paddingBottom assignments). Do not invent `0` onto host. Do not omit `layout.padding`. Do not omit set strokes or change variant clipsContent. Do not invent a variable. Do not teach FIXED as a fill. | **Done** at `4102d81390d981e5fde5db7b8d46b9b2f3ab83c4`. Antecedent index SHA-256 `c58cea06652ca0adb51e6a68276f820e3bfa196e4191c454fb0602e751151356`. |
| A5fl | AUTHORIZE INPUT V65 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `4102d81390d981e5fde5db7b8d46b9b2f3ab83c4`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `ef81aeec6f342967dcc09334a63de5a24f521d02b9f4911bca22a5ae6a0fdb86`; SPKI SHA-256 `d1e7efd2fece7c3416b7a6bc7c1f2da838181ac6276737c71ef0995c0f28788e`. Do not patch hashed v64 or v65 bytes. | **Done** at `aeb0efa7e540b7c88bc66698ef4a210611c781e6`. |
| A5fm | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, page `108:220838`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436213 bytes). Host did not refuse set `layout.padding` (now `{32,32,32,32}` both; teaching held). Host then refused `$.layout.width.mode` (component-set root `input-field/set`; extract FIXED 31656/33050 / host IR fixed both; compile emits `hug`). This is not a compile-absent omit. Do **not** invent hug onto host. Do **not** omit `layout.width.mode`. Do **not** teach FIXED. Do **not** compile-carry one width (libraries disagree). Do **not** restart v65 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fn | PREPARE INPUT V66. Copy the v65 stack. Do not patch hashed v16 writer program `a01d95b3…d6b3` or payload `b091cf61…0597`. Mint an unfrozen v17 writer that assigns `set.layoutSizingHorizontal="HUG"` after `combineAsVariants`. Keep v16 payload file unchanged; v17 payload/program get their own hashes. Restore/runtime/extract stay v16 frozen bytes. Hashed v65 scene-readback stays frozen. Do not teach FIXED. Do not invent hug onto host-normalize. Do not omit `layout.width.mode`. Do not compile-carry `31656` or `33050`. Do not change set `layout.mode` back to `vertical`. | **Done** at `4f08701a7204d36cee363e5fd4725e8fd1af01cb`. Antecedent index SHA-256 `e368b48be937996cc888f0792c9d89a4cd9c753ce0f1b3b110a6fa914e052e59`. |
| A5fo | AUTHORIZE INPUT V66 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `4f08701a7204d36cee363e5fd4725e8fd1af01cb`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `8dde188b1f6764c286e260b4149857abf1de3acc8abaa0359e90755f5ddb4c0d`; SPKI SHA-256 `78ad6a53d3858803f0ca20958989165e2a3a995be2414767ea68b90ce350c55f`. Do not patch hashed v16 or v66 bytes. | **Done** at `6b0bdd23321b803b9cb07dc972b7978ddf480f18`. |
| A5fp | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, new page `108:223567`, not `108:220838`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436209 bytes). Host did not refuse set `layout.width.mode` (extract HUG both; host IR `{mode:hug}` both; compile `hug`; v17 writer teaching held). Host then refused `$.strokes` (component-set root `input-field/set`; extract/host `[]` both; compile omits). This is a compile-absent omit. Do **not** invent a stroke. Do **not** compile-carry `[]`. Do **not** teach FIXED. Do **not** restart v66 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fq | PREPARE INPUT V67. Copy the v66 stack. Do not patch hashed v16 writer or hashed v66 scene-readback `e92b6955…53e9`. Teach host-normalize to omit set `strokes` — compile-absent; extract/host `[]` both. Keep v17 writer bytes (HUG teaching already held). Restore/runtime/extract stay v16 frozen source hashes. Expected scene plans stay the v66 compile-carry set. Do not teach FIXED. Do not invent a stroke or `[]`. Do not omit `layout.width.mode`. Do not change set `layout.mode` back to `vertical`. | **Done** at `c129c6b8df484061cdf3fb6bc695c8b78c41db58`. Antecedent index SHA-256 `c5f2f551ce0b64390b42735e90ac6cd2d5e4283f21da85ed7a150b8b68c95384`. |
| A5fr | AUTHORIZE INPUT V67 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `c129c6b8df484061cdf3fb6bc695c8b78c41db58`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `62288d19db1fd59b51e15077ae0782f46146f6eec2b0d94a54dcf8d69d112294`; SPKI SHA-256 `0126571b64968a906002cce76976da9435267c714a875788b46b84500b50ebf1`. Do not patch hashed v16, v66, or v67 bytes. | **Done** at `81a75ebc42a09cb9ed84f1d4cbc0aa0e11427eb3`. |
| A5fs | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, new page `108:226296`, not `108:223567`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436209 bytes). Host did not refuse set `strokes` (host IR omits both; extract `[]` both; compile omits; v67 teaching held). Extract width remains HUG both (host IR `{mode:hug}`; v66 teaching held). Host then refused `$.children[0].children[0].bindings[1].field` (Polar `input-field/label-row`; host `layout.padding.left` vs compile `layout.padding.top`; same 3 fields, order swap). MUI first child is surface and already matches compile order. This is a binding-order gate. Do **not** invent a binding. Do **not** compile-carry Polar encounter order. Do **not** teach FIXED. Do **not** restart v67 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5ft | PREPARE INPUT V68. Copy the v67 stack. Do not patch hashed v16/v17 writer or hashed v67 scene-readback `9fd064de…9c8d`. Teach host-normalize to order `input-field/label-row` bindings to compile fields `layout.itemSpacing`, `layout.padding.top`, `layout.padding.left` — same 3 fields, order swap. Keep v17 writer bytes (HUG teaching already held). Restore/runtime/extract stay v16 frozen source hashes. Expected scene plans stay the v66 compile-carry set. Do not invent a binding. Do not lift onto surface. Do not teach FIXED. Do not omit `layout.width.mode`. Do not change set `layout.mode` back to `vertical`. Do not compile-carry Polar encounter order. | **Done** at `9df90119ab1b29c7f340f8b340e4b57661948bf2`. Antecedent index SHA-256 `c0026cb6fce6cdb094e83f9bd84eeac82a2ca865ae0a95e02af4c84435575e07`. |
| A5fu | AUTHORIZE INPUT V68 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `9df90119ab1b29c7f340f8b340e4b57661948bf2`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `94175d4aff4488c65589d295fa0a310be047b966ea16a28d5a3581c1f1203412`; SPKI SHA-256 `d36af9c965b0c6731f8eca3772923c6b1c3e78e6c29494a37ebd7f9bbd0f1c05`. Do not patch hashed v16, v17, or v67 bytes. | **Done** at `df564ae285fd413db96b046aab549091260501f2`. |
| A5fv | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, new page `108:229025`, not `108:226296`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436209 bytes). Polar label-row bindings now match compile order (v68 teaching held). Set strokes omitted both (v67 teaching held). Extract width remains HUG both (host IR `{mode:hug}`; v66 teaching held). Host then refused `$.children[0].children[1].bindings[0].field` (Polar `input-field/surface`; host `layout.padding.right` vs compile `layout.itemSpacing`; same 13 fields, order swap). MUI surface still 12 compile-order bindings. This is a binding-order gate. Do **not** invent a binding. Do **not** compile-carry Polar encounter order. Do **not** teach FIXED. Do **not** restart v68 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fw | PREPARE INPUT V69. Copy the v68 stack. Do not patch hashed v16/v17 writer or hashed v68 scene-readback `a7b07c07…9c8d`. Teach host-normalize to order `input-field/surface` bindings so Polar `layout.itemSpacing` sits at compile index 0, then the prior 12 surface fields. Same 13 fields, order swap. MUI surface stays 12 compile-order bindings (no itemSpacing invented). Keep v17 writer bytes (HUG teaching already held). Restore/runtime/extract stay v16 frozen source hashes. Expected scene plans stay the v66 compile-carry set. Do not invent a binding. Do not teach FIXED. Do not omit `layout.width.mode`. Do not change set `layout.mode` back to `vertical`. Do not compile-carry Polar encounter order. | **Done** at `2c4cba6b635eefe4649f63327ae4fa604b93c97a`. Antecedent index SHA-256 `e84dd63369b41ae97c8126f2c0d21c6edad57df4affcf8292552009c431b60a0`. |
| A5fx | AUTHORIZE INPUT V69 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `2c4cba6b635eefe4649f63327ae4fa604b93c97a`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `7ab2a3f0dec58cda42aa92dd59672d42c9e35c1a5439b5621be184070a42b2fa`; SPKI SHA-256 `bbfa4133357dfc87235cd4410925acf24aed468ac087c1d1e8f37705b392b36d`. Do not patch hashed v16, v17, or v68 bytes. | **Done** at `32f501e2f64445267ae51613e9036d999d791a75`. |
| A5fy | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, new page `108:231754`, not `108:229025`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436209 bytes). Polar surface bindings now match compile order (v69 teaching held). Polar label-row compile order held. Set strokes omitted both. Extract width remains HUG both (host IR `{mode:hug}`; v66 teaching held). Host-normalize / recipe-collapse did not refuse. Independent root accounting then silent-mismatched (MUI 577 / Polar 641). Measured: name font-provenance key order (448+448, same 7 keys, order-only); instancePayload `fills[0].kind:solid` vs `type:SOLID` (MUI 128 only; Polar 128 plus width drift); Polar intrinsicSize.width 8→9 (64) and 25.78125→30 (64); Polar effect drop-shadow spread 1→0 (32) and 3→0 (32); both roots swap variantAxis Size `[small,medium]` vs `[medium,small]`. Do **not** invent Polar pixels/spreads. Do **not** teach FIXED. Do **not** restart v69 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |
| A5fz | PREPARE INPUT V70. Copy the v69 stack. Do not patch hashed v16/v17 writer or hashed v69 scene-readback `1f3a98e5…3be3`. Teach the accounting observer to canonicalize `name` font-provenance JSON key order to compile/expected `canonicalJson` (`fallbackChain`-first). Same 7 keys, order-only, 448/448 both. Keep v17 writer bytes. Restore/runtime/extract stay v16 frozen source hashes. Expected scene plans stay the v66 compile-carry set. Do not include fill discriminator or Size axis in this prepare. Do not invent Polar widths or spreads. Do not teach FIXED. | **Done** at `7dec097c890d1fb888024b43ecddeec880321083`. Antecedent index SHA-256 `d5d3d68fdc90954862f467c889a8a0b68fcd4e62b6316cb8abdb066aaaa9a2de`. |
| A5ga | AUTHORIZE INPUT V70 as a **separate** later commit. New prepare-era Ed25519 signer. Antecedent `7dec097c890d1fb888024b43ecddeec880321083`. Auth lifecycle stays out of the hash set. Artifact SHA-256 `64567c9f95c68d8f03fd784b2cf28f3f1f8ce26004421d06f35d82d629588073`; SPKI SHA-256 `4cec0fd5afe392a52618fdcfa80f17ebb7703657594785b35da62a9bed50a97b`. Do not patch hashed v16, v17, or v69 bytes. | **Done** at `12fb32700ef53ee2bdcc06dcc6bb064560a97815`. |
| A5gb | Attempt 1 Scratch-only live after attestation and preflight. | **Failed closed.** Writer accepted (2317 nodes, new page `110:234483`, not `108:231754`). Cleanup persisted; restore accepted (`restoredCount` 256, `hiddenRevealedForFill` 24, `retriedForFill` 0). Extract issued (8436209 bytes, sha256 `33907f7c…2917`). Font-provenance name key-order teaching held (name silent 448+448 → 0). Polar surface/label-row compile order held. Set strokes omitted; width remains HUG both. Independent root accounting then silent-mismatched (MUI 129 / Polar 193). MUI instancePayload is `kind:solid` vs `type:SOLID` only (128). Polar every payload also drifts `intrinsicSize.width` 8→9 / 25.78125→30 (128). Polar effect drop-shadow spread 1→0 / 3→0 (32+32). Size axis order-only 1+1. Fill is **not** kind/type-only on both libraries. Do **not** invent Polar pixels/spreads. Do **not** PREPARE V71 for fill. Do **not** teach FIXED. Do **not** restart v70 attempt 2 as-is. Cleanup accepted; owned Input pages 0. |

### B · Button closeout

| step | action | exit criterion |
| --- | --- | --- |
| B1 | Keep the technical mint, usability, restoration, and 12/12 adjudication bytes. Do not restamp them. | Existing Button technical measurements remain byte-stable. |
| B2 | Fresh scene-derived inversion/accounting from the live Button page, not stamped/self-selected IR. Do not collide with or rewrite that page except as an explicit later proof if required. | Silent losses derived from a prospective multiset denominator; inversion is scene-derived. |
| B3 | Attributable human signoff on Button. | **Human gate.** Overall Button stays **false** until signed. |

### C · Combobox

Offline two-library proof already exists at `41e34588` (`@mui/material@9.2.0#Autocomplete`, `antd@5.29.3#Select`; 24 paired cells; 72 components / 242 instances). `npm run recipe:combobox:check` is the offline gate.

| step | action | exit criterion |
| --- | --- | --- |
| C1 | Matched source/legacy benchmark over the frozen 24-cell matrix if still required by this document's comparison contract. Keep the legacy 4/4 over six variants as weak context only. | Source references rendered; legacy comparator re-derived on the same matrix; recipe and legacy reported together. |
| C2 | Scratch-only live mint on the same recipe-IR + receipts bar, two real libraries. Separate authorize lineage; no Input page collision. | Writer + extract + host normalize/account + gates + captures + cleanup; named or carried; zero silent losses. |
| C3 | Independent human grade. | **Human gate.** Combobox overall stays false/ungraded until signed. |

### D · Data Table and Calendar

Neither has a recipe path yet. Acquisition must be human-authored or
human-reviewed adapters, not inferred rectangles.

| step | action | exit criterion |
| --- | --- | --- |
| D1 | Explicit Data Table recipe + reviewed adapters for two unrelated real libraries. Offline cross-library proof first: row/column templates, declared column axis, required-facts / door / lowering / grammar coverage. | Offline gate green; every fact named or carried; no silent losses. |
| D2 | Scratch-only Data Table live, same receipts bar. | Live mint usable; scene-derived inversion/accounting; cleanup complete. |
| D3 | Calendar archetype addition is a reviewed minor contract change (`ARCHETYPES` in `packages/schema/src/archetype.ts` plus required-facts). Then the same offline-then-live sequence. | Calendar is no longer “undefined (0 contracts)” by proof, not by deleting the bar. |
| D4 | Human review of Table/Calendar adapters before live if a human-authored adapter is required. | **Human gate** for adapter authorship/review only. Live still Scratch-only. |

### E · Cross-library, inverse, and corpus honesty

| step | action | exit criterion |
| --- | --- | --- |
| E1 | Keep at least one archetype vs two unrelated real libraries on the **live** path (already true offline for Input and Combobox). | Live receipts name both libraries. |
| E2 | Inverse non-regression. The existing first-pass harness is recipe-agnostic and must not regress. | `npm run first-pass:check` (and the recipe inverse/census gates that exist for the subject) stay green. |
| E3 | Keep publishing 117/170 recognisable and 39/170 usable-on-all-four comparisons. Recipe four vs the same measurement. Do not drop legacy numbers. | `recipe:regression:census` / census recount still report both denominators. |
| E4 | Reconcile `docs/26-v1-definition.md` `V1-CLASS-01` / `V1-CLASS-02` with recipe capability. Docs/26 currently lists combobox/table/calendar as not v1-supported. User demand is that they **are** in v1. Resolve by proving them and then citing the green gates; do not delete or weaken the bar first. | Docs/26 rows change only when the named gate is green on a commit. |

### F · v1 binary checklist

v1 is complete only when every row is actually true:

1. Named or carried, zero silent losses, on the whole corpus and on unseen libraries.
2. Minted sets usable (auto-layout reflows, variants switch, tokens bound), not merely correct-looking.
3. Journeys restated honestly: A Figma→code, B code→Figma, C reconcile — what is proven vs still open.
4. Button, Input, Combobox, Data Table, and Calendar each have recipe-path proof plus attributable human signoff, or a named refusal a reader can act on.
5. Docs/26 rows and this document agree; no silent reclassification.
6. CI lanes required for release are green. npm publish remains deferred and is not a v1-proof substitute.

### Human-only work (do not block the rest)

- Attributable human signoff on Button and Input; later Combobox, Data Table, and Calendar.
- Old PAT still cannot be revoked (other apps). Keep the replacement PAT and residual-risk acceptance (`oldTokenRevoked=false`, `ownerRiskAcceptance=true`).
- Recipe acquisition review for Data Table / Calendar adapters before live if a human-authored adapter is required.
- Final designer recognisability grades; AI raters are retired for architecture progression.

### Immediate next command

V70 attempt 1 failed closed on Polar pixel/spread value drift. Do **not** invent `9`, `30`, or spread `0`. Do **not** PREPARE V71 for the fill discriminator: Polar `instancePayload` is not kind/type-only. Do **not** restart V70 attempt 2. Do **not** patch hashed v69/v70 scene-readback or unfreeze the writer.

Stop here unless a later measured same-class order/alias is kind/type-only on **both** libraries, or a non-invented host/compile fact names the Polar width/spread drift.

## Correction task 2 — offline implementation, 2026-08-27

The Input model now carries source-neutral adornment payloads instead of only
slot roles: text/glyph/instance content, font request and resolution provenance,
fills/opacity, intrinsic geometry, padding/alignment, accessibility relation,
and exact source citation. The reviewed fixtures acquire `$` and `USD` from
the pinned MUI `InputAdornment` and Polaris `TextField` sources. The typed
Figma lowering creates visible text descendants and never paints the instance
root into the historical gray placeholder block.

Font requests now name family/style, request source, ordered fallback chain,
resolved family/style, and either exact resolution or a named degradation.
Unavailable, wrong-style, zero-width, and provenance-tampered resolutions
refuse by name. Generated CSS quotes validated family names, rejects control
and injection syntax, detects custom-property collisions before output, and
checks every generated path remains inside its output root.

React now tracks uncontrolled content and focus while preserving controlled
value and `onChange` semantics. The Web Component constructs its shadow tree
once, patches stable nodes, and preserves input identity, focus, value,
selection, and caret across input and external attribute updates. Pinned
Chromium tests cover type → blur → refocus, controlled reversion, events,
external value/error/disabled changes, text escaping, and nonzero source-
independent visual regions for label, helper, adornments, surface, focus,
error, and disabled states.

Input Figma v2 no longer rewrites generated source strings. Both versions
lower the same typed IR/plan through a versioned program with deterministic
bytes, explicit page ownership, collection/adapter collision refusal, and
future scene-readback instrumentation. Scene accounting compares the complete
adornment payload and visual fields with stable occurrence IDs.

This remains offline preparation only. Button overall remains false/pending and
Input remains blocked. The v3 runner was committed before attempt 1. That writer
minted 2×128 variants, but verification failed before extraction and measured
zero facts. The prospective v3 criterion bytes, semantics, thresholds,
antecedent, and authorization artifact remain unchanged.

## Attempt 1 correction — Figma runtime portability, 2026-08-27

Attempt 1 used code commit
`5e95105b16f3e30e0fb67a53a6eda7a86c105c61`. Its exact 2,440,411-byte writer
decoded to SHA-256
`e831b450b450a0b9fc0d086bc33a428ca473fed12616d3cf0b82ada8f4f16f24`,
evaluated, and minted both 128-variant sets. Scene verification then failed at
`recipe/scene-readback-runtime.ts:35`: the Figma sandbox exposed no
constructible `TextDecoder`. Expected scene facts were 43,726; measured scene
facts, objective rows, captures, and fixed-point cycles were all zero. No
success receipt or human packet exists.

The correction replaces that assumption with an RFC 3629 decoder that refuses
invalid lead, continuation, overlong, surrogate, out-of-range, and truncated
sequences by name. Native `TextDecoder` is optional and is selected only after
fatal-mode probes and exact equality with the fallback. Base64 and SHA-256 are
portable audited implementations; `TextEncoder`, `atob`/`btoa`, Web Crypto,
`structuredClone`, `Buffer`, compression streams, fetch, URL, Blob, and
FileReader are not runtime dependencies.

Cleanup now marks variable collections with exact ownership, switches away
from an owned current page before removal, rejects name collisions without
ownership, and is idempotent. The failed runner cleanup and successful manual
cleanup remain separate evidence. Manual cleanup removed page `86:34550` and
collections `VariableCollectionId:86:34552` and
`VariableCollectionId:86:35979`; unrelated Scratch state returned to fingerprint
`10ba6b57da3cfa97` with 13 pages, 14 collections, and 11,163 variables.

Attempt 2 ran from correction commit
`98de9c3ceae06881bc477e7099b47e8f5a87cf10`. Its exact 2,449,180-byte writer,
SHA-256 `92da8f8c5ae78a870b392f9dfb3e239e82e8dc018d9abebfbcdd8118bf542811`,
passed the portable runtime preflight and minted 256 variants. Extraction then
refused `I86:38597;86:38583`: owned leading-adornment instance `86:38597`
materialized a read-only `TEXT` descendant backed by helper text `86:38583`.
That descendant has no direct shared plugin data. Expected scene facts remained
43,726; measured scene facts, objective rows, captures, and fixed-point cycles
remained zero. No success receipt or human packet exists.

The correction derives identity only beneath an exactly owned `INSTANCE`. The
key combines the owned ancestor key, its actual main-component identity, and
each actual child type/index/occurrence plus nested-instance main-component
identity. It must equal one unique precomputed plan key. Names, characters,
geometry, paints, styles, and source IR never contribute. Unowned ordinary
nodes, detached or missing-main-component instances, component descendants,
unexpected or reordered children, duplicate keys, and ownership metadata
collisions refuse.

Attempt-2 runner cleanup again persisted only incomplete sentinel counts because
its catch discarded the exception. Manual cleanup verified and removed page
`86:38503` and collections `VariableCollectionId:86:38505` and
`VariableCollectionId:86:39932`; Scratch returned to fingerprint
`10ba6b57da3cfa97` with 13 pages, 14 collections, and 11,163 variables. The
finally path now records cleanup errors, loads all pages, verifies exact shared
ownership (never name alone), switches away through `setCurrentPageAsync`,
removes the page before bound collections, tolerates already-removed owned
objects, allows 120 seconds for the 2,317-node teardown instead of 30, and
re-counts zero leftovers.

Attempt 3 is the final allowed v3 attempt. Preflight requires exact history
`[1,2]`, refuses attempt 4 or a missing prior attempt, verifies the generated
identity plan and Plugin API audit, and requires a clean published descendant
of the existing authorization commit.

The prepared, unexecuted attempt-3 writer is 2,453,320 bytes,
SHA-256 `c88ffc740fb91448fa37685b0a832fc7420e0e34f5838352af75c8f617abc2bc`;
its 3,281,234-byte wrapper is
`f378d76d33e3e59a44cf09430f1b0a2dc02078ad1c1531b01bc236b9642501be`.
The transport envelope is
`3af956a1cb9207f2a831114462bacebaeb4fdb2732ef4e6ae1acc2cf3a1dc843`.
Scene facts remain locked at 22,811 MUI plus 20,915 Polaris (43,726 total);
the separate identity-only plan adds 128 generated descendants per source.
Conformance remains 256 variants, 152 variables, 11,547 plugin-data writes,
37,647 property writes, and 8,192 bindings.

## 0 · The decision, in one paragraph

Structure stops being inferred from a bag of CSS channels and starts being
**compiled**. An archetype-specific **recipe** takes reviewed input facts and
emits a tree in a small **canonical Figma capability IR** — a closed vocabulary
of things Figma can actually draw — plus a **loss receipt for every input fact
the IR does not carry**. Facts that belong only to code (behaviour, ARIA, focus
order, virtualization) become declared **code-only extensions** rather than
silent drops. The IR is normalized and **canonically hashed**, so "the same
recipe over the same input draws the same set" is a byte comparison instead of
a screenshot argument.

The decisive proof is five archetypes: **Button, Input/Field, Combobox, Data
Table, Calendar**. Button proves the spine end to end. Input/Field proves a
second control shape with editable text, placeholder content and interaction
states before the three hard cases. The other three each break a different
assumption the current engine makes, and one of them (Calendar) has never been
attempted at all.

The legacy contract corpus is **not** migrated. It is retained as regression
research behind a read-only adapter.

---

## 1 · Why the current shape cannot get there

The engine today carries a per-property channel table
([30 — Channel table](30-channel-table.md), `spec/channel-table.json`) and an
archetype **referee** that checks whether load-bearing facts are _present_
(`packages/core/src/required-facts.ts`). Both are good instruments and both
stay. What is missing sits between them:

1. **Nothing owns structure.** `required-facts.ts` can refuse a card with no
   column axis, but it cannot _supply_ the axis. Structure is whatever the
   captured anatomy tree happened to be, so the same archetype mints
   differently from two libraries and neither result is wrong by any rule the
   repo can state.
2. **The target vocabulary is open.** Lowering decisions are spread across
   `core/emit-figma-script.ts` and registered after the fact
   (`spec/lowering.json`). There is no closed set of "things the canvas can be
   asked to do", so a new CSS construct has no bounded place to land and the
   forward direction accumulates unregistered structure decisions.
3. **Loss is reported, not enforced.** `code-only-facts:check` names dropped
   facts on the surfaces a person reads. It is a reporting discipline layered
   over a pipeline that is free to drop silently; it is not an invariant the
   artifact cannot violate.
4. **Equality has no cheap form.** Two sets that draw identically have no
   canonical form to compare, so drift detection reaches for pixels and
   geometry boxes.

A recipe fixes (1). A closed IR fixes (2). Receipts-as-schema fixes (3). A
canonical hash fixes (4).

---

## 2 · The canonical envelope

The reviewed artifact. One document, versioned independently of the contract
schema so the legacy schema is untouched during the pivot.

```
RecipeEnvelope
  envelope     literal 1                 — envelope format version
  id, name     stable identity
  archetype    DeclaredArchetype         — reused from @ds-contracts/schema
  recipe       { id, version }           — which recipe compiled this, at which version
  ir           IRNode                    — the drawable tree (§3)
  accounting   { carried: FactRef[] }    — input facts the IR draws
  extensions   CodeOnlyExtension[]       — declared code-only facts (§5)
  receipts     LossReceipt[]             — every input fact the IR does not carry (§5)
  provenance   { source, tool, generatedAt }
  integrity    { algorithm, domain, canonicalHash } — over canonical bytes (§4)
```

Three properties are load-bearing and each is checkable:

- **Closed.** `ir` may only contain IR primitives. A CSS property name cannot
  appear in the envelope's drawable half at all.
- **Total.** Every fact in the recipe's input lands in exactly one of
  `accounting.carried`, `extensions`, or `receipts`. No fourth outcome exists,
  and no fact may land in two — two answers is no answer. The rule runs both
  ways: an account that names a fact the input never carried is a fabricated
  disclosure and fails the same referee.
- **Canonical.** `integrity.canonicalHash` is derived, never authored, and is
  computed over the envelope with `integrity` removed.

Envelope version is a literal, not a range: a reader that does not know a
version refuses rather than best-efforting.

---

## 3 · The primitive Figma IR

The point of the IR is that it is **small and closed**. Every field must
correspond to a named Figma Plugin API assignment; a field with no such
assignment does not enter the IR.

**Node kinds** — seven, deliberately:

| kind            | Figma target                    | what it carries                                                  |
| --------------- | ------------------------------- | ---------------------------------------------------------------- |
| `frame`         | `FrameNode` with auto-layout    | layout axis, alignment, spacing, padding, sizing, clip, children |
| `text`          | `TextNode`                      | characters, type facts, alignment, fill                          |
| `shape`         | `RectangleNode` / `EllipseNode` | size, corner radius, fills, strokes                              |
| `vector`        | `VectorNode` / imported SVG     | asset reference, size, fills                                     |
| `instance`      | `InstanceNode`                  | component reference and property assignments                     |
| `component`     | `ComponentNode`                 | variant properties plus frame auto-layout and children           |
| `component-set` | `ComponentSetNode`              | declared variant axes and component children                     |

**Value vocabularies** — also closed: `Paint` (solid, linear gradient, radial
gradient, image), `Stroke` (weight, alignment, paint, dash pattern), `Effect`
(drop shadow, inner shadow, layer blur, background blur), `Sizing` (`fixed`,
`hug`, `fill`), `Dimension` (a number in device-independent pixels).

**Variable bindings** are a first-class list on each node rather than a value
type, because a bound field has _both_ a literal fallback and a variable
identity and the canvas needs both.

What is deliberately absent: percentages, `calc()`, shorthand, logical
properties, pseudo-elements, media queries, and every other construct with no
Figma primitive. Those are not gaps in the IR — they are the population that
`receipts` exists to name.

---

## 4 · Normalization and canonical hashing

The first normalization slice canonicalizes **JSON representation without
rewriting recipe semantics**:

1. Object keys are sorted recursively by ECMAScript UTF-16 code-unit order.
   The comparison is explicit and never locale-dependent.
2. Arrays retain authored order. That includes children, paints, gradient
   stops, bindings, carried facts, extensions, and receipts: order changes are
   hash-visible until a recipe contract explicitly proves an array unordered.
3. `null`, booleans, strings, and finite numbers are preserved. Strings are not
   Unicode-normalized. Negative zero has one explicit policy: it canonicalizes
   to `0`, matching JSON's single zero representation.
4. `undefined`, sparse arrays, non-finite numbers, bigint, functions, symbols,
   symbol-keyed properties, accessors, non-enumerable properties, cycles, and
   non-plain objects are refused by path. They are never omitted or coerced.
   Plain objects with either `Object.prototype` or a null prototype are
   accepted; repeated non-cyclic references serialize by value.
5. JSON strings are escaped by the canonical encoder (including deterministic
   lone-surrogate escaping), numbers use ECMAScript's locale-free shortest
   round-trippable decimal spelling, and the result is encoded as UTF-8.

`canonicalHash` is SHA-256 over:

```
UTF8("ds-contracts/recipe-envelope-json/v1\0") || canonicalEnvelopeBytes
```

`canonicalEnvelopeBytes` is the canonical JSON above with the top-level
`integrity` field removed. The domain is both included in the hashed bytes and
recorded as `integrity.domain`; a future normalization contract must change the
domain even if it retains SHA-256. An authored or stale hash therefore cannot
influence its replacement.

Normalization is **idempotent** and recursively **key-order-insensitive**.
Meaningful array, scalar, or string changes remain hash-sensitive. These are
tests, not claims. Structural-id assignment, default elision, and any
domain-specific unit lowering belong to recipe compilation; this canonical
JSON layer does not guess them.

---

## 5 · Code-only extensions and mandatory loss receipts

```
CodeOnlyExtension
  id        stable name ("combobox/aria-activedescendant")
  kind      behaviour | a11y | keyboard | virtualization | motion | data
  stated    what it does, in one line
  why       why the canvas cannot carry it
```

```
LossReceipt
  channel   the input fact's name
  path      the structural path it arrived on
  value     the value that was not carried
  reason    no-figma-primitive | code-only | lowered | refused-by-recipe | inert
  evidence  the spec row, door, or lowering rule that justifies the reason
```

**Mandatory** has a precise meaning: the envelope is **invalid** if any input
fact is unaccounted for, and `checkTotality` in `recipe/envelope.ts` is what
says so by name. Loss stops being a report emitted by a cooperating pipeline
and becomes a property of the artifact that a validator can refuse. The five
`reason` values are a closed enum on purpose; a sixth kind of loss requires a
schema change and therefore a review.

`reason: "inert"` is the one that must be watched. It is the only value that
asserts _no visual consequence_, and it may only cite an existing
`spec/channel-table.json` INERT row as evidence.

---

## 6 · The Button vertical slice (Phase 1)

Button is chosen because it is the archetype with the most evidence behind it
and the least structural ambiguity, so a failure in the slice is a failure of
the _architecture_, not of the archetype.

### The exact `button@1` edit surface

The recipe is selected by exact `{ id: "button", version: 1 }`; neither compile
nor collapse infers it from a library name, component name, or tree shape.
Selection is a reviewed human/config input with provenance (`selectedBy`,
`mechanism`, `source`, `reviewedAt`) and a positive `manualCost` measured in
reviewed mappings. Missing selection is `recipe selection is absent`; more than
one candidate is `recipe selection is ambiguous`. This is an explicit manual
configuration cost, not zero-touch inference. `recipe/fixtures/button.ts` is
the canonical instance.

- **Public axes.** `Variant = primary | secondary` (default configurable
  between those values) and `Size = small | medium | large` (default
  configurable between those values).
- **Design-state axis.** `State = default | hover | pressed | focus-visible |
disabled | loading`. Its default is fixed to `default`; disabled and loading
  are explicit variants, not inferred from names or opacity.
- **Presence axis.** `Icons = none | leading | trailing | both`, default
  `none`. The leading and trailing slots are optional instance slots with
  explicit component references.
- **Content.** One required `Label` text value. `loading` inserts the declared
  indicator in the leading position, preserves the label, replaces any leading
  icon, and preserves trailing-icon presence.
- **Token parameters.** For primary and secondary: background, foreground, and
  border tokens for default, hover, pressed, and focus-visible; one shared
  disabled appearance; per-size height, horizontal/vertical padding, gap,
  font size, line height, and icon size; plus radius, border width, font
  family, and font style. Drawable numeric/paint fields carry literal
  fallbacks and named Figma variable bindings.
- **Semantics and non-canvas facts.** The semantic role is the literal
  `button`. Code-only extensions and loss receipts remain envelope sidecars,
  participate in normalization and hashing, and survive collapse unchanged.

Compilation emits the complete 2 × 3 × 6 × 4 = **144-variant** matrix inside a
`component-set`. Every component uses horizontal auto-layout, real padding and
gap, stable recipe roles, a text node, and explicit slot/loading instances.
No fixed-coordinate layout is emitted. Collapse accepts only an explicitly
selected `button@1` envelope, verifies its integrity, axes, full matrix, roles,
auto-layout, and bindings, then recompiles the recovered instance and refuses
the first unsupported structural edit by canonical path.

**Current status.** The offline portion includes compile, envelope validation,
canonical instance/envelope hashes, independent fact accounting, non-empty
receipts, deterministic React/Web Component output, named adversarial
refusals, and a two-cycle compile/collapse fixed point. The same generic
reviewed adapter exercises the Altitude and Fluent Button contracts; only
explicit fixture data names those libraries, and generic
recipe/compiler/emitter code contains no source branch. Each reviewed
configuration now supplies its own canonical parameters instead of
namespacing one generic visual preset. The real-package v1 comparison is
rendered,
provenance-complete, blind graded, and independently adjudicated (§8). Integrity
passed, but recipe React underperformed legacy 0/12 to 9/12 on the exact paired
cells. Corrected v2 evidence subsequently passed offline paired recognisability
12/12 to 7/12 without changing the v1 adjudication. The v4 live mint and its
independent 12/12 canvas grade subsequently complete the Button slice without
rewriting either offline batch.

The slice is complete when all of the following hold on one commit:

1. `recipe.button` compiles a first-party button input to an envelope.
2. The envelope validates: closed IR, total accounting, derived hash.
3. Normalization is idempotent and key-order-insensitive over that envelope.
4. An IR interpreter mints the set on the scratch file and the minted set is
   graded recognisable by the existing census bar.
5. The receipts are non-empty and every row cites real evidence.
6. Recompiling from the same input reproduces the hash byte for byte.

Item 4 is the only step that needs a live canvas, and it is the only step that
needs a human. Items 1, 2, 3, 5, 6 are offline and become the gate.

---

## 7 · The remaining four that decide it (Phase 2)

Each breaks something different. That is the selection criterion; coverage is
not.

| archetype       | what it breaks                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input/Field** | A second control with editable value, placeholder content, label/description composition, disabled/error/focus states, and a code-only change/input event. It tests whether the Button spine generalizes before the hard three. |
| **Combobox**    | One component, **two surfaces** — a trigger and a detached popover listbox — plus an item template that is instantiated, not enumerated. Today's anatomy tree has no way to say "and elsewhere, a floating panel".              |
| **Data Table**  | **Structure the input does not contain.** A table's shape is columns × rows; a capture carries one rendered instance of it. The recipe must emit a header/row/cell template and a declared column axis.                         |
| **Calendar**    | **No archetype exists.** `calendar / date-picker` is absent from `ARCHETYPES` and is in the never-attempted population. It is also the densest grid the pipeline has faced, and almost all of its behaviour is code-only.       |

Calendar therefore requires adding a row to `ARCHETYPES` in
`packages/schema/src/archetype.ts` and a required-facts table beside it.
Widening that enum is a **minor** contract change under the policy in
[26 — Definition of v1](26-v1-definition.md); it is called out here so it is a
reviewed act and not a side effect.

Phase 2 exits when each of the four either compiles to a valid envelope whose
minted set clears the census bar, **or** produces a named refusal that a reader
can act on. A refusal is an acceptable exit. A silent partial mint is not.

---

## 8 · Migration and the legacy adapter

**No bulk migration.** The legacy contract corpus is retained as **regression
research** and reached only through a read-only adapter:

```
legacyAdapter(contract: Contract, reviewedSelection: RecipeSelection): RecipeInput
```

The adapter reads a committed contract plus explicit reviewed mapping and
produces recipe input. It never chooses from component/library names, writes a
contract, edits one in place, or acts as a promotion path. Its job is
population: running every legacy contract through reviewed selections and its
recipe produces a receipt census that says, in one table, which facts the new
architecture drops and why. Selection and mapping cost are reported, not
hidden. That census is the honest answer to "what would migrating cost",
derived instead of estimated.

The legacy engine keeps working, unchanged, for the whole pivot. Nothing in
Phase 0 or Phase 1 alters its behaviour.

### The comparison denominator stays

The benchmark remains all **170 committed contracts** and the **805 real-library
reference renders** under `parity/receipts/v1/census` (the gate recounts both).
Its blind baseline remains **117/170 recognisable**, and the usability baseline
remains **39/170 usable on all four assertions**. Every recipe proof component
must report the recipe and legacy paths under the same recognisability,
round-trip/fact-carriage, and usability measurements. A recipe is never
compared against an empty denominator.

The same independent recount finds **42/170 not-recognisable rows with no named
wall** (`recognisable === false && walls.length === 0`). “42 unwalled” means
exactly that predicate; it is not a synonym for all defects or all wall-free
rows.

The per-archetype legacy context was independently recomputed from
`origin/main@047f66b8e134a6bc173e9336621fc1baf0e37230` before pinning:

| archetype                           |                   set-weighted recognisability | full legacy variants | variant-weighted set verdict context |
| ----------------------------------- | ---------------------------------------------: | -------------------: | -----------------------------------: |
| Button — **easy control**           |                                          12/14 |                  633 |                              617/633 |
| Input/Field — **difficult control** |                                           3/11 |                1,415 |                          1,349/1,415 |
| Select/Combobox — weak stub context |                                            4/4 |                    6 |                                  6/6 |
| Table/Data Grid — weak stub context |                                            5/5 |                   10 |                                10/10 |
| Calendar                            | **legacy comparison: undefined (0 contracts)** |                    0 |                            undefined |

Those columns are context, not one scalar “outperform legacy” target. A set
verdict weighted across all of its variants is explicitly labelled as such; it
is not a per-cell blind grade.

### Matched comparison contract

Before recipe evaluation, each subject pins a legacy baseline over the **same
real-library inputs and exact same sample matrix**. Both paths report three
claims separately:

1. deterministic visual fidelity to the independent real-source references,
   with geometry and pixel/ink kept separate;
2. structural/semantic/usability correctness, including nonzero cells, sample
   completeness, axes, required states/roles, reflow, variant switching, token
   binding, and no fake layout; and
3. final human recognisability, explicitly pending until a designer reviews it.

Only claims 1 and 2 authorize continued engineering, and both must pass without
dropping cells. Neither can mark an archetype successful. Claim 3 remains the
final product bar. Input/Field is the difficult control, not a safe baseline.
Button's already completed blind grades remain historical proof under their
locked protocol; this policy does not reinterpret them.

The old Combobox 4/4 over six variants and Table 5/5 over ten variants remain
published as weak-baseline context only. Before comparison, their legacy
fixtures must be re-derived against the recipe matrix: Combobox includes
closed/open/listbox/highlighted/selected roles and states; Table includes
header/body plus sort/density/selection (or the reviewed final matrix).

Calendar has absolute acceptance only: deterministic visual and structural
gates first authorize engineering, then every sampled variant must be judged
recognisable by a human designer; all four usability assertions pass, the
canonical two-cycle fixed point holds, zero silent facts is measured over a
non-zero denominator, and a held-out first-pass passes.

Anti-flattery is executable: zero axes when the recipe declares axes, zero
cells, missing required states/roles, denominator mismatch, or incomplete
sample coverage is `NOT-COMPARABLE` and can never score 100%.

The earlier automated recognisability comparison used a second, stricter lock.
Before either output was generated, it pinned the source commit, fixture hash,
sample-matrix hash, and every real-library reference-render hash. Legacy and
recipe specimens for every cell were graded **together in one independent blind
batch**:

- randomize/anonymize specimens so the grader cannot know legacy/recipe path,
  implementation, library branch, or expected winner;
- hold protocol version, rubric, pass threshold, crop, scale, browser, fonts,
  and environment hash identical;
- store independent grader identity plus each cell's defects, confidence and
  verdict; and
- resolve arithmetic by immutable output hash, never by the anonymous label.

Builder/emitter code still cannot author final recognisability verdicts.
Historical grades retain their exact meaning, packet, and threshold. They are
not reused for automated progression, and neither failed AI rounds nor
deterministic metrics are relabelled as human recognition evidence.

“Same reference hash” means the **original source's render**, not either
conversion path. For a code-origin subject it is the external owner's real
package/version/component rendered by an independent harness. For a
canvas-origin subject it is Figma's own export of the hand-built source node.
Every cell pins external owner, package/file/node identity, version/revision,
source hash, harness hash, browser/font/environment, cell key, screenshot hash,
and capture command. A recipe, generated contract, emitted React/WC,
`emit-html`, or pivot artifact can never produce a reference. The gate names
`SELF-REFERENCE` when provenance traces to a path under test. Pixel equality
alone is not proof of copying: the real run found an independently mounted
Altitude source cell byte-identical to its legacy rendering. The gate therefore
pins a capture-input lineage hash over package source, reviewed adapter,
harness, environment and cell key.

The existing Altitude and Fluent Button `ref-render.json` files remain
historical census context. Button's pivot comparison does not reuse those
images. `recipe/evidence/button-comparison/receipt.json` independently mounts
`altitude-web-components@1.0.2` and
`@fluentui/react-components@9.74.5`, pins each installed package tree,
registry integrity, sandbox package/lock hashes, reviewed source-adapter hash,
harness hash, Chromium 149.0.7827.55 / revision 1228 and executable hash,
600×800 viewport at DPR 2, font-file/environment hashes, capture command,
per-cell key and PNG hash.

### Button paired measurement protocol — frozen 2026-08-26

The denominator is **12 source cells and 12 cells per compared path**: two
libraries × `Variant = primary | secondary` ×
`State = default | hover | focus-visible`. `Size` is fixed to `medium`,
`Icons` to `none`, and label to `Button`. This is the largest honest shared
matrix: Altitude has no Button size or icon API, its `isDisabled` prop cannot
reach the shipped `:disabled` appearance, and no equivalent loading contract
exists. `small`, `large`, `pressed`, `disabled`, `loading`, and all three icon
presence cells are therefore excluded by name and retained as separate
capability coverage, not counted as paired misses.

The reviewed Altitude adapter maps an absent `variant` attribute—the package's
actual primary default—to `primary`; it no longer relabels `danger` as primary.
`secondary` maps directly. Fluent maps `appearance=primary|secondary`
directly and pins `size=medium`, `shape=rounded`, `iconPosition=before`.
Default is static; hover is a real pointer hover; focus-visible is sentinel
focus followed by keyboard Tab. Recipe selection is manual `button@1`, with
mapping decisions and setup seconds in
`recipe/button-comparison-fixture.ts`. No source adapter is inferred from a
component or library name.

Every cell is rendered four ways under one crop, scale, white background,
browser and font environment:

1. the original real package mounted by the independent source harness;
2. the pinned legacy `core/emit-html.ts` path over the committed contract;
3. the emitted recipe React path; and
4. the emitted recipe Web Component path, for parity only.

The evidence gate verifies 12/12 source references, 12/12 legacy outputs,
12/12 recipe React outputs, 12/12 recipe Web Component outputs, non-zero pixel
cardinality for every pair, API/DOM/ARIA probes, complete source provenance and
immutable artifact hashes.

No recognisability verdict was authored by the implementation path. The
randomized packet is
`recipe/evidence/button-comparison/blind-packet/packet.json`; it contains 24
opaque specimens with no legacy/recipe identifiers or expected winner. Its
answer key is separate at
`recipe/evidence/button-comparison/sealed-answer-key.json`. The completed grades
were unsealed only after packet, grade, key, receipt, image, provenance,
cardinality, ordering, denominator, and non-zero-measurement checks passed. The
deterministic result is
`recipe/evidence/button-comparison/comparison-result.json`; the committed reader
recomputes it and refuses changed grade/key bytes, duplicate or missing
mappings, and impossible aggregate arithmetic.

The exact result is **legacy 9/12 cells and 0/2 complete source-library sets;
recipe React 0/12 cells and 0/2 sets**. A set passes only when all six sampled
cells for that source library pass. Recipe beat legacy on 0 cells, tied pass on
0, tied failure on 3, and lost 9. By library, legacy scored Altitude 5/6 and
Fluent 4/6 versus recipe 0/6 and 0/6. By state, legacy scored default 4/4,
hover 3/4, and focus-visible 2/4 versus recipe 0/4 for each state. Confidence
was 22 high, 2 medium, and 0 low.

Recorded recipe defects are systematic: all 12 failures name geometry and
typography drift; 11 name fill/colour drift; focus/state treatment and borders
also fail. The recipe output reused one generic visual treatment where the two
sources require reviewed token and geometry inputs. The next implementation
task is to correct those acquisition/configuration mappings without adding
library branches to `button@1`, then generate a new sealed batch and obtain a
fresh independent grade. Existing grades are immutable evidence and are not
reused after output bytes change.

### Button v2 correction and adjudication — 2026-08-26

The v1 failure traced to acquisition, not to a need for source branches in
`button@1`. `adaptReviewedButton` cloned the canonical blue/Inter/40px preset
and changed only token namespaces, defaults, and label. It never acquired the
source values:

- **Geometry and typography, 12/12 failures.** Altitude's 16px/24px IBM Plex
  Sans semibold text, 4px radius, and content-hug sizing were replaced by the
  generic 14px/20px Inter treatment and 8px radius. Fluent's 96×32 minimum
  geometry, 12×5 padding, 4px radius, and Segoe/system semibold treatment were
  replaced by a narrower 40px-tall generic button.
- **Fill/colour, 11/12 failures.** Altitude primary/secondary and hover paints
  (`#4375ff`/`#6b93ff`, `#a49981`/`#c0b191`) and their dark inks never entered
  the instance. Fluent's brand/neutral paints and transparent versus light
  border tokens also never entered it.
- **Focus and border treatment.** v1 modelled focus as a state-specific border
  colour. The pinned Altitude source instead has a separated outer ring; the
  pinned Fluent focus cells are visually identical to default. Altitude has
  zero-width ordinary borders while Fluent has a 1px neutral border.

The correction keeps `button@1` generic. Reviewed adapter data supplies
per-source sizing policy, padding/gap, per-size typography, radius, border
width, per-variant/per-state fills/ink/borders, and Figma-representable shadow
effects. Token-backed facts retain source token references. Measured literals
use an explicit `{ kind: "literal", value, receipt }` channel; no shared token
is invented. The generic IR gained only Figma's minimum layout constraints.
Source-only facts remain extensions or named receipts.

Acquisition accounting is now by selected source field. Altitude accounts for
13 non-zero fields (geometry 4, typography 4, fill 2, state 3); Fluent accounts
for 13 (geometry 5, typography 4, fill 2, state 2). The gate plants bad
geometry, typography, fill, and state destinations and requires each to go
red. A separate architecture gate scans generic adapter/compiler/emitter logic
for source identities and constructs a synthetic visual counterexample proving
parameter data—not identity—controls output.

The new evidence directory is
`recipe/evidence/button-comparison-v2/`. It retains the exact v1 sample-matrix
hash, all 12 original-source screenshot hashes, all 12 legacy output hashes,
and the same environment hash. Capture refuses if any pinned byte differs. It
contains 12 corrected React renders, 12 pixel/geometry-equivalent Web Component
renders, and a fresh anonymized 24-specimen packet at
`recipe/evidence/button-comparison-v2/blind-packet/packet.json`; its key is
separate at `recipe/evidence/button-comparison-v2/sealed-answer-key.json`.
The independent grades at
`recipe/evidence/button-comparison-v2/blind-packet/grades.json` were unsealed
only after packet/key separation, opacity, provenance, every image and manifest
hash, cardinality/order, one grade per specimen, required failure defects,
matched denominators, non-zero measurements, and v1 reference/legacy byte
identity passed. The deterministic result is
`recipe/evidence/button-comparison-v2/comparison-result.json`; its committed
reader recomputes the result and plants changed-grade, changed-key, impossible
arithmetic, implementation-guess, missing-defect, zero-measurement,
packet/key-collapse, and immutable-v1-drift failures.

The exact v2 result is **legacy 7/12 cells and 0/2 complete source-library
sets; corrected recipe React 12/12 cells and 2/2 sets**. Recipe beat legacy on
5 cells, tied pass on 7, tied failure on 0, and lost 0. By library, legacy
scored Altitude 3/6 and Fluent 4/6 versus recipe 6/6 for both. By variant,
legacy scored primary 4/6 and secondary 3/6 versus recipe 6/6 for both. By
state, legacy scored default 4/4, hover 3/4, and focus-visible 0/4 versus recipe
4/4 for every state. All 24 grades have high confidence.

The five remaining graded defects all belong to unchanged legacy specimens:
five colour/ink mismatches, three focus/state-treatment mismatches, and one
border/stroke mismatch; no corrected recipe specimen has a recorded defect.
The different unchanged-legacy score between v1 (9/12) and v2 (7/12) is retained
as two independent blind-batch judgments, not rewritten history. The matched v2
decision uses only the v2 pair.

#### Button evidence index

| required Button column                    | result              | exact evidence                                                                                    |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| explicit recipe selection provenance/cost | **pass**            | exact `button@1`; 24 Altitude + 27 Fluent reviewed mappings; no inference                         |
| unrelated adapters / no source branches   | **pass**            | two source contracts; 13 selected facts each; zero source identities in generic logic             |
| offline React paired grade                | **pass**            | corrected recipe 12/12 and 2/2 vs unchanged legacy 7/12 and 0/2                                   |
| Web Component parity                      | **pass**            | 12/12 non-zero React/WC-equivalent cells; recognisability remains ungraded                        |
| live Figma mint                           | **pass**            | 2 sets, 288 variants, 57 variables, 4,296 bindings                                                |
| live usability                            | **pass**            | reflow, switching, binding, and no-fake-layout each 2/2; 288/288 labels                           |
| exact probe restoration                   | **pass**            | 2/2 before/after geometry hashes identical                                                        |
| live readback fixed point                 | **revoked/pending** | historical canonicalization read a self-selected denominator; a scene-derived inverse has not run |
| zero-silent accounting                    | **revoked/pending** | historical `silent=0` was assigned rather than derived from expected-plan multiset reconciliation |
| attributable human live canvas signoff    | **pending**         | 12/12 grade bytes retained, but no reviewer identity/signature/timestamp proves independence      |
| independent original-source references    | **pass**            | 12 external-library source renders; neither path under test supplied a reference                  |
| **overall Button success**                | **false**           | pending attributable human signoff plus fresh scene-derived inversion/accounting                  |

The historical adjudication artifact is
`recipe/evidence/button-live-pivot-v4/final-adjudication.json`. It recomputes
the unsealed mapping and arithmetic and refuses stale grades, changed key or
evidence bytes, duplicate mappings, impossible arithmetic, implementation
guesses, and missing columns within that historical protocol. The superseding
status artifact preserves its hash and revokes its overall PASS rather than
rewriting those bytes.

#### Input/Field offline boundary — adjudicated failure

The difficult second control now has an explicitly selected
`{ id: "input-field", version: 1 }` recipe. Selection remains reviewed config
with positive mapping cost; neither compiler, inverse, adapter, nor emitter
infers from a package, component name, or hand-built Figma tree.

The exact edit surface is:

- variant axes `Size = small | medium`,
  `State = default | focus-visible | error | disabled`,
  `Content = placeholder | value`, `Required = false | true`, and
  `Adornments = none | leading | trailing | both`;
- text properties `Label`, `Placeholder`, `Value`, `Helper text`, and
  `Error text`;
- optional instance-swap properties `Leading adornment` and
  `Trailing adornment`; and
- generic stacked or floating label placement, plain or notched outline
  treatment, field-edge or content-inset helper placement, fixed or
  adornment-additive sizing, fixed or intrinsic-extent adornments, and explicit
  content alignment; and
- per-size label offsets and active/inactive text metrics, input/message
  metrics, helper inset, base width, adornment extents, surface geometry, plus
  per-state border width, fill, ink, and drawable focus effects.

That is a complete **2 × 4 × 2 × 2 × 4 = 128-variant** matrix. Every component
uses a vertical auto-layout field and an in-flow surface/content row,
positive minimum/fixed variant sizing, exactly one placeholder/value role,
label and helper/error text roles, optional adornment instances, and bound
numeric/paint token parameters. Floating fields nest their label and content
rows inside the surface and make notch treatment explicit. The inverse requires exact
`input-field@1` selection and rejects missing or unexpected roles, broken
label/input composition, dead `Size`/`State`, layout mode `none`, dropped
bindings, placeholder/value coexistence, floating labels without named
notch/activation support, stacked labels with floating policy, and every
unsupported structural edit by canonical path. Two complete compile/collapse
cycles are byte-stable for both reviewed source configurations.

The canonical accounting denominator is **15/15 measured**: 8 carried, 6
code-only extensions, and 1 loss receipt. The extensions name explicit-id
label association, `aria-describedby`, `aria-invalid`, native
required/disabled semantics, input/change/focus/blur behavior, and reviewed
recipe selection. All five applicable legacy seeds
(`input/box-grammar`, `input/padding-inline`, `input/type-fact`,
`input/width-rule`, `input/height`) have measured recipe landings. The gate
plants accounting omissions, extension mislabellings, and acquisition defects
in geometry, typography, fill, state, and semantics.

The two reviewed benchmark sources are
`@mui/material@9.2.0` `TextField` and
`@shopify/polaris@13.9.5` `TextField`. Existing pinned sandboxes and capture
configs make both reproducible. MUI `small|medium` and Polaris `slim|medium`
map to the shared two-size boundary; focused/error/disabled, empty/value,
required indicator, and leading/trailing adornment APIs are explicit fixture
data. Each corrected adapter records **109 reviewed mappings**, **101 selected
source facts**, **89 nonzero parameter fields**, setup cost, capture command,
and unsupported cells. The audit plants both omitted and mislabelled facts.

The React and Web Component experiments emit semantic label/input
relationships, required/disabled/invalid state, described helper/error text,
value-versus-placeholder policy, adornments, input/change/focus/blur events,
and CSS that defines every referenced token variable. Emission is
byte-identical across repeated runs.

The paired benchmark matrix was frozen before rendering or grading at **128
source cells total**: two libraries ×
`Size = small | medium` ×
`State = default | focus-visible | error | disabled` ×
`Content = placeholder | value` × `Required = false | true` ×
`Adornments = none | both`. Each source contributes 64 cells; each recipe set
still compiles its complete 128-variant four-adornment edit surface.

The independent source harness mounts `@mui/material@9.2.0` `TextField` and
`@shopify/polaris@13.9.5` `TextField` directly from exact-lock benchmark
sandboxes. The receipt pins package, lock, installed source-tree, adapter,
harness, capture-command, Chromium executable/revision, font, environment,
cell, capture-lineage, and PNG hashes. Under that same crop, scale, background,
font, and browser environment it retains 128 original-source references, 128
legacy outputs, 128 recipe React outputs, and 128 independently hashed recipe
Web Component outputs. No legacy-unsupported cell is omitted; every unsupported
mapping is attached to every affected legacy cell, while denominator claims
remain restricted to the exact frozen matrix.

The packet at
`recipe/evidence/input-field-comparison/blind-packet/packet.json` contains
**128 references and 256 opaque specimens** (128 legacy and 128 recipe React).
Its sealed key is outside the packet at
`recipe/evidence/input-field-comparison/sealed-answer-key.json`. Packet SHA-256
is `6920d34ba3faec0fd03b6bdd8c8efcbb8b8e81f1e86c709e8021da31e83cd61f`.
Recipe Web Component evidence is deliberately outside the blind packet and is
128/128 non-zero, pixel-, geometry-, and semantic-probe-identical to recipe
React.

The independent grader completed all 256 grades with 128 recognisable and 128
not recognisable. The adjudicator verified packet/grade/key separation and
hashes, recomputed the randomized batch hash, required one grade per specimen
and defects for every failure, checked every image and reference hash, enforced
path containment, revalidated all 128 source provenance records and the pinned
environment, and only then unsealed the key. The deterministic result is
`recipe/evidence/input-field-comparison/comparison-result.json`; its committed
reader plants changed grade, changed key, duplicate/missing mapping, wrong-cell
mapping, implementation-guess, missing-defect, and impossible-arithmetic
failures.

The exact cell-weighted result is **legacy 88/128 versus recipe React 40/128**.
Neither path completed either 64-cell source set, so both complete-set scores
are **0/2**. Recipe beat legacy in 40 cells, legacy beat recipe in 88, and there
were zero tied passes or tied failures. The superficially suspicious 128/128
split is therefore not one implementation path passing everything: exactly one
path passed in every paired cell.

By source, MUI is **62/64 legacy versus 2/64 recipe React**; Polaris is
**26/64 legacy versus 38/64 recipe React**. By size, small is 42/64 versus
22/64 and medium is 46/64 versus 18/64. By state, default is 16/32 versus
16/32, focus-visible 32/32 versus 0/32, error 24/32 versus 8/32, and disabled
16/32 versus 16/32. Placeholder content is 48/64 versus 16/64; value content
is 40/64 versus 24/64. Required false and true are each 44/64 versus 20/64.
No-adornment cells are 40/64 versus 24/64; both-adornment cells are 48/64
versus 16/64. Confidence is 166 high and 90 medium, split identically by path
(83 high, 45 medium each); no grade is low confidence.

Recipe React's 88 failures contain 271 defect statements: input
outline/padding/alignment appears in 78 failed cells, field proportions in 76,
label/helper structure or spacing in 71, and border/fill/state treatment in 46.
Legacy's 40 failures contain 158 statements: the first three classes appear in
40, 40, and 38 failed cells respectively, and border/fill/state treatment in
all 40. These are recorded grader defects, not implementation guesses.

The unsealed v1 root-cause artifact at
`recipe/evidence/input-field-comparison-v2/v1-root-cause.json` retains all 88
failed recipe cells and all 271 statements, grouped by source and every exact
matrix axis. The dominant causes were generic rather than source-ID-specific:
the recipe forced stacked labels where the outlined source needed
focus/value/adornment-activated floating and notch structure; it used stale
fixed width and discarded adornment growth; it collapsed state-specific border
and focus mechanics into one border plus one shadow; and it under-acquired
label, input, message, helper-inset, and pinned-viewport typography facts.

The corrected v2 evidence root is
`recipe/evidence/input-field-comparison-v2/`. It refuses generation unless the
128 original-source reference hashes and 128 legacy hashes still match v1,
then renders only corrected React and Web Component outputs. Its packet SHA-256
is `926a249784907d0133611b47b442cdcca7e2531b3efe903891a46b71739fc9af`;
the randomized batch hash is
`c6885a462d0821827b76eedde273db640e7939f48ee44904fdfcf9484d3d5868`.
The packet contains 128 references and 256 opaque specimens, has a separate
sealed key, contains no grades or implementation identity, and remains false
as an immutable pre-grade input. React/WC verification covers 128 nonzero pixel comparisons,
128/128 threshold-0.1 perceptual pixel matches, 128/128 geometry matches, and
128/128 semantic-probe matches; byte-identical PNGs are 76/128 because shadow
DOM overflow capture rasterizes otherwise perceptually identical text at
subpixel offsets. This is recorded rather than mislabeled as byte identity.

The original single-rater adjudication remains immutable historical evidence:
rater A recorded 96/256 recognisable specimens and unsealed to unchanged legacy
0/128 versus corrected recipe React 96/128. It is superseded for progress
decisions by
`recipe/evidence/input-field-comparison-v2/multi-rater-adjudication.json`.

Before reading the key, the multi-rater reader independently validates all three
grade files against the opaque packet. Agreement is 227/256 unanimous and
29/256 two-of-three. Pairwise agreement/kappa is A–B 89.84%/0.794, A–C
98.44%/0.966, and B–C 89.06%/0.777. Overall pairwise agreement is 92.45% and
Fleiss kappa is 0.843. The fixed pre-unseal rule requires every pair at least
75%, Fleiss kappa at least 0.60, all three complete raters, and two concrete
defect records for every majority failure; all four conditions pass.

Only then was the two-of-three consensus mapped. The exact consensus result is
**unchanged legacy 0/128 versus corrected recipe React 95/128**. Complete-set
scores are **0/2 versus 0/2**. Corrected recipe beats legacy in 95 cells, 33
cells tie fail, and there are no tied passes or legacy wins. Legacy has 128
unanimous failures. Recipe React has 92 unanimous passes, 3 majority passes, 7
unanimous failures, and 26 majority failures.

By source, MUI is **0/64 legacy versus 63/64 corrected recipe React** and
Polaris is **0/64 versus 32/64**. Small is 0/64 versus 47/64 and medium is 0/64
versus 48/64. By state, default is 0/32 versus 32/32, focus-visible 0/32 versus
16/32, error 0/32 versus 15/32, and disabled 0/32 versus 32/32. Placeholder,
required false, and adornments none are each 0/64 versus 47/64; value, required
true, and adornments both are each 0/64 versus 48/64.

This within-v2 consensus passes the numerical paired criterion, but it is not
accepted as architecture progress. All 128 reference hashes and all 128 legacy
output hashes are exact across v1 and v2, while 88/128 v1 legacy passes reverse
to failures in both v2 rater A and v2 consensus. Cross-batch agreement is
40/128 (31.25%), Cohen's kappa is 0, and all 88 disagreements run pass-to-fail
(exact two-sided McNemar p = 6.46e-27). Multi-rater consensus establishes
internal v2 reliability; it does not reconcile the changed standard with v1 or
separate that standard change from architecture performance.

The versioned calibration root is
`recipe/evidence/input-field-comparison-calibrated/`. Its reader revalidates
every committed v1/v2 artifact hash, then rereads all 128 reference and 128
unchanged-control image bytes. The source commit, fixture, environment, exact
matrix, per-cell reference hash, and per-cell unchanged-control hash agree
across both rounds. Source-reference provenance is identical for all 128 cells;
all 768 packet image paths are contained regular files.

The calibration protocol was committed before grading. It globally randomizes
**384 opaque tasks**: 128 corrected v2 specimens, 128 unchanged-legacy copy A
specimens, and 128 unchanged-legacy copy B specimens. A/B are byte-identical
for every exact cell, but their task IDs, reference IDs, specimen IDs, paths,
and positions are unrelated; same-cell presentations are never adjacent.
Packet metadata contains neither implementation identity nor duplicate
membership. The sealed key and receipt pin all 128 duplicate proofs outside the
blind rater boundary. The packet SHA-256 is
`f6f245d78c3ef9e8fe6b9fd7e957f660bf69b19f7776f290cf948610f2949dd7`.

The deterministic rubric is applied in this order: structural completeness and
state correctness; geometry/proportions; label/helper/adornments; typography;
then border/fill/focus/error treatment. A specimen passes only when structure
and state match and every later category is either a match or a minor
non-material raster difference. A missing or wrong role/state, or any material
later-category mismatch, fails. Every fail/material category requires a
concrete visible defect.

Acceptance is also predeclared: all three raters complete and valid; at least
95% hidden-copy agreement per rater; identical A/B majority consensus for at
least 127/128 cells, with every mismatch blocking that cell; every rater pair
at least 75% agreement; Fleiss kappa at least 0.60; no rater with more than a
five-percentage-point A/B pass-rate difference; and concrete defects from at
least two raters for every majority failure. If any condition fails,
recognisability remains unusable and live Input/Field work remains blocked.

Only after reliability passes may A/B collapse to one control consensus per
cell. The two identical copies can never double-weight the control. That one
result would then be compared with the other implementation's majority on the
same 128 cells. The v1 single-rater and v2 consensus results remain immutable
history; a threshold-passing calibrated consensus supersedes them only for
progression.

Three complete row sets were submitted: A marked 32/384 recognisable, B 20/384,
and C 8/384. Exact packet order and IDs, unique task IDs, row-level pass rules,
failure defects, category defect coverage, and absence of identity/duplicate
guesses all check. The submissions are nevertheless invalid grade artifacts:
all omit the required `packetHash`, `rubricHash`, `counts`,
`independentBlindGrade`, canonical `rater`, and declared criterion-defect object
shape, while renaming other required fields. The adjudicator preserves and
hashes those bytes; it does not repair them.

The descriptive opaque metrics are 354/384 unanimous and 30/384 split. Pairwise
agreement/Cohen κ is A–B 368/384 (95.83%)/0.671, A–C 360/384
(93.75%)/0.379, and B–C 364/384 (94.79%)/0.264. Overall pairwise agreement is
94.79%, but Fleiss κ is **0.472527**, below the locked 0.60 threshold. In the
separate duplicate-integrity phase, every rater agrees on 128/128 hidden pairs,
each A/B pass-rate delta is zero, majority duplicate agreement is 128/128, and
all 362 majority failures have concrete defect sets from at least two raters.

Reliability therefore fails both the three-valid-rater requirement and Fleiss
κ. The answer-key hash matches its sealed commitment, but the key was not
parsed; consensus, implementation performance, and axis/state aggregates are
null in
`recipe/evidence/input-field-comparison-calibrated/adjudication.json`. The
calibrated round does not resolve 88/128→0/128. Human recognisability remains an
unusable release gate, architecture progression remains blocked, and live work
remains false.

The replacement protocol lives separately at
`recipe/evidence/input-field-comparison-calibration-v2/`. It diagnoses only the
two measurement defects established above: malformed grade envelopes and
divergent materiality standards under high failure prevalence. It does not
reinterpret any submitted row. Aggregate tree commitments protect every prior
Input packet, grade, adjudication, receipt, key, and image: 902 v1 files, 906 v2
files, and 777 first-calibration files remain byte-identical.

Phase 1 is an independent deterministic synthetic GOLD packet at
`recipe/evidence/input-field-comparison-calibration-v2/gold/blind-packet/packet.json`.
Its SHA-256 is
`70dd47851b2a7c19548fb666cb82eafe0be67aaca8e001d4bcac73f10767c022`.
The 24 opaque non-target pairs contain 8 byte-identical/semantically identical
passes, 4 controlled minor raster/color passes, and 12 unambiguous structural
or state failures: blank, missing surface/label/helper/adornments, wrong
focus/error/disabled state, severe clipping, scale, and overlap. The generator
source, deterministic seed, PNG encoder, dimensions, every image hash, and the
balanced 12-pass/12-fail answer distribution are pinned outside the blind
packet. A fresh rater must score at least 95% overall and 12/12 on the obvious
failures. A failed or malformed calibration submission cannot enter Phase 2.
Gold outcomes may be opened only after that rater submits, for feedback before
the separate performance phase.

The rubric is locked as `input-field-observable-rubric-v2`. Required visible
structure/content and semantic state are categorical: a missing/wrong role or
default/focus/error/disabled cue fails regardless of numeric similarity.
Overall width/height is material only beyond both 4 px and 8%; local spacing
beyond both 4 px and 20%; role-defining scale beyond 10%; required-part clipping
above 5% area; and required-part overlap above 2 px fail. A glyph-edge shift up
to 1 px may pass when line count, wrapping, hierarchy, and emphasis do not
change. Color is minor only within both 12 sRGB levels per channel and Euclidean
sRGB distance 20, with unchanged structure, state, hierarchy, and contrast
role. Pixel identity is explicitly not required.

The machine-readable schema is
`recipe/evidence/input-field-comparison-calibration-v2/grade.schema.json`.
Per-rater fillable templates sit inside each blind packet. The required envelope
binds `schemaVersion`, `graderId`, `packetProtocol`, `packetHash`,
`randomizedBatchHash`, `calibrationCommitment`, `rubricVersion`, exact counts,
and ordered grades with five criterion objects. The key-free preflight command
checks exact fields, packet/hash bindings, row order/IDs, pass-rule derivation,
concrete defect rollup, and—during Phase 2—the same-rater passing calibration
receipt.

Phase 2 is a new packet at
`recipe/evidence/input-field-comparison-calibration-v2/performance/blind-packet/packet.json`;
SHA-256
`c24f43a3c769a0b5747bbae93a098bdc762895d39d15326547ce857cc104299e`,
randomized-batch SHA-256
`9dee5601af7077d660b643c6abe9bdff9ef9550dc8193a4d5b82828a18edae42`.
It contains the same 128 source-reference bytes, the same 128 corrected-v2
bytes, and two new opaque presentations of the same 128 unchanged-legacy bytes.
All task/reference/specimen IDs, paths, and order are fresh; hidden A/B are
byte-identical per cell and non-adjacent. The sealed key is new. There are no
performance grades, identities remain sealed, and no performance arithmetic
exists.

The reliability bar is unchanged or stricter: exactly three calibrated valid
raters; calibration at least 95% with 100% on obvious failures; valid envelopes;
at least 95% hidden-copy agreement per rater; at least 127/128 majority
duplicate agreement; every pair at least 75%; Fleiss κ at least 0.60; at most a
five-point duplicate-copy pass-rate delta; and concrete defect support from at
least two raters for every majority failure. Exact duplicate consistency passed
in the refused round; common-standard agreement did not. Until both calibration
and performance reliability pass, recognisability is blocked, recipe
performance is sealed, and live Input is blocked.

Gold qualification under calibration v2 is retained exactly. Rater
`RATER-CAL-V2-A` scored **22/24** overall and **11/12** on obvious failures, so
its valid envelope failed both qualification thresholds. It remains labelled
failed and ineligible. `RATER-CAL-V2-B` and `RATER-CAL-V2-C` each scored
**24/24** and **12/12**, with valid envelopes and passing hash-pinned receipts.
The required three-rater cohort was therefore incomplete, and no performance
access was commissioned.

The versioned replacement commitment lives at
`recipe/evidence/input-field-comparison-calibration-v3-replacement/`. It does
not rebuild or copy either packet. It imports B and C only after verifying each
receipt signature, receipt and submission hash, and exact equality of the gold
packet/hash/order, calibration commitment, rubric hash/version, grade schema
hash/version, ordered-envelope rules, and 95%/12-of-12/valid-envelope
thresholds. Any relevant byte or threshold change invalidates import and
requires B and C to requalify.

A is explicitly excluded from the new B/C/D roster and may not be relabelled.
Fresh rater `RATER-CAL-V3-D` has a new template, submission, and receipt path
but grades the unchanged gold packet under the unchanged scoring contract. D
uses an explicit identity-only overlay because the immutable v2 schema's
roster regex names A/B/C; the overlay requires exactly `RATER-CAL-V3-D` while
leaving the base schema bytes, every scoring field, and every constraint
unchanged. The overlay and its rationale are part of the pre-grade commitment. D
must have no prior packet or grade access, submit a valid envelope, score at
least 95%, and identify all 12 obvious failures before performance access can
be authorized. The performance packet, randomized IDs/order, sealed key,
rubric, and every original reliability threshold remain pinned byte-for-byte to
calibration v2. Those B/C/D output paths remained future-only until D passed;
recognisability, performance identity, and live Input stayed blocked through
that authorization gate.

The final replacement adjudication is
`recipe/evidence/input-field-comparison-calibration-v3-replacement/final-adjudication.json`.
D qualified at **23/24** overall and **12/12** obvious failures. B, C, and D
then submitted strict, preflight-valid 384-row envelopes with respectively
**4**, **14**, and **26** recognisable verdicts. Packet/hash bindings, exact
IDs/order, qualification receipts, defects, pass-rule derivation, source
provenance, and the exact 128-reference/128-corrected/256-control byte
multisets all validate.

Before any performance-key parsing, the adjudicator computed 359/384 unanimous
rows (2 pass, 357 fail) and 25/384 split rows. Pairwise agreement/Cohen κ is
B–C 370/384 (96.35%)/0.2094, B–D 360/384 (93.75%)/0.1853, and C–D 372/384
(96.88%)/0.6851. Overall pairwise agreement is 95.66%, but Fleiss κ is
**0.409255**, below the unchanged 0.60 minimum. All 369 majority failures have
concrete defect sets from at least two raters.

The separate opaque byte-pair phase finds 128/128 agreement for each rater,
zero pass-rate delta for each pair copy, and 128/128 majority-copy agreement.
The duplicate-control majority is descriptively 0/128 pass pairs, again
matching the later historical standard rather than v1's 88/128. That does not
resolve the 88→0 instability: the complete cohort failed its locked reliability
bar, and prevalence is not a permitted post-hoc threshold adjustment. The
sealed key was hash-checked but not parsed. Implementation consensus, MUI/
Polaris and axis/state aggregates, defect classes, set weighting, and the
offline difficult-control verdict are therefore null/not evaluated.

Those B/C/D rows remain refused measurement evidence and may not be repaired or
reused. They also close the path to another equivalent absolute pass/fail
round. The repeated pattern is now measured: all raters were perfectly stable
on hidden copies and raw pairwise agreement was 95.66%, but binary fail
prevalence made chance agreement very high while raters applied different
materiality thresholds. That is a measurement failure, not permission to lower
the locked κ threshold or reinterpret old verdicts.

The replacement instrument is
`recipe/evidence/input-field-paired-comparison-v1/`. It separates two claims:

1. **Relative fidelity:** which opaque candidate is closer to the independent
   original-source reference for the exact same cell.
2. **Absolute recognisability:** a later human/design-review decision plus
   objective structural, state, geometry, clipping, semantic, WC, accounting,
   and usability checks. Relative preference never supplies this verdict.

Its independent GOLD packet is
`recipe/evidence/input-field-paired-comparison-v1/gold/blind-packet/packet.json`,
SHA-256
`4f3418b4a54c5cc683ffc07c7098c282324d931fedd7a50cf5c2bd720b1d1d1b`.
It has 24 deterministic primary pixel cases and 24 side-swapped hidden
presentations: 12 clear-winner primaries, six true ties, and six
materiality-boundary primaries. Clear examples remove or substitute a required
role/state. Boundary examples place one candidate at a locked v2 tolerance and
the other beyond it. Tie examples are pixel-equal or carry equal differences
inside the explicit tie tolerance. Expected outcomes are locked in a separate
sealed key before rater access; target Input outputs are not used in GOLD.

The performance packet is
`recipe/evidence/input-field-paired-comparison-v1/performance/blind-packet/packet.json`,
SHA-256
`e21e8bf9cbcbded15e35a11a08b03a7a68e408c585ac64ac7ef631862e0f90d7`.
It has exactly 128 primary tasks and 128 hidden side-swapped tasks. Every task
shows one exact independent reference and opaque left/right candidates. The
builder rechecks the same 128 reference hashes, unchanged 128 legacy hashes,
and unchanged 128 corrected-recipe hashes from v2, copies each byte set twice,
and gives every presentation unrelated opaque IDs and paths. Candidate order is
randomized per cell and reversed in the hidden presentation. Duplicate rows are
reliability controls only and cannot enter final 128-cell arithmetic.

The observable decision order is fixed: required structure and semantic state;
geometry/proportions; labels, helpers, and adornments; typography; then border,
fill, focus, and error treatment. Overall dimensions use the existing
4 px-plus-8% rule; local spacing 4 px-plus-20%; role scale 10%; clipping 5%;
overlap 2 px; glyph shift 1 px; and color both 12 per-channel and Euclidean 20
sRGB. A rater chooses at the first ranked material difference and must name the
decisive difference plus a concrete defect in the losing candidate. “Both
fail” does not excuse a choice. `tie` is valid only when no ranked category
distinguishes the candidates and residual differences are equivalent within
the narrower tie tolerance recorded in the protocol.

The schema is
`recipe/evidence/input-field-paired-comparison-v1/grade.schema.json`; exact
fillable templates are under each packet's `templates/` directory. The
key-free preflight validates packet/hash/commitment bindings, exact ordered IDs,
`left|right|tie`, confidence, and rationale. GOLD qualification requires three
valid raters, at least 95% each, and every clear winner correct. Performance
then requires at least 95% side-swap consistency per rater, at least 127/128
majority side-swap consistency, every rater pair at least 75% categorical
agreement, Fleiss κ at least 0.60 over the predeclared three classes, and at
least two-rater support for every primary decision. Raw agreement is always
reported beside κ. None of these thresholds may change after grades arrive.

Only after every reliability condition passes may the performance key map
candidates to legacy/recipe. The report then gives recipe wins, legacy wins,
and ties over all 128 primary cells, by source and by every axis. Relative pass
requires recipe wins greater than legacy wins, denominator exactly 128, and the
existing no-source-branch check. It does not mark Input successful or authorize
live work.

That qualification did not pass. All three strict envelopes are retained:
`RATER-PAIR-V1-A` scored **44/48**, `RATER-PAIR-V1-B` **42/48**, and
`RATER-PAIR-V1-C` **41/48**. No rater met the locked 95% threshold; B and C also
missed clear winners. The performance packet and answer key remain sealed and
ungraded. The failed result is not a reason to recruit until three models match
the key. Doing so would select for conformity to this synthetic instrument, not
for truth about the product. The paired protocol, submissions, and receipts
remain failed/qualified historical evidence and are not retroactively
reinterpreted.

The two AI instruments failed for different measured reasons but the same
automation conclusion:

- Absolute pass/fail grades were stable on hidden byte copies yet unstable on
  materiality across cohorts: unchanged legacy moved from 88/128 to 0/128, and
  the calibrated cohorts failed their locked κ thresholds despite high raw
  agreement.
- Paired grading removed the absolute threshold question, but all three raters
  still failed an objective GOLD qualification containing side swaps, clear
  defects, ties, and boundary cases.

AI grading may still be retained as qualitative research. It is not reliable
enough to authorize architecture progression. Final absolute recognisability
is instead an explicit human designer gate.

The replacement deterministic instrument is versioned separately at
`recipe/evidence/input-field-objective-comparison-v1/`. Its protocol was locked
before measurement at SHA-256
`b31c69642a69da054d644a91afa2b5dd6867ffe2eef3ca36fffe0763a93d1a34`.
It uses the exact 128 independent source-reference bytes and both 128-cell v2
candidate sets. The comparator receives only opaque candidate IDs, bytes,
retained dimensions/content boxes, and image-independent probes; recipe/legacy
identity is applied only after the opaque measurement artifact is serialized.
The failed paired performance key was not opened or used. A fresh identity map
comes from the already-known v2 output paths.

Every cell records decoded dimensions, nonzero ink pixels, image and retained
content boxes, signed/absolute dimension deltas, threshold-0 exact and
threshold-0.1 perceptual pixel differences, and normalized ink-count delta.
Alpha is composited over white before comparison; ink is any composited channel
below 250; content boxes are center-padded on a union canvas without resampling.
Pixel/ink error fixes weights at 0.5 exact, 0.4 perceptual, and 0.1 ink delta.
Geometry is a separate equal mean of normalized rendered and retained
content-box width/height deltas. Overall weighted error reports 0.5 geometry and
0.5 pixel/ink, but both constituent gates must independently pass.

The pre-result progression rule requires recipe to win more exact cells on both
geometry and pixel/ink, strictly improve both aggregate errors and the reported
overall weighted error, preserve all 128 cells and every axis/state/role, pass
every DOM/ARIA/WC/accounting assertion, and introduce no catastrophic
structural/state regression. Hidden duplicate, repeated-byte, transparent,
blank, shifted-size, missing-label, wrong-state, copied-reference provenance,
and metric-weight tamper plants all go red. A copied source reference cannot
become a successful candidate even at zero visual error because its provenance
is invalid.

The exact objective result is:

- geometry: recipe **128 wins**, legacy **0**, ties **0**; mean error
  **0.003944321614310101** versus **0.13629572184136426**;
- pixel/ink: recipe **108 wins**, legacy **20**, ties **0**; mean error
  **0.4024965355745618** versus **0.36345476688405753**;
- overall weighted error: recipe **0.20322042859443593** versus legacy
  **0.24987524436271086**;
- structure/semantics: recipe **128/128**, legacy **0/128** under the same exact
  assertions, with zero recipe catastrophic regressions; all DOM/ARIA,
  React/WC, accounting, fixed-point, deterministic-emission, matrix, and
  no-source-branch checks pass.

By library, geometry is 64–0 for both. Pixel/ink is MUI 44–20 and Polaris 64–0.
MUI's recipe aggregate pixel/ink error is 0.286889 versus legacy 0.117464; the
disabled axis is the dominant cross-library regression at 0.749035 versus
0.358427 and splits 16–16. Default is 32–0, focus-visible 32–0, and error 28–4.
Size is 54–10 for both small and medium; placeholder is 52–12, value 56–8,
required false and true are each 54–10, adornments none 52–12, and both 56–8.

The recipe clears cell wins, geometry aggregate, overall weighted error, and
all structural gates, but it fails the separately locked aggregate pixel/ink
criterion. Geometry cannot hide raster/ink error. Deterministic visual fidelity
is **false**, structural/semantic correctness is **true**, and live Input
engineering remains **blocked**. The next implementation correction is the
MUI/disabled-state paint and ink treatment, under a new evidence version.

The third claim remains deliberately unresolved: an independent designer must
decide whether the final corrected outputs are absolutely recognisable as their
original-source Input/Field. Neither deterministic visual fidelity nor
structural correctness marks final Input success. The earlier
`objective-absolute-gate.json` remains a historical pre-measurement artifact and
is not rewritten.

The historical 3/11 set-recognisable result over 1,415 variants remains separate
census context. It spans 11 heterogeneous contracts and capped historical
samples rather than this two-package, 128-cell paired denominator.

##### Input/Field evidence index

| version               | offline implementation | paired blind recognisability                                                       | WC parity                                                 | live Figma                     | accounting                                              | overall Input success |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------ | ------------------------------------------------------- | --------------------- |
| v1                    | pass                   | **fail** — 40/128 < 88/128                                                         | 128/128 byte/pixel/geometry/semantic; parity only         | pending                        | offline pass; live pending                              | **false**             |
| v2                    | pass                   | **blocked** — reliable 95/128 > 0/128 consensus, unresolved unchanged-legacy swing | 128/128 perceptual-pixel/geometry/semantic; parity only   | pending                        | 89/89 fields/source; no loss                            | **false**             |
| calibrated            | unchanged              | **refused pre-unseal** — invalid grade envelopes; Fleiss κ 0.473 < 0.60            | unchanged                                                 | blocked                        | unchanged                                               | **false**             |
| calibration v2        | unchanged              | **incomplete** — A failed 22/24 and 11/12; B/C passed 24/24; performance sealed    | unchanged                                                 | blocked                        | unchanged                                               | **false**             |
| replacement v3        | unchanged              | **refused pre-unseal** — 3 valid envelopes; Fleiss κ 0.409255 < 0.60               | unchanged parity-only                                     | blocked                        | unchanged                                               | **false**             |
| paired v1             | unchanged              | **qualification failed** — 44/48, 42/48, 41/48; performance key remains sealed     | unchanged parity-only                                     | blocked                        | offline pass; live pending                              | **false**             |
| objective v1          | unchanged v2 bytes     | human recognisability pending; deterministic visual gate **failed**                | 128/128 parity; structure 128/128                         | blocked                        | offline pass; live pending                              | **false**             |
| objective v2          | pass                   | human recognisability pending; deterministic offline visual gate **passed**        | 128/128 parity; structure 128/128                         | authorized                     | offline pass; live pending                              | **false**             |
| live v1               | pass                   | 128 source/live pairs retained locally; ungraded and not AI-graded                 | live validation failed; artifacts cleaned                 | **failed**                     | live 14,064/14,064 accounted                            | **false**             |
| live v2               | pass                   | aggregate-better than legacy; adornment content and MUI stratum **failed**         | historical structure/usability metrics retained           | **failed**                     | historical self-referential account is not re-certified | **false**             |
| live v3               | failed                 | attempt 3 retained 128 unscored captures after host normalization failure          | writer/runtime returned; all downstream gates unavailable | **failed**                     | no measured account; v3 permanently exhausted           | **false**             |
| live v4 authorization | offline architecture   | no capture; no objective values                                                    | pinned normalization and transactional journal            | pending parent commit and push | prospective occurrence-preserving account               | **false**             |

Input/Field v1 remains a failed historical result. V2's internally reliable
consensus meets the within-batch arithmetic criterion without a denominator
reduction, but the product verdict is blocked because the unchanged control is
not stable across batches. The later absolute and paired calibration failures
are preserved rather than repaired or rerun. Structural, semantic, accounting,
and WC parity evidence remains separate; WC recognisability is ungraded. The
objective gate authorizes work only when deterministic visual and structural
claims both pass. Objective v2 passes every locked offline progression
criterion and authorized live engineering. Live v1 then used all three capped
writer attempts. The final run minted both 128-variant sets, but failed one MUI
width-reflow assertion, MUI declared-bounds validation (24/128), and the live
canvas objective comparison (geometry 112/128 and pixel/ink 85/128 versus the
legacy comparator). All Input-created Scratch artifacts were therefore
cleaned. Overall Input success remains false and final human designer
recognisability remains pending.

#### Combobox offline technical proof — ungraded, 2026-08-27

The first hard archetype now has an explicitly selected
`{ id: "combobox", version: 1 }` recipe. The selected real-library sources are
the pinned `@mui/material@9.2.0` `Autocomplete` and `antd@5.29.3` `Select`.
Both package APIs and source files were reviewed directly. Both sources support
multiple selection, but `combobox@1` deliberately proves the comparable
single-select slice; multiple/tags are named source refusals rather than a
partially aligned axis.

The exact designer edit surface is six variant properties:
`Size = small | medium`, `Appearance = outlined | filled`,
`Open = false | true`,
`Field state = default | disabled | error | loading`,
`Content = options | empty`, and the nested option component's
`Option state = default | highlighted | selected | disabled`; six text
properties (`Label`, `Placeholder`, `Helper text`, `Error text`, `Empty text`,
`Loading text`); four instance swaps (`Leading control`, `Clear indicator`,
`Popup indicator`, `Selected indicator`); and option instance properties
`Label`, `Value`, and `Disabled`. Root resize is fixed-width, the trigger fills
the root, the overlay matches trigger width, and vertical sizing hugs content.
Unknown structural edits are refused.

Compilation produces a horizontal recipe-library frame containing a 64-variant
combobox set and an eight-variant option set (two sizes × four option states):
**72 components and 242 instances**. Every open variant has a separate
fill-width vertical listbox overlay with explicit absolute positioning,
left/top constraints, `x=0`, and a positive below-trigger offset. Normal open
cells repeat four instances of `combobox@1/option`; they do not flatten options
into unrelated frames. Trigger, overlay, option, typography, radius, spacing,
size, state, and appearance values carry variable bindings and explicit font
provenance.

The inverse runs only after exact reviewed recipe selection. It rejects missing
trigger/listbox/option sets, open/overlay disagreement, broken anchors,
non-instance repetition, dead/unknown axes, selected/highlighted collapse, fake
layout, missing bindings, malformed option data, unknown roles, and hand-built
rectangles. Recompile/collapse holds a canonical two-cycle fixed point for both
adapters. Each reviewed source occurrence is independently accounted to a
shared-IR landing, code extension, or named refusal using a stable occurrence
id; omission, mislabelling, duplicate occurrence, and duplicate-collapse
plants are red.

The paired proof protocol was frozen before results at **12 cells per source,
24 total**. It covers both sizes and appearances; closed and open; default,
disabled, error, and loading field states; options and empty content; all four
option states; label/helper/error; controls; and detached overlay/listbox
roles. Expected full structure is 64 combobox variants, eight option variants,
72 components, 48 repeated option occurrences, and 242 instances. A zero-axis
closed stub cannot enter the protocol.

Generated React and Web Component proofs implement editable query, single
selection, open/close, disabled-option skipping, ArrowUp/ArrowDown/Enter/Escape,
`aria-expanded`, `aria-controls`, `aria-activedescendant`, label/helper/error
relationships, focus retention, stable input nodes/carets, and safe
text/CSS/token handling. This is a bounded proof widget, not a production
widget library.

No source reference was rendered or graded, no Figma/MCP call occurred, and no
live artifact exists. The old 4/4 recognisable legacy census result over only
six variants is retained verbatim as weak context, not accepted as the target.
Combobox overall success remains **false/ungraded/no-live**. The next handoff
is a separately authorized matched benchmark that renders both source
references and re-derives a legacy comparator over the frozen 24-cell matrix.

#### Pivot progress

| archetype   | progress                                                                                                                                                        | next evidence boundary                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Button      | **technical mint retained; overall false/pending**                                                                                                              | scene-derived inversion/accounting, then attributable human signoff (human gate)                 |
| Input/Field | **offline objective passed; live v1/v2 failed; v3 exhausted; v7 attempt 1, v8 attempts 1-2, v9 attempts 1-2, v10 attempts 1-2, v11 attempt 1, v12 attempt 1, v13 attempt 1, v14 attempt 1, v15 attempt 1, v16 attempt 1, v17 attempt 1, v18 attempt 1, v19 attempt 1, v20 attempt 1, v21 attempt 1, v22 attempt 1, v23 attempt 1, v24 attempt 1, v25 attempt 1, v26 attempt 1, v27 attempt 1, v28 attempt 1, v29 attempt 1, v30 attempt 1, v31 attempt 1, v32 attempt 1, v33 attempt 1, v34 attempt 1, v35 attempt 1, v36 attempt 1, v37 attempt 1, v38 attempt 1, v39 attempt 1, v40 attempt 1, v41 attempt 1, v42 attempt 1, v43 attempt 1, v44 attempt 1, v45 attempt 1, v46 attempt 1, v47 attempt 1, v48 attempt 1, v49 attempt 1, v50 attempt 1, and v51 attempt 1 failed closed; v56 attempt 1 failed closed, v57 attempt 1 failed closed, v58 attempt 1 failed closed, v59 attempt 1 failed closed, v60 attempt 1 failed closed, v61 attempt 1 failed closed, v62 attempt 1 failed closed, and v63 attempt 1 failed closed; v64 attempt 1 failed closed; v65 attempt 1 failed closed; v66 attempt 1 failed closed; v67 attempt 1 failed closed; v68 attempt 1 failed closed; v69 attempt 1 failed closed; v70 attempt 1 failed closed; false** | Polar pixel/spread value drift remains; do not invent 9/30/spread 0; do not PREPARE V71 for fill (see Remaining work §A) |
| Combobox    | **offline technical proof passes; false/ungraded/no-live**                                                                                                      | matched 24-cell benchmark, Scratch-only live, then human grade (see Remaining work §C)           |
| Data Table  | not claimed                                                                                                                                                     | human-reviewed adapters, offline cross-library proof, then Scratch-only live                     |
| Calendar    | not claimed                                                                                                                                                     | reviewed archetype addition, then the same offline-then-live sequence                            |

### First page-scoped live writer run — blocked, 2026-08-26

The Desktop Bridge read-only preflight passed against the only writable target:
file `byMp6lt0Ij9b2QbkDGFwBh`, name `Scratch Project`, editor `figma`. The
dedicated page identity was
`Recipe Pivot / Button / ae57b16a-5c52de74`; it did not exist before the run.
The writer plan contained both unrelated reviewed source adapters, 144 declared
and planned cells per source, and 3,978 primitive-IR facts per set.

The maximum three live writer attempts were used:

1. Figma refused the hyphenated shared-plugin-data namespace.
2. The raw Desktop Bridge API refused the `use_figma`-only
   `createAutoLayout` convenience.
3. `createVariable` refused the source token identity as a Figma variable
   name.

No fourth attempt was made and no node was hand-edited. Cleanup removed only
the task-created pages, tagged sections, variable collections, and one orphan
component created before the third refusal. A final read proved that the proof
page is absent and zero run-matching variable collections remain. The corrected
offline writer now creates generated Figma-safe variable names while preserving
the source token identity in shared plugin data, but is explicitly recorded as
**not executed**.

The fail-closed receipt is
`recipe/evidence/button-live-pivot/receipt.json`; its exact writer, plan, capped
attempt log, cleanup IDs, source/envelope hashes, zero-denominator live
verdicts, and future independent grading task are checked by
`recipe:live-receipt:check` and adversarially falsified by
`recipe:live-receipt:self-test`. No screenshots or blind canvas packet exist:
without live specimens, creating or grading one would substitute offline output
for the claimed live path. Button therefore remains **false**.

The pinned legacy eval record is also red: **227/230**, failing
`astryx-reanchor-minted`, `minted-leaves-bind-to-something`, and
`console-loop-canvas-drift-probe`. Named reds do not make the full lane green.

### Versioned live writer repair — blocked before execution, 2026-08-26

The v1 receipt and writer bytes remain immutable. V2 lives separately under
`recipe/evidence/button-live-pivot-v2/` and pins
`@figma/plugin-typings@1.135.0`. Its offline conformance gate parses the writer
and typings, inventories 17 Plugin API calls and 72 writable properties, and
executes a live-convention mock over all 288 variants. The mock observed 57
variables, 6,427 plugin-data writes, 11,087 property writes, and 4,296
bindings. Planted versions of all three historical defects go red before live
execution.

The generic repair uses `ds.contracts.recipe.v2`, creates supported scene nodes
and enables auto-layout through `layoutMode` and related properties, and maps
tokens to deterministic `token/<type>/<sanitized-identity>` names. A reverse
map rejects collisions before page creation; original token identities remain
in shared plugin data. Two regenerations produced writer SHA-256
`336dbf2a0124fbd154c2dcde4013dca0db11a014f09417e83d5950cf181b686f`.

The Desktop Bridge read-only probe again passed against only
`byMp6lt0Ij9b2QbkDGFwBh` (`Scratch Project`). Before state was 12 pages, 170
top-level nodes, 12 local variable collections, and 11,106 local variables,
with no v2 proof page or matching collection. The exact-writer in-memory
transport then failed its pre-execution fingerprint
(`68686350` expected, `c32753a0` observed). The writer was not evaluated, so
this consumed zero writer attempts and created no page, node, collection, or
variable. Temporary transport globals were cleared; after state matched the
same six counts exactly. No screenshot, probe, readback, fixed point, packet,
or visual grade exists, and Button remains **false**. The fail-closed v2
receipt is `recipe/evidence/button-live-pivot-v2/receipt.json`.

### Exact-byte v3 execution — live usability failure, 2026-08-26

V3 preserves both earlier receipts and replaces manual runtime reserialization
with `ds-contracts/figma-writer-utf8-base64/v1`. The generated envelope carries
the exact on-disk UTF-8 bytes, byte length, and SHA-256. The plugin validates
base64 grammar, decoded length, SHA-256, and strict UTF-8 before evaluation.
Deterministic JavaScript SHA-256 and UTF-8 fallbacks cover the Desktop plugin
sandbox, where `TextDecoder` was unavailable on attempt 1. Attempt 2 decoded
32,146 bytes and matched writer SHA-256
`336dbf2a0124fbd154c2dcde4013dca0db11a014f09417e83d5950cf181b686f`
before both `evalBegan` and `evalCompleted` became true.

The writer created exactly two sets with 144 variants each and 57 total local
variables. Live readback compared 7,956 planned IR facts, observed 10,368
normalized facts, and produced the same canonical SHA-256
`ceddaec224130655fda8066653f4c1ae0766fb13b7dc267d3888d047cfad689e`
after each of two complete cycles. Variant switching, token binding,
non-absolute auto-layout, and restoration passed for both representative
instances. The Altitude long-label specimen expanded from 83px to 314px; the
Fluent specimen remained 96px, so reflow passed only 1/2. Representative PNG
bytes were retained as evidence without a visual grade.

Because a nonzero usability denominator remained red, Button remains
**false**. The task-created page plus both task-created variable collections
were removed. The after census returned exactly to 12 pages, 170 top-level
nodes, 12 local collections, 11,106 local variables, and zero matching proof
artifacts. The v3 receipt and tamper reader live under
`recipe/evidence/button-live-pivot-v3/receipt.json` and
`recipe/live-receipt-v3.ts`.

### Versioned v4 writer — complete live Button proof, 2026-08-26

V3's 96px Fluent result was not evidence that the source intended a fixed
button. The recipe still declared HUG with a 96px minimum. The retained live
diagnostic found the actual failure below that root: the selected SF Pro
Semibold fallback loaded successfully but produced `characters="Button"`,
height 15px, and width **0px**. With clipping enabled, there was no responsive
horizontal label geometry and no visible exported label.

V4 fixes this in shared recipe/writer vocabulary, not with a Fluent branch.
Button now declares HUG source sizing plus a centered label response to a
designer fixed-width resize. The writer tests each ordered font-stack
candidate against positive rendered text geometry and refuses if every
candidate is empty; it records the selected family/style for readback. Fluent
advanced deterministically to Roboto SemiBold. Planted HUG snap-back, frozen
label, empty/invisible label, wrong alignment, and incomplete restoration all
go red offline.

The exact-byte v4 transport decoded and hashed 33,977 writer bytes
(`2cab582e5b9a7329ec6e316d9981dc13e74532ed9b4b6bd64afff56408547cd8`).
Its conformance run minted 288 planned variants, 57 variables, 7,003
plugin-data writes, and 4,296 bindings. Attempt 1 refused the measured
zero-width label and cleaned only its page and two partial collections;
attempt 2 completed. The retained proof is page `85:6781`, with Altitude set
`85:7406`, Fluent set `85:8054`, live proof section `85:8089`, and paired-cell
section `85:8090`. No pre-existing node changed.

Both sources passed all four usability assertions. A designer resize was
modeled as Figma does it: the instance changes from HUG/AUTO to a fixed primary
axis, grows by 64px, and must move the centered label by 32px. Altitude grew
83→147px and Fluent 96→160px; both restored byte-identical geometry hashes.
Variant switching, nonzero token bindings, and 600/600 in-flow auto-layout
children also passed. All 288 labels had nonempty text, a loaded font, visible
fill, and positive dimensions. Live readback compared 7,956 planned facts,
observed 13,248 facts with zero silent loss, and produced the same canonical
SHA-256
`e450fb2bfd2380abb1376c9cc5bd9c6d0860fd11afb7e66803d14bf7c5aa81bd`
for two complete cycles.

The proof retains 12 exact live cells (two sources × two variants × three
states), both whole-set exports, and a fresh anonymized packet at
`recipe/evidence/button-live-pivot-v4/blind-packet/packet.json`. The immutable
pre-grade packet and receipt remain sealed/ungraded and false as historical
inputs; the builder authored no recognisability verdict. The independent grade
passed all 12 specimens with high confidence and no defects or implementation
guesses.

The final adjudicator validated packet/grade/key separation and hashes, unique
mapping, 24 non-zero images, original-source provenance, exact writer transport,
Scratch file/page/set IDs, all screenshot bytes, both usability probes and
restoration hashes, two-cycle canonical stability, 13,248/13,248 accounted
facts with zero silent loss, and every preceding offline/live column before
unsealing. It then aggregated 6/6 per library, 6/6 per variant, 4/4 per state,
and 12 high-confidence grades. The historical artifact is
`recipe/evidence/button-live-pivot-v4/final-adjudication.json`; its reader
plants stale-grade, changed-key, duplicate-mapping, impossible
arithmetic, implementation-guess, required-field, provenance, and
missing-column failures within that superseded protocol. Its grader bytes carry
no attributable reviewer identity/signature/timestamp, and its readback did not
invert actual scene properties. Current Button success is therefore
**false/pending** until a future scene-derived run passes and an attributable
human signs off.

This proves one Button archetype over the two unrelated Altitude and Fluent
libraries on the one fixed `medium` / `none`-icons, primary/secondary ×
default/hover/focus-visible matched slice. It does not establish Input/Field,
Combobox, Data Table, Calendar, another library, or excluded Button states,
sizes, and icon-presence cells. The next task is Input/Field recipe design as
the difficult control, starting offline and reusing the proven protocol.

### Input/Field live v1 — failed and cleaned, 2026-08-27

The Desktop Bridge preflight matched only writable file
`byMp6lt0Ij9b2QbkDGFwBh`, `Scratch Project`, editor `figma`. The isolated
`input-field@1` primitive-IR writer planned two sets, 256 variants, 158 local
variables, 18,553 plugin-data writes, and 8,704 bindings. Its final exact-byte
transport verified and decoded 1,694,457 UTF-8 bytes with SHA-256
`15077af39a6ebd0930d00bf99b80c23b83a1b8e02d5318ffa8bd81c3c7fbae3a`.
The three capped attempts were a plugin-data-entry-size refusal, a complete
mint that failed live validation, and a source-fixed complete mint that still
failed final validation. Each failure was followed by Input-only cleanup. The
last temporary page was `86:16021`, with sets `86:17454` and `86:18755`, proof
section `86:18756`, and paired section `86:18757`.

Both sets switched through all 128 variants, retained nonzero bindings, used
only in-flow auto-layout children, and restored exact before/after probe hashes.
Polaris passed width reflow; MUI's surface widened 195→259px but its inactive
content width remained 118px, so the required fill-response assertion failed.
All 256 variants had nonzero role structure, labels, content, messages, and
state ink. Polaris passed declared bounds 128/128; MUI passed only 24/128. Both
readbacks collapsed through `input-field@1` for two stable cycles with exact
source recipe and envelope hashes. Live accounting classified
14,064/14,064 observed facts as carried, with zero silent omissions.

All 128 locked paired cells were captured against the unchanged independent
references and measured with the locked objective comparator. Live beat legacy
on geometry in 112/128 cells and pixel/ink in 85/128, with mean errors
0.013402 geometry, 0.343458 pixel/ink, and 0.178430 overall. These are complete,
non-sampled measurements but do not satisfy the required all-cell live proof.
All Input-created Scratch artifacts and both variable collections were removed
after the failure. Existing census and Button proof nodes were not targeted.
The ungraded human packet is retained locally at
`recipe/evidence/input-field-live-pivot-v1/human-review-packet.json`; no review
was requested and no AI recognisability verdict was authored. The evidence
index is `recipe/evidence/input-field-live-pivot-v1/index.json`. Input remains
false.

### Input/Field live v2 — structural repair passed, raster failed, cleaned, 2026-08-27

V2 preserved every v1 artifact byte-for-byte. Per-cell diagnosis showed that
all 16 geometry losses were MUI medium/both-adornment cells; all 43 v1
pixel/ink losses were MUI (30 both-adornment and 13 no-adornment cells); and the
104 MUI bounds failures were distributed evenly across size and required axes.
The apparent MUI reflow defect was narrowed with live scene measurements: the
actual content row grew 165→229px while the TEXT property leaf remained its
intrinsic 118px, a Figma component-text-property behavior. The v1 probe had
measured the glyph leaf rather than the editable content region.

The generic primitive IR now declares overlay positioning, offset, and
constraints. Only nodes carrying that primitive lower to Figma
`layoutPositioning="ABSOLUTE"`; these declared overlays are not classified as
fake layout. Attempt 1 refused because Figma does not permit variable bindings
on `x`/`y`; it was cleaned. Attempt 2 represented the 256 offset bindings
honestly as code-only facts, minted two 128-variant sets, and passed both reflow
probes, 256/256 switching, both binding probes, both no-fake-layout checks,
exact restoration, all 256 role/state/bounds/overlap checks, and two stable
inverse cycles with unchanged source recipe hashes. Accounting remained
14,064/14,064: 13,808 carried, 256 code-only, zero refused, zero silent.

The temporary v2 page was `86:22579`; sets were `86:24012` and `86:25313`;
final proof and paired sections were `86:30316` and `86:30317`. Exact attempt-2
transport decoded 1,709,077 bytes with SHA-256
`05481c74cb445a6fb55375260b65ee15cde893d19eadeed002e386776962df55`.
All 128 cells were captured unsampled. Against the unchanged comparator, live
still won geometry in 112/128 and pixel/ink in 87/128; mean errors were
0.013402252, 0.343523599, and 0.178462925. V1→v2 therefore changed pixel/ink
85→87 but did not meet the locked all-cell objective. The unused third attempt
was not spent on an unmeasured raster guess.

The page and both variable collections were removed after failure. The ungraded
packet remains at
`recipe/evidence/input-field-live-pivot-v2/human-review-packet.json`; no review
was requested and no AI grade was authored. Input remains false.

The v2 structure/usability numbers and aggregate improvement remain historical
measurements, but its fixed-point and zero-silent labels are not re-certified:
the verifier read stamped original IR and assigned the remainder carried.
Visual inspection also found incorrect adornment payload and a regressing MUI
pixel/ink stratum. V2 therefore remains failed under both the old recorded rule
and the prospective v3 safeguards.

### Prospective Input live v3 criterion and two-commit authorization

Commit `be6b01300ad99d8a29ea4c11508d192dec84bbea` records
`recipe/evidence/input-field-live-pivot-v3/protocol.json` before any new
capture. The exact committed Git-object bytes have SHA-256
`f4decf46da7cd3870e247d5304d632028356580e58ce68bedcb7acb7c0e31a23`.
The protocol's retained draft status bytes are not rewritten: the commit around
them is the externally visible antecedent, while a second commit must add
`recipe/evidence/input-field-live-pivot-v3/capture-authorization.json`.
The authorization commit is discovered, never embedded, as the unique first
addition returned by
`git log --reverse --diff-filter=A --format=%H -- recipe/evidence/input-field-live-pivot-v3/capture-authorization.json`.
It must strictly descend from the antecedent. A capture `codeCommit` must equal
that authorization commit or be a clean descendant containing identical
authorization and protocol bytes.

The authorization artifact was first added by
`ad7e02d3bfaf79f757ff63085c0a24a64a5c4c7b`. The typed runner/verifier
scaffolding is now prepared-uncommitted and capture has not run. After that
scaffolding is committed from a clean tree, both
`npm run recipe:input-field:live:v3:authorization:check -- --capture-code-commit HEAD`
and the v3 preflight must pass before the separately handed-off runner may
target Figma file key `byMp6lt0Ij9b2QbkDGFwBh`. A later receipt must record the
antecedent, discovered authorization, and capture code commits and must itself
descend from the authorization commit. No receipt or observed capture data
exists now.

The hash changed only because correction-task implementation dependency hashes
were added; criterion semantics and thresholds below did not change.

The hard 128-cell gate covers structure, semantics, all-axis switching, typed
bindings, restoration, actual adornment content, state treatment, no clipping,
no overlap, scene-derived inversion, and occurrence-preserving expected-plan
accounting. Missing, extra, mismatched, duplicate-collapsed, or unobserved facts
fail; `silent=0` is derived. Existing thresholds remain 4px+8% dimensions,
4px+20% spacing, 10% role scale, 5% clipping, and 2px overlap.

Visual acceptance is relative: recipe wins must exceed legacy losses; aggregate
geometry and perceptual/ink error must improve overall; and no source, state, or
adornment stratum may materially regress. Exact pixel difference is diagnostic
only. Attributable human signoff is mandatory.

### Input live v3 exhaustion and v4 pending authorization

Attempt 3 used the final v3 slot from clean committed descendant
`6903d31eb015933a6796722d25f6155fb13332ce`. Exact-byte transport decoded
2,453,320 bytes with SHA-256
`c88ffc740fb91448fa37685b0a832fc7420e0e34f5838352af75c8f617abc2bc`.
The writer and portable readback runtime returned and 128 PNGs were persisted.
The host then failed at `recipe/scene-readback.ts:982`: node `boundVariables`
reported `fills`, `fontSize`, and `lineHeight` as alias arrays, producing
`fills.0`, `fontSize.0`, and `lineHeight.0`, while `letterSpacing` was the
typed `{unit,value}` object specified by `@figma/plugin-typings@1.135.0`.
The old host projection expected canonical paint/text paths and a scalar
letter-spacing number.

That failure occurred before occurrence accounting. Scene facts measured,
missing/extra/mismatch/duplicate counts, fixed-point cycles, usability,
restoration, and objective rows are therefore unavailable—not zero. The 128
captures are unscored hard-failure evidence. The runner persisted neither its
writer result nor cleanup result before normalization, so exact attempt IDs are
unavailable. Ownership verification nevertheless found zero owned pages and
collections after cleanup and the unrelated Scratch fingerprint remained
exactly `10ba6b57da3cfa97`.

The v4 draft retains every v3 product criterion and threshold but replaces the
proof plumbing. Raw scene data is paired with an independently captured local
variable table. A generic host normalizer handles direct aliases, paint alias
arrays, paint-level aliases, text scalar aliases, missing values, MIXED
refusals, and typed PIXELS/PERCENT/AUTO unit objects. Variable IDs are used only
to join that captured table; canonical identity comes from the local collection
name, variable name, and resolved type. Unknown shapes, stale IDs, duplicate
aliases, incompatible types, ambiguous arrays, and partial mixed ranges fail by
name.

Every phase writes an atomic deterministic hash-chained artifact immediately
after return: preflight; writer IDs/counts; raw scene plus variable table; host
normalization; accounting and fixed point; usability and restoration; captures
and objective; retention and cleanup. Recovery cleanup reads exact page, set,
section, collection, and node IDs from the persisted writer phase. Capture is
unreachable until accounting, fixed point, usability, restoration,
clipping/overlap, adornment content, and state gates all pass.

The v4 protocol/architecture antecedent is committed and published at
`25b820868104be65194f83e154f59b70aacf2bae`. Its committed protocol bytes have
SHA-256
`e65584d1d52178cd80dddbe42458a58b0a1ade4f24e41fb53fa4b9cdb97105d6`;
the runner, generic normalizer, transactional journal, verifier, writer,
evidence reader, and normalization fixtures are separately pinned by hashes in
`capture-authorization.json`. The full v3 evidence Git tree remains
`705fbd0c5be0f66a8945bd9a7bde89b99d02b106`, so no v3 byte is reused or
rewritten.

The separate v4 authorization artifact is prepared with SHA-256
`6c0c4d772280af24b9387193a5b7723ebfff73eff9e66a89eec9d22ebd4f258b`
but is **pending-uncommitted authorization**. It embeds no authorization commit;
the verifier discovers the unique first commit that adds the artifact, requires
that commit to strictly descend from the antecedent, and requires future
`codeCommit` to equal or descend from both. A clean worktree and exact upstream
equality are mandatory, so the current uncommitted artifact authorizes nothing.

The pinned protocol permits at most three future attempts, each from a clean
published descendant, and targets only Scratch file key
`byMp6lt0Ij9b2QbkDGFwBh` with page-scoped ownership. No source/library file is
writable, no live execution has occurred, no target values are added, and
attributable human signoff remains pending. Attempt 1 may be handed off only
after the parent commits and pushes this layer and both authorization and
preflight verifiers pass; capture remains ordered after every transactional,
normalization, scene-derived, fixed-point, usability, restoration, content,
state, font, clipping, and overlap gate.

### Browser↔Figma raster calibration v1 — held-out rejection, cleaned, 2026-08-27

The historical record says a separate canonical primitive corpus was locked
before Input v3 tuning; the current uncommitted tree cannot prove that
chronology:
24 generic specimens split before measurement into 16 training and 8 held-out
validation cases. It covers Inter and Roboto text families, regular and medium
styles, multiple sizes and line heights, fixed/fill/hug horizontal layout,
paired adornment instances, asymmetric gaps and padding, 1px strokes, radii,
fills and opacity, floating-label overlays/notches, focus/error-like treatment,
and small/medium dimensions. The corpus contains no source, component, or Input
cell identity and has canonical SHA-256
`daeac5691a14cbfd494fb0fb21d5c105d55f1dc257a76bfe42bce425dce28660`.

Pinned Chromium rendered the original IR at DPR 2 on white using the repository
font bytes. The exact-byte Scratch writer rendered that same IR through Plugin
API nodes and exported each frame twice. Training alone derived a 0.9958043981
font-size scale, 1.0 line-height scale, +0.0075472608px letter-spacing offset,
and symmetric 64-level RGB capture normalization. Writer compensation and
capture normalization are separate explicit configuration channels; neither
changes source structure. Browser duplicate captures and both Figma duplicate
exports were byte-identical, all captures were nonzero, and live structural
projections remained unchanged.

The recorded held-out result failed: mean geometry improved
0.110400399→0.110141293, but pixel/ink regressed
0.183872422→0.186577771. Training also failed aggregate improvement
(geometry 0.065204045→0.065319097; pixel/ink
0.147285020→0.150935213). There were no catastrophic held-out regressions and
all structural facts remained unchanged, but both aggregate metrics were
required to improve. The calibration is therefore rejected. It is not consumed
by Input, no Input target output changed, and Input v3 is not authorized.

The temporary Scratch page `86:34349` and its baseline/calibrated sections were
removed. Exact pre/post Scratch state matched, no variable collection was
created, and immutable Input live v1/v2 evidence hashes matched before/after.
The attempt history retains the namespace refusal, stale-page cleanup recovery,
and projection-receipt correction. The evidence index is
`recipe/evidence/raster-calibration-v1/index.json`.

The recipe inverse is additive. The existing recipe-agnostic
`--phase design-to-code` / first-pass fixtures run before and after a recipe
proof. Recipe collapse requires an explicit reviewed selection; an unmatched
hand-built canvas remains a reviewable general proposal and is never silently
forced into `button@1`.

---

## 9 · Module boundaries

Phase 0 establishes the shape below. Everything under `recipe/` is
**experimental** and is not exported from any published package until a gate
says otherwise.

| path                                        | phase | role                                                                                                  |
| ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `recipe/figma-ir.ts`                        | **0** | the primitive IR — types and schema. No CSS names.                                                    |
| `recipe/envelope.ts`                        | **0** | the canonical envelope, extensions, receipts. Totality rule.                                          |
| `recipe/index.ts`                           | **0** | the experimental surface, re-exported in one place.                                                   |
| `recipe/normalize.ts`                       | **0** | strict canonical JSON normalization and UTF-8 bytes.                                                  |
| `recipe/hash.ts`                            | **0** | domain-separated SHA-256 over the unsigned envelope.                                                  |
| `recipe/recipe.ts`                          | **1** | the implemented `Recipe` interface, registry, and refusal type.                                       |
| `recipe/recipes/button.ts`                  | **1** | implemented `button@1` compile + inverse validation/collapse.                                         |
| `recipe/adapters/button.ts`                 | **1** | priced reviewed acquisition for unrelated Button inputs.                                              |
| `recipe/output/button.ts`                   | **1** | deterministic React and Web Component output from `button@1`.                                         |
| `recipe/recipes/input-field.ts`             | **2** | implemented offline `input-field@1` compile + inverse validation/collapse; no live claim.             |
| `recipe/adapters/input-field.ts`            | **2** | priced reviewed acquisition shared by the two future real-source benchmark targets.                   |
| `recipe/output/input-field.ts`              | **2** | deterministic semantic React and Web Component output from `input-field@1`.                           |
| `recipe/accounting.ts`                      | **1** | independent fact/landing recomputation; emitter claims ignored.                                       |
| `recipe/comparison.ts`                      | **1** | matched-denominator scoring and anti-flattery refusals.                                               |
| `recipe/interpret.ts`                       | **1** | page-scoped primitive IR → Figma writer plan and exact-byte Plugin API script; v4 live proof retained |
| `recipe/raster-calibration.ts`              | **2** | versioned source-neutral corpus, locked metric, bounded derivation, and held-out rejection gate.      |
| `recipe/raster-calibration-browser.ts`      | **2** | pinned browser rendering of the canonical calibration IR.                                             |
| `recipe/raster-calibration-figma-writer.ts` | **2** | explicit-config Figma rendering of the same calibration IR.                                           |
| `recipe/raster-calibration-receipt.ts`      | **2** | deterministic evidence, cleanup, immutable-history, and tamper verification.                          |
| `recipe/legacy-adapter.ts`                  | 3     | read-only `Contract` → `RecipeInput`.                                                                 |
| `recipe/recipes/*.ts`                       | 2     | combobox, data table, calendar.                                                                       |

### Keep / rewrite / retire

**Keep and evolve/reuse; do not discard wholesale.**
`packages/schema/src/*` (the legacy contract schema and the archetype
vocabulary), `packages/core/src/required-facts.ts` (the referee and seed of the
recipe registry — Button maps its three required and two expected facts to
measured IR landings), `packages/core/src/tokens.ts`,
`spec/channel-table.json` and `spec/lowering.json` (they become the evidence
`receipts` cites), the census and first-pass harnesses, every CI lane.

**Rewrite, behind `recipe/`.** Structure decisions currently inside
`core/emit-figma-script.ts` move to recipes; the Figma-API half moves to
`recipe/interpret.ts` as a bounded interpreter over a closed vocabulary. The
original file is not edited during the pivot.

**Retire, only after its replacement is green.** Nothing is deleted in Phase 0.
The candidates are the ad-hoc structural inference in the propose path and the
per-surface loss reporting that `receipts` subsumes. Each needs a gate proving
the replacement covers it before it goes.

---

## 10 · Acceptance gates

Each gate is offline, cheap, and adversarial. None of them requires a browser
or a network.

| gate                                                            | refuses when                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recipe:schema:check`                                           | an envelope validates while carrying a CSS channel name in `ir`, or an unknown `reason`, or an authored hash.                                                                                                                                                                                                                    |
| `recipe:totality:check`                                         | an input fact is absent from all three of `ir`, `extensions`, `receipts`. The self-test drops one fact and expects red.                                                                                                                                                                                                          |
| `recipe:normalize:check`                                        | normalization is not idempotent/key-order-insensitive, changes array order, or accepts a value JSON would coerce.                                                                                                                                                                                                                |
| `recipe:hash:check`                                             | key insertion order changes the hash, or a meaningful tree/value/domain mutation does not.                                                                                                                                                                                                                                       |
| `recipe:button:check`                                           | Button compilation drifts, its fixed point breaks, an axis/role/binding edit passes, or a planted defect is missed.                                                                                                                                                                                                              |
| `recipe:input-field:check`                                      | Input/Field compilation, two-cycle fixed point, fact accounting, source-boundary gate, semantic output, or a planted refusal drifts.                                                                                                                                                                                             |
| `recipe:acquisition:check`                                      | a selected Button source fact lacks a by-field landing, a measured literal invents a token, or source identity enters generic logic.                                                                                                                                                                                             |
| `recipe:receipts:check`                                         | a receipt cites evidence that does not exist, or an `inert` row cites a row that is not INERT in the channel table.                                                                                                                                                                                                              |
| `recipe:comparison:check`                                       | a legacy pin does not recompute, denominators differ, axes/cells are zero, or required states/roles/sample coverage are missing.                                                                                                                                                                                                 |
| `recipe:comparison:adjudicate`                                  | packet/grade/key/receipt bytes drift, blind separation breaks, mapping is not bijective, failure defects are absent, or stored arithmetic differs from recomputation.                                                                                                                                                            |
| `recipe:input-field:comparison:v2:multi-rater:check`            | a rater is missing/reordered, thresholds fail, majority failures lack two defect records, key bytes drift, or consensus/instability arithmetic differs.                                                                                                                                                                          |
| `recipe:input-field:comparison:calibrated:check`                | continuity bytes drift, packet metadata reveals a hidden copy, A/B differ, grade envelopes are invalid, thresholds change after lock, reliability arithmetic drifts, or a failed gate unseals performance identity.                                                                                                              |
| `recipe:input-field:comparison:calibration:v3:check`            | B/C import pins differ, A is relabelled, D is missing from the replacement roster, a scoring field/threshold changes, performance bytes/key/order drift, or performance access is enabled before D qualifies.                                                                                                                    |
| `recipe:input-field:comparison:calibration:v3:adjudicate:check` | a qualification/envelope/hash/order/provenance/byte-continuity/reliability metric drifts, a failed threshold opens the key, architecture arithmetic appears after failure, or Input/live becomes true.                                                                                                                           |
| `recipe:input-field:paired:check`                               | historical evidence bytes drift, GOLD becomes ambiguous or unbalanced, side swaps/opaque IDs/source-byte continuity fail, grade/tie rules weaken, calibration or reliability thresholds move, a failed gate opens the key, duplicates enter final arithmetic, or relative preference is promoted to absolute/Input/live success. |
| `recipe:input-field:objective:check`                            | the locked protocol, exact 128-cell manifest, source/candidate/environment bytes, opaque measurements, identity timing, fixed metric weights, per-cell dimensions/nonzero/pixel/ink/structure assertions, aggregate arithmetic, historical evidence index, or fail-closed progress decision drifts.                              |
| `recipe:ir:closed:check`                                        | an IR field has no named Figma Plugin API assignment in the interpreter.                                                                                                                                                                                                                                                         |
| `recipe:scene-readback:check`                                   | expected-plan occurrences collapse, actual scene layout/binding/text/payload/axis/children drift is missed, plugin-data source IR can mask a mutation, or the scene-derived two-cycle fixed point is unstable.                                                                                                                   |
| `recipe:pivot-status:check`                                     | Button or Input is promoted, v2 is re-certified, committed criterion chronology is misstated, the prospective criterion hash drifts, or any v3 capture/result appears before authorization.                                                                                                                                      |
| `recipe:input-field:live:v3:authorization:check`                | antecedent/capture protocol bytes or thresholds drift, Git ancestry is wrong, the authorization first-add commit is absent/non-unique/changed, the tree is dirty, a required scene/Task 2 gate or exact Figma key changes, posthoc data leaks into authorization, or a receipt predates authorization.                           |
| `recipe:regression:census`                                      | the legacy-adapter census changes without its committed table changing (a decrease-only ratchet on carried facts).                                                                                                                                                                                                               |

Phase 0 shipped the schema, normalization, and hash tests. Phase 1 adds
`recipe:button:check`, including planted dead-axis, missing-role, fake-layout,
unsupported-edit, wrong-selection, and dropped-binding failures. The remaining
gates arrive with the code they guard, and each must **fail before it passes**:
a gate that has never been red has not been tested.

---

## 11 · Stop / go

**Go** requires, on one commit, all of: Button's easy-control slice and the
Input/Field difficult-control slice complete on matched denominators; the hash
stable across recompiles; totality enforced by the schema rather than by
convention; and at least two of Combobox, Data Table, Calendar compiling to a
minted set that clears their matched or absolute acceptance bar.

**Hard stop — abandon the pivot** if any of these is true after Phase 1:

1. **The IR cannot stay closed.** If Button alone forces an escape hatch —
   a free-form property bag, a raw CSS passthrough — the closed vocabulary is
   not achievable and the central premise is dead.
2. **Receipts explode.** If a first-party button's receipt list is dominated by
   `no-figma-primitive` rows, the IR is too small to be useful and the honest
   finding is that this archetype class is not canvas-expressible.
3. **The hash is not stable.** If canonical form cannot be made deterministic
   over the same input, §4's four downstream properties all collapse.
4. **Recipes need per-library special-casing.** If `recipe.button` needs a
   branch per source library, the recipe is not archetype-specific — it is a
   capture-specific script wearing a recipe's name, and it will rot exactly the
   way the current forward path did.

A stop is recorded here with its evidence, the same way
[23 — Known limitations](23-known-limitations.md) records the others. It is not
a failure of the exercise; an architecture disproved in one vertical slice is
the cheapest possible outcome.

---

## 12 · What this supersedes, and what it does not

**Superseded — the forward capability plan.** The _direction of travel_ implied
by the capability rows of [26 — Definition of v1](26-v1-definition.md)
(`V1-CLASS-01`, `V1-CLASS-02`) and by entry 2 of its approved post-v1 register
is superseded by this document. Those rows describe archetype classes as
graduating through incremental widening of the existing engine. That is no
longer the plan: a class graduates by acquiring a recipe and passing §10's
gates.

**Not superseded — everything else in docs/26.** Its rows are the release
contract and this document does not edit them, weaken them, or reclassify any
archetype. `V1-CLASS-01`'s proven list and `V1-CLASS-02`'s experimental list
remain exactly as measured. In particular:

- **This document does not declare v1**, and does not move v1 closer. It
  describes work that has not been done.
- **No archetype is reclassified here.** Combobox, Data Table and Calendar
  remain experimental or never-attempted until a gate says otherwise.
- **No docs/26 row may be edited** on the strength of this plan. A row changes
  when a §10 gate is green on a commit, and the edit cites that gate.
- The engine's measured results ([24 — What works](24-what-works.md)) are
  unaffected; nothing here re-measures them.

**Related reading.** [02 — Contract spec](02-contract-spec.md) for the legacy
document this sits beside, [30 — Channel table](30-channel-table.md) for the
per-property classification `receipts` cites as evidence, and
[31 — First pass](31-first-pass.md) for the untouched-chain metric the recipe
path will eventually have to answer to.
