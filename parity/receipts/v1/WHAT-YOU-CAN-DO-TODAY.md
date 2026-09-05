# What you can do with this today

**Measured 2026-09-05.** Every claim below cites a command you can re-run. Where
a direction stops, it says so in the same words the evidence uses.

The two directions are **not at the same maturity**. Read both before choosing.

---

## Direction 1 · Code → Canvas — works, within a named boundary

**What it does.** Reads your real React component in a real Chromium, every prop
combination, and emits a program you paste into the Figma plugin. The result is
a component set scored against your library's own render.

**What it requires:**

| | |
| --- | --- |
| a **clone** of this repo | the published CLI (`@ds-contracts/cli@0.4.0`) is the *pre-pivot* path and does not do this |
| a **sandbox** with your library installed | one `package.json` + `npm i`; see any `examples/<lib>/README.md` §Recreate the sandbox |
| a **capture config entry** | one per component. Can be *drafted* — `extract/computed/draft-config.ts --write` derives name, import, contract path and both axes from a contract seed; a person adds composition |
| a **reviewed role map** | for a library the path has not seen, expect to write one. Measured below |
| **Figma desktop + the plugin** | the last step is a human pasting one program |

**What it produces, measured.** 53 of 66 fidelity rows score within **5%** of the
library's own Chromium render; 13 are named font-substrate residuals, each with
its measurement.

```bash
npm run recipe:fidelity:check     # 53 pass · 0 fringe · 13 named
```

On libraries the path had **never seen**, first pass:

| library | captured | contracts shipped | computed floor |
| --- | --- | --- | --- |
| Radix Themes | **10 / 10** | 10 | 84.8% over 58,624 cells |
| Bootstrap 5 | 9 / 10 | 7 | 92.8% over 7,536 cells |

Bootstrap exports **no components at all** — a "Bootstrap Button" is class names
on markup you write — and two of its components came out pixel-perfect on every
combo. Evidence: [`HELD-OUT-EXAM.md`](HELD-OUT-EXAM.md),
[`BOOTSTRAP5-QUARANTINE-ROUND.md`](BOOTSTRAP5-QUARANTINE-ROUND.md).

**What the walk actually feels like.** Followed from a clean clone on
`radix-themes`, a library never tuned for, using only what docs/36 says
(2026-09-05). It took **four refusals** before it completed:

1. `recipe:point` → refuses, no capture ledger, prints the capture command.
2. capture → works. Computed gate **91.06%**.
3. `recipe:point` → refuses at the role map: *"track: no pill-shaped part."*
   Radix's root **is** the track. It writes `roles.draft.json` with the other
   roles resolved and their evidence, so the open question is one line.
4. supply roles → nine errors naming leaves, caused by **one** missing key.
   *Fixed this round:* an unset role now names itself.
5. correct shape → crashed: a hyphen in the slug emitted `RADIX-THEMES_…` into
   a JavaScript identifier. *Fixed this round;* `switch.mui.ts` regenerates
   byte-identical, so the fix is a strict superset.

Then all five steps ran: 144 captures, **21 leaves read, 0 invented**, compile
to a fixed point, program emitted.

**So: "one command" is not one command** for a library the path has not seen.
It is *build a sandbox → capture → review a role map → point → paste.*

**What it cannot do.** Anything outside **thirteen archetypes**: checkbox,
switch, avatar, tooltip, chip, link, tabs, radio, textarea, alert, badge, menu,
dialog. Point it at a card, an accordion, a data table or a date picker and it
refuses by name and exits 2:

```bash
npm run recipe:point -- --archetype card --library radix-themes
# ✖ "card" is not an archetype the recipe path models. It models thirteen: …
# This is a SCOPE limit, not a failure of your library: the capture step still
# works on it, and its captured truth is still readable; what does not exist is
# an archetype recipe.
```

---

## Direction 2 · Canvas → Code — a reviewable starting point, not a conversion

Those are the v1 definition's own words (`V1-JOURNEY-01`), and the measurement
agrees with them.

**What it requires.** Figma desktop + the plugin. Or, without the plugin,
`npm run extract:figma:rest -- <figma-url>` with a `FIGMA_TOKEN` — and that
token needs the **`file_variables:read`** scope. Without the scope, *every
binding degrades to its resolved literal*, proposals mint anonymous `imported.*`
tokens, and `captured.dtcg.json` is not written. The CLI names the cause.

**What it produces, measured** on the committed exam
(`recipe/evidence/canvas-to-code-held-out-v1/generated/`): a real TypeScript
React component — `forwardRef`, typed props derived from the Figma variants,
CSS modules, a token stylesheet. For the exam's Card: 35 lines of TSX, 129 of
CSS, 49 of tokens.

```bash
npm run recipe:canvas-to-code:held-out:check    # 6/6
```

**What it loses — this is the part to read before showing anyone:**

- The drawn **text is baked in as literal content**. The proposed contract
  carries `"Card title"` and `"Card body copy for the exam."` and declares
  **zero slots**.
- **`children` is accepted and silently dropped.** It is destructured on line 17
  of the generated component and never rendered — `grep -c '{children}'` returns
  **0**. A developer passing children gets nothing, with no error.

So the component renders *your design's placeholder text, permanently*, and
ignores what you pass it. It is a starting point you edit, not a component you
ship.

**Where it stops.** The gate above proves **accounting honesty** — zero silent
losses — not usability, and says so itself. And the substrate it was measured on
was minted by *this repository's own code→canvas engine*. The evidence file says
it plainly:

> "this is a round trip on our own output … **a canvas→code exam on a file drawn
> by a designer who never used this tool is still owed**, and nothing here should
> be read as having passed one."

That exam is **parked** — see [`OWNER-PARKED.md`](OWNER-PARKED.md) P1. It needs a
Figma file drawn by someone who never used this tool.

---

## If you are evaluating this

**Try direction 1.** It is real, it is measured against your own library's
render, and its boundary is stated. Expect to write a role map and paste one
program by hand.

**Treat direction 2 as a draft generator.** It will give you typed props, real
CSS and token bindings from your canvas, and it will bake your placeholder text
in and ignore `children`. That is worth having as a starting point. It is not
worth mistaking for a conversion.

**Both directions refuse rather than guess.** Every number on this page comes
from a gate you can re-run, and where something is unmeasured this page says
unmeasured rather than quoting a figure nobody produced.
