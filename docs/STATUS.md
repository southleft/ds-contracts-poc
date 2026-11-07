# Status

Updated 2026-11-01 (Step 2 started; grammar classifier, Figma to React font preflight, variant matrix rule, plugin capture and Storybook reader parts 1 to 2c, the pinned reference environment and both font preflights in). This is the weekly note that [docs/GOAL.md](GOAL.md) requires.
It is overwritten every week; git history keeps the old ones. Read GOAL.md first,
then this page, then choose work. It is written for any agent or provider.

## This week's five lines

1. **What reached users:** nothing since `@ds-contracts/cli` 0.5.0-rc.1 on
   2026-08-05, which lacks `figma-to-react`. The hosted plugin zip and sites are
   August builds.
2. **Outside users:** 0. The repository has never had a GitHub issue.
3. **The four numbers per direction**, from A0 (today's engine, run once on
   2026-10-31 with fonts supplied and no edits):
   - Figma to React, Sanity UI v2 (18 sets, 287 variants): headline 8.8% (mean
     of per-set pass rates); raw 8 of 287 variants (2.8%); 1 of 18 sets whole
     (TextArea); 0 font-blocked. Coverage 10 of 18 sets (55.6%); inside the
     grammar, headline 13.3% and raw 3 of 198. Seven sets (64 variants) were refused before measurement: masks
     (Popover, Tooltip), a "scheme" axis that could be a variant or a theme mode
     (KBD, Radio, Autocomplete), a layout table over its size limit (TextInput)
     and generated TypeScript that does not compile (Chip).
   - React to Figma, Agriculture Design System (648 stories, 127 components):
     0 of 127 converted. The Storybook reader (part 1) reads all 648 stories:
     coverage 85 of 127 components (66.9%); out for object (33, often
     `children`), color (8) and number (6) arguments. Counted under the
     stories-as-variants rule, own render decided from the rendered page: 102 of
     127 components, 431 expected variants (denominator changes, not progress:
     101 and 400 before two fixes in the reader and the rule, 140 in 126 under
     the first rule). Refused: 24 whose every story draws its own render, 1 over
     64. Named, not counted: 159 own-render stories, 35 repeats of an earlier
     story's arguments, 0 the reader could not render. Each of the 431 variants
     has a reference image, drawn in the pinned environment and byte-identical over
     two runs; its text is drawn in Arimo, Tinos and Cousine, which Figma lists.
     Font-blocked: 0 of 431 (405 while the image drew Liberation, which it does not).
   - Earlier fresh kits (2026-10-14 to 10-19, before GOAL.md), Figma to React:
     headline 16.3%; raw 177 of 1,344 variants (13.2%); 5 of 56 sets whole;
     57 font-blocked. On the 24 sets with a kept dump, coverage 16 of 24
     (66.7%); inside the grammar, headline 22.1% and raw 20 of 119 (Orbit's 28
     in-grammar variants are all font-blocked). The full breakdown is in this page's
     2026-10-31 Step 1 version (git history) and in
     `private/never-seen-classification-20261031`.
4. **Spend against the cap:** $0 extra usage; the Claude Code plan showed 4% of its
   weekly limit used on 2026-11-01. The cap is $2,400 through 2026-12-23, read from
   the provider's usage page.
5. **Top three named misses** on A0, after a labeled rerun with Inter 3.19 gave
   identical results (so the font version is not the cause):
   - Figma's vertical text trim (`leadingTrim: CAP_HEIGHT`) is never read, so
     single-line text boxes render 10 to 12 px too tall. This one missing fact
     explains all 183 size mismatches (Button, Badge, Select, MenuItem).
   - Icons inside components are missing from the output (checkmark, spinner,
     close, select chevron): 36 variants.
   - Seven of 18 sets were refused before measurement, and React to Figma has
     no library reader.

## Step 2 checklist (2026-10-31 to 2026-12-11)

Step 1 closed on 2026-10-31: A0 measured both ways, the earlier 1,344 variants
classified, and Decision 1 taken early by the owner (continue; signed entry in
GOAL.md). Git history keeps the Step 1 checklist.

Owner:
- [x] Decision 1: continue (2026-10-31, signed entry in GOAL.md).
- [x] React to Figma is judged only by GOAL.md's checks against the library's own
      render, with no hand-written witnesses (owner, 2026-10-31). The witnessed
      source-reference intake is regression only.
