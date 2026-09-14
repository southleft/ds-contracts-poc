# Calendar state typography — live measurement, 2026-09-14

The original selected day `20` is 18px / weight 700. The previous mint used
the ordinary day's 16px Regular. Screenshot inspection exposed the difference;
the source ledger confirmed it. The shared recipe now carries optional state
typography, and collapse preserves it across two compile/readback cycles.
No source config, captured ledger, frozen writer, or owner grade was changed.

Writer source revision: `aa90ec337f450aad2ba4e420ba7b4636c7654a5f`.
Scratch page: `290:3875`; calendar: `290:3913`. The selected text in the
live export reports 18px Times New Roman Bold. The writer created one empty
variable collection (zero variables), plus its new page/component hierarchy.
Existing Scratch history was preserved.

Playwright CLI rendered the pinned original package twice at 900×900, scale 1,
light mode. Both source PNGs match each other and the committed reference
byte-for-byte. The new Figma export scores **3.019%** AA difference, versus
the previous **3.048%**. Exact/unmasked mismatch and the 2px ink-bound residual
remain in the receipt; the navigation glyph is still a named placeholder, not
the source SVG. No masks or thresholds were changed for this fix.

Run `node --import tsx --test recipe/calendar-typography-evidence.test.ts` to
re-derive current and predecessor scores, verify the current emitted writer
and captured-source hashes, and reject planted typography, source/image hash,
predecessor-identity, and metric edits. The dated morning evidence remains
under `../live-fidelity-2026-09-14/`; its calendar row is historical, not current.
Offline tests reproduce stored measurements; they do not prove future Figma
freshness or re-authenticate the original live event. No owner grade/signoff.
