# Field test: Mantine — the React adapter vs a top-5 React library

The `react-tsx` adapter had only faced this repo's own code and hand-written fixtures — circular validation. This field test ran it against [Mantine](https://mantine.dev) core (`@mantine/core` source, July 2026 main), ~630 `.tsx` files from a library this project does not own. Mantine's source is **not** committed here; reproduce below.

## Result

| | |
|---|---|
| Runtime | **< 1 second**, no crash |
| Components extracted | **245** (Mantine's ~115 public components plus their compound sub-components) |
| Props proposed | **1,691** — 77 enum axes, 156 `on*` events, 164 ReactNode slot-candidates |
| Proposals | all schema-valid |
| Seen but not extractable | **58 — every one listed with its reason** (props types composed from *imported* types, e.g. Radix-derived `ScrollArea` internals — outside single-file extraction) |
| Effective visibility | ~81% of discovered components extractable; 100% of the remainder reported, 0 silent |

What the test caught and fixed: Mantine names demo files `*.story.tsx` (singular), which the walker's `*.stories.*` skip pattern missed — 700 demo pseudo-components polluted the first run. The skip pattern now covers `story|stories|demo|demos`.

## Honest reading

- Mantine's styling props (`size`, `color`, `radius`) are typed via imported aliases (`MantineSize` etc.), so they classify as `other` — present and named in the extraction, but without option sets. Recovering those needs either one-hop *cross-file* alias resolution (a known roadmap item) or Mantine-side knowledge. They are **not** silently mis-extracted.
- The 156 extracted events and 77 in-file enum axes (e.g. `Combobox`, `Popover` positioning unions) are the genuinely useful surface a reconciliation would start from.
- This is a **field test** (does the adapter survive contact with a major foreign codebase?), not the roadmap's *pilot* (which pairs extraction with a community design kit — see [`../shoelace/`](../shoelace/README.md)).

## Reproduce

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/mantinedev/mantine.git /tmp/mantine
cd /tmp/mantine && git sparse-checkout set packages/@mantine/core/src
cd - && cat > /tmp/mantine.config.json << 'EOF'
{ "code": { "adapter": "react-tsx", "root": "/tmp/mantine/packages/@mantine/core/src/components" },
  "idPrefix": "mantine", "out": "/tmp/mantine-out" }
EOF
npm run extract:code -- /tmp/mantine.config.json
```

Mantine is MIT-licensed, © Vitaly Rtishchev; this field test is not affiliated with or endorsed by the Mantine project.
