# Chakra UI — docs/35 Phase 4 reader subject

Runtime-Emotion library added via the fixture reader (no hand-authored
`recipe/fixtures/library-*.ts` table).

## Pins

| pin | value |
|---|---|
| `@chakra-ui/react` | **3.37.0** |
| `@emotion/react` | **11.14.0** (peer) |
| react / react-dom | 19.2.8 |
| esbuild | 0.28.2 |

## Recreate the sandbox (git-ignored)

```bash
mkdir -p examples/chakra/.chakra-sandbox
cd examples/chakra/.chakra-sandbox
printf '{"name":"chakra-sandbox","private":true,"type":"module"}\n' > package.json
npm i -E @chakra-ui/react@3.37.0 @emotion/react@11.14.0 react@19.2.8 react-dom@19.2.8 esbuild@0.28.2
```

## Capture

```bash
npm run extract:computed -- \
  --harness examples/chakra/.chakra-sandbox \
  --config extract/computed/configs/chakra.json \
  --component Checkbox \
  --out extract/computed/out/chakra
```

Mount: `<ChakraProvider value={defaultSystem}>`. Identity classes are
`chakra-*`; Emotion `css-<hash>` classes are dropped by `classAllow`.

**Required `--out extract/computed/out/chakra`** — the floor defaults to the
un-namespaced `extract/computed/out/<component>/` root, which would clobber
first-party Polaris captures.
