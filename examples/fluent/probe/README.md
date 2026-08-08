# RECON probe harness — Fluent 2

**This is not the capture harness.** The computed-capture runner writes its own
entry from `mount.imports` / `mount.wrapperOpen` in the capture config. These
files exist so that every "measured" claim in `../RECON.md` can be re-derived
by a stranger, offline, against the pinned sandbox.

## Run

```bash
# 1 · create the sandbox (RECON.md §1's recreate block), then:
cp -R examples/fluent/probe/src examples/fluent/probe/index.html \
      examples/fluent/probe/vite.config.ts examples/fluent/probe/tsconfig.json \
      examples/fluent/.fluent-sandbox/
mkdir -p examples/fluent/.fluent-sandbox/probe
cp examples/fluent/probe/probe*.mjs examples/fluent/.fluent-sandbox/probe/

# 2 · bundle both probe apps as IIFE (a file:// module script is CORS-blocked;
#     the harness serves its page differently, this is a probe-only detail)
cd examples/fluent/.fluent-sandbox
./node_modules/.bin/esbuild src/main.tsx --bundle --format=iife --loader:.tsx=tsx \
  --define:process.env.NODE_ENV='"production"' --outfile=probe/bundle.js
./node_modules/.bin/esbuild src/portal-probe.tsx --bundle --format=iife --loader:.tsx=tsx \
  --define:process.env.NODE_ENV='"production"' --outfile=probe/portal.js
printf '<!doctype html><html><head><meta charset="utf-8"><title>probe</title></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>\n' > probe/index.html
printf '<!doctype html><html><head><meta charset="utf-8"><title>portal probe</title></head><body><div id="root"></div><script src="./portal.js"></script></body></html>\n' > probe/portal.html

# 3 · run from the REPO ROOT (playwright-core resolves from the repo's node_modules)
cd ../../..
node examples/fluent/.fluent-sandbox/probe/probe.mjs  /tmp/probe.json /tmp/probe.png
node examples/fluent/.fluent-sandbox/probe/probe2.mjs /tmp/probe2.json
node examples/fluent/.fluent-sandbox/probe/probe3.mjs /tmp/probe3.json
node examples/fluent/.fluent-sandbox/probe/probe4.mjs /tmp/probe4.json
node examples/fluent/.fluent-sandbox/probe/probe5.mjs /tmp/probe5.json
```

## What each probe answers (RECON.md section it feeds)

| script | question | section |
|---|---|---|
| `probe.mjs` | Where are the 459 theme custom properties declared, and do they resolve at `:root` / on the provider / on a component? What is the DOM + class shape of each of the 12 components? What is on `document.body`? Icon shape, media queries, fonts, transitions | §2.1–§2.4, §2.2's class table |
| `probe2.mjs` | The theme rule itself (selector, declaration count); Griffel's rule families (`r*` reset vs `f*` atomic vs `___*`); selector census (`::before/after`, pseudo-classes, `[data-*]`, `data-fui-focus-visible`); **and a two-page-load determinism diff of every class in the document** | §2.1, §2.2, §4.2 |
| `probe3.mjs` | **The portal baseline diff** — snapshot `document.body`'s children with the stage empty, mount one overlay, snapshot again, report the new roots by the same rule `capture.ts:2167` uses. Also: does a real `Tab` keypress set `data-fui-focus-visible`, and does hover move the plane | §5 H1, §4.2's focus-visible paragraph |
| `probe4.mjs` | The family split: every `var()`-carrying declaration classified longhand / shorthand / `calc()` / custom-property definition, and every distinct custom property referenced | §2.5 |
| `probe5.mjs` | The one-hop indirection sites (custom-property definitions whose value is a `var()`), measured component boxes for stage sizing, and pseudo-element decor per part | §5 H3, §4.1 stage sizes, §5 H12 |

`probe4.mjs` carries one trap worth keeping: a modern Chromium `CSSStyleRule`
**has a `cssRules` property** (CSS nesting), so `if (r.cssRules) { recurse;
continue; }` skips every ordinary style rule. Test `r.style` first. The first
run of this probe reported 22 declarations instead of 2,253.
