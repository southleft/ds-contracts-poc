# Current held-out engine replay

This is an offline computed-style accounting baseline, not a visual score,
behavioral qualification, or V1 acceptance record. The shared conversion and
measurement pipeline is unchanged. No owner grades are authored here.

The frozen `canvas-to-code-held-out-v1` and `canvas-to-code-held-out-v2` directories
remain intact. Each cohort pins the complete corresponding historical file
inventory by SHA-256. The gate authenticates that inventory, reruns every subject
with the current engine, and compares every current artifact byte, including
contracts, generated code, ledgers, notes, and refusal messages. Unexpected,
missing, or changed files fail. Existing historical tests still run.

Run the two existing gates from the repository root:

```sh
npm run recipe:canvas-to-code:held-out:check
npm run recipe:canvas-to-code:held-out:v2:check
```

To investigate an intentional engine change, record into a **new** directory:

```sh
node --import tsx recipe/canvas-to-code-held-out-current.ts --record-to private/held-out-candidate
```

Recording refuses existing destinations and the frozen evidence directories.
Review observations, output changes, and residuals before updating any current
baseline. Never regenerate the frozen examinations to match today's engine.
The `attempt/` directories retain intermediate generated output, including failed
attempts. Consult the subject's result before interpreting any generated file.

## Reviewed changes

The current shared importer retains explicit LEFT text alignment and native
cross-axis start alignment. It distinguishes primary-axis growth from cross-axis
fill, carries the Tabs Stretch plane, and retains individually placed instances
when repeated siblings have different placement. Shadow-support wording also
reflects current support. Token-file regeneration comments point to this runner.

Scratch Card retains all four mounted variants. All 24 designer subjects remain
in the manifest: seven reach accounting-zero-silent and 17 retain their exact
historical refusal stage and message. The designer mounts total 132 variants.
All five previously accounted-for designer subjects remain accounted for; Radio
and Tab-Line now also reach that stage. Their names select test inputs, not
converter branches.

These outcomes retain substantial residuals. In particular, Radio still records
20 label-alignment deltas: the historical root-child harness reads a centered
wrapper, while a separate nested-leaf browser probe finds its actual text left
aligned. This baseline preserves those rows; it does not reinterpret them as
matched. Nested component stubs, omitted anatomy, named visual differences,
semantic inference, behavior, and accessibility remain unqualified. Tab-Line
mounting does not prove its child components or interactions are complete.
The shared importer now carries cross-axis fill using each child's actual
occurrences. Checkbox error rows and Textarea's nested container acquire
`width: 100%`; Textarea retains its existing refusal. React lookup output for
Checkbox and Radio now passes actual booleans to boolean children. All other
generated artifacts are unchanged, apart from Checkbox's added fill note.

A separate app archive and clean consumer measure all four Checkbox error rows
at full parent width, including a 420 px parent, while preserving sibling sizes.
All 20 nested boolean values are checked. Reimporting the already registered
child retains its mapping. This does not qualify the provisional child anatomy,
icons, visual fidelity, interaction, accessibility or native return. The
root-only accounting harness itself still does not measure nested frame width.
