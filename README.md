# Design System Contracts

An attempt at a deterministic bridge between Figma component sets and React components, through a JSON contract. The
same input always gives the same output, and no AI model is part of the conversion.

## Where it stands

The project is being rebuilt small. The next step compares one Figma component with its React twin, property by
property, starting with Carbon's Button:

1. Read the Figma component's JSON and render the React component. Measure both, and report for every variant, part and
   property whether the values match, differ, or can't be compared, and why.
2. Then the reverse: measure what the React component draws, build it in Figma with every value bound to a variable from
   the token table, read it back, and report it the same way.

The plan is in [docs/GOAL.md](docs/GOAL.md), and the current step and its checklist are in
[docs/STATUS.md](docs/STATUS.md).

## What works today

- `scripts/figma-to-react.ts` turns a Figma component set into a React package and checks it against Figma's own images
  in a pinned browser.
- `scripts/react-to-figma-run.ts` reads a React library's Storybook and writes its components into a Figma file as
  component sets, then reads them back and checks them.
- Both are deterministic and write receipts of what they did.

## What doesn't, yet

- Results have been measured only on the components the engine was tuned on. A reading on components it was not tuned
  on has not been taken.
- On a practice design system it was not tuned for, the engine's Figma to React rules changed nothing, and its React to
  Figma rules helped but left most components failing.
- Nothing has been released since August 2026. The last npm release, `@ds-contracts/cli` 0.5.0-rc.1, has no
  `figma-to-react`. There are no outside users yet.

## Run it

Use Node 20.19.4 (`.nvmrc`), then install and build:

```bash
npm ci
```

```bash
npm run prep:core
```

- The playground, the dashboard and Storybook run with `npm run playground`, `npm run dashboard` and `npm run storybook`.
- The checks and the cold-tree build steps are in [CONTRIBUTING.md](CONTRIBUTING.md), under "The gates".
- Security reports: [SECURITY.md](SECURITY.md). License: MIT ([LICENSE](LICENSE)).
