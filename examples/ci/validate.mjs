/**
 * examples/ci/validate.mjs — the CI recipes, executed locally.
 *
 * `act` is not assumed. Instead this script:
 *   1. YAML-parses both workflow files (the lint — a malformed recipe fails
 *      here, before any execution),
 *   2. builds a scratch consumer repo per workflow (code-led: the committed
 *      foreign-sibling extraction fixture as the component lib; design-led:
 *      the committed evals/fixtures/storybook-skeleton + the Polaris Badge
 *      contract/tokens/icons),
 *   3. EXECUTES every `run:` step's commands verbatim (bash --noprofile
 *      --norc -e -o pipefail, GitHub's own step shell) against the PUBLISHED
 *      @ds-contracts/cli@0.3.0 — the commands must actually work; that is
 *      the test,
 *   4. HONORS step-level `if:` — each executed step gets its own
 *      $GITHUB_OUTPUT file, and a supported `if:` expression is evaluated
 *      against those outputs / the step env. A step whose condition is false
 *      is recorded as SKIPPED, exactly as GitHub would skip it. This is not
 *      cosmetic: code-led.yml's anatomy gate skips the canvas half, and the
 *      code-led consumer fixture (a React library with no co-located CSS)
 *      TRIPS that gate — a receipt that ran the bundle step anyway would be
 *      claiming the recipe does something it does not do. An `if:` shape this
 *      evaluator does not understand FAILS the validation rather than being
 *      assumed true,
 *   5. steps that require live GitHub context (git push with a workflow
 *      token, posting a PR comment) are named CI-ONLY: their shell is still
 *      `bash -n` syntax-checked, never executed. `uses:` steps (checkout,
 *      setup-node, upload-artifact) have no `run:` — YAML lint covers them.
 *   6. writes the receipt: examples/ci/VALIDATION.md.
 *
 * Every run-step must be classified here (executed, skipped by its own `if:`,
 * or CI-only with a named reason) — an unclassified step fails the
 * validation, so a recipe edit cannot silently skip local execution.
 *
 * Zero new dependencies: `yaml` already ships in the repo's node_modules
 * (a storybook transitive), tsx resolves chromiumExecutable() for the
 * screenshot step, npx fetches the published CLI.
 *
 * Run from the repo root:  node examples/ci/validate.mjs
 * (network required: npm registry for the published CLI + the consumer
 *  install — this is a one-shot local validation, not an eval-suite gate.)
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CLI_SPEC = '@ds-contracts/cli@0.3.0';

// ---------------------------------------------------------------------------
// Step classification: every run-step is either executed locally or CI-only
// (named reason). Unlisted run-steps fail the validation.
// ---------------------------------------------------------------------------

const CI_ONLY = {
  'code-led.yml': {
    'Commit the refreshed contracts back to the branch':
      'pushes with the workflow GITHUB_TOKEN — the scratch consumer is not a git remote; shell syntax-checked (bash -n)',
    'Publish to the standing CI→Figma channel':
      'needs a LIVE channel — a minted write key plus the deployed worker. (`figma publish` and `figma claim-channel` ARE in the pinned 0.3.0; an earlier revision of this note claimed otherwise and was wrong.) Shell syntax-checked (bash -n). The channel transport itself is pinned network-free by workers/assist/test/channel.test.ts (24 cases) and the `channel-round-trip` eval.',
  },
  'design-led.yml': {
    'Post the PR comment (plain GITHUB_TOKEN — no external services)':
      'POSTs to the GitHub REST API for a live PR — no PR exists locally; shell syntax-checked (bash -n). The comment BODY construction is its own step and IS executed.',
  },
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const results = []; // { workflow, step, mode, ok, note }
let failed = false;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function bashSyntaxCheck(script, cwd) {
  const f = path.join(cwd, `.step-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(f, script);
  const r = sh('bash', ['-n', f], { cwd });
  rmSync(f);
  return r;
}

function runStep(script, cwd, env, outputsFile) {
  const f = path.join(cwd, `.step-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(f, script);
  if (outputsFile) writeFileSync(outputsFile, '');
  // GitHub's own step shell invocation.
  const r = sh('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', f], {
    cwd,
    env: { ...process.env, ...env, ...(outputsFile ? { GITHUB_OUTPUT: outputsFile } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rmSync(f);
  return r;
}

// ---------------------------------------------------------------------------
// `if:` — the supported subset, evaluated for real
// ---------------------------------------------------------------------------
//
// GitHub's expression language is large; this evaluator understands exactly
// the shapes these two recipes use, and REFUSES anything else. Guessing "true"
// for an unrecognised condition is how a receipt ends up claiming a step ran
// that CI would have skipped — the precise dishonesty this validator exists
// to prevent.
//
// Supported: always(), `steps.<id>.outputs.<name> ==|!= '<literal>'`,
// `env.<NAME> ==|!= ''`, and `&&` chains of those.
class UnsupportedIf extends Error {}

function evalIf(expr, stepOutputs, env) {
  const body = String(expr).trim().replace(/^\$\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  return body.split('&&').every((clauseRaw) => {
    const clause = clauseRaw.trim();
    if (clause === 'always()') return true;
    const m = /^(steps\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)|env\.([A-Za-z0-9_]+))\s*(==|!=)\s*'([^']*)'$/.exec(clause);
    if (!m) throw new UnsupportedIf(clause);
    const actual = m[2] ? (stepOutputs[m[2]]?.[m[3]] ?? '') : (env[m[4]] ?? process.env[m[4]] ?? '');
    return m[5] === '==' ? actual === m[6] : actual !== m[6];
  });
}

/** Resolve the `${{ … }}` expressions GitHub substitutes into a step's `env:`
 *  block before the shell ever sees it. `secrets.*` resolve to '' locally —
 *  there are no secrets in a scratch consumer, which is the truth. */