- [ ] Duplicate each drawn Figma kit into drafts, for plugin captures.
- [x] A0's text renders in Liberation, which Figma lacks: swap the pinned image's
      fonts to Arimo, Tinos and Cousine (owner, 2026-11-01: "Yes, swap the fonts").
- [ ] Draw A1 after the 2026-11-20 freeze (a sealing agent can do it at the owner's
      request), and A2 on 2026-12-04.
- [ ] Run `npm publish` for the CLI under `next` when the agent says it is ready. No
      outside approval is needed.
- [ ] Recruit 5 to 8 outside testers. Paste weekly AI spend into this page.

Agent, ruler first. All of it must be built and frozen by SHA-256 on 2026-11-20
(AGENTS.md rule 6; never put a checker change and a converter change in the same PR):
- [x] Grammar classifier (ACG-1), deterministic. It marks each Figma component set
      and each story in or out of the grammar, with a named reason, and replaces the
      provisional check used in the classification. Publish coverage for A0 and the
      earlier kits. `extract/figma/grammar.ts`; coverage is in the five lines above,
      receipts in `private/grammar-coverage-20261031` (git-ignored). The most common
      reason out is an absolutely placed child (6 A0 sets, 4 earlier). A subtree with
      no text and no auto layout counts as a drawing (SVG) wherever it sits.
- [x] Font preflight, Figma to React: `scripts/font-preflight.ts` lists every face
      the design's text draws and refuses, by name and before anything is packaged,
      each one `--fonts` does not supply (exit 3, `<out>/font-preflight.json` with the
      variants for the font-blocked column).
- [x] Font preflight, React to Figma: `npx tsx scripts/font-preflight.ts --stories
      <stories.json> --capture <any set>.capture.json --out <dir>` holds the faces the
      reader saw each variant drawn with against Figma's font list, which the plugin
      capture now records whole (`figmaFonts`; it belongs to the machine, not the
      draft), and refuses each missing face by name with its variants (exit 3,
      `font-preflight.json`). On A0: 6 faces; all were missing while the image drew
      Liberation (405 of 431 variants blocked), none are with Croscore (0 of 431).
- [x] Variant matrix rule: the cartesian product of enumerated story arguments,
      capped at 64 per set. `extract/figma/variant-matrix.ts`: option-list arguments
      are the axes (true/false and text arguments are properties, not axes); a product
      over 64 or a repeated option is refused by name, never cut; `matchesMatrix`
      names every missing or extra axis, option and variant in a set read back from Figma.
- [x] Plugin capture, part 1: a PNG per variant at its whole-pixel layout box (and
      the painted extent when paint reaches past it), the font list with what this
      Figma can load, and variables (already in the dump), from a draft the owner
      duplicated. `extract/figma/capture.plugin.js`, run by the Sync Runner's
      "Capture reference images" button. Live on the A0 draft: Button's 150 variants
      in 0.7 s. REST dumps stay a frozen input format.
- [x] Plugin capture, part 2a: the check reads `<set>.capture.json` (`--capture`)
      instead of Figma's REST images, through the same framing proofs, for both
      directions (`scripts/design-consumer-capture.ts`).
- [x] Plugin capture, part 2b: SVG for icons and vectors, built from `fillGeometry`
      and `strokeGeometry` with no export call (parent session's route, 2026-11-01;
      an export of one icon took 1 ms, then 152 s, and blocks the plugin). One SVG per
      main component; hidden plain drawings skipped; masks, gradients, image paints,
      effects, other blend modes, group opacity and clipped overflow refused by name.
      On the A0 draft: 18 sets, 527 drawing slots, 12 drawings in 0.5 s, 10 built, 2
      refused (the Popover and Tooltip arrows, `svg-mask`), two runs byte-identical.
      Checked, not scored: every path is numerically identical to REST's
      `geometry=paths` for the same nodes, and each SVG drawn in the pinned Chromium
      differs from Figma's PNG of it only in anti-aliased edge pixels.
- [x] Capture instrument bug (parent session, 2026-11-05): an instance's SVG was built
      from its main component, so it drew the main's ink, not the instance's (A0's
      Checkbox check: dark in the SVG, white in Figma). Each drawing is now built from
      the drawn node and identical SVGs are stored once by their bytes. On A0, visible
      drawings that differ from Figma's PNG of the same node: 30 before, 0 after; every
      other captured field byte-identical; two captures byte-identical.
