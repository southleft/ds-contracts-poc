# MUI oracle — independent expected dispositions

Authored for Wave 2 **before** offline/live oracle runs. Sources: Material
family list, `examples/mui/PROVENANCE.md` named policies, `accuracy/grammar.json`
archetypes, and capture/portal rules — **not** current engine scores.

Disposition vocabulary matches the repo frontiers:

| Token | Meaning |
|-------|---------|
| `CARRIED` | Fact present at the named contract/canvas locus |
| `LOWERED` | Carried via a named rewrite (`expectName`) |
| `REFUSED` | Looked at; dropped **by name** |
| `UNSUPPORTED` | Reader never looked (decrease-only ratchet) |
| `LEDGERED` | Canvas named degradation / capture-boundary note |

Round-trip invent/loss tags must cite `accuracy/grammar.json`
`normalizationRules` / `factRulePredicates`.

## Corpus members (pilot reuse)

### Button / Chip / Slider / Card / Tabs / Accordion / Switch / Checkbox

- **Variant space:** `CARRIED` when structured Figma definitions + complete
  tuples exist; otherwise exact mode `REFUSED` with a stable
  `EXACT_*` code (Wave 1). No silent Cartesian fill.
- **Checked / expanded axes:** `CARRIED` as VARIANT axes (not
  `-state-checked` name invention).
- **Disabled / interaction overlays on census components:** preview axes
  only when `figmaStatePreviews` accepts; otherwise `REFUSED` by name.
- **Nested instances:** none in current MUI pilot contracts — do not claim
  R2 closure on MUI until TextField (or equivalent) lands.

### Autocomplete

- **Closed capture:** `CARRIED` for input/chip plane; listbox portal path
  `REFUSED` / `LEDGERED` until a dedicated portal+census round (PROVENANCE:
  open listbox forces portal and loses interaction planes).
- **renderInput → TextField:** geometry of the composed input is `CARRIED`
  or `LOWERED` by named rewrite; identity of a nested TextField instance is
  `UNSUPPORTED` until TextField joins the corpus with instance refs.

### Dialog (portal molecule)

- **Portaled paper / modal root:** `CARRIED` under `portalCapture` single-root
  policy.
- **Focus-trap sentinels / full-bleed inert layers:** `REFUSED` by name
  (`stripInertPortalChildren` / demote rules) — never promoted as anatomy.
- **Interaction `states`:** `[]` by policy → overlay hover/focus/active
  `REFUSED` / `LEDGERED` as portal capture boundary, not silent omission.
- **Pixel parity vs stage:** not a CARRIED claim; document as
  portal-measurement boundary.

### Table (supported organism)

- **HTML table box:** `LOWERED` to accessible div+roles where grammar
  requires (named lowering).
- **`stickyHeader`:** `REFUSED` by name (`position: sticky` not carried).
- **Inlined Checkbox / row cells:** `CARRIED` as inlined anatomy unless an
  instance ref is declared — do not invent nested `component` identity.
- **Open row Menu:** `REFUSED` / receipted under single-portaled-root policy.

## New members

### TextField (`pending-seed`)

Expected once seeded (archetype `input-field` in grammar):

- Adornment start/end: `CARRIED` as nested instances **or** `REFUSED` by
  name if inlined — never silent name-only lookup.
- Label / helper / error text styles: `CARRIED` by semantic identity or
  `text-style-identity-refused`.
- Until seed+capture exist: corpus row is `pending-seed`; oracle must not
  treat absence as a green pass.

### SpeedDial (`negative-control`)

- Entire organism: `UNSUPPORTED` (or proposal `REFUSED` by a stable named
  code) — nested Fab + actions is outside the Wave 2 supported grammar.
- **Forbidden:** partial success that draws empty/wrong SpeedDial frames
  without that refusal (`drawable-empty` / named unsupported).

## Live session minimum

For `button`, `switch`, `table`: offline oracle dispositions above must
agree with the scripted live receipt (emit → apply → dump → edit → detect
→ restore → compare). Any live-only bug needs a failing headless
reproduction before its fix is accepted.

## Non-goals for this EXPECTED file

- Do not ratify fidelity percentages from PROVENANCE tables as pass/fail.
- Do not shrink `accuracy/baseline.json` denominators to admit the corpus.
- Do not mark UUI R1 `verified-exact` from MUI work.
