# Roadmap

The product goal is code ↔ contracts ↔ canvas: start from either library, generate the other, and maintain their supported semantics through verified repair. It includes advanced composed component sets.

**V1 targets React ↔ contracts ↔ Figma.** Lit and Web Components integration is paused for planned V1.1 after the React journeys qualify. Preserve the existing adapters and evidence; reuse the framework-neutral contract and shared generators. Deferring a framework does not remove stateful components, composition or two-way repair from V1.

**v1 is not complete.** The [current status and milestone plan](docs/CURRENT.md) is the authoritative work order and names the evidence needed to finish each step:

1. Define and verify the supported React syntax, styling and composition rules against original source inputs.
2. Complete the React-to-Figma application journey across simple, stateful and composed components.
3. Complete the Figma-to-reusable-React journey in a clean consumer.
4. Demonstrate safe two-way repair and recovery for an existing React/Figma pair.
5. Repeat on independently selected supported React compositions and qualify release readiness.

The current focus is the React-led application journey through shared conversion rules. Each additional example should test a missing rule or interaction, not require its own converter. There is no evidence-backed completion date or percentage. Progress is reported as usable outcomes, coverage, manual intervention and remaining gaps.

Beyond that product milestone, the longer-term goal is a vendor-neutral component contract specification, a conformance suite, an independent implementation and open community governance. See [Composition and specification goals](docs/08-composition-and-spec.md).