- [x] Storybook reader, part 1: `scripts/storybook-reader.ts` reads every story's
      arguments through Storybook's own preview API in pinned Chromium and holds
      each component against the grammar and the variant matrix rule.
- [x] Storybook reader, part 2a: own render decided from the rendered page
      (`rendersOneInstance`): a story is one variant when its root renders exactly one
      instance of the component, found by its React component type, and nothing
      beside it. Stories with identical arguments count once (the first in index
      order); a story the reader cannot render is named apart, never counted.
- [x] Storybook reader, part 2b: each expected variant is rendered in pinned Chromium
      (its story, with listed options set through Storybook's own args channel) and
      its single instance kept as a PNG reference image, never through the engine,
      with every platform font Chromium drew its text with (fallbacks included).
      Two fixes moved the denominator: the first story in index order
      timed out because Storybook reports re-selecting the loaded story as
      "unchanged" (AGBranding now counts), and each story now spans its own option
      list, as the signed rule says, not the first story's (SectionAlert's stories
      narrow `tone` to their group: 21 to 51 variants). Stories that list different
      option arguments are refused by name (`variant-matrix-option-axes-differ`; none on A0).
- [x] Pin the reference environment (owner condition, 2026-11-01): a library that
      ships no fonts leaves the face to the platform, so the reader renders only in
      Playwright's image for this playwright-core, by its linux/amd64 digest (`PINNED`
      in the reader, run through Docker), and records the image, OS, Chromium version
      and installed font list in `stories.json`. On A0 the system stack now resolves
      to Liberation Sans, Serif and Mono, which the font preflight holds like any face.
      Two runs were byte-identical (431 PNGs). The image's arm64 build drew 2 of them a
      few pixels one level apart, so the architecture is part of the pin.
- [x] Storybook reader, part 2c: the reader records the React renderer the Storybook
      loads and refuses one outside the tested 18.3 and 19.x range by name. Tested on
      A0 (its Storybook ships React DOM `18.3.0-canary-178c267a4e-20241218`; images
      unchanged) and on this repository's Storybook 10.6.3 with React DOM 19.3.1 (201
      variants, 193 references, two runs byte-identical; 8 empty layouts named
      `reference-empty`). The witnessed source-reference observer keeps its pin; it is
      regression only.