function resolveExpr(value, stepOutputs) {
  return String(value).replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (whole, expr) => {
    let m = /^steps\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)$/.exec(expr);
    if (m) return stepOutputs[m[1]]?.[m[2]] ?? '';
    if (/^secrets\./.test(expr)) return '';
    m = /^env\.([A-Za-z0-9_]+)$/.exec(expr);
    if (m) return process.env[m[1]] ?? '';
    throw new UnsupportedIf(`env expression ${whole}`);
  });
}

const readOutputs = (file) => {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
};

function record(workflow, step, mode, ok, note) {
  results.push({ workflow, step, mode, ok, note });
  const mark = ok ? '✔' : '✖';
  console.log(`  ${mark} [${mode}] ${step}${note ? ` — ${note.split('\n')[0]}` : ''}`);
  if (!ok) {
    failed = true;
    console.log(`----- full step output -----\n${note}\n----------------------------`);
  }
}

function validateWorkflow(file, consumerDir, stepEnv) {
  console.log(`\n${file} (consumer: ${consumerDir})`);
  const doc = parseYaml(readFileSync(path.join(HERE, file), 'utf8'));
  if (!doc || typeof doc !== 'object' || !doc.jobs) throw new Error(`${file}: YAML parse produced no jobs`);
  record(file, '(whole file)', 'yaml-lint', true, `parsed: name=${doc.name}, ${Object.keys(doc.jobs).length} job(s)`);

  const stepOutputs = {}; // step id → { name: value } (GitHub's steps context)

  for (const [jobId, job] of Object.entries(doc.jobs)) {
    for (const step of job.steps ?? []) {
      const label = step.name ?? step.uses ?? '(unnamed)';

      // Syntax first — a step GitHub would skip still has to be well-formed,
      // because the very next consumer's config makes it run.
      if (step.run) {
        const syntax = bashSyntaxCheck(step.run, consumerDir);
        if (syntax.status !== 0) {
          record(file, label, 'bash -n', false, syntax.out.trim());
          continue;
        }
      }

      // Then `if:` — GitHub evaluates it before deciding to run anything, and
      // it applies to `uses:` steps too.
      let skipped = false;
      if (step.if !== undefined) {
        try {
          skipped = !evalIf(step.if, stepOutputs, stepEnv);
        } catch (err) {
          if (!(err instanceof UnsupportedIf)) throw err;
          record(file, label, 'if-unsupported', false,
            `this validator cannot evaluate \`if: ${step.if}\` (clause: ${err.message}). Teach evalIf() the shape rather than assuming it is true.`);
          continue;
        }
      }
      if (skipped) {
        record(file, label, 'skipped-by-if', true,
          `if: ${step.if} → false in this consumer; GitHub would skip this step${step.run ? ' (shell still bash -n-checked)' : ''}`);
        continue;
      }

      if (!step.run) {
        record(file, label, 'action', true, `uses: ${step.uses} — no run block; YAML lint covers it`);
        continue;
      }
      const ciOnlyReason = CI_ONLY[file]?.[step.name];
      if (ciOnlyReason) {
        record(file, label, 'ci-only', true, ciOnlyReason);
        continue;
      }
      // Step-level `env:` — GitHub substitutes its `${{ … }}` before running.
      let ownEnv;
      try {
        ownEnv = Object.fromEntries(
          Object.entries(step.env ?? {}).map(([k, v]) => [k, resolveExpr(v, stepOutputs)]),
        );
      } catch (err) {
        if (!(err instanceof UnsupportedIf)) throw err;
        record(file, label, 'env-unsupported', false,
          `this validator cannot resolve step env: ${err.message}. Teach resolveExpr() the shape.`);
        continue;
      }
      const outFile = path.join(consumerDir, `.step-output-${step.id ?? 'anon'}.txt`);
      const r = runStep(step.run, consumerDir, { ...stepEnv, ...ownEnv }, outFile);
      if (step.id) stepOutputs[step.id] = readOutputs(outFile);
      rmSync(outFile, { force: true });
      const tail = r.out.trim().split('\n').slice(-3).join(' ⏎ ');
      const outNote = step.id && Object.keys(stepOutputs[step.id] ?? {}).length > 0
        ? ` [outputs: ${Object.entries(stepOutputs[step.id]).map(([k, v]) => `${k}=${v}`).join(', ')}]`
        : '';
      record(file, label, 'executed', r.status === 0,
        r.status === 0 ? `${tail}${outNote}` : `exit ${r.status}\n${r.out.slice(-2000)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Scratch consumers
// ---------------------------------------------------------------------------

const SCRATCH = mkdtempSync(path.join(os.tmpdir(), 'ds-contracts-ci-validate-'));
console.log(`scratch: ${SCRATCH}`);

// npx cache warm-up + version pin proof.
const version = sh('npx', ['--yes', CLI_SPEC, '--version'], { cwd: SCRATCH });
if (version.status !== 0 || !version.out.includes('0.3.0')) {
  console.error(`published CLI unavailable:\n${version.out}`);
  process.exit(1);
}
console.log(`published ${CLI_SPEC} answers --version: ${version.out.trim()}`);

// -- code-led consumer: a component library (the committed foreign-sibling
//    extraction fixture) + the committed config shape.
const codeLed = path.join(SCRATCH, 'code-led-consumer');
mkdirSync(codeLed, { recursive: true });
cpSync(path.join(ROOT, 'extract', 'fixtures', 'foreign-sibling'), path.join(codeLed, 'lib'), { recursive: true });
writeFileSync(
  path.join(codeLed, 'ds-contracts.config.json'),
  JSON.stringify({ code: { adapter: 'react-tsx', root: 'lib' }, idPrefix: 'acme', out: 'ds-contracts/out' }, null, 2) + '\n',
);

// -- design-led consumer: the committed Storybook skeleton + the repo's own
//    ds.button contract, tokens, icons and committed tokens.css.
//    (NOT the Polaris Badge: its round-4 DOM-anatomy contract exposes a
//    react-emitter defect over hyphenated part names — see the Findings
//    section this script writes into VALIDATION.md.)
const designLed = path.join(SCRATCH, 'design-led-consumer');
cpSync(path.join(ROOT, 'evals', 'fixtures', 'storybook-skeleton'), designLed, { recursive: true });
mkdirSync(path.join(designLed, 'contracts'), { recursive: true });
cpSync(path.join(ROOT, 'contracts', 'button.contract.json'), path.join(designLed, 'contracts', 'button.contract.json'));
mkdirSync(path.join(designLed, 'tokens', 'modes'), { recursive: true });
for (const t of ['primitives.tokens.json', 'semantic.tokens.json', 'modes/semantic.light.tokens.json', 'modes/semantic.dark.tokens.json']) {
  cpSync(path.join(ROOT, 'tokens', t), path.join(designLed, 'tokens', t));
}
cpSync(path.join(ROOT, 'assets', 'icons'), path.join(designLed, 'icons'), { recursive: true });
// The design system's CSS custom properties (committed build artifact) — the
// skeleton's placeholder src/tokens.css is replaced, exactly as a real
// consumer's token build would.
cpSync(path.join(ROOT, 'src', 'styles', 'tokens.css'), path.join(designLed, 'src', 'tokens.css'));
writeFileSync(
  path.join(designLed, 'ds-contracts.config.json'),
  JSON.stringify(
    {
      code: { adapter: 'react-tsx', root: 'src/generated' },
      tokens: [
        'tokens/primitives.tokens.json',
        'tokens/semantic.tokens.json',
        'tokens/modes/semantic.light.tokens.json',
        'tokens/modes/semantic.dark.tokens.json',
      ],
      idPrefix: 'ds',
      out: 'ds-contracts/out',
      diagnose: { contracts: 'contracts' },
    },
    null,
    2,
  ) + '\n',
);
// `npm ci` (the workflow step) needs a lockfile; producing it is consumer
// setup, not a step under test.
console.log('design-led consumer: npm install (lockfile for the npm ci step)…');
const lock = sh('npm', ['install', '--no-audit', '--no-fund'], { cwd: designLed });
if (lock.status !== 0) {
  console.error(`consumer npm install failed:\n${lock.out.slice(-2000)}`);
  process.exit(1);
}

// Local stand-ins for GitHub-context env the steps read.
const summaryFile = path.join(SCRATCH, 'github-step-summary.md');
writeFileSync(summaryFile, '');
const chromium = sh('npx', ['tsx', '-e', "import { chromiumExecutable } from './extract/figma/visual-parity/render.ts'; console.log(chromiumExecutable());"], { cwd: ROOT });
const chromiumPath = chromium.status === 0 ? chromium.out.trim().split('\n').pop() : '';

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

validateWorkflow('code-led.yml', codeLed, {
  GITHUB_STEP_SUMMARY: summaryFile,
  GITHUB_SHA: '0000000000000000000000000000000000000000',
});
validateWorkflow('design-led.yml', designLed, {
  // No PR locally: the changed-contracts step honors this preset (documented
  // in the recipe) instead of running the base..head git diff.
  CHANGED_CONTRACTS: 'contracts/button.contract.json',
  CHROMIUM_PATH: chromiumPath,
});

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------

const now = new Date().toISOString().slice(0, 10);
const lines = [
  '# CI recipe validation — local execution receipt',
  '',
  `_Produced by \`node examples/ci/validate.mjs\` on ${now}. Regenerate any time; network required (published CLI + consumer install)._`,
  '',
  `Published CLI under test: \`${CLI_SPEC}\` (npm answers \`--version\` → \`${version.out.trim()}\`).`,
  '',
  '`act` is not assumed. Every `run:` step below was parsed out of the workflow YAML and executed',
  "verbatim with GitHub's own step shell (`bash --noprofile --norc -e -o pipefail`) in a scratch",
  'consumer repo — **code-led**: the committed foreign-sibling extraction fixture as the component',
  "library; **design-led**: the committed `evals/fixtures/storybook-skeleton` + the repo's own",
  '`ds.button` contract/tokens/icons/tokens.css (see Findings for why not the Polaris Badge).',
  'Steps that need live GitHub context are CI-ONLY by name (shell still',
  '`bash -n`-checked); `uses:` steps have no shell to run — the YAML lint covers them.',
  '',
  "Step-level `if:` is EVALUATED, not ignored: each step gets its own `$GITHUB_OUTPUT` and a",
  '`skipped-by-if` row means GitHub would skip that step in this consumer too. An `if:` shape the',
  'evaluator does not understand fails the validation rather than being assumed true.',
  '',
];
for (const wf of ['code-led.yml', 'design-led.yml']) {
  lines.push(`## ${wf}`, '', '| Step | Mode | Result | Note |', '| --- | --- | --- | --- |');
  const rows = results.filter((x) => x.workflow === wf);
  for (const r of rows) {
    const note = (r.note ?? '').split('\n')[0].replace(/\|/g, '\\|');
    lines.push(`| ${r.step.replace(/\|/g, '\\|')} | ${r.mode} | ${r.ok ? '✔ pass' : '✖ FAIL'} | ${note} |`);
  }
  lines.push('');
  for (const r of rows.filter((x) => !x.ok)) {
    lines.push(`### ✖ ${r.step} — full output`, '', '```', (r.note ?? '').trim(), '```', '');
  }
}
lines.push(
  '## Findings — defects this validation caught by EXECUTING the recipes',
  '',
  '### code-led: static extraction on this consumer produces STUB anatomy — the anatomy gate fires',
  '',
  'The code-led consumer fixture (`extract/fixtures/foreign-sibling`) is a React library with **no',
  'co-located CSS Modules**, which is the majority case in the wild. `ds-contracts extract` proposes',
  '5 schema-valid contracts and every one of them carries `"anatomy": { "root": {} }` — a stub.',
  '',
  'A stub does not refuse downstream. Emitted to the canvas it produces a component set with',
  'correctly-named variant frames and nothing inside them (measured on a comparable stub: 10',
  'variants, a 53,283-byte sync script, every variant spec a bare `{ type: root, name, layout }`',
  'with no children, no fills, no text).',
  '',
  'Before the gate, this validation executed the bundle step on exactly these five stub contracts',
  'and recorded a pass — the receipt certified a recipe that ships hollow components. `code-led.yml`',
  'now carries an **anatomy gate**: contracts are still extracted and committed (a stub contract is',
  'a real, reviewable API surface), and only the CANVAS half is withheld, with the stub components',
  'and the computed-capture fix named in the job summary. The rows above show that gate returning',
  '`canvas_ready=false` and the downstream steps `skipped-by-if`, which is the recipe working.',
  '',
  '### react emitter: hyphenated part names emit invalid JavaScript (found 2026-07-19, FIXED)',
  '',
  '_Historical — fixed in the reference repo (`core/emit-react.ts` now emits bracket access) and',
  'carried in the published 0.2.0. Kept here because it is why the design-led consumer below uses',
  '`ds.button` rather than the Polaris Badge._',
  '',
  'The first design-led validation run used the Polaris Badge v0.3.0 contract (round-4 DOM-anatomy',
  'promotion: part names `label-2`, `icon-2`, `icon-3-incomplete`, …). `ds-contracts generate` (and',
  '`npm run generate` — same engine) emits `className={styles.label-2}` /',
  '`className={styles.icon - 3 - incomplete}`: **member access with a hyphenated identifier**, which',
  'JavaScript parses as subtraction. Result at runtime: `NaN` class names on the default render and',
  '`ReferenceError: incomplete is not defined` as soon as a story sets `progress` (the Matrix story',
  'crashed; 15/16 Badge stories screenshotted, the 16th timed out on the Storybook error screen).',
  'The SAME invalid code is already committed in `examples/polaris/generated/react/Badge.tsx` (round-4',
  'stage 8, "76 files byte-stable" — byte-stability was gated, runtime execution was not).',
  '',
  '- Repro (on 0.1.0, the version where it was found — 0.2.0 no longer reproduces it):',
  '  `npx --yes @ds-contracts/cli@0.1.0 generate examples/polaris/contracts/badge.contract.json',
  '  --out /tmp/x --tokens examples/polaris/tokens/polaris-light.dtcg.json,examples/polaris/tokens/polaris-minted.dtcg.json',
  '  --icons examples/polaris/assets/icons --stories` → `grep "styles\\." /tmp/x/Badge/Badge.tsx`',
  '- Fix belongs in `core/emit-react.ts` (bracket access `styles[\'label-2\']` for non-identifier part',
  '  names) — outside this validation\'s scope; owned by the emitter workstream.',
  '- This receipt therefore validates the design-led recipe against the repo\'s own `ds.button`',
  '  contract (camelCase part names, sound output). The recipe itself is unchanged either way.',
  '',
  '## Job summary produced by the code-led summary step (local stand-in file)',
  '',
  // Four backticks: the summary itself contains a fenced block.
  '````markdown',
  readFileSync(summaryFile, 'utf8').trim(),
  '````',
  '',
);
writeFileSync(path.join(HERE, 'VALIDATION.md'), lines.join('\n') + '\n');
console.log(`\n${failed ? 'FAILED' : 'ok'} — receipt: examples/ci/VALIDATION.md`);
rmSync(SCRATCH, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
