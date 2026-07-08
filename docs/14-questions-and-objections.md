# 14 · Questions & Objections

Every hard question this project should expect, asked the way a skeptic would ask it, answered with receipts. If you're evaluating the concept, start here; if you find a hard question missing, that's a contribution.

---

### "Sync tools between design and code have been tried many times. They all died. Why is this different?"

Three reasons, in increasing order of importance. First, the failed generation (Diez, InVision DSM, Modulz-era tooling) was overwhelmingly built on **side-to-side sync** — pushing changes from one surface to the other — which this model categorically rejects: surfaces never sync side-to-side; both render from a third artifact, and changes promote *into* it as reviewed diffs ([docs/01](01-architecture.md)). Second, **the authoring economics changed**: maintaining an intermediate layer used to cost more than drift hurt. This repo's 50 contracts were authored in days because AI agents do the mechanical work — the cost structure that killed the predecessors no longer exists. Third, **the buyer changed**: design-system governance was historically sold to designers, who didn't want it. The contract layer is also the guardrail artifact AI generation requires (measured: 100/100 governed vs 69/100 ungoverned, [docs/10](10-honest-generation.md)) — and agent guardrails are bought by engineering orgs, urgently.

### "The contract only governs the API surface. Behavior, motion, responsiveness — the soul of a component — isn't in there. Is this really a 'source of truth'?"

The boundary is deliberate and precise. The contract owns what both surfaces can **mechanically verify**: props and their legal values, variant axes, defaults, anatomy and token bindings, slot constraints, ARIA semantics, and (schema v6) the declared interaction surface — events like `onToggle`, whose toggle and ARIA state are generated and whose presence the differ checks. What it excludes — drag, typeahead, motion timing — is excluded because its truth *cannot be verified on the canvas surface*, and a contract making unverifiable claims is how the predecessors lied themselves to death. The API surface is exactly the layer where drift is detectable, classifiable, and arbitrable ([docs/07](07-validation.md)). Governing 100% of a component dishonestly is worth less than governing the verifiable core honestly.

### "How is this different from Figma's Code Connect / Storybook / Custom Elements Manifest / design tokens?"

Each is one fragment: **tokens (DTCG)** solved this exact problem one layer down — values — and deliberately stops below components. **CEM** describes a component API but never verifies it; described contracts drift silently, which is why this project's differ exists. **Code Connect** maps design components to code snippets, proprietary and one-directional, with no arbitration model. **Storybook** documents the code surface only. The contract model composes the missing whole: one canonical definition, two generated-or-refereed surfaces, a differ that proves the relationship continuously, and a promotion loop that makes changes converge ([docs/08](08-composition-and-spec.md) has the full landscape comparison).

### "Designers will never accept their file being governed by a JSON pull request."

Correct as stated — which is why nobody is asked to start there. Adoption is diagnostic-first: `npm run diagnose` referees existing libraries and *reports*; it changes nothing and can be ignored ([docs/11](11-brownfield-adoption.md)). The contract enters as a **record of decisions the team already made** in reconciling their own two surfaces — not a mandate. Whether organizations then accept promotion-as-arbitration is genuinely unproven; the roadmap lists it as a question no eval can answer. What's known: every alternative (declare code canonical, declare design canonical, sync side-to-side) has a documented failure mode, and this model at minimum makes the disagreement *visible* before asking anyone to change behavior.

### "Does this work with my existing design system, or only with components born from contracts?"

Both directions ship today. Greenfield: contracts generate both surfaces. Brownfield: `npm run extract:code` reads a real component library into schema-valid proposed contracts, `npm run reconcile` produces the disagreement report between your own two surfaces, and `npm run diagnose` referees them continuously — none of which assumes generation ([docs/13](13-try-it-with-your-system.md)). Receipts: extraction ran against **Shoelace** (58/58 components via its Custom Elements Manifest) and **Mantine** (245 components, 1,691 props, <1s, 100% of unreadable components reported rather than silently dropped) — two shipping libraries this project doesn't own (`extract/pilots/`).

### "Is it React-only? Figma-only?"

The architecture is adapter-shaped at both ends. Code side: adapters normalize any library into one shared shape — `react-tsx` and `cem` (any Web Component library publishing a manifest) exist; a Vue/Svelte adapter is the same pattern. Design side: the reference integration targets one commercial tool, but strictly behind a transport-agnostic script boundary, and every design binding lives in a namespaced `bindings` block — the extension point for other tools. Full vendor-neutral namespacing is a named spec-phase item ([docs/12](12-roadmap.md), Phase 3).

### "What stops the contract itself from being wrong or rotting?"

Three mechanisms. **Refusal**: invalid contracts fail the build by name — unknown tokens, defaults outside enums, duplicate identities, malformed references, incomplete mode sets (claims C2 in [docs/07](07-validation.md), adversarially swept). **Verification**: the differ continuously classifies every divergence between contract and both surfaces as ahead/behind/mismatched with a remedy; 33 deterministic evals prove each detection class. **Convergence**: applying the differ's own proposed patch returns the system to parity (eval: `promotion-converges`) — the loop never oscillates and never lies about the next step.

### "Why should I believe the AI-adherence number? Everyone's benchmarks flatter themselves."

The design of the measurement matters more than the number. The judged system is **private and novel** — not in any model's training data, unlike Material or Polaris — so adherence can't be memorized. The judges are **deterministic, not LLM**: the parity extractor and differ check every prop, value, and token reference against the contract; there is no rubric to drift. And the interesting result isn't the 100 — it's that the governed agent, on hitting a real gap, **reported the gap instead of faking around it**, and the gap became a contract proposal ([docs/10](10-honest-generation.md)). Reproduce it: `npm run eval` runs the judge against both canonical arms.

### "What's known NOT to work yet?"

Stated in one place, deliberately: anatomy below the API surface is generated but not continuously verified (a visual audit caught a canvas-only defect the differ missed — [docs/07 § What "parity clean" does and doesn't mean](07-validation.md)); fresh-file canvas rebuild hasn't run as a single operation; multi-brand is proven as a token-layer dimension (two brands, eval-backed) but not at 10+-brand portfolio scale; single-file extraction can't read cross-file type composition (reported, never silent); the reconciliation alias rules are calibrated on one system; and organizational acceptance of promotion is untested. Each has a roadmap line. If any of these is disqualifying for your case, the docs would rather tell you now.

### "Is this trying to become a standard? Under whose control?"

The ambition is explicit: a vendor-neutral component contract specification, doing for the component API layer what DTCG did for tokens, with this repo as reference implementation and conformance suite ([docs/12](12-roadmap.md)). The honest current state: single-author candidacy — which is where DTCG and CEM also started. The line that must be crossed before "spec" is a fair word: **a second implementation, built from the spec text alone by someone with no stake here, passing the conformance kit.** Until then this is a format with unusually good receipts. Governance would move to a neutral venue (a W3C Community Group or equivalent) at that point, not before.

### "What would prove this whole idea wrong?"

Concrete falsifiers, because the project should be held to its own standard: a brownfield pilot whose drift report a design-system team judges *false* (findings that aren't real, or misses within declared scope); an organization that adopts diagnostic mode and finds the findings ignorable noise rather than actionable truth; contract authoring costs that don't stay amortized by tooling as systems scale; or a demonstration that the API-surface boundary excludes so much that arbitration there doesn't reduce the design-code disputes teams actually have. None of these has happened — and the repo is instrumented so that if they do, they'll be visible.