- [x] Swap the pinned image's fonts (owner, 2026-11-01): `scripts/storybook-reader-image/Dockerfile`
      removes Liberation and adds Arimo, Tinos and Cousine from google/fonts at a pinned
      commit, each file checked by SHA-256; the reader builds it locally (tagged by the
      Dockerfile's hash, never pushed) and records the base digest, Dockerfile hash,
      image ID and font list. Fontconfig's own metric aliases pick the faces: on A0,
      `-apple-system, "system-ui", "Segoe UI", Helvetica, Arial, sans-serif` resolves at
      Helvetica to Arimo, and Prose's serif and code text to Tinos and Cousine.
- [x] Generic families (parent session, 2026-11-01): they resolve to the free,
      metric-compatible equivalents of the macOS and Windows defaults, so `sans-serif`
      and `system-ui` go to Arimo, `serif` to Tinos and `monospace` to Cousine
      (`scripts/storybook-reader-image/fonts.conf`, prefer rules only). Before, a stack
      that reached `system-ui` or `monospace` drew a CJK face. `ui-*`, `-apple-system`
      and `BlinkMacSystemFont` are unknown to Chromium on Linux and skipped. A0 is
      unchanged under a fixed page clock (0 of 431).
- [x] Pin the reader's clock, timezone and locale (parent session, 2026-11-05): 48 of
      A0's references are date pickers and calendars that draw today's month. `PAGE` in
      the reader fixes the page clock at 2026-11-01T12:00:00Z (timers keep running),
      timezone UTC, locale en-US, viewport 1280x720 at scale 1, light color scheme, no
      reduced motion and a seeded `Math.random`, and `environment.page` records them.
      A0 on Nov 5 reproduces #305's Nov 1 references byte for byte, as does a run with
      the container in UTC+14 and German. Dependabot holds playwright until after
      2026-12-23 (Chromium is part of the pinned render).
- [x] Variants shown as separate stories count (owner, 2026-11-01, signed entry in
      GOAL.md): `storyVariantMatrix` in `extract/figma/variant-matrix.ts`.
- [x] Move the full CI lane to nightly plus manual runs (owner, 2026-11-01): PRs wait
      only on the fast, catalog and smaller lanes. Run it by hand on the frozen
      commit and before any sealed run.
- [x] Cut a PR's CI wait to 15 minutes or less (owner, 2026-11-01: "Yes, queue it"):
      median of three runs on #318's last commit 14.8 minutes (15.6, 10.7, 14.8), from
      22.4 for the longest job on #317. No gate deleted, no job added: exact-proposal
      runs in the second fast job (with design:consumer:test); the witnessed
      source-reference suite runs nightly in the full lane; the benchmark's React to
      Figma cells run on main, nightly and by hand; Chromium's system packages are
      cached per runner image (5 of 24 installs had stalled 8 to 10 minutes on the
      Ubuntu mirror). The same tests vary by about a third between runs (exact-proposal
      560 to 741 s), so a single run can still pass 15.
- [x] A font counts only as painted (parent session, 2026-11-05): the consumer check
      called a family available when text set in it measured wider or narrower than a
      generic family, so a face installed on the machine passed (this Mac has Inter,
      Public Sans and Atlassian Sans). Each text now counts only when Chromium painted
      it (`CSS.getPlatformFontsForNode`) with a web font whose bytes are a supplied
      file, loaded under the text's own family as a supplied face of its style.
      Anything else is font-blocked, its own class and exit (3): never a pass, never a
      conversion failure. On the Mac practice baseline (the fixed 40 and A0: 58 cells,
      944 measured variants) no variant changed class or score: the font preflight
      already refuses every set that draws Atlassian Sans, and the manifest supplies
      Inter and Public Sans as web fonts. Checked with no fonts supplied, Base UI's
      Select trigger gives 5 unverified variants before (installed Inter counted) and
      5 font-blocked after.
- [x] The clean consumer builds the same bytes on every run (instrument bug, found
      2026-11-05 while proving the pinned browser): `figma:to-react` runs Vite
      in-process, which sets `NODE_ENV=development`, and the consumer's `vite build`
      inherited it. React's development JSX then wrote each run's temp folder into the
      bundle, and the lockfile named the tarball by its temp path, so one input served
      different JavaScript every run (`design:consumer:check` alone built for
      production). The consumer's commands now run without `NODE_ENV` and name the
      tarball relative to the consumer: two runs give identical lockfiles and builds.
      On the Mac practice baseline no variant changed class or score (944).
- [x] Figma to React checks paint in the pinned image (parent session, 2026-11-05):
      `figma:to-react --pinned` starts Chromium with the Storybook reader's own
      `pinnedBrowser()`, so both directions render in one Chromium with one font set.
      The page reaches only the consumer server; any other request is refused and
      named. The receipt records the image (base digest, Dockerfile hash, image ID,
      OS, Chromium, fonts), Node and npm, the date the consumer's dependencies resolve
      as of (`npm --before 2026-11-01`), its lockfile's SHA-256 and the SHA-256 of
      every file the browser loaded. Four A0 sets (41 variants), fetched fresh from
      Figma: two runs on this Mac (Docker Desktop, amd64 under emulation) and one on
      GitHub's ubuntu runner gave byte-identical screenshots (41 of 41), served files,
      lockfiles, packages and verdicts. Only the image ID differs: each machine builds
      the image itself and the ID covers layer timestamps; the base digest, Dockerfile
      hash, OS, Chromium and fonts match.
- [x] Rerun the practice baseline and A0 in the pinned image, the comparison base for
      later climb PRs (`01b5d070`, regression only): 58 cells, 10 font-blocked, 9
      refused, 944 variants, 628 pass (672 in the Mac's own Chromium). Mac against
      image, a note: A0 keeps every class (8 of 223 pass both ways; its median image
      difference rises 1.3 points). 44 variants on five other kits pass on the Mac and
      fail in the image, all in text-heavy sets (Material 3 20, Base UI 11, Spectrum 5,
      Ant 5, Obra 3); none moves the other way. Receipts in
      `private/beta-kits/baseline-20261105-image` (git-ignored).
- [x] Text is set at the font's design advances in the pinned image (parent session,
      2026-11-05): headless Chromium's default font hinting also turned off subpixel
      positioning, so every web-font glyph landed on a whole pixel, up to 15.7 px off the
      design over 39 characters (macOS and Figma set the design advances). The container
      now launches Chromium itself with `--font-render-hinting=none`, and every run first
      sets a probe in the image's Arimo, loaded as a web font, and refuses by name if
      every glyph lands on a whole pixel. Practice baseline in the image: 656 of 944
      pass (628 before); 28 variants move to pass (Material 3 19, Ant 5, Obra 3,
      Spectrum 1) and none to fail; 38 scores get worse without changing class (SDS's
      TextContentHeading by up to 5.5 points, A0's Avatar by up to 1.1). A0's 431 reader
      references are unchanged: its text uses installed faces, which fontconfig already
      positioned fractionally. The 41-variant replay stays byte-identical on this Mac
      and on ubuntu.
- [x] Text is antialiased by coverage alone in the pinned image (parent session,
      2026-11-05): the image's Ubuntu fontconfig asked for RGB subpixel (LCD) text, a
      property of a display, so text over an opaque background came out with color
      fringes (88 levels on Base UI's) and a horizontal smear, 7% more ink than the
      outlines' area. The fixed launch args add `--disable-lcd-text`, and the probe also
      refuses any gray-on-white probe pixel whose channels spread over 2 levels.
      Practice baseline in the image: 662 of 944 pass (656 before); 6 move to pass
      (Base UI's Select trigger 5, Material 3 1) and none to fail, and the 28 from the
      hinting fix all still pass; 216 scores get better, 2 worse (A0's disabled
      MenuItem, by up to 0.66 points, still failing). 403 of A0's 431 reader
      references change (this applies to installed faces too); the reader's counts and
      fonts do not. The 41-variant replay stays byte-identical on this Mac and on
      ubuntu. Left as a property of the ruler: Spectrum's 4 breadcrumb variants, light
      text on transparent, carry 3.7% more ink than the outlines' area (the Mac −0.7%),
      because Skia's Linux text gamma and contrast are fixed at build time with no
      runtime switch. Base UI's Field (6) still fails by 0.2 to 0.5 points, not
      diagnosed.
- [x] Storybook reader, part 3 (parent session, 2026-11-06): each reference also keeps what
      its instance draws (its text, text runs with declared color, family, weight and
      opacity, and its graphics), read after the screenshot by the Figma to React check's own
      collector (`domContentOf`) inside the instance's own DOM container, and its value on each
      axis of the matrix rule, which pairs it with a written variant. On A0: 424 of 431
      references; the 7 of AppLayoutSidebar are named `reference-content-not-one-container`
      (its top elements are not the children of one element). The 431 images are
      byte-identical to the 2026-11-05 run, two runs give byte-identical `stories.json`, and
      without the new fields it equals the 2026-11-05 one.
- [x] Storybook reader, part 3b (parent session, 2026-11-06): each reference is the instance
      alone, captured as the Figma to React check captures its own side
      (`captureSubjectWithoutBackdrop`): ancestor background colors cleared and restored,
      motion off (`NO_MOTION`, the consumer page's own rule), the image clipped to the paint
      extent Chromium's layers report, and its frame recorded (`browser-paint-extent-v1`).
      Before, all 431 of A0's references were opaque (the page and its theme decorator painted
      white into them), so "on black" could not be measured. One screenshot first absorbs the
      empty style attribute Playwright's caret hiding leaves on inputs. The paint-extent
      promotion check now sets aside an out-of-flow node that paints nothing (clipped to no
      area, hidden with all it holds, or an empty box); A0's visually hidden labels and a
      closed dropdown panel had refused 115 references. Focus guards (empty boxes) are not top
      elements. On A0: 411 of 431 captured alone (362 with transparency, 86 wider than the
      layout box); 20 refused by name and counted unverified: AppLayoutSidebar 7 (a second top
      element, a portal holding content), Combobox list primitives 5 and LoadingBlanket 1
      (inside a painted ancestor), Text and TextLink 3 (inline, no layer), Details 3 (it opens
      during the capture in Storybook's channel render, also after a 1 s wait), LoadingDots 1
      (paints nothing when still). Restoration proof: after every capture, a shot by the old
      method equals the 2026-11-05 image, 431 of 431. Two runs byte-identical (by chance: see
      part 3c); counts, grammar,
      matrix and fonts unchanged. Figma to React practice baseline on this commit: 944 of 944
      variants identical to `baseline-20261105-image-d` (one cell rerun after Figma's REST
      answered HTTP 500).
- [x] Storybook reader, part 3c (parent session, 2026-11-06): still throughout pass 2. Part 3b
      turned motion off for the capture only, so each reference's box and text marks were read
      before it and its faces and content after it, while animations ran. LoadingDots' content
      then depended on the dots' fade at the moment of reading: part 3b's two runs happened to
      read the same phase, and a third run did not. The rule (`NO_MOTION`) now covers the whole of
      pass 2; pass 1 reads only React's tree. Three A0 runs byte-identical; against part 3b's run,
      no image or box changed, only LoadingDots' content.
- [x] Storybook reader, part 3d, and the React to Figma text font (parent session, 2026-11-06):
      Figma text has one family and no fallback stack, so a reference's family is the face
      Chromium painted each run with, not the stack it declared. A0 declares `-apple-system` and
      paints Arimo, and the first live write compared the two. The reader records each run's
      painted families from the node that draws it: its text node, a form field's user-agent
      shadow text, or generated content's own node. A checkbox or radio value never draws. The
      check compares that face. A run painted with no font is not drawn and left out; one painted
      by several families, or unread, is unmeasured by name. Figma to React's first-declared-family
      comparison is unchanged. A0: 2,166 runs, 2,124 with one painted face (Arimo 2,103, Tinos 14,
      Cousine 7), 42 not drawn (checkbox, radio and switch values; 1 visible, Switch's "on"),
      0 painted by several faces, 0 unread.
- [ ] React to Figma check, merged by 2026-11-18 (parent session, 2026-11-06): it judges a
      Figma set written from a library against the reader's references by GOAL.md's checks,
      with the Figma to React check's comparison code and its one image limit. A set counts
      only when it is a real component set: its variant properties match the story matrix
      (`matchesMatrix`, capped at 64), it uses auto layout outside drawings as the grammar
      classifier defines them, and every text the reference draws is editable TEXT. A set that
      fails this counts every expected variant as failed. Each variant then needs images within
      5% on white and on black, size within 2 px, every text and icon present, and matching text
      color and font. The share of visible solid paints bound to variables is reported, never
      gating.
      - Part 1, the set rule, in (`scripts/react-to-figma-check.ts`). It calls `matchesMatrix`
        on the matrix rebuilt from the references, the grammar classifier's own layout reasons
        (`classifyDump`; drawings exempt as there), and `missingTexts` on the paired variant's
        TEXT characters. A reference it cannot read (no render, no content) leaves only its own
        variant unverified. Negative control: A0's StatusBadge references against Sanity UI's
        written Badge set fail by name (25 problems, 17 of 17 variants failed).
      - Part 2, each variant, in: images on white and black (`alignRecordedFrames` on the
        reference's paint-extent frame and the plugin capture's, the one `IMAGE_LIMIT_PERCENT`),
        size within 2 px (`consumerSizeCheck`), every graphic the reference draws present
        (`matchParts`, now generic), every text in its color and font (`compareTextStyles`); a
        face Figma lacks is font-blocked (`storyFontPreflight` on the capture's font list).
        Figma to React practice baseline on this commit: 944 of 944 variants identical to
        `baseline-20261105-image-d`. Proven on fixtures only: no set written from a library
        exists yet (writable Figma file pending with the owner).
      - Part 3, a plugin capture's painted extent, in. The plugin's layout export is clipped to
        the box, so where paint reaches past a side, the box's outer pixel row or column there
        is composited differently. On the live write, Card's shadow variant differed on 6
        pixels, all on that ring, and was refused (`render-export-overlap-mismatch`). For a
        plugin capture only, and only after the exact comparison is refused, that row or
        column is left out on each side paint reaches past and named in the proof
        (`edgeRing`). A shifted interior is still refused, with no value tolerance. REST
        exports are unchanged. Live write: Card's shadow variant is now measured (5.92% on
        white, 20.93% on black, so it still fails); no other variant changed.
      - Next, rule 10: one Figma to React render (`untitled-ui-free/1102-5338`, success on a
        dark circle) alternates between two PNGs. No verdict moves.
- [ ] Freeze on 2026-11-20: commit the SHA-256 of the checker, the grammar
      classifier, the variant matrix rule, the React to Figma check, the Storybook reader
      (`scripts/storybook-reader.ts`), whose own-render test, argument serialization
      and grouping decide the React to Figma denominator, its capture of each reference
      alone at its paint extent (`captureSubjectWithoutBackdrop`, `observeConsumerPaintExtent`,
      `NO_MOTION`), its pinned image
      (`scripts/storybook-reader-image/`), clock, timezone and locale, the plugin
      capture with its SVG builder, and the pinned Figma to React runner
      (`--pinned`), its `npm --before` date, the image's base digest, and the pinned
      browser's launch args with its text-layout and color-fringe probe. A sealed
      Figma to React run (A1, A2, B) counts only with `--pinned`; a run in the
      machine's own Chromium does not.

Agent, climb (practice kits only, one named miss class per PR, shared rules only).
Rule 8: each fix must also help a practice kit other than the one that motivated it
and break no known cell. A0 is now practice and regression only.
- [x] Figma's vertical text trim (`leadingTrim: CAP_HEIGHT`, the CSS
      `text-box-trim` equivalent): all 183 A0 size misses. Not shipped (rule 8): no
      second practice kit uses it. Figma's REST API, read 2026-11-05, reports it on
      A0 but on none of the 204 corpus sets (15,650 text layers in all 17 files,
      the fixed 40-set included); Semi and Orbit use none. It stays a named miss,
      to revisit if a practice kit or a drawn kit uses it. Receipts in
      `private/leading-trim-20261105` (git-ignored).
- [x] Icons inside components (checkmark, spinner, close, select chevron): 36 A0
      variants. Not shipped (rule 8): the climb draws a glyph only for an icon whose
      component the dump lacks (a remote library icon, as on A0); on Base UI and shadcn
      Obra the icons are local components and already render. All 19 of their
      icon-bearing sets, captured read-only on 2026-11-05, package byte-identically with
      and without the captures, so no variant moves. The work stays on the local branch
      `claude/climb-remote-icons-2026-11-05`; captures in
      `private/icon-captures-20261105` (git-ignored).
- [x] A0's refusals that are plain defects, not grammar: Chip's generated
      TypeScript does not compile (TS2322, an option list forwarded to a part that
      lacks one of its values), and TextInput's layout table is over its 4,096-tuple
      limit. Not shipped (rule 8): today's engine packages 169 of the 204 corpus sets
      and refuses 35 by name, and neither defect appears on another kit. A different
      compile failure appears once, Atlassian's Shortcut (TS2367: a nested condition
      that can never hold inside its parent's). Receipts in
      `private/practice-compile-20261105` (git-ignored).
- [x] Rank the practice failures by cause against the pinned-image baseline (662 of
      944, regression only), measured on rendered output, never on flags. Receipts in
      `private/climb-diagnosis-20261105` and `private/practice-compile-20261105`.
      - Next converter class: geometry the dump lacks, drawn from the capture's SVG
        (vector paths and boolean operations: HeroUI 1, Untitled 2; A0's remote icons
        36 through the same path). It needs captures of HeroUI, Untitled and Material
        3, which the owner is opening.
      - Refusal families across the 204 corpus, by kits then sets: native image paint
        (5, 10), structured property evidence missing (4, 7; a dump input gap),
        visibility demand on owned parts (4, 7), source instance identity (4, 4),
        contract schema misfits (3, 5), child paint order (3, 3). A refused nested
        component becomes an empty stub in its parent (12 sets on 8 kits, Carbon's
        Slot among them).
      - Named limit: a remote library instance's contents are not in the dump. Only
        drawings come back, through the capture's SVG; text and layout do not (MUI's
        card header, 2). REST dumps stay frozen.
      - Ruler properties, not converter: text gamma on light or transparent text
        (Spectrum 6, Base UI's Field 6) and antialiased edges of small shapes (chakra's
        Spinner 8, Spectrum's folder icon 3). Open: text sits 1 px
        higher in the image than on the Mac and in Figma (Base UI, Spectrum, SDS); a
        probe rules out the fonts' metrics.
      - Not measured: 19 variants whose REST render export overflows the layout box
        (Material 3 12, Untitled 6, Obra 1). A practice set with a capture uses it as
        the reference for every variant.
      - Single kit, no code (rule 8): Ant's avatar photo 8, Obra's per-variant nested
        fills and sizes 4, SDS's text row drift 4, HeroUI's disabled slider 1, A0's
        text trim 170 (Button 150, Badge 5, Avatar 15: text 2 to 6 px lower than
        Figma's), Switch knob 3 and Card 6.
- [x] Climb, image paint over a solid fill (the top family on measurable kits; parent
      session, 2026-11-05): where the dump proves a node's visible fills are exactly a
      SOLID under the IMAGE, the image becomes the background-image over the solid's
      background-color, as a single image paint already did. The bytes were already in
      the dumps (all 59 image paints match their Figma hash). An unproven stack is
      refused by name (`paint-stack-below-image-unproven`: chakra), and image opacity
      stays refused (SDS). Help, measured in the pinned image: Radix's Aspect Ratio 3
      of 3 refused → pass, Ant's Heading 8 refused → pass. Named fails, not help: Ant's
      avatar collapses (it is sized by rotated frames the dump cannot carry) 8. Ant's
      legacy Page Header now draws the Avatar and Heading it stubbed (not measured
      before): 1 pass, 7 fail, 8 font-blocked. 204 corpus: 196 packages
      byte-identical, 2 sets newly proposed, 1 changed, 0 newly refused; practice
      baseline unchanged (944 of 944).
      Single kit since: source instance identity (Material 3's menu swaps to a local
      density variant the converter does not link; Atlassian's and Carbon's swaps are
      remote).
- [x] Measure the inferred `text-rendering: geometricPrecision` policy (parent session,
      2026-11-05): 43 Figma text boxes in 5 practice cells (Base UI's Field, Spectrum's
      Breadcrumb, SDS's Text Price, HeroUI's Slider, Ant's Heading), run with the policy
      on and off, under the pinned launch (hinting off) and with full hinting (as an
      unpinned Linux user sees it). With full hinting the policy keeps every text width
      within 1 px of Figma's; without it 8 drift by up to 4 px. Its cost: 18 of 43 boxes
      sit 1 px higher than Figma in both launches (2 without it). Under the pinned
      ruler, where hinting is off, it buys nothing (widths within 1 px either way). Kept;
      the 1 px is its named cost. Open: a narrower scope that keeps both. Receipts in
      `private/gp-measure-20261106` (git-ignored).
- [x] Character demand on a text node split by its binding (parent session, 2026-11-06):
      single kit, no code (rule 8). Ant's Button (one Figma text node bound to Title in 148
      variants and fixed in 3) becomes proposable with an 8-line change to the owned-text
      presence check, which then reads a node at the same path with another binding as the
      sibling part. chakra's Input stays refused before that: its text sits under a frame
      bound to the `.label?` visibility Boolean in all 315 variants, and in 9 of them the
      required "*" is renamed `Label`, a second layer of that name. No other practice set
      hits this refusal.
- [ ] The code side writes `ds-contracts.react.json` itself from the reader's
      `stories.json` (GOAL.md Step 2), in its own module outside the frozen reader, after the
      React to Figma check. Its route (the source-reference engine on a generated workspace, or
      the story's own rendered page) is decided by a probe of about 5 Agriculture components
      against the reader's references.
- [ ] Carry each variant's observed values (a full default plus per-variant
      differences) instead of refusing them.

## Where things live

- The one project: `/Users/tjpitre/Sites/ds-contracts-poc`.
- Scoreboard inputs (git-ignored): `private/beta-kits`, including
  `hill-climb-set.json` and the 204-set references in `full204-1159`.
- Never-seen results (git-ignored): `private/held-out-intake-*`, classified in
  `private/never-seen-classification-20261031`.
- Sample React workspaces (git-ignored): `private/workspaces`.
- Practice fonts (git-ignored): `private/beta-kits/practice-fonts-20261105`, 8 public
  faces from pinned sources, each with its SHA-256 and license. Rebuilt on 2026-11-05:
  the September manifest lived in `/tmp` and was lost (rule 12).
- Practice baseline on this Mac, regression only (git-ignored):
  `private/beta-kits/baseline-20261105`, and `-b` with the painted-font check.
- Sealed kit pool, outside the repository: `~/ds-contracts-sealed`. Agents never read
  it; only the owner or a sealing agent reveals a slot at its draw.
- Archive outside the repository: `~/ds-contracts-archive-2026-10-31` (git bundles,
  experiment edits, compressed receipts).
- In Claude Code, `/next` (`.claude/commands/next.md`) does the next unchecked agent
  item above and nothing else.
