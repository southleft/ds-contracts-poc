# Security owner disposition — V1-SEC-01 (pre-filled)

**Row this closes:** `RELEASE_CHECKLIST.md` → "Security owner approval:
blocked — human (V1-SEC-01 disposition)" and HUMAN-HANDOFF row 3.

**Requirement (docs/26, V1-SEC-01):** conversion remains deterministic and
local; credentials MUST NOT be committed, embedded in generated artifacts, or
stored by the plugin. Public Worker transports MUST fail closed, enforce
their capability boundaries, and keep model-spend reservation atomic.
Evidence: the release security review records a clean secret scan and links
[Known Limitations §B.14](../../../docs/23-known-limitations.md#b14-the-standing-cifigma-channel-is-half-a-channel).

## The three security checks — latest green runs

Workflow: `.github/workflows/security.yml`, run
[31244817821](https://github.com/southleft/ds-contracts-poc/actions/runs/31244817821)
on PR #13, branch `feat/exact-conversion-wave0`, head SHA
`1d243fa98ded530e1edfd35d0f810974cd5dbc21`, completed 2026-08-08, all jobs
SUCCESS:

| Check | Conclusion | Job URL |
|---|---|---|
| **secret scan** | success | https://github.com/southleft/ds-contracts-poc/actions/runs/31244817821/job/93071569909 |
| **dependency review** | success | https://github.com/southleft/ds-contracts-poc/actions/runs/31244817821/job/93071569911 |
| **npm audit** | success | https://github.com/southleft/ds-contracts-poc/actions/runs/31244817821/job/93071569951 |

Supporting local evidence at the earlier frozen evidence SHA `4fda3b3`
(RELEASE_CHECKLIST "Linux and GitHub evidence" + "Clean macOS rehearsal"):
`npm run audit:production` — 0 high+ vulnerabilities (V1-SEC-02); worker
suite / playground / plugin checks green inside the fast lane.

> **Freeze caveat:** if the release owner freezes a different commit than
> `1d243fa`, re-pull the three job URLs for that SHA
> (`gh run list --workflow security --limit 5`) before signing. Do not sign
> over URLs that point at a different commit than the one being released.

## What the security owner attests by signing

1. The **secret scan** on the release commit is green, and no finding was
   suppressed or waived without being listed below.
2. **Dependency review** and **npm audit** on the release commit are green;
   production dependencies carry no known high/critical vulnerability
   (V1-SEC-02), and any advisory exclusion is named in the workflow, reviewed,
   and still justified.
3. The known, deliberately open transport limitation is acknowledged, not
   discovered later: **deliveries on the standing CI↔Figma channel are not
   signed** (plugin sandbox has no WebCrypto) — docs/23 §B.14. The
   write-key/read-key split (`readKey = sha256(writeKey)`) and the freshness
   guard are the compensating controls.
4. No credentials are committed, embedded in generated artifacts, or stored
   by the plugin, to the best of the owner's review of the scan evidence.

Findings dispositions (fill in; "none" is a valid entry):

| Finding | Source check | Disposition (fixed / accepted-with-reason) |
|---|---|---|
| | | |

## Signature

- Security owner: ____________________
- Release commit reviewed: ____________________
- Date: ____________________
- Disposition: **APPROVED / APPROVED-WITH-EXCEPTIONS (listed above) / REJECTED**

On signature: check the "Security owner approval" box in
`RELEASE_CHECKLIST.md` with a link to this file, and close HUMAN-HANDOFF
row 3.
