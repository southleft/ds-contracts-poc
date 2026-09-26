# Historical native update inputs

These three inputs reproduce the unchanged program hashes in
`core/native-contract-update-bytes.test.ts`. They were captured from the emitter
and native mock at `42beffdfc9bb5435b0c76a6d563d0d378c0bd793`, before exact-zero
empty geometry. They are synthetic API fixtures, not live Figma evidence.

The previous tests created new inputs with the current compiler on every run.
That changed the supposed historical baseline whenever emitted geometry or the
runtime revision changed. Recording the inputs makes the existing hash checks
test saved-plan compatibility independently of new canvas generation.

Capture command: `node scripts/capture-native-update-byte-inputs.mjs`. It refuses
unless all three original plan hashes match, and never overwrites these files.
The original expected hashes in the test remain unchanged. Do not refresh these
inputs to accommodate a new compiler or a changed update program.
