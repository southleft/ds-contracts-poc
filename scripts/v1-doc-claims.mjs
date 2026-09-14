// Current v1 status prose, independently checked against measured artifacts.
// Dated historical receipts are deliberately not scanned.
export function fidelityCounts(scorecard, known) {
  if (!Array.isArray(scorecard.rows) || !known.failures) throw new Error('v1 fidelity sources missing rows/failures');
  const labels = scorecard.rows.map((r) => r.label);
  if (new Set(labels).size !== labels.length) throw new Error('v1 fidelity source has duplicate labels');
  const passed = scorecard.rows.filter((r) => r.status === 'pass').length;
  const fringe = scorecard.rows.filter((r) => r.status === 'fringe').length;
  const failed = scorecard.rows.filter((r) => r.status === 'fail').length;
  const named = Object.keys(known.failures).length;
  if (passed + fringe + failed !== labels.length) throw new Error('v1 fidelity source has an unknown status');
  if (scorecard.subjects !== labels.length || scorecard.passed !== passed || scorecard.fringeExcused !== fringe || scorecard.failed !== failed || scorecard.knownFailures !== named) {
    throw new Error('v1 fidelity source summary disagrees with its rows');
  }
  for (const label of Object.keys(known.failures)) {
    if (!scorecard.rows.some((r) => r.label === label && r.status === 'fail')) throw new Error(`v1 fidelity named row is missing or no longer fails: ${label}`);
  }
  if (failed !== named) throw new Error('v1 fidelity source has an unnamed failure');
  return { passed, fringe, named, total: labels.length };
}

export function v1DocClaimFailures(documents, counts) {
  const failures = [];
  const rules = [
    ['docs/26-v1-definition.md', 'recipe fidelity tally', /fidelity gate (\d+) pass · (\d+) fringe ·\s*(\d+) named/g, [counts.passed, counts.fringe, counts.named]],
    ['docs/37-product-repo-manifest.md', 'named fidelity rows', /The (\w+) `KNOWN-FAILURES` rows/g, [counts.named]],
    ['parity/receipts/v1/WHAT-YOU-CAN-DO-TODAY.md', 'recipe fidelity population', /(\d+) of (\d+) fidelity rows/g, [counts.passed, counts.total]],
    ['parity/receipts/v1/WHAT-YOU-CAN-DO-TODAY.md', 'recipe fidelity tally', /(\d+) pass · (\d+) fringe · (\d+) named/g, [counts.passed, counts.fringe, counts.named]],
  ];
  for (const [file, label, pattern, expected] of rules) {
    const text = (documents[file] ?? '').replace(/\*\*/g, '').replace(/^> ?/gm, '');
    const matches = [...text.matchAll(pattern)];
    if (!matches.length) failures.push(`${file}: missing current ${label} claim — update the checker with the wording`);
    for (const match of matches) {
      if (match.slice(1).some((value, i) => Number(value) !== expected[i])) {
        failures.push(`${file}: ${label} — doc says ${match.slice(1).join('/')}, derived ${expected.join('/')}`);
      }
    }
  }
  return failures;
}

export function v1ExamClaimFailures(documents, f1, designer) {
  const failures = [];
  const clean = designer.subjects.filter((s) => s.outcome === 'accounting-zero-silent');
  const refused = designer.subjects.filter((s) => s.outcome === 'refused-by-name');
  if (!clean.length || clean.length + refused.length !== designer.subjects.length || clean.some((s) => s.silent !== 0 || s.unexplained !== 0) || refused.some((s) => !s.refusal?.message)) {
    throw new Error('designer exam source has unaccounted subjects or losses');
  }
  for (const [file, raw] of Object.entries(documents)) {
    const text = raw.replace(/\*\*/g, '').replace(/^> ?/gm, '');
    const censusClaims = [...text.matchAll(/(\d+)\s+accounting-clean,\s*(\d+)\s+refused by name/g)];
    if (!censusClaims.length) failures.push(`${file}: missing current designer exam census — update the checker with the wording`);
    for (const m of censusClaims) {
      if (+m[1] !== clean.length || +m[2] !== refused.length) failures.push(`${file}: designer exam counts disagree with the measured subjects`);
    }
    for (const m of text.matchAll(/(\d+) of (\d+) sets accounting-clean/g)) {
      if (+m[1] !== clean.length || +m[2] !== designer.subjects.length) failures.push(`${file}: designer exam population disagrees with the measured subjects`);
    }
    if (file === 'docs/35-two-journey-v1-plan.md') {
      // The first score is current; later explicitly dated rounds are history.
      const score = /pctAAMasked\s*([\d.]+)%/.exec(text);
      if (!score || +score[1] !== f1.rows.calendar.pctAAMasked) failures.push(`${file}: current calendar score disagrees with the F1 measurement`);
    }
    if (file === 'README.md') {
      const scores = [...text.matchAll(/(?:scored at|scored against the real package's Chromium render at)\s*([\d.]+)%/g)];
      if (scores.length !== 2) failures.push(`${file}: expected both current calendar score claims — update the checker with the wording`);
      for (const m of scores) if (+m[1] !== f1.rows.calendar.pctAAMasked) failures.push(`${file}: current calendar score ${m[1]} disagrees with F1 measurement ${f1.rows.calendar.pctAAMasked}`);
    }
  }
  return failures;
}
