# Which npm release renders the pinned SHA?

The showcase pins Shopify/polaris @ `2b1ea88625e0613853ca8577c9acd1980a90f382`
(the enterprise gauntlet's SHA). At that SHA, `polaris-react/package.json` says
`13.10.1` — **a version that was never published to npm** (the registry's last
v13 release is `13.9.5`).

The verification therefore renders `@shopify/polaris@13.9.5`, and proves that
this is not a substitution but the same styling source: the git blob hashes of
every file the promotion read — all 12 components' `*.module.css`, the
promotion-cited `Button.tsx` / `Badge.tsx` / `Badge/types.ts` / `Banner.tsx` /
`Banner/utilities.ts` / `Spinner.tsx` / `Choice.module.css`, and the ENTIRE
`polaris-tokens/src` tree — are **byte-identical** between the pinned SHA and
the `@shopify/polaris@13.9.5` release tag.

Reproduce (in a clone of Shopify/polaris):

```bash
git fetch --depth 1 origin 2b1ea88625e0613853ca8577c9acd1980a90f382
git fetch --depth 1 origin "refs/tags/@shopify/polaris@13.9.5:refs/tags/v1395"
# for each file F:
git rev-parse 2b1ea88625e0613853ca8577c9acd1980a90f382:polaris-react/src/components/F
git rev-parse v1395:polaris-react/src/components/F   # → same blob hash
git rev-parse 2b1ea88625e0613853ca8577c9acd1980a90f382:polaris-tokens/src
git rev-parse v1395:polaris-tokens/src               # → same tree hash
```

Checked 2026-07-18: 19/19 files SAME, `polaris-tokens/src` tree SAME
(13.9.5 tag = `8411aa72c8becebf33796caa6ffce270c8dae3f8`).
