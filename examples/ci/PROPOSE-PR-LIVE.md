# propose-pr — LIVE proof (the designer journey opens a real PR)

The Figma → contract → PR journey's last link is `ds-contracts propose-pr`. Until
now it was pinned only in `--dry-run` (the REST *plan*, zero token, zero network,
eval `cli-smoke`). This receipt records the **live** path actually opening a real
pull request against a real GitHub repo — and the bug that only the live run
surfaced.

This is a **network + auth receipt, not an eval**: opening a PR needs a live
GitHub token and connectivity, which the deterministic suite can't carry. The
offline *shape* of the live path is pinned separately (see "Pin" below).

---

## The command (verbatim)

A real promotion of the Polaris Badge contract: copied
`examples/polaris/contracts/badge.contract.json`, bumped `version` 0.3.2 → 0.3.3,
and added a plain-words `changelog` line (the adoption checkpoint before status
advances to `stable`). Then, LIVE — no `--dry-run`:

```bash
node packages/cli/dist/cli.js propose-pr <edited>/badge.contract.json \
  --repo tpitre/ds-contracts-pr-test \
  --token "$(gh auth token)"
```

Output:

```
✔ Opened PR #1: https://github.com/tpitre/ds-contracts-pr-test/pull/1
```

- **Real PR:** #1 — https://github.com/tpitre/ds-contracts-pr-test/pull/1
- **Branch:** `ds-contracts/propose-badge-contract-20260721013409`
- **Head commit:** `dc0b4f27211bdbee4cb64fa0df40a32e4e12e52a` — *"ds-contracts proposal: badge.contract.json"*

---

## The bug the live run found (dry-run never could)

The seeded test repo already carried `contracts/badge.contract.json`. A promotion
is an **update** to an existing contract — the normal case — and GitHub's
`PUT /repos/{repo}/contents/{path}` **refuses to overwrite an existing blob
without its current `sha`**. The original live path sent no `sha`, so the first
real run failed:

```
✘ GitHub PUT /repos/tpitre/ds-contracts-pr-test/contents/contracts/badge.contract.json
  → 422 (Invalid request. "sha" wasn't supplied.)
```

The `POST /git/refs` before it had already succeeded, leaving an orphan branch
(cleaned up via `gh api -X DELETE .../git/refs/heads/<branch>`).

**Fix (minimal, `packages/cli/src/commands/propose-pr.ts`):** before the PUT,
`GET /contents/{path}?ref={branch}` (404-tolerant `ghMaybe`) to look up the
existing blob `sha`; include it in the PUT body when the file exists (update),
omit it when it doesn't (create). The body-building is a pure, exported
`contentsPutBody(plan, content, existingSha)` so the create/update shapes are
pinnable offline. Also enriched the PR body with a plain-words `summarize()`
"What changed" block read from the contract (id / name / version / changelog).

After the fix, the same command opened PR #1 and the file landed as **modified**
(`+6 / −6`, `changed_files: 1`) — an update, not a create.

---

## gh-verified evidence

**PR meta** (`gh api repos/tpitre/ds-contracts-pr-test/pulls/1`):

```json
{"number":1,"state":"open","head":"ds-contracts/propose-badge-contract-20260721013409",
 "base":"main","url":"https://github.com/tpitre/ds-contracts-pr-test/pull/1",
 "changed_files":1,"additions":6,"deletions":6,"commits":1}
```

**Branch existed:**
`refs/heads/ds-contracts/propose-badge-contract-20260721013409 -> dc0b4f27211bdbee4cb64fa0df40a32e4e12e52a`

**Commit + file** (`gh api .../commits/<sha>`):
`ds-contracts proposal: badge.contract.json | files: contracts/badge.contract.json (modified +6 -6)`

**File diff** (`gh api .../pulls/1/files`, excerpt) — a real promotion diff:

```diff
-  "version": "0.3.0",
+  "version": "0.3.3",
   "status": "draft",
+  "changelog": "0.3.3 — Promotion proposal after owner visual sign-off on the round-5d computed floor. No binding changes; this is the adoption checkpoint that opens the designer→code PR for human review before status advances to stable.",
...
         "enum": [
+          "none",
           "incomplete",
```
(the seeded repo carried v0.3.0; the proposal updates it to v0.3.3.)

**PR body** (`gh api .../pulls/1 --jq .body`) — carries the plain-words summary:

```
This PR was opened by `ds-contracts propose-pr`.

It carries a proposed contract change as a reviewable diff: `contracts/badge.contract.json`.

**What changed**

- Contract: Badge v0.3.3 (draft) — `polaris.badge`
- 0.3.3 — Promotion proposal after owner visual sign-off on the round-5d computed floor. No binding changes; this is the adoption checkpoint that opens the designer→code PR for human review before status advances to stable.

Review it like any code change — the contract is the single source of truth;
merging it is the adoption decision. Nothing else in the repository is touched.
```

---

## Cleanup (repo left tidy)

The proof is the captured URL + gh verification above, not a lingering PR.

```bash
gh pr close 1 --repo tpitre/ds-contracts-pr-test --delete-branch
```

- **PR #1:** closed (`state: closed`) — **yes, closed by this run.**
- **Branch:** deleted (`GET .../git/ref/heads/<branch>` → `Not Found`).
- **Remaining branches:** `refs/heads/main` only.

---

## Token hygiene

- The token was passed as `--token "$(gh auth token)"` — it lived in one local
  variable for the run and was **never** written to disk, committed, or logged.
  Source order: `--token`, else `DS_CONTRACTS_GITHUB_TOKEN`, else `GITHUB_TOKEN`.
- No token value appears in this receipt or any captured output; console output
  in this session was piped through `sed -E 's/ghp_[A-Za-z0-9]+/ghp_***MASKED***/g'`
  as a belt-and-suspenders mask. The token is a `ghp_…`-masked placeholder here.
- `propose-pr` never persists the credential; it only sets an `Authorization:
  Bearer` header per request.

---

## Pin (offline shape of the live path)

`evals/run.ts` → `propose-pr-live-shape` (claim `C7-cli`) pins the two request
shapes dry-run never exercised, all pure + offline:

- `contentsPutBody(plan, content, sha)` **includes** `sha` on update (the exact
  422 regression) and **omits** it on create;
- the PUT commits to the proposal branch with the plan title and base64-encodes
  the contract verbatim;
- the PR body embeds the plain-words "What changed" summary.

Suite: **138 / 138** (137 prior + this pin). Package `tsc` and root `tsc` green.
The live PR open above remains a network+auth receipt, not an eval.
