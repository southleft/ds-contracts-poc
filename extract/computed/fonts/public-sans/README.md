# Public Sans smoke-test input

The installed CLI smoke test supplies this normal variable face (weights
100–900) because its frozen Altitude Badge dump requests Public Sans. The
test must not depend on fonts installed on a developer's computer.

The bytes are unmodified from [Google Fonts at commit
23e54b51ddffbc7713c583748e3bd86f62b1fa4a](https://github.com/google/fonts/tree/23e54b51ddffbc7713c583748e3bd86f62b1fa4a/ofl/publicsans):

- `PublicSans[wght].ttf`, saved here as `PublicSans-VariableFont_wght.ttf`:
  SHA-256 `d75a7dc1a27eb9e336d5b33f55489d2ecb5621bf694d5c43b2415bce2ca830a8`.
- `OFL.txt`: SHA-256
  `157a9e77f7580246e97c769490e2e977ae94399f9d30f4556015c41fe8c28bac`.

Copyright 2015 The Public Sans Project Authors. The accompanying OFL.txt
contains the SIL Open Font License 1.1. The font's family is authenticated
and its browser load is checked by the smoke test; this does not establish
that these are the exact font bytes used by Figma. Benchmark inputs, pins,
and fidelity thresholds remain unchanged.
