# Source validity before conversion fidelity

Outcome-first checkpoint 1. This module is connected to the local Playground's
**Source validation** screen (`/sources`), including measured trees and API/content
intake, not yet to mint. Source validity and semantic inventory are separate
statuses; neither establishes Figma fidelity, reusable output, or owner approval.

The initial cohort is **Altitude Button, Checkbox, Card**, from the actual
local Storybook at source revision `0639eccd15bfedc4fa9713d9545a64cef2c0f0a5`.
Button must include default/secondary/disabled and an icon state; Checkbox
default/checked/indeterminate/disabled; Card default and content composition.
All are retained in the denominator even when refused. This is NOT the older
`altitude-web-components@1.0.2` npm corpus or a claim that local code already
matches the Altitude Figma file. React wrappers share the Web Component engine;
an independent React implementation remains needed later.

The cohort runner retains all ten selected states, including source failures.
Source expectations cite the
library's styling and token files, not conversion output. The actual Storybook
theme is dark; changing the browser colorScheme is not a theme-provider change.

```sh
npm run source:reference:check
node --import tsx source-reference/run.ts \
  'http://127.0.0.1:6017/iframe.html?id=atoms-button--default&viewMode=story' \
  /Users/tjpitre/Sites/altitude private/source-reference-altitude-run1
node --import tsx source-reference/cohort-run.ts http://127.0.0.1:6017 \
  /Users/tjpitre/Sites/altitude private/source-reference-altitude-cohort1
```

Start Altitude's existing Storybook with Node 22, `npm run start -- --port 6017
--host 127.0.0.1 --ci --no-open`, in its `libs/al-web-components` directory.
Do not rebuild, reset or modify the owner's source checkout. The runner refuses
an existing output directory. Screenshots preserve the whole original story,
including its background. No conversion, custom visual masks, or score tuning.

The generic browser test proves missing component CSS, missing theme tokens,
missing font, hidden/empty content, and a failed asset are rejected. Font proof
uses Chromium's actual painted fonts: `document.fonts.ready` or `fonts.check`
alone can report success while fallback is used. The local-story runner also
removes theme/component CSS and blocks fonts in isolated browser pages; it does
not edit source files. A styling failure cannot become a reference success.

The runner now records the actual HTTP resources (including transformed source,
CSS and fonts) in a private HAR, closes the original context, and replays in a
fresh context with network fallback and WebSockets disabled. The replay must
pass the same source witnesses and match the original screenshot bytes. Each
capture must also have stable pixels and witnesses over a bounded quiet window.
This pins the bytes actually consumed, not an independent rebuild of the source
package. HAR files can contain local paths and must stay private unless reviewed
separately for sensitive information. Status-101 WebSocket handshake entries do
not have response bodies; WebSockets are disabled during replay.

The browser tests shut down their original server before replay, then remove a
stylesheet from a copied archive and prove failure. They are wired into the fast
CI lane through source:reference:check, alongside the module's typecheck.

Remaining before this checkpoint is complete: all cohort states, end-to-end
source/dependency lineage for the build (distinct from the recorded runtime
bytes), and integration into the application so no failed reference can reach
conversion. A bounded stable window does not promise absence of future changes.
No completed user journey is claimed.

## Cohort interpretation

The runner preserves the actual Storybook lifecycle, including its play functions;
it does not suppress interactions to get an easier screenshot. The indeterminate
Checkbox play function clicks the input and restores only the mixed CSS state,
so the final native checked value is true. It does not set native indeterminate.
That source behavior is documented, not an accessibility approval. Each row keeps
its exact profile and limitations. Render readiness and interaction correctness
remain separate axes.

Nested probes verify actual input state, icon presence/size, and Card image decode
and dimensions. Composed components use a separate painted-label font witness.
Full-page captures prevent a long Card from being silently cut off at the viewport.
Failed states remain in the denominator; nothing here repairs the owner's library.

## Application connection

Run `npm run playground` and use **Source validation** in the navigation. Enter
the running local Altitude Storybook origin and click **Connect and validate**.
The application invokes the same cohort runner without hand-editing capture
configs or measurement files. It displays all ten states, the original and
network-isolated replay, and independent (currently unmeasured) Figma/behavior/
workflow statuses. The source's own play functions remain part of the reference.

This dev-only API is loopback/same-origin restricted. Requests cannot choose a
checkout, script or output path. It serves only the two PNGs for known session
and story IDs, never HARs, raw logs or arbitrary files. Double submission shares
the active job. Failures can be retried into a new evidence directory. Source
rows remain provisional until final source integrity is known. Evidence stays
under `private/source-reference-app/`. Completed compatible cohorts survive
browser reloads and dev-server restarts. Recovery validates the fixed cohort,
source revision, original/replay identities and matching final/per-story records;
malformed, incomplete and symlinked records are not reopened as complete. The UI
labels recovery as recorded evidence, never a fresh check. Missing original start
times and origins are not invented. Stopping the server interrupts its owned
capture; restart does not silently resume, overwrite or approve that run.

The existing pre-pivot conversion screen is unchanged. This is a real source
connection step, not yet the complete autonomous code-to-Figma product journey.

## Measured compiler input

Valid stories also pass through the existing production computed-style reader,
on the same original page and a fresh archive replay. The reader's new optional
root path targets the exact validated element inside Storybook decorators; its
legacy stage-based entry point is unchanged. It walks shadow roots and assigned
slots, reads all enumerated longhands and pseudo-element planes, and preserves
CSS token candidates and unreadable-stylesheet boundaries. No remount or manual
role-map transcription is involved in this acquisition step.

`source-tree.json` and `replay-tree.json` retain the measured trees. They must
match byte-for-byte and remain paired with the validated source PNGs before the
application reports a verified capture. The application shows its element/text/
pseudo/token-candidate census. Invalid sources cannot furnish compiler input.
These are raw input facts, not Figma output, verified variable bindings, recipe
selection or behavior qualification. The reviewed recipe adapters still impose
manual mappings; removing that product limitation is unfinished work, not a
reason to fabricate review provenance or restamp signed fixtures.

## API and content evidence

The additive `readCemDeclarations()` reader preserves the exact declared public
properties, defaults as unevaluated source expressions, slots and event names.
It does not use the legacy CEM adapter's inferred callback names or defaults.
`semantics.ts` observes actual host values, assigned and fallback slot content,
nested native controls and reference attributes before the visual reader's
flattening can erase them. Each source/replay observation is retained separately.

Original pixels, repeated semantic observations and a continuous DOM mutation
watch bracket the reads. Screenshots retain initial caret styling rather than
temporarily restyling inputs. Wrong types, unreadable controls, getter side
effects, invalid provenance and replay differences refuse intake. This is a
bounded observation window, not a purity sandbox or proof of future behavior.
Closed nested shadow roots and event execution remain outside this inventory.

Random generated IDs remain exact in the evidence; they are not discarded to
make replay pass. Comparing their identity/reference graph requires a separately
specified and tested equivalence rule. Likewise, a declared conditional slot not
rendered in one state remains unresolved, not absent from the component.

These facts are inputs to the existing universal contract authority, not another
contract schema or generator. The next boundary must prove source-to-part joins,
typed bindings, legal omitted variants, editable content and event behavior
through the existing emitters before any generated cohort can be qualified.
